
import express from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { getRazorpayInstance } from '../services/razorpay.service';

export const createRazorpayOrder = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { totalAmount } = req.body;
    if (!totalAmount) {
        return res.status(400).json({ message: 'Total amount is required' });
    }

    try {
        const razorpay = await getRazorpayInstance();
        if (!razorpay) {
            return res.status(503).json({ message: "Payment service is currently unavailable. Please check and enable Razorpay in Integrations with correct keys." });
        }
        
        const razorpaySettings = await prisma.integration.findUnique({
            where: { name: 'Razorpay' },
        });
        const keyId = (razorpaySettings?.settings as any)?.apiKey;

        if (!keyId) {
             return res.status(503).json({ message: "Razorpay Key ID is not configured." });
        }

        const options = {
            amount: Math.round(totalAmount * 100),
            currency: "INR",
            receipt: `receipt_order_${Date.now()}`
        };

        const order = await razorpay.orders.create(options);
        res.json({ orderId: order.id, keyId: keyId });
    } catch (error: any) {
        console.error("Razorpay order creation error:", error);
        if (error.statusCode === 401 || (error.error && error.error.description && error.error.description.includes('Authentication failed'))) {
            return res.status(503).json({ message: "Razorpay authentication failed. Please check your Key ID and Key Secret in Admin Panel > Settings > Integrations." });
        }
        next(error);
    }
};

export const placeOrder = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authReq = req as AuthRequest;
    const { order: orderData, guestDetails } = req.body;
    const userId = authReq.user?.id;

    if (!userId && !guestDetails?.email) {
        return res.status(401).json({ message: 'Authentication is required to place an order.' });
    }

    try {
        const orderItems = orderData.items.map((item: any) => ({
            productId: item.id,
            variantId: item.selectedVariant.id,
            quantity: item.quantity,
            priceAtPurchase: item.selectedVariant.price,
            variantSnapshot: item.selectedVariant.attributes,
        }));
        
        const newOrder = await prisma.order.create({
            data: {
                totalAmount: orderData.totalAmount,
                status: 'Processing',
                shippingAddress: orderData.shippingAddress,
                paymentType: orderData.paymentType,
                deliveryType: orderData.deliveryType,
                deliveryCharge: orderData.deliveryCharge,
                appliedCouponCode: orderData.appliedCouponCode,
                discountAmount: orderData.discountAmount,
                userId: userId,
                customerName: orderData.customerName,
                paymentStatus: orderData.paymentType === 'cod' ? 'Pending' : 'Success',
                items: {
                    create: orderItems,
                }
            },
        });

        const firstItemName = orderData.items[0]?.name || 'an item';
        await prisma.activityLog.create({
            data: {
                message: `Someone in ${orderData.shippingAddress.city} just purchased a "${firstItemName}".`
            }
        });
        
        res.status(201).json({ success: true, order: newOrder });

    } catch (error) {
        next(error);
    }
};
