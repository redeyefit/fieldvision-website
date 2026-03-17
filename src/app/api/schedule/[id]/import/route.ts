import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyAnonymousId } from '@/lib/supabase/client';
import { getAuthUserId, migrateAnonymousProjectsIfNeeded } from '@/lib/supabase/auth';
import { inferDependencies } from '@/lib/ai/anthropic';
import { v4 as uuidv4 } from 'uuid';

// AI dependency inference can take a moment for large schedules
export const maxDuration = 60;

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

interface ImportedTask {
  name: string;
  trade: string;
  duration_days: number;
  start_date: string;
  end_date: string;
}

// POST /api/schedule/[id]/import - Import schedule from CSV/Excel (preserves user dates)
export async function POST(
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
    const { tasks: importedTasks, infer_dependencies: shouldInferDeps } = body as {
      tasks: ImportedTask[];
      infer_dependencies?: boolean;
    };

    if (!importedTasks || !Array.isArray(importedTasks) || importedTasks.length === 0) {
      return NextResponse.json({ error: 'Tasks array required' }, { status: 400 });
    }

    // Validate each task has required fields
    for (const task of importedTasks) {
      if (!task.name || !task.start_date || !task.end_date) {
        return NextResponse.json(
          { error: `Task "${task.name || '(unnamed)'}" missing required fields (name, start_date, end_date)` },
          { status: 400 }
        );
      }
    }

    // Generate UUIDs for all tasks
    const taskIds = importedTasks.map(() => uuidv4());

    // Optionally infer dependencies with AI
    let dependencyMap: Array<{ index: number; depends_on_indices: number[]; trade?: string }> = [];

    if (shouldInferDeps) {
      console.log('[Import] Inferring dependencies with Claude...');
      try {
        dependencyMap = await inferDependencies(importedTasks);
      } catch (err) {
        console.error('[Import] Dependency inference failed, continuing without:', err);
        // Continue without dependencies — user dates are preserved either way
      }
    }

    // Build tasks with UUIDs and resolved dependencies
    const tasksToInsert = importedTasks.map((task, index) => {
      const depInfo = dependencyMap.find((d) => d.index === index);
      const dependsOnIds = (depInfo?.depends_on_indices || [])
        .filter((i) => i >= 0 && i < index)
        .map((i) => taskIds[i]);

      return {
        id: taskIds[index],
        project_id: id,
        name: task.name,
        trade: depInfo?.trade || task.trade || null,
        duration_days: Math.max(1, task.duration_days || 1),
        start_date: task.start_date,
        end_date: task.end_date,
        depends_on: dependsOnIds,
        sequence_index: index,
      };
    });

    // Delete existing tasks for this project
    await supabase.from('tasks').delete().eq('project_id', id);

    // Insert imported tasks
    const { error: insertError } = await supabase.from('tasks').insert(tasksToInsert);

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to save imported schedule' }, { status: 500 });
    }

    // Update project start date from the earliest task
    const earliestDate = importedTasks.reduce((earliest, task) => {
      return task.start_date < earliest ? task.start_date : earliest;
    }, importedTasks[0].start_date);

    await supabase
      .from('projects')
      .update({ start_date: earliestDate })
      .eq('id', id);

    // Fetch inserted tasks
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
