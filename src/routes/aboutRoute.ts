import express from 'express';
import { aboutPage } from '../controllers/aboutController';

const router = express.Router();

router.get('/', aboutPage);

export default router;