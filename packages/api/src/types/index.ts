export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface EvaluationRequest {
  description: string
  urgency?: 'low' | 'medium' | 'high'
  industry?: string
  targetMarket?: string
}

export interface Evaluation {
  id: string
  description: string
  status: 'pending' | 'analyzing' | 'completed' | 'failed'
  createdAt: Date
  updatedAt: Date
  results?: {
    marketResearch?: Record<string, unknown>
    competitiveAnalysis?: Record<string, unknown>
    customerResearch?: Record<string, unknown>
    technicalFeasibility?: Record<string, unknown>
    financialAnalysis?: Record<string, unknown>
    overallScore?: number
  }
}
