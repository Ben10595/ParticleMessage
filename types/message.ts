export const EFFECTS = ['morph', 'scatter', 'explosion', 'vortex', 'wave', 'rain', 'outward', 'implode', 'random'] as const;
export type TransitionEffect = typeof EFFECTS[number];
export const EFFECT_LABELS: Record<TransitionEffect, string> = { morph: 'Smooth Morph', scatter: 'Scatter', explosion: 'Explosion', vortex: 'Wirbel', wave: 'Welle', rain: 'Regen', outward: 'Nach außen', implode: 'Zusammenziehen', random: 'Zufällig' };
export interface WritingSettings { enabled: boolean; speed: number; punctuationPause: number; paragraphPause: number }
export interface MessageSettings { effect: TransitionEffect; finale: boolean; writing: WritingSettings }
export interface Slide { text: string; duration: number; effect?: TransitionEffect }
export interface MessageContent { version: 1; slides: Slide[]; settings?: MessageSettings }
export const WRITING_PRESETS = {
  Schnell: { speed: 35, punctuationPause: 180, paragraphPause: 350 },
  Normal: { speed: 75, punctuationPause: 420, paragraphPause: 800 },
  Ruhig: { speed: 115, punctuationPause: 650, paragraphPause: 1200 },
  Dramatisch: { speed: 170, punctuationPause: 1100, paragraphPause: 1800 },
};
export const DEFAULT_SETTINGS: MessageSettings = { effect: 'morph', finale: false, writing: { enabled: false, ...WRITING_PRESETS.Normal } };
export const MAX_SLIDES = 15;
export const MAX_TEXT_LENGTH = 150;
export const MIN_DURATION = 1000;
export const MAX_DURATION = 10000;
function record(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
function numberIn(value: unknown, min: number, max: number): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max; }
export function isEffect(value: unknown): value is TransitionEffect { return EFFECTS.includes(value as TransitionEffect); }
export function validateMessage(value: unknown): MessageContent {
  if (!record(value) || value.version !== 1 || !Array.isArray(value.slides)) throw new Error('Das Nachrichtenformat ist ungültig.');
  if (value.slides.length < 1 || value.slides.length > MAX_SLIDES) throw new Error('Erstelle zwischen 1 und 15 Abschnitte.');
  const slides = value.slides.map((slide: unknown, index: number): Slide => {
    if (!record(slide) || typeof slide.text !== 'string') throw new Error(`Abschnitt ${index + 1}: Der Text fehlt.`);
    const text = slide.text.trim();
    if (!text) throw new Error(`Abschnitt ${index + 1} ist noch leer.`);
    if (Array.from(slide.text).length > MAX_TEXT_LENGTH) throw new Error(`Abschnitt ${index + 1}: Maximal 150 Zeichen.`);
    if (!numberIn(slide.duration, MIN_DURATION, MAX_DURATION)) throw new Error(`Abschnitt ${index + 1}: Wähle 1 bis 10 Sekunden.`);
    if (slide.effect !== undefined && !isEffect(slide.effect)) throw new Error('Dieser Übergang ist ungültig.');
    return { text, duration: Math.round(slide.duration), ...(slide.effect !== undefined ? { effect: slide.effect } : {}) };
  });
  if (value.settings === undefined) return { version: 1, slides };
  const s = value.settings;
  if (!record(s) || !isEffect(s.effect) || typeof s.finale !== 'boolean' || !record(s.writing)) throw new Error('Die Animationseinstellungen sind ungültig.');
  const w = s.writing;
  if (typeof w.enabled !== 'boolean' || !numberIn(w.speed, 20, 250) || !numberIn(w.punctuationPause, 0, 2500) || !numberIn(w.paragraphPause, 0, 4000)) throw new Error('Die Schreibgeschwindigkeit oder Pausen sind ungültig.');
  return { version: 1, slides, settings: { effect: s.effect, finale: s.finale, writing: { enabled: w.enabled, speed: Math.round(w.speed), punctuationPause: Math.round(w.punctuationPause), paragraphPause: Math.round(w.paragraphPause) } } };
}
