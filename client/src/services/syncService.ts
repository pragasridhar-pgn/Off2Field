import {
  getPendingSyncQueueItems,
  getSyncQueueItem,
  updateSyncQueueItem,
  markSyncQueueItemProcessing,
  markSyncQueueItemCompleted,
  markSyncQueueItemFailed,
  incrementRetryCount,
  getAllQueueItems,
} from "../db/syncQueueStorage";
import { getInspection } from "../db/inspectionStorage";
import { getEvidence } from "../db/evidenceStorage";
import { type SyncQueueItem } from "../db/database";
import { getOnlineStatus } from "../utils/networkStatus";
import { firebaseSyncProvider } from "./firebaseSyncProvider";
import { getCurrentUser } from "./authService";

/**
 * Phase 2 Sync Adapter Interface.
 * Implemented by FirebaseSyncProvider (Firestore + Firebase Storage).
 */
export interface SyncProvider {
  name: string;
  syncInspection(item: SyncQueueItem): Promise<{ success: boolean; error?: string }>;
  syncEvidence(item: SyncQueueItem): Promise<{ success: boolean; error?: string }>;
  deleteEvidence(item: SyncQueueItem): Promise<{ success: boolean; error?: string }>;
}

export interface SyncProcessResult {
  processed: number;
  succeeded: number;
  failed: number;
  remainingPending: number;
  message: string;
}

export const MAX_SYNC_RETRIES = 5;

// Default to FirebaseSyncProvider for Phase 2
let activeCloudProvider: SyncProvider | null = firebaseSyncProvider;

/**
 * Allows registering a custom or mock sync provider (useful for testing or multi-backend).
 */
export function registerSyncProvider(provider: SyncProvider | null) {
  activeCloudProvider = provider;
}

/**
 * Returns the currently registered cloud provider.
 */
export function getActiveSyncProvider(): SyncProvider | null {
  return activeCloudProvider;
}

/**
 * Processes a single sync queue item through the sync pipeline.
 */
export async function processSingleQueueItem(
  id: string,
  forceOfflineCheck: boolean = false
): Promise<{ success: boolean; status: string; error?: string }> {
  const item = await getSyncQueueItem(id);
  if (!item) {
    return { success: false, status: "NOT_FOUND", error: "Queue item not found" };
  }

  if (item.retryCount >= MAX_SYNC_RETRIES) {
    return {
      success: false,
      status: "MAX_RETRIES_EXCEEDED",
      error: `Max retries (${MAX_SYNC_RETRIES}) reached. Requires manual inspection.`,
    };
  }

  // 1. Mark PROCESSING
  await markSyncQueueItemProcessing(id);

  // 2. Check network connectivity
  const isOnline = forceOfflineCheck ? true : getOnlineStatus();

  if (!isOnline) {
    await markSyncQueueItemFailed(id, "Device is offline. Queued locally for sync.");
    return { success: false, status: "OFFLINE", error: "Device is offline" };
  }

  // 3. Remote Cloud Provider Execution
  if (activeCloudProvider) {
    // If it is specifically the Firebase provider, verify authentication
    if (activeCloudProvider.name === "FirebaseSyncProvider") {
      const user = getCurrentUser();
      if (!user) {
        await updateSyncQueueItem(id, {
          status: "PENDING",
          lastError: "Authentication required for cloud synchronization.",
        });
        return {
          success: false,
          status: "UNAUTHENTICATED",
          error: "User is not authenticated. Please sign in to sync.",
        };
      }
    }

    try {
      let result: { success: boolean; error?: string } = { success: false, error: "Unsupported operation" };
      const op = (item.operationType || "").toUpperCase();

      if (op.includes("EVIDENCE") && (op.includes("DELETE") || op === "DELETE")) {
        result = await activeCloudProvider.deleteEvidence(item);
      } else if (op.includes("EVIDENCE")) {
        result = await activeCloudProvider.syncEvidence(item);
      } else {
        result = await activeCloudProvider.syncInspection(item);
      }

      if (result.success) {
        await markSyncQueueItemCompleted(id);
        return { success: true, status: "COMPLETED" };
      } else {
        await incrementRetryCount(id, result.error, MAX_SYNC_RETRIES);
        return { success: false, status: "FAILED", error: result.error };
      }
    } catch (err: any) {
      const errorMsg = err?.message || "Sync execution error";
      await incrementRetryCount(id, errorMsg, MAX_SYNC_RETRIES);
      return { success: false, status: "FAILED", error: errorMsg };
    }
  }

  // 4. Local Offline Verification Mode (when no remote provider is registered):
  try {
    if (item.operationType.includes("EVIDENCE")) {
      await getEvidence(item.entityId);
    } else {
      await getInspection(item.entityId);
    }
    await updateSyncQueueItem(id, { status: "PENDING" });
    return {
      success: true,
      status: "PENDING",
      error: "Local queue operation verified",
    };
  } catch (err: any) {
    await incrementRetryCount(id, err?.message || "Local validation failed", MAX_SYNC_RETRIES);
    return { success: false, status: "FAILED", error: err?.message };
  }
}

