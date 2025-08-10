
import express from 'express';
import { createRazorpayOrder, placeOrder } from '../controllers/order.controller';
import { isAuthenticated } from '../middlewares/auth.middleware';

const router = express.Router();

// This route is now public to allow guest checkout initiation.
router.post('/payment/create', createRazorpayOrder);

// Placing the final order still requires authentication (or guest details).
router.post('/', isAuthenticated, placeOrder);

export default router;