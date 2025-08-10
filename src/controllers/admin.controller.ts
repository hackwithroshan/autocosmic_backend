
import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { logAdminAction } from '../services/audit.service';
import bcrypt from 'bcryptjs';

const isMongoDbId = (id: string): boolean => {
    if(!id) return false;
    return /^[0-9a-fA-F]{24}$/.test(id);
};

// Product Controllers
export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { variants, category, subCategory, ...productData } = req.body;
    if (!productData.name || !productData.price || !productData.mrp || !productData.sku || !category) {
        return res.status(400).json({ message: 'Name, Price, MRP, SKU, and Category are required fields.' });
    }
    try {
        const product = await prisma.product.create({
            data: {
                ...productData,
                categoryName: category,
                subCategoryName: subCategory,
                variants: {
                    create: variants?.map(({ id, ...vData }: any) => vData) || []
                }
            },
            include: { variants: true },
        });
        await logAdminAction(authReq, `Created product: ${product.name}`, `ID: ${product.id}`);
        res.status(201).json(product);
    } catch (error) {
        console.error("Error creating product:", error);
        next(error);
    }
};

export const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const { variants, category, subCategory, ...productData } = req.body;
    if (!productData.name || !productData.price || !productData.mrp || !productData.sku || !category) {
        return res.status(400).json({ message: 'Name, Price, MRP, SKU, and Category are required fields.' });
    }
    try {
        const dataToUpdate: any = {
            ...productData,
            categoryName: category,
            subCategoryName: subCategory,
        };
        delete dataToUpdate.id; // Ensure ID is not in the update payload
        delete dataToUpdate.variants;

        const updatedProduct = await prisma.$transaction(async (tx) => {
            const product = await tx.product.update({ where: { id }, data: dataToUpdate });
            if (variants && Array.isArray(variants)) {
                const existingVariants = await tx.productVariant.findMany({ where: { productId: id } });
                const existingVariantIds = new Set(existingVariants.map(v => v.id));
                
                const incomingVariants = variants.map((v: any) => ({ ...v, id: isMongoDbId(v.id) ? v.id : undefined }));
                const incomingVariantIds = new Set(incomingVariants.map((v: any) => v.id).filter(Boolean));
                
                const variantsToDelete = existingVariants.filter(v => !incomingVariantIds.has(v.id));
                if (variantsToDelete.length > 0) {
                    await tx.productVariant.deleteMany({ where: { id: { in: variantsToDelete.map(v => v.id) } } });
                }

                for (const variantData of incomingVariants) {
                    const { id: variantId, ...data } = variantData;
                    if (variantId && existingVariantIds.has(variantId)) {
                        await tx.productVariant.update({ where: { id: variantId }, data });
                    } else {
                        await tx.productVariant.create({ data: { ...data, productId: id } });
                    }
                }
            }
            return product;
        });
        await logAdminAction(authReq, `Updated product: ${updatedProduct.name}`, `ID: ${updatedProduct.id}`);
        res.json(updatedProduct);
    } catch (error) {
        console.error("Error updating product:", error);
        next(error);
    }
};

export const deleteProduct = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    try {
        const product = await prisma.product.findUnique({ where: { id } });
        await prisma.product.delete({ where: { id } });
        await logAdminAction(authReq, `Deleted product: ${product?.name || 'Unknown'}`, `ID: ${id}`);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

// Inventory Controller
export const updateStock = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { productId, variantSku, newStock } = req.body;
    try {
        if (variantSku) {
            // Find the specific variant to update its stock
            const variant = await prisma.productVariant.findFirst({
                where: { productId, sku: variantSku },
            });
            if (variant) {
                await prisma.productVariant.update({
                    where: { id: variant.id },
                    data: { stockQuantity: newStock },
                });
            } else {
                return res.status(404).json({ message: 'Product variant not found.' });
            }
        } else {
            // Update stock for a base product (without variants)
            await prisma.product.update({
                where: { id: productId },
                data: { stockQuantity: newStock },
            });
        }
        await logAdminAction(authReq, 'Updated stock', `Product ID: ${productId}, SKU: ${variantSku || 'base'}, New Stock: ${newStock}`);
        res.status(200).json({ success: true, message: 'Stock updated successfully.' });
    } catch (error) {
        next(error);
    }
};

