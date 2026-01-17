import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient, verifyAnonymousId } from '@/lib/supabase/client';

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

// PATCH /api/schedule/[id]/line-items - Update line items (confirm, edit)
export async function PATCH(
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

    const body = await request.json();
    const { line_items: updatedItems } = body;

    if (!updatedItems || !Array.isArray(updatedItems)) {
      return NextResponse.json({ error: 'Line items array required' }, { status: 400 });
    }

    // Update each line item
    for (const item of updatedItems) {
      const { error } = await supabase
        .from('line_items')
        .update({
          text: item.text,
          trade: item.trade,
          quantity: item.quantity,
          unit: item.unit,
          notes: item.notes,
          confirmed: item.confirmed,
        })
        .eq('id', item.id)
        .eq('project_id', id);

      if (error) {
        console.error('Update error:', error);
        return NextResponse.json({ error: 'Failed to update line items' }, { status: 500 });
      }
    }

    // Fetch updated line items
    const { data: lineItems } = await supabase
      .from('line_items')
      .select('*')
      .eq('project_id', id)
      .order('created_at');

    return NextResponse.json({ line_items: lineItems || [] });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/schedule/[id]/line-items - Delete line items
export async function DELETE(
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

    const body = await request.json();
    const { item_ids } = body;

    if (!item_ids || !Array.isArray(item_ids)) {
      return NextResponse.json({ error: 'Item IDs array required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('line_items')
      .delete()
      .eq('project_id', id)
      .in('id', item_ids);

    if (error) {
      console.error('Delete error:', error);
      return NextResponse.json({ error: 'Failed to delete line items' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
