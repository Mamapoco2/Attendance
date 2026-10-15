import { useEffect, useState } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import FaceRegister from "./pages/register";
import FaceRecognize from "./pages/timeIn";

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
];

// Hamburger + slide-in drawer, phones only (under 768px). Desktop is untouched.
const MOBILE_CSS = `
.mobile-bar, .side-backdrop { display: none; }

/* 860px matches the breakpoint already used in hospital.css */
@media (max-width: 860px) {
  .app-shell { display: block !important; }

  .mobile-bar {
    display: flex; align-items: center; gap: 10px;
    position: sticky; top: 0; z-index: 40;
    padding: calc(8px + env(safe-area-inset-top, 0px)) 12px 8px;
    background: linear-gradient(135deg, #0c4a6e, #075985);
  }
  .mobile-title {
    font-size: 14px; font-weight: 700; color: #fff;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  .burger {
    flex: none; width: 44px; height: 44px; border: 0; border-radius: 10px;
    background: rgba(255, 255, 255, .12); cursor: pointer; position: relative;
  }
  .burger span {
    position: absolute; left: 11px; right: 11px; height: 2px;
    background: #fff; border-radius: 2px;
    transition: transform .2s, opacity .2s, top .2s;
  }
  .burger span:nth-child(1) { top: 14px; }
  .burger span:nth-child(2) { top: 21px; }
  .burger span:nth-child(3) { top: 28px; }
  .burger.open span:nth-child(1) { top: 21px; transform: rotate(45deg); }
  .burger.open span:nth-child(2) { opacity: 0; }
  .burger.open span:nth-child(3) { top: 21px; transform: rotate(-45deg); }

  /* Drawer */
  .app-shell .sidebar {
    position: fixed !important; top: 0; bottom: 0; left: 0; right: auto !important;
    width: min(82vw, 300px) !important;
    height: 100% !important; min-height: 100% !important;
    display: flex !important; flex-direction: column !important;
    align-items: stretch !important;
    overflow-x: hidden !important; overflow-y: auto !important;
    z-index: 60;
    padding-top: env(safe-area-inset-top, 0px);
    transform: translateX(-100%); transition: transform .22s ease;
  }
  .app-shell .sidebar.open { transform: none; box-shadow: 0 0 40px rgba(0, 0, 0, .35); }

  /* Undo the old "horizontal strip" rules so links stack in a column */
  .app-shell .side-nav {
    display: flex !important; flex-direction: column !important; flex-wrap: nowrap !important;
    gap: 4px !important; width: 100% !important;
    overflow: visible !important; padding: 12px !important;
  }
  .app-shell .side-link {
    width: 100% !important; flex: none !important; white-space: normal !important;
  }
  .app-shell .side-hint { display: block !important; }
  .app-shell .side-foot { display: block !important; margin-top: auto; }

  .side-backdrop.open {
    display: block; position: fixed; inset: 0; z-index: 55;
    background: rgba(15, 23, 42, .45);
  }

  .app-shell .app-main { margin-left: 0 !important; width: 100% !important; }
}
`;

export default function App() {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (to) =>
    pathname === to ||
    (to === "/recognize" && !NAV.some((n) => n.to === pathname));

  // Close the drawer after navigating
  useEffect(() => setMenuOpen(false), [pathname]);

  // Close with the Escape key
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app-shell">
      <style>{MOBILE_CSS}</style>

      {/* Mobile top bar with the hamburger button */}
      <header className="mobile-bar">
        <button
          type="button"
          className={`burger ${menuOpen ? "open" : ""}`}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
        <div className="mobile-title">Staff Attendance Portal</div>
      </header>

      <div
        className={`side-backdrop ${menuOpen ? "open" : ""}`}
        onClick={() => setMenuOpen(false)}
      />

      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
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
          <Route path="*" element={<FaceRecognize />} />
        </Routes>
      </main>
    </div>
  );
}