// Order Controllers
export const getAllOrders = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const orders = await prisma.order.findMany({
            orderBy: { orderDate: 'desc' },
            include: { user: { select: { name: true, email: true } } }
        });
        res.json(orders);
    } catch (error) {
        next(error);
    }
};

export const updateOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const { status } = req.body;
    try {
        const updatedOrder = await prisma.order.update({
            where: { id },
            data: { status },
        });
        await logAdminAction(authReq, `Updated order status`, `Order ID: ${id}, New Status: ${status}`);
        res.json(updatedOrder);
    } catch (error) {
        next(error);
    }
};

// Customer Controllers
export const getAllCustomers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const customersData = await prisma.user.findMany({
            where: { role: 'USER' },
            orderBy: { joinDate: 'desc' },
            include: {
                _count: { select: { orders: true }},
                orders: {
                    select: { totalAmount: true, orderDate: true },
                    orderBy: { orderDate: 'desc' },
                }
            }
        });

        const customersWithStats = customersData.map(c => ({
            id: c.id,
            name: c.name,
            email: c.email,
            phone: c.phone,
            joinDate: c.joinDate,
            totalOrders: c._count.orders,
            totalSpent: c.orders.reduce((sum, order) => sum + order.totalAmount, 0),
            lastOrderDate: c.orders.length > 0 ? c.orders[0].orderDate : undefined,
            profilePictureUrl: c.profilePictureUrl,
            isBlocked: c.isBlocked,
        }));

        res.json(customersWithStats);
    } catch (error) {
        next(error);
    }
};

export const toggleCustomerBlock = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    try {
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        const updatedUser = await prisma.user.update({
            where: { id },
            data: { isBlocked: !user.isBlocked },
        });
        await logAdminAction(authReq, `Toggled block status for user ${user.name}`, `New status: ${updatedUser.isBlocked ? 'Blocked' : 'Active'}`);
        res.json(updatedUser);
    } catch (error) {
        next(error);
    }
};


// Coupon Controllers
export const getCoupons = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const coupons = await prisma.coupon.findMany({ orderBy: { id: 'desc' } });
        res.json(coupons);
    } catch (error) {
        next(error);
    }
};

export const createCoupon = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    try {
        const couponData = req.body;
        const coupon = await prisma.coupon.create({ data: couponData });
        await logAdminAction(authReq, 'Created coupon', `Code: ${coupon.code}`);
        res.status(201).json(coupon);
    } catch (error) {
        next(error);
    }
};

export const updateCoupon = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const couponData = req.body;
    try {
        const coupon = await prisma.coupon.update({ where: { id }, data: couponData });
        await logAdminAction(authReq, 'Updated coupon', `Code: ${coupon.code}`);
        res.json(coupon);
    } catch (error) {
        next(error);
    }
};

export const deleteCoupon = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    try {
        const coupon = await prisma.coupon.findUnique({ where: { id } });
        await prisma.coupon.delete({ where: { id } });
        await logAdminAction(authReq, 'Deleted coupon', `Code: ${coupon?.code}`);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

// Media Library Controller
export const getMediaLibrary = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const media = await prisma.mediaFile.findMany({ orderBy: { createdAt: 'desc' } });
        res.json(media);
    } catch (error) {
        next(error);
    }
};

export const addMediaFile = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    try {
        const mediaFile = await prisma.mediaFile.create({ data: req.body });
        await logAdminAction(authReq, 'Uploaded media file', `Name: ${mediaFile.name}`);
        res.status(201).json(mediaFile);
    } catch (error) {
        next(error);
    }
};

export const deleteMediaFile = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    try {
        const mediaFile = await prisma.mediaFile.findUnique({ where: { id } });
        // In a real app, you would also delete the file from S3 here
        await prisma.mediaFile.delete({ where: { id } });
        await logAdminAction(authReq, 'Deleted media file', `Name: ${mediaFile?.name}`);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};


