import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar               from '../components/Navbar';
import TestParameterRow     from '../components/TestParameterRow';
import StatusBadge          from '../components/StatusBadge';
import LoadingSpinner        from '../components/LoadingSpinner';
import { useAuth }           from '../context/AuthContext';
import { samplesService }    from '../services/samples.service';
import { lookupService }     from '../services/lookup.service';
import { supabase }          from '../services/supabase';
import { toast }             from 'react-toastify';
import {
  ArrowLeft, CheckSquare, Square, Save,
  FlaskConical, ClipboardList,
} from 'lucide-react';

export default function AnalysisPage() {
  const { id }      = useParams();
  const navigate    = useNavigate();
  const { signingAs, user, canSubmitResults } = useAuth();

  const [sample,        setSample]        = useState(null);
  const [availableTests,setAvailableTests] = useState([]);
  const [selectedTestIds,setSelectedTestIds]= useState([]);
  const [assignments,   setAssignments]   = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [assigning,     setAssigning]     = useState(false);
  const [tab,           setTab]           = useState('select'); // 'select' | 'results'

  const displayName = signingAs || user?.full_name || 'Unknown';

  // ── Load sample and its current assignments ─────────────
  const loadSample = useCallback(async () => {
    try {
      const s = await samplesService.getSampleById(id);
      setSample(s);
      setAssignments(s.sample_test_assignments || []);

      // Pre-tick already assigned tests
      const assignedIds = (s.sample_test_assignments || []).map(a => a.tests?.id);
      setSelectedTestIds(assignedIds);

      // If tests already assigned, go to results tab
      if (assignedIds.length > 0) setTab('results');

      // Load available tests for this sample type
      const tests = await lookupService.getTests(
        s.sample_type_id,
        s.brand_id,
        s.subtype_id
      );
      setAvailableTests(tests || []);
    } catch (err) {
      toast.error('Failed to load sample');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadSample(); }, [loadSample]);

  // Real-time: refresh when a result is submitted
  useEffect(() => {
    const sub = supabase
      .channel(`analysis_${id}`)
      .on('postgres_changes',
        {
          event : 'UPDATE',
          schema: 'public',
          table : 'sample_test_assignments',
          filter: `sample_id=eq.${id}`,
        },
        () => loadSample()
      )
      .subscribe();
    return () => sub.unsubscribe();
  }, [id, loadSample]);

  // ── Toggle a test checkbox ───────────────────────────────
  const toggleTest = (testId) => {
    // Can't untick a test that already has a result
    const hasResult = assignments.find(
      a => a.tests?.id === testId && a.result_value
    );
    if (hasResult) {
      toast.warning('Cannot remove a test that already has a result submitted.'); return;
    }
    setSelectedTestIds(prev =>
      prev.includes(testId)
        ? prev.filter(t => t !== testId)
        : [...prev, testId]
    );
  };

  // ── Assign selected tests and go to results tab ──────────
  const handleAssignTests = async () => {
    if (selectedTestIds.length === 0) {
      toast.warning('Please select at least one test.'); return;
    }
    setAssigning(true);
    try {
      await samplesService.assignTests(id, selectedTestIds);
      toast.success(`${selectedTestIds.length} test(s) assigned`);
      await loadSample();
      setTab('results');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to assign tests');
    } finally {
      setAssigning(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <LoadingSpinner text="Loading sample..." />
    </div>
  );

  if (!sample) return null;

  // Find assignment for a given test
  const getAssignment = (testId) =>
    assignments.find(a => a.tests?.id === testId);

  const assignedTests = assignments.filter(a =>
    selectedTestIds.includes(a.tests?.id)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 py-5">

        {/* Back + sample header */}
        <div className="flex items-start gap-3 mb-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-xl border border-gray-200 bg-white
                       hover:bg-gray-50 text-gray-500 flex-shrink-0 mt-0.5"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-gray-900 truncate">
                {sample.sample_name}
              </h2>
              <StatusBadge status={sample.status} />
            </div>
            <p className="text-xs text-bul-blue font-medium">{sample.sample_number}</p>
            <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-500">
              <span>{sample.sample_types?.sample_categories?.name}</span>
              <span>›</span>
              <span>{sample.sample_types?.name}</span>
              {sample.brands && <span className="text-blue-600">• {sample.brands.name}</span>}
              {sample.sample_subtypes && <span className="text-gray-600">• {sample.sample_subtypes.name}</span>}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Analyst: <strong className="text-gray-600">{displayName}</strong>
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl overflow-hidden border border-gray-200 mb-4">
          {[
            { key: 'select',  label: 'Select Tests',    icon: <CheckSquare size={14} /> },
            { key: 'results', label: `Enter Results (${assignments.length})`, icon: <ClipboardList size={14} /> },
          ].map(tab_ => (
            <button
              key={tab_.key}
              onClick={() => setTab(tab_.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3
                          text-sm font-semibold transition-colors
                          ${tab === tab_.key
                            ? 'bg-bul-blue text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {tab_.icon}
              {tab_.label}
            </button>
          ))}
        </div>

        {/* TAB 1: Select Tests */}
        {tab === 'select' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-sm text-gray-500 mb-4">
              Tick all tests required for this sample, then click
              <strong> Confirm Tests</strong>.
            </p>

            {availableTests.length === 0 ? (
              <p className="text-center text-gray-400 py-8">
                No tests defined for this sample type
              </p>
            ) : (
              <div className="space-y-2">
                {availableTests.map(test => {
                  const checked     = selectedTestIds.includes(test.id);
                  const hasResult_  = !!getAssignment(test.id)?.result_value;
                  const spec        = test.specification;

                  return (
                    <div
                      key={test.id}
                      onClick={() => !hasResult_ && toggleTest(test.id)}
                      className={`flex items-start gap-3 p-3 rounded-xl border
                        transition-colors cursor-pointer
                        ${checked
                          ? 'bg-blue-50 border-bul-blue'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}
                        ${hasResult_ ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <div className={`mt-0.5 flex-shrink-0 ${checked ? 'text-bul-blue' : 'text-gray-300'}`}>
                        {checked ? <CheckSquare size={18} /> : <Square size={18} />}
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-sm font-semibold text-gray-800">
                            {test.name}
                          </span>
                          {spec && (
                            <span className="text-xs text-gray-400">
                              ({spec.display_spec || `${spec.min_value}–${spec.max_value}`})
                            </span>
                          )}
                          {test.unit && (
                            <span className="text-xs text-bul-blue font-medium">
                              {test.unit}
                            </span>
                          )}
                        </div>
                        {hasResult_ && (
                          <span className="text-xs text-green-600 font-medium">
                            ✓ Result submitted
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {availableTests.length > 0 && (
              <button
                onClick={handleAssignTests}
                disabled={assigning || selectedTestIds.length === 0}
                className="w-full mt-4 bg-bul-blue text-white py-3 rounded-xl
                           font-semibold text-sm hover:bg-blue-800 disabled:opacity-40
                           flex items-center justify-center gap-2"
              >
                {assigning ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent
                                     rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={15} />
                    Confirm {selectedTestIds.length} Test{selectedTestIds.length !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* TAB 2: Enter Results */}
        {tab === 'results' && (
          <div>
            {!canSubmitResults && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3
                              mb-4 text-sm text-yellow-700">
                ⚠️ You need to be signed in as an Analyst to submit results.
                Please logout and login again with your name in the "Signing as" field.
              </div>
            )}

            {assignments.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-8
                              text-center">
                <FlaskConical size={32} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 font-medium">No tests assigned yet</p>
                <p className="text-gray-400 text-sm mt-1">
                  Go to the "Select Tests" tab and choose the tests to run.
                </p>
                <button
                  onClick={() => setTab('select')}
                  className="mt-4 bg-bul-blue text-white px-6 py-2.5 rounded-xl
                             text-sm font-semibold hover:bg-blue-800"
                >
                  Select Tests
                </button>
              </div>
            ) : (
              <div>
                <p className="text-xs text-gray-400 mb-3 px-1">
                  Enter results below. Each result requires your signature.
                  You have signed in as: <strong>{displayName}</strong>
                </p>

                {assignments
                  .sort((a, b) => (a.tests?.display_order || 0) - (b.tests?.display_order || 0))
                  .map(assignment => (
                    <TestParameterRow
                      key={assignment.id}
                      assignment={assignment}
                      test={assignment.tests}
                      specification={
                        assignment.tests?.test_specifications?.find(s =>
                          (s.brand_id === sample.brand_id || !s.brand_id) &&
                          (s.subtype_id === sample.subtype_id || !s.subtype_id)
                        ) || null
                      }
                      signingAs={displayName}
                      sampleBrandId={sample.brand_id}
                      sampleSubtypeId={sample.subtype_id}
                      onResultSubmitted={loadSample}
                    />
                  ))
                }
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}