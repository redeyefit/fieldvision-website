import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyAnonymousId } from '@/lib/supabase/client';
import { getAuthUserId, migrateAnonymousProjectsIfNeeded } from '@/lib/supabase/auth';
import { askTheFieldWithTools } from '@/lib/ai/anthropic';
import { validateAndResolveOperations } from '@/lib/schedule/validateOperations';
import { Task, AskResponse } from '@/lib/supabase/types';

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

// POST /api/schedule/[id]/ask - Ask the Field (with optional modifications)
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
    const { question } = body;

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Question required' }, { status: 400 });
    }

    // Get project and tasks for context — include full data for validation
    const [projectResult, tasksResult] = await Promise.all([
      supabase.from('projects').select('name').eq('id', id).single(),
      supabase
        .from('tasks')
        .select('id, name, trade, duration_days, start_date, end_date, depends_on, sequence_index')
        .eq('project_id', id)
        .order('sequence_index'),
    ]);

    if (!projectResult.data) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const tasks: Task[] = (tasksResult.data || []) as Task[];

    // Build task context with dependency names (not UUIDs) for Claude
    const taskContext = tasks.map((t) => ({
      name: t.name,
      trade: t.trade || 'General',
      duration_days: t.duration_days,
      start_date: t.start_date,
      end_date: t.end_date,
      depends_on_names: t.depends_on
        .map((depId) => tasks.find((dt) => dt.id === depId)?.name)
        .filter(Boolean) as string[],
    }));

    // Call Claude with 30s timeout
    const aiPromise = askTheFieldWithTools(question, {
      projectName: projectResult.data.name,
      tasks: taskContext,
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI request timed out after 30 seconds')), 30000)
    );

    const aiResult = await Promise.race([aiPromise, timeoutPromise]);

    // Text-only response — return directly
    if (aiResult.type === 'text') {
      const response: AskResponse = { type: 'text', answer: aiResult.answer };
      return NextResponse.json(response);
    }

    // Modification response — validate operations
    const { operations, warnings, errors } = validateAndResolveOperations(
      aiResult.operations,
      tasks
    );

    // If validation found errors but no valid operations, return as text
    if (operations.length === 0 && errors.length > 0) {
      const errorText = `I tried to modify the schedule, but ran into issues:\n\n${errors.map((e) => `- ${e}`).join('\n')}\n\nPlease check the task names and try again.`;
      const response: AskResponse = { type: 'text', answer: errorText };
      return NextResponse.json(response);
    }

    // Return validated modification for frontend confirmation
    const allWarnings = [...warnings, ...errors]; // Include validation errors as warnings
    const response: AskResponse = {
      type: 'modification',
      answer: aiResult.answer,
      reasoning: aiResult.reasoning,
      operations,
      warnings: allWarnings,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
