import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useEvaluationStore } from '@/stores/evaluation'

describe('Evaluation Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should create a new evaluation', () => {
    const store = useEvaluationStore()
    const description = 'Test business idea'

    const evaluation = store.createEvaluation(description)

    expect(evaluation.description).toBe(description)
    expect(evaluation.status).toBe('pending')
    expect(store.evaluations).toHaveLength(1)
    expect(store.totalEvaluations).toBe(1)
  })

  it('should update evaluation status', () => {
    const store = useEvaluationStore()
    const evaluation = store.createEvaluation('Test idea')

    store.updateEvaluationStatus(evaluation.id, 'analyzing')

    expect(evaluation.status).toBe('analyzing')
  })
})