// Category Controllers
export const getCategories = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const categories = await prisma.category.findMany({
            where: { parentId: null },
            include: { subCategories: true },
            orderBy: { name: 'asc' }
        });
        res.json(categories);
    } catch (error) {
        next(error);
    }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    try {
        const category = await prisma.category.create({ data: req.body });
        await logAdminAction(authReq, 'Created category', `Name: ${category.name}`);
        res.status(201).json(category);
    } catch (error) {
        next(error);
    }
};

export const updateCategory = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    try {
        const category = await prisma.category.update({ where: { id }, data: req.body });
        await logAdminAction(authReq, 'Updated category', `Name: ${category.name}`);
        res.json(category);
    } catch (error) {
        next(error);
    }
};

export const deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    try {
        // Recursive delete for subcategories
        const deleteSubCategories = async (parentId: string) => {
            const subCategories = await prisma.category.findMany({ where: { parentId } });
            for (const sub of subCategories) {
                await deleteSubCategories(sub.id);
                await prisma.category.delete({ where: { id: sub.id } });
            }
        };
        await deleteSubCategories(id);
        const category = await prisma.category.delete({ where: { id } });
        
        await logAdminAction(authReq, 'Deleted category and its subcategories', `Name: ${category?.name}`);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

// Tag Controllers
export const getTags = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const productsWithTags = await prisma.product.findMany({
            where: { tags: { isEmpty: false } },
            select: { tags: true }
        });
        const tagCounts: Record<string, number> = {};
        productsWithTags.forEach(p => {
            p.tags.forEach(tag => {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
        });
        const result = Object.entries(tagCounts).map(([name, count]) => ({ name, count }));
        res.json(result);
    } catch (error) {
        next(error);
    }
};

export const deleteTagFromAllProducts = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { tagName } = req.params;
    try {
        const productsToUpdate = await prisma.product.findMany({
            where: { tags: { has: tagName } },
            select: { id: true, tags: true }
        });

        const updatePromises = productsToUpdate.map(p => {
            return prisma.product.update({
                where: { id: p.id },
                data: { tags: { set: p.tags.filter(t => t !== tagName) } }
            });
        });

        await prisma.$transaction(updatePromises);
        await logAdminAction(authReq, 'Deleted tag from all products', `Tag: ${tagName}`);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

// Variant Attribute Controllers
export const getVariantAttributes = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const attributes = await prisma.variantAttribute.findMany();
        res.json(attributes);
    } catch (error) { next(error); }
};
export const createVariantAttribute = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const attribute = await prisma.variantAttribute.create({ data: req.body });
        res.status(201).json(attribute);
    } catch (error) { next(error); }
};
export const updateVariantAttribute = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const attribute = await prisma.variantAttribute.update({ where: { id: req.params.id }, data: req.body });
        res.json(attribute);
    } catch (error) { next(error); }
};
export const deleteVariantAttribute = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await prisma.variantAttribute.delete({ where: { id: req.params.id } });
        res.status(204).send();
    } catch (error) { next(error); }
};


// Testimonial Controllers
export const getTestimonials = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const testimonials = await prisma.testimonial.findMany({ orderBy: { id: 'desc' } });
        res.json(testimonials);
    } catch (error) { next(error); }
};
export const createTestimonial = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const testimonial = await prisma.testimonial.create({ data: req.body });
        res.status(201).json(testimonial);
    } catch (error) { next(error); }
};
export const updateTestimonial = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const testimonial = await prisma.testimonial.update({ where: { id: req.params.id }, data: req.body });
        res.json(testimonial);
    } catch (error) { next(error); }
};
export const deleteTestimonial = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await prisma.testimonial.delete({ where: { id: req.params.id } });
        res.status(204).send();
    } catch (error) { next(error); }
};

// Review Controllers
export const getReviews = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const reviews = await prisma.productReview.findMany({
            orderBy: { createdAt: 'desc' },
            include: { user: { select: { name: true } }, product: { select: { name: true, imageUrl: true } } }
        });
        res.json(reviews);
    } catch (error) { next(error); }
};

