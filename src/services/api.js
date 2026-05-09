// ============================================================
// FILE: frontend/bul-qc-app/src/services/api.js
// FIXES:
//   1. Increased timeout to 30s for slow connections
//   2. Automatic retry on timeout (up to 2 retries)
//   3. Keepalive ping every 10 minutes to prevent Render spin-down
// ============================================================

import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'https://bul-qc-backend.onrender.com/api';

const api = axios.create({
  baseURL        : BASE_URL,
  timeout        : 30000,   // 30 seconds
  headers        : { 'Content-Type': 'application/json' },
  withCredentials: false,
});

// ── Request interceptor: add auth token ───────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('bul_qc_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor: auto-retry on timeout ───────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;

    // Retry on timeout or network error (max 2 retries)
    const isTimeout  = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
    const isNetwork  = !error.response && error.message === 'Network Error';

    if ((isTimeout || isNetwork) && !config._retryCount) {
      config._retryCount = 0;
    }

    if ((isTimeout || isNetwork) && config._retryCount < 2) {
      config._retryCount += 1;
      console.log(`[API] Retrying request (attempt ${config._retryCount})...`);

      // Wait 2 seconds before retry
      await new Promise(res => setTimeout(res, 2000));
      return api(config);
    }

    return Promise.reject(error);
  }
);

// ── Keepalive: ping backend every 10 minutes ──────────────
// This prevents Render free tier from spinning down
// which causes the 50-second cold start delay
const pingBackend = async () => {
  try {
    await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
    console.log('[Keepalive] Backend pinged successfully');
  } catch (e) {
    // Silent fail — ping is best effort
  }
};

// Ping immediately on app load then every 10 minutes
pingBackend();
setInterval(pingBackend, 10 * 60 * 1000);

export default api;
