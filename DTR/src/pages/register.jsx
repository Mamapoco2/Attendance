import { useEffect, useRef, useState } from "react";
import { FaceDetection } from "@mediapipe/face_detection";
import { Camera } from "@mediapipe/camera_utils";
import { registerFace } from "../../services/faceService";

export default function FaceRegister() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [name, setName] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [status, setStatus] = useState("Position your face in the frame");
  const [statusType, setStatusType] = useState("idle");
  const [faceDetected, setFaceDetected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const tick = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const faceDetection = new FaceDetection({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
    });

    faceDetection.setOptions({ model: "short", minDetectionConfidence: 0.6 });

    faceDetection.onResults((results) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const ctx = canvas.getContext("2d");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (results.detections.length > 0) {
        setFaceDetected(true);
        setStatus("Face detected — ready to register");
        setStatusType("success");

        const bbox = results.detections[0].boundingBox;
        const x = (bbox.xCenter - bbox.width / 2) * canvas.width;
        const y = (bbox.yCenter - bbox.height / 2) * canvas.height;
        const width = bbox.width * canvas.width;
        const height = bbox.height * canvas.height;

        const color = "#0ea5e9";
        const cs = 16;

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;

        ctx.beginPath();
        ctx.moveTo(x, y + cs);
        ctx.lineTo(x, y);
        ctx.lineTo(x + cs, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + width - cs, y);
        ctx.lineTo(x + width, y);
        ctx.lineTo(x + width, y + cs);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y + height - cs);
        ctx.lineTo(x, y + height);
        ctx.lineTo(x + cs, y + height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + width - cs, y + height);
        ctx.lineTo(x + width, y + height);
        ctx.lineTo(x + width, y + height - cs);
        ctx.stroke();

        // Subtle scan line
        const scanY = y + ((Date.now() % 2400) / 2400) * height;
        const grad = ctx.createLinearGradient(x, scanY - 8, x, scanY + 8);
        grad.addColorStop(0, "transparent");
        grad.addColorStop(0.5, `${color}40`);
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fillRect(x, scanY - 8, width, 16);

        ctx.shadowBlur = 0;
      } else {
        setFaceDetected(false);
        setStatus("No face detected — adjust your position");
        setStatusType("idle");
      }
    });

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        await faceDetection.send({ image: videoRef.current });
      },
      width: 320,
      height: 240,
    });

    camera.start();
  }, []);

  const captureImage = () => {
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
    return canvas.toDataURL("image/jpeg");
  };

  const handleRegister = async () => {
    if (!name.trim()) {
      setStatus("Please enter a staff name");
      setStatusType("error");
      return;
    }
    if (!faceDetected) {
      setStatus("No face detected — please look at the camera");
      setStatusType("error");
      return;
    }
    if (!employeeNumber.trim()) {
      setStatus("Please enter an employee number");
      setStatusType("error");
      return;
    }
    try {
      setLoading(true);
      setStatus("Registering face…");
      setStatusType("scanning");
      const image = captureImage();
      await registerFace(name, employeeNumber, image);
      setStatus(`"${name}" registered successfully`);
      setStatusType("success");
      setName("");
      setEmployeeNumber("");
    } catch (error) {
      console.error(error);
      setStatus("Registration failed — please try again");
      setStatusType("error");
    } finally {
      setLoading(false);
    }
  };

  const statusMeta = {
    idle: { color: "#64748b", bg: "#f8fafc", border: "#e2e8f0", icon: "○" },
    scanning: { color: "#0284c7", bg: "#f0f9ff", border: "#bae6fd", icon: "◌" },
    success: { color: "#0369a1", bg: "#f0f9ff", border: "#7dd3fc", icon: "✓" },
    error: { color: "#dc2626", bg: "#fef2f2", border: "#fecaca", icon: "✕" },
  };
  const s = statusMeta[statusType];

  const timeStr = time.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const dateStr = time.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .hosp-root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #f1f5f9;
          font-family: 'DM Sans', sans-serif;
          padding: 24px;
        }

        .top-bar {
          width: 100%;
          max-width: 480px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .hospital-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .cross-icon {
          width: 34px;
          height: 34px;
          background: #0ea5e9;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(14,165,233,0.35);
        }

        .cross-icon svg { width: 18px; height: 18px; fill: white; }

        .brand-name {
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
          letter-spacing: -0.2px;
          line-height: 1.2;
        }

        .brand-sub { font-size: 11px; color: #94a3b8; font-weight: 400; }

        .live-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 99px;
          padding: 5px 12px;
          font-size: 11px;
          font-weight: 500;
          color: #475569;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        .live-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #22c55e;
          animation: blink 1.4s ease-in-out infinite;
          flex-shrink: 0;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .card {
          width: 100%;
          max-width: 480px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.08);
          overflow: hidden;
        }

        .card-header {
          background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
          padding: 20px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .card-title { font-size: 18px; font-weight: 600; color: white; letter-spacing: -0.3px; }
        .card-subtitle { font-size: 12px; color: rgba(255,255,255,0.7); margin-top: 2px; }

        .clock-wrap { text-align: right; }

        .clock-time {
          font-family: 'DM Mono', monospace;
          font-size: 22px;
          font-weight: 500;
          color: white;
          line-height: 1;
          letter-spacing: 1px;
        }

        .clock-date { font-size: 10px; color: rgba(255,255,255,0.65); margin-top: 3px; }

        .card-body { padding: 24px; }

        .section-label {
          font-size: 11px;
          font-weight: 500;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 10px;
        }

        /* Steps indicator */
        .steps-row {
          display: flex;
          align-items: center;
          gap: 0;
          margin-bottom: 20px;
        }

        .step {
          display: flex;
          align-items: center;
          gap: 7px;
          flex: 1;
        }

        .step-circle {
          width: 24px; height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 600;
          flex-shrink: 0;
          transition: background 0.3s, border-color 0.3s;
        }

        .step-circle.done { background: #0ea5e9; color: white; border: 2px solid #0ea5e9; }
        .step-circle.active { background: white; color: #0ea5e9; border: 2px solid #0ea5e9; }
        .step-circle.pending { background: white; color: #cbd5e1; border: 2px solid #e2e8f0; }

        .step-label { font-size: 11px; font-weight: 500; color: #94a3b8; }
        .step-label.active { color: #0284c7; }
        .step-label.done { color: #0f172a; }

        .step-line { flex: 1; height: 1px; background: #e2e8f0; margin: 0 8px; }
        .step-line.done { background: #0ea5e9; }

        /* Video */
        .video-wrapper {
          position: relative;
          border-radius: 10px;
          overflow: hidden;
          background: #0f172a;
          aspect-ratio: 4/3;
          border: 1px solid #e2e8f0;
        }

        .video-wrapper video {
          width: 100%; height: 100%;
          object-fit: cover;
          display: block;
          transform: scaleX(-1);
        }

        .video-wrapper canvas {
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          transform: scaleX(-1);
          z-index: 2;
        }

        .vid-badge {
          position: absolute;
          z-index: 3;
          font-size: 10px;
          font-weight: 500;
          font-family: 'DM Mono', monospace;
          letter-spacing: 0.5px;
        }

        .vid-badge.tl {
          top: 10px; left: 10px;
          background: rgba(0,0,0,0.45);
          color: #94a3b8;
          padding: 3px 7px;
          border-radius: 4px;
        }

        .vid-badge.tr {
          top: 10px; right: 10px;
          background: rgba(220, 38, 38, 0.85);
          color: white;
          padding: 3px 8px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          gap: 5px;
        }

        /* Face indicator overlay */
        .face-indicator {
          position: absolute;
          bottom: 10px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 3;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 99px;
          font-size: 10px;
          font-weight: 500;
          transition: background 0.3s;
        }

        .face-indicator.detected {
          background: rgba(14,165,233,0.85);
          color: white;
        }

        .face-indicator.none {
          background: rgba(0,0,0,0.45);
          color: #94a3b8;
        }

        /* Status */
        .status-row {
          margin-top: 14px;
          padding: 11px 14px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 10px;
          transition: background 0.3s, border-color 0.3s;
          border: 1px solid;
        }

        .status-icon {
          font-size: 13px;
          font-weight: 600;
          width: 20px;
          text-align: center;
          flex-shrink: 0;
        }

        @keyframes spin-icon {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .status-icon.scanning {
          display: inline-block;
          animation: spin-icon 1s linear infinite;
        }

        .status-text { font-size: 13px; font-weight: 500; }

        .divider { height: 1px; background: #f1f5f9; margin: 18px 0; }

        /* Name input */
        .input-wrap { position: relative; }

        .input-label {
          display: block;
          font-size: 11px;
          font-weight: 500;
          color: #64748b;
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }

        .name-input {
          width: 100%;
          padding: 11px 14px 11px 38px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 500;
          color: #0f172a;
          background: #f8fafc;
          outline: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
        }

        .name-input::placeholder { color: #cbd5e1; font-weight: 400; }

        .name-input:focus {
          border-color: #7dd3fc;
          background: white;
          box-shadow: 0 0 0 3px rgba(14,165,233,0.1);
        }

        .input-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
          font-size: 14px;
        }

        /* Register button */
        .register-btn {
          margin-top: 14px;
          width: 100%;
          padding: 13px 20px;
          background: #0ea5e9;
          border: none;
          border-radius: 10px;
          color: white;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.2px;
          cursor: pointer;
          transition: background 0.2s, transform 0.1s, box-shadow 0.2s;
          box-shadow: 0 2px 8px rgba(14,165,233,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .register-btn:hover:not(:disabled) {
          background: #0284c7;
          box-shadow: 0 4px 14px rgba(14,165,233,0.4);
        }

        .register-btn:active:not(:disabled) { transform: scale(0.98); }

        .register-btn:disabled {
          background: #e2e8f0;
          color: #94a3b8;
          cursor: not-allowed;
          box-shadow: none;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .spinner {
          width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        /* Footer */
        .card-footer {
          padding: 12px 24px;
          background: #f8fafc;
          border-top: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .footer-text { font-size: 11px; color: #94a3b8; }

        .footer-badge {
          font-size: 10px;
          font-weight: 500;
          color: #0284c7;
          background: #e0f2fe;
          border-radius: 4px;
          padding: 2px 7px;
        }
      `}</style>

      <div className="hosp-root">
        {/* Top bar */}
        <div className="top-bar">
          <div className="hospital-brand">
            <div className="cross-icon">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 8h-4V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v4H5a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h4v4a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-4h4a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1z" />
              </svg>
            </div>
            <div>
              <div className="brand-name">
                Rosario Maclang Bautista General Hospital
              </div>
              <div className="brand-sub">Staff Attendance Portal</div>
            </div>
          </div>
          <div className="live-pill">
            <span className="live-dot" />
            Camera Active
          </div>
        </div>

        <div className="card">
          {/* Header */}
          <div className="card-header">
            <div>
              <div className="card-title">Staff Registration</div>
              <div className="card-subtitle">Enroll a new face profile</div>
            </div>
            <div className="clock-wrap">
              <div className="clock-time">{timeStr}</div>
              <div className="clock-date">{dateStr}</div>
            </div>
          </div>

          <div className="card-body">
            {/* Steps */}
            <div className="steps-row">
              <div className="step">
                <div
                  className={`step-circle ${faceDetected ? "done" : "active"}`}
                >
                  {faceDetected ? "✓" : "1"}
                </div>
                <span
                  className={`step-label ${faceDetected ? "done" : "active"}`}
                >
                  Face
                </span>
              </div>
              <div className={`step-line ${faceDetected ? "done" : ""}`} />
              <div className="step">
                <div
                  className={`step-circle ${name.trim() ? "done" : faceDetected ? "active" : "pending"}`}
                >
                  {name.trim() ? "✓" : "2"}
                </div>
                <span
                  className={`step-label ${name.trim() ? "done" : faceDetected ? "active" : ""}`}
                >
                  Name
                </span>
              </div>
              <div
                className={`step-line ${name.trim() && faceDetected ? "done" : ""}`}
              />
              <div className="step">
                <div
                  className={`step-circle ${statusType === "success" ? "done" : name.trim() && faceDetected ? "active" : "pending"}`}
                >
                  {statusType === "success" ? "✓" : "3"}
                </div>
                <span
                  className={`step-label ${statusType === "success" ? "done" : name.trim() && faceDetected ? "active" : ""}`}
                >
                  Register
                </span>
              </div>
            </div>

            <div className="section-label">Camera Feed</div>

            {/* Video */}
            <div className="video-wrapper">
              <video ref={videoRef} autoPlay muted playsInline />
              <canvas ref={canvasRef} />
              <span className="vid-badge tl">CAM · 01</span>
              <span className="vid-badge tr">
                <span className="live-dot" style={{ width: 5, height: 5 }} />
                LIVE
              </span>
              <div
                className={`face-indicator ${faceDetected ? "detected" : "none"}`}
              >
                {faceDetected ? "● Face in frame" : "○ No face detected"}
              </div>
            </div>

            {/* Status */}
            <div
              className="status-row"
              style={{ background: s.bg, borderColor: s.border }}
            >
              <span
                className={`status-icon ${statusType === "scanning" ? "scanning" : ""}`}
                style={{ color: s.color }}
              >
                {s.icon}
              </span>
              <span className="status-text" style={{ color: s.color }}>
                {status}
              </span>
            </div>

            <div className="divider" />

            <div className="section-label">Staff Details</div>

            {/* Name input */}
            <div className="input-wrap">
              <label className="input-label">Full Name</label>
              <span className="input-icon">👤</span>
              <input
                type="text"
                className="name-input"
                placeholder="e.g. Dr. Maria Santos"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRegister()}
              />
            </div>

            <div className="input-wrap" style={{ marginTop: 10 }}>
              <label className="input-label">Employee Number</label>
              <span className="input-icon">#</span>
              <input
                type="text"
                className="name-input"
                placeholder="e.g. EMP-0001"
                value={employeeNumber}
                onChange={(e) => setEmployeeNumber(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRegister()}
              />
            </div>

            {/* Register button */}
            <button
              className="register-btn"
              onClick={handleRegister}
              disabled={
                loading || !faceDetected || !name.trim() || !employeeNumber.trim()
              }
            >
              {loading ? (
                <>
                  <span className="spinner" />
                  Registering…
                </>
              ) : (
                <>
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                  Register Staff Face
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
