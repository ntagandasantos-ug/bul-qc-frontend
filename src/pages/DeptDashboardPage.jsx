import React, {
  useState, useEffect, useCallback, useRef,
} from 'react';
import PageFooter           from '../components/PageFooter';
import NotificationBell     from '../components/NotificationBell';
import LoadingSpinner       from '../components/LoadingSpinner';
import { useAuth }          from '../context/AuthContext';
import { dashboardService } from '../services/dashboard.service';
import { supabase }         from '../services/supabase';
import { format }           from 'date-fns';

// ── Helper: play a short beep sound ──────────────────────
const playBeep = (frequency = 660, duration = 0.6, type = 'sine') => {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = frequency;
    osc.type = type;
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) { /* audio not supported */ }
};

// ── Helper: cell colour based on result status ────────────
const getCellStyle = (status) => {
  switch (status) {
    case 'pass':
    case 'ok':
      return {
        resultColor : '#15803D',
        resultBg    : '#F0FDF4',
        resultBorder: '#86EFAC',
        dot         : '#22C55E',
      };
    case 'fail_low':
    case 'fail_high':
      return {
        resultColor : '#DC2626',
        resultBg    : '#FEF2F2',
        resultBorder: '#FECACA',
        dot         : '#EF4444',
      };
    case 'text_ok':
      return {
        resultColor : '#1D4ED8',
        resultBg    : '#EFF6FF',
        resultBorder: '#BFDBFE',
        dot         : '#60A5FA',
      };
    default:
      return {
        resultColor : '#374151',
        resultBg    : '#F9FAFB',
        resultBorder: '#E5E7EB',
        dot         : '#9CA3AF',
      };
  }
};

// ── Toast notification queue (simple in-app toasts) ──────
let toastIdCounter = 0;

