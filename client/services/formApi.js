/**
 * API Service: affiliate forms, submissions, customer search/create
 */

const API_BASE = '/api';
const SHOP_STORAGE_KEY = 'kiscience_shop';

// Helper to get shop from URL params or localStorage
const getShopParam = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const shopFromUrl = urlParams.get('shop');
  
  if (shopFromUrl) {
    // Store in localStorage for subsequent requests
    try {
      localStorage.setItem(SHOP_STORAGE_KEY, shopFromUrl);
    } catch (e) {
      console.warn('Could not store shop in localStorage:', e);
    }
    return shopFromUrl;
  }
  
  // Fallback to localStorage
  try {
    return localStorage.getItem(SHOP_STORAGE_KEY) || '';
  } catch (e) {
    return '';
  }
};

// Helper for API requests
const apiRequest = async (endpoint, options = {}) => {
  const shop = getShopParam();
  const url = new URL(`${window.location.origin}${API_BASE}${endpoint}`);
  
  // Add shop parameter to all requests
  if (shop) {
    url.searchParams.set('shop', shop);
  }

  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const response = await fetch(url.toString(), {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || data.message || 'API request failed');
  }

  return data;
};

// ===== CUSTOMER (used by affiliate submission approval) =====

export const searchCustomerByEmail = async (email) => {
  return apiRequest(`/customers/search?email=${encodeURIComponent(email)}`);
};

export const createCustomer = async (email, firstName, lastName, tags = '') => {
  return apiRequest('/customers/create', {
    method: 'POST',
    body: JSON.stringify({ email, firstName, lastName, tags }),
  });
};

// ===== AFFILIATE FORM API =====

/**
 * Get all affiliate forms for the current shop
 */
export const getAffiliateForms = async () => {
  return apiRequest('/affiliate-forms');
};



/**
 * Get a single affiliate form by ID
 */
export const getAffiliateFormById = async (formId) => {
  return apiRequest(`/affiliate-forms/${formId}`);
};


/**
 * Create a new affiliate form
 */
export const createAffiliateForm = async (formData) => {
  return apiRequest('/affiliate-forms', {
    method: 'POST',
    body: JSON.stringify(formData),
  });
};

/**
 * Update an existing affiliate form
 */
export const updateAffiliateForm = async (formId, formData) => {
  return apiRequest(`/affiliate-forms/${formId}`, {
    method: 'PUT',
    body: JSON.stringify(formData),
  });
};

/**
 * Delete an affiliate form
 */
export const deleteAffiliateForm = async (formId) => {
  return apiRequest(`/affiliate-forms/${formId}`, {
    method: 'DELETE',
  });
};


// ===== AFFILIATE FORM SUBMISSION OPERATIONS =====

// Create a new affiliate form submission (public endpoint)
export const createAffiliateFormSubmission = async (formId, submissionData) => {
  const shop = getShopParam();
  const url = new URL(`${window.location.origin}${API_BASE}/affiliate-forms/${formId}/submit`);
  
  // Add shop parameter
  if (shop) {
    url.searchParams.set('shop', shop);
  }

  // Check if submissionData contains files
  const hasFiles = submissionData instanceof FormData;
  
  const options = {
    method: 'POST',
    body: hasFiles ? submissionData : JSON.stringify(submissionData),
  };
  
  // Only set Content-Type for JSON, FormData sets its own
  if (!hasFiles) {
    options.headers = {
      'Content-Type': 'application/json',
    };
  }

  const response = await fetch(url.toString(), options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || data.message || 'Failed to submit affiliate form');
  }

  return data;
};

// Get all submissions for an affiliate form
export const getAffiliateFormSubmissions = async (formId, page = 1, limit = 20) => {
  return apiRequest(`/affiliate-forms/${formId}/submissions?page=${page}&limit=${limit}`);
};

// Get single submission by ID
export const getAffiliateFormSubmissionById = async (formId, submissionId) => {
  return apiRequest(`/affiliate-forms/${formId}/submissions/${submissionId}`);
};

