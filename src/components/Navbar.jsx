// ============================================================
// FILE: frontend/bul-qc-app/src/components/Navbar.jsx
// FIXES:
//   - BUL QC logo replaces emoji top-left
//   - SantosInfographics logo top-right corner
//   - Avatar upload on every page
//   - All JSX properly closed
// ============================================================
import bulqc_logo from '../assets/bulqc_logo.png';
import santos_logo from '../assets/santos_logo.png';
import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ── Import your logos ──────────────────────────────────────
// STEP: Copy your BUL QC logo to src/assets/bulqc_logo.png
// STEP: Copy SantosInfographics white-bg logo to src/assets/santos_logo.png
// Then uncomment these two lines:
// import bulqcLogo   from '../assets/bulqc_logo.png';
// import santosLogo  from '../assets/santos_logo.png';

export default function Navbar() {
  const {
    user, signingAs, logout, timeLeft,
    isAdmin, isDeptHead,
  } = useAuth();

  const navigate     = useNavigate();
  const location     = useLocation();
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [showAvatar, setShowAvatar] = useState(false);
  const [avatar,     setAvatar]     = useState(
    () => localStorage.getItem('bul_qc_avatar_' + (user?.id || 'guest'))
  );
  const fileRef = useRef(null);

  const navItems = [
    { label: 'Dashboard',       path: '/dashboard',       show: !isDeptHead },
    { label: 'Register Sample', path: '/register-sample', show: !isDeptHead },
    { label: 'Reports',         path: '/reports',         show: isAdmin     },
    { label: 'Admin',           path: '/admin',           show: isAdmin     },
  ];

  const isActive = (p) => location.pathname === p;

  const timeWarning =
    timeLeft.startsWith('0h 0') ||
    timeLeft.startsWith('0h 1') ||
    timeLeft.startsWith('0h 2');

  const name     = signingAs || user?.full_name || '?';
  const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be under 2MB'); return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target.result;
      setAvatar(b64);
      localStorage.setItem('bul_qc_avatar_' + (user?.id || 'guest'), b64);
      setShowAvatar(false);
    };
    reader.readAsDataURL(file);
  };

  const removeAvatar = () => {
    setAvatar(null);
    localStorage.removeItem('bul_qc_avatar_' + (user?.id || 'guest'));
    setShowAvatar(false);
  };

  return (
    <nav style={{
      background   : 'linear-gradient(135deg, #6B21A8 0%, #7C3AED 100%)',
      color        : '#fff',
      boxShadow    : '0 2px 12px rgba(107,33,168,0.4)',
      position     : 'sticky',
      top          : 0,
      zIndex       : 50,
    }}>

      {/* ── Main navigation bar ── */}
      <div style={{
        maxWidth       : '1200px',
        margin         : '0 auto',
        padding        : '0 16px',
        height         : '58px',
        display        : 'flex',
        alignItems     : 'center',
        justifyContent : 'space-between',
        gap            : '8px',
      }}>

        {/* ── LEFT: BUL QC Logo + App name ── */}
        <div
          onClick={() => navigate('/dashboard')}
          style={{
            display    : 'flex',
            alignItems : 'center',
            gap        : '10px',
            cursor     : 'pointer',
            userSelect : 'none',
            flexShrink : 0,
          }}
        >
          {/*
            BUL QC LOGO — once you have bulqc_logo.png in src/assets/:
            Replace the div below with:
            <img src={bulqcLogo} alt="BUL QC"
              style={{ width:'38px', height:'38px', borderRadius:'10px', objectFit:'cover' }} />
          */}
          <img src={bulqc_logo} alt="BUL QC App"
              style={{ width:'38px', height:'38px', borderRadius:'10px', objectFit:'cover' }} />
          </div>
          <div>
            <div style={{ fontWeight: '800', fontSize: '15px', lineHeight: '1' }}>
              BUL QC App
            </div>
            <div style={{ fontSize: '10px', color: '#DDD6FE', lineHeight: '1.2' }}>
              LIMS
            </div>
          </div>
        </div>

        {/* ── CENTRE: Nav links ── */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {navItems.filter(i => i.show).map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                padding      : '6px 14px',
                borderRadius : '8px',
                border       : 'none',
                cursor       : 'pointer',
                fontSize     : '13px',
                fontWeight   : '600',
                fontFamily   : 'inherit',
                background   : isActive(item.path)
                  ? 'rgba(255,255,255,0.25)' : 'transparent',
                color        : '#fff',
                transition   : 'background 0.2s',
              }}
              onMouseEnter={e => {
                if (!isActive(item.path))
                  e.target.style.background = 'rgba(255,255,255,0.12)';
              }}
              onMouseLeave={e => {
                if (!isActive(item.path))
                  e.target.style.background = 'transparent';
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* ── RIGHT: Timer + Avatar + Santos logo + Hamburger ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>

          {/* Session countdown timer */}
          {timeLeft && (
            <div style={{
              fontSize     : '11px',
              padding      : '3px 9px',
              borderRadius : '20px',
              background   : timeWarning
                ? 'rgba(220,38,38,0.8)' : 'rgba(255,255,255,0.15)',
              color        : '#fff',
              display      : 'flex',
              alignItems   : 'center',
              gap          : '4px',
              whiteSpace   : 'nowrap',
            }}>
              ⏱ {timeLeft}
            </div>
          )}

          {/* Avatar with profile picture upload */}
          <div style={{ position: 'relative' }}>
            <div
              onClick={() => setShowAvatar(!showAvatar)}
              title="Click to change profile picture"
              style={{
                width          : '36px',
                height         : '36px',
                borderRadius   : '50%',
                background     : avatar ? 'transparent' : '#FFB81C',
                color          : '#6B21A8',
                display        : 'flex',
                alignItems     : 'center',
                justifyContent : 'center',
                fontWeight     : '800',
                fontSize       : '13px',
                cursor         : 'pointer',
                border         : '2px solid rgba(255,255,255,0.4)',
                userSelect     : 'none',
                overflow       : 'hidden',
                flexShrink     : 0,
              }}
            >
              {avatar
                ? <img src={avatar} alt="avatar"
                    style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : initials
              }
            </div>

            {/* Avatar dropdown */}
            {showAvatar && (
              <div style={{
                position     : 'absolute',
                right        : 0,
                top          : '44px',
                background   : '#fff',
                borderRadius : '14px',
                boxShadow    : '0 8px 32px rgba(107,33,168,0.2)',
                border       : '1.5px solid #EDE9FE',
                minWidth     : '220px',
                zIndex       : 100,
                overflow     : 'hidden',
              }}>
                {/* User info header */}
                <div style={{
                  padding      : '12px 16px',
                  background   : '#F5F3FF',
                  borderBottom : '1px solid #EDE9FE',
                }}>
                  <p style={{ fontWeight:'700', fontSize:'14px', color:'#1F2937', margin:0 }}>
                    {signingAs || user?.full_name}
                  </p>
                  <p style={{ fontSize:'11px', color:'#7C3AED', margin:'2px 0 0' }}>
                    {user?.roles?.name}
                    {user?.shift_name ? ` • ${user.shift_name}` : ''}
                  </p>
                </div>

                {/* Upload photo */}
                <div style={{ padding:'12px 16px', borderBottom:'1px solid #EDE9FE' }}>
                  <p style={{ fontSize:'12px', color:'#6B7280', marginBottom:'8px' }}>
                    Change profile picture:
                  </p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    style={{ display:'none' }}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    style={{
                      width:'100%', background:'#7C3AED', color:'#fff',
                      border:'none', borderRadius:'8px', padding:'9px',
                      fontSize:'13px', fontWeight:'600',
                      cursor:'pointer', fontFamily:'inherit', marginBottom:'6px',
                    }}
                  >
                    📷 Upload Photo
                  </button>
                  {avatar && (
                    <button onClick={removeAvatar}
                      style={{
                        width:'100%', background:'#FEF2F2', color:'#DC2626',
                        border:'1px solid #FECACA', borderRadius:'8px', padding:'7px',
                        fontSize:'12px', cursor:'pointer', fontFamily:'inherit',
                      }}
                    >
                      🗑 Remove Photo
                    </button>
                  )}
                </div>

                {/* Menu options */}
                <div style={{ padding:'4px 0' }}>
                  <button
                    onClick={() => { navigate('/admin'); setShowAvatar(false); }}
                    style={menuBtnStyle}
                  >
                    ⚙️ Settings
                  </button>
                  <button
                    onClick={() => { logout(); setShowAvatar(false); }}
                    style={{ ...menuBtnStyle, color:'#DC2626' }}
                  >
                    🚪 Logout
                  </button>
                </div>
              </div>
            )}
          </div>

          {/*
            ── SANTOS INFOGRAPHICS LOGO — top right ──
            Once you have santos_logo.png in src/assets/:
            Replace the div below with:
            <img
              src={santosLogo}
              alt="SantosInfographics"
              style={{
                height     : '32px',
                width      : 'auto',
                objectFit  : 'contain',
                opacity    : 0.9,
                borderRadius: '4px',
              }}
              title="Designed by SantosInfographics"
            />
          */}
          <img
              src={santos_logo.png}
              alt="SantosInfographics"
              style={{
                height     : '32px',
                width      : 'auto',
                objectFit  : 'contain',
                opacity    : 0.9,
                borderRadius: '4px',
              }}
              title="Designed by SantosInfographics"
            />
          
            <span style={{ fontSize:'9px', color:'#DDD6FE', fontWeight:'700', letterSpacing:'0.5px' }}>
              Designed by
            </span>
            <span style={{ fontSize:'11px', color:'#FFB81C', fontWeight:'900', letterSpacing:'0.3px' }}>
              SantosInfo
            </span>
          </div>

          {/* Hamburger for mobile */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              background : 'none',
              border     : 'none',
              color      : '#fff',
              cursor     : 'pointer',
              fontSize   : '20px',
              padding    : '4px',
              flexShrink : 0,
            }}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
      
    

      {/* ── Mobile dropdown menu ── */}
      {menuOpen && (
        <div style={{
          background  : '#581C87',
          borderTop   : '1px solid rgba(255,255,255,0.1)',
          padding     : '8px 16px 14px',
        }}>
          <div style={{
            fontSize     : '12px',
            color        : '#DDD6FE',
            padding      : '8px 0',
            borderBottom : '1px solid rgba(255,255,255,0.1)',
            marginBottom : '8px',
          }}>
            <strong>{signingAs || user?.full_name}</strong>
            {' — '}{user?.roles?.name}
            {timeLeft && (
              <span style={{
                display    : 'inline-flex',
                alignItems : 'center',
                gap        : '4px',
                fontSize   : '11px',
                color      : timeWarning ? '#FCA5A5' : '#DDD6FE',
                marginLeft : '8px',
              }}>
                ⏱ {timeLeft}
              </span>
            )}
          </div>

          {navItems.filter(i => i.show).map(item => (
            <button
              key={item.path}
              onClick={() => { navigate(item.path); setMenuOpen(false); }}
              style={{
                display      : 'block',
                width        : '100%',
                textAlign    : 'left',
                padding      : '10px 8px',
                background   : isActive(item.path) ? 'rgba(255,255,255,0.15)' : 'transparent',
                border       : 'none',
                color        : '#fff',
                fontSize     : '14px',
                fontWeight   : '600',
                fontFamily   : 'inherit',
                cursor       : 'pointer',
                borderRadius : '8px',
                marginBottom : '2px',
              }}
            >
              {item.label}
            </button>
          ))}

          <button
            onClick={() => { logout(); setMenuOpen(false); }}
            style={{
              display    : 'block',
              width      : '100%',
              textAlign  : 'left',
              padding    : '10px 8px',
              background : 'none',
              border     : 'none',
              color      : '#FCA5A5',
              fontSize   : '14px',
              fontFamily : 'inherit',
              cursor     : 'pointer',
              marginTop  : '4px',
            }}
          >
            🚪 Logout
          </button>
        </div>
      )}
    </nav>
  );
}

const menuBtnStyle = {
  display    : 'block',
  width      : '100%',
  textAlign  : 'left',
  padding    : '10px 16px',
  background : 'none',
  border     : 'none',
  fontSize   : '13px',
  color      : '#374151',
  cursor     : 'pointer',
  fontFamily : 'inherit',
};
