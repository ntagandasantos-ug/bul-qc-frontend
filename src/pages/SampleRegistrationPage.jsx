import React, { useState, useEffect } from 'react';
import { useNavigate }    from 'react-router-dom';
import Navbar             from '../components/Navbar';
import { useAuth }        from '../context/AuthContext';
import { lookupService }  from '../services/lookup.service';
import { samplesService } from '../services/samples.service';
import { toast }          from 'react-toastify';

export default function SampleRegistrationPage() {
  const { user, signingAs } = useAuth();
  const navigate = useNavigate();

  // Form values
  const [sampleName,   setSampleName]   = useState('');
  const [deptId,       setDeptId]       = useState('');
  const [catId,        setCatId]        = useState('');
  const [typeId,       setTypeId]       = useState('');
  const [brandId,      setBrandId]      = useState('');
  const [subtypeId,    setSubtypeId]    = useState('');
  const [batchNo,      setBatchNo]      = useState('');
  const [notes,        setNotes]        = useState('');
  const [submitting,   setSubmitting]   = useState(false);
  const [successMsg,   setSuccessMsg]   = useState('');

  // Dropdown options
  const [depts,      setDepts]      = useState([]);
  const [cats,       setCats]       = useState([]);
  const [types,      setTypes]      = useState([]);
  const [brands,     setBrands]     = useState([]);
  const [subtypes,   setSubtypes]   = useState([]);
  const [needsSub,   setNeedsSub]   = useState(false);

  // Load departments on first render
  useEffect(() => {
    lookupService.getDepartments()
      .then(d => setDepts(d || []))
      .catch(() => toast.error('Cannot load departments. Is the backend running?'));
  }, []);

  // Load categories + brands when dept chosen
  useEffect(() => {
    if (!deptId) {
      setCats([]); setBrands([]);
      setCatId(''); setTypeId(''); setBrandId(''); setSubtypeId('');
      return;
    }
    lookupService.getSampleCategories(deptId)
      .then(d => setCats(d || []))
      .catch(() => toast.error('Cannot load categories'));
    lookupService.getBrands(deptId)
      .then(d => setBrands(d || []))
      .catch(() => {});
    setCatId(''); setTypeId(''); setBrandId(''); setSubtypeId('');
  }, [deptId]);

  // Load sample types + subtypes when category chosen
  useEffect(() => {
    if (!catId) {
      setTypes([]); setSubtypes([]);
      setTypeId(''); setSubtypeId('');
      return;
    }
    lookupService.getSampleTypes(catId)
      .then(d => setTypes(d || []))
      .catch(() => toast.error('Cannot load sample types'));
    lookupService.getSubtypes(catId)
      .then(d => setSubtypes(d || []))
      .catch(() => {});
    setTypeId(''); setSubtypeId('');
  }, [catId]);

  // Check if subtype required when sample type chosen
  useEffect(() => {
    const found = types.find(t => t.id === typeId);
    setNeedsSub(found?.requires_subtype || false);
    setSubtypeId('');
  }, [typeId, types]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!sampleName.trim()) { toast.warning('Enter a sample name'); return; }
    if (!deptId)            { toast.warning('Select a department'); return; }
    if (!catId)             { toast.warning('Select a category'); return; }
    if (!typeId)            { toast.warning('Select a sample type'); return; }
    if (needsSub && !subtypeId) { toast.warning('Select LBD or HBD'); return; }

    setSubmitting(true);
    try {
      const res = await samplesService.registerSample({
        sample_name    : sampleName.trim(),
        department_id  : deptId,
        sample_type_id : typeId,
        brand_id       : brandId   || undefined,
        subtype_id     : subtypeId || undefined,
        batch_number   : batchNo.trim() || undefined,
        notes          : notes.trim()   || undefined,
      });

      setSuccessMsg(`✅ Registered: ${res.sampleNumber}`);
      toast.success(`Sample ${res.sampleNumber} registered!`);

      // Reset variable fields
      setSampleName(''); setBatchNo(''); setNotes('');
      setBrandId(''); setSubtypeId(''); setTypeId(''); setCatId('');
      setTimeout(() => setSuccessMsg(''), 8000);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Inline styles — NO Tailwind animation classes to avoid the cursor bug
  const fieldStyle = {
    marginBottom: '16px',
  };
  const labelStyle = {
    display: 'block',
    fontSize: '12px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '6px',
  };
  const inputStyle = {
    width: '100%',
    border: '1.5px solid #D1D5DB',
    borderRadius: '10px',
    padding: '12px 14px',
    fontSize: '14px',
    color: '#111827',
    backgroundColor: '#ffffff',
    fontFamily: 'inherit',
    cursor: 'text',
    boxSizing: 'border-box',
    pointerEvents: 'auto',
    position: 'relative',
    zIndex: 1,
  };
  const selectStyle = {
    ...inputStyle,
    cursor: 'pointer',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    paddingRight: '36px',
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F0F4F8' }}>
      <Navbar />

      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '20px 16px 80px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '8px', border: '1.5px solid #E5E7EB',
              borderRadius: '10px', background: '#fff',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              pointerEvents: 'auto',
            }}
          >
            ← 
          </button>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', margin: 0 }}>
              Register Sample
            </h2>
            <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>
              Signed as: <strong>{signingAs || user?.full_name}</strong>
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
              Status: Pending. Analyst can now begin testing.
            </p>
          </div>
        )}

        {/* Form */}
        <div style={{
          background: '#ffffff', borderRadius: '16px',
          border: '1px solid #E5E7EB', padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          position: 'relative', zIndex: 1,
        }}>
          <form onSubmit={handleSubmit}>

            {/* Sample Name */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Sample Name / Label <span style={{ color:'red' }}>*</span></label>
              <input
                type="text"
                value={sampleName}
                onChange={e => setSampleName(e.target.value)}
                style={inputStyle}
                placeholder="e.g. Slurry Tank 3 — Morning Batch"
                autoComplete="off"
              />
            </div>

            {/* Department */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Department <span style={{ color:'red' }}>*</span></label>
              <select
                value={deptId}
                onChange={e => setDeptId(e.target.value)}
                style={selectStyle}
              >
                <option value="">— Select Department —</option>
                {depts.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Category */}
            {deptId && (
              <div style={fieldStyle}>
                <label style={labelStyle}>Sample Category <span style={{ color:'red' }}>*</span></label>
                <select
                  value={catId}
                  onChange={e => setCatId(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">
                    {cats.length === 0 ? 'Loading...' : '— Select Category —'}
                  </option>
                  {cats.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Sample Type */}
            {catId && (
              <div style={fieldStyle}>
                <label style={labelStyle}>Sample Type <span style={{ color:'red' }}>*</span></label>
                <select
                  value={typeId}
                  onChange={e => setTypeId(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">
                    {types.length === 0 ? 'Loading...' : '— Select Sample Type —'}
                  </option>
                  {types.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Brand */}
            {deptId && brands.length > 0 && (
              <div style={fieldStyle}>
                <label style={labelStyle}>Brand</label>
                <select
                  value={brandId}
                  onChange={e => setBrandId(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">— Select Brand (optional) —</option>
                  {brands.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* LBD / HBD */}
            {needsSub && subtypes.length > 0 && (
              <div style={fieldStyle}>
                <label style={labelStyle}>Form — LBD or HBD <span style={{ color:'red' }}>*</span></label>
                <select
                  value={subtypeId}
                  onChange={e => setSubtypeId(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">— Select LBD or HBD —</option>
                  {subtypes.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Batch Number */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Batch / Lot Number</label>
              <input
                type="text"
                value={batchNo}
                onChange={e => setBatchNo(e.target.value)}
                style={inputStyle}
                placeholder="e.g. LOT-2024-001 (optional)"
                autoComplete="off"
              />
            </div>

            {/* Notes */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                style={{ ...inputStyle, cursor: 'text', resize: 'vertical', minHeight: '72px' }}
                placeholder="Any additional notes... (optional)"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                background: submitting ? '#93A3B8' : '#003087',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '14px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: submitting ? 'not-allowed' : 'pointer',
                marginTop: '8px',
                pointerEvents: 'auto',
                fontFamily: 'inherit',
              }}
            >
              {submitting ? 'Registering...' : '🧪 Register Sample'}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}