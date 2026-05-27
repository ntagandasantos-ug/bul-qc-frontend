// ============================================================
// FILE: src/pages/BoilerDashboardPage.jsx
// Boiler Department Live Results Dashboard
// Same design pattern as RefDashboardPage / FPDashboardPage
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar     from '../components/Navbar';
import PageFooter from '../components/PageFooter';
import { useAuth }   from '../context/AuthContext';
import { supabase }  from '../services/supabase';
import { format, startOfWeek } from 'date-fns';

const P  = '#6B21A8';
const PM = '#7C3AED';
const PL = '#EDE9FE';
const G  = '#FFB81C';
const GR = '#16A34A';
const RD = '#DC2626';

// ── Category tabs ────────────────────────────────────────
const TABS = [
  { key:'BOILER_FUEL',    label:'⛽ Fuels & Liquids', sub:'Petrol · Diesel · Furnace Oil' },
  { key:'BOILER_BIOMASS', label:'🪵 Biomass',          sub:'Wood Chips · Bagasse · Saw Dust' },
  { key:'BOILER_ASH',     label:'🏭 Boiler Ash',       sub:'25T Fly/Bottom · 16T MDC/Furnace' },
];

const FUEL_CODES    = ['BLR_PETROL','BLR_DIESEL','BLR_FO'];
const BIOMASS_CODES = ['BLR_WC_DRY','BLR_WC_WET','BLR_BAG_DRY','BLR_BAG_WET','BLR_SD_DRY','BLR_SD_WET'];
const ASH_CODES     = ['BLR_25T_FLY','BLR_25T_BTM','BLR_16T_MDC','BLR_16T_FUR'];

const TAB_CODES = {
  BOILER_FUEL   : FUEL_CODES,
  BOILER_BIOMASS: BIOMASS_CODES,
  BOILER_ASH    : ASH_CODES,
};

const todayStr    = () => format(new Date(), 'yyyy-MM-dd');
const weekStart   = () => format(startOfWeek(new Date(),{weekStartsOn:1}), 'yyyy-MM-dd');

