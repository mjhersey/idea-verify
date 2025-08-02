/**
 * Frontend Environment Configuration
 * Provides type-safe access to environment variables
 */

export interface FrontendConfig {
  apiBaseUrl: string
  environment: string
  isDevelopment: boolean
  isProduction: boolean
  mockServicesEnabled: boolean
}

export const config: FrontendConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  environment: import.meta.env.VITE_APP_ENV || 'development',
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
  mockServicesEnabled: import.meta.env.VITE_USE_MOCK_SERVICES === 'true',
}

export default config