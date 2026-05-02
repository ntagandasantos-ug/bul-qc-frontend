// ============================================================
// FILE: frontend/bul-qc-app/src/pages/LoginPage.jsx
// Clean reset — no email verification complexity
// ============================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

let bulqcLogo = null;
try { bulqcLogo = require('../assets/bulqc_logo.png'); } catch(e) {}
let santosLogo = null;
try { santosLogo = require('../assets/santos_logo.png'); } catch(e) {}

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const [username,  setUsername]  = useState('');
  const [password,  setPassword]  = useState('');
  const [signingAs, setSigningAs] = useState('');
  const [showPw,    setShowPw]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  // If already logged in, redirect immediately
  useEffect(() => {
    if (user) {
      redirectByRole(user);
    }
  }, [user]);

  const redirectByRole = (u) => {
    const role     = u.roles?.name;
    const deptCode = u.departments?.code;

    if (role === 'Department Head' || role === 'Department Assistant') {
      if (deptCode === 'REF') {
        navigate('/dashboard/ref', { replace: true });
      } else {
        navigate('/dashboard/dept', { replace: true });
      }
    } else {
      navigate('/dashboard', { replace: true });
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) { setError('Please enter your username.'); return; }
    if (!password.trim()) { setError('Please enter your password.'); return; }

    setLoading(true);
    try {
      const result = await login(
        username.trim().toLowerCase(),
        password,
        signingAs.trim() || undefined
      );
      redirectByRole(result.user);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Login failed.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Styles ────────────────────────────────────────────────
  const inputSt = {
    width: '100%',
    border: '1.5px solid #E9D5FF',
    borderRadius: '10px',
    padding: '12px 14px',
    fontSize: '14px',
    color: '#111827',
    backgroundColor: '#fff',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    outline: 'none',
  };

  const labelSt = {
    display: 'block',
    fontSize: '12px',
    fontWeight: '700',
    color: '#4C1D95',
    marginBottom: '6px',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* ── Red watermark ── */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%,-50%) rotate(-30deg)',
        pointerEvents: 'none',
        userSelect: 'none',
        zIndex: 0,
        width: '200%',
        textAlign: 'center',
      }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} style={{
            fontSize: '16px',
            fontWeight: '700',
            color: 'rgba(220,38,38,0.05)',
            whiteSpace: 'nowrap',
            marginBottom: '50px',
            letterSpacing: '6px',
          }}>
            Designed by SantosInfographics &nbsp;&nbsp;&nbsp;
            Designed by SantosInfographics &nbsp;&nbsp;&nbsp;
            Designed by SantosInfographics
          </div>
        ))}
      </div>

      {/* ── Santos logo top-right ── */}
      <div style={{
        position: 'fixed',
        top: '16px', right: '20px',
        zIndex: 10,
      }}>
        {santosLogo ? (
          <img src={santosLogo} alt="SantosInfographics"
            style={{ height: '40px', width: 'auto', objectFit: 'contain' }} />
        ) : (
          <div style={{ textAlign: 'right' }}>
            <div style={{
              width: '36px', height: '36px',
              background: '#DC2626', borderRadius: '50%',
              color: '#fff', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontWeight: '900', fontSize: '13px',
              marginLeft: 'auto', marginBottom: '2px',
            }}>SI</div>
            <div style={{ fontSize: '10px', color: '#DC2626', fontWeight: '700' }}>
              SantosInfographics
            </div>
          </div>
        )}
      </div>

      {/* ── Login Card ── */}
      <div style={{
        background: '#fff',
        borderRadius: '20px',
        boxShadow: '0 20px 60px rgba(124,58,237,0.15)',
        border: '1px solid #EDE9FE',
        overflow: 'hidden',
        width: '100%',
        maxWidth: '400px',
        position: 'relative',
        zIndex: 1,
      }}>

        {/* Purple header */}
        <div style={{
          background: 'linear-gradient(135deg, #6B21A8 0%, #7C3AED 100%)',
          padding: '28px 24px',
          textAlign: 'center',
        }}>
          {/* Logo */}
          <div style={{
            width: '68px', height: '68px',
            borderRadius: '16px',
            overflow: 'hidden',
            margin: '0 auto 14px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            background: '#FFB81C',
          }}>
            {bulqcLogo ? (
              <img src={bulqcLogo} alt="BUL QC"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{
                width: '100%', height: '100%',
                background: '#FFB81C',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center',
                fontSize: '30px',
              }}>🧪</div>
            )}
          </div>

          <h1 style={{
            color: '#fff', fontSize: '22px',
            fontWeight: '800', margin: '0 0 4px',
          }}>
            BUL QC App
          </h1>
          <p style={{ color: '#DDD6FE', fontSize: '12px', margin: 0 }}>
            Laboratory Information Management System
          </p>
        </div>

        {/* Form body */}
        <div style={{ padding: '28px 24px' }}>

          {/* Error message */}
          {error && (
            <div style={{
              background: '#FEF2F2',
              border: '1.5px solid #FECACA',
              borderRadius: '10px',
              padding: '12px 14px',
              color: '#DC2626',
              fontSize: '13px',
              fontWeight: '600',
              marginBottom: '18px',
            }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleLogin}>

            {/* Username */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelSt}>Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. shift_magezi"
                style={inputSt}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelSt}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ ...inputSt, paddingRight: '44px' }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{
                    position: 'absolute', right: '12px',
                    top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none',
                    cursor: 'pointer', fontSize: '18px',
                    padding: '4px',
                  }}
                >
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Signing as */}
            <div style={{ marginBottom: '22px' }}>
              <label style={labelSt}>
                Signing in as (Analyst / Sampler)
              </label>
              <input
                type="text"
                value={signingAs}
                onChange={e => setSigningAs(e.target.value)}
                placeholder="Your full name — leave blank if supervisor"
                style={inputSt}
                autoComplete="off"
              />
              <p style={{
                fontSize: '11px', color: '#9CA3AF',
                margin: '5px 0 0',
              }}>
                Analysts and samplers type their name here for audit trail.
                Supervisors leave this blank.
              </p>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: loading
                  ? '#A78BFA'
                  : 'linear-gradient(135deg, #6B21A8, #7C3AED)',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                padding: '14px',
                fontSize: '15px',
                fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                boxShadow: loading ? 'none' : '0 4px 12px rgba(124,58,237,0.35)',
                transition: 'all 0.2s',
              }}
            >
              {loading ? 'Logging in...' : '🔐 Login to BUL QC'}
            </button>

          </form>

          <p style={{
            textAlign: 'center',
            fontSize: '11px',
            color: '#9CA3AF',
            marginTop: '14px',
          }}>
            Sessions expire automatically after 12 hours
          </p>

        </div>
      </div>

      {/* Bottom watermark */}
      <div style={{
        position: 'fixed',
        bottom: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '11px',
        color: '#DC2626',
        fontWeight: '600',
        zIndex: 1,
        whiteSpace: 'nowrap',
      }}>
        Designed by SantosInfographics
      </div>

    </div>
  );
}
