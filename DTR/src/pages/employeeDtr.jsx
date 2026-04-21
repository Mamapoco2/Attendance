import { useMemo, useState } from "react";
import { getEmployeeDtrCutoff } from "../../services/attendanceService";

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

const currentDate = new Date();
const currentMonth = currentDate.getMonth() + 1;
const currentYear = currentDate.getFullYear();

export default function EmployeeDtr() {
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const leftEntriesByDay = useMemo(() => {
    const map = new Map();
    (result?.left_entries || []).forEach((entry) => map.set(entry.day, entry));
    return map;
  }, [result]);

  const rightEntriesByDay = useMemo(() => {
    const map = new Map();
    (result?.right_entries || []).forEach((entry) => map.set(entry.day, entry));
    return map;
  }, [result]);

  const handleLoad = async () => {
    if (!employeeNumber.trim()) {
      setError("Employee number is required");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const data = await getEmployeeDtrCutoff(employeeNumber.trim(), month, year);
      setResult(data);
      if (!data.employee) {
        setError("No employee found for that employee number");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load DTR");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="employee-dtr-page" style={{ padding: 24, display: "flex", justifyContent: "center" }}>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 6mm; }
          body { background: #fff !important; }
          .navbar, .employee-dtr-controls, .employee-dtr-error, .employee-dtr-cutoff {
            display: none !important;
          }
          .employee-dtr-page {
            padding: 0 !important;
            display: block !important;
          }
          .employee-dtr-container {
            max-width: none !important;
            width: 100% !important;
          }
          .employee-dtr-paper {
            border: none !important;
            padding: 0 !important;
          }
          .employee-dtr-copies {
            gap: 4mm !important;
            grid-template-columns: 1fr 1fr !important;
          }
          .employee-dtr-copy {
            transform: scale(0.96);
            transform-origin: top left;
          }
          .employee-dtr-copy:nth-child(2) {
            transform-origin: top right;
          }
        }
      `}</style>
      <div className="employee-dtr-container" style={{ width: "100%", maxWidth: 980 }}>
        <div
          className="employee-dtr-controls"
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: 14,
            marginBottom: 16,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "end",
          }}
        >
          <div>
            <label style={labelStyle}>Employee Number</label>
            <input
              style={inputStyle}
              value={employeeNumber}
              onChange={(e) => setEmployeeNumber(e.target.value)}
              placeholder="EMP-0001"
            />
          </div>
          <div>
            <label style={labelStyle}>Month</label>
            <select
              style={inputStyle}
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Year</label>
            <input
              style={{ ...inputStyle, width: 110 }}
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </div>
          <button style={btnStyle} onClick={handleLoad} disabled={loading}>
            {loading ? "Loading..." : "View DTR"}
          </button>
          <button style={btnSecondaryStyle} onClick={() => window.print()}>
            Print
          </button>
        </div>

        {error && (
          <div className="employee-dtr-error" style={{ color: "#dc2626", marginBottom: 10, fontSize: 14 }}>
            {error}
          </div>
        )}

        <div className="employee-dtr-paper" style={paperStyle}>
          <div className="employee-dtr-cutoff" style={cutoffRowStyle}>
            <span style={cutoffLabelStyle}>Cutoff:</span>
            <span style={cutoffTextStyle}>
              {formatDateRange(result?.left_range)} |{" "}
              {formatDateRange(result?.right_range)}
            </span>
          </div>

          <div className="employee-dtr-copies" style={copiesWrapStyle}>
            <DtrCopy
              employeeName={result?.employee?.name || ""}
              employeeNumber={result?.employee?.employee_number || employeeNumber}
              month={month}
              year={year}
              entriesByDay={leftEntriesByDay}
            />
            <DtrCopy
              employeeName={result?.employee?.name || ""}
              employeeNumber={result?.employee?.employee_number || employeeNumber}
              month={month}
              year={year}
              entriesByDay={rightEntriesByDay}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function DtrCopy({ employeeName, employeeNumber, month, year, entriesByDay }) {
  return (
      <div className="employee-dtr-copy" style={copyStyle}>
      <div style={formNoStyle}>Civil Service Form No. 4B</div>
      <div style={titleStyle}>DAILY TIME RECORD</div>
      <div style={oooStyle}>-----o0o-----</div>

      <div style={nameLineStyle}>
        <span style={nameLineValue}>{employeeName}</span>
        <span style={nameLineLabel}>(Name)</span>
      </div>

      <div style={detailsGridStyle}>
        <div>
          <div style={smallLabelStyle}>For the month of</div>
          <div style={lineStyle}>{`${MONTHS[month - 1]} ${year}`}</div>
          <div style={smallLabelStyle}>Official hours for arrival and departure</div>
          <div style={lineStyle}>8:00 AM - 5:00 PM</div>
        </div>
        <div>
          <div style={smallLabelStyle}>Regular days</div>
          <div style={lineStyle}>Mon - Fri</div>
          <div style={smallLabelStyle}>Saturdays</div>
          <div style={lineStyle}>As Needed</div>
          <div style={{ ...smallLabelStyle, marginTop: 6 }}>Employee No.</div>
          <div style={lineStyle}>{employeeNumber}</div>
        </div>
      </div>

      <table style={tableStyle}>
        <thead>
          <tr>
            <th rowSpan={2} style={thStyle}>
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
          <tr>
            <th style={thStyle}>Arrival</th>
            <th style={thStyle}>Departure</th>
            <th style={thStyle}>Arrival</th>
            <th style={thStyle}>Departure</th>
            <th style={thStyle}>Hours</th>
            <th style={thStyle}>Minutes</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 31 }).map((_, idx) => {
            const day = idx + 1;
            const entry = entriesByDay.get(day);
            return (
              <tr key={day}>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{day}</td>
                <td style={tdStyle}>{entry?.am_arrival || ""}</td>
                <td style={tdStyle}>{entry?.am_departure || ""}</td>
                <td style={tdStyle}>{entry?.pm_arrival || ""}</td>
                <td style={tdStyle}>{entry?.pm_departure || ""}</td>
                <td style={tdStyle} />
                <td style={tdStyle} />
              </tr>
            );
          })}
          <tr>
            <td colSpan={5} style={{ ...tdStyle, textAlign: "right", paddingRight: 8 }}>
              Total
            </td>
            <td style={tdStyle} />
            <td style={tdStyle} />
          </tr>
        </tbody>
      </table>

      <p style={certStyle}>
        I certify on my honor that the above is a true and correct report of the
        hours of work performed, record of which was made daily at the time of
        arrival and departure from office.
      </p>

      <div style={verifyLineStyle}>VERIFIED as to the prescribed office hours:</div>
      <div style={inChargeLineStyle} />
      <div style={inChargeTextStyle}>In Charge</div>
    </div>
  );
}

function formatDateRange(range) {
  if (!range?.start || !range?.end) return "MM/DD/YYYY - MM/DD/YYYY";
  const start = new Date(range.start);
  const end = new Date(range.end);
  const s = `${String(start.getMonth() + 1).padStart(2, "0")}/${String(start.getDate()).padStart(2, "0")}/${start.getFullYear()}`;
  const e = `${String(end.getMonth() + 1).padStart(2, "0")}/${String(end.getDate()).padStart(2, "0")}/${end.getFullYear()}`;
  return `${s} - ${e}`;
}

const labelStyle = { display: "block", marginBottom: 6, fontSize: 12, color: "#64748b" };
const inputStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "8px 10px",
  minWidth: 150,
};
const btnStyle = {
  background: "#0ea5e9",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "8px 16px",
  cursor: "pointer",
};
const btnSecondaryStyle = {
  background: "#fff",
  color: "#0f172a",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "8px 16px",
  cursor: "pointer",
};
const paperStyle = {
  background: "#fff",
  border: "1px solid #d1d5db",
  padding: 16,
  fontFamily: "Arial, sans-serif",
};
const cutoffRowStyle = { marginBottom: 12, fontSize: 13 };
const cutoffLabelStyle = { fontWeight: 700, marginRight: 6 };
const cutoffTextStyle = { fontFamily: "monospace" };
const copiesWrapStyle = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };
const copyStyle = { border: "1px solid #111", padding: 10 };
const formNoStyle = { fontSize: 11, marginBottom: 6, fontStyle: "italic" };
const titleStyle = { textAlign: "center", fontWeight: 700, fontSize: 30 / 2, letterSpacing: 1 };
const oooStyle = { textAlign: "center", fontSize: 11, marginBottom: 8 };
const nameLineStyle = { borderTop: "1px solid #111", borderBottom: "1px solid #111", height: 32, position: "relative", marginBottom: 8 };
const nameLineValue = { position: "absolute", top: 6, left: 8, fontSize: 12, fontWeight: 600 };
const nameLineLabel = { position: "absolute", top: 18, left: "45%", fontSize: 10, fontWeight: 700 };
const detailsGridStyle = { display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 8, marginBottom: 8 };
const smallLabelStyle = { fontSize: 10, fontWeight: 700 };
const lineStyle = { borderBottom: "1px solid #111", minHeight: 16, fontSize: 11, marginBottom: 4 };
const tableStyle = { width: "100%", borderCollapse: "collapse", marginTop: 4 };
const thStyle = { border: "1px solid #111", padding: "1px 2px", fontSize: 10, fontWeight: 700, textAlign: "center" };
const tdStyle = { border: "1px solid #111", padding: "1px 2px", fontSize: 10, textAlign: "center", height: 16 };
const certStyle = { fontSize: 9, marginTop: 8, fontStyle: "italic", lineHeight: 1.2 };
const verifyLineStyle = { marginTop: 16, fontSize: 10, fontStyle: "italic" };
const inChargeLineStyle = { marginTop: 20, borderTop: "1px solid #111" };
const inChargeTextStyle = { marginTop: 4, fontSize: 10, textAlign: "center", fontStyle: "italic" };
