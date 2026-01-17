import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyAnonymousId } from '@/lib/supabase/client';
import { recalculateTasks } from '@/lib/schedule/workdays';

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

// PATCH /api/schedule/[id]/tasks - Update tasks (reorder, edit)
export async function PATCH(
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
    const { tasks: updatedTasks, recalculate } = body;

    if (!updatedTasks || !Array.isArray(updatedTasks)) {
      return NextResponse.json({ error: 'Tasks array required' }, { status: 400 });
    }

    // Get project for work days setting
    const { data: project } = await supabase
      .from('projects')
      .select('start_date, work_days')
      .eq('id', id)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    let finalTasks = updatedTasks;

    // Recalculate dates if requested (after reorder or duration change)
    if (recalculate) {
      finalTasks = recalculateTasks(
        updatedTasks,
        project.start_date || new Date().toISOString().split('T')[0],
        project.work_days || 'mon-fri'
      );
    }

    // Update each task
    for (const task of finalTasks) {
      const { error } = await supabase
        .from('tasks')
        .update({
          name: task.name,
          trade: task.trade,
          duration_days: task.duration_days,
          start_date: task.start_date,
          end_date: task.end_date,
          depends_on: task.depends_on,
          sequence_index: task.sequence_index,
        })
        .eq('id', task.id)
        .eq('project_id', id);

      if (error) {
        console.error('Update error:', error);
        return NextResponse.json({ error: 'Failed to update tasks' }, { status: 500 });
      }
    }

    // Fetch updated tasks
    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', id)
      .order('sequence_index');

    return NextResponse.json({ tasks: tasks || [] });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
