import type { NuxtApp } from "#app";
import type { ComputedRef, Ref } from "vue";

type AuthSessionTimeoutOptions = {
  isAuthenticated: Ref<boolean> | ComputedRef<boolean>;
  logout: (returnTo?: string) => void;
};

const STORAGE_KEY_LAST_ACTIVITY = "auth:lastActivityAt";
const STORAGE_KEY_TIMED_OUT_AT = "auth:timedOutAt";
const DEFAULT_TIMEOUT_MINUTES = 30;
const ACTIVITY_THROTTLE_MS = 30 * 1000;
const ACTIVITY_EVENTS = ["click", "keydown", "mousedown", "mousemove", "scroll", "touchstart"];

export function installScbdAuthSessionTimeout(
  nuxtApp: NuxtApp,
  { isAuthenticated, logout }: AuthSessionTimeoutOptions,
) {
  if (!import.meta.client) return;

  const timeoutMs = getConfiguredTimeoutMs();
  if (timeoutMs <= 0) return;

  let lastRecordedActivityAt = Number(localStorage.getItem(STORAGE_KEY_LAST_ACTIVITY)) || 0;
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  let isTimingOut = false;

  const clearTimer = () => {
    if (timeoutTimer) clearTimeout(timeoutTimer);
    timeoutTimer = null;
  };

  const getLastActivityAt = () => Number(localStorage.getItem(STORAGE_KEY_LAST_ACTIVITY)) || 0;

  const timeout = () => {
    if (isTimingOut || !toValue(isAuthenticated)) return;

    isTimingOut = true;
    clearTimer();
    localStorage.setItem(STORAGE_KEY_TIMED_OUT_AT, String(Date.now()));
    localStorage.removeItem(STORAGE_KEY_LAST_ACTIVITY);
    logout(location.href);
  };

  const scheduleTimeout = () => {
    clearTimer();

    if (isTimingOut || !toValue(isAuthenticated)) return;

    const lastActivityAt = getLastActivityAt();

    if (!lastActivityAt) {
      recordActivity(true);
      return;
    }

    const remainingMs = timeoutMs - (Date.now() - lastActivityAt);

    if (remainingMs <= 0) {
      timeout();
      return;
    }

    timeoutTimer = setTimeout(timeout, remainingMs);
  };

  const recordActivity = (force = false) => {
    if (isTimingOut || !toValue(isAuthenticated)) return;

    const now = Date.now();

    if (!force && now - lastRecordedActivityAt < ACTIVITY_THROTTLE_MS) {
      return;
    }

    lastRecordedActivityAt = now;
    localStorage.setItem(STORAGE_KEY_LAST_ACTIVITY, String(now));
    scheduleTimeout();
  };

  const checkTimeout = () => {
    if (!toValue(isAuthenticated)) {
      clearTimer();
      return;
    }

    const lastActivityAt = getLastActivityAt();

    if (!lastActivityAt) {
      recordActivity(true);
      return;
    }

    if (Date.now() - lastActivityAt >= timeoutMs) {
      timeout();
      return;
    }

    scheduleTimeout();
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY_TIMED_OUT_AT && event.newValue) {
      timeout();
      return;
    }

    if (event.key === STORAGE_KEY_LAST_ACTIVITY) {
      lastRecordedActivityAt = Number(event.newValue) || 0;
      scheduleTimeout();
    }
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") checkTimeout();
  };

  const onActivity = () => recordActivity();

  const stopAuthWatch = watch(isAuthenticated, (authenticated) => {
    if (authenticated) {
      isTimingOut = false;
      checkTimeout();
    } else {
      clearTimer();
    }
  }, { immediate: true });

  for (const eventName of ACTIVITY_EVENTS) {
    window.addEventListener(eventName, onActivity, { passive: true });
  }

  window.addEventListener("focus", checkTimeout);
  window.addEventListener("storage", onStorage);
  document.addEventListener("visibilitychange", onVisibilityChange);
  const removePageHook = nuxtApp.hook("page:finish", () => recordActivity(true));

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      clearTimer();
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
