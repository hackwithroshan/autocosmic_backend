import prisma from '../prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

export const logAdminAction = async (
    req: AuthRequest,
    action: string,
    details?: string
) => {
    if (!req.user) {
        console.warn('Attempted to log an action without an authenticated user.');
        return;
    }
    
    try {
        await prisma.adminActivityLog.create({
            data: {
                adminUserId: req.user.id,
                adminUserName: (await prisma.user.findUnique({ where: { id: req.user.id } }))?.name || 'Unknown Admin',
                action,
                details,
                ipAddress: req.ip,
            },
        });
    } catch (error) {
        console.error('Failed to create admin activity log:', error);
    }
};