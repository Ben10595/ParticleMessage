import type { WritingSettings } from '../types/message';
const segmenter = new Intl.Segmenter('de', { granularity: 'grapheme' });
export function graphemes(text: string): string[] { return Array.from(segmenter.segment(text), item => item.segment); }
export function characterDelay(character: string, settings: WritingSettings): number {
  if (character === '\n') return settings.speed + settings.paragraphPause;
  if (/[.!?…]/u.test(character)) return settings.speed + settings.punctuationPause;
  if (/[,;:]/u.test(character)) return settings.speed + settings.punctuationPause * .45;
  return settings.speed;
}
export function typingTimeline(text: string, settings: WritingSettings): number[] {
  let time = 0;
  return graphemes(text).map(character => { const start = time; time += characterDelay(character, settings); return start; });
}
export const LINK_LIFETIME_MS = 3 * 24 * 60 * 60 * 1000;
export function isMessageExpired(createdAt: unknown, now = Date.now()): boolean {
  const created = typeof createdAt === 'string' ? Date.parse(createdAt) : NaN;
  return !Number.isFinite(created) || created > now + 60000 || now >= created + LINK_LIFETIME_MS;
}
