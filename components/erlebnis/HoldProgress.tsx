'use client';
import { useEffect, useRef } from 'react';
import type { ParticleEngine } from '@/particles/matter/ParticleEngine';
export default function HoldProgress({ engine }: { engine: ParticleEngine | null }) {
  const bar = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!engine) return;
    const update = () => {
      const value = Math.round(engine.holdProgress * 100);
      bar.current?.style.setProperty('--hold', String(engine.holdProgress));
      bar.current?.setAttribute('aria-valuenow', String(value));
      const output = bar.current?.querySelector('output'); if (output) output.textContent = `${value} %`;
    };
    update(); const timer = window.setInterval(update, 80); return () => clearInterval(timer);
  }, [engine]);
  if (!engine) return null;
  return <span ref={bar} className="hold-meter" role="progressbar" aria-label="Nachricht enthüllen" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0}><span className="hold-track"><i /></span><output>0 %</output></span>;
}
