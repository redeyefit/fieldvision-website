import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyAnonymousId } from '@/lib/supabase/client';
import { generateSchedule } from '@/lib/ai/anthropic';
import { recalculateTasks } from '@/lib/schedule/workdays';
import { v4 as uuidv4 } from 'uuid';

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

// POST /api/schedule/[id]/generate - Generate schedule from confirmed line items
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

    // Get project settings
    const { data: project } = await supabase
      .from('projects')
      .select('start_date, work_days')
      .eq('id', id)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get start date from request body or project
    const body = await request.json();
    const startDate = body.start_date || project.start_date || new Date().toISOString().split('T')[0];
    const workDays = body.work_days || project.work_days || 'mon-fri';

    // Get confirmed line items
    const { data: lineItems } = await supabase
      .from('line_items')
      .select('*')
      .eq('project_id', id)
      .eq('confirmed', true)
      .order('created_at');

    if (!lineItems || lineItems.length === 0) {
      return NextResponse.json(
        { error: 'No confirmed line items. Please confirm items before generating.' },
        { status: 400 }
      );
    }

    // Generate schedule with Claude
    let retries = 3;
    let lastError: Error | null = null;

    while (retries > 0) {
      try {
        const result = await generateSchedule(
          lineItems.map((item) => ({ text: item.text, trade: item.trade || 'General' }))
        );

        // Generate UUIDs for tasks
        const taskIds = result.tasks.map(() => uuidv4());

        // Convert dependency indices to UUIDs
        const tasksWithIds = result.tasks.map((task, index) => ({
          id: taskIds[index],
          name: task.name,
          trade: task.trade,
          duration_days: Math.max(1, task.duration_days), // Clamp minimum to 1
          depends_on: task.depends_on_indices
            .filter((i) => i >= 0 && i < index) // Only valid previous tasks
            .map((i) => taskIds[i]),
          sequence_index: index,
        }));

        // Calculate dates based on dependencies and workdays
        const tasksWithDates = recalculateTasks(tasksWithIds, startDate, workDays);

        // Delete existing tasks for this project
        await supabase.from('tasks').delete().eq('project_id', id);

        // Insert new tasks
        const tasksToInsert = tasksWithDates.map((task) => ({
          id: task.id,
          project_id: id,
          name: task.name,
          trade: task.trade,
          duration_days: task.duration_days,
          start_date: task.start_date,
          end_date: task.end_date,
          depends_on: task.depends_on,
          sequence_index: task.sequence_index,
        }));

        const { error: insertError } = await supabase.from('tasks').insert(tasksToInsert);

        if (insertError) {
          console.error('Insert error:', insertError);
          return NextResponse.json({ error: 'Failed to save schedule' }, { status: 500 });
        }

        // Update project start date and work days
        await supabase
          .from('projects')
          .update({ start_date: startDate, work_days: workDays })
          .eq('id', id);

        // Fetch inserted tasks
        const { data: tasks } = await supabase
          .from('tasks')
          .select('*')
          .eq('project_id', id)
          .order('sequence_index');

        return NextResponse.json({ tasks: tasks || [] });
      } catch (err) {
        lastError = err as Error;
        retries--;
        if (retries > 0) {
          // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, 1000 * (4 - retries)));
        }
      }
    }

    console.error('Claude API failed after retries:', lastError);
    return NextResponse.json(
      { error: 'Failed to generate schedule. Please try again.' },
      { status: 500 }
    );
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
