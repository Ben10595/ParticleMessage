'use client';

import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ParticleCanvas from './ParticleCanvas';
import Branding from './Branding';
import type { ParticleEngine } from '@/particles/ParticleEngine';
import { unlockSite, type PasswordState } from '@/app/actions';

const initialState: PasswordState = { success: false, error: '', attempt: 0 };

export default function PasswordGate() {
  const router = useRouter();
  const [state, action, pending] = useActionState(unlockSite, initialState);
  const [engine, setEngine] = useState<ParticleEngine | null>(null);
  const surface = useRef<HTMLElement>(null);
  const handleCanvasError = useCallback(() => setEngine(null), []);

  useEffect(() => {
    if (!engine || !surface.current) return;
    const timer = window.setTimeout(() => engine.formUI(surface.current!), 350);
    return () => window.clearTimeout(timer);
  }, [engine, state.error, pending]);

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state, router]);

  const visibleError = state.error;

  return <main className={`experience password-gate ${engine ? 'canvas-ready' : 'canvas-pending'}`} ref={surface}>
    <ParticleCanvas onReady={setEngine} onError={handleCanvasError} />
    <header className="masthead">
      <span className="wordmark">PARTICLEMESSAGE</span>
      <span className="edition">WORTE IN BEWEGUNG</span>
    </header>
    <section className="landing password-panel">
      <p className="eyebrow">GESCHÜTZTER BEREICH</p>
      <h1 data-particle="hero">Nur für dich.</h1>
      <form action={action}>
        <label className="sr-only" htmlFor="site-password">Passwort</label>
        <div className="password-field">
          <input id="site-password" name="password" type="password" autoComplete="current-password" placeholder="Passwort" required disabled={pending} autoFocus />
        </div>
        <p className="password-error" role="alert" aria-live="polite">{visibleError}</p>
        <button className="primary" type="submit" disabled={pending}>{pending ? 'Wird geprüft …' : 'Öffnen ↗'}</button>
      </form>
    </section>
    <Branding />
    <footer><span>PERSÖNLICH. FLÜCHTIG. BESONDERS.</span><span>01 — ∞</span></footer>
  </main>;
}
