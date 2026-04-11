import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Automatically attach the token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('bul_qc_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle expired session globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const code = error.response?.data?.code;
    if (
      error.response?.status === 401 &&
      (code === 'SHIFT_EXPIRED' || code === 'SESSION_NOT_FOUND')
    ) {
      localStorage.removeItem('bul_qc_token');
      localStorage.removeItem('bul_qc_expiry');
      localStorage.removeItem('bul_qc_signing_as');
      window.location.href = '/login?reason=expired';
    }
    return Promise.reject(error);
  }
);

export default api;