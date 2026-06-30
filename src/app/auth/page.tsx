'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

type Mode = 'signin' | 'create';
type View = 'auth' | 'forgot';

// Touch-friendly input sizing for mobile
const inputClass =
  'w-full rounded-lg bg-black/40 border border-white/10 px-4 py-3 text-base text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-fv-blue transition-colors';

function AuthForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoading: authLoading, signIn, signUp, resetPassword } = useAuth();
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

  // Redirect if already logged in (via context)
  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/schedule');
    }
  }, [authLoading, user, router]);

  const handleSignIn = async () => {
    if (!email || !password) {
      setMessage('Please enter your email and password.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setMessage(null);
    const { error } = await signIn(email, password);
    if (error) {
      setStatus('error');
      setMessage(error.message || 'Sign in failed.');
    } else {
      router.replace('/schedule');
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
    const { error } = await signUp(email, password, fullName);
    if (error) {
      setStatus('error');
      setMessage(error.message || 'Failed to create account.');
    } else {
      setStatus('success');
      setMessage('Account created! Check your email to confirm, then sign in.');
      setMode('signin');
      setPassword('');
      setConfirmPassword('');
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
    const { error } = await resetPassword(email);
    if (error) {
      setStatus('error');
      setMessage(error.message || 'Failed to send reset link.');
    } else {
      setStatus('success');
      setMessage('Reset link sent! Check your email.');
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

  const handleContinueAnonymous = () => {
    router.push('/schedule');
  };

  // Show spinner while checking auth
  if (authLoading) {
    return (
      <div className="flex items-center gap-3">
        <svg className="animate-spin w-6 h-6 text-fv-blue" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-white/50">Loading...</span>
      </div>
    );
  }

  if (view === 'forgot') {
    return (
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 shadow-xl backdrop-blur-sm">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Reset Password</h1>
          <p className="text-sm text-white/70">
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm text-white/80" htmlFor="reset-email">Email</label>
            <input
              id="reset-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              className={inputClass}
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-fv-blue px-4 py-3 text-base font-medium text-black hover:bg-fv-blue/90 active:scale-[0.98] disabled:opacity-60 transition-all"
            disabled={status === 'loading'}
          >
            {status === 'loading' ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => { setView('auth'); setMessage(null); setStatus('idle'); }}
          className="text-sm text-fv-blue hover:text-fv-blue/80 active:text-fv-blue/60"
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
    <div className="w-full max-w-md space-y-6 rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 shadow-xl backdrop-blur-sm">
      {/* Logo / Branding */}
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
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
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
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            mode === 'create'
              ? 'bg-white/10 text-white'
              : 'text-white/50 hover:text-white/70'
          }`}
        >
          Create Account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name field (create account only) */}
        {mode === 'create' && (
          <div className="space-y-1.5">
            <label className="text-sm text-white/80" htmlFor="fullName">Full Name</label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              className={inputClass}
              placeholder="Your name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-sm text-white/80" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            className={inputClass}
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm text-white/80" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
            className={inputClass}
            placeholder={mode === 'create' ? 'At least 6 characters' : 'Your password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {mode === 'create' && (
          <div className="space-y-1.5">
            <label className="text-sm text-white/80" htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              className={inputClass}
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        )}

        <button
          type="submit"
          className="w-full rounded-lg bg-fv-blue px-4 py-3 text-base font-medium text-black hover:bg-fv-blue/90 active:scale-[0.98] disabled:opacity-60 transition-all"
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
          className="text-sm text-fv-blue hover:text-fv-blue/80 active:text-fv-blue/60"
        >
          Forgot password?
        </button>
      )}

      {message && (
        <p className={`text-sm ${status === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>
          {message}
        </p>
      )}

      {/* Anonymous access divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-fv-black px-3 text-white/40">or</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleContinueAnonymous}
        className="w-full rounded-lg border border-white/10 px-4 py-3 text-sm text-white/70 hover:bg-white/5 active:scale-[0.98] transition-all"
      >
        Continue without an account
      </button>
    </div>
  );
}

export default function AuthPage() {
  return (
    <div className="min-h-[100dvh] bg-fv-black text-white flex items-center justify-center px-4 py-8 safe-area-inset">
      <Suspense fallback={<div className="text-white/50">Loading...</div>}>
        <AuthForm />
      </Suspense>
    </div>
  );
}
