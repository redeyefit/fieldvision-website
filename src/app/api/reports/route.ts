import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import { getAuthUserId } from '@/lib/supabase/auth';
import { canAccessProject } from '@/lib/supabase/org';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

// GET /api/reports - List user's daily reports
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    const supabase = createServerClient();
    const projectId = request.nextUrl.searchParams.get('project_id');

    let query = supabase.from('daily_reports').select('*').order('date', { ascending: false });

    if (projectId) {
      // Project-scoped: any org member/owner sees ALL of the project's reports —
      // including those a field user created on the iOS app under a different
      // account. That's the whole point of the office view.
      if (!(await canAccessProject(projectId, userId, null))) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404, headers: corsHeaders() });
      }
      query = query.eq('project_id', projectId);
    } else {
      // No project filter → just the caller's own reports across everything.
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500, headers: corsHeaders() });
    }

    return NextResponse.json({ reports: data }, { headers: corsHeaders() });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

// GET single report by ID is handled by /api/reports/[id]/route.ts
