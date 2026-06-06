import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    try {
      const authData = JSON.parse(localStorage.getItem('animex-auth') || '{}');
      const token = authData?.state?.accessToken;
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch { /* ignore */ }
  }
  return config;
});

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

// Auto-refresh on 401 TOKEN_EXPIRED
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      error.response?.data?.code === 'TOKEN_EXPIRED' &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      isRefreshing = true;

      try {
        const authData = JSON.parse(localStorage.getItem('animex-auth') || '{}');
        const refreshToken = authData?.state?.refreshToken;

        if (!refreshToken) throw new Error('No refresh token');

        const res = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
          { refreshToken }
        );

        const { accessToken, refreshToken: newRefreshToken } = res.data.data;

        // Update stored token
        authData.state.accessToken = accessToken;
        authData.state.refreshToken = newRefreshToken;
        localStorage.setItem('animex-auth', JSON.stringify(authData));

        api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
        onRefreshed(accessToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch {
        // Clear auth and redirect to login
        localStorage.removeItem('animex-auth');
        if (typeof window !== 'undefined') window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
