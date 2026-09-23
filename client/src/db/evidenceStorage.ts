import { db, type EvidenceRecord, type SyncItemStatus } from "./database";
import { enqueueSyncItem, deleteQueueItem } from "./syncQueueStorage";

export interface CreateEvidenceParams {
  id?: string;
  inspectionId?: string;
  name: string;
  title: string;
  category?: "PHOTO" | "DOCUMENT" | "REPORT";
  mimeType?: string;
  size?: number;
  dataUrl: string;
  syncStatus?: SyncItemStatus;
}

/**
 * Saves a photo or file locally into Dexie IndexedDB (db.evidence)
 * and automatically enqueues a PENDING operation into the Sync Queue.
 *
 * Pipeline: Photo/File -> IndexedDB -> PENDING -> Sync later
 */
export async function saveEvidenceLocally(
  params: CreateEvidenceParams
): Promise<EvidenceRecord> {
  const now = new Date().toISOString();
  const id =
    params.id ||
    `EVD-2026-${Math.floor(10000 + Math.random() * 90000)}`;

  const inspectionId = params.inspectionId || "INS-2026-TN-0001";
  const title = params.title || params.name.replace(/\.[^/.]+$/, "");
  const mimeType = params.mimeType || "image/jpeg";
  const size = params.size || Math.round(params.dataUrl.length * 0.75);
  const status: SyncItemStatus = params.syncStatus || "PENDING";

  // Step 1: Enqueue in Sync Queue if PENDING
  let queueItemId: string | undefined = undefined;
  if (status === "PENDING") {
    const queueItem = await enqueueSyncItem({
      entityId: id,
      entityName: `Evidence · ${id}`,
      operationType: "UPLOAD_EVIDENCE",
      title: `Evidence ${id} · ${title}`,
      machine: inspectionId,
      site: "Offline Local Storage",
      status: "PENDING",
      payload: {
        evidenceId: id,
        inspectionId,
        name: params.name,
        title,
        mimeType,
        size,
        dataUrlPreview: params.dataUrl.slice(0, 100) + "...",
      },
    });
    queueItemId = queueItem.id;
  }

  // Step 2: Persist photo/file record in Dexie IndexedDB
  const record: EvidenceRecord = {
    id,
    inspectionId,
    name: params.name,
    title,
    category: params.category || "PHOTO",
    mimeType,
    size,
    dataUrl: params.dataUrl,
    syncStatus: status,
    queueItemId,
    createdAt: now,
    updatedAt: now,
    syncedAt: status === "SYNCED" ? now : undefined,
  };

  await db.evidence.put(record);
  return record;
}

/**
 * Retrieves all evidence files from IndexedDB, sorted newest first.
 */
