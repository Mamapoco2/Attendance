import { api } from "./api";

/**
 * Register a new face using multiple captured frames
 * @param {string} name
 * @param {string} employeeNumber
 * @param {string[]} images - array of base64 data-URLs (5-10 frames)
 */
export const registerFace = async (name, employeeNumber, images) => {
  return api("/register-face", {
    method: "POST",
    body: JSON.stringify({
      name,
      employee_number: employeeNumber,
      images, // ← plural, matches Laravel's validation rule
    }),
  });
};

/**
 * Recognize a face using multiple captured frames
 * @param {string[]} images - array of base64 data-URLs (3-5 frames)
 */
export const recognizeFace = async (images) => {
  return api("/recognize-face", {
    method: "POST",
    body: JSON.stringify({
      images, // ← plural, matches Laravel's validation rule
    }),
  });
};
