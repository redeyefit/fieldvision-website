/**
 * PDF text extraction with proper line reconstruction.
 *
 * pdfjs-dist returns text items with transform matrices. For Gantt chart PDFs,
 * naive joining destroys line structure that regex parsing depends on.
 *
 * Two strategies:
 * 1. Y-clustering: groups items by Y-coordinate, sorts by X within each row
 * 2. Sequential: follows pdfjs-dist's item order, using hasEOL for line breaks
 *
 * We try both and return whichever produces more regex task matches,
 * because the browser's full font decoding can produce very different items
 * than what Node.js sees (more calendar grid items that contaminate Y-clusters).
 */

import type { TextItem } from 'pdfjs-dist/types/src/display/api';

interface TextItemWithTransform {
  str: string;
  transform: number[];
  hasEOL?: boolean;
}

function isTextItemWithTransform(item: unknown): item is TextItemWithTransform {
  return (
    typeof item === 'object' &&
    item !== null &&
    'str' in item &&
    'transform' in item &&
    typeof (item as TextItemWithTransform).str === 'string' &&
    Array.isArray((item as TextItemWithTransform).transform)
  );
}

/**
 * Strategy 1: Y-clustering extraction.
 * Groups items by Y-coordinate (tolerance-based), sorts by X within each row.
 */
function extractYClustered(items: TextItem[]): string {
  const TOLERANCE = 3;

  const textItems: Array<{ x: number; y: number; text: string }> = [];
  for (const item of items) {
    if (!isTextItemWithTransform(item) || !item.str.trim()) continue;
    textItems.push({
      x: item.transform[4],
      y: item.transform[5],
      text: item.str,
    });
  }

  if (textItems.length === 0) return '';

  // Sort by Y descending (top of page first — PDF Y=0 is bottom)
  textItems.sort((a, b) => b.y - a.y);

  // Cluster items into rows
  const rows: Array<Array<{ x: number; text: string }>> = [];
  let currentRow: Array<{ x: number; text: string }> = [{ x: textItems[0].x, text: textItems[0].text }];
  let currentY = textItems[0].y;

  for (let i = 1; i < textItems.length; i++) {
    const item = textItems[i];
    if (Math.abs(item.y - currentY) <= TOLERANCE) {
      currentRow.push({ x: item.x, text: item.text });
    } else {
      rows.push(currentRow);
      currentRow = [{ x: item.x, text: item.text }];
      currentY = item.y;
    }
  }
  rows.push(currentRow);

  const lines: string[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    const line = row.map((item) => item.text).join(' ').trim();
    if (line) lines.push(line);
  }

  return lines.join('\n');
}

/**
 * Strategy 2: Sequential extraction using pdfjs-dist's native item order.
 * Uses hasEOL flags and Y-gap detection for line breaks.
 * This works better when the browser's font decoder produces many extra items
 * that contaminate Y-clusters (e.g., Gantt chart calendar grid elements).
 */
function extractSequential(items: TextItem[]): string {
  const parts: string[] = [];
  let lastY: number | null = null;

  for (const item of items) {
    if (!isTextItemWithTransform(item)) continue;
    const text = item.str;
    const y = item.transform[5];

    // Detect line break: large Y gap (> 5 units) or hasEOL flag
    if (lastY !== null && Math.abs(y - lastY) > 5) {
      parts.push('\n');
    }

    if (text.trim()) {
      parts.push(text);
    }

    // pdfjs-dist sets hasEOL when it detects end-of-line
    if ((item as TextItemWithTransform).hasEOL) {
      parts.push('\n');
    }

    lastY = y;
  }

  // Clean up: collapse multiple spaces, normalize line endings
  return parts
    .join(' ')
    .replace(/ *\n */g, '\n')
    .replace(/ +/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extract text from a single PDF page's text content items.
 * Returns the Y-clustered version (preserves spatial layout).
 */
export function reconstructPageText(items: TextItem[]): string {
  return extractYClustered(items);
}

/**
 * Extract text from an entire PDF document.
 * Tries both Y-clustering and sequential extraction strategies,
 * returning whichever produces more regex-matchable task lines.
 *
 * @param maxChars - Cap output size to avoid oversized request bodies (default 100KB)
 */
export async function extractTextFromPdfDocument(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdf: { numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: any[] }> }> },
  maxChars: number = 100_000
): Promise<string> {
  const clusteredPages: string[] = [];
  const sequentialPages: string[] = [];
  let clusteredChars = 0;
  let sequentialChars = 0;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const typedItems = content.items as TextItem[];

    const clusteredText = extractYClustered(typedItems);
    const sequentialText = extractSequential(typedItems);

    clusteredChars += clusteredText.length;
    sequentialChars += sequentialText.length;

    if (clusteredChars <= maxChars) {
      clusteredPages.push(clusteredText);
    }
    if (sequentialChars <= maxChars) {
      sequentialPages.push(sequentialText);
    }

    if (clusteredChars > maxChars && sequentialChars > maxChars) break;
  }

  const clusteredResult = clusteredPages.join('\n\n');
  const sequentialResult = sequentialPages.join('\n\n');

  // Quick heuristic: count lines matching the Gantt schedule pattern
  // Pick whichever extraction method produces more task-like lines
  const taskPattern = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d[\d ]*,?\s+\d{4}\s+\d+\s+days?/i;
  const clusteredMatches = clusteredResult.split('\n').filter(l => taskPattern.test(l)).length;
  const sequentialMatches = sequentialResult.split('\n').filter(l => taskPattern.test(l)).length;

  console.log(`[PDF Extract] Y-clustered: ${clusteredResult.length} chars, ${clusteredMatches} task lines`);
  console.log(`[PDF Extract] Sequential: ${sequentialResult.length} chars, ${sequentialMatches} task lines`);

  if (sequentialMatches > clusteredMatches) {
    console.log('[PDF Extract] Using sequential extraction (more task lines)');
    return sequentialResult;
  }

  // Default to whichever is longer if neither has clear wins
  if (clusteredMatches === 0 && sequentialMatches === 0) {
    const result = sequentialResult.length > clusteredResult.length ? sequentialResult : clusteredResult;
    console.log(`[PDF Extract] No task lines in either — using ${result === sequentialResult ? 'sequential' : 'clustered'} (longer)`);
    return result;
  }

  return clusteredResult;
}
