import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from './database';
import {
  seedInitialQueueIfEmpty,
  getPendingQueueItems,
  getAllQueueItems,
  enqueueSyncItem,
  updateQueueItem,
  clearSyncedQueue,
  deleteQueueItem,
} from './syncQueueStorage';

describe('syncQueueStorage test suite', () => {
  beforeEach(async () => {
    await db.syncQueue.clear();
  });

  it('seeds default Inspection A, B, C with PENDING status when empty', async () => {
    const seeded = await seedInitialQueueIfEmpty();
    expect(seeded.length).toBe(3);

    const pending = await getPendingQueueItems();
    expect(pending.length).toBe(3);

    expect(pending[0].entityName).toBe('Inspection A');
    expect(pending[0].status).toBe('PENDING');

    expect(pending[1].entityName).toBe('Inspection B');
    expect(pending[1].status).toBe('PENDING');

    expect(pending[2].entityName).toBe('Inspection C');
    expect(pending[2].status).toBe('PENDING');
  });

  it('enqueues a new sync item and updates status through lifecycle', async () => {
    const item = await enqueueSyncItem({
      entityType: 'INSPECTION',
      entityId: 'INS-TEST-1',
      entityName: 'Inspection D',
      operationType: 'UPDATE_CHECKLIST',
      status: 'PENDING',
      payload: { sectionId: 'electrical', itemId: 'gen_1', status: 'PASS' },
    });

    expect(item.id).toBeDefined();
    expect(item.entityName).toBe('Inspection D');

    // Update status to SYNCING
    await updateQueueItem(item.id, { status: 'SYNCING' });
    let all = await getAllQueueItems();
    const updated = all.find((i) => i.id === item.id);
    expect(updated?.status).toBe('SYNCING');

    // Update status to SYNCED
    await updateQueueItem(item.id, { status: 'SYNCED' });
    all = await getAllQueueItems();
    const synced = all.find((i) => i.id === item.id);
    expect(synced?.status).toBe('SYNCED');

    // Clear synced items
    await clearSyncedQueue();
    all = await getAllQueueItems();
    expect(all.length).toBe(0);
  });

  it('handles item deletion cleanly', async () => {
    const item = await enqueueSyncItem({
      entityType: 'INSPECTION',
      entityId: 'INS-TEST-DEL',
      entityLabel: 'Inspection To Delete',
      operationType: 'DELETE',
      status: 'PENDING',
    });

    let all = await getAllQueueItems();
    expect(all.some((i) => i.id === item.id)).toBe(true);

    await deleteQueueItem(item.id);
    all = await getAllQueueItems();
    expect(all.some((i) => i.id === item.id)).toBe(false);
  });
});
