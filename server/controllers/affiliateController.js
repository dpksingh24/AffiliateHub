/**
 * Affiliate Controller
 * Handles affiliate profile management, referral tracking, and earnings
 */

const {
  createAffiliateProfile,
  getAffiliateByCustomerId,
  getAffiliateById,
  updateAffiliateDetails,
  deleteAffiliate,
  createReferralLink,
  trackReferralClick,
  trackReferralConversion,
  calculateEarnings,
  getAffiliateAnalytics,
  updateAffiliateSettings,
  getAffiliateSettings,
  getStoreCommissionRate,
  storeCartShare,
  getCartShareById,
  trackCartShareClick,
  getLifetimeCustomers
} = require('../models/affiliate.model');

const { ObjectId } = require('mongodb');
const EmailService = require('../services/email.services');

/**
 * Create a new affiliate profile
 * POST /api/affiliates/create
 */
const createAffiliateProfile_Controller = async (req, res, db) => {
  try {
    const { customerId, email, name, shop } = req.body;

    if (!customerId || !shop) {
      return res.status(400).json({
        success: false,
        error: 'customerId and shop are required'
      });
    }

    // Check if affiliate already exists
    const existing = await getAffiliateByCustomerId(db, customerId, shop);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Affiliate profile already exists for this customer'
      });
    }

    // Create affiliate profile
    const affiliate = await createAffiliateProfile(db, {
      customerId,
      shop,
      email,
      name
    });

    // ✅ AUTO-CREATE default referral link
    const referralLink = await createReferralLink(db, affiliate._id.toString(), {
      description: 'Main Referral Link',
      productIds: [],
      productVariantIds: []
    });

    res.json({
      success: true,
      message: 'Affiliate profile created successfully with referral link',
      affiliate: {
        id: affiliate._id.toString(),
        ...affiliate,
        referralLinks: [referralLink]
      }
    });
  } catch (error) {
    console.error('Error creating affiliate profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create affiliate profile',
      message: error.message
    });
  }
};

/**
 * Check if customer is an affiliate (by customer ID + shop)
 * GET /api/affiliates/check?customerId=...&shop=...
 * Returns { isAffiliate: true|false } for use by theme/storefront.
 */
const checkAffiliate = async (req, res, db) => {
  try {
    const { customerId, shop } = req.query;
    if (!customerId || !shop) {
      return res.status(400).json({
        success: false,
        error: 'customerId and shop are required'
      });
    }
    const affiliate = await getAffiliateByCustomerId(db, customerId, shop);
    res.json({
      success: true,
      isAffiliate: !!affiliate
    });
  } catch (error) {
    console.error('Error checking affiliate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check affiliate status',
      isAffiliate: false
    });
  }
};

/**
 * Get affiliate profile by customer ID
 * GET /api/affiliates/:customerId
 */
const getAffiliateProfile = async (req, res, db) => {
  try {
    const { customerId } = req.params;
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({
        success: false,
        error: 'Shop parameter is required'
      });
    }

    const affiliate = await getAffiliateByCustomerId(db, customerId, shop);

    if (!affiliate) {
      return res.status(404).json({
        success: false,
        error: 'Affiliate profile not found'
      });
    }

    const appUrl = (process.env.HOST || 'https://kisciapp.ebizonstg.com').replace(/\/+$/, '');
    res.json({
      success: true,
      affiliate: {
        id: affiliate._id.toString(),
        ...affiliate,
        appReferralBaseUrl: appUrl
      }
    });
  } catch (error) {
    console.error('Error fetching affiliate profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch affiliate profile',
      message: error.message
    });
  }
};

/**
 * Get affiliate dashboard data
 * GET /api/affiliates/:affiliateId/dashboard
 * GET /api/affiliates/customer/:customerId/dashboard
 * Query: ?shop=...&email=... (email is required for customer-based access for security)
 */
