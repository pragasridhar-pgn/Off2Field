import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db/database';
import {
  addSyncQueueItem,
  getSyncQueueItem,
} from '../db/syncQueueStorage';
import {
  processSyncQueue,
  processSingleQueueItem,
  retryQueueItem,
  getQueueSyncSummary,
  registerSyncProvider,
  type SyncProvider,
} from './syncService';

describe('syncService test suite (Phase 1 Offline-First)', () => {
  beforeEach(async () => {
    await db.syncQueue.clear();
    await db.inspections.clear();
    await db.evidence.clear();
    registerSyncProvider(null);
  });

  it('handles empty queue cleanly without errors', async () => {
    const result = await processSyncQueue();
    expect(result.processed).toBe(0);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('processes pending queue items in Phase 1 local mode without faking cloud sync', async () => {
    const item1 = await addSyncQueueItem({
      entityId: 'INS-2026-001',
      entityName: 'Inspection 1',
      operationType: 'CREATE_INSPECTION',
      status: 'PENDING',
    });

    const item2 = await addSyncQueueItem({
      entityId: 'EVD-2026-002',
      entityName: 'Evidence 2',
      operationType: 'CREATE_EVIDENCE',
      status: 'PENDING',
    });

    const summaryBefore = await getQueueSyncSummary();
    expect(summaryBefore.pending).toBe(2);

    const result = await processSyncQueue();
    expect(result.processed).toBe(2);
    expect(result.succeeded).toBe(2);

    // In Phase 1 local mode, records remain safely queued as PENDING ready for Phase 2 Cloud adapter
    const current1 = await getSyncQueueItem(item1.id);
    expect(current1?.status).toBe('PENDING');
  });

  it('connects to Phase 2 SyncProvider when registered and transitions items to COMPLETED', async () => {
    const mockProvider: SyncProvider = {
      name: 'MockCloudProvider',
      async syncInspection(item) {
        return { success: true };
      },
      async syncEvidence(item) {
        return { success: true };
      },
      async deleteEvidence(item) {
        return { success: true };
      },
    };

    registerSyncProvider(mockProvider);

    const item = await addSyncQueueItem({
      entityId: 'INS-CLOUD-01',
      operationType: 'SUBMIT_INSPECTION',
      status: 'PENDING',
    });

    const res = await processSingleQueueItem(item.id, true);
    expect(res.success).toBe(true);

    const updated = await getSyncQueueItem(item.id);
    expect(updated?.status).toBe('COMPLETED');
    expect(updated?.syncedAt).toBeDefined();
  });

  it('handles remote provider failure and increments retry count', async () => {
    const failingProvider: SyncProvider = {
      name: 'FailingCloudProvider',
      async syncInspection() {
        return { success: false, error: 'Remote 503 Service Unavailable' };
      },
      async syncEvidence() {
        return { success: false, error: 'Remote 503 Service Unavailable' };
      },
      async deleteEvidence() {
        return { success: false, error: 'Remote 503' };
      },
    };

    registerSyncProvider(failingProvider);

    const item = await addSyncQueueItem({
      entityId: 'INS-FAIL-01',
      operationType: 'UPDATE_INSPECTION',
      status: 'PENDING',
    });

    const res = await processSingleQueueItem(item.id, true);
    expect(res.success).toBe(false);
    expect(res.status).toBe('FAILED');

    const updated = await getSyncQueueItem(item.id);
    expect(updated?.status).toBe('FAILED');
    expect(updated?.retryCount).toBe(1);
    expect(updated?.lastError).toBe('Remote 503 Service Unavailable');
  });

  it('provides accurate queue summary statistics', async () => {
    await addSyncQueueItem({ entityId: 'E1', operationType: 'CREATE_INSPECTION', status: 'PENDING' });
    await addSyncQueueItem({ entityId: 'E2', operationType: 'CREATE_INSPECTION', status: 'PENDING' });
    await addSyncQueueItem({ entityId: 'E3', operationType: 'CREATE_INSPECTION', status: 'FAILED' });

    const summary = await getQueueSyncSummary();
    expect(summary.total).toBe(3);
    expect(summary.pending).toBe(2);
    expect(summary.failed).toBe(1);
  });
});
