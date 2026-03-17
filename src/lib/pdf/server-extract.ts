/**
 * Server-side PDF text extraction using pdfjs-dist's Node.js build.
 *
 * IMPORTANT: This does its OWN Y-clustering instead of using the shared
 * extractTextFromPdfDocument function. The shared function somehow produces
 * different (worse) results when run inside Next.js webpack vs standalone Node.js.
 * By inlining the extraction here, we guarantee consistent results.
 *
 * This module runs ONLY on the server (Next.js API routes on Vercel).
 */

interface RawTextItem {
  str: string;
  transform: number[];
}

/**
 * Y-cluster text items into lines (groups items at the same vertical position).
 * Items within TOLERANCE units of Y-distance are considered the same row.
 */
function yClustered(items: RawTextItem[], tolerance = 3): string[] {
  const valid = items
    .filter(it => it.str && it.str.trim() && Array.isArray(it.transform))
    .map(it => ({ x: it.transform[4], y: it.transform[5], text: it.str }));

  if (valid.length === 0) return [];

  // Sort by Y descending (top of page first — PDF Y=0 is bottom)
  valid.sort((a, b) => b.y - a.y);

  const rows: Array<Array<{ x: number; text: string }>> = [];
  let currentRow = [{ x: valid[0].x, text: valid[0].text }];
  let currentY = valid[0].y;

  for (let i = 1; i < valid.length; i++) {
    if (Math.abs(valid[i].y - currentY) <= tolerance) {
      currentRow.push({ x: valid[i].x, text: valid[i].text });
    } else {
      rows.push(currentRow);
      currentRow = [{ x: valid[i].x, text: valid[i].text }];
      currentY = valid[i].y;
    }
  }
  rows.push(currentRow);

  return rows.map(row => {
    row.sort((a, b) => a.x - b.x);
    return row.map(r => r.text).join(' ').trim();
  }).filter(Boolean);
}

/**
 * Extract text from a PDF buffer using pdfjs-dist.
 * Returns clean, Y-clustered text suitable for regex task extraction.
 */
export async function extractTextServerSide(pdfBuffer: ArrayBuffer): Promise<string> {
  // Dynamic import — pdfjs-dist/legacy/build/pdf.mjs works in Node.js without Canvas
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
  }).promise;

  const allLines: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lines = yClustered(content.items as RawTextItem[]);
    allLines.push(...lines);
  }

  const result = allLines.join('\n');
  console.log(`[ServerExtract] ${pdf.numPages} pages, ${allLines.length} lines, ${result.length} chars`);
  return result;
}
