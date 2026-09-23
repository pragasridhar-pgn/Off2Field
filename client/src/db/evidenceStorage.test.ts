import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "./database";
import {
  saveEvidenceLocally,
  getAllEvidence,
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
    expect(inDb?.dataUrl).toBe(mockDataUrl);

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
