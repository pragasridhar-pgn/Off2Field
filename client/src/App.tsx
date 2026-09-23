import { useEffect, useState, useRef, FormEvent } from "react";
import {
  Activity, AlertTriangle, Archive, ArrowRight, BarChart3, Bell, Camera, Check, CheckCircle2, ChevronRight, ClipboardCheck, Cloud, CloudOff, Clock3, Cog, Download, Eye, EyeOff, FileBarChart, FileCheck2, FileClock, FileText, Filter, HardDrive, History, Home, Image as ImageIcon, Link2, ListChecks, LogOut, LockKeyhole, Menu, MoreHorizontal, QrCode, RefreshCw, Search, Send, Settings2, ShieldCheck, Smartphone, SlidersHorizontal, Sparkles, Table2, Trash2, Upload, Users, Wifi, X
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { auth, db } from "./firebase/firebaseConfig";
import {
  signUp as authSignUp,
  signIn as authSignIn,
  signOutUser,
  getCurrentUser,
  subscribeToAuthState,
  type AppUser,
} from "./services/authService";
import { pullInitialCloudData } from "./services/cloudDataService";
import {
  saveInspection,
  getInspection,
  getAllInspections,
  updateInspection
} from "./db/inspectionStorage";
import {
  enqueueSyncItem,
  getAllQueueItems,
  getPendingQueueItems,
  updateQueueItem,
  deleteQueueItem,
  clearSyncedQueue,
  seedInitialQueueIfEmpty,
} from "./db/syncQueueStorage";
import {
  saveEvidence,
  getEvidence,
  getEvidenceForInspection,
  getAllEvidence,
  updateEvidence,
  deleteEvidence,
  saveEvidenceLocally,
  getEvidenceById,
  deleteEvidenceLocally,
  updateEvidenceStatus,
  seedInitialEvidenceIfEmpty,
} from "./db/evidenceStorage";
import type { SyncQueueItem, EvidenceRecord } from "./db/database";
import { getOnlineStatus, subscribeNetworkStatus } from "./utils/networkStatus";
import {
  processSyncQueue,
  processSingleQueueItem,
  retryQueueItem,
  getQueueSyncSummary,
} from "./services/syncService";
import { QRScannerModal } from "./components/QRScannerModal";
import { CameraCaptureModal } from "./components/CameraCaptureModal";
import { MachineReferenceGuides } from "./components/MachineReferenceGuides";


type NavKey = "dashboard" | "inspections" | "workspace" | "offline-workspace" | "machines" | "scanner" | "evidence" | "sync" | "conflicts" | "history" | "reports" | "audit" | "admin";
type Status = "DRAFT" | "SUBMITTED" | "PENDING" | "UNDER REVIEW" | "APPROVED";
type Role = "inspector" | "admin";

const nav = [
  { key: "dashboard", label: "Dashboard", icon: Home }, { key: "inspections", label: "My Inspections", icon: ClipboardCheck },
  { key: "offline-workspace", label: "Offline Field Mode", icon: CloudOff },
  { key: "machines", label: "Machines", icon: Cog }, { key: "scanner", label: "QR Scanner", icon: QrCode }, { key: "evidence", label: "Evidence", icon: Archive },
  { key: "sync", label: "Sync Center", icon: RefreshCw }, { key: "conflicts", label: "Conflicts", icon: AlertTriangle }, { key: "history", label: "Inspection History", icon: History },
  { key: "reports", label: "Reports", icon: FileBarChart }, { key: "audit", label: "Audit Trail", icon: FileClock }, { key: "admin", label: "Admin Console", icon: ShieldCheck },
];
const machineTemplates: Record<string, { name: string; location: string; category: string; type: string; checklist: Array<{ id: string; label: string; value: string; helper: string; required: boolean; tone: string }> }> = {
  // ── 1. TRANSFORMERS (TRF) ──
  "TRF-102": {
    name: "Transformer T-102",
    location: "Substation A · Chennai North",
    category: "Transformers",
    type: "Step-Down Transformer (132 / 33 kV)",
    checklist: [
      { id: "01", label: "Oil Leakage", value: "No Leakage", helper: "Visual inspection of radiator & conservator tank", required: true, tone: "green" },
      { id: "02", label: "Oil Temperature", value: "78 °C", helper: "Normal operating limit: 85 °C", required: true, tone: "amber" },
      { id: "03", label: "Oil Level Gauge", value: "82 %", helper: "Conservator level verified", required: true, tone: "green" },
      { id: "04", label: "HV & LV Bushing Status", value: "Clean / Intact", helper: "Check for cracks or flashover traces", required: true, tone: "green" },
      { id: "05", label: "Winding Temperature", value: "65 °C", helper: "Thermal sensor verified", required: true, tone: "green" },
      { id: "06", label: "Safety Interlock & Relay", value: "Safe", helper: "LOTO & ground earth verified", required: true, tone: "green" },
    ]
  },
  "TRF-117": {
    name: "Transformer T-117",
    location: "Substation B · Tambaram South",
    category: "Transformers",
    type: "Power Transformer (132 / 33 kV)",
    checklist: [
      { id: "01", label: "Oil Dielectric Strength", value: "60 kV", helper: "BDV breakdown voltage test", required: true, tone: "green" },
      { id: "02", label: "Oil Temperature", value: "71 °C", helper: "Previous reading: 68 °C", required: true, tone: "green" },
      { id: "03", label: "Cooling Fan Operation", value: "Running / Normal", helper: "OFAF cooling active", required: true, tone: "green" },
      { id: "04", label: "Tap Changer Position", value: "Tap 5", helper: "Voltage regulation within ±2%", required: true, tone: "green" },
      { id: "05", label: "Safety & Buchholz Relay", value: "Passed", helper: "No gas accumulation detected", required: true, tone: "green" },
    ]
  },
  "TRF-203": {
    name: "Transformer T-203",
    location: "Substation C · Guindy West",
    category: "Transformers",
    type: "EHV Transformer (220 / 110 kV)",
    checklist: [
      { id: "01", label: "SF6 Gas Pressure", value: "6.1 bar", helper: "Nominal pressure: 6.0 bar", required: true, tone: "green" },
      { id: "02", label: "Dissolved Gas Analysis (DGA)", value: "Normal", helper: "Key gas levels within IEEE C57.104 limits", required: true, tone: "green" },
      { id: "03", label: "Silica Gel Breather", value: "Blue (Good)", helper: "Desiccant moisture check", required: true, tone: "green" },
      { id: "04", label: "Surge Arrester Leakage", value: "0.4 mA", helper: "Third harmonic resistive current", required: true, tone: "green" },
      { id: "05", label: "Safety Status", value: "Under Maintenance", helper: "Permit to work issued", required: true, tone: "amber" },
    ]
  },
  "TRF-305": {
    name: "Distribution Transformer T-305",
    location: "Feeder Yard 2 · Avadi East",
    category: "Transformers",
    type: "Pole Mounted Transformer (33 / 11 kV)",
    checklist: [
      { id: "01", label: "Oil Level & Color", value: "Normal / Pale", helper: "Visual glass gauge check", required: true, tone: "green" },
      { id: "02", label: "Lightning Arrester", value: "Intact", helper: "Check surge counter & gap", required: true, tone: "green" },
      { id: "03", label: "Earthing Resistance", value: "0.8 Ω", helper: "Sub-1 ohm earth pit test", required: true, tone: "green" },
      { id: "04", label: "Bushing Terminal Tightness", value: "Torqued", helper: "Check thermal hot spots", required: true, tone: "green" },
      { id: "05", label: "Fusing Link Condition", value: "OK", helper: "DO fuse element intact", required: true, tone: "green" },
    ]
  },

  // ── 2. PUMPS & MOTORS (PMP / MTR) ──
  "PMP-301": {
    name: "Cooling Pump P-301",
    location: "Pump House 4 · Ennore Bay",
    category: "Pumps & Motors",
    type: "Centrifugal Water Pump (45 kW)",
    checklist: [
      { id: "01", label: "Vibration Velocity", value: "1.8 mm/s", helper: "ISO 10816 Class II limit: 2.8 mm/s", required: true, tone: "green" },
      { id: "02", label: "Bearing Drive-End Temp", value: "54 °C", helper: "Max allowable: 75 °C", required: true, tone: "green" },
      { id: "03", label: "Suction & Discharge Pressure", value: "4.2 bar", helper: "Rated pressure: 4.5 bar", required: true, tone: "amber" },
      { id: "04", label: "Mechanical Gland Seal", value: "No Leakage", helper: "Visual seal inspection", required: true, tone: "green" },
      { id: "05", label: "Motor Phase Current", value: "42 A", helper: "Balanced 3-phase current draw", required: true, tone: "green" },
      { id: "06", label: "Emergency Stop Button", value: "Functional", helper: "Local trip switch verified", required: true, tone: "green" },
    ]
  },
  "PMP-302": {
    name: "Boiler Feed Pump P-302",
    location: "Thermal Station 1 · Boiler Unit 3",
    category: "Pumps & Motors",
    type: "Multi-Stage High Pressure Pump (110 kW)",
    checklist: [
      { id: "01", label: "Flow Discharge Rate", value: "240 m³/h", helper: "Rated capacity: 250 m³/h", required: true, tone: "green" },
      { id: "02", label: "Non-Drive Bearing Temp", value: "62 °C", helper: "Cooling water flush active", required: true, tone: "green" },
      { id: "03", label: "Coupling Alignment", value: "0.02 mm", helper: "Laser alignment verified", required: true, tone: "green" },
      { id: "04", label: "Lubrication Oil Level", value: "Full", helper: "Synthetic ISO VG 68 oil", required: true, tone: "green" },
      { id: "05", label: "Motor Winding Insulation", value: "150 MΩ", helper: "Megger test at 1000V", required: true, tone: "green" },
    ]
  },
  "MTR-105": {
    name: "Induction Motor M-105",
    location: "Compressor House · Manali Plant",
    category: "Pumps & Motors",
    type: "Heavy Duty 3-Phase Motor (75 HP)",
    checklist: [
      { id: "01", label: "Stator Winding Temperature", value: "68 °C", helper: "Class F insulation limit: 105 °C", required: true, tone: "green" },
      { id: "02", label: "Full Load Current Draw", value: "98 A", helper: "Nameplate rating: 102 A", required: true, tone: "green" },
      { id: "03", label: "Shaft Radial Runout", value: "0.01 mm", helper: "Dial indicator test", required: true, tone: "green" },
      { id: "04", label: "Terminal Box Connections", value: "Tight", helper: "Crimped lug inspection", required: true, tone: "green" },
      { id: "05", label: "Vibration Spectrum", value: "Normal", helper: "No unbalance or misalignment peak", required: true, tone: "green" },
    ]
  },

  // ── 3. GENERATORS & TURBINES (GEN / TRB) ──
  "GEN-405": {
    name: "Diesel Generator DG-405",
    location: "Power Plant 2 · Auxiliary Bay",
    category: "Generators & Turbines",
    type: "Emergency Generator (500 kVA)",
    checklist: [
      { id: "01", label: "Fuel Tank Storage Level", value: "95 %", helper: "Daily day-tank check", required: true, tone: "green" },
      { id: "02", label: "Lube Oil Pressure", value: "4.5 bar", helper: "Engine speed: 1500 RPM", required: true, tone: "green" },
      { id: "03", label: "Coolant Temperature", value: "82 °C", helper: "Thermostat open threshold: 88 °C", required: true, tone: "green" },
      { id: "04", label: "Battery Starter Voltage", value: "26.4 V DC", helper: "Float charger operational", required: true, tone: "green" },
      { id: "05", label: "Automatic Transfer Switch", value: "Ready / Auto", helper: "Grid failure backup standby", required: true, tone: "green" },
      { id: "06", label: "Exhaust Smoke Density", value: "Clear", helper: "Visual emissions check", required: true, tone: "green" },
    ]
  },
  "GEN-502": {
    name: "Gas Turbine Generator GT-502",
    location: "Combined Cycle Plant · Basin Bridge",
    category: "Generators & Turbines",
    type: "Gas Turbine Generator Set (125 MVA)",
    checklist: [
      { id: "01", label: "Rotor Speed (RPM)", value: "3000 RPM", helper: "Grid frequency synchronized at 50 Hz", required: true, tone: "green" },
      { id: "02", label: "Exciter Field Voltage", value: "180 V DC", helper: "AVR loop response nominal", required: true, tone: "green" },
      { id: "03", label: "Hydrogen Coolant Pressure", value: "3.5 bar", helper: "Purity level: 98.5% H2", required: true, tone: "green" },
      { id: "04", label: "Stator Water Flow", value: "35 m³/h", helper: "Deionized water loop", required: true, tone: "green" },
      { id: "05", label: "Combustion Chamber Pressure", value: "14.2 bar", helper: "Natural gas fuel pressure", required: true, tone: "green" },
    ]
  },

  // ── 4. SWITCHGEAR & BREAKERS (SWG / CBK) ──
  "CBK-201": {
    name: "Vacuum Circuit Breaker VCB-201",
    location: "Control Room A · Substation 11kV",
    category: "Switchgear & Breakers",
    type: "Medium Voltage VCB (11 kV / 1250 A)",
    checklist: [
      { id: "01", label: "Vacuum Bottle Integrity", value: "Passed", helper: "High-pot test at 28 kV AC", required: true, tone: "green" },
      { id: "02", label: "Contact Resistance (Ductor)", value: "28 µΩ", helper: "Limit: < 40 µΩ", required: true, tone: "green" },
      { id: "03", label: "Closing / Opening Time", value: "35 ms / 25 ms", helper: "Timing analyzer test", required: true, tone: "green" },
      { id: "04", label: "Spring Charge Motor", value: "Charged", helper: "Automatic recharge verified", required: true, tone: "green" },
      { id: "05", label: "Interlock Mechanism", value: "Locked", helper: "Mechanical & electrical interlocks", required: true, tone: "green" },
    ]
  },
  "SWG-501": {
    name: "Gas Insulated Switchgear GIS-501",
    location: "GIS Bay · 220kV Underground Substation",
    category: "Switchgear & Breakers",
    type: "SF6 Encapsulated GIS (220 kV)",
    checklist: [
      { id: "01", label: "SF6 Compartment Density", value: "6.4 bar", helper: "Temperature compensated density gauge", required: true, tone: "green" },
      { id: "02", label: "Partial Discharge (PD) Sensor", value: "< 5 pC", helper: "UHF online PD monitoring", required: true, tone: "green" },
      { id: "03", label: "Earthing Switch Status", value: "Open / Disconnected", helper: "Busbar isolator position", required: true, tone: "green" },
      { id: "04", label: "SF6 Moisture Content", value: "120 ppm", helper: "Max allowable: 250 ppm", required: true, tone: "green" },
      { id: "05", label: "Control Cabinet Heater", value: "Active", helper: "Anti-condensation heater ON", required: true, tone: "green" },
    ]
  },

  // ── 5. RENEWABLES & POWER SYSTEMS (SLR / BTY) ──
  "SLR-101": {
    name: "Solar String Inverter INV-101",
    location: "Solar Farm 3 · Cheyyar Yard",
    category: "Renewables & Power Systems",
    type: "Utility Scale Grid Inverter (250 kW)",
    checklist: [
      { id: "01", label: "DC Input Array Voltage", value: "850 V DC", helper: "MPPT operating voltage range", required: true, tone: "green" },
      { id: "02", label: "AC Output Power", value: "245 kW", helper: "Conversion efficiency: 98.6%", required: true, tone: "green" },
      { id: "03", label: "Heatsink IGBT Temp", value: "58 °C", helper: "Forced air cooling active", required: true, tone: "green" },
      { id: "04", label: "Grid Frequency Lock", value: "50.02 Hz", helper: "Anti-islanding protection active", required: true, tone: "green" },
      { id: "05", label: "Surge Protection Device", value: "Green / OK", helper: "Type II DC SPD status", required: true, tone: "green" },
    ]
  },
  "BTY-202": {
    name: "Substation Battery Bank BTY-202",
    location: "DC Power Room · Substation A",
    category: "Renewables & Power Systems",
    type: "VRLA Lead-Acid Battery Bank (220V DC)",
    checklist: [
      { id: "01", label: "Total Bank Float Voltage", value: "242 V DC", helper: "2.25 V per cell float charge", required: true, tone: "green" },
      { id: "02", label: "Individual Cell Pilot Temp", value: "24 °C", helper: "Climate controlled battery room", required: true, tone: "green" },
      { id: "03", label: "Specific Gravity / Impedance", value: "12.5 mΩ", helper: "Internal cell resistance test", required: true, tone: "green" },
      { id: "04", label: "DC Earth Fault Detector", value: "No Leakage", helper: "Insulation resistance > 1 MΩ", required: true, tone: "green" },
      { id: "05", label: "Terminal Torque Check", value: "Verified", helper: "No corrosion or loose bolts", required: true, tone: "green" },
    ]
  }
};

function persist<T>(key: string, value: T) { localStorage.setItem(key, JSON.stringify(value)); }
function read<T>(key: string, fallback: T): T { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } }

export default function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => getCurrentUser());
  const [role, setRole] = useState<Role | null>(() => getCurrentUser()?.role || null);
  const [authReady, setAuthReady] = useState(false);
  const [page, setPage] = useState<NavKey>("dashboard");
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingRecords, setPendingRecords] = useState<any[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const defaultInspections = [
    { id: "INS-2026-TN-0001", machine: "TRF-102", site: "Substation A", status: "DRAFT" as Status, priority: "HIGH", date: "23 Sep 2026", completion: "68%" },
    { id: "INS-2026-TN-0002", machine: "TRF-117", site: "Substation B", status: "SUBMITTED" as Status, priority: "MEDIUM", date: "21 Sep 2026", completion: "100%" },
    { id: "INS-2026-TN-0003", machine: "PMP-301", site: "Pump House 4", status: "PENDING" as Status, priority: "LOW", date: "20 Sep 2026", completion: "100%" },
    { id: "INS-2026-TN-0004", machine: "TRF-203", site: "Substation C", status: "APPROVED" as Status, priority: "MEDIUM", date: "18 Sep 2026", completion: "100%" },
  ];

  const [queueItems, setQueueItems] = useState<SyncQueueItem[]>([]);
  const [evidenceList, setEvidenceList] = useState<EvidenceRecord[]>([]);
  const pendingQueue = queueItems.filter(item => item.status === "PENDING" || item.status === "FAILED");
  const savedCount = pendingQueue.length;

  const refreshEvidence = async () => {
    try {
      const items = await seedInitialEvidenceIfEmpty();
      setEvidenceList(items);
      return items;
    } catch (err) {
      console.error("Failed to load evidence from IndexedDB:", err);
      return [];
    }
  };

  const refreshQueue = async () => {
    try {
      const items = await seedInitialQueueIfEmpty();
      setQueueItems(items);
      const evs = await getAllEvidence();
      setEvidenceList(evs);
      return items;
    } catch (err) {
      console.error("Failed to load sync queue from IndexedDB:", err);
      return [];
    }
  };

  useEffect(() => {
    refreshQueue();
    refreshEvidence();
  }, []);
  const [inspectionStatus, setInspectionStatus] = useState<Status>(() => read("off2field-status", "DRAFT"));
  const [selectedMachineKey, setSelectedMachineKey] = useState(() => read("off2field-machine", "TRF-102"));
  const [manualMachineCode, setManualMachineCode] = useState(() => read("off2field-manual-code", "TRF-102"));
  const [activeInspectionId, setActiveInspectionId] = useState(() => read("off2field-active-id", "INS-2026-TN-0001"));
  const [submittedAt, setSubmittedAt] = useState<string | null>(() => read("off2field-submitted-at", null));
  const [checklist, setChecklist] = useState(() => read("off2field-checklist", machineTemplates["TRF-102"].checklist));
  const [resolved, setResolved] = useState(() => read("off2field-resolved", false));
  const [showSubmittedModal, setShowSubmittedModal] = useState(false);
  const [inspectionsList, setInspectionsList] = useState<any[]>(() => read("off2field-inspections", defaultInspections));

  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);

  const handleQRScanSuccess = (scannedVal: string) => {
    setShowQRScanner(false);
    const trimmed = scannedVal.trim();
    // Check if scanned value matches any known machine code (e.g. TRF-102, PMP-301)
    const match = Object.keys(machineTemplates).find(
      k => k.toLowerCase() === trimmed.toLowerCase() || trimmed.toUpperCase().includes(k)
    );
    const targetKey = match || (trimmed.length <= 15 ? trimmed.toUpperCase() : "TRF-102");

    toast.success("QR Code Verified", {
      description: `Asset identified: ${targetKey}. Starting inspection workspace.`,
    });
    startNewInspection(targetKey);
  };

  const handleCameraPhotoConfirm = async (data: { blob: Blob; fileName: string; dataUrl: string }) => {
    setShowCameraModal(false);
    await handleCaptureEvidence({
      file: new File([data.blob], data.fileName, { type: data.blob.type || "image/jpeg" }),
      dataUrl: data.dataUrl,
      name: data.fileName,
      title: `On-site Camera Snapshot · ${manualMachineCode || selectedMachineKey || "Field Asset"}`
    });
  };

  // ── Firebase auth state listener ──────────────────────────────
  useEffect(() => {
    const unsub = subscribeToAuthState((user, isReady) => {
      setCurrentUser(user);
      if (user) {
        setRole(user.role);
      } else {
        setRole(null);
      }
      setAuthReady(isReady);

      // Auto cloud pull on login if online
      if (user && navigator.onLine) {
        pullInitialCloudData(user.uid).then(() => {
          getAllInspections().then(records => {
            if (records && records.length > 0) {
              setInspectionsList(records.map(r => ({
                id: r.id,
                machine: r.machine || "TRF-102",
                site: r.site || "Field Site",
                status: (r.status as Status) || "DRAFT",
                priority: "HIGH",
                date: "Today",
                completion: (r.status === "SUBMITTED" || r.status === "APPROVED" || r.status === "PENDING") ? "100%" : "68%",
              })));
            }
          });
        }).catch(err => console.warn("Initial cloud sync note:", err));
      }
    });
    return unsub;
  }, []);

  // ── Restore / load inspections from IndexedDB on startup ──────
  useEffect(() => {
    (async () => {
      try {
        const records = await getAllInspections();
        if (records && records.length > 0) {
          setInspectionsList(prev => {
            const map = new Map(prev.map(x => [x.id, x]));
            for (const r of records) {
              const prevItem = map.get(r.id);
              const status = (r.status as Status) || (prevItem?.status ?? "DRAFT");
              const machine = r.machine || prevItem?.machine || "TRF-102";
              const site = r.site || prevItem?.site || (machineTemplates[machine]?.location.split("·")[0].trim() || "Field Site");
              const completion = (status === "SUBMITTED" || status === "APPROVED" || status === "PENDING") ? "100%" : (prevItem?.completion || "68%");
              const date = r.submittedAt ? new Date(r.submittedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : (prevItem?.date || "Today");
              map.set(r.id, {
                id: r.id,
                machine,
                site,
                status,
                priority: prevItem?.priority || "HIGH",
                date,
                completion,
              });
            }
            return Array.from(map.values());
          });

          // Check if active inspection exists in IndexedDB and restore its state
          const currentRecord = records.find(r => r.id === activeInspectionId);
          if (currentRecord) {
            if (currentRecord.status) setInspectionStatus(currentRecord.status as Status);
            if (currentRecord.machine) {
              setSelectedMachineKey(currentRecord.machine);
              setManualMachineCode(currentRecord.machine);
            }
            if (Array.isArray(currentRecord.checklist) && currentRecord.checklist.length > 0) {
              setChecklist(currentRecord.checklist as any);
            }
            if (currentRecord.resolved !== undefined) setResolved(currentRecord.resolved);
            if (currentRecord.submittedAt) setSubmittedAt(currentRecord.submittedAt);
          }
        }
      } catch (err) {
        console.error("Failed to load inspections from IndexedDB on startup:", err);
      }
    })();
  }, []);

  useEffect(() => { persist("off2field-pending", savedCount); }, [savedCount]);
  useEffect(() => { persist("off2field-status", inspectionStatus); }, [inspectionStatus]);
  useEffect(() => { persist("off2field-active-id", activeInspectionId); }, [activeInspectionId]);
  useEffect(() => { persist("off2field-machine", selectedMachineKey); }, [selectedMachineKey]);
  useEffect(() => { persist("off2field-manual-code", manualMachineCode); }, [manualMachineCode]);
  useEffect(() => { persist("off2field-submitted-at", submittedAt); }, [submittedAt]);
  useEffect(() => { persist("off2field-checklist", checklist); }, [checklist]);
  useEffect(() => { persist("off2field-inspections", inspectionsList); }, [inspectionsList]);
  useEffect(() => {
    persist("off2field-resolved", resolved);
    updateInspection(activeInspectionId, {
      resolved,
      updatedAt: new Date().toISOString(),
    }).catch(err => console.error("Failed to update resolved status in IndexedDB:", err));
  }, [resolved, activeInspectionId]);

  // ── Native browser offline & online detection ─────────────────
  useEffect(() => {
    const unsubscribe = subscribeNetworkStatus((online) => {
      setOffline(!online);
      if (online) {
        toast.success("Network connection restored", {
          description: "Online state detected. Ready for queue sync.",
        });
        syncPendingRecords();
      } else {
        setPage("offline-workspace");
        toast.info("Device is Offline", {
          description: "Switched to Offline Field Workspace. All records stored locally in IndexedDB.",
        });
      }
    });
    return unsubscribe;
  }, []);

  // ── Load pending records whenever savedCount changes ───────────
  useEffect(() => {
    getAllInspections().then(records => {
      setPendingRecords(records.filter(r => r.syncStatus === "PENDING"));
    }).catch(() => {});
  }, [savedCount, inspectionStatus]);

  useEffect(() => {
    if (!role) return;
    const allowed: NavKey[] = role === "inspector"
      ? ["dashboard","inspections","workspace","offline-workspace","machines","scanner","evidence","sync","conflicts","history"]
      : ["reports","audit","admin"];
    if (!allowed.includes(page)) setPage(role === "inspector" ? "dashboard" : "reports");
  }, [role, page]);

  const go = (key: NavKey) => { setPage(key); setMobileOpen(false); };
  const toggleOffline = () => {
    setOffline(v => {
      const next = !v;
      if (next) {
        setPage("offline-workspace");
        toast.info("Offline mode enabled", { description: "Switched to Offline Field Workspace. Work is stored locally in IndexedDB." });
      } else {
        toast.success("Connection restored", { description: "Ready to sync." });
      }
      return next;
    });
  };

  const saveEdit = async (i: number, value: string) => {
    const updated = checklist.map((item, idx) => (idx === i ? { ...item, value } : item));
    setChecklist(updated);
    const itemLabel = checklist[i]?.label || `Item ${i + 1}`;
    await updateInspection(activeInspectionId, {
      checklist: updated,
      syncStatus: "PENDING",
      updatedAt: new Date().toISOString(),
    });

    // Check if there is already a pending checklist update in the queue for this inspection
    const existingQueueItems = await getPendingQueueItems();
    const existingChecklistOp = existingQueueItems.find(
      q => q.entityId === activeInspectionId && q.operationType === "UPDATE_CHECKLIST" && q.status === "PENDING"
    );

    if (existingChecklistOp) {
      await updateQueueItem(existingChecklistOp.id, {
        title: `${itemLabel} → ${value}`,
        payload: {
          inspectionId: activeInspectionId,
          field: itemLabel,
          value,
          checklist: updated,
          updatedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      });
    } else {
      await enqueueSyncItem({
        entityId: activeInspectionId,
        entityName: activeInspectionId === "INS-2026-TN-0001" ? "Inspection A" :
                   activeInspectionId === "INS-2026-TN-0002" ? "Inspection B" :
                   activeInspectionId === "INS-2026-TN-0003" ? "Inspection C" : activeInspectionId,
        operationType: "UPDATE_CHECKLIST",
        title: `${itemLabel} → ${value}`,
        machine: manualMachineCode || selectedMachineKey,
        site: machineTemplates[selectedMachineKey]?.location.split("·")[0].trim() || "Field Site",
        status: "PENDING",
        payload: {
          inspectionId: activeInspectionId,
          field: itemLabel,
          value,
          checklist: updated,
          updatedAt: new Date().toISOString(),
        },
      });
    }
    await refreshQueue();
  };

  // ── Phase 2 Sync Queue Processor (Firebase Firestore + Storage) ──
  const syncPendingRecords = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await processSyncQueue();

      if (!offline && currentUser?.uid) {
        await pullInitialCloudData(currentUser.uid);
      }

      await refreshQueue();
      const refreshedEvs = await getAllEvidence();
      setEvidenceList(refreshedEvs);

      const refreshed = await getAllInspections();
      setPendingRecords(refreshed.filter(r => r.syncStatus === "PENDING"));

      if (offline) {
        toast.info("Offline Queue Protected", {
          description: "Device is offline. All records remain safely stored in IndexedDB.",
        });
      } else {
        toast.success("Firebase Cloud Sync Complete", {
          description: result.message,
        });
      }
    } catch (err: any) {
      console.error("Queue process error:", err);
      toast.error("Queue Processing Error", { description: err?.message || "Check local IndexedDB state." });
    } finally {
      setIsSyncing(false);
    }
  };

  const syncSingleItem = async (itemId: string) => {
    const item = queueItems.find(q => q.id === itemId);
    if (!item) return;

    await updateQueueItem(itemId, { status: "PROCESSING" });
    setQueueItems(prev => prev.map(q => q.id === itemId ? { ...q, status: "PROCESSING" } : q));
    await new Promise(r => setTimeout(r, 250));

    try {
      if (item.status === "FAILED") {
        await retryQueueItem(itemId);
      }
      const res = await processSingleQueueItem(itemId);
      if (res.success) {
        toast.success(`${item.entityName || item.id} verified in local queue`);
      } else {
        toast.warning(`${item.entityName || item.id}: ${res.error || "Pending cloud adapter"}`);
      }
    } catch (err: any) {
      toast.error(`Queue error for ${item.entityName || item.id}`, { description: err?.message });
    }
    await refreshQueue();
    const refreshedEvs = await getAllEvidence();
    setEvidenceList(refreshedEvs);
  };

  const enqueueCustomOperation = async () => {
    const count = queueItems.length + 1;
    const letter = String.fromCharCode(65 + ((count - 1) % 26));
    const entityName = `Inspection ${letter}`;
    const newId = `INS-2026-TN-00${count < 10 ? '0' + count : count}`;
    await enqueueSyncItem({
      entityId: newId,
      entityName,
      operationType: "SUBMIT_INSPECTION",
      title: `${entityName} · Transformer T-${100 + count} (Field Reading)`,
      machine: `TRF-${100 + count}`,
      site: `Substation ${letter}`,
      status: "PENDING",
      payload: {
        id: newId,
        machine: `TRF-${100 + count}`,
        status: "SUBMITTED",
        itemsChecked: 7,
        completion: "100%",
        offlineHash: `SHA-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      },
    });
    await refreshQueue();
    toast.success(`Enqueued ${entityName} → PENDING`, {
      description: "Real operation added to Dexie IndexedDB sync queue."
    });
  };

  const clearCompleted = async () => {
    await clearSyncedQueue();
    await refreshQueue();
    toast("Completed queue operations cleared from IndexedDB");
  };

  const resetDefaultQueue = async () => {
    for (const item of queueItems) {
      await deleteQueueItem(item.id);
    }
    await seedInitialQueueIfEmpty();
    await refreshQueue();
    toast.success("Sync Queue reset to default operations (Inspection A, B, C)");
  };
  const sync = () => syncPendingRecords();
  const openInspection = async (id?: string) => {
    if (id) {
      setActiveInspectionId(id);
      const match = inspectionsList.find(x => x.id === id);
      if (match) {
        setInspectionStatus(match.status as Status);
        if (machineTemplates[match.machine]) {
          setSelectedMachineKey(match.machine);
          setManualMachineCode(match.machine);
        }
      }
      try {
        const record = await getInspection(id);
        if (record) {
          if (record.status) setInspectionStatus(record.status as Status);
          if (Array.isArray(record.checklist) && record.checklist.length > 0) {
            setChecklist(record.checklist as any);
          }
          if (record.resolved !== undefined) setResolved(record.resolved);
        }
      } catch (err) {
        console.error("Failed to load inspection from IndexedDB:", err);
      }
    }
    go("workspace");
  };

  const startNewInspection = (machineKey?: string) => {
    const nextNum = inspectionsList.length + 1;
    const newId = `INS-2026-TN-00${nextNum < 10 ? '0' + nextNum : nextNum}`;
    const targetKey = machineKey || "TRF-102";
    setActiveInspectionId(newId);
    setSelectedMachineKey(targetKey);
    setManualMachineCode(targetKey);
    setInspectionStatus("DRAFT");
    setSubmittedAt(null);
    const initialChecklist = machineTemplates[targetKey]?.checklist || [];
    if (machineTemplates[targetKey]) {
      setChecklist(initialChecklist);
    }
    setInspectionsList(prev => [
      { id: newId, machine: targetKey, site: machineTemplates[targetKey]?.location.split("·")[0].trim() || "Field Site", status: "DRAFT", priority: "HIGH", date: "Today", completion: "0%" },
      ...prev
    ]);

    const now = new Date().toISOString();
    saveInspection({
      id: newId,
      status: "DRAFT",
      checklist: initialChecklist,
      resolved: false,
      syncStatus: "PENDING",
      createdAt: now,
      updatedAt: now,
    }).catch(err => console.error("Failed to save new inspection in IndexedDB:", err));

    enqueueSyncItem({
      entityId: newId,
      entityName: `Inspection ${String.fromCharCode(65 + ((inspectionsList.length) % 26))}`,
      operationType: "CREATE_INSPECTION",
      title: `Create ${newId} (${targetKey})`,
      machine: targetKey,
      site: machineTemplates[targetKey]?.location.split("·")[0].trim() || "Field Site",
      status: "PENDING",
      payload: {
        id: newId,
        machine: targetKey,
        status: "DRAFT",
        checklist: initialChecklist,
        createdAt: now,
      },
    }).then(async () => {
      await refreshQueue();
      if (!offline && currentUser && !currentUser.isOfflineUser) {
        syncPendingRecords();
      }
    }).catch(err => console.error("Failed to enqueue in IndexedDB:", err));

    go("workspace");
  };

  const handleCaptureEvidence = async (fileOrDataUrl?: { file?: File; dataUrl?: string; name?: string; title?: string }) => {
    const id = `EVD-2026-${Math.floor(10000 + Math.random() * 90000)}`;
    const inspectionId = activeInspectionId || "INS-2026-TN-0001";
    const now = new Date().toISOString();

    let blob: Blob;
    let fileName = fileOrDataUrl?.name || "captured_photo.jpg";
    let fileType = "image/jpeg";
    let fileSize = 32000;
    let description = fileOrDataUrl?.title || `Field Inspection Photo · ${selectedMachineKey || "TRF-102"}`;

    if (fileOrDataUrl?.file) {
      const file = fileOrDataUrl.file;
      blob = file;
      fileName = file.name;
      fileType = file.type || "image/jpeg";
      fileSize = file.size;
      description = file.name.replace(/\.[^/.]+$/, "");
    } else if (fileOrDataUrl?.dataUrl) {
      try {
        const parts = fileOrDataUrl.dataUrl.split(",");
        const mimeMatch = parts[0].match(/:(.*?);/);
        fileType = mimeMatch ? mimeMatch[1] : "image/jpeg";
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        blob = new Blob([u8arr], { type: fileType });
        fileSize = blob.size;
      } catch {
        blob = new Blob([fileOrDataUrl.dataUrl], { type: "image/jpeg" });
      }
    } else {
      // Offline simulated photo snapshot fallback
      const timeStr = new Date().toLocaleTimeString();
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
        <rect width="400" height="300" fill="#1e293b"/>
        <circle cx="200" cy="130" r="46" fill="rgba(56,189,248,0.25)"/>
        <text x="200" y="138" fill="#38bdf8" font-size="28" font-family="system-ui" font-weight="bold" text-anchor="middle">📷</text>
        <text x="200" y="210" fill="#ffffff" font-size="16" font-family="system-ui" font-weight="600" text-anchor="middle">Field Photo Snapshot</text>
        <text x="200" y="235" fill="#94a3b8" font-size="12" font-family="monospace" text-anchor="middle">${timeStr} · IndexedDB</text>
      </svg>`;
      blob = new Blob([svg], { type: "image/svg+xml" });
      fileType = "image/svg+xml";
      fileSize = blob.size;
      fileName = `photo_${Date.now().toString().slice(-4)}.jpg`;
      description = `Field Inspection Photo · ${selectedMachineKey || "TRF-102"}`;
    }

    try {
      const record = await saveEvidenceLocally({
        id,
        inspectionId,
        fileName,
        fileType,
        fileSize,
        blob,
        description,
        syncStatus: "PENDING",
        name: fileName,
        title: description,
        category: "PHOTO",
        mimeType: fileType,
        size: fileSize,
      });

      await refreshQueue();
      const refreshedEvs = await getAllEvidence();
      setEvidenceList(refreshedEvs);

      toast.success("Evidence saved locally to IndexedDB", {
        description: `${record.id} (${description}) stored offline.`
      });

      // If online and authenticated with Firebase, immediately process sync queue
      if (!offline && currentUser && !currentUser.isOfflineUser) {
        syncPendingRecords();
      }
    } catch (err: any) {
      console.error("Failed to save evidence:", err);
      toast.error("Failed to store evidence locally", { description: err?.message });
    }
  };

  const transitionLifecycle = async (targetStatus: Status) => {
    setInspectionStatus(targetStatus);
    const nowIso = new Date().toISOString();
    const timeStr = new Date().toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    if (targetStatus === "SUBMITTED") {
      setSubmittedAt(timeStr);
      setShowSubmittedModal(true);
      toast.success("Inspection submitted for review", {
        description: "Audit trail signed & saved in IndexedDB. Queued for sync (PENDING)."
      });
    } else if (targetStatus === "PENDING") {
      toast.info("Inspection queued as PENDING", {
        description: "Record is queued locally for cloud synchronization and supervisor sign-off."
      });
    } else if (targetStatus === "DRAFT") {
      toast("Reopened inspection as DRAFT", {
        description: "Checklist and field values are unlocked for modifications on-site."
      });
    }

    try {
      await updateInspection(activeInspectionId, {
        status: targetStatus,
        syncStatus: "PENDING",
        submittedAt: (targetStatus === "SUBMITTED" || targetStatus === "PENDING") ? nowIso : undefined,
        updatedAt: nowIso,
      });

      if (targetStatus === "SUBMITTED" || targetStatus === "PENDING") {
        await enqueueSyncItem({
          entityId: activeInspectionId,
          entityName: activeInspectionId === "INS-2026-TN-0001" ? "Inspection A" :
                     activeInspectionId === "INS-2026-TN-0002" ? "Inspection B" :
                     activeInspectionId === "INS-2026-TN-0003" ? "Inspection C" : activeInspectionId,
          operationType: "SUBMIT_INSPECTION",
          title: `${activeInspectionId} · ${targetStatus} (${manualMachineCode || selectedMachineKey})`,
          machine: manualMachineCode || selectedMachineKey,
          site: machineTemplates[selectedMachineKey]?.location.split("·")[0].trim() || "Field Site",
          status: "PENDING",
          payload: {
            id: activeInspectionId,
            machine: manualMachineCode || selectedMachineKey,
            status: targetStatus,
            checklist,
            submittedAt: nowIso,
          },
        });
        await refreshQueue();

        // If online and authenticated with Firebase, immediately process sync queue
        if (!offline && currentUser && !currentUser.isOfflineUser) {
          syncPendingRecords();
        }
      }
    } catch (err) {
      console.error("Failed to update status in IndexedDB:", err);
    }

    setInspectionsList(prev => {
      const code = manualMachineCode || selectedMachineKey;
      const site = machineTemplates[selectedMachineKey]?.location.split("·")[0].trim() || "Field Site";
      const index = prev.findIndex(x => x.id === activeInspectionId);
      const record = {
        id: activeInspectionId,
        machine: code,
        site: site,
        status: targetStatus,
        priority: "HIGH",
        date: (targetStatus === "SUBMITTED" || targetStatus === "PENDING") ? "Today" : "23 Sep 2026",
        completion: targetStatus === "DRAFT" ? "68%" : "100%",
      };
      if (index >= 0) {
        const copy = [...prev];
        copy[index] = { ...copy[index], ...record };
        return copy;
      }
      return [record, ...prev];
    });
  };

  const handleInspectionSubmit = () => {
    transitionLifecycle("SUBMITTED");
  };

  const logout = async () => {
    try {
      await signOutUser();
    } catch { /**/ }
    setCurrentUser(null);
    setRole(null);
    setPage("dashboard");
  };

  // Show a minimal loading screen while Firebase resolves auth state
  if (!authReady) return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--paper)"}}><Brand/></div>;

  if (!role) return <LoginPage onLogin={async (userObj) => {
    setCurrentUser(userObj);
    setRole(userObj.role);
    setPage(userObj.role === "admin" ? "reports" : "dashboard");
  }} />;

  const inspectorNav = nav.slice(0, 9);
  const adminNav = nav.slice(9);
  const mobileNavItems = role === "inspector" ? nav.slice(0, 6) : nav.slice(9);

  return <div className="app-shell">
    <Toaster position="bottom-right" richColors />
    <header className="mobile-header"><button className="icon-btn" onClick={() => setMobileOpen(v => !v)}><Menu size={20}/></button><Brand compact/><div className="mobile-spacer"/><Connection offline={offline} onClick={toggleOffline}/></header>
    <aside className={"sidebar " + (mobileOpen ? "open" : "")}>
      <div className="brand-wrap"><Brand/><button className="icon-btn close-mobile" onClick={() => setMobileOpen(false)}><X size={18}/></button></div>
      {role === "inspector" && <><div className="nav-label">WORKSPACE</div><nav>{inspectorNav.map(item => <NavItem key={item.key} item={item} active={page === item.key || (page === "workspace" && item.key === "inspections")} onClick={() => go(item.key as NavKey)} badge={item.key === "sync" ? savedCount : item.key === "conflicts" && !resolved ? 1 : undefined}/>)}</nav></>}
      {role === "admin" && <><div className="nav-label">INSIGHT & CONTROL</div><nav>{adminNav.map(item => <NavItem key={item.key} item={item} active={page === item.key} onClick={() => go(item.key as NavKey)}/>)}</nav></>}
      {offline && (
        <div style={{padding:"6px 12px 0 12px"}}>
          <button className={"nav-item " + (page === "offline-workspace" ? "active" : "")} style={{background: page === "offline-workspace" ? undefined : "#1e354a", color: "#ffffff", border: "1px solid #f59e0b"}} onClick={() => go("offline-workspace")}>
            <CloudOff size={16} color="#f59e0b"/>
            <span><strong>Offline Workspace</strong></span>
            <em style={{background:"#f59e0b",color:"#0f172a",fontWeight:700}}>LIVE</em>
          </button>
        </div>
      )}
      <div className="sidebar-bottom">
        <div className="profile">
          <div className="avatar">{role === "admin" ? "AD" : (currentUser?.email ? currentUser.email.slice(0, 2).toUpperCase() : "PR")}</div>
          <div>
            <strong>{currentUser?.displayName || (role === "admin" ? "Admin User" : "Field Officer")}</strong>
            <span>{currentUser?.email || (role === "admin" ? "Administrator" : "Offline Inspector")}</span>
          </div>
          <button className="icon-btn logout-btn" title="Sign out" onClick={logout}><LogOut size={16}/></button>
        </div>
      </div>
    </aside>
    <main className="main"><Topbar page={page} offline={offline} isSyncing={isSyncing} toggleOffline={toggleOffline} savedCount={savedCount} sync={syncPendingRecords} userEmail={currentUser?.email || currentUser?.displayName}/>
      {offline && page !== "offline-workspace" && (
        <div style={{padding:"0 24px 0 24px",marginTop:14}}>
          <div className="offline-banner-bar">
            <div className="banner-left">
              <span className="banner-tag">OFFLINE MODE</span>
              <span>Network connection lost. All checklist data, notes, and photos are saved directly to this device.</span>
            </div>
            <button className="btn primary" style={{padding:"6px 14px",fontSize:"12px"}} onClick={() => go("offline-workspace")}>
              <CloudOff size={14}/> Open Offline Workspace
            </button>
          </div>
        </div>
      )}
      <div className="content">
        {page === "dashboard" && <Dashboard go={go} offline={offline} savedCount={savedCount} openInspection={openInspection} onOpenScanner={() => setShowQRScanner(true)}/>}
        {page === "inspections" && <Inspections openInspection={openInspection} startNewInspection={startNewInspection} inspectionsList={inspectionsList}/>}
        {page === "workspace" && <Workspace status={inspectionStatus} setStatus={setInspectionStatus} transitionLifecycle={transitionLifecycle} checklist={checklist} setChecklist={setChecklist} saveEdit={saveEdit} offline={offline} go={go} resolved={resolved} setResolved={setResolved} selectedMachineKey={selectedMachineKey} setSelectedMachineKey={setSelectedMachineKey} manualMachineCode={manualMachineCode} setManualMachineCode={setManualMachineCode} activeInspectionId={activeInspectionId} submittedAt={submittedAt} onSubmitClick={handleInspectionSubmit} savedCount={savedCount} onCaptureEvidence={handleCaptureEvidence} evidenceList={evidenceList} onOpenLiveCamera={() => setShowCameraModal(true)} onDeleteEvidence={async (id: string) => { await deleteEvidenceLocally(id); const evs = await getAllEvidence(); setEvidenceList(evs); await refreshQueue(); toast("Evidence deleted from IndexedDB"); }} onSyncEvidence={async (item: any) => { const matchingQ = queueItems.find(q => q.entityId === item.id || q.payload?.id === item.id); if (matchingQ) { await syncSingleItem(matchingQ.id); } else if (item.queueItemId) { await syncSingleItem(item.queueItemId); } else { await syncPendingRecords(); } }}/>}
        {page === "offline-workspace" && <OfflineWorkspace go={go} refreshQueue={refreshQueue} setInspectionsList={setInspectionsList} onOpenLiveCamera={() => setShowCameraModal(true)} onSubmitted={(newId: string) => { setActiveInspectionId(newId); setInspectionStatus("SUBMITTED"); setShowSubmittedModal(true); }} />}
        {page === "machines" && <Machines go={go} startNewInspection={startNewInspection} onOpenScanner={() => setShowQRScanner(true)}/>}
        {page === "scanner" && <Scanner go={go} startNewInspection={startNewInspection} onOpenLiveScanner={() => setShowQRScanner(true)}/>}
        {page === "evidence" && <Evidence evidenceList={evidenceList} savedCount={savedCount} onCaptureEvidence={handleCaptureEvidence} onOpenLiveCamera={() => setShowCameraModal(true)} onDeleteEvidence={async (id: string) => { await deleteEvidenceLocally(id); const evs = await getAllEvidence(); setEvidenceList(evs); await refreshQueue(); toast("Evidence deleted from IndexedDB"); }} onSyncEvidence={async (item: any) => { const matchingQ = queueItems.find(q => q.entityId === item.id || q.payload?.id === item.id); if (matchingQ) { await syncSingleItem(matchingQ.id); } else if (item.queueItemId) { await syncSingleItem(item.queueItemId); } else { await syncPendingRecords(); } }} offline={offline}/>}
        {page === "sync" && <SyncCenter queueItems={queueItems} pendingCount={savedCount} sync={sync} syncSingleItem={syncSingleItem} enqueueTestOperation={enqueueCustomOperation} clearCompleted={clearCompleted} resetDefaultQueue={resetDefaultQueue} isSyncing={isSyncing} offline={offline}/>}
        {page === "conflicts" && <Conflicts resolved={resolved} setResolved={setResolved}/>}
        {page === "history" && <HistoryPage/>}
        {page === "reports" && <Reports/>}
        {page === "audit" && <Audit/>}
        {page === "admin" && <Admin/>}
      </div>
    </main>
    <div className="mobile-nav">{mobileNavItems.map(item => <button className={page === item.key ? "active" : ""} key={item.key} onClick={() => go(item.key as NavKey)}><item.icon size={18}/><span>{item.label.split(" ")[0]}</span></button>)}</div>

    {/* ── Real QR Scanner Camera Modal ── */}
    <QRScannerModal
      isOpen={showQRScanner}
      onClose={() => setShowQRScanner(false)}
      onScanSuccess={handleQRScanSuccess}
    />

    {/* ── Real Camera Photo Capture Modal ── */}
    <CameraCaptureModal
      isOpen={showCameraModal}
      onClose={() => setShowCameraModal(false)}
      onCapture={handleCameraPhotoConfirm}
      machineTitle={manualMachineCode || selectedMachineKey}
    />

    {/* ── Inspection Submitted Modal Popup ── */}
    {showSubmittedModal && (
      <div className="modal-overlay" onClick={() => setShowSubmittedModal(false)}>
        <div className="modal-card" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-icon-badge"><CheckCircle2 size={30}/></div>
            <h3>Inspection Submitted Successfully!</h3>
            <p>Your inspection record has been signed off, saved locally, and queued for supervisor review.</p>
          </div>
          <div className="modal-body">
            <div className="modal-details-grid">
              <div className="modal-detail-item"><span>Inspection ID</span><strong>{activeInspectionId}</strong></div>
              <div className="modal-detail-item"><span>Machine Code</span><strong className="mono">{manualMachineCode || selectedMachineKey}</strong></div>
              <div className="modal-detail-item"><span>Machine Name</span><strong>{machineTemplates[selectedMachineKey]?.name || "Equipment Record"}</strong></div>
              <div className="modal-detail-item"><span>Location</span><strong>{machineTemplates[selectedMachineKey]?.location || "Field Substation"}</strong></div>
              <div className="modal-detail-item"><span>Status</span><StatusChip status="SUBMITTED"/></div>
              <div className="modal-detail-item"><span>Submitted At</span><strong>Today, {new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</strong></div>
              <div className="modal-detail-item"><span>Audit Ref</span><strong className="mono">OP-SUBMIT-2026</strong></div>
            </div>
            <div className="modal-note">
              <ShieldCheck size={16}/>
              <span>Tamper-proof audit record created. Saved in Dexie IndexedDB &amp; ready for cloud sync.</span>
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn secondary" onClick={() => { setShowSubmittedModal(false); go("inspections"); }}>
              <ClipboardCheck size={15}/> View Inspections
            </button>
            <button className="btn primary" style={{background:"#d97706"}} onClick={() => { transitionLifecycle("PENDING"); setShowSubmittedModal(false); }}>
              <Clock3 size={15}/> Queue for Sync (→ PENDING)
            </button>
            <button className="btn secondary" onClick={() => setShowSubmittedModal(false)}>
              <Check size={15}/> Done &amp; Close
            </button>
          </div>
        </div>
      </div>
    )}
  </div>;
}


function LoginPage({ onLogin }: { onLogin: (user: AppUser) => void }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [roleSelect, setRoleSelect] = useState<Role>("inspector");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const email = user.trim().includes("@") ? user.trim() : `${user.trim()}@off2field.com`;
    try {
      let appUser: AppUser;
      if (isSignUp) {
        appUser = await authSignUp(email, pass, roleSelect);
        toast.success("Account created successfully", { description: `Logged in as ${email}` });
      } else {
        appUser = await authSignIn(email, pass);
        toast.success("Signed in successfully", { description: `Welcome back, ${email}` });
      }
      onLogin(appUser);
    } catch (e: any) {
      const code: string = e.code ?? "";
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") setErr("Incorrect password. Please try again.");
      else if (code === "auth/user-not-found") setErr("User not found. Check email or toggle Sign Up.");
      else if (code === "auth/email-already-in-use") setErr("Email is already registered. Please Sign In instead.");
      else if (code === "auth/weak-password") setErr("Password must be at least 6 characters.");
      else if (code === "auth/invalid-email") setErr("Invalid username or email format.");
      else if (code === "auth/network-request-failed") setErr("Network error. You can still use Offline Field Mode.");
      else setErr(e.message ?? "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleOfflineGuest = () => {
    const guestUser: AppUser = {
      uid: "offline-field-officer",
      email: "field.officer@local.device",
      role: "inspector",
      displayName: "Field Inspector (Offline)",
      isOfflineUser: true,
    };
    onLogin(guestUser);
    toast.info("Offline Field Mode Active", {
      description: "Inspections, checklist edits, and photos will be saved locally to IndexedDB.",
    });
  };

  return <div className="login-shell">
    <div className="login-wrap">
      <div className="login-brand"><Brand/><p className="login-tagline">Field Inspection Operating System</p></div>
      <div className="login-card">
        <div className="login-card-header">
          <h2>{isSignUp ? "Create Field Account" : "Sign In to OFF2FIELD"}</h2>
          <p>{isSignUp ? "Register a new field inspector or admin profile" : "Enter your credentials to access your workspace"}</p>
        </div>
        <form className="login-form" onSubmit={submit}>
          <div className="login-field">
            <label>Username or Email</label>
            <input
              type="text"
              placeholder="e.g. inspector@off2field.com"
              value={user}
              onChange={e => setUser(e.target.value)}
              autoFocus
            />
          </div>
          <div className="login-field">
            <label>Password</label>
            <div className="pass-wrap">
              <input
                type={showPass ? "text" : "password"}
                placeholder="••••••••"
                value={pass}
                onChange={e => setPass(e.target.value)}
              />
              <button type="button" className="pass-toggle" onClick={() => setShowPass(v => !v)}>
                {showPass ? <EyeOff size={14}/> : <Eye size={14}/>}
              </button>
            </div>
          </div>

          {isSignUp && (
            <div className="login-field">
              <label>Role</label>
              <select
                value={roleSelect}
                onChange={e => setRoleSelect(e.target.value as Role)}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "white", fontSize: "14px" }}
              >
                <option value="inspector">Field Inspector</option>
                <option value="admin">Supervisor / Admin</option>
              </select>
            </div>
          )}

          {err && <div className="login-error">{err}</div>}
          <button type="submit" className="login-submit inspector" disabled={loading || !user || !pass}>
            {loading && <span className="login-spinner"/>}
            {loading ? (isSignUp ? "Creating account…" : "Signing in…") : (isSignUp ? "Create Account" : "Sign In")}
          </button>

          <div style={{ display: "flex", justifyContent: "center", marginTop: "10px" }}>
            <button
              type="button"
              className="text-btn"
              style={{ fontSize: "12px", color: "var(--brand, #0284c7)" }}
              onClick={() => { setIsSignUp(!isSignUp); setErr(""); }}
            >
              {isSignUp ? "Already have an account? Sign In" : "Need an account? Create one"}
            </button>
          </div>

          <div style={{marginTop:12,borderTop:"1px solid #e2e8f0",paddingTop:12,textAlign:"center"}}>
            <button
              type="button"
              className="btn secondary"
              style={{width:"100%",justifyContent:"center",fontSize:"12px",padding:"8px"}}
              onClick={handleOfflineGuest}
            >
              <CloudOff size={14} color="#f59e0b"/> Work in Offline Field Mode (No login required)
            </button>
            <p style={{fontSize:10,color:"var(--muted)",marginTop:5}}>Inspect equipment, edit checklists, and take photos offline</p>
          </div>
        </form>
      </div>
    </div>
  </div>;
}


