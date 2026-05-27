// ============================================================
// FILE: src/pages/BoilerDashboardPage.jsx
// Boiler Dept Live Dashboard — same design as DeptDashboardPage
// Custom sticky header, no Navbar, no Register button
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import PageFooter       from '../components/PageFooter';
import NotificationBell from '../components/NotificationBell';
import { useAuth }      from '../context/AuthContext';
import { supabase }     from '../services/supabase';
import { format, startOfWeek } from 'date-fns';

const PURPLE      = '#6B21A8';
const PURPLE_MID  = '#7C3AED';
const PURPLE_LIGHT= '#EDE9FE';
const GOLD        = '#FFB81C';
const GREEN       = '#16A34A';
const RED         = '#DC2626';

const FUEL_CODES    = ['BLR_PETROL','BLR_DIESEL','BLR_FO'];
const BIOMASS_CODES = ['BLR_WC_DRY','BLR_WC_WET','BLR_BAG_DRY','BLR_BAG_WET','BLR_SD_DRY','BLR_SD_WET'];
const ASH_CODES     = ['BLR_25T_FLY','BLR_25T_BTM','BLR_16T_MDC','BLR_16T_FUR'];
const ALL_BOILER    = [...FUEL_CODES, ...BIOMASS_CODES, ...ASH_CODES];

const TABS = [
  { key:'FUEL',    label:'⛽ Fuels & Liquids', codes: FUEL_CODES,    sub:'Petrol · Diesel · Furnace Oil' },
  { key:'BIOMASS', label:'🪵 Biomass',          codes: BIOMASS_CODES, sub:'Wood Chips · Bagasse · Saw Dust' },
  { key:'ASH',     label:'🏭 Boiler Ash',       codes: ASH_CODES,     sub:'25T Fly/Bottom · 16T MDC/Furnace' },
];

const todayStr  = () => format(new Date(),'yyyy-MM-dd');
const weekStart = () => format(startOfWeek(new Date(),{weekStartsOn:1}),'yyyy-MM-dd');

// ── Beep on OOS ──────────────────────────────────────────
const playBeep = () => {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 660; osc.type = 'sine';
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(); osc.stop(ctx.currentTime + 0.6);
  } catch(e) {}
};

