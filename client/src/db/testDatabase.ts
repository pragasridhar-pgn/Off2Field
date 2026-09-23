import { db } from "./database";

export async function testDatabase() {
  await db.inspections.put({
    id: "TEST-001",
    status: "DRAFT",
    checklist: [],
    resolved: false,
    syncStatus: "PENDING",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const record = await db.inspections.get("TEST-001");

  console.log("Dexie test record:", record);
}
