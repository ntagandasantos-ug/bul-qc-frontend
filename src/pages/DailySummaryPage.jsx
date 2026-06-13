// ============================================================
// FILE: src/pages/DailySummaryPage.jsx
// Daily Line Inspection Summary Report
// Pulls issues automatically from all inspection tables,
// shows by shift, supports manual observations + print
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Navbar     from '../components/Navbar';
import { useAuth }  from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { format }   from 'date-fns';
import { toast }    from 'react-toastify';

const P   = '#6B21A8';
const PM  = '#7C3AED';
const PL  = '#EDE9FE';
const GR  = '#16A34A';
const RD  = '#DC2626';
const AM  = '#D97706';
const G   = '#FFB81C';

// ── Positive / neutral remark phrases to ignore ───────────
const POSITIVE_REMARKS = [
  'line ok','all parameters ok','sample ok','weight ok',
  'no action required','pass','none','all ok','good','acceptable',
];
const isNegativeRemark = (r) => {
  if (!r?.trim()) return false;
  const lower = r.toLowerCase().trim();
  return !POSITIVE_REMARKS.some(p => lower === p || lower.startsWith(p));
};

// ── Parameter values that indicate a problem ──────────────
const PROBLEM_PARAM_VALUES = [
  'fail','poor','present','cracked','deformed','leaking','missing',
  'rough cut','off colour','streaks','uneven','oval','flash present',
  'collapsed','not acceptable','not conforming',
];
const isProblematicValue = (v) =>
  v && PROBLEM_PARAM_VALUES.some(p => v.toLowerCase().includes(p));

// ── Print CSS ─────────────────────────────────────────────
const printCSS = `
  @media print {
    body * { visibility: hidden; }
    #print-area, #print-area * { visibility: visible; }
    #print-area { position: absolute; left: 0; top: 0; width: 100%; }
    .no-print { display: none !important; }
    .page-break { page-break-before: always; }
    @page { margin: 15mm; }
  }
`;

