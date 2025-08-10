
import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

export const getCart = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.id;
    try {
        const cart = await prisma.cart.findUnique({
            where: { userId },
            include: {
                items: {
                    include: {
                        product: true,
                        variant: true,
                    },
                },
            },
        });
        if (res.headersSent) {
            return;
        }
        res.json(cart || { userId, items: [] }); // Return empty cart if none exists
    } catch (error) {
        next(error);
    }
};

export const addItemToCart = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.id;
    const { productId, variantId, quantity } = req.body;

    try {
        // Find or create a cart for the user
        let cart = await prisma.cart.findUnique({ where: { userId } });
        if (!cart) {
            cart = await prisma.cart.create({ data: { userId } });
        }

        const existingItem = await prisma.cartItem.findFirst({
            where: { cartId: cart.id, variantId },
        });

        if (existingItem) {
            // Update quantity if item already exists
            await prisma.cartItem.update({
                where: { id: existingItem.id },
                data: { quantity: { increment: quantity } },
            });
        } else {
            // Create new cart item
            await prisma.cartItem.create({
                data: {
                    cartId: cart.id,
                    productId,
                    variantId,
                    quantity,
                },
            });
        }

        // Return the updated cart by calling getCart logic
        return getCart(req, res, next);
        
    } catch (error) {
        next(error);
    }
};

export const updateCartItem = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.id;
    const { variantId } = req.params;
    const { quantity } = req.body;

    try {
        const cart = await prisma.cart.findUnique({ where: { userId } });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        await prisma.cartItem.updateMany({
            where: { cartId: cart.id, variantId },
            data: { quantity },
        });
        
        return getCart(req, res, next);
    } catch (error) {
        next(error);
    }
};

export const removeItemFromCart = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.id;
    const { variantId } = req.params;

    try {
        const cart = await prisma.cart.findUnique({ where: { userId } });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }
        
        await prisma.cartItem.deleteMany({
            where: { cartId: cart.id, variantId },
        });

        return getCart(req, res, next);
    } catch (error) {
        next(error);
    }
};