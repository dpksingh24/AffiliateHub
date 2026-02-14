/**
 * API service: admin customer search/create (for flows that need Shopify customer lookup or create).
 */

const API_BASE = '/api';
const SHOP_STORAGE_KEY = 'kiscience_shop';

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

export default {
  searchCustomerByEmail,
  createCustomer,
};
