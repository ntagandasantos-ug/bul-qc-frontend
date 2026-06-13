// ============================================================
// FILE: src/pages/FatsLinePage.jsx
// Fats Line Inspection — Chipo, Chipsy, Cowboy, Kimbo
// Same design pattern as OilLinePage
// ============================================================

import React, {
  useState, useEffect, useCallback, useRef, useMemo,
} from 'react';
import { createPortal } from 'react-dom';
import Navbar     from '../components/Navbar';
import PageFooter from '../components/PageFooter';
import { useAuth }  from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { format, addYears } from 'date-fns';
import { toast } from 'react-toastify';

const P  = '#6B21A8';
const PM = '#7C3AED';
const PL = '#EDE9FE';
const GR = '#16A34A';
const RD = '#DC2626';
const AM = '#D97706';
const G  = '#FFB81C';

// ── Brand catalogue ───────────────────────────────────────
const CATALOGUE = {
  'Chipo': [
    { label:'10 kg', type:'Bulk Pack', prefix:'00380', targetKg:10.0 },
  ],
  'Chipsy': [
    { label:'10 kg', type:'Bulk Pack', prefix:'00480', targetKg:10.0 },
  ],
  'Cowboy': [
    { label:'25 g',  type:'Pouch',    prefix:'00511', targetKg:0.025 },
    { label:'100 g', type:'Pail/Tub', prefix:'00520', targetKg:0.1   },
    { label:'200 g', type:'Pouch',    prefix:'00530', targetKg:0.2   },
    { label:'500 g', type:'Pail/Tub', prefix:'00540', targetKg:0.5   },
  ],
  'Kimbo': [
    { label:'25 g',  type:'Pouch',    prefix:'00611', targetKg:0.025 },
    { label:'100 g', type:'Pail/Tub', prefix:'00620', targetKg:0.1   },
    { label:'200 g', type:'Pouch',    prefix:'00630', targetKg:0.2   },
    { label:'500 g', type:'Pail/Tub', prefix:'00640', targetKg:0.5   },
  ],
};

const BRANDS = Object.keys(CATALOGUE);

const getEntry  = (brand, label) =>
  (CATALOGUE[brand]||[]).find(e => e.label === label) || null;

const genBatch  = (brand, label, dateStr, shift) => {
  const e = getEntry(brand, label);
  if (!e?.prefix || !dateStr) return '';
  return e.prefix + format(new Date(dateStr),'dd') + (shift==='day'?'1':'2');
};

const calcExpiry = (batch, dateStr) => {
  if (!batch || batch.length < 8) return '';
  try {
    const day  = batch.slice(5,7);
    const prod = new Date(dateStr);
    prod.setDate(parseInt(day,10));
    return format(addYears(prod,1),'yyyy-MM-dd');
  } catch { return ''; }
};

const targetStr = (brand, label) => {
  const e = getEntry(brand, label);
  if (!e) return '—';
  return e.targetKg >= 1 ? `${e.targetKg} kg` : `${e.targetKg * 1000} g`;
};

// Analysis parameters (1–6 from LIMS, 7 = Votation dropdown)
const ANA_PARAMS = [
  { key:'ffa',           label:'%FFA',           unit:'%'      },
  { key:'colour',        label:'Colour (5¼" Cell)',unit:'R'    },
  { key:'slip_point',    label:'Slip Point',      unit:'°C'    },
  { key:'peroxide_value',label:'Peroxide Value',  unit:'meq/kg'},
  { key:'spatter',       label:'Spatter',         unit:''      },
  { key:'vitamin_a',     label:'Vitamin A',       unit:'mg/kg' },
];

// Keywords used to find fats samples in LIMS
const FATS_KEYWORDS = ['chipo','chipsy','kimbo','cowboy','fat','shortening'];

// Thin scrollbar CSS
const scrollCSS = `
  .thin-scroll::-webkit-scrollbar { height:4px; width:4px; }
  .thin-scroll::-webkit-scrollbar-track { background:#F1F5F9; border-radius:4px; }
  .thin-scroll::-webkit-scrollbar-thumb { background:#C4B5FD; border-radius:4px; }
  .thin-scroll::-webkit-scrollbar-thumb:hover { background:#7C3AED; }
`;

