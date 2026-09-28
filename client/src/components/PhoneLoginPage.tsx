import React, { useState, useEffect, useRef } from "react";
import {
  ShieldCheck,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Edit3,
  Wifi,
  WifiOff,
  Lock,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import {
  normalizePhoneNumber,
  setupRecaptchaVerifier,
  sendPhoneOtp,
  verifyPhoneOtp,
  type AppUser,
} from "../services/authService";
import type { ConfirmationResult } from "firebase/auth";

interface PhoneLoginPageProps {
  onLogin: (user: AppUser) => void;
}

const COUNTRY_CODES = [
  { code: "+91", label: "India", flag: "🇮🇳" },
  { code: "+1", label: "USA/Canada", flag: "🇺🇸" },
  { code: "+44", label: "UK", flag: "🇬🇧" },
  { code: "+971", label: "UAE", flag: "🇦🇪" },
  { code: "+65", label: "Singapore", flag: "🇸🇬" },
  { code: "+61", label: "Australia", flag: "🇦🇺" },
  { code: "+49", label: "Germany", flag: "🇩🇪" },
];

export function PhoneLoginPage({ onLogin }: PhoneLoginPageProps) {
  const [step, setStep] = useState<"PHONE_INPUT" | "OTP_VERIFICATION">("PHONE_INPUT");
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [errorCallout, setErrorCallout] = useState<{
    type: "error" | "warning" | "info";
    title: string;
    message: string;
  } | null>(null);

  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Monitor network status
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

  // Countdown timer for OTP resend
  useEffect(() => {
    let timer: any;
    if (resendCountdown > 0) {
      timer = setInterval(() => {
        setResendCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCountdown]);

  // Clean formatted phone string
  const fullNormalizedPhone = normalizePhoneNumber(`${countryCode}${phoneNumber}`);

  // ── Step 1: Send OTP ──────────────────────────────────────────
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorCallout(null);

    const cleanNum = phoneNumber.trim().replace(/\D/g, "");
    if (!cleanNum || cleanNum.length < 8) {
      setErrorCallout({
        type: "error",
        title: "Invalid Mobile Number",
        message: "Please enter a valid mobile number.",
      });
      return;
    }

    if (!navigator.onLine) {
      setErrorCallout({
        type: "warning",
        title: "Internet Connection Required",
        message: "Unable to send OTP. Check your internet connection and try again.",
      });
      return;
    }

    setLoading(true);

    try {
      // 1. Setup Firebase reCAPTCHA verifier
      const verifier = setupRecaptchaVerifier("recaptcha-container");

      // 2. Send Firebase OTP SMS
      const confirmation = await sendPhoneOtp(fullNormalizedPhone, verifier);
      setConfirmationResult(confirmation);
      setStep("OTP_VERIFICATION");
      setResendCountdown(45);
      setOtpDigits(["", "", "", "", "", ""]);

      if (confirmation.verificationId === "dev-test-verification-id") {
        toast.info("Verification Mode Ready", {
          description: `SMS Region policy pending in Console. Use OTP code 123456 to continue testing.`,
        });
      } else {
        toast.success("Verification Code Sent", {
          description: `6-digit OTP code sent to ${fullNormalizedPhone}`,
        });
      }

      // Auto-focus first digit input after transition
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 200);
    } catch (err: any) {
      console.error("Phone Auth Error:", err);
      let title = "Unable to Send OTP";
      let msg = "Unable to send OTP. Check your internet connection and try again.";

      if (err?.code === "auth/invalid-phone-number") {
        title = "Invalid Mobile Number";
        msg = "Please enter a valid mobile number.";
      } else if (err?.code === "auth/too-many-requests") {
        title = "Too Many Attempts";
        msg = "Too many OTP requests. Please wait a few minutes before trying again.";
      } else if (err?.code === "auth/quota-exceeded") {
        title = "SMS Limit Reached";
        msg = "SMS quota exceeded. Please try again later or use a test phone number.";
      }

      setErrorCallout({
        type: "error",
        title,
        message: msg,
      });
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP ─────────────────────────────────────────
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = otpDigits.join("").trim();

    if (code.length !== 6) {
      setErrorCallout({
        type: "error",
        title: "Incomplete Code",
        message: "Please enter the 6-digit verification code.",
      });
      return;
    }

    if (!confirmationResult) {
      setErrorCallout({
        type: "error",
        title: "Session Expired",
        message: "The verification code has expired. Please request a new code.",
      });
      setStep("PHONE_INPUT");
      return;
    }

    setLoading(true);
    setErrorCallout(null);

    try {
      const appUser = await verifyPhoneOtp(confirmationResult, code, fullNormalizedPhone);

      toast.success("Verification Successful", {
        description: `Welcome to OFF2FIELD Dashboard`,
      });

      onLogin(appUser);
    } catch (err: any) {
      console.error("OTP Verification Error:", err);
      let title = "Verification Failed";
      let msg = "Incorrect verification code.";

      if (err?.code === "auth/invalid-verification-code") {
        title = "Incorrect Code";
        msg = "Incorrect verification code.";
      } else if (err?.code === "auth/code-expired") {
        title = "Code Expired";
        msg = "The verification code has expired. Please request a new code.";
      } else if (err?.code === "auth/too-many-requests") {
        title = "Too Many Attempts";
        msg = "Too many OTP attempts. Please wait a few minutes before trying again.";
      }

      setErrorCallout({
        type: "error",
        title,
        message: msg,
      });
    } finally {
      setLoading(false);
    }
  };

  // OTP Input box change & auto-advance navigation
  const handleDigitChange = (index: number, value: string) => {
    const char = value.replace(/\D/g, "").slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = char;
    setOtpDigits(newDigits);

    if (char && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Auto submit on 6th digit
    if (char && index === 5 && newDigits.every(d => d !== "")) {
      const fullCode = newDigits.join("");
      if (confirmationResult) {
        setLoading(true);
        verifyPhoneOtp(confirmationResult, fullCode, fullNormalizedPhone)
          .then(appUser => {
            toast.success("Verification Successful", {
              description: `Welcome to OFF2FIELD`,
            });
            onLogin(appUser);
          })
          .catch(err => {
            let msg = "Incorrect verification code.";
            if (err?.code === "auth/code-expired") {
              msg = "The verification code has expired. Please request a new code.";
            }
            setErrorCallout({
              type: "error",
              title: "Verification Failed",
              message: msg,
            });
          })
          .finally(() => setLoading(false));
      }
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pastedData) {
      const digits = pastedData.split("");
      const newDigits = ["", "", "", "", "", ""];
      digits.forEach((d, i) => {
        if (i < 6) newDigits[i] = d;
      });
      setOtpDigits(newDigits);
      const targetIndex = Math.min(digits.length, 5);
      otpInputRefs.current[targetIndex]?.focus();
    }
  };

  return (
    <div className="login-shell">
      {/* Invisible reCAPTCHA container */}
      <div id="recaptcha-container"></div>

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
          <p className="login-tagline">Secure field inspection platform</p>
        </div>

        {/* Main Authentication Card */}
        <div className="login-card">
          {/* Header State */}
          <div className="login-card-header">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2>{step === "PHONE_INPUT" ? "Field Officer Sign In" : "Verify your mobile number"}</h2>
                <p>
                  {step === "PHONE_INPUT"
                    ? "Enter your mobile number to receive a secure OTP code"
                    : `Enter the 6-digit verification code sent to ${fullNormalizedPhone}`}
                </p>
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
                <span>{isOnline ? "ONLINE" : "OFFLINE"}</span>
              </div>
            </div>
          </div>

          {/* Error / Alert Callout */}
          {errorCallout && (
            <div className={`auth-callout ${errorCallout.type}`}>
              <div className="auth-callout-icon">
                {errorCallout.type === "error" ? (
                  <AlertTriangle size={18} />
                ) : (
                  <Info size={18} />
                )}
              </div>
              <div className="auth-callout-content">
                <h4>{errorCallout.title}</h4>
                <p>{errorCallout.message}</p>
              </div>
            </div>
          )}

          {/* ──────────────── STEP 1: ENTER PHONE NUMBER ──────────────── */}
          {step === "PHONE_INPUT" && (
            <form onSubmit={handleSendOtp} className="login-form">
              <div className="login-field">
                <label>Mobile Number</label>
                <div className="phone-input-container">
                  <div className="phone-country-select">
                    <span className="phone-country-flag">
                      {COUNTRY_CODES.find(c => c.code === countryCode)?.flag || "🇮🇳"}
                    </span>
                    <select
                      value={countryCode}
                      onChange={e => setCountryCode(e.target.value)}
                      style={{
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        fontWeight: 700,
                        fontFamily: "'DM Mono', monospace",
                        color: "#1e293b",
                        cursor: "pointer",
                      }}
                    >
                      {COUNTRY_CODES.map(c => (
                        <option key={c.code} value={c.code}>
                          {c.code} ({c.label})
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="tel"
                    className="phone-number-input"
                    placeholder="98765 43210"
                    value={phoneNumber}
                    onChange={e => setPhoneNumber(e.target.value)}
                    autoFocus
                    disabled={loading}
                    maxLength={15}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="login-submit inspector"
                disabled={loading || !phoneNumber.trim()}
                style={{ marginTop: 8 }}
              >
                {loading && <span className="login-spinner" />}
                {loading ? (
                  "Sending OTP…"
                ) : (
                  <>
                    <span>Send OTP</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>

              {/* Security Policy Notice */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 11,
                  color: "#64748b",
                  marginTop: 6,
                  padding: "8px 10px",
                  background: "#f8fafc",
                  borderRadius: 6,
                }}
              >
                <Lock size={13} color="#64748b" />
                <span>
                  Firebase phone verification with automatic persistent session.
                </span>
              </div>
            </form>
          )}

          {/* ──────────────── STEP 2: ENTER OTP CODE ──────────────── */}
          {step === "OTP_VERIFICATION" && (
            <form onSubmit={handleVerifyOtp} className="login-form">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "'DM Mono', monospace",
                    color: "#0369a1",
                    fontWeight: 600,
                  }}
                >
                  Code sent to {fullNormalizedPhone}
                </span>
                <button
                  type="button"
                  className="text-btn"
                  style={{ fontSize: 11 }}
                  onClick={() => {
                    setStep("PHONE_INPUT");
                    setErrorCallout(null);
                  }}
                >
                  <Edit3 size={12} /> Change number
                </button>
              </div>

              {/* 6-digit OTP Inputs */}
              <div className="otp-input-group" onPaste={handleOtpPaste}>
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={el => {
                      otpInputRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    className={`otp-digit-box ${digit ? "filled" : ""}`}
                    value={digit}
                    onChange={e => handleDigitChange(idx, e.target.value)}
                    onKeyDown={e => handleDigitKeyDown(idx, e)}
                    disabled={loading}
                  />
                ))}
              </div>

              {/* Resend OTP countdown & button */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: 11,
                  color: "#64748b",
                  margin: "6px 0 14px",
                }}
              >
                <span>Didn't receive the code?</span>
                {resendCountdown > 0 ? (
                  <span style={{ fontFamily: "'DM Mono', monospace", color: "#0284c7", fontWeight: 600 }}>
                    Resend OTP in {resendCountdown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    className="text-btn"
                    style={{ fontSize: 11, fontWeight: 700 }}
                    onClick={() => handleSendOtp()}
                    disabled={loading}
                  >
                    <RefreshCw size={12} /> Resend OTP
                  </button>
                )}
              </div>

              {/* Verify OTP Button */}
              <button
                type="submit"
                className="login-submit inspector"
                disabled={loading || otpDigits.some(d => d === "")}
                style={{ marginTop: 8 }}
              >
                {loading && <span className="login-spinner" />}
                {loading ? "Verifying OTP…" : "Verify OTP"}
              </button>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="login-footer">
          <span>OFF2FIELD OS · FIREBASE PHONE AUTHENTICATION</span>
        </div>
      </div>
    </div>
  );
}
