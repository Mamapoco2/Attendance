// Sound helper — plays your mp3 files, with a generated beep as a fallback.
// Works on the web and inside the Android (Capacitor) app.
//
// Put your mp3 in:  public/sounds/success.mp3
// (optional) separate Time Out sound: public/sounds/timeout.mp3
// Files in /public are served from the site root, so the URL is "/sounds/...".

const TIME_IN_SRC = "/sounds/vibrant-alerts.mp3";
const TIME_OUT_SRC = "/sounds/vibrant-alerts.mp3"; // change to "/sounds/timeout.mp3" for a different sound

const cache = {};

function getAudio(src) {
  if (!cache[src]) {
    const a = new Audio(src);
    a.preload = "auto";
    cache[src] = a;
  }
  return cache[src];
}

// ── Generated fallback tones (used if the mp3 is missing or blocked) ─────────
let ctx = null;

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

function tone(freq, start, duration, type = "sine", volume = 0.25) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  const t = c.currentTime + start;

  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

function fallbackChime() {
  tone(660, 0, 0.18);
  tone(880, 0.16, 0.3);
}

// ── Public API ───────────────────────────────────────────────────────────────

// Call this at the START of a click handler. Browsers only allow sound that was
// "unlocked" by a tap; this primes the mp3 files and the beep engine so they
// can play later, after the network request finishes.
export function unlockAudio() {
  const c = getCtx();
  if (c && c.state === "suspended") c.resume();

  [TIME_IN_SRC, TIME_OUT_SRC].forEach((src) => {
    const a = getAudio(src);
    a.muted = true;
    a.play()
      .then(() => {
        a.pause();
        a.currentTime = 0;
        a.muted = false;
      })
      .catch(() => {
        a.muted = false;
      });
  });
}

function playFile(src) {
  const a = getAudio(src);
  a.muted = false;
  a.currentTime = 0;
  a.play().catch((err) => {
    console.warn("mp3 playback failed, using beep:", err);
    fallbackChime();
  });
}

export function playTimeIn() {
  playFile(TIME_IN_SRC);
}

export function playTimeOut() {
  playFile(TIME_OUT_SRC);
}

// Failure: single low buzz
export function playError() {
  tone(220, 0, 0.35, "square", 0.15);
}

// Pick the right success sound from the attendance type
export function playSuccess(type) {
  if (type === "TIME_OUT") playTimeOut();
  else playTimeIn();
}
