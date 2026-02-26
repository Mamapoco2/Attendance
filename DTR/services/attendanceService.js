import { api } from "./api";

export const recordAttendance = async (name) => {
  return api("/attendance", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
};