export default function BoilerDashboardPage() {
  const { user, logout } = useAuth();

  const [results,    setResults]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [clock,      setClock]      = useState(new Date());
  const [fromDate,   setFromDate]   = useState(todayStr());
  const [toDate,     setToDate]     = useState(todayStr());
  const [useRange,   setUseRange]   = useState(false);
  const [activeTab,  setActiveTab]  = useState('FUEL');
  const [search,     setSearch]     = useState('');
  const [avatar,     setAvatar]     = useState(null);
  const [showAvatar, setShowAvatar] = useState(false);
  const [prevOOS,    setPrevOOS]    = useState(0);
  const fileRef = useRef(null);

  const initials = (user?.full_name || user?.username || 'BH')
    .split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Load avatar
  useEffect(() => {
    const saved = localStorage.getItem('bul_qc_avatar_'+(user?.id||'g'));
    if (saved) setAvatar(saved);
  }, [user]);

  const uploadAvatar = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target.result;
      setAvatar(b64);
      localStorage.setItem('bul_qc_avatar_'+(user?.id||'g'), b64);
      setShowAvatar(false);
    };
    reader.readAsDataURL(f);
  };

  // ── Load results from Supabase ────────────────────────────
  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const start = new Date(fromDate + 'T00:00:00+03:00').toISOString();
      const end   = new Date((useRange ? toDate : fromDate) + 'T23:59:59+03:00').toISOString();

      const { data, error } = await supabase
        .from('sample_test_assignments')
        .select(`
          id, result_value, result_status, analyst_signature,
          submitted_at, edit_count, is_locked,
          tests (
            id, name, code, unit, result_type, display_order,
            test_specifications ( min_value, max_value, display_spec )
          ),
          registered_samples (
            id, sample_name, sample_number, status,
            registered_at, sampler_name, batch_number, notes,
            sample_types (
              id, name, code,
              sample_categories ( id, name, code )
            )
          )
        `)
        .gte('registered_samples.registered_at', start)
        .lte('registered_samples.registered_at', end)
        .order('registered_samples.registered_at', { ascending: false });

      if (error) throw error;

      const filtered = (data || []).filter(r =>
        ALL_BOILER.includes(r.registered_samples?.sample_types?.code || '')
      );

      // OOS beep
      const oosCount = filtered.filter(r => r.result_status==='fail_low'||r.result_status==='fail_high').length;
      if (oosCount > prevOOS) { playBeep(); }
      setPrevOOS(oosCount);

      setResults(filtered);
    } catch(e) {
      console.error('Boiler load error:', e.message);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, useRange]);

  useEffect(() => { load(); }, [load]);

  // Realtime subscription
  useEffect(() => {
    const sub = supabase.channel('boiler_dash')
      .on('postgres_changes',{event:'*',schema:'public',table:'sample_test_assignments'},()=>load(true))
      .subscribe();
    return () => sub.unsubscribe();
  }, [load]);

  // ── Derived stats ─────────────────────────────────────────
  const uniqIds   = s => [...new Set(s.map(r=>r.registered_samples?.id).filter(Boolean))];
  const todayRes  = results.filter(r => r.registered_samples?.registered_at && format(new Date(r.registered_samples.registered_at),'yyyy-MM-dd')===todayStr());
  const oosRes    = results.filter(r => r.result_status==='fail_low'||r.result_status==='fail_high');
  const pendRes   = results.filter(r => r.registered_samples?.status==='pending');
  const progRes   = results.filter(r => r.registered_samples?.status==='in_progress');
  const doneRes   = results.filter(r => r.registered_samples?.status==='complete');

  const todayCount= uniqIds(todayRes).length;
  const oosCount  = uniqIds(oosRes).length;
  const pendCount = uniqIds(pendRes).length;
  const progCount = uniqIds(progRes).length;
  const doneCount = uniqIds(doneRes).length;

  // ── Current tab results ───────────────────────────────────
  const tabCodes = TABS.find(t=>t.key===activeTab)?.codes || [];
  const tabCount = (codes) => uniqIds(results.filter(r => codes.includes(r.registered_samples?.sample_types?.code||''))).length;

  const tabRes = results.filter(r => tabCodes.includes(r.registered_samples?.sample_types?.code||''));
  const searchRes = tabRes.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (r.registered_samples?.sample_name||'').toLowerCase().includes(s)
        || (r.registered_samples?.sample_number||'').toLowerCase().includes(s)
        || (r.tests?.name||'').toLowerCase().includes(s);
  });

  // Group by sample
  const grouped = searchRes.reduce((acc, r) => {
    const sid = r.registered_samples?.id;
    if (!sid) return acc;
    if (!acc[sid]) acc[sid] = { sample: r.registered_samples, tests: [] };
    acc[sid].tests.push(r);
    return acc;
  }, {});
  const sampleList = Object.values(grouped);

  // ── Eval text result ──────────────────────────────────────
  const evalText = (val, spec) => {
    if (!val || !spec) return null;
    const v = val.toLowerCase().trim();
    const s = spec.toLowerCase().trim();
    if (s === 'pink')              return v === 'pink'   ? 'pass' : 'fail';
    if (s === 'black')             return v === 'black'  ? 'pass' : 'fail';
    if (s === 'nil')               return v === 'nil'    ? 'pass' : 'fail';
    if (s.includes('yellow'))      return (v==='yellow'||v==='light yellow') ? 'pass' : 'fail';
    return null;
  };

  // ── Styles ────────────────────────────────────────────────
  const headerStyle = {
    background: `linear-gradient(135deg, ${PURPLE} 0%, ${PURPLE_MID} 100%)`,
    color     : '#fff',
    position  : 'sticky',
    top       : 0,
    zIndex    : 50,
    boxShadow : '0 3px 16px rgba(107,33,168,0.45)',
  };

  return (
    <div style={{ minHeight:'100vh', background:'#F5F3FF', paddingBottom:'50px' }}>

      {/* ════════════════════════════════════════════════════
          STICKY HEADER — same as Detergent / Refinery
      ════════════════════════════════════════════════════ */}
      <header style={headerStyle}>

        {/* Row 1 — Logo · Title · Clock · OOS · Bell · Avatar · Logout */}
        <div style={{ padding:'0 16px', minHeight:'58px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'8px' }}>

          {/* Left: icon + title */}
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ width:'38px', height:'38px', background:GOLD, borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px', fontWeight:'800', color:PURPLE, boxShadow:'0 2px 8px rgba(0,0,0,0.2)', flexShrink:0 }}>
              🏭
            </div>
            <div>
              <div style={{ fontWeight:'800', fontSize:'15px', lineHeight:1.1 }}>
                Boiler Results Dashboard
              </div>
              <div style={{ fontSize:'10px', color:'#DDD6FE', lineHeight:1.2 }}>
                Live QC Results
              </div>
            </div>
          </div>

          {/* Right controls */}
          <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>

            {/* Clock */}
            <div style={{ background:'rgba(255,255,255,0.15)', borderRadius:'20px', padding:'5px 14px', fontSize:'14px', fontWeight:'800', fontFamily:'monospace', letterSpacing:'1px', display:'flex', alignItems:'center', gap:'5px', border:'1px solid rgba(255,255,255,0.2)' }}>
              {format(clock,'HH:mm:ss')}
            </div>

            {/* Date */}
            <div style={{ background:'rgba(255,255,255,0.1)', borderRadius:'8px', padding:'4px 10px', fontSize:'11px', color:'#DDD6FE', textAlign:'center' }}>
              <div style={{ fontWeight:'600' }}>{format(clock,'EEEE')}</div>
              <div>{format(clock,'dd MMM yyyy')}</div>
            </div>

            {/* OOS badge */}
            {oosCount > 0 && (
              <div style={{ background:RED, borderRadius:'20px', padding:'5px 12px', fontSize:'13px', fontWeight:'900', display:'flex', alignItems:'center', gap:'5px', animation:'pulse 1.5s infinite' }}>
                ⚠️ {oosCount} OOS
              </div>
            )}

            {/* Notification bell */}
            <NotificationBell departmentId={user?.department_id} />

            {/* Avatar */}
            <div style={{ position:'relative' }}>
              <div onClick={()=>setShowAvatar(!showAvatar)}
                style={{ width:'38px', height:'38px', borderRadius:'50%', background:avatar?'transparent':GOLD, border:'2px solid rgba(255,255,255,0.5)', cursor:'pointer', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'800', fontSize:'14px', color:PURPLE, flexShrink:0 }}
                title="Click to change profile picture">
                {avatar
                  ? <img src={avatar} alt="avatar" style={{ width:'100%',height:'100%',objectFit:'cover' }}/>
                  : initials}
              </div>
              {showAvatar && (
                <div style={{ position:'absolute', right:0, top:'46px', background:'#fff', borderRadius:'14px', boxShadow:'0 8px 32px rgba(107,33,168,0.2)', border:`1.5px solid ${PURPLE_LIGHT}`, minWidth:'220px', zIndex:100, overflow:'hidden' }}>
                  <div style={{ padding:'12px 16px', background:'#F5F3FF', borderBottom:`1px solid ${PURPLE_LIGHT}` }}>
                    <p style={{ fontWeight:'700', color:'#1F2937', margin:0 }}>{user?.full_name}</p>
                    <p style={{ fontSize:'11px', color:PURPLE_MID, margin:'2px 0 0' }}>{user?.roles?.name}</p>
                  </div>
                  <div style={{ padding:'12px 16px' }}>
                    <input ref={fileRef} type="file" accept="image/*" onChange={uploadAvatar} style={{ display:'none' }}/>
                    <button onClick={()=>fileRef.current?.click()} style={{ width:'100%', background:PURPLE_MID, color:'#fff', border:'none', borderRadius:'8px', padding:'9px', fontSize:'13px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>
                      📷 Upload Photo
                    </button>
                    {avatar && (
                      <button onClick={()=>{ setAvatar(null); localStorage.removeItem('bul_qc_avatar_'+(user?.id||'g')); setShowAvatar(false); }}
                        style={{ width:'100%', background:'#FEF2F2', color:RED, border:'1px solid #FECACA', borderRadius:'8px', padding:'7px', fontSize:'12px', cursor:'pointer', fontFamily:'inherit', marginTop:'6px' }}>
                        🗑 Remove Photo
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Logout */}
            <button onClick={logout}
              style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.3)', color:'#fff', borderRadius:'8px', padding:'7px 14px', fontSize:'13px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'5px' }}>
              🚪 Logout
            </button>
          </div>
        </div>

        {/* Row 2 — Stats */}
        <div style={{ display:'flex', gap:'8px', padding:'0 16px 10px', flexWrap:'wrap' }}>
          {[
            { label:'Today',   val:todayCount, color:'#C4B5FD' },
            { label:'Pending', val:pendCount,  color:'#FDE68A' },
            { label:'Running', val:progCount,  color:'#FED7AA' },
            { label:'Done',    val:doneCount,  color:'#A7F3D0' },
            { label:'OOS',     val:oosCount,   color:'#FECACA' },
          ].map(s => (
            <div key={s.label} style={{ background:'rgba(255,255,255,0.12)', borderRadius:'10px', padding:'6px 14px', textAlign:'center', minWidth:'70px' }}>
              <div style={{ fontWeight:'900', fontSize:'18px', color:s.color }}>{s.val}</div>
              <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.75)', fontWeight:'600' }}>{s.label}</div>
            </div>
          ))}

          {/* Search */}
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="🔍  Search samples or tests..."
            style={{ flex:1, minWidth:'200px', background:'rgba(255,255,255,0.15)', border:'1.5px solid rgba(255,255,255,0.25)', borderRadius:'10px', padding:'7px 14px', fontSize:'13px', color:'#fff', outline:'none', fontFamily:'inherit' }}/>

          {/* Day / Range */}
          <div style={{ display:'flex', gap:'4px', alignItems:'center' }}>
            <button onClick={()=>setUseRange(false)} style={{ padding:'7px 14px', border:'none', borderRadius:'8px', background:!useRange?'rgba(255,255,255,0.9)':'rgba(255,255,255,0.12)', color:!useRange?PURPLE:'#fff', fontWeight:'700', fontSize:'12px', cursor:'pointer', fontFamily:'inherit' }}>Day</button>
            <button onClick={()=>setUseRange(true)}  style={{ padding:'7px 14px', border:'none', borderRadius:'8px', background:useRange?'rgba(255,255,255,0.9)':'rgba(255,255,255,0.12)', color:useRange?PURPLE:'#fff', fontWeight:'700', fontSize:'12px', cursor:'pointer', fontFamily:'inherit' }}>Range</button>
          </div>
        </div>

        {/* Row 3 — Date picker + Today/Week */}
        <div style={{ display:'flex', gap:'8px', padding:'0 16px 10px', flexWrap:'wrap', alignItems:'center' }}>
          <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}
            style={{ background:'rgba(255,255,255,0.15)', border:'1.5px solid rgba(255,255,255,0.3)', borderRadius:'8px', padding:'6px 12px', fontSize:'13px', color:'#fff', cursor:'pointer', fontFamily:'inherit', outline:'none' }}/>
          {useRange && (
            <>
              <span style={{ color:'rgba(255,255,255,0.7)', fontSize:'14px' }}>→</span>
              <input type="date" value={toDate} min={fromDate} onChange={e=>setToDate(e.target.value)}
                style={{ background:'rgba(255,255,255,0.15)', border:'1.5px solid rgba(255,255,255,0.3)', borderRadius:'8px', padding:'6px 12px', fontSize:'13px', color:'#fff', cursor:'pointer', fontFamily:'inherit', outline:'none' }}/>
            </>
          )}
          <button onClick={()=>{setFromDate(todayStr());setToDate(todayStr());setUseRange(false);}}
            style={{ padding:'6px 14px', background:'rgba(255,215,0,0.25)', border:'1.5px solid rgba(255,215,0,0.5)', color:GOLD, borderRadius:'8px', fontWeight:'700', fontSize:'13px', cursor:'pointer', fontFamily:'inherit' }}>
            Today
          </button>
          <button onClick={()=>{setFromDate(weekStart());setToDate(todayStr());setUseRange(true);}}
            style={{ padding:'6px 14px', background:'rgba(255,215,0,0.25)', border:'1.5px solid rgba(255,215,0,0.5)', color:GOLD, borderRadius:'8px', fontWeight:'700', fontSize:'13px', cursor:'pointer', fontFamily:'inherit' }}>
            Week
          </button>
          {/* Live indicator */}
          <div style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'12px', color:'rgba(255,255,255,0.8)', marginLeft:'4px' }}>
            <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#4ADE80', display:'inline-block', animation:'pulse 1.5s infinite' }}/>
            {format(clock,'HH:mm:ss')}
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display:'flex', borderTop:'1px solid rgba(255,255,255,0.15)' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={()=>setActiveTab(t.key)}
              style={{ flex:1, padding:'9px 4px', border:'none', cursor:'pointer', fontFamily:'inherit', background: activeTab===t.key?'rgba(255,255,255,0.18)':'transparent', color:'#fff', fontSize:'12px', fontWeight:activeTab===t.key?'900':'600', borderBottom: activeTab===t.key?`3px solid ${GOLD}`:'3px solid transparent', transition:'all 0.15s' }}>
              {t.label}
              <span style={{ marginLeft:'5px', background:'rgba(255,255,255,0.18)', borderRadius:'10px', padding:'1px 6px', fontSize:'10px' }}>
                {tabCount(t.codes)}
              </span>
            </button>
          ))}
        </div>
      </header>

      {/* ════════════════════════════════════════════════════
          RESULTS CONTENT
      ════════════════════════════════════════════════════ */}
      <div style={{ padding:'14px', maxWidth:'1200px', margin:'0 auto' }}>

        {/* Sub-description */}
        <div style={{ fontSize:'12px', color:'#9CA3AF', marginBottom:'12px', fontWeight:'600' }}>
          {TABS.find(t=>t.key===activeTab)?.label} — {TABS.find(t=>t.key===activeTab)?.sub}
          {' · '}{sampleList.length} sample(s)
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'80px 20px', background:'#fff', borderRadius:'16px', border:`1.5px solid ${PURPLE_LIGHT}` }}>
            <div style={{ fontSize:'40px', marginBottom:'14px' }}>⏳</div>
            <div style={{ fontWeight:'700', color:PURPLE_MID, fontSize:'16px' }}>Loading results...</div>
            <div style={{ fontSize:'12px', color:'#9CA3AF', marginTop:'6px' }}>Fetching from database</div>
          </div>

        ) : sampleList.length === 0 ? (
          <div style={{ textAlign:'center', padding:'80px 20px', background:'#fff', borderRadius:'16px', border:`1.5px solid ${PURPLE_LIGHT}` }}>
            <div style={{ fontSize:'48px', marginBottom:'14px' }}>📊</div>
            <div style={{ fontWeight:'700', fontSize:'16px', color:'#374151' }}>No results for this period</div>
            <div style={{ fontSize:'13px', color:'#9CA3AF', marginTop:'6px' }}>
              Results appear here in real-time as analysts submit them.
            </div>
          </div>

        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            {sampleList.map(({ sample, tests }) => {
              const hasOOS  = tests.some(r => r.result_status==='fail_low'||r.result_status==='fail_high');
              const allDone = tests.length > 0 && tests.every(r => r.result_value);
              const status  = sample?.status;

              const statusCfg = {
                pending    : { color:'#6B7280', bg:'#F3F4F6', dot:'#9CA3AF', label:'Pending'     },
                in_progress: { color:'#EA580C', bg:'#FFF7ED', dot:'#F97316', label:'In Progress' },
                complete   : { color:GREEN,     bg:'#F0FDF4', dot:'#22C55E', label:'Complete'    },
              }[status] || { color:'#6B7280', bg:'#F3F4F6', dot:'#9CA3AF', label: status||'—' };

              return (
                <div key={sample.id} style={{ background:'#fff', borderRadius:'14px', border:`2px solid ${hasOOS?RED:allDone?'#86EFAC':PURPLE_LIGHT}`, overflow:'hidden', boxShadow: hasOOS?'0 2px 12px rgba(220,38,38,0.1)':'0 1px 6px rgba(107,33,168,0.06)' }}>

                  {/* Sample header */}
                  <div style={{ background: hasOOS?'#FEF2F2':allDone?'#F0FDF4':'#F9FAFB', padding:'12px 16px', borderBottom:`1px solid ${hasOOS?'#FECACA':allDone?'#BBF7D0':PURPLE_LIGHT}` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'8px' }}>
                      <div>
                        <div style={{ fontWeight:'900', fontSize:'15px', color:'#1F2937', marginBottom:'3px' }}>
                          {hasOOS && <span style={{ color:RED, marginRight:'6px' }}>⚠️</span>}
                          {sample.sample_name}
                        </div>
                        <div style={{ fontSize:'12px', color:PURPLE_MID, fontFamily:'monospace', fontWeight:'700', marginBottom:'5px' }}>
                          {sample.sample_number}
                        </div>
                        <div style={{ display:'flex', gap:'5px', flexWrap:'wrap', alignItems:'center' }}>
                          <span style={{ display:'flex', alignItems:'center', gap:'4px', background:statusCfg.bg, color:statusCfg.color, borderRadius:'20px', padding:'2px 9px', fontSize:'11px', fontWeight:'700' }}>
                            <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:statusCfg.dot, display:'inline-block' }}/>
                            {statusCfg.label}
                          </span>
                          <span style={{ fontSize:'11px', background:PURPLE_LIGHT, color:PURPLE, padding:'2px 8px', borderRadius:'6px', fontWeight:'600' }}>
                            {sample.sample_types?.name}
                          </span>
                          {sample.batch_number && (
                            <span style={{ fontSize:'11px', background:'#FFF7ED', color:'#EA580C', padding:'2px 8px', borderRadius:'6px', fontWeight:'600' }}>
                              🚚 {sample.batch_number}
                            </span>
                          )}
                          {sample.notes && (
                            <span style={{ fontSize:'11px', background:'#F0FDF4', color:GREEN, padding:'2px 8px', borderRadius:'6px', fontWeight:'600' }}>
                              {sample.notes}
                            </span>
                          )}
                          {hasOOS && (
                            <span style={{ fontSize:'11px', background:'#FEF2F2', color:RED, padding:'2px 8px', borderRadius:'6px', fontWeight:'800', border:'1px solid #FECACA' }}>
                              ⚠️ OOS
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign:'right', fontSize:'11px', color:'#6B7280' }}>
                        {sample.registered_at && (
                          <>
                            <div>{format(new Date(sample.registered_at),'dd/MM/yyyy')}</div>
                            <div style={{ fontWeight:'700', color:PURPLE_MID }}>{format(new Date(sample.registered_at),'HH:mm')}</div>
                          </>
                        )}
                        {sample.sampler_name && <div style={{ marginTop:'2px' }}>✍️ {sample.sampler_name}</div>}
                      </div>
                    </div>
                  </div>

                  {/* Results table */}
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px', minWidth:'580px' }}>
                      <thead>
                        <tr style={{ background:'#F5F3FF' }}>
                          {['Test','Spec','Result','Unit','Status','Analyst','Time'].map(h => (
                            <th key={h} style={{ padding:'7px 10px', textAlign:'left', fontWeight:'700', color:'#4C1D95', fontSize:'11px', borderBottom:`1px solid ${PURPLE_LIGHT}`, whiteSpace:'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...tests]
                          .sort((a,b)=>(a.tests?.display_order||0)-(b.tests?.display_order||0))
                          .map((r, i) => {
                            const spec    = r.tests?.test_specifications?.[0];
                            const val     = r.result_value;
                            const isText  = r.tests?.result_type === 'text';
                            const isExtra = ['Remarks','Action'].includes(r.tests?.name);

                            let displayStatus = null;
                            if (val && !isExtra) {
                              if (isText && spec?.display_spec) {
                                displayStatus = evalText(val, spec.display_spec);
                              } else if (!isText) {
                                displayStatus = (r.result_status==='fail_low'||r.result_status==='fail_high') ? 'fail' : r.result_value ? 'pass' : null;
                              }
                            }

                            const badge = {
                              pass: { bg:'#DCFCE7', color:GREEN, label:'PASS' },
                              fail: { bg:'#FEF2F2', color:RED,   label:'FAIL' },
                            }[displayStatus] || null;

                            return (
                              <tr key={r.id} style={{ background: i%2===0?'#FAFAFA':'#fff' }}>
                                <td style={{ padding:'8px 10px', borderBottom:`1px solid ${PURPLE_LIGHT}`, fontWeight:isExtra?'500':'700', color:isExtra?'#9CA3AF':'#1F2937', whiteSpace:'nowrap' }}>{r.tests?.name}</td>
                                <td style={{ padding:'8px 10px', borderBottom:`1px solid ${PURPLE_LIGHT}`, color:isExtra?'#D1D5DB':GOLD, fontWeight:'700', fontSize:'11px', whiteSpace:'nowrap' }}>{isExtra?'—':spec?.display_spec||'—'}</td>
                                <td style={{ padding:'8px 10px', borderBottom:`1px solid ${PURPLE_LIGHT}`, fontWeight:'900', fontSize:'13px', color: displayStatus==='fail'?RED:displayStatus==='pass'?GREEN:val?'#1F2937':'#D1D5DB', whiteSpace:'nowrap' }}>{val||'—'}</td>
                                <td style={{ padding:'8px 10px', borderBottom:`1px solid ${PURPLE_LIGHT}`, color:'#9CA3AF', fontSize:'11px', whiteSpace:'nowrap' }}>{r.tests?.unit||'—'}</td>
                                <td style={{ padding:'8px 10px', borderBottom:`1px solid ${PURPLE_LIGHT}` }}>
                                  {badge ? <span style={{ background:badge.bg, color:badge.color, padding:'2px 8px', borderRadius:'8px', fontSize:'10px', fontWeight:'800' }}>{badge.label}</span> : <span style={{ color:'#D1D5DB', fontSize:'11px' }}>—</span>}
                                </td>
                                <td style={{ padding:'8px 10px', borderBottom:`1px solid ${PURPLE_LIGHT}`, color:'#6B7280', fontSize:'11px', whiteSpace:'nowrap' }}>{r.analyst_signature||'—'}</td>
                                <td style={{ padding:'8px 10px', borderBottom:`1px solid ${PURPLE_LIGHT}`, color:'#9CA3AF', fontSize:'11px', whiteSpace:'nowrap' }}>{r.submitted_at?format(new Date(r.submitted_at),'HH:mm'):'—'}</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <PageFooter />
    </div>
  );
}
