// ============================================================
// FILE: src/pages/PlasticsLinePage.jsx
// Plastics Line Inspection — BBM & SBM machines
// Same design pattern as Soap & Detergent inspection pages
// ============================================================

import React, {
  useState, useEffect, useCallback, useRef, useMemo,
} from 'react';
import { createPortal } from 'react-dom';
import Navbar     from '../components/Navbar';
import PageFooter from '../components/PageFooter';
import { useAuth }  from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { format }   from 'date-fns';
import { toast }    from 'react-toastify';

const P  = '#6B21A8';
const PM = '#7C3AED';
const PL = '#EDE9FE';
const GR = '#16A34A';
const RD = '#DC2626';
const AM = '#D97706';
const G  = '#FFB81C';

// ── Machine catalogue ─────────────────────────────────────
const BBM_MACHINES = Array.from({ length:12 }, (_,i) => `BBM ${i+1}`);
const SBM_MACHINES = Array.from({ length:9  }, (_,i) => `SBM ${i+1}`);
const ALL_MACHINES = [...BBM_MACHINES, ...SBM_MACHINES];

const CAPACITIES = {
  BBM: ['10L','20L'],
  SBM: ['1/2L','1L','3L','5L'],
};

const getMachineType = (m) =>
  m?.startsWith('BBM') ? 'BBM' : m?.startsWith('SBM') ? 'SBM' : null;

// Drop/Stack test only applicable to BBM (10L, 20L)
const dropStackApplicable = (machine) => getMachineType(machine) === 'BBM';

// Weight specs per capacity
const WEIGHT_SPEC = {
  '20L' : { min:1060, max:1090, label:'1060–1090 g' },
  '10L' : { min:630,  max:655,  label:'630–655 g'   },
  '5L'  : { min:240,  max:255,  label:'240–255 g'   },
  '3L'  : { min:150,  max:165,  label:'150–165 g'   },
  '1L'  : { min:65,   max:80,   label:'65–80 g'     },
  '1/2L': { min:45,   max:55,   label:'45–55 g'     },
};

// Weight pass/fail per mould
const checkWeight = (capacity, val) => {
  const spec = WEIGHT_SPEC[capacity];
  if (!spec || val===''||val===null||isNaN(val)) return null;
  const v = parseFloat(val);
  return v >= spec.min && v <= spec.max;
};

// Thin scrollbar CSS
const scrollCSS = `
  .thin-scroll::-webkit-scrollbar { height:4px; width:4px; }
  .thin-scroll::-webkit-scrollbar-track { background:#F1F5F9; border-radius:4px; }
  .thin-scroll::-webkit-scrollbar-thumb { background:#C4B5FD; border-radius:4px; }
  .thin-scroll::-webkit-scrollbar-thumb:hover { background:#7C3AED; }
`;

// ── Portal SmartCell ──────────────────────────────────────
function SmartCell({ paramKey, value, onChange, options, onNewOption, placeholder, disabled }) {
  const [open, setOpen] = useState(false);
  const [q,    setQ]    = useState(value || '');
  const [rect, setRect] = useState(null);
  const inputRef        = useRef(null);

  useEffect(() => { setQ(value || ''); }, [value]);

  const filtered = useMemo(() =>
    (options[paramKey]||[]).filter(o => o.toLowerCase().includes(q.toLowerCase())).slice(0,8),
    [options, paramKey, q]
  );

  const openDD = () => {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      setRect({ top:r.bottom+2, left:r.left, width:Math.max(r.width,150) });
    }
    setOpen(true);
  };

  const select = (v) => { setQ(v); onChange(v); setOpen(false); };

  const handleBlur = () => setTimeout(() => {
    setOpen(false);
    if (q.trim() && q !== value) { onChange(q.trim()); onNewOption(paramKey, q.trim()); }
  }, 160);

  const dropdown = open && filtered.length > 0 && rect
    ? createPortal(
        <div style={{ position:'fixed', top:rect.top, left:rect.left, width:rect.width, background:'#fff', border:'1.5px solid #C4B5FD', borderRadius:'8px', boxShadow:'0 8px 24px rgba(107,33,168,0.15)', zIndex:9999, maxHeight:'160px', overflowY:'auto' }}>
          {filtered.map(o => (
            <div key={o} onMouseDown={() => select(o)}
              style={{ padding:'7px 10px', fontSize:'12px', cursor:'pointer', borderBottom:'1px solid #F8FAFC', color:'#1E293B' }}
              onMouseEnter={e => e.currentTarget.style.background='#F5F3FF'}
              onMouseLeave={e => e.currentTarget.style.background='#fff'}>
              {o}
            </div>
          ))}
        </div>, document.body
      )
    : null;

  if (disabled) return (
    <div style={{ padding:'5px 7px', fontSize:'12px', color:'#94A3B8', background:'#F8FAFC', borderRadius:'5px', border:'1px solid #F1F5F9', textAlign:'center', fontWeight:'600' }}>
      N/A
    </div>
  );

  return (
    <>
      <input ref={inputRef} type="text" value={q}
        placeholder={placeholder||'—'}
        onChange={e => { setQ(e.target.value); openDD(); }}
        onFocus={openDD} onBlur={handleBlur}
        style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:'5px', padding:'5px 7px', fontSize:'12px', fontFamily:'inherit', background:'#fff', outline:'none', boxSizing:'border-box' }}
      />
      {dropdown}
    </>
  );
}

