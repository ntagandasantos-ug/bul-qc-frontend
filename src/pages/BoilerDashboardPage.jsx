// ============================================================
// FILE: frontend/bul-qc-app/src/pages/BoilerDashboardPage.jsx
// Live results dashboard for Boiler department
// 3 tabs: Fuels/Liquids · Biomass · Boiler Ash
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar     from '../components/Navbar';
import PageFooter from '../components/PageFooter';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { format, subDays, startOfWeek } from 'date-fns';

const P  = '#6B21A8';
const PM = '#7C3AED';
const PL = '#EDE9FE';
const G  = '#FFB81C';
const GR = '#16A34A';
const RD = '#DC2626';

const TABS = [
  { key:'BOILER_FUEL',    label:'⛽ Fuels & Liquids', desc:'Petrol · Diesel · Furnace Oil' },
  { key:'BOILER_BIOMASS', label:'🪵 Biomass',          desc:'Wood Chips · Bagasse · Saw Dust' },
  { key:'BOILER_ASH',     label:'🏭 Boiler Ash',       desc:'25T Fly/Bottom · 16T MDC/Furnace' },
];

const FUEL_TYPES   = ['BLR_PETROL','BLR_DIESEL','BLR_FO'];
const BIOMASS_TYPES= ['BLR_WC_DRY','BLR_WC_WET','BLR_BAG_DRY','BLR_BAG_WET','BLR_SD_DRY','BLR_SD_WET'];
const ASH_TYPES    = ['BLR_25T_FLY','BLR_25T_BTM','BLR_16T_MDC','BLR_16T_FUR'];

const TAB_TYPES = {
  BOILER_FUEL   : FUEL_TYPES,
  BOILER_BIOMASS: BIOMASS_TYPES,
  BOILER_ASH    : ASH_TYPES,
};

function today()    { return format(new Date(),'yyyy-MM-dd'); }
function weekStart(){ return format(startOfWeek(new Date(),{weekStartsOn:1}),'yyyy-MM-dd'); }

