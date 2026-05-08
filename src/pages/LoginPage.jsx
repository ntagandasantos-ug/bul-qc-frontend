// ============================================================
// FILE: frontend/bul-qc-app/src/pages/LoginPage.jsx
// ============================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

let bulqcLogo  = null;
let santosLogo = null;
try { bulqcLogo  = require('../assets/bulqc_logo.png');  } catch(e) {}
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

  useEffect(() => {
    if (user) redirectByRole(user);
  }, [user]);

  const redirectByRole = (u) => {
  const role     = u.roles?.name;
  const deptCode = u.departments?.code;

  if (role === 'Department Head' || role === 'Department Assistant') {
    if      (deptCode === 'REF') navigate('/dashboard/ref', { replace: true });
    else if (deptCode === 'FP')  navigate('/dashboard/fp',  { replace: true });
    else                         navigate('/dashboard/dept', { replace: true });
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
      const result = await login(username.trim().toLowerCase(), password, signingAs.trim() || undefined);
      redirectByRole(result.user);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Login failed.');
    } finally { setLoading(false); }
  };

  // ── Styles ─────────────────────────────────────────────
  const inputSt = {
    width:'100%', border:'1.5px solid #E9D5FF', borderRadius:'10px',
    padding:'12px 14px', fontSize:'14px', color:'#111827',
    backgroundColor:'#fff', fontFamily:'inherit',
    boxSizing:'border-box', outline:'none',
  };

  const SantosBlock = ({ style }) => (
    <div style={style}>
      {santosLogo ? (
        <img src={santosLogo} alt="SantosInfographics"
          style={{
            height:'52px', width:'auto',
            objectFit:'contain',
            borderRadius:'10px',
            background:'rgba(255,255,255,0.9)',
            padding:'4px 10px',
            boxShadow:'0 2px 8px rgba(0,0,0,0.15)',
          }}
        />
      ) : (
        <div style={{
          background:'rgba(255,255,255,0.92)',
          borderRadius:'10px', padding:'6px 14px',
          boxShadow:'0 2px 8px rgba(0,0,0,0.12)',
        }}>
          <div style={{ fontSize:'9px', color:'#6B21A8', fontWeight:'700', letterSpacing:'1px' }}>Designed by</div>
          <div style={{ fontSize:'14px', color:'#6B21A8', fontWeight:'900', letterSpacing:'0.5px' }}>SantosInfographics</div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{
      minHeight:'100vh', background:'#ffffff',
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:'20px', position:'relative', overflow:'hidden',
    }}>

      {/* ── Watermark — clearly visible red ── */}
      <div style={{
        position:'fixed', top:0, left:0,
        width:'100%', height:'100%',
        pointerEvents:'none', userSelect:'none', zIndex:0,
        display:'flex', alignItems:'center', justifyContent:'center',
        overflow:'hidden',
      }}>
        <div style={{
          transform:'rotate(-30deg)',
          width:'200%', textAlign:'center',
        }}>
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} style={{
              fontSize:'18px', fontWeight:'800',
              // Clearly visible but subtle — deep red 12% opacity
              color:'rgba(180, 0, 0, 0.12)',
              whiteSpace:'nowrap', marginBottom:'52px',
              letterSpacing:'6px',
            }}>
              Designed by SantosInfographics &nbsp;&nbsp;
              Designed by SantosInfographics &nbsp;&nbsp;
              Designed by SantosInfographics
            </div>
          ))}
        </div>
      </div>

      {/* ── Santos logo TOP LEFT ── */}
      <SantosBlock style={{
        position:'fixed', top:'14px', left:'16px', zIndex:10,
      }}/>

      {/* ── Santos logo TOP RIGHT ── */}
      <SantosBlock style={{
        position:'fixed', top:'14px', right:'16px', zIndex:10,
      }}/>

      {/* ── Login Card ── */}
      <div style={{
        background:'#fff', borderRadius:'20px',
        boxShadow:'0 20px 60px rgba(124,58,237,0.18)',
        border:'1.5px solid #EDE9FE',
        overflow:'hidden', width:'100%', maxWidth:'400px',
        position:'relative', zIndex:1, marginTop:'20px',
      }}>

        {/* Purple header */}
        <div style={{
          background:'linear-gradient(135deg, #6B21A8 0%, #7C3AED 100%)',
          padding:'28px 24px', textAlign:'center',
        }}>
          {/* BUL QC Logo — bigger and clear */}
          <div style={{
            width:'76px', height:'76px', borderRadius:'18px',
            overflow:'hidden', margin:'0 auto 14px',
            boxShadow:'0 4px 16px rgba(0,0,0,0.3)',
            background:'#FFB81C',
          }}>
            {bulqcLogo ? (
              <img src={bulqcLogo} alt="BUL QC"
                style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
            ) : (
              <div style={{
                width:'100%', height:'100%', background:'#FFB81C',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:'34px',
              }}>🧪</div>
            )}
          </div>
          <h1 style={{ color:'#fff', fontSize:'24px', fontWeight:'800', margin:'0 0 4px' }}>
            BUL QC App
          </h1>
          <p style={{ color:'#DDD6FE', fontSize:'12px', margin:0 }}>
            Laboratory Information Management System
          </p>
        </div>

        {/* Form body */}
        <div style={{ padding:'28px 24px' }}>

          {error && (
            <div style={{
              background:'#FEF2F2', border:'1.5px solid #FECACA',
              borderRadius:'10px', padding:'12px 14px',
              color:'#DC2626', fontSize:'13px', fontWeight:'600',
              marginBottom:'18px',
            }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleLogin}>

            <div style={{ marginBottom:'16px' }}>
              <label style={{ display:'block', fontSize:'12px', fontWeight:'700', color:'#4C1D95', marginBottom:'6px' }}>
                Username
              </label>
              <input type="text" value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. shift_magezi"
                style={inputSt}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>

            <div style={{ marginBottom:'16px' }}>
              <label style={{ display:'block', fontSize:'12px', fontWeight:'700', color:'#4C1D95', marginBottom:'6px' }}>
                Password
              </label>
              <div style={{ position:'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ ...inputSt, paddingRight:'44px' }}
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:'18px', padding:'4px' }}>
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div style={{ marginBottom:'22px' }}>
              <label style={{ display:'block', fontSize:'12px', fontWeight:'700', color:'#4C1D95', marginBottom:'6px' }}>
                Signing in as (Analyst / Sampler)
              </label>
              <input type="text" value={signingAs}
                onChange={e => setSigningAs(e.target.value)}
                placeholder="Your full name — leave blank if supervisor"
                style={inputSt}
                autoComplete="off"
              />
              <p style={{ fontSize:'11px', color:'#9CA3AF', margin:'5px 0 0' }}>
                Analysts and samplers type their name here. Supervisors leave blank.
              </p>
            </div>

            <button type="submit" disabled={loading}
              style={{
                width:'100%',
                background: loading ? '#A78BFA' : 'linear-gradient(135deg, #6B21A8, #7C3AED)',
                color:'#fff', border:'none', borderRadius:'12px',
                padding:'14px', fontSize:'15px', fontWeight:'700',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily:'inherit',
                boxShadow: loading ? 'none' : '0 4px 12px rgba(124,58,237,0.35)',
              }}>
              {loading ? 'Logging in...' : '🔐 Login to BUL QC'}
            </button>

          </form>

          <p style={{ textAlign:'center', fontSize:'11px', color:'#9CA3AF', marginTop:'14px' }}>
            Sessions expire automatically after 12 hours
          </p>
        </div>
      </div>

      {/* Bottom watermark text */}
      <div style={{
        position:'fixed', bottom:'10px', left:'50%',
        transform:'translateX(-50%)',
        fontSize:'12px', color:'#DC2626',
        fontWeight:'700', zIndex:1, whiteSpace:'nowrap',
        letterSpacing:'0.5px',
      }}>
        Designed by SantosInfographics — BUL QC App v1.0.4
      </div>
    </div>
  );
}