const getAffiliateDashboard = async (req, res, db) => {
  try {
    const { affiliateId, customerId } = req.params;
    const { shop, email } = req.query;

    let affiliate;

    // If customerId is provided, find affiliate by customer ID
    if (customerId && customerId !== 'customer') {
      if (!shop) {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter is required'
        });
      }

      // ✅ SECURITY: Verify email matches (prevent unauthorized access)
      if (!email) {
        return res.status(401).json({
          success: false,
          error: 'Email is required for authentication'
        });
      }

      affiliate = await getAffiliateByCustomerId(db, customerId, shop);

      // ✅ Check if email matches for security
      if (affiliate && affiliate.email !== email) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized: Email does not match'
        });
      }
    } else {
      // Find by affiliate ID
      affiliate = await getAffiliateById(db, affiliateId);
    }

    if (!affiliate) {
      return res.status(404).json({
        success: false,
        error: 'Affiliate not found'
      });
    }

    // Get analytics (deduped by orderId so duplicates don't inflate stats)
    const analytics = await getAffiliateAnalytics(db, affiliate._id.toString());

    const totalClicks = analytics.totalClicks ?? affiliate.stats.totalClicks ?? 0;
    const totalConversions = analytics.totalConversions ?? affiliate.stats.totalConversions ?? 0;
    const conversionRate = totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(2) : 0;

    // Commission rate: per-affiliate override > store default > 10%
    const effectiveCommissionRate = affiliate.settings?.commissionRate != null
      ? affiliate.settings.commissionRate
      : await getStoreCommissionRate(db, affiliate.shop);

    const dashboardData = {
      success: true,
      affiliateId: affiliate._id.toString(),
      dashboard: {
        profile: {
          id: affiliate._id.toString(),
          name: affiliate.name,
          email: affiliate.email,
          paymentEmail: affiliate.paymentEmail || null,
          enableNewReferralNotifications: !!affiliate.settings?.enableNewReferralNotifications,
          shareCartDiscountEnabled: !!affiliate.settings?.shareCartDiscountEnabled,
          shareCartDiscountPercent: affiliate.settings?.shareCartDiscountPercent ?? 0,
          status: affiliate.status,
          createdAt: affiliate.createdAt
        },
        referralLinks: affiliate.referralLinks.map(link => {
          const deduped = analytics.linkStatsByShortCode?.[link.shortCode];
          return {
            id: link._id.toString(),
            shortCode: link.shortCode,
            url: link.url,
            description: link.description,
            productCount: link.productIds.length,
            status: link.status,
            stats: {
              ...link.stats,
              clicks: link.stats?.clicks ?? 0,
              conversions: deduped != null ? deduped.conversions : (link.stats?.conversions ?? 0),
              revenue: deduped != null ? deduped.revenue : (link.stats?.revenue ?? 0)
            }
          };
        }),
        earnings: {
          total: affiliate.earnings.total || 0,
          pending: affiliate.earnings.pending || 0,
          paid: affiliate.earnings.paid || 0,
          currency: analytics.currency || affiliate.earnings.currency || 'USD'
        },
        stats: {
          totalClicks,
          totalConversions,
          conversionRate: conversionRate + '%',
          totalRevenue: analytics.totalRevenue ?? affiliate.stats.totalRevenue ?? 0,
          commissionRate: effectiveCommissionRate
        },
        createdAt: affiliate.createdAt,
        updatedAt: affiliate.updatedAt
      }
    };

    res.json(dashboardData);
  } catch (error) {
    console.error('Error fetching affiliate dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch affiliate dashboard',
      message: error.message
    });
  }
};

/**
 * Update affiliate details
 * PUT /api/affiliates/:affiliateId/update
 */
const updateAffiliateProfile = async (req, res, db) => {
  try {
    const { affiliateId } = req.params;
    const { shop } = req.query;
    const {
      name,
      email,
      status,
      paymentEmail,
      enableNewReferralNotifications,
      shareCartDiscountEnabled,
      shareCartDiscountPercent
    } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (status) updateData.status = status;
    if (typeof paymentEmail !== 'undefined') updateData.paymentEmail = paymentEmail === '' ? null : paymentEmail;
    if (typeof enableNewReferralNotifications !== 'undefined') updateData['settings.enableNewReferralNotifications'] = !!enableNewReferralNotifications;
    if (typeof shareCartDiscountEnabled !== 'undefined') updateData['settings.shareCartDiscountEnabled'] = !!shareCartDiscountEnabled;
    if (typeof shareCartDiscountPercent !== 'undefined') {
      const pct = Number(shareCartDiscountPercent);
      if (Number.isInteger(pct) && [0, 5, 10, 15, 20].includes(pct)) {
        updateData['settings.shareCartDiscountPercent'] = pct;
      }
    }

    let updated = null;
    try {
      updated = await updateAffiliateDetails(db, affiliateId, updateData);
    } catch (idErr) {
      // Invalid ObjectId or DB error – continue to fallbacks
    }

    const shopTrimmed = shop && typeof shop === 'string' ? shop.trim() : '';

    // Fallback 1: by shop + email/paymentEmail from body
    if (!updated && shopTrimmed && (email || paymentEmail)) {
      const lookupEmail = (email || paymentEmail || '').toString().trim();
      if (lookupEmail) {
        const affiliate = await db.collection('affiliates').findOne({
          shop: shopTrimmed,
          $or: [
            { email: lookupEmail },
            { paymentEmail: lookupEmail }
          ]
        });
        if (affiliate) {
          updated = await updateAffiliateDetails(db, affiliate._id.toString(), updateData);
        }
      }
    }

    // Fallback 2: by shop only when exactly one affiliate exists (e.g. body not sent)
    if (!updated && shopTrimmed) {
      const affiliates = await db.collection('affiliates').find({ shop: shopTrimmed }).limit(2).toArray();
      if (affiliates.length === 1) {
        updated = await updateAffiliateDetails(db, affiliates[0]._id.toString(), updateData);
      }
    }

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Affiliate not found'
      });
    }

    res.json({
      success: true,
      message: 'Affiliate profile updated successfully',
      affiliate: {
        id: updated._id.toString(),
        ...updated
      }
    });
  } catch (error) {
    console.error('Error updating affiliate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update affiliate',
      message: error.message
    });
  }
};

/**
 * Delete / Deactivate affiliate
 * DELETE /api/affiliates/:affiliateId
 */
const deleteAffiliateProfile = async (req, res, db) => {
  try {
    const { affiliateId } = req.params;
    const { hardDelete } = req.query; // ?hardDelete=true to permanently delete

    const success = await deleteAffiliate(db, affiliateId, hardDelete === 'true');

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Affiliate not found'
      });
    }

    res.json({
      success: true,
      message: hardDelete === 'true' ? 'Affiliate deleted permanently' : 'Affiliate deactivated'
    });
  } catch (error) {
    console.error('Error deleting affiliate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete affiliate',
      message: error.message
    });
  }
};

/**
 * Create a new referral link
 * POST /api/affiliates/:affiliateId/referral-links
 */
