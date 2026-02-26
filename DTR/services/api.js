const BASE_URL = "http://localhost:8000/api";

export const api = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "API Error");
    }

    return await response.json();
  } catch (error) {
    console.error("API ERROR:", error);
    throw error;
  }
};
