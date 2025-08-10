
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';
import config from '../config';
import { logAdminAction } from '../services/audit.service';
import { AuthRequest } from '../middlewares/auth.middleware';

const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    if (password.length < 8) {
        errors.push('Must be at least 8 characters long.');
    }
    if (!/[A-Z]/.test(password)) {
        errors.push('Must contain at least one uppercase letter.');
    }
    if (!/[a-z]/.test(password)) {
        errors.push('Must contain at least one lowercase letter.');
    }
    if (!/[0-9]/.test(password)) {
        errors.push('Must contain at least one number.');
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('Must contain at least one special character.');
    }
    return {
        isValid: errors.length === 0,
        errors,
    };
};

export const register = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { name, email, password } = req.body;

    // --- Input Validation ---
    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Name, email, and password are required.' });
    }
    
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
        return res.status(400).json({ message: 'Password is not strong enough.', errors: passwordValidation.errors });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Please enter a valid email address.' });
    }
    // --- End Validation ---

    try {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(409).json({ message: 'Email already in use' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await prisma.user.create({
            data: { name, email, password: hashedPassword },
        });

        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        next(error);
    }
};

export const login = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authReq = req as AuthRequest;
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        // Simplified: Directly issue JWT for both users and admins
        const tokenPayload = { id: user.id, role: user.role };
        const token = jwt.sign(tokenPayload, config.jwt.secret, {
            expiresIn: config.jwt.expiresIn,
        } as jwt.SignOptions);
        
        authReq.user = { id: user.id, role: user.role };

        if(user.role === 'ADMIN') {
            await logAdminAction(authReq, 'Admin Logged In');
        }

        const { password: _, ...userResponse } = user;
        res.json({
            token,
            user: userResponse,
        });
    } catch (error) {
        next(error);
    }
};
