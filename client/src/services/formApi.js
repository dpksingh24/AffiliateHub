/**
 * Form Builder API Service
 * Handles all API calls to the backend for forms and submissions
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

// ===== FORM API =====

/**
 * Get all forms for the current shop
 */
export const getForms = async () => {
  return apiRequest('/forms');
};

/**
 * Get a single form by ID
 */
export const getFormById = async (formId) => {
  return apiRequest(`/forms/${formId}`);
};

/**
 * Create a new form
 */
export const createForm = async (formData) => {
  return apiRequest('/forms', {
    method: 'POST',
    body: JSON.stringify(formData),
  });
};

/**
 * Update an existing form
 */
export const updateForm = async (formId, formData) => {
  return apiRequest(`/forms/${formId}`, {
    method: 'PUT',
    body: JSON.stringify(formData),
  });
};

/**
 * Delete a form
 */
export const deleteForm = async (formId) => {
  return apiRequest(`/forms/${formId}`, {
    method: 'DELETE',
  });
};

/**
 * Duplicate a form
 */
export const duplicateForm = async (formId) => {
  return apiRequest(`/forms/${formId}/duplicate`, {
    method: 'POST',
  });
};

/**
 * Update form status (publish/unpublish)
 */
export const updateFormStatus = async (formId, status) => {
  return apiRequest(`/forms/${formId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
};

// ===== SUBMISSION API =====

/**
 * Get all submissions for a form
 */
export const getFormSubmissions = async (formId, page = 1, limit = 20) => {
  return apiRequest(`/forms/${formId}/submissions?page=${page}&limit=${limit}`);
};

/**
 * Get a single submission by ID
 */
export const getSubmissionById = async (submissionId) => {
  return apiRequest(`/submissions/${submissionId}`);
};

/**
 * Delete a submission
 */
export const deleteSubmission = async (submissionId) => {
  return apiRequest(`/submissions/${submissionId}`, {
    method: 'DELETE',
  });
};

/**
 * Delete multiple submissions
 */
export const deleteMultipleSubmissions = async (submissionIds) => {
  return apiRequest('/submissions/delete-multiple', {
    method: 'POST',
    body: JSON.stringify({ ids: submissionIds }),
  });
};

/**
 * Export submissions as CSV (returns download URL)
 */
export const exportSubmissions = (formId) => {
  const shop = getShopParam();
  return `${API_BASE}/forms/${formId}/submissions/export?shop=${shop}`;
};

// ===== APPROVAL API =====

/**
 * Search for a Shopify customer by email
 */
export const searchCustomerByEmail = async (email) => {
  return apiRequest(`/customers/search?email=${encodeURIComponent(email)}`);
};

/**
 * Create a new Shopify customer
 */
export const createCustomer = async (email, firstName, lastName, tags = '') => {
  return apiRequest('/customers/create', {
    method: 'POST',
    body: JSON.stringify({ email, firstName, lastName, tags }),
  });
};

/**
 * Add a tag to a Shopify customer
 */
export const addTagToCustomer = async (customerId, tag) => {
  return apiRequest('/customers/add-tag', {
    method: 'POST',
    body: JSON.stringify({ customerId, tag }),
  });
};

/**
 * Approve a submission
 */
export const approveSubmission = async (submissionId, shopifyCustomerId = null, tagAdded = null) => {
  return apiRequest(`/submissions/${submissionId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ shopifyCustomerId, tagAdded }),
  });
};

/**
 * Reject a submission
 */
export const rejectSubmission = async (submissionId, reason = null) => {
  return apiRequest(`/submissions/${submissionId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
};

export default {
  getForms,
  getFormById,
  createForm,
  updateForm,
  deleteForm,
  duplicateForm,
  updateFormStatus,
  getFormSubmissions,
  getSubmissionById,
  deleteSubmission,
  deleteMultipleSubmissions,
  exportSubmissions,
  searchCustomerByEmail,
  createCustomer,
  addTagToCustomer,
  approveSubmission,
  rejectSubmission,
};
