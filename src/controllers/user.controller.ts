
import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import bcrypt from 'bcryptjs';

// Get all data for dashboard in one call
export const getDashboardData = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.id;
    try {
        const [profile, orders, addresses, supportTickets, paymentMethods] = await Promise.all([
            prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, phone: true, dateOfBirth: true, profilePictureUrl: true, joinDate: true, wishlistProductIds: true, recentlyViewedProductIds: true, role: true } }),
            prisma.order.findMany({ where: { userId }, orderBy: { orderDate: 'desc' }, include: { items: { include: { product: true, variant: true } } } }),
            prisma.address.findMany({ where: { userId } }),
            prisma.supportTicket.findMany({ where: { userId }, orderBy: { lastUpdated: 'desc' } }),
            prisma.paymentMethod.findMany({ where: { userId } })
        ]);
        res.json({ profile, orders, addresses, supportTickets, paymentMethods });
    } catch (error) {
        next(error);
    }
};

// Profile
export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.id;
    const { name, phone, dateOfBirth, profilePictureUrl } = req.body;
    try {
        const user = await prisma.user.update({
            where: { id: userId },
            data: { name, phone, dateOfBirth, profilePictureUrl },
        });
        const { password, ...userResponse } = user;
        res.json(userResponse);
    } catch (error) {
        next(error);
    }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.id;
    const { current, new: newPassword } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ message: "User not found" });

        const isPasswordValid = await bcrypt.compare(current, user.password);
        if (!isPasswordValid) return res.status(401).json({ message: "Invalid current password" });

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedNewPassword }
        });

        res.json({ success: true, message: "Password updated successfully" });
    } catch (error) {
        next(error);
    }
};

// Addresses
export const getAddresses = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.id;
    try {
        const addresses = await prisma.address.findMany({ where: { userId } });
        res.json(addresses);
    } catch (error) { next(error); }
};
export const addAddress = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.id;
    try {
        const address = await prisma.address.create({ data: { ...req.body, userId } });
        res.status(201).json(address);
    } catch (error) { next(error); }
};
export const updateAddress = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    try {
        const address = await prisma.address.update({ where: { id }, data: req.body });
        res.json(address);
    } catch (error) { next(error); }
};
export const deleteAddress = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    try {
        await prisma.address.delete({ where: { id } });
        res.status(204).send();
    } catch (error) { next(error); }
};

// Orders
export const getUserOrders = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.id;
    try {
        const orders = await prisma.order.findMany({
            where: { userId },
            orderBy: { orderDate: 'desc' },
            include: { items: { include: { product: true, variant: true } } }
        });
        res.json(orders);
    } catch (error) { next(error); }
};

// Coupon
export const validateCoupon = async (req: Request, res: Response, next: NextFunction) => {
    const { code } = req.body;
    try {
        const coupon = await prisma.coupon.findUnique({ where: { code } });
        if (!coupon || !coupon.isActive) {
            return res.status(404).json({ message: 'Coupon not found or is inactive.' });
        }
        res.json({ success: true, coupon });
    } catch (error) { next(error); }
};

// Wishlist
export const toggleWishlist = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.id;
    const { productId } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { id: userId }});
        if (!user) return res.status(404).json({ message: "User not found" });

        const wishlist = user.wishlistProductIds;
        const newWishlist = wishlist.includes(productId)
            ? wishlist.filter(id => id !== productId)
            : [...wishlist, productId];
        
        await prisma.user.update({
            where: { id: userId },
            data: { wishlistProductIds: newWishlist }
        });
        res.json({ success: true, wishlist: newWishlist });
    } catch (error) {
        next(error);
    }
};

// Recently Viewed
export const addRecentlyViewed = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.id;
    const { productId } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { id: userId }});
        if (!user) return res.status(404).json({ message: "User not found" });
        
        const recent = user.recentlyViewedProductIds;
        const newRecent = [productId, ...recent.filter(id => id !== productId)].slice(0, 10);

        await prisma.user.update({
            where: { id: userId },
            data: { recentlyViewedProductIds: newRecent }
        });
        res.json({ success: true, recentlyViewed: newRecent });
    } catch (error) {
        next(error);
    }
};

// Support Tickets
export const getSupportTickets = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.id;
    try {
        const tickets = await prisma.supportTicket.findMany({ where: { userId }, orderBy: { lastUpdated: 'desc' } });
        res.json(tickets);
    } catch (error) { next(error); }
};
export const createSupportTicket = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.id;
    try {
        const ticket = await prisma.supportTicket.create({ data: { ...req.body, userId } });
        res.status(201).json(ticket);
    } catch (error) { next(error); }
};
export const addMessageToTicket = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { messages } = req.body; // Expecting the full message array
    try {
        const ticket = await prisma.supportTicket.update({
            where: { id },
            data: {
                messages,
                lastUpdated: new Date().toISOString()
            }
        });
        res.json(ticket);
    } catch (error) {
        next(error);
    }
};