// ============================================================
// FILE: frontend/bul-qc-app/src/components/AssignSampleModal.jsx
// Full-featured sample assignment modal for QC Head
// Features:
//   - Register new / special sample OR pick existing pending
//   - Multi-select analysts (checkboxes)
//   - Multi-select specific tests (checkboxes)
//   - Notes/instructions
//   - Broadcasts notification to all supervisors
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { supabase }      from '../services/supabase';
import { lookupService } from '../services/lookup.service';
import { samplesService} from '../services/samples.service';
import { useAuth }       from '../context/AuthContext';
import { format }        from 'date-fns';

const P  = '#6B21A8';
const PM = '#7C3AED';
const PL = '#EDE9FE';
const G  = '#FFB81C';
const GR = '#16A34A';

// ── Styles ────────────────────────────────────────────────
const inp = {
  width:'100%', border:`1.5px solid ${PL}`, borderRadius:'9px',
  padding:'9px 12px', fontSize:'13px', fontFamily:'inherit',
  background:'#fff', color:'#111827', outline:'none', boxSizing:'border-box',
};
const sel = {
  ...inp, cursor:'pointer',
  backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%237C3AED' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
  backgroundRepeat:'no-repeat', backgroundPosition:'right 10px center',
  paddingRight:'30px', appearance:'none',
};
const lbl = { display:'block', fontSize:'12px', fontWeight:'700', color:'#4C1D95', marginBottom:'5px' };
const fld = { marginBottom:'14px' };
const chk = { display:'flex', alignItems:'center', gap:'8px', padding:'8px 10px', borderRadius:'8px', cursor:'pointer', fontSize:'13px', fontWeight:'600', border:`1.5px solid ${PL}`, marginBottom:'5px', transition:'all 0.12s' };

// STEP labels
const STEPS = ['Sample', 'Analysts', 'Tests', 'Review & Send'];

