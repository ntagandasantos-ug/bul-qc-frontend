// ============================================================
// FILE: src/pages/TrendAnalysisPage.jsx
// 7-day, 30-day & custom range charts for any test parameter
// Statistical summary: mean, std dev, Cpk, min, max, OOS rate
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { supabase } from '../services/supabase';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, BarChart, Bar,
  ScatterChart, Scatter, ZAxis,
} from 'recharts';

const P  = '#6B21A8';
const PM = '#7C3AED';
const PL = '#EDE9FE';
const GR = '#16A34A';
const RD = '#DC2626';
const AM = '#D97706';

const PRESET_RANGES = [
  { label:'7 Days',    days:7  },
  { label:'14 Days',   days:14 },
  { label:'30 Days',   days:30 },
  { label:'60 Days',   days:60 },
  { label:'90 Days',   days:90 },
  { label:'Custom',    days:0  },
];

const CHART_TYPES = ['Trend Line','Bar Chart','Distribution'];

export default function TrendAnalysisPage() {
  const navigate = useNavigate();

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const [depts,      setDepts]      = useState([]);
  const [types,      setTypes]      = useState([]);
  const [tests,      setTests]      = useState([]);
  const [selDept,    setSelDept]    = useState('');
  const [selType,    setSelType]    = useState('');
  const [selTest,    setSelTest]    = useState('');
  const [rangeIdx,   setRangeIdx]   = useState(2); // default 30 days
  const [fromDate,   setFromDate]   = useState(format(subDays(new Date(),30),'yyyy-MM-dd'));
  const [toDate,     setToDate]     = useState(format(new Date(),'yyyy-MM-dd'));
  const [chartType,  setChartType]  = useState(0);
  const [loading,    setLoading]    = useState(false);
  const [results,    setResults]    = useState([]);
  const [stats,      setStats]      = useState(null);
  const [spec,       setSpec]       = useState(null);

  useEffect(() => {
    supabase.from('departments').select('id, name').order('name')
      .then(({ data }) => setDepts(data || []));
  }, []);

  useEffect(() => {
    if (!selDept) { setTypes([]); setSelType(''); return; }
    supabase.from('sample_types')
      .select('id, name, sample_categories(department_id)')
      .then(({ data }) => {
        setTypes((data||[]).filter(t => t.sample_categories?.department_id === selDept));
        setSelType('');
      });
  }, [selDept]);

  useEffect(() => {
    if (!selType) { setTests([]); setSelTest(''); return; }
    supabase.from('tests')
      .select('id, name, unit, test_specifications(min_value, max_value, display_spec)')
      .eq('sample_type_id', selType)
      .order('display_order')
      .then(({ data }) => { setTests(data||[]); setSelTest(''); });
  }, [selType]);

  // When preset range changes, update dates
  useEffect(() => {
    const r = PRESET_RANGES[rangeIdx];
    if (r.days > 0) {
      setFromDate(format(subDays(new Date(), r.days), 'yyyy-MM-dd'));
      setToDate(format(new Date(), 'yyyy-MM-dd'));
    }
  }, [rangeIdx]);

  const loadData = useCallback(async () => {
    if (!selTest) return;
    setLoading(true);
    try {
      const from = startOfDay(new Date(fromDate)).toISOString();
      const to   = endOfDay(new Date(toDate)).toISOString();

      const { data } = await supabase
        .from('sample_test_assignments')
        .select(`
          result_value, result_status, submitted_at, analyst_signature,
          registered_samples(sample_name, sample_number)
        `)
        .eq('test_id', selTest)
        .not('result_value', 'is', null)
        .gte('submitted_at', from)
        .lte('submitted_at', to)
        .order('submitted_at');

      const numeric = (data||[])
        .map(d => ({ ...d, val: parseFloat(d.result_value) }))
        .filter(d => !isNaN(d.val));

      setResults(numeric);

      if (numeric.length < 2) { setStats(null); setSpec(null); setLoading(false); return; }

      const vals  = numeric.map(d => d.val);
      const n     = vals.length;
      const mean  = vals.reduce((a,b) => a+b,0) / n;
      const sigma = Math.sqrt(vals.reduce((a,b) => a+Math.pow(b-mean,2),0) / (n-1));
      const min   = Math.min(...vals);
      const max   = Math.max(...vals);
      const oos   = numeric.filter(d => d.result_status==='fail_low'||d.result_status==='fail_high').length;

      const testObj = tests.find(t => t.id === selTest);
      const s = testObj?.test_specifications?.[0];
      setSpec(s || null);

      const cpk = s?.min_value!=null && s?.max_value!=null && sigma > 0
        ? Math.min((s.max_value - mean)/(3*sigma), (mean - s.min_value)/(3*sigma))
        : null;

      setStats({ n, mean, sigma, min, max, oos, oosRate: Math.round((oos/n)*100), cpk });
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [selTest, fromDate, toDate, tests]);

  useEffect(() => { loadData(); }, [loadData]);

  const chartData = results.map((d,i) => ({
    idx  : i+1,
    date : d.submitted_at ? format(new Date(d.submitted_at),'dd/MM') : '',
    value: parseFloat(d.val.toFixed(4)),
    oos  : d.result_status==='fail_low'||d.result_status==='fail_high',
    name : d.registered_samples?.sample_number || `#${i+1}`,
  }));

  // Distribution histogram
  const histData = (() => {
    if (!results.length || !stats) return [];
    const bins = 10;
    const range = stats.max - stats.min;
    if (range === 0) return [];
    const step = range / bins;
    const counts = Array.from({length:bins}, (_,i) => ({
      range: `${(stats.min + i*step).toFixed(1)}`,
      count: 0,
    }));
    results.forEach(d => {
      const idx = Math.min(Math.floor((d.val - stats.min) / step), bins-1);
      if (idx >= 0) counts[idx].count++;
    });
    return counts;
  })();

  const sel = {
    border:`1.5px solid ${PL}`, borderRadius:'9px', padding:'9px 12px',
    fontSize:'13px', fontFamily:'inherit', background:'#fff',
    color:'#111827', outline:'none', cursor:'pointer', width:'100%', boxSizing:'border-box',
  };

  const CustomDot = ({ cx, cy, payload }) =>
    payload?.oos
      ? <circle cx={cx} cy={cy} r={5} fill={RD} stroke="#fff" strokeWidth={1}/>
      : <circle cx={cx} cy={cy} r={3} fill={PM} stroke="#fff" strokeWidth={1}/>;

  return (
    <div style={{ minHeight:'100vh', background:'#F8FAFC', paddingBottom: isMobile?'90px':'60px' }}>
      <Navbar />
      <div style={{ maxWidth:'1200px', margin:'0 auto', padding: isMobile?'12px':'20px' }}>

        <div style={{ marginBottom:'16px' }}>
          <button onClick={()=>navigate(-1)}
            style={{ background:'none', border:'none', color:PM, fontSize:'12px',
              fontWeight:'700', cursor:'pointer', marginBottom:'4px', padding:0 }}>
            ← Back
          </button>
          <h1 style={{ fontSize: isMobile?'18px':'22px', fontWeight:'900', color:'#0F172A', margin:0 }}>
            📊 Trend & Statistical Analysis
          </h1>
          <p style={{ fontSize:'12px', color:'#94A3B8', margin:'2px 0 0' }}>
            7-day, 30-day & custom range · statistical summary · OOS rate
          </p>
        </div>

        {/* Filters */}
        <div style={{ background:'#fff', borderRadius:'12px', border:`1.5px solid ${PL}`,
          padding:'14px', marginBottom:'14px',
          display:'grid', gridTemplateColumns: isMobile?'1fr':'1fr 1fr 1fr', gap:'10px' }}>
          <div>
            <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'#4C1D95', marginBottom:'4px' }}>Department</label>
            <select value={selDept} onChange={e=>setSelDept(e.target.value)} style={sel}>
              <option value="">— All Departments —</option>
              {depts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'#4C1D95', marginBottom:'4px' }}>Sample Type</label>
            <select value={selType} onChange={e=>setSelType(e.target.value)} style={sel} disabled={!selDept}>
              <option value="">— Select Type —</option>
              {types.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'#4C1D95', marginBottom:'4px' }}>Test Parameter</label>
            <select value={selTest} onChange={e=>setSelTest(e.target.value)} style={sel} disabled={!selType}>
              <option value="">— Select Test —</option>
              {tests.map(t=><option key={t.id} value={t.id}>{t.name}{t.unit?` (${t.unit})`:''}</option>)}
            </select>
          </div>
        </div>

        {/* Range selector */}
        <div style={{ background:'#fff', borderRadius:'12px', border:`1.5px solid ${PL}`,
          padding:'12px 14px', marginBottom:'14px' }}>
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom: rangeIdx===5?'12px':'0' }}>
            {PRESET_RANGES.map((r,i) => (
              <button key={r.label} onClick={()=>setRangeIdx(i)}
                style={{ padding:'6px 14px', borderRadius:'20px', border:'none',
                  background: rangeIdx===i?`linear-gradient(135deg,${P},${PM})`:'#F1F5F9',
                  color: rangeIdx===i?'#fff':'#64748B',
                  fontSize:'12px', fontWeight:'700', cursor:'pointer' }}>
                {r.label}
              </button>
            ))}
          </div>
          {rangeIdx===5 && (
            <div style={{ display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap' }}>
              <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}
                style={{ border:`1.5px solid ${PL}`, borderRadius:'8px', padding:'7px 10px', fontSize:'12px' }}/>
              <span style={{ color:'#94A3B8' }}>→</span>
              <input type="date" value={toDate} min={fromDate} onChange={e=>setToDate(e.target.value)}
                style={{ border:`1.5px solid ${PL}`, borderRadius:'8px', padding:'7px 10px', fontSize:'12px' }}/>
              <span style={{ fontSize:'12px', color:'#94A3B8' }}>
                {fromDate && toDate ? `${Math.round((new Date(toDate)-new Date(fromDate))/(1000*60*60*24))} days` : ''}
              </span>
            </div>
          )}
        </div>

        {!selTest ? (
          <div style={{ textAlign:'center', padding:'80px 20px', background:'#fff',
            borderRadius:'14px', border:`1.5px solid ${PL}` }}>
            <div style={{ fontSize:'48px', marginBottom:'12px' }}>📊</div>
            <div style={{ fontWeight:'700', fontSize:'15px', color:'#374151' }}>Select a test parameter</div>
            <div style={{ fontSize:'12px', color:'#94A3B8', marginTop:'6px' }}>
              Choose department → sample type → test to view trend analysis
            </div>
          </div>
        ) : loading ? (
          <div style={{ textAlign:'center', padding:'60px', color:'#94A3B8', fontWeight:'600' }}>
            Loading data...
          </div>
        ) : results.length < 2 ? (
          <div style={{ textAlign:'center', padding:'60px', background:'#fff',
            borderRadius:'14px', border:`1.5px solid ${PL}` }}>
            <div style={{ fontSize:'36px', marginBottom:'10px' }}>📭</div>
            <div style={{ fontWeight:'700', fontSize:'14px', color:'#374151' }}>Not enough data</div>
            <div style={{ fontSize:'12px', color:'#94A3B8', marginTop:'4px' }}>
              At least 2 results needed for this test in the selected range
            </div>
          </div>
        ) : (
          <>
            {/* Statistical summary */}
            {stats && (
              <div style={{ display:'grid',
                gridTemplateColumns: isMobile?'repeat(3,1fr)':'repeat(6,1fr)',
                gap:'8px', marginBottom:'14px' }}>
                {[
                  { label:'Results',  val:stats.n,                    color:'#0F172A', bg:'#fff' },
                  { label:'Mean',     val:stats.mean.toFixed(3),      color:PM,        bg:'#F5F3FF' },
                  { label:'Std Dev',  val:stats.sigma.toFixed(3),     color:'#0369A1', bg:'#F0F9FF' },
                  { label:'Min',      val:stats.min.toFixed(3),       color:GR,        bg:'#F0FDF4' },
                  { label:'Max',      val:stats.max.toFixed(3),       color:AM,        bg:'#FFFBEB' },
                  { label:'OOS Rate', val:`${stats.oosRate}%`,        color:stats.oos>0?RD:GR, bg:stats.oos>0?'#FEF2F2':'#F0FDF4' },
                ].map(s=>(
                  <div key={s.label} style={{ background:s.bg, borderRadius:'10px',
                    border:`1.5px solid ${PL}`, padding:'10px', textAlign:'center' }}>
                    <div style={{ fontSize:isMobile?'16px':'18px', fontWeight:'900',
                      color:s.color, fontFamily:'monospace' }}>{s.val}</div>
                    <div style={{ fontSize:'9px', color:'#94A3B8', fontWeight:'700',
                      textTransform:'uppercase', marginTop:'2px' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Cpk */}
            {stats?.cpk != null && (
              <div style={{ background: stats.cpk>=1.33?'#F0FDF4':stats.cpk>=1?'#FFFBEB':'#FEF2F2',
                border:`1.5px solid ${stats.cpk>=1.33?'#86EFAC':stats.cpk>=1?'#FDE68A':'#FECACA'}`,
                borderRadius:'12px', padding:'12px 16px', marginBottom:'14px',
                display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'8px' }}>
                <div>
                  <span style={{ fontWeight:'800', fontSize:'14px',
                    color: stats.cpk>=1.33?GR:stats.cpk>=1?AM:RD }}>
                    Cpk = {stats.cpk.toFixed(3)}
                  </span>
                  <span style={{ fontSize:'12px', color:'#64748B', marginLeft:'10px' }}>
                    {stats.cpk>=1.33 ? '✅ Process capable' :
                     stats.cpk>=1.0  ? '⚠️ Marginal — monitor closely' :
                                       '❌ Not capable — action required'}
                  </span>
                </div>
                {spec?.display_spec && (
                  <span style={{ background:'#FFFBEB', color:AM, fontSize:'12px',
                    fontWeight:'700', padding:'4px 10px', borderRadius:'8px' }}>
                    Spec: {spec.display_spec}
                  </span>
                )}
              </div>
            )}

            {/* Chart type selector */}
            <div style={{ display:'flex', gap:'4px', marginBottom:'12px' }}>
              {CHART_TYPES.map((t,i) => (
                <button key={t} onClick={()=>setChartType(i)}
                  style={{ padding:'7px 14px', borderRadius:'8px', border:'none',
                    background: chartType===i?`linear-gradient(135deg,${P},${PM})`:'#fff',
                    color: chartType===i?'#fff':'#64748B', fontSize:'12px',
                    fontWeight:'700', cursor:'pointer',
                    border: chartType===i?'none':`1.5px solid ${PL}` }}>
                  {t}
                </button>
              ))}
            </div>

            {/* Trend Line */}
            {chartType===0 && (
              <div style={{ background:'#fff', borderRadius:'14px', border:`1.5px solid ${PL}`, padding:'16px' }}>
                <div style={{ fontWeight:'800', fontSize:'14px', color:'#0F172A', marginBottom:'4px' }}>
                  {tests.find(t=>t.id===selTest)?.name} — Trend Over Time
                </div>
                <div style={{ fontSize:'11px', color:'#94A3B8', marginBottom:'12px' }}>
                  🔴 Red dots = OOS results · Dashed lines = spec limits
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartData} margin={{ top:10, right:10, left:0, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
                    <XAxis dataKey="date" tick={{ fontSize:9, fill:'#94A3B8' }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fontSize:9, fill:'#94A3B8' }} axisLine={false} tickLine={false}/>
                    <Tooltip
                      contentStyle={{ borderRadius:'10px', border:`1px solid ${PL}`, fontSize:'11px' }}
                      formatter={(v,n,p) => [v, p.payload.name]}/>
                    {stats && <>
                      <ReferenceLine y={stats.mean} stroke={GR} strokeWidth={1.5}
                        label={{ value:'Mean', fill:GR, fontSize:9 }}/>
                      <ReferenceLine y={stats.mean+3*stats.sigma} stroke={RD} strokeDasharray="4 2"
                        label={{ value:'+3σ', fill:RD, fontSize:9 }}/>
                      <ReferenceLine y={stats.mean-3*stats.sigma} stroke={RD} strokeDasharray="4 2"
                        label={{ value:'-3σ', fill:RD, fontSize:9 }}/>
                    </>}
                    {spec?.min_value != null && (
                      <ReferenceLine y={spec.min_value} stroke="#94A3B8" strokeDasharray="6 3"
                        label={{ value:'LSL', fill:'#94A3B8', fontSize:9 }}/>
                    )}
                    {spec?.max_value != null && (
                      <ReferenceLine y={spec.max_value} stroke="#94A3B8" strokeDasharray="6 3"
                        label={{ value:'USL', fill:'#94A3B8', fontSize:9 }}/>
                    )}
                    <Line type="monotone" dataKey="value" stroke={PM} strokeWidth={2}
                      dot={<CustomDot/>} activeDot={{ r:5 }} name="Result"/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Bar Chart */}
            {chartType===1 && (
              <div style={{ background:'#fff', borderRadius:'14px', border:`1.5px solid ${PL}`, padding:'16px' }}>
                <div style={{ fontWeight:'800', fontSize:'14px', color:'#0F172A', marginBottom:'12px' }}>
                  {tests.find(t=>t.id===selTest)?.name} — Results Bar Chart
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} margin={{ top:10, right:10, left:0, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
                    <XAxis dataKey="date" tick={{ fontSize:9, fill:'#94A3B8' }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fontSize:9, fill:'#94A3B8' }} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{ borderRadius:'10px', border:`1px solid ${PL}`, fontSize:'11px' }}/>
                    {spec?.min_value != null && (
                      <ReferenceLine y={spec.min_value} stroke={RD} strokeDasharray="4 2"/>
                    )}
                    {spec?.max_value != null && (
                      <ReferenceLine y={spec.max_value} stroke={RD} strokeDasharray="4 2"/>
                    )}
                    <Bar dataKey="value" radius={[4,4,0,0]} name="Result"
                      fill={PM} label={false}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Distribution Histogram */}
            {chartType===2 && (
              <div style={{ background:'#fff', borderRadius:'14px', border:`1.5px solid ${PL}`, padding:'16px' }}>
                <div style={{ fontWeight:'800', fontSize:'14px', color:'#0F172A', marginBottom:'4px' }}>
                  Result Distribution (Histogram)
                </div>
                <div style={{ fontSize:'11px', color:'#94A3B8', marginBottom:'12px' }}>
                  Shows how results are distributed across value ranges
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={histData} margin={{ top:10, right:10, left:0, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
                    <XAxis dataKey="range" tick={{ fontSize:9, fill:'#94A3B8' }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fontSize:9, fill:'#94A3B8' }} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{ borderRadius:'10px', border:`1px solid ${PL}`, fontSize:'11px' }}
                      formatter={(v) => [v, 'Count']}/>
                    <Bar dataKey="count" fill={PM} radius={[4,4,0,0]} name="Count"/>
                  </BarChart>
                </ResponsiveContainer>

                {/* Normal distribution note */}
                {stats && (
                  <div style={{ marginTop:'12px', padding:'10px 14px', background:'#F8FAFC',
                    borderRadius:'9px', fontSize:'12px', color:'#64748B' }}>
                    <strong style={{ color:'#374151' }}>Statistical Summary:</strong>{' '}
                    Mean = {stats.mean.toFixed(3)} · σ = {stats.sigma.toFixed(3)} ·
                    Range = [{stats.min.toFixed(3)}, {stats.max.toFixed(3)}] ·
                    n = {stats.n}
                    {spec?.display_spec && ` · Spec: ${spec.display_spec}`}
                  </div>
                )}
              </div>
            )}

            {/* Raw data table */}
            <div style={{ background:'#fff', borderRadius:'14px', border:`1.5px solid ${PL}`,
              padding:'16px', marginTop:'14px' }}>
              <div style={{ fontWeight:'800', fontSize:'13px', color:'#0F172A', marginBottom:'10px' }}>
                Raw Data — {results.length} results
              </div>
              <div style={{ overflowX:'auto', maxHeight:'300px', overflowY:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
                  <thead>
                    <tr style={{ background:'#F8FAFC' }}>
                      {['#','Date','Sample','Result','Unit','Status','Analyst'].map(h=>(
                        <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:'11px',
                          fontWeight:'700', color:'#64748B', borderBottom:'1px solid #E2E8F0',
                          whiteSpace:'nowrap', position:'sticky', top:0, background:'#F8FAFC' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r,i) => {
                      const oos = r.result_status==='fail_low'||r.result_status==='fail_high';
                      return (
                        <tr key={i} style={{ background: oos?'#FFF5F5': i%2===0?'#fff':'#FAFBFC' }}>
                          <td style={{ padding:'7px 10px', borderBottom:'1px solid #F1F5F9', color:'#94A3B8' }}>{i+1}</td>
                          <td style={{ padding:'7px 10px', borderBottom:'1px solid #F1F5F9', whiteSpace:'nowrap' }}>
                            {r.submitted_at ? format(new Date(r.submitted_at),'dd/MM/yy HH:mm') : '—'}
                          </td>
                          <td style={{ padding:'7px 10px', borderBottom:'1px solid #F1F5F9', fontWeight:'600', color:'#0F172A' }}>
                            {r.registered_samples?.sample_number || '—'}
                          </td>
                          <td style={{ padding:'7px 10px', borderBottom:'1px solid #F1F5F9',
                            fontWeight:'700', color: oos?RD:GR, fontFamily:'monospace' }}>
                            {r.val.toFixed(4)}
                          </td>
                          <td style={{ padding:'7px 10px', borderBottom:'1px solid #F1F5F9', color:'#64748B' }}>
                            {tests.find(t=>t.id===selTest)?.unit || '—'}
                          </td>
                          <td style={{ padding:'7px 10px', borderBottom:'1px solid #F1F5F9' }}>
                            <span style={{ background: oos?'#FEE2E2':'#DCFCE7',
                              color: oos?RD:GR, fontSize:'10px', fontWeight:'800',
                              padding:'2px 7px', borderRadius:'5px' }}>
                              {oos ? (r.result_status==='fail_low'?'FAIL ↓':'FAIL ↑') : 'PASS'}
                            </span>
                          </td>
                          <td style={{ padding:'7px 10px', borderBottom:'1px solid #F1F5F9', color:'#64748B' }}>
                            {r.analyst_signature || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
