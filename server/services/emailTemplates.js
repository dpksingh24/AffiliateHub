/**
 * Email template storage and defaults.
 * Admin edits only subject + plain text; HTML is auto-generated from plain text when sending.
 * Placeholders: {{name}}, {{reason}}, {{dashboardUrl}}. Subject lines use {{name}} for applicant full name.
 */

function getHeaderHtml() {
  return '<h1 style="margin:0;font-size:24px;font-weight:600;color:white;letter-spacing:0.02em;">kiScience</h1>';
}

const DEFAULT_TEMPLATES = {
  submission_received: {
    label: 'Form submission received',
    description: 'Sent when a form submission is received.',
    subject: 'Application Received - {{name}}',
    text: `Dear {{name}},

Thank you for submitting your application.

Your application has been received, and it is currently under review by the admin team.

We will notify you once the review process is complete.

Best regards,
KiScience Team`,
  },
  approval: {
    label: 'Application approved',
    description: 'Sent when an application is approved.',
    subject: 'Application Approved - {{name}}',
    text: `Dear {{name}},

Congratulations! Your application has been approved.

Thank you for your patience during the review process.

Best regards,
KiScience Team`,
  },
  rejection: {
    label: 'Application rejected',
    description: 'Sent when an application is not approved. Use {{reason}} for optional reason.',
    subject: 'Application Update - {{name}}',
    text: `Dear {{name}},

Thank you for your interest and for taking the time to submit your application.

After careful review, we regret to inform you that your application has not been approved at this time.

{{reason}}

Best regards,
KiScience Team`,
  },
  affiliate_registration: {
    label: 'Affiliate registration received',
    description: 'Sent when an affiliate application is received.',
    subject: 'Affiliate Registration Received – {{name}}',
    text: `Dear {{name}},

Thank you for registering for our affiliate program.

We've successfully received your application and our team is currently reviewing it.

You'll receive another email once your application has been approved or if we need additional information.

Best regards,
KiScience Team`,
  },
  affiliate_approval: {
    label: 'Affiliate application approved',
    description: 'Sent when an affiliate application is approved. Use {{dashboardUrl}} for the dashboard link.',
    subject: 'Application Approved - {{name}}',
    text: `Dear {{name}},

Congratulations! Your affiliate application has been approved.

You can access your affiliate dashboard here: {{dashboardUrl}}

Thank you for your patience during the review process.

Best regards,
KiScience Team`,
  },
  affiliate_rejection: {
    label: 'Affiliate application rejected',
    description: 'Sent when an affiliate application is not approved. Use {{reason}} for optional reason.',
    subject: 'Affiliate Application Update - {{name}}',
    text: `Dear {{name}},

Thank you for your interest and for taking the time to submit your affiliate application.

After careful review, we regret to inform you that your affiliate application has not been approved at this time.

{{reason}}

Best regards,
KiScience Team`,
  },
};

/**
 * Replace placeholders in a string. vars: { name, formName, reason, dashboardUrl }
 */
function substitute(str, vars = {}) {
  if (str == null) return '';
  let s = String(str);
  const map = {
    '{{name}}': vars.name != null ? String(vars.name) : 'Applicant',
    '{{formName}}': vars.formName != null ? String(vars.formName) : '',
    '{{reason}}': vars.reason != null ? String(vars.reason) : '',
    '{{dashboardUrl}}': vars.dashboardUrl != null ? String(vars.dashboardUrl) : ''
  };
  Object.keys(map).forEach((key) => {
    s = s.split(key).join(map[key]);
  });
  return s;
}

/**
 * Fixed email design wrapper. Same layout/CSS for every email; only bodyContent changes.
 * Ensures design (UI/CSS) never changes—only the content from admin's plain text.
 */
const EMAIL_DESIGN_WRAPPER = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #00061e; background: linear-gradient(to bottom, #00061e 0% 0%, #002438 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f8fbfd; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; min-height: 120px; }
    .content p { margin: 0 0 14px; font-size: 15px; }
    .content a { color: #2B7BE5; text-decoration: none; }
    .content a:hover { text-decoration: underline; }
    .footer { margin-top: 20px; text-align: center; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      {{LOGO_IMG}}
    </div>
    <div class="content">
      {{BODY_CONTENT}}
    </div>
    <div class="footer">
      <p>© 2026 KiScience Technologies Pvt. Ltd. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

/**
 * Convert plain text to HTML content for the fixed design. Escapes HTML; preserves line breaks.
 * Injected into EMAIL_DESIGN_WRAPPER so design stays exact—only this content changes when admin edits.
 */
function textToSimpleHtml(text) {
  const wrapper = EMAIL_DESIGN_WRAPPER.replace('{{LOGO_IMG}}', getHeaderHtml());
  if (text == null) return wrapper.replace('{{BODY_CONTENT}}', '');
  const escaped = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const withBreaks = escaped.split(/\r?\n/).join('<br>\n');
  const bodyContent = `<div style="font-size:15px;line-height:1.6;">${withBreaks}</div>`;
  return wrapper.replace('{{BODY_CONTENT}}', bodyContent);
}

/**
 * Get all email templates for a shop (saved overrides merged with defaults).
 * Returns only subject and text for admin editing; no HTML.
 */
async function getEmailTemplates(db, shop) {
  const doc = await db.collection('admin_settings').findOne({
    shop,
    setting: 'email_templates'
  });
  const saved = (doc && doc.value) || {};
  const result = {};
  Object.keys(DEFAULT_TEMPLATES).forEach((key) => {
    const def = DEFAULT_TEMPLATES[key];
    const custom = saved[key];
    result[key] = {
      label: def.label,
      description: def.description,
      subject: (custom && custom.subject != null) ? custom.subject : def.subject,
      text: (custom && custom.text != null) ? custom.text : def.text
    };
  });
  return result;
}

/**
 * Get one template by key (for sending). Returns { subject, text, html }.
 * - subject and text: from admin (or defaults); placeholders substituted when sending.
 * - html: fixed design wrapper + admin's body text (so any change admin makes to the message updates the email; design/CSS stays the same).
 */
async function getEmailTemplate(db, shop, key) {
  const all = await getEmailTemplates(db, shop);
  const t = all[key];
  if (!t) return null;
  return {
    subject: t.subject,
    text: t.text,
    html: textToSimpleHtml(t.text)
  };
}

/**
 * Save email template overrides for a shop. Only subject and text are stored.
 * body: { templates: { [key]: { subject?, text? } } }
 */
async function putEmailTemplates(db, shop, templates) {
  const doc = await db.collection('admin_settings').findOne({
    shop,
    setting: 'email_templates'
  });
  const existing = (doc && doc.value) || {};
  const merged = { ...existing };
  Object.keys(templates).forEach((key) => {
    if (!DEFAULT_TEMPLATES[key]) return;
    const incoming = templates[key];
    merged[key] = {
      ...(merged[key] || {}),
      ...(incoming.subject != null && { subject: incoming.subject }),
      ...(incoming.text != null && { text: incoming.text })
    };
  });
  await db.collection('admin_settings').updateOne(
    { shop, setting: 'email_templates' },
    { $set: { shop, setting: 'email_templates', value: merged, updatedAt: new Date() } },
    { upsert: true }
  );
  return getEmailTemplates(db, shop);
}

module.exports = {
  DEFAULT_TEMPLATES,
  substitute,
  getEmailTemplates,
  getEmailTemplate,
  putEmailTemplates
};
