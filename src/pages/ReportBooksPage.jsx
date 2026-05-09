// ============================================================
// FILE: frontend/bul-qc-app/src/pages/ReportBooksPage.jsx
// 7 professional report books with sign-off, comments, trends
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar     from '../components/Navbar';
import PageFooter from '../components/PageFooter';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid,
} from 'recharts';

const P  = '#6B21A8';
const PM = '#7C3AED';
const PL = '#EDE9FE';
const G  = '#FFB81C';
const GR = '#16A34A';
const RD = '#DC2626';

// ── Report Book Definitions ───────────────────────────────
const BOOKS = [
  {
    key   : 'OLEIN',
    title : 'Finished Product — Olein',
    icon  : '🛢️',
    color : '#0369A1',
    light : '#E0F2FE',
    desc  : 'Filling & Packing · Tanks 411, 412, 413, 414',
    filter: (r) => ['OIL_T411','OIL_T412','OIL_T413','OIL_T414'].includes(r.sample_types?.code),
  },
  {
    key   : 'FATS',
    title : 'Edible Vegetable Cooking Fats',
    icon  : '📦',
    color : '#7C2D12',
    light : '#FFF7ED',
    desc  : 'Filling & Packing · Chipo, Cowboy, Kimbo, Chipsy',
    filter: (r) => ['FAT_CHIPO','FAT_COWBOY','FAT_KIMBO','FAT_CHIPSY'].includes(r.sample_types?.code),
  },
  {
    key   : 'VITAMIN_A',
    title : 'Daily Vitamin A Analysis Records',
    icon  : '💊',
    color : '#0891B2',
    light : '#ECFEFF',
    desc  : 'All departments · All samples tested for Vitamin A',
    filter: (r) => true, // filtered by test name in processing
    testFilter: 'Vitamin A',
  },
  {
    key   : 'SOAP',
    title : 'Soap Analysis (Chemicals)',
    icon  : '🧼',
    color : '#059669',
    light : '#ECFDF5',
    desc  : 'Soap Department · All laundry bar soap brands',
    filter: (r) => r.sample_types?.code?.startsWith('LBS_'),
  },
  {
    key   : 'REF_INP',
    title : 'Lab Report Details — In-process Analysis',
    icon  : '🏭',
    color : '#7C3AED',
    light : '#EDE9FE',
    desc  : 'Refinery · CPO Line, CPL Line, BPO, RBD, RPL, PFAD',
    filter: (r) => ['CPO_LINE','CPL_LINE','BPO','RBD','RPL','PFAD'].includes(r.sample_types?.code),
  },
  {
    key   : 'CRYS',
    title : 'Crystallizer Analysis Records',
    icon  : '❄️',
    color : '#0284C7',
    light : '#E0F2FE',
    desc  : 'Refinery · Crystallizers 1–9',
    filter: (r) => r.sample_types?.code?.startsWith('CRYS_'),
  },
  {
    key   : 'FRAC',
    title : 'Fractionation Analysis',
    icon  : '🔬',
    color : '#9333EA',
    light : '#F3E8FF',
    desc  : 'Refinery · OLEIN, STEARIN, PMF',
    filter: (r) => ['OLEIN','STEARIN','PMF'].includes(r.sample_types?.code),
  },
];

