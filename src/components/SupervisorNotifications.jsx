// ============================================================
// FILE: frontend/bul-qc-app/src/components/SupervisorNotifications.jsx
// Shows assignment notifications on supervisor dashboard
// Realtime — updates instantly when QC Head assigns a sample
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth }  from '../context/AuthContext';
import { format }   from 'date-fns';

const P  = '#6B21A8';
const PM = '#7C3AED';
const PL = '#EDE9FE';
const G  = '#FFB81C';

export default function SupervisorNotifications() {
  const { user }              = useAuth();
  const [notes,   setNotes]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [open,    setOpen]    = useState(true);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('qc_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) { console.error(error.message); return; }
      setNotes(data || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();

    // Realtime — new assignment notifications
    const sub = supabase.channel('supervisor_notifs_' + (user?.id||'g'))
      .on('postgres_changes',
        { event:'INSERT', schema:'public', table:'qc_notifications' },
        () => { load(); setOpen(true); }
      ).subscribe();

    return () => sub.unsubscribe();
  }, [load, user]);

  // Mark a notification as read by this user
  const markRead = async (notifId, currentReadBy) => {
    const alreadyRead = (currentReadBy || []).includes(user?.id);
    if (alreadyRead) return;
    await supabase.from('qc_notifications')
      .update({ read_by: [...(currentReadBy||[]), user?.id] })
      .eq('id', notifId);
    setNotes(prev => prev.map(n =>
      n.id === notifId
        ? { ...n, read_by: [...(n.read_by||[]), user?.id] }
        : n
    ));
  };

  const unread = notes.filter(n => !(n.read_by||[]).includes(user?.id)).length;

  if (notes.length === 0 && !loading) return null;

  return (
    <div style={{
      background : '#fff',
      borderRadius: '14px',
      border     : `2px solid ${unread > 0 ? G : PL}`,
      marginBottom: '14px',
      overflow   : 'hidden',
      boxShadow  : unread > 0
        ? '0 2px 12px rgba(255,184,28,0.2)'
        : '0 1px 4px rgba(107,33,168,0.06)',
    }}>

      {/* Header */}
      <div
        onClick={() => setOpen(!open)}
        style={{
          padding        : '11px 16px',
          background     : unread > 0
            ? `linear-gradient(135deg,${G},#D97706)`
            : `linear-gradient(135deg,${P},${PM})`,
          color          : unread > 0 ? '#1F2937' : '#fff',
          display        : 'flex',
          alignItems     : 'center',
          justifyContent : 'space-between',
          cursor         : 'pointer',
        }}
      >
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <span style={{ fontSize:'16px' }}>📋</span>
          <div>
            <div style={{ fontWeight:'800', fontSize:'13px' }}>
              Sample Assignments from QC Head
            </div>
            <div style={{ fontSize:'11px', opacity:0.8 }}>
              {unread > 0
                ? `${unread} new assignment(s) requiring attention`
                : 'All assignments acknowledged'}
            </div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          {unread > 0 && (
            <span style={{
              background    : '#DC2626',
              color         : '#fff',
              borderRadius  : '50%',
              width         : '22px',
              height        : '22px',
              display       : 'flex',
              alignItems    : 'center',
              justifyContent: 'center',
              fontSize      : '11px',
              fontWeight    : '900',
              border        : '2px solid #fff',
            }}>
              {unread}
            </span>
          )}
          <span style={{ fontSize:'12px', opacity:0.7 }}>
            {open ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {/* Notifications list */}
      {open && (
        <div style={{ maxHeight:'320px', overflowY:'auto' }}>
          {loading ? (
            <div style={{ padding:'20px', textAlign:'center', color:'#9CA3AF', fontSize:'13px' }}>
              Loading assignments...
            </div>
          ) : notes.map((n, i) => {
            const isRead = (n.read_by||[]).includes(user?.id);
            return (
              <div key={n.id}
                onClick={() => markRead(n.id, n.read_by)}
                style={{
                  padding      : '12px 16px',
                  borderBottom : i < notes.length-1 ? `1px solid ${PL}` : 'none',
                  background   : isRead ? '#fff' : '#FEFCE8',
                  cursor       : isRead ? 'default' : 'pointer',
                  transition   : 'background 0.15s',
                }}
                onMouseEnter={e => { if(!isRead) e.currentTarget.style.background='#FEF9C3'; }}
                onMouseLeave={e => { if(!isRead) e.currentTarget.style.background='#FEFCE8'; }}
              >
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'8px' }}>
                  <div style={{ flex:1 }}>

                    {/* Title + unread dot */}
                    <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'4px' }}>
                      {!isRead && (
                        <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:G, flexShrink:0, boxShadow:`0 0 4px ${G}` }}/>
                      )}
                      <span style={{ fontWeight:'800', fontSize:'13px', color:'#1F2937' }}>
                        {n.title}
                      </span>
                      {!isRead && (
                        <span style={{ fontSize:'9px', background:'#FEF9C3', color:'#854D0E', padding:'1px 6px', borderRadius:'6px', fontWeight:'800', border:'1px solid #FDE68A' }}>
                          NEW
                        </span>
                      )}
                    </div>

                    {/* Sample info */}
                    <div style={{ fontSize:'12px', color:'#374151', marginBottom:'6px', lineHeight:1.5 }}>
                      {n.message}
                    </div>

                    {/* Details pills */}
                    <div style={{ display:'flex', gap:'5px', flexWrap:'wrap', marginBottom:'5px' }}>
                      {n.sample_number && (
                        <span style={{ fontSize:'10px', fontFamily:'monospace', background:PL, color:P, padding:'2px 7px', borderRadius:'6px', fontWeight:'700' }}>
                          {n.sample_number}
                        </span>
                      )}
                      {n.analyst_names && (
                        <span style={{ fontSize:'10px', background:'#F0FDF4', color:'#15803D', padding:'2px 7px', borderRadius:'6px', fontWeight:'600', border:'1px solid #86EFAC' }}>
                          👤 {n.analyst_names}
                        </span>
                      )}
                    </div>

                    {/* Tests assigned */}
                    {n.test_names && (
                      <div style={{ fontSize:'11px', color:'#6B7280', marginBottom:'4px' }}>
                        <strong>Tests:</strong> {n.test_names}
                      </div>
                    )}

                    {/* Notes */}
                    {n.notes && (
                      <div style={{ fontSize:'11px', color:'#6B7280', fontStyle:'italic', background:'#F9FAFB', borderRadius:'6px', padding:'5px 8px', border:'1px solid #E5E7EB' }}>
                        "{n.notes}"
                      </div>
                    )}
                  </div>

                  {/* Time + read status */}
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontSize:'10px', color:'#9CA3AF' }}>
                      {format(new Date(n.created_at), 'HH:mm')}
                    </div>
                    <div style={{ fontSize:'10px', color:'#9CA3AF', marginTop:'2px' }}>
                      {format(new Date(n.created_at), 'dd MMM')}
                    </div>
                    {!isRead && (
                      <div style={{ fontSize:'9px', color:G, fontWeight:'700', marginTop:'4px' }}>
                        Tap to ack.
                      </div>
                    )}
                  </div>
                </div>

                {/* Assigned by */}
                <div style={{ fontSize:'10px', color:'#9CA3AF', marginTop:'4px' }}>
                  Assigned by <strong>{n.assigned_by_name}</strong>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
