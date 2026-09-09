'use client';
import { useRef, useState } from 'react';
import { MAX_SLIDES, MAX_TEXT_LENGTH, MAX_DURATION, MIN_DURATION, EFFECTS, EFFECT_LABELS, WRITING_PRESETS, type Slide, type MessageSettings, type TransitionEffect } from '@/types/message';
import type { ParticleEngine } from '@/particles/ParticleEngine';
import LivePreview from './LivePreview';
interface Props { slides: Slide[]; settings: MessageSettings; engine: ParticleEngine | null; active: number; onSelect: (index: number) => void; onChange: (slides: Slide[]) => void; onSettings: (settings: MessageSettings) => void; onPreview: () => void; onSave: () => void; busy: boolean; error: string }
const emojis = ['❤️', '😂', '✨', '👀', '🥳', '😭', '🔥', '🥰', '🫶', '👋', '💫', '🌙', '🤍', '🎉', '😊', '💌'];
export default function ParticleEditor({ slides, settings, engine, active, onSelect, onChange, onSettings, onPreview, onSave, busy, error }: Props) {
  const slide = slides[active];
  const input = useRef<HTMLTextAreaElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  function update(patch: Partial<Slide>) { onChange(slides.map((item, index) => index === active ? { ...item, ...patch } : item)); }
  function move(direction: number) {
    const target = active + direction;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides]; [next[active], next[target]] = [next[target], next[active]];
    onChange(next); onSelect(target);
  }
  function insertEmoji(emoji: string) {
    const start = input.current?.selectionStart ?? slide.text.length, end = input.current?.selectionEnd ?? start;
    const text = slide.text.slice(0, start) + emoji + slide.text.slice(end);
    if (Array.from(text).length > MAX_TEXT_LENGTH) return;
    update({ text });
    setEmojiOpen(false);
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(start + emoji.length, start + emoji.length); });
  }
  const preset = Object.entries(WRITING_PRESETS).find(([, p]) => p.speed === settings.writing.speed && p.punctuationPause === settings.writing.punctuationPause && p.paragraphPause === settings.writing.paragraphPause)?.[0] ?? 'Eigene Werte';
  return <section className="editor" aria-label="Nachrichteneditor" aria-busy={busy}>
    <div className="editor-heading"><div><p className="eyebrow">DEINE WORTE, DEIN MOMENT.</p><h1>Was möchtest du sagen?</h1><p className="editor-subtitle">Ein kleiner Text. Ein großes Gefühl.</p></div><span className="total">{slides.length} / {MAX_SLIDES} Abschnitte</span></div>
    <div className="editor-grid"><div className="editor-panel">
      <nav className="slide-tabs" aria-label="Abschnitte">
        {slides.map((_, index) => <button key={index} aria-label={`Abschnitt ${index + 1}`} aria-current={index === active ? 'step' : undefined} onClick={() => onSelect(index)} disabled={busy}>{String(index + 1).padStart(2, '0')}</button>)}
        <button className="add-slide" aria-label="Neue Nachricht hinzufügen" title="Neuer Abschnitt" disabled={slides.length >= MAX_SLIDES || busy} onClick={() => { onChange([...slides, { text: '', duration: 2500 }]); onSelect(slides.length); }}>+</button>
      </nav>
      <div className="field-meta"><label htmlFor="message-text">ABSCHNITT {String(active + 1).padStart(2, '0')}</label><span>{Array.from(slide.text).length} / {MAX_TEXT_LENGTH}</span></div>
      <div className="text-field"><textarea ref={input} id="message-text" value={slide.text} placeholder="Manchmal braucht es nur ein paar Worte …" aria-describedby="text-help" disabled={busy} onChange={event => update({ text: Array.from(event.target.value).slice(0, MAX_TEXT_LENGTH).join('') })} /></div>
      <div className="text-toolbar"><div className="emoji-control"><button aria-expanded={emojiOpen} aria-controls="emoji-picker" onClick={() => setEmojiOpen(!emojiOpen)} disabled={busy}>☺ <span>Emoji</span></button>{emojiOpen && <div className="emoji-picker" id="emoji-picker" aria-label="Emoji auswählen" onKeyDown={event => { if (event.key === 'Escape') { setEmojiOpen(false); input.current?.focus(); } }}>{emojis.map(emoji => <button key={emoji} aria-label={`${emoji} einfügen`} onClick={() => insertEmoji(emoji)}>{emoji}</button>)}</div>}</div><span id="text-help">Bis zu 150 Zeichen</span></div>
      <div className="editor-options"><label className="duration" htmlFor="hold-duration"><span>Text stehen lassen</span><select id="hold-duration" value={slide.duration} disabled={busy} onChange={event => update({ duration: Number(event.target.value) })}>{Array.from({ length: (MAX_DURATION - MIN_DURATION) / 500 + 1 }, (_, i) => MIN_DURATION + i * 500).map(duration => <option key={duration} value={duration}>{(duration / 1000).toLocaleString('de-DE')} s</option>)}</select></label>
        <div className="slide-actions"><button aria-label="Abschnitt nach vorne" title="Nach vorne" disabled={active === 0 || busy} onClick={() => move(-1)}>←</button><button aria-label="Abschnitt nach hinten" title="Nach hinten" disabled={active === slides.length - 1 || busy} onClick={() => move(1)}>→</button><button aria-label="Abschnitt löschen" title="Abschnitt löschen" disabled={slides.length === 1 || busy} onClick={() => { onChange(slides.filter((_, index) => index !== active)); onSelect(Math.max(0, active - 1)); }}>×</button></div>
      </div>
      <div className="settings-group"><label className="control-row"><span>Übergang <small>Für die ganze Nachricht</small></span><select aria-label="Übergang für die ganze Nachricht" value={settings.effect} disabled={busy} onChange={event => onSettings({ ...settings, effect: event.target.value as TransitionEffect })}>{EFFECTS.map(effect => <option key={effect} value={effect}>{EFFECT_LABELS[effect]}</option>)}</select></label>
      <label className="control-row"><span>Wie geschrieben <small>Buchstabe für Buchstabe</small></span><input className="switch" type="checkbox" role="switch" checked={settings.writing.enabled} disabled={busy} onChange={event => onSettings({ ...settings, writing: { ...settings.writing, enabled: event.target.checked } })} /></label>
      {settings.writing.enabled && <div className="writing-options"><label className="control-row"><span>Schreibrhythmus</span><select aria-label="Schreibrhythmus" disabled={busy} value={preset} onChange={event => { const p = WRITING_PRESETS[event.target.value as keyof typeof WRITING_PRESETS]; if (p) onSettings({ ...settings, writing: { enabled: true, ...p } }); }}><option disabled value="Eigene Werte">Eigene Werte</option>{Object.keys(WRITING_PRESETS).map(name => <option key={name}>{name}</option>)}</select></label></div>}
      </div>
      <details className="advanced"><summary>Feinabstimmung <span>+</span></summary><div className="advanced-content">
        <label className="control-row"><span>Dieser Abschnitt</span><select aria-label="Übergang dieses Abschnitts" disabled={busy} value={slide.effect ?? ''} onChange={event => update({ effect: event.target.value ? event.target.value as TransitionEffect : undefined })}><option value="">Wie gesamte Nachricht</option>{EFFECTS.map(effect => <option key={effect} value={effect}>{EFFECT_LABELS[effect]}</option>)}</select></label>
        {settings.writing.enabled && <>{([{ key: 'speed', label: 'Zeit pro Zeichen', min: 20, max: 250, step: 5 }, { key: 'punctuationPause', label: 'Pause nach Satzzeichen', min: 0, max: 2500, step: 50 }, { key: 'paragraphPause', label: 'Pause nach Absatz', min: 0, max: 4000, step: 50 }] as const).map(item => <label className="range-control" key={item.key}><span>{item.label}<output>{settings.writing[item.key]} ms</output></span><input type="range" min={item.min} max={item.max} step={item.step} disabled={busy} value={settings.writing[item.key]} onChange={event => onSettings({ ...settings, writing: { ...settings.writing, [item.key]: Number(event.target.value) } })} /></label>)}</>}
        <label className="control-row"><span>Ein besonderes Finale <small>Letzten Abschnitt langsam formen</small></span><input className="switch" type="checkbox" role="switch" disabled={busy} checked={settings.finale} onChange={event => onSettings({ ...settings, finale: event.target.checked })} /></label>
      </div></details>
      {error && <p role="alert" className="error-message">{error}</p>}
      <div className="editor-bottom"><button className="secondary" onClick={onPreview} disabled={busy}>▷ Gesamtvorschau</button><button className="primary" onClick={onSave} disabled={busy}>{busy ? 'Wird gespeichert …' : 'Link erstellen ↗'}</button></div>
      <p className="expiry-note">Dein Link ist 3 Tage gültig. Ohne Passwort zu öffnen.</p>
    </div><LivePreview engine={engine} text={slide.text} effect={slide.effect ?? settings.effect} /></div>
  </section>;
}
