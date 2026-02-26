import { useEffect, useRef, useState } from "react";
import { FaceDetection } from "@mediapipe/face_detection";
import { Camera } from "@mediapipe/camera_utils";
import { recognizeFace } from "../../services/faceService";
import { recordAttendance } from "../../services/attendanceService";

export default function TimeIn() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const recognizedNameRef = useRef(null);
  const faceStableCounter = useRef(0);
  const processingRef = useRef(false);

  const [status, setStatus] = useState("Initializing...");
  const [recognizedName, setRecognizedName] = useState(null);

  /* ================= FACE DETECTION ================= */
  useEffect(() => {
    const faceDetection = new FaceDetection({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
    });

    faceDetection.setOptions({
      model: "short",
      minDetectionConfidence: 0.4, // faster
    });

    faceDetection.onResults((results) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const ctx = canvas.getContext("2d");

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (results.detections.length > 0) {
        faceStableCounter.current++;

        const bbox = results.detections[0].boundingBox;

        const x = (bbox.xCenter - bbox.width / 2) * canvas.width;
        const y = (bbox.yCenter - bbox.height / 2) * canvas.height;
        const width = bbox.width * canvas.width;
        const height = bbox.height * canvas.height;

        // Draw green box
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);

        // Draw name
        if (recognizedNameRef.current) {
          const textY = y > 30 ? y - 10 : y + height + 25;

          ctx.fillStyle = "#22c55e";
          ctx.font = "16px Arial";
          ctx.textAlign = "center";
          ctx.fillText(recognizedNameRef.current, x + width / 2, textY);
        }
      } else {
        faceStableCounter.current = 0;
        recognizedNameRef.current = null;
        setRecognizedName(null);
      }
    });

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        await faceDetection.send({ image: videoRef.current });
      },
      width: 320, // 🔥 lower resolution for speed
      height: 240,
    });

    camera.start();
  }, []);

  /* ================= AUTO RECOGNITION ================= */
  useEffect(() => {
    const interval = setInterval(async () => {
      if (
        faceStableCounter.current < 3 || // require stable face
        processingRef.current
      )
        return;

      try {
        processingRef.current = true;

        const image = captureImage();
        const result = await recognizeFace(image);

        if (result.match) {
          recognizedNameRef.current = result.name;
          setRecognizedName(result.name);
          setStatus(`Recognized: ${result.name} ✅`);
        } else {
          recognizedNameRef.current = null;
          setRecognizedName(null);
          setStatus("Unknown Face ❌");
        }
      } catch (error) {
        console.error(error);
      } finally {
        processingRef.current = false;
      }
    }, 1000); // 🔥 check every 1 second

    return () => clearInterval(interval);
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

  /* ================= CONFIRM ATTENDANCE ================= */
  const handleAttendance = async () => {
    if (!recognizedName) {
      setStatus("No recognized user ❌");
      return;
    }

    try {
      const attendance = await recordAttendance(recognizedName);

      setStatus(
        `${recognizedName} - ${attendance.type} at ${
          attendance.time_in || attendance.time_out
        } ✅`,
      );
    } catch (error) {
      console.error(error);
      setStatus("Attendance failed ❌");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-2xl font-bold mb-4">Smart Time In / Time Out</h1>

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
        onClick={handleAttendance}
        className="px-6 py-3 bg-blue-600 text-white rounded-xl mt-4"
      >
        Confirm Attendance
      </button>
    </div>
  );
}
