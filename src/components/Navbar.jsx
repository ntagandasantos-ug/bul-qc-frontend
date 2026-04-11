import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FlaskConical, LayoutDashboard, PlusCircle,
  Settings, LogOut, Menu, X, Clock,
} from 'lucide-react';

export default function Navbar() {
  const { user, signingAs, logout, timeLeft, isAdmin, isDeptHead } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [open, setOpen] = useState(false);

  const navItems = [
    {
      label  : 'Dashboard',
      icon   : <LayoutDashboard size={18} />,
      path   : '/dashboard',
      show   : true,
    },
    {
      label  : 'Register Sample',
      icon   : <PlusCircle size={18} />,
      path   : '/register-sample',
      show   : !isDeptHead,
    },
    {
      label  : 'Admin',
      icon   : <Settings size={18} />,
      path   : '/admin',
      show   : isAdmin,
    },
  ];

  const isActive = (path) => location.pathname === path;

  // Time warning colour
  const timeWarning = timeLeft.startsWith('0h 0') || timeLeft.startsWith('0h 1')
    || timeLeft.startsWith('0h 2');

  return (
    <nav className="bg-bul-blue text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">

          {/* Logo + name */}
          <div
            className="flex items-center gap-2 cursor-pointer select-none"
            onClick={() => navigate('/dashboard')}
          >
            <div className="w-8 h-8 bg-bul-gold rounded-lg flex items-center
                            justify-center shadow-sm">
              <FlaskConical size={18} className="text-bul-blue" />
            </div>
            <span className="font-bold text-base tracking-tight">BUL QC App</span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.filter(i => i.show).map(item => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm
                            font-medium transition-colors
                            ${isActive(item.path)
                              ? 'bg-white text-bul-blue'
                              : 'text-blue-100 hover:bg-white/20'}`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>

          {/* Right side — timer + user + logout */}
          <div className="hidden md:flex items-center gap-3">
            {timeLeft && (
              <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg
                ${timeWarning ? 'bg-red-500 text-white animate-pulse' : 'bg-white/15 text-blue-100'}`}>
                <Clock size={12} />
                {timeLeft}
              </div>
            )}

            <div className="text-right">
              <p className="text-xs font-medium leading-none">
                {signingAs || user?.full_name}
              </p>
              <p className="text-xs text-blue-300 leading-none mt-0.5">
                {user?.roles?.name}
                {user?.shift_name ? ` • ${user.shift_name}` : ''}
              </p>
            </div>

            <button
              onClick={logout}
              className="flex items-center gap-1 text-xs bg-white/15
                         hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-blue-900 border-t border-blue-700 px-4 py-3
                        animate-slide-in">
          {/* User info */}
          <div className="mb-3 pb-3 border-b border-blue-700">
            <p className="font-semibold">{signingAs || user?.full_name}</p>
            <p className="text-xs text-blue-300">
              {user?.roles?.name}
              {user?.shift_name ? ` — Shift: ${user.shift_name}` : ''}
            </p>
            {timeLeft && (
              <p className={`text-xs mt-1 flex items-center gap-1
                ${timeWarning ? 'text-red-400' : 'text-blue-300'}`}>
                <Clock size={11} />
                Session: {timeLeft}
              </p>
            )}
          </div>

          {/* Nav links */}
          {navItems.filter(i => i.show).map(item => (
            <button
              key={item.path}
              onClick={() => { navigate(item.path); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg
                          text-sm font-medium mb-1 transition-colors
                          ${isActive(item.path)
                            ? 'bg-white text-bul-blue'
                            : 'text-blue-100 hover:bg-white/20'}`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}

          <button
            onClick={() => { logout(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg
                       text-sm text-red-300 hover:bg-red-900/30 mt-2"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}