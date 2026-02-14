/**
 * Customer & Affiliate Dashboard JavaScript
 * Handles tab switching and populates both customer and affiliate data
 */

console.log('🔄 Dashboard script is loading...');

/* --------------------------------------------------
   GLOBAL STATE
-------------------------------------------------- */

const API_BASE_URL = 'https://kisciapp.ebizonstg.com';
let customerData = null;
let affiliateData = null;
let currentCustomerId = null;
let currentAffiliateId = null;
let isAffiliate = false;

// Skeleton control helpers – update all skeleton/container elements so only one state is visible (handles embed + block)
function showSkeleton() {
  document.querySelectorAll('[id="dashboard-skeleton"]').forEach(function (s) {
    s.style.setProperty('display', 'block', 'important');
    s.classList.remove('ks-skeleton-hidden');
    s.classList.add('ks-skeleton-visible');
  });
  document.querySelectorAll('[id="dashboard-container"]').forEach(function (el) {
    el.style.setProperty('display', 'none', 'important');
    el.classList.remove('ks-dashboard-visible');
  });
  document.querySelectorAll('[id="dashboard-error"]').forEach(function (e) { e.style.display = 'none'; });
}

function hideSkeleton(showContainer = true) {
  document.querySelectorAll('[id="dashboard-skeleton"]').forEach(function (s) {
    s.style.setProperty('display', 'none', 'important');
    s.classList.add('ks-skeleton-hidden');
    s.classList.remove('ks-skeleton-visible');
  });
  if (showContainer) {
    document.querySelectorAll('[id="dashboard-container"]').forEach(function (el) {
      el.style.setProperty('display', 'flex', 'important');
      el.classList.add('ks-dashboard-visible');
    });
  }
}

/**
 * Show custom in-page toast popup (no browser alert)
 * @param {string} message - Message to display
 * @param {'success'|'error'} type - Toast type for styling
 * @param {number} durationMs - Auto-hide after ms (default 3000)
 */
