'use client';
import { MAX_SLIDES, MAX_TEXT_LENGTH, MAX_DURATION, MIN_DURATION, type Slide } from '@/types/message';
interface Props { slides: Slide[]; active: number; onSelect: (index: number) => void; onChange: (slides: Slide[]) => void; onPreview: () => void; onSave: () => void; busy: boolean; error: string }
export default function ParticleEditor({ slides, active, onSelect, onChange, onPreview, onSave, busy, error }: Props) {
  const slide = slides[active];
  function update(patch: Partial<Slide>) { onChange(slides.map((item, index) => index === active ? { ...item, ...patch } : item)); }
  function move(direction: number) {
    const target = active + direction;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides]; [next[active], next[target]] = [next[target], next[active]];
    onChange(next); onSelect(target);
  }
  return <section className="editor" aria-label="Nachrichteneditor" aria-busy={busy}>
    <div className="editor-heading"><div><p className="eyebrow" data-particle="text">DEINE WORTE, DEIN MOMENT.</p><h1 data-particle="text">Was möchtest du sagen?</h1></div><span className="total" data-particle="text">{slides.length} / 15</span></div>
    <nav className="slide-tabs" aria-label="Abschnitte">
      {slides.map((_, index) => <button key={index} data-particle={index === active ? 'button' : 'text'} aria-label={`Abschnitt ${index + 1}`} aria-current={index === active ? 'step' : undefined} onClick={() => onSelect(index)} disabled={busy}>{String(index + 1).padStart(2, '0')}</button>)}
      <button data-particle="text" aria-label="Neue Nachricht hinzufügen" title="Neuer Abschnitt" disabled={slides.length >= MAX_SLIDES || busy} onClick={() => { onChange([...slides, { text: '', duration: 2500 }]); onSelect(slides.length); }}>+</button>
    </nav>
    <div className="field-meta"><label htmlFor="message-text" data-particle="text">ABSCHNITT {String(active + 1).padStart(2, '0')}</label><span data-particle="text">{Array.from(slide.text).length} / 150</span></div>
    <div className="text-field" data-particle="box"><textarea id="message-text" key={active} data-particle="text" value={slide.text} placeholder="Deine Worte …" aria-describedby="text-help" disabled={busy} onChange={event => update({ text: Array.from(event.target.value).slice(0, MAX_TEXT_LENGTH).join('') })} spellCheck={false} /></div>
    <span id="text-help" className="sr-only">Maximal 150 Zeichen. Die Anzeigedauer beginnt, sobald der Text vollständig geformt ist.</span>
    <div className="editor-options"><div className="duration"><span data-particle="text">DAUER</span><button data-particle="text" aria-label="Dauer verkürzen" disabled={slide.duration <= MIN_DURATION || busy} onClick={() => update({ duration: Math.max(MIN_DURATION, slide.duration - 500) })}>−</button><output data-particle="text" aria-live="polite">{(slide.duration / 1000).toLocaleString('de-DE')} s</output><button data-particle="text" aria-label="Dauer verlängern" disabled={slide.duration >= MAX_DURATION || busy} onClick={() => update({ duration: Math.min(MAX_DURATION, slide.duration + 500) })}>+</button></div>
      <div className="slide-actions"><button data-particle="text" aria-label="Abschnitt nach vorne" title="Nach vorne" disabled={active === 0 || busy} onClick={() => move(-1)}>←</button><button data-particle="text" aria-label="Abschnitt nach hinten" title="Nach hinten" disabled={active === slides.length - 1 || busy} onClick={() => move(1)}>→</button><button data-particle="text" aria-label="Abschnitt löschen" title="Abschnitt löschen" disabled={slides.length === 1 || busy} onClick={() => { onChange(slides.filter((_, index) => index !== active)); onSelect(Math.max(0, active - 1)); }}>×</button></div></div>
    <div data-particle="line" className="divider" />
    <p role="alert" data-particle="text" className="error-message">{error}</p>
    <div className="editor-bottom"><button data-particle="text" onClick={onPreview} disabled={busy}>▷ Vorschau</button><button data-particle="button" className="primary" onClick={onSave} disabled={busy}>{busy ? 'Wird gespeichert …' : 'Link erstellen ↗'}</button></div>
  </section>;
}
