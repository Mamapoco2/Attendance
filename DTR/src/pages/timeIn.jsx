import { useEffect, useRef, useState, useCallback } from "react";
import { FaceDetection } from "@mediapipe/face_detection";
import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera } from "@mediapipe/camera_utils";
import { recognizeFace } from "../../services/faceService";
import { recordAttendance } from "../../services/attendanceService";
import { useLiveness } from "../../hooks/useLiveness";

export default function TimeIn() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const recognizedNameRef = useRef(null);
  const faceStableCounter = useRef(0);
  const faceVisibleRef = useRef(false);

  // ── Performance: debounce recognition — fire once per face appearance ──────
  const recognitionFiredRef = useRef(false); // reset when face leaves frame
  const recognitionInFlightRef = useRef(false);

  // ── Performance: cache known faces so we don't re-fetch every call ─────────
  const knownFacesCacheRef = useRef(null);

  const livenessStateRef = useRef({
    ok: false,
    rejected: false,
    challenge: null,
    isLockedOut: false,
    cooldownUntil: 0,
  });

  const [status, setStatus] = useState("Ready to scan");
  const [statusType, setStatusType] = useState("idle");
  const [recognizedName, setRecognizedName] = useState(null);
  const [time, setTime] = useState(new Date());

  const {
    challenge,
    challengeLabel,
    challengeProgress,
    livenessOk,
    livenessRejected,
    isLockedOut,
    lockoutSecondsLeft,
    startChallenge,
    resetChallenge,
    processMeshResults,
  } = useLiveness();

  // Keep ref in sync with hook state
  useEffect(() => {
    livenessStateRef.current.ok = livenessOk;
    livenessStateRef.current.rejected = livenessRejected;
    livenessStateRef.current.challenge = challenge;
    livenessStateRef.current.isLockedOut = isLockedOut;
  }, [livenessOk, livenessRejected, challenge, isLockedOut]);

  // Clock
  useEffect(() => {
    const tick = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  // Status messages
  useEffect(() => {
    if (isLockedOut) {
      setStatus(`Too many failures — locked out for ${lockoutSecondsLeft}s`);
      setStatusType("error");
    } else if (livenessRejected) {
      setStatus("Liveness check timed out — please try again");
      setStatusType("error");
      livenessStateRef.current.cooldownUntil = Date.now() + 3000;
    } else if (challengeLabel) {
      setStatus(challengeLabel);
      setStatusType("scanning");
    } else if (livenessOk && !recognizedName) {
      setStatus("Liveness confirmed — verifying identity…");
      setStatusType("scanning");
    }
  }, [
    challengeLabel,
    livenessOk,
    livenessRejected,
    isLockedOut,
    lockoutSecondsLeft,
    recognizedName,
  ]);

  // ── Performance: pre-fetch and cache known faces on mount ─────────────────
  useEffect(() => {
    async function warmCache() {
      try {
        // Adjust this import path to wherever you fetch known faces from
        const { getKnownFaces } = await import("../../services/faceService");
        knownFacesCacheRef.current = await getKnownFaces();
      } catch (e) {
        console.warn("Could not pre-fetch known faces:", e);
      }
    }
    warmCache();
  }, []);

  // ── Recognition: fires once per face appearance after liveness passes ──────
  const attemptRecognition = useCallback(async () => {
    const ls = livenessStateRef.current;
    if (
      recognitionFiredRef.current ||
      recognitionInFlightRef.current ||
      !ls.ok ||
      ls.challenge !== null ||
      ls.rejected ||
      ls.isLockedOut ||
      Date.now() < ls.cooldownUntil ||
      recognizedNameRef.current !== null
    )
      return;

    recognitionFiredRef.current = true;
    recognitionInFlightRef.current = true;

    try {
      setStatus("Verifying identity…");
      setStatusType("scanning");

      const image = captureImage();
      // Use cached known faces if available, otherwise let the service fetch
      const result = await recognizeFace(image, knownFacesCacheRef.current);

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
        // Allow retry after a short delay
        setTimeout(() => {
          recognitionFiredRef.current = false;
        }, 3000);
      }
    } catch (err) {
      console.error("Recognition error:", err);
      setStatus("Recognition failed — please try again");
      setStatusType("error");
      recognizedNameRef.current = null;
      recognitionFiredRef.current = false;
    } finally {
      recognitionInFlightRef.current = false;
    }
  }, []);

  // Watch for liveness becoming ok and trigger recognition immediately
  useEffect(() => {
    if (livenessOk) attemptRecognition();
  }, [livenessOk, attemptRecognition]);

  // ── Camera + MediaPipe setup ───────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const faceDetection = new FaceDetection({
      locateFile: (f) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${f}`,
    });
    faceDetection.setOptions({ model: "short", minDetectionConfidence: 0.4 });

    faceDetection.onResults((results) => {
      const canvas = canvasRef.current;
      if (!canvas || !video) return;

      const ctx = canvas.getContext("2d");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (results.detections.length > 0) {
        faceStableCounter.current++;
        faceVisibleRef.current = true;

        const ls = livenessStateRef.current;

        if (faceStableCounter.current === 3) {
          if (
            !ls.ok &&
            !ls.challenge &&
            !ls.isLockedOut &&
            Date.now() >= ls.cooldownUntil
          ) {
            startChallenge();
          }
        }

        const bbox = results.detections[0].boundingBox;
        const x = (bbox.xCenter - bbox.width / 2) * canvas.width;
        const y = (bbox.yCenter - bbox.height / 2) * canvas.height;
        const w = bbox.width * canvas.width;
        const h = bbox.height * canvas.height;

        const color =
          ls.rejected || ls.isLockedOut
            ? "#ef4444"
            : ls.ok
              ? "#0ea5e9"
              : ls.challenge
                ? "#f59e0b"
                : "#94a3b8";

        drawCornerBrackets(ctx, x, y, w, h, color);
        drawScanLine(ctx, x, y, w, h, color);
        drawProgressDots(ctx, x, y, w, challengeProgress);

        if (recognizedNameRef.current) {
          drawLabel(ctx, recognizedNameRef.current, x, y, w, h, color);
        } else if (challengeLabel) {
          drawLabel(ctx, challengeLabel, x, y, w, h, "#f59e0b");
        }

        ctx.shadowBlur = 0;
      } else {
        if (faceVisibleRef.current) {
          faceStableCounter.current = 0;
          faceVisibleRef.current = false;
          recognizedNameRef.current = null;
          recognitionFiredRef.current = false; // ← allow fresh recognition next time

          const prevCooldown = livenessStateRef.current.cooldownUntil;
          livenessStateRef.current = {
            ok: false,
            rejected: false,
            challenge: null,
            isLockedOut: livenessStateRef.current.isLockedOut,
            cooldownUntil: prevCooldown,
          };

          setRecognizedName(null);
          setStatus(
            Date.now() < prevCooldown
              ? "Please wait before trying again…"
              : "Ready to scan",
          );
          setStatusType("idle");
          resetChallenge();
        }
      }
    });

    const faceMesh = new FaceMesh({
      locateFile: (f) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
    });
    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    faceMesh.onResults(processMeshResults);

    const camera = new Camera(video, {
      onFrame: async () => {
        await faceDetection.send({ image: video });

        // ── Performance: only run FaceMesh when a challenge is active ─────
        if (livenessStateRef.current.challenge !== null) {
          await faceMesh.send({ image: video });
        }
      },
      width: 320,
      height: 240,
    });

    camera.start();
    setStatus("Ready to scan");
    setStatusType("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Canvas helpers ─────────────────────────────────────────────────────────
  function drawCornerBrackets(ctx, x, y, w, h, color) {
    const cs = 16;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    [
      [x, y + cs, x, y, x + cs, y],
      [x + w - cs, y, x + w, y, x + w, y + cs],
      [x, y + h - cs, x, y + h, x + cs, y + h],
      [x + w - cs, y + h, x + w, y + h, x + w, y + h - cs],
    ].forEach(([x1, y1, x2, y2, x3, y3]) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.stroke();
    });
  }

  function drawScanLine(ctx, x, y, w, h, color) {
    const scanY = y + ((Date.now() % 2400) / 2400) * h;
    const grad = ctx.createLinearGradient(x, scanY - 8, x, scanY + 8);
    grad.addColorStop(0, "transparent");
    grad.addColorStop(0.5, `${color}40`);
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(x, scanY - 8, w, 16);
  }

  // ── New: draw challenge progress dots below the face box ──────────────────
  function drawProgressDots(ctx, x, y, w, progress) {
    if (!progress || progress.total === 0) return;
    const dotR = 4;
    const gap = 14;
    const total = progress.total;
    const done = progress.current;
    const totalWidth = total * dotR * 2 + (total - 1) * gap;
    const startX = x + w / 2 - totalWidth / 2 + dotR;
    const dotY = y - 20;

    ctx.shadowBlur = 0;
    for (let i = 0; i < total; i++) {
      const dotX = startX + i * (dotR * 2 + gap);
      ctx.beginPath();
      ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
      ctx.fillStyle = i < done ? "#0ea5e9" : i === done ? "#f59e0b" : "#475569";
      ctx.fill();
    }
  }

  function drawLabel(ctx, text, x, y, w, h, color) {
    ctx.shadowBlur = 8;
    ctx.fillStyle = color;
    ctx.font = "bold 12px 'DM Sans', sans-serif";
    ctx.textAlign = "center";
    const textY = y > 30 ? y - 10 : y + h + 18;
    const cx = x + w / 2;
    ctx.save();
    ctx.scale(-1, 1);
    ctx.fillText(text, -cx, textY);
    ctx.restore();
  }

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
    } catch (err) {
      console.error("Attendance error:", err);
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

  const livenessBadge = isLockedOut
    ? {
        text: `Locked out ${lockoutSecondsLeft}s`,
        color: "#ef4444",
        bg: "rgba(239,68,68,0.15)",
      }
    : livenessRejected
      ? {
          text: "Liveness failed",
          color: "#ef4444",
          bg: "rgba(239,68,68,0.15)",
        }
      : livenessOk
        ? { text: "Live ✓", color: "#16a34a", bg: "rgba(22,163,74,0.12)" }
        : challenge
          ? {
              text: `Challenge ${challengeProgress.current + 1} of ${challengeProgress.total}`,
              color: "#b45309",
              bg: "rgba(245,158,11,0.15)",
            }
          : null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        .hosp-root{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f1f5f9;font-family:'DM Sans',sans-serif;padding:24px}
        .top-bar{width:100%;max-width:480px;display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
        .hospital-brand{display:flex;align-items:center;gap:10px}
        .cross-icon{width:34px;height:34px;background:#0ea5e9;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 2px 8px rgba(14,165,233,.35)}
        .cross-icon svg{width:18px;height:18px;fill:white}
        .brand-name{font-size:14px;font-weight:600;color:#0f172a;letter-spacing:-.2px;line-height:1.2}
        .brand-sub{font-size:11px;color:#94a3b8}
        .live-pill{display:flex;align-items:center;gap:6px;background:white;border:1px solid #e2e8f0;border-radius:99px;padding:5px 12px;font-size:11px;font-weight:500;color:#475569;box-shadow:0 1px 3px rgba(0,0,0,.05)}
        .live-dot{width:6px;height:6px;border-radius:50%;background:#22c55e;animation:blink-dot 1.4s ease-in-out infinite;flex-shrink:0}
        @keyframes blink-dot{0%,100%{opacity:1}50%{opacity:.3}}
        .card{width:100%;max-width:480px;background:white;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,.06),0 8px 32px rgba(0,0,0,.08);overflow:hidden}
        .card-header{background:linear-gradient(135deg,#0ea5e9 0%,#0284c7 100%);padding:20px 24px;display:flex;align-items:center;justify-content:space-between}
        .card-title{font-size:18px;font-weight:600;color:white;letter-spacing:-.3px}
        .card-subtitle{font-size:12px;color:rgba(255,255,255,.7);margin-top:2px}
        .clock-wrap{text-align:right}
        .clock-time{font-family:'DM Mono',monospace;font-size:22px;font-weight:500;color:white;line-height:1;letter-spacing:1px}
        .clock-date{font-size:10px;color:rgba(255,255,255,.65);margin-top:3px}
        .card-body{padding:24px}
        .section-label{font-size:11px;font-weight:500;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px}
        .video-wrapper{position:relative;border-radius:10px;overflow:hidden;background:#0f172a;aspect-ratio:4/3;border:1px solid #e2e8f0}
        .video-wrapper video{width:100%;height:100%;object-fit:cover;display:block;transform:scaleX(-1)}
        .video-wrapper canvas{position:absolute;top:0;left:0;width:100%;height:100%;transform:scaleX(-1);z-index:2}
        .vid-badge{position:absolute;z-index:3;font-size:10px;font-weight:500;font-family:'DM Mono',monospace;letter-spacing:.5px}
        .vid-badge.tl{top:10px;left:10px;background:rgba(0,0,0,.45);color:#94a3b8;padding:3px 7px;border-radius:4px}
        .vid-badge.tr{top:10px;right:10px;background:rgba(14,165,233,.85);color:white;padding:3px 8px;border-radius:4px;display:flex;align-items:center;gap:5px}
        .liveness-badge{position:absolute;bottom:10px;left:50%;transform:translateX(-50%);z-index:4;font-size:11px;font-weight:600;padding:4px 12px;border-radius:99px;font-family:'DM Sans',sans-serif;white-space:nowrap;transition:background .3s,color .3s}
        .challenge-banner{margin-top:10px;padding:10px 14px;border-radius:8px;background:#fffbeb;border:1px solid #fcd34d;display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:13px;font-weight:500;color:#92400e;transition:opacity .3s}
        .challenge-banner.hidden{opacity:0;pointer-events:none}
        .challenge-dots{display:flex;gap:6px;align-items:center}
        .challenge-dot{width:8px;height:8px;border-radius:50%;transition:background .3s}
        .status-row{margin-top:10px;padding:11px 14px;border-radius:8px;display:flex;align-items:center;gap:10px;transition:background .3s,border-color .3s;border:1px solid}
        .status-icon{font-size:13px;font-weight:600;width:20px;text-align:center;flex-shrink:0}
        @keyframes spin-icon{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        .status-icon.scanning{display:inline-block;animation:spin-icon 1s linear infinite}
        .status-text{font-size:13px;font-weight:500}
        .divider{height:1px;background:#f1f5f9;margin:18px 0}
        .identity-card{border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;display:flex;align-items:center;gap:14px;transition:opacity .35s,border-color .35s,background .35s;background:#f8fafc;min-height:64px}
        .identity-card.visible{border-color:#bae6fd;background:#f0f9ff}
        .avatar-ring{width:44px;height:44px;border-radius:50%;background:#e0f2fe;border:2px solid #bae6fd;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px}
        .identity-card.visible .avatar-ring{border-color:#7dd3fc}
        .id-role{font-size:10px;font-weight:500;color:#0284c7;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px}
        .id-name{font-size:16px;font-weight:600;color:#0f172a;letter-spacing:-.2px}
        .id-placeholder{font-size:13px;color:#cbd5e1;font-style:italic}
        .confirm-btn{margin-top:16px;width:100%;padding:13px 20px;background:#0ea5e9;border:none;border-radius:10px;color:white;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;letter-spacing:.2px;cursor:pointer;transition:background .2s,transform .1s,box-shadow .2s;box-shadow:0 2px 8px rgba(14,165,233,.3);display:flex;align-items:center;justify-content:center;gap:8px}
        .confirm-btn:hover:not(:disabled){background:#0284c7;box-shadow:0 4px 14px rgba(14,165,233,.4)}
        .confirm-btn:active:not(:disabled){transform:scale(.98)}
        .confirm-btn:disabled{background:#e2e8f0;color:#94a3b8;cursor:not-allowed;box-shadow:none}
        .card-footer{padding:12px 24px;background:#f8fafc;border-top:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between}
        .footer-text{font-size:11px;color:#94a3b8}
        .footer-badge{font-size:10px;font-weight:500;color:#0284c7;background:#e0f2fe;border-radius:4px;padding:2px 7px}
      `}</style>

      <div className="hosp-root">
        <div className="top-bar">
          <div className="hospital-brand">
            <div className="cross-icon">
              <svg viewBox="0 0 24 24">
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
              {livenessBadge && (
                <span
                  className="liveness-badge"
                  style={{
                    color: livenessBadge.color,
                    background: livenessBadge.bg,
                  }}
                >
                  {livenessBadge.text}
                </span>
              )}
            </div>

            {/* Challenge banner with HTML progress dots mirroring canvas dots */}
            <div
              className={`challenge-banner ${challengeLabel ? "" : "hidden"}`}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>
                  {challenge === "blink"
                    ? "👁"
                    : challenge === "turn_left"
                      ? "←"
                      : "→"}
                </span>
                <span>{challengeLabel ?? "Liveness check"}</span>
              </div>
              <div className="challenge-dots">
                {Array.from({ length: challengeProgress.total }).map((_, i) => (
                  <div
                    key={i}
                    className="challenge-dot"
                    style={{
                      background:
                        i < challengeProgress.current
                          ? "#0ea5e9"
                          : i === challengeProgress.current
                            ? "#f59e0b"
                            : "#e2e8f0",
                    }}
                  />
                ))}
              </div>
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

          <div className="card-footer">
            <span className="footer-text">
              MediaPipe · face_recognition · liveness v2
            </span>
            <span className="footer-badge">v2.3</span>
          </div>
        </div>
      </div>
    </>
  );
}
