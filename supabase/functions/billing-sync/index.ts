// POST from the app right after a purchase or restore (was POST /billing/sync on Render),
// so Premium unlocks without waiting for the webhook. Requires the user's session.
import { billingConfig, syncUser } from '../_shared/billing.ts';
import { adminClient, json, userFromRequest } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const admin = adminClient();
  const user = await userFromRequest(req, admin);
  if (!user) return json({ error: 'Unauthorized' }, 401);
  try {
    return json(await syncUser(admin, billingConfig(), user.id));
  } catch (e) {
    console.error(`Billing sync failed for ${user.id}`, e);
    return json({ error: 'Could not check your purchase right now.' }, 502);
  }
});