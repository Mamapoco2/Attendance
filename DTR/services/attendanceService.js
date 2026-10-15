import { api } from "./api";

export const recordAttendance = (ticket, image) =>
  api("/dtr/kiosk/punch", {
    method: "POST",
    body: JSON.stringify({ ticket, image }),
  });

export const getAttendanceRecords = async ({ from, to, q } = {}) => {
  const params = new URLSearchParams({ per_page: "500" });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (q) params.set("q", q);

  const data = await api(`/dtr/records?${params}`);
  return Array.isArray(data?.data) ? data.data : [];
};