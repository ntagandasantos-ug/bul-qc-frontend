import api from './api';

export const lookupService = {
  getDepartments     : async () => (await api.get('/lookup/departments')).data.departments,
  getSampleCategories: async (dId) => (await api.get(`/lookup/categories/${dId}`)).data.categories,
  getSampleTypes     : async (cId) => (await api.get(`/lookup/sample-types/${cId}`)).data.sampleTypes,
  getSubtypes        : async (cId) => (await api.get(`/lookup/subtypes/${cId}`)).data.subtypes,
  getBrands          : async (dId) => (await api.get(`/lookup/brands/${dId}`)).data.brands,

  getTests: async (stId, brandId, subtypeId) => {
    const p = new URLSearchParams();
    if (brandId)   p.append('brand_id',   brandId);
    if (subtypeId) p.append('subtype_id', subtypeId);
    return (await api.get(`/lookup/tests/${stId}?${p}`)).data.tests;
  },

  getSampleNamePresets: async (dId) =>
    (await api.get(`/lookup/sample-names/${dId}`)).data.presets,

  addSampleNamePreset: async (departmentId, name) =>
    (await api.post('/lookup/sample-names', { department_id: departmentId, name })).data.preset,

  getLabStaff: async (role) => {
    const p = role ? `?role=${role}` : '';
    return (await api.get(`/lookup/staff${p}`)).data.staff;
  },

  addLabStaff: async (fullName, role) =>
    (await api.post('/lookup/staff', { full_name: fullName, role })).data.staff,
};