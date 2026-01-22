'use client';

import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import * as pdfjsLib from 'pdfjs-dist';

interface PDFUploaderProps {
  onUpload: (file: File, text: string) => Promise<void>;
  disabled?: boolean;
  pdfUrl?: string | null;
}

// Configure pdf.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

// Extract text from PDF using pdf.js
async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    const numPages = pdf.numPages;

    console.log(`[PDFUploader] Extracting text from ${numPages} pages`);

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .map((item) => {
          if ('str' in item) {
            return item.str;
          }
          return '';
        })
        .join(' ');

      fullText += pageText + '\n\n';
    }

    // Clean up whitespace
    fullText = fullText.replace(/\s+/g, ' ').trim();
    console.log(`[PDFUploader] Extracted ${fullText.length} characters from PDF`);

    return fullText;
  } catch (err) {
    console.error('[PDFUploader] PDF extraction failed:', err);
    return '';
  }
}

export function PDFUploader({ onUpload, disabled, pdfUrl }: PDFUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualText, setManualText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(async (file: File, text?: string) => {
    setIsUploading(true);
    setError(null);

    try {
      let extractedText = text;

      if (!extractedText) {
        extractedText = await extractTextFromPDF(file);
        console.log(`[PDFUploader] Client extracted ${extractedText.length} chars`);
        console.log(`[PDFUploader] Text preview: ${extractedText.substring(0, 500)}`);
      }

      // If client extraction fails, still upload the PDF so the server can parse it.
      if (extractedText.length < 100) {
        console.log('[PDFUploader] Insufficient client text, continuing with server-side parse');
      }

      await onUpload(file, extractedText);
    } catch (err) {
      console.error('[PDFUploader] Error:', err);
      setError((err as Error).message);
    } finally {
      setIsUploading(false);
    }
  }, [onUpload]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF file');
      return;
    }

    await processFile(file);
  }, [processFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    disabled: disabled || isUploading,
  });

  const handleManualSubmit = useCallback(async () => {
    if (!selectedFile || !manualText.trim()) return;
    await processFile(selectedFile, manualText);
    setShowManualInput(false);
    setManualText('');
    setSelectedFile(null);
  }, [selectedFile, manualText, processFile]);

  if (showManualInput) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-fv-gray-300">
          Could not extract text from PDF. Please paste the contract text below:
        </div>
        <textarea
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          placeholder="Paste contract text here..."
          className="w-full h-48 bg-fv-gray-800 border border-fv-gray-700 rounded px-3 py-2 text-sm text-white focus:border-fv-blue focus:outline-none resize-none"
        />
        <div className="flex gap-2">
          <button
            onClick={handleManualSubmit}
            disabled={!manualText.trim() || isUploading}
            className="flex-1 py-2 bg-fv-blue hover:bg-fv-blue-light text-white text-sm font-medium rounded disabled:opacity-50"
          >
            {isUploading ? 'Processing...' : 'Extract Items'}
          </button>
          <button
            onClick={() => {
              setShowManualInput(false);
              setSelectedFile(null);
              setManualText('');
            }}
            className="px-4 py-2 bg-fv-gray-800 hover:bg-fv-gray-700 text-white text-sm rounded"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-fv-blue bg-fv-blue/10' : 'border-fv-gray-700 hover:border-fv-blue'}
          ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />

        {isUploading ? (
          <div className="flex flex-col items-center">
            <svg className="animate-spin w-10 h-10 text-fv-blue mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-sm text-fv-gray-400">Processing PDF...</p>
          </div>
        ) : (
          <>
            <svg className="w-10 h-10 mx-auto text-fv-gray-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-fv-gray-400">
              {isDragActive ? 'Drop PDF here' : 'Drop PDF here or click to browse'}
            </p>
            <p className="text-xs text-fv-gray-600 mt-1">Contract, scope, or bid document</p>
          </>
        )}
      </div>

      {pdfUrl && (
        <div className="flex items-center gap-2 text-sm text-fv-gray-400">
          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>PDF uploaded</span>
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-fv-blue hover:underline">
            View
          </a>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-400 bg-red-900/20 px-3 py-2 rounded">
          {error}
        </div>
      )}
    </div>
  );
}
