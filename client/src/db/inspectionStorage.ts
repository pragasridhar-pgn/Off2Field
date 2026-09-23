import { db, type InspectionRecord } from "./database";

/**
 * Saves or replaces an inspection record in Dexie IndexedDB.
 */
export async function saveInspection(record: InspectionRecord): Promise<string> {
  return await db.inspections.put(record);
}

/**
 * Retrieves a single inspection record by its ID.
 */
export async function getInspection(id: string): Promise<InspectionRecord | undefined> {
  return await db.inspections.get(id);
}

/**
 * Retrieves all stored inspection records.
 */
export async function getAllInspections(): Promise<InspectionRecord[]> {
  return await db.inspections.toArray();
}

/**
 * Updates specific fields of an existing inspection record by ID.
 */
export async function updateInspection(
  id: string,
  changes: Partial<InspectionRecord>
): Promise<number> {
  return await db.inspections.update(id, changes);
}

/**
 * Deletes an inspection record by ID.
 */
export async function deleteInspection(id: string): Promise<void> {
  await db.inspections.delete(id);
}
