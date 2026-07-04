import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import { getAuthUserId } from '@/lib/supabase/auth';
import { canAccessProject } from '@/lib/supabase/org';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

// GET /api/reports/[id] - Get single report with photos and voice notes
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    const { id } = await params;
    const supabase = createServerClient();

    // Fetch report by id, then authorize by PROJECT access (owner OR org member),
    // not by report.user_id — the office view must open reports a field user
    // created under a different account. Mirrors the project-scoped list route.
    const { data: report, error: reportError } = await supabase
      .from('daily_reports')
      .select('*')
      .eq('id', id)
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404, headers: corsHeaders() });
    }

    if (!(await canAccessProject(report.project_id, userId, null))) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404, headers: corsHeaders() });
    }

    // Fetch photos for this project on the report date
    const reportDate = new Date(report.date);
    const startOfDay = new Date(reportDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(reportDate);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: photos } = await supabase
      .from('photos')
      .select('*')
      .eq('project_id', report.project_id)
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())
      .order('created_at', { ascending: true });

    // Fetch voice notes for this project on the report date
    const { data: voiceNotes } = await supabase
      .from('voice_notes')
      .select('*')
      .eq('project_id', report.project_id)
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())
      .order('created_at', { ascending: true });

    return NextResponse.json(
      { report, photos: photos || [], voiceNotes: voiceNotes || [] },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
