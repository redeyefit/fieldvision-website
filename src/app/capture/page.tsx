'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import CaptureView from '@/components/capture/CaptureView';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

function CaptureContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project') || 'default';

  return (
    <div className="h-dvh flex flex-col bg-black">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <a href="/" className="text-gray-400 hover:text-white text-sm transition-colors">
          ← Back
        </a>
        <h1 className="text-white font-semibold">Capture</h1>
        <div className="w-12" /> {/* spacer */}
      </header>

      {/* Main capture area */}
      <div className="flex-1 min-h-0">
        <CaptureView projectId={projectId} />
      </div>
    </div>
  );
}

export default function CapturePage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<div className="h-dvh bg-black" />}>
        <CaptureContent />
      </Suspense>
    </ProtectedRoute>
  );
}
