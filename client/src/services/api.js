import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    const activeClientId = localStorage.getItem('activeClientId');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (activeClientId) config.headers['X-Client-Id'] = activeClientId;
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const path = window.location.pathname;

    if (status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('activeClientId');
      sessionStorage.setItem('authMessage', 'Please log in again.');
      if (path !== '/login') window.location.replace('/login');
    } else if (status === 403 && path !== '/access-denied' && path !== '/login') {
      sessionStorage.setItem(
        'accessDeniedMessage',
        error.response?.data?.error?.message || "You don't have access to that page."
      );
      window.location.replace('/access-denied');
    }

    return Promise.reject(error);
  }
);

export default api;