export async function getAllEvidence(): Promise<EvidenceRecord[]> {
  const items = await db.evidence.toArray();
  return items.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Retrieves a single evidence file by ID from IndexedDB.
 */
export async function getEvidenceById(
  id: string
): Promise<EvidenceRecord | undefined> {
  return await db.evidence.get(id);
}

/**
 * Deletes an evidence file from IndexedDB and cleans up any related sync queue item.
 */
export async function deleteEvidenceLocally(id: string): Promise<void> {
  const record = await db.evidence.get(id);
  if (record && record.queueItemId) {
    await deleteQueueItem(record.queueItemId);
  }
  await db.evidence.delete(id);
}

/**
 * Updates the sync status of an evidence item in IndexedDB.
 */
export async function updateEvidenceStatus(
  id: string,
  syncStatus: SyncItemStatus,
  syncedAt?: string
): Promise<void> {
  await db.evidence.update(id, {
    syncStatus,
    updatedAt: new Date().toISOString(),
    ...(syncedAt ? { syncedAt } : {}),
  });
}

/**
 * Helper to generate simple colorful placeholder SVG dataUrls
 * for seeded evidence items to guarantee offline visual rendering.
 */
function createSvgDataUrl(title: string, color: string, iconType: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
    <rect width="400" height="300" fill="${color}"/>
    <circle cx="200" cy="130" r="46" fill="rgba(255,255,255,0.2)"/>
    <text x="200" y="140" fill="#ffffff" font-size="28" font-family="system-ui, sans-serif" font-weight="bold" text-anchor="middle">${iconType}</text>
    <text x="200" y="210" fill="#ffffff" font-size="16" font-family="system-ui, sans-serif" font-weight="600" text-anchor="middle">${title}</text>
    <text x="200" y="235" fill="rgba(255,255,255,0.8)" font-size="12" font-family="system-ui, sans-serif" text-anchor="middle">Stored in IndexedDB (Offline)</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Seeds initial persistent evidence records into IndexedDB if table is empty.
 * Matches user's real inspection items with both PENDING and SYNCED states.
 */
export async function seedInitialEvidenceIfEmpty(): Promise<EvidenceRecord[]> {
  const count = await db.evidence.count();
  if (count > 0) {
    return await getAllEvidence();
  }

  const now = new Date();
  const timeOffset = (minutesAgo: number) =>
    new Date(now.getTime() - minutesAgo * 60000).toISOString();

  // 1. EVD-2026-00001 (Uploaded / SYNCED)
  const ev1: EvidenceRecord = {
    id: "EVD-2026-00001",
    inspectionId: "INS-2026-TN-0001",
    name: "oil_temperature_gauge.jpg",
    title: "Oil temperature gauge",
    category: "PHOTO",
    mimeType: "image/svg+xml",
    size: 24576,
    dataUrl: createSvgDataUrl("Oil Temp Gauge · 78°C", "#d97706", "🌡️"),
    syncStatus: "SYNCED",
    createdAt: timeOffset(75),
    updatedAt: timeOffset(70),
    syncedAt: timeOffset(70),
  };

  // 2. EVD-2026-00002 (Saved locally / PENDING - with real sync queue item)
  const ev2Queue = await enqueueSyncItem({
    id: "OP-SYNC-EVD02",
    entityId: "EVD-2026-00002",
    entityName: "Evidence · EVD-2026-00002",
    operationType: "UPLOAD_EVIDENCE",
    title: "Evidence EVD-2026-00002 · Equipment condition (Photo)",
    machine: "INS-2026-TN-0001",
    site: "Substation A · Chennai North",
    status: "PENDING",
    payload: {
      evidenceId: "EVD-2026-00002",
      inspectionId: "INS-2026-TN-0001",
      name: "equipment_condition.jpg",
      title: "Equipment condition",
      size: 42100,
    },
  });

  const ev2: EvidenceRecord = {
    id: "EVD-2026-00002",
    inspectionId: "INS-2026-TN-0001",
    name: "equipment_condition.jpg",
    title: "Equipment condition",
    category: "PHOTO",
    mimeType: "image/svg+xml",
    size: 42100,
    dataUrl: createSvgDataUrl("Equipment Condition Check", "#2563eb", "📷"),
    syncStatus: "PENDING",
    queueItemId: ev2Queue.id,
    createdAt: timeOffset(72),
    updatedAt: timeOffset(72),
  };

  // 3. EVD-2026-00003 (Uploaded / SYNCED)
  const ev3: EvidenceRecord = {
    id: "EVD-2026-00003",
    inspectionId: "INS-2026-TN-0002",
    name: "safety_lockout_tag.jpg",
    title: "Safety lockout tag",
    category: "PHOTO",
    mimeType: "image/svg+xml",
    size: 31200,
    dataUrl: createSvgDataUrl("Safety Lockout Tag #LOTO-44", "#7c3aed", "🔒"),
    syncStatus: "SYNCED",
    createdAt: timeOffset(68),
    updatedAt: timeOffset(65),
    syncedAt: timeOffset(65),
  };

  // 4. EVD-2026-00004 (Uploaded / SYNCED)
  const ev4: EvidenceRecord = {
    id: "EVD-2026-00004",
    inspectionId: "INS-2026-TN-0001",
    name: "transformer_nameplate.jpg",
    title: "Transformer nameplate",
    category: "PHOTO",
    mimeType: "image/svg+xml",
    size: 28400,
    dataUrl: createSvgDataUrl("TRF-102 Nameplate Spec", "#059669", "📋"),
    syncStatus: "SYNCED",
    createdAt: timeOffset(62),
    updatedAt: timeOffset(60),
    syncedAt: timeOffset(60),
  };

  await db.evidence.bulkPut([ev1, ev2, ev3, ev4]);
  return [ev1, ev2, ev3, ev4];
}
