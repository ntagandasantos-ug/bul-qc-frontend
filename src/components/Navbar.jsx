import bulqc_logo from '../assets/bulqc_logo.png';

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Import your logo — adjust path if needed
// import bulqcLogo from '../assets/bulqc_logo.png';

export default function Navbar() {
  const {
    user, signingAs, logout, timeLeft,
    isAdmin, isDeptHead,
  } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAvatar, setShowAvatar] = useState(false);

  const navItems = [
    { label: 'Dashboard',        path: '/dashboard',        show: !isDeptHead },
    { label: 'Register Sample',  path: '/register-sample',  show: !isDeptHead },
    { label: 'Reports',          path: '/reports',          show: isAdmin     },
    { label: 'Admin',            path: '/admin',            show: isAdmin     },
  ];

  const isActive = (p) => location.pathname === p;

  const timeWarning =
    timeLeft.startsWith('0h 0') || timeLeft.startsWith('0h 1') ||
    timeLeft.startsWith('0h 2');

  // Get initials for avatar
  const name    = signingAs || user?.full_name || '?';
  const initials= name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();

  return (
    <>
      {/* ── Main navbar ── */}
      <nav style={{
        background: 'linear-gradient(135deg, #6B21A8 0%, #7C3AED 100%)',
        color: '#fff',
        boxShadow: '0 2px 12px rgba(107,33,168,0.4)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{
          maxWidth: '1100px', margin: '0 auto',
          padding: '0 16px',
          height: '56px',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
        }}>

          {/* Left: Logo + App name */}
          <div
            onClick={() => navigate('/dashboard')}
            style={{ display: 'flex', alignItems: 'center',
                     gap: '10px', cursor: 'pointer', userSelect: 'none' }}
          >
            {/* Logo circle */}
            <img
     src={bulqc_logo}
     alt="BUL QC"
     style={{
       width: '36px',
       height: '36px',
       borderRadius: '10px',
       objectFit: 'cover',
       boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
     }}
   />
            </div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '15px', lineHeight: '1' }}>
                BUL QC App
              </div>
              <div style={{ fontSize: '10px', color: '#DDD6FE', lineHeight: '1.2' }}>
                LIMS
              </div>
            </div>
          </div>

          {/* Centre: Nav links (desktop) */}
          <div style={{ display: 'flex', gap: '4px' }}
               className="hidden md:flex">
            {navItems.filter(i => i.show).map(item => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '600',
                  fontFamily: 'inherit',
                  background: isActive(item.path)
                    ? 'rgba(255,255,255,0.25)' : 'transparent',
                  color: '#fff',
                  transition: 'background 0.2s',
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

          {/* Right: Timer + Avatar + SantosInfographics logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

            {/* Session timer */}
            {timeLeft && (
              <div style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '20px',
                background: timeWarning
                  ? 'rgba(220,38,38,0.8)' : 'rgba(255,255,255,0.15)',
                color: '#fff',
                display: 'flex', alignItems: 'center', gap: '4px',
              }}>
                ⏱ {timeLeft}
              </div>
            )}

            {/* Avatar circle */}
            <div style={{ position: 'relative' }}>
              <div
                onClick={() => setShowAvatar(!showAvatar)}
                style={{
                  width: '34px', height: '34px',
                  borderRadius: '50%',
                  background: '#FFB81C',
                  color: '#6B21A8',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700', fontSize: '13px',
                  cursor: 'pointer',
                  border: '2px solid rgba(255,255,255,0.4)',
                  userSelect: 'none',
                }}
              >
                {initials}
              </div>

              {/* Avatar dropdown */}
              {showAvatar && (
                <div style={{
                  position: 'absolute', right: 0, top: '42px',
                  background: '#fff', borderRadius: '12px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  border: '1px solid #F3E8FF',
                  minWidth: '200px', zIndex: 100,
                  padding: '8px 0',
                }}>
                  <div style={{
                    padding: '10px 16px',
                    borderBottom: '1px solid #F3E8FF',
                  }}>
                    <p style={{ fontWeight: '600', fontSize: '13px',
                                color: '#1F2937' }}>
                      {signingAs || user?.full_name}
                    </p>
                    <p style={{ fontSize: '11px', color: '#6B7280' }}>
                      {user?.roles?.name}
                      {user?.shift_name ? ` • ${user.shift_name}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => { navigate('/admin'); setShowAvatar(false); }}
                    style={avatarMenuBtn}
                  >
                    ⚙️ Settings
                  </button>
                  <button
                    onClick={() => { logout(); setShowAvatar(false); }}
                    style={{ ...avatarMenuBtn, color: '#DC2626' }}
                  >
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>

            {/* SantosInfographics logo placeholder top-right */}
            <div style={{
              fontSize: '9px', color: '#DDD6FE',
              textAlign: 'right', lineHeight: '1.2',
              display: 'none', // Show when you have real logo
            }}>
              SI
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                background: 'none', border: 'none',
                color: '#fff', cursor: 'pointer',
                fontSize: '20px', padding: '4px',
                display: 'block',
              }}
              className="md:hidden"
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div style={{
            background: '#581C87',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            padding: '8px 16px 12px',
          }}>
            <div style={{
              fontSize: '12px', color: '#DDD6FE',
              padding: '8px 0',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              marginBottom: '8px',
            }}>
              <strong>{signingAs || user?.full_name}</strong>
              {' — '}{user?.roles?.name}
            </div>
            {navItems.filter(i => i.show).map(item => (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setMenuOpen(false); }}
                style={{
                  display: 'block', width: '100%',
                  textAlign: 'left', padding: '10px 8px',
                  background: isActive(item.path)
                    ? 'rgba(255,255,255,0.15)' : 'none',
                  border: 'none', color: '#fff',
                  fontSize: '14px', fontWeight: '600',
                  fontFamily: 'inherit', cursor: 'pointer',
                  borderRadius: '8px', marginBottom: '2px',
                }}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => { logout(); setMenuOpen(false); }}
              style={{
                display: 'block', width: '100%',
                textAlign: 'left', padding: '10px 8px',
                background: 'none', border: 'none',
                color: '#FCA5A5', fontSize: '14px',
                fontFamily: 'inherit', cursor: 'pointer',
              }}
            >
              🚪 Logout
            </button>
          </div>
        )}
      </nav>
    </>
  );
}

const avatarMenuBtn = {
  display: 'block', width: '100%',
  textAlign: 'left', padding: '10px 16px',
  background: 'none', border: 'none',
  fontSize: '13px', color: '#374151',
  cursor: 'pointer', fontFamily: 'inherit',
};