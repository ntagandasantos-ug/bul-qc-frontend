import React, { useState, useEffect, useCallback } from 'react';
import Navbar         from '../components/Navbar';
import PageFooter     from '../components/PageFooter';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth }    from '../context/AuthContext';
import { lookupService } from '../services/lookup.service';
import { supabase }   from '../services/supabase';
import api            from '../services/api';
import { toast }      from 'react-toastify';
import { format }     from 'date-fns';

export default function ReportsPage() {
  const { user } = useAuth();

  const [depts,       setDepts]       = useState([]);
  const [selDept,     setSelDept]     = useState('');
  const [dateFilter,  setDateFilter]  = useState(format(new Date(),'yyyy-MM-dd'));
  const [samples,     setSamples]     = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [expandedId,  setExpandedId]  = useState(null);
  const [comments,    setComments]    = useState({});   // sampleId → array
  const [commentText, setCommentText] = useState({});   // assignmentId → text
  const [saving,      setSaving]      = useState({});

  useEffect(() => {
    lookupService.getDepartments()
      .then(d => setDepts(d || []))
      .catch(() => {});
  }, []);

  const loadResults = useCallback(async () => {
    if (!selDept) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('registered_samples')
        .select(`
          id, sample_name, sample_number, status,
          registered_at, sampler_name,
          brands(name), sample_subtypes(name),
          sample_types(name, sample_categories(name)),
          app_users!registered_by(full_name),
          sample_test_assignments(
            id, result_value, result_numeric,
            result_status, remarks, action,
            analyst_signature, submitted_at,
            edit_count, is_locked,
            tests(id, name, unit, display_order)
          )
        `)
        .eq('department_id', selDept)
        .gte('registered_at', dateFilter + 'T00:00:00')
        .lte('registered_at', dateFilter + 'T23:59:59')
        .order('registered_at', { ascending: false });

      if (error) throw error;
      setSamples(data || []);

      // Load comments for all samples
      if (data?.length) {
        const ids = data.map(s => s.id);
        const { data: cmts } = await supabase
          .from('result_comments')
          .select(`
            *, app_users!commented_by(full_name)
          `)
          .in('sample_id', ids)
          .order('commented_at', { ascending: false });

        const grouped = {};
        for (const c of cmts || []) {
          if (!grouped[c.sample_id]) grouped[c.sample_id] = [];
          grouped[c.sample_id].push(c);
        }
        setComments(grouped);
      }
    } catch (e) {
      toast.error('Failed to load results');
    } finally {
      setLoading(false);
    }
  }, [selDept, dateFilter]);

  useEffect(() => { loadResults(); }, [loadResults]);

  // Add a comment
  const addComment = async (sampleId, assignmentId) => {
    const text = commentText[assignmentId || sampleId]?.trim();
    if (!text) { toast.warning('Enter a comment first'); return; }

    setSaving(prev => ({ ...prev, [assignmentId || sampleId]: true }));
    try {
      const { data: cmt, error } = await supabase
        .from('result_comments')
        .insert({
          sample_id    : sampleId,
          assignment_id: assignmentId || null,
          comment      : text,
          commented_by : user.id,
          department_id: selDept,
        })
        .select(`*, app_users!commented_by(full_name)`)
        .single();

      if (error) throw error;

      // Notify all supervisors who worked on this sample
      await notifySupervisors(sampleId, text, cmt.id);

      setComments(prev => ({
        ...prev,
        [sampleId]: [cmt, ...(prev[sampleId] || [])],
      }));
      setCommentText(prev => ({ ...prev, [assignmentId || sampleId]: '' }));
      toast.success('Comment added and supervisors notified');
    } catch (e) {
      toast.error('Failed to add comment');
    } finally {
      setSaving(prev => ({ ...prev, [assignmentId || sampleId]: false }));
    }
  };

  // Notify supervisors
  const notifySupervisors = async (sampleId, commentText, commentId) => {
    try {
      // Find the shift that worked on this sample
      const { data: sample } = await supabase
        .from('registered_samples')
        .select('shift_id, shifts(supervisor_id)')
        .eq('id', sampleId)
        .single();

      if (!sample?.shifts?.supervisor_id) return;

      await supabase.from('supervisor_notifications').insert({
        shift_supervisor_id: sample.shifts.supervisor_id,
        comment_id         : commentId,
        sample_id          : sampleId,
        title              : '📋 QC Review Comment',
        message            : `${user.full_name} commented: "${commentText.substring(0,100)}${commentText.length > 100 ? '...' : ''}"`,
        from_user_id       : user.id,
      });
    } catch (e) {
      console.error('Notify supervisors error:', e);
    }
  };

  // Sign off a sample
  const signOff = async (sampleId) => {
    try {
      // Insert a sign-off comment
      const { data: cmt } = await supabase
        .from('result_comments')
        .insert({
          sample_id    : sampleId,
          comment      : `✅ Signed off by ${user.full_name} at ${format(new Date(),'HH:mm dd/MM/yyyy')}`,
          commented_by : user.id,
          is_signed_off: true,
          signed_off_at: new Date().toISOString(),
          department_id: selDept,
        })
        .select(`*, app_users!commented_by(full_name)`)
        .single();

      setComments(prev => ({
        ...prev,
        [sampleId]: [cmt, ...(prev[sampleId] || [])],
      }));
      toast.success('Sample results signed off successfully');
    } catch (e) {
      toast.error('Failed to sign off');
    }
  };

  // Result cell colour
  const rColor = (status) => ({
    pass     : '#16A34A', fail_low: '#DC2626',
    fail_high: '#DC2626', text_ok : '#1D4ED8',
    ok       : '#16A34A',
  })[status] || '#374151';

  const rBg = (status) => ({
    pass     : '#F0FDF4', fail_low: '#FEF2F2',
    fail_high: '#FEF2F2', text_ok : '#EFF6FF',
    ok       : '#F0FDF4',
  })[status] || '#F9FAFB';

  return (
    <div style={{ minHeight: '100vh', background: '#FAF5FF', paddingBottom: '60px' }}>
      <Navbar />

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px 16px' }}>

        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '800',
                       color: '#1F2937', margin: '0 0 4px' }}>
            📋 Results Reports
          </h2>
          <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>
            Review, comment, and sign off on department results
          </p>
        </div>

        {/* Filters */}
        <div style={{
          background: '#fff', borderRadius: '16px',
          border: '1.5px solid #E9D5FF', padding: '16px',
          marginBottom: '20px',
          display: 'flex', gap: '12px', flexWrap: 'wrap',
          alignItems: 'flex-end',
        }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ display: 'block', fontSize: '12px',
                            fontWeight: '700', color: '#4C1D95',
                            marginBottom: '6px' }}>
              Department
            </label>
            <select
              value={selDept}
              onChange={e => setSelDept(e.target.value)}
              style={{
                width: '100%', border: '1.5px solid #E9D5FF',
                borderRadius: '10px', padding: '10px 14px',
                fontSize: '14px', fontFamily: 'inherit',
                background: '#FAFAFA', cursor: 'pointer',
              }}
            >
              <option value="">— Select Department —</option>
              {depts.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px',
                            fontWeight: '700', color: '#4C1D95',
                            marginBottom: '6px' }}>
              Date
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              style={{
                border: '1.5px solid #E9D5FF',
                borderRadius: '10px', padding: '10px 14px',
                fontSize: '14px', fontFamily: 'inherit',
                background: '#FAFAFA', cursor: 'pointer',
              }}
            />
          </div>

          <button
            onClick={loadResults}
            disabled={!selDept}
            style={{
              padding: '10px 20px',
              background: selDept ? '#7C3AED' : '#A78BFA',
              color: '#fff', border: 'none', borderRadius: '10px',
              fontSize: '13px', fontWeight: '700',
              cursor: selDept ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
            }}
          >
            🔍 Load Results
          </button>
        </div>

        {/* Results */}
        {loading ? (
          <LoadingSpinner text="Loading results..." />
        ) : !selDept ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#9CA3AF' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📊</div>
            <p style={{ fontWeight: '600' }}>Select a department to view results</p>
          </div>
        ) : samples.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#9CA3AF' }}>
            <p style={{ fontWeight: '600' }}>No results found for this date</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {samples.map(sample => {
              const isExpanded = expandedId === sample.id;
              const sampleComments = comments[sample.id] || [];
              const isSignedOff = sampleComments.some(c => c.is_signed_off);
              const sortedTests = [...(sample.sample_test_assignments || [])]
                .sort((a,b) => (a.tests?.display_order||0) - (b.tests?.display_order||0));

              return (
                <div key={sample.id} style={{
                  background: '#fff', borderRadius: '16px',
                  border: isSignedOff
                    ? '2px solid #86EFAC'
                    : '1.5px solid #E9D5FF',
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(107,33,168,0.06)',
                }}>
                  {/* Sample header row */}
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : sample.id)}
                    style={{
                      padding: '14px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: isExpanded ? '#F5F3FF' : '#fff',
                      borderBottom: isExpanded ? '1px solid #E9D5FF' : 'none',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center',
                                    gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: '700', color: '#1F2937',
                                       fontSize: '14px' }}>
                          {sample.sample_name}
                        </span>
                        <span style={{
                          fontSize: '11px', color: '#7C3AED',
                          background: '#F5F3FF', padding: '1px 8px',
                          borderRadius: '10px', fontWeight: '600',
                        }}>
                          {sample.sample_number}
                        </span>
                        <span style={{
                          fontSize: '11px', padding: '1px 8px',
                          borderRadius: '10px', fontWeight: '600',
                          background:
                            sample.status === 'complete' ? '#F0FDF4' :
                            sample.status === 'in_progress' ? '#FFF7ED' : '#F9FAFB',
                          color:
                            sample.status === 'complete' ? '#16A34A' :
                            sample.status === 'in_progress' ? '#EA580C' : '#6B7280',
                        }}>
                          {sample.status}
                        </span>
                        {isSignedOff && (
                          <span style={{
                            fontSize: '11px', background: '#F0FDF4',
                            color: '#16A34A', padding: '1px 8px',
                            borderRadius: '10px', fontWeight: '700',
                          }}>
                            ✅ Signed Off
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '3px' }}>
                        Registered: {format(new Date(sample.registered_at), 'HH:mm')}
                        {sample.sampler_name && ` • Sampler: ${sample.sampler_name}`}
                        {' '}• {sample.sample_types?.sample_categories?.name}
                        {' › '}{sample.sample_types?.name}
                      </div>
                    </div>
                    <span style={{ fontSize: '16px', color: '#7C3AED' }}>
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div style={{ padding: '16px' }}>

                      {/* Results table */}
                      <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
                        <table style={{
                          width: '100%', borderCollapse: 'collapse',
                          fontSize: '13px',
                        }}>
                          <thead>
                            <tr style={{
                              background: '#F5F3FF',
                              borderBottom: '2px solid #E9D5FF',
                            }}>
                              {['Parameter', 'Unit', 'Specification',
                                'Result', 'Remarks', 'Action',
                                'Analyst', 'Time'].map(h => (
                                <th key={h} style={{
                                  padding: '8px 12px', textAlign: 'left',
                                  fontSize: '11px', fontWeight: '700',
                                  color: '#4C1D95', whiteSpace: 'nowrap',
                                }}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sortedTests.map(ta => (
                              <tr key={ta.id}
                                style={{ borderBottom: '1px solid #F3E8FF' }}>
                                <td style={{ padding: '8px 12px',
                                             fontWeight: '600', color: '#1F2937' }}>
                                  {ta.tests?.name}
                                </td>
                                <td style={{ padding: '8px 12px',
                                             color: '#6B7280', fontSize: '11px' }}>
                                  {ta.tests?.unit || '—'}
                                </td>
                                <td style={{ padding: '8px 12px',
                                             color: '#6B7280', fontSize: '11px' }}>
                                  —
                                </td>
                                <td style={{ padding: '8px 12px' }}>
                                  {ta.result_value ? (
                                    <span style={{
                                      display: 'inline-block',
                                      background: rBg(ta.result_status),
                                      color: rColor(ta.result_status),
                                      padding: '2px 8px', borderRadius: '6px',
                                      fontWeight: '700', fontSize: '13px',
                                    }}>
                                      {ta.result_value}
                                    </span>
                                  ) : (
                                    <span style={{ color: '#D1D5DB' }}>—</span>
                                  )}
                                </td>
                                <td style={{
                                  padding: '8px 12px', fontWeight: '700',
                                  color: ta.remarks === 'OK' ? '#16A34A' : '#DC2626',
                                }}>
                                  {ta.remarks || '—'}
                                </td>
                                <td style={{
                                  padding: '8px 12px', fontWeight: '600',
                                  color: ta.action === 'Pass' ? '#16A34A' : '#DC2626',
                                  fontSize: '12px',
                                }}>
                                  {ta.action || '—'}
                                </td>
                                <td style={{ padding: '8px 12px', fontSize: '11px',
                                             color: '#6B7280' }}>
                                  {ta.analyst_signature || '—'}
                                </td>
                                <td style={{ padding: '8px 12px', fontSize: '11px',
                                             color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                                  {ta.submitted_at
                                    ? format(new Date(ta.submitted_at), 'HH:mm')
                                    : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Comments section */}
                      <div style={{
                        background: '#F5F3FF', borderRadius: '12px',
                        border: '1px solid #DDD6FE', padding: '14px',
                        marginBottom: '12px',
                      }}>
                        <h4 style={{ fontSize: '13px', fontWeight: '700',
                                     color: '#4C1D95', marginBottom: '10px' }}>
                          💬 QC Comments
                        </h4>

                        {/* Existing comments */}
                        {sampleComments.length === 0 ? (
                          <p style={{ fontSize: '12px', color: '#9CA3AF',
                                      marginBottom: '10px' }}>
                            No comments yet. Be the first to comment.
                          </p>
                        ) : (
                          <div style={{ marginBottom: '12px' }}>
                            {sampleComments.map(c => (
                              <div key={c.id} style={{
                                padding: '10px 12px', marginBottom: '6px',
                                background: c.is_signed_off ? '#F0FDF4' : '#fff',
                                borderRadius: '10px',
                                border: c.is_signed_off
                                  ? '1px solid #86EFAC'
                                  : '1px solid #E9D5FF',
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between',
                                              marginBottom: '4px' }}>
                                  <span style={{ fontSize: '12px', fontWeight: '700',
                                                 color: '#4C1D95' }}>
                                    {c.app_users?.full_name}
                                  </span>
                                  <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                                    {format(new Date(c.commented_at), 'HH:mm dd/MM')}
                                  </span>
                                </div>
                                <p style={{ fontSize: '13px', color: '#374151', margin: 0 }}>
                                  {c.comment}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add comment */}
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="text"
                            value={commentText[sample.id] || ''}
                            onChange={e => setCommentText(prev =>
                              ({ ...prev, [sample.id]: e.target.value })
                            )}
                            placeholder="Type your comment here..."
                            style={{
                              flex: 1, border: '1.5px solid #DDD6FE',
                              borderRadius: '8px', padding: '9px 12px',
                              fontSize: '13px', fontFamily: 'inherit',
                              background: '#fff', cursor: 'text',
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') addComment(sample.id, null);
                            }}
                          />
                          <button
                            onClick={() => addComment(sample.id, null)}
                            disabled={saving[sample.id]}
                            style={{
                              background: '#7C3AED', color: '#fff',
                              border: 'none', borderRadius: '8px',
                              padding: '9px 16px', fontSize: '13px',
                              fontWeight: '600', cursor: 'pointer',
                              fontFamily: 'inherit', whiteSpace: 'nowrap',
                            }}
                          >
                            {saving[sample.id] ? '...' : '💬 Comment'}
                          </button>
                        </div>
                      </div>

                      {/* Sign off button */}
                      {!isSignedOff && (
                        <button
                          onClick={() => signOff(sample.id)}
                          style={{
                            background: 'linear-gradient(135deg,#16A34A,#15803D)',
                            color: '#fff', border: 'none',
                            borderRadius: '10px', padding: '10px 20px',
                            fontSize: '13px', fontWeight: '700',
                            cursor: 'pointer', fontFamily: 'inherit',
                            boxShadow: '0 2px 8px rgba(22,163,74,0.3)',
                          }}
                        >
                          ✅ Sign Off These Results
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <PageFooter />
    </div>
  );
}