function Brand({ compact = false }: { compact?: boolean }) { return <div className="brand"><div className="brand-symbol"><span></span><span></span><span></span></div>{!compact && <div><strong>OFF<span>2</span>FIELD</strong><small>FIELD INSPECTION OS</small></div>}</div> }
function NavItem({ item, active, onClick, badge }: any) { return <button className={"nav-item " + (active ? "active" : "")} onClick={onClick}><item.icon size={17}/><span>{item.label}</span>{badge !== undefined && <em>{badge}</em>}</button> }
function Connection({ offline, onClick }: { offline: boolean; onClick: () => void }) { return <button onClick={onClick} className={"connection " + (offline ? "is-offline" : "")}><span className="status-dot"></span>{offline ? "OFFLINE" : "ONLINE"}<ChevronRight size={13}/></button> }
function Topbar({ page, offline, isSyncing, toggleOffline, savedCount, sync, userEmail }: any) {
  const title = page === "workspace" ? "Inspection workspace" : page === "dashboard" ? "Operations overview" : nav.find(n => n.key === page)?.label;
  return (
    <div className="topbar">
      <div><h1>{title}</h1></div>
      <div className="top-actions">
        {/* Review status indicator area */}
        <div style={{ display: "flex", gap: "6px", alignItems: "center", fontSize: "11px", background: "rgba(15, 23, 42, 0.05)", padding: "5px 10px", borderRadius: "6px" }}>
          <span style={{ color: "var(--muted, #64748b)" }}>User: <strong style={{ color: "var(--ink, #0f172a)" }}>{userEmail || "Field Officer"}</strong></span>
          <span style={{ color: "#cbd5e1" }}>|</span>
          <span style={{ color: offline ? "#d97706" : "#16a34a", fontWeight: 700 }}>{offline ? "OFFLINE" : "ONLINE"}</span>
          <span style={{ color: "#cbd5e1" }}>|</span>
          <span style={{ color: isSyncing ? "#0284c7" : savedCount > 0 ? "#d97706" : "#16a34a", fontWeight: 700 }}>
            {isSyncing ? "SYNCING" : savedCount > 0 ? `PENDING (${savedCount})` : "SYNCED"}
          </span>
        </div>
        <div className="local-save"><span className="pulse"></span><span><strong>IndexedDB protected</strong><small>Saved offline</small></span></div>
        <button className="top-icon"><Bell size={18}/><i></i></button>
        <Connection offline={offline} onClick={toggleOffline}/>
        <button className="sync-btn" onClick={sync} disabled={isSyncing} style={isSyncing ? {opacity:0.7,cursor:"not-allowed"} : {}}>
          <RefreshCw size={15} style={isSyncing ? {animation:"spin 1s linear infinite"} : {}}/> {isSyncing ? "Syncing…" : <>Sync {savedCount > 0 && <b>{savedCount}</b>}</>}
        </button>
      </div>
    </div>
  );
}

