import { db, type SyncQueueItem, type SyncItemStatus, type InspectionRecord } from "./database";

/**
 * Persists a new operation into the local Dexie IndexedDB sync queue.
 */
export async function enqueueSyncItem(
  item: Omit<SyncQueueItem, "id" | "createdAt" | "updatedAt" | "retryCount"> & {
    id?: string;
    retryCount?: number;
  }
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
    entityName: item.entityName,
    operationType: item.operationType,
    title: item.title,
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
 * Retrieves all items in the local persistent sync queue, sorted chronologically.
 */
export async function getAllQueueItems(): Promise<SyncQueueItem[]> {
  const items = await db.syncQueue.toArray();
  return items.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

/**
 * Retrieves all items currently pending synchronization.
 */
export async function getPendingQueueItems(): Promise<SyncQueueItem[]> {
  const items = await db.syncQueue.toArray();
  return items
    .filter((item) => item.status === "PENDING" || item.status === "FAILED")
    .sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
}

/**
 * Updates a queue item's status, error message, or payload.
 */
export async function updateQueueItem(
  id: string,
  changes: Partial<SyncQueueItem>
): Promise<number> {
  const now = new Date().toISOString();
  return await db.syncQueue.update(id, {
    ...changes,
    updatedAt: now,
  });
}

/**
 * Deletes a specific queue item by ID.
 */
export async function deleteQueueItem(id: string): Promise<void> {
  await db.syncQueue.delete(id);
}

/**
 * Clears all already-synced items from the queue.
 */
export async function clearSyncedQueue(): Promise<void> {
  const synced = await db.syncQueue.where("status").equals("SYNCED").toArray();
  for (const item of synced) {
    await db.syncQueue.delete(item.id);
  }
}

/**
 * Seeds initial persistent queue operations (Inspection A, B, C) if the queue is empty.
 * This provides immediate real data reflecting offline operations ready to sync.
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
