// ============================================================
// FILE: frontend/bul-qc-app/src/pages/RefDashboardPage.jsx
// Professional Refinery live dashboard
// Three tabs: In-Process | Fractionation | Crystallizer
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import PageFooter       from '../components/PageFooter';
import NotificationBell from '../components/NotificationBell';
import LoadingSpinner   from '../components/LoadingSpinner';
import { useAuth }      from '../context/AuthContext';
import { dashboardService } from '../services/dashboard.service';
import { supabase }     from '../services/supabase';
import { format }       from 'date-fns';

let santosLogo = null;
let bulqcLogo  = null;
try { santosLogo = require('../assets/santos_logo.png'); } catch(e) {}
try { bulqcLogo  = require('../assets/bulqc_logo.png');  } catch(e) {}

// ── Refinery tab definitions ──────────────────────────────
const TABS = [
  {
    key    : 'inprocess',
    label  : 'In-Process',
    icon   : '⚙️',
    catCode: 'REF_INP',
    types  : ['CPO Line','CPL Line','BPO','RBD','RPL','PFAD'],
  },
  {
    key    : 'frac',
    label  : 'Fractionation',
    icon   : '🔬',
    catCode: 'REF_FRAC',
    types  : ['OLEIN','STEARIN','PMF'],
  },
  {
    key    : 'crys',
    label  : 'Crystallizer',
    icon   : '❄️',
    catCode: 'REF_CRYS',
    types  : ['Crystallizer 1','Crystallizer 2','Crystallizer 3',
               'Crystallizer 4','Crystallizer 5','Crystallizer 6',
               'Crystallizer 7','Crystallizer 8','Crystallizer 9'],
  },
];

