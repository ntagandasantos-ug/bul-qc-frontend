// ============================================================
// FILE: src/pages/QCHeadDashboardPage.jsx
// QC Head & Assistant command centre
// Mobile/tablet responsive · All dropdowns wired · Assign Sample
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../context/AuthContext';
import { supabase }    from '../services/supabase';
import api             from '../services/api';
import { format, subDays, startOfDay, endOfDay, differenceInMinutes } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from 'recharts';
import { toast } from 'react-toastify';

const P   = '#6B21A8';
const PM  = '#7C3AED';
const PL  = '#EDE9FE';
const GR  = '#16A34A';
const RD  = '#DC2626';
const AM  = '#D97706';
const SL  = '#F8FAFC';

const DEPT_COLORS = {
  'Detergent'        : { bg:'#EDE9FE', color:'#6B21A8', border:'#C4B5FD' },
  'Soap'             : { bg:'#ECFDF5', color:'#059669', border:'#6EE7B7' },
  'Refinery'         : { bg:'#FFF7ED', color:'#EA580C', border:'#FDBA74' },
  'Boiler'           : { bg:'#F0F9FF', color:'#0369A1', border:'#7DD3FC' },
  'Filling & Packing': { bg:'#FEF9C3', color:'#854D0E', border:'#FDE68A' },
};

const REPORT_ITEMS = [
  { icon:'📚', label:'Report Books & Sign-off',      badge:'Core', path:'/report-books',       sub:'7 official lab record books with daily QC Head approval' },
  { icon:'⚠️', label:'OOS Investigation Log',         badge:null,   path:'/reports?tab=oos',    sub:'Out-of-spec history, root cause & corrective action tracker' },
  { icon:'📜', label:'Certificate of Analysis',       badge:'New',  path:'/reports?tab=coa',    sub:'Auto-generate COA documents for finished product batches' },
  { icon:'👤', label:'Analyst Performance',           badge:null,   path:'/reports?tab=analyst',sub:'Submissions, turnaround time, OOS rate & accuracy per analyst' },
  { icon:'📈', label:'SPC Control Charts',            badge:null,   path:'/spc-charts',         sub:'Shewhart X-bar & R charts — catch process drift before failure' },
  { icon:'🏭', label:'Batch Release Report',          badge:null,   path:'/reports?tab=batch',  sub:'Formal QC sign-off document for production batch release' },
  { icon:'💊', label:'Vitamin A Surveillance',        badge:null,   path:'/reports?tab=vita',   sub:'Daily Vitamin A results across all departments in one view' },
  { icon:'📊', label:'Trend & Statistical Analysis',  badge:null,   path:'/trend-analysis',     sub:'7-day, 30-day & custom range charts for any test parameter' },
];

const ADMIN_ITEMS = [
  { icon:'👥', label:'User Management',            badge:null,  path:'/admin/users',        sub:'Add, edit, deactivate users · reset passwords · manage roles' },
  { icon:'🔬', label:'Test Specifications',        badge:null,  path:'/admin/test-specs',   sub:'Update min/max ranges for any test across all sample types' },
  { icon:'⚙️', label:'Instrument Calibration',    badge:null,  path:'/admin/calibration',  sub:'Log calibration dates, certificates & next-due alerts' },
  { icon:'📋', label:'Method Validation Records',  badge:'New', path:'/admin/methods',      sub:'Store and retrieve analytical method validation documentation' },
  { icon:'🔒', label:'Full Audit Trail',           badge:null,  path:'/admin/audit',        sub:'Tamper-proof log of every create, edit & delete in the system' },
  { icon:'🏗️', label:'Department & Sample Config', badge:null,  path:'/admin/dept-config',  sub:'Manage departments, categories, sample types & subtypes' },
  { icon:'🔔', label:'Notification Rules',         badge:null,  path:'/admin/notifications',sub:'Configure OOS alerts, escalation chains & SMS/email triggers' },
  { icon:'⚙️', label:'System Settings & Backup',  badge:null,  path:'/admin/settings',     sub:'Shifts, timezone, data retention, export & system health' },
];

