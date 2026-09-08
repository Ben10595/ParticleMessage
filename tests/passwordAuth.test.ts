import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken, passwordMatches, sessionTokenMatches } from '../lib/passwordAuth';

test('checks the configured password exactly', () => {
  assert.equal(passwordMatches('Ben10', 'Ben10'), true);
  assert.equal(passwordMatches('ben10', 'Ben10'), false);
  assert.equal(passwordMatches('', 'Ben10'), false);
});

test('accepts only a token signed with the current session secret', () => {
  const token = createSessionToken('secret-one');
  assert.equal(sessionTokenMatches(token, 'secret-one'), true);
  assert.equal(sessionTokenMatches(token, 'secret-two'), false);
  assert.equal(sessionTokenMatches(undefined, 'secret-one'), false);
  assert.equal(sessionTokenMatches('invalid', 'secret-one'), false);
});
