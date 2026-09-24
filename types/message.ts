import { validateFeatures, validateFinale, type SceneFeatures, type Finale } from './experience';
export const MOODS = ['calm', 'energy', 'dream', 'digital', 'chaos', 'minimal', 'memory'] as const;
export type MessageMood = typeof MOODS[number];
export const TEXT_SIZES = ['small', 'medium', 'large'] as const;
export type TextSize = typeof TEXT_SIZES[number];
export const TEXT_ALIGNS = ['left', 'center', 'right'] as const;
export type TextAlign = typeof TEXT_ALIGNS[number];
export const MESSAGE_BACKGROUNDS = ['night', 'aurora', 'void'] as const;
export type MessageBackground = typeof MESSAGE_BACKGROUNDS[number];
export const LIVING_TYPE_ENGINES = ['line', 'particle', 'liquid', 'thread', 'signal', 'orbit', 'shatter', 'echo', 'draw', 'void'] as const;
export type LivingTypeEngine = typeof LIVING_TYPE_ENGINES[number];
export const LIVING_TYPE_LABELS: Record<LivingTypeEngine, string> = {
  line: 'Line Morph', particle: 'Particle', liquid: 'Liquid', thread: 'Thread', signal: 'Signal',
  orbit: 'Orbit', shatter: 'Shatter', echo: 'Echo', draw: 'Draw', void: 'Void',
};
/** Numeric controls shared by the editor, renderer and persisted message JSON. */
export interface LivingTypeParams {
  speed: number;
  intensity: number;
  lineWidth: number;
  glow: number;
  curvature: number;
  spring: number;
  morphSpeed: number;
  trail: number;
  amount: number;
  size: number;
  magnetism: number;
  scatter: number;
  count: number;
  distance: number;
  delay: number;
  blur: number;
}
export type LivingTypeParamKey = keyof LivingTypeParams;
export const LIVING_TYPE_PARAM_META: Record<LivingTypeParamKey, { label: string; min: number; max: number; step: number; unit?: string }> = {
  speed: { label: 'Geschwindigkeit', min: .5, max: 2, step: .1 },
  intensity: { label: 'Intensität', min: 0, max: 1, step: .05 },
  lineWidth: { label: 'Linienstärke', min: 1, max: 5, step: .1, unit: 'px' },
  glow: { label: 'Glow', min: 0, max: 1, step: .05 },
  curvature: { label: 'Kurvenstärke', min: 0, max: 1, step: .05 },
  spring: { label: 'Nachschwingen', min: 0, max: 1, step: .05 },
  morphSpeed: { label: 'Morph-Geschwindigkeit', min: .5, max: 2, step: .1 },
  trail: { label: 'Trail-Länge', min: 0, max: 1, step: .05 },
  amount: { label: 'Partikelmenge', min: .5, max: 1.5, step: .1 },
  size: { label: 'Partikelgröße', min: .5, max: 1.8, step: .1 },
  magnetism: { label: 'Magnetische Stärke', min: 0, max: 1, step: .05 },
  scatter: { label: 'Streuung', min: 0, max: 1, step: .05 },
  count: { label: 'Echo-Anzahl', min: 2, max: 6, step: 1 },
  distance: { label: 'Echo-Abstand', min: 4, max: 32, step: 1, unit: 'px' },
  delay: { label: 'Echo-Verzögerung', min: 40, max: 250, step: 10, unit: 'ms' },
  blur: { label: 'Echo-Unschärfe', min: 0, max: 8, step: .5, unit: 'px' },
};
export const LIVING_TYPE_CONTROLS: Record<LivingTypeEngine, readonly LivingTypeParamKey[]> = {
  line: ['speed', 'lineWidth', 'glow', 'curvature', 'spring', 'morphSpeed', 'trail'],
  particle: ['speed', 'amount', 'size', 'magnetism', 'scatter'],
  liquid: ['speed', 'intensity'], thread: ['speed', 'intensity'], signal: ['speed', 'intensity'],
  orbit: ['speed', 'intensity'], shatter: ['speed', 'intensity'],
  echo: ['speed', 'count', 'distance', 'delay', 'blur'],
  draw: ['speed', 'intensity'], void: ['speed', 'intensity'],
};
const BASE_LIVING_TYPE_PARAMS: LivingTypeParams = {
  speed: 1, intensity: .55, lineWidth: 2.2, glow: .45, curvature: .55, spring: .4,
  morphSpeed: 1, trail: .5, amount: 1, size: 1, magnetism: .55, scatter: .45,
  count: 4, distance: 16, delay: 100, blur: 2,
};
export const DEFAULT_LIVING_TYPE_PARAMS: Record<LivingTypeEngine, LivingTypeParams> = {
  line: { ...BASE_LIVING_TYPE_PARAMS },
  particle: { ...BASE_LIVING_TYPE_PARAMS },
  liquid: { ...BASE_LIVING_TYPE_PARAMS, intensity: .7 },
  thread: { ...BASE_LIVING_TYPE_PARAMS, intensity: .6 },
  signal: { ...BASE_LIVING_TYPE_PARAMS, intensity: .55 },
  orbit: { ...BASE_LIVING_TYPE_PARAMS, intensity: .65 },
  shatter: { ...BASE_LIVING_TYPE_PARAMS, intensity: .55 },
  echo: { ...BASE_LIVING_TYPE_PARAMS },
  draw: { ...BASE_LIVING_TYPE_PARAMS, intensity: .45 },
  void: { ...BASE_LIVING_TYPE_PARAMS, intensity: .6 },
};
export const DEFAULT_LIVING_TYPE_ENGINE: LivingTypeEngine = 'line';
export const LEGACY_LIVING_TYPE_ENGINE: LivingTypeEngine = 'particle';
export function resolveLivingTypeParams(engine: LivingTypeEngine, params: Partial<LivingTypeParams> = {}): LivingTypeParams {
  return { ...DEFAULT_LIVING_TYPE_PARAMS[engine], ...params };
}
export function isLivingTypeEngine(value: unknown): value is LivingTypeEngine {
  return LIVING_TYPE_ENGINES.includes(value as LivingTypeEngine);
}
function validateLivingTypeParams(engine: LivingTypeEngine, value: unknown): Partial<LivingTypeParams> {
  if (!record(value)) throw new Error('Die Einstellungen der Animation Engine sind ungültig.');
  const allowed = new Set<string>(LIVING_TYPE_CONTROLS[engine]);
  const result: Partial<LivingTypeParams> = {};
  for (const [key, setting] of Object.entries(value)) {
    if (!allowed.has(key)) throw new Error('Dieser Regler passt nicht zur gewählten Animation Engine.');
    const meta = LIVING_TYPE_PARAM_META[key as LivingTypeParamKey];
    if (!numberIn(setting, meta.min, meta.max) || (key === 'count' && !Number.isInteger(setting))) {
      throw new Error(`Der Wert für ${meta.label} ist ungültig.`);
    }
    Object.assign(result, { [key]: setting });
  }
  return result;
}
// Version 1 remains readable: new per-slide settings are optional.
export const EFFECTS = ['morph', 'scatter', 'vortex', 'wave', 'rain', 'implode', 'fade', 'rise', 'bloom', 'typewriter', 'explosion', 'spiral', 'magnet', 'zoom', 'sweep', 'collect', 'portal', 'gravity', 'shockwave', 'dust', 'orbit', 'chaos', 'pixel', 'wordByWord', 'floatingWords', 'random'] as const;
const LEGACY_EFFECTS = ['outward'] as const;
export type TransitionEffect = typeof EFFECTS[number] | typeof LEGACY_EFFECTS[number];
export const EFFECT_LABELS: Record<TransitionEffect, string> = { morph: 'Formwechsel', scatter: 'Verstreut', vortex: 'Wirbel', wave: 'Welle', rain: 'Regen', implode: 'Zusammenziehen', fade: 'Sanft einblenden', rise: 'Aufsteigen', bloom: 'Aufblühen', typewriter: 'Schreibmaschine', random: 'Zufall', explosion: 'Explosion', spiral: 'Spirale', magnet: 'Magnet', zoom: 'Zoom von außen', sweep: 'Von links nach rechts', collect: 'Punkte einsammeln', portal: 'Portal', gravity: 'Gravity Drop', shockwave: 'Shockwave', dust: 'Dust Assemble', orbit: 'Orbit Assemble', chaos: 'Random Chaos', pixel: 'Pixel Sweep', wordByWord: 'Word by Word', floatingWords: 'Floating Words', outward: 'Verstreut' };
export const EFFECT_DESCRIPTIONS: Record<TransitionEffect, string> = {
  morph: 'Dieselben Punkte wandern weich von einer Form in die nächste.', scatter: 'Die Buchstaben finden aus verschiedenen Richtungen zusammen.',
  vortex: 'Ein kleiner Schwung dreht jeden Buchstaben an seinen Platz.', wave: 'Eine sanfte Welle trägt deine Worte in die Zeile.',
  rain: 'Die Buchstaben fallen behutsam von oben ein.', implode: 'Weite Formen ziehen sich zu deinen Worten zusammen.',
  fade: 'Die Buchstaben erscheinen weich aus der Dunkelheit.', rise: 'Deine Worte schweben sanft nach oben.',
  bloom: 'Jeder Buchstabe wächst auf und kommt zur Ruhe.', typewriter: 'Ein Zeichen nach dem anderen – wie auf einer Schreibmaschine.',
  random: 'Bei jedem Abspielen überrascht eine andere Animation.', explosion: 'Ein Funkenstoß fliegt auseinander und findet als Text zusammen.', spiral: 'Punkte kreisen spiralförmig in deine Worte.', magnet: 'Deine Worte ziehen die Punkte wie ein Magnet an.', zoom: 'Punkte kommen von weit außen und rasten sanft ein.', sweep: 'Ein Lichtband baut deine Worte von links nach rechts auf.', collect: 'Verstreute Punkte sammeln sich nach und nach zu deiner Nachricht.', portal: 'Ein leuchtender Strudel sammelt die Punkte im Zentrum.', gravity: 'Punkte fallen nach unten und federn in ihre Buchstaben zurück.', shockwave: 'Eine Druckwelle läuft durch die entstehende Nachricht.', dust: 'Feiner Sternenstaub verdichtet sich zu deinen Worten.', orbit: 'Punkte umkreisen ihre neue Form, bevor sie zur Ruhe kommen.', chaos: 'Lebendige, unregelmäßige Bahnen finden zu klarem Text.', pixel: 'Ein Raster baut deine Worte von links nach rechts auf.', wordByWord: 'Jedes Wort erscheint als eigener Impuls.', floatingWords: 'Worte steigen nacheinander sanft auf.', outward: 'Die Buchstaben finden aus verschiedenen Richtungen zusammen.',
};
export const FONTS = ['handwriting', 'classic', 'editorial', 'mono'] as const;
export type MessageFont = typeof FONTS[number];
export const DEFAULT_FONT: MessageFont = 'classic';
export const FONT_LABELS: Record<MessageFont, string> = { handwriting: 'Handschrift', classic: 'Klar', editorial: 'Editorial', mono: 'Mono' };
export interface WritingSettings {
  enabled: boolean; speed: number; punctuationPause: number; paragraphPause: number;
  commaPause?: number; periodPause?: number; questionPause?: number; exclamationPause?: number;
}
export interface ParticleStyle { density: 'light' | 'balanced' | 'rich'; speed: number; preset: 'spring' | 'soft' | 'magnetic' | 'explosive'; interaction: 'repel' | 'attract' | 'none'; trails: boolean; ripples: boolean; wind: boolean; gravity: boolean }
export const DEFAULT_PARTICLE_STYLE: ParticleStyle = { density: 'balanced', speed: 1, preset: 'spring', interaction: 'repel', trails: true, ripples: true, wind: false, gravity: false };
function validateParticleStyle(value: unknown): ParticleStyle {
  if (!record(value) || !['light','balanced','rich'].includes(String(value.density)) || !['spring','soft','magnetic','explosive'].includes(String(value.preset)) || !['repel','attract','none'].includes(String(value.interaction)) || !numberIn(value.speed,.5,2)) throw new Error('Die Partikeleinstellungen sind ungültig.');
  for (const key of ['trails','ripples','wind','gravity']) if (typeof value[key] !== 'boolean') throw new Error('Die Partikeleffekte sind ungültig.');
  return { density: value.density as ParticleStyle['density'], speed: value.speed as number, preset: value.preset as ParticleStyle['preset'], interaction: value.interaction as ParticleStyle['interaction'], trails: value.trails as boolean, ripples: value.ripples as boolean, wind: value.wind as boolean, gravity: value.gravity as boolean };
}
export interface MessageSettings { particles?: ParticleStyle; effect: TransitionEffect; finale: boolean; writing: WritingSettings; font?: MessageFont; tilt?: boolean; finaleConfig?: Finale; mood?: MessageMood; background?: MessageBackground; sound?: boolean }
export interface Slide { text: string; duration: number; effect?: TransitionEffect; writing?: WritingSettings; font?: MessageFont; size?: TextSize; align?: TextAlign; features?: SceneFeatures; engine?: LivingTypeEngine; engineParams?: Partial<LivingTypeParams> }
export interface MessageContent { version: 1; slides: Slide[]; settings?: MessageSettings }
export const WRITING_PRESETS = {
  Schnell: { speed: 35, punctuationPause: 180, paragraphPause: 350, commaPause: 80, periodPause: 180, questionPause: 250, exclamationPause: 180 },
  Normal: { speed: 75, punctuationPause: 420, paragraphPause: 800, commaPause: 190, periodPause: 420, questionPause: 580, exclamationPause: 420 },
  Ruhig: { speed: 115, punctuationPause: 650, paragraphPause: 1200, commaPause: 300, periodPause: 650, questionPause: 850, exclamationPause: 650 },
  Dramatisch: { speed: 170, punctuationPause: 1100, paragraphPause: 1800, commaPause: 500, periodPause: 1100, questionPause: 1500, exclamationPause: 1100 },
};
export const DEFAULT_SETTINGS: MessageSettings = { effect: 'morph', finale: false, writing: { enabled: false, ...WRITING_PRESETS.Normal } };
export function slideSettings(slide: Slide, settings: MessageSettings = DEFAULT_SETTINGS) {
  const engine = slide.engine ?? LEGACY_LIVING_TYPE_ENGINE;
  return { effect: slide.effect ?? settings.effect, writing: slide.writing ?? settings.writing, font: slide.font ?? settings.font ?? DEFAULT_FONT, size: slide.size ?? 'medium', align: slide.align ?? 'center', engine, engineParams: resolveLivingTypeParams(engine, slide.engineParams) };
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
    if (slide.engine !== undefined && !isLivingTypeEngine(slide.engine)) throw new Error('Diese Animation Engine ist ungültig.');
    if (slide.engineParams !== undefined && slide.engine === undefined) throw new Error('Wähle zuerst eine Animation Engine.');
    if (slide.font !== undefined && !isFont(slide.font)) throw new Error('Diese Schriftart ist ungültig.');
    if (slide.size !== undefined && !TEXT_SIZES.includes(slide.size as TextSize)) throw new Error('Diese Schriftgröße ist ungültig.');
    if (slide.align !== undefined && !TEXT_ALIGNS.includes(slide.align as TextAlign)) throw new Error('Diese Textausrichtung ist ungültig.');
    const leading = slide.text.length - slide.text.trimStart().length;
    const features = slide.features === undefined ? undefined : validateFeatures(slide.features, slide.text);
    if (features?.secrets) features.secrets = features.secrets.map(secret => ({ ...secret, start: secret.start - leading, end: secret.end - leading }));
    if (features) validateFeatures(features, text);
    return { text, ...(features ? { features } : {}), duration: Math.round(slide.duration), ...(slide.effect !== undefined ? { effect: slide.effect } : {}), ...(slide.font !== undefined ? { font: slide.font } : {}), ...(slide.size !== undefined ? { size: slide.size as TextSize } : {}), ...(slide.align !== undefined ? { align: slide.align as TextAlign } : {}), ...(slide.writing !== undefined ? { writing: validateWriting(slide.writing) } : {}), ...(slide.engine !== undefined ? { engine: slide.engine as LivingTypeEngine } : {}), ...(slide.engineParams !== undefined ? { engineParams: validateLivingTypeParams(slide.engine as LivingTypeEngine, slide.engineParams) } : {}) };
  });
  if (value.settings === undefined) return { version: 1, slides };
  const s = value.settings;
  if (!record(s) || !isEffect(s.effect) || typeof s.finale !== 'boolean') throw new Error('Die Animationseinstellungen sind ungültig.');
  if (s.font !== undefined && !isFont(s.font)) throw new Error('Diese Schriftart ist ungültig.');
  if (s.tilt !== undefined && typeof s.tilt !== 'boolean') throw new Error('Die Neigungseinstellung ist ungültig.');
  if (s.mood !== undefined && !MOODS.includes(s.mood as MessageMood)) throw new Error('Die Stimmung ist ungültig.');
  if (s.background !== undefined && !MESSAGE_BACKGROUNDS.includes(s.background as MessageBackground)) throw new Error('Der Hintergrund ist ungültig.');
  if (s.sound !== undefined && typeof s.sound !== 'boolean') throw new Error('Die Toneinstellung ist ungültig.');
  return { version: 1, slides, settings: { ...(s.particles !== undefined ? { particles: validateParticleStyle(s.particles) } : {}), effect: s.effect, finale: s.finale, ...(s.tilt !== undefined ? { tilt: s.tilt } : {}), ...(s.mood !== undefined ? { mood: s.mood as MessageMood } : {}), ...(s.background !== undefined ? { background: s.background as MessageBackground } : {}), ...(s.sound !== undefined ? { sound: s.sound as boolean } : {}), ...(s.finale && s.finaleConfig !== undefined ? { finaleConfig: validateFinale(s.finaleConfig) } : {}), writing: validateWriting(s.writing), ...(s.font !== undefined ? { font: s.font } : {}) } };
}
