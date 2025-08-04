/**
 * Global error handler plugin for Vue applications
 */

import { type App } from 'vue'

export interface ErrorInfo {
  componentName?: string
  propsData?: Record<string, unknown>
  message: string
  stack?: string
  timestamp: Date
}

class ErrorReporter {
  private errors: ErrorInfo[] = []

  reportError(error: Error, instance?: any, info?: string): void {
    const errorInfo: ErrorInfo = {
      componentName: instance?.$options?.name || instance?.$options?.__name,
      propsData: instance?.$props,
      message: error.message,
      stack: error.stack,
      timestamp: new Date()
    }

    this.errors.push(errorInfo)
    
    // Log to console in development
    if (import.meta.env.DEV) {
      console.group('🚨 Vue Error Boundary')
      console.error('Error:', error)
      console.log('Component:', errorInfo.componentName)
      console.log('Info:', info)
      console.log('Props:', errorInfo.propsData)
      console.groupEnd()
    }
    
    // In production, you might want to send to an error reporting service
    if (import.meta.env.PROD) {
      // Example: Sentry, LogRocket, etc.
      // this.sendToErrorService(errorInfo)
    }
  }

  getErrors(): ErrorInfo[] {
    return [...this.errors]
  }

  clearErrors(): void {
    this.errors = []
  }
}

const errorReporter = new ErrorReporter()

export const errorHandlerPlugin = {
  install(app: App) {
    // Global error handler
    app.config.errorHandler = (error: unknown, instance, info) => {
      const err = error instanceof Error ? error : new Error(String(error))
      errorReporter.reportError(err, instance, info)
    }

    // Global warning handler
    app.config.warnHandler = (msg, instance, trace) => {
      if (import.meta.env.DEV) {
        console.warn('Vue Warning:', msg)
        console.log('Component:', instance?.$options?.name)
        console.log('Trace:', trace)
      }
    }

    // Provide error reporter globally
    app.provide('errorReporter', errorReporter)
  }
}

export { errorReporter }