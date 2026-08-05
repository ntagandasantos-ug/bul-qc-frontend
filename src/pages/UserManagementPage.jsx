// ============================================================
// FILE: src/pages/UserManagementPage.jsx
// QC Head admin — manage all system users
// Add · Edit · Deactivate · Reset Password · Manage Roles
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { supabase } from '../services/supabase';
import { toast } from 'react-toastify';
import { format } from 'date-fns';

const P  = '#6B21A8';
const PM = '#7C3AED';
const PL = '#EDE9FE';
const GR = '#16A34A';
const RD = '#DC2626';

const ROLES = ['QC Head','QC Assistant','Shift Supervisor','Analyst','Sampler','Department Head','Department Assistant'];

const ROLE_COLORS = {
  'QC Head'              : { bg:'#F3E8FF', color:'#6B21A8' },
  'QC Assistant'         : { bg:'#EDE9FE', color:'#7C3AED' },
  'Shift Supervisor'     : { bg:'#DBEAFE', color:'#1D4ED8' },
  'Analyst'              : { bg:'#DCFCE7', color:'#15803D' },
  'Sampler'              : { bg:'#FEF9C3', color:'#854D0E' },
  'Department Head'      : { bg:'#FFEDD5', color:'#C2410C' },
  'Department Assistant' : { bg:'#FEE2E2', color:'#B91C1C' },
};

