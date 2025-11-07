import axios from 'axios'
export const isActuallyOnline = async () => {
  if (!navigator.onLine) return false;

  try {
    const res = await axios.get('/api/health', { timeout: 3000 });
    return res.status === 200;
  } catch {
    return false;
  }
};