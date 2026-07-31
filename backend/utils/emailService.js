const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const generateCode = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
};

const sendEmail = async (to, subject, html) => {
    if (!resend) {
        console.warn(`[EMAIL_DEV_MODE] To: ${to} | Subject: ${subject}`);
        return true;
    }

    try {
        await resend.emails.send({
            from: 'Stratmont Investments <noreply@stratmont.xyz>', // Custom domain for production
            to,
            subject,
            html
        });
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
};

const getEmailTemplate = (title, code) => {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #111; color: #fff; padding: 20px; border-top: 4px solid #D4AF37;">
        <h2 style="color: #D4AF37; text-align: center;">Stratmont Investments</h2>
        <div style="background-color: #222; padding: 20px; border-radius: 8px; margin-top: 20px;">
            <h3 style="color: #fff; margin-top: 0;">${title}</h3>
            <p style="color: #ccc; font-size: 16px;">Please use the verification code below to proceed:</p>
            <div style="background-color: #333; padding: 15px; text-align: center; font-size: 24px; letter-spacing: 5px; color: #D4AF37; font-weight: bold; border-radius: 4px; margin: 20px 0;">
                ${code}
            </div>
            <p style="color: #999; font-size: 14px; text-align: center;">This code will expire in 10 minutes.</p>
        </div>
        <p style="color: #666; font-size: 12px; text-align: center; margin-top: 20px;">
            If you did not request this code, please ignore this email.
        </p>
    </div>
    `;
};

const sendVerificationCode = async (email, code) => {
    if (!resend) {
        console.log(`[EMAIL_DEV_MODE] Registration Code for ${email}: ${code}`);
        return true;
    }
    const html = getEmailTemplate('Email Verification', code);
    return sendEmail(email, 'Verify your email - Stratmont Investments', html);
};

const sendLoginVerificationCode = async (email, code) => {
    if (!resend) {
        console.log(`[EMAIL_DEV_MODE] Login Code for ${email}: ${code}`);
        return true;
    }
    const html = getEmailTemplate('Login Verification', code);
    return sendEmail(email, 'Your login code - Stratmont Investments', html);
};

module.exports = {
    generateCode,
    sendVerificationCode,
    sendLoginVerificationCode
};
