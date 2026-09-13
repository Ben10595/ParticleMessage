import { validateFeatures, validateFinale, type SceneFeatures, type Finale } from './experience';
// Version 1 remains readable: new per-slide settings are optional.
export const EFFECTS = ['morph', 'scatter', 'vortex', 'wave', 'rain', 'implode', 'fade', 'rise', 'bloom', 'typewriter', 'explosion', 'spiral', 'magnet', 'zoom', 'sweep', 'collect', 'random'] as const;
const LEGACY_EFFECTS = ['outward'] as const;
export type TransitionEffect = typeof EFFECTS[number] | typeof LEGACY_EFFECTS[number];
export const EFFECT_LABELS: Record<TransitionEffect, string> = { morph: 'Linienfluss', scatter: 'Verstreut', vortex: 'Wirbel', wave: 'Welle', rain: 'Regen', implode: 'Zusammenziehen', fade: 'Sanft einblenden', rise: 'Aufsteigen', bloom: 'Aufblühen', typewriter: 'Schreibmaschine', random: 'Zufall', explosion: 'Explosion', spiral: 'Spirale', magnet: 'Magnet', zoom: 'Zoom von außen', sweep: 'Von links nach rechts', collect: 'Punkte einsammeln', outward: 'Verstreut' };
export const EFFECT_DESCRIPTIONS: Record<TransitionEffect, string> = {
  morph: 'Deine Worte entstehen ruhig, Strich für Strich.', scatter: 'Die Buchstaben finden aus verschiedenen Richtungen zusammen.',
  vortex: 'Ein kleiner Schwung dreht jeden Buchstaben an seinen Platz.', wave: 'Eine sanfte Welle trägt deine Worte in die Zeile.',
  rain: 'Die Buchstaben fallen behutsam von oben ein.', implode: 'Weite Formen ziehen sich zu deinen Worten zusammen.',
  fade: 'Die Buchstaben erscheinen weich aus der Dunkelheit.', rise: 'Deine Worte schweben sanft nach oben.',
  bloom: 'Jeder Buchstabe wächst auf und kommt zur Ruhe.', typewriter: 'Ein Zeichen nach dem anderen – wie auf einer Schreibmaschine.',
  random: 'Bei jedem Abspielen überrascht eine andere Animation.', explosion: 'Ein Funkenstoß fliegt auseinander und findet als Text zusammen.', spiral: 'Punkte kreisen spiralförmig in deine Worte.', magnet: 'Deine Worte ziehen die Punkte wie ein Magnet an.', zoom: 'Punkte kommen von weit außen und rasten sanft ein.', sweep: 'Ein Lichtband baut deine Worte von links nach rechts auf.', collect: 'Verstreute Punkte sammeln sich nach und nach zu deiner Nachricht.', outward: 'Die Buchstaben finden aus verschiedenen Richtungen zusammen.',
};
export const FONTS = ['handwriting', 'classic', 'editorial', 'mono'] as const;
export type MessageFont = typeof FONTS[number];
export const DEFAULT_FONT: MessageFont = 'handwriting';
export const FONT_LABELS: Record<MessageFont, string> = { handwriting: 'Handschrift', classic: 'Klar', editorial: 'Editorial', mono: 'Mono' };
export interface WritingSettings {
  enabled: boolean; speed: number; punctuationPause: number; paragraphPause: number;
  commaPause?: number; periodPause?: number; questionPause?: number; exclamationPause?: number;
}
export interface MessageSettings { effect: TransitionEffect; finale: boolean; writing: WritingSettings; font?: MessageFont; tilt?: boolean; finaleConfig?: Finale }
export interface Slide { text: string; duration: number; effect?: TransitionEffect; writing?: WritingSettings; font?: MessageFont; features?: SceneFeatures }
export interface MessageContent { version: 1; slides: Slide[]; settings?: MessageSettings }
export const WRITING_PRESETS = {
  Schnell: { speed: 35, punctuationPause: 180, paragraphPause: 350, commaPause: 80, periodPause: 180, questionPause: 250, exclamationPause: 180 },
  Normal: { speed: 75, punctuationPause: 420, paragraphPause: 800, commaPause: 190, periodPause: 420, questionPause: 580, exclamationPause: 420 },
  Ruhig: { speed: 115, punctuationPause: 650, paragraphPause: 1200, commaPause: 300, periodPause: 650, questionPause: 850, exclamationPause: 650 },
  Dramatisch: { speed: 170, punctuationPause: 1100, paragraphPause: 1800, commaPause: 500, periodPause: 1100, questionPause: 1500, exclamationPause: 1100 },
};
export const DEFAULT_SETTINGS: MessageSettings = { effect: 'morph', finale: false, writing: { enabled: false, ...WRITING_PRESETS.Normal } };
export function slideSettings(slide: Slide, settings: MessageSettings = DEFAULT_SETTINGS) {
  return { effect: slide.effect ?? settings.effect, writing: slide.writing ?? settings.writing, font: slide.font ?? settings.font ?? DEFAULT_FONT };
}
export const MAX_SLIDES = 15;
export const MAX_TEXT_LENGTH = 150;
export const MIN_DURATION = 1000;
export const MAX_DURATION = 10000;
function record(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
function numberIn(value: unknown, min: number, max: number): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max; }
export function isEffect(value: unknown): value is TransitionEffect { return [...EFFECTS, ...LEGACY_EFFECTS].includes(value as TransitionEffect); }
export function isFont(value: unknown): value is MessageFont { return FONTS.includes(value as MessageFont); }
function validateWriting(value: unknown): WritingSettings {
  if (!record(value) || typeof value.enabled !== 'boolean' || !numberIn(value.speed, 20, 250) || !numberIn(value.punctuationPause, 0, 2500) || !numberIn(value.paragraphPause, 0, 4000)) throw new Error('Die Schreibgeschwindigkeit oder Pausen sind ungültig.');
  const result: WritingSettings = { enabled: value.enabled, speed: Math.round(value.speed), punctuationPause: Math.round(value.punctuationPause), paragraphPause: Math.round(value.paragraphPause) };
  for (const key of ['commaPause', 'periodPause', 'questionPause', 'exclamationPause'] as const) {
    if (value[key] === undefined) continue;
    if (!numberIn(value[key], 0, 2500)) throw new Error('Die Satzzeichenpause ist ungültig.');
    result[key] = Math.round(value[key]);
  }
  return result;
}
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
    if (slide.font !== undefined && !isFont(slide.font)) throw new Error('Diese Schriftart ist ungültig.');
    const leading = slide.text.length - slide.text.trimStart().length;
    const features = slide.features === undefined ? undefined : validateFeatures(slide.features, slide.text);
    if (features?.secrets) features.secrets = features.secrets.map(secret => ({ ...secret, start: secret.start - leading, end: secret.end - leading }));
    if (features) validateFeatures(features, text);
    return { text, ...(features ? { features } : {}), duration: Math.round(slide.duration), ...(slide.effect !== undefined ? { effect: slide.effect } : {}), ...(slide.font !== undefined ? { font: slide.font } : {}), ...(slide.writing !== undefined ? { writing: validateWriting(slide.writing) } : {}) };
  });
  if (value.settings === undefined) return { version: 1, slides };
  const s = value.settings;
  if (!record(s) || !isEffect(s.effect) || typeof s.finale !== 'boolean') throw new Error('Die Animationseinstellungen sind ungültig.');
  if (s.font !== undefined && !isFont(s.font)) throw new Error('Diese Schriftart ist ungültig.');
  if (s.tilt !== undefined && typeof s.tilt !== 'boolean') throw new Error('Die Neigungseinstellung ist ungültig.');
  return { version: 1, slides, settings: { effect: s.effect, finale: s.finale, ...(s.tilt !== undefined ? { tilt: s.tilt } : {}), ...(s.finale && s.finaleConfig !== undefined ? { finaleConfig: validateFinale(s.finaleConfig) } : {}), writing: validateWriting(s.writing), ...(s.font !== undefined ? { font: s.font } : {}) } };
}
