import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyAnonymousId } from '@/lib/supabase/client';
import { getAuthUserId, migrateAnonymousProjectsIfNeeded } from '@/lib/supabase/auth';
import { parseSchedulePDFWithGemini } from '@/lib/ai/gemini';
import { extractText } from 'unpdf';
import { tryRegexExtract as tryRegexExtractShared } from '@/lib/pdf/regex-parser';
import { extractTextServerSide } from '@/lib/pdf/server-extract';

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

// POST /api/schedule/[id]/parse-import - Upload schedule PDF, extract tasks with dates
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Diagnostic trace — always returned so client can show what happened
  const diag = {
    step: 'init',
    fileName: '',
    fileSize: 0,
    serverTextLen: 0,
    clientTextLen: 0,
    serverExtractOk: false,
    regexServerTasks: 0,
    regexClientTasks: 0,
    geminiAttempts: 0,
    geminiError: '',
    textPreview: '',       // first 200 chars of best text (helps debug garbled extraction)
    serverError: '',       // pdfjs-dist server extraction error (if any)
  };

  try {
    const { id } = await params;
    diag.step = 'auth';
    const userId = await getAuthUserId();
    const anonymousId = request.headers.get('x-anonymous-id');

    if (!userId && !anonymousId) {
      return NextResponse.json({ error: 'Unauthorized', debug: { ...diag, step: 'auth_failed' } }, { status: 401 });
    }

    const supabase = createServerClient();
    await migrateAnonymousProjectsIfNeeded(userId, anonymousId);

    diag.step = 'ownership';
    const isOwner = await verifyProjectOwnership(supabase, id, userId, anonymousId);
    if (!isOwner) {
      return NextResponse.json({ error: 'Project not found', debug: { ...diag, step: 'ownership_failed' } }, { status: 404 });
    }

    diag.step = 'form_data';
    const formData = await request.formData();
    const file = formData.get('pdf') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No PDF file provided', debug: diag }, { status: 400 });
    }

    diag.fileName = file.name;
    diag.fileSize = file.size;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'File must be a PDF', debug: diag }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)', debug: diag }, { status: 400 });
    }

    // Extract text from PDF — multiple strategies, pick whichever yields regex matches
    diag.step = 'extract';
    let pdfText = '';
    const clientText = formData.get('text') as string || '';
    diag.clientTextLen = clientText.length;

    // Step 1: Try regex on client text first (fast, no extraction needed)
    diag.step = 'regex_client';
    const regexTasksClient = clientText.trim().length >= 50 ? tryRegexExtractShared(clientText) : null;
    diag.regexClientTasks = regexTasksClient?.length ?? 0;

    if (regexTasksClient && regexTasksClient.length > 0) {
      diag.step = 'regex_client_success';
      console.log(`[ParseImport] Client regex extracted ${regexTasksClient.length} tasks — done`);
      return NextResponse.json({ tasks: regexTasksClient, debug: diag });
    }

    console.log(`[ParseImport] Client regex: 0 tasks from ${clientText.length} chars — trying server extraction`);

    // Step 2: Server-side pdfjs-dist extraction (Node.js produces cleaner text than browser)
    // Browser pdfjs-dist extracts noisy calendar grid items that break regex matching.
    // Node.js pdfjs-dist produces clean, structured text (1200 chars vs 5000+ in browser).
    diag.step = 'pdfjs_server';
    let pdfjsText = '';
    const arrayBuffer = await file.arrayBuffer();

    try {
      pdfjsText = await extractTextServerSide(arrayBuffer);
      diag.serverTextLen = pdfjsText.length;
      diag.serverExtractOk = true;
      console.log(`[ParseImport] Server pdfjs-dist extracted ${pdfjsText.length} chars`);
    } catch (pdfjsError) {
      const errMsg = pdfjsError instanceof Error ? pdfjsError.message : String(pdfjsError);
      diag.serverError = errMsg;
      console.error('[ParseImport] Server pdfjs-dist extraction failed:', errMsg);
    }

    // Try regex on server-extracted text
    const regexTasksPdfjs = pdfjsText.trim().length >= 50 ? tryRegexExtractShared(pdfjsText) : null;
    diag.regexServerTasks = regexTasksPdfjs?.length ?? 0;

    if (regexTasksPdfjs && regexTasksPdfjs.length > 0) {
      diag.step = 'regex_server_success';
      console.log(`[ParseImport] Server regex extracted ${regexTasksPdfjs.length} tasks — done`);
      return NextResponse.json({ tasks: regexTasksPdfjs, debug: diag });
    }

    console.log(`[ParseImport] Server regex: 0 tasks from ${pdfjsText.length} chars — trying unpdf fallback`);

    // Step 3: unpdf fallback (different extraction engine, may work for non-Gantt PDFs)
    diag.step = 'unpdf_server';
    let unpdfText = '';
    try {
      const { text, totalPages } = await extractText(arrayBuffer);
      unpdfText = Array.isArray(text) ? text.join('\n') : (text || '');
      console.log(`[ParseImport] unpdf extracted ${unpdfText.length} chars from ${totalPages} pages`);
    } catch (unpdfError) {
      console.error('[ParseImport] unpdf extraction failed:', unpdfError);
    }

    const regexTasksUnpdf = unpdfText.trim().length >= 50 ? tryRegexExtractShared(unpdfText) : null;
    if (regexTasksUnpdf && regexTasksUnpdf.length > 0) {
      diag.step = 'regex_unpdf_success';
      diag.regexServerTasks = regexTasksUnpdf.length;
      console.log(`[ParseImport] unpdf regex extracted ${regexTasksUnpdf.length} tasks — done`);
      return NextResponse.json({ tasks: regexTasksUnpdf, debug: diag });
    }

    // Pick the best text for Gemini fallback
    pdfText = [pdfjsText, unpdfText, clientText]
      .sort((a, b) => b.trim().length - a.trim().length)[0] || '';

    diag.textPreview = pdfText.trim().slice(0, 200);

    if (!pdfText || pdfText.trim().length < 50) {
      diag.step = 'text_too_short';
      return NextResponse.json({
        error: `Could not extract readable text from PDF. Only extracted ${pdfText.trim().length} characters. This may be a scanned/image-based PDF — try exporting from your scheduling software as CSV or Excel instead.`,
        tasks: [],
        debug: diag,
      }, { status: 400 });
    }

    console.log('[ParseImport] All regex strategies failed — falling back to Gemini');

    // Step 4: Fall back to Gemini AI parsing
    // Single attempt with 8s timeout — Vercel Hobby caps functions at 10s
    diag.step = 'gemini';
    diag.geminiAttempts = 1;

    try {
      const geminiTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini timed out (8s limit for serverless)')), 8000)
      );

      const result = await Promise.race([
        parseSchedulePDFWithGemini(pdfText),
        geminiTimeout,
      ]);

      const tasks = result?.tasks ?? [];

      if (tasks.length === 0) {
        diag.step = 'gemini_empty';
        return NextResponse.json({
          error: 'No schedule tasks found in PDF. Make sure the PDF contains a construction schedule with dates.',
          tasks: [],
          debug: diag,
        }, { status: 400 });
      }

      diag.step = 'gemini_success';
      return NextResponse.json({ tasks, debug: diag });
    } catch (err) {
      const error = err as Error;
      diag.geminiError = error.message;
      console.error(`[ParseImport] Gemini failed:`, error.message);

      diag.step = 'gemini_failed';
      const isTimeout = error.message.includes('timed out');
      return NextResponse.json(
        {
          error: isTimeout
            ? 'AI parsing timed out. Try exporting your schedule as CSV instead of PDF for faster import.'
            : `Failed to parse schedule: ${error.message}`,
          debug: diag,
        },
        { status: isTimeout ? 408 : 500 }
      );
    }
  } catch (error) {
    console.error('[ParseImport] API error:', error);
    return NextResponse.json({ error: 'Internal server error', debug: { ...diag, step: 'unhandled_exception', exception: String(error) } }, { status: 500 });
  }
}
