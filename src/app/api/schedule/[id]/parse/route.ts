import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyAnonymousId } from '@/lib/supabase/client';
import { parseContractPDF } from '@/lib/ai/anthropic';

// Conditional Vercel Blob import - only use in production with token
const hasVercelBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
let put: typeof import('@vercel/blob').put | null = null;
if (hasVercelBlob) {
  // Dynamic import to avoid SDK initialization error in dev
  import('@vercel/blob').then((blob) => {
    put = blob.put;
  });
}

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

// POST /api/schedule/[id]/parse - Upload PDF and extract line items
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

    // Get form data with PDF file
    const formData = await request.formData();
    const file = formData.get('pdf') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No PDF file provided' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });
    }

    // Limit file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }

    // Upload to Vercel Blob (if available) or skip for local dev
    let pdfUrl: string | null = null;

    if (put && hasVercelBlob) {
      const blob = await put(`schedules/${id}/${file.name}`, file, {
        access: 'public',
      });
      pdfUrl = blob.url;
      // Update project with PDF URL
      await supabase.from('projects').update({ pdf_url: pdfUrl }).eq('id', id);
    } else {
      // Local development - skip blob storage
      console.log('[Dev] Skipping Vercel Blob storage - BLOB_READ_WRITE_TOKEN not set');
    }

    // Extract text from PDF
    // Note: For production, use a proper PDF parser like pdf-parse
    // For MVP, we'll extract text client-side and send it
    const pdfText = formData.get('text') as string;

    if (!pdfText) {
      return NextResponse.json({
        pdf_url: pdfUrl,
        message: 'PDF uploaded. Send text content to extract line items.',
        line_items: [],
      });
    }

    // Parse with Claude
    let retries = 3;
    let lastError: Error | null = null;

    while (retries > 0) {
      try {
        const result = await parseContractPDF(pdfText);

        // Delete existing line items for this project
        await supabase.from('line_items').delete().eq('project_id', id);

        // Insert new line items
        if (result.line_items.length > 0) {
          const lineItemsToInsert = result.line_items.map((item) => ({
            project_id: id,
            text: item.text,
            trade: item.trade,
            quantity: item.quantity || null,
            unit: item.unit || null,
            confirmed: false,
          }));

          const { error: insertError } = await supabase.from('line_items').insert(lineItemsToInsert);

          if (insertError) {
            console.error('Insert error:', insertError);
            return NextResponse.json({ error: 'Failed to save line items' }, { status: 500 });
          }
        }

        // Fetch inserted line items
        const { data: lineItems } = await supabase
          .from('line_items')
          .select('*')
          .eq('project_id', id)
          .order('created_at');

        return NextResponse.json({
          pdf_url: pdfUrl,
          line_items: lineItems || [],
        });
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
      { error: 'Failed to parse PDF. Please try again.' },
      { status: 500 }
    );
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