const createReferralLinkController = async (req, res, db) => {
  try {
    const { affiliateId } = req.params;
    const { productIds, productVariantIds, description, url, replacePrimary } = req.body;

    const affiliate = await getAffiliateById(db, affiliateId);
    if (!affiliate) {
      return res.status(404).json({
        success: false,
        error: 'Affiliate not found'
      });
    }

    const doReplace = replacePrimary === true;

    const referralLink = await createReferralLink(db, affiliateId, {
      productIds: productIds || [],
      productVariantIds: productVariantIds || [],
      description: description || '',
      url
    }, { replacePrimary: doReplace });

    res.json({
      success: true,
      message: 'Referral link created successfully',
      referralLink: {
        id: referralLink._id.toString(),
        ...referralLink
      }
    });
  } catch (error) {
    console.error('Error creating referral link:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create referral link',
      message: error.message
    });
  }
};

/**
 * Track referral click
 * POST /api/affiliates/track/click
 */
const trackClick = async (req, res, db) => {
  try {
    const { shortCode } = req.body;

    if (!shortCode) {
      return res.status(400).json({
        success: false,
        error: 'shortCode is required'
      });
    }

    const { getClientIp } = require('../utils/requestUtils');
    const metadata = {
      ipAddress: getClientIp(req) || req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
      referrer: req.headers['referer']?.trim() || 'Referral link'
    };

    await trackReferralClick(db, shortCode, metadata);

    res.json({
      success: true,
      message: 'Click tracked successfully'
    });
  } catch (error) {
    console.error('Error tracking click:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track click',
      message: error.message
    });
  }
};

/**
 * Track referral conversion
 * POST /api/affiliates/track/conversion
 */
const trackConversion = async (req, res, db) => {
  try {
    const { shortCode, orderId, amount, commissionRate } = req.body;

    if (!shortCode || !orderId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'shortCode, orderId, and amount are required'
      });
    }

    const conversionPayload = { orderId, amount };
    if (commissionRate != null) conversionPayload.commissionRate = parseFloat(commissionRate);
    const result = await trackReferralConversion(db, shortCode, conversionPayload);

    if (result && result.inserted && result.affiliate && result.affiliate.email && result.affiliate.settings?.enableNewReferralNotifications) {
      const commissionAmount = result.commissionAmount;
      try {
        await EmailService.sendNewReferralNotificationToAffiliate(result.affiliate.email, {
          affiliateName: result.affiliate.name || 'Affiliate',
          orderDisplay: orderId,
          amount,
          currency: 'USD',
          commissionAmount
        });
      } catch (emailErr) {
        console.error('Failed to send new referral notification email:', emailErr);
      }
    }

    res.json({
      success: true,
      message: 'Conversion tracked successfully'
    });
  } catch (error) {
    console.error('Error tracking conversion:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track conversion',
      message: error.message
    });
  }
};

/**
 * Get affiliate earnings
 * GET /api/affiliates/:affiliateId/earnings
 */
const getEarnings = async (req, res, db) => {
  try {
    const { affiliateId } = req.params;

    const earnings = await calculateEarnings(db, affiliateId);

    if (!earnings) {
      return res.status(404).json({
        success: false,
        error: 'Affiliate not found'
      });
    }

    res.json({
      success: true,
      earnings
    });
  } catch (error) {
    console.error('Error fetching earnings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch earnings',
      message: error.message
    });
  }
};

/**
 * Get affiliate orders (conversions)
 * GET /api/affiliates/:affiliateId/orders?page=1&limit=20&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns orders that came through affiliate referral links, with pagination and optional date filter
 */
const getAffiliateOrders = async (req, res, db) => {
  try {
    const { affiliateId } = req.params;
    const { from: fromDate, to: toDate, page: pageStr, limit: limitStr } = req.query;

    const affiliate = await getAffiliateById(db, affiliateId);

    if (!affiliate) {
      return res.status(404).json({
        success: false,
        error: 'Affiliate not found'
      });
    }

    const page = Math.max(1, parseInt(pageStr, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitStr, 10) || 20));
    const skip = (page - 1) * limit;

    const baseQuery = {
      $or: [
        { shortCode: { $in: affiliate.referralLinks.map(l => l.shortCode) } },
        { shortCode: affiliate.customerId.toString() }
      ]
    };
    if (fromDate || toDate) {
      baseQuery.timestamp = {};
      if (fromDate) baseQuery.timestamp.$gte = new Date(fromDate);
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        baseQuery.timestamp.$lte = to;
      }
    }

    const [conversions, total] = await Promise.all([
      db.collection('referral_conversions').find(baseQuery).sort({ timestamp: -1 }).skip(skip).limit(limit).toArray(),
      db.collection('referral_conversions').countDocuments(baseQuery)
    ]);

    const seen = new Set();
    const unique = conversions.filter(c => {
      if (seen.has(c.orderId)) return false;
      seen.add(c.orderId);
      return true;
    });

    const displayStatus = (s) => {
      if (!s) return 'Unpaid';
      const lower = String(s).toLowerCase();
      if (lower === 'paid') return 'Paid';
      if (lower === 'rejected') return 'Rejected';
      return 'Unpaid';
    };

    const totalPages = Math.ceil(total / limit) || 0;

    res.json({
      success: true,
      orders: unique.map(conv => {
        const reference = conv.orderDisplay || conv.orderId;
        return {
          id: conv.orderId,
          orderId: conv.orderId,
          reference,
          shortCode: conv.shortCode,
          referralId: conv._id ? conv._id.toString() : null,
          amount: conv.amount,
          currency: conv.currency,
          commissionAmount: conv.commissionAmount,
          commissionRate: conv.commissionRate,
          status: displayStatus(conv.status),
          date: conv.timestamp,
          timestamp: conv.timestamp,
          productNames: Array.isArray(conv.productNames) ? conv.productNames : [],
          customerEmail: conv.customerEmail || '',
          customerName: conv.customerName || '',
          customerPhone: conv.customerPhone || ''
        };
      }),
      total,
      page,
      limit,
      totalPages
    });
  } catch (error) {
    console.error('Error fetching affiliate orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch affiliate orders',
      message: error.message
    });
  }
};

