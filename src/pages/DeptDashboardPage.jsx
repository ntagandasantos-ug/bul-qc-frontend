// ============================================================
// FILE: frontend/bul-qc-app/src/pages/DeptDashboardPage.jsx
//
// HEADER STRUCTURE (all 3 rows are sticky and fixed):
//
// ┌──────────────┬────────────────────────────────────────┐
// │              │         ⚗️ PARAMETERS (n tests)        │  ← ROW 1
// │ SAMPLE INFO  ├────────┬────────┬────────┬─────────────┤
// │ Name·Date·   │   pH   │   BD   │   AM   │     MC      │  ← ROW 2 (test names gold)
// │    Time      ├────────┼────────┼────────┼─────────────┤
// │              │(9-11)  │(300-450│(18-22) │  (3-6)      │  ← ROW 3 (specs gold + unit)
// │              │  pH    │  g/L   │   %    │    %        │
// └──────────────┴────────┴────────┴────────┴─────────────┘
//
// Only the tbody results scroll. The entire thead is frozen.
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import PageFooter           from '../components/PageFooter';
import NotificationBell     from '../components/NotificationBell';
import LoadingSpinner       from '../components/LoadingSpinner';
import { useAuth }          from '../context/AuthContext';
import { dashboardService } from '../services/dashboard.service';
import { supabase }         from '../services/supabase';
import { format }           from 'date-fns';

let santosLogo = null;
let bulqcLogo  = null;
try { santosLogo = require('../assets/santos_logo.png'); } catch(e) {}
try { bulqcLogo  = require('../assets/bulqc_logo.png');  } catch(e) {}

const playBeep = (freq=660, dur=0.6, type='sine') => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = freq; osc.type = type;
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(); osc.stop(ctx.currentTime + dur);
  } catch(e) {}
};

const getCS = (status) => {
  switch(status) {
    case 'pass': case 'ok':
      return { color:'#15803D', bg:'#F0FDF4', border:'#86EFAC', dot:'#22C55E' };
    case 'fail_low': case 'fail_high':
      return { color:'#DC2626', bg:'#FEF2F2', border:'#FECACA', dot:'#EF4444' };
    case 'text_ok':
      return { color:'#1D4ED8', bg:'#EFF6FF', border:'#BFDBFE', dot:'#60A5FA' };
    default:
      return { color:'#374151', bg:'#F9FAFB', border:'#E5E7EB', dot:'#9CA3AF' };
  }
};

let toastId = 0;

// ── Column widths ─────────────────────────────────────────
const INFO_W = 220;   // sample info column
const TEST_W = 155;   // each test column

// ── Purple theme ──────────────────────────────────────────
const P  = '#6B21A8';
const PM = '#7C3AED';
const PL = '#EDE9FE';
const G  = '#FFB81C';

// ── Shared sticky header cell base style ─────────────────
// All three header rows share the same purple gradient
const HEAD_BG = `linear-gradient(180deg, #5B1894 0%, ${P} 100%)`;

