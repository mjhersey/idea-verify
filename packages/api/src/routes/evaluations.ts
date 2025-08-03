import { Router } from 'express'
import { 
  createEvaluation, 
  getEvaluations, 
  getEvaluation, 
  deleteEvaluation 
} from '../controllers/evaluations.js'

const router = Router()

router.post('/', createEvaluation)
router.get('/', getEvaluations)
router.get('/:id', getEvaluation)
router.get('/:id/status', getEvaluation) // Same endpoint for now
router.delete('/:id', deleteEvaluation)

export default router