import 'server-only';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createServerClient as createServiceClient } from '@/lib/supabase/client';

function getSupabaseUrl() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!supabaseUrl) {
    throw new Error('Missing Supabase environment variables');
  }
  return supabaseUrl;
}

function getSupabaseAnonKey() {
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }
  return supabaseAnonKey;
}

export function createServerAuthClient() {
  const cookieStore = cookies();
  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set(name, value, options) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name, options) {
        cookieStore.set({ name, value: '', ...options, maxAge: 0 });
      },
    },
  });
}

export async function getAuthUserId(): Promise<string | null> {
  const supabase = createServerAuthClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user?.id ?? null;
}

export async function migrateAnonymousProjectsIfNeeded(userId: string | null, anonymousId: string | null) {
  if (!userId || !anonymousId) return;
  const supabase = createServiceClient();
  await supabase
    .from('projects')
    .update({ user_id: userId })
    .eq('anonymous_id', anonymousId)
    .is('user_id', null);
}
