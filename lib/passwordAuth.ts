import { createHmac, timingSafeEqual } from 'node:crypto';

export const ACCESS_COOKIE = 'particle_message_access';
const SESSION_VALUE = 'particle-message-access-v1';

function digest(value: string, secret: string) {
  return createHmac('sha256', secret).update(value).digest();
}

export function passwordMatches(candidate: string, password: string) {
  return timingSafeEqual(digest(candidate, password), digest(password, password));
}

export function createSessionToken(secret: string) {
  return digest(SESSION_VALUE, secret).toString('base64url');
}

export function sessionTokenMatches(candidate: string | undefined, secret: string) {
  if (!candidate) return false;

  const expected = createSessionToken(secret);
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);

  return candidateBuffer.length === expectedBuffer.length && timingSafeEqual(candidateBuffer, expectedBuffer);
}
