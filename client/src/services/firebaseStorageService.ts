import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "../firebase/firebaseConfig";

export interface EvidenceUploadResult {
  success: boolean;
  storagePath?: string;
  downloadUrl?: string;
  error?: string;
}

/**
 * Builds the canonical user/inspection-scoped storage path for an evidence item.
 */
export function buildEvidenceStoragePath(
  userId: string,
  inspectionId: string,
  evidenceId: string,
  fileName: string
): string {
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `evidence/${userId}/${inspectionId}/${evidenceId}/${sanitizedFileName}`;
}

/**
 * Uploads a local evidence Blob/File to Firebase Storage.
 */
export async function uploadEvidenceFile(
  userId: string,
  inspectionId: string,
  evidenceId: string,
  fileName: string,
  blob: Blob,
  contentType?: string
): Promise<EvidenceUploadResult> {
  try {
    const storagePath = buildEvidenceStoragePath(userId, inspectionId, evidenceId, fileName);
    const storageRef = ref(storage, storagePath);

    const metadata = {
      contentType: contentType || blob.type || "image/jpeg",
      customMetadata: {
        userId,
        inspectionId,
        evidenceId,
        uploadedAt: new Date().toISOString(),
      },
    };

    const uploadSnapshot = await uploadBytes(storageRef, blob, metadata);
    const downloadUrl = await getDownloadURL(uploadSnapshot.ref);

    return {
      success: true,
      storagePath,
      downloadUrl,
    };
  } catch (err: any) {
    const errorMsg = err?.message || "Storage upload failed";
    console.error("Firebase Storage upload error:", err);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Deletes an evidence file from Firebase Storage.
 */
export async function deleteEvidenceFile(storagePath: string): Promise<{ success: boolean; error?: string }> {
  try {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
    return { success: true };
  } catch (err: any) {
    // If object does not exist, consider it successfully deleted
    if (err?.code === "storage/object-not-found") {
      return { success: true };
    }
    const errorMsg = err?.message || "Storage delete failed";
    console.error("Firebase Storage delete error:", err);
    return { success: false, error: errorMsg };
  }
}

/**
 * Retrieves the download URL for a storage path.
 */
export async function getEvidenceDownloadUrl(storagePath: string): Promise<string | null> {
  try {
    const storageRef = ref(storage, storagePath);
    return await getDownloadURL(storageRef);
  } catch (err) {
    console.warn("Could not retrieve download URL for:", storagePath, err);
    return null;
  }
}
