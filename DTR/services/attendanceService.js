import { api } from "./api";

export const recordAttendance = async (name, image) => {
  return api("/attendance", {
    method: "POST",
    body: JSON.stringify({ name, image }),
  });
};

export const getAttendanceRecords = async () => {
  return api("/attendance-records");
};

export const getEmployeeDtr = async (employeeNumber, month, year) => {
  const params = new URLSearchParams({
    employee_number: employeeNumber,
    month: String(month),
    year: String(year),
  });

  return api(`/employee-dtr?${params.toString()}`);
};

export const getEmployeeDtrCutoff = async (employeeNumber, month, year) => {
  const params = new URLSearchParams({
    employee_number: employeeNumber,
    month: String(month),
    year: String(year),
  });

  return api(`/employee-dtr-cutoff?${params.toString()}`);
};
