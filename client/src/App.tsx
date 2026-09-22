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
const checklistSeed = [
  { id: "01", label: "Oil Leakage", value: "No Leakage", helper: "Visual inspection", required: true, tone: "green" },
  { id: "02", label: "Oil Temperature", value: "78 °C", helper: "Previous: 72 °C", required: true, tone: "amber" },
  { id: "03", label: "Oil Level", value: "82 %", helper: "Within operating range", required: true, tone: "green" },
  { id: "04", label: "Equipment Condition", value: "Normal", helper: "No abnormal noise", required: true, tone: "green" },
  { id: "05", label: "Safety Status", value: "Safe", helper: "LOTO verified", required: true, tone: "green" },
];

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
  const [checklist, setChecklist] = useState(() => read("off2field-checklist", checklistSeed));
  const [resolved, setResolved] = useState(() => read("off2field-resolved", false));

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
  const saveEdit = (i: number, value: string) => { setChecklist(items => items.map((item, idx) => idx === i ? { ...item, value } : item)); setSavedCount(c => c + 1); toast.success("Saved locally", { description: "Your change is protected in the local queue." }); };
  const sync = () => { setSavedCount(0); toast.success("Sync complete", { description: "All local changes are now synchronized." }); };
  const openInspection = () => go("workspace");
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
      {role === "inspector" && <><div className="nav-label">WORKSPACE</div><nav>{inspectorNav.map(item => <NavItem key={item.key} item={item} active={page === item.key} onClick={() => go(item.key as NavKey)} badge={item.key === "sync" ? savedCount : item.key === "conflicts" && !resolved ? 1 : undefined}/>)}</nav></>}
      {role === "admin" && <><div className="nav-label">INSIGHT & CONTROL</div><nav>{adminNav.map(item => <NavItem key={item.key} item={item} active={page === item.key} onClick={() => go(item.key as NavKey)}/>)}</nav></>}
      <div className="sidebar-bottom"><div className="device-card"><div className="device-icon"><Smartphone size={16}/></div><div><strong>DEV-0001</strong><span>Device secure · 94%</span></div><MoreHorizontal size={15}/></div><div className="profile"><div className="avatar">{role === "admin" ? "AD" : "AK"}</div><div><strong>{role === "admin" ? "Admin User" : "Arun Kumar"}</strong><span>{role === "admin" ? "Administrator" : "Field Officer"}</span></div><button className="icon-btn logout-btn" title="Sign out" onClick={logout}><LogOut size={16}/></button></div></div>
    </aside>
    <main className="main"><Topbar page={page} offline={offline} toggleOffline={toggleOffline} savedCount={savedCount} sync={sync}/>
      <div className="content">{page === "dashboard" && <Dashboard go={go} offline={offline} savedCount={savedCount} openInspection={openInspection}/>} {page === "inspections" && <Inspections openInspection={openInspection}/>} {page === "workspace" && <Workspace status={inspectionStatus} setStatus={setInspectionStatus} checklist={checklist} saveEdit={saveEdit} offline={offline} go={go} resolved={resolved} setResolved={setResolved}/>} {page === "machines" && <Machines go={go}/>} {page === "scanner" && <Scanner go={go}/>} {page === "evidence" && <Evidence savedCount={savedCount}/>} {page === "sync" && <SyncCenter savedCount={savedCount} sync={sync}/>} {page === "conflicts" && <Conflicts resolved={resolved} setResolved={setResolved}/>} {page === "history" && <HistoryPage/>} {page === "reports" && <Reports/>} {page === "audit" && <Audit/>} {page === "admin" && <Admin/>}</div>
    </main>
    <div className="mobile-nav">{mobileNavItems.map(item => <button className={page === item.key ? "active" : ""} key={item.key} onClick={() => go(item.key as NavKey)}><item.icon size={18}/><span>{item.label.split(" ")[0]}</span></button>)}</div>
  </div>
}


