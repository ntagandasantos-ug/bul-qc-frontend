import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../context/AuthContext';
import StatusBadge     from './StatusBadge';
import { format }      from 'date-fns';
import { ChevronRight, User, Clock } from 'lucide-react';

export default function SampleCard({ sample }) {
  const navigate   = useNavigate();
  const { isDeptHead } = useAuth();

  const borderColor = {
    pending    : 'border-gray-300',
    in_progress: 'border-orange-400',
    complete   : 'border-green-500',
  }[sample.status] || 'border-gray-300';

  const handleClick = () => {
    if (!isDeptHead) navigate(`/analysis/${sample.id}`);
  };

  return (
    <div
      onClick={handleClick}
      className={`bg-white rounded-xl border-l-4 ${borderColor} shadow-sm p-4
                  transition-all duration-200 animate-fade-in
                  ${!isDeptHead
                    ? 'cursor-pointer hover:shadow-md hover:translate-x-1'
                    : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: sample info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 text-sm truncate">
              {sample.sample_name}
            </h3>
            <StatusBadge status={sample.status} size="sm" />
          </div>

          <p className="text-xs text-bul-blue font-medium mt-0.5">
            {sample.sample_number}
          </p>

          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
            <span className="text-xs text-gray-500">
              {sample.sample_types?.sample_categories?.name}
              {' › '}
              {sample.sample_types?.name}
            </span>
            {sample.brands && (
              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5
                               rounded-full font-medium">
                {sample.brands.name}
              </span>
            )}
            {sample.sample_subtypes && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5
                               rounded-full font-medium">
                {sample.sample_subtypes.name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <User size={11} />
              {sample.app_users?.full_name}
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Clock size={11} />
              {format(new Date(sample.registered_at), 'dd MMM, HH:mm')}
            </span>
          </div>
        </div>

        {/* Right arrow (for non-dept heads) */}
        {!isDeptHead && (
          <ChevronRight size={18} className="text-gray-300 flex-shrink-0 mt-1" />
        )}
      </div>
    </div>
  );
}