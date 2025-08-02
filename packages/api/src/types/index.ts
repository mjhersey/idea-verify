export interface ApiResponse<T = any> {
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
    marketResearch?: any
    competitiveAnalysis?: any
    customerResearch?: any
    technicalFeasibility?: any
    financialAnalysis?: any
    overallScore?: number
  }
}