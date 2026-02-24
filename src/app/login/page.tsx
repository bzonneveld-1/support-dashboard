'use client';

import { useActionState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { loginAction, type LoginState } from './actions';

const initialState: LoginState = { error: '' };

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <div className="h-screen flex items-center justify-center bg-[var(--dash-bg)]">
      <div className="w-full max-w-sm px-6">
        <div className="flex justify-center mb-8">
          <img src="/bold-logo.png" alt="Bold" className="nav-logo-dark h-8 w-auto" />
          <img src="/bold-logo-white.png" alt="Bold" className="nav-logo-white hidden h-8 w-auto" />
        </div>

        <h1 className="text-center text-lg font-semibold text-[var(--dash-text)] mb-6">
          Support Dashboard
        </h1>

        <form action={formAction}>
          <input type="hidden" name="redirect" value={redirectTo} />

          <input
            type="password"
            name="password"
            placeholder="Password"
            required
            autoFocus
            className="w-full px-4 py-3 rounded-xl bg-[var(--dash-surface)] border border-[var(--dash-border)] text-[var(--dash-text)] placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#007AFF] text-sm"
          />

          {state.error && (
            <p className="mt-2 text-sm text-[#FF3B30]">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full mt-4 py-3 rounded-xl bg-[#007AFF] text-white text-sm font-medium hover:bg-[#0071E3] transition-colors disabled:opacity-50"
          >
            {isPending ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
