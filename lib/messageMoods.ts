import { DEFAULT_PARTICLE_STYLE, WRITING_PRESETS, type MessageSettings, type Slide, type TransitionEffect, type MessageFont, type MessageMood } from '@/types/message';

export const MOOD_DETAILS: Record<MessageMood, { label: string; description: string; effect: TransitionEffect; font: MessageFont; density: 'light' | 'balanced' | 'rich'; speed: number; preset: 'spring' | 'soft' | 'magnetic' | 'explosive' }> = {
  calm: { label: 'Calm', description: 'Leise. Langsam. Klar.', effect: 'fade', font: 'classic', density: 'light', speed: .7, preset: 'soft' },
  energy: { label: 'Energy', description: 'Ein Moment mit Puls.', effect: 'shockwave', font: 'editorial', density: 'rich', speed: 1.5, preset: 'explosive' },
  dream: { label: 'Dream', description: 'Worte in Schwebe.', effect: 'bloom', font: 'handwriting', density: 'balanced', speed: .8, preset: 'soft' },
  digital: { label: 'Digital', description: 'Ein Signal wird sichtbar.', effect: 'pixel', font: 'mono', density: 'balanced', speed: 1.2, preset: 'magnetic' },
  chaos: { label: 'Chaos', description: 'Unordnung wird Bedeutung.', effect: 'chaos', font: 'editorial', density: 'rich', speed: 1.7, preset: 'explosive' },
  minimal: { label: 'Minimal', description: 'Nur das Wesentliche.', effect: 'rise', font: 'classic', density: 'light', speed: .7, preset: 'soft' },
  memory: { label: 'Memory', description: 'Ein Gedanke bleibt.', effect: 'dust', font: 'handwriting', density: 'balanced', speed: .9, preset: 'spring' },
};

export function suggestMood(text: string): MessageMood {
  if (/[!🔥⚡]/u.test(text)) return 'energy';
  if (/[❤️♥🤍🫶]|lieb|vermiss|dank|erinner/iu.test(text)) return 'memory';
  if (/[?]/u.test(text)) return 'digital';
  return text.length > 100 ? 'dream' : 'calm';
}

export function applyMood(mood: MessageMood, settings: MessageSettings, slides: Slide[]): { settings: MessageSettings; slides: Slide[] } {
  const detail = MOOD_DETAILS[mood];
  const particles = { ...DEFAULT_PARTICLE_STYLE, ...settings.particles, density: detail.density, speed: detail.speed, preset: detail.preset };
  const writingPreset = mood === 'energy' || mood === 'chaos' ? WRITING_PRESETS.Schnell : mood === 'calm' || mood === 'memory' ? WRITING_PRESETS.Ruhig : WRITING_PRESETS.Normal;
  return {
    settings: { ...settings, mood, background: mood === 'dream' || mood === 'memory' ? 'aurora' : mood === 'minimal' ? 'void' : 'night', effect: detail.effect, font: detail.font, particles, writing: { ...settings.writing, ...writingPreset } },
    slides: slides.map(slide => ({ ...slide, effect: detail.effect, font: detail.font })),
  };
}
