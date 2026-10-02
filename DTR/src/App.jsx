import { Routes, Route, Link, useLocation } from "react-router-dom";
import FaceRegister from "./pages/register";
import FaceRecognize from "./pages/timeIn";
import EmployeeDtr from "./pages/employeeDtr";

const NAV = [
  {
    to: "/recognize",
    label: "Time In / Out",
    hint: "Face scan",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  },
  {
    to: "/register",
    label: "Register Staff",
    hint: "Enroll a face",
    icon: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M19 8v6M22 11h-6" />
      </>
    ),
  },
  {
    to: "/employee-dtr",
    label: "DTR Form",
    hint: "CS Form No. 48",
    icon: (
      <>
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </>
    ),
  },
];

export default function App() {
  const { pathname } = useLocation();
  const isActive = (to) =>
    pathname === to ||
    (to === "/recognize" && !NAV.some((n) => n.to === pathname));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link to="/" className="side-brand">
          <div className="side-cross">
            <svg viewBox="0 0 24 24">
              <path d="M19 8h-4V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v4H5a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h4v4a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-4h4a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1z" />
            </svg>
          </div>
          <div>
            <div className="side-name">
              Rosario Maclang Bautista General Hospital
            </div>
            <div className="side-sub">STAFF ATTENDANCE PORTAL</div>
          </div>
        </Link>

        <nav className="side-nav">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={`side-link ${isActive(n.to) ? "active" : ""}`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {n.icon}
              </svg>
              <div>
                <div className="side-label">{n.label}</div>
                <div className="side-hint">{n.hint}</div>
              </div>
            </Link>
          ))}
        </nav>

        <div className="side-foot">
          <svg
            viewBox="0 0 200 28"
            fill="none"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M0 16h60l6-12 8 24 7-18 4 6h115" />
          </svg>
        </div>
      </aside>

      <main className="app-main">
        <Routes>
          <Route path="/register" element={<FaceRegister />} />
          <Route path="/recognize" element={<FaceRecognize />} />
          <Route path="/employee-dtr" element={<EmployeeDtr />} />
          <Route path="*" element={<FaceRecognize />} />
        </Routes>
      </main>
    </div>
  );
}
