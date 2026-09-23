import { db, type InspectionRecord } from "./database";

/**
 * Saves or replaces an inspection record in Dexie IndexedDB.
 * Ensures createdAt is preserved and updatedAt is advanced.
 */
export async function saveInspection(record: InspectionRecord): Promise<string> {
  const now = new Date().toISOString();
  const existing = await db.inspections.get(record.id);
  const finalRecord: InspectionRecord = {
    ...record,
    createdAt: existing?.createdAt || record.createdAt || now,
    updatedAt: now,
  };
  return await db.inspections.put(finalRecord);
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
 *
 * Phase 1 Conflict-Safe Handling:
 * - Preserves original createdAt and immutable record id
 * - Sets updatedAt to latest local timestamp
 * - In Phase 2, Firebase server timestamp comparisons & 3-way conflict resolution will hook in here.
 */
export async function updateInspection(
  id: string,
  changes: Partial<InspectionRecord>
): Promise<number> {
  const now = new Date().toISOString();
  return await db.inspections.update(id, {
    ...changes,
    updatedAt: changes.updatedAt || now,
  });
}

/**
 * Deletes an inspection record by ID.
 */
export async function deleteInspection(id: string): Promise<void> {
  await db.inspections.delete(id);
}
