import api from './api';

export const lookupService = {

  getDepartments: async () => {
    const res = await api.get('/lookup/departments');
    return res.data.departments;
  },

  getSampleCategories: async (departmentId) => {
    const res = await api.get(`/lookup/categories/${departmentId}`);
    return res.data.categories;
  },

  getSampleTypes: async (categoryId) => {
    const res = await api.get(`/lookup/sample-types/${categoryId}`);
    return res.data.sampleTypes;
  },

  getSubtypes: async (categoryId) => {
    const res = await api.get(`/lookup/subtypes/${categoryId}`);
    return res.data.subtypes;
  },

  getBrands: async (departmentId) => {
    const res = await api.get(`/lookup/brands/${departmentId}`);
    return res.data.brands;
  },

  getTests: async (sampleTypeId, brandId, subtypeId) => {
    const params = new URLSearchParams();
    if (brandId)   params.append('brand_id',   brandId);
    if (subtypeId) params.append('subtype_id', subtypeId);
    const res = await api.get(`/lookup/tests/${sampleTypeId}?${params}`);
    return res.data.tests;
  },
};