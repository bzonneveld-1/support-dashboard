'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import crypto from 'crypto';
import { AUTH_COOKIE_NAME, AUTH_COOKIE_MAX_AGE, createSessionToken } from '@/lib/auth';

export interface LoginState {
  error: string;
}

function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const password = formData.get('password') as string;
  const redirectTo = (formData.get('redirect') as string) || '/';

  const secret = process.env.DASHBOARD_SECRET;
  if (!secret) {
    return { error: 'Authentication not configured' };
  }

  if (!password || !timingSafeCompare(password, secret)) {
    return { error: 'Incorrect password' };
  }

  const token = await createSessionToken(secret);
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: AUTH_COOKIE_MAX_AGE,
    path: '/',
  });

  const safePath = redirectTo.startsWith('/') ? redirectTo : '/';
  redirect(safePath);
}