export default function BoilerDashboardPage() {
  const navigate = useNavigate();
  const { user, timeLeft } = useAuth();

  const [tab,     setTab]    = useState('BOILER_FUEL');
  const [results, setRes]    = useState([]);
  const [loading, setLoad]   = useState(true);
  const [from,    setFrom]   = useState(todayStr());
  const [to,      setTo]     = useState(todayStr());
  const [range,   setRange]  = useState(false);
  const [search,  setSearch] = useState('');
  const [now,     setNow]    = useState(new Date());

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Load results via Supabase directly ───────────────────
  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoad(true);
    try {
      const startDt = new Date(from + 'T00:00:00+03:00').toISOString();
      const endDt   = new Date((range ? to : from) + 'T23:59:59+03:00').toISOString();

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
        .gte('registered_samples.registered_at', startDt)
        .lte('registered_samples.registered_at', endDt)
        .order('registered_samples.registered_at', { ascending: false });

      if (error) throw error;

      // Filter to Boiler department only
      const boilerCats = [...FUEL_CODES, ...BIOMASS_CODES, ...ASH_CODES];
      const filtered = (data || []).filter(r => {
        const code = r.registered_samples?.sample_types?.code;
        return code && boilerCats.includes(code);
      });

      setRes(filtered);
    } catch(e) {
      console.error('Boiler load error:', e.message);
    } finally {
      setLoad(false);
    }
  }, [from, to, range]);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    const sub = supabase.channel('boiler_live')
      .on('postgres_changes', {
        event : '*',
        schema: 'public',
        table : 'sample_test_assignments',
      }, () => load(true))
      .subscribe();
    return () => sub.unsubscribe();
  }, [load]);

  // ── Derived stats ────────────────────────────────────────
  const allIds    = [...new Set(results.map(r => r.registered_samples?.id).filter(Boolean))];
  const todayIds  = [...new Set(results.filter(r => {
    const d = r.registered_samples?.registered_at;
    return d && format(new Date(d),'yyyy-MM-dd') === todayStr();
  }).map(r => r.registered_samples?.id).filter(Boolean))];
  const pendIds   = [...new Set(results.filter(r => r.registered_samples?.status==='pending').map(r=>r.registered_samples?.id).filter(Boolean))];
  const inProgIds = [...new Set(results.filter(r => r.registered_samples?.status==='in_progress').map(r=>r.registered_samples?.id).filter(Boolean))];
  const compIds   = [...new Set(results.filter(r => r.registered_samples?.status==='complete').map(r=>r.registered_samples?.id).filter(Boolean))];
  const oosIds    = [...new Set(results.filter(r => r.result_status==='fail_low'||r.result_status==='fail_high').map(r=>r.registered_samples?.id).filter(Boolean))];

  // ── Tab filter ───────────────────────────────────────────
  const tabCodes = TAB_CODES[tab] || [];
  const tabCount = (key) => [...new Set(
    results
      .filter(r => TAB_CODES[key].includes(r.registered_samples?.sample_types?.code||''))
      .map(r => r.registered_samples?.id).filter(Boolean)
  )].length;

  const tabRes = results.filter(r =>
    tabCodes.includes(r.registered_samples?.sample_types?.code||'')
  );

  const filtered = tabRes.filter(r => {
    if (!search) return true;
    const name = (r.registered_samples?.sample_name||'').toLowerCase();
    const num  = (r.registered_samples?.sample_number||'').toLowerCase();
    const test = (r.tests?.name||'').toLowerCase();
    const s    = search.toLowerCase();
    return name.includes(s) || num.includes(s) || test.includes(s);
  });

  // Group by sample
  const grouped = filtered.reduce((acc, r) => {
    const sid = r.registered_samples?.id;
    if (!sid) return acc;
    if (!acc[sid]) acc[sid] = { sample: r.registered_samples, tests: [] };
    acc[sid].tests.push(r);
    return acc;
  }, {});

  const sampleList = Object.values(grouped);

  // ── Evaluate text result ─────────────────────────────────
  const evalText = (val, spec) => {
    if (!val || !spec) return null;
    const v = val.toLowerCase().trim();
    const s = spec.toLowerCase().trim();
    if (s === 'pink')   return v === 'pink'   ? 'pass' : 'fail';
    if (s === 'black')  return v === 'black'  ? 'pass' : 'fail';
    if (s === 'nil')    return v === 'nil'    ? 'pass' : 'fail';
    if (s.includes('yellow')) return (v==='yellow'||v==='light yellow') ? 'pass' : 'fail';
    return null;
  };

  const inp = {
    background : 'rgba(255,255,255,0.15)',
    border     : '1.5px solid rgba(255,255,255,0.3)',
    borderRadius: '9px',
    padding    : '7px 12px',
    fontSize   : '13px',
    fontFamily : 'inherit',
    color      : '#fff',
    outline    : 'none',
    cursor     : 'pointer',
  };

  return (
    <div style={{ minHeight:'100vh', background:'#F5F3FF', paddingBottom:'60px' }}>
      <Navbar />

      {/* ── Sticky header ── */}
      <div style={{
        position   : 'sticky', top: 0, zIndex: 100,
        background : `linear-gradient(135deg, ${P}, ${PM})`,
        boxShadow  : '0 4px 16px rgba(107,33,168,0.3)',
      }}>

        {/* Row 1 — title + clock + OOS */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px 0', flexWrap:'wrap', gap:'8px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <div style={{ fontSize:'30px' }}>🏭</div>
            <div>
              <div style={{ fontWeight:'900', fontSize:'16px', color:'#fff' }}>Boiler Results Dashboard</div>
              <div style={{ fontSize:'11px', color:'#DDD6FE' }}>
                Live QC Results · {format(now,'EEEE, dd MMMM yyyy')}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
            {timeLeft && (
              <div style={{ background:'rgba(255,255,255,0.15)', borderRadius:'8px', padding:'5px 11px', fontSize:'12px', color:'#DDD6FE', fontWeight:'600' }}>
                ⏱ {timeLeft}
              </div>
            )}
            {oosIds.length > 0 && (
              <div style={{ background:RD, borderRadius:'10px', padding:'5px 12px', fontSize:'13px', color:'#fff', fontWeight:'900' }}>
                ⚠️ {oosIds.length} OOS
              </div>
            )}
          </div>
        </div>

        {/* Row 2 — stats */}
        <div style={{ display:'flex', gap:'6px', padding:'8px 16px', overflowX:'auto', scrollbarWidth:'none' }}>
          {[
            { label:'Today',   val:todayIds.length,  color:'#C4B5FD' },
            { label:'Pending', val:pendIds.length,   color:'#FDE68A' },
            { label:'Running', val:inProgIds.length, color:'#FED7AA' },
            { label:'Done',    val:compIds.length,   color:'#A7F3D0' },
            { label:'OOS',     val:oosIds.length,    color:'#FECACA' },
          ].map(s => (
            <div key={s.label} style={{ background:'rgba(255,255,255,0.12)', borderRadius:'8px', padding:'5px 14px', flexShrink:0, textAlign:'center', minWidth:'72px' }}>
              <div style={{ fontWeight:'900', fontSize:'17px', color:s.color }}>{s.val}</div>
              <div style={{ fontSize:'10px', color:'rgba(255,255,255,0.7)', fontWeight:'600' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Row 3 — date filter + search */}
        <div style={{ display:'flex', gap:'6px', padding:'0 16px 8px', flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ display:'flex', gap:'4px' }}>
            <button onClick={()=>setRange(false)} style={{ ...inp, background:!range?'rgba(255,255,255,0.9)':'rgba(255,255,255,0.12)', color:!range?P:'#fff', fontWeight:'700', fontSize:'12px', padding:'5px 11px', border:'none', borderRadius:'7px' }}>Day</button>
            <button onClick={()=>setRange(true)}  style={{ ...inp, background:range?'rgba(255,255,255,0.9)':'rgba(255,255,255,0.12)', color:range?P:'#fff', fontWeight:'700', fontSize:'12px', padding:'5px 11px', border:'none', borderRadius:'7px' }}>Range</button>
          </div>
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={{ ...inp, minWidth:'130px' }}/>
          {range && (
            <>
              <span style={{ color:'rgba(255,255,255,0.7)' }}>→</span>
              <input type="date" value={to} min={from} onChange={e=>setTo(e.target.value)} style={{ ...inp, minWidth:'130px' }}/>
            </>
          )}
          <button onClick={()=>{setFrom(todayStr());setTo(todayStr());setRange(false);}} style={{ ...inp, fontSize:'12px', fontWeight:'700', padding:'5px 11px' }}>Today</button>
          <button onClick={()=>{setFrom(weekStart());setTo(todayStr());setRange(true);}} style={{ ...inp, fontSize:'12px', fontWeight:'700', padding:'5px 11px' }}>Week</button>
          <button onClick={()=>load(false)} style={{ background:G, color:'#1F2937', border:'none', borderRadius:'8px', padding:'6px 14px', fontSize:'12px', fontWeight:'800', cursor:'pointer', fontFamily:'inherit' }}>
            🔄 Refresh
          </button>
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search..." style={{ ...inp, flex:1, minWidth:'160px' }}/>
        </div>

        {/* Tab bar */}
        <div style={{ display:'flex', borderTop:'1px solid rgba(255,255,255,0.15)' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={()=>setTab(t.key)}
              style={{
                flex:1, padding:'9px 4px', border:'none', cursor:'pointer',
                background: tab===t.key ? 'rgba(255,255,255,0.18)' : 'transparent',
                color:'#fff', fontSize:'12px', fontWeight: tab===t.key ? '900':'600',
                fontFamily:'inherit',
                borderBottom: tab===t.key ? `3px solid ${G}` : '3px solid transparent',
                transition:'all 0.15s',
              }}>
              {t.label}
              <span style={{ marginLeft:'5px', background:'rgba(255,255,255,0.18)', borderRadius:'10px', padding:'1px 6px', fontSize:'10px' }}>
                {tabCount(t.key)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ padding:'14px 14px', maxWidth:'1100px', margin:'0 auto' }}>

        {/* Tab description */}
        <div style={{ fontSize:'12px', color:'#9CA3AF', marginBottom:'12px', fontWeight:'600' }}>
          {TABS.find(t=>t.key===tab)?.label} — {TABS.find(t=>t.key===tab)?.sub}
          {' · '}{sampleList.length} sample(s)
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'70px 20px', background:'#fff', borderRadius:'16px', border:`1.5px solid ${PL}` }}>
            <div style={{ fontSize:'40px', marginBottom:'12px' }}>⏳</div>
            <div style={{ fontWeight:'700', color:PM, fontSize:'15px' }}>Loading results...</div>
          </div>

        ) : sampleList.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 20px', background:'#fff', borderRadius:'16px', border:`1.5px solid ${PL}` }}>
            <div style={{ fontSize:'48px', marginBottom:'12px' }}>🏭</div>
            <div style={{ fontWeight:'700', fontSize:'15px', color:'#374151' }}>No {TABS.find(t=>t.key===tab)?.label} results for this period</div>
            <div style={{ fontSize:'12px', color:'#9CA3AF', marginTop:'6px' }}>{TABS.find(t=>t.key===tab)?.sub}</div>
            <button onClick={()=>navigate('/register')}
              style={{ marginTop:'16px', padding:'10px 22px', background:`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'10px', fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>
              + Register Sample
            </button>
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
                complete   : { color:GR,        bg:'#F0FDF4', dot:'#22C55E', label:'Complete'    },
              }[status] || { color:'#6B7280', bg:'#F3F4F6', dot:'#9CA3AF', label: status||'—' };

              return (
                <div key={sample.id} style={{
                  background  : '#fff',
                  borderRadius: '14px',
                  border      : `2px solid ${hasOOS ? RD : allDone ? '#86EFAC' : PL}`,
                  overflow    : 'hidden',
                  boxShadow   : hasOOS ? '0 2px 12px rgba(220,38,38,0.1)' : '0 1px 6px rgba(107,33,168,0.06)',
                }}>

                  {/* Sample header */}
                  <div style={{ background: hasOOS?'#FEF2F2': allDone?'#F0FDF4':'#F9FAFB', padding:'12px 16px', borderBottom:`1px solid ${hasOOS?'#FECACA':allDone?'#BBF7D0':PL}` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'8px' }}>
                      <div>
                        <div style={{ fontWeight:'900', fontSize:'15px', color:'#1F2937', marginBottom:'3px' }}>
                          {hasOOS && <span style={{ color:RD, marginRight:'6px' }}>⚠️</span>}
                          {sample.sample_name}
                        </div>
                        <div style={{ fontSize:'12px', color:PM, fontFamily:'monospace', fontWeight:'700', marginBottom:'5px' }}>
                          {sample.sample_number}
                        </div>
                        <div style={{ display:'flex', gap:'5px', flexWrap:'wrap', alignItems:'center' }}>
                          {/* Status badge */}
                          <span style={{ display:'flex', alignItems:'center', gap:'4px', background:statusCfg.bg, color:statusCfg.color, borderRadius:'20px', padding:'2px 9px', fontSize:'11px', fontWeight:'700' }}>
                            <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:statusCfg.dot, display:'inline-block' }}/>
                            {statusCfg.label}
                          </span>
                          {/* Sample type */}
                          <span style={{ fontSize:'11px', background:PL, color:P, padding:'2px 8px', borderRadius:'6px', fontWeight:'600' }}>
                            {sample.sample_types?.name}
                          </span>
                          {/* Vehicle / batch */}
                          {sample.batch_number && (
                            <span style={{ fontSize:'11px', background:'#FFF7ED', color:'#EA580C', padding:'2px 8px', borderRadius:'6px', fontWeight:'600' }}>
                              🚚 {sample.batch_number}
                            </span>
                          )}
                          {/* Compartment / notes */}
                          {sample.notes && (
                            <span style={{ fontSize:'11px', background:'#F0FDF4', color:GR, padding:'2px 8px', borderRadius:'6px', fontWeight:'600' }}>
                              {sample.notes}
                            </span>
                          )}
                          {hasOOS && (
                            <span style={{ fontSize:'11px', background:'#FEF2F2', color:RD, padding:'2px 8px', borderRadius:'6px', fontWeight:'800', border:'1px solid #FECACA' }}>
                              ⚠️ OOS
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Date / sampler */}
                      <div style={{ textAlign:'right', fontSize:'11px', color:'#6B7280' }}>
                        {sample.registered_at && (
                          <>
                            <div>{format(new Date(sample.registered_at),'dd/MM/yyyy')}</div>
                            <div style={{ fontWeight:'700', color:PM }}>{format(new Date(sample.registered_at),'HH:mm')}</div>
                          </>
                        )}
                        {sample.sampler_name && (
                          <div style={{ marginTop:'2px' }}>✍️ {sample.sampler_name}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Results table */}
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px', minWidth:'600px' }}>
                      <thead>
                        <tr style={{ background:'#F5F3FF' }}>
                          {['Test','Spec','Result','Unit','Status','Analyst','Time'].map(h => (
                            <th key={h} style={{ padding:'7px 10px', textAlign:'left', fontWeight:'700', color:'#4C1D95', fontSize:'11px', borderBottom:`1px solid ${PL}`, whiteSpace:'nowrap' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...tests]
                          .sort((a,b)=>(a.tests?.display_order||0)-(b.tests?.display_order||0))
                          .map((r, i) => {
                            const spec     = r.tests?.test_specifications?.[0];
                            const specStr  = spec?.display_spec || '—';
                            const val      = r.result_value;
                            const isText   = r.tests?.result_type === 'text';
                            const isRemark = ['Remarks','Action'].includes(r.tests?.name);

                            // Determine pass/fail
                            let displayStatus = null;
                            if (val) {
                              if (isText && spec?.display_spec) {
                                displayStatus = evalText(val, spec.display_spec);
                              } else if (!isText) {
                                displayStatus = (r.result_status==='fail_low'||r.result_status==='fail_high') ? 'fail' : r.result_status==='pass' ? 'pass' : 'pass';
                              }
                            }

                            const badge = {
                              pass: { bg:'#DCFCE7', color:GR,  label:'PASS' },
                              fail: { bg:'#FEF2F2', color:RD,  label:'FAIL' },
                            }[displayStatus] || null;

                            return (
                              <tr key={r.id} style={{ background: i%2===0?'#FAFAFA':'#fff' }}>
                                <td style={{ padding:'8px 10px', borderBottom:`1px solid ${PL}`, fontWeight: isRemark?'600':'700', color: isRemark?'#9CA3AF':'#1F2937', whiteSpace:'nowrap' }}>
                                  {r.tests?.name}
                                </td>
                                <td style={{ padding:'8px 10px', borderBottom:`1px solid ${PL}`, color:isRemark?'#D1D5DB':G, fontWeight:'700', fontSize:'11px', whiteSpace:'nowrap' }}>
                                  {isRemark ? '—' : specStr}
                                </td>
                                <td style={{ padding:'8px 10px', borderBottom:`1px solid ${PL}`, fontWeight:'900', fontSize:'13px', color: displayStatus==='fail'?RD : displayStatus==='pass'?GR : val?'#1F2937':'#D1D5DB', whiteSpace:'nowrap' }}>
                                  {val || '—'}
                                </td>
                                <td style={{ padding:'8px 10px', borderBottom:`1px solid ${PL}`, color:'#9CA3AF', fontSize:'11px', whiteSpace:'nowrap' }}>
                                  {r.tests?.unit || '—'}
                                </td>
                                <td style={{ padding:'8px 10px', borderBottom:`1px solid ${PL}` }}>
                                  {badge && !isRemark ? (
                                    <span style={{ background:badge.bg, color:badge.color, padding:'2px 8px', borderRadius:'8px', fontSize:'10px', fontWeight:'800', whiteSpace:'nowrap' }}>
                                      {badge.label}
                                    </span>
                                  ) : <span style={{ color:'#D1D5DB', fontSize:'11px' }}>—</span>}
                                </td>
                                <td style={{ padding:'8px 10px', borderBottom:`1px solid ${PL}`, color:'#6B7280', fontSize:'11px', whiteSpace:'nowrap' }}>
                                  {r.analyst_signature || '—'}
                                </td>
                                <td style={{ padding:'8px 10px', borderBottom:`1px solid ${PL}`, color:'#9CA3AF', fontSize:'11px', whiteSpace:'nowrap' }}>
                                  {r.submitted_at ? format(new Date(r.submitted_at),'HH:mm') : '—'}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  {/* Analyse button if not complete */}
                  {!allDone && (
                    <div style={{ padding:'8px 14px', background:'#F9FAFB', borderTop:`1px solid ${PL}`, display:'flex', justifyContent:'flex-end' }}>
                      <button onClick={()=>navigate(`/analysis/${sample.id}`)}
                        style={{ padding:'7px 18px', background:`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>
                        🔬 {status==='in_progress'?'Continue':'Start'} Analysis
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating register button */}
      <button onClick={()=>navigate('/register')}
        style={{ position:'fixed', bottom:'70px', right:'16px', background:`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'50px', padding:'12px 20px', fontSize:'14px', fontWeight:'800', cursor:'pointer', fontFamily:'inherit', boxShadow:'0 4px 16px rgba(107,33,168,0.4)', zIndex:200 }}>
        + Register Sample
      </button>

      <PageFooter />
    </div>
  );
}
