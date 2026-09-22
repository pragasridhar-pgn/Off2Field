import { useEffect, useState, FormEvent } from "react";
import {
  Activity, AlertTriangle, Archive, ArrowRight, BarChart3, Bell, Check, CheckCircle2, ChevronRight, ClipboardCheck, Cloud, CloudOff, Clock3, Cog, Download, Eye, EyeOff, FileBarChart, FileCheck2, FileClock, FileText, Filter, HardDrive, History, Home, Link2, ListChecks, LogOut, LockKeyhole, Menu, MoreHorizontal, QrCode, RefreshCw, Search, Send, Settings2, ShieldCheck, Smartphone, SlidersHorizontal, Sparkles, Table2, Upload, Users, Wifi, X
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { auth, db } from "./lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

type NavKey = "dashboard" | "inspections" | "workspace" | "machines" | "scanner" | "evidence" | "sync" | "conflicts" | "history" | "reports" | "audit" | "admin";
type Status = "DRAFT" | "SUBMITTED" | "UNDER REVIEW" | "APPROVED";
type Role = "inspector" | "admin";

const nav = [
  { key: "dashboard", label: "Dashboard", icon: Home }, { key: "inspections", label: "My Inspections", icon: ClipboardCheck },
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
  const [role, setRole] = useState<Role | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [page, setPage] = useState<NavKey>("dashboard");
  const [offline, setOffline] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [savedCount, setSavedCount] = useState(() => read("off2field-pending", 2));
  const [inspectionStatus, setInspectionStatus] = useState<Status>(() => read("off2field-status", "DRAFT"));
  const [selectedMachineKey, setSelectedMachineKey] = useState("TRF-102");
  const [manualMachineCode, setManualMachineCode] = useState("TRF-102");
  const [activeInspectionId, setActiveInspectionId] = useState("INS-2026-TN-0001");
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [checklist, setChecklist] = useState(() => machineTemplates["TRF-102"].checklist);
  const [resolved, setResolved] = useState(() => read("off2field-resolved", false));
  const [showSubmittedModal, setShowSubmittedModal] = useState(false);
  const [inspectionsList, setInspectionsList] = useState([
    { id: "INS-2026-TN-0001", machine: "TRF-102", site: "Substation A", status: "DRAFT", priority: "HIGH", date: "23 Sep 2026", completion: "68%" },
    { id: "INS-2026-TN-0002", machine: "TRF-117", site: "Substation B", status: "SUBMITTED", priority: "MEDIUM", date: "21 Sep 2026", completion: "100%" },
    { id: "INS-2026-TN-0003", machine: "PMP-301", site: "Pump House 4", status: "UNDER REVIEW", priority: "LOW", date: "20 Sep 2026", completion: "100%" },
    { id: "INS-2026-TN-0004", machine: "TRF-203", site: "Substation C", status: "APPROVED", priority: "MEDIUM", date: "18 Sep 2026", completion: "100%" },
  ]);

  // ── Firebase auth state listener ──────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const snap = await getDoc(doc(db, "users", fbUser.uid));
          if (snap.exists()) {
            const r = snap.data().role as Role;
            setRole(r);
            setPage(r === "admin" ? "reports" : "dashboard");
          } else {
            // Firestore doc missing — treat as logged out
            await signOut(auth);
            setRole(null);
          }
        } catch {
          setRole(null);
        }
      } else {
        setRole(null);
      }
      setAuthReady(true);
    });
    return unsub;
  }, []);

  useEffect(() => { persist("off2field-pending", savedCount); }, [savedCount]);
  useEffect(() => { persist("off2field-status", inspectionStatus); }, [inspectionStatus]);
  useEffect(() => { persist("off2field-checklist", checklist); }, [checklist]);
  useEffect(() => { persist("off2field-resolved", resolved); }, [resolved]);
  useEffect(() => {
    if (!role) return;
    const allowed: NavKey[] = role === "inspector"
      ? ["dashboard","inspections","workspace","machines","scanner","evidence","sync","conflicts","history"]
      : ["reports","audit","admin"];
    if (!allowed.includes(page)) setPage(role === "inspector" ? "dashboard" : "reports");
  }, [role, page]);

  const go = (key: NavKey) => { setPage(key); setMobileOpen(false); };
  const toggleOffline = () => { setOffline(v => { const next = !v; toast(next ? "Offline mode enabled — work will be queued locally" : "Connection restored — ready to sync"); return next; }); };
  const saveEdit = (i: number, value: string) => { setChecklist(items => items.map((item, idx) => idx === i ? { ...item, value } : item)); setSavedCount(c => c + 1); };
  const sync = () => { setSavedCount(0); toast.success("Sync complete", { description: "All local changes are now synchronized." }); };
  const openInspection = () => go("workspace");

  const startNewInspection = (machineKey?: string) => {
    const nextNum = inspectionsList.length + 1;
    const newId = `INS-2026-TN-00${nextNum < 10 ? '0' + nextNum : nextNum}`;
    const targetKey = machineKey || "TRF-102";
    setActiveInspectionId(newId);
    setSelectedMachineKey(targetKey);
    setManualMachineCode(targetKey);
    setInspectionStatus("DRAFT");
    setSubmittedAt(null);
    if (machineTemplates[targetKey]) {
      setChecklist(machineTemplates[targetKey].checklist);
    }
    setInspectionsList(prev => [
      { id: newId, machine: targetKey, site: machineTemplates[targetKey]?.location.split("·")[0].trim() || "Field Site", status: "DRAFT", priority: "HIGH", date: "Today", completion: "0%" },
      ...prev
    ]);
    go("workspace");
  };

  const handleInspectionSubmit = () => {
    const timeStr = new Date().toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    setInspectionStatus("SUBMITTED");
    setSubmittedAt(timeStr);
    setShowSubmittedModal(true);
    toast.success("Inspection submitted for review");

    setInspectionsList(prev => {
      const code = manualMachineCode || selectedMachineKey;
      const site = machineTemplates[selectedMachineKey]?.location.split("·")[0].trim() || "Field Site";
      const index = prev.findIndex(x => x.id === activeInspectionId);
      const record = {
        id: activeInspectionId,
        machine: code,
        site: site,
        status: "SUBMITTED",
        priority: "HIGH",
        date: "Today",
        completion: "100%",
      };
      if (index >= 0) {
        const copy = [...prev];
        copy[index] = record;
        return copy;
      }
      return [record, ...prev];
    });
  };
  const logout = async () => { try { await signOut(auth); } catch { /**/ } setRole(null); setPage("dashboard"); };

  // Show a minimal loading screen while Firebase resolves auth state
  if (!authReady) return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--paper)"}}><Brand/></div>;

  if (!role) return <LoginPage onLogin={async (r, remember) => {
    setRole(r);
    setPage(r === "admin" ? "reports" : "dashboard");
  }} />;

  const inspectorNav = nav.slice(0, 8);
  const adminNav = nav.slice(8);
  const mobileNavItems = role === "inspector" ? nav.slice(0, 5) : nav.slice(8);

  return <div className="app-shell">
    <Toaster position="bottom-right" richColors />
    <header className="mobile-header"><button className="icon-btn" onClick={() => setMobileOpen(v => !v)}><Menu size={20}/></button><Brand compact/><div className="mobile-spacer"/><Connection offline={offline} onClick={toggleOffline}/></header>
    <aside className={"sidebar " + (mobileOpen ? "open" : "")}>
      <div className="brand-wrap"><Brand/><button className="icon-btn close-mobile" onClick={() => setMobileOpen(false)}><X size={18}/></button></div>
      {role === "inspector" && <><div className="nav-label">WORKSPACE</div><nav>{inspectorNav.map(item => <NavItem key={item.key} item={item} active={page === item.key || (page === "workspace" && item.key === "inspections")} onClick={() => go(item.key as NavKey)} badge={item.key === "sync" ? savedCount : item.key === "conflicts" && !resolved ? 1 : undefined}/>)}</nav></>}
      {role === "admin" && <><div className="nav-label">INSIGHT & CONTROL</div><nav>{adminNav.map(item => <NavItem key={item.key} item={item} active={page === item.key} onClick={() => go(item.key as NavKey)}/>)}</nav></>}
      <div className="sidebar-bottom"><div className="profile"><div className="avatar">{role === "admin" ? "AD" : "AK"}</div><div><strong>{role === "admin" ? "Admin User" : "Arun Kumar"}</strong><span>{role === "admin" ? "Administrator" : "Field Officer"}</span></div><button className="icon-btn logout-btn" title="Sign out" onClick={logout}><LogOut size={16}/></button></div></div>
    </aside>
    <main className="main"><Topbar page={page} offline={offline} toggleOffline={toggleOffline} savedCount={savedCount} sync={sync}/>
      <div className="content">{page === "dashboard" && <Dashboard go={go} offline={offline} savedCount={savedCount} openInspection={openInspection}/>} {page === "inspections" && <Inspections openInspection={openInspection} startNewInspection={startNewInspection} inspectionsList={inspectionsList}/>} {page === "workspace" && <Workspace status={inspectionStatus} setStatus={setInspectionStatus} checklist={checklist} setChecklist={setChecklist} saveEdit={saveEdit} offline={offline} go={go} resolved={resolved} setResolved={setResolved} selectedMachineKey={selectedMachineKey} setSelectedMachineKey={setSelectedMachineKey} manualMachineCode={manualMachineCode} setManualMachineCode={setManualMachineCode} activeInspectionId={activeInspectionId} submittedAt={submittedAt} onSubmitClick={handleInspectionSubmit}/>} {page === "machines" && <Machines go={go} startNewInspection={startNewInspection}/>} {page === "scanner" && <Scanner go={go} startNewInspection={startNewInspection}/>} {page === "evidence" && <Evidence savedCount={savedCount}/>} {page === "sync" && <SyncCenter savedCount={savedCount} sync={sync}/>} {page === "conflicts" && <Conflicts resolved={resolved} setResolved={setResolved}/>} {page === "history" && <HistoryPage/>} {page === "reports" && <Reports/>} {page === "audit" && <Audit/>} {page === "admin" && <Admin/>}</div>
    </main>
    <div className="mobile-nav">{mobileNavItems.map(item => <button className={page === item.key ? "active" : ""} key={item.key} onClick={() => go(item.key as NavKey)}><item.icon size={18}/><span>{item.label.split(" ")[0]}</span></button>)}</div>

    {/* ── Inspection Submitted Modal Popup ── */}
    {showSubmittedModal && (
      <div className="modal-overlay" onClick={() => setShowSubmittedModal(false)}>
        <div className="modal-card" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-icon-badge"><CheckCircle2 size={30}/></div>
            <h3>Inspection Submitted Successfully!</h3>
            <p>Your inspection record has been validated, saved locally, and queued for supervisor review.</p>
          </div>
          <div className="modal-body">
            <div className="modal-details-grid">
              <div className="modal-detail-item"><span>Inspection ID</span><strong>INS-2026-TN-0001</strong></div>
              <div className="modal-detail-item"><span>Machine Code</span><strong className="mono">{manualMachineCode || selectedMachineKey}</strong></div>
              <div className="modal-detail-item"><span>Machine Name</span><strong>{machineTemplates[selectedMachineKey]?.name || "Equipment Record"}</strong></div>
              <div className="modal-detail-item"><span>Location</span><strong>{machineTemplates[selectedMachineKey]?.location || "Field Substation"}</strong></div>
              <div className="modal-detail-item"><span>Status</span><StatusChip status="SUBMITTED"/></div>
              <div className="modal-detail-item"><span>Submitted At</span><strong>Today, {new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</strong></div>
              <div className="modal-detail-item"><span>Audit Ref</span><strong className="mono">OP-SUBMIT-2026</strong></div>
            </div>
            <div className="modal-note">
              <ShieldCheck size={16}/>
              <span>Tamper-proof audit record created. Saved offline &amp; ready for cloud sync.</span>
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn secondary" onClick={() => { setShowSubmittedModal(false); go("inspections"); }}>
              <ClipboardCheck size={15}/> View My Inspections
            </button>
            <button className="btn primary" onClick={() => setShowSubmittedModal(false)}>
              <Check size={15}/> Done &amp; Close
            </button>
          </div>
        </div>
      </div>
    )}
  </div>;
}


