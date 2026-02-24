export const AUTH_COOKIE_NAME = 'dash_session';
export const AUTH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

const HMAC_MESSAGE = 'dashboard-session-v1';

export async function createSessionToken(secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(HMAC_MESSAGE));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifySessionToken(token: string, secret: string): Promise<boolean> {
  const expected = await createSessionToken(secret);
  if (token.length !== expected.length) return false;
  // Timing-safe compare via HMAC of both values with a random key
  const key = await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const encoder = new TextEncoder();
  const [sigA, sigB] = await Promise.all([
    crypto.subtle.sign('HMAC', key, encoder.encode(token)),
    crypto.subtle.sign('HMAC', key, encoder.encode(expected)),
  ]);
  const a = new Uint8Array(sigA);
  const b = new Uint8Array(sigB);
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];
  return result === 0;
}
