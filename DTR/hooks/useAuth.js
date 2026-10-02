import { useCallback, useSyncExternalStore } from "react";
import { getSnapshot, subscribe } from "../services/session";

export function useAuth() {
  const { token, user } = useSyncExternalStore(subscribe, getSnapshot);

  const can = useCallback(
    (...names) => names.some((n) => (user?.permissions ?? []).includes(n)),
    [user],
  );

  return { token, user, isAuthenticated: Boolean(token), can };
}