// Delete a single submission
export const deleteAffiliateFormSubmission = async (formId, submissionId) => {
  return apiRequest(`/affiliate-forms/${formId}/submissions/${submissionId}`, {
    method: 'DELETE',
  });
};

// Delete multiple submissions
export const deleteMultipleAffiliateFormSubmissions = async (formId, ids) => {
  return apiRequest(`/affiliate-forms/${formId}/submissions/delete-multiple`, {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
};


/**
 * Approve an affiliate form submission. Optionally attach a file to the approval email.
 */
export const approveAffiliateFormSubmission = async (formId, submissionId, shopifyCustomerId = null, tagAdded = null, attachment = null) => {
  if (attachment) {
    const shop = getShopParam();
    const url = new URL(`${window.location.origin}${API_BASE}/affiliate-forms/${formId}/submissions/${submissionId}/approve`);
    if (shop) url.searchParams.set('shop', shop);
    const form = new FormData();
    if (shopifyCustomerId != null) form.append('shopifyCustomerId', String(shopifyCustomerId));
    if (tagAdded != null) form.append('tagAdded', String(tagAdded));
    form.append('attachment', attachment);
    const res = await fetch(url.toString(), { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.message || 'API request failed');
    return data;
  }
  return apiRequest(`/affiliate-forms/${formId}/submissions/${submissionId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ shopifyCustomerId, tagAdded }),
  });
};

/**
 * Reject an affiliate form submission. Optionally attach a file to the rejection email.
 */
export const rejectAffiliateFormSubmission = async (formId, submissionId, reason = null, attachment = null) => {
  if (attachment) {
    const shop = getShopParam();
    const url = new URL(`${window.location.origin}${API_BASE}/affiliate-forms/${formId}/submissions/${submissionId}/reject`);
    if (shop) url.searchParams.set('shop', shop);
    const form = new FormData();
    if (reason != null) form.append('reason', String(reason));
    form.append('attachment', attachment);
    const res = await fetch(url.toString(), { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.message || 'API request failed');
    return data;
  }
  return apiRequest(`/affiliate-forms/${formId}/submissions/${submissionId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
};// ===== AFFILIATE PROGRAM API =====

/**
 * Create affiliate profile for a customer and generate referral link
 * Called when admin approves an affiliate form submission
 */
export const createAffiliateAndReferralLink = async (customerId, affiliateData = {}) => {
  return apiRequest('/affiliates/create', {
    method: 'POST',
    body: JSON.stringify({
      customerId,
      email: affiliateData.email,
      name: affiliateData.name || `${affiliateData.firstName || ''} ${affiliateData.lastName || ''}`.trim(),
      ...affiliateData
    })
  });
};

/**
 * Generate a new referral link for an affiliate
 */
export const generateReferralLink = async (affiliateId, linkData = {}) => {
  return apiRequest(`/affiliates/${affiliateId}/referral-links`, {
    method: 'POST',
    body: JSON.stringify({
      description: linkData.description || 'Main Referral Link',
      productIds: linkData.productIds || [],
      productVariantIds: linkData.productVariantIds || []
    })
  });
};

/**
 * Get affiliate dashboard data (profile, links, earnings)
 */
export const getAffiliateDashboard = async (affiliateId) => {
  return apiRequest(`/affiliates/${affiliateId}/dashboard`);
};


export default {
  searchCustomerByEmail,
  createCustomer,
  getAffiliateForms,
  getAffiliateFormById,
  createAffiliateForm,
  updateAffiliateForm,
  deleteAffiliateForm,

  // ===== AFFILIATE FORM SUBMISSION API =====
  createAffiliateFormSubmission,
  getAffiliateFormSubmissions,
  getAffiliateFormSubmissionById,
  deleteAffiliateFormSubmission,
  deleteMultipleAffiliateFormSubmissions,

  // ===== AFFILIATE FORM SUBMISSION APPROVAL API =====
  approveAffiliateFormSubmission,
  rejectAffiliateFormSubmission,

  // ===== AFFILIATE PROGRAM API =====
  createAffiliateAndReferralLink,
  generateReferralLink,
  getAffiliateDashboard,
};