export default function AssignSampleModal({ onClose }) {
  const { user } = useAuth();

  const [step,          setStep]         = useState(0);
  const [sampleMode,    setSampleMode]   = useState('existing'); // 'existing' | 'new'
  const [submitting,    setSubmitting]   = useState(false);
  const [done,          setDone]         = useState(false);

  // Existing sample selection
  const [pendingSamples,setPending]      = useState([]);
  const [selSampleId,   setSelSampleId]  = useState('');
  const [selSampleObj,  setSelSampleObj] = useState(null);

  // New sample fields
  const [depts,        setDepts]         = useState([]);
  const [cats,         setCats]          = useState([]);
  const [types,        setTypes]         = useState([]);
  const [newDeptId,    setNewDeptId]     = useState('');
  const [newCatId,     setNewCatId]      = useState('');
  const [newTypeId,    setNewTypeId]     = useState('');
  const [newName,      setNewName]       = useState('');
  const [newBatch,     setNewBatch]      = useState('');
  const [newNotes,     setNewNotes]      = useState('');
  const [samplers,     setSamplers]      = useState([]);
  const [samplerName,  setSamplerName]   = useState('');
  const [newSampleObj, setNewSampleObj]  = useState(null); // registered sample

  // Analyst multi-select
  const [analysts,     setAnalysts]      = useState([]);
  const [selAnalysts,  setSelAnalysts]   = useState(new Set());

  // Test multi-select
  const [tests,        setTests]         = useState([]);
  const [selTests,     setSelTests]      = useState(new Set());

  // Notes
  const [assignNote,   setAssignNote]    = useState('');
  const [loadingData,  setLoadingData]   = useState(false);

  // ── Load data on mount ───────────────────────────────────
  useEffect(() => {
    const init = async () => {
      setLoadingData(true);
      try {
        // Pending samples
        const { data: ps } = await supabase
          .from('registered_samples')
          .select('id, sample_name, sample_number, departments(name,id), sample_types(name,id,code)')
          .in('status', ['pending','in_progress'])
          .order('registered_at', { ascending: false })
          .limit(50);
        setPending(ps || []);

        // Departments
        const ds = await lookupService.getDepartments();
        setDepts(ds || []);

        // Analysts — all staff except QC Head/Assistant
        const { data: staff } = await supabase
          .from('app_users')
          .select('id, full_name, username, roles(name), departments(name)')
          .order('full_name');
        setAnalysts((staff||[]).filter(s =>
          s.full_name && !['QC Head','QC Assistant'].includes(s.roles?.name)
        ));

        // Samplers
        const sp = await lookupService.getLabStaff('Sampler');
        setSamplers(sp || []);

      } finally { setLoadingData(false); }
    };
    init();
  }, []);

  // When existing sample selected — load its tests
  useEffect(() => {
    if (!selSampleId) { setSelSampleObj(null); setTests([]); return; }
    const found = pendingSamples.find(s => s.id === selSampleId);
    setSelSampleObj(found || null);
    if (found?.sample_types?.id) loadTestsForType(found.sample_types.id);
  }, [selSampleId, pendingSamples]);

  // When new sample type selected — load tests
  useEffect(() => {
    if (!newTypeId) { setTests([]); return; }
    loadTestsForType(newTypeId);
  }, [newTypeId]);

  const loadTestsForType = async (typeId) => {
    try {
      const res = await lookupService.getTests(typeId);
      setTests(res || []);
      setSelTests(new Set()); // reset selection
    } catch(e) { console.error(e); }
  };

  const loadCats = async (deptId) => {
    try {
      const cs = await lookupService.getSampleCategories(deptId);
      setCats(cs || []);
      setTypes([]);
      setNewCatId('');
      setNewTypeId('');
    } catch(e) {}
  };

  const loadTypes = async (catId) => {
    try {
      const ts = await lookupService.getSampleTypes(catId);
      setTypes(ts || []);
      setNewTypeId('');
    } catch(e) {}
  };

  // ── Toggle helpers ───────────────────────────────────────
  const toggleAnalyst = (id) => {
    setSelAnalysts(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleTest = (id) => {
    setSelTests(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAllTests = () => {
    if (selTests.size === tests.length) setSelTests(new Set());
    else setSelTests(new Set(tests.map(t => t.id)));
  };

  // ── Step validation ──────────────────────────────────────
  const canProceed = () => {
    if (step === 0) {
      if (sampleMode === 'existing') return !!selSampleId;
      return !!newDeptId && !!newCatId && !!newTypeId && !!newName.trim() && !!samplerName;
    }
    if (step === 1) return selAnalysts.size > 0;
    if (step === 2) return true; // tests optional
    return true;
  };

  // ── Register new sample then proceed ────────────────────
  const registerNewSample = async () => {
    setSubmitting(true);
    try {
      const res = await samplesService.registerSample({
        sample_name   : newName.trim(),
        department_id : newDeptId,
        sample_type_id: newTypeId,
        batch_number  : newBatch.trim() || undefined,
        notes         : newNotes.trim() || undefined,
        sampler_name  : samplerName,
      });
      // Reload pending samples to include this one
      const { data: ps } = await supabase
        .from('registered_samples')
        .select('id, sample_name, sample_number, departments(name,id), sample_types(name,id,code)')
        .in('status', ['pending','in_progress'])
        .order('registered_at', { ascending: false })
        .limit(50);
      setPending(ps || []);
      // Find the newly registered sample
      const newS = (ps||[]).find(s => s.sample_number === res.sampleNumber);
      setNewSampleObj(newS || { id: res.sampleId, sample_name: newName.trim(), sample_number: res.sampleNumber });
      return true;
    } catch(e) {
      console.error('Register failed:', e.message);
      return false;
    } finally { setSubmitting(false); }
  };

  const handleNext = async () => {
    if (step === 0 && sampleMode === 'new' && !newSampleObj) {
      const ok = await registerNewSample();
      if (!ok) return;
    }
    setStep(s => s + 1);
  };

  // ── Final submit ─────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const sampleObj = sampleMode === 'existing' ? selSampleObj : newSampleObj;
      if (!sampleObj) return;

      const analystList = analysts.filter(a => selAnalysts.has(a.id));
      const testList    = tests.filter(t => selTests.has(t.id));
      const analystNames = analystList.map(a => a.full_name).join(', ');
      const testNames    = testList.length > 0 ? testList.map(t => t.name).join(', ') : 'All assigned tests';

      // Save analyst assignments
      const rows = [];
      for (const analyst of analystList) {
        rows.push({
          sample_id   : sampleObj.id,
          assigned_to : analyst.id,
          assigned_by : user?.id,
          notes       : assignNote.trim() || null,
          assigned_at : new Date().toISOString(),
        });
      }
      if (rows.length > 0) {
        await supabase.from('analyst_assignments').insert(rows);
      }

      // Send notification to ALL supervisors
      await supabase.from('qc_notifications').insert({
        type            : 'assignment',
        title           : `New Sample Assignment — ${sampleObj.sample_name}`,
        message         : `QC Head has assigned sample ${sampleObj.sample_number || ''} (${sampleObj.sample_name}) to ${analystList.length} analyst(s). Please brief them immediately.`,
        sample_id       : sampleObj.id,
        sample_number   : sampleObj.sample_number || '',
        sample_name     : sampleObj.sample_name,
        analyst_names   : analystNames,
        test_names      : testNames,
        assigned_by     : user?.id,
        assigned_by_name: user?.full_name || 'QC Head',
        notes           : assignNote.trim() || null,
        read_by         : [],
        created_at      : new Date().toISOString(),
      });

      setDone(true);
    } catch(e) {
      console.error('Assignment failed:', e.message);
    } finally { setSubmitting(false); }
  };

  const sampleForDisplay = sampleMode==='existing' ? selSampleObj : newSampleObj;
  const selectedAnalystNames = analysts.filter(a=>selAnalysts.has(a.id)).map(a=>a.full_name);
  const selectedTestNames    = tests.filter(t=>selTests.has(t.id)).map(t=>t.name);

  return (
    <div
      onClick={e => { if(e.target===e.currentTarget) onClose(); }}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}
    >
      <div style={{ background:'#fff', borderRadius:'20px', maxWidth:'600px', width:'100%', maxHeight:'92vh', overflow:'hidden', boxShadow:'0 30px 80px rgba(0,0,0,0.35)', display:'flex', flexDirection:'column' }}>

        {/* Modal header */}
        <div style={{ background:`linear-gradient(135deg,${P},${PM})`, padding:'18px 24px', color:'#fff', flexShrink:0 }}>
          <div style={{ fontWeight:'900', fontSize:'17px', marginBottom:'3px' }}>
            👤 Assign Sample to Analyst(s)
          </div>
          <div style={{ fontSize:'12px', color:'#DDD6FE' }}>
            Register new or select existing · assign multiple analysts · pick specific tests
          </div>
        </div>

        {/* Step indicator */}
        <div style={{ display:'flex', borderBottom:`1.5px solid ${PL}`, background:'#F5F3FF', flexShrink:0 }}>
          {STEPS.map((s,i) => (
            <div key={s} style={{ flex:1, padding:'10px 8px', textAlign:'center', fontSize:'11px', fontWeight:'700', color: i===step?P:i<step?GR:'#9CA3AF', borderBottom: i===step?`3px solid ${P}`:i<step?`3px solid ${GR}`:'3px solid transparent', background: i===step?'#fff':'transparent', cursor: i<step?'pointer':'default', transition:'all 0.15s' }}
              onClick={() => { if(i<step) setStep(i); }}
            >
              <div style={{ fontSize:'16px', marginBottom:'2px' }}>
                {i<step ? '✅' : i===step ? '●' : '○'}
              </div>
              {s}
            </div>
          ))}
        </div>

        {/* Content area */}
        <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>

          {done ? (
            // ── SUCCESS ──
            <div style={{ textAlign:'center', padding:'30px 20px' }}>
              <div style={{ fontSize:'56px', marginBottom:'14px' }}>✅</div>
              <div style={{ fontWeight:'900', color:GR, fontSize:'18px', marginBottom:'8px' }}>
                Assignment Sent Successfully!
              </div>
              <div style={{ fontSize:'13px', color:'#6B7280', lineHeight:1.7 }}>
                <strong>{selectedAnalystNames.length}</strong> analyst(s) assigned to <strong>{sampleForDisplay?.sample_name}</strong>.<br/>
                All supervisors have been notified and will brief the analyst(s).
              </div>
              <div style={{ marginTop:'16px', background:'#F0FDF4', border:'1.5px solid #86EFAC', borderRadius:'12px', padding:'12px 16px', fontSize:'13px', color:'#15803D', textAlign:'left' }}>
                <strong>Assigned to:</strong> {selectedAnalystNames.join(', ')}<br/>
                {selectedTestNames.length > 0 && <><strong>Tests:</strong> {selectedTestNames.join(', ')}</>}
              </div>
              <button onClick={onClose} style={{ marginTop:'20px', padding:'11px 28px', background:`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>
                Close
              </button>
            </div>

          ) : step === 0 ? (
            // ── STEP 0: SAMPLE SELECTION ──
            <>
              {/* Mode toggle */}
              <div style={{ display:'flex', gap:'6px', marginBottom:'18px', background:'#F5F3FF', borderRadius:'10px', padding:'5px' }}>
                {[['existing','🔍 Select Existing Sample'],['new','➕ Register New / Special Sample']].map(([m,l]) => (
                  <button key={m} onClick={() => { setSampleMode(m); setNewSampleObj(null); }}
                    style={{ flex:1, padding:'9px', borderRadius:'8px', border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:'12px', fontWeight:'700', background:sampleMode===m?`linear-gradient(135deg,${P},${PM})`:'transparent', color:sampleMode===m?'#fff':'#6B7280', transition:'all 0.2s' }}>
                    {l}
                  </button>
                ))}
              </div>

              {sampleMode === 'existing' ? (
                // Existing sample picker
                <div style={fld}>
                  <label style={lbl}>Select Pending / In-Progress Sample *</label>
                  <select value={selSampleId} onChange={e=>setSelSampleId(e.target.value)} style={sel}>
                    <option value="">— Choose a sample —</option>
                    {pendingSamples.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.sample_number} · {s.sample_name} ({s.departments?.name})
                      </option>
                    ))}
                  </select>
                  {pendingSamples.length === 0 && (
                    <p style={{ fontSize:'11px', color:'#9CA3AF', margin:'5px 0 0' }}>
                      No pending samples. Switch to "Register New" to create one.
                    </p>
                  )}
                  {selSampleObj && (
                    <div style={{ marginTop:'10px', background:'#F5F3FF', borderRadius:'10px', padding:'10px 14px', border:`1.5px solid ${PL}` }}>
                      <div style={{ fontWeight:'700', color:'#1F2937', fontSize:'13px' }}>{selSampleObj.sample_name}</div>
                      <div style={{ fontSize:'11px', color:PM, fontFamily:'monospace' }}>{selSampleObj.sample_number}</div>
                      <div style={{ fontSize:'11px', color:'#6B7280', marginTop:'3px' }}>{selSampleObj.departments?.name} · {selSampleObj.sample_types?.name}</div>
                    </div>
                  )}
                </div>
              ) : (
                // New sample registration form
                <>
                  <div style={fld}>
                    <label style={lbl}>Sample Name *</label>
                    <input type="text" value={newName} onChange={e=>setNewName(e.target.value)} style={inp} placeholder="e.g. Olein Oil - Tank 411 (Special)"/>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'14px' }}>
                    <div>
                      <label style={lbl}>Department *</label>
                      <select value={newDeptId} onChange={e=>{setNewDeptId(e.target.value);loadCats(e.target.value);}} style={sel}>
                        <option value="">— Select —</option>
                        {depts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>Category *</label>
                      <select value={newCatId} onChange={e=>{setNewCatId(e.target.value);loadTypes(e.target.value);}} style={sel} disabled={!newDeptId}>
                        <option value="">— Select —</option>
                        {cats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'14px' }}>
                    <div>
                      <label style={lbl}>Sample Type *</label>
                      <select value={newTypeId} onChange={e=>setNewTypeId(e.target.value)} style={sel} disabled={!newCatId}>
                        <option value="">— Select —</option>
                        {types.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>Batch / Lot Number</label>
                      <input type="text" value={newBatch} onChange={e=>setNewBatch(e.target.value)} style={inp} placeholder="Optional"/>
                    </div>
                  </div>
                  <div style={fld}>
                    <label style={lbl}>Sampler (who collected it) *</label>
                    <select value={samplerName} onChange={e=>setSamplerName(e.target.value)} style={sel}>
                      <option value="">— Select sampler —</option>
                      {samplers.map(s=><option key={s.id} value={s.full_name}>{s.full_name}</option>)}
                    </select>
                  </div>
                  <div style={fld}>
                    <label style={lbl}>Notes</label>
                    <textarea value={newNotes} onChange={e=>setNewNotes(e.target.value)} style={{ ...inp, minHeight:'50px', resize:'vertical' }} placeholder="Special instructions or context for this sample..."/>
                  </div>
                  {newSampleObj && (
                    <div style={{ background:'#F0FDF4', border:'1.5px solid #86EFAC', borderRadius:'10px', padding:'10px 14px', fontSize:'13px', color:GR, fontWeight:'700' }}>
                      ✅ Sample registered: {newSampleObj.sample_number}
                    </div>
                  )}
                </>
              )}
            </>

          ) : step === 1 ? (
            // ── STEP 1: ANALYST MULTI-SELECT ──
            <>
              <div style={{ fontWeight:'800', fontSize:'14px', color:'#1F2937', marginBottom:'4px' }}>
                Select Analyst(s) *
              </div>
              <p style={{ fontSize:'12px', color:'#6B7280', marginBottom:'14px' }}>
                Tick one or more analysts to assign this sample to. All selected will be notified via their supervisor.
              </p>

              {loadingData ? (
                <div style={{ textAlign:'center', padding:'24px', color:'#9CA3AF' }}>Loading analysts...</div>
              ) : analysts.length === 0 ? (
                <div style={{ textAlign:'center', padding:'24px', color:'#9CA3AF' }}>
                  No analysts found. Add staff via Admin → User Management.
                </div>
              ) : (
                <>
                  {/* Select all */}
                  <button onClick={() => setSelAnalysts(selAnalysts.size===analysts.length ? new Set() : new Set(analysts.map(a=>a.id)))}
                    style={{ fontSize:'11px', padding:'4px 12px', border:`1.5px solid ${PL}`, borderRadius:'8px', background:'#F5F3FF', color:P, cursor:'pointer', fontFamily:'inherit', fontWeight:'600', marginBottom:'10px' }}>
                    {selAnalysts.size===analysts.length ? 'Deselect All' : 'Select All'}
                  </button>

                  {analysts.map(a => {
                    const checked = selAnalysts.has(a.id);
                    return (
                      <div key={a.id} onClick={() => toggleAnalyst(a.id)}
                        style={{ ...chk, background:checked?'#F5F3FF':'#fff', borderColor:checked?PM:PL }}>
                        <div style={{ width:'18px', height:'18px', borderRadius:'5px', border:`2px solid ${checked?PM:'#D1D5DB'}`, background:checked?PM:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.15s' }}>
                          {checked && <span style={{ color:'#fff', fontSize:'12px', fontWeight:'900' }}>✓</span>}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:'700', color:'#1F2937', fontSize:'13px' }}>{a.full_name}</div>
                          <div style={{ fontSize:'11px', color:'#6B7280' }}>{a.roles?.name}{a.departments?.name ? ` · ${a.departments.name}` : ''}</div>
                        </div>
                        {checked && <span style={{ fontSize:'11px', color:PM, fontWeight:'700' }}>Selected</span>}
                      </div>
                    );
                  })}
                </>
              )}
            </>

          ) : step === 2 ? (
            // ── STEP 2: TEST MULTI-SELECT ──
            <>
              <div style={{ fontWeight:'800', fontSize:'14px', color:'#1F2937', marginBottom:'4px' }}>
                Select Tests to Assign (Optional)
              </div>
              <p style={{ fontSize:'12px', color:'#6B7280', marginBottom:'14px' }}>
                Choose specific tests for this assignment. Leave all unticked to assign all tests by default.
              </p>

              {tests.length === 0 ? (
                <div style={{ textAlign:'center', padding:'24px', background:'#F9FAFB', borderRadius:'12px', border:`1.5px solid ${PL}` }}>
                  <div style={{ fontSize:'24px', marginBottom:'8px' }}>📋</div>
                  <p style={{ fontWeight:'600', color:'#374151', fontSize:'13px', margin:0 }}>No tests configured for this sample type</p>
                  <p style={{ fontSize:'12px', color:'#9CA3AF', marginTop:'4px' }}>All standard tests will be assigned by default</p>
                </div>
              ) : (
                <>
                  <div style={{ display:'flex', gap:'8px', marginBottom:'10px' }}>
                    <button onClick={toggleAllTests}
                      style={{ fontSize:'11px', padding:'4px 12px', border:`1.5px solid ${PL}`, borderRadius:'8px', background:'#F5F3FF', color:P, cursor:'pointer', fontFamily:'inherit', fontWeight:'600' }}>
                      {selTests.size===tests.length ? 'Deselect All' : 'Select All Tests'}
                    </button>
                    <span style={{ fontSize:'11px', color:'#9CA3AF', display:'flex', alignItems:'center' }}>
                      {selTests.size} of {tests.length} selected
                    </span>
                  </div>

                  {tests.map(t => {
                    const checked = selTests.has(t.id);
                    const spec = t.test_specifications?.[0];
                    const specStr = spec?.display_spec || (spec?.min_value!==undefined ? `${spec.min_value}–${spec.max_value}` : '');
                    return (
                      <div key={t.id} onClick={() => toggleTest(t.id)}
                        style={{ ...chk, background:checked?'#F5F3FF':'#fff', borderColor:checked?PM:PL }}>
                        <div style={{ width:'18px', height:'18px', borderRadius:'5px', border:`2px solid ${checked?PM:'#D1D5DB'}`, background:checked?PM:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          {checked && <span style={{ color:'#fff', fontSize:'12px', fontWeight:'900' }}>✓</span>}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:'700', color:'#1F2937', fontSize:'13px' }}>{t.name}</div>
                          <div style={{ fontSize:'11px', color:'#6B7280' }}>
                            {t.unit && `Unit: ${t.unit}`}
                            {specStr && ` · Spec: (${specStr})`}
                          </div>
                        </div>
                        {checked && <span style={{ fontSize:'11px', color:PM, fontWeight:'700' }}>✓</span>}
                      </div>
                    );
                  })}
                </>
              )}
            </>

          ) : (
            // ── STEP 3: REVIEW & SEND ──
            <>
              <div style={{ fontWeight:'800', fontSize:'15px', color:'#1F2937', marginBottom:'14px' }}>
                Review Assignment Before Sending
              </div>

              {[
                {
                  icon:'🧪', label:'Sample',
                  val: sampleForDisplay
                    ? `${sampleForDisplay.sample_name} (${sampleForDisplay.sample_number||'New'})`
                    : '—',
                },
                {
                  icon:'👤', label:'Assigned Analysts',
                  val: selectedAnalystNames.length>0 ? selectedAnalystNames.join(', ') : '—',
                },
                {
                  icon:'🔬', label:'Tests',
                  val: selectedTestNames.length>0 ? selectedTestNames.join(', ') : 'All standard tests',
                },
              ].map(row => (
                <div key={row.label} style={{ display:'flex', gap:'10px', padding:'10px 14px', background:'#F5F3FF', borderRadius:'10px', border:`1.5px solid ${PL}`, marginBottom:'8px' }}>
                  <span style={{ fontSize:'18px', flexShrink:0 }}>{row.icon}</span>
                  <div>
                    <div style={{ fontSize:'11px', fontWeight:'700', color:P }}>{row.label}</div>
                    <div style={{ fontSize:'13px', color:'#1F2937', fontWeight:'600', marginTop:'2px' }}>{row.val}</div>
                  </div>
                </div>
              ))}

              {/* Final notes */}
              <div style={{ marginTop:'14px', marginBottom:'4px' }}>
                <label style={lbl}>Special Instructions / Notes (optional)</label>
                <textarea value={assignNote} onChange={e=>setAssignNote(e.target.value)} rows={3}
                  placeholder="Priority, deadline, specific method to use, or any other instructions..."
                  style={{ ...inp, minHeight:'70px', resize:'vertical' }}/>
              </div>

              <div style={{ background:'#FEFCE8', border:'1px solid #FDE68A', borderRadius:'10px', padding:'10px 14px', fontSize:'12px', color:'#854D0E', marginTop:'10px' }}>
                📢 After clicking Assign, <strong>all supervisors</strong> will immediately receive a notification on their dashboard to brief the analyst(s).
              </div>
            </>
          )}
        </div>

        {/* Footer buttons */}
        {!done && (
          <div style={{ padding:'14px 24px', borderTop:`1.5px solid ${PL}`, background:'#F9FAFB', display:'flex', gap:'10px', flexShrink:0 }}>
            {step > 0 && (
              <button onClick={() => setStep(s=>s-1)}
                style={{ padding:'11px 20px', border:`1.5px solid ${PL}`, borderRadius:'10px', background:'#fff', color:'#374151', fontSize:'13px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>
                ← Back
              </button>
            )}
            <button onClick={onClose}
              style={{ padding:'11px 20px', border:'1.5px solid #E5E7EB', borderRadius:'10px', background:'#fff', color:'#6B7280', fontSize:'13px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>
              Cancel
            </button>
            <div style={{ flex:1 }}/>
            {step < STEPS.length-1 ? (
              <button onClick={handleNext} disabled={!canProceed()||submitting}
                style={{ padding:'11px 24px', background:canProceed()&&!submitting?`linear-gradient(135deg,${P},${PM})`:'#A78BFA', color:'#fff', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:'700', cursor:canProceed()&&!submitting?'pointer':'not-allowed', fontFamily:'inherit', boxShadow:canProceed()?'0 2px 8px rgba(124,58,237,0.3)':'none' }}>
                {submitting ? 'Registering...' : `Next: ${STEPS[step+1]} →`}
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting}
                style={{ padding:'11px 24px', background:submitting?'#A78BFA':`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:'800', cursor:submitting?'not-allowed':'pointer', fontFamily:'inherit', boxShadow:'0 2px 8px rgba(124,58,237,0.3)' }}>
                {submitting ? 'Sending...' : '✅ Assign & Notify Supervisors'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
