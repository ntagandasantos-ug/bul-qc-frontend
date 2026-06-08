// ============================================================
// FILE: src/pages/SoapLinePage.jsx
// Fixes: edit entry, portal dropdowns (above scrollbar),
//        thin scrollbar
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
const G  = '#FFB81C';

const BRANDS = [
  { name:'White Star',           sizes:['1kg','800g','600g'] },
  { name:'Blue Magic',           sizes:['1kg','600g']        },
  { name:'Kuku Blue',            sizes:['600g']              },
  { name:'Bul Star Blue',        sizes:['600g']              },
  { name:'White Star Aloe Vera', sizes:['1kg','600g']        },
  { name:'Bul Star Natural',     sizes:['1kg']               },
  { name:'Bul Star Cream',       sizes:['600g']              },
  { name:'Light Star',           sizes:['1kg','600g']        },
  { name:'Bull Brown',           sizes:['500g']              },
];

const LINES = ['Line 1','Line 2','Line 3','Line 4','Line 5'];

const WEIGHT_SPEC = {
  '1kg' :{ min:1000, max:1010, label:'1000–1010 g' },
  '800g':{ min:800,  max:810,  label:'800–810 g'   },
  '600g':{ min:600,  max:610,  label:'600–610 g'   },
  '500g':{ min:500,  max:510,  label:'500–510 g'   },
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

// ── Thin scrollbar CSS ────────────────────────────────────
const scrollCSS = `
  .thin-scroll::-webkit-scrollbar { height: 4px; width: 4px; }
  .thin-scroll::-webkit-scrollbar-track { background: #F1F5F9; border-radius: 4px; }
  .thin-scroll::-webkit-scrollbar-thumb { background: #C4B5FD; border-radius: 4px; }
  .thin-scroll::-webkit-scrollbar-thumb:hover { background: #7C3AED; }
`;

// ── Smart autocomplete — portal-based dropdown ────────────
// Uses createPortal + getBoundingClientRect so dropdown
// always renders above the horizontal scrollbar
function SmartCell({ paramKey, value, onChange, options, onNewOption, placeholder }) {
  const [open,  setOpen]  = useState(false);
  const [q,     setQ]     = useState(value || '');
  const [rect,  setRect]  = useState(null);
  const inputRef          = useRef(null);

  useEffect(() => { setQ(value || ''); }, [value]);

  const filtered = useMemo(() =>
    (options[paramKey] || [])
      .filter(o => o.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 8),
    [options, paramKey, q]
  );

  const openDropdown = () => {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      setRect({ top: r.bottom + 2, left: r.left, width: Math.max(r.width, 150) });
    }
    setOpen(true);
  };

  const select = (v) => { setQ(v); onChange(v); setOpen(false); };

  const handleBlur = () => {
    setTimeout(() => {
      setOpen(false);
      if (q.trim() && q !== value) { onChange(q.trim()); onNewOption(paramKey, q.trim()); }
    }, 160);
  };

  const dropdown = open && filtered.length > 0 && rect
    ? createPortal(
        <div style={{
          position : 'fixed',
          top      : rect.top,
          left     : rect.left,
          width    : rect.width,
          background: '#fff',
          border   : '1.5px solid #C4B5FD',
          borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(107,33,168,0.15)',
          zIndex   : 9999,
          maxHeight: '160px',
          overflowY: 'auto',
        }}>
          {filtered.map(o => (
            <div key={o} onMouseDown={() => select(o)}
              style={{ padding:'7px 10px', fontSize:'12px', cursor:'pointer', borderBottom:'1px solid #F8FAFC', color:'#1E293B' }}
              onMouseEnter={e => e.currentTarget.style.background = '#F5F3FF'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
              {o}
            </div>
          ))}
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        value={q}
        placeholder={placeholder || '—'}
        onChange={e => { setQ(e.target.value); openDropdown(); }}
        onFocus={openDropdown}
        onBlur={handleBlur}
        style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:'5px', padding:'5px 7px', fontSize:'12px', fontFamily:'inherit', background:'#fff', outline:'none', boxSizing:'border-box' }}
      />
      {dropdown}
    </>
  );
}

