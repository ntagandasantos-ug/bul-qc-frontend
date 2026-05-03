// ============================================================
// FILE: frontend/bul-qc-app/src/pages/DashboardPage.jsx
// Professional sample tracking with department filter
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate }         from 'react-router-dom';
import Navbar                  from '../components/Navbar';
import PageFooter              from '../components/PageFooter';
import SampleCard              from '../components/SampleCard';
import LoadingSpinner          from '../components/LoadingSpinner';
import SupervisorNotifications from '../components/SupervisorNotifications';
import { useAuth }             from '../context/AuthContext';
import { samplesService }      from '../services/samples.service';
import { lookupService }       from '../services/lookup.service';
import { supabase }            from '../services/supabase';
import { format }              from 'date-fns';

const P  = '#6B21A8';
const PM = '#7C3AED';
const PL = '#EDE9FE';

export default function DashboardPage() {
  const [samples,      setSamples]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deptFilter,   setDeptFilter]   = useState('all');
  const [fromDate,     setFromDate]     = useState(format(new Date(), 'yyyy-MM-dd'));
  const [toDate,       setToDate]       = useState(format(new Date(), 'yyyy-MM-dd'));
  const [useRange,     setUseRange]     = useState(false);
  const [depts,        setDepts]        = useState([]);

  const { isDeptHead, isAdmin } = useAuth();
  const navigate = useNavigate();

  // Load departments for filter
  useEffect(() => {
    lookupService.getDepartments()
      .then(d => setDepts(d || []))
      .catch(() => {});
  }, []);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const filters = {};
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (deptFilter   !== 'all') filters.department_id = deptFilter;

      if (useRange) {
        filters.fromDate = fromDate;
        filters.toDate   = toDate;
      } else {
        filters.date = fromDate;
      }

      const data = await samplesService.getSamples(filters);
      setSamples(data.samples || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, deptFilter, fromDate, toDate, useRange]);

  useEffect(() => { load(); }, [load]);

  // Realtime updates
  useEffect(() => {
    const sub = supabase
      .channel('dash_samples_v2')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'registered_samples' },
        () => load(true)
      ).subscribe();
    return () => sub.unsubscribe();
  }, [load]);

  // ── Search filter ─────────────────────────────────────────
  const filtered = samples.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.sample_name?.toLowerCase().includes(q) ||
      s.sample_number?.toLowerCase().includes(q) ||
      s.sample_types?.name?.toLowerCase().includes(q) ||
      s.departments?.name?.toLowerCase().includes(q)
    );
  });

  // ── Stats — FIX midnight issue ────────────────────────────
  // Use startOfDay/endOfDay to correctly bracket today
  const todayStr = format(new Date(), 'yyyy-MM-dd');