function PageIntro({ eyebrow, title, description, actions }: any) { return <div className="page-intro"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2><p>{description}</p></div><div className="intro-actions">{actions}</div></div> }
function Dashboard({ go, offline, savedCount, openInspection }: any) { return <><div className="dash-actions"><button className="btn secondary" onClick={() => go("scanner")}><QrCode size={16}/> Scan machine</button><button className="btn primary" onClick={() => openInspection()}><PlusIcon/> Start inspection</button></div><div className="stat-grid">{[["Assigned inspections","12","+2 this week","blue",ClipboardCheck,"inspections"],["In progress","03","2 due today","amber",Activity,"inspections"],["Submitted","08","+4 this week","green",Send,"inspections"],["Pending review","04","Supervisor queue","violet",Clock3,"inspections"],["Conflicts","01","Needs resolution","red",AlertTriangle,"conflicts"],["Approved","27","92% acceptance","teal",CheckCircle2,"history"]].map(([label,value,sub,color,Icon,dest]: any[]) => <button className="stat-card stat-card-btn" key={label as string} onClick={() => go(dest)}><div className={"stat-icon " + color}><Icon size={17}/></div><div className="stat-copy"><span>{label}</span><strong>{value}</strong><small className={color === "red" ? "danger-text" : ""}>{sub}</small></div><ChevronRight size={14} className="muted-icon stat-arrow"/></button>)}</div><div className="dashboard-grid"><section className="panel readiness"><PanelHeader title="Offline readiness" icon={<Wifi size={17}/>} action={<span className="ready-chip"><span></span> Device ready</span>}/><div className="readiness-body"><div className="readiness-score"><div className="score-ring"><strong>100</strong><span>%</span></div><div><strong>READY FOR<br/>OFFLINE WORK</strong><small>All field dependencies are cached</small></div></div><div className="checks">{["App available offline","Assignments downloaded","Machine data available","Templates available","Permissions cached","Storage available"].map(x => <div key={x}><CheckCircle2 size={16}/><span>{x}</span><small>Verified</small></div>)}</div></div></section><section className="panel workload"><PanelHeader title="Today’s workload" icon={<BarChart3 size={17}/>} action={<button className="text-btn" onClick={() => go("inspections")}>View all <ArrowRight size={14}/></button>}/><div className="workload-rows">{[["INS-2026-TN-0001","TRF-102 · Substation A","High","2h 14m","high"],["INS-2026-TN-0002","TRF-117 · Substation B","Medium","5h 08m","medium"],["INS-2026-TN-0003","PMP-301 · Pump House 4","Low","Tomorrow","low"]].map((x, i) => <button className="work-row" onClick={() => openInspection(x[0])} key={x[0]}><div className="work-index">0{i+1}</div><div className="work-main"><strong>{x[0]}</strong><span>{x[1]}</span></div><span className={"priority " + x[4]}>{x[2]}</span><div className="work-time"><Clock3 size={13}/>{x[3]}</div><ChevronRight size={15}/></button>)}</div></section></div><div className="lower-grid"><section className="panel activity-panel"><PanelHeader title="Recent activity" icon={<Activity size={17}/>} action={<button className="text-btn" onClick={() => go("audit")}>Audit trail <ArrowRight size={14}/></button>}/><Timeline items={[["Inspection created","INS-2026-TN-0001","Pragatheesh","10:00","blue"],["Checklist updated","Oil Temperature · 78 °C","Saved locally","10:41","amber"],["Photo evidence added","EVD-2026-00001","TRF-102 / Item 04","10:43","purple"],["Conflict detected","Temperature value","Sync queue","10:44","red"]]}/></section><section className="panel sync-panel"><PanelHeader title="Sync health" icon={<RefreshCw size={17}/>} action={<button className="icon-btn"><MoreHorizontal size={17}/></button>}/><div className="sync-health"><div className="health-number"><strong>98.4<span>%</span></strong><small>Successful operations</small></div><div className="health-bars">{Array.from({length: 18}).map((_,i)=><i key={i} style={{height: `${18 + ((i*17)%60)}%`}}></i>)}</div></div><div className="sync-meta"><div><span className="dot green-dot"></span>Last sync <strong>Today, 09:58</strong></div><div><span className="dot amber-dot"></span>{offline ? "Offline queue" : "Pending changes"} <strong>{savedCount} operations</strong></div></div></section></div></> }
function PanelHeader({ title, icon, action }: any) { return <div className="panel-header"><div><span className="panel-icon">{icon}</span><h3>{title}</h3></div>{action}</div> }
function Timeline({ items }: any) { return <div className="timeline">{items.map((x: any) => <div className="timeline-item" key={x[1]}><div className={"timeline-dot " + x[4]}></div><div><strong>{x[0]}</strong><span>{x[1]}</span><small>{x[2]}</small></div><time>{x[3]}</time></div>)}</div> }
function PlusIcon(){return <span className="plus-icon">+</span>}