/**
 * Normalize conversion status for graph series (Unpaid, Pending, Rejected, Paid).
 * DB stores "pending" for what the UI calls "Unpaid"; map both into the unpaid series so the graph shows data.
 */
function normalizeGraphStatus(s) {
  if (!s) return 'unpaid';
  const lower = String(s).toLowerCase();
  if (lower === 'paid') return 'paid';
  if (lower === 'rejected') return 'rejected';
  if (lower === 'pending') return 'unpaid'; // admin "Unpaid" = DB pending → show in Unpaid series
  return 'unpaid';
}

/**
 * Get affiliate graph data (daily referral earnings by status)
 * GET /api/affiliates/:affiliateId/graph-data?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns daily counts/amounts for Unpaid, Pending, Rejected, Paid
 */
const getGraphData = async (req, res, db) => {
  try {
    const { affiliateId } = req.params;
    let { from: fromDate, to: toDate } = req.query;

    const affiliate = await getAffiliateById(db, affiliateId);
    if (!affiliate) {
      return res.status(404).json({ success: false, error: 'Affiliate not found' });
    }

    const now = new Date();
    if (!toDate) {
      toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      toDate = toDate.toISOString().slice(0, 10);
    }
    if (!fromDate) {
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
      fromDate = fromDate.toISOString().slice(0, 10);
    }

    const from = new Date(fromDate);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);

    const baseQuery = {
      $or: [
        { shortCode: { $in: (affiliate.referralLinks || []).map(l => l.shortCode) } },
        { shortCode: String(affiliate.customerId || '') }
      ],
      timestamp: { $gte: from, $lte: to }
    };

    const conversions = await db.collection('referral_conversions')
      .find(baseQuery)
      .project({ timestamp: 1, status: 1, commissionAmount: 1 })
      .toArray();

    const dayMap = {};
    const dayKeys = [];
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      dayKeys.push(key);
      dayMap[key] = { unpaid: 0, pending: 0, rejected: 0, paid: 0 };
    }

    conversions.forEach(c => {
      const key = new Date(c.timestamp).toISOString().slice(0, 10);
      if (!dayMap[key]) return;
      const status = normalizeGraphStatus(c.status);
      const amount = Number(c.commissionAmount) || 0;
      dayMap[key][status] = (dayMap[key][status] || 0) + amount;
    });

    const labels = dayKeys.map(key => {
      const d = new Date(key);
      return d.getDate() + '/' + d.toLocaleDateString('en-GB', { month: 'short' });
    });
    const unpaid = dayKeys.map(k => dayMap[k].unpaid || 0);
    const pending = dayKeys.map(k => dayMap[k].pending || 0);
    const rejected = dayKeys.map(k => dayMap[k].rejected || 0);
    const paid = dayKeys.map(k => dayMap[k].paid || 0);

    res.json({
      success: true,
      labels,
      unpaid,
      pending,
      rejected,
      paid
    });
  } catch (error) {
    console.error('Error fetching graph data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch graph data',
      message: error.message
    });
  }
};

/**
 * Get affiliate analytics
 * GET /api/affiliates/:affiliateId/analytics
 */
const getAnalytics = async (req, res, db) => {
  try {
    const { affiliateId } = req.params;

    const analytics = await getAffiliateAnalytics(db, affiliateId);

    if (!analytics) {
      return res.status(404).json({
        success: false,
        error: 'Affiliate not found'
      });
    }

    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics',
      message: error.message
    });
  }
};

/**
 * Get affiliate settings
 * GET /api/affiliates/:affiliateId/settings
 */
const getAffiliateSettingsController = async (req, res, db) => {
  try {
    const { affiliateId } = req.params;

    if (!affiliateId) {
      return res.status(400).json({
        success: false,
        error: 'affiliateId is required'
      });
    }

    const settings = await getAffiliateSettings(db, affiliateId);

    if (!settings) {
      return res.status(404).json({
        success: false,
        error: 'Affiliate settings not found'
      });
    }

    res.json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('Error fetching affiliate settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch settings',
      message: error.message
    });
  }
};

/**
 * Update affiliate settings
 * POST /api/affiliates/:affiliateId/settings
 * Body: { shareCartEnabled: true, trackCartProducts: true, cartShareExpiryDays: 30 }
 */
const updateAffiliateSettingsController = async (req, res, db) => {
  try {
    const { affiliateId } = req.params;
    const settingsData = req.body;

    if (!affiliateId) {
      return res.status(400).json({
        success: false,
        error: 'affiliateId is required'
      });
    }

    const updatedSettings = await updateAffiliateSettings(db, affiliateId, settingsData);

    if (!updatedSettings) {
      return res.status(404).json({
        success: false,
        error: 'Affiliate not found'
      });
    }

    res.json({
      success: true,
      message: 'Affiliate settings updated successfully',
      settings: updatedSettings
    });
  } catch (error) {
    console.error('Error updating affiliate settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update settings',
      message: error.message
    });
  }
};

/**
 * Create a cart share link
 * POST /api/affiliates/:affiliateId/share-cart
 * Body: { items: [...], customerId: '123', customerEmail: 'email@test.com' }
 */
