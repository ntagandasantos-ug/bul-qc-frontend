// ============================================================
// FILE: frontend/bul-qc-app/src/context/AuthContext.jsx
// FIXES white screen on second login by validating token
// ============================================================

import React, {
  createContext, useContext, useState,
  useEffect, useCallback, useRef,
} from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

const TOKEN_KEY   = 'bul_qc_token';
const USER_KEY    = 'bul_qc_user';
const EXPIRES_KEY = 'bul_qc_expires';
const SIGNING_KEY = 'bul_qc_signing_as';

const clearStorage = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(EXPIRES_KEY);
  localStorage.removeItem(SIGNING_KEY);
};

export function AuthProvider({ children }) {
  const [user,      setUser]      = useState(null);
  const [signingAs, setSigningAs] = useState('');
  const [token,     setToken]     = useState(null);
  const [timeLeft,  setTimeLeft]  = useState('');
  const [loading,   setLoading]   = useState(true);
  const timerRef = useRef(null);

  const roleName     = user?.roles?.name || '';
  const isAdmin      = roleName === 'QC Head' || roleName === 'QC Assistant';
  const isSupervisor = roleName === 'Shift Supervisor';
  const isDeptHead   = roleName === 'Department Head' || roleName === 'Department Assistant';

  const formatTime = (ms) => {
    if (ms <= 0) return 'Expired';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h}h ${m}m ${s}s`;
  };

  const startTimer = useCallback((expiresAt) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const ms = new Date(expiresAt) - Date.now();
      if (ms <= 0) {
        clearInterval(timerRef.current);
        clearStorage();
        delete api.defaults.headers.common['Authorization'];
        setUser(null); setToken(null); setSigningAs(''); setTimeLeft('Expired');
      } else {
        setTimeLeft(formatTime(ms));
      }
    }, 1000);
  }, []);

  // ── Validate token is still accepted by backend ───────────
  const validateToken = async (savedToken) => {
    try {
      api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
      await api.get('/auth/me');
      return true;
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 || status === 403) return false;
      // Network error (server sleeping) — keep session
      return true;
    }
  };

  // ── Restore session on page load ──────────────────────────
  useEffect(() => {
    const restore = async () => {
      const savedToken     = localStorage.getItem(TOKEN_KEY);
      const savedUser      = localStorage.getItem(USER_KEY);
      const savedExpires   = localStorage.getItem(EXPIRES_KEY);
      const savedSigningAs = localStorage.getItem(SIGNING_KEY);

      if (!savedToken || !savedUser || !savedExpires) {
        clearStorage();
        setLoading(false);
        return;
      }

      const ms = new Date(savedExpires) - Date.now();
      if (ms <= 0) {
        clearStorage();
        setLoading(false);
        return;
      }

      // ── KEY FIX: Validate token before restoring ──────────
      const isValid = await validateToken(savedToken);
      if (!isValid) {
        console.log('[Auth] Stale token detected — clearing to prevent white screen');
        clearStorage();
        delete api.defaults.headers.common['Authorization'];
        setLoading(false);
        return;
      }

      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setToken(savedToken);
        setSigningAs(savedSigningAs || '');
        setTimeLeft(formatTime(ms));
        startTimer(savedExpires);
        api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
      } catch (e) {
        clearStorage();
      }

      setLoading(false);
    };

    restore();
  }, [startTimer]);

  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // ── LOGIN ──────────────────────────────────────────────────
  const login = async (username, password, signingAsName) => {
    clearStorage();
    delete api.defaults.headers.common['Authorization'];

    const response = await api.post('/auth/login', {
      username,
      password,
      signingAs: signingAsName || '',
    });

    const { token: newToken, user: newUser, expiresAt } = response.data;

    localStorage.setItem(TOKEN_KEY,   newToken);
    localStorage.setItem(USER_KEY,    JSON.stringify(newUser));
    localStorage.setItem(EXPIRES_KEY, expiresAt);
    localStorage.setItem(SIGNING_KEY, signingAsName || '');

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
    try { await api.post('/auth/logout'); } catch (e) {}
    if (timerRef.current) clearInterval(timerRef.current);
    clearStorage();
    delete api.defaults.headers.common['Authorization'];
    setUser(null); setToken(null); setSigningAs(''); setTimeLeft('');
  }, []);

  return (
    <AuthContext.Provider value={{
      user, signingAs, token, timeLeft, loading,
      isAdmin, isSupervisor, isDeptHead,
      login, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
