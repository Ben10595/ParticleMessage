'use client';
import { useEffect, useRef } from 'react';
import { ParticleEngine } from '@/particles/ParticleEngine';
export default function ParticleCanvas({ onReady, onError }: { onReady: (engine: ParticleEngine | null) => void; onError: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let engine: ParticleEngine | undefined;
    try { engine = new ParticleEngine(canvas.current!); onReady(engine); }
    catch { onError(); }
    return () => { onReady(null); engine?.destroy(); };
  }, [onReady, onError]);
  return <canvas ref={canvas} className="particle-canvas" aria-hidden="true" />;
}
