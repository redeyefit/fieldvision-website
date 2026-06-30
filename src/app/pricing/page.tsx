'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

const APP_STORE_URL =
  'https://apps.apple.com/us/app/fieldvision-ai-construction/id6756640990';

const PLAN = {
  name: 'FieldVision Pro',
  price: '$49',
  period: '/mo',
  trial: '7-day free trial',
  description: 'Everything you need to run your jobs. No limits.',
  features: [
    'Unlimited Projects',
    'AI Daily Reports',
    'Photo & Video Analysis',
    'Voice Notes',
    'Schedule Sync',
    'Blueprint AI',
    'Unlimited History',
    'Priority Support',
  ],
  cta: 'Start Free Trial',
  plan_id: 'pro',
};

export default function PricingPage() {
  return (
    <Suspense fallback={null}>
      <PricingContent />
    </Suspense>
  );
}

function PricingContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setMessage({ type: 'success', text: 'Subscription activated! Welcome to FieldVision Pro.' });
    }
    if (searchParams.get('canceled') === 'true') {
      setMessage({ type: 'error', text: 'Checkout was canceled. No charges were made.' });
    }
  }, [searchParams]);

  useEffect(() => {
    async function checkAuth() {
      try {
        const { createAuthClient } = await import('@/lib/supabase/client');
        const supabase = createAuthClient();
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          setUser({ id: data.user.id, email: data.user.email || '' });
        }
      } catch {
        // Not authenticated
      }
    }
    checkAuth();
  }, []);

  async function handleCheckout() {
    if (!user) {
      window.location.href = '/auth?redirect=/pricing';
      return;
    }

    setLoading(PLAN.plan_id);
    setMessage(null);
    try {
      const { createAuthClient } = await import('@/lib/supabase/client');
      const supabase = createAuthClient();
      const { data: session, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        setMessage({ type: 'error', text: `Session error: ${sessionError.message}` });
        return;
      }

      const token = session?.session?.access_token;

      if (!token) {
        setMessage({ type: 'error', text: 'No auth token found. Please sign in again.' });
        setTimeout(() => { window.location.href = '/auth?redirect=/pricing'; }, 2000);
        return;
      }

      setMessage({ type: 'success', text: 'Creating checkout session...' });

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const resp = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
        body: JSON.stringify({ plan: PLAN.plan_id }),
      });

      const data = await resp.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        setMessage({ type: 'error', text: `Checkout failed: ${data.error || JSON.stringify(data)}` });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Something went wrong';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-fv-black text-white">
      {/* Nav — matches homepage floating glass bar */}
      <nav className="fixed top-0 left-0 right-0 z-[100] px-3 md:px-10 py-3 md:py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center bg-black/60 backdrop-blur-2xl border border-white/[0.06] rounded-xl md:rounded-2xl px-4 md:px-5 py-2.5 md:py-3">
          <Link href="/" className="flex items-center gap-2 font-display font-semibold text-sm tracking-tight">
            <div className="bg-white rounded-lg md:rounded-xl p-1 md:p-1.5">
              <Image src="/logo_backup.png" alt="FieldVision" width={20} height={20} className="w-4 h-4 md:w-5 md:h-5" />
            </div>
            <span className="hidden sm:inline">FieldVision</span>
          </Link>
          <div className="flex items-center gap-4 md:gap-8">
            <Link href="/" className="font-display text-[11px] font-medium tracking-[0.15em] uppercase transition-colors duration-300 text-gray-500 hover:text-gray-300">
              Home
            </Link>
            <Link href="/schedule" className="font-display text-[11px] font-medium tracking-[0.15em] uppercase transition-colors duration-300 text-gray-500 hover:text-gray-300">
              Schedule
            </Link>
            <Link href="/pricing" className="font-display text-[11px] font-medium tracking-[0.15em] uppercase transition-colors duration-300 text-white">
              Pricing
            </Link>
          </div>
          <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className="font-display text-[11px] md:text-xs font-semibold px-4 md:px-5 py-2 md:py-2.5 bg-white text-black rounded-lg md:rounded-xl hover:bg-gray-100 transition-all duration-300">
            Download
          </a>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 pt-32 pb-24">
        {/* Hero */}
        <div className="text-center mb-6">
          <span className="font-display text-[10px] font-medium tracking-[0.3em] uppercase text-fv-blue">Pricing</span>
        </div>
        <div className="text-center mb-4">
          <h1 className="font-display text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[1.1] tracking-tight">
            One plan. Everything included.
          </h1>
        </div>
        <div className="text-center mb-16">
          <p className="text-gray-400 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
            Try free for 7 days. Then $49/mo. No contracts, cancel anytime.
          </p>
        </div>

        {/* Status message */}
        {message && (
          <div className={`max-w-lg mx-auto mb-10 p-4 rounded-xl text-center text-sm ${
            message.type === 'success'
              ? 'bg-green-500/10 border border-green-500/20 text-green-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}>
            {message.text}
          </div>
        )}

        {/* Pricing card — single plan */}
        <div className="max-w-md mx-auto">
          <div className="rounded-2xl p-8 flex flex-col bg-white/[0.06] border border-white/[0.12] ring-1 ring-fv-blue/30">
            <div className="font-display text-[9px] font-semibold tracking-[0.25em] uppercase text-fv-blue mb-4">
              {PLAN.trial}
            </div>

            <h2 className="font-display text-2xl font-bold tracking-tight">{PLAN.name}</h2>
            <p className="text-gray-500 text-sm mt-1">{PLAN.description}</p>

            <div className="mt-6 mb-1">
              <span className="font-display text-5xl font-bold tracking-tight">{PLAN.price}</span>
              <span className="text-gray-500 text-lg">{PLAN.period}</span>
            </div>
            <p className="text-[12px] text-gray-500 mb-8">after 7-day free trial</p>

            <ul className="space-y-3 mb-8">
              {PLAN.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-[14px]">
                  <svg className="w-4 h-4 mt-0.5 text-fv-blue shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">{feature}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleCheckout()}
              disabled={loading === PLAN.plan_id}
              className="w-full py-3 rounded-xl font-display text-sm font-semibold tracking-wide transition-all duration-300 bg-white text-black hover:bg-gray-100 hover:shadow-[0_0_40px_rgba(255,255,255,0.1)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === PLAN.plan_id ? 'Loading...' : PLAN.cta}
            </button>
          </div>
        </div>

        {/* Bottom note */}
        <div className="text-center mt-16 max-w-lg mx-auto">
          <p className="text-gray-600 text-xs leading-relaxed">
            Billed monthly through Stripe. Cancel anytime during your trial — no charge.
            All plans include end-to-end encryption and automatic backups.
          </p>
          <p className="text-gray-600 text-xs mt-4">
            Questions? <a href="mailto:steven@fieldvision.ai" className="text-fv-blue hover:text-white transition-colors">steven@fieldvision.ai</a>
          </p>
        </div>
      </main>
    </div>
  );
}
