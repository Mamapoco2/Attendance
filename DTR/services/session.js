// Tiny auth session store. sessionStorage (not localStorage): the token disappears
// when the tab/browser closes, which suits shared and personal devices alike.
const TOKEN_KEY = "dtr:token";
const USER_KEY = "dtr:user";
const listeners = new Set();
let snapshot = read();

function read() {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const user = JSON.parse(sessionStorage.getItem(USER_KEY) || "null");
    return { token: token || null, user: token ? user : null };
  } catch {
    return { token: null, user: null };
  }
}

function emit() {
  snapshot = read();
  listeners.forEach((fn) => fn());
}

export const getToken = () => snapshot.token;
export const getSnapshot = () => snapshot;

export const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const setSession = (token, user) => {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user ?? null));
  emit();
};

export const setUser = (user) => {
  if (!snapshot.token) return;
  sessionStorage.setItem(USER_KEY, JSON.stringify(user ?? null));
  emit();
};

export const clearSession = () => {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  emit();
};
