import React, { useState, useEffect } from "react";
import {
  Building2,
  Search,
  Filter,
  Zap,
  ShieldCheck,
  Calendar,
  User,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ArrowRight,
  QrCode,
  Tag,
  ChevronRight,
  Sparkles,
  MapPin,
  HardDrive,
  Info,
  PlusCircle,
  Activity,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import {
  GOVERNMENT_FACILITIES,
  ELECTRICAL_EQUIPMENT_TYPES,
  type EquipmentCategory,
  type EquipmentAsset,
  type GovernmentFacility,
  type EquipmentInspectionTemplate,
  getTemplateForEquipmentType,
} from "../data/equipmentCatalog";
import {
  getAllFacilities,
  searchEquipmentAssets,
  getAssetByCodeOrId,
} from "../db/equipmentStorage";
import type { AppUser } from "../services/authService";

interface NewInspectionWizardProps {
  currentUser: AppUser | null;
  offline: boolean;
  onStartInspection: (params: {
    asset: EquipmentAsset;
    facility: GovernmentFacility;
    inspectionType: "Routine" | "Periodic" | "Special" | "Emergency" | "Follow-up";
    template: EquipmentInspectionTemplate;
  }) => void;
  onOpenQRScanner?: () => void;
}

const CATEGORIES: Array<EquipmentCategory | "All"> = [
  "All",
  "Transformers",
  "Generators",
  "Motors",
  "Switchgear",
  "Circuit Breakers",
  "Isolation / Switching",
  "Protection",
  "Capacitors",
  "Busbar / Distribution",
  "Cables",
  "Battery / DC",
  "Earthing",
  "Metering",
  "Substation",
  "Renewable",
  "Safety",
];

export function NewInspectionWizard({
  currentUser,
  offline,
  onStartInspection,
  onOpenQRScanner,
}: NewInspectionWizardProps) {
  const [facilities, setFacilities] = useState<GovernmentFacility[]>(GOVERNMENT_FACILITIES);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>(GOVERNMENT_FACILITIES[0].id);
  const [selectedCategory, setSelectedCategory] = useState<EquipmentCategory | "All">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [assets, setAssets] = useState<EquipmentAsset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<EquipmentAsset | null>(null);
  const [inspectionType, setInspectionType] = useState<
    "Routine" | "Periodic" | "Special" | "Emergency" | "Follow-up"
  >("Periodic");
  const [loading, setLoading] = useState(false);

  // Load facilities and equipment assets from local Dexie database
  useEffect(() => {
    getAllFacilities().then(list => {
      setFacilities(list);
      if (list.length > 0 && !selectedFacilityId) {
        setSelectedFacilityId(list[0].id);
      }
    });
  }, []);

  // Filter assets locally based on facility, category, and query
  useEffect(() => {
    setLoading(true);
    searchEquipmentAssets({
      facilityId: selectedFacilityId,
      category: selectedCategory,
      searchQuery,
    }).then(results => {
      setAssets(results);
      if (results.length > 0 && (!selectedAsset || !results.find(a => a.id === selectedAsset.id))) {
        setSelectedAsset(results[0]);
      } else if (results.length === 0) {
        setSelectedAsset(null);
      }
      setLoading(false);
    });
  }, [selectedFacilityId, selectedCategory, searchQuery]);

  const currentFacility =
    facilities.find(f => f.id === selectedFacilityId) || facilities[0];

  const handleStart = () => {
    if (!selectedAsset) {
      toast.error("Please select an electrical equipment asset to inspect");
      return;
    }

    const template = getTemplateForEquipmentType(selectedAsset.equipmentTypeId);

    onStartInspection({
      asset: selectedAsset,
      facility: currentFacility,
      inspectionType,
      template,
    });
  };

  const handleAssetClick = (asset: EquipmentAsset) => {
    setSelectedAsset(asset);
  };

  const todayStr = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="new-inspection-wizard">
      {/* Header Banner */}
      <div className="page-intro" style={{ marginBottom: 20 }}>
        <div>
          <div className="eyebrow">OFFLINE-FIRST FIELD INSPECTION OS</div>
          <h2>New Electrical Equipment Inspection</h2>
          <p>
            Government electrical inspection workflow. All templates, specifications, and safety rules are cached locally for zero-connectivity field operation.
          </p>
        </div>

        <div className="intro-actions">
          {onOpenQRScanner && (
            <button className="btn secondary" onClick={onOpenQRScanner}>
              <QrCode size={16} /> Scan Asset QR Code
            </button>
          )}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              fontFamily: "'DM Mono', monospace",
              fontWeight: 700,
              padding: "6px 10px",
              borderRadius: 6,
              background: offline ? "#fff4de" : "#eaf7f1",
              color: offline ? "#c27a13" : "#1f9d68",
              border: `1px solid ${offline ? "#fcd34d" : "#86efac"}`,
            }}
          >
            {offline ? <WifiOff size={13} /> : <Wifi size={13} />}
            <span>{offline ? "OFFLINE READY" : "ONLINE CONNECTED"}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Setup & Search / Right Equipment Profile */}
      <div className="wizard-grid">
        {/* Left Column: Facility, Type, Search & Asset List */}
        <div className="wizard-left-col">
          {/* Facility & Location Card */}
          <div className="panel" style={{ padding: 18, marginBottom: 16 }}>
            <div className="wizard-card-head">
              <Building2 size={16} color="#1c6384" />
              <h3>1. Government Facility &amp; Location</h3>
            </div>

            <div className="wizard-form-row">
              <div className="wizard-form-field">
                <label>Government Facility / Substation</label>
                <select
                  value={selectedFacilityId}
                  onChange={e => {
                    setSelectedFacilityId(e.target.value);
                  }}
                  className="wizard-select"
                >
                  {facilities.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.facilityType})
                    </option>
                  ))}
                </select>
              </div>

              <div className="wizard-form-field">
                <label>Inspection Type</label>
                <select
                  value={inspectionType}
                  onChange={e => setInspectionType(e.target.value as any)}
                  className="wizard-select"
                >
                  <option value="Periodic">Periodic Statutory Inspection</option>
                  <option value="Routine">Routine Maintenance Inspection</option>
                  <option value="Special">Special / Post-Tripping Inspection</option>
                  <option value="Emergency">Emergency Breakdown Inspection</option>
                  <option value="Follow-up">Follow-up / Rectification Sign-off</option>
                </select>
              </div>
            </div>

            {/* Hierarchical Location Summary */}
            <div className="facility-hierarchy-pill">
              <MapPin size={13} color="#286485" />
              <span>
                <strong>{currentFacility.department}</strong> · {currentFacility.division} · {currentFacility.section}
              </span>
            </div>
          </div>

          {/* Equipment Search & Category Selector */}
          <div className="panel" style={{ padding: 18 }}>
            <div className="wizard-card-head">
              <Zap size={16} color="#1c6384" />
              <h3>2. Select Electrical Equipment Asset</h3>
              <span className="wizard-badge">{assets.length} Assets Found</span>
            </div>

            {/* Search Input Bar */}
            <div className="wizard-search-box">
              <Search size={15} color="#94a3b8" />
              <input
                type="text"
                placeholder="Search by code (e.g. TRF-102), name, model, manufacturer..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="text-btn"
                  onClick={() => setSearchQuery("")}
                  style={{ fontSize: 11 }}
                >
                  Clear
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="wizard-category-pills">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  className={`category-pill ${selectedCategory === cat ? "active" : ""}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Assets List */}
            <div className="wizard-assets-list">
              {loading ? (
                <div className="wizard-loading-box">
                  <Clock3 size={20} className="spin-icon" />
                  <span>Loading local IndexedDB equipment...</span>
                </div>
              ) : assets.length === 0 ? (
                <div className="wizard-empty-box">
                  <AlertTriangle size={24} color="#d97706" />
                  <h4>No equipment matches current search filter</h4>
                  <p>
                    Verify the selected facility or category filter. You can also search by asset code or QR scanner.
                  </p>
                </div>
              ) : (
                assets.map(asset => {
                  const isSelected = selectedAsset?.id === asset.id;
                  return (
                    <div
                      key={asset.id}
                      className={`wizard-asset-card ${isSelected ? "selected" : ""}`}
                      onClick={() => handleAssetClick(asset)}
                    >
                      <div className="asset-card-top">
                        <div className="asset-code-badge">
                          <Zap size={13} />
                          <strong>{asset.assetCode}</strong>
                        </div>
                        <span
                          className={`health-chip ${
                            asset.healthStatus === "HEALTHY"
                              ? "green"
                              : asset.healthStatus === "ATTENTION"
                              ? "amber"
                              : "red"
                          }`}
                        >
                          {asset.healthStatus === "HEALTHY"
                            ? "● Normal"
                            : asset.healthStatus === "ATTENTION"
                            ? "● Warning"
                            : "● Due"}
                        </span>
                      </div>

                      <h4 className="asset-title">{asset.name}</h4>

                      <div className="asset-meta-row">
                        <span>{asset.locationName}</span>
                        <span>•</span>
                        <span>{asset.manufacturer}</span>
                        <span>•</span>
                        <strong className="mono">{asset.capacity}</strong>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Selected Equipment Profile & Inspector Verification */}
        <div className="wizard-right-col">
          {selectedAsset ? (
            <div className="panel profile-spec-panel">
              {/* Profile Card Header */}
              <div className="spec-header">
                <div className="spec-category-tag">
                  <Tag size={12} />
                  <span>{selectedAsset.category.toUpperCase()}</span>
                </div>
                <h2>{selectedAsset.name}</h2>
                <div className="spec-code-line">
                  <span>Asset Code:</span>
                  <strong className="mono">{selectedAsset.assetCode}</strong>
                  <span>•</span>
                  <span>Serial:</span>
                  <span className="mono">{selectedAsset.serialNumber}</span>
                </div>
              </div>

              {/* Specifications Grid */}
              <div className="spec-grid">
                <div className="spec-item">
                  <span className="spec-label">Manufacturer</span>
                  <strong className="spec-val">{selectedAsset.manufacturer}</strong>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Model Series</span>
                  <strong className="spec-val">{selectedAsset.model}</strong>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Rated Capacity</span>
                  <strong className="spec-val mono">{selectedAsset.capacity}</strong>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Voltage Rating</span>
                  <strong className="spec-val mono">{selectedAsset.voltageRating}</strong>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Current Rating</span>
                  <strong className="spec-val mono">
                    {selectedAsset.currentRating || "Standard"}
                  </strong>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Installation Date</span>
                  <strong className="spec-val">{selectedAsset.installationDate}</strong>
                </div>
              </div>

              {/* Previous Inspection History Telemetry */}
              <div className="history-telemetry-box">
                <div className="history-telemetry-head">
                  <Clock3 size={14} color="#1c6384" />
                  <strong>Previous Inspection History</strong>
                </div>

                <div className="history-telemetry-body">
                  <div className="telemetry-row">
                    <span>Last Inspected:</span>
                    <strong>{selectedAsset.lastInspectionDate || "15 Sep 2026"}</strong>
                  </div>
                  <div className="telemetry-row">
                    <span>Previous Result:</span>
                    <span
                      className={`status-chip ${
                        selectedAsset.lastInspectionResult === "PASS"
                          ? "approved"
                          : selectedAsset.lastInspectionResult === "WARNING"
                          ? "draft"
                          : "submitted"
                      }`}
                    >
                      {selectedAsset.lastInspectionResult || "WARNING"}
                    </span>
                  </div>
                  <div className="telemetry-row">
                    <span>Open Findings / Actions:</span>
                    <strong>{selectedAsset.openFindingsCount ?? 2} open action(s)</strong>
                  </div>
                </div>
              </div>

              {/* Inspection Officer & Template Footnote */}
              <div className="inspector-session-strip">
                <div className="inspector-session-info">
                  <User size={15} color="#286485" />
                  <div>
                    <span className="strip-label">Inspecting Officer</span>
                    <strong>{currentUser?.name || currentUser?.displayName || "Mohammed Sameer"}</strong>
                  </div>
                </div>

                <div className="inspector-session-info">
                  <Calendar size={15} color="#286485" />
                  <div>
                    <span className="strip-label">Date &amp; Protocol</span>
                    <strong>{todayStr} (Statutory)</strong>
                  </div>
                </div>
              </div>

              {/* Template Auto-Load Alert */}
              <div className="template-auto-note">
                <ShieldCheck size={16} color="#16a34a" />
                <div>
                  <strong>
                    Template: {getTemplateForEquipmentType(selectedAsset.equipmentTypeId).name}
                  </strong>
                  <span>
                    Smart thresholds, IS standards, and mandatory PPE safety checks ready offline.
                  </span>
                </div>
              </div>

              {/* Start Inspection Action Button */}
              <button
                type="button"
                className="btn primary start-inspection-btn"
                onClick={handleStart}
              >
                <span>START EQUIPMENT INSPECTION</span>
                <ArrowRight size={17} />
              </button>
            </div>
          ) : (
            <div className="panel select-prompt-panel">
              <Zap size={32} color="#94a3b8" />
              <h3>Select an Electrical Asset</h3>
              <p>
                Choose an electrical asset from the list or search using asset code to load equipment specifications and checklist templates.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
