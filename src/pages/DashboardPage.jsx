// ============================================================
// FILE: src/pages/DashboardPage.jsx
// Modern LIMS Sample Tracking — desktop-first, data-dense
// Fixes: Type column removed · departments loaded independently
// ============================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar                  from '../components/Navbar';
import SupervisorNotifications from '../components/SupervisorNotifications';
import SampleEditModal         from '../components/SampleEditModal';
import { useAuth }             from '../context/AuthContext';
import { supabase }            from '../services/supabase';
import api                     from '../services/api';
import { format, isToday, isYesterday, startOfWeek, parseISO } from 'date-fns';
import { toast } from 'react-toastify';

const P  = '#6B21A8';
const PM = '#7C3AED';
const PL = '#EDE9FE';
const GR = '#16A34A';
const RD = '#DC2626';
const SL = '#F8FAFC';

const STATUS_CFG = {
  pending    : { dot:'#94A3B8', bg:'#F1F5F9', color:'#475569', label:'Pending'     },
  in_progress: { dot:'#F59E0B', bg:'#FFFBEB', color:'#92400E', label:'In Progress' },
  complete   : { dot:'#10B981', bg:'#ECFDF5', color:'#065F46', label:'Complete'    },
  voided     : { dot:'#EF4444', bg:'#FEF2F2', color:'#991B1B', label:'Voided'      },
};

function StatusPill({ status }) {
  const c = STATUS_CFG[status] || STATUS_CFG.pending;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', background:c.bg, color:c.color, borderRadius:'20px', padding:'2px 9px', fontSize:'11px', fontWeight:'700', whiteSpace:'nowrap' }}>
      <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:c.dot, flexShrink:0 }}/>
      {c.label}
    </span>
  );
}

function ProgressBar({ done, total }) {
  const pct = total > 0 ? Math.round((done/total)*100) : 0;
  const color = pct === 100 ? '#10B981' : pct > 0 ? '#F59E0B' : '#CBD5E1';
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
      <div style={{ flex:1, height:'5px', background:'#E2E8F0', borderRadius:'3px', overflow:'hidden', minWidth:'50px' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:'3px', transition:'width 0.3s' }}/>
      </div>
      <span style={{ fontSize:'10px', color:'#94A3B8', fontWeight:'600', minWidth:'28px' }}>{done}/{total}</span>
    </div>
  );
}

