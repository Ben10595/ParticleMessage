'use client';
import { useRef, useState } from 'react';
import { MAX_SLIDES, MAX_TEXT_LENGTH, EFFECTS, EFFECT_LABELS, EFFECT_DESCRIPTIONS, FONTS, FONT_LABELS, WRITING_PRESETS, slideSettings, type Slide, type MessageSettings, type TransitionEffect, type WritingSettings, type MessageFont } from '@/types/message';
import type { OneLineEngine as ParticleEngine } from '@/lines/OneLineEngine';
import LivePreview from './LivePreview';
import ParticleSelect from './ParticleSelect';
import FontSample from './FontSample';
import { useLinePresence } from './useLinePresence';
interface Props { previewActive: boolean; slides: Slide[]; settings: MessageSettings; engine: ParticleEngine | null; active: number; onSelect: (index: number) => void; onChange: (slides: Slide[]) => void; onPreview: () => void; onSave: () => void; busy: boolean; error: string }
const emojis = ['❤️', '😂', '✨', '👀', '🥳', '🔥', '😊', '😭', '💀', '🤍', '🫶', '🌙'];
const pauses = [
  { key: 'speed', label: 'Pro Zeichen', min: 20, max: 250, step: 5 },
  { key: 'commaPause', label: 'Komma ,', min: 0, max: 2500, step: 50 },
  { key: 'periodPause', label: 'Punkt .', min: 0, max: 2500, step: 50 },
  { key: 'questionPause', label: 'Fragezeichen ?', min: 0, max: 2500, step: 50 },
  { key: 'exclamationPause', label: 'Ausrufezeichen !', min: 0, max: 2500, step: 50 },
  { key: 'paragraphPause', label: 'Zeilenumbruch', min: 0, max: 4000, step: 50 },
] as const;
export default function ParticleEditor({ previewActive, slides, settings, engine, active, onSelect, onChange, onPreview, onSave, busy, error }: Props) {
  const slide = slides[active];
  const { writing, effect, font } = slideSettings(slide, settings);
  const input = useRef<HTMLTextAreaElement>(null);
  const selection = useRef({ start: 0, end: 0 });
  const [emojiOpen, setEmojiOpen] = useState(false);
  const emojiPresent = useLinePresence(emojiOpen);
  function update(patch: Partial<Slide>) { onChange(slides.map((item, index) => index === active ? { ...item, ...patch } : item)); }
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
    update({ text }); setEmojiOpen(false);
    engine?.emitTypingFlow(input.current?.getBoundingClientRect(), null);
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(start + emoji.length, start + emoji.length); });
  }
  const preset = Object.entries(WRITING_PRESETS).find(([, p]) => Object.entries(p).every(([key, value]) => writing[key as keyof WritingSettings] === value))?.[0] ?? 'Eigene Werte';
  return <section className="editor" aria-label="Nachrichteneditor" aria-busy={busy}>
    <div className="editor-heading"><p data-particle="text" className="eyebrow">VON DIR. FÜR JEMANDEN.</p><h1 data-particle="hero">Was bleibt, sind Worte.</h1></div>
    <div className="editor-grid"><div className="editor-panel">
      <div className="section-heading"><span data-particle="text">Deine Abschnitte</span><span data-particle="text">{slides.length} / {MAX_SLIDES}</span></div>
      <nav className="slide-tabs" aria-label="Abschnitte">
        {slides.map((_, index) => <button data-particle="button" key={index} aria-label={`Abschnitt ${index + 1}`} aria-current={index === active ? 'step' : undefined} onClick={() => { onSelect(index); setEmojiOpen(false); }} disabled={busy}>{String(index + 1).padStart(2, '0')}</button>)}
        <button data-particle="button" data-icon="plus" className="add-slide" aria-label="Abschnitt hinzufügen" disabled={slides.length >= MAX_SLIDES || busy} onClick={() => { onChange([...slides, { text: '', duration: 2500 }]); onSelect(slides.length); }}>+</button>
      </nav>
      <div className="field-meta"><label data-particle="text" htmlFor="message-text">ABSCHNITT {String(active + 1).padStart(2, '0')}</label><span data-particle="text">{Array.from(slide.text).length} / {MAX_TEXT_LENGTH}</span></div>
      <div data-particle="frame" className="text-field"><textarea ref={input} onSelect={event => { selection.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }; }} onBlur={event => { selection.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }; }} onKeyDown={event => { if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Enter') engine?.emitTypingFlow(input.current?.getBoundingClientRect(), null); }} id="message-text" value={slide.text} placeholder="Was du schon immer sagen wolltest …" disabled={busy} onChange={event => { update({ text: Array.from(event.target.value).slice(0, MAX_TEXT_LENGTH).join('') }); engine?.emitTypingFlow(input.current?.getBoundingClientRect(), null); }} /></div>
      <div className="text-toolbar"><div className="emoji-control"><button data-particle="button" aria-expanded={emojiOpen} aria-controls="emoji-picker" onClick={() => setEmojiOpen(!emojiOpen)} disabled={busy}>☺ Emoji</button>{emojiPresent && <div aria-hidden={!emojiOpen || undefined} inert={!emojiOpen} data-particle="frame" className={`emoji-picker ${!emojiOpen ? 'is-closing' : ''}`} id="emoji-picker" aria-label="Emoji auswählen" onKeyDown={event => { if (event.key === 'Escape') { setEmojiOpen(false); input.current?.focus(); } }}>{emojis.map(emoji => <button key={emoji} aria-label={`${emoji} einfügen`} onMouseDown={event => event.preventDefault()} onClick={() => insertEmoji(emoji)}>{emoji}</button>)}</div>}</div>
      <div className="slide-actions"><button data-particle="button" data-icon="left" aria-label="Abschnitt nach vorne" disabled={active === 0 || busy} onClick={() => move(-1)}>←</button><button data-particle="button" data-icon="arrow" aria-label="Abschnitt nach hinten" disabled={active === slides.length - 1 || busy} onClick={() => move(1)}>→</button><button data-particle="button" data-icon="close" aria-label="Abschnitt löschen" disabled={slides.length === 1 || busy} onClick={() => { onChange(slides.filter((_, index) => index !== active)); onSelect(Math.max(0, active - 1)); }}>×</button></div></div>
      <div data-particle="line" className="particle-divider" />
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
      {error && <p data-particle="text" role="alert" className="error-message">{error}</p>}
      <div className="editor-bottom"><button data-particle="button" className="secondary" onClick={onPreview} disabled={busy}>Vorschau</button><button data-particle="button" className="primary" onClick={onSave} disabled={busy}>{busy ? 'Wird gespeichert …' : 'Link erstellen'}</button></div>
      <p data-particle="text" className="expiry-note">3 Tage gültig. Ohne Passwort zu öffnen.</p>
    </div><LivePreview active={previewActive} engine={engine} slide={slide} settings={settings} /></div>
  </section>;
}
