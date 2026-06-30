'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCamera } from '@/hooks/useCamera';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { uploadCapture, uploadQueuedItem } from '@/lib/supabase/storage';
import { enqueue, getPendingCount, startAutoSync } from '@/lib/offline-queue';
import type { QueuedItem } from '@/lib/offline-queue';

type Tab = 'camera' | 'gallery' | 'voice';

interface CapturedItem {
  id: string;
  type: 'photo' | 'voice';
  previewUrl: string;
  status: 'uploading' | 'done' | 'queued' | 'error';
  name: string;
}

export default function CaptureView({ projectId }: { projectId: string }) {
  const { supabase, isOffline } = useAuth();
  const camera = useCamera();
  const recorder = useVoiceRecorder();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<Tab>('camera');
  const [captures, setCaptures] = useState<CapturedItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  // --- Auto-sync offline queue ---
  useEffect(() => {
    if (!supabase) return;

    const cleanup = startAutoSync(async (item: QueuedItem) => {
      return uploadQueuedItem(supabase, item);
    });

    // Update pending count periodically
    const countTimer = setInterval(async () => {
      const count = await getPendingCount();
      setPendingCount(count);
    }, 5000);

    // Initial count
    getPendingCount().then(setPendingCount);

    return () => {
      cleanup();
      clearInterval(countTimer);
    };
  }, [supabase]);

  // --- Upload or queue a blob ---
  const handleUpload = useCallback(
    async (blob: Blob, type: 'photo' | 'voice', mimeType: string) => {
      const ext = type === 'photo' ? 'jpg' : 'webm';
      const fileName = `${type}_${Date.now()}.${ext}`;
      const previewUrl = URL.createObjectURL(blob);
      const itemId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      const capturedItem: CapturedItem = {
        id: itemId,
        type,
        previewUrl,
        status: 'uploading',
        name: fileName,
      };

      setCaptures((prev) => [capturedItem, ...prev]);

      if (!navigator.onLine || !supabase) {
        // Queue for later
        await enqueue({
          type,
          blob,
          fileName,
          projectId,
          mimeType,
          createdAt: Date.now(),
        });
        setCaptures((prev) =>
          prev.map((c) => (c.id === itemId ? { ...c, status: 'queued' } : c))
        );
        const count = await getPendingCount();
        setPendingCount(count);
        return;
      }

      const url = await uploadCapture(supabase, projectId, type, blob, fileName, mimeType);

      setCaptures((prev) =>
        prev.map((c) =>
          c.id === itemId ? { ...c, status: url ? 'done' : 'error' } : c
        )
      );
    },
    [supabase, projectId]
  );

  // --- Camera capture ---
  const handleCameraCapture = useCallback(() => {
    const blob = camera.capturePhoto();
    if (blob) {
      handleUpload(blob, 'photo', 'image/jpeg');
    }
  }, [camera, handleUpload]);

  // --- Gallery pick ---
  const handleGalleryPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      Array.from(files).forEach((file) => {
        handleUpload(file, 'photo', file.type || 'image/jpeg');
      });
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [handleUpload]
  );

  // --- Voice stop ---
  const handleVoiceStop = useCallback(async () => {
    const blob = await recorder.stopRecording();
    if (blob) {
      handleUpload(blob, 'voice', 'audio/webm');
    }
  }, [recorder, handleUpload]);

  // Format duration mm:ss
  const formatDuration = (s: number) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="flex flex-col h-full bg-black text-white">
      {/* Pending badge */}
      {pendingCount > 0 && (
        <div className="bg-yellow-600 text-center text-sm py-1 px-3">
          {pendingCount} item{pendingCount !== 1 ? 's' : ''} waiting to upload
          {isOffline ? ' (offline)' : ' — syncing…'}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-gray-800">
        {(['camera', 'gallery', 'voice'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              if (tab !== 'camera' && camera.isActive) camera.stopCamera();
            }}
            className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400'
            }`}
          >
            {tab === 'camera' && '📷 '}
            {tab === 'gallery' && '🖼️ '}
            {tab === 'voice' && '🎙️ '}
            {tab}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-0">
        {/* === CAMERA TAB === */}
        {activeTab === 'camera' && (
          <div className="flex flex-col items-center gap-4 w-full max-w-lg">
            {camera.error && (
              <p className="text-red-400 text-sm">{camera.error}</p>
            )}

            <div className="relative w-full aspect-[4/3] bg-gray-900 rounded-lg overflow-hidden">
              <video
                ref={camera.videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {!camera.isActive && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <button
                    onClick={camera.startCamera}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-full text-lg font-medium transition-colors"
                  >
                    Start Camera
                  </button>
                </div>
              )}
            </div>

            {camera.isActive && (
              <div className="flex gap-3">
                <button
                  onClick={handleCameraCapture}
                  className="w-16 h-16 rounded-full bg-white border-4 border-gray-400 hover:border-blue-400 transition-colors"
                  aria-label="Take photo"
                />
                <button
                  onClick={camera.toggleFacing}
                  className="w-12 h-12 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-xl transition-colors"
                  aria-label="Switch camera"
                >
                  🔄
                </button>
                <button
                  onClick={camera.stopCamera}
                  className="w-12 h-12 rounded-full bg-red-800 hover:bg-red-700 flex items-center justify-center text-sm transition-colors"
                >
                  Stop
                </button>
              </div>
            )}
          </div>
        )}

        {/* === GALLERY TAB === */}
        {activeTab === 'gallery' && (
          <div className="flex flex-col items-center gap-4 w-full max-w-lg">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleGalleryPick}
              className="hidden"
              id="gallery-input"
            />
            <label
              htmlFor="gallery-input"
              className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl text-lg font-medium transition-colors"
            >
              Choose Photos
            </label>
            <p className="text-gray-400 text-sm">Select one or more photos from your device</p>
          </div>
        )}

        {/* === VOICE TAB === */}
        {activeTab === 'voice' && (
          <div className="flex flex-col items-center gap-4 w-full max-w-lg">
            {recorder.error && (
              <p className="text-red-400 text-sm">{recorder.error}</p>
            )}

            <div className="text-5xl font-mono tabular-nums">
              {formatDuration(recorder.duration)}
            </div>

            {!recorder.isRecording ? (
              <button
                onClick={recorder.startRecording}
                className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors"
                aria-label="Start recording"
              >
                <div className="w-8 h-8 rounded-full bg-white" />
              </button>
            ) : (
              <button
                onClick={handleVoiceStop}
                className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center animate-pulse transition-colors"
                aria-label="Stop recording"
              >
                <div className="w-8 h-8 rounded bg-white" />
              </button>
            )}

            <p className="text-gray-400 text-sm">
              {recorder.isRecording ? 'Tap to stop' : 'Tap to record a voice note'}
            </p>
          </div>
        )}
      </div>

      {/* Captured items list */}
      {captures.length > 0 && (
        <div className="border-t border-gray-800 max-h-48 overflow-y-auto">
          <div className="p-3 space-y-2">
            {captures.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 bg-gray-900 rounded-lg p-2"
              >
                {item.type === 'photo' ? (
                  <img
                    src={item.previewUrl}
                    alt=""
                    className="w-12 h-12 rounded object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded bg-gray-800 flex items-center justify-center text-lg">
                    🎙️
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{item.name}</p>
                  <p className="text-xs text-gray-400">
                    {item.status === 'uploading' && 'Uploading…'}
                    {item.status === 'done' && '✓ Uploaded'}
                    {item.status === 'queued' && '⏳ Queued (offline)'}
                    {item.status === 'error' && '✗ Failed'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
