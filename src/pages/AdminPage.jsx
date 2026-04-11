import React, { useState } from 'react';
import Navbar       from '../components/Navbar';
import { useAuth }  from '../context/AuthContext';
import { authService } from '../services/auth.service';
import { toast }    from 'react-toastify';
import { Settings, Key, Shield, Info } from 'lucide-react';

export default function AdminPage() {
  const { user }     = useAuth();
  const [oldPass,    setOldPass]    = useState('');
  const [newPass,    setNewPass]    = useState('');
  const [confirmPass,setConfirmPass]= useState('');
  const [saving,     setSaving]     = useState(false);
  const [tab,        setTab]        = useState('info');

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPass !== confirmPass) {
      toast.error('New passwords do not match'); return;
    }
    if (newPass.length < 8) {
      toast.error('Password must be at least 8 characters'); return;
    }
    setSaving(true);
    try {
      await authService.changePassword(oldPass, newPass);
      toast.success('Password changed successfully');
      setOldPass(''); setNewPass(''); setConfirmPass('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = `w-full border border-gray-300 rounded-xl px-4 py-3 text-sm
    focus:border-bul-blue text-gray-900`;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-5">

        <div className="flex items-center gap-2 mb-5">
          <Settings size={22} className="text-bul-blue" />
          <h2 className="text-lg font-bold text-gray-900">Admin Panel</h2>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl overflow-hidden border border-gray-200 mb-5">
          {[
            { key: 'info',     label: 'System Info',     icon: <Info size={14} />     },
            { key: 'password', label: 'Change Password', icon: <Key  size={14} />     },
            { key: 'access',   label: 'Roles',           icon: <Shield size={14} />   },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3
                          text-xs font-semibold transition-colors
                          ${tab === t.key
                            ? 'bg-bul-blue text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* System info tab */}
        {tab === 'info' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5
                          space-y-4">
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">System Information</h3>
              {[
                ['System Name',   'BUL QC App — LIMS v1.0'],
                ['Logged in as',  user?.full_name],
                ['Role',          user?.roles?.name],
                ['Department',    user?.departments?.name],
                ['Shift',         user?.shift_name || 'N/A'],
              ].map(([label, value]) => (
                <div key={label}
                     className="flex justify-between py-2 border-b border-gray-50
                                last:border-0">
                  <span className="text-sm text-gray-500">{label}</span>
                  <span className="text-sm font-medium text-gray-800">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Change password tab */}
        {tab === 'password' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Change Your Password</h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              {[
                { label: 'Current Password',  val: oldPass,     set: setOldPass     },
                { label: 'New Password',       val: newPass,     set: setNewPass     },
                { label: 'Confirm New Password',val:confirmPass, set: setConfirmPass },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {label}
                  </label>
                  <input
                    type="password"
                    value={val}
                    onChange={e => set(e.target.value)}
                    className={inputClass}
                    placeholder="••••••••"
                    required
                  />
                </div>
              ))}
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-bul-blue text-white py-3 rounded-xl font-semibold
                           text-sm hover:bg-blue-800 disabled:opacity-40"
              >
                {saving ? 'Saving...' : 'Update Password'}
              </button>
            </form>
          </div>
        )}

        {/* Roles reference tab */}
        {tab === 'access' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Role Permissions</h3>
            <div className="space-y-3">
              {[
                { role: 'QC Head',            color: 'bg-purple-100 text-purple-700', access: 'Full access — all departments, all results, admin panel' },
                { role: 'QC Assistant',       color: 'bg-purple-100 text-purple-700', access: 'Full access — same as QC Head' },
                { role: 'Shift Supervisor',   color: 'bg-blue-100   text-blue-700',   access: 'Full access — register, assign tests, submit results' },
                { role: 'Analyst',            color: 'bg-green-100  text-green-700',  access: 'Register samples, assign tests, submit results' },
                { role: 'Sampler',            color: 'bg-yellow-100 text-yellow-700', access: 'Register samples only' },
                { role: 'Department Head',    color: 'bg-orange-100 text-orange-700', access: 'View-only live dashboard for their department' },
                { role: 'Department Asst',    color: 'bg-orange-100 text-orange-700', access: 'View-only live dashboard for their department' },
              ].map(r => (
                <div key={r.role} className="flex items-start gap-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold
                                    whitespace-nowrap ${r.color}`}>
                    {r.role}
                  </span>
                  <p className="text-xs text-gray-600 mt-1">{r.access}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}