// ═══════════════════════════════════════════════════════════
export default function DailySummaryPage() {
  const { user } = useAuth();

  const [date,        setDate]        = useState(format(new Date(),'yyyy-MM-dd'));
  const [loading,     setLoading]     = useState(false);
  const [issues,      setIssues]      = useState({ day:[], night:[] });
  const [report,      setReport]      = useState(null);
  const [observations,setObservations]= useState('');
  const [inspector,   setInspector]   = useState(user?.full_name||'');
  const [hodComments, setHodComments] = useState('');
  const [hodSig,      setHodSig]      = useState('');
  const [signoffDate, setSignoffDate] = useState(format(new Date(),'yyyy-MM-dd'));
  const [saving,      setSaving]      = useState(false);
  const [staffList,   setStaffList]   = useState([]);

  // Load staff
  useEffect(()=>{
    supabase.from('lab_staff').select('full_name').eq('is_active',true).order('full_name')
      .then(({data})=>setStaffList((data||[]).map(s=>s.full_name)));
  },[]);

  // ── Load saved report for this date ──────────────────────
  const loadReport = useCallback(async()=>{
    const { data } = await supabase.from('daily_summary_reports')
      .select('*').eq('report_date',date).maybeSingle();
    if (data){
      setReport(data);
      setObservations(data.observations||'');
      setInspector(data.inspector_name||user?.full_name||'');
      setHodComments(data.hod_comments||'');
      setHodSig(data.hod_signature||'');
      setSignoffDate(data.signoff_date||format(new Date(),'yyyy-MM-dd'));
    } else {
      setReport(null);
      setObservations('');
      setInspector(user?.full_name||'');
      setHodComments('');
      setHodSig('');
      setSignoffDate(format(new Date(),'yyyy-MM-dd'));
    }
  },[date,user]);

  // ── Pull all issues from inspection tables ────────────────
  const loadIssues = useCallback(async()=>{
    setLoading(true);
    const dayIssues   = [];
    const nightIssues = [];

    const add = (shift, item) =>
      shift==='day' ? dayIssues.push(item) : nightIssues.push(item);

    try {
      // ── 1. SOAP ISSUES ──────────────────────────────────
      const { data: soapInsps } = await supabase
        .from('soap_line_inspections')
        .select(`
          shift,
          soap_inspection_entries(
            inspection_time,
            soap_inspection_brand_records(
              brand_name, pack_size, line_number,
              weight_1, weight_2, weight_pass,
              remarks, action_taken
            )
          )
        `)
        .eq('shift_date', date);

      (soapInsps||[]).forEach(insp=>{
        (insp.soap_inspection_entries||[]).forEach(entry=>{
          (entry.soap_inspection_brand_records||[]).forEach(r=>{
            const wOOS    = r.weight_pass === false;
            const badRmk  = isNegativeRemark(r.remarks);
            if (!wOOS && !badRmk) return;

            const bullets = [];
            if (wOOS) bullets.push(`Weight OOS — ${r.weight_1}g / ${r.weight_2}g`);
            if (badRmk && r.remarks) bullets.push(`Remark: ${r.remarks}`);

            add(insp.shift,{
              source : '🧼 Soap',
              time   : entry.inspection_time,
              subject: `${r.brand_name} ${r.pack_size}${r.line_number?` (${r.line_number})`:''}`,
              bullets,
              action : r.action_taken||'—',
            });
          });
        });
      });

      // ── 2. DETERGENT ISSUES ─────────────────────────────
      const { data: detInsps } = await supabase
        .from('detergent_line_inspections')
        .select(`
          shift,
          detergent_inspection_entries(
            inspection_time,
            detergent_inspection_records(
              brand_name, pack_size, batch_number,
              target_weight, actual_weight, deviation, weight_status,
              remarks, action_taken
            )
          )
        `)
        .eq('shift_date', date);

      (detInsps||[]).forEach(insp=>{
        (insp.detergent_inspection_entries||[]).forEach(entry=>{
          (entry.detergent_inspection_records||[]).forEach(r=>{
            const wOOS   = r.weight_status==='high'||r.weight_status==='low';
            const badRmk = isNegativeRemark(r.remarks);
            if (!wOOS && !badRmk) return;

            const bullets = [];
            if (wOOS){
              const dir = r.weight_status==='high'?'High':'Low';
              bullets.push(`Weight ${dir} — Actual: ${r.actual_weight}g | Target: ${r.target_weight} | Deviation: ${r.deviation>0?'+':''}${r.deviation}g`);
            }
            if (badRmk && r.remarks) bullets.push(`Remark: ${r.remarks}`);

            add(insp.shift,{
              source : '🧴 Detergent',
              time   : entry.inspection_time,
              subject: `${r.brand_name} — ${r.pack_size}${r.batch_number?` (Batch: ${r.batch_number})`:''}`,
              bullets,
              action : r.action_taken||'—',
            });
          });
        });
      });

      // ── 3. PLASTICS ISSUES ──────────────────────────────
      const PLAS_PARAMS = [
        'drop_test','stack_test','neck_height','mouth_profile',
        'trimming','colour','pinholes','black_spots',
        'water_marks','depressions','lines_weakness',
      ];

      const { data: plasInsps } = await supabase
        .from('plastics_line_inspections')
        .select(`
          shift,
          plastics_inspection_entries(
            inspection_time,
            plastics_inspection_records(
              machine, capacity, shape, jc_colour,
              weight_a, weight_b, weight_pass,
              drop_test, stack_test, neck_height, mouth_profile,
              trimming, colour, pinholes, black_spots,
              water_marks, depressions, lines_weakness,
              remarks, action_taken
            )
          )
        `)
        .eq('shift_date', date);

      (plasInsps||[]).forEach(insp=>{
        (insp.plastics_inspection_entries||[]).forEach(entry=>{
          (entry.plastics_inspection_records||[]).forEach(r=>{
            const wOOS   = r.weight_pass && r.weight_pass!=='pass';
            const badRmk = isNegativeRemark(r.remarks);
            const badPar = PLAS_PARAMS.filter(pk=>isProblematicValue(r[pk]));
            if (!wOOS && !badRmk && !badPar.length) return;

            const bullets = [];
            if (wOOS){
              const failA = r.weight_pass==='fail_a'||r.weight_pass==='fail_both';
              const failB = r.weight_pass==='fail_b'||r.weight_pass==='fail_both';
              bullets.push(`Weight OOS — Mould A: ${r.weight_a??'—'}g${failA?' ⚠️':''} / Mould B: ${r.weight_b??'—'}g${failB?' ⚠️':''}`);
            }
            badPar.forEach(pk=>{
              const label = pk.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
              bullets.push(`${label}: ${r[pk]}`);
            });
            if (badRmk && r.remarks) bullets.push(`Remark: ${r.remarks}`);

            add(insp.shift,{
              source : '♻️ Plastics',
              time   : entry.inspection_time,
              subject: `${r.machine} — ${r.capacity}${r.shape?` ${r.shape}`:''}${r.jc_colour?` (${r.jc_colour})`:''}`,
              bullets,
              action : r.action_taken||'—',
            });
          });
        });
      });

      // ── 4. OIL ISSUES ───────────────────────────────────
      const { data: oilInsps } = await supabase
        .from('oil_line_inspections')
        .select(`
          shift,
          oil_inspection_entries(
            inspection_time,
            oil_inspection_records(
              brand_name, pack_size, batch_number,
              target_weight, net_weight, sealing,
              remarks, action_taken
            )
          )
        `)
        .eq('shift_date', date);

      (oilInsps||[]).forEach(insp=>{
        (insp.oil_inspection_entries||[]).forEach(entry=>{
          (entry.oil_inspection_records||[]).forEach(r=>{
            const badRmk  = isNegativeRemark(r.remarks);
            const badSeal = isProblematicValue(r.sealing);
            const badAct  = r.action_taken && !['pass','no action required'].includes(r.action_taken?.toLowerCase());
            if (!badRmk && !badSeal && !badAct) return;

            const bullets = [];
            if (badSeal) bullets.push(`Sealing issue: ${r.sealing}`);
            if (badRmk && r.remarks) bullets.push(`Remark: ${r.remarks}`);

            add(insp.shift,{
              source : '🛢️ Oil',
              time   : entry.inspection_time,
              subject: `${r.brand_name} — ${r.pack_size}${r.batch_number?` (Batch: ${r.batch_number})`:''}`,
              bullets,
              action : r.action_taken||'—',
            });
          });
        });
      });

      // ── 5. FATS ISSUES ──────────────────────────────────
      const { data: fatsInsps } = await supabase
        .from('fats_line_inspections')
        .select(`
          shift,
          fats_inspection_entries(
            inspection_time,
            fats_inspection_records(
              brand_name, pack_size, batch_number,
              target_weight, net_weight, votation,
              remarks, action_taken
            )
          )
        `)
        .eq('shift_date', date);

      (fatsInsps||[]).forEach(insp=>{
        (insp.fats_inspection_entries||[]).forEach(entry=>{
          (entry.fats_inspection_records||[]).forEach(r=>{
            const badVot = r.votation && ['fail','not acceptable','not acceptable','borderline'].includes(r.votation.toLowerCase());
            const badRmk = isNegativeRemark(r.remarks);
            if (!badVot && !badRmk) return;

            const bullets = [];
            if (badVot) bullets.push(`Votation: ${r.votation}`);
            if (badRmk && r.remarks) bullets.push(`Remark: ${r.remarks}`);

            add(insp.shift,{
              source : '📦 Fats',
              time   : entry.inspection_time,
              subject: `${r.brand_name} — ${r.pack_size}${r.batch_number?` (Batch: ${r.batch_number})`:''}`,
              bullets,
              action : r.action_taken||'—',
            });
          });
        });
      });

      // Sort each shift by time
      const byTime = (a,b) => (a.time||'').localeCompare(b.time||'');
      setIssues({
        day  : dayIssues.sort(byTime),
        night: nightIssues.sort(byTime),
      });

    } catch(e){
      console.error('Summary load error:', e.message);
      toast.error('Failed to load inspection data');
    } finally {
      setLoading(false);
    }
  },[date]);

  useEffect(()=>{ loadIssues(); loadReport(); },[loadIssues, loadReport]);

  // ── Save report (observations + sign-off) ─────────────────
  const saveReport = async()=>{
    if (!inspector.trim()){ toast.warning('Select inspector name'); return; }
    setSaving(true);
    try {
      await supabase.from('daily_summary_reports').upsert({
        report_date   : date,
        observations  : observations||null,
        inspector_name: inspector.trim(),
        hod_comments  : hodComments||null,
        hod_signature : hodSig||null,
        signoff_date  : signoffDate||null,
        signed_at     : new Date().toISOString(),
      },{ onConflict:'report_date' });
      toast.success('✅ Report saved');
      await loadReport();
    } catch(e){ toast.error(e.message); }
    finally { setSaving(false); }
  };

  const totalIssues = issues.day.length + issues.night.length;

  const inp = { border:'1.5px solid #E2E8F0', borderRadius:'8px', padding:'8px 11px', fontSize:'13px', fontFamily:'inherit', background:'#fff', outline:'none', boxSizing:'border-box', width:'100%' };
  const sel = { ...inp, cursor:'pointer', appearance:'auto' };
  const lbl = { display:'block', fontSize:'11px', fontWeight:'700', color:'#4C1D95', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'0.4px' };

  // ── Issue card ────────────────────────────────────────────
  const IssueCard = ({ item, idx, print }) => (
    <div style={{ display:'flex', gap:'12px', marginBottom: print?'8px':'10px', alignItems:'flex-start' }}>
      {/* Bullet */}
      <div style={{ width:'22px', height:'22px', borderRadius:'50%', background:RD, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:'900', flexShrink:0, marginTop:'1px' }}>
        {idx+1}
      </div>
      {/* Content */}
      <div style={{ flex:1, background: print?'transparent':'#FFF5F5', borderRadius:'8px', padding: print?'0':'10px 12px', border: print?'none':'1px solid #FECACA' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap', marginBottom:'4px' }}>
          <span style={{ fontWeight:'800', fontSize:'12px', color:RD }}>{item.source}</span>
          <span style={{ background:'#FEF3C7', color:AM, padding:'1px 8px', borderRadius:'10px', fontSize:'11px', fontWeight:'700' }}>
            🕐 {item.time}
          </span>
          <span style={{ fontWeight:'700', fontSize:'12px', color:'#1E293B' }}>{item.subject}</span>
        </div>
        <ul style={{ margin:'4px 0', paddingLeft:'16px' }}>
          {item.bullets.map((b,bi)=>(
            <li key={bi} style={{ fontSize:'12px', color:'#374151', marginBottom:'2px' }}>{b}</li>
          ))}
        </ul>
        <div style={{ fontSize:'11px', color:'#64748B', marginTop:'4px' }}>
          <strong>Action:</strong> {item.action}
        </div>
      </div>
    </div>
  );

  // ── Shift section ─────────────────────────────────────────
  const ShiftSection = ({ shiftKey, label, timeRange, items, print }) => (
    <div style={{ marginBottom: print?'16px':'20px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px', borderBottom:`2px solid ${P}`, paddingBottom:'6px' }}>
        <span style={{ fontSize: print?'14px':'16px', fontWeight:'900', color:P }}>{label}</span>
        <span style={{ fontSize:'11px', color:'#64748B', fontWeight:'600' }}>{timeRange}</span>
        <span style={{ marginLeft:'auto', background: items.length>0?'#FEF2F2':'#ECFDF5', color:items.length>0?RD:GR, padding:'2px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:'700', border:`1px solid ${items.length>0?'#FECACA':'#A7F3D0'}` }}>
          {items.length>0 ? `${items.length} issue${items.length!==1?'s':''}` : '✓ No issues'}
        </span>
      </div>

      {items.length===0 ? (
        <div style={{ padding:'12px 16px', background:'#F0FDF4', borderRadius:'8px', border:'1px solid #A7F3D0', fontSize:'13px', color:GR, fontWeight:'600' }}>
          ✓ All inspections passed. No non-conformances recorded during this shift.
        </div>
      ) : (
        <div>
          {items.map((item,idx)=>(
            <IssueCard key={idx} item={item} idx={idx} print={print}/>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'#F8FAFC', paddingBottom:'60px' }}>
      <style>{printCSS}</style>
      <Navbar/>

      {/* Page header */}
      <div className="no-print" style={{ background:`linear-gradient(135deg,${P},${PM})`, padding:'14px 24px', color:'#fff', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h1 style={{ margin:0, fontSize:'18px', fontWeight:'900' }}>📋 Daily Line Inspection Summary</h1>
          <p style={{ margin:'2px 0 0', fontSize:'11px', color:'#DDD6FE' }}>BIDCO Uganda Limited · Quality Assurance Department</p>
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)}
            style={{ border:'1.5px solid rgba(255,255,255,0.4)', borderRadius:'8px', padding:'6px 12px', fontSize:'13px', background:'rgba(255,255,255,0.15)', color:'#fff', outline:'none', cursor:'pointer', fontFamily:'inherit' }}/>
          <button onClick={()=>setDate(format(new Date(),'yyyy-MM-dd'))}
            style={{ padding:'6px 12px', background:'rgba(255,215,0,0.25)', border:'1.5px solid rgba(255,215,0,0.5)', color:G, borderRadius:'7px', fontWeight:'700', fontSize:'12px', cursor:'pointer', fontFamily:'inherit' }}>
            Today
          </button>
          <button onClick={()=>{ loadIssues(); loadReport(); }}
            style={{ padding:'6px 12px', background:'rgba(255,255,255,0.15)', border:'1.5px solid rgba(255,255,255,0.3)', color:'#fff', borderRadius:'7px', fontWeight:'700', fontSize:'12px', cursor:'pointer', fontFamily:'inherit' }}>
            🔄 Refresh
          </button>
          <button onClick={()=>window.print()}
            style={{ padding:'6px 16px', background:G, color:'#1F2937', border:'none', borderRadius:'7px', fontWeight:'800', fontSize:'12px', cursor:'pointer', fontFamily:'inherit' }}>
            🖨️ Print
          </button>
        </div>
      </div>

      <div style={{ maxWidth:'900px', margin:'0 auto', padding:'20px 24px' }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:'60px', color:'#94A3B8', fontWeight:'600' }}>
            Loading inspection data...
          </div>
        ) : (
          <>
            {/* ═══════════════════════════════════════════════
                PRINTABLE AREA
            ═══════════════════════════════════════════════ */}
            <div id="print-area">
              {/* Report header */}
              <div style={{ textAlign:'center', marginBottom:'24px', borderBottom:`3px solid ${P}`, paddingBottom:'16px' }}>
                <div style={{ fontSize:'11px', color:'#64748B', fontWeight:'600', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'4px' }}>
                  BIDCO UGANDA LIMITED
                </div>
                <h2 style={{ margin:'0 0 4px', fontSize:'20px', fontWeight:'900', color:P }}>
                  Daily Line Inspection Summary Report
                </h2>
                <div style={{ fontSize:'13px', color:'#475569', fontWeight:'600' }}>
                  {format(new Date(date),'EEEE, dd MMMM yyyy')}
                </div>
                <div style={{ display:'flex', justifyContent:'center', gap:'20px', marginTop:'10px', flexWrap:'wrap' }}>
                  <span style={{ background: totalIssues>0?'#FEF2F2':'#ECFDF5', color:totalIssues>0?RD:GR, padding:'4px 16px', borderRadius:'20px', fontSize:'12px', fontWeight:'800', border:`1px solid ${totalIssues>0?'#FECACA':'#A7F3D0'}` }}>
                    {totalIssues > 0 ? `⚠️ ${totalIssues} Non-Conformance${totalIssues!==1?'s':''} Recorded` : '✓ No Non-Conformances'}
                  </span>
                </div>
              </div>

              {/* Day shift */}
              <ShiftSection shiftKey="day" label="☀️ Day Shift" timeRange="07:00 – 19:00" items={issues.day}/>

              {/* Night shift */}
              <ShiftSection shiftKey="night" label="🌙 Night Shift" timeRange="19:00 – 07:00" items={issues.night}/>

              {/* ── Additional observations ── */}
              <div style={{ marginBottom:'20px' }}>
                <div style={{ fontWeight:'900', fontSize:'14px', color:P, borderBottom:`2px solid ${P}`, paddingBottom:'6px', marginBottom:'12px' }}>
                  📝 Additional Observations
                </div>
                <div className="no-print">
                  <textarea
                    value={observations}
                    onChange={e=>setObservations(e.target.value)}
                    rows={4}
                    placeholder="Type any additional observations, general notes or recommendations here..."
                    style={{ ...inp, resize:'vertical', minHeight:'90px' }}
                  />
                </div>
                {/* Print version of observations */}
                <div className="print-only" style={{ display:'none' }}>
                  <style>{'.print-only { display: block !important; } @media screen { .print-only { display: none !important; } }'}</style>
                  <div style={{ minHeight:'60px', borderBottom:'1px solid #E2E8F0', padding:'8px 0', fontSize:'13px', color:'#374151', whiteSpace:'pre-wrap' }}>
                    {observations || '—'}
                  </div>
                </div>
              </div>

              {/* ── Sign-off section ── */}
              <div style={{ border:`2px solid ${PL}`, borderRadius:'12px', padding:'18px', background:'#FAFBFF' }}>
                <div style={{ fontWeight:'900', fontSize:'14px', color:P, marginBottom:'14px', borderBottom:`1px solid ${PL}`, paddingBottom:'8px' }}>
                  ✍️ Report Sign-Off
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
                  <div>
                    <label style={lbl}>Line Inspector</label>
                    <div className="no-print">
                      <select value={inspector} onChange={e=>setInspector(e.target.value)} style={sel}>
                        <option value="">— Select —</option>
                        {staffList.map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div style={{ borderBottom:'1px solid #94A3B8', padding:'5px 0', fontSize:'13px', color:'#1E293B', fontWeight:'600' }} className="print-only">
                      {inspector||'_________________________'}
                    </div>
                  </div>
                  <div>
                    <label style={lbl}>Sign-Off Date</label>
                    <div className="no-print">
                      <input type="date" value={signoffDate} onChange={e=>setSignoffDate(e.target.value)} style={inp}/>
                    </div>
                    <div style={{ borderBottom:'1px solid #94A3B8', padding:'5px 0', fontSize:'13px', color:'#1E293B', fontWeight:'600' }} className="print-only">
                      {signoffDate ? format(new Date(signoffDate),'dd / MM / yyyy') : '_________________________'}
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom:'12px' }}>
                  <label style={lbl}>Head of QA/QC Comments</label>
                  <div className="no-print">
                    <textarea value={hodComments} onChange={e=>setHodComments(e.target.value)} rows={3}
                      placeholder="Head of QA/QC comments on this day's production quality..."
                      style={{ ...inp, resize:'vertical', minHeight:'70px' }}/>
                  </div>
                  <div style={{ minHeight:'50px', borderBottom:'1px solid #94A3B8', padding:'5px 0', fontSize:'13px', color:'#374151', whiteSpace:'pre-wrap' }} className="print-only">
                    {hodComments||'_________________________'}
                  </div>
                </div>

                <div style={{ marginBottom:'16px' }}>
                  <label style={lbl}>Head of QA/QC Signature</label>
                  <div className="no-print">
                    <input type="text" value={hodSig} onChange={e=>setHodSig(e.target.value)}
                      placeholder="Type full name as signature..." style={inp}/>
                  </div>
                  <div style={{ borderBottom:'1px solid #94A3B8', padding:'5px 0 20px', fontSize:'13px', color:'#1E293B', fontWeight:'700' }} className="print-only">
                    {hodSig||'_________________________'}
                  </div>
                </div>

                {report?.signed_at && (
                  <div style={{ fontSize:'11px', color:GR, fontWeight:'600', marginBottom:'10px' }}>
                    ✅ Saved on {format(new Date(report.signed_at),'dd MMMM yyyy · HH:mm')}
                  </div>
                )}

                <button onClick={saveReport} disabled={saving}
                  className="no-print"
                  style={{ width:'100%', padding:'11px', background:`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'9px', fontSize:'13px', fontWeight:'800', cursor:saving?'not-allowed':'pointer', fontFamily:'inherit' }}>
                  {saving ? '⏳ Saving...' : '💾 Save Report'}
                </button>
              </div>

              {/* Print footer */}
              <div style={{ marginTop:'20px', textAlign:'center', fontSize:'10px', color:'#94A3B8', borderTop:'1px solid #E2E8F0', paddingTop:'10px' }}>
                Generated by BUL QC LIMS · {format(new Date(),'dd/MM/yyyy HH:mm')} · SantosInfographics © 2026
              </div>
            </div>
            {/* End print area */}

            {/* Screen-only summary bar */}
            <div className="no-print" style={{ marginTop:'16px', background:'#fff', borderRadius:'10px', padding:'12px 16px', border:`1px solid ${PL}`, display:'flex', gap:'16px', flexWrap:'wrap' }}>
              <span style={{ fontSize:'12px', color:'#64748B' }}>
                <strong>Day shift:</strong> {issues.day.length} issue{issues.day.length!==1?'s':''}
              </span>
              <span style={{ fontSize:'12px', color:'#64748B' }}>
                <strong>Night shift:</strong> {issues.night.length} issue{issues.night.length!==1?'s':''}
              </span>
              <span style={{ fontSize:'12px', color:'#64748B', marginLeft:'auto' }}>
                Data pulled from Soap, Detergent, Plastics, Oil and Fats inspection pages
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
