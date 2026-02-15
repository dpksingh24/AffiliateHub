/**
 * Pre-built affiliate form templates. Users can select one to create a form quickly.
 * Each template includes a formPayload with name, description, status, and fields (with id for editor stability).
 */
export const AFFILIATE_FORM_TEMPLATES = [
  {
    id: 'referral-signup',
    name: 'Referral Signup',
    description: 'Simple signup: name, email, and optional message.',
    formPayload: {
      name: 'Referral Signup',
      description: 'Apply to join our referral program. We’ll review and get back to you.',
      status: 'Draft',
      fields: [
        { id: 'ref-firstName', type: 'text', label: 'First Name', name: 'firstName', required: true, placeholder: 'John' },
        { id: 'ref-lastName', type: 'text', label: 'Last Name', name: 'lastName', required: true, placeholder: 'Doe' },
        { id: 'ref-email', type: 'email', label: 'Email', name: 'email', required: true, placeholder: 'john@example.com' },
        { id: 'ref-message', type: 'textarea', label: 'Why do you want to join?', name: 'message', required: false, placeholder: 'Tell us about yourself...' }
      ]
    }
  },
  {
    id: 'brand-ambassador',
    name: 'Brand Ambassador',
    description: 'Social links, audience size, and experience.',
    formPayload: {
      name: 'Brand Ambassador Application',
      description: 'Apply to become a brand ambassador. Share your social presence and experience.',
      status: 'Draft',
      fields: [
        { id: 'ba-fullName', type: 'text', label: 'Full Name', name: 'fullName', required: true, placeholder: 'Jane Smith' },
        { id: 'ba-email', type: 'email', label: 'Email', name: 'email', required: true, placeholder: 'jane@example.com' },
        { id: 'ba-instagram', type: 'text', label: 'Instagram Handle', name: 'instagram', required: false, placeholder: '@username' },
        { id: 'ba-website', type: 'text', label: 'Website or Blog', name: 'website', required: false, placeholder: 'https://...' },
        { id: 'ba-audienceSize', type: 'text', label: 'Audience Size (approx.)', name: 'audienceSize', required: false, placeholder: 'e.g. 10K followers' },
        { id: 'ba-experience', type: 'textarea', label: 'Experience & Why Us', name: 'experience', required: true, placeholder: 'Share your experience...' }
      ]
    }
  },
  {
    id: 'wholesale-partner',
    name: 'Wholesale Partner',
    description: 'Business details and tax ID for B2B.',
    formPayload: {
      name: 'Wholesale Partner Application',
      description: 'Apply for wholesale partnership. Include your business and contact details.',
      status: 'Draft',
      fields: [
        { id: 'wp-businessName', type: 'text', label: 'Business Name', name: 'businessName', required: true, placeholder: 'Acme Inc.' },
        { id: 'wp-contactName', type: 'text', label: 'Contact Name', name: 'contactName', required: true, placeholder: 'John Doe' },
        { id: 'wp-email', type: 'email', label: 'Business Email', name: 'email', required: true, placeholder: 'orders@acme.com' },
        { id: 'wp-phone', type: 'text', label: 'Phone', name: 'phone', required: true, placeholder: '+1 234 567 8900' },
        { id: 'wp-taxId', type: 'text', label: 'Tax ID / EIN', name: 'taxId', required: false, placeholder: 'Optional' },
        { id: 'wp-notes', type: 'textarea', label: 'Products of Interest & Order Volume', name: 'notes', required: false, placeholder: 'What do you want to carry?' }
      ]
    }
  },
  {
    id: 'influencer-application',
    name: 'Influencer Application',
    description: 'Niche, platforms, and collaboration preferences.',
    formPayload: {
      name: 'Influencer Application',
      description: 'Apply to collaborate as an influencer. Tell us your platform and ideas.',
      status: 'Draft',
      fields: [
        { id: 'inf-name', type: 'text', label: 'Name', name: 'name', required: true, placeholder: 'Your name' },
        { id: 'inf-email', type: 'email', label: 'Email', name: 'email', required: true, placeholder: 'email@example.com' },
        { id: 'inf-platform', type: 'text', label: 'Primary Platform', name: 'platform', required: true, placeholder: 'e.g. Instagram, YouTube' },
        { id: 'inf-niche', type: 'text', label: 'Niche or Category', name: 'niche', required: false, placeholder: 'e.g. Beauty, Fitness' },
        { id: 'inf-collabIdeas', type: 'textarea', label: 'Collaboration Ideas', name: 'collabIdeas', required: false, placeholder: 'What kind of content?' }
      ]
    }
  },
  {
    id: 'minimal-contact',
    name: 'Minimal Contact',
    description: 'Just name and email. Fastest way to collect leads.',
    formPayload: {
      name: 'Affiliate Contact Form',
      description: 'Get in touch to join our affiliate program. We’ll follow up with next steps.',
      status: 'Draft',
      fields: [
        { id: 'min-name', type: 'text', label: 'Name', name: 'name', required: true, placeholder: 'Your name' },
        { id: 'min-email', type: 'email', label: 'Email', name: 'email', required: true, placeholder: 'you@example.com' }
      ]
    }
  }
];

export default AFFILIATE_FORM_TEMPLATES;
