import React, { useState, useEffect, useCallback } from 'react';
import PageFooter           from '../components/PageFooter';
import NotificationBell     from '../components/NotificationBell';
import LoadingSpinner       from '../components/LoadingSpinner';
import { useAuth }          from '../context/AuthContext';
import { dashboardService } from '../services/dashboard.service';
import { supabase }         from '../services/supabase';
import { format }           from 'date-fns';

export default function DeptDashboardPage() {
  const { user, logout }   = useAuth();
  const [results,   setResults]   = useState([]);
  const [stats,     setStats]     = useState({});
  const [loading,   setLoading]   = useState(true);
  const [clock,     setClock]     = useState(new Date());
  const [lastUpd,   setLastUpd]   = useState(new Date());
  const [fromDate,  setFromDate]  = useState(format(new Date(),'yyyy-MM-dd'));
  const [toDate,    setToDate]    = useState(format(new Date(),'yyyy-MM-dd'));
  const [useRange,  setUseRange]  = useState(false);

  // Live clock — updates every second
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
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
      osc.start(); osc.stop(ctx.currentTime + 1.5);
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
      .channel('dept_live_v2')
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

  // Filter results by date range
  const today = format(new Date(), 'yyyy-MM-dd');
  const filteredResults = results.filter(r => {
    const regDate = r.registered_samples?.registered_at?.substring(0,10);
    if (!regDate) return false;
    if (useRange) {
      return regDate >= fromDate && regDate <= toDate;
    }
    return regDate === fromDate;
  });

  // Group by sample
  const sampleMap = {};
  for (const r of filteredResults) {
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

  // Get all unique test names across all samples (for column headers)
  const allTestNames = [];
  const seenTests = new Set();
  for (const row of sampleRows) {
    const sorted = [...row.parameters].sort(
      (a,b) => (a.tests?.display_order||0) - (b.tests?.display_order||0)
    );
    for (const p of sorted) {
      const key = p.tests?.name;
      if (key && !seenTests.has(key)) {
        seenTests.add(key);
        allTestNames.push({ name: key, unit: p.tests?.unit || '' });
      }
    }
  }

  const cellColor = (status) => ({
    pass     : { bg: '#F0FDF4', text: '#16A34A', border: '#86EFAC' },
    fail_low : { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
    fail_high: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
    text_ok  : { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
    ok       : { bg: '#F0FDF4', text: '#16A34A', border: '#86EFAC' },
  })[status] || { bg: '#F9FAFB', text: '#374151', border: '#E5E7EB' };

  const rowIsClean = (params) =>
    params.every(p =>
      !p.result_value ||
      ['pass','ok','text_ok'].includes(p.result_status)
    );

  // Avatar initials
  const initials = (user?.full_name || '?')
    .split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();

  const inputSt = {
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: '8px', padding: '4px 8px',
    fontSize: '12px',
    background: 'rgba(255,255,255,0.15)',
    color: '#fff', cursor: 'pointer',
    fontFamily: 'inherit',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FAF5FF', paddingBottom: '60px' }}>

      {/* ── Purple Header ── */}
      <header style={{
        background: 'linear-gradient(135deg, #6B21A8 0%, #7C3AED 100%)',
        color: '#fff',
        boxShadow: '0 2px 12px rgba(107,33,168,0.4)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{
          maxWidth: '1600px', margin: '0 auto',
          padding: '0 16px', minHeight: '56px',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexWrap: 'wrap',
          gap: '8px',
        }}>
          {/* Left */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', background: '#FFB81C',
              borderRadius: '10px', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: '18px',
            }}>🧪</div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '14px' }}>
                {user?.departments?.name || 'Department'} Live Dashboard
              </div>
              <div style={{ fontSize: '10px', color: '#DDD6FE' }}>
                Real-time Results Feed
              </div>
            </div>
          </div>

          {/* Right */}
          <div style={{ display: 'flex', alignItems: 'center',
                        gap: '10px', flexWrap: 'wrap' }}>

            {/* Live clock */}
            <div style={{
              fontSize: '14px', fontWeight: '800',
              background: 'rgba(255,255,255,0.15)',
              padding: '5px 14px', borderRadius: '20px',
              display: 'flex', alignItems: 'center', gap: '6px',
              fontFamily: 'monospace',
            }}>
              🕐 {format(clock, 'HH:mm:ss')}
            </div>

            {/* Date range toggle */}
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={() => setUseRange(false)}
                style={{
                  ...inputSt,
                  background: !useRange ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)',
                  fontWeight: '600',
                }}>
                Single Day
              </button>
              <button onClick={() => setUseRange(true)}
                style={{
                  ...inputSt,
                  background: useRange ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)',
                  fontWeight: '600',
                }}>
                Range
              </button>
            </div>

            {/* From date */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#DDD6FE' }}>
                {useRange ? 'From:' : 'Date:'}
              </span>
              <input type="date" value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                style={inputSt} />
            </div>

            {/* To date */}
            {useRange && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: '#DDD6FE' }}>To:</span>
                <input type="date" value={toDate} min={fromDate}
                  onChange={e => setToDate(e.target.value)}
                  style={inputSt} />
              </div>
            )}

            {/* Quick filters */}
            {[
              { label: 'Today',    from: today, to: today },
              { label: '7 Days',
                from: format(new Date(Date.now()-6*86400000),'yyyy-MM-dd'),
                to: today },
            ].map(q => (
              <button key={q.label}
                onClick={() => {
                  setFromDate(q.from); setToDate(q.to);
                  setUseRange(q.from !== q.to);
                }}
                style={{
                  ...inputSt, fontWeight: '600',
                  background: 'rgba(255,184,28,0.25)',
                  color: '#FFB81C',
                }}>
                {q.label}
              </button>
            ))}

            <NotificationBell departmentId={user?.department_id} />

            {/* Avatar */}
            <div style={{
              width: '32px', height: '32px',
              borderRadius: '50%', background: '#FFB81C',
              color: '#6B21A8', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontWeight: '800', fontSize: '12px',
              border: '2px solid rgba(255,255,255,0.4)',
            }}>{initials}</div>

            {/* Logout */}
            <button onClick={logout} style={{
              ...inputSt, fontWeight: '600',
              color: '#fff', cursor: 'pointer',
            }}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1600px', margin: '0 auto', padding: '16px' }}>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '10px',
                      marginBottom: '16px', flexWrap: 'wrap' }}>
          {[
            { label: 'Total',       val: stats.total       ||0, icon:'🧪', col:'#7C3AED'},
            { label: 'Pending',     val: stats.pending     ||0, icon:'⏳', col:'#6B7280'},
            { label: 'In Progress', val: stats.in_progress ||0, icon:'🔬', col:'#EA580C'},
            { label: 'Complete',    val: stats.complete    ||0, icon:'✅', col:'#16A34A'},
            { label: 'Out of Spec', val: stats.out_of_spec ||0, icon:'⚠️', col:'#DC2626'},
          ].map(s => (
            <div key={s.label} style={{
              flex:1, minWidth:'90px',
              background:'#fff', borderRadius:'12px',
              border:`2px solid ${s.col}22`,
              padding:'10px', textAlign:'center',
            }}>
              <div style={{fontSize:'18px'}}>{s.icon}</div>
              <div style={{fontSize:'20px',fontWeight:'800',color:s.col}}>{s.val}</div>
              <div style={{fontSize:'10px',color:'#6B7280',fontWeight:'600'}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Live indicator + last update */}
        <div style={{ display:'flex', alignItems:'center',
                      gap:'8px', marginBottom:'12px' }}>
          <div style={{
            width:'8px', height:'8px', borderRadius:'50%',
            background:'#16A34A', boxShadow:'0 0 6px #16A34A',
          }} />
          <span style={{ fontSize:'12px', color:'#6B7280' }}>
            Live • Updated: {format(lastUpd,'HH:mm:ss')}
            {' '}• Showing: {useRange
              ? `${fromDate} to ${toDate}`
              : fromDate === today ? 'Today' : fromDate}
            {' '}• {sampleRows.length} sample(s)
          </span>
        </div>

        {/* ── Results Table ── */}
        {loading ? (
          <LoadingSpinner text="Loading live results..." />
        ) : sampleRows.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px', color:'#9CA3AF' }}>
            <div style={{fontSize:'48px',marginBottom:'12px'}}>📊</div>
            <p style={{fontWeight:'600'}}>No results for this period</p>
            <p style={{fontSize:'13px'}}>
              Results will appear instantly as analysts submit them
            </p>
          </div>
        ) : (
          <div style={{
            overflowX:'auto', borderRadius:'16px',
            boxShadow:'0 2px 12px rgba(107,33,168,0.08)',
            border:'1.5px solid #E9D5FF',
          }}>
            <table style={{
              width:'100%', borderCollapse:'collapse',
              background:'#fff', fontSize:'12px',
              minWidth:'800px',
            }}>
              <thead>
                <tr style={{
                  background:'linear-gradient(135deg,#6B21A8,#7C3AED)',
                  color:'#fff',
                }}>
                  {/* Fixed columns */}
                  <th style={thSt}>Sample Name</th>
                  <th style={thSt}>Sample No.</th>
                  <th style={thSt}>
                    Registered
                    <div style={{fontSize:'10px',color:'#DDD6FE',fontWeight:'400'}}>
                      Date & Time
                    </div>
                  </th>
                  <th style={thSt}>Sampler</th>

                  {/* Dynamic parameter columns */}
                  {allTestNames.map(t => (
                    <th key={t.name} style={thSt}>
                      <div>{t.name}</div>
                      {t.unit && (
                        <div style={{fontSize:'10px',color:'#DDD6FE',fontWeight:'400'}}>
                          ({t.unit})
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {sampleRows.map((row, idx) => {
                  const clean = rowIsClean(row.parameters);

                  // Map parameters by test name for easy column lookup
                  const paramByTest = {};
                  for (const p of row.parameters) {
                    if (p.tests?.name) paramByTest[p.tests.name] = p;
                  }

                  return (
                    <tr key={row.sample?.id || idx}
                      style={{
                        background: clean
                          ? 'rgba(22,163,74,0.03)'
                          : 'rgba(220,38,38,0.03)',
                        borderBottom: '1px solid #F3E8FF',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = clean
                          ? 'rgba(22,163,74,0.10)'
                          : 'rgba(220,38,38,0.10)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = clean
                          ? 'rgba(22,163,74,0.03)'
                          : 'rgba(220,38,38,0.03)';
                      }}
                    >
                      {/* Sample name */}
                      <td style={tdSt}>
                        <div style={{fontWeight:'700',color:'#1F2937',fontSize:'13px'}}>
                          {row.sample?.sample_name}
                        </div>
                        {row.sample?.brands?.name && (
                          <div style={{
                            fontSize:'10px',color:'#7C3AED',
                            background:'#F5F3FF',padding:'1px 6px',
                            borderRadius:'10px',display:'inline-block',
                            marginTop:'2px',
                          }}>
                            {row.sample.brands.name}
                          </div>
                        )}
                        {row.sample?.sample_subtypes?.name && (
                          <div style={{
                            fontSize:'10px',color:'#6B7280',
                            background:'#F3F4F6',padding:'1px 6px',
                            borderRadius:'10px',display:'inline-block',
                            marginTop:'2px',marginLeft:'4px',
                          }}>
                            {row.sample.sample_subtypes.name}
                          </div>
                        )}
                        {!clean && (
                          <div style={{
                            fontSize:'10px',color:'#DC2626',
                            fontWeight:'700',marginTop:'3px',
                          }}>
                            ⚠️ Out of Spec
                          </div>
                        )}
                      </td>

                      {/* Sample number */}
                      <td style={{
                        ...tdSt, fontFamily:'monospace',
                        fontSize:'11px', color:'#6B21A8',
                        whiteSpace:'nowrap',
                      }}>
                        {row.sample?.sample_number}
                      </td>

                      {/* Registration date AND time */}
                      <td style={{...tdSt, whiteSpace:'nowrap'}}>
                        {row.sample?.registered_at ? (
                          <div>
                            <div style={{
                              fontSize:'12px', fontWeight:'600',
                              color:'#374151',
                            }}>
                              {format(new Date(row.sample.registered_at),'dd MMM yyyy')}
                            </div>
                            <div style={{
                              fontSize:'11px', color:'#7C3AED',
                              fontWeight:'700',
                            }}>
                              🕐 {format(new Date(row.sample.registered_at),'HH:mm:ss')}
                            </div>
                          </div>
                        ) : '—'}
                      </td>

                      {/* Sampler */}
                      <td style={{...tdSt, fontSize:'11px', color:'#6B7280'}}>
                        {row.sample?.sampler_name || '—'}
                      </td>

                      {/* Parameter result cells — one per test column */}
                      {allTestNames.map(t => {
                        const p = paramByTest[t.name];
                        if (!p) {
                          return (
                            <td key={t.name} style={{
                              ...tdSt, textAlign:'center',
                              color:'#E5E7EB', fontSize:'18px',
                            }}>—</td>
                          );
                        }
                        const c = cellColor(p.result_status);
                        return (
                          <td key={t.name} style={{
                            ...tdSt, textAlign:'center', padding:'8px 6px',
                          }}>
                            {p.result_value ? (
                              <div>
                                {/* Result value bubble */}
                                <div style={{
                                  display:'inline-block',
                                  background: c.bg,
                                  color: c.text,
                                  border:`1.5px solid ${c.border}`,
                                  borderRadius:'8px',
                                  padding:'4px 10px',
                                  fontWeight:'800',
                                  fontSize:'13px',
                                }}>
                                  {p.result_value}
                                </div>

                                {/* Remarks */}
                                {p.remarks && (
                                  <div style={{
                                    fontSize:'10px',
                                    fontWeight:'700',
                                    color: c.text,
                                    marginTop:'2px',
                                  }}>
                                    {p.remarks}
                                  </div>
                                )}

                                {/* Result submission DATE + TIME */}
                                {p.submitted_at && (
                                  <div style={{
                                    fontSize:'10px',
                                    color:'#9CA3AF',
                                    marginTop:'3px',
                                    whiteSpace:'nowrap',
                                  }}>
                                    {format(new Date(p.submitted_at),'dd/MM')}
                                    {' '}
                                    <span style={{
                                      color:'#7C3AED',
                                      fontWeight:'600',
                                    }}>
                                      {format(new Date(p.submitted_at),'HH:mm')}
                                    </span>
                                  </div>
                                )}

                                {/* Analyst signature */}
                                {p.analyst_signature && (
                                  <div style={{
                                    fontSize:'9px',
                                    color:'#C4B5FD',
                                    marginTop:'1px',
                                  }}>
                                    ✍️ {p.analyst_signature.split(' ')[0]}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span style={{color:'#D1D5DB',fontSize:'16px'}}>—</span>
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
  padding: '12px 10px', textAlign: 'left',
  fontWeight: '700', fontSize: '12px',
  whiteSpace: 'nowrap', letterSpacing: '0.3px',
  borderRight: '1px solid rgba(255,255,255,0.1)',
};
const tdSt = {
  padding: '10px 10px', verticalAlign: 'top',
  borderRight: '1px solid #F3E8FF',
};