import express from 'express';
import {
  listProvinces,
  listCities,
  listDistricts,
  listSubDistricts,
  calculateShippingCost,
} from '../controllers/shippingController';

const router = express.Router();

router.get('/provinces', listProvinces);
router.get('/cities/:provinceId', listCities);
router.get('/districts/:cityId', listDistricts);
router.get('/sub-districts/:districtId', listSubDistricts);
router.post('/cost', calculateShippingCost);

export default router;