export default function QCHeadDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const [showReports, setShowReports] = useState(false);
  const [showAdmin,   setShowAdmin]   = useState(false);
  const reportsRef = useRef(null);
  const adminRef   = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (reportsRef.current && !reportsRef.current.contains(e.target)) setShowReports(false);
      if (adminRef.current   && !adminRef.current.contains(e.target))   setShowAdmin(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const [stats,        setStats]        = useState({ total:0, today:0, pending:0, running:0, complete:0, oos:0, passRate:0, stale:0 });
  const [depts,        setDepts]        = useState([]);
  const [oosFeed,      setOosFeed]      = useState([]);
  const [trend7,       setTrend7]       = useState([]);
  const [pieData,      setPieData]      = useState([]);
  const [staleSamples, setStaleSamples] = useState([]);
  const [loading,      setLoading]      = useState(true);

  const [showAssign,    setShowAssign]    = useState(false);
  const [assignStep,    setAssignStep]    = useState(1);
  const [assignSearch,  setAssignSearch]  = useState('');
  const [assignSamples, setAssignSamples] = useState([]);
  const [assignSample,  setAssignSample]  = useState(null);
  const [assignNew,     setAssignNew]     = useState(false);
  const [staffList,     setStaffList]     = useState([]);
  const [assignAnalyst, setAssignAnalyst] = useState('');
  const [availTests,    setAvailTests]    = useState([]);
  const [selTests,      setSelTests]      = useState([]);
  const [assigning,     setAssigning]     = useState(false);
  const [newSampleForm, setNewSampleForm] = useState({ sample_name:'', sample_number:'', dept_id:'', type_id:'', sampler_name:'' });
  const [deptList,      setDeptList]      = useState([]);
  const [typeList,      setTypeList]      = useState([]);

  const [dateMode, setDateMode] = useState('day');
  const [selDate,  setSelDate]  = useState(format(new Date(), 'yyyy-MM-dd'));
  const [fromDate, setFromDate] = useState(format(subDays(new Date(),6),'yyyy-MM-dd'));
  const [toDate,   setToDate]   = useState(format(new Date(),'yyyy-MM-dd'));

  const getRange = useCallback(() => {
    if (dateMode === 'day') {
      return { start: startOfDay(new Date(selDate)).toISOString(), end: endOfDay(new Date(selDate)).toISOString() };
    }
    return { start: startOfDay(new Date(fromDate)).toISOString(), end: endOfDay(new Date(toDate)).toISOString() };
  }, [dateMode, selDate, fromDate, toDate]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = getRange();
      const { data: samples } = await supabase
        .from('registered_samples')
        .select(`id, sample_name, sample_number, status, registered_at,
          departments(id, name, code),
          sample_test_assignments(id, result_value, result_status, submitted_at, tests(name))`)
        .gte('registered_at', start).lte('registered_at', end)
        .order('registered_at', { ascending: false });

      const all      = samples || [];
      const pending  = all.filter(s => s.status === 'pending');
      const running  = all.filter(s => s.status === 'in_progress');
      const complete = all.filter(s => s.status === 'complete');
      const oosAll   = all.flatMap(s => (s.sample_test_assignments||[]).filter(a => a.result_status==='fail_low'||a.result_status==='fail_high'));
      const submitted = all.flatMap(s => (s.sample_test_assignments||[]).filter(a => a.result_value));
      const passRate  = submitted.length ? Math.round(((submitted.length - oosAll.length)/submitted.length)*100) : 100;

      const stale = all.filter(s => {
        if (s.status !== 'in_progress') return false;
        const lastResult = (s.sample_test_assignments||[]).filter(a=>a.submitted_at).sort((a,b)=>new Date(b.submitted_at)-new Date(a.submitted_at))[0];
        const lastTime = lastResult ? new Date(lastResult.submitted_at) : new Date(s.registered_at);
        return differenceInMinutes(new Date(), lastTime) > 120;
      });

      setStats({ total:all.length, today:all.length, pending:pending.length, running:running.length, complete:complete.length, oos:oosAll.length, passRate, stale:stale.length });
      setStaleSamples(stale.slice(0,5));

      const deptMap = {};
      for (const s of all) {
        const d = s.departments;
        if (!d) continue;
        if (!deptMap[d.name]) deptMap[d.name] = { name:d.name, total:0, complete:0, oos:0 };
        deptMap[d.name].total++;
        if (s.status==='complete') deptMap[d.name].complete++;
        deptMap[d.name].oos += (s.sample_test_assignments||[]).filter(a=>a.result_status==='fail_low'||a.result_status==='fail_high').length;
      }
      setDepts(Object.values(deptMap));

      const oosList = all.flatMap(s =>
        (s.sample_test_assignments||[])
          .filter(a=>a.result_status==='fail_low'||a.result_status==='fail_high')
          .map(a=>({ sample_name:s.sample_name, sample_number:s.sample_number, test_name:a.tests?.name, result:a.result_value, status:a.result_status, time:a.submitted_at }))
      ).sort((a,b)=>new Date(b.time)-new Date(a.time)).slice(0,8);
      setOosFeed(oosList);

      const trend = [];
      for (let i=6; i>=0; i--) {
        const d = subDays(new Date(), i);
        const { data: dayData } = await supabase.from('registered_samples').select('id,status').gte('registered_at',startOfDay(d).toISOString()).lte('registered_at',endOfDay(d).toISOString());
        trend.push({ day:format(d,'EEE'), total:(dayData||[]).length, done:(dayData||[]).filter(s=>s.status==='complete').length });
      }
      setTrend7(trend);

      setPieData([
        { name:'Complete', value:complete.length, color:GR },
        { name:'Running',  value:running.length,  color:AM },
        { name:'Pending',  value:pending.length,  color:'#94A3B8' },
        { name:'OOS',      value:oosAll.length,   color:RD },
      ].filter(d=>d.value>0));
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [getRange]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const sub = supabase.channel('qchead_live')
      .on('postgres_changes',{event:'*',schema:'public',table:'registered_samples'},()=>load())
      .on('postgres_changes',{event:'*',schema:'public',table:'sample_test_assignments'},()=>load())
      .subscribe();
    return () => sub.unsubscribe();
  }, [load]);

  const searchSamples = async (q) => {
    if (!q.trim()) { setAssignSamples([]); return; }
    const { data } = await supabase.from('registered_samples').select('id,sample_name,sample_number,status,departments(name),sample_types(id,name)').or(`sample_name.ilike.%${q}%,sample_number.ilike.%${q}%`).in('status',['pending','in_progress']).limit(10);
    setAssignSamples(data||[]);
  };

  const loadAssignTests = async (typeId) => {
    if (!typeId) return;
    const { data } = await supabase.from('tests').select('id,name,code,unit,test_specifications(display_spec)').eq('sample_type_id',typeId).order('display_order');
    setAvailTests(data||[]);
    setSelTests((data||[]).map(t=>t.id));
  };

  useEffect(() => {
    if (showAssign) {
      api.get('/lookup/staff?role=Analyst').then(r=>setStaffList(r.data?.staff||[])).catch(()=>{});
      supabase.from('departments').select('id,name').then(({data})=>setDeptList(data||[]));
    }
  }, [showAssign]);

  useEffect(() => {
    if (newSampleForm.dept_id) supabase.from('sample_types').select('id,name,category_id').then(({data})=>setTypeList(data||[]));
  }, [newSampleForm.dept_id]);

  useEffect(() => { if (assignSample?.sample_types?.id) loadAssignTests(assignSample.sample_types.id); }, [assignSample]);
  useEffect(() => { if (newSampleForm.type_id) loadAssignTests(newSampleForm.type_id); }, [newSampleForm.type_id]);

  const handleAssign = async () => {
    if (!assignAnalyst) { toast.warning('Select an analyst'); return; }
    if (!selTests.length) { toast.warning('Select at least one test'); return; }
    setAssigning(true);
    try {
      let sampleId = assignSample?.id;
      if (assignNew) {
        const { data: s } = await supabase.from('registered_samples').insert({ sample_name:newSampleForm.sample_name, sample_number:newSampleForm.sample_number||`QCH-${Date.now()}`, department_id:newSampleForm.dept_id, sample_type_id:newSampleForm.type_id, sampler_name:newSampleForm.sampler_name||user?.full_name, status:'in_progress', registered_by:user?.id }).select('id').single();
        sampleId = s?.id;
      } else {
        await supabase.from('registered_samples').update({ status:'in_progress' }).eq('id', sampleId);
      }
      await supabase.from('sample_test_assignments').insert(selTests.map(testId => ({ sample_id:sampleId, test_id:testId, analyst_signature:assignAnalyst, assigned_by:user?.id })));
      toast.success(`✅ ${selTests.length} tests assigned to ${assignAnalyst}`);
      setShowAssign(false); setAssignStep(1); setAssignSample(null); setAssignNew(false); setAssignAnalyst(''); setSelTests([]);
      load();
    } catch(e) { toast.error(e.response?.data?.error || e.message); }
    finally { setAssigning(false); }
  };

  const DropdownMenu = ({ items, isMob }) => (
    <div style={isMob ? { position:'fixed', top:'56px', left:'8px', right:'8px', background:'#fff', borderRadius:'14px', boxShadow:'0 12px 40px rgba(107,33,168,0.3)', border:`1.5px solid ${PL}`, zIndex:9999, maxHeight:'80vh', overflowY:'auto' } : { position:'absolute', top:'calc(100% + 8px)', left:0, background:'#fff', borderRadius:'14px', boxShadow:'0 12px 40px rgba(107,33,168,0.22)', border:`1.5px solid ${PL}`, zIndex:300, minWidth:'380px' }}>
      {items.map((item,i) => (
        <button key={i} onClick={() => { navigate(item.path); setShowReports(false); setShowAdmin(false); }}
          style={{ display:'flex', alignItems:'flex-start', gap:'12px', width:'100%', padding:'12px 16px', border:'none', borderBottom:i<items.length-1?`1px solid ${PL}`:'none', background:'#fff', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}
          onMouseEnter={e=>e.currentTarget.style.background='#F5F3FF'}
          onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
          <span style={{ fontSize:'20px', flexShrink:0 }}>{item.icon}</span>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:'7px' }}>
              <span style={{ fontWeight:'700', fontSize:'13px', color:'#1F2937' }}>{item.label}</span>
              {item.badge && <span style={{ fontSize:'9px', fontWeight:'800', padding:'1px 6px', borderRadius:'6px', background:item.badge==='New'?'#FEF9C3':'#EDE9FE', color:item.badge==='New'?'#854D0E':P, border:`1px solid ${item.badge==='New'?'#FDE68A':PL}` }}>{item.badge}</span>}
            </div>
            <div style={{ fontSize:'11px', color:'#6B7280', marginTop:'2px', lineHeight:1.4 }}>{item.sub}</div>
          </div>
          <span style={{ fontSize:'12px', color:'#9CA3AF', flexShrink:0, marginTop:'2px' }}>→</span>
        </button>
      ))}
    </div>
  );

  const inp = { border:`1.5px solid ${PL}`, borderRadius:'9px', padding:'9px 12px', fontSize:'13px', fontFamily:'inherit', background:'#fff', color:'#111827', outline:'none', width:'100%', boxSizing:'border-box' };

  return (
    <div style={{ minHeight:'100vh', background:SL, paddingBottom:isMobile?'90px':'60px' }}>

      {/* TOP NAV */}
      <div style={{ background:`linear-gradient(135deg,${P},${PM})`, padding:'0 16px', display:'flex', alignItems:'center', gap:'8px', height:'56px', position:'sticky', top:0, zIndex:100, boxShadow:'0 2px 12px rgba(107,33,168,0.3)', overflowX:'auto' }}>
        <button onClick={()=>navigate('/inspection/detergent')}
          style={{ display:'flex', alignItems:'center', gap:'5px', padding:'6px 10px', background:'rgba(255,255,255,0.12)', border:'none', borderRadius:'8px', color:'#fff', fontSize:'11px', fontWeight:'700', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
          🔍 Line Inspect
        </button>

        <div ref={reportsRef} style={{ position:'relative', flexShrink:0 }}>
          <button onClick={()=>{ setShowReports(!showReports); setShowAdmin(false); }}
            style={{ display:'flex', alignItems:'center', gap:'5px', padding:'6px 10px', background:showReports?'rgba(255,255,255,0.25)':'rgba(255,255,255,0.12)', border:'none', borderRadius:'8px', color:'#fff', fontSize:'11px', fontWeight:'700', cursor:'pointer', whiteSpace:'nowrap' }}>
            📋 Reports {showReports?'▲':'▼'}
          </button>
          {showReports && <DropdownMenu items={REPORT_ITEMS} isMob={isMobile}/>}
        </div>

        <div ref={adminRef} style={{ position:'relative', flexShrink:0 }}>
          <button onClick={()=>{ setShowAdmin(!showAdmin); setShowReports(false); }}
            style={{ display:'flex', alignItems:'center', gap:'5px', padding:'6px 10px', background:showAdmin?'rgba(255,255,255,0.25)':'rgba(255,255,255,0.12)', border:'none', borderRadius:'8px', color:'#fff', fontSize:'11px', fontWeight:'700', cursor:'pointer', whiteSpace:'nowrap' }}>
            ⚙️ Admin {showAdmin?'▲':'▼'}
          </button>
          {showAdmin && <DropdownMenu items={ADMIN_ITEMS} isMob={isMobile}/>}
        </div>

        <div style={{ flex:1 }}/>
        <SessionTimer/>

        <button onClick={()=>setShowAssign(true)}
          style={{ padding:'6px 10px', background:'#FFB81C', border:'none', borderRadius:'8px', color:'#1F2937', fontSize:'11px', fontWeight:'800', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
          + Assign
        </button>

        <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:'13px', fontWeight:'800', flexShrink:0, cursor:'pointer' }} onClick={logout}>
          {user?.full_name?.[0]?.toUpperCase()||'Q'}
        </div>
      </div>

      {/* BODY */}
      <div style={{ padding:isMobile?'12px':'20px', maxWidth:'1400px', margin:'0 auto' }}>

        <div style={{ marginBottom:'14px' }}>
          <h1 style={{ fontSize:isMobile?'17px':'22px', fontWeight:'900', color:'#0F172A', margin:'0 0 2px' }}>Factory QC Dashboard</h1>
          <p style={{ fontSize:'12px', color:'#94A3B8', margin:0 }}>{format(new Date(),'EEEE, d MMMM yyyy')} · Live</p>
        </div>

        {/* Date filter */}
        <div style={{ background:'#fff', borderRadius:'12px', border:`1.5px solid ${PL}`, padding:'10px 12px', marginBottom:'14px', display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ display:'flex', borderRadius:'8px', overflow:'hidden', border:`1.5px solid ${PL}`, flexShrink:0 }}>
            {['day','range'].map(m=>(
              <button key={m} onClick={()=>setDateMode(m)} style={{ padding:'5px 12px', border:'none', background:dateMode===m?PM:'#fff', color:dateMode===m?'#fff':'#6B7280', fontSize:'12px', fontWeight:'700', cursor:'pointer' }}>{m==='day'?'Day':'Range'}</button>
            ))}
          </div>
          {dateMode==='day'
            ? <input type="date" value={selDate} onChange={e=>setSelDate(e.target.value)} style={{ border:`1.5px solid ${PL}`, borderRadius:'8px', padding:'5px 9px', fontSize:'12px' }}/>
            : <><input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} style={{ border:`1.5px solid ${PL}`, borderRadius:'8px', padding:'5px 9px', fontSize:'12px' }}/><span style={{ color:'#9CA3AF' }}>→</span><input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} style={{ border:`1.5px solid ${PL}`, borderRadius:'8px', padding:'5px 9px', fontSize:'12px' }}/></>
          }
          {['Today','Yesterday','This Week'].map((lbl,i)=>(
            <button key={lbl} onClick={()=>{ if(i===2){setDateMode('range');setFromDate(format(subDays(new Date(),6),'yyyy-MM-dd'));setToDate(format(new Date(),'yyyy-MM-dd'));}else{setDateMode('day');setSelDate(format(subDays(new Date(),[0,1,0][i]),'yyyy-MM-dd'));} }}
              style={{ padding:'5px 10px', border:`1.5px solid ${PL}`, borderRadius:'7px', background:'#F5F3FF', color:P, fontSize:'11px', fontWeight:'700', cursor:'pointer' }}>
              {lbl}
            </button>
          ))}
          <span style={{ fontSize:'12px', color:'#94A3B8', marginLeft:'auto' }}>{stats.total} samples</span>
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:isMobile?'repeat(3,1fr)':'repeat(6,1fr)', gap:'8px', marginBottom:'12px' }}>
          {[
            { label:'Total',    val:stats.total,    color:'#1E293B', bg:'#fff',    border:PL },
            { label:'Pending',  val:stats.pending,  color:'#64748B', bg:'#F8FAFC', border:'#E2E8F0' },
            { label:'Running',  val:stats.running,  color:AM,        bg:'#FFFBEB', border:'#FDE68A' },
            { label:'Complete', val:stats.complete, color:GR,        bg:'#F0FDF4', border:'#86EFAC' },
            { label:'OOS',      val:stats.oos,      color:RD,        bg:'#FEF2F2', border:'#FECACA' },
            { label:'Pass Rate',val:`${stats.passRate}%`, color:stats.passRate>=95?GR:stats.passRate>=80?AM:RD, bg:'#F5F3FF', border:PL },
          ].map(s=>(
            <div key={s.label} style={{ background:s.bg, border:`1.5px solid ${s.border}`, borderRadius:'10px', padding:'10px', textAlign:'center' }}>
              <div style={{ fontSize:isMobile?'20px':'26px', fontWeight:'900', color:s.color }}>{s.val}</div>
              <div style={{ fontSize:'9px', color:'#94A3B8', fontWeight:'700', textTransform:'uppercase', marginTop:'1px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Stale alert */}
        {stats.stale > 0 && (
          <div style={{ background:'#FFF7ED', border:'1.5px solid #FED7AA', borderRadius:'10px', padding:'10px 14px', marginBottom:'12px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:'13px', fontWeight:'700', color:AM }}>⏰ {stats.stale} stale sample{stats.stale>1?'s':''} — no activity for &gt;2hrs</span>
            <button onClick={()=>document.getElementById('stale-section')?.scrollIntoView({behavior:'smooth'})}
              style={{ padding:'4px 10px', background:AM, color:'#fff', border:'none', borderRadius:'7px', fontSize:'11px', fontWeight:'700', cursor:'pointer' }}>
              View ↓
            </button>
          </div>
        )}

        {/* Main grid */}
        <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr 320px', gap:'12px', alignItems:'start' }}>

          {/* Department cards */}
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            <div style={{ fontWeight:'800', fontSize:'13px', color:'#0F172A', marginBottom:'2px' }}>🏭 Department Status</div>
            {loading ? <div style={{ textAlign:'center', padding:'30px', color:'#94A3B8' }}>Loading...</div>
            : depts.length===0 ? <div style={{ textAlign:'center', padding:'30px', color:'#94A3B8', background:'#fff', borderRadius:'12px' }}>No samples for this period</div>
            : depts.map(d => {
              const cfg = DEPT_COLORS[d.name] || { bg:'#F8FAFC', color:'#475569', border:'#E2E8F0' };
              const pct = d.total ? Math.round((d.complete/d.total)*100) : 0;
              return (
                <div key={d.name} style={{ background:'#fff', borderRadius:'12px', border:`1.5px solid ${cfg.border}`, padding:'12px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                    <div style={{ fontWeight:'800', fontSize:'13px', color:'#0F172A' }}>{d.name}</div>
                    <div style={{ display:'flex', gap:'5px' }}>
                      {d.oos>0 && <span style={{ background:'#FEE2E2', color:RD, fontSize:'10px', fontWeight:'800', padding:'2px 6px', borderRadius:'5px' }}>⚠ {d.oos} OOS</span>}
                      <span style={{ background:cfg.bg, color:cfg.color, fontSize:'10px', fontWeight:'700', padding:'2px 6px', borderRadius:'5px' }}>{d.complete}/{d.total}</span>
                    </div>
                  </div>
                  <div style={{ background:'#F1F5F9', borderRadius:'4px', height:'5px', overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, background:d.oos>0?RD:GR, borderRadius:'4px' }}/>
                  </div>
                  <div style={{ fontSize:'10px', color:'#94A3B8', marginTop:'3px' }}>{pct}% complete</div>
                </div>
              );
            })}
          </div>

          {/* Charts */}
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <div style={{ background:'#fff', borderRadius:'12px', border:`1.5px solid ${PL}`, padding:'14px' }}>
              <div style={{ fontWeight:'800', fontSize:'13px', color:'#0F172A', marginBottom:'10px' }}>📊 7-Day Trend</div>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={trend7} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
                  <XAxis dataKey="day" tick={{ fontSize:10, fill:'#94A3B8' }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize:10, fill:'#94A3B8' }} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{ borderRadius:'10px', border:`1px solid ${PL}`, fontSize:'11px' }}/>
                  <Bar dataKey="total" fill="#EDE9FE" name="Total" radius={[3,3,0,0]}/>
                  <Bar dataKey="done"  fill={PM}       name="Done"  radius={[3,3,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {pieData.length>0 && (
              <div style={{ background:'#fff', borderRadius:'12px', border:`1.5px solid ${PL}`, padding:'14px' }}>
                <div style={{ fontWeight:'800', fontSize:'13px', color:'#0F172A', marginBottom:'10px' }}>🥧 Period Results</div>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={55} dataKey="value" nameKey="name" label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={9}>
                      {pieData.map((entry,i)=><Cell key={i} fill={entry.color}/>)}
                    </Pie>
                    <Tooltip/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* OOS Feed */}
          <div style={{ background:'#FEF2F2', borderRadius:'12px', border:'1.5px solid #FECACA', padding:'14px' }}>
            <div style={{ fontWeight:'800', fontSize:'13px', color:RD, marginBottom:'10px', display:'flex', justifyContent:'space-between' }}>
              <span>⚠️ OOS Alert Feed</span>
              <span style={{ fontSize:'10px', color:'#94A3B8', fontWeight:'600' }}>{oosFeed.length} alerts</span>
            </div>
            {oosFeed.length===0
              ? <div style={{ textAlign:'center', padding:'20px', color:GR, fontWeight:'700', fontSize:'12px' }}>✅ No OOS results</div>
              : oosFeed.map((o,i)=>(
                <div key={i} style={{ background:'#fff', borderRadius:'8px', padding:'8px 10px', border:'1px solid #FECACA', marginBottom:'6px' }}>
                  <div style={{ fontWeight:'700', fontSize:'11.5px', color:'#0F172A' }}>{o.sample_name}</div>
                  <div style={{ fontSize:'10px', color:'#94A3B8' }}>{o.sample_number}</div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:'3px' }}>
                    <span style={{ fontSize:'10.5px', color:RD, fontWeight:'700' }}>{o.test_name}: {o.result} {o.status==='fail_low'?'↓':'↑'}</span>
                    <span style={{ fontSize:'10px', color:'#94A3B8' }}>{o.time?format(new Date(o.time),'HH:mm'):''}</span>
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        {/* Stale samples */}
        {staleSamples.length>0 && (
          <div id="stale-section" style={{ background:'#fff', borderRadius:'12px', border:'1.5px solid #FED7AA', padding:'14px', marginTop:'12px' }}>
            <div style={{ fontWeight:'800', fontSize:'13px', color:AM, marginBottom:'10px' }}>⏰ Stale Samples</div>
            {staleSamples.map(s=>(
              <div key={s.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'#FFFBEB', borderRadius:'8px', border:'1px solid #FDE68A', marginBottom:'6px' }}>
                <div>
                  <div style={{ fontWeight:'700', fontSize:'12px', color:'#0F172A' }}>{s.sample_name}</div>
                  <div style={{ fontSize:'10px', color:'#94A3B8' }}>{s.sample_number}</div>
                </div>
                <button onClick={()=>navigate(`/analysis/${s.id}`)} style={{ padding:'5px 10px', background:AM, color:'#fff', border:'none', borderRadius:'7px', fontSize:'11px', fontWeight:'700', cursor:'pointer' }}>Open →</button>
              </div>
            ))}
          </div>
        )}

        {/* Quick actions */}
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginTop:'12px' }}>
          {[
            { label:'+ Register Sample', path:'/register-sample', bg:`linear-gradient(135deg,${P},${PM})`, color:'#fff' },
            { label:'📚 Report Books',   path:'/report-books',    bg:'#F5F3FF', color:P },
            { label:'📈 SPC Charts',     path:'/spc-charts',      bg:'#E0F2FE', color:'#0369A1' },
            { label:'📊 Trend Analysis', path:'/trend-analysis',  bg:'#F0FDF4', color:GR },
            { label:'👥 Users',          path:'/admin/users',     bg:'#F8FAFC', color:'#64748B' },
          ].map(q=>(
            <button key={q.label} onClick={()=>navigate(q.path)}
              style={{ padding:'8px 14px', background:q.bg, color:q.color, border:`1.5px solid ${q.color}22`, borderRadius:'9px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* ASSIGN SAMPLE MODAL */}
      {showAssign && (
        <div onClick={e=>{if(e.target===e.currentTarget){setShowAssign(false);setAssignStep(1);setAssignSample(null);setAssignNew(false);}}}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:600, display:'flex', alignItems:isMobile?'flex-end':'center', justifyContent:'center', padding:isMobile?0:16 }}>
          <div style={{ background:'#fff', borderRadius:isMobile?'20px 20px 0 0':'18px', width:'100%', maxWidth:'560px', maxHeight:isMobile?'90vh':'88vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 24px 80px rgba(0,0,0,0.3)' }}>
            <div style={{ background:`linear-gradient(135deg,${P},${PM})`, padding:'16px 20px', color:'#fff', flexShrink:0 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontWeight:'900', fontSize:'15px' }}>📋 Assign Sample for Analysis</div>
                  <div style={{ fontSize:'11px', color:'#DDD6FE', marginTop:'1px' }}>Step {assignStep} of 3 — {['','Choose Sample','Analyst & Tests','Confirm'][assignStep]}</div>
                </div>
                <button onClick={()=>{setShowAssign(false);setAssignStep(1);setAssignSample(null);setAssignNew(false);}}
                  style={{ background:'rgba(255,255,255,0.15)', border:'none', borderRadius:'8px', color:'#fff', fontSize:'18px', cursor:'pointer', width:'30px', height:'30px' }}>✕</button>
              </div>
              <div style={{ display:'flex', gap:'5px', marginTop:'10px' }}>
                {[1,2,3].map(s=><div key={s} style={{ height:'3px', flex:1, borderRadius:'3px', background:s<=assignStep?'rgba(255,255,255,0.9)':'rgba(255,255,255,0.25)' }}/>)}
              </div>
            </div>

            <div style={{ flex:1, overflowY:'auto', padding:'16px 18px' }}>
              {assignStep===1 && (
                <>
                  <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
                    {[['🔍 Find Existing',false],['✨ Register New',true]].map(([lbl,isNew])=>(
                      <button key={lbl} onClick={()=>setAssignNew(isNew)}
                        style={{ flex:1, padding:'9px', border:`1.5px solid ${assignNew===isNew?PM:PL}`, borderRadius:'9px', background:assignNew===isNew?PL:'#fff', color:assignNew===isNew?P:'#6B7280', fontSize:'12px', fontWeight:'700', cursor:'pointer' }}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                  {!assignNew ? (
                    <>
                      <input type="text" value={assignSearch} onChange={e=>{ setAssignSearch(e.target.value); searchSamples(e.target.value); }} placeholder="Search sample name or number..." style={{ ...inp, marginBottom:'10px' }}/>
                      {assignSamples.map(s=>(
                        <div key={s.id} onClick={()=>setAssignSample(s)}
                          style={{ padding:'10px 13px', borderRadius:'9px', cursor:'pointer', marginBottom:'5px', border:`1.5px solid ${assignSample?.id===s.id?PM:PL}`, background:assignSample?.id===s.id?PL:'#fff' }}>
                          <div style={{ fontWeight:'700', fontSize:'13px', color:'#0F172A' }}>{s.sample_name}</div>
                          <div style={{ fontSize:'11px', color:'#94A3B8' }}>{s.sample_number} · {s.departments?.name} · {s.status}</div>
                        </div>
                      ))}
                      {assignSearch && !assignSamples.length && <div style={{ textAlign:'center', color:'#94A3B8', fontSize:'12px', padding:'20px' }}>No pending samples found</div>}
                    </>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                      {[{label:'Sample Name *',key:'sample_name',ph:'e.g. Base Powder, 64N1'},{label:'Sampler Name',key:'sampler_name',ph:'Who collected this sample'}].map(f=>(
                        <div key={f.key}>
                          <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'#4C1D95', marginBottom:'4px' }}>{f.label}</label>
                          <input type="text" value={newSampleForm[f.key]} onChange={e=>setNewSampleForm(p=>({...p,[f.key]:e.target.value}))} placeholder={f.ph} style={inp}/>
                        </div>
                      ))}
                      <div>
                        <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'#4C1D95', marginBottom:'4px' }}>Department *</label>
                        <select value={newSampleForm.dept_id} onChange={e=>setNewSampleForm(p=>({...p,dept_id:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                          <option value="">— Select —</option>
                          {deptList.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'#4C1D95', marginBottom:'4px' }}>Sample Type *</label>
                        <select value={newSampleForm.type_id} onChange={e=>setNewSampleForm(p=>({...p,type_id:e.target.value}))} style={{ ...inp, cursor:'pointer' }}>
                          <option value="">— Select —</option>
                          {typeList.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </>
              )}

              {assignStep===2 && (
                <>
                  <div style={{ marginBottom:'14px' }}>
                    <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'#4C1D95', marginBottom:'5px' }}>Assign to Analyst *</label>
                    <select value={assignAnalyst} onChange={e=>setAssignAnalyst(e.target.value)} style={{ ...inp, cursor:'pointer' }}>
                      <option value="">— Select Analyst —</option>
                      {staffList.map(s=><option key={s.id} value={s.full_name}>{s.full_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                      <label style={{ fontSize:'11px', fontWeight:'700', color:'#4C1D95' }}>Tests ({selTests.length} selected)</label>
                      <button onClick={()=>setSelTests(selTests.length===availTests.length?[]:availTests.map(t=>t.id))}
                        style={{ background:'none', border:'none', color:PM, fontSize:'11px', fontWeight:'700', cursor:'pointer' }}>
                        {selTests.length===availTests.length?'Deselect All':'Select All'}
                      </button>
                    </div>
                    {availTests.length===0
                      ? <div style={{ padding:'20px', textAlign:'center', color:'#94A3B8', fontSize:'12px', background:'#F8FAFC', borderRadius:'10px' }}>No tests found for this sample type</div>
                      : availTests.map(t=>{
                        const checked = selTests.includes(t.id);
                        return (
                          <label key={t.id} onClick={()=>setSelTests(p=>p.includes(t.id)?p.filter(x=>x!==t.id):[...p,t.id])}
                            style={{ display:'flex', alignItems:'center', gap:'9px', padding:'9px 12px', border:`1.5px solid ${checked?PM:PL}`, borderRadius:'9px', cursor:'pointer', background:checked?PL:'#fff', marginBottom:'5px' }}>
                            <input type="checkbox" checked={checked} readOnly style={{ width:'15px', height:'15px', accentColor:PM }}/>
                            <div style={{ flex:1 }}>
                              <div style={{ fontWeight:'700', fontSize:'13px', color:'#0F172A' }}>{t.name}</div>
                              {t.test_specifications?.[0]?.display_spec && <div style={{ fontSize:'10px', color:AM }}>Spec: {t.test_specifications[0].display_spec}</div>}
                            </div>
                            {t.unit && <span style={{ fontSize:'10px', color:'#94A3B8' }}>{t.unit}</span>}
                            {checked && <span style={{ color:GR }}>✓</span>}
                          </label>
                        );
                      })
                    }
                  </div>
                </>
              )}

              {assignStep===3 && (
                <div style={{ background:'#F0FDF4', border:'1.5px solid #86EFAC', borderRadius:'12px', padding:'14px' }}>
                  <div style={{ fontWeight:'800', fontSize:'14px', color:GR, marginBottom:'10px' }}>✅ Ready to Assign</div>
                  <div style={{ fontSize:'13px', color:'#374151', display:'flex', flexDirection:'column', gap:'6px' }}>
                    <div><strong>Sample:</strong> {assignNew?newSampleForm.sample_name:assignSample?.sample_name}</div>
                    <div><strong>Analyst:</strong> {assignAnalyst}</div>
                    <div><strong>Tests ({selTests.length}):</strong> {availTests.filter(t=>selTests.includes(t.id)).map(t=>t.name).join(', ')}</div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding:'12px 18px', borderTop:`1.5px solid ${PL}`, background:'#F9FAFB', display:'flex', gap:'8px', flexShrink:0 }}>
              {assignStep>1 && (
                <button onClick={()=>setAssignStep(p=>p-1)}
                  style={{ padding:'10px 18px', background:'#F1F5F9', color:'#374151', border:'none', borderRadius:'9px', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>
                  ← Back
                </button>
              )}
              {assignStep<3 ? (
                <button onClick={()=>{
                  if(assignStep===1){
                    if(!assignNew&&!assignSample){toast.warning('Select or create a sample');return;}
                    if(assignNew&&!newSampleForm.sample_name){toast.warning('Enter a sample name');return;}
                    if(assignNew&&!newSampleForm.dept_id){toast.warning('Select a department');return;}
                    if(assignNew&&!newSampleForm.type_id){toast.warning('Select a sample type');return;}
                  }
                  if(assignStep===2){
                    if(!assignAnalyst){toast.warning('Select an analyst');return;}
                    if(!selTests.length){toast.warning('Select at least one test');return;}
                  }
                  setAssignStep(p=>p+1);
                }}
                  style={{ flex:1, padding:'11px', background:`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'9px', fontSize:'13px', fontWeight:'700', cursor:'pointer' }}>
                  Next →
                </button>
              ) : (
                <button onClick={handleAssign} disabled={assigning}
                  style={{ flex:1, padding:'11px', background:'linear-gradient(135deg,#059669,#047857)', color:'#fff', border:'none', borderRadius:'9px', fontSize:'13px', fontWeight:'700', cursor:assigning?'not-allowed':'pointer' }}>
                  {assigning?'⏳ Assigning...':'✅ Confirm Assignment'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SessionTimer() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const iv = setInterval(() => setElapsed(Math.floor((Date.now()-start)/1000)), 1000);
    return () => clearInterval(iv);
  }, []);
  const h=Math.floor(elapsed/3600), m=Math.floor((elapsed%3600)/60), s=elapsed%60;
  return (
    <span style={{ background:'rgba(255,255,255,0.12)', borderRadius:'8px', padding:'4px 8px', color:'#fff', fontSize:'10px', fontWeight:'700', fontFamily:'monospace', flexShrink:0 }}>
      ⏱ {String(h).padStart(2,'0')}:{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}
    </span>
  );
}
