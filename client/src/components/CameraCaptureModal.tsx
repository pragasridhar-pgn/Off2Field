import { useEffect, useRef, useState } from "react";
import { Camera, Check, Flashlight, RefreshCw, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (fileOrBlob: { blob: Blob; fileName: string; dataUrl: string }) => void;
  machineTitle?: string;
}

export function CameraCaptureModal({
  isOpen,
  onClose,
  onCapture,
  machineTitle = "Field Equipment",
}: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [hasCamera, setHasCamera] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);

  const stopCamera = () => {
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
  };

  const startCamera = async (mode: "environment" | "user") => {
    stopCamera();
    setCameraError(null);
    setPreviewDataUrl(null);
    setPreviewBlob(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API not supported.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = (videoTrack.getCapabilities && (videoTrack.getCapabilities() as any)) || {};
        setHasTorch(!!capabilities.torch);
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      setHasCamera(false);
      let msg = "Could not access camera.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        msg = "Camera permission was denied. Please allow camera access.";
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

  const takeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Add watermark timestamp and GPS / machine tag onto snapshot
    const timeStr = new Date().toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    ctx.fillStyle = "rgba(15, 23, 42, 0.65)";
    ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillText(`OFF2FIELD · ${machineTitle}`, 16, canvas.height - 15);
    ctx.fillStyle = "#ffffff";
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillText(timeStr, canvas.width - 240, canvas.height - 15);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
          setPreviewBlob(blob);
          setPreviewDataUrl(dataUrl);

          if (typeof navigator !== "undefined" && navigator.vibrate) {
            try {
              navigator.vibrate(80);
            } catch {
              // ignore
            }
          }
        }
      },
      "image/jpeg",
      0.92
    );
  };

  const handleConfirm = () => {
    if (previewBlob && previewDataUrl) {
      const fileName = `EVD_${Date.now()}.jpg`;
      onCapture({
        blob: previewBlob,
        fileName,
        dataUrl: previewDataUrl,
      });
      stopCamera();
      onClose();
    }
  };

  const handleRetake = () => {
    setPreviewBlob(null);
    setPreviewDataUrl(null);
    startCamera(facingMode);
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
    <div className="camera-modal-backdrop" onClick={onClose}>
      <div className="camera-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Top bar */}
        <div className="camera-modal-topbar">
          <div className="camera-header-info">
            <Camera size={18} color="#38bdf8" />
            <span>Field Photo Capture · {machineTitle}</span>
          </div>
          <button className="camera-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Viewfinder / Preview */}
        <div className="camera-viewfinder">
          {previewDataUrl ? (
            <img src={previewDataUrl} alt="Captured Snapshot" className="camera-preview-img" />
          ) : (
            <video ref={videoRef} className="camera-video" autoPlay playsInline muted />
          )}

          {/* Controls overlay */}
          {!previewDataUrl && (
            <div className="camera-top-controls">
              {hasTorch && (
                <button
                  type="button"
                  className={`camera-icon-pill ${torchOn ? "active" : ""}`}
                  onClick={toggleTorch}
                >
                  <Flashlight size={16} />
                </button>
              )}
              <button
                type="button"
                className="camera-icon-pill"
                onClick={switchCamera}
                title="Switch Camera"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          )}

          {cameraError && (
            <div className="camera-error-view">
              <AlertCircle size={32} color="#ef4444" />
              <p>{cameraError}</p>
              <button className="btn primary" onClick={() => startCamera(facingMode)}>
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Bottom Shutter / Action bar */}
        <div className="camera-modal-bottom">
          {previewDataUrl ? (
            <div className="camera-confirm-actions">
              <button type="button" className="btn secondary" onClick={handleRetake}>
                <RefreshCw size={15} /> Retake
              </button>
              <button type="button" className="btn primary" onClick={handleConfirm} style={{ background: "#10b981" }}>
                <Check size={16} /> Save & Attach
              </button>
            </div>
          ) : (
            <div className="camera-shutter-container">
              <button
                type="button"
                className="camera-shutter-btn"
                onClick={takeSnapshot}
                title="Capture Photo"
              >
                <div className="shutter-inner"></div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