export const updateReview = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { approved } = req.body;
    try {
        const review = await prisma.productReview.update({ where: { id }, data: { approved } });
        res.json(review);
    } catch (error) { next(error); }
};

export const deleteReview = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    try {
        await prisma.productReview.delete({ where: { id } });
        res.status(204).send();
    } catch (error) { next(error); }
};

// Support Ticket Controller
export const updateSupportTicket = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const { status, messages } = req.body;
    try {
        const ticket = await prisma.supportTicket.update({
            where: { id },
            data: { status, messages }
        });
        await logAdminAction(authReq, 'Updated support ticket', `Ticket ID: ${id}, Status: ${status}`);
        res.json(ticket);
    } catch(error) {
        next(error);
    }
};

// Chat Controllers
export const getAdminChatSessions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sessions = await prisma.chatSession.findMany({
            orderBy: { lastUpdated: 'desc' },
            include: {
                user: { select: { name: true }},
                messages: { orderBy: { timestamp: 'desc' }, take: 1, select: { text: true }}
            }
        });
        res.json(sessions);
    } catch (error) { next(error); }
};

export const getChatMessages = async (req: Request, res: Response, next: NextFunction) => {
    const { sessionId } = req.params;
    try {
        const messages = await prisma.chatMessage.findMany({
            where: { sessionId },
            orderBy: { timestamp: 'asc' }
        });
        res.json(messages);
    } catch (error) { next(error); }
};

export const sendAdminMessage = async (req: Request, res: Response, next: NextFunction) => {
    const { sessionId } = req.params;
    const { text } = req.body;
    try {
        const message = await prisma.chatMessage.create({
            data: {
                sessionId,
                text,
                sender: 'admin'
            }
        });
        await prisma.chatSession.update({
            where: { id: sessionId },
            data: { lastUpdated: new Date() }
        });
        res.status(201).json(message);
    } catch (error) { next(error); }
};

// FAQ Controllers
export const getFaqs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const faqs = await prisma.faq.findMany({ orderBy: { order: 'asc' } });
        res.json(faqs);
    } catch (error) { next(error); }
};
export const createFaq = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const faq = await prisma.faq.create({ data: req.body });
        res.status(201).json(faq);
    } catch (error) { next(error); }
};
export const updateFaq = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const faq = await prisma.faq.update({ where: { id: req.params.id }, data: req.body });
        res.json(faq);
    } catch (error) { next(error); }
};
export const deleteFaq = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await prisma.faq.delete({ where: { id: req.params.id } });
        res.status(204).send();
    } catch (error) { next(error); }
};

// User & Role Management
export const createAdminUser = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { name, email, password, role, isActive } = req.body;
    if (!name || !email || !password || !role) {
        return res.status(400).json({ message: 'Name, email, password, and role are required.' });
    }
    try {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(409).json({ message: 'Email already in use' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { name, email, password: hashedPassword, role, isActive },
        });
        await logAdminAction(authReq, 'Created admin user', `Name: ${user.name}`);
        const { password: _, ...userResponse } = user;
        res.status(201).json(userResponse);
    } catch (error) { next(error); }
};

export const updateAdminUser = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const { name, email, role, isActive, password } = req.body;
    try {
        const dataToUpdate: any = { name, email, role, isActive };
        if (password && password.length > 0) {
            dataToUpdate.password = await bcrypt.hash(password, 10);
        }
        const user = await prisma.user.update({ where: { id }, data: dataToUpdate });
        await logAdminAction(authReq, 'Updated admin user', `Name: ${user.name}`);
        const { password: _, ...userResponse } = user;
        res.json(userResponse);
    } catch (error) { next(error); }
};

export const deleteAdminUser = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    try {
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) return res.status(404).json({ message: 'User not found' });
        await prisma.user.delete({ where: { id } });
        await logAdminAction(authReq, 'Deleted admin user', `Name: ${user.name}`);
        res.status(204).send();
    } catch (error) { next(error); }
};

