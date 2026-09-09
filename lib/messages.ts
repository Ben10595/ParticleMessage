import { getSupabase } from './supabase';
import { isMessageExpired, LINK_LIFETIME_MS } from './playback';
export class MessageExpiredError extends Error { constructor() { super('Dieser Link ist abgelaufen.'); this.name = 'MessageExpiredError'; } }
import { validateMessage, type MessageContent } from '@/types/message';
export const SLUG_PATTERN = /^[A-Za-z0-9_-]{8,32}$/;
export function generateSlug() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) => alphabet[byte & 63]).join('');
}
export async function insertWithRetry(content: MessageContent, insert: (slug: string, content: MessageContent) => PromiseLike<{ error: { code?: string; message?: string } | null }>, randomSlug = generateSlug) {
  const validated = validateMessage(content);
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = randomSlug();
    const { error } = await insert(slug, validated);
    if (!error) return slug;
    if (error.code !== '23505') throw new Error('Die Nachricht konnte nicht gespeichert werden. Bitte prüfe die Verbindung und versuche es erneut.');
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
