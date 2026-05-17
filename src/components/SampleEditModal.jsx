// ============================================================
// FILE: frontend/bul-qc-app/src/components/SampleEditModal.jsx
// Allows correcting a wrongly registered sample
// ============================================================

import React, { useState, useEffect } from 'react';
import { lookupService } from '../services/lookup.service';
import api from '../services/api';
import { toast } from 'react-toastify';

const P  = '#6B21A8';
const PM = '#7C3AED';
const PL = '#EDE9FE';
const RD = '#DC2626';

export default function SampleEditModal({ sample, onClose, onSaved }) {
  const [cats,       setCats]       = useState([]);
  const [types,      setTypes]      = useState([]);
  const [subtypes,   setSubtypes]   = useState([]);

  const [sampleName, setSampleName] = useState(sample?.sample_name || '');
  const [catId,      setCatId]      = useState(sample?.sample_types?.category_id || '');
  const [typeId,     setTypeId]     = useState(sample?.sample_type_id || '');
  const [subtypeId,  setSubtypeId]  = useState(sample?.subtype_id || '');
  const [batchNo,    setBatchNo]    = useState(sample?.batch_number || '');
  const [samplerName,setSampler]    = useState(sample?.sampler_name || '');
  const [notes,      setNotes]      = useState(sample?.notes || '');
  const [reason,     setReason]     = useState('');
  const [needsSub,   setNeedsSub]   = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [voiding,    setVoiding]    = useState(false);
  const [showVoid,   setShowVoid]   = useState(false);
  const [voidReason, setVoidReason] = useState('');

  const [typeChanged,  setTypeChanged]  = useState(false);

  const deptId = sample?.departments?.id || sample?.department_id;

  useEffect(() => {
    if (!deptId) return;
    lookupService.getSampleCategories(deptId).then(setCats).catch(()=>{});
  }, [deptId]);

  useEffect(() => {
    if (!catId) return;
    Promise.all([
      lookupService.getSampleTypes(catId),
      lookupService.getSubtypes(catId),
    ]).then(([t, s]) => {
      setTypes(t || []);
      setSubtypes(s || []);
    }).catch(()=>{});
  }, [catId]);

  const handleTypeChange = (e) => {
    const tid = e.target.value;
    setTypeId(tid);
    const t = types.find(x => x.id === tid);
    setNeedsSub(t?.requires_subtype || false);
    setSubtypeId('');
    // Flag if type is different from original
    setTypeChanged(tid !== sample?.sample_type_id);
  };

  const handleSave = async () => {
    if (!sampleName.trim()) { toast.warning('Sample name is required'); return; }
    if (!reason.trim())     { toast.warning('Please state the reason for correction'); return; }

    setSaving(true);
    try {
      const res = await api.put(`/samples/${sample.id}`, {
        sample_name      : sampleName.trim(),
        sample_type_id   : typeId   || undefined,
        subtype_id       : subtypeId || undefined,
        batch_number     : batchNo.trim() || undefined,
        sampler_name     : samplerName.trim() || undefined,
        notes            : notes.trim() || undefined,
        correction_reason: reason.trim(),
      });

      if (res.data?.testsReassigned) {
        toast.success('✅ Sample corrected and tests reassigned with correct specifications');
        if (res.data?.warning) toast.info(res.data.warning);
      } else {
        toast.success('✅ Sample corrected successfully');
      }
      onSaved();
      onClose();
    } catch(err) {
      toast.error(err.response?.data?.error || 'Failed to update sample');
    } finally { setSaving(false); }
  };

  const handleVoid = async () => {
    if (!voidReason.trim()) { toast.warning('Please give a reason for voiding'); return; }
    setVoiding(true);
    try {
      await api.put(`/samples/${sample.id}/void`, { reason: voidReason.trim() });
      toast.success('Sample voided and removed from active tracking');
      onSaved();
      onClose();
    } catch(err) {
      toast.error(err.response?.data?.error || 'Failed to void sample');
    } finally { setVoiding(false); }
  };

  const inp = {
    width:'100%', border:`1.5px solid ${PL}`, borderRadius:'9px',
    padding:'9px 12px', fontSize:'13px', fontFamily:'inherit',
    background:'#fff', color:'#111827', outline:'none', boxSizing:'border-box',
  };
  const sel = {
    ...inp, cursor:'pointer', appearance:'none',
    backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%237C3AED' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
    backgroundRepeat:'no-repeat', backgroundPosition:'right 10px center', paddingRight:'30px',
  };
  const lbl = { display:'block', fontSize:'12px', fontWeight:'700', color:'#4C1D95', marginBottom:'5px' };
  const fld = { marginBottom:'14px' };

  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>

      <div style={{ background:'#fff', borderRadius:'18px', maxWidth:'540px', width:'100%', maxHeight:'92vh', overflow:'hidden', boxShadow:'0 28px 80px rgba(0,0,0,0.35)', display:'flex', flexDirection:'column' }}>

        {/* Header */}
        <div style={{ background:`linear-gradient(135deg,${P},${PM})`, padding:'16px 22px', color:'#fff', flexShrink:0 }}>
          <div style={{ fontWeight:'900', fontSize:'16px', marginBottom:'2px' }}>
            ✏️ Correct Sample Registration
          </div>
          <div style={{ fontSize:'12px', color:'#DDD6FE' }}>
            {sample?.sample_number} · All changes are logged for audit
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'20px 22px' }}>

          {/* Current sample info */}
          <div style={{ background:'#FFF7ED', border:'1.5px solid #FED7AA', borderRadius:'10px', padding:'10px 14px', marginBottom:'16px', fontSize:'12px', color:'#92400E' }}>
            <strong>Current:</strong> {sample?.sample_name}
            {sample?.sample_types?.name && ` · ${sample.sample_types.name}`}
            {sample?.sampler_name && ` · Sampler: ${sample.sampler_name}`}
          </div>

          {/* Sample name */}
          <div style={fld}>
            <label style={lbl}>Sample Name *</label>
            <input type="text" value={sampleName} onChange={e=>setSampleName(e.target.value)} style={inp} placeholder="Correct sample name"/>
          </div>

          {/* Category */}
          {cats.length > 0 && (
            <div style={fld}>
              <label style={lbl}>Category</label>
              <select value={catId} onChange={e=>setCatId(e.target.value)} style={sel}>
                <option value="">— Keep current —</option>
                {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {/* Sample type */}
          {types.length > 0 && (
            <div style={fld}>
              <label style={lbl}>Sample Type</label>
              <select value={typeId} onChange={handleTypeChange} style={sel}>
                <option value="">— Keep current —</option>
                {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

          {/* Subtype (if needed) */}
          {needsSub && subtypes.length > 0 && (
            <div style={fld}>
              <label style={lbl}>Form / Pack Type *</label>
              <select value={subtypeId} onChange={e=>setSubtypeId(e.target.value)} style={sel}>
                <option value="">— Select —</option>
                {subtypes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          {/* Batch + Sampler */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'14px' }}>
            <div>
              <label style={lbl}>Batch / Lot Number</label>
              <input type="text" value={batchNo} onChange={e=>setBatchNo(e.target.value)} style={inp} placeholder="Optional"/>
            </div>
            <div>
              <label style={lbl}>Sampler Name</label>
              <input type="text" value={samplerName} onChange={e=>setSampler(e.target.value)} style={inp} placeholder="Who collected it"/>
            </div>
          </div>

          {/* Notes */}
          <div style={fld}>
            <label style={lbl}>Notes</label>
            <input type="text" value={notes} onChange={e=>setNotes(e.target.value)} style={inp} placeholder="Optional notes"/>
          </div>

          {/* Warning when sample type changes */}
          {typeChanged && (
            <div style={{ background:'#FEF9C3', border:'1.5px solid #FDE68A', borderRadius:'10px', padding:'10px 14px', marginBottom:'14px' }}>
              <div style={{ fontWeight:'800', color:'#854D0E', fontSize:'13px', marginBottom:'4px' }}>
                ⚠️ Sample Type Changed — Tests Will Be Reassigned
              </div>
              <p style={{ fontSize:'12px', color:'#92400E', margin:0, lineHeight:1.6 }}>
                Changing the sample type will <strong>automatically remove all unsubmitted tests</strong> and
                replace them with the correct tests and specifications for the new type.<br/>
                Any tests that already have results submitted will be kept.
              </p>
            </div>
          )}

          {/* Reason for correction — REQUIRED */}
          <div style={{ background:'#F5F3FF', border:`1.5px solid ${PL}`, borderRadius:'10px', padding:'12px 14px', marginBottom:'16px' }}>
            <label style={{ ...lbl, color:P }}>
              📋 Reason for Correction * (required for audit trail)
            </label>
            <textarea value={reason} onChange={e=>setReason(e.target.value)} rows={3}
              placeholder="Explain what was wrong and what was corrected e.g. Wrong sample type selected, corrected from Tank 411 to Tank 412..."
              style={{ ...inp, resize:'vertical', minHeight:'70px' }}/>
          </div>

          {/* Void section */}
          {!showVoid ? (
            <button type="button" onClick={() => setShowVoid(true)}
              style={{ background:'none', border:'none', color:RD, fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit', textDecoration:'underline', padding:0 }}>
              ❌ This sample should be voided entirely instead
            </button>
          ) : (
            <div style={{ background:'#FEF2F2', border:`1.5px solid #FECACA`, borderRadius:'10px', padding:'12px 14px' }}>
              <div style={{ fontWeight:'700', color:RD, fontSize:'13px', marginBottom:'8px' }}>
                ⚠️ Void this sample permanently
              </div>
              <p style={{ fontSize:'12px', color:'#6B7280', margin:'0 0 8px' }}>
                Voiding marks this sample as cancelled. It will no longer appear in active tracking or reports but stays in the audit log.
              </p>
              <textarea value={voidReason} onChange={e=>setVoidReason(e.target.value)} rows={2}
                placeholder="Reason for voiding e.g. Sample was contaminated, registered by mistake..."
                style={{ ...inp, resize:'vertical', borderColor:'#FECACA', marginBottom:'8px' }}/>
              <div style={{ display:'flex', gap:'8px' }}>
                <button onClick={handleVoid} disabled={voiding}
                  style={{ flex:1, padding:'9px', background:'linear-gradient(135deg,#DC2626,#B91C1C)', color:'#fff', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>
                  {voiding ? 'Voiding...' : '❌ Confirm Void'}
                </button>
                <button onClick={() => setShowVoid(false)}
                  style={{ padding:'9px 14px', background:'#F3F4F6', color:'#374151', border:'none', borderRadius:'8px', fontSize:'13px', cursor:'pointer', fontFamily:'inherit' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:'14px 22px', borderTop:`1.5px solid ${PL}`, background:'#F9FAFB', display:'flex', gap:'10px', flexShrink:0 }}>
          <button onClick={handleSave} disabled={saving}
            style={{ flex:1, padding:'12px', background:saving?'#A78BFA':`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:'700', cursor:saving?'not-allowed':'pointer', fontFamily:'inherit', boxShadow:'0 2px 8px rgba(124,58,237,0.3)' }}>
            {saving ? 'Saving...' : '✅ Save Correction'}
          </button>
          <button onClick={onClose}
            style={{ padding:'12px 20px', background:'#F3F4F6', color:'#374151', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
