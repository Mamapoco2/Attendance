import { api } from "./api";

/**
 * Register a new face
 * @param {string} name
 * @param {string} imageBase64
 */
export const registerFace = async (name, imageBase64) => {
  return api("/register-face", {
    method: "POST",
    body: JSON.stringify({
      name,
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
