import { api } from "./api";

export const recognizeFace = (images) =>
  api("/dtr/kiosk/recognize", {
    method: "POST",
    body: JSON.stringify({ images }),
  });

export const registerFace = (employeeNumber, images) =>
  api("/dtr/registration", {
    method: "POST",
    body: JSON.stringify({ employee_number: employeeNumber, images }),
  });

export const lookupEmployee = (employeeNumber) =>
  api(
    `/dtr/registration/lookup?${new URLSearchParams({ employee_number: employeeNumber })}`,
  );