export default function DeptDashboardPage() {
  const { user, logout }    = useAuth();
  const [results,    setResults]    = useState([]);
  const [stats,      setStats]      = useState({});
  const [loading,    setLoading]    = useState(true);
  const [clock,      setClock]      = useState(new Date());
  const [lastUpd,    setLastUpd]    = useState(new Date());
  const [toasts,     setToasts]     = useState([]);
  const [search,     setSearch]     = useState('');
  const [fromDate,   setFromDate]   = useState(format(new Date(), 'yyyy-MM-dd'));
  const [toDate,     setToDate]     = useState(format(new Date(), 'yyyy-MM-dd'));
  const [useRange,   setUseRange]   = useState(false);
  const [avatar,     setAvatar]     = useState(null); // base64 profile pic
  const [showAvatar, setShowAvatar] = useState(false);
  const fileInputRef = useRef(null);

  const today = format(new Date(), 'yyyy-MM-dd');

  // ── Live clock ──────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Load saved avatar from localStorage ─────────────────
  useEffect(() => {
    const saved = localStorage.getItem('bul_qc_avatar_' + (user?.id || 'guest'));
    if (saved) setAvatar(saved);
  }, [user]);

  // ── Handle avatar upload ─────────────────────────────────
  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      addToast('Please upload an image file', 'error'); return;
    }
    if (file.size > 2 * 1024 * 1024) {
      addToast('Image must be under 2MB', 'error'); return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target.result;
      setAvatar(b64);
      localStorage.setItem('bul_qc_avatar_' + (user?.id || 'guest'), b64);
      setShowAvatar(false);
      addToast('Profile picture updated!', 'success');
    };
    reader.readAsDataURL(file);
  };

  // ── Add toast notification ───────────────────────────────
  const addToast = useCallback((message, type = 'info') => {
    const id = ++toastIdCounter;
    setToasts(prev => [{ id, message, type }, ...prev.slice(0, 4)]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  }, []);

  // ── Load data ────────────────────────────────────────────
  const load = useCallback(async (quiet = false) => {
    try {
      const [r, s] = await Promise.all([
        dashboardService.getLiveResults(),
        dashboardService.getStats(user?.department_id),
      ]);
      setResults(r || []);
      setStats(s || {});
      setLastUpd(new Date());
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // ── Real-time subscription ───────────────────────────────
  useEffect(() => {
    const sub = supabase
      .channel('dept_live_dashboard')
      .on('postgres_changes',
        {
          event : 'UPDATE',
          schema: 'public',
          table : 'sample_test_assignments',
        },
        (payload) => {
          load(true);

          const isOutOfSpec =
            payload.new.result_status === 'fail_low' ||
            payload.new.result_status === 'fail_high';

          if (isOutOfSpec) {
            playBeep(440, 1.2, 'square'); // harsh beep for out of spec
            addToast(
              `⚠️ Out of Spec result submitted!`,
              'error'
            );
          } else if (payload.new.result_value) {
            playBeep(660, 0.5, 'sine'); // soft beep for normal result
            addToast(
              `✅ New result submitted`,
              'success'
            );
          }
        }
      )
      .subscribe();

    return () => sub.unsubscribe();
  }, [load, addToast]);

  // ── Filter results by date ───────────────────────────────
  const dateFiltered = results.filter(r => {
    const d = r.registered_samples?.registered_at?.substring(0, 10);
    if (!d) return false;
    if (useRange) return d >= fromDate && d <= toDate;
    return d === fromDate;
  });

  // ── Group results by sample ──────────────────────────────
  const sampleMap = {};
  for (const r of dateFiltered) {
    const sId = r.registered_samples?.id;
    if (!sId) continue;
    if (!sampleMap[sId]) {
      sampleMap[sId] = {
        sample    : r.registered_samples,
        parameters: [],
      };
    }
    sampleMap[sId].parameters.push(r);
  }

  // ── Sort rows newest first ───────────────────────────────
  let sampleRows = Object.values(sampleMap).sort((a, b) => {
    const da = new Date(a.sample?.registered_at || 0);
    const db = new Date(b.sample?.registered_at || 0);
    return db - da;
  });

  // ── Apply search filter ──────────────────────────────────
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    sampleRows = sampleRows.filter(row =>
      row.sample?.sample_name?.toLowerCase().includes(q) ||
      row.sample?.sample_number?.toLowerCase().includes(q) ||
      row.sample?.sample_types?.name?.toLowerCase().includes(q)
    );
  }

  // ── Collect ALL unique test names (for dynamic columns) ──
  // Tests appear in display_order sequence
  const allTests = [];
  const seenTests = new Set();
  for (const row of sampleRows) {
    const sorted = [...row.parameters].sort(
      (a, b) => (a.tests?.display_order || 0) - (b.tests?.display_order || 0)
    );
    for (const p of sorted) {
      const key = p.tests?.name;
      if (key && !seenTests.has(key)) {
        seenTests.add(key);
        allTests.push({
          name: key,
          unit: p.tests?.unit || '',
          code: p.tests?.code || key,
        });
      }
    }
  }

  // ── Today count ──────────────────────────────────────────
  const todayCount = results.filter(r =>
    r.registered_samples?.registered_at?.startsWith(today)
  ).length;

  // ── Avatar display ───────────────────────────────────────
  const initials = (user?.full_name || '?')
    .split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  // ── Styles ───────────────────────────────────────────────
  const PURPLE      = '#6B21A8';
  const PURPLE_MID  = '#7C3AED';
  const PURPLE_LIGHT= '#EDE9FE';
  const GOLD        = '#FFB81C';

  const headerStyle = {
    background: `linear-gradient(135deg, ${PURPLE} 0%, ${PURPLE_MID} 100%)`,
    color      : '#fff',
    position   : 'sticky',
    top        : 0,
    zIndex     : 50,
    boxShadow  : '0 3px 16px rgba(107,33,168,0.45)',
  };

  const thFixedStyle = {
    padding        : '0',
    borderRight    : '2px solid rgba(255,255,255,0.25)',
    verticalAlign  : 'middle',
    background     : `linear-gradient(180deg, ${PURPLE} 0%, #5B1894 100%)`,
    position       : 'sticky',
    left           : 0,
    zIndex         : 20,
    minWidth       : '200px',
    maxWidth       : '200px',
  };

  const thParamGroupStyle = {
    background   : PURPLE,
    borderBottom : '2px solid rgba(255,255,255,0.3)',
    padding      : '8px 12px',
    textAlign    : 'center',
    fontWeight   : '800',
    fontSize     : '13px',
    letterSpacing: '1px',
    color        : '#fff',
  };

  const thSubColStyle = {
    padding      : '8px 6px',
    textAlign    : 'center',
    fontWeight   : '700',
    fontSize     : '12px',
    borderRight  : '1px solid rgba(255,255,255,0.2)',
    borderTop    : '2px solid rgba(255,255,255,0.3)',
    background   : 'rgba(255,255,255,0.08)',
    minWidth     : '110px',
    color        : GOLD,
    letterSpacing: '0.3px',
  };

  const tdFixedStyle = (isEven) => ({
    padding        : '10px 12px',
    borderRight    : '2px solid #DDD6FE',
    borderBottom   : '1px solid #EDE9FE',
    background     : isEven ? '#F5F3FF' : '#ffffff',
    position       : 'sticky',
    left           : 0,
    zIndex         : 10,
    minWidth       : '200px',
    maxWidth       : '200px',
    verticalAlign  : 'top',
  });

  const tdParamStyle = (isEven) => ({
    padding      : '8px 6px',
    textAlign    : 'center',
    borderRight  : '1px solid #EDE9FE',
    borderBottom : '1px solid #EDE9FE',
    background   : isEven ? '#FAFAFA' : '#ffffff',
    verticalAlign: 'top',
    minWidth     : '110px',
  });

  const inputSt = {
    border       : '1.5px solid #DDD6FE',
    borderRadius : '8px',
    padding      : '7px 11px',
    fontSize     : '13px',
    fontFamily   : 'inherit',
    background   : '#fff',
    color        : '#1F2937',
    cursor       : 'text',
    boxSizing    : 'border-box',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F5F3FF', paddingBottom: '50px' }}>

      {/* ════════════════════════════════════════════════════
          HEADER
      ════════════════════════════════════════════════════ */}
      <header style={headerStyle}>
        <div style={{
          maxWidth    : '100%',
          padding     : '0 16px',
          minHeight   : '58px',
          display     : 'flex',
          alignItems  : 'center',
          justifyContent: 'space-between',
          flexWrap    : 'wrap',
          gap         : '8px',
        }}>
          {/* Left: Logo + Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width       : '38px',
              height      : '38px',
              background  : GOLD,
              borderRadius: '10px',
              display     : 'flex',
              alignItems  : 'center',
              justifyContent: 'center',
              fontSize    : '20px',
              fontWeight  : '800',
              color       : PURPLE,
              boxShadow   : '0 2px 8px rgba(0,0,0,0.2)',
              flexShrink  : 0,
            }}>
              🧪
            </div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '15px', lineHeight: 1.1 }}>
                {user?.departments?.name || 'Detergent'} Live Dashboard
              </div>
              <div style={{ fontSize: '10px', color: '#DDD6FE', lineHeight: 1.2 }}>
                Real-time QC Results Feed
              </div>
            </div>
          </div>

          {/* Right controls */}
          <div style={{
            display    : 'flex',
            alignItems : 'center',
            gap        : '8px',
            flexWrap   : 'wrap',
          }}>

            {/* Live clock */}
            <div style={{
              background  : 'rgba(255,255,255,0.15)',
              borderRadius: '20px',
              padding     : '5px 14px',
              fontSize    : '14px',
              fontWeight  : '800',
              fontFamily  : 'monospace',
              letterSpacing: '1px',
              display     : 'flex',
              alignItems  : 'center',
              gap         : '5px',
              border      : '1px solid rgba(255,255,255,0.2)',
            }}>
              🕐 {format(clock, 'HH:mm:ss')}
            </div>

            {/* Date & time display */}
            <div style={{
              background  : 'rgba(255,255,255,0.1)',
              borderRadius: '8px',
              padding     : '4px 10px',
              fontSize    : '11px',
              color       : '#DDD6FE',
              textAlign   : 'center',
            }}>
              <div style={{ fontWeight: '600' }}>{format(clock, 'EEEE')}</div>
              <div>{format(clock, 'dd MMM yyyy')}</div>
            </div>

            {/* Notification bell */}
            <NotificationBell departmentId={user?.department_id} />

            {/* Avatar with upload */}
            <div style={{ position: 'relative' }}>
              <div
                onClick={() => setShowAvatar(!showAvatar)}
                style={{
                  width        : '38px',
                  height       : '38px',
                  borderRadius : '50%',
                  background   : avatar ? 'transparent' : GOLD,
                  border       : '2px solid rgba(255,255,255,0.5)',
                  cursor       : 'pointer',
                  overflow     : 'hidden',
                  display      : 'flex',
                  alignItems   : 'center',
                  justifyContent: 'center',
                  fontWeight   : '800',
                  fontSize     : '14px',
                  color        : PURPLE,
                  flexShrink   : 0,
                }}
                title="Click to change profile picture"
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
                  top          : '46px',
                  background   : '#fff',
                  borderRadius : '14px',
                  boxShadow    : '0 8px 32px rgba(107,33,168,0.2)',
                  border       : `1.5px solid ${PURPLE_LIGHT}`,
                  minWidth     : '220px',
                  zIndex       : 100,
                  overflow     : 'hidden',
                }}>
                  <div style={{
                    padding     : '12px 16px',
                    background  : '#F5F3FF',
                    borderBottom: `1px solid ${PURPLE_LIGHT}`,
                  }}>
                    <p style={{ fontWeight:'700', color:'#1F2937', margin:0 }}>
                      {user?.full_name}
                    </p>
                    <p style={{ fontSize:'11px', color:'#7C3AED', margin:'2px 0 0' }}>
                      {user?.roles?.name}
                    </p>
                  </div>

                  <div style={{ padding: '12px 16px' }}>
                    <p style={{ fontSize:'12px', color:'#6B7280',
                                marginBottom:'10px' }}>
                      Upload your profile picture:
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      style={{ display:'none' }}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        width       : '100%',
                        background  : PURPLE_MID,
                        color       : '#fff',
                        border      : 'none',
                        borderRadius: '8px',
                        padding     : '9px',
                        fontSize    : '13px',
                        fontWeight  : '600',
                        cursor      : 'pointer',
                        fontFamily  : 'inherit',
                      }}
                    >
                      📷 Upload Photo
                    </button>
                    {avatar && (
                      <button
                        onClick={() => {
                          setAvatar(null);
                          localStorage.removeItem('bul_qc_avatar_' + (user?.id||'guest'));
                          setShowAvatar(false);
                        }}
                        style={{
                          width       : '100%',
                          background  : '#FEF2F2',
                          color       : '#DC2626',
                          border      : '1px solid #FECACA',
                          borderRadius: '8px',
                          padding     : '7px',
                          fontSize    : '12px',
                          cursor      : 'pointer',
                          fontFamily  : 'inherit',
                          marginTop   : '6px',
                        }}
                      >
                        🗑 Remove Photo
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Logout button */}
            <button
              onClick={logout}
              style={{
                background  : 'rgba(255,255,255,0.15)',
                border      : '1px solid rgba(255,255,255,0.3)',
                color       : '#fff',
                borderRadius: '8px',
                padding     : '7px 14px',
                fontSize    : '13px',
                fontWeight  : '600',
                cursor      : 'pointer',
                fontFamily  : 'inherit',
                display     : 'flex',
                alignItems  : 'center',
                gap         : '5px',
              }}
            >
              🚪 Logout
            </button>
          </div>
        </div>
      </header>

      {/* ════════════════════════════════════════════════════
          TOAST NOTIFICATIONS (top-right popups)
      ════════════════════════════════════════════════════ */}
      <div style={{
        position  : 'fixed',
        top       : '70px',
        right     : '16px',
        zIndex    : 200,
        display   : 'flex',
        flexDirection: 'column',
        gap       : '8px',
        maxWidth  : '300px',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background  : t.type === 'error'   ? '#FEF2F2' :
                          t.type === 'success' ? '#F0FDF4' : '#EFF6FF',
            border      : `1.5px solid ${
                          t.type === 'error'   ? '#FECACA' :
                          t.type === 'success' ? '#86EFAC' : '#BFDBFE'}`,
            borderRadius: '12px',
            padding     : '10px 14px',
            fontSize    : '13px',
            fontWeight  : '600',
            color       : t.type === 'error'   ? '#DC2626' :
                          t.type === 'success' ? '#16A34A' : '#1D4ED8',
            boxShadow   : '0 4px 16px rgba(0,0,0,0.1)',
            animation   : 'fadeIn 0.3s ease-out',
            display     : 'flex',
            alignItems  : 'center',
            gap         : '8px',
          }}>
            {t.message}
          </div>
        ))}
      </div>

      <main style={{ padding: '16px', maxWidth: '100%' }}>

        {/* ── Stats Row ── */}
        <div style={{
          display    : 'flex',
          gap        : '10px',
          marginBottom: '16px',
          flexWrap   : 'wrap',
        }}>
          {[
            { label: 'Total Today',  val: todayCount,           icon: '📅', col: PURPLE_MID },
            { label: 'All Loaded',   val: sampleRows.length,    icon: '🧪', col: '#6B21A8'  },
            { label: 'Pending',      val: stats.pending     ||0, icon: '⏳', col: '#6B7280'  },
            { label: 'In Progress',  val: stats.in_progress ||0, icon: '🔬', col: '#EA580C'  },
            { label: 'Complete',     val: stats.complete    ||0, icon: '✅', col: '#16A34A'  },
            { label: 'Out of Spec',  val: stats.out_of_spec ||0, icon: '⚠️', col: '#DC2626'  },
          ].map(s => (
            <div key={s.label} style={{
              flex        : 1,
              minWidth    : '90px',
              background  : '#fff',
              borderRadius: '12px',
              border      : `2px solid ${s.col}22`,
              padding     : '10px 12px',
              textAlign   : 'center',
              boxShadow   : '0 1px 4px rgba(107,33,168,0.06)',
            }}>
              <div style={{ fontSize: '20px', marginBottom: '2px' }}>{s.icon}</div>
              <div style={{
                fontSize  : '22px',
                fontWeight: '900',
                color     : s.col,
                lineHeight: 1,
              }}>
                {s.val}
              </div>
              <div style={{
                fontSize  : '10px',
                color     : '#6B7280',
                fontWeight: '600',
                marginTop : '2px',
              }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Search + Date Filter Controls ── */}
        <div style={{
          background  : '#fff',
          borderRadius: '14px',
          border      : `1.5px solid ${PURPLE_LIGHT}`,
          padding     : '14px 16px',
          marginBottom: '14px',
          display     : 'flex',
          gap         : '12px',
          flexWrap    : 'wrap',
          alignItems  : 'flex-end',
        }}>

          {/* Search */}
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label style={{
              display     : 'block',
              fontSize    : '11px',
              fontWeight  : '700',
              color       : '#4C1D95',
              marginBottom: '5px',
            }}>
              🔍 Search Samples
            </label>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Sample name, number..."
              style={{ ...inputSt, width: '100%' }}
            />
          </div>

          {/* Date mode toggle */}
          <div>
            <label style={{
              display     : 'block',
              fontSize    : '11px',
              fontWeight  : '700',
              color       : '#4C1D95',
              marginBottom: '5px',
            }}>
              Date Filter Mode
            </label>
            <div style={{ display: 'flex', gap: '4px' }}>
              {['Single Day', 'Date Range'].map((label, i) => (
                <button key={label}
                  onClick={() => setUseRange(i === 1)}
                  style={{
                    padding     : '7px 12px',
                    borderRadius: '8px',
                    border      : 'none',
                    cursor      : 'pointer',
                    fontSize    : '12px',
                    fontWeight  : '600',
                    fontFamily  : 'inherit',
                    background  : (i === 1) === useRange ? PURPLE_MID : '#F3F4F6',
                    color       : (i === 1) === useRange ? '#fff' : '#6B7280',
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* From date */}
          <div>
            <label style={{
              display     : 'block',
              fontSize    : '11px',
              fontWeight  : '700',
              color       : '#4C1D95',
              marginBottom: '5px',
            }}>
              {useRange ? 'From Date' : 'Date'}
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              style={{ ...inputSt, cursor: 'pointer' }}
            />
          </div>

          {/* To date */}
          {useRange && (
            <>
              <div style={{
                alignSelf  : 'flex-end',
                paddingBottom: '8px',
                fontSize   : '20px',
                color      : PURPLE_MID,
                fontWeight : '700',
              }}>
                →
              </div>
              <div>
                <label style={{
                  display     : 'block',
                  fontSize    : '11px',
                  fontWeight  : '700',
                  color       : '#4C1D95',
                  marginBottom: '5px',
                }}>
                  To Date
                </label>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate}
                  onChange={e => setToDate(e.target.value)}
                  style={{ ...inputSt, cursor: 'pointer' }}
                />
              </div>
            </>
          )}

          {/* Quick date buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{
              fontSize  : '11px',
              fontWeight: '700',
              color     : '#4C1D95',
            }}>
              Quick Filters
            </label>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {[
                { label: 'Today',
                  f: today, t: today },
                { label: 'Yesterday',
                  f: format(new Date(Date.now()-86400000),'yyyy-MM-dd'),
                  t: format(new Date(Date.now()-86400000),'yyyy-MM-dd') },
                { label: 'This Week',
                  f: format(new Date(Date.now()-6*86400000),'yyyy-MM-dd'),
                  t: today },
                { label: 'This Month',
                  f: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1),'yyyy-MM-dd'),
                  t: today },
              ].map(q => (
                <button key={q.label}
                  onClick={() => {
                    setFromDate(q.f);
                    setToDate(q.t);
                    setUseRange(q.f !== q.t);
                  }}
                  style={{
                    padding     : '5px 10px',
                    borderRadius: '8px',
                    border      : `1.5px solid ${PURPLE_LIGHT}`,
                    background  : '#F5F3FF',
                    color       : '#6B21A8',
                    fontSize    : '11px',
                    fontWeight  : '600',
                    cursor      : 'pointer',
                    fontFamily  : 'inherit',
                    whiteSpace  : 'nowrap',
                  }}>
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          {/* Refresh + status */}
          <div style={{
            display    : 'flex',
            flexDirection: 'column',
            alignItems : 'flex-end',
            gap        : '4px',
            alignSelf  : 'flex-end',
          }}>
            <button
              onClick={() => load()}
              style={{
                background  : PURPLE_MID,
                color       : '#fff',
                border      : 'none',
                borderRadius: '8px',
                padding     : '8px 14px',
                fontSize    : '13px',
                fontWeight  : '600',
                cursor      : 'pointer',
                fontFamily  : 'inherit',
              }}
            >
              🔄 Refresh
            </button>
            <div style={{
              display    : 'flex',
              alignItems : 'center',
              gap        : '5px',
              fontSize   : '11px',
              color      : '#6B7280',
            }}>
              <div style={{
                width      : '7px',
                height     : '7px',
                borderRadius: '50%',
                background : '#22C55E',
                boxShadow  : '0 0 6px #22C55E',
              }} />
              Live • {format(lastUpd, 'HH:mm:ss')}
            </div>
          </div>
        </div>

        {/* ── Main Results Table ── */}
        {loading ? (
          <LoadingSpinner text="Loading live results..." />
        ) : sampleRows.length === 0 ? (
          <div style={{
            textAlign  : 'center',
            padding    : '80px 20px',
            background : '#fff',
            borderRadius: '16px',
            border     : `1.5px solid ${PURPLE_LIGHT}`,
          }}>
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>📊</div>
            <p style={{ fontWeight: '700', color: '#374151', fontSize: '16px' }}>
              No results to display
            </p>
            <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '6px' }}>
              Results will appear here as analysts submit them.
              Try changing the date filter.
            </p>
          </div>
        ) : (
          <div style={{
            overflowX  : 'auto',
            borderRadius: '16px',
            border     : `2px solid ${PURPLE_LIGHT}`,
            boxShadow  : '0 4px 20px rgba(107,33,168,0.12)',
            background : '#fff',
          }}>
            {/* Row count */}
            <div style={{
              padding    : '10px 16px',
              background : '#F5F3FF',
              borderBottom: `1px solid ${PURPLE_LIGHT}`,
              fontSize   : '12px',
              color      : '#6B21A8',
              fontWeight : '600',
              display    : 'flex',
              justifyContent: 'space-between',
            }}>
              <span>
                📋 Showing {sampleRows.length} sample(s)
                {allTests.length > 0 && ` with ${allTests.length} parameter(s)`}
              </span>
              <span style={{ color: '#9CA3AF' }}>
                Scroll → to see all parameters
              </span>
            </div>

            <table style={{
              borderCollapse: 'collapse',
              width          : '100%',
              fontSize       : '13px',
              tableLayout    : 'auto',
            }}>
              {/* ══ THEAD ══ */}
              <thead>
                {/* Row 1: "SAMPLE INFO" + "PARAMETERS" spanning all tests */}
                <tr>
                  <th style={{
                    ...thFixedStyle,
                    padding    : '12px 14px',
                    fontSize   : '12px',
                    fontWeight : '800',
                    letterSpacing: '0.5px',
                    textAlign  : 'center',
                    color      : '#fff',
                    verticalAlign: 'middle',
                    rowSpan    : 2,
                    borderBottom: '2px solid rgba(255,255,255,0.2)',
                  }}>
                    <div>SAMPLE INFO</div>
                    <div style={{
                      fontSize  : '10px',
                      color     : '#DDD6FE',
                      fontWeight: '400',
                      marginTop : '3px',
                    }}>
                      Name · Reg. Date · Time
                    </div>
                  </th>

                  {allTests.length > 0 ? (
                    <th
                      colSpan={allTests.length}
                      style={thParamGroupStyle}
                    >
                      ⚗️ PARAMETERS
                      <span style={{
                        fontSize  : '10px',
                        fontWeight: '400',
                        color     : '#DDD6FE',
                        marginLeft: '8px',
                      }}>
                        ({allTests.length} test{allTests.length !== 1 ? 's' : ''})
                      </span>
                    </th>
                  ) : (
                    <th style={thParamGroupStyle}>
                      ⚗️ PARAMETERS
                    </th>
                  )}
                </tr>

                {/* Row 2: Individual test sub-columns */}
                <tr>
                  {allTests.length > 0 ? (
                    allTests.map(test => (
                      <th key={test.name} style={thSubColStyle}>
                        <div style={{ fontWeight: '800', fontSize: '13px' }}>
                          {test.name}
                        </div>
                        {test.unit && (
                          <div style={{
                            fontSize  : '10px',
                            color     : 'rgba(255,255,255,0.7)',
                            fontWeight: '400',
                            marginTop : '1px',
                          }}>
                            [{test.unit}]
                          </div>
                        )}
                      </th>
                    ))
                  ) : (
                    <th style={thSubColStyle}>
                      <span style={{ color: '#DDD6FE', fontSize:'11px' }}>
                        No tests yet
                      </span>
                    </th>
                  )}
                </tr>
              </thead>

              {/* ══ TBODY ══ */}
              <tbody>
                {sampleRows.map((row, rowIdx) => {
                  const isEven = rowIdx % 2 === 0;

                  // Map parameters by test name
                  const paramByTest = {};
                  for (const p of row.parameters) {
                    if (p.tests?.name) paramByTest[p.tests.name] = p;
                  }

                  // Is any parameter out of spec?
                  const hasOutOfSpec = row.parameters.some(p =>
                    p.result_status === 'fail_low' ||
                    p.result_status === 'fail_high'
                  );

                  return (
                    <tr
                      key={row.sample?.id || rowIdx}
                      style={{
                        outline   : hasOutOfSpec ? '2px solid #FECACA' : 'none',
                        outlineOffset: '-1px',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.filter = 'brightness(0.96)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.filter = 'brightness(1)';
                      }}
                    >
                      {/* ── Fixed: Sample Info ── */}
                      <td style={tdFixedStyle(isEven)}>
                        {/* Sample name */}
                        <div style={{
                          fontWeight   : '800',
                          fontSize     : '13px',
                          color        : '#1F2937',
                          marginBottom : '4px',
                          lineHeight   : 1.3,
                        }}>
                          {row.sample?.sample_name}
                        </div>

                        {/* Sample number */}
                        <div style={{
                          fontSize     : '10px',
                          color        : PURPLE_MID,
                          fontFamily   : 'monospace',
                          marginBottom : '4px',
                          fontWeight   : '700',
                        }}>
                          {row.sample?.sample_number}
                        </div>

                        {/* Brand + subtype badges */}
                        <div style={{ display:'flex', gap:'3px', flexWrap:'wrap', marginBottom:'5px' }}>
                          {row.sample?.brands?.name && (
                            <span style={{
                              fontSize     : '10px',
                              background   : '#F5F3FF',
                              color        : PURPLE_MID,
                              padding      : '1px 6px',
                              borderRadius : '8px',
                              fontWeight   : '600',
                              border       : `1px solid ${PURPLE_LIGHT}`,
                            }}>
                              {row.sample.brands.name}
                            </span>
                          )}
                          {row.sample?.sample_subtypes?.name && (
                            <span style={{
                              fontSize     : '10px',
                              background   : '#F3F4F6',
                              color        : '#6B7280',
                              padding      : '1px 6px',
                              borderRadius : '8px',
                              fontWeight   : '600',
                            }}>
                              {row.sample.sample_subtypes.name}
                            </span>
                          )}
                        </div>

                        {/* Registration Date + Time */}
                        {row.sample?.registered_at && (
                          <div style={{
                            background   : isEven ? '#EDE9FE' : '#F5F3FF',
                            borderRadius : '6px',
                            padding      : '4px 7px',
                            display      : 'inline-block',
                          }}>
                            <div style={{
                              fontSize  : '10px',
                              color     : '#6B7280',
                              fontWeight: '600',
                            }}>
                              📅 {format(new Date(row.sample.registered_at), 'dd MMM yyyy')}
                            </div>
                            <div style={{
                              fontSize  : '11px',
                              color     : PURPLE_MID,
                              fontWeight: '800',
                              fontFamily: 'monospace',
                            }}>
                              🕐 {format(new Date(row.sample.registered_at), 'HH:mm:ss')}
                            </div>
                          </div>
                        )}

                        {/* Out of spec indicator */}
                        {hasOutOfSpec && (
                          <div style={{
                            marginTop  : '5px',
                            fontSize   : '10px',
                            color      : '#DC2626',
                            fontWeight : '700',
                            background : '#FEF2F2',
                            padding    : '2px 6px',
                            borderRadius: '6px',
                            display    : 'inline-block',
                            border     : '1px solid #FECACA',
                          }}>
                            ⚠️ OUT OF SPEC
                          </div>
                        )}
                      </td>

                      {/* ── Dynamic Parameter Cells ── */}
                      {allTests.length > 0 ? (
                        allTests.map(test => {
                          const p = paramByTest[test.name];

                          if (!p) {
                            // Test not assigned to this sample
                            return (
                              <td key={test.name} style={tdParamStyle(isEven)}>
                                <div style={{
                                  color     : '#E5E7EB',
                                  fontSize  : '20px',
                                  textAlign : 'center',
                                  padding   : '8px 0',
                                }}>
                                  —
                                </div>
                              </td>
                            );
                          }

                          // Find specification for this test
                          const specObj = p.tests?.test_specifications?.find(s =>
                            (!s.brand_id   || s.brand_id   === row.sample?.brand_id) &&
                            (!s.subtype_id || s.subtype_id === row.sample?.subtype_id)
                          ) || p.tests?.test_specifications?.[0];

                          const specDisplay = specObj?.display_spec
                            ? `(${specObj.display_spec})`
                            : specObj?.min_value !== undefined && specObj?.max_value !== undefined
                              ? `(${specObj.min_value} – ${specObj.max_value})`
                              : null;

                          const cs = getCellStyle(p.result_status);

                          return (
                            <td key={test.name} style={tdParamStyle(isEven)}>
                              <div style={{ minWidth: '100px' }}>

                                {/* Specification range (spec in brackets, unit outside) */}
                                {specDisplay && (
                                  <div style={{
                                    fontSize     : '10px',
                                    color        : '#6B7280',
                                    marginBottom : '5px',
                                    textAlign    : 'center',
                                    lineHeight   : 1.3,
                                  }}>
                                    <span style={{ color: '#374151', fontWeight: '600' }}>
                                      {specDisplay}
                                    </span>
                                    {test.unit && (
                                      <span style={{
                                        color      : PURPLE_MID,
                                        fontWeight : '700',
                                        marginLeft : '3px',
                                      }}>
                                        {test.unit}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Result value — BOLD and colour coded */}
                                {p.result_value ? (
                                  <div style={{ textAlign: 'center' }}>
                                    <div style={{
                                      display      : 'inline-block',
                                      background   : cs.resultBg,
                                      color        : cs.resultColor,
                                      border       : `2px solid ${cs.resultBorder}`,
                                      borderRadius : '8px',
                                      padding      : '5px 12px',
                                      fontWeight   : '900',
                                      fontSize     : '15px',
                                      letterSpacing: '0.3px',
                                      minWidth     : '60px',
                                    }}>
                                      {p.result_value}
                                    </div>

                                    {/* Status dot */}
                                    <div style={{
                                      display    : 'flex',
                                      alignItems : 'center',
                                      justifyContent: 'center',
                                      gap        : '3px',
                                      marginTop  : '3px',
                                    }}>
                                      <div style={{
                                        width      : '6px',
                                        height     : '6px',
                                        borderRadius: '50%',
                                        background : cs.dot,
                                      }} />
                                      <span style={{
                                        fontSize  : '9px',
                                        color     : cs.resultColor,
                                        fontWeight: '700',
                                      }}>
                                        {p.result_status === 'fail_low'  ? 'LOW'  :
                                         p.result_status === 'fail_high' ? 'HIGH' :
                                         p.result_status === 'pass' || p.result_status === 'ok' ? 'OK' : ''}
                                      </span>
                                    </div>

                                    {/* Submission Date + Time */}
                                    {p.submitted_at && (
                                      <div style={{
                                        marginTop  : '5px',
                                        background : '#F9FAFB',
                                        borderRadius: '6px',
                                        padding    : '3px 5px',
                                        display    : 'inline-block',
                                      }}>
                                        <div style={{
                                          fontSize  : '9px',
                                          color     : '#9CA3AF',
                                          fontWeight: '600',
                                        }}>
                                          {format(new Date(p.submitted_at), 'dd/MM/yy')}
                                        </div>
                                        <div style={{
                                          fontSize  : '10px',
                                          color     : PURPLE_MID,
                                          fontWeight: '800',
                                          fontFamily: 'monospace',
                                        }}>
                                          {format(new Date(p.submitted_at), 'HH:mm')}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  // Test assigned but no result yet
                                  <div style={{
                                    textAlign  : 'center',
                                    color      : '#D1D5DB',
                                    fontSize   : '11px',
                                    padding    : '6px 0',
                                    fontStyle  : 'italic',
                                  }}>
                                    Pending...
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })
                      ) : (
                        <td style={tdParamStyle(isEven)}>
                          <span style={{ color: '#D1D5DB', fontSize: '12px' }}>
                            No tests assigned
                          </span>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Table footer */}
            <div style={{
              padding        : '8px 16px',
              background     : '#F5F3FF',
              borderTop      : `1px solid ${PURPLE_LIGHT}`,
              fontSize       : '11px',
              color          : '#9CA3AF',
              display        : 'flex',
              justifyContent : 'space-between',
              alignItems     : 'center',
            }}>
              <span>
                {sampleRows.length} sample(s) •{' '}
                {allTests.length} parameter column(s) displayed
              </span>
              <span>
                🟢 Green = Within Spec &nbsp;|&nbsp;
                🔴 Red = Out of Spec &nbsp;|&nbsp;
                — = Not Tested
              </span>
            </div>
          </div>
        )}
      </main>

      {/* CSS for toast animation */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0);    }
        }
      `}</style>

      <PageFooter />
    </div>
  );
}