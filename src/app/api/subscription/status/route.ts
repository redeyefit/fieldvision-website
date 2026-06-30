import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/supabase/auth';
import { createServerClient } from '@/lib/supabase/client';

// Valid tiers — server determines this, never the client
const VALID_TIERS = ['free', 'standard', 'premium', 'enterprise'] as const;
type Tier = (typeof VALID_TIERS)[number];

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

/**
 * GET /api/subscription/status
 *
 * Server-authoritative subscription status endpoint.
 * - Validates session server-side via Supabase auth cookies
 * - Queries user_subscriptions (individual/iOS) and organizations (team/Stripe)
 * - Returns the highest applicable tier
 * - Accepts NO tier/plan input from the client
 */
export async function GET() {
  try {
    // 1. Server-side session validation — no client override possible
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders() }
      );
    }

    const supabase = createServerClient();

    // 2. Query individual subscription (iOS StoreKit)
    const { data: individualSub } = await supabase
      .from('user_subscriptions')
      .select('tier, status, expires_at, product_id')
      .eq('user_id', userId)
      .single();

    // 3. Query organization membership (Team/Stripe)
    const { data: orgMembership } = await supabase
      .from('org_members')
      .select('organization_id, organizations(plan, status)')
      .eq('user_id', userId)
      .limit(1)
      .single();

    // Also check if user owns an org directly
    const { data: ownedOrg } = await supabase
      .from('organizations')
      .select('plan, status')
      .eq('owner_id', userId)
      .limit(1)
      .single();

    // 4. Determine effective tier — highest wins
    const tiers: { tier: Tier; source: string }[] = [];

    // Individual subscription
    if (individualSub && individualSub.status === 'active') {
      const isExpired =
        individualSub.expires_at &&
        new Date(individualSub.expires_at) < new Date();

      if (!isExpired) {
        const tier = VALID_TIERS.includes(individualSub.tier)
          ? (individualSub.tier as Tier)
          : 'free';
        tiers.push({ tier, source: 'individual' });
      }
    }

    // Org membership
    const org =
      (orgMembership?.organizations as { plan?: string; status?: string } | null) ??
      ownedOrg;

    if (org && (org.status === 'active' || org.status === 'trialing')) {
      const plan = org.plan ?? 'free';
      const tier = VALID_TIERS.includes(plan as Tier)
        ? (plan as Tier)
        : 'free';
      tiers.push({ tier, source: 'organization' });
    }

    // Tier priority: enterprise > premium > standard > free
    const tierRank: Record<Tier, number> = {
      free: 0,
      standard: 1,
      premium: 2,
      enterprise: 3,
    };

    const best = tiers.reduce(
      (acc, t) => (tierRank[t.tier] > tierRank[acc.tier] ? t : acc),
      { tier: 'free' as Tier, source: 'default' }
    );

    // 5. Return only necessary fields — no internal IDs or sensitive data
    return NextResponse.json(
      {
        tier: best.tier,
        source: best.source,
        limits: getTierLimits(best.tier),
      },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('Subscription status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

/** Server-defined tier limits — not configurable by the client */
function getTierLimits(tier: Tier) {
  switch (tier) {
    case 'enterprise':
      return { projects: -1, history_days: -1, team_members: -1 };
    case 'premium':
      return { projects: -1, history_days: -1, team_members: 50 };
    case 'standard':
      return { projects: -1, history_days: -1, team_members: 5 };
    case 'free':
    default:
      return { projects: 3, history_days: 30, team_members: 1 };
  }
}