export default function ReportBooksPage() {
  const { user }        = useAuth();
  const navigate        = useNavigate();
  const [searchParams]  = useSearchParams();

  const [activeBook, setActiveBook] = useState(
    BOOKS.find(b => b.key === searchParams.get('book')) || BOOKS[0]
  );
  const [date,       setDate]       = useState(format(subDays(new Date(),1), 'yyyy-MM-dd'));
  const [samples,    setSamples]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [signoff,    setSignoff]    = useState(null);
  const [comment,    setComment]    = useState('');
  const [signature,  setSignature]  = useState(user?.full_name || '');
  const [signing,    setSigning]    = useState(false);
  const [toast,      setToast]      = useState(null);
  const [trendData,  setTrendData]  = useState([]);
  const [selTest,    setSelTest]    = useState('');

  const showToast = (msg, type='success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const start = startOfDay(new Date(date));
      const end   = endOfDay(new Date(date));

      const { data, error } = await supabase
        .from('registered_samples')
        .select(`
          id, sample_number, sample_name, status,
          registered_at, sampler_name,
          departments ( name, code ),
          sample_types ( name, code ),
          brands ( name ),
          sample_subtypes ( name ),
          sample_test_assignments (
            id, result_value, result_status, remarks,
            submitted_at, analyst_signature, edit_count, is_locked,
            tests (
              id, name, unit, result_type, display_order,
              test_specifications ( min_value, max_value, display_spec )
            )
          )
        `)
        .gte('registered_at', start.toISOString())
        .lte('registered_at', end.toISOString())
        .order('registered_at', { ascending: true });

      if (error) throw error;

      let filtered = (data || []).filter(activeBook.filter);

      // For Vitamin A book — only keep assignments that include Vitamin A test
      if (activeBook.testFilter) {
        filtered = filtered.filter(s =>
          (s.sample_test_assignments||[]).some(a =>
            a.tests?.name === activeBook.testFilter && a.result_value
          )
        );
      }

      setSamples(filtered);

      // Check if already signed off
      const { data: existing } = await supabase
        .from('report_signoffs')
        .select('*')
        .eq('report_book', activeBook.key)
        .eq('report_date', date)
        .single();
      setSignoff(existing || null);

      // Auto-select first test for trend
      if (filtered.length > 0 && !selTest) {
        const firstTest = filtered[0]?.sample_test_assignments?.[0]?.tests?.name;
        if (firstTest) setSelTest(firstTest);
      }

    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [activeBook, date, selTest]);

  useEffect(() => { load(); }, [load]);

  // Build trend data for selected test (last 14 days)
  useEffect(() => {
    if (!selTest || samples.length === 0) return;
    const points = [];
    for (const s of samples) {
      for (const a of (s.sample_test_assignments||[])) {
        if (a.tests?.name === selTest && a.result_value) {
          const num = parseFloat(a.result_value);
          if (!isNaN(num)) {
            const spec = a.tests?.test_specifications?.[0];
            points.push({
              name   : s.sample_name?.substring(0,12),
              value  : num,
              min    : spec?.min_value || null,
              max    : spec?.max_value || null,
              time   : a.submitted_at ? format(new Date(a.submitted_at),'HH:mm') : '',
            });
          }
        }
      }
    }
    setTrendData(points);
  }, [selTest, samples]);

  // Sign off
  const handleSignoff = async (status) => {
    if (!signature.trim()) { showToast('Enter your name as signature', 'error'); return; }
    setSigning(true);
    try {
      await supabase.from('report_signoffs').upsert({
        report_book  : activeBook.key,
        report_date  : date,
        signed_by    : user?.id,
        status,
        comments     : comment.trim() || null,
        signature_text: signature.trim(),
        signed_at    : new Date().toISOString(),
      }, { onConflict: 'report_book,report_date' });

      showToast(status==='approved' ? '✅ Report approved and signed' : '⚠️ Report flagged');
      load();
    } catch(e) {
      showToast('Sign-off failed: ' + e.message, 'error');
    } finally { setSigning(false); }
  };

  // Collect all unique test names in this book
  const allTestNames = [...new Set(
    samples.flatMap(s =>
      (s.sample_test_assignments||[])
        .filter(a => a.result_value)
        .map(a => a.tests?.name)
        .filter(Boolean)
    )
  )];

  // Stats for this report
  const totalSamples = samples.length;
  const totalResults = samples.reduce((n,s) => n + (s.sample_test_assignments||[]).filter(a=>a.result_value).length, 0);
  const totalOOS     = samples.reduce((n,s) => n + (s.sample_test_assignments||[]).filter(a=>a.result_status==='fail_low'||a.result_status==='fail_high').length, 0);
  const passRate     = totalResults > 0 ? Math.round(((totalResults-totalOOS)/totalResults)*100) : 100;

  const getCS = (status) => ({
    pass     :{ c:GR,     bg:'#F0FDF4', border:'#86EFAC' },
    ok       :{ c:GR,     bg:'#F0FDF4', border:'#86EFAC' },
    fail_low :{ c:RD,     bg:'#FEF2F2', border:'#FECACA' },
    fail_high:{ c:RD,     bg:'#FEF2F2', border:'#FECACA' },
    text_ok  :{ c:'#1D4ED8', bg:'#EFF6FF', border:'#BFDBFE' },
  })[status] || { c:'#374151', bg:'#F9FAFB', border:'#E5E7EB' };

  return (
    <div style={{ minHeight:'100vh', background:'#F5F3FF', paddingBottom:'56px' }}>
      <Navbar />

      {toast && (
        <div style={{ position:'fixed', top:'70px', right:'16px', zIndex:500, background:toast.type==='error'?'#FEF2F2':'#F0FDF4', border:`1.5px solid ${toast.type==='error'?'#FECACA':'#86EFAC'}`, borderRadius:'12px', padding:'12px 18px', color:toast.type==='error'?RD:GR, fontSize:'13px', fontWeight:'700', boxShadow:'0 4px 16px rgba(0,0,0,0.1)' }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'260px 1fr', minHeight:'calc(100vh - 110px)' }}>

        {/* ── LEFT SIDEBAR — Book list ── */}
        <div style={{ background:'#fff', borderRight:`1.5px solid ${PL}`, padding:'16px 12px', overflowY:'auto' }}>
          <div style={{ fontSize:'12px', fontWeight:'800', color:'#9CA3AF', letterSpacing:'1px', marginBottom:'10px', paddingLeft:'6px' }}>
            REPORT BOOKS
          </div>
          {BOOKS.map(book => (
            <button key={book.key}
              onClick={() => { setActiveBook(book); setSelTest(''); setSamples([]); setSignoff(null); }}
              style={{
                display:'flex', alignItems:'flex-start', gap:'10px',
                width:'100%', padding:'10px 10px',
                border:'none', borderRadius:'10px', cursor:'pointer',
                fontFamily:'inherit', textAlign:'left', marginBottom:'4px',
                background: activeBook.key===book.key
                  ? `linear-gradient(135deg,${P},${PM})`
                  : 'transparent',
                color: activeBook.key===book.key ? '#fff' : '#374151',
                transition:'all 0.15s',
              }}
              onMouseEnter={e => { if(activeBook.key!==book.key) e.currentTarget.style.background='#F5F3FF'; }}
              onMouseLeave={e => { if(activeBook.key!==book.key) e.currentTarget.style.background='transparent'; }}
            >
              <span style={{ fontSize:'18px', flexShrink:0 }}>{book.icon}</span>
              <div>
                <div style={{ fontSize:'12px', fontWeight:'700', lineHeight:1.3 }}>{book.title}</div>
                <div style={{ fontSize:'10px', opacity:0.7, marginTop:'2px', lineHeight:1.3 }}>{book.desc}</div>
              </div>
            </button>
          ))}

          <div style={{ marginTop:'16px', padding:'12px', background:'#F5F3FF', borderRadius:'10px', border:`1px solid ${PL}` }}>
            <div style={{ fontSize:'11px', fontWeight:'700', color:P, marginBottom:'8px' }}>
              Navigate to Dashboard
            </div>
            <button onClick={() => navigate('/dashboard')}
              style={{ width:'100%', padding:'7px', background:'#fff', border:`1px solid ${PL}`, borderRadius:'8px', color:P, fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit', marginBottom:'5px' }}>
              ← QC Dashboard
            </button>
          </div>
        </div>

        {/* ── RIGHT MAIN AREA ── */}
        <div style={{ padding:'20px 20px', overflowY:'auto' }}>

          {/* Book header */}
          <div style={{
            background:`linear-gradient(135deg,${activeBook.color},${activeBook.color}CC)`,
            borderRadius:'16px', padding:'20px 24px', marginBottom:'16px', color:'#fff',
          }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'12px' }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'6px' }}>
                  <span style={{ fontSize:'28px' }}>{activeBook.icon}</span>
                  <h2 style={{ fontSize:'20px', fontWeight:'900', margin:0 }}>{activeBook.title}</h2>
                </div>
                <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.8)', margin:'0 0 8px' }}>{activeBook.desc}</p>

                {/* Sign-off status */}
                {signoff ? (
                  <div style={{ display:'inline-flex', alignItems:'center', gap:'6px', background: signoff.status==='approved'?'rgba(22,163,74,0.3)':'rgba(220,38,38,0.3)', padding:'5px 12px', borderRadius:'20px', border:'1px solid rgba(255,255,255,0.4)' }}>
                    <span>{signoff.status==='approved'?'✅':'⚠️'}</span>
                    <span style={{ fontSize:'12px', fontWeight:'700' }}>
                      {signoff.status==='approved'?'Approved':'Flagged'} by {signoff.signature_text} at {format(new Date(signoff.signed_at),'HH:mm, dd MMM yyyy')}
                    </span>
                  </div>
                ) : (
                  <div style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'rgba(255,184,28,0.3)', padding:'5px 12px', borderRadius:'20px', border:'1px solid rgba(255,255,255,0.4)' }}>
                    <span>⏳</span>
                    <span style={{ fontSize:'12px', fontWeight:'700' }}>Awaiting sign-off</span>
                  </div>
                )}
              </div>

              {/* Date picker */}
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'rgba(255,255,255,0.8)', fontWeight:'600', marginBottom:'4px' }}>Report Date</label>
                <input type="date" value={date}
                  onChange={e => { setDate(e.target.value); setSignoff(null); }}
                  style={{ padding:'8px 12px', borderRadius:'8px', border:'1.5px solid rgba(255,255,255,0.4)', background:'rgba(255,255,255,0.2)', color:'#fff', fontSize:'13px', fontFamily:'inherit', cursor:'pointer', outline:'none' }}/>
              </div>
            </div>
          </div>

          {/* Stats bar */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'16px' }}>
            {[
              { label:'Samples',      val:totalSamples,     icon:'🧪', col:PM },
              { label:'Results',      val:totalResults,     icon:'📊', col:'#0369A1' },
              { label:'Out of Spec',  val:totalOOS,         icon:'⚠️', col:RD },
              { label:'Pass Rate',    val:passRate+'%',     icon:'✅', col:GR },
            ].map(s => (
              <div key={s.label} style={{ background:'#fff', borderRadius:'12px', border:`1.5px solid ${PL}`, padding:'12px 14px', textAlign:'center' }}>
                <div style={{ fontSize:'18px' }}>{s.icon}</div>
                <div style={{ fontSize:'22px', fontWeight:'900', color:s.col }}>{s.val}</div>
                <div style={{ fontSize:'11px', color:'#6B7280', fontWeight:'600', marginTop:'2px' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign:'center', padding:'60px', color:PM, fontWeight:'600' }}>
              Loading report...
            </div>
          ) : samples.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px', background:'#fff', borderRadius:'14px', border:`1.5px solid ${PL}` }}>
              <div style={{ fontSize:'48px', marginBottom:'12px' }}>{activeBook.icon}</div>
              <p style={{ fontWeight:'700', color:'#374151', fontSize:'15px' }}>No samples for {format(new Date(date),'dd MMMM yyyy')}</p>
              <p style={{ fontSize:'12px', color:'#9CA3AF' }}>Try selecting a different date</p>
            </div>
          ) : (
            <>
              {/* ── PROFESSIONAL RESULTS TABLE ── */}
              <div style={{ background:'#fff', borderRadius:'14px', border:`1.5px solid ${PL}`, overflow:'hidden', marginBottom:'16px', boxShadow:'0 2px 8px rgba(107,33,168,0.06)' }}>

                {/* Table header */}
                <div style={{ padding:'12px 16px', background:'#F5F3FF', borderBottom:`1px solid ${PL}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <span style={{ fontWeight:'800', fontSize:'14px', color:P }}>
                      {activeBook.title} — {format(new Date(date),'dd MMMM yyyy')}
                    </span>
                    <span style={{ marginLeft:'10px', fontSize:'12px', color:'#9CA3AF' }}>
                      {totalSamples} sample(s)
                    </span>
                  </div>
                  <div style={{ fontSize:'11px', color:'#9CA3AF' }}>Scroll horizontally for all parameters →</div>
                </div>

                <div style={{ overflowX:'auto', overflowY:'auto', maxHeight:'500px' }}>
                  <table style={{ borderCollapse:'separate', borderSpacing:0, fontSize:'12px', width:'100%' }}>
                    <thead>
                      <tr>
                        {/* Fixed cols */}
                        <th style={{ position:'sticky', top:0, left:0, zIndex:80, background:`linear-gradient(180deg,${P},#5B1894)`, color:'#fff', padding:'10px 12px', textAlign:'left', fontSize:'11px', fontWeight:'800', whiteSpace:'nowrap', minWidth:'140px', borderRight:'2px solid rgba(255,255,255,0.3)', borderBottom:'2px solid rgba(255,255,255,0.2)' }}>Sample Name</th>
                        <th style={{ position:'sticky', top:0, zIndex:70, background:`linear-gradient(180deg,${P},#5B1894)`, color:'#fff', padding:'10px 10px', textAlign:'left', fontSize:'11px', fontWeight:'800', whiteSpace:'nowrap', minWidth:'110px', borderBottom:'2px solid rgba(255,255,255,0.2)', borderLeft:'1px solid rgba(255,255,255,0.15)' }}>Sample No.</th>
                        <th style={{ position:'sticky', top:0, zIndex:70, background:`linear-gradient(180deg,${P},#5B1894)`, color:'#fff', padding:'10px 10px', textAlign:'left', fontSize:'11px', fontWeight:'800', whiteSpace:'nowrap', minWidth:'80px', borderBottom:'2px solid rgba(255,255,255,0.2)', borderLeft:'1px solid rgba(255,255,255,0.15)' }}>Time</th>
                        <th style={{ position:'sticky', top:0, zIndex:70, background:`linear-gradient(180deg,${P},#5B1894)`, color:'#fff', padding:'10px 10px', textAlign:'left', fontSize:'11px', fontWeight:'800', whiteSpace:'nowrap', minWidth:'100px', borderBottom:'2px solid rgba(255,255,255,0.2)', borderLeft:'1px solid rgba(255,255,255,0.15)' }}>Sampler</th>
                        <th style={{ position:'sticky', top:0, zIndex:70, background:`linear-gradient(180deg,${P},#5B1894)`, color:'#fff', padding:'10px 10px', textAlign:'left', fontSize:'11px', fontWeight:'800', whiteSpace:'nowrap', minWidth:'80px', borderBottom:'2px solid rgba(255,255,255,0.2)', borderLeft:'1px solid rgba(255,255,255,0.15)' }}>Status</th>

                        {/* Dynamic test columns */}
                        {allTestNames.map(tn => {
                          // Find spec for this test
                          let spec = null;
                          for (const s of samples) {
                            for (const a of (s.sample_test_assignments||[])) {
                              if (a.tests?.name===tn && a.tests?.test_specifications?.[0]) {
                                spec = a.tests.test_specifications[0];
                                break;
                              }
                            }
                            if (spec) break;
                          }
                          const specStr = spec?.display_spec || (spec?.min_value!==undefined ? `${spec.min_value}–${spec.max_value}` : null);
                          const unit = samples.flatMap(s=>s.sample_test_assignments||[]).find(a=>a.tests?.name===tn)?.tests?.unit;
                          return (
                            <th key={tn} style={{ position:'sticky', top:0, zIndex:70, background:`linear-gradient(180deg,${P},#5B1894)`, color:G, padding:'8px 10px', textAlign:'center', fontSize:'11px', fontWeight:'800', whiteSpace:'nowrap', minWidth:'130px', borderLeft:'2px solid rgba(255,255,255,0.2)', borderBottom:'2px solid rgba(255,255,255,0.2)' }}>
                              <div>{tn}</div>
                              {specStr && <div style={{ fontSize:'10px', color:G, fontWeight:'600', marginTop:'2px' }}>({specStr}) {unit}</div>}
                            </th>
                          );
                        })}
                        <th style={{ position:'sticky', top:0, zIndex:70, background:`linear-gradient(180deg,${P},#5B1894)`, color:'#fff', padding:'10px 10px', textAlign:'left', fontSize:'11px', fontWeight:'800', whiteSpace:'nowrap', minWidth:'100px', borderLeft:'2px solid rgba(255,255,255,0.2)', borderBottom:'2px solid rgba(255,255,255,0.2)' }}>Analyst</th>
                      </tr>
                    </thead>
                    <tbody>
                      {samples.map((s, rowIdx) => {
                        const isEven   = rowIdx%2===0;
                        const rowBg    = isEven?'#FAFAFA':'#fff';
                        const hasOOS   = (s.sample_test_assignments||[]).some(a=>a.result_status==='fail_low'||a.result_status==='fail_high');
                        const analystNames = [...new Set((s.sample_test_assignments||[]).filter(a=>a.analyst_signature).map(a=>a.analyst_signature))];
                        const byTest   = {};
                        for (const a of (s.sample_test_assignments||[])) {
                          if (a.tests?.name) byTest[a.tests.name] = a;
                        }

                        return (
                          <tr key={s.id} style={{ outline:hasOOS?'2px solid #FECACA':'none', outlineOffset:'-1px' }}>
                            <td style={{ position:'sticky', left:0, zIndex:20, background:isEven?'#F5F3FF':'#fff', padding:'10px 12px', fontWeight:'700', fontSize:'12px', color:'#1F2937', borderRight:'2px solid #DDD6FE', borderBottom:'1px solid #EDE9FE', whiteSpace:'nowrap', boxShadow:'4px 0 6px rgba(107,33,168,0.06)' }}>
                              {s.sample_name}
                              {s.brands?.name && <div style={{ fontSize:'10px', color:PM, fontWeight:'600' }}>{s.brands.name}</div>}
                              {s.sample_subtypes?.name && <div style={{ fontSize:'10px', color:'#6B7280' }}>{s.sample_subtypes.name}</div>}
                            </td>
                            <td style={{ padding:'10px', background:rowBg, borderLeft:'1px solid #EDE9FE', borderBottom:'1px solid #EDE9FE', fontFamily:'monospace', fontSize:'11px', color:PM, fontWeight:'700', whiteSpace:'nowrap' }}>{s.sample_number}</td>
                            <td style={{ padding:'10px', background:rowBg, borderLeft:'1px solid #EDE9FE', borderBottom:'1px solid #EDE9FE', fontSize:'11px', color:'#374151', whiteSpace:'nowrap' }}>
                              {format(new Date(s.registered_at),'HH:mm')}
                            </td>
                            <td style={{ padding:'10px', background:rowBg, borderLeft:'1px solid #EDE9FE', borderBottom:'1px solid #EDE9FE', fontSize:'11px', color:'#374151', whiteSpace:'nowrap' }}>
                              {s.sampler_name || '—'}
                            </td>
                            <td style={{ padding:'10px', background:rowBg, borderLeft:'1px solid #EDE9FE', borderBottom:'1px solid #EDE9FE' }}>
                              <span style={{
                                padding:'2px 8px', borderRadius:'10px', fontSize:'10px', fontWeight:'700',
                                background: s.status==='complete'?'#F0FDF4':s.status==='in_progress'?'#FFF7ED':'#F3F4F6',
                                color: s.status==='complete'?GR:s.status==='in_progress'?'#EA580C':'#6B7280',
                              }}>
                                {s.status?.replace('_',' ')}
                              </span>
                            </td>

                            {allTestNames.map(tn => {
                              const a = byTest[tn];
                              if (!a || !a.result_value) return (
                                <td key={tn} style={{ padding:'10px', textAlign:'center', background:rowBg, borderLeft:'2px solid #EDE9FE', borderBottom:'1px solid #EDE9FE', color:'#D1D5DB', fontSize:'14px' }}>—</td>
                              );
                              const cs = getCS(a.result_status);
                              const unit = a.tests?.unit;
                              return (
                                <td key={tn} style={{ padding:'8px 10px', textAlign:'center', background:rowBg, borderLeft:'2px solid #EDE9FE', borderBottom:'1px solid #EDE9FE' }}>
                                  <div style={{ display:'inline-block', background:cs.bg, color:cs.c, border:`1.5px solid ${cs.border}`, borderRadius:'7px', padding:'4px 10px', fontWeight:'900', fontSize:'14px', whiteSpace:'nowrap' }}>
                                    {a.result_value}{unit&&<span style={{ fontSize:'10px', marginLeft:'2px', opacity:0.8 }}>{unit}</span>}
                                  </div>
                                  <div style={{ fontSize:'9px', color:cs.c, fontWeight:'700', marginTop:'2px' }}>
                                    {a.result_status==='fail_low'?'↓ LOW':a.result_status==='fail_high'?'↑ HIGH':''}
                                  </div>
                                </td>
                              );
                            })}

                            <td style={{ padding:'10px', background:rowBg, borderLeft:'2px solid #EDE9FE', borderBottom:'1px solid #EDE9FE', fontSize:'11px', color:'#374151', whiteSpace:'nowrap' }}>
                              {analystNames.join(', ') || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── TREND CHART ── */}
              {trendData.length > 1 && (
                <div style={{ background:'#fff', borderRadius:'14px', border:`1.5px solid ${PL}`, padding:'16px', marginBottom:'16px' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px', flexWrap:'wrap', gap:'8px' }}>
                    <div style={{ fontWeight:'800', fontSize:'14px', color:'#1F2937' }}>
                      📈 Results Trend — {selTest}
                    </div>
                    <select value={selTest} onChange={e=>setSelTest(e.target.value)}
                      style={{ padding:'6px 10px', border:`1.5px solid ${PL}`, borderRadius:'8px', fontSize:'12px', fontFamily:'inherit', cursor:'pointer', color:'#374151', background:'#fff' }}>
                      {allTestNames.map(tn => (
                        <option key={tn} value={tn}>{tn}</option>
                      ))}
                    </select>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6"/>
                      <XAxis dataKey="name" tick={{ fontSize:10, fill:'#6B7280' }} axisLine={false} tickLine={false}/>
                      <YAxis tick={{ fontSize:10, fill:'#6B7280' }} axisLine={false} tickLine={false}/>
                      <Tooltip contentStyle={{ borderRadius:'10px', border:`1px solid ${PL}`, fontSize:'12px' }}
                        formatter={(v) => [v, selTest]}/>
                      {trendData[0]?.min !== null && (
                        <ReferenceLine y={trendData[0]?.min} stroke={RD} strokeDasharray="4 4" label={{ value:'Min', fill:RD, fontSize:10 }}/>
                      )}
                      {trendData[0]?.max !== null && (
                        <ReferenceLine y={trendData[0]?.max} stroke={RD} strokeDasharray="4 4" label={{ value:'Max', fill:RD, fontSize:10 }}/>
                      )}
                      <Line type="monotone" dataKey="value" stroke={PM} strokeWidth={2.5} dot={{ fill:PM, r:4 }} activeDot={{ r:6 }}/>
                    </LineChart>
                  </ResponsiveContainer>
                  <p style={{ fontSize:'11px', color:'#9CA3AF', margin:'8px 0 0', textAlign:'center' }}>
                    Red dashed lines show specification limits. Points outside are out of spec.
                  </p>
                </div>
              )}

              {/* ── SIGN-OFF PANEL ── */}
              <div style={{ background:'#fff', borderRadius:'14px', border:`2px solid ${signoff?GR+'44':G+'44'}`, padding:'20px', marginBottom:'16px' }}>
                <h3 style={{ fontSize:'15px', fontWeight:'800', color:'#1F2937', margin:'0 0 4px' }}>
                  ✍️ QC Head Sign-Off
                </h3>
                <p style={{ fontSize:'12px', color:'#6B7280', margin:'0 0 16px' }}>
                  Review all results above then approve or flag this report for {format(new Date(date),'dd MMMM yyyy')}.
                  Once signed, this is recorded in the system for audit purposes.
                </p>

                {signoff && (
                  <div style={{ background:signoff.status==='approved'?'#F0FDF4':'#FFF7ED', border:`1.5px solid ${signoff.status==='approved'?'#86EFAC':'#FED7AA'}`, borderRadius:'10px', padding:'12px 14px', marginBottom:'14px' }}>
                    <div style={{ fontWeight:'700', color:signoff.status==='approved'?GR:'#EA580C', fontSize:'13px', marginBottom:'4px' }}>
                      {signoff.status==='approved' ? '✅ Approved' : '⚠️ Flagged'} by {signoff.signature_text}
                    </div>
                    <div style={{ fontSize:'12px', color:'#6B7280' }}>
                      {format(new Date(signoff.signed_at),'dd MMM yyyy HH:mm')}
                    </div>
                    {signoff.comments && (
                      <div style={{ fontSize:'12px', color:'#374151', marginTop:'6px', fontStyle:'italic' }}>
                        "{signoff.comments}"
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:'12px', marginBottom:'12px' }}>
                  <div>
                    <label style={{ display:'block', fontSize:'12px', fontWeight:'700', color:'#4C1D95', marginBottom:'5px' }}>
                      Your Signature (Full Name) *
                    </label>
                    <input type="text" value={signature}
                      onChange={e=>setSignature(e.target.value)}
                      placeholder="Type your full name"
                      style={{ border:`1.5px solid ${PL}`, borderRadius:'8px', padding:'9px 12px', fontSize:'13px', fontFamily:'inherit', color:'#111827', outline:'none', width:'100%', boxSizing:'border-box' }}/>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:'12px', fontWeight:'700', color:'#4C1D95', marginBottom:'5px' }}>
                      Comments / Remarks
                    </label>
                    <textarea value={comment} onChange={e=>setComment(e.target.value)}
                      placeholder="Any observations, instructions or flags for this report..."
                      style={{ border:`1.5px solid ${PL}`, borderRadius:'8px', padding:'9px 12px', fontSize:'13px', fontFamily:'inherit', color:'#111827', outline:'none', width:'100%', boxSizing:'border-box', resize:'vertical', minHeight:'60px' }}/>
                  </div>
                </div>

                <div style={{ display:'flex', gap:'10px' }}>
                  <button onClick={() => handleSignoff('approved')} disabled={signing}
                    style={{ flex:1, padding:'12px', background:signing?'#A7F3D0':`linear-gradient(135deg,${GR},#15803D)`, color:'#fff', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:'700', cursor:signing?'not-allowed':'pointer', fontFamily:'inherit', boxShadow:'0 2px 8px rgba(22,163,74,0.3)' }}>
                    {signing ? 'Signing...' : '✅ Approve & Sign Report'}
                  </button>
                  <button onClick={() => handleSignoff('flagged')} disabled={signing}
                    style={{ flex:1, padding:'12px', background:signing?'#FEE2E2':`linear-gradient(135deg,#EA580C,#C2410C)`, color:'#fff', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:'700', cursor:signing?'not-allowed':'pointer', fontFamily:'inherit' }}>
                    ⚠️ Flag for Review
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <PageFooter />
    </div>
  );
}

// helper outside component
function getCS(status) {
  return ({
    pass     :{ c:'#15803D', bg:'#F0FDF4', border:'#86EFAC' },
    ok       :{ c:'#15803D', bg:'#F0FDF4', border:'#86EFAC' },
    fail_low :{ c:'#DC2626', bg:'#FEF2F2', border:'#FECACA' },
    fail_high:{ c:'#DC2626', bg:'#FEF2F2', border:'#FECACA' },
    text_ok  :{ c:'#1D4ED8', bg:'#EFF6FF', border:'#BFDBFE' },
  })[status] || { c:'#374151', bg:'#F9FAFB', border:'#E5E7EB' };
}
