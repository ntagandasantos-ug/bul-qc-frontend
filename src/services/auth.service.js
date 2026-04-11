import api from './api';

export const authService = {

  login: async (username, password, signingAs) => {
    const response = await api.post('/auth/login', {
      username: username.trim().toLowerCase(),
      password,
      signingAs: signingAs?.trim() || undefined,
    });
    return response.data;
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignore logout errors — clear local storage anyway
    }
  },

  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  changePassword: async (oldPassword, newPassword) => {
    const response = await api.put('/auth/change-password', {
      oldPassword,
      newPassword,
    });
    return response.data;
  },
};