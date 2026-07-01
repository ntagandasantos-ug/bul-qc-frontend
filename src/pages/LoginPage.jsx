// ============================================================
// FILE: frontend/bul-qc-app/src/pages/LoginPage.jsx
// Modern redesign with:
//   - Login
//   - Forgot Password (3-step: request code -> verify -> set new password)
//   - Change Username (3-step: same pattern)
// Both flows use the EXISTING backend endpoints:
//   POST /auth/request-change-code   { username, password, changeType }
//   POST /auth/change-password       { oldPassword, newPassword, verifyCode }  (requires auth token)
//   POST /auth/change-username       { newUsername, verifyCode }              (requires auth token)
// ============================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'https://bul-qc-backend.onrender.com/api';

let bulqcLogo  = null;
let santosLogo = null;
try { bulqcLogo  = require('../assets/bulqc_logo.png');  } catch(e) {}
try { santosLogo = require('../assets/santos_logo.png'); } catch(e) {}

const P  = '#6B21A8';
const PM = '#7C3AED';
const PL = '#EDE9FE';
const RD = '#DC2626';
const GR = '#16A34A';

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  // ── Which screen is showing ──
  // 'login' | 'forgot' | 'change_username'
  const [panel, setPanel] = useState('login');

  // ── Server warm-up state ──
  const [serverReady, setServerReady] = useState(false);
  const [waking, setWaking] = useState(false);

  // ── Login fields ──
  const [username,  setUsername]  = useState('');
  const [password,  setPassword]  = useState('');
  const [signingAs, setSigningAs] = useState('');
  const [showPw,     setShowPw]     = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  useEffect(() => {
    if (user) redirectByRole(user);
  }, [user]);

  useEffect(() => {
    const warmUp = async () => {
      try {
        await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
        setServerReady(true);
      } catch {
        setWaking(true);
        for (let i = 0; i < 12; i++) {
          await new Promise(r => setTimeout(r, 5000));
          try {
            await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
            setServerReady(true);
            setWaking(false);
            return;
          } catch {}
        }
        setWaking(false);
        setServerReady(true);
      }
    };
    warmUp();
  }, []);

  const redirectByRole = (u) => {
    const role     = u.roles?.name;
    const deptCode = u.departments?.code;
    if (role === 'Department Head' || role === 'Department Assistant') {
      if      (deptCode === 'REF')    navigate('/dashboard/ref',    { replace: true });
      else if (deptCode === 'FP')     navigate('/dashboard/fp',     { replace: true });
      else if (deptCode === 'BOILER') navigate('/dashboard/boiler', { replace: true });
      else if (deptCode === 'SOAP')   navigate('/dashboard/soap',   { replace: true });
      else                            navigate('/dashboard/dept',   { replace: true });
    } else {
      navigate(window.innerWidth < 1024 ? '/home' : '/dashboard', { replace: true });
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim()) { setError('Please enter your username.'); return; }
    if (!password.trim()) { setError('Please enter your password.'); return; }
    setLoading(true);
    try {
      const result = await login(username.trim().toLowerCase(), password, signingAs.trim() || undefined);
      redirectByRole(result.user);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Login failed.');
    } finally { setLoading(false); }
  };

  const inputSt = {
    width:'100%', border:'1.5px solid #E9D5FF', borderRadius:'10px',
    padding:'12px 14px', fontSize:'14px', color:'#111827',
    backgroundColor:'#fff', fontFamily:'inherit',
    boxSizing:'border-box', outline:'none',
  };

  return (
    <div style={{
      minHeight:'100vh', background:'linear-gradient(180deg,#FAF5FF 0%,#fff 100%)',
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:'20px', position:'relative', overflow:'hidden',
    }}>

      {waking && (
        <div style={{
          position:'fixed', top:0, left:0, width:'100%',
          background:'#FFF7ED', borderBottom:'2px solid #FED7AA',
          padding:'10px 16px', textAlign:'center', fontSize:'13px',
          color:'#EA580C', fontWeight:'600', zIndex:20,
        }}>
          ⏳ Waking up server — first load of the day takes about 30 seconds. Please wait...
        </div>
      )}

      {/* Faint corner logos — reduced visual competition vs. the old full watermark */}
      <CornerLogo side="left" />
      <CornerLogo side="right" />

      {/* ── Card ── */}
      <div style={{
        background:'#fff', borderRadius:'20px',
        boxShadow:'0 20px 60px rgba(124,58,237,0.16)',
        border:`1.5px solid ${PL}`,
        overflow:'hidden', width:'100%', maxWidth:'420px',
        position:'relative', zIndex:1, marginTop: waking ? '36px' : '0',
      }}>

        <CardHeader panel={panel} />

        <div style={{ padding:'26px 24px 22px' }}>
          {panel === 'login' && (
            <LoginPanel
              username={username} setUsername={setUsername}
              password={password} setPassword={setPassword}
              signingAs={signingAs} setSigningAs={setSigningAs}
              showPw={showPw} setShowPw={setShowPw}
              loading={loading} error={error}
              onSubmit={handleLogin}
              inputSt={inputSt}
              onForgotPassword={() => setPanel('forgot')}
              onChangeUsername={() => setPanel('change_username')}
            />
          )}

          {panel === 'forgot' && (
            <ChangeFlow
              changeType="password"
              inputSt={inputSt}
              onBack={() => setPanel('login')}
            />
          )}

          {panel === 'change_username' && (
            <ChangeFlow
              changeType="username"
              inputSt={inputSt}
              onBack={() => setPanel('login')}
            />
          )}
        </div>
      </div>

      <div style={{
        position:'fixed', bottom:'10px', left:'50%', transform:'translateX(-50%)',
        fontSize:'11px', color:'#C4B5FD', fontWeight:'600', zIndex:1,
        whiteSpace:'nowrap', letterSpacing:'0.3px',
      }}>
        Designed by SantosInfographics — BUL QC App v1.0.4
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Corner logo — small, fixed, low-key (replaces the old big
// diagonal repeated watermark, which competed with the form)
// ════════════════════════════════════════════════════════════
function CornerLogo({ side }) {
  return (
    <div style={{ position:'fixed', top:'14px', [side]:'16px', zIndex:5, opacity:0.85 }}>
      {santosLogo ? (
        <img src={santosLogo} alt="SantosInfographics"
          style={{ height:'38px', width:'auto', objectFit:'contain', borderRadius:'8px',
            background:'rgba(255,255,255,0.9)', padding:'3px 8px',
            boxShadow:'0 2px 8px rgba(0,0,0,0.1)' }} />
      ) : (
        <div style={{ background:'rgba(255,255,255,0.9)', borderRadius:'8px', padding:'5px 10px',
          boxShadow:'0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize:'8px', color:P, fontWeight:'700', letterSpacing:'0.5px' }}>Designed by</div>
          <div style={{ fontSize:'11px', color:P, fontWeight:'900' }}>SantosInfographics</div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Shared card header — logo + title, changes copy per panel
// ════════════════════════════════════════════════════════════
function CardHeader({ panel }) {
  const titles = {
    login           : { h:'BUL QC App', sub:'Laboratory Information Management System' },
    forgot          : { h:'Reset Password', sub:'Verify your identity to set a new password' },
    change_username : { h:'Change Username', sub:'Verify your identity to update your username' },
  };
  const t = titles[panel];
  return (
    <div style={{ background:`linear-gradient(135deg,${P} 0%,${PM} 100%)`, padding:'26px 24px', textAlign:'center' }}>
      <div style={{ width:'68px', height:'68px', borderRadius:'16px', overflow:'hidden', margin:'0 auto 12px',
        boxShadow:'0 4px 16px rgba(0,0,0,0.25)', background:'#FFB81C' }}>
        {bulqcLogo ? (
          <img src={bulqcLogo} alt="BUL QC" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        ) : (
          <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'30px' }}>🧪</div>
        )}
      </div>
      <h1 style={{ color:'#fff', fontSize: panel==='login' ? '22px' : '18px', fontWeight:'800', margin:'0 0 4px' }}>{t.h}</h1>
      <p style={{ color:'#DDD6FE', fontSize:'12px', margin:0, lineHeight:1.4 }}>{t.sub}</p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Step dots — shows progress through a 3-step flow
// ════════════════════════════════════════════════════════════
function StepDots({ step, total=3 }) {
  return (
    <div style={{ display:'flex', justifyContent:'center', gap:'6px', marginBottom:'20px' }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          width: i+1===step ? '20px' : '7px', height:'7px', borderRadius:'4px',
          background: i+1<=step ? `linear-gradient(135deg,${P},${PM})` : '#E5E7EB',
          transition:'all 0.25s',
        }} />
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// LOGIN PANEL
// ════════════════════════════════════════════════════════════
function LoginPanel({ username, setUsername, password, setPassword, signingAs, setSigningAs,
  showPw, setShowPw, loading, error, onSubmit, inputSt, onForgotPassword, onChangeUsername }) {
  return (
    <>
      {error && (
        <div style={{ background:'#FEF2F2', border:'1.5px solid #FECACA', borderRadius:'10px',
          padding:'11px 14px', color:RD, fontSize:'13px', fontWeight:'600', marginBottom:'16px' }}>
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={onSubmit}>
        <div style={{ marginBottom:'14px' }}>
          <label style={lbl}>Username</label>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)}
            placeholder="e.g. shift_magezi" style={inputSt}
            autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        </div>

        <div style={{ marginBottom:'14px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:'6px' }}>
            <label style={{ ...lbl, marginBottom:0 }}>Password</label>
            <button type="button" onClick={onForgotPassword}
              style={{ background:'none', border:'none', color:PM, fontSize:'11.5px', fontWeight:'700', cursor:'pointer', padding:0 }}>
              Forgot password?
            </button>
          </div>
          <div style={{ position:'relative' }}>
            <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" style={{ ...inputSt, paddingRight:'44px' }} autoComplete="current-password" />
            <button type="button" onClick={() => setShowPw(!showPw)}
              style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:'17px', padding:'4px' }}>
              {showPw ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <div style={{ marginBottom:'20px' }}>
          <label style={lbl}>Signing in as (Analyst / Sampler)</label>
          <input type="text" value={signingAs} onChange={e => setSigningAs(e.target.value)}
            placeholder="Your full name — leave blank if supervisor" style={inputSt} autoComplete="off" />
          <p style={{ fontSize:'11px', color:'#9CA3AF', margin:'5px 0 0' }}>
            Analysts and samplers type their name here. Supervisors leave blank.
          </p>
        </div>

        <button type="submit" disabled={loading} style={primaryBtn(loading)}>
          {loading ? 'Logging in...' : '🔐 Login to BUL QC'}
        </button>
      </form>

      <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:'8px', marginTop:'16px' }}>
        <span style={{ fontSize:'12px', color:'#9CA3AF' }}>Need to change your username?</span>
        <button type="button" onClick={onChangeUsername}
          style={{ background:'none', border:'none', color:PM, fontSize:'12px', fontWeight:'700', cursor:'pointer', padding:0, textDecoration:'underline' }}>
          Update it
        </button>
      </div>

      <p style={{ textAlign:'center', fontSize:'11px', color:'#9CA3AF', marginTop:'14px' }}>
        Sessions expire automatically after 12 hours
      </p>
    </>
  );
}

// ════════════════════════════════════════════════════════════
// SHARED 3-STEP CHANGE FLOW (password OR username)
// Step 1: enter username + current password -> request code
// Step 2: enter the 6-digit code from email
// Step 3: enter the new value (password or username) -> submit
// Maps exactly onto:
//   POST /auth/request-change-code  { username, password, changeType }
//   POST /auth/change-password      { oldPassword, newPassword, verifyCode }
//   POST /auth/change-username      { newUsername, verifyCode }
// ════════════════════════════════════════════════════════════
function ChangeFlow({ changeType, inputSt, onBack }) {
  const [step,  setStep]  = useState(1);
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  // Step 1 fields
  const [oldUsername, setOldUsername] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');

  // Step 2 field
  const [code, setCode] = useState('');

  // Step 3 fields
  const [newValue,     setNewValue]     = useState('');
  const [confirmValue, setConfirmValue] = useState('');
  const [showNewPw,    setShowNewPw]    = useState(false);

  // Token issued by the backend isn't available pre-login — these
  // change endpoints require req.user, which means an authenticated
  // session. Since the person isn't logged in yet on this screen,
  // we authenticate the request itself using a short-lived token we
  // mint right after step 1's credential check succeeds, the same
  // way the backend already verifies username+password there.
  const [tempToken, setTempToken] = useState('');

  const reset = () => { setError(''); setOkMsg(''); };

  // ── Step 1: verify identity, request code ──
  const handleRequestCode = async (e) => {
    e.preventDefault(); reset();
    if (!oldUsername.trim() || !oldPassword.trim()) {
      setError('Enter your username and current password.'); return;
    }
    setBusy(true);
    try {
      const res = await axios.post(`${BASE_URL}/auth/request-change-code`, {
        username   : oldUsername.trim().toLowerCase(),
        password   : oldPassword,
        changeType,
      });
      setMaskedEmail(res.data?.masked || '');
      setOkMsg(res.data?.message || 'Code sent.');
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send verification code.');
    } finally { setBusy(false); }
  };

  // ── Step 2: just move to step 3; the code itself is verified
  //    server-side when the final change request is submitted ──
  const handleVerifyCode = (e) => {
    e.preventDefault(); reset();
    if (!code.trim() || code.trim().length !== 6) {
      setError('Enter the 6-digit code from your email.'); return;
    }
    setStep(3);
  };

  // ── Step 3: submit the actual change ──
  const handleSubmitChange = async (e) => {
    e.preventDefault(); reset();

    if (changeType === 'password') {
      if (newValue.length < 8) { setError('New password must be 8+ characters.'); return; }
      if (newValue !== confirmValue) { setError('Passwords do not match.'); return; }
    } else {
      if (newValue.trim().length < 3) { setError('Username must be at least 3 characters.'); return; }
    }

    setBusy(true);
    try {
      // These endpoints require an authenticated request (req.user),
      // so we log in with the just-verified credentials first to get
      // a valid token, then call the change endpoint with it.
      const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
        username : oldUsername.trim().toLowerCase(),
        password : oldPassword,
      });
      const token = loginRes.data?.token;

      const endpoint = changeType === 'password' ? '/auth/change-password' : '/auth/change-username';
      const payload = changeType === 'password'
        ? { oldPassword, newPassword: newValue, verifyCode: code.trim() }
        : { newUsername: newValue.trim().toLowerCase(), verifyCode: code.trim() };

      await axios.put(`${BASE_URL}${endpoint}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setOkMsg(changeType === 'password'
        ? 'Password changed successfully. You can now log in with your new password.'
        : `Username changed to "${newValue.trim().toLowerCase()}". You can now log in with it.`);
      setStep(4); // success screen
    } catch (err) {
      setError(err.response?.data?.error || `Failed to change ${changeType}.`);
    } finally { setBusy(false); }
  };

  const resendCode = async () => {
    reset(); setBusy(true);
    try {
      const res = await axios.post(`${BASE_URL}/auth/request-change-code`, {
        username   : oldUsername.trim().toLowerCase(),
        password   : oldPassword,
        changeType,
      });
      setOkMsg('A new code has been sent to ' + (res.data?.masked || 'your email') + '.');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not resend code.');
    } finally { setBusy(false); }
  };

  if (step === 4) {
    return (
      <div style={{ textAlign:'center', padding:'10px 0' }}>
        <div style={{ fontSize:'48px', marginBottom:'12px' }}>✅</div>
        <h3 style={{ color:GR, fontSize:'16px', fontWeight:'800', margin:'0 0 8px' }}>
          {changeType === 'password' ? 'Password Updated' : 'Username Updated'}
        </h3>
        <p style={{ fontSize:'13px', color:'#6B7280', marginBottom:'22px', lineHeight:1.5 }}>{okMsg}</p>
        <button onClick={onBack} style={primaryBtn(false)}>← Back to Login</button>
      </div>
    );
  }

  return (
    <>
      <StepDots step={step} total={3} />

      {error && (
        <div style={{ background:'#FEF2F2', border:'1.5px solid #FECACA', borderRadius:'10px',
          padding:'11px 14px', color:RD, fontSize:'13px', fontWeight:'600', marginBottom:'16px' }}>
          ⚠️ {error}
        </div>
      )}
      {okMsg && step !== 4 && (
        <div style={{ background:'#F0FDF4', border:'1.5px solid #86EFAC', borderRadius:'10px',
          padding:'11px 14px', color:'#166534', fontSize:'12.5px', fontWeight:'600', marginBottom:'16px' }}>
          ✅ {okMsg}
        </div>
      )}

      {/* ── Step 1: verify identity ── */}
      {step === 1 && (
        <form onSubmit={handleRequestCode}>
          <p style={{ fontSize:'12.5px', color:'#6B7280', marginBottom:'16px', lineHeight:1.5 }}>
            Enter your current username and password. We'll email a verification code to confirm it's really you.
          </p>
          <div style={{ marginBottom:'14px' }}>
            <label style={lbl}>Username</label>
            <input type="text" value={oldUsername} onChange={e => setOldUsername(e.target.value)}
              placeholder="Your current username" style={inputSt} autoCapitalize="none" autoCorrect="off" />
          </div>
          <div style={{ marginBottom:'20px' }}>
            <label style={lbl}>Current Password</label>
            <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)}
              placeholder="••••••••" style={inputSt} />
          </div>
          <button type="submit" disabled={busy} style={primaryBtn(busy)}>
            {busy ? 'Sending code...' : 'Send Verification Code'}
          </button>
          <button type="button" onClick={onBack} style={linkBtnCenter}>← Back to Login</button>
        </form>
      )}

      {/* ── Step 2: enter code ── */}
      {step === 2 && (
        <form onSubmit={handleVerifyCode}>
          <p style={{ fontSize:'12.5px', color:'#6B7280', marginBottom:'16px', lineHeight:1.5 }}>
            We sent a 6-digit code to <strong>{maskedEmail || 'your email'}</strong>. Enter it below — it expires in 10 minutes.
          </p>
          <div style={{ marginBottom:'18px' }}>
            <label style={lbl}>Verification Code</label>
            <input type="text" value={code} onChange={e => setCode(e.target.value.replace(/\D/g,'').slice(0,6))}
              placeholder="000000" maxLength={6}
              style={{ ...inputSt, textAlign:'center', fontSize:'22px', fontWeight:'800', letterSpacing:'8px', color:P }} />
          </div>
          <button type="submit" disabled={busy || code.length !== 6} style={primaryBtn(busy || code.length !== 6)}>
            Verify Code
          </button>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:'12px' }}>
            <button type="button" onClick={() => setStep(1)} style={linkBtn}>← Change details</button>
            <button type="button" onClick={resendCode} disabled={busy} style={linkBtn}>Resend code</button>
          </div>
        </form>
      )}

      {/* ── Step 3: set new value ── */}
      {step === 3 && (
        <form onSubmit={handleSubmitChange}>
          {changeType === 'password' ? (
            <>
              <div style={{ marginBottom:'14px' }}>
                <label style={lbl}>New Password</label>
                <div style={{ position:'relative' }}>
                  <input type={showNewPw ? 'text' : 'password'} value={newValue} onChange={e => setNewValue(e.target.value)}
                    placeholder="At least 8 characters" style={{ ...inputSt, paddingRight:'44px' }} />
                  <button type="button" onClick={() => setShowNewPw(!showNewPw)}
                    style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:'17px' }}>
                    {showNewPw ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <div style={{ marginBottom:'20px' }}>
                <label style={lbl}>Confirm New Password</label>
                <input type={showNewPw ? 'text' : 'password'} value={confirmValue} onChange={e => setConfirmValue(e.target.value)}
                  placeholder="Re-enter new password" style={inputSt} />
              </div>
            </>
          ) : (
            <div style={{ marginBottom:'20px' }}>
              <label style={lbl}>New Username</label>
              <input type="text" value={newValue} onChange={e => setNewValue(e.target.value)}
                placeholder="e.g. shift_magezi" style={inputSt} autoCapitalize="none" autoCorrect="off" />
            </div>
          )}
          <button type="submit" disabled={busy} style={primaryBtn(busy)}>
            {busy ? 'Saving...' : changeType === 'password' ? 'Set New Password' : 'Update Username'}
          </button>
          <button type="button" onClick={() => setStep(2)} style={linkBtnCenter}>← Back</button>
        </form>
      )}
    </>
  );
}

// ── Shared style helpers ──
const lbl = { display:'block', fontSize:'12px', fontWeight:'700', color:'#4C1D95', marginBottom:'6px' };

const primaryBtn = (disabled) => ({
  width:'100%',
  background: disabled ? '#A78BFA' : 'linear-gradient(135deg, #6B21A8, #7C3AED)',
  color:'#fff', border:'none', borderRadius:'12px',
  padding:'13px', fontSize:'14.5px', fontWeight:'700',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily:'inherit',
  boxShadow: disabled ? 'none' : '0 4px 12px rgba(124,58,237,0.3)',
});

const linkBtn = {
  background:'none', border:'none', color:'#7C3AED',
  fontSize:'12px', fontWeight:'700', cursor:'pointer', padding:0,
};

const linkBtnCenter = {
  ...linkBtn, display:'block', margin:'14px auto 0', textAlign:'center',
};
