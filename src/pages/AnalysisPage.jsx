// ============================================================
// FILE: frontend/bul-qc-app/src/pages/AnalysisPage.jsx
// Complete rewrite — handles sample loading and result entry
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar      from '../components/Navbar';
import PageFooter  from '../components/PageFooter';
import { useAuth } from '../context/AuthContext';
import api         from '../services/api';
import { toast }   from 'react-toastify';

const P  = '#6B21A8';
const PM = '#7C3AED';
const PL = '#EDE9FE';
const G  = '#FFB81C';

export default function AnalysisPage() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { user, signingAs } = useAuth();

  const [sample,      setSample]      = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [tests,       setTests]       = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [step,        setStep]        = useState('confirm'); // 'confirm' | 'enter'
  const [results,     setResults]     = useState({});
  const [analyst,     setAnalyst]     = useState(signingAs || '');
  const [submitting,  setSubmitting]  = useState(false);
  const [staffList,   setStaffList]   = useState([]);

  // ── Load sample ─────────────────────────────────────────
  const loadSample = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/samples/${id}`);
      const s   = res.data?.sample || res.data;

      if (!s || !s.id) {
        setError('Sample not found. It may have been deleted.');
        return;
      }

      setSample(s);

      // If tests already assigned, go straight to entry
      const assigned = s.sample_test_assignments || [];
      if (assigned.length > 0) {
        setStep('enter');
        // Build initial results state
        const init = {};
        assigned.forEach(a => {
          init[a.id] = {
            value  : a.result_value  || '',
            analyst: a.analyst_signature || signingAs || '',
            locked : a.is_locked || false,
            editCount: a.edit_count || 0,
            submitted: !!a.result_value,
            status : a.result_status || '',
            remarks: a.remarks || '',
          };
        });
        setResults(init);
      }

      // Load available tests for this sample type
      if (s.sample_types?.id) {
        try {
          const tRes = await api.get(`/lookup/tests/${s.sample_types.id}`);
          const tData = tRes.data?.tests || [];
          setTests(tData);
          // Pre-select all tests
          setSelectedIds(tData.map(t => t.id));
        } catch(e) {
          console.error('Failed to load tests:', e.message);
        }
      }

    } catch (err) {
      console.error('loadSample error:', err);
      const msg = err.response?.data?.error || err.message || 'Failed to load sample';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [id, signingAs]);

  useEffect(() => { loadSample(); }, [loadSample]);

  // Load staff for analyst dropdown
  useEffect(() => {
    api.get('/lookup/staff').then(res => {
      setStaffList(res.data?.staff || []);
    }).catch(() => {});
  }, []);

  // ── Confirm test selection ───────────────────────────────
  const confirmTests = async () => {
    if (selectedIds.length === 0) {
      toast.warning('Select at least one test'); return;
    }
    try {
      await api.post('/samples/assign-tests', {
        sample_id: id,
        test_ids : selectedIds,
      });
      await loadSample();
      setStep('enter');
      toast.success('Tests confirmed. Enter results below.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to confirm tests');
    }
  };

  // ── Evaluate a result against specs ─────────────────────
  const evaluateResult = (value, assignment) => {
    const spec = assignment.tests?.test_specifications?.[0];
    const rt   = assignment.tests?.result_type;

    if (!value?.trim()) return { status: null, remarks: '', action: '' };

    // Text results (Spatter, Impurities)
    if (rt === 'text') {
      const v = value.trim().toLowerCase();
      if (v === 'negative' || v === 'nil') {
        return { status: 'ok', remarks: 'OK', action: 'Pass' };
      }
      if (v === 'positive' || v === 'traces') {
        return { status: 'fail_high', remarks: 'FAIL', action: 'Reject' };
      }
      return { status: 'text_ok', remarks: 'OK', action: 'Pass' };
    }

    // Numeric results
    const num = parseFloat(value);
    if (isNaN(num)) return { status: 'text_ok', remarks: 'OK', action: 'Pass' };

    if (!spec) return { status: 'pass', remarks: 'OK', action: 'Pass' };

    if (spec.min_value !== null && num < spec.min_value) {
      return { status: 'fail_low',  remarks: 'LOW',  action: 'Adjust' };
    }
    if (spec.max_value !== null && num > spec.max_value) {
      return { status: 'fail_high', remarks: 'HIGH', action: 'Adjust' };
    }
    return { status: 'pass', remarks: 'OK', action: 'Pass' };
  };

  // ── Submit a single result ───────────────────────────────
  const submitResult = async (assignmentId, assignment) => {
    const r = results[assignmentId];
    if (!r?.value?.trim()) {
      toast.warning('Enter a result value first'); return;
    }
    if (!analyst.trim()) {
      toast.warning('Select your name as the analyst'); return;
    }
    if (r.locked) {
      toast.error('This result is locked and cannot be edited further'); return;
    }

    const evaluated = evaluateResult(r.value, assignment);

    setSubmitting(true);
    try {
      await api.put(`/results/${assignmentId}`, {
        result_value      : r.value.trim(),
        analyst_signature : analyst.trim(),
        result_status     : evaluated.status,
        remarks           : evaluated.remarks,
        action            : evaluated.action,
        submitted_at      : new Date().toISOString(),
      });

      // Update local state
      setResults(prev => ({
        ...prev,
        [assignmentId]: {
          ...prev[assignmentId],
          submitted : true,
          status    : evaluated.status,
          remarks   : evaluated.remarks,
          editCount : (prev[assignmentId].editCount || 0) + 1,
        },
      }));

      const isOOS = evaluated.status === 'fail_low' || evaluated.status === 'fail_high';
      toast[isOOS ? 'error' : 'success'](
        isOOS ? `⚠️ ${assignment.tests?.name}: ${evaluated.remarks}` : `✅ ${assignment.tests?.name}: ${evaluated.remarks}`
      );

      // Reload to get latest status
      await loadSample();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit result');
    } finally {
      setSubmitting(false); }
  };

  // ── Result colour ────────────────────────────────────────
  const getResultColor = (status) => ({
    pass      : { bg:'#F0FDF4', border:'#86EFAC', text:'#15803D' },
    fail_low  : { bg:'#FEF2F2', border:'#FECACA', text:'#DC2626' },
    fail_high : { bg:'#FEF2F2', border:'#FECACA', text:'#DC2626' },
    ok        : { bg:'#F0FDF4', border:'#86EFAC', text:'#15803D' },
    text_ok   : { bg:'#EFF6FF', border:'#BFDBFE', text:'#1D4ED8' },
  })[status] || { bg:'#fff', border:PL, text:'#111827' };

  // ── Status badge ─────────────────────────────────────────
  const StatusBadge = ({ status }) => {
    const colours = {
      pending    : { bg:'#F3F4F6', text:'#6B7280' },
      in_progress: { bg:'#FFF7ED', text:'#EA580C' },
      complete   : { bg:'#F0FDF4', text:'#16A34A' },
    };
    const c = colours[status] || colours.pending;
    return (
      <span style={{ padding:'3px 10px', borderRadius:'10px', fontSize:'12px', fontWeight:'700', background:c.bg, color:c.text }}>
        {status?.replace('_',' ').toUpperCase()}
      </span>
    );
  };

  const inp = {
    border:`1.5px solid ${PL}`, borderRadius:'8px',
    padding:'9px 12px', fontSize:'14px',
    fontFamily:'inherit', background:'#fff',
    color:'#111827', cursor:'text', outline:'none',
    boxSizing:'border-box',
  };

  // ── RENDER ───────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:'#FAF5FF', paddingBottom:'60px' }}>
      <Navbar />

      <div style={{ maxWidth:'800px', margin:'0 auto', padding:'20px 16px' }}>

        {/* Back button */}
        <button onClick={() => navigate('/dashboard')} style={{
          display:'flex', alignItems:'center', gap:'8px',
          padding:'8px 14px', border:`1.5px solid ${PL}`,
          borderRadius:'10px', background:'#fff',
          cursor:'pointer', fontSize:'13px', fontWeight:'600',
          color:P, marginBottom:'16px', fontFamily:'inherit',
        }}>
          ← Back to Dashboard
        </button>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign:'center', padding:'80px' }}>
            <div style={{ fontSize:'40px', marginBottom:'12px' }}>🔬</div>
            <p style={{ color:PM, fontWeight:'600' }}>Loading sample...</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{
            background:'#FEF2F2', border:'1.5px solid #FECACA',
            borderRadius:'14px', padding:'24px', textAlign:'center',
          }}>
            <div style={{ fontSize:'40px', marginBottom:'12px' }}>⚠️</div>
            <p style={{ color:'#DC2626', fontWeight:'700', fontSize:'15px' }}>{error}</p>
            <button onClick={loadSample} style={{
              marginTop:'16px', padding:'10px 20px',
              background:PM, color:'#fff', border:'none',
              borderRadius:'10px', cursor:'pointer',
              fontFamily:'inherit', fontWeight:'600',
            }}>
              Try Again
            </button>
          </div>
        )}

        {/* Sample loaded */}
        {!loading && !error && sample && (
          <>
            {/* Sample info card */}
            <div style={{
              background:'#fff', borderRadius:'16px',
              border:`1.5px solid ${PL}`, padding:'20px',
              marginBottom:'16px',
              boxShadow:'0 2px 8px rgba(107,33,168,0.06)',
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'8px' }}>
                <div>
                  <h2 style={{ fontSize:'18px', fontWeight:'800', color:'#1F2937', margin:'0 0 4px' }}>
                    {sample.sample_name}
                  </h2>
                  <p style={{ fontSize:'12px', color:PM, fontFamily:'monospace', margin:'0 0 6px', fontWeight:'700' }}>
                    {sample.sample_number}
                  </p>
                  <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                    <StatusBadge status={sample.status} />
                    {sample.sample_types?.name && (
                      <span style={{ padding:'3px 10px', borderRadius:'10px', fontSize:'12px', fontWeight:'600', background:'#F5F3FF', color:PM }}>
                        {sample.sample_types.name}
                      </span>
                    )}
                    {sample.brands?.name && (
                      <span style={{ padding:'3px 10px', borderRadius:'10px', fontSize:'12px', fontWeight:'600', background:'#FFF7ED', color:'#EA580C' }}>
                        {sample.brands.name}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign:'right', fontSize:'12px', color:'#6B7280' }}>
                  {sample.registered_at && (
                    <>
                      <div>{new Date(sample.registered_at).toLocaleDateString()}</div>
                      <div style={{ fontWeight:'700', color:PM }}>
                        {new Date(sample.registered_at).toLocaleTimeString()}
                      </div>
                    </>
                  )}
                  {sample.sampler_name && (
                    <div style={{ marginTop:'4px' }}>Sampler: {sample.sampler_name}</div>
                  )}
                </div>
              </div>
            </div>

            {/* STEP 1: Confirm tests */}
            {step === 'confirm' && (
              <div style={{ background:'#fff', borderRadius:'16px', border:`1.5px solid ${PL}`, padding:'20px' }}>
                <h3 style={{ fontSize:'16px', fontWeight:'800', color:'#1F2937', marginBottom:'4px' }}>
                  Step 1 — Select Tests to Perform
                </h3>
                <p style={{ fontSize:'13px', color:'#6B7280', marginBottom:'16px' }}>
                  Tick the tests required for this sample then click Confirm.
                </p>

                {tests.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'40px', color:'#9CA3AF' }}>
                    <p>No tests found for this sample type.</p>
                    <p style={{ fontSize:'12px', marginTop:'4px' }}>
                      Make sure tests are configured in the database for{' '}
                      <strong>{sample.sample_types?.name}</strong>.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Select all */}
                    <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
                      <button type="button"
                        onClick={() => setSelectedIds(tests.map(t => t.id))}
                        style={{ padding:'6px 14px', border:`1.5px solid ${PL}`, borderRadius:'8px', background:'#F5F3FF', color:P, fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>
                        Select All
                      </button>
                      <button type="button"
                        onClick={() => setSelectedIds([])}
                        style={{ padding:'6px 14px', border:'1.5px solid #E5E7EB', borderRadius:'8px', background:'#F9FAFB', color:'#6B7280', fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>
                        Clear All
                      </button>
                    </div>

                    <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'20px' }}>
                      {tests.map(test => {
                        const spec = test.test_specifications?.[0];
                        const specStr = spec?.display_spec
                          ? `(${spec.display_spec}) ${test.unit || ''}`
                          : spec?.min_value !== undefined
                            ? `(${spec.min_value} – ${spec.max_value}) ${test.unit || ''}`
                            : test.unit || '';

                        return (
                          <label key={test.id} style={{
                            display:'flex', alignItems:'center', gap:'12px',
                            padding:'12px 14px', borderRadius:'10px',
                            border: selectedIds.includes(test.id)
                              ? `1.5px solid ${PM}` : `1.5px solid #E5E7EB`,
                            background: selectedIds.includes(test.id) ? '#F5F3FF' : '#FAFAFA',
                            cursor:'pointer',
                          }}>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(test.id)}
                              onChange={e => {
                                if (e.target.checked) {
                                  setSelectedIds(prev => [...prev, test.id]);
                                } else {
                                  setSelectedIds(prev => prev.filter(x => x !== test.id));
                                }
                              }}
                              style={{ width:'18px', height:'18px', cursor:'pointer', accentColor:PM }}
                            />
                            <div style={{ flex:1 }}>
                              <div style={{ fontWeight:'700', color:'#1F2937', fontSize:'14px' }}>
                                {test.name}
                              </div>
                              {specStr && (
                                <div style={{ fontSize:'12px', color:PM, marginTop:'2px' }}>
                                  Spec: {specStr}
                                </div>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>

                    <button onClick={confirmTests} disabled={selectedIds.length === 0}
                      style={{
                        width:'100%', padding:'14px',
                        background: selectedIds.length === 0 ? '#A78BFA' : `linear-gradient(135deg,${P},${PM})`,
                        color:'#fff', border:'none', borderRadius:'12px',
                        fontSize:'15px', fontWeight:'700',
                        cursor: selectedIds.length === 0 ? 'not-allowed' : 'pointer',
                        fontFamily:'inherit',
                      }}>
                      ✅ Confirm {selectedIds.length} Test(s) and Enter Results
                    </button>
                  </>
                )}
              </div>
            )}

            {/* STEP 2: Enter results */}
            {step === 'enter' && (
              <div style={{ background:'#fff', borderRadius:'16px', border:`1.5px solid ${PL}`, padding:'20px' }}>
                <h3 style={{ fontSize:'16px', fontWeight:'800', color:'#1F2937', marginBottom:'4px' }}>
                  Step 2 — Enter Test Results
                </h3>
                <p style={{ fontSize:'13px', color:'#6B7280', marginBottom:'16px' }}>
                  Enter each result and click Submit. Results are colour-coded automatically.
                </p>

                {/* Analyst selector */}
                <div style={{ marginBottom:'20px' }}>
                  <label style={{ display:'block', fontSize:'12px', fontWeight:'700', color:'#4C1D95', marginBottom:'5px' }}>
                    Analyst Signature *
                  </label>
                  <select value={analyst} onChange={e => setAnalyst(e.target.value)}
                    style={{ ...inp, width:'100%', cursor:'pointer' }}>
                    <option value="">— Select your name —</option>
                    {staffList.map(s => (
                      <option key={s.id} value={s.full_name}>{s.full_name}</option>
                    ))}
                    {signingAs && !staffList.find(s => s.full_name === signingAs) && (
                      <option value={signingAs}>{signingAs}</option>
                    )}
                  </select>
                </div>

                {/* Result rows */}
                <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                  {(sample.sample_test_assignments || [])
                    .sort((a,b) => (a.tests?.display_order||0) - (b.tests?.display_order||0))
                    .map(assignment => {
                      const r   = results[assignment.id] || {};
                      const cs  = r.submitted ? getResultColor(r.status) : { bg:'#fff', border:PL, text:'#111827' };
                      const spec = assignment.tests?.test_specifications?.[0];
                      const specStr = spec?.display_spec
                        ? `(${spec.display_spec})`
                        : spec?.min_value !== undefined
                          ? `(${spec.min_value} – ${spec.max_value})`
                          : '';

                      return (
                        <div key={assignment.id} style={{
                          border: `2px solid ${cs.border}`,
                          borderRadius:'12px',
                          background: cs.bg,
                          padding:'14px 16px',
                          opacity: r.locked ? 0.75 : 1,
                        }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'10px', flexWrap:'wrap', gap:'6px' }}>
                            <div>
                              <div style={{ fontWeight:'800', fontSize:'14px', color:'#1F2937' }}>
                                {assignment.tests?.name}
                              </div>
                              {specStr && (
                                <div style={{ fontSize:'12px', color:G, fontWeight:'700', marginTop:'2px' }}>
                                  Spec: {specStr} {assignment.tests?.unit || ''}
                                </div>
                              )}
                            </div>
                            <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                              {r.submitted && (
                                <span style={{
                                  padding:'3px 10px', borderRadius:'10px',
                                  fontSize:'11px', fontWeight:'800',
                                  background: cs.bg, color: cs.text,
                                  border:`1px solid ${cs.border}`,
                                }}>
                                  {r.remarks}
                                </span>
                              )}
                              {r.locked && (
                                <span style={{ fontSize:'18px' }} title="Locked — max edits reached">🔒</span>
                              )}
                            </div>
                          </div>

                          <div style={{ display:'flex', gap:'8px', alignItems:'flex-end' }}>
                            <div style={{ flex:1 }}>
                              <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'#4C1D95', marginBottom:'4px' }}>
                                Result {assignment.tests?.unit ? `(${assignment.tests.unit})` : ''}
                              </label>
                              <input
                                type="text"
                                value={r.value || ''}
                                onChange={e => setResults(prev => ({
                                  ...prev,
                                  [assignment.id]: { ...prev[assignment.id], value: e.target.value },
                                }))}
                                placeholder={
                                  assignment.tests?.result_type === 'text'
                                    ? 'e.g. Negative / Positive / NIL / Traces'
                                    : `Enter value in ${assignment.tests?.unit || 'units'}`
                                }
                                disabled={r.locked}
                                style={{
                                  ...inp, width:'100%',
                                  borderColor: r.submitted ? cs.border : PL,
                                  background: r.locked ? '#F3F4F6' : '#fff',
                                  cursor: r.locked ? 'not-allowed' : 'text',
                                }}
                              />
                            </div>

                            <button
                              onClick={() => submitResult(assignment.id, assignment)}
                              disabled={submitting || r.locked}
                              style={{
                                padding:'10px 18px',
                                background: r.locked ? '#E5E7EB' : r.submitted ? '#16A34A' : PM,
                                color: r.locked ? '#9CA3AF' : '#fff',
                                border:'none', borderRadius:'10px',
                                fontSize:'13px', fontWeight:'700',
                                cursor: r.locked || submitting ? 'not-allowed' : 'pointer',
                                fontFamily:'inherit', whiteSpace:'nowrap',
                                flexShrink:0,
                              }}
                            >
                              {r.locked ? '🔒 Locked' : r.submitted ? '✏️ Update' : 'Submit'}
                            </button>
                          </div>

                          {r.submitted && assignment.submitted_at && (
                            <div style={{ fontSize:'11px', color:'#9CA3AF', marginTop:'6px' }}>
                              Submitted: {new Date(assignment.submitted_at).toLocaleString()}
                              {assignment.analyst_signature && ` — ${assignment.analyst_signature}`}
                              {r.editCount > 0 && ` — Edits: ${r.editCount}/2`}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>

                {/* Back to test selection */}
                {(sample.sample_test_assignments || []).every(a => !a.result_value) && (
                  <button onClick={() => setStep('confirm')} style={{
                    marginTop:'16px', padding:'10px 16px',
                    border:`1.5px solid ${PL}`, borderRadius:'10px',
                    background:'#fff', color:P, cursor:'pointer',
                    fontFamily:'inherit', fontSize:'13px', fontWeight:'600',
                  }}>
                    ← Change Test Selection
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <PageFooter />
    </div>
  );
}
