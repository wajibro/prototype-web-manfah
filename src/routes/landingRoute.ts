import express from 'express';
import { landingPage } from '../controllers/landingController';

const router = express.Router();

router.get('/', landingPage);

export default router;