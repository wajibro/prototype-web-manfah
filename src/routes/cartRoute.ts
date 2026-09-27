import express from 'express';
import {
  cartPage,
  addToCart,
  updateCart,
  removeFromCart,
  setCartQuantity,
  saveShippingInfo,
  checkoutCart,
  checkoutSuccess,
} from '../controllers/cartController';

const router = express.Router();

router.get('/', cartPage);
router.post('/add', addToCart);
router.post('/update', updateCart);
router.post('/set', setCartQuantity);
router.post('/remove', removeFromCart);
router.post('/shipping', saveShippingInfo);
router.post('/checkout', checkoutCart);
router.get('/success', checkoutSuccess);

export default router;