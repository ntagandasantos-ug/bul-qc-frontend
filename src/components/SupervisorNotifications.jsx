import React, { useState, useEffect } from 'react';
import { useAuth }  from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { format }   from 'date-fns';

export default function SupervisorNotifications() {
  const { user, isSupervisor } = useAuth();
  const [notes, setNotes]  = useState([]);
  const [open,  setOpen]   = useState(false);

  useEffect(() => {
    if (!isSupervisor || !user?.id) return;
    loadNotes();

    const sub = supabase
      .channel('sup_notifs_' + user.id)
      .on('postgres_changes',
        {
          event : 'INSERT', schema: 'public',
          table : 'supervisor_notifications',
          filter: `shift_supervisor_id=eq.${user.id}`,
        },
        payload => {
          setNotes(prev => [payload.new, ...prev]);
          // Play a soft notification sound
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            osc.connect(ctx.destination);
            osc.frequency.value = 520; osc.type = 'sine';
            osc.start(); osc.stop(ctx.currentTime + 0.4);
          } catch(e) {}
        }
      ).subscribe();

    return () => sub.unsubscribe();
  }, [user, isSupervisor]);

  const loadNotes = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('supervisor_notifications')
      .select(`*, app_users!from_user_id(full_name)`)
      .eq('shift_supervisor_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setNotes(data || []);
  };

  const markRead = async () => {
    await supabase
      .from('supervisor_notifications')
      .update({ is_read: true })
      .eq('shift_supervisor_id', user.id)
      .eq('is_read', false);
    setNotes(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  if (!isSupervisor) return null;

  const unread = notes.filter(n => !n.is_read).length;

  return (
    <div style={{ marginBottom: '16px', position: 'relative' }}>
      <button
        onClick={() => { setOpen(!open); if (!open) markRead(); }}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: unread > 0
            ? 'linear-gradient(135deg,#6B21A8,#7C3AED)'
            : '#fff',
          border: '1.5px solid #E9D5FF',
          borderRadius: '12px', padding: '10px 16px',
          cursor: 'pointer', fontFamily: 'inherit',
          color: unread > 0 ? '#fff' : '#374151',
          fontSize: '13px', fontWeight: '600',
          width: '100%', justifyContent: 'space-between',
        }}
      >
        <span>
          💬 QC Comments for your shift
          {unread > 0 && (
            <span style={{
              background: '#FFB81C', color: '#1F2937',
              borderRadius: '10px', padding: '1px 8px',
              fontSize: '11px', marginLeft: '8px', fontWeight: '800',
            }}>
              {unread} new
            </span>
          )}
        </span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{
          marginTop: '8px', background: '#fff',
          borderRadius: '12px', border: '1.5px solid #E9D5FF',
          overflow: 'hidden',
        }}>
          {notes.length === 0 ? (
            <p style={{ padding: '20px', textAlign: 'center',
                        color: '#9CA3AF', fontSize: '13px' }}>
              No comments from QC Head yet
            </p>
          ) : (
            notes.map(n => (
              <div key={n.id} style={{
                padding: '12px 16px',
                borderBottom: '1px solid #F3E8FF',
                background: n.is_read ? '#fff' : '#F5F3FF',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between',
                              marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700',
                                 color: '#4C1D95' }}>
                    {n.app_users?.full_name || 'QC Head'}
                  </span>
                  <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                    {format(new Date(n.created_at), 'HH:mm dd/MM')}
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: '#374151', margin: 0 }}>
                  {n.message}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}