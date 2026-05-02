// ============================================================
// FILE: frontend/bul-qc-app/src/context/AuthContext.jsx
// Clean reset — simple reliable login flow
// ============================================================

import React, {
  createContext, useContext, useState,
  useEffect, useCallback, useRef,
} from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,      setUser]      = useState(null);
  const [signingAs, setSigningAs] = useState('');
  const [token,     setToken]     = useState(
    () => localStorage.getItem('bul_qc_token')
  );
  const [timeLeft,  setTimeLeft]  = useState('');
  const [loading,   setLoading]   = useState(true);
  const timerRef = useRef(null);

  // ── Roles ──────────────────────────────────────────────────
  const roleName   = user?.roles?.name || '';
  const isAdmin    = roleName === 'QC Head' || roleName === 'QC Assistant';
  const isSupervisor = roleName === 'Shift Supervisor';
  const isDeptHead = roleName === 'Department Head' || roleName === 'Department Assistant';

  // ── Format time remaining ──────────────────────────────────
  const formatTime = (ms) => {
    if (ms <= 0) return 'Expired';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h}h ${m}m ${s}s`;
  };

  // ── Start session countdown ────────────────────────────────
  const startTimer = useCallback((expiresAt) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const ms = new Date(expiresAt) - Date.now();
      if (ms <= 0) {
        setTimeLeft('Expired');
        clearInterval(timerRef.current);
        // Auto logout when session expires
        localStorage.removeItem('bul_qc_token');
        localStorage.removeItem('bul_qc_user');
        localStorage.removeItem('bul_qc_expires');
        localStorage.removeItem('bul_qc_signing_as');
        setUser(null);
        setToken(null);
        setSigningAs('');
      } else {
        setTimeLeft(formatTime(ms));
      }
    }, 1000);
  }, []);

  // ── Restore session on page load ──────────────────────────
  useEffect(() => {
    const savedToken     = localStorage.getItem('bul_qc_token');
    const savedUser      = localStorage.getItem('bul_qc_user');
    const savedExpires   = localStorage.getItem('bul_qc_expires');
    const savedSigningAs = localStorage.getItem('bul_qc_signing_as');

    if (savedToken && savedUser && savedExpires) {
      const ms = new Date(savedExpires) - Date.now();
      if (ms > 0) {
        try {
          const parsedUser = JSON.parse(savedUser);
          setUser(parsedUser);
          setToken(savedToken);
          setSigningAs(savedSigningAs || '');
          setTimeLeft(formatTime(ms));
          startTimer(savedExpires);
        } catch (e) {
          // Corrupted storage — clear it
          clearStorage();
        }
      } else {
        // Session expired
        clearStorage();
      }
    }
    setLoading(false);
  }, [startTimer]);

  // ── Set auth header on every request ─────────────────────
  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common['Authorization'];
    }
  }, [token]);

  const clearStorage = () => {
    localStorage.removeItem('bul_qc_token');
    localStorage.removeItem('bul_qc_user');
    localStorage.removeItem('bul_qc_expires');
    localStorage.removeItem('bul_qc_signing_as');
  };

  // ── LOGIN ──────────────────────────────────────────────────
  const login = async (username, password, signingAsName) => {
    const response = await api.post('/auth/login', {
      username,
      password,
      signingAs: signingAsName || '',
    });

    const { token: newToken, user: newUser, expiresAt } = response.data;

    // Save everything to localStorage so page refresh keeps you logged in
    localStorage.setItem('bul_qc_token',      newToken);
    localStorage.setItem('bul_qc_user',       JSON.stringify(newUser));
    localStorage.setItem('bul_qc_expires',    expiresAt);
    localStorage.setItem('bul_qc_signing_as', signingAsName || '');

    api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

    setToken(newToken);
    setUser(newUser);
    setSigningAs(signingAsName || '');

    const ms = new Date(expiresAt) - Date.now();
    setTimeLeft(formatTime(ms));
    startTimer(expiresAt);

    return response.data;
  };

  // ── LOGOUT ─────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Continue logout even if API call fails
    }
    if (timerRef.current) clearInterval(timerRef.current);
    clearStorage();
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
    setToken(null);
    setSigningAs('');
    setTimeLeft('');
  }, []);

  const value = {
    user,
    signingAs,
    token,
    timeLeft,
    loading,
    isAdmin,
    isSupervisor,
    isDeptHead,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
