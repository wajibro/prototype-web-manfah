import express from 'express';
import { checkOrderPage } from '../controllers/orderController';

const router = express.Router();

router.get('/', checkOrderPage);

export default router;