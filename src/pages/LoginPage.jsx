import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth }       from '../context/AuthContext';
import { authService }   from '../services/auth.service';
import api               from '../services/api';
import { toast }         from 'react-toastify';

// ── Shared inline styles (no Tailwind animations) ─────────
const card = {
  background: '#ffffff', borderRadius: '20px',
  boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
  overflow: 'hidden', width: '100%', maxWidth: '380px',
};
const headerStrip = {
  background: '#003087', padding: '28px 24px',
  textAlign: 'center',
};
const iconBox = {
  width: '64px', height: '64px', background: '#FFB81C',
  borderRadius: '16px', display: 'flex', alignItems: 'center',
  justifyContent: 'center', margin: '0 auto 12px',
  fontSize: '28px',
};
const inputSt = {
  width: '100%', border: '1.5px solid #D1D5DB',
  borderRadius: '10px', padding: '11px 14px',
  fontSize: '14px', color: '#111827',
  backgroundColor: '#fff', fontFamily: 'inherit',
  boxSizing: 'border-box', cursor: 'text',
  pointerEvents: 'auto',
};
const btnPrimary = (disabled) => ({
  width: '100%', background: disabled ? '#93A3B8' : '#003087',
  color: '#fff', border: 'none', borderRadius: '12px',
  padding: '13px', fontSize: '15px', fontWeight: '600',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: 'inherit', marginTop: '6px',
  pointerEvents: 'auto',
});
const btnLink = {
  background: 'none', border: 'none', color: '#003087',
  fontSize: '13px', cursor: 'pointer', textDecoration: 'underline',
  fontFamily: 'inherit', padding: 0,
  pointerEvents: 'auto',
};
const fieldWrap = { marginBottom: '14px' };
const labelSt = {
  display: 'block', fontSize: '12px',
  fontWeight: '600', color: '#374151', marginBottom: '5px',
};
const errBox = {
  background: '#FEF2F2', border: '1.5px solid #FECACA',
  borderRadius: '10px', padding: '10px 14px',
  color: '#DC2626', fontSize: '13px', marginBottom: '14px',
};

