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
