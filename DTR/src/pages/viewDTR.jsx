import { useEffect, useMemo, useState } from "react";
import { getAttendanceRecords } from "../../services/attendanceService";
import AuthImage from "../components/AuthImage";

function formatTime12h(value) {
  if (!value) return "";
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return String(value);
  const hours = Number(match[1]);
  if (hours > 23) return String(value);
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${String(hours % 12 || 12).padStart(2, "0")}:${match[2]} ${suffix}`;
}

export default function ViewDTR() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        setLoading(true);
        const data = await getAttendanceRecords({
          from: dateFrom,
          to: dateTo,
        });
        setRecords(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        setError(err?.message || "Failed to load attendance records");
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, [dateFrom, dateTo]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((record) => {
      const matchesName = !q || record.name.toLowerCase().includes(q);
      const recordDate = record.date ? new Date(record.date) : null;
      const fromDate = dateFrom ? new Date(dateFrom) : null;
      const toDate = dateTo ? new Date(dateTo) : null;

      if (toDate) {
        toDate.setHours(23, 59, 59, 999);
      }

      const matchesFrom = !fromDate || (recordDate && recordDate >= fromDate);
      const matchesTo = !toDate || (recordDate && recordDate <= toDate);

      return matchesName && matchesFrom && matchesTo;
    });
  }, [records, search, dateFrom, dateTo]);

  return (
    <div className="view-dtr-page" style={{ padding: 24 }}>
      <style>{VIEW_DTR_RESPONSIVE_CSS}</style>
      <h2 style={{ marginBottom: 12 }}>Attendance Records</h2>
      <p style={{ marginBottom: 16, color: "#64748b" }}>
        Time in / time out with separate employee photos
      </p>

      <input
        className="view-dtr-search"
        type="text"
        placeholder="Search employee name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%",
          maxWidth: 320,
          marginBottom: 16,
          padding: "10px 12px",
          border: "1px solid #d1d5db",
          borderRadius: 8,
        }}
      />
      <div
        className="view-dtr-dates"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          style={dateInputStyle}
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          style={dateInputStyle}
        />
      </div>

      {loading && <div>Loading records...</div>}
      {error && <div style={{ color: "#dc2626" }}>{error}</div>}

      {!loading && !error && (
        <div className="view-dtr-wrap" style={{ overflowX: "auto", background: "#fff", borderRadius: 8 }}>
          <table
            className="view-dtr-table"
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: 980,
            }}
          >
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Time In</th>
                <th style={thStyle}>Time In Photo</th>
                <th style={thStyle}>Time Out</th>
                <th style={thStyle}>Time Out Photo</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((record) => (
                <tr key={record.id}>
                  <td data-label="Name" style={tdStyle}>{record.name}</td>
                  <td data-label="Date" style={tdStyle}>{record.date}</td>
                  <td data-label="Time In" style={tdStyle}>
                    {formatTime12h(record.time_in) || "-"}
                  </td>
                  <td data-label="Time In Photo" style={tdStyle}>
                    {record.has_time_in_image ? (
                      <AuthImage
                        attendanceId={record.id}
                        type="in"
                        alt={`${record.name} time in`}
                        style={photoStyle}
                      />
                    ) : (
                      <span style={{ color: "#94a3b8" }}>No image</span>
                    )}
                  </td>
                  <td data-label="Time Out" style={tdStyle}>
                    {formatTime12h(record.time_out) || "-"}
                  </td>
                  <td data-label="Time Out Photo" style={tdStyle}>
                    {record.has_time_out_image ? (
                      <AuthImage
                        attendanceId={record.id}
                        type="out"
                        alt={`${record.name} time out`}
                        style={photoStyle}
                      />
                    ) : (
                      <span style={{ color: "#94a3b8" }}>No image</span>
                    )}
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td style={tdStyle} colSpan={6}>
                    No attendance records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const VIEW_DTR_RESPONSIVE_CSS = `
  .view-dtr-page input { font-size: 16px; box-sizing: border-box; }
  @media (max-width: 720px) {
    .view-dtr-page { padding: 14px !important; }
    .view-dtr-search { max-width: none !important; }
    .view-dtr-dates input { flex: 1 1 140px; max-width: none !important; }
    .view-dtr-wrap { background: transparent !important; overflow: visible !important; }
    .view-dtr-table { min-width: 0 !important; }
    .view-dtr-table thead { display: none; }
    .view-dtr-table, .view-dtr-table tbody, .view-dtr-table tr { display: block; width: 100%; }
    .view-dtr-table tr {
      background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
      margin-bottom: 12px; overflow: hidden;
    }
    .view-dtr-table td {
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px; text-align: right;
      padding: 10px 14px !important;
      border-bottom: 1px solid #f1f5f9 !important;
    }
    .view-dtr-table td:last-child { border-bottom: 0 !important; }
    .view-dtr-table td::before {
      content: attr(data-label); flex-shrink: 0;
      font-size: 11.5px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.04em; color: #64748b; text-align: left;
    }
    .view-dtr-table td[colspan] { display: block; text-align: center; }
    .view-dtr-table td[colspan]::before { content: none; }
  }
`;

const thStyle = {
  textAlign: "left",
  padding: "12px 14px",
  borderBottom: "1px solid #e2e8f0",
  color: "#334155",
  fontSize: 13,
};

const tdStyle = {
  padding: "12px 14px",
  borderBottom: "1px solid #f1f5f9",
  fontSize: 14,
  color: "#0f172a",
};

const photoStyle = {
  width: 72,
  height: 72,
  objectFit: "cover",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
};

const dateInputStyle = {
  width: "100%",
  maxWidth: 220,
  padding: "10px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 8,
};
