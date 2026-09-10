import test from 'node:test';
import assert from 'node:assert/strict';
import { ParticleEngine } from '../particles/ParticleEngine';

test('reuses particles across keyed UI updates, handles reduced motion and clears animation resources', async () => {
  const original = new Map<string, PropertyDescriptor | undefined>();
  const mock = (key: string, value: unknown) => { original.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); };
  const listeners = new Set<string>();
  let nextFrame: FrameRequestCallback | undefined;
  let cancelled = false;
  mock('window', { innerWidth: 900, innerHeight: 700, devicePixelRatio: 3, addEventListener: (name: string) => listeners.add(name), removeEventListener: (name: string) => listeners.delete(name) });
  const spriteContext = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {} };
  mock('document', { createElement: () => ({ getContext: () => spriteContext }), hidden: false, addEventListener: (name: string) => listeners.add(name), removeEventListener: (name: string) => listeners.delete(name) });
  mock('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  mock('requestAnimationFrame', (callback: FrameRequestCallback) => { nextFrame = callback; return 1; });
  mock('cancelAnimationFrame', () => { cancelled = true; });
  const context = { drawImage() {}, setTransform() {}, fillRect() {}, beginPath() {}, arc() {}, fill() {} };
  const canvas = { width: 0, height: 0, dataset: {}, getContext: () => context } as unknown as HTMLCanvasElement;
  let engine: ParticleEngine | undefined;
  try {
    engine = new ParticleEngine(canvas);
    assert.equal(canvas.width, 1800, 'DPR is capped at 2');
    engine.setParticleTargets([{ key: 'a', x: 10, y: 20 }, { key: 'b', x: 30, y: 40 }]);
    const a = engine.particles.find(p => p.targetX === 10)!;
    const pool = [...engine.particles];
    engine.setParticleTargets([{ key: 'b', x: 30, y: 40 }, { key: 'a', x: 80, y: 90 }], false);
    assert.equal(a.x, 80, 'the same keyed point retains its particle and snaps under reduced motion');
    assert.equal(a.y, 90);
    assert.ok(engine.particles.every((particle, i) => particle === pool[i]));
    const controller = new AbortController();
    const wait = engine.wait(10000, controller.signal);
    controller.abort();
    await assert.rejects(wait, { name: 'AbortError' });
    engine.disperseParticles();
    assert.ok(engine.particles.every(p => p.state === 'FLOATING'));
    nextFrame?.(16);
    engine.destroy();
    assert.equal(listeners.size, 0);
    assert.equal(cancelled, true);
    assert.throws(() => new ParticleEngine({ getContext: () => null } as unknown as HTMLCanvasElement), /Canvas/);
  } finally {
    engine?.destroy();
    for (const [key, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});

test('morphs from current positions, settles exactly, protects glyphs from pointer forces and aborts on destroy', async () => {
  const original = new Map<string, PropertyDescriptor | undefined>();
  const mock = (key: string, value: unknown) => { original.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); };
  let frame: FrameRequestCallback = () => {};
  const events = new Map<string, (event: unknown) => void>();
  mock('window', { innerWidth: 900, innerHeight: 700, devicePixelRatio: 1, addEventListener: (name: string, fn: (event: unknown) => void) => events.set(name, fn), removeEventListener() {} });
  const spriteContext = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {} };
  mock('document', { createElement: () => ({ getContext: () => spriteContext }), hidden: false, addEventListener() {}, removeEventListener() {} });
  mock('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  mock('requestAnimationFrame', (fn: FrameRequestCallback) => { frame = fn; return 1; });
  mock('cancelAnimationFrame', () => {});
  const context = { drawImage() {}, setTransform() {}, fillRect() {}, beginPath() {}, moveTo() {}, arc() {}, fill() {} };
  const canvas = { dataset: {}, getContext: () => context } as unknown as HTMLCanvasElement;
  let engine: ParticleEngine | undefined;
  try {
    engine = new ParticleEngine(canvas);
    engine.setParticleTargets([{ key: 'letter', x: 50, y: 60 }], false);
    const particle = engine.particles.find(p => p.targetX === 50)!;
    engine.setParticleTargets([{ key: 'letter', x: 650, y: 350 }]);
    assert.equal(particle.x, 50, 'assignment must not teleport the particle');
    for (let t = 0; t < 550; t += 16.67) frame(t);
    assert.ok(particle.x > 50 && particle.x < 650, 'visible flight between old and new glyph');
    for (let t = 550; t < 1600; t += 16.67) frame(t);
    assert.equal(particle.state, 'HOLDING');
    assert.equal(particle.x, 650); assert.equal(particle.y, 350);
    events.get('pointermove')?.({ clientX: 648, clientY: 348 });
    for (let t = 1600; t < 1900; t += 16.67) frame(t);
    assert.equal(particle.x, 650, 'pointer never shakes held text');
    assert.equal(particle.y, 350);
    engine.setParticleTargets([{ key: 'letter', x: 650, y: 350 }, { key: 'ui-frame', x: 20, y: 20 }], false);
    const frameParticle = engine.particles.find(p => p.targetX === 20 && p.targetY === 20)!;
    const beforeRelease = { x: particle.x, y: particle.y, vx: particle.velocityX, vy: particle.velocityY };
    engine.disperseText();
    assert.deepEqual({ x: particle.x, y: particle.y, vx: particle.velocityX, vy: particle.velocityY }, beforeRelease, 'release preserves position and momentum');
    assert.equal(frameParticle.state, 'HOLDING', 'editor frame survives a preview edit');
    assert.equal(particle.state, 'DISPERSING', 'only the preview text dissolves');
    for (let t = 1900; t < 3700; t += 16.67) frame(t);
    assert.equal(particle.state, 'FLOATING');
    assert.ok(particle.opacity > .1 && particle.opacity <= .6, 'released point returns to visible ambient dust');
    assert.ok(particle.softness > .95, 'released point becomes soft');
    assert.ok(Math.hypot(particle.x - 650, particle.y - 350) < 100, 'release stays gentle');
    engine.setParticleTargets([{ key: 'glyph-0-test', x: 350, y: 260, glow: true, opacity: 1 }]);
    const formed = engine.particles.find(p => p.targetX === 350 && p.targetY === 260)!;
    for (let t = 3700; t < 5600; t += 16.67) frame(t);
    assert.equal(formed.state, 'HOLDING'); assert.equal(formed.opacity, 1); assert.equal(formed.softness, 0);
    const count = engine.particles.length;
    engine.setParticleTargets([{ key: 'glyph-0-test', x: 351, y: 260, glow: true, opacity: 1 }]);
    assert.equal(engine.particles.length, count, 'the existing swarm supplies the next form');
    const pending = engine.wait(10000);
    engine.destroy();
    await assert.rejects(pending, { name: 'AbortError' });
  } finally {
    engine?.destroy();
    for (const [key, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});

test('animates wandering contours, hover sparks, pointer wake and typing stream', () => {
  const original = new Map<string, PropertyDescriptor | undefined>();
  const mock = (key: string, value: unknown) => { original.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); };
  let frame: FrameRequestCallback = () => {};
  const events = new Map<string, (event: unknown) => void>();
  mock('window', { innerWidth: 900, innerHeight: 700, devicePixelRatio: 1, addEventListener: (name: string, fn: (event: unknown) => void) => events.set(name, fn), removeEventListener() {} });
  const spriteContext = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {} };
  mock('document', { createElement: () => ({ getContext: () => spriteContext }), hidden: false, addEventListener() {}, removeEventListener() {} });
  mock('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  mock('requestAnimationFrame', (fn: FrameRequestCallback) => { frame = fn; return 1; });
  mock('cancelAnimationFrame', () => {});
  const context = { drawImage() {}, setTransform() {}, fillRect() {}, beginPath() {}, moveTo() {}, arc() {}, fill() {} };
  const canvas = { dataset: {}, getContext: () => context } as unknown as HTMLCanvasElement;
  let engine: ParticleEngine | undefined;
  try {
    engine = new ParticleEngine(canvas);

    // 1. Wandering contour test
    const rectTargets = [{
      key: 'loop-p1',
      x: 10,
      y: 10,
      loop: { type: 'rect' as const, x: 10, y: 10, width: 100, height: 50, perimeter: 300, offset: 0, speed: 20 },
    }];
    engine.setParticleTargets(rectTargets, false);
    const loopP = engine.particles.find(p => p.targetX === 10 && p.targetY === 10)!;
    assert.equal(loopP.state, 'HOLDING');
    assert.equal(loopP.x, 10);
    assert.equal(loopP.y, 10);

    // Advance time and check that points wander along the perimeter
    for (let t = 0; t < 1000; t += 16.67) frame(t);
    assert.ok(loopP.x > 10, 'wandering border dot advances along top edge');
    assert.equal(loopP.y, 10);

    // 2. Hover sparks test
    engine.triggerHoverSparks({ x: 50, y: 50, width: 80, height: 35 }, 12);
    // Frame updates sparks
    frame(1050);

    // 3. Pointer trail (Schweif)
    events.get('pointermove')?.({ clientX: 200, clientY: 200 });
    events.get('pointermove')?.({ clientX: 240, clientY: 220 });
    frame(1070);

    // 4. Typing stream flow
    engine.emitTypingFlow(
      { right: 300, top: 200, height: 150, width: 200, left: 100, bottom: 350, x: 100, y: 200, toJSON: () => {} },
      { left: 500, top: 200, height: 300, width: 300, right: 800, bottom: 500, x: 500, y: 200, toJSON: () => {} }
    );
    for (let t = 1100; t < 2000; t += 16.67) frame(t);

    engine.destroy();
  } finally {
    engine?.destroy();
    for (const [key, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
