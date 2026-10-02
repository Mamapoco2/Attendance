import { useEffect, useRef, useState } from "react";
import { FaceDetection } from "@mediapipe/face_detection";
import { Camera } from "@mediapipe/camera_utils";
import { registerFace } from "../../services/faceService";

export default function FaceRegister() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const faceDetectedRef = useRef(false); // ← add this

  const [name, setName] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [status, setStatus] = useState("Position your face in the frame");
  const [statusType, setStatusType] = useState("idle");
  const [faceDetected, setFaceDetected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    faceDetectedRef.current = faceDetected; // ← keep ref in sync with state
  }, [faceDetected]);

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

  const FRAMES_TO_CAPTURE = 8; // between REGISTER_MIN/MAX on the backend
  const CAPTURE_INTERVAL_MS = 250; // spread over ~2 seconds

  const captureFrame = () => {
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
    return canvas.toDataURL("image/jpeg");
  };

  const captureBurst = async (count, intervalMs) => {
    const frames = [];
    for (let i = 0; i < count; i++) {
      // Skip capturing if the face has dropped out of frame
      if (faceDetectedRef.current) {
        frames.push(captureFrame());
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    return frames;
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
      setStatus("Hold still — capturing multiple angles…");
      setStatusType("scanning");

      const frames = await captureBurst(FRAMES_TO_CAPTURE, CAPTURE_INTERVAL_MS);

      if (frames.length < 5) {
        setStatus("Face left the frame too often — please try again");
        setStatusType("error");
        return;
      }

      setStatus("Registering face…");
      await registerFace(name, employeeNumber, frames); // now sends an array
      setStatus(`"${name}" registered successfully`);
      setStatusType("success");
      setName("");
      setEmployeeNumber("");
    } catch (error) {
      console.error(error);
      setStatus(
        error?.response?.data?.error ||
          "Registration failed — please try again",
      );
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

          <div className="card-body two-col">
            <div className="col-main">
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
            </div>
            <div className="col-side">
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
                  loading ||
                  !faceDetected ||
                  !name.trim() ||
                  !employeeNumber.trim()
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
      </div>
    </>
  );
}
