import { useEffect, useRef, useState, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { FaceDetection } from "@mediapipe/face_detection";
import { FaceMesh } from "@mediapipe/face_mesh";
import { recognizeFace } from "../../services/faceService";
import { recordAttendance } from "../../services/attendanceService";
import { useLiveness } from "../../hooks/useLiveness";
import AlertDialog from "../components/AlertDialog";
import { CAMERA_RESPONSIVE_CSS } from "./cameraResponsive";
import { unlockAudio, playSuccess, playError } from "../../services/sounds";
import { hapticTick, hapticSuccess, hapticError } from "../../services/haptics";

// ── Per-platform settings ────────────────────────────────────────────────────
// WEB values are exactly what you had before (web behaviour is unchanged).
// NATIVE values are tuned for speed in the Android app only.
const IS_NATIVE = Capacitor.isNativePlatform();

const WEB_CFG = {
  cameraW: 1280,
  cameraH: 720,
  fps: 30,
  jpegQuality: 0.95,
  frames: 3, // frames sent to /recognize
  frameDelayMs: 150, // gap between those frames
  minFrameMs: 0, // 0 = no throttle on the MediaPipe loop
  challenges: 2, // liveness challenges required
};

const NATIVE_CFG = {
  cameraW: 640, // matches the 640px the server downsizes to anyway
  cameraH: 480,
  fps: 30,
  jpegQuality: 0.85,
  frames: 3,
  frameDelayMs: 60,
  minFrameMs: 50, // ~20 fps cap so slow phones don't queue frames
  challenges: 1, // set to 2 for stricter liveness (slower)
};

const CFG = IS_NATIVE ? NATIVE_CFG : WEB_CFG;

export default function TimeIn() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const recognizedNameRef = useRef(null);
  const recognizedTicketRef = useRef(null);
  const faceStableCounter = useRef(0);
  const faceVisibleRef = useRef(false);

  const recognitionFiredRef = useRef(false);
  const recognitionInFlightRef = useRef(false);

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
  const [punchResult, setPunchResult] = useState(null);
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
  } = useLiveness({ challengesRequired: CFG.challenges });

  useEffect(() => {
    livenessStateRef.current.ok = livenessOk;
    livenessStateRef.current.rejected = livenessRejected;
    livenessStateRef.current.challenge = challenge;
    livenessStateRef.current.isLockedOut = isLockedOut;
  }, [livenessOk, livenessRejected, challenge, isLockedOut]);

  useEffect(() => {
    const tick = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

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

  useEffect(() => {
    async function warmCache() {
      try {
        const { getKnownFaces } = await import("../../services/faceService");
        knownFacesCacheRef.current = await getKnownFaces();
      } catch (e) {
        console.warn("Could not pre-fetch known faces:", e);
      }
    }
    warmCache();
  }, []);

  // ── Capture a frame as JPEG (camera resolution) ────────────────────────────
  const captureImage = () => {
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", CFG.jpegQuality);
  };

  // Capture N frames a few ms apart for accurate multi-frame recognition.
  // Backend requires an ARRAY of 3–5 images (see Laravel: min:3|max:5).
  const captureFrames = useCallback(
    async (count = CFG.frames, delayMs = CFG.frameDelayMs) => {
      const frames = [];
      for (let i = 0; i < count; i++) {
        frames.push(captureImage());
        if (i < count - 1) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
      return frames;
    },
    [],
  );

  // Recognition: fires once per face appearance after liveness passes
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

      const images = await captureFrames();
      const result = await recognizeFace(images);

      if (result.match) {
        recognizedNameRef.current = result.name;
        recognizedTicketRef.current = result.ticket;
        setRecognizedName(result.name);
        hapticTick();
        setStatus("Identity verified");
        setStatusType("success");
      } else {
        recognizedNameRef.current = null;
        setRecognizedName(null);
        setStatus("Face not recognized");
        setStatusType("error");
        hapticError();
        setTimeout(() => {
          recognitionFiredRef.current = false;
        }, 3000);
      }
    } catch (err) {
      console.error("Recognition error:", err);
      setStatus("Recognition failed — please try again");
      setStatusType("error");
      hapticError();
      recognizedNameRef.current = null;
      recognitionFiredRef.current = false;
    } finally {
      recognitionInFlightRef.current = false;
    }
  }, [captureFrames]);

  // Watch for liveness becoming ok and trigger recognition immediately
  useEffect(() => {
    if (livenessOk) attemptRecognition();
  }, [livenessOk, attemptRecognition]);

  // ── Camera + MediaPipe setup ───────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let running = true;
    let stream = null;
    let rafId = null;
    let lastRun = 0;

    const faceDetection = new FaceDetection({
      locateFile: (f) => `/mediapipe/face_detection/${f}`,
    });
    faceDetection.setOptions({ model: "short", minDetectionConfidence: 0.4 });

    faceDetection.onResults((results) => {
      const canvas = canvasRef.current;
      if (!canvas || !video) return;

      const ctx = canvas.getContext("2d");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // On small screens the 1280px canvas is shown much smaller, which makes
      // brackets/labels tiny. Scale them up (never below 1 → desktop unchanged).
      const cssPerPx =
        Math.max(
          canvas.clientWidth / canvas.width,
          canvas.clientHeight / canvas.height,
        ) || 1;
      const uiScale = Math.min(3, Math.max(1, 1 / cssPerPx / 1.8));

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

        drawCornerBrackets(ctx, x, y, w, h, color, uiScale);
        drawScanLine(ctx, x, y, w, h, color);
        drawProgressDots(ctx, x, y, w, challengeProgress, uiScale);

        if (recognizedNameRef.current) {
          drawLabel(ctx, recognizedNameRef.current, x, y, w, h, color, uiScale);
        } else if (challengeLabel) {
          drawLabel(ctx, challengeLabel, x, y, w, h, "#f59e0b", uiScale);
        }

        ctx.shadowBlur = 0;
      } else {
        if (faceVisibleRef.current) {
          faceStableCounter.current = 0;
          faceVisibleRef.current = false;
          recognizedNameRef.current = null;
          recognizedTicketRef.current = null;
          recognitionFiredRef.current = false; // allow fresh recognition next time

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
      locateFile: (f) => `/mediapipe/face_mesh/${f}`,
    });
    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    // Pass the video so the blink detector always knows the frame width/height
    faceMesh.onResults((results) => processMeshResults(results, video));

    // Frame loop: one detection at a time, no overlapping sends.
    // CFG.minFrameMs is 0 on web (no throttle) and ~50ms in the Android app.
    async function loop() {
      if (!running) return;
      const now = performance.now();
      if (video.readyState >= 2 && now - lastRun >= CFG.minFrameMs) {
        lastRun = now;
        try {
          await faceDetection.send({ image: video });
          // Only run FaceMesh when a challenge is active
          if (livenessStateRef.current.challenge !== null) {
            await faceMesh.send({ image: video });
          }
        } catch (err) {
          console.error("MediaPipe frame error:", err);
        }
      }
      if (running) rafId = requestAnimationFrame(loop);
    }

    async function startCamera() {
      try {
        const constraints = {
          audio: false,
          video: {
            facingMode: { exact: "user" },
            width: { ideal: CFG.cameraW },
            height: { ideal: CFG.cameraH },
            frameRate: { ideal: CFG.fps },
          },
        };

        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (err) {
          // Device may not support exact facingMode (e.g. desktop webcams)
          if (
            err.name === "OverconstrainedError" ||
            err.name === "NotFoundError"
          ) {
            constraints.video.facingMode = "user";
            stream = await navigator.mediaDevices.getUserMedia(constraints);
          } else {
            throw err;
          }
        }

        if (!running) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        video.srcObject = stream;
        await video.play();

        const settings = stream.getVideoTracks()[0].getSettings();
        console.info("Camera settings:", settings);

        // Load BOTH MediaPipe models before scanning starts, so the blink
        // challenge never waits on a download.
        setStatus("Loading face detection…");
        setStatusType("scanning");
        try {
          await Promise.race([
            (async () => {
              await faceDetection.initialize();
              await faceMesh.initialize();
            })(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("timeout")), 30000),
            ),
          ]);
        } catch (err) {
          console.error("MediaPipe load error:", err);
          setStatus(
            "Face detection could not load — check the internet connection",
          );
          setStatusType("error");
          return;
        }
        if (!running) return;

        setStatus("Ready to scan");
        setStatusType("idle");
        loop();
      } catch (err) {
        console.error("Camera error:", err);
        setStatus("Camera unavailable — check permissions and connection");
        setStatusType("error");
      }
    }

    startCamera();

    // Cleanup: stop loop, release camera, free MediaPipe
    return () => {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
      faceDetection.close();
      faceMesh.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Canvas helpers ─────────────────────────────────────────────────────────
  function drawCornerBrackets(ctx, x, y, w, h, color, k = 1) {
    // Scale with the video so brackets stay proportional at 720p
    const cs = Math.max(16 * k, w * 0.12);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3 * k;
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

  // Challenge progress dots above the face box
  function drawProgressDots(ctx, x, y, w, progress, k = 1) {
    if (!progress || progress.total === 0) return;
    const dotR = 6 * k;
    const gap = 18 * k;
    const total = progress.total;
    const done = progress.current;
    const totalWidth = total * dotR * 2 + (total - 1) * gap;
    const startX = x + w / 2 - totalWidth / 2 + dotR;
    const dotY = y - 28 * k;

    ctx.shadowBlur = 0;
    for (let i = 0; i < total; i++) {
      const dotX = startX + i * (dotR * 2 + gap);
      ctx.beginPath();
      ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
      ctx.fillStyle = i < done ? "#0ea5e9" : i === done ? "#f59e0b" : "#475569";
      ctx.fill();
    }
  }

  function drawLabel(ctx, text, x, y, w, h, color, k = 1) {
    ctx.shadowBlur = 8;
    ctx.fillStyle = color;
    ctx.font = `bold ${Math.round(20 * k)}px 'DM Sans', sans-serif`;
    ctx.textAlign = "center";
    const textY = y > 48 * k ? y - 40 * k : y + h + 28 * k;
    const cx = x + w / 2;
    ctx.save();
    ctx.scale(-1, 1);
    ctx.fillText(text, -cx, textY);
    ctx.restore();
  }

  const handleAttendance = async () => {
    unlockAudio(); // keeps sound allowed after the awaits below
    if (!recognizedName) {
      setStatus("No face detected — please look at the camera");
      setStatusType("error");
      return;
    }
    try {
      setStatus("Recording attendance…");
      setStatusType("scanning");
      const image = captureImage();
      const attendance = await recordAttendance(
        recognizedTicketRef.current,
        image,
      );
      const recorded = ["TIME_IN", "TIME_OUT"].includes(attendance.type);

      setStatus(attendance.message || `${attendance.type} recorded`);
      setStatusType(recorded ? "success" : "error");
      setPunchResult({
        recorded,
        type: attendance.type,
        name: recognizedName,
        message: attendance.message,
      });

      if (recorded) {
        playSuccess(attendance.type);
        hapticSuccess();
      } else {
        playError();
        hapticError();
      }

      // The ticket is single-use, so the next punch needs a fresh scan.
      recognizedTicketRef.current = null;
      recognizedNameRef.current = null;
      recognitionFiredRef.current = false;
      setRecognizedName(null);
    } catch (err) {
      console.error("Attendance error:", err);
      setStatus(err?.message || "Failed to record attendance");
      setStatusType("error");
      playError();
      hapticError();
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
      <style>{CAMERA_RESPONSIVE_CSS}</style>
      <div className="hosp-root" style={{ "--cam-reserve": "320px" }}>
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

          <div className="card-body two-col">
            <div className="col-main">
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
                  {Array.from({ length: challengeProgress.total }).map(
                    (_, i) => (
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
                    ),
                  )}
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
            </div>
            <div className="col-side">
              <div className="section-label">Staff Identity</div>

              <div
                className={`identity-card ${recognizedName ? "visible" : ""}`}
              >
                <div className="avatar-ring">👤</div>
                <div>
                  {recognizedName ? (
                    <>
                      <div className="id-role">Verified Staff</div>
                      <div className="id-name">{recognizedName}</div>
                    </>
                  ) : (
                    <div className="id-placeholder">
                      Awaiting face detection…
                    </div>
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

          <div className="card-footer">
            <span className="footer-text">
              MediaPipe · face_recognition · liveness v2
            </span>
            <span className="footer-badge">v2.3</span>
          </div>
        </div>
      </div>

      <AlertDialog
        open={Boolean(punchResult)}
        tone={punchResult?.recorded ? "success" : "info"}
        title={
          punchResult?.type === "TIME_IN"
            ? "Time In recorded"
            : punchResult?.type === "TIME_OUT"
              ? "Time Out recorded"
              : "Attendance not recorded"
        }
        autoCloseMs={6000}
        onClose={() => setPunchResult(null)}
      >
        {punchResult?.recorded ? (
          <>
            <strong>{punchResult.name}</strong>
            <br />
            {punchResult.message}
          </>
        ) : (
          punchResult?.message
        )}
      </AlertDialog>
    </>
  );
}
