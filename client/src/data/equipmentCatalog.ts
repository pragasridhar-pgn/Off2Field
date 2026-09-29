export type EquipmentCategory =
  | "Transformers"
  | "Generators"
  | "Motors"
  | "Switchgear"
  | "Circuit Breakers"
  | "Isolation / Switching"
  | "Protection"
  | "Capacitors"
  | "Busbar / Distribution"
  | "Cables"
  | "Battery / DC"
  | "Earthing"
  | "Metering"
  | "Substation"
  | "Renewable"
  | "Safety";

export interface EquipmentTypeDefinition {
  id: string;
  name: string;
  category: EquipmentCategory;
  description: string;
  standardCode?: string;
  defaultVoltage?: string;
  templateId: string;
}

export interface SmartThreshold {
  unit: string;
  normalMin?: number;
  normalMax?: number;
  warningMin?: number;
  warningMax?: number;
  criticalMin?: number;
  criticalMax?: number;
}

export type ChecklistFieldType =
  | "PASS_FAIL"
  | "YES_NO"
  | "NORMAL_ABNORMAL"
  | "NUMERIC"
  | "TEMPERATURE"
  | "PRESSURE"
  | "VOLTAGE"
  | "CURRENT"
  | "RESISTANCE"
  | "INSULATION_RESISTANCE"
  | "BDV"
  | "VIBRATION"
  | "OIL_LEVEL"
  | "PERCENTAGE"
  | "DROPDOWN"
  | "TEXT"
  | "PHOTO";

export interface ChecklistItemTemplate {
  id: string;
  label: string;
  type: ChecklistFieldType;
  helperText?: string;
  unit?: string;
  required?: boolean;
  options?: string[];
  threshold?: SmartThreshold;
  defaultValue?: string;
  evidenceRequiredOnFail?: boolean;
}

export interface ChecklistSectionTemplate {
  id: string;
  title: string;
  order: number;
  items: ChecklistItemTemplate[];
}

export interface SafetyCheckItem {
  id: string;
  label: string;
  required: boolean;
  standardRef?: string;
}

export interface EquipmentInspectionTemplate {
  id: string;
  equipmentTypeId: string;
  category: EquipmentCategory;
  name: string;
  version: string;
  sections: ChecklistSectionTemplate[];
  safetyChecks: SafetyCheckItem[];
}

export interface GovernmentFacility {
  id: string;
  name: string;
  department: string;
  region: string;
  division: string;
  subDivision: string;
  section: string;
  facilityType: "Substation" | "Power Plant" | "Pump Station" | "Solar Yard" | "Industrial Feeder";
  address: string;
}

export interface EquipmentAsset {
  id: string;
  assetCode: string;
  name: string;
  equipmentTypeId: string;
  category: EquipmentCategory;
  facilityId: string;
  locationName: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  capacity: string;
  voltageRating: string;
  currentRating?: string;
  installationDate: string;
  lastInspectionDate?: string;
  lastInspectionResult?: "PASS" | "PASS WITH OBSERVATIONS" | "WARNING" | "FAIL" | "CRITICAL";
  healthStatus: "HEALTHY" | "ATTENTION" | "CRITICAL" | "INSPECTION_DUE";
  openFindingsCount?: number;
  qrCode?: string;
}

// ─────────────────────────────────────────────────────────────
// 1. COMPREHENSIVE ELECTRICAL EQUIPMENT TYPES
// ─────────────────────────────────────────────────────────────

