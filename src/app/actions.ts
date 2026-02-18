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
      body: JSON.stringify({ target_date: date, target_time: timeSlot }),
    });
    return { success: res.ok };
  } catch {
    return { success: false, error: 'Failed to trigger backfill' };
  }
}
