import { useRef, useState, useCallback } from "react";

const BLINK_THRESHOLD = 0.22;
const BLINK_CONSEC_FRAMES = 2;
const HEAD_TURN_THRESHOLD = 15;
const CHALLENGE_TIMEOUT_MS = 8000;
const CHALLENGES_REQUIRED = 2; // ← require 2 challenges
const MAX_FAILURES = 3; // ← lockout after 3 failed attempts
const LOCKOUT_MS = 30_000; // ← 30 second lockout

const ALL_CHALLENGES = ["blink", "turn_left", "turn_right"];

// Pick N unique challenges in random order
function pickChallenges(n) {
  const shuffled = [...ALL_CHALLENGES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function calcEAR(landmarks, indices) {
  const [p1, p2, p3, p4, p5, p6] = indices.map((i) => landmarks[i]);
  const vertical1 = Math.hypot(p2.x - p6.x, p2.y - p6.y);
  const vertical2 = Math.hypot(p3.x - p5.x, p3.y - p5.y);
  const horizontal = Math.hypot(p1.x - p4.x, p1.y - p4.y);
  return (vertical1 + vertical2) / (2.0 * horizontal);
}

// Positive yaw = nose right of center in raw coords
// Due to mirror: positive = user turned LEFT, negative = user turned RIGHT
function calcYawDegrees(landmarks) {
  const noseTip = landmarks[1];
  const leftEar = landmarks[234];
  const rightEar = landmarks[454];
  const faceCenter = (leftEar.x + rightEar.x) / 2;
  const faceWidth = Math.abs(rightEar.x - leftEar.x);
  if (faceWidth === 0) return 0;
  const offset = (noseTip.x - faceCenter) / faceWidth;
  return offset * 90;
}

/**
 * useLiveness()
 *
 * Returns:
 *   challenge          – current challenge string or null
 *   challengeLabel     – human-readable instruction
 *   challengeProgress  – { current: number, total: number }
 *   livenessOk         – true once ALL challenges are passed
 *   livenessRejected   – true if any challenge timed out
 *   isLockedOut        – true if too many failures
 *   lockoutSecondsLeft – countdown for lockout display
 *   startChallenge()
 *   resetChallenge()
 *   processMeshResults(results)
 */
export function useLiveness() {
  const [challenge, setChallenge] = useState(null);
  const [livenessOk, setLivenessOk] = useState(false);
  const [livenessRejected, setLivenessRejected] = useState(false);
  const [challengeProgress, setChallengeProgress] = useState({
    current: 0,
    total: CHALLENGES_REQUIRED,
  });
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState(0);

  const blinkConsecRef = useRef(0);
  const timeoutRef = useRef(null);
  const lockoutTimerRef = useRef(null);
  const activeChallenge = useRef(null);

  // Persists across resets — tracks failure count and lockout expiry
  const failureCountRef = useRef(0);
  const lockedUntilRef = useRef(0);

  // Queue of challenges still to complete this session
  const queueRef = useRef([]);
  const completedRef = useRef(0);

  const isLockedOut = lockoutSecondsLeft > 0;

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

  const resetChallenge = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setChallenge(null);
    setLivenessOk(false);
    setLivenessRejected(false);
    setChallengeProgress({ current: 0, total: CHALLENGES_REQUIRED });
    blinkConsecRef.current = 0;
    activeChallenge.current = null;
    queueRef.current = [];
    completedRef.current = 0;
    // Note: failureCountRef and lockedUntilRef intentionally NOT reset here
    // so lockout survives face leaving the frame
  }, [clearLockoutTimer]);

  const advanceQueue = useCallback(() => {
    if (queueRef.current.length === 0) return;

    const next = queueRef.current.shift();
    activeChallenge.current = next;
    blinkConsecRef.current = 0;
    setChallenge(next);

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
        failureCountRef.current = 0; // reset after lockout starts
      }
    }, CHALLENGE_TIMEOUT_MS);
  }, [startLockoutCountdown]);

  const startChallenge = useCallback(() => {
    if (activeChallenge.current || livenessOk) return;

    // Check lockout
    if (Date.now() < lockedUntilRef.current) return;

    const queue = pickChallenges(CHALLENGES_REQUIRED);
    queueRef.current = queue;
    completedRef.current = 0;
    setChallengeProgress({ current: 0, total: CHALLENGES_REQUIRED });
    setLivenessOk(false);
    setLivenessRejected(false);

    advanceQueue();
  }, [livenessOk, advanceQueue]);

  const completeCurrentChallenge = useCallback(() => {
    clearTimeout(timeoutRef.current);
    completedRef.current += 1;
    const completed = completedRef.current;

    setChallengeProgress({ current: completed, total: CHALLENGES_REQUIRED });

    if (queueRef.current.length > 0) {
      // More challenges remain — brief pause then advance
      activeChallenge.current = null;
      setChallenge(null);
      setTimeout(() => advanceQueue(), 600);
    } else {
      // All done!
      activeChallenge.current = null;
      failureCountRef.current = 0; // reset on full success
      setChallenge(null);
      setLivenessOk(true);
    }
  }, [advanceQueue]);

  const processMeshResults = useCallback(
    (results) => {
      if (!activeChallenge.current) return;
      if (!results.multiFaceLandmarks?.length) return;

      const landmarks = results.multiFaceLandmarks[0];
      const current = activeChallenge.current;

      if (current === "blink") {
        const leftEAR = calcEAR(landmarks, [33, 160, 158, 133, 153, 144]);
        const rightEAR = calcEAR(landmarks, [362, 385, 387, 263, 373, 380]);
        const avgEAR = (leftEAR + rightEAR) / 2;

        if (avgEAR < BLINK_THRESHOLD) {
          blinkConsecRef.current++;
        } else {
          if (blinkConsecRef.current >= BLINK_CONSEC_FRAMES) {
            completeCurrentChallenge();
          }
          blinkConsecRef.current = 0;
        }
      } else if (current === "turn_left") {
        const yaw = calcYawDegrees(landmarks);
        if (yaw > HEAD_TURN_THRESHOLD) completeCurrentChallenge();
      } else if (current === "turn_right") {
        const yaw = calcYawDegrees(landmarks);
        if (yaw < -HEAD_TURN_THRESHOLD) completeCurrentChallenge();
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
