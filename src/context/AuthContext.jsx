import React, {
  createContext, useState, useEffect,
  useContext, useCallback,
} from 'react';
import { authService } from '../services/auth.service';
import { toast }        from 'react-toastify';

const AuthContext = createContext(null);

// Helper: safely parse JSON from localStorage
const getLocal = (key, fallback = null) => {
  try {
    const val = localStorage.getItem(key);
    if (!val) return fallback;
    return JSON.parse(val);
  } catch {
    return localStorage.getItem(key) || fallback;
  }
};

export function AuthProvider({ children }) {
  const [user,          setUser]          = useState(() => getLocal('bul_qc_user'));
  const [token,         setToken]         = useState(() => localStorage.getItem('bul_qc_token'));
  const [signingAs,     setSigningAs]     = useState(() => localStorage.getItem('bul_qc_signing_as'));
  const [sessionExpiry, setSessionExpiry] = useState(() => localStorage.getItem('bul_qc_expiry'));
  const [loading,       setLoading]       = useState(true);
  const [timeLeft,      setTimeLeft]      = useState('');

  // ── On app start: verify token is still valid ────────────
  useEffect(() => {
    const savedToken = localStorage.getItem('bul_qc_token');
    const savedUser  = getLocal('bul_qc_user');

    if (!savedToken) {
      setLoading(false);
      return;
    }

    // If we already have user data, show the app immediately
    // and verify in the background
    if (savedUser) {
      setUser(savedUser);
      setToken(savedToken);
      setLoading(false);

      // Background verification
      authService.getMe()
        .then(data => {
          setUser(data.user);
          localStorage.setItem('bul_qc_user', JSON.stringify(data.user));
        })
        .catch((err) => {
          const code = err.response?.data?.code;
          // Only force logout on actual session expired errors
          // NOT on network errors (backend might be restarting)
          if (code === 'SHIFT_EXPIRED' || code === 'SESSION_NOT_FOUND') {
            clearSession('expired');
          }
          // For network errors, keep user logged in
        });
    } else {
      // No cached user data — must verify
      authService.getMe()
        .then(data => {
          setUser(data.user);
          setToken(savedToken);
          localStorage.setItem('bul_qc_user', JSON.stringify(data.user));
        })
        .catch(() => {
          // Cannot verify — clear everything
          clearSession();
        })
        .finally(() => setLoading(false));
    }
  }, []);

  // ── Session countdown timer ──────────────────────────────
  useEffect(() => {
    if (!sessionExpiry) return;

    const interval = setInterval(() => {
      const diff = new Date(sessionExpiry) - new Date();
      if (diff <= 0) {
        clearSession('expired');
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000)   / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);

      if (diff < 1800000 && diff > 1798000) {
        toast.warning('⏰ 30 minutes left in your shift session!');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionExpiry]);

  const clearSession = useCallback((reason) => {
    setUser(null);
    setToken(null);
    setSigningAs(null);
    setSessionExpiry(null);
    setTimeLeft('');
    localStorage.removeItem('bul_qc_token');
    localStorage.removeItem('bul_qc_expiry');
    localStorage.removeItem('bul_qc_signing_as');
    localStorage.removeItem('bul_qc_user');

    if (reason === 'expired') {
      toast.error('⏰ Your 12-hour shift has ended. You have been logged out.');
    }
  }, []);

  const login = useCallback(async (username, password, signingAsName) => {
    const data = await authService.login(username, password, signingAsName);

    // Save everything to localStorage so it survives page refresh
    setToken(data.token);
    setUser(data.user);
    setSessionExpiry(data.expiresAt);

    localStorage.setItem('bul_qc_token',  data.token);
    localStorage.setItem('bul_qc_expiry', data.expiresAt);
    localStorage.setItem('bul_qc_user',   JSON.stringify(data.user));

    if (signingAsName?.trim()) {
      setSigningAs(signingAsName.trim());
      localStorage.setItem('bul_qc_signing_as', signingAsName.trim());
    }

    toast.success(`Welcome, ${data.user.full_name}!`);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try { await authService.logout(); } catch (e) { /* ignore */ }
    clearSession();
    toast.info('Logged out successfully.');
  }, [clearSession]);

  const roleName     = user?.roles?.name || '';
  const isAdmin      = roleName === 'QC Head' || roleName === 'QC Assistant';
  const isSupervisor = roleName === 'Shift Supervisor';
  const isAnalyst    = roleName === 'Analyst';
  const isSampler    = roleName === 'Sampler';
  const isDeptHead   = roleName === 'Department Head' || roleName === 'Department Assistant';
  const canSubmitResults  = isAdmin || isSupervisor || isAnalyst || !!signingAs;
  const canRegisterSamples= isAdmin || isSupervisor || isAnalyst || isSampler || !!signingAs;

  return (
    <AuthContext.Provider value={{
      user, token, signingAs, loading,
      sessionExpiry, timeLeft,
      login, logout, clearSession,
      roleName, isAdmin, isSupervisor,
      isAnalyst, isSampler, isDeptHead,
      canSubmitResults, canRegisterSamples,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};