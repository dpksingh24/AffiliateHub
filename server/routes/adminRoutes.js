/**
 * Admin Routes
 * Admin-level operations for store settings and feature management
 */

module.exports = (db) => {
  const express = require('express');
  const router = express.Router();

  const {
    getShareCartStatus,
    enableShareCart,
    getEmailTemplatesHandler,
    putEmailTemplatesHandler,
    getAffiliateAreaGreeting,
    putAffiliateAreaGreeting,
    getAffiliateCommissionRate,
    putAffiliateCommissionRate,
    getPayouts,
    getReferrals,
    getReferralsByAffiliate,
    getReferralById,
    updateReferralStatus,
    updateReferralBulkStatus,
    deleteReferral,
    getVisits,
    getAffiliates,
    getAffiliateById,
    syncAffiliateNamesFromSubmissions
  } = require('../controllers/adminController');

  /**
   * GET /api/admin/share-cart/status
   * Get current share cart feature status
   */
  router.get('/share-cart/status', (req, res) => {
    getShareCartStatus(req, res, db);
  });

  /**
   * POST /api/admin/share-cart/enable
   * Enable or disable share cart feature
   * Body: { shop: 'store-name', enabled: true/false, cartExpiryDays: 30 }
   */
  router.post('/share-cart/enable', (req, res) => {
    enableShareCart(req, res, db);
  });

  /**
   * GET /api/admin/email-templates?shop=...
   * Get email templates for the shop (defaults merged with any saved overrides)
   */
  router.get('/email-templates', (req, res) => {
    getEmailTemplatesHandler(req, res, db);
  });

  /**
   * PUT /api/admin/email-templates
   * Body: { shop, templates: { submission_received: { subject, text, html }, ... } }
   */
  router.put('/email-templates', (req, res) => {
    putEmailTemplatesHandler(req, res, db);
  });

  /**
   * GET /api/admin/affiliate-area-greeting?shop=...
   * Get affiliate area greeting message for admin editing
   */
  router.get('/affiliate-area-greeting', (req, res) => {
    getAffiliateAreaGreeting(req, res, db);
  });

  /**
   * PUT /api/admin/affiliate-area-greeting
   * Body: { shop, message: string }
   */
  router.put('/affiliate-area-greeting', (req, res) => {
    putAffiliateAreaGreeting(req, res, db);
  });

  /**
   * GET /api/admin/affiliate-commission-rate?shop=...
   * Get affiliate commission rate (0–1, e.g. 0.1 = 10%)
   */
  router.get('/affiliate-commission-rate', (req, res) => {
    getAffiliateCommissionRate(req, res, db);
  });

  /**
   * PUT /api/admin/affiliate-commission-rate
   * Body: { shop, commissionRate: number } (0–1, e.g. 0.1 for 10%)
   */
  router.put('/affiliate-commission-rate', (req, res) => {
    putAffiliateCommissionRate(req, res, db);
  });

  /**
   * GET /api/admin/payouts?shop=...&page=1&limit=20&status=paid|processing|failed
   * List affiliate payouts for admin
   */
  router.get('/payouts', (req, res) => {
    getPayouts(req, res, db);
  });

  /**
   * GET /api/admin/referrals?shop=...&page=1&limit=20&status=...&from=...&to=...&affiliateId=...
   * List all referrals (conversions) for the shop; optional affiliateId to filter by affiliate.
   */
  router.get('/referrals', (req, res) => {
    getReferrals(req, res, db);
  });

  /**
   * GET /api/admin/referrals/by-affiliate?shop=...&status=...&from=...&to=...
   * List referrals grouped by affiliate (one row per affiliate with totals).
   */
  router.get('/referrals/by-affiliate', (req, res) => {
    getReferralsByAffiliate(req, res, db);
  });

  /**
   * POST /api/admin/referrals/bulk-status?shop=...  body: { referralIds: string[], status: 'paid' | 'pending' }
   * Mark multiple referrals as paid or unpaid.
   */
  router.post('/referrals/bulk-status', (req, res) => {
    updateReferralBulkStatus(req, res, db);
  });

  /**
   * GET /api/admin/referrals/:id?shop=...
   * Get a single referral by ID (for detail page).
   */
  router.get('/referrals/:id', (req, res) => {
    getReferralById(req, res, db);
  });

  /**
   * PATCH /api/admin/referrals/:id/status?shop=...  body: { status: 'pending' | 'paid' }
   * Mark referral as unpaid (pending) or paid.
   */
  router.patch('/referrals/:id/status', (req, res) => {
    updateReferralStatus(req, res, db);
  });

  /**
   * DELETE /api/admin/referrals/:id?shop=...
   * Delete a referral and reverse affiliate stats/earnings.
   */
  router.delete('/referrals/:id', (req, res) => {
    deleteReferral(req, res, db);
  });

  /**
   * GET /api/admin/visits?shop=...&page=1&limit=20&from=...&to=...
   * List all visits (referral link clicks) for the shop with full details.
   */
  router.get('/visits', (req, res) => {
    getVisits(req, res, db);
  });

  /**
   * GET /api/admin/affiliates?shop=...&page=1&limit=20&status=...
   * List all affiliates for the shop with earnings, stats, and referral link details.
   */
  router.get('/affiliates', (req, res) => {
    getAffiliates(req, res, db);
  });

  /**
   * GET /api/admin/affiliates/:id?shop=...
   * Get a single affiliate by ID (for detail page).
   */
  router.get('/affiliates/:id', (req, res) => {
    getAffiliateById(req, res, db);
  });

  /**
   * POST /api/admin/affiliates/sync-names-from-submissions?shop=...
   * Backfill affiliate names from approved form submissions (for affiliates with no name or "Affiliate").
   */
  router.post('/affiliates/sync-names-from-submissions', (req, res) => {
    syncAffiliateNamesFromSubmissions(req, res, db);
  });

  /**
   * POST /api/admin/affiliates/remove-self-referrals
   * One-time cleanup: remove conversions where order customer email = affiliate email (self-referrals) and reverse stats.
   * Use after deploying the self-referral guard to clean up previously recorded self-referrals.
   */
  router.post('/affiliates/remove-self-referrals', async (req, res) => {
    try {
      const { removeSelfReferralConversions } = require('../models/affiliate.model');
      const result = await removeSelfReferralConversions(db);
      res.json({ success: true, removed: result.removed, orderIds: result.orderIds });
    } catch (err) {
      console.error('remove-self-referrals error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/admin/simulate-conversion
   * Body: { shortCode: 'abc123', orderId: '1001', amount: 99.99, currency: 'USD' }
   * Admin-only endpoint to simulate/record a conversion for testing.
   */
  router.post('/simulate-conversion', async (req, res) => {
    try {
      const { shortCode, orderId, amount, currency, commissionRate } = req.body;
      if (!shortCode || !orderId || !amount) {
        return res.status(400).json({ success: false, error: 'shortCode, orderId and amount are required' });
      }

      const { trackReferralConversion } = require('../../server/models/affiliate.model');
      await trackReferralConversion(db, shortCode, {
        orderId: String(orderId),
        amount: parseFloat(amount),
        currency: currency || 'USD',
        commissionRate: commissionRate || 0.1
      });

      res.json({ success: true, message: 'Conversion simulated/recorded' });
    } catch (err) {
      console.error('simulate-conversion error:', err);
      res.status(500).json({ success: false, error: 'Failed to simulate conversion' });
    }
  });

  return router;
};
