
import express from 'express';
import { addItemToCart, getCart, removeItemFromCart, updateCartItem } from '../controllers/cart.controller';
import { isAuthenticated } from '../middlewares/auth.middleware';

const router = express.Router();

// All cart routes are protected
router.use(isAuthenticated);

router.get('/', getCart);
router.post('/', addItemToCart);
router.put('/:variantId', updateCartItem);
router.delete('/:variantId', removeItemFromCart);

export default router;
