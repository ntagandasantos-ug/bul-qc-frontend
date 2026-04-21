import React, { useState, useEffect, useCallback } from 'react';
import PageFooter            from '../components/PageFooter';
import NotificationBell      from '../components/NotificationBell';
import LoadingSpinner        from '../components/LoadingSpinner';
import { useAuth }           from '../context/AuthContext';
import { dashboardService }  from '../services/dashboard.service';
import { supabase }          from '../services/supabase';
import { format }            from 'date-fns';

export default function DeptDashboardPage() {
  const { user, logout }   = useAuth();
  const [results,   setResults]   = useState([]);
  const [stats,     setStats]     = useState({});
  const [loading,   setLoading]   = useState(true);
  const [clock,     setClock]     = useState(new Date());
  const [lastUpd,   setLastUpd]   = useState(new Date());
  const [dateFilter,setDateFilter]= useState(format(new Date(),'yyyy-MM-dd'));

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const playBeep = () => {
    try {
      const ctx  = new (window.AudioContext || window.webkitAudioContext)();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 660; osc.type = 'sine';
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
      osc.start(); osc.stop(ctx.currentTime + 1.2);
    } catch (e) {}
  };

  const load = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([
        dashboardService.getLiveResults(),
        dashboardService.getStats(user?.department_id),
      ]);
      setResults(r || []);
      setStats(s || {});
      setLastUpd(new Date());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const sub = supabase
      .channel('dept_live')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sample_test_assignments' },
        (payload) => {
          load();
          if (payload.new.result_status === 'fail_low' ||
              payload.new.result_status === 'fail_high') {
            playBeep();
          }
        }
      ).subscribe();
    return () => sub.unsubscribe();
  }, [load]);

  // Group results by sample
  const sampleMap = {};
  for (const r of results) {
    const sId = r.registered_samples?.id;
    if (!sId) continue;
    if (!sampleMap[sId]) {
      sampleMap[sId] = {
        sample    : r.registered_samples,
        parameters: [],
      };
    }
    sampleMap[sId].parameters.push(r);
  }
  const sampleRows = Object.values(sampleMap);

  // Filter by date
  const filteredRows = sampleRows.filter(row =>
    row.sample?.registered_at?.startsWith(dateFilter)
  );

  // Status colour for a cell value
  const cellColor = (status) => ({
    pass     : { bg: '#F0FDF4', text: '#16A34A', border: '#86EFAC' },
    fail_low : { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
    fail_high: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
    text_ok  : { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
    ok       : { bg: '#F0FDF4', text: '#16A34A', border: '#86EFAC' },
  })[status] || { bg: '#F9FAFB', text: '#374151', border: '#E5E7EB' };

  // Is this entire row within spec?
  const rowIsClean = (params) =>
    params.every(p =>
      !p.result_value ||
      p.result_status === 'pass' ||
      p.result_status === 'ok'  ||
      p.result_status === 'text_ok'
    );

  // Avatar initials
  const name    = user?.full_name || '?';
  const initials= name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();

  return (
    <div style={{ minHeight: '100vh', background: '#FAF5FF', paddingBottom: '60px' }}>

      {/* ── Purple Header ── */}
      <header style={{
        background: 'linear-gradient(135deg, #6B21A8 0%, #7C3AED 100%)',
        color: '#fff',
        boxShadow: '0 2px 12px rgba(107,33,168,0.4)',
        position: 'sticky', top: 0, zIndex: 50,
        padding: '0 16px',
      }}>
        <div style={{
          maxWidth: '1400px', margin: '0 auto',
          height: '56px', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between',
        }}>
          {/* Left: Logo + dept name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', background: '#FFB81C',
              borderRadius: '10px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '18px',
            }}>
              🧪
            </div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '14px', lineHeight: '1' }}>
                {user?.departments?.name || 'Department'} Dashboard
              </div>
              <div style={{ fontSize: '10px', color: '#DDD6FE' }}>
                Live Results Feed
              </div>
            </div>
          </div>

          {/* Right: Clock + notifications + avatar + logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

            {/* Live clock */}
            <div style={{
              fontSize: '13px', fontWeight: '700',
              background: 'rgba(255,255,255,0.15)',
              padding: '4px 12px', borderRadius: '20px',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              🕐 {format(clock, 'HH:mm:ss')}
            </div>

            {/* Date filter */}
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              style={{
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '8px', padding: '4px 8px',
                fontSize: '12px', background: 'rgba(255,255,255,0.15)',
                color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
              }}
            />

            {/* Notification bell */}
            <NotificationBell departmentId={user?.department_id} />

            {/* Avatar */}
            <div style={{
              width: '32px', height: '32px',
              borderRadius: '50%', background: '#FFB81C',
              color: '#6B21A8', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontWeight: '800', fontSize: '12px',
              border: '2px solid rgba(255,255,255,0.4)',
            }}>
              {initials}
            </div>

            {/* Logout button */}
            <button
              onClick={logout}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: '#fff', borderRadius: '8px',
                padding: '5px 12px', fontSize: '12px',
                fontWeight: '600', cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px 16px' }}>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px',
                      flexWrap: 'wrap' }}>
          {[
            { label: 'Total Today',  val: stats.total       || 0, icon: '🧪', col: '#7C3AED' },
            { label: 'Pending',      val: stats.pending     || 0, icon: '⏳', col: '#6B7280' },
            { label: 'In Progress',  val: stats.in_progress || 0, icon: '🔬', col: '#EA580C' },
            { label: 'Complete',     val: stats.complete    || 0, icon: '✅', col: '#16A34A' },
            { label: 'Out of Spec',  val: stats.out_of_spec || 0, icon: '⚠️', col: '#DC2626' },
          ].map(s => (
            <div key={s.label} style={{
              flex: 1, minWidth: '100px',
              background: '#fff', borderRadius: '12px',
              border: `2px solid ${s.col}22`,
              padding: '10px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '20px' }}>{s.icon}</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: s.col }}>
                {s.val}
              </div>
              <div style={{ fontSize: '10px', color: '#6B7280', fontWeight: '600' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Last updated */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px',
                      marginBottom: '12px' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: '#16A34A', animation: 'pulse 2s infinite',
          }} />
          <span style={{ fontSize: '12px', color: '#6B7280' }}>
            Live • Last updated: {format(lastUpd, 'HH:mm:ss')}
          </span>
        </div>

        {/* ── Results Table ── */}
        {loading ? (
          <LoadingSpinner text="Loading live results..." />
        ) : filteredRows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9CA3AF' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📊</div>
            <p style={{ fontWeight: '600' }}>No results submitted yet</p>
            <p style={{ fontSize: '13px', marginTop: '4px' }}>
              Results will appear here as analysts submit them
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: '16px',
                        boxShadow: '0 2px 12px rgba(107,33,168,0.08)',
                        border: '1.5px solid #E9D5FF' }}>
            <table style={{
              width: '100%', borderCollapse: 'collapse',
              background: '#fff', fontSize: '13px',
            }}>
              <thead>
                <tr style={{
                  background: 'linear-gradient(135deg, #6B21A8, #7C3AED)',
                  color: '#fff',
                }}>
                  <th style={thSt}>Sample Name</th>
                  <th style={thSt}>Sample No.</th>
                  <th style={thSt}>Time Registered</th>
                  {/* Dynamic parameter columns */}
                  {filteredRows[0]?.parameters
                    .sort((a,b) => (a.tests?.display_order||0) - (b.tests?.display_order||0))
                    .map(p => (
                    <th key={p.id} style={thSt}>
                      <div>{p.tests?.name}</div>
                      <div style={{ fontSize: '10px', color: '#DDD6FE', fontWeight: '400' }}>
                        {p.tests?.unit || '—'}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((row, rowIdx) => {
                  const clean = rowIsClean(row.parameters);
                  const sorted = [...row.parameters].sort(
                    (a,b) => (a.tests?.display_order||0) - (b.tests?.display_order||0)
                  );
                  return (
                    <tr
                      key={row.sample?.id || rowIdx}
                      style={{
                        background: clean
                          ? 'rgba(22,163,74,0.04)'
                          : 'rgba(220,38,38,0.04)',
                        borderBottom: '1px solid #F3E8FF',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = clean
                          ? 'rgba(22,163,74,0.12)'
                          : 'rgba(220,38,38,0.12)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = clean
                          ? 'rgba(22,163,74,0.04)'
                          : 'rgba(220,38,38,0.04)';
                      }}
                    >
                      {/* Sample name */}
                      <td style={tdSt}>
                        <div style={{ fontWeight: '600', color: '#1F2937' }}>
                          {row.sample?.sample_name}
                        </div>
                        {row.sample?.brands?.name && (
                          <div style={{
                            fontSize: '11px', color: '#7C3AED',
                            background: '#F5F3FF', padding: '1px 6px',
                            borderRadius: '10px', display: 'inline-block',
                            marginTop: '2px',
                          }}>
                            {row.sample.brands.name}
                          </div>
                        )}
                        {/* Out of spec indicator */}
                        {!clean && (
                          <div style={{
                            fontSize: '10px', color: '#DC2626',
                            fontWeight: '700', marginTop: '2px',
                          }}>
                            ⚠️ Out of Spec
                          </div>
                        )}
                      </td>

                      {/* Sample number */}
                      <td style={{ ...tdSt, fontFamily: 'monospace',
                                   fontSize: '11px', color: '#6B21A8' }}>
                        {row.sample?.sample_number}
                      </td>

                      {/* Time registered */}
                      <td style={{ ...tdSt, fontSize: '11px', color: '#6B7280' }}>
                        {row.sample?.registered_at
                          ? format(new Date(row.sample.registered_at), 'HH:mm')
                          : '—'}
                      </td>

                      {/* Parameter result cells */}
                      {sorted.map(p => {
                        const c = cellColor(p.result_status);
                        return (
                          <td key={p.id} style={{
                            ...tdSt, textAlign: 'center', padding: '8px',
                          }}>
                            {p.result_value ? (
                              <div>
                                {/* Result value */}
                                <div style={{
                                  display: 'inline-block',
                                  background: c.bg,
                                  color: c.text,
                                  border: `1px solid ${c.border}`,
                                  borderRadius: '6px',
                                  padding: '3px 8px',
                                  fontWeight: '700',
                                  fontSize: '13px',
                                }}>
                                  {p.result_value}
                                </div>
                                {/* Remarks badge */}
                                {p.remarks && (
                                  <div style={{
                                    fontSize: '10px', fontWeight: '700',
                                    color: c.text, marginTop: '2px',
                                  }}>
                                    {p.remarks}
                                  </div>
                                )}
                                {/* Submission time */}
                                {p.submitted_at && (
                                  <div style={{
                                    fontSize: '10px', color: '#9CA3AF',
                                    marginTop: '2px',
                                  }}>
                                    {format(new Date(p.submitted_at), 'HH:mm')}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: '#D1D5DB', fontSize: '18px' }}>—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <PageFooter />
    </div>
  );
}


const thSt = {
  padding: '12px 14px', textAlign: 'left',
  fontWeight: '700', fontSize: '12px',
  whiteSpace: 'nowrap', letterSpacing: '0.3px',
};
const tdSt = {
  padding: '10px 14px', verticalAlign: 'top',
};