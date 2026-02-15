const sgMail = require('@sendgrid/mail');
const nodemailer = require('nodemailer');
const { substitute } = require('./emailTemplates');

class EmailService {
    static sendGridInitialized = false;
    static gmailTransporter = null;

    // Initialize Gmail SMTP transporter
    static initializeGmail() {
        if (this.gmailTransporter) return true;

        const user = process.env.GMAIL_USER;
        const pass = process.env.GMAIL_APP_PASSWORD;

        if (!user || !pass) {
            console.log('⚠️ [EMAIL_SERVICE] Gmail credentials not found');
            return false;
        }

        this.gmailTransporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user, pass }
        });

        console.log('✅ [EMAIL_SERVICE] Gmail SMTP initialized');
        return true;
    }

    // Initialize SendGrid
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

    // static async sendEmail(to, subject, text, html = null) {
    //     if (!this.sendGridInitialized) {
    //         const initialized = this.initializeSendGrid();
    //         if (!initialized) {
    //             console.log(`📧 [DEV MODE] Would send email to: ${to}`);
    //             console.log(`   Subject: ${subject}`);
    //             console.log(`   Body: ${text}`);
    //             return { success: true, devMode: true };
    //         }
    //     }

    //     const msg = {
    //         to,
    //         from: process.env.SENDGRID_FROM_EMAIL || 'noreply@kiscience.com',
    //         subject,
    //         text,
    //     };

    //     if (html) {
    //         msg.html = html;
    //     }

    //     try {
    //         await sgMail.send(msg);
    //         console.log(`✅ [EMAIL_SERVICE] Email sent to: ${to}`);
    //         return { success: true };
    //     } catch (error) {
    //         console.error('❌ [EMAIL_SERVICE] Failed to send email:', error.message);
    //         if (error.response) {
    //             console.error('   Response body:', error.response.body);
    //         }
    //         return { success: false, error: error.message };f
    //     }
    // }
    /**
     * @param {string} to
     * @param {string} subject
     * @param {string} text
     * @param {string|null} html
     * @param {{ filename: string, content: Buffer, contentType?: string }[]} [attachments]
     */
    static async sendEmail(to, subject, text, html = null, attachments = null) {
        const attachmentList = attachments && attachments.length ? attachments : [];

        // 1️⃣ Try SendGrid first
        if (!this.sendGridInitialized) {
            this.initializeSendGrid();
        }

        if (this.sendGridInitialized) {
            try {
                const msg = {
                    to,
                    from: process.env.SENDGRID_FROM_EMAIL || 'noreply@kiscience.com',
                    subject,
                    text,
                    html
                };
                if (attachmentList.length) {
                    msg.attachments = attachmentList.map(({ filename, content, contentType }) => ({
                        content: content.toString('base64'),
                        filename,
                        type: contentType || undefined
                    }));
                }
                await sgMail.send(msg);

                console.log(`✅ [SENDGRID] Email sent to ${to}`);
                return { success: true, provider: 'sendgrid' };
            } catch (error) {
                console.error('❌ [SENDGRID] Failed, falling back to Gmail:', error.message);
            }
        }

        // 2️⃣ Fallback to Gmail
        const gmailReady = this.initializeGmail();
        if (!gmailReady) {
            console.log(`📧 [DEV MODE] Would send email to ${to}`);
            return { success: true, devMode: true };
        }

        try {
            const mailOptions = {
                from: `"KiScience" <${process.env.GMAIL_USER}>`,
                to,
                subject,
                text,
                html
            };
            if (attachmentList.length) {
                mailOptions.attachments = attachmentList.map(({ filename, content }) => ({ filename, content }));
            }
            await this.gmailTransporter.sendMail(mailOptions);

            console.log(`✅ [GMAIL] Email sent to ${to}`);
            return { success: true, provider: 'gmail' };
        } catch (error) {
            console.error('❌ [GMAIL] Failed to send email:', error.message);
            return { success: false, error: error.message };
        }
    }


    static async sendSubmissionReceivedEmail(to, formName, submitterName = null, templateOverride = null) {
        const name = submitterName || 'Applicant';
        const vars = { name, formName };
        let subject, text, html;
        if (templateOverride && (templateOverride.subject != null || templateOverride.html != null)) {
            subject = substitute(templateOverride.subject, vars);
            text = substitute(templateOverride.text, vars);
            html = substitute(templateOverride.html, vars);
        } else {
            subject = `Application Received - ${formName}`;
            text = `Dear ${name},\n\nThank you for submitting your application.\n\nYour application has been received, and it is currently under review by the admin team.\n\nWe will notify you once the review process is complete.\n\nBest regards,\nKiScience Team`;
            html = null;
        }
        return await this.sendEmail(to, subject, text, html);
    }

    static async sendApprovalEmail(to, formName, submitterName = null, templateOverride = null, attachment = null) {
        const name = submitterName || 'Applicant';
        const vars = { name, formName };
        let subject, text, html;
        if (templateOverride && (templateOverride.subject != null || templateOverride.html != null)) {
            subject = substitute(templateOverride.subject, vars);
            text = substitute(templateOverride.text, vars);
            html = substitute(templateOverride.html, vars);
        } else {
            subject = `Application Approved - ${formName}`;
            text = `Dear ${name},\n\nCongratulations! Your application has been approved.\n\nThank you for your patience during the review process.\n\nBest regards,\nKiScience Team`;
            html = null;
        }
        const attachments = attachment ? [attachment] : null;
        return await this.sendEmail(to, subject, text, html, attachments);
    }

    static async sendRejectionEmail(to, formName, submitterName = null, reason = null, templateOverride = null, attachment = null) {
        const name = submitterName || 'Applicant';
        const vars = { name, formName, reason: reason || '' };
        let subject, text, html;
        if (templateOverride && (templateOverride.subject != null || templateOverride.html != null)) {
            subject = substitute(templateOverride.subject, vars);
            text = substitute(templateOverride.text, vars);
            html = substitute(templateOverride.html, vars);
        } else {
            subject = `Application Update - ${formName}`;
            text = `Dear ${name},\n\nThank you for your interest and for taking the time to submit your application.\n\nAfter careful review, we regret to inform you that your application has not been approved at this time.${reason ? '\n\nReason: ' + reason : ''}\n\nBest regards,\nKiScience Team`;
            html = null;
        }
        const attachments = attachment ? [attachment] : null;
        return await this.sendEmail(to, subject, text, html, attachments);
    }


    // affiliate submission received email template
    static async sendAffiliateRegistrationEmail(to, formName, submitterName = null, templateOverride = null) {
        const name = submitterName || 'Applicant';
        const vars = { name, formName };
        if (templateOverride && (templateOverride.subject != null || templateOverride.html != null)) {
            const subject = substitute(templateOverride.subject, vars);
            const text = substitute(templateOverride.text, vars);
            const html = substitute(templateOverride.html, vars);
            return await this.sendEmail(to, subject, text, html);
        }
        const subject = `Affiliate Registration Received – ${formName}`;
    
        const text = `Dear ${name},
    
    Thank you for registering for our affiliate program.
    
    We’ve successfully received your application and our team is currently reviewing it.
    
    You’ll receive another email once your application has been approved or if we need additional information.
    
    Best regards,
    KiScience Team`;
    
        const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #ffffff;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background-color: #2B7BE5;
          color: #ffffff;
          padding: 24px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .content {
          background-color: #f8fbfd;
          padding: 30px;
          border: 1px solid #e5e7eb;
          border-top: none;
          border-radius: 0 0 10px 10px;
        }
        h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
        }
        p {
          margin: 0 0 14px;
          font-size: 15px;
        }
        .highlight {
          background-color: #e8f1fd;
          padding: 16px;
          border-radius: 6px;
          margin: 20px 0;
          border-left: 4px solid #2B7BE5;
          font-size: 15px;
        }
        .footer {
          margin-top: 24px;
          text-align: center;
          color: #6b7280;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Affiliate Registration Received</h1>
        </div>
    
        <div class="content">
          <p>Dear ${name},</p>
    
          <p>Thank you for registering for our affiliate program.</p>
    
          <div class="highlight">
            <strong>Your application has been successfully received and is currently under review by our team.</strong>
          </div>
    
          <p>
            You’ll be notified by email once your application has been approved,
            or if we require any additional details from you.
          </p>
    
          <p>
            Best regards,<br />
            <strong>KiScience Team</strong>
          </p>
        </div>
    
        <div class="footer">
          <p>© 2026 KiScience Technologies Pvt. Ltd. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
    `;
        return await this.sendEmail(to, subject, text, html);
    }

    /** Admin email to notify when any form (practitioner or affiliate) is submitted */
    static get ADMIN_NOTIFICATION_EMAIL() {
        return process.env.ADMIN_NOTIFICATION_EMAIL;
    }

    /**
     * Send a notification to admin when a new form submission is received.
     * @param {string} formName - Name of the form
     * @param {'practitioner'|'affiliate'} formType - Type of form
     * @param {string} [applicantFullName] - Applicant's first and last name (shown in subject)
     * @param {string} [applicantEmail] - Applicant's email (shown in brackets after name)
     */
    static async sendNewSubmissionNotificationToAdmin(formName, formType, applicantFullName = null, applicantEmail = null) {
        const to = this.ADMIN_NOTIFICATION_EMAIL;
        const typeLabel = formType === 'affiliate' ? 'Affiliate' : 'Practitioner';
        const displayName = (applicantFullName && applicantFullName.trim()) ? applicantFullName.trim() : formName;
        const applicantLine = applicantEmail && applicantEmail.trim()
            ? `${displayName} (${applicantEmail.trim()})`
            : displayName;
        const subject = `[KiScience] New ${typeLabel} Form Submission – ${displayName}`;
        const text = `A new ${typeLabel.toLowerCase()} form submission has been received.\n\nApplicant: ${applicantLine}\nForm: ${formName}\nSubmitted at: ${new Date().toISOString()}\n\nPlease check the admin panel for details.`;
        const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 560px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #2B7BE5;">New ${typeLabel} Form Submission</h2>
    <p>A new ${typeLabel.toLowerCase()} form submission has been received.</p>
    <p><strong>Applicant:</strong> ${applicantLine}</p>
    <p><strong>Form:</strong> ${formName}</p>
    <p><strong>Submitted at:</strong> ${new Date().toISOString()}</p>
    <p>Please check the admin panel for details.</p>
  </div>
</body>
</html>`;
        return await this.sendEmail(to, subject, text, html);
    }

    static async sendAffiliateApprovalEmail(to, formName, submitterName = null, templateOverride = null, dashboardUrl = null, attachment = null) {
        const name = submitterName || 'Applicant';
        const dashboard = dashboardUrl || 'https://kiscience.myshopify.com/pages/affiliate-area';
        const vars = { name, formName, dashboardUrl: dashboard };
        let subject, text, html;
        if (templateOverride && (templateOverride.subject != null || templateOverride.html != null)) {
            subject = substitute(templateOverride.subject, vars);
            text = substitute(templateOverride.text, vars);
            html = substitute(templateOverride.html, vars);
        } else {
            subject = `Application Approved - ${formName}`;
            text = `Dear ${name},\n\nCongratulations! Your affiliate application has been approved.\n\nYou can access your affiliate dashboard here: ${dashboard}\n\nThank you for your patience during the review process.\n\nBest regards,\nKiScience Team`;
            html = null;
        }
        const attachments = attachment ? [attachment] : null;
        return await this.sendEmail(to, subject, text, html, attachments);
    }

    static async sendAffiliateRejectionEmail(to, formName, submitterName = null, reason = null, templateOverride = null, attachment = null) {
        const name = submitterName || 'Applicant';
        const vars = { name, formName, reason: reason || '' };
        let subject, text, html;
        if (templateOverride && (templateOverride.subject != null || templateOverride.html != null)) {
            subject = substitute(templateOverride.subject, vars);
            text = substitute(templateOverride.text, vars);
            html = substitute(templateOverride.html, vars);
        } else {
            subject = `Affiliate Application Update - ${formName}`;
            text = `Dear ${name},\n\nThank you for your interest and for taking the time to submit your affiliate application.\n\nAfter careful review, we regret to inform you that your affiliate application has not been approved at this time.${reason ? '\n\nReason: ' + reason : ''}\n\nBest regards,\nKiScience Team`;
            html = null;
        }
        const attachments = attachment ? [attachment] : null;
        return await this.sendEmail(to, subject, text, html, attachments);
    }

    /**
     * Send notification to affiliate when a new referral (conversion) is recorded.
     * @param {string} to - Affiliate email
     * @param {Object} opts - { affiliateName, orderDisplay, amount, currency, commissionAmount }
     */
    static async sendNewReferralNotificationToAffiliate(to, opts = {}) {
        const name = opts.affiliateName || 'Affiliate';
        const orderDisplay = opts.orderDisplay || opts.orderId || '—';
        const amount = opts.amount != null ? Number(opts.amount).toFixed(2) : '0.00';
        const currency = opts.currency || 'USD';
        const commissionAmount = opts.commissionAmount != null ? Number(opts.commissionAmount).toFixed(2) : '0.00';
        const subject = `[KiScience] You got a new referral – Order ${orderDisplay}`;
        const text = `Hi ${name},\n\nGreat news! A sale was made through your referral link.\n\nOrder: ${orderDisplay}\nOrder total: ${currency} ${amount}\nYour commission: ${currency} ${commissionAmount}\n\nYou can view your referrals and earnings in your affiliate dashboard.\n\nBest regards,\nKiScience Team`;
        const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 560px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #2B7BE5;">You got a new referral</h2>
    <p>Hi ${name},</p>
    <p>A sale was made through your referral link.</p>
    <table style="border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding: 6px 12px 6px 0; color: #6b7280;">Order</td><td style="padding: 6px 0;">${orderDisplay}</td></tr>
      <tr><td style="padding: 6px 12px 6px 0; color: #6b7280;">Order total</td><td style="padding: 6px 0;">${currency} ${amount}</td></tr>
      <tr><td style="padding: 6px 12px 6px 0; color: #6b7280;">Your commission</td><td style="padding: 6px 0;"><strong>${currency} ${commissionAmount}</strong></td></tr>
    </table>
    <p>You can view your referrals and earnings in your <a href="https://kiscience.myshopify.com/pages/affiliate-area">affiliate area</a>.</p>
    <p>Best regards,<br>KiScience Team</p>
  </div>
</body>
</html>`;
        return await this.sendEmail(to, subject, text, html);
    }
    
}

module.exports = EmailService;
