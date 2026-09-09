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
  mock('document', { hidden: false, addEventListener: (name: string) => listeners.add(name), removeEventListener: (name: string) => listeners.delete(name) });
  mock('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  mock('requestAnimationFrame', (callback: FrameRequestCallback) => { nextFrame = callback; return 1; });
  mock('cancelAnimationFrame', () => { cancelled = true; });
  const context = { setTransform() {}, fillRect() {}, beginPath() {}, arc() {}, fill() {} };
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
  mock('document', { hidden: false, addEventListener() {}, removeEventListener() {} });
  mock('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  mock('requestAnimationFrame', (fn: FrameRequestCallback) => { frame = fn; return 1; });
  mock('cancelAnimationFrame', () => {});
  const context = { setTransform() {}, fillRect() {}, beginPath() {}, moveTo() {}, arc() {}, fill() {} };
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
    engine.disperseText();
    assert.equal(frameParticle.state, 'HOLDING', 'editor frame survives a preview edit');
    assert.equal(particle.state, 'DISPERSING', 'only the preview text dissolves');
    const pending = engine.wait(10000);
    engine.destroy();
    await assert.rejects(pending, { name: 'AbortError' });
  } finally {
    engine?.destroy();
    for (const [key, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
