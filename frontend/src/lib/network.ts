let lastKnownOnline = false;
let lastCheckTime = 0;
let checkingPromise: Promise<boolean> | null = null;

export const isActuallyOnline = async (): Promise<boolean> => {
  // ✅ Basic offline shortcut
  if (!navigator.onLine) {
    lastKnownOnline = false;
    return false;
  }

  // ✅ Debounce frequent checks (avoid hammering /api/health)
  const now = Date.now();
  if (now - lastCheckTime < 5000) { // Only check every 5s max
    return lastKnownOnline;
  }

  // If a check is already in progress, return that promise
  if (checkingPromise) return checkingPromise;

  // ✅ Actual check with retries
  checkingPromise = (async () => {
    const tryFetch = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const res = await fetch("/api/health", {
          cache: "no-cache",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return res.ok;
      } catch {
        clearTimeout(timeoutId);
        return false;
      }
    };

    // Retry logic (2 attempts, 2s apart)
    for (let i = 0; i < 2; i++) {
      const ok = await tryFetch();
      if (ok) {
        lastKnownOnline = true;
        lastCheckTime = Date.now();
        checkingPromise = null;
        return true;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }

    // If all retries fail, mark offline
    lastKnownOnline = false;
    lastCheckTime = Date.now();
    checkingPromise = null;
    return false;
  })();

  return checkingPromise;
};