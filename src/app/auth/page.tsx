'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createAuthClient } from '@/lib/supabase/client';

type Mode = 'signin' | 'create';
type View = 'auth' | 'forgot';

function AuthForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [view, setView] = useState<View>('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  // Read error from callback redirect
  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      setStatus('error');
      setMessage(decodeURIComponent(error));
    }
  }, [searchParams]);

  // Redirect if already logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createAuthClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          router.replace('/schedule');
        }
      } catch {
        // Not authenticated
      }
    };
    checkAuth();
  }, [router]);

  const handleSignIn = async () => {
    if (!email || !password) {
      setMessage('Please enter your email and password.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setMessage(null);
    try {
      const supabase = createAuthClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.replace('/schedule');
    } catch (err) {
      setStatus('error');
      setMessage((err as Error).message || 'Sign in failed.');
    }
  };

  const handleCreateAccount = async () => {
    if (!email || !password || !fullName.trim()) {
      setMessage('Please fill in all fields.');
      setStatus('error');
      return;
    }
    if (password.length < 6) {
      setMessage('Password must be at least 6 characters.');
      setStatus('error');
      return;
    }
    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setMessage(null);
    try {
      const supabase = createAuthClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName.trim() } },
      });
      if (error) throw error;
      setStatus('success');
      setMessage('Account created! Check your email to confirm, then sign in.');
      setMode('signin');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setStatus('error');
      setMessage((err as Error).message || 'Failed to create account.');
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setMessage('Please enter your email.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setMessage(null);
    try {
      const supabase = createAuthClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });
      if (error) throw error;
      setStatus('success');
      setMessage('Reset link sent! Check your email.');
    } catch (err) {
      setStatus('error');
      setMessage((err as Error).message || 'Failed to send reset link.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (view === 'forgot') {
      handleForgotPassword();
    } else if (mode === 'create') {
      handleCreateAccount();
    } else {
      handleSignIn();
    }
  };

  if (view === 'forgot') {
    return (
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Reset Password</h1>
          <p className="text-sm text-white/70">
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="text-sm text-white/80" htmlFor="reset-email">Email</label>
          <input
            id="reset-email"
            type="email"
            className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-fv-blue"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-fv-blue px-4 py-2 font-medium text-black hover:bg-fv-blue/90 disabled:opacity-60"
            disabled={status === 'loading'}
          >
            {status === 'loading' ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => { setView('auth'); setMessage(null); setStatus('idle'); }}
          className="text-sm text-fv-blue hover:text-fv-blue/80"
        >
          Back to sign in
        </button>

        {message && (
          <p className={`text-sm ${status === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>
            {message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-6 rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">
          {mode === 'create' ? 'Create your account' : 'Sign in to FieldVision'}
        </h1>
        <p className="text-sm text-white/70">
          {mode === 'create'
            ? 'Create a free account to manage projects and sync across devices.'
            : 'Access your schedules and projects from any device.'}
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex rounded-lg bg-black/40 border border-white/10 p-1">
        <button
          type="button"
          onClick={() => { setMode('signin'); setMessage(null); setStatus('idle'); }}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            mode === 'signin'
              ? 'bg-white/10 text-white'
              : 'text-white/50 hover:text-white/70'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => { setMode('create'); setMessage(null); setStatus('idle'); }}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            mode === 'create'
              ? 'bg-white/10 text-white'
              : 'text-white/50 hover:text-white/70'
          }`}
        >
          Create Account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Name field (create account only) */}
        {mode === 'create' && (
          <>
            <label className="text-sm text-white/80" htmlFor="fullName">Full Name</label>
            <input
              id="fullName"
              type="text"
              className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-fv-blue"
              placeholder="Your name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </>
        )}

        <label className="text-sm text-white/80" htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-fv-blue"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className="text-sm text-white/80" htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-fv-blue"
          placeholder={mode === 'create' ? 'At least 6 characters' : 'Your password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {mode === 'create' && (
          <>
            <label className="text-sm text-white/80" htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-fv-blue"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </>
        )}

        <button
          type="submit"
          className="w-full rounded-lg bg-fv-blue px-4 py-2 font-medium text-black hover:bg-fv-blue/90 disabled:opacity-60"
          disabled={status === 'loading'}
        >
          {status === 'loading'
            ? 'Please wait...'
            : mode === 'create'
              ? 'Create Account'
              : 'Sign In'}
        </button>
      </form>

      {mode === 'signin' && (
        <button
          type="button"
          onClick={() => { setView('forgot'); setMessage(null); setStatus('idle'); }}
          className="text-sm text-fv-blue hover:text-fv-blue/80"
        >
          Forgot password?
        </button>
      )}

      {message && (
        <p className={`text-sm ${status === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>
          {message}
        </p>
      )}
    </div>
  );
}

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-fv-black text-white flex items-center justify-center px-6">
      <Suspense fallback={<div className="text-white/50">Loading...</div>}>
        <AuthForm />
      </Suspense>
    </div>
  );
}
