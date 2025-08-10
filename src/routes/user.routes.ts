
import express from 'express';
import { isAuthenticated } from '../middlewares/auth.middleware';
import { 
    getDashboardData, 
    updateProfile, 
    changePassword,
    getAddresses, 
    addAddress, 
    updateAddress, 
    deleteAddress, 
    getUserOrders, 
    validateCoupon, 
    toggleWishlist, 
    addRecentlyViewed,
    getSupportTickets,
    createSupportTicket,
    addMessageToTicket
} from '../controllers/user.controller';

const router = express.Router();

// All routes in this file are protected
router.use(isAuthenticated);

// New Dashboard Route to get all data at once
router.get('/dashboard-data', getDashboardData);

// Profile
router.put('/profile', updateProfile);
router.put('/change-password', changePassword);

// Addresses
router.get('/addresses', getAddresses);
router.post('/addresses', addAddress);
router.put('/addresses/:id', updateAddress);
router.delete('/addresses/:id', deleteAddress);

// Orders
router.get('/orders', getUserOrders);

// Support Tickets
router.get('/support-tickets', getSupportTickets);
router.post('/support-tickets', createSupportTicket);
router.put('/support-tickets/:id', addMessageToTicket);

// Coupons
router.post('/coupons/validate', validateCoupon);

// Wishlist & Recently Viewed
router.post('/wishlist/toggle', toggleWishlist);
router.post('/recently-viewed', addRecentlyViewed);


export default router;