export const ELECTRICAL_EQUIPMENT_TYPES: EquipmentTypeDefinition[] = [
  // ── TRANSFORMERS ──
  { id: "EQ-TRF-PWR", name: "Power Transformer", category: "Transformers", description: "High capacity transmission / step-down transformer", defaultVoltage: "220/110/33 kV", templateId: "TMPL-TRF-PWR" },
  { id: "EQ-TRF-DIS", name: "Distribution Transformer", category: "Transformers", description: "Medium/low voltage distribution transformer", defaultVoltage: "33/11 kV or 11/0.415 kV", templateId: "TMPL-TRF-DIS" },
  { id: "EQ-TRF-AUX", name: "Auxiliary Transformer", category: "Transformers", description: "Substation station service & auxiliary supply", defaultVoltage: "11/0.415 kV", templateId: "TMPL-TRF-DIS" },
  { id: "EQ-TRF-GEN", name: "Generator Transformer", category: "Transformers", description: "Step-up transformer connected to alternator", defaultVoltage: "15.75/220 kV", templateId: "TMPL-TRF-PWR" },
  { id: "EQ-TRF-EAR", name: "Earthing Transformer", category: "Transformers", description: "Neutral grounding & zig-zag earthing unit", defaultVoltage: "33 kV", templateId: "TMPL-TRF-DIS" },
  { id: "EQ-TRF-AUT", name: "Auto Transformer", category: "Transformers", description: "High voltage interconnecting auto-transformer", defaultVoltage: "400/220 kV", templateId: "TMPL-TRF-PWR" },
  { id: "EQ-TRF-CT", name: "Current Transformer (CT)", category: "Transformers", description: "Instrument current measurement transformer", defaultVoltage: "110 kV", templateId: "TMPL-INST-TRF" },
  { id: "EQ-TRF-PT", name: "Potential Transformer (PT)", category: "Transformers", description: "Voltage sensing & instrumentation transformer", defaultVoltage: "110 kV", templateId: "TMPL-INST-TRF" },
  { id: "EQ-TRF-CVT", name: "Capacitive Voltage Transformer (CVT)", category: "Transformers", description: "EHV voltage measurement and PLCC coupling", defaultVoltage: "220 kV", templateId: "TMPL-INST-TRF" },

  // ── GENERATORS ──
  { id: "EQ-GEN-DG", name: "Diesel Generator (DG)", category: "Generators", description: "Internal combustion emergency backup generator set", defaultVoltage: "415 V / 11 kV", templateId: "TMPL-GEN-DG" },
  { id: "EQ-GEN-SYN", name: "Synchronous Generator", category: "Generators", description: "Utility-scale grid connected alternator set", defaultVoltage: "11 kV", templateId: "TMPL-GEN-DG" },
  { id: "EQ-GEN-ALT", name: "Alternator Set", category: "Generators", description: "Brushless 3-phase alternator", defaultVoltage: "415 V", templateId: "TMPL-GEN-DG" },
  { id: "EQ-GEN-EMG", name: "Emergency Standby Generator", category: "Generators", description: "Auto-mains-failure critical support genset", defaultVoltage: "415 V", templateId: "TMPL-GEN-DG" },
  { id: "EQ-GEN-GAS", name: "Gas Turbine Generator", category: "Generators", description: "Combustion gas turbine alternator", defaultVoltage: "15.75 kV", templateId: "TMPL-GEN-DG" },
  { id: "EQ-GEN-EXC", name: "Generator Excitation System", category: "Generators", description: "Static & brushless excitation regulator panel", defaultVoltage: "180 V DC", templateId: "TMPL-GEN-DG" },

  // ── MOTORS ──
  { id: "EQ-MTR-IND", name: "Induction Motor", category: "Motors", description: "3-Phase squirrel cage / slip ring industrial motor", defaultVoltage: "415 V / 3.3 kV / 6.6 kV", templateId: "TMPL-MTR-IND" },
  { id: "EQ-MTR-SYN", name: "Synchronous Motor", category: "Motors", description: "Constant speed heavy industrial drive", defaultVoltage: "6.6 kV", templateId: "TMPL-MTR-IND" },
  { id: "EQ-MTR-3PH", name: "Three-Phase Motor", category: "Motors", description: "Continuous duty pump and fan motor drive", defaultVoltage: "415 V", templateId: "TMPL-MTR-IND" },
  { id: "EQ-MTR-DCM", name: "DC Motor", category: "Motors", description: "Direct current variable speed drive", defaultVoltage: "220 V DC", templateId: "TMPL-MTR-IND" },
  { id: "EQ-MTR-STR", name: "Motor Starter & VFD", category: "Motors", description: "Star-Delta, Soft Starter or Variable Frequency Drive", defaultVoltage: "415 V", templateId: "TMPL-MTR-IND" },
  { id: "EQ-MTR-MCC", name: "Motor Control Centre (MCC)", category: "Motors", description: "Multi-feeder centralized motor control switchboard", defaultVoltage: "415 V", templateId: "TMPL-SWG-LV" },

  // ── SWITCHGEAR ──
  { id: "EQ-SWG-HT", name: "HT Switchgear Panel", category: "Switchgear", description: "High Tension indoor metal-clad switchgear", defaultVoltage: "11 kV / 33 kV", templateId: "TMPL-SWG-HV" },
  { id: "EQ-SWG-LT", name: "LT Switchgear Panel", category: "Switchgear", description: "Low Tension main power distribution switchboard", defaultVoltage: "415 V", templateId: "TMPL-SWG-LV" },
  { id: "EQ-SWG-RMU", name: "Ring Main Unit (RMU)", category: "Switchgear", description: "Compact SF6 or Solid Insulated ring distribution unit", defaultVoltage: "11 kV / 22 kV", templateId: "TMPL-SWG-HV" },
  { id: "EQ-SWG-MDB", name: "Main Distribution Board (MDB)", category: "Switchgear", description: "Primary low voltage load distribution panel", defaultVoltage: "415 V", templateId: "TMPL-SWG-LV" },
  { id: "EQ-SWG-PBD", name: "Panel Board & DB", category: "Switchgear", description: "Sub-distribution board and lighting feeder panel", defaultVoltage: "230/415 V", templateId: "TMPL-SWG-LV" },

  // ── CIRCUIT BREAKERS ──
  { id: "EQ-CBK-VCB", name: "Vacuum Circuit Breaker (VCB)", category: "Circuit Breakers", description: "Medium voltage vacuum bottle interrupter breaker", defaultVoltage: "11 kV / 33 kV", templateId: "TMPL-CBK-VCB" },
  { id: "EQ-CBK-SF6", name: "SF6 Circuit Breaker", category: "Circuit Breakers", description: "Sulphur hexafluoride gas insulated EHV breaker", defaultVoltage: "110 kV / 220 kV", templateId: "TMPL-CBK-VCB" },
  { id: "EQ-CBK-ACB", name: "Air Circuit Breaker (ACB)", category: "Circuit Breakers", description: "LT draw-out air circuit breaker", defaultVoltage: "415 V", templateId: "TMPL-CBK-VCB" },
  { id: "EQ-CBK-MCCB", name: "Moulded Case Circuit Breaker (MCCB)", category: "Circuit Breakers", description: "Thermal-magnetic / microprocessor feeder breaker", defaultVoltage: "415 V", templateId: "TMPL-CBK-VCB" },
  { id: "EQ-CBK-ELCB", name: "RCCB / Earth Leakage Breaker", category: "Circuit Breakers", description: "Residual current protection device", defaultVoltage: "230/415 V", templateId: "TMPL-CBK-VCB" },

  // ── ISOLATION / SWITCHING ──
  { id: "EQ-ISO-DIS", name: "Isolator / Disconnector", category: "Isolation / Switching", description: "Off-load gang operated double break disconnector", defaultVoltage: "110 kV / 33 kV", templateId: "TMPL-ISO-SW" },
  { id: "EQ-ISO-EAR", name: "Earth Switch", category: "Isolation / Switching", description: "Manual / motorized line and bus earth switch", defaultVoltage: "110 kV", templateId: "TMPL-ISO-SW" },
  { id: "EQ-ISO-LBS", name: "Load Break Switch (LBS)", category: "Isolation / Switching", description: "On-load medium voltage feeder disconnect switch", defaultVoltage: "11 kV", templateId: "TMPL-ISO-SW" },
  { id: "EQ-ISO-CHG", name: "Changeover Switch (Auto/Manual)", category: "Isolation / Switching", description: "Dual-source power transfer switch", defaultVoltage: "415 V", templateId: "TMPL-ISO-SW" },

  // ── PROTECTION EQUIPMENT ──
  { id: "EQ-PRT-NUM", name: "Numerical Protective Relay", category: "Protection", description: "Microprocessor multi-function protective IED", defaultVoltage: "110 V DC Control", templateId: "TMPL-PRT-RLY" },
  { id: "EQ-PRT-OCR", name: "Overcurrent & Earth Fault Relay", category: "Protection", description: "Non-directional / directional IDMT relay", defaultVoltage: "110 V DC Control", templateId: "TMPL-PRT-RLY" },
  { id: "EQ-PRT-DIF", name: "Differential Relay", category: "Protection", description: "Biased transformer / generator differential protection", defaultVoltage: "110 V DC Control", templateId: "TMPL-PRT-RLY" },
  { id: "EQ-PRT-BCH", name: "Buchholz Relay Unit", category: "Protection", description: "Gas and oil surge protective relay for transformers", defaultVoltage: "110 V DC", templateId: "TMPL-PRT-RLY" },
  { id: "EQ-PRT-MTR", name: "Master Trip Relay (86)", category: "Protection", description: "High speed lockout lockout relay", defaultVoltage: "110 V DC", templateId: "TMPL-PRT-RLY" },

  // ── CAPACITOR / POWER FACTOR ──
  { id: "EQ-CAP-BNK", name: "Capacitor Bank", category: "Capacitors", description: "Shunt capacitor bank with series detuning reactors", defaultVoltage: "11 kV / 415 V", templateId: "TMPL-CAP-BNK" },
  { id: "EQ-CAP-APFC", name: "APFC Panel", category: "Capacitors", description: "Automatic Power Factor Correction controller & steps", defaultVoltage: "415 V", templateId: "TMPL-CAP-BNK" },
  { id: "EQ-CAP-FLT", name: "Harmonic Filter", category: "Capacitors", description: "Passive LC tuned filter network", defaultVoltage: "11 kV", templateId: "TMPL-CAP-BNK" },

  // ── BUSBAR / DISTRIBUTION ──
  { id: "EQ-BUS-BAR", name: "Substation Busbar System", category: "Busbar / Distribution", description: "Aluminum/Copper tubular or rectangular busbar", defaultVoltage: "110 kV / 33 kV", templateId: "TMPL-BUS-BAR" },
  { id: "EQ-BUS-CPL", name: "Bus Coupler Section", category: "Busbar / Distribution", description: "Interconnecting bus section breaker and isolator", defaultVoltage: "110 kV", templateId: "TMPL-BUS-BAR" },
  { id: "EQ-BUS-DCT", name: "Bus Duct & Rising Main", category: "Busbar / Distribution", description: "Sandwich type high current insulated bus duct", defaultVoltage: "415 V", templateId: "TMPL-BUS-BAR" },

  // ── CABLES ──
  { id: "EQ-CBL-HT", name: "HT XLPE Power Cable", category: "Cables", description: "Armored cross-linked polyethylene underground cable", defaultVoltage: "11 kV / 33 kV", templateId: "TMPL-CBL-SYS" },
  { id: "EQ-CBL-LT", name: "LT Multi-core Power Cable", category: "Cables", description: "PVC/XLPE insulated aluminum/copper power cable", defaultVoltage: "1.1 kV", templateId: "TMPL-CBL-SYS" },
  { id: "EQ-CBL-TRM", name: "Cable Termination & End Kit", category: "Cables", description: "Heat-shrink / cold-shrink stress control outdoor kit", defaultVoltage: "33 kV", templateId: "TMPL-CBL-SYS" },

  // ── BATTERY / DC SYSTEM ──
  { id: "EQ-BTY-BNK", name: "Substation Battery Bank", category: "Battery / DC", description: "220V / 110V DC station battery storage (VRLA/Lead-Acid)", defaultVoltage: "220 V DC / 110 V DC", templateId: "TMPL-BTY-DC" },
  { id: "EQ-BTY-CHG", name: "Float-cum-Boost Battery Charger", category: "Battery / DC", description: "Dual SCR/Thyristor controlled battery charging system", defaultVoltage: "415 V AC / 220 V DC", templateId: "TMPL-BTY-DC" },
  { id: "EQ-BTY-UPS", name: "Uninterruptible Power Supply (UPS)", category: "Battery / DC", description: "On-line industrial grade true sine-wave UPS", defaultVoltage: "415 V / 230 V", templateId: "TMPL-BTY-DC" },

  // ── EARTHING / LIGHTNING ──
  { id: "EQ-EAR-PIT", name: "Earth Pit & Grounding Grid", category: "Earthing", description: "Substation earth mat, chemical & copper earth electrodes", defaultVoltage: "0 V (Ground)", templateId: "TMPL-EAR-SYS" },
  { id: "EQ-EAR-LGT", name: "Lightning Arrester (LA)", category: "Earthing", description: "Gapless Zinc-Oxide (ZnO) surge arrester stack", defaultVoltage: "110 kV / 33 kV", templateId: "TMPL-EAR-SYS" },
  { id: "EQ-EAR-SPD", name: "Surge Protection Device (SPD)", category: "Earthing", description: "Type 1 / Type 2 transient voltage surge suppressor", defaultVoltage: "415 V", templateId: "TMPL-EAR-SYS" },

  // ── MEASUREMENT / METERING ──
  { id: "EQ-MTR-ENG", name: "High Precision Energy Meter (TOD)", category: "Metering", description: "Class 0.2s ABT tariff grid check meter", defaultVoltage: "110 V / 1 A or 5 A", templateId: "TMPL-MTR-SYS" },
  { id: "EQ-MTR-MFM", name: "Multifunction Meter (MFM)", category: "Metering", description: "Digital panel meter for V, I, kW, kVA, THD & PF", defaultVoltage: "415 V / 110 V", templateId: "TMPL-MTR-SYS" },

  // ── SUBSTATION EQUIPMENT ──
  { id: "EQ-SUB-BAY", name: "Transformer & Feeder Bay", category: "Substation", description: "Complete switchyard bay including gantries and CTs", defaultVoltage: "110 kV", templateId: "TMPL-SUB-BAY" },
  { id: "EQ-SUB-CRP", name: "Control & Relay Panel (C&R Panel)", category: "Substation", description: "Duplex/Simplex control board with annunciator & mimc", defaultVoltage: "110 V DC", templateId: "TMPL-SUB-BAY" },

  // ── RENEWABLE / MODERN ──
  { id: "EQ-REN-INV", name: "Solar Grid-Tie Central Inverter", category: "Renewable", description: "Utility scale 3-phase string / central solar inverter", defaultVoltage: "1000 V DC / 400 V AC", templateId: "TMPL-REN-SOL" },
  { id: "EQ-REN-BESS", name: "Battery Energy Storage System (BESS)", category: "Renewable", description: "Lithium-ion energy storage rack with PCS", defaultVoltage: "800 V DC", templateId: "TMPL-REN-SOL" },
  { id: "EQ-REN-EVC", name: "Commercial EV Fast Charger", category: "Renewable", description: "CCS-2 dual gun DC fast charging station (60/120 kW)", defaultVoltage: "415 V AC / 800 V DC", templateId: "TMPL-REN-SOL" },

  // ── SAFETY EQUIPMENT ──
  { id: "EQ-SAF-LOTO", name: "LOTO Safety Interlock Panel", category: "Safety", description: "Lockout-Tagout master station & Castell key interlock", defaultVoltage: "Mechanical / Control", templateId: "TMPL-SAF-PAN" },
  { id: "EQ-SAF-FIR", name: "Fire Detection & Alarm Panel", category: "Safety", description: "Microprocessor addressable fire alarm control system", defaultVoltage: "24 V DC", templateId: "TMPL-SAF-PAN" },
];

