import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { rateLimit } from '@/lib/rate-limit';

// Rate limits per endpoint pattern (requests per window)
const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  // AI-heavy endpoints — tight limits
  '/api/schedule/ask-general': { max: 10, windowMs: 60_000 },        // 10/min
  'parse': { max: 5, windowMs: 60_000 },                             // 5/min (PDF + Gemini)
  'generate': { max: 5, windowMs: 60_000 },                          // 5/min (Claude)
  'ask': { max: 15, windowMs: 60_000 },                              // 15/min (Ask the Field)
  // Project creation — moderate
  '/api/schedule': { max: 20, windowMs: 60_000 },                    // 20/min
};

function getRateLimitKey(pathname: string): string | null {
  if (pathname === '/api/schedule/ask-general') return '/api/schedule/ask-general';
  if (pathname.match(/^\/api\/schedule\/[^/]+\/parse$/)) return 'parse';
  if (pathname.match(/^\/api\/schedule\/[^/]+\/generate$/)) return 'generate';
  if (pathname.match(/^\/api\/schedule\/[^/]+\/ask$/)) return 'ask';
  if (pathname === '/api/schedule') return '/api/schedule';
  return null;
}

export async function middleware(request: NextRequest) {
  // Rate limiting for API routes
  if (request.nextUrl.pathname.startsWith('/api/schedule') && request.method === 'POST') {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';
    const limitKey = getRateLimitKey(request.nextUrl.pathname);

    if (limitKey) {
      const limit = RATE_LIMITS[limitKey];
      if (limit) {
        const result = rateLimit(ip, limitKey, limit.max, limit.windowMs);
        if (result) {
          return NextResponse.json(
            { error: 'Too many requests. Please try again later.' },
            {
              status: 429,
              headers: { 'Retry-After': String(result.retryAfter) },
            }
          );
        }
      }
    }
  }

  // Supabase auth refresh
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name) {
        return request.cookies.get(name)?.value;
      },
      set(name, value, options) {
        response.cookies.set({ name, value, ...options });
      },
      remove(name, options) {
        response.cookies.set({ name, value: '', ...options, maxAge: 0 });
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  // Protected routes — redirect to /auth if not authenticated
  const isProtectedRoute = request.nextUrl.pathname === '/schedule';
  if (isProtectedRoute && !user) {
    // Allow if user has anonymous ID cookie/header (anonymous schedule access)
    const hasAnonymousId = request.headers.get('x-anonymous-id')
      || request.cookies.get('fieldvision_anonymous_id');
    if (!hasAnonymousId) {
      // Don't redirect if it has a project ID (direct link access)
      const hasProjectId = request.nextUrl.searchParams.has('id');
      if (!hasProjectId) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = '/auth';
        return NextResponse.redirect(redirectUrl);
      }
    }
  }

  // Redirect authenticated users away from /auth
  if (request.nextUrl.pathname === '/auth' && user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/schedule';
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
};
