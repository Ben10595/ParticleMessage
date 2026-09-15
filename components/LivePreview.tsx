'use client';
import { useEffect, useRef, useState } from 'react';
import type { ParticleEngine } from '@/particles/matter/ParticleEngine';
import { FONT_LABELS, EFFECT_LABELS, slideSettings, type Slide, type MessageSettings } from '@/types/message';
export default function LivePreview({ active, engine, slide, settings, onTest }: { onTest: () => void; active: boolean; engine: ParticleEngine | null; slide: Slide; settings: MessageSettings }) {
  const bounds = useRef<HTMLDivElement>(null);
  const [replay, setReplay] = useState(0);
  const { text } = slide;
  const { effect, writing, font } = slideSettings(slide, settings);
  useEffect(() => {
    if (!engine || !active) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const element = bounds.current;
        if (!element || controller.signal.aborted) return;
        engine.formText(text || 'Deine Worte.', { bounds: () => element.getBoundingClientRect(), effect, writing, font });
      } catch { /* A later edit or scene owns the pool. */ }
    }, 260);
    const observer = new ResizeObserver(() => engine.refresh());
    if (bounds.current) observer.observe(bounds.current);
    return () => { clearTimeout(timer); controller.abort(); observer.disconnect(); };
  }, [active, engine, text, effect, writing, font, replay]);
  return <aside className="live-preview" aria-label="Live-Vorschau">
    <div className="preview-meta"><span data-particle="text">SO KOMMEN DEINE WORTE AN</span><button data-particle="button" aria-label="Abschnitt erneut abspielen" onClick={() => setReplay(n => n + 1)}>↻</button></div>
    <div data-particle="line" className="particle-divider" />
    <div className="preview-bounds" ref={bounds}><p data-message-font={font} className={engine ? 'sr-only' : 'live-fallback'}>{text || 'Deine Worte.'}</p></div>
    <p data-particle="text" className="preview-caption"><span className="preview-live-dot" aria-hidden="true" />Live · {FONT_LABELS[font]} · {EFFECT_LABELS[effect]}</p>
    {(slide.features?.hold || slide.features?.gift || slide.features?.puzzle || slide.features?.secrets?.length || settings.finale) && <div className="preview-extras"><p>{[slide.features?.puzzle && 'Rätsel', slide.features?.gift && 'Geschenk', slide.features?.hold && 'Gedrückt halten', slide.features?.secrets?.length && 'Geheime Worte', settings.finale && 'Finale'].filter(Boolean).join(' · ')}</p><button data-particle="button" onClick={onTest}>Gesamtes Erlebnis testen ↗</button><span>Hier siehst du Schrift und Reveal. Alle Extras erlebst du in der Gesamtvorschau.</span></div>}
  </aside>;
}