// ─────────────────────────────────────────────────────────────
// 2. DEFAULT GOVERNMENT SITES & FACILITIES
// ─────────────────────────────────────────────────────────────

export const GOVERNMENT_FACILITIES: GovernmentFacility[] = [
  {
    id: "FAC-TN-CBE-01",
    name: "230/110 kV Substation Peelamedu",
    department: "Tamil Nadu Electricity Board (TNEB / TANTRANSCO)",
    region: "Western Region",
    division: "Coimbatore Metro Division",
    subDivision: "Peelamedu Sub-Division",
    section: "Substation Section 1",
    facilityType: "Substation",
    address: "Avinashi Road, Peelamedu, Coimbatore - 641004",
  },
  {
    id: "FAC-TN-CHE-02",
    name: "110/33 kV Substation Guindy Industrial Estate",
    department: "Tamil Nadu Electricity Board (TNEB / TANGEDCO)",
    region: "Chennai South Region",
    division: "Guindy Division",
    subDivision: "Industrial Estate Sub-Division",
    section: "Feeder Control Room A",
    facilityType: "Substation",
    address: "Inner Ring Road, Guindy, Chennai - 600032",
  },
  {
    id: "FAC-TN-MDU-03",
    name: "Madurai Thermal Power Station Unit 2",
    department: "State Power Generation Corporation (GENCO)",
    region: "Southern Region",
    division: "Madurai Generation Circle",
    subDivision: "Thermal Auxiliaries Sub-Division",
    section: "Boiler & Turbine Deck",
    facilityType: "Power Plant",
    address: "Samayanallur Power Complex, Madurai - 625402",
  },
  {
    id: "FAC-TN-SLM-04",
    name: "Cheyyar 50 MW Solar PV Power Park",
    department: "Renewable Energy Development Agency (TNERDA)",
    region: "North Western Region",
    division: "Tiruvannamalai Solar Circle",
    subDivision: "Solar Farm Sub-Division",
    section: "Inverter Station 04",
    facilityType: "Solar Yard",
    address: "SIPCOT Industrial Complex, Cheyyar - 604407",
  },
  {
    id: "FAC-TN-ENR-05",
    name: "Ennore Seawater Intake Pump Station 4",
    department: "Public Works & Water Supply Board (TWAD)",
    region: "Chennai North Region",
    division: "Coastal Pumping Division",
    subDivision: "Ennore Bay Sub-Division",
    section: "Heavy Motor House B",
    facilityType: "Pump Station",
    address: "Ennore Port Road, Chennai - 600057",
  },
];

// ─────────────────────────────────────────────────────────────
// 3. EQUIPMENT ASSETS INVENTORY (Offline Cache Seed Data)
// ─────────────────────────────────────────────────────────────

