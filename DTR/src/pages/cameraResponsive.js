// Responsive overrides shared by the camera pages (timeIn.jsx, register.jsx).
//
// Rendered with <style>{CAMERA_RESPONSIVE_CSS}</style> inside each page so these
// rules load AFTER your global stylesheet and win the cascade. Desktop (>1024px)
// is untouched — everything below lives inside a media query.
//
// Per-page camera shape can be tuned with CSS variables on .hosp-root:
//   --cam-ratio-tablet   (default 4 / 3)
//   --cam-ratio-phone    (default 4 / 5  → tall, so the camera fills the screen)
//   --cam-reserve        (default 330px) = height of everything ELSE on the page
//                        (top bar, status, name card, button). The camera gets
//                        100dvh minus this, so the button is visible without scrolling.

export const CAMERA_RESPONSIVE_CSS = `
/* ───────────── Tablet & below (≤ 1024px) ───────────── */
@media (max-width: 1024px) {
  .hosp-root {
    padding-left: max(12px, env(safe-area-inset-left)) !important;
    padding-right: max(12px, env(safe-area-inset-right)) !important;
    padding-bottom: max(16px, env(safe-area-inset-bottom)) !important;
    box-sizing: border-box;
  }

  .hosp-root .card {
    width: 100% !important;
    max-width: none !important;
  }

  /* Remove the "Face Recognition / clock" header so the camera is first */
  .hosp-root .card-header { display: none !important; }
  .hosp-root .card-body { padding-top: 12px !important; }
  .hosp-root .top-bar { padding-top: 8px !important; padding-bottom: 8px !important; }
  .hosp-root .brand-sub { display: none !important; }
  .hosp-root .section-label { display: none !important; }

  /* Stack: camera on top at full width, details/button underneath */
  .hosp-root .card-body.two-col {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) !important;
    gap: 18px !important;
  }
  .hosp-root .col-main,
  .hosp-root .col-side {
    min-width: 0 !important;
    width: 100% !important;
    max-width: none !important;
  }

  /* Bigger camera: full width of the card, fixed aspect, never taller than the screen.
     Video + canvas both use object-fit: cover so the face-box overlay stays aligned. */
  .hosp-root .video-wrapper {
    position: relative !important;
    width: 100% !important;
    max-width: none !important;
    height: auto !important;
    aspect-ratio: var(--cam-ratio-tablet, 4 / 3) !important;
    /* camera fills what's left after the other elements, so the button stays on-screen */
    max-height: calc(100vh - var(--cam-reserve, 330px));
    max-height: calc(100dvh - var(--cam-reserve, 330px));
    min-height: 240px;
    overflow: hidden !important;
    border-radius: 16px !important;
  }
  .hosp-root .video-wrapper video,
  .hosp-root .video-wrapper canvas {
    position: absolute !important;
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
  }

  .hosp-root .vid-badge { font-size: 12px !important; }
  .hosp-root .status-text { font-size: 15px !important; }

  /* Touch-friendly controls */
  .hosp-root .confirm-btn,
  .hosp-root .register-btn {
    width: 100% !important;
    min-height: 52px !important;
    font-size: 16px !important;
    touch-action: manipulation;
  }
  .hosp-root .name-input {
    font-size: 16px !important; /* stops iOS Safari zooming in on focus */
    min-height: 48px !important;
  }
}

/* ───────────── Landscape tablets: camera left, details right ───────────── */
@media (min-width: 768px) and (max-width: 1024px) and (orientation: landscape) {
  .hosp-root .card-body.two-col {
    grid-template-columns: minmax(0, 1.8fr) minmax(280px, 1fr) !important;
    align-items: start;
  }
  .hosp-root .video-wrapper {
    max-height: calc(100vh - 110px);
    max-height: calc(100dvh - 110px);
  }
}

/* ───────────── Phones (≤ 600px) ───────────── */
@media (max-width: 600px) {
  .hosp-root {
    padding-top: 8px !important;
    padding-left: max(8px, env(safe-area-inset-left)) !important;
    padding-right: max(8px, env(safe-area-inset-right)) !important;
  }

  .hosp-root .top-bar {
    flex-wrap: wrap;
    gap: 8px;
    padding: 10px 12px !important;
  }
  .hosp-root .brand-name { font-size: 13px !important; line-height: 1.25 !important; }
  .hosp-root .brand-sub  { font-size: 11px !important; }
  .hosp-root .live-pill  { font-size: 11px !important; padding: 4px 10px !important; }

  .hosp-root .card { border-radius: 16px !important; }
  .hosp-root .card-body { padding: 8px !important; }
  .hosp-root .card-body.two-col { gap: 10px !important; }
  .hosp-root .col-main { display: flex; flex-direction: column; gap: 8px; }

  /* Camera: taller and nearly edge-to-edge on phones */
  .hosp-root .video-wrapper {
    aspect-ratio: var(--cam-ratio-phone, 4 / 5) !important;
    max-height: calc(100vh - var(--cam-reserve, 330px));
    max-height: calc(100dvh - var(--cam-reserve, 330px));
    min-height: 220px;
    border-radius: 14px !important;
  }
  .hosp-root .vid-badge { font-size: 11px !important; }
  .hosp-root .liveness-badge { font-size: 12px !important; }
  .hosp-root .face-indicator { font-size: 12px !important; }

  .hosp-root .challenge-banner {
    flex-wrap: wrap;
    gap: 8px;
    font-size: 14px !important;
  }
  .hosp-root .status-row { padding: 9px 12px !important; margin-top: 0 !important; }
  .hosp-root .identity-card { padding: 8px 12px !important; margin-bottom: 8px !important; }
  .hosp-root .confirm-btn,
  .hosp-root .register-btn { min-height: 48px !important; }

  .hosp-root .steps-row { gap: 4px; }
  .hosp-root .step-label { font-size: 12px !important; }

  .hosp-root .card-footer {
    flex-wrap: wrap;
    gap: 6px;
    padding: 10px 14px !important;
  }
}

/* ───────────── Phones held sideways ───────────── */
@media (max-height: 500px) and (orientation: landscape) {
  .hosp-root .card-body.two-col {
    grid-template-columns: minmax(0, 1.5fr) minmax(220px, 1fr) !important;
    align-items: start;
  }
  .hosp-root .video-wrapper {
    aspect-ratio: 16 / 9 !important;
    max-height: calc(100vh - 90px);
    max-height: calc(100dvh - 90px);
    min-height: 0;
  }
  .hosp-root .card-footer { display: none !important; }
}
`;
