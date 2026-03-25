import { useState } from "react";

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth();

// Sample data — replace with real API data
const SAMPLE_ENTRIES = {
  1: {
    am_arrival: "8:00",
    am_departure: "12:00",
    pm_arrival: "1:00",
    pm_departure: "5:00",
  },
  2: {
    am_arrival: "8:02",
    am_departure: "12:00",
    pm_arrival: "1:00",
    pm_departure: "5:00",
  },
  3: {
    am_arrival: "8:00",
    am_departure: "12:00",
    pm_arrival: "1:00",
    pm_departure: "5:01",
  },
  5: {
    am_arrival: "8:10",
    am_departure: "12:00",
    pm_arrival: "1:00",
    pm_departure: "5:00",
    undertime_hours: "0",
    undertime_minutes: "10",
  },
  6: {
    am_arrival: "8:00",
    am_departure: "12:00",
    pm_arrival: "1:00",
    pm_departure: "5:00",
  },
  7: {
    am_arrival: "7:58",
    am_departure: "12:00",
    pm_arrival: "1:00",
    pm_departure: "5:00",
  },
  8: {
    am_arrival: "8:00",
    am_departure: "12:00",
    pm_arrival: "1:00",
    pm_departure: "5:00",
  },
  9: {
    am_arrival: "8:00",
    am_departure: "12:00",
    pm_arrival: "1:00",
    pm_departure: "5:00",
  },
  12: {
    am_arrival: "8:00",
    am_departure: "12:00",
    pm_arrival: "1:00",
    pm_departure: "5:00",
  },
  13: {
    am_arrival: "8:05",
    am_departure: "12:00",
    pm_arrival: "1:00",
    pm_departure: "5:00",
  },
  14: {
    am_arrival: "8:00",
    am_departure: "12:00",
    pm_arrival: "1:00",
    pm_departure: "4:30",
    undertime_hours: "0",
    undertime_minutes: "30",
  },
  15: {
    am_arrival: "8:00",
    am_departure: "12:00",
    pm_arrival: "1:00",
    pm_departure: "5:00",
  },
  16: {
    am_arrival: "8:00",
    am_departure: "12:00",
    pm_arrival: "1:00",
    pm_departure: "5:00",
  },
};

function Cell({ children, bold, center, muted, highlight }) {
  return (
    <td
      style={{
        padding: "2px 4px",
        fontSize: 11,
        fontFamily: "'DM Mono', monospace",
        fontWeight: bold ? 600 : 400,
        textAlign: center ? "center" : "left",
        color: muted ? "#94a3b8" : highlight ? "#0284c7" : "#0f172a",
        borderRight: "1px solid #e2e8f0",
        borderBottom: "1px solid #e2e8f0",
        whiteSpace: "nowrap",
        background: highlight ? "#f0f9ff" : "transparent",
      }}
    >
      {children}
    </td>
  );
}

