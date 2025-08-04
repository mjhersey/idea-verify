/**
 * Structured Logger with CloudWatch Integration
 */

export interface LogContext {
  correlationId?: string
  userId?: string
  requestId?: string
  sessionId?: string
  evaluationId?: string
  service?: string
  component?: string
  action?: string
  duration?: number
  metadata?: Record<string, any>
}

export interface LogEntry {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  service: string
  environment: string
  context?: LogContext
  error?: {
    name: string
    message: string
    stack?: string
  }
}

export class StructuredLogger {
  private serviceName: string
  private environment: string
  private correlationId?: string

  constructor(serviceName: string, environment?: string) {
    this.serviceName = serviceName
    this.environment = environment || process.env.NODE_ENV || 'development'
  }

  setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId
  }

  private createLogEntry(
    level: LogEntry['level'],
    message: string,
    context?: LogContext,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.serviceName,
      environment: this.environment,
      context: {
        ...context,
        correlationId: context?.correlationId || this.correlationId
      }
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    }

    return entry
  }

  private output(entry: LogEntry): void {
    // In production, this could send to CloudWatch, Elasticsearch, etc.
    const logLine = JSON.stringify(entry)
    
    switch (entry.level) {
      case 'error':
        console.error(logLine)
        break
      case 'warn':
        console.warn(logLine)
        break
      case 'debug':
        if (this.environment === 'development') {
          console.debug(logLine)
        }
        break
      default:
        console.log(logLine)
    }
  }

  debug(message: string, context?: LogContext): void {
    const entry = this.createLogEntry('debug', message, context)
    this.output(entry)
  }

  info(message: string, context?: LogContext): void {
    const entry = this.createLogEntry('info', message, context)
    this.output(entry)
  }

  warn(message: string, context?: LogContext): void {
    const entry = this.createLogEntry('warn', message, context)
    this.output(entry)
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const entry = this.createLogEntry('error', message, context, error)
    this.output(entry)
  }

  // Convenience methods for common use cases
  requestStarted(requestId: string, method: string, path: string, context?: LogContext): void {
    this.info('Request started', {
      ...context,
      requestId,
      action: 'request_started',
      metadata: { method, path }
    })
  }

  requestCompleted(requestId: string, statusCode: number, duration: number, context?: LogContext): void {
    this.info('Request completed', {
      ...context,
      requestId,
      action: 'request_completed',
      duration,
      metadata: { statusCode }
    })
  }

  evaluationStarted(evaluationId: string, context?: LogContext): void {
    this.info('Evaluation started', {
      ...context,
      evaluationId,
      action: 'evaluation_started'
    })
  }

  evaluationCompleted(evaluationId: string, duration: number, success: boolean, context?: LogContext): void {
    this.info('Evaluation completed', {
      ...context,
      evaluationId,
      action: 'evaluation_completed',
      duration,
      metadata: { success }
    })
  }

  agentTaskStarted(agentType: string, taskId: string, context?: LogContext): void {
    this.info('Agent task started', {
      ...context,
      action: 'agent_task_started',
      component: agentType,
      metadata: { taskId }
    })
  }

  agentTaskCompleted(agentType: string, taskId: string, duration: number, success: boolean, context?: LogContext): void {
    this.info('Agent task completed', {
      ...context,
      action: 'agent_task_completed',
      component: agentType,
      duration,
      metadata: { taskId, success }
    })
  }

  databaseQuery(query: string, duration: number, context?: LogContext): void {
    this.debug('Database query executed', {
      ...context,
      action: 'database_query',
      duration,
      metadata: { query: query.substring(0, 100) + (query.length > 100 ? '...' : '') }
    })
  }

  externalApiCall(service: string, endpoint: string, duration: number, success: boolean, context?: LogContext): void {
    this.info('External API call', {
      ...context,
      action: 'external_api_call',
      component: service,
      duration,
      metadata: { endpoint, success }
    })
  }

  // Create child logger with additional context
  createChildLogger(additionalContext: LogContext): ChildLogger {
    return new ChildLogger(this, additionalContext)
  }
}

class ChildLogger {
  constructor(
    private parentLogger: StructuredLogger,
    private additionalContext: LogContext
  ) {}

  private mergeContext(context?: LogContext): LogContext {
    return {
      ...this.additionalContext,
      ...context
    }
  }

  debug(message: string, context?: LogContext): void {
    this.parentLogger.debug(message, this.mergeContext(context))
  }

  info(message: string, context?: LogContext): void {
    this.parentLogger.info(message, this.mergeContext(context))
  }

  warn(message: string, context?: LogContext): void {
    this.parentLogger.warn(message, this.mergeContext(context))
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.parentLogger.error(message, error, this.mergeContext(context))
  }
}

// Correlation ID middleware for Express
export function correlationIdMiddleware(req: any, res: any, next: any): void {
  const correlationId = req.headers['x-correlation-id'] || 
                       req.headers['x-request-id'] || 
                       generateCorrelationId()
  
  req.correlationId = correlationId
  res.setHeader('x-correlation-id', correlationId)
  
  next()
}

// Request logging middleware for Express
export function requestLoggingMiddleware(logger: StructuredLogger) {
  return (req: any, res: any, next: any): void => {
    const startTime = Date.now()
    const requestId = req.correlationId || generateCorrelationId()
    
    logger.setCorrelationId(req.correlationId)
    logger.requestStarted(requestId, req.method, req.path, {
      userId: req.user?.id,
      metadata: {
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    })

    // Override res.end to log completion
    const originalEnd = res.end
    res.end = function(...args: any[]) {
      const duration = Date.now() - startTime
      logger.requestCompleted(requestId, res.statusCode, duration)
      originalEnd.apply(res, args)
    }

    next()
  }
}

// Utility functions
function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Logger factory
export function createLogger(serviceName: string, environment?: string): StructuredLogger {
  return new StructuredLogger(serviceName, environment)
}

// Default loggers for each service
export const apiLogger = createLogger('api')
export const orchestratorLogger = createLogger('orchestrator')
export const webLogger = createLogger('web')

export default StructuredLogger