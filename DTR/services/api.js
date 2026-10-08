import { Capacitor } from "@capacitor/core";

// ── Base URLs (chosen at runtime) ────────────────────────────────────────────
// Web: relative paths, handled by the Vite proxy (same origin, no CORS,
//      no mixed content).
// Android app: full address of the PC running Laravel / Flask.
const isNative = Capacitor.isNativePlatform();

// Main DTR backend (Laravel, routes under /api)
export const BASE_URL = isNative
  ? import.meta.env.VITE_NATIVE_API_URL
  : (import.meta.env.VITE_API_BASE_URL ?? "/api");

// Face engine (Flask, port 5001, routes like /recognize and /register)
export const FACE_URL = isNative
  ? import.meta.env.VITE_NATIVE_FACE_URL
  : "/face";

export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

/**
 * JSON request helper.
 *
 * options.baseUrl  – override the base URL (use FACE_URL for the face engine)
 * all other options are passed straight to fetch()
 */
export async function api(endpoint, options = {}) {
  const { baseUrl = BASE_URL, ...fetchOptions } = options;

  const headers = {
    Accept: "application/json",
    ...(fetchOptions.body ? { "Content-Type": "application/json" } : {}),
    ...fetchOptions.headers,
  };

  const url = `${baseUrl}${endpoint}`;

  let response;
  try {
    response = await fetch(url, { ...fetchOptions, headers });
  } catch (err) {
    console.error("Network error calling", url, err);
    throw new ApiError(
      "Cannot reach the server. Check your network connection.",
      0,
    );
  }

  // Read as text first so a non-JSON reply (e.g. an HTML page from a wrong
  // URL) gives a clear error instead of "Unexpected token '<'".
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    console.error(
      "Non-JSON response from",
      response.url,
      response.status,
      text.slice(0, 120),
    );
    throw new ApiError(
      `Server returned an unexpected response (${response.status}). Check the API URL.`,
      response.status,
    );
  }

  if (!response.ok) {
    // Flask face engine uses { error }, other backends often use { message }
    throw new ApiError(
      data?.message || data?.error || `Request failed (${response.status})`,
      response.status,
      data,
    );
  }

  return data;
}

/** Blob request helper (file downloads, images, etc.) */
export async function apiBlob(endpoint, options = {}) {
  const { baseUrl = BASE_URL, ...fetchOptions } = options;
  const url = `${baseUrl}${endpoint}`;

  let response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (err) {
    console.error("Network error calling", url, err);
    throw new ApiError(
      "Cannot reach the server. Check your network connection.",
      0,
    );
  }

  if (!response.ok) {
    throw new ApiError(`Request failed (${response.status})`, response.status);
  }

  return response.blob();
}

// ── Face engine shortcuts ────────────────────────────────────────────────────
export const recognizeFace = (images, known_faces) =>
  api("/recognize", {
    baseUrl: FACE_URL,
    method: "POST",
    body: JSON.stringify({ images, known_faces }),
  });

export const registerFace = (name, images) =>
  api("/register", {
    baseUrl: FACE_URL,
    method: "POST",
    body: JSON.stringify({ name, images }),
  });
