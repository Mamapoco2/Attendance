import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Capacitor } from "@capacitor/core";

const IS_NATIVE = Capacitor.isNativePlatform();

// ── Edit this list to match your real routes ─────────────────────────────────
// hideOnNative: true  → link is NOT shown inside the Android app
const LINKS = [
  { to: "/time-in", label: "Time In / Out" },
  { to: "/register", label: "Register" },
  { to: "/view-dtr", label: "View DTR", hideOnNative: true },
];

const CSS = `
.nav-bar{position:relative;display:flex;align-items:center;justify-content:space-between;
  padding:10px 16px;background:#fff;border-bottom:1px solid #e2e8f0;z-index:50}
.nav-brand{font-weight:700;color:#0369a1;font-size:16px;text-decoration:none}
.nav-links{display:flex;gap:6px}
.nav-link{padding:8px 14px;border-radius:8px;color:#475569;font-size:14px;font-weight:600;text-decoration:none}
.nav-link:hover{background:#f1f5f9}
.nav-link.active{background:#e0f2fe;color:#0369a1}

.nav-burger{display:none;width:44px;height:44px;border:0;background:transparent;border-radius:10px;
  cursor:pointer;position:relative}
.nav-burger span{position:absolute;left:11px;right:11px;height:2px;background:#0f172a;border-radius:2px;
  transition:transform .2s,opacity .2s,top .2s}
.nav-burger span:nth-child(1){top:14px}
.nav-burger span:nth-child(2){top:21px}
.nav-burger span:nth-child(3){top:28px}
.nav-burger.open span:nth-child(1){top:21px;transform:rotate(45deg)}
.nav-burger.open span:nth-child(2){opacity:0}
.nav-burger.open span:nth-child(3){top:21px;transform:rotate(-45deg)}

.nav-backdrop{display:none}

@media (max-width:767px){
  .nav-burger{display:block}
  .nav-links{position:absolute;top:100%;left:0;right:0;flex-direction:column;gap:2px;padding:8px 12px 12px;
    background:#fff;border-bottom:1px solid #e2e8f0;box-shadow:0 10px 24px rgba(15,23,42,.12);
    transform:translateY(-8px);opacity:0;pointer-events:none;transition:transform .18s,opacity .18s}
  .nav-links.open{transform:none;opacity:1;pointer-events:auto}
  .nav-link{padding:14px 12px;font-size:16px}
  .nav-backdrop.open{display:block;position:fixed;inset:0;top:0;background:rgba(15,23,42,.25);z-index:-1}
}
`;

export default function Navbar({ brand = "DTR" }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close the menu after navigating
  useEffect(() => setOpen(false), [location.pathname]);

  // Close with the Escape key
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const links = LINKS.filter((l) => !(IS_NATIVE && l.hideOnNative));

  return (
    <>
      <style>{CSS}</style>
      <nav className="nav-bar">
        <span className="nav-brand">{brand}</span>

        <button
          type="button"
          className={`nav-burger ${open ? "open" : ""}`}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>

        <div className={`nav-backdrop ${open ? "open" : ""}`} onClick={() => setOpen(false)} />

        <div className={`nav-links ${open ? "open" : ""}`}>
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
            >
              {l.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
