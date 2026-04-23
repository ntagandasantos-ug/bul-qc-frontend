// ============================================================
// FILE: frontend/bul-qc-app/src/pages/DeptDashboardPage.jsx
//
// KEY FIXES:
//   1. Single header row — no more two-row misalignment
//   2. AM (and all tests) stay in their own column
//   3. Specs (e.g. (9-20)%) shown in black under test name
//   4. Results always appear directly under their test
//   5. Visible vertical lines between every column
//   6. Horizontal scroll on PC
// ============================================================

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

// ── Beep helper ───────────────────────────────────────────
const playBeep = (freq = 660, dur = 0.6, type = 'sine') => {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = type;
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  } catch (e) {}
};

// ── Result colour helper ──────────────────────────────────
const getCellStyle = (status) => {
  switch (status) {
    case 'pass':
    case 'ok':
      return { color:'#15803D', bg:'#F0FDF4', border:'#86EFAC', dot:'#22C55E' };
    case 'fail_low':
    case 'fail_high':
      return { color:'#DC2626', bg:'#FEF2F2', border:'#FECACA', dot:'#EF4444' };
    case 'text_ok':
      return { color:'#1D4ED8', bg:'#EFF6FF', border:'#BFDBFE', dot:'#60A5FA' };
    default:
      return { color:'#374151', bg:'#F9FAFB', border:'#E5E7EB', dot:'#9CA3AF' };
  }
};

let toastId = 0;