function LoginPage({ onLogin }: { onLogin: (role: Role, remember: boolean) => void }) {
  const [selected, setSelected] = useState<Role | null>(null);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selected) return;
    setErr("");
    setLoading(true);
    // Construct email: append domain if plain username
    const email = user.trim().includes("@") ? user.trim() : `${user.trim()}@off2field.com`;
    try {
      // Set Firebase persistence based on Remember Device
      await setPersistence(auth, rememberDevice ? browserLocalPersistence : browserSessionPersistence);
      let credential;
      try {
        credential = await signInWithEmailAndPassword(auth, email, pass);
      } catch (signInErr: any) {
        if (signInErr.code === "auth/user-not-found" || signInErr.code === "auth/invalid-credential") {
          // First-time setup: auto-create the account
          credential = await createUserWithEmailAndPassword(auth, email, pass);
        } else throw signInErr;
      }
      // Save / update role in Firestore
      await setDoc(doc(db, "users", credential.user.uid), { role: selected, email }, { merge: true });
      onLogin(selected, rememberDevice);
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
        {!selected ? <>
          <div className="login-card-header"><h2>Welcome back</h2><p>Select your role to access the system</p></div>
          <div className="role-cards">
            <button className="role-card inspector" onClick={() => { setSelected("inspector"); setUser(""); setPass(""); setErr(""); }}>
              <div className="role-icon inspector"><ClipboardCheck size={22}/></div>
              <div className="role-card-copy"><strong>Field Inspector</strong><span>Workspace &amp; Field Tools</span></div>
              <ChevronRight size={16} className="role-arrow"/>
            </button>
            <button className="role-card admin" onClick={() => { setSelected("admin"); setUser(""); setPass(""); setErr(""); }}>
              <div className="role-icon admin"><ShieldCheck size={22}/></div>
              <div className="role-card-copy"><strong>Administrator</strong><span>Insight &amp; Control</span></div>
              <ChevronRight size={16} className="role-arrow"/>
            </button>
          </div>
        </> : <>
          <button className="login-back" onClick={() => { setSelected(null); setErr(""); }}>← Back</button>
          <div className={`login-role-badge ${selected}`}>{selected === "inspector" ? <ClipboardCheck size={13}/> : <ShieldCheck size={13}/>} {selected === "inspector" ? "Field Inspector" : "Administrator"}</div>
          <div className="login-card-header"><h2>{selected === "inspector" ? "Inspector login" : "Admin login"}</h2><p>Sign in to access {selected === "inspector" ? "your field workspace" : "the admin console"}</p></div>
          <form className="login-form" onSubmit={submit}>
            <div className="login-field"><label>Username</label><input type="text" placeholder="Enter username" value={user} onChange={e => setUser(e.target.value)} autoFocus/></div>
            <div className="login-field"><label>Password</label><div className="pass-wrap"><input type={showPass ? "text" : "password"} placeholder="••••••••" value={pass} onChange={e => setPass(e.target.value)}/><button type="button" className="pass-toggle" onClick={() => setShowPass(v => !v)}>{showPass ? <EyeOff size={14}/> : <Eye size={14}/>}</button></div></div>
            <label className="remember-check"><input type="checkbox" checked={rememberDevice} onChange={e => setRememberDevice(e.target.checked)}/><span>Remember this device</span></label>
            {err && <div className="login-error">{err}</div>}
            <button type="submit" className={`login-submit ${selected}`} disabled={loading || !user || !pass}>{loading && <span className="login-spinner"/>}{loading ? "Signing in…" : `Sign in as ${selected === "inspector" ? "Inspector" : "Admin"}`}</button>
          </form>
        </>}
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

function Inspections({ openInspection }: any) { const [q,setQ]=useState(""); const rows = [["INS-2026-TN-0001","TRF-102","Substation A","DRAFT","HIGH","22 Sep 2026","68%"],["INS-2026-TN-0002","TRF-117","Substation B","SUBMITTED","MEDIUM","21 Sep 2026","100%"],["INS-2026-TN-0003","PMP-301","Pump House 4","UNDER REVIEW","LOW","20 Sep 2026","100%"],["INS-2026-TN-0004","TRF-203","Substation C","APPROVED","MEDIUM","18 Sep 2026","100%"]]; const filtered=rows.filter(r=>r.join(" ").toLowerCase().includes(q.toLowerCase())); return <><PageIntro eyebrow="WORKSPACE / INSPECTIONS" title="My inspections" description="Manage field inspections, completion state, and submission readiness." actions={<button className="btn primary" onClick={openInspection}><PlusIcon/> New inspection</button>}/><div className="toolbar"><div className="searchbox"><Search size={16}/><input placeholder="Search by inspection ID, machine, or site" value={q} onChange={e=>setQ(e.target.value)}/></div><button className="btn secondary"><Filter size={15}/> Filters <span className="filter-count">2</span></button><button className="btn secondary"><SlidersHorizontal size={15}/> Sort</button><div className="view-toggle"><button className="active"><Table2 size={16}/></button><button><ListChecks size={16}/></button></div></div><section className="panel table-panel"><div className="table-top"><div><strong>Inspection register</strong><span>{filtered.length} records · Updated just now</span></div><button className="text-btn"><Download size={14}/> Export CSV</button></div><div className="table-wrap"><table><thead><tr><th>Inspection ID</th><th>Machine / site</th><th>Status</th><th>Priority</th><th>Last updated</th><th>Completion</th><th></th></tr></thead><tbody>{filtered.map(r=><tr key={r[0]} onClick={openInspection}><td><strong className="linkish">{r[0]}</strong><span className="table-sub">Officer · Arun Kumar</span></td><td><strong>{r[1]}</strong><span className="table-sub">{r[2]}</span></td><td><StatusChip status={r[3]}/></td><td><span className={"priority " + r[4].toLowerCase()}>{r[4]}</span></td><td>{r[5]}</td><td><div className="completion"><div><i style={{width:r[6]}}></i></div><span>{r[6]}</span></div></td><td><ChevronRight size={16}/></td></tr>)}</tbody></table></div></section></> }
function StatusChip({status}: {status:string}) { return <span className={"status-chip " + status.toLowerCase().replace(" ","-")}><span></span>{status}</span> }

function Workspace({status,setStatus,checklist,saveEdit,offline,go,resolved,setResolved}:any){ const [tab,setTab]=useState("Checklist"); const percent=Math.round(checklist.filter((x:any)=>x.value).length/checklist.length*100); return <><div className="workspace-header"><button className="back-btn" onClick={()=>go("inspections")}>← Inspections</button><div className="workspace-title"><div><div className="eyebrow">INSPECTION / ACTIVE RECORD</div><h2>INS-2026-TN-0001</h2></div><StatusChip status={status}/></div><div className="workspace-meta"><div><span>Machine</span><strong>TRF-102 · Transformer T-102</strong></div><div><span>Site</span><strong>Substation A · Chennai North</strong></div><div><span>Saved locally</span><strong className="saved-label"><Check size={14}/> just now</strong></div><div><span>Connection</span><strong className={offline ? "offline-label" : "online-label"}>{offline ? <CloudOff size={14}/> : <Cloud size={14}/>} {offline ? "OFFLINE" : "ONLINE"}</strong></div></div></div><div className="workspace-tabs">{["Overview","Checklist","Evidence","Remarks","History","Conflicts","Submission"].map(x=><button className={tab===x?"active":""} onClick={()=>setTab(x)} key={x}>{x}{x === "Conflicts" && !resolved && <em>1</em>}</button>)}</div>{tab === "Checklist" && <div className="workspace-grid"><section className="panel checklist-panel"><div className="checklist-heading"><div><div className="eyebrow">CHECKLIST / TRANSFORMER ROUTINE</div><h3>Equipment condition assessment</h3><p>Complete all required readings before submitting this inspection.</p></div><div className="progress-circle"><strong>{percent}%</strong><span>complete</span></div></div><div className="check-items">{checklist.map((item:any,i:number)=><div className="check-item" key={item.id}><div className="check-num">{item.id}</div><div className="check-label"><strong>{item.label}{item.required&&<b>*</b>}</strong><span>{item.helper}</span></div><div className="check-field"><input value={item.value} onChange={e=>saveEdit(i,e.target.value)}/><CheckCircle2 size={16}/></div><MoreHorizontal size={17}/></div>)}<div className="remarks-field"><label>06 · Remarks <span>optional</span></label><textarea placeholder="Add field observations or remarks…" defaultValue="Minor surface dust observed. No action required." onChange={()=>toast("Remark saved locally")}/><span className="saved-inline"><Check size={13}/> Saved locally</span></div></div><div className="checklist-footer"><span><LockKeyhole size={14}/> Required fields validated locally</span><button className="btn primary" onClick={()=>{setStatus("SUBMITTED");toast.success("Inspection submitted",{description:"Inspection moved to supervisor review."})}} disabled={status === "SUBMITTED" || status === "APPROVED"}>{status === "DRAFT" ? <><Send size={15}/> Submit for review</> : <><CheckCircle2 size={15}/> Submitted</>}</button></div></section><aside className="workspace-side"><section className="panel mini-panel"><PanelHeader title="Submission readiness" icon={<FileCheck2 size={16}/>} /><div className="readiness-meter"><div><strong>{resolved ? "100" : "82"}%</strong><span>{resolved ? "Ready to submit" : "1 item needs attention"}</span></div><div className="meter"><i style={{width: resolved ? "100%":"82%"}}></i></div></div><div className="mini-check"><CheckCircle2 size={15}/> Checklist complete <span>5 / 5</span></div><div className={resolved?"mini-check":"mini-check warn"}>{resolved?<CheckCircle2 size={15}/>:<AlertTriangle size={15}/>} Critical conflicts {resolved?"Resolved":"1 unresolved"}</div></section><section className="panel mini-panel"><PanelHeader title="Field traceability" icon={<Link2 size={16}/>} /><div className="trace-row"><div className="avatar small">AK</div><div><strong>Arun Kumar</strong><span>Field Officer · EMP-1024</span></div></div><div className="trace-info"><span>Device</span><strong>DEV-0001 · Android</strong><span>Operation ID</span><strong className="mono">OP-7F31-A9C2</strong></div></section></aside></div>}{tab === "Conflicts" && <Conflicts resolved={resolved} setResolved={(v:any)=>{setResolved(v);toast.success("Conflict resolved",{description:"Resolution appended to the audit trail."})}}/>}{tab === "History" && <HistoryPage/>}{tab === "Evidence" && <Evidence savedCount={2}/>} {tab === "Submission" && <Submission status={status} setStatus={setStatus}/>} {tab === "Overview" && <Overview/>}{tab === "Remarks" && <div className="empty-tab panel"><Sparkles size={20}/><h3>Remarks workspace</h3><p>Field notes, observations, and follow-up actions are protected locally.</p></div>}</> }
function Overview(){return <div className="overview-grid"><div className="panel overview-hero"><div className="machine-illustration"><div className="transformer"><span></span><span></span><span></span></div></div><div><div className="eyebrow">MACHINE PROFILE</div><h3>TRF-102 · Transformer T-102</h3><p>Operational · 132 / 33 kV · Installed 2018</p><div className="overview-tags"><span>Substation A</span><span>Last inspected 18 Sep 2026</span></div></div></div><div className="panel"><PanelHeader title="Previous readings" icon={<History size={16}/>} /><div className="reading-grid">{[["Oil temperature","72 °C","18 Sep"],["Oil level","84 %","18 Sep"],["Load current","184 A","18 Sep"],["Condition","Normal","18 Sep"]].map(x=><div key={x[0]}><span>{x[0]}</span><strong>{x[1]}</strong><small>{x[2]}</small></div>)}</div></div></div>}
function Submission({status,setStatus}:any){return <div className="submission-grid"><section className="panel submission-panel"><div className="eyebrow">APPROVAL WORKFLOW</div><h3>Inspection lifecycle</h3><div className="workflow">{["DRAFT","SUBMITTED","UNDER REVIEW","APPROVED"].map((x,i)=><div className={(status===x||["SUBMITTED","UNDER REVIEW","APPROVED"].indexOf(status)>i)?"step done":"step"} key={x}><div>{(["SUBMITTED","UNDER REVIEW","APPROVED"].indexOf(status)>i||status===x)?<Check size={15}/>:i+1}</div><span>{x}</span></div>)}</div><div className="submission-note"><ShieldCheck size={18}/><div><strong>Traceable submission</strong><p>Submitting creates an append-only audit event and queues the package for supervisor review.</p></div></div><button className="btn primary" onClick={()=>{setStatus("SUBMITTED");toast.success("Submitted for review")}}><Send size={15}/> Submit inspection</button></section><section className="panel"><PanelHeader title="Validation summary" icon={<CheckCircle2 size={16}/>} />{["All required checklist values present","Evidence package attached","No critical conflicts","Local changes synchronized"].map((x,i)=><div className="validation-row" key={x}><CheckCircle2 size={16}/><span>{x}</span><small>{i===3?"Pending":"Passed"}</small></div>)}</section></div>}

function Machines({go}:any){return <><PageIntro eyebrow="ASSET REGISTER / MACHINES" title="Machines" description="Offline-cached equipment registry for field identification and inspection context." actions={<button className="btn primary" onClick={()=>go("scanner")}><QrCode size={16}/> Scan machine</button>}/><div className="machine-grid">{[["TRF-102","Transformer T-102","Substation A","Operational","132 / 33 kV","green"],["TRF-117","Transformer T-117","Substation B","Operational","132 / 33 kV","green"],["TRF-203","Transformer T-203","Substation C","Maintenance","220 / 110 kV","amber"],["PMP-301","Cooling Pump P-301","Pump House 4","Operational","45 kW","green"]].map(x=><button className="machine-card panel" key={x[0]} onClick={()=>go("workspace")}><div className="machine-top"><div className="machine-icon"><Cog size={20}/></div><StatusChip status={x[3] === "Operational" ? "APPROVED" : "UNDER REVIEW"}/></div><div className="eyebrow">{x[0]}</div><h3>{x[1]}</h3><p>{x[2]}</p><div className="machine-footer"><span>{x[4]}</span><span>Last check · 18 Sep</span><ChevronRight size={15}/></div></button>)}</div></>}
function Scanner({go}:any){const [scanned,setScanned]=useState(false); return <><PageIntro eyebrow="FIELD TOOLS / IDENTIFICATION" title="QR scanner" description="Identify a machine from its QR label, even when the device is offline." actions={<span className="ready-chip"><span></span> Camera ready</span>}/><div className="scanner-layout"><section className="panel scanner-panel"><div className="scanner-frame"><div className="scan-corner tl"></div><div className="scan-corner tr"></div><div className="scan-corner bl"></div><div className="scan-corner br"></div><div className="scan-line"></div><QrCode size={78} strokeWidth={1}/></div><p>Point camera at a machine QR label</p><button className="btn primary" onClick={()=>{setScanned(true);toast.success("Machine identified",{description:"TRF-102 found in offline machine cache."})}}><QrCode size={16}/> Simulate scan · TRF-102</button></section>{scanned?<section className="panel machine-result"><div className="result-badge"><CheckCircle2 size={16}/> MACHINE FOUND OFFLINE</div><div className="eyebrow">MACHINE RECORD</div><h3>TRF-102 · Transformer T-102</h3><p>Substation A · Chennai North</p><div className="result-list"><div><span>Status</span><strong className="online-label"><span className="status-dot"></span> Operational</strong></div><div><span>Last inspection</span><strong>18 Sep 2026</strong></div><div><span>Previous readings</span><strong>4 values cached</strong></div><div><span>QR identifier</span><strong className="mono">TRF-102</strong></div></div><div className="result-actions"><button className="btn primary" onClick={()=>go("workspace")}>Start inspection <ArrowRight size={15}/></button><button className="btn secondary" onClick={()=>go("history")}>View history</button></div></section>:<section className="panel scanner-help"><QrCode size={30}/><h3>Fast, offline identification</h3><p>Machine records are cached on this device. Scan a label to retrieve specifications, prior readings, and inspection history without a network connection.</p></section>}</div></>}

function Evidence({savedCount}:any){return <><PageIntro eyebrow="INSPECTION / EVIDENCE" title="Evidence gallery" description="Photos and files are stored locally first, then uploaded through the sync queue." actions={<button className="btn primary" onClick={()=>toast.success("Evidence captured locally",{description:"EVD-2026-00002 added to the upload queue."})}><Upload size={15}/> Capture photo</button>}/><div className="evidence-summary"><div><HardDrive size={17}/><span>Local evidence</span><strong>06 items</strong></div><div><Upload size={17}/><span>Pending upload</span><strong>{savedCount + 1} items</strong></div><div><CheckCircle2 size={17}/><span>Uploaded</span><strong>14 items</strong></div></div><div className="evidence-grid">{[["EVD-2026-00001","Oil temperature gauge","Uploaded","10:43","amber"],["EVD-2026-00002","Equipment condition","Saved locally","10:45","blue"],["EVD-2026-00003","Safety lockout tag","Uploaded","10:46","purple"],["EVD-2026-00004","Transformer nameplate","Uploaded","10:49","green"]].map(x=><div className="evidence-card panel" key={x[0]}><div className={"evidence-preview " + x[4]}><FileText size={30}/><span>PHOTO</span></div><div className="evidence-copy"><strong>{x[1]}</strong><span>{x[0]} · INS-2026-TN-0001</span><small><span className={x[2] === "Uploaded" ? "green-dot" : "amber-dot"}></span>{x[2]} · {x[3]}</small></div><MoreHorizontal size={16}/></div>)}</div></>}

function SyncCenter({savedCount,sync}:any){return <><PageIntro eyebrow="RELIABILITY / SYNCHRONIZATION" title="Sync center" description="Every local operation is traceable, resumable, and safe to retry." actions={<><button className="btn secondary" onClick={()=>toast("Sync paused")}>Pause queue</button><button className="btn primary" onClick={sync}><RefreshCw size={15}/> Sync now</button></>}/><div className="sync-cards"><div className="sync-stat"><span>Pending changes</span><strong>{savedCount}</strong><small>Local operations</small></div><div className="sync-stat"><span>Pending uploads</span><strong>01</strong><small>Evidence files</small></div><div className="sync-stat"><span>Completed today</span><strong>24</strong><small>98.4% success</small></div><div className="sync-stat danger-card"><span>Failed</span><strong>00</strong><small>No retries needed</small></div></div><section className="panel queue-panel"><PanelHeader title="Operation queue" icon={<RefreshCw size={16}/>} action={<StatusChip status="UNDER REVIEW"/>}/><div className="queue-row queue-head"><span>Operation</span><span>Type</span><span>Status</span><span>Progress</span><span>Created</span><span></span></div>{[["OP-7F31-A9C2","Checklist update","PENDING","10:41"],["OP-3C20-B114","Evidence upload","SYNCING","10:43"],["OP-22A1-88EF","Audit event","COMPLETED","10:44"],["OP-912B-2F10","Conflict package","COMPLETED","10:44"]].map((x,i)=><div className="queue-row" key={x[0]}><strong className="mono">{x[0]}</strong><span>{x[1]}</span><StatusChip status={x[2] === "PENDING" ? "DRAFT" : x[2] === "COMPLETED" ? "APPROVED" : "UNDER REVIEW"}/><div className="queue-progress"><i style={{width:x[2] === "COMPLETED" ? "100%" : x[2] === "SYNCING" ? "64%" : "12%"}}></i></div><span>{x[3]}</span><MoreHorizontal size={16}/></div>)}</section></>}
function Conflicts({resolved,setResolved}:any){return <><PageIntro eyebrow="TRACEABILITY / CONFLICT CENTER" title="Conflict resolution" description="Competing offline edits are surfaced for an explicit, auditable decision." actions={!resolved&&<span className="risk-chip"><AlertTriangle size={14}/> 1 critical conflict</span>}/>{resolved?<div className="resolved-banner panel"><div className="resolved-icon"><Check size={21}/></div><div><div className="eyebrow">CONFLICT RESOLVED</div><h3>CON-2026-00001 · Final value 80 °C</h3><p>Resolved by Arun Kumar · 22 Sep 2026, 11:02 · Reason recorded in audit trail.</p></div><StatusChip status="APPROVED"/></div>:<div className="conflict-layout"><section className="panel conflict-panel"><div className="conflict-top"><div><div className="eyebrow">CONFLICT DETECTED · CON-2026-00001</div><h3>Oil temperature has competing offline values</h3><p>Inspection INS-2026-TN-0001 · Checklist item 02 · Detected at 10:44</p></div><span className="critical-chip">CRITICAL RISK</span></div><div className="version-grid"><div className="version-card"><div className="version-head"><span>VERSION A</span><small>Officer A · DEV-0001</small></div><strong>78 °C</strong><p>Captured at 10:41 · Chennai North</p><button className="btn secondary" onClick={()=>setResolved(true)}>Accept Version A</button></div><div className="versus">VS</div><div className="version-card alt"><div className="version-head"><span>VERSION B</span><small>Officer B · DEV-0018</small></div><strong>83 °C</strong><p>Captured at 10:43 · Chennai North</p><button className="btn secondary" onClick={()=>setResolved(true)}>Accept Version B</button></div></div><div className="resolution-footer"><div><LockKeyhole size={15}/><span>A resolution reason is required and will be appended to the audit trail.</span></div><button className="btn primary" onClick={()=>setResolved(true)}><CheckCircle2 size={15}/> Resolve with final value</button></div></section><aside className="panel conflict-context"><PanelHeader title="Conflict context" icon={<AlertTriangle size={16}/>} />{[["Field","Oil temperature"],["Machine","TRF-102"],["Users","Arun Kumar · Priya S."],["Devices","DEV-0001 · DEV-0018"],["State","Unresolved"],["Sync batch","BATCH-09-22-1044"]].map(x=><div className="context-row" key={x[0]}><span>{x[0]}</span><strong>{x[1]}</strong></div>)}</aside></div>}</>}
function HistoryPage(){return <><PageIntro eyebrow="TRACEABILITY / TIME MACHINE" title="Inspection history" description="A chronological record of every meaningful state change." actions={<button className="btn secondary"><Download size={15}/> Export history</button>}/><section className="panel history-panel"><div className="history-head"><div><strong>INS-2026-TN-0001</strong><span>TRF-102 · Substation A</span></div><StatusChip status="UNDER REVIEW"/></div><div className="history-timeline">{[["10:00","Inspection created","Arun Kumar","Draft created from assignment","blue"],["10:41","Temperature updated","Arun Kumar · DEV-0001","72 °C → 78 °C","amber"],["10:43","Temperature updated","Priya S. · DEV-0018","72 °C → 83 °C","purple"],["10:44","Conflict detected","Sync engine","Competing values require resolution","red"],["11:02","Supervisor resolved","Meera Nair","Final value: 80 °C","green"]].map(x=><div className="history-event" key={x[0]}><time>{x[0]}</time><div className={"history-marker " + x[4]}></div><div><strong>{x[1]}</strong><span>{x[2]}</span><p>{x[3]}</p></div><ChevronRight size={16}/></div>)}</div></section></>}
function Reports(){return <><PageIntro eyebrow="COMPLIANCE / REPORTING" title="Reports" description="Generate official, PDF-ready views from locally available inspection records." actions={<button className="btn primary" onClick={()=>toast.success("Report ready",{description:"PDF-ready preview generated locally."})}><FileText size={15}/> Generate report</button>}/><div className="report-grid">{[["Inspection report","A complete field inspection record","12 records","FileCheck2"],["Machine history","Equipment readings over time","4 machines","History"],["Audit report","Append-only event export","86 events","FileClock"],["Conflict report","Resolution and risk register","1 conflict","AlertTriangle"],["Evidence report","Photo metadata and integrity","20 items","Archive"],["Compliance report","Department readiness summary","Q3 2026","ShieldCheck"]].map(x=><button className="report-card panel" key={x[0]} onClick={()=>toast("Report preview opened",{description:x[0]})}><div className="report-icon"><FileText size={19}/></div><div><h3>{x[0]}</h3><p>{x[1]}</p><span>{x[2]}</span></div><ArrowRight size={16}/></button>)}</div></>}
function Audit(){return <><PageIntro eyebrow="SECURITY / APPEND-ONLY LOG" title="Audit trail" description="Every create, edit, submit, approve, and conflict action is preserved." actions={<button className="btn secondary"><Download size={15}/> Export CSV</button>}/><section className="panel audit-panel"><div className="toolbar compact"><div className="searchbox"><Search size={16}/><input placeholder="Search operation ID, user, or action"/></div><button className="btn secondary"><Filter size={15}/> All actions</button><button className="btn secondary">Last 30 days</button></div><div className="audit-table"><div className="audit-row audit-head"><span>Timestamp</span><span>User / role</span><span>Action</span><span>Field</span><span>Operation ID</span></div>{[["22 Sep · 11:02","Meera Nair · Supervisor","Conflict resolved","Oil temperature","OP-RES-9921"],["22 Sep · 10:44","Sync engine · System","Conflict created","Oil temperature","OP-CON-7F31"],["22 Sep · 10:43","Arun Kumar · Officer","Photo added","Evidence","OP-EVD-0002"],["22 Sep · 10:41","Arun Kumar · Officer","Edit","Oil temperature","OP-7F31-A9C2"],["22 Sep · 10:00","Arun Kumar · Officer","Create","Inspection","OP-INS-0001"]].map(x=><div className="audit-row" key={x[4]}><span>{x[0]}</span><strong>{x[1]}</strong><StatusChip status={x[2] === "Conflict resolved" ? "APPROVED" : "UNDER REVIEW"}/><span>{x[3]}</span><span className="mono">{x[4]}</span></div>)}</div></section></>}
function Admin(){return <><PageIntro eyebrow="ADMINISTRATION / CONTROL PLANE" title="Admin console" description="Manage users, roles, machines, templates, devices, and schema versions." actions={<button className="btn primary" onClick={()=>toast("Admin action ready")}> <Users size={15}/> Add user</button>}/><div className="admin-grid">{[["Users & roles","18 users · 4 roles","Users"],["Machine registry","48 registered assets","Cog"],["Inspection templates","06 active templates","ClipboardCheck"],["Devices","22 managed devices","Smartphone"],["Schema versions","v1.8 current","Database"],["System settings","RBAC · security · sync","Settings2"]].map(x=><button className="admin-card panel" key={x[0]} onClick={()=>toast("Admin module opened",{description:x[0]})}><div className="admin-icon"><Settings2 size={18}/></div><div><h3>{x[0]}</h3><p>{x[1]}</p></div><ChevronRight size={16}/></button>)}</div><section className="panel security-strip"><ShieldCheck size={20}/><div><strong>Security posture</strong><span>JWT-ready architecture · HTTPS/WSS boundary · append-only audit model · no secrets in frontend</span></div><span className="ready-chip"><span></span> Healthy</span></section></>}
