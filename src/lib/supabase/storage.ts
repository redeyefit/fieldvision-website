/**
 * Supabase Storage upload helpers for the PWA capture flow.
 * Uploads photos and voice notes to project-specific paths.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { QueuedItem } from '@/lib/offline-queue';

const BUCKET = 'captures';

function buildPath(projectId: string, type: 'photo' | 'voice', fileName: string): string {
  return `${projectId}/${type}s/${fileName}`;
}

/**
 * Upload a blob to Supabase Storage.
 * Returns the public URL on success, null on failure.
 */
export async function uploadCapture(
  supabase: SupabaseClient,
  projectId: string,
  type: 'photo' | 'voice',
  blob: Blob,
  fileName: string,
  mimeType: string
): Promise<string | null> {
  const path = buildPath(projectId, type, fileName);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    console.error('[storage] upload failed:', error.message);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path);

  return urlData.publicUrl;
}

/**
 * Upload a queued item (from offline queue) to Supabase Storage.
 * Returns true on success.
 */
export async function uploadQueuedItem(
  supabase: SupabaseClient,
  item: QueuedItem
): Promise<boolean> {
  const url = await uploadCapture(
    supabase,
    item.projectId,
    item.type,
    item.blob,
    item.fileName,
    item.mimeType
  );
  return url !== null;
}