// ── Weight cell ───────────────────────────────────────────
function WeightCell({ packSize, w1, w2, onW1, onW2 }) {
  const spec = WEIGHT_SPEC[packSize] || { min:0, max:9999, label:'—' };
  const p1   = w1!==''&&w1!=null&&!isNaN(w1) ? parseFloat(w1)>=spec.min&&parseFloat(w1)<=spec.max : null;
  const p2   = w2!==''&&w2!=null&&!isNaN(w2) ? parseFloat(w2)>=spec.min&&parseFloat(w2)<=spec.max : null;
  const fail = p1===false||p2===false;

  const wInp = (val, cb, pass) => (
    <input type="number" value={val??''} onChange={e=>cb(e.target.value)} placeholder="g"
      style={{ width:'60px', border:`1px solid ${pass===null?'#E2E8F0':pass?'#86EFAC':'#FECACA'}`, borderRadius:'5px', padding:'4px 5px', fontSize:'12px', fontFamily:'inherit', background:pass===null?'#fff':pass?'#F0FDF4':'#FFF5F5', outline:'none', textAlign:'center' }}
    />
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'2px', alignItems:'center' }}>
      <div style={{ display:'flex', gap:'3px', alignItems:'center' }}>
        {wInp(w1, onW1, p1)}
        <span style={{ fontSize:'10px', color:'#94A3B8' }}>/</span>
        {wInp(w2, onW2, p2)}
      </div>
      <div style={{ fontSize:'9px', color:fail?RD:'#94A3B8', fontWeight:fail?'700':'400', whiteSpace:'nowrap' }}>
        {fail ? '⚠️ OOS' : spec.label}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
