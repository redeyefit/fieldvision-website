import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyAnonymousId } from '@/lib/supabase/client';
import { getAuthUserId, migrateAnonymousProjectsIfNeeded } from '@/lib/supabase/auth';
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
    const userId = await getAuthUserId();
    const anonymousId = request.headers.get('x-anonymous-id');

    if (!userId && !anonymousId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();
    await migrateAnonymousProjectsIfNeeded(userId, anonymousId);

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

    // Get existing task IDs so we can detect deletions
    const { data: existingTasks } = await supabase
      .from('tasks')
      .select('id')
      .eq('project_id', id);

    const incomingIds = new Set(finalTasks.map((t: { id: string }) => t.id));
    const existingIds = (existingTasks || []).map((t) => t.id);

    // Delete tasks that are no longer in the client's list
    const toDelete = existingIds.filter((eid) => !incomingIds.has(eid));
    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .in('id', toDelete)
        .eq('project_id', id);

      if (deleteError) {
        console.error('Delete error:', deleteError);
        return NextResponse.json({ error: 'Failed to delete tasks' }, { status: 500 });
      }
    }

    // Upsert each task (insert new ones, update existing ones)
    for (const task of finalTasks) {
      const { error } = await supabase
        .from('tasks')
        .upsert({
          id: task.id,
          project_id: id,
          name: task.name,
          trade: task.trade,
          duration_days: task.duration_days,
          start_date: task.start_date,
          end_date: task.end_date,
          depends_on: task.depends_on,
          sequence_index: task.sequence_index,
        });

      if (error) {
        console.error('Upsert error:', error);
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
