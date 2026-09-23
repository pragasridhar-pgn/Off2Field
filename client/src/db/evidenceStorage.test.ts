import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db, type EvidenceRecord } from "./database";
import {
  saveEvidence,
  getEvidence,
  getEvidenceForInspection,
  getAllEvidence,
  updateEvidence,
  deleteEvidence,
  saveEvidenceLocally,
  getEvidenceById,
  deleteEvidenceLocally,
  updateEvidenceStatus,
  seedInitialEvidenceIfEmpty,
} from "./evidenceStorage";
import { getAllQueueItems } from "./syncQueueStorage";

describe("evidenceStorage test suite", () => {
  beforeEach(async () => {
    await db.evidence.clear();
    await db.syncQueue.clear();
  });

  it("seeds initial evidence records and enqueues pending evidence into syncQueue", async () => {
    const seeded = await seedInitialEvidenceIfEmpty();
    expect(seeded.length).toBe(4);

    const all = await getAllEvidence();
    expect(all.length).toBe(4);

    const pendingItem = all.find((item) => item.syncStatus === "PENDING");
    expect(pendingItem).toBeDefined();
    expect(pendingItem?.id).toBe("EVD-2026-00002");

    // Verify it was enqueued in syncQueue
    const queue = await getAllQueueItems();
    const queuedEv = queue.find((q) => q.entityId === "EVD-2026-00002");
    expect(queuedEv).toBeDefined();
    expect(queuedEv?.operationType).toBe("UPLOAD_EVIDENCE");
    expect(queuedEv?.status).toBe("PENDING");
  });

  it("saves real EvidenceRecord with Blob directly to IndexedDB using saveEvidence()", async () => {
    const testBlob = new Blob(["sample image content bytes"], { type: "image/jpeg" });
    const record: EvidenceRecord = {
      id: "EVD-2026-99999",
      inspectionId: "INS-2026-TN-0001",
      fileName: "transformer_terminal.jpg",
      fileType: "image/jpeg",
      fileSize: testBlob.size,
      blob: testBlob,
      description: "Transformer terminal connection",
      syncStatus: "PENDING",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const savedId = await saveEvidence(record);
    expect(savedId).toBe("EVD-2026-99999");

    const retrieved = await getEvidence("EVD-2026-99999");
    expect(retrieved).toBeDefined();
    expect(retrieved?.fileName).toBe("transformer_terminal.jpg");
    expect(retrieved?.blob).toBeInstanceOf(Blob);
    expect(retrieved?.syncStatus).toBe("PENDING");
  });

  it("retrieves evidence specifically for an inspection using getEvidenceForInspection()", async () => {
    const blob1 = new Blob(["image 1"], { type: "image/png" });
    const blob2 = new Blob(["image 2"], { type: "image/png" });

    await saveEvidence({
      id: "EVD-A1",
      inspectionId: "INS-TARGET-01",
      fileName: "a1.png",
      fileType: "image/png",
      fileSize: blob1.size,
      blob: blob1,
      description: "A1 description",
      syncStatus: "PENDING",
      createdAt: "2026-09-23T10:00:00.000Z",
      updatedAt: "2026-09-23T10:00:00.000Z",
    });

    await saveEvidence({
      id: "EVD-A2",
      inspectionId: "INS-OTHER-02",
      fileName: "a2.png",
      fileType: "image/png",
      fileSize: blob2.size,
      blob: blob2,
      description: "A2 description",
      syncStatus: "SYNCED",
      createdAt: "2026-09-23T10:05:00.000Z",
      updatedAt: "2026-09-23T10:05:00.000Z",
    });

    const forTarget = await getEvidenceForInspection("INS-TARGET-01");
    expect(forTarget.length).toBe(1);
    expect(forTarget[0].id).toBe("EVD-A1");
  });

  it("updates and deletes evidence records using updateEvidence() and deleteEvidence()", async () => {
    const testBlob = new Blob(["test"], { type: "image/jpeg" });
    await saveEvidence({
      id: "EVD-UPDATE-01",
      inspectionId: "INS-2026-TN-0001",
      fileName: "test.jpg",
      fileType: "image/jpeg",
      fileSize: 4,
      blob: testBlob,
      description: "Before update",
      syncStatus: "PENDING",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await updateEvidence("EVD-UPDATE-01", {
      description: "After update",
      syncStatus: "SYNCED",
    });

    const updated = await getEvidence("EVD-UPDATE-01");
    expect(updated?.description).toBe("After update");
    expect(updated?.syncStatus).toBe("SYNCED");

    await deleteEvidence("EVD-UPDATE-01");
    const deleted = await getEvidence("EVD-UPDATE-01");
    expect(deleted).toBeUndefined();
  });

  it("saves a new photo/file to IndexedDB and enqueues to syncQueue as PENDING", async () => {
    const mockDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    
    const saved = await saveEvidenceLocally({
      name: "motor_inspection_bearing.png",
      title: "Motor bearing wear",
      inspectionId: "INS-2026-TN-0003",
      category: "PHOTO",
      mimeType: "image/png",
      dataUrl: mockDataUrl,
    });

    expect(saved.id).toMatch(/^EVD-2026-/);
    expect(saved.syncStatus).toBe("PENDING");
    expect(saved.queueItemId).toBeDefined();

    // Verify it is in IndexedDB
    const inDb = await getEvidenceById(saved.id);
    expect(inDb).toBeDefined();
    expect(inDb?.name).toBe("motor_inspection_bearing.png");
    expect(inDb?.blob).toBeDefined();

    // Verify it is in Dexie syncQueue
    const queue = await getAllQueueItems();
    const qItem = queue.find((q) => q.entityId === saved.id);
    expect(qItem).toBeDefined();
    expect(qItem?.operationType).toBe("UPLOAD_EVIDENCE");
    expect(qItem?.status).toBe("PENDING");
  });

  it("updates status to SYNCED and marks syncedAt timestamp", async () => {
    const saved = await saveEvidenceLocally({
      name: "breaker_switch.jpg",
      title: "Breaker switch position",
      dataUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
    });

    const syncTimestamp = new Date().toISOString();
    await updateEvidenceStatus(saved.id, "SYNCED", syncTimestamp);

    const updated = await getEvidenceById(saved.id);
    expect(updated?.syncStatus).toBe("SYNCED");
    expect(updated?.syncedAt).toBe(syncTimestamp);
  });

  it("deletes evidence locally from IndexedDB and cleans up queue item", async () => {
    const saved = await saveEvidenceLocally({
      name: "temp_test.jpg",
      title: "Temporary test photo",
      dataUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
    });

    let queue = await getAllQueueItems();
    expect(queue.some((q) => q.entityId === saved.id)).toBe(true);

    await deleteEvidenceLocally(saved.id);

    const inDb = await getEvidenceById(saved.id);
    expect(inDb).toBeUndefined();

    queue = await getAllQueueItems();
    expect(queue.some((q) => q.entityId === saved.id)).toBe(false);
  });
});
