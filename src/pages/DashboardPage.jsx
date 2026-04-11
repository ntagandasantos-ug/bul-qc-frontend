import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar          from '../components/Navbar';
import SampleCard      from '../components/SampleCard';
import StatCard        from '../components/StatCard';
import LoadingSpinner  from '../components/LoadingSpinner';
import { samplesService }  from '../services/samples.service';
import { supabase }        from '../services/supabase';
import { Search, PlusCircle, RefreshCw, Filter } from 'lucide-react';

export default function DashboardPage() {
  const [samples,      setSamples]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [refreshing,   setRefreshing]   = useState(false);
  const navigate = useNavigate();

  const loadSamples = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const filters = {};
      if (statusFilter !== 'all') filters.status = statusFilter;
      const data = await samplesService.getSamples(filters);
      setSamples(data.samples || []);
    } catch (err) {
      console.error('Failed to load samples:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  // Initial load
  useEffect(() => { loadSamples(); }, [loadSamples]);

  // Real-time updates
  useEffect(() => {
    const sub = supabase
      .channel('dashboard_samples')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'registered_samples' },
        () => loadSamples(true)
      )
      .subscribe();
    return () => sub.unsubscribe();
  }, [loadSamples]);

  // Filter by search
  const filtered = samples.filter(s => {
    const q = search.toLowerCase();
    return (
      s.sample_name?.toLowerCase().includes(q) ||
      s.sample_number?.toLowerCase().includes(q) ||
      s.sample_types?.name?.toLowerCase().includes(q) ||
      s.brands?.name?.toLowerCase().includes(q)
    );
  });

  // Stats counts
  const counts = {
    total      : samples.length,
    pending    : samples.filter(s => s.status === 'pending').length,
    in_progress: samples.filter(s => s.status === 'in_progress').length,
    complete   : samples.filter(s => s.status === 'complete').length,
  };

  const todayLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 py-5">

        {/* Date header */}
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900">Sample Tracking</h2>
          <p className="text-xs text-gray-400">{todayLabel}</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 mb-5">
          <StatCard label="Total"       value={counts.total}       color="blue"   icon="🧪" />
          <StatCard label="Pending"     value={counts.pending}     color="gray"   icon="⏳" />
          <StatCard label="In Progress" value={counts.in_progress} color="orange" icon="🔬" />
          <StatCard label="Complete"    value={counts.complete}    color="green"  icon="✅" />
        </div>

        {/* Search + filter + add button */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2
                                         text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, number, type..."
              className="w-full pl-8 pr-3 py-2.5 border border-gray-300 rounded-xl
                         text-sm bg-white focus:border-bul-blue"
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm
                       bg-white focus:border-bul-blue text-gray-700"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="complete">Complete</option>
          </select>

          <button
            onClick={() => loadSamples(true)}
            disabled={refreshing}
            className="p-2.5 border border-gray-300 rounded-xl bg-white
                       hover:bg-gray-50 text-gray-500"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={() => navigate('/register-sample')}
            className="flex items-center gap-1.5 bg-bul-blue text-white
                       px-4 py-2.5 rounded-xl text-sm font-semibold
                       hover:bg-blue-800 whitespace-nowrap"
          >
            <PlusCircle size={15} />
            <span className="hidden sm:inline">Register</span>
          </button>
        </div>

        {/* Sample list */}
        {loading ? (
          <LoadingSpinner text="Loading samples..." />
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🧪</div>
            <p className="text-gray-500 font-medium">No samples found</p>
            <p className="text-gray-400 text-sm mt-1">
              {samples.length === 0
                ? 'Register the first sample of this shift'
                : 'Try a different search or filter'}
            </p>
            <button
              onClick={() => navigate('/register-sample')}
              className="mt-4 bg-bul-blue text-white px-6 py-2.5 rounded-xl
                         text-sm font-semibold hover:bg-blue-800"
            >
              + Register Sample
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(sample => (
              <SampleCard key={sample.id} sample={sample} />
            ))}
            <p className="text-center text-xs text-gray-400 pt-2">
              Showing {filtered.length} of {samples.length} samples
            </p>
          </div>
        )}
      </main>
    </div>
  );
}