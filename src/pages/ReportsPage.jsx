import React, { useState, useEffect, useCallback } from 'react';
import Navbar         from '../components/Navbar';
import PageFooter     from '../components/PageFooter';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth }    from '../context/AuthContext';
import { lookupService } from '../services/lookup.service';
import { supabase }   from '../services/supabase';
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
  const [comments,    setComments]    = useState({});
  const [commentText, setCommentText] = useState({});
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

      if (data?.length) {
        const ids = data.map(s => s.id);
        const { data: cmts } = await supabase
          .from('result_comments')
          .select('*, app_users!commented_by(full_name)')
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

  const addComment = async (sampleId) => {
    const text = commentText[sampleId]?.trim();
    if (!text) { toast.warning('Enter a comment first'); return; }
    setSaving(prev => ({ ...prev, [sampleId]: true }));
    try {
      const { data: cmt, error } = await supabase
        .from('result_comments')
        .insert({
          sample_id    : sampleId,
          comment      : text,
          commented_by : user.id,
          department_id: selDept,
        })
        .select('*, app_users!commented_by(full_name)')
        .single();

      if (error) throw error;

      // Notify supervisors
      const { data: sample } = await supabase
        .from('registered_samples')
        .select('shift_id, shifts(supervisor_id)')
        .eq('id', sampleId)
        .single();

      if (sample?.shifts?.supervisor_id) {
        await supabase.from('supervisor_notifications').insert({
          shift_supervisor_id: sample.shifts.supervisor_id,
          sample_id: sampleId,
          title  : '📋 QC Review Comment',
          message: `${user.full_name} commented: "${text.substring(0,100)}"`,
          from_user_id: user.id,
        });
      }

      setComments(prev => ({
        ...prev,
        [sampleId]: [cmt, ...(prev[sampleId] || [])],
      }));
      setCommentText(prev => ({ ...prev, [sampleId]: '' }));
      toast.success('Comment added. Supervisors notified.');
    } catch (e) {
      toast.error('Failed to add comment');
    } finally {
      setSaving(prev => ({ ...prev, [sampleId]: false }));
    }
  };

  const signOff = async (sampleId) => {
    try {
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
        .select('*, app_users!commented_by(full_name)')
        .single();

      setComments(prev => ({
        ...prev,
        [sampleId]: [cmt, ...(prev[sampleId] || [])],
      }));
      toast.success('Results signed off successfully');
    } catch (e) {
      toast.error('Failed to sign off');
    }
  };

  const rColor = (s) => ({pass:'#16A34A',fail_low:'#DC2626',fail_high:'#DC2626',ok:'#16A34A'})[s]||'#374151';
  const rBg    = (s) => ({pass:'#F0FDF4',fail_low:'#FEF2F2',fail_high:'#FEF2F2',ok:'#F0FDF4'})[s]||'#F9FAFB';

  const inputSt = {
    border:'1.5px solid #E9D5FF', borderRadius:'10px',
    padding:'10px 14px', fontSize:'14px',
    fontFamily:'inherit', background:'#FAFAFA',
    cursor:'text', boxSizing:'border-box',
  };

  return (
    <div style={{ minHeight:'100vh', background:'#FAF5FF', paddingBottom:'60px' }}>
      <Navbar />
      <main style={{ maxWidth:'1200px', margin:'0 auto', padding:'20px 16px' }}>

        <div style={{ marginBottom:'20px' }}>
          <h2 style={{ fontSize:'20px', fontWeight:'800', color:'#1F2937', margin:'0 0 4px' }}>
            📋 Results Reports
          </h2>
          <p style={{ fontSize:'13px', color:'#9CA3AF', margin:0 }}>
            Review, comment and sign off on department results
          </p>
        </div>

        {/* Filters */}
        <div style={{
          background:'#fff', borderRadius:'16px',
          border:'1.5px solid #E9D5FF', padding:'16px',
          marginBottom:'20px', display:'flex',
          gap:'12px', flexWrap:'wrap', alignItems:'flex-end',
        }}>
          <div style={{ flex:1, minWidth:'200px' }}>
            <label style={{ display:'block', fontSize:'12px',
                            fontWeight:'700', color:'#4C1D95', marginBottom:'6px' }}>
              Department
            </label>
            <select value={selDept} onChange={e => setSelDept(e.target.value)}
              style={{ ...inputSt, cursor:'pointer', width:'100%' }}>
              <option value="">— Select Department —</option>
              {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display:'block', fontSize:'12px',
                            fontWeight:'700', color:'#4C1D95', marginBottom:'6px' }}>
              Date
            </label>
            <input type="date" value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              style={{ ...inputSt, cursor:'pointer' }} />
          </div>
          <button onClick={loadResults} disabled={!selDept}
            style={{
              padding:'10px 20px', background: selDept ? '#7C3AED' : '#A78BFA',
              color:'#fff', border:'none', borderRadius:'10px',
              fontSize:'13px', fontWeight:'700',
              cursor: selDept ? 'pointer' : 'not-allowed',
              fontFamily:'inherit',
            }}>
            🔍 Load Results
          </button>
        </div>

        {/* Results */}
        {loading ? <LoadingSpinner text="Loading results..." />
        : !selDept ? (
          <div style={{ textAlign:'center', padding:'60px', color:'#9CA3AF' }}>
            <div style={{ fontSize:'48px', marginBottom:'12px' }}>📊</div>
            <p style={{ fontWeight:'600' }}>Select a department to view results</p>
          </div>
        ) : samples.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px', color:'#9CA3AF' }}>
            <p style={{ fontWeight:'600' }}>No results found for this date</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
            {samples.map(sample => {
              const isExp = expandedId === sample.id;
              const cmts  = comments[sample.id] || [];
              const isSignedOff = cmts.some(c => c.is_signed_off);
              const sorted = [...(sample.sample_test_assignments||[])]
                .sort((a,b)=>(a.tests?.display_order||0)-(b.tests?.display_order||0));

              return (
                <div key={sample.id} style={{
                  background:'#fff', borderRadius:'16px',
                  border: isSignedOff ? '2px solid #86EFAC' : '1.5px solid #E9D5FF',
                  overflow:'hidden',
                  boxShadow:'0 2px 8px rgba(107,33,168,0.06)',
                }}>
                  <div onClick={() => setExpandedId(isExp ? null : sample.id)}
                    style={{
                      padding:'14px 16px', cursor:'pointer',
                      display:'flex', justifyContent:'space-between',
                      alignItems:'center',
                      background: isExp ? '#F5F3FF' : '#fff',
                      borderBottom: isExp ? '1px solid #E9D5FF' : 'none',
                    }}>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                        <span style={{ fontWeight:'700', color:'#1F2937', fontSize:'14px' }}>
                          {sample.sample_name}
                        </span>
                        <span style={{
                          fontSize:'11px', color:'#7C3AED',
                          background:'#F5F3FF', padding:'1px 8px',
                          borderRadius:'10px', fontWeight:'600',
                        }}>
                          {sample.sample_number}
                        </span>
                        {isSignedOff && (
                          <span style={{ fontSize:'11px', background:'#F0FDF4',
                                         color:'#16A34A', padding:'1px 8px',
                                         borderRadius:'10px', fontWeight:'700' }}>
                            ✅ Signed Off
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize:'11px', color:'#9CA3AF', marginTop:'3px' }}>
                        {format(new Date(sample.registered_at), 'HH:mm dd/MM/yyyy')}
                        {sample.sampler_name && ` • Sampler: ${sample.sampler_name}`}
                      </div>
                    </div>
                    <span style={{ fontSize:'16px', color:'#7C3AED' }}>
                      {isExp ? '▲' : '▼'}
                    </span>
                  </div>

                  {isExp && (
                    <div style={{ padding:'16px' }}>
                      {/* Results table */}
                      <div style={{ overflowX:'auto', marginBottom:'16px' }}>
                        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                          <thead>
                            <tr style={{ background:'#F5F3FF', borderBottom:'2px solid #E9D5FF' }}>
                              {['Parameter','Unit','Result','Remarks','Action','Analyst','Time'].map(h=>(
                                <th key={h} style={{ padding:'8px 12px', textAlign:'left',
                                                     fontSize:'11px', fontWeight:'700',
                                                     color:'#4C1D95', whiteSpace:'nowrap' }}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sorted.map(ta => (
                              <tr key={ta.id} style={{ borderBottom:'1px solid #F3E8FF' }}>
                                <td style={{ padding:'8px 12px', fontWeight:'600', color:'#1F2937' }}>
                                  {ta.tests?.name}
                                </td>
                                <td style={{ padding:'8px 12px', color:'#6B7280', fontSize:'11px' }}>
                                  {ta.tests?.unit||'—'}
                                </td>
                                <td style={{ padding:'8px 12px' }}>
                                  {ta.result_value ? (
                                    <span style={{
                                      display:'inline-block',
                                      background:rBg(ta.result_status),
                                      color:rColor(ta.result_status),
                                      padding:'2px 8px', borderRadius:'6px',
                                      fontWeight:'700', fontSize:'13px',
                                    }}>
                                      {ta.result_value}
                                    </span>
                                  ) : <span style={{ color:'#D1D5DB' }}>—</span>}
                                </td>
                                <td style={{ padding:'8px 12px', fontWeight:'700',
                                             color: ta.remarks==='OK'?'#16A34A':'#DC2626' }}>
                                  {ta.remarks||'—'}
                                </td>
                                <td style={{ padding:'8px 12px', fontWeight:'600',
                                             color: ta.action==='Pass'?'#16A34A':'#DC2626',
                                             fontSize:'12px' }}>
                                  {ta.action||'—'}
                                </td>
                                <td style={{ padding:'8px 12px', fontSize:'11px', color:'#6B7280' }}>
                                  {ta.analyst_signature||'—'}
                                </td>
                                <td style={{ padding:'8px 12px', fontSize:'11px',
                                             color:'#9CA3AF', whiteSpace:'nowrap' }}>
                                  {ta.submitted_at ? format(new Date(ta.submitted_at),'HH:mm') : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Comments */}
                      <div style={{ background:'#F5F3FF', borderRadius:'12px',
                                    border:'1px solid #DDD6FE', padding:'14px', marginBottom:'12px' }}>
                        <h4 style={{ fontSize:'13px', fontWeight:'700',
                                     color:'#4C1D95', marginBottom:'10px' }}>
                          💬 QC Comments
                        </h4>
                        {cmts.length === 0
                          ? <p style={{ fontSize:'12px', color:'#9CA3AF', marginBottom:'10px' }}>
                              No comments yet.
                            </p>
                          : <div style={{ marginBottom:'12px' }}>
                              {cmts.map(c => (
                                <div key={c.id} style={{
                                  padding:'10px 12px', marginBottom:'6px',
                                  background: c.is_signed_off ? '#F0FDF4' : '#fff',
                                  borderRadius:'10px',
                                  border: c.is_signed_off ? '1px solid #86EFAC' : '1px solid #E9D5FF',
                                }}>
                                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                                    <span style={{ fontSize:'12px', fontWeight:'700', color:'#4C1D95' }}>
                                      {c.app_users?.full_name}
                                    </span>
                                    <span style={{ fontSize:'11px', color:'#9CA3AF' }}>
                                      {format(new Date(c.commented_at),'HH:mm dd/MM')}
                                    </span>
                                  </div>
                                  <p style={{ fontSize:'13px', color:'#374151', margin:0 }}>{c.comment}</p>
                                </div>
                              ))}
                            </div>
                        }
                        <div style={{ display:'flex', gap:'8px' }}>
                          <input type="text"
                            value={commentText[sample.id]||''}
                            onChange={e => setCommentText(prev=>({...prev,[sample.id]:e.target.value}))}
                            placeholder="Type your comment..."
                            style={{ flex:1, border:'1.5px solid #DDD6FE', borderRadius:'8px',
                                     padding:'9px 12px', fontSize:'13px', fontFamily:'inherit',
                                     background:'#fff', cursor:'text' }}
                            onKeyDown={e => { if(e.key==='Enter') addComment(sample.id); }}
                          />
                          <button onClick={() => addComment(sample.id)} disabled={saving[sample.id]}
                            style={{ background:'#7C3AED', color:'#fff', border:'none',
                                     borderRadius:'8px', padding:'9px 16px', fontSize:'13px',
                                     fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>
                            {saving[sample.id] ? '...' : '💬 Comment'}
                          </button>
                        </div>
                      </div>

                      {!isSignedOff && (
                        <button onClick={() => signOff(sample.id)}
                          style={{ background:'linear-gradient(135deg,#16A34A,#15803D)',
                                   color:'#fff', border:'none', borderRadius:'10px',
                                   padding:'10px 20px', fontSize:'13px', fontWeight:'700',
                                   cursor:'pointer', fontFamily:'inherit' }}>
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