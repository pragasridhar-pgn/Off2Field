import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Camera, CameraOff, CheckCircle2, Flashlight, RefreshCw, X, AlertCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (scannedValue: string) => void;
}

export function QRScannerModal({ isOpen, onClose, onScanSuccess }: QRScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  const [hasCamera, setHasCamera] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [manualCode, setManualCode] = useState("");

  const stopCamera = () => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  const startCamera = async (mode: "environment" | "user") => {
    stopCamera();
    setCameraError(null);
    setIsScanning(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API not supported on this device/browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
      }

      // Check torch capability
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = (videoTrack.getCapabilities && (videoTrack.getCapabilities() as any)) || {};
        setHasTorch(!!capabilities.torch);
      }

      requestAnimationFrame(scanFrame);
    } catch (err: any) {
      console.error("Camera access error:", err);
      setHasCamera(false);
      setIsScanning(false);
      let msg = "Could not access device camera.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        msg = "Camera permission was denied. Please allow camera access in app settings.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        msg = "No camera found on this device.";
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        msg = "Camera is in use by another application.";
      }
      setCameraError(msg);
    }
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track && (track.applyConstraints as any)) {
      try {
        const nextTorch = !torchOn;
        await track.applyConstraints({
          advanced: [{ torch: nextTorch } as any],
        });
        setTorchOn(nextTorch);
      } catch (err) {
        console.warn("Torch error:", err);
      }
    }
  };

  const switchCamera = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  const handleDetected = (rawCode: string) => {
    const trimmed = rawCode.trim();
    if (!trimmed) return;

    // Provide haptic feedback if available
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(100);
      } catch {
        // ignore
      }
    }

    toast.success(`QR Code Scanned: ${trimmed}`);
    stopCamera();
    onScanSuccess(trimmed);
    onClose();
  };

  const scanFrame = () => {
    if (!videoRef.current || !canvasRef.current || !streamRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code && code.data && code.data.trim().length > 0) {
        handleDetected(code.data);
        return;
      }
    }

    animFrameIdRef.current = requestAnimationFrame(scanFrame);
  };

  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="qr-modal-backdrop" onClick={onClose}>
      <div className="qr-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="qr-modal-header">
          <div className="qr-header-title">
            <Camera size={18} color="#38bdf8" />
            <span>Field Machine QR Scanner</span>
          </div>
          <button className="qr-close-btn" onClick={onClose} title="Close Scanner">
            <X size={20} />
          </button>
        </div>

        {/* Camera Viewport */}
        <div className="qr-viewport">
          <video ref={videoRef} className="qr-video" autoPlay playsInline muted />
          <canvas ref={canvasRef} style={{ display: "none" }} />

          {/* Scanner Overlay Box */}
          <div className="qr-scanner-frame">
            <div className="qr-corner qr-tl"></div>
            <div className="qr-corner qr-tr"></div>
            <div className="qr-corner qr-bl"></div>
            <div className="qr-corner qr-br"></div>
            <div className="qr-laser-line"></div>
          </div>

          <div className="qr-scanner-hint">
            <span>Align machine QR label within the frame</span>
          </div>

          {/* Controls toolbar on top of video */}
          <div className="qr-overlay-controls">
            {hasTorch && (
              <button
                type="button"
                className={`qr-control-btn ${torchOn ? "active" : ""}`}
                onClick={toggleTorch}
                title="Toggle Torch"
              >
                <Flashlight size={18} />
              </button>
            )}
            <button
              type="button"
              className="qr-control-btn"
              onClick={switchCamera}
              title="Switch Camera"
            >
              <RefreshCw size={18} />
            </button>
          </div>

          {/* Camera Error Display */}
          {cameraError && (
            <div className="qr-error-overlay">
              <AlertCircle size={36} color="#ef4444" />
              <strong>Camera Unavailable</strong>
              <p>{cameraError}</p>
              <button
                className="btn primary"
                onClick={() => startCamera(facingMode)}
                style={{ marginTop: 12, padding: "8px 16px" }}
              >
                <RefreshCw size={14} /> Retry Camera
              </button>
            </div>
          )}
        </div>

        {/* Bottom Quick Select / Manual Fallback */}
        <div className="qr-modal-footer">
          <div style={{ display: "flex", gap: "8px", width: "100%", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Or enter machine code (e.g. TRF-102)"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid #334155",
                background: "#0f172a",
                color: "#f8fafc",
                fontSize: "13px",
                fontFamily: "monospace",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && manualCode.trim()) {
                  handleDetected(manualCode.trim());
                }
              }}
            />
            <button
              className="btn primary"
              style={{ padding: "10px 16px", fontSize: "13px" }}
              onClick={() => manualCode.trim() && handleDetected(manualCode.trim())}
              disabled={!manualCode.trim()}
            >
              Select
            </button>
          </div>

          {/* Quick preset chips for rapid reviewer demo */}
          <div className="qr-quick-presets">
            <span style={{ fontSize: "11px", color: "#94a3b8" }}>Presets:</span>
            {["TRF-102", "PMP-301", "CBK-201", "SLR-101"].map((code) => (
              <button
                key={code}
                type="button"
                className="qr-preset-chip"
                onClick={() => handleDetected(code)}
              >
                {code}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
