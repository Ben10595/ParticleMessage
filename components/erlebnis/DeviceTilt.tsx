'use client';
import { useEffect, useRef, useState } from 'react';
import type { ParticleEngine as OneLineEngine } from '@/particles/matter/ParticleEngine';
type OrientationAPI = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };
export default function DeviceTilt({ engine, enabled }: { engine: OneLineEngine | null; enabled: boolean }) {
  const [status, setStatus] = useState<'hidden' | 'ready' | 'requesting' | 'active' | 'denied' | 'unavailable'>('hidden');
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const frame = requestAnimationFrame(() => { if (window.isSecureContext && 'DeviceOrientationEvent' in window && matchMedia('(pointer: coarse)').matches) setStatus('ready'); });
    return () => { alive.current = false; cancelAnimationFrame(frame); };
  }, []);
  useEffect(() => {
    if (!engine || !enabled || status !== 'active') return;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let baseline: { beta: number; gamma: number } | null = null;
    let received = false;
    const change = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
      received = true;
      if (document.hidden || motion.matches) { engine.setTilt(0, 0); baseline = null; return; }
      baseline ??= { beta: event.beta, gamma: event.gamma };
      const x = Math.max(-1, Math.min(1, (event.gamma - baseline.gamma) / 20)), y = Math.max(-1, Math.min(1, (event.beta - baseline.beta) / 20));
      const angle = (screen.orientation?.angle ?? 0) * Math.PI / 180;
      engine.setTilt(x * Math.cos(angle) + y * Math.sin(angle), y * Math.cos(angle) - x * Math.sin(angle));
    };
    const reset = () => { baseline = null; engine.setTilt(0, 0); };
    const timeout = setTimeout(() => { if (!received) setStatus('unavailable'); }, 5000);
    window.addEventListener('deviceorientation', change, { passive: true });
    window.addEventListener('orientationchange', reset); document.addEventListener('visibilitychange', reset); motion.addEventListener('change', reset);
    return () => { clearTimeout(timeout); window.removeEventListener('deviceorientation', change); window.removeEventListener('orientationchange', reset); document.removeEventListener('visibilitychange', reset); motion.removeEventListener('change', reset); engine.setTilt(0, 0); };
  }, [engine, enabled, status]);
  async function enable() {
    setStatus('requesting');
    try {
      const api = DeviceOrientationEvent as OrientationAPI;
      const permission = api.requestPermission ? await api.requestPermission() : 'granted';
      if (alive.current) setStatus(permission === 'granted' ? 'active' : 'denied');
    } catch { if (alive.current) setStatus('unavailable'); }
  }
  if (!enabled || !engine || status === 'hidden' || engine.reducedMotion) return null;
  return <div className="tilt-control">
    {status === 'ready' || status === 'requesting' ? <button data-particle="button" disabled={status === 'requesting'} onClick={() => void enable()}>Neigung aktivieren</button> : <span role="status">{status === 'active' ? 'Neigung aktiv' : status === 'denied' ? 'Alles gut. Deine Nachricht funktioniert auch ohne Neigung.' : 'Hier ist kein Bewegungssensor verfügbar.'}</span>}
  </div>;
}
