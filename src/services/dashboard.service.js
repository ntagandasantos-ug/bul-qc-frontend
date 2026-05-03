import api from './api';

export const dashboardService = {

  getLiveResults: async () => {
    const res = await api.get('/dashboard/live-results');
    return res.data.results;
  },

  getStats: async (departmentId) => {
    const params = departmentId ? `?department_id=${departmentId}` : '';
    const res    = await api.get(`/dashboard/stats${params}`);
    return res.data;
  },

  getNotifications: async () => {
    try {
      const res = await api.get('/dashboard/notifications');
      return res.data.notifications || [];
    } catch(e) {
      return [];
    }
  },

  markNotificationsRead: async () => {
    try {
      await api.put('/dashboard/notifications/read');
    } catch(e) {}
  },
};