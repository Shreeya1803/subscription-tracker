// Phase 2 check against a real Supabase project, through the same API the app will use.
// Needs a confirmed FREE test user (Authentication -> Users -> Add user -> Create new user,
// tick "Auto Confirm User"). The script deletes that user's subscriptions first.
//
// Usage (from the supabase folder, with SUPABASE_URL and SUPABASE_ANON_KEY set):
//   node tests/data-smoke.mjs test@example.com TheTestPassword
import { createClient } from '@supabase/supabase-js';

const [email, password] = process.argv.slice(2);
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !email || !password) {
  console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY, then: node tests/data-smoke.mjs <email> <password>');
  process.exit(1);
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
const ok = (m) => console.log(`  PASS ${m}`);
const fail = (m) => { console.error(`  FAIL ${m}`); process.exit(1); };

const { data: auth, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
if (loginError) fail(`login: ${loginError.message}`);
const userId = auth.user.id;

const { data: me } = await supabase.from('users').select('premium_status').single();
if (me?.premium_status !== 'free') fail(`test user must be on the free plan (is ${me?.premium_status})`);

await supabase.from('subscriptions').delete().eq('user_id', userId);

const sub = (name, extra = {}) => ({
  name, amount: 4.99, currency: 'INR', billing_cycle: 'monthly',
  next_renewal: new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10),
  category: 'entertainment', reminder_days_before: 3, ...extra,
});

console.log('\nSubscriptions');
for (const n of ['One', 'Two', 'Three']) {
  const { error } = await supabase.from('subscriptions').insert(sub(n));
  if (error) fail(`add ${n}: ${error.message}`);
}
ok('free user added 3 subscriptions');

{
  const { error, status } = await supabase.from('subscriptions').insert(sub('Four'));
  if (!error) fail('4th subscription was allowed on the free plan');
  if (error.code !== 'PT403' || status !== 403) fail(`expected PT403/403, got ${error.code}/${status}: ${error.message}`);
  ok(`4th blocked: HTTP ${status}, code ${error.code}, "${error.message}"`);
}

{
  const { error } = await supabase.from('subscriptions').insert(sub('Bad', { billing_cycle: 'custom' }));
  if (!error) fail('custom cycle without days accepted');
  ok(`invalid data rejected (${error.code}: ${error.message.split('"')[1] ?? error.message})`);
}

{
  const { data, error } = await supabase.from('subscriptions').update({ name: 'One (edited)' }).eq('name', 'One').select();
  if (error || data.length !== 1) fail(`edit: ${error?.message}`);
  ok('edit own subscription');
}

{
  const { error } = await supabase.from('subscriptions').update({ status: 'canceled' }).eq('name', 'Two');
  if (!error) fail('status changed directly');
  ok('status cannot be changed directly (cancel comes in Phase 3)');
}

{
  const { data, error } = await supabase.from('subscriptions').select('name').order('name');
  if (error || data.length !== 3) fail(`list: ${error?.message} (${data?.length})`);
  ok(`list returns only my 3: ${data.map((d) => d.name).join(', ')}`);
}

await supabase.from('subscriptions').delete().eq('user_id', userId);
await supabase.auth.signOut();
console.log('\nAll Phase 2 API checks passed (test subscriptions cleaned up).\n');