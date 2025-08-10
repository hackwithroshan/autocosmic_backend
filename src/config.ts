import dotenv from 'dotenv';
dotenv.config();

const config = {
    port: process.env.PORT || 5000,
    databaseUrl: process.env.DATABASE_URL,
    jwt: {
        secret: process.env.JWT_SECRET || 'default-secret',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
    razorpay: {
        keyId: process.env.RAZORPAY_KEY_ID,
        keySecret: process.env.RAZORPAY_KEY_SECRET,
    },
    gcs: {
        bucketName: process.env.GCS_BUCKET_NAME,
    },
    email: {
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587', 10),
        secure: process.env.EMAIL_SECURE === 'true',
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    }
};

export default config;