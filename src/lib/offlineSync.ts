import { getUnsyncedPunches, removeOfflinePunch } from './offlineQueue';
import { clockInUserInDb, clockOutUserInDb } from './databaseService';

/**
 * AUTO-SYNC ENGINE FOR OFFLINE PUNCHES
 * Automatically syncs queued punches when connection restores.
 */
export async function syncOfflinePunches(): Promise<{ syncedCount: number; remainingCount: number }> {
  if (!navigator.onLine) {
    const unsynced = await getUnsyncedPunches();
    return { syncedCount: 0, remainingCount: unsynced.length };
  }

  const punches = await getUnsyncedPunches();
  if (punches.length === 0) {
    return { syncedCount: 0, remainingCount: 0 };
  }

  let syncedCount = 0;

  for (const punch of punches) {
    try {
      if (punch.type === 'clock_in') {
        await clockInUserInDb(punch.userId, punch.companyId, punch.ipAddress);
        await removeOfflinePunch(punch.id);
        syncedCount++;
      } else if (punch.type === 'clock_out') {
        await clockOutUserInDb(punch.userId);
        await removeOfflinePunch(punch.id);
        syncedCount++;
      }
    } catch (err) {
      console.error(`Failed to sync punch ${punch.id}:`, err);
    }
  }

  const remaining = await getUnsyncedPunches();
  return { syncedCount, remainingCount: remaining.length };
}

/**
 * Initializes automatic background sync on window online event.
 */
export function initAutoSyncListener(onSyncComplete?: (syncedCount: number) => void): () => void {
  const handleOnline = async () => {
    const result = await syncOfflinePunches();
    if (result.syncedCount > 0 && onSyncComplete) {
      onSyncComplete(result.syncedCount);
    }
  };

  window.addEventListener('online', handleOnline);

  return () => {
    window.removeEventListener('online', handleOnline);
  };
}
