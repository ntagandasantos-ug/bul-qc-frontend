// ============================================================
// FILE: src/pages/TestSpecificationsPage.jsx
// QC Head admin — view and update min/max specs for all tests
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { supabase } from '../services/supabase';
import { toast } from 'react-toastify';

const P  = '#6B21A8';
const PM = '#7C3AED';
const PL = '#EDE9FE';
const GR = '#16A34A';
const AM = '#D97706';

export default function TestSpecificationsPage() {
  const navigate = useNavigate();

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const [tests,       setTests]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [typeFilter,  setTypeFilter]  = useState('');
  const [sampleTypes, setSampleTypes] = useState([]);
  const [editing,     setEditing]     = useState({});
  const [saving,      setSaving]      = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('tests')
        .select(`
          id, name, code, unit, result_type, display_order,
          sample_types(id, name, code, sample_categories(name, departments(name))),
          test_specifications(id, min_value, max_value, display_spec)
        `)
        .order('display_order');
      setTests(data || []);
      const { data: types } = await supabase.from('sample_types').select('id, name').order('name');
      setSampleTypes(types || []);
    } catch(e) { toast.error('Failed to load tests'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEdit = (spec, test) => {
    setEditing(p => ({
      ...p,
      [spec?.id || `new_${test.id}`]: {
        test_id: test.id, spec_id: spec?.id || null,
        min: spec?.min_value ?? '', max: spec?.max_value ?? '',
        display: spec?.display_spec || '', result_type: test.result_type,
      },
    }));
  };

  const cancelEdit = (key) => setEditing(p => { const n={...p}; delete n[key]; return n; });

  const buildDisplay = (min, max) => {
    if (min !== '' && max !== '') return `${min}-${max}`;
    if (min !== '' && max === '') return `>=${min}`;
    if (min === '' && max !== '') return `<=${max}`;
    return '';
  };

  const saveSpec = async (key) => {
    const e = editing[key];
    if (!e) return;
    setSaving(p => ({...p, [key]:true}));
    try {
      const payload = {
        test_id     : e.test_id,
        min_value   : e.min !== '' ? parseFloat(e.min) : null,
        max_value   : e.max !== '' ? parseFloat(e.max) : null,
        display_spec: e.display || buildDisplay(e.min, e.max),
      };
      if (e.spec_id) {
        await supabase.from('test_specifications').update(payload).eq('id', e.spec_id);
      } else {
        await supabase.from('test_specifications').insert({ ...payload });
      }
      toast.success('✅ Specification updated');
      cancelEdit(key);
      load();
    } catch(err) { toast.error(err.message); }
    finally { setSaving(p => ({...p, [key]:false})); }
  };

  const grouped = {};
  for (const t of tests) {
    const dept = t.sample_types?.sample_categories?.departments?.name || 'Other';
    const cat  = t.sample_types?.sample_categories?.name || 'Other';
    const type = t.sample_types?.name || 'Unknown';
    const key  = `${dept}__${cat}__${type}`;
    if (!grouped[key]) grouped[key] = { dept, cat, type, typeId: t.sample_types?.id, tests:[] };
    grouped[key].tests.push(t);
  }

  const filtered = Object.values(grouped).filter(g => {
    const matchType   = !typeFilter || g.typeId === typeFilter;
    const matchSearch = !search || g.tests.some(t =>
      t.name?.toLowerCase().includes(search.toLowerCase()) ||
      t.code?.toLowerCase().includes(search.toLowerCase())
    );
    return matchType && matchSearch;
  });

  const inp = { border:`1.5px solid ${PL}`, borderRadius:'7px', padding:'6px 9px', fontSize:'12px', fontFamily:'inherit', background:'#fff', color:'#111827', outline:'none', boxSizing:'border-box' };

  return (
    <div style={{ minHeight:'100vh', background:'#F8FAFC', paddingBottom:isMobile?'90px':'60px' }}>
      <Navbar />
      <div style={{ maxWidth:'1100px', margin:'0 auto', padding:isMobile?'12px':'20px' }}>

        <div style={{ marginBottom:'16px' }}>
          <button onClick={()=>navigate(-1)} style={{ background:'none', border:'none', color:PM, fontSize:'12px', fontWeight:'700', cursor:'pointer', marginBottom:'4px', padding:0 }}>← Back</button>
          <h1 style={{ fontSize:isMobile?'18px':'22px', fontWeight:'900', color:'#0F172A', margin:0 }}>🔬 Test Specifications</h1>
          <p style={{ fontSize:'12px', color:'#94A3B8', margin:'2px 0 0' }}>Update min/max ranges for any test across all sample types</p>
        </div>

        <div style={{ background:'#fff', borderRadius:'12px', border:`1.5px solid ${PL}`, padding:'12px 14px', marginBottom:'14px', display:'flex', gap:'10px', flexWrap:'wrap' }}>
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search test name or code..." style={{ ...inp, flex:2, minWidth:'200px', padding:'9px 12px' }}/>
          <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} style={{ ...inp, flex:1, minWidth:'180px', padding:'9px 12px', cursor:'pointer' }}>
            <option value="">All Sample Types</option>
            {sampleTypes.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {(search||typeFilter) && (
            <button onClick={()=>{ setSearch(''); setTypeFilter(''); }} style={{ padding:'9px 14px', border:`1px solid ${PL}`, borderRadius:'8px', background:'#F5F3FF', color:P, fontSize:'12px', fontWeight:'600', cursor:'pointer' }}>✕ Clear</button>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'60px', color:'#94A3B8' }}>Loading tests...</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
            {filtered.map(g => (
              <div key={`${g.dept}_${g.type}`} style={{ background:'#fff', borderRadius:'14px', border:`1.5px solid ${PL}`, overflow:'hidden' }}>
                <div style={{ background:`linear-gradient(135deg,${P},${PM})`, padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div>
                    <div style={{ color:'#fff', fontWeight:'800', fontSize:'14px' }}>{g.type}</div>
                    <div style={{ color:'#DDD6FE', fontSize:'11px' }}>{g.dept} · {g.cat}</div>
                  </div>
                  <span style={{ background:'rgba(255,255,255,0.2)', color:'#fff', fontSize:'11px', fontWeight:'700', padding:'3px 10px', borderRadius:'20px' }}>{g.tests.length} tests</span>
                </div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
                    <thead>
                      <tr style={{ background:'#F8FAFC' }}>
                        {['Test Name','Code','Unit','Type','Min','Max','Display Spec',''].map(h=>(
                          <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:'11px', fontWeight:'700', color:'#64748B', borderBottom:'1px solid #E2E8F0', whiteSpace:'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {g.tests
                        .filter(t => !search || t.name?.toLowerCase().includes(search.toLowerCase()) || t.code?.toLowerCase().includes(search.toLowerCase()))
                        .map((t,i) => {
                          const spec    = t.test_specifications?.[0];
                          const editKey = spec?.id || `new_${t.id}`;
                          const isEditing = !!editing[editKey];
                          const e = editing[editKey];
                          const even = i%2===0;
                          return (
                            <tr key={t.id} style={{ background:even?'#fff':'#FAFBFC' }}>
                              <td style={{ padding:'9px 12px', borderBottom:'1px solid #F1F5F9', fontWeight:'700', color:'#0F172A' }}>{t.name}</td>
                              <td style={{ padding:'9px 12px', borderBottom:'1px solid #F1F5F9' }}><span style={{ fontFamily:'monospace', fontSize:'11px', color:PM }}>{t.code}</span></td>
                              <td style={{ padding:'9px 12px', borderBottom:'1px solid #F1F5F9', color:'#64748B' }}>{t.unit||'—'}</td>
                              <td style={{ padding:'9px 12px', borderBottom:'1px solid #F1F5F9' }}>
                                <span style={{ background:t.result_type==='text'?'#EFF6FF':'#F0FDF4', color:t.result_type==='text'?'#1D4ED8':GR, fontSize:'10px', fontWeight:'700', padding:'2px 7px', borderRadius:'5px' }}>{t.result_type}</span>
                              </td>
                              {isEditing ? (
                                <>
                                  <td style={{ padding:'6px 8px', borderBottom:'1px solid #F1F5F9' }}><input type="number" value={e.min} onChange={ev=>setEditing(p=>({...p,[editKey]:{...p[editKey],min:ev.target.value}}))} placeholder="min" style={{ ...inp, width:'80px' }}/></td>
                                  <td style={{ padding:'6px 8px', borderBottom:'1px solid #F1F5F9' }}><input type="number" value={e.max} onChange={ev=>setEditing(p=>({...p,[editKey]:{...p[editKey],max:ev.target.value}}))} placeholder="max" style={{ ...inp, width:'80px' }}/></td>
                                  <td style={{ padding:'6px 8px', borderBottom:'1px solid #F1F5F9' }}><input type="text" value={e.display} onChange={ev=>setEditing(p=>({...p,[editKey]:{...p[editKey],display:ev.target.value}}))} placeholder={buildDisplay(e.min,e.max)||'e.g. 10-12'} style={{ ...inp, width:'100px' }}/></td>
                                  <td style={{ padding:'6px 8px', borderBottom:'1px solid #F1F5F9' }}>
                                    <div style={{ display:'flex', gap:'4px' }}>
                                      <button onClick={()=>saveSpec(editKey)} disabled={saving[editKey]} style={{ padding:'5px 10px', background:`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'6px', fontSize:'11px', fontWeight:'700', cursor:'pointer' }}>{saving[editKey]?'...':'✅'}</button>
                                      <button onClick={()=>cancelEdit(editKey)} style={{ padding:'5px 8px', background:'#F1F5F9', color:'#64748B', border:'none', borderRadius:'6px', fontSize:'11px', cursor:'pointer' }}>✕</button>
                                    </div>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td style={{ padding:'9px 12px', borderBottom:'1px solid #F1F5F9', color:spec?.min_value!=null?'#374151':'#CBD5E1' }}>{spec?.min_value??'—'}</td>
                                  <td style={{ padding:'9px 12px', borderBottom:'1px solid #F1F5F9', color:spec?.max_value!=null?'#374151':'#CBD5E1' }}>{spec?.max_value??'—'}</td>
                                  <td style={{ padding:'9px 12px', borderBottom:'1px solid #F1F5F9' }}>
                                    {spec?.display_spec
                                      ? <span style={{ background:'#FFFBEB', color:AM, fontWeight:'700', fontSize:'11px', padding:'2px 8px', borderRadius:'5px' }}>{spec.display_spec}</span>
                                      : <span style={{ color:'#CBD5E1', fontSize:'11px' }}>No spec</span>}
                                  </td>
                                  <td style={{ padding:'9px 12px', borderBottom:'1px solid #F1F5F9' }}>
                                    <button onClick={()=>startEdit(spec, t)} style={{ padding:'4px 10px', background:PL, color:P, border:'none', borderRadius:'6px', fontSize:'11px', fontWeight:'700', cursor:'pointer' }}>✏️ Edit</button>
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            {filtered.length===0 && <div style={{ textAlign:'center', padding:'60px', background:'#fff', borderRadius:'14px', border:`1.5px solid ${PL}`, color:'#94A3B8' }}>No tests match your search</div>}
          </div>
        )}
      </div>
    </div>
  );
}
