import Dexie, { type Table } from "dexie";

export type SyncOperationType =
  | "CREATE_INSPECTION"
  | "UPDATE_INSPECTION"
  | "SUBMIT_INSPECTION"
  | "UPDATE_CHECKLIST"
  | "UPLOAD_EVIDENCE"
  | "RESOLVE_CONFLICT";

export type SyncItemStatus = "PENDING" | "SYNCING" | "SYNCED" | "FAILED";

export interface SyncQueueItem {
  id: string;
  entityId: string;
  entityName: string;
  operationType: SyncOperationType;
  title: string;
  machine?: string;
  site?: string;
  status: SyncItemStatus;
  retryCount: number;
  lastError?: string;
  payload: any;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
}

export interface InspectionRecord {
  id: string;
  machine?: string;
  site?: string;
  status: string;
  checklist: unknown;
  notes?: string;
  images?: Array<{ id: string; name: string; dataUrl: string; timestamp: string }>;
  resolved: boolean;
  submittedAt?: string;
  syncStatus: "PENDING" | "SYNCED" | "FAILED";
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceRecord {
  id: string;
  inspectionId?: string;
  name: string;
  title: string;
  category?: "PHOTO" | "DOCUMENT" | "REPORT";
  mimeType: string;
  size: number;
  dataUrl: string;
  syncStatus: SyncItemStatus;
  queueItemId?: string;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
}

class Off2FieldDatabase extends Dexie {
  inspections!: Table<InspectionRecord, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  evidence!: Table<EvidenceRecord, string>;

  constructor() {
    super("Off2FieldDB");

    this.version(1).stores({
      inspections: "id, status, syncStatus, updatedAt",
    });

    this.version(2).stores({
      inspections: "id, status, syncStatus, updatedAt",
      syncQueue: "id, entityId, operationType, status, createdAt, updatedAt",
    });

    this.version(3).stores({
      inspections: "id, status, syncStatus, updatedAt",
      syncQueue: "id, entityId, operationType, status, createdAt, updatedAt",
      evidence: "id, inspectionId, syncStatus, createdAt, updatedAt",
    });
  }
}

export const db = new Off2FieldDatabase();

