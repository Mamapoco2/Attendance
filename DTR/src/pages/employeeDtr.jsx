import { useEffect, useMemo, useState } from "react";
import { getEmployeeDtrCutoff } from "../../services/attendanceService";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const currentDate = new Date();
const isSecondCutoffWindow = currentDate.getDate() >= 26;
const currentMonthDate = new Date(
  currentDate.getFullYear(),
  currentDate.getMonth() + (isSecondCutoffWindow ? 1 : 0),
  1,
);
const currentMonth = currentMonthDate.getMonth() + 1;
const currentYear = currentMonthDate.getFullYear();

const DTR_VERIFIER_NAME = "DAVE ANTHONY A. VERGARA, MD";
const DTR_VERIFIER_TITLE = "OIC, MEDICAL CENTER CHIEF I";

const SHORT_MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function ymdToLocalDate(ymd) {
  if (!ymd) return null;
  const p = String(ymd).split(/[-T]/);
  const y = Number(p[0]), m = Number(p[1]), d = Number(p[2]);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function d2day(n) { return String(n).padStart(2, "0"); }

function toDateInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getCutoffDateFrom(month, year) {
  return new Date(year, month - 2, 26);
}

function formatCutoffRangeDisplay(range) {
  if (!range?.start || !range?.end) return "";
  const start = ymdToLocalDate(range.start);
  const end = ymdToLocalDate(range.end);
  if (!start || !end) return "";
  const y1 = start.getFullYear(), y2 = end.getFullYear();
  const m1 = start.getMonth(), m2 = end.getMonth();
  if (y1 === y2) {
    if (m1 === m2) return `${SHORT_MON[m1]} ${d2day(start.getDate())} - ${d2day(end.getDate())}, ${y1}`;
    return `${SHORT_MON[m1]} ${d2day(start.getDate())} - ${SHORT_MON[m2]} ${d2day(end.getDate())}, ${y1}`;
  }
  return `${SHORT_MON[m1]} ${d2day(start.getDate())}, ${y1} - ${SHORT_MON[m2]} ${d2day(end.getDate())}, ${y2}`;
}

function formatDateRange(range) {
  if (!range?.start || !range?.end) return "MM/DD/YYYY - MM/DD/YYYY";
  const start = new Date(range.start), end = new Date(range.end);
  const s = `${String(start.getMonth()+1).padStart(2,"0")}/${String(start.getDate()).padStart(2,"0")}/${start.getFullYear()}`;
  const e = `${String(end.getMonth()+1).padStart(2,"0")}/${String(end.getDate()).padStart(2,"0")}/${end.getFullYear()}`;
  return `${s} - ${e}`;
}

function formatDtrCellDisplay(raw) {
  if (raw == null) return "";
  let s = String(raw).trim();
  if (!s) return "";
  const dtExtract = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (dtExtract) s = `${dtExtract[2]}:${dtExtract[3]}${dtExtract[4] ? `:${dtExtract[4]}` : ""}`;
  if (!/^\d{1,2}:\d{2}/.test(s)) return s.toUpperCase();
  let m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)\s*$/i);
  if (m) {
    const h = parseInt(m[1], 10), min = m[2].padStart(2,"0"), ap = m[4].toUpperCase();
    return `${String(h).padStart(2,"0")}:${min} ${ap}`;
  }
  m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return s;
  let h24 = parseInt(m[1], 10);
  const min = m[2].padStart(2,"0");
  if (h24 > 23) return s;
  const ap = h24 >= 12 ? "PM" : "AM";
  let h12 = h24 % 12; if (h12 === 0) h12 = 12;
  return `${String(h12).padStart(2,"0")}:${min} ${ap}`;
}