// ════════════════════════════════════════════════════════════
export default function LoginPage() {
  const { login, user }    = useAuth();
  const navigate           = useNavigate();
  const [searchParams]     = useSearchParams();

  // Which panel is showing
  // 'login' | 'forgot' | 'change_username' | 'change_password'
  const [panel, setPanel]       = useState('login');
  const [error, setError]       = useState('');
  const [busy,  setBusy]        = useState(false);
  const [okMsg, setOkMsg]       = useState('');

  // Login fields
  const [username,  setUsername]  = useState('');
  const [password,  setPassword]  = useState('');
  const [signingAs, setSigningAs] = useState('');
  const [showPass,  setShowPass]  = useState(false);

  // Forgot password fields
  const [fpUsername,    setFpUsername]    = useState('');
  const [fpOldPassword, setFpOldPassword] = useState('');
  const [fpNewPassword, setFpNewPassword] = useState('');
  const [fpConfirm,     setFpConfirm]     = useState('');

  // Change username fields
  const [cuUsername,    setCuUsername]    = useState('');
  const [cuPassword,    setCuPassword]    = useState('');
  const [cuNewUsername, setCuNewUsername] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      const dest = user.roles?.name === 'Department Head' ||
                   user.roles?.name === 'Department Assistant'
        ? '/dashboard/dept' : '/dashboard';
      navigate(dest, { replace: true });
    }
  }, [user]);

  useEffect(() => {
    if (searchParams.get('reason') === 'expired') {
      setError('Your 12-hour shift session expired. Please login again.');
    }
  }, []);

  // ── LOGIN ─────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password.trim()) {
      setError('Please enter your username and password.'); return;
    }
    setBusy(true);
    try {
      const data = await login(username, password, signingAs || undefined);
      const role = data.user.roles?.name;
      navigate(
        role === 'Department Head' || role === 'Department Assistant'
          ? '/dashboard/dept' : '/dashboard',
        { replace: true }
      );
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check your credentials.');
    } finally {
      setBusy(false);
    }
  };

  // ── CHANGE PASSWORD (knows old password) ─────────────────
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError(''); setOkMsg('');
    if (!fpUsername.trim() || !fpOldPassword.trim()) {
      setError('Enter your username and current password.'); return;
    }
    if (fpNewPassword.length < 8) {
      setError('New password must be at least 8 characters.'); return;
    }
    if (fpNewPassword !== fpConfirm) {
      setError('New passwords do not match.'); return;
    }
    setBusy(true);
    try {
      // Login first to get a token, then change password
      const loginData = await authService.login(fpUsername, fpOldPassword);
      // Temporarily set auth header for this request
      const res = await api.put('/auth/change-password',
        { oldPassword: fpOldPassword, newPassword: fpNewPassword },
        { headers: { Authorization: `Bearer ${loginData.token}` } }
      );
      // Logout the temp session
      await api.post('/auth/logout', {},
        { headers: { Authorization: `Bearer ${loginData.token}` } }
      );
      setOkMsg('✅ Password changed successfully! You can now login with your new password.');
      setFpUsername(''); setFpOldPassword('');
      setFpNewPassword(''); setFpConfirm('');
      setTimeout(() => { setPanel('login'); setOkMsg(''); }, 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password. Check your current password.');
    } finally {
      setBusy(false);
    }
  };

  // ── CHANGE USERNAME ───────────────────────────────────────
  const handleChangeUsername = async (e) => {
    e.preventDefault();
    setError(''); setOkMsg('');
    if (!cuUsername.trim() || !cuPassword.trim() || !cuNewUsername.trim()) {
      setError('All fields are required.'); return;
    }
    if (cuNewUsername.includes(' ')) {
      setError('Username cannot contain spaces.'); return;
    }
    setBusy(true);
    try {
      const loginData = await authService.login(cuUsername, cuPassword);
      await api.put('/auth/change-username',
        { newUsername: cuNewUsername.trim().toLowerCase() },
        { headers: { Authorization: `Bearer ${loginData.token}` } }
      );
      await api.post('/auth/logout', {},
        { headers: { Authorization: `Bearer ${loginData.token}` } }
      );
      setOkMsg(`✅ Username changed to "${cuNewUsername}". Please login with your new username.`);
      setCuUsername(''); setCuPassword(''); setCuNewUsername('');
      setTimeout(() => { setPanel('login'); setOkMsg(''); }, 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change username. Check your password.');
    } finally {
      setBusy(false);
    }
  };

  const resetErrors = () => { setError(''); setOkMsg(''); };

  // ── RENDER ────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #003087 0%, #1e40af 50%, #1e3a8a 100%)',
      display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '20px',
    }}>
      <div style={card}>

        {/* Header */}
        <div style={headerStrip}>
          <div style={iconBox}>🧪</div>
          <h1 style={{ color: '#fff', fontSize: '20px', fontWeight: '700', margin: '0 0 4px' }}>
            BUL QC App
          </h1>
          <p style={{ color: '#93C5FD', fontSize: '12px', margin: 0 }}>
            Laboratory Information Management System
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>

          {/* Tab switcher */}
          <div style={{
            display: 'flex', borderRadius: '10px',
            overflow: 'hidden', border: '1.5px solid #E5E7EB',
            marginBottom: '20px',
          }}>
            {[
              { key: 'login',           label: 'Login'           },
              { key: 'change_password', label: 'Change Password' },
              { key: 'change_username', label: 'Change Username' },
            ].map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => { setPanel(t.key); resetErrors(); }}
                style={{
                  flex: 1, padding: '9px 4px',
                  fontSize: '11px', fontWeight: '600',
                  border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit',
                  background: panel === t.key ? '#003087' : '#F9FAFB',
                  color:      panel === t.key ? '#fff'    : '#6B7280',
                  pointerEvents: 'auto',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Error / Success messages */}
          {error  && <div style={errBox}>{error}</div>}
          {okMsg  && (
            <div style={{ ...errBox,
              background: '#F0FDF4', borderColor: '#86EFAC', color: '#166534' }}>
              {okMsg}
            </div>
          )}

          {/* ── PANEL: LOGIN ── */}
          {panel === 'login' && (
            <form onSubmit={handleLogin}>
              <div style={fieldWrap}>
                <label style={labelSt}>Supervisor Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  style={inputSt}
                  placeholder="e.g. shift_magezi"
                  autoComplete="username"
                />
              </div>

              <div style={fieldWrap}>
                <label style={labelSt}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={{ ...inputSt, paddingRight: '44px' }}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    style={{
                      position: 'absolute', right: '12px',
                      top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none',
                      cursor: 'pointer', fontSize: '16px',
                      pointerEvents: 'auto',
                    }}
                  >
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div style={fieldWrap}>
                <label style={labelSt}>Signing in as (Analyst / Sampler)</label>
                <input
                  type="text"
                  value={signingAs}
                  onChange={e => setSigningAs(e.target.value)}
                  style={inputSt}
                  placeholder="Your full name — leave blank if you are the supervisor"
                  autoComplete="off"
                />
                <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>
                  Analysts and Samplers type their name here for the audit trail.
                  Supervisors can leave this blank.
                </p>
              </div>

              <button type="submit" disabled={busy} style={btnPrimary(busy)}>
                {busy ? 'Logging in...' : 'Login to BUL QC'}
              </button>

              <p style={{ textAlign: 'center', fontSize: '11px',
                          color: '#9CA3AF', marginTop: '12px' }}>
                Sessions expire automatically after 12 hours
              </p>
            </form>
          )}

          {/* ── PANEL: CHANGE PASSWORD ── */}
          {panel === 'change_password' && (
            <form onSubmit={handleChangePassword}>
              <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '16px' }}>
                Enter your current credentials and choose a new password.
              </p>

              <div style={fieldWrap}>
                <label style={labelSt}>Your Username</label>
                <input type="text" value={fpUsername}
                  onChange={e => setFpUsername(e.target.value)}
                  style={inputSt} placeholder="e.g. shift_magezi" autoComplete="off" />
              </div>

              <div style={fieldWrap}>
                <label style={labelSt}>Current Password</label>
                <input type="password" value={fpOldPassword}
                  onChange={e => setFpOldPassword(e.target.value)}
                  style={inputSt} placeholder="Your current password" />
              </div>

              <div style={fieldWrap}>
                <label style={labelSt}>New Password</label>
                <input type="password" value={fpNewPassword}
                  onChange={e => setFpNewPassword(e.target.value)}
                  style={inputSt} placeholder="Min. 8 characters" />
              </div>

              <div style={fieldWrap}>
                <label style={labelSt}>Confirm New Password</label>
                <input type="password" value={fpConfirm}
                  onChange={e => setFpConfirm(e.target.value)}
                  style={inputSt} placeholder="Repeat new password" />
              </div>

              <button type="submit" disabled={busy} style={btnPrimary(busy)}>
                {busy ? 'Saving...' : 'Change My Password'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '12px' }}>
                <button type="button" style={btnLink}
                  onClick={() => { setPanel('login'); resetErrors(); }}>
                  ← Back to Login
                </button>
              </div>
            </form>
          )}

          {/* ── PANEL: CHANGE USERNAME ── */}
          {panel === 'change_username' && (
            <form onSubmit={handleChangeUsername}>
              <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '16px' }}>
                Enter your current login details and your desired new username.
              </p>

              <div style={fieldWrap}>
                <label style={labelSt}>Current Username</label>
                <input type="text" value={cuUsername}
                  onChange={e => setCuUsername(e.target.value)}
                  style={inputSt} placeholder="e.g. shift_magezi" autoComplete="off" />
              </div>

              <div style={fieldWrap}>
                <label style={labelSt}>Current Password</label>
                <input type="password" value={cuPassword}
                  onChange={e => setCuPassword(e.target.value)}
                  style={inputSt} placeholder="Your password" />
              </div>

              <div style={fieldWrap}>
                <label style={labelSt}>New Username</label>
                <input type="text" value={cuNewUsername}
                  onChange={e => setCuNewUsername(e.target.value)}
                  style={inputSt} placeholder="e.g. magezi_supervisor" autoComplete="off" />
                <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>
                  No spaces allowed. Lowercase recommended.
                </p>
              </div>

              <button type="submit" disabled={busy} style={btnPrimary(busy)}>
                {busy ? 'Saving...' : 'Change My Username'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '12px' }}>
                <button type="button" style={btnLink}
                  onClick={() => { setPanel('login'); resetErrors(); }}>
                  ← Back to Login
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}