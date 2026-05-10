// ============================================================
// FILE: frontend/bul-qc-app/src/components/Navbar.jsx
// UPDATED: Assign Sample, professional Reports & Admin menus
// ============================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth }      from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import { supabase }     from '../services/supabase';

let bulqcLogo  = null;
let santosLogo = null;
try { bulqcLogo  = require('../assets/bulqc_logo.png');  } catch(e) {}
try { santosLogo = require('../assets/santos_logo.png'); } catch(e) {}

const P  = '#6B21A8';
const PM = '#7C3AED';
const PL = '#EDE9FE';
const G  = '#FFB81C';

const REPORT_ITEMS = [
  { icon:'📚', label:'Report Books & Sign-off',    badge:'Core', sub:'7 official lab record books with daily QC Head approval',          path:'/report-books'                },
  { icon:'⚠️', label:'OOS Investigation Log',       badge:'',     sub:'Out-of-spec history, root cause & corrective action tracker',      path:'/reports/oos-log'             },
  { icon:'📜', label:'Certificate of Analysis',     badge:'New',  sub:'Auto-generate COA documents for finished product batches',         path:'/reports/coa'                 },
  { icon:'👨‍🔬',label:'Analyst Performance',        badge:'',     sub:'Submissions, turnaround time, OOS rate & accuracy per analyst',    path:'/reports/analyst-performance' },
  { icon:'📈', label:'SPC Control Charts',          badge:'',     sub:'Shewhart X-bar & R charts — catch process drift before failure',   path:'/reports/spc'                 },
  { icon:'🏭', label:'Batch Release Report',        badge:'',     sub:'Formal QC sign-off document for production batch release',         path:'/reports/batch-release'       },
  { icon:'💊', label:'Vitamin A Surveillance',      badge:'',     sub:'Daily Vitamin A results across all departments in one view',       path:'/report-books?book=VITAMIN_A' },
  { icon:'📊', label:'Trend & Statistical Analysis',badge:'',     sub:'7-day, 30-day & custom range charts for any test parameter',      path:'/reports/trends'              },
];

const ADMIN_ITEMS = [
  { icon:'👥', label:'User Management',             badge:'',     sub:'Add, edit, deactivate users · reset passwords · manage roles',    path:'/admin/users'          },
  { icon:'⚗️', label:'Test Specifications',         badge:'',     sub:'Update min/max ranges for any test across all sample types',      path:'/admin/specifications' },
  { icon:'🔬', label:'Instrument Calibration',      badge:'',     sub:'Log calibration dates, certificates & next-due alerts',          path:'/admin/calibration'    },
  { icon:'🧬', label:'Method Validation Records',   badge:'New',  sub:'Store and retrieve analytical method validation documentation',   path:'/admin/methods'        },
  { icon:'📜', label:'Full Audit Trail',            badge:'',     sub:'Tamper-proof log of every create, edit & delete in the system',   path:'/admin/audit'          },
  { icon:'🏢', label:'Department & Sample Config',  badge:'',     sub:'Manage departments, categories, sample types & subtypes',        path:'/admin/departments'    },
  { icon:'🔔', label:'Notification Rules',          badge:'',     sub:'Configure OOS alerts, escalation chains & SMS/email triggers',   path:'/admin/notifications'  },
  { icon:'⚙️', label:'System Settings & Backup',   badge:'',     sub:'Shifts, timezone, data retention, export & system health',       path:'/admin'                },
];