export const SEED_EQUIPMENT_ASSETS: EquipmentAsset[] = [
  {
    id: "AST-TRF-102",
    assetCode: "TRF-102",
    name: "Power Transformer T-102 (100 MVA)",
    equipmentTypeId: "EQ-TRF-PWR",
    category: "Transformers",
    facilityId: "FAC-TN-CBE-01",
    locationName: "Yard Bay 1 · 230 kV Yard",
    manufacturer: "ABB India Ltd",
    model: "TrafoStar EHV-100",
    serialNumber: "ABB-2018-TN-9812",
    capacity: "100 MVA",
    voltageRating: "230 / 110 / 33 kV",
    currentRating: "251 / 525 / 1750 A",
    installationDate: "2018-04-12",
    lastInspectionDate: "2026-09-15",
    lastInspectionResult: "WARNING",
    healthStatus: "ATTENTION",
    openFindingsCount: 2,
    qrCode: "TRF-102",
  },
  {
    id: "AST-TRF-117",
    assetCode: "TRF-117",
    name: "Power Transformer T-117 (50 MVA)",
    equipmentTypeId: "EQ-TRF-PWR",
    category: "Transformers",
    facilityId: "FAC-TN-CHE-02",
    locationName: "Transformer Bay 2 · Guindy Substation",
    manufacturer: "Siemens Energy",
    model: "GEAFOL-50M",
    serialNumber: "SIE-2020-GND-4410",
    capacity: "50 MVA",
    voltageRating: "110 / 33 kV",
    currentRating: "262 / 875 A",
    installationDate: "2020-08-20",
    lastInspectionDate: "2026-08-28",
    lastInspectionResult: "PASS WITH OBSERVATIONS",
    healthStatus: "HEALTHY",
    openFindingsCount: 0,
    qrCode: "TRF-117",
  },
  {
    id: "AST-TRF-203",
    assetCode: "TRF-203",
    name: "Station Service Transformer SST-203",
    equipmentTypeId: "EQ-TRF-DIS",
    category: "Transformers",
    facilityId: "FAC-TN-CBE-01",
    locationName: "Auxiliary Building · Peelamedu",
    manufacturer: "Schneider Electric",
    model: "Trihal Cast Resin 2000",
    serialNumber: "SCH-2022-TN-0914",
    capacity: "2000 kVA",
    voltageRating: "33 / 0.415 kV",
    currentRating: "35 / 2782 A",
    installationDate: "2022-01-15",
    lastInspectionDate: "2026-07-10",
    lastInspectionResult: "PASS",
    healthStatus: "HEALTHY",
    openFindingsCount: 0,
    qrCode: "TRF-203",
  },
  {
    id: "AST-GEN-405",
    assetCode: "GEN-405",
    name: "Emergency Diesel Generator DG-405",
    equipmentTypeId: "EQ-GEN-DG",
    category: "Generators",
    facilityId: "FAC-TN-MDU-03",
    locationName: "Auxiliary DG House · Madurai TPS",
    manufacturer: "Cummins Power Generation",
    model: "QSK60-G4 (1500 kVA)",
    serialNumber: "CUM-2019-MDU-7721",
    capacity: "1500 kVA",
    voltageRating: "415 V 3-Phase",
    currentRating: "2086 A",
    installationDate: "2019-11-04",
    lastInspectionDate: "2026-09-02",
    lastInspectionResult: "WARNING",
    healthStatus: "INSPECTION_DUE",
    openFindingsCount: 1,
    qrCode: "GEN-405",
  },
  {
    id: "AST-PMP-301",
    assetCode: "PMP-301",
    name: "Heavy Intake Pump Motor MTR-301",
    equipmentTypeId: "EQ-MTR-IND",
    category: "Motors",
    facilityId: "FAC-TN-ENR-05",
    locationName: "Intake Well 2 · Ennore Bay",
    manufacturer: "Bharat Heavy Electricals (BHEL)",
    model: "High-Voltage IM 450 kW",
    serialNumber: "BHEL-2021-ENR-1002",
    capacity: "450 kW (600 HP)",
    voltageRating: "6.6 kV 3-Phase",
    currentRating: "48 A",
    installationDate: "2021-03-18",
    lastInspectionDate: "2026-09-14",
    lastInspectionResult: "PASS",
    healthStatus: "HEALTHY",
    openFindingsCount: 0,
    qrCode: "PMP-301",
  },
  {
    id: "AST-CBK-201",
    assetCode: "CBK-201",
    name: "11 kV Vacuum Circuit Breaker VCB-201",
    equipmentTypeId: "EQ-CBK-VCB",
    category: "Circuit Breakers",
    facilityId: "FAC-TN-CHE-02",
    locationName: "Indoor HT Switchgear Room · Panel 4",
    manufacturer: "Larsen & Toubro (L&T)",
    model: "V-Max Medium Voltage 1250A",
    serialNumber: "LNT-2021-GND-3382",
    capacity: "25 kA Short-Circuit Rating",
    voltageRating: "11 kV",
    currentRating: "1250 A",
    installationDate: "2021-06-11",
    lastInspectionDate: "2026-08-19",
    lastInspectionResult: "PASS",
    healthStatus: "HEALTHY",
    openFindingsCount: 0,
    qrCode: "CBK-201",
  },
  {
    id: "AST-SWG-501",
    assetCode: "SWG-501",
    name: "110 kV SF6 Gas Insulated Switchgear GIS-501",
    equipmentTypeId: "EQ-SWG-HT",
    category: "Switchgear",
    facilityId: "FAC-TN-CBE-01",
    locationName: "GIS Hall Building · Peelamedu",
    manufacturer: "Toshiba Transmission & Distribution",
    model: "GIS-EHV 145 kV",
    serialNumber: "TSH-2022-CBE-9001",
    capacity: "31.5 kA Breaking Capacity",
    voltageRating: "110 kV",
    currentRating: "2000 A",
    installationDate: "2022-09-30",
    lastInspectionDate: "2026-09-08",
    lastInspectionResult: "PASS",
    healthStatus: "HEALTHY",
    openFindingsCount: 0,
    qrCode: "SWG-501",
  },
  {
    id: "AST-BTY-202",
    assetCode: "BTY-202",
    name: "220V DC Substation Battery Bank BTY-202",
    equipmentTypeId: "EQ-BTY-BNK",
    category: "Battery / DC",
    facilityId: "FAC-TN-CBE-01",
    locationName: "DC Battery Room 1 · Peelamedu",
    manufacturer: "Exide Industries Ltd",
    model: "Tubular Plante 220V-400Ah",
    serialNumber: "EXD-2020-CBE-1108",
    capacity: "400 Ah (110 Cells in series)",
    voltageRating: "220 V DC Float",
    currentRating: "40 A continuous",
    installationDate: "2020-02-14",
    lastInspectionDate: "2026-09-10",
    lastInspectionResult: "PASS",
    healthStatus: "HEALTHY",
    openFindingsCount: 0,
    qrCode: "BTY-202",
  },
  {
    id: "AST-SLR-101",
    assetCode: "SLR-101",
    name: "500 kW Central Solar Inverter INV-101",
    equipmentTypeId: "EQ-REN-INV",
    category: "Renewable",
    facilityId: "FAC-TN-SLM-04",
    locationName: "Inverter Room 1 · Array Block A",
    manufacturer: "SMA Solar Technology",
    model: "Sunny Central 500-CP",
    serialNumber: "SMA-2023-SLM-6002",
    capacity: "500 kW AC Output",
    voltageRating: "1000 V DC / 400 V AC",
    currentRating: "722 A AC",
    installationDate: "2023-05-18",
    lastInspectionDate: "2026-09-01",
    lastInspectionResult: "PASS",
    healthStatus: "HEALTHY",
    openFindingsCount: 0,
    qrCode: "SLR-101",
  },
];

// ─────────────────────────────────────────────────────────────
// 4. RICH EQUIPMENT-SPECIFIC INSPECTION TEMPLATES
// ─────────────────────────────────────────────────────────────

