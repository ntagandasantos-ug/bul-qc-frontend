import api from './api';

export const dashboardService = {

  getLiveResults: async () => {
    const res = await api.get('/dashboard/live');
    return res.data.results;
  },

  getStats: async (departmentId) => {
    const params = departmentId ? `?department_id=${departmentId}` : '';
    const res    = await api.get(`/dashboard/stats${params}`);
    return res.data.stats;
  },

  getNotifications: async () => {
    const res = await api.get('/dashboard/notifications');
    return res.data.notifications;
  },

  markNotificationsRead: async () => {
    await api.put('/dashboard/notifications/read');
  },
};