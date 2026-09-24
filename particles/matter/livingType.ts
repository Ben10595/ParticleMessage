import { DEFAULT_LIVING_TYPE_PARAMS, LIVING_TYPE_ENGINES, resolveLivingTypeParams, type LivingTypeEngine, type LivingTypeParams } from '../../types/message';

export type LivingTransition = 'none' | 'line' | 'contour' | 'dissolve';
export const LIVING_TRANSITION_MS = 360;

export const LIVING_ENGINES: readonly LivingTypeEngine[] = LIVING_TYPE_ENGINES;

export const DEFAULT_LIVING_PARAMS = DEFAULT_LIVING_TYPE_PARAMS;

/** Safe renderer values, including when an old stored message has no engine parameters. */
export function resolveLivingParams(input?: Partial<LivingTypeParams>, engine: LivingTypeEngine = 'line'): LivingTypeParams {
  return resolveLivingTypeParams(engine, input);
}

export interface LivingTextEnergy {
  graphemes: number;
  short: boolean;
  scale: number;
  calm: number;
  emoji: 'heart' | 'sparkle' | 'laugh' | null;
}

/** Content changes the scale and pace without changing the saved message. */
export function textEnergy(text: string): LivingTextEnergy {
  const graphemes = Array.from(new Intl.Segmenter('de', { granularity: 'grapheme' }).segment(text.trim())).length;
  const short = graphemes <= 12 && !text.includes('\n');
  const emoji = /[❤️♥💙💜]/u.test(text) ? 'heart'
    : /[✨⭐🌟]/u.test(text) ? 'sparkle'
      : /[😂🤣😄]/u.test(text) ? 'laugh' : null;
  return {
    graphemes,
    short,
    scale: short ? 1.12 : graphemes > 60 ? .86 : 1,
    calm: Math.min(1, Math.max(0, (graphemes - 24) / 90)),
    emoji,
  };
}

/** Entrance duration. Add LIVING_TRANSITION_MS for an animated section change. */
export function livingDuration(text: string, engine: LivingTypeEngine = 'particle', input?: Partial<LivingTypeParams>): number {
  const params = resolveLivingParams(input, engine);
  const energy = textEnergy(text);
  const complexity = Math.min(850, Math.max(0, energy.graphemes - 12) * 13);
  const base = engine === 'line' ? 2560 + complexity
    : engine === 'draw' ? 2450 + complexity
      : engine === 'thread' || engine === 'liquid' ? 2350 + complexity * .6
        : engine === 'echo' || engine === 'void' ? 2050 + complexity * .35
          : 2200 + complexity * .45;
  const morph = engine === 'line' ? 520 / params.morphSpeed : 0;
  return Math.round((base + morph) / params.speed);
}

export function easeInOut(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function easeOut(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - x, 3);
}

export function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}
