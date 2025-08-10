import Razorpay from 'razorpay';
import prisma from '../prisma';

let razorpayInstance: Razorpay | null = null;
let lastFetched: number = 0;

export const getRazorpayInstance = async (): Promise<Razorpay | null> => {
    // Basic caching to avoid DB hit on every single payment request within a short time frame
    const cacheValid = Date.now() - lastFetched < 60000; // 1 minute cache
    if (razorpayInstance && cacheValid) {
        return razorpayInstance;
    }

    try {
        const razorpaySettings = await prisma.integration.findUnique({
            where: { name: 'Razorpay' },
        });

        if (razorpaySettings && razorpaySettings.enabled) {
            const settings: any = razorpaySettings.settings;
            const keyId = settings?.apiKey;
            const keySecret = settings?.apiSecret;

            if (keyId && keySecret) {
                razorpayInstance = new Razorpay({
                    key_id: keyId,
                    key_secret: keySecret,
                });
                lastFetched = Date.now();
                return razorpayInstance;
            }
        }
        
        // If settings are not found, disabled, or incomplete
        razorpayInstance = null;
        return null;

    } catch (error) {
        console.error("Failed to fetch Razorpay settings from DB:", error);
        razorpayInstance = null;
        return null;
    }
};
