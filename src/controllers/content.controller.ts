
import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma';

export const getPublicHomepageLayout = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const layoutDoc = await prisma.homepageLayout.findUnique({
            where: { name: 'default' }
        });
        if (layoutDoc) {
            res.json(layoutDoc);
        } else {
            // If no layout is in the DB, send null so frontend uses its default
            res.json(null);
        }
    } catch (error) {
        next(error);
    }
};

export const getSiteData = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const [
            products, 
            categories,
            heroSlides,
            occasions,
            looks,
            emotions,
            shoppableVideos,
            testimonials,
            activityFeed,
            floatingInfo,
            fashionGalleryImages,
            blogPosts,
            guidedDiscoveryPaths,
            siteSettings,
            faqs,
            paymentGateways,
        ] = await Promise.all([
            prisma.product.findMany({ 
                where: { publishStatus: 'Published' },
                include: { variants: true }
            }),
            prisma.category.findMany({ include: { subCategories: true } }),
            prisma.heroSlide.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } }),
            prisma.occasionContent.findMany(),
            prisma.curatedLook.findMany(),
            prisma.emotionCategory.findMany(),
            prisma.shoppableVideo.findMany(),
            prisma.testimonial.findMany({ where: { approved: true } }),
            prisma.activityLog.findMany({ orderBy: { timestamp: 'desc' }, take: 10 }),
            prisma.floatingInfo.findMany(),
            prisma.fashionGalleryImage.findMany({ where: { isActive: true }, orderBy: { order: 'asc' }}),
            prisma.cmsPage.findMany({ where: { type: 'post', status: 'Published' }, orderBy: { lastUpdated: 'desc' }}),
            prisma.guidedDiscoveryPath.findMany(),
            prisma.siteSettings.findFirst({ where: { singleton: 'global_settings' } }),
            prisma.faq.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } }),
            prisma.paymentGateway.findMany({ where: { enabled: true } }),
        ]);
        
        // This combines gallery images from the dedicated model and potentially from individual products
        const allGalleryImages = [
            ...fashionGalleryImages.map(img => img.imageUrl),
        ];

        // This combines all CMS pages (posts, policies, about, etc.)
        const allCmsPages = await prisma.cmsPage.findMany({ where: { status: 'Published' }});
        
        res.json({
            products,
            categories,
            siteSettings, // Now fetched from DB
            cmsPages: allCmsPages,
            // Homepage Content
            heroSlides,
            occasions,
            looks,
            emotions,
            shoppableVideos,
            testimonials,
            activityFeed,
            floatingInfo,
            fashionGalleryImages: allGalleryImages,
            blogPosts,
            guidedDiscoveryPaths,
            faqs,
            paymentGateways,
            // Add categoryGridItems and promoGridItems if they are separate models
            categoryGridItems: (siteSettings as any)?.categoryGridItems || [], 
            promoGridItems: (siteSettings as any)?.promoGridItems || [],
        });

    } catch (error) {
        next(error);
    }
}