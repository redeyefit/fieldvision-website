import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyAnonymousId } from '@/lib/supabase/client';
import { parseContractPDF } from '@/lib/ai/anthropic';
import { extractText } from 'unpdf';

// Allow longer timeout for PDF parsing with Claude (Vercel Hobby: max 60s)
export const maxDuration = 60;

// CORS headers helper
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-anonymous-id',
    'Access-Control-Max-Age': '86400',
  };
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
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

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        // Dynamic import to avoid SDK initialization error when token is missing
        const { put } = await import('@vercel/blob');
        const blob = await put(`schedules/${id}/${file.name}`, file, {
          access: 'public',
        });
        pdfUrl = blob.url;
        // Update project with PDF URL
        await supabase.from('projects').update({ pdf_url: pdfUrl }).eq('id', id);
      } catch (blobError) {
        console.error('[Blob] Upload failed:', blobError);
        // Continue without blob storage
      }
    } else {
      // Local development - skip blob storage
      console.log('[Dev] Skipping Vercel Blob storage - BLOB_READ_WRITE_TOKEN not set');
    }

    // Extract text from PDF using unpdf (server-side)
    let pdfText = '';
    const clientText = formData.get('text') as string || '';

    try {
      const arrayBuffer = await file.arrayBuffer();
      const { text, totalPages } = await extractText(arrayBuffer);
      pdfText = Array.isArray(text) ? text.join('\n') : (text || '');
      console.log(`[PDF Parse] Extracted ${pdfText.length} characters from ${totalPages} pages`);
    } catch (pdfError) {
      console.error('[PDF Parse] Failed to extract text:', pdfError);
    }

    // Use client-provided text if server extraction failed or returned minimal text
    if (pdfText.trim().length < 50 && clientText.trim().length >= 50) {
      console.log(`[PDF Parse] Using client-provided text (${clientText.length} chars) instead of server extraction (${pdfText.length} chars)`);
      pdfText = clientText;
    }

    if (!pdfText || pdfText.trim().length < 50) {
      return NextResponse.json({
        pdf_url: pdfUrl,
        error: 'Could not extract readable text from PDF. Please ensure it is not a scanned image.',
        line_items: [],
      }, { status: 400 });
    }

    // Parse with Claude
    let retries = 3;
    let lastError: Error | null = null;

    console.log('[Parse] Starting Claude parsing, text length:', pdfText.length);
    console.log('[Parse] ANTHROPIC_API_KEY set:', !!process.env.ANTHROPIC_API_KEY);

    while (retries > 0) {
      try {
        console.log(`[Parse] Attempt ${4 - retries} of 3`);
        const result = await parseContractPDF(pdfText);

        // Validate result structure
        const extractedItems = result?.line_items ?? [];
        console.log(`[Parse] Extracted ${extractedItems.length} line items`);

        // Delete existing line items for this project
        await supabase.from('line_items').delete().eq('project_id', id);

        // Insert new line items
        if (extractedItems.length > 0) {
          const lineItemsToInsert = extractedItems.map((item) => ({
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

        const response = NextResponse.json({
          pdf_url: pdfUrl,
          line_items: lineItems || [],
        });
        Object.entries(corsHeaders()).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        return response;
      } catch (err) {
        lastError = err as Error;
        console.error(`[Parse] Attempt failed:`, lastError.message);
        retries--;
        if (retries > 0) {
          // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, 1000 * (4 - retries)));
        }
      }
    }

    console.error('[Parse] Claude API failed after all retries:', lastError?.message, lastError?.stack);
    const errorResponse = NextResponse.json(
      { error: `Failed to parse PDF: ${lastError?.message || 'Unknown error'}. Please try again.` },
      { status: 500 }
    );
    Object.entries(corsHeaders()).forEach(([key, value]) => {
      errorResponse.headers.set(key, value);
    });
    return errorResponse;
  } catch (error) {
    const err = error as Error;
    console.error('[Parse] API error:', err.message, err.stack);
    const errorResponse = NextResponse.json({ error: `Internal server error: ${err.message}` }, { status: 500 });
    Object.entries(corsHeaders()).forEach(([key, value]) => {
      errorResponse.headers.set(key, value);
    });
    return errorResponse;
  }
}
