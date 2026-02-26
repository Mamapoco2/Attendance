import { Routes, Route, Link } from "react-router-dom";
import FaceRegister from "./pages/register";
import FaceRecognize from "./pages/timeIn";

export default function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* NAVBAR */}
      <nav className="bg-white shadow p-4 flex gap-6 justify-center">
        <Link
          to="/register"
          className="text-blue-600 hover:underline font-medium"
        >
          Register
        </Link>

        <Link
          to="/recognize"
          className="text-blue-600 hover:underline font-medium"
        >
          Recognize
        </Link>
      </nav>

      {/* ROUTES */}
      <Routes>
        <Route path="/register" element={<FaceRegister />} />
        <Route path="/recognize" element={<FaceRecognize />} />

        {/* Default route */}
        <Route path="*" element={<FaceRecognize />} />
      </Routes>
    </div>
  );
}
