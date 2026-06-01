// ============================================================
// FILE: src/pages/AnalysisPage.jsx
// Step 1: Select tests to perform (checkbox list)
// Step 2: Enter results (inline table)
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar          from '../components/Navbar';
import SampleEditModal from '../components/SampleEditModal';
import { useAuth }     from '../context/AuthContext';
import { supabase }    from '../services/supabase';
import api             from '../services/api';
import { format }      from 'date-fns';
import { toast }       from 'react-toastify';

const P  = '#6B21A8';
const PM = '#7C3AED';
const PL = '#EDE9FE';
const G  = '#FFB81C';
const GR = '#16A34A';
const RD = '#DC2626';

function evaluate(value, spec, resultType) {
  if (!value?.trim()) return { status: null, pass: null };
  if (resultType === 'text') {
    if (!spec?.display_spec) return { status: 'text_ok', pass: true };
    const v = value.toLowerCase().trim();
    const s = spec.display_spec.toLowerCase().trim();
    let pass = true;
    if (s === 'pink')                   pass = v === 'pink';
    else if (s === 'black')             pass = v === 'black';
    else if (s === 'nil')               pass = v === 'nil';
    else if (s.includes('yellow'))      pass = v === 'yellow' || v === 'light yellow';
    else if (s === 'to pass the test')  pass = v === 'to pass the test';
    else if (s === 'negative')          pass = v === 'negative';
    return { status: pass ? 'pass' : 'fail_high', pass };
  }
  const num = parseFloat(value);
  if (isNaN(num)) return { status: 'text_ok', pass: true };
  if (spec?.min_value != null && num < parseFloat(spec.min_value)) return { status: 'fail_low',  pass: false };
  if (spec?.max_value != null && num > parseFloat(spec.max_value)) return { status: 'fail_high', pass: false };
  return { status: 'pass', pass: true };
}

const STATUS_ROW = {
  pass     : { bg: '#DCFCE7', color: GR,        label: 'PASS'   },
  fail_low : { bg: '#FEF2F2', color: RD,        label: 'FAIL ↓' },
  fail_high: { bg: '#FEF2F2', color: RD,        label: 'FAIL ↑' },
  text_ok  : { bg: '#EFF6FF', color: '#1D4ED8', label: 'OK'     },
};

