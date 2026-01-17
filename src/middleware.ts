import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simplified middleware - no auth required for MVP
// TODO: Add Clerk auth when ready for user accounts
export function middleware(request: NextRequest) {
  // Allow all requests through
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
};
