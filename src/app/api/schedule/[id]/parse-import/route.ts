import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, verifyAnonymousId } from '@/lib/supabase/client';
import { getAuthUserId, migrateAnonymousProjectsIfNeeded } from '@/lib/supabase/auth';
import { parseSchedulePDFWithGemini } from '@/lib/ai/gemini';
import { extractText } from 'unpdf';

export const maxDuration = 60;

// Month name to number mapping
const MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

// Add workdays to a date (skip weekends)
function addWorkdays(start: Date, days: number): Date {
  const result = new Date(start);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Normalize extracted PDF text for regex matching
// Strips control chars, normalizes whitespace, ensures proper line breaks
function normalizeExtractedText(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Strip control chars (keep \n \r \t)
    .replace(/\r\n?/g, '\n')     // Normalize line endings
    .replace(/\f/g, '\n')        // Form feeds → newlines
    .replace(/[ \t]+/g, ' ')     // Collapse horizontal whitespace
    .replace(/ ?\n ?/g, '\n')    // Trim spaces around newlines
    .replace(/\n{3,}/g, '\n\n')  // Collapse excessive blank lines
    // Gantt PDF fix: rejoin "N\ndays" split across lines (Y-coord rounding artifact)
    .replace(/(\d+)\ndays?\b/gi, '$1 days');
}

// Try to extract structured schedule data via regex (no AI needed)
// Handles Gantt chart PDFs with "TaskName MonthName DD, YYYY N days" format
function tryRegexExtract(rawText: string): Array<{
  name: string; trade: string; duration_days: number; start_date: string; end_date: string;
}> | null {
  const text = normalizeExtractedText(rawText);
  // Match line-by-line to avoid multiline regex exec() pitfalls with \s consuming newlines
  // Pattern: task name, then month day year, then N day(s), then optional trailing text (bar label)
  const linePattern = /^(.+?)\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d[\d ]*,?\s+\d{4})\s+(\d+)\s+days?(?:\s.*)?$/i;
  const tasks: Array<{ name: string; trade: string; duration_days: number; start_date: string; end_date: string }> = [];
  const seen = new Set<string>();

  for (const line of text.split('\n')) {
    const match = linePattern.exec(line);
    if (!match) continue;

    const rawName = match[1].trim().replace(/\s+/g, ' ');
    const dateStr = match[2].replace(',', '');
    const durationDays = parseInt(match[3], 10);

    // Skip duplicates (Gantt PDFs repeat tasks at bottom)
    const key = `${rawName}|${dateStr}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Skip non-task rows
    if (/^title$/i.test(rawName) || /^start$/i.test(rawName) || /^workdays$/i.test(rawName)) continue;

    // Parse start date — collapse split digits like "1 1" → "11"
    const cleanDate = dateStr.replace(/(\d)\s+(\d)/g, '$1$2');
    const dateParts = cleanDate.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{1,2})\s+(\d{4})/i);
    if (!dateParts) continue;
    const monthNum = MONTHS[dateParts[1].substring(0, 3)];
    if (!monthNum) continue;
    const startDate = new Date(`${dateParts[3]}-${monthNum}-${dateParts[2].padStart(2, '0')}`);
    if (isNaN(startDate.getTime())) continue;

    const endDate = addWorkdays(startDate, Math.max(1, durationDays));

    tasks.push({
      name: rawName,
      trade: 'General', // Trade inference will happen at import step
      duration_days: Math.max(1, durationDays),
      start_date: formatDate(startDate),
      end_date: formatDate(endDate),
    });
  }

  return tasks.length >= 3 ? tasks : null; // Need at least 3 tasks to be confident
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

    // Extract text from PDF
    diag.step = 'server_extract';
    let pdfText = '';
    let serverExtractFailed = false;
    const clientText = formData.get('text') as string || '';
    diag.clientTextLen = clientText.length;

    // Skip slow server-side PDF extraction if client already sent good text
    // unpdf can take 5-10s on complex Gantt PDFs, blowing the Vercel 10s limit
    if (clientText.trim().length >= 200) {
      console.log(`[ParseImport] Using client text (${clientText.length} chars) — skipping server extraction`);
      pdfText = clientText;
      diag.serverExtractOk = false;
      diag.serverTextLen = 0;
    } else {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const { text, totalPages } = await extractText(arrayBuffer);
        pdfText = Array.isArray(text) ? text.join('\n') : (text || '');
        diag.serverTextLen = pdfText.length;
        diag.serverExtractOk = true;
        console.log(`[ParseImport] Server extracted ${pdfText.length} chars from ${totalPages} pages`);
      } catch (pdfError) {
        serverExtractFailed = true;
        console.error('[ParseImport] Server PDF extraction failed:', pdfError);
      }

      // Use client text as fallback if server extraction failed or was too short
      if (pdfText.trim().length < 50 && clientText.trim().length >= 50) {
        console.log(`[ParseImport] Using client-side text (${clientText.length} chars) — server text too short`);
        pdfText = clientText;
      }
    }

    // Step 1: Try regex extraction on BOTH texts — pick whichever yields more tasks
    diag.step = 'regex';
    const regexTasksServer = pdfText.trim().length >= 50 ? tryRegexExtract(pdfText) : null;
    const regexTasksClient = clientText.trim().length >= 50 ? tryRegexExtract(clientText) : null;

    diag.regexServerTasks = regexTasksServer?.length ?? 0;
    diag.regexClientTasks = regexTasksClient?.length ?? 0;

    console.log(`[ParseImport] Regex results — server: ${diag.regexServerTasks} tasks (${pdfText.length} chars), client: ${diag.regexClientTasks} tasks (${clientText.length} chars)`);

    // Debug: log first 5 lines of normalized client text when regex fails
    if (diag.regexServerTasks === 0 && diag.regexClientTasks === 0 && clientText.length > 0) {
      const normalized = normalizeExtractedText(clientText);
      const first5 = normalized.split('\n').slice(0, 5);
      console.log(`[ParseImport] Regex failed — normalized client text first 5 lines:`, first5);
    }

    if (diag.regexServerTasks > 0 || diag.regexClientTasks > 0) {
      const bestTasks = diag.regexClientTasks > diag.regexServerTasks ? regexTasksClient! : regexTasksServer!;
      const source = diag.regexClientTasks > diag.regexServerTasks ? 'client' : 'server';
      diag.step = 'regex_success';
      console.log(`[ParseImport] Regex extracted ${bestTasks.length} tasks from ${source} text — skipping Gemini`);
      return NextResponse.json({ tasks: bestTasks, debug: diag });
    }

    // If neither regex worked but we have client text, prefer it for AI parsing
    if (clientText.trim().length > pdfText.trim().length) {
      console.log(`[ParseImport] Using longer client text for Gemini (${clientText.length} vs ${pdfText.length} chars)`);
      pdfText = clientText;
    }

    diag.textPreview = pdfText.trim().slice(0, 200);

    if (!pdfText || pdfText.trim().length < 50) {
      diag.step = 'text_too_short';
      const reason = serverExtractFailed
        ? 'Server-side PDF parsing failed.'
        : `Only extracted ${pdfText.trim().length} characters.`;
      const hasClientText = clientText.trim().length > 0;
      return NextResponse.json({
        error: `Could not extract readable text from PDF. ${reason}${hasClientText ? ' Client fallback also insufficient.' : ''} This may be a scanned/image-based PDF — try exporting from your scheduling software as CSV or Excel instead.`,
        tasks: [],
        debug: diag,
      }, { status: 400 });
    }

    console.log('[ParseImport] Regex found no structured tasks — falling back to Gemini');

    // Step 2: Fall back to Gemini AI parsing
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
