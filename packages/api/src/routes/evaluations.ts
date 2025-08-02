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
router.delete('/:id', deleteEvaluation)

export default router