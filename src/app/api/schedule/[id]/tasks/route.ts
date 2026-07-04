import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import { canAccessProject } from '@/lib/supabase/org';
import { getAuthUserId, migrateAnonymousProjectsIfNeeded } from '@/lib/supabase/auth';
import { recalculateTasks } from '@/lib/schedule/workdays';

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
    const isOwner = await canAccessProject(id, userId, anonymousId);
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

    // Write each task. SECURITY: never upsert-by-PK here — tasks.id is a global
    // UUID, so an upsert with a client-supplied id belonging to ANOTHER project
    // would reassign/overwrite that row (cross-tenant write, RLS bypassed by the
    // service-role client). Instead:
    //   - id already in THIS project  → UPDATE scoped by project_id
    //   - id not in this project       → plain INSERT (a PK collision with another
    //                                     project's task fails closed, never overwrites)
    const existingIdSet = new Set(existingIds);
    for (const task of finalTasks) {
      const row = {
        project_id: id,
        name: task.name,
        trade: task.trade,
        duration_days: task.duration_days,
        start_date: task.start_date,
        end_date: task.end_date,
        depends_on: task.depends_on,
        sequence_index: task.sequence_index,
      };

      if (task.id && existingIdSet.has(task.id)) {
        const { error } = await supabase
          .from('tasks')
          .update(row)
          .eq('id', task.id)
          .eq('project_id', id);
        if (error) {
          console.error('Task update error:', error);
          return NextResponse.json({ error: 'Failed to update tasks' }, { status: 500 });
        }
      } else {
        const { error } = await supabase
          .from('tasks')
          .insert(task.id ? { id: task.id, ...row } : row);
        if (error) {
          console.error('Task insert error:', error);
          // A duplicate-key error means the client supplied an id owned elsewhere.
          const isConflict = error.code === '23505';
          return NextResponse.json(
            { error: isConflict ? 'Invalid task id' : 'Failed to create tasks' },
            { status: isConflict ? 409 : 500 }
          );
        }
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
