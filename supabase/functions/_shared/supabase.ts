// Shared helpers for the Edge Functions: the server-side (service role) client,
// reading the signed-in user from a request, and JSON responses.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0';

export type Admin = SupabaseClient;

export function env(name: string): string | undefined {
  const v = Deno.env.get(name);
  return v && v.trim() ? v.trim() : undefined;
}

/** Server-side key. Supabase provides it to every Edge Function automatically. Never sent to the app. */
function serviceKey(): string {
  const legacy = env('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  const keys = env('SUPABASE_SECRET_KEYS'); // newer projects: JSON map of secret keys
  if (keys) {
    try {
      const parsed = JSON.parse(keys) as Record<string, string>;
      const key = parsed.default ?? Object.values(parsed)[0];
      if (key) return key;
    } catch {
      /* fall through */
    }
  }
  throw new Error('No service role / secret key available to the Edge Function');
}

export function adminClient(): Admin {
  return createClient(env('SUPABASE_URL')!, serviceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** The signed-in user who called this function (from the app's session token), or null. */
export async function userFromRequest(req: Request, admin: Admin): Promise<{ id: string; email?: string } | null> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? undefined };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Constant-time comparison of two secrets (hashing first makes lengths equal). */
export async function secretsMatch(received: string, expected: string): Promise<boolean> {
  if (!received || !expected) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(received)),
    crypto.subtle.digest('SHA-256', enc.encode(expected)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}