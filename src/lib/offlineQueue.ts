/**
 * OFFLINE ATTENDANCE QUEUE - INDEXEDDB STORAGE MANAGER
 * Manages local client storage for punches performed while offline.
 */

export interface OfflinePunch {
  id: string;
  userId: string;
  companyId: string;
  type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end';
  timestamp: string;
  date: string;
  ipAddress?: string;
  latitude?: number;
  longitude?: number;
  synced: boolean;
}

const DB_NAME = 'OsanAttendanceOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'offline_punches';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this browser environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('synced', 'synced', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

/**
 * Queue a new punch locally in IndexedDB when offline.
 */
export async function saveOfflinePunch(punch: Omit<OfflinePunch, 'id' | 'synced'>): Promise<OfflinePunch> {
  const db = await openDB();
  const fullPunch: OfflinePunch = {
    ...punch,
    id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    synced: false
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(fullPunch);

    request.onsuccess = () => resolve(fullPunch);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all unsynced offline punches.
 */
export async function getUnsyncedPunches(): Promise<OfflinePunch[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const all = request.result as OfflinePunch[];
        resolve(all.filter(p => !p.synced));
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to read unsynced punches:', err);
    return [];
  }
}

/**
 * Mark a punch as synced or remove it after uploading to Supabase.
 */
export async function removeOfflinePunch(id: string): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(false);
    });
  } catch (err) {
    console.error('Failed to remove offline punch:', err);
    return false;
  }
}
