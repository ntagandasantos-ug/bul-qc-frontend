import bulqc_logo from '../assets/bulqc_logo.png';

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth }     from '../context/AuthContext';
import { authService } from '../services/auth.service';
import api             from '../services/api';
import { toast }       from 'react-toastify';

export default function LoginPage() {
  const { login, user }  = useAuth();
  const navigate         = useNavigate();
  const [params]         = useSearchParams();

  const [panel,      setPanel]      = useState('login');
  const [error,      setError]      = useState('');
  const [okMsg,      setOkMsg]      = useState('');
  const [busy,       setBusy]       = useState(false);

  // Login
  const [username,   setUsername]   = useState('');
  const [password,   setPassword]   = useState('');
  const [signingAs,  setSigningAs]  = useState('');
  const [showPw,     setShowPw]     = useState(false);

  // Change password
  const [cpUser,     setCpUser]     = useState('');
  const [cpOld,      setCpOld]      = useState('');
  const [cpNew,      setCpNew]      = useState('');
  const [cpConfirm,  setCpConfirm]  = useState('');
  const [cpCode,     setCpCode]     = useState('');
  const [cpStep,     setCpStep]     = useState(1); // 1=form, 2=verify email code

  // Change username
  const [cuUser,     setCuUser]     = useState('');
  const [cuPw,       setCuPw]       = useState('');
  const [cuNew,      setCuNew]      = useState('');
  const [cuCode,     setCuCode]     = useState('');
  const [cuStep,     setCuStep]     = useState(1);

  useEffect(() => {
    if (user) {
      navigate(
        user.roles?.name === 'Department Head' ||
        user.roles?.name === 'Department Assistant'
          ? '/dashboard/dept' : '/dashboard',
        { replace: true }
      );
    }
  }, [user]);

  useEffect(() => {
    if (params.get('reason') === 'expired')
      setError('Your 12-hour shift session expired. Please login again.');
  }, []);

  const reset = () => { setError(''); setOkMsg(''); };

  // ── LOGIN ─────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault(); reset();
    if (!username || !password) {
      setError('Enter your username and password.'); return;
    }
    setBusy(true);
    try {
      const d = await login(username, password, signingAs || undefined);
      navigate(
        d.user.roles?.name === 'Department Head' ||
        d.user.roles?.name === 'Department Assistant'
          ? '/dashboard/dept' : '/dashboard',
        { replace: true }
      );
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check your credentials.');
    } finally { setBusy(false); }
  };

  // ── REQUEST EMAIL CODE (Change Password step 1) ───────────
  const handleCpRequest = async (e) => {
    e.preventDefault(); reset();
    if (!cpUser || !cpOld) { setError('Enter username and current password.'); return; }
    if (cpNew.length < 8)  { setError('New password must be 8+ characters.'); return; }
    if (cpNew !== cpConfirm){ setError('New passwords do not match.'); return; }
    setBusy(true);
    try {
      await api.post('/auth/request-change-code', {
        username  : cpUser,
        password  : cpOld,
        changeType: 'password',
      });
      setOkMsg('✅ A verification code has been sent to your registered email. Enter it below.');
      setCpStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Request failed. Check your credentials.');
    } finally { setBusy(false); }
  };

  // ── CONFIRM CODE (Change Password step 2) ─────────────────
  const handleCpConfirm = async (e) => {
    e.preventDefault(); reset();
    if (!cpCode) { setError('Enter the verification code from your email.'); return; }
    setBusy(true);
    try {
      const loginData = await authService.login(cpUser, cpOld);
      await api.put('/auth/change-password',
        { oldPassword: cpOld, newPassword: cpNew, verifyCode: cpCode },
        { headers: { Authorization: `Bearer ${loginData.token}` } }
      );
      await api.post('/auth/logout', {},
        { headers: { Authorization: `Bearer ${loginData.token}` } }
      );
      setOkMsg('✅ Password changed! Login with your new password.');
      setCpStep(1);
      setCpUser(''); setCpOld(''); setCpNew(''); setCpConfirm(''); setCpCode('');
      setTimeout(() => { setPanel('login'); setOkMsg(''); }, 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Wrong code or request expired.');
    } finally { setBusy(false); }
  };

  // ── REQUEST EMAIL CODE (Change Username step 1) ───────────
  const handleCuRequest = async (e) => {
    e.preventDefault(); reset();
    if (!cuUser || !cuPw || !cuNew) {
      setError('All fields are required.'); return;
    }
    if (cuNew.includes(' ')) { setError('Username cannot have spaces.'); return; }
    setBusy(true);
    try {
      await api.post('/auth/request-change-code', {
        username  : cuUser,
        password  : cuPw,
        changeType: 'username',
      });
      setOkMsg('✅ A verification code has been sent to your registered email.');
      setCuStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Request failed.');
    } finally { setBusy(false); }
  };

  // ── CONFIRM CODE (Change Username step 2) ─────────────────
  const handleCuConfirm = async (e) => {
    e.preventDefault(); reset();
    if (!cuCode) { setError('Enter the verification code.'); return; }
    setBusy(true);
    try {
      const loginData = await authService.login(cuUser, cuPw);
      await api.put('/auth/change-username',
        { newUsername: cuNew, verifyCode: cuCode },
        { headers: { Authorization: `Bearer ${loginData.token}` } }
      );
      await api.post('/auth/logout', {},
        { headers: { Authorization: `Bearer ${loginData.token}` } }
      );
      setOkMsg(`✅ Username changed to "${cuNew}". Login with your new username.`);
      setCuStep(1);
      setCuUser(''); setCuPw(''); setCuNew(''); setCuCode('');
      setTimeout(() => { setPanel('login'); setOkMsg(''); }, 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Wrong code or request expired.');
    } finally { setBusy(false); }
  };

  // ── STYLES ────────────────────────────────────────────────
  const inputSt = {
    width: '100%', border: '1.5px solid #D1D5DB',
    borderRadius: '10px', padding: '11px 14px',
    fontSize: '14px', color: '#111827',
    backgroundColor: '#fff', fontFamily: 'inherit',
    boxSizing: 'border-box', cursor: 'text',
  };
  const btnPrimary = (dis) => ({
    width: '100%', background: dis ? '#A78BFA' : '#7C3AED',
    color: '#fff', border: 'none', borderRadius: '12px',
    padding: '13px', fontSize: '15px', fontWeight: '600',
    cursor: dis ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit', marginTop: '6px',
  });
  const lbl = {
    display: 'block', fontSize: '12px',
    fontWeight: '600', color: '#374151', marginBottom: '5px',
  };
  const fld = { marginBottom: '14px' };
  const errBox = {
    background: '#FEF2F2', border: '1.5px solid #FECACA',
    borderRadius: '10px', padding: '10px 14px',
    color: '#DC2626', fontSize: '13px', marginBottom: '14px',
  };
  const okBox = {
    ...errBox,
    background: '#F0FDF4', borderColor: '#86EFAC', color: '#166534',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#ffffff',
      display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '20px',
      position: 'relative', overflow: 'hidden',
    }}>

      {/* ── Watermark ── */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%,-50%) rotate(-30deg)',
        fontSize: '18px', fontWeight: '700',
        color: 'rgba(220, 38, 38, 0.06)',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        userSelect: 'none',
        zIndex: 0,
        letterSpacing: '4px',
      }}>
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} style={{ marginBottom: '40px' }}>
            Designed by SantosInfographics &nbsp;&nbsp;&nbsp;
            Designed by SantosInfographics &nbsp;&nbsp;&nbsp;
            Designed by SantosInfographics
          </div>
        ))}
      </div>

      {/* ── SantosInfographics logo top-right ── */}
      <div style={{
        position: 'fixed', top: '16px', right: '20px',
        fontSize: '11px', color: '#DC2626',
        fontWeight: '700', letterSpacing: '1px',
        zIndex: 10, textAlign: 'right',
      }}>
        <div style={{
          width: '36px', height: '36px',
          background: '#DC2626', borderRadius: '50%',
          color: '#fff', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontWeight: '900', fontSize: '13px',
          marginBottom: '2px', marginLeft: 'auto',
        }}>
          SI
        </div>
        <div>SantosInfographics</div>
      </div>

      {/* ── Login Card ── */}
      <div style={{
        background: '#fff', borderRadius: '20px',
        boxShadow: '0 20px 60px rgba(124,58,237,0.15)',
        border: '1px solid #EDE9FE',
        overflow: 'hidden', width: '100%', maxWidth: '390px',
        position: 'relative', zIndex: 1,
      }}>

        {/* Purple header */}
        <div style={{
          background: 'linear-gradient(135deg, #6B21A8 0%, #7C3AED 100%)',
          padding: '28px 24px', textAlign: 'center',
        }}>
          <div style={{
            width: '64px', height: '64px',
            background: '#FFB81C', borderRadius: '16px',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 12px',
            fontSize: '30px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          }}>
            <img
     src={bulqc_logo}
     alt="BUL QC"
     style={{
       width: '64px', height: '64px',
       borderRadius: '16px',
       objectFit: 'cover',
       boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
     }}
   />
          </div>
          <h1 style={{
            color: '#fff', fontSize: '20px',
            fontWeight: '800', margin: '0 0 4px',
          }}>
            BUL QC App
          </h1>
          <p style={{ color: '#DDD6FE', fontSize: '12px', margin: 0 }}>
            Laboratory Information Management System
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>

          {/* Tabs */}
          <div style={{
            display: 'flex', borderRadius: '10px',
            overflow: 'hidden', border: '1.5px solid #EDE9FE',
            marginBottom: '20px',
          }}>
            {[
              { key: 'login',           label: 'Login'           },
              { key: 'change_password', label: 'Change Password' },
              { key: 'change_username', label: 'Change Username' },
            ].map(t => (
              <button key={t.key} type="button"
                onClick={() => { setPanel(t.key); reset();
                  setCpStep(1); setCuStep(1); }}
                style={{
                  flex: 1, padding: '9px 4px',
                  fontSize: '10px', fontWeight: '600',
                  border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit',
                  background: panel === t.key ? '#7C3AED' : '#FAFAFA',
                  color:      panel === t.key ? '#fff'    : '#6B7280',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {error && <div style={errBox}>⚠️ {error}</div>}
          {okMsg  && <div style={okBox}>{okMsg}</div>}

          {/* ── LOGIN PANEL ── */}
          {panel === 'login' && (
            <form onSubmit={handleLogin}>
              <div style={fld}>
                <label style={lbl}>Supervisor Username</label>
                <input type="text" value={username}
                  onChange={e => setUsername(e.target.value)}
                  style={inputSt} placeholder="e.g. shift_magezi"
                  autoComplete="username" />
              </div>
              <div style={fld}>
                <label style={lbl}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={{ ...inputSt, paddingRight: '42px' }}
                    placeholder="••••••••"
                  />
                  <button type="button"
                    onClick={() => setShowPw(!showPw)}
                    style={{
                      position: 'absolute', right: '12px',
                      top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none',
                      cursor: 'pointer', fontSize: '16px',
                    }}>
                    {showPw ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <div style={fld}>
                <label style={lbl}>Signing in as (Analyst / Sampler)</label>
                <input type="text" value={signingAs}
                  onChange={e => setSigningAs(e.target.value)}
                  style={inputSt}
                  placeholder="Your full name — leave blank if supervisor"
                  autoComplete="off" />
                <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>
                  Analysts and Samplers type their name here for audit trail.
                </p>
              </div>
              <button type="submit" disabled={busy} style={btnPrimary(busy)}>
                {busy ? 'Logging in...' : 'Login to BUL QC'}
              </button>
              <p style={{ textAlign: 'center', fontSize: '11px',
                          color: '#9CA3AF', marginTop: '10px' }}>
                Sessions expire automatically after 12 hours
              </p>
            </form>
          )}

          {/* ── CHANGE PASSWORD PANEL ── */}
          {panel === 'change_password' && cpStep === 1 && (
            <form onSubmit={handleCpRequest}>
              <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '14px' }}>
                A verification code will be sent to your registered email address.
              </p>
              {[
                ['Your Username',       cpUser,    setCpUser,    'text',    'e.g. shift_magezi'],
                ['Current Password',    cpOld,     setCpOld,     'password','••••••••'],
                ['New Password',        cpNew,     setCpNew,     'password','Min 8 characters'],
                ['Confirm New Password',cpConfirm, setCpConfirm, 'password','Repeat new password'],
              ].map(([label, val, set, type, ph]) => (
                <div key={label} style={fld}>
                  <label style={lbl}>{label}</label>
                  <input type={type} value={val}
                    onChange={e => set(e.target.value)}
                    style={inputSt} placeholder={ph} />
                </div>
              ))}
              <button type="submit" disabled={busy} style={btnPrimary(busy)}>
                {busy ? 'Sending Code...' : 'Send Verification Code to Email'}
              </button>
            </form>
          )}

          {panel === 'change_password' && cpStep === 2 && (
            <form onSubmit={handleCpConfirm}>
              <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '14px' }}>
                Enter the 6-digit code sent to your email:
              </p>
              <div style={fld}>
                <label style={lbl}>Verification Code</label>
                <input type="text" value={cpCode}
                  onChange={e => setCpCode(e.target.value)}
                  style={{ ...inputSt, fontSize: '20px',
                           letterSpacing: '8px', textAlign: 'center' }}
                  placeholder="000000" maxLength={6} />
              </div>
              <button type="submit" disabled={busy} style={btnPrimary(busy)}>
                {busy ? 'Verifying...' : 'Confirm & Change Password'}
              </button>
              <button type="button" onClick={() => setCpStep(1)}
                style={{ ...btnPrimary(false), background: '#6B7280', marginTop: '8px' }}>
                ← Back
              </button>
            </form>
          )}

          {/* ── CHANGE USERNAME PANEL ── */}
          {panel === 'change_username' && cuStep === 1 && (
            <form onSubmit={handleCuRequest}>
              <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '14px' }}>
                A verification code will be sent to your registered email address.
              </p>
              {[
                ['Current Username', cuUser,  setCuUser, 'text',    'e.g. shift_magezi'],
                ['Current Password', cuPw,    setCuPw,   'password','••••••••'],
                ['New Username',     cuNew,   setCuNew,  'text',    'No spaces allowed'],
              ].map(([label, val, set, type, ph]) => (
                <div key={label} style={fld}>
                  <label style={lbl}>{label}</label>
                  <input type={type} value={val}
                    onChange={e => set(e.target.value)}
                    style={inputSt} placeholder={ph} autoComplete="off" />
                </div>
              ))}
              <button type="submit" disabled={busy} style={btnPrimary(busy)}>
                {busy ? 'Sending Code...' : 'Send Verification Code to Email'}
              </button>
            </form>
          )}

          {panel === 'change_username' && cuStep === 2 && (
            <form onSubmit={handleCuConfirm}>
              <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '14px' }}>
                Enter the 6-digit code sent to your email:
              </p>
              <div style={fld}>
                <label style={lbl}>Verification Code</label>
                <input type="text" value={cuCode}
                  onChange={e => setCuCode(e.target.value)}
                  style={{ ...inputSt, fontSize: '20px',
                           letterSpacing: '8px', textAlign: 'center' }}
                  placeholder="000000" maxLength={6} />
              </div>
              <button type="submit" disabled={busy} style={btnPrimary(busy)}>
                {busy ? 'Verifying...' : 'Confirm & Change Username'}
              </button>
              <button type="button" onClick={() => setCuStep(1)}
                style={{ ...btnPrimary(false), background: '#6B7280', marginTop: '8px' }}>
                ← Back
              </button>
            </form>
          )}

        </div>
      </div>

      {/* Footer watermark */}
      <div style={{
        position: 'fixed', bottom: '8px',
        left: '50%', transform: 'translateX(-50%)',
        fontSize: '11px', color: '#DC2626',
        fontWeight: '600', zIndex: 1,
        whiteSpace: 'nowrap',
      }}>
        Designed by SantosInfographics
      </div>
    </div>
  );
}