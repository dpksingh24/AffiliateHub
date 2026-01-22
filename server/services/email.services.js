const sgMail = require('@sendgrid/mail');

class EmailService {
    static sendGridInitialized = false;

    static initializeSendGrid() {
        if (this.sendGridInitialized) {
            return true;
        }

        const sendGridApiKey = process.env.SENDGRID_API_KEY;
        if (sendGridApiKey) {
            sgMail.setApiKey(sendGridApiKey);
            this.sendGridInitialized = true;
            console.log('✅ [EMAIL_SERVICE] SendGrid initialized successfully');
            return true;
        } else {
            console.log('⚠️ [EMAIL_SERVICE] SendGrid API key not found, using development mode');
            return false;
        }
    }

    static async sendEmail(to, subject, text, html = null) {
        if (!this.sendGridInitialized) {
            const initialized = this.initializeSendGrid();
            if (!initialized) {
                console.log(`📧 [DEV MODE] Would send email to: ${to}`);
                console.log(`   Subject: ${subject}`);
                console.log(`   Body: ${text}`);
                return { success: true, devMode: true };
            }
        }

        const msg = {
            to,
            from: process.env.SENDGRID_FROM_EMAIL || 'noreply@kiscience.com',
            subject,
            text,
        };

        if (html) {
            msg.html = html;
        }

        try {
            await sgMail.send(msg);
            console.log(`✅ [EMAIL_SERVICE] Email sent to: ${to}`);
            return { success: true };
        } catch (error) {
            console.error('❌ [EMAIL_SERVICE] Failed to send email:', error.message);
            if (error.response) {
                console.error('   Response body:', error.response.body);
            }
            return { success: false, error: error.message };
        }
    }

    static async sendSubmissionReceivedEmail(to, formName, submitterName = null) {
        const name = submitterName || 'Applicant';
        const subject = `Application Received - ${formName}`;
        
        const text = `Dear ${name},

Thank you for submitting your application.

Your application has been received, and it is currently under review by the admin team.

We will notify you once the review process is complete.

Best regards,
KiScience Team`;

        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #7db9b3; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f8fbfd; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
        .footer { margin-top: 20px; text-align: center; color: #666; font-size: 12px; }
        h1 { margin: 0; font-size: 24px; }
        .highlight { background-color: #e8f5f3; padding: 15px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #7db9b3; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Application Received</h1>
        </div>
        <div class="content">
            <p>Dear ${name},</p>
            <p>Thank you for submitting your application.</p>
            <div class="highlight">
                <strong>Your application has been received, and it is currently under review by the admin team.</strong>
            </div>
            <p>We will notify you once the review process is complete.</p>
            <p>Best regards,<br><strong>KiScience Team</strong></p>
        </div>
        <div class="footer">
            <p>©Copyright 2026 KISCIENCE TECHNOLOGIES PVT. LTD.</p>
        </div>
    </div>
</body>
</html>`;

        return await this.sendEmail(to, subject, text, html);
    }

    static async sendApprovalEmail(to, formName, submitterName = null) {
        const name = submitterName || 'Applicant';
        const subject = `Application Approved - ${formName}`;
        
        const text = `Dear ${name},

Congratulations! Your application has been approved.

Thank you for your patience during the review process.

Best regards,
KiScience Team`;

        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #28a745; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f8fbfd; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
        .footer { margin-top: 20px; text-align: center; color: #666; font-size: 12px; }
        h1 { margin: 0; font-size: 24px; }
        .highlight { background-color: #d4edda; padding: 15px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #28a745; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Application Approved!</h1>
        </div>
        <div class="content">
            <p>Dear ${name},</p>
            <div class="highlight">
                <strong>Congratulations! Your application has been approved.</strong>
            </div>
            <p>Thank you for your patience during the review process.</p>
            <p>Best regards,<br><strong>KiScience Team</strong></p>
        </div>
        <div class="footer">
            <p>©Copyright 2026 KISCIENCE TECHNOLOGIES PVT. LTD.</p>
        </div>
    </div>
</body>
</html>`;

        return await this.sendEmail(to, subject, text, html);
    }

    static async sendRejectionEmail(to, formName, submitterName = null, reason = null) {
        const name = submitterName || 'Applicant';
        const subject = `Application Update - ${formName}`;
        
        let text = `Dear ${name},

Thank you for your interest and for taking the time to submit your application.

After careful review, we regret to inform you that your application has not been approved at this time.`;

        if (reason) {
            text += `\n\nReason: ${reason}`;
        }

        text += `\n\nBest regards,\nKiScience Team`;

        let reasonHtml = '';
        if (reason) {
            reasonHtml = `<p><strong>Reason:</strong> ${reason}</p>`;
        }

        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #6c757d; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f8fbfd; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
        .footer { margin-top: 20px; text-align: center; color: #666; font-size: 12px; }
        h1 { margin: 0; font-size: 24px; }
        .highlight { background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #6c757d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Application Update</h1>
        </div>
        <div class="content">
            <p>Dear ${name},</p>
            <p>Thank you for your interest and for taking the time to submit your application.</p>
            <div class="highlight">
                After careful review, we regret to inform you that your application has not been approved at this time.
            </div>
            ${reasonHtml}
            <p>Best regards,<br><strong>KiScience Team</strong></p>
        </div>
        <div class="footer">
            <p>©Copyright 2026 KISCIENCE TECHNOLOGIES PVT. LTD.</p>
        </div>
    </div>
</body>
</html>`;

        return await this.sendEmail(to, subject, text, html);
    }
}

module.exports = EmailService;
