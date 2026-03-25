import { Routes, Route, Link, useLocation } from "react-router-dom";
import FaceRegister from "./pages/register";
import FaceRecognize from "./pages/timeIn";
import ViewDTR from "./pages/viewDTR";

export default function App() {
  const location = useLocation();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f1f5f9",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .navbar {
          background: white;
          border-bottom: 1px solid #e2e8f0;
          box-shadow: 0 1px 4px rgba(0,0,0,0.05);
          padding: 0 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 56px;
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .nav-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
        }

        .nav-cross {
          width: 30px;
          height: 30px;
          background: #0ea5e9;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 2px 6px rgba(14,165,233,0.35);
        }

        .nav-cross svg { width: 16px; height: 16px; fill: white; }

        .nav-brand-name {
          font-size: 15px;
          font-weight: 600;
          color: #0f172a;
          letter-spacing: -0.2px;
          line-height: 1.1;
        }

        .nav-brand-sub {
          font-size: 10px;
          color: #94a3b8;
          font-weight: 400;
        }

        .nav-links {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          text-decoration: none;
          color: #64748b;
          transition: background 0.18s, color 0.18s;
          border: 1px solid transparent;
        }

        .nav-link:hover {
          background: #f1f5f9;
          color: #0f172a;
        }

        .nav-link.active {
          background: #f0f9ff;
          color: #0284c7;
          border-color: #bae6fd;
        }

        .nav-link svg {
          width: 14px;
          height: 14px;
          flex-shrink: 0;
        }

        .nav-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .nav-badge {
          font-size: 10px;
          font-weight: 500;
          color: #0284c7;
          background: #e0f2fe;
          border-radius: 4px;
          padding: 3px 8px;
          font-family: 'DM Sans', sans-serif;
        }
      `}</style>

      <nav className="navbar">
        {/* Brand */}
        <Link to="/" className="nav-brand">
          <div className="nav-cross">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 8h-4V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v4H5a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h4v4a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-4h4a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1z" />
            </svg>
          </div>
          <div>
            <div className="nav-brand-name">
              Rosario Maclang Bautista General Hospital
            </div>
            <div className="nav-brand-sub">Staff Attendance Portal</div>
          </div>
        </Link>

        {/* Links */}
        <div className="nav-links">
          <Link
            to="/recognize"
            className={`nav-link ${location.pathname === "/recognize" || location.pathname === "/" ? "active" : ""}`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
              <path d="M8 12h.01M12 12h.01M16 12h.01" />
            </svg>
            Time In / Out
          </Link>

          <Link
            to="/register"
            className={`nav-link ${location.pathname === "/register" ? "active" : ""}`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
            Register Staff
          </Link>
        </div>

        {/* Right side */}
        <div className="nav-right">
          <span className="nav-badge">HIPAA Compliant</span>
        </div>
      </nav>

      <Routes>
        <Route path="/register" element={<FaceRegister />} />
        <Route path="/recognize" element={<FaceRecognize />} />
        <Route path="/dtr" element={<ViewDTR />} />
        <Route path="*" element={<FaceRecognize />} />
      </Routes>
    </div>
  );
}
