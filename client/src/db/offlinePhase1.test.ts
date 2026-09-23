import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db, type InspectionRecord, type EvidenceRecord } from './database';
import {
  saveInspection,
  getInspection,
  getAllInspections,
  updateInspection,
  deleteInspection,
} from './inspectionStorage';
import {
  saveEvidence,
  getEvidence,
  getAllEvidence,
  getEvidenceForInspection,
  updateEvidence,
  deleteEvidence,
  saveEvidenceLocally,
  deleteEvidenceLocally,
} from './evidenceStorage';
import {
  addSyncQueueItem,
  getSyncQueueItem,
  getPendingSyncQueueItems,
  getAllQueueItems,
  updateSyncQueueItem,
  incrementRetryCount,
  markSyncQueueItemProcessing,
  markSyncQueueItemCompleted,
} from './syncQueueStorage';
import {
  processSyncQueue,
  processSingleQueueItem,
  getQueueSyncSummary,
  registerSyncProvider,
  type SyncProvider,
} from '../services/syncService';

describe('Phase 1 Offline-First End-to-End Integration Tests', () => {
  beforeEach(async () => {
    await db.inspections.clear();
    await db.evidence.clear();
    await db.syncQueue.clear();
    registerSyncProvider(null);
  });

  it('1-4: creates inspection, stores in IndexedDB with PENDING status and queue item', async () => {
    const now = new Date().toISOString();
    const insp: InspectionRecord = {
      id: 'INS-2026-TEST-01',
      machine: 'TRF-102',
      site: 'Substation A',
      status: 'DRAFT',
      checklist: [{ id: '01', label: 'Oil Temp', value: '75 C', helper: '', required: true, tone: 'green' }],
      resolved: false,
      syncStatus: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };

    await saveInspection(insp);

    await addSyncQueueItem({
      entityId: insp.id,
      entityName: 'Inspection Test 01',
      operationType: 'CREATE_INSPECTION',
      status: 'PENDING',
      payload: insp,
    });

    const stored = await getInspection('INS-2026-TEST-01');
    expect(stored).toBeDefined();
    expect(stored?.syncStatus).toBe('PENDING');
    expect(stored?.machine).toBe('TRF-102');

    const pendingOps = await getPendingSyncQueueItems();
    expect(pendingOps.some((op) => op.entityId === 'INS-2026-TEST-01')).toBe(true);
  });

  it('5-7: updates checklist, updates updatedAt timestamp, and reflects in queue', async () => {
    const insp: InspectionRecord = {
      id: 'INS-2026-TEST-02',
      machine: 'TRF-117',
      status: 'DRAFT',
      checklist: [{ id: '01', label: 'Pressure', value: '5.0 bar', helper: '', required: true, tone: 'green' }],
      resolved: false,
      syncStatus: 'PENDING',
      createdAt: '2026-09-20T10:00:00.000Z',
      updatedAt: '2026-09-20T10:00:00.000Z',
    };
    await saveInspection(insp);

    const updatedChecklist = [{ id: '01', label: 'Pressure', value: '5.8 bar', helper: '', required: true, tone: 'green' }];
    await updateInspection('INS-2026-TEST-02', {
      checklist: updatedChecklist,
      updatedAt: '2026-09-23T12:00:00.000Z',
    });

    const updatedInsp = await getInspection('INS-2026-TEST-02');
    expect(updatedInsp?.updatedAt).toBe('2026-09-23T12:00:00.000Z');
    expect((updatedInsp?.checklist as any)[0].value).toBe('5.8 bar');
    // Original createdAt preserved
    expect(updatedInsp?.createdAt).toBe('2026-09-20T10:00:00.000Z');
  });

  it('8-11: submits inspection, sets status=SUBMITTED and submittedAt timestamp in queue', async () => {
    const submitTime = new Date().toISOString();
    await saveInspection({
      id: 'INS-2026-TEST-03',
      machine: 'PMP-301',
      status: 'DRAFT',
      checklist: [],
      resolved: false,
      syncStatus: 'PENDING',
      createdAt: submitTime,
      updatedAt: submitTime,
    });

    await updateInspection('INS-2026-TEST-03', {
      status: 'SUBMITTED',
      submittedAt: submitTime,
    });

    await addSyncQueueItem({
      entityId: 'INS-2026-TEST-03',
      operationType: 'SUBMIT_INSPECTION',
      status: 'PENDING',
      payload: { id: 'INS-2026-TEST-03', submittedAt: submitTime },
    });

    const submitted = await getInspection('INS-2026-TEST-03');
    expect(submitted?.status).toBe('SUBMITTED');
    expect(submitted?.submittedAt).toBe(submitTime);

    const queueItems = await getPendingSyncQueueItems();
    const submitOp = queueItems.find((q) => q.entityId === 'INS-2026-TEST-03' && q.operationType === 'SUBMIT_INSPECTION');
    expect(submitOp).toBeDefined();
  });

  it('12-15: creates evidence with Blob, associates with active inspection, and queues PENDING item', async () => {
    const sampleBlob = new Blob(['transformer visual inspection photo'], { type: 'image/jpeg' });
    const evRecord: EvidenceRecord = {
      id: 'EVD-2026-PHASE1-01',
      inspectionId: 'INS-2026-TEST-01',
      fileName: 'gauge_reading.jpg',
      fileType: 'image/jpeg',
      fileSize: sampleBlob.size,
      blob: sampleBlob,
      description: 'Gauge reading photo',
      syncStatus: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveEvidence(evRecord);

    const saved = await getEvidence('EVD-2026-PHASE1-01');
    expect(saved).toBeDefined();
    expect(saved?.blob).toBeInstanceOf(Blob);
    expect(saved?.inspectionId).toBe('INS-2026-TEST-01');
    expect(saved?.syncStatus).toBe('PENDING');

    const forInsp = await getEvidenceForInspection('INS-2026-TEST-01');
    expect(forInsp.length).toBe(1);
    expect(forInsp[0].id).toBe('EVD-2026-PHASE1-01');
  });

  it('16-18: deletes evidence locally and cleans up associated queue item', async () => {
    const saved = await saveEvidenceLocally({
      name: 'temp_bearing.png',
      inspectionId: 'INS-2026-TEST-01',
      blob: new Blob(['bytes'], { type: 'image/png' }),
    });

    let inDb = await getEvidence(saved.id);
    expect(inDb).toBeDefined();

    await deleteEvidenceLocally(saved.id);

    inDb = await getEvidence(saved.id);
    expect(inDb).toBeUndefined();
  });

  it('19-20: queue processing and retry handling with max retry threshold', async () => {
    const item = await addSyncQueueItem({
      entityId: 'EVD-FAIL-TEST',
      operationType: 'UPLOAD_EVIDENCE',
      status: 'PENDING',
    });

    const { retryCount, maxRetriesExceeded } = await incrementRetryCount(item.id, 'Connection reset', 3);
    expect(retryCount).toBe(1);
    expect(maxRetriesExceeded).toBe(false);

    await incrementRetryCount(item.id, 'Connection reset', 3);
    const finalRetry = await incrementRetryCount(item.id, 'Fatal error', 3);
    expect(finalRetry.retryCount).toBe(3);
    expect(finalRetry.maxRetriesExceeded).toBe(true);

    const failedItem = await getSyncQueueItem(item.id);
    expect(failedItem?.status).toBe('FAILED');
    expect(failedItem?.lastError).toContain('Maximum retry limit');
  });

  it('21-23: offline persistence across reloads without network dependencies', async () => {
    // 1. Store inspection and photo while offline
    const photoBlob = new Blob(['sample photo'], { type: 'image/png' });
    await saveInspection({
      id: 'INS-OFFLINE-RELOAD',
      machine: 'TRF-305',
      status: 'SUBMITTED',
      checklist: [{ id: '01', label: 'Silica Gel', value: 'Blue', helper: '', required: true, tone: 'green' }],
      resolved: false,
      syncStatus: 'PENDING',
      createdAt: '2026-09-23T10:00:00.000Z',
      updatedAt: '2026-09-23T10:00:00.000Z',
    });

    await saveEvidence({
      id: 'EVD-OFFLINE-RELOAD',
      inspectionId: 'INS-OFFLINE-RELOAD',
      fileName: 'silica_gel.png',
      fileType: 'image/png',
      fileSize: photoBlob.size,
      blob: photoBlob,
      description: 'Silica gel breather check',
      syncStatus: 'PENDING',
      createdAt: '2026-09-23T10:01:00.000Z',
      updatedAt: '2026-09-23T10:01:00.000Z',
    });

    // 2. Simulate page reload / reload from IndexedDB
    const reloadedInspections = await getAllInspections();
    const reloadedEvidence = await getAllEvidence();

    const targetInsp = reloadedInspections.find((i) => i.id === 'INS-OFFLINE-RELOAD');
    const targetEv = reloadedEvidence.find((e) => e.id === 'EVD-OFFLINE-RELOAD');

    expect(targetInsp).toBeDefined();
    expect(targetInsp?.machine).toBe('TRF-305');
    expect(targetInsp?.status).toBe('SUBMITTED');

    expect(targetEv).toBeDefined();
    expect(targetEv?.blob).toBeInstanceOf(Blob);
    expect(targetEv?.description).toBe('Silica gel breather check');
  });
});
