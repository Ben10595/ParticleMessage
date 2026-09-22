'use client';
import { useActionState, useEffect } from 'react';
import { unlockSite, type PasswordState } from '@/app/actions';
const initialState: PasswordState = { success: false, error: '', attempt: 0 };
export default function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [state, action, pending] = useActionState(unlockSite, initialState);
  useEffect(() => { if (state.success) onUnlock(); }, [state.success, onUnlock]);
  return <section className="landing password-panel">
    <div className="password-copy">
      <p className="eyebrow"><span className="signal-mark" aria-hidden="true" /> GESCHÜTZTER ZUGANG</p>
      <h1>Zugang zum<br />Message Core.</h1>
      <p className="intro">Dieser Bereich ist privat. Gib dein Passwort ein, um den Composer zu öffnen.</p>
    </div>
    <form action={action}>
      <label className="sr-only" htmlFor="site-password">Passwort</label>
      <div className="password-field"><span aria-hidden="true">⌁</span><input id="site-password" name="password" type="password" autoComplete="current-password" placeholder="Passwort" required disabled={pending} autoFocus /></div>
      <p className="password-error" role="alert">{state.error}</p>
      <button className="primary" type="submit" disabled={pending}>{pending ? 'Core wird geöffnet …' : 'Öffnen'} <span aria-hidden="true">↗</span></button>
    </form>
  </section>;
}