function showToast(message, type = 'success', durationMs = 3000) {
  const existing = document.getElementById('ks-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'ks-toast';
  toast.className = `ks-toast ks-toast--${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <span class="ks-toast__message">${message}</span>
    <button type="button" class="ks-toast__close" aria-label="Close">×</button>
  `;

  document.body.appendChild(toast);

  const closeToast = () => {
    toast.classList.add('ks-toast--hide');
    setTimeout(() => toast.remove(), 300);
  };

  toast.querySelector('.ks-toast__close').addEventListener('click', closeToast);
  const autoCloseTimer = setTimeout(closeToast, durationMs);

  toast.addEventListener('mouseenter', () => clearTimeout(autoCloseTimer));
  toast.addEventListener('mouseleave', () => { setTimeout(closeToast, 1500); });
}

// Wishlist is stored on the server (syncs across devices); no localStorage

const sampleAddresses = [
  { id: 1, type: 'Billing', name: 'John Doe', street: '123 Main St', city: 'New York', state: 'NY', zip: '10001' },
  { id: 2, type: 'Shipping', name: 'John Doe', street: '456 Oak Ave', city: 'Brooklyn', state: 'NY', zip: '11201' }
];

/* --------------------------------------------------
   API HELPER
-------------------------------------------------- */

async function apiCall(endpoint, method = 'GET', body = null) {
  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const data = await response.json();

    console.log(`🔗 API ${method} ${endpoint} - Status: ${response.status}`, data);

    // Return error if response is not ok
    if (!response.ok) {
      console.error('❌ API Error:', response.status, data);
      return { 
        success: false, 
        error: data.error || `HTTP ${response.status}: ${response.statusText}`,
        status: response.status
      };
    }

    return data;
  } catch (error) {
    console.error('❌ Fetch Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get customer ID and affiliate ID from URL/localStorage/Shopify/Theme
 */
function getCustomerId() {
  // Try URL params first
  const urlParams = new URLSearchParams(window.location.search);
  let customerId = urlParams.get('customerId') || localStorage.getItem('customerId');
  
  // Try to extract from theme.liquid global object (KISCENCE_CUSTOMER)
  if (!customerId && window.KISCENCE_CUSTOMER?.id) {
    customerId = window.KISCENCE_CUSTOMER.id;
    console.log('✅ Customer ID from KISCENCE_CUSTOMER (theme.liquid):', customerId);
  }
  
  // Try to extract from Shopify's checkout object
  if (!customerId && window.Shopify?.checkout?.customer?.id) {
    customerId = window.Shopify.checkout.customer.id;
    console.log('✅ Customer ID from Shopify checkout:', customerId);
  }
  
  // Try to extract from page meta tags
  if (!customerId) {
    const customerMeta = document.querySelector('meta[name="shopify-checkout"][content*="customer"]');
    if (customerMeta) {
      try {
        const data = JSON.parse(customerMeta.getAttribute('content'));
        if (data.customer?.id) {
          customerId = data.customer.id;
          console.log('✅ Customer ID from meta tags:', customerId);
        }
      } catch (e) {
        console.warn('Could not parse customer meta tag');
      }
    }
  }
  
  return customerId;
}

function getCustomerEmail() {
  // Try to extract from theme.liquid global object (KISCENCE_CUSTOMER) - PRIORITY 1
  if (window.KISCENCE_CUSTOMER?.email) {
    console.log('✅ Customer email from KISCENCE_CUSTOMER (theme.liquid):', window.KISCENCE_CUSTOMER.email);
    return window.KISCENCE_CUSTOMER.email;
  }
  
  // Try URL params
  const urlParams = new URLSearchParams(window.location.search);
  const email = urlParams.get('email');
  if (email) {
    console.log('✅ Customer email from URL params:', email);
    return email;
  }
  
  // Try localStorage
  const storedEmail = localStorage.getItem('customerEmail');
  if (storedEmail) {
    console.log('✅ Customer email from localStorage:', storedEmail);
    return storedEmail;
  }
  
  // Try Shopify's checkout object
  if (window.Shopify?.checkout?.email) {
    console.log('✅ Customer email from Shopify checkout:', window.Shopify.checkout.email);
    return window.Shopify.checkout.email;
  }
  
  console.warn('⚠️ Customer email not found in any source');
  return null;
}

function getAffiliateId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('affiliateId') || localStorage.getItem('affiliateId');
}

/* --------------------------------------------------
   LOAD DASHBOARD DATA
-------------------------------------------------- */

async function loadCustomerData() {
  currentCustomerId = getCustomerId();
  const shop = window.Shopify?.shop || window.location.hostname;
  console.log('Loading customer data for:', currentCustomerId, 'shop:', shop);

  // Fallback profile (used if API fails or before response)
  const fallbackEmail = getCustomerEmail() || '';
  let profile = {
    name: '',
    email: fallbackEmail,
    phone: '',
    newsletterSubscribed: false,
    orderUpdates: true
  };

  if (currentCustomerId && shop) {
    const result = await apiCall(
      `/api/customers/profile?shop=${encodeURIComponent(shop)}&customerId=${encodeURIComponent(currentCustomerId)}`
    );
    if (result.success && result.profile) {
      profile = {
        name: result.profile.name || [result.profile.firstName, result.profile.lastName].filter(Boolean).join(' ') || '',
        email: result.profile.email || fallbackEmail,
        phone: result.profile.phone || '',
        newsletterSubscribed: result.profile.newsletterSubscribed === true,
        orderUpdates: result.profile.orderUpdates !== false,
        tags: Array.isArray(result.profile.tags) ? result.profile.tags : []
      };
      console.log('Customer profile loaded from Shopify:', profile);
    } else {
      console.warn('Could not load customer profile, using fallback:', result.error || 'No profile');
      profile.name = '';
      profile.email = fallbackEmail;
      profile.phone = '';
    }
  }

  let addresses = [];
  if (currentCustomerId && shop) {
    const addrResult = await apiCall(
      `/api/customers/addresses?shop=${encodeURIComponent(shop)}&customerId=${encodeURIComponent(currentCustomerId)}`
    );
    if (addrResult.success && Array.isArray(addrResult.addresses)) {
      addresses = addrResult.addresses.map(function (a) {
        const name = [a.firstName, a.lastName].filter(Boolean).join(' ') || 'Address';
        const street = [a.address1, a.address2].filter(Boolean).join(', ');
        return {
          id: a.id,
          type: a.default ? 'Default' : 'Additional',
          name: name,
          street: street,
          city: a.city || '',
          state: a.province || '',
          zip: a.zip || '',
          default: !!a.default,
          firstName: a.firstName,
          lastName: a.lastName,
          address1: a.address1,
          address2: a.address2,
          province: a.province,
          country: a.country,
          countryCode: a.countryCode,
          phone: a.phone,
          company: a.company
        };
      });
      console.log('Customer addresses loaded from Shopify:', addresses.length);
    } else {
      console.warn('Could not load addresses, using empty list:', addrResult.error || 'No addresses');
    }
  }

  let billingAddresses = [];
  if (currentCustomerId && shop) {
    const billingResult = await apiCall(
      `/api/customers/billing-addresses?shop=${encodeURIComponent(shop)}&customerId=${encodeURIComponent(currentCustomerId)}`
    );
    if (billingResult.success && Array.isArray(billingResult.addresses)) {
      billingAddresses = billingResult.addresses.map(function (a) {
        const name = [a.firstName, a.lastName].filter(Boolean).join(' ') || 'Address';
        const street = [a.address1, a.address2].filter(Boolean).join(', ');
        return {
          id: a.id,
          type: a.default ? 'Default' : 'Additional',
          name: name,
          street: street,
          city: a.city || '',
          state: a.province || '',
          zip: a.zip || '',
          default: !!a.default,
          firstName: a.firstName,
          lastName: a.lastName,
          address1: a.address1,
          address2: a.address2,
          province: a.province,
          country: a.country,
          countryCode: a.countryCode,
          phone: a.phone,
          company: a.company
        };
      });
      console.log('Customer billing addresses loaded:', billingAddresses.length);
    }
  }

  let orders = [];
  if (currentCustomerId && shop) {
    const ordersResult = await apiCall(
      `/api/customers/orders?shop=${encodeURIComponent(shop)}&customerId=${encodeURIComponent(currentCustomerId)}`
    );
    if (ordersResult.success && Array.isArray(ordersResult.orders)) {
      orders = ordersResult.orders;
      console.log('Customer orders loaded from Shopify:', orders.length);
    } else {
      console.warn('Could not load orders, using empty list:', ordersResult.error || 'No orders');
    }
  }

  let payments = [];
  let paymentsUnavailable = false;
  if (currentCustomerId && shop) {
    const payResult = await apiCall(
      `/api/customers/payment-methods?shop=${encodeURIComponent(shop)}&customerId=${encodeURIComponent(currentCustomerId)}`
    );
    if (payResult.success && Array.isArray(payResult.payments)) {
      payments = payResult.payments.map(function (p) {
        return {
          id: p.id,
          type: p.type || 'Card',
          last4: p.last4 || '',
          expiry: p.expiry || '',
          name: p.name || ''
        };
      });
      console.log('Customer payment methods loaded from Shopify:', payments.length);
    } else {
      paymentsUnavailable = true;
      console.warn('Could not load payment methods:', payResult.error || 'No payment methods');
    }
  }

  let wishlistItems = [];
  if (currentCustomerId && shop) {
    try {
      const wishlistResult = await apiCall(
        `/api/customers/wishlist?shop=${encodeURIComponent(shop)}&customerId=${encodeURIComponent(currentCustomerId)}`
      );
      if (wishlistResult.success && Array.isArray(wishlistResult.items)) {
        wishlistItems = wishlistResult.items;
        console.log('Customer wishlist loaded from server:', wishlistItems.length);
      }
    } catch (e) {
      console.warn('Wishlist load error:', e);
    }
  }

  customerData = {
    profile,
    orders: orders,
    addresses: addresses,
    billingAddresses: billingAddresses,
    wishlist: wishlistItems,
    payments: payments,
    paymentsUnavailable: paymentsUnavailable
  };

  console.log('Customer data loaded:', customerData);
}

async function loadAffiliateDashboard() {
  currentCustomerId = getCustomerId();
  currentAffiliateId = getAffiliateId();
  
  console.log('🔍 Affiliate Dashboard Load - Customer ID:', currentCustomerId, 'Affiliate ID:', currentAffiliateId);
  
  // Get logged-in customer email from multiple sources (KISCENCE_CUSTOMER is priority)
  const loggedInEmail = getCustomerEmail();
  
  // Get shop domain from Shopify or current location
  const shop = window.Shopify?.shop || window.location.hostname;
  
  console.log('📧 Logged in email:', loggedInEmail);
  console.log('🏪 Shop:', shop);
  
  if (!loggedInEmail) {
    console.warn('⚠️ Customer email not found - cannot verify access');
    isAffiliate = false;
    return;
  }

  // Try to find affiliate by customer ID first, then fall back to affiliate ID
  if (!currentAffiliateId && !currentCustomerId) {
    console.log('❌ No customer ID or affiliate ID found');
    isAffiliate = false;
    return;
  }

  console.log('🔄 Loading affiliate dashboard for customer:', currentCustomerId);
  
  // Use customer ID to fetch affiliate data (affiliate API should support this)
  const endpoint = currentAffiliateId 
    ? `/api/affiliates/${currentAffiliateId}/dashboard`
    : `/api/affiliates/customer/${currentCustomerId}/dashboard?shop=${encodeURIComponent(shop)}&email=${encodeURIComponent(loggedInEmail)}`;
  
  console.log('💡 Calling endpoint:', endpoint);
  const result = await apiCall(endpoint);
  
  console.log('📨 API Response:', result);
  
  if (!result.success) {
    console.warn('⛔ Access denied - Reason:', result.error);
    isAffiliate = false;
    affiliateData = null;
    return;
  }

  affiliateData = result.dashboard || result;
  currentAffiliateId = result.affiliateId || currentAffiliateId;
  isAffiliate = true;
  console.log('✅ Affiliate data loaded successfully');
  console.log('📊 Affiliate Data:', affiliateData);
}

/* --------------------------------------------------
   INITIALIZATION
-------------------------------------------------- */

async function initDashboard() {
  console.log('🚀 Initializing dashboard...');

  // Show skeleton and hide dashboard immediately so only one is visible
  showSkeleton();

  // Get customer ID and email first (using theme.liquid's KISCENCE_CUSTOMER)
  currentCustomerId = getCustomerId();
  const loggedInEmail = getCustomerEmail();

  console.log('👤 Customer ID:', currentCustomerId, 'Email:', loggedInEmail);

  // Check if we have the required info
  if (!currentCustomerId || !loggedInEmail) {
    console.error('❌ Missing customer ID or email - cannot access dashboard');
    hideSkeleton(false);
    showAccessDeniedError('Missing customer information. Please log in first.');
    return;
  }

  try {
    // Try to load affiliate dashboard (this will verify email)
    await loadAffiliateDashboard();
  } catch (e) {
    console.warn('Affiliate check failed, continuing as customer:', e);
  }

  // As soon as access is granted: hide skeleton and show dashboard (do this before any other work)
  console.log('✅ Access granted - showing dashboard' + (isAffiliate && affiliateData ? ' (with Affiliate tab)' : ' (customer only)'));
  hideSkeleton(true);

  if (!isAffiliate || !affiliateData) {
    hideAffiliateTabAndContent();
  }

  initializeTabs();

  try {
    // Load customer data and populate customer sections for everyone
    await loadCustomerData();

    populateSidebar();
    populateDashboardStats();
    populateRecentOrders();
    populateWishlist();
    populateAddresses();
    populatePayments();
    populateAccountDetails();

    // Populate affiliate sections only when customer is an affiliate
    if (isAffiliate && affiliateData) {
      populateAffiliateProfile();
      populatePrimaryReferralLink();
      populateReferralLinks();
      populateEarningsMetrics();
      populateAnalytics();
      await populateAffiliateOrders();
    }
  } catch (e) {
    console.warn('Dashboard data load error (UI already visible):', e);
  }

  console.log('✅ Dashboard initialized successfully');
}

/**
 * Hide the Affiliate tab/link, affiliate tab content, and Affiliate quick link when user is not an affiliate.
 */
function hideAffiliateTabAndContent() {
  const tabBtn = document.querySelector('.ks-tab[data-tab="affiliate"]') || document.querySelector('a.ks-tab[href*="affiliate-area"]');
  const tabContent = document.getElementById('affiliate');
  if (tabBtn) tabBtn.style.display = 'none';
  if (tabContent) tabContent.style.display = 'none';
  document.querySelectorAll('.ks-shortcut__label').forEach(function (el) {
    if (el.textContent.trim() === 'Affiliate') {
      const shortcut = el.closest('.ks-shortcut');
      if (shortcut) shortcut.style.display = 'none';
    }
  });
}

/**
 * Show access denied message. Optionally include a link (href only, not exposed as text).
 * @param {string} message - Main message text
 * @param {{ url: string, text: string }} linkOption - Optional: { url, text } for a clickable link
 */
function showAccessDeniedError(message, linkOption) {
  const dashboardContainer = document.getElementById('dashboard-container');
  const errorContainer = document.getElementById('dashboard-error');
  const errorMessage = document.getElementById('error-message');

  if (dashboardContainer) {
    dashboardContainer.style.display = 'none';
  }

  if (errorContainer) {
    errorContainer.style.display = 'block';
    if (errorMessage) {
      if (linkOption && linkOption.url) {
        const linkText = linkOption.text || 'Learn how to become an affiliate';
        errorMessage.innerHTML = message + '<a href="' + linkOption.url.replace(/"/g, '&quot;') + '" target="_blank" rel="noopener noreferrer" class="ks-access-denied-link">' + escapeHtml(linkText) + '</a>. Or contact support.';
      } else {
        errorMessage.textContent = message;
      }
    }
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/* --------------------------------------------------
   TABS MANAGEMENT
-------------------------------------------------- */

/**
 * Refetch and re-populate data for the given tab so the user sees latest data when switching tabs.
 */
async function refreshTabData(tabName) {
  try {
    switch (tabName) {
      case 'dashboard':
        populateDashboardStats();
        populateRecentOrders();
        break;
      case 'orders':
        populateAllOrders();
        break;
      case 'affiliate':
        await loadAffiliateDashboard();
        if (isAffiliate && affiliateData) {
          populateAffiliateProfile();
          populatePrimaryReferralLink();
          populateReferralLinks();
          populateEarningsMetrics();
          populateAnalytics();
        }
        break;
      case 'account':
        await loadCustomerData();
        if (customerData) populateAccountDetails();
        break;
      default:
        break;
    }
  } catch (err) {
    console.warn('Tab refresh failed for', tabName, err);
  }
}

function initializeTabs() {
  const tabs = document.querySelectorAll('.ks-tab');
  const contents = document.querySelectorAll('.ks-tab-content');

  console.log(`🧩 Tabs found: ${tabs.length}`);
  console.log(`📦 Contents found: ${contents.length}`);

  if (!tabs.length || !contents.length) return;

  const activateTab = (tabName, options) => {
    if (tabName === 'affiliate' && (!isAffiliate || !affiliateData)) {
      tabName = 'dashboard';
    }
    const shouldRefresh = options && options.refresh === true;
    tabs.forEach(t => t.classList.remove('active'));
    contents.forEach(c => c.classList.remove('active'));

    const tab = document.querySelector(`.ks-tab[data-tab="${tabName}"]`);
    const content = document.getElementById(tabName);

    if (tab && content) {
      tab.classList.add('active');
      content.classList.add('active');
      if (tabName === 'account' && customerData) populateAccountDetails();
      console.log(`✅ Active tab: ${tabName}`);
      if (shouldRefresh) refreshTabData(tabName);
    }
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      // Let link tabs (e.g. Affiliate -> /pages/affiliate-area) navigate normally
      if (tab.tagName === 'A' && tab.getAttribute('href')) {
        return;
      }
      e.preventDefault();
      const target = tab.dataset.tab;
      if (!target) return;

      activateTab(target, { refresh: true });
      history.replaceState(null, '', `#${target}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  // Activate default / hash tab on load (no refresh – data already loaded in init)
  const hash = window.location.hash.replace('#', '');
  let defaultTab = hash || (tabs[0] && tabs[0].dataset.tab) || 'dashboard';
  if (defaultTab === 'affiliate' && (!isAffiliate || !affiliateData)) {
    defaultTab = 'dashboard';
  }
  activateTab(defaultTab);

  // Delegated handler for referral link copy buttons (avoids escaping URL in onclick)
  const container = document.getElementById('dashboard-container');
  if (container) {
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.js-copy-link-btn');
      if (!btn || !btn.dataset.copyUrl) return;
      copyToClipboard(btn.dataset.copyUrl);
    });
  }
}

/* --------------------------------------------------
   HELPERS
-------------------------------------------------- */

/**
 * Order statuses: Payment (10), Fulfillment (6), Order state (3).
 * Maps raw status to CSS class and display label.
 */
function getStatusBadge(status) {
  if (status == null || status === '') return '<span class="ks-status ks-status-pending">Pending</span>';
  var raw = String(status).trim();
  var slug = raw.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  var labelMap = {
    pending: 'Pending',
    authorized: 'Authorized',
    due: 'Due',
    expiring: 'Expiring',
    expired: 'Expired',
    paid: 'Paid',
    refunded: 'Refunded',
    partially_refunded: 'Partially refunded',
    partially_paid: 'Partially paid',
    voided: 'Voided',
    unfulfilled: 'Unfulfilled',
    in_progress: 'In progress',
    on_hold: 'On hold',
    scheduled: 'Scheduled',
    partially_fulfilled: 'Partially fulfilled',
    fulfilled: 'Fulfilled',
    open: 'Open',
    archived: 'Archived',
    cancelled: 'Canceled',
    canceled: 'Canceled',
    delivered: 'Delivered',
    shipped: 'Shipped',
    processing: 'Processing',
    active: 'Active',
    inactive: 'Inactive',
    suspended: 'Suspended',
    deactivated: 'Deactivated'
  };
  var classMap = {
    paid: 'ks-status-paid',
    fulfilled: 'ks-status-fulfilled',
    delivered: 'ks-status-delivered',
    shipped: 'ks-status-shipped',
    processing: 'ks-status-processing',
    in_progress: 'ks-status-processing',
    pending: 'ks-status-pending',
    authorized: 'ks-status-pending',
    due: 'ks-status-pending',
    expiring: 'ks-status-expiring',
    scheduled: 'ks-status-pending',
    open: 'ks-status-open',
    partially_paid: 'ks-status-partial',
    partially_fulfilled: 'ks-status-partial',
    partially_refunded: 'ks-status-partial-refund',
    unfulfilled: 'ks-status-unfulfilled',
    on_hold: 'ks-status-on-hold',
    refunded: 'ks-status-refunded',
    voided: 'ks-status-voided',
    expired: 'ks-status-expired',
    cancelled: 'ks-status-cancelled',
    canceled: 'ks-status-cancelled',
    archived: 'ks-status-archived',
    active: 'ks-status-active',
    inactive: 'ks-status-inactive',
    suspended: 'ks-status-suspended',
    deactivated: 'ks-status-deactivated'
  };
  var label = labelMap[slug] || raw.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  var cls = classMap[slug] || 'ks-status-default';
  return '<span class="ks-status ' + cls + '">' + escapeHtml(label) + '</span>';
}

/** True if order payment is not yet complete (no View/Invoice). */
function isOrderPaymentPending(status) {
  if (status == null || status === '') return true;
  var s = String(status).toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  return s === 'pending' || s === 'authorized' || s === 'due' || s === 'expiring' || s === 'expired';
}

function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
}

/** Sidebar nav icons (house, document, pin, person, heart, network, help) */
function getSidebarTabIcon(type) {
  const icons = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    orders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
    addresses: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    account: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    wishlist: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    affiliate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
    support: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
  };
  return icons[type] || '';
}

function hasPractitionerTag(profile) {
  if (!profile || !Array.isArray(profile.tags)) return false;
  return profile.tags.some(function (t) { return String(t).toLowerCase() === 'practitioner'; });
}

function populateSidebar() {
  const nameEl = document.getElementById('ks-sidebar-name');
  const emailEl = document.getElementById('ks-sidebar-email');
  const email = getCustomerEmail() || '';
  if (emailEl) emailEl.textContent = email || '—';
  let name = (customerData && customerData.profile && customerData.profile.name) ? customerData.profile.name : '';
  if (!name && window.KISCENCE_CUSTOMER && window.KISCENCE_CUSTOMER.name) name = window.KISCENCE_CUSTOMER.name;
  if (!name && email) name = email.replace(/@.*/, '').replace(/[._]/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  if (nameEl) nameEl.textContent = name || 'Account';

  var profileDiv = document.querySelector('.ks-sidebar__profile');
  var badgeEl = profileDiv ? profileDiv.querySelector('.ks-sidebar__badge') : null;
  var showBadge = customerData && customerData.profile && hasPractitionerTag(customerData.profile);
  if (showBadge) {
    if (!badgeEl && profileDiv) {
      badgeEl = document.createElement('span');
      badgeEl.className = 'ks-sidebar__badge';
      badgeEl.textContent = 'Practitioner';
      profileDiv.appendChild(badgeEl);
    }
  } else if (badgeEl) {
    badgeEl.remove();
  }

  document.querySelectorAll('.ks-sidebar .ks-tab, .ks-dashboard .ks-tab').forEach(function (tab) {
    const iconEl = tab.querySelector('.ks-tab__icon');
    if (!iconEl) return;
    let type = tab.getAttribute('data-tab') || '';
    if (!type && tab.getAttribute('href')) {
      if (tab.getAttribute('href').indexOf('affiliate-area') !== -1) type = 'affiliate';
      else if (tab.getAttribute('href').indexOf('contact') !== -1) type = 'support';
    }
    const svg = getSidebarTabIcon(type);
    if (svg) iconEl.innerHTML = svg;
  });
}

/* --------------------------------------------------
   CUSTOMER: DASHBOARD TAB
-------------------------------------------------- */

const ORDERS_PAGE_SIZE = 8;

/** Table header row for orders (Payment status + Fulfillment status). */
function getOrdersTableHeader() {
  return '<tr><th class="ks-visits-th">Order</th><th class="ks-visits-th">Date</th><th class="ks-visits-th">Total</th><th class="ks-visits-th">Payment status</th><th class="ks-visits-th">Fulfillment status</th><th class="ks-visits-th">Actions</th></tr>';
}

/**
 * Build a single table row for the orders table (visits-style).
 * Columns: Order #, Date, Total, Payment status, Fulfillment status, Actions (View / Invoice).
 */
function buildOrderTableRow(order, i) {
  const orderId = order.id || order.orderId;
  const date = order.date || order.timestamp;
  const dateStr = date ? new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
  const amount = order.total != null ? order.total : order.amount;
  const currency = order.currency || 'USD';
  const totalStr = typeof amount === 'string' ? amount : formatCurrency(amount || 0, currency);
  const paymentStatus = order.financial_status != null ? order.financial_status : order.status;
  const paymentBadge = getStatusBadge(paymentStatus || 'Pending');
  const fulfillmentStatus = order.fulfillment_status != null && order.fulfillment_status !== '' ? order.fulfillment_status : null;
  const fulfillmentBadge = fulfillmentStatus ? getStatusBadge(fulfillmentStatus) : '<span class="ks-status ks-status-default">—</span>';
  const displayOrderNum = order.orderId != null ? order.orderId : orderId;
  const apiOrderId = order.id != null ? order.id : orderId;
  const apiOrderIdAttr = escapeAttr(String(apiOrderId));
  const isPending = isOrderPaymentPending(paymentStatus);
  const actionsHtml = isPending
    ? '<td class="ks-visits-td"><p class="ks-order-card__pending-hint">View & invoice available when order is paid.</p></td>'
    : '<td class="ks-visits-td"><button type="button" class="ks-btn ks-btn-small" onclick="viewOrder(\'' + apiOrderIdAttr + '\')">View</button> <button type="button" class="ks-btn ks-btn-small" onclick="downloadInvoice(\'' + apiOrderIdAttr + '\')">Invoice</button> <button type="button" class="ks-btn ks-btn-small ks-btn-primary" onclick="reorderOrder(\'' + apiOrderIdAttr + '\', this)">Reorder</button></td>';
  return '<tr>' +
    '<td class="ks-visits-td ks-visits-td--id">' + escapeHtml(String(displayOrderNum)) + '</td>' +
    '<td class="ks-visits-td ks-visits-td--date">' + escapeHtml(dateStr) + '</td>' +
    '<td class="ks-visits-td">' + escapeHtml(totalStr) + '</td>' +
    '<td class="ks-visits-td">' + paymentBadge + '</td>' +
    '<td class="ks-visits-td">' + fulfillmentBadge + '</td>' +
    actionsHtml +
    '</tr>';
}

function buildOrderCardHtml(order, i, idPrefix) {
  const orderId = order.id || order.orderId;
  const date = order.date || order.timestamp;
  const dateStr = date ? new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
  const amount = order.total || order.amount;
  const currency = order.currency || 'USD';
  const displayStatus = order.status || order.financial_status || order.fulfillment_status || 'Pending';
  const statusBadge = getStatusBadge(displayStatus);
  const detailId = idPrefix + 'order-details-' + i;
  const statusSlug = String(displayStatus).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'pending';
  const cardModifier = statusSlug ? ' ks-order-card--' + statusSlug : '';
  const isAffiliateConversion = order && (order.commissionAmount != null || (order.customerName != null || order.customerEmail != null));

  if (isAffiliate && isAffiliateConversion) {
    const name = escapeHtml(order.customerName || '—');
    const email = escapeHtml(order.customerEmail || '—');
    const phone = escapeHtml(order.customerPhone || '—');
    return `
      <article class="ks-order-card${cardModifier}" data-index="${i}">
        <div class="ks-order-card__top">
          <div class="ks-order-card__id">Order ${orderId}</div>
          <time class="ks-order-card__date" datetime="${date || ''}">${dateStr}</time>
          <div class="ks-order-card__status">${statusBadge}</div>
        </div>
        <div class="ks-order-card__main">
          <div class="ks-order-card__amounts">
            <span class="ks-order-card__total"><span class="ks-order-card__label">Total</span> ${currency} ${(amount || 0).toFixed(2)}</span>
            <span class="ks-order-card__commission"><span class="ks-order-card__label">Commission</span> ${currency} ${((order.commissionAmount || 0).toFixed(2))}</span>
          </div>
          <button type="button" class="ks-order-card__toggle" data-index="${i}" data-detail-id="${detailId}" aria-expanded="false" aria-controls="${detailId}">
            <span class="ks-order-card__toggle-text">Customer details</span>
            <span class="ks-order-card__toggle-icon" aria-hidden="true">▼</span>
          </button>
        </div>
        <div class="ks-order-card__details" id="${detailId}" hidden aria-hidden="true">
          <div class="ks-order-card__details-inner">
            <p><strong>Name</strong> ${name}</p>
            <p><strong>Email</strong> ${email}</p>
            <p><strong>Contact</strong> ${phone}</p>
          </div>
        </div>
      </article>`;
  }
  const totalStr = typeof amount === 'string' ? amount : (currency + ' ' + (amount || 0).toFixed(2));
  const displayOrderNum = order.orderId != null ? order.orderId : orderId;
  const apiOrderId = order.id != null ? order.id : orderId;
  const apiOrderIdAttr = escapeAttr(String(apiOrderId));
  const paymentStatus = order.financial_status != null ? order.financial_status : order.status;
  const isPending = isOrderPaymentPending(paymentStatus);
  const actionsHtml = isPending
    ? '<p class="ks-order-card__pending-hint">View & invoice available when order is paid.</p>'
    : `<div class="ks-order-card__actions">
            <button type="button" onclick="viewOrder('${apiOrderIdAttr}')" class="ks-btn-small">View</button>
            <button type="button" onclick="downloadInvoice('${apiOrderIdAttr}')" class="ks-btn-small">Invoice</button>
            <button type="button" onclick="reorderOrder('${apiOrderIdAttr}', this)" class="ks-btn-small ks-btn-primary">Reorder</button>
          </div>`;
  return `
      <article class="ks-order-card${cardModifier}" data-order-id="${apiOrderIdAttr}">
        <div class="ks-order-card__top">
          <div class="ks-order-card__id">Order #${escapeHtml(String(displayOrderNum))}</div>
          <time class="ks-order-card__date" datetime="${date || ''}">${dateStr}</time>
          <div class="ks-order-card__status">${statusBadge}</div>
        </div>
        <div class="ks-order-card__main">
          <div class="ks-order-card__amounts">
            <span class="ks-order-card__total"><span class="ks-order-card__label">Total</span> ${totalStr}</span>
          </div>
          ${actionsHtml}
        </div>
      </article>`;
}

function bindOrderCardToggles(container) {
  if (!container) return;
  container.querySelectorAll('.ks-order-card__toggle').forEach(btn => {
    btn.addEventListener('click', function () {
      const detailId = this.getAttribute('data-detail-id');
      const details = detailId ? document.getElementById(detailId) : null;
      const icon = this.querySelector('.ks-order-card__toggle-icon');
      const text = this.querySelector('.ks-order-card__toggle-text');
      if (!details) return;
      const isOpen = !details.hidden;
      details.hidden = isOpen;
      details.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
      this.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
      if (text) text.textContent = isOpen ? 'Customer details' : 'Hide details';
      if (icon) icon.textContent = isOpen ? '▼' : '▲';
    });
  });
}

/** Stats cards markup (kept in JS to reduce Liquid bundle size). Order: Total Orders, Pending Orders, Total Protocols, Wishlist. */
function getStatsMarkup() {
  return '<div class="ks-stat-card ks-stat-card--orders"><span class="ks-stat-card__icon" aria-hidden="true"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></span><div class="ks-stat-card__content"><span class="ks-stat-card__label">Total Orders</span><span class="ks-stat-card__value" id="ks-stats-total-orders">—</span></div></div><div class="ks-stat-card ks-stat-card--pending"><span class="ks-stat-card__icon" aria-hidden="true"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span><div class="ks-stat-card__content"><span class="ks-stat-card__label">Pending Orders</span><span class="ks-stat-card__value" id="ks-stats-pending">—</span></div></div><div class="ks-stat-card ks-stat-card--protocols"><span class="ks-stat-card__icon" aria-hidden="true"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg></span><div class="ks-stat-card__content"><span class="ks-stat-card__label">Total Protocols</span><span class="ks-stat-card__value" id="ks-stats-protocols">—</span></div></div><div class="ks-stat-card ks-stat-card--wishlist"><span class="ks-stat-card__icon" aria-hidden="true"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></span><div class="ks-stat-card__content"><span class="ks-stat-card__label">Wishlist</span><span class="ks-stat-card__value" id="ks-stats-wishlist">—</span></div></div>';
}

function ensureStatsRendered() {
  const container = document.getElementById('ks-stats');
  if (!container || container.children.length > 0) return;
  container.innerHTML = getStatsMarkup();
}

/**
 * Populate dashboard stat cards: Total Orders, Pending Orders, Total Protocols, Wishlist.
 */
function populateDashboardStats() {
  ensureStatsRendered();
  const orders = (customerData && customerData.orders) ? customerData.orders : [];
  const wishlist = (customerData && customerData.wishlist) ? customerData.wishlist : [];
  const totalOrders = orders.length;
  const paymentStatus = function (o) { return o.financial_status != null ? o.financial_status : o.status; };
  const pendingOrders = orders.filter(function (o) { return isOrderPaymentPending(paymentStatus(o)); }).length;
  const protocols = (customerData && customerData.protocols) ? customerData.protocols : [];
  const totalProtocols = Array.isArray(protocols) ? protocols.length : (typeof protocols === 'number' ? protocols : 0);
  const setStat = function (id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  setStat('ks-stats-total-orders', String(totalOrders));
  setStat('ks-stats-pending', String(pendingOrders));
  setStat('ks-stats-protocols', String(totalProtocols));
  setStat('ks-stats-wishlist', String(wishlist.length));
}

function populateRecentOrders() {
  const recentEl = document.getElementById('recent-orders');
  if (!recentEl) return;

  const allOrders = (customerData && customerData.orders) ? customerData.orders : [];
  const orders = allOrders.slice(0, 3);

  if (!orders || orders.length === 0) {
    recentEl.innerHTML = '<div class="ks-visits-table-wrap"><table class="ks-visits-table" role="grid"><thead>' + getOrdersTableHeader() + '</thead><tbody><tr><td colspan="6" class="ks-visits-empty">No orders yet.</td></tr></tbody></table></div>';
    return;
  }

  const tableBody = orders.map((order, i) => buildOrderTableRow(order, i)).join('');
  recentEl.innerHTML =
    '<div class="ks-visits-table-wrap">' +
    '<table class="ks-visits-table" role="grid">' +
    '<thead>' + getOrdersTableHeader() + '</thead>' +
    '<tbody>' + tableBody + '</tbody>' +
    '</table></div>';
}

/* --------------------------------------------------
   CUSTOMER: ORDERS TAB
-------------------------------------------------- */

function populateAllOrders() {
  const ordersEl = document.getElementById('all-orders');
  const paginationEl = document.getElementById('orders-pagination');
  if (!ordersEl) return;

  const allOrders = (customerData && customerData.orders) ? customerData.orders : [];
  const totalCount = allOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / ORDERS_PAGE_SIZE));
  const currentPage = Math.min(Math.max(0, window.ordersCurrentPage || 0), totalPages - 1);
  window.ordersCurrentPage = currentPage;

  const start = currentPage * ORDERS_PAGE_SIZE;
  const orders = (allOrders || []).slice(start, start + ORDERS_PAGE_SIZE);

  if (totalCount === 0) {
    ordersEl.innerHTML =
      '<div class="ks-visits-table-wrap">' +
      '<table class="ks-visits-table" role="grid">' +
      '<thead>' + getOrdersTableHeader() + '</thead>' +
      '<tbody><tr><td colspan="6" class="ks-visits-empty">No orders yet.</td></tr></tbody></table></div>' +
      '<div class="ks-visits-footer"><span>0 items</span></div>';
    if (paginationEl) paginationEl.innerHTML = '';
    return;
  }

  const tableBody = orders.map((order, i) => buildOrderTableRow(order, start + i)).join('');
  ordersEl.innerHTML =
    '<div class="ks-visits-table-wrap">' +
    '<table class="ks-visits-table" role="grid">' +
    '<thead>' + getOrdersTableHeader() + '</thead>' +
    '<tbody>' + tableBody + '</tbody></table></div>' +
    '<div class="ks-visits-footer">' +
    '<span>' + totalCount + ' item' + (totalCount !== 1 ? 's' : '') + '</span>' +
    '<div id="orders-pagination-inner" class="ks-visits-pagination"></div></div>';

  const innerPagination = document.getElementById('orders-pagination-inner');
  if (paginationEl) paginationEl.innerHTML = '';
  if (innerPagination && totalPages > 1) {
    const page = currentPage + 1;
    const prev = Math.max(0, currentPage - 1) + 1;
    const next = Math.min(totalPages, currentPage + 2);
    innerPagination.innerHTML =
      '<button type="button" class="ks-visits-pagination-btn" data-page="0"' + (currentPage <= 0 ? ' disabled' : '') + ' aria-label="First page">&laquo;</button>' +
      '<button type="button" class="ks-visits-pagination-btn" data-page="' + (currentPage - 1) + '"' + (currentPage <= 0 ? ' disabled' : '') + ' aria-label="Previous">&lsaquo;</button>' +
      '<span class="ks-visits-pagination-info">' + page + ' of ' + totalPages + '</span>' +
      '<button type="button" class="ks-visits-pagination-btn" data-page="' + (currentPage + 1) + '"' + (currentPage >= totalPages - 1 ? ' disabled' : '') + ' aria-label="Next">&rsaquo;</button>' +
      '<button type="button" class="ks-visits-pagination-btn" data-page="' + (totalPages - 1) + '"' + (currentPage >= totalPages - 1 ? ' disabled' : '') + ' aria-label="Last page">&raquo;</button>';
    innerPagination.querySelectorAll('.ks-visits-pagination-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', function () {
        const p = parseInt(this.getAttribute('data-page'), 10);
        if (isNaN(p) || p < 0) return;
        window.ordersCurrentPage = p;
        populateAllOrders();
      });
    });
  }
}

/**
 * Fetch and populate affiliate orders from referral conversions
 */
async function populateAffiliateOrders() {
  if (!isAffiliate || !currentAffiliateId) return;

  try {
    console.log('📦 Fetching affiliate orders for:', currentAffiliateId);
    const result = await apiCall(`/api/affiliates/${currentAffiliateId}/orders`);
    
    if (result.success && result.orders) {
      window.affiliateOrders = result.orders;
      window.ordersCurrentPage = 0;
      console.log('✅ Affiliate orders loaded:', result.orders);
      populateAllOrders(); // Populate the Orders tab with affiliate orders
      populateRecentOrders(); // Update Dashboard tab "Recent orders" with same real data
    } else {
      console.warn('⚠️ Failed to fetch affiliate orders:', result.error);
      window.affiliateOrders = [];
    }
  } catch (error) {
    console.error('❌ Error fetching affiliate orders:', error);
    window.affiliateOrders = [];
  }
}

/* --------------------------------------------------
   CUSTOMER: ADDRESSES TAB
-------------------------------------------------- */

/** Normalize address to a string for duplicate comparison (visual only). */
function addressMatchKey(addr) {
  var a1 = (addr.address1 || '').trim().toLowerCase();
  var a2 = (addr.address2 || '').trim().toLowerCase();
  var city = (addr.city || '').trim().toLowerCase();
  var state = (addr.province || addr.state || '').trim().toLowerCase();
  var zip = (addr.zip || '').trim().toLowerCase();
  var name = (addr.name || [].concat(addr.firstName, addr.lastName).filter(Boolean).join(' ') || '').trim().toLowerCase();
  return [a1, a2, city, state, zip, name].join('|');
}

/** Return shipping addresses that are not visually duplicated in billing (so billing-only addresses don't show under Shipping). */
function shippingAddressesWithoutBillingDuplicates(shippingList, billingList) {
  if (!billingList || billingList.length === 0) return shippingList;
  var billingKeys = {};
  for (var i = 0; i < billingList.length; i++) {
    billingKeys[addressMatchKey(billingList[i])] = true;
  }
  return shippingList.filter(function (addr) {
    return !billingKeys[addressMatchKey(addr)];
  });
}

function renderAddressCards(addresses, addressType) {
  var type = addressType || 'shipping';
  return addresses.map(function (addr) {
    var id = addr.id;
    var idAttr = typeof id === 'number' ? id : "'" + String(id).replace(/'/g, "\\'") + "'";
    var typeLabel = addr.default ? 'Default address (used at checkout)' : 'Additional address';
    var streetLine = addr.street ? escapeHtml(addr.street) + '<br>' : '';
    var cityStateZip = [addr.city, addr.state, addr.zip].filter(Boolean).join(', ') || '—';
    var setDefaultFn = type === 'billing' ? 'setDefaultBillingAddress' : 'setDefaultAddress';
    var editFn = type === 'billing' ? 'editBillingAddress' : 'editAddress';
    var deleteFn = type === 'billing' ? 'deleteBillingAddress' : 'deleteAddress';
    var setDefaultBtn = addr.default
      ? '<span class="ks-address-default-badge">Default</span>'
      : '<button type="button" onclick="' + setDefaultFn + '(' + idAttr + ')" class="ks-btn-small ks-btn-set-default">Set as default</button>';
    return (
      '<div class="address-card ' + (addr.default ? 'address-card--default' : '') + '">' +
      '<h5>' + escapeHtml(typeLabel) + '</h5>' +
      '<p>' + escapeHtml(addr.name || '') + '</p>' +
      '<p>' + streetLine + escapeHtml(cityStateZip) + '</p>' +
      '<div class="address-actions">' +
      setDefaultBtn +
      '<button type="button" onclick="' + editFn + '(' + idAttr + ')" class="ks-btn-small">Edit</button>' +
      '<button type="button" onclick="' + deleteFn + '(' + idAttr + ')" class="ks-btn-small">Delete</button>' +
      '</div></div>'
    );
  }).join('');
}

function populateAddresses() {
  var addressesEl = document.getElementById('addresses-list');
  if (!addressesEl || !customerData) return;

  var addresses = customerData.addresses || [];
  var billingAddresses = customerData.billingAddresses || [];
  var shippingOnly = shippingAddressesWithoutBillingDuplicates(addresses, billingAddresses);
  var shippingCount = shippingOnly.length;
  var billingCount = billingAddresses.length;
  var countHint = 'Shipping and billing are managed separately. Edit one side without affecting the other.';
  var shippingHint = 'Used at checkout for delivery. Stored in your Shopify account.';
  var billingHint = 'Stored here for your records. At checkout you can use this or choose from your shipping addresses.';

  var shippingCards = renderAddressCards(shippingOnly, 'shipping');
  var billingCards = renderAddressCards(billingAddresses, 'billing');

  addressesEl.innerHTML =
    '<p class="ks-addresses-count-hint">' + escapeHtml(countHint) + '</p>' +
    '<div class="addresses-split">' +
    '<div class="addresses-split__col addresses-split__shipping">' +
    '<h4 class="addresses-split__title">Shipping address</h4>' +
    '<p class="ks-addresses-col-hint">' + escapeHtml(shippingHint) + '</p>' +
    (shippingCount === 0
      ? '<p class="ks-addresses-empty-hint">Add shipping addresses (up to 5 at checkout). Set one as default.</p>' +
        '<div class="addresses-grid addresses-split__grid"></div>' +
        '<button type="button" onclick="addAddress()" class="ks-btn ks-btn-primary">Add shipping address</button>'
      : '<div class="addresses-grid addresses-split__grid">' + shippingCards + '</div>' +
        '<button type="button" onclick="addAddress()" class="ks-btn ks-btn-primary">Add shipping address</button>') +
    '</div>' +
    '<div class="addresses-split__col addresses-split__billing">' +
    '<h4 class="addresses-split__title">Billing address</h4>' +
    '<p class="ks-addresses-col-hint">' + escapeHtml(billingHint) + '</p>' +
    (billingCount === 0
      ? '<p class="ks-addresses-empty-hint">Add billing addresses here. They are stored separately from shipping.</p>' +
        '<div class="addresses-grid addresses-split__grid"></div>' +
        '<button type="button" onclick="addBillingAddress()" class="ks-btn ks-btn-primary">Add billing address</button>'
      : '<div class="addresses-grid addresses-split__grid">' + billingCards + '</div>' +
        '<button type="button" onclick="addBillingAddress()" class="ks-btn ks-btn-primary">Add billing address</button>') +
    '</div>' +
    '</div>';
}

/* --------------------------------------------------
   CUSTOMER: PAYMENTS TAB
-------------------------------------------------- */

function populatePayments() {
  const paymentsEl = document.getElementById('payment-methods');
  if (!paymentsEl || !customerData) return;

  const payments = customerData.payments || [];
  const paymentsUnavailable = customerData.paymentsUnavailable === true;

  if (paymentsUnavailable) {
    paymentsEl.innerHTML = `
      <p class="ks-payment-methods-unavailable">Payment methods are not available for this app. The store has not granted access to view or manage saved payment methods. Addresses and other account features still work as usual.</p>
    `;
    return;
  }

  if (payments.length === 0) {
    paymentsEl.innerHTML = `
      <p>No payment methods saved yet. You can add a card or other payment method at checkout when you place an order.</p>
      <p><button type="button" onclick="addPaymentMethod()" class="ks-btn">Add Payment Method</button></p>
    `;
    return;
  }

  paymentsEl.innerHTML = `
    <div class="payment-methods">
      ${payments.map(payment => {
        const idAttr = escapeAttr(payment.id);
        const typeLabel = escapeHtml(payment.type || 'Card');
        const last4Label = payment.last4 ? `Ending in ${escapeHtml(payment.last4)}` : '';
        const expiryLabel = payment.expiry ? `Expires ${escapeHtml(payment.expiry)}` : '';
        return `
        <div class="payment-card" data-payment-id="${idAttr}">
          <div class="payment-info">
            <p><strong>${typeLabel}</strong></p>
            ${last4Label ? '<p>' + last4Label + '</p>' : ''}
            ${expiryLabel ? '<p>' + expiryLabel + '</p>' : ''}
          </div>
          <div class="payment-actions">
            <button type="button" class="ks-btn-small" onclick="editPaymentMethod(this.closest('[data-payment-id]').getAttribute('data-payment-id'))">Edit</button>
            <button type="button" class="ks-btn-small" onclick="deletePaymentMethod(this.closest('[data-payment-id]').getAttribute('data-payment-id'))">Delete</button>
          </div>
        </div>`;
      }).join('')}
    </div>
    <p><button type="button" onclick="addPaymentMethod()" class="ks-btn ks-btn-primary">Add Payment Method</button></p>
  `;
}

/* --------------------------------------------------
   CUSTOMER: ACCOUNT TAB
-------------------------------------------------- */

function parsePhoneWithCode(phone) {
  if (!phone || typeof phone !== 'string') return { countryCode: '', number: '' };
  const s = phone.trim();
  // Use 1–3 digits for country code so "+918126263845" parses as "+91" + "8126263845" (not "+9181" + "26263845")
  const match = s.match(/^(\+\d{1,3})(?:\s+)?(.*)$/);
  if (match) return { countryCode: match[1], number: (match[2] || '').trim().replace(/\s+/g, ' ') };
  return { countryCode: '', number: s };
}

function populateAccountDetails() {
  const accountEl = document.getElementById('account-details');
  if (!accountEl || !customerData) return;

  const profile = customerData.profile;
  const phoneParts = parsePhoneWithCode(profile.phone || '');
  const newsletterChecked = profile.newsletterSubscribed === true;
  const orderUpdatesChecked = profile.orderUpdates !== false;
  const privacyPolicyUrl = (typeof window.KS_PRIVACY_POLICY_URL === 'string' && window.KS_PRIVACY_POLICY_URL)
    ? window.KS_PRIVACY_POLICY_URL
    : '/policies/privacy-policy';

  accountEl.innerHTML = `
    <div class="ks-account-card">
      <form onsubmit="saveAccountDetails(event)" class="ks-account-form">
        <div class="ks-account-form__row">
          <div class="ks-account-form__field">
            <label for="fullname">Full Name</label>
            <input type="text" id="fullname" name="fullname" value="${escapeAttr(profile.name)}" required placeholder="Your full name">
          </div>
        </div>
        <div class="ks-account-form__row">
          <div class="ks-account-form__field">
            <label for="email">Email Address</label>
            <input type="email" id="email" name="email" value="${escapeAttr(profile.email)}" required placeholder="you@example.com">
          </div>
        </div>
        <div class="ks-account-form__row ks-account-form__row--phone">
          <div class="ks-account-form__field ks-account-form__field--code">
            <label for="phone-code">Country code</label>
            <input type="tel" id="phone-code" name="phoneCode" value="${escapeAttr(phoneParts.countryCode)}" placeholder="+44" maxlength="5" inputmode="tel" title="Include + and digits, e.g. +44">
          </div>
          <div class="ks-account-form__field ks-account-form__field--number">
            <label for="phone">Phone number</label>
            <input type="tel" id="phone" name="phone" value="${escapeAttr(phoneParts.number)}" placeholder="e.g. 7123 456 789" inputmode="tel">
          </div>
        </div>
        <div class="ks-account-form__row">
          <div class="ks-account-form__field ks-account-form__field--password">
            <label for="password">New Password</label>
            <div class="ks-account-form__password-wrap">
              <input type="password" id="password" name="password" placeholder="Leave blank to keep current password">
              <button type="button" class="ks-account-form__toggle" onclick="togglePasswordVisibility('password')">Show</button>
            </div>
          </div>
        </div>
        <div class="ks-account-form__row">
          <div class="ks-account-form__field ks-account-form__field--password">
            <label for="passwordConfirm">Confirm Password</label>
            <div class="ks-account-form__password-wrap">
              <input type="password" id="passwordConfirm" name="passwordConfirm" placeholder="Re-enter new password">
              <button type="button" class="ks-account-form__toggle" onclick="togglePasswordVisibility('passwordConfirm')">Show</button>
            </div>
          </div>
        </div>
        <div class="ks-account-form__section ks-account-form__section--preferences">
          <p class="ks-account-form__preferences-title">Please select all the ways you would like to hear from us</p>
          <div class="ks-account-form__row ks-account-form__row--checkbox">
            <div class="ks-account-form__field ks-account-form__field--checkbox">
              <label class="ks-account-form__checkbox-label">
                <input type="checkbox" id="newsletter" name="newsletter" ${newsletterChecked ? 'checked' : ''} value="1">
                <span class="ks-account-form__checkbox-text">Subscribe to our newsletter and receive offers and product updates</span>
              </label>
              <p class="ks-account-form__consent">By checking this box, I consent to receive Ki Science's online newsletter containing news, product updates, and promotional offers. I understand that I can unsubscribe at any time via the link in the email or within my account settings. I have read and agree to the <a href="${escapeAttr(privacyPolicyUrl)}" target="_blank" rel="noopener">Privacy Policy</a>.</p>
            </div>
          </div>
          <div class="ks-account-form__row ks-account-form__row--checkbox">
            <div class="ks-account-form__field ks-account-form__field--checkbox">
              <label class="ks-account-form__checkbox-label">
                <input type="checkbox" id="orderUpdates" name="orderUpdates" ${orderUpdatesChecked ? 'checked' : ''} value="1">
                <span class="ks-account-form__checkbox-text">Receive Order Updates</span>
              </label>
            </div>
          </div>
        </div>
        <div class="ks-account-form__actions">
          <button type="submit" class="ks-btn ks-btn-primary">Save Changes</button>
        </div>
      </form>
    </div>
  `;

  // Auto-save newsletter and order updates when checkbox is toggled (no need to click Save)
  const newsletterEl = accountEl.querySelector('#newsletter');
  const orderUpdatesEl = accountEl.querySelector('#orderUpdates');
  if (newsletterEl) {
    newsletterEl.addEventListener('change', function () {
      saveNewsletterPreference(this.checked);
    });
  }
  if (orderUpdatesEl) {
    orderUpdatesEl.addEventListener('change', function () {
      saveOrderUpdatesPreference(this.checked);
    });
  }
}

async function saveNewsletterPreference(subscribed) {
  const shop = window.Shopify?.shop || window.location.hostname;
  const customerId = getCustomerId();
  if (!shop || !customerId) {
    showToast('Cannot update: please log in again.', 'error');
    return;
  }
  const result = await apiCall('/api/customers/update', 'POST', {
    shop,
    customerId,
    newsletterSubscribed: subscribed
  });
  if (result.success) {
    if (customerData && customerData.profile) customerData.profile.newsletterSubscribed = subscribed;
    showToast(subscribed ? 'You’re subscribed to our newsletter.' : 'You’ve been unsubscribed from our newsletter.', 'success');
  } else {
    showToast(result.error || 'Could not update newsletter preference', 'error');
  }
}

async function saveOrderUpdatesPreference(enabled) {
  const shop = window.Shopify?.shop || window.location.hostname;
  const customerId = getCustomerId();
  if (!shop || !customerId) {
    showToast('Cannot update: please log in again.', 'error');
    return;
  }
  const result = await apiCall('/api/customers/update', 'POST', {
    shop,
    customerId,
    orderUpdates: enabled
  });
  if (result.success) {
    if (customerData && customerData.profile) customerData.profile.orderUpdates = enabled;
    showToast(enabled ? 'Order updates enabled.' : 'Order updates disabled.', 'success');
  } else {
    showToast(result.error || 'Could not update order updates preference', 'error');
  }
}

/* --------------------------------------------------
   CUSTOMER: WISHLIST TAB
-------------------------------------------------- */

function populateWishlist() {
  const wishlistEl = document.getElementById('wishlist-grid');
  if (!wishlistEl || !customerData) return;

  const wishlist = customerData.wishlist;

  if (!wishlist || wishlist.length === 0) {
    wishlistEl.innerHTML = '<p class="empty-state">Your wishlist is empty. Add products from the shop to see them here.</p>';
    return;
  }

  wishlistEl.innerHTML = `
    <div class="wishlist-grid">
      ${wishlist.map((item) => {
        const id = item.id != null ? item.id : item.handle || '';
        const idAttr = escapeAttr(String(id));
        const imgSrc = item.image ? escapeAttr(item.image) : '';
        const name = escapeHtml(item.name || item.title || 'Product');
        const price = escapeHtml(item.price != null ? String(item.price) : '');
        const url = item.url ? escapeAttr(item.url) : '#';
        const imgHtml = imgSrc
          ? `<img src="${imgSrc}" alt="${name}" class="wishlist-item__img" loading="lazy">`
          : '<div class="wishlist-item__img wishlist-item__img--placeholder">No image</div>';
        const variantIdAttr = (item.variant_id != null && item.variant_id !== '') ? escapeAttr(String(item.variant_id)) : '';
        return `
        <div class="wishlist-item" data-wishlist-id="${idAttr}">
          <a href="${url}" class="wishlist-item__link">${imgHtml}</a>
          <h5 class="wishlist-item__title">${name}</h5>
          <p class="price">${price}</p>
          <div class="product-actions">
            <button type="button" class="ks-btn ks-btn--add-cart" data-variant-id="${variantIdAttr}" data-product-url="${url}" data-product-name="${escapeAttr(item.name || item.title || 'Product')}">Add to Cart</button>
            <button type="button" onclick="removeFromWishlist('${idAttr}')" class="ks-btn-small">Remove</button>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;

  wishlistEl.querySelectorAll('.ks-btn--add-cart').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const variantId = this.getAttribute('data-variant-id');
      const productUrl = this.getAttribute('data-product-url') || '';
      const productName = this.getAttribute('data-product-name') || 'Product';
      addToCart({ variantId: variantId, productUrl: productUrl, productName: productName });
    });
  });
}

/* --------------------------------------------------
   AFFILIATE: PROFILE
-------------------------------------------------- */

function populateAffiliateProfile() {
  const profileEl = document.getElementById('affiliate-profile');
  if (!profileEl || !affiliateData) {
    console.warn('⚠️ Cannot populate affiliate profile - missing element or data');
    return;
  }

  const profile = affiliateData.dashboard?.profile || affiliateData.profile;
  if (!profile) {
    console.error('❌ Profile data not found in affiliateData');
    profileEl.innerHTML = '<p>Unable to load profile data</p>';
    return;
  }

  profileEl.innerHTML = `
    <div class="ks-affiliate-profile-card">
      <div class="ks-affiliate-profile-card__main">
        <div class="ks-affiliate-profile-card__name">${profile.name || 'N/A'}</div>
        <div class="ks-affiliate-profile-card__row">
          <span class="ks-affiliate-profile-card__label">Email</span>
          <span class="ks-affiliate-profile-card__value">${profile.email || 'N/A'}</span>
        </div>
        <div class="ks-affiliate-profile-card__row">
          <span class="ks-affiliate-profile-card__label">Status</span>
          <span class="ks-affiliate-profile-card__value">${getStatusBadge(profile.status || 'inactive')}</span>
        </div>
        <div class="ks-affiliate-profile-card__row">
          <span class="ks-affiliate-profile-card__label">Member Since</span>
          <span class="ks-affiliate-profile-card__value">${profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'N/A'}</span>
        </div>
      </div>
    </div>
  `;

  console.log('✅ Affiliate profile populated:', profile);
}

/* --------------------------------------------------
   AFFILIATE: PRIMARY REFERRAL LINK
-------------------------------------------------- */

function populatePrimaryReferralLink() {
  const el = document.getElementById('primary-referral-link');
  if (!el || !affiliateData) return;

  const links = affiliateData.dashboard?.referralLinks || affiliateData.referralLinks;
  if (!links || links.length === 0) {
    el.style.display = 'none';
    return;
  }

  // Use the first link as primary
  const primaryLink = links[0];
  const shop = window.Shopify?.shop || window.location.hostname;
  // Use backend URL format: backend_url/ref=SHORTCODE
  const linkUrl = primaryLink.url || `${API_BASE_URL}/ref=${primaryLink.shortCode}`;

  el.innerHTML = `
    <div class="referral-url-card">
      <h4>🔗 Your Primary Referral Link</h4>
      <p style="color: #666; margin: 10px 0; font-size: 14px;">Use this single link for everything: general sharing and Share Cart. Tracking works for both.</p>
      <div class="referral-url-display" id="primary-link-url">${linkUrl}</div>
      <div class="referral-url-actions">
        <button class="ks-btn" onclick="copyPrimaryReferralLink()">📋 Copy Link</button>
        <button class="ks-btn" onclick="shareReferralLink('${linkUrl}')">📤 Share</button>
      </div>

      <div class="fast-share" aria-hidden="false">
        <span class="fast-share-label">Fast share:</span>
        <div class="fast-share-icons">
          <a href="#" class="facebook" onclick="shareToFacebook('${linkUrl}');return false;" title="Share on Facebook">
            <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.99 3.66 9.12 8.44 9.88V14.89h-2.54v-2.9h2.54V9.97c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.23.2 2.23.2v2.45h-1.25c-1.23 0-1.61.77-1.61 1.56v1.87h2.74l-.44 2.9h-2.3v6.99C18.34 21.12 22 16.99 22 12z"/></svg>
          </a>
          <a href="#" class="linkedin" onclick="shareToLinkedIn('${linkUrl}');return false;" title="Share on LinkedIn">
            <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M19 0h-14C2.9 0 2 0.9 2 2v20c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V2c0-1.1-.9-2-2-2zM8 18H5V9h3v9zM6.5 7.5C5.67 7.5 5 6.83 5 6s.67-1.5 1.5-1.5S8 5.17 8 6s-.33 1.5-1.5 1.5zM19 18h-3v-4.5c0-1.07-.93-1.5-1.5-1.5S13 12.43 13 13.5V18h-3V9h3v1.25c.78-1.2 2.22-1.25 3.03-.3.98 1.12.97 3.05.97 4.05V18z"/></svg>
          </a>
          <a href="#" class="whatsapp" onclick="shareToWhatsApp('${linkUrl}');return false;" title="Share on WhatsApp">
            <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M20.52 3.48A11.93 11.93 0 0012 0C5.373 0 .05 5.324.05 11.95c0 2.108.55 4.178 1.6 6.02L0 24l6.23-1.63a11.93 11.93 0 005.77 1.48c6.628 0 11.95-5.324 11.95-11.95 0-3.19-1.24-6.19-3.43-8.37zM12 21.7c-1.78 0-3.5-.47-4.99-1.36l-.36-.22L4 20l1.2-2.43-.24-.38A8.7 8.7 0 013.1 12c0-4.92 4.01-8.93 8.9-8.93 2.38 0 4.62.93 6.3 2.61A8.85 8.85 0 0120.9 12c0 4.9-4 8.9-8.9 8.9z"/></svg>
          </a>
          <a href="#" class="mail" onclick="shareByMail('${linkUrl}');return false;" title="Share via Email">
            <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/></svg>
          </a>
        </div>
      </div>
    </div>
  `;
  el.style.display = 'block';
  console.log('✅ Primary referral link populated');
}

/* --------------------------------------------------
   AFFILIATE: REFERRAL LINKS
-------------------------------------------------- */

function populateReferralLinks() {
  const el = document.getElementById('referral-links');
  if (!el || !affiliateData) {
    console.warn('⚠️ Cannot populate referral links - missing element or data');
    return;
  }

  const links = affiliateData.dashboard?.referralLinks || affiliateData.referralLinks;
  console.log('📊 Referral links data:', links);

  if (!links || links.length === 0) {
    el.innerHTML = '<p class="ks-affiliate-links-empty">No referral links created yet. <button onclick="createNewReferralLink()" class="ks-btn">Create Link</button></p>';
    console.log('ℹ️ No referral links found');
    return;
  }

  const linkUrl = (link) => link.url || `${API_BASE_URL}/ref=${link.shortCode}`;

  el.innerHTML = `
    <div class="ks-affiliate-links-list">
      ${links.map(link => `
        <div class="ks-affiliate-link-card">
          <div class="ks-affiliate-link-card__top">
            <span class="ks-affiliate-link-card__code">${link.shortCode}</span>
            ${getStatusBadge(link.status)}
          </div>
          ${link.description ? `<p class="ks-affiliate-link-card__desc">${link.description}</p>` : ''}
          <div class="ks-affiliate-link-card__stats">
            <span class="ks-affiliate-link-card__stat"><span class="ks-affiliate-link-card__stat-label">Clicks</span> ${link.stats?.clicks || 0}</span>
            <span class="ks-affiliate-link-card__stat"><span class="ks-affiliate-link-card__stat-label">Conversions</span> ${link.stats?.conversions || 0}</span>
            <span class="ks-affiliate-link-card__stat"><span class="ks-affiliate-link-card__stat-label">Revenue</span> ${formatCurrency(link.stats?.revenue || 0, affiliateData?.earnings?.currency || 'USD')}</span>
          </div>
          <div class="ks-affiliate-link-card__actions">
            <button type="button" class="ks-btn ks-btn-small js-copy-link-btn" data-copy-url="${(linkUrl(link)).replace(/"/g, '&quot;')}">Copy link</button>
          </div>
        </div>
      `).join('')}
    </div>
    <button type="button" onclick="createNewReferralLink()" class="ks-btn ks-affiliate-links-create">Create New Link</button>
  `;
  console.log('✅ Referral links populated with', links.length, 'link(s)');
}

/* --------------------------------------------------
   AFFILIATE: EARNINGS & METRICS
-------------------------------------------------- */

function populateEarningsMetrics() {
  const el = document.getElementById('earnings-metrics');
  if (!el || !affiliateData) return;

  const earnings = affiliateData.earnings || { total: 0, pending: 0, paid: 0, currency: 'USD' };
  const stats = affiliateData.stats || { totalClicks: 0, totalConversions: 0, conversionRate: '0' };

  el.innerHTML = `
    <div class="ks-affiliate-metrics-grid">
      <div class="ks-affiliate-metric-card">
        <span class="ks-affiliate-metric-card__label">Total Earnings</span>
        <span class="ks-affiliate-metric-card__value">${formatCurrency(earnings.total, earnings.currency)}</span>
      </div>
      <div class="ks-affiliate-metric-card">
        <span class="ks-affiliate-metric-card__label">Pending</span>
        <span class="ks-affiliate-metric-card__value">${formatCurrency(earnings.pending, earnings.currency)}</span>
      </div>
      <div class="ks-affiliate-metric-card">
        <span class="ks-affiliate-metric-card__label">Paid</span>
        <span class="ks-affiliate-metric-card__value">${formatCurrency(earnings.paid, earnings.currency)}</span>
      </div>
      <div class="ks-affiliate-metric-card">
        <span class="ks-affiliate-metric-card__label">Total Clicks</span>
        <span class="ks-affiliate-metric-card__value">${stats.totalClicks}</span>
      </div>
      <div class="ks-affiliate-metric-card">
        <span class="ks-affiliate-metric-card__label">Total Conversions</span>
        <span class="ks-affiliate-metric-card__value">${stats.totalConversions}</span>
      </div>
      <div class="ks-affiliate-metric-card">
        <span class="ks-affiliate-metric-card__label">Conversion Rate</span>
        <span class="ks-affiliate-metric-card__value">${stats.conversionRate}</span>
      </div>
    </div>
  `;
}

/* --------------------------------------------------
   AFFILIATE: ANALYTICS
-------------------------------------------------- */

async function populateAnalytics() {
  const el = document.getElementById('analytics');
  if (!el || !currentAffiliateId) return;

  const result = await apiCall(`/api/affiliates/${currentAffiliateId}/analytics`);
  
  if (!result.success) {
    el.innerHTML = '<p>Unable to load analytics data.</p>';
    return;
  }

  const analytics = result.analytics;

  el.innerHTML = `
    <div class="ks-affiliate-analytics-card">
      <h4 class="ks-affiliate-analytics-card__title">Performance Summary</h4>
      <ul class="ks-affiliate-analytics-card__list">
        <li class="ks-affiliate-analytics-card__row">
          <span class="ks-affiliate-analytics-card__label">Total Referral Links</span>
          <span class="ks-affiliate-analytics-card__value">${analytics.referralLinks?.length || 0}</span>
        </li>
        <li class="ks-affiliate-analytics-card__row">
          <span class="ks-affiliate-analytics-card__label">Total Clicks</span>
          <span class="ks-affiliate-analytics-card__value">${analytics.totalClicks || 0}</span>
        </li>
        <li class="ks-affiliate-analytics-card__row">
          <span class="ks-affiliate-analytics-card__label">Total Conversions</span>
          <span class="ks-affiliate-analytics-card__value">${analytics.totalConversions || 0}</span>
        </li>
        <li class="ks-affiliate-analytics-card__row">
          <span class="ks-affiliate-analytics-card__label">Conversion Rate</span>
          <span class="ks-affiliate-analytics-card__value">${analytics.conversionRate || '0'}%</span>
        </li>
        <li class="ks-affiliate-analytics-card__row">
          <span class="ks-affiliate-analytics-card__label">Total Revenue Generated</span>
          <span class="ks-affiliate-analytics-card__value">${formatCurrency(analytics.totalRevenue || 0, analytics.currency || 'USD')}</span>
        </li>
        <li class="ks-affiliate-analytics-card__row" style="margin-top:4px">
          <span class="ks-affiliate-analytics-card__label" style="font-size:12px;opacity:0.85">(Total value of orders from your links; commission is a % of this)</span>
        </li>
      </ul>
    </div>
  `;
}

/* --------------------------------------------------
   ACTION HANDLERS
-------------------------------------------------- */

// Affiliate actions
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Referral link copied to clipboard!', 'success');
  }).catch(err => {
    console.error('Failed to copy:', err);
    showToast('Failed to copy link. Please try again.', 'error');
  });
}

function copyPrimaryReferralLink() {
  const urlEl = document.getElementById('primary-link-url');
  if (urlEl) {
    const text = urlEl.textContent || urlEl.innerText;
    navigator.clipboard.writeText(text).then(() => {
      showToast('Referral link copied to clipboard!', 'success');
    }).catch(err => {
      console.error('Failed to copy:', err);
      showToast('Failed to copy link. Please try again.', 'error');
    });
  }
}

function shareReferralLink(url) {
  if (navigator.share) {
    navigator.share({
      title: 'Join our Affiliate Program',
      text: 'Earn commissions by sharing this link',
      url: url
    }).catch(err => console.error('Share failed:', err));
  } else {
    // Fallback: just copy to clipboard
    copyPrimaryReferralLink();
  }
}

// Fast-share helpers for specific platforms
function shareToFacebook(url) {
  const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  window.open(shareUrl, '_blank', 'noopener,noreferrer,width=800,height=600');
}

function shareToLinkedIn(url) {
  const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
  window.open(shareUrl, '_blank', 'noopener,noreferrer,width=900,height=600');
}

function shareToWhatsApp(url) {
  const text = encodeURIComponent(`Check this out: ${url}`);
  const shareUrl = `https://api.whatsapp.com/send?text=${text}`;
  window.open(shareUrl, '_blank', 'noopener,noreferrer');
}

function shareByMail(url) {
  const subject = encodeURIComponent('Join our Affiliate Program');
  const body = encodeURIComponent(`Hi,%0A%0ACheck out this referral link:%0A${url}%0A%0ABest regards`);
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

// expose for inline handlers (defensive)
window.shareToFacebook = shareToFacebook;
window.shareToLinkedIn = shareToLinkedIn;
window.shareToWhatsApp = shareToWhatsApp;
window.shareByMail = shareByMail;

async function createNewReferralLink() {
  if (!currentAffiliateId) {
    showToast('Please load affiliate profile first', 'error');
    return;
  }

  showConfirmModal({
    title: 'Create new referral link?',
    message: 'You will be asked to enter a description for the new link.',
    confirmText: 'Create link',
    cancelText: 'Cancel',
    onConfirm: async function () {
      const description = prompt('Enter description for this referral link:');
      if (!description) return;

      const result = await apiCall(`/api/affiliates/${currentAffiliateId}/referral-links`, 'POST', {
        description,
        productIds: [],
        productVariantIds: []
      });

      if (result.success) {
        showToast('Referral link created successfully!', 'success');
        await loadAffiliateDashboard();
        populateReferralLinks();
      } else {
        showToast('Error: ' + result.error, 'error');
      }
    }
  });
}

// Customer: Orders – View shows in-page order detail; Invoice opens modal/PDF
function viewOrder(orderId) {
  var ordersSection = document.getElementById('orders');
  var ordersTab = document.querySelector('.ks-tab[data-tab="orders"]');
  var isOrdersTabActive = ordersSection && ordersSection.classList.contains('active');
  if (!isOrdersTabActive && ordersTab) {
    ordersTab.click();
    setTimeout(function () {
      showOrderDetailView(orderId);
    }, 80);
  } else {
    showOrderDetailView(orderId);
  }
}

function downloadInvoice(orderId) {
  openInvoiceModal(orderId);
}

/**
 * Reorder: fetch order line items, add all to cart via /cart/add.js, then go to cart.
 */
async function reorderOrder(orderId, buttonEl) {
  const shop = window.Shopify?.shop || window.location.hostname;
  const customerId = getCustomerId();
  if (!shop || !customerId) {
    showToast('Please log in to reorder.', 'error');
    return;
  }
  if (buttonEl) {
    buttonEl.disabled = true;
    buttonEl.textContent = 'Adding…';
  }
  try {
    const result = await apiCall(
      '/api/customers/orders/' + encodeURIComponent(orderId) + '?shop=' + encodeURIComponent(shop) + '&customerId=' + encodeURIComponent(customerId)
    );
    if (!result.success || !result.order || !result.order.line_items) {
      showToast(result.error || 'Could not load order.', 'error');
      if (buttonEl) { buttonEl.disabled = false; buttonEl.textContent = 'Reorder'; }
      return;
    }
    const items = (result.order.line_items || [])
      .filter(function (item) { return item.variant_id && String(item.variant_id).trim(); })
      .map(function (item) { return { id: String(item.variant_id).trim(), quantity: parseInt(item.quantity, 10) || 1 }; });
    if (items.length === 0) {
      showToast('No products in this order can be added to cart.', 'error');
      if (buttonEl) { buttonEl.disabled = false; buttonEl.textContent = 'Reorder'; }
      return;
    }
    const cartRoot = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) ? window.Shopify.routes.root : '/';
    const addUrl = (cartRoot === '/' ? '' : cartRoot) + 'cart/add.js';
    const res = await fetch(addUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ items: items })
    });
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok && data && data.description) {
      showToast(data.description, 'error');
      if (buttonEl) { buttonEl.disabled = false; buttonEl.textContent = 'Reorder'; }
      return;
    }
    if (!res.ok) {
      showToast('Could not add some items to cart.', 'error');
      if (buttonEl) { buttonEl.disabled = false; buttonEl.textContent = 'Reorder'; }
      return;
    }
    showToast('Order added to cart.', 'success');
    window.location.href = (cartRoot === '/' ? '' : cartRoot) + 'cart';
  } catch (err) {
    showToast(err.message || 'Could not reorder.', 'error');
    if (buttonEl) { buttonEl.disabled = false; buttonEl.textContent = 'Reorder'; }
  }
}

/**
 * Show order detail in the right-hand content area (same place as orders list), with Back to list button.
 */
async function showOrderDetailView(orderId) {
  const listContainer = document.getElementById('all-orders');
  const paginationEl = document.getElementById('orders-pagination');
  if (!listContainer) return;

  const shop = window.Shopify?.shop || window.location.hostname;
  const customerId = getCustomerId();
  if (!shop || !customerId) {
    showToast('Cannot load order: missing shop or customer.', 'error');
    return;
  }

  paginationEl.style.display = 'none';
  listContainer.innerHTML = '<div class="ks-order-detail-loading"><div class="ks-loader" aria-hidden="true"></div><p>Loading order…</p></div>';

  let result;
  try {
    result = await apiCall(
      `/api/customers/orders/${encodeURIComponent(orderId)}?shop=${encodeURIComponent(shop)}&customerId=${encodeURIComponent(customerId)}`
    );
  } catch (err) {
    listContainer.innerHTML = '<div class="ks-order-detail-error"><p>Could not load order. <button type="button" class="ks-btn" onclick="showOrdersList()">← Back to list</button></p></div>';
    paginationEl.style.display = '';
    return;
  }

  if (!result.success || !result.order) {
    listContainer.innerHTML = '<div class="ks-order-detail-error"><p>' + escapeHtml(result.error || 'Order not found') + '</p><button type="button" class="ks-btn" onclick="showOrdersList()">← Back to list</button></div>';
    paginationEl.style.display = '';
    return;
  }

  const o = result.order;
  const orderNum = o.order_number || o.id || orderId;
  const currency = o.currency || 'USD';
  const currPrefix = currency === 'GBP' ? '£' : currency + ' ';
  const fmt = (val) => (val != null ? currPrefix + parseFloat(val).toFixed(2) : currPrefix + '0.00');
  const status = (o.financial_status || o.fulfillment_status || 'Pending').toString().toUpperCase();
  const statusBadge = getStatusBadge(o.financial_status || o.fulfillment_status || 'Pending');
  const createdDate = o.created_at ? new Date(o.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const paymentMethod = (o.gateway || '').toString().trim() || '—';
  const subtotal = fmt(o.subtotal_price);
  const shippingAmount = fmt(o.total_shipping_price);
  const shippingLine = o.shipping_lines && o.shipping_lines[0];
  const shippingDisplay = shippingLine ? shippingAmount + ' via ' + escapeHtml(shippingLine.title || 'Shipping') : shippingAmount;
  const total = fmt(o.total_price);
  const tax = fmt(o.total_tax);
  const totalWithVat = tax !== (currPrefix + '0.00') ? total + ' (Includes ' + tax + ' VAT)' : total;
  const refundNum = (function () {
    const subN = parseFloat(o.subtotal_price) || 0;
    const shipN = parseFloat(o.total_shipping_price) || 0;
    const taxN = parseFloat(o.total_tax) || 0;
    const totalN = parseFloat(o.total_price) || 0;
    const diff = (subN + shipN + taxN) - totalN;
    return diff > 0.009 ? diff : 0;
  })();
  const isRefunded = (o.financial_status || '').toString().toLowerCase().indexOf('refund') !== -1;
  const refundRowHtml = (isRefunded && refundNum > 0)
    ? '<tr class="ks-order-detail-row ks-order-detail-row--refund">' +
        '<td class="ks-order-detail-row__label">Refund:</td>' +
        '<td class="ks-order-detail-row__value">-' + escapeHtml(fmt(refundNum)) + '</td>' +
      '</tr>'
    : '';

  var orderDetailBaseUrl = (typeof window !== 'undefined' && window.Shopify && window.Shopify.shop)
    ? 'https://' + String(window.Shopify.shop).replace(/^https?:\/\//, '')
    : (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
  const lineItemsHtml = (o.line_items || []).map(function (item) {
    const title = escapeHtml(item.title || 'Product');
    const qty = item.quantity || 1;
    const price = fmt(item.price);
    const lineTotal = item.price != null && item.quantity != null ? fmt(parseFloat(item.price) * parseInt(item.quantity, 10)) : price;
    var productUrl = (item.product_url || '').toString().trim();
    if (productUrl && orderDetailBaseUrl && productUrl.indexOf('/') === 0) {
      productUrl = orderDetailBaseUrl + productUrl;
    }
    const productCell = productUrl
      ? '<a href="' + escapeAttr(productUrl) + '" class="ks-order-detail-item__link" target="_blank" rel="noopener noreferrer">' + title + '</a> <span class="ks-order-detail-item__qty">× ' + qty + '</span>'
      : title + ' <span class="ks-order-detail-item__qty">× ' + qty + '</span>';
    return '<tr><td class="ks-order-detail-item__product">' + productCell + '</td><td class="ks-order-detail-item__price">' + escapeHtml(lineTotal) + '</td></tr>';
  }).join('');

  const formatAddressBlock = (raw) => {
    if (!raw || (!raw.first_name && !raw.last_name && !raw.address1)) return '—';
    const name = [raw.first_name, raw.last_name].filter(Boolean).join(' ').trim();
    const lines = [name, raw.address1, raw.address2, [raw.city, raw.province_code || raw.province].filter(Boolean).join(', '), raw.zip, raw.country].filter(Boolean);
    return lines.map(function (line) { return escapeHtml(line); }).join('<br>');
  };

  const shippingRaw = o.shipping_address_raw || {};
  const billingRaw = o.billing_address_raw || {};
  const billingHtml = formatAddressBlock(billingRaw);
  const shippingHtml = formatAddressBlock(shippingRaw);
  const billingPhone = (billingRaw.phone || '').toString().trim();
  const billingEmail = (o.email || '').toString().trim();
  if (billingPhone || billingEmail) {
    const extra = [billingPhone ? 'Phone: ' + escapeHtml(billingPhone) : '', billingEmail ? 'Email: ' + escapeHtml(billingEmail) : ''].filter(Boolean).join('<br>');
    // billingHtml already used; we could append – for simplicity show in billing block as separate line
  }

  const apiOrderIdAttr = escapeAttr(String(orderId));

  listContainer.innerHTML =
    '<div class="ks-order-detail">' +
      '<div class="ks-order-detail__header">' +
        '<h2 class="ks-order-detail__title">Order #' + escapeHtml(String(orderNum)) + '</h2>' +
        '<button type="button" class="ks-btn ks-order-detail__back" onclick="showOrdersList()">← Back to list</button>' +
      '</div>' +
      '<div class="ks-order-detail__summary">' +
        '<span class="ks-order-detail__meta"><strong>Order Number</strong> ' + escapeHtml(String(orderNum)) + '</span>' +
        '<span class="ks-order-detail__meta ks-order-detail__meta--status">' + statusBadge + '</span>' +
        '<span class="ks-order-detail__meta"><strong>Date</strong> ' + escapeHtml(createdDate) + '</span>' +
        '<span class="ks-order-detail__meta"><strong>Total</strong> ' + escapeHtml(totalWithVat) + '</span>' +
        '<span class="ks-order-detail__meta"><strong>Payment method</strong> ' + escapeHtml(paymentMethod) + '</span>' +
      '</div>' +
      '<div class="ks-order-detail__section">' +
        '<h4 class="ks-order-detail__section-title">Your order</h4>' +
        '<table class="ks-order-detail-table ks-order-detail-table--order">' +
          '<thead>' +
            '<tr>' +
              '<th class="ks-order-detail-th">Product</th>' +
              '<th class="ks-order-detail-th ks-order-detail-th--right">Price</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' +
            (lineItemsHtml || '<tr><td colspan="2" class="ks-order-detail-empty">No items</td></tr>') +
            '<tr class="ks-order-detail-row ks-order-detail-row--subtotal"><td class="ks-order-detail-row__label">Subtotal:</td><td class="ks-order-detail-row__value">' + escapeHtml(subtotal) + '</td></tr>' +
            '<tr class="ks-order-detail-row ks-order-detail-row--shipping"><td class="ks-order-detail-row__label">Shipping:</td><td class="ks-order-detail-row__value">' + shippingDisplay + '</td></tr>' +
            '<tr class="ks-order-detail-row ks-order-detail-row--payment"><td class="ks-order-detail-row__label">Payment method:</td><td class="ks-order-detail-row__value">' + escapeHtml(paymentMethod) + '</td></tr>' +
            refundRowHtml +
            '<tr class="ks-order-detail-row ks-order-detail-row--total"><td class="ks-order-detail-row__label">Total:</td><td class="ks-order-detail-row__value">' + escapeHtml(totalWithVat) + '</td></tr>' +
            '<tr class="ks-order-detail-row ks-order-detail-row--action"><td class="ks-order-detail-row__label">Action:</td><td class="ks-order-detail-row__value"><button type="button" class="ks-btn ks-btn-primary" onclick="reorderOrder(\'' + apiOrderIdAttr + '\', this)">Reorder</button> <button type="button" class="ks-btn" onclick="downloadInvoice(\'' + apiOrderIdAttr + '\')">Invoice</button></td></tr>' +
          '</tbody>' +
        '</table>' +
      '</div>' +
      '<div class="ks-order-detail__addresses">' +
        '<div class="ks-order-detail-address">' +
          '<h4 class="ks-order-detail-address__title">Billing Address</h4>' +
          '<div class="ks-order-detail-address__body">' + (billingHtml || '—') + '</div>' +
          (billingEmail ? '<p class="ks-order-detail-address__line">Email: ' + escapeHtml(billingEmail) + '</p>' : '') +
          (billingPhone ? '<p class="ks-order-detail-address__line">Phone: ' + escapeHtml(billingPhone) + '</p>' : '') +
        '</div>' +
        '<div class="ks-order-detail-address">' +
          '<h4 class="ks-order-detail-address__title">Shipping Address</h4>' +
          '<div class="ks-order-detail-address__body">' + (shippingHtml || '—') + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  paginationEl.style.display = 'none';
}

/**
 * Restore the orders list view (table + pagination) in the Orders tab.
 */
function showOrdersList() {
  const paginationEl = document.getElementById('orders-pagination');
  if (paginationEl) paginationEl.style.display = '';
  populateAllOrders();
}

const INVOICE_LOADER_ID = 'ks-invoice-loader';

function getInvoiceConfig() {
  const el = document.getElementById('dashboard-container');
  if (!el) return {};
  return {
    logoUrl: el.getAttribute('data-invoice-logo-url') || '',
    companyName: el.getAttribute('data-invoice-company-name') || 'Ki Science Limited',
    companyAddress: el.getAttribute('data-invoice-company-address') || '14 Hunns Mere Way, Brighton, BN2 6AH. UK.',
    vatNumber: el.getAttribute('data-invoice-vat') || 'GB 273 0155 27',
    termsUrl: el.getAttribute('data-invoice-terms-url') || 'https://www.kiscience.com/website-terms-conditions/'
  };
}

function showInvoiceLoader() {
  if (document.getElementById(INVOICE_LOADER_ID)) return;
  const overlay = document.createElement('div');
  overlay.id = INVOICE_LOADER_ID;
  overlay.setAttribute('aria-live', 'polite');
  overlay.setAttribute('aria-busy', 'true');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:99999;';
  overlay.innerHTML = '<div class="ks-loader" aria-hidden="true"></div>';
  document.body.appendChild(overlay);
}

function hideInvoiceLoader() {
  const el = document.getElementById(INVOICE_LOADER_ID);
  if (el) el.remove();
}

async function openInvoiceModal(orderId) {
  if (!orderId) return;
  const shop = window.Shopify?.shop || window.location.hostname;
  const customerId = getCustomerId();
  if (!shop || !customerId) {
    showToast('Cannot load order: missing shop or customer.', 'error');
    return;
  }
  showInvoiceLoader();
  let result;
  try {
    result = await apiCall(
      `/api/customers/orders/${encodeURIComponent(orderId)}?shop=${encodeURIComponent(shop)}&customerId=${encodeURIComponent(customerId)}`
    );
  } catch (err) {
    hideInvoiceLoader();
    showToast(err && err.message ? err.message : 'Failed to load order', 'error');
    return;
  }
  if (!result.success || !result.order) {
    hideInvoiceLoader();
    showToast(result.error || 'Order not found', 'error');
    return;
  }
  const o = result.order;
  const cfg = getInvoiceConfig();
  const orderNum = o.order_number || o.id || orderId;
  const currency = o.currency || 'USD';
  const currPrefix = currency === 'GBP' ? '£' : currency + ' ';
  const fmt = (val) => (val != null ? currPrefix + parseFloat(val).toFixed(2) : currPrefix + '0.00');
  const subtotal = fmt(o.subtotal_price);
  const shippingAmount = fmt(o.total_shipping_price);
  const tax = fmt(o.total_tax);
  const total = fmt(o.total_price);
  const shippingLine = o.shipping_lines && o.shipping_lines[0];
  const shippingDisplay = shippingLine ? shippingAmount + ' via ' + escapeHtml(shippingLine.title || 'Shipping') : shippingAmount;
  const totalWithVat = tax !== (currPrefix + '0.00') ? total + ' (includes ' + tax + ' VAT)' : total;

  const lineItemsHtml = (o.line_items || []).map(function (item) {
    const title = escapeHtml(item.title || 'Product');
    const sku = item.sku ? '<div class="ks-invoice-item__sku">SKU: ' + escapeHtml(item.sku) + '</div>' : '';
    const weight = item.weight ? '<div class="ks-invoice-item__weight">Weight: ' + escapeHtml(item.weight) + '</div>' : '';
    const qty = item.quantity || 1;
    const price = fmt(item.price);
    return '<tr class="ks-invoice-row"><td class="ks-invoice-cell ks-invoice-cell--product"><div class="ks-invoice-item__name">' + title + '</div>' + sku + weight + '</td><td class="ks-invoice-cell ks-invoice-cell--qty">' + qty + '</td><td class="ks-invoice-cell ks-invoice-cell--price">' + escapeHtml(price) + '</td></tr>';
  }).join('');

  const raw = o.shipping_address_raw || {};
  const recipientName = [raw.first_name, raw.last_name].filter(Boolean).join(' ').trim() || '—';
  const recipientAddr = [raw.address1, raw.address2].filter(Boolean).join(', ');
  const recipientCity = raw.city || '';
  const recipientRegion = [raw.city, raw.province_code || raw.province].filter(Boolean).join(', ');
  const recipientPostcode = raw.zip || '';
  const recipientEmail = (o.email || '').toString().trim() || '—';
  const recipientPhone = (raw.phone || '').toString().trim() || '—';
  const recipientHtml = '<div class="ks-invoice-recipient">' +
    '<p class="ks-invoice-recipient__name">' + escapeHtml(recipientName) + '</p>' +
    (recipientAddr ? '<p class="ks-invoice-recipient__line">' + escapeHtml(recipientAddr) + '</p>' : '') +
    (recipientRegion ? '<p class="ks-invoice-recipient__line">' + escapeHtml(recipientRegion) + '</p>' : '') +
    (recipientPostcode ? '<p class="ks-invoice-recipient__line">' + escapeHtml(recipientPostcode) + '</p>' : '') +
    '<p class="ks-invoice-recipient__line">Email: ' + escapeHtml(recipientEmail) + '</p>' +
    '<p class="ks-invoice-recipient__line">Phone: ' + escapeHtml(recipientPhone) + '</p>' +
    '</div>';

  const paymentMethod = (o.gateway || '').toString().trim() || 'Link';
  const createdDate = o.created_at ? new Date(o.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const invoiceNumber = String(orderNum);

  const logoHtml = cfg.logoUrl ? '<img src="' + escapeAttr(cfg.logoUrl) + '" alt="Ki Science" class="ks-invoice-logo">' : '';

  const modalId = 'ks-invoice-modal';
  let modal = document.getElementById(modalId);
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = modalId;
  modal.className = 'ks-invoice-modal';
  modal.innerHTML =
    '<div class="ks-invoice-modal__backdrop" data-close></div>' +
    '<div class="ks-invoice-modal__box">' +
      '<div class="ks-invoice-modal__header">' +
        '<div class="ks-invoice-modal__header-left">' + logoHtml + '</div>' +
        '<div class="ks-invoice-modal__header-right">' +
          '<p class="ks-invoice-company-name">' + escapeHtml(cfg.companyName) + '</p>' +
          '<p class="ks-invoice-company-address">' + escapeHtml(cfg.companyAddress) + '</p>' +
        '</div>' +
        '<button type="button" class="ks-invoice-modal__close" data-close aria-label="Close">&times;</button>' +
      '</div>' +
      '<div class="ks-invoice-print" id="ks-invoice-print">' +
        '<div class="ks-invoice-print-body">' +
        '<div class="ks-invoice-print-header">' +
          '<div class="ks-invoice-print-header__left">' + logoHtml + '</div>' +
          '<div class="ks-invoice-print-header__right">' +
            '<p class="ks-invoice-company-name">' + escapeHtml(cfg.companyName) + '</p>' +
            '<p class="ks-invoice-company-address">' + escapeHtml(cfg.companyAddress) + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="ks-invoice-title-row">' +
          '<div class="ks-invoice-title-col">' +
            '<h1 class="ks-invoice-doc-title">INVOICE</h1>' +
            recipientHtml +
          '</div>' +
          '<div class="ks-invoice-meta-col">' +
            '<p class="ks-invoice-meta-row"><span class="ks-invoice-meta-label">Invoice Number:</span><span class="ks-invoice-meta-value">' + escapeHtml(invoiceNumber) + '</span></p>' +
            (createdDate ? '<p class="ks-invoice-meta-row"><span class="ks-invoice-meta-label">Invoice Date:</span><span class="ks-invoice-meta-value">' + escapeHtml(createdDate) + '</span></p>' : '') +
            '<p class="ks-invoice-meta-row"><span class="ks-invoice-meta-label">Order Number:</span><span class="ks-invoice-meta-value">' + escapeHtml(String(orderNum)) + '</span></p>' +
            (createdDate ? '<p class="ks-invoice-meta-row"><span class="ks-invoice-meta-label">Order Date:</span><span class="ks-invoice-meta-value">' + escapeHtml(createdDate) + '</span></p>' : '') +
            '<p class="ks-invoice-meta-row"><span class="ks-invoice-meta-label">Payment Method:</span><span class="ks-invoice-meta-value">' + escapeHtml(paymentMethod) + '</span></p>' +
          '</div>' +
        '</div>' +
        '<table class="ks-invoice-table">' +
          '<thead><tr class="ks-invoice-row ks-invoice-row--head">' +
            '<th class="ks-invoice-cell ks-invoice-cell--product">Product</th>' +
            '<th class="ks-invoice-cell ks-invoice-cell--qty">Quantity</th>' +
            '<th class="ks-invoice-cell ks-invoice-cell--price">Price</th>' +
          '</tr></thead>' +
          '<tbody>' + (lineItemsHtml || '<tr><td colspan="3" class="ks-invoice-cell ks-invoice-cell--empty">No items</td></tr>') + '</tbody>' +
        '</table>' +
        '<div class="ks-invoice-totals-box">' +
          '<div class="ks-invoice-totals__row"><span>Subtotal</span><span>' + escapeHtml(subtotal) + '</span></div>' +
          '<div class="ks-invoice-totals__row"><span>Shipping</span><span>' + shippingDisplay + '</span></div>' +
          '<div class="ks-invoice-totals__row ks-invoice-totals__row--total"><span>Total</span><span>' + escapeHtml(totalWithVat) + '</span></div>' +
        '</div>' +
        '</div>' +
        '<div class="ks-invoice-footer">' +
          '<p class="ks-invoice-thanks">Thank You for Your Order!</p>' +
          '<p class="ks-invoice-terms">For full terms and conditions, including our returns policy please visit: <a href="' + escapeAttr(cfg.termsUrl) + '" target="_blank" rel="noopener">' + escapeHtml(cfg.termsUrl) + '</a></p>' +
          '<p class="ks-invoice-copyright">Copyright © ' + escapeHtml(cfg.companyName) + '</p>' +
          '<p class="ks-invoice-vat">VAT Number: ' + escapeHtml(cfg.vatNumber) + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="ks-invoice-modal__actions">' +
        '<button type="button" class="ks-btn" data-close>Close</button>' +
        '<button type="button" class="ks-btn ks-btn-primary" id="ks-invoice-print-btn">Print / Save as PDF</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
  hideInvoiceLoader();

  function closeModal() {
    modal.remove();
  }

  modal.querySelectorAll('[data-close]').forEach(function (el) {
    el.addEventListener('click', closeModal);
  });

  const printBtn = modal.querySelector('#ks-invoice-print-btn');
  if (printBtn) {
    printBtn.addEventListener('click', function () {
      const printArea = modal.querySelector('#ks-invoice-print');
      if (!printArea) return;
      const printStyles = getInvoicePrintStyles();
      const filename = 'invoice-' + orderNum + '.pdf';
      // Single-page PDF: capture body with fixed A4 height so html2pdf outputs exactly 1 page; footer pinned to bottom via flex
      const pdfScript = '(function(){var filename=' + JSON.stringify(filename) + ';var s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";s.crossOrigin="anonymous";s.onload=function(){function doPdf(){var opt={margin:12,filename:filename,image:{type:"jpeg",quality:0.98},html2canvas:{scale:2,useCORS:true},jsPDF:{unit:"mm",format:"a4",orientation:"portrait"}};html2pdf().set(opt).from(document.body).save().then(function(){window.close();}).catch(function(){window.print();setTimeout(function(){window.close();},100);});}if(document.readyState==="complete")setTimeout(doPdf,200);else window.addEventListener("load",function(){setTimeout(doPdf,200);});};s.onerror=function(){window.print();setTimeout(function(){window.close();},100);};document.head.appendChild(s);})();';
      const win = window.open('', '_blank');
      win.document.write('<html><head><title>Invoice – Order #' + orderNum + '</title><style>' + printStyles + '</style></head><body class="ks-invoice-pdf-body">' + printArea.innerHTML + '<script>' + pdfScript + '<\/script></body></html>');
      win.document.close();
      win.focus();
    });
  }
}

function getInvoicePrintStyles() {
  // Single-page PDF: body height = A4 content height so html2pdf outputs 1 page; footer pinned to bottom via flex.
  var a4ContentHeight = '273mm';
  return `
    html, body {
      font-family: Arial, Helvetica, sans-serif;
      margin: 0;
      padding: 24px 28px;
      max-width: 700px;
      margin-left: auto;
      margin-right: auto;
      font-size: 14px;
      color: #000;
      background: #fff;
    }
    body.ks-invoice-pdf-body {
      display: flex;
      flex-direction: column;
      height: ` + a4ContentHeight + `;
      min-height: ` + a4ContentHeight + `;
      max-height: ` + a4ContentHeight + `;
      overflow: hidden;
      padding: 24px 28px;
    }
    body.ks-invoice-pdf-body > .ks-invoice-print-body {
      flex: 1 1 auto;
      min-height: 0;
      overflow: hidden;
    }
    body.ks-invoice-pdf-body > .ks-invoice-footer {
      flex-shrink: 0;
      margin-top: auto;
    }
    *, *::before, *::after { box-sizing: border-box; }

    .ks-invoice-print-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin-bottom: 20px; width: 100%; }
    .ks-invoice-print-header__left { flex-shrink: 0; }
    .ks-invoice-print-header__right { flex-shrink: 0; text-align: right; max-width: 50%; }
    .ks-invoice-logo { max-width: 120px; height: auto; display: block; }
    .ks-invoice-modal__header-right { margin-left: auto; text-align: right; }
    .ks-invoice-company-name { font-weight: 700; margin: 0 0 4px 0; font-size: 16px; text-align: right; }
    .ks-invoice-company-address { margin: 0; font-size: 14px; text-align: right; }

    .ks-invoice-title-row { display: flex; gap: 32px; margin: 16px 0; }
    .ks-invoice-title-col { flex: 1; }
    .ks-invoice-meta-col { width: 240px; flex-shrink: 0; }
    .ks-invoice-doc-title { font-size: 22px; font-weight: 700; letter-spacing: 0.05em; margin: 0 0 12px 0; }

    .ks-invoice-recipient { margin: 0; }
    .ks-invoice-recipient__name, .ks-invoice-recipient__line { margin: 4px 0; }

    .ks-invoice-meta-row { margin: 4px 0; display: flex; justify-content: space-between; gap: 12px; }
    .ks-invoice-meta-value { text-align: right; }

    .ks-invoice-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .ks-invoice-table thead tr { background: #000; color: #fff; }
    .ks-invoice-table th, .ks-invoice-table td { border: 1px solid #e5e7eb; padding: 10px 12px; text-align: left; }
    .ks-invoice-table th:nth-child(2), .ks-invoice-table th:nth-child(3),
    .ks-invoice-table td:nth-child(2), .ks-invoice-table td:nth-child(3) { text-align: right; }

    .ks-invoice-item__name { font-weight: 500; }
    .ks-invoice-item__sku, .ks-invoice-item__weight { font-size: 12px; color: #6b7280; margin-top: 2px; }

    .ks-invoice-totals-box { margin: 16px 0; text-align: right; max-width: 320px; margin-left: auto; }
    .ks-invoice-totals__row { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; margin: 6px 0; padding: 0 0 4px 0; }
    .ks-invoice-totals__row > span:first-child { font-weight: 700; }
    .ks-invoice-totals__row > span:last-child { font-weight: 400; }
    .ks-invoice-totals__row--total { font-weight: 700; font-size: 16px; margin-top: 10px; padding-top: 10px; border-top: 1px solid #000; }
    .ks-invoice-totals__row--total span { font-weight: 700; }

    .ks-invoice-footer { text-align: center !important; padding-top: 20px; border-top: 1px solid #000 !important; }
    .ks-invoice-footer .ks-invoice-thanks,
    .ks-invoice-footer .ks-invoice-terms,
    .ks-invoice-footer .ks-invoice-copyright,
    .ks-invoice-footer .ks-invoice-vat { text-align: center !important; }

    .ks-invoice-thanks { margin: 0 0 6px 0; }
    .ks-invoice-terms { margin: 6px 0; font-size: 13px; }
    .ks-invoice-terms a { color: #000; }
    .ks-invoice-copyright, .ks-invoice-vat { margin: 2px 0; }

    @media print {
      html, body { padding: 0; }
      .ks-invoice-print-header__right,
      .ks-invoice-company-name,
      .ks-invoice-company-address { text-align: right !important; }
      .ks-invoice-footer { text-align: center !important; border-top: 1px solid #000 !important; }
      .ks-invoice-footer * { text-align: center !important; }
    }
  `;
}

// Customer: Addresses (sync with Shopify via API)
/**
 * Show a confirmation modal (no browser alert). Options: title, message, confirmText, cancelText, onConfirm.
 * onConfirm is called when user clicks Confirm; modal closes on Confirm or Cancel/backdrop.
 */
function showConfirmModal(options) {
  const title = options.title || 'Confirm';
  const message = options.message || '';
  const confirmText = options.confirmText || 'Confirm';
  const cancelText = options.cancelText || 'Cancel';
  const onConfirm = options.onConfirm || function () {};

  const modalId = 'ks-confirm-modal';
  let modal = document.getElementById(modalId);
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = modalId;
  modal.className = 'ks-confirm-modal';
  modal.innerHTML = `
    <div class="ks-confirm-modal__backdrop" data-close></div>
    <div class="ks-confirm-modal__box">
      <h3 class="ks-confirm-modal__title">${escapeHtml(title)}</h3>
      <p class="ks-confirm-modal__message">${escapeHtml(message)}</p>
      <div class="ks-confirm-modal__actions">
        <button type="button" class="ks-btn" data-close>${escapeHtml(cancelText)}</button>
        <button type="button" class="ks-btn ks-btn-primary" data-confirm>${escapeHtml(confirmText)}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  function closeModal() {
    modal.remove();
  }

  modal.querySelectorAll('[data-close]').forEach(function (el) {
    el.addEventListener('click', closeModal);
  });

  modal.querySelector('[data-confirm]').addEventListener('click', function () {
    const result = onConfirm();
    if (result && typeof result.then === 'function') {
      result.then(closeModal).catch(function () {});
    } else {
      closeModal();
    }
  });
}

async function deleteAddress(addressId) {
  showConfirmModal({
    title: 'Delete address?',
    message: 'Are you sure you want to delete this address? This will remove it from your Shopify account.',
    confirmText: 'Delete',
    cancelText: 'Cancel',
    onConfirm: async function () {
      var shop = window.Shopify && window.Shopify.shop ? window.Shopify.shop : window.location.hostname;
      var customerId = getCustomerId();
      if (!shop || !customerId) {
        showToast('Cannot delete: missing shop or customer. Please log in again.', 'error');
        return;
      }
      var loadingEl = null;
      var modal = document.getElementById('ks-confirm-modal');
      var actions = modal && modal.querySelector('.ks-confirm-modal__actions');
      var confirmBtn = modal && modal.querySelector('[data-confirm]');
      var cancelBtn = actions && actions.querySelector('button[data-close]');
      if (actions) {
        loadingEl = document.createElement('div');
        loadingEl.className = 'ks-confirm-modal__loading';
        loadingEl.setAttribute('aria-hidden', 'true');
        loadingEl.innerHTML = '<div class="ks-loader" aria-hidden="true"></div><span>Deleting…</span>';
        actions.style.position = 'relative';
        actions.appendChild(loadingEl);
        if (confirmBtn) confirmBtn.disabled = true;
        if (cancelBtn) cancelBtn.disabled = true;
      }
      try {
        var result = await apiCall(
          '/api/customers/addresses/' + encodeURIComponent(addressId) + '?shop=' + encodeURIComponent(shop) + '&customerId=' + encodeURIComponent(customerId),
          'DELETE'
        );
        if (result.success) {
          showToast('Address deleted successfully.', 'success');
          await loadCustomerData();
          populateAddresses();
        } else {
          if (loadingEl && loadingEl.parentNode) loadingEl.remove();
          if (confirmBtn) confirmBtn.disabled = false;
          if (cancelBtn) cancelBtn.disabled = false;
          showToast(result.error || 'Failed to delete address', 'error');
          throw new Error(result.error || 'Failed to delete address');
        }
      } catch (err) {
        if (loadingEl && loadingEl.parentNode) loadingEl.remove();
        if (confirmBtn) confirmBtn.disabled = false;
        if (cancelBtn) cancelBtn.disabled = false;
        if (err && err.message && err.message !== 'Failed to delete address') {
          showToast(err.message || 'Failed to delete address', 'error');
        }
        throw err;
      }
    }
  });
}

async function setDefaultAddress(addressId) {
  const shop = window.Shopify?.shop || window.location.hostname;
  const customerId = getCustomerId();
  if (!shop || !customerId) {
    showToast('Cannot set default: missing shop or customer.', 'error');
    return;
  }
  const result = await apiCall(`/api/customers/addresses/${encodeURIComponent(addressId)}/default`, 'PUT', {
    shop,
    customerId
  });
  if (result.success) {
    showToast('Default address updated.', 'success');
    await loadCustomerData();
    populateAddresses();
  } else {
    showToast(result.error || 'Failed to set default address', 'error');
  }
}

function openAddressFormModal(editAddressData, addressType) {
  var isEdit = !!editAddressData;
  var addr = editAddressData || {};
  var type = addressType || 'shipping';
  var phoneParts = parsePhoneWithCode(addr.phone || '');
  var modalId = 'ks-address-form-modal';
  var modal = document.getElementById(modalId);
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = modalId;
  modal.className = 'ks-address-modal';
  var hintText = type === 'billing'
    ? 'Saved as billing address only. Shipping addresses are managed in the left column.'
    : 'Saved to your Shopify account. Used at checkout for shipping.';
  modal.innerHTML =
    '<div class="ks-address-modal__backdrop" data-close></div>' +
    '<div class="ks-address-modal__box">' +
    '<h3 class="ks-address-modal__title">' + (isEdit ? 'Edit address' : 'Add new address') + '</h3>' +
    '<p class="ks-address-modal__hint">' + escapeHtml(hintText) + '</p>' +
      '<form class="ks-address-form" data-address-form data-address-type="' + escapeAttr(type) + '">' +
    '<input type="hidden" name="addressId" value="' + escapeAttr(addr.id || '') + '">' +
    '<div class="ks-address-form__row"><label>First name *</label><input type="text" name="firstName" value="' + escapeAttr(addr.firstName || addr.first_name || '') + '" required></div>' +
    '<div class="ks-address-form__row"><label>Last name *</label><input type="text" name="lastName" value="' + escapeAttr(addr.lastName || addr.last_name || '') + '" required></div>' +
    '<div class="ks-address-form__row"><label>Address line 1 *</label><input type="text" name="address1" value="' + escapeAttr(addr.address1 || '') + '" required></div>' +
    '<div class="ks-address-form__row"><label>Address line 2</label><input type="text" name="address2" value="' + escapeAttr(addr.address2 || '') + '"></div>' +
    '<div class="ks-address-form__row"><label>City *</label><input type="text" name="city" value="' + escapeAttr(addr.city || '') + '" required></div>' +
    '<div class="ks-address-form__row"><label>Province / State</label><input type="text" name="province" value="' + escapeAttr(addr.province || addr.state || '') + '"></div>' +
    '<div class="ks-address-form__row"><label>Country *</label><input type="text" name="country" value="' + escapeAttr(addr.country || '') + '" required></div>' +
    '<div class="ks-address-form__row"><label>Postal / ZIP code *</label><input type="text" name="zip" value="' + escapeAttr(addr.zip || '') + '" required></div>' +
    '<div class="ks-address-form__row ks-address-form__row--phone">' +
    '<div class="ks-address-form__field ks-address-form__field--code"><label>Country code</label><input type="tel" name="phoneCode" value="' + escapeAttr(phoneParts.countryCode) + '" placeholder="+**" maxlength="5" inputmode="tel" title="Include + and digits, e.g. +91"></div>' +
    '<div class="ks-address-form__field ks-address-form__field--number"><label>Phone number</label><input type="tel" name="phone" value="' + escapeAttr(phoneParts.number) + '" placeholder="e.g. 8*******" inputmode="tel"></div></div>' +
    '<div class="ks-address-form__row"><label><input type="checkbox" name="default" ' + (addr.default ? 'checked' : '') + '> Set as default address</label></div>' +
    '<div class="ks-address-form__actions"><button type="button" class="ks-btn" data-close>Cancel</button><button type="submit" class="ks-btn ks-btn-primary">' + (isEdit ? 'Save changes' : 'Add address') + '</button></div>' +
    '</form></div>';
  document.body.appendChild(modal);

  function closeModal() {
    modal.remove();
  }

  modal.querySelectorAll('[data-close]').forEach(function (el) {
    el.addEventListener('click', closeModal);
  });

  modal.querySelector('[data-address-form]').addEventListener('submit', async function (e) {
    e.preventDefault();
    var form = e.target;
    var formType = (form.getAttribute('data-address-type') || 'shipping');
    var shop = window.Shopify && window.Shopify.shop ? window.Shopify.shop : window.location.hostname;
    var customerId = getCustomerId();
    if (!shop || !customerId) {
      showToast('Missing shop or customer. Please log in again.', 'error');
      return;
    }
    var addressId = (form.querySelector('input[name="addressId"]') || {}).value;
    var phoneCode = (form.querySelector('input[name="phoneCode"]') || {}).value.trim().replace(/\s/g, '');
    var phoneNumber = (form.querySelector('input[name="phone"]') || {}).value.trim().replace(/\s+/g, ' ');
    var phone = '';
    if (phoneNumber) {
      phone = (phoneCode ? (phoneCode.indexOf('+') === 0 ? phoneCode : '+' + phoneCode) + ' ' : '') + phoneNumber;
    }
    var address = {
      firstName: (form.querySelector('input[name="firstName"]') || {}).value.trim(),
      lastName: (form.querySelector('input[name="lastName"]') || {}).value.trim(),
      address1: (form.querySelector('input[name="address1"]') || {}).value.trim(),
      address2: (form.querySelector('input[name="address2"]') || {}).value.trim(),
      city: (form.querySelector('input[name="city"]') || {}).value.trim(),
      province: (form.querySelector('input[name="province"]') || {}).value.trim(),
      country: (form.querySelector('input[name="country"]') || {}).value.trim(),
      zip: (form.querySelector('input[name="zip"]') || {}).value.trim(),
      phone: phone,
      default: !!((form.querySelector('input[name="default"]') || {}).checked)
    };
    var baseUrl = formType === 'billing' ? '/api/customers/billing-addresses' : '/api/customers/addresses';
    var isEdit = !!addressId;
    if (isEdit) {
      var result = await apiCall(baseUrl + '/' + encodeURIComponent(addressId), 'PUT', { shop: shop, customerId: customerId, address: address });
      if (result.success) {
        showToast(formType === 'billing' ? 'Billing address updated.' : 'Address updated successfully.', 'success');
        closeModal();
        await loadCustomerData();
        populateAddresses();
      } else {
        showToast(result.error || 'Failed to update address', 'error');
      }
    } else {
      var postResult = await apiCall(baseUrl, 'POST', { shop: shop, customerId: customerId, address: address });
      if (postResult.success) {
        showToast(formType === 'billing' ? 'Billing address added.' : 'Address added successfully.', 'success');
        closeModal();
        await loadCustomerData();
        populateAddresses();
      } else {
        showToast(postResult.error || 'Failed to add address', 'error');
      }
    }
  });
}

function addAddress() {
  openAddressFormModal(null, 'shipping');
}

function addBillingAddress() {
  openAddressFormModal(null, 'billing');
}

function editAddress(addressId) {
  var addresses = (customerData && customerData.addresses) || [];
  var addr = addresses.find(function (a) { return String(a.id) === String(addressId); });
  if (!addr) {
    showToast('Address not found.', 'error');
    return;
  }
  openAddressFormModal(addr, 'shipping');
}

function editBillingAddress(addressId) {
  var addresses = (customerData && customerData.billingAddresses) || [];
  var addr = addresses.find(function (a) { return String(a.id) === String(addressId); });
  if (!addr) {
    showToast('Billing address not found.', 'error');
    return;
  }
  openAddressFormModal(addr, 'billing');
}

async function deleteBillingAddress(addressId) {
  showConfirmModal({
    title: 'Delete billing address?',
    message: 'This will remove the billing address. Shipping addresses are not affected.',
    confirmText: 'Delete',
    cancelText: 'Cancel',
    onConfirm: async function () {
      var shop = window.Shopify && window.Shopify.shop ? window.Shopify.shop : window.location.hostname;
      var customerId = getCustomerId();
      if (!shop || !customerId) {
        showToast('Cannot delete: missing shop or customer. Please log in again.', 'error');
        return;
      }
      var result = await apiCall(
        '/api/customers/billing-addresses/' + encodeURIComponent(addressId) + '?shop=' + encodeURIComponent(shop) + '&customerId=' + encodeURIComponent(customerId),
        'DELETE'
      );
      if (result.success) {
        showToast('Billing address deleted.', 'success');
        await loadCustomerData();
        populateAddresses();
      } else {
        showToast(result.error || 'Failed to delete billing address', 'error');
      }
    }
  });
}

async function setDefaultBillingAddress(addressId) {
  var shop = window.Shopify && window.Shopify.shop ? window.Shopify.shop : window.location.hostname;
  var customerId = getCustomerId();
  if (!shop || !customerId) {
    showToast('Cannot set default: missing shop or customer.', 'error');
    return;
  }
  var result = await apiCall('/api/customers/billing-addresses/' + encodeURIComponent(addressId) + '/default', 'PUT', { shop: shop, customerId: customerId });
  if (result.success) {
    showToast('Default billing address updated.', 'success');
    await loadCustomerData();
    populateAddresses();
  } else {
    showToast(result.error || 'Failed to set default billing address', 'error');
  }
}

// Customer: Payments (sync with Shopify via API – list + revoke; add is at checkout)
function addPaymentMethod() {
  showToast('New payment methods are added at checkout when you place an order. Complete a purchase to save a card here.', 'info');
}

function editPaymentMethod(paymentId) {
  showToast('To change card details, remove this payment method and add a new one at checkout.', 'info');
}

async function deletePaymentMethod(paymentId) {
  if (!paymentId) return;
  showConfirmModal({
    title: 'Remove payment method?',
    message: 'Are you sure you want to remove this payment method? This will remove it from your Shopify account.',
    confirmText: 'Remove',
    cancelText: 'Cancel',
    onConfirm: async function () {
      const shop = window.Shopify?.shop || window.location.hostname;
      const customerId = getCustomerId();
      if (!shop || !customerId) {
        showToast('Cannot remove: missing shop or customer. Please log in again.', 'error');
        return;
      }
      const result = await apiCall(
        `/api/customers/payment-methods/${encodeURIComponent(paymentId)}?shop=${encodeURIComponent(shop)}&customerId=${encodeURIComponent(customerId)}`,
        'DELETE'
      );
      if (result.success) {
        showToast('Payment method removed successfully.', 'success');
        await loadCustomerData();
        populatePayments();
      } else {
        showToast(result.error || 'Failed to remove payment method', 'error');
      }
    }
  });
}

// Customer: Account
async function saveAccountDetails(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const fullname = (formData.get('fullname') || '').trim();
  const email = (formData.get('email') || '').trim();
  const phoneCode = (formData.get('phoneCode') || '').trim().replace(/\s/g, '');
  const phoneNumber = (formData.get('phone') || '').trim().replace(/\s+/g, ' ');
  const password = (formData.get('password') || '').trim();
  const passwordConfirm = (formData.get('passwordConfirm') || '').trim();

  if (password) {
    if (!passwordConfirm) {
      showToast('Please confirm your new password.', 'error');
      return;
    }
    if (password !== passwordConfirm) {
      showToast('Passwords do not match. Please try again.', 'error');
      return;
    }
  }

  var phone = '';
  if (phoneNumber) {
    if (!phoneCode) {
      showToast('Please enter country code (e.g. +44) when entering a phone number.', 'error');
      return;
    }
    phone = (phoneCode.startsWith('+') ? phoneCode : '+' + phoneCode) + ' ' + phoneNumber;
  }

  const shop = window.Shopify?.shop || window.location.hostname;
  const customerId = getCustomerId();
  if (!shop || !customerId) {
    showToast('Cannot save: missing shop or customer. Please log in again.', 'error');
    return;
  }

  const parts = fullname.split(/\s+/).filter(Boolean);
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || '';

  const newsletterEl = document.getElementById('newsletter');
  const orderUpdatesEl = document.getElementById('orderUpdates');
  const newsletterSubscribed = newsletterEl ? newsletterEl.checked : undefined;
  const orderUpdates = orderUpdatesEl ? orderUpdatesEl.checked : undefined;

  const result = await apiCall('/api/customers/update', 'POST', {
    shop,
    customerId,
    firstName,
    lastName,
    email,
    phone,
    password: password || undefined,
    newsletterSubscribed: typeof newsletterSubscribed === 'boolean' ? newsletterSubscribed : undefined,
    orderUpdates: typeof orderUpdates === 'boolean' ? orderUpdates : undefined
  });

  if (result.success) {
    showToast('Account details saved successfully!', 'success');
    customerData.profile = {
      name: fullname,
      email,
      phone,
      newsletterSubscribed: typeof newsletterSubscribed === 'boolean' ? newsletterSubscribed : customerData.profile?.newsletterSubscribed,
      orderUpdates: typeof orderUpdates === 'boolean' ? orderUpdates : customerData.profile?.orderUpdates
    };
    populateAccountDetails();
  } else {
    showToast(result.error || 'Failed to save account details', 'error');
  }
}

function togglePasswordVisibility(fieldId) {
  const id = fieldId || 'password';
  const field = document.getElementById(id);
  if (!field) return;
  field.type = field.type === 'password' ? 'text' : 'password';
}

// Customer: Wishlist – add product to Shopify cart via /cart/add.js
function addToCart(opts) {
  const variantId = typeof opts === 'object' && opts && opts.variantId != null ? String(opts.variantId).trim() : (typeof opts === 'string' || typeof opts === 'number' ? String(opts).trim() : '');
  const productUrl = typeof opts === 'object' && opts && opts.productUrl ? opts.productUrl : '';
  const productName = (typeof opts === 'object' && opts && opts.productName) ? opts.productName : 'Product';

  if (variantId) {
    fetch((window.Shopify && window.Shopify.routes && window.Shopify.routes.root) ? window.Shopify.routes.root + 'cart/add.js' : '/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ items: [{ id: variantId, quantity: 1 }] })
    })
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (result) {
        if (!result.ok && result.data && result.data.message) {
          showToast(result.data.message, 'error');
        } else if (!result.ok) {
          showToast('Could not add to cart', 'error');
        } else {
          showToast(productName ? productName + ' added to cart' : 'Added to cart', 'success');
        }
      })
      .catch(function () {
        showToast('Could not add to cart', 'error');
      });
  } else if (productUrl) {
    window.location.href = productUrl;
  } else {
    showToast('Product unavailable', 'error');
  }
}

function removeFromWishlist(itemId) {
  const productId = String(itemId).replace(/^gid:\/\/shopify\/Product\/|\D/g, '') || String(itemId);
  const shop = window.Shopify?.shop || window.location.hostname;
  const customerId = getCustomerId();

  if (!customerId || !shop) {
    showToast('Please log in to manage your wishlist', 'error');
    return;
  }

  function doRemove() {
    const url = `/api/customers/wishlist?shop=${encodeURIComponent(shop)}&customerId=${encodeURIComponent(customerId)}&productId=${encodeURIComponent(productId)}`;
    apiCall(url, 'DELETE')
      .then(function (result) {
        if (result.success) {
          if (customerData && customerData.wishlist) {
            customerData.wishlist = customerData.wishlist.filter(
              (i) => String(i.id) !== productId && String(i.id) !== itemId && String(i.handle) !== productId && String(i.handle) !== itemId
            );
          }
          populateWishlist();
          showToast('Removed from wishlist', 'success');
        } else {
          showToast(result.error || 'Could not remove from wishlist', 'error');
        }
      })
      .catch(function () {
        showToast('Could not update wishlist', 'error');
      });
  }

  showConfirmModal({
    title: 'Remove from wishlist?',
    message: 'Are you sure you want to remove this item from your wishlist?',
    confirmText: 'Remove',
    cancelText: 'Cancel',
    onConfirm: doRemove
  });
}

/** Add product to server wishlist (syncs across devices). Call from theme or dashboard. */
function addToWishlist(productId) {
  const shop = window.Shopify?.shop || window.location.hostname;
  const customerId = getCustomerId();
  if (!customerId || !shop || productId == null || productId === '') {
    showToast('Please log in to add to wishlist', 'error');
    return Promise.resolve({ success: false });
  }
  const id = String(productId).replace(/^gid:\/\/shopify\/Product\/|\D/g, '') || String(productId);
  return apiCall('/api/customers/wishlist', 'POST', { shop, customerId, productId: id }).then(function (result) {
    if (result.success) showToast('Added to wishlist', 'success');
    else showToast(result.error || 'Could not add to wishlist', 'error');
    return result;
  });
}

/* --------------------------------------------------
   WINDOW GLOBALS
-------------------------------------------------- */

window.copyToClipboard = copyToClipboard;
window.copyPrimaryReferralLink = copyPrimaryReferralLink;
window.shareReferralLink = shareReferralLink;
window.createNewReferralLink = createNewReferralLink;
window.viewOrder = viewOrder;
window.downloadInvoice = downloadInvoice;
window.reorderOrder = reorderOrder;
window.showOrdersList = showOrdersList;
window.addAddress = addAddress;
window.addBillingAddress = addBillingAddress;
window.editAddress = editAddress;
window.editBillingAddress = editBillingAddress;
window.deleteAddress = deleteAddress;
window.deleteBillingAddress = deleteBillingAddress;
window.setDefaultAddress = setDefaultAddress;
window.setDefaultBillingAddress = setDefaultBillingAddress;
window.addPaymentMethod = addPaymentMethod;
window.editPaymentMethod = editPaymentMethod;
window.deletePaymentMethod = deletePaymentMethod;
window.saveAccountDetails = saveAccountDetails;
window.togglePasswordVisibility = togglePasswordVisibility;
window.addToCart = addToCart;
window.removeFromWishlist = removeFromWishlist;
window.addToWishlist = addToWishlist;
window.apiCall = apiCall;
window.populateAllOrders = populateAllOrders;
window.populateAffiliateOrders = populateAffiliateOrders;

/* --------------------------------------------------
   BOOT
-------------------------------------------------- */

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', initDashboard)
  : initDashboard();

console.log('📱 Dashboard script loaded');