export default function UserManagementPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const [users,       setUsers]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [roleFilter,  setRoleFilter]  = useState('');
  const [showModal,   setShowModal]   = useState(false);
  const [editUser,    setEditUser]    = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [departments, setDepts]       = useState([]);
  const [roles,       setRoles]       = useState([]);
  const [showPwReset, setShowPwReset] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  const [form, setForm] = useState({ full_name:'', username:'', email:'', role_id:'', department_id:'', is_active:true, password:'' });
  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('app_users')
        .select('id, full_name, username, email, is_active, created_at, roles(id, name), departments(id, name)')
        .order('full_name');
      setUsers(data || []);
    } catch(e) { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    supabase.from('roles').select('id, name').then(({ data }) => setRoles(data || []));
    supabase.from('departments').select('id, name').order('name').then(({ data }) => setDepts(data || []));
  }, []);

  const openAdd = () => {
    setEditUser(null);
    setForm({ full_name:'', username:'', email:'', role_id:'', department_id:'', is_active:true, password:'' });
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditUser(u);
    setForm({ full_name:u.full_name||'', username:u.username||'', email:u.email||'', role_id:u.roles?.id||'', department_id:u.departments?.id||'', is_active:u.is_active, password:'' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) { toast.warning('Full name is required'); return; }
    if (!form.username.trim())  { toast.warning('Username is required'); return; }
    if (!editUser && !form.password.trim()) { toast.warning('Password is required for new users'); return; }
    if (!editUser && form.password.length < 8) { toast.warning('Password must be at least 8 characters'); return; }
    setSaving(true);
    try {
      if (editUser) {
        await api.put(`/auth/users/${editUser.id}`, { full_name:form.full_name.trim(), username:form.username.trim().toLowerCase(), email:form.email.trim(), role_id:form.role_id||undefined, department_id:form.department_id||undefined, is_active:form.is_active });
        toast.success('✅ User updated');
      } else {
        await api.post('/auth/users', { full_name:form.full_name.trim(), username:form.username.trim().toLowerCase(), email:form.email.trim(), password:form.password, role_id:form.role_id||undefined, department_id:form.department_id||undefined });
        toast.success('✅ User created');
      }
      setShowModal(false);
      load();
    } catch(e) { toast.error(e.response?.data?.error || e.message); }
    finally { setSaving(false); }
  };

  const toggleActive = async (u) => {
    if (!window.confirm(`${u.is_active?'Deactivate':'Reactivate'} ${u.full_name}?`)) return;
    try {
      await api.put(`/auth/users/${u.id}`, { is_active: !u.is_active });
      toast.success(`${u.is_active?'Deactivated':'Reactivated'}: ${u.full_name}`);
      load();
    } catch(e) { toast.error(e.response?.data?.error || e.message); }
  };

  const handlePasswordReset = async () => {
    if (!newPassword || newPassword.length < 8) { toast.warning('Password must be at least 8 characters'); return; }
    setSaving(true);
    try {
      await api.put(`/auth/users/${showPwReset.id}/reset-password`, { new_password: newPassword });
      toast.success(`✅ Password reset for ${showPwReset.full_name}`);
      setShowPwReset(null); setNewPassword('');
    } catch(e) { toast.error(e.response?.data?.error || e.message); }
    finally { setSaving(false); }
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return (!search || u.full_name?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
      && (!roleFilter || u.roles?.name === roleFilter);
  });

  const inp = { border:`1.5px solid ${PL}`, borderRadius:'9px', padding:'9px 12px', fontSize:'13px', fontFamily:'inherit', background:'#fff', color:'#111827', outline:'none', width:'100%', boxSizing:'border-box' };
  const lbl = { display:'block', fontSize:'11px', fontWeight:'700', color:'#4C1D95', marginBottom:'5px' };

  return (
    <div style={{ minHeight:'100vh', background:'#F8FAFC', paddingBottom:isMobile?'90px':'60px' }}>
      <Navbar />
      <div style={{ maxWidth:'1100px', margin:'0 auto', padding:isMobile?'12px':'20px' }}>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px', marginBottom:'16px' }}>
          <div>
            <button onClick={()=>navigate(-1)} style={{ background:'none', border:'none', color:PM, fontSize:'12px', fontWeight:'700', cursor:'pointer', marginBottom:'4px', padding:0 }}>← Back</button>
            <h1 style={{ fontSize:isMobile?'18px':'22px', fontWeight:'900', color:'#0F172A', margin:0 }}>👥 User Management</h1>
            <p style={{ fontSize:'12px', color:'#94A3B8', margin:'2px 0 0' }}>{users.length} users · {users.filter(u=>u.is_active).length} active</p>
          </div>
          <button onClick={openAdd} style={{ padding:'10px 18px', background:`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'10px', fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>+ Add New User</button>
        </div>

        <div style={{ background:'#fff', borderRadius:'12px', border:`1.5px solid ${PL}`, padding:'12px 14px', marginBottom:'12px', display:'flex', gap:'10px', flexWrap:'wrap' }}>
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search by name, username or email..." style={{ ...inp, flex:2, minWidth:'200px' }}/>
          <select value={roleFilter} onChange={e=>setRoleFilter(e.target.value)} style={{ ...inp, flex:1, minWidth:'160px', cursor:'pointer' }}>
            <option value="">All Roles</option>
            {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
          </select>
          {(search||roleFilter) && <button onClick={()=>{ setSearch(''); setRoleFilter(''); }} style={{ padding:'9px 14px', border:`1px solid ${PL}`, borderRadius:'8px', background:'#F5F3FF', color:P, fontSize:'12px', fontWeight:'600', cursor:'pointer' }}>✕ Clear</button>}
        </div>

        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'12px' }}>
          {ROLES.map(r => {
            const count = users.filter(u=>u.roles?.name===r).length;
            if (!count) return null;
            const cfg = ROLE_COLORS[r] || { bg:'#F1F5F9', color:'#475569' };
            return (
              <button key={r} onClick={()=>setRoleFilter(roleFilter===r?'':r)}
                style={{ padding:'4px 10px', borderRadius:'20px', border:`1.5px solid ${cfg.color}33`, background:roleFilter===r?cfg.color:cfg.bg, color:roleFilter===r?'#fff':cfg.color, fontSize:'11px', fontWeight:'700', cursor:'pointer' }}>
                {r} ({count})
              </button>
            );
          })}
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'60px', color:'#94A3B8' }}>Loading users...</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {filtered.map(u => {
              const roleCfg = ROLE_COLORS[u.roles?.name] || { bg:'#F1F5F9', color:'#475569' };
              return (
                <div key={u.id} style={{ background:'#fff', borderRadius:'12px', border:`1.5px solid ${u.is_active?PL:'#E2E8F0'}`, padding:'12px 16px', display:'flex', alignItems:'center', gap:'12px', opacity:u.is_active?1:0.6 }}>
                  <div style={{ width:'38px', height:'38px', borderRadius:'50%', flexShrink:0, background:`linear-gradient(135deg,${P},${PM})`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:'14px', fontWeight:'800' }}>
                    {u.full_name?.[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'7px', flexWrap:'wrap' }}>
                      <span style={{ fontWeight:'800', fontSize:'13px', color:'#0F172A' }}>{u.full_name}</span>
                      <span style={{ background:roleCfg.bg, color:roleCfg.color, fontSize:'10px', fontWeight:'700', padding:'2px 7px', borderRadius:'6px' }}>{u.roles?.name||'No Role'}</span>
                      {!u.is_active && <span style={{ background:'#FEE2E2', color:RD, fontSize:'10px', fontWeight:'700', padding:'2px 7px', borderRadius:'6px' }}>Deactivated</span>}
                    </div>
                    <div style={{ fontSize:'11px', color:'#64748B', marginTop:'2px' }}>@{u.username}{u.departments?.name?` · ${u.departments.name}`:''}{u.email?` · ${u.email}`:''}</div>
                  </div>
                  <div style={{ display:'flex', gap:'5px', flexShrink:0, flexWrap:isMobile?'wrap':'nowrap' }}>
                    <button onClick={()=>openEdit(u)} style={{ padding:'5px 10px', background:PL, color:P, border:'none', borderRadius:'7px', fontSize:'11px', fontWeight:'700', cursor:'pointer' }}>✏️ Edit</button>
                    <button onClick={()=>{ setShowPwReset(u); setNewPassword(''); }} style={{ padding:'5px 10px', background:'#FEF9C3', color:'#854D0E', border:'none', borderRadius:'7px', fontSize:'11px', fontWeight:'700', cursor:'pointer' }}>🔑 Reset PW</button>
                    <button onClick={()=>toggleActive(u)} style={{ padding:'5px 10px', background:u.is_active?'#FEF2F2':'#F0FDF4', color:u.is_active?RD:GR, border:'none', borderRadius:'7px', fontSize:'11px', fontWeight:'700', cursor:'pointer' }}>
                      {u.is_active?'🚫 Deactivate':'✅ Reactivate'}
                    </button>
                  </div>
                </div>
              );
            })}
            {filtered.length===0 && <div style={{ textAlign:'center', padding:'40px', background:'#fff', borderRadius:'12px', border:`1.5px solid ${PL}`, color:'#94A3B8' }}>No users match your search</div>}
          </div>
        )}
      </div>

      {showModal && (
        <div onClick={e=>{if(e.target===e.currentTarget)setShowModal(false);}} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:500, display:'flex', alignItems:isMobile?'flex-end':'center', justifyContent:'center', padding:isMobile?0:16 }}>
          <div style={{ background:'#fff', borderRadius:isMobile?'20px 20px 0 0':'18px', width:'100%', maxWidth:'520px', maxHeight:isMobile?'90vh':'88vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 24px 80px rgba(0,0,0,0.3)' }}>
            <div style={{ background:`linear-gradient(135deg,${P},${PM})`, padding:'16px 20px', color:'#fff', flexShrink:0 }}>
              <div style={{ fontWeight:'900', fontSize:'16px' }}>{editUser?'Edit User':'Add New User'}</div>
              <div style={{ fontSize:'11px', color:'#DDD6FE', marginTop:'2px' }}>{editUser?`Editing: ${editUser.full_name}`:'Create a new system account'}</div>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'20px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <div style={{ gridColumn:'1/3' }}>
                  <label style={lbl}>Full Name *</label>
                  <input type="text" value={form.full_name} onChange={e=>set('full_name',e.target.value)} placeholder="e.g. John Magezi" style={inp}/>
                </div>
                <div>
                  <label style={lbl}>Username *</label>
                  <input type="text" value={form.username} onChange={e=>set('username',e.target.value.toLowerCase())} placeholder="e.g. shift_magezi" style={inp} autoCapitalize="none"/>
                </div>
                <div>
                  <label style={lbl}>Email</label>
                  <input type="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="name@company.com" style={inp}/>
                </div>
                {!editUser && (
                  <div style={{ gridColumn:'1/3' }}>
                    <label style={lbl}>Password * (min 8 characters)</label>
                    <input type="password" value={form.password} onChange={e=>set('password',e.target.value)} placeholder="••••••••" style={inp}/>
                  </div>
                )}
                <div>
                  <label style={lbl}>Role</label>
                  <select value={form.role_id} onChange={e=>set('role_id',e.target.value)} style={{ ...inp, cursor:'pointer' }}>
                    <option value="">— Select Role —</option>
                    {roles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Department</label>
                  <select value={form.department_id} onChange={e=>set('department_id',e.target.value)} style={{ ...inp, cursor:'pointer' }}>
                    <option value="">— Select Department —</option>
                    {departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                {editUser && (
                  <div style={{ gridColumn:'1/3' }}>
                    <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer' }}>
                      <input type="checkbox" checked={form.is_active} onChange={e=>set('is_active',e.target.checked)} style={{ width:'17px', height:'17px', accentColor:PM }}/>
                      <span style={{ fontSize:'13px', fontWeight:'600', color:'#374151' }}>Account is Active</span>
                    </label>
                  </div>
                )}
              </div>
            </div>
            <div style={{ padding:'14px 20px', borderTop:`1.5px solid ${PL}`, background:'#F9FAFB', display:'flex', gap:'10px', flexShrink:0 }}>
              <button onClick={handleSave} disabled={saving} style={{ flex:1, padding:'11px', background:saving?'#A78BFA':`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:'700', cursor:saving?'not-allowed':'pointer', fontFamily:'inherit' }}>
                {saving?'Saving...':editUser?'✅ Update User':'✅ Create User'}
              </button>
              <button onClick={()=>setShowModal(false)} style={{ flex:1, padding:'11px', background:'#F3F4F6', color:'#374151', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showPwReset && (
        <div onClick={e=>{if(e.target===e.currentTarget){setShowPwReset(null);setNewPassword('');}}} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div style={{ background:'#fff', borderRadius:'16px', maxWidth:'400px', width:'100%', overflow:'hidden', boxShadow:'0 24px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ background:'linear-gradient(135deg,#D97706,#B45309)', padding:'14px 20px', color:'#fff' }}>
              <div style={{ fontWeight:'900', fontSize:'15px' }}>🔑 Reset Password</div>
              <div style={{ fontSize:'11px', color:'#FDE68A', marginTop:'2px' }}>{showPwReset.full_name}</div>
            </div>
            <div style={{ padding:'20px' }}>
              <label style={lbl}>New Password (min 8 characters)</label>
              <input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Enter new password" style={{ ...inp, marginBottom:'16px' }}/>
              <div style={{ display:'flex', gap:'8px' }}>
                <button onClick={handlePasswordReset} disabled={saving} style={{ flex:1, padding:'11px', background:'linear-gradient(135deg,#D97706,#B45309)', color:'#fff', border:'none', borderRadius:'9px', fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>
                  {saving?'Resetting...':'✅ Reset Password'}
                </button>
                <button onClick={()=>{setShowPwReset(null);setNewPassword('');}} style={{ flex:1, padding:'11px', background:'#F3F4F6', color:'#374151', border:'none', borderRadius:'9px', fontSize:'13px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
