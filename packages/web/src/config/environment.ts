/**
 * Frontend Environment Configuration
 * Provides type-safe access to environment variables with validation
 */

export interface FrontendConfig {
  apiBaseUrl: string
  environment: string
  isDevelopment: boolean
  isProduction: boolean
  mockServicesEnabled: boolean
}

const validateEnvironment = (): FrontendConfig => {
  // Get environment variables
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
  const environment = import.meta.env.VITE_APP_ENV || 'development'
  const isDevelopment = import.meta.env.DEV
  const isProduction = import.meta.env.PROD
  const mockServicesEnabled = import.meta.env.VITE_USE_MOCK_SERVICES === 'true'
  
  // Validation errors
  const errors: string[] = []
  
  // Validate API Base URL
  if (isProduction && !import.meta.env.VITE_API_BASE_URL) {
    errors.push('VITE_API_BASE_URL is required in production')
  }
  
  if (apiBaseUrl) {
    // Validate URL format using a more compatible approach
    const urlPattern = /^https?:\/\/(?:[-\w.])+(?:\:[0-9]+)?(?:\/.*)?$/
    if (!urlPattern.test(apiBaseUrl)) {
      errors.push(`Invalid VITE_API_BASE_URL format: ${apiBaseUrl}. Must be a valid HTTP/HTTPS URL`)
    }
  }
  
  // Validate environment
  if (!['development', 'production', 'test', 'staging'].includes(environment)) {
    errors.push(`Invalid VITE_APP_ENV: ${environment}. Must be one of: development, production, test, staging`)
  }
  
  // Log warnings for missing optional variables
  if (isDevelopment) {
    if (!import.meta.env.VITE_API_BASE_URL) {
      console.warn('VITE_API_BASE_URL not set, using default:', apiBaseUrl)
    }
    if (!import.meta.env.VITE_APP_ENV) {
      console.warn('VITE_APP_ENV not set, using default:', environment)
    }
  }
  
  // Throw error if validation fails
  if (errors.length > 0) {
    const errorMessage = `Environment validation failed:\n${errors.join('\n')}`
    console.error(errorMessage)
    throw new Error(errorMessage)
  }
  
  const config: FrontendConfig = {
    apiBaseUrl,
    environment,
    isDevelopment,
    isProduction,
    mockServicesEnabled
  }
  
  // Log configuration in development
  if (isDevelopment) {
    console.log('✅ Environment configuration validated:', config)
  }
  
  return config
}

export const config = validateEnvironment()

export default config