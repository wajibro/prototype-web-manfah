import express from 'express';
import {
  createSnapPayment,
  midtransNotification,
  getPaymentStatus,
} from '../controllers/paymentController';

const router = express.Router();

router.post('/snap', createSnapPayment);
router.post('/notification', midtransNotification);
router.get('/status/:orderId', getPaymentStatus);

export default router;