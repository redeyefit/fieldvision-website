/**
 * Offline queue — stores captured media in IndexedDB when offline,
 * syncs to Supabase Storage when connectivity returns.
 */
import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'fv-offline-queue';
const DB_VERSION = 1;
const STORE_NAME = 'pending-uploads';

export interface QueuedItem {
  id?: number; // auto-incremented
  type: 'photo' | 'voice';
  blob: Blob;
  fileName: string;
  projectId: string;
  mimeType: string;
  createdAt: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('by-project', 'projectId');
          store.createIndex('by-type', 'type');
        }
      },
    });
  }
  return dbPromise;
}

/** Add a captured item to the offline queue */
export async function enqueue(item: Omit<QueuedItem, 'id'>): Promise<number> {
  const db = await getDB();
  const id = await db.add(STORE_NAME, item);
  return id as number;
}

/** Get all pending items */
export async function getPending(): Promise<QueuedItem[]> {
  const db = await getDB();
  return db.getAll(STORE_NAME);
}

/** Get pending count */
export async function getPendingCount(): Promise<number> {
  const db = await getDB();
  return db.count(STORE_NAME);
}

/** Remove an item after successful upload */
export async function dequeue(id: number): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

/** Clear all items (e.g., after full sync) */
export async function clearAll(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE_NAME);
}

// --- Sync engine ---

type UploadFn = (item: QueuedItem) => Promise<boolean>;

let syncing = false;

/**
 * Process the queue — upload each item, remove on success.
 * Returns the number of items successfully synced.
 */
export async function syncQueue(uploadFn: UploadFn): Promise<number> {
  if (syncing || !navigator.onLine) return 0;
  syncing = true;

  let synced = 0;
  try {
    const items = await getPending();
    for (const item of items) {
      if (!navigator.onLine) break;
      try {
        const ok = await uploadFn(item);
        if (ok && item.id !== undefined) {
          await dequeue(item.id);
          synced++;
        }
      } catch {
        // Individual item failed — skip, retry next sync
        break;
      }
    }
  } finally {
    syncing = false;
  }
  return synced;
}

/**
 * Start auto-sync: listen for online events and periodically retry.
 * Returns a cleanup function.
 */
export function startAutoSync(uploadFn: UploadFn, intervalMs = 30_000): () => void {
  const handleOnline = () => {
    syncQueue(uploadFn);
  };
  window.addEventListener('online', handleOnline);

  const timer = setInterval(() => {
    if (navigator.onLine) syncQueue(uploadFn);
  }, intervalMs);

  // Attempt immediate sync
  if (navigator.onLine) syncQueue(uploadFn);

  return () => {
    window.removeEventListener('online', handleOnline);
    clearInterval(timer);
  };
}