const createCartShareController = async (req, res, db) => {
  try {
    const { affiliateId } = req.params;
    const cartData = req.body;

    if (!affiliateId) {
      return res.status(400).json({
        success: false,
        error: 'affiliateId is required'
      });
    }

    if (!cartData || !cartData.items || cartData.items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cart items are required'
      });
    }

    // Store cart share
    const cartShare = await storeCartShare(db, affiliateId, cartData);

    // Get affiliate's referral link short code
    const affiliate = await getAffiliateById(db, affiliateId);
    if (!affiliate || !affiliate.referralLinks || affiliate.referralLinks.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No referral link found for affiliate'
      });
    }

    const primaryLink = affiliate.referralLinks[0];
    const shortCode = primaryLink.shortCode;
    const baseUrl = process.env.HOST || 'https://kisciapp.ebizonstg.com';
    
    // Build share URL with cart ID
    const shareUrl = `${baseUrl}/ref=${shortCode}?cart_id=${cartShare._id.toString()}`;

    res.json({
      success: true,
      message: 'Cart share created successfully',
      shareUrl,
      shareId: cartShare._id.toString(),
      products: cartData.items,
      expiresAt: cartShare.expiresAt
    });
  } catch (error) {
    console.error('Error creating cart share:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create cart share',
      message: error.message
    });
  }
};

/**
 * Get cart share details
 * GET /api/affiliates/cart-shares/:shareId
 */
const getCartShareController = async (req, res, db) => {
  try {
    const { shareId } = req.params;

    if (!shareId) {
      return res.status(400).json({
        success: false,
        error: 'shareId is required'
      });
    }

    const cartShare = await getCartShareById(db, shareId);

    if (!cartShare) {
      return res.status(404).json({
        success: false,
        error: 'Cart share not found or has expired'
      });
    }

    // Check if expired
    if (new Date(cartShare.expiresAt) < new Date()) {
      return res.status(410).json({
        success: false,
        error: 'Cart share has expired'
      });
    }

    // Track the click
    await trackCartShareClick(db, shareId);

    res.json({
      success: true,
      products: cartShare.products,
      cartData: cartShare.cartData
    });
  } catch (error) {
    console.error('Error fetching cart share:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cart share',
      message: error.message
    });
  }
};

/**
 * Get paginated visits (referral link clicks) for an affiliate
 * GET /api/affiliates/customer/:customerId/visits?shop=...&email=...&from=...&to=...&page=1&limit=20
 * GET /api/affiliates/:affiliateId/visits?from=...&to=...&page=1&limit=20
 */
const getAffiliateVisits = async (req, res, db) => {
  try {
    const { affiliateId, customerId } = req.params;
    const { shop, email, from: fromDate, to: toDate, page: pageStr, limit: limitStr } = req.query;

    let affiliate;
    if (customerId && customerId !== 'customer') {
      if (!shop) {
        return res.status(400).json({ success: false, error: 'Shop parameter is required' });
      }
      if (!email) {
        return res.status(401).json({ success: false, error: 'Email is required for authentication' });
      }
      affiliate = await getAffiliateByCustomerId(db, customerId, shop);
      if (affiliate && affiliate.email !== email) {
        return res.status(403).json({ success: false, error: 'Unauthorized: Email does not match' });
      }
    } else {
      affiliate = await getAffiliateById(db, affiliateId);
    }

    if (!affiliate || !affiliate.referralLinks || affiliate.referralLinks.length === 0) {
      return res.json({
        success: true,
        visits: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0
      });
    }

    const shortCodes = affiliate.referralLinks.map(l => l.shortCode);
    const page = Math.max(1, parseInt(pageStr, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitStr, 10) || 20));
    const skip = (page - 1) * limit;

    const query = { shortCode: { $in: shortCodes } };
    if (fromDate || toDate) {
      query.timestamp = {};
      if (fromDate) query.timestamp.$gte = new Date(fromDate);
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        query.timestamp.$lte = to;
      }
    }

    const [clicks, total] = await Promise.all([
      db.collection('referral_clicks').find(query).sort({ timestamp: -1 }).skip(skip).limit(limit).toArray(),
      db.collection('referral_clicks').countDocuments(query)
    ]);

    const clickIds = clicks.map(c => c._id.toString());
    const conversionsByVisitId = {};

    if (clickIds.length > 0) {
      const conversionsWithVisitId = await db.collection('referral_conversions').find({
        visitId: { $in: clickIds }
      }).toArray();
      conversionsWithVisitId.forEach(c => {
        conversionsByVisitId[c.visitId] = {
          productNames: c.productNames || [],
          orderId: c.orderId
        };
      });

      // Fallback: conversions without visitId (e.g. order before visitId was in cart) – match to most recent click with same shortCode before order time
      const conversionsNoVisitId = await db.collection('referral_conversions').find({
        shortCode: { $in: shortCodes },
        $or: [{ visitId: { $exists: false } }, { visitId: null }, { visitId: '' }]
      }).sort({ timestamp: 1 }).toArray();

      const assignedClickIds = new Set(Object.keys(conversionsByVisitId));
      for (const conv of conversionsNoVisitId) {
        const convTime = conv.timestamp ? new Date(conv.timestamp).getTime() : 0;
        let best = null;
        for (const click of clicks) {
          if (click.shortCode !== conv.shortCode || assignedClickIds.has(click._id.toString())) continue;
          const clickTime = click.timestamp ? new Date(click.timestamp).getTime() : 0;
          if (clickTime <= convTime && (!best || clickTime > new Date(best.timestamp).getTime())) {
            best = click;
          }
        }
        if (best) {
          conversionsByVisitId[best._id.toString()] = {
            productNames: conv.productNames || [],
            orderId: conv.orderId
          };
          assignedClickIds.add(best._id.toString());
        }
      }
    }

    const visits = clicks.map((click, index) => {
      const referrer = click.referrer && click.referrer.trim();
      let referringUrl = referrer || 'Referral link';
      if (referringUrl.length > 60) referringUrl = referringUrl.slice(0, 57) + '...';
      let ip = click.ipAddress || '—';
      if (ip && ip !== '—' && ip.includes('.')) {
        const parts = ip.split('.');
        if (parts.length === 4) parts[3] = '***';
        ip = parts.join('.');
      }
      const conv = conversionsByVisitId[click._id.toString()];
      const converted = !!conv;
      const productPurchased = conv && conv.productNames && conv.productNames.length
        ? conv.productNames.join(', ')
        : null;
      return {
        rowNumber: (page - 1) * limit + index + 1,
        visitId: click._id.toString(),
        productPurchased: productPurchased || null,
        referringUrl,
        ip,
        converted,
        referralId: click.shortCode || null,
        affiliateName: affiliate.name || '—',
        date: click.timestamp
      };
    });

    const totalPages = Math.ceil(total / limit) || 0;
    return res.json({
      success: true,
      visits,
      total,
      page,
      limit,
      totalPages
    });
  } catch (error) {
    console.error('Error fetching affiliate visits:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch visits',
      message: error.message
    });
  }
};

