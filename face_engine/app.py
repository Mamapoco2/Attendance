from flask import Flask, request, jsonify
from flask_caching import Cache
import face_recognition
import numpy as np
import base64
import cv2
import logging
import hashlib

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

# ── App & cache setup ─────────────────────────────────────────────────────────
app = Flask(__name__)
app.config["CACHE_TYPE"] = "SimpleCache"
app.config["CACHE_DEFAULT_TIMEOUT"] = 300
cache = Cache(app)

# ── Image decoding ────────────────────────────────────────────────────────────
def decode_image(image_data: str) -> np.ndarray:
    """Decode a base64 data-URL into an RGB numpy array."""
    try:
        _, b64 = image_data.split(",", 1)
    except ValueError:
        raise ValueError("Invalid image_data format — expected a data-URL with a comma separator.")

    image_bytes = base64.b64decode(b64)
    np_arr = np.frombuffer(image_bytes, np.uint8)
    bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    if bgr is None:
        raise ValueError("cv2 could not decode the image bytes.")

    # face_recognition expects RGB, not BGR
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)


def preprocess_image(image: np.ndarray) -> np.ndarray:
    """
    Downscale large images before detection — face_recognition only needs
    enough resolution to find a face, and smaller images are much faster.
    """
    h, w = image.shape[:2]
    max_dim = 640

    if max(h, w) > max_dim:
        scale = max_dim / max(h, w)
        image = cv2.resize(
            image,
            (int(w * scale), int(h * scale)),
            interpolation=cv2.INTER_AREA,
        )

    return image


# ── Encoding helpers ──────────────────────────────────────────────────────────
def get_face_encoding(image: np.ndarray) -> np.ndarray | None:
    """
    Return the first face encoding found, or None.
    Uses HOG model (fast, server-friendly).
    """
    small = preprocess_image(image)
    locations = face_recognition.face_locations(
        small, number_of_times_to_upsample=1, model="hog"
    )

    if not locations:
        return None

    encodings = face_recognition.face_encodings(
        small, known_face_locations=locations, num_jitters=1
    )
    return encodings[0] if encodings else None


def image_hash(image_data: str) -> str:
    """SHA-256 of the raw data-URL string — used as a cache key."""
    return hashlib.sha256(image_data.encode()).hexdigest()


def encode_image_cached(image_data: str):
    """
    Cache face encodings by image hash so the same frame is never
    re-encoded. Uses flask_caching (SimpleCache in dev, swap for
    RedisCache in production for multi-worker setups).

    FIX vs original: the old lru_cache approach keyed on BOTH the hash
    string AND the full base64 image_data string, doubling memory usage.
    This version keys only on the compact SHA-256 hash.
    """
    key = f"enc:{image_hash(image_data)}"
    cached = cache.get(key)

    if cached is not None:
        # None stored as a sentinel means "no face found"
        return cached if cached != "__no_face__" else None

    image = decode_image(image_data)
    encoding = get_face_encoding(image)

    if encoding is not None:
        cache.set(key, encoding.tolist())
        return encoding.tolist()
    else:
        cache.set(key, "__no_face__")
        return None


# ── Routes ────────────────────────────────────────────────────────────────────
@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body must be JSON."}), 400

    name = (data.get("name") or "").strip()
    image_data = data.get("image", "")

    if not name:
        return jsonify({"error": "Field 'name' is required and cannot be blank."}), 422
    if not image_data:
        return jsonify({"error": "Field 'image' is required."}), 422

    try:
        encoding = encode_image_cached(image_data)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception:
        log.exception("Unexpected error during registration encoding")
        return jsonify({"error": "Internal error during image processing."}), 500

    if encoding is None:
        return jsonify({"error": "No face detected in the provided image."}), 400

    log.info("Registered face for '%s'", name)
    return jsonify({"success": True, "name": name, "encoding": encoding})


@app.route("/recognize", methods=["POST"])
def recognize():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body must be JSON."}), 400

    image_data = data.get("image", "")
    known_faces = data.get("known_faces", [])

    if not image_data:
        return jsonify({"error": "Field 'image' is required."}), 422
    if not isinstance(known_faces, list) or not known_faces:
        return jsonify({"error": "Field 'known_faces' must be a non-empty list."}), 422

    # Validate known_faces structure up front
    for i, face in enumerate(known_faces):
        if not isinstance(face.get("encoding"), list) or not face.get("name"):
            return jsonify(
                {"error": f"known_faces[{i}] is missing 'name' or 'encoding'."}
            ), 422

    try:
        encoding = encode_image_cached(image_data)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception:
        log.exception("Unexpected error during recognition encoding")
        return jsonify({"error": "Internal error during image processing."}), 500

    if encoding is None:
        return jsonify({"error": "No face detected in the provided image."}), 400

    unknown_enc = np.array(encoding)

    # Vectorised batch comparison — avoids a Python loop entirely
    known_encs = np.array([face["encoding"] for face in known_faces])
    distances = face_recognition.face_distance(known_encs, unknown_enc)

    best_idx = int(np.argmin(distances))
    best_dist = float(distances[best_idx])

    TOLERANCE = 0.5
    if best_dist <= TOLERANCE:
        matched_name = known_faces[best_idx]["name"]
        log.info("Recognized '%s' (distance=%.4f)", matched_name, best_dist)
        return jsonify({
            "match": True,
            "name": matched_name,
            "confidence": round(1 - best_dist, 4),
        })

    log.info("No match found (best distance=%.4f)", best_dist)
    return jsonify({"match": False})


# ── Health check ──────────────────────────────────────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


# ── Error handlers ────────────────────────────────────────────────────────────
@app.errorhandler(404)
def not_found(_):
    return jsonify({"error": "Endpoint not found."}), 404

@app.errorhandler(405)
def method_not_allowed(_):
    return jsonify({"error": "Method not allowed."}), 405

@app.errorhandler(500)
def internal_error(_):
    return jsonify({"error": "Internal server error."}), 500


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    # Use threaded=True so multiple camera frames can be processed concurrently.
    # In production: gunicorn -w 2 -k gthread --threads 4 app:app
    app.run(port=5001, threaded=True, debug=False)