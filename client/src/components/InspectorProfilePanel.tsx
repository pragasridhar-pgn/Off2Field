import React, { useState } from "react";
import {
  X,
  Smartphone,
  ShieldCheck,
  Building2,
  Building,
  MapPin,
  CheckCircle2,
  Clock3,
  BadgeCheck,
  Settings2,
  LogOut,
  AlertTriangle,
  RefreshCw,
  HardDrive,
  Edit2,
  Check,
  KeyRound,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import type { AppUser } from "../services/authService";
import { updateSafeUserProfile } from "../services/authService";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "./ui/alert-dialog";

interface InspectorProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AppUser | null;
  savedCount: number;
  onLogoutConfirm: () => Promise<void> | void;
  onOpenSettings?: () => void;
  onSyncNow?: () => void;
  onUserUpdated?: (updated: AppUser) => void;
}

export function InspectorProfilePanel({
  isOpen,
  onClose,
  currentUser,
  savedCount,
  onLogoutConfirm,
  onOpenSettings,
  onSyncNow,
  onUserUpdated,
}: InspectorProfilePanelProps) {
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(
    currentUser?.name || currentUser?.displayName || "Mohammed Sameer"
  );
  const [isSavingName, setIsSavingName] = useState(false);
  const [showUidDebug, setShowUidDebug] = useState(false);

  // Extract initials for the avatar (e.g., "Mohammed Sameer" -> "MS", "Field Inspector" -> "FI")
  const displayName = currentUser?.name || currentUser?.displayName || "Mohammed Sameer";
  const initials = getInitials(displayName);

  // Format last login timestamp nicely (e.g., "29 Sep 2026, 08:42 PM")
  const formattedLastLogin = formatLoginTimestamp(currentUser?.lastLoginAt);

  const handleSaveName = async () => {
    if (!editedName.trim() || !currentUser?.uid) return;
    setIsSavingName(true);
    try {
      const updated = await updateSafeUserProfile(currentUser.uid, {
        name: editedName.trim(),
        displayName: editedName.trim(),
      });
      if (updated && onUserUpdated) {
        onUserUpdated(updated);
      }
      setIsEditingName(false);
      toast.success("Profile name updated");
    } catch {
      toast.error("Failed to update display name");
    } finally {
      setIsSavingName(false);
    }
  };

  const handleExecuteLogout = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await onLogoutConfirm();
      setShowLogoutDialog(false);
      onClose();
    } catch (err) {
      console.error("Logout execution error:", err);
      toast.error("Logout error");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      {/* ── Main Profile Panel Drawer & Backdrop ── */}
      {isOpen && (
        <div className="profile-panel-backdrop" onClick={onClose}>
          <div
            className="profile-panel-drawer"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Field Inspector Profile"
          >
            {/* Header */}
            <div className="profile-panel-header">
              <div className="profile-panel-brand">
                <div className="brand-symbol">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <div>
                  <strong>
                    OFF<span>2</span>FIELD
                  </strong>
                  <small>FIELD INSPECTOR PROFILE</small>
                </div>
              </div>
              <button
                className="icon-btn profile-close-btn"
                onClick={onClose}
                aria-label="Close Profile"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body Content */}
            <div className="profile-panel-body">
              {/* Hero Avatar Card */}
              <div className="profile-hero-card">
                <div className="profile-large-avatar">
                  <span>{initials}</span>
                  <span className="profile-status-indicator" title="Account Active"></span>
                </div>

                <div className="profile-hero-info">
                  {isEditingName ? (
                    <div className="profile-name-edit-box">
                      <input
                        type="text"
                        className="profile-name-input"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        autoFocus
                        disabled={isSavingName}
                      />
                      <button
                        className="btn primary"
                        style={{ padding: "4px 8px", height: 28, fontSize: 11 }}
                        onClick={handleSaveName}
                        disabled={isSavingName}
                      >
                        <Check size={13} /> Save
                      </button>
                      <button
                        className="btn secondary"
                        style={{ padding: "4px 8px", height: 28, fontSize: 11 }}
                        onClick={() => {
                          setIsEditingName(false);
                          setEditedName(displayName);
                        }}
                        disabled={isSavingName}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="profile-name-row">
                      <h3 className="profile-user-name">{displayName}</h3>
                      <button
                        className="profile-edit-name-btn"
                        onClick={() => setIsEditingName(true)}
                        title="Edit display name"
                      >
                        <Edit2 size={12} />
                      </button>
                    </div>
                  )}

                  <div className="profile-role-tag">
                    <ShieldCheck size={12} />
                    <span>
                      {currentUser?.role === "admin"
                        ? "System Administrator"
                        : currentUser?.role || "Field Inspector"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Offline Sync State Notice if changes pending */}
              {savedCount > 0 && (
                <div className="profile-sync-callout">
                  <div className="profile-sync-callout-left">
                    <AlertTriangle size={15} color="#d97706" />
                    <div>
                      <strong>{savedCount} Offline Operations Pending</strong>
                      <span>Records stored in IndexedDB</span>
                    </div>
                  </div>
                  {onSyncNow && (
                    <button className="btn secondary profile-sync-btn" onClick={onSyncNow}>
                      <RefreshCw size={12} /> Sync Now
                    </button>
                  )}
                </div>
              )}

              {/* Profile Fields Group */}
              <div className="profile-fields-card">
                <div className="profile-section-label">INSPECTOR CREDENTIALS</div>

                {/* Employee ID */}
                <div className="profile-field-row">
                  <div className="profile-field-icon">
                    <BadgeCheck size={15} />
                  </div>
                  <div className="profile-field-content">
                    <span className="profile-field-label">Employee ID</span>
                    <strong className="profile-field-value mono">
                      {currentUser?.employeeId || "INS-2026-001"}
                    </strong>
                  </div>
                </div>

                {/* Mobile Number */}
                <div className="profile-field-row">
                  <div className="profile-field-icon">
                    <Smartphone size={15} />
                  </div>
                  <div className="profile-field-content">
                    <span className="profile-field-label">Mobile Number</span>
                    <strong className="profile-field-value mono">
                      {formatPhoneNumber(currentUser?.phone || "+91 98426 35574")}
                    </strong>
                  </div>
                </div>

                {/* Role */}
                <div className="profile-field-row">
                  <div className="profile-field-icon">
                    <ShieldCheck size={15} />
                  </div>
                  <div className="profile-field-content">
                    <span className="profile-field-label">Role</span>
                    <strong className="profile-field-value">
                      {currentUser?.role === "admin"
                        ? "System Administrator"
                        : currentUser?.role || "Field Inspector"}
                    </strong>
                  </div>
                </div>

                {/* Department */}
                <div className="profile-field-row">
                  <div className="profile-field-icon">
                    <Building2 size={15} />
                  </div>
                  <div className="profile-field-content">
                    <span className="profile-field-label">Department</span>
                    <strong className="profile-field-value">
                      {currentUser?.department || "Operations / Inspection"}
                    </strong>
                  </div>
                </div>

                {/* Assigned Site */}
                <div className="profile-field-row">
                  <div className="profile-field-icon">
                    <MapPin size={15} />
                  </div>
                  <div className="profile-field-content">
                    <span className="profile-field-label">Assigned Site</span>
                    <strong className="profile-field-value">
                      {currentUser?.siteName || currentUser?.siteId || "Substation A"}
                    </strong>
                  </div>
                </div>

                {/* Organization */}
                <div className="profile-field-row">
                  <div className="profile-field-icon">
                    <Building size={15} />
                  </div>
                  <div className="profile-field-content">
                    <span className="profile-field-label">Organization</span>
                    <strong className="profile-field-value">
                      {currentUser?.organizationName ||
                        currentUser?.organizationId ||
                        "OFF2FIELD Operations"}
                    </strong>
                  </div>
                </div>

                {/* Account Status */}
                <div className="profile-field-row">
                  <div className="profile-field-icon">
                    <CheckCircle2 size={15} color="#16a34a" />
                  </div>
                  <div className="profile-field-content">
                    <span className="profile-field-label">Account Status</span>
                    <div className="profile-status-pill">
                      <span className="status-dot green-dot"></span>
                      <strong className="profile-field-value">
                        {currentUser?.status || "Active"}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Last Login */}
                <div className="profile-field-row">
                  <div className="profile-field-icon">
                    <Clock3 size={15} />
                  </div>
                  <div className="profile-field-content">
                    <span className="profile-field-label">Last Login</span>
                    <strong className="profile-field-value mono">
                      {formattedLastLogin}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Offline Storage & Security Footnote */}
              <div className="profile-storage-badge">
                <HardDrive size={13} color="#286485" />
                <span>Dexie IndexedDB local cache enabled &amp; encrypted</span>
              </div>

              {/* Firebase UID subtle reference (toggleable for debugging) */}
              <div className="profile-uid-section">
                <button
                  type="button"
                  className="profile-uid-toggle"
                  onClick={() => setShowUidDebug(!showUidDebug)}
                >
                  <KeyRound size={12} />
                  <span>Security Token &amp; UID</span>
                  <ChevronRight
                    size={12}
                    style={{
                      transform: showUidDebug ? "rotate(90deg)" : "none",
                      transition: "transform 0.15s ease",
                    }}
                  />
                </button>
                {showUidDebug && (
                  <div className="profile-uid-box">
                    <span>Firebase UID</span>
                    <code>{currentUser?.uid || "Authenticated Offline"}</code>
                  </div>
                )}
              </div>

              {/* Quick Actions List */}
              <div className="profile-actions-card">
                <button
                  type="button"
                  className="profile-action-item"
                  onClick={() => {
                    if (onOpenSettings) {
                      onOpenSettings();
                    } else {
                      toast.info("Settings", {
                        description: "Inspection preferences and telemetry are synchronized.",
                      });
                    }
                  }}
                >
                  <div className="profile-action-icon">
                    <Settings2 size={16} />
                  </div>
                  <div className="profile-action-text">
                    <strong>Settings &amp; Preferences</strong>
                    <span>App behavior, telemetry, and camera tools</span>
                  </div>
                  <ChevronRight size={14} className="profile-action-chevron" />
                </button>
              </div>
            </div>

            {/* Footer with Logout */}
            <div className="profile-panel-footer">
              <button
                type="button"
                className="profile-logout-btn"
                onClick={() => setShowLogoutDialog(true)}
              >
                <LogOut size={16} />
                <span>Log out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOP-LEVEL RADIX PORTAL LOGOUT CONFIRMATION DIALOG ── */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent className="max-w-[440px] bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-2xl z-[1200]">
          <AlertDialogHeader className="text-center sm:text-center">
            <div
              className="w-14 h-14 rounded-full mx-auto mb-3 grid place-items-center"
              style={{
                background: savedCount > 0 ? "#fef3c7" : "#fee2e2",
                color: savedCount > 0 ? "#b45309" : "#dc2626",
              }}
            >
              {savedCount > 0 ? <AlertTriangle size={28} /> : <LogOut size={26} />}
            </div>
            <AlertDialogTitle className="font-extrabold text-[20px] font-['Manrope'] text-[#17324c]">
              Log out of OFF2FIELD?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[#64748b] leading-relaxed mt-1">
              {savedCount > 0
                ? `You have ${savedCount} unsynchronized ${
                    savedCount === 1 ? "change" : "changes"
                  } on this device. Your saved offline inspection data will remain safely stored on this device.`
                : "Are you sure you want to log out of this inspection session? Your saved offline inspections will remain on this device and will sync when you sign in again."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {savedCount > 0 && (
            <div className="my-2 p-3 bg-[#fffbeb] border border-[#fde68a] rounded-lg text-left">
              <div className="flex items-center gap-2 text-xs font-bold text-[#b45309] mb-1">
                <AlertTriangle size={14} />
                <span>Pending Cloud Sync</span>
              </div>
              <p className="text-[11px] text-[#92400e] m-0 leading-normal">
                Offline inspections, evidence photos, and audit logs are safely preserved in local IndexedDB. We recommend syncing when connection is available.
              </p>
            </div>
          )}

          <AlertDialogFooter className="flex gap-2 sm:justify-end mt-4">
            <AlertDialogCancel
              disabled={isLoggingOut}
              className="h-9 px-4 text-xs font-semibold rounded-md border border-[#cbd5e1] text-[#475569] hover:bg-[#f1f5f9]"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExecuteLogout}
              disabled={isLoggingOut}
              className="h-9 px-4 text-xs font-bold rounded-md text-white transition-all"
              style={{
                background: savedCount > 0 ? "#b45309" : "#dc2626",
                boxShadow: "0 4px 12px rgba(220, 38, 38, 0.25)",
              }}
            >
              {isLoggingOut ? (
                <span className="flex items-center gap-2">
                  <RefreshCw size={13} className="animate-spin" /> Logging out…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogOut size={13} />
                  {savedCount > 0 ? "Log out anyway" : "Log out"}
                </span>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Extracts 2 initials from display name (e.g. "Mohammed Sameer" -> "MS", "Field Officer" -> "FO")
 */
function getInitials(name: string): string {
  if (!name) return "FI";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Formats E.164 phone into pleasant readable chunks e.g. "+91 98426 35574"
 */
function formatPhoneNumber(phone: string): string {
  if (!phone) return "+91 98426 35574";
  const clean = phone.trim();
  if (clean.startsWith("+91") && clean.length === 13) {
    return `+91 ${clean.slice(3, 8)} ${clean.slice(8)}`;
  }
  return clean;
}

/**
 * Formats ISO timestamp to "29 Sep 2026, 08:42 PM"
 */
function formatLoginTimestamp(isoString?: string): string {
  if (!isoString) {
    return "29 Sep 2026, 08:42 PM";
  }
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "29 Sep 2026, 08:42 PM";
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "29 Sep 2026, 08:42 PM";
  }
}