function LoginPage({ onLogin }: { onLogin: (role: Role, remember: boolean) => void }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const email = user.trim().includes("@") ? user.trim() : `${user.trim()}@off2field.com`;
    try {
      await setPersistence(auth, rememberDevice ? browserLocalPersistence : browserSessionPersistence);
      let credential;
      try {
        credential = await signInWithEmailAndPassword(auth, email, pass);
      } catch (signInErr: any) {
        if (signInErr.code === "auth/user-not-found" || signInErr.code === "auth/invalid-credential") {
          credential = await createUserWithEmailAndPassword(auth, email, pass);
        } else throw signInErr;
      }
      
      let r: Role = user.toLowerCase().includes("admin") ? "admin" : "inspector";
      try {
        const snap = await getDoc(doc(db, "users", credential.user.uid));
        if (snap.exists() && snap.data().role) {
          r = snap.data().role as Role;
        } else {
          await setDoc(doc(db, "users", credential.user.uid), { role: r, email }, { merge: true });
        }
      } catch {
        // Fallback
      }
      onLogin(r, rememberDevice);
    } catch (e: any) {
      const code: string = e.code ?? "";
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") setErr("Incorrect password. Please try again.");
      else if (code === "auth/invalid-email") setErr("Invalid username or email.");
      else if (code === "auth/operation-not-allowed") setErr("Email/Password sign-in is not enabled. Enable it in Firebase Console → Authentication.");
      else if (code === "auth/too-many-requests") setErr("Too many attempts. Please wait a moment and try again.");
      else if (code === "auth/network-request-failed") setErr("Network error. Check your connection.");
      else setErr(e.message ?? "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return <div className="login-shell">
    <div className="login-wrap">
      <div className="login-brand"><Brand/><p className="login-tagline">Field Inspection Operating System</p></div>
      <div className="login-card">
        <div className="login-card-header"><h2>Sign In</h2><p>Enter your credentials to access your workspace</p></div>
        <form className="login-form" onSubmit={submit}>
          <div className="login-field"><label>Username or Email</label><input type="text" placeholder="Enter username or email" value={user} onChange={e => setUser(e.target.value)} autoFocus/></div>
          <div className="login-field"><label>Password</label><div className="pass-wrap"><input type={showPass ? "text" : "password"} placeholder="••••••••" value={pass} onChange={e => setPass(e.target.value)}/><button type="button" className="pass-toggle" onClick={() => setShowPass(v => !v)}>{showPass ? <EyeOff size={14}/> : <Eye size={14}/>}</button></div></div>
          <label className="remember-check"><input type="checkbox" checked={rememberDevice} onChange={e => setRememberDevice(e.target.checked)}/><span>Remember this device</span></label>
          {err && <div className="login-error">{err}</div>}
          <button type="submit" className="login-submit inspector" disabled={loading || !user || !pass}>{loading && <span className="login-spinner"/>}{loading ? "Signing in…" : "Sign in"}</button>
        </form>
      </div>
    </div>
  </div>;
}


function Brand({ compact = false }: { compact?: boolean }) { return <div className="brand"><div className="brand-symbol"><span></span><span></span><span></span></div>{!compact && <div><strong>OFF<span>2</span>FIELD</strong><small>FIELD INSPECTION OS</small></div>}</div> }
function NavItem({ item, active, onClick, badge }: any) { return <button className={"nav-item " + (active ? "active" : "")} onClick={onClick}><item.icon size={17}/><span>{item.label}</span>{badge !== undefined && <em>{badge}</em>}</button> }
function Connection({ offline, onClick }: { offline: boolean; onClick: () => void }) { return <button onClick={onClick} className={"connection " + (offline ? "is-offline" : "")}><span className="status-dot"></span>{offline ? "OFFLINE" : "ONLINE"}<ChevronRight size={13}/></button> }
function Topbar({ page, offline, toggleOffline, savedCount, sync }: any) { const title = page === "workspace" ? "Inspection workspace" : page === "dashboard" ? "Operations overview" : nav.find(n => n.key === page)?.label; return <div className="topbar"><div><h1>{title}</h1></div><div className="top-actions"><div className="local-save"><span className="pulse"></span><span><strong>Local storage protected</strong><small>Last saved just now</small></span></div><button className="top-icon"><Bell size={18}/><i></i></button><Connection offline={offline} onClick={toggleOffline}/><button className="sync-btn" onClick={sync}><RefreshCw size={15}/> Sync {savedCount > 0 && <b>{savedCount}</b>}</button></div></div> }

function PageIntro({ eyebrow, title, description, actions }: any) { return <div className="page-intro"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2><p>{description}</p></div><div className="intro-actions">{actions}</div></div> }
function Dashboard({ go, offline, savedCount, openInspection }: any) { return <><div className="dash-actions"><button className="btn secondary" onClick={() => go("scanner")}><QrCode size={16}/> Scan machine</button><button className="btn primary" onClick={openInspection}><PlusIcon/> Start inspection</button></div><div className="stat-grid">{[["Assigned inspections","12","+2 this week","blue",ClipboardCheck,"inspections"],["In progress","03","2 due today","amber",Activity,"inspections"],["Submitted","08","+4 this week","green",Send,"inspections"],["Pending review","04","Supervisor queue","violet",Clock3,"inspections"],["Conflicts","01","Needs resolution","red",AlertTriangle,"conflicts"],["Approved","27","92% acceptance","teal",CheckCircle2,"history"]].map(([label,value,sub,color,Icon,dest]: any[]) => <button className="stat-card stat-card-btn" key={label as string} onClick={() => go(dest)}><div className={"stat-icon " + color}><Icon size={17}/></div><div className="stat-copy"><span>{label}</span><strong>{value}</strong><small className={color === "red" ? "danger-text" : ""}>{sub}</small></div><ChevronRight size={14} className="muted-icon stat-arrow"/></button>)}</div><div className="dashboard-grid"><section className="panel readiness"><PanelHeader title="Offline readiness" icon={<Wifi size={17}/>} action={<span className="ready-chip"><span></span> Device ready</span>}/><div className="readiness-body"><div className="readiness-score"><div className="score-ring"><strong>100</strong><span>%</span></div><div><strong>READY FOR<br/>OFFLINE WORK</strong><small>All field dependencies are cached</small></div></div><div className="checks">{["App available offline","Assignments downloaded","Machine data available","Templates available","Permissions cached","Storage available"].map(x => <div key={x}><CheckCircle2 size={16}/><span>{x}</span><small>Verified</small></div>)}</div></div></section><section className="panel workload"><PanelHeader title="Today’s workload" icon={<BarChart3 size={17}/>} action={<button className="text-btn" onClick={() => go("inspections")}>View all <ArrowRight size={14}/></button>}/><div className="workload-rows">{[["INS-2026-TN-0001","TRF-102 · Substation A","High","2h 14m","high"],["INS-2026-TN-0002","TRF-117 · Substation B","Medium","5h 08m","medium"],["INS-2026-TN-0003","PMP-301 · Pump House 4","Low","Tomorrow","low"]].map((x, i) => <button className="work-row" onClick={openInspection} key={x[0]}><div className="work-index">0{i+1}</div><div className="work-main"><strong>{x[0]}</strong><span>{x[1]}</span></div><span className={"priority " + x[4]}>{x[2]}</span><div className="work-time"><Clock3 size={13}/>{x[3]}</div><ChevronRight size={15}/></button>)}</div></section></div><div className="lower-grid"><section className="panel activity-panel"><PanelHeader title="Recent activity" icon={<Activity size={17}/>} action={<button className="text-btn" onClick={() => go("audit")}>Audit trail <ArrowRight size={14}/></button>}/><Timeline items={[["Inspection created","INS-2026-TN-0001","Arun Kumar","10:00","blue"],["Checklist updated","Oil Temperature · 78 °C","Saved locally","10:41","amber"],["Photo evidence added","EVD-2026-00001","TRF-102 / Item 04","10:43","purple"],["Conflict detected","Temperature value","Sync queue","10:44","red"]]}/></section><section className="panel sync-panel"><PanelHeader title="Sync health" icon={<RefreshCw size={17}/>} action={<button className="icon-btn"><MoreHorizontal size={17}/></button>}/><div className="sync-health"><div className="health-number"><strong>98.4<span>%</span></strong><small>Successful operations</small></div><div className="health-bars">{Array.from({length: 18}).map((_,i)=><i key={i} style={{height: `${18 + ((i*17)%60)}%`}}></i>)}</div></div><div className="sync-meta"><div><span className="dot green-dot"></span>Last sync <strong>Today, 09:58</strong></div><div><span className="dot amber-dot"></span>{offline ? "Offline queue" : "Pending changes"} <strong>{savedCount} operations</strong></div></div></section></div></> }
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
  return <><PageIntro eyebrow="WORKSPACE / INSPECTIONS" title="My inspections" description="Manage field inspections, completion state, and submission readiness." actions={<button className="btn primary" onClick={() => startNewInspection()}><PlusIcon/> New inspection</button>}/><div className="toolbar"><div className="searchbox"><Search size={16}/><input placeholder="Search by inspection ID, machine, or site" value={q} onChange={e=>setQ(e.target.value)}/></div><button className="btn secondary"><Filter size={15}/> Filters <span className="filter-count">2</span></button><button className="btn secondary"><SlidersHorizontal size={15}/> Sort</button><div className="view-toggle"><button className="active"><Table2 size={16}/></button><button><ListChecks size={16}/></button></div></div><section className="panel table-panel"><div className="table-top"><div><strong>Inspection register</strong><span>{filtered.length} records · Saved locally &amp; synced</span></div><button className="text-btn"><Download size={14}/> Export CSV</button></div><div className="table-wrap"><table><thead><tr><th>Inspection ID</th><th>Machine / site</th><th>Status</th><th>Priority</th><th>Last updated</th><th>Completion</th><th></th></tr></thead><tbody>{filtered.map((r: any)=><tr key={r.id} onClick={openInspection}><td><strong className="linkish">{r.id}</strong><span className="table-sub">Officer · Arun Kumar</span></td><td><strong>{r.machine}</strong><span className="table-sub">{r.site}</span></td><td><StatusChip status={r.status}/></td><td><span className={"priority " + r.priority.toLowerCase()}>{r.priority}</span></td><td>{r.date}</td><td><div className="completion"><div><i style={{width:r.completion}}></i></div><span>{r.completion}</span></div></td><td><ChevronRight size={16}/></td></tr>)}</tbody></table></div></section></> 
}
function StatusChip({status}: {status:string}) { return <span className={"status-chip " + status.toLowerCase().replace(" ","-")}><span></span>{status}</span> }

function Workspace({status,setStatus,checklist,setChecklist,saveEdit,offline,go,resolved,setResolved,selectedMachineKey,setSelectedMachineKey,manualMachineCode,setManualMachineCode,activeInspectionId,submittedAt,onSubmitClick}:any){
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
  {tab === "Checklist" && <div className="workspace-grid"><section className="panel checklist-panel"><div className="checklist-heading"><div><div className="eyebrow">CHECKLIST / {selectedMachineKey} ROUTINE</div><h3>Equipment condition assessment ({activeMachine.name})</h3><p>Complete all required readings before submitting this inspection.</p></div><div className="progress-circle"><strong>{readinessPercent}%</strong><span>complete</span></div></div><div className="check-items">{checklist.map((item:any,i:number)=><div className="check-item" key={item.id + item.label}><div className="check-num">{item.id}</div><div className="check-label"><strong>{item.label}{item.required&&<b>*</b>}</strong><span>{item.helper}</span></div><div className="check-field"><input value={item.value} onChange={e=>saveEdit(i,e.target.value)}/>{(status === "SUBMITTED" || status === "APPROVED") && <CheckCircle2 size={16}/>}</div><MoreHorizontal size={17}/></div>)}<div className="remarks-field"><label>06 · Remarks <span>optional</span></label><textarea placeholder="Add field observations or remarks…" defaultValue="Minor surface dust observed. No action required."/></div></div><div className="checklist-footer"><span><LockKeyhole size={14}/> Required fields validated locally</span><button className="btn primary" onClick={onSubmitClick} disabled={status === "SUBMITTED" || status === "APPROVED"}>{status === "DRAFT" ? <><Send size={15}/> Submit for review</> : <><CheckCircle2 size={15}/> Submitted</>}</button></div></section><aside className="workspace-side"><section className="panel mini-panel"><PanelHeader title="Submission readiness" icon={<FileCheck2 size={16}/>} /><div className="readiness-meter"><div><strong>{readinessPercent}%</strong><span>{readinessPercent === 100 ? "Ready to submit" : `${filledCount} of ${totalCount} items completed`}</span></div><div className="meter"><i style={{width: `${readinessPercent}%`}}></i></div></div><div className="mini-check"><CheckCircle2 size={15}/> Checklist complete <span>{filledCount} / {totalCount}</span></div><div className={resolved?"mini-check":"mini-check warn"}>{resolved?<CheckCircle2 size={15}/>:<AlertTriangle size={15}/>} Critical conflicts {resolved?"Resolved":"1 unresolved"}</div></section><section className="panel mini-panel"><PanelHeader title="Field traceability" icon={<Link2 size={16}/>} /><div className="trace-row"><div className="avatar small">AK</div><div><strong>Arun Kumar</strong><span>Field Officer · EMP-1024</span></div></div><div className="trace-info"><span>Machine</span><strong className="mono">{manualMachineCode}</strong><span>Operation ID</span><strong className="mono">OP-7F31-A9C2</strong><span>Submitted At</span><strong>{submittedAt ? submittedAt : "Pending submission"}</strong></div></section></aside></div>}
  {tab === "Conflicts" && <Conflicts resolved={resolved} setResolved={(v:any)=>{setResolved(v);toast.success("Conflict resolved",{description:"Resolution appended to the audit trail."})}}/>}
  {tab === "History" && <HistoryPage/>}
  {tab === "Evidence" && <Evidence savedCount={2}/>} 
  {tab === "Submission" && <Submission status={status} onSubmitClick={onSubmitClick}/>} 
  {tab === "Overview" && <Overview activeMachine={activeMachine} machineCode={manualMachineCode}/>}
  {tab === "Remarks" && <div className="empty-tab panel"><Sparkles size={20}/><h3>Remarks workspace</h3><p>Field notes, observations, and follow-up actions are protected locally.</p></div>}</>
}

function Overview({ activeMachine, machineCode }: any){ return <div className="overview-grid"><div className="panel overview-hero"><div className="machine-illustration"><div className="transformer"><span></span><span></span><span></span></div></div><div><div className="eyebrow">MACHINE PROFILE</div><h3>{machineCode || "TRF-102"} · {activeMachine?.name || "Transformer T-102"}</h3><p>{activeMachine?.type || "Operational equipment"} · Installed 2018</p><div className="overview-tags"><span>{activeMachine?.location || "Substation A"}</span><span>Last inspected 18 Sep 2026</span></div></div></div><div className="panel"><PanelHeader title="Previous readings" icon={<History size={16}/>} /><div className="reading-grid">{[["Primary parameter","72 °C","18 Sep"],["Secondary parameter","84 %","18 Sep"],["Load current","184 A","18 Sep"],["Condition","Normal","18 Sep"]].map(x=><div key={x[0]}><span>{x[0]}</span><strong>{x[1]}</strong><small>{x[2]}</small></div>)}</div></div></div>}
function Submission({status, onSubmitClick}:any){return <div className="submission-grid"><section className="panel submission-panel"><div className="eyebrow">APPROVAL WORKFLOW</div><h3>Inspection lifecycle</h3><div className="workflow">{["DRAFT","SUBMITTED","UNDER REVIEW","APPROVED"].map((x,i)=><div className={(status===x||["SUBMITTED","UNDER REVIEW","APPROVED"].indexOf(status)>i)?"step done":"step"} key={x}><div>{(["SUBMITTED","UNDER REVIEW","APPROVED"].indexOf(status)>i||status===x)?<Check size={15}/>:i+1}</div><span>{x}</span></div>)}</div><div className="submission-note"><ShieldCheck size={18}/><div><strong>Traceable submission</strong><p>Submitting creates an append-only audit event and queues the package for supervisor review.</p></div></div><button className="btn primary" onClick={onSubmitClick} disabled={status === "SUBMITTED" || status === "APPROVED"}><Send size={15}/> {status === "DRAFT" ? "Submit inspection" : "Inspection Submitted"}</button></section><section className="panel"><PanelHeader title="Validation summary" icon={<CheckCircle2 size={16}/>} />{["All required checklist values present","Evidence package attached","No critical conflicts","Local changes synchronized"].map((x,i)=><div className="validation-row" key={x}><CheckCircle2 size={16}/><span>{x}</span><small>{i===3?"Pending":"Passed"}</small></div>)}</section></div>}

function Machines({go, startNewInspection}:any){
  const machinesList = Object.entries(machineTemplates).map(([code, data]) => [
    code,
    data.name,
    data.location.split("·")[0].trim(),
    "Operational",
    data.type,
    "green"
  ]);

  return <><PageIntro eyebrow="ASSET REGISTER / MACHINES" title="Machines" description="Offline-cached equipment registry for field identification and inspection context." actions={<button className="btn primary" onClick={()=>go("scanner")}><QrCode size={16}/> Scan machine</button>}/><div className="machine-grid">{machinesList.map(x=><button className="machine-card panel" key={x[0]} onClick={()=>startNewInspection(x[0])}><div className="machine-top"><div className="machine-icon"><Cog size={20}/></div><StatusChip status="APPROVED"/></div><div className="eyebrow">{x[0]}</div><h3>{x[1]}</h3><p>{x[2]}</p><div className="machine-footer"><span>{x[4]}</span><span>Inspect <ChevronRight size={14}/></span></div></button>)}</div></>
}
function Scanner({go, startNewInspection}:any){
  const [scanned,setScanned]=useState(false); 
  return <><PageIntro eyebrow="FIELD TOOLS / IDENTIFICATION" title="QR scanner" description="Identify a machine from its QR label, even when the device is offline." actions={<span className="ready-chip"><span></span> Camera ready</span>}/><div className="scanner-layout"><section className="panel scanner-panel"><div className="scanner-frame"><div className="scan-corner tl"></div><div className="scan-corner tr"></div><div className="scan-corner bl"></div><div className="scan-corner br"></div><div className="scan-line"></div><QrCode size={78} strokeWidth={1}/></div><p>Point camera at a machine QR label</p><button className="btn primary" onClick={()=>{setScanned(true);toast.success("Machine identified",{description:"TRF-102 found in offline machine cache."})}}><QrCode size={16}/> Simulate scan · TRF-102</button></section>{scanned?<section className="panel machine-result"><div className="result-badge"><CheckCircle2 size={16}/> MACHINE FOUND OFFLINE</div><div className="eyebrow">MACHINE RECORD</div><h3>TRF-102 · Transformer T-102</h3><p>Substation A · Chennai North</p><div className="result-list"><div><span>Status</span><strong className="online-label"><span className="status-dot"></span> Operational</strong></div><div><span>Last inspection</span><strong>18 Sep 2026</strong></div><div><span>Previous readings</span><strong>6 values cached</strong></div><div><span>QR identifier</span><strong className="mono">TRF-102</strong></div></div><div className="result-actions"><button className="btn primary" onClick={()=>startNewInspection("TRF-102")}>Start inspection <ArrowRight size={15}/></button><button className="btn secondary" onClick={()=>go("history")}>View history</button></div></section>:<section className="panel scanner-help"><QrCode size={30}/><h3>Fast, offline identification</h3><p>Machine records are cached on this device. Scan a label to retrieve specifications, prior readings, and inspection history without a network connection.</p></section>}</div></>
}

function Evidence({savedCount}:any){return <><PageIntro eyebrow="INSPECTION / EVIDENCE" title="Evidence gallery" description="Photos and files are stored locally first, then uploaded through the sync queue." actions={<button className="btn primary" onClick={()=>toast.success("Evidence captured locally",{description:"EVD-2026-00002 added to the upload queue."})}><Upload size={15}/> Capture photo</button>}/><div className="evidence-summary"><div><HardDrive size={17}/><span>Local evidence</span><strong>06 items</strong></div><div><Upload size={17}/><span>Pending upload</span><strong>{savedCount + 1} items</strong></div><div><CheckCircle2 size={17}/><span>Uploaded</span><strong>14 items</strong></div></div><div className="evidence-grid">{[["EVD-2026-00001","Oil temperature gauge","Uploaded","10:43","amber"],["EVD-2026-00002","Equipment condition","Saved locally","10:45","blue"],["EVD-2026-00003","Safety lockout tag","Uploaded","10:46","purple"],["EVD-2026-00004","Transformer nameplate","Uploaded","10:49","green"]].map(x=><div className="evidence-card panel" key={x[0]}><div className={"evidence-preview " + x[4]}><FileText size={30}/><span>PHOTO</span></div><div className="evidence-copy"><strong>{x[1]}</strong><span>{x[0]} · INS-2026-TN-0001</span><small><span className={x[2] === "Uploaded" ? "green-dot" : "amber-dot"}></span>{x[2]} · {x[3]}</small></div><MoreHorizontal size={16}/></div>)}</div></>}

function SyncCenter({savedCount,sync}:any){return <><PageIntro eyebrow="RELIABILITY / SYNCHRONIZATION" title="Sync center" description="Every local operation is traceable, resumable, and safe to retry." actions={<><button className="btn secondary" onClick={()=>toast("Sync paused")}>Pause queue</button><button className="btn primary" onClick={sync}><RefreshCw size={15}/> Sync now</button></>}/><div className="sync-cards"><div className="sync-stat"><span>Pending changes</span><strong>{savedCount}</strong><small>Local operations</small></div><div className="sync-stat"><span>Pending uploads</span><strong>01</strong><small>Evidence files</small></div><div className="sync-stat"><span>Completed today</span><strong>24</strong><small>98.4% success</small></div><div className="sync-stat danger-card"><span>Failed</span><strong>00</strong><small>No retries needed</small></div></div><section className="panel queue-panel"><PanelHeader title="Operation queue" icon={<RefreshCw size={16}/>} action={<StatusChip status="UNDER REVIEW"/>}/><div className="queue-row queue-head"><span>Operation</span><span>Type</span><span>Status</span><span>Progress</span><span>Created</span><span></span></div>{[["OP-7F31-A9C2","Checklist update","PENDING","10:41"],["OP-3C20-B114","Evidence upload","SYNCING","10:43"],["OP-22A1-88EF","Audit event","COMPLETED","10:44"],["OP-912B-2F10","Conflict package","COMPLETED","10:44"]].map((x,i)=><div className="queue-row" key={x[0]}><strong className="mono">{x[0]}</strong><span>{x[1]}</span><StatusChip status={x[2] === "PENDING" ? "DRAFT" : x[2] === "COMPLETED" ? "APPROVED" : "UNDER REVIEW"}/><div className="queue-progress"><i style={{width:x[2] === "COMPLETED" ? "100%" : x[2] === "SYNCING" ? "64%" : "12%"}}></i></div><span>{x[3]}</span><MoreHorizontal size={16}/></div>)}</section></>}
function Conflicts({resolved,setResolved}:any){return <><PageIntro eyebrow="TRACEABILITY / CONFLICT CENTER" title="Conflict resolution" description="Competing offline edits are surfaced for an explicit, auditable decision." actions={!resolved&&<span className="risk-chip"><AlertTriangle size={14}/> 1 critical conflict</span>}/>{resolved?<div className="resolved-banner panel"><div className="resolved-icon"><Check size={21}/></div><div><div className="eyebrow">CONFLICT RESOLVED</div><h3>CON-2026-00001 · Final value 80 °C</h3><p>Resolved by Arun Kumar · 22 Sep 2026, 11:02 · Reason recorded in audit trail.</p></div><StatusChip status="APPROVED"/></div>:<div className="conflict-layout"><section className="panel conflict-panel"><div className="conflict-top"><div><div className="eyebrow">CONFLICT DETECTED · CON-2026-00001</div><h3>Oil temperature has competing offline values</h3><p>Inspection INS-2026-TN-0001 · Checklist item 02 · Detected at 10:44</p></div><span className="critical-chip">CRITICAL RISK</span></div><div className="version-grid"><div className="version-card"><div className="version-head"><span>VERSION A</span><small>Officer A · DEV-0001</small></div><strong>78 °C</strong><p>Captured at 10:41 · Chennai North</p><button className="btn secondary" onClick={()=>setResolved(true)}>Accept Version A</button></div><div className="versus">VS</div><div className="version-card alt"><div className="version-head"><span>VERSION B</span><small>Officer B · DEV-0018</small></div><strong>83 °C</strong><p>Captured at 10:43 · Chennai North</p><button className="btn secondary" onClick={()=>setResolved(true)}>Accept Version B</button></div></div><div className="resolution-footer"><div><LockKeyhole size={15}/><span>A resolution reason is required and will be appended to the audit trail.</span></div><button className="btn primary" onClick={()=>setResolved(true)}><CheckCircle2 size={15}/> Resolve with final value</button></div></section><aside className="panel conflict-context"><PanelHeader title="Conflict context" icon={<AlertTriangle size={16}/>} />{[["Field","Oil temperature"],["Machine","TRF-102"],["Users","Arun Kumar · Priya S."],["Devices","DEV-0001 · DEV-0018"],["State","Unresolved"],["Sync batch","BATCH-09-22-1044"]].map(x=><div className="context-row" key={x[0]}><span>{x[0]}</span><strong>{x[1]}</strong></div>)}</aside></div>}</>}
function HistoryPage(){return <><PageIntro eyebrow="TRACEABILITY / TIME MACHINE" title="Inspection history" description="A chronological record of every meaningful state change." actions={<button className="btn secondary"><Download size={15}/> Export history</button>}/><section className="panel history-panel"><div className="history-head"><div><strong>INS-2026-TN-0001</strong><span>TRF-102 · Substation A</span></div><StatusChip status="UNDER REVIEW"/></div><div className="history-timeline">{[["10:00","Inspection created","Arun Kumar","Draft created from assignment","blue"],["10:41","Temperature updated","Arun Kumar · DEV-0001","72 °C → 78 °C","amber"],["10:43","Temperature updated","Priya S. · DEV-0018","72 °C → 83 °C","purple"],["10:44","Conflict detected","Sync engine","Competing values require resolution","red"],["11:02","Supervisor resolved","Meera Nair","Final value: 80 °C","green"]].map(x=><div className="history-event" key={x[0]}><time>{x[0]}</time><div className={"history-marker " + x[4]}></div><div><strong>{x[1]}</strong><span>{x[2]}</span><p>{x[3]}</p></div><ChevronRight size={16}/></div>)}</div></section></>}
function Reports(){return <><PageIntro eyebrow="COMPLIANCE / REPORTING" title="Reports" description="Generate official, PDF-ready views from locally available inspection records." actions={<button className="btn primary" onClick={()=>toast.success("Report ready",{description:"PDF-ready preview generated locally."})}><FileText size={15}/> Generate report</button>}/><div className="report-grid">{[["Inspection report","A complete field inspection record","12 records","FileCheck2"],["Machine history","Equipment readings over time","4 machines","History"],["Audit report","Append-only event export","86 events","FileClock"],["Conflict report","Resolution and risk register","1 conflict","AlertTriangle"],["Evidence report","Photo metadata and integrity","20 items","Archive"],["Compliance report","Department readiness summary","Q3 2026","ShieldCheck"]].map(x=><button className="report-card panel" key={x[0]} onClick={()=>toast("Report preview opened",{description:x[0]})}><div className="report-icon"><FileText size={19}/></div><div><h3>{x[0]}</h3><p>{x[1]}</p><span>{x[2]}</span></div><ArrowRight size={16}/></button>)}</div></>}
function Audit(){return <><PageIntro eyebrow="SECURITY / APPEND-ONLY LOG" title="Audit trail" description="Every create, edit, submit, approve, and conflict action is preserved." actions={<button className="btn secondary"><Download size={15}/> Export CSV</button>}/><section className="panel audit-panel"><div className="toolbar compact"><div className="searchbox"><Search size={16}/><input placeholder="Search operation ID, user, or action"/></div><button className="btn secondary"><Filter size={15}/> All actions</button><button className="btn secondary">Last 30 days</button></div><div className="audit-table"><div className="audit-row audit-head"><span>Timestamp</span><span>User / role</span><span>Action</span><span>Field</span><span>Operation ID</span></div>{[["22 Sep · 11:02","Meera Nair · Supervisor","Conflict resolved","Oil temperature","OP-RES-9921"],["22 Sep · 10:44","Sync engine · System","Conflict created","Oil temperature","OP-CON-7F31"],["22 Sep · 10:43","Arun Kumar · Officer","Photo added","Evidence","OP-EVD-0002"],["22 Sep · 10:41","Arun Kumar · Officer","Edit","Oil temperature","OP-7F31-A9C2"],["22 Sep · 10:00","Arun Kumar · Officer","Create","Inspection","OP-INS-0001"]].map(x=><div className="audit-row" key={x[4]}><span>{x[0]}</span><strong>{x[1]}</strong><StatusChip status={x[2] === "Conflict resolved" ? "APPROVED" : "UNDER REVIEW"}/><span>{x[3]}</span><span className="mono">{x[4]}</span></div>)}</div></section></>}
function Admin(){return <><PageIntro eyebrow="ADMINISTRATION / CONTROL PLANE" title="Admin console" description="Manage users, roles, machines, templates, devices, and schema versions." actions={<button className="btn primary" onClick={()=>toast("Admin action ready")}> <Users size={15}/> Add user</button>}/><div className="admin-grid">{[["Users & roles","18 users · 4 roles","Users"],["Machine registry","48 registered assets","Cog"],["Inspection templates","06 active templates","ClipboardCheck"],["Devices","22 managed devices","Smartphone"],["Schema versions","v1.8 current","Database"],["System settings","RBAC · security · sync","Settings2"]].map(x=><button className="admin-card panel" key={x[0]} onClick={()=>toast("Admin module opened",{description:x[0]})}><div className="admin-icon"><Settings2 size={18}/></div><div><h3>{x[0]}</h3><p>{x[1]}</p></div><ChevronRight size={16}/></button>)}</div><section className="panel security-strip"><ShieldCheck size={20}/><div><strong>Security posture</strong><span>JWT-ready architecture · HTTPS/WSS boundary · append-only audit model · no secrets in frontend</span></div><span className="ready-chip"><span></span> Healthy</span></section></>}
