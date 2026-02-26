import { useEffect, useRef, useState } from "react";
import { FaceDetection } from "@mediapipe/face_detection";
import { Camera } from "@mediapipe/camera_utils";
import { recognizeFace } from "../../services/faceService";
import { recordAttendance } from "../../services/attendanceService";

export default function TimeIn() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [status, setStatus] = useState("Initializing...");
  const [faceDetected, setFaceDetected] = useState(false);

  /* ================= FACE DETECTION ================= */
  useEffect(() => {
    const faceDetection = new FaceDetection({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
    });

    faceDetection.setOptions({
      model: "short",
      minDetectionConfidence: 0.6,
    });

    faceDetection.onResults((results) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (results.detections.length > 0) {
        setFaceDetected(true);

        const bbox = results.detections[0].boundingBox;

        const x = (bbox.xCenter - bbox.width / 2) * canvas.width;
        const y = (bbox.yCenter - bbox.height / 2) * canvas.height;
        const width = bbox.width * canvas.width;
        const height = bbox.height * canvas.height;

        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 4;
        ctx.strokeRect(x, y, width, height);
      } else {
        setFaceDetected(false);
      }
    });

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        await faceDetection.send({ image: videoRef.current });
      },
      width: 640,
      height: 480,
    });

    camera.start();
  }, []);

  /* ================= CAPTURE IMAGE ================= */
  const captureImage = () => {
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0);

    return canvas.toDataURL("image/jpeg");
  };

  /* ================= RECOGNIZE ================= */
  const handleRecognize = async () => {
    if (!faceDetected) {
      setStatus("No face detected ❌");
      return;
    }

    try {
      setStatus("Recognizing...");

      const image = captureImage();
      const result = await recognizeFace(image);

      if (result.match) {
        const attendance = await recordAttendance(result.name);
        setStatus(attendance.message);
      } else {
        setStatus("Unknown Face ❌");
      }
    } catch (error) {
      console.error(error);
      setStatus("Recognition failed ❌");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-2xl font-bold mb-4">Time In / Time Out</h1>

      <p className="mb-4 text-gray-600">{status}</p>

      <div className="relative">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="rounded-xl border"
        />
        <canvas ref={canvasRef} className="absolute top-0 left-0" />
      </div>

      <button
        onClick={handleRecognize}
        className="px-6 py-3 bg-blue-600 text-white rounded-xl mt-4"
      >
        Scan Face
      </button>
    </div>
  );
}
