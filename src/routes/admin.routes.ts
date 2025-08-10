
import express, { Request, Response } from 'express';
import { createProduct, deleteProduct, getAllCustomers, getAllOrders, updateOrderStatus, updateProduct, getCoupons, createCoupon, updateCoupon, deleteCoupon, getMediaLibrary, createCategory, updateCategory, deleteCategory, getCategories, createTestimonial, getTestimonials, updateTestimonial, deleteTestimonial, getDashboardData, getAdminChatSessions, getChatMessages, sendAdminMessage, getReviews, updateReview, deleteReview, getFaqs, createFaq, updateFaq, deleteFaq, updateStock, getWishlistAnalytics, toggleCustomerBlock, addMediaFile, deleteMediaFile, getPaymentGateways, updatePaymentGateway, getVariantAttributes, createVariantAttribute, updateVariantAttribute, deleteVariantAttribute, getShippingZones, createShippingZone, updateShippingZone, deleteShippingZone, getShippingProviders, updateShippingProvider, getSiteSettings, updateSiteSettings, updateSupportTicket, getTags, deleteTagFromAllProducts, createAdminUser, updateAdminUser, deleteAdminUser, getNotifications, getIntegrations, updateIntegration } from '../controllers/admin.controller';
import { isAdmin, isAuthenticated } from '../middlewares/auth.middleware';
import * as contentController from '../controllers/admin/content.controller';
import prisma from '../prisma';

const router = express.Router();

// All routes in this file are protected and require admin privileges
router.use(isAuthenticated, isAdmin);

// Dashboard
router.get('/dashboard-all', getDashboardData);

// Notifications
router.get('/notifications', getNotifications);

// Product Management
router.post('/products', createProduct);
router.put('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);
router.get('/products/all', (async (req: Request, res: Response) => {
    const products = await prisma.product.findMany({ include: { variants: true }, orderBy: {name: 'asc'} });
    res.json(products);
}));
router.put('/products/:id/status', (async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;
    const updated = await prisma.product.update({ where: {id}, data: { publishStatus: status }});
    res.json(updated);
}));

// Inventory Management
router.put('/inventory/stock', updateStock);


// Order Management
router.get('/orders', getAllOrders);
router.put('/orders/:id/status', updateOrderStatus);

// Coupon Management
router.get('/coupons', getCoupons);
router.post('/coupons', createCoupon);
router.put('/coupons/:id', updateCoupon);
router.delete('/coupons/:id', deleteCoupon);

// Media Management
router.get('/media', getMediaLibrary);
router.post('/media', addMediaFile);
router.delete('/media/:id', deleteMediaFile);


// Category Management
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// Tag Management
router.get('/tags', getTags);
router.delete('/tags/:tagName', deleteTagFromAllProducts);

// Variant Attribute Management
router.get('/variant-attributes', getVariantAttributes);
router.post('/variant-attributes', createVariantAttribute);
router.put('/variant-attributes/:id', updateVariantAttribute);
router.delete('/variant-attributes/:id', deleteVariantAttribute);

// Testimonial Management (now part of generic CMS)
router.get('/testimonials', getTestimonials);
router.post('/testimonials', createTestimonial);
router.put('/testimonials/:id', updateTestimonial);
router.delete('/testimonials/:id', deleteTestimonial);

// Review Management
router.get('/reviews', getReviews);
router.put('/reviews/:id', updateReview);
router.delete('/reviews/:id', deleteReview);

// FAQ Management
router.get('/faqs', getFaqs);
router.post('/faqs', createFaq);
router.put('/faqs/:id', updateFaq);
router.delete('/faqs/:id', deleteFaq);

// Customer Management
router.get('/customers', getAllCustomers);
router.put('/customers/:id/toggle-block', toggleCustomerBlock);

// User & Role Management
router.post('/users', createAdminUser);
router.put('/users/:id', updateAdminUser);
router.delete('/users/:id', deleteAdminUser);

// Site Settings
router.get('/settings/site', getSiteSettings);
router.put('/settings/site', updateSiteSettings);

// Payment Gateways
router.get('/payments/gateways', getPaymentGateways);
router.put('/payments/gateways/:id', updatePaymentGateway);

// Shipping
router.get('/shipping/zones', getShippingZones);
router.post('/shipping/zones', createShippingZone);
router.put('/shipping/zones/:id', updateShippingZone);
router.delete('/shipping/zones/:id', deleteShippingZone);
router.get('/shipping/providers', getShippingProviders);
router.put('/shipping/providers/:id', updateShippingProvider);

// Support
router.put('/support-tickets/:id', updateSupportTicket);

// Analytics
router.get('/analytics/wishlist', getWishlistAnalytics);

// Chat
router.get('/chats', getAdminChatSessions);
router.get('/chats/:sessionId/messages', getChatMessages);
router.post('/chats/:sessionId/messages', sendAdminMessage);

// Integrations
router.get('/integrations', getIntegrations);
router.put('/integrations/:id', updateIntegration);


// --- Generic Content Routes ---
// Hero Slides
router.get('/content/hero-slides', contentController.getHeroSlides);
router.post('/content/hero-slides', contentController.createHeroSlide);
router.put('/content/hero-slides/:id', contentController.updateHeroSlide);
router.delete('/content/hero-slides/:id', contentController.deleteHeroSlide);

// Shoppable Videos
router.get('/content/shoppable-videos', contentController.getShoppableVideos);
router.post('/content/shoppable-videos', contentController.createShoppableVideo);
router.put('/content/shoppable-videos/:id', contentController.updateShoppableVideo);
router.delete('/content/shoppable-videos/:id', contentController.deleteShoppableVideo);

// Occasions
router.get('/content/occasions', contentController.getOccasions);
router.post('/content/occasions', contentController.createOccasion);
router.put('/content/occasions/:id', contentController.updateOccasion);
router.delete('/content/occasions/:id', contentController.deleteOccasion);

// Looks
router.get('/content/looks', contentController.getLooks);
router.post('/content/looks', contentController.createLook);
router.put('/content/looks/:id', contentController.updateLook);
router.delete('/content/looks/:id', contentController.deleteLook);

// Emotions
router.get('/content/emotions', contentController.getEmotions);
router.post('/content/emotions', contentController.createEmotion);
router.put('/content/emotions/:id', contentController.updateEmotion);
router.delete('/content/emotions/:id', contentController.deleteEmotion);

// CMS Pages
router.get('/content/cms-pages', contentController.getCmsPages);
router.post('/content/cms-pages', contentController.createCmsPage);
router.put('/content/cms-pages/:id', contentController.updateCmsPage);
router.delete('/content/cms-pages/:id', contentController.deleteCmsPage);

// Floating Info
router.get('/content/floating-info', contentController.getFloatingInfo);
router.post('/content/floating-info', contentController.createFloatingInfo);
router.put('/content/floating-info/:id', contentController.updateFloatingInfo);
router.delete('/content/floating-info/:id', contentController.deleteFloatingInfo);

// Homepage Layout (special case without :id)
router.get('/content/homepage-layout', contentController.getHomepageLayout);
router.put('/content/homepage-layout', contentController.updateHomepageLayout);


export default router;