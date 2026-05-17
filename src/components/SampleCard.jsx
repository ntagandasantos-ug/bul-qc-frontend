// ============================================================
// FILE: frontend/bul-qc-app/src/components/SampleCard.jsx
// UPDATED: Added delete button for pending samples without results
// ============================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../context/AuthContext';
import api             from '../services/api';
import { toast }       from 'react-toastify';
import { format }      from 'date-fns';

const P  = '#6B21A8';
const PM = '#7C3AED';
const PL = '#EDE9FE';
const RD = '#DC2626';

export default function SampleCard({ sample, onDeleted }) {
  const navigate  = useNavigate();
  const { user }  = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [confirm,  setConfirm]  = useState(false);

  const role = user?.roles?.name || '';
  const canDelete =
    (role === 'QC Head' || role === 'QC Assistant' || role === 'Shift Supervisor') &&
    sample.status === 'pending' &&
    !(sample.sample_test_assignments || []).some(a => a.result_value);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/samples/${sample.id}`);
      toast.success(`🗑 ${sample.sample_number} deleted`);
      setConfirm(false);
      if (onDeleted) onDeleted(sample.id);
    } catch(err) {
      toast.error(err.response?.data?.error || 'Failed to delete sample');
    } finally { setDeleting(false); }
  };

  const statusConfig = {
    pending    : { color:'#6B7280', bg:'#F3F4F6', dot:'#9CA3AF', label:'Pending'     },
    in_progress: { color:'#EA580C', bg:'#FFF7ED', dot:'#F97316', label:'In Progress' },
    complete   : { color:'#16A34A', bg:'#F0FDF4', dot:'#22C55E', label:'Complete'    },
    voided     : { color:'#DC2626', bg:'#FEF2F2', dot:'#EF4444', label:'Voided'      },
  }[sample.status] || { color:'#6B7280', bg:'#F3F4F6', dot:'#9CA3AF', label: sample.status };

  const assignments = sample.sample_test_assignments || [];
  const submitted   = assignments.filter(a => a.result_value).length;
  const total       = assignments.length;
  const progress    = total > 0 ? Math.round((submitted / total) * 100) : 0;
  const hasOOS      = assignments.some(a =>
    a.result_status === 'fail_low' || a.result_status === 'fail_high'
  );

  return (
    <div style={{
      background   : '#fff',
      borderRadius : '14px',
      border       : `1.5px solid ${hasOOS ? '#FECACA' : PL}`,
      padding      : '14px 16px',
      boxShadow    : hasOOS
        ? '0 2px 8px rgba(220,38,38,0.1)'
        : '0 1px 4px rgba(107,33,168,0.06)',
      position     : 'relative',
    }}>

      {/* OOS banner */}
      {hasOOS && (
        <div style={{
          position     : 'absolute',
          top          : 0,
          left         : 0,
          right        : 0,
          height       : '3px',
          background   : 'linear-gradient(90deg,#DC2626,#EF4444)',
          borderRadius : '14px 14px 0 0',
        }}/>
      )}

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'10px', flexWrap:'wrap' }}>

        {/* Left — sample info */}
        <div style={{ flex:1, minWidth:'200px' }}>

          {/* Status badge + OOS */}
          <div style={{ display:'flex', gap:'6px', alignItems:'center', marginBottom:'6px', flexWrap:'wrap' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'5px', background:statusConfig.bg, color:statusConfig.color, borderRadius:'20px', padding:'3px 10px', fontSize:'12px', fontWeight:'700' }}>
              <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:statusConfig.dot }}/>
              {statusConfig.label}
            </div>
            {hasOOS && (
              <span style={{ background:'#FEF2F2', color:RD, borderRadius:'20px', padding:'3px 10px', fontSize:'12px', fontWeight:'700', border:'1px solid #FECACA' }}>
                ⚠️ OOS
              </span>
            )}
            {sample.status === 'voided' && (
              <span style={{ background:'#FEF2F2', color:RD, borderRadius:'20px', padding:'3px 10px', fontSize:'12px', fontWeight:'700' }}>
                ❌ Voided
              </span>
            )}
          </div>

          {/* Sample name */}
          <div style={{ fontWeight:'800', fontSize:'15px', color:'#1F2937', marginBottom:'2px' }}>
            {sample.sample_name}
          </div>

          {/* Sample number */}
          <div style={{ fontSize:'12px', color:PM, fontFamily:'monospace', fontWeight:'700', marginBottom:'6px' }}>
            {sample.sample_number}
          </div>

          {/* Tags */}
          <div style={{ display:'flex', gap:'5px', flexWrap:'wrap', marginBottom:'8px' }}>
            {sample.departments?.name && (
              <span style={{ fontSize:'11px', background:'#F5F3FF', color:P, padding:'2px 8px', borderRadius:'6px', fontWeight:'600' }}>
                {sample.departments.name}
              </span>
            )}
            {sample.sample_types?.name && (
              <span style={{ fontSize:'11px', background:'#F0FDF4', color:'#15803D', padding:'2px 8px', borderRadius:'6px', fontWeight:'600' }}>
                {sample.sample_types.name}
              </span>
            )}
            {sample.sample_subtypes?.name && (
              <span style={{ fontSize:'11px', background:'#FFF7ED', color:'#EA580C', padding:'2px 8px', borderRadius:'6px', fontWeight:'600' }}>
                {sample.sample_subtypes.name}
              </span>
            )}
            {sample.batch_number && (
              <span style={{ fontSize:'11px', background:'#F9FAFB', color:'#6B7280', padding:'2px 8px', borderRadius:'6px', fontWeight:'600' }}>
                Batch: {sample.batch_number}
              </span>
            )}
          </div>

          {/* Progress bar */}
          {total > 0 && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', color:'#6B7280', marginBottom:'3px' }}>
                <span>{submitted}/{total} tests submitted</span>
                <span>{progress}%</span>
              </div>
              <div style={{ background:'#F3F4F6', borderRadius:'4px', height:'5px', overflow:'hidden' }}>
                <div style={{ width:`${progress}%`, height:'100%', background:hasOOS?RD:`linear-gradient(90deg,${P},${PM})`, borderRadius:'4px', transition:'width 0.3s' }}/>
              </div>
            </div>
          )}

          {/* Date / sampler */}
          <div style={{ fontSize:'11px', color:'#9CA3AF', marginTop:'7px', display:'flex', gap:'10px', flexWrap:'wrap' }}>
            {sample.registered_at && (
              <span>📅 {format(new Date(sample.registered_at),'dd MMM yyyy HH:mm')}</span>
            )}
            {sample.sampler_name && (
              <span>✍️ {sample.sampler_name}</span>
            )}
          </div>
        </div>

        {/* Right — action buttons */}
        <div style={{ display:'flex', flexDirection:'column', gap:'6px', flexShrink:0 }}>

          {/* Analyse button */}
          {sample.status !== 'voided' && (
            <button onClick={() => navigate(`/analysis/${sample.id}`)}
              style={{
                padding    : '8px 18px',
                background : sample.status==='complete'
                  ? '#F0FDF4'
                  : `linear-gradient(135deg,${P},${PM})`,
                color      : sample.status==='complete' ? '#15803D' : '#fff',
                border     : sample.status==='complete' ? '1.5px solid #86EFAC' : 'none',
                borderRadius: '9px',
                fontSize   : '13px',
                fontWeight : '700',
                cursor     : 'pointer',
                fontFamily : 'inherit',
                whiteSpace : 'nowrap',
              }}>
              {sample.status==='complete' ? '✅ View Results' : sample.status==='in_progress' ? '🔬 Continue' : '🔬 Analyse'}
            </button>
          )}

          {/* DELETE button — only for pending samples with no results */}
          {canDelete && !confirm && (
            <button onClick={() => setConfirm(true)}
              style={{ padding:'6px 14px', background:'#FEF2F2', color:RD, border:'1.5px solid #FECACA', borderRadius:'9px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
              🗑 Delete
            </button>
          )}

          {/* Confirm delete */}
          {confirm && (
            <div style={{ background:'#FEF2F2', border:'1.5px solid #FECACA', borderRadius:'10px', padding:'10px 12px', maxWidth:'200px' }}>
              <p style={{ fontSize:'12px', color:RD, fontWeight:'700', margin:'0 0 8px' }}>
                Permanently delete {sample.sample_number}?
              </p>
              <div style={{ display:'flex', gap:'6px' }}>
                <button onClick={handleDelete} disabled={deleting}
                  style={{ flex:1, padding:'6px', background:RD, color:'#fff', border:'none', borderRadius:'7px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>
                  {deleting ? '...' : 'Yes, Delete'}
                </button>
                <button onClick={() => setConfirm(false)}
                  style={{ flex:1, padding:'6px', background:'#F3F4F6', color:'#374151', border:'none', borderRadius:'7px', fontSize:'12px', cursor:'pointer', fontFamily:'inherit' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