// ── Portal SmartCell ──────────────────────────────────────
function SmartCell({ paramKey, value, onChange, options, onNewOption, placeholder }) {
  const [open, setOpen] = useState(false);
  const [q,    setQ]    = useState(value||'');
  const [rect, setRect] = useState(null);
  const inputRef        = useRef(null);

  useEffect(()=>{ setQ(value||''); },[value]);

  const filtered = useMemo(()=>
    (options[paramKey]||[]).filter(o=>o.toLowerCase().includes(q.toLowerCase())).slice(0,10),
    [options,paramKey,q]
  );

  const openDD = () => {
    if (inputRef.current){
      const r = inputRef.current.getBoundingClientRect();
      setRect({ top:r.bottom+2, left:r.left, width:Math.max(r.width,160) });
    }
    setOpen(true);
  };

  const select = (v) => { setQ(v); onChange(v); setOpen(false); };

  const handleBlur = () => setTimeout(()=>{
    setOpen(false);
    if(q.trim()&&q!==value){ onChange(q.trim()); onNewOption(paramKey,q.trim()); }
  },160);

  const dropdown = open&&filtered.length>0&&rect ? createPortal(
    <div style={{ position:'fixed', top:rect.top, left:rect.left, width:rect.width, background:'#fff', border:'1.5px solid #C4B5FD', borderRadius:'8px', boxShadow:'0 8px 24px rgba(107,33,168,0.15)', zIndex:9999, maxHeight:'180px', overflowY:'auto' }}>
      {filtered.map(o=>(
        <div key={o} onMouseDown={()=>select(o)}
          style={{ padding:'7px 10px', fontSize:'12px', cursor:'pointer', borderBottom:'1px solid #F8FAFC', color:'#1E293B' }}
          onMouseEnter={e=>e.currentTarget.style.background='#F5F3FF'}
          onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
          {o}
        </div>
      ))}
    </div>, document.body
  ) : null;

  return (
    <>
      <input ref={inputRef} type="text" value={q}
        placeholder={placeholder||'—'}
        onChange={e=>{ setQ(e.target.value); openDD(); }}
        onFocus={openDD} onBlur={handleBlur}
        style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:'5px', padding:'5px 7px', fontSize:'12px', fontFamily:'inherit', background:'#fff', outline:'none', boxSizing:'border-box' }}
      />
      {dropdown}
    </>
  );
}

// ── Votation — flexible dropdown (select + type new) ──────
function VotationCell({ value, onChange, options, onNewOption }) {
  const [open, setOpen] = useState(false);
  const [q,    setQ]    = useState(value||'');
  const [rect, setRect] = useState(null);
  const inputRef        = useRef(null);

  useEffect(()=>{ setQ(value||''); },[value]);

  const opts = (options['votation']||[]).length > 0
    ? options['votation']
    : ['Pass','Fail','Acceptable','Not Acceptable','Borderline'];

  const filtered = opts.filter(o=>o.toLowerCase().includes(q.toLowerCase())).slice(0,8);

  const openDD = () => {
    if (inputRef.current){
      const r = inputRef.current.getBoundingClientRect();
      setRect({ top:r.bottom+2, left:r.left, width:Math.max(r.width,160) });
    }
    setOpen(true);
  };

  const select = (v) => { setQ(v); onChange(v); setOpen(false); };

  const handleBlur = () => setTimeout(()=>{
    setOpen(false);
    if(q.trim()&&q!==value){ onChange(q.trim()); onNewOption('votation',q.trim()); }
  },160);

  const dropdown = open&&filtered.length>0&&rect ? createPortal(
    <div style={{ position:'fixed', top:rect.top, left:rect.left, width:rect.width, background:'#fff', border:'1.5px solid #C4B5FD', borderRadius:'8px', boxShadow:'0 8px 24px rgba(107,33,168,0.15)', zIndex:9999, maxHeight:'160px', overflowY:'auto' }}>
      {filtered.map(o=>(
        <div key={o} onMouseDown={()=>select(o)}
          style={{ padding:'7px 10px', fontSize:'12px', cursor:'pointer', borderBottom:'1px solid #F8FAFC', color:'#1E293B' }}
          onMouseEnter={e=>e.currentTarget.style.background='#F5F3FF'}
          onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
          {o}
        </div>
      ))}
    </div>, document.body
  ) : null;

  return (
    <>
      <input ref={inputRef} type="text" value={q}
        placeholder="Select or type..."
        onChange={e=>{ setQ(e.target.value); openDD(); }}
        onFocus={openDD} onBlur={handleBlur}
        style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:'5px', padding:'5px 7px', fontSize:'12px', fontFamily:'inherit', background:'#fff', outline:'none', boxSizing:'border-box' }}
      />
      {dropdown}
    </>
  );
}