export default function DeptDashboardPage() {
  const { user, logout }     = useAuth();
  const [results,   setRes]  = useState([]);
  const [stats,     setStat] = useState({});
  const [loading,   setLoad] = useState(true);
  const [clock,     setClock]= useState(new Date());
  const [lastUpd,   setUpd]  = useState(new Date());
  const [toasts,    setToast]= useState([]);
  const [search,    setSrch] = useState('');
  const [fromDate,  setFrom] = useState(format(new Date(),'yyyy-MM-dd'));
  const [toDate,    setTo]   = useState(format(new Date(),'yyyy-MM-dd'));
  const [useRange,  setRange]= useState(false);
  const [avatar,    setAvt]  = useState(
    () => localStorage.getItem('bul_qc_avatar_'+(user?.id||'g'))
  );
  const [showAvt,   setShowAvt] = useState(false);
  const fileRef = useRef(null);
  const today   = format(new Date(),'yyyy-MM-dd');

  // Clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Avatar upload
  const handleAvtUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 2*1024*1024) { addToast('Image must be under 2MB','error'); return; }
    const r = new FileReader();
    r.onload = (ev) => {
      setAvt(ev.target.result);
      localStorage.setItem('bul_qc_avatar_'+(user?.id||'g'), ev.target.result);
      setShowAvt(false);
      addToast('Profile picture updated!','success');
    };
    r.readAsDataURL(file);
  };

  // Toast
  const addToast = useCallback((msg, type='info') => {
    const id = ++toastId;
    setToast(prev => [{ id, msg, type }, ...prev.slice(0,4)]);
    setTimeout(() => setToast(prev => prev.filter(t => t.id !== id)), 6000);
  }, []);

  // Load data
  const load = useCallback(async (quiet=false) => {
    try {
      const [r, s] = await Promise.all([
        dashboardService.getLiveResults(),
        dashboardService.getStats(user?.department_id),
      ]);
      setRes(r || []);
      setStat(s || {});
      setUpd(new Date());
    } catch (e) { console.error(e); }
    finally { if (!quiet) setLoad(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Realtime subscription
  useEffect(() => {
    const sub = supabase
      .channel('dept_live_v4')
      .on('postgres_changes',
        { event:'UPDATE', schema:'public', table:'sample_test_assignments' },
        (payload) => {
          load(true);
          const oos = payload.new.result_status==='fail_low' ||
                      payload.new.result_status==='fail_high';
          if (oos) { playBeep(440,1.2,'square'); addToast('⚠️ Out of Spec result!','error'); }
          else if (payload.new.result_value) { playBeep(660,0.5,'sine'); addToast('✅ New result submitted','success'); }
        }
      ).subscribe();
    return () => sub.unsubscribe();
  }, [load, addToast]);

  // Filter by date
  const dateFiltered = results.filter(r => {
    const d = r.registered_samples?.registered_at?.substring(0,10);
    if (!d) return false;
    return useRange ? (d >= fromDate && d <= toDate) : d === fromDate;
  });

  // Group by sample
  const sampleMap = {};
  for (const r of dateFiltered) {
    const sId = r.registered_samples?.id;
    if (!sId) continue;
    if (!sampleMap[sId]) sampleMap[sId] = { sample: r.registered_samples, parameters: [] };
    sampleMap[sId].parameters.push(r);
  }
  let rows = Object.values(sampleMap).sort(
    (a,b) => new Date(b.sample?.registered_at||0) - new Date(a.sample?.registered_at||0)
  );

  // Search filter
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    rows = rows.filter(row =>
      row.sample?.sample_name?.toLowerCase().includes(q) ||
      row.sample?.sample_number?.toLowerCase().includes(q)
    );
  }

  // ── Collect ALL unique tests in display order ─────────
  // We also collect the spec for each test so we can show
  // it in the header
  const allTests = [];
  const seenTests = new Set();

  // Build a map: testName → { unit, spec, code }
  const testMeta = {};

  for (const row of rows) {
    const sorted = [...row.parameters].sort(
      (a,b) => (a.tests?.display_order||0)-(b.tests?.display_order||0)
    );
    for (const p of sorted) {
      const key = p.tests?.name;
      if (!key) continue;
      if (!seenTests.has(key)) {
        seenTests.add(key);

        // Find the best spec for this test
        const specs = p.tests?.test_specifications || [];
        const spec =
          specs.find(s => s.brand_id === row.sample?.brand_id && s.subtype_id === row.sample?.subtype_id) ||
          specs.find(s => s.brand_id === row.sample?.brand_id && !s.subtype_id) ||
          specs.find(s => !s.brand_id && s.subtype_id === row.sample?.subtype_id) ||
          specs.find(s => !s.brand_id && !s.subtype_id) ||
          specs[0] || null;

        const specStr = spec?.display_spec
          ? spec.display_spec
          : (spec?.min_value !== undefined && spec?.max_value !== undefined)
            ? `${spec.min_value} – ${spec.max_value}`
            : null;

        testMeta[key] = {
          unit : p.tests?.unit || '',
          spec : specStr,
          code : p.tests?.code || key,
        };
        allTests.push(key);
      }
    }
  }

  const todayCount = results.filter(r =>
    r.registered_samples?.registered_at?.startsWith(today)
  ).length;

  const initials = (user?.full_name||'?')
    .split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();

  // ── Constants ─────────────────────────────────────────
  const PURPLE = '#6B21A8';
  const PMID   = '#7C3AED';
  const PLIGHT = '#EDE9FE';
  const GOLD   = '#FFB81C';

  // Width for the sticky sample info column
  const INFO_W = 220;

  const inputSt = {
    border:'1.5px solid #DDD6FE', borderRadius:'8px',
    padding:'7px 11px', fontSize:'13px',
    fontFamily:'inherit', background:'#fff',
    color:'#1F2937', boxSizing:'border-box',
  };

  // ── Each test column is exactly this wide ─────────────
  const COL_W = 150;

  return (
    <div style={{ minHeight:'100vh', background:'#F5F3FF', paddingBottom:'50px' }}>

      {/* ════ HEADER ════ */}
      <header style={{
        background:`linear-gradient(135deg,${PURPLE} 0%,${PMID} 100%)`,
        color:'#fff',
        boxShadow:'0 3px 16px rgba(107,33,168,0.45)',
        position:'sticky', top:0, zIndex:50,
      }}>
        <div style={{
          padding:'0 16px', minHeight:'58px',
          display:'flex', alignItems:'center',
          justifyContent:'space-between', flexWrap:'wrap', gap:'8px',
        }}>
          {/* Left */}
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{
              width:'38px', height:'38px', background:GOLD,
              borderRadius:'10px', display:'flex',
              alignItems:'center', justifyContent:'center',
              fontSize:'20px', fontWeight:'800', color:PURPLE,
              boxShadow:'0 2px 8px rgba(0,0,0,0.2)', flexShrink:0,
            }}>BUL-QC-LIMS/frontend/bul-qc-app/src/assets/bulqc_logo.png</div>
            <div>
              <div style={{ fontWeight:'800', fontSize:'15px', lineHeight:1.1 }}>
                {user?.departments?.name||'Detergent'} Live Dashboard
              </div>
              <div style={{ fontSize:'10px', color:'#DDD6FE' }}>Real-time QC Results</div>
            </div>
          </div>

          {/* Right */}
          <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
            {/* Clock */}
            <div style={{
              background:'rgba(255,255,255,0.15)', borderRadius:'20px',
              padding:'5px 14px', fontSize:'15px', fontWeight:'800',
              fontFamily:'monospace', letterSpacing:'1px',
              display:'flex', alignItems:'center', gap:'5px',
              border:'1px solid rgba(255,255,255,0.2)',
            }}>
              🕐 {format(clock,'HH:mm:ss')}
            </div>

            <NotificationBell departmentId={user?.department_id} />

            {/* Avatar */}
            <div style={{ position:'relative' }}>
              <div
                onClick={() => setShowAvt(!showAvt)}
                title="Click to change profile picture"
                style={{
                  width:'38px', height:'38px', borderRadius:'50%',
                  background: avatar ? 'transparent' : GOLD,
                  border:'2px solid rgba(255,255,255,0.5)',
                  cursor:'pointer', overflow:'hidden',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontWeight:'800', fontSize:'14px', color:PURPLE, flexShrink:0,
                }}
              >
                {avatar
                  ? <img src={avatar} alt="av" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  : initials
                }
              </div>
              {showAvt && (
                <div style={{
                  position:'absolute', right:0, top:'46px',
                  background:'#fff', borderRadius:'14px',
                  boxShadow:'0 8px 32px rgba(107,33,168,0.2)',
                  border:`1.5px solid ${PLIGHT}`,
                  minWidth:'220px', zIndex:100, overflow:'hidden',
                }}>
                  <div style={{ padding:'12px 16px', background:'#F5F3FF', borderBottom:`1px solid ${PLIGHT}` }}>
                    <p style={{ fontWeight:'700', color:'#1F2937', margin:0 }}>{user?.full_name}</p>
                    <p style={{ fontSize:'11px', color:PMID, margin:'2px 0 0' }}>{user?.roles?.name}</p>
                  </div>
                  <div style={{ padding:'12px 16px' }}>
                    <input ref={fileRef} type="file" accept="image/*"
                      onChange={handleAvtUpload} style={{ display:'none' }} />
                    <button onClick={() => fileRef.current?.click()} style={{
                      width:'100%', background:PMID, color:'#fff', border:'none',
                      borderRadius:'8px', padding:'9px', fontSize:'13px',
                      fontWeight:'600', cursor:'pointer', fontFamily:'inherit',
                    }}>📷 Upload Photo</button>
                    {avatar && (
                      <button onClick={() => {
                        setAvt(null);
                        localStorage.removeItem('bul_qc_avatar_'+(user?.id||'g'));
                        setShowAvt(false);
                      }} style={{
                        width:'100%', background:'#FEF2F2', color:'#DC2626',
                        border:'1px solid #FECACA', borderRadius:'8px',
                        padding:'7px', fontSize:'12px', cursor:'pointer',
                        fontFamily:'inherit', marginTop:'6px',
                      }}>🗑 Remove Photo</button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button onClick={logout} style={{
              background:'rgba(255,255,255,0.15)',
              border:'1px solid rgba(255,255,255,0.3)',
              color:'#fff', borderRadius:'8px',
              padding:'7px 14px', fontSize:'13px',
              fontWeight:'600', cursor:'pointer', fontFamily:'inherit',
            }}>🚪 Logout</button>
          </div>
        </div>
      </header>

      {/* ════ TOASTS ════ */}
      <div style={{
        position:'fixed', top:'70px', right:'16px',
        zIndex:200, display:'flex', flexDirection:'column', gap:'8px', maxWidth:'300px',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: t.type==='error'?'#FEF2F2':t.type==='success'?'#F0FDF4':'#EFF6FF',
            border:`1.5px solid ${t.type==='error'?'#FECACA':t.type==='success'?'#86EFAC':'#BFDBFE'}`,
            borderRadius:'12px', padding:'10px 14px', fontSize:'13px', fontWeight:'600',
            color: t.type==='error'?'#DC2626':t.type==='success'?'#16A34A':'#1D4ED8',
            boxShadow:'0 4px 16px rgba(0,0,0,0.1)',
          }}>{t.msg}</div>
        ))}
      </div>

      <main style={{ padding:'16px' }}>

        {/* Stats */}
        <div style={{ display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap' }}>
          {[
            { label:'Today',       val:todayCount,           icon:'📅', col:PMID     },
            { label:'Loaded',      val:rows.length,          icon:'🧪', col:PURPLE   },
            { label:'Pending',     val:stats.pending    ||0, icon:'⏳', col:'#6B7280'},
            { label:'In Progress', val:stats.in_progress||0, icon:'🔬', col:'#EA580C'},
            { label:'Complete',    val:stats.complete   ||0, icon:'✅', col:'#16A34A'},
            { label:'Out of Spec', val:stats.out_of_spec||0, icon:'⚠️', col:'#DC2626'},
          ].map(s => (
            <div key={s.label} style={{
              flex:1, minWidth:'80px', background:'#fff',
              borderRadius:'12px', border:`2px solid ${s.col}22`,
              padding:'10px 8px', textAlign:'center',
            }}>
              <div style={{ fontSize:'18px' }}>{s.icon}</div>
              <div style={{ fontSize:'20px', fontWeight:'900', color:s.col }}>{s.val}</div>
              <div style={{ fontSize:'10px', color:'#6B7280', fontWeight:'600' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Search + Date Filter */}
        <div style={{
          background:'#fff', borderRadius:'14px',
          border:`1.5px solid ${PLIGHT}`,
          padding:'14px 16px', marginBottom:'14px',
          display:'flex', gap:'12px', flexWrap:'wrap', alignItems:'flex-end',
        }}>
          <div style={{ flex:1, minWidth:'170px' }}>
            <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'#4C1D95', marginBottom:'5px' }}>
              🔍 Search
            </label>
            <input type="text" value={search} onChange={e=>setSrch(e.target.value)}
              placeholder="Sample name or number..."
              style={{ ...inputSt, width:'100%', cursor:'text' }} />
          </div>

          <div>
            <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'#4C1D95', marginBottom:'5px' }}>Mode</label>
            <div style={{ display:'flex', gap:'4px' }}>
              {['Single Day','Date Range'].map((l,i) => (
                <button key={l} onClick={() => setRange(i===1)}
                  style={{
                    padding:'7px 12px', borderRadius:'8px', border:'none',
                    cursor:'pointer', fontSize:'12px', fontWeight:'600', fontFamily:'inherit',
                    background: (i===1)===useRange ? PMID : '#F3F4F6',
                    color:      (i===1)===useRange ? '#fff' : '#6B7280',
                  }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'#4C1D95', marginBottom:'5px' }}>
              {useRange ? 'From' : 'Date'}
            </label>
            <input type="date" value={fromDate} onChange={e=>setFrom(e.target.value)}
              style={{ ...inputSt, cursor:'pointer' }} />
          </div>

          {useRange && (
            <>
              <div style={{ alignSelf:'flex-end', paddingBottom:'8px', fontSize:'20px', color:PMID, fontWeight:'700' }}>→</div>
              <div>
                <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'#4C1D95', marginBottom:'5px' }}>To</label>
                <input type="date" value={toDate} min={fromDate} onChange={e=>setTo(e.target.value)}
                  style={{ ...inputSt, cursor:'pointer' }} />
              </div>
            </>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
            <label style={{ fontSize:'11px', fontWeight:'700', color:'#4C1D95' }}>Quick</label>
            <div style={{ display:'flex', gap:'5px' }}>
              {[
                { l:'Today',     f:today, t:today },
                { l:'Yesterday', f:format(new Date(Date.now()-86400000),'yyyy-MM-dd'), t:format(new Date(Date.now()-86400000),'yyyy-MM-dd') },
                { l:'Week',      f:format(new Date(Date.now()-6*86400000),'yyyy-MM-dd'), t:today },
              ].map(q => (
                <button key={q.l} onClick={() => { setFrom(q.f); setTo(q.t); setRange(q.f!==q.t); }}
                  style={{
                    padding:'5px 10px', borderRadius:'8px',
                    border:`1.5px solid ${PLIGHT}`,
                    background:'#F5F3FF', color:PURPLE,
                    fontSize:'11px', fontWeight:'600',
                    cursor:'pointer', fontFamily:'inherit',
                  }}>
                  {q.l}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'4px', alignSelf:'flex-end' }}>
            <button onClick={() => load()} style={{
              background:PMID, color:'#fff', border:'none',
              borderRadius:'8px', padding:'8px 14px',
              fontSize:'13px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit',
            }}>🔄 Refresh</button>
            <div style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'11px', color:'#6B7280' }}>
              <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#22C55E', boxShadow:'0 0 6px #22C55E' }} />
              Live • {format(lastUpd,'HH:mm:ss')}
            </div>
          </div>
        </div>

        {/* ════ RESULTS TABLE ════ */}
        {loading ? (
          <LoadingSpinner text="Loading live results..." />
        ) : rows.length === 0 ? (
          <div style={{
            textAlign:'center', padding:'80px', background:'#fff',
            borderRadius:'16px', border:`1.5px solid ${PLIGHT}`,
          }}>
            <div style={{ fontSize:'56px', marginBottom:'16px' }}>📊</div>
            <p style={{ fontWeight:'700', color:'#374151', fontSize:'16px' }}>No results to display</p>
            <p style={{ fontSize:'13px', color:'#9CA3AF', marginTop:'6px' }}>
              Results appear here as analysts submit them. Try changing the date filter.
            </p>
          </div>
        ) : (
          <div style={{
            borderRadius:'16px',
            border:`2px solid ${PLIGHT}`,
            boxShadow:'0 4px 20px rgba(107,33,168,0.12)',
            background:'#fff',
          }}>
            {/* Info bar */}
            <div style={{
              padding:'10px 16px', background:'#F5F3FF',
              borderBottom:`1px solid ${PLIGHT}`,
              fontSize:'12px', color:PURPLE, fontWeight:'600',
              display:'flex', justifyContent:'space-between', alignItems:'center',
            }}>
              <span>📋 {rows.length} sample(s) • {allTests.length} parameter(s)</span>
              <span style={{ color:'#9CA3AF', fontSize:'11px' }}>← Scroll right to see all parameters →</span>
            </div>

            {/* ════ THE TABLE ════ */}
            {/*
              CRITICAL FIX: We wrap in overflow-x:auto.
              We use a SINGLE header row.
              The sample info column is sticky.
              Each test column has a fixed width.
              This prevents the AM header from drifting into the sample info column.
            */}
            <div style={{ overflowX:'auto' }}>
              <table style={{
                borderCollapse : 'separate',
                borderSpacing  : 0,
                fontSize       : '13px',
                // Do NOT use width:100% — let columns define their own widths
              }}>

                {/* ════ SINGLE HEADER ROW ════ */}
                <thead>
                  <tr>

                    {/* ── SAMPLE INFO header ── */}
                    <th style={{
                      // Sticky so it never scrolls away
                      position        : 'sticky',
                      left            : 0,
                      zIndex          : 30,
                      // Explicit fixed width — MUST match the td width below
                      width           : `${INFO_W}px`,
                      minWidth        : `${INFO_W}px`,
                      maxWidth        : `${INFO_W}px`,
                      padding         : '14px 14px',
                      textAlign       : 'center',
                      verticalAlign   : 'middle',
                      background      : `linear-gradient(180deg,${PURPLE} 0%,#5B1894 100%)`,
                      color           : '#fff',
                      fontWeight      : '800',
                      fontSize        : '13px',
                      letterSpacing   : '0.5px',
                      // Strong right border to visually separate from params
                      borderRight     : '3px solid rgba(255,255,255,0.5)',
                      borderBottom    : '2px solid rgba(255,255,255,0.2)',
                      // Shadow so sticky column covers scrolling content
                      boxShadow       : '4px 0 10px rgba(0,0,0,0.18)',
                    }}>
                      <div>SAMPLE INFO</div>
                      <div style={{ fontSize:'10px', color:'#DDD6FE', fontWeight:'400', marginTop:'4px' }}>
                        Name · Date · Time
                      </div>
                    </th>

                    {/* ── One header cell per test — in same row ── */}
                    {allTests.map((testName) => {
                      const meta = testMeta[testName] || {};
                      return (
                        <th key={testName} style={{
                          width          : `${COL_W}px`,
                          minWidth       : `${COL_W}px`,
                          maxWidth       : `${COL_W}px`,
                          padding        : '12px 8px',
                          textAlign      : 'center',
                          verticalAlign  : 'top',
                          background     : `linear-gradient(180deg,${PURPLE} 0%,#5B1894 100%)`,
                          // Visible vertical line between every test column
                          borderLeft     : '2px solid rgba(255,255,255,0.3)',
                          borderBottom   : '2px solid rgba(255,255,255,0.2)',
                        }}>
                          {/* Test name in gold */}
                          <div style={{
                            fontWeight   : '800',
                            fontSize     : '14px',
                            color        : GOLD,
                            letterSpacing: '0.3px',
                          }}>
                            {testName}
                          </div>

                          {/* Spec range in WHITE/light so it's clear */}
                          {meta.spec ? (
                            <div style={{
                              marginTop  : '4px',
                              fontSize   : '11px',
                              color      : '#ffffff',    // white so it's readable on purple
                              fontWeight : '600',
                            }}>
                              ({meta.spec})
                              {meta.unit && (
                                <span style={{ color:GOLD, fontWeight:'700', marginLeft:'3px' }}>
                                  {meta.unit}
                                </span>
                              )}
                            </div>
                          ) : meta.unit ? (
                            <div style={{ marginTop:'4px', fontSize:'11px', color:GOLD, fontWeight:'600' }}>
                              [{meta.unit}]
                            </div>
                          ) : null}
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                {/* ════ BODY ROWS ════ */}
                <tbody>
                  {rows.map((row, rowIdx) => {
                    const isEven     = rowIdx % 2 === 0;
                    const rowBg      = isEven ? '#FAFAFA' : '#ffffff';
                    const stickyBg   = isEven ? '#F5F3FF' : '#ffffff';

                    // Map parameters by test name for O(1) lookup
                    const paramByTest = {};
                    for (const p of row.parameters) {
                      if (p.tests?.name) paramByTest[p.tests.name] = p;
                    }

                    const hasOOS = row.parameters.some(p =>
                      p.result_status==='fail_low' || p.result_status==='fail_high'
                    );

                    return (
                      <tr
                        key={row.sample?.id || rowIdx}
                        style={{
                          outline      : hasOOS ? '2px solid #FECACA' : 'none',
                          outlineOffset: '-1px',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.filter='brightness(0.96)'; }}
                        onMouseLeave={e => { e.currentTarget.style.filter='none'; }}
                      >

                        {/* ── STICKY: Sample Info cell ── */}
                        <td style={{
                          // MUST match header width exactly
                          width        : `${INFO_W}px`,
                          minWidth     : `${INFO_W}px`,
                          maxWidth     : `${INFO_W}px`,
                          padding      : '12px 14px',
                          verticalAlign: 'top',
                          // Sticky with solid background — covers scrolling params
                          position     : 'sticky',
                          left         : 0,
                          zIndex       : 20,
                          background   : stickyBg,
                          // Strong right border
                          borderRight  : '3px solid #DDD6FE',
                          borderBottom : '1px solid #EDE9FE',
                          // Shadow covers scrolling content visually
                          boxShadow    : '4px 0 10px rgba(107,33,168,0.10)',
                        }}>
                          {/* Sample name bold */}
                          <div style={{ fontWeight:'900', fontSize:'14px', color:'#1F2937', marginBottom:'4px', lineHeight:1.3 }}>
                            {row.sample?.sample_name}
                          </div>

                          {/* Sample number */}
                          <div style={{ fontSize:'11px', color:PMID, fontFamily:'monospace', marginBottom:'5px', fontWeight:'700' }}>
                            {row.sample?.sample_number}
                          </div>

                          {/* Brand + subtype badges */}
                          <div style={{ display:'flex', gap:'3px', flexWrap:'wrap', marginBottom:'6px' }}>
                            {row.sample?.brands?.name && (
                              <span style={{
                                fontSize:'10px', background:'#F5F3FF', color:PMID,
                                padding:'1px 6px', borderRadius:'8px', fontWeight:'600',
                                border:`1px solid ${PLIGHT}`,
                              }}>
                                {row.sample.brands.name}
                              </span>
                            )}
                            {row.sample?.sample_subtypes?.name && (
                              <span style={{
                                fontSize:'10px', background:'#F3F4F6', color:'#6B7280',
                                padding:'1px 6px', borderRadius:'8px', fontWeight:'600',
                              }}>
                                {row.sample.sample_subtypes.name}
                              </span>
                            )}
                          </div>

                          {/* Registration Date + Time — clear and large */}
                          {row.sample?.registered_at && (
                            <div style={{
                              background:isEven?'#EDE9FE':'#F5F3FF',
                              borderRadius:'8px', padding:'6px 9px', display:'inline-block',
                            }}>
                              <div style={{ fontSize:'12px', color:'#374151', fontWeight:'700' }}>
                                📅 {format(new Date(row.sample.registered_at),'dd MMM yyyy')}
                              </div>
                              <div style={{
                                fontSize:'13px', color:PMID,
                                fontWeight:'900', fontFamily:'monospace', marginTop:'2px',
                              }}>
                                🕐 {format(new Date(row.sample.registered_at),'HH:mm:ss')}
                              </div>
                            </div>
                          )}

                          {/* Out of spec badge */}
                          {hasOOS && (
                            <div style={{
                              marginTop:'6px', fontSize:'11px', color:'#DC2626',
                              fontWeight:'800', background:'#FEF2F2',
                              padding:'3px 8px', borderRadius:'6px',
                              display:'inline-block', border:'1px solid #FECACA',
                            }}>
                              ⚠️ OUT OF SPEC
                            </div>
                          )}
                        </td>

                        {/* ── One result cell per test column ── */}
                        {allTests.map((testName) => {
                          const p    = paramByTest[testName];
                          const meta = testMeta[testName] || {};

                          // No result for this test in this sample
                          if (!p) {
                            return (
                              <td key={testName} style={{
                                width        : `${COL_W}px`,
                                minWidth     : `${COL_W}px`,
                                maxWidth     : `${COL_W}px`,
                                padding      : '10px 8px',
                                textAlign    : 'center',
                                background   : rowBg,
                                borderLeft   : '2px solid #EDE9FE',
                                borderBottom : '1px solid #EDE9FE',
                                verticalAlign: 'middle',
                              }}>
                                <span style={{ color:'#D1D5DB', fontSize:'18px' }}>—</span>
                              </td>
                            );
                          }

                          const cs = getCellStyle(p.result_status);

                          return (
                            <td key={testName} style={{
                              width        : `${COL_W}px`,
                              minWidth     : `${COL_W}px`,
                              maxWidth     : `${COL_W}px`,
                              padding      : '10px 8px',
                              textAlign    : 'center',
                              background   : rowBg,
                              borderLeft   : '2px solid #EDE9FE',
                              borderBottom : '1px solid #EDE9FE',
                              verticalAlign: 'top',
                            }}>

                              {p.result_value ? (
                                <div>
                                  {/* Result value — BOLD large coloured bubble with unit */}
                                  <div style={{
                                    display      : 'inline-block',
                                    background   : cs.bg,
                                    color        : cs.color,
                                    border       : `2px solid ${cs.border}`,
                                    borderRadius : '8px',
                                    padding      : '6px 12px',
                                    fontWeight   : '900',
                                    fontSize     : '17px',
                                    letterSpacing: '0.3px',
                                    minWidth     : '70px',
                                  }}>
                                    {p.result_value}
                                    {meta.unit && (
                                      <span style={{ fontSize:'12px', fontWeight:'700', marginLeft:'2px', opacity:0.8 }}>
                                        {meta.unit}
                                      </span>
                                    )}
                                  </div>

                                  {/* Status dot + label */}
                                  <div style={{
                                    display:'flex', alignItems:'center',
                                    justifyContent:'center', gap:'3px', marginTop:'4px',
                                  }}>
                                    <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:cs.dot }} />
                                    <span style={{ fontSize:'10px', color:cs.color, fontWeight:'800' }}>
                                      {p.result_status==='fail_low'  ? 'LOW'  :
                                       p.result_status==='fail_high' ? 'HIGH' :
                                       (p.result_status==='pass'||p.result_status==='ok') ? 'OK' : ''}
                                    </span>
                                  </div>

                                  {/* Submission Date + Time — clear and readable */}
                                  {p.submitted_at && (
                                    <div style={{
                                      marginTop   : '6px',
                                      background  : '#F9FAFB',
                                      borderRadius: '7px',
                                      padding     : '4px 8px',
                                      display     : 'inline-block',
                                      border      : '1px solid #E5E7EB',
                                    }}>
                                      <div style={{ fontSize:'11px', color:'#374151', fontWeight:'700' }}>
                                        {format(new Date(p.submitted_at),'dd/MM/yyyy')}
                                      </div>
                                      <div style={{
                                        fontSize:'13px', color:PMID,
                                        fontWeight:'900', fontFamily:'monospace', marginTop:'1px',
                                      }}>
                                        {format(new Date(p.submitted_at),'HH:mm')}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div style={{
                                  color:'#D1D5DB', fontSize:'12px',
                                  fontStyle:'italic', padding:'8px 0',
                                }}>
                                  Pending...
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Legend footer */}
            <div style={{
              padding:'8px 16px', background:'#F5F3FF',
              borderTop:`1px solid ${PLIGHT}`,
              fontSize:'11px', color:'#9CA3AF',
              display:'flex', justifyContent:'space-between',
              alignItems:'center', flexWrap:'wrap', gap:'6px',
            }}>
              <span>{rows.length} sample(s) • {allTests.length} column(s)</span>
              <span>🟢 Green = OK &nbsp;|&nbsp; 🔴 Red = Out of Spec &nbsp;|&nbsp; — = Not Tested</span>
            </div>
          </div>
        )}
      </main>

      <PageFooter />
    </div>
  );
}
