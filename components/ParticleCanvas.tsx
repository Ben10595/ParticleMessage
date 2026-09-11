'use client';
import { useEffect, useRef } from 'react';
import { OneLineEngine } from '@/lines/OneLineEngine';
export default function ParticleCanvas({ onReady, onError }: { onReady: (engine: OneLineEngine | null) => void; onError: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let engine: OneLineEngine | undefined;
    try { engine = new OneLineEngine(canvas.current!); onReady(engine); }
    catch { onError(); }
    return () => { onReady(null); engine?.destroy(); };
  }, [onReady, onError]);
  return <canvas ref={canvas} className="particle-canvas" aria-hidden="true" />;
}
