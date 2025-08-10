
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import prisma from '../prisma';

export type AuthRequest = Request & {
    user?: {
        id: string;
        role: string;
    };
};

export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const authHeader = authReq.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, config.jwt.secret) as { id: string; role: string; iat: number; exp: number };
        
        authReq.user = { id: decoded.id, role: decoded.role };
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }
};

export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    if (authReq.user?.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }
    next();
};