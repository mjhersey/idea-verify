import apiClient from './api'
import type { BusinessIdea } from '../stores/evaluation'

export interface EvaluationRequest {
  description: string
  urgency?: 'low' | 'medium' | 'high'
  industry?: string
  targetMarket?: string
}

export interface EvaluationResponse {
  id: string
  status: 'pending' | 'analyzing' | 'completed' | 'failed'
  results?: {
    marketResearch?: any
    competitiveAnalysis?: any
    customerResearch?: any
    technicalFeasibility?: any
    financialAnalysis?: any
    overallScore?: number
  }
}

export const evaluationService = {
  async submitEvaluation(request: EvaluationRequest): Promise<EvaluationResponse> {
    const response = await apiClient.post('/api/evaluations', request)
    return response.data
  },

  async getEvaluation(id: string): Promise<EvaluationResponse> {
    const response = await apiClient.get(`/api/evaluations/${id}`)
    return response.data
  },

  async getEvaluations(): Promise<EvaluationResponse[]> {
    const response = await apiClient.get('/api/evaluations')
    return response.data
  },

  async deleteEvaluation(id: string): Promise<void> {
    await apiClient.delete(`/api/evaluations/${id}`)
  }
}

export default evaluationService