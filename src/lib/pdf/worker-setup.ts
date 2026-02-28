/**
 * PDF.js worker setup — serves worker locally instead of CDN.
 *
 * CDN workers (cdnjs.cloudflare.com) can fail silently due to CSP, ad blockers,
 * or network restrictions, causing client PDF extraction to return empty text.
 *
 * The worker file is copied to public/ via postinstall script in package.json.
 */

import type * as PdfjsLib from 'pdfjs-dist';

let initialized = false;

export function setupPdfWorker(pdfjsLib: typeof PdfjsLib) {
  if (initialized || typeof window === 'undefined') return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  initialized = true;
}
