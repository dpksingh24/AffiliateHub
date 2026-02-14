/**
 * Custom Pricing API Service
 * Handles all API calls for pricing rules and Shopify search
 */

const API_BASE = '/api';
const SHOP_STORAGE_KEY = 'affiliatehub_shop';

// Helper to get shop from URL params or localStorage
const getShopParam = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const shopFromUrl = urlParams.get('shop');
  
  if (shopFromUrl) {
    try {
      localStorage.setItem(SHOP_STORAGE_KEY, shopFromUrl);
    } catch (e) {
      console.warn('Could not store shop in localStorage:', e);
    }
    return shopFromUrl;
  }
  
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

// ===== PRICING RULES API =====

/**
 * Get all pricing rules for the current shop
 */
export const getPricingRules = async () => {
  return apiRequest('/pricing-rules');
};

/**
 * Get a single pricing rule by ID
 */
export const getPricingRuleById = async (ruleId) => {
  return apiRequest(`/pricing-rules/${ruleId}`);
};

/**
 * Create a new pricing rule
 */
export const createPricingRule = async (ruleData) => {
  return apiRequest('/pricing-rules', {
    method: 'POST',
    body: JSON.stringify(ruleData),
  });
};

/**
 * Update an existing pricing rule
 */
export const updatePricingRule = async (ruleId, ruleData) => {
  return apiRequest(`/pricing-rules/${ruleId}`, {
    method: 'PUT',
    body: JSON.stringify(ruleData),
  });
};

/**
 * Delete a pricing rule
 */
export const deletePricingRule = async (ruleId) => {
  return apiRequest(`/pricing-rules/${ruleId}`, {
    method: 'DELETE',
  });
};

// ===== SHOPIFY SEARCH API =====

/**
 * Search products from Shopify
 * @param {string} query - Search query
 * @param {number} limit - Max results (default 25)
 */
export const searchProducts = async (query = '', limit = 25) => {
  const params = new URLSearchParams({ query, limit: String(limit) });
  return apiRequest(`/shopify/products/search?${params.toString()}`);
};

/**
 * Search customers from Shopify
 * @param {string} query - Search query
 * @param {number} limit - Max results (default 25)
 */
export const searchCustomers = async (query = '', limit = 25) => {
  const params = new URLSearchParams({ query, limit: String(limit) });
  return apiRequest(`/shopify/customers/search?${params.toString()}`);
};

/**
 * Search collections from Shopify
 * @param {string} query - Search query
 * @param {number} limit - Max results (default 25)
 */
export const searchCollections = async (query = '', limit = 25) => {
  const params = new URLSearchParams({ query, limit: String(limit) });
  return apiRequest(`/shopify/collections/search?${params.toString()}`);
};

/**
 * Get all customer tags from Shopify
 */
export const getCustomerTags = async () => {
  return apiRequest('/shopify/customer-tags');
};

/**
 * Get all product tags from Shopify
 */
export const getProductTags = async () => {
  return apiRequest('/shopify/product-tags');
};

/**
 * Manually sync pricing rules to Shopify metafields
 */
export const syncPricingRulesToShopify = async () => {
  return apiRequest('/pricing-rules/sync', {
    method: 'POST',
  });
};

export default {
  // Pricing Rules
  getPricingRules,
  getPricingRuleById,
  createPricingRule,
  updatePricingRule,
  deletePricingRule,
  
  // Shopify Search
  searchProducts,
  searchCustomers,
  searchCollections,
  getCustomerTags,
  getProductTags,
  
  // Sync
  syncPricingRulesToShopify,
};
