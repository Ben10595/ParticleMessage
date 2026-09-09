import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
export const ACCESS_COOKIE = 'particle_message_access';
export const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
function digest(value: string, secret: string) { return createHmac('sha256', secret).update(value).digest(); }
export function passwordMatches(candidate: string, password: string) { return timingSafeEqual(digest(candidate, password), digest(password, password)); }
export function createSessionToken(secret: string, now = Date.now()) {
  const payload = `v2.${now + SESSION_LIFETIME_MS}.${randomBytes(18).toString('base64url')}`;
  return `${payload}.${digest(payload, secret).toString('base64url')}`;
}
export function sessionTokenMatches(candidate: string | undefined, secret: string, now = Date.now()) {
  if (!candidate || candidate.length > 256) return false;
  const [version, expiry, nonce, signature, extra] = candidate.split('.');
  const deadline = Number(expiry);
  if (version !== 'v2' || !nonce || !signature || extra !== undefined || !Number.isFinite(deadline) || deadline <= now || deadline > now + SESSION_LIFETIME_MS) return false;
  const expected = digest(`${version}.${expiry}.${nonce}`, secret);
  const actual = Buffer.from(signature, 'base64url');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
