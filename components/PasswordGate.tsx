'use client';
import { useActionState, useEffect } from 'react';
import { unlockSite, type PasswordState } from '@/app/actions';
const initialState: PasswordState = { success: false, error: '', attempt: 0 };
export default function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [state, action, pending] = useActionState(unlockSite, initialState);
  useEffect(() => { if (state.success) onUnlock(); }, [state.success, onUnlock]);
  return <section className="landing password-panel">
    <p data-particle="text" className="eyebrow">EIN RAUM FÜR DEINE WORTE</p>
    <h1 data-particle="hero">Nur für dich.</h1>
    <form action={action}>
      <label className="sr-only" htmlFor="site-password">Passwort</label>
      <div data-particle="frame" className="password-field"><input id="site-password" name="password" type="password" autoComplete="current-password" placeholder="Dein Passwort" required disabled={pending} autoFocus /></div>
      <p data-particle="text" className="password-error" role="alert">{state.error}</p>
      <button data-particle="button" className="primary" type="submit" disabled={pending}>{pending ? 'Ein Moment …' : 'Öffnen'}</button>
    </form>
  </section>;
}
