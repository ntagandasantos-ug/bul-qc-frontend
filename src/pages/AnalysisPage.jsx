// ============================================================
// FILE: frontend/bul-qc-app/src/pages/AnalysisPage.jsx
// FIX: Update button works, locks after 2 edits
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar          from '../components/Navbar';
import PageFooter      from '../components/PageFooter';
import SampleEditModal from '../components/SampleEditModal';
import { useAuth }     from '../context/AuthContext';
import api             from '../services/api';
import { toast }       from 'react-toastify';

const P  = '#6B21A8';
const PM = '#7C3AED';
const PL = '#EDE9FE';
const G  = '#FFB81C';

export default function AnalysisPage() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { user, signingAs } = useAuth();

  const [sample,       setSample]      = useState(null);
  const [loading,      setLoading]     = useState(true);
  const [error,        setError]       = useState('');
  const [tests,        setTests]       = useState([]);
  const [selectedIds,  setSelectedIds] = useState([]);
  const [step,         setStep]        = useState('confirm');
  const [results,      setResults]     = useState({});
  const [analyst,      setAnalyst]     = useState(signingAs || '');
  const [saving,       setSaving]      = useState({});
  const [savingAll,    setSavingAll]   = useState(false);
  const [staffList,    setStaffList]   = useState([]);
  const [removingTest, setRemovingTest]= useState(null);
  const [showEdit,     setShowEdit]    = useState(false);

  // ── Load sample ─────────────────────────────────────────
  const loadSample = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get(`/samples/${id}`);
      const s   = res.data?.sample || res.data;
      if (!s?.id) { setError('Sample not found.'); return; }
      setSample(s);

      const assigned = s.sample_test_assignments || [];
      if (assigned.length > 0) {
        setStep('enter');
        const init = {};
        assigned.forEach(a => {
          init[a.id] = {
            value    : a.result_value        || '',
            locked   : a.is_locked           || false,
            editCount: a.edit_count          || 0,
            submitted: !!a.result_value,
            status   : a.result_status       || '',
            remarks  : a.remarks             || '',
            subAt    : a.submitted_at        || null,
            analyst  : a.analyst_signature   || '',
          };
        });
        setResults(init);
      }

      if (s.sample_types?.id) {
        const tRes = await api.get(`/lookup/tests/${s.sample_types.id}`);
        const tData = tRes.data?.tests || [];
        setTests(tData);
        setSelectedIds(tData.map(t => t.id));
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to load sample';
      setError(msg); toast.error(msg);
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { loadSample(); }, [loadSample]);

  useEffect(() => {
    api.get('/lookup/staff').then(res => {
      setStaffList(res.data?.staff || []);
    }).catch(() => {});
  }, []);

  // ── Remove a test (only if no result submitted) ───────────
  const removeTest = async (assignmentId, testName) => {
    if (!window.confirm(`Remove "${testName}" from this sample? This cannot be undone.`)) return;
    setRemovingTest(assignmentId);
    try {
      await api.delete(`/samples/assignment/${assignmentId}`);
      toast.success(`✅ ${testName} removed from this sample`);
      await loadSample();
    } catch(err) {
      toast.error(err.response?.data?.error || 'Failed to remove test');
    } finally { setRemovingTest(null); }
  };

  // ── Submit ALL results at once ────────────────────────────
  const submitAllResults = async () => {
    if (!analyst.trim()) { toast.warning('Select your name as the analyst first'); return; }

    const assignments = (sample?.sample_test_assignments || [])
      .filter(a => {
        const r = results[a.id] || {};
        // Only submit ones that have a value and are not locked
        return r.value?.trim() && !(r.locked || r.editCount >= 2);
      });

    if (assignments.length === 0) {
      toast.warning('No results to submit. Enter values in the fields first.');
      return;
    }

    setSavingAll(true);
    let successCount = 0;
    let oosCount     = 0;

    try {
      for (const assignment of assignments) {
        const r  = results[assignment.id] || {};
        const ev = evaluate(r.value, assignment);

        try {
          await api.put(`/results/${assignment.id}`, {
            result_value      : r.value.trim(),
            analyst_signature : analyst.trim(),
            result_status     : ev.status,
            remarks           : ev.remarks,
            action            : ev.action,
            submitted_at      : new Date().toISOString(),
          });

          const isOOS = ev.status === 'fail_low' || ev.status === 'fail_high';
          if (isOOS) oosCount++;
          successCount++;

          // Update local state
          setResults(prev => ({
            ...prev,
            [assignment.id]: {
              ...prev[assignment.id],
              submitted: true,
              status   : ev.status,
              remarks  : ev.remarks,
              subAt    : new Date().toISOString(),
              analyst  : analyst.trim(),
              editCount: (prev[assignment.id]?.editCount || 0),
            },
          }));
        } catch(err) {
          console.error(`Failed to submit ${assignment.tests?.name}:`, err.message);
        }
      }

      if (oosCount > 0) {
        toast.error(`⚠️ ${successCount} result(s) submitted — ${oosCount} OUT OF SPEC`);
      } else {
        toast.success(`✅ ${successCount} result(s) submitted successfully`);
      }

      await loadSample();
    } finally {
      setSavingAll(false);
    }
  };

  // ── Evaluate result against spec ─────────────────────────
  const evaluate = (value, assignment) => {
    const spec = assignment.tests?.test_specifications?.[0];
    const rt   = assignment.tests?.result_type;
    if (!value?.trim()) return { status:'', remarks:'', action:'' };

    if (rt === 'text') {
      const v = value.trim().toLowerCase();
      if (v === 'negative' || v === 'nil')
        return { status:'ok', remarks:'OK', action:'Pass' };
      if (v === 'positive' || v === 'traces')
        return { status:'fail_high', remarks:'FAIL', action:'Reject' };
      return { status:'text_ok', remarks:'OK', action:'Pass' };
    }

    const num = parseFloat(value);
    if (isNaN(num)) return { status:'text_ok', remarks:'OK', action:'Pass' };
    if (!spec) return { status:'pass', remarks:'OK', action:'Pass' };
    if (spec.min_value !== null && num < parseFloat(spec.min_value))
      return { status:'fail_low',  remarks:'LOW',  action:'Adjust' };
    if (spec.max_value !== null && num > parseFloat(spec.max_value))
      return { status:'fail_high', remarks:'HIGH', action:'Adjust' };
    return { status:'pass', remarks:'OK', action:'Pass' };
  };

  // ── Confirm tests ────────────────────────────────────────
  const confirmTests = async () => {
    if (selectedIds.length === 0) { toast.warning('Select at least one test'); return; }
    try {
      await api.post('/samples/assign-tests', { sample_id: id, test_ids: selectedIds });
      await loadSample();
      setStep('enter');
      toast.success('Tests confirmed. Enter results below.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to confirm tests');
    }
  };

  // ── Submit / Update a result ─────────────────────────────
  const submitResult = async (assignmentId, assignment) => {
    const r = results[assignmentId];

    if (!r?.value?.trim()) { toast.warning('Enter a result value first'); return; }
    if (!analyst.trim())   { toast.warning('Select your name as the analyst'); return; }

    if (r.locked) {
      toast.error('This result is locked — maximum 2 edits reached'); return;
    }

    // Check edit limit before submitting
    // editCount tracks how many times it has been updated AFTER first submission
    // First submit = editCount 0, 1st edit = editCount 1, 2nd edit = editCount 2 (locked)
    if (r.submitted && r.editCount >= 2) {
      toast.error('Maximum 2 updates reached. Result is now locked.');
      setResults(prev => ({
        ...prev,
        [assignmentId]: { ...prev[assignmentId], locked: true },
      }));
      return;
    }

    setSaving(prev => ({ ...prev, [assignmentId]: true }));
    try {
      const ev = evaluate(r.value, assignment);
      const res = await api.put(`/results/${assignmentId}`, {
        result_value      : r.value.trim(),
        analyst_signature : analyst.trim(),
        result_status     : ev.status,
        remarks           : ev.remarks,
        action            : ev.action,
        submitted_at      : new Date().toISOString(),
      });

      const newEditCount = res.data?.editCount ?? (r.editCount + (r.submitted ? 1 : 0));
      const isNowLocked  = res.data?.isLocked  ?? (newEditCount >= 2);

      setResults(prev => ({
        ...prev,
        [assignmentId]: {
          ...prev[assignmentId],
          submitted : true,
          status    : ev.status,
          remarks   : ev.remarks,
          editCount : newEditCount,
          locked    : isNowLocked,
          subAt     : new Date().toISOString(),
          analyst   : analyst.trim(),
        },
      }));

      const isOOS = ev.status === 'fail_low' || ev.status === 'fail_high';
      const wasUpdate = r.submitted;

      if (isNowLocked) {
        toast.info(`🔒 ${assignment.tests?.name}: Result locked after 2 updates`);
      } else if (isOOS) {
        toast.error(`⚠️ ${assignment.tests?.name}: ${ev.remarks} — Out of specification`);
      } else {
        toast.success(`✅ ${assignment.tests?.name}: ${wasUpdate ? 'Updated' : 'Submitted'} — ${ev.remarks}`);
      }

      await loadSample();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit result');
    } finally {
      setSaving(prev => ({ ...prev, [assignmentId]: false }));
    }
  };

  // ── Colour helpers ───────────────────────────────────────
  const getColor = (status) => ({
    pass      :{ bg:'#F0FDF4', border:'#86EFAC', text:'#15803D' },
    ok        :{ bg:'#F0FDF4', border:'#86EFAC', text:'#15803D' },
    fail_low  :{ bg:'#FEF2F2', border:'#FECACA', text:'#DC2626' },
    fail_high :{ bg:'#FEF2F2', border:'#FECACA', text:'#DC2626' },
    text_ok   :{ bg:'#EFF6FF', border:'#BFDBFE', text:'#1D4ED8' },
  })[status] || { bg:'#fff', border:PL, text:'#111827' };

  const StatusBadge = ({ status }) => {
    const c = {
      pending    :{ bg:'#F3F4F6', text:'#6B7280' },
      in_progress:{ bg:'#FFF7ED', text:'#EA580C' },
      complete   :{ bg:'#F0FDF4', text:'#16A34A' },
    }[status] || { bg:'#F3F4F6', text:'#6B7280' };
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

        {loading && (
          <div style={{ textAlign:'center', padding:'80px' }}>
            <div style={{ fontSize:'40px', marginBottom:'12px' }}>🔬</div>
            <p style={{ color:PM, fontWeight:'600' }}>Loading sample...</p>
          </div>
        )}

        {!loading && error && (
          <div style={{ background:'#FEF2F2', border:'1.5px solid #FECACA', borderRadius:'14px', padding:'24px', textAlign:'center' }}>
            <div style={{ fontSize:'40px', marginBottom:'12px' }}>⚠️</div>
            <p style={{ color:'#DC2626', fontWeight:'700', fontSize:'15px' }}>{error}</p>
            <button onClick={loadSample} style={{ marginTop:'16px', padding:'10px 20px', background:PM, color:'#fff', border:'none', borderRadius:'10px', cursor:'pointer', fontFamily:'inherit', fontWeight:'600' }}>
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && sample && (
          <>
            {/* Sample info */}
            <div style={{
              background:'#fff', borderRadius:'16px',
              border:`1.5px solid ${PL}`, padding:'18px 20px',
              marginBottom:'16px',
              boxShadow:'0 2px 8px rgba(107,33,168,0.06)',
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'8px' }}>
                <div>
                  <h2 style={{ fontSize:'18px', fontWeight:'800', color:'#1F2937', margin:'0 0 4px' }}>
                    {sample.sample_name}
                  </h2>
                  <p style={{ fontSize:'12px', color:PM, fontFamily:'monospace', margin:'0 0 8px', fontWeight:'700' }}>
                    {sample.sample_number}
                  </p>
                  <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                    <StatusBadge status={sample.status} />
                    {sample.sample_types?.name && (
                      <span style={{ padding:'3px 10px', borderRadius:'10px', fontSize:'12px', fontWeight:'600', background:'#F5F3FF', color:PM }}>
                        {sample.sample_types.name}
                      </span>
                    )}
                    {sample.departments?.name && (
                      <span style={{ padding:'3px 10px', borderRadius:'10px', fontSize:'12px', fontWeight:'600', background:'#F0FDF4', color:'#16A34A' }}>
                        {sample.departments.name}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'6px' }}>
                  {/* ── CORRECT SAMPLE BUTTON ── */}
                  <button onClick={() => setShowEdit(true)}
                    style={{ padding:'6px 14px', background:'#FFF7ED', color:'#EA580C', border:'1.5px solid #FED7AA', borderRadius:'9px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'5px' }}>
                    ✏️ Correct This Sample
                  </button>
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
                      <div style={{ marginTop:'4px' }}>Sampler: <strong>{sample.sampler_name}</strong></div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* STEP 1: Select tests */}
            {step === 'confirm' && (
              <div style={{ background:'#fff', borderRadius:'16px', border:`1.5px solid ${PL}`, padding:'20px' }}>
                <h3 style={{ fontSize:'16px', fontWeight:'800', color:'#1F2937', marginBottom:'4px' }}>
                  Step 1 — Select Tests
                </h3>
                <p style={{ fontSize:'13px', color:'#6B7280', marginBottom:'16px' }}>
                  Tick all tests required for this sample then confirm.
                </p>

                {tests.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'40px', color:'#9CA3AF' }}>
                    <p style={{ fontWeight:'600' }}>No tests found for {sample.sample_types?.name}</p>
                    <p style={{ fontSize:'12px', marginTop:'4px' }}>Check that tests are configured in the database.</p>
                  </div>
                ) : (
                  <>
                    <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
                      <button type="button" onClick={() => setSelectedIds(tests.map(t => t.id))}
                        style={{ padding:'6px 14px', border:`1.5px solid ${PL}`, borderRadius:'8px', background:'#F5F3FF', color:P, fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>
                        Select All
                      </button>
                      <button type="button" onClick={() => setSelectedIds([])}
                        style={{ padding:'6px 14px', border:'1.5px solid #E5E7EB', borderRadius:'8px', background:'#F9FAFB', color:'#6B7280', fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>
                        Clear
                      </button>
                    </div>

                    <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'20px' }}>
                      {tests.map(test => {
                        const spec = test.test_specifications?.[0];
                        const specStr = spec?.display_spec
                          ? `(${spec.display_spec}) ${test.unit||''}`
                          : spec?.min_value !== undefined
                            ? `(${spec.min_value}–${spec.max_value}) ${test.unit||''}`
                            : test.unit || '';
                        const checked = selectedIds.includes(test.id);
                        return (
                          <label key={test.id} style={{
                            display:'flex', alignItems:'center', gap:'12px',
                            padding:'12px 14px', borderRadius:'10px',
                            border: checked ? `1.5px solid ${PM}` : '1.5px solid #E5E7EB',
                            background: checked ? '#F5F3FF' : '#FAFAFA',
                            cursor:'pointer',
                          }}>
                            <input type="checkbox" checked={checked}
                              onChange={e => {
                                if (e.target.checked) setSelectedIds(prev => [...prev, test.id]);
                                else setSelectedIds(prev => prev.filter(x => x !== test.id));
                              }}
                              style={{ width:'18px', height:'18px', cursor:'pointer', accentColor:PM }}
                            />
                            <div style={{ flex:1 }}>
                              <div style={{ fontWeight:'700', color:'#1F2937', fontSize:'14px' }}>{test.name}</div>
                              {specStr && <div style={{ fontSize:'12px', color:PM, marginTop:'2px' }}>Spec: {specStr}</div>}
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
                      ✅ Confirm {selectedIds.length} Test(s) → Enter Results
                    </button>
                  </>
                )}
              </div>
            )}

            {/* STEP 2: Enter results */}
            {step === 'enter' && (
              <div style={{ background:'#fff', borderRadius:'16px', border:`1.5px solid ${PL}`, padding:'20px' }}>

                {/* Header row with Submit All button */}
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'10px', flexWrap:'wrap', marginBottom:'4px' }}>
                  <div>
                    <h3 style={{ fontSize:'16px', fontWeight:'800', color:'#1F2937', margin:'0 0 4px' }}>
                      Step 2 — Enter Results
                    </h3>
                    <p style={{ fontSize:'13px', color:'#6B7280', margin:0 }}>
                      Enter all values below then click <strong>Submit All</strong>, or submit each test individually.
                      Max <strong>2 updates</strong> per result then locked.
                    </p>
                  </div>

                  {/* ── SUBMIT ALL BUTTON ── */}
                  <button
                    onClick={submitAllResults}
                    disabled={savingAll || !analyst.trim()}
                    style={{
                      padding     : '11px 22px',
                      background  : savingAll || !analyst.trim()
                        ? '#A78BFA'
                        : 'linear-gradient(135deg,#0D9488,#059669)',
                      color       : '#fff',
                      border      : 'none',
                      borderRadius: '12px',
                      fontSize    : '14px',
                      fontWeight  : '800',
                      cursor      : savingAll || !analyst.trim() ? 'not-allowed' : 'pointer',
                      fontFamily  : 'inherit',
                      whiteSpace  : 'nowrap',
                      boxShadow   : savingAll ? 'none' : '0 3px 10px rgba(13,148,136,0.35)',
                      flexShrink  : 0,
                      display     : 'flex',
                      alignItems  : 'center',
                      gap         : '7px',
                    }}
                    title={!analyst.trim() ? 'Select analyst name first' : 'Submit all entered results at once'}
                  >
                    {savingAll ? (
                      <>⏳ Submitting...</>
                    ) : (
                      <>✅ Submit All Results</>
                    )}
                  </button>
                </div>

                {/* Progress hint */}
                {(() => {
                  const all  = sample?.sample_test_assignments || [];
                  const done = all.filter(a => (results[a.id]?.submitted));
                  const pending = all.filter(a => !(results[a.id]?.submitted) && !results[a.id]?.locked);
                  const filled = pending.filter(a => results[a.id]?.value?.trim());
                  return pending.length > 0 ? (
                    <div style={{ background:'#F5F3FF', borderRadius:'8px', padding:'7px 12px', marginBottom:'16px', fontSize:'12px', color:'#4C1D95', display:'flex', gap:'12px', flexWrap:'wrap' }}>
                      <span>✅ {done.length} submitted</span>
                      <span>✏️ {filled.length} filled, not yet submitted</span>
                      <span style={{ color:'#9CA3AF' }}>⏳ {pending.length - filled.length} empty</span>
                    </div>
                  ) : null;
                })()}

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
                    .sort((a,b) => (a.tests?.display_order||0)-(b.tests?.display_order||0))
                    .map(assignment => {
                      const r   = results[assignment.id] || {};
                      const cs  = r.submitted ? getColor(r.status) : { bg:'#fff', border:PL, text:'#111827' };
                      const spec = assignment.tests?.test_specifications?.[0];
                      const specStr = spec?.display_spec
                        ? `(${spec.display_spec})`
                        : spec?.min_value !== undefined
                          ? `(${spec.min_value}–${spec.max_value})`
                          : '';

                      const isSaving  = saving[assignment.id];
                      const isLocked  = r.locked || r.editCount >= 2;
                      const editsLeft = isLocked ? 0 : r.submitted ? (2 - r.editCount) : null;

                      return (
                        <div key={assignment.id} style={{
                          border:`2px solid ${isLocked ? '#E5E7EB' : cs.border}`,
                          borderRadius:'12px',
                          background: isLocked ? '#F9FAFB' : cs.bg,
                          padding:'14px 16px',
                        }}>
                          {/* Header */}
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'10px', flexWrap:'wrap', gap:'6px' }}>
                            <div>
                              <div style={{ fontWeight:'800', fontSize:'14px', color: isLocked ? '#9CA3AF' : '#1F2937' }}>
                                {assignment.tests?.name}
                                {isLocked && <span style={{ marginLeft:'8px', fontSize:'16px' }}>🔒</span>}
                              </div>
                              <div style={{ display:'flex', gap:'6px', marginTop:'3px', flexWrap:'wrap', alignItems:'center' }}>
                                {specStr && (
                                  <span style={{ fontSize:'12px', color:G, fontWeight:'700' }}>
                                    Spec: {specStr} {assignment.tests?.unit||''}
                                  </span>
                                )}
                                {r.submitted && (
                                  <span style={{
                                    fontSize:'11px', fontWeight:'700',
                                    color: isLocked ? '#DC2626' : editsLeft <= 1 ? '#EA580C' : '#16A34A',
                                    background: isLocked ? '#FEF2F2' : editsLeft <= 1 ? '#FFF7ED' : '#F0FDF4',
                                    padding:'1px 7px', borderRadius:'10px',
                                    border:`1px solid ${isLocked ? '#FECACA' : editsLeft <= 1 ? '#FED7AA' : '#86EFAC'}`,
                                  }}>
                                    {isLocked ? '🔒 Locked' : `${editsLeft} update(s) left`}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                              {r.submitted && (
                                <span style={{
                                  padding:'3px 10px', borderRadius:'10px',
                                  fontSize:'11px', fontWeight:'800',
                                  background:cs.bg, color:cs.text,
                                  border:`1px solid ${cs.border}`,
                                }}>
                                  {r.remarks}
                                </span>
                              )}
                              {/* ── REMOVE TEST BUTTON — only if no result submitted ── */}
                              {!r.submitted && !isLocked && (
                                <button
                                  onClick={() => removeTest(assignment.id, assignment.tests?.name)}
                                  disabled={removingTest === assignment.id}
                                  title="Remove this test from the sample"
                                  style={{
                                    padding:'4px 10px', background:'#FEF2F2',
                                    color:'#DC2626', border:'1px solid #FECACA',
                                    borderRadius:'8px', fontSize:'11px', fontWeight:'700',
                                    cursor:'pointer', fontFamily:'inherit',
                                    display:'flex', alignItems:'center', gap:'3px',
                                  }}>
                                  {removingTest===assignment.id ? '...' : '🗑 Remove'}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Input + button */}
                          <div style={{ display:'flex', gap:'8px', alignItems:'flex-end' }}>
                            <div style={{ flex:1 }}>
                              <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'#4C1D95', marginBottom:'4px' }}>
                                Result {assignment.tests?.unit ? `(${assignment.tests.unit})` : ''}
                              </label>
                              <input
                                type="text"
                                value={r.value || ''}
                                disabled={isLocked}
                                onChange={e => setResults(prev => ({
                                  ...prev,
                                  [assignment.id]: { ...prev[assignment.id], value: e.target.value },
                                }))}
                                placeholder={
                                  isLocked ? 'Locked — cannot edit'
                                  : assignment.tests?.result_type === 'text'
                                    ? 'e.g. Negative / Positive / NIL / Traces'
                                    : `Enter value ${assignment.tests?.unit ? `in ${assignment.tests.unit}` : ''}`
                                }
                                style={{
                                  ...inp, width:'100%',
                                  borderColor: isLocked ? '#E5E7EB' : r.submitted ? cs.border : PL,
                                  background : isLocked ? '#F3F4F6' : '#fff',
                                  color      : isLocked ? '#9CA3AF' : '#111827',
                                  cursor     : isLocked ? 'not-allowed' : 'text',
                                }}
                              />
                            </div>

                            <button
                              onClick={() => submitResult(assignment.id, assignment)}
                              disabled={isSaving || isLocked}
                              style={{
                                padding    : '10px 16px',
                                background : isLocked
                                  ? '#E5E7EB'
                                  : isSaving
                                    ? '#A78BFA'
                                    : r.submitted
                                      ? `linear-gradient(135deg,#0D9488,#059669)` // teal for update
                                      : `linear-gradient(135deg,${P},${PM})`,
                                color      : isLocked ? '#9CA3AF' : '#fff',
                                border     : 'none',
                                borderRadius:'10px',
                                fontSize   : '13px',
                                fontWeight : '700',
                                cursor     : isLocked || isSaving ? 'not-allowed' : 'pointer',
                                fontFamily : 'inherit',
                                whiteSpace : 'nowrap',
                                flexShrink : 0,
                                minWidth   : '90px',
                                boxShadow  : isLocked ? 'none' : '0 2px 6px rgba(0,0,0,0.15)',
                              }}
                            >
                              {isLocked   ? '🔒 Locked'
                               : isSaving ? '...'
                               : r.submitted ? '✏️ Update'
                               : '✅ Submit'}
                            </button>
                          </div>

                          {/* Submission info */}
                          {r.submitted && (
                            <div style={{ fontSize:'11px', color:'#9CA3AF', marginTop:'6px', display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'4px' }}>
                              <span>
                                {r.analyst && `Analyst: ${r.analyst}`}
                              </span>
                              <span>
                                {r.subAt && new Date(r.subAt).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>

                {/* Submit All Results button */}
{(sample.sample_test_assignments||[]).some(a => {
  const r = results[a.id] || {};
  return r.value?.trim() && !r.submitted && !(r.locked || r.editCount >= 2);
}) && (
  <button
    onClick={submitAllResults}
    disabled={savingAll || !analyst.trim()}
    style={{
      width       : '100%',
      marginTop   : '16px',
      padding     : '15px',
      background  : savingAll || !analyst.trim()
        ? '#A78BFA'
        : 'linear-gradient(135deg,#0D9488,#059669)',
      color       : '#fff',
      border      : 'none',
      borderRadius: '12px',
      fontSize    : '15px',
      fontWeight  : '800',
      cursor      : savingAll || !analyst.trim() ? 'not-allowed' : 'pointer',
      fontFamily  : 'inherit',
      boxShadow   : savingAll ? 'none' : '0 4px 12px rgba(13,148,136,0.35)',
    }}
  >
    {savingAll ? '⏳ Saving all results...' : '✅ Save All Results at Once'}
  </button>
)}

                {/* Back to test selection (only if no results yet) */}
                {(sample.sample_test_assignments||[]).every(a => !a.result_value) && (
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

      {/* ── SAMPLE EDIT MODAL ── */}
      {showEdit && sample && (
        <SampleEditModal
          sample={sample}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); loadSample(); }}
        />
      )}

      <PageFooter />
    </div>
  );
}
