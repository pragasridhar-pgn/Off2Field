import { db, type SyncQueueItem, type SyncItemStatus, type SyncOperationType } from "./database";

export interface EnqueueSyncItemParams {
  id?: string;
  entityId: string;
  entityName?: string;
  entityType?: "INSPECTION" | "EVIDENCE";
  operationType: SyncOperationType;
  title?: string;
  machine?: string;
  site?: string;
  status?: SyncItemStatus;
  retryCount?: number;
  lastError?: string;
  payload?: any;
}

/**
 * 1. addSyncQueueItem(item) / enqueueSyncItem(item)
 * Persists a new operation into the local Dexie IndexedDB sync queue.
 */
export async function addSyncQueueItem(
  item: EnqueueSyncItemParams
): Promise<SyncQueueItem> {
  const now = new Date().toISOString();
  const id =
    item.id ||
    `OP-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;

  const record: SyncQueueItem = {
    id,
    entityId: item.entityId,
    entityName: item.entityName || `Entity · ${item.entityId}`,
    entityType: item.entityType || (item.operationType.includes("EVIDENCE") ? "EVIDENCE" : "INSPECTION"),
    operationType: item.operationType,
    title: item.title || `${item.operationType} · ${item.entityId}`,
    machine: item.machine,
    site: item.site,
    status: item.status || "PENDING",
    retryCount: item.retryCount ?? 0,
    lastError: item.lastError,
    payload: item.payload,
    createdAt: now,
    updatedAt: now,
  };

  await db.syncQueue.put(record);
  return record;
}

/**
 * Compatibility alias for addSyncQueueItem
 */
export const enqueueSyncItem = addSyncQueueItem;

/**
 * 2. getSyncQueueItem(id) / getQueueItemById(id)
 * Retrieves a single queue item by ID from IndexedDB.
 */
export async function getSyncQueueItem(id: string): Promise<SyncQueueItem | undefined> {
  return await db.syncQueue.get(id);
}

export const getQueueItemById = getSyncQueueItem;

/**
 * 3. getPendingSyncQueueItems() / getPendingQueueItems()
 * Retrieves all items currently pending synchronization, sorted chronologically (FIFO).
 */
export async function getPendingSyncQueueItems(): Promise<SyncQueueItem[]> {
  const items = await db.syncQueue.toArray();
  return items
    .filter((item) => item.status === "PENDING" || item.status === "FAILED")
    .sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
}

export const getPendingQueueItems = getPendingSyncQueueItems;

/**
 * 4. getAllQueueItems()
 * Retrieves all items in the sync queue, sorted chronologically.
 */
export async function getAllQueueItems(): Promise<SyncQueueItem[]> {
  const items = await db.syncQueue.toArray();
  return items.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

/**
 * 5. updateSyncQueueItem(id, changes) / updateQueueItem(id, changes)
 * Updates a queue item's status, error message, or payload.
 */
export async function updateSyncQueueItem(
  id: string,
  changes: Partial<SyncQueueItem>
): Promise<number> {
  const now = new Date().toISOString();
  return await db.syncQueue.update(id, {
    ...changes,
    updatedAt: changes.updatedAt || now,
  });
}

export const updateQueueItem = updateSyncQueueItem;

/**
 * 6. deleteSyncQueueItem(id) / deleteQueueItem(id)
 * Deletes a specific queue item by ID.
 */
export async function deleteSyncQueueItem(id: string): Promise<void> {
  await db.syncQueue.delete(id);
}

export const deleteQueueItem = deleteSyncQueueItem;

/**
 * 7. markSyncQueueItemProcessing(id)
 * Transitions item to PROCESSING state before performing sync operation.
 */
export async function markSyncQueueItemProcessing(id: string): Promise<void> {
  await updateSyncQueueItem(id, {
    status: "PROCESSING",
  });
}

/**
 * 8. markSyncQueueItemCompleted(id)
 * Transitions item to COMPLETED / SYNCED state with timestamp.
 */
export async function markSyncQueueItemCompleted(id: string): Promise<void> {
  const now = new Date().toISOString();
  await updateSyncQueueItem(id, {
    status: "COMPLETED",
    syncedAt: now,
    lastError: undefined,
  });
}

/**
 * 9. markSyncQueueItemFailed(id, error)
 * Transitions item to FAILED state and stores the error message.
 */
export async function markSyncQueueItemFailed(
  id: string,
  error: string
): Promise<void> {
  await updateSyncQueueItem(id, {
    status: "FAILED",
    lastError: error,
  });
}

/**
 * 10. incrementRetryCount(id, error)
 * Increments the retry counter, updates error description, and marks status.
 */
export async function incrementRetryCount(
  id: string,
  error?: string,
  maxRetries: number = 5
): Promise<{ retryCount: number; maxRetriesExceeded: boolean }> {
  const item = await getSyncQueueItem(id);
  const currentRetries = item?.retryCount ?? 0;
  const newRetryCount = currentRetries + 1;
  const maxRetriesExceeded = newRetryCount >= maxRetries;

  const errorText = maxRetriesExceeded
    ? `${error ? error + " - " : ""}Maximum retry limit (${maxRetries}) reached`
    : error || `Sync failed (attempt ${newRetryCount})`;

  await updateSyncQueueItem(id, {
    retryCount: newRetryCount,
    status: "FAILED",
    lastError: errorText,
  });

  return { retryCount: newRetryCount, maxRetriesExceeded };
}

/**
 * 11. clearSyncedQueue()
 * Clears all already-synced/completed items from the queue.
 */
export async function clearSyncedQueue(): Promise<void> {
  const completed = await db.syncQueue
    .where("status")
    .anyOf(["SYNCED", "COMPLETED"])
    .toArray();
  for (const item of completed) {
    await db.syncQueue.delete(item.id);
  }
}

/**
 * 12. seedInitialQueueIfEmpty()
 * Seeds initial persistent queue operations (Inspection A, B, C) if the queue is empty.
 */
export async function seedInitialQueueIfEmpty(): Promise<SyncQueueItem[]> {
  const count = await db.syncQueue.count();
  if (count > 0) {
    return await getAllQueueItems();
  }

  const now = new Date();
  const timeOffset = (minutesAgo: number) =>
    new Date(now.getTime() - minutesAgo * 60000).toISOString();

  const seedItems: SyncQueueItem[] = [
    {
      id: "OP-SYNC-A101",
      entityId: "INS-2026-TN-0001",
      entityName: "Inspection A",
      entityType: "INSPECTION",
      operationType: "SUBMIT_INSPECTION",
      title: "Inspection A · Transformer T-102 (Full Checklist)",
      machine: "TRF-102",
      site: "Substation A · Chennai North",
      status: "PENDING",
      retryCount: 0,
      payload: {
        id: "INS-2026-TN-0001",
        machine: "TRF-102",
        site: "Substation A",
        status: "SUBMITTED",
        itemsChecked: 7,
        completion: "100%",
        offlineHash: "SHA-8F2B-991A",
      },
      createdAt: timeOffset(24),
      updatedAt: timeOffset(24),
    },
    {
      id: "OP-SYNC-B102",
      entityId: "INS-2026-TN-0002",
      entityName: "Inspection B",
      entityType: "INSPECTION",
      operationType: "SUBMIT_INSPECTION",
      title: "Inspection B · Transformer T-117 (Thermal & Oil Analysis)",
      machine: "TRF-117",
      site: "Substation B · Chennai Central",
      status: "PENDING",
      retryCount: 0,
      payload: {
        id: "INS-2026-TN-0002",
        machine: "TRF-117",
        site: "Substation B",
        status: "SUBMITTED",
        itemsChecked: 7,
        completion: "100%",
        offlineHash: "SHA-4C10-E72D",
      },
      createdAt: timeOffset(15),
      updatedAt: timeOffset(15),
    },
    {
      id: "OP-SYNC-C103",
      entityId: "INS-2026-TN-0003",
      entityName: "Inspection C",
      entityType: "INSPECTION",
      operationType: "SUBMIT_INSPECTION",
      title: "Inspection C · Pump House 4 (Vibration & Pressure Readings)",
      machine: "PMP-301",
      site: "Pump House 4 · Red Hills",
      status: "PENDING",
      retryCount: 0,
      payload: {
        id: "INS-2026-TN-0003",
        machine: "PMP-301",
        site: "Pump House 4",
        status: "PENDING",
        itemsChecked: 6,
        completion: "100%",
        offlineHash: "SHA-31D9-B84A",
      },
      createdAt: timeOffset(5),
      updatedAt: timeOffset(5),
    },
  ];

  for (const item of seedItems) {
    await db.syncQueue.put(item);
  }

  // Also ensure corresponding inspection records exist in IndexedDB
  for (const item of seedItems) {
    const existing = await db.inspections.get(item.entityId);
    if (!existing) {
      await db.inspections.put({
        id: item.entityId,
        machine: item.machine,
        site: item.site,
        status: item.payload.status,
        checklist: [],
        resolved: false,
        submittedAt: item.createdAt,
        syncStatus: "PENDING",
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      });
    }
  }

  return seedItems;
}
