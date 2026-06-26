// ============================================================
// FILE: src/pages/SampleRegistrationPage.jsx
// Fix: VehicleFields defined OUTSIDE main component
//      so React never unmounts/remounts it on re-render
// ============================================================

import React, { useState, useEffect } from 'react';
import { useNavigate }    from 'react-router-dom';
import Navbar             from '../components/Navbar';
import PageFooter         from '../components/PageFooter';
import { useAuth }        from '../context/AuthContext';
import { lookupService }  from '../services/lookup.service';
import { samplesService } from '../services/samples.service';
import { toast }          from 'react-toastify';

// ── Colours ───────────────────────────────────────────────
const P  = '#6B21A8';
const PM = '#7C3AED';
const PL = '#EDE9FE';

// ── Styles (module-level so sub-components can use them) ──
const INP = {
  width:'100%', border:`1.5px solid ${PL}`, borderRadius:'10px',
  padding:'10px 13px', fontSize:'14px', color:'#111827',
  background:'#fff', fontFamily:'inherit',
  boxSizing:'border-box', outline:'none',
};
const SEL = {
  ...INP, cursor:'pointer',
  backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%237C3AED' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
  backgroundRepeat:'no-repeat', backgroundPosition:'right 12px center',
  paddingRight:'36px', appearance:'none',
};
const LBL = {
  display:'block', fontSize:'12px', fontWeight:'700',
  color:'#4C1D95', marginBottom:'5px',
};
const FLD = { marginBottom:'14px' };
const LINK_BTN = {
  background:'none', border:'none', color:PM,
  fontSize:'12px', cursor:'pointer', fontFamily:'inherit',
  textDecoration:'underline', padding:'4px 0', display:'block',
};
const ADD_BTN = {
  background:PM, color:'#fff', border:'none', borderRadius:'8px',
  padding:'8px 14px', fontSize:'12px', fontWeight:'600',
  cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap',
};
const primaryBtn = (disabled) => ({
  width:'100%',
  background: disabled ? '#A78BFA' : `linear-gradient(135deg,${P},${PM})`,
  color:'#fff', border:'none', borderRadius:'12px', padding:'14px',
  fontSize:'15px', fontWeight:'700',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily:'inherit',
  boxShadow: disabled ? 'none' : '0 4px 12px rgba(124,58,237,0.3)',
});

// ══════════════════════════════════════════════════════════
// VehicleFields — OUTSIDE main component (critical fix)
// Defining it inside causes React to unmount/remount it on
// every state change, killing focus the moment you click.
// ══════════════════════════════════════════════════════════
function VehicleFields({ vehicleNo, containerNo, batchNo, onChange }) {
  return (
    <div style={{
      background:'#F9F7FF', border:`1.5px solid ${PL}`,
      borderRadius:'10px', padding:'12px 14px', marginBottom:'14px',
    }}>
      <div style={{ fontSize:'11px', fontWeight:'700', color:P, marginBottom:'10px', textTransform:'uppercase', letterSpacing:'0.5px' }}>
        🚛 Transport &amp; Batch Details
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px' }}>
        <div>
          <label style={LBL}>Vehicle Number</label>
          <input
            type="text"
            value={vehicleNo}
            onChange={e => onChange('vehicleNo', e.target.value)}
            placeholder="e.g. UAX 123F"
            style={INP}
          />
        </div>
        <div>
          <label style={LBL}>Container Number</label>
          <input
            type="text"
            value={containerNo}
            onChange={e => onChange('containerNo', e.target.value)}
            placeholder="e.g. CTR-001"
            style={INP}
          />
        </div>
        <div>
          <label style={LBL}>Batch Number</label>
          <input
            type="text"
            value={batchNo}
            onChange={e => onChange('batchNo', e.target.value)}
            placeholder="e.g. BUL-2026-001"
            style={INP}
          />
        </div>
      </div>
    </div>
  );
}

// ── Empty sample template ─────────────────────────────────
const emptySample = () => ({
  id           : Date.now() + Math.random(),
  sampleName   : '',
  customName   : '',
  isCustomName : false,
  catId        : '',
  typeId       : '',
  brandId      : '',
  subtypeId    : '',
  vehicleNo    : '',
  containerNo  : '',
  batchNo      : '',
  notes        : '',
  samplerName  : '',
  customSampler: '',
  isCustomSamp : false,
  needsSub     : false,
  cats         : [],
  types        : [],
  subtypes     : [],
  namePresets  : [],
});

