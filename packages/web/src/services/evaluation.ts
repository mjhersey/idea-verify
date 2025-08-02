import apiClient from './api'

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
    marketResearch?: Record<string, unknown>
    competitiveAnalysis?: Record<string, unknown>
    customerResearch?: Record<string, unknown>
    technicalFeasibility?: Record<string, unknown>
    financialAnalysis?: Record<string, unknown>
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