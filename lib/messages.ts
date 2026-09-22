import { getSupabase } from './supabase';
import { isMessageExpired, LINK_LIFETIME_MS } from './playback';
export class MessageExpiredError extends Error { constructor() { super('Dieser Link ist abgelaufen.'); this.name = 'MessageExpiredError'; } }
import { validateMessage, type MessageContent } from '@/types/message';
export const SLUG_PATTERN = /^[A-Za-z0-9_-]{8,32}$/;
export function generateSlug() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) => alphabet[byte & 63]).join('');
}
interface StorageError { code?: string; message?: string; status?: number }
function storageErrorMessage(error: StorageError) {
  const code = error.code ?? '';
  const detail = `${error.message ?? ''} ${error.status ?? ''}`.toLowerCase();
  if (code === '42501') return 'Supabase verweigert das Speichern. Prüfe die INSERT-Richtlinie (RLS) für public.messages.';
  if (code === '42P01' || code === 'PGRST205') return 'Die Supabase-Tabelle public.messages fehlt oder ist für die API nicht verfügbar.';
  if (error.status === 401 || error.status === 403) return 'Supabase lehnt die Verbindung ab. Prüfe, ob Project URL und Publishable Key aus demselben Projekt stammen.';
  if (/fetch failed|failed to fetch|network|timeout|abort/.test(detail)) return 'Supabase ist nicht erreichbar. Prüfe die aktive NEXT_PUBLIC_SUPABASE_URL und deine Internetverbindung; starte danach den Entwicklungsserver neu.';
  if (error.status && error.status >= 500) return 'Supabase meldet gerade einen Serverfehler. Bitte versuche es später erneut.';
  return `Die Nachricht konnte nicht gespeichert werden. Prüfe Supabase${code ? ` (Fehler ${code})` : ''} und versuche es erneut.`;
}

export async function insertWithRetry(content: MessageContent, insert: (slug: string, content: MessageContent) => PromiseLike<{ error: StorageError | null }>, randomSlug = generateSlug) {
  const validated = validateMessage(content);
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = randomSlug();
    const { error } = await insert(slug, validated);
    if (!error) return slug;
    if (error.code !== '23505') throw new Error(storageErrorMessage(error));
  }
  throw new Error('Es konnte kein freier Link erzeugt werden. Bitte versuche es erneut.');
}
export async function saveMessage(content: MessageContent) {
  const client = getSupabase();
  return insertWithRetry(content, (slug, data) => client.from('messages').insert({ slug, content: data }).abortSignal(AbortSignal.timeout(15000)));
}
export async function loadMessage(slug: string, signal?: AbortSignal): Promise<(MessageContent & { expiresAt: number }) | null> {
  if (!SLUG_PATTERN.test(slug)) return null;
  const { data, error } = await getSupabase().from('messages').select('content,created_at').eq('slug', slug).abortSignal(signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000)).single();
  if (error?.code === 'PGRST116') return null;
  if (error) throw new Error('Die Nachricht konnte nicht geladen werden. Bitte versuche es erneut.');
  if (isMessageExpired(data?.created_at)) throw new MessageExpiredError();
  return { ...validateMessage(data?.content), expiresAt: Date.parse(data.created_at) + LINK_LIFETIME_MS };
}
