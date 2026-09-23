import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { getInspection, saveInspection, updateInspection } from "../db/inspectionStorage";
import { getEvidence, saveEvidence } from "../db/evidenceStorage";
import type { InspectionRecord, EvidenceRecord } from "../db/database";

export interface CloudSyncResult {
  pulledInspections: number;
  pulledEvidence: number;
  conflictsResolved: number;
  message: string;
}

/**
 * Downloads initial/updated cloud data from Firestore for the authenticated user
 * and applies timestamp-based conflict resolution against Dexie IndexedDB.
 */
export async function pullInitialCloudData(userId: string): Promise<CloudSyncResult> {
  if (!userId) {
    return {
      pulledInspections: 0,
      pulledEvidence: 0,
      conflictsResolved: 0,
      message: "No user ID provided for cloud sync",
    };
  }

  let pulledInspections = 0;
  let pulledEvidence = 0;
  let conflictsResolved = 0;

  try {
    const inspectionsRef = collection(db, "users", userId, "inspections");
    const snapshot = await getDocs(inspectionsRef);

    for (const docSnap of snapshot.docs) {
      const cloudData = docSnap.data();
      const inspectionId = docSnap.id;
      const localInspection = await getInspection(inspectionId);

      if (!localInspection) {
        // Case 1: Inspection does not exist locally -> Save from cloud into Dexie
        const newLocalRecord: InspectionRecord = {
          id: inspectionId,
          machine: cloudData.machine || "TRF-102",
          site: cloudData.site || "Field Site",
          status: cloudData.status || "DRAFT",
          checklist: cloudData.checklist || [],
          notes: cloudData.notes || "",
          resolved: cloudData.resolved || false,
          submittedAt: cloudData.submittedAt || undefined,
          syncStatus: "SYNCED",
          createdAt: cloudData.createdAt || new Date().toISOString(),
          updatedAt: cloudData.updatedAt || new Date().toISOString(),
        };
        await saveInspection(newLocalRecord);
        pulledInspections++;
      } else {
        // Case 2: Conflict resolution using updatedAt timestamps
        const localTime = new Date(localInspection.updatedAt).getTime();
        const cloudTime = new Date(cloudData.updatedAt || 0).getTime();

        if (localInspection.syncStatus === "PENDING" && localTime > cloudTime) {
          // Local has newer offline changes -> Preserve local, let sync queue push later
          console.info(`Preserving local changes for ${inspectionId} (Local: ${localInspection.updatedAt} > Cloud: ${cloudData.updatedAt})`);
        } else if (cloudTime > localTime || localInspection.syncStatus === "SYNCED") {
          // Cloud has newer changes or local was already synced -> Update local from cloud
          await updateInspection(inspectionId, {
            machine: cloudData.machine || localInspection.machine,
            site: cloudData.site || localInspection.site,
            status: cloudData.status || localInspection.status,
            checklist: cloudData.checklist || localInspection.checklist,
            notes: cloudData.notes || localInspection.notes,
            resolved: cloudData.resolved ?? localInspection.resolved,
            submittedAt: cloudData.submittedAt || localInspection.submittedAt,
            syncStatus: "SYNCED",
            updatedAt: cloudData.updatedAt || localInspection.updatedAt,
          });
          conflictsResolved++;
        }
      }

      // ── Pull Evidence Subcollection Metadata ─────────────────
      try {
        const evidenceRef = collection(db, "users", userId, "inspections", inspectionId, "evidence");
        const evidenceSnapshot = await getDocs(evidenceRef);

        for (const evDoc of evidenceSnapshot.docs) {
          const evData = evDoc.data();
          const evidenceId = evDoc.id;
          const localEv = await getEvidence(evidenceId);

          if (!localEv) {
            // Save cloud metadata locally in Dexie with empty Blob (download on demand via downloadUrl)
            const emptyBlob = new Blob([], { type: evData.fileType || "image/jpeg" });
            const evRecord: EvidenceRecord = {
              id: evidenceId,
              inspectionId,
              fileName: evData.fileName || `evidence_${evidenceId}.jpg`,
              fileType: evData.fileType || "image/jpeg",
              fileSize: evData.fileSize || 0,
              blob: emptyBlob,
              description: evData.description || "",
              dataUrl: evData.downloadUrl || "",
              syncStatus: "SYNCED",
              createdAt: evData.createdAt || new Date().toISOString(),
              updatedAt: evData.updatedAt || new Date().toISOString(),
              syncedAt: evData.syncedAt || new Date().toISOString(),
            };
            await saveEvidence(evRecord);
            pulledEvidence++;
          }
        }
      } catch (evErr) {
        console.warn(`Could not pull evidence metadata for inspection ${inspectionId}:`, evErr);
      }
    }

    return {
      pulledInspections,
      pulledEvidence,
      conflictsResolved,
      message: `Cloud sync complete: ${pulledInspections} inspections pulled, ${pulledEvidence} evidence items synced, ${conflictsResolved} conflicts updated.`,
    };
  } catch (err: any) {
    console.error("Cloud data pull failed:", err);
    return {
      pulledInspections: 0,
      pulledEvidence: 0,
      conflictsResolved: 0,
      message: `Cloud pull error: ${err?.message || "Failed to fetch cloud data"}`,
    };
  }
}
