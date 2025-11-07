export const isActuallyOnline = async (): Promise<boolean> => {
  if (!navigator.onLine) return false;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

    const res = await fetch('/api/health', {
      cache: 'no-cache',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    return res.ok;
  } catch (err) {
    console.warn('⚠️ Online check failed:', err);
    return false;
  }
};