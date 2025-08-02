import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import config from '../config/environment.js';

const API_BASE_URL = config.apiBaseUrl;

// Create axios instance
export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Flag to prevent infinite refresh loops
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

// Process failed queue after token refresh
const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else if (token) {
      resolve(token);
    }
  });
  
  failedQueue = [];
};

// Request interceptor - add auth token
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle token refresh
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 errors (token expired/invalid)
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If refresh is already in progress, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return axiosInstance(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refreshToken');
      
      if (refreshToken) {
        try {
          // Attempt to refresh the token
          const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
            refreshToken
          });

          const { tokens } = response.data;
          
          // Store new tokens
          localStorage.setItem('accessToken', tokens.accessToken);
          localStorage.setItem('refreshToken', tokens.refreshToken);
          
          // Update default authorization header
          axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${tokens.accessToken}`;
          
          // Process queued requests
          processQueue(null, tokens.accessToken);
          
          // Retry original request
          originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
          return axiosInstance(originalRequest);
          
        } catch (refreshError) {
          // Refresh failed - clear tokens and redirect to login
          processQueue(refreshError, null);
          
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          delete axiosInstance.defaults.headers.common['Authorization'];
          
          // Redirect to login page
          window.location.href = '/login';
          
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      } else {
        // No refresh token available - redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        delete axiosInstance.defaults.headers.common['Authorization'];
        
        window.location.href = '/login';
        
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

// Legacy export for backward compatibility
export const apiClient = axiosInstance;
export default axiosInstance;