const todaySamples = samples.filter(s => {
  if (!s.registered_at) return false;
  // Convert UTC timestamp to local date string for comparison
  const localDate = format(new Date(s.registered_at), 'yyyy-MM-dd');
  return localDate === todayStr;
});

  const counts = {
    total      : samples.length,
    today      : todaySamples.length,
    pending    : samples.filter(s => s.status === 'pending').length,
    in_progress: samples.filter(s => s.status === 'in_progress').length,
    complete   : samples.filter(s => s.status === 'complete').length,
  };

  const today = format(new Date(), 'yyyy-MM-dd');

  const inp = {
    border:`1.5px solid ${PL}`, borderRadius:'9px',
    padding:'8px 12px', fontSize:'13px',
    fontFamily:'inherit', background:'#fff',
    color:'#111827', outline:'none', boxSizing:'border-box',
  };

  const sel = {
    ...inp, cursor:'pointer',
    backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%237C3AED' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
    backgroundRepeat:'no-repeat',
    backgroundPosition:'right 10px center',
    paddingRight:'32px', appearance:'none',
  };

  const statCard = (label, value, color, icon, sublabel) => (
    <div key={label} style={{
      background:'#fff', borderRadius:'12px',
      border:`2px solid ${color}18`,
      padding:'12px 10px', textAlign:'center',
      flex:'1', minWidth:'80px',
      boxShadow:'0 1px 4px rgba(107,33,168,0.06)',
    }}>
      <div style={{ fontSize:'18px', marginBottom:'2px' }}>{icon}</div>
      <div style={{ fontSize:'22px', fontWeight:'900', color, lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:'10px', color:'#6B7280', fontWeight:'600', marginTop:'3px' }}>{label}</div>
      {sublabel && <div style={{ fontSize:'9px', color:'#9CA3AF', marginTop:'1px' }}>{sublabel}</div>}
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'#FAF5FF', paddingBottom:'56px' }}>
      <Navbar />

      <div style={{ maxWidth:'960px', margin:'0 auto', padding:'16px 14px' }}>

        {/* Page title row */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px', flexWrap:'wrap', gap:'8px' }}>
          <div>
            <h2 style={{ fontSize:'18px', fontWeight:'800', color:'#1F2937', margin:'0 0 2px' }}>
              Sample Tracking
            </h2>
            <p style={{ fontSize:'12px', color:'#9CA3AF', margin:0 }}>
              {format(new Date(), 'EEEE, dd MMMM yyyy')}
            </p>
          </div>
          {!isDeptHead && (
            <button onClick={() => navigate('/register-sample')} style={{
              padding:'9px 18px',
              background:`linear-gradient(135deg,${P},${PM})`,
              color:'#fff', border:'none', borderRadius:'10px',
              fontSize:'13px', fontWeight:'700',
              cursor:'pointer', fontFamily:'inherit',
              boxShadow:'0 2px 8px rgba(124,58,237,0.3)',
              display:'flex', alignItems:'center', gap:'6px',
            }}>
              + Register Sample
            </button>
          )}
        </div>

        {/* Supervisor notifications */}
        <SupervisorNotifications />

        {/* Stats row */}
        <div style={{ display:'flex', gap:'8px', marginBottom:'14px', flexWrap:'wrap' }}>
          {statCard('All Loaded',  counts.total,       PM,        '🧪')}
          {statCard('Today',       counts.today,        P,         '📅', 'registered today')}
          {statCard('Pending',     counts.pending,      '#6B7280', '⏳')}
          {statCard('In Progress', counts.in_progress,  '#EA580C', '🔬')}
          {statCard('Complete',    counts.complete,     '#16A34A', '✅')}
        </div>

        {/* ── Filter bar ── */}
        <div style={{
          background:'#fff', borderRadius:'14px',
          border:`1.5px solid ${PL}`, padding:'14px 16px',
          marginBottom:'12px',
          boxShadow:'0 1px 4px rgba(107,33,168,0.06)',
        }}>

          {/* Row 1: Search + Status + Department */}
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'10px' }}>

            {/* Search */}
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Search name, number or type..."
              style={{ ...inp, flex:'2', minWidth:'180px', cursor:'text' }}
            />

            {/* Status filter */}
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...sel, flex:'1', minWidth:'130px' }}>
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="complete">Complete</option>
            </select>

            {/* Department filter — THE KEY NEW FEATURE */}
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={{ ...sel, flex:'1', minWidth:'150px' }}>
              <option value="all">All Departments</option>
              {depts.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            {/* Refresh */}
            <button onClick={() => load(true)} disabled={refreshing}
              style={{
                padding:'8px 12px', border:`1.5px solid ${PL}`,
                borderRadius:'9px', background:'#fff',
                cursor:'pointer', fontSize:'15px',
              }}>
              {refreshing ? '⏳' : '🔄'}
            </button>
          </div>

          {/* Row 2: Date filter */}
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center' }}>

            {/* Mode toggle */}
            <div style={{ display:'flex', gap:'3px' }}>
              {['Single Day', 'Date Range'].map((l, i) => (
                <button key={l} type="button" onClick={() => setUseRange(i === 1)}
                  style={{
                    padding:'5px 11px', borderRadius:'8px', border:'none',
                    cursor:'pointer', fontSize:'11px', fontWeight:'600',
                    fontFamily:'inherit',
                    background: (i === 1) === useRange ? PM : '#F3F4F6',
                    color:      (i === 1) === useRange ? '#fff' : '#6B7280',
                  }}>
                  {l}
                </button>
              ))}
            </div>

            {/* From date */}
            <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
              <span style={{ fontSize:'11px', color:'#6B7280', fontWeight:'600' }}>
                {useRange ? 'From:' : 'Date:'}
              </span>
              <input type="date" value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                style={{ ...inp, cursor:'pointer' }} />
            </div>

            {/* To date */}
            {useRange && (
              <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                <span style={{ fontSize:'14px', color:PM, fontWeight:'700' }}>→</span>
                <input type="date" value={toDate} min={fromDate}
                  onChange={e => setToDate(e.target.value)}
                  style={{ ...inp, cursor:'pointer' }} />
              </div>
            )}

            {/* Quick date buttons */}
            <div style={{ display:'flex', gap:'5px' }}>
              {[
                { l:'Today',     f:today, t:today },
                { l:'Yesterday', f:format(new Date(Date.now()-86400000),'yyyy-MM-dd'), t:format(new Date(Date.now()-86400000),'yyyy-MM-dd') },
                { l:'This Week', f:format(new Date(Date.now()-6*86400000),'yyyy-MM-dd'), t:today },
              ].map(q => (
                <button key={q.l} type="button"
                  onClick={() => { setFromDate(q.f); setToDate(q.t); setUseRange(q.f !== q.t); }}
                  style={{
                    padding:'5px 9px', borderRadius:'8px',
                    border:`1.5px solid ${PL}`, background:'#F5F3FF',
                    color:P, fontSize:'11px', fontWeight:'600',
                    cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap',
                  }}>
                  {q.l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Result count */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
          <p style={{ fontSize:'12px', color:PM, fontWeight:'600', margin:0 }}>
            {filtered.length} sample(s) shown
            {deptFilter !== 'all' && ` · ${depts.find(d => d.id === deptFilter)?.name || ''}`}
            {search && ` · "${search}"`}
          </p>
          {(deptFilter !== 'all' || statusFilter !== 'all' || search) && (
            <button type="button"
              onClick={() => { setDeptFilter('all'); setStatusFilter('all'); setSearch(''); }}
              style={{
                padding:'3px 10px', borderRadius:'8px',
                border:`1px solid ${PL}`, background:'#F5F3FF',
                color:P, fontSize:'11px', fontWeight:'600',
                cursor:'pointer', fontFamily:'inherit',
              }}>
              ✕ Clear filters
            </button>
          )}
        </div>

        {/* Sample list */}
        {loading ? (
          <LoadingSpinner text="Loading samples..." />
        ) : filtered.length === 0 ? (
          <div style={{
            textAlign:'center', padding:'60px 20px',
            background:'#fff', borderRadius:'14px',
            border:`1.5px solid ${PL}`,
          }}>
            <div style={{ fontSize:'48px', marginBottom:'12px' }}>🧪</div>
            <p style={{ color:'#374151', fontWeight:'700', fontSize:'15px' }}>
              No samples found
            </p>
            <p style={{ color:'#9CA3AF', fontSize:'13px', marginTop:'5px' }}>
              {samples.length === 0
                ? 'No samples registered for this period'
                : 'Try adjusting your filters or date range'}
            </p>
            {!isDeptHead && samples.length === 0 && (
              <button onClick={() => navigate('/register-sample')} style={{
                marginTop:'16px', padding:'11px 22px',
                background:PM, color:'#fff', border:'none',
                borderRadius:'11px', fontSize:'14px',
                fontWeight:'600', cursor:'pointer', fontFamily:'inherit',
              }}>
                + Register First Sample
              </button>
            )}
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {filtered.map(s => <SampleCard key={s.id} sample={s} />)}
            <p style={{ textAlign:'center', fontSize:'11px', color:'#9CA3AF', paddingTop:'6px' }}>
              Showing {filtered.length} of {samples.length} samples
            </p>
          </div>
        )}
      </div>

      <PageFooter />
    </div>
  );
}
