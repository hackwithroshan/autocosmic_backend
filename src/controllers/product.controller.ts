
import express from 'express';
import prisma from '../prisma';

export const getProducts = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { category, search, page = '1', limit = '10' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);

    try {
        const where: any = {
            publishStatus: 'PUBLISHED'
        };

        if (category) {
            where.categoryName = category as string;
        }

        if (search) {
            where.OR = [
                { name: { contains: search as string, mode: 'insensitive' } },
                { description: { contains: search as string, mode: 'insensitive' } },
            ];
        }

        const products = await prisma.product.findMany({
            where,
            skip: (pageNum - 1) * limitNum,
            take: limitNum,
            include: { variants: true },
        });
        
        const totalProducts = await prisma.product.count({ where });

        res.json({
            products,
            totalPages: Math.ceil(totalProducts / limitNum),
            currentPage: pageNum
        });
    } catch (error) {
        next(error);
    }
};

export const getProductBySlug = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { slug } = req.params;
    try {
        const product = await prisma.product.findUnique({
            where: { slug },
            include: { variants: true },
        });

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        next(error);
    }
};