const todayStr = () => format(new Date(),'yyyy-MM-dd');
const wkStr    = () => format(startOfWeek(new Date(),{weekStartsOn:1}),'yyyy-MM-dd');

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [samples,    setSamples]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [statusF,    setStatusF]    = useState('');
  const [deptF,      setDeptF]      = useState('');
  const [dateMode,   setDateMode]   = useState('single');
  const [dateFrom,   setDateFrom]   = useState(todayStr());
  const [dateTo,     setDateTo]     = useState(todayStr());
  const [editSample, setEditSample] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [depts,      setDepts]      = useState([]);
  const [sortCol,    setSortCol]    = useState('registered_at');
  const [sortDir,    setSortDir]    = useState('desc');
  const [page,       setPage]       = useState(1);
  const PER_PAGE = 25;

  const isSupervisor = ['QC Head','QC Assistant','Shift Supervisor'].includes(user?.roles?.name||'');

  // ── Load all departments independently (not from samples) ─
  useEffect(() => {
    api.get('/lookup/departments')
      .then(res => setDepts(res.data?.departments || []))
      .catch(e => console.error('Dept load:', e.message));
  }, []);

  // ── Load samples ─────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const start = new Date(dateFrom + 'T00:00:00+03:00').toISOString();
      const end   = new Date((dateMode==='range'?dateTo:dateFrom) + 'T23:59:59+03:00').toISOString();

      const { data, error } = await supabase
        .from('registered_samples')
        .select(`
          id, sample_name, sample_number, status,
          registered_at, sampler_name, batch_number, notes,
          departments     ( id, name, code ),
          sample_types    ( id, name, code ),
          sample_subtypes ( id, name ),
          sample_test_assignments ( id, result_value )
        `)
        .gte('registered_at', start)
        .lte('registered_at', end)
        .neq('status','voided')
        .order('registered_at', { ascending: false });

      if (error) throw error;
      setSamples(data || []);
    } catch(e) {
      toast.error('Failed to load samples');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, dateMode]);

  useEffect(() => { load(); setPage(1); }, [load]);

  // Realtime updates
  useEffect(() => {
    const sub = supabase.channel('dash_rt')
      .on('postgres_changes',{event:'*',schema:'public',table:'registered_samples'},()=>load())
      .subscribe();
    return () => sub.unsubscribe();
  }, [load]);

  const handleDelete = async (s) => {
    setDeletingId(s.id);
    try {
      await api.delete(`/samples/${s.id}`);
      toast.success(`${s.sample_number} deleted`);
      setConfirmDel(null);
      load();
    } catch(e) {
      toast.error(e.response?.data?.error || 'Delete failed');
    } finally { setDeletingId(null); }
  };

  // ── Filter + sort ─────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...samples];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.sample_name?.toLowerCase().includes(q)     ||
        s.sample_number?.toLowerCase().includes(q)   ||
        s.sample_types?.name?.toLowerCase().includes(q) ||
        s.departments?.name?.toLowerCase().includes(q)  ||
        s.sampler_name?.toLowerCase().includes(q)
      );
    }
    if (statusF) list = list.filter(s => s.status === statusF);
    if (deptF)   list = list.filter(s => s.departments?.id === deptF);

    list.sort((a,b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (sortCol==='sample_name') { av=a.sample_name||''; bv=b.sample_name||''; }
      if (sortCol==='status')      { av=a.status||'';      bv=b.status||''; }
      if (typeof av === 'string') return sortDir==='asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir==='asc' ? (av>bv?1:-1) : (bv>av?1:-1);
    });
    return list;
  }, [samples, search, statusF, deptF, sortCol, sortDir]);

  const paginated  = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  const stats = useMemo(() => ({
    today   : samples.filter(s => isToday(parseISO(s.registered_at))).length,
    pending : samples.filter(s => s.status==='pending').length,
    progress: samples.filter(s => s.status==='in_progress').length,
    complete: samples.filter(s => s.status==='complete').length,
    total   : samples.length,
  }), [samples]);

  const th = (label, col) => (
    <th onClick={()=>{ setSortCol(col); setSortDir(p=>sortCol===col&&p==='asc'?'desc':'asc'); setPage(1); }}
      style={{ padding:'9px 12px', textAlign:'left', fontSize:'11px', fontWeight:'700', color:'#64748B', background:'#F8FAFC', borderBottom:'1px solid #E2E8F0', cursor:'pointer', whiteSpace:'nowrap', userSelect:'none', position:'sticky', top:0, zIndex:10 }}>
      {label} {sortCol===col&&(sortDir==='asc'?'↑':'↓')}
    </th>
  );

  const inp = { border:'1.5px solid #E2E8F0', borderRadius:'8px', padding:'7px 11px', fontSize:'13px', fontFamily:'inherit', background:'#fff', color:'#1E293B', outline:'none' };
  const selStyle = { ...inp, cursor:'pointer', paddingRight:'28px', appearance:'none', backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat:'no-repeat', backgroundPosition:'right 8px center' };

  return (
    <div style={{ minHeight:'100vh', background:SL, display:'flex', flexDirection:'column' }}>
      <Navbar/>

      {isSupervisor && <SupervisorNotifications/>}

      {/* ── Page header ── */}
      <div style={{ background:'#fff', borderBottom:'1px solid #E2E8F0', padding:'12px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'8px' }}>
        <div>
          <h1 style={{ margin:0, fontSize:'18px', fontWeight:'800', color:'#0F172A' }}>Sample Tracking</h1>
          <p style={{ margin:0, fontSize:'12px', color:'#94A3B8', marginTop:'1px' }}>
            {format(new Date(),'EEEE, dd MMMM yyyy')}
          </p>
        </div>

        {/* Stats pills */}
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center' }}>
          {[
            { label:'Total',    val:stats.total,    color:'#6366F1', bg:'#EEF2FF' },
            { label:'Today',    val:stats.today,    color:'#0EA5E9', bg:'#F0F9FF' },
            { label:'Pending',  val:stats.pending,  color:'#F59E0B', bg:'#FFFBEB' },
            { label:'Running',  val:stats.progress, color:'#8B5CF6', bg:'#F5F3FF' },
            { label:'Complete', val:stats.complete, color:'#10B981', bg:'#ECFDF5' },
          ].map(s => (
            <div key={s.label} style={{ background:s.bg, borderRadius:'10px', padding:'5px 12px', textAlign:'center', minWidth:'64px', border:`1px solid ${s.color}22` }}>
              <div style={{ fontWeight:'900', fontSize:'17px', color:s.color, lineHeight:1 }}>{s.val}</div>
              <div style={{ fontSize:'10px', color:s.color, fontWeight:'600', opacity:0.8, marginTop:'1px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        <button onClick={() => navigate('/register-sample')}
          style={{ padding:'9px 20px', background:`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'10px', fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit', boxShadow:'0 2px 8px rgba(107,33,168,0.25)', whiteSpace:'nowrap' }}>
          + Register Sample
        </button>
      </div>

      {/* ── Filter bar ── */}
      <div style={{ background:'#fff', borderBottom:'1px solid #E2E8F0', padding:'10px 24px', display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center' }}>

        <input type="text" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}
          placeholder="🔍  Search name, number, department, analyst..."
          style={{ ...inp, minWidth:'260px', flex:2 }}/>

        <select value={statusF} onChange={e=>{setStatusF(e.target.value);setPage(1);}} style={{ ...selStyle, minWidth:'130px' }}>
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="complete">Complete</option>
        </select>

        <select value={deptF} onChange={e=>{setDeptF(e.target.value);setPage(1);}} style={{ ...selStyle, minWidth:'150px' }}>
          <option value="">All Departments</option>
          {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>

        <div style={{ display:'flex', border:'1.5px solid #E2E8F0', borderRadius:'8px', overflow:'hidden' }}>
          {['single','range'].map(m => (
            <button key={m} onClick={()=>{setDateMode(m);setPage(1);}}
              style={{ padding:'6px 12px', border:'none', background:dateMode===m?PM:'#fff', color:dateMode===m?'#fff':'#64748B', fontWeight:'700', fontSize:'12px', cursor:'pointer', fontFamily:'inherit' }}>
              {m==='single'?'Day':'Range'}
            </button>
          ))}
        </div>

        <input type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setPage(1);}} style={{ ...inp, cursor:'pointer', minWidth:'130px' }}/>
        {dateMode==='range' && (
          <>
            <span style={{ color:'#CBD5E1', fontSize:'16px' }}>→</span>
            <input type="date" value={dateTo} min={dateFrom} onChange={e=>{setDateTo(e.target.value);setPage(1);}} style={{ ...inp, cursor:'pointer', minWidth:'130px' }}/>
          </>
        )}

        <div style={{ display:'flex', gap:'4px' }}>
          {[
            { label:'Today',     action:()=>{setDateFrom(todayStr());setDateTo(todayStr());setDateMode('single');} },
            { label:'Yesterday', action:()=>{ const d=format(new Date(Date.now()-86400000),'yyyy-MM-dd'); setDateFrom(d); setDateTo(d); setDateMode('single'); } },
            { label:'This Week', action:()=>{setDateFrom(wkStr());setDateTo(todayStr());setDateMode('range');} },
          ].map(b => (
            <button key={b.label} onClick={b.action}
              style={{ padding:'5px 10px', border:'1.5px solid #E2E8F0', borderRadius:'7px', background:'#F8FAFC', color:'#475569', fontSize:'11px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
              {b.label}
            </button>
          ))}
        </div>

        {(search||statusF||deptF) && (
          <button onClick={()=>{setSearch('');setStatusF('');setDeptF('');setPage(1);}}
            style={{ padding:'5px 10px', border:'1.5px solid #FECACA', borderRadius:'7px', background:'#FEF2F2', color:RD, fontSize:'11px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>
            ✕ Clear
          </button>
        )}

        <div style={{ marginLeft:'auto', fontSize:'12px', color:'#94A3B8', fontWeight:'600', whiteSpace:'nowrap' }}>
          {filtered.length} sample{filtered.length!==1?'s':''}
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column', margin:'12px 24px', background:'#fff', borderRadius:'12px', border:'1px solid #E2E8F0', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
        {loading ? (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'60px', color:'#94A3B8', fontSize:'14px', fontWeight:'600' }}>
            Loading samples...
          </div>
        ) : paginated.length === 0 ? (
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'60px', color:'#94A3B8' }}>
            <div style={{ fontSize:'40px', marginBottom:'12px' }}>🔬</div>
            <div style={{ fontWeight:'700', fontSize:'15px', color:'#475569' }}>No samples found</div>
            <div style={{ fontSize:'12px', marginTop:'4px' }}>Try adjusting your filters or register a new sample</div>
            <button onClick={()=>navigate('/register-sample')}
              style={{ marginTop:'14px', padding:'8px 20px', background:`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'9px', fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>
              + Register Sample
            </button>
          </div>
        ) : (
          <>
            <div style={{ flex:1, overflow:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                <thead>
                  <tr>
                    {th('Sample Name',  'sample_name')}
                    {th('Number',       'sample_number')}
                    {/* Type column removed */}
                    <th style={{ padding:'9px 12px', textAlign:'left', fontSize:'11px', fontWeight:'700', color:'#64748B', background:'#F8FAFC', borderBottom:'1px solid #E2E8F0', whiteSpace:'nowrap', position:'sticky', top:0 }}>Department</th>
                    {th('Status',       'status')}
                    <th style={{ padding:'9px 12px', textAlign:'left', fontSize:'11px', fontWeight:'700', color:'#64748B', background:'#F8FAFC', borderBottom:'1px solid #E2E8F0', whiteSpace:'nowrap', position:'sticky', top:0 }}>Progress</th>
                    {th('Registered',   'registered_at')}
                    <th style={{ padding:'9px 12px', textAlign:'left', fontSize:'11px', fontWeight:'700', color:'#64748B', background:'#F8FAFC', borderBottom:'1px solid #E2E8F0', whiteSpace:'nowrap', position:'sticky', top:0 }}>Sampler</th>
                    <th style={{ padding:'9px 12px', textAlign:'center', fontSize:'11px', fontWeight:'700', color:'#64748B', background:'#F8FAFC', borderBottom:'1px solid #E2E8F0', whiteSpace:'nowrap', position:'sticky', top:0 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((s, i) => {
                    const total   = (s.sample_test_assignments||[]).length;
                    const done    = (s.sample_test_assignments||[]).filter(a=>a.result_value).length;
                    const reg     = s.registered_at ? parseISO(s.registered_at) : null;
                    const dateStr = reg
                      ? isToday(reg)     ? `Today ${format(reg,'HH:mm')}`
                      : isYesterday(reg) ? `Yesterday ${format(reg,'HH:mm')}`
                      : format(reg,'dd/MM/yy HH:mm')
                      : '—';
                    const canDel = isSupervisor && s.status==='pending' && done===0;

                    return (
                      <tr key={s.id}
                        style={{ background:i%2===0?'#fff':'#FAFBFC', cursor:'pointer', transition:'background 0.1s' }}
                        onMouseEnter={e=>e.currentTarget.style.background='#F5F3FF'}
                        onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#FAFBFC'}>

                        {/* Sample name */}
                        <td style={{ padding:'10px 12px', borderBottom:'1px solid #F1F5F9', maxWidth:'220px' }}>
                          <div style={{ fontWeight:'700', color:'#0F172A', fontSize:'13px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }} title={s.sample_name}>
                            {s.sample_name}
                          </div>
                          {s.batch_number && (
                            <div style={{ fontSize:'10px', color:'#94A3B8', marginTop:'1px' }}>Batch: {s.batch_number}</div>
                          )}
                        </td>

                        {/* Number */}
                        <td style={{ padding:'10px 12px', borderBottom:'1px solid #F1F5F9', whiteSpace:'nowrap' }}>
                          <span style={{ fontFamily:'monospace', fontSize:'12px', color:PM, fontWeight:'700' }}>
                            {s.sample_number}
                          </span>
                        </td>

                        {/* Type column REMOVED */}

                        {/* Department */}
                        <td style={{ padding:'10px 12px', borderBottom:'1px solid #F1F5F9', whiteSpace:'nowrap' }}>
                          <span style={{ fontSize:'12px', color:'#475569', fontWeight:'600' }}>
                            {s.departments?.name||'—'}
                          </span>
                        </td>

                        {/* Status */}
                        <td style={{ padding:'10px 12px', borderBottom:'1px solid #F1F5F9' }}>
                          <StatusPill status={s.status}/>
                        </td>

                        {/* Progress */}
                        <td style={{ padding:'10px 12px', borderBottom:'1px solid #F1F5F9', minWidth:'120px' }}>
                          <ProgressBar done={done} total={total}/>
                        </td>

                        {/* Registered date */}
                        <td style={{ padding:'10px 12px', borderBottom:'1px solid #F1F5F9', whiteSpace:'nowrap' }}>
                          <span style={{ fontSize:'12px', color:'#64748B' }}>{dateStr}</span>
                        </td>

                        {/* Sampler */}
                        <td style={{ padding:'10px 12px', borderBottom:'1px solid #F1F5F9', whiteSpace:'nowrap' }}>
                          <span style={{ fontSize:'12px', color:'#64748B' }}>{s.sampler_name||'—'}</span>
                        </td>

                        {/* Actions */}
                        <td style={{ padding:'10px 12px', borderBottom:'1px solid #F1F5F9' }}>
                          <div style={{ display:'flex', gap:'5px', justifyContent:'center', flexWrap:'nowrap' }}>

                            {/* Analyse / Continue / View */}
                            <button onClick={()=>navigate(`/analysis/${s.id}`)}
                              style={{ padding:'5px 12px', background:s.status==='complete'?'#ECFDF5':`linear-gradient(135deg,${P},${PM})`, color:s.status==='complete'?'#065F46':'#fff', border:s.status==='complete'?'1px solid #A7F3D0':'none', borderRadius:'7px', fontSize:'11px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                              {s.status==='complete'?'View':s.status==='in_progress'?'Continue':'Analyse'}
                            </button>

                            {/* Edit */}
                            {isSupervisor && (
                              <button onClick={e=>{e.stopPropagation();setEditSample(s);}}
                                style={{ padding:'5px 8px', background:'#F5F3FF', color:P, border:`1px solid ${PL}`, borderRadius:'7px', fontSize:'11px', cursor:'pointer', fontFamily:'inherit', fontWeight:'600' }}
                                title="Correct this sample">
                                ✏️
                              </button>
                            )}

                            {/* Delete */}
                            {canDel && (
                              confirmDel===s.id ? (
                                <div style={{ display:'flex', gap:'3px' }}>
                                  <button onClick={e=>{e.stopPropagation();handleDelete(s);}} disabled={deletingId===s.id}
                                    style={{ padding:'4px 8px', background:RD, color:'#fff', border:'none', borderRadius:'6px', fontSize:'10px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>
                                    {deletingId===s.id?'…':'Yes'}
                                  </button>
                                  <button onClick={e=>{e.stopPropagation();setConfirmDel(null);}}
                                    style={{ padding:'4px 8px', background:'#F1F5F9', color:'#475569', border:'none', borderRadius:'6px', fontSize:'10px', cursor:'pointer', fontFamily:'inherit' }}>
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button onClick={e=>{e.stopPropagation();setConfirmDel(s.id);}}
                                  style={{ padding:'5px 8px', background:'#FEF2F2', color:RD, border:'1px solid #FECACA', borderRadius:'7px', fontSize:'11px', cursor:'pointer', fontFamily:'inherit' }}
                                  title="Delete sample">
                                  🗑
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ padding:'10px 16px', borderTop:'1px solid #E2E8F0', display:'flex', alignItems:'center', justifyContent:'space-between', background:'#FAFBFC', borderRadius:'0 0 12px 12px' }}>
                <span style={{ fontSize:'12px', color:'#94A3B8' }}>
                  Showing {(page-1)*PER_PAGE+1}–{Math.min(page*PER_PAGE,filtered.length)} of {filtered.length}
                </span>
                <div style={{ display:'flex', gap:'4px' }}>
                  <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}
                    style={{ padding:'5px 11px', border:'1px solid #E2E8F0', borderRadius:'7px', background:'#fff', color:page===1?'#CBD5E1':P, fontWeight:'600', fontSize:'12px', cursor:page===1?'not-allowed':'pointer', fontFamily:'inherit' }}>
                    ‹ Prev
                  </button>
                  {Array.from({length:Math.min(5,totalPages)},(_,i)=>{
                    const p = Math.max(1,Math.min(totalPages-4,page-2))+i;
                    return (
                      <button key={p} onClick={()=>setPage(p)}
                        style={{ padding:'5px 9px', border:'1px solid #E2E8F0', borderRadius:'7px', background:p===page?PM:'#fff', color:p===page?'#fff':'#475569', fontWeight:'700', fontSize:'12px', cursor:'pointer', fontFamily:'inherit', minWidth:'32px' }}>
                        {p}
                      </button>
                    );
                  })}
                  <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}
                    style={{ padding:'5px 11px', border:'1px solid #E2E8F0', borderRadius:'7px', background:'#fff', color:page===totalPages?'#CBD5E1':P, fontWeight:'600', fontSize:'12px', cursor:page===totalPages?'not-allowed':'pointer', fontFamily:'inherit' }}>
                    Next ›
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {editSample && (
        <SampleEditModal
          sample={editSample}
          onClose={()=>setEditSample(null)}
          onSaved={()=>{ setEditSample(null); load(); }}
        />
      )}
    </div>
  );
}
