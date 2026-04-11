import React, { useState, useEffect, useCallback } from 'react';
import Navbar                from '../components/Navbar';
import StatCard              from '../components/StatCard';
import NotificationBell      from '../components/NotificationBell';
import LoadingSpinner        from '../components/LoadingSpinner';
import { useAuth }           from '../context/AuthContext';
import { dashboardService }  from '../services/dashboard.service';
import { supabase }          from '../services/supabase';
import { format }            from 'date-fns';
import { Activity }          from 'lucide-react';

export default function DeptDashboardPage() {
  const { user }     = useAuth();
  const [results,    setResults]    = useState([]);
  const [stats,      setStats]      = useState({});
  const [loading,    setLoading]    = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const load = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([
        dashboardService.getLiveResults(),
        dashboardService.getStats(user?.department_id),
      ]);
      setResults(r || []);
      setStats(s || {});
      setLastUpdate(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Real-time result subscription
  useEffect(() => {
    const sub = supabase
      .channel('dept_live_results')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sample_test_assignments' },
        () => { load(); playBeep_ifOutOfSpec(); }
      )
      .subscribe();
    return () => sub.unsubscribe();
  }, [load]);

  const playBeep_ifOutOfSpec = () => {
    try {
      const ctx  = new (window.AudioContext || window.webkitAudioContext)();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 660;
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
      osc.start(); osc.stop(ctx.currentTime + 1);
    } catch (e) {}
  };

  const statusColor = (status) => ({
    pass     : 'text-green-600 bg-green-50  border-green-200',
    fail_low : 'text-red-600   bg-red-50    border-red-200',
    fail_high: 'text-red-600   bg-red-50    border-red-200',
    text_ok  : 'text-blue-600  bg-blue-50   border-blue-200',
    ok       : 'text-green-600 bg-green-50  border-green-200',
  })[status] || 'text-gray-600 bg-gray-50 border-gray-200';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Custom header with notification bell */}
      <nav className="bg-bul-blue text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-base">
              {user?.departments?.name || 'Department'} Dashboard
            </h1>
            <p className="text-blue-200 text-xs">
              Live Results Feed — {user?.full_name}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs text-blue-200">
              <Activity size={12} className="animate-pulse" />
              Live
            </div>
            <NotificationBell departmentId={user?.department_id} />
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-5">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <StatCard label="Total Today"  value={stats.total       || 0} color="blue"   icon="🧪" />
          <StatCard label="Pending"      value={stats.pending     || 0} color="gray"   icon="⏳" />
          <StatCard label="In Progress"  value={stats.in_progress || 0} color="orange" icon="🔬" />
          <StatCard label="Out of Spec"  value={stats.out_of_spec || 0} color="red"    icon="⚠️" />
        </div>

        {/* Live results table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center
                          justify-between">
            <h3 className="font-semibold text-gray-800">Live Results</h3>
            <p className="text-xs text-gray-400">
              Updated: {format(lastUpdate, 'HH:mm:ss')}
            </p>
          </div>

          {loading ? (
            <LoadingSpinner text="Loading live results..." />
          ) : results.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Activity size={32} className="mx-auto mb-3 opacity-30" />
              <p>No results submitted yet today</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-4 py-3">Sample</th>
                    <th className="text-left px-4 py-3">Parameter</th>
                    <th className="text-left px-4 py-3">Result</th>
                    <th className="text-left px-4 py-3">Remarks</th>
                    <th className="text-left px-4 py-3">Action</th>
                    <th className="text-left px-4 py-3">Analyst</th>
                    <th className="text-left px-4 py-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {results.map(r => (
                    <tr
                      key={r.id}
                      className={`hover:bg-gray-50 transition-colors
                        ${r.result_status === 'fail_low' || r.result_status === 'fail_high'
                          ? 'bg-red-50/40' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800 text-xs">
                          {r.registered_samples?.sample_name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {r.registered_samples?.sample_number}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">
                        {r.tests?.name}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-lg text-xs
                                          font-bold border ${statusColor(r.result_status)}`}>
                          {r.result_value} {r.tests?.unit || ''}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold
                          ${r.remarks === 'OK'
                            ? 'text-green-600'
                            : 'text-red-600'}`}>
                          {r.remarks || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold
                          ${r.action === 'Pass'
                            ? 'text-green-600'
                            : 'text-red-600'}`}>
                          {r.action || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {r.analyst_signature || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {r.submitted_at
                          ? format(new Date(r.submitted_at), 'HH:mm')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}