import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebaseConfig";
import { getCurrentUser } from "./authService";
import { uploadEvidenceFile, deleteEvidenceFile, buildEvidenceStoragePath } from "./firebaseStorageService";
import { getInspection, updateInspection } from "../db/inspectionStorage";
import { getEvidence, updateEvidence } from "../db/evidenceStorage";
import type { SyncProvider } from "./syncService";
import type { SyncQueueItem } from "../db/database";

/**
 * Real Firebase Sync Provider.
 * Implements the SyncProvider interface connecting Dexie offline queue to Firestore and Firebase Storage.
 */
export class FirebaseSyncProvider implements SyncProvider {
  name = "FirebaseSyncProvider";

  /**
   * Helper to retrieve active authenticated user UID.
   */
  private getAuthenticatedUserId(): string | null {
    if (auth.currentUser) {
      return auth.currentUser.uid;
    }
    const cached = getCurrentUser();
    if (cached && !cached.isOfflineUser && cached.uid) {
      return cached.uid;
    }
    return null;
  }

  /**
   * Synchronizes an inspection record to Firestore.
   */
  async syncInspection(item: SyncQueueItem): Promise<{ success: boolean; error?: string }> {
    const userId = this.getAuthenticatedUserId();
    if (!userId) {
      console.warn("[FirebaseSyncProvider] syncInspection: No authenticated Firebase user.");
      return { success: false, error: "Firebase authentication required for cloud sync. Please sign in." };
    }

    try {
      const inspectionId = item.entityId;
      const localRecord = await getInspection(inspectionId);

      const now = new Date().toISOString();
      const firestoreData = {
        id: inspectionId,
        userId: userId,
        machine: localRecord?.machine || item.payload?.machine || "TRF-102",
        site: localRecord?.site || item.payload?.site || "Field Site",
        status: localRecord?.status || item.payload?.status || "DRAFT",
        checklist: localRecord?.checklist || item.payload?.checklist || [],
        notes: localRecord?.notes || item.payload?.notes || "",
        resolved: localRecord?.resolved ?? item.payload?.resolved ?? false,
        submittedAt: localRecord?.submittedAt || item.payload?.submittedAt || null,
        createdAt: localRecord?.createdAt || item.payload?.createdAt || now,
        updatedAt: localRecord?.updatedAt || item.payload?.updatedAt || now,
        syncedAt: now,
      };

      // Write to user-scoped Firestore path: users/{userId}/inspections/{inspectionId}
      const firestorePath = `users/${userId}/inspections/${inspectionId}`;
      console.info(`[FirebaseSyncProvider] Writing inspection to Firestore: ${firestorePath}`);
      const inspDocRef = doc(db, "users", userId, "inspections", inspectionId);
      await setDoc(inspDocRef, firestoreData, { merge: true });

      // Update local Dexie record to SYNCED
      if (localRecord) {
        await updateInspection(inspectionId, {
          syncStatus: "SYNCED",
        });
      }

      console.info(`[FirebaseSyncProvider] Successfully synced inspection ${inspectionId} to Firestore.`);
      return { success: true };
    } catch (err: any) {
      const errorMsg = err?.message || "Firestore inspection sync error";
      console.error("[FirebaseSyncProvider] Firebase inspection sync failed:", err);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Synchronizes an evidence record: uploads Blob to Storage, writes metadata to Firestore.
   */
  async syncEvidence(item: SyncQueueItem): Promise<{ success: boolean; error?: string }> {
    const userId = this.getAuthenticatedUserId();
    if (!userId) {
      console.warn("[FirebaseSyncProvider] syncEvidence: No authenticated Firebase user.");
      return { success: false, error: "Firebase authentication required for photo upload. Please sign in." };
    }

    try {
      const evidenceId = item.entityId;
      const localEvidence = await getEvidence(evidenceId);

      if (!localEvidence) {
        console.warn(`[FirebaseSyncProvider] Evidence ${evidenceId} not found in Dexie.`);
        return { success: false, error: `Evidence ${evidenceId} not found locally` };
      }

      const inspectionId = localEvidence.inspectionId || item.payload?.inspectionId || "INS-2026-TN-0001";
      const fileName = localEvidence.fileName || localEvidence.name || `evidence_${evidenceId}.jpg`;
      const mimeType = localEvidence.fileType || localEvidence.mimeType || "image/jpeg";

      let downloadUrl = localEvidence.dataUrl || "";
      let storagePath = buildEvidenceStoragePath(userId, inspectionId, evidenceId, fileName);

      // 1. Upload Blob to Firebase Storage if blob exists
      if (localEvidence.blob && localEvidence.blob.size > 0) {
        console.info(`[FirebaseSyncProvider] Uploading photo (${localEvidence.blob.size} bytes) to Firebase Storage: ${storagePath}`);
        const uploadRes = await uploadEvidenceFile(
          userId,
          inspectionId,
          evidenceId,
          fileName,
          localEvidence.blob,
          mimeType
        );

        if (!uploadRes.success) {
          console.error(`[FirebaseSyncProvider] Storage upload failed: ${uploadRes.error}`);
          return { success: false, error: uploadRes.error || "Failed to upload photo to Firebase Storage" };
        }

        downloadUrl = uploadRes.downloadUrl || downloadUrl;
        storagePath = uploadRes.storagePath || storagePath;
        console.info(`[FirebaseSyncProvider] Storage upload successful: ${downloadUrl}`);
      } else {
        console.info(`[FirebaseSyncProvider] Evidence ${evidenceId} has no local Blob; skipping Storage file upload.`);
      }

      // 2. Write metadata to Firestore: users/{userId}/inspections/{inspectionId}/evidence/{evidenceId}
      const now = new Date().toISOString();
      const firestorePath = `users/${userId}/inspections/${inspectionId}/evidence/${evidenceId}`;
      console.info(`[FirebaseSyncProvider] Writing evidence metadata to Firestore: ${firestorePath}`);
      const metadataRef = doc(db, "users", userId, "inspections", inspectionId, "evidence", evidenceId);
      
      const firestoreEvidence = {
        id: evidenceId,
        inspectionId,
        userId,
        fileName,
        fileType: mimeType,
        fileSize: localEvidence.fileSize || localEvidence.size || 0,
        description: localEvidence.description || "",
        category: localEvidence.category || "PHOTO",
        storagePath,
        downloadUrl,
        createdAt: localEvidence.createdAt || now,
        updatedAt: localEvidence.updatedAt || now,
        syncedAt: now,
      };

      await setDoc(metadataRef, firestoreEvidence, { merge: true });

      // 3. Mark local evidence record as SYNCED in Dexie
      await updateEvidence(evidenceId, {
        syncStatus: "SYNCED",
        syncedAt: now,
        dataUrl: downloadUrl || localEvidence.dataUrl,
      });

      console.info(`[FirebaseSyncProvider] Successfully synced evidence ${evidenceId} to Storage & Firestore.`);
      return { success: true };
    } catch (err: any) {
      const errorMsg = err?.message || "Firebase evidence sync error";
      console.error("[FirebaseSyncProvider] Firebase evidence sync failed:", err);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Deletes evidence from Storage and Firestore metadata.
   */
  async deleteEvidence(item: SyncQueueItem): Promise<{ success: boolean; error?: string }> {
    const userId = this.getAuthenticatedUserId();
    if (!userId) {
      return { success: false, error: "User is not authenticated" };
    }

    try {
      const evidenceId = item.entityId;
      const inspectionId = item.payload?.inspectionId || "INS-2026-TN-0001";
      const fileName = item.payload?.fileName || `evidence_${evidenceId}.jpg`;

      // 1. Delete from Storage
      const storagePath = item.payload?.storagePath || buildEvidenceStoragePath(userId, inspectionId, evidenceId, fileName);
      console.info(`[FirebaseSyncProvider] Deleting from Firebase Storage: ${storagePath}`);
      await deleteEvidenceFile(storagePath);

      // 2. Delete from Firestore
      const metadataRef = doc(db, "users", userId, "inspections", inspectionId, "evidence", evidenceId);
      console.info(`[FirebaseSyncProvider] Deleting from Firestore: users/${userId}/inspections/${inspectionId}/evidence/${evidenceId}`);
      await deleteDoc(metadataRef);

      return { success: true };
    } catch (err: any) {
      const errorMsg = err?.message || "Firebase evidence delete error";
      console.error("[FirebaseSyncProvider] Firebase evidence deletion failed:", err);
      return { success: false, error: errorMsg };
    }
  }
}

export const firebaseSyncProvider = new FirebaseSyncProvider();
