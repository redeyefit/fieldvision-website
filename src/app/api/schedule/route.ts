import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, generateAnonymousId, verifyAnonymousId } from '@/lib/supabase/client';
import { getAuthUserId, migrateAnonymousProjectsIfNeeded } from '@/lib/supabase/auth';
import { getUserOrgIds, isOrgAdmin } from '@/lib/supabase/org';
import { Project, CreateProjectRequest } from '@/lib/supabase/types';

const FREE_PROJECT_LIMIT = 3;

// CORS headers helper
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-anonymous-id',
    'Access-Control-Max-Age': '86400',
  };
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

// GET /api/schedule - List user's projects
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId();
    const anonymousId = request.headers.get('x-anonymous-id');

    if (!userId && !anonymousId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();
    await migrateAnonymousProjectsIfNeeded(userId, anonymousId);

    let query = supabase.from('projects').select('*').order('updated_at', { ascending: false });

    if (userId) {
      // Team-scoped: the user's own projects PLUS every project in an org they
      // belong to. org-shared projects are how a teammate sees the team's work.
      const orgIds = await getUserOrgIds(userId);
      if (orgIds.length > 0) {
        query = query.or(`user_id.eq.${userId},org_id.in.(${orgIds.join(',')})`);
      } else {
        query = query.eq('user_id', userId);
      }
    } else if (anonymousId && verifyAnonymousId(anonymousId)) {
      query = query.eq('anonymous_id', anonymousId);
    } else {
      return NextResponse.json({ error: 'Invalid anonymous ID' }, { status: 401 });
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ projects: data });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/schedule - Create new project
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId();
    let anonymousId = request.headers.get('x-anonymous-id');

    // Generate anonymous ID if not authenticated and none provided
    if (!userId && !anonymousId) {
      anonymousId = generateAnonymousId();
    }

    // Validate anonymous ID if provided
    if (!userId && anonymousId && !verifyAnonymousId(anonymousId)) {
      anonymousId = generateAnonymousId(); // Generate new one if invalid
    }

    const body: CreateProjectRequest = await request.json();

    if (!body.name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    const supabase = createServerClient();
    await migrateAnonymousProjectsIfNeeded(userId, anonymousId);

    // Team-shared project: must be authenticated + an admin/owner of the target org.
    let orgId: string | null = null;
    if (body.org_id) {
      if (!userId) {
        return NextResponse.json({ error: 'Sign in to create a team project' }, { status: 401, headers: corsHeaders() });
      }
      if (!(await isOrgAdmin(userId, body.org_id))) {
        return NextResponse.json({ error: 'Only an org owner or admin can create team projects' }, { status: 403, headers: corsHeaders() });
      }
      orgId = body.org_id;
    }

    // Check subscription status — only enforce limit for free-tier / anonymous users.
    // Org projects are governed by the org's plan (limit deferred), so skip the per-user cap.
    let enforceLimit = !orgId;
    if (userId && enforceLimit) {
      const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select('tier, status')
        .eq('user_id', userId)
        .single();

      if (
        subscription &&
        subscription.tier !== 'free' &&
        ['active', 'grace_period'].includes(subscription.status)
      ) {
        enforceLimit = false;
      }
    }

    if (enforceLimit) {
      let countQuery = supabase.from('projects').select('id', { count: 'exact', head: true });
      if (userId) {
        countQuery = countQuery.eq('user_id', userId);
      } else if (anonymousId) {
        countQuery = countQuery.eq('anonymous_id', anonymousId);
      }
      const { count } = await countQuery;

      if (count !== null && count >= FREE_PROJECT_LIMIT) {
        return NextResponse.json(
          {
            error: 'Project limit reached',
            message: `Free accounts can create up to ${FREE_PROJECT_LIMIT} projects. Upgrade to Pro for unlimited projects.`,
            limit: FREE_PROJECT_LIMIT,
            current: count,
          },
          { status: 403, headers: corsHeaders() }
        );
      }
    }

    const projectData: Partial<Project> = {
      name: body.name,
      start_date: body.start_date || null,
      work_days: body.work_days || 'mon-fri',
      user_id: userId || null,
      anonymous_id: userId ? null : anonymousId,
      org_id: orgId,
    };

    const { data, error } = await supabase
      .from('projects')
      .insert(projectData)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
    }

    // Return anonymous ID in response so client can store it
    return NextResponse.json({
      project: data,
      anonymous_id: userId ? null : anonymousId,
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
