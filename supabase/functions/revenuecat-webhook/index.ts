// POST from RevenueCat on every purchase event (was POST /webhooks/revenuecat on Render).
// Deployed with verify_jwt = false: RevenueCat authenticates with the Authorization header
// configured in its dashboard, which must equal the REVENUECAT_WEBHOOK_AUTH secret.
import { billingConfig, handleWebhook, HttpError } from '../_shared/billing.ts';
import { adminClient, json } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  try {
    const result = await handleWebhook(adminClient(), billingConfig(), req.headers.get('Authorization'), body);
    return json(result);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error('RevenueCat webhook failed', e);
    return json({ error: 'Internal error' }, 500); // RevenueCat retries 5xx
  }
});