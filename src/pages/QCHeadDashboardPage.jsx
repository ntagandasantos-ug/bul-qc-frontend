// ============================================================
// FILE: frontend/bul-qc-app/src/pages/QCHeadDashboardPage.jsx
// UPDATED: date filter range, export Excel/PDF, assign sample
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar     from '../components/Navbar';
import PageFooter from '../components/PageFooter';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import * as XLSX from 'xlsx';

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
  BOILER:{ name:'Boiler',           icon:'🔥', color:'#B45309', light:'#FFFAEB', route:'/dashboard/boiler' },
};

export default function QCHeadDashboardPage() {
  const { user }    = useAuth();
  const navigate    = useNavigate();
  const today       = format(new Date(), 'yyyy-MM-dd');

  const [loading,        setLoading]       = useState(true);
  const [deptStats,      setDeptStats]     = useState({});
  const [oosFeed,        setOosFeed]       = useState([]);
  const [pendingSamples, setPending]       = useState([]);
  const [weekData,       setWeekData]      = useState([]);
  const [allSamples,     setAllSamples]    = useState([]);
  const [clock,          setClock]         = useState(new Date());
  const [fromDate,       setFromDate]      = useState(today);
  const [toDate,         setToDate]        = useState(today);
  const [useRange,       setUseRange]      = useState(false);
  const [toast,          setToast]         = useState(null);
  const [exporting,      setExporting]     = useState(false);

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
      const start = startOfDay(new Date(useRange ? fromDate : fromDate)).toISOString();
      const end   = endOfDay(new Date(useRange ? toDate : fromDate)).toISOString();

      const { data: samples } = await supabase
        .from('registered_samples')
        .select(`
          id, sample_number, sample_name, status,
          registered_at, sampler_name,
          departments ( name, code ),
          sample_types ( name, code ),
          sample_test_assignments (
            id, result_value, result_status,
            submitted_at, analyst_signature,
            tests ( name, unit )
          )
        `)
        .gte('registered_at', start)
        .lte('registered_at', end)
        .order('registered_at', { ascending: false });

      const all = samples || [];
      setAllSamples(all);

      // Dept stats
      const stats = {};
      for (const s of all) {
        const code = s.departments?.code || 'OTHER';
        if (!stats[code]) stats[code] = { total:0, pending:0, inProgress:0, complete:0, oos:0 };
        stats[code].total++;
        if (s.status==='pending')     stats[code].pending++;
        if (s.status==='in_progress') stats[code].inProgress++;
        if (s.status==='complete')    stats[code].complete++;
        const hasOOS = (s.sample_test_assignments||[]).some(a =>
          a.result_status==='fail_low'||a.result_status==='fail_high'
        );
        if (hasOOS) stats[code].oos++;
      }
      setDeptStats(stats);

      // OOS feed
      const oosItems = [];
      for (const s of all) {
        for (const a of (s.sample_test_assignments||[])) {
          if (a.result_status==='fail_low'||a.result_status==='fail_high') {
            oosItems.push({
              id: a.id, sampleName:s.sample_name, sampleNum:s.sample_number,
              deptCode:s.departments?.code, deptName:s.departments?.name,
              testName:a.tests?.name, unit:a.tests?.unit,
              value:a.result_value, status:a.result_status,
              analyst:a.analyst_signature, submittedAt:a.submitted_at,
            });
          }
        }
      }
      setOosFeed(oosItems.sort((a,b)=>new Date(b.submittedAt||0)-new Date(a.submittedAt||0)));

      // Stale samples — pending > 2 hours
      const twoHrsAgo = new Date(Date.now()-2*60*60*1000);
      setPending(all.filter(s => s.status==='pending' && new Date(s.registered_at) < twoHrsAgo));

      // 7-day trend
      const weekArr = [];
      for (let i=6; i>=0; i--) {
        const day = subDays(new Date(), i);
        const { data: daySamples } = await supabase
          .from('registered_samples')
          .select('id, sample_test_assignments(result_status)')
          .gte('registered_at', startOfDay(day).toISOString())
          .lte('registered_at', endOfDay(day).toISOString());
        const ds = daySamples||[];
        const oos = ds.filter(s=>(s.sample_test_assignments||[]).some(a=>a.result_status==='fail_low'||a.result_status==='fail_high')).length;
        weekArr.push({ day:format(day,'EEE'), total:ds.length, oos, pass:ds.length-oos });
      }
      setWeekData(weekArr);

    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [fromDate, toDate, useRange]);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    const sub = supabase.channel('qch_live')
      .on('postgres_changes',
        { event:'*', schema:'public', table:'sample_test_assignments' },
        () => load()
      ).subscribe();
    return () => sub.unsubscribe();
  }, [load]);

  // ── EXPORT TO EXCEL ───────────────────────────────────────
  const exportExcel = () => {
    setExporting(true);
    try {
      const rows = [];
      for (const s of allSamples) {
        const base = {
          'Sample Number' : s.sample_number,
          'Sample Name'   : s.sample_name,
          'Department'    : s.departments?.name,
          'Sample Type'   : s.sample_types?.name,
          'Status'        : s.status,
          'Registered At' : s.registered_at ? format(new Date(s.registered_at),'dd/MM/yyyy HH:mm') : '',
          'Sampler'       : s.sampler_name || '',
        };
        const tests = s.sample_test_assignments || [];
        if (tests.length === 0) {
          rows.push(base);
        } else {
          tests.forEach(a => {
            rows.push({
              ...base,
              'Test'       : a.tests?.name || '',
              'Result'     : a.result_value || 'Pending',
              'Unit'       : a.tests?.unit || '',
              'Status'     : a.result_status || '',
              'Analyst'    : a.analyst_signature || '',
              'Submitted'  : a.submitted_at ? format(new Date(a.submitted_at),'dd/MM/yyyy HH:mm') : '',
            });
          });
        }
      }
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'QC Results');
      const dateStr = useRange ? `${fromDate}_to_${toDate}` : fromDate;
      XLSX.writeFile(wb, `BUL_QC_Results_${dateStr}.xlsx`);
      showToast('✅ Excel exported successfully');
    } catch(e) {
      showToast('Export failed: ' + e.message, 'error');
    } finally { setExporting(false); }
  };

  // ── EXPORT TO PDF ─────────────────────────────────────────
  const exportPDF = async () => {
    setExporting(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });

      // Header
      doc.setFillColor(107, 33, 168);
      doc.rect(0, 0, 297, 22, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('BUL QC App — Daily QC Results Report', 14, 10);
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      const dateLabel = useRange ? `${fromDate} to ${toDate}` : fromDate;
      doc.text(`Date: ${dateLabel}  |  Generated: ${format(new Date(),'dd/MM/yyyy HH:mm')}  |  By: ${user?.full_name||''}`, 14, 17);

      // Stats row
      const totalToday = allSamples.length;
      const totalOOS   = oosFeed.length;
      const totalDone  = allSamples.filter(s=>s.status==='complete').length;
      const passRate   = totalToday>0 ? Math.round(((totalToday-totalOOS)/totalToday)*100) : 100;
      doc.setTextColor(107, 33, 168);
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text(`Total: ${totalToday}   Complete: ${totalDone}   OOS: ${totalOOS}   Pass Rate: ${passRate}%`, 14, 30);

      // Table
      const tableRows = [];
      for (const s of allSamples) {
        for (const a of (s.sample_test_assignments||[])) {
          tableRows.push([
            s.sample_number,
            s.sample_name,
            s.departments?.name||'',
            s.registered_at ? format(new Date(s.registered_at),'dd/MM/yy HH:mm') : '',
            a.tests?.name||'',
            a.result_value||'Pending',
            a.tests?.unit||'',
            a.result_status==='fail_low'?'LOW':a.result_status==='fail_high'?'HIGH':a.result_value?'OK':'—',
            a.analyst_signature||'',
          ]);
        }
      }

      autoTable(doc, {
        startY     : 34,
        head       : [['Sample No.','Sample Name','Dept','Time','Test','Result','Unit','Status','Analyst']],
        body       : tableRows,
        theme      : 'striped',
        headStyles : { fillColor:[107,33,168], textColor:255, fontSize:8, fontStyle:'bold' },
        bodyStyles : { fontSize:7.5 },
        alternateRowStyles: { fillColor:[245,243,255] },
        didDrawCell: (data) => {
          if (data.section==='body' && data.column.index===7) {
            const v = data.cell.raw;
            if (v==='LOW'||v==='HIGH') {
              doc.setTextColor(220,38,38);
              doc.setFont(undefined,'bold');
            } else if (v==='OK') {
              doc.setTextColor(22,163,74);
            }
          }
        },
      });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i=1; i<=pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text('BUL QC App — Designed by SantosInfographics', 14, doc.internal.pageSize.height-5);
        doc.text(`Page ${i} of ${pageCount}`, 280, doc.internal.pageSize.height-5, { align:'right' });
      }

      const dateStr = useRange ? `${fromDate}_to_${toDate}` : fromDate;
      doc.save(`BUL_QC_Report_${dateStr}.pdf`);
      showToast('✅ PDF exported successfully');
    } catch(e) {
      showToast('PDF export failed. Run: npm install jspdf jspdf-autotable', 'error');
      console.error(e);
    } finally { setExporting(false); }
  };

  // Totals
  const totalToday = allSamples.length;
  const totalOOS   = oosFeed.length;
  const totalDone  = allSamples.filter(s=>s.status==='complete').length;
  const passRate   = totalToday>0 ? Math.round(((totalToday-totalOOS)/totalToday)*100) : 100;

  const pieData = [
    { name:'Pass', value:totalToday-totalOOS, color:GR },
    { name:'OOS',  value:totalOOS,            color:RD },
  ].filter(d=>d.value>0);

  const inp = { border:`1.5px solid rgba(255,255,255,0.3)`, borderRadius:'7px', padding:'5px 9px', fontSize:'12px', fontFamily:'inherit', background:'rgba(255,255,255,0.15)', color:'#fff', cursor:'pointer', outline:'none' };

  return (
    <div style={{ minHeight:'100vh', background:'#F5F3FF', paddingBottom:'56px' }}>
      <Navbar />

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', top:'70px', right:'16px', zIndex:500, background:toast.type==='error'?'#FEF2F2':'#F0FDF4', border:`1.5px solid ${toast.type==='error'?'#FECACA':'#86EFAC'}`, borderRadius:'12px', padding:'12px 18px', color:toast.type==='error'?RD:GR, fontSize:'13px', fontWeight:'700', boxShadow:'0 4px 16px rgba(0,0,0,0.1)' }}>
          {toast.msg}
        </div>
      )}

      <div style={{ padding:'14px 16px' }}>

        {/* ── PAGE HEADER ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px', flexWrap:'wrap', gap:'8px' }}>
          <div>
            <h1 style={{ fontSize:'20px', fontWeight:'900', color:'#1F2937', margin:'0 0 2px' }}>QC Head Dashboard</h1>
            <p style={{ fontSize:'12px', color:'#9CA3AF', margin:0 }}>
              {format(clock,'EEEE, dd MMMM yyyy')} · {format(clock,'HH:mm:ss')}
            </p>
          </div>

          {/* Date filter + export */}
          <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>

            {/* Date range toggle */}
            <div style={{ display:'flex', gap:'3px', background:'#fff', borderRadius:'8px', padding:'3px', border:`1.5px solid ${PL}` }}>
              {['Single Day','Date Range'].map((l,i) => (
                <button key={l} onClick={() => setUseRange(i===1)}
                  style={{ padding:'5px 10px', borderRadius:'6px', border:'none', cursor:'pointer', fontSize:'11px', fontWeight:'600', fontFamily:'inherit', background:(i===1)===useRange?PM:'transparent', color:(i===1)===useRange?'#fff':'#6B7280' }}>
                  {l}
                </button>
              ))}
            </div>

            <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}
              style={{ border:`1.5px solid ${PL}`, borderRadius:'8px', padding:'6px 10px', fontSize:'12px', fontFamily:'inherit', color:'#374151', cursor:'pointer', outline:'none' }}/>

            {useRange && (
              <>
                <span style={{ color:'#9CA3AF', fontWeight:'700' }}>→</span>
                <input type="date" value={toDate} min={fromDate} onChange={e=>setToDate(e.target.value)}
                  style={{ border:`1.5px solid ${PL}`, borderRadius:'8px', padding:'6px 10px', fontSize:'12px', fontFamily:'inherit', color:'#374151', cursor:'pointer', outline:'none' }}/>
              </>
            )}

            {/* Quick filters */}
            {[{l:'Today',f:today,t:today},{l:'Yesterday',f:format(subDays(new Date(),1),'yyyy-MM-dd'),t:format(subDays(new Date(),1),'yyyy-MM-dd')},{l:'This Week',f:format(subDays(new Date(),6),'yyyy-MM-dd'),t:today}].map(q=>(
              <button key={q.l} onClick={()=>{setFromDate(q.f);setToDate(q.t);setUseRange(q.f!==q.t);}}
                style={{ padding:'6px 10px', border:`1.5px solid ${PL}`, borderRadius:'8px', background:'#fff', color:P, fontSize:'11px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                {q.l}
              </button>
            ))}

            {/* Export buttons */}
            <button onClick={exportExcel} disabled={exporting||allSamples.length===0}
              style={{ padding:'7px 14px', background:'linear-gradient(135deg,#16A34A,#15803D)', color:'#fff', border:'none', borderRadius:'9px', fontSize:'12px', fontWeight:'700', cursor:allSamples.length===0?'not-allowed':'pointer', fontFamily:'inherit', whiteSpace:'nowrap', opacity:exporting?0.7:1 }}>
              📊 Export Excel
            </button>

            <button onClick={exportPDF} disabled={exporting||allSamples.length===0}
              style={{ padding:'7px 14px', background:'linear-gradient(135deg,#DC2626,#B91C1C)', color:'#fff', border:'none', borderRadius:'9px', fontSize:'12px', fontWeight:'700', cursor:allSamples.length===0?'not-allowed':'pointer', fontFamily:'inherit', whiteSpace:'nowrap', opacity:exporting?0.7:1 }}>
              📄 Export PDF
            </button>

            <button onClick={() => navigate('/report-books')}
              style={{ padding:'7px 14px', background:`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'9px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
              📚 Report Books
            </button>
          </div>
        </div>

        {/* ── FACTORY PULSE ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:'10px', marginBottom:'14px' }}>
          {[
            { label:'Total Samples', val:totalToday,             icon:'📋', col:PM,         sub:'in selected period' },
            { label:'Completed',     val:totalDone,              icon:'✅', col:GR,         sub:'results submitted'  },
            { label:'Out of Spec',   val:totalOOS,               icon:'⚠️', col:RD,         sub:'need attention'     },
            { label:'Pass Rate',     val:passRate+'%',           icon:'📊', col:'#0369A1',  sub:'this period'        },
            { label:'Stale Samples', val:pendingSamples.length,  icon:'⏰', col:'#EA580C',  sub:'>2hrs no results'   },
          ].map(s => (
            <div key={s.label} style={{ background:'#fff', borderRadius:'14px', border:`2px solid ${s.col}18`, padding:'14px 16px', boxShadow:'0 1px 6px rgba(107,33,168,0.07)' }}>
              <div style={{ fontSize:'22px', marginBottom:'4px' }}>{s.icon}</div>
              <div style={{ fontSize:'26px', fontWeight:'900', color:s.col, lineHeight:1 }}>{s.val}</div>
              <div style={{ fontSize:'12px', fontWeight:'700', color:'#374151', marginTop:'4px' }}>{s.label}</div>
              <div style={{ fontSize:'10px', color:'#9CA3AF' }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* ── DEPT CARDS + OOS FEED ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 360px', gap:'12px', marginBottom:'12px' }}>

          {/* Department cards */}
          <div style={{ gridColumn:'1/3', display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'10px' }}>
            {Object.entries(DEPT_CONFIG).map(([code,cfg]) => {
              const s = deptStats[code]||{total:0,pending:0,inProgress:0,complete:0,oos:0};
              const pct = s.total>0?Math.round((s.complete/s.total)*100):0;
              return (
                <div key={code} onClick={()=>navigate(cfg.route)}
                  style={{ background:'#fff', borderRadius:'14px', border:`2px solid ${cfg.color}22`, padding:'16px', cursor:'pointer', boxShadow:'0 1px 6px rgba(107,33,168,0.07)', transition:'all 0.2s', position:'relative', overflow:'hidden' }}
                  onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 4px 16px rgba(107,33,168,0.15)';}}
                  onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='0 1px 6px rgba(107,33,168,0.07)';}}
                >
                  {s.oos>0&&<div style={{ position:'absolute',top:'12px',right:'12px',background:RD,color:'#fff',borderRadius:'20px',padding:'2px 8px',fontSize:'11px',fontWeight:'800' }}>⚠️ {s.oos} OOS</div>}
                  <div style={{ display:'flex',alignItems:'center',gap:'10px',marginBottom:'12px' }}>
                    <span style={{ fontSize:'28px' }}>{cfg.icon}</span>
                    <div>
                      <div style={{ fontWeight:'800',fontSize:'14px',color:'#1F2937' }}>{cfg.name}</div>
                      <div style={{ fontSize:'11px',color:'#9CA3AF' }}>Click to view live results</div>
                    </div>
                  </div>
                  <div style={{ display:'flex',gap:'8px',marginBottom:'10px' }}>
                    {[{l:'Total',v:s.total,c:'#374151'},{l:'Pending',v:s.pending,c:'#6B7280'},{l:'Running',v:s.inProgress,c:'#EA580C'},{l:'Done',v:s.complete,c:GR}].map(x=>(
                      <div key={x.l} style={{ flex:1,textAlign:'center' }}>
                        <div style={{ fontSize:'18px',fontWeight:'900',color:x.c }}>{x.v}</div>
                        <div style={{ fontSize:'9px',color:'#9CA3AF',fontWeight:'600' }}>{x.l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background:'#F3F4F6',borderRadius:'6px',height:'6px',overflow:'hidden' }}>
                    <div style={{ width:`${pct}%`,height:'100%',background:`linear-gradient(90deg,${cfg.color},${cfg.color}99)`,borderRadius:'6px',transition:'width 0.5s' }}/>
                  </div>
                  <div style={{ fontSize:'10px',color:'#9CA3AF',marginTop:'3px',textAlign:'right' }}>{pct}% complete</div>
                </div>
              );
            })}
          </div>

          {/* OOS feed */}
          <div style={{ background:'#fff',borderRadius:'14px',border:`1.5px solid ${PL}`,overflow:'hidden',display:'flex',flexDirection:'column' }}>
            <div style={{ padding:'12px 16px',background:`linear-gradient(135deg,${RD},#B91C1C)`,color:'#fff' }}>
              <div style={{ fontWeight:'800',fontSize:'14px' }}>⚠️ OOS Alert Feed</div>
              <div style={{ fontSize:'11px',color:'#FCA5A5',marginTop:'2px' }}>{oosFeed.length} out of spec result(s)</div>
            </div>
            <div style={{ flex:1,overflowY:'auto',maxHeight:'300px' }}>
              {oosFeed.length===0?(
                <div style={{ padding:'32px',textAlign:'center',color:'#9CA3AF' }}>
                  <div style={{ fontSize:'28px',marginBottom:'8px' }}>✅</div>
                  <p style={{ fontWeight:'600',fontSize:'13px',margin:0 }}>No OOS results for this period</p>
                </div>
              ):oosFeed.map((item,i)=>(
                <div key={item.id} style={{ padding:'10px 14px',borderBottom:i<oosFeed.length-1?`1px solid ${PL}`:'none',background:i===0?'#FFF7F7':'#fff' }}>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'6px' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:'700',fontSize:'12px',color:'#1F2937',marginBottom:'1px' }}>{item.sampleName}</div>
                      <div style={{ fontSize:'10px',color:PM,fontFamily:'monospace',marginBottom:'3px' }}>{item.sampleNum}</div>
                      <div style={{ display:'flex',gap:'4px',flexWrap:'wrap' }}>
                        <span style={{ fontSize:'10px',background:DEPT_CONFIG[item.deptCode]?.light||PL,color:DEPT_CONFIG[item.deptCode]?.color||P,padding:'1px 5px',borderRadius:'5px',fontWeight:'600' }}>{item.deptName}</span>
                        <span style={{ fontSize:'10px',background:'#FEF2F2',color:RD,padding:'1px 5px',borderRadius:'5px',fontWeight:'700',border:'1px solid #FECACA' }}>{item.status==='fail_low'?'LOW':'HIGH'}</span>
                      </div>
                    </div>
                    <div style={{ textAlign:'right',flexShrink:0 }}>
                      <div style={{ fontWeight:'900',fontSize:'16px',color:RD }}>{item.value}{item.unit&&<span style={{ fontSize:'11px' }}>{item.unit}</span>}</div>
                      <div style={{ fontSize:'10px',color:'#9CA3AF' }}>{item.testName}</div>
                    </div>
                  </div>
                  {item.analyst&&<div style={{ fontSize:'10px',color:'#9CA3AF',marginTop:'3px' }}>by {item.analyst} · {item.submittedAt?format(new Date(item.submittedAt),'HH:mm'):''}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── CHARTS ── */}
        <div style={{ display:'grid',gridTemplateColumns:'2fr 1fr',gap:'12px',marginBottom:'12px' }}>
          <div style={{ background:'#fff',borderRadius:'14px',border:`1.5px solid ${PL}`,padding:'16px' }}>
            <div style={{ fontWeight:'800',fontSize:'14px',color:'#1F2937',marginBottom:'14px' }}>📈 7-Day Sample Trend</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weekData} barSize={24}>
                <XAxis dataKey="day" tick={{ fontSize:11,fill:'#6B7280' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize:11,fill:'#6B7280' }} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{ borderRadius:'10px',border:`1px solid ${PL}`,fontSize:'12px' }}/>
                <Bar dataKey="pass" name="Pass" fill={GR} stackId="a" radius={[0,0,4,4]}/>
                <Bar dataKey="oos"  name="OOS"  fill={RD} stackId="a" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background:'#fff',borderRadius:'14px',border:`1.5px solid ${PL}`,padding:'16px',display:'flex',flexDirection:'column',alignItems:'center' }}>
            <div style={{ fontWeight:'800',fontSize:'14px',color:'#1F2937',marginBottom:'10px',alignSelf:'flex-start' }}>🥧 Period Results</div>
            {pieData.length>0?(
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value"
                    label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                    {pieData.map((entry,i)=><Cell key={i} fill={entry.color}/>)}
                  </Pie>
                  <Tooltip/>
                </PieChart>
              </ResponsiveContainer>
            ):(
              <div style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'#9CA3AF',fontSize:'13px' }}>No results yet</div>
            )}
          </div>
        </div>

        {/* ── STALE SAMPLES + REPORT BOOKS ── */}
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px' }}>

          <div style={{ background:'#fff',borderRadius:'14px',border:`1.5px solid ${PL}`,overflow:'hidden' }}>
            <div style={{ padding:'12px 16px',background:'linear-gradient(135deg,#EA580C,#C2410C)',color:'#fff' }}>
              <div style={{ fontWeight:'800',fontSize:'14px' }}>⏰ Samples Awaiting Results</div>
              <div style={{ fontSize:'11px',color:'#FED7AA',marginTop:'2px' }}>Registered over 2 hours ago with no results submitted</div>
            </div>
            <div style={{ maxHeight:'240px',overflowY:'auto' }}>
              {pendingSamples.length===0?(
                <div style={{ padding:'24px',textAlign:'center',color:'#9CA3AF' }}>
                  <div style={{ fontSize:'24px',marginBottom:'6px' }}>✅</div>
                  <p style={{ fontWeight:'600',fontSize:'13px',margin:0 }}>All samples have results submitted</p>
                </div>
              ):pendingSamples.map((s,i)=>(
                <div key={s.id} style={{ padding:'10px 14px',borderBottom:i<pendingSamples.length-1?`1px solid ${PL}`:'none',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                  <div>
                    <div style={{ fontWeight:'700',fontSize:'13px',color:'#1F2937' }}>{s.sample_name}</div>
                    <div style={{ fontSize:'10px',color:PM,fontFamily:'monospace' }}>{s.sample_number}</div>
                    <div style={{ fontSize:'10px',color:'#9CA3AF',marginTop:'2px' }}>{s.departments?.name} · {format(new Date(s.registered_at),'HH:mm')}</div>
                  </div>
                  <span style={{ fontSize:'10px',background:'#FFF7ED',color:'#EA580C',padding:'3px 8px',borderRadius:'8px',border:'1px solid #FED7AA',fontWeight:'700',whiteSpace:'nowrap' }}>
                    Pending
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background:'#fff',borderRadius:'14px',border:`1.5px solid ${PL}`,padding:'16px' }}>
            <div style={{ fontWeight:'800',fontSize:'14px',color:'#1F2937',marginBottom:'12px' }}>📚 Report Books — Quick Access</div>
            <div style={{ display:'flex',flexDirection:'column',gap:'6px' }}>
              {[
                { label:'Finished Product (Olein)',      book:'OLEIN',     icon:'🛢️' },
                { label:'Edible Vegetable Fats',         book:'FATS',      icon:'📦' },
                { label:'Daily Vitamin A Records',       book:'VITAMIN_A', icon:'💊' },
                { label:'Soap Analysis (Chemicals)',     book:'SOAP',      icon:'🧼' },
                { label:'Lab Report (In-process)',       book:'REF_INP',   icon:'🏭' },
                { label:'Crystallizer Analysis',         book:'CRYS',      icon:'❄️' },
                { label:'Fractionation Analysis',        book:'FRAC',      icon:'🔬' },
              ].map(rb=>(
                <button key={rb.book} onClick={()=>navigate(`/report-books?book=${rb.book}`)}
                  style={{ display:'flex',alignItems:'center',gap:'10px',padding:'8px 12px',border:`1.5px solid ${PL}`,borderRadius:'9px',background:'#F5F3FF',cursor:'pointer',fontFamily:'inherit',textAlign:'left',transition:'all 0.15s' }}
                  onMouseEnter={e=>{e.currentTarget.style.background=PL;e.currentTarget.style.borderColor=PM;}}
                  onMouseLeave={e=>{e.currentTarget.style.background='#F5F3FF';e.currentTarget.style.borderColor=PL;}}
                >
                  <span style={{ fontSize:'16px' }}>{rb.icon}</span>
                  <span style={{ fontSize:'12px',fontWeight:'600',color:P,flex:1 }}>{rb.label}</span>
                  <span style={{ fontSize:'12px',color:'#9CA3AF' }}>→</span>
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
