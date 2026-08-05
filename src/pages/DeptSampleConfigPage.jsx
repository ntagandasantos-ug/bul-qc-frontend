// ============================================================
// FILE: src/pages/DeptSampleConfigPage.jsx
// QC Head admin — manage departments, categories, sample types
// and subtypes with duplicate prevention
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
const RD = '#DC2626';

const TABS = ['Departments','Categories','Sample Types','Subtypes'];

export default function DeptSampleConfigPage() {
  const navigate = useNavigate();

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const [tab,      setTab]      = useState(0);
  const [loading,  setLoading]  = useState(false);
  const [saving,   setSaving]   = useState(false);

  // Data
  const [depts,    setDepts]    = useState([]);
  const [cats,     setCats]     = useState([]);
  const [types,    setTypes]    = useState([]);
  const [subtypes, setSubtypes] = useState([]);

  // Forms
  const [newDept,    setNewDept]    = useState({ name:'', code:'' });
  const [newCat,     setNewCat]     = useState({ name:'', code:'', dept_id:'' });
  const [newType,    setNewType]    = useState({ name:'', code:'', cat_id:'', requires_subtype:false });
  const [newSubtype, setNewSubtype] = useState({ name:'', code:'', cat_id:'' });

  // Edit state
  const [editId,   setEditId]   = useState(null);
  const [editForm, setEditForm] = useState({});

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [d, c, t, s] = await Promise.all([
        supabase.from('departments').select('id, name, code').order('name'),
        supabase.from('sample_categories').select('id, name, code, department_id, departments(name)').order('name'),
        supabase.from('sample_types').select('id, name, code, category_id, requires_subtype, sample_categories(name, departments(name))').order('name'),
        supabase.from('sample_subtypes').select('id, name, code, category_id, sample_categories(name)').order('name'),
      ]);
      setDepts(d.data || []);
      setCats(c.data || []);
      setTypes(t.data || []);
      setSubtypes(s.data || []);
    } catch(e) { toast.error('Failed to load config data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const checkDuplicate = (list, nameField, value, excludeId=null) =>
    list.some(item => item[nameField]?.toLowerCase().trim() === value?.toLowerCase().trim() && item.id !== excludeId);

  // ── Departments ──────────────────────────────────────────
  const addDept = async () => {
    if (!newDept.name.trim()) { toast.warning('Name is required'); return; }
    if (!newDept.code.trim()) { toast.warning('Code is required'); return; }
    if (checkDuplicate(depts, 'name', newDept.name)) { toast.warning('Department name already exists'); return; }
    if (checkDuplicate(depts, 'code', newDept.code)) { toast.warning('Department code already exists'); return; }
    setSaving(true);
    try {
      await supabase.from('departments').insert({ name:newDept.name.trim(), code:newDept.code.trim().toUpperCase() });
      toast.success('✅ Department added');
      setNewDept({ name:'', code:'' });
      loadAll();
    } catch(e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  // ── Categories ───────────────────────────────────────────
  const addCat = async () => {
    if (!newCat.name.trim()) { toast.warning('Name is required'); return; }
    if (!newCat.code.trim()) { toast.warning('Code is required'); return; }
    if (!newCat.dept_id)     { toast.warning('Select a department'); return; }
    if (checkDuplicate(cats, 'name', newCat.name)) { toast.warning('Category name already exists'); return; }
    setSaving(true);
    try {
      await supabase.from('sample_categories').insert({
        name: newCat.name.trim(), code: newCat.code.trim().toUpperCase(),
        department_id: newCat.dept_id,
      });
      toast.success('✅ Category added');
      setNewCat({ name:'', code:'', dept_id:'' });
      loadAll();
    } catch(e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  // ── Sample Types ─────────────────────────────────────────
  const addType = async () => {
    if (!newType.name.trim()) { toast.warning('Name is required'); return; }
    if (!newType.code.trim()) { toast.warning('Code is required'); return; }
    if (!newType.cat_id)      { toast.warning('Select a category'); return; }
    if (checkDuplicate(types, 'name', newType.name)) { toast.warning('Sample type name already exists'); return; }
    if (checkDuplicate(types, 'code', newType.code)) { toast.warning('Sample type code already exists'); return; }
    setSaving(true);
    try {
      await supabase.from('sample_types').insert({
        name: newType.name.trim(), code: newType.code.trim().toUpperCase(),
        category_id: newType.cat_id, requires_subtype: newType.requires_subtype,
      });
      toast.success('✅ Sample type added');
      setNewType({ name:'', code:'', cat_id:'', requires_subtype:false });
      loadAll();
    } catch(e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  // ── Subtypes ─────────────────────────────────────────────
  const addSubtype = async () => {
    if (!newSubtype.name.trim()) { toast.warning('Name is required'); return; }
    if (!newSubtype.code.trim()) { toast.warning('Code is required'); return; }
    if (!newSubtype.cat_id)      { toast.warning('Select a category'); return; }
    if (checkDuplicate(subtypes, 'name', newSubtype.name)) { toast.warning('Subtype name already exists'); return; }
    setSaving(true);
    try {
      await supabase.from('sample_subtypes').insert({
        name: newSubtype.name.trim(), code: newSubtype.code.trim().toUpperCase(),
        category_id: newSubtype.cat_id,
      });
      toast.success('✅ Subtype added');
      setNewSubtype({ name:'', code:'', cat_id:'' });
      loadAll();
    } catch(e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  // ── Inline edit helpers ──────────────────────────────────
  const startEdit = (item) => { setEditId(item.id); setEditForm({ name:item.name, code:item.code }); };
  const cancelEdit = () => { setEditId(null); setEditForm({}); };

  const saveEdit = async (table, id, list, nameField, codeField) => {
    if (!editForm.name?.trim()) { toast.warning('Name required'); return; }
    if (checkDuplicate(list, nameField||'name', editForm.name, id)) { toast.warning('Name already exists'); return; }
    setSaving(true);
    try {
      const payload = { name: editForm.name.trim() };
      if (codeField && editForm.code) payload.code = editForm.code.trim().toUpperCase();
      await supabase.from(table).update(payload).eq('id', id);
      toast.success('✅ Updated');
      cancelEdit();
      loadAll();
    } catch(e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const inp = {
    border:`1.5px solid ${PL}`, borderRadius:'8px', padding:'8px 11px',
    fontSize:'13px', fontFamily:'inherit', background:'#fff',
    color:'#111827', outline:'none', boxSizing:'border-box',
  };
  const lbl = { display:'block', fontSize:'11px', fontWeight:'700', color:'#4C1D95', marginBottom:'4px' };

  const AddForm = ({ children, onAdd, saving: sv }) => (
    <div style={{ background:'#F5F3FF', borderRadius:'12px', border:`1.5px solid ${PL}`,
      padding:'14px', marginBottom:'16px' }}>
      <div style={{ fontSize:'12px', fontWeight:'800', color:P, marginBottom:'12px' }}>➕ Add New</div>
      <div style={{ display:'grid', gridTemplateColumns: isMobile?'1fr':'repeat(auto-fit,minmax(180px,1fr))', gap:'10px' }}>
        {children}
      </div>
      <button onClick={onAdd} disabled={sv}
        style={{ marginTop:'12px', padding:'9px 20px', background:`linear-gradient(135deg,${P},${PM})`,
          color:'#fff', border:'none', borderRadius:'9px', fontSize:'13px',
          fontWeight:'700', cursor:sv?'not-allowed':'pointer', fontFamily:'inherit' }}>
        {sv ? 'Saving...' : '✅ Add'}
      </button>
    </div>
  );

  const ItemRow = ({ item, onEdit, table, list, nameField, codeField, extra }) => {
    const isEd = editId === item.id;
    return (
      <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px',
        background:'#fff', borderRadius:'10px', border:`1px solid ${PL}`, marginBottom:'6px' }}>
        {isEd ? (
          <>
            <input value={editForm.name} onChange={e=>setEditForm(p=>({...p,name:e.target.value}))}
              style={{ ...inp, flex:1 }} placeholder="Name"/>
            {codeField && (
              <input value={editForm.code} onChange={e=>setEditForm(p=>({...p,code:e.target.value}))}
                style={{ ...inp, width:'120px' }} placeholder="Code"/>
            )}
            <button onClick={()=>saveEdit(table, item.id, list, nameField, codeField)}
              disabled={saving}
              style={{ padding:'6px 12px', background:GR, color:'#fff', border:'none',
                borderRadius:'7px', fontSize:'11px', fontWeight:'700', cursor:'pointer' }}>
              ✅
            </button>
            <button onClick={cancelEdit}
              style={{ padding:'6px 10px', background:'#F1F5F9', color:'#64748B', border:'none',
                borderRadius:'7px', fontSize:'11px', cursor:'pointer' }}>
              ✕
            </button>
          </>
        ) : (
          <>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:'700', fontSize:'13px', color:'#0F172A' }}>{item.name}</div>
              <div style={{ fontSize:'10.5px', color:'#94A3B8', marginTop:'1px' }}>
                {item.code && <span style={{ fontFamily:'monospace', color:PM }}>{item.code}</span>}
                {extra && <span style={{ marginLeft:'6px' }}>{extra}</span>}
              </div>
            </div>
            <button onClick={()=>startEdit(item)}
              style={{ padding:'5px 10px', background:PL, color:P, border:'none',
                borderRadius:'7px', fontSize:'11px', fontWeight:'700', cursor:'pointer' }}>
              ✏️ Edit
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <div style={{ minHeight:'100vh', background:'#F8FAFC', paddingBottom: isMobile?'90px':'60px' }}>
      <Navbar />
      <div style={{ maxWidth:'1000px', margin:'0 auto', padding: isMobile?'12px':'20px' }}>

        <div style={{ marginBottom:'16px' }}>
          <button onClick={()=>navigate(-1)}
            style={{ background:'none', border:'none', color:PM, fontSize:'12px',
              fontWeight:'700', cursor:'pointer', marginBottom:'4px', padding:0 }}>
            ← Back
          </button>
          <h1 style={{ fontSize: isMobile?'18px':'22px', fontWeight:'900', color:'#0F172A', margin:0 }}>
            🏗️ Department & Sample Config
          </h1>
          <p style={{ fontSize:'12px', color:'#94A3B8', margin:'2px 0 0' }}>
            Manage departments, categories, sample types and subtypes
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:'4px', background:'#fff', borderRadius:'12px',
          border:`1.5px solid ${PL}`, padding:'4px', marginBottom:'16px', overflowX:'auto' }}>
          {TABS.map((t,i) => (
            <button key={t} onClick={()=>setTab(i)}
              style={{ flex:1, padding:'8px 12px', borderRadius:'9px', border:'none',
                background: tab===i?`linear-gradient(135deg,${P},${PM})`:'transparent',
                color: tab===i?'#fff':'#6B7280', fontSize: isMobile?'11px':'12px',
                fontWeight:'700', cursor:'pointer', whiteSpace:'nowrap',
                minWidth: isMobile?'80px':'auto' }}>
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'40px', color:'#94A3B8' }}>Loading...</div>
        ) : (
          <>
            {/* ── Departments ── */}
            {tab===0 && (
              <>
                <AddForm onAdd={addDept} saving={saving}>
                  <div>
                    <label style={lbl}>Department Name *</label>
                    <input value={newDept.name} onChange={e=>setNewDept(p=>({...p,name:e.target.value}))}
                      placeholder="e.g. Detergent" style={inp}/>
                  </div>
                  <div>
                    <label style={lbl}>Code *</label>
                    <input value={newDept.code} onChange={e=>setNewDept(p=>({...p,code:e.target.value.toUpperCase()}))}
                      placeholder="e.g. DET" style={inp}/>
                  </div>
                </AddForm>
                <div style={{ fontWeight:'700', fontSize:'13px', color:'#475569', marginBottom:'8px' }}>
                  {depts.length} departments
                </div>
                {depts.map(d => (
                  <ItemRow key={d.id} item={d} table="departments"
                    list={depts} nameField="name" codeField="code"/>
                ))}
              </>
            )}

            {/* ── Categories ── */}
            {tab===1 && (
              <>
                <AddForm onAdd={addCat} saving={saving}>
                  <div>
                    <label style={lbl}>Category Name *</label>
                    <input value={newCat.name} onChange={e=>setNewCat(p=>({...p,name:e.target.value}))}
                      placeholder="e.g. In-process" style={inp}/>
                  </div>
                  <div>
                    <label style={lbl}>Code *</label>
                    <input value={newCat.code} onChange={e=>setNewCat(p=>({...p,code:e.target.value.toUpperCase()}))}
                      placeholder="e.g. DET_IP" style={inp}/>
                  </div>
                  <div>
                    <label style={lbl}>Department *</label>
                    <select value={newCat.dept_id} onChange={e=>setNewCat(p=>({...p,dept_id:e.target.value}))}
                      style={{ ...inp, cursor:'pointer' }}>
                      <option value="">— Select —</option>
                      {depts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </AddForm>
                <div style={{ fontWeight:'700', fontSize:'13px', color:'#475569', marginBottom:'8px' }}>
                  {cats.length} categories
                </div>
                {cats.map(c => (
                  <ItemRow key={c.id} item={c} table="sample_categories"
                    list={cats} nameField="name" codeField="code"
                    extra={`· ${c.departments?.name || ''}`}/>
                ))}
              </>
            )}

            {/* ── Sample Types ── */}
            {tab===2 && (
              <>
                <AddForm onAdd={addType} saving={saving}>
                  <div>
                    <label style={lbl}>Sample Type Name *</label>
                    <input value={newType.name} onChange={e=>setNewType(p=>({...p,name:e.target.value}))}
                      placeholder="e.g. Base Powder" style={inp}/>
                  </div>
                  <div>
                    <label style={lbl}>Code *</label>
                    <input value={newType.code} onChange={e=>setNewType(p=>({...p,code:e.target.value.toUpperCase()}))}
                      placeholder="e.g. BP" style={inp}/>
                  </div>
                  <div>
                    <label style={lbl}>Category *</label>
                    <select value={newType.cat_id} onChange={e=>setNewType(p=>({...p,cat_id:e.target.value}))}
                      style={{ ...inp, cursor:'pointer' }}>
                      <option value="">— Select —</option>
                      {cats.map(c=><option key={c.id} value={c.id}>{c.name} ({c.departments?.name})</option>)}
                    </select>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', paddingTop:'20px' }}>
                    <input type="checkbox" checked={newType.requires_subtype}
                      onChange={e=>setNewType(p=>({...p,requires_subtype:e.target.checked}))}
                      style={{ width:'16px', height:'16px', accentColor:PM }}/>
                    <label style={{ fontSize:'12px', fontWeight:'600', color:'#374151' }}>
                      Requires form/subtype
                    </label>
                  </div>
                </AddForm>
                <div style={{ fontWeight:'700', fontSize:'13px', color:'#475569', marginBottom:'8px' }}>
                  {types.length} sample types
                </div>
                {types.map(t => (
                  <div key={t.id} style={{ display:'flex', alignItems:'center', gap:'10px',
                    padding:'10px 14px', background:'#fff', borderRadius:'10px',
                    border:`1px solid ${PL}`, marginBottom:'6px' }}>
                    {editId===t.id ? (
                      <>
                        <input value={editForm.name} onChange={e=>setEditForm(p=>({...p,name:e.target.value}))}
                          style={{ ...inp, flex:1 }} placeholder="Name"/>
                        <input value={editForm.code} onChange={e=>setEditForm(p=>({...p,code:e.target.value}))}
                          style={{ ...inp, width:'120px' }} placeholder="Code"/>
                        <button onClick={()=>saveEdit('sample_types',t.id,types,'name','code')}
                          style={{ padding:'6px 12px', background:GR, color:'#fff', border:'none',
                            borderRadius:'7px', fontSize:'11px', fontWeight:'700', cursor:'pointer' }}>✅</button>
                        <button onClick={cancelEdit}
                          style={{ padding:'6px 10px', background:'#F1F5F9', color:'#64748B', border:'none',
                            borderRadius:'7px', fontSize:'11px', cursor:'pointer' }}>✕</button>
                      </>
                    ) : (
                      <>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                            <span style={{ fontWeight:'700', fontSize:'13px', color:'#0F172A' }}>{t.name}</span>
                            {t.requires_subtype && (
                              <span style={{ background:'#EDE9FE', color:P, fontSize:'10px',
                                fontWeight:'700', padding:'1px 7px', borderRadius:'5px' }}>
                                Needs Subtype
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize:'10.5px', color:'#94A3B8', marginTop:'1px' }}>
                            <span style={{ fontFamily:'monospace', color:PM }}>{t.code}</span>
                            {t.sample_categories?.name && ` · ${t.sample_categories.name}`}
                            {t.sample_categories?.departments?.name && ` · ${t.sample_categories.departments.name}`}
                          </div>
                        </div>
                        <button onClick={()=>startEdit(t)}
                          style={{ padding:'5px 10px', background:PL, color:P, border:'none',
                            borderRadius:'7px', fontSize:'11px', fontWeight:'700', cursor:'pointer' }}>
                          ✏️ Edit
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </>
            )}

            {/* ── Subtypes ── */}
            {tab===3 && (
              <>
                <AddForm onAdd={addSubtype} saving={saving}>
                  <div>
                    <label style={lbl}>Subtype Name *</label>
                    <input value={newSubtype.name} onChange={e=>setNewSubtype(p=>({...p,name:e.target.value}))}
                      placeholder="e.g. HBD" style={inp}/>
                  </div>
                  <div>
                    <label style={lbl}>Code *</label>
                    <input value={newSubtype.code} onChange={e=>setNewSubtype(p=>({...p,code:e.target.value.toUpperCase()}))}
                      placeholder="e.g. HBD" style={inp}/>
                  </div>
                  <div>
                    <label style={lbl}>Category *</label>
                    <select value={newSubtype.cat_id} onChange={e=>setNewSubtype(p=>({...p,cat_id:e.target.value}))}
                      style={{ ...inp, cursor:'pointer' }}>
                      <option value="">— Select —</option>
                      {cats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </AddForm>
                <div style={{ fontWeight:'700', fontSize:'13px', color:'#475569', marginBottom:'8px' }}>
                  {subtypes.length} subtypes
                </div>
                {subtypes.map(s => (
                  <ItemRow key={s.id} item={s} table="sample_subtypes"
                    list={subtypes} nameField="name" codeField="code"
                    extra={`· ${s.sample_categories?.name || ''}`}/>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
