
import express from 'express';
import { getPresignedUrl } from '../controllers/media.controller';
import { isAuthenticated } from '../middlewares/auth.middleware';

const router = express.Router();

router.get('/presigned-url', isAuthenticated, getPresignedUrl);

export default router;