// Payment Gateway Controllers
export const getPaymentGateways = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const defaultGateways = [
            { name: 'Razorpay', enabled: false, settings: {} },
            { name: 'Cash on Delivery', enabled: true, settings: {} }
        ];
        
        for (const gateway of defaultGateways) {
            await prisma.paymentGateway.upsert({
                where: { name: gateway.name },
                update: {},
                create: gateway,
            });
        }
        
        const gateways = await prisma.paymentGateway.findMany();
        res.json(gateways);
    } catch (error) { next(error); }
};
export const updatePaymentGateway = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const dataToUpdate = { ...req.body };
    delete dataToUpdate.id; // Explicitly remove id from the update payload

    try {
        const gateway = await prisma.paymentGateway.update({
            where: { id },
            data: dataToUpdate,
        });
        res.json(gateway);
    } catch (error) {
        console.error("Failed to update payment gateway:", error);
        next(error);
    }
};


// Shipping Controllers
export const getShippingZones = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const zones = await prisma.shippingZone.findMany({ include: { rates: true } });
        res.json(zones);
    } catch (error) { next(error); }
};
export const createShippingZone = async (req: Request, res: Response, next: NextFunction) => {
    const { rates, ...zoneData } = req.body;
    try {
        const data: any = { ...zoneData };
        if (rates && Array.isArray(rates) && rates.length > 0) {
            data.rates = {
                create: rates.map((rate: any) => ({
                    name: rate.name,
                    price: rate.price,
                    condition: rate.condition,
                    conditionValue: rate.conditionValue
                }))
            };
        }
        const zone = await prisma.shippingZone.create({ data });
        res.status(201).json(zone);
    } catch (error) { next(error); }
};
export const updateShippingZone = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const zone = await prisma.shippingZone.update({ where: { id: req.params.id }, data: req.body });
        res.json(zone);
    } catch (error) { next(error); }
};
export const deleteShippingZone = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await prisma.shippingZone.delete({ where: { id: req.params.id } });
        res.status(204).send();
    } catch (error) { next(error); }
};
export const getShippingProviders = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const providers = await prisma.shippingProvider.findMany();
        res.json(providers);
    } catch (error) { next(error); }
};
export const updateShippingProvider = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const provider = await prisma.shippingProvider.update({ where: { id: req.params.id }, data: req.body });
        res.json(provider);
    } catch (error) { next(error); }
};

// Site Settings
export const getSiteSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const settings = await prisma.siteSettings.findFirst({ where: { singleton: 'global_settings' } });
        res.json(settings);
    } catch (error) { next(error); }
};

export const updateSiteSettings = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { id, ...settingsData } = req.body;
    try {
        const settings = await prisma.siteSettings.upsert({
            where: { singleton: 'global_settings' },
            update: settingsData,
            create: { ...settingsData, singleton: 'global_settings' }
        });
        await logAdminAction(authReq, 'Updated site settings');
        res.json(settings);
    } catch (error) {
        next(error);
    }
};

// Admin Dashboard
export const getDashboardData = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const getCustomerDataPromise = prisma.user.findMany({
            where: { role: 'USER' },
            orderBy: { joinDate: 'desc' },
            include: {
                _count: { select: { orders: true }},
                orders: {
                    select: { totalAmount: true, orderDate: true },
                    orderBy: { orderDate: 'desc' },
                }
            }
        });

        const [orders, customersData, coupons, adminUsers, mediaLibrary, marketingCampaigns, siteSettings] = await Promise.all([
            prisma.order.findMany({ orderBy: { orderDate: 'desc' }, include: { user: { select: { name: true }}} }),
            getCustomerDataPromise,
            prisma.coupon.findMany(),
            prisma.user.findMany({ where: { role: 'ADMIN' } }),
            prisma.mediaFile.findMany(),
            prisma.marketingCampaign.findMany(),
            prisma.siteSettings.findFirst()
        ]);
        
        const customers = customersData.map(c => ({
            id: c.id,
            name: c.name,
            email: c.email,
            phone: c.phone,
            joinDate: c.joinDate,
            totalOrders: c._count.orders,
            totalSpent: c.orders.reduce((sum, order) => sum + order.totalAmount, 0),
            lastOrderDate: c.orders.length > 0 ? c.orders[0].orderDate : undefined,
            profilePictureUrl: c.profilePictureUrl,
            isBlocked: c.isBlocked,
        }));
        
        res.json({ orders, customers, coupons, adminUsers, mediaLibrary, marketingCampaigns, siteSettings });
    } catch (error) {
        next(error);
    }
};

