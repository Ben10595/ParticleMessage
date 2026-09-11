import test from 'node:test';
import assert from 'node:assert/strict';
import { OneLineEngine } from '../lines/OneLineEngine';
import { WRITING_PRESETS } from '../types/message';

test('line renderer preserves punctuation timing on resize, retracts, and cleans up its animation', async () => {
  const original = new Map<string, PropertyDescriptor | undefined>();
  const mock = (key: string, value: unknown) => { original.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); };
  const frames = new Map<number, FrameRequestCallback>(); let frameId = 0, now = 0;
  const events = new Map<string, () => void>();
  const tick = (duration: number) => {
    const end = now + duration;
    while (now < end) { now += 16.67; const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn(now)); }
  };
  const browser = { innerWidth: 900, innerHeight: 700, devicePixelRatio: 3, addEventListener: (name: string, fn: () => void) => events.set(name, fn), removeEventListener: (name: string) => events.delete(name) };
  const media = { matches: false, addEventListener: (_name: string, fn: () => void) => events.set('motion', fn), removeEventListener: () => events.delete('motion') };
  mock('window', browser);
  mock('document', { hidden: false, addEventListener: (name: string, fn: () => void) => events.set(name, fn), removeEventListener: (name: string) => events.delete(name) });
  mock('matchMedia', () => media);
  mock('requestAnimationFrame', (fn: FrameRequestCallback) => { frames.set(++frameId, fn); return frameId; });
  mock('cancelAnimationFrame', (id: number) => frames.delete(id));
  let strokes = 0;
  const ctx = { setTransform() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {}, bezierCurveTo() {}, arc() {}, fill() {}, fillText() {}, stroke() { strokes++; } };
  const canvas = { width: 0, height: 0, dataset: {} as Record<string, string>, getContext: () => ctx } as unknown as HTMLCanvasElement;
  let engine: OneLineEngine | undefined;
  try {
    engine = new OneLineEngine(canvas);
    assert.equal(canvas.width, 1800);
    tick(1200); assert.equal(strokes, 0, 'no free background wire is rendered in an empty scene');
    const formation = engine.formText('Hi. A❤️', { writing: { enabled: true, ...WRITING_PRESETS.Normal, periodPause: 1800 } });
    tick(800); assert.equal(canvas.dataset.visibleCharacters, '3');
    browser.innerWidth = 390; events.get('resize')?.(); tick(300);
    assert.equal(canvas.dataset.visibleCharacters, '3', 'layout changes do not restart the punctuation clock');
    tick(formation); assert.equal(canvas.dataset.visibleCharacters, '6'); assert.equal(canvas.dataset.phase, 'holding');
    assert.ok(strokes > 50, 'letters are drawn as paths');
    engine.disperseText(); tick(700); assert.equal(canvas.dataset.phase, 'holding');
    const beforeIdle = strokes; tick(1000); assert.equal(strokes, beforeIdle, 'no stray line remains after the text retracts');
    const controller = new AbortController(), cancelled = engine.wait(5000, controller.signal); controller.abort();
    await assert.rejects(cancelled, { name: 'AbortError' });
    const destroyed = engine.wait(10000); engine.destroy();
    await assert.rejects(destroyed, { name: 'AbortError' });
    assert.equal(events.size, 0); assert.equal(frames.size, 0);
    media.matches = true;
    engine = new OneLineEngine(canvas);
    assert.equal(engine.formText('Sofort. ❤️', { writing: { enabled: true, ...WRITING_PRESETS.Dramatisch } }), 0);
    tick(20); assert.equal(canvas.dataset.phase, 'holding');
    assert.throws(() => new OneLineEngine({ getContext: () => null } as unknown as HTMLCanvasElement), /Canvas/);
  } finally {
    engine?.destroy();
    for (const [key, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
