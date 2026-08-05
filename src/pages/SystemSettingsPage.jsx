// ============================================================
// FILE: src/pages/SystemSettingsPage.jsx
// QC Head admin — shifts, timezone, system health, data export
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { supabase } from '../services/supabase';
import api from '../services/api';
import { toast } from 'react-toastify';
import { format } from 'date-fns';

const P  = '#6B21A8';
const PM = '#7C3AED';
const PL = '#EDE9FE';
const GR = '#16A34A';
const RD = '#DC2626';
const AM = '#D97706';

const TABS = ['Shifts','System Health','Data Export'];

export default function SystemSettingsPage() {
  const navigate = useNavigate();

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const [tab,     setTab]     = useState(0);
  const [saving,  setSaving]  = useState(false);
  const [loading, setLoading] = useState(false);

  // Shifts
  const [shifts, setShifts] = useState([]);
  const [newShift, setNewShift] = useState({ name:'', start_time:'', end_time:'' });
  const [editShift, setEditShift] = useState(null);

  // System health
  const [health, setHealth] = useState(null);
  const [checking, setChecking] = useState(false);
  const [dbStats, setDbStats] = useState(null);

  const loadShifts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('shifts').select('*').order('start_time');
      setShifts(data || []);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === 0) loadShifts();
  }, [tab, loadShifts]);

  const checkHealth = async () => {
    setChecking(true);
    try {
      const start = Date.now();
      const res = await api.get('/health');
      const latency = Date.now() - start;
      setHealth({ ok:true, latency, data:res.data, checked: new Date() });

      // DB stats
      const [samples, users, tests] = await Promise.all([
        supabase.from('registered_samples').select('id', { count:'exact', head:true }),
        supabase.from('app_users').select('id', { count:'exact', head:true }),
        supabase.from('tests').select('id', { count:'exact', head:true }),
      ]);
      setDbStats({
        samples: samples.count || 0,
        users  : users.count   || 0,
        tests  : tests.count   || 0,
      });
    } catch(e) {
      setHealth({ ok:false, error:e.message, checked: new Date() });
    } finally { setChecking(false); }
  };

  useEffect(() => {
    if (tab === 1) checkHealth();
  }, [tab]);

  const addShift = async () => {
    if (!newShift.name.trim())       { toast.warning('Shift name required'); return; }
    if (!newShift.start_time)        { toast.warning('Start time required'); return; }
    if (!newShift.end_time)          { toast.warning('End time required'); return; }
    if (shifts.some(s => s.name.toLowerCase() === newShift.name.toLowerCase())) {
      toast.warning('Shift name already exists'); return;
    }
    setSaving(true);
    try {
      await supabase.from('shifts').insert({
        name: newShift.name.trim(),
        start_time: newShift.start_time,
        end_time: newShift.end_time,
      });
      toast.success('✅ Shift added');
      setNewShift({ name:'', start_time:'', end_time:'' });
      loadShifts();
    } catch(e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const saveShiftEdit = async () => {
    if (!editShift.name.trim()) { toast.warning('Name required'); return; }
    setSaving(true);
    try {
      await supabase.from('shifts').update({
        name: editShift.name.trim(),
        start_time: editShift.start_time,
        end_time: editShift.end_time,
      }).eq('id', editShift.id);
      toast.success('✅ Shift updated');
      setEditShift(null);
      loadShifts();
    } catch(e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const deleteShift = async (id, name) => {
    if (!window.confirm(`Delete shift "${name}"?`)) return;
    try {
      await supabase.from('shifts').delete().eq('id', id);
      toast.success('Shift deleted');
      loadShifts();
    } catch(e) { toast.error(e.message); }
  };

  const exportData = async (type) => {
    try {
      toast.info(`⏳ Preparing ${type} export...`);
      let data, filename;

      if (type === 'Samples') {
        const { data: d } = await supabase
          .from('registered_samples')
          .select('sample_number, sample_name, status, registered_at, departments(name), sample_types(name)')
          .order('registered_at', { ascending: false });
        data = (d||[]).map(s => ({
          'Sample Number': s.sample_number,
          'Sample Name'  : s.sample_name,
          'Department'   : s.departments?.name,
          'Type'         : s.sample_types?.name,
          'Status'       : s.status,
          'Registered At': s.registered_at ? format(new Date(s.registered_at), 'dd/MM/yyyy HH:mm') : '',
        }));
        filename = `BUL_QC_Samples_${format(new Date(),'yyyyMMdd')}.csv`;
      } else if (type === 'Results') {
        const { data: d } = await supabase
          .from('sample_test_assignments')
          .select('result_value, result_status, analyst_signature, submitted_at, tests(name, unit), registered_samples(sample_number, sample_name)')
          .not('result_value', 'is', null)
          .order('submitted_at', { ascending: false })
          .limit(5000);
        data = (d||[]).map(r => ({
          'Sample Number': r.registered_samples?.sample_number,
          'Sample Name'  : r.registered_samples?.sample_name,
          'Test'         : r.tests?.name,
          'Result'       : r.result_value,
          'Unit'         : r.tests?.unit || '',
          'Status'       : r.result_status,
          'Analyst'      : r.analyst_signature,
          'Submitted At' : r.submitted_at ? format(new Date(r.submitted_at),'dd/MM/yyyy HH:mm') : '',
        }));
        filename = `BUL_QC_Results_${format(new Date(),'yyyyMMdd')}.csv`;
      } else if (type === 'Users') {
        const { data: d } = await supabase
          .from('app_users')
          .select('full_name, username, email, is_active, created_at, roles(name), departments(name)');
        data = (d||[]).map(u => ({
          'Full Name'  : u.full_name,
          'Username'   : u.username,
          'Email'      : u.email || '',
          'Role'       : u.roles?.name || '',
          'Department' : u.departments?.name || '',
          'Active'     : u.is_active ? 'Yes' : 'No',
          'Joined'     : u.created_at ? format(new Date(u.created_at),'dd/MM/yyyy') : '',
        }));
        filename = `BUL_QC_Users_${format(new Date(),'yyyyMMdd')}.csv`;
      }

      if (!data || !data.length) { toast.warning('No data to export'); return; }

      const headers = Object.keys(data[0]);
      const csv = [
        headers.join(','),
        ...data.map(row => headers.map(h => `"${String(row[h]||'').replace(/"/g,'""')}"`).join(','))
      ].join('\n');

      const blob = new Blob([csv], { type:'text/csv' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`✅ ${type} exported successfully`);
    } catch(e) { toast.error('Export failed: ' + e.message); }
  };

  const inp = {
    border:`1.5px solid ${PL}`, borderRadius:'8px', padding:'8px 11px',
    fontSize:'13px', fontFamily:'inherit', background:'#fff',
    color:'#111827', outline:'none', boxSizing:'border-box', width:'100%',
  };
  const lbl = { display:'block', fontSize:'11px', fontWeight:'700', color:'#4C1D95', marginBottom:'4px' };

  return (
    <div style={{ minHeight:'100vh', background:'#F8FAFC', paddingBottom: isMobile?'90px':'60px' }}>
      <Navbar />
      <div style={{ maxWidth:'900px', margin:'0 auto', padding: isMobile?'12px':'20px' }}>

        <div style={{ marginBottom:'16px' }}>
          <button onClick={()=>navigate(-1)}
            style={{ background:'none', border:'none', color:PM, fontSize:'12px',
              fontWeight:'700', cursor:'pointer', marginBottom:'4px', padding:0 }}>
            ← Back
          </button>
          <h1 style={{ fontSize: isMobile?'18px':'22px', fontWeight:'900', color:'#0F172A', margin:0 }}>
            ⚙️ System Settings
          </h1>
          <p style={{ fontSize:'12px', color:'#94A3B8', margin:'2px 0 0' }}>
            Shifts, system health, data export & backup
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:'4px', background:'#fff', borderRadius:'12px',
          border:`1.5px solid ${PL}`, padding:'4px', marginBottom:'16px' }}>
          {TABS.map((t,i) => (
            <button key={t} onClick={()=>setTab(i)}
              style={{ flex:1, padding:'9px 12px', borderRadius:'9px', border:'none',
                background: tab===i?`linear-gradient(135deg,${P},${PM})`:'transparent',
                color: tab===i?'#fff':'#6B7280', fontSize:'12px',
                fontWeight:'700', cursor:'pointer' }}>
              {t}
            </button>
          ))}
        </div>

        {/* ── SHIFTS ── */}
        {tab===0 && (
          <>
            {/* Add shift form */}
            <div style={{ background:'#F5F3FF', borderRadius:'12px', border:`1.5px solid ${PL}`,
              padding:'16px', marginBottom:'16px' }}>
              <div style={{ fontSize:'13px', fontWeight:'800', color:P, marginBottom:'12px' }}>
                ➕ Add New Shift
              </div>
              <div style={{ display:'grid', gridTemplateColumns: isMobile?'1fr':'1fr 1fr 1fr', gap:'10px' }}>
                <div>
                  <label style={lbl}>Shift Name *</label>
                  <input value={newShift.name}
                    onChange={e=>setNewShift(p=>({...p,name:e.target.value}))}
                    placeholder="e.g. Morning Shift" style={inp}/>
                </div>
                <div>
                  <label style={lbl}>Start Time *</label>
                  <input type="time" value={newShift.start_time}
                    onChange={e=>setNewShift(p=>({...p,start_time:e.target.value}))}
                    style={inp}/>
                </div>
                <div>
                  <label style={lbl}>End Time *</label>
                  <input type="time" value={newShift.end_time}
                    onChange={e=>setNewShift(p=>({...p,end_time:e.target.value}))}
                    style={inp}/>
                </div>
              </div>
              <button onClick={addShift} disabled={saving}
                style={{ marginTop:'12px', padding:'9px 20px',
                  background:`linear-gradient(135deg,${P},${PM})`,
                  color:'#fff', border:'none', borderRadius:'9px', fontSize:'13px',
                  fontWeight:'700', cursor:saving?'not-allowed':'pointer', fontFamily:'inherit' }}>
                {saving ? 'Saving...' : '✅ Add Shift'}
              </button>
            </div>

            {/* Shifts list */}
            {loading ? (
              <div style={{ textAlign:'center', padding:'30px', color:'#94A3B8' }}>Loading shifts...</div>
            ) : shifts.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px', background:'#fff',
                borderRadius:'12px', border:`1.5px solid ${PL}`, color:'#94A3B8' }}>
                No shifts configured yet. Add your first shift above.
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {shifts.map(s => (
                  <div key={s.id} style={{ background:'#fff', borderRadius:'12px',
                    border:`1.5px solid ${PL}`, padding:'14px 16px' }}>
                    {editShift?.id === s.id ? (
                      <div style={{ display:'grid', gridTemplateColumns: isMobile?'1fr':'1fr 1fr 1fr', gap:'10px' }}>
                        <div>
                          <label style={lbl}>Name</label>
                          <input value={editShift.name}
                            onChange={e=>setEditShift(p=>({...p,name:e.target.value}))}
                            style={inp}/>
                        </div>
                        <div>
                          <label style={lbl}>Start Time</label>
                          <input type="time" value={editShift.start_time}
                            onChange={e=>setEditShift(p=>({...p,start_time:e.target.value}))}
                            style={inp}/>
                        </div>
                        <div>
                          <label style={lbl}>End Time</label>
                          <input type="time" value={editShift.end_time}
                            onChange={e=>setEditShift(p=>({...p,end_time:e.target.value}))}
                            style={inp}/>
                        </div>
                        <div style={{ gridColumn: isMobile?'1':'1/4', display:'flex', gap:'8px', marginTop:'4px' }}>
                          <button onClick={saveShiftEdit} disabled={saving}
                            style={{ padding:'8px 16px', background:GR, color:'#fff', border:'none',
                              borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:'pointer' }}>
                            ✅ Save
                          </button>
                          <button onClick={()=>setEditShift(null)}
                            style={{ padding:'8px 14px', background:'#F1F5F9', color:'#64748B', border:'none',
                              borderRadius:'8px', fontSize:'12px', cursor:'pointer' }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
                        <div>
                          <div style={{ fontWeight:'800', fontSize:'14px', color:'#0F172A' }}>{s.name}</div>
                          <div style={{ fontSize:'12px', color:'#64748B', marginTop:'2px' }}>
                            🕐 {s.start_time} → {s.end_time}
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:'6px' }}>
                          <button onClick={()=>setEditShift({...s})}
                            style={{ padding:'6px 12px', background:PL, color:P, border:'none',
                              borderRadius:'7px', fontSize:'11px', fontWeight:'700', cursor:'pointer' }}>
                            ✏️ Edit
                          </button>
                          <button onClick={()=>deleteShift(s.id, s.name)}
                            style={{ padding:'6px 12px', background:'#FEF2F2', color:RD, border:'none',
                              borderRadius:'7px', fontSize:'11px', fontWeight:'700', cursor:'pointer' }}>
                            🗑 Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── SYSTEM HEALTH ── */}
        {tab===1 && (
          <>
            <button onClick={checkHealth} disabled={checking}
              style={{ marginBottom:'16px', padding:'10px 20px',
                background: checking?'#A78BFA':`linear-gradient(135deg,${P},${PM})`,
                color:'#fff', border:'none', borderRadius:'10px', fontSize:'13px',
                fontWeight:'700', cursor:checking?'not-allowed':'pointer', fontFamily:'inherit' }}>
              {checking ? '⏳ Checking...' : '🔄 Refresh Health Check'}
            </button>

            {health && (
              <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>

                {/* Backend status */}
                <div style={{ background:'#fff', borderRadius:'12px',
                  border:`1.5px solid ${health.ok?'#86EFAC':'#FECACA'}`, padding:'16px' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div>
                      <div style={{ fontWeight:'800', fontSize:'14px', color:'#0F172A' }}>
                        {health.ok ? '✅ Backend API' : '❌ Backend API'}
                      </div>
                      <div style={{ fontSize:'12px', color:'#64748B', marginTop:'2px' }}>
                        {health.ok
                          ? `Response time: ${health.latency}ms · Status: Online`
                          : `Error: ${health.error}`}
                      </div>
                    </div>
                    <span style={{ fontSize:'24px' }}>{health.ok ? '🟢' : '🔴'}</span>
                  </div>
                  {health.checked && (
                    <div style={{ fontSize:'10px', color:'#94A3B8', marginTop:'8px' }}>
                      Last checked: {format(health.checked,'dd/MM/yyyy HH:mm:ss')}
                    </div>
                  )}
                </div>

                {/* DB stats */}
                {dbStats && (
                  <div style={{ background:'#fff', borderRadius:'12px', border:`1.5px solid ${PL}`, padding:'16px' }}>
                    <div style={{ fontWeight:'800', fontSize:'14px', color:'#0F172A', marginBottom:'12px' }}>
                      🗄️ Database Statistics
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px' }}>
                      {[
                        { label:'Total Samples', val:dbStats.samples, color:PM },
                        { label:'Total Users',   val:dbStats.users,   color:GR },
                        { label:'Total Tests',   val:dbStats.tests,   color:AM },
                      ].map(s=>(
                        <div key={s.label} style={{ background:'#F8FAFC', borderRadius:'10px',
                          padding:'12px', textAlign:'center', border:`1px solid ${PL}` }}>
                          <div style={{ fontSize:'24px', fontWeight:'900', color:s.color }}>{s.val}</div>
                          <div style={{ fontSize:'10px', color:'#94A3B8', fontWeight:'700',
                            textTransform:'uppercase', marginTop:'2px' }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* System info */}
                <div style={{ background:'#fff', borderRadius:'12px', border:`1.5px solid ${PL}`, padding:'16px' }}>
                  <div style={{ fontWeight:'800', fontSize:'14px', color:'#0F172A', marginBottom:'10px' }}>
                    ℹ️ System Information
                  </div>
                  {[
                    ['App Version',    'BUL QC LIMS v1.0.4'],
                    ['Frontend',       'React · Deployed on Vercel'],
                    ['Backend',        'Node.js · Deployed on Render'],
                    ['Database',       'Supabase (PostgreSQL)'],
                    ['Email Service',  'Resend (bulqclims.com)'],
                    ['Current Time',   format(new Date(),'dd/MM/yyyy HH:mm:ss')],
                  ].map(([k,v])=>(
                    <div key={k} style={{ display:'flex', justifyContent:'space-between',
                      padding:'8px 0', borderBottom:'1px solid #F1F5F9', fontSize:'12px' }}>
                      <span style={{ fontWeight:'700', color:'#64748B' }}>{k}</span>
                      <span style={{ color:'#0F172A', fontFamily: k==='App Version'?'monospace':'inherit' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── DATA EXPORT ── */}
        {tab===2 && (
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <div style={{ background:'#FFF7ED', border:'1.5px solid #FED7AA', borderRadius:'12px',
              padding:'12px 16px', fontSize:'12px', color:'#92400E' }}>
              ⚠️ Exports are downloaded as CSV files. Large datasets may take a few seconds to prepare.
            </div>

            {[
              { type:'Samples',  icon:'🧪', desc:'All registered samples with status, department and type', color:PM },
              { type:'Results',  icon:'📊', desc:'All test results with analyst signatures (last 5,000 records)', color:GR },
              { type:'Users',    icon:'👥', desc:'All system users with roles and departments', color:AM },
            ].map(e => (
              <div key={e.type} style={{ background:'#fff', borderRadius:'12px',
                border:`1.5px solid ${PL}`, padding:'16px',
                display:'flex', alignItems:'center', justifyContent:'space-between',
                flexWrap:'wrap', gap:'12px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                  <span style={{ fontSize:'28px' }}>{e.icon}</span>
                  <div>
                    <div style={{ fontWeight:'800', fontSize:'14px', color:'#0F172A' }}>{e.type} Export</div>
                    <div style={{ fontSize:'12px', color:'#64748B', marginTop:'2px' }}>{e.desc}</div>
                  </div>
                </div>
                <button onClick={()=>exportData(e.type)}
                  style={{ padding:'9px 18px', background:`linear-gradient(135deg,${P},${PM})`,
                    color:'#fff', border:'none', borderRadius:'9px', fontSize:'12px',
                    fontWeight:'700', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                  ⬇️ Export CSV
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