// Analytics
export const getWishlistAnalytics = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const allUsers = await prisma.user.findMany({
            select: { wishlistProductIds: true }
        });
        const wishlistCounts: Record<string, number> = {};
        allUsers.forEach(user => {
            user.wishlistProductIds.forEach(productId => {
                wishlistCounts[productId] = (wishlistCounts[productId] || 0) + 1;
            });
        });
        const productIds = Object.keys(wishlistCounts);
        const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
        const analytics = products.map(product => ({
            product,
            count: wishlistCounts[product.id]
        })).sort((a, b) => b.count - a.count);

        res.json(analytics);
    } catch (error) {
        next(error);
    }
};

// Notifications Controller
export const getNotifications = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const recentOrders = await prisma.order.findMany({
            take: 5,
            orderBy: { orderDate: 'desc' },
            where: { status: 'Processing' }
        });

        const newUsers = await prisma.user.findMany({
            take: 3,
            orderBy: { joinDate: 'desc' },
            where: { role: 'USER' }
        });

        const notifications: any[] = [];

        if (recentOrders && Array.isArray(recentOrders)) {
            recentOrders.forEach(order => {
                notifications.push({
                    id: `order_${order.id}`,
                    title: 'New Order Received',
                    message: `Order #${order.id.slice(-6)} for ₹${order.totalAmount.toFixed(2)} needs processing.`,
                    type: 'order',
                    seen: false, // In a real app, this would be stored per admin
                    timestamp: order.orderDate.toISOString(),
                    link: {
                        page: 'adminDashboard',
                        data: { section: 'orders_all' }
                    }
                });
            });
        }

        if (newUsers && Array.isArray(newUsers)) {
            newUsers.forEach(user => {
                notifications.push({
                    id: `user_${user.id}`,
                    title: 'New User Registered',
                    message: `${user.name} has just signed up.`,
                    type: 'user',
                    seen: false,
                    timestamp: user.joinDate.toISOString(),
                    link: {
                        page: 'adminDashboard',
                        data: { section: 'customers_all' }
                    }
                });
            });
        }

        // Sort by timestamp desc
        notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        res.json(notifications);
    } catch (error) {
        next(error);
    }
};

// Integrations
const DEFAULT_INTEGRATIONS = [
    { name: 'Facebook Pixel', category: 'Marketing', enabled: false, settings: {} },
    { name: 'Razorpay', category: 'Payments', enabled: false, settings: {} },
    { name: 'Shiprocket', category: 'Shipping', enabled: false, settings: {} },
    { name: 'Mailchimp', category: 'Marketing', enabled: false, settings: {} }
];

export const getIntegrations = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Use upsert to be idempotent: create if not exists, do nothing if it does.
        for (const defaultInteg of DEFAULT_INTEGRATIONS) {
            await prisma.integration.upsert({
                where: { name: defaultInteg.name },
                update: {}, // Do nothing if it already exists
                create: defaultInteg,
            });
        }

        const integrations = await prisma.integration.findMany();
        res.json(integrations);
    } catch (error) {
        next(error);
    }
};

export const updateIntegration = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const dataToUpdate = { ...req.body };
    delete dataToUpdate.id;

    try {
        const integration = await prisma.integration.update({
            where: { id },
            data: dataToUpdate,
        });
        await logAdminAction(authReq, 'Updated integration', `Name: ${integration.name}`);
        res.json(integration);
    } catch (error) {
        next(error);
    }
};