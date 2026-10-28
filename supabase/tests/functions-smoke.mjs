// Phase 3 check against a real Supabase project: the app functions called through supabase.rpc().
// Uses the same confirmed FREE test user as data-smoke.mjs. Premium-only checks expect 403.
//
// Usage (from the supabase folder, with SUPABASE_URL and SUPABASE_ANON_KEY set):
//   node tests/functions-smoke.mjs test@example.com TheTestPassword
import { createClient } from '@supabase/supabase-js';

const [email, password] = process.argv.slice(2);
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !email || !password) {
  console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY, then: node tests/functions-smoke.mjs <email> <password>');
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
await supabase.from('subscriptions').delete().eq('user_id', userId);

const inDays = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const { data: subs, error: addError } = await supabase.from('subscriptions').insert([
  { name: 'Netflix', amount: 649, currency: 'INR', billing_cycle: 'monthly', next_renewal: inDays(5), category: 'entertainment', reminder_days_before: 2 },
  { name: 'Domain', amount: 1200, currency: 'INR', billing_cycle: 'yearly', next_renewal: inDays(60), category: 'work', reminder_days_before: 7 },
]).select();
if (addError) fail(`add: ${addError.message}`);
const netflix = subs.find((s) => s.name === 'Netflix');

console.log('\nDashboard');
{
  const { data, error } = await supabase.rpc('dashboard_summary');
  if (error) fail(`summary: ${error.message}`);
  // 649 + 1200/12 = 749
  if (Number(data.monthly_total) !== 749 || Number(data.annual_total) !== 8988) fail(`totals ${JSON.stringify(data)}`);
  if (data.upcoming_renewals.length !== 1 || data.upcoming_renewals[0].name !== 'Netflix') fail('upcoming renewals');
  ok(`summary: ${data.monthly_total}/month, ${data.annual_total}/year, 1 upcoming renewal`);
}
for (const fn of ['dashboard_trends', 'dashboard_unused']) {
  const { error, status } = await supabase.rpc(fn);
  if (!error || error.code !== 'PT403' || status !== 403) fail(`${fn} should be 403 for free users, got ${status} ${error?.code}`);
  ok(`${fn}: 403 for free users ("${error.message}")`);
}

console.log('\nSubscription actions');
{
  const { data, error } = await supabase.rpc('mark_subscription_used', { p_subscription_id: netflix.id });
  if (error || !data.last_used_date) fail(`mark used: ${error?.message}`);
  ok(`mark used: last_used_date = ${data.last_used_date}`);
}
{
  const { data, error } = await supabase.rpc('cancel_subscription', { p_subscription_id: netflix.id });
  if (error || data.status !== 'canceled') fail(`cancel: ${error?.message}`);
  const { data: summary } = await supabase.rpc('dashboard_summary');
  if (Number(summary.total_monthly_saved) !== 649 || Number(summary.monthly_total) !== 100) fail(`after cancel ${JSON.stringify(summary)}`);
  ok('cancel: status canceled, 649/month saved, monthly total now 100');
}
{
  const { error, status } = await supabase.rpc('cancel_subscription', { p_subscription_id: netflix.id });
  if (!error || status !== 409) fail(`second cancel should be 409, got ${status}`);
  ok('cancel again: 409');
}
{
  const { error, status } = await supabase.rpc('cancel_subscription', { p_subscription_id: '00000000-0000-0000-0000-000000000000' });
  if (!error || status !== 404) fail(`unknown id should be 404, got ${status}`);
  ok('cancel unknown subscription: 404');
}

console.log('\nExport');
{
  const { data, error } = await supabase.rpc('export_my_data');
  if (error) fail(`export: ${error.message}`);
  if (data.user.email !== email.toLowerCase() || data.subscriptions.length !== 2 || data.saved_events.length !== 1) {
    fail(`export contents ${JSON.stringify({ user: data.user?.email, subs: data.subscriptions?.length, saved: data.saved_events?.length })}`);
  }
  if (JSON.stringify(data).includes('password')) fail('export contains password data');
  ok('export: profile, 2 subscriptions, 1 saved event, no credentials');
}

await supabase.from('subscriptions').delete().eq('user_id', userId);
await supabase.auth.signOut();
console.log('\nAll Phase 3 API checks passed (test data cleaned up).\n');