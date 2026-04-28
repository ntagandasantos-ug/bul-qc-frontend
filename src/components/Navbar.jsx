
import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

let bulqcLogo  = null;
let santosLogo = null;
try { bulqcLogo  = require('../assets/bulqc_logo.png');  } catch(e) {}
try { santosLogo = require('../assets/santos_logo.png'); } catch(e) {}

export default function Navbar() {
  const { user, signingAs, logout, timeLeft, isAdmin, isDeptHead } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [showAv,     setShowAv]     = useState(false);
  const [avatar,     setAvatar]     = useState(
    () => localStorage.getItem('bul_qc_avatar_'+(user?.id||'g'))
  );
  const fileRef = useRef(null);

  const navItems = [
    { label:'Dashboard',       path:'/dashboard',       show:!isDeptHead },
    { label:'Register Sample', path:'/register-sample', show:!isDeptHead },
    { label:'Reports',         path:'/reports',         show:isAdmin     },
    { label:'Admin',           path:'/admin',           show:isAdmin     },
  ];

  const isActive = (p) => location.pathname === p;
  const timeWarn = timeLeft.startsWith('0h 0') || timeLeft.startsWith('0h 1') || timeLeft.startsWith('0h 2');
  const initials = (signingAs||user?.full_name||'?').split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();

  const uploadAvatar = (e) => {
    const f = e.target.files?.[0];
    if (!f || !f.type.startsWith('image/')) return;
    if (f.size > 2097152) { alert('Image must be under 2MB'); return; }
    const r = new FileReader();
    r.onload = ev => {
      setAvatar(ev.target.result);
      localStorage.setItem('bul_qc_avatar_'+(user?.id||'g'), ev.target.result);
      setShowAv(false);
    };
    r.readAsDataURL(f);
  };

  return (
    <nav style={{
      background:'linear-gradient(135deg,#6B21A8 0%,#7C3AED 100%)',
      color:'#fff',
      boxShadow:'0 2px 12px rgba(107,33,168,0.4)',
      position:'sticky', top:0, zIndex:50,
    }}>
      <div style={{
        display:'flex', alignItems:'center',
        justifyContent:'space-between',
        padding:'0 20px', height:'58px',
        gap:'12px',
      }}>

        {/* ── LEFT: BUL QC Logo + Name ── */}
        <div onClick={() => navigate('/dashboard')} style={{
          display:'flex', alignItems:'center', gap:'10px',
          cursor:'pointer', userSelect:'none', flexShrink:0,
        }}>
          <div style={{
  width:'40px', height:'40px', borderRadius:'10px',
  overflow:'hidden', flexShrink:0,
  boxShadow:'0 2px 6px rgba(0,0,0,0.25)',
}}>
  <img
    src={bulqcLogo}
    alt="BUL QC"
    style={{ width:'100%', height:'100%', objectFit:'cover' }}
  />
</div>
          <div>
            <div style={{ fontWeight:'800', fontSize:'15px', lineHeight:'1' }}>BUL QC App</div>
            <div style={{ fontSize:'10px', color:'#DDD6FE' }}>LIMS</div>
          </div>
        </div>

        {/* ── CENTRE: Nav Links ── */}
        <div style={{ display:'flex', gap:'4px', flex:1, justifyContent:'center' }}>
          {navItems.filter(i=>i.show).map(item => (
            <button key={item.path} onClick={() => navigate(item.path)}
              style={{
                padding:'7px 16px', borderRadius:'8px', border:'none',
                cursor:'pointer', fontSize:'13px', fontWeight:'600',
                fontFamily:'inherit', color:'#fff', whiteSpace:'nowrap',
                background: isActive(item.path) ? 'rgba(255,255,255,0.25)' : 'transparent',
              }}
              onMouseEnter={e => { if(!isActive(item.path)) e.currentTarget.style.background='rgba(255,255,255,0.12)'; }}
              onMouseLeave={e => { if(!isActive(item.path)) e.currentTarget.style.background='transparent'; }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* ── RIGHT: Timer | Avatar | Santos Logo ── */}
        <div style={{ display:'flex', alignItems:'center', gap:'10px', flexShrink:0 }}>

          {timeLeft && (
            <div style={{
              fontSize:'12px', padding:'4px 10px', borderRadius:'20px',
              background: timeWarn ? 'rgba(220,38,38,0.75)' : 'rgba(255,255,255,0.15)',
              color:'#fff', whiteSpace:'nowrap',
              border:'1px solid rgba(255,255,255,0.2)',
            }}>
              ⏱ {timeLeft}
            </div>
          )}

          {/* Avatar */}
          <div style={{ position:'relative' }}>
            <div onClick={() => setShowAv(!showAv)} title="Change profile picture"
              style={{
                width:'36px', height:'36px', borderRadius:'50%',
                border:'2px solid rgba(255,255,255,0.5)', cursor:'pointer',
                overflow:'hidden', display:'flex', alignItems:'center',
                justifyContent:'center', background: avatar ? 'transparent' : '#FFB81C',
                color:'#6B21A8', fontWeight:'800', fontSize:'13px', flexShrink:0,
              }}>
              {avatar
                ? <img src={avatar} alt="av" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : initials}
            </div>

            {showAv && (
              <div style={{
                position:'absolute', right:0, top:'44px',
                background:'#fff', borderRadius:'14px',
                boxShadow:'0 8px 32px rgba(107,33,168,0.2)',
                border:'1.5px solid #EDE9FE', minWidth:'220px',
                zIndex:200, overflow:'hidden',
              }}>
                <div style={{ padding:'12px 16px', background:'#F5F3FF', borderBottom:'1px solid #EDE9FE' }}>
                  <p style={{ fontWeight:'700', fontSize:'13px', color:'#1F2937', margin:0 }}>
                    {signingAs||user?.full_name}
                  </p>
                  <p style={{ fontSize:'11px', color:'#7C3AED', margin:'2px 0 0' }}>
                    {user?.roles?.name}{user?.shift_name?` • ${user.shift_name}`:''}
                  </p>
                </div>
                <div style={{ padding:'12px 16px', borderBottom:'1px solid #EDE9FE' }}>
                  <input ref={fileRef} type="file" accept="image/*"
                    onChange={uploadAvatar} style={{ display:'none' }} />
                  <button onClick={() => fileRef.current?.click()} style={{
                    width:'100%', background:'#7C3AED', color:'#fff', border:'none',
                    borderRadius:'8px', padding:'9px', fontSize:'13px',
                    fontWeight:'600', cursor:'pointer', fontFamily:'inherit',
                  }}>📷 Upload Profile Photo</button>
                  {avatar && (
                    <button onClick={() => {
                      setAvatar(null);
                      localStorage.removeItem('bul_qc_avatar_'+(user?.id||'g'));
                      setShowAv(false);
                    }} style={{
                      width:'100%', background:'#FEF2F2', color:'#DC2626',
                      border:'1px solid #FECACA', borderRadius:'8px', padding:'7px',
                      fontSize:'12px', cursor:'pointer', fontFamily:'inherit', marginTop:'6px',
                    }}>🗑 Remove Photo</button>
                  )}
                </div>
                <div style={{ padding:'4px 0' }}>
                  <button onClick={() => { navigate('/admin'); setShowAv(false); }}
                    style={{ display:'block', width:'100%', textAlign:'left', padding:'10px 16px', background:'none', border:'none', fontSize:'13px', color:'#374151', cursor:'pointer', fontFamily:'inherit' }}>
                    ⚙️ Settings
                  </button>
                  <button onClick={() => { logout(); setShowAv(false); }}
                    style={{ display:'block', width:'100%', textAlign:'left', padding:'10px 16px', background:'none', border:'none', fontSize:'13px', color:'#DC2626', cursor:'pointer', fontFamily:'inherit' }}>
                    🚪 Logout
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* SantosInfographics logo — far right */}
          {santosLogo ? (
            <img src={santosLogo} alt="SantosInfographics"
              title="Designed by SantosInfographics"
              style={{
                height:'34px', width:'auto', objectFit:'contain',
                borderRadius:'6px', background:'#fff',
                padding:'2px 5px', flexShrink:0,
              }}
            />
          ) : (
            <div style={{
              display:'flex', flexDirection:'column', alignItems:'center',
              background:'rgba(255,255,255,0.12)', borderRadius:'8px',
              padding:'4px 9px', border:'1px solid rgba(255,255,255,0.2)',
              flexShrink:0,
            }}>
              <span style={{ fontSize:'8px', color:'#DDD6FE', fontWeight:'700', letterSpacing:'0.5px' }}>Designed by</span>
              <span style={{ fontSize:'11px', color:'#FFB81C', fontWeight:'900' }}>SantosInfographics</span>
            </div>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{ background:'#581C87', borderTop:'1px solid rgba(255,255,255,0.1)', padding:'8px 16px 16px' }}>
          <div style={{ fontSize:'12px', color:'#DDD6FE', padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.1)', marginBottom:'8px' }}>
            <strong>{signingAs||user?.full_name}</strong> — {user?.roles?.name}
          </div>
          {navItems.filter(i=>i.show).map(item => (
            <button key={item.path} onClick={() => { navigate(item.path); setMenuOpen(false); }}
              style={{ display:'block', width:'100%', textAlign:'left', padding:'10px 8px', background: isActive(item.path)?'rgba(255,255,255,0.15)':'transparent', border:'none', color:'#fff', fontSize:'14px', fontWeight:'600', fontFamily:'inherit', cursor:'pointer', borderRadius:'8px', marginBottom:'2px' }}>
              {item.label}
            </button>
          ))}
          <button onClick={() => { logout(); setMenuOpen(false); }}
            style={{ display:'block', width:'100%', textAlign:'left', padding:'10px 8px', background:'none', border:'none', color:'#FCA5A5', fontSize:'14px', fontFamily:'inherit', cursor:'pointer', marginTop:'4px' }}>
            🚪 Logout
          </button>
        </div>
      )}
    </nav>
  );
}
