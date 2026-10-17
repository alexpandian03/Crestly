import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  withCredentials: true,
  timeout: 60000, // 60s timeout accommodates Render cold starts
});

api.interceptors.request.use(
  (config) => {
    config.headers['X-Requested-With'] = 'XMLHttpRequest';
    const activeClientId = localStorage.getItem('activeClientId');
    if (activeClientId) config.headers['X-Client-Id'] = activeClientId;
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => {
    toast.dismiss('server-waking-up');
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const path = window.location.pathname;

    // Render free-tier cold start handler:
    // When sleeping, Render may take ~30-50s or return 504 / 502 / network timeout.
    const isWakeUpError =
      status === 504 ||
      status === 502 ||
      status === 503 ||
      error.code === 'ECONNABORTED' ||
      error.message?.includes('Network Error');

    if (isWakeUpError && originalRequest && !originalRequest._wakeUpRetry) {
      originalRequest._wakeUpRetry = true;
      toast.loading('Server is waking up, please retry...', {
        id: 'server-waking-up',
        duration: 10000,
      });

      // Wait 3 seconds before automatically retrying the first request once
      await new Promise((resolve) => setTimeout(resolve, 3000));
      try {
        const retryRes = await api(originalRequest);
        toast.success('Server is online!', { id: 'server-waking-up', duration: 2500 });
        return retryRes;
      } catch (retryError) {
        toast.error('Server is still starting up, please try again in a few moments.', {
          id: 'server-waking-up',
          duration: 5000,
        });
        return Promise.reject(retryError);
      }
    }

    const isAuthRoute =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/login') ||
      originalRequest?.url?.includes('/auth/refresh') ||
      originalRequest?.url?.includes('/auth/forgot-password') ||
      originalRequest?.url?.includes('/auth/reset-password') ||
      originalRequest?.url?.includes('/auth/accept-invite') ||
      originalRequest?.url?.includes('/auth/verify-email');

    const publicPaths = [
      '/login',
      '/forgot-password',
      '/reset-password',
      '/invite',
      '/verify-email',
      '/how-it-works',
      '/',
    ];
    const isPublicPath = publicPaths.some(
      (p) =>
        path === p ||
        path.startsWith('/reset-password') ||
        path.startsWith('/invite') ||
        path.startsWith('/verify-email')
    );

    if (status === 401 && originalRequest && !originalRequest._retry && !isAuthRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await api.post('/auth/refresh');
        isRefreshing = false;
        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        processQueue(refreshError);
        if (!isPublicPath) {
          localStorage.removeItem('activeClientId');
          sessionStorage.setItem('authMessage', 'Your session has ended. Please log in again.');
          window.location.replace('/login');
        }
        return Promise.reject(refreshError);
      }
    }

    if (status === 401 && (originalRequest?._retry || isAuthRoute)) {
      if (!originalRequest?.url?.includes('/login')) {
        if (!isPublicPath) {
          localStorage.removeItem('activeClientId');
          sessionStorage.setItem('authMessage', 'Your session has ended. Please log in again.');
          window.location.replace('/login');
        }
      }
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

/**
 * Standard fetch helper calling relative /api/... URLs with credentials: 'include'.
 * Handles Render wake-up retries and redirects to /login on 401.
 */
export async function apiFetch(endpoint, options = {}) {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = normalizedEndpoint.startsWith('/api') ? normalizedEndpoint : `/api${normalizedEndpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...(options.headers || {}),
  };

  const activeClientId = localStorage.getItem('activeClientId');
  if (activeClientId && !headers['X-Client-Id']) {
    headers['X-Client-Id'] = activeClientId;
  }

  const fetchConfig = {
    ...options,
    credentials: 'include',
    headers,
  };

  const execute = async () => {
    const res = await fetch(url, fetchConfig);
    if (res.status === 401 && !url.includes('/login')) {
      const isPublic = ['/login', '/forgot-password', '/reset-password', '/invite'].some((p) =>
        window.location.pathname.startsWith(p)
      );
      if (!isPublic) {
        localStorage.removeItem('activeClientId');
        sessionStorage.setItem('authMessage', 'Your session has ended. Please log in again.');
        window.location.replace('/login');
      }
    }
    return res;
  };

  try {
    const res = await execute();
    if (res.status === 504 || res.status === 502 || res.status === 503) {
      toast.loading('Server is waking up, please retry...', { id: 'server-waking-up', duration: 10000 });
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const retryRes = await execute();
      if (retryRes.ok) toast.success('Server is online!', { id: 'server-waking-up', duration: 2500 });
      return retryRes;
    }
    return res;
  } catch (networkErr) {
    toast.loading('Server is waking up, please retry...', { id: 'server-waking-up', duration: 10000 });
    await new Promise((resolve) => setTimeout(resolve, 3000));
    try {
      const retryRes = await execute();
      if (retryRes.ok) toast.success('Server is online!', { id: 'server-waking-up', duration: 2500 });
      return retryRes;
    } catch (finalErr) {
      toast.error('Server is still starting up, please try again in a few moments.', {
        id: 'server-waking-up',
        duration: 5000,
      });
      throw finalErr;
    }
  }
}

export default api;

