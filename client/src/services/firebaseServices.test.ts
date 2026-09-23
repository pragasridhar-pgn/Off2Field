import { describe, it, expect, beforeEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { db as dexieDb } from "../db/database";
import { saveInspection, getInspection, updateInspection } from "../db/inspectionStorage";
import { saveEvidenceLocally, getEvidence } from "../db/evidenceStorage";
import { enqueueSyncItem, getSyncQueueItem } from "../db/syncQueueStorage";
import { FirebaseSyncProvider } from "./firebaseSyncProvider";
import { pullInitialCloudData } from "./cloudDataService";
import { registerSyncProvider, processSingleQueueItem } from "./syncService";

// Mock Firebase Config and SDK modules
vi.mock("../firebase/firebaseConfig", () => {
  return {
    app: {},
    auth: {
      currentUser: { uid: "test-user-123", email: "test@off2field.com" },
    },
    db: {},
    storage: {},
  };
});

// Mock Firestore
const mockFirestoreDocs = new Map<string, any>();
vi.mock("firebase/firestore", () => {
  return {
    doc: vi.fn((_db, ...parts) => parts.join("/")),
    collection: vi.fn((_db, ...parts) => parts.join("/")),
    setDoc: vi.fn(async (path, data, options) => {
      const existing = mockFirestoreDocs.get(path) || {};
      const merged = options?.merge ? { ...existing, ...data } : data;
      mockFirestoreDocs.set(path, merged);
      return Promise.resolve();
    }),
    getDoc: vi.fn(async (path) => ({
      exists: () => mockFirestoreDocs.has(path),
      data: () => mockFirestoreDocs.get(path),
      id: path.split("/").pop(),
    })),
    deleteDoc: vi.fn(async (path) => {
      mockFirestoreDocs.delete(path);
      return Promise.resolve();
    }),
    getDocs: vi.fn(async (path) => {
      const docs: any[] = [];
      mockFirestoreDocs.forEach((data, docPath) => {
        if (docPath.startsWith(path) && docPath !== path) {
          const subPath = docPath.slice(path.length + 1);
          if (!subPath.includes("/")) {
            docs.push({
              id: subPath,
              data: () => data,
            });
          }
        }
      });
      return { docs };
    }),
  };
});

// Mock Firebase Storage Service
vi.mock("./firebaseStorageService", () => {
  return {
    uploadEvidenceFile: vi.fn(async (userId, inspectionId, evidenceId, fileName) => ({
      success: true,
      storagePath: `evidence/${userId}/${inspectionId}/${evidenceId}/${fileName}`,
      downloadUrl: `https://firebasestorage.googleapis.com/v0/b/off2field.appspot.com/o/${fileName}?alt=media`,
    })),
    deleteEvidenceFile: vi.fn(async () => ({ success: true })),
    buildEvidenceStoragePath: vi.fn((userId, inspectionId, evidenceId, fileName) =>
      `evidence/${userId}/${inspectionId}/${evidenceId}/${fileName}`
    ),
    getEvidenceDownloadUrl: vi.fn(async () => "https://firebasestorage.googleapis.com/test-url"),
  };
});

describe("Phase 2 — Firebase Services & Cloud Synchronization", () => {
  let provider: FirebaseSyncProvider;

  beforeEach(async () => {
    await dexieDb.inspections.clear();
    await dexieDb.syncQueue.clear();
    await dexieDb.evidence.clear();
    mockFirestoreDocs.clear();
    provider = new FirebaseSyncProvider();
    registerSyncProvider(provider);
  });

  it("1. Synchronizes local inspection to Firestore and updates Dexie status to SYNCED", async () => {
    const inspId = "INS-TEST-001";
    await saveInspection({
      id: inspId,
      machine: "TRF-102",
      site: "Substation A",
      status: "SUBMITTED",
      checklist: [{ id: "01", label: "Oil Level", value: "85%" }],
      resolved: false,
      submittedAt: new Date().toISOString(),
      syncStatus: "PENDING",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const queueItem = await enqueueSyncItem({
      entityId: inspId,
      entityName: "Inspection Test",
      operationType: "SUBMIT_INSPECTION",
      status: "PENDING",
    });

    const result = await provider.syncInspection(queueItem);
    expect(result.success).toBe(true);

    // Verify Firestore doc
    const firestoreKey = "users/test-user-123/inspections/" + inspId;
    expect(mockFirestoreDocs.has(firestoreKey)).toBe(true);
    const firestoreData = mockFirestoreDocs.get(firestoreKey);
    expect(firestoreData.id).toBe(inspId);
    expect(firestoreData.status).toBe("SUBMITTED");
    expect(firestoreData.userId).toBe("test-user-123");

    // Verify Dexie local record is marked SYNCED
    const localUpdated = await getInspection(inspId);
    expect(localUpdated?.syncStatus).toBe("SYNCED");
  });

  it("2. Synchronizes local evidence photo to Firebase Storage & Firestore metadata", async () => {
    const evId = "EVD-TEST-001";
    const inspId = "INS-TEST-001";
    const testBlob = new Blob(["fake-image-bytes"], { type: "image/jpeg" });

    await saveEvidenceLocally({
      id: evId,
      inspectionId: inspId,
      fileName: "test_photo.jpg",
      fileType: "image/jpeg",
      fileSize: testBlob.size,
      blob: testBlob,
      description: "Transformer Oil Valve Photo",
      syncStatus: "PENDING",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const queueItem = await enqueueSyncItem({
      entityId: evId,
      entityName: "Photo Evidence",
      operationType: "UPLOAD_EVIDENCE",
      status: "PENDING",
      payload: { inspectionId: inspId, fileName: "test_photo.jpg" },
    });

    const result = await provider.syncEvidence(queueItem);
    expect(result.success).toBe(true);

    // Verify Firestore evidence metadata
    const firestoreKey = `users/test-user-123/inspections/${inspId}/evidence/${evId}`;
    expect(mockFirestoreDocs.has(firestoreKey)).toBe(true);
    const firestoreData = mockFirestoreDocs.get(firestoreKey);
    expect(firestoreData.fileName).toBe("test_photo.jpg");
    expect(firestoreData.storagePath).toContain("evidence/test-user-123");

    // Verify Dexie local evidence is updated
    const localEv = await getEvidence(evId);
    expect(localEv?.syncStatus).toBe("SYNCED");
    expect(localEv?.dataUrl).toContain("https://firebasestorage.googleapis.com");
  });

  it("3. End-to-end sync queue pipeline processes items through FirebaseSyncProvider", async () => {
    const inspId = "INS-PIPELINE-01";
    await saveInspection({
      id: inspId,
      machine: "PMP-301",
      site: "Pump House 4",
      status: "DRAFT",
      checklist: [],
      resolved: false,
      syncStatus: "PENDING",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const queueItem = await enqueueSyncItem({
      entityId: inspId,
      entityName: "Pipeline Inspection",
      operationType: "CREATE_INSPECTION",
      status: "PENDING",
    });

    const processResult = await processSingleQueueItem(queueItem.id, true);
    expect(processResult.success).toBe(true);
    expect(processResult.status).toBe("COMPLETED");

    const updatedQueueItem = await getSyncQueueItem(queueItem.id);
    expect(updatedQueueItem?.status).toBe("COMPLETED");
  });

  it("4. Pulls initial cloud data into Dexie when local record is missing", async () => {
    const cloudInspId = "INS-CLOUD-001";
    mockFirestoreDocs.set(`users/test-user-123/inspections/${cloudInspId}`, {
      id: cloudInspId,
      machine: "TRF-203",
      site: "Substation C",
      status: "APPROVED",
      checklist: [{ id: "01", label: "SF6 Gas", value: "6.1 bar" }],
      resolved: true,
      createdAt: "2026-09-20T10:00:00.000Z",
      updatedAt: "2026-09-20T12:00:00.000Z",
    });

    const pullResult = await pullInitialCloudData("test-user-123");
    expect(pullResult.pulledInspections).toBe(1);

    const savedLocal = await getInspection(cloudInspId);
    expect(savedLocal).toBeDefined();
    expect(savedLocal?.machine).toBe("TRF-203");
    expect(savedLocal?.syncStatus).toBe("SYNCED");
  });

  it("5. Conflict resolution: Preserves local un-synced edits when local updatedAt is newer", async () => {
    const conflictInspId = "INS-CONFLICT-001";

    // Local record modified offline at 14:00
    await saveInspection({
      id: conflictInspId,
      machine: "TRF-102",
      site: "Substation A",
      status: "DRAFT",
      checklist: [{ id: "01", label: "Oil Temp", value: "85 °C" }],
      resolved: false,
      syncStatus: "PENDING",
      createdAt: "2026-09-21T10:00:00.000Z",
      updatedAt: "2026-09-21T14:00:00.000Z",
    });

    // Cloud record has older timestamp at 11:00
    mockFirestoreDocs.set(`users/test-user-123/inspections/${conflictInspId}`, {
      id: conflictInspId,
      machine: "TRF-102",
      status: "DRAFT",
      checklist: [{ id: "01", label: "Oil Temp", value: "75 °C" }],
      updatedAt: "2026-09-21T11:00:00.000Z",
    });

    await pullInitialCloudData("test-user-123");

    // Verify local record is preserved with local 85 °C value
    const currentLocal = await getInspection(conflictInspId);
    expect(currentLocal?.checklist).toEqual([{ id: "01", label: "Oil Temp", value: "85 °C" }]);
    expect(currentLocal?.syncStatus).toBe("PENDING");
  });
});
