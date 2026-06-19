// ============================================================
// FILE: src/pages/MobileHomePage.jsx
// Mobile & tablet home screen — shown after login on small
// screens only. Desktop users go straight to /dashboard.
// ============================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../context/AuthContext';
import { format }      from 'date-fns';

const P  = '#6B21A8';
const PM = '#7C3AED';

// ── Animation keyframes ───────────────────────────────────
const CSS = `
  @keyframes fadeUp {
    from { opacity:0; transform:translateY(30px); }
    to   { opacity:1; transform:translateY(0);    }
  }
  @keyframes pulse {
    0%,100% { transform: scale(1); }
    50%      { transform: scale(1.05); }
  }
  @keyframes slideDown {
    from { opacity:0; max-height:0; transform:translateY(-10px); }
    to   { opacity:1; max-height:600px; transform:translateY(0); }
  }
  .card-tap:active { transform: scale(0.96); transition: transform 0.1s; }
`;

// ── Main nav items ────────────────────────────────────────
const MAIN_ITEMS = [
  {
    key  : 'dashboard',
    icon : '📊',
    label: 'Dashboard',
    desc : 'Sample tracking & results',
    route: '/dashboard',
    grad : 'linear-gradient(135deg,#6B21A8,#7C3AED)',
    glow : 'rgba(124,58,237,0.4)',
  },
  {
    key  : 'inventory',
    icon : '📦',
    label: 'Inventory',
    desc : 'Stock & lab supplies',
    route: '/inventory',
    grad : 'linear-gradient(135deg,#0D9488,#0F766E)',
    glow : 'rgba(13,148,136,0.4)',
  },
];

// ── Line inspection sub-items ─────────────────────────────
const LINE_ITEMS = [
  { icon:'🧼', label:'Soap',       route:'/inspection/soap'      },
  { icon:'🧴', label:'Detergent',  route:'/inspection/detergent' },
  { icon:'♻️', label:'Plastics',   route:'/inspection/plastics'  },
  { icon:'🛢️', label:'Oil',        route:'/inspection/oil'       },
  { icon:'📦', label:'Fats',       route:'/inspection/fats'      },
  { icon:'📋', label:'Summary',    route:'/inspection/summary'   },
];

// ── Role-based additional quick links ─────────────────────
const ROLE_LINKS = {
  'QC Head'       : [{ icon:'📈', label:'Reports',  route:'/reports'  }, { icon:'⚙️', label:'Admin', route:'/admin' }],
  'QC Assistant'  : [{ icon:'📈', label:'Reports',  route:'/reports'  }],
  'Shift Supervisor': [{ icon:'🔬', label:'Register', route:'/register-sample' }],
};

