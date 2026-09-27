import express from 'express';
import { blogPage, getBlogDetail } from '../controllers/blogController.js';

const router = express.Router();

router.get('/', blogPage);
router.get('/:slug', getBlogDetail);

export default router;