function Inspections({ openInspection, startNewInspection, inspectionsList }: any) { 
  const [q,setQ]=useState(""); 
  const filtered = inspectionsList.filter((r: any) => 
    r.id.toLowerCase().includes(q.toLowerCase()) || 
    r.machine.toLowerCase().includes(q.toLowerCase()) || 
    r.site.toLowerCase().includes(q.toLowerCase())
  ); 
  return <><PageIntro eyebrow="WORKSPACE / INSPECTIONS" title="My inspections" description="Manage field inspections, completion state, and submission readiness." actions={<button className="btn primary" onClick={() => startNewInspection()}><PlusIcon/> New inspection</button>}/><div className="toolbar"><div className="searchbox"><Search size={16}/><input placeholder="Search by inspection ID, machine, or site" value={q} onChange={e=>setQ(e.target.value)}/></div><button className="btn secondary"><Filter size={15}/> Filters <span className="filter-count">2</span></button><button className="btn secondary"><SlidersHorizontal size={15}/> Sort</button><div className="view-toggle"><button className="active"><Table2 size={16}/></button><button><ListChecks size={16}/></button></div></div><section className="panel table-panel"><div className="table-top"><div><strong>Inspection register</strong><span>{filtered.length} records · Saved locally &amp; synced</span></div><button className="text-btn"><Download size={14}/> Export CSV</button></div><div className="table-wrap"><table><thead><tr><th>Inspection ID</th><th>Machine / site</th><th>Status</th><th>Priority</th><th>Last updated</th><th>Completion</th><th></th></tr></thead><tbody>{filtered.map((r: any)=><tr key={r.id} onClick={() => openInspection(r.id)}><td><strong className="linkish">{r.id}</strong><span className="table-sub">Officer · Pragatheesh</span></td><td><strong>{r.machine}</strong><span className="table-sub">{r.site}</span></td><td><StatusChip status={r.status}/></td><td><span className={"priority " + r.priority.toLowerCase()}>{r.priority}</span></td><td>{r.date}</td><td><div className="completion"><div><i style={{width:r.completion}}></i></div><span>{r.completion}</span></div></td><td><ChevronRight size={16}/></td></tr>)}</tbody></table></div></section></> 
}
function StatusChip({status}: {status:string}) { return <span className={"status-chip " + status.toLowerCase().replace(" ","-")}><span></span>{status}</span> }

function Workspace({status,setStatus,checklist,setChecklist,saveEdit,offline,go,resolved,setResolved,selectedMachineKey,setSelectedMachineKey,manualMachineCode,setManualMachineCode,activeInspectionId,submittedAt,onSubmitClick,savedCount,onCaptureEvidence,evidenceList,onDeleteEvidence,onSyncEvidence}:any){
  const [tab,setTab]=useState("Checklist");
  const filledCount = checklist.filter((x:any)=>x.value && x.value.trim() !== "").length;
  const totalCount = checklist.length;
  const readinessPercent = Math.round((filledCount / totalCount) * 100);
  const activeMachine = machineTemplates[selectedMachineKey] || { name: `Custom Machine (${manualMachineCode})`, location: "Field Site", type: "General Equipment", checklist: [] };

  const handleMachineChange = (key: string) => {
    setSelectedMachineKey(key);
    setManualMachineCode(key);
    if (machineTemplates[key]) {
      setChecklist(machineTemplates[key].checklist);
      toast.success(`Loaded checklist for ${key}`, { description: machineTemplates[key].name });
    }
  };

  const handleManualCodeChange = (code: string) => {
    setManualMachineCode(code);
    const upperCode = code.trim().toUpperCase();
    if (machineTemplates[upperCode]) {
      setSelectedMachineKey(upperCode);
      setChecklist(machineTemplates[upperCode].checklist);
    }
  };

  return <><div className="workspace-header">
    <button className="back-btn" onClick={()=>go("inspections")}>← Inspections</button>
    <div className="workspace-title">
      <div><div className="eyebrow">INSPECTION / ACTIVE RECORD</div><h2>{activeInspectionId}</h2></div>
      <StatusChip status={status}/>
    </div>

    {/* Machine Selector & Manual Code Bar */}
    <div className="machine-selector-wrap">
      <span style={{fontSize:"11px",fontWeight:600,color:"#415662"}}>Select Machine:</span>
      <select className="machine-select" value={selectedMachineKey} onChange={e => handleMachineChange(e.target.value)}>
        <optgroup label="1. Transformers (TRF)">
          <option value="TRF-102">TRF-102 · Transformer T-102 (Substation A)</option>
          <option value="TRF-117">TRF-117 · Transformer T-117 (Substation B)</option>
          <option value="TRF-203">TRF-203 · Transformer T-203 (Substation C)</option>
          <option value="TRF-305">TRF-305 · Distribution Transformer T-305 (Feeder Yard 2)</option>
        </optgroup>
        <optgroup label="2. Pumps & Motors (PMP / MTR)">
          <option value="PMP-301">PMP-301 · Cooling Pump P-301 (Pump House 4)</option>
          <option value="PMP-302">PMP-302 · Boiler Feed Pump P-302 (Thermal Station 1)</option>
          <option value="MTR-105">MTR-105 · Induction Motor M-105 (Manali Plant)</option>
        </optgroup>
        <optgroup label="3. Generators & Turbines (GEN / TRB)">
          <option value="GEN-405">GEN-405 · Diesel Generator DG-405 (Power Plant 2)</option>
          <option value="GEN-502">GEN-502 · Gas Turbine Generator GT-502 (Basin Bridge)</option>
        </optgroup>
        <optgroup label="4. Switchgear & Breakers (SWG / CBK)">
          <option value="CBK-201">CBK-201 · Vacuum Circuit Breaker VCB-201 (Control Room A)</option>
          <option value="SWG-501">SWG-501 · Gas Insulated Switchgear GIS-501 (220kV GIS Bay)</option>
        </optgroup>
        <optgroup label="5. Renewables & Power Systems (SLR / BTY)">
          <option value="SLR-101">SLR-101 · Solar String Inverter INV-101 (Solar Farm 3)</option>
          <option value="BTY-202">BTY-202 · Battery Bank BTY-202 (DC Power Room)</option>
        </optgroup>
      </select>
      <span style={{fontSize:"11px",color:"#87949c",margin:"0 4px"}}>or Manual Machine Code:</span>
      <input className="machine-input" placeholder="e.g. TRF-102" value={manualMachineCode} onChange={e => handleManualCodeChange(e.target.value)} />
    </div>

    <div className="workspace-meta">
      <div><span>Machine</span><strong>{manualMachineCode || selectedMachineKey} · {activeMachine.name}</strong></div>
      <div><span>Site</span><strong>{activeMachine.location}</strong></div>
      <div><span>Connection</span><strong className={offline ? "offline-label" : "online-label"}>{offline ? <CloudOff size={14}/> : <Cloud size={14}/>} {offline ? "OFFLINE" : "ONLINE"}</strong></div>
    </div>
  </div>
  <div className="workspace-tabs">{["Overview","Checklist","Evidence","Remarks","History","Conflicts","Submission"].map(x=><button className={tab===x?"active":""} onClick={()=>setTab(x)} key={x}>{x}{x === "Conflicts" && !resolved && <em>1</em>}</button>)}</div>
  {tab === "Checklist" && <div className="workspace-grid"><section className="panel checklist-panel"><div className="checklist-heading"><div><div className="eyebrow">CHECKLIST / {selectedMachineKey} ROUTINE</div><h3>Equipment condition assessment ({activeMachine.name})</h3><p>Complete all required readings before submitting this inspection.</p></div><div className="progress-circle"><strong>{readinessPercent}%</strong><span>complete</span></div></div><div className="check-items">{checklist.map((item:any,i:number)=><div className="check-item" key={item.id + item.label}><div className="check-num">{item.id}</div><div className="check-label"><strong>{item.label}{item.required&&<b>*</b>}</strong><span>{item.helper}</span></div><div className="check-field"><input value={item.value} onChange={e=>saveEdit(i,e.target.value)}/>{(status === "SUBMITTED" || status === "APPROVED") && <CheckCircle2 size={16}/>}</div><MoreHorizontal size={17}/></div>)}<div className="remarks-field"><label>06 · Remarks <span>optional</span></label><textarea placeholder="Add field observations or remarks…" defaultValue="Minor surface dust observed. No action required."/></div></div><div className="checklist-footer"><span><LockKeyhole size={14}/> Required fields validated locally</span><button className="btn primary" onClick={onSubmitClick} disabled={status === "SUBMITTED" || status === "APPROVED"}>{status === "DRAFT" ? <><Send size={15}/> Submit for review</> : <><CheckCircle2 size={15}/> Submitted</>}</button></div></section><aside className="workspace-side"><section className="panel mini-panel"><PanelHeader title="Submission readiness" icon={<FileCheck2 size={16}/>} /><div className="readiness-meter"><div><strong>{readinessPercent}%</strong><span>{readinessPercent === 100 ? "Ready to submit" : `${filledCount} of ${totalCount} items completed`}</span></div><div className="meter"><i style={{width: `${readinessPercent}%`}}></i></div></div><div className="mini-check"><CheckCircle2 size={15}/> Checklist complete <span>{filledCount} / {totalCount}</span></div><div className={resolved?"mini-check":"mini-check warn"}>{resolved?<CheckCircle2 size={15}/>:<AlertTriangle size={15}/>} Critical conflicts {resolved?"Resolved":"1 unresolved"}</div></section><section className="panel mini-panel"><PanelHeader title="Field traceability" icon={<Link2 size={16}/>} /><div className="trace-row"><div className="avatar small">PR</div><div><strong>Pragatheesh</strong><span>Field Officer · EMP-1024</span></div></div><div className="trace-info"><span>Machine</span><strong className="mono">{manualMachineCode}</strong><span>Operation ID</span><strong className="mono">OP-7F31-A9C2</strong><span>Submitted At</span><strong>{submittedAt ? submittedAt : "Pending submission"}</strong></div></section></aside></div>}
  {tab === "Conflicts" && <Conflicts resolved={resolved} setResolved={(v:any)=>{setResolved(v);toast.success("Conflict resolved",{description:"Resolution appended to the audit trail."})}}/>}
  {tab === "History" && <HistoryPage/>}
  {tab === "Evidence" && <Evidence evidenceList={evidenceList} savedCount={savedCount} onCaptureEvidence={onCaptureEvidence} onDeleteEvidence={onDeleteEvidence} onSyncEvidence={onSyncEvidence} offline={offline}/>} 
  {tab === "Submission" && <Submission status={status} onSubmitClick={onSubmitClick}/>} 
  {tab === "Overview" && <Overview activeMachine={activeMachine} machineCode={manualMachineCode}/>}
  {tab === "Remarks" && <div className="empty-tab panel"><Sparkles size={20}/><h3>Remarks workspace</h3><p>Field notes, observations, and follow-up actions are protected locally.</p></div>}</>
}

