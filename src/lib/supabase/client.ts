import { createClient } from '@supabase/supabase-js';

// Client-side Supabase client (uses anon key, respects RLS)
export function createBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseAnonKey);
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
  const data = `${randomPart}:${timestamp}`;
  const expectedSignature = crypto.createHmac('sha256', secret).update(data).digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}