export default function Navbar() {
  const { user, signingAs, logout, timeLeft, isAdmin, isDeptHead } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [showReports, setShowReports] = useState(false);
  const [showAdmin,   setShowAdmin]   = useState(false);
  const [showAvatar,  setShowAvatar]  = useState(false);
  const [showAssign,  setShowAssign]  = useState(false);
  const [avatar,      setAvatar]      = useState(() => localStorage.getItem('bul_qc_avatar_'+(user?.id||'g')));

  const [samples,     setSamples]     = useState([]);
  const [analysts,    setAnalysts]    = useState([]);
  const [selSample,   setSelSample]   = useState('');
  const [selAnalyst,  setSelAnalyst]  = useState('');
  const [assignNote,  setAssignNote]  = useState('');
  const [assigning,   setAssigning]   = useState(false);
  const [assignDone,  setAssignDone]  = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const fileRef    = useRef(null);
  const reportsRef = useRef(null);
  const adminRef   = useRef(null);
  const assignRef  = useRef(null);

  const role     = user?.roles?.name || '';
  const isQCHead = role === 'QC Head' || role === 'QC Assistant';
  const isActive = (p) => location.pathname === p || location.pathname.startsWith(p+'/');

  useEffect(() => {
    const h = (e) => {
      if (reportsRef.current && !reportsRef.current.contains(e.target)) setShowReports(false);
      if (adminRef.current   && !adminRef.current.contains(e.target))   setShowAdmin(false);
      if (assignRef.current  && !assignRef.current.contains(e.target))  { /* modal uses backdrop */ }
      if (!e.target.closest?.('.avatar-zone')) setShowAvatar(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const loadAssignData = useCallback(async () => {
    setLoadingData(true);
    try {
      const { data: sData } = await supabase
        .from('registered_samples')
        .select('id, sample_name, sample_number, departments(name)')
        .in('status', ['pending','in_progress'])
        .order('registered_at', { ascending: false })
        .limit(40);
      setSamples(sData || []);

      const { data: aData } = await supabase
        .from('app_users')
        .select('id, full_name, roles(name)')
        .order('full_name');
      setAnalysts((aData||[]).filter(a => !['QC Head','QC Assistant'].includes(a.roles?.name)));
    } catch(e) { console.error(e); }
    finally { setLoadingData(false); }
  }, []);

  const openAssign = () => {
    setShowAssign(true);
    setAssignDone(false);
    setSelSample('');
    setSelAnalyst('');
    setAssignNote('');
    loadAssignData();
  };

  const handleAssign = async () => {
    if (!selSample || !selAnalyst) return;
    setAssigning(true);
    try {
      await supabase.from('analyst_assignments').insert({
        sample_id  : selSample,
        assigned_to: selAnalyst,
        assigned_by: user?.id,
        notes      : assignNote.trim() || null,
        assigned_at: new Date().toISOString(),
      });
      setAssignDone(true);
      setTimeout(() => setShowAssign(false), 2500);
    } catch(e) { console.error(e); }
    finally { setAssigning(false); }
  };

  const uploadAvatar = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      setAvatar(ev.target.result);
      localStorage.setItem('bul_qc_avatar_'+(user?.id||'g'), ev.target.result);
      setShowAvatar(false);
    };
    r.readAsDataURL(f);
  };

  const initials = (user?.full_name||'?').split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();

  const NBtn = ({ label, active, onClick, chevron, highlight }) => (
    <button onClick={onClick} style={{
      padding:'6px 14px', borderRadius:'8px', border:'none',
      background: highlight ? 'rgba(255,184,28,0.2)' : active ? 'rgba(255,255,255,0.22)' : 'transparent',
      color:'#fff', fontWeight: active?'800':'600', fontSize:'13px',
      cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap',
      display:'flex', alignItems:'center', gap:'4px', transition:'background 0.15s',
    }}
    onMouseEnter={e => { if(!active) e.currentTarget.style.background='rgba(255,255,255,0.12)'; }}
    onMouseLeave={e => { if(!active) e.currentTarget.style.background=highlight?'rgba(255,184,28,0.2)':active?'rgba(255,255,255,0.22)':'transparent'; }}
    >
      {label}
      {chevron && <span style={{ fontSize:'9px', opacity:0.7, transition:'transform 0.2s', transform:active?'rotate(180deg)':'none' }}>▼</span>}
    </button>
  );

  const DropMenu = ({ items, onClose }) => (
    <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, background:'#fff', borderRadius:'14px', boxShadow:'0 12px 40px rgba(107,33,168,0.22)', border:`1.5px solid ${PL}`, zIndex:300, minWidth:'360px', overflow:'hidden' }}>
      {items.map((item,i) => (
        <button key={i} onClick={() => { navigate(item.path); onClose(); }}
          style={{ display:'flex', alignItems:'flex-start', gap:'12px', width:'100%', padding:'11px 16px', border:'none', borderBottom:i<items.length-1?`1px solid ${PL}`:'none', background:'#fff', cursor:'pointer', fontFamily:'inherit', textAlign:'left', transition:'background 0.12s' }}
          onMouseEnter={e => e.currentTarget.style.background='#F5F3FF'}
          onMouseLeave={e => e.currentTarget.style.background='#fff'}
        >
          <span style={{ fontSize:'19px', flexShrink:0, marginTop:'1px' }}>{item.icon}</span>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:'7px' }}>
              <span style={{ fontWeight:'700', fontSize:'13px', color:'#1F2937' }}>{item.label}</span>
              {item.badge && (
                <span style={{ fontSize:'9px', fontWeight:'800', padding:'1px 6px', borderRadius:'6px', background:item.badge==='New'?'#FEF9C3':'#EDE9FE', color:item.badge==='New'?'#854D0E':P, border:`1px solid ${item.badge==='New'?'#FDE68A':PL}` }}>
                  {item.badge}
                </span>
              )}
            </div>
            <div style={{ fontSize:'11px', color:'#6B7280', marginTop:'2px', lineHeight:1.4 }}>{item.sub}</div>
          </div>
          <span style={{ fontSize:'12px', color:'#9CA3AF', flexShrink:0, marginTop:'3px' }}>→</span>
        </button>
      ))}
    </div>
  );

  return (
    <>
      <nav style={{ background:`linear-gradient(135deg,${P} 0%,${PM} 100%)`, padding:'0 14px', display:'flex', alignItems:'center', minHeight:'52px', gap:'4px', boxShadow:'0 2px 12px rgba(107,33,168,0.35)', position:'sticky', top:0, zIndex:200 }}>

        {/* Logo */}
        <div onClick={() => navigate('/dashboard')} style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', flexShrink:0, marginRight:'8px' }}>
          {bulqcLogo
            ? <img src={bulqcLogo} alt="BUL QC" style={{ height:'34px', width:'34px', borderRadius:'8px', objectFit:'cover' }}/>
            : <div style={{ width:'34px', height:'34px', borderRadius:'8px', background:G, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px' }}>🧪</div>
          }
          <div>
            <div style={{ color:'#fff', fontWeight:'800', fontSize:'13px', lineHeight:1.1 }}>BUL QC App</div>
            <div style={{ color:'#DDD6FE', fontSize:'9px' }}>LIMS v1.0.4</div>
          </div>
        </div>

        {/* Nav buttons */}
        <NBtn label="Dashboard" active={isActive('/dashboard')} onClick={() => navigate('/dashboard')}/>

        {isQCHead && (
          <div ref={reportsRef} style={{ position:'relative' }}>
            <NBtn label="Reports" active={showReports} onClick={() => { setShowReports(!showReports); setShowAdmin(false); }} chevron/>
            {showReports && <DropMenu items={REPORT_ITEMS} onClose={() => setShowReports(false)}/>}
          </div>
        )}

        {isQCHead && (
          <div ref={adminRef} style={{ position:'relative' }}>
            <NBtn label="Admin" active={showAdmin} onClick={() => { setShowAdmin(!showAdmin); setShowReports(false); }} chevron/>
            {showAdmin && <DropMenu items={ADMIN_ITEMS} onClose={() => setShowAdmin(false)}/>}
          </div>
        )}

        <div style={{ flex:1 }}/>

        {/* Right side */}
        {timeLeft && (
          <div style={{ background:'rgba(255,255,255,0.12)', borderRadius:'20px', padding:'3px 10px', fontSize:'11px', color:'#DDD6FE', fontWeight:'600', border:'1px solid rgba(255,255,255,0.2)', whiteSpace:'nowrap', marginRight:'4px' }}>
            ⏱ {timeLeft}
          </div>
        )}

        {/* Assign Sample — gold button, QC Head only */}
        {isQCHead && (
          <button onClick={openAssign} style={{ padding:'7px 14px', background:`linear-gradient(135deg,${G},#D97706)`, color:'#1F2937', border:'none', borderRadius:'10px', fontSize:'12px', fontWeight:'800', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap', boxShadow:'0 2px 8px rgba(255,184,28,0.4)', display:'flex', alignItems:'center', gap:'5px', marginRight:'6px' }}>
            👤 Assign Sample
          </button>
        )}

        <NotificationBell departmentId={null}/>

        {santosLogo && (
          <img src={santosLogo} alt="Santos" style={{ height:'28px', width:'auto', objectFit:'contain', borderRadius:'6px', background:'#fff', padding:'2px 6px', marginLeft:'6px', flexShrink:0 }}/>
        )}

        {/* Avatar */}
        <div className="avatar-zone" style={{ position:'relative', marginLeft:'6px' }}>
          <div onClick={() => setShowAvatar(!showAvatar)}
            style={{ width:'32px', height:'32px', borderRadius:'50%', background:avatar?'transparent':G, border:'2px solid rgba(255,255,255,0.5)', cursor:'pointer', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'800', fontSize:'12px', color:P }}>
            {avatar ? <img src={avatar} alt="av" style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : initials}
          </div>
          {showAvatar && (
            <div style={{ position:'absolute', right:0, top:'40px', background:'#fff', borderRadius:'12px', boxShadow:'0 8px 24px rgba(107,33,168,0.2)', border:`1.5px solid ${PL}`, minWidth:'200px', zIndex:300, overflow:'hidden' }}>
              <div style={{ padding:'10px 14px', background:'#F5F3FF', borderBottom:`1px solid ${PL}` }}>
                <p style={{ fontWeight:'700', color:'#1F2937', margin:0, fontSize:'13px' }}>{user?.full_name}</p>
                <p style={{ fontSize:'11px', color:PM, margin:'2px 0 0' }}>{role}</p>
                {signingAs && <p style={{ fontSize:'11px', color:'#6B7280', margin:'2px 0 0' }}>Signing as: {signingAs}</p>}
              </div>
              <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:'5px' }}>
                <input ref={fileRef} type="file" accept="image/*" onChange={uploadAvatar} style={{ display:'none' }}/>
                <button onClick={() => fileRef.current?.click()} style={{ background:PM, color:'#fff', border:'none', borderRadius:'7px', padding:'8px', fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>📷 Upload Photo</button>
                {avatar && <button onClick={() => { setAvatar(null); localStorage.removeItem('bul_qc_avatar_'+(user?.id||'g')); setShowAvatar(false); }} style={{ background:'#FEF2F2', color:'#DC2626', border:'1px solid #FECACA', borderRadius:'7px', padding:'6px', fontSize:'12px', cursor:'pointer', fontFamily:'inherit' }}>🗑 Remove Photo</button>}
                <button onClick={logout} style={{ background:'#F3F4F6', color:'#374151', border:'none', borderRadius:'7px', padding:'8px', fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>🚪 Logout</button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* ── ASSIGN SAMPLE MODAL ── */}
      {showAssign && (
        <div onClick={e => { if(e.target===e.currentTarget) setShowAssign(false); }}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
          <div style={{ background:'#fff', borderRadius:'18px', maxWidth:'500px', width:'100%', boxShadow:'0 24px 80px rgba(0,0,0,0.3)', overflow:'hidden' }}>

            <div style={{ background:`linear-gradient(135deg,${P},${PM})`, padding:'18px 24px', color:'#fff' }}>
              <div style={{ fontWeight:'900', fontSize:'16px', marginBottom:'3px' }}>👤 Assign Sample to Analyst</div>
              <div style={{ fontSize:'12px', color:'#DDD6FE' }}>Allocate a pending sample to a specific analyst for analysis</div>
            </div>

            <div style={{ padding:'24px' }}>
              {assignDone ? (
                <div style={{ textAlign:'center', padding:'20px' }}>
                  <div style={{ fontSize:'48px', marginBottom:'12px' }}>✅</div>
                  <div style={{ fontWeight:'800', color:'#16A34A', fontSize:'16px' }}>Assignment saved successfully</div>
                  <div style={{ fontSize:'13px', color:'#6B7280', marginTop:'6px' }}>Supervisor will be notified to brief the analyst</div>
                </div>
              ) : loadingData ? (
                <div style={{ textAlign:'center', padding:'24px', color:'#9CA3AF' }}>Loading data...</div>
              ) : (
                <>
                  <div style={{ marginBottom:'14px' }}>
                    <label style={{ display:'block', fontSize:'12px', fontWeight:'700', color:'#4C1D95', marginBottom:'5px' }}>Select Sample *</label>
                    <select value={selSample} onChange={e=>setSelSample(e.target.value)}
                      style={{ width:'100%', border:`1.5px solid ${PL}`, borderRadius:'9px', padding:'10px 12px', fontSize:'13px', fontFamily:'inherit', background:'#fff', color:'#111827', outline:'none', cursor:'pointer', boxSizing:'border-box' }}>
                      <option value="">— Choose a pending sample —</option>
                      {samples.map(s => (
                        <option key={s.id} value={s.id}>{s.sample_number} · {s.sample_name} ({s.departments?.name})</option>
                      ))}
                    </select>
                    {samples.length===0 && <p style={{ fontSize:'11px', color:'#9CA3AF', margin:'4px 0 0' }}>No pending samples at this time</p>}
                  </div>

                  <div style={{ marginBottom:'14px' }}>
                    <label style={{ display:'block', fontSize:'12px', fontWeight:'700', color:'#4C1D95', marginBottom:'5px' }}>Assign to Analyst *</label>
                    <select value={selAnalyst} onChange={e=>setSelAnalyst(e.target.value)}
                      style={{ width:'100%', border:`1.5px solid ${PL}`, borderRadius:'9px', padding:'10px 12px', fontSize:'13px', fontFamily:'inherit', background:'#fff', color:'#111827', outline:'none', cursor:'pointer', boxSizing:'border-box' }}>
                      <option value="">— Choose analyst —</option>
                      {analysts.map(a => (
                        <option key={a.id} value={a.id}>{a.full_name} — {a.roles?.name}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom:'20px' }}>
                    <label style={{ display:'block', fontSize:'12px', fontWeight:'700', color:'#4C1D95', marginBottom:'5px' }}>Special Instructions (optional)</label>
                    <textarea value={assignNote} onChange={e=>setAssignNote(e.target.value)} rows={3}
                      placeholder="Priority, method to use, deadline or any special notes..."
                      style={{ width:'100%', border:`1.5px solid ${PL}`, borderRadius:'9px', padding:'10px 12px', fontSize:'13px', fontFamily:'inherit', background:'#fff', color:'#111827', outline:'none', resize:'vertical', boxSizing:'border-box' }}/>
                  </div>

                  <div style={{ display:'flex', gap:'10px' }}>
                    <button onClick={handleAssign} disabled={!selSample||!selAnalyst||assigning}
                      style={{ flex:1, padding:'12px', background:(!selSample||!selAnalyst)?'#A78BFA':`linear-gradient(135deg,${P},${PM})`, color:'#fff', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:'700', cursor:(!selSample||!selAnalyst)?'not-allowed':'pointer', fontFamily:'inherit', boxShadow:'0 2px 8px rgba(124,58,237,0.3)' }}>
                      {assigning?'Assigning...':'✅ Assign Now'}
                    </button>
                    <button onClick={() => setShowAssign(false)}
                      style={{ flex:1, padding:'12px', background:'#F3F4F6', color:'#374151', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