// ── Dual weight cell (Mould A / Mould B) ─────────────────
function WeightCell({ capacity, wA, wB, onWA, onWB }) {
  const spec = WEIGHT_SPEC[capacity] || { min:0, max:9999, label:'—' };
  const pA   = checkWeight(capacity, wA);
  const pB   = checkWeight(capacity, wB);

  const wInp = (val, cb, pass) => (
    <input type="number" value={val??''} onChange={e=>cb(e.target.value)}
      placeholder="g"
      style={{ width:'62px', border:`1px solid ${pass===null?'#E2E8F0':pass?'#86EFAC':'#FECACA'}`, borderRadius:'5px', padding:'4px 5px', fontSize:'12px', fontFamily:'inherit', background:pass===null?'#fff':pass?'#F0FDF4':'#FFF5F5', outline:'none', textAlign:'center' }}
    />
  );

  const anyFail = pA===false || pB===false;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'3px', alignItems:'center' }}>
      <div style={{ display:'flex', gap:'3px', alignItems:'center' }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'1px' }}>
          <span style={{ fontSize:'9px', color:'#94A3B8', fontWeight:'700' }}>A</span>
          {wInp(wA, onWA, pA)}
        </div>
        <span style={{ fontSize:'10px', color:'#CBD5E1', marginTop:'12px' }}>/</span>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'1px' }}>
          <span style={{ fontSize:'9px', color:'#94A3B8', fontWeight:'700' }}>B</span>
          {wInp(wB, onWB, pB)}
        </div>
      </div>
      <div style={{ fontSize:'9px', color:anyFail?RD:'#94A3B8', fontWeight:anyFail?'700':'400', whiteSpace:'nowrap' }}>
        {anyFail ? '⚠️ OOS' : spec.label}
      </div>
    </div>
  );
}

// ── Parameters list ───────────────────────────────────────
const PARAMS = [
  { key:'drop_test',      label:'Drop Test'         },
  { key:'stack_test',     label:'Stack Test'        },
  { key:'neck_height',    label:'Neck Height'       },
  { key:'mouth_profile',  label:'Mouth Profile'     },
  { key:'trimming',       label:'Trimming'          },
  { key:'colour',         label:'Colour'            },
  { key:'pinholes',       label:'Pinholes'          },
  { key:'black_spots',    label:'Black Spots'       },
  { key:'water_marks',    label:'Water Marks'       },
  { key:'depressions',    label:'Depressions'       },
  { key:'lines_weakness', label:'Lines of Weakness' },
];

