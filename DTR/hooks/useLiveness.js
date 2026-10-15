import { useRef, useState, useCallback, useEffect } from "react";

const BLINK_RATIO = 0.75;
const BLINK_ABS_MAX = 0.25;
const BASELINE_WARMUP_FRAMES = 3; 
const BLINK_CONSEC_FRAMES = 1; 

const CHALLENGE_TIMEOUT_MS = 8000;
const MAX_FAILURES = 3;
const LOCKOUT_MS = 30_000;

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

export function useLiveness() {
  const [challenge, setChallenge] = useState(null);
  const [livenessOk, setLivenessOk] = useState(false);
  const [livenessRejected, setLivenessRejected] = useState(false);
  const [challengeProgress, setChallengeProgress] = useState({
    current: 0,
    total: 1,
  });
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState(0);

  const blinkConsecRef = useRef(0);
  const baselineEarRef = useRef(null);
  const baselineCountRef = useRef(0);

  const timeoutRef = useRef(null);
  const lockoutTimerRef = useRef(null);
  const activeChallenge = useRef(null);
  const livenessOkRef = useRef(false);

  const failureCountRef = useRef(0);
  const lockedUntilRef = useRef(0);

  const isLockedOut = lockoutSecondsLeft > 0;

  useEffect(() => {
    return () => {
      clearTimeout(timeoutRef.current);
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
    setChallenge(null);
    setLivenessOk(false);
    livenessOkRef.current = false;
    setLivenessRejected(false);
    setChallengeProgress({ current: 0, total: 1 });
    resetBlinkState();
    activeChallenge.current = null;
  }, []);

  const startChallenge = useCallback(() => {
    if (activeChallenge.current || livenessOkRef.current) return;
    if (Date.now() < lockedUntilRef.current) return;

    setChallengeProgress({ current: 0, total: 1 });
    setLivenessOk(false);
    livenessOkRef.current = false;
    setLivenessRejected(false);

    activeChallenge.current = "blink";
    resetBlinkState();
    setChallenge("blink");

    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      // Challenge timed out — count as failure
      failureCountRef.current += 1;
      activeChallenge.current = null;
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

  const completeChallenge = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setChallengeProgress({ current: 1, total: 1 });

    activeChallenge.current = null;
    setChallenge(null);

    failureCountRef.current = 0;
    livenessOkRef.current = true;
    setLivenessOk(true);
  }, []);

  const processMeshResults = useCallback(
    (results, videoEl) => {
      if (activeChallenge.current !== "blink") return;
      if (!results?.multiFaceLandmarks?.length) return;

      const landmarks = results.multiFaceLandmarks[0];

      const w = results.image?.width || videoEl?.videoWidth || 640;
      const h = results.image?.height || videoEl?.videoHeight || 480;

      const leftEAR = calcEAR(landmarks, [33, 160, 158, 133, 153, 144], w, h);
      const rightEAR = calcEAR(landmarks, [362, 385, 387, 263, 373, 380], w, h);
      const avgEAR = (leftEAR + rightEAR) / 2;

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

      if (avgEAR < closedThreshold) {
        blinkConsecRef.current++;
      } else {
        if (blinkConsecRef.current >= BLINK_CONSEC_FRAMES) {
          blinkConsecRef.current = 0;
          completeChallenge();
          return;
        }
        blinkConsecRef.current = 0;
        baselineEarRef.current = baseline * 0.9 + avgEAR * 0.1;
      }
    },
    [completeChallenge],
  );

  const challengeLabel = challenge === "blink" ? "Please blink once" : null;

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