'use server';

export async function triggerBackfill(date: string, timeSlot: string) {
  const webhookUrl = process.env.N8N_BACKFILL_WEBHOOK_URL;
  if (!webhookUrl) {
    return { success: false, error: 'Webhook URL not configured' };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_date: date, target_time: timeSlot, collect_mode: 'daily_totals' }),
    });
    return { success: res.ok };
  } catch {
    return { success: false, error: 'Failed to trigger backfill' };
  }
}

/**
 * Laat de collector nu draaien in plaats van te wachten op zijn ronde.
 * Server-side, zodat de webhook-URL niet in de pagina belandt.
 */
export async function triggerTargetSync() {
  const webhookUrl = process.env.N8N_SUBS_TARGET_WEBHOOK_URL
    ?? 'https://havenka.app.n8n.cloud/webhook/sd-subs-target';

  try {
    const res = await fetch(webhookUrl, { cache: 'no-store' });
    return { success: res.ok };
  } catch {
    return { success: false };
  }
}
