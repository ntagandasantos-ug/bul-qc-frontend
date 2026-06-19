// ============================================================
// FILE: src/components/BottomNavBar.jsx
// Persistent bottom navigation — phone & tablet only (<1024px)
//
// RESTRICTION: Department Head / Department Assistant roles
// only get Home + Dashboard active. Stock and Inspect are
// shown greyed out and locked — tapping shows a notice.
// Profile stays active so they can still sign out.
// Both Home and Dashboard route them straight to their own
// department dashboard.
// ============================================================

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast }       from 'react-toastify';
import { useAuth }     from '../context/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';

const P  = '#6B21A8';
const PM = '#7C3AED';

const CSS = `
  @keyframes sheetUp {
    from { transform: translateY(100%); }
    to   { transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(-3px); }
  }
  .nav-tap:active { transform: scale(0.88); }
`;

const LINE_ITEMS = [
  { icon:'🧼', label:'Soap Line',       route:'/inspection/soap'      },
  { icon:'🧴', label:'Detergent Line',  route:'/inspection/detergent' },
  { icon:'♻️', label:'Plastics Line',   route:'/inspection/plastics'  },
  { icon:'🛢️', label:'Oil Line',        route:'/inspection/oil'       },
  { icon:'📦', label:'Fats Line',       route:'/inspection/fats'      },
  { icon:'📋', label:'Daily Summary',   route:'/inspection/summary'   },
];

// ── Roles restricted to dashboard-only access ─────────────
const RESTRICTED_ROLES = ['Department Head', 'Department Assistant'];

// ── Department code → dashboard route map ─────────────────
const DEPT_DASHBOARD_MAP = {
  DET   : '/dashboard/dept',
  REF   : '/dashboard/ref',
  FP    : '/dashboard/fp',
  SOAP  : '/dashboard/soap',
  BOILER: '/dashboard/boiler',
};

// Try a few possible shapes of department info on the user object
function getDeptCode(user) {
  return (
    user?.departments?.code ||
    user?.department?.code  ||
    user?.department_code   ||
    null
  );
}