// ═══════════════════════════════════════════════════════════
export default function FatsLinePage() {
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
  const [fatsResults, setFatsResults] = useState({});

  // ── Load options, staff, LIMS fats analysis results ───────
  useEffect(()=>{
    supabase.from('fats_param_options').select('parameter,value').order('use_count',{ascending:false})
      .then(({data})=>{
        const g={};
        (data||[]).forEach(r=>{ if(!g[r.parameter])g[r.parameter]=[]; if(!g[r.parameter].includes(r.value))g[r.parameter].push(r.value); });
        setOptions(g);
      });
    supabase.from('lab_staff').select('full_name').eq('is_active',true).order('full_name')
      .then(({data})=>setStaffList((data||[]).map(s=>s.full_name)));
    loadFatsAnalysis();
  },[]);

  // Pull analysis values from LIMS for Chipo/Chipsy/Kimbo/Cowboy samples
  const loadFatsAnalysis = async () => {
    try {
      const { data: samples } = await supabase
        .from('registered_samples')
        .select(`
          id, sample_name,
          sample_test_assignments (
            result_value,
            tests ( name )
          )
        `)
        .or(FATS_KEYWORDS.map(k=>`sample_name.ilike.%${k}%`).join(','))
        .eq('status','complete')
        .order('registered_at',{ascending:false})
        .limit(30);

      if (!samples?.length) return;

      const testMap = {
        'FFA'           : 'ffa',
        '%FFA'          : 'ffa',
        'Color 5¼" Cell': 'colour',
        'Colour 5¼" Cell':'colour',
        'Slip Point'    : 'slip_point',
        'Peroxide Value': 'peroxide_value',
        'Spatter'       : 'spatter',
        'Vitamin A'     : 'vitamin_a',
      };

      const vals = {};
      ANA_PARAMS.forEach(p=>{ vals[p.key]=new Set(); });

      samples.forEach(s=>{
        (s.sample_test_assignments||[]).forEach(a=>{
          if (!a.result_value) return;
          const pKey = testMap[a.tests?.name];
          if (pKey) vals[pKey].add(a.result_value);
        });
      });

      // Merge into options
      setOptions(prev=>{
        const merged = {...prev};
        ANA_PARAMS.forEach(p=>{
          const v = [...vals[p.key]];
          if (!v.length) return;
          merged[p.key] = [...v, ...(merged[p.key]||[]).filter(x=>!v.includes(x))];
        });
        return merged;
      });

      const display={};
      ANA_PARAMS.forEach(p=>{ display[p.key]=[...vals[p.key]]; });
      setFatsResults(display);
    } catch(e){ console.error('Fats analysis load:', e.message); }
  };

  // ── Load session ──────────────────────────────────────────
  const loadSession = useCallback(async()=>{
    setLoading(true);
    try {
      let { data:insp } = await supabase.from('fats_line_inspections')
        .select('*').eq('shift_date',date).eq('shift',shift).maybeSingle();
      if (insp){
        setInspection(insp);
        const { data:ents } = await supabase.from('fats_inspection_entries')
          .select(`*, fats_inspection_records(*)`)
          .eq('inspection_id',insp.id).order('inspection_time');
        setEntries(ents||[]);
        const { data:so } = await supabase.from('fats_shift_signoffs')
          .select('*').eq('inspection_id',insp.id).maybeSingle();
        setSignoff(so||{ inspection_id:insp.id, hod_comments:'', hod_signature:'', inspector_name:'', signoff_date:date });
      } else {
        setInspection(null); setEntries([]); setSignoff(null);
      }
    } finally { setLoading(false); }
  },[date,shift]);

  useEffect(()=>{ loadSession(); },[loadSession]);

  const saveOption = async(param,value)=>{
    if (!value?.trim()) return;
    await supabase.from('fats_param_options').upsert({parameter:param,value:value.trim()},{onConflict:'parameter,value'});
    setOptions(prev=>{ const e=prev[param]||[]; return e.includes(value.trim())?prev:{...prev,[param]:[value.trim(),...e]}; });
  };

  const ensureSession = async()=>{
    if (inspection) return inspection;
    const { data,error } = await supabase.from('fats_line_inspections')
      .insert({shift_date:date,shift,created_by:user?.id}).select().single();
    if (error) throw error;
    setInspection(data); return data;
  };

  // ── Form state ────────────────────────────────────────────
  const emptyRecord = ()=>({
    brand_name:'', pack_size:'', pack_type:'',
    batch_number:'', net_weight:'', expiry_date:'',
    ffa:'', colour:'', slip_point:'',
    peroxide_value:'', spatter:'', vitamin_a:'',
    votation:'', remarks:'', action_taken:'',
  });

  const [form,setForm] = useState({
    inspection_time: format(new Date(),'HH:mm'),
    inspector_name : user?.full_name||'',
    records        : [emptyRecord()],
  });

  const setF = (k,v) => setForm(p=>({...p,[k]:v}));

  const setR = (i,k,v) => setForm(p=>{
    const records=[...p.records];
    const updated={...records[i],[k]:v};

    if (k==='brand_name'){
      updated.pack_size=''; updated.pack_type='';
      updated.batch_number=''; updated.expiry_date='';
    }
    if (k==='pack_size'){
      const e     = getEntry(records[i].brand_name, v);
      const batch = genBatch(records[i].brand_name, v, date, shift);
      updated.pack_type    = e?.type||'';
      updated.batch_number = batch;
      updated.expiry_date  = calcExpiry(batch, date);
    }
    if (k==='batch_number'){
      updated.expiry_date = calcExpiry(v, date);
    }

    records[i]=updated;
    return {...p,records};
  });

  // Open edit
  const openEdit = (entry)=>{
    const records=(entry.fats_inspection_records||[]).map(r=>({
      brand_name     : r.brand_name,
      pack_size      : r.pack_size,
      pack_type      : r.pack_type      ||'',
      batch_number   : r.batch_number   ||'',
      net_weight     : r.net_weight     ??'',
      expiry_date    : r.expiry_date    ||'',
      ffa            : r.ffa            ||'',
      colour         : r.colour         ||'',
      slip_point     : r.slip_point     ||'',
      peroxide_value : r.peroxide_value ||'',
      spatter        : r.spatter        ||'',
      vitamin_a      : r.vitamin_a      ||'',
      votation       : r.votation       ||'',
      remarks        : r.remarks        ||'',
      action_taken   : r.action_taken   ||'',
    }));
    setForm({ inspection_time:entry.inspection_time, inspector_name:entry.inspector_name||'', records:records.length>0?records:[emptyRecord()] });
    setEditEntryId(entry.id);
    setShowForm(true);
    window.scrollTo({top:0,behavior:'smooth'});
  };

  const cancelForm = ()=>{
    setShowForm(false); setEditEntryId(null);
    setForm({ inspection_time:format(new Date(),'HH:mm'), inspector_name:user?.full_name||'', records:[emptyRecord()] });
  };

  // Save
  const handleSave = async()=>{
    if (!form.inspection_time){ toast.warning('Enter inspection time'); return; }
    if (!form.inspector_name) { toast.warning('Select inspector'); return; }
    if (form.records.some(r=>!r.brand_name||!r.pack_size)){
      toast.warning('Select brand and pack size for all rows'); return;
    }
    setSaving(true);
    try {
      let entryId = editEntryId;
      if (editEntryId){
        await supabase.from('fats_inspection_entries')
          .update({ inspection_time:form.inspection_time, inspector_name:form.inspector_name })
          .eq('id',editEntryId);
        await supabase.from('fats_inspection_records').delete().eq('entry_id',editEntryId);
      } else {
        const session = await ensureSession();
        const { data:entry,error:eErr } = await supabase.from('fats_inspection_entries')
          .insert({ inspection_id:session.id, inspection_time:form.inspection_time, inspector_name:form.inspector_name })
          .select().single();
        if (eErr) throw eErr;
        entryId = entry.id;
      }

      for (const r of form.records){
        await supabase.from('fats_inspection_records').insert({
          entry_id       : entryId,
          brand_name     : r.brand_name,
          pack_size      : r.pack_size,
          pack_type      : r.pack_type      ||null,
          batch_number   : r.batch_number   ||null,
          target_weight  : targetStr(r.brand_name,r.pack_size),
          net_weight     : r.net_weight!==''?parseFloat(r.net_weight):null,
          expiry_date    : r.expiry_date    ||null,
          ffa            : r.ffa            ||null,
          colour         : r.colour         ||null,
          slip_point     : r.slip_point     ||null,
          peroxide_value : r.peroxide_value ||null,
          spatter        : r.spatter        ||null,
          vitamin_a      : r.vitamin_a      ||null,
          votation       : r.votation       ||null,
          remarks        : r.remarks        ||null,
          action_taken   : r.action_taken   ||null,
        });
        ANA_PARAMS.forEach(p=>{ if(r[p.key]?.trim()) saveOption(p.key,r[p.key]); });
        if (r.votation)     saveOption('votation',r.votation);
        if (r.remarks)      saveOption('remarks',r.remarks);
        if (r.action_taken) saveOption('action',r.action_taken);
      }

      toast.success(editEntryId?'✅ Entry updated':'✅ Entry saved');
      cancelForm();
      await loadSession();
    } catch(e){ toast.error('Failed: '+e.message); }
    finally { setSaving(false); }
  };

  const saveSignoff = async()=>{
    if (!signoff?.inspection_id){ toast.warning('No session to sign off'); return; }
    try {
      await supabase.from('fats_shift_signoffs')
        .upsert({...signoff,signed_at:new Date().toISOString()},{onConflict:'inspection_id'});
      toast.success('✅ Shift signed off'); loadSession();
    } catch(e){ toast.error(e.message); }
  };

  const hasLimsData = ANA_PARAMS.some(p=>(fatsResults[p.key]||[]).length>0);

  const inp = { border:'1.5px solid #E2E8F0', borderRadius:'8px', padding:'8px 11px', fontSize:'13px', fontFamily:'inherit', background:'#fff', outline:'none', boxSizing:'border-box', width:'100%' };
  const sel = { ...inp, cursor:'pointer', appearance:'auto' };
  const lbl = { display:'block', fontSize:'11px', fontWeight:'700', color:'#4C1D95', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'0.4px' };

  const TH = ({children,w,center})=>(
    <th style={{ padding:'8px 7px', background:`linear-gradient(180deg,${P},#5B1894)`, color:'#fff', fontSize:'10px', fontWeight:'700', whiteSpace:'nowrap', textAlign:center?'center':'left', borderRight:'1px solid rgba(255,255,255,0.15)', minWidth:w||'70px', letterSpacing:'0.3px', position:'sticky', top:0, zIndex:10 }}>
      {children}
    </th>
  );

  return (
    <div style={{ minHeight:'100vh', background:'#F8FAFC', paddingBottom:'60px' }}>
      <style>{scrollCSS}</style>
      <Navbar/>

      {/* Page header */}
      <div style={{ background:`linear-gradient(135deg,${P},${PM})`, padding:'14px 24px', color:'#fff', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h1 style={{ margin:0, fontSize:'18px', fontWeight:'900' }}>📦 Fats Line Inspection</h1>
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
          {hasLimsData && (
            <span style={{ background:'#F0FDF4', color:GR, padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:'700', border:'1px solid #A7F3D0' }}>
              🔬 LIMS values loaded
            </span>
          )}
          {entries.length>0 && (
            <span style={{ background:'#ECFDF5', color:GR, padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:'700', border:'1px solid #A7F3D0' }}>
              {entries.length} entr{entries.length!==1?'ies':'y'}
            </span>
          )}
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

            {/* LIMS notice */}
            {hasLimsData && (
              <div style={{ background:'#F0FDF4', border:'1px solid #A7F3D0', borderRadius:'10px', padding:'10px 16px', marginBottom:'14px', display:'flex', alignItems:'center', gap:'10px' }}>
                <span style={{ fontSize:'16px' }}>🔬</span>
                <div>
                  <div style={{ fontWeight:'700', fontSize:'12px', color:GR }}>Fats Analysis Values Loaded from LIMS</div>
                  <div style={{ fontSize:'11px', color:'#64748B', marginTop:'1px' }}>
                    Latest Chipo, Chipsy, Kimbo and Cowboy analysis results are available as dropdown suggestions.
                  </div>
                </div>
              </div>
            )}

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

                {/* Table */}
                <div className="thin-scroll" style={{ overflowX:'auto' }}>
                  <table style={{ borderCollapse:'collapse', width:'100%', fontSize:'12px' }}>
                    <thead>
                      <tr>
                        <TH w="110px">Brand</TH>
                        <TH w="90px">Pack Size</TH>
                        <TH w="80px" center>Pack Type</TH>
                        <TH w="108px" center>Batch No.</TH>
                        <TH w="88px" center>Target Wt</TH>
                        <TH w="92px" center>Net Weight</TH>
                        <TH w="100px" center>Expiry Date</TH>
                        {ANA_PARAMS.map(p=>(
                          <TH key={p.key} w="88px" center>
                            {p.label}
                            {p.unit && <><br/><span style={{fontSize:'9px',opacity:0.8}}>({p.unit})</span></>}
                          </TH>
                        ))}
                        <TH w="90px" center>Votation</TH>
                        <TH w="110px">Remarks</TH>
                        <TH w="110px">Action</TH>
                        <TH w="36px" center></TH>
                      </tr>
                    </thead>
                    <tbody>
                      {form.records.map((r,idx)=>{
                        const entry  = getEntry(r.brand_name, r.pack_size);
                        const rowBg  = idx%2===0?'#fff':'#FAFBFC';
                        return (
                          <tr key={idx} style={{ background:rowBg }}>
                            {/* Brand */}
                            <td style={{ padding:'5px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9' }}>
                              <select value={r.brand_name} onChange={e=>setR(idx,'brand_name',e.target.value)}
                                style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:'5px', padding:'4px', fontSize:'12px', fontFamily:'inherit', background:'#fff', outline:'none', cursor:'pointer' }}>
                                <option value="">— Select —</option>
                                {BRANDS.map(b=><option key={b} value={b}>{b}</option>)}
                              </select>
                            </td>
                            {/* Pack size */}
                            <td style={{ padding:'5px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9' }}>
                              <select value={r.pack_size} onChange={e=>setR(idx,'pack_size',e.target.value)} disabled={!r.brand_name}
                                style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:'5px', padding:'4px', fontSize:'12px', fontFamily:'inherit', background:r.brand_name?'#fff':'#F8FAFC', outline:'none', cursor:r.brand_name?'pointer':'not-allowed' }}>
                                <option value="">—</option>
                                {(CATALOGUE[r.brand_name]||[]).map(e=><option key={e.label} value={e.label}>{e.label}</option>)}
                              </select>
                            </td>
                            {/* Pack type (auto) */}
                            <td style={{ padding:'6px 8px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9', textAlign:'center', fontSize:'11px', color:'#64748B', fontWeight:'600', whiteSpace:'nowrap' }}>
                              {r.pack_type||'—'}
                            </td>
                            {/* Batch number */}
                            <td style={{ padding:'5px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9' }}>
                              <input type="text" value={r.batch_number} onChange={e=>setR(idx,'batch_number',e.target.value)}
                                style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:'5px', padding:'5px 6px', fontSize:'11px', fontFamily:'monospace', background:'#F5F3FF', outline:'none', boxSizing:'border-box', color:P, fontWeight:'700', textAlign:'center' }}/>
                            </td>
                            {/* Target weight (read-only) */}
                            <td style={{ padding:'6px 8px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9', textAlign:'center' }}>
                              <span style={{ fontSize:'12px', color:AM, fontWeight:'700', background:'#FFFBEB', padding:'2px 8px', borderRadius:'5px', border:'1px solid #FED7AA', whiteSpace:'nowrap' }}>
                                {entry ? (entry.targetKg>=1?`${entry.targetKg} kg`:`${entry.targetKg*1000} g`) : '—'}
                              </span>
                            </td>
                            {/* Net weight (manual) */}
                            <td style={{ padding:'4px 6px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9', textAlign:'center' }}>
                              <input type="number" step="0.001" value={r.net_weight} onChange={e=>setR(idx,'net_weight',e.target.value)}
                                placeholder="kg/g"
                                style={{ width:'76px', border:'1px solid #E2E8F0', borderRadius:'5px', padding:'5px 6px', fontSize:'12px', fontFamily:'inherit', background:'#fff', outline:'none', textAlign:'center' }}/>
                            </td>
                            {/* Expiry date (auto, editable) */}
                            <td style={{ padding:'4px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9' }}>
                              <input type="date" value={r.expiry_date} onChange={e=>setR(idx,'expiry_date',e.target.value)}
                                style={{ border:'1px solid #E2E8F0', borderRadius:'5px', padding:'4px 5px', fontSize:'11px', fontFamily:'inherit', background:'#fff', outline:'none', cursor:'pointer', width:'100%', boxSizing:'border-box' }}/>
                            </td>
                            {/* Analysis params (1–6) */}
                            {ANA_PARAMS.map(p=>(
                              <td key={p.key} style={{ padding:'4px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9' }}>
                                <SmartCell paramKey={p.key} value={r[p.key]} onChange={v=>setR(idx,p.key,v)} options={options} onNewOption={saveOption}/>
                              </td>
                            ))}
                            {/* Votation (flexible dropdown) */}
                            <td style={{ padding:'4px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9' }}>
                              <VotationCell value={r.votation} onChange={v=>setR(idx,'votation',v)} options={options} onNewOption={saveOption}/>
                            </td>
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
                              {form.records.length>1 && (
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

                {/* Footer */}
                <div style={{ padding:'10px 14px', display:'flex', gap:'10px', alignItems:'center', background:'#F9FAFB', borderTop:'1px solid #F1F5F9', flexWrap:'wrap' }}>
                  <button onClick={()=>setForm(p=>({...p,records:[...p.records,emptyRecord()]}))}
                    style={{ padding:'7px 16px', border:'2px dashed #C4B5FD', borderRadius:'8px', background:'#FAFBFF', color:PM, fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>
                    + Add Product Row
                  </button>
                  <span style={{ fontSize:'11px', color:'#94A3B8' }}>Batch number and expiry auto-fill · LIMS analysis values available as suggestions</span>
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
                <div style={{ fontSize:'40px', marginBottom:'10px' }}>📦</div>
                <div style={{ fontWeight:'700', fontSize:'15px', color:'#374151' }}>No inspections recorded yet</div>
                <div style={{ fontSize:'12px', color:'#9CA3AF', marginTop:'4px' }}>Click "Add Inspection Entry" to begin</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                {entries.map(entry=>{
                  const records   = entry.fats_inspection_records||[];
                  const isEditing = editEntryId===entry.id;

                  return (
                    <div key={entry.id} style={{ background:'#fff', borderRadius:'12px', border:`2px solid ${isEditing?'#FED7AA':PL}`, overflow:'hidden', boxShadow:isEditing?'0 4px 12px rgba(217,119,6,0.15)':'0 1px 4px rgba(107,33,168,0.05)' }}>
                      {/* Entry header */}
                      <div style={{ background:isEditing?'#FFFBEB':'#F5F3FF', padding:'10px 16px', display:'flex', alignItems:'center', gap:'12px', borderBottom:`1px solid ${isEditing?'#FED7AA':PL}`, flexWrap:'wrap' }}>
                        <span style={{ fontWeight:'900', fontSize:'16px', color:P, fontFamily:'monospace' }}>🕐 {entry.inspection_time}</span>
                        <span style={{ fontSize:'12px', color:'#64748B', fontWeight:'600' }}>✍️ {entry.inspector_name||'—'}</span>
                        <span style={{ fontSize:'11px', color:'#94A3B8' }}>{records.length} product{records.length!==1?'s':''}</span>
                        {isEditing && <span style={{ background:'#FEF3C7', color:AM, padding:'2px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:'800', border:'1px solid #FCD34D' }}>✏️ Editing...</span>}
                        {!showForm && (
                          <button onClick={()=>openEdit(entry)}
                            style={{ marginLeft:'auto', padding:'5px 14px', background:'#FFF7ED', color:AM, border:'1px solid #FED7AA', borderRadius:'7px', fontSize:'11px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>
                            ✏️ Edit
                          </button>
                        )}
                      </div>

                      {/* Results table */}
                      <div className="thin-scroll" style={{ overflowX:'auto' }}>
                        <table style={{ borderCollapse:'collapse', width:'100%', fontSize:'12px' }}>
                          <thead>
                            <tr>
                              <TH w="110px">Brand</TH>
                              <TH w="85px" center>Pack Size</TH>
                              <TH w="78px" center>Pack Type</TH>
                              <TH w="100px" center>Batch No.</TH>
                              <TH w="82px" center>Target</TH>
                              <TH w="82px" center>Net Weight</TH>
                              <TH w="90px" center>Expiry Date</TH>
                              {ANA_PARAMS.map(p=><TH key={p.key} w="80px" center>{p.label}</TH>)}
                              <TH w="80px" center>Votation</TH>
                              <TH w="110px">Remarks</TH>
                              <TH w="100px">Action</TH>
                            </tr>
                          </thead>
                          <tbody>
                            {records.map((r,ri)=>{
                              const rowBg = ri%2===0?'#fff':'#FAFBFC';
                              return (
                                <tr key={r.id} style={{ background:rowBg }}>
                                  <td style={{ padding:'9px 10px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9', fontWeight:'700', color:'#0F172A', whiteSpace:'nowrap' }}>{r.brand_name}</td>
                                  <td style={{ padding:'9px 8px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9', textAlign:'center' }}>
                                    <span style={{ background:'#FFFBEB', color:AM, padding:'2px 7px', borderRadius:'5px', fontSize:'11px', fontWeight:'700', border:'1px solid #FED7AA', whiteSpace:'nowrap' }}>{r.pack_size}</span>
                                  </td>
                                  <td style={{ padding:'9px 8px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9', textAlign:'center', color:'#64748B', fontSize:'11px' }}>{r.pack_type||'—'}</td>
                                  <td style={{ padding:'9px 8px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9', textAlign:'center', fontFamily:'monospace', fontWeight:'700', color:P, fontSize:'11px' }}>{r.batch_number||'—'}</td>
                                  <td style={{ padding:'9px 8px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9', textAlign:'center', color:AM, fontWeight:'700', fontSize:'11px' }}>{r.target_weight||'—'}</td>
                                  <td style={{ padding:'9px 8px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9', textAlign:'center', fontWeight:'800', fontFamily:'monospace', fontSize:'13px', color:r.net_weight!=null?'#1E293B':'#CBD5E1' }}>
                                    {r.net_weight??'—'}
                                  </td>
                                  <td style={{ padding:'9px 8px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9', textAlign:'center', fontSize:'11px', color:'#64748B' }}>
                                    {r.expiry_date ? format(new Date(r.expiry_date),'dd/MM/yyyy') : '—'}
                                  </td>
                                  {ANA_PARAMS.map(p=>(
                                    <td key={p.key} style={{ padding:'9px 7px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9', textAlign:'center', color:r[p.key]?'#1E293B':'#CBD5E1', fontSize:'11px' }}>
                                      {r[p.key]||'—'}
                                    </td>
                                  ))}
                                  <td style={{ padding:'9px 7px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9', textAlign:'center' }}>
                                    {r.votation ? (
                                      <span style={{ background: r.votation==='Pass'?'#DCFCE7':r.votation==='Fail'?'#FEF2F2':'#F5F3FF', color: r.votation==='Pass'?GR:r.votation==='Fail'?RD:P, padding:'2px 8px', borderRadius:'6px', fontSize:'11px', fontWeight:'700' }}>
                                        {r.votation}
                                      </span>
                                    ) : <span style={{ color:'#CBD5E1' }}>—</span>}
                                  </td>
                                  <td style={{ padding:'9px 7px', borderBottom:'1px solid #F1F5F9', borderRight:'1px solid #F1F5F9', color:r.remarks?'#1E293B':'#CBD5E1', fontSize:'11px' }}>{r.remarks||'—'}</td>
                                  <td style={{ padding:'9px 7px', borderBottom:'1px solid #F1F5F9', color:r.action_taken?'#1E293B':'#CBD5E1', fontSize:'11px' }}>{r.action_taken||'—'}</td>
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