export default function EmployeeDtr() {
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [dateFrom, setDateFrom] = useState(() =>
    toDateInputValue(getCutoffDateFrom(currentMonth, currentYear)),
  );
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const isDateInRange = (dateValue) => {
    if (!dateFrom && !dateTo) return true;
    if (!dateValue) return false;
    const recordDate = new Date(dateValue);
    if (Number.isNaN(recordDate.getTime())) return false;

    if (dateFrom) {
      const from = new Date(dateFrom);
      if (Number.isNaN(from.getTime()) || recordDate < from) return false;
    }

    if (dateTo) {
      const to = new Date(dateTo);
      if (Number.isNaN(to.getTime())) return false;
      to.setHours(23, 59, 59, 999); // inclusive end date
      if (recordDate > to) return false;
    }

    return true;
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem("dtr:lastRecognized");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const empNo = parsed?.employee_number || parsed?.employeeNumber || "";
      if (empNo && !employeeNumber) setEmployeeNumber(empNo);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setDateFrom(toDateInputValue(getCutoffDateFrom(month, year)));
  }, [month, year]);

  const leftEntriesByDay = useMemo(() => {
    const map = new Map();
    (result?.left_entries || []).forEach((e) => {
      if (isDateInRange(e?.date)) map.set(e.day, e);
    });
    return map;
  }, [result, dateFrom, dateTo]);

  const rightEntriesByDay = useMemo(() => {
    const map = new Map();
    (result?.right_entries || []).forEach((e) => {
      if (isDateInRange(e?.date)) map.set(e.day, e);
    });
    return map;
  }, [result, dateFrom, dateTo]);

  const handleLoad = async () => {
    if (!employeeNumber.trim()) { setError("Employee number is required."); return; }
    setError(""); setLoading(true);
    try {
      const data = await getEmployeeDtrCutoff(employeeNumber.trim(), month, year);
      setResult(data);
      if (!data.employee) setError("No employee found for that employee number.");
    } catch (err) {
      console.error(err);
      setError("Failed to load DTR. Please try again.");
      setResult(null);
    } finally { setLoading(false); }
  };

  return (
    <div className="employee-dtr-page flex justify-center px-10 pb-10 pt-8 md:px-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');

        .dtr-ui {
          --ink: #0f1923;
          --ink-2: #3d4d5c;
          --ink-3: #7a8fa0;
          --line: #d3dce6;
          --line-strong: #b0bec8;
          --bg: #f0f4f8;
          --surface: #ffffff;
          --accent: #1a56a0;
          --accent-light: #e8f0fa;
          --danger: #c0392b;
          font-family: 'DM Sans', sans-serif;
        }

        /* ── Controls card ── */
        .dtr-controls-card {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 24px 28px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
          margin-bottom: 20px;
        }

        .dtr-controls-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--line);
        }

        .dtr-controls-icon {
          width: 34px; height: 34px;
          border-radius: 8px;
          background: var(--accent-light);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          color: var(--accent);
        }

        .dtr-controls-icon svg { width: 18px; height: 18px; }

        .dtr-controls-title { font-size: 15px; font-weight: 600; color: var(--ink); letter-spacing: -0.01em; }
        .dtr-controls-sub { font-size: 12px; color: var(--ink-3); margin-top: 1px; }

        .dtr-fields { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-end; }

        .dtr-field { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 140px; }

        .dtr-label {
          font-size: 11.5px; font-weight: 600; color: var(--ink-3);
          text-transform: uppercase; letter-spacing: 0.04em;
        }

        .dtr-input, .dtr-select {
          font-family: 'DM Sans', sans-serif;
          font-size: 13.5px; font-weight: 500; color: var(--ink);
          background: var(--surface);
          border: 1.5px solid var(--line);
          border-radius: 8px;
          padding: 8px 12px;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          appearance: none; -webkit-appearance: none;
          width: 100%;
        }

        .dtr-input:focus, .dtr-select:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(26,86,160,0.1);
        }

        .dtr-select {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%237a8fa0' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          padding-right: 32px;
        }

        .dtr-actions { display: flex; gap: 8px; align-items: flex-end; flex-shrink: 0; }

        .dtr-btn {
          font-family: 'DM Sans', sans-serif;
          font-size: 13.5px; font-weight: 600;
          padding: 8.5px 18px;
          border-radius: 8px; border: none;
          cursor: pointer;
          transition: background 0.15s, transform 0.1s, opacity 0.15s;
          white-space: nowrap;
          display: flex; align-items: center; gap: 6px;
        }
        .dtr-btn:active { transform: scale(0.97); }
        .dtr-btn:disabled { opacity: 0.55; cursor: not-allowed; }

        .dtr-btn-primary { background: var(--accent); color: #fff; box-shadow: 0 1px 3px rgba(26,86,160,0.25); }
        .dtr-btn-primary:hover:not(:disabled) { background: #174a8e; }

        .dtr-btn-ghost { background: var(--surface); color: var(--ink-2); border: 1.5px solid var(--line); }
        .dtr-btn-ghost:hover { background: #f4f7fb; border-color: var(--line-strong); }

        /* ── Error ── */
        .dtr-error-bar {
          background: #fdf0ef;
          border: 1px solid #f0c5c2;
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 13px;
          color: var(--danger);
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 16px;
        }

        /* ── Cutoff bar ── */
        .dtr-cutoff-bar {
          display: flex; align-items: center; gap: 10px;
          background: var(--accent-light);
          border: 1px solid #c4d8f3;
          border-radius: 8px;
          padding: 9px 14px;
          font-family: 'DM Sans', sans-serif;
          font-size: 12.5px;
          color: var(--accent);
          font-weight: 500;
          margin-bottom: 20px;
        }
        .dtr-cutoff-bar strong { font-weight: 700; color: var(--ink); }
        .dtr-cutoff-range { font-family: 'DM Mono', monospace; font-size: 12px; color: var(--ink-2); }
        .dtr-cutoff-sep { color: #b0bec8; }

        /* ── Paper ── */
        .dtr-paper {
          background: white;
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 28px 28px 24px;
          box-shadow: 0 1px 6px rgba(0,0,0,0.07);
        }

        @keyframes dtr-spin { to { transform: rotate(360deg); } }
        .dtr-spin { animation: dtr-spin 0.8s linear infinite; }

        /* ── Print ── */
        @media print {
          @page { size: A4 portrait; margin: 5mm; }
          body { background: #fff !important; }
          .navbar, .dtr-controls-card, .dtr-error-bar, .dtr-cutoff-bar { display: none !important; }
          .employee-dtr-page { padding: 0 !important; display: block !important; }
          .employee-dtr-container { max-width: none !important; width: 100% !important; }
          .dtr-paper { border: none !important; padding: 0 !important; width: 100% !important; max-width: 100% !important; box-sizing: border-box; box-shadow: none !important; border-radius: 0 !important; }
          .employee-dtr-copies { gap: 8mm !important; grid-template-columns: 1fr 1fr !important; width: 100% !important; }
          .employee-dtr-copy { display: flex !important; flex-direction: column !important; align-items: center !important; box-sizing: border-box; width: 100% !important; min-width: 0 !important; transform: none !important; padding: 4px 0 !important; }
          .employee-dtr-copy-inner { width: 100%; max-width: 100%; display: flex; flex-direction: column; align-items: center; }
          .employee-dtr-form, .employee-dtr-form table, .employee-dtr-form th, .employee-dtr-form td { font-family: "Times New Roman", Times, serif !important; }
          .employee-dtr-copy table { width: 100% !important; margin-left: auto !important; margin-right: auto !important; }
          .employee-dtr-shared-signature { break-inside: avoid; page-break-inside: avoid; }
          .employee-dtr-sig-spacer { height: 16mm !important; min-height: 16mm !important; }
        }
      `}</style>

      <div className="employee-dtr-container w-full max-w-[1240px]">

        {/* ── Controls ── */}
        <div className="dtr-ui dtr-controls-card">
          <div className="dtr-controls-header">
            <div className="dtr-controls-icon">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <div className="dtr-controls-title">Daily Time Record</div>
              <div className="dtr-controls-sub">CS Form No. 48 — View and print employee DTR</div>
            </div>
          </div>

          <div className="dtr-fields">
            <div className="dtr-field" style={{ maxWidth: 180 }}>
              <label className="dtr-label">Employee No.</label>
              <input
                className="dtr-input"
                value={employeeNumber}
                onChange={(e) => setEmployeeNumber(e.target.value)}
                placeholder="e.g. EMP-0001"
                onKeyDown={(e) => e.key === "Enter" && handleLoad()}
              />
            </div>
            <div className="dtr-field" style={{ maxWidth: 180 }}>
              <label className="dtr-label">Month</label>
              <select className="dtr-select" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="dtr-field" style={{ maxWidth: 120 }}>
              <label className="dtr-label">Year</label>
              <input
                className="dtr-input"
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </div>
            <div className="dtr-field" style={{ maxWidth: 180 }}>
              <label className="dtr-label">Date From</label>
              <input
                className="dtr-input"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="dtr-field" style={{ maxWidth: 180 }}>
              <label className="dtr-label">Date To</label>
              <input
                className="dtr-input"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="dtr-actions">
              <button className="dtr-btn dtr-btn-primary" onClick={handleLoad} disabled={loading}>
                {loading ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="dtr-spin">
                      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity={0.3}/>
                      <path strokeLinecap="round" d="M21 12a9 9 0 00-9-9"/>
                    </svg>
                    Loading…
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="m21 21-4.35-4.35"/>
                    </svg>
                    View DTR
                  </>
                )}
              </button>
              <button className="dtr-btn dtr-btn-ghost" onClick={() => window.print()}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                  <rect x="6" y="14" width="12" height="8" rx="1"/>
                </svg>
                Print
              </button>
            </div>
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="dtr-ui dtr-error-bar">
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10"/>
              <path strokeLinecap="round" d="M12 8v4m0 4h.01"/>
            </svg>
            {error}
          </div>
        )}

        {/* ── Cutoff bar ── */}
        {result && (
          <div className="dtr-ui dtr-cutoff-bar">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
            <strong>Cutoff periods:</strong>
            <span className="dtr-cutoff-range">{formatDateRange(result?.left_range)}</span>
            <span className="dtr-cutoff-sep">|</span>
            <span className="dtr-cutoff-range">{formatDateRange(result?.right_range)}</span>
          </div>
        )}

        {/* ── Paper ── */}
        <div className="dtr-paper">
          {/* fallback cutoff text when no result yet */}
          {!result && (
            <div className="employee-dtr-cutoff mb-3 text-[13px] font-sans">
              <span className="mr-1.5 font-bold">Cutoff:</span>
              <span className="font-mono">
                {formatDateRange(result?.left_range)} | {formatDateRange(result?.right_range)}
              </span>
            </div>
          )}

          <div className="employee-dtr-copies grid grid-cols-2 gap-6">
            <DtrCopy employeeName={result?.employee?.name || ""} entriesByDay={leftEntriesByDay} cutoffRange={result?.left_range} />
            <DtrCopy employeeName={result?.employee?.name || ""} entriesByDay={rightEntriesByDay} cutoffRange={result?.right_range} />
          </div>

          {/* Shared signature — unchanged */}
          <div className='employee-dtr-shared-signature employee-dtr-form mt-8 flex w-full max-w-full flex-col items-center pt-1 text-center font-["Times New Roman",Times,serif]'>
            <div className="employee-dtr-sig-block-a flex w-full max-w-[520px] flex-col items-center">
              <div className="employee-dtr-sig-top-rule mb-1.5 w-full border-t border-black" />
              <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.5px]">SIGNATURE</div>
              <div className="text-[10px] leading-[1.4]">Verified as to the prescribed office hours.</div>
            </div>
            <div className="employee-dtr-sig-spacer h-10 w-full" />
            <div className="employee-dtr-sig-block-b flex w-full max-w-[520px] flex-col items-center">
              <div className="employee-dtr-sig-b-rule mb-1.5 w-full border-t border-black" />
              <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.2px]">{DTR_VERIFIER_NAME}</div>
              <div className="text-[10px] uppercase tracking-[0.2px]">{DTR_VERIFIER_TITLE}</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── DtrCopy — completely original, zero changes ──────────────────────────────
function DtrCopy({ employeeName, entriesByDay, cutoffRange }) {
  const monthRangeText = formatCutoffRangeDisplay(cutoffRange) || "";
  const dtrCellValue = (entry, rawValue) => {
    if (!entry) return "OFF";
    const formatted = formatDtrCellDisplay(rawValue);
    return formatted || "OFF";
  };

  return (
    <div className="employee-dtr-copy flex flex-col items-center px-1 py-2">
      <div className='employee-dtr-copy-inner employee-dtr-form flex w-full max-w-full flex-col items-center font-["Times New Roman",Times,serif]'>
        <div className="mb-2 w-full text-left text-[10px] font-bold leading-[1.1]">Civil Service Form No. 48</div>
        <div className="mb-2.5 w-full text-center text-[17px] font-bold uppercase leading-[1.2] tracking-[0.5px]">
          DAILY TIME RECORD
        </div>

        <div className="employee-dtr-name-block mb-2.5 w-full text-center">
          <div className="flex w-full justify-center">
            <div className="inline-block w-fit max-w-full border-b-[1.5px] border-black px-2.5 pb-0.5 text-center">
              <span className="text-[12px] font-bold uppercase leading-[1.1] tracking-[0.2px]">
                {employeeName || "\u00a0"}
              </span>
            </div>
          </div>
          <div className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.5px]">NAME</div>
        </div>

        <div className="employee-dtr-header-fields mt-1.5 w-full self-stretch">
          <div className="mb-1 flex w-full items-end justify-between gap-1">
            <span className="flex-[0_0_46%] pb-px text-left text-[9.5px] font-bold leading-[1.15]">For the month of</span>
            <span className="flex flex-1 items-end justify-center">
              <span className="inline-block border-b border-black pb-px text-center text-[9.5px] font-bold leading-[1.2]">
                {monthRangeText}
              </span>
            </span>
          </div>
          <div className="mb-1 flex w-full items-end justify-between gap-1">
            <span className="flex-[0_0_46%] pb-px text-left text-[9.5px] font-bold leading-[1.15]">Official Hours:</span>
            <span className="flex flex-1 items-end justify-center">
              <span className="inline-block border-b border-black pb-px text-center text-[9.5px] font-bold leading-[1.2]">
                8:00 AM - 5:00 PM
              </span>
            </span>
          </div>
          <div className="mb-1 flex w-full items-end justify-between gap-1">
            <span className="flex-[0_0_46%] pb-px text-left text-[9.5px] font-bold leading-[1.15]">
              For Arrival & Departure Days:
            </span>
            <span className="block min-h-[18px] flex-1 border-b border-black">&nbsp;</span>
          </div>
          <div className="flex w-full items-end justify-between gap-1 pl-5">
            <span className="flex-[0_0_46%] pb-px text-left text-[9.5px] font-bold leading-[1.15]">Saturdays:</span>
            <span className="block min-h-[18px] flex-1 border-b border-black">&nbsp;</span>
          </div>
        </div>

        <table className="employee-dtr-grid-table mt-2 w-full border-collapse">
          <thead>
            <tr>
              <th rowSpan={2} className="border border-black px-[2px] py-[1px] text-left text-[10px] font-bold" style={{ paddingLeft: 4 }}>
                Days
              </th>
              <th colSpan={2} className="border border-black px-[2px] py-[1px] text-[10px] font-bold text-center">
                Morning
              </th>
              <th colSpan={2} className="border border-black px-[2px] py-[1px] text-[10px] font-bold text-center">
                Afternoon
              </th>
              <th colSpan={2} className="border border-black px-[2px] py-[1px] text-[10px] font-bold text-center">
                Overtime
              </th>
            </tr>
            <tr>
              <th className="border border-black px-[2px] py-[1px] text-[10px] font-bold text-center">Arrived</th>
              <th className="border border-black px-[2px] py-[1px] text-[10px] font-bold text-center">Departure</th>
              <th className="border border-black px-[2px] py-[1px] text-[10px] font-bold text-center">Arrived</th>
              <th className="border border-black px-[2px] py-[1px] text-[10px] font-bold text-center">Departure</th>
              <th className="border border-black px-[2px] py-[1px] text-[10px] font-bold text-center">Hours</th>
              <th className="border border-black px-[2px] py-[1px] text-[10px] font-bold text-center">Minutes</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 31 }).map((_, idx) => {
              const day = idx + 1;
              const entry = entriesByDay.get(day);
              const dayLabel = String(day).padStart(2, "0");
              return (
                <tr key={day}>
                  <td className="h-4 border border-black px-[2px] py-[1px] text-center text-[10px] font-bold" style={{ paddingLeft: 4 }}>
                    {dayLabel}
                  </td>
                  <td className="h-4 border border-black px-[2px] py-[1px] text-center text-[10px]">{dtrCellValue(entry, entry?.am_arrival)}</td>
                  <td className="h-4 border border-black px-[2px] py-[1px] text-center text-[10px]">{dtrCellValue(entry, entry?.am_departure)}</td>
                  <td className="h-4 border border-black px-[2px] py-[1px] text-center text-[10px]">{dtrCellValue(entry, entry?.pm_arrival)}</td>
                  <td className="h-4 border border-black px-[2px] py-[1px] text-center text-[10px]">{dtrCellValue(entry, entry?.pm_departure)}</td>
                  <td className="h-4 border border-black px-[2px] py-[1px] text-center text-[10px]" />
                  <td className="h-4 border border-black px-[2px] py-[1px] text-center text-[10px]" />
                </tr>
              );
            })}
            <tr>
              <td colSpan={5} className="h-4 border border-black px-[2px] py-[1px] text-right text-[10px] font-bold" style={{ paddingRight: 8 }}>
                Total
              </td>
              <td className="h-4 border border-black px-[2px] py-[1px] text-center text-[10px]" />
              <td className="h-4 border border-black px-[2px] py-[1px] text-center text-[10px]" />
            </tr>
          </tbody>
        </table>

        <p className="mt-2.5 min-h-[34px] w-full px-0.5 text-[9px] italic leading-[1.25]">
          I certify on my honor that the above is a true and correct report of the hours of work performed, record of which was
          made daily at the time of arrival and departure from office.
        </p>
      </div>
    </div>
  );
}