export const EQUIPMENT_INSPECTION_TEMPLATES: Record<string, EquipmentInspectionTemplate> = {
  // ── 1. POWER TRANSFORMER TEMPLATE ──
  "TMPL-TRF-PWR": {
    id: "TMPL-TRF-PWR",
    equipmentTypeId: "EQ-TRF-PWR",
    category: "Transformers",
    name: "EHV / Power Transformer Comprehensive Inspection",
    version: "2026.1-GOV",
    sections: [
      {
        id: "SEC-GEN",
        title: "1. General Physical Condition & Nameplate",
        order: 1,
        items: [
          { id: "TRF-01", label: "Cleanliness & Paint Condition", type: "NORMAL_ABNORMAL", required: true, helperText: "Check for rust, paint blisters or physical damage" },
          { id: "TRF-02", label: "Physical Oil Leakage Inspection", type: "PASS_FAIL", required: true, helperText: "Inspect radiator fins, main tank gaskets, sampling valves & drain plugs", evidenceRequiredOnFail: true },
          { id: "TRF-03", label: "Foundation & Anti-Vibration Pads", type: "NORMAL_ABNORMAL", required: true, helperText: "Inspect plinth foundation for oil spills or settling cracks" },
        ]
      },
      {
        id: "SEC-OIL",
        title: "2. Oil System & Temperature Measurements",
        order: 2,
        items: [
          {
            id: "TRF-04",
            label: "Top Oil Temperature Indicator (OTI)",
            type: "TEMPERATURE",
            unit: "°C",
            required: true,
            threshold: { unit: "°C", normalMax: 75, warningMax: 85, criticalMin: 85.1 },
            helperText: "Normal operating threshold: < 75 °C. Warning threshold: 75–85 °C"
          },
          {
            id: "TRF-05",
            label: "Winding Temperature Indicator (WTI)",
            type: "TEMPERATURE",
            unit: "°C",
            required: true,
            threshold: { unit: "°C", normalMax: 80, warningMax: 95, criticalMin: 95.1 },
            helperText: "Normal operating threshold: < 80 °C. Critical threshold: > 95 °C"
          },
          {
            id: "TRF-06",
            label: "Magnetic Oil Level Gauge (MOG)",
            type: "PERCENTAGE",
            unit: "%",
            required: true,
            threshold: { unit: "%", normalMin: 35, normalMax: 85, warningMin: 25, warningMax: 90, criticalMin: 20 },
            helperText: "Conservator oil level gauge: Nominal 40%–80% at 30°C"
          },
          {
            id: "TRF-07",
            label: "Oil Dielectric Breakdown Voltage (BDV)",
            type: "BDV",
            unit: "kV",
            required: true,
            threshold: { unit: "kV", normalMin: 50, warningMin: 40, criticalMax: 39.9 },
            helperText: "IS 1866 minimum BDV limit: > 50 kV for EHV transformers"
          },
        ]
      },
      {
        id: "SEC-BSH",
        title: "3. Bushings & Surge Arresters",
        order: 3,
        items: [
          { id: "TRF-08", label: "HV & LV Bushing Porcelain Condition", type: "NORMAL_ABNORMAL", required: true, helperText: "Check for chips, hairline cracks or flashover tracking marks", evidenceRequiredOnFail: true },
          { id: "TRF-09", label: "Bushing Oil Level & Oil Sight Glass", type: "NORMAL_ABNORMAL", required: true, helperText: "Check RIP / OIP bushing oil level" },
          {
            id: "TRF-10",
            label: "Surge Arrester 3rd Harmonic Leakage Current",
            type: "NUMERIC",
            unit: "µA",
            threshold: { unit: "µA", normalMax: 350, warningMax: 500, criticalMin: 501 },
            helperText: "Third harmonic resistive leakage current"
          },
        ]
      },
      {
        id: "SEC-PROT",
        title: "4. Protection & Auxiliary Devices",
        order: 4,
        items: [
          { id: "TRF-11", label: "Silica Gel Breather Color", type: "DROPDOWN", options: ["Deep Blue (Dry / OK)", "Pink / White (Saturated - Replace)", "Contaminated Oil in Cup"], required: true, helperText: "Moisture absorbent check in breathing cup" },
          { id: "TRF-12", label: "Buchholz Relay Gas Accumulation Test", type: "PASS_FAIL", required: true, helperText: "Verify petcock valve for presence of flammable or combustible gases" },
          { id: "TRF-13", label: "Pressure Relief Valve (PRV) Status", type: "NORMAL_ABNORMAL", required: true, helperText: "Inspect visual trip flag and microswitch" },
          { id: "TRF-14", label: "Cooling Fan & Oil Pump Auto-Start", type: "PASS_FAIL", required: true, helperText: "Verify automatic OFAF cooler start at OTI set-point" },
          { id: "TRF-15", label: "On-Load Tap Changer (OLTC) Counter & Step", type: "NUMERIC", required: true, helperText: "Record current tap position & operations counter" },
        ]
      },
      {
        id: "SEC-EARTH",
        title: "5. Earthing & Electrical Connections",
        order: 5,
        items: [
          {
            id: "TRF-16",
            label: "Neutral Earth Resistance Value",
            type: "RESISTANCE",
            unit: "Ω",
            required: true,
            threshold: { unit: "Ω", normalMax: 1.0, warningMax: 2.0, criticalMin: 2.1 },
            helperText: "Substation neutral grid earthing resistance: Max allowable 1.0 Ω"
          },
          {
            id: "TRF-17",
            label: "Body Tank Ground Continuity (2 Distinct Paths)",
            type: "YES_NO",
            required: true,
            helperText: "Verify dual distinct earth flat connections to substation ground mat"
          },
        ]
      }
    ],
    safetyChecks: [
      { id: "SAF-01", label: "Personal Protective Equipment (PPE) Verified (Helmet, Arc Flash Face Shield, HV Insulated Gloves)", required: true, standardRef: "CEA Safety Reg. 2010" },
      { id: "SAF-02", label: "Line & Bus Isolators in OPEN & Locked Position with Earth Switch Closed", required: true, standardRef: "LOTO Protocol Level 4" },
      { id: "SAF-03", label: "Permit to Work (PTW) Signed by Authorized Station In-Charge", required: true, standardRef: "PTW-EHV-2026" },
      { id: "SAF-04", label: "Zero Energy & Voltage Absence Verified using Calibrated High Voltage Detector", required: true, standardRef: "IS 2071" },
      { id: "SAF-05", label: "Portable Discharge Earth Rods Fixed to All 3 HV & LV Phases", required: true, standardRef: "Grid Safety Code" },
    ]
  },

  // ── 2. DISTRIBUTION TRANSFORMER TEMPLATE ──
  "TMPL-TRF-DIS": {
    id: "TMPL-TRF-DIS",
    equipmentTypeId: "EQ-TRF-DIS",
    category: "Transformers",
    name: "Distribution Transformer Periodic Inspection",
    version: "2026.1-GOV",
    sections: [
      {
        id: "SEC-DIS-1",
        title: "1. Visual & Physical Inspection",
        order: 1,
        items: [
          { id: "DIS-01", label: "Oil Level in Conservator", type: "NORMAL_ABNORMAL", required: true, helperText: "Sight glass level verified" },
          { id: "DIS-02", label: "Tank & Radiator Oil Leakage", type: "PASS_FAIL", required: true, helperText: "No leakage at valve or welded seams", evidenceRequiredOnFail: true },
          { id: "DIS-03", label: "Silica Gel Breather Status", type: "DROPDOWN", options: ["Blue (Active)", "Pink (Moisture Saturated)", "Damaged Cup"], required: true },
          { id: "DIS-04", label: "Bushing Condition & Cleanliness", type: "NORMAL_ABNORMAL", required: true },
        ]
      },
      {
        id: "SEC-DIS-2",
        title: "2. Electrical Parameters & Earthing",
        order: 2,
        items: [
          { id: "DIS-05", label: "Oil Temperature Reading", type: "TEMPERATURE", unit: "°C", threshold: { unit: "°C", normalMax: 70, warningMax: 80, criticalMin: 80.1 }, required: true },
          { id: "DIS-06", label: "Earth Resistance (Neutral Pit)", type: "RESISTANCE", unit: "Ω", threshold: { unit: "Ω", normalMax: 2.0, warningMax: 5.0, criticalMin: 5.1 }, required: true },
          { id: "DIS-07", label: "DO Fuse Element Condition", type: "PASS_FAIL", required: true, helperText: "Drop out fuse intact" },
          { id: "DIS-08", label: "LT Cable Lugs & Thermal Hotspots", type: "NORMAL_ABNORMAL", required: true },
        ]
      }
    ],
    safetyChecks: [
      { id: "SAF-D1", label: "PPE Gear Verified (Helmet, Safety Boots, HV Gloves)", required: true },
      { id: "SAF-D2", label: "11 kV Drop-Out Fuses Opened & Clear Working Clearance Maintained", required: true },
      { id: "SAF-D3", label: "LT Main Switch / Circuit Breaker Switched OFF & Locked Out", required: true },
      { id: "SAF-D4", label: "Earth Ground Discharge Rods Connected Prior to Physical Touch", required: true },
    ]
  },

  // ── 3. DIESEL GENERATOR (DG) TEMPLATE ──
  "TMPL-GEN-DG": {
    id: "TMPL-GEN-DG",
    equipmentTypeId: "EQ-GEN-DG",
    category: "Generators",
    name: "Diesel Generator (DG) & Emergency Power Set Inspection",
    version: "2026.1-GOV",
    sections: [
      {
        id: "SEC-ENG",
        title: "1. Engine Systems & Fluid Levels",
        order: 1,
        items: [
          { id: "GEN-01", label: "Lube Oil Dipstick Level & Quality", type: "NORMAL_ABNORMAL", required: true, helperText: "Between Min & Max mark with no fuel dilution" },
          { id: "GEN-02", label: "Radiator Coolant Level & Radiator Fin Condition", type: "NORMAL_ABNORMAL", required: true },
          { id: "GEN-03", label: "Day Tank Fuel Level", type: "PERCENTAGE", unit: "%", threshold: { unit: "%", normalMin: 50, warningMin: 30, criticalMax: 29.9 }, required: true, helperText: "Minimum 50% fuel required for emergency standby" },
          { id: "GEN-04", label: "Fuel & Oil Line Leakage", type: "PASS_FAIL", required: true, evidenceRequiredOnFail: true },
        ]
      },
      {
        id: "SEC-ELEC",
        title: "2. Electrical Output & Running Telemetry",
        order: 2,
        items: [
          {
            id: "GEN-05",
            label: "Generated Line-to-Line Voltage",
            type: "VOLTAGE",
            unit: "V AC",
            required: true,
            threshold: { unit: "V AC", normalMin: 400, normalMax: 430, warningMin: 380, warningMax: 440, criticalMin: 379 },
            helperText: "Nominal 415 V ± 3%"
          },
          {
            id: "GEN-06",
            label: "Generated Grid Frequency",
            type: "NUMERIC",
            unit: "Hz",
            required: true,
            threshold: { unit: "Hz", normalMin: 49.5, normalMax: 50.5, warningMin: 48.5, warningMax: 51.5, criticalMin: 48.0 },
            helperText: "Target 50.0 Hz (1500 RPM for 4-pole alternator)"
          },
          {
            id: "GEN-07",
            label: "Lube Oil Pressure Under Load",
            type: "PRESSURE",
            unit: "bar",
            required: true,
            threshold: { unit: "bar", normalMin: 3.5, normalMax: 6.0, warningMin: 2.5, criticalMax: 2.4 },
            helperText: "Low oil pressure trip set-point: 2.0 bar"
          },
          {
            id: "GEN-08",
            label: "Coolant Engine Temperature Under Load",
            type: "TEMPERATURE",
            unit: "°C",
            required: true,
            threshold: { unit: "°C", normalMax: 88, warningMax: 96, criticalMin: 96.1 },
            helperText: "Normal operating: 80–88 °C"
          },
        ]
      },
      {
        id: "SEC-BAT",
        title: "3. Starter Battery & Auto-Transfer Switch",
        order: 3,
        items: [
          {
            id: "GEN-09",
            label: "Starter Battery Float Voltage",
            type: "VOLTAGE",
            unit: "V DC",
            required: true,
            threshold: { unit: "V DC", normalMin: 24.5, normalMax: 27.5, warningMin: 23.0, criticalMax: 22.9 },
            helperText: "24V DC starting battery bank"
          },
          { id: "GEN-10", label: "Automatic Transfer Switch (AMF / ATS) Operation", type: "PASS_FAIL", required: true, helperText: "Automatic changeover relay response on mains fail simulation" },
          { id: "GEN-11", label: "Emergency Stop Button Functionality", type: "PASS_FAIL", required: true },
        ]
      }
    ],
    safetyChecks: [
      { id: "SAF-G1", label: "Exhaust Gas Ventilation System Checked & Clear of Flammables", required: true },
      { id: "SAF-G2", label: "Moving Parts Guards (Flywheel, Fan, Belts) Securely in Place", required: true },
      { id: "SAF-G3", label: "Automatic Fire Extinguisher (CO2 / FM200) System Armed & Pin Checked", required: true },
      { id: "SAF-G4", label: "Generator Body & Neutral Earth Connections Verified Sound", required: true },
    ]
  },

  // ── 4. VACUUM / SF6 CIRCUIT BREAKER TEMPLATE ──
  "TMPL-CBK-VCB": {
    id: "TMPL-CBK-VCB",
    equipmentTypeId: "EQ-CBK-VCB",
    category: "Circuit Breakers",
    name: "HT / Medium Voltage Circuit Breaker Inspection",
    version: "2026.1-GOV",
    sections: [
      {
        id: "SEC-CB-1",
        title: "1. Mechanical Mechanism & Interlocks",
        order: 1,
        items: [
          { id: "CB-01", label: "Spring Charge Mechanism Motor & Manual Handle", type: "PASS_FAIL", required: true, helperText: "Verify auto-charge upon breaker closing" },
          { id: "CB-02", label: "Mechanical Open/Close Indicator Accuracy", type: "NORMAL_ABNORMAL", required: true },
          { id: "CB-03", label: "Racking-in / Racking-out Interlock Smoothness", type: "PASS_FAIL", required: true, helperText: "Check test/service position shutter safety locks" },
          { id: "CB-04", label: "Operations Counter Reading", type: "NUMERIC", required: true, helperText: "Record total mechanical trip operations" },
        ]
      },
      {
        id: "SEC-CB-2",
        title: "2. Electrical Contacts & Vacuum/Gas Integrity",
        order: 2,
        items: [
          {
            id: "CB-05",
            label: "Main Contact Resistance (Ductor Test)",
            type: "NUMERIC",
            unit: "µΩ",
            required: true,
            threshold: { unit: "µΩ", normalMax: 35, warningMax: 50, criticalMin: 50.1 },
            helperText: "Micro-ohm contact resistance: Maximum acceptable 40 µΩ"
          },
          {
            id: "CB-06",
            label: "Insulation Resistance (Pole-to-Ground at 2.5 kV)",
            type: "INSULATION_RESISTANCE",
            unit: "MΩ",
            required: true,
            threshold: { unit: "MΩ", normalMin: 1000, warningMin: 500, criticalMax: 499 },
            helperText: "Megger insulation resistance > 1000 MΩ"
          },
          { id: "CB-07", label: "Shunt Trip Coil & Closing Coil Resistance", type: "NORMAL_ABNORMAL", required: true, helperText: "Verify 110V DC coil health and continuity" },
          { id: "CB-08", label: "Auxiliary Contact Block (NO/NC) Cleanliness", type: "NORMAL_ABNORMAL", required: true },
        ]
      }
    ],
    safetyChecks: [
      { id: "SAF-C1", label: "Breaker Racked Out to ISOLATED / TEST Position with Padlock Applied", required: true },
      { id: "SAF-C2", label: "Trip Springs DISCHARGED prior to mechanical maintenance", required: true },
      { id: "SAF-C3", label: "Control Fuse & DC Aux Supply Isolated", required: true },
      { id: "SAF-C4", label: "Busbar and Cable Side Safety Shutters Verified Padlocked", required: true },
    ]
  },

  // ── 5. HEAVY INDUSTRIAL INDUCTION MOTOR TEMPLATE ──
  "TMPL-MTR-IND": {
    id: "TMPL-MTR-IND",
    equipmentTypeId: "EQ-MTR-IND",
    category: "Motors",
    name: "Heavy Duty 3-Phase Induction Motor Inspection",
    version: "2026.1-GOV",
    sections: [
      {
        id: "SEC-MTR-1",
        title: "1. Vibration & Bearing Health",
        order: 1,
        items: [
          {
            id: "MTR-01",
            label: "Drive End (DE) Bearing Vibration Velocity",
            type: "VIBRATION",
            unit: "mm/s",
            required: true,
            threshold: { unit: "mm/s", normalMax: 2.8, warningMax: 4.5, criticalMin: 4.51 },
            helperText: "ISO 10816 Class II zone limit: Normal < 2.8 mm/s, Alarm > 4.5 mm/s"
          },
          {
            id: "MTR-02",
            label: "Drive End (DE) Bearing Temperature",
            type: "TEMPERATURE",
            unit: "°C",
            required: true,
            threshold: { unit: "°C", normalMax: 70, warningMax: 85, criticalMin: 85.1 },
            helperText: "Max allowable grease-lubricated bearing temp: 85 °C"
          },
          {
            id: "MTR-03",
            label: "Non-Drive End (NDE) Bearing Temperature",
            type: "TEMPERATURE",
            unit: "°C",
            required: true,
            threshold: { unit: "°C", normalMax: 68, warningMax: 80, criticalMin: 80.1 }
          },
        ]
      },
      {
        id: "SEC-MTR-2",
        title: "2. Electrical Parameters & Stator Insulation",
        order: 2,
        items: [
          {
            id: "MTR-04",
            label: "Stator Winding Insulation Resistance (Phase to Earth)",
            type: "INSULATION_RESISTANCE",
            unit: "MΩ",
            required: true,
            threshold: { unit: "MΩ", normalMin: 100, warningMin: 20, criticalMax: 19.9 },
            helperText: "IEEE 43 minimum limit: (Rated kV + 1) MΩ"
          },
          { id: "MTR-05", label: "Full Load Operating Current Phase Balance (R-Y-B)", type: "PASS_FAIL", required: true, helperText: "Current unbalance must not exceed 5%" },
          { id: "MTR-06", label: "Terminal Box Cable Termination & Sealing", type: "NORMAL_ABNORMAL", required: true },
          { id: "MTR-07", label: "Cooling Fan Cowling & Ventilation Blockage", type: "NORMAL_ABNORMAL", required: true },
        ]
      }
    ],
    safetyChecks: [
      { id: "SAF-M1", label: "Local Isolator & Emergency Stop Locked in OFF Position (LOTO Applied)", required: true },
      { id: "SAF-M2", label: "Motor Control Panel (MCC) Breaker Racked Out with Danger Tag", required: true },
      { id: "SAF-M3", label: "Driven Pump / Fan Mechanical Lock Applied (Impeller Blocked)", required: true },
    ]
  },

  // ── 6. SUBSTATION BATTERY BANK & DC SYSTEM TEMPLATE ──
  "TMPL-BTY-DC": {
    id: "TMPL-BTY-DC",
    equipmentTypeId: "EQ-BTY-BNK",
    category: "Battery / DC",
    name: "Substation Battery Bank & DC Power System Inspection",
    version: "2026.1-GOV",
    sections: [
      {
        id: "SEC-BTY-1",
        title: "1. Bank Voltage & Pilot Cell Measurements",
        order: 1,
        items: [
          {
            id: "BTY-01",
            label: "Total Bank Float Voltage",
            type: "VOLTAGE",
            unit: "V DC",
            required: true,
            threshold: { unit: "V DC", normalMin: 235, normalMax: 248, warningMin: 220, criticalMax: 219 },
            helperText: "220V nominal bank: Float at 2.20–2.25V per cell (approx 242V DC)"
          },
          {
            id: "BTY-02",
            label: "Individual Pilot Cell Voltage (Lowest Cell Reading)",
            type: "VOLTAGE",
            unit: "V DC",
            required: true,
            threshold: { unit: "V DC", normalMin: 2.15, normalMax: 2.30, warningMin: 2.05, criticalMax: 2.04 },
            helperText: "No individual cell should fall below 2.05 V in float mode"
          },
          {
            id: "BTY-03",
            label: "Electrolyte Level & Specific Gravity (Plante / Lead Acid)",
            type: "NUMERIC",
            unit: "Sp.Gr",
            threshold: { unit: "Sp.Gr", normalMin: 1.190, normalMax: 1.220, warningMin: 1.170, criticalMax: 1.169 },
            helperText: "Corrected specific gravity at 27 °C"
          },
          { id: "BTY-04", label: "Terminal Post Sulphation & Corrosion Check", type: "NORMAL_ABNORMAL", required: true, evidenceRequiredOnFail: true },
        ]
      },
      {
        id: "SEC-BTY-2",
        title: "2. Battery Charger & Earth Fault Monitoring",
        order: 2,
        items: [
          { id: "BTY-05", label: "DC Positive / Negative Earth Fault Leakage", type: "PASS_FAIL", required: true, helperText: "DC insulation resistance > 1 MΩ" },
          { id: "BTY-06", label: "Charger AC Ripple Voltage Level", type: "PERCENTAGE", unit: "%", threshold: { unit: "%", normalMax: 2.0, warningMax: 4.0, criticalMin: 4.1 }, required: true },
          { id: "BTY-07", label: "Battery Room Exhaust Fan & Ventilation", type: "PASS_FAIL", required: true, helperText: "Hydrogen gas exhaust fan functioning" },
        ]
      }
    ],
    safetyChecks: [
      { id: "SAF-B1", label: "Acid / Chemical Resistant Apron, Face Shield & Rubber Gloves Worn", required: true },
      { id: "SAF-B2", label: "Strict No Smoking / No Sparking Tools Policy Enforced in Battery Room", required: true },
      { id: "SAF-B3", label: "Emergency Eye-Wash Station Verified Functional with Fresh Water", required: true },
    ]
  },

  // ── 7. SOLAR INVERTER & RENEWABLES TEMPLATE ──
  "TMPL-REN-SOL": {
    id: "TMPL-REN-SOL",
    equipmentTypeId: "EQ-REN-INV",
    category: "Renewable",
    name: "Solar String / Central Inverter Inspection",
    version: "2026.1-GOV",
    sections: [
      {
        id: "SEC-SOL-1",
        title: "1. DC Input & AC Output Telemetry",
        order: 1,
        items: [
          { id: "SOL-01", label: "DC Input Array Voltage (MPPT)", type: "VOLTAGE", unit: "V DC", threshold: { unit: "V DC", normalMin: 600, normalMax: 950, warningMin: 500, criticalMax: 499 }, required: true },
          { id: "SOL-02", label: "AC Output Power Conversion Efficiency", type: "PERCENTAGE", unit: "%", threshold: { unit: "%", normalMin: 96, warningMin: 92, criticalMax: 91.9 }, required: true },
          { id: "SOL-03", label: "Internal IGBT Heatsink Temperature", type: "TEMPERATURE", unit: "°C", threshold: { unit: "°C", normalMax: 65, warningMax: 80, criticalMin: 80.1 }, required: true },
          { id: "SOL-04", label: "Anti-Islanding Protection Trip Test", type: "PASS_FAIL", required: true, helperText: "Inverter must trip within 2 seconds upon grid loss" },
        ]
      },
      {
        id: "SEC-SOL-2",
        title: "2. Surge Protection & Enclosure Filters",
        order: 2,
        items: [
          { id: "SOL-05", label: "DC Surge Protection Device (SPD) Status Indicator", type: "DROPDOWN", options: ["Green / Healthy", "Red / Blown (Replace SPD)", "Fault Triggered"], required: true },
          { id: "SOL-06", label: "Air Intake Dust Filters & Cooling Fans", type: "NORMAL_ABNORMAL", required: true },
          { id: "SOL-07", label: "Earth Fault Detector (GFDI)", type: "PASS_FAIL", required: true },
        ]
      }
    ],
    safetyChecks: [
      { id: "SAF-S1", label: "DC Disconnect Switch Opened and Verified LOTO Applied", required: true },
      { id: "SAF-S2", label: "DC Capacitor Discharge Time (Minimum 5 Minutes) Observed Prior to Opening", required: true },
      { id: "SAF-S3", label: "AC Grid Breaker Locked Out in Distribution Panel", required: true },
    ]
  },

  // ── 8. SUBSTATION EARTHING & GROUNDING GRID TEMPLATE ──
  "TMPL-EAR-SYS": {
    id: "TMPL-EAR-SYS",
    equipmentTypeId: "EQ-EAR-PIT",
    category: "Earthing",
    name: "Substation Earthing Grid & Earth Pit Inspection",
    version: "2026.1-GOV",
    sections: [
      {
        id: "SEC-EAR-1",
        title: "1. Earth Pit Resistance Measurements",
        order: 1,
        items: [
          {
            id: "EAR-01",
            label: "Individual Earth Pit Resistance (Fall of Potential Method)",
            type: "RESISTANCE",
            unit: "Ω",
            required: true,
            threshold: { unit: "Ω", normalMax: 1.0, warningMax: 2.5, criticalMin: 2.51 },
            helperText: "Central Electricity Authority (CEA) standard: Substation Earth Pit < 1.0 Ω"
          },
          {
            id: "EAR-02",
            label: "Earth Grid Mesh Combined Resistance",
            type: "RESISTANCE",
            unit: "Ω",
            required: true,
            threshold: { unit: "Ω", normalMax: 0.5, warningMax: 1.0, criticalMin: 1.01 },
            helperText: "Substation main grounding grid combined resistance < 0.5 Ω"
          },
          { id: "EAR-03", label: "Earth Chamber Cover & Identification Tag", type: "NORMAL_ABNORMAL", required: true },
          { id: "EAR-04", label: "Chemical Compound / Bentonite Moisture Level", type: "NORMAL_ABNORMAL", required: true, helperText: "Check for dry soil around electrode" },
          { id: "EAR-05", label: "Copper/GI Earth Strip Mechanical Clamping & Corrosion", type: "PASS_FAIL", required: true, evidenceRequiredOnFail: true },
        ]
      }
    ],
    safetyChecks: [
      { id: "SAF-E1", label: "Step & Touch Potential Safety Shoes (Electrically Rated) Worn", required: true },
      { id: "SAF-E2", label: "Ensure No System High Voltage Switching Operations in Progress During Grid Test", required: true },
    ]
  },

  // ── 9. HT SWITCHGEAR & C&R PANELS TEMPLATE ──
  "TMPL-SWG-HV": {
    id: "TMPL-SWG-HV",
    equipmentTypeId: "EQ-SWG-HT",
    category: "Switchgear",
    name: "HT / EHV Switchgear & Protection Panel Inspection",
    version: "2026.1-GOV",
    sections: [
      {
        id: "SEC-SWG-1",
        title: "1. Busbar Chamber & Insulation",
        order: 1,
        items: [
          { id: "SWG-01", label: "Partial Discharge (PD) Level in Busbar Chamber", type: "NUMERIC", unit: "pC", threshold: { unit: "pC", normalMax: 20, warningMax: 50, criticalMin: 50.1 }, required: true, helperText: "TEV / Ultrasonic PD check" },
          { id: "SWG-02", label: "SF6 Gas Density / Pressure (For GIS)", type: "PRESSURE", unit: "bar", threshold: { unit: "bar", normalMin: 5.8, normalMax: 6.5, warningMin: 5.5, criticalMax: 5.49 }, required: false },
          { id: "SWG-03", label: "Anti-Condensation Space Heater Function", type: "PASS_FAIL", required: true, helperText: "Thermostat and heating element operational" },
          { id: "SWG-04", label: "Cable Compartment Gland Earthing", type: "NORMAL_ABNORMAL", required: true },
        ]
      }
    ],
    safetyChecks: [
      { id: "SAF-SW1", label: "Main Busbar De-energized & Verified Grounded with Bus Earth Switch", required: true },
      { id: "SAF-SW2", label: "All Voltage Transformer (VT) Secondary Fuses Removed to Prevent Back-Feeding", required: true },
      { id: "SAF-SW3", label: "Control Supply Tripping Circuit Breaker Switched OFF", required: true },
    ]
  },

  // ── 10. GENERIC ELECTRICAL EQUIPMENT TEMPLATE (Fallback) ──
  "TMPL-GENERIC-ELEC": {
    id: "TMPL-GENERIC-ELEC",
    equipmentTypeId: "EQ-GENERIC",
    category: "Substation",
    name: "Standard Government Electrical Equipment Safety & Inspection",
    version: "2026.1-GOV",
    sections: [
      {
        id: "SEC-G-1",
        title: "1. General & Physical Examination",
        order: 1,
        items: [
          { id: "GEN-E01", label: "Equipment Nameplate & Asset Tag Legibility", type: "PASS_FAIL", required: true },
          { id: "GEN-E02", label: "Visual Physical Damage, Rust or Overheating Marks", type: "NORMAL_ABNORMAL", required: true, evidenceRequiredOnFail: true },
          { id: "GEN-E03", label: "Enclosure Ingress Protection (IP) & Door Gaskets", type: "NORMAL_ABNORMAL", required: true },
        ]
      },
      {
        id: "SEC-G-2",
        title: "2. Electrical Connection & Earthing Verification",
        order: 2,
        items: [
          { id: "GEN-E04", label: "Body Grounding Continuity to Main Earth Bus", type: "YES_NO", required: true },
          { id: "GEN-E05", label: "Terminal Torque & Cable Lug Tightness", type: "PASS_FAIL", required: true },
          { id: "GEN-E06", label: "Insulation Resistance to Earth", type: "INSULATION_RESISTANCE", unit: "MΩ", threshold: { unit: "MΩ", normalMin: 10, warningMin: 2, criticalMax: 1.9 }, required: true },
        ]
      }
    ],
    safetyChecks: [
      { id: "SAF-GEN1", label: "Authorized Work Permit & LOTO Sign-off Verified", required: true },
      { id: "SAF-GEN2", label: "All Phase Voltage Absence Verified", required: true },
      { id: "SAF-GEN3", label: "Personal Protective Equipment Worn", required: true },
    ]
  }
};

