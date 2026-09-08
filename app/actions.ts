'use server';

import { cookies } from 'next/headers';
import { ACCESS_COOKIE, createSessionToken, passwordMatches } from '@/lib/passwordAuth';

export interface PasswordState {
  success: boolean;
  error: string;
  attempt: number;
}

export async function unlockSite(_state: PasswordState, formData: FormData): Promise<PasswordState> {
  const configuredPassword = process.env.PARTICLE_MESSAGE_PASSWORD;
  const sessionSecret = process.env.PARTICLE_MESSAGE_SESSION_SECRET;
  const candidate = formData.get('password');

  if (!configuredPassword || !sessionSecret) {
    return { success: false, error: 'Passwortschutz ist nicht konfiguriert.', attempt: _state.attempt + 1 };
  }

  if (typeof candidate !== 'string' || !passwordMatches(candidate, configuredPassword)) {
    return { success: false, error: 'Falsches Passwort.', attempt: _state.attempt + 1 };
  }

  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE, createSessionToken(sessionSecret), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });

  return { success: true, error: '', attempt: _state.attempt };
}
