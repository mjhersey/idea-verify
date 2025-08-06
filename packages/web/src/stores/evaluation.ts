import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface BusinessIdea {
  id: string
  description: string
  status: 'pending' | 'analyzing' | 'completed' | 'failed'
  createdAt: Date
  results?: {
    marketResearch?: Record<string, unknown>
    competitiveAnalysis?: Record<string, unknown>
    customerResearch?: Record<string, unknown>
    technicalFeasibility?: Record<string, unknown>
    financialAnalysis?: Record<string, unknown>
    overallScore?: number
  }
}

export const useEvaluationStore = defineStore('evaluation', () => {
  const evaluations = ref<BusinessIdea[]>([])
  const currentEvaluation = ref<BusinessIdea | null>(null)
  const isLoading = ref(false)

  const totalEvaluations = computed(() => evaluations.value.length)
  const completedEvaluations = computed(
    () => evaluations.value.filter(e => e.status === 'completed').length
  )
  const pendingEvaluations = computed(
    () => evaluations.value.filter(e => e.status === 'analyzing' || e.status === 'pending').length
  )

  const createEvaluation = (description: string): BusinessIdea => {
    const evaluation: BusinessIdea = {
      id: crypto.randomUUID(),
      description,
      status: 'pending',
      createdAt: new Date(),
    }

    evaluations.value.push(evaluation)
    currentEvaluation.value = evaluation

    return evaluation
  }

  const updateEvaluationStatus = (id: string, status: BusinessIdea['status']) => {
    const evaluation = evaluations.value.find(e => e.id === id)
    if (evaluation) {
      evaluation.status = status
    }
  }

  const updateEvaluationResults = (id: string, results: BusinessIdea['results']) => {
    const evaluation = evaluations.value.find(e => e.id === id)
    if (evaluation) {
      evaluation.results = results
      evaluation.status = 'completed'
    }
  }

  return {
    evaluations,
    currentEvaluation,
    isLoading,
    totalEvaluations,
    completedEvaluations,
    pendingEvaluations,
    createEvaluation,
    updateEvaluationStatus,
    updateEvaluationResults,
  }
})