/**
 * Processes all pending queue items sequentially in FIFO order (createdAt).
 */
export async function processSyncQueue(): Promise<SyncProcessResult> {
  const isOnline = getOnlineStatus();
  const pendingItems = await getPendingSyncQueueItems();

  if (pendingItems.length === 0) {
    return {
      processed: 0,
      succeeded: 0,
      failed: 0,
      remainingPending: 0,
      message: "No pending operations in sync queue.",
    };
  }

  if (!isOnline) {
    return {
      processed: 0,
      succeeded: 0,
      failed: 0,
      remainingPending: pendingItems.length,
      message: `Device is offline. ${pendingItems.length} operation(s) safely queued locally in IndexedDB.`,
    };
  }

  // If Firebase provider is active, check auth
  if (activeCloudProvider?.name === "FirebaseSyncProvider") {
    const user = getCurrentUser();
    if (!user) {
      return {
        processed: 0,
        succeeded: 0,
        failed: pendingItems.length,
        remainingPending: pendingItems.length,
        message: `Please sign in to sync ${pendingItems.length} pending operation(s) to Firebase.`,
      };
    }
  }

  let succeeded = 0;
  let failed = 0;

  for (const item of pendingItems) {
    if (item.retryCount >= MAX_SYNC_RETRIES) {
      failed++;
      continue;
    }

    const res = await processSingleQueueItem(item.id);
    if (res.success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  const remaining = await getPendingSyncQueueItems();

  return {
    processed: pendingItems.length,
    succeeded,
    failed,
    remainingPending: remaining.length,
    message: activeCloudProvider
      ? `Processed ${pendingItems.length} operations (${succeeded} synced to cloud, ${failed} failed).`
      : `Local offline queue verified (${pendingItems.length} pending operations ready for cloud sync).`,
  };
}

/**
 * Retries a specific failed queue item by resetting its status to PENDING and attempting sync.
 */
export async function retryQueueItem(id: string): Promise<SyncQueueItem | undefined> {
  const item = await getSyncQueueItem(id);
  if (!item) return undefined;

  await updateSyncQueueItem(id, { status: "PENDING", retryCount: 0, lastError: undefined });
  await processSingleQueueItem(id);
  const updated = await getSyncQueueItem(id);
  return updated;
}

/**
 * Returns a summary of queue items by status.
 */
export async function getQueueSyncSummary(): Promise<{
  total: number;
  pending: number;
  processing: number;
  synced: number;
  failed: number;
}> {
  const items = await getAllQueueItems();
  return {
    total: items.length,
    pending: items.filter((x) => x.status === "PENDING").length,
    processing: items.filter((x) => x.status === "PROCESSING" || x.status === "SYNCING").length,
    synced: items.filter((x) => x.status === "SYNCED" || x.status === "COMPLETED").length,
    failed: items.filter((x) => x.status === "FAILED").length,
  };
}
