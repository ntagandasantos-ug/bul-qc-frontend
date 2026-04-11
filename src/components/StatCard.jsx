import React from 'react';

export default function StatCard({ label, value, color, icon }) {
  const colors = {
    gray  : 'bg-gray-100   text-gray-600   border-gray-200',
    orange: 'bg-orange-100 text-orange-700 border-orange-200',
    green : 'bg-green-100  text-green-700  border-green-200',
    red   : 'bg-red-100    text-red-600    border-red-200',
    blue  : 'bg-blue-100   text-bul-blue   border-blue-200',
  };

  return (
    <div className={`rounded-xl p-3 border ${colors[color] || colors.gray}
                     text-center animate-fade-in`}>
      {icon && <div className="text-xl mb-1">{icon}</div>}
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs mt-0.5 font-medium">{label}</div>
    </div>
  );
}