export default function SoapLinePage() {
  const { user } = useAuth();

  const [shift,      setShift]      = useState('day');
  const [date,       setDate]       = useState(format(new Date(),'yyyy-MM-dd'));
  const [inspection, setInspection] = useState(null);
  const [entries,    setEntries]    = useState([]);
  const [signoff,    setSignoff]    = useState(null);
  const [options,    setOptions]    = useState({});
  const [staffList,  setStaffList]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [editEntryId,setEditEntryId]= useState(null); // null = new, id = editing

  // ── Load options & staff ──────────────────────────────────
  useEffect(() => {
    supabase.from('soap_param_options').select('parameter,value').order('use_count',{ascending:false})
      .then(({data}) => {
        const g = {};
        (data||[]).forEach(r => { if(!g[r.parameter])g[r.parameter]=[]; if(!g[r.parameter].includes(r.value))g[r.parameter].push(r.value); });
        setOptions(g);
      });
    supabase.from('lab_staff').select('full_name').eq('is_active',true).order('full_name')
      .then(({data}) => setStaffList((data||[]).map(s=>s.full_name)));
  }, []);

  // ── Load inspection session ───────────────────────────────
  const loadSession = useCallback(async () => {
    setLoading(true);
    try {
      let { data: insp } = await supabase.from('soap_line_inspections')
        .select('*').eq('shift_date',date).eq('shift',shift).maybeSingle();
      if (insp) {
        setInspection(insp);
        const { data: ents } = await supabase.from('soap_inspection_entries')
          .select(`*, soap_inspection_brand_records(*)`)
          .eq('inspection_id',insp.id).order('inspection_time');
        setEntries(ents||[]);
        const { data: so } = await supabase.from('soap_shift_signoffs')
          .select('*').eq('inspection_id',insp.id).maybeSingle();
        setSignoff(so || { inspection_id:insp.id, hod_comments:'', hod_signature:'', inspector_name:'', signoff_date:date });
      } else {
        setInspection(null); setEntries([]); setSignoff(null);
      }
    } finally { setLoading(false); }
  }, [date, shift]);

  useEffect(() => { loadSession(); }, [loadSession]);

  const saveOption = async (param, value) => {
    if (!value?.trim()) return;
    await supabase.from('soap_param_options').upsert({parameter:param,value:value.trim()},{onConflict:'parameter,value'});
    setOptions(prev => {
      const existing = prev[param]||[];
      return existing.includes(value.trim()) ? prev : {...prev,[param]:[value.trim(),...existing]};
    });
  };

  const ensureSession = async () => {
    if (inspection) return inspection;
    const { data, error } = await supabase.from('soap_line_inspections')
      .insert({shift_date:date,shift,created_by:user?.id}).select().single();
    if (error) throw error;
    setInspection(data); return data;
  };

  // ── Form state ────────────────────────────────────────────
  const emptyBrand = () => ({
    line_number:'Line 1', brand_name:'', pack_size:'',
    appearance:'', texture:'', specs:'', color:'',
    stamp:'', perfume:'', cutting:'', dimensions:'',
    weight_1:'', weight_2:'', remarks:'', action_taken:'',
  });

  const [form, setForm] = useState({
    inspection_time: format(new Date(),'HH:mm'),
    inspector_name : user?.full_name || '',
    brands         : [emptyBrand()],
  });

  const setF = (k,v) => setForm(p=>({...p,[k]:v}));
  const setB = (i,k,v) => setForm(p=>{ const b=[...p.brands]; b[i]={...b[i],[k]:v}; return {...p,brands:b}; });

  // ── Open form for EDIT ────────────────────────────────────
  const openEdit = (entry) => {
    const brands = (entry.soap_inspection_brand_records||[]).map(b => ({
      _id        : b.id,
      line_number: b.line_number || 'Line 1',
      brand_name : b.brand_name,
      pack_size  : b.pack_size,
      appearance : b.appearance  || '',
      texture    : b.texture     || '',
      specs      : b.specs       || '',
      color      : b.color       || '',
      stamp      : b.stamp       || '',
      perfume    : b.perfume     || '',
      cutting    : b.cutting     || '',
      dimensions : b.dimensions  || '',
      weight_1   : b.weight_1   ?? '',
      weight_2   : b.weight_2   ?? '',
      remarks    : b.remarks     || '',
      action_taken: b.action_taken||'',
    }));
    setForm({
      inspection_time: entry.inspection_time,
      inspector_name : entry.inspector_name || '',
      brands         : brands.length > 0 ? brands : [emptyBrand()],
    });
    setEditEntryId(entry.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior:'smooth' });
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditEntryId(null);
    setForm({ inspection_time:format(new Date(),'HH:mm'), inspector_name:user?.full_name||'', brands:[emptyBrand()] });
  };

  // ── Save (new or update) ──────────────────────────────────
  const handleSave = async () => {
    if (!form.inspection_time)  { toast.warning('Enter inspection time'); return; }
    if (!form.inspector_name)   { toast.warning('Select inspector'); return; }
    if (form.brands.some(b=>!b.brand_name||!b.pack_size)) {
      toast.warning('Select brand and pack size for all rows'); return;
    }
    setSaving(true);
    try {
      let entryId = editEntryId;

      if (editEntryId) {
        // UPDATE entry header
        await supabase.from('soap_inspection_entries').update({
          inspection_time: form.inspection_time,
          inspector_name : form.inspector_name,
        }).eq('id', editEntryId);

        // DELETE old brand records then re-insert
        await supabase.from('soap_inspection_brand_records').delete().eq('entry_id', editEntryId);
      } else {
        // INSERT new session + entry
        const session = await ensureSession();
        const { data: entry, error: eErr } = await supabase.from('soap_inspection_entries')
          .insert({ inspection_id:session.id, inspection_time:form.inspection_time, line_number:'Multiple', inspector_name:form.inspector_name })
          .select().single();
        if (eErr) throw eErr;
        entryId = entry.id;
      }

      // Insert brand records
      for (const b of form.brands) {
        const spec  = WEIGHT_SPEC[b.pack_size] || { min:0, max:9999 };
        const w1    = parseFloat(b.weight_1);
        const w2    = parseFloat(b.weight_2);
        const wPass = (!isNaN(w1)&&!isNaN(w2))
          ? (w1>=spec.min&&w1<=spec.max&&w2>=spec.min&&w2<=spec.max)
          : null;
        await supabase.from('soap_inspection_brand_records').insert({
          entry_id    : entryId,
          brand_name  : b.brand_name,   pack_size  : b.pack_size,
          appearance  : b.appearance||null, texture: b.texture||null,
          specs       : b.specs||null,  color      : b.color||null,
          stamp       : b.stamp||null,  perfume    : b.perfume||null,
          cutting     : b.cutting||null,dimensions : b.dimensions||null,
          weight_1    : isNaN(w1)?null:w1,
          weight_2    : isNaN(w2)?null:w2,
          weight_pass : wPass,
          remarks     : b.remarks||null,
          action_taken: b.action_taken||null,
          line_number : b.line_number,
        });
        for (const pk of [...PARAMS.map(p=>p.key),'remarks','action']) {
          const val = pk==='action'?b.action_taken:pk==='remarks'?b.remarks:b[pk];
          if (val?.trim()) saveOption(pk==='action'?'action':pk, val.trim());
        }
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
      await supabase.from('soap_shift_signoffs').upsert({...signoff,signed_at:new Date().toISOString()},{onConflict:'inspection_id'});
      toast.success('✅ Shift signed off');
      loadSession();
    } catch(e) { toast.error(e.message); }
  };

  const hasOOS = entries.some(e=>(e.soap_inspection_brand_records||[]).some(b=>b.weight_pass===false));

  const inp = { border:'1.5px solid #E2E8F0', borderRadius:'8px', padding:'8px 11px', fontSize:'13px', fontFamily:'inherit', background:'#fff', outline:'none', boxSizing:'border-box', width:'100%' };
  const sel = { ...inp, cursor:'pointer', appearance:'auto' };
  const lbl = { display:'block', fontSize:'11px', fontWeight:'700', color:'#4C1D95', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'0.4px' };

  const TH = ({ children, w, center }) => (
    <th style={{ padding:'8px 8px', background:`linear-gradient(180deg,${P},#5B1894)`, color:'#fff', fontSize:'10px', fontWeight:'700', whiteSpace:'nowrap', textAlign:center?'center':'left', borderRight:'1px solid rgba(255,255,255,0.15)', minWidth:w||'70px', letterSpacing:'0.3px', position:'sticky', top:0, zIndex:10 }}>
      {children}
    </th>
  );

  return (
    <div style={{ minHeight:'100vh', background:'#F8FAFC', paddingBottom:'60px' }}>
      {/* Inject thin scrollbar CSS */}
      <style>{scrollCSS}</style>
      <Navbar/>

      {/* Header */}
      <div style={{ background:`linear-gradient(135deg,${P},${PM})`, padding:'14px 24px', color:'#fff', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h1 style={{ margin:0, fontSize:'18px', fontWeight:'900' }}>🧼 Soap Line Inspection</h1>
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
            {/* Top action bar */}
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

            {/* ═══ FORM (new or edit) ═══ */}
            {showForm && (
              <div style={{ background:'#fff', borderRadius:'14px', border:`2px solid ${editEntryId?'#FED7AA':PL}`, marginBottom:'18px', overflow:'hidden', boxShadow:'0 4px 16px rgba(107,33,168,0.07)' }}>
                {/* Form header */}
                <div style={{ padding:'12px 18px', borderBottom:'1px solid #F1F5F9', background: editEntryId?'#FFFBEB':'#F5F3FF', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
                  <div style={{ display:'flex', gap:'16px', alignItems:'center', flexWrap:'wrap' }}>
                    <span style={{ fontWeight:'800', fontSize:'14px', color: editEntryId?'#D97706':P }}>
                      {editEntryId ? '✏️ Edit Inspection Entry' : '📋 New Inspection Entry'}
                    </span>
                    <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
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
                  </div>
                  <button onClick={cancelForm}
                    style={{ padding:'6px 14px', border:'1.5px solid #E2E8F0', borderRadius:'8px', background:'#F8FAFC', color:'#64748B', fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>
                    ✕ Cancel
                  </button>
                </div>

                {/* Brand rows */}
                <div className="thin-scroll" style={{ overflowX:'auto' }}>
                  <table style={{ borderCollapse:'collapse', width:'100%', fontSize:'12px' }}>
                    <thead>
                      <tr>
                        <TH w="88px">Line</TH>
                        <TH w="148px">Brand</TH>
                        <TH w="74px">Pack Size</TH>
                        {PARAMS.map(p=><TH key={p.key} w="92px" center>{p.label}</TH>)}
                        <TH w="148px" center>Weight (Bar1 / Bar2)</TH>
                        <TH w="108px">Remarks</TH>
                        <TH w="108px">Action Taken</TH>
                        <TH w="36px" center></TH>
                      </tr>
                    </thead>
                    <tbody>
                      {form.brands.map((b, idx) => {
                        const brandObj   = BRANDS.find(br=>br.name===b.brand_name);
                        const availSizes = brandObj?.sizes||[];
                        const evenBg     = idx%2===0?'#fff':'#FAFBFC';
                        return (
                          <tr key={idx} style={{ background:evenBg }}>
                            <td style={{ padding:'5px 5px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9' }}>
                              <select value={b.line_number} onChange={e=>setB(idx,'line_number',e.target.value)}
                                style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:'5px', padding:'4px', fontSize:'12px', fontFamily:'inherit', background:'#fff', outline:'none', cursor:'pointer' }}>
                                {LINES.map(l=><option key={l} value={l}>{l}</option>)}
                              </select>
                            </td>
                            <td style={{ padding:'5px 5px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9' }}>
                              <select value={b.brand_name} onChange={e=>setB(idx,'brand_name',e.target.value)}
                                style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:'5px', padding:'4px', fontSize:'12px', fontFamily:'inherit', background:'#fff', outline:'none', cursor:'pointer' }}>
                                <option value="">— Select —</option>
                                {BRANDS.map(br=><option key={br.name} value={br.name}>{br.name}</option>)}
                              </select>
                            </td>
                            <td style={{ padding:'5px 5px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9' }}>
                              <select value={b.pack_size} onChange={e=>setB(idx,'pack_size',e.target.value)} disabled={!b.brand_name}
                                style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:'5px', padding:'4px', fontSize:'12px', fontFamily:'inherit', background:b.brand_name?'#fff':'#F8FAFC', outline:'none', cursor:b.brand_name?'pointer':'not-allowed' }}>
                                <option value="">—</option>
                                {availSizes.map(s=><option key={s} value={s}>{s}</option>)}
                              </select>
                            </td>
                            {PARAMS.map(param=>(
                              <td key={param.key} style={{ padding:'4px 4px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9' }}>
                                <SmartCell paramKey={param.key} value={b[param.key]} onChange={v=>setB(idx,param.key,v)} options={options} onNewOption={saveOption}/>
                              </td>
                            ))}
                            <td style={{ padding:'4px 6px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9' }}>
                              <WeightCell packSize={b.pack_size} w1={b.weight_1} w2={b.weight_2} onW1={v=>setB(idx,'weight_1',v)} onW2={v=>setB(idx,'weight_2',v)}/>
                            </td>
                            <td style={{ padding:'4px 4px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9' }}>
                              <SmartCell paramKey="remarks" value={b.remarks} onChange={v=>setB(idx,'remarks',v)} options={options} onNewOption={saveOption}/>
                            </td>
                            <td style={{ padding:'4px 4px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9' }}>
                              <SmartCell paramKey="action" value={b.action_taken} onChange={v=>setB(idx,'action_taken',v)} options={options} onNewOption={saveOption}/>
                            </td>
                            <td style={{ padding:'4px 4px', borderBottom:'1px solid #F1F5F9', textAlign:'center' }}>
                              {form.brands.length>1 && (
                                <button onClick={()=>setForm(p=>({...p,brands:p.brands.filter((_,i)=>i!==idx)}))}
                                  style={{ background:'none', border:'none', color:'#CBD5E1', cursor:'pointer', fontSize:'15px', lineHeight:1, padding:'2px' }}
                                  title="Remove row">✕</button>
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
                  <button onClick={()=>setForm(p=>({...p,brands:[...p.brands,emptyBrand()]}))}
                    style={{ padding:'7px 16px', border:'2px dashed #C4B5FD', borderRadius:'8px', background:'#FAFBFF', color:PM, fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>
                    + Add Brand Row
                  </button>
                  <span style={{ fontSize:'11px', color:'#94A3B8' }}>Each row = one brand on one line at this time</span>
                  <button onClick={handleSave} disabled={saving}
                    style={{ marginLeft:'auto', padding:'9px 24px', background:saving?'#A78BFA':editEntryId?'linear-gradient(135deg,#D97706,#B45309)':`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'9px', fontSize:'13px', fontWeight:'700', cursor:saving?'not-allowed':'pointer', fontFamily:'inherit' }}>
                    {saving ? '⏳ Saving...' : editEntryId ? '✅ Update Entry' : '✅ Save Entry'}
                  </button>
                </div>
              </div>
            )}

            {/* ═══ RECORDED ENTRIES ═══ */}
            {entries.length === 0 && !showForm ? (
              <div style={{ textAlign:'center', padding:'60px', background:'#fff', borderRadius:'14px', border:`1.5px solid ${PL}` }}>
                <div style={{ fontSize:'40px', marginBottom:'10px' }}>🧼</div>
                <div style={{ fontWeight:'700', fontSize:'15px', color:'#374151' }}>No inspections recorded yet</div>
                <div style={{ fontSize:'12px', color:'#9CA3AF', marginTop:'4px' }}>Click "Add Inspection Entry" to begin</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                {entries.map((entry) => {
                  const brands  = entry.soap_inspection_brand_records||[];
                  const wOOS    = brands.some(b=>b.weight_pass===false);
                  const isEditing = editEntryId === entry.id;

                  return (
                    <div key={entry.id} style={{ background:'#fff', borderRadius:'12px', border:`2px solid ${isEditing?'#FED7AA':wOOS?RD:PL}`, overflow:'hidden', boxShadow: isEditing?'0 4px 12px rgba(217,119,6,0.15)':wOOS?'0 2px 8px rgba(220,38,38,0.08)':'0 1px 4px rgba(107,33,168,0.05)' }}>

                      {/* Entry header */}
                      <div style={{ background:isEditing?'#FFFBEB':wOOS?'#FEF2F2':'#F5F3FF', padding:'10px 16px', display:'flex', alignItems:'center', gap:'12px', borderBottom:`1px solid ${isEditing?'#FED7AA':wOOS?'#FECACA':PL}`, flexWrap:'wrap' }}>
                        <span style={{ fontWeight:'900', fontSize:'16px', color:P, fontFamily:'monospace' }}>🕐 {entry.inspection_time}</span>
                        <span style={{ fontSize:'12px', color:'#64748B', fontWeight:'600' }}>✍️ {entry.inspector_name||'—'}</span>
                        <span style={{ fontSize:'11px', color:'#94A3B8' }}>{brands.length} brand{brands.length!==1?'s':''}</span>
                        {wOOS && <span style={{ background:'#FEF2F2', color:RD, padding:'2px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:'800', border:'1px solid #FECACA' }}>⚠️ Weight OOS</span>}
                        {!wOOS && brands.length>0 && <span style={{ background:'#ECFDF5', color:GR, padding:'2px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:'700', border:'1px solid #A7F3D0' }}>✓ All OK</span>}
                        {isEditing && <span style={{ background:'#FEF3C7', color:'#D97706', padding:'2px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:'800', border:'1px solid #FCD34D' }}>✏️ Editing...</span>}

                        {/* Edit button */}
                        {!showForm && (
                          <button onClick={()=>openEdit(entry)}
                            style={{ marginLeft:'auto', padding:'5px 14px', background:'#FFF7ED', color:'#D97706', border:'1px solid #FED7AA', borderRadius:'7px', fontSize:'11px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'4px' }}>
                            ✏️ Edit
                          </button>
                        )}
                      </div>

                      {/* Results table */}
                      <div className="thin-scroll" style={{ overflowX:'auto' }}>
                        <table style={{ borderCollapse:'collapse', width:'100%', fontSize:'12px' }}>
                          <thead>
                            <tr>
                              <TH w="75px">Line</TH>
                              <TH w="140px">Brand</TH>
                              <TH w="70px" center>Pack Size</TH>
                              {PARAMS.map(p=><TH key={p.key} w="80px" center>{p.label}</TH>)}
                              <TH w="140px" center>Weight (g)</TH>
                              <TH w="100px">Remarks</TH>
                              <TH w="110px">Action</TH>
                            </tr>
                          </thead>
                          <tbody>
                            {brands.map((b, bi) => {
                              const spec  = WEIGHT_SPEC[b.pack_size]||{min:0,max:9999,label:'—'};
                              const wFail = b.weight_pass===false;
                              const rowBg = bi%2===0?'#fff':'#FAFBFC';
                              return (
                                <tr key={b.id} style={{ background:wFail?'#FFF5F5':rowBg }}>
                                  <td style={{ padding:'9px 10px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9', fontWeight:'600', color:'#475569' }}>{b.line_number||'—'}</td>
                                  <td style={{ padding:'9px 10px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9', fontWeight:'700', color:'#0F172A', whiteSpace:'nowrap' }}>{b.brand_name}</td>
                                  <td style={{ padding:'9px 8px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9', textAlign:'center' }}>
                                    <span style={{ background:'#FFFBEB', color:'#D97706', padding:'2px 7px', borderRadius:'5px', fontSize:'11px', fontWeight:'700', border:'1px solid #FED7AA' }}>{b.pack_size}</span>
                                  </td>
                                  {PARAMS.map(param=>(
                                    <td key={param.key} style={{ padding:'9px 8px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9', textAlign:'center', color:b[param.key]?'#1E293B':'#CBD5E1' }}>
                                      {b[param.key]||'—'}
                                    </td>
                                  ))}
                                  <td style={{ padding:'9px 10px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9', textAlign:'center' }}>
                                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'2px' }}>
                                      <span style={{ fontWeight:'900', fontSize:'13px', color:wFail?RD:GR, fontFamily:'monospace' }}>
                                        {b.weight_1??'—'} / {b.weight_2??'—'}
                                      </span>
                                      <span style={{ fontSize:'9px', color:wFail?RD:'#94A3B8', fontWeight:wFail?'700':'400' }}>
                                        {wFail?'⚠️ OOS — '+spec.label:b.weight_pass===true?'✓ PASS — '+spec.label:spec.label}
                                      </span>
                                    </div>
                                  </td>
                                  <td style={{ padding:'9px 8px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9', color:b.remarks?'#1E293B':'#CBD5E1', fontSize:'12px' }}>{b.remarks||'—'}</td>
                                  <td style={{ padding:'9px 8px', borderBottom:'1px solid #F1F5F9', color:b.action_taken?'#1E293B':'#CBD5E1', fontSize:'12px' }}>{b.action_taken||'—'}</td>
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
            {(entries.length>0||inspection) && (
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
                    placeholder="Enter shift observations, quality notes, and recommendations..."
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

                {signoff?.signed_at && (
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
