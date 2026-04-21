import { useEffect, useMemo, useState } from "react";
import { getAttendanceRecords } from "../../services/attendanceService";

export default function ViewDTR() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        setLoading(true);
        const data = await getAttendanceRecords();
        setRecords(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        setError("Failed to load attendance records");
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((record) => record.name.toLowerCase().includes(q));
  }, [records, search]);

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 12 }}>Attendance Records</h2>
      <p style={{ marginBottom: 16, color: "#64748b" }}>
        Time in / time out with separate employee photos
      </p>

      <input
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

      {loading && <div>Loading records...</div>}
      {error && <div style={{ color: "#dc2626" }}>{error}</div>}

      {!loading && !error && (
        <div style={{ overflowX: "auto", background: "#fff", borderRadius: 8 }}>
          <table
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
                  <td style={tdStyle}>{record.name}</td>
                  <td style={tdStyle}>{record.date}</td>
                  <td style={tdStyle}>{record.time_in || "-"}</td>
                  <td style={tdStyle}>
                    {record.time_in_image ? (
                      <img
                        src={record.time_in_image}
                        alt={`${record.name} time in`}
                        style={photoStyle}
                      />
                    ) : (
                      <span style={{ color: "#94a3b8" }}>No image</span>
                    )}
                  </td>
                  <td style={tdStyle}>{record.time_out || "-"}</td>
                  <td style={tdStyle}>
                    {record.time_out_image ? (
                      <img
                        src={record.time_out_image}
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
