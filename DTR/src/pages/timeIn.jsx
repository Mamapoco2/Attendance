import { useEffect, useRef, useState } from "react";
import { FaceDetection } from "@mediapipe/face_detection";
import { Camera } from "@mediapipe/camera_utils";
import { recognizeFace } from "../../services/faceService";
import { recordAttendance } from "../../services/attendanceService";

export default function TimeIn() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const recognizedNameRef = useRef(null);
  const faceStableCounter = useRef(0);
  const processingRef = useRef(false);

  const [status, setStatus] = useState("Ready to scan");
  const [statusType, setStatusType] = useState("idle");
  const [recognizedName, setRecognizedName] = useState(null);
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

    faceDetection.setOptions({ model: "short", minDetectionConfidence: 0.4 });

    faceDetection.onResults((results) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const ctx = canvas.getContext("2d");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (results.detections.length > 0) {
        faceStableCounter.current++;

        const bbox = results.detections[0].boundingBox;
        const x = (bbox.xCenter - bbox.width / 2) * canvas.width;
        const y = (bbox.yCenter - bbox.height / 2) * canvas.height;
        const width = bbox.width * canvas.width;
        const height = bbox.height * canvas.height;

        const confirmed = !!recognizedNameRef.current;
        const color = confirmed ? "#0ea5e9" : "#94a3b8";
        const cs = 16;

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.shadowColor = color;
        ctx.shadowBlur = confirmed ? 10 : 4;

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

        const scanY = y + ((Date.now() % 2400) / 2400) * height;
        const grad = ctx.createLinearGradient(x, scanY - 8, x, scanY + 8);
        grad.addColorStop(0, "transparent");
        grad.addColorStop(0.5, `${color}40`);
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fillRect(x, scanY - 8, width, 16);

        if (recognizedNameRef.current) {
          ctx.shadowBlur = 8;
          ctx.fillStyle = color;
          ctx.font = "bold 12px 'DM Sans', sans-serif";
          ctx.textAlign = "center";
          const textY = y > 30 ? y - 10 : y + height + 18;
          const centerX = x + width / 2;
          ctx.save();
          ctx.scale(-1, 1);
          ctx.fillText(recognizedNameRef.current, -centerX, textY);
          ctx.restore();
        }

        ctx.shadowBlur = 0;
      } else {
        faceStableCounter.current = 0;
        recognizedNameRef.current = null;
        setRecognizedName(null);
        setStatus("Ready to scan");
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
    setStatus("Ready to scan");
    setStatusType("idle");
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (faceStableCounter.current < 3 || processingRef.current) return;

      try {
        processingRef.current = true;
        setStatus("Verifying identity…");
        setStatusType("scanning");

        const image = captureImage();
        const result = await recognizeFace(image);

        if (result.match) {
          recognizedNameRef.current = result.name;
          setRecognizedName(result.name);
          setStatus("Identity verified");
          setStatusType("success");
        } else {
          recognizedNameRef.current = null;
          setRecognizedName(null);
          setStatus("Face not recognized");
          setStatusType("error");
        }
      } catch (error) {
        console.error(error);
        setStatusType("error");
      } finally {
        processingRef.current = false;
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const captureImage = () => {
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
    return canvas.toDataURL("image/jpeg");
  };

  const handleAttendance = async () => {
    if (!recognizedName) {
      setStatus("No face detected — please look at the camera");
      setStatusType("error");
      return;
    }
    try {
      setStatus("Recording attendance…");
      setStatusType("scanning");
      const attendance = await recordAttendance(recognizedName);
      setStatus(
        `${attendance.type} recorded at ${attendance.time_in || attendance.time_out}`,
      );
      setStatusType("success");
    } catch (error) {
      console.error(error);
      setStatus("Failed to record attendance");
      setStatusType("error");
    }
  };

  const statusMeta = {
    idle: { color: "#64748b", bg: "#f8fafc", border: "#e2e8f0", icon: "○" },
    scanning: { color: "#0284c7", bg: "#f0f9ff", border: "#bae6fd", icon: "◌" },
    success: { color: "#0369a1", bg: "#f0f9ff", border: "#7dd3fc", icon: "✓" },
    error: { color: "#dc2626", bg: "#fef2f2", border: "#fecaca", icon: "✕" },
  };
  const s = statusMeta[statusType];

  const dateStr = time.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = time.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
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

        .brand-sub {
          font-size: 11px;
          color: #94a3b8;
          font-weight: 400;
        }

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
          width: 6px;
          height: 6px;
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

        .card-title {
          font-size: 18px;
          font-weight: 600;
          color: white;
          letter-spacing: -0.3px;
        }

        .card-subtitle {
          font-size: 12px;
          color: rgba(255,255,255,0.7);
          margin-top: 2px;
        }

        .clock-wrap { text-align: right; }

        .clock-time {
          font-family: 'DM Mono', monospace;
          font-size: 22px;
          font-weight: 500;
          color: white;
          line-height: 1;
          letter-spacing: 1px;
        }

        .clock-date {
          font-size: 10px;
          color: rgba(255,255,255,0.65);
          margin-top: 3px;
        }

        .card-body { padding: 24px; }

        .section-label {
          font-size: 11px;
          font-weight: 500;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 10px;
        }

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
          background: rgba(14,165,233,0.85);
          color: white;
          padding: 3px 8px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          gap: 5px;
        }

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

        .status-text {
          font-size: 13px;
          font-weight: 500;
        }

        .divider {
          height: 1px;
          background: #f1f5f9;
          margin: 18px 0;
        }

        .identity-card {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          gap: 14px;
          opacity: 0;
          transform: translateY(6px);
          transition: opacity 0.35s, transform 0.35s, border-color 0.35s, background 0.35s;
          background: #f8fafc;
          min-height: 64px;
        }

        .identity-card.visible {
          opacity: 1;
          transform: translateY(0);
          border-color: #bae6fd;
          background: #f0f9ff;
        }

        .identity-card:not(.visible) {
          opacity: 1;
        }

        .avatar-ring {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #e0f2fe;
          border: 2px solid #bae6fd;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 20px;
          transition: border-color 0.35s, background 0.35s;
        }

        .identity-card.visible .avatar-ring {
          border-color: #7dd3fc;
          background: #e0f2fe;
        }

        .id-role {
          font-size: 10px;
          font-weight: 500;
          color: #0284c7;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 3px;
        }

        .id-name {
          font-size: 16px;
          font-weight: 600;
          color: #0f172a;
          letter-spacing: -0.2px;
        }

        .id-placeholder {
          font-size: 13px;
          color: #cbd5e1;
          font-style: italic;
        }

        .confirm-btn {
          margin-top: 16px;
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

        .confirm-btn:hover:not(:disabled) {
          background: #0284c7;
          box-shadow: 0 4px 14px rgba(14,165,233,0.4);
        }

        .confirm-btn:active:not(:disabled) { transform: scale(0.98); }

        .confirm-btn:disabled {
          background: #e2e8f0;
          color: #94a3b8;
          cursor: not-allowed;
          box-shadow: none;
        }

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
          <div className="card-header">
            <div>
              <div className="card-title">Face Recognition</div>
              <div className="card-subtitle">Time In / Time Out</div>
            </div>
            <div className="clock-wrap">
              <div className="clock-time">{timeStr}</div>
              <div className="clock-date">{dateStr}</div>
            </div>
          </div>

          <div className="card-body">
            <div className="section-label">Camera Feed</div>

            <div className="video-wrapper">
              <video ref={videoRef} autoPlay muted playsInline />
              <canvas ref={canvasRef} />
              <span className="vid-badge tl">CAM · 01</span>
              <span className="vid-badge tr">
                <span className="live-dot" style={{ width: 5, height: 5 }} />
                LIVE
              </span>
            </div>

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

            <div className="section-label">Staff Identity</div>

            <div className={`identity-card ${recognizedName ? "visible" : ""}`}>
              <div className="avatar-ring">👤</div>
              <div>
                {recognizedName ? (
                  <>
                    <div className="id-role">Verified Staff</div>
                    <div className="id-name">{recognizedName}</div>
                  </>
                ) : (
                  <div className="id-placeholder">Awaiting face detection…</div>
                )}
              </div>
            </div>

            <button
              className="confirm-btn"
              onClick={handleAttendance}
              disabled={!recognizedName}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Confirm Attendance
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
