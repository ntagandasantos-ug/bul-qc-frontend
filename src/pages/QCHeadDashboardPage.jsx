// ============================================================
// FILE: frontend/bul-qc-app/src/pages/QCHeadDashboardPage.jsx
// Full-width QC Head overview dashboard
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar     from '../components/Navbar';
import PageFooter from '../components/PageFooter';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { supabase } from '../services/supabase';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const P  = '#6B21A8';
const PM = '#7C3AED';
const PL = '#EDE9FE';
const G  = '#FFB81C';
const GR = '#16A34A';
const RD = '#DC2626';

const DEPT_CONFIG = {
  DET  :{ name:'Detergent',         icon:'🧴', color:'#7C3AED', light:'#EDE9FE', route:'/dashboard/dept' },
  REF  :{ name:'Refinery',          icon:'🏭', color:'#0369A1', light:'#E0F2FE', route:'/dashboard/ref'  },
  FP   :{ name:'Filling & Packing', icon:'🛢️', color:'#7C2D12', light:'#FFF7ED', route:'/dashboard/fp'   },
  SOAP :{ name:'Soap',              icon:'🧼', color:'#059669', light:'#ECFDF5', route:'/dashboard/soap' },
};

export default function QCHeadDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading,      setLoading]      = useState(true);
  const [deptStats,    setDeptStats]    = useState({});
  const [oosFeed,      setOosFeed]      = useState([]);
  const [analysts,     setAnalysts]     = useState([]);
  const [pendingSamples,setPending]     = useState([]);
  const [weekData,     setWeekData]     = useState([]);
  const [clock,        setClock]        = useState(new Date());
  const [selDept,      setSelDept]      = useState('ALL');
  const [assignModal,  setAssignModal]  = useState(null);
  const [selAnalyst,   setSelAnalyst]   = useState('');
  const [assignNote,   setAssignNote]   = useState('');
  const [assigning,    setAssigning]    = useState(false);
  const [toast,        setToast]        = useState(null);
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const showToast = (msg, type='success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Load all samples + results for today
      const { data: samples } = await supabase
        .from('registered_samples')
        .select(`
          id, sample_number, sample_name, status, registered_at, department_id,
          departments ( name, code ),
          sample_types ( name ),
          sample_test_assignments (
            id, result_value, result_status, submitted_at, analyst_signature,
            tests ( name, unit )
          )
        `)
        .gte('registered_at', startOfDay(new Date()).toISOString())
        .lte('registered_at', endOfDay(new Date()).toISOString())
        .order('registered_at', { ascending: false });

      const all = samples || [];

      // Build dept stats
      const stats = {};
      for (const s of all) {
        const code = s.departments?.code || 'OTHER';
        if (!stats[code]) stats[code] = { total:0, pending:0, inProgress:0, complete:0, oos:0 };
        stats[code].total++;
        if (s.status === 'pending')     stats[code].pending++;
        if (s.status === 'in_progress') stats[code].inProgress++;
        if (s.status === 'complete')    stats[code].complete++;
        const hasOOS = (s.sample_test_assignments||[]).some(a =>
          a.result_status === 'fail_low' || a.result_status === 'fail_high'
        );
        if (hasOOS) stats[code].oos++;
      }
      setDeptStats(stats);

      // OOS feed
      const oosItems = [];
      for (const s of all) {
        for (const a of (s.sample_test_assignments||[])) {
          if (a.result_status === 'fail_low' || a.result_status === 'fail_high') {
            oosItems.push({
              id         : a.id,
              sampleName : s.sample_name,
              sampleNum  : s.sample_number,
              deptCode   : s.departments?.code,
              deptName   : s.departments?.name,
              testName   : a.tests?.name,
              unit       : a.tests?.unit,
              value      : a.result_value,
              status     : a.result_status,
              analyst    : a.analyst_signature,
              submittedAt: a.submitted_at,
            });
          }
        }
      }
      setOosFeed(oosItems.sort((a,b) => new Date(b.submittedAt||0) - new Date(a.submittedAt||0)));

      // Pending > 2 hours without results
      const twoHoursAgo = new Date(Date.now() - 2*60*60*1000);
      const stale = all.filter(s =>
        s.status === 'pending' &&
        new Date(s.registered_at) < twoHoursAgo
      );
      setPending(stale);

      // Week trend data
      const weekArr = [];
      for (let i = 6; i >= 0; i--) {
        const day = subDays(new Date(), i);
        const { data: daySamples } = await supabase
          .from('registered_samples')
          .select('id, sample_test_assignments(result_status)')
          .gte('registered_at', startOfDay(day).toISOString())
          .lte('registered_at', endOfDay(day).toISOString());

        const dayAll  = daySamples || [];
        const dayOOS  = dayAll.filter(s =>
          (s.sample_test_assignments||[]).some(a =>
            a.result_status==='fail_low'||a.result_status==='fail_high'
          )
        ).length;
        weekArr.push({
          day  : format(day, 'EEE'),
          total: dayAll.length,
          oos  : dayOOS,
          pass : dayAll.length - dayOOS,
        });
      }
      setWeekData(weekArr);

      // Load analysts for assignment
      const { data: staff } = await supabase
        .from('app_users')
        .select('id, full_name, username, roles(name)')
        .order('full_name');
      setAnalysts((staff||[]).filter(s =>
        !['QC Head','QC Assistant'].includes(s.roles?.name)
      ));

    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    const sub = supabase.channel('qc_head_live')
      .on('postgres_changes',
        { event:'*', schema:'public', table:'sample_test_assignments' },
        () => load()
      ).subscribe();
    return () => sub.unsubscribe();
  }, [load]);

  // Assign test to analyst
  const handleAssign = async () => {
    if (!selAnalyst || !assignModal) return;
    setAssigning(true);
    try {
      await supabase.from('analyst_assignments').insert({
        sample_id    : assignModal.sampleId,
        assignment_id: assignModal.assignmentId,
        assigned_to  : selAnalyst,
        assigned_by  : user.id,
        notes        : assignNote.trim() || null,
      });
      showToast('Test assigned successfully');
      setAssignModal(null);
      setSelAnalyst('');
      setAssignNote('');
    } catch(e) {
      showToast('Failed to assign: ' + e.message, 'error');
    } finally { setAssigning(false); }
  };

  // Totals
  const totalToday  = Object.values(deptStats).reduce((s,d) => s+d.total, 0);
  const totalOOS    = Object.values(deptStats).reduce((s,d) => s+d.oos, 0);
  const totalDone   = Object.values(deptStats).reduce((s,d) => s+d.complete, 0);
  const passRate    = totalToday > 0 ? Math.round(((totalToday-totalOOS)/totalToday)*100) : 100;

  const pieData = [
    { name:'Pass',     value: totalToday - totalOOS, color: GR  },
    { name:'OOS',      value: totalOOS,               color: RD  },
  ].filter(d => d.value > 0);

  const inp = {
    border:`1.5px solid ${PL}`, borderRadius:'8px',
    padding:'9px 12px', fontSize:'13px',
    fontFamily:'inherit', background:'#fff',
    color:'#111827', outline:'none', boxSizing:'border-box', width:'100%',
  };

  return (
    <div style={{ minHeight:'100vh', background:'#F5F3FF', paddingBottom:'56px' }}>
      <Navbar />

      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed', top:'70px', right:'16px', zIndex:500,
          background: toast.type==='error' ? '#FEF2F2' : '#F0FDF4',
          border: `1.5px solid ${toast.type==='error'?'#FECACA':'#86EFAC'}`,
          borderRadius:'12px', padding:'12px 18px',
          color: toast.type==='error'?RD:GR,
          fontSize:'13px', fontWeight:'700',
          boxShadow:'0 4px 16px rgba(0,0,0,0.1)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Assign modal */}
      {assignModal && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.5)',
          zIndex:400, display:'flex', alignItems:'center', justifyContent:'center',
          padding:'20px',
        }}>
          <div style={{ background:'#fff', borderRadius:'16px', padding:'24px', maxWidth:'420px', width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ fontSize:'16px', fontWeight:'800', color:'#1F2937', margin:'0 0 4px' }}>
              Assign Test to Analyst
            </h3>
            <p style={{ fontSize:'13px', color:'#6B7280', margin:'0 0 16px' }}>
              <strong>{assignModal.testName}</strong> on {assignModal.sampleName}
            </p>

            <label style={{ display:'block', fontSize:'12px', fontWeight:'700', color:'#4C1D95', marginBottom:'5px' }}>
              Select Analyst *
            </label>
            <select value={selAnalyst} onChange={e=>setSelAnalyst(e.target.value)} style={{ ...inp, marginBottom:'12px', cursor:'pointer' }}>
              <option value="">— Choose analyst —</option>
              {analysts.map(a => (
                <option key={a.id} value={a.id}>{a.full_name} ({a.roles?.name})</option>
              ))}
            </select>

            <label style={{ display:'block', fontSize:'12px', fontWeight:'700', color:'#4C1D95', marginBottom:'5px' }}>
              Note (optional)
            </label>
            <textarea value={assignNote} onChange={e=>setAssignNote(e.target.value)}
              style={{ ...inp, minHeight:'70px', resize:'vertical', marginBottom:'16px' }}
              placeholder="Any special instructions for the analyst..." />

            <div style={{ display:'flex', gap:'8px' }}>
              <button onClick={handleAssign} disabled={!selAnalyst||assigning}
                style={{ flex:1, padding:'11px', background: !selAnalyst?'#A78BFA':`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:'700', cursor: !selAnalyst?'not-allowed':'pointer', fontFamily:'inherit' }}>
                {assigning ? 'Assigning...' : '✅ Assign'}
              </button>
              <button onClick={()=>{ setAssignModal(null); setSelAnalyst(''); setAssignNote(''); }}
                style={{ flex:1, padding:'11px', background:'#F3F4F6', color:'#374151', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding:'14px 16px', maxWidth:'100%' }}>

        {/* Page header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px', flexWrap:'wrap', gap:'8px' }}>
          <div>
            <h1 style={{ fontSize:'20px', fontWeight:'900', color:'#1F2937', margin:'0 0 2px' }}>
              QC Head Dashboard
            </h1>
            <p style={{ fontSize:'12px', color:'#9CA3AF', margin:0 }}>
              {format(clock, 'EEEE, dd MMMM yyyy')} · {format(clock, 'HH:mm:ss')}
            </p>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={() => navigate('/report-books')}
              style={{ padding:'9px 18px', background:`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'10px', fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit', boxShadow:'0 2px 8px rgba(124,58,237,0.3)' }}>
              📚 Report Books
            </button>
            <button onClick={() => navigate('/register-sample')}
              style={{ padding:'9px 18px', background:'#fff', color:P, border:`1.5px solid ${PL}`, borderRadius:'10px', fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>
              + Register Sample
            </button>
          </div>
        </div>

        {/* ── FACTORY PULSE STATS ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:'10px', marginBottom:'16px' }}>
          {[
            { label:'Total Today',   val:totalToday, icon:'📋', col:PM,    sub:'all departments' },
            { label:'Completed',     val:totalDone,  icon:'✅', col:GR,    sub:'results submitted' },
            { label:'Out of Spec',   val:totalOOS,   icon:'⚠️', col:RD,    sub:'need attention' },
            { label:'Pass Rate',     val:passRate+'%',icon:'📊', col:'#0369A1', sub:'today' },
            { label:'Stale Samples', val:pendingSamples.length, icon:'⏰', col:'#EA580C', sub:'>2hrs no results' },
          ].map(s => (
            <div key={s.label} style={{
              background:'#fff', borderRadius:'14px',
              border:`2px solid ${s.col}18`,
              padding:'14px 16px',
              boxShadow:'0 1px 6px rgba(107,33,168,0.07)',
            }}>
              <div style={{ fontSize:'22px', marginBottom:'4px' }}>{s.icon}</div>
              <div style={{ fontSize:'26px', fontWeight:'900', color:s.col, lineHeight:1 }}>{s.val}</div>
              <div style={{ fontSize:'12px', fontWeight:'700', color:'#374151', marginTop:'4px' }}>{s.label}</div>
              <div style={{ fontSize:'10px', color:'#9CA3AF' }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* ── MAIN GRID ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 380px', gap:'14px', marginBottom:'14px' }}>

          {/* Department Cards */}
          <div style={{ gridColumn:'1/3', display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'10px' }}>
            {Object.entries(DEPT_CONFIG).map(([code, cfg]) => {
              const s = deptStats[code] || { total:0, pending:0, inProgress:0, complete:0, oos:0 };
              const pct = s.total>0 ? Math.round((s.complete/s.total)*100) : 0;
              return (
                <div key={code}
                  onClick={() => navigate(cfg.route)}
                  style={{
                    background:'#fff', borderRadius:'14px',
                    border:`2px solid ${cfg.color}22`,
                    padding:'16px', cursor:'pointer',
                    boxShadow:'0 1px 6px rgba(107,33,168,0.07)',
                    transition:'all 0.2s',
                    position:'relative', overflow:'hidden',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 4px 16px rgba(107,33,168,0.15)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 1px 6px rgba(107,33,168,0.07)'; }}
                >
                  {/* OOS badge */}
                  {s.oos > 0 && (
                    <div style={{ position:'absolute', top:'12px', right:'12px', background:RD, color:'#fff', borderRadius:'20px', padding:'2px 8px', fontSize:'11px', fontWeight:'800' }}>
                      ⚠️ {s.oos} OOS
                    </div>
                  )}

                  <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' }}>
                    <div style={{ fontSize:'28px' }}>{cfg.icon}</div>
                    <div>
                      <div style={{ fontWeight:'800', fontSize:'14px', color:'#1F2937' }}>{cfg.name}</div>
                      <div style={{ fontSize:'11px', color:'#9CA3AF' }}>Click to view live results</div>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
                    {[
                      { l:'Total', v:s.total, c:'#374151' },
                      { l:'Pending', v:s.pending, c:'#6B7280' },
                      { l:'Running', v:s.inProgress, c:'#EA580C' },
                      { l:'Done', v:s.complete, c:GR },
                    ].map(x => (
                      <div key={x.l} style={{ flex:1, textAlign:'center' }}>
                        <div style={{ fontSize:'18px', fontWeight:'900', color:x.c }}>{x.v}</div>
                        <div style={{ fontSize:'9px', color:'#9CA3AF', fontWeight:'600' }}>{x.l}</div>
                      </div>
                    ))}
                  </div>

                  {/* Progress bar */}
                  <div style={{ background:'#F3F4F6', borderRadius:'6px', height:'6px', overflow:'hidden' }}>
                    <div style={{ width:`${pct}%`, height:'100%', background:`linear-gradient(90deg,${cfg.color},${cfg.color}99)`, borderRadius:'6px', transition:'width 0.5s' }}/>
                  </div>
                  <div style={{ fontSize:'10px', color:'#9CA3AF', marginTop:'3px', textAlign:'right' }}>
                    {pct}% complete
                  </div>
                </div>
              );
            })}
          </div>

          {/* OOS Alert Feed */}
          <div style={{ background:'#fff', borderRadius:'14px', border:`1.5px solid ${PL}`, overflow:'hidden', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'12px 16px', background:`linear-gradient(135deg,${RD},#B91C1C)`, color:'#fff' }}>
              <div style={{ fontWeight:'800', fontSize:'14px' }}>⚠️ OOS Alert Feed</div>
              <div style={{ fontSize:'11px', color:'#FCA5A5', marginTop:'2px' }}>
                {oosFeed.length} out of spec result(s) today
              </div>
            </div>
            <div style={{ flex:1, overflowY:'auto', maxHeight:'320px' }}>
              {oosFeed.length === 0 ? (
                <div style={{ padding:'32px', textAlign:'center', color:'#9CA3AF' }}>
                  <div style={{ fontSize:'28px', marginBottom:'8px' }}>✅</div>
                  <p style={{ fontWeight:'600', fontSize:'13px', margin:0 }}>No OOS results today</p>
                </div>
              ) : oosFeed.map((item, i) => (
                <div key={item.id} style={{
                  padding:'10px 14px',
                  borderBottom: i<oosFeed.length-1 ? `1px solid ${PL}` : 'none',
                  background: i===0 ? '#FFF7F7' : '#fff',
                }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'6px' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:'700', fontSize:'12px', color:'#1F2937', marginBottom:'1px' }}>
                        {item.sampleName}
                      </div>
                      <div style={{ fontSize:'10px', color:PM, fontFamily:'monospace', marginBottom:'3px' }}>
                        {item.sampleNum}
                      </div>
                      <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                        <span style={{ fontSize:'10px', background:DEPT_CONFIG[item.deptCode]?.light||PL, color:DEPT_CONFIG[item.deptCode]?.color||P, padding:'1px 5px', borderRadius:'5px', fontWeight:'600' }}>
                          {item.deptName}
                        </span>
                        <span style={{ fontSize:'10px', background:'#FEF2F2', color:RD, padding:'1px 5px', borderRadius:'5px', fontWeight:'700', border:'1px solid #FECACA' }}>
                          {item.status==='fail_low'?'LOW':'HIGH'}
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontWeight:'900', fontSize:'16px', color:RD }}>
                        {item.value}{item.unit&&<span style={{ fontSize:'11px' }}>{item.unit}</span>}
                      </div>
                      <div style={{ fontSize:'10px', color:'#9CA3AF' }}>{item.testName}</div>
                    </div>
                  </div>
                  {item.analyst && (
                    <div style={{ fontSize:'10px', color:'#9CA3AF', marginTop:'3px' }}>
                      by {item.analyst} · {item.submittedAt ? format(new Date(item.submittedAt),'HH:mm') : ''}
                    </div>
                  )}
                  {/* Assign button */}
                  <button
                    onClick={() => setAssignModal({
                      sampleId    : null,
                      assignmentId: item.id,
                      sampleName  : item.sampleName,
                      testName    : item.testName,
                    })}
                    style={{ marginTop:'5px', fontSize:'10px', padding:'2px 8px', background:PL, color:P, border:'none', borderRadius:'6px', cursor:'pointer', fontFamily:'inherit', fontWeight:'600' }}>
                    👤 Re-assign
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── CHARTS ROW ── */}
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'14px', marginBottom:'14px' }}>

          {/* 7-day bar chart */}
          <div style={{ background:'#fff', borderRadius:'14px', border:`1.5px solid ${PL}`, padding:'16px' }}>
            <div style={{ fontWeight:'800', fontSize:'14px', color:'#1F2937', marginBottom:'14px' }}>
              📈 7-Day Sample Trend
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weekData} barSize={24}>
                <XAxis dataKey="day" tick={{ fontSize:11, fill:'#6B7280' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize:11, fill:'#6B7280' }} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{ borderRadius:'10px', border:`1px solid ${PL}`, fontSize:'12px' }}/>
                <Bar dataKey="pass" name="Pass" fill={GR} stackId="a" radius={[0,0,4,4]}/>
                <Bar dataKey="oos"  name="OOS"  fill={RD} stackId="a" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Today pie */}
          <div style={{ background:'#fff', borderRadius:'14px', border:`1.5px solid ${PL}`, padding:'16px', display:'flex', flexDirection:'column', alignItems:'center' }}>
            <div style={{ fontWeight:'800', fontSize:'14px', color:'#1F2937', marginBottom:'10px', alignSelf:'flex-start' }}>
              🥧 Today's Results
            </div>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" label={({ name,percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                    {pieData.map((entry,i) => <Cell key={i} fill={entry.color}/>)}
                  </Pie>
                  <Tooltip/>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#9CA3AF', fontSize:'13px' }}>
                No results yet today
              </div>
            )}
          </div>
        </div>

        {/* ── STALE SAMPLES + ANALYST ASSIGNMENT ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', marginBottom:'14px' }}>

          {/* Stale samples */}
          <div style={{ background:'#fff', borderRadius:'14px', border:`1.5px solid ${PL}`, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', background:'linear-gradient(135deg,#EA580C,#C2410C)', color:'#fff' }}>
              <div style={{ fontWeight:'800', fontSize:'14px' }}>⏰ Samples Awaiting Results</div>
              <div style={{ fontSize:'11px', color:'#FED7AA', marginTop:'2px' }}>
                Registered over 2 hours ago with no results
              </div>
            </div>
            <div style={{ maxHeight:'240px', overflowY:'auto' }}>
              {pendingSamples.length === 0 ? (
                <div style={{ padding:'24px', textAlign:'center', color:'#9CA3AF' }}>
                  <div style={{ fontSize:'24px', marginBottom:'6px' }}>✅</div>
                  <p style={{ fontWeight:'600', fontSize:'13px', margin:0 }}>All samples have results</p>
                </div>
              ) : pendingSamples.map((s,i) => (
                <div key={s.id} style={{ padding:'10px 14px', borderBottom:i<pendingSamples.length-1?`1px solid ${PL}`:'none' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ fontWeight:'700', fontSize:'13px', color:'#1F2937' }}>{s.sample_name}</div>
                      <div style={{ fontSize:'10px', color:PM, fontFamily:'monospace' }}>{s.sample_number}</div>
                      <div style={{ fontSize:'10px', color:'#9CA3AF', marginTop:'2px' }}>
                        {s.departments?.name} · {format(new Date(s.registered_at),'HH:mm')}
                      </div>
                    </div>
                    <button
                      onClick={() => setAssignModal({
                        sampleId    : s.id,
                        assignmentId: null,
                        sampleName  : s.sample_name,
                        testName    : 'All tests',
                      })}
                      style={{ padding:'6px 12px', background:`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'8px', fontSize:'11px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>
                      👤 Assign
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick report book access */}
          <div style={{ background:'#fff', borderRadius:'14px', border:`1.5px solid ${PL}`, padding:'16px' }}>
            <div style={{ fontWeight:'800', fontSize:'14px', color:'#1F2937', marginBottom:'12px' }}>
              📚 Report Books — Quick Access
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              {[
                { label:'Finished Product (Olein)',         book:'OLEIN',       icon:'🛢️' },
                { label:'Edible Vegetable Fats',            book:'FATS',        icon:'📦' },
                { label:'Daily Vitamin A Records',          book:'VITAMIN_A',   icon:'💊' },
                { label:'Soap Analysis (Chemicals)',        book:'SOAP',        icon:'🧼' },
                { label:'Lab Report (In-process)',          book:'REF_INP',     icon:'🏭' },
                { label:'Crystallizer Analysis',            book:'CRYS',        icon:'❄️' },
                { label:'Fractionation Analysis',           book:'FRAC',        icon:'🔬' },
              ].map(rb => (
                <button key={rb.book}
                  onClick={() => navigate(`/report-books?book=${rb.book}`)}
                  style={{
                    display:'flex', alignItems:'center', gap:'10px',
                    padding:'9px 12px', border:`1.5px solid ${PL}`,
                    borderRadius:'9px', background:'#F5F3FF',
                    cursor:'pointer', fontFamily:'inherit', textAlign:'left',
                    transition:'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background=PL; e.currentTarget.style.borderColor=PM; }}
                  onMouseLeave={e => { e.currentTarget.style.background='#F5F3FF'; e.currentTarget.style.borderColor=PL; }}
                >
                  <span style={{ fontSize:'16px' }}>{rb.icon}</span>
                  <span style={{ fontSize:'12px', fontWeight:'600', color:P, flex:1 }}>{rb.label}</span>
                  <span style={{ fontSize:'12px', color:'#9CA3AF' }}>→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <PageFooter />
    </div>
  );
}
