import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import config from '../config/environment.js'

const API_BASE_URL = config.apiBaseUrl

// Create axios instance
export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Flag to prevent infinite refresh loops
let isRefreshing = false
interface QueueItem {
  // eslint-disable-next-line no-unused-vars
  resolve: (value: string) => void
  // eslint-disable-next-line no-unused-vars
  reject: (reason: unknown) => void
}
let failedQueue: Array<QueueItem> = []

// Process failed queue after token refresh
const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error)
    } else if (token) {
      resolve(token)
    }
  })

  failedQueue = []
}

// Request interceptor - add auth token from secure storage
axiosInstance.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      // Get token from secure httpOnly cookie via API
      const response = await axios.get(`${API_BASE_URL}/api/auth/access-token`, {
        withCredentials: true,
      })
      const token = response.data?.accessToken

      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`
      }
    } catch {
      // Token not available or expired - request will proceed without auth
      // The response interceptor will handle 401 errors
    }
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

// Response interceptor - handle token refresh
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response,
  async error => {
    const originalRequest = error.config

    // Handle 401 errors (token expired/invalid)
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If refresh is already in progress, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return axiosInstance(originalRequest)
          })
          .catch(err => {
            return Promise.reject(err)
          })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        // Get refresh token from secure storage
        const refreshTokenResponse = await axios.get(`${API_BASE_URL}/api/auth/refresh-token`, {
          withCredentials: true,
        })
        const refreshToken = refreshTokenResponse.data?.refreshToken

        if (refreshToken) {
          // Attempt to refresh the token
          const response = await axios.post(
            `${API_BASE_URL}/api/auth/refresh`,
            {
              refreshToken,
            },
            {
              withCredentials: true,
            }
          )

          const { tokens } = response.data

          // Store new tokens securely via API
          await axios.post(
            `${API_BASE_URL}/api/auth/store-tokens`,
            {
              accessToken: tokens.accessToken,
              refreshToken: tokens.refreshToken,
            },
            {
              withCredentials: true,
            }
          )

          // Process queued requests
          processQueue(null, tokens.accessToken)

          // Retry original request
          originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`
          return axiosInstance(originalRequest)
        } else {
          throw new Error('No refresh token available')
        }
      } catch (refreshError) {
        // Refresh failed - clear tokens and redirect to login
        processQueue(refreshError, null)

        // Clear tokens via secure API
        try {
          await axios.post(
            `${API_BASE_URL}/api/auth/clear-tokens`,
            {},
            {
              withCredentials: true,
            }
          )
        } catch {
          // Ignore errors when clearing tokens
        }

        // Redirect to login page
        window.location.href = '/login'

        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

// Legacy export for backward compatibility
export const apiClient = axiosInstance
export default axiosInstance