export default function ViewDTR() {
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [staffName, setStaffName] = useState("Juan dela Cruz");
  const [officialHours] = useState("8:00 AM – 5:00 PM");
  const [regularDays] = useState("Mon – Fri");
  const [saturdays] = useState("As needed");
  const [time] = useState(new Date());
  const [entries] = useState(SAMPLE_ENTRIES);

  const timeStr = time.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const dateStr = time.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Totals
  let totalUTHours = 0,
    totalUTMins = 0;
  Object.values(entries).forEach((e) => {
    totalUTHours += parseInt(e.undertime_hours || 0);
    totalUTMins += parseInt(e.undertime_minutes || 0);
  });
  totalUTHours += Math.floor(totalUTMins / 60);
  totalUTMins = totalUTMins % 60;

  const thStyle = {
    padding: "5px 4px",
    fontSize: 10,
    fontWeight: 600,
    textAlign: "center",
    color: "#0284c7",
    background: "#f0f9ff",
    borderRight: "1px solid #bae6fd",
    borderBottom: "1px solid #bae6fd",
    letterSpacing: "0.3px",
    fontFamily: "'DM Sans', sans-serif",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .dtr-root {
          min-height: 100vh;
          background: #f1f5f9;
          font-family: 'DM Sans', sans-serif;
          padding: 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .top-bar {
          width: 100%;
          max-width: 760px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .hospital-brand { display: flex; align-items: center; gap: 10px; text-decoration: none; }

        .cross-icon {
          width: 34px; height: 34px;
          background: #0ea5e9;
          border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 8px rgba(14,165,233,0.35);
          flex-shrink: 0;
        }
        .cross-icon svg { width: 18px; height: 18px; fill: white; }

        .brand-name { font-size: 14px; font-weight: 600; color: #0f172a; letter-spacing: -0.2px; line-height: 1.2; }
        .brand-sub  { font-size: 11px; color: #94a3b8; }

        .clock-pill {
          display: flex; align-items: center; gap: 6px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 99px;
          padding: 5px 14px;
          font-size: 12px; font-weight: 500; color: #475569;
          font-family: 'DM Mono', monospace;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        .card {
          width: 100%; max-width: 760px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.08);
          overflow: hidden;
        }

        .card-header {
          background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
          padding: 20px 28px;
          display: flex; align-items: center; justify-content: space-between;
        }

        .card-title { font-size: 18px; font-weight: 600; color: white; letter-spacing: -0.3px; }
        .card-subtitle { font-size: 12px; color: rgba(255,255,255,0.7); margin-top: 2px; }

        .clock-wrap { text-align: right; }
        .clock-time { font-family: 'DM Mono', monospace; font-size: 22px; font-weight: 500; color: white; line-height: 1; }
        .clock-date { font-size: 10px; color: rgba(255,255,255,0.65); margin-top: 3px; }

        .card-body { padding: 28px; }

        /* Controls row */
        .controls-row {
          display: flex; gap: 12px; flex-wrap: wrap;
          margin-bottom: 24px; align-items: flex-end;
        }

        .field { display: flex; flex-direction: column; gap: 5px; }

        .field-label {
          font-size: 10px; font-weight: 500; color: #94a3b8;
          text-transform: uppercase; letter-spacing: 1px;
        }

        .field-input, .field-select {
          padding: 8px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px; font-weight: 500; color: #0f172a;
          background: #f8fafc;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .field-input:focus, .field-select:focus {
          border-color: #7dd3fc;
          background: white;
          box-shadow: 0 0 0 3px rgba(14,165,233,0.1);
        }

        .print-btn {
          padding: 8px 18px;
          background: #0ea5e9;
          border: none; border-radius: 8px;
          color: white; font-family: 'DM Sans', sans-serif;
          font-size: 13px; font-weight: 600;
          cursor: pointer;
          display: flex; align-items: center; gap: 6px;
          box-shadow: 0 2px 8px rgba(14,165,233,0.3);
          transition: background 0.2s;
          margin-left: auto;
        }
        .print-btn:hover { background: #0284c7; }

        /* DTR document */
        .dtr-doc {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          overflow: hidden;
        }

        /* Document header */
        .doc-header {
          padding: 18px 24px 14px;
          background: #fafafa;
          border-bottom: 2px solid #e2e8f0;
          text-align: center;
        }

        .doc-form-no {
          font-size: 10px; color: #94a3b8; font-family: 'DM Mono', monospace;
          letter-spacing: 1px; margin-bottom: 4px;
        }

        .doc-title {
          font-size: 18px; font-weight: 700; color: #0f172a;
          letter-spacing: 1px; text-transform: uppercase;
        }

        .doc-ooo { font-size: 10px; color: #94a3b8; margin-top: 2px; }

        /* Info row */
        .doc-info {
          padding: 14px 24px;
          border-bottom: 1px solid #e2e8f0;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 32px;
          background: white;
        }

        .info-row { display: flex; align-items: baseline; gap: 6px; }
        .info-label { font-size: 11px; color: #64748b; white-space: nowrap; }
        .info-value {
          font-size: 12px; font-weight: 600; color: #0f172a;
          border-bottom: 1px solid #cbd5e1;
          flex: 1; min-width: 80px;
          padding-bottom: 1px;
          font-family: 'DM Mono', monospace;
        }

        /* Table container */
        .table-wrap {
          overflow-x: auto;
          padding: 0;
        }

        table {
          width: 100%; border-collapse: collapse;
          border-top: 1px solid #e2e8f0;
        }

        .th-group {
          background: #f0f9ff;
          border-bottom: 1px solid #bae6fd;
        }

        .summary-row {
          background: #f8fafc;
          border-top: 2px solid #e2e8f0;
        }

        .day-weekend { background: #fafafa !important; }
        .day-no-entry td { color: #cbd5e1 !important; }

        /* Certification */
        .certification {
          padding: 16px 24px;
          border-top: 1px solid #e2e8f0;
          background: #fafafa;
        }

        .cert-text {
          font-size: 10px; font-style: italic; color: #64748b;
          line-height: 1.6; margin-bottom: 16px;
        }

        .sig-area {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 24px; margin-top: 8px;
        }

        .sig-block { display: flex; flex-direction: column; gap: 4px; }
        .sig-label { font-size: 10px; color: #94a3b8; }
        .sig-line  { height: 1px; background: #cbd5e1; margin-top: 24px; }
        .sig-name  { font-size: 11px; font-weight: 600; color: #0f172a; text-align: center; margin-top: 4px; }

        /* Footer */
        .card-footer {
          padding: 12px 28px;
          background: #f8fafc;
          border-top: 1px solid #f1f5f9;
          display: flex; align-items: center; justify-content: space-between;
        }
        .footer-text { font-size: 11px; color: #94a3b8; }
        .footer-badge {
          font-size: 10px; font-weight: 500;
          color: #0284c7; background: #e0f2fe;
          border-radius: 4px; padding: 2px 7px;
        }

        @media print {
          .dtr-root { background: white; padding: 0; }
          .top-bar, .controls-row, .print-btn, .card-footer { display: none !important; }
          .card { box-shadow: none; border-radius: 0; }
          .card-header { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>

      <div className="dtr-root">
        {/* Top bar */}
        <div className="top-bar">
          <div className="hospital-brand">
            <div className="cross-icon">
              <svg viewBox="0 0 24 24">
                <path d="M19 8h-4V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v4H5a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h4v4a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-4h4a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1z" />
              </svg>
            </div>
            <div>
              <div className="brand-name">MediTrack</div>
              <div className="brand-sub">Staff Attendance Portal</div>
            </div>
          </div>
          <div className="clock-pill">{timeStr}</div>
        </div>

        <div className="card">
          {/* Card header */}
          <div className="card-header">
            <div>
              <div className="card-title">Daily Time Record</div>
              <div className="card-subtitle">Civil Service Form No. 4B</div>
            </div>
            <div className="clock-wrap">
              <div className="clock-time">{timeStr}</div>
              <div className="clock-date">{dateStr}</div>
            </div>
          </div>

          <div className="card-body">
            {/* Controls */}
            <div className="controls-row">
              <div className="field">
                <span className="field-label">Staff Name</span>
                <input
                  className="field-input"
                  style={{ width: 200 }}
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div className="field">
                <span className="field-label">Month</span>
                <select
                  className="field-select"
                  value={month}
                  onChange={(e) => setMonth(+e.target.value)}
                >
                  {MONTHS.map((m, i) => (
                    <option key={i} value={i}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <span className="field-label">Year</span>
                <select
                  className="field-select"
                  value={year}
                  onChange={(e) => setYear(+e.target.value)}
                >
                  {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <button className="print-btn" onClick={() => window.print()}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                Print DTR
              </button>
            </div>

            {/* DTR Document */}
            <div className="dtr-doc">
              {/* Document title */}
              <div className="doc-header">
                <div className="doc-form-no">CIVIL SERVICE FORM NO. 4B</div>
                <div className="doc-title">Daily Time Record</div>
                <div className="doc-ooo">— — — o O o — — —</div>
              </div>

              {/* Info fields */}
              <div className="doc-info">
                <div className="info-row">
                  <span className="info-label">(Name)</span>
                  <span className="info-value">{staffName}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">
                    Official hours for arrival and departure
                  </span>
                  <span className="info-value" style={{ fontSize: 11 }}>
                    {officialHours}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">For the month of</span>
                  <span className="info-value">
                    {MONTHS[month]} {year}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 16 }}>
                  <div className="info-row" style={{ flex: 1 }}>
                    <span className="info-label">Regular days</span>
                    <span className="info-value">{regularDays}</span>
                  </div>
                  <div className="info-row" style={{ flex: 1 }}>
                    <span className="info-label">Saturdays</span>
                    <span className="info-value">{saturdays}</span>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr className="th-group">
                      <th rowSpan={2} style={{ ...thStyle, width: 36 }}>
                        Day
                      </th>
                      <th colSpan={2} style={thStyle}>
                        A.M.
                      </th>
                      <th colSpan={2} style={thStyle}>
                        P.M.
                      </th>
                      <th colSpan={2} style={thStyle}>
                        Undertime
                      </th>
                    </tr>
                    <tr className="th-group">
                      {[
                        "Arrival",
                        "Departure",
                        "Arrival",
                        "Departure",
                        "Hours",
                        "Minutes",
                      ].map((h, i) => (
                        <th
                          key={i}
                          style={{
                            ...thStyle,
                            fontWeight: 500,
                            fontSize: 10,
                            padding: "3px 4px",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map((day) => {
                      const date = new Date(year, month, day);
                      const isReal = date.getMonth() === month;
                      const dow = date.getDay();
                      const isWeekend = dow === 0 || dow === 6;
                      const entry = entries[day];
                      const rowBg = !isReal
                        ? "#fafafa"
                        : isWeekend
                          ? "#f8fafc"
                          : "white";

                      return (
                        <tr key={day} style={{ background: rowBg }}>
                          <td
                            style={{
                              ...{
                                padding: "3px 4px",
                                fontSize: 11,
                                fontWeight: 700,
                                textAlign: "center",
                                borderRight: "1px solid #e2e8f0",
                                borderBottom: "1px solid #f1f5f9",
                                color: !isReal
                                  ? "#e2e8f0"
                                  : isWeekend
                                    ? "#94a3b8"
                                    : "#0f172a",
                                fontFamily: "'DM Mono', monospace",
                              },
                            }}
                          >
                            {isReal ? day : ""}
                          </td>
                          {[
                            "am_arrival",
                            "am_departure",
                            "pm_arrival",
                            "pm_departure",
                            "undertime_hours",
                            "undertime_minutes",
                          ].map((key, ci) => (
                            <td
                              key={ci}
                              style={{
                                padding: "3px 6px",
                                fontSize: 11,
                                textAlign: "center",
                                borderRight: "1px solid #e2e8f0",
                                borderBottom: "1px solid #f1f5f9",
                                color: !isReal
                                  ? "#e2e8f0"
                                  : entry?.[key]
                                    ? "#0f172a"
                                    : "#e2e8f0",
                                fontFamily: "'DM Mono', monospace",
                                background:
                                  isWeekend && isReal
                                    ? "#f8fafc"
                                    : "transparent",
                              }}
                            >
                              {isReal
                                ? (entry?.[key] ?? (isWeekend ? "—" : ""))
                                : ""}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                    {/* Total row */}
                    <tr className="summary-row">
                      <td
                        colSpan={5}
                        style={{
                          padding: "5px 10px",
                          fontSize: 11,
                          fontWeight: 600,
                          textAlign: "right",
                          color: "#0284c7",
                          borderRight: "1px solid #e2e8f0",
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                      >
                        Total
                      </td>
                      <td
                        style={{
                          padding: "5px 6px",
                          fontSize: 11,
                          fontWeight: 700,
                          textAlign: "center",
                          color: "#0f172a",
                          borderRight: "1px solid #e2e8f0",
                          fontFamily: "'DM Mono', monospace",
                        }}
                      >
                        {totalUTHours || ""}
                      </td>
                      <td
                        style={{
                          padding: "5px 6px",
                          fontSize: 11,
                          fontWeight: 700,
                          textAlign: "center",
                          color: "#0f172a",
                          fontFamily: "'DM Mono', monospace",
                        }}
                      >
                        {totalUTMins || ""}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Certification */}
              <div className="certification">
                <p className="cert-text">
                  I certify on my honor that the above is a true and correct
                  report of the hours of work performed, record of which was
                  made daily at the time of arrival and departure from office.
                </p>
                <div className="sig-area">
                  <div className="sig-block">
                    <span className="sig-label">Employee Signature</span>
                    <div className="sig-line" />
                    <div className="sig-name">{staffName}</div>
                  </div>
                  <div className="sig-block">
                    <span className="sig-label">
                      VERIFIED as to the prescribed office hours:
                    </span>
                    <div className="sig-line" />
                    <div className="sig-name">In Charge</div>
                  </div>
                </div>
                <p
                  style={{
                    fontSize: 10,
                    color: "#94a3b8",
                    marginTop: 14,
                    textAlign: "center",
                  }}
                >
                  (SEE INSTRUCTION ON BACK)
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
