// ============================================================
// FILE: frontend/bul-qc-app/src/components/NotificationBell.jsx
// FIXES:
//   1. Badge clears after opening — won't show again until NEW OOS arrives
//   2. Uses localStorage to track seen notification IDs
//   3. NEW badge on fresh OOS results not yet opened
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth }  from '../context/AuthContext';
import { format }   from 'date-fns';

const PM = '#7C3AED';
const P  = '#6B21A8';
const PL = '#EDE9FE';

const getSeenIds = () => {
  try { return new Set(JSON.parse(localStorage.getItem('bul_qc_seen_oos') || '[]')); }
  catch { return new Set(); }
};

const saveSeenIds = (ids) => {
  try {
    localStorage.setItem('bul_qc_seen_oos', JSON.stringify([...ids].slice(-200)));
  } catch {}
};

export default function NotificationBell({ departmentId }) {
  const { user }              = useAuth();
  const [notes,   setNotes]   = useState([]);
  const [unseen,  setUnseen]  = useState(new Set());
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const dropRef               = useRef(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const deptId = departmentId || user?.department_id;
      const { data, error } = await supabase
        .from('sample_test_assignments')
        .select(`
          id, result_value, result_status, submitted_at, analyst_signature,
          tests ( name, unit ),
          registered_samples (
            sample_name, sample_number, department_id
          )
        `)
        .in('result_status', ['fail_low', 'fail_high'])
        .order('submitted_at', { ascending: false })
        .limit(50);

      if (error) return;
      let results = (data || []).filter(r =>
        !deptId || r.registered_samples?.department_id === deptId
      );
      setNotes(results);

      // Only count ones not yet seen
      const seen = getSeenIds();
      setUnseen(new Set(results.filter(r => !seen.has(r.id)).map(r => r.id)));
    } finally { setLoading(false); }
  }, [user, departmentId]);

  useEffect(() => {
    load();
    const sub = supabase.channel('oos_' + (user?.id || 'g'))
      .on('postgres_changes',
        { event:'UPDATE', schema:'public', table:'sample_test_assignments' },
        p => {
          if (p.new.result_status==='fail_low'||p.new.result_status==='fail_high') load();
        }
      ).subscribe();
    return () => sub.unsubscribe();
  }, [load]);

  // Close on outside click
  useEffect(() => {
    const h = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleOpen = () => {
    const opening = !open;
    setOpen(opening);
    if (opening && unseen.size > 0) {
      // Mark all as seen
      const seen = getSeenIds();
      notes.forEach(n => seen.add(n.id));
      saveSeenIds(seen);
      setUnseen(new Set()); // clear badge immediately
    }
  };

  const count = unseen.size;

  const sl = (status) =>
    status==='fail_low'  ? { text:'LOW',  color:'#DC2626', bg:'#FEF2F2' } :
    status==='fail_high' ? { text:'HIGH', color:'#DC2626', bg:'#FEF2F2' } :
                           { text:'OOS',  color:'#DC2626', bg:'#FEF2F2' };

  return (
    <div ref={dropRef} style={{ position:'relative' }}>

      {/* Bell */}
      <button onClick={handleOpen}
        style={{
          position:'relative',
          background: count>0 ? 'rgba(220,38,38,0.2)' : 'rgba(255,255,255,0.15)',
          border: count>0 ? '1.5px solid rgba(220,38,38,0.5)' : '1px solid rgba(255,255,255,0.25)',
          borderRadius:'50%', width:'36px', height:'36px',
          cursor:'pointer', fontSize:'17px',
          display:'flex', alignItems:'center', justifyContent:'center',
          flexShrink:0,
          animation: count>0 ? 'bellPulse 1.5s infinite' : 'none',
        }}
        title={count>0 ? `${count} new out of spec result(s)` : 'No new OOS results'}
      >
        🔔
        {count>0 && (
          <span style={{
            position:'absolute', top:'-4px', right:'-4px',
            background:'#DC2626', color:'#fff', borderRadius:'50%',
            width:'18px', height:'18px',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:'10px', fontWeight:'900', border:'2px solid #7C3AED',
          }}>
            {count>9?'9+':count}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position:'absolute', right:0, top:'44px',
          width:'340px', maxWidth:'90vw',
          background:'#fff', borderRadius:'14px',
          boxShadow:'0 8px 32px rgba(107,33,168,0.2)',
          border:`1.5px solid ${PL}`, zIndex:300, overflow:'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding:'12px 16px',
            background:`linear-gradient(135deg,${P},${PM})`,
            color:'#fff', display:'flex',
            alignItems:'center', justifyContent:'space-between',
          }}>
            <div>
              <div style={{ fontWeight:'800', fontSize:'14px' }}>⚠️ Out of Spec Results</div>
              <div style={{ fontSize:'11px', color:'#DDD6FE', marginTop:'2px' }}>
                {loading ? 'Loading...' : `${notes.length} result(s) · badge clears when opened`}
              </div>
            </div>
            <button onClick={()=>setOpen(false)}
              style={{ background:'none', border:'none', color:'#fff', cursor:'pointer', fontSize:'18px' }}>
              ✕
            </button>
          </div>

          {/* List */}
          <div style={{ maxHeight:'360px', overflowY:'auto' }}>
            {loading ? (
              <div style={{ padding:'24px', textAlign:'center', color:'#9CA3AF' }}>Loading...</div>
            ) : notes.length===0 ? (
              <div style={{ padding:'32px', textAlign:'center', color:'#9CA3AF' }}>
                <div style={{ fontSize:'32px', marginBottom:'8px' }}>✅</div>
                <p style={{ fontWeight:'600', margin:0 }}>All results within specification</p>
              </div>
            ) : notes.map((note, i) => {
              const s = sl(note.result_status);
              return (
                <div key={note.id} style={{
                  padding:'12px 16px',
                  borderBottom: i<notes.length-1 ? `1px solid ${PL}` : 'none',
                  background:'#fff',
                }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'8px' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:'800', fontSize:'13px', color:'#1F2937', marginBottom:'2px' }}>
                        {note.registered_samples?.sample_name}
                      </div>
                      <div style={{ fontSize:'11px', color:PM, fontFamily:'monospace', marginBottom:'4px' }}>
                        {note.registered_samples?.sample_number}
                      </div>
                    </div>
                    <span style={{ background:s.bg, color:s.color, borderRadius:'8px', padding:'3px 8px', fontSize:'11px', fontWeight:'800', border:`1px solid ${s.color}44`, whiteSpace:'nowrap' }}>
                      {s.text}
                    </span>
                  </div>

                  <div style={{ background:'#FEF2F2', borderRadius:'8px', padding:'8px 10px', border:'1px solid #FECACA' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontWeight:'700', fontSize:'13px', color:'#DC2626' }}>
                        {note.tests?.name}
                      </span>
                      <span style={{ fontWeight:'900', fontSize:'15px', color:'#DC2626' }}>
                        {note.result_value}
                        {note.tests?.unit && <span style={{ fontSize:'11px', marginLeft:'2px' }}>{note.tests.unit}</span>}
                      </span>
                    </div>
                    <div style={{ fontSize:'11px', color:'#6B7280', marginTop:'4px', display:'flex', justifyContent:'space-between' }}>
                      <span>{note.result_status==='fail_low' ? '↓ Below minimum' : '↑ Above maximum'}</span>
                      <span>{note.analyst_signature && `by ${note.analyst_signature}`}</span>
                    </div>
                  </div>

                  {note.submitted_at && (
                    <div style={{ fontSize:'10px', color:'#9CA3AF', marginTop:'5px', textAlign:'right' }}>
                      {format(new Date(note.submitted_at), 'HH:mm · dd MMM yyyy')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{ padding:'8px 16px', background:'#F5F3FF', borderTop:`1px solid ${PL}`, fontSize:'11px', color:'#6B7280', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span>{notes.length} OOS result(s) on record</span>
            <button onClick={load}
              style={{ background:'none', border:'none', color:PM, cursor:'pointer', fontSize:'11px', fontWeight:'600', fontFamily:'inherit' }}>
              🔄 Refresh
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bellPulse {
          0%,100%{ transform:scale(1); }
          25%    { transform:scale(1.15) rotate(-10deg); }
          50%    { transform:scale(1); }
          75%    { transform:scale(1.15) rotate(10deg); }
        }
      `}</style>
    </div>
  );
}