// ═══════════════════════════════════════════════════════════
export default function SampleRegistrationPage() {
  const { user, signingAs } = useAuth();
  const navigate = useNavigate();

  const [mode,        setMode]        = useState('single');
  const [deptId,      setDeptId]      = useState('');
  const [depts,       setDepts]       = useState([]);
  const [brands,      setBrands]      = useState([]);
  const [samplers,    setSamplers]    = useState([]);
  const [namePresets, setNamePresets] = useState([]);
  const [submitting,  setSubmitting]  = useState(false);
  const [successList, setSuccessList] = useState([]);

  // Single mode
  const [single,        setSingle]        = useState(emptySample());
  const [addingName,    setAddingName]    = useState(false);
  const [newCustomName, setNewCustomName] = useState('');

  // Bulk mode
  const [bulkSamples,       setBulkSamples]       = useState([emptySample()]);
  const [bulkSampler,       setBulkSampler]       = useState('');
  const [bulkCustomSampler, setBulkCustomSampler] = useState('');
  const [addingBulkSampler, setAddingBulkSampler] = useState(false);

  // ── Load departments + samplers ───────────────────────────
  useEffect(() => {
    lookupService.getDepartments()
      .then(d => setDepts(d || []))
      .catch(() => toast.error('Cannot load departments'));
    lookupService.getLabStaff('Sampler')
      .then(d => setSamplers(d || []))
      .catch(() => {});
  }, []);

  // ── When department changes ───────────────────────────────
  useEffect(() => {
    if (!deptId) {
      setBrands([]); setNamePresets([]);
      setSingle(emptySample());
      setBulkSamples([emptySample()]);
      return;
    }
    lookupService.getBrands(deptId).then(d => setBrands(d||[])).catch(()=>{});
    lookupService.getSampleNamePresets(deptId).then(d => setNamePresets(d||[])).catch(()=>{});
    lookupService.getSampleCategories(deptId).then(cats => {
      setSingle(prev => ({ ...prev, cats, catId:'', typeId:'', subtypeId:'' }));
      setBulkSamples(prev => prev.map(s => ({ ...s, cats, catId:'', typeId:'', subtypeId:'' })));
    }).catch(()=>{});
  }, [deptId]);

  // ── Helpers ───────────────────────────────────────────────
  const updateBulk = (idx, field, value) => {
    setBulkSamples(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  const loadBulkCats = async (idx) => {
    if (!deptId) return;
    try {
      const cats = await lookupService.getSampleCategories(deptId);
      updateBulk(idx, 'cats', cats || []);
    } catch(e) {}
  };

  const loadBulkTypes = async (idx, catId) => {
    if (!catId) return;
    try {
      const [types, subtypes] = await Promise.all([
        lookupService.getSampleTypes(catId),
        lookupService.getSubtypes(catId),
      ]);
      setBulkSamples(prev => {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], types:types||[], subtypes:subtypes||[], typeId:'', subtypeId:'' };
        return updated;
      });
    } catch(e) {}
  };

  const addBulkRow = () => {
  if (bulkSamples.length >= 20) { toast.warning('Maximum 20 samples at once'); return; }
  setBulkSamples(prev => {
    const last = prev[prev.length-1];
    // Only inherit the categories list (safe — same dept, no fetch needed).
    // Do NOT inherit catId/types/subtypes: that skips the fetch that loads
    // subtypes, which is why Form never appeared on row 2+.
    return [...prev, { ...emptySample(), id:Date.now()+Math.random(), cats:last.cats||[] }];
  });
};

  const removeBulkRow = (idx) => {
    if (bulkSamples.length === 1) { toast.warning('Need at least one sample'); return; }
    setBulkSamples(prev => prev.filter((_, i) => i !== idx));
  };

  const addNewSampler = async (name) => {
    if (!name.trim()) return null;
    try {
      const staff = await lookupService.addLabStaff(name.trim(), 'Sampler');
      setSamplers(prev => [...prev, staff]);
      return staff.full_name;
    } catch(e) { toast.error('Could not save sampler'); return null; }
  };

  const addNewPreset = async (name) => {
    if (!name.trim() || !deptId) return null;
    try {
      const preset = await lookupService.addSampleNamePreset(deptId, name.trim());
      setNamePresets(prev => [...prev, preset]);
      return preset.name;
    } catch(e) { toast.error('Could not save sample name'); return null; }
  };

  const loadSingleCats = async (newDeptId) => {
    if (!newDeptId) return;
    try {
      const cats = await lookupService.getSampleCategories(newDeptId);
      setSingle(prev => ({ ...prev, cats:cats||[], catId:'', typeId:'', subtypeId:'' }));
    } catch(e) {}
  };

  const loadSingleTypes = async (catId) => {
    if (!catId) return;
    try {
      const [types, subtypes] = await Promise.all([
        lookupService.getSampleTypes(catId),
        lookupService.getSubtypes(catId),
      ]);
      setSingle(prev => ({ ...prev, types:types||[], subtypes:subtypes||[], typeId:'', subtypeId:'', needsSub:false }));
    } catch(e) {}
  };

  // ── SINGLE SUBMIT ─────────────────────────────────────────
  const submitSingle = async (e) => {
    e.preventDefault();
    const finalName    = single.isCustomName ? single.customName.trim() : single.sampleName;
    const finalSampler = single.isCustomSamp ? single.customSampler.trim() : single.samplerName;

    if (!finalName)    { toast.warning('Enter a sample name'); return; }
    if (!deptId)       { toast.warning('Select a department'); return; }
    if (!single.catId) { toast.warning('Select a category'); return; }
    if (!single.typeId){ toast.warning('Select a sample type'); return; }
    if (single.needsSub && !single.subtypeId){ toast.warning('Select a form'); return; }
    if (!finalSampler) { toast.warning('Select the sampler'); return; }

    setSubmitting(true);
    try {
      const res = await samplesService.registerSample({
        sample_name     : finalName,
        department_id   : deptId,
        sample_type_id  : single.typeId,
        brand_id        : single.brandId      || undefined,
        subtype_id      : single.subtypeId    || undefined,
        vehicle_number  : single.vehicleNo.trim()    || undefined,
        container_number: single.containerNo.trim()  || undefined,
        batch_number    : single.batchNo.trim()      || undefined,
        notes           : single.notes.trim()        || undefined,
        sampler_name    : finalSampler,
      });

      setSuccessList([{ sampleNumber:res.sampleNumber, sampleName:finalName, sampler:finalSampler }]);
      toast.success(`✅ ${res.sampleNumber} registered`);
      setSingle(prev => ({ ...prev, sampleName:'', customName:'', vehicleNo:'', containerNo:'', batchNo:'', notes:'', subtypeId:'' }));
      setTimeout(() => setSuccessList([]), 10000);
    } catch(err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally { setSubmitting(false); }
  };

  // ── BULK SUBMIT ───────────────────────────────────────────
  const submitBulk = async (e) => {
    e.preventDefault();
    const finalSampler = addingBulkSampler ? bulkCustomSampler.trim() : bulkSampler;
    if (!deptId)       { toast.warning('Select a department first'); return; }
    if (!finalSampler) { toast.warning('Select the sampler'); return; }

    for (let i = 0; i < bulkSamples.length; i++) {
      const s    = bulkSamples[i];
      const name = s.isCustomName ? s.customName.trim() : s.sampleName;
      if (!name)    { toast.warning(`Row ${i+1}: Enter a sample name`); return; }
      if (!s.catId) { toast.warning(`Row ${i+1}: Select a category`); return; }
      if (!s.typeId){ toast.warning(`Row ${i+1}: Select a sample type`); return; }
      if (s.needsSub && !s.subtypeId){ toast.warning(`Row ${i+1}: Select a form`); return; }
    }

    setSubmitting(true);
    try {
      const payload = bulkSamples.map(s => ({
        sample_name     : s.isCustomName ? s.customName.trim() : s.sampleName,
        department_id   : deptId,
        sample_type_id  : s.typeId,
        brand_id        : s.brandId       || undefined,
        subtype_id      : s.subtypeId     || undefined,
        vehicle_number  : s.vehicleNo.trim()    || undefined,
        container_number: s.containerNo.trim()  || undefined,
        batch_number    : s.batchNo.trim()      || undefined,
        notes           : s.notes.trim()        || undefined,
        sampler_name    : finalSampler,
      }));

      const res = await samplesService.registerBulkSamples(payload);
      setSuccessList(res.registered.map(r => ({ sampleNumber:r.sampleNumber, sampleName:r.sample_name, sampler:finalSampler })));
      if (res.errors?.length > 0) res.errors.forEach(e => toast.error(`${e.sample_name}: ${e.error}`));
      toast.success(`✅ ${res.successful} sample(s) registered successfully`);
      setBulkSamples([emptySample()]);
      setBulkSampler('');
      setTimeout(() => setSuccessList([]), 15000);
    } catch(err) {
      toast.error(err.response?.data?.error || 'Bulk registration failed');
    } finally { setSubmitting(false); }
  };

  // ── Subtype filter helper ─────────────────────────────────
  const filterSubtypes = (subtypes, types, typeId) => {
    const typeName = ((types||[]).find(t=>t.id===typeId)?.name||'').toLowerCase();
    return (subtypes||[]).filter(sub => {
      if (typeName === 'pa' || typeName.startsWith('pa ')) return sub.code === 'HBD';
      if (typeName.includes('base') || typeName.includes('powder')) return true;
      return true;
    });
  };

  return (
    <div style={{ minHeight:'100vh', background:'#FAF5FF', paddingBottom:'60px' }}>
      <Navbar />

      <div style={{ maxWidth:'700px', margin:'0 auto', padding:'20px 16px' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px' }}>
          <button type="button" onClick={() => navigate('/dashboard')}
            style={{ padding:'8px 12px', border:`1.5px solid ${PL}`, borderRadius:'10px', background:'#fff', cursor:'pointer', fontSize:'16px' }}>
            ←
          </button>
          <div>
            <h2 style={{ fontSize:'18px', fontWeight:'800', color:'#1F2937', margin:'0 0 2px' }}>
              Register Sample{mode === 'bulk' ? 's' : ''}
            </h2>
            <p style={{ fontSize:'12px', color:'#9CA3AF', margin:0 }}>
              Session: <strong>{signingAs || user?.full_name}</strong>
            </p>
          </div>
        </div>

        {/* Mode toggle */}
        <div style={{ display:'flex', gap:'6px', marginBottom:'20px', background:'#fff', padding:'6px', borderRadius:'14px', border:`1.5px solid ${PL}` }}>
          {[
            { key:'single', label:'📋 Single Sample',     desc:'Register one sample'       },
            { key:'bulk',   label:'📦 Bulk Registration', desc:'Register multiple at once' },
          ].map(m => (
            <button key={m.key} type="button" onClick={() => { setMode(m.key); setSuccessList([]); }}
              style={{ flex:1, padding:'10px 8px', borderRadius:'10px', border:'none', cursor:'pointer', fontFamily:'inherit', textAlign:'center', background:mode===m.key?`linear-gradient(135deg,${P},${PM})`:'transparent', color:mode===m.key?'#fff':'#6B7280', fontWeight:'700', fontSize:'13px', boxShadow:mode===m.key?'0 2px 8px rgba(107,33,168,0.3)':'none', transition:'all 0.2s' }}>
              {m.label}
              <div style={{ fontSize:'10px', opacity:0.8, marginTop:'2px' }}>{m.desc}</div>
            </button>
          ))}
        </div>

        {/* Success banner */}
        {successList.length > 0 && (
          <div style={{ background:'#F0FDF4', border:'1.5px solid #86EFAC', borderRadius:'12px', padding:'14px 16px', marginBottom:'16px' }}>
            <p style={{ color:'#166534', fontWeight:'700', fontSize:'14px', marginBottom:'8px' }}>
              ✅ {successList.length} sample(s) registered successfully!
            </p>
            {successList.map((s,i) => (
              <div key={i} style={{ fontSize:'13px', color:'#166534', marginBottom:'3px' }}>
                <strong>{s.sampleNumber}</strong> — {s.sampleName} (Sampler: {s.sampler})
              </div>
            ))}
          </div>
        )}

        {/* Department */}
        <div style={{ background:'#fff', borderRadius:'16px', border:`1.5px solid ${PL}`, padding:'20px', marginBottom:'16px' }}>
          <div style={FLD}>
            <label style={LBL}>Department *</label>
            <select value={deptId} onChange={e => { setDeptId(e.target.value); loadSingleCats(e.target.value); }} style={SEL}>
              <option value="">— Select Department —</option>
              {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            SINGLE MODE
        ═══════════════════════════════════════════════════ */}
        {mode === 'single' && deptId && (
          <form onSubmit={submitSingle}>
            <div style={{ background:'#fff', borderRadius:'16px', border:`1.5px solid ${PL}`, padding:'20px', marginBottom:'16px' }}>

              {/* Sample name */}
              <div style={FLD}>
                <label style={LBL}>Sample Name *</label>
                {!single.isCustomName ? (
                  <>
                    <select value={single.sampleName} onChange={e => setSingle(prev=>({...prev,sampleName:e.target.value}))} style={SEL}>
                      <option value="">— Select sample name —</option>
                      {namePresets.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                    <button type="button" style={LINK_BTN} onClick={() => setAddingName(true)}>
                      + Add new name not in list
                    </button>
                    {addingName && (
                      <div style={{ display:'flex', gap:'8px', marginTop:'6px' }}>
                        <input type="text" value={newCustomName} onChange={e => setNewCustomName(e.target.value)} style={{ ...INP, flex:1 }} placeholder="Type new name..." />
                        <button type="button" style={ADD_BTN} onClick={async () => {
                          const saved = await addNewPreset(newCustomName);
                          if (saved) { setSingle(prev=>({...prev,sampleName:saved})); setNewCustomName(''); setAddingName(false); }
                        }}>Save & Use</button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ display:'flex', gap:'8px' }}>
                      <input type="text" value={single.customName} onChange={e => setSingle(prev=>({...prev,customName:e.target.value}))} style={{ ...INP, flex:1 }} placeholder="Type new sample name..." />
                      <button type="button" style={ADD_BTN} onClick={async () => {
                        const saved = await addNewPreset(single.customName);
                        if (saved) setSingle(prev=>({...prev,sampleName:saved,isCustomName:false,customName:''}));
                      }}>Save & Use</button>
                    </div>
                    <button type="button" style={LINK_BTN} onClick={() => setSingle(prev=>({...prev,isCustomName:false}))}>← Pick from list</button>
                  </>
                )}
              </div>

              {/* Category */}
              <div style={FLD}>
                <label style={LBL}>Category *</label>
                <select value={single.catId} onChange={e => { setSingle(prev=>({...prev,catId:e.target.value})); loadSingleTypes(e.target.value); }} style={SEL}>
                  <option value="">— Select Category —</option>
                  {(single.cats||[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Sample type */}
              {single.catId && (
                <div style={FLD}>
                  <label style={LBL}>Sample Type *</label>
                  <select value={single.typeId} onChange={e => {
                    const t = (single.types||[]).find(x=>x.id===e.target.value);
                    setSingle(prev=>({...prev,typeId:e.target.value,needsSub:t?.requires_subtype||false,subtypeId:''}));
                  }} style={SEL}>
                    <option value="">— Select Type —</option>
                    {(single.types||[]).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}

              {/* Subtype */}
              {single.needsSub && (single.subtypes||[]).length > 0 && (
                <div style={FLD}>
                  <label style={LBL}>Form *</label>
                  <select value={single.subtypeId} onChange={e => setSingle(prev=>({...prev,subtypeId:e.target.value}))} style={SEL}>
                    <option value="">— Select Form —</option>
                    {filterSubtypes(single.subtypes, single.types, single.typeId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}

              {/* Brand */}
              {brands.length > 0 && (
                <div style={FLD}>
                  <label style={LBL}>Brand</label>
                  <select value={single.brandId} onChange={e => setSingle(prev=>({...prev,brandId:e.target.value}))} style={SEL}>
                    <option value="">— Select Brand (optional) —</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}

              {/* Vehicle / Container / Batch — uses external component */}
              <VehicleFields
                vehicleNo={single.vehicleNo}
                containerNo={single.containerNo}
                batchNo={single.batchNo}
                onChange={(field, val) => setSingle(prev=>({...prev,[field]:val}))}
              />

              {/* Notes */}
              <div style={{ marginBottom:0 }}>
                <label style={LBL}>Notes</label>
                <textarea value={single.notes} onChange={e => setSingle(prev=>({...prev,notes:e.target.value}))}
                  style={{ ...INP, resize:'vertical', minHeight:'60px' }} placeholder="Optional notes..." />
              </div>
            </div>

            {/* Sampler */}
            <div style={{ background:'#F5F3FF', borderRadius:'12px', border:`1.5px solid ${PL}`, padding:'14px', marginBottom:'16px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:P, marginBottom:'6px' }}>✍️ Sampler Signature *</div>
              {!single.isCustomSamp ? (
                <>
                  <select value={single.samplerName} onChange={e => setSingle(prev=>({...prev,samplerName:e.target.value}))} style={SEL}>
                    <option value="">— Select Sampler —</option>
                    {samplers.map(s => <option key={s.id} value={s.full_name}>{s.full_name}</option>)}
                  </select>
                  {single.samplerName && (
                    <div style={{ marginTop:'8px', padding:'7px 10px', background:'#EDE9FE', borderRadius:'8px', fontSize:'13px', color:P, fontWeight:'600' }}>
                      ✅ Signed by: {single.samplerName}
                    </div>
                  )}
                  <button type="button" style={LINK_BTN} onClick={() => setSingle(prev=>({...prev,isCustomSamp:true}))}>
                    + Sampler not in list? Add them
                  </button>
                </>
              ) : (
                <>
                  <div style={{ display:'flex', gap:'8px' }}>
                    <input type="text" value={single.customSampler} onChange={e => setSingle(prev=>({...prev,customSampler:e.target.value}))} style={{ ...INP, flex:1 }} placeholder="Enter sampler full name..." />
                    <button type="button" style={ADD_BTN} onClick={async () => {
                      const saved = await addNewSampler(single.customSampler);
                      if (saved) setSingle(prev=>({...prev,samplerName:saved,isCustomSamp:false,customSampler:''}));
                    }}>Save & Use</button>
                  </div>
                  <button type="button" style={LINK_BTN} onClick={() => setSingle(prev=>({...prev,isCustomSamp:false}))}>← Pick from list</button>
                </>
              )}
            </div>

            <button type="submit" disabled={submitting} style={primaryBtn(submitting)}>
              {submitting ? 'Registering...' : '🧪 Register Sample'}
            </button>
          </form>
        )}

        {/* ═══════════════════════════════════════════════════
            BULK MODE
        ═══════════════════════════════════════════════════ */}
        {mode === 'bulk' && deptId && (
          <form onSubmit={submitBulk}>

            {/* Bulk sampler */}
            <div style={{ background:'#F5F3FF', borderRadius:'12px', border:`1.5px solid ${PL}`, padding:'14px', marginBottom:'16px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:P, marginBottom:'6px' }}>
                ✍️ Sampler Signature * (applies to all samples below)
              </div>
              {!addingBulkSampler ? (
                <>
                  <select value={bulkSampler} onChange={e => setBulkSampler(e.target.value)} style={SEL}>
                    <option value="">— Select Sampler —</option>
                    {samplers.map(s => <option key={s.id} value={s.full_name}>{s.full_name}</option>)}
                  </select>
                  {bulkSampler && (
                    <div style={{ marginTop:'8px', padding:'7px 10px', background:'#EDE9FE', borderRadius:'8px', fontSize:'13px', color:P, fontWeight:'600' }}>
                      ✅ Signed by: {bulkSampler}
                    </div>
                  )}
                  <button type="button" style={LINK_BTN} onClick={() => setAddingBulkSampler(true)}>
                    + Sampler not in list? Add them
                  </button>
                </>
              ) : (
                <>
                  <div style={{ display:'flex', gap:'8px' }}>
                    <input type="text" value={bulkCustomSampler} onChange={e => setBulkCustomSampler(e.target.value)} style={{ ...INP, flex:1 }} placeholder="Enter sampler full name..." />
                    <button type="button" style={ADD_BTN} onClick={async () => {
                      const saved = await addNewSampler(bulkCustomSampler);
                      if (saved) { setBulkSampler(saved); setAddingBulkSampler(false); setBulkCustomSampler(''); }
                    }}>Save & Use</button>
                  </div>
                  <button type="button" style={LINK_BTN} onClick={() => setAddingBulkSampler(false)}>← Pick from list</button>
                </>
              )}
            </div>

            {/* Sample rows */}
            <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'16px' }}>
              {bulkSamples.map((s, idx) => (
                <div key={s.id} style={{ background:'#fff', borderRadius:'16px', border:`1.5px solid ${PL}`, padding:'16px' }}>

                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
                    <div style={{ background:`linear-gradient(135deg,${P},${PM})`, color:'#fff', borderRadius:'8px', padding:'4px 12px', fontSize:'12px', fontWeight:'700' }}>
                      Sample {idx + 1}
                    </div>
                    {bulkSamples.length > 1 && (
                      <button type="button" onClick={() => removeBulkRow(idx)}
                        style={{ background:'#FEF2F2', color:'#DC2626', border:'1px solid #FECACA', borderRadius:'8px', padding:'4px 10px', fontSize:'12px', cursor:'pointer', fontFamily:'inherit' }}>
                        ✕ Remove
                      </button>
                    )}
                  </div>

                  {/* Sample name */}
                  <div style={FLD}>
                    <label style={LBL}>Sample Name *</label>
                    <select value={s.sampleName} onChange={e => updateBulk(idx,'sampleName',e.target.value)} style={SEL}
                      onFocus={() => { if (!s.cats?.length) loadBulkCats(idx); }}>
                      <option value="">— Select name —</option>
                      {namePresets.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                  </div>

                  {/* Category */}
                  <div style={FLD}>
                    <label style={LBL}>Category *</label>
                    <select value={s.catId} onChange={e => { updateBulk(idx,'catId',e.target.value); loadBulkTypes(idx,e.target.value); }} style={SEL}
                      onFocus={() => { if (!s.cats?.length) loadBulkCats(idx); }}>
                      <option value="">— Select Category —</option>
                      {(s.cats||[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  {/* Sample type */}
                  {s.catId && (
                    <div style={FLD}>
                      <label style={LBL}>Sample Type *</label>
                      <select value={s.typeId} onChange={e => {
                        const t = (s.types||[]).find(x=>x.id===e.target.value);
                        updateBulk(idx,'typeId',e.target.value);
                        updateBulk(idx,'needsSub',t?.requires_subtype||false);
                        updateBulk(idx,'subtypeId','');
                      }} style={SEL}>
                        <option value="">— Select Type —</option>
                        {(s.types||[]).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Subtype */}
                  {s.needsSub && (s.subtypes||[]).length > 0 && (
                    <div style={FLD}>
                      <label style={LBL}>Form *</label>
                      <select value={s.subtypeId} onChange={e => updateBulk(idx,'subtypeId',e.target.value)} style={SEL}>
                        <option value="">— Select Form —</option>
                        {filterSubtypes(s.subtypes, s.types, s.typeId).map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Vehicle / Container / Batch — uses external component */}
                  <VehicleFields
                    vehicleNo={s.vehicleNo}
                    containerNo={s.containerNo}
                    batchNo={s.batchNo}
                    onChange={(field, val) => updateBulk(idx, field, val)}
                  />

                  {/* Notes */}
                  <div style={{ marginBottom:0 }}>
                    <label style={LBL}>Notes</label>
                    <input type="text" value={s.notes} onChange={e => updateBulk(idx,'notes',e.target.value)} style={INP} placeholder="Optional" />
                  </div>
                </div>
              ))}
            </div>

            {/* Add row */}
            <button type="button" onClick={addBulkRow}
              style={{ width:'100%', padding:'12px', borderRadius:'12px', border:`2px dashed ${PM}`, background:'#F5F3FF', color:PM, fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit', marginBottom:'16px' }}>
              + Add Another Sample ({bulkSamples.length}/20)
            </button>

            {/* Summary */}
            <div style={{ background:'#EDE9FE', borderRadius:'12px', padding:'12px 16px', marginBottom:'16px', fontSize:'13px', color:P }}>
              <strong>Ready to register:</strong> {bulkSamples.length} sample(s)
              {bulkSampler && <span> — Sampler: <strong>{bulkSampler}</strong></span>}
            </div>

            <button type="submit" disabled={submitting} style={primaryBtn(submitting)}>
              {submitting ? 'Registering...' : `🧪 Register All ${bulkSamples.length} Sample(s)`}
            </button>
          </form>
        )}

        {/* No department selected */}
        {!deptId && (
          <div style={{ textAlign:'center', padding:'40px', color:'#9CA3AF' }}>
            <div style={{ fontSize:'40px', marginBottom:'10px' }}>⬆️</div>
            <p style={{ fontWeight:'600' }}>Select a department above to begin</p>
          </div>
        )}

      </div>
      <PageFooter />
    </div>
  );
}
