
import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';

export const errorHandler: ErrorRequestHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Something went wrong on the server.';
    
    res.status(statusCode).json({
        success: false,
        status: statusCode,
        message: message,
    });
};