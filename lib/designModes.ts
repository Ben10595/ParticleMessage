export const DESIGN_MODES = ['particle', 'core', 'liquid', 'console', 'minimal'] as const;
export type DesignMode = typeof DESIGN_MODES[number];

export const DESIGN_MODE_DETAILS: Record<DesignMode, { label: string; shortLabel: string; symbol: string; description: string }> = {
  particle: { label: 'Particle Mode', shortLabel: 'Particle', symbol: '⠿', description: 'Lebendige Glyphen und feine Lichtpunkte.' },
  core: { label: 'Message Core', shortLabel: 'Core', symbol: '◉', description: 'Ein ruhiger, intelligenter Lichtkern.' },
  liquid: { label: 'Liquid Flow', shortLabel: 'Liquid', symbol: '≋', description: 'Organische Formen und fließende Übergänge.' },
  console: { label: 'Console Flow', shortLabel: 'Console', symbol: '⌘', description: 'Präzise Linien und technische Signale.' },
  minimal: { label: 'Minimal Focus', shortLabel: 'Minimal', symbol: '·', description: 'Reduzierte Flächen und klare Typografie.' },
};

export interface DesignProfile {
  intensity: number;
  glow: number;
  speed: number;
}

export interface DesignPreferences {
  favorite: DesignMode;
  defaultMode: DesignMode;
  automatic: boolean;
  backgroundEffects: boolean;
  particles: boolean;
  reducedMotion: boolean;
  focusMode: boolean;
  profiles: Record<DesignMode, DesignProfile>;
}

export const DEFAULT_DESIGN_PREFERENCES: DesignPreferences = {
  favorite: 'core',
  defaultMode: 'core',
  automatic: false,
  backgroundEffects: true,
  particles: true,
  reducedMotion: false,
  focusMode: false,
  profiles: {
    particle: { intensity: 72, glow: 48, speed: 94 },
    core: { intensity: 66, glow: 55, speed: 96 },
    liquid: { intensity: 62, glow: 42, speed: 110 },
    console: { intensity: 52, glow: 32, speed: 88 },
    minimal: { intensity: 24, glow: 18, speed: 78 },
  },
};

function isDesignMode(value: unknown): value is DesignMode {
  return typeof value === 'string' && DESIGN_MODES.includes(value as DesignMode);
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
}

/** Normalize locally persisted settings so stale or edited values cannot break the UI. */
export function normalizeDesignPreferences(value: unknown): DesignPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_DESIGN_PREFERENCES;
  const source = value as Partial<DesignPreferences>;
  const rawProfiles = source.profiles && typeof source.profiles === 'object' ? source.profiles : {};
  const profiles = Object.fromEntries(DESIGN_MODES.map(mode => {
    const candidate = (rawProfiles as Partial<Record<DesignMode, Partial<DesignProfile>>>)[mode] ?? {};
    const defaults = DEFAULT_DESIGN_PREFERENCES.profiles[mode];
    return [mode, {
      intensity: boundedNumber(candidate.intensity, defaults.intensity, 0, 100),
      glow: boundedNumber(candidate.glow, defaults.glow, 0, 100),
      speed: boundedNumber(candidate.speed, defaults.speed, 50, 150),
    }];
  })) as Record<DesignMode, DesignProfile>;

  return {
    favorite: isDesignMode(source.favorite) ? source.favorite : DEFAULT_DESIGN_PREFERENCES.favorite,
    defaultMode: isDesignMode(source.defaultMode) ? source.defaultMode : DEFAULT_DESIGN_PREFERENCES.defaultMode,
    automatic: source.automatic === true,
    backgroundEffects: source.backgroundEffects !== false,
    particles: source.particles !== false,
    reducedMotion: source.reducedMotion === true,
    focusMode: source.focusMode === true,
    profiles,
  };
}

export function nextDesignMode(mode: DesignMode): DesignMode {
  const index = DESIGN_MODES.indexOf(mode);
  return DESIGN_MODES[(index + 1) % DESIGN_MODES.length];
}
