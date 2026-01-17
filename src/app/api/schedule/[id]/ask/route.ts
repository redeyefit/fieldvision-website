import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyAnonymousId } from '@/lib/supabase/client';
import { askTheField } from '@/lib/ai/anthropic';

// Helper to verify project ownership
async function verifyProjectOwnership(
  supabase: ReturnType<typeof createServerClient>,
  projectId: string,
  userId: string | null,
  anonymousId: string | null
): Promise<boolean> {
  const { data } = await supabase
    .from('projects')
    .select('id, user_id, anonymous_id')
    .eq('id', projectId)
    .single();

  if (!data) return false;

  if (userId && data.user_id === userId) return true;
  if (anonymousId && data.anonymous_id === anonymousId && verifyAnonymousId(anonymousId)) return true;

  return false;
}

// POST /api/schedule/[id]/ask - Ask the Field (read-only AI)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // TODO: Add Clerk auth when ready for user accounts
    const userId = null; // Disabled for MVP
    const anonymousId = request.headers.get('x-anonymous-id');

    if (!userId && !anonymousId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    // Verify ownership
    const isOwner = await verifyProjectOwnership(supabase, id, userId, anonymousId);
    if (!isOwner) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const { question } = body;

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Question required' }, { status: 400 });
    }

    // Get project and tasks for context
    const [projectResult, tasksResult] = await Promise.all([
      supabase.from('projects').select('name').eq('id', id).single(),
      supabase.from('tasks').select('name, trade, duration_days, start_date, end_date').eq('project_id', id).order('sequence_index'),
    ]);

    if (!projectResult.data) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const tasks = tasksResult.data || [];

    // Get answer from Claude
    const answer = await askTheField(question, {
      projectName: projectResult.data.name,
      tasks,
    });

    return NextResponse.json({ answer });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
