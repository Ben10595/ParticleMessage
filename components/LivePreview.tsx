'use client';
import { useEffect, useRef } from 'react';
import type { ParticleEngine } from '@/particles/ParticleEngine';
import type { TransitionEffect } from '@/types/message';
export default function LivePreview({ engine, text, effect }: { engine: ParticleEngine | null; text: string; effect: TransitionEffect }) {
  const bounds = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!engine) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      engine.disperseParticles(.8);
      try {
        await engine.wait(engine.reducedMotion ? 0 : 220, controller.signal);
        if (bounds.current) engine.formText(text || 'Deine Worte.', { bounds: () => bounds.current!.getBoundingClientRect(), effect });
      } catch { /* The next edit owns the preview. */ }
    }, 380);
    const observer = new ResizeObserver(() => engine.refresh());
    if (bounds.current) observer.observe(bounds.current);
    return () => { clearTimeout(timer); controller.abort(); observer.disconnect(); };
  }, [engine, text, effect]);
  return <aside className="live-preview" aria-label="Live-Vorschau">
    <div className="preview-meta"><span><i /> LIVE-VORSCHAU</span><span>Dein Moment nimmt Form an</span></div>
    <div className="preview-bounds" ref={bounds}><p className={engine ? 'sr-only' : 'live-fallback'}>{text || 'Deine Worte.'}</p></div>
    <p className="preview-caption">Ein Gedanke. Tausend kleine Punkte.</p>
  </aside>;
}
