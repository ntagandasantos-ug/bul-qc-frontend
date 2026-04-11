import api from './api';

export const resultsService = {

  submitResult: async (assignmentId, resultValue, analystSignature) => {
    const res = await api.post('/results/submit', {
      assignment_id    : assignmentId,
      result_value     : resultValue,
      analyst_signature: analystSignature,
    });
    return res.data;
  },

  getResultsBySample: async (sampleId) => {
    const res = await api.get(`/results/sample/${sampleId}`);
    return res.data.results;
  },

  getEditHistory: async (assignmentId) => {
    const res = await api.get(`/results/history/${assignmentId}`);
    return res.data.history;
  },
};