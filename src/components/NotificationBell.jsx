// ============================================================
// FILE: frontend/bul-qc-app/src/components/NotificationBell.jsx
// Shows OOS result notifications — click to read messages
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useAuth }  from '../context/AuthContext';
import { format }   from 'date-fns';

const PM = '#7C3AED';
const P  = '#6B21A8';
const PL = '#EDE9FE';

export default function NotificationBell({ departmentId }) {
  const { user }               = useAuth();
  const [notes,    setNotes]   = useState([]);
  const [open,     setOpen]    = useState(false);
  const [loading,  setLoading] = useState(false);
  const dropRef                = useRef(null);

  const loadNotifications = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // Load out-of-spec assignments for this department
      const deptId = departmentId || user?.department_id;

      let query = supabase
        .from('sample_test_assignments')
        .select(`
          id, result_value, result_status, remarks,
          submitted_at, analyst_signature,
          tests ( name, unit ),
          registered_samples (
            sample_name, sample_number, department_id,
            departments ( name )
          )
        `)
        .in('result_status', ['fail_low', 'fail_high'])
        .order('submitted_at', { ascending: false })
        .limit(30);

      if (deptId) {
        query = query.eq('registered_samples.department_id', deptId);
      }

      const { data, error } = await query;
      if (error) {
        console.error('NotificationBell load error:', error.message);
        return;
      }

      // Filter to correct dept in JS as a fallback
      let results = data || [];
      if (deptId) {
        results = results.filter(r =>
          r.registered_samples?.department_id === deptId
        );
      }

      setNotes(results);
    } catch(e) {
      console.error('NotificationBell crash:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();

    // Realtime — listen for new OOS results
    const sub = supabase
      .channel('oos_bell_' + (user?.id || 'g'))
      .on('postgres_changes',
        {
          event : 'UPDATE',
          schema: 'public',
          table : 'sample_test_assignments',
        },
        (payload) => {
          const oos =
            payload.new.result_status === 'fail_low' ||
            payload.new.result_status === 'fail_high';
          if (oos) {
            loadNotifications();
          }
        }
      )
      .subscribe();

    return () => sub.unsubscribe();
  }, [user, departmentId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const unread = notes.length;

  const getStatusLabel = (status) => {
    if (status === 'fail_low')  return { text:'LOW',  color:'#DC2626', bg:'#FEF2F2' };
    if (status === 'fail_high') return { text:'HIGH', color:'#DC2626', bg:'#FEF2F2' };
    return { text:'OOS', color:'#DC2626', bg:'#FEF2F2' };
  };

  return (
    <div ref={dropRef} style={{ position:'relative' }}>

      {/* Bell button */}
      <button
        onClick={() => { setOpen(!open); if (!open) loadNotifications(); }}
        style={{
          position    : 'relative',
          background  : unread > 0
            ? 'rgba(220,38,38,0.2)'
            : 'rgba(255,255,255,0.15)',
          border      : unread > 0
            ? '1.5px solid rgba(220,38,38,0.5)'
            : '1px solid rgba(255,255,255,0.25)',
          borderRadius: '50%',
          width       : '36px',
          height      : '36px',
          cursor      : 'pointer',
          fontSize    : '17px',
          display     : 'flex',
          alignItems  : 'center',
          justifyContent: 'center',
          flexShrink  : 0,
          // Pulse animation when there are OOS results
          animation   : unread > 0 ? 'bellPulse 1.5s infinite' : 'none',
        }}
        title={unread > 0 ? `${unread} out of spec result(s)` : 'No out of spec results'}
      >
        🔔
        {/* Badge */}
        {unread > 0 && (
          <span style={{
            position    : 'absolute',
            top         : '-4px',
            right       : '-4px',
            background  : '#DC2626',
            color       : '#fff',
            borderRadius: '50%',
            width       : '18px',
            height      : '18px',
            display     : 'flex',
            alignItems  : 'center',
            justifyContent: 'center',
            fontSize    : '10px',
            fontWeight  : '900',
            border      : '2px solid #7C3AED',
            lineHeight  : 1,
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position     : 'absolute',
          right        : 0,
          top          : '44px',
          width        : '340px',
          maxWidth     : '90vw',
          background   : '#fff',
          borderRadius : '14px',
          boxShadow    : '0 8px 32px rgba(107,33,168,0.2)',
          border       : `1.5px solid ${PL}`,
          zIndex       : 300,
          overflow     : 'hidden',
        }}>

          {/* Header */}
          <div style={{
            padding      : '12px 16px',
            background   : `linear-gradient(135deg,${P},${PM})`,
            color        : '#fff',
            display      : 'flex',
            alignItems   : 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontWeight:'800', fontSize:'14px' }}>
                ⚠️ Out of Spec Results
              </div>
              <div style={{ fontSize:'11px', color:'#DDD6FE', marginTop:'2px' }}>
                {loading ? 'Loading...' : `${unread} result(s) out of specification`}
              </div>
            </div>
            <button onClick={() => setOpen(false)}
              style={{ background:'none', border:'none', color:'#fff', cursor:'pointer', fontSize:'18px', padding:'2px' }}>
              ✕
            </button>
          </div>

          {/* Notification list */}
          <div style={{ maxHeight:'360px', overflowY:'auto' }}>
            {loading ? (
              <div style={{ padding:'24px', textAlign:'center', color:'#9CA3AF' }}>
                Loading notifications...
              </div>
            ) : notes.length === 0 ? (
              <div style={{ padding:'32px', textAlign:'center', color:'#9CA3AF' }}>
                <div style={{ fontSize:'32px', marginBottom:'8px' }}>✅</div>
                <p style={{ fontWeight:'600', margin:0 }}>All results within specification</p>
                <p style={{ fontSize:'12px', marginTop:'4px' }}>No out of spec results found</p>
              </div>
            ) : (
              notes.map((note, i) => {
                const sl = getStatusLabel(note.result_status);
                return (
                  <div key={note.id} style={{
                    padding     : '12px 16px',
                    borderBottom: i < notes.length-1 ? `1px solid ${PL}` : 'none',
                    background  : '#fff',
                    transition  : 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background='#F5F3FF'}
                  onMouseLeave={e => e.currentTarget.style.background='#fff'}
                  >
                    {/* Sample + test name */}
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'8px' }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:'800', fontSize:'13px', color:'#1F2937', marginBottom:'2px' }}>
                          {note.registered_samples?.sample_name}
                        </div>
                        <div style={{ fontSize:'11px', color:PM, fontFamily:'monospace', marginBottom:'4px' }}>
                          {note.registered_samples?.sample_number}
                        </div>
                      </div>
                      {/* OOS badge */}
                      <span style={{
                        background  : sl.bg,
                        color       : sl.color,
                        borderRadius: '8px',
                        padding     : '3px 8px',
                        fontSize    : '11px',
                        fontWeight  : '800',
                        border      : `1px solid ${sl.color}44`,
                        whiteSpace  : 'nowrap',
                        flexShrink  : 0,
                      }}>
                        {sl.text}
                      </span>
                    </div>

                    {/* Test details */}
                    <div style={{
                      background  : '#FEF2F2',
                      borderRadius: '8px',
                      padding     : '8px 10px',
                      border      : '1px solid #FECACA',
                    }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontWeight:'700', fontSize:'13px', color:'#DC2626' }}>
                          {note.tests?.name}
                        </span>
                        <span style={{ fontWeight:'900', fontSize:'15px', color:'#DC2626' }}>
                          {note.result_value}
                          {note.tests?.unit && (
                            <span style={{ fontSize:'11px', fontWeight:'600', marginLeft:'2px' }}>
                              {note.tests.unit}
                            </span>
                          )}
                        </span>
                      </div>
                      <div style={{ fontSize:'11px', color:'#6B7280', marginTop:'4px', display:'flex', justifyContent:'space-between' }}>
                        <span>
                          {note.result_status === 'fail_low' ? '↓ Result below minimum' : '↑ Result above maximum'}
                        </span>
                        <span>
                          {note.analyst_signature && `by ${note.analyst_signature}`}
                        </span>
                      </div>
                    </div>

                    {/* Time */}
                    {note.submitted_at && (
                      <div style={{ fontSize:'10px', color:'#9CA3AF', marginTop:'5px', textAlign:'right' }}>
                        {format(new Date(note.submitted_at), 'HH:mm · dd MMM yyyy')}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding   : '8px 16px',
            background: '#F5F3FF',
            borderTop : `1px solid ${PL}`,
            fontSize  : '11px',
            color     : '#6B7280',
            display   : 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span>{unread} out of spec result(s)</span>
            <button onClick={loadNotifications}
              style={{ background:'none', border:'none', color:PM, cursor:'pointer', fontSize:'11px', fontWeight:'600', fontFamily:'inherit' }}>
              🔄 Refresh
            </button>
          </div>
        </div>
      )}

      {/* CSS for bell pulse animation */}
      <style>{`
        @keyframes bellPulse {
          0%,100% { transform: scale(1);   }
          25%      { transform: scale(1.15) rotate(-10deg); }
          50%      { transform: scale(1);   }
          75%      { transform: scale(1.15) rotate(10deg);  }
        }
      `}</style>
    </div>
  );
}
