import { api } from "./api";

/**
 * Register a new face
 * @param {string} name
 * @param {string} employeeNumber
 * @param {string} imageBase64
 */
export const registerFace = async (name, employeeNumber, imageBase64) => {
  return api("/register-face", {
    method: "POST",
    body: JSON.stringify({
      name,
      employee_number: employeeNumber,
      image: imageBase64,
    }),
  });
};

/**
 * Recognize face
 * @param {string} imageBase64
 */
export const recognizeFace = async (imageBase64) => {
  return api("/recognize-face", {
    method: "POST",
    body: JSON.stringify({
      image: imageBase64,
    }),
  });
};