// ── Greeting based on time ────────────────────────────────
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export default function MobileHomePage() {
  const navigate  = useNavigate();
  const { user, logout } = useAuth();
  const [showLines, setShowLines]   = useState(false);
  const [time,      setTime]        = useState(new Date());

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const roleName   = user?.roles?.name || '';
  const quickLinks = ROLE_LINKS[roleName] || [];

  // ── Navigate with ripple delay ────────────────────────────
  const go = (route) => {
    setTimeout(() => navigate(route), 120);
  };

  return (
    <div style={{ minHeight:'100vh', background:`linear-gradient(160deg,#1E0A3C 0%,#2D1260 40%,#4C1D95 100%)`, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <style>{CSS}</style>

      {/* ── Top bar ── */}
      <div style={{ padding:'52px 24px 16px', animation:'fadeUp 0.5s ease both' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          {/* Logo + greeting */}
          <div>
            <div style={{ fontSize:'12px', color:'#C4B5FD', fontWeight:'600', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:'2px' }}>
              BIDCO Uganda Limited
            </div>
            <div style={{ fontSize:'22px', fontWeight:'900', color:'#FFFFFF', lineHeight:1.1 }}>
              {greeting()},
            </div>
            <div style={{ fontSize:'20px', fontWeight:'700', color:'#DDD6FE', lineHeight:1.2 }}>
              {user?.full_name?.split(' ')[0] || 'Welcome'} 👋
            </div>
          </div>

          {/* Clock + logout */}
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:'24px', fontWeight:'900', color:'#FFFFFF', fontFamily:'monospace', letterSpacing:'2px' }}>
              {format(time,'HH:mm')}
            </div>
            <div style={{ fontSize:'11px', color:'#A78BFA', marginBottom:'6px' }}>
              {format(time,'EEE, dd MMM yyyy')}
            </div>
            <button onClick={() => { logout(); navigate('/login'); }}
              style={{ background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:'20px', color:'#DDD6FE', padding:'4px 12px', fontSize:'11px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>
              Sign out
            </button>
          </div>
        </div>

        {/* Role badge */}
        <div style={{ marginTop:'12px' }}>
          <span style={{ background:'rgba(255,215,0,0.2)', border:'1px solid rgba(255,215,0,0.4)', borderRadius:'20px', padding:'4px 14px', fontSize:'11px', fontWeight:'700', color:'#FCD34D', letterSpacing:'0.5px' }}>
            {roleName || 'QC Staff'}
          </span>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div style={{ flex:1, overflowY:'auto', padding:'8px 20px 32px' }}>

        {/* ── Main two cards: Dashboard + Inventory ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', marginBottom:'14px' }}>
          {MAIN_ITEMS.map((item, i) => (
            <button key={item.key}
              className="card-tap"
              onClick={() => go(item.route)}
              style={{
                background   : item.grad,
                border       : 'none',
                borderRadius : '20px',
                padding      : '22px 16px',
                cursor       : 'pointer',
                textAlign    : 'left',
                boxShadow    : `0 8px 24px ${item.glow}`,
                animation    : `fadeUp 0.5s ease ${0.1 + i*0.1}s both`,
                position     : 'relative',
                overflow     : 'hidden',
              }}>
              {/* Background circle decoration */}
              <div style={{ position:'absolute', top:'-20px', right:'-20px', width:'80px', height:'80px', borderRadius:'50%', background:'rgba(255,255,255,0.08)' }}/>
              <div style={{ position:'absolute', bottom:'-30px', left:'-10px', width:'100px', height:'100px', borderRadius:'50%', background:'rgba(255,255,255,0.05)' }}/>

              <div style={{ fontSize:'36px', marginBottom:'10px', display:'block', animation:`pulse 3s ease infinite ${i*0.5}s` }}>
                {item.icon}
              </div>
              <div style={{ fontSize:'16px', fontWeight:'900', color:'#FFFFFF', marginBottom:'4px' }}>
                {item.label}
              </div>
              <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.75)', lineHeight:1.3 }}>
                {item.desc}
              </div>
            </button>
          ))}
        </div>

        {/* ── Line Inspection card (full width, expandable) ── */}
        <div style={{ marginBottom:'14px', animation:'fadeUp 0.5s ease 0.3s both' }}>
          <button
            className="card-tap"
            onClick={() => setShowLines(p => !p)}
            style={{
              width        : '100%',
              background   : 'linear-gradient(135deg,#D97706,#B45309)',
              border       : 'none',
              borderRadius : showLines ? '20px 20px 0 0' : '20px',
              padding      : '18px 22px',
              cursor       : 'pointer',
              textAlign    : 'left',
              boxShadow    : '0 8px 24px rgba(217,119,6,0.4)',
              display      : 'flex',
              alignItems   : 'center',
              justifyContent:'space-between',
              position     : 'relative',
              overflow     : 'hidden',
              transition   : 'border-radius 0.2s',
            }}>
            <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
              <span style={{ fontSize:'36px' }}>🔍</span>
              <div>
                <div style={{ fontSize:'16px', fontWeight:'900', color:'#FFFFFF', marginBottom:'2px' }}>Line Inspection</div>
                <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.75)' }}>Soap · Detergent · Plastics · Oil · Fats</div>
              </div>
            </div>
            <span style={{ fontSize:'20px', color:'rgba(255,255,255,0.8)', transition:'transform 0.25s', transform:showLines?'rotate(180deg)':'rotate(0deg)' }}>
              ▾
            </span>
          </button>

          {/* Expanded line items */}
          {showLines && (
            <div style={{ background:'rgba(255,255,255,0.07)', borderRadius:'0 0 20px 20px', padding:'16px', border:'1px solid rgba(255,184,28,0.2)', borderTop:'none', animation:'slideDown 0.3s ease both' }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px' }}>
                {LINE_ITEMS.map((li, i) => (
                  <button key={li.route}
                    className="card-tap"
                    onClick={() => go(li.route)}
                    style={{
                      background   : 'rgba(255,255,255,0.1)',
                      border       : '1px solid rgba(255,255,255,0.15)',
                      borderRadius : '14px',
                      padding      : '14px 8px',
                      cursor       : 'pointer',
                      textAlign    : 'center',
                      animation    : `fadeUp 0.3s ease ${i*0.05}s both`,
                    }}>
                    <div style={{ fontSize:'28px', marginBottom:'6px' }}>{li.icon}</div>
                    <div style={{ fontSize:'12px', fontWeight:'700', color:'#FFFFFF' }}>{li.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Register Sample quick button ── */}
        <div style={{ animation:'fadeUp 0.5s ease 0.4s both', marginBottom:'14px' }}>
          <button
            className="card-tap"
            onClick={() => go('/register-sample')}
            style={{
              width        : '100%',
              background   : 'linear-gradient(135deg,#0369A1,#0284C7)',
              border       : 'none',
              borderRadius : '20px',
              padding      : '18px 22px',
              cursor       : 'pointer',
              textAlign    : 'left',
              boxShadow    : '0 8px 24px rgba(3,105,161,0.4)',
              display      : 'flex',
              alignItems   : 'center',
              gap          : '16px',
              position     : 'relative',
              overflow     : 'hidden',
            }}>
            <span style={{ fontSize:'36px' }}>🧪</span>
            <div>
              <div style={{ fontSize:'16px', fontWeight:'900', color:'#FFFFFF', marginBottom:'2px' }}>Register Sample</div>
              <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.75)' }}>Single or bulk sample registration</div>
            </div>
            <span style={{ marginLeft:'auto', fontSize:'20px', color:'rgba(255,255,255,0.6)' }}>›</span>
          </button>
        </div>

        {/* ── Role-specific quick links ── */}
        {quickLinks.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'10px', animation:'fadeUp 0.5s ease 0.5s both' }}>
            {quickLinks.map(ql => (
              <button key={ql.route}
                className="card-tap"
                onClick={() => go(ql.route)}
                style={{
                  background   : 'rgba(255,255,255,0.08)',
                  border       : '1px solid rgba(255,255,255,0.15)',
                  borderRadius : '16px',
                  padding      : '16px',
                  cursor       : 'pointer',
                  textAlign    : 'center',
                }}>
                <div style={{ fontSize:'28px', marginBottom:'6px' }}>{ql.icon}</div>
                <div style={{ fontSize:'13px', fontWeight:'700', color:'#FFFFFF' }}>{ql.label}</div>
              </button>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign:'center', marginTop:'28px', fontSize:'11px', color:'rgba(255,255,255,0.3)', animation:'fadeUp 0.5s ease 0.6s both' }}>
          BUL QC LIMS v1.0.4 · Powered By: SantosInfographics-2026
        </div>
      </div>
    </div>
  );
}
