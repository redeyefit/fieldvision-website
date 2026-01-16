import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/privacy',
  '/terms',
  '/schedule',           // Allow anonymous access to schedule maker
  '/api/schedule(.*)',   // API routes handle their own auth (anonymous + authenticated)
]);

export default clerkMiddleware(async (auth, req) => {
  // Public routes don't require auth
  if (isPublicRoute(req)) {
    return;
  }

  // Protected routes require authentication
  await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
