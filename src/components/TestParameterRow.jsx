import React, { useState } from 'react';
import { resultsService }  from '../services/results.service';
import { toast }           from 'react-toastify';

// ── List of analysts and samplers in your lab ─────────────
// ADD or REMOVE names here to match your actual staff
const LAB_STAFF = [
  // Analysts
  'Select analyst / sampler...',
  '── ANALYSTS ──',
  'Santos',
  'Allan',
  'Stuart',
  'Maria',
  'Sam',
  'Emma',
  'Joshua',
  'Lily',
  'Quraish',
  'Kato',
  'Azizi',
  'Magezi',
  'Charles',
  'Florence',
  '── SAMPLERS ──',
  'Brian',
  'Sseki',
  'Mubiito',
  'Rubongoya',
  'Viola',
];

export default function TestParameterRow({
  assignment,
  test,
  specification,
  signingAs,
  onResultSubmitted,
}) {
  const [value,      setValue]      = useState(assignment?.result_value || '');
  const [analyst,    setAnalyst]    = useState(signingAs || '');
  const [editing,    setEditing]    = useState(false);
  const [saving,     setSaving]     = useState(false);

  const hasResult = assignment?.result_value !== null &&
                    assignment?.result_value !== undefined;
  const isLocked  = assignment?.is_locked;
  const editsLeft = hasResult ? Math.max(0, 2 - (assignment?.edit_count || 0)) : null;

  // ── Live result evaluation ────────────────────────────────
  const evaluate = (val) => {
    if (!val || !specification) return null;
    const num   = parseFloat(val);
    const isNum = !isNaN(num);

    if (!isNum) {
      return {
        status : 'text',
        remarks: '—',
        action : 'Recorded',
        rowBg  : '#EFF6FF',
        rowBdr : '#BFDBFE',
        valCol : '#1D4ED8',
        badgeBg: '#DBEAFE',
        badgeCol:'#1D4ED8',
      };
    }

    if (num < specification.min_value) return {
      status : 'low',
      remarks: 'LOW',
      action : 'Fail / Adjust',
      rowBg  : '#FEF2F2', rowBdr: '#FECACA',
      valCol : '#DC2626',
      badgeBg: '#FEE2E2', badgeCol: '#DC2626',
    };

    if (num > specification.max_value) return {
      status : 'high',
      remarks: 'HIGH',
      action : 'Fail / Adjust',
      rowBg  : '#FEF2F2', rowBdr: '#FECACA',
      valCol : '#DC2626',
      badgeBg: '#FEE2E2', badgeCol: '#DC2626',
    };

    return {
      status : 'pass',
      remarks: 'OK',
      action : 'Pass',
      rowBg  : '#F0FDF4', rowBdr: '#86EFAC',
      valCol : '#16A34A',
      badgeBg: '#DCFCE7', badgeCol: '#16A34A',
    };
  };

  const ev = evaluate(value);

  const handleSubmit = async () => {
    if (!value.toString().trim()) {
      toast.warning('Please enter a result value'); return;
    }
    if (!analyst || analyst === 'Select analyst / sampler...' || analyst.startsWith('──')) {
      toast.error('Please select the analyst responsible for this result'); return;
    }
    setSaving(true);
    try {
      const res = await resultsService.submitResult(
        assignment.id,
        value.toString(),
        analyst
      );
      toast.success(`✅ ${test.name}: ${res.remarks} — ${res.action}`);
      setEditing(false);
      onResultSubmitted && onResultSubmitted(res);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit result');
    } finally {
      setSaving(false);
    }
  };

  const specText = specification
    ? `(${specification.display_spec || `${specification.min_value} – ${specification.max_value}`})`
    : '';

  const showInput = !hasResult || editing;

  // Inline styles to avoid Tailwind animation bugs
  const rowStyle = {
    border: `1.5px solid ${ev ? ev.rowBdr : '#E5E7EB'}`,
    borderRadius: '12px',
    padding: '12px',
    marginBottom: '10px',
    background: ev ? ev.rowBg : '#ffffff',
    pointerEvents: 'auto',
  };
  const inputSt = {
    flex: 1, border: '1.5px solid #D1D5DB',
    borderRadius: '8px', padding: '9px 12px',
    fontSize: '14px', fontFamily: 'inherit',
    background: '#fff', color: ev?.valCol || '#111827',
    fontWeight: ev ? '700' : '400',
    cursor: 'text', pointerEvents: 'auto',
    boxSizing: 'border-box', minWidth: 0,
  };
  const selectSt = {
    flex: 1, border: '1.5px solid #D1D5DB',
    borderRadius: '8px', padding: '9px 12px',
    fontSize: '13px', fontFamily: 'inherit',
    background: '#fff', color: '#374151',
    cursor: 'pointer', pointerEvents: 'auto',
    boxSizing: 'border-box', minWidth: 0,
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 10px center',
    paddingRight: '30px',
  };
  const submitBtn = {
    background: saving ? '#93A3B8' : '#003087',
    color: '#fff', border: 'none', borderRadius: '8px',
    padding: '9px 16px', fontSize: '13px', fontWeight: '600',
    cursor: saving ? 'not-allowed' : 'pointer',
    whiteSpace: 'nowrap', fontFamily: 'inherit',
    flexShrink: 0, pointerEvents: 'auto',
  };

  return (
    <div style={rowStyle}>

      {/* ── Header: test name + spec + unit ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline',
                    gap: '6px', marginBottom: '10px' }}>
        <span style={{ fontSize: '14px', fontWeight: '600', color: '#1F2937' }}>
          {test.name}
        </span>
        {specText && (
          <span style={{ fontSize: '12px', color: '#6B7280' }}>{specText}</span>
        )}
        {test.unit && (
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#003087' }}>
            {test.unit}
          </span>
        )}
        {isLocked && (
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#9CA3AF' }}>
            🔒 Locked (audit)
          </span>
        )}
        {!isLocked && editsLeft !== null && (
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#9CA3AF' }}>
            {editsLeft} edit{editsLeft !== 1 ? 's' : ''} remaining
          </span>
        )}
      </div>

      {/* ── Result input row ── */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap',
                    alignItems: 'center', marginBottom: '8px' }}>

        {/* Result value input */}
        {showInput && !isLocked ? (
          <input
            type={test.result_type === 'numerical' ? 'number' : 'text'}
            value={value}
            onChange={e => setValue(e.target.value)}
            step="0.01"
            placeholder={test.result_type === 'numerical' ? '0.00' : 'Type result...'}
            style={inputSt}
          />
        ) : (
          <div style={{
            flex: 1, padding: '9px 12px', borderRadius: '8px',
            background: isLocked ? '#F3F4F6' : (ev?.rowBg || '#F9FAFB'),
            border: '1.5px solid ' + (isLocked ? '#E5E7EB' : (ev?.rowBdr || '#E5E7EB')),
            fontSize: '14px', fontWeight: '700',
            color: ev?.valCol || '#374151', minWidth: 0,
          }}>
            {value || assignment?.result_value || '—'}
            {test.unit && (
              <span style={{ fontSize: '12px', fontWeight: '400',
                             color: '#9CA3AF', marginLeft: '4px' }}>
                {test.unit}
              </span>
            )}
          </div>
        )}

        {/* Remarks + Action pill */}
        {ev && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px',
                        flexShrink: 0 }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: ev.valCol }}>
              {ev.remarks}
            </span>
            <span style={{
              fontSize: '11px', fontWeight: '600',
              background: ev.badgeBg, color: ev.badgeCol,
              padding: '3px 8px', borderRadius: '20px',
            }}>
              {ev.action}
            </span>
          </div>
        )}
      </div>

      {/* ── Analyst selector + Submit (only shown before submission) ── */}
      {showInput && !isLocked && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap',
                      alignItems: 'center' }}>

          {/* Analyst dropdown */}
          <select
            value={analyst}
            onChange={e => setAnalyst(e.target.value)}
            style={selectSt}
          >
            {LAB_STAFF.map((name, i) => {
              const isHeader = name.startsWith('──');
              return (
                <option
                  key={i}
                  value={name}
                  disabled={isHeader || name === 'Select analyst / sampler...'}
                  style={{ fontWeight: isHeader ? '700' : '400',
                           color: isHeader ? '#6B7280' : '#111827' }}
                >
                  {name}
                </option>
              );
            })}
          </select>

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={saving || !value.toString().trim()}
            style={submitBtn}
          >
            {saving ? 'Saving...' : hasResult ? '✏️ Update' : '✅ Submit'}
          </button>
        </div>
      )}

      {/* ── Edit button (after submission, if edits remain) ── */}
      {hasResult && !editing && !isLocked && editsLeft > 0 && (
        <div style={{ marginTop: '8px' }}>
          <button
            onClick={() => setEditing(true)}
            style={{
              background: 'none', border: '1.5px solid #D1D5DB',
              borderRadius: '8px', padding: '6px 14px',
              fontSize: '12px', color: '#6B7280',
              cursor: 'pointer', fontFamily: 'inherit',
              pointerEvents: 'auto',
            }}
          >
            ✏️ Edit Result
          </button>
        </div>
      )}

      {/* ── Submitted by signature ── */}
      {assignment?.analyst_signature && !editing && (
        <div style={{ marginTop: '8px', fontSize: '11px', color: '#9CA3AF',
                      display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>✍️</span>
          <strong>{assignment.analyst_signature}</strong>
          {assignment.submitted_at && (
            <span>— {new Date(assignment.submitted_at).toLocaleString()}</span>
          )}
        </div>
      )}

      {/* ── Out of spec warning ── */}
      {ev && (ev.status === 'low' || ev.status === 'high') && showInput && (
        <div style={{
          marginTop: '8px', background: '#FEF2F2',
          border: '1.5px solid #FECACA', borderRadius: '8px',
          padding: '8px 12px', fontSize: '12px', color: '#DC2626',
        }}>
          ⚠️ Result is outside specification range. Department will be notified automatically.
        </div>
      )}
    </div>
  );
}