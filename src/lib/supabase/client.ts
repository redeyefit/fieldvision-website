import { createClient } from '@supabase/supabase-js';
import { createBrowserClient as createBrowserAuthClient } from '@supabase/ssr';

// Client-side Supabase client (uses anon key, respects RLS)
export function createBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

// Client-side Supabase auth client (uses anon key + cookies).
// MUST be a module-level singleton: creating multiple GoTrueClient instances on
// the same storage key makes them contend for the shared navigator.locks auth
// lock. Under React StrictMode's dev double-mount, a per-mount client deadlocks
// getSession() (lock held, never released) and the app hangs on "Loading...".
// One instance app-wide avoids that and is the recommended @supabase/ssr pattern.
let browserAuthClient: ReturnType<typeof createBrowserAuthClient> | null = null;

export function createAuthClient() {
  if (browserAuthClient) return browserAuthClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  browserAuthClient = createBrowserAuthClient(supabaseUrl, supabaseAnonKey);
  return browserAuthClient;
}

// Server-side Supabase client with service role (bypasses RLS)
// Only use in API routes, never expose to client
export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

// Generate HMAC-signed anonymous ID for users without accounts
// This allows anonymous users to "own" their projects securely
import crypto from 'crypto';

export function generateAnonymousId(): string {
  const secret = process.env.ANONYMOUS_ID_SECRET || 'default-secret-change-in-production';
  const randomPart = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now().toString();
  const data = `${randomPart}:${timestamp}`;
  const signature = crypto.createHmac('sha256', secret).update(data).digest('hex');
  return `${data}:${signature}`;
}

export function verifyAnonymousId(anonymousId: string): boolean {
  const secret = process.env.ANONYMOUS_ID_SECRET || 'default-secret-change-in-production';
  const parts = anonymousId.split(':');
  if (parts.length !== 3) return false;

  const [randomPart, timestamp, signature] = parts;

  // Guard: a valid HMAC-SHA256 signature is exactly 64 hex chars (32 bytes).
  // Without this, a malformed signature makes the two buffers differ in length
  // and crypto.timingSafeEqual THROWS a RangeError (→ a 500 instead of a clean
  // false). Validate before the length-sensitive compare so we always fail closed.
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false;

  const data = `${randomPart}:${timestamp}`;
  const expectedSignature = crypto.createHmac('sha256', secret).update(data).digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}