export default function DeptDashboardPage() {
  const { user, logout }    = useAuth();
  const [results,  setR]    = useState([]);
  const [stats,    setS]    = useState({});
  const [loading,  setL]    = useState(true);
  const [clock,    setC]    = useState(new Date());
  const [lastUpd,  setU]    = useState(new Date());
  const [toasts,   setT]    = useState([]);
  const [search,   setSr]   = useState('');
  const [from,     setFr]   = useState(format(new Date(),'yyyy-MM-dd'));
  const [to,       setTo]   = useState(format(new Date(),'yyyy-MM-dd'));
  const [useRange, setRg]   = useState(false);
  const [avatar,   setAv]   = useState(
    () => localStorage.getItem('bul_qc_avatar_'+(user?.id||'g'))
  );
  const [showAv,   setSA]   = useState(false);
  const fileRef = useRef(null);
  const today   = format(new Date(),'yyyy-MM-dd');

  useEffect(() => {
    const t = setInterval(() => setC(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const s = localStorage.getItem('bul_qc_avatar_'+(user?.id||'g'));
    if (s) setAv(s);
  }, [user]);

  const uploadAv = (e) => {
    const f = e.target.files?.[0];
    if (!f || !f.type.startsWith('image/')) return;
    const r = new FileReader();
    r.onload = ev => {
      setAv(ev.target.result);
      localStorage.setItem('bul_qc_avatar_'+(user?.id||'g'), ev.target.result);
      setSA(false);
    };
    r.readAsDataURL(f);
  };

  const addToast = useCallback((msg, type='info') => {
    const id = ++toastId;
    setT(prev => [{ id, msg, type }, ...prev.slice(0,4)]);
    setTimeout(() => setT(prev => prev.filter(t => t.id !== id)), 6000);
  }, []);

  const load = useCallback(async (quiet=false) => {
    try {
      const [r, s] = await Promise.all([
        dashboardService.getLiveResults(),
        dashboardService.getStats(user?.department_id),
      ]);
      setR(r || []); setS(s || {}); setU(new Date());
    } catch(e) { console.error(e); }
    finally { if (!quiet) setL(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const sub = supabase.channel('dept_live_v5')
      .on('postgres_changes',
        { event:'UPDATE', schema:'public', table:'sample_test_assignments' },
        (payload) => {
          load(true);
          const oos = payload.new.result_status==='fail_low' ||
                      payload.new.result_status==='fail_high';
          if (oos) {
            playBeep(440, 1.2, 'square');
            addToast('⚠️ Out of Spec result submitted!', 'error');
          } else if (payload.new.result_value) {
            playBeep(660, 0.5, 'sine');
            addToast('✅ New result submitted', 'success');
          }
        }
      ).subscribe();
    return () => sub.unsubscribe();
  }, [load, addToast]);

  // ── Filter by date ────────────────────────────────────────
  const dateFilt = results.filter(r => {
    const d = r.registered_samples?.registered_at?.substring(0,10);
    if (!d) return false;
    return useRange ? (d >= from && d <= to) : d === from;
  });

  // ── Group by sample ───────────────────────────────────────
  const sMap = {};
  for (const r of dateFilt) {
    const id = r.registered_samples?.id;
    if (!id) continue;
    if (!sMap[id]) sMap[id] = { sample: r.registered_samples, params: [] };
    sMap[id].params.push(r);
  }
  let rows = Object.values(sMap).sort(
    (a,b) => new Date(b.sample?.registered_at||0) - new Date(a.sample?.registered_at||0)
  );

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    rows = rows.filter(r =>
      r.sample?.sample_name?.toLowerCase().includes(q) ||
      r.sample?.sample_number?.toLowerCase().includes(q)
    );
  }

  // ── Collect ALL unique tests + their metadata ─────────────
  const allTests  = [];
  const seenTests = new Set();
  const tMeta     = {};

  for (const row of rows) {
    const sorted = [...row.params].sort(
      (a,b) => (a.tests?.display_order||0) - (b.tests?.display_order||0)
    );
    for (const p of sorted) {
      const name = p.tests?.name;
      if (!name) continue;
      if (!seenTests.has(name)) {
        seenTests.add(name);
        const specs = p.tests?.test_specifications || [];
        const spec  =
          specs.find(s => s.brand_id===row.sample?.brand_id && s.subtype_id===row.sample?.subtype_id) ||
          specs.find(s => s.brand_id===row.sample?.brand_id && !s.subtype_id) ||
          specs.find(s => !s.brand_id && s.subtype_id===row.sample?.subtype_id) ||
          specs.find(s => !s.brand_id && !s.subtype_id) ||
          specs[0] || null;

        const specStr = spec?.display_spec
          ? spec.display_spec
          : (spec?.min_value !== undefined && spec?.max_value !== undefined)
            ? `${spec.min_value} – ${spec.max_value}`
            : null;

        tMeta[name] = { unit: p.tests?.unit || '', spec: specStr };
        allTests.push(name);
      }
    }
  }

  const todayCt = results.filter(r =>
    r.registered_samples?.registered_at?.startsWith(today)
  ).length;

  const initials = (user?.full_name||'?')
    .split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();

  const inp = {
    border:'1.5px solid #DDD6FE', borderRadius:'8px',
    padding:'7px 11px', fontSize:'13px',
    fontFamily:'inherit', background:'#fff', color:'#1F2937',
  };

  return (
    <div style={{ minHeight:'100vh', background:'#F5F3FF', paddingBottom:'50px' }}>

      {/* ════ PAGE HEADER ════ */}
      <header style={{
        background:`linear-gradient(135deg,${P} 0%,${PM} 100%)`,
        color:'#fff',
        boxShadow:'0 3px 16px rgba(107,33,168,0.45)',
        position:'sticky', top:0, zIndex:100,
      }}>
        <div style={{
  padding        : '0 16px',
  minHeight      : '58px',
  display        : 'grid',
  gridTemplateColumns: '1fr auto 1fr',
  alignItems     : 'center',
  gap            : '12px',
}}>

  {/* ── LEFT: BUL QC logo + title ── */}
  <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
    <div style={{
      width:'38px', height:'38px', borderRadius:'10px',
      overflow:'hidden', flexShrink:0,
      boxShadow:'0 2px 8px rgba(0,0,0,0.2)',
    }}>
      {bulqcLogo
        ? <img src={bulqcLogo} alt="BUL QC"
            style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
        : <div style={{ width:'100%', height:'100%', background:'#FFB81C' }}/>
      }
    </div>
    <div>
      <div style={{ fontWeight:'800', fontSize:'15px', lineHeight:1.1 }}>
        {user?.departments?.name||'Detergent'} Live Dashboard
      </div>
      <div style={{ fontSize:'10px', color:'#DDD6FE' }}>
        Real-time QC Results
      </div>
    </div>
  </div>

  {/* ── CENTRE: SantosInfographics logo only ── */}
  <div style={{ display:'flex', justifyContent:'center', alignItems:'center' }}>
    {santosLogo ? (
      <img
        src={santosLogo}
        alt="SantosInfographics"
        title="Designed by SantosInfographics"
        style={{
          height      : '46px',
          width       : 'auto',
          objectFit   : 'contain',
          borderRadius: '8px',
          background  : '#fff',
          padding     : '4px 10px',
          boxShadow   : '0 2px 8px rgba(0,0,0,0.2)',
        }}
      />
    ) : (
      <div style={{
        display       : 'flex',
        flexDirection : 'column',
        alignItems    : 'center',
        background    : 'rgba(255,255,255,0.15)',
        borderRadius  : '10px',
        padding       : '6px 16px',
        border        : '1px solid rgba(255,255,255,0.3)',
      }}>
        <span style={{ fontSize:'10px', color:'#DDD6FE', fontWeight:'700' }}>
          Designed by
        </span>
        <span style={{ fontSize:'15px', color:'#FFB81C', fontWeight:'900' }}>
          SantosInfographics
        </span>
      </div>
    )}
  </div>

  {/* ── RIGHT: Clock | Bell | Avatar | Logout — pushed far right ── */}
  <div style={{
    display        : 'flex',
    alignItems     : 'center',
    gap            : '10px',
    justifyContent : 'flex-end',   /* ← pushes everything to far right */
  }}>

    {/* Clock */}
    <div style={{
      background   : 'rgba(255,255,255,0.15)',
      borderRadius : '20px',
      padding      : '5px 14px',
      fontSize     : '15px',
      fontWeight   : '800',
      fontFamily   : 'monospace',
      letterSpacing: '1px',
      border       : '1px solid rgba(255,255,255,0.2)',
    }}>
      🕐 {format(clock,'HH:mm:ss')}
    </div>

    <NotificationBell departmentId={user?.department_id}/>

    {/* Avatar */}
    <div style={{ position:'relative' }}>
      <div onClick={() => setSA(!showAv)} title="Change profile picture"
        style={{
          width:'38px', height:'38px', borderRadius:'50%',
          background: avatar ? 'transparent' : '#FFB81C',
          border:'2px solid rgba(255,255,255,0.5)',
          cursor:'pointer', overflow:'hidden',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontWeight:'800', fontSize:'14px', color:'#6B21A8', flexShrink:0,
        }}>
        {avatar
          ? <img src={avatar} alt="av"
              style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
          : initials}
      </div>
      {showAv && (
        <div style={{
          position:'absolute', right:0, top:'46px',
          background:'#fff', borderRadius:'14px',
          boxShadow:'0 8px 32px rgba(107,33,168,0.2)',
          border:'1.5px solid #EDE9FE',
          minWidth:'220px', zIndex:200, overflow:'hidden',
        }}>
          <div style={{ padding:'12px 16px', background:'#F5F3FF', borderBottom:'1px solid #EDE9FE' }}>
            <p style={{ fontWeight:'700', color:'#1F2937', margin:0 }}>{user?.full_name}</p>
            <p style={{ fontSize:'11px', color:'#7C3AED', margin:'2px 0 0' }}>{user?.roles?.name}</p>
          </div>
          <div style={{ padding:'12px 16px' }}>
            <input ref={fileRef} type="file" accept="image/*"
              onChange={uploadAv} style={{ display:'none' }}/>
            <button onClick={() => fileRef.current?.click()} style={{
              width:'100%', background:'#7C3AED', color:'#fff',
              border:'none', borderRadius:'8px', padding:'9px',
              fontSize:'13px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit',
            }}>📷 Upload Photo</button>
            {avatar && (
              <button onClick={() => {
                setAv(null);
                localStorage.removeItem('bul_qc_avatar_'+(user?.id||'g'));
                setSA(false);
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

    {/* Logout */}
    <button onClick={logout} style={{
      background   : 'rgba(255,255,255,0.15)',
      border       : '1px solid rgba(255,255,255,0.3)',
      color        : '#fff',
      borderRadius : '8px',
      padding      : '7px 14px',
      fontSize     : '13px',
      fontWeight   : '600',
      cursor       : 'pointer',
      fontFamily   : 'inherit',
    }}>
      🚪 Logout
    </button>

  </div>
</div>
      </header>

      {/* Toasts */}
      <div style={{ position:'fixed', top:'70px', right:'16px', zIndex:300, display:'flex', flexDirection:'column', gap:'8px', maxWidth:'300px' }}>
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
            { label:'Today',       val:todayCt,              icon:'📅', col:PM       },
            { label:'Loaded',      val:rows.length,           icon:'🧪', col:P        },
            { label:'Pending',     val:stats.pending    ||0,  icon:'⏳', col:'#6B7280'},
            { label:'In Progress', val:stats.in_progress||0,  icon:'🔬', col:'#EA580C'},
            { label:'Complete',    val:stats.complete   ||0,  icon:'✅', col:'#16A34A'},
            { label:'Out of Spec', val:stats.out_of_spec||0,  icon:'⚠️', col:'#DC2626'},
          ].map(s => (
            <div key={s.label} style={{ flex:1, minWidth:'80px', background:'#fff', borderRadius:'12px', border:`2px solid ${s.col}22`, padding:'10px 8px', textAlign:'center' }}>
              <div style={{ fontSize:'18px' }}>{s.icon}</div>
              <div style={{ fontSize:'20px', fontWeight:'900', color:s.col }}>{s.val}</div>
              <div style={{ fontSize:'10px', color:'#6B7280', fontWeight:'600' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Search + date filter */}
        <div style={{ background:'#fff', borderRadius:'14px', border:`1.5px solid ${PL}`, padding:'14px 16px', marginBottom:'14px', display:'flex', gap:'12px', flexWrap:'wrap', alignItems:'flex-end' }}>
          <div style={{ flex:1, minWidth:'160px' }}>
            <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'#4C1D95', marginBottom:'5px' }}>🔍 Search</label>
            <input type="text" value={search} onChange={e=>setSr(e.target.value)} placeholder="Sample name or number..." style={{ ...inp, width:'100%', cursor:'text' }}/>
          </div>
          <div>
            <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'#4C1D95', marginBottom:'5px' }}>Mode</label>
            <div style={{ display:'flex', gap:'4px' }}>
              {['Single Day','Date Range'].map((l,i) => (
                <button key={l} onClick={() => setRg(i===1)} style={{ padding:'7px 12px', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'600', fontFamily:'inherit', background:(i===1)===useRange?PM:'#F3F4F6', color:(i===1)===useRange?'#fff':'#6B7280' }}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'#4C1D95', marginBottom:'5px' }}>{useRange?'From':'Date'}</label>
            <input type="date" value={from} onChange={e=>setFr(e.target.value)} style={{ ...inp, cursor:'pointer' }}/>
          </div>
          {useRange && <>
            <div style={{ alignSelf:'flex-end', paddingBottom:'8px', fontSize:'20px', color:PM, fontWeight:'700' }}>→</div>
            <div>
              <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'#4C1D95', marginBottom:'5px' }}>To</label>
              <input type="date" value={to} min={from} onChange={e=>setTo(e.target.value)} style={{ ...inp, cursor:'pointer' }}/>
            </div>
          </>}
          <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
            <label style={{ fontSize:'11px', fontWeight:'700', color:'#4C1D95' }}>Quick</label>
            <div style={{ display:'flex', gap:'5px' }}>
              {[
                { l:'Today',     f:today, t:today },
                { l:'Yesterday', f:format(new Date(Date.now()-86400000),'yyyy-MM-dd'), t:format(new Date(Date.now()-86400000),'yyyy-MM-dd') },
                { l:'Week',      f:format(new Date(Date.now()-6*86400000),'yyyy-MM-dd'), t:today },
              ].map(q => (
                <button key={q.l} onClick={() => { setFr(q.f); setTo(q.t); setRg(q.f!==q.t); }} style={{ padding:'5px 10px', borderRadius:'8px', border:`1.5px solid ${PL}`, background:'#F5F3FF', color:P, fontSize:'11px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>{q.l}</button>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'4px', alignSelf:'flex-end' }}>
            <button onClick={() => load()} style={{ background:PM, color:'#fff', border:'none', borderRadius:'8px', padding:'8px 14px', fontSize:'13px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>🔄 Refresh</button>
            <div style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'11px', color:'#6B7280' }}>
              <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#22C55E', boxShadow:'0 0 6px #22C55E' }}/>
              Live • {format(lastUpd,'HH:mm:ss')}
            </div>
          </div>
        </div>

        {/* ════ RESULTS TABLE ════ */}
        {loading ? (
          <LoadingSpinner text="Loading live results..."/>
        ) : rows.length === 0 ? (
          <div style={{ textAlign:'center', padding:'80px', background:'#fff', borderRadius:'16px', border:`1.5px solid ${PL}` }}>
            <div style={{ fontSize:'56px', marginBottom:'16px' }}>📊</div>
            <p style={{ fontWeight:'700', color:'#374151', fontSize:'16px' }}>No results to display</p>
            <p style={{ fontSize:'13px', color:'#9CA3AF', marginTop:'6px' }}>Results appear as analysts submit them. Try changing the date filter.</p>
          </div>
        ) : (
          <div style={{ borderRadius:'16px', border:`2px solid ${PL}`, boxShadow:'0 4px 20px rgba(107,33,168,0.12)', background:'#fff', overflow:'hidden' }}>

            {/* Info bar */}
            <div style={{ padding:'10px 16px', background:'#F5F3FF', borderBottom:`1px solid ${PL}`, fontSize:'12px', color:P, fontWeight:'600', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>📋 {rows.length} sample(s) • {allTests.length} parameter(s)</span>
              <span style={{ color:'#9CA3AF', fontSize:'11px' }}>← Scroll right to see all parameters →</span>
            </div>

            {/*
              ═══════════════════════════════════════════════════════════
              TABLE SCROLL CONTAINER
              - overflow-x: auto  → scroll right for many parameters
              - overflow-y: auto  → scroll down for many samples
              - max-height        → limits visible area so thead sticks

              The entire <thead> has position:sticky top:0
              All <th> cells also carry position:sticky top:0
              This makes ALL header rows freeze together as one block.

              The sample info column <th> and <td> carry position:sticky left:0
              so it freezes horizontally too.
              ═══════════════════════════════════════════════════════════
            */}
            <div style={{
              overflowX : 'auto',
              overflowY : 'auto',
              maxHeight : 'calc(100vh - 360px)',
            }}>
              <table style={{
                borderCollapse : 'separate',
                borderSpacing  : 0,
                fontSize       : '13px',
              }}>

                {/* ════════════════════════════════════════════
                    THEAD — THREE ROWS, ALL STICKY TOP
                    ════════════════════════════════════════════ */}
                <thead>

                  {/* ── ROW 1: SAMPLE INFO | ⚗️ PARAMETERS ── */}
                  <tr>
                    {/* Corner cell — spans 3 rows, sticky top+left */}
                    <th rowSpan={3} style={{
                      position      : 'sticky',
                      top           : 0,
                      left          : 0,
                      zIndex        : 80,   /* highest — corner */
                      width         : `${INFO_W}px`,
                      minWidth      : `${INFO_W}px`,
                      maxWidth      : `${INFO_W}px`,
                      padding       : '16px 14px',
                      textAlign     : 'center',
                      verticalAlign : 'middle',
                      background    : HEAD_BG,
                      color         : '#fff',
                      fontWeight    : '800',
                      fontSize      : '14px',
                      letterSpacing : '0.5px',
                      borderRight   : '3px solid rgba(255,255,255,0.5)',
                      borderBottom  : '2px solid rgba(255,255,255,0.3)',
                      boxShadow     : '4px 0 10px rgba(0,0,0,0.2)',
                    }}>
                      <div>SAMPLE INFO</div>
                      <div style={{ fontSize:'11px', color:'#DDD6FE', fontWeight:'400', marginTop:'5px', lineHeight:1.5 }}>
                        Name<br/>Date · Time
                      </div>
                    </th>

                    {/* PARAMETERS group header spanning all test columns */}
                    {allTests.length > 0 ? (
                      <th colSpan={allTests.length} style={{
                        position      : 'sticky',
                        top           : 0,
                        zIndex        : 70,
                        padding       : '10px 14px',
                        textAlign     : 'center',
                        fontWeight    : '800',
                        fontSize      : '13px',
                        letterSpacing : '1px',
                        color         : '#fff',
                        background    : HEAD_BG,
                        borderBottom  : '1px solid rgba(255,255,255,0.2)',
                      }}>
                        ⚗️ PARAMETERS
                        <span style={{ fontSize:'11px', fontWeight:'400', color:'#DDD6FE', marginLeft:'8px' }}>
                          ({allTests.length} test{allTests.length!==1?'s':''})
                        </span>
                      </th>
                    ) : (
                      <th style={{ position:'sticky', top:0, zIndex:70, padding:'10px 14px', textAlign:'center', color:'#fff', background:HEAD_BG }}>
                        ⚗️ PARAMETERS
                      </th>
                    )}
                  </tr>

                  {/* ── ROW 2: Test names in GOLD ── */}
                  <tr>
                    {allTests.map(testName => (
                      <th key={'name_'+testName} style={{
                        position      : 'sticky',
                        top           : '41px',   /* offset below row 1 */
                        zIndex        : 70,
                        width         : `${TEST_W}px`,
                        minWidth      : `${TEST_W}px`,
                        maxWidth      : `${TEST_W}px`,
                        padding       : '8px 8px 0px',
                        textAlign     : 'center',
                        verticalAlign : 'bottom',
                        background    : HEAD_BG,
                        borderLeft    : '2px solid rgba(255,255,255,0.25)',
                      }}>
                        {/* Test name — gold, bold */}
                        <div style={{
                          fontWeight   : '800',
                          fontSize     : '14px',
                          color        : G,
                          letterSpacing: '0.3px',
                        }}>
                          {testName}
                        </div>
                      </th>
                    ))}
                  </tr>

                  {/* ── ROW 3: Specs in GOLD under each test name ── */}
                  <tr>
                    {allTests.map(testName => {
                      const m = tMeta[testName] || {};
                      return (
                        <th key={'spec_'+testName} style={{
                          position      : 'sticky',
                          top           : '82px',   /* offset below rows 1+2 */
                          zIndex        : 70,
                          width         : `${TEST_W}px`,
                          minWidth      : `${TEST_W}px`,
                          maxWidth      : `${TEST_W}px`,
                          padding       : '0px 8px 10px',
                          textAlign     : 'center',
                          verticalAlign : 'top',
                          background    : HEAD_BG,
                          borderLeft    : '2px solid rgba(255,255,255,0.25)',
                          borderBottom  : '3px solid rgba(255,255,255,0.5)',
                        }}>
                          {/* Spec range in gold e.g. (9.5 – 11.0) */}
                          {m.spec ? (
                            <div style={{ fontSize:'12px', color:G, fontWeight:'700', lineHeight:1.4 }}>
                              ({m.spec})
                              {m.unit && (
                                <span style={{ color:G, fontWeight:'800', marginLeft:'3px' }}>
                                  {m.unit}
                                </span>
                              )}
                            </div>
                          ) : m.unit ? (
                            <div style={{ fontSize:'12px', color:G, fontWeight:'700' }}>
                              [{m.unit}]
                            </div>
                          ) : (
                            <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.3)' }}>—</div>
                          )}
                        </th>
                      );
                    })}
                  </tr>

                </thead>

                {/* ════════════════════════════════════════════
                    TBODY — SCROLLS UNDER THE FIXED HEADER
                    ════════════════════════════════════════════ */}
                <tbody>
                  {rows.map((row, rowIdx) => {
                    const isEven   = rowIdx % 2 === 0;
                    const rowBg    = isEven ? '#FAFAFA' : '#ffffff';
                    const stickyBg = isEven ? '#F5F3FF' : '#ffffff';

                    const pByTest = {};
                    for (const p of row.params) {
                      if (p.tests?.name) pByTest[p.tests.name] = p;
                    }
                    const hasOOS = row.params.some(p =>
                      p.result_status==='fail_low' || p.result_status==='fail_high'
                    );

                    return (
                      <tr key={row.sample?.id || rowIdx}
                        style={{ outline: hasOOS ? '2px solid #FECACA' : 'none', outlineOffset:'-1px' }}
                        onMouseEnter={e => { e.currentTarget.style.filter='brightness(0.96)'; }}
                        onMouseLeave={e => { e.currentTarget.style.filter='none'; }}
                      >
                        {/* Sample info — sticky left */}
                        <td style={{
                          position     : 'sticky',
                          left         : 0,
                          zIndex       : 30,
                          width        : `${INFO_W}px`,
                          minWidth     : `${INFO_W}px`,
                          maxWidth     : `${INFO_W}px`,
                          padding      : '12px 14px',
                          verticalAlign: 'top',
                          background   : stickyBg,
                          borderRight  : '3px solid #DDD6FE',
                          borderBottom : '1px solid #EDE9FE',
                          boxShadow    : '4px 0 10px rgba(107,33,168,0.08)',
                        }}>
                          <div style={{ fontWeight:'900', fontSize:'14px', color:'#1F2937', marginBottom:'4px', lineHeight:1.3 }}>
                            {row.sample?.sample_name}
                          </div>
                          <div style={{ fontSize:'11px', color:PM, fontFamily:'monospace', marginBottom:'5px', fontWeight:'700' }}>
                            {row.sample?.sample_number}
                          </div>
                          <div style={{ display:'flex', gap:'3px', flexWrap:'wrap', marginBottom:'6px' }}>
                            {row.sample?.brands?.name && (
                              <span style={{ fontSize:'10px', background:'#F5F3FF', color:PM, padding:'1px 6px', borderRadius:'8px', fontWeight:'600', border:`1px solid ${PL}` }}>
                                {row.sample.brands.name}
                              </span>
                            )}
                            {row.sample?.sample_subtypes?.name && (
                              <span style={{ fontSize:'10px', background:'#F3F4F6', color:'#6B7280', padding:'1px 6px', borderRadius:'8px', fontWeight:'600' }}>
                                {row.sample.sample_subtypes.name}
                              </span>
                            )}
                          </div>
                          {row.sample?.registered_at && (
                            <div style={{ background:isEven?'#EDE9FE':'#F5F3FF', borderRadius:'8px', padding:'6px 9px', display:'inline-block' }}>
                              <div style={{ fontSize:'12px', color:'#374151', fontWeight:'700' }}>
                                📅 {format(new Date(row.sample.registered_at),'dd MMM yyyy')}
                              </div>
                              <div style={{ fontSize:'13px', color:PM, fontWeight:'900', fontFamily:'monospace', marginTop:'2px' }}>
                                🕐 {format(new Date(row.sample.registered_at),'HH:mm:ss')}
                              </div>
                            </div>
                          )}
                          {hasOOS && (
                            <div style={{ marginTop:'6px', fontSize:'11px', color:'#DC2626', fontWeight:'800', background:'#FEF2F2', padding:'3px 8px', borderRadius:'6px', display:'inline-block', border:'1px solid #FECACA' }}>
                              ⚠️ OUT OF SPEC
                            </div>
                          )}
                        </td>

                        {/* Result cells — one per test column */}
                        {allTests.map(testName => {
                          const p = pByTest[testName];
                          const m = tMeta[testName] || {};

                          if (!p) {
                            return (
                              <td key={testName} style={{ width:`${TEST_W}px`, minWidth:`${TEST_W}px`, maxWidth:`${TEST_W}px`, padding:'10px 8px', textAlign:'center', background:rowBg, borderLeft:'2px solid #EDE9FE', borderBottom:'1px solid #EDE9FE', verticalAlign:'middle' }}>
                                <span style={{ color:'#D1D5DB', fontSize:'18px' }}>—</span>
                              </td>
                            );
                          }

                          const cs = getCS(p.result_status);

                          return (
                            <td key={testName} style={{ width:`${TEST_W}px`, minWidth:`${TEST_W}px`, maxWidth:`${TEST_W}px`, padding:'10px 8px', textAlign:'center', background:rowBg, borderLeft:'2px solid #EDE9FE', borderBottom:'1px solid #EDE9FE', verticalAlign:'top' }}>
                              {p.result_value ? (
                                <div>
                                  {/* Result value — bold, coloured, with unit */}
                                  <div style={{
                                    display:'inline-block',
                                    background:cs.bg, color:cs.color,
                                    border:`2px solid ${cs.border}`,
                                    borderRadius:'8px', padding:'6px 12px',
                                    fontWeight:'900', fontSize:'17px',
                                    letterSpacing:'0.3px', minWidth:'70px',
                                  }}>
                                    {p.result_value}
                                    {m.unit && (
                                      <span style={{ fontSize:'12px', fontWeight:'700', marginLeft:'2px', opacity:0.8 }}>
                                        {m.unit}
                                      </span>
                                    )}
                                  </div>

                                  {/* Status dot */}
                                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'3px', marginTop:'4px' }}>
                                    <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:cs.dot }}/>
                                    <span style={{ fontSize:'10px', color:cs.color, fontWeight:'800' }}>
                                      {p.result_status==='fail_low'  ? 'LOW'  :
                                       p.result_status==='fail_high' ? 'HIGH' :
                                       (p.result_status==='pass'||p.result_status==='ok') ? 'OK' : ''}
                                    </span>
                                  </div>

                                  {/* Submission date + time */}
                                  {p.submitted_at && (
                                    <div style={{ marginTop:'6px', background:'#F9FAFB', borderRadius:'7px', padding:'4px 8px', display:'inline-block', border:'1px solid #E5E7EB' }}>
                                      <div style={{ fontSize:'11px', color:'#374151', fontWeight:'700' }}>
                                        {format(new Date(p.submitted_at),'dd/MM/yyyy')}
                                      </div>
                                      <div style={{ fontSize:'13px', color:PM, fontWeight:'900', fontFamily:'monospace', marginTop:'1px' }}>
                                        {format(new Date(p.submitted_at),'HH:mm')}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div style={{ color:'#D1D5DB', fontSize:'12px', fontStyle:'italic', padding:'8px 0' }}>
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

            {/* Legend */}
            <div style={{ padding:'8px 16px', background:'#F5F3FF', borderTop:`1px solid ${PL}`, fontSize:'11px', color:'#9CA3AF', display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'6px' }}>
              <span>Header rows are fixed • Scroll down for results • Scroll right for more parameters</span>
              <span>🟢 Green = OK &nbsp;|&nbsp; 🔴 Red = Out of Spec &nbsp;|&nbsp; — = Not Tested</span>
            </div>
          </div>
        )}
      </main>

      <PageFooter/>
    </div>
  );
}
