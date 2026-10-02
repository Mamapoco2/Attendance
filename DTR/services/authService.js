import { api } from "./api";
import { clearSession, setSession, setUser } from "./session";

export const login = async (username, password) => {
  const data = await api("/login", {
    method: "POST",
    body: JSON.stringify({ username: username.trim().toUpperCase(), password }),
  });
  setSession(data.token, data.user);
  return data.user;
};

export const refreshUser = async () => {
  const data = await api("/me");
  setUser(data.user);
  return data.user;
};

export const logout = async () => {
  try {
    await api("/logout", { method: "POST" });
  } catch {
  } finally {
    clearSession();
  }
};