function OfflineWorkspace({ go, refreshQueue, setInspectionsList, onSubmitted }: any) {
  const [offlineId] = useState(() => `INS-OFF-${Date.now().toString().slice(-4)}`);
  const [selectedMachine, setSelectedMachine] = useState("TRF-102");
  const [manualCode, setManualCode] = useState("TRF-102");
  const [checklist, setChecklist] = useState(() =>
    (machineTemplates["TRF-102"]?.checklist || []).map(x => ({ ...x }))
  );
  const [notes, setNotes] = useState(() => read("off2field-offline-notes", ""));
  const [photos, setPhotos] = useState<Array<{ id: string; name: string; dataUrl: string; timestamp: string }>>(() =>
    read("off2field-offline-photos", [])
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    persist("off2field-offline-notes", notes);
  }, [notes]);

  useEffect(() => {
    persist("off2field-offline-photos", photos);
  }, [photos]);

  const activeMachine = machineTemplates[selectedMachine] || {
    name: `Custom Machine (${manualCode})`,
    location: "Field Substation",
    type: "Field Equipment",
    category: "General",
    checklist: []
  };

  const handleMachineChange = (key: string) => {
    setSelectedMachine(key);
    setManualCode(key);
    if (machineTemplates[key]) {
      setChecklist(machineTemplates[key].checklist.map(x => ({ ...x })));
      toast.success(`Loaded latest checklist for ${key}`);
    }
  };

  const handleChecklistEdit = (index: number, val: string) => {
    setChecklist(prev => prev.map((item, idx) => idx === index ? { ...item, value: val } : item));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          const newPhoto = {
            id: `PHOTO-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: file.name || "machine_photo.jpg",
            dataUrl,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
          setPhotos(prev => [newPhoto, ...prev]);
          toast.success("Machine photo saved locally", { description: file.name });
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const removePhoto = (photoId: string) => {
    setPhotos(prev => prev.filter(p => p.id !== photoId));
    toast("Photo removed from local queue");
  };

  const filledCount = checklist.filter(x => x.value && x.value.trim() !== "").length;
  const totalCount = checklist.length;
  const percent = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 100;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const nowIso = new Date().toISOString();

    const record = {
      id: offlineId,
      machine: manualCode || selectedMachine,
      site: activeMachine.location || "Field Substation",
      status: "SUBMITTED",
      checklist,
      notes,
      images: photos,
      resolved: false,
      submittedAt: nowIso,
      syncStatus: "PENDING" as const,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    try {
      await saveInspection(record);
      await enqueueSyncItem({
        entityId: offlineId,
        entityName: `Inspection ${offlineId.slice(-4)}`,
        operationType: "SUBMIT_INSPECTION",
        title: `Offline Submit · ${manualCode || selectedMachine} (${photos.length} photos)`,
        machine: manualCode || selectedMachine,
        site: activeMachine.location || "Field Substation",
        status: "PENDING",
        payload: record,
      });
      if (refreshQueue) await refreshQueue();
      setInspectionsList((prev: any[]) => [
        {
          id: offlineId,
          machine: manualCode || selectedMachine,
          site: activeMachine.location?.split("·")[0]?.trim() || "Field Site",
          status: "SUBMITTED",
          priority: "HIGH",
          date: "Today",
          completion: "100%",
        },
        ...prev,
      ]);

      toast.success("Inspection submitted & stored locally!", {
        description: `Saved to IndexedDB (${photos.length} photos, ${checklist.length} checklist items). Queued for sync.`,
      });

      onSubmitted(offlineId);
    } catch (err) {
      console.error("Failed to store offline inspection in IndexedDB:", err);
      toast.error("Local storage error", { description: "Could not save to IndexedDB." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="workspace-header">
        <button className="back-btn" onClick={() => go("inspections")}>← All Inspections</button>
        <div className="workspace-title">
          <div>
            <div className="eyebrow" style={{color:"#f59e0b"}}>OFFLINE FIELD WORKSPACE · LOCAL STORAGE ONLY</div>
            <h2>{offlineId}</h2>
          </div>
          <span className="status-chip draft"><span></span>OFFLINE DRAFT</span>
        </div>

        {/* Machine selection */}
        <div className="machine-selector-wrap">
          <span style={{fontSize:"11px",fontWeight:600,color:"#415662"}}>Machine:</span>
          <select className="machine-select" value={selectedMachine} onChange={e => handleMachineChange(e.target.value)}>
            <optgroup label="1. Transformers (TRF)">
              <option value="TRF-102">TRF-102 · Transformer T-102 (Substation A)</option>
              <option value="TRF-117">TRF-117 · Transformer T-117 (Substation B)</option>
              <option value="TRF-203">TRF-203 · Transformer T-203 (Substation C)</option>
              <option value="TRF-305">TRF-305 · Distribution Transformer T-305 (Feeder Yard 2)</option>
            </optgroup>
            <optgroup label="2. Pumps & Motors (PMP / MTR)">
              <option value="PMP-301">PMP-301 · Cooling Pump P-301 (Pump House 4)</option>
              <option value="PMP-302">PMP-302 · Boiler Feed Pump P-302 (Thermal Station 1)</option>
              <option value="MTR-105">MTR-105 · Induction Motor M-105 (Manali Plant)</option>
            </optgroup>
            <optgroup label="3. Generators & Turbines (GEN / TRB)">
              <option value="GEN-405">GEN-405 · Diesel Generator DG-405 (Power Plant 2)</option>
              <option value="GEN-502">GEN-502 · Gas Turbine Generator GT-502 (Basin Bridge)</option>
            </optgroup>
            <optgroup label="4. Switchgear & Breakers (SWG / CBK)">
              <option value="CBK-201">CBK-201 · Vacuum Circuit Breaker VCB-201 (Control Room A)</option>
              <option value="SWG-501">SWG-501 · Gas Insulated Switchgear GIS-501 (220kV GIS Bay)</option>
            </optgroup>
            <optgroup label="5. Renewables & Power Systems (SLR / BTY)">
              <option value="SLR-101">SLR-101 · Solar String Inverter INV-101 (Solar Farm 3)</option>
              <option value="BTY-202">BTY-202 · Battery Bank BTY-202 (DC Power Room)</option>
            </optgroup>
          </select>
          <span style={{fontSize:"11px",color:"#87949c",margin:"0 4px"}}>or Custom Code:</span>
          <input className="machine-input" placeholder="e.g. TRF-102" value={manualCode} onChange={e => {
            setManualCode(e.target.value);
            const uc = e.target.value.trim().toUpperCase();
            if (machineTemplates[uc]) {
              setSelectedMachine(uc);
              setChecklist(machineTemplates[uc].checklist.map(x => ({ ...x })));
            }
          }} />
        </div>

        <div className="workspace-meta">
          <div><span>Target Asset</span><strong>{manualCode || selectedMachine} · {activeMachine.name}</strong></div>
          <div><span>Location</span><strong>{activeMachine.location}</strong></div>
          <div><span>Storage Target</span><strong className="online-label"><HardDrive size={14}/> IndexedDB (Dexie)</strong></div>
        </div>
      </div>

      <div className="workspace-grid">
        <section className="panel checklist-panel">
          <div className="checklist-heading">
            <div>
              <div className="eyebrow">OFFLINE ROUTINE / {selectedMachine}</div>
              <h3>Latest Equipment Assessment Checklist</h3>
              <p>Values pre-filled with latest parameters. Edit all observed readings on site.</p>
            </div>
            <div className="progress-circle"><strong>{percent}%</strong><span>ready</span></div>
          </div>

          <div className="check-items">
            {checklist.map((item, i) => (
              <div className="check-item" key={item.id + item.label}>
                <div className="check-num">{item.id}</div>
                <div className="check-label">
                  <strong>{item.label}{item.required && <b>*</b>}</strong>
                  <span>{item.helper}</span>
                </div>
                <div className="check-field">
                  <input
                    value={item.value}
                    placeholder="Enter reading..."
                    onChange={e => handleChecklistEdit(i, e.target.value)}
                  />
                  {item.value && <CheckCircle2 size={16} color="#10b981"/>}
                </div>
              </div>
            ))}
          </div>

          {/* Notes & Observations Section */}
          <div style={{marginTop:24,borderTop:"1px solid #e2e8f0",paddingTop:20}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <FileText size={16} color="#2563eb"/>
              <strong style={{fontSize:13,color:"var(--ink)"}}>Field Notes &amp; Observations</strong>
              <span style={{fontSize:10,background:"#f1f5f9",padding:"2px 6px",borderRadius:4,color:"#64748b"}}>Saved locally</span>
            </div>
            <textarea
              className="offline-notes-box"
              placeholder="Record equipment condition, abnormal sounds, oil leak observations, temperature anomalies, or notes for supervisor review..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {/* Machine Photos Upload Section */}
          <div style={{marginTop:24,borderTop:"1px solid #e2e8f0",paddingTop:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <Camera size={16} color="#2563eb"/>
                <strong style={{fontSize:13,color:"var(--ink)"}}>Machine Photos ({photos.length})</strong>
                <span style={{fontSize:10,background:"#dbeafe",padding:"2px 6px",borderRadius:4,color:"#1d4ed8",fontWeight:600}}>Device Storage</span>
              </div>
              <label className="btn secondary" style={{cursor:"pointer",padding:"5px 12px",fontSize:"12px"}}>
                <Upload size={14}/> Add Photo / Capture
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  onChange={handlePhotoUpload}
                  style={{display:"none"}}
                />
              </label>
            </div>

            {photos.length === 0 ? (
              <label className="photo-upload-trigger">
                <Camera size={28} strokeWidth={1.5}/>
                <span>Click or tap to capture/upload machine photos</span>
                <small style={{color:"#94a3b8"}}>Stored locally in browser device storage (IndexedDB)</small>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  onChange={handlePhotoUpload}
                />
              </label>
            ) : (
              <div className="offline-photo-grid">
                <label className="photo-upload-trigger" style={{minHeight:110}}>
                  <Camera size={24} strokeWidth={1.5}/>
                  <span>Add More</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={handlePhotoUpload}
                  />
                </label>
                {photos.map(p => (
                  <div className="photo-card" key={p.id}>
                    <img src={p.dataUrl} alt={p.name} />
                    <button
                      type="button"
                      className="photo-delete-btn"
                      title="Delete photo"
                      onClick={() => removePhoto(p.id)}
                    >
                      <Trash2 size={12}/>
                    </button>
                    <div className="photo-info">
                      <strong title={p.name}>{p.name}</strong>
                      <span>{p.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="checklist-footer" style={{marginTop:24}}>
            <span><LockKeyhole size={14}/> IndexedDB offline storage protected</span>
            <button
              className="btn primary"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              <Send size={15}/> {isSubmitting ? "Saving locally..." : "Submit Offline Inspection"}
            </button>
          </div>
        </section>

        <aside className="workspace-side">
          <section className="panel mini-panel">
            <PanelHeader title="Submission readiness" icon={<FileCheck2 size={16}/>} />
            <div className="readiness-mini">
              <div className="bar"><div><i style={{width:`${percent}%`}}></i></div><span>{percent}%</span></div>
              <small>{filledCount} of {totalCount} fields complete</small>
            </div>
          </section>

          <section className="panel mini-panel">
            <PanelHeader title="Offline Storage Specs" icon={<ShieldCheck size={16}/>} />
            <div className="trace-list">
              <div><span>Database</span><strong>Off2FieldDB (IndexedDB)</strong></div>
              <div><span>Storage Model</span><strong>Dexie 4.4</strong></div>
              <div><span>Pending Sync</span><strong className="amber-text">syncStatus = PENDING</strong></div>
              <div><span>Photos Attached</span><strong>{photos.length} captured</strong></div>
              <div><span>Connection</span><strong className="danger-text"><CloudOff size={13}/> Disconnected</strong></div>
            </div>
          </section>

          <section className="panel mini-panel">
            <PanelHeader title="Equipment Specs" icon={<Cog size={16}/>} />
            <div className="trace-list">
              <div><span>Category</span><strong>{activeMachine.category}</strong></div>
              <div><span>Type</span><strong>{activeMachine.type}</strong></div>
              <div><span>Location</span><strong>{activeMachine.location}</strong></div>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

function Overview({ activeMachine, machineCode }: any){ return <div className="overview-grid"><div className="panel overview-hero"><div className="machine-illustration"><div className="transformer"><span></span><span></span><span></span></div></div><div><div className="eyebrow">MACHINE PROFILE</div><h3>{machineCode || "TRF-102"} · {activeMachine?.name || "Transformer T-102"}</h3><p>{activeMachine?.type || "Operational equipment"} · Installed 2018</p><div className="overview-tags"><span>{activeMachine?.location || "Substation A"}</span><span>Last inspected 18 Sep 2026</span></div></div></div><div className="panel"><PanelHeader title="Previous readings" icon={<History size={16}/>} /><div className="reading-grid">{[["Primary parameter","72 °C","18 Sep"],["Secondary parameter","84 %","18 Sep"],["Load current","184 A","18 Sep"],["Condition","Normal","18 Sep"]].map(x=><div key={x[0]}><span>{x[0]}</span><strong>{x[1]}</strong><small>{x[2]}</small></div>)}</div></div></div>}
function Submission({status, onSubmitClick}:any){return <div className="submission-grid"><section className="panel submission-panel"><div className="eyebrow">APPROVAL WORKFLOW</div><h3>Inspection lifecycle</h3><div className="workflow">{["DRAFT","SUBMITTED","UNDER REVIEW","APPROVED"].map((x,i)=><div className={(status===x||["SUBMITTED","UNDER REVIEW","APPROVED"].indexOf(status)>i)?"step done":"step"} key={x}><div>{(["SUBMITTED","UNDER REVIEW","APPROVED"].indexOf(status)>i||status===x)?<Check size={15}/>:i+1}</div><span>{x}</span></div>)}</div><div className="submission-note"><ShieldCheck size={18}/><div><strong>Traceable submission</strong><p>Submitting creates an append-only audit event and queues the package for supervisor review.</p></div></div><button className="btn primary" onClick={onSubmitClick} disabled={status === "SUBMITTED" || status === "APPROVED"}><Send size={15}/> {status === "DRAFT" ? "Submit inspection" : "Inspection Submitted"}</button></section><section className="panel"><PanelHeader title="Validation summary" icon={<CheckCircle2 size={16}/>} />{["All required checklist values present","Evidence package attached","No critical conflicts","Local changes synchronized"].map((x,i)=><div className="validation-row" key={x}><CheckCircle2 size={16}/><span>{x}</span><small>{i===3?"Pending":"Passed"}</small></div>)}</section></div>}

function Machines({go, startNewInspection, onOpenScanner}:any){
  const machinesList = Object.entries(machineTemplates).map(([code, data]) => [
    code,
    data.name,
    data.location.split("·")[0].trim(),
    "Operational",
    data.type,
    data.category,
    "green"
  ]);

  return (
    <>
      <PageIntro
        eyebrow="ASSET REGISTER / MACHINES"
        title="Field Equipment Registry"
        description="High-voltage power transformers, switchgear, generators, and solar inverters cached offline."
        actions={
          <button className="btn primary" onClick={() => onOpenScanner ? onOpenScanner() : go("scanner")}>
            <QrCode size={16}/> Scan machine QR
          </button>
        }
      />
      <div className="machine-grid">
        {machinesList.map(x => (
          <button
            className="machine-card panel machine-card-faded"
            key={x[0]}
            onClick={() => startNewInspection(x[0])}
          >
            <div className="machine-card-overlay"></div>
            <div className="machine-top">
              <div className="machine-icon"><Cog size={20}/></div>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <span className="machine-category-pill">{x[5]}</span>
                <StatusChip status="APPROVED"/>
              </div>
            </div>
            <div className="machine-content-wrap">
              <div className="eyebrow mono" style={{color:"#38bdf8",fontWeight:700}}>{x[0]}</div>
              <h3 style={{color:"#ffffff",fontSize:14,fontWeight:700,margin:"4px 0 2px"}}>{x[1]}</h3>
              <p style={{color:"#cbd5e1",fontSize:11,margin:"0 0 16px"}}>{x[2]}</p>
              <div className="machine-footer" style={{borderTop:"1px solid rgba(255,255,255,0.12)",paddingTop:10}}>
                <span style={{color:"#93c5fd",fontSize:10}}>{x[4]}</span>
                <span style={{color:"#38bdf8",fontWeight:600}}>Start Inspection <ChevronRight size={13}/></span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

function Scanner({go, startNewInspection, onOpenLiveScanner}:any){
  const [scanned,setScanned]=useState(false); 
  return (
    <>
      <PageIntro
        eyebrow="FIELD TOOLS / IDENTIFICATION"
        title="Live QR Scanner"
        description="Identify equipment on-site via QR code label using device camera, even offline."
        actions={<span className="ready-chip"><span></span> Live Camera Ready</span>}
      />
      <div className="scanner-layout">
        <section className="panel scanner-panel">
          <div className="scanner-frame">
            <div className="scan-corner tl"></div>
            <div className="scan-corner tr"></div>
            <div className="scan-corner bl"></div>
            <div className="scan-corner br"></div>
            <div className="scan-line"></div>
            <QrCode size={78} strokeWidth={1}/>
          </div>
          <p style={{marginBottom:14}}>Point Android/device camera at machine QR tag for instant lookup</p>
          <div style={{display:"flex",flexDirection:"column",gap:10,maxWidth:320,margin:"0 auto"}}>
            <button
              className="btn primary"
              style={{height:42,fontSize:13,justifyContent:"center"}}
              onClick={() => onOpenLiveScanner ? onOpenLiveScanner() : toast.info("Opening scanner...")}
            >
              <Camera size={17}/> Launch Camera QR Scanner
            </button>
            <button
              className="btn secondary"
              style={{justifyContent:"center"}}
              onClick={() => {
                setScanned(true);
                toast.success("Machine identified", { description: "TRF-102 found in offline machine cache." });
              }}
            >
              <QrCode size={15}/> Quick Test · TRF-102
            </button>
          </div>
        </section>

        {scanned ? (
          <section className="panel machine-result">
            <div className="result-badge"><CheckCircle2 size={16}/> MACHINE FOUND OFFLINE</div>
            <div className="eyebrow">MACHINE RECORD</div>
            <h3>TRF-102 · Transformer T-102</h3>
            <p>Substation A · Chennai North</p>
            <div className="result-list">
              <div><span>Status</span><strong className="online-label"><span className="status-dot"></span> Operational</strong></div>
              <div><span>Category</span><strong>Transformers (132/33 kV)</strong></div>
              <div><span>Last inspection</span><strong>18 Sep 2026</strong></div>
              <div><span>Checklist template</span><strong>6 baseline parameters cached</strong></div>
              <div><span>QR identifier</span><strong className="mono">TRF-102</strong></div>
            </div>
            <div className="result-actions">
              <button className="btn primary" onClick={() => startNewInspection("TRF-102")}>Start inspection <ArrowRight size={15}/></button>
              <button className="btn secondary" onClick={() => go("history")}>View history</button>
            </div>
          </section>
        ) : (
          <section className="panel scanner-help">
            <QrCode size={34}/>
            <h3>Instant Offline Machine Identification</h3>
            <p>All 14 equipment records and baseline parameters are cached in Dexie IndexedDB. Scanning immediately starts the routine without requiring network access.</p>
          </section>
        )}
      </div>
    </>
  );
}

function BlobImagePreview({ blob, dataUrl, alt }: { blob?: Blob; dataUrl?: string; alt: string }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (blob) {
      const url = URL.createObjectURL(blob);
      setObjectUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else if (dataUrl) {
      setObjectUrl(dataUrl);
    } else {
      setObjectUrl(null);
    }
  }, [blob, dataUrl]);

  if (!objectUrl) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100%", color: "#64748b" }}>
        <ImageIcon size={32} />
      </div>
    );
  }

  return (
    <img
      src={objectUrl}
      alt={alt}
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
}

function EvidenceLightboxModal({
  item,
  onClose,
  chipClass,
  chipLabel,
  fmtSize,
}: any) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (item.blob) {
      const url = URL.createObjectURL(item.blob);
      setObjectUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else if (item.dataUrl) {
      setObjectUrl(item.dataUrl);
    }
  }, [item]);

  return (
    <div className="evidence-lightbox-backdrop" onClick={onClose}>
      <div className="evidence-lightbox-modal" onClick={(e) => e.stopPropagation()}>
        <div className="evidence-lightbox-header">
          <div>
            <strong style={{ fontSize: 13 }}>{item.fileName || item.description || item.title || item.name}</strong>
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 3 }}>
              {item.id} · {item.inspectionId}
            </div>
          </div>
          <button className="evidence-icon-btn" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
        <div className="evidence-lightbox-body">
          {objectUrl ? (
            <img src={objectUrl} alt={item.fileName || item.description} className="evidence-lightbox-img" />
          ) : (
            <div style={{ color: "#64748b", textAlign: "center" }}>
              <FileText size={48} />
              <p>No preview</p>
            </div>
          )}
        </div>
        <div className="evidence-lightbox-footer">
          <span>
            {item.fileType || item.mimeType || "image/jpeg"} · {fmtSize(item.fileSize || item.size || 0)}
          </span>
          <span className={chipClass(item.syncStatus)} style={{ position: "static", boxShadow: "none" }}>
            {chipLabel(item.syncStatus)}
          </span>
        </div>
      </div>
    </div>
  );
}

function Evidence({
  evidenceList = [],
  savedCount,
  onCaptureEvidence,
  onOpenLiveCamera,
  onDeleteEvidence,
  onSyncEvidence,
  offline
}: any) {
  const [lightbox, setLightbox] = useState<any>(null);
  const [showAllRefs, setShowAllRefs] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const items: any[] = Array.isArray(evidenceList) ? evidenceList : [];
  const pendingItems = items.filter((x: any) => x.syncStatus === "PENDING" || x.syncStatus === "FAILED");
  const syncedItems = items.filter((x: any) => x.syncStatus === "SYNCED");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    for (const file of Array.from(e.target.files || [])) {
      if (onCaptureEvidence) await onCaptureEvidence({ file });
    }
    e.target.value = "";
  };

  const chipClass = (s: string) => s === "SYNCED" ? "evidence-chip-status synced" : s === "SYNCING" ? "evidence-chip-status syncing" : s === "FAILED" ? "evidence-chip-status failed" : "evidence-chip-status pending";
  const chipLabel = (s: string) => s === "SYNCED" ? "✓ Synced to Cloud" : s === "SYNCING" ? "↑ Uploading…" : s === "FAILED" ? "✕ Failed" : "● Stored in Dexie (Pending)";
  const fmtSize = (b: number) => b > 1048576 ? `${(b/1048576).toFixed(1)} MB` : `${Math.round(b/1024)} KB`;
  const fmtTime = (iso: string) => { try { return new Date(iso).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}); } catch { return "—"; } };

  return (
    <>
      <PageIntro
        eyebrow="INSPECTION / EVIDENCE"
        title="Evidence & Reference Hub"
        description="Offline-first photo capture stored in IndexedDB first, with automatic background sync to Firebase Storage & Firestore."
        actions={
          <>
            <button className="btn secondary" onClick={() => fileInputRef.current?.click()}>
              <ImageIcon size={14}/> Select Device Photo
            </button>
            <button className="btn primary" onClick={() => onOpenLiveCamera ? onOpenLiveCamera() : fileInputRef.current?.click()}>
              <Camera size={15}/> Capture Live Photo
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={handleFileChange}/>
          </>
        }
      />

      {/* ── 1. MACHINE REFERENCE SECTION (Prompt Requirement 5) ── */}
      <div style={{marginBottom:24}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:1}}>
            1. Official Equipment Reference Diagrams (Visual Inspection Aid)
          </div>
          <button
            className="text-btn"
            style={{fontSize:11}}
            onClick={() => setShowAllRefs(v => !v)}
          >
            {showAllRefs ? "Show Active Category Only" : "View All 5 Categories"}
          </button>
        </div>
        <MachineReferenceGuides category="Transformers" showAll={showAllRefs} />
      </div>

      {/* ── 2. USER UPLOADED EVIDENCE SECTION ── */}
      <div style={{marginTop:28}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:1}}>
              2. On-Site Field Evidence ({items.length} records)
            </div>
            <p style={{fontSize:11,color:"#64748b",margin:"2px 0 0"}}>
              Photos captured on-site and stored in Dexie IndexedDB. Syncs to Firebase when online.
            </p>
          </div>
        </div>

        <div className="evidence-summary">
          <div><HardDrive size={17}/><span>Stored in IndexedDB</span><strong>{String(items.length).padStart(2,"0")} items</strong></div>
          <div><Upload size={17}/><span>Pending upload</span><strong>{String(pendingItems.length).padStart(2,"0")} items</strong></div>
          <div><CheckCircle2 size={17}/><span>Synced to Firebase</span><strong>{String(syncedItems.length).padStart(2,"0")} items</strong></div>
        </div>

        {items.length === 0 && (
          <div className="empty-tab panel" style={{marginTop:0}}>
            <Archive size={22}/>
            <h3>No field photos captured yet</h3>
            <p>Tap "Capture Live Photo" to take a snapshot with the camera or upload an image file.</p>
            <button
              className="btn primary"
              style={{marginTop:12}}
              onClick={() => onOpenLiveCamera ? onOpenLiveCamera() : fileInputRef.current?.click()}
            >
              <Camera size={15}/> Take First Field Photo
            </button>
          </div>
        )}

        {items.length > 0 && (
          <div className="evidence-grid">
            {items.map((ev: any) => (
              <div className="evidence-card" key={ev.id}>
                <div className="evidence-preview-wrap" onClick={() => setLightbox(ev)}>
                  <BlobImagePreview blob={ev.blob} dataUrl={ev.dataUrl} alt={ev.fileName || ev.description || ev.title} />
                  <div className="evidence-preview-overlay"><Eye size={14}/> Full Preview</div>
                  <span className={chipClass(ev.syncStatus)}>{chipLabel(ev.syncStatus)}</span>
                  <span className="evidence-meta-pill">{ev.category || "PHOTO"}</span>
                </div>
                <div className="evidence-card-content">
                  <div className="evidence-card-title">{ev.fileName || ev.description || ev.title || ev.name}</div>
                  <div className="evidence-card-sub">{ev.id} · {ev.inspectionId || "—"}</div>
                  <div className="evidence-card-footer">
                    <span style={{fontSize:9,color:"#64748b",fontFamily:"'DM Mono',monospace"}}>
                      {fmtSize(ev.fileSize || ev.size || 0)} · {fmtTime(ev.createdAt)}
                    </span>
                    <div className="evidence-btn-group">
                      {(ev.syncStatus === "PENDING" || ev.syncStatus === "FAILED") && !offline && (
                        <button className="evidence-icon-btn" title="Sync now to Firebase" onClick={() => onSyncEvidence?.(ev)}>
                          <Upload size={12}/>
                        </button>
                      )}
                      <button className="evidence-icon-btn danger" title="Delete locally" onClick={() => onDeleteEvidence?.(ev.id)}>
                        <Trash2 size={12}/>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {lightbox && (
        <EvidenceLightboxModal
          item={lightbox}
          onClose={() => setLightbox(null)}
          chipClass={chipClass}
          chipLabel={chipLabel}
          fmtSize={fmtSize}
        />
      )}
    </>
  );
}

function SyncCenter({
  queueItems,
  pendingCount,
  sync,
  syncSingleItem,
  enqueueTestOperation,
  clearCompleted,
  resetDefaultQueue,
  isSyncing,
  offline
}: any) {
  const [expandedPayloads, setExpandedPayloads] = useState<Record<string, boolean>>({});
  const togglePayload = (id: string) => {
    setExpandedPayloads(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const items = Array.isArray(queueItems) ? queueItems : [];
  const syncedItems = items.filter(x => x.status === "SYNCED");
  const failedItems = items.filter(x => x.status === "FAILED");

  return (
    <>
      <PageIntro
        eyebrow="RELIABILITY / PERSISTENT INDEXEDDB QUEUE"
        title="Sync center"
        description="Every local operation is persisted in IndexedDB, traceable, and synced sequentially."
        actions={
          <>
            <button className="btn secondary" onClick={enqueueTestOperation} title="Add real operation to IndexedDB queue">
              <Upload size={14} /> Enqueue inspection
            </button>
            <button
              className="btn primary"
              onClick={sync}
              disabled={isSyncing || offline || pendingCount === 0}
              style={(isSyncing || offline || pendingCount === 0) ? { opacity: 0.65, cursor: "not-allowed" } : {}}
            >
              <RefreshCw size={15} style={isSyncing ? { animation: "spin 1s linear infinite" } : {}} />
              {isSyncing ? "Syncing queue…" : `Sync now (${pendingCount})`}
            </button>
          </>
        }
      />

      {offline && (
        <div style={{ background: "#fff7ed", border: "1px solid #f59e0b", borderRadius: 10, padding: "12px 18px", display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
          <CloudOff size={16} color="#d97706" />
          <span style={{ fontSize: 13, color: "#92400e" }}>
            <strong>Device is offline.</strong> Operations remain safely stored in IndexedDB (Dexie). Sync will resume automatically when connection is restored.
          </span>
        </div>
      )}

      <div className="sync-cards">
        <div className={pendingCount > 0 ? "sync-stat danger-card" : "sync-stat"}>
          <span>Pending sync</span>
          <strong>{pendingCount < 10 ? `0${pendingCount}` : pendingCount}</strong>
          <small>{pendingCount === 0 ? "All caught up" : "Queued in IndexedDB"}</small>
        </div>
        <div className="sync-stat">
          <span>Total in queue</span>
          <strong>{items.length < 10 ? `0${items.length}` : items.length}</strong>
          <small>IndexedDB operations</small>
        </div>
        <div className="sync-stat">
          <span>Synced today</span>
          <strong>{syncedItems.length < 10 ? `0${syncedItems.length}` : syncedItems.length}</strong>
          <small>Cloud verified</small>
        </div>
        <div className={failedItems.length > 0 ? "sync-stat danger-card" : "sync-stat"}>
          <span>Failed retries</span>
          <strong>{failedItems.length < 10 ? `0${failedItems.length}` : failedItems.length}</strong>
          <small>{failedItems.length > 0 ? "Needs retry" : "Healthy queue"}</small>
        </div>
      </div>

      {/* ── Visual Sync Queue Tree ── */}
      <div className="sync-tree-card">
        <div className="sync-tree-header">
          <div className="sync-tree-title">
            <RefreshCw size={17} style={isSyncing ? { animation: "spin 1s linear infinite" } : {}} color="#0284c7" />
            <h3>Persistent Sync Queue</h3>
            <span className="tree-meta-pill" style={{ background: "#e0f2fe", color: "#0369a1", fontWeight: 700 }}>
              {pendingCount} PENDING
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn secondary" onClick={resetDefaultQueue} title="Reset demo operations (Inspection A, B, C)">
              <History size={14} /> Reset Demo Queue
            </button>
            {syncedItems.length > 0 && (
              <button className="btn secondary" onClick={clearCompleted} title="Remove synced items from IndexedDB">
                <Trash2 size={14} /> Clear Synced
              </button>
            )}
          </div>
        </div>

        <div className="sync-tree-container">
          <div className="sync-tree-root">
            <div className="sync-tree-root-dot"></div>
            <span>Sync Queue</span>
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 400 }}>
              (Dexie IndexedDB: Off2FieldDB · {items.length} operations stored)
            </span>
          </div>

          {items.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "var(--muted)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={32} color="#10b981" />
              <strong style={{ color: "var(--ink)", fontSize: 14 }}>Queue is empty</strong>
              <p style={{ fontSize: 12, margin: 0 }}>All operations are synced. No pending operations stored in IndexedDB.</p>
              <button className="btn primary" onClick={resetDefaultQueue} style={{ marginTop: 8 }}>
                Seed Default Queue (Inspection A, B, C)
              </button>
            </div>
          ) : (
            items.map((item: any, index: number) => {
              const isLast = index === items.length - 1;
              const connectorSymbol = isLast ? "└──" : "├──";
              const isExpanded = !!expandedPayloads[item.id];

              return (
                <div key={item.id} className={`sync-tree-branch ${item.status === "SYNCING" ? "is-syncing" : ""}`}>
                  <div className="sync-tree-row">
                    <span className="tree-connector">{connectorSymbol}</span>
                    <div className="tree-node-content">
                      <div className="tree-node-left">
                        <span className="tree-entity-name">{item.entityName}</span>
                        <span className="tree-arrow">→</span>
                        <span className={`tree-status-badge ${item.status.toLowerCase()}`}>
                          {item.status === "SYNCING" && <RefreshCw size={11} style={{ animation: "spin 1s linear infinite" }} />}
                          {item.status === "SYNCED" && <Check size={11} />}
                          {item.status === "FAILED" && <AlertTriangle size={11} />}
                          {item.status === "PENDING" && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b" }}></span>}
                          {item.status}
                        </span>
                        <span className="tree-meta-pill">{item.machine || "General"}</span>
                        <span className="tree-op-title">{item.title}</span>
                      </div>

                      <div className="tree-node-actions">
                        <span className="tree-time">
                          {item.updatedAt ? new Date(item.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
                        </span>
                        <button
                          className="tree-action-btn"
                          onClick={() => togglePayload(item.id)}
                          title="Inspect locally stored Dexie payload"
                        >
                          {isExpanded ? <EyeOff size={12} /> : <Eye size={12} />}
                          {isExpanded ? "Hide" : "Payload"}
                        </button>
                        {(item.status === "PENDING" || item.status === "FAILED") && (
                          <button
                            className="tree-action-btn"
                            onClick={() => syncSingleItem(item.id)}
                            disabled={item.status === "SYNCING" || offline}
                            style={{ color: "#0284c7" }}
                            title="Sync this operation to cloud"
                          >
                            <RefreshCw size={12} /> Sync
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="payload-accordion">
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#94a3b8", fontSize: 10 }}>
                        <span>IndexedDB Record: {item.id}</span>
                        <span>Operation: {item.operationType}</span>
                      </div>
                      <pre className="payload-code">{JSON.stringify(item.payload, null, 2)}</pre>
                      {item.lastError && (
                        <div style={{ marginTop: 6, color: "#f87171", fontSize: 10 }}>
                          <strong>Last Error:</strong> {item.lastError} (Retries: {item.retryCount})
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Persistent Queue Details Panel ── */}
      <section className="panel queue-panel">
        <PanelHeader title={`IndexedDB Queue Register (${items.length} records)`} icon={<History size={16}/>} action={<StatusChip status={pendingCount > 0 ? "DRAFT" : "APPROVED"}/>}/>
        <div className="queue-row queue-head"><span>Operation ID</span><span>Entity</span><span>Type</span><span>Status</span><span>Timestamp</span><span></span></div>
        {items.map((r: any) => (
          <div className="queue-row" key={r.id}>
            <strong className="mono">{r.id}</strong>
            <span>{r.entityName} ({r.entityId})</span>
            <span style={{ fontSize: 10, color: "#475569" }}>{r.operationType}</span>
            <span className={`tree-status-badge ${r.status.toLowerCase()}`} style={{ padding: "2px 8px", fontSize: 10 }}>{r.status}</span>
            <span>{r.updatedAt ? new Date(r.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</span>
            <button className="tree-action-btn" onClick={() => togglePayload(r.id)} style={{ padding: "2px 6px" }}>
              <Eye size={12}/>
            </button>
          </div>
        ))}
      </section>
    </>
  );
}
function Conflicts({resolved,setResolved}:any){return <><PageIntro eyebrow="TRACEABILITY / CONFLICT CENTER" title="Conflict resolution" description="Competing offline edits are surfaced for an explicit, auditable decision." actions={!resolved&&<span className="risk-chip"><AlertTriangle size={14}/> 1 critical conflict</span>}/>{resolved?<div className="resolved-banner panel"><div className="resolved-icon"><Check size={21}/></div><div><div className="eyebrow">CONFLICT RESOLVED</div><h3>CON-2026-00001 · Final value 80 °C</h3><p>Resolved by Pragatheesh · 22 Sep 2026, 11:02 · Reason recorded in audit trail.</p></div><StatusChip status="APPROVED"/></div>:<div className="conflict-layout"><section className="panel conflict-panel"><div className="conflict-top"><div><div className="eyebrow">CONFLICT DETECTED · CON-2026-00001</div><h3>Oil temperature has competing offline values</h3><p>Inspection INS-2026-TN-0001 · Checklist item 02 · Detected at 10:44</p></div><span className="critical-chip">CRITICAL RISK</span></div><div className="version-grid"><div className="version-card"><div className="version-head"><span>VERSION A</span><small>Officer A · DEV-0001</small></div><strong>78 °C</strong><p>Captured at 10:41 · Chennai North</p><button className="btn secondary" onClick={()=>setResolved(true)}>Accept Version A</button></div><div className="versus">VS</div><div className="version-card alt"><div className="version-head"><span>VERSION B</span><small>Officer B · DEV-0018</small></div><strong>83 °C</strong><p>Captured at 10:43 · Chennai North</p><button className="btn secondary" onClick={()=>setResolved(true)}>Accept Version B</button></div></div><div className="resolution-footer"><div><LockKeyhole size={15}/><span>A resolution reason is required and will be appended to the audit trail.</span></div><button className="btn primary" onClick={()=>setResolved(true)}><CheckCircle2 size={15}/> Resolve with final value</button></div></section><aside className="panel conflict-context"><PanelHeader title="Conflict context" icon={<AlertTriangle size={16}/>} />{[["Field","Oil temperature"],["Machine","TRF-102"],["Users","Pragatheesh · Priya S."],["Devices","DEV-0001 · DEV-0018"],["State","Unresolved"],["Sync batch","BATCH-09-22-1044"]].map(x=><div className="context-row" key={x[0]}><span>{x[0]}</span><strong>{x[1]}</strong></div>)}</aside></div>}</>}
function HistoryPage(){return <><PageIntro eyebrow="TRACEABILITY / TIME MACHINE" title="Inspection history" description="A chronological record of every meaningful state change." actions={<button className="btn secondary"><Download size={15}/> Export history</button>}/><section className="panel history-panel"><div className="history-head"><div><strong>INS-2026-TN-0001</strong><span>TRF-102 · Substation A</span></div><StatusChip status="UNDER REVIEW"/></div><div className="history-timeline">{[["10:00","Inspection created","Pragatheesh","Draft created from assignment","blue"],["10:41","Temperature updated","Pragatheesh · DEV-0001","72 °C → 78 °C","amber"],["10:43","Temperature updated","Priya S. · DEV-0018","72 °C → 83 °C","purple"],["10:44","Conflict detected","Sync engine","Competing values require resolution","red"],["11:02","Supervisor resolved","Meera Nair","Final value: 80 °C","green"]].map(x=><div className="history-event" key={x[0]}><time>{x[0]}</time><div className={"history-marker " + x[4]}></div><div><strong>{x[1]}</strong><span>{x[2]}</span><p>{x[3]}</p></div><ChevronRight size={16}/></div>)}</div></section></>}
function Reports(){return <><PageIntro eyebrow="COMPLIANCE / REPORTING" title="Reports" description="Generate official, PDF-ready views from locally available inspection records." actions={<button className="btn primary" onClick={()=>toast.success("Report ready",{description:"PDF-ready preview generated locally."})}><FileText size={15}/> Generate report</button>}/><div className="report-grid">{[["Inspection report","A complete field inspection record","12 records","FileCheck2"],["Machine history","Equipment readings over time","4 machines","History"],["Audit report","Append-only event export","86 events","FileClock"],["Conflict report","Resolution and risk register","1 conflict","AlertTriangle"],["Evidence report","Photo metadata and integrity","20 items","Archive"],["Compliance report","Department readiness summary","Q3 2026","ShieldCheck"]].map(x=><button className="report-card panel" key={x[0]} onClick={()=>toast("Report preview opened",{description:x[0]})}><div className="report-icon"><FileText size={19}/></div><div><h3>{x[0]}</h3><p>{x[1]}</p><span>{x[2]}</span></div><ArrowRight size={16}/></button>)}</div></>}
function Audit(){return <><PageIntro eyebrow="SECURITY / APPEND-ONLY LOG" title="Audit trail" description="Every create, edit, submit, approve, and conflict action is preserved." actions={<button className="btn secondary"><Download size={15}/> Export CSV</button>}/><section className="panel audit-panel"><div className="toolbar compact"><div className="searchbox"><Search size={16}/><input placeholder="Search operation ID, user, or action"/></div><button className="btn secondary"><Filter size={15}/> All actions</button><button className="btn secondary">Last 30 days</button></div><div className="audit-table"><div className="audit-row audit-head"><span>Timestamp</span><span>User / role</span><span>Action</span><span>Field</span><span>Operation ID</span></div>{[["22 Sep · 11:02","Meera Nair · Supervisor","Conflict resolved","Oil temperature","OP-RES-9921"],["22 Sep · 10:44","Sync engine · System","Conflict created","Oil temperature","OP-CON-7F31"],["22 Sep · 10:43","Pragatheesh · Officer","Photo added","Evidence","OP-EVD-0002"],["22 Sep · 10:41","Pragatheesh · Officer","Edit","Oil temperature","OP-7F31-A9C2"],["22 Sep · 10:00","Pragatheesh · Officer","Create","Inspection","OP-INS-0001"]].map(x=><div className="audit-row" key={x[4]}><span>{x[0]}</span><strong>{x[1]}</strong><StatusChip status={x[2] === "Conflict resolved" ? "APPROVED" : "UNDER REVIEW"}/><span>{x[3]}</span><span className="mono">{x[4]}</span></div>)}</div></section></>}
function Admin(){return <><PageIntro eyebrow="ADMINISTRATION / CONTROL PLANE" title="Admin console" description="Manage users, roles, machines, templates, devices, and schema versions." actions={<button className="btn primary" onClick={()=>toast("Admin action ready")}> <Users size={15}/> Add user</button>}/><div className="admin-grid">{[["Users & roles","18 users · 4 roles","Users"],["Machine registry","48 registered assets","Cog"],["Inspection templates","06 active templates","ClipboardCheck"],["Devices","22 managed devices","Smartphone"],["Schema versions","v1.8 current","Database"],["System settings","RBAC · security · sync","Settings2"]].map(x=><button className="admin-card panel" key={x[0]} onClick={()=>toast("Admin module opened",{description:x[0]})}><div className="admin-icon"><Settings2 size={18}/></div><div><h3>{x[0]}</h3><p>{x[1]}</p></div><ChevronRight size={16}/></button>)}</div><section className="panel security-strip"><ShieldCheck size={20}/><div><strong>Security posture</strong><span>JWT-ready architecture · HTTPS/WSS boundary · append-only audit model · no secrets in frontend</span></div><span className="ready-chip"><span></span> Healthy</span></section></>}
