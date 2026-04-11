import React from 'react';

export default function StatusBadge({ status, size = 'md' }) {
  const config = {
    pending: {
      label : 'Pending',
      bg    : 'bg-gray-100',
      text  : 'text-gray-600',
      border: 'border-gray-300',
      dot   : 'bg-gray-400',
    },
    in_progress: {
      label : 'In Progress',
      bg    : 'bg-orange-100',
      text  : 'text-orange-700',
      border: 'border-orange-300',
      dot   : 'bg-orange-500',
    },
    complete: {
      label : 'Complete',
      bg    : 'bg-green-100',
      text  : 'text-green-700',
      border: 'border-green-300',
      dot   : 'bg-green-500',
    },
  };

  const s    = config[status] || config.pending;
  const text = size === 'sm' ? 'text-xs' : 'text-xs';
  const px   = size === 'sm' ? 'px-2 py-0.5' : 'px-3 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${px} rounded-full
                  font-medium border ${s.bg} ${s.text} ${s.border} ${text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}