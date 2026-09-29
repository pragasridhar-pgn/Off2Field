import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Smartphone,
  AlertTriangle,
  ArrowRight,
  Wifi,
  WifiOff,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  signInWithPhonePassword,
  type AppUser,
} from "../services/authService";

interface PhoneLoginPageProps {
  onLogin: (user: AppUser) => void;
}

export function PhoneLoginPage({ onLogin }: PhoneLoginPageProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [errorCallout, setErrorCallout] = useState<string | null>(null);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handlePhoneChange = (val: string) => {
    const digitsOnly = val.replace(/\D/g, "").slice(0, 10);
    setPhoneNumber(digitsOnly);
    if (errorCallout) setErrorCallout(null);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorCallout(null);

    const cleanNum = phoneNumber.trim().replace(/\D/g, "");
    if (cleanNum.length !== 10 || !password.trim()) {
      setErrorCallout("Mobile number or password is incorrect.");
      return;
    }

    setLoading(true);

    try {
      const user = await signInWithPhonePassword(cleanNum, password);
      toast.success("Officer Authentication Successful", {
        description: `Welcome, ${user.name || "Field Officer"} (${user.role})`,
      });
      onLogin(user);
    } catch (err: any) {
      console.error("Login verification error:", err);
      setErrorCallout("Mobile number or password is incorrect.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-wrap">
        {/* Brand Header */}
        <div className="login-brand">
          <div className="brand">
            <div className="brand-symbol">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <div>
              <strong>
                OFF<span>2</span>FIELD
              </strong>
              <small>FIELD INSPECTION OS</small>
            </div>
          </div>
          <p className="login-tagline">Government Electrical Equipment Inspection Platform</p>
        </div>

        {/* Main Authentication Card */}
        <div className="login-card">
          <div className="login-card-header">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2>Government Officer Login</h2>
                <p>Sign in with your 10-digit Indian Mobile Number and Password</p>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 10,
                  fontFamily: "'DM Mono', monospace",
                  fontWeight: 700,
                  padding: "4px 8px",
                  borderRadius: 6,
                  background: isOnline ? "#eaf7f1" : "#fff4de",
                  color: isOnline ? "#1f9d68" : "#c27a13",
                }}
              >
                {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
                <span>{isOnline ? "ONLINE" : "OFFLINE READY"}</span>
              </div>
            </div>
          </div>

          {/* Error Callout */}
          {errorCallout && (
            <div className="auth-callout error">
              <div className="auth-callout-icon">
                <AlertTriangle size={18} />
              </div>
              <div className="auth-callout-content">
                <h4>Access Denied</h4>
                <p>{errorCallout}</p>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSignIn} className="login-form">
            {/* Indian Mobile Number (Constant +91) */}
            <div className="login-field">
              <label>Indian Mobile Number</label>
              <div className="phone-input-container">
                <div
                  className="phone-country-select"
                  style={{
                    background: "rgba(15, 23, 42, 0.04)",
                    padding: "0 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    borderRight: "1px solid #cbd5e1",
                    userSelect: "none",
                  }}
                  title="Country: India (+91)"
                >
                  <span style={{ fontSize: 16 }}>🇮🇳</span>
                  <span
                    style={{
                      fontWeight: 700,
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 13,
                      color: "#1e293b",
                    }}
                  >
                    +91
                  </span>
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  className="phone-number-input"
                  placeholder="Enter 10-digit number"
                  value={phoneNumber}
                  onChange={e => handlePhoneChange(e.target.value)}
                  autoFocus
                  disabled={loading}
                  maxLength={10}
                />
              </div>
            </div>

            {/* Password / Verification Code */}
            <div className="login-field" style={{ marginTop: 14 }}>
              <label>Password</label>
              <div className="phone-input-container" style={{ position: "relative" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "0 12px",
                    color: "#64748b",
                    background: "rgba(15, 23, 42, 0.04)",
                    borderRight: "1px solid #cbd5e1",
                  }}
                >
                  <KeyRound size={16} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  className="phone-number-input"
                  placeholder="Enter password"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (errorCallout) setErrorCallout(null);
                  }}
                  disabled={loading}
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    cursor: "pointer",
                    padding: 4,
                    display: "flex",
                    alignItems: "center",
                  }}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Sign In Submit Button */}
            <button
              type="submit"
              className="login-submit inspector"
              disabled={loading || phoneNumber.length !== 10 || !password.trim()}
              style={{ marginTop: 18 }}
            >
              {loading && <span className="login-spinner" />}
              {loading ? (
                "Verifying Credentials…"
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>

            {/* Security notice */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 11,
                color: "#475569",
                marginTop: 14,
                padding: "8px 12px",
                background: "#f1f5f9",
                borderRadius: 6,
              }}
            >
              <Lock size={13} color="#0284c7" />
              <span>
                Offline-ready authentication. Verified locally in Dexie with persistent session.
              </span>
            </div>
          </form>
        </div>

        {/* Footer info */}
        <div className="login-footer">
          <span>OFF2FIELD · GOVERNMENT ELECTRICAL INSPECTION OS · INDIA (+91)</span>
        </div>
      </div>
    </div>
  );
}
