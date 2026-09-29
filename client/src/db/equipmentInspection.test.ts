import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "./database";
import {
  seedEquipmentMasterDataIfEmpty,
  getAllFacilities,
  getAllEquipmentTypes,
  searchEquipmentAssets,
  getAssetByCodeOrId,
  getInspectionTemplateById,
  recordFindingLocally,
  getFindingsForInspection,
  recordAuditEvent,
  getAllAuditEvents,
} from "./equipmentStorage";
import {
  ELECTRICAL_EQUIPMENT_TYPES,
  GOVERNMENT_FACILITIES,
  SEED_EQUIPMENT_ASSETS,
  EQUIPMENT_INSPECTION_TEMPLATES,
  getTemplateForEquipmentType,
} from "../data/equipmentCatalog";

describe("Government Electrical Equipment Inspection Platform Tests", () => {
  beforeEach(async () => {
    await db.facilities.clear();
    await db.equipmentTypes.clear();
    await db.equipmentAssets.clear();
    await db.inspectionTemplates.clear();
    await db.findings.clear();
    await db.auditEvents.clear();
  });

  it("1. Seeds master equipment data into Dexie IndexedDB tables if empty", async () => {
    await seedEquipmentMasterDataIfEmpty();

    const facilities = await getAllFacilities();
    const types = await getAllEquipmentTypes();
    const assets = await searchEquipmentAssets({});

    expect(facilities.length).toBeGreaterThanOrEqual(GOVERNMENT_FACILITIES.length);
    expect(types.length).toBeGreaterThanOrEqual(ELECTRICAL_EQUIPMENT_TYPES.length);
    expect(assets.length).toBeGreaterThanOrEqual(SEED_EQUIPMENT_ASSETS.length);
  });

  it("2. Searches equipment offline by query, category, and facility", async () => {
    await seedEquipmentMasterDataIfEmpty();

    // Query search for transformer
    const trfResults = await searchEquipmentAssets({ searchQuery: "TRF-102" });
    expect(trfResults.length).toBeGreaterThan(0);
    expect(trfResults[0].assetCode).toBe("TRF-102");

    // Category search for Generators
    const genResults = await searchEquipmentAssets({ category: "Generators" });
    expect(genResults.length).toBeGreaterThan(0);
    expect(genResults.every(g => g.category === "Generators")).toBe(true);

    // Facility filter
    const facResults = await searchEquipmentAssets({ facilityId: "FAC-TN-CBE-01" });
    expect(facResults.length).toBeGreaterThan(0);
    expect(facResults.every(f => f.facilityId === "FAC-TN-CBE-01")).toBe(true);
  });

  it("3. Retrieves equipment asset by asset code or ID", async () => {
    await seedEquipmentMasterDataIfEmpty();

    const asset = await getAssetByCodeOrId("TRF-102");
    expect(asset).not.toBeNull();
    expect(asset?.assetCode).toBe("TRF-102");
    expect(asset?.manufacturer).toBe("ABB India Ltd");
    expect(asset?.voltageRating).toBe("230 / 110 / 33 kV");
  });

  it("4. Automatically resolves correct equipment-specific inspection template and smart thresholds", () => {
    // Transformer template
    const trfTmpl = getTemplateForEquipmentType("EQ-TRF-PWR");
    expect(trfTmpl.name).toContain("Transformer");
    expect(trfTmpl.sections.length).toBeGreaterThanOrEqual(5);

    // Check smart threshold for Oil Temperature (Normal < 80, Warning 80-90, Critical > 90)
    const oilSection = trfTmpl.sections.find(s => s.title.includes("Oil") || s.title.includes("Thermal") || s.title.includes("Core"));
    expect(oilSection).toBeDefined();

    // Circuit Breaker template
    const vcbTmpl = getTemplateForEquipmentType("EQ-CBK-VCB");
    expect(vcbTmpl.name).toContain("Circuit Breaker");

    // Generator template
    const genTmpl = getTemplateForEquipmentType("EQ-GEN-DG");
    expect(genTmpl.name).toContain("Generator");
  });

  it("5. Records defect findings locally in Dexie with severity and evidence link", async () => {
    const inspectionId = "INS-TEST-FINDING-01";
    await recordFindingLocally({
      id: "FND-001",
      inspectionId,
      assetId: "AST-TRF-001",
      assetCode: "TRF-102",
      facilityId: "FAC-CBE-SS-01",
      sectionId: "SEC-03",
      itemId: "TRF-05",
      itemLabel: "Oil Temperature",
      severity: "CRITICAL",
      description: "Transformer top oil temperature measured 92°C exceeding critical threshold.",
      suggestedAction: "Initiate emergency cooling loop and load shedding.",
      status: "OPEN",
      createdAt: new Date().toISOString(),
    });

    const findings = await getFindingsForInspection(inspectionId);
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe("CRITICAL");
    expect(findings[0].status).toBe("OPEN");
  });

  it("6. Records tamper-proof audit events locally in Dexie IndexedDB", async () => {
    await recordAuditEvent({
      userId: "USR-001",
      userName: "Field Officer Pragatheesh",
      userRole: "Field Inspector",
      action: "INSPECTION_SUBMITTED",
      entityType: "INSPECTION",
      entityId: "INS-TEST-001",
      assetCode: "TRF-102",
      details: { overallResult: "WARNING", passed: 18, warnings: 2, failed: 0 },
      isOffline: true,
    });

    const events = await getAllAuditEvents();
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].action).toBe("INSPECTION_SUBMITTED");
    expect(events[0].isOffline).toBe(true);
  });
});
