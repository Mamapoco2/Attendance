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

# ── Tunables ──────────────────────────────────────────────────────────────────
REGISTER_MIN_IMAGES = 5
REGISTER_MAX_IMAGES = 10
RECOGNIZE_MIN_FRAMES = 3
RECOGNIZE_MAX_FRAMES = 5
TOLERANCE = 0.5

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

    return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)


def preprocess_image(image: np.ndarray) -> np.ndarray:
    """Downscale large images before detection for speed."""
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
    """Return the first face encoding found, or None. Uses HOG (fast, server-friendly)."""
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
    return hashlib.sha256(image_data.encode()).hexdigest()


def encode_image_cached(image_data: str):
    """Cache a single image's encoding by hash. Returns a list or None."""
    key = f"enc:{image_hash(image_data)}"
    cached = cache.get(key)

    if cached is not None:
        return cached if cached != "__no_face__" else None

    image = decode_image(image_data)
    encoding = get_face_encoding(image)

    if encoding is not None:
        cache.set(key, encoding.tolist())
        return encoding.tolist()
    else:
        cache.set(key, "__no_face__")
        return None


def encode_many(images: list[str]) -> list[list[float]]:
    """
    Encode a batch of images, skipping any frame where no face was found.
    Returns a list of encodings (as plain lists) — may be shorter than
    the input if some frames failed to detect a face.
    """
    encodings = []
    for i, img in enumerate(images):
        try:
            enc = encode_image_cached(img)
        except ValueError as e:
            log.warning("Skipping frame %d: %s", i, e)
            continue
        if enc is not None:
            encodings.append(enc)
    return encodings


# ── Routes ────────────────────────────────────────────────────────────────────
@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body must be JSON."}), 400

    name = (data.get("name") or "").strip()
    images = data.get("images")

    # Back-compat: allow a single 'image' too, but warn it's suboptimal
    if not images and data.get("image"):
        images = [data.get("image")]

    if not name:
        return jsonify({"error": "Field 'name' is required and cannot be blank."}), 422
    if not images or not isinstance(images, list):
        return jsonify({"error": "Field 'images' must be a non-empty list of data-URLs."}), 422
    if len(images) < REGISTER_MIN_IMAGES:
        return jsonify({
            "error": f"At least {REGISTER_MIN_IMAGES} images are required for reliable registration."
        }), 422
    if len(images) > REGISTER_MAX_IMAGES:
        images = images[:REGISTER_MAX_IMAGES]

    try:
        encodings = encode_many(images)
    except Exception:
        log.exception("Unexpected error during registration encoding")
        return jsonify({"error": "Internal error during image processing."}), 500

    if len(encodings) < 3:
        return jsonify({
            "error": f"Only {len(encodings)} usable face(s) found across {len(images)} images. "
                     "Please retake with better lighting/framing."
        }), 400

    # Store BOTH: the full set (for majority-vote style recognition) and the
    # average (cheap single-vector fallback / display purposes).
    avg_encoding = np.mean(np.array(encodings), axis=0).tolist()

    log.info("Registered face for '%s' using %d/%d usable frames", name, len(encodings), len(images))
    return jsonify({
        "success": True,
        "name": name,
        "encodings": encodings,       # list of encodings, one per good frame
        "encoding": avg_encoding,     # averaged encoding (convenience)
        "frames_used": len(encodings),
        "frames_submitted": len(images),
    })


@app.route("/recognize", methods=["POST"])
def recognize():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body must be JSON."}), 400

    images = data.get("images")
    if not images and data.get("image"):
        images = [data.get("image")]  # back-compat

    known_faces = data.get("known_faces", [])

    if not images or not isinstance(images, list):
        return jsonify({"error": "Field 'images' must be a non-empty list of data-URLs."}), 422
    if len(images) > RECOGNIZE_MAX_FRAMES:
        images = images[:RECOGNIZE_MAX_FRAMES]
    if not isinstance(known_faces, list) or not known_faces:
        return jsonify({"error": "Field 'known_faces' must be a non-empty list."}), 422

    # Each known face may have 'encoding' (single vector) or 'encodings' (list).
    # Normalize to: [{ "name": ..., "encodings": np.ndarray of shape (k, 128) }, ...]
    normalized_known = []
    for i, face in enumerate(known_faces):
        name = face.get("name")
        encs = face.get("encodings") or (
            [face["encoding"]] if isinstance(face.get("encoding"), list) else None
        )
        if not name or not encs:
            return jsonify(
                {"error": f"known_faces[{i}] is missing 'name' or 'encoding(s)'."}
            ), 422
        normalized_known.append({"name": name, "encodings": np.array(encs)})

    try:
        frame_encodings = encode_many(images)
    except Exception:
        log.exception("Unexpected error during recognition encoding")
        return jsonify({"error": "Internal error during image processing."}), 500

    if not frame_encodings:
        return jsonify({"error": "No face detected in any of the provided frames."}), 400

    # ── Strategy: best-distance across all frames, with majority-vote tiebreak ──
    # For each frame, find its single best match (name + distance) among known faces.
    frame_votes = []  # list of (name, best_distance) per frame
    for frame_enc in frame_encodings:
        frame_enc_np = np.array(frame_enc)
        best_name, best_dist = None, float("inf")
        for known in normalized_known:
            dists = face_recognition.face_distance(known["encodings"], frame_enc_np)
            min_dist = float(np.min(dists))
            if min_dist < best_dist:
                best_dist = min_dist
                best_name = known["name"]
        frame_votes.append((best_name, best_dist))

    # Majority vote among frames that passed tolerance
    passing_votes = [(n, d) for n, d in frame_votes if d <= TOLERANCE]

    if not passing_votes:
        best_overall = min(frame_votes, key=lambda v: v[1])
        log.info("No match found (best distance=%.4f across %d frames)", best_overall[1], len(frame_votes))
        return jsonify({"match": False, "best_distance": round(best_overall[1], 4)})

    # Count votes per name; break ties by lowest average distance
    from collections import defaultdict
    tally = defaultdict(list)
    for n, d in passing_votes:
        tally[n].append(d)

    matched_name = max(
        tally.items(),
        key=lambda item: (len(item[1]), -sum(item[1]) / len(item[1]))
    )[0]
    avg_dist = sum(tally[matched_name]) / len(tally[matched_name])
    votes = len(tally[matched_name])

    log.info(
        "Recognized '%s' with %d/%d frame votes (avg distance=%.4f)",
        matched_name, votes, len(frame_votes), avg_dist
    )
    return jsonify({
        "match": True,
        "name": matched_name,
        "confidence": round(1 - avg_dist, 4),
        "votes": votes,
        "frames_used": len(frame_votes),
    })


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


if __name__ == "__main__":
    app.run(port=5001, threaded=True, debug=False)