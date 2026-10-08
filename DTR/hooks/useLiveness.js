import { useRef, useState, useCallback, useEffect } from "react";

// ── Tunables ──────────────────────────────────────────────────────────────────
// Blink is detected RELATIVE to the person's own open-eye EAR (adaptive),
// with an absolute ceiling as a safety net.
const BLINK_RATIO = 0.75; // eye is "closed" when EAR < baseline * 0.75
const BLINK_ABS_MAX = 0.25; // ...or EAR below this absolute value
const BASELINE_WARMUP_FRAMES = 3; // frames needed before blink detection starts
const BLINK_CONSEC_FRAMES = 1; // phones often run 5-12 fps, so 1 is enough

const HEAD_TURN_THRESHOLD = 15;
const CHALLENGE_TIMEOUT_MS = 8000;
const CHALLENGES_REQUIRED = 2;
const MAX_FAILURES = 3;
const LOCKOUT_MS = 30_000;

// If turn_left / turn_right feel swapped on the device, change this to -1.
const YAW_SIGN = 1;

const ALL_CHALLENGES = ["blink", "turn_left", "turn_right"];

// Pick N unique challenges in random order (Fisher-Yates)
function pickChallenges(n) {
  const arr = [...ALL_CHALLENGES];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

/**
 * Eye Aspect Ratio in PIXEL space.
 * MediaPipe landmarks are normalized separately (x by width, y by height), so
 * on a portrait phone the raw values are distorted. Multiply by w/h first.
 */
function calcEAR(landmarks, indices, w, h) {
  const [p1, p2, p3, p4, p5, p6] = indices.map((i) => ({
    x: landmarks[i].x * w,
    y: landmarks[i].y * h,
  }));
  const vertical1 = Math.hypot(p2.x - p6.x, p2.y - p6.y);
  const vertical2 = Math.hypot(p3.x - p5.x, p3.y - p5.y);
  const horizontal = Math.hypot(p1.x - p4.x, p1.y - p4.y);
  if (horizontal === 0) return 0;
  return (vertical1 + vertical2) / (2.0 * horizontal);
}

// Yaw uses only x-distances (a ratio), so it is aspect-ratio safe.
// Positive = nose right of center in raw coords.
function calcYawDegrees(landmarks) {
  const noseTip = landmarks[1];
  const leftEar = landmarks[234];
  const rightEar = landmarks[454];
  const faceCenter = (leftEar.x + rightEar.x) / 2;
  const faceWidth = Math.abs(rightEar.x - leftEar.x);
  if (faceWidth === 0) return 0;
  const offset = (noseTip.x - faceCenter) / faceWidth;
  return offset * 90 * YAW_SIGN;
}

/**
 * useLiveness()
 *
 * processMeshResults(results, videoEl?)
 *   results  – legacy @mediapipe/face_mesh results object
 *   videoEl  – optional <video> element; used for width/height if
 *              results.image is not available (recommended to pass it)
 */
export function useLiveness({ challengesRequired = CHALLENGES_REQUIRED } = {}) {
  const required = challengesRequired;
  const [challenge, setChallenge] = useState(null);
  const [livenessOk, setLivenessOk] = useState(false);
  const [livenessRejected, setLivenessRejected] = useState(false);
  const [challengeProgress, setChallengeProgress] = useState({
    current: 0,
    total: required,
  });
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState(0);

  const blinkConsecRef = useRef(0);
  const baselineEarRef = useRef(null);
  const baselineCountRef = useRef(0);

  const timeoutRef = useRef(null);
  const advanceTimeoutRef = useRef(null);
  const lockoutTimerRef = useRef(null);
  const activeChallenge = useRef(null);
  const livenessOkRef = useRef(false);

  // Persist across resets — failure count and lockout expiry
  const failureCountRef = useRef(0);
  const lockedUntilRef = useRef(0);

  const queueRef = useRef([]);
  const completedRef = useRef(0);

  const isLockedOut = lockoutSecondsLeft > 0;

  // Clean up all timers on unmount
  useEffect(() => {
    return () => {
      clearTimeout(timeoutRef.current);
      clearTimeout(advanceTimeoutRef.current);
      clearInterval(lockoutTimerRef.current);
    };
  }, []);

  const clearLockoutTimer = useCallback(() => {
    if (lockoutTimerRef.current) {
      clearInterval(lockoutTimerRef.current);
      lockoutTimerRef.current = null;
    }
  }, []);

  const startLockoutCountdown = useCallback(() => {
    clearLockoutTimer();
    lockoutTimerRef.current = setInterval(() => {
      const remaining = Math.ceil((lockedUntilRef.current - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockoutSecondsLeft(0);
        clearLockoutTimer();
      } else {
        setLockoutSecondsLeft(remaining);
      }
    }, 500);
  }, [clearLockoutTimer]);

  const resetBlinkState = () => {
    blinkConsecRef.current = 0;
    baselineEarRef.current = null;
    baselineCountRef.current = 0;
  };

  const resetChallenge = useCallback(() => {
    clearTimeout(timeoutRef.current);
    clearTimeout(advanceTimeoutRef.current);
    setChallenge(null);
    setLivenessOk(false);
    livenessOkRef.current = false;
    setLivenessRejected(false);
    setChallengeProgress({ current: 0, total: required });
    resetBlinkState();
    activeChallenge.current = null;
    queueRef.current = [];
    completedRef.current = 0;
    // failureCountRef and lockedUntilRef intentionally NOT reset so the
    // lockout survives the face leaving the frame.
  }, [required]);

  const advanceQueue = useCallback(() => {
    if (queueRef.current.length === 0) return;

    const next = queueRef.current.shift();
    activeChallenge.current = next;
    resetBlinkState();
    setChallenge(next);

    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      // Challenge timed out — count as failure
      failureCountRef.current += 1;
      activeChallenge.current = null;
      queueRef.current = [];
      setChallenge(null);
      setLivenessRejected(true);

      if (failureCountRef.current >= MAX_FAILURES) {
        lockedUntilRef.current = Date.now() + LOCKOUT_MS;
        setLockoutSecondsLeft(Math.ceil(LOCKOUT_MS / 1000));
        startLockoutCountdown();
        failureCountRef.current = 0;
      }
    }, CHALLENGE_TIMEOUT_MS);
  }, [startLockoutCountdown]);

  const startChallenge = useCallback(() => {
    if (activeChallenge.current || livenessOkRef.current) return;
    if (Date.now() < lockedUntilRef.current) return;

    clearTimeout(advanceTimeoutRef.current);
    queueRef.current = pickChallenges(required);
    completedRef.current = 0;
    setChallengeProgress({ current: 0, total: required });
    setLivenessOk(false);
    livenessOkRef.current = false;
    setLivenessRejected(false);

    advanceQueue();
  }, [advanceQueue, required]);

  const completeCurrentChallenge = useCallback(() => {
    clearTimeout(timeoutRef.current);
    completedRef.current += 1;
    setChallengeProgress({
      current: completedRef.current,
      total: required,
    });

    activeChallenge.current = null;
    setChallenge(null);

    if (queueRef.current.length > 0) {
      // More challenges remain — brief pause, then advance
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = setTimeout(() => advanceQueue(), 600);
    } else {
      failureCountRef.current = 0;
      livenessOkRef.current = true;
      setLivenessOk(true);
    }
  }, [advanceQueue, required]);

  const processMeshResults = useCallback(
    (results, videoEl) => {
      if (!activeChallenge.current) return;
      if (!results?.multiFaceLandmarks?.length) return;

      const landmarks = results.multiFaceLandmarks[0];
      const current = activeChallenge.current;

      if (current === "blink") {
        const w = results.image?.width || videoEl?.videoWidth || 640;
        const h = results.image?.height || videoEl?.videoHeight || 480;

        const leftEAR = calcEAR(landmarks, [33, 160, 158, 133, 153, 144], w, h);
        const rightEAR = calcEAR(
          landmarks,
          [362, 385, 387, 263, 373, 380],
          w,
          h,
        );
        const avgEAR = (leftEAR + rightEAR) / 2;

        // Warm-up: learn this person's open-eye EAR before judging blinks
        if (baselineCountRef.current < BASELINE_WARMUP_FRAMES) {
          baselineEarRef.current =
            baselineEarRef.current === null
              ? avgEAR
              : Math.max(baselineEarRef.current, avgEAR);
          baselineCountRef.current += 1;
          return;
        }

        const baseline = baselineEarRef.current;
        const closedThreshold = Math.min(baseline * BLINK_RATIO, BLINK_ABS_MAX);

        // Uncomment to debug on device via chrome://inspect
        // console.log("EAR", avgEAR.toFixed(3), "baseline", baseline.toFixed(3), "thr", closedThreshold.toFixed(3));

        if (avgEAR < closedThreshold) {
          blinkConsecRef.current++;
        } else {
          if (blinkConsecRef.current >= BLINK_CONSEC_FRAMES) {
            blinkConsecRef.current = 0;
            completeCurrentChallenge();
            return;
          }
          blinkConsecRef.current = 0;
          // Slowly track the open-eye baseline (only while eyes are open)
          baselineEarRef.current = baseline * 0.9 + avgEAR * 0.1;
        }
      } else if (current === "turn_left") {
        if (calcYawDegrees(landmarks) > HEAD_TURN_THRESHOLD) {
          completeCurrentChallenge();
        }
      } else if (current === "turn_right") {
        if (calcYawDegrees(landmarks) < -HEAD_TURN_THRESHOLD) {
          completeCurrentChallenge();
        }
      }
    },
    [completeCurrentChallenge],
  );

  const challengeLabel =
    {
      blink: "Please blink once",
      turn_left: "Turn your head LEFT",
      turn_right: "Turn your head RIGHT",
    }[challenge] ?? null;

  return {
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
  };
}
