// ============================================================
// FILE: src/pages/SPCControlChartsPage.jsx
// Shewhart X-bar & R charts — catch process drift before failure
// Western Electric rules violation highlighting
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { supabase } from '../services/supabase';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts';

const P  = '#6B21A8';
const PM = '#7C3AED';
const PL = '#EDE9FE';
const GR = '#16A34A';
const RD = '#DC2626';
const AM = '#D97706';

// ── Western Electric rules ───────────────────────────────────
// Rule 1: 1 point beyond 3σ
// Rule 2: 9 consecutive points same side of CL
// Rule 3: 6 consecutive points trending in same direction
// Rule 4: 2 of 3 points beyond 2σ
function checkWERules(points, cl, sigma) {
  const violations = new Set();
  for (let i = 0; i < points.length; i++) {
    const v = points[i];
    // Rule 1
    if (Math.abs(v - cl) > 3 * sigma) violations.add(i);
    // Rule 2
    if (i >= 8) {
      const last9 = points.slice(i-8, i+1);
      if (last9.every(p => p > cl) || last9.every(p => p < cl)) {
        last9.forEach((_, j) => violations.add(i-8+j));
      }
    }
    // Rule 3
    if (i >= 5) {
      const last6 = points.slice(i-5, i+1);
      const up   = last6.every((p,j) => j===0 || p > last6[j-1]);
      const down = last6.every((p,j) => j===0 || p < last6[j-1]);
      if (up || down) last6.forEach((_, j) => violations.add(i-5+j));
    }
    // Rule 4
    if (i >= 2) {
      const last3 = points.slice(i-2, i+1);
      const beyond2 = last3.filter(p => Math.abs(p-cl) > 2*sigma).length;
      if (beyond2 >= 2) violations.add(i);
    }
  }
  return violations;
}

