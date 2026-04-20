import React, { useState, useEffect } from 'react';
import { useNavigate }    from 'react-router-dom';
import Navbar             from '../components/Navbar';
import PageFooter         from '../components/PageFooter';
import { useAuth }        from '../context/AuthContext';
import { lookupService }  from '../services/lookup.service';
import { samplesService } from '../services/samples.service';
import { toast }          from 'react-toastify';

export default function SampleRegistrationPage() {
  const { user, signingAs } = useAuth();
  const navigate = useNavigate();

  // Form values
  const [sampleName,   setSampleName]   = useState('');
  const [customName,   setCustomName]   = useState('');
  const [isCustom,     setIsCustom]     = useState(false);
  const [deptId,       setDeptId]       = useState('');
  const [catId,        setCatId]        = useState('');
  const [typeId,       setTypeId]       = useState('');
  const [brandId,      setBrandId]      = useState('');
  const [subtypeId,    setSubtypeId]    = useState('');
  const [batchNo,      setBatchNo]      = useState('');
  const [notes,        setNotes]        = useState('');
  const [samplerName,  setSamplerName]  = useState('');
  const [customSampler,setCustomSampler]= useState('');
  const [isCustomSamp, setIsCustomSamp] = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [successMsg,   setSuccessMsg]   = useState('');

  // Dropdown data
  const [depts,     setDepts]     = useState([]);
  const [cats,      setCats]      = useState([]);
  const [types,     setTypes]     = useState([]);
  const [brands,    setBrands]    = useState([]);
  const [subtypes,  setSubtypes]  = useState([]);
  const [namePresets,setNamePresets]=useState([]);
  const [samplers,  setSamplers]  = useState([]);
  const [needsSub,  setNeedsSub]  = useState(false);

  // Load depts + samplers on mount
  useEffect(() => {
    lookupService.getDepartments()
      .then(d => setDepts(d || []))
      .catch(() => toast.error('Cannot load departments'));
    lookupService.getLabStaff('Sampler')
      .then(d => setSamplers(d || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!deptId) {
      setCats([]); setBrands([]); setNamePresets([]);
      setCatId(''); setTypeId(''); setBrandId('');
      setSubtypeId(''); setSampleName('');
      return;
    }
    lookupService.getSampleCategories(deptId).then(d => setCats(d||[])).catch(()=>{});
    lookupService.getBrands(deptId).then(d => setBrands(d||[])).catch(()=>{});
    lookupService.getSampleNamePresets(deptId).then(d => setNamePresets(d||[])).catch(()=>{});
    setCatId(''); setTypeId(''); setBrandId(''); setSubtypeId('');
  }, [deptId]);

  useEffect(() => {
    if (!catId) { setTypes([]); setSubtypes([]); setTypeId(''); return; }
    lookupService.getSampleTypes(catId).then(d => setTypes(d||[])).catch(()=>{});
    lookupService.getSubtypes(catId).then(d => setSubtypes(d||[])).catch(()=>{});
    setTypeId('');
  }, [catId]);

  useEffect(() => {
    const found = types.find(t => t.id === typeId);
    setNeedsSub(found?.requires_subtype || false);
    setSubtypeId('');
  }, [typeId, types]);

  // Add a new custom sample name to DB
  const handleAddCustomName = async () => {
    if (!customName.trim() || !deptId) return;
    try {
      const preset = await lookupService.addSampleNamePreset(deptId, customName.trim());
      setNamePresets(prev => [...prev, preset]);
      setSampleName(preset.name);
      setCustomName('');
      setIsCustom(false);
      toast.success('Sample name added to list');
    } catch (e) {
      toast.error('Could not save sample name');
    }
  };

  // Add a new sampler to DB
  const handleAddCustomSampler = async () => {
    if (!customSampler.trim()) return;
    try {
      const staff = await lookupService.addLabStaff(customSampler.trim(), 'Sampler');
      setSamplers(prev => [...prev, staff]);
      setSamplerName(staff.full_name);
      setCustomSampler('');
      setIsCustomSamp(false);
      toast.success('Sampler added to list');
    } catch (e) {
      toast.error('Could not save sampler');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalName    = isCustom    ? customName.trim()    : sampleName;
    const finalSampler = isCustomSamp? customSampler.trim() : samplerName;

    if (!finalName)    { toast.warning('Enter a sample name'); return; }
    if (!deptId)       { toast.warning('Select a department'); return; }
    if (!catId)        { toast.warning('Select a category'); return; }
    if (!typeId)       { toast.warning('Select a sample type'); return; }
    if (needsSub && !subtypeId) { toast.warning('Select LBD or HBD'); return; }
    if (!finalSampler) { toast.warning('Select or enter the sampler who collected this sample'); return; }

    setSubmitting(true);
    try {
      const res = await samplesService.registerSample({
        sample_name    : finalName,
        department_id  : deptId,
        sample_type_id : typeId,
        brand_id       : brandId    || undefined,
        subtype_id     : subtypeId  || undefined,
        batch_number   : batchNo.trim() || undefined,
        notes          : notes.trim()   || undefined,
        sampler_name   : finalSampler,
      });

      setSuccessMsg(`✅ ${res.sampleNumber} — ${finalName}`);
      toast.success(`Sample ${res.sampleNumber} registered by ${finalSampler}`);
      setSampleName(''); setCustomName(''); setBatchNo('');
      setNotes(''); setBrandId(''); setSubtypeId('');
      setTypeId(''); setCatId(''); setSamplerName('');
      setIsCustom(false); setIsCustomSamp(false);
      setTimeout(() => setSuccessMsg(''), 8000);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Styles
  const inputSt = {
    width: '100%', border: '1.5px solid #E9D5FF',
    borderRadius: '10px', padding: '11px 14px',
    fontSize: '14px', color: '#111827',
    backgroundColor: '#fff', fontFamily: 'inherit',
    boxSizing: 'border-box', cursor: 'text',
  };
  const selectSt = {
    ...inputSt, cursor: 'pointer',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%237C3AED' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    paddingRight: '36px', appearance: 'none',
  };
  const labelSt = {
    display: 'block', fontSize: '12px',
    fontWeight: '700', color: '#4C1D95', marginBottom: '5px',
  };
  const fld = { marginBottom: '16px' };
  const addBtn = {
    background: '#7C3AED', color: '#fff', border: 'none',
    borderRadius: '8px', padding: '8px 14px',
    fontSize: '12px', fontWeight: '600',
    cursor: 'pointer', fontFamily: 'inherit',
    marginTop: '6px', whiteSpace: 'nowrap',
  };
  const linkBtn = {
    background: 'none', border: 'none',
    color: '#7C3AED', fontSize: '12px',
    cursor: 'pointer', fontFamily: 'inherit',
    textDecoration: 'underline', padding: '4px 0',
    display: 'block',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FAF5FF', paddingBottom: '60px' }}>
      <Navbar />

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px 16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <button type="button" onClick={() => navigate('/dashboard')}
            style={{
              padding: '8px 12px', border: '1.5px solid #E9D5FF',
              borderRadius: '10px', background: '#fff',
              cursor: 'pointer', fontSize: '16px',
            }}>
            ←
          </button>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '800',
                         color: '#1F2937', margin: '0 0 2px' }}>
              Register Sample
            </h2>
            <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>
              Session: <strong>{signingAs || user?.full_name}</strong>
            </p>
          </div>
        </div>

        {/* Success banner */}
        {successMsg && (
          <div style={{
            background: '#F0FDF4', border: '1.5px solid #86EFAC',
            borderRadius: '12px', padding: '14px 16px',
            marginBottom: '16px', color: '#166534',
            fontSize: '14px', fontWeight: '600',
          }}>
            {successMsg}
            <p style={{ fontSize: '12px', fontWeight: '400', marginTop: '4px' }}>
              Status: <strong>Pending</strong>. An analyst can now begin testing.
            </p>
            <button onClick={() => setSuccessMsg('')} style={linkBtn}>
              + Register another sample
            </button>
          </div>
        )}

        {/* Form */}
        <div style={{
          background: '#fff', borderRadius: '16px',
          border: '1.5px solid #E9D5FF', padding: '20px',
          boxShadow: '0 2px 12px rgba(124,58,237,0.08)',
        }}>

          <form onSubmit={handleSubmit}>

            {/* Department */}
            <div style={fld}>
              <label style={labelSt}>Department *</label>
              <select value={deptId} onChange={e => setDeptId(e.target.value)} style={selectSt}>
                <option value="">— Select Department —</option>
                {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            {/* Sample Name with dropdown + add new */}
            {deptId && (
              <div style={fld}>
                <label style={labelSt}>Sample Name / Label *</label>
                {!isCustom ? (
                  <>
                    <select
                      value={sampleName}
                      onChange={e => setSampleName(e.target.value)}
                      style={selectSt}
                    >
                      <option value="">— Select known sample name —</option>
                      {namePresets.map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                    <button type="button" style={linkBtn}
                      onClick={() => setIsCustom(true)}>
                      + Add new sample name not in list
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text" value={customName}
                        onChange={e => setCustomName(e.target.value)}
                        style={{ ...inputSt, flex: 1 }}
                        placeholder="Type new sample name..."
                        autoComplete="off"
                      />
                      <button type="button" onClick={handleAddCustomName} style={addBtn}>
                        Save & Use
                      </button>
                    </div>
                    <button type="button" style={linkBtn}
                      onClick={() => setIsCustom(false)}>
                      ← Pick from existing list
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Category */}
            {deptId && (
              <div style={fld}>
                <label style={labelSt}>Sample Category *</label>
                <select value={catId} onChange={e => setCatId(e.target.value)} style={selectSt}>
                  <option value="">{cats.length ? '— Select Category —' : 'Loading...'}</option>
                  {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            {/* Sample Type */}
            {catId && (
              <div style={fld}>
                <label style={labelSt}>Sample Type *</label>
                <select value={typeId} onChange={e => setTypeId(e.target.value)} style={selectSt}>
                  <option value="">{types.length ? '— Select Sample Type —' : 'Loading...'}</option>
                  {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}

            {/* Brand */}
            {deptId && brands.length > 0 && (
              <div style={fld}>
                <label style={labelSt}>Brand</label>
                <select value={brandId} onChange={e => setBrandId(e.target.value)} style={selectSt}>
                  <option value="">— Select Brand (optional) —</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}

            {/* LBD / HBD */}
            {needsSub && subtypes.length > 0 && (
              <div style={fld}>
                <label style={labelSt}>Form — LBD or HBD *</label>
                <select value={subtypeId} onChange={e => setSubtypeId(e.target.value)} style={selectSt}>
                  <option value="">— Select LBD or HBD —</option>
                  {subtypes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}

            {/* Batch Number */}
            <div style={fld}>
              <label style={labelSt}>Batch / Lot Number</label>
              <input type="text" value={batchNo} onChange={e => setBatchNo(e.target.value)}
                style={inputSt} placeholder="e.g. LOT-2024-001 (optional)" autoComplete="off" />
            </div>

            {/* Notes */}
            <div style={fld}>
              <label style={labelSt}>Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                style={{ ...inputSt, resize: 'vertical', minHeight: '64px', cursor: 'text' }}
                placeholder="Any additional notes... (optional)" />
            </div>

            {/* ── SAMPLER SIGNATURE (Item 9) ── */}
            <div style={{
              background: '#F5F3FF', borderRadius: '12px',
              border: '1.5px solid #DDD6FE', padding: '14px',
              marginBottom: '16px',
            }}>
              <label style={{ ...labelSt, color: '#6B21A8', marginBottom: '8px' }}>
                ✍️ Sampler Signature *
              </label>
              <p style={{ fontSize: '12px', color: '#7C3AED', marginBottom: '10px' }}>
                Select the sampler who collected and brought this sample to the lab.
                This is required for audit and traceability.
              </p>

              {!isCustomSamp ? (
                <>
                  <select
                    value={samplerName}
                    onChange={e => setSamplerName(e.target.value)}
                    style={selectSt}
                  >
                    <option value="">— Select Sampler Name —</option>
                    {samplers.map(s => (
                      <option key={s.id} value={s.full_name}>{s.full_name}</option>
                    ))}
                  </select>
                  <button type="button" style={linkBtn}
                    onClick={() => setIsCustomSamp(true)}>
                    + Sampler not in list? Add them
                  </button>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text" value={customSampler}
                      onChange={e => setCustomSampler(e.target.value)}
                      style={{ ...inputSt, flex: 1 }}
                      placeholder="Enter sampler full name..."
                    />
                    <button type="button" onClick={handleAddCustomSampler} style={addBtn}>
                      Save & Use
                    </button>
                  </div>
                  <button type="button" style={linkBtn}
                    onClick={() => setIsCustomSamp(false)}>
                    ← Pick from existing list
                  </button>
                </>
              )}

              {(samplerName || customSampler) && (
                <div style={{
                  marginTop: '10px', padding: '8px 12px',
                  background: '#EDE9FE', borderRadius: '8px',
                  fontSize: '13px', color: '#4C1D95', fontWeight: '600',
                }}>
                  ✅ Signed by: {isCustomSamp ? customSampler : samplerName}
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                background: submitting
                  ? '#A78BFA'
                  : 'linear-gradient(135deg, #6B21A8, #7C3AED)',
                color: '#fff', border: 'none',
                borderRadius: '12px', padding: '14px',
                fontSize: '15px', fontWeight: '700',
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                boxShadow: '0 4px 12px rgba(124,58,237,0.3)',
              }}
            >
              {submitting ? 'Registering...' : '🧪 Register Sample'}
            </button>

          </form>
        </div>
      </div>

      <PageFooter />
    </div>
  );
}