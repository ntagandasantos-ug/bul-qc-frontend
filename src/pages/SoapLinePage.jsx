// ============================================================
// FILE: src/pages/SoapLinePage.jsx
// Soap Line Inspection — Day & Night shift workbooks
// ============================================================

import React, {
  useState, useEffect, useCallback, useRef, useMemo,
} from 'react';
import Navbar     from '../components/Navbar';
import PageFooter from '../components/PageFooter';
import { useAuth }  from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { format }   from 'date-fns';
import { toast }    from 'react-toastify';

const P  = '#6B21A8';
const PM = '#7C3AED';
const PL = '#EDE9FE';
const G  = '#FFB81C';
const GR = '#16A34A';
const RD = '#DC2626';

// ── Brand catalogue ───────────────────────────────────────
const BRANDS = [
  { name:'White Star',         sizes:['1kg','800g','600g'], lines:[1,2,3,4,5] },
  { name:'Blue Magic',         sizes:['1kg','600g'],        lines:[1,2,3] },
  { name:'Kuku Blue',          sizes:['600g'],              lines:[1,2,3] },
  { name:'Bul Star Blue',      sizes:['600g'],              lines:[1,2,3] },
  { name:'White Star Aloe Vera',sizes:['1kg','600g'],       lines:[1,2,3] },
  { name:'Bul Star Natural',   sizes:['1kg'],               lines:[1,2,3] },
  { name:'Bul Star Cream',     sizes:['600g'],              lines:[1,2,3] },
  { name:'Light Star',         sizes:['1kg','600g'],        lines:[1,2,3] },
  { name:'Bull Brown',         sizes:['500g'],              lines:[1,2,3] },
];

const LINES = ['Line 1','Line 2','Line 3','Line 4','Line 5'];

// Weight specs per pack size
const WEIGHT_SPEC = {
  '1kg' : { min:1000, max:1010, label:'1000–1010 g' },
  '800g': { min:800,  max:810,  label:'800–810 g'   },
  '600g': { min:600,  max:610,  label:'600–610 g'   },
  '500g': { min:500,  max:510,  label:'500–510 g'   },
};

const PARAMS = [
  { key:'appearance', label:'Appearance' },
  { key:'texture',    label:'Texture'    },
  { key:'specs',      label:'Specs'      },
  { key:'color',      label:'Color'      },
  { key:'stamp',      label:'Stamp'      },
  { key:'perfume',    label:'Perfume'    },
  { key:'cutting',    label:'Cutting'    },
  { key:'dimensions', label:'Dimensions' },
];

