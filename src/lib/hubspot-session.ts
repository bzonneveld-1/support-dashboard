import { supabase } from '@/lib/db';
import { generateTOTP } from '@/lib/totp';

interface HubSpotSession {
  cookies: string;
  csrf_token: string;
  created_at: string;
}

export interface OmnibusMetrics {
  all_open_tickets: number;
  unassigned_tickets: number;
  whatsapp_all_open: number;
  whatsapp_waiting_on_us: number;
  waiting_on_us: number;
}

const PORTAL_ID = '8214835';
const INBOX_ID = 3283369;
const CACHE_KEY = 'hubspot_inbox_session';

const VIEW_IDS = {
  whatsapp_all_open: 75278199,
  whatsapp_waiting_on_us: 311348153,
  waiting_on_us: 89515342,
} as const;

// ── Session cache (Supabase kv_store) ──────────────────────────

async function getCachedSession(): Promise<HubSpotSession | null> {
  try {
    const { data } = await supabase
      .from('kv_store')
      .select('value')
      .eq('key', CACHE_KEY)
      .single();
    if (!data) return null;
    return JSON.parse(data.value) as HubSpotSession;
  } catch {
    return null; // table doesn't exist yet or parse error — skip cache
  }
}

async function cacheSession(session: HubSpotSession): Promise<void> {
  try {
    await supabase
      .from('kv_store')
      .upsert(
        { key: CACHE_KEY, value: JSON.stringify(session), updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      );
  } catch {
    // cache failure is non-fatal — next call will just re-login
  }
}

async function clearCache(): Promise<void> {
  try {
    await supabase.from('kv_store').delete().eq('key', CACHE_KEY);
  } catch {
    // non-fatal
  }
}

// ── 3-step HubSpot login ───────────────────────────────────────

async function login(): Promise<HubSpotSession> {
  const email = process.env.HUBSPOT_EMAIL;
  const password = process.env.HUBSPOT_PASSWORD;
  const totpSecret = process.env.HUBSPOT_TOTP_SECRET;
  if (!email || !password || !totpSecret) {
    throw new Error('Missing HUBSPOT_EMAIL, HUBSPOT_PASSWORD, or HUBSPOT_TOTP_SECRET');
  }

  // Step 1: email + password
  const r1 = await fetch('https://app.hubspot.com/login-api/v1/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, rememberLogin: true }),
  });
  const b1 = await r1.json();

  if (b1.status === 'NEEDS_LOGIN_LINK') {
    throw new Error('NEEDS_LOGIN_LINK: HubSpot flagged this IP as suspicious.');
  }
  if (b1.status !== 'TWO_FACTOR_REQUIRED') {
    throw new Error(`Unexpected login status: ${b1.status}`);
  }

  // Step 2: TOTP 2FA
  const r2 = await fetch('https://app.hubspot.com/login-api/v1/login/verification-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      token: b1.token,
      verificationCode: generateTOTP(totpSecret),
      twoFactorLevel: 'PRIMARY',
      isBackupCodeRequest: false,
      shouldRememberThisDevice: true,
      rememberLogin: true,
    }),
    redirect: 'manual',
  });

  // Parse body (may be 200 or 302)
  const b2 = await r2.json().catch(() => null);
  const csrf = b2?.csrfToken as string | undefined;
  if (!csrf) {
    throw new Error(`No csrfToken in 2FA response (${r2.status})`);
  }

  // Extract cookies
  const setCookies = r2.headers.getSetCookie?.() ?? [];
  if (setCookies.length === 0) {
    throw new Error('No Set-Cookie headers from 2FA response');
  }
  const cookies = setCookies.map((c: string) => c.split(';')[0].trim()).join('; ');

  const session: HubSpotSession = { cookies, csrf_token: csrf, created_at: new Date().toISOString() };
  await cacheSession(session);
  return session;
}

// ── Omnibus call ───────────────────────────────────────────────

async function callOmnibus(session: HubSpotSession): Promise<Response> {
  return fetch(
    `https://app.hubspot.com/api/messages/v2/inbox/omnibus?early=true&historyLimit=30&membersLimit=50&maxPreviewLength=200&portalId=${PORTAL_ID}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': session.cookies,
        'x-hubspot-csrf-hubspotapi': session.csrf_token,
      },
      body: JSON.stringify({
        inboxId: INBOX_ID,
        threadId: null,
        customViewId: null,
        sortDirection: 'DESC',
        threadList: { threadListId: '1', threadListType: 'DEFAULT' },
        threadStatus: 'STARTED',
        serviceType: 'FANOUT',
      }),
    },
  );
}

function extractMetrics(data: Record<string, unknown>): OmnibusMetrics {
  const lists = (data.threadLists ?? []) as Array<{ internalName?: string; threadCount?: number }>;
  const views = (data.customViews ?? []) as Array<{ customViewId?: number; threadCount?: number }>;

  return {
    all_open_tickets: lists.find((l) => l.internalName === 'ALL_CONVERSATIONS')?.threadCount ?? 0,
    unassigned_tickets: lists.find((l) => l.internalName === 'UNASSIGNED')?.threadCount ?? 0,
    whatsapp_all_open: views.find((v) => v.customViewId === VIEW_IDS.whatsapp_all_open)?.threadCount ?? 0,
    whatsapp_waiting_on_us: views.find((v) => v.customViewId === VIEW_IDS.whatsapp_waiting_on_us)?.threadCount ?? 0,
    waiting_on_us: views.find((v) => v.customViewId === VIEW_IDS.waiting_on_us)?.threadCount ?? 0,
  };
}

// ── Public API ─────────────────────────────────────────────────

export async function getInboxMetrics(): Promise<OmnibusMetrics> {
  // Try cached session first
  let session = await getCachedSession();

  if (session) {
    const resp = await callOmnibus(session);
    if (resp.ok) {
      return extractMetrics(await resp.json());
    }
    // Session expired — clear and re-login
    await clearCache();
  }

  // Full login
  session = await login();
  const resp = await callOmnibus(session);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Omnibus failed after fresh login (${resp.status}): ${text.substring(0, 500)}`);
  }
  return extractMetrics(await resp.json());
}
