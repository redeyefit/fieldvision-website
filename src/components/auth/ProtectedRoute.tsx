'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Custom redirect path (default: /auth) */
  redirectTo?: string;
}

export function ProtectedRoute({
  children,
  redirectTo = '/auth',
}: ProtectedRouteProps) {
  const { user, isLoading, isOffline } = useAuth();
  const router = useRouter();

  const isAuthorized = !!user;

  useEffect(() => {
    if (!isLoading && !isAuthorized && !isOffline) {
      router.replace(redirectTo);
    }
  }, [isLoading, isAuthorized, isOffline, router, redirectTo]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-fv-black text-white flex items-center justify-center">
        <div className="flex items-center gap-3">
          <svg className="animate-spin w-6 h-6 text-fv-blue" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  // Offline with cached session — show content with offline banner
  if (isOffline && user) {
    return (
      <>
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-600/90 text-white text-center text-sm py-1.5 px-4">
          You&apos;re offline — changes will sync when you reconnect
        </div>
        <div className="pt-8">
          {children}
        </div>
      </>
    );
  }

  // Not authorized and not loading — will redirect via useEffect
  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}
