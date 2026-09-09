import type { WritingSettings } from '../types/message';
const segmenter = new Intl.Segmenter('de', { granularity: 'grapheme' });
export function graphemes(text: string): string[] { return Array.from(segmenter.segment(text), item => item.segment); }
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
export const LINK_LIFETIME_MS = 3 * 24 * 60 * 60 * 1000;
export function isMessageExpired(createdAt: unknown, now = Date.now()): boolean {
  const created = typeof createdAt === 'string' ? Date.parse(createdAt) : NaN;
  return !Number.isFinite(created) || created > now + 60000 || now >= created + LINK_LIFETIME_MS;
}
