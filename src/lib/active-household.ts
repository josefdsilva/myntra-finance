import { useSyncExternalStore } from "react";

const KEY = "active-household-id";
const EVENT = "bynku:active-household-change";

function read(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

/**
 * The household id the user has picked as active on this device.
 * Persisted per-device in localStorage. Returns `null` before any explicit
 * selection — in that case the server picks a default (first membership).
 */
export function useActiveHouseholdId(): string | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

export function setActiveHouseholdId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(KEY, id);
    else window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}