// ═══════════════════════════════════════════════════════════
export default function PlasticsLinePage() {
  const { user } = useAuth();

  const [shift,       setShift]       = useState('day');
  const [date,        setDate]        = useState(format(new Date(),'yyyy-MM-dd'));
  const [inspection,  setInspection]  = useState(null);
  const [entries,     setEntries]     = useState([]);
  const [signoff,     setSignoff]     = useState(null);
  const [options,     setOptions]     = useState({});
  const [staffList,   setStaffList]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [editEntryId, setEditEntryId] = useState(null);

  // Load options & staff
  useEffect(() => {
    supabase.from('plastics_param_options').select('parameter,value').order('use_count',{ascending:false})
      .then(({ data }) => {
        const g = {};
        (data||[]).forEach(r => { if(!g[r.parameter])g[r.parameter]=[]; if(!g[r.parameter].includes(r.value))g[r.parameter].push(r.value); });
        setOptions(g);
      });
    supabase.from('lab_staff').select('full_name').eq('is_active',true).order('full_name')
      .then(({ data }) => setStaffList((data||[]).map(s=>s.full_name)));
  }, []);

  // Load session
  const loadSession = useCallback(async () => {
    setLoading(true);
    try {
      let { data:insp } = await supabase.from('plastics_line_inspections')
        .select('*').eq('shift_date',date).eq('shift',shift).maybeSingle();
      if (insp) {
        setInspection(insp);
        const { data:ents } = await supabase.from('plastics_inspection_entries')
          .select(`*, plastics_inspection_records(*)`)
          .eq('inspection_id',insp.id).order('inspection_time');
        setEntries(ents||[]);
        const { data:so } = await supabase.from('plastics_shift_signoffs')
          .select('*').eq('inspection_id',insp.id).maybeSingle();
        setSignoff(so||{ inspection_id:insp.id, hod_comments:'', hod_signature:'', inspector_name:'', signoff_date:date });
      } else {
        setInspection(null); setEntries([]); setSignoff(null);
      }
    } finally { setLoading(false); }
  }, [date, shift]);

  useEffect(() => { loadSession(); }, [loadSession]);

  const saveOption = async (param, value) => {
    if (!value?.trim()) return;
    await supabase.from('plastics_param_options').upsert({ parameter:param, value:value.trim() }, { onConflict:'parameter,value' });
    setOptions(prev => { const e=prev[param]||[]; return e.includes(value.trim())?prev:{...prev,[param]:[value.trim(),...e]}; });
  };

  const ensureSession = async () => {
    if (inspection) return inspection;
    const { data, error } = await supabase.from('plastics_line_inspections')
      .insert({ shift_date:date, shift, created_by:user?.id }).select().single();
    if (error) throw error;
    setInspection(data); return data;
  };

  // ── Form state ────────────────────────────────────────────
  const emptyRecord = () => ({
    machine:'', capacity:'',
    shape:'', jc_colour:'',
    weight_a:'', weight_b:'',
    drop_test:'', stack_test:'',
    neck_height:'', mouth_profile:'', trimming:'',
    colour:'', pinholes:'', black_spots:'',
    water_marks:'', depressions:'', lines_weakness:'',
    remarks:'', action_taken:'',
  });

  const [form, setForm] = useState({
    inspection_time: format(new Date(),'HH:mm'),
    inspector_name : user?.full_name || '',
    records        : [emptyRecord()],
  });

  const setF = (k,v) => setForm(p => ({ ...p, [k]:v }));

  const setR = (i,k,v) => setForm(p => {
    const records = [...p.records];
    const updated = { ...records[i], [k]:v };
    // When machine changes, reset capacity
    if (k==='machine') {
      updated.capacity   = '';
      updated.drop_test  = '';
      updated.stack_test = '';
    }
    records[i] = updated;
    return { ...p, records };
  });

  // Open edit
  const openEdit = (entry) => {
    const records = (entry.plastics_inspection_records||[]).map(r => ({
      machine      : r.machine,
      capacity     : r.capacity,
      shape        : r.shape        || '',
      jc_colour    : r.jc_colour    || '',
      weight_a     : r.weight_a     ?? '',
      weight_b     : r.weight_b     ?? '',
      drop_test    : r.drop_test    || '',
      stack_test   : r.stack_test   || '',
      neck_height  : r.neck_height  || '',
      mouth_profile: r.mouth_profile|| '',
      trimming     : r.trimming     || '',
      colour       : r.colour       || '',
      pinholes     : r.pinholes     || '',
      black_spots  : r.black_spots  || '',
      water_marks  : r.water_marks  || '',
      depressions  : r.depressions  || '',
      lines_weakness: r.lines_weakness||'',
      remarks      : r.remarks      || '',
      action_taken : r.action_taken || '',
    }));
    setForm({ inspection_time:entry.inspection_time, inspector_name:entry.inspector_name||'', records:records.length>0?records:[emptyRecord()] });
    setEditEntryId(entry.id);
    setShowForm(true);
    window.scrollTo({ top:0, behavior:'smooth' });
  };

  const cancelForm = () => {
    setShowForm(false); setEditEntryId(null);
    setForm({ inspection_time:format(new Date(),'HH:mm'), inspector_name:user?.full_name||'', records:[emptyRecord()] });
  };

  // Save
  const handleSave = async () => {
    if (!form.inspection_time) { toast.warning('Enter inspection time'); return; }
    if (!form.inspector_name)  { toast.warning('Select inspector'); return; }
    if (form.records.some(r => !r.machine||!r.capacity)) {
      toast.warning('Select machine and capacity for all rows'); return;
    }
    setSaving(true);
    try {
      let entryId = editEntryId;
      if (editEntryId) {
        await supabase.from('plastics_inspection_entries')
          .update({ inspection_time:form.inspection_time, inspector_name:form.inspector_name })
          .eq('id', editEntryId);
        await supabase.from('plastics_inspection_records').delete().eq('entry_id', editEntryId);
      } else {
        const session = await ensureSession();
        const { data:entry, error:eErr } = await supabase.from('plastics_inspection_entries')
          .insert({ inspection_id:session.id, inspection_time:form.inspection_time, inspector_name:form.inspector_name })
          .select().single();
        if (eErr) throw eErr;
        entryId = entry.id;
      }

      for (const r of form.records) {
        const pA = checkWeight(r.capacity, r.weight_a);
        const pB = checkWeight(r.capacity, r.weight_b);
        const wPass =
          pA===null && pB===null ? null :
          pA===false && pB===false ? 'fail_both' :
          pA===false ? 'fail_a' :
          pB===false ? 'fail_b' : 'pass';

        const isSBM = getMachineType(r.machine) === 'SBM';

        await supabase.from('plastics_inspection_records').insert({
          entry_id      : entryId,
          machine       : r.machine,
          capacity      : r.capacity,
          shape         : r.shape        ||null,
          jc_colour     : r.jc_colour    ||null,
          weight_a      : r.weight_a!==''?parseFloat(r.weight_a):null,
          weight_b      : r.weight_b!==''?parseFloat(r.weight_b):null,
          weight_pass   : wPass,
          drop_test     : isSBM ? 'N/A' : r.drop_test    ||null,
          stack_test    : isSBM ? 'N/A' : r.stack_test   ||null,
          neck_height   : r.neck_height  ||null,
          mouth_profile : r.mouth_profile||null,
          trimming      : r.trimming     ||null,
          colour        : r.colour       ||null,
          pinholes      : r.pinholes     ||null,
          black_spots   : r.black_spots  ||null,
          water_marks   : r.water_marks  ||null,
          depressions   : r.depressions  ||null,
          lines_weakness: r.lines_weakness||null,
          remarks       : r.remarks      ||null,
          action_taken  : r.action_taken ||null,
        });

        // Save new options
        PARAMS.forEach(p => { if (!isSBM || (p.key!=='drop_test'&&p.key!=='stack_test')) { if (r[p.key]?.trim()) saveOption(p.key, r[p.key]); } });
        if (r.remarks)     saveOption('remarks', r.remarks);
        if (r.action_taken) saveOption('action', r.action_taken);
      }

      toast.success(editEntryId ? '✅ Entry updated' : '✅ Entry saved');
      cancelForm();
      await loadSession();
    } catch(e) { toast.error('Failed: '+e.message); }
    finally { setSaving(false); }
  };

  const saveSignoff = async () => {
    if (!signoff?.inspection_id) { toast.warning('No session to sign off'); return; }
    try {
      await supabase.from('plastics_shift_signoffs').upsert({ ...signoff, signed_at:new Date().toISOString() }, { onConflict:'inspection_id' });
      toast.success('✅ Shift signed off'); loadSession();
    } catch(e) { toast.error(e.message); }
  };

  const hasOOS = entries.some(e =>
    (e.plastics_inspection_records||[]).some(r => r.weight_pass && r.weight_pass !== 'pass')
  );

  const inp = { border:'1.5px solid #E2E8F0', borderRadius:'8px', padding:'8px 11px', fontSize:'13px', fontFamily:'inherit', background:'#fff', outline:'none', boxSizing:'border-box', width:'100%' };
  const sel = { ...inp, cursor:'pointer', appearance:'auto' };
  const lbl = { display:'block', fontSize:'11px', fontWeight:'700', color:'#4C1D95', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'0.4px' };

  const TH = ({ children, w, center }) => (
    <th style={{ padding:'8px 7px', background:`linear-gradient(180deg,${P},#5B1894)`, color:'#fff', fontSize:'10px', fontWeight:'700', whiteSpace:'nowrap', textAlign:center?'center':'left', borderRight:'1px solid rgba(255,255,255,0.15)', minWidth:w||'70px', letterSpacing:'0.3px', position:'sticky', top:0, zIndex:10 }}>
      {children}
    </th>
  );

  return (
    <div style={{ minHeight:'100vh', background:'#F8FAFC', paddingBottom:'60px' }}>
      <style>{scrollCSS}</style>
      <Navbar/>

      {/* Header */}
      <div style={{ background:`linear-gradient(135deg,${P},${PM})`, padding:'14px 24px', color:'#fff', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h1 style={{ margin:0, fontSize:'18px', fontWeight:'900' }}>♻️ Plastics Line Inspection</h1>
          <p style={{ margin:'2px 0 0', fontSize:'11px', color:'#DDD6FE' }}>BIDCO Uganda Limited · Quality Assurance Department</p>
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)}
            style={{ border:'1.5px solid rgba(255,255,255,0.4)', borderRadius:'8px', padding:'6px 12px', fontSize:'13px', background:'rgba(255,255,255,0.15)', color:'#fff', outline:'none', cursor:'pointer', fontFamily:'inherit' }}/>
          <button onClick={()=>setDate(format(new Date(),'yyyy-MM-dd'))}
            style={{ padding:'6px 12px', background:'rgba(255,215,0,0.25)', border:'1.5px solid rgba(255,215,0,0.5)', color:G, borderRadius:'7px', fontWeight:'700', fontSize:'12px', cursor:'pointer', fontFamily:'inherit' }}>
            Today
          </button>
        </div>
      </div>

      {/* Shift tabs */}
      <div style={{ background:'#fff', borderBottom:'1px solid #E2E8F0', padding:'0 24px', display:'flex', alignItems:'center' }}>
        {[{key:'day',label:'☀️ Day Shift',sub:'07:00 – 19:00'},{key:'night',label:'🌙 Night Shift',sub:'19:00 – 07:00'}].map(s=>(
          <button key={s.key} onClick={()=>setShift(s.key)}
            style={{ padding:'12px 24px', border:'none', background:'transparent', cursor:'pointer', fontFamily:'inherit', borderBottom:`3px solid ${shift===s.key?PM:'transparent'}`, transition:'all 0.12s' }}>
            <div style={{ fontWeight:'800', fontSize:'13px', color:shift===s.key?PM:'#64748B' }}>{s.label}</div>
            <div style={{ fontSize:'10px', color:'#94A3B8' }}>{s.sub}</div>
          </button>
        ))}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'8px', padding:'0 4px' }}>
          {hasOOS && <span style={{ background:'#FEF2F2', color:RD, padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:'800', border:'1px solid #FECACA' }}>⚠️ Weight OOS</span>}
          {entries.length>0 && <span style={{ background:'#ECFDF5', color:GR, padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:'700', border:'1px solid #A7F3D0' }}>{entries.length} entr{entries.length!==1?'ies':'y'}</span>}
        </div>
      </div>

      <div style={{ maxWidth:'100%', padding:'16px 20px' }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:'60px', color:'#94A3B8', fontWeight:'600' }}>Loading...</div>
        ) : (
          <>
            {/* Top bar */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
              <div>
                <h2 style={{ margin:0, fontSize:'15px', fontWeight:'800', color:'#0F172A' }}>
                  {shift==='day'?'☀️ Day Shift  07:00 – 19:00':'🌙 Night Shift  19:00 – 07:00'}
                </h2>
                <p style={{ margin:'2px 0 0', fontSize:'12px', color:'#94A3B8' }}>{format(new Date(date),'EEEE, dd MMMM yyyy')}</p>
              </div>
              {!showForm && (
                <button onClick={()=>{ cancelForm(); setShowForm(true); }}
                  style={{ padding:'9px 20px', background:`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'9px', fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit', boxShadow:'0 2px 8px rgba(107,33,168,0.25)' }}>
                  + Add Inspection Entry
                </button>
              )}
            </div>

            {/* ═══ FORM ═══ */}
            {showForm && (
              <div style={{ background:'#fff', borderRadius:'14px', border:`2px solid ${editEntryId?'#FED7AA':PL}`, marginBottom:'18px', overflow:'hidden', boxShadow:'0 4px 16px rgba(107,33,168,0.07)' }}>
                {/* Form header */}
                <div style={{ padding:'12px 18px', borderBottom:'1px solid #F1F5F9', background:editEntryId?'#FFFBEB':'#F5F3FF', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
                  <div style={{ display:'flex', gap:'14px', alignItems:'center', flexWrap:'wrap' }}>
                    <span style={{ fontWeight:'800', fontSize:'14px', color:editEntryId?AM:P }}>
                      {editEntryId?'✏️ Edit Inspection Entry':'📋 New Inspection Entry'}
                    </span>
                    <div>
                      <label style={lbl}>Time *</label>
                      <input type="time" value={form.inspection_time} onChange={e=>setF('inspection_time',e.target.value)}
                        style={{ border:'1.5px solid #E2E8F0', borderRadius:'7px', padding:'6px 10px', fontSize:'13px', fontFamily:'inherit', background:'#fff', outline:'none' }}/>
                    </div>
                    <div style={{ minWidth:'180px' }}>
                      <label style={lbl}>Inspector / Analyst *</label>
                      <select value={form.inspector_name} onChange={e=>setF('inspector_name',e.target.value)}
                        style={{ border:'1.5px solid #E2E8F0', borderRadius:'7px', padding:'6px 10px', fontSize:'13px', fontFamily:'inherit', background:'#fff', outline:'none', cursor:'pointer', minWidth:'180px' }}>
                        <option value="">— Select —</option>
                        {staffList.map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <button onClick={cancelForm}
                    style={{ padding:'6px 14px', border:'1.5px solid #E2E8F0', borderRadius:'8px', background:'#F8FAFC', color:'#64748B', fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>
                    ✕ Cancel
                  </button>
                </div>

                {/* Machine info legend */}
                <div style={{ padding:'8px 18px', background:'#FFFBEB', borderBottom:'1px solid #FEF3C7', display:'flex', gap:'20px', flexWrap:'wrap' }}>
                  <span style={{ fontSize:'11px', color:'#92400E' }}>
                    <strong>BBM 1–12:</strong> 10L & 20L jerrycans
                  </span>
                  <span style={{ fontSize:'11px', color:'#92400E' }}>
                    <strong>SBM 1–9:</strong> ½L, 1L, 3L & 5L jerrycans
                  </span>
                  <span style={{ fontSize:'11px', color:'#64748B' }}>
                    Drop Test & Stack Test = <strong>N/A</strong> for SBM machines
                  </span>
                </div>

                {/* Table */}
                <div className="thin-scroll" style={{ overflowX:'auto' }}>
                  <table style={{ borderCollapse:'collapse', width:'100%', fontSize:'12px' }}>
                    <thead>
                      <tr>
                        <TH w="88px">Machine</TH>
                        <TH w="70px" center>Capacity</TH>
                        <TH w="90px" center>Shape</TH>
                        <TH w="80px" center>JC Colour</TH>
                        <TH w="148px" center>Weight A / B (g)</TH>
                        <TH w="80px" center>Drop Test</TH>
                        <TH w="80px" center>Stack Test</TH>
                        <TH w="88px" center>Neck Height</TH>
                        <TH w="92px" center>Mouth Profile</TH>
                        <TH w="80px" center>Trimming</TH>
                        <TH w="80px" center>Colour</TH>
                        <TH w="80px" center>Pinholes</TH>
                        <TH w="84px" center>Black Spots</TH>
                        <TH w="84px" center>Water Marks</TH>
                        <TH w="84px" center>Depressions</TH>
                        <TH w="96px" center>Lines of Weakness</TH>
                        <TH w="110px">Remarks</TH>
                        <TH w="110px">Action</TH>
                        <TH w="36px" center></TH>
                      </tr>
                    </thead>
                    <tbody>
                      {form.records.map((r, idx) => {
                        const mType   = getMachineType(r.machine);
                        const isSBM   = mType === 'SBM';
                        const caps    = mType ? CAPACITIES[mType] : [];
                        const pA      = checkWeight(r.capacity, r.weight_a);
                        const pB      = checkWeight(r.capacity, r.weight_b);
                        const anyFail = pA===false || pB===false;
                        const rowBg   = idx%2===0 ? '#fff' : '#FAFBFC';

                        return (
                          <tr key={idx} style={{ background:anyFail?'#FFF5F5':rowBg }}>
                            {/* Machine */}
                            <td style={{ padding:'5px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9' }}>
                              <select value={r.machine} onChange={e=>setR(idx,'machine',e.target.value)}
                                style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:'5px', padding:'4px', fontSize:'12px', fontFamily:'inherit', background:'#fff', outline:'none', cursor:'pointer' }}>
                                <option value="">— Select —</option>
                                <optgroup label="BBM Machines (10L / 20L)">
                                  {BBM_MACHINES.map(m=><option key={m} value={m}>{m}</option>)}
                                </optgroup>
                                <optgroup label="SBM Machines (½L – 5L)">
                                  {SBM_MACHINES.map(m=><option key={m} value={m}>{m}</option>)}
                                </optgroup>
                              </select>
                            </td>
                            {/* Capacity */}
                            <td style={{ padding:'5px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9' }}>
                              <select value={r.capacity} onChange={e=>setR(idx,'capacity',e.target.value)} disabled={!r.machine}
                                style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:'5px', padding:'4px', fontSize:'12px', fontFamily:'inherit', background:r.machine?'#fff':'#F8FAFC', outline:'none', cursor:r.machine?'pointer':'not-allowed' }}>
                                <option value="">—</option>
                                {caps.map(c=><option key={c} value={c}>{c}</option>)}
                              </select>
                            </td>
                            {/* Shape */}
                            <td style={{ padding:'5px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9' }}>
                              <select value={r.shape} onChange={e=>setR(idx,'shape',e.target.value)}
                                style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:'5px', padding:'4px', fontSize:'12px', fontFamily:'inherit', background:'#fff', outline:'none', cursor:'pointer' }}>
                                <option value="">—</option>
                                <option value="Square">Square</option>
                                <option value="Rectangle">Rectangle</option>
                              </select>
                            </td>
                            {/* JC Colour */}
                            <td style={{ padding:'5px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9' }}>
                              <select value={r.jc_colour} onChange={e=>setR(idx,'jc_colour',e.target.value)}
                                style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:'5px', padding:'4px', fontSize:'12px', fontFamily:'inherit', background:'#fff', outline:'none', cursor:'pointer' }}>
                                <option value="">—</option>
                                <option value="Yellow">Yellow</option>
                                <option value="Golden">Golden</option>
                              </select>
                            </td>
                            {/* Weight A / B */}
                            <td style={{ padding:'4px 6px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9' }}>
                              <WeightCell capacity={r.capacity} wA={r.weight_a} wB={r.weight_b} onWA={v=>setR(idx,'weight_a',v)} onWB={v=>setR(idx,'weight_b',v)}/>
                            </td>
                            {/* Drop Test */}
                            <td style={{ padding:'4px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9' }}>
                              <SmartCell paramKey="drop_test" value={r.drop_test} onChange={v=>setR(idx,'drop_test',v)} options={options} onNewOption={saveOption} disabled={isSBM}/>
                            </td>
                            {/* Stack Test */}
                            <td style={{ padding:'4px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9' }}>
                              <SmartCell paramKey="stack_test" value={r.stack_test} onChange={v=>setR(idx,'stack_test',v)} options={options} onNewOption={saveOption} disabled={isSBM}/>
                            </td>
                            {/* Parameters 3–11 */}
                            {['neck_height','mouth_profile','trimming','colour','pinholes','black_spots','water_marks','depressions','lines_weakness'].map(pk=>(
                              <td key={pk} style={{ padding:'4px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9' }}>
                                <SmartCell paramKey={pk} value={r[pk]} onChange={v=>setR(idx,pk,v)} options={options} onNewOption={saveOption}/>
                              </td>
                            ))}
                            {/* Remarks */}
                            <td style={{ padding:'4px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9' }}>
                              <SmartCell paramKey="remarks" value={r.remarks} onChange={v=>setR(idx,'remarks',v)} options={options} onNewOption={saveOption}/>
                            </td>
                            {/* Action */}
                            <td style={{ padding:'4px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9' }}>
                              <SmartCell paramKey="action" value={r.action_taken} onChange={v=>setR(idx,'action_taken',v)} options={options} onNewOption={saveOption}/>
                            </td>
                            {/* Remove */}
                            <td style={{ padding:'4px', borderBottom:'1px solid #F1F5F9', textAlign:'center' }}>
                              {form.records.length>1&&(
                                <button onClick={()=>setForm(p=>({...p,records:p.records.filter((_,i)=>i!==idx)}))}
                                  style={{ background:'none', border:'none', color:'#CBD5E1', cursor:'pointer', fontSize:'15px', lineHeight:1, padding:'2px' }}>✕</button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Add row + Save */}
                <div style={{ padding:'10px 14px', display:'flex', gap:'10px', alignItems:'center', background:'#F9FAFB', borderTop:'1px solid #F1F5F9', flexWrap:'wrap' }}>
                  <button onClick={()=>setForm(p=>({...p,records:[...p.records,emptyRecord()]}))}
                    style={{ padding:'7px 16px', border:'2px dashed #C4B5FD', borderRadius:'8px', background:'#FAFBFF', color:PM, fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>
                    + Add Machine Row
                  </button>
                  <span style={{ fontSize:'11px', color:'#94A3B8' }}>Each row = one machine inspection at this time</span>
                  <button onClick={handleSave} disabled={saving}
                    style={{ marginLeft:'auto', padding:'9px 24px', background:saving?'#A78BFA':editEntryId?`linear-gradient(135deg,${AM},#B45309)`:`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'9px', fontSize:'13px', fontWeight:'700', cursor:saving?'not-allowed':'pointer', fontFamily:'inherit' }}>
                    {saving?'⏳ Saving...':editEntryId?'✅ Update Entry':'✅ Save Entry'}
                  </button>
                </div>
              </div>
            )}

            {/* ═══ RECORDED ENTRIES ═══ */}
            {entries.length===0&&!showForm ? (
              <div style={{ textAlign:'center', padding:'60px', background:'#fff', borderRadius:'14px', border:`1.5px solid ${PL}` }}>
                <div style={{ fontSize:'40px', marginBottom:'10px' }}>♻️</div>
                <div style={{ fontWeight:'700', fontSize:'15px', color:'#374151' }}>No inspections recorded yet</div>
                <div style={{ fontSize:'12px', color:'#9CA3AF', marginTop:'4px' }}>Click "Add Inspection Entry" to begin</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                {entries.map(entry=>{
                  const records   = entry.plastics_inspection_records||[];
                  const wOOS      = records.some(r=>r.weight_pass&&r.weight_pass!=='pass');
                  const isEditing = editEntryId===entry.id;

                  return (
                    <div key={entry.id} style={{ background:'#fff', borderRadius:'12px', border:`2px solid ${isEditing?'#FED7AA':wOOS?RD:PL}`, overflow:'hidden', boxShadow:isEditing?'0 4px 12px rgba(217,119,6,0.15)':wOOS?'0 2px 8px rgba(220,38,38,0.08)':'0 1px 4px rgba(107,33,168,0.05)' }}>

                      {/* Entry header */}
                      <div style={{ background:isEditing?'#FFFBEB':wOOS?'#FEF2F2':'#F5F3FF', padding:'10px 16px', display:'flex', alignItems:'center', gap:'12px', borderBottom:`1px solid ${isEditing?'#FED7AA':wOOS?'#FECACA':PL}`, flexWrap:'wrap' }}>
                        <span style={{ fontWeight:'900', fontSize:'16px', color:P, fontFamily:'monospace' }}>🕐 {entry.inspection_time}</span>
                        <span style={{ fontSize:'12px', color:'#64748B', fontWeight:'600' }}>✍️ {entry.inspector_name||'—'}</span>
                        <span style={{ fontSize:'11px', color:'#94A3B8' }}>{records.length} machine{records.length!==1?'s':''}</span>
                        {wOOS&&<span style={{ background:'#FEF2F2', color:RD, padding:'2px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:'800', border:'1px solid #FECACA' }}>⚠️ Weight OOS</span>}
                        {!wOOS&&records.length>0&&<span style={{ background:'#ECFDF5', color:GR, padding:'2px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:'700', border:'1px solid #A7F3D0' }}>✓ All OK</span>}
                        {isEditing&&<span style={{ background:'#FEF3C7', color:AM, padding:'2px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:'800', border:'1px solid #FCD34D' }}>✏️ Editing...</span>}
                        {!showForm&&(
                          <button onClick={()=>openEdit(entry)}
                            style={{ marginLeft:'auto', padding:'5px 14px', background:'#FFF7ED', color:AM, border:`1px solid #FED7AA`, borderRadius:'7px', fontSize:'11px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>
                            ✏️ Edit
                          </button>
                        )}
                      </div>

                      {/* Results table */}
                      <div className="thin-scroll" style={{ overflowX:'auto' }}>
                        <table style={{ borderCollapse:'collapse', width:'100%', fontSize:'12px' }}>
                          <thead>
                            <tr>
                              <TH w="80px">Machine</TH>
                              <TH w="65px" center>Capacity</TH>
                              <TH w="80px" center>Shape</TH>
                              <TH w="72px" center>JC Colour</TH>
                              <TH w="120px" center>Weight A / B</TH>
                              <TH w="76px" center>Drop Test</TH>
                              <TH w="76px" center>Stack Test</TH>
                              <TH w="82px" center>Neck Height</TH>
                              <TH w="88px" center>Mouth Profile</TH>
                              <TH w="76px" center>Trimming</TH>
                              <TH w="76px" center>Colour</TH>
                              <TH w="76px" center>Pinholes</TH>
                              <TH w="80px" center>Black Spots</TH>
                              <TH w="80px" center>Water Marks</TH>
                              <TH w="80px" center>Depressions</TH>
                              <TH w="90px" center>Lines of Weakness</TH>
                              <TH w="110px">Remarks</TH>
                              <TH w="100px">Action</TH>
                            </tr>
                          </thead>
                          <tbody>
                            {records.map((r, ri) => {
                              const wFail  = r.weight_pass && r.weight_pass!=='pass';
                              const spec   = WEIGHT_SPEC[r.capacity] || { label:'—' };
                              const rowBg  = ri%2===0?'#fff':'#FAFBFC';
                              const pApass = checkWeight(r.capacity, r.weight_a);
                              const pBpass = checkWeight(r.capacity, r.weight_b);

                              const wBadge = (val, pass) => (
                                <span style={{ fontFamily:'monospace', fontWeight:'800', fontSize:'12px', color:pass===false?RD:pass===true?GR:'#64748B' }}>
                                  {val??'—'}
                                </span>
                              );

                              return (
                                <tr key={r.id} style={{ background:wFail?'#FFF5F5':rowBg }}>
                                  <td style={{ padding:'8px 9px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9', fontWeight:'700', color:P }}>{r.machine}</td>
                                  <td style={{ padding:'8px 8px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9', textAlign:'center' }}>
                                    <span style={{ background:'#F5F3FF', color:P, padding:'2px 7px', borderRadius:'5px', fontSize:'11px', fontWeight:'700' }}>{r.capacity}</span>
                                  </td>
                                  <td style={{ padding:'8px 8px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9', textAlign:'center', color:'#475569', fontSize:'11px' }}>{r.shape||'—'}</td>
                                  <td style={{ padding:'8px 8px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9', textAlign:'center' }}>
                                    {r.jc_colour ? (
                                      <span style={{ background:r.jc_colour==='Yellow'?'#FEF9C3':'#FEF3C7', color:r.jc_colour==='Yellow'?'#A16207':'#92400E', padding:'2px 7px', borderRadius:'5px', fontSize:'11px', fontWeight:'700' }}>
                                        {r.jc_colour}
                                      </span>
                                    ) : <span style={{ color:'#CBD5E1' }}>—</span>}
                                  </td>
                                  {/* Weight A / B */}
                                  <td style={{ padding:'8px 8px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9', textAlign:'center' }}>
                                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'2px' }}>
                                      <div style={{ display:'flex', gap:'5px', alignItems:'center' }}>
                                        <span style={{ fontSize:'9px', color:'#94A3B8', fontWeight:'700' }}>A:</span>{wBadge(r.weight_a, pApass)}
                                        <span style={{ color:'#CBD5E1' }}>/</span>
                                        <span style={{ fontSize:'9px', color:'#94A3B8', fontWeight:'700' }}>B:</span>{wBadge(r.weight_b, pBpass)}
                                      </div>
                                      <span style={{ fontSize:'9px', color:wFail?RD:'#94A3B8', fontWeight:wFail?'700':'400' }}>
                                        {wFail?'⚠️ OOS — '+spec.label:r.weight_pass==='pass'?'✓ PASS — '+spec.label:spec.label}
                                      </span>
                                    </div>
                                  </td>
                                  {/* Parameters */}
                                  {PARAMS.map(p=>{
                                    const val = r[p.key];
                                    const isNA = val==='N/A';
                                    return (
                                      <td key={p.key} style={{ padding:'8px 7px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9', textAlign:'center', color:isNA?'#CBD5E1':val?'#1E293B':'#CBD5E1', fontSize:'11px', fontStyle:isNA?'italic':'normal' }}>
                                        {val||'—'}
                                      </td>
                                    );
                                  })}
                                  <td style={{ padding:'8px 7px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9', color:r.remarks?'#1E293B':'#CBD5E1', fontSize:'11px' }}>{r.remarks||'—'}</td>
                                  <td style={{ padding:'8px 7px', borderBottom:'1px solid #F1F5F9', color:r.action_taken?'#1E293B':'#CBD5E1', fontSize:'11px' }}>{r.action_taken||'—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ═══ SHIFT SIGN-OFF ═══ */}
            {(entries.length>0||inspection)&&(
              <div style={{ marginTop:'24px', background:'#fff', borderRadius:'14px', border:`2px solid ${PL}`, padding:'22px' }}>
                <h3 style={{ margin:'0 0 4px', fontSize:'15px', fontWeight:'800', color:'#0F172A' }}>
                  📝 {shift==='day'?'Day':'Night'} Shift Sign-Off
                </h3>
                <p style={{ margin:'0 0 18px', fontSize:'12px', color:'#94A3B8' }}>Complete at end of shift · signed by Head of QA/QC</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'14px' }}>
                  <div>
                    <label style={lbl}>Analyst / Inspector</label>
                    <select value={signoff?.inspector_name||''} onChange={e=>setSignoff(p=>({...p,inspector_name:e.target.value}))} style={sel}>
                      <option value="">— Select —</option>
                      {staffList.map(s=><option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Sign-Off Date</label>
                    <input type="date" value={signoff?.signoff_date||date} onChange={e=>setSignoff(p=>({...p,signoff_date:e.target.value}))} style={inp}/>
                  </div>
                </div>
                <div style={{ marginBottom:'14px' }}>
                  <label style={lbl}>Comments — Head of Quality Assurance / Quality Controller</label>
                  <textarea value={signoff?.hod_comments||''} onChange={e=>setSignoff(p=>({...p,hod_comments:e.target.value}))} rows={3}
                    placeholder="Enter shift observations, quality notes and recommendations..."
                    style={{ ...inp, resize:'vertical', minHeight:'80px' }}/>
                </div>
                <div style={{ marginBottom:'18px' }}>
                  <label style={lbl}>Head of QA/QC Signature</label>
                  <input type="text" value={signoff?.hod_signature||''} onChange={e=>setSignoff(p=>({...p,hod_signature:e.target.value}))} placeholder="Type full name as signature..." style={inp}/>
                </div>
                <button onClick={saveSignoff}
                  style={{ width:'100%', padding:'11px', background:`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'9px', fontSize:'13px', fontWeight:'800', cursor:'pointer', fontFamily:'inherit' }}>
                  ✅ Sign Off {shift==='day'?'Day':'Night'} Shift Report
                </button>
                {signoff?.signed_at&&(
                  <p style={{ textAlign:'center', fontSize:'12px', color:GR, marginTop:'8px', fontWeight:'600' }}>
                    ✅ Signed on {format(new Date(signoff.signed_at),'dd MMMM yyyy · HH:mm')}
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
