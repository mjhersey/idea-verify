import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'

// Import shared utilities
import { RateLimiter } from '@ai-validation/shared'
import { getEnvironmentConfig } from '@ai-validation/shared'

import { errorHandler } from './middleware/errorHandler.js'
import { notFoundHandler } from './middleware/notFoundHandler.js'
import healthRoutes from './routes/health.js'
import evaluationRoutes from './routes/evaluations.js'
import authRoutes from './routes/auth.js'

const app = express()

// Load environment configuration
const envConfig = getEnvironmentConfig()

// Basic middleware
app.use(helmet())
app.use(cors({
  origin: envConfig.frontendUrl || 'http://localhost:5173',
  credentials: true
}))
app.use(compression())
app.use(morgan('combined'))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
})
app.use('/api', limiter)

// Routes
app.use('/health', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/evaluations', evaluationRoutes)

// Error handling
app.use(notFoundHandler)
app.use(errorHandler)

export default app