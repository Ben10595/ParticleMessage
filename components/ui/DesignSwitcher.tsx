'use client';

import { useState } from 'react';
import {
  DESIGN_MODES,
  DESIGN_MODE_DETAILS,
  type DesignMode,
  type DesignPreferences,
} from '@/lib/designModes';

interface Props {
  mode: DesignMode;
  preferences: DesignPreferences;
  draftCharacters?: number;
  onModeChange: (mode: DesignMode) => void;
  onPreferencesChange: (preferences: DesignPreferences) => void;
}

export default function DesignSwitcher({ mode, preferences, draftCharacters = 0, onModeChange, onPreferencesChange }: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const profile = preferences.profiles[mode];

  function updateProfile(key: 'intensity' | 'glow' | 'speed', value: number) {
    onPreferencesChange({
      ...preferences,
      profiles: { ...preferences.profiles, [mode]: { ...profile, [key]: value } },
    });
  }

  function updatePreference(key: keyof Omit<DesignPreferences, 'profiles' | 'favorite' | 'defaultMode'>, value: boolean) {
    onPreferencesChange({ ...preferences, [key]: value });
  }

  const resonance = Math.min(100, Math.round(draftCharacters / 4));

  return (
    <section className="design-dock" aria-label="Visuellen Design-Modus wählen">
      <div className="design-dock-main">
        <div className="design-switcher" role="group" aria-label="Design-Modus">
          {DESIGN_MODES.map(item => {
            const detail = DESIGN_MODE_DETAILS[item];
            return (
              <button
                className="design-mode-button"
                data-mode={item}
                type="button"
                key={item}
                aria-pressed={mode === item}
                title={detail.description}
                onClick={() => onModeChange(item)}
              >
                <span className="design-mode-symbol" aria-hidden="true">{detail.symbol}</span>
                <span>{detail.shortLabel}</span>
              </button>
            );
          })}
        </div>
        <div className="design-quick-actions">
          <button
            className={`design-quick-button ${preferences.automatic ? 'is-on' : ''}`}
            type="button"
            aria-pressed={preferences.automatic}
            onClick={() => updatePreference('automatic', !preferences.automatic)}
          ><span aria-hidden="true">↻</span> Auto</button>
          <button
            className={`design-quick-button ${preferences.favorite === mode ? 'is-on' : ''}`}
            type="button"
            aria-label={preferences.favorite === mode ? `${DESIGN_MODE_DETAILS[mode].label} ist dein Favorit` : `${DESIGN_MODE_DETAILS[preferences.favorite].label} als Favorit öffnen`}
            title={preferences.favorite === mode ? 'Aktuellen Modus als Favorit gespeichert' : `Favorit: ${DESIGN_MODE_DETAILS[preferences.favorite].label}`}
            onClick={() => preferences.favorite === mode ? onPreferencesChange({ ...preferences, favorite: mode }) : onModeChange(preferences.favorite)}
          ><span aria-hidden="true">★</span> Favorit</button>
          <button
            className={`design-quick-button design-settings-button ${settingsOpen ? 'is-on' : ''}`}
            type="button"
            aria-expanded={settingsOpen}
            aria-controls="design-settings"
            onClick={() => setSettingsOpen(open => !open)}
          ><span aria-hidden="true">☷</span> Effekte</button>
        </div>
      </div>

      {draftCharacters > 0 && (
        <div className="draft-resonance" aria-label={`Textresonanz: ${draftCharacters} Zeichen` }>
          <span className="resonance-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span className="resonance-label">DRAFT RESONANCE</span>
          <span className="resonance-track" aria-hidden="true"><i style={{ width: `${resonance}%` }} /></span>
          <span className="resonance-count">{draftCharacters} Zeichen</span>
        </div>
      )}

      {settingsOpen && (
        <div className="design-settings" id="design-settings">
          <div className="design-settings-heading">
            <div><span className="design-settings-kicker">MODUS-PROFIL</span><h2>{DESIGN_MODE_DETAILS[mode].label}</h2></div>
            <button type="button" className="design-settings-close" aria-label="Effekteinstellungen schließen" onClick={() => setSettingsOpen(false)}>×</button>
          </div>
          <p className="design-settings-description">Feinabstimmung bleibt für jeden Modus separat gespeichert.</p>
          <label className="design-range"><span><span>Bewegungsintensität</span><output>{profile.intensity}%</output></span><input type="range" min="0" max="100" value={profile.intensity} onChange={event => updateProfile('intensity', Number(event.target.value))} /></label>
          <label className="design-range"><span><span>Glow-Stärke</span><output>{profile.glow}%</output></span><input type="range" min="0" max="100" value={profile.glow} onChange={event => updateProfile('glow', Number(event.target.value))} /></label>
          <label className="design-range"><span><span>Übergangstempo</span><output>{profile.speed}%</output></span><input type="range" min="50" max="150" value={profile.speed} onChange={event => updateProfile('speed', Number(event.target.value))} /></label>
          <label className="design-toggle"><span>Hintergrundeffekte</span><input type="checkbox" checked={preferences.backgroundEffects} onChange={event => updatePreference('backgroundEffects', event.target.checked)} /></label>
          <label className="design-toggle"><span>Partikelvorschau</span><input type="checkbox" checked={preferences.particles} onChange={event => updatePreference('particles', event.target.checked)} /></label>
          <label className="design-toggle"><span>Bewegung reduzieren</span><input type="checkbox" checked={preferences.reducedMotion} onChange={event => updatePreference('reducedMotion', event.target.checked)} /></label>
          <label className="design-toggle"><span>Fokus-Modus</span><input type="checkbox" checked={preferences.focusMode} onChange={event => updatePreference('focusMode', event.target.checked)} /></label>
          <label className="design-default"><span>Startmodus</span><select value={preferences.defaultMode} onChange={event => onPreferencesChange({ ...preferences, defaultMode: event.target.value as DesignMode })}>{DESIGN_MODES.map(item => <option key={item} value={item}>{DESIGN_MODE_DETAILS[item].label}</option>)}</select></label>
          <button className="design-save-favorite" type="button" onClick={() => onPreferencesChange({ ...preferences, favorite: mode })}>★ {preferences.favorite === mode ? 'Favorit gespeichert' : 'Diesen Modus merken'}</button>
        </div>
      )}
    </section>
  );
}