export default function BottomNavBar() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const isMobile  = useIsMobile();
  const { user, logout } = useAuth();

  const [showLines,   setShowLines]   = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  if (!isMobile) return null;
  if (location.pathname === '/login') return null;
  if (!user) return null;

  const path     = location.pathname;
  const roleName = user?.roles?.name || '';
  const isRestricted = RESTRICTED_ROLES.includes(roleName);

  // ── Resolve this user's own department dashboard route ───
  const deptCode  = getDeptCode(user);
  const deptRoute = deptCode ? DEPT_DASHBOARD_MAP[deptCode] : null;

  const isLineActive = path.startsWith('/inspection');

  const go = (route) => {
    setShowLines(false);
    setShowProfile(false);
    navigate(route);
  };

  // ── Action when a restricted icon is tapped ───────────────
  const blocked = (label) => {
    toast.info(`🔒 ${label} is not available for your role`, { autoClose: 2500 });
  };

  // ── Home / Dashboard action — different for restricted roles ─
  const goHomeOrDashboard = () => {
    if (isRestricted) {
      if (deptRoute) {
        go(deptRoute);
      } else {
        toast.warning('Department dashboard not configured — contact admin');
      }
      return;
    }
    go('/home');
  };

  const goDashboard = () => {
    if (isRestricted) {
      if (deptRoute) {
        go(deptRoute);
      } else {
        toast.warning('Department dashboard not configured — contact admin');
      }
      return;
    }
    go('/dashboard');
  };

  const NAV_ITEMS = [
    {
      key      : 'home',
      icon     : '🏠',
      label    : 'Home',
      disabled : false,
      action   : goHomeOrDashboard,
    },
    {
      key      : 'dashboard',
      icon     : '📊',
      label    : 'Dashboard',
      disabled : false,
      action   : goDashboard,
    },
    {
      key      : 'stock',
      icon     : '📦',
      label    : 'Stock',
      disabled : isRestricted,
      action   : () => isRestricted ? blocked('Stock / Inventory') : go('/inventory'),
    },
    {
      key      : 'line',
      icon     : '🔍',
      label    : 'Inspect',
      disabled : isRestricted,
      action   : () => isRestricted ? blocked('Line Inspection') : setShowLines(p => !p),
    },
    {
      key      : 'profile',
      icon     : '👤',
      label    : 'Profile',
      disabled : false, // kept active so users can always sign out
      action   : () => setShowProfile(p => !p),
    },
  ];

  // ── Determine which tab is visually active ────────────────
  const activeKey =
    showLines   ? 'line'    :
    showProfile ? 'profile' :
    isRestricted
      ? (deptRoute && path === deptRoute ? 'dashboard' : '')
      : (
          path === '/home' ? 'home' :
          path === '/inventory' ? 'stock' :
          isLineActive ? 'line' :
          (path === '/dashboard' || path.startsWith('/dashboard/')) ? 'dashboard' : ''
        );

  return (
    <>
      <style>{CSS}</style>

      {/* ── Backdrop for sheets ── */}
      {(showLines || showProfile) && (
        <div
          onClick={() => { setShowLines(false); setShowProfile(false); }}
          style={{
            position:'fixed', inset:0, background:'rgba(0,0,0,0.5)',
            zIndex:998, animation:'fadeIn 0.2s ease both',
          }}
        />
      )}

      {/* ── Line Inspection sheet (never shown for restricted roles) ── */}
      {showLines && !isRestricted && (
        <div style={{
          position:'fixed', left:0, right:0, bottom:0, zIndex:999,
          background:'#fff', borderRadius:'24px 24px 0 0',
          padding:'10px 20px calc(20px + env(safe-area-inset-bottom))',
          boxShadow:'0 -8px 30px rgba(0,0,0,0.2)',
          animation:'sheetUp 0.25s ease both',
        }}>
          <div style={{ width:'40px', height:'4px', background:'#E2E8F0', borderRadius:'4px', margin:'0 auto 14px' }}/>
          <div style={{ fontSize:'15px', fontWeight:'800', color:'#0F172A', marginBottom:'4px' }}>
            🔍 Line Inspection
          </div>
          <div style={{ fontSize:'12px', color:'#94A3B8', marginBottom:'16px' }}>
            Select a production line to inspect
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px' }}>
            {LINE_ITEMS.map(li => (
              <button key={li.route} className="nav-tap" onClick={() => go(li.route)}
                style={{
                  background:'#F5F3FF', border:`1.5px solid ${P}22`, borderRadius:'14px',
                  padding:'14px 6px', cursor:'pointer', textAlign:'center', fontFamily:'inherit',
                }}>
                <div style={{ fontSize:'26px', marginBottom:'5px' }}>{li.icon}</div>
                <div style={{ fontSize:'11px', fontWeight:'700', color:P }}>{li.label}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Profile sheet ── */}
      {showProfile && (
        <div style={{
          position:'fixed', left:0, right:0, bottom:0, zIndex:999,
          background:'#fff', borderRadius:'24px 24px 0 0',
          padding:'10px 20px calc(20px + env(safe-area-inset-bottom))',
          boxShadow:'0 -8px 30px rgba(0,0,0,0.2)',
          animation:'sheetUp 0.25s ease both',
        }}>
          <div style={{ width:'40px', height:'4px', background:'#E2E8F0', borderRadius:'4px', margin:'0 auto 14px' }}/>

          {/* User card */}
          <div style={{ display:'flex', alignItems:'center', gap:'14px', padding:'14px', background:`linear-gradient(135deg,${P},${PM})`, borderRadius:'16px', marginBottom:'14px' }}>
            <div style={{ width:'48px', height:'48px', borderRadius:'50%', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px', fontWeight:'900', color:'#fff', flexShrink:0 }}>
              {(user?.full_name || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight:'800', fontSize:'15px', color:'#fff' }}>{user?.full_name}</div>
              <div style={{ fontSize:'12px', color:'#DDD6FE' }}>{roleName || '—'}</div>
            </div>
          </div>

          {/* Menu items — restricted roles only see their dashboard link */}
          <div style={{ display:'flex', flexDirection:'column', gap:'4px', marginBottom:'10px' }}>
            {!isRestricted && (
              <button className="nav-tap" onClick={() => go('/register-sample')}
                style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 10px', background:'none', border:'none', borderRadius:'10px', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
                <span style={{ fontSize:'20px' }}>🧪</span>
                <span style={{ fontSize:'14px', fontWeight:'600', color:'#1E293B' }}>Register Sample</span>
              </button>
            )}
            <button className="nav-tap" onClick={goDashboard}
              style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 10px', background:'none', border:'none', borderRadius:'10px', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
              <span style={{ fontSize:'20px' }}>📊</span>
              <span style={{ fontSize:'14px', fontWeight:'600', color:'#1E293B' }}>
                {isRestricted ? 'My Department Dashboard' : 'Sample Dashboard'}
              </span>
            </button>
          </div>

          <button onClick={() => { logout(); navigate('/login'); }}
            style={{ width:'100%', padding:'13px', background:'#FEF2F2', color:'#DC2626', border:'1px solid #FECACA', borderRadius:'12px', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>
            🚪 Sign Out
          </button>
        </div>
      )}

      {/* ── Bottom nav bar ── */}
      <div style={{
        position:'fixed', left:0, right:0, bottom:0, zIndex:997,
        background:'#fff', borderTop:'1px solid #E2E8F0',
        boxShadow:'0 -4px 16px rgba(0,0,0,0.06)',
        paddingBottom:'env(safe-area-inset-bottom)',
        display:'flex', justifyContent:'space-around', alignItems:'center',
        height:'62px',
      }}>
        {NAV_ITEMS.map(item => {
          const active = activeKey === item.key;
          const disabled = item.disabled;
          return (
            <button key={item.key} className="nav-tap" onClick={item.action}
              style={{
                flex:1, height:'100%', display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center', gap:'2px',
                background:'none', border:'none', cursor: disabled ? 'not-allowed' : 'pointer',
                fontFamily:'inherit', position:'relative',
              }}>
              {active && !disabled && (
                <div style={{ position:'absolute', top:0, width:'32px', height:'3px', background:`linear-gradient(90deg,${P},${PM})`, borderRadius:'0 0 4px 4px' }}/>
              )}

              <span style={{
                fontSize:'21px',
                filter: disabled ? 'grayscale(1) opacity(0.35)' : active ? 'none' : 'grayscale(0.4) opacity(0.6)',
                animation: active && !disabled ? 'bounce 0.6s ease' : 'none',
                transition:'filter 0.2s',
                position:'relative',
              }}>
                {item.icon}
                {disabled && (
                  <span style={{ position:'absolute', top:'-2px', right:'-6px', fontSize:'10px' }}>🔒</span>
                )}
              </span>

              <span style={{
                fontSize:'10px',
                fontWeight: active && !disabled ? '800' : '600',
                color: disabled ? '#CBD5E1' : active ? P : '#94A3B8',
              }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