export default function BoilerDashboardPage() {
  const navigate   = useNavigate();
  const { user, timeLeft } = useAuth();

  const [tab,      setTab]     = useState('BOILER_FUEL');
  const [results,  setResults] = useState([]);
  const [loading,  setLoading] = useState(true);
  const [range,    setRange]   = useState(false);
  const [from,     setFrom]    = useState(today());
  const [to,       setTo]      = useState(today());
  const [search,   setSearch]  = useState('');
  const [deptId,   setDeptId]  = useState('');

  // Get dept ID on mount
  useEffect(() => {
    const getDept = async () => {
      try {
        const res = await api.get('/lookups/departments');
        const d = (res.data?.departments || []).find(x => x.code === 'BOILER');
        if (d) setDeptId(d.id);
      } catch(e) {}
    };
    getDept();
  }, []);

  const load = useCallback(async () => {
    if (!deptId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        fromDate    : from,
        toDate      : range ? to : from,
        departmentId: deptId,
      });
      const res = await api.get(`/dashboard/live-results?${params.toString()}`);
      setResults(res.data?.results || []);
    } catch(e) {
      console.error(e);
    } finally { setLoading(false); }
  }, [deptId, from, to, range]);

  useEffect(() => { if (deptId) load(); }, [load, deptId]);

  // Filter by current tab
  const tabTypes = TAB_TYPES[tab] || [];
  const tabResults = results.filter(r => {
    const code = r.registered_samples?.sample_types?.code || '';
    return tabTypes.includes(code);
  });

  // Further filter by search
  const filtered = tabResults.filter(r => {
    if (!search) return true;
    const name = r.registered_samples?.sample_name?.toLowerCase() || '';
    const num  = r.registered_samples?.sample_number?.toLowerCase() || '';
    const test = r.tests?.name?.toLowerCase() || '';
    return name.includes(search.toLowerCase()) ||
           num.includes(search.toLowerCase()) ||
           test.includes(search.toLowerCase());
  });

  // Stats
  const sampleIds  = [...new Set(results.map(r => r.registered_samples?.id).filter(Boolean))];
  const oosList    = results.filter(r => r.result_status === 'fail_low' || r.result_status === 'fail_high');
  const todaySamps = results.filter(r => {
    const d = r.registered_samples?.registered_at;
    return d && format(new Date(d),'yyyy-MM-dd') === today();
  });
  const todayIds = [...new Set(todaySamps.map(r => r.registered_samples?.id).filter(Boolean))];

  const pending    = results.filter(r => r.registered_samples?.status === 'pending');
  const inProg     = results.filter(r => r.registered_samples?.status === 'in_progress');
  const complete   = results.filter(r => r.registered_samples?.status === 'complete');
  const pendIds    = [...new Set(pending.map(r=>r.registered_samples?.id).filter(Boolean))];
  const inProgIds  = [...new Set(inProg.map(r=>r.registered_samples?.id).filter(Boolean))];
  const compIds    = [...new Set(complete.map(r=>r.registered_samples?.id).filter(Boolean))];
  const oosIds     = [...new Set(oosList.map(r=>r.registered_samples?.id).filter(Boolean))];

  // Group filtered results by sample
  const grouped = filtered.reduce((acc, r) => {
    const sid = r.registered_samples?.id;
    if (!sid) return acc;
    if (!acc[sid]) acc[sid] = { sample: r.registered_samples, tests: [] };
    acc[sid].tests.push(r);
    return acc;
  }, {});

  const inp = {
    border:`1.5px solid rgba(255,255,255,0.3)`, borderRadius:'9px',
    padding:'7px 11px', fontSize:'13px', fontFamily:'inherit',
    background:'rgba(255,255,255,0.15)', color:'#fff', outline:'none',
    cursor:'pointer',
  };

  return (
    <div style={{ minHeight:'100vh', background:'#FAF5FF', paddingBottom:'56px' }}>
      <Navbar/>

      {/* ── Sticky 3-row header ── */}
      <div style={{ position:'sticky', top:0, zIndex:100,
        background:`linear-gradient(135deg,${P},${PM})`,
        boxShadow:'0 4px 16px rgba(107,33,168,0.3)' }}>

        {/* Row 1 — title + timer */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px 6px', flexWrap:'wrap', gap:'8px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <div style={{ fontSize:'28px' }}>🏭</div>
            <div>
              <div style={{ fontWeight:'900', fontSize:'16px', color:'#fff' }}>Boiler Results Dashboard</div>
              <div style={{ fontSize:'11px', color:'#DDD6FE' }}>Live QC Results · {format(new Date(),'EEEE, dd MMMM yyyy')}</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
            {timeLeft && (
              <div style={{ background:'rgba(255,255,255,0.15)', borderRadius:'8px', padding:'5px 10px', fontSize:'12px', color:'#DDD6FE', fontWeight:'600' }}>
                ⏱ {timeLeft}
              </div>
            )}
            {oosIds.length > 0 && (
              <div style={{ background:RD, borderRadius:'10px', padding:'5px 12px', fontSize:'13px', color:'#fff', fontWeight:'900', animation:'pulse 1.5s infinite' }}>
                ⚠️ {oosIds.length} OOS
              </div>
            )}
          </div>
        </div>

        {/* Row 2 — stats */}
        <div style={{ display:'flex', gap:'6px', overflowX:'auto', padding:'0 16px 8px', scrollbarWidth:'none' }}>
          {[
            { label:'Today',    val:todayIds.length, color:'#C4B5FD' },
            { label:'Pending',  val:pendIds.length,  color:'#FDE68A' },
            { label:'Running',  val:inProgIds.length,color:'#FED7AA' },
            { label:'Done',     val:compIds.length,  color:'#A7F3D0' },
            { label:'OOS',      val:oosIds.length,   color:'#FECACA' },
          ].map(s => (
            <div key={s.label} style={{ background:'rgba(255,255,255,0.12)', borderRadius:'8px', padding:'5px 12px', flexShrink:0, textAlign:'center', minWidth:'70px' }}>
              <div style={{ fontWeight:'900', fontSize:'16px', color:s.color }}>{s.val}</div>
              <div style={{ fontSize:'10px', color:'rgba(255,255,255,0.7)', fontWeight:'600' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Row 3 — date filter + search */}
        <div style={{ display:'flex', gap:'8px', padding:'0 16px 10px', flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ display:'flex', gap:'4px' }}>
            <button onClick={()=>setRange(false)} style={{ ...inp, background:!range?'rgba(255,255,255,0.9)':'rgba(255,255,255,0.15)', color:!range?P:'#fff', fontSize:'12px', fontWeight:'700', padding:'5px 10px', border:'none', borderRadius:'7px' }}>Day</button>
            <button onClick={()=>setRange(true)}  style={{ ...inp, background:range?'rgba(255,255,255,0.9)':'rgba(255,255,255,0.15)', color:range?P:'#fff', fontSize:'12px', fontWeight:'700', padding:'5px 10px', border:'none', borderRadius:'7px' }}>Range</button>
          </div>
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)}
            style={{ ...inp, minWidth:'130px', cursor:'pointer' }}/>
          {range && <>
            <span style={{ color:'rgba(255,255,255,0.7)', fontSize:'14px' }}>→</span>
            <input type="date" value={to} min={from} onChange={e=>setTo(e.target.value)}
              style={{ ...inp, minWidth:'130px', cursor:'pointer' }}/>
          </>}
          <button onClick={()=>{setFrom(today());setTo(today());setRange(false);}}
            style={{ ...inp, padding:'5px 10px', fontSize:'12px', fontWeight:'700', border:'1px solid rgba(255,255,255,0.4)' }}>Today</button>
          <button onClick={()=>{setFrom(weekStart());setTo(today());setRange(true);}}
            style={{ ...inp, padding:'5px 10px', fontSize:'12px', fontWeight:'700', border:'1px solid rgba(255,255,255,0.4)' }}>Week</button>
          <button onClick={load} style={{ background:G, color:'#1F2937', border:'none', borderRadius:'8px', padding:'6px 14px', fontSize:'12px', fontWeight:'800', cursor:'pointer', fontFamily:'inherit' }}>
            🔄 Refresh
          </button>
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="🔍 Search..." style={{ ...inp, minWidth:'160px', flex:1 }}/>
        </div>

        {/* Tab bar */}
        <div style={{ display:'flex', borderTop:'1px solid rgba(255,255,255,0.15)' }}>
          {TABS.map(t => {
            const cnt = [...new Set(
              results.filter(r => TAB_TYPES[t.key].includes(r.registered_samples?.sample_types?.code || ''))
                .map(r => r.registered_samples?.id).filter(Boolean)
            )].length;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{
                  flex:1, padding:'8px 4px', border:'none', cursor:'pointer',
                  fontFamily:'inherit', background:tab===t.key?'rgba(255,255,255,0.2)':'transparent',
                  color:'#fff', fontSize:'12px', fontWeight:tab===t.key?'900':'600',
                  borderBottom:tab===t.key?'3px solid #FFB81C':'3px solid transparent',
                  transition:'all 0.15s',
                }}>
                {t.label}
                <span style={{ marginLeft:'5px', background:'rgba(255,255,255,0.2)', borderRadius:'10px', padding:'1px 6px', fontSize:'10px' }}>
                  {cnt}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ padding:'16px', maxWidth:'1200px', margin:'0 auto' }}>

        {/* Tab description */}
        <div style={{ fontSize:'12px', color:'#9CA3AF', marginBottom:'12px', fontWeight:'600' }}>
          {TABS.find(t=>t.key===tab)?.label} — {TABS.find(t=>t.key===tab)?.desc}
          {' · '}{Object.keys(grouped).length} sample(s)
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'60px', color:PM, fontWeight:'700', fontSize:'16px' }}>
            ⏳ Loading results...
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px', background:'#fff', borderRadius:'16px', border:`1.5px solid ${PL}` }}>
            <div style={{ fontSize:'48px', marginBottom:'12px' }}>🏭</div>
            <div style={{ fontWeight:'700', fontSize:'16px', color:'#374151' }}>No results for this period</div>
            <div style={{ fontSize:'13px', color:'#9CA3AF', marginTop:'6px' }}>
              {TABS.find(t=>t.key===tab)?.desc}
            </div>
            <button onClick={() => navigate('/register')}
              style={{ marginTop:'16px', padding:'10px 22px', background:`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'10px', fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>
              + Register Sample
            </button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            {Object.values(grouped).map(({ sample, tests }) => {
              const hasOOS = tests.some(r => r.result_status==='fail_low'||r.result_status==='fail_high');
              const allDone = tests.every(r => r.result_value);
              const typeCode = sample?.sample_types?.code || '';

              return (
                <div key={sample.id} style={{
                  background:'#fff', borderRadius:'14px',
                  border:`2px solid ${hasOOS?RD:allDone?'#86EFAC':PL}`,
                  overflow:'hidden',
                  boxShadow: hasOOS?'0 2px 12px rgba(220,38,38,0.12)':'0 1px 6px rgba(107,33,168,0.06)',
                }}>
                  {/* Sample header */}
                  <div style={{ background: hasOOS?'#FEF2F2':allDone?'#F0FDF4':'#F9FAFB', padding:'12px 16px', borderBottom:`1px solid ${hasOOS?'#FECACA':allDone?'#BBF7D0':PL}` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'8px' }}>
                      <div>
                        <div style={{ fontWeight:'900', fontSize:'15px', color:'#1F2937', marginBottom:'3px' }}>
                          {hasOOS && <span style={{ color:RD, marginRight:'6px' }}>⚠️</span>}
                          {sample.sample_name}
                        </div>
                        <div style={{ fontSize:'12px', color:PM, fontFamily:'monospace', fontWeight:'700' }}>
                          {sample.sample_number}
                        </div>
                        <div style={{ display:'flex', gap:'5px', marginTop:'5px', flexWrap:'wrap' }}>
                          <span style={{ fontSize:'11px', background:PL, color:P, padding:'2px 8px', borderRadius:'6px', fontWeight:'600' }}>
                            {sample.sample_types?.name}
                          </span>
                          {sample.batch_number && (
                            <span style={{ fontSize:'11px', background:'#FFF7ED', color:'#EA580C', padding:'2px 8px', borderRadius:'6px', fontWeight:'600' }}>
                              Vehicle/Batch: {sample.batch_number}
                            </span>
                          )}
                          {sample.notes && (
                            <span style={{ fontSize:'11px', background:'#F0FDF4', color:'#16A34A', padding:'2px 8px', borderRadius:'6px', fontWeight:'600' }}>
                              {sample.notes}
                            </span>
                          )}
                          <span style={{ fontSize:'11px', background: allDone?'#DCFCE7':sample.status==='in_progress'?'#FFF7ED':'#F3F4F6', color: allDone?GR:sample.status==='in_progress'?'#EA580C':'#6B7280', padding:'2px 8px', borderRadius:'6px', fontWeight:'700' }}>
                            {allDone ? '✅ Complete' : sample.status==='in_progress' ? '🔬 In Progress' : '⏳ Pending'}
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign:'right', fontSize:'11px', color:'#6B7280' }}>
                        <div>{sample.registered_at ? format(new Date(sample.registered_at),'dd/MM/yyyy') : ''}</div>
                        <div style={{ fontWeight:'700', color:PM }}>{sample.registered_at ? format(new Date(sample.registered_at),'HH:mm') : ''}</div>
                        {sample.sampler_name && <div style={{ marginTop:'2px' }}>✍️ {sample.sampler_name}</div>}
                      </div>
                    </div>
                  </div>

                  {/* Test results grid */}
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
                      <thead>
                        <tr style={{ background:'#F5F3FF' }}>
                          {['Test','Spec','Result','Unit','Status','Analyst','Time','Remarks','Action'].map(h => (
                            <th key={h} style={{ padding:'7px 10px', textAlign:'left', fontWeight:'700', color:'#4C1D95', fontSize:'11px', borderBottom:`1px solid ${PL}`, whiteSpace:'nowrap' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tests
                          .sort((a,b) => (a.tests?.display_order||0)-(b.tests?.display_order||0))
                          .map((r, i) => {
                            const spec    = r.tests?.test_specifications?.[0];
                            const specStr = spec?.display_spec || '—';
                            const val     = r.result_value;
                            const isOOS   = r.result_status==='fail_low'||r.result_status==='fail_high';
                            const isPass  = r.result_status==='pass';
                            const isText  = r.tests?.result_type === 'text';

                            // Evaluate text tests
                            const evalText = () => {
                              if (!val || !spec?.display_spec) return null;
                              const v   = val.toLowerCase().trim();
                              const exp = spec.display_spec.toLowerCase();
                              if (exp === 'pink')   return v === 'pink'   ? 'pass' : 'fail';
                              if (exp === 'black')  return v === 'black'  ? 'pass' : 'fail';
                              if (exp === 'nil')    return v === 'nil'    ? 'pass' : 'fail';
                              if (exp.includes('yellow')) return (v==='yellow'||v==='light yellow') ? 'pass' : 'fail';
                              if (exp === 'to pass the test') return v==='to pass the test' ? 'pass' : 'fail';
                              return null;
                            };
                            const textStatus = isText ? evalText() : null;
                            const displayStatus = textStatus || (isOOS?'fail':isPass?'pass':val?'pass':null);

                            const statusBadge = {
                              pass: { bg:'#DCFCE7', color:GR,  text:'PASS' },
                              fail: { bg:'#FEF2F2', color:RD,  text:'FAIL' },
                            }[displayStatus] || { bg:'#F3F4F6', color:'#9CA3AF', text:'—' };

                            const isRemarkOrAction = ['Remarks','Action'].includes(r.tests?.name);

                            return (
                              <tr key={r.id} style={{ background:i%2===0?'#FAFAFA':'#fff' }}>
                                <td style={{ padding:'8px 10px', borderBottom:`1px solid ${PL}`, fontWeight:isRemarkOrAction?'600':'700', color:isRemarkOrAction?'#6B7280':'#1F2937', whiteSpace:'nowrap' }}>
                                  {r.tests?.name}
                                </td>
                                <td style={{ padding:'8px 10px', borderBottom:`1px solid ${PL}`, color:G, fontWeight:'700', whiteSpace:'nowrap', fontSize:'11px' }}>
                                  {isRemarkOrAction ? '—' : specStr}
                                </td>
                                <td style={{ padding:'8px 10px', borderBottom:`1px solid ${PL}`, fontWeight:'900', fontSize:'14px', color: displayStatus==='fail'?RD:displayStatus==='pass'?GR:'#9CA3AF', whiteSpace:'nowrap' }}>
                                  {val || '—'}
                                </td>
                                <td style={{ padding:'8px 10px', borderBottom:`1px solid ${PL}`, color:'#6B7280', whiteSpace:'nowrap', fontSize:'11px' }}>
                                  {r.tests?.unit || '—'}
                                </td>
                                <td style={{ padding:'8px 10px', borderBottom:`1px solid ${PL}` }}>
                                  {val && !isRemarkOrAction ? (
                                    <span style={{ background:statusBadge.bg, color:statusBadge.color, padding:'2px 8px', borderRadius:'8px', fontSize:'10px', fontWeight:'800', whiteSpace:'nowrap' }}>
                                      {statusBadge.text}
                                    </span>
                                  ) : '—'}
                                </td>
                                <td style={{ padding:'8px 10px', borderBottom:`1px solid ${PL}`, fontSize:'11px', color:'#6B7280', whiteSpace:'nowrap' }}>
                                  {r.analyst_signature || '—'}
                                </td>
                                <td style={{ padding:'8px 10px', borderBottom:`1px solid ${PL}`, fontSize:'11px', color:'#9CA3AF', whiteSpace:'nowrap' }}>
                                  {r.submitted_at ? format(new Date(r.submitted_at),'HH:mm') : '—'}
                                </td>
                                <td style={{ padding:'8px 10px', borderBottom:`1px solid ${PL}`, fontSize:'11px', color:'#374151', maxWidth:'120px', whiteSpace:'normal' }}>
                                  {r.tests?.name === 'Remarks' ? (val || '—') : '—'}
                                </td>
                                <td style={{ padding:'8px 10px', borderBottom:`1px solid ${PL}`, fontSize:'11px', color:'#374151', maxWidth:'120px', whiteSpace:'normal' }}>
                                  {r.tests?.name === 'Action' ? (val || '—') : '—'}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  {/* Analyse button */}
                  {!allDone && (
                    <div style={{ padding:'8px 16px', background:'#F9FAFB', borderTop:`1px solid ${PL}`, display:'flex', justifyContent:'flex-end' }}>
                      <button onClick={() => navigate(`/analysis/${sample.id}`)}
                        style={{ padding:'7px 18px', background:`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>
                        🔬 {sample.status==='in_progress'?'Continue Analysis':'Start Analysis'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Register button */}
        <button onClick={() => navigate('/register')}
          style={{ position:'fixed', bottom:'70px', right:'16px', background:`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'50px', padding:'12px 20px', fontSize:'14px', fontWeight:'800', cursor:'pointer', fontFamily:'inherit', boxShadow:'0 4px 16px rgba(107,33,168,0.4)', zIndex:200 }}>
          + Register Sample
        </button>
      </div>

      <PageFooter/>
    </div>
  );
}
