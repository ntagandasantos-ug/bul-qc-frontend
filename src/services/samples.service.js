import api from './api';

export const samplesService = {

  registerSample: async (sampleData) => {
    const res = await api.post('/samples', sampleData);
    return res.data;
  },

  getSamples: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.department_id) params.append('department_id', filters.department_id);
    if (filters.status)        params.append('status',        filters.status);
    if (filters.date)          params.append('date',          filters.date);
    if (filters.limit)         params.append('limit',         filters.limit);
    const res = await api.get(`/samples?${params}`);
    return res.data;
  },

  getSampleById: async (id) => {
    const res = await api.get(`/samples/${id}`);
    return res.data.sample;
  },

  assignTests: async (sampleId, testIds) => {
    const res = await api.post('/samples/assign-tests', {
      sample_id: sampleId,
      test_ids:  testIds,
    });
    return res.data;
  },
};