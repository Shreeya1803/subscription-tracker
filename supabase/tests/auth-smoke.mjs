// Phase 1 end-to-end check against a real Supabase project.
// Signs up a new user, confirms it with the emailed code, checks the profile row and its
// protections, then runs the forgot-password flow with a second emailed code.
//
// Usage (from the supabase folder):
//   npm install
//   $env:SUPABASE_URL="https://<project-ref>.supabase.co"
//   $env:SUPABASE_ANON_KEY="<publishable / anon key>"
//   node tests/auth-smoke.mjs you@example.com
//
// Use an email inbox you can read. Only the publishable (anon) key is used: never the service_role key.
import { createClient } from '@supabase/supabase-js';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
const email = process.argv[2];
if (!url || !key || !email) {
  console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY, and pass an email: node tests/auth-smoke.mjs you@example.com');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const rl = readline.createInterface({ input: stdin, output: stdout });
const ask = async (q) => (await rl.question(q)).trim();
const ok = (msg) => console.log(`  PASS ${msg}`);
const fail = (msg) => { console.error(`  FAIL ${msg}`); rl.close(); process.exit(1); };

const password1 = `Test-${Math.random().toString(36).slice(2, 10)}`;
const password2 = `Test-${Math.random().toString(36).slice(2, 10)}`;

console.log(`\n1. Sign up ${email}`);
{
  const { data, error } = await supabase.auth.signUp({
    email,
    password: password1,
    options: { data: { display_name: 'Smoke Test', default_currency: 'INR' } },
  });
  if (error) fail(`sign up: ${error.message}`);
  if (data.session) fail('signed in without confirming email: turn ON "Confirm email" in Auth settings');
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    fail('this email is already registered: use a new address, or delete the user in Authentication -> Users');
  }
  ok('account created, waiting for email confirmation');
}

{
  const { error } = await supabase.auth.signInWithPassword({ email, password: password1 });
  if (!error) fail('could log in before confirming email');
  ok(`login blocked before confirmation ("${error.message}")`);
}

console.log('\n2. Confirm the email');
{
  const token = await ask('  Enter the 6-digit code from the "Confirm your email" message: ');
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
  if (error) fail(`confirm: ${error.message}`);
  if (!data.session) fail('no session after confirming');
  ok('email confirmed and signed in');
}

console.log('\n3. Profile row and its protections');
{
  const { data: me, error } = await supabase.auth.getUser();
  if (error) fail(error.message);
  const { data: rows, error: e2 } = await supabase.from('users').select('*');
  if (e2) fail(`read profile: ${e2.message}`);
  if (rows.length !== 1 || rows[0].id !== me.user.id) fail(`expected exactly my own row, got ${rows.length}`);
  const p = rows[0];
  if (p.display_name !== 'Smoke Test' || p.default_currency !== 'INR' || p.premium_status !== 'free') {
    fail(`unexpected profile ${JSON.stringify(p)}`);
  }
  ok('profile created from sign-up data (Smoke Test, INR, free)');

  const { error: e3 } = await supabase.from('users').update({ display_name: 'Smoke Test 2' }).eq('id', me.user.id);
  if (e3) fail(`edit name: ${e3.message}`);
  ok('can edit own display name');

  const { error: e4 } = await supabase.from('users').update({ premium_status: 'lifetime' }).eq('id', me.user.id);
  if (!e4) fail('was able to give myself premium!');
  ok(`cannot set premium_status ("${e4.message}")`);

  const { data: subs, error: e5 } = await supabase.from('subscriptions').select('id');
  if (e5) fail(`read subscriptions: ${e5.message}`);
  if (subs.length !== 0) fail('subscriptions table should be locked until Phase 2');
  ok('subscriptions locked until Phase 2');
}
await supabase.auth.signOut();

console.log('\n4. Forgot password');
{
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) fail(`request reset: ${error.message}`);
  const token = await ask('  Enter the 6-digit code from the "Reset your password" message: ');
  const { error: e2 } = await supabase.auth.verifyOtp({ email, token, type: 'recovery' });
  if (e2) fail(`verify reset code: ${e2.message}`);
  const { error: e3 } = await supabase.auth.updateUser({ password: password2 });
  if (e3) fail(`set new password: ${e3.message}`);
  await supabase.auth.signOut();
  ok('new password set with the emailed code');

  const { error: e4 } = await supabase.auth.signInWithPassword({ email, password: password1 });
  if (!e4) fail('old password still works');
  const { error: e5 } = await supabase.auth.signInWithPassword({ email, password: password2 });
  if (e5) fail(`new password login: ${e5.message}`);
  ok('old password rejected, new password works');
  await supabase.auth.signOut();
}

console.log('\nAll Phase 1 checks passed. You can delete this test user in Authentication -> Users.\n');
rl.close();