export default function AnalysisPage() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { user, signingAs } = useAuth();

  const [sample,       setSample]       = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [step,         setStep]         = useState('confirm'); // 'confirm' | 'enter'
  const [allTests,     setAllTests]     = useState([]);
  const [selectedIds,  setSelectedIds]  = useState([]);
  const [confirming,   setConfirming]   = useState(false);
  const [analyst,      setAnalyst]      = useState(signingAs || user?.full_name || '');
  const [manualAnalyst,setManualAnalyst]= useState(false);
  const [staff,        setStaff]        = useState([]);
  const [vals,         setVals]         = useState({});
  const [subs,         setSubs]         = useState({});
  const [saving,       setSaving]       = useState({});
  const [savingAll,    setSavingAll]    = useState(false);
  const [showEdit,     setShowEdit]     = useState(false);
  const [removing,     setRemoving]     = useState(null);
  const inputRefs = useRef({});

  // ── Load sample ───────────────────────────────────────────
  const loadSample = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('registered_samples')
        .select(`
          id, sample_name, sample_number, status,
          registered_at, sampler_name, batch_number, notes,
          departments(id, name, code),
          sample_types(id, name, code),
          sample_subtypes(id, name),
          sample_test_assignments(
            id, result_value, result_status, analyst_signature,
            submitted_at, edit_count, is_locked,
            tests(
              id, name, code, unit, result_type, display_order,
              test_specifications(id, min_value, max_value, display_spec)
            )
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setSample(data);

      const assignments = data?.sample_test_assignments || [];

      if (assignments.length === 0) {
        // ── No assignments yet — go to Step 1 ────────────────
        const typeId = data?.sample_types?.id;
        if (typeId) {
          const { data: tests } = await supabase
            .from('tests')
            .select(`
              id, name, code, unit, result_type, display_order,
              test_specifications(id, min_value, max_value, display_spec)
            `)
            .eq('sample_type_id', typeId)
            .order('display_order');
          const t = tests || [];
          setAllTests(t);
          setSelectedIds(t.map(x => x.id)); // all selected by default
        }
        setStep('confirm');
      } else {
        // ── Has assignments — go to Step 2 ───────────────────
        const iv = {}; const is_ = {};
        for (const a of assignments) {
          if (a.result_value) {
            iv[a.id]  = a.result_value;
            is_[a.id] = {
              value    : a.result_value,
              status   : a.result_status,
              analyst  : a.analyst_signature,
              time     : a.submitted_at,
              editCount: a.edit_count || 0,
              locked   : a.is_locked || (a.edit_count || 0) >= 2,
            };
          }
        }
        setVals(iv);
        setSubs(is_);
        setStep('enter');
      }
    } catch(e) {
      console.error(e);
      toast.error('Failed to load sample');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadSample(); }, [loadSample]);

  // ── Load staff list ───────────────────────────────────────
  useEffect(() => {
    api.get('/lookup/staff?role=Analyst')
      .then(res => setStaff(res.data?.staff || []))
      .catch(e => console.error('Staff load error:', e.message));
  }, []);

  // ── Confirm tests (Step 1 → Step 2) ──────────────────────
  const confirmTests = async () => {
    if (selectedIds.length === 0) { toast.warning('Select at least one test'); return; }
    setConfirming(true);
    try {
      const { error } = await supabase
        .from('sample_test_assignments')
        .insert(selectedIds.map(testId => ({ sample_id: sample.id, test_id: testId })));
      if (error) throw error;

      await supabase
        .from('registered_samples')
        .update({ status: 'in_progress' })
        .eq('id', sample.id);

      toast.success(`✅ ${selectedIds.length} test${selectedIds.length !== 1 ? 's' : ''} confirmed`);
      await loadSample();
    } catch(e) {
      toast.error('Failed to confirm tests: ' + e.message);
    } finally {
      setConfirming(false);
    }
  };

  const assignments = [...(sample?.sample_test_assignments || [])]
    .sort((a, b) => (a.tests?.display_order || 0) - (b.tests?.display_order || 0));

  // ── Submit one result ─────────────────────────────────────
  const submitOne = async (a) => {
    if (!analyst.trim()) { toast.warning('Select analyst first'); return; }
    const v = vals[a.id]?.trim();
    if (!v) { toast.warning('Enter a value'); return; }
    const spec = a.tests?.test_specifications?.[0];
    const { status } = evaluate(v, spec, a.tests?.result_type);
    setSaving(p => ({ ...p, [a.id]: true }));
    try {
      await api.put(`/results/${a.id}`, {
        result_value     : v,
        analyst_signature: analyst.trim(),
        result_status    : status,
        submitted_at     : new Date().toISOString(),
      });
      setSubs(p => ({
        ...p,
        [a.id]: {
          value    : v, status, analyst: analyst.trim(),
          time     : new Date().toISOString(),
          editCount: (p[a.id]?.editCount || 0) + 1,
          locked   : ((p[a.id]?.editCount || 0) + 1) >= 2,
        },
      }));
      await loadSample();
    } catch(e) { toast.error(e.response?.data?.error || e.message); }
    finally { setSaving(p => ({ ...p, [a.id]: false })); }
  };

  // ── Submit all ────────────────────────────────────────────
  const submitAll = async () => {
    if (!analyst.trim()) { toast.warning('Select analyst first'); return; }
    const toSub = assignments.filter(a => vals[a.id]?.trim() && !subs[a.id]?.locked);
    if (!toSub.length) { toast.warning('No values to submit'); return; }
    setSavingAll(true);
    let ok = 0; let oos = 0;
    try {
      for (const a of toSub) {
        const v = vals[a.id].trim();
        const spec = a.tests?.test_specifications?.[0];
        const { status } = evaluate(v, spec, a.tests?.result_type);
        try {
          await api.put(`/results/${a.id}`, {
            result_value     : v,
            analyst_signature: analyst.trim(),
            result_status    : status,
            submitted_at     : new Date().toISOString(),
          });
          setSubs(p => ({
            ...p,
            [a.id]: {
              value: v, status, analyst: analyst.trim(),
              time: new Date().toISOString(),
              editCount: (p[a.id]?.editCount || 0) + 1,
              locked: ((p[a.id]?.editCount || 0) + 1) >= 2,
            },
          }));
          if (status === 'fail_low' || status === 'fail_high') oos++; else ok++;
        } catch(e) { console.error(e); }
      }
      toast[oos > 0 ? 'error' : 'success'](
        `✅ ${ok + oos} submitted${oos > 0 ? ` — ⚠️ ${oos} OOS` : ''}`
      );
      await loadSample();
    } finally { setSavingAll(false); }
  };

  // ── Remove a test ─────────────────────────────────────────
  const removeTest = async (aId, name) => {
    if (!window.confirm(`Remove "${name}"?`)) return;
    setRemoving(aId);
    try {
      await api.delete(`/samples/assignment/${aId}`);
      toast.success(`${name} removed`);
      await loadSample();
    } catch(e) { toast.error(e.response?.data?.error || e.message); }
    finally { setRemoving(null); }
  };

  // ── Derived values ────────────────────────────────────────
  const totalN  = assignments.length;
  const subN    = Object.keys(subs).length;
  const oosN    = Object.values(subs).filter(s => s.status === 'fail_low' || s.status === 'fail_high').length;
  const filledN = assignments.filter(a => vals[a.id]?.trim() && !subs[a.id]?.value).length;
  const allDone = totalN > 0 && subN === totalN;
  const pct     = totalN > 0 ? Math.round((subN / totalN) * 100) : 0;
  const canAll  = analyst.trim() && assignments.some(a => vals[a.id]?.trim() && !subs[a.id]?.locked);

  const sttCfg = ({
    pending    : { color: '#64748B', bg: '#F1F5F9', label: 'Pending'     },
    in_progress: { color: '#D97706', bg: '#FFFBEB', label: 'In Progress' },
    complete   : { color: GR,        bg: '#ECFDF5', label: 'Complete'    },
    voided     : { color: RD,        bg: '#FEF2F2', label: 'Voided'      },
  }[sample?.status]) || { color: '#64748B', bg: '#F1F5F9', label: '—' };

  // ── Loading screen ────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontWeight: '600', fontSize: '15px' }}>
        Loading sample...
      </div>
    </div>
  );

  // ── Left panel (shared between steps) ────────────────────
  const LeftPanel = () => (
    <div style={{ background: '#fff', borderRight: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Back */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #F1F5F9' }}>
        <button onClick={() => navigate(-1)}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', border: '1px solid #E2E8F0', borderRadius: '7px', background: '#F8FAFC', color: '#475569', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
          ← Back
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
        {/* Sample name */}
        <h2 style={{ margin: '0 0 3px', fontSize: '17px', fontWeight: '900', color: '#0F172A' }}>
          {sample?.sample_name}
        </h2>
        <div style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: '700', color: PM, marginBottom: '8px' }}>
          {sample?.sample_number}
        </div>

        {/* Status badges */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <span style={{ background: sttCfg.bg, color: sttCfg.color, padding: '2px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>
            {sttCfg.label}
          </span>
          {sample?.sample_types?.name && (
            <span style={{ background: PL, color: P, padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>
              {sample.sample_types.name}
            </span>
          )}
          {sample?.departments?.name && (
            <span style={{ background: '#ECFDF5', color: GR, padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>
              {sample.departments.name}
            </span>
          )}
          {oosN > 0 && (
            <span style={{ background: '#FEF2F2', color: RD, padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '800', border: '1px solid #FECACA' }}>
              ⚠️ {oosN} OOS
            </span>
          )}
        </div>

        {/* Progress (only in step 2) */}
        {step === 'enter' && (
          <div style={{ background: '#F8FAFC', borderRadius: '9px', padding: '10px 12px', marginBottom: '12px', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '5px' }}>
              <span>Progress</span>
              <span style={{ color: allDone ? GR : PM }}>{subN}/{totalN} ({pct}%)</span>
            </div>
            <div style={{ background: '#E2E8F0', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: allDone ? GR : oosN > 0 ? RD : `linear-gradient(90deg,${P},${PM})`, borderRadius: '4px', transition: 'width 0.3s' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '6px', fontSize: '11px', flexWrap: 'wrap' }}>
              <span style={{ color: GR, fontWeight: '600' }}>✅ {subN} submitted</span>
              {filledN > 0 && <span style={{ color: '#D97706', fontWeight: '600' }}>✏️ {filledN} filled</span>}
              {oosN > 0 && <span style={{ color: RD, fontWeight: '700' }}>⚠️ {oosN} OOS</span>}
            </div>
          </div>
        )}

        {/* Meta */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginBottom: '12px' }}>
          {[
            ['Date',    sample?.registered_at ? format(new Date(sample.registered_at), 'dd/MM/yy HH:mm') : '—'],
            ['Sampler', sample?.sampler_name || '—'],
            ['Batch',   sample?.batch_number || '—'],
            ['Notes',   sample?.notes        || '—'],
          ].map(([k, v]) => (
            <div key={k} style={{ background: '#F8FAFC', borderRadius: '6px', padding: '6px 9px', border: '1px solid #F1F5F9' }}>
              <div style={{ fontSize: '9px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1px' }}>{k}</div>
              <div style={{ fontWeight: '600', color: '#1E293B', fontSize: '11px', wordBreak: 'break-word' }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Correct sample */}
        <button onClick={() => setShowEdit(true)}
          style={{ width: '100%', padding: '8px', background: '#FFF7ED', color: '#D97706', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '10px' }}>
          ✏️ Correct This Sample
        </button>

        {/* Analyst selector */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#4C1D95', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Analyst Signature *
          </label>

          {!manualAnalyst ? (
            <>
              <select value={analyst} onChange={e => setAnalyst(e.target.value)}
                style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 11px', fontSize: '13px', fontFamily: 'inherit', background: '#fff', color: '#1E293B', outline: 'none', cursor: 'pointer', marginBottom: '5px', boxSizing: 'border-box' }}>
                <option value="">— Select analyst —</option>
                {staff.map(s => (
                  <option key={s.id} value={s.full_name}>{s.full_name}</option>
                ))}
              </select>
              <button type="button" onClick={() => { setManualAnalyst(true); setAnalyst(''); }}
                style={{ background: 'none', border: 'none', color: PM, fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', padding: 0 }}>
                + Not in list? Type name manually
              </button>
            </>
          ) : (
            <>
              <input type="text" value={analyst} onChange={e => setAnalyst(e.target.value)}
                autoFocus placeholder="Type analyst full name..."
                style={{ width: '100%', border: `1.5px solid ${PM}`, borderRadius: '8px', padding: '8px 11px', fontSize: '13px', fontFamily: 'inherit', background: '#fff', color: '#1E293B', outline: 'none', boxSizing: 'border-box', marginBottom: '5px' }}
              />
              {analyst.trim().length > 1 && (
                <button type="button"
                  onClick={async () => {
                    try {
                      const res = await api.post('/lookup/staff', { full_name: analyst.trim(), role: 'Both' });
                      const saved = res.data?.staff;
                      if (saved) {
                        setStaff(prev => {
                          const exists = prev.find(s => s.full_name === saved.full_name);
                          if (exists) return prev;
                          return [...prev, saved].sort((a, b) => a.full_name.localeCompare(b.full_name));
                        });
                      }
                      setManualAnalyst(false);
                      toast.success(`✅ ${analyst.trim()} saved to analyst list`);
                    } catch(e) {
                      toast.error('Failed to save: ' + (e.response?.data?.error || e.message));
                    }
                  }}
                  style={{ width: '100%', padding: '8px', background: `linear-gradient(135deg,${P},${PM})`, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '5px' }}>
                  💾 Save "{analyst.trim()}" to analyst list
                </button>
              )}
              <button type="button" onClick={() => { setManualAnalyst(false); setAnalyst(''); }}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', padding: 0 }}>
                ← Back to dropdown without saving
              </button>
            </>
          )}
        </div>
      </div>

      {/* Submit All — only in step 2 */}
      {step === 'enter' && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid #E2E8F0', background: '#FAFBFC' }}>
          <button onClick={submitAll} disabled={savingAll || !canAll}
            style={{ width: '100%', padding: '11px', background: canAll ? 'linear-gradient(135deg,#0D9488,#059669)' : '#CBD5E1', color: '#fff', border: 'none', borderRadius: '9px', fontSize: '14px', fontWeight: '800', cursor: canAll ? 'pointer' : 'not-allowed', fontFamily: 'inherit', transition: 'all 0.2s' }}>
            {savingAll ? '⏳ Saving...' : '✅ Submit All Results'}
          </button>
          {!analyst.trim() && (
            <p style={{ fontSize: '11px', color: '#94A3B8', textAlign: 'center', margin: '5px 0 0' }}>
              Select analyst above first
            </p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ height: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Navbar />

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '300px 1fr', overflow: 'hidden' }}>

        <LeftPanel />

        {/* ══════════════════════════════════════════════════
            STEP 1 — Select tests
        ══════════════════════════════════════════════════ */}
        {step === 'confirm' && (
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>
                  Step 1 — Select Tests to Perform
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94A3B8' }}>
                  Tick the tests you will perform on this sample then click Confirm
                </p>
              </div>
              <span style={{ background: PL, color: P, padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700' }}>
                {selectedIds.length}/{allTests.length} selected
              </span>
            </div>

            {/* Test list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              {allTests.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div>
                  <div style={{ fontWeight: '700', fontSize: '15px', color: '#374151' }}>No tests configured</div>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '6px' }}>
                    No tests found for sample type "{sample?.sample_types?.name}". Contact your admin.
                  </div>
                </div>
              ) : (
                <>
                  {/* Select all toggle */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', background: '#F5F3FF', borderRadius: '9px', marginBottom: '10px', border: `1px solid ${PL}` }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#4C1D95' }}>
                      {selectedIds.length} of {allTests.length} tests selected
                    </span>
                    <button type="button"
                      onClick={() => setSelectedIds(
                        selectedIds.length === allTests.length
                          ? []
                          : allTests.map(t => t.id)
                      )}
                      style={{ padding: '5px 14px', background: PM, color: '#fff', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                      {selectedIds.length === allTests.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {allTests.map(test => {
                      const spec    = test.test_specifications?.[0];
                      const checked = selectedIds.includes(test.id);
                      return (
                        <label key={test.id}
                          style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: checked ? '#F5F3FF' : '#fff', border: `1.5px solid ${checked ? PM : '#E2E8F0'}`, borderRadius: '10px', cursor: 'pointer', transition: 'all 0.12s', userSelect: 'none' }}>
                          <input type="checkbox" checked={checked}
                            onChange={() => setSelectedIds(prev =>
                              prev.includes(test.id)
                                ? prev.filter(x => x !== test.id)
                                : [...prev, test.id]
                            )}
                            style={{ width: '17px', height: '17px', accentColor: PM, flexShrink: 0, cursor: 'pointer' }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '700', fontSize: '14px', color: '#0F172A' }}>
                              {test.name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                              {spec?.display_spec && (
                                <span style={{ color: '#D97706', fontWeight: '600' }}>
                                  Spec: {spec.display_spec}
                                </span>
                              )}
                              {test.unit && <span>Unit: {test.unit}</span>}
                              <span style={{ color: '#CBD5E1' }}>{test.result_type}</span>
                            </div>
                          </div>
                          {checked && (
                            <span style={{ color: GR, fontSize: '16px', flexShrink: 0 }}>✓</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Confirm button */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #E2E8F0', background: '#fff', flexShrink: 0 }}>
              <button
                onClick={confirmTests}
                disabled={selectedIds.length === 0 || confirming}
                style={{ width: '100%', padding: '13px', background: selectedIds.length === 0 ? '#CBD5E1' : `linear-gradient(135deg,${P},${PM})`, color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '800', cursor: selectedIds.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: selectedIds.length > 0 ? `0 2px 8px rgba(107,33,168,0.3)` : 'none', transition: 'all 0.2s' }}>
                {confirming
                  ? '⏳ Confirming...'
                  : `✅ Confirm ${selectedIds.length} Test${selectedIds.length !== 1 ? 's' : ''} — Proceed to Results Entry`}
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            STEP 2 — Enter results
        ══════════════════════════════════════════════════ */}
        {step === 'enter' && (
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                  Step 2 — Results Entry
                </h3>
                <p style={{ margin: 0, fontSize: '11px', color: '#94A3B8', marginTop: '1px' }}>
                  {totalN} tests · max 2 updates per result then locked · press Enter to submit
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {allDone && (
                  <span style={{ background: '#ECFDF5', color: GR, padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', border: '1px solid #A7F3D0' }}>
                    ✅ All Complete
                  </span>
                )}
                <button onClick={() => {
                  // Allow going back to test selection only if no results submitted
                  const hasResults = Object.keys(subs).length > 0;
                  if (hasResults) {
                    toast.warning('Cannot change tests — results already submitted');
                    return;
                  }
                  // Delete assignments and go back to step 1
                  supabase.from('sample_test_assignments')
                    .delete().eq('sample_id', sample.id)
                    .then(() => { setStep('confirm'); loadSample(); });
                }}
                  style={{ padding: '5px 12px', background: '#F5F3FF', color: P, border: `1px solid ${PL}`, borderRadius: '7px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
                  ← Change Tests
                </button>
              </div>
            </div>

            {/* Results table */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr>
                    {[['Test','170px'],['Spec','110px'],['Unit','65px'],['Value','auto'],['Status','85px'],['Analyst','110px'],['Time','72px'],['','80px']].map(([h, w]) => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748B', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 10, width: w }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a, i) => {
                    const spec    = a.tests?.test_specifications?.[0];
                    const sub     = subs[a.id];
                    const val     = vals[a.id] || '';
                    const locked  = sub?.locked;
                    const isText  = a.tests?.result_type === 'text';
                    const isExtra = ['Remarks', 'Action'].includes(a.tests?.name);
                    const live    = val.trim() ? evaluate(val, spec, a.tests?.result_type) : null;
                    const badge   = STATUS_ROW[sub?.status] || null;
                    const isOOS   = sub?.status === 'fail_low' || sub?.status === 'fail_high';
                    const rowBg   = isOOS ? '#FFF5F5' : i % 2 === 0 ? '#fff' : '#FAFBFC';

                    return (
                      <tr key={a.id} style={{ background: rowBg }}
                        onMouseEnter={e => { if (!isOOS) e.currentTarget.style.background = '#F5F3FF'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = rowBg; }}>

                        <td style={{ padding: '9px 12px', borderBottom: '1px solid #F1F5F9', borderLeft: isOOS ? `3px solid ${RD}` : '3px solid transparent' }}>
                          <div style={{ fontWeight: isExtra ? '500' : '700', color: isExtra ? '#94A3B8' : '#0F172A', fontSize: '13px' }}>
                            {a.tests?.name}
                          </div>
                          {locked && <div style={{ fontSize: '10px', color: '#94A3B8' }}>🔒 Locked</div>}
                        </td>

                        <td style={{ padding: '9px 12px', borderBottom: '1px solid #F1F5F9' }}>
                          {!isExtra && spec?.display_spec
                            ? <span style={{ fontSize: '12px', color: G, fontWeight: '700', background: '#FFFBEB', padding: '2px 7px', borderRadius: '5px' }}>{spec.display_spec}</span>
                            : <span style={{ color: '#CBD5E1', fontSize: '12px' }}>—</span>}
                        </td>

                        <td style={{ padding: '9px 12px', borderBottom: '1px solid #F1F5F9', color: '#94A3B8', fontSize: '12px' }}>
                          {a.tests?.unit || '—'}
                        </td>

                        <td style={{ padding: '6px 12px', borderBottom: '1px solid #F1F5F9' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              ref={el => inputRefs.current[a.id] = el}
                              type={isText || isExtra ? 'text' : 'number'}
                              value={val}
                              onChange={e => setVals(p => ({ ...p, [a.id]: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter' && !locked && val.trim()) submitOne(a); }}
                              disabled={locked}
                              placeholder={locked ? 'Locked' : isText || isExtra ? 'Enter text...' : 'Enter value'}
                              style={{
                                flex: 1, minWidth: '110px',
                                border: `1.5px solid ${locked ? '#E2E8F0' : live?.pass === false ? '#FECACA' : live?.pass === true ? '#86EFAC' : '#E2E8F0'}`,
                                borderRadius: '7px', padding: '6px 10px', fontSize: '13px',
                                fontFamily: 'inherit', background: locked ? '#F8FAFC' : '#fff',
                                color: '#1E293B', outline: 'none', cursor: locked ? 'not-allowed' : 'text',
                              }}
                            />
                            {val.trim() && !locked && live && (
                              <div style={{ width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0, background: live.pass === false ? RD : live.pass === true ? GR : '#94A3B8' }} />
                            )}
                            {!locked && (
                              <button onClick={() => submitOne(a)} disabled={!val.trim() || saving[a.id]}
                                style={{ padding: '5px 12px', background: !val.trim() ? '#E2E8F0' : sub?.value ? '#FFFBEB' : `linear-gradient(135deg,${P},${PM})`, color: !val.trim() ? '#94A3B8' : sub?.value ? '#D97706' : '#fff', border: sub?.value ? '1px solid #FED7AA' : 'none', borderRadius: '7px', fontSize: '11px', fontWeight: '700', cursor: !val.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                {saving[a.id] ? '...' : sub?.value ? '✏️' : '✅'}
                              </button>
                            )}
                          </div>
                        </td>

                        <td style={{ padding: '9px 12px', borderBottom: '1px solid #F1F5F9', textAlign: 'center' }}>
                          {badge
                            ? <span style={{ background: badge.bg, color: badge.color, padding: '3px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: '800', whiteSpace: 'nowrap' }}>{badge.label}</span>
                            : <span style={{ color: '#CBD5E1', fontSize: '11px' }}>—</span>}
                        </td>

                        <td style={{ padding: '9px 12px', borderBottom: '1px solid #F1F5F9', color: '#64748B', fontSize: '11px', whiteSpace: 'nowrap' }}>
                          {sub?.analyst || '—'}
                        </td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid #F1F5F9', color: '#94A3B8', fontSize: '11px', whiteSpace: 'nowrap' }}>
                          {sub?.time ? format(new Date(sub.time), 'HH:mm') : '—'}
                        </td>

                        <td style={{ padding: '9px 12px', borderBottom: '1px solid #F1F5F9', textAlign: 'center' }}>
                          {!sub?.value && !locked && (
                            <button onClick={() => removeTest(a.id, a.tests?.name)} disabled={removing === a.id}
                              style={{ padding: '3px 8px', background: '#FEF2F2', color: RD, border: '1px solid #FECACA', borderRadius: '5px', fontSize: '10px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                              {removing === a.id ? '...' : '🗑'}
                            </button>
                          )}
                          {sub?.editCount > 0 && !locked && (
                            <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>
                              {2 - (sub.editCount || 0)} left
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div style={{ padding: '8px 20px', borderTop: '1px solid #E2E8F0', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                Press <kbd style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '4px', padding: '1px 5px', fontSize: '10px', color: '#475569' }}>Enter</kbd> on any row to submit · green border = pass · red = OOS
              </div>
              <div style={{ fontSize: '12px', color: '#94A3B8' }}>
                {totalN - subN} remaining
              </div>
            </div>
          </div>
        )}
      </div>

      {showEdit && sample && (
        <SampleEditModal
          sample={sample}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); loadSample(); }}
        />
      )}
    </div>
  );
}
