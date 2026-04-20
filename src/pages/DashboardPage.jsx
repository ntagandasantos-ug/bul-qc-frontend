import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar          from '../components/Navbar';
import PageFooter      from '../components/PageFooter';
import SampleCard      from '../components/SampleCard';
import LoadingSpinner  from '../components/LoadingSpinner';
import { useAuth }     from '../context/AuthContext';
import { samplesService }  from '../services/samples.service';
import { supabase }        from '../services/supabase';
import { format }          from 'date-fns';

export default function DashboardPage() {
  const [samples,      setSamples]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter,   setDateFilter]   = useState(
    format(new Date(), 'yyyy-MM-dd')  // default = today
  );
  const [showAll,      setShowAll]      = useState(false);
  const [refreshing,   setRefreshing]   = useState(false);
  const { isDeptHead } = useAuth();
  const navigate = useNavigate();

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const filters = {};
      if (statusFilter !== 'all') filters.status = statusFilter;
      // When showAll is false, filter by selected date
      if (!showAll) filters.date = dateFilter;
      const data = await samplesService.getSamples(filters);
      setSamples(data.samples || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [statusFilter, dateFilter, showAll]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const sub = supabase
      .channel('dash_samples')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'registered_samples' },
        () => load(true)
      ).subscribe();
    return () => sub.unsubscribe();
  }, [load]);

  const filtered = samples.filter(s => {
    const q = search.toLowerCase();
    return (
      s.sample_name?.toLowerCase().includes(q) ||
      s.sample_number?.toLowerCase().includes(q) ||
      s.sample_types?.name?.toLowerCase().includes(q) ||
      s.brands?.name?.toLowerCase().includes(q)
    );
  });

  // Stats
  const today = format(new Date(), 'yyyy-MM-dd');
  const todaySamples = samples.filter(s =>
    s.registered_at?.startsWith(today)
  );
  const counts = {
    all:         samples.length,
    today:       todaySamples.length,
    pending:     samples.filter(s => s.status === 'pending').length,
    in_progress: samples.filter(s => s.status === 'in_progress').length,
    complete:    samples.filter(s => s.status === 'complete').length,
  };

  const statCard = (label, value, color, icon) => (
    <div key={label} style={{
      background: '#fff', borderRadius: '14px',
      border: `2px solid ${color}22`,
      padding: '12px', textAlign: 'center',
      flex: '1',
    }}>
      <div style={{ fontSize: '22px', marginBottom: '2px' }}>{icon}</div>
      <div style={{ fontSize: '22px', fontWeight: '800', color }}>{value}</div>
      <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: '600' }}>{label}</div>
    </div>
  );

  const inputSt = {
    border: '1.5px solid #E9D5FF', borderRadius: '10px',
    padding: '9px 12px', fontSize: '13px',
    fontFamily: 'inherit', background: '#fff',
    color: '#111827', cursor: 'text',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FAF5FF', paddingBottom: '60px' }}>
      <Navbar />

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px 16px' }}>

        {/* Page title */}
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800',
                       color: '#1F2937', margin: '0 0 2px' }}>
            Sample Tracking
          </h2>
          <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>
            {format(new Date(), 'EEEE, dd MMMM yyyy')}
          </p>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px',
                      flexWrap: 'wrap' }}>
          {statCard('All Samples',  counts.all,         '#7C3AED', '🧪')}
          {statCard('Today',        counts.today,        '#6B21A8', '📅')}
          {statCard('Pending',      counts.pending,      '#6B7280', '⏳')}
          {statCard('In Progress',  counts.in_progress,  '#EA580C', '🔬')}
          {statCard('Complete',     counts.complete,     '#16A34A', '✅')}
        </div>

        {/* Controls Row */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap',
                      marginBottom: '16px', alignItems: 'center' }}>

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Search samples..."
            style={{ ...inputSt, flex: '1', minWidth: '160px', cursor: 'text' }}
          />

          {/* Date filter */}
          <input
            type="date"
            value={dateFilter}
            onChange={e => { setDateFilter(e.target.value); setShowAll(false); }}
            style={{ ...inputSt, cursor: 'pointer' }}
          />

          {/* Show all toggle */}
          <button
            onClick={() => setShowAll(!showAll)}
            style={{
              padding: '9px 14px', borderRadius: '10px',
              border: `1.5px solid ${showAll ? '#7C3AED' : '#E9D5FF'}`,
              background: showAll ? '#7C3AED' : '#fff',
              color: showAll ? '#fff' : '#7C3AED',
              fontSize: '12px', fontWeight: '600',
              cursor: 'pointer', fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            {showAll ? '📅 Filtered' : '📋 All Dates'}
          </button>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ ...inputSt, cursor: 'pointer' }}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="complete">Complete</option>
          </select>

          {/* Refresh */}
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            style={{
              padding: '9px 12px', borderRadius: '10px',
              border: '1.5px solid #E9D5FF', background: '#fff',
              cursor: 'pointer', fontSize: '16px',
            }}
          >
            {refreshing ? '⏳' : '🔄'}
          </button>

          {/* Register button */}
          {!isDeptHead && (
            <button
              onClick={() => navigate('/register-sample')}
              style={{
                padding: '9px 16px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #6B21A8, #7C3AED)',
                color: '#fff', border: 'none',
                fontSize: '13px', fontWeight: '700',
                cursor: 'pointer', fontFamily: 'inherit',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(124,58,237,0.3)',
              }}
            >
              + Register Sample
            </button>
          )}
        </div>

        {/* Date label */}
        <p style={{ fontSize: '12px', color: '#7C3AED', fontWeight: '600',
                    marginBottom: '12px' }}>
          {showAll
            ? `Showing all ${filtered.length} samples`
            : `Showing ${filtered.length} sample(s) for ${
                dateFilter === today ? 'today' : dateFilter
              }`}
        </p>

        {/* Sample list */}
        {loading ? (
          <LoadingSpinner text="Loading samples..." />
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🧪</div>
            <p style={{ color: '#6B7280', fontWeight: '600', fontSize: '15px' }}>
              No samples found
            </p>
            <p style={{ color: '#9CA3AF', fontSize: '13px', marginTop: '4px' }}>
              {samples.length === 0
                ? 'Register the first sample of this shift'
                : 'Try a different search, date, or status filter'}
            </p>
            {!isDeptHead && (
              <button
                onClick={() => navigate('/register-sample')}
                style={{
                  marginTop: '16px', padding: '12px 24px',
                  background: '#7C3AED', color: '#fff',
                  border: 'none', borderRadius: '12px',
                  fontSize: '14px', fontWeight: '600',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                + Register Sample
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filtered.map(s => <SampleCard key={s.id} sample={s} />)}
            <p style={{ textAlign: 'center', fontSize: '11px',
                        color: '#9CA3AF', paddingTop: '8px' }}>
              {filtered.length} of {samples.length} samples shown
            </p>
          </div>
        )}
      </div>

      <PageFooter />
    </div>
  );
}