export default function SPCControlChartsPage() {
  const navigate = useNavigate();

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const [depts,     setDepts]     = useState([]);
  const [types,     setTypes]     = useState([]);
  const [tests,     setTests]     = useState([]);
  const [selDept,   setSelDept]   = useState('');
  const [selType,   setSelType]   = useState('');
  const [selTest,   setSelTest]   = useState('');
  const [days,      setDays]      = useState(30);
  const [loading,   setLoading]   = useState(false);
  const [xbarData,  setXbarData]  = useState([]);
  const [rData,     setRData]     = useState([]);
  const [stats,     setStats]     = useState(null);
  const [spec,      setSpec]      = useState(null);

  useEffect(() => {
    supabase.from('departments').select('id, name').order('name')
      .then(({ data }) => setDepts(data || []));
  }, []);

  useEffect(() => {
    if (!selDept) { setTypes([]); setSelType(''); return; }
    supabase.from('sample_types')
      .select('id, name, sample_categories(department_id)')
      .then(({ data }) => {
        const filtered = (data||[]).filter(t => t.sample_categories?.department_id === selDept);
        setTypes(filtered);
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

  const loadData = useCallback(async () => {
    if (!selTest) return;
    setLoading(true);
    try {
      const from = startOfDay(subDays(new Date(), days)).toISOString();
      const to   = endOfDay(new Date()).toISOString();

      const { data } = await supabase
        .from('sample_test_assignments')
        .select(`
          result_value, result_status, submitted_at,
          registered_samples(sample_name, sample_number, registered_at)
        `)
        .eq('test_id', selTest)
        .not('result_value', 'is', null)
        .gte('submitted_at', from)
        .lte('submitted_at', to)
        .order('submitted_at');

      const numeric = (data||[])
        .map(d => ({ ...d, val: parseFloat(d.result_value) }))
        .filter(d => !isNaN(d.val));

      if (numeric.length < 2) {
        setXbarData([]); setRData([]); setStats(null); setSpec(null);
        setLoading(false); return;
      }

      // Calculate X-bar stats
      const values = numeric.map(d => d.val);
      const n      = values.length;
      const mean   = values.reduce((a,b) => a+b, 0) / n;
      const sigma  = Math.sqrt(values.reduce((a,b) => a + Math.pow(b-mean,2), 0) / (n-1));
      const ucl    = mean + 3*sigma;
      const lcl    = mean - 3*sigma;
      const ucl2   = mean + 2*sigma;
      const lcl2   = mean - 2*sigma;

      // Range (consecutive pairs)
      const ranges = values.slice(1).map((v,i) => Math.abs(v - values[i]));
      const rMean  = ranges.reduce((a,b) => a+b, 0) / ranges.length;
      const rUCL   = rMean * 3.267; // D4 factor for n=2
      const rSigma = rMean / 1.128; // d2 factor for n=2

      const xViolations = checkWERules(values, mean, sigma);
      const rViolations = checkWERules(ranges, rMean, rSigma);

      // Get spec
      const testObj = tests.find(t => t.id === selTest);
      const s = testObj?.test_specifications?.[0];
      setSpec(s || null);

      setStats({ mean, sigma, ucl, lcl, ucl2, lcl2, n, rMean, rUCL,
        cpk: s?.min_value != null && s?.max_value != null
          ? Math.min((s.max_value - mean)/(3*sigma), (mean - s.min_value)/(3*sigma))
          : null,
      });

      setXbarData(numeric.map((d,i) => ({
        idx    : i+1,
        label  : d.registered_samples?.sample_number || `#${i+1}`,
        date   : d.submitted_at ? format(new Date(d.submitted_at),'dd/MM') : '',
        value  : parseFloat(d.val.toFixed(4)),
        violation: xViolations.has(i),
      })));

      setRData(ranges.map((r,i) => ({
        idx      : i+1,
        label    : numeric[i+1]?.registered_samples?.sample_number || `#${i+2}`,
        date     : numeric[i+1]?.submitted_at ? format(new Date(numeric[i+1].submitted_at),'dd/MM') : '',
        value    : parseFloat(r.toFixed(4)),
        violation: rViolations.has(i),
      })));

    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [selTest, days, tests]);

  useEffect(() => { loadData(); }, [loadData]);

  const sel = {
    border:`1.5px solid ${PL}`, borderRadius:'9px', padding:'9px 12px',
    fontSize:'13px', fontFamily:'inherit', background:'#fff',
    color:'#111827', outline:'none', cursor:'pointer', width:'100%', boxSizing:'border-box',
  };

  const CustomDot = ({ cx, cy, payload }) =>
    payload?.violation
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
            📈 SPC Control Charts
          </h1>
          <p style={{ fontSize:'12px', color:'#94A3B8', margin:'2px 0 0' }}>
            Shewhart X-bar & R charts · Western Electric rules · catch process drift before failure
          </p>
        </div>

        {/* Filters */}
        <div style={{ background:'#fff', borderRadius:'12px', border:`1.5px solid ${PL}`,
          padding:'14px', marginBottom:'16px',
          display:'grid', gridTemplateColumns: isMobile?'1fr':'1fr 1fr 1fr 1fr', gap:'10px' }}>
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
          <div>
            <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'#4C1D95', marginBottom:'4px' }}>Time Range</label>
            <select value={days} onChange={e=>setDays(Number(e.target.value))} style={sel}>
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 60 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
        </div>

        {!selTest ? (
          <div style={{ textAlign:'center', padding:'80px 20px', background:'#fff',
            borderRadius:'14px', border:`1.5px solid ${PL}` }}>
            <div style={{ fontSize:'48px', marginBottom:'12px' }}>📈</div>
            <div style={{ fontWeight:'700', fontSize:'15px', color:'#374151' }}>Select a test parameter</div>
            <div style={{ fontSize:'12px', color:'#94A3B8', marginTop:'6px' }}>
              Choose department → sample type → test to view the control chart
            </div>
          </div>
        ) : loading ? (
          <div style={{ textAlign:'center', padding:'60px', color:'#94A3B8', fontWeight:'600' }}>
            Loading chart data...
          </div>
        ) : xbarData.length < 2 ? (
          <div style={{ textAlign:'center', padding:'60px', background:'#fff',
            borderRadius:'14px', border:`1.5px solid ${PL}` }}>
            <div style={{ fontSize:'36px', marginBottom:'10px' }}>📭</div>
            <div style={{ fontWeight:'700', fontSize:'14px', color:'#374151' }}>
              Not enough data for control chart
            </div>
            <div style={{ fontSize:'12px', color:'#94A3B8', marginTop:'4px' }}>
              At least 2 results needed for this test in the selected time range
            </div>
          </div>
        ) : (
          <>
            {/* Stats cards */}
            {stats && (
              <div style={{ display:'grid', gridTemplateColumns: isMobile?'repeat(2,1fr)':'repeat(4,1fr)',
                gap:'10px', marginBottom:'14px' }}>
                {[
                  { label:'Mean (X̄)',    val:stats.mean.toFixed(3),   color:PM },
                  { label:'Std Dev (σ)', val:stats.sigma.toFixed(3),  color:'#0369A1' },
                  { label:'UCL (3σ)',    val:stats.ucl.toFixed(3),    color:RD },
                  { label:'LCL (3σ)',    val:stats.lcl.toFixed(3),    color:RD },
                ].map(s=>(
                  <div key={s.label} style={{ background:'#fff', borderRadius:'10px',
                    border:`1.5px solid ${PL}`, padding:'12px', textAlign:'center' }}>
                    <div style={{ fontSize:'18px', fontWeight:'900', color:s.color, fontFamily:'monospace' }}>{s.val}</div>
                    <div style={{ fontSize:'10px', color:'#94A3B8', fontWeight:'700',
                      textTransform:'uppercase', marginTop:'2px' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Cpk card */}
            {stats?.cpk != null && (
              <div style={{ background: stats.cpk>=1.33?'#F0FDF4':stats.cpk>=1?'#FFFBEB':'#FEF2F2',
                border:`1.5px solid ${stats.cpk>=1.33?'#86EFAC':stats.cpk>=1?'#FDE68A':'#FECACA'}`,
                borderRadius:'12px', padding:'12px 16px', marginBottom:'14px',
                display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontWeight:'800', fontSize:'14px',
                    color: stats.cpk>=1.33?GR:stats.cpk>=1?AM:RD }}>
                    Process Capability (Cpk): {stats.cpk.toFixed(3)}
                  </div>
                  <div style={{ fontSize:'12px', color:'#64748B', marginTop:'2px' }}>
                    {stats.cpk>=1.33 ? '✅ Excellent — process well within spec' :
                     stats.cpk>=1.0  ? '⚠️ Acceptable — marginal process capability' :
                                       '❌ Poor — process not capable, immediate action needed'}
                  </div>
                </div>
                {spec?.display_spec && (
                  <span style={{ background:'#FFFBEB', color:AM, fontSize:'12px', fontWeight:'700',
                    padding:'4px 10px', borderRadius:'8px' }}>Spec: {spec.display_spec}</span>
                )}
              </div>
            )}

            {/* X-bar Chart */}
            <div style={{ background:'#fff', borderRadius:'14px', border:`1.5px solid ${PL}`,
              padding:'16px', marginBottom:'14px' }}>
              <div style={{ fontWeight:'800', fontSize:'14px', color:'#0F172A', marginBottom:'4px' }}>
                X-bar Chart — Individual Values
              </div>
              <div style={{ fontSize:'11px', color:'#94A3B8', marginBottom:'12px' }}>
                🔴 Red dots = Western Electric rule violations
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={xbarData} margin={{ top:10, right:10, left:0, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
                  <XAxis dataKey="date" tick={{ fontSize:9, fill:'#94A3B8' }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize:9, fill:'#94A3B8' }} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{ borderRadius:'10px', border:`1px solid ${PL}`, fontSize:'11px' }}
                    formatter={(v,n) => [v, n]}/>
                  {stats && <>
                    <ReferenceLine y={stats.ucl}  stroke={RD} strokeDasharray="4 2" label={{ value:'UCL', fill:RD, fontSize:9 }}/>
                    <ReferenceLine y={stats.ucl2} stroke={AM} strokeDasharray="4 2" label={{ value:'+2σ', fill:AM, fontSize:9 }}/>
                    <ReferenceLine y={stats.mean} stroke={GR} strokeWidth={1.5} label={{ value:'CL', fill:GR, fontSize:9 }}/>
                    <ReferenceLine y={stats.lcl2} stroke={AM} strokeDasharray="4 2" label={{ value:'-2σ', fill:AM, fontSize:9 }}/>
                    <ReferenceLine y={stats.lcl}  stroke={RD} strokeDasharray="4 2" label={{ value:'LCL', fill:RD, fontSize:9 }}/>
                    {spec?.min_value && <ReferenceLine y={spec.min_value} stroke="#94A3B8" strokeDasharray="6 3" label={{ value:'LSL', fill:'#94A3B8', fontSize:9 }}/>}
                    {spec?.max_value && <ReferenceLine y={spec.max_value} stroke="#94A3B8" strokeDasharray="6 3" label={{ value:'USL', fill:'#94A3B8', fontSize:9 }}/>}
                  </>}
                  <Line type="monotone" dataKey="value" stroke={PM} strokeWidth={1.5}
                    dot={<CustomDot/>} activeDot={{ r:5 }} name="Value"/>
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* R Chart */}
            {rData.length > 0 && stats && (
              <div style={{ background:'#fff', borderRadius:'14px', border:`1.5px solid ${PL}`, padding:'16px' }}>
                <div style={{ fontWeight:'800', fontSize:'14px', color:'#0F172A', marginBottom:'4px' }}>
                  R Chart — Moving Range
                </div>
                <div style={{ fontSize:'11px', color:'#94A3B8', marginBottom:'12px' }}>
                  Monitors process variation — large ranges indicate instability
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={rData} margin={{ top:10, right:10, left:0, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
                    <XAxis dataKey="date" tick={{ fontSize:9, fill:'#94A3B8' }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fontSize:9, fill:'#94A3B8' }} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{ borderRadius:'10px', border:`1px solid ${PL}`, fontSize:'11px' }}/>
                    <ReferenceLine y={stats.rUCL}  stroke={RD} strokeDasharray="4 2" label={{ value:'UCL', fill:RD, fontSize:9 }}/>
                    <ReferenceLine y={stats.rMean} stroke={GR} strokeWidth={1.5} label={{ value:'R̄', fill:GR, fontSize:9 }}/>
                    <ReferenceLine y={0} stroke="#E2E8F0"/>
                    <Line type="monotone" dataKey="value" stroke="#0369A1" strokeWidth={1.5}
                      dot={<CustomDot/>} activeDot={{ r:5 }} name="Range"/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Violation summary */}
            {xbarData.some(d=>d.violation) && (
              <div style={{ background:'#FEF2F2', border:'1.5px solid #FECACA',
                borderRadius:'12px', padding:'14px', marginTop:'14px' }}>
                <div style={{ fontWeight:'800', fontSize:'13px', color:RD, marginBottom:'8px' }}>
                  ⚠️ Western Electric Rule Violations Detected
                </div>
                <div style={{ fontSize:'12px', color:'#7F1D1D', lineHeight:1.6 }}>
                  {xbarData.filter(d=>d.violation).length} data point(s) violate control rules.
                  Investigate potential special causes: equipment drift, material changes,
                  operator variation, or measurement error.
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
