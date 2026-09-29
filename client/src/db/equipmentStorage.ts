import { db, type FindingRecord, type AuditEventRecord } from "./database";
import {
  ELECTRICAL_EQUIPMENT_TYPES,
  GOVERNMENT_FACILITIES,
  SEED_EQUIPMENT_ASSETS,
  EQUIPMENT_INSPECTION_TEMPLATES,
  type EquipmentAsset,
  type EquipmentCategory,
  type EquipmentTypeDefinition,
  type GovernmentFacility,
  type EquipmentInspectionTemplate,
} from "../data/equipmentCatalog";

/**
 * Initializes and seeds Dexie IndexedDB with Government Facilities,
 * Electrical Equipment Catalog, and Sample Assets if tables are empty.
 */
export async function seedEquipmentMasterDataIfEmpty(): Promise<void> {
  try {
    const facilityCount = await db.facilities.count();
    if (facilityCount === 0) {
      await db.facilities.bulkAdd(GOVERNMENT_FACILITIES);
    }

    const typeCount = await db.equipmentTypes.count();
    if (typeCount === 0) {
      await db.equipmentTypes.bulkAdd(ELECTRICAL_EQUIPMENT_TYPES);
    }

    const assetCount = await db.equipmentAssets.count();
    if (assetCount === 0) {
      await db.equipmentAssets.bulkAdd(SEED_EQUIPMENT_ASSETS);
    }

    const templateCount = await db.inspectionTemplates.count();
    if (templateCount === 0) {
      const templatesList = Object.values(EQUIPMENT_INSPECTION_TEMPLATES);
      await db.inspectionTemplates.bulkAdd(templatesList);
    }
  } catch (err) {
    console.warn("IndexedDB equipment master seed warning:", err);
  }
}

/**
 * Retrieves all government facilities from local Dexie IndexedDB.
 */
export async function getAllFacilities(): Promise<GovernmentFacility[]> {
  try {
    await seedEquipmentMasterDataIfEmpty();
    const list = await db.facilities.toArray();
    return list.length > 0 ? list : GOVERNMENT_FACILITIES;
  } catch {
    return GOVERNMENT_FACILITIES;
  }
}

/**
 * Retrieves all equipment types from local IndexedDB.
 */
export async function getAllEquipmentTypes(): Promise<EquipmentTypeDefinition[]> {
  try {
    await seedEquipmentMasterDataIfEmpty();
    const list = await db.equipmentTypes.toArray();
    return list.length > 0 ? list : ELECTRICAL_EQUIPMENT_TYPES;
  } catch {
    return ELECTRICAL_EQUIPMENT_TYPES;
  }
}

/**
 * Fast offline indexed search for equipment assets across facility, category,
 * assetCode, name, model, and manufacturer.
 */
export async function searchEquipmentAssets(params: {
  facilityId?: string;
  category?: EquipmentCategory | "All";
  searchQuery?: string;
}): Promise<EquipmentAsset[]> {
  try {
    await seedEquipmentMasterDataIfEmpty();
    let assets = await db.equipmentAssets.toArray();
    if (assets.length === 0) {
      assets = SEED_EQUIPMENT_ASSETS;
    }

    return assets.filter(asset => {
      // Filter by Facility
      if (params.facilityId && params.facilityId !== "ALL" && asset.facilityId !== params.facilityId) {
        return false;
      }

      // Filter by Category
      if (params.category && params.category !== "All" && asset.category !== params.category) {
        return false;
      }

      // Search Query
      if (params.searchQuery && params.searchQuery.trim() !== "") {
        const q = params.searchQuery.toLowerCase().trim();
        const codeMatch = asset.assetCode?.toLowerCase().includes(q);
        const nameMatch = asset.name?.toLowerCase().includes(q);
        const mfgMatch = asset.manufacturer?.toLowerCase().includes(q);
        const modelMatch = asset.model?.toLowerCase().includes(q);
        const locMatch = asset.locationName?.toLowerCase().includes(q);
        const qrMatch = asset.qrCode?.toLowerCase().includes(q);
        const typeMatch = asset.equipmentTypeId?.toLowerCase().includes(q);

        return codeMatch || nameMatch || mfgMatch || modelMatch || locMatch || qrMatch || typeMatch;
      }

      return true;
    });
  } catch {
    return SEED_EQUIPMENT_ASSETS;
  }
}

/**
 * Retrieves a single asset by asset code or ID.
 */
export async function getAssetByCodeOrId(codeOrId: string): Promise<EquipmentAsset | null> {
  try {
    await seedEquipmentMasterDataIfEmpty();
    const clean = codeOrId.trim();
    const direct = await db.equipmentAssets.get(clean);
    if (direct) return direct;

    const byCode = await db.equipmentAssets.where("assetCode").equals(clean).first();
    if (byCode) return byCode;

    // Search in fallback seed array
    const fallback = SEED_EQUIPMENT_ASSETS.find(
      a => a.id === clean || a.assetCode.toLowerCase() === clean.toLowerCase() || a.qrCode?.toLowerCase() === clean.toLowerCase()
    );
    return fallback || null;
  } catch {
    return SEED_EQUIPMENT_ASSETS.find(a => a.assetCode === codeOrId) || null;
  }
}

/**
 * Saves a new or edited equipment asset locally in Dexie.
 */
export async function saveEquipmentAsset(asset: EquipmentAsset): Promise<void> {
  await db.equipmentAssets.put(asset);
}

/**
 * Retrieves an inspection template by ID from local IndexedDB.
 */
export async function getInspectionTemplateById(templateId: string): Promise<EquipmentInspectionTemplate | null> {
  try {
    await seedEquipmentMasterDataIfEmpty();
    const tmpl = await db.inspectionTemplates.get(templateId);
    if (tmpl) return tmpl;
    return EQUIPMENT_INSPECTION_TEMPLATES[templateId] || null;
  } catch {
    return EQUIPMENT_INSPECTION_TEMPLATES[templateId] || null;
  }
}

/**
 * Records an inspection finding in Dexie IndexedDB.
 */
export async function recordFindingLocally(finding: FindingRecord): Promise<void> {
  await db.findings.put(finding);
}

/**
 * Retrieves all findings for an inspection.
 */
export async function getFindingsForInspection(inspectionId: string): Promise<FindingRecord[]> {
  try {
    return await db.findings.where("inspectionId").equals(inspectionId).toArray();
  } catch {
    return [];
  }
}

/**
 * Records an audit event locally in Dexie IndexedDB.
 */
export async function recordAuditEvent(event: Omit<AuditEventRecord, "id" | "timestamp">): Promise<void> {
  try {
    const record: AuditEventRecord = {
      id: `AUD-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...event,
    };
    await db.auditEvents.put(record);
  } catch (err) {
    console.warn("Failed to record audit event:", err);
  }
}

/**
 * Retrieves all audit events.
 */
export async function getAllAuditEvents(): Promise<AuditEventRecord[]> {
  try {
    return await db.auditEvents.reverse().sortBy("timestamp");
  } catch {
    return [];
  }
}
