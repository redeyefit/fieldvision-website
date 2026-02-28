/**
 * Regex-based schedule task extraction from PDF text.
 *
 * Shared between client (skip server round-trip when possible) and server (fallback).
 * Handles Gantt chart PDFs with "TaskName MonthName DD, YYYY N days" format.
 */

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

export interface ParsedTask {
  name: string;
  trade: string;
  duration_days: number;
  start_date: string;
  end_date: string;
}

/**
 * Normalize extracted PDF text for regex matching.
 * Strips control chars, normalizes whitespace, ensures proper line breaks.
 */
export function normalizeExtractedText(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Strip control chars (keep \n \r \t)
    .replace(/\r\n?/g, '\n')     // Normalize line endings
    .replace(/\f/g, '\n')        // Form feeds -> newlines
    .replace(/[ \t]+/g, ' ')     // Collapse horizontal whitespace
    .replace(/ ?\n ?/g, '\n')    // Trim spaces around newlines
    .replace(/\n{3,}/g, '\n\n')  // Collapse excessive blank lines
    // Gantt PDF fix: rejoin "N\ndays" split across lines (Y-coord rounding artifact)
    .replace(/(\d+)\ndays?\b/gi, '$1 days');
}

/**
 * Try to extract structured schedule data via regex (no AI needed).
 * Handles Gantt chart PDFs with "TaskName MonthName DD, YYYY N days" format.
 *
 * @returns Array of parsed tasks, or null if fewer than 3 tasks found.
 */
export function tryRegexExtract(rawText: string): ParsedTask[] | null {
  const text = normalizeExtractedText(rawText);
  // Match line-by-line to avoid multiline regex exec() pitfalls with \s consuming newlines
  // Pattern: task name, then month day year, then N day(s), then optional trailing text (bar label)
  const linePattern = /^(.+?)\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d[\d ]*,?\s+\d{4})\s+(\d+)\s+days?(?:\s.*)?$/i;
  const tasks: ParsedTask[] = [];
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

    // Parse start date — collapse split digits like "1 1" -> "11"
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
      trade: 'General', // Trade inference happens at import step
      duration_days: Math.max(1, durationDays),
      start_date: formatDate(startDate),
      end_date: formatDate(endDate),
    });
  }

  return tasks.length >= 3 ? tasks : null; // Need at least 3 tasks to be confident
}