const playBeep = (freq=660, dur=0.8, type='sine') => {
  try {
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value=freq; osc.type=type;
    gain.gain.setValueAtTime(0.6,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
    osc.start(); osc.stop(ctx.currentTime+dur);
  } catch(e){}
};

const getCS = (status) => ({
  pass     :{ color:'#15803D', bg:'#F0FDF4', border:'#86EFAC', dot:'#22C55E' },
  ok       :{ color:'#15803D', bg:'#F0FDF4', border:'#86EFAC', dot:'#22C55E' },
  fail_low :{ color:'#DC2626', bg:'#FEF2F2', border:'#FECACA', dot:'#EF4444' },
  fail_high:{ color:'#DC2626', bg:'#FEF2F2', border:'#FECACA', dot:'#EF4444' },
  text_ok  :{ color:'#1D4ED8', bg:'#EFF6FF', border:'#BFDBFE', dot:'#60A5FA' },
})[status] || { color:'#374151', bg:'#F9FAFB', border:'#E5E7EB', dot:'#9CA3AF' };

let tid = 0;

const P='#6B21A8', PM='#7C3AED', PL='#EDE9FE', G='#FFB81C';
const HEAD_BG=`linear-gradient(180deg,#5B1894 0%,${P} 100%)`;
const INFO_W=200, TEST_W=150;

export default function RefDashboardPage() {
  const { user, logout }    = useAuth();
  const [results,  setR]    = useState([]);
  const [stats,    setS]    = useState({});
  const [loading,  setL]    = useState(true);
  const [clock,    setC]    = useState(new Date());
  const [lastUpd,  setU]    = useState(new Date());
  const [toasts,   setT]    = useState([]);
  const [oosCount, setOos]  = useState(0);
  const [activeTab,setTab]  = useState('inprocess');
  const [search,   setSr]   = useState('');
  const [from,     setFr]   = useState(format(new Date(),'yyyy-MM-dd'));
  const [to,       setTo]   = useState(format(new Date(),'yyyy-MM-dd'));
  const [range,    setRg]   = useState(false);
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
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      setAv(ev.target.result);
      localStorage.setItem('bul_qc_avatar_'+(user?.id||'g'), ev.target.result);
      setSA(false);
    };
    r.readAsDataURL(f);
  };

  const addToast = useCallback((msg, type='info') => {
    const id = ++tid;
    setT(p => [{ id, msg, type }, ...p.slice(0,3)]);
    setTimeout(() => setT(p => p.filter(t => t.id !== id)), 7000);
  }, []);

  const load = useCallback(async (quiet=false) => {
    try {
      const [r, s] = await Promise.all([
        dashboardService.getLiveResults(),
        dashboardService.getStats(user?.department_id),
      ]);
      setR(r || []);
      setS(s || {});
      const oos = (r||[]).filter(x =>
        x.result_status==='fail_low' || x.result_status==='fail_high'
      );
      setOos(oos.length);
      setU(new Date());
    } catch(e) { console.error(e); }
    finally { if (!quiet) setL(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // ── Realtime subscription — channel name is ref_live_v6 ──
  useEffect(() => {
    const sub = supabase.channel('ref_live_v6')
      .on('postgres_changes',
        { event:'UPDATE', schema:'public', table:'sample_test_assignments' },
        (p) => {
          load(true);
          const oos = p.new.result_status==='fail_low' ||
                      p.new.result_status==='fail_high';
          if (oos) {
            playBeep(440, 1.5, 'square');
            setTimeout(() => playBeep(440, 1.0, 'square'), 600);
            addToast('⚠️ OUT OF SPEC result submitted!', 'error');
          } else if (p.new.result_value) {
            playBeep(660, 0.5, 'sine');
            addToast('✅ New result submitted', 'success');
          }
        }
      ).subscribe();
    return () => sub.unsubscribe();
  }, [load, addToast]);

  // ── Active tab config ─────────────────────────────────────
  const tabConfig = TABS.find(t => t.key === activeTab);

  // ── Filter by date ────────────────────────────────────────
  const dateFilt = results.filter(r => {
    const d = r.registered_samples?.registered_at?.substring(0,10);
    if (!d) return false;
    return range ? (d >= from && d <= to) : d === from;
  });

  // ── Filter by active tab category ────────────────────────
  const tabFilt = dateFilt.filter(r =>
    r.registered_samples?.sample_types?.sample_categories?.code === tabConfig.catCode
  );

  // ── Group by sample ───────────────────────────────────────
  const sMap = {};
  for (const r of tabFilt) {
    const id = r.registered_samples?.id; if (!id) continue;
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
      r.sample?.sample_number?.toLowerCase().includes(q) ||
      r.sample?.sample_types?.name?.toLowerCase().includes(q)
    );
  }

  // ── Collect unique tests for current tab ──────────────────
  const allTests = []; const seenT = new Set(); const tMeta = {};
  for (const row of rows) {
    const sorted = [...row.params].sort(
      (a,b) => (a.tests?.display_order||0) - (b.tests?.display_order||0)
    );
    for (const p of sorted) {
      const name = p.tests?.name; if (!name || seenT.has(name)) continue;
      seenT.add(name);
      const specs = p.tests?.test_specifications || [];
      const spec  = specs.find(s => !s.brand_id && !s.subtype_id) || specs[0] || null;
      const specStr = spec?.display_spec
        ? spec.display_spec
        : (spec?.min_value !== undefined && spec?.max_value !== undefined)
          ? `${spec.min_value}–${spec.max_value}` : null;
      tMeta[name] = { unit: p.tests?.unit||'', spec: specStr };
      allTests.push(name);
    }
  }

  // ── Tab sample counts ─────────────────────────────────────
  const tabCount = (catCode) => {
    const items = dateFilt.filter(r =>
      r.registered_samples?.sample_types?.sample_categories?.code === catCode
    );
    return new Set(items.map(r => r.registered_samples?.id)).size;
  };

  const todayCt = results.filter(r =>
    r.registered_samples?.registered_at?.startsWith(today)
  ).length;

  const initials = (user?.full_name||'?')
    .split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();

  const inp = {
    border:'1.5px solid rgba(255,255,255,0.3)', borderRadius:'7px',
    padding:'5px 9px', fontSize:'12px',
    fontFamily:'inherit', background:'rgba(255,255,255,0.15)',
    color:'#fff', cursor:'pointer',
  };

  return (
    <div style={{ minHeight:'100vh', background:'#F5F3FF', paddingBottom:'46px' }}>

      {/* ════ COMPACT HEADER ════ */}
      <header style={{
        background:`linear-gradient(135deg,${P} 0%,${PM} 100%)`,
        color:'#fff', position:'sticky', top:0, zIndex:100,
        boxShadow:'0 2px 12px rgba(107,33,168,0.4)',
      }}>
        <div style={{
          display:'grid',
          gridTemplateColumns:'1fr auto 1fr',
          alignItems:'center',
          padding:'0 14px', minHeight:'52px', gap:'8px',
        }}>

          {/* LEFT: BUL QC logo + name */}
          <div style={{ display:'flex', alignItems:'center', gap:'9px' }}>
            <div style={{
              width:'42px', height:'42px', borderRadius:'10px',
              overflow:'hidden', flexShrink:0,
              boxShadow:'0 2px 6px rgba(0,0,0,0.25)',
            }}>
              {bulqcLogo
                ? <img src={bulqcLogo} alt="BUL QC"
                    style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                : <div style={{ width:'100%', height:'100%', background:G }}/>
              }
            </div>
            <div>
              <div style={{ fontWeight:'800', fontSize:'14px', lineHeight:1.1 }}>
                Refinery Results Dashboard
              </div>
              <div style={{ fontSize:'10px', color:'#DDD6FE' }}>Live Results</div>
            </div>
          </div>

          {/* CENTRE: Santos logo */}
          <div style={{ display:'flex', justifyContent:'center', alignItems:'center' }}>
            {santosLogo ? (
              <img src={santosLogo} alt="Santos" style={{
                height:'44px', width:'80px', objectFit:'contain',
                borderRadius:'8px', background:'#fff',
                padding:'3px 8px',
                boxShadow:'0 2px 6px rgba(0,0,0,0.15)',
              }}/>
            ) : (
              <div style={{ background:'rgba(255,255,255,0.15)', borderRadius:'8px', padding:'4px 12px', border:'1px solid rgba(255,255,255,0.3)' }}>
                <div style={{ fontSize:'8px', color:'#DDD6FE', fontWeight:'700' }}>Designed by</div>
                <div style={{ fontSize:'13px', color:G, fontWeight:'900' }}>SantosInfographics</div>
              </div>
            )}
          </div>

          {/* RIGHT: clock + OOS badge + bell + avatar + logout */}
          <div style={{ display:'flex', alignItems:'center', gap:'8px', justifyContent:'flex-end' }}>

            <div style={{
              background:'rgba(255,255,255,0.15)', borderRadius:'18px',
              padding:'4px 12px', fontSize:'13px', fontWeight:'800',
              fontFamily:'monospace', letterSpacing:'1px',
              border:'1px solid rgba(255,255,255,0.2)', whiteSpace:'nowrap',
            }}>
              {format(clock,'HH:mm:ss')}
            </div>

            {oosCount > 0 && (
              <div style={{
                background:'#DC2626', color:'#fff',
                borderRadius:'20px', padding:'3px 10px',
                fontSize:'12px', fontWeight:'800',
                boxShadow:'0 0 8px rgba(220,38,38,0.6)',
                display:'flex', alignItems:'center', gap:'4px',
                animation:'pulse 1.5s infinite',
              }}>
                ⚠️ {oosCount} OOS
              </div>
            )}

            <NotificationBell departmentId={user?.department_id}/>

            {/* Avatar */}
            <div style={{ position:'relative' }}>
              <div onClick={() => setSA(!showAv)}
                style={{
                  width:'34px', height:'34px', borderRadius:'50%',
                  background: avatar ? 'transparent' : G,
                  border:'2px solid rgba(255,255,255,0.5)',
                  cursor:'pointer', overflow:'hidden',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontWeight:'800', fontSize:'13px', color:P, flexShrink:0,
                }}>
                {avatar
                  ? <img src={avatar} alt="av" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                  : initials}
              </div>
              {showAv && (
                <div style={{
                  position:'absolute', right:0, top:'40px',
                  background:'#fff', borderRadius:'12px',
                  boxShadow:'0 8px 24px rgba(107,33,168,0.2)',
                  border:`1.5px solid ${PL}`,
                  minWidth:'200px', zIndex:200, overflow:'hidden',
                }}>
                  <div style={{ padding:'10px 14px', background:'#F5F3FF', borderBottom:`1px solid ${PL}` }}>
                    <p style={{ fontWeight:'700', color:'#1F2937', margin:0, fontSize:'13px' }}>{user?.full_name}</p>
                    <p style={{ fontSize:'11px', color:PM, margin:'2px 0 0' }}>{user?.roles?.name}</p>
                  </div>
                  <div style={{ padding:'10px 14px' }}>
                    <input ref={fileRef} type="file" accept="image/*"
                      onChange={uploadAv} style={{ display:'none' }}/>
                    <button onClick={() => fileRef.current?.click()} style={{
                      width:'100%', background:PM, color:'#fff', border:'none',
                      borderRadius:'7px', padding:'8px', fontSize:'12px',
                      fontWeight:'600', cursor:'pointer', fontFamily:'inherit',
                    }}>📷 Upload Photo</button>
                    {avatar && (
                      <button onClick={() => {
                        setAv(null);
                        localStorage.removeItem('bul_qc_avatar_'+(user?.id||'g'));
                        setSA(false);
                      }} style={{
                        width:'100%', background:'#FEF2F2', color:'#DC2626',
                        border:'1px solid #FECACA', borderRadius:'7px', padding:'6px',
                        fontSize:'12px', cursor:'pointer', fontFamily:'inherit', marginTop:'5px',
                      }}>🗑 Remove</button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button onClick={logout} style={{ ...inp, fontWeight:'600', fontSize:'12px' }}>
              🚪 Logout
            </button>
          </div>
        </div>

        {/* Sub-bar: stats + search + date filter */}
        <div style={{
          borderTop:'1px solid rgba(255,255,255,0.15)',
          padding:'6px 14px',
          display:'flex', gap:'8px',
          alignItems:'center', flexWrap:'wrap',
          background:'rgba(0,0,0,0.12)',
        }}>
          {/* Compact stats */}
          {[
            { label:'Today',   val:todayCt,              col:'#DDD6FE' },
            { label:'Pending', val:stats.pending    ||0,  col:'#FCA5A5' },
            { label:'Running', val:stats.in_progress||0,  col:'#FCD34D' },
            { label:'Done',    val:stats.complete   ||0,  col:'#86EFAC' },
            { label:'OOS',     val:oosCount,              col:'#FCA5A5' },
          ].map(s => (
            <div key={s.label} style={{
              display:'flex', alignItems:'center', gap:'5px',
              background:'rgba(255,255,255,0.1)',
              borderRadius:'20px', padding:'3px 10px', fontSize:'12px',
            }}>
              <span style={{ color:s.col, fontWeight:'800' }}>{s.val}</span>
              <span style={{ color:'#DDD6FE', fontWeight:'600' }}>{s.label}</span>
            </div>
          ))}

          <div style={{ flex:1 }}/>

          {/* Search */}
          <input type="text" value={search}
            onChange={e => setSr(e.target.value)}
            placeholder="🔍 Search..."
            style={{ ...inp, minWidth:'130px', cursor:'text' }}/>

          {/* Date mode */}
          <div style={{ display:'flex', gap:'3px' }}>
            {['Day','Range'].map((l,i) => (
              <button key={l} onClick={() => setRg(i===1)}
                style={{
                  ...inp,
                  background: (i===1)===range
                    ? 'rgba(255,255,255,0.35)'
                    : 'rgba(255,255,255,0.1)',
                  fontWeight:'600', padding:'4px 8px',
                }}>
                {l}
              </button>
            ))}
          </div>

          <input type="date" value={from}
            onChange={e => setFr(e.target.value)} style={inp}/>

          {range && (
            <>
              <span style={{ color:'#DDD6FE', fontSize:'14px', fontWeight:'700' }}>→</span>
              <input type="date" value={to} min={from}
                onChange={e => setTo(e.target.value)} style={inp}/>
            </>
          )}

          {/* Quick buttons */}
          {[
            { l:'Today', f:today, t:today },
            { l:'Week',  f:format(new Date(Date.now()-6*86400000),'yyyy-MM-dd'), t:today },
          ].map(q => (
            <button key={q.l}
              onClick={() => { setFr(q.f); setTo(q.t); setRg(q.f!==q.t); }}
              style={{ ...inp, background:'rgba(255,184,28,0.2)', color:G, fontWeight:'700', padding:'4px 8px' }}>
              {q.l}
            </button>
          ))}

          {/* Live indicator */}
          <div style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'11px', color:'#86EFAC' }}>
            <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#22C55E', boxShadow:'0 0 5px #22C55E' }}/>
            {format(lastUpd,'HH:mm:ss')}
          </div>
        </div>

        {/* ── TAB BUTTONS ── */}
        <div style={{
          display:'flex', gap:'4px',
          padding:'6px 14px 8px',
          background:'rgba(0,0,0,0.08)',
          borderTop:'1px solid rgba(255,255,255,0.1)',
        }}>
          {TABS.map(tab => {
            const cnt = tabCount(tab.catCode);
            const isActive = activeTab === tab.key;
            return (
              <button key={tab.key}
                onClick={() => setTab(tab.key)}
                style={{
                  padding:'7px 18px',
                  borderRadius:'8px',
                  border:'none',
                  cursor:'pointer',
                  fontSize:'13px',
                  fontWeight:'700',
                  fontFamily:'inherit',
                  background: isActive
                    ? 'rgba(255,255,255,0.25)'
                    : 'rgba(255,255,255,0.08)',
                  color: isActive ? '#fff' : '#DDD6FE',
                  borderBottom: isActive ? `3px solid ${G}` : '3px solid transparent',
                  display:'flex', alignItems:'center', gap:'6px',
                  transition:'all 0.15s',
                }}>
                {tab.icon} {tab.label}
                <span style={{
                  background: isActive ? G : 'rgba(255,255,255,0.15)',
                  color: isActive ? P : '#DDD6FE',
                  borderRadius:'12px', padding:'1px 7px',
                  fontSize:'11px', fontWeight:'800',
                }}>
                  {cnt}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Toasts */}
      <div style={{
        position:'fixed', top:'130px', right:'12px',
        zIndex:300, display:'flex', flexDirection:'column',
        gap:'6px', maxWidth:'280px',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: t.type==='error' ? '#FEF2F2' : t.type==='success' ? '#F0FDF4' : '#EFF6FF',
            border:`1.5px solid ${t.type==='error'?'#FECACA':t.type==='success'?'#86EFAC':'#BFDBFE'}`,
            borderRadius:'10px', padding:'8px 12px',
            fontSize:'13px', fontWeight:'700',
            color: t.type==='error'?'#DC2626':t.type==='success'?'#16A34A':'#1D4ED8',
            boxShadow:'0 3px 12px rgba(0,0,0,0.1)',
          }}>{t.msg}</div>
        ))}
      </div>

      {/* ════ MAIN RESULTS TABLE ════ */}
      <main style={{ padding:'8px 10px' }}>

        {/* Tab label */}
        <div style={{
          display:'flex', alignItems:'center', gap:'8px',
          marginBottom:'6px', fontSize:'13px',
        }}>
          <span style={{ fontSize:'16px' }}>{tabConfig.icon}</span>
          <span style={{ fontWeight:'800', color:P }}>{tabConfig.label}</span>
          <span style={{ fontSize:'11px', color:'#6B7280' }}>
            — {rows.length} sample(s) • {allTests.length} parameter(s)
          </span>
        </div>

        {loading ? (
          <LoadingSpinner text="Loading live results..."/>
        ) : rows.length === 0 ? (
          <div style={{
            textAlign:'center', padding:'80px',
            background:'#fff', borderRadius:'14px',
            border:`1.5px solid ${PL}`,
          }}>
            <div style={{ fontSize:'48px', marginBottom:'12px' }}>{tabConfig.icon}</div>
            <p style={{ fontWeight:'700', color:'#374151', fontSize:'15px' }}>
              No {tabConfig.label} results for this period
            </p>
            <p style={{ fontSize:'12px', color:'#9CA3AF', marginTop:'5px' }}>
              Covers: {tabConfig.types.join(', ')}
            </p>
          </div>
        ) : (
          <div style={{
            borderRadius:'14px',
            border:`2px solid ${PL}`,
            boxShadow:'0 3px 16px rgba(107,33,168,0.1)',
            background:'#fff',
            overflow:'hidden',
          }}>
            {/* Info bar */}
            <div style={{
              padding:'6px 14px', background:'#F5F3FF',
              borderBottom:`1px solid ${PL}`,
              fontSize:'11px', color:P, fontWeight:'600',
              display:'flex', justifyContent:'space-between',
            }}>
              <span>{rows.length} sample(s) • {allTests.length} parameter(s)</span>
              <span style={{ color:'#9CA3AF' }}>← Scroll right for more parameters</span>
            </div>

            {/* Scrollable table */}
            <div style={{
              overflowX:'auto',
              overflowY:'auto',
              maxHeight:'calc(100vh - 280px)',
            }}>
              <table style={{
                borderCollapse:'separate',
                borderSpacing:0,
                fontSize:'12px',
                tableLayout:'fixed',
              }}>

                {/* HEAD */}
                <thead>
                  <tr>
                    {/* Corner: sample info */}
                    <th style={{
                      position:'sticky', top:0, left:0, zIndex:80,
                      width:`${INFO_W}px`, minWidth:`${INFO_W}px`,
                      padding:'10px 12px', textAlign:'center', verticalAlign:'middle',
                      background:HEAD_BG, color:'#fff',
                      fontWeight:'800', fontSize:'12px',
                      borderRight:'3px solid rgba(255,255,255,0.4)',
                      borderBottom:'2px solid rgba(255,255,255,0.2)',
                      boxShadow:'4px 0 8px rgba(0,0,0,0.15)',
                    }}>
                      SAMPLE INFO
                      <div style={{ fontSize:'9px', color:'#DDD6FE', fontWeight:'400', marginTop:'2px' }}>
                        Name · Date · Time
                      </div>
                    </th>

                    {/* Test columns */}
                    {allTests.map(name => {
                      const m = tMeta[name] || {};
                      return (
                        <th key={name} style={{
                          position:'sticky', top:0, zIndex:70,
                          width:`${TEST_W}px`, minWidth:`${TEST_W}px`,
                          padding:'8px 6px 10px', textAlign:'center', verticalAlign:'middle',
                          background:HEAD_BG,
                          borderLeft:'2px solid rgba(255,255,255,0.2)',
                          borderBottom:'3px solid rgba(255,255,255,0.4)',
                        }}>
                          <div style={{ fontWeight:'800', fontSize:'13px', color:G, lineHeight:1.2 }}>
                            {name}
                          </div>
                          {m.spec && (
                            <div style={{ fontSize:'11px', color:G, fontWeight:'600', marginTop:'2px', lineHeight:1.2 }}>
                              ({m.spec}){m.unit && <span style={{ marginLeft:'2px' }}>{m.unit}</span>}
                            </div>
                          )}
                          {!m.spec && m.unit && (
                            <div style={{ fontSize:'11px', color:G, fontWeight:'600', marginTop:'2px' }}>
                              [{m.unit}]
                            </div>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                {/* BODY */}
                <tbody>
                  {rows.map((row, rowIdx) => {
                    const isEven   = rowIdx % 2 === 0;
                    const rowBg    = isEven ? '#FAFAFA' : '#fff';
                    const stickyBg = isEven ? '#F5F3FF' : '#fff';

                    const pByTest = {};
                    for (const p of row.params) {
                      if (p.tests?.name) pByTest[p.tests.name] = p;
                    }
                    const hasOOS = row.params.some(p =>
                      p.result_status==='fail_low' || p.result_status==='fail_high'
                    );

                    return (
                      <tr key={row.sample?.id || rowIdx}
                        style={{
                          outline: hasOOS ? '2px solid #FECACA' : 'none',
                          outlineOffset:'-1px',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.filter='brightness(0.95)'; }}
                        onMouseLeave={e => { e.currentTarget.style.filter='none'; }}
                      >
                        {/* Sample info — sticky left */}
                        <td style={{
                          position:'sticky', left:0, zIndex:20,
                          width:`${INFO_W}px`, minWidth:`${INFO_W}px`,
                          padding:'9px 12px', verticalAlign:'top',
                          background:stickyBg,
                          borderRight:'3px solid #DDD6FE',
                          borderBottom:'1px solid #EDE9FE',
                          boxShadow:'4px 0 8px rgba(107,33,168,0.07)',
                        }}>
                          {/* Sample type badge */}
                          {row.sample?.sample_types?.name && (
                            <div style={{
                              fontSize:'9px', fontWeight:'700', color:PM,
                              background:'#F5F3FF', padding:'1px 5px',
                              borderRadius:'5px', display:'inline-block',
                              marginBottom:'3px', border:`1px solid ${PL}`,
                            }}>
                              {row.sample.sample_types.name}
                            </div>
                          )}
                          <div style={{ fontWeight:'800', fontSize:'13px', color:'#1F2937', marginBottom:'3px', lineHeight:1.2 }}>
                            {row.sample?.sample_name}
                          </div>
                          <div style={{ fontSize:'10px', color:PM, fontFamily:'monospace', marginBottom:'4px', fontWeight:'700' }}>
                            {row.sample?.sample_number}
                          </div>
                          {row.sample?.registered_at && (
                            <div style={{ background:isEven?'#EDE9FE':'#F5F3FF', borderRadius:'6px', padding:'4px 7px', display:'inline-block' }}>
                              <div style={{ fontSize:'11px', color:'#374151', fontWeight:'700' }}>
                                📅 {format(new Date(row.sample.registered_at),'dd MMM yyyy')}
                              </div>
                              <div style={{ fontSize:'12px', color:PM, fontWeight:'800', fontFamily:'monospace' }}>
                                🕐 {format(new Date(row.sample.registered_at),'HH:mm:ss')}
                              </div>
                            </div>
                          )}
                          {hasOOS && (
                            <div style={{ marginTop:'4px', fontSize:'10px', color:'#DC2626', fontWeight:'800', background:'#FEF2F2', padding:'2px 6px', borderRadius:'5px', display:'inline-block', border:'1px solid #FECACA' }}>
                              ⚠️ OUT OF SPEC
                            </div>
                          )}
                        </td>

                        {/* Result cells */}
                        {allTests.map(testName => {
                          const p = pByTest[testName];
                          const m = tMeta[testName] || {};
                          if (!p) {
                            return (
                              <td key={testName} style={{
                                width:`${TEST_W}px`, minWidth:`${TEST_W}px`,
                                padding:'8px 5px', textAlign:'center',
                                background:rowBg,
                                borderLeft:'2px solid #EDE9FE',
                                borderBottom:'1px solid #EDE9FE',
                                verticalAlign:'middle', color:'#D1D5DB', fontSize:'16px',
                              }}>—</td>
                            );
                          }
                          const cs = getCS(p.result_status);
                          return (
                            <td key={testName} style={{
                              width:`${TEST_W}px`, minWidth:`${TEST_W}px`,
                              padding:'8px 5px', textAlign:'center',
                              background:rowBg,
                              borderLeft:'2px solid #EDE9FE',
                              borderBottom:'1px solid #EDE9FE',
                              verticalAlign:'top',
                            }}>
                              {p.result_value ? (
                                <div>
                                  <div style={{
                                    display:'inline-block',
                                    background:cs.bg, color:cs.color,
                                    border:`2px solid ${cs.border}`,
                                    borderRadius:'7px', padding:'5px 10px',
                                    fontWeight:'900', fontSize:'15px',
                                    letterSpacing:'0.2px',
                                  }}>
                                    {p.result_value}
                                    {m.unit && <span style={{ fontSize:'11px', fontWeight:'700', marginLeft:'2px', opacity:0.8 }}>{m.unit}</span>}
                                  </div>
                                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'3px', marginTop:'3px' }}>
                                    <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:cs.dot }}/>
                                    <span style={{ fontSize:'9px', color:cs.color, fontWeight:'800' }}>
                                      {p.result_status==='fail_low'  ? 'LOW'  :
                                       p.result_status==='fail_high' ? 'HIGH' :
                                       (p.result_status==='pass'||p.result_status==='ok') ? 'OK' : ''}
                                    </span>
                                  </div>
                                  {p.submitted_at && (
                                    <div style={{ marginTop:'4px', background:'#F9FAFB', borderRadius:'5px', padding:'3px 6px', display:'inline-block', border:'1px solid #E5E7EB' }}>
                                      <div style={{ fontSize:'10px', color:'#374151', fontWeight:'700' }}>
                                        {format(new Date(p.submitted_at),'dd/MM/yy')}
                                      </div>
                                      <div style={{ fontSize:'11px', color:PM, fontWeight:'800', fontFamily:'monospace' }}>
                                        {format(new Date(p.submitted_at),'HH:mm')}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div style={{ color:'#D1D5DB', fontSize:'11px', fontStyle:'italic', padding:'6px 0' }}>
                                  Pending
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
            <div style={{
              padding:'5px 12px', background:'#F5F3FF',
              borderTop:`1px solid ${PL}`,
              fontSize:'10px', color:'#9CA3AF',
              display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'4px',
            }}>
              <span>Header fixed while scrolling • {rows.length} samples • {allTests.length} parameters</span>
              <span>🟢 OK &nbsp;|&nbsp; 🔴 Out of Spec &nbsp;|&nbsp; — Not Tested</span>
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes pulse {
          0%,100%{opacity:1} 50%{opacity:0.6}
        }
      `}</style>

      <PageFooter/>
    </div>
  );
}