// ── Smart autocomplete input ──────────────────────────────
function AutoInput({ paramKey, value, onChange, options, onNewOption, placeholder, style }) {
  const [open, setOpen]   = useState(false);
  const [q,    setQ]      = useState(value || '');
  const ref               = useRef(null);

  useEffect(() => { setQ(value || ''); }, [value]);

  const filtered = useMemo(() =>
    (options[paramKey] || [])
      .filter(o => o.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 8),
    [options, paramKey, q]
  );

  const select = (v) => {
    setQ(v);
    onChange(v);
    setOpen(false);
  };

  const handleBlur = () => {
    setTimeout(() => {
      setOpen(false);
      if (q.trim() && q !== value) {
        onChange(q.trim());
        onNewOption(paramKey, q.trim());
      }
    }, 150);
  };

  return (
    <div ref={ref} style={{ position:'relative', ...style }}>
      <input
        type="text"
        value={q}
        placeholder={placeholder || 'Type or select...'}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        style={{ width:'100%', border:'1.5px solid #E2E8F0', borderRadius:'7px', padding:'7px 10px', fontSize:'13px', fontFamily:'inherit', background:'#fff', outline:'none', boxSizing:'border-box' }}
      />
      {open && filtered.length > 0 && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'#fff', border:'1.5px solid #E2E8F0', borderRadius:'8px', boxShadow:'0 4px 16px rgba(0,0,0,0.1)', zIndex:200, maxHeight:'160px', overflowY:'auto' }}>
          {filtered.map(o => (
            <div key={o} onMouseDown={() => select(o)}
              style={{ padding:'8px 12px', fontSize:'13px', cursor:'pointer', borderBottom:'1px solid #F1F5F9', color:'#1E293B' }}
              onMouseEnter={e => e.currentTarget.style.background = '#F5F3FF'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Weight input with pass/fail ───────────────────────────
function WeightInput({ packSize, w1, w2, onW1, onW2 }) {
  const spec  = WEIGHT_SPEC[packSize] || WEIGHT_SPEC['1kg'];
  const pass1 = w1 !== '' && w1 !== null && !isNaN(w1) ? parseFloat(w1) >= spec.min && parseFloat(w1) <= spec.max : null;
  const pass2 = w2 !== '' && w2 !== null && !isNaN(w2) ? parseFloat(w2) >= spec.min && parseFloat(w2) <= spec.max : null;

  const inp = (val, onChange, pass) => (
    <input
      type="number"
      value={val}
      onChange={e => onChange(e.target.value)}
      placeholder="g"
      style={{
        width:'80px', border:`1.5px solid ${pass===null?'#E2E8F0':pass?'#86EFAC':'#FECACA'}`,
        borderRadius:'7px', padding:'7px 8px', fontSize:'13px', fontFamily:'inherit',
        background: pass===null?'#fff':pass?'#F0FDF4':'#FEF2F2',
        outline:'none', textAlign:'center',
      }}
    />
  );

  return (
    <div>
      <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
        {inp(w1 ?? '', onW1, pass1)}
        <span style={{ color:'#94A3B8', fontSize:'12px' }}>/</span>
        {inp(w2 ?? '', onW2, pass2)}
      </div>
      <div style={{ fontSize:'10px', color:'#94A3B8', marginTop:'3px' }}>
        Spec: {spec.label}
        {(pass1===false || pass2===false) && (
          <span style={{ color:RD, fontWeight:'700', marginLeft:'6px' }}>⚠️ OOS</span>
        )}
        {pass1===true && pass2===true && (
          <span style={{ color:GR, fontWeight:'700', marginLeft:'6px' }}>✓ OK</span>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════
export default function SoapLinePage() {
  const { user } = useAuth();

  const [shift,      setShift]     = useState('day');
  const [date,       setDate]      = useState(format(new Date(),'yyyy-MM-dd'));
  const [inspection, setInspection]= useState(null);
  const [entries,    setEntries]   = useState([]);
  const [signoff,    setSignoff]   = useState(null);
  const [options,    setOptions]   = useState({});  // {paramKey: [values]}
  const [staffList,  setStaffList] = useState([]);
  const [loading,    setLoading]   = useState(true);
  const [showForm,   setShowForm]  = useState(false);
  const [saving,     setSaving]    = useState(false);

  // ── Load dropdown options ─────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('soap_param_options').select('parameter,value').order('use_count',{ascending:false});
      const grouped = {};
      (data||[]).forEach(r => {
        if (!grouped[r.parameter]) grouped[r.parameter] = [];
        if (!grouped[r.parameter].includes(r.value)) grouped[r.parameter].push(r.value);
      });
      setOptions(grouped);
    };
    load();
  }, []);

  // ── Load staff ────────────────────────────────────────────
  useEffect(() => {
    supabase.from('lab_staff').select('id,full_name').eq('is_active',true).order('full_name')
      .then(({data}) => setStaffList((data||[]).map(s=>s.full_name)));
  }, []);

  // ── Load inspection session ───────────────────────────────
  const loadSession = useCallback(async () => {
    setLoading(true);
    try {
      // Get or create the inspection session
      let { data: insp } = await supabase
        .from('soap_line_inspections')
        .select('*')
        .eq('shift_date', date)
        .eq('shift', shift)
        .maybeSingle();

      if (insp) {
        setInspection(insp);
        // Load entries with brand records
        const { data: ents } = await supabase
          .from('soap_inspection_entries')
          .select(`*, soap_inspection_brand_records(*)`)
          .eq('inspection_id', insp.id)
          .order('inspection_time');
        setEntries(ents || []);

        // Load signoff
        const { data: so } = await supabase
          .from('soap_shift_signoffs')
          .select('*')
          .eq('inspection_id', insp.id)
          .maybeSingle();
        setSignoff(so || { inspection_id: insp.id, hod_comments:'', hod_signature:'', inspector_name:'', signoff_date: date });
      } else {
        setInspection(null);
        setEntries([]);
        setSignoff(null);
      }
    } finally { setLoading(false); }
  }, [date, shift]);

  useEffect(() => { loadSession(); }, [loadSession]);

  // ── Save a new option to DB ───────────────────────────────
  const saveOption = async (param, value) => {
    if (!value?.trim()) return;
    await supabase.from('soap_param_options').upsert(
      { parameter: param, value: value.trim() },
      { onConflict: 'parameter,value', ignoreDuplicates: false }
    );
    setOptions(prev => {
      const existing = prev[param] || [];
      if (existing.includes(value.trim())) return prev;
      return { ...prev, [param]: [value.trim(), ...existing] };
    });
  };

  // ── Ensure session exists ─────────────────────────────────
  const ensureSession = async () => {
    if (inspection) return inspection;
    const { data, error } = await supabase
      .from('soap_line_inspections')
      .insert({ shift_date: date, shift, created_by: user?.id })
      .select()
      .single();
    if (error) throw error;
    setInspection(data);
    return data;
  };

  // ── ENTRY FORM state ──────────────────────────────────────
  const emptyBrand = () => ({
    brand_name:'', pack_size:'',
    appearance:'', texture:'', specs:'', color:'',
    stamp:'', perfume:'', cutting:'', dimensions:'',
    weight_1:'', weight_2:'',
    remarks:'', action_taken:'',
  });

  const [form, setForm] = useState({
    inspection_time: format(new Date(),'HH:mm'),
    line_number    : 'Line 1',
    inspector_name : user?.full_name || '',
    brands         : [emptyBrand()],
  });

  const setF = (k,v) => setForm(p => ({...p, [k]:v}));

  const setBrand = (idx, k, v) => setForm(p => {
    const brands = [...p.brands];
    brands[idx] = {...brands[idx], [k]:v};
    return {...p, brands};
  });

  const addBrand = () => setForm(p => ({...p, brands:[...p.brands, emptyBrand()]}));
  const removeBrand = (idx) => setForm(p => ({...p, brands: p.brands.filter((_,i)=>i!==idx)}));

  const handleSave = async () => {
    if (!form.inspection_time) { toast.warning('Enter inspection time'); return; }
    if (!form.inspector_name)  { toast.warning('Select inspector name'); return; }
    if (form.brands.some(b => !b.brand_name || !b.pack_size)) { toast.warning('Select brand and pack size for all entries'); return; }

    setSaving(true);
    try {
      const session = await ensureSession();

      // Create entry
      const { data: entry, error: eErr } = await supabase
        .from('soap_inspection_entries')
        .insert({
          inspection_id  : session.id,
          inspection_time: form.inspection_time,
          line_number    : form.line_number,
          inspector_name : form.inspector_name,
        })
        .select()
        .single();
      if (eErr) throw eErr;

      // Create brand records
      for (const b of form.brands) {
        const spec  = WEIGHT_SPEC[b.pack_size] || WEIGHT_SPEC['1kg'];
        const w1    = parseFloat(b.weight_1);
        const w2    = parseFloat(b.weight_2);
        const wPass = (!isNaN(w1) && !isNaN(w2))
          ? (w1>=spec.min && w1<=spec.max && w2>=spec.min && w2<=spec.max)
          : null;
        await supabase.from('soap_inspection_brand_records').insert({
          entry_id    : entry.id,
          brand_name  : b.brand_name,
          pack_size   : b.pack_size,
          appearance  : b.appearance  || null,
          texture     : b.texture     || null,
          specs       : b.specs       || null,
          color       : b.color       || null,
          stamp       : b.stamp       || null,
          perfume     : b.perfume     || null,
          cutting     : b.cutting     || null,
          dimensions  : b.dimensions  || null,
          weight_1    : isNaN(w1) ? null : w1,
          weight_2    : isNaN(w2) ? null : w2,
          weight_pass : wPass,
          remarks     : b.remarks     || null,
          action_taken: b.action_taken|| null,
        });
        // Save new options
        for (const pk of [...PARAMS.map(p=>p.key),'remarks','action']) {
          const val = pk==='remarks'?b.remarks:pk==='action'?b.action_taken:b[pk];
          if (val?.trim()) saveOption(pk==='action'?'action':pk, val.trim());
        }
      }

      toast.success('✅ Inspection entry saved');
      setShowForm(false);
      setForm({ inspection_time:format(new Date(),'HH:mm'), line_number:'Line 1', inspector_name: user?.full_name||'', brands:[emptyBrand()] });
      await loadSession();
    } catch(e) {
      toast.error('Failed to save: ' + e.message);
    } finally { setSaving(false); }
  };

  // ── Save shift signoff ────────────────────────────────────
  const saveSignoff = async () => {
    if (!signoff?.inspection_id) { toast.warning('No inspection session to sign off'); return; }
    try {
      await supabase.from('soap_shift_signoffs').upsert({
        ...signoff,
        signed_at: new Date().toISOString(),
      }, { onConflict: 'inspection_id' });
      toast.success('✅ Shift sign-off saved');
    } catch(e) { toast.error('Sign-off failed: ' + e.message); }
  };

  // ── Shift label helpers ───────────────────────────────────
  const shiftLabel = shift === 'day'
    ? 'Day Shift  (07:00 – 19:00)'
    : 'Night Shift (19:00 – 07:00)';

  const hasOOS = entries.some(e =>
    (e.soap_inspection_brand_records||[]).some(b => b.weight_pass === false)
  );

  const inp = { border:'1.5px solid #E2E8F0', borderRadius:'8px', padding:'8px 11px', fontSize:'13px', fontFamily:'inherit', background:'#fff', color:'#1E293B', outline:'none', boxSizing:'border-box', width:'100%' };
  const sel = { ...inp, cursor:'pointer', appearance:'auto' };
  const lbl = { display:'block', fontSize:'11px', fontWeight:'700', color:'#4C1D95', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'0.4px' };

  return (
    <div style={{ minHeight:'100vh', background:'#F8FAFC', paddingBottom:'60px' }}>
      <Navbar/>

      {/* ── Page header ── */}
      <div style={{ background:`linear-gradient(135deg,${P},${PM})`, padding:'16px 24px', color:'#fff' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
          <div>
            <h1 style={{ margin:0, fontSize:'20px', fontWeight:'900' }}>🧼 Soap Line Inspection</h1>
            <p style={{ margin:'3px 0 0', fontSize:'12px', color:'#DDD6FE' }}>
              BIDCO Uganda Limited · Quality Assurance Department
            </p>
          </div>
          <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
            {/* Date picker */}
            <input type="date" value={date} onChange={e=>setDate(e.target.value)}
              style={{ border:'1.5px solid rgba(255,255,255,0.4)', borderRadius:'8px', padding:'7px 12px', fontSize:'13px', background:'rgba(255,255,255,0.15)', color:'#fff', outline:'none', cursor:'pointer', fontFamily:'inherit' }}/>
            {/* Today */}
            <button onClick={()=>setDate(format(new Date(),'yyyy-MM-dd'))}
              style={{ padding:'7px 14px', background:'rgba(255,215,0,0.25)', border:'1.5px solid rgba(255,215,0,0.5)', color:G, borderRadius:'8px', fontWeight:'700', fontSize:'12px', cursor:'pointer', fontFamily:'inherit' }}>
              Today
            </button>
          </div>
        </div>
      </div>

      {/* ── Shift selector ── */}
      <div style={{ background:'#fff', borderBottom:'1px solid #E2E8F0', padding:'0 24px', display:'flex', gap:0 }}>
        {[
          { key:'day',   label:'☀️ Day Shift',   sub:'07:00 – 19:00' },
          { key:'night', label:'🌙 Night Shift',  sub:'19:00 – 07:00' },
        ].map(s => (
          <button key={s.key} onClick={()=>setShift(s.key)}
            style={{ padding:'14px 28px', border:'none', background:'transparent', cursor:'pointer', fontFamily:'inherit', borderBottom:`3px solid ${shift===s.key?PM:'transparent'}`, transition:'all 0.15s' }}>
            <div style={{ fontWeight:'800', fontSize:'14px', color:shift===s.key?PM:'#64748B' }}>{s.label}</div>
            <div style={{ fontSize:'11px', color:'#94A3B8', marginTop:'1px' }}>{s.sub}</div>
          </button>
        ))}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', padding:'0 8px', gap:'8px' }}>
          {hasOOS && (
            <span style={{ background:'#FEF2F2', color:RD, padding:'4px 12px', borderRadius:'20px', fontSize:'12px', fontWeight:'800', border:'1px solid #FECACA' }}>
              ⚠️ Weight OOS detected
            </span>
          )}
          {entries.length > 0 && (
            <span style={{ background:'#ECFDF5', color:GR, padding:'4px 12px', borderRadius:'20px', fontSize:'12px', fontWeight:'700', border:'1px solid #A7F3D0' }}>
              {entries.length} inspection{entries.length!==1?'s':''} recorded
            </span>
          )}
        </div>
      </div>

      <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'20px 24px' }}>

        {loading ? (
          <div style={{ textAlign:'center', padding:'60px', color:'#94A3B8', fontWeight:'600' }}>Loading...</div>
        ) : (
          <>
            {/* ── Add Inspection button ── */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
              <div>
                <h2 style={{ margin:0, fontSize:'16px', fontWeight:'800', color:'#0F172A' }}>{shiftLabel}</h2>
                <p style={{ margin:'2px 0 0', fontSize:'12px', color:'#94A3B8' }}>
                  {format(new Date(date),'EEEE, dd MMMM yyyy')}
                </p>
              </div>
              <button onClick={()=>setShowForm(!showForm)}
                style={{ padding:'10px 22px', background:showForm?'#F1F5F9':`linear-gradient(135deg,${P},${PM})`, color:showForm?'#475569':'#fff', border:showForm?'1.5px solid #E2E8F0':'none', borderRadius:'10px', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit', boxShadow:showForm?'none':'0 2px 8px rgba(107,33,168,0.25)' }}>
                {showForm ? '✕ Cancel' : '+ Add Inspection Entry'}
              </button>
            </div>

            {/* ═══════════════════════════════════════════════
                INSPECTION ENTRY FORM
            ═══════════════════════════════════════════════ */}
            {showForm && (
              <div style={{ background:'#fff', borderRadius:'16px', border:`2px solid ${PL}`, padding:'24px', marginBottom:'20px', boxShadow:'0 4px 16px rgba(107,33,168,0.08)' }}>
                <h3 style={{ margin:'0 0 16px', fontSize:'15px', fontWeight:'800', color:'#0F172A', borderBottom:'1px solid #F1F5F9', paddingBottom:'10px' }}>
                  📋 New Inspection Entry
                </h3>

                {/* Time, Line, Inspector */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px', marginBottom:'20px' }}>
                  <div>
                    <label style={lbl}>Time of Inspection *</label>
                    <input type="time" value={form.inspection_time} onChange={e=>setF('inspection_time',e.target.value)} style={inp}/>
                  </div>
                  <div>
                    <label style={lbl}>Production Line *</label>
                    <select value={form.line_number} onChange={e=>setF('line_number',e.target.value)} style={sel}>
                      {LINES.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Inspector / Analyst *</label>
                    <select value={form.inspector_name} onChange={e=>setF('inspector_name',e.target.value)} style={sel}>
                      <option value="">— Select —</option>
                      {staffList.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {/* Brand records */}
                {form.brands.map((b, idx) => {
                  const brandsForLine = BRANDS.filter(br =>
                    form.line_number === 'Line 4' || form.line_number === 'Line 5'
                      ? br.name.toLowerCase().includes('white star')
                      : true
                  );
                  const selectedBrand = BRANDS.find(br => br.name === b.brand_name);
                  const availSizes    = selectedBrand?.sizes || [];

                  return (
                    <div key={idx} style={{ background:'#FAFBFC', borderRadius:'12px', border:'1.5px solid #E2E8F0', padding:'16px', marginBottom:'12px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
                        <div style={{ fontWeight:'800', fontSize:'14px', color:P }}>
                          Brand {idx+1}
                        </div>
                        {form.brands.length > 1 && (
                          <button onClick={()=>removeBrand(idx)}
                            style={{ padding:'3px 10px', background:'#FEF2F2', color:RD, border:'1px solid #FECACA', borderRadius:'6px', fontSize:'11px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>
                            Remove
                          </button>
                        )}
                      </div>

                      {/* Brand + Pack size */}
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'14px' }}>
                        <div>
                          <label style={lbl}>Brand Name *</label>
                          <select value={b.brand_name} onChange={e=>setBrand(idx,'brand_name',e.target.value)} style={sel}>
                            <option value="">— Select brand —</option>
                            {brandsForLine.map(br => <option key={br.name} value={br.name}>{br.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={lbl}>Pack Size *</label>
                          <select value={b.pack_size} onChange={e=>setBrand(idx,'pack_size',e.target.value)} style={sel} disabled={!b.brand_name}>
                            <option value="">— Select size —</option>
                            {availSizes.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>

                      {/* Physical parameters grid */}
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'14px' }}>
                        {PARAMS.map(param => (
                          <div key={param.key}>
                            <label style={lbl}>{param.label}</label>
                            <AutoInput
                              paramKey={param.key}
                              value={b[param.key]}
                              onChange={v => setBrand(idx, param.key, v)}
                              options={options}
                              onNewOption={saveOption}
                            />
                          </div>
                        ))}
                      </div>

                      {/* Weight */}
                      <div style={{ marginBottom:'14px', background:'#F0FDF4', borderRadius:'9px', padding:'12px', border:'1px solid #BBF7D0' }}>
                        <label style={{ ...lbl, color:GR }}>Weight (Bar 1 / Bar 2) g</label>
                        <WeightInput
                          packSize={b.pack_size}
                          w1={b.weight_1}
                          w2={b.weight_2}
                          onW1={v => setBrand(idx,'weight_1',v)}
                          onW2={v => setBrand(idx,'weight_2',v)}
                        />
                      </div>

                      {/* Remarks + Action */}
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                        <div>
                          <label style={lbl}>Remarks</label>
                          <AutoInput paramKey="remarks" value={b.remarks} onChange={v=>setBrand(idx,'remarks',v)} options={options} onNewOption={saveOption}/>
                        </div>
                        <div>
                          <label style={lbl}>Action Taken</label>
                          <AutoInput paramKey="action" value={b.action_taken} onChange={v=>setBrand(idx,'action_taken',v)} options={options} onNewOption={saveOption}/>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Add another brand */}
                <button onClick={addBrand}
                  style={{ width:'100%', padding:'10px', border:'2px dashed #C4B5FD', borderRadius:'10px', background:'#FAFBFF', color:PM, fontSize:'13px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit', marginBottom:'16px' }}>
                  + Add Another Brand
                </button>

                {/* Save */}
                <button onClick={handleSave} disabled={saving}
                  style={{ width:'100%', padding:'13px', background:saving?'#A78BFA':`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:'800', cursor:saving?'not-allowed':'pointer', fontFamily:'inherit', boxShadow:'0 2px 8px rgba(107,33,168,0.3)' }}>
                  {saving ? '⏳ Saving...' : '✅ Save Inspection Entry'}
                </button>
              </div>
            )}

            {/* ═══════════════════════════════════════════════
                RECORDED ENTRIES
            ═══════════════════════════════════════════════ */}
            {entries.length === 0 && !showForm ? (
              <div style={{ textAlign:'center', padding:'60px', background:'#fff', borderRadius:'16px', border:`1.5px solid ${PL}` }}>
                <div style={{ fontSize:'48px', marginBottom:'12px' }}>🧼</div>
                <div style={{ fontWeight:'700', fontSize:'16px', color:'#374151' }}>No inspections recorded yet</div>
                <div style={{ fontSize:'13px', color:'#9CA3AF', marginTop:'6px' }}>Click "Add Inspection Entry" to start recording</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                {entries.map((entry, ei) => {
                  const brands  = entry.soap_inspection_brand_records || [];
                  const hasW_OOS = brands.some(b => b.weight_pass === false);

                  return (
                    <div key={entry.id} style={{ background:'#fff', borderRadius:'14px', border:`2px solid ${hasW_OOS?RD:PL}`, overflow:'hidden', boxShadow: hasW_OOS?'0 2px 10px rgba(220,38,38,0.1)':'0 1px 4px rgba(107,33,168,0.06)' }}>

                      {/* Entry header */}
                      <div style={{ background: hasW_OOS?'#FEF2F2':'#F5F3FF', padding:'12px 20px', borderBottom:`1px solid ${hasW_OOS?'#FECACA':PL}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'8px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'16px', flexWrap:'wrap' }}>
                          <div>
                            <span style={{ fontSize:'22px', fontWeight:'900', color:P, fontFamily:'monospace' }}>
                              🕐 {entry.inspection_time}
                            </span>
                          </div>
                          <span style={{ background:PL, color:P, padding:'3px 12px', borderRadius:'20px', fontSize:'12px', fontWeight:'700' }}>
                            {entry.line_number}
                          </span>
                          <span style={{ fontSize:'12px', color:'#64748B' }}>
                            ✍️ {entry.inspector_name || '—'}
                          </span>
                          <span style={{ fontSize:'12px', color:'#94A3B8' }}>
                            {brands.length} brand{brands.length!==1?'s':''}
                          </span>
                          {hasW_OOS && (
                            <span style={{ background:'#FEF2F2', color:RD, padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:'800', border:'1px solid #FECACA' }}>
                              ⚠️ Weight OOS
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Brand records */}
                      {brands.map((b, bi) => {
                        const spec  = WEIGHT_SPEC[b.pack_size] || WEIGHT_SPEC['1kg'];
                        const wOOS  = b.weight_pass === false;

                        return (
                          <div key={b.id} style={{ padding:'16px 20px', borderBottom: bi<brands.length-1?'1px solid #F1F5F9':'none' }}>
                            {/* Brand title */}
                            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'12px' }}>
                              <span style={{ fontWeight:'900', fontSize:'14px', color:'#0F172A' }}>{b.brand_name}</span>
                              <span style={{ background:'#FFFBEB', color:'#D97706', padding:'2px 8px', borderRadius:'6px', fontSize:'11px', fontWeight:'700', border:'1px solid #FED7AA' }}>{b.pack_size}</span>
                              {wOOS && <span style={{ background:'#FEF2F2', color:RD, padding:'2px 8px', borderRadius:'6px', fontSize:'11px', fontWeight:'800' }}>⚠️ Weight OOS</span>}
                            </div>

                            {/* Parameters grid */}
                            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px 16px', marginBottom:'12px' }}>
                              {PARAMS.map(param => (
                                <div key={param.key}>
                                  <div style={{ fontSize:'10px', fontWeight:'700', color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'2px' }}>
                                    {param.label}
                                  </div>
                                  <div style={{ fontSize:'13px', fontWeight:'600', color: b[param.key]?'#1E293B':'#CBD5E1' }}>
                                    {b[param.key] || '—'}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Weight */}
                            <div style={{ display:'inline-flex', alignItems:'center', gap:'8px', background: wOOS?'#FEF2F2':'#F0FDF4', borderRadius:'8px', padding:'8px 14px', marginBottom:'10px', border:`1px solid ${wOOS?'#FECACA':'#BBF7D0'}` }}>
                              <span style={{ fontSize:'11px', fontWeight:'700', color:'#64748B' }}>Weight:</span>
                              <span style={{ fontWeight:'900', fontSize:'14px', color:wOOS?RD:GR, fontFamily:'monospace' }}>
                                {b.weight_1 ?? '—'} / {b.weight_2 ?? '—'} g
                              </span>
                              <span style={{ fontSize:'10px', color:'#94A3B8' }}>Spec: {spec.label}</span>
                              {b.weight_pass === true  && <span style={{ color:GR,  fontSize:'12px', fontWeight:'700' }}>✓ PASS</span>}
                              {b.weight_pass === false && <span style={{ color:RD,  fontSize:'12px', fontWeight:'700' }}>✕ FAIL</span>}
                            </div>

                            {/* Remarks + Action */}
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                              <div>
                                <div style={{ fontSize:'10px', fontWeight:'700', color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'2px' }}>Remarks</div>
                                <div style={{ fontSize:'13px', color: b.remarks?'#1E293B':'#CBD5E1', fontStyle: b.remarks?'normal':'italic' }}>{b.remarks || '—'}</div>
                              </div>
                              <div>
                                <div style={{ fontSize:'10px', fontWeight:'700', color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'2px' }}>Action Taken</div>
                                <div style={{ fontSize:'13px', color: b.action_taken?'#1E293B':'#CBD5E1', fontStyle: b.action_taken?'normal':'italic' }}>{b.action_taken || '—'}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ═══════════════════════════════════════════════
                SHIFT SIGN-OFF SECTION
            ═══════════════════════════════════════════════ */}
            {(entries.length > 0 || inspection) && (
              <div style={{ marginTop:'28px', background:'#fff', borderRadius:'16px', border:`2px solid ${PL}`, padding:'24px', boxShadow:'0 2px 10px rgba(107,33,168,0.06)' }}>
                <h3 style={{ margin:'0 0 6px', fontSize:'16px', fontWeight:'900', color:'#0F172A' }}>
                  📝 Shift Report Sign-Off
                </h3>
                <p style={{ margin:'0 0 20px', fontSize:'12px', color:'#94A3B8' }}>
                  To be completed at the end of the {shift === 'day' ? 'Day' : 'Night'} shift
                </p>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', marginBottom:'16px' }}>
                  <div>
                    <label style={lbl}>Analyst / Inspector Name</label>
                    <select value={signoff?.inspector_name||''} onChange={e=>setSignoff(p=>({...p,inspector_name:e.target.value}))} style={sel}>
                      <option value="">— Select —</option>
                      {staffList.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Sign-Off Date</label>
                    <input type="date" value={signoff?.signoff_date||date} onChange={e=>setSignoff(p=>({...p,signoff_date:e.target.value}))} style={inp}/>
                  </div>
                </div>

                <div style={{ marginBottom:'16px' }}>
                  <label style={{ ...lbl, color:'#4C1D95' }}>
                    Comments — Head of Quality Assurance / Quality Controller
                  </label>
                  <textarea
                    value={signoff?.hod_comments||''}
                    onChange={e=>setSignoff(p=>({...p,hod_comments:e.target.value}))}
                    rows={4}
                    placeholder="Enter comments on this shift's production quality, observations, and recommendations..."
                    style={{ ...inp, resize:'vertical', minHeight:'90px' }}
                  />
                </div>

                <div style={{ marginBottom:'20px' }}>
                  <label style={lbl}>Head of QA/QC Signature (Typed Name)</label>
                  <input type="text" value={signoff?.hod_signature||''} onChange={e=>setSignoff(p=>({...p,hod_signature:e.target.value}))} placeholder="Type full name as signature..." style={inp}/>
                </div>

                <button onClick={saveSignoff}
                  style={{ width:'100%', padding:'12px', background:`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:'800', cursor:'pointer', fontFamily:'inherit', boxShadow:'0 2px 8px rgba(107,33,168,0.25)' }}>
                  ✅ Save & Sign Off {shift === 'day' ? 'Day' : 'Night'} Shift Report
                </button>

                {signoff?.signed_at && (
                  <p style={{ textAlign:'center', fontSize:'12px', color:GR, marginTop:'10px', fontWeight:'600' }}>
                    ✅ Signed off on {format(new Date(signoff.signed_at),'dd MMMM yyyy HH:mm')}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <PageFooter/>
    </div>
  );
}
