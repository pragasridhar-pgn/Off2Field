import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from './database';
import {
  addSyncQueueItem,
  getSyncQueueItem,
  getPendingSyncQueueItems,
  getAllQueueItems,
  updateSyncQueueItem,
  deleteSyncQueueItem,
  markSyncQueueItemProcessing,
  markSyncQueueItemCompleted,
  markSyncQueueItemFailed,
  incrementRetryCount,
  seedInitialQueueIfEmpty,
  clearSyncedQueue,
  enqueueSyncItem,
} from './syncQueueStorage';

describe('syncQueueStorage test suite', () => {
  beforeEach(async () => {
    await db.syncQueue.clear();
    await db.inspections.clear();
  });

  it('seeds default Inspection A, B, C with PENDING status when empty', async () => {
    const seeded = await seedInitialQueueIfEmpty();
    expect(seeded.length).toBe(3);

    const pending = await getPendingSyncQueueItems();
    expect(pending.length).toBe(3);

    expect(pending[0].entityName).toBe('Inspection A');
    expect(pending[0].status).toBe('PENDING');

    expect(pending[1].entityName).toBe('Inspection B');
    expect(pending[1].status).toBe('PENDING');

    expect(pending[2].entityName).toBe('Inspection C');
    expect(pending[2].status).toBe('PENDING');
  });

  it('adds, retrieves and updates queue items through lifecycle', async () => {
    const item = await addSyncQueueItem({
      entityType: 'INSPECTION',
      entityId: 'INS-TEST-1',
      entityName: 'Inspection D',
      operationType: 'UPDATE_CHECKLIST',
      status: 'PENDING',
      payload: { sectionId: 'electrical', itemId: 'gen_1', status: 'PASS' },
    });

    expect(item.id).toBeDefined();
    expect(item.entityName).toBe('Inspection D');

    // Retrieve single item
    const retrieved = await getSyncQueueItem(item.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.entityId).toBe('INS-TEST-1');

    // Mark PROCESSING
    await markSyncQueueItemProcessing(item.id);
    let current = await getSyncQueueItem(item.id);
    expect(current?.status).toBe('PROCESSING');

    // Mark COMPLETED
    await markSyncQueueItemCompleted(item.id);
    current = await getSyncQueueItem(item.id);
    expect(current?.status).toBe('COMPLETED');
    expect(current?.syncedAt).toBeDefined();

    // Clear synced/completed
    await clearSyncedQueue();
    const all = await getAllQueueItems();
    expect(all.length).toBe(0);
  });

  it('handles failed status and retry increment with max retries limit', async () => {
    const item = await addSyncQueueItem({
      entityType: 'EVIDENCE',
      entityId: 'EVD-TEST-RETRY',
      operationType: 'CREATE_EVIDENCE',
      status: 'PENDING',
    });

    expect(item.retryCount).toBe(0);

    // First failure
    const r1 = await incrementRetryCount(item.id, 'Network timeout', 3);
    expect(r1.retryCount).toBe(1);
    expect(r1.maxRetriesExceeded).toBe(false);

    let current = await getSyncQueueItem(item.id);
    expect(current?.status).toBe('FAILED');
    expect(current?.lastError).toBe('Network timeout');

    // Second failure
    const r2 = await incrementRetryCount(item.id, 'Network reset', 3);
    expect(r2.retryCount).toBe(2);
    expect(r2.maxRetriesExceeded).toBe(false);

    // Third failure (max reached)
    const r3 = await incrementRetryCount(item.id, 'Fatal error', 3);
    expect(r3.retryCount).toBe(3);
    expect(r3.maxRetriesExceeded).toBe(true);

    current = await getSyncQueueItem(item.id);
    expect(current?.retryCount).toBe(3);
    expect(current?.lastError).toContain('Maximum retry limit');
  });

  it('handles item deletion cleanly', async () => {
    const item = await enqueueSyncItem({
      entityType: 'INSPECTION',
      entityId: 'INS-TEST-DEL',
      operationType: 'DELETE_EVIDENCE',
      status: 'PENDING',
    });

    let all = await getAllQueueItems();
    expect(all.some((i) => i.id === item.id)).toBe(true);

    await deleteSyncQueueItem(item.id);
    all = await getAllQueueItems();
    expect(all.some((i) => i.id === item.id)).toBe(false);
  });
});