/**
 * Returns matching inspection template definition for an equipment type
 */
export function getTemplateForEquipmentType(typeId?: string): EquipmentInspectionTemplate {
  if (!typeId) return EQUIPMENT_INSPECTION_TEMPLATES["TMPL-TRF-PWR"];
  const eqType = ELECTRICAL_EQUIPMENT_TYPES.find(t => t.id === typeId);
  if (eqType && EQUIPMENT_INSPECTION_TEMPLATES[eqType.templateId]) {
    return EQUIPMENT_INSPECTION_TEMPLATES[eqType.templateId];
  }
  // Fallback by category
  if (eqType) {
    if (eqType.category === "Transformers") return EQUIPMENT_INSPECTION_TEMPLATES["TMPL-TRF-PWR"];
    if (eqType.category === "Generators") return EQUIPMENT_INSPECTION_TEMPLATES["TMPL-GEN-DG"];
    if (eqType.category === "Motors") return EQUIPMENT_INSPECTION_TEMPLATES["TMPL-MTR-IND"];
    if (eqType.category === "Circuit Breakers") return EQUIPMENT_INSPECTION_TEMPLATES["TMPL-CBK-VCB"];
    if (eqType.category === "Battery / DC") return EQUIPMENT_INSPECTION_TEMPLATES["TMPL-BTY-DC"];
    if (eqType.category === "Renewable") return EQUIPMENT_INSPECTION_TEMPLATES["TMPL-REN-SOL"];
    if (eqType.category === "Earthing") return EQUIPMENT_INSPECTION_TEMPLATES["TMPL-EAR-SYS"];
    if (eqType.category === "Switchgear") return EQUIPMENT_INSPECTION_TEMPLATES["TMPL-SWG-HV"];
  }
  return EQUIPMENT_INSPECTION_TEMPLATES["TMPL-GENERIC-ELEC"];
}
