import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServerClient } from '@/lib/supabase/client';
import { getAuthUserId } from '@/lib/supabase/auth';
import { v4 as uuidv4 } from 'uuid';

// Report generation can take time with large projects
export const maxDuration = 120;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

// POST /api/reports/generate - Generate AI daily report from captured data
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    const { project_id, date } = await request.json();

    if (!project_id) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400, headers: corsHeaders() });
    }

    const supabase = createServerClient();
    const reportDate = date ? new Date(date) : new Date();

    // Verify project ownership
    const { data: project } = await supabase
      .from('projects')
      .select('id, name, address, user_id')
      .eq('id', project_id)
      .eq('user_id', userId)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404, headers: corsHeaders() });
    }

    // Gather data for the report date
    const startOfDay = new Date(reportDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(reportDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch log entries, photos, voice notes in parallel
    const [logResult, photoResult, voiceResult, notesResult] = await Promise.all([
      supabase
        .from('log_entries')
        .select('*')
        .eq('project_id', project_id)
        .gte('timestamp', startOfDay.toISOString())
        .lte('timestamp', endOfDay.toISOString())
        .order('timestamp', { ascending: true }),
      supabase
        .from('photos')
        .select('*')
        .eq('project_id', project_id)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString()),
      supabase
        .from('voice_notes')
        .select('*')
        .eq('project_id', project_id)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString()),
      supabase
        .from('project_notes')
        .select('*')
        .eq('project_id', project_id)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString()),
    ]);

    const logEntries = logResult.data || [];
    const photos = photoResult.data || [];
    const voiceNotes = voiceResult.data || [];
    const notes = notesResult.data || [];

    // Build context for Claude
    const dateStr = reportDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    let contextParts: string[] = [];

    if (logEntries.length > 0) {
      contextParts.push(
        `LOG ENTRIES (${logEntries.length}):\n` +
        logEntries.map(e =>
          `- [${e.type}] ${e.notes || 'No notes'}${e.location_label ? ` (Location: ${e.location_label})` : ''}${e.photo_notes ? ` Photo notes: ${e.photo_notes}` : ''}`
        ).join('\n')
      );
    }

    if (voiceNotes.length > 0) {
      const transcripts = voiceNotes.filter(v => v.transcript);
      if (transcripts.length > 0) {
        contextParts.push(
          `VOICE NOTE TRANSCRIPTS (${transcripts.length}):\n` +
          transcripts.map(v => `- ${v.transcript}`).join('\n')
        );
      }
    }

    if (notes.length > 0) {
      contextParts.push(
        `PROJECT NOTES (${notes.length}):\n` +
        notes.map(n => `- ${n.content}`).join('\n')
      );
    }

    if (photos.length > 0) {
      contextParts.push(`PHOTOS: ${photos.length} site photos captured today.`);
    }

    const hasData = contextParts.length > 0;

    const prompt = hasData
      ? `You are a construction superintendent's AI assistant generating a professional daily report.

PROJECT: ${project.name}
${project.address ? `ADDRESS: ${project.address}` : ''}
DATE: ${dateStr}

DATA CAPTURED TODAY:
${contextParts.join('\n\n')}

Generate a professional construction daily report with these sections. Use the Buildertrend format that superintendents expect:

1. WORK STATUS — Detailed summary of all work performed today, organized by trade/area
2. OBSERVATIONS — Notable conditions, quality issues, safety observations
3. RFIs — Any requests for information identified from the field data
4. COORDINATION ITEMS — Items requiring coordination between trades or with the office
5. INSPECTIONS — Any inspections noted or needed

Write in a professional, factual tone. Be specific about locations and trades when the data supports it. Do not fabricate information not present in the captured data.`
      : `You are a construction superintendent's AI assistant. Generate a template daily report that the superintendent can fill in.

PROJECT: ${project.name}
${project.address ? `ADDRESS: ${project.address}` : ''}
DATE: ${dateStr}

No field data was captured today via the app. Generate a clean template report with standard sections (WORK STATUS, OBSERVATIONS, RFIs, COORDINATION ITEMS, INSPECTIONS) with placeholder text indicating what should be documented. Keep it brief and practical.`;

    // Generate with Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const workStatus = response.content
      .filter(block => block.type === 'text')
      .map(block => (block as Anthropic.TextBlock).text)
      .join('\n');

    // Parse sections from the generated text
    const sectionPattern = /(?:^|\n)(?:#{1,3}\s*)?(\d+\.\s*)?(?:\*{1,2})?(RFIs?|COORDINATION\s*ITEMS?|INSPECTIONS?)(?:\*{1,2})?[:\s—-]*\n?([\s\S]*?)(?=\n(?:#{1,3}\s*)?(?:\d+\.\s*)?(?:\*{1,2})?(?:WORK STATUS|OBSERVATIONS|RFIs?|COORDINATION|INSPECTIONS|$))/gi;

    let rfis = '';
    let coordinationItems = '';
    let inspections = '';

    let match;
    while ((match = sectionPattern.exec(workStatus)) !== null) {
      const sectionName = match[2].toUpperCase().trim();
      const sectionContent = match[3].trim();
      if (sectionName.startsWith('RFI')) rfis = sectionContent;
      else if (sectionName.startsWith('COORDINATION')) coordinationItems = sectionContent;
      else if (sectionName.startsWith('INSPECTION')) inspections = sectionContent;
    }

    // Save to database
    const reportId = uuidv4();
    const { data: report, error: insertError } = await supabase
      .from('daily_reports')
      .insert({
        id: reportId,
        project_id: project_id,
        user_id: userId,
        date: reportDate.toISOString(),
        work_status: workStatus,
        inspections: inspections || null,
        rfis: rfis || null,
        coordination_items: coordinationItems || null,
        project_name: project.name,
        project_address: project.address || null,
        ai_context: hasData ? JSON.stringify({
          log_entry_count: logEntries.length,
          photo_count: photos.length,
          voice_note_count: voiceNotes.length,
          note_count: notes.length,
        }) : null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to save report' }, { status: 500, headers: corsHeaders() });
    }

    return NextResponse.json({ report, photos_count: photos.length, voice_notes_count: voiceNotes.length }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Report generation error:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500, headers: corsHeaders() });
  }
}
