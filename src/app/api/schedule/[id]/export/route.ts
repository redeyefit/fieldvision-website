import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient, verifyAnonymousId } from '@/lib/supabase/client';
import { formatCSVDate, formatDuration } from '@/lib/schedule/workdays';

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

// GET /api/schedule/[id]/export - Export schedule as CSV
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId } = await auth();
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

    // Get project and tasks
    const [projectResult, tasksResult] = await Promise.all([
      supabase.from('projects').select('name').eq('id', id).single(),
      supabase.from('tasks').select('*').eq('project_id', id).order('sequence_index'),
    ]);

    if (!projectResult.data) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const tasks = tasksResult.data || [];

    if (tasks.length === 0) {
      return NextResponse.json({ error: 'No tasks to export' }, { status: 400 });
    }

    // Create task ID to row number mapping for predecessors
    const taskIdToRow: Record<string, number> = {};
    tasks.forEach((task, index) => {
      taskIdToRow[task.id] = index + 1;
    });

    // Generate CSV in MS Project format
    const csvHeader = 'ID,Name,Duration,Start,Finish,Predecessors,Trade,Notes';
    const csvRows = tasks.map((task, index) => {
      const rowNumber = index + 1;
      const predecessors = (task.depends_on || [])
        .map((depId: string) => taskIdToRow[depId])
        .filter(Boolean)
        .join(';');

      // Escape fields that might contain commas or quotes
      const escapeCsvField = (field: string | null | undefined): string => {
        if (!field) return '';
        if (field.includes(',') || field.includes('"') || field.includes('\n')) {
          return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
      };

      return [
        rowNumber,
        escapeCsvField(task.name),
        formatDuration(task.duration_days),
        formatCSVDate(task.start_date),
        formatCSVDate(task.end_date),
        predecessors,
        escapeCsvField(task.trade),
        '', // Notes placeholder
      ].join(',');
    });

    const csv = [csvHeader, ...csvRows].join('\n');

    // Generate filename
    const projectName = projectResult.data.name.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
    const date = new Date().toISOString().split('T')[0];
    const filename = `${projectName}_schedule_${date}.csv`;

    // Return CSV file
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
