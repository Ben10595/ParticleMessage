'use client';
import { useEffect, useRef, useState } from 'react';
import type { OneLineEngine as ParticleEngine } from '@/lines/OneLineEngine';
import { FONT_LABELS, EFFECT_LABELS, slideSettings, type Slide, type MessageSettings } from '@/types/message';
export default function LivePreview({ active, engine, slide, settings }: { active: boolean; engine: ParticleEngine | null; slide: Slide; settings: MessageSettings }) {
  const bounds = useRef<HTMLDivElement>(null);
  const [replay, setReplay] = useState(0);
  const { text, duration } = slide;
  const { effect, writing, font } = slideSettings(slide, settings);
  useEffect(() => {
    if (!engine || !active) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        engine.loosenText();
        await engine.wait(engine.reducedMotion ? 0 : 180, controller.signal);
        const element = bounds.current;
        if (!element) return;
        while (!controller.signal.aborted) {
          const formation = engine.formText(text || 'Deine Worte.', { bounds: () => element.getBoundingClientRect(), effect, writing, font });
          await engine.wait(formation + duration, controller.signal);
          engine.disperseText(.45);
          await engine.wait(engine.reducedMotion ? 800 : 1500, controller.signal);
        }
      } catch { /* A later edit or scene owns the pool. */ }
    }, 380);
    const observer = new ResizeObserver(() => engine.refresh());
    if (bounds.current) observer.observe(bounds.current);
    return () => { clearTimeout(timer); controller.abort(); observer.disconnect(); };
  }, [active, engine, text, duration, effect, writing, font, replay]);
  return <aside className="live-preview" aria-label="Live-Vorschau">
    <div className="preview-meta"><span data-particle="text">SO KOMMEN DEINE WORTE AN</span><button data-particle="button" aria-label="Abschnitt erneut abspielen" onClick={() => setReplay(n => n + 1)}>↻</button></div>
    <div data-particle="line" className="particle-divider" />
    <div className="preview-bounds" ref={bounds}><p data-message-font={font} className={engine ? 'sr-only' : 'live-fallback'}>{text || 'Deine Worte.'}</p></div>
    <p data-particle="text" className="preview-caption">{FONT_LABELS[font]} · {EFFECT_LABELS[effect]}</p>
  </aside>;
}
