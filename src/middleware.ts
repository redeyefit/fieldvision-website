import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { rateLimit } from '@/lib/rate-limit';

// Fail-closed default for any AI-family POST that matches no specific key below.
// Ensures a NEW paid endpoint is never silently uncapped — conservative, well
// above legitimate interactive use but a hard ceiling on abuse.
const DEFAULT_AI_LIMIT_KEY = 'ai-default';

// Rate limits per endpoint pattern (requests per window)
const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  // AI-heavy endpoints — tight limits
  '/api/schedule/ask-general': { max: 10, windowMs: 60_000 },        // 10/min
  'parse': { max: 5, windowMs: 60_000 },                             // 5/min (PDF + Gemini)
  'parse-import': { max: 5, windowMs: 60_000 },                      // 5/min (PDF + Gemini)
  'import': { max: 5, windowMs: 60_000 },                            // 5/min (Claude inferDependencies)
  'generate': { max: 5, windowMs: 60_000 },                          // 5/min (Claude)
  'ask': { max: 15, windowMs: 60_000 },                              // 15/min (Ask the Field)
  'reports-generate': { max: 5, windowMs: 60_000 },                  // 5/min (Claude)
  // Project creation — moderate
  '/api/schedule': { max: 20, windowMs: 60_000 },                    // 20/min
  // Fail-closed default — any unmatched AI-family POST
  [DEFAULT_AI_LIMIT_KEY]: { max: 30, windowMs: 60_000 },             // 30/min
};

function getRateLimitKey(pathname: string): string {
  if (pathname === '/api/schedule/ask-general') return '/api/schedule/ask-general';
  if (pathname.match(/^\/api\/schedule\/[^/]+\/parse$/)) return 'parse';
  if (pathname.match(/^\/api\/schedule\/[^/]+\/parse-import$/)) return 'parse-import';
  if (pathname.match(/^\/api\/schedule\/[^/]+\/import$/)) return 'import';
  if (pathname.match(/^\/api\/schedule\/[^/]+\/generate$/)) return 'generate';
  if (pathname.match(/^\/api\/schedule\/[^/]+\/ask$/)) return 'ask';
  if (pathname === '/api/schedule') return '/api/schedule';
  if (pathname === '/api/reports/generate') return 'reports-generate';
  // Unmatched AI-family POST → fail-closed default, never unlimited.
  return DEFAULT_AI_LIMIT_KEY;
}

export async function middleware(request: NextRequest) {
  // Rate limiting for paid AI-family API routes (POST only).
  // Scoped to the /api/schedule and /api/reports prefixes so GET and non-AI
  // routes are untouched. getRateLimitKey() always returns a key (fail-closed),
  // so a NEW endpoint under these prefixes is never silently uncapped.
  const isAiFamilyPost =
    (request.nextUrl.pathname.startsWith('/api/schedule')
      || request.nextUrl.pathname.startsWith('/api/reports'))
    && request.method === 'POST';

  if (isAiFamilyPost) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';
    const limitKey = getRateLimitKey(request.nextUrl.pathname);
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

  // Auth endpoints must never be cached by service worker (Network Only)
  if (request.nextUrl.pathname.startsWith('/auth/callback')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  }

  // Protected routes — redirect to /auth if not authenticated
  const protectedPaths = ['/schedule', '/dashboard', '/projects', '/reports'];
  const isProtectedRoute = protectedPaths.some(p => request.nextUrl.pathname.startsWith(p));
  if (isProtectedRoute && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/auth';
    return NextResponse.redirect(redirectUrl);
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
