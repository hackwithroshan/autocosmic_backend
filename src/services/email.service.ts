
import nodemailer from 'nodemailer';
import config from '../config';

const transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure, // true for 465, false for other ports
    auth: {
        user: config.email.user,
        pass: config.email.pass,
    },
});

// The sendAdminLoginOtp function has been removed as 2FA is no longer in use.
// Other email functions (e.g., for order confirmation) would go here.
