import React, { useState, useEffect } from 'react';
import { Bell, X, AlertTriangle } from 'lucide-react';
import { dashboardService }        from '../services/dashboard.service';
import { supabase }                from '../services/supabase';
import { format }                  from 'date-fns';

export default function NotificationBell({ departmentId }) {
  const [notifications, setNotifications] = useState([]);
  const [open,          setOpen]          = useState(false);

  const unread = notifications.filter(n => !n.is_read).length;

  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.8);
    } catch (e) { /* audio not supported */ }
  };

  useEffect(() => {
    loadNotifications();

    const sub = supabase
      .channel('notifications_live')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          if (payload.new.target_department_id === departmentId) {
            setNotifications(prev => [payload.new, ...prev]);
            playBeep(); // 🔔 Beep on out-of-spec!
          }
        }
      )
      .subscribe();

    return () => sub.unsubscribe();
  }, [departmentId]);

  const loadNotifications = async () => {
    try {
      const data = await dashboardService.getNotifications();
      setNotifications(data || []);
    } catch (e) { /* ignore */ }
  };

  const handleOpen = async () => {
    setOpen(!open);
    if (!open && unread > 0) {
      await dashboardService.markNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg hover:bg-white/20 transition-colors"
      >
        <Bell size={20} className="text-white" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500
                           text-white text-xs rounded-full flex items-center
                           justify-center font-bold animate-pulse">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 bg-white rounded-xl
                        shadow-2xl border border-gray-100 z-50 animate-slide-in">
          <div className="flex items-center justify-between px-4 py-3
                          border-b border-gray-100">
            <h3 className="font-semibold text-gray-800 text-sm">Notifications</h3>
            <button onClick={() => setOpen(false)}>
              <X size={16} className="text-gray-400 hover:text-gray-600" />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">
                No notifications yet
              </p>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-gray-50 last:border-0
                    ${!n.is_read ? 'bg-red-50' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle
                      size={14}
                      className={n.type === 'out_of_spec' ? 'text-red-500 mt-0.5' : 'text-blue-400 mt-0.5'}
                    />
                    <div>
                      <p className="text-xs font-semibold text-gray-800">{n.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                      <p className="text-xs text-gray-300 mt-1">
                        {format(new Date(n.created_at), 'dd MMM HH:mm')}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}