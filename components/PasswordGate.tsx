'use client';

import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ParticleCanvas from './ParticleCanvas';
import type { ParticleEngine } from '@/particles/ParticleEngine';
import { unlockSite, type PasswordState } from '@/app/actions';

const initialState: PasswordState = { success: false, error: '', attempt: 0 };

export default function PasswordGate() {
  const router = useRouter();
  const [state, action, pending] = useActionState(unlockSite, initialState);
  const [hiddenAttempt, setHiddenAttempt] = useState(0);
  const [engine, setEngine] = useState<ParticleEngine | null>(null);
  const surface = useRef<HTMLElement>(null);
  const handleCanvasError = useCallback(() => setEngine(null), []);

  useEffect(() => {
    if (!engine || !surface.current) return;
    const timer = window.setTimeout(() => engine.formUI(surface.current!), 350);
    return () => window.clearTimeout(timer);
  }, [engine, state.error, hiddenAttempt, pending]);

  useEffect(() => {
    if (state.success) {
      router.refresh();
      return;
    }

    if (!state.error || state.attempt === hiddenAttempt) return;
    const timer = window.setTimeout(() => setHiddenAttempt(state.attempt), 2400);
    return () => window.clearTimeout(timer);
  }, [state, hiddenAttempt, router]);

  const visibleError = state.attempt === hiddenAttempt ? '' : state.error;

  return <main className={`experience password-gate ${engine ? 'canvas-ready' : 'canvas-pending'}`} ref={surface}>
    <ParticleCanvas onReady={setEngine} onError={handleCanvasError} />
    <header className="masthead">
      <span data-particle="text" className="wordmark">PARTICLEMESSAGE</span>
      <span data-particle="text" className="edition">WORTE IN BEWEGUNG</span>
    </header>
    <section className="landing password-panel">
      <p data-particle="text" className="eyebrow">GESCHÜTZTER BEREICH</p>
      <h1 data-particle="text">Nur für dich.</h1>
      <form action={action}>
        <label className="sr-only" htmlFor="site-password">Passwort</label>
        <div className="password-field" data-particle="box">
          <input id="site-password" name="password" type="password" autoComplete="current-password" placeholder="Passwort" required disabled={pending} data-particle="text" autoFocus />
        </div>
        <p className="password-error" data-particle="text" role="alert" aria-live="polite">{visibleError}</p>
        <button className="primary" data-particle="button" type="submit" disabled={pending}>{pending ? 'Wird geprüft …' : 'Öffnen ↗'}</button>
      </form>
    </section>
    <footer><span data-particle="text">PERSÖNLICH. FLÜCHTIG. BESONDERS.</span><span data-particle="text">01 — ∞</span></footer>
  </main>;
}
