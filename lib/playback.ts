import type { TransitionEffect, WritingSettings } from '../types/message';
const segmenter = new Intl.Segmenter('de', { granularity: 'grapheme' });
export function graphemes(text: string): string[] { return Array.from(segmenter.segment(text), item => item.segment); }
export function wordTimeline(text: string, step = 160): number[] {
  let word = -1, inside = false;
  return graphemes(text).map(character => {
    if (/\s/u.test(character)) inside = false;
    else if (!inside) { word++; inside = true; }
    return Math.max(0, word) * step;
  });
}
export function characterDelay(character: string, settings: WritingSettings): number {
  if (character === '\n') return settings.speed + settings.paragraphPause;
  if (/[.…]/u.test(character)) return settings.speed + (settings.periodPause ?? settings.punctuationPause);
  if (character === '?') return settings.speed + (settings.questionPause ?? settings.punctuationPause);
  if (character === '!') return settings.speed + (settings.exclamationPause ?? settings.punctuationPause);
  if (/[,;:]/u.test(character)) return settings.speed + (settings.commaPause ?? settings.punctuationPause * .45);
  return settings.speed;
}
export function typingTimeline(text: string, settings: WritingSettings): number[] {
  let time = 0;
  return graphemes(text).map((character, index) => {
    const start = time;
    // Deterministic human variation: preview and public viewer share exactly the same rhythm.
    const variation = Math.round(settings.speed * .12 * Math.sin((character.codePointAt(0) ?? 0) * 13 + index * 7));
    time += characterDelay(character, settings) + variation;
    return start;
  });
}
/** A single schedule drives both the editor preview and a shared message. */
export function effectTimeline(text: string, effect: TransitionEffect, writing: WritingSettings | undefined, speed = 1): number[] {
  const chars = graphemes(text);
  if (effect === 'wordByWord' || effect === 'floatingWords') {
    const words = wordTimeline(text, 1);
    const lastWord = words.at(-1) ?? 0;
    const step = Math.min((effect === 'floatingWords' ? 380 : 310) / speed, 3200 / speed / Math.max(1, lastWord));
    return words.map(index => index * step);
  }
  if (effect === 'typewriter') {
    if (writing?.enabled) return typingTimeline(text, writing);
    const step = Math.min(58 / speed, 3200 / speed / Math.max(1, chars.length - 1));
    return chars.map((_, index) => index * step);
  }
  if (writing?.enabled) return typingTimeline(text, writing);
  return chars.map(() => 0);
}
/** Short glyph reveals keep a long sentence from waiting for every letter to settle. */
export function effectDuration(effect: TransitionEffect, speed = 1): number {
  const base = effect === 'typewriter' ? 240
    : effect === 'wordByWord' ? 560
    : effect === 'floatingWords' ? 850
    : effect === 'fade' ? 1050
    : effect === 'pixel' ? 1000
    : effect === 'wave' ? 1300
    : effect === 'bloom' ? 1500
    : effect === 'collect' || effect === 'scatter' ? 1600
    : 1900;
  return base / speed;
}
export const LINK_LIFETIME_MS = 3 * 24 * 60 * 60 * 1000;
export function isMessageExpired(createdAt: unknown, now = Date.now()): boolean {
  const created = typeof createdAt === 'string' ? Date.parse(createdAt) : NaN;
  return !Number.isFinite(created) || created > now + 60000 || now >= created + LINK_LIFETIME_MS;
}
