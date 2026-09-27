import express from 'express';
import { productPage, getProductDetail } from '../controllers/productController';

const router = express.Router();

router.get('/', productPage);
router.get('/:slug', getProductDetail);

export default router;