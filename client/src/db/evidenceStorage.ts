import { db, type EvidenceRecord, type SyncItemStatus } from "./database";
import { enqueueSyncItem, deleteQueueItem } from "./syncQueueStorage";

export interface CreateEvidenceParams {
  id?: string;
  inspectionId?: string;
  fileName?: string;
  name?: string;
  title?: string;
  description?: string;
  category?: "PHOTO" | "DOCUMENT" | "REPORT";
  fileType?: string;
  mimeType?: string;
  fileSize?: number;
  size?: number;
  blob?: Blob;
  dataUrl?: string;
  syncStatus?: "PENDING" | "SYNCED" | "FAILED";
}

/**
 * PART 2 — Core Evidence Storage Service Functions
 */

/**
 * 1. saveEvidence(record)
 * Stores an evidence record with Blob directly in Dexie IndexedDB.
 */
export async function saveEvidence(record: EvidenceRecord): Promise<string> {
  await db.evidence.put(record);
  return record.id;
}

/**
 * 2. getEvidence(id)
 * Retrieves a single evidence record by ID from IndexedDB.
 */
export async function getEvidence(id: string): Promise<EvidenceRecord | undefined> {
  return await db.evidence.get(id);
}

/**
 * 3. getEvidenceForInspection(inspectionId)
 * Retrieves all evidence records belonging to a specific inspection.
 */
export async function getEvidenceForInspection(
  inspectionId: string
): Promise<EvidenceRecord[]> {
  const items = await db.evidence.where("inspectionId").equals(inspectionId).toArray();
  return items.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * 4. getAllEvidence()
 * Retrieves all evidence records from IndexedDB, sorted newest first.
 */
export async function getAllEvidence(): Promise<EvidenceRecord[]> {
  const items = await db.evidence.toArray();
  return items.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * 5. updateEvidence(id, changes)
 * Updates only the supplied fields of an existing evidence record.
 */
export async function updateEvidence(
  id: string,
  changes: Partial<EvidenceRecord>
): Promise<number> {
  return await db.evidence.update(id, {
    ...changes,
    updatedAt: changes.updatedAt || new Date().toISOString(),
  });
}

/**
 * 6. deleteEvidence(id)
 * Deletes an evidence record from IndexedDB.
 */
export async function deleteEvidence(id: string): Promise<void> {
  await db.evidence.delete(id);
}

// ── Compatibility & Helper functions ──────────────────────────────────────────

/**
 * getEvidenceById(id) - Compatibility alias for getEvidence(id)
 */
export async function getEvidenceById(
  id: string
): Promise<EvidenceRecord | undefined> {
  return await getEvidence(id);
}

/**
 * deleteEvidenceLocally(id) - Deletes evidence and any linked sync queue item.
 */
export async function deleteEvidenceLocally(id: string): Promise<void> {
  try {
    const record = await db.evidence.get(id);
    if (record && record.queueItemId) {
      await deleteQueueItem(record.queueItemId);
    }
  } catch {
    // Ignore queue cleanup error if not present
  }
  await deleteEvidence(id);
}

/**
 * updateEvidenceStatus(id, syncStatus, syncedAt) - Updates sync status.
 */
export async function updateEvidenceStatus(
  id: string,
  syncStatus: "PENDING" | "SYNCED" | "FAILED",
  syncedAt?: string
): Promise<void> {
  await updateEvidence(id, {
    syncStatus,
    ...(syncedAt ? { syncedAt } : {}),
  });
}

/**
 * saveEvidenceLocally(params) - High-level helper to construct record with Blob,
 * persist to IndexedDB, and enqueue PENDING sync queue item.
 */
export async function saveEvidenceLocally(
  params: CreateEvidenceParams
): Promise<EvidenceRecord> {
  const now = new Date().toISOString();
  const id =
    params.id ||
    `EVD-2026-${Math.floor(10000 + Math.random() * 90000)}`;

  const inspectionId = params.inspectionId || "INS-2026-TN-0001";
  const fileName = params.fileName || params.name || "captured_photo.jpg";
  const fileType = params.fileType || params.mimeType || (params.blob?.type || "image/jpeg");
  const fileSize = params.fileSize ?? params.size ?? (params.blob?.size || 32000);
  const description = params.description || params.title || fileName.replace(/\.[^/.]+$/, "");
  const status: "PENDING" | "SYNCED" | "FAILED" = params.syncStatus || "PENDING";

  // Create Blob if not provided
  let blob = params.blob;
  if (!blob) {
    if (params.dataUrl) {
      // Convert dataUrl to Blob
      try {
        const parts = params.dataUrl.split(",");
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : fileType;
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        blob = new Blob([u8arr], { type: mime });
      } catch {
        blob = new Blob([params.dataUrl], { type: fileType });
      }
    } else {
      blob = new Blob([""], { type: fileType });
    }
  }

  // Step 1: Enqueue in Sync Queue if PENDING
  let queueItemId: string | undefined = undefined;
  if (status === "PENDING") {
    try {
      const queueItem = await enqueueSyncItem({
        entityId: id,
        entityName: `Evidence · ${id}`,
        operationType: "UPLOAD_EVIDENCE",
        title: `Evidence ${id} · ${description}`,
        machine: inspectionId,
        site: "Offline Local Storage",
        status: "PENDING",
        payload: {
          evidenceId: id,
          inspectionId,
          fileName,
          description,
          fileType,
          fileSize,
        },
      });
      queueItemId = queueItem.id;
    } catch {
      // Ignore if syncQueue fails
    }
  }

  // Step 2: Persist photo/file record in Dexie IndexedDB
  const record: EvidenceRecord = {
    id,
    inspectionId,
    fileName,
    fileType,
    fileSize,
    blob,
    description,
    syncStatus: status,
    queueItemId,
    createdAt: now,
    updatedAt: now,
    syncedAt: status === "SYNCED" ? now : undefined,
    // Aliases
    name: fileName,
    title: description,
    category: params.category || "PHOTO",
    mimeType: fileType,
    size: fileSize,
    dataUrl: params.dataUrl,
  };

  await saveEvidence(record);
  return record;
}

/**
 * Helper to generate simple colorful placeholder SVG Blobs
 */
function createSvgBlob(title: string, color: string, iconType: string): Blob {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
    <rect width="400" height="300" fill="${color}"/>
    <circle cx="200" cy="130" r="46" fill="rgba(255,255,255,0.2)"/>
    <text x="200" y="140" fill="#ffffff" font-size="28" font-family="system-ui, sans-serif" font-weight="bold" text-anchor="middle">${iconType}</text>
    <text x="200" y="210" fill="#ffffff" font-size="16" font-family="system-ui, sans-serif" font-weight="600" text-anchor="middle">${title}</text>
    <text x="200" y="235" fill="rgba(255,255,255,0.8)" font-size="12" font-family="system-ui, sans-serif" text-anchor="middle">Stored in IndexedDB (Offline)</text>
  </svg>`;
  return new Blob([svg], { type: "image/svg+xml" });
}

/**
 * Seeds initial persistent evidence records into IndexedDB if table is empty.
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
    fileName: "oil_temperature_gauge.jpg",
    fileType: "image/svg+xml",
    fileSize: 24576,
    blob: createSvgBlob("Oil Temp Gauge · 78°C", "#d97706", "🌡️"),
    description: "Oil temperature gauge",
    syncStatus: "SYNCED",
    createdAt: timeOffset(75),
    updatedAt: timeOffset(70),
    syncedAt: timeOffset(70),
    name: "oil_temperature_gauge.jpg",
    title: "Oil temperature gauge",
    category: "PHOTO",
    mimeType: "image/svg+xml",
    size: 24576,
  };

  // 2. EVD-2026-00002 (Saved locally / PENDING)
  let ev2QueueId: string | undefined;
  try {
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
        fileName: "equipment_condition.jpg",
        description: "Equipment condition",
        fileSize: 42100,
      },
    });
    ev2QueueId = ev2Queue.id;
  } catch {
    // Ignore
  }

  const ev2: EvidenceRecord = {
    id: "EVD-2026-00002",
    inspectionId: "INS-2026-TN-0001",
    fileName: "equipment_condition.jpg",
    fileType: "image/svg+xml",
    fileSize: 42100,
    blob: createSvgBlob("Equipment Condition Check", "#2563eb", "📷"),
    description: "Equipment condition",
    syncStatus: "PENDING",
    queueItemId: ev2QueueId,
    createdAt: timeOffset(72),
    updatedAt: timeOffset(72),
    name: "equipment_condition.jpg",
    title: "Equipment condition",
    category: "PHOTO",
    mimeType: "image/svg+xml",
    size: 42100,
  };

  // 3. EVD-2026-00003 (Uploaded / SYNCED)
  const ev3: EvidenceRecord = {
    id: "EVD-2026-00003",
    inspectionId: "INS-2026-TN-0002",
    fileName: "safety_lockout_tag.jpg",
    fileType: "image/svg+xml",
    fileSize: 31200,
    blob: createSvgBlob("Safety Lockout Tag #LOTO-44", "#7c3aed", "🔒"),
    description: "Safety lockout tag",
    syncStatus: "SYNCED",
    createdAt: timeOffset(68),
    updatedAt: timeOffset(65),
    syncedAt: timeOffset(65),
    name: "safety_lockout_tag.jpg",
    title: "Safety lockout tag",
    category: "PHOTO",
    mimeType: "image/svg+xml",
    size: 31200,
  };

  // 4. EVD-2026-00004 (Uploaded / SYNCED)
  const ev4: EvidenceRecord = {
    id: "EVD-2026-00004",
    inspectionId: "INS-2026-TN-0001",
    fileName: "transformer_nameplate.jpg",
    fileType: "image/svg+xml",
    fileSize: 28400,
    blob: createSvgBlob("TRF-102 Nameplate Spec", "#059669", "📋"),
    description: "Transformer nameplate",
    syncStatus: "SYNCED",
    createdAt: timeOffset(62),
    updatedAt: timeOffset(60),
    syncedAt: timeOffset(60),
    name: "transformer_nameplate.jpg",
    title: "Transformer nameplate",
    category: "PHOTO",
    mimeType: "image/svg+xml",
    size: 28400,
  };

  await db.evidence.bulkPut([ev1, ev2, ev3, ev4]);
  return [ev1, ev2, ev3, ev4];
}
