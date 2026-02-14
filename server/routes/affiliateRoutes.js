/**
 * Affiliate Routes
 * CRUD operations, dashboard, and tracking for affiliate management
 */

module.exports = (db) => {
  const express = require('express');
  const router = express.Router();

  const {
    createAffiliateProfile_Controller,
    checkAffiliate,
    getAffiliateProfile,
    getAffiliateDashboard,
    updateAffiliateProfile,
    deleteAffiliateProfile,
    createReferralLinkController,
    trackClick,
    trackConversion,
    getEarnings,
    getAffiliateOrders,
    getGraphData,
    getAnalytics,
    getAffiliateSettingsController,
    updateAffiliateSettingsController,
    createCartShareController,
    getCartShareController,
    getCartPreview,
    getAffiliateVisits,
    getLifetimeCustomersController,
    getAffiliateAreaConfig,
    getAffiliateDiscounts,
    createAffiliateDiscount,
    createSingleUseAffiliateDiscount,
    getAffiliateShareDiscountsCreated,
    deleteAffiliateShareDiscount
  } = require('../controllers/affiliateController');

  // Affiliate Profile Routes

  /**
   * POST /api/affiliates/create
   * Create a new affiliate profile
   */
  router.post('/create', (req, res) => {
    createAffiliateProfile_Controller(req, res, db);
  });

  /**
   * GET /api/affiliates/cart-preview?shop=...&cart=variantId:qty,...
   * Product details for shared cart (home page modal)
   */
  router.get('/cart-preview', (req, res) => {
    getCartPreview(req, res, db);
  });

  /**
   * GET /api/affiliates/check?customerId=...&shop=...
   * Returns { isAffiliate: true|false } for theme/storefront (must be before /:customerId)
   */
  router.get('/check', (req, res) => {
    checkAffiliate(req, res, db);
  });

  /**
   * GET /api/affiliates/area-config?shop=...
   * Public config for affiliate area block (greeting message). No auth.
   */
  router.get('/area-config', (req, res) => {
    getAffiliateAreaConfig(req, res, db);
  });

  /**
   * GET /api/affiliates/discounts/created?shop=...&affiliateId=...&limit=50
   * List single-use discount codes created by the app (from DB), for one-customer one-time use.
   */
  router.get('/discounts/created', (req, res) => {
    getAffiliateShareDiscountsCreated(req, res, db);
  });

  /**
   * DELETE /api/affiliates/discounts/created/:id?shop=...&affiliateId=... or &customerId=...&email=...
   * Deactivate the discount on Shopify and remove the record from DB.
   */
  router.delete('/discounts/created/:id', (req, res) => {
    deleteAffiliateShareDiscount(req, res, db);
  });

  /**
   * POST /api/affiliates/discounts/create-single-use
   * Body: { shop, affiliateId } or { shop, customerId, email }
   * Create a single-use code on the store (usageLimit: 1) using affiliate's share discount %; store in DB.
   */
  router.post('/discounts/create-single-use', (req, res) => {
    createSingleUseAffiliateDiscount(req, res, db);
  });

  /**
   * GET /api/affiliates/discounts?shop=...&first=50&query=...
   * Fetch discount codes from the store (Shopify). Requires shop to be installed.
   */
  router.get('/discounts', (req, res) => {
    getAffiliateDiscounts(req, res, db);
  });

  /**
   * POST /api/affiliates/discounts
   * Body: { shop, code, title, percentage, usageLimit?, appliesOncePerCustomer? }
   * Create a discount code on the store.
   */
  router.post('/discounts', (req, res) => {
    createAffiliateDiscount(req, res, db);
  });

  /**
   * GET /api/affiliates/:customerId
   * Get affiliate profile by customer ID
   */
  router.get('/:customerId', (req, res) => {
    getAffiliateProfile(req, res, db);
  });

  /**
   * GET /api/affiliates/customer/:customerId/dashboard
   * Get affiliate dashboard data by customer ID (for storefront access)
   */
  router.get('/customer/:customerId/dashboard', (req, res) => {
    getAffiliateDashboard(req, res, db);
  });

  /**
   * GET /api/affiliates/customer/:customerId/visits
   * Get paginated visits (clicks) for affiliate by customer ID. Query: shop, email, from, to, page, limit
   */
  router.get('/customer/:customerId/visits', (req, res) => {
    getAffiliateVisits(req, res, db);
  });

  /**
   * GET /api/affiliates/customer/:customerId/lifetime-customers
   * Get paginated lifetime customers for affiliate by customer ID. Query: shop, email, page, limit
   */
  router.get('/customer/:customerId/lifetime-customers', (req, res) => {
    getLifetimeCustomersController(req, res, db);
  });

  /**
   * GET /api/affiliates/:affiliateId/dashboard
   * Get affiliate dashboard data (profile, links, earnings, stats)
   */
  router.get('/:affiliateId/dashboard', (req, res) => {
    getAffiliateDashboard(req, res, db);
  });

  /**
   * PUT /api/affiliates/:affiliateId/update
   * Update affiliate details
   */
  router.put('/:affiliateId/update', (req, res) => {
    updateAffiliateProfile(req, res, db);
  });

  /**
   * DELETE /api/affiliates/:affiliateId
   * Delete or deactivate affiliate
   * Query: ?hardDelete=true to permanently delete
   */
  router.delete('/:affiliateId', (req, res) => {
    deleteAffiliateProfile(req, res, db);
  });

  // Referral Link Routes

  /**
   * POST /api/affiliates/:affiliateId/referral-links
   * Create a new referral link for an affiliate
   * Body: { productIds: [], productVariantIds: [], description: '', url: '' }
   */
  router.post('/:affiliateId/referral-links', (req, res) => {
    createReferralLinkController(req, res, db);
  });

  // Tracking Routes

  /**
   * POST /api/affiliates/track/click
   * Track a referral link click
   * Body: { shortCode: 'abc123' }
   */
  router.post('/track/click', (req, res) => {
    trackClick(req, res, db);
  });

  /**
   * POST /api/affiliates/track/conversion
   * Track a referral conversion (order)
   * Body: { shortCode: 'abc123', orderId: 'order123', amount: 99.99, commissionRate: 0.1 }
   */
  router.post('/track/conversion', (req, res) => {
    trackConversion(req, res, db);
  });

  // Analytics Routes

  /**
   * GET /api/affiliates/:affiliateId/earnings
   * Get affiliate earnings summary
   */
  router.get('/:affiliateId/earnings', (req, res) => {
    getEarnings(req, res, db);
  });

  /**
   * GET /api/affiliates/:affiliateId/orders
   * Get all affiliate orders (conversions from referral links)
   */
  router.get('/:affiliateId/orders', (req, res) => {
    getAffiliateOrders(req, res, db);
  });

  /**
   * GET /api/affiliates/:affiliateId/graph-data
   * Get daily referral earnings by status (for Graphs tab)
   */
  router.get('/:affiliateId/graph-data', (req, res) => {
    getGraphData(req, res, db);
  });

  /**
   * GET /api/affiliates/:affiliateId/analytics
   * Get detailed affiliate analytics (clicks, conversions, rates)
   */
  router.get('/:affiliateId/analytics', (req, res) => {
    getAnalytics(req, res, db);
  });

  /**
   * GET /api/affiliates/:affiliateId/visits
   * Get paginated visits (clicks). Query: from, to, page, limit
   */
  router.get('/:affiliateId/visits', (req, res) => {
    getAffiliateVisits(req, res, db);
  });

  /**
   * GET /api/affiliates/:affiliateId/lifetime-customers
   * Get paginated lifetime customers. Query: page, limit
   */
  router.get('/:affiliateId/lifetime-customers', (req, res) => {
    getLifetimeCustomersController(req, res, db);
  });

  // Settings Routes

  /**
   * GET /api/affiliates/:affiliateId/settings
   * Get affiliate settings (shareCartEnabled, etc.)
   */
  router.get('/:affiliateId/settings', (req, res) => {
    getAffiliateSettingsController(req, res, db);
  });

  /**
   * POST /api/affiliates/:affiliateId/settings
   * Update affiliate settings
   * Body: { shareCartEnabled: true, trackCartProducts: true, cartShareExpiryDays: 30 }
   */
  router.post('/:affiliateId/settings', (req, res) => {
    updateAffiliateSettingsController(req, res, db);
  });

  // Cart Share Routes

  /**
   * POST /api/affiliates/:affiliateId/share-cart
   * Create a cart share link
   * Body: { items: [...], customerId: '123', customerEmail: 'email@test.com' }
   */
  router.post('/:affiliateId/share-cart', (req, res) => {
    createCartShareController(req, res, db);
  });

  /**
   * GET /api/affiliates/cart-shares/:shareId
   * Get cart share details and track the view
   */
  router.get('/cart-shares/:shareId', (req, res) => {
    getCartShareController(req, res, db);
  });

  return router;
};
