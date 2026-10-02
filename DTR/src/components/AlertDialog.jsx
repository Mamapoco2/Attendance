import { useEffect, useRef } from "react";

const TONES = {
  success: { icon: "✓", color: "#16a34a", bg: "#f0fdf4", ring: "#bbf7d0" },
  info: { icon: "i", color: "#0284c7", bg: "#f0f9ff", ring: "#bae6fd" },
  error: { icon: "✕", color: "#dc2626", bg: "#fef2f2", ring: "#fecaca" },
};

export default function AlertDialog({
  open,
  tone = "info",
  title,
  children,
  confirmLabel = "OK",
  autoCloseMs,
  onClose,
}) {
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    buttonRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    const timer = autoCloseMs ? setTimeout(onClose, autoCloseMs) : null;

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (timer) clearTimeout(timer);
    };
  }, [open, autoCloseMs, onClose]);

  if (!open) return null;

  const { icon, color, bg, ring } = TONES[tone] ?? TONES.info;

  return (
    <div className="alert-overlay" onClick={onClose}>
      <div
        className="alert-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alert-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="alert-icon"
          style={{ color, background: bg, borderColor: ring }}
          aria-hidden="true"
        >
          {icon}
        </div>
        <h2 id="alert-dialog-title" className="alert-title">
          {title}
        </h2>
        <div className="alert-body">{children}</div>
        <button
          ref={buttonRef}
          type="button"
          className="alert-btn"
          style={{ background: color }}
          onClick={onClose}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
