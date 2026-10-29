// Hourly safety net for missed EXPIRATION webhooks (was the @Cron EVERY_HOUR job on Render).
// Called by pg_cron through pg_net with the x-cron-secret header; deployed with verify_jwt = false.
import { billingConfig, expireLapsedPlans } from '../_shared/billing.ts';
import { adminClient, env, json, secretsMatch } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const expected = env('CRON_SECRET');
  if (!expected || !(await secretsMatch(req.headers.get('x-cron-secret') ?? '', expected))) {
    return json({ error: 'Unauthorized' }, 401);
  }
  try {
    const result = await expireLapsedPlans(adminClient(), billingConfig());
    console.log(`Expiry check complete: ${result.checked} checked`);
    return json(result);
  } catch (e) {
    console.error('Expiry check failed', e);
    return json({ error: 'Internal error' }, 500);
  }
});