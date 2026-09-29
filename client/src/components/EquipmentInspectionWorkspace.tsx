import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock3,
  Camera,
  MapPin,
  Save,
  Send,
  Building2,
  Zap,
  Tag,
  Info,
  ChevronDown,
  ChevronRight,
  PlusCircle,
  FileCheck2,
  HardDrive,
  Trash2,
  FileText,
  AlertOctagon,
  Eye,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type {
  EquipmentAsset,
  EquipmentInspectionTemplate,
  ChecklistItemTemplate,
  GovernmentFacility,
  SmartThreshold,
} from "../data/equipmentCatalog";
import type { FindingRecord, EvidenceRecord } from "../db/database";
import { recordFindingLocally, recordAuditEvent } from "../db/equipmentStorage";
import type { AppUser } from "../services/authService";

interface EquipmentInspectionWorkspaceProps {
  asset: EquipmentAsset;
  facility: GovernmentFacility;
  template: EquipmentInspectionTemplate;
  inspectionType: string;
  currentUser: AppUser | null;
  offline: boolean;
  onBack: () => void;
  onSubmitComplete: (result: {
    inspectionId: string;
    asset: EquipmentAsset;
    checklistValues: Record<string, { value: string; status: "PASS" | "WARNING" | "FAIL"; remarks?: string }>;
    safetyValues: Record<string, boolean>;
    findings: FindingRecord[];
    overallResult: "PASS" | "PASS WITH OBSERVATIONS" | "WARNING" | "FAIL" | "CRITICAL";
    summary: { total: number; passed: number; warnings: number; failed: number };
  }) => void;
  onOpenLiveCamera: () => void;
  evidenceList: EvidenceRecord[];
}

