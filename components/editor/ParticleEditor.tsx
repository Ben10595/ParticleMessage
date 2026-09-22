'use client';
import { useRef, useState } from 'react';
import { MAX_SLIDES, MAX_TEXT_LENGTH, EFFECTS, EFFECT_LABELS, EFFECT_DESCRIPTIONS, FONTS, FONT_LABELS, WRITING_PRESETS, slideSettings, type Slide, type MessageSettings, type TransitionEffect, type WritingSettings, type MessageFont } from '@/types/message';
import type { ParticleEngine } from '@/particles/matter/ParticleEngine';
import SceneFeatureEditor from './SceneFeatureEditor';
import ParticleStyleEditor from './ParticleStyleEditor';
import { remapSecrets } from '@/types/experience';
import LivePreview from './LivePreview';
import ParticleSelect from './ParticleSelect';
import FontSample from '../ui/FontSample';
import { useLinePresence } from '../hooks/useLinePresence';
interface Props { onSettingsChange: (settings: MessageSettings) => void; previewActive: boolean; particlesEnabled: boolean; slides: Slide[]; settings: MessageSettings; engine: ParticleEngine | null; active: number; onSelect: (index: number) => void; onChange: (slides: Slide[]) => void; onActivity: () => void; onPreview: () => void; onSave: () => void; busy: boolean; error: string }
const emojis = ['❤️', '😂', '✨', '👀', '🥳', '🔥', '😊', '😭', '💀', '🤍', '🫶', '🌙'];
const pauses = [
  { key: 'speed', label: 'Pro Zeichen', min: 20, max: 250, step: 5 },
  { key: 'commaPause', label: 'Komma ,', min: 0, max: 2500, step: 50 },
  { key: 'periodPause', label: 'Punkt .', min: 0, max: 2500, step: 50 },
  { key: 'questionPause', label: 'Fragezeichen ?', min: 0, max: 2500, step: 50 },
  { key: 'exclamationPause', label: 'Ausrufezeichen !', min: 0, max: 2500, step: 50 },
  { key: 'paragraphPause', label: 'Zeilenumbruch', min: 0, max: 4000, step: 50 },
] as const;
export default function ParticleEditor({ previewActive, particlesEnabled, slides, settings, engine, active, onSelect, onChange, onActivity, onPreview, onSave, busy, error, onSettingsChange }: Props) {
  const slide = slides[active];
  const { writing, effect, font } = slideSettings(slide, settings);
  const input = useRef<HTMLTextAreaElement>(null);
  const selection = useRef({ start: 0, end: 0 });
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [secretNotice, setSecretNotice] = useState('');
  const emojiPresent = useLinePresence(emojiOpen);
  function update(patch: Partial<Slide>) {
    if (patch.text !== undefined && slide.features?.secrets?.length) {
      const secrets = remapSecrets(slide.text, patch.text, slide.features.secrets);
      patch.features = { ...slide.features, secrets };
      if (secrets.length < slide.features.secrets.length) setSecretNotice('Eine bearbeitete Markierung wurde entfernt. Du kannst sie erneut markieren.');
    }
    onChange(slides.map((item, index) => index === active ? { ...item, ...patch } : item)); }
  function write(patch: Partial<WritingSettings>) { update({ writing: { ...writing, ...patch } }); }
  function move(direction: number) {
    const target = active + direction;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides]; [next[active], next[target]] = [next[target], next[active]];
    onChange(next); onSelect(target);
  }
  function insertEmoji(emoji: string) {
    const { start, end } = selection.current;
    const text = slide.text.slice(0, start) + emoji + slide.text.slice(end);
    if (Array.from(text).length > MAX_TEXT_LENGTH) return;
    update({ text }); setEmojiOpen(false); onActivity();
    engine?.emitTypingFlow(input.current?.getBoundingClientRect(), null);
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(start + emoji.length, start + emoji.length); });
  }
  function markSecret() {
    const { start, end } = selection.current;
    const secrets = slide.features?.secrets ?? [];
    if (start === end || !slide.text.slice(start, end).trim()) { setSecretNotice('Markiere zuerst ein Wort oder einen kurzen Bereich im Text.'); input.current?.focus(); return; }
    if (secrets.length >= 4 || secrets.some(s => start < s.end && end > s.start)) { setSecretNotice('Bitte eine freie Textstelle markieren. Maximal vier Geheimnisse.'); return; }
    update({ features: { ...slide.features, secrets: [...secrets, { start, end, text: '', returnAfter: 5000 }] } });
    setSecretNotice('Markierung angelegt. Trage unter „Geheime Worte“ deine Zusatznachricht ein.');
  }
  const preset = Object.entries(WRITING_PRESETS).find(([, p]) => Object.entries(p).every(([key, value]) => writing[key as keyof WritingSettings] === value))?.[0] ?? 'Eigene Werte';
  return <section className="editor" aria-label="Nachrichteneditor" aria-busy={busy}>
    <div className="editor-heading"><p className="eyebrow"><span className="signal-mark" aria-hidden="true" /> MESSAGE COMPOSER / {String(active + 1).padStart(2, '0')}</p><h1>Deine Worte.<br /><span>In Bewegung.</span></h1><p className="editor-description">Forme deine Nachricht Abschnitt für Abschnitt. Der Core reagiert auf jede Eingabe.</p></div>
    <div className="editor-grid"><div className="editor-panel">
      <div className="section-heading"><span>Nachrichtenfluss</span><span>{slides.length} / {MAX_SLIDES} ABSCHNITTE</span></div>
      <nav className="slide-tabs" aria-label="Abschnitte">
        {slides.map((_, index) => <button data-particle="button" key={index} aria-label={`Abschnitt ${index + 1}`} aria-current={index === active ? 'step' : undefined} onClick={() => { onSelect(index); setEmojiOpen(false); }} disabled={busy}>{String(index + 1).padStart(2, '0')}</button>)}
        <button data-particle="button" data-icon="plus" className="add-slide" aria-label="Abschnitt hinzufügen" disabled={slides.length >= MAX_SLIDES || busy} onClick={() => { onChange([...slides, { text: '', duration: 2500 }]); onSelect(slides.length); }}>+</button>
      </nav>
      <div className="field-meta"><label htmlFor="message-text">ABSCHNITT {String(active + 1).padStart(2, '0')}</label><span>{Array.from(slide.text).length} / {MAX_TEXT_LENGTH}</span></div>
      <div className="text-field"><textarea ref={input} onSelect={event => { selection.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }; }} onBlur={event => { selection.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }; }} onKeyDown={event => { if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Enter') engine?.emitTypingFlow(input.current?.getBoundingClientRect(), null); }} id="message-text" value={slide.text} placeholder="Schreib, was bleiben soll …" disabled={busy} onChange={event => { update({ text: Array.from(event.target.value).slice(0, MAX_TEXT_LENGTH).join('') }); engine?.emitTypingFlow(input.current?.getBoundingClientRect(), null); onActivity(); }} /></div>
      <div className="text-toolbar"><div className="emoji-control"><button data-particle="button" aria-expanded={emojiOpen} aria-controls="emoji-picker" onClick={() => setEmojiOpen(!emojiOpen)} disabled={busy}>☺ Emoji</button>{emojiPresent && <div aria-hidden={!emojiOpen || undefined} inert={!emojiOpen} data-particle="frame" className={`emoji-picker ${!emojiOpen ? 'is-closing' : ''}`} id="emoji-picker" aria-label="Emoji auswählen" onKeyDown={event => { if (event.key === 'Escape') { setEmojiOpen(false); input.current?.focus(); } }}>{emojis.map(emoji => <button key={emoji} aria-label={`${emoji} einfügen`} onMouseDown={event => event.preventDefault()} onClick={() => insertEmoji(emoji)}>{emoji}</button>)}</div>}</div>
      <div className="slide-actions"><button data-particle="button" data-icon="left" aria-label="Abschnitt nach vorne" disabled={active === 0 || busy} onClick={() => move(-1)}>←</button><button data-particle="button" data-icon="arrow" aria-label="Abschnitt nach hinten" disabled={active === slides.length - 1 || busy} onClick={() => move(1)}>→</button><button data-particle="button" data-icon="close" aria-label="Abschnitt löschen" disabled={slides.length === 1 || busy} onClick={() => { onChange(slides.filter((_, index) => index !== active)); onSelect(Math.max(0, active - 1)); }}>×</button></div></div>
      <button data-particle="button" className="mark-secret" disabled={busy} onMouseDown={event => event.preventDefault()} onClick={markSecret}>Auswahl geheim ◌</button>
      {secretNotice && <p className="setting-note" role="status">{secretNotice}</p>}
      <div className="particle-divider" />
      <div className="settings-group">
        <div className="control-row"><span data-particle="text">Schriftart</span><ParticleSelect label="Schriftart dieses Abschnitts" value={font} disabled={busy} onChange={value => update({ font: value as MessageFont })} options={FONTS.map(value => ({ value, label: FONT_LABELS[value], preview: <FontSample font={value} /> }))} /></div>
        <div className="control-row"><span data-particle="text">Animation</span><ParticleSelect label="Animation dieses Abschnitts" value={effect} disabled={busy} onChange={value => update({ effect: value as TransitionEffect })} options={EFFECTS.map(value => ({ value, label: EFFECT_LABELS[value] }))} /></div>
        <p className="effect-description">{EFFECT_DESCRIPTIONS[effect]}</p>
        <div className="control-row"><span data-particle="text">Fertigen Text halten</span><ParticleSelect label="Dauer des fertigen Textes" value={String(slide.duration)} disabled={busy} onChange={value => update({ duration: Number(value) })} options={Array.from({ length: 19 }, (_, i) => 1000 + i * 500).map(duration => ({ value: String(duration), label: `${(duration / 1000).toLocaleString('de-DE')} Sekunden` }))} /></div>
        <label className="control-row"><span data-particle="text">Schreibanimation</span><input data-particle="switch" className="switch" type="checkbox" role="switch" aria-label="Schreibanimation" checked={writing.enabled} disabled={busy} onChange={event => write({ enabled: event.target.checked })} /></label>
        {writing.enabled && <div className="control-row"><span data-particle="text">Schreibrhythmus</span><ParticleSelect label="Schreibrhythmus" disabled={busy} value={preset} onChange={value => { const p = WRITING_PRESETS[value as keyof typeof WRITING_PRESETS]; if (p) write(p); }} options={[{ value: 'Eigene Werte', label: 'Eigene Werte', disabled: true }, ...Object.keys(WRITING_PRESETS).map(value => ({ value, label: value }))]} /></div>}
      </div>
      {writing.enabled && <details className="advanced"><summary data-particle="button">Timing verfeinern +</summary><div className="advanced-content">{pauses.map(item => {
        const value = writing[item.key] ?? (item.key === 'commaPause' ? writing.punctuationPause * .45 : writing.punctuationPause);
        return <label className="range-control" key={item.key}><span><span data-particle="text">{item.label}</span><output data-particle="text">{Math.round(value)} ms</output></span><input data-particle="range" aria-label={item.label} type="range" min={item.min} max={item.max} step={item.step} disabled={busy} value={value} onChange={event => write({ [item.key]: Number(event.target.value) })} /></label>;
      })}</div></details>}
      <ParticleStyleEditor settings={settings} onChange={onSettingsChange} busy={busy} />
      <SceneFeatureEditor slide={slide} settings={settings} busy={busy} update={features => update({ features })} onSettingsChange={onSettingsChange} />
      {error && <p data-particle="text" role="alert" className="error-message">{error}</p>}
      <div className="editor-bottom"><button className="secondary" onClick={onPreview} disabled={busy}><span aria-hidden="true">▶</span> Vorschau</button><button className="primary" onClick={onSave} disabled={busy}>{busy ? 'Core lädt …' : 'Nachricht senden'} <span aria-hidden="true">↗</span></button></div>
      <p className="expiry-note"><span aria-hidden="true">⌁</span> 3 Tage gültig · Ohne Passwort zu öffnen</p>
    </div><LivePreview active={previewActive} particlesEnabled={particlesEnabled} engine={engine} slide={slide} settings={settings} onTest={onPreview} /></div>
  </section>;
}