/**
 * GET /api/affiliates/cart-preview?shop=...&cart=variantId:qty,variantId:qty
 * Returns product details for shared cart (for modal on home page)
 */
const getCartPreview = async (req, res, db) => {
  try {
    const { shop, cart: cartParam } = req.query;
    if (!shop || !cartParam || typeof cartParam !== 'string' || !/^[\d,:]+$/.test(cartParam)) {
      return res.status(400).json({ success: false, error: 'shop and cart (variantId:qty,...) required' });
    }

    const items = [];
    cartParam.split(',').forEach(part => {
      const [variantId, qty] = part.split(':').map(s => s.trim());
      if (variantId && qty) items.push({ variantId, quantity: parseInt(qty, 10) || 1 });
    });
    if (items.length === 0) {
      return res.json({ success: true, products: [] });
    }

    const shopData = await db.collection('shops').findOne({ shop });
    if (!shopData || !shopData.accessToken) {
      return res.status(401).json({ success: false, error: 'Shop not authenticated' });
    }

    const ids = items.map(i => `gid://shopify/ProductVariant/${i.variantId}`);
    const query = `
      query CartPreview($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on ProductVariant {
            id
            title
            price
            image { url }
            product { title handle featuredImage { url } }
          }
        }
      }
    `;
    const response = await fetch(
      `https://${shop}/admin/api/${process.env.SHOPIFY_API_VERSION || '2024-01'}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': shopData.accessToken
        },
        body: JSON.stringify({ query, variables: { ids } })
      }
    );
    const data = await response.json();
    if (data.errors) {
      console.error('Cart preview GraphQL errors:', data.errors);
      return res.status(500).json({ success: false, error: 'Failed to fetch product details' });
    }

    const nodes = data.data?.nodes || [];
    const products = items.map((item, index) => {
      const node = nodes[index];
      if (!node || !node.id) {
        return { variantId: item.variantId, quantity: item.quantity, title: 'Unknown', price: '0', imageUrl: null, productHandle: null };
      }
      const gid = node.id.replace('gid://shopify/ProductVariant/', '');
      let imageUrl = node.image?.url || node.product?.featuredImage?.url || null;
      if (imageUrl && imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
      return {
        variantId: gid,
        quantity: item.quantity,
        title: node.title || node.product?.title || 'Product',
        price: node.price,
        imageUrl,
        productTitle: node.product?.title || '',
        productHandle: node.product?.handle || null
      };
    });

    res.json({ success: true, products });
  } catch (error) {
    console.error('Error in cart preview:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get lifetime customers for an affiliate (paginated)
 * GET /api/affiliates/customer/:customerId/lifetime-customers?shop=...&email=...&page=1&limit=20
 * GET /api/affiliates/:affiliateId/lifetime-customers?page=1&limit=20
 */
const getLifetimeCustomersController = async (req, res, db) => {
  try {
    const { affiliateId, customerId } = req.params;
    const { shop, email, page: pageStr, limit: limitStr } = req.query;

    let affiliate;
    if (customerId && customerId !== 'customer') {
      if (!shop) {
        return res.status(400).json({ success: false, error: 'Shop parameter is required' });
      }
      if (!email) {
        return res.status(401).json({ success: false, error: 'Email is required for authentication' });
      }
      affiliate = await getAffiliateByCustomerId(db, customerId, shop);
      if (affiliate && affiliate.email !== email) {
        return res.status(403).json({ success: false, error: 'Unauthorized: Email does not match' });
      }
    } else {
      affiliate = await getAffiliateById(db, affiliateId);
    }

    if (!affiliate) {
      return res.status(404).json({ success: false, error: 'Affiliate not found' });
    }

    const result = await getLifetimeCustomers(db, affiliate._id.toString(), {
      page: pageStr,
      limit: limitStr
    });

    return res.json({
      success: true,
      customers: result.customers,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages
    });
  } catch (error) {
    console.error('Error fetching lifetime customers:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch lifetime customers',
      message: error.message
    });
  }
};

/**
 * Get affiliate area config for storefront (greeting message, commission rate set by admin)
 * GET /api/affiliates/area-config?shop=...
 * Returns { success, greetingMessage, commissionRate } - public, no auth
 */
const getAffiliateAreaConfig = async (req, res, db) => {
  try {
    const { shop } = req.query;
    if (!shop) {
      return res.json({ success: true, greetingMessage: '', commissionRate: 0.1 });
    }
    const [greetingDoc, commissionRate] = await Promise.all([
      db.collection('admin_settings').findOne({ shop, setting: 'affiliateAreaGreeting' }),
      getStoreCommissionRate(db, shop)
    ]);
    const greetingMessage = (greetingDoc && greetingDoc.value != null) ? String(greetingDoc.value) : '';
    return res.json({ success: true, greetingMessage, commissionRate });
  } catch (err) {
    console.error('getAffiliateAreaConfig error:', err);
    return res.json({ success: true, greetingMessage: '', commissionRate: 0.1 });
  }
};

/**
 * GET /api/affiliates/discounts?shop=...&first=50&query=...
 * Fetch discount codes from the store (Shopify Discount API). Requires shop to be authenticated.
 */
const getAffiliateDiscounts = async (req, res, db) => {
  try {
    const { shop, first, query } = req.query;
    if (!shop || typeof shop !== 'string' || !shop.trim()) {
      return res.status(400).json({ success: false, error: 'shop is required' });
    }
    const shopData = await db.collection('shops').findOne({ shop: shop.trim() });
    if (!shopData || !shopData.accessToken) {
      return res.status(401).json({ success: false, error: 'Shop not authenticated' });
    }
    const { getDiscountCodes } = require('../services/affiliateDiscountService');
    const list = await getDiscountCodes(shopData.shop || shop, shopData.accessToken, { first, query });
    return res.json({ success: true, discounts: list });
  } catch (err) {
    console.error('getAffiliateDiscounts error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch discounts' });
  }
};

/**
 * POST /api/affiliates/discounts
 * Body: { shop, code, title, percentage, usageLimit?, appliesOncePerCustomer? }
 * Create a discount code on the store (Shopify Discount API).
 */
const createAffiliateDiscount = async (req, res, db) => {
  try {
    const { shop, code, title, percentage, usageLimit, appliesOncePerCustomer } = req.body || {};
    if (!shop || typeof shop !== 'string' || !shop.trim()) {
      return res.status(400).json({ success: false, error: 'shop is required' });
    }
    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ success: false, error: 'code is required' });
    }
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ success: false, error: 'title is required' });
    }
    const pct = Number(percentage);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      return res.status(400).json({ success: false, error: 'percentage must be 0–100' });
    }
    const shopData = await db.collection('shops').findOne({ shop: shop.trim() });
    if (!shopData || !shopData.accessToken) {
      return res.status(401).json({ success: false, error: 'Shop not authenticated' });
    }
    const { createDiscountCode } = require('../services/affiliateDiscountService');
    const result = await createDiscountCode(shopData.shop || shop, shopData.accessToken, {
      code: code.trim(),
      title: title.trim(),
      percentage: pct,
      usageLimit: usageLimit != null ? Number(usageLimit) : undefined,
      appliesOncePerCustomer: appliesOncePerCustomer !== false
    });
    return res.json({ success: true, discount: result });
  } catch (err) {
    console.error('createAffiliateDiscount error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to create discount' });
  }
};

const AFFILIATE_SHARE_CODES_COLLECTION = 'affiliate_share_discount_codes';

const SHARE_CART_DISCOUNT_TIERS = [0, 5, 10, 15, 20];

/**
 * POST /api/affiliates/discounts/create-single-use
 * Body: { shop, affiliateId [, percentage] } or { shop, customerId, email [, percentage] } (storefront)
 * percentage (optional): 0, 5, 10, 15, 20. If provided, use it for this code; if 0, returns no code.
 * If not provided, uses affiliate's shareCartDiscountPercent (requires share cart discount enabled).
 */
const createSingleUseAffiliateDiscount = async (req, res, db) => {
  try {
    const body = req.body || {};
    const shop = typeof body.shop === 'string' ? body.shop.trim() : '';
    if (!shop) {
      return res.status(400).json({ success: false, error: 'shop is required' });
    }

    let affiliate = null;
    if (body.affiliateId) {
      if (!ObjectId.isValid(body.affiliateId)) {
        return res.status(400).json({ success: false, error: 'Invalid affiliateId' });
      }
      affiliate = await db.collection('affiliates').findOne({ _id: new ObjectId(body.affiliateId), shop });
    } else if (body.customerId && body.email) {
      affiliate = await getAffiliateByCustomerId(db, body.customerId, shop);
      if (affiliate && affiliate.email !== body.email.trim()) {
        affiliate = null;
      }
    }
    if (!affiliate) {
      return res.status(404).json({ success: false, error: 'Affiliate not found' });
    }

    let percentage;
    if (body.percentage !== undefined && body.percentage !== null) {
      const requested = Number(body.percentage);
      if (!SHARE_CART_DISCOUNT_TIERS.includes(requested)) {
        return res.status(400).json({ success: false, error: 'percentage must be one of: 0, 5, 10, 15, 20' });
      }
      percentage = requested;
    } else {
      const enabled = !!affiliate.settings?.shareCartDiscountEnabled;
      percentage = affiliate.settings?.shareCartDiscountPercent ?? 0;
      if (!enabled || percentage <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Share cart discount is disabled or set to 0%. Enable it in Settings or choose a tier in the modal.'
        });
      }
    }

    if (percentage <= 0) {
      return res.json({ success: true, code: null, percentage: 0, message: 'No discount applied to this share link.' });
    }

    const shopData = await db.collection('shops').findOne({ shop });
    if (!shopData || !shopData.accessToken) {
      return res.status(401).json({ success: false, error: 'Shop not authenticated' });
    }

    const { createSingleUseDiscountCode } = require('../services/affiliateDiscountService');
    const title = `Affiliate share ${percentage}% off`;
    const result = await createSingleUseDiscountCode(shopData.shop || shop, shopData.accessToken, {
      title,
      percentage
    });

    const doc = {
      shop,
      affiliateId: affiliate._id.toString(),
      code: result.code,
      shopifyDiscountId: result.id,
      percentage,
      createdAt: new Date()
    };
    await db.collection(AFFILIATE_SHARE_CODES_COLLECTION).insertOne(doc);

    return res.json({
      success: true,
      code: result.code,
      discountId: result.id,
      percentage,
      message: 'Single-use code created. Add to share URL as ?discount=' + result.code
    });
  } catch (err) {
    console.error('createSingleUseAffiliateDiscount error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to create single-use discount' });
  }
};

/**
 * GET /api/affiliates/discounts/created?shop=...&affiliateId=...&limit=50
 * Fetch single-use discount codes created by the app (from our DB), optionally by affiliate.
 * Lets affiliates see which codes were generated for their share links.
 */
const getAffiliateShareDiscountsCreated = async (req, res, db) => {
  try {
    const { shop, affiliateId, limit } = req.query;
    if (!shop || typeof shop !== 'string' || !shop.trim()) {
      return res.status(400).json({ success: false, error: 'shop is required' });
    }

    const query = { shop: shop.trim() };
    if (affiliateId && typeof affiliateId === 'string' && affiliateId.trim()) {
      if (ObjectId.isValid(affiliateId)) {
        query.affiliateId = affiliateId.trim();
      }
    }

    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const list = await db
      .collection(AFFILIATE_SHARE_CODES_COLLECTION)
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .toArray();

    let statusMap = {};
    const shopifyIds = list.map((d) => d.shopifyDiscountId).filter((id) => id && String(id).trim().startsWith('gid://'));
    if (shopifyIds.length > 0) {
      const shopData = await db.collection('shops').findOne({ shop: shop.trim() });
      if (shopData && shopData.accessToken) {
        try {
          const { getDiscountStatusByIds } = require('../services/affiliateDiscountService');
          statusMap = await getDiscountStatusByIds(shopData.shop || shop.trim(), shopData.accessToken, shopifyIds);
        } catch (err) {
          console.warn('getAffiliateShareDiscountsCreated: could not fetch status from Shopify', err.message);
        }
      }
    }

    const items = list.map((d) => {
      const shopifyStatus = d.shopifyDiscountId ? statusMap[d.shopifyDiscountId] : undefined;
      const status = shopifyStatus !== undefined ? shopifyStatus : (d.status || 'active');
      return {
        id: d._id?.toString(),
        code: d.code,
        shopifyDiscountId: d.shopifyDiscountId,
        percentage: d.percentage,
        affiliateId: d.affiliateId,
        status,
        deactivatedAt: d.deactivatedAt,
        createdAt: d.createdAt
      };
    });

    return res.json({ success: true, discounts: items });
  } catch (err) {
    console.error('getAffiliateShareDiscountsCreated error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch created discounts' });
  }
};

/**
 * DELETE /api/affiliates/discounts/created/:id?shop=...&affiliateId=... or ?shop=...&customerId=...&email=...
 * Deactivate the discount code on Shopify and mark the record as deactivated (keep in list).
 */
const deleteAffiliateShareDiscount = async (req, res, db) => {
  try {
    const { id } = req.params;
    const { shop, affiliateId, customerId, email } = req.query;

    const shopParam = shop && typeof shop === 'string' ? shop.trim() : '';
    if (!shopParam) {
      return res.status(400).json({ success: false, error: 'shop is required' });
    }
    if (!id || !ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid discount id' });
    }

    let affiliate = null;
    if (affiliateId) {
      if (!ObjectId.isValid(affiliateId)) {
        return res.status(400).json({ success: false, error: 'Invalid affiliateId' });
      }
      affiliate = await db.collection('affiliates').findOne({ _id: new ObjectId(affiliateId), shop: shopParam });
    } else if (customerId && email) {
      affiliate = await getAffiliateByCustomerId(db, customerId, shopParam);
      if (affiliate && affiliate.email !== email.trim()) affiliate = null;
    }
    if (!affiliate) {
      return res.status(404).json({ success: false, error: 'Affiliate not found' });
    }

    const doc = await db.collection(AFFILIATE_SHARE_CODES_COLLECTION).findOne({
      _id: new ObjectId(id),
      shop: shopParam,
      affiliateId: affiliate._id.toString()
    });
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Discount not found or not owned by you' });
    }
    if (doc.status === 'deactivated') {
      return res.json({ success: true, message: 'Discount already deactivated' });
    }

    const shopifyId = doc.shopifyDiscountId;
    if (shopifyId) {
      const shopData = await db.collection('shops').findOne({ shop: shopParam });
      if (shopData && shopData.accessToken) {
        const { deactivateDiscountCode } = require('../services/affiliateDiscountService');
        await deactivateDiscountCode(shopData.shop || shopParam, shopData.accessToken, shopifyId);
      }
    }

    await db.collection(AFFILIATE_SHARE_CODES_COLLECTION).updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'deactivated', deactivatedAt: new Date(), updatedAt: new Date() } }
    );

    return res.json({ success: true, message: 'Discount deactivated' });
  } catch (err) {
    console.error('deleteAffiliateShareDiscount error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to delete discount' });
  }
};

module.exports = {
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
};
