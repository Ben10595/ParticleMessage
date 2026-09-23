'use client';
import { useEffect, useRef, useState } from 'react';
import type { ParticleEngine } from '@/particles/matter/ParticleEngine';
import { FONT_LABELS, EFFECT_LABELS, slideSettings, type Slide, type MessageSettings } from '@/types/message';
export default function LivePreview({ active, particlesEnabled, engine, slide, settings, onTest }: { onTest: () => void; active: boolean; particlesEnabled: boolean; engine: ParticleEngine | null; slide: Slide; settings: MessageSettings }) {
  const bounds = useRef<HTMLDivElement>(null);
  const [replay, setReplay] = useState(0);
  const { text } = slide;
  const { effect, writing, font, size, align } = slideSettings(slide, settings);
  useEffect(() => {
    if (!engine || !active || !particlesEnabled) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const element = bounds.current;
        if (!element || controller.signal.aborted) return;
        engine.formText(text || 'Deine Worte.', { bounds: () => element.getBoundingClientRect(), effect, writing, font, size, align });
      } catch { /* A later edit or scene owns the pool. */ }
    }, 260);
    const observer = new ResizeObserver(() => engine.refresh());
    if (bounds.current) observer.observe(bounds.current);
    return () => { clearTimeout(timer); controller.abort(); observer.disconnect(); };
  }, [active, engine, particlesEnabled, text, effect, writing, font, size, align, replay]);
  useEffect(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.particle-canvas');
    const frame = bounds.current;
    if (!canvas || !frame) return;
    let animationFrame = 0;
    const clip = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        const rect = frame.getBoundingClientRect();
        const right = Math.max(0, innerWidth - rect.right);
        const bottom = Math.max(0, innerHeight - rect.bottom);
        canvas.style.clipPath = `inset(${Math.max(0, rect.top)}px ${right}px ${bottom}px ${Math.max(0, rect.left)}px round 11px)`;
      });
    };
    clip();
    const observer = new ResizeObserver(clip);
    observer.observe(frame);
    window.addEventListener('resize', clip);
    window.addEventListener('scroll', clip, { passive: true });
    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      window.removeEventListener('resize', clip);
      window.removeEventListener('scroll', clip);
      canvas.style.clipPath = '';
    };
  }, []);
  return <aside className="live-preview" aria-label="Live-Vorschau" data-particles-enabled={particlesEnabled} data-mood={settings.mood ?? 'calm'} data-message-background={settings.background ?? 'night'}>
    <div className="preview-meta"><span><i aria-hidden="true" /> 02 / LIVE VORSCHAU</span><button aria-label="Abschnitt erneut abspielen" onClick={() => setReplay(n => n + 1)}>↻</button></div>
    <div className="particle-divider" />
    <div className="preview-bounds" ref={bounds}><p data-message-font={font} data-text-size={size} data-text-align={align} className={`live-fallback ${engine && particlesEnabled ? 'live-ghost' : ''}`}>{text || 'Deine Worte.'}</p></div>
    <p className="preview-caption"><span className="preview-live-dot" aria-hidden="true" />Live · {FONT_LABELS[font]} · {EFFECT_LABELS[effect]}</p>
    {(slide.features?.hold || slide.features?.gift || slide.features?.puzzle || slide.features?.secrets?.length || settings.finale) && <div className="preview-extras"><p>{[slide.features?.puzzle && 'Rätsel', slide.features?.gift && 'Geschenk', slide.features?.hold && 'Gedrückt halten', slide.features?.secrets?.length && 'Geheime Worte', settings.finale && 'Finale'].filter(Boolean).join(' · ')}</p><button data-particle="button" onClick={onTest}>Gesamtes Erlebnis testen ↗</button><span>Hier siehst du Schrift und Reveal. Alle Extras erlebst du in der Gesamtvorschau.</span></div>}
  </aside>;
}
