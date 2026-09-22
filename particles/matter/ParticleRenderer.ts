import type { ParticlePool } from './MorphSystem';
import { Behavior, CAPACITY, COLORS, type Box } from './types';
const vertex = `#version 300 es
precision highp float;
layout(location=0) in vec2 corner;
layout(location=1) in vec4 particle;
layout(location=2) in vec3 tint;
layout(location=3) in vec2 velocity;
uniform vec2 viewport;
uniform float trails;
out vec2 uv;
out vec4 color;
void main(){
  uv=corner;
  float speed=length(velocity);
  vec2 direction=speed>0.01 ? velocity/speed : vec2(1.0,0.0);
  vec2 normal=vec2(-direction.y,direction.x);
  float stretch=min(sqrt(speed)*0.12,4.5)*trails;
  vec2 local=direction*corner.x*(particle.z*2.7+stretch)+normal*corner.y*particle.z*2.7;
  vec2 pixel=particle.xy+local;
  gl_Position=vec4(pixel.x/viewport.x*2.0-1.0,1.0-pixel.y/viewport.y*2.0,0.0,1.0);
  color=vec4(tint,particle.w);
}`;
const fragment = `#version 300 es
precision highp float;
in vec2 uv;
in vec4 color;
out vec4 pixel;
void main(){
 float d=length(uv);
 // Screen-space coverage keeps subpixel dots visible at every glyph offset.
 float edge=max(fwidth(d)*0.5,0.025);
 float core=1.0-smoothstep(0.34-edge,0.34+edge,d);
 float halo=exp(-d*d*5.5)*0.18;
 float alpha=(core+halo)*color.a;
 if(d>1.0) discard;
 pixel=vec4(color.rgb,alpha);
}`;
/** Independent WebGL2 implementation. One instanced draw, reusable interleaved upload. */
export class ParticleRenderer {
  readonly kind: 'webgl2' | 'canvas2d';
  renderedCount = 0;
  private gl: WebGL2RenderingContext | null;
  private ctx: CanvasRenderingContext2D | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private instances: WebGLBuffer | null = null;
  private corners: WebGLBuffer | null = null;
  private viewport: WebGLUniformLocation | null = null;
  private trails: WebGLUniformLocation | null = null;
  private data = new Float32Array(CAPACITY * 9);
  private width = 1; private height = 1; private dpr = 1;
  constructor(private canvas: HTMLCanvasElement, forceCanvas = false) {
    this.gl = forceCanvas ? null : canvas.getContext('webgl2', { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, powerPreference: 'default' });
    this.kind = this.gl ? 'webgl2' : 'canvas2d';
    if (this.gl) this.initialize();
    else { this.ctx = canvas.getContext('2d', { alpha: true }); if (!this.ctx) throw new Error('Canvas unavailable'); }
  }
  initialize() {
    const gl = this.gl; if (!gl) return;
    const shaders: WebGLShader[] = [];
    try {
      for (const [kind, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
        const shader = gl.createShader(kind); if (!shader) throw new Error('Unable to allocate shader');
        shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'Shader failed');
      }
      this.program = gl.createProgram(); if (!this.program) throw new Error('Unable to allocate program');
      shaders.forEach(s => gl.attachShader(this.program!, s)); gl.linkProgram(this.program);
      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program) ?? 'Link failed');
      this.vao = gl.createVertexArray(); this.instances = gl.createBuffer(); this.corners = gl.createBuffer();
      if (!this.vao || !this.instances || !this.corners) throw new Error('Unable to allocate buffers');
      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.corners);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instances); gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
      for (const [location, size, offset] of [[1,4,0],[2,3,16],[3,2,28]]) { gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, size, gl.FLOAT, false, 36, offset); gl.vertexAttribDivisor(location, 1); }
      gl.bindVertexArray(null); gl.useProgram(this.program);
      this.viewport = gl.getUniformLocation(this.program, 'viewport'); this.trails = gl.getUniformLocation(this.program, 'trails');
      gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE); gl.clearColor(0,0,0,0);
    } catch (e) { this.destroy(); throw e; }
    finally { shaders.forEach(s => gl.deleteShader(s)); }
  }
  resize(width: number, height: number, dpr: number) {
    this.width = width; this.height = height; this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.floor(width * dpr)); this.canvas.height = Math.max(1, Math.floor(height * dpr));
  }
  draw(p: ParticlePool, trail: number, tiltX: number, tiltY: number, reduced: boolean, clip: Box | null = null) {
    const d = this.data; let count = 0;
    for (let i = 0; i < p.count; i++) {
      if (p.alpha[i] < .02) continue;
      const n = count++ * 9, owned = p.owner[i] !== 0;
      const parallax = owned ? .5 : 9 + Math.abs(p.z[i]) * .1;
      d[n] = p.x[i] + (reduced ? 0 : tiltX * parallax); d[n+1] = p.y[i] + (reduced ? 0 : tiltY * parallax);
      d[n+2] = p.radius[i] * (owned ? 1 : .65 + (p.z[i] + 65) / 180); d[n+3] = p.alpha[i];
      if (clip && p.owner[i] === 2 && (d[n] < clip.x || d[n] > clip.x + clip.width || d[n+1] < clip.y || d[n+1] > clip.y + clip.height)) d[n+3] = 0;
      d[n+4] = p.color[i*3]; d[n+5] = p.color[i*3+1]; d[n+6] = p.color[i*3+2];
      // A restrained warm shimmer follows moving scene dots and vanishes as they settle.
      if (!reduced && p.owner[i] === 2 && p.state[i] === Behavior.FORMING) {
        const warmth = Math.min(.28,Math.hypot(p.vx[i],p.vy[i])*.0008);
        d[n+4] += (COLORS.gold[0]-d[n+4])*warmth;
        d[n+5] += (COLORS.gold[1]-d[n+5])*warmth;
        d[n+6] += (COLORS.gold[2]-d[n+6])*warmth;
      }
      const sceneMotion = p.owner[i] >= 2 && (p.state[i] === Behavior.FORMING || p.state[i] === Behavior.MAGNETIC || p.state[i] === Behavior.PORTAL);
      const releasedMotion = !owned && (p.state[i] === Behavior.DISPERSE || p.state[i] === Behavior.EXPLODE);
      const trailScale = sceneMotion ? 1 : releasedMotion ? .32 : 0;
      d[n+7] = p.vx[i] * trailScale; d[n+8] = p.vy[i] * trailScale;
    }
    this.renderedCount = count;
    const gl = this.gl;
    if (gl) {
      if (gl.isContextLost()) return;
      gl.viewport(0,0,this.canvas.width,this.canvas.height); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(this.program); gl.uniform2f(this.viewport, this.width, this.height); gl.uniform1f(this.trails, reduced ? 0 : trail);
      gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.instances);
      gl.bufferSubData(gl.ARRAY_BUFFER,0,d,0,count*9);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,count); gl.bindVertexArray(null);
    } else if (this.ctx) {
      const ctx = this.ctx;
      ctx.setTransform(this.dpr,0,0,this.dpr,0,0); ctx.clearRect(0,0,this.width,this.height);
      // Group by opacity and palette: far fewer draw calls than per-dot Canvas rendering.
      for (let palette = 0; palette < 3; palette++) for (let bucket = 0; bucket < 8; bucket++) {
        ctx.beginPath(); ctx.fillStyle = ['#f2eed9','#d1ad70','#a8a6d4'][palette]; ctx.globalAlpha = (bucket + .5) / 8;
        for (let i = 0; i < count; i++) {
          const n = i * 9, c = d[n+4] < .7 ? 2 : d[n+4] < .9 ? 1 : 0;
          if (d[n+3] < .025 || c !== palette || Math.min(7, Math.floor(d[n+3]*8)) !== bucket) continue;
          ctx.moveTo(d[n]+d[n+2],d[n+1]); ctx.arc(d[n],d[n+1],d[n+2],0,Math.PI*2);
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }
  destroy() { const gl = this.gl; if (!gl) return; gl.deleteProgram(this.program); gl.deleteBuffer(this.instances); gl.deleteBuffer(this.corners); gl.deleteVertexArray(this.vao); this.program = this.instances = this.corners = this.vao = null; }
}