export function EquipmentInspectionWorkspace({
  asset,
  facility,
  template,
  inspectionType,
  currentUser,
  offline,
  onBack,
  onSubmitComplete,
  onOpenLiveCamera,
  evidenceList,
}: EquipmentInspectionWorkspaceProps) {
  const [inspectionId] = useState(
    () => `INS-2026-GOV-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [checklistValues, setChecklistValues] = useState<
    Record<
      string,
      { value: string; status: "PASS" | "WARNING" | "FAIL"; remarks?: string }
    >
  >(() => {
    const initial: Record<
      string,
      { value: string; status: "PASS" | "WARNING" | "FAIL"; remarks?: string }
    > = {};
    template.sections.forEach(sec => {
      sec.items.forEach(item => {
        initial[item.id] = {
          value: item.defaultValue || (item.type === "PASS_FAIL" ? "PASS" : item.type === "NORMAL_ABNORMAL" ? "Normal" : item.type === "YES_NO" ? "Yes" : ""),
          status: "PASS",
        };
      });
    });
    return initial;
  });

  const [safetyValues, setSafetyValues] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    template.safetyChecks.forEach(chk => {
      initial[chk.id] = false;
    });
    return initial;
  });

  const [activeSectionId, setActiveSectionId] = useState<string>(
    template.sections[0]?.id || ""
  );
  const [activeTab, setActiveTab] = useState<"checklist" | "safety" | "findings" | "evidence">("checklist");
  const [findings, setFindings] = useState<FindingRecord[]>([]);

  // Finding creation modal state
  const [showFindingModal, setShowFindingModal] = useState(false);
  const [activeFindingItem, setActiveFindingItem] = useState<ChecklistItemTemplate | null>(null);
  const [findingTitle, setFindingTitle] = useState("");
  const [findingSeverity, setFindingSeverity] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("HIGH");
  const [findingRemark, setFindingRemark] = useState("");

  // GPS coordinates capture
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setGpsLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setGpsLocation({ lat: 11.0168, lng: 76.9558 }) // Coimbatore Substation GPS default
      );
    }
  }, []);

  // Record start audit event
  useEffect(() => {
    recordAuditEvent({
      action: "INSPECTION_STARTED",
      user: currentUser?.name || currentUser?.displayName || "Mohammed Sameer",
      assetId: asset.assetCode,
      inspectionId,
      details: `Started ${inspectionType} inspection for ${asset.name} (${template.name})`,
      isOffline: offline,
    });
  }, []);

  // Evaluate smart threshold for entered value
  const evaluateThreshold = (
    item: ChecklistItemTemplate,
    valStr: string
  ): { status: "PASS" | "WARNING" | "FAIL"; alertText?: string } => {
    if (!item.threshold || valStr.trim() === "") {
      return { status: "PASS" };
    }
    const num = parseFloat(valStr);
    if (isNaN(num)) return { status: "PASS" };

    const t = item.threshold;
    if (t.criticalMin !== undefined && num >= t.criticalMin) {
      return { status: "FAIL", alertText: `CRITICAL: ${num} ${t.unit} exceeds upper critical threshold (${t.criticalMin} ${t.unit})` };
    }
    if (t.criticalMax !== undefined && num <= t.criticalMax) {
      return { status: "FAIL", alertText: `CRITICAL: ${num} ${t.unit} below minimum critical limit (${t.criticalMax} ${t.unit})` };
    }
    if (t.warningMin !== undefined && num <= t.warningMin) {
      return { status: "WARNING", alertText: `WARNING: ${num} ${t.unit} within caution range (Limit: ${t.warningMin} ${t.unit})` };
    }
    if (t.warningMax !== undefined && num >= t.warningMax) {
      return { status: "WARNING", alertText: `WARNING: ${num} ${t.unit} within warning range (Upper limit: ${t.warningMax} ${t.unit})` };
    }
    return { status: "PASS" };
  };

  const handleFieldChange = (item: ChecklistItemTemplate, val: string) => {
    const evalRes = evaluateThreshold(item, val);
    let itemStatus: "PASS" | "WARNING" | "FAIL" = evalRes.status;

    if (item.type === "PASS_FAIL") {
      itemStatus = val === "PASS" ? "PASS" : "FAIL";
    } else if (item.type === "NORMAL_ABNORMAL") {
      itemStatus = val === "Normal" ? "PASS" : "FAIL";
    } else if (item.type === "YES_NO") {
      itemStatus = val === "Yes" ? "PASS" : "WARNING";
    }

    setChecklistValues(prev => ({
      ...prev,
      [item.id]: {
        value: val,
        status: itemStatus,
        remarks: prev[item.id]?.remarks,
      },
    }));

    // If item failed or reached critical, offer finding prompt
    if (itemStatus === "FAIL" || itemStatus === "WARNING") {
      setActiveFindingItem(item);
    }
  };

  const handleOpenCreateFinding = (item: ChecklistItemTemplate) => {
    setActiveFindingItem(item);
    setFindingTitle(`Abnormal reading on ${item.label}`);
    setFindingSeverity(checklistValues[item.id]?.status === "FAIL" ? "HIGH" : "MEDIUM");
    setFindingRemark(checklistValues[item.id]?.remarks || `Entered value: ${checklistValues[item.id]?.value} ${item.unit || ""}`);
    setShowFindingModal(true);
  };

  const handleSaveFinding = async () => {
    if (!findingTitle.trim()) return;
    const newFinding: FindingRecord = {
      id: `FND-${Date.now().toString(36)}-${Math.floor(100 + Math.random() * 900)}`,
      inspectionId,
      assetId: asset.assetCode,
      title: findingTitle.trim(),
      severity: findingSeverity,
      location: asset.locationName,
      remark: findingRemark.trim(),
      status: "OPEN",
      createdAt: new Date().toISOString(),
    };

    await recordFindingLocally(newFinding);
    setFindings(prev => [newFinding, ...prev]);
    setShowFindingModal(false);
    toast.success("Inspection finding created & saved offline in IndexedDB");
  };

  // Calculate results summary
  const totalItems = Object.keys(checklistValues).length;
  const passedCount = Object.values(checklistValues).filter(v => v.status === "PASS").length;
  const warningsCount = Object.values(checklistValues).filter(v => v.status === "WARNING").length;
  const failedCount = Object.values(checklistValues).filter(v => v.status === "FAIL").length;

  let overallResult: "PASS" | "PASS WITH OBSERVATIONS" | "WARNING" | "FAIL" | "CRITICAL" = "PASS";
  if (failedCount > 0 && findings.some(f => f.severity === "CRITICAL")) {
    overallResult = "CRITICAL";
  } else if (failedCount > 0) {
    overallResult = "FAIL";
  } else if (warningsCount > 0) {
    overallResult = findings.length > 0 ? "WARNING" : "PASS WITH OBSERVATIONS";
  }

  const allSafetyChecked = template.safetyChecks.every(chk => !chk.required || safetyValues[chk.id]);

  const handleSubmit = () => {
    if (!allSafetyChecked) {
      setActiveTab("safety");
      toast.warning("Mandatory Safety Checklist Incomplete", {
        description: "Please verify all required electrical safety and PPE precautions before submitting.",
      });
      return;
    }

    onSubmitComplete({
      inspectionId,
      asset,
      checklistValues,
      safetyValues,
      findings,
      overallResult,
      summary: {
        total: totalItems,
        passed: passedCount,
        warnings: warningsCount,
        failed: failedCount,
      },
    });
  };

  return (
    <div className="equipment-workspace-shell">
      {/* Workspace Top Header Bar */}
      <div className="workspace-header-bar">
        <div className="workspace-header-left">
          <button className="back-btn" onClick={onBack}>
            <ArrowLeft size={16} /> Back to Asset Catalog
          </button>
          <div className="workspace-title-row">
            <h2>{asset.name}</h2>
            <span className="workspace-asset-tag mono">{asset.assetCode}</span>
            <span className="workspace-voltage-tag">{asset.voltageRating}</span>
          </div>
          <p className="workspace-location-line">
            <Building2 size={13} />
            <span>
              {facility.name} · {asset.locationName} · {template.name}
            </span>
          </p>
        </div>

        <div className="workspace-header-right">
          <div className="workspace-quick-summary">
            <div className="quick-stat">
              <span>Passed</span>
              <strong style={{ color: "#16a34a" }}>{passedCount}</strong>
            </div>
            <div className="quick-stat">
              <span>Warnings</span>
              <strong style={{ color: "#d97706" }}>{warningsCount}</strong>
            </div>
            <div className="quick-stat">
              <span>Failed</span>
              <strong style={{ color: "#dc2626" }}>{failedCount}</strong>
            </div>
          </div>

          <button className="btn primary submit-inspection-btn" onClick={handleSubmit}>
            <CheckCircle2 size={16} /> Complete &amp; Sign Off
          </button>
        </div>
      </div>

      {/* Workspace Tabs Navigation */}
      <div className="workspace-tabs-bar">
        <button
          type="button"
          className={`tab-btn ${activeTab === "checklist" ? "active" : ""}`}
          onClick={() => setActiveTab("checklist")}
        >
          <Zap size={14} />
          <span>Inspection Checklist ({totalItems})</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === "safety" ? "active" : ""}`}
          onClick={() => setActiveTab("safety")}
        >
          <ShieldCheck size={14} />
          <span>Safety Verification ({template.safetyChecks.length})</span>
          {!allSafetyChecked && <em className="tab-alert-badge">Required</em>}
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === "findings" ? "active" : ""}`}
          onClick={() => setActiveTab("findings")}
        >
          <AlertTriangle size={14} />
          <span>Findings &amp; Defects ({findings.length})</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === "evidence" ? "active" : ""}`}
          onClick={() => setActiveTab("evidence")}
        >
          <Camera size={14} />
          <span>Photo Evidence ({evidenceList.length})</span>
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="workspace-content-body">
        {/* ── TAB 1: EQUIPMENT CHECKLIST ── */}
        {activeTab === "checklist" && (
          <div className="checklist-layout-grid">
            {/* Sections List */}
            <div className="checklist-sections-col">
              {template.sections.map((section, sIdx) => {
                const isSectionActive = activeSectionId === section.id;
                const sectionItems = section.items;
                const sectionPassed = sectionItems.filter(
                  i => checklistValues[i.id]?.status === "PASS"
                ).length;
                const sectionFailed = sectionItems.filter(
                  i => checklistValues[i.id]?.status === "FAIL"
                ).length;
                const sectionWarning = sectionItems.filter(
                  i => checklistValues[i.id]?.status === "WARNING"
                ).length;

                return (
                  <div key={section.id} className="checklist-section-card panel">
                    <div
                      className="section-card-head"
                      onClick={() => setActiveSectionId(section.id)}
                    >
                      <div className="section-card-title">
                        <span className="section-index-num">0{sIdx + 1}</span>
                        <h3>{section.title}</h3>
                      </div>
                      <div className="section-badges">
                        {sectionFailed > 0 && (
                          <span className="badge-danger">{sectionFailed} Fail</span>
                        )}
                        {sectionWarning > 0 && (
                          <span className="badge-warning">{sectionWarning} Warn</span>
                        )}
                        <span className="badge-count">
                          {sectionPassed}/{sectionItems.length} OK
                        </span>
                        <ChevronDown
                          size={16}
                          style={{
                            transform: isSectionActive ? "rotate(180deg)" : "none",
                            transition: "transform 0.15s ease",
                          }}
                        />
                      </div>
                    </div>

                    {isSectionActive && (
                      <div className="section-items-body">
                        {section.items.map(item => {
                          const current = checklistValues[item.id] || {
                            value: "",
                            status: "PASS",
                          };
                          const evalRes = evaluateThreshold(item, current.value);

                          return (
                            <div
                              key={item.id}
                              className={`checklist-item-row ${
                                current.status === "FAIL"
                                  ? "is-fail"
                                  : current.status === "WARNING"
                                  ? "is-warning"
                                  : ""
                              }`}
                            >
                              <div className="item-info-col">
                                <div className="item-label-line">
                                  <strong>{item.label}</strong>
                                  {item.required && <b className="req-star">*</b>}
                                  {item.unit && <span className="unit-pill">{item.unit}</span>}
                                </div>
                                {item.helperText && (
                                  <p className="item-helper-text">{item.helperText}</p>
                                )}
                                {evalRes.alertText && (
                                  <div
                                    className={`threshold-alert-tag ${
                                      evalRes.status === "FAIL" ? "danger" : "warning"
                                    }`}
                                  >
                                    <AlertTriangle size={12} />
                                    <span>{evalRes.alertText}</span>
                                  </div>
                                )}
                              </div>

                              {/* Interactive Controls */}
                              <div className="item-control-col">
                                {item.type === "PASS_FAIL" ? (
                                  <div className="toggle-btn-group">
                                    <button
                                      type="button"
                                      className={`toggle-opt pass ${
                                        current.value === "PASS" ? "active" : ""
                                      }`}
                                      onClick={() => handleFieldChange(item, "PASS")}
                                    >
                                      PASS
                                    </button>
                                    <button
                                      type="button"
                                      className={`toggle-opt fail ${
                                        current.value === "FAIL" ? "active" : ""
                                      }`}
                                      onClick={() => handleFieldChange(item, "FAIL")}
                                    >
                                      FAIL
                                    </button>
                                  </div>
                                ) : item.type === "NORMAL_ABNORMAL" ? (
                                  <div className="toggle-btn-group">
                                    <button
                                      type="button"
                                      className={`toggle-opt pass ${
                                        current.value === "Normal" ? "active" : ""
                                      }`}
                                      onClick={() => handleFieldChange(item, "Normal")}
                                    >
                                      Normal
                                    </button>
                                    <button
                                      type="button"
                                      className={`toggle-opt fail ${
                                        current.value === "Abnormal" ? "active" : ""
                                      }`}
                                      onClick={() => handleFieldChange(item, "Abnormal")}
                                    >
                                      Abnormal
                                    </button>
                                  </div>
                                ) : item.type === "YES_NO" ? (
                                  <div className="toggle-btn-group">
                                    <button
                                      type="button"
                                      className={`toggle-opt pass ${
                                        current.value === "Yes" ? "active" : ""
                                      }`}
                                      onClick={() => handleFieldChange(item, "Yes")}
                                    >
                                      Yes
                                    </button>
                                    <button
                                      type="button"
                                      className={`toggle-opt fail ${
                                        current.value === "No" ? "active" : ""
                                      }`}
                                      onClick={() => handleFieldChange(item, "No")}
                                    >
                                      No
                                    </button>
                                  </div>
                                ) : item.type === "DROPDOWN" && item.options ? (
                                  <select
                                    value={current.value}
                                    onChange={e => handleFieldChange(item, e.target.value)}
                                    className="item-select-control"
                                  >
                                    {item.options.map(opt => (
                                      <option key={opt} value={opt}>
                                        {opt}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <div className="numeric-input-wrap">
                                    <input
                                      type="text"
                                      className="item-text-input mono"
                                      placeholder={`Enter ${item.unit || "value"}`}
                                      value={current.value}
                                      onChange={e => handleFieldChange(item, e.target.value)}
                                    />
                                    {item.unit && <span className="input-unit">{item.unit}</span>}
                                  </div>
                                )}

                                {/* Action button to flag finding */}
                                {(current.status === "FAIL" || current.status === "WARNING") && (
                                  <button
                                    type="button"
                                    className="btn-create-finding"
                                    onClick={() => handleOpenCreateFinding(item)}
                                    title="Create formal inspection defect finding"
                                  >
                                    <PlusCircle size={13} />
                                    <span>Log Finding</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Sticky Sidebar Summary */}
            <div className="checklist-summary-col">
              <div className="panel summary-sticky-card">
                <div className="summary-card-head">
                  <ShieldCheck size={16} color="#1c6384" />
                  <h4>Inspection Sign-Off Readiness</h4>
                </div>

                <div className="summary-stat-grid">
                  <div className="summary-stat-box">
                    <span>Overall Health</span>
                    <strong
                      className={`status-text ${
                        overallResult === "PASS"
                          ? "green"
                          : overallResult === "WARNING"
                          ? "amber"
                          : "red"
                      }`}
                    >
                      {overallResult}
                    </strong>
                  </div>
                  <div className="summary-stat-box">
                    <span>GPS Telemetry</span>
                    <strong className="mono">
                      {gpsLocation ? `${gpsLocation.lat.toFixed(4)}, ${gpsLocation.lng.toFixed(4)}` : "Acquiring..."}
                    </strong>
                  </div>
                </div>

                <div className="summary-checklist-progress">
                  <div className="progress-bar-wrap">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${Math.round((passedCount / Math.max(totalItems, 1)) * 100)}%`,
                      }}
                    ></div>
                  </div>
                  <div className="progress-meta-line">
                    <span>{passedCount} of {totalItems} Items Checked</span>
                    <strong>{Math.round((passedCount / Math.max(totalItems, 1)) * 100)}%</strong>
                  </div>
                </div>

                <div className="evidence-quick-btn-box">
                  <button className="btn secondary" onClick={onOpenLiveCamera} style={{ width: "100%" }}>
                    <Camera size={15} /> Capture Photo Evidence
                  </button>
                </div>

                <div className="offline-storage-info-tag">
                  <HardDrive size={13} color="#286485" />
                  <span>Records encrypted in Dexie IndexedDB</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: SAFETY VERIFICATION ── */}
        {activeTab === "safety" && (
          <div className="panel" style={{ padding: 22, maxWidth: 840, margin: "0 auto" }}>
            <div className="safety-section-head">
              <div className="safety-icon-badge">
                <ShieldCheck size={28} />
              </div>
              <div>
                <h3>Mandatory Electrical Safety &amp; LOTO Verification</h3>
                <p>
                  In accordance with CEA Safety Regulations and Government Substation Safety Protocol, all items must be physically verified before sign-off.
                </p>
              </div>
            </div>

            <div className="safety-items-list">
              {template.safetyChecks.map(check => {
                const isChecked = safetyValues[check.id] || false;
                return (
                  <label key={check.id} className={`safety-check-row ${isChecked ? "checked" : ""}`}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={e => {
                        setSafetyValues(prev => ({
                          ...prev,
                          [check.id]: e.target.checked,
                        }));
                      }}
                    />
                    <div className="safety-label-content">
                      <strong>{check.label}</strong>
                      {check.standardRef && <span className="ref-tag">{check.standardRef}</span>}
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="safety-footer-action">
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  if (allSafetyChecked) {
                    setActiveTab("checklist");
                    toast.success("Safety checklist verified");
                  } else {
                    toast.warning("Please check all required safety items");
                  }
                }}
              >
                <Check size={16} /> Confirm Safety Protocol &amp; Return to Checklist
              </button>
            </div>
          </div>
        )}

        {/* ── TAB 3: FINDINGS & DEFECTS ── */}
        {activeTab === "findings" && (
          <div className="panel" style={{ padding: 22 }}>
            <div className="findings-tab-header">
              <div>
                <h3>Inspection Findings &amp; Corrective Actions ({findings.length})</h3>
                <p>
                  Formal defect logs recorded during this inspection. Synced to maintenance work order system.
                </p>
              </div>

              <button
                className="btn primary"
                onClick={() => {
                  setFindingTitle("General inspection defect");
                  setFindingSeverity("MEDIUM");
                  setFindingRemark("");
                  setShowFindingModal(true);
                }}
              >
                <PlusCircle size={15} /> Add Custom Finding
              </button>
            </div>

            {findings.length === 0 ? (
              <div className="wizard-empty-box" style={{ padding: 40 }}>
                <CheckCircle2 size={32} color="#16a34a" />
                <h4>No active defects or findings recorded</h4>
                <p>All checklist parameters are within acceptable statutory limits.</p>
              </div>
            ) : (
              <div className="findings-grid">
                {findings.map(f => (
                  <div key={f.id} className="finding-card">
                    <div className="finding-card-head">
                      <span className={`finding-severity-tag ${f.severity.toLowerCase()}`}>
                        {f.severity} PRIORITY
                      </span>
                      <span className="finding-id mono">{f.id}</span>
                    </div>
                    <h4>{f.title}</h4>
                    <p>{f.remark}</p>
                    <div className="finding-meta">
                      <span>Location: {f.location || asset.locationName}</span>
                      <span>•</span>
                      <span>Status: OPEN</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 4: PHOTO EVIDENCE ── */}
        {activeTab === "evidence" && (
          <div className="panel" style={{ padding: 22 }}>
            <div className="findings-tab-header">
              <div>
                <h3>Inspection Photo Evidence &amp; Visual Records</h3>
                <p>
                  Tamper-proof local evidence photos linked to {asset.assetCode} with GPS coordinates and timestamp.
                </p>
              </div>

              <button className="btn primary" onClick={onOpenLiveCamera}>
                <Camera size={15} /> Take Live Photo
              </button>
            </div>

            {evidenceList.length === 0 ? (
              <div className="wizard-empty-box" style={{ padding: 40 }}>
                <Camera size={32} color="#94a3b8" />
                <h4>No photo evidence captured for this inspection yet</h4>
                <p>Click "Take Live Photo" or use device camera to capture field evidence.</p>
              </div>
            ) : (
              <div className="evidence-grid">
                {evidenceList.map(ev => (
                  <div key={ev.id} className="evidence-card panel">
                    <div className="evidence-preview blue">
                      <span>{ev.fileName || ev.name}</span>
                    </div>
                    <div className="evidence-copy">
                      <strong>{ev.description || ev.title || "Inspection Evidence"}</strong>
                      <span>{ev.id}</span>
                      <small>
                        <span className="dot green-dot"></span> Saved Locally in IndexedDB
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── CREATE FINDING MODAL ── */}
      {showFindingModal && (
        <div className="modal-overlay" onClick={() => setShowFindingModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div className="modal-icon-badge" style={{ background: "#fee2e2", color: "#dc2626" }}>
                <AlertTriangle size={28} />
              </div>
              <h3>Log Inspection Finding</h3>
              <p>Record a formal defect report for {asset.assetCode}</p>
            </div>

            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="wizard-form-field">
                <label>Finding / Defect Summary</label>
                <input
                  type="text"
                  className="item-text-input"
                  value={findingTitle}
                  onChange={e => setFindingTitle(e.target.value)}
                  placeholder="e.g. Oil leakage at main radiator flange"
                />
              </div>

              <div className="wizard-form-field">
                <label>Severity Level</label>
                <select
                  value={findingSeverity}
                  onChange={e => setFindingSeverity(e.target.value as any)}
                  className="wizard-select"
                >
                  <option value="LOW">Low (Observation / Minor cosmetic)</option>
                  <option value="MEDIUM">Medium (Maintenance recommended)</option>
                  <option value="HIGH">High (Urgent inspection required)</option>
                  <option value="CRITICAL">Critical (Immediate shutdown / Safety hazard)</option>
                </select>
              </div>

              <div className="wizard-form-field">
                <label>Inspector Remarks &amp; Recommended Action</label>
                <textarea
                  className="item-text-input"
                  style={{ height: 80, resize: "vertical" }}
                  value={findingRemark}
                  onChange={e => setFindingRemark(e.target.value)}
                  placeholder="Enter detailed observations and required corrective action..."
                />
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setShowFindingModal(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={handleSaveFinding}>
                Save Finding
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
