import { Storage } from '@google-cloud/storage';
import config from '../config';

// This will automatically use the GOOGLE_APPLICATION_CREDENTIALS environment variable
// if it's set in the .env file, which should point to your service account JSON key.
const storage = new Storage();

const bucketName = config.gcs.bucketName;

if (!bucketName) {
    throw new Error("GCS_BUCKET_NAME is not set in the environment variables. Please check your backend/.env file.");
}

const bucket = storage.bucket(bucketName);

export const getGcsSignedUrl = async (fileName: string, fileType: string): Promise<{ uploadUrl: string; fileUrl: string }> => {
    const key = `uploads/${Date.now()}_${encodeURIComponent(fileName)}`;
    const file = bucket.file(key);

    const options = {
        version: 'v4' as const,
        action: 'write' as const,
        expires: Date.now() + 15 * 60 * 1000, // URL is valid for 15 minutes
        contentType: fileType,
    };

    try {
        // Generate the signed URL for uploading
        const [uploadUrl] = await file.getSignedUrl(options);
        
        // This is the public, permanent URL the file will have after upload
        const fileUrl = `https://storage.googleapis.com/${bucketName}/${key}`;

        return { uploadUrl, fileUrl };
    } catch (error) {
        console.error('Error generating signed URL for GCS:', error);
        throw new Error('Could not generate upload URL. Ensure your Google Cloud Storage setup is correct.');
    }
};
