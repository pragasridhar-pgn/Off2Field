import React from "react";
import {
  Users,
  Smartphone,
  ShieldCheck,
  Search,
  CheckCircle2,
  Lock,
  Building,
  HardDrive,
  Database,
  FileCheck2,
  FileClock,
  Sparkles,
  Cog,
  ClipboardCheck,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import type { AppUser } from "../services/authService";

interface AdminConsoleProps {
  currentUser: AppUser | null;
  onLogoutAdmin?: () => void;
}

export function AdminConsole({ currentUser }: AdminConsoleProps) {
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Title */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "#0284c7", fontWeight: 700, letterSpacing: 1 }}>
          OFF2FIELD / ADMINISTRATION &amp; PLATFORM CONTROL
        </div>
        <h2 style={{ font: "800 24px Manrope", margin: "4px 0 2px", color: "#0f172a" }}>
          Platform Overview &amp; Field Telemetry
        </h2>
        <p style={{ margin: 0, color: "#64748b", fontSize: 12 }}>
          Authenticated officer profile, cloud synchronization posture, and offline field configuration.
        </p>
      </div>

      {/* Active User Card */}
      <div className="panel" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "#e0f2fe",
                color: "#0369a1",
                display: "grid",
                placeItems: "center",
                font: "700 16px 'DM Mono', monospace",
              }}
            >
              {currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : "OF"}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ margin: 0, font: "700 16px Manrope", color: "#0f172a" }}>
                  {currentUser?.name || currentUser?.displayName || "Field Officer"}
                </h3>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: "#dcfce7",
                    color: "#15803d",
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  AUTHENTICATED
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 3, fontFamily: "'DM Mono', monospace" }}>
                Phone: <strong style={{ color: "#0284c7" }}>{currentUser?.phone || "Verified"}</strong> · UID: {currentUser?.uid}
              </div>
            </div>
          </div>

          <div style={{ fontSize: 11, color: "#64748b", textAlign: "right" }}>
            <div>Session: <strong>Active (Persistent)</strong></div>
            <div>Last Login: <strong>{currentUser?.lastLoginAt ? new Date(currentUser.lastLoginAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Today"}</strong></div>
          </div>
        </div>
      </div>

      {/* Admin Modules Grid */}
      <div className="admin-grid" style={{ marginBottom: 20 }}>
        <div className="admin-card panel" onClick={() => toast("User registry ready")}>
          <div className="admin-icon" style={{ background: "#e0f2fe", color: "#0284c7" }}><Users size={18} /></div>
          <div>
            <h3>Officer Accounts</h3>
            <p>Firebase Phone Authentication active</p>
            <span>Verified Users</span>
          </div>
        </div>
        <div className="admin-card panel" onClick={() => toast("Machine registry loaded")}>
          <div className="admin-icon" style={{ background: "#fef3c7", color: "#b45309" }}><Cog size={18} /></div>
          <div>
            <h3>Equipment Assets</h3>
            <p>48 registered industrial machines</p>
            <span>5 Asset Categories</span>
          </div>
        </div>
        <div className="admin-card panel" onClick={() => toast("Checklist templates ready")}>
          <div className="admin-icon" style={{ background: "#dcfce7", color: "#15803d" }}><ClipboardCheck size={18} /></div>
          <div>
            <h3>Inspection Templates</h3>
            <p>6 standard substation checklists</p>
            <span>Active Schemas</span>
          </div>
        </div>
      </div>

      {/* Security Posture Strip */}
      <section className="panel security-strip">
        <ShieldCheck size={20} color="#16a34a" />
        <div>
          <strong style={{ fontSize: 12, color: "#0f172a" }}>Offline-First Security &amp; Storage Posture</strong>
          <span style={{ fontSize: 11, color: "#64748b" }}>
            AES-256 local IndexedDB caching · Firebase Phone OTP verification · User-scoped Firestore security
          </span>
        </div>
        <span className="ready-chip">
          <span></span> Operational
        </span>
      </section>
    </div>
  );
}
