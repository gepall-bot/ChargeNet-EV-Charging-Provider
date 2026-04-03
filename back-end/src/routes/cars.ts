// back-end/src/routes/cars.routes.ts
import { Router } from 'express'
import { searchCars, getBrands, getModelsByBrand } from '../controllers/carsController.ts'

const router = Router()

router.get('/brands', getBrands)
router.get('/models', getModelsByBrand)
router.get('/search', searchCars)

export default router