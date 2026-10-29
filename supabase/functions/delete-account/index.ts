// POST from the app's Settings > Delete account (was DELETE /user on Render).
// Deleting the Supabase Auth user removes every row that belongs to it (ON DELETE CASCADE).
// The RevenueCat customer record is deleted too (best effort), so no purchase data is kept.
import { adminClient, env, json, userFromRequest } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const admin = adminClient();
  const user = await userFromRequest(req, admin);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error(`Delete account failed for ${user.id}: ${error.message}`);
    return json({ error: 'Could not delete the account.' }, 500);
  }

  const rcKey = env('REVENUECAT_SECRET_KEY');
  if (rcKey) {
    try {
      const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(user.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${rcKey}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok && res.status !== 404) console.warn(`RevenueCat delete for ${user.id} responded ${res.status}`);
    } catch (e) {
      console.warn(`RevenueCat delete for ${user.id} failed: ${(e as Error).message}`);
    }
  }

  console.log(`Account ${user.id} deleted`);
  return json({ message: 'Account and all associated data have been deleted.' });
});