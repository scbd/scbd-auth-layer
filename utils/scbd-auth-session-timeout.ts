import type { NuxtApp } from "#app";
import type { ComputedRef, Ref } from "vue";

type AuthSessionTimeoutOptions = {
  isAuthenticated: Ref<boolean> | ComputedRef<boolean>;
  logout: (returnTo?: string) => void;
};

// Shared across tabs: updating it extends the session, removing it ends the session.
const STORAGE_KEY_LAST_ACTIVITY = "auth:lastActivityAt";
const DEFAULT_TIMEOUT_MINUTES = 30;
const TIMEOUT_CHECK_INTERVAL_MS = 5 * 1000;
const ACTIVITY_THROTTLE_MS = 30 * 1000;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll"];

export function installScbdAuthSessionTimeout(
  nuxtApp: NuxtApp,
  { isAuthenticated, logout }: AuthSessionTimeoutOptions,
) {
  // Browser-only: this installer uses window, document, localStorage, and location.
  if (!import.meta.client) return;

  const timeoutMs = getConfiguredTimeoutMs();
  if (timeoutMs <= 0) return;


  // === State ===

  // Local throttle bookkeeping only; localStorage is the source of truth.
  let lastActivityWriteAt = getStoredLastActivityAt();
  // Prevent timeout-triggered logout/navigation from recording fresh activity.
  let isTimingOut = false;


  // === Session activity ===

  const timeout = () => {
    if (isTimingOut || !toValue(isAuthenticated)) return;

    isTimingOut = true;
    clearStoredLastActivityAt();
    logout(location.href);
  };

  const startActivityWindow = () => {
    const now = Date.now();

    lastActivityWriteAt = now;
    setStoredLastActivityAt(now);
  };

  const recordActivity = (force = false) => {
    if (isTimingOut || !toValue(isAuthenticated)) return;

    const now = Date.now();

    if (!force && now - lastActivityWriteAt < ACTIVITY_THROTTLE_MS) {
      return;
    }

    lastActivityWriteAt = now;
    setStoredLastActivityAt(now);
  };

  const checkTimeout = () => {
    if (!toValue(isAuthenticated)) {
      return;
    }

    const lastActivityAt = getStoredLastActivityAt();

    if (!lastActivityAt) {
      startActivityWindow();
      return;
    }

    if (Date.now() - lastActivityAt >= timeoutMs) {
      timeout();
    }
  };


  // === Browser events ===

  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY_LAST_ACTIVITY) {
      // Another tab timed out and removed the shared activity marker.
      if (event.newValue === null) {
        timeout();
        return;
      }

      lastActivityWriteAt = parseStoredActivityAt(event.newValue);
      checkTimeout();
    }
  };

  const onVisibilityChange = () => {
    // Timers can drift or pause in background tabs, so re-check when the tab returns.
    if (document.visibilityState === "visible") checkTimeout();
  };

  const onActivity = () => recordActivity();


  // === Wiring ===

  const stopAuthWatch = watch(isAuthenticated, (authenticated, wasAuthenticated) => {
    if (authenticated) {
      isTimingOut = false;

      if (wasAuthenticated === false) {
        startActivityWindow();
        return;
      }

      checkTimeout();
    }
  }, { immediate: true });

  const timeoutInterval = setInterval(checkTimeout, TIMEOUT_CHECK_INTERVAL_MS);

  for (const eventName of ACTIVITY_EVENTS) {
    window.addEventListener(eventName, onActivity, { passive: true });
  }

  window.addEventListener("focus", checkTimeout);
  window.addEventListener("storage", onStorage);
  document.addEventListener("visibilitychange", onVisibilityChange);
  // Treat completed in-app navigation as activity, even without a direct DOM event.
  const removePageHook = nuxtApp.hook("page:finish", () => recordActivity(true));

  // Dev-only HMR cleanup: avoid duplicate timers/listeners after Vite swaps this module.
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      clearInterval(timeoutInterval);
      stopAuthWatch();
      removePageHook();

      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, onActivity);
      }

      window.removeEventListener("focus", checkTimeout);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    });
  }
}


// === Configuration ===

function getConfiguredTimeoutMs() {
  const publicConfig = useRuntimeConfig().public as Record<string, unknown>;
  const configuredMinutes = publicConfig.authInactivityTimeoutMinutes;

  if (configuredMinutes === false) return 0;

  const timeoutMinutes = Number(configuredMinutes ?? DEFAULT_TIMEOUT_MINUTES);

  if (!Number.isFinite(timeoutMinutes) || timeoutMinutes <= 0) {
    return 0;
  }

  return timeoutMinutes * 60 * 1000;
}


// === Activity storage ===

function getStoredLastActivityAt() {
  return parseStoredActivityAt(localStorage.getItem(STORAGE_KEY_LAST_ACTIVITY));
}

function setStoredLastActivityAt(timestamp: number) {
  localStorage.setItem(STORAGE_KEY_LAST_ACTIVITY, String(timestamp));
}

function clearStoredLastActivityAt() {
  localStorage.removeItem(STORAGE_KEY_LAST_ACTIVITY);
}

function parseStoredActivityAt(value: string | null) {
  return Number(value) || 0;
}
