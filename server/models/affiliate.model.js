/**
 * Affiliate Model
 * Manages affiliate profile data, referral links, and earnings
 */

const { ObjectId } = require('mongodb');

/**
 * Create a new affiliate profile
 * @param {Object} db - MongoDB database connection
 * @param {Object} affiliateData - Affiliate data
 * @returns {Promise<Object>} Created affiliate document
 */
const createAffiliateProfile = async (db, affiliateData) => {
  const name = affiliateData.name != null && String(affiliateData.name).trim()
    ? String(affiliateData.name).trim()
    : [affiliateData.firstName, affiliateData.lastName].filter(Boolean).join(' ').trim() || undefined;
  const affiliate = {
    customerId: affiliateData.customerId,
    shop: affiliateData.shop,
    email: affiliateData.email,
    name: name || undefined,
    firstName: (affiliateData.firstName && String(affiliateData.firstName).trim()) ? String(affiliateData.firstName).trim() : undefined,
    lastName: (affiliateData.lastName && String(affiliateData.lastName).trim()) ? String(affiliateData.lastName).trim() : undefined,
    paymentEmail: affiliateData.paymentEmail || undefined, // PayPal/payment email from affiliate form
    status: 'pending', // pending (until admin approves) | active | suspended | deactivated
    referralLinks: [], // Array of referral links
    productAssociations: [], // Array of product IDs associated with affiliate
    settings: {
      shareCartEnabled: false, // Enable/disable cart sharing feature
      trackCartProducts: true, // Track products in shared carts
      cartShareExpiryDays: 30, // Cart share link expiry
      // Affiliate-funded customer discount (share cart): 0, 5, 10, 15, 20 %
      shareCartDiscountEnabled: false,
      shareCartDiscountPercent: 0 // 0 | 5 | 10 | 15 | 20
    },
    earnings: {
      total: 0,
      pending: 0,
      paid: 0,
      currency: 'USD'
    },
    stats: {
      totalClicks: 0,
      totalConversions: 0,
      totalRevenue: 0,
      conversionRate: 0
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const result = await db.collection('affiliates').insertOne(affiliate);
  return { ...affiliate, _id: result.insertedId };
};

/**
 * Get affiliate profile by customer ID
 * @param {Object} db - MongoDB database
 * @param {string} customerId - Shopify customer ID
 * @param {string} shop - Shop name
 * @returns {Promise<Object|null>} Affiliate document or null
 */
const getAffiliateByCustomerId = async (db, customerId, shop) => {
  // Convert customerId to both number and string to handle type mismatches
  const customerIdNum = parseInt(customerId, 10);
  const customerIdStr = String(customerId);
  
  return await db.collection('affiliates').findOne({
    shop,
    $or: [
      { customerId: customerIdNum },
      { customerId: customerIdStr }
    ]
  });
};

/**
 * Get affiliate by ID
 * @param {Object} db - MongoDB database
 * @param {string} affiliateId - Affiliate MongoDB ID
 * @returns {Promise<Object|null>} Affiliate document or null
 */
const getAffiliateById = async (db, affiliateId) => {
  try {
    return await db.collection('affiliates').findOne({
      _id: new ObjectId(affiliateId)
    });
  } catch (e) {
    return null;
  }
};

/**
 * Update affiliate profile details
 * @param {Object} db - MongoDB database
 * @param {string} affiliateId - Affiliate MongoDB ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated affiliate document
 */
const updateAffiliateDetails = async (db, affiliateId, updateData) => {
  const { ObjectId } = require('mongodb');
  
  const update = {
    $set: {
      ...updateData,
      updatedAt: new Date()
    }
  };

  const result = await db.collection('affiliates').findOneAndUpdate(
    { _id: new ObjectId(affiliateId) },
    update,
    { returnDocument: 'after' }
  );

  // Driver 6.x returns the document directly; older drivers use result.value
  return result && (result.value !== undefined ? result.value : result);
};

/**
 * Delete / Deactivate affiliate
 * @param {Object} db - MongoDB database
 * @param {string} affiliateId - Affiliate MongoDB ID
 * @param {boolean} hardDelete - If true, deletes; if false, deactivates
 * @returns {Promise<boolean>} Success status
 */
const deleteAffiliate = async (db, affiliateId, hardDelete = false) => {
  const { ObjectId } = require('mongodb');

  if (hardDelete) {
    const result = await db.collection('affiliates').deleteOne({
      _id: new ObjectId(affiliateId)
    });
    return result.deletedCount > 0;
  } else {
    const result = await db.collection('affiliates').updateOne(
      { _id: new ObjectId(affiliateId) },
      {
        $set: {
          status: 'deactivated',
          updatedAt: new Date()
        }
      }
    );
    return result.modifiedCount > 0;
  }
};

/** Max number of referral links to keep per affiliate (current + replaced) to avoid unbounded growth */
const REFERRAL_LINKS_HISTORY_CAP = 10;

/**
 * Create a new referral link
 * When replacePrimary: true, prepends the new link and marks existing links as 'replaced'.
 * Old links are kept so visits, clicks, and conversions remain queryable and stats are preserved.
 * @param {Object} db - MongoDB database
 * @param {string} affiliateId - Affiliate MongoDB ID
 * @param {Object} linkData - Link configuration
 * @param {Object} options - { replacePrimary: true } to add new link as primary and archive old ones
 * @returns {Promise<Object>} Created referral link
 */
const createReferralLink = async (db, affiliateId, linkData, options = {}) => {
  const { ObjectId } = require('mongodb');
  
  const shortCode = generateShortCode();
  const backendUrl = process.env.HOST || 'https://rooms-autos-aware-anyone.trycloudflare.com';
  const referralUrl = `${backendUrl.replace(/\/+$/, '')}/ref=${shortCode}`;

  const newLink = {
    _id: new ObjectId(),
    shortCode,
    url: linkData.url || referralUrl,
    productIds: linkData.productIds || [],
    productVariantIds: linkData.productVariantIds || [],
    description: linkData.description || '',
    status: 'active',
    stats: { clicks: 0, conversions: 0, revenue: 0 },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const replacePrimary = options.replacePrimary === true;

  if (replacePrimary) {
    const affiliate = await db.collection('affiliates').findOne(
      { _id: new ObjectId(affiliateId) },
      { projection: { referralLinks: 1 } }
    );
    const existing = (affiliate && affiliate.referralLinks) || [];
    const archived = existing.map((l) => ({
      ...l,
      status: 'replaced',
      updatedAt: new Date()
    }));
    const newReferralLinks = [newLink, ...archived].slice(0, REFERRAL_LINKS_HISTORY_CAP);

    await db.collection('affiliates').updateOne(
      { _id: new ObjectId(affiliateId) },
      { $set: { referralLinks: newReferralLinks, updatedAt: new Date() } }
    );
    return newLink;
  }

  await db.collection('affiliates').updateOne(
    { _id: new ObjectId(affiliateId) },
    { $push: { referralLinks: newLink }, $set: { updatedAt: new Date() } }
  );
  return newLink;
};

/**
 * Generate unique short code for referral link
 * @returns {string} Short code
 */
const generateShortCode = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * Track referral click
 * @param {Object} db - MongoDB database
 * @param {string} shortCode - Referral link short code
 * @param {Object} metadata - Click metadata (IP, user agent, etc.)
 * @returns {Promise<string>} Inserted click _id as string (for visitId in redirect/cart)
 */
const trackReferralClick = async (db, shortCode, metadata = {}) => {
  const affiliate = await db.collection('affiliates').findOne(
    { 'referralLinks.shortCode': shortCode },
    { projection: { _id: 1 } }
  );
  const affiliateId = affiliate ? affiliate._id.toString() : null;

  const clickRecord = {
    _id: new ObjectId(),
    shortCode,
    affiliateId,
    timestamp: new Date(),
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
    referrer: metadata.referrer
  };

  await db.collection('referral_clicks').insertOne(clickRecord);

  await db.collection('affiliates').updateOne(
    { 'referralLinks.shortCode': shortCode },
    {
      $inc: {
        'referralLinks.$.stats.clicks': 1,
        'stats.totalClicks': 1
      },
      $set: { updatedAt: new Date() }
    }
  );

  return clickRecord._id.toString();
};

/**
 * Normalize email for comparison (trim, lowercase). Returns '' if falsy.
 * @param {string} email
 * @returns {string}
 */
function normalizeEmail(email) {
  if (email == null || typeof email !== 'string') return '';
  return String(email).trim().toLowerCase();
}

/**
 * Track referral conversion
 * @param {Object} db - MongoDB database
 * @param {string} shortCode - Referral link short code
 * @param {Object} conversionData - Order/conversion data
 * @returns {Promise<{ inserted: boolean, affiliate?: Object }>} inserted true when a new conversion was recorded; affiliate present when inserted and affiliate found (for notifications)
 */
const trackReferralConversion = async (db, shortCode, conversionData) => {
  const orderId = String(conversionData.orderId);
  const amount = parseFloat(conversionData.amount) || 0;
  const currency = conversionData.currency || 'USD';
  const visitId = conversionData.visitId ? String(conversionData.visitId) : null;
  const productNames = Array.isArray(conversionData.productNames) ? conversionData.productNames : [];
  const orderDisplay = conversionData.orderDisplay ? String(conversionData.orderDisplay).trim() : null;
  const customerEmail = (conversionData.customerEmail && String(conversionData.customerEmail).trim()) || '';

  // Resolve affiliate first for self-referral check and later stats update
  const affiliate = await db.collection('affiliates').findOne({
    'referralLinks.shortCode': shortCode
  });

  // Self-referral: do not attribute order to affiliate when purchaser email matches affiliate email (same person used their own link)
  if (affiliate && customerEmail) {
    const affiliateEmailNorm = normalizeEmail(affiliate.email);
    const orderEmailNorm = normalizeEmail(customerEmail);
    if (affiliateEmailNorm && orderEmailNorm && affiliateEmailNorm === orderEmailNorm) {
      return { inserted: false, reason: 'self_referral' };
    }
  }

  // Commission rate: request body > per-affiliate setting > store default > 10%
  let commissionRate = conversionData.commissionRate;
  if (commissionRate == null && affiliate?.settings?.commissionRate != null) {
    commissionRate = parseFloat(affiliate.settings.commissionRate);
  }
  if (commissionRate == null && affiliate?.shop) {
    commissionRate = await getStoreCommissionRate(db, affiliate.shop);
  }
  if (commissionRate == null || Number.isNaN(commissionRate) || commissionRate < 0 || commissionRate > 1) {
    commissionRate = DEFAULT_COMMISSION_RATE;
  }
  const commissionAmount = amount * commissionRate;

  const doc = {
    shortCode,
    orderId,
    amount,
    currency,
    commissionRate,
    commissionAmount,
    timestamp: new Date(),
    status: 'pending',
    customerEmail: customerEmail || '',
    customerName: conversionData.customerName || '',
    customerPhone: conversionData.customerPhone || ''
  };
  if (visitId) doc.visitId = visitId;
  if (productNames.length) doc.productNames = productNames;
  if (orderDisplay) doc.orderDisplay = orderDisplay;

  // Atomic upsert: insert only when no document with this orderId exists (prevents duplicates even if webhook delivered twice)
  const result = await db.collection('referral_conversions').updateOne(
    { orderId },
    { $setOnInsert: doc },
    { upsert: true }
  );

  // Only update affiliate stats when we actually inserted (first time we see this order)
  if (result.upsertedCount !== 1) {
    return { inserted: false, reason: 'duplicate' };
  }

  if (affiliate) {
    await db.collection('affiliates').updateOne(
      { 'referralLinks.shortCode': shortCode },
      {
        $inc: {
          'referralLinks.$.stats.conversions': 1,
          'referralLinks.$.stats.revenue': amount,
          'stats.totalConversions': 1,
          'stats.totalRevenue': amount,
          'earnings.pending': commissionAmount
        },
        $set: { updatedAt: new Date() }
      }
    );
  }

  return { inserted: true, affiliate: affiliate || null, commissionAmount };
};

/**
 * Calculate affiliate earnings
 * @param {Object} db - MongoDB database
 * @param {string} affiliateId - Affiliate MongoDB ID
 * @returns {Promise<Object>} Earnings summary
 */
const calculateEarnings = async (db, affiliateId) => {
  const { ObjectId } = require('mongodb');

  const affiliate = await db.collection('affiliates').findOne({
    _id: new ObjectId(affiliateId)
  });

  if (!affiliate) return null;

  // Get all conversions for this affiliate
  // Query by referral shortCodes OR by customer ID (for legacy conversions)
  const conversions = await db.collection('referral_conversions').find({
    $or: [
      { shortCode: { $in: affiliate.referralLinks.map(l => l.shortCode) } },
      { shortCode: affiliate.customerId.toString() } // Legacy conversions with customer ID
    ]
  }).toArray();

  const earnings = {
    total: affiliate.earnings.total || 0,
    pending: affiliate.earnings.pending || 0,
    paid: affiliate.earnings.paid || 0,
    conversionDetails: conversions
  };

  return earnings;
};

/**
 * Get all affiliate analytics
 * @param {Object} db - MongoDB database
 * @param {string} affiliateId - Affiliate MongoDB ID
 * @returns {Promise<Object>} Analytics summary
 */
const getAffiliateAnalytics = async (db, affiliateId) => {
  const { ObjectId } = require('mongodb');

  const affiliate = await db.collection('affiliates').findOne({
    _id: new ObjectId(affiliateId)
  });

  if (!affiliate) return null;

  // Get click records
  const clicks = await db.collection('referral_clicks').find({
    shortCode: { $in: affiliate.referralLinks.map(l => l.shortCode) }
  }).toArray();

  // Get conversion records (by referral shortCodes OR customer ID for legacy conversions)
  const conversionsRaw = await db.collection('referral_conversions').find({
    $or: [
      { shortCode: { $in: affiliate.referralLinks.map(l => l.shortCode) } },
      { shortCode: affiliate.customerId.toString() } // Legacy conversions with customer ID
    ]
  }).toArray();

  // Dedupe by orderId so one order = one conversion (handles legacy duplicate records)
  const seenOrderIds = new Set();
  const conversions = conversionsRaw.filter((c) => {
    const id = String(c.orderId);
    if (seenOrderIds.has(id)) return false;
    seenOrderIds.add(id);
    return true;
  });

  // Per-link stats (deduped): one order = one conversion per link
  const linkStatsByShortCode = {};
  for (const link of affiliate.referralLinks || []) {
    linkStatsByShortCode[link.shortCode] = { conversions: 0, revenue: 0 };
  }
  for (const c of conversions) {
    const sc = c.shortCode;
    if (linkStatsByShortCode[sc] != null) {
      linkStatsByShortCode[sc].conversions += 1;
      linkStatsByShortCode[sc].revenue += parseFloat(c.amount) || 0;
    }
  }

  // Calculate conversion rate
  const totalClicks = clicks.length;
  const totalConversions = conversions.length;
  const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
  const totalRevenue = conversions.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
  const currency = conversions.length > 0 ? (conversions[0].currency || 'USD') : (affiliate.earnings?.currency || 'USD');

  return {
    affiliateId: affiliateId,
    referralLinks: affiliate.referralLinks,
    linkStatsByShortCode,
    totalClicks,
    totalConversions,
    conversionRate: conversionRate.toFixed(2),
    totalRevenue,
    currency,
    earnings: affiliate.earnings,
    stats: affiliate.stats
  };
};

/**
 * Update affiliate settings
 * @param {Object} db - MongoDB database
 * @param {string} affiliateId - Affiliate MongoDB ID
 * @param {Object} settingsData - Settings to update
 * @returns {Promise<Object>} Updated settings
 */
const updateAffiliateSettings = async (db, affiliateId, settingsData) => {
  const { ObjectId } = require('mongodb');

  const updateObj = {
    $set: {
      settings: {
        ...settingsData,
      },
      updatedAt: new Date()
    }
  };

  const result = await db.collection('affiliates').findOneAndUpdate(
    { _id: new ObjectId(affiliateId) },
    updateObj,
    { returnDocument: 'after' }
  );

  const doc = result && (result.value !== undefined ? result.value : result);
  return doc?.settings || null;
};

/**
 * Get affiliate settings
 * @param {Object} db - MongoDB database
 * @param {string} affiliateId - Affiliate MongoDB ID
 * @returns {Promise<Object|null>} Affiliate settings
 */
const getAffiliateSettings = async (db, affiliateId) => {
  const { ObjectId } = require('mongodb');

  const affiliate = await db.collection('affiliates').findOne({
    _id: new ObjectId(affiliateId)
  });

  return affiliate?.settings || null;
};

/**
 * Store cart share with affiliate tracking
 * @param {Object} db - MongoDB database
 * @param {string} affiliateId - Affiliate MongoDB ID
 * @param {Object} cartData - Cart data (items, customer, etc.)
 * @returns {Promise<Object>} Created cart share document with shareId
 */
const storeCartShare = async (db, affiliateId, cartData) => {
  const { ObjectId } = require('mongodb');

  const cartShare = {
    _id: new ObjectId(),
    affiliateId: new ObjectId(affiliateId),
    cartData,
    products: cartData.items || [], // Store product items
    expiresAt: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)), // 30 days expiry
    clicks: 0,
    conversions: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const result = await db.collection('affiliate_cart_shares').insertOne(cartShare);
  return { ...cartShare, _id: result.insertedId };
};

/**
 * Get cart share by ID
 * @param {Object} db - MongoDB database
 * @param {string} shareId - Cart share ID
 * @returns {Promise<Object|null>} Cart share document or null
 */
const getCartShareById = async (db, shareId) => {
  const { ObjectId } = require('mongodb');
  try {
    return await db.collection('affiliate_cart_shares').findOne({
      _id: new ObjectId(shareId)
    });
  } catch (e) {
    return null;
  }
};

/**
 * Track cart share click
 * @param {Object} db - MongoDB database
 * @param {string} shareId - Cart share ID
 * @returns {Promise<void>}
 */
const trackCartShareClick = async (db, shareId) => {
  const { ObjectId } = require('mongodb');
  await db.collection('affiliate_cart_shares').updateOne(
    { _id: new ObjectId(shareId) },
    {
      $inc: { clicks: 1 },
      $set: { updatedAt: new Date() }
    }
  );
};

/**
 * Get lifetime customers for an affiliate (unique customers who converted via their referral links)
 * Aggregates referral_conversions by customer email; supports pagination.
 * @param {Object} db - MongoDB database
 * @param {string} affiliateId - Affiliate MongoDB ID
 * @param {Object} options - { page: 1, limit: 20 }
 * @returns {Promise<{ customers: Array, total: number, page: number, limit: number, totalPages: number }>}
 */
const getLifetimeCustomers = async (db, affiliateId, options = {}) => {
  const { ObjectId } = require('mongodb');
  const page = Math.max(1, parseInt(options.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(options.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const affiliate = await db.collection('affiliates').findOne(
    { _id: new ObjectId(affiliateId) },
    { projection: { referralLinks: 1 } }
  );
  if (!affiliate || !affiliate.referralLinks || affiliate.referralLinks.length === 0) {
    return { customers: [], total: 0, page: 1, limit, totalPages: 0 };
  }

  const shortCodes = affiliate.referralLinks.map((l) => l.shortCode);

  const pipeline = [
    { $match: { shortCode: { $in: shortCodes } } },
    {
      $group: {
        _id: { $toLower: { $ifNull: ['$customerEmail', ''] } },
        firstOrderDate: { $min: '$timestamp' },
        orderCount: { $sum: 1 },
        totalRevenue: { $sum: '$amount' },
        customerEmail: { $first: '$customerEmail' },
        customerName: { $first: '$customerName' },
        currency: { $first: '$currency' }
      }
    },
    {
      $facet: {
        total: [{ $count: 'count' }],
        data: [
          { $sort: { firstOrderDate: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 0,
              customerEmail: 1,
              customerName: 1,
              firstOrderDate: 1,
              orderCount: 1,
              totalRevenue: 1,
              currency: 1
            }
          }
        ]
      }
    }
  ];

  const result = await db.collection('referral_conversions').aggregate(pipeline).toArray();
  const facet = result[0] || { total: [], data: [] };
  const total = (facet.total[0] && facet.total[0].count) || 0;
  const customers = (facet.data || []).map((c) => ({
    customerEmail: c.customerEmail && String(c.customerEmail).trim() ? c.customerEmail : '—',
    customerName: (c.customerName && String(c.customerName).trim()) || '—',
    firstOrderDate: c.firstOrderDate,
    orderCount: c.orderCount || 0,
    totalRevenue: parseFloat(c.totalRevenue) || 0,
    currency: c.currency || 'USD'
  }));

  const totalPages = Math.ceil(total / limit) || 0;
  return { customers, total, page, limit, totalPages };
};

/**
 * Remove existing self-referral conversions (where order customer email matches affiliate email) and reverse affiliate stats.
 * Call once to clean up conversions that were recorded before the self-referral guard was in place.
 * @param {Object} db - MongoDB database
 * @returns {Promise<{ removed: number, orderIds: string[] }>}
 */
const removeSelfReferralConversions = async (db) => {
  const conversions = await db.collection('referral_conversions').find({}).toArray();
  const orderIds = [];

  for (const conv of conversions) {
    const shortCode = conv.shortCode;
    const customerEmailNorm = normalizeEmail(conv.customerEmail);
    if (!customerEmailNorm) continue;

    const affiliate = await db.collection('affiliates').findOne({
      'referralLinks.shortCode': shortCode
    });
    if (!affiliate || !affiliate.email) continue;

    const affiliateEmailNorm = normalizeEmail(affiliate.email);
    if (affiliateEmailNorm !== customerEmailNorm) continue;

    // Self-referral: remove conversion and reverse stats
    const amount = parseFloat(conv.amount) || 0;
    const commissionAmount = parseFloat(conv.commissionAmount) || amount * (conv.commissionRate ?? 0.1);

    await db.collection('referral_conversions').deleteOne({ orderId: conv.orderId });
    orderIds.push(conv.orderId);

    await db.collection('affiliates').updateOne(
      { 'referralLinks.shortCode': shortCode },
      {
        $inc: {
          'referralLinks.$.stats.conversions': -1,
          'referralLinks.$.stats.revenue': -amount,
          'stats.totalConversions': -1,
          'stats.totalRevenue': -amount,
          'earnings.pending': -commissionAmount
        },
        $set: { updatedAt: new Date() }
      }
    );
  }

  return { removed: orderIds.length, orderIds };
};

/** Default commission rate when not set (10%) */
const DEFAULT_COMMISSION_RATE = 0.1;

/**
 * Get store-level affiliate commission rate from admin_settings.
 * @param {Object} db - MongoDB database
 * @param {string} shop - Shop domain
 * @returns {Promise<number>} Rate between 0 and 1 (e.g. 0.1 = 10%)
 */
const getStoreCommissionRate = async (db, shop) => {
  if (!shop || typeof shop !== 'string') return DEFAULT_COMMISSION_RATE;
  const doc = await db.collection('admin_settings').findOne({
    shop: shop.trim(),
    setting: 'affiliateCommissionRate'
  });
  const val = doc?.value;
  if (val == null) return DEFAULT_COMMISSION_RATE;
  const rate = parseFloat(val);
  if (Number.isNaN(rate) || rate < 0 || rate > 1) return DEFAULT_COMMISSION_RATE;
  return rate;
};

module.exports = {
  createAffiliateProfile,
  getAffiliateByCustomerId,
  getAffiliateById,
  updateAffiliateDetails,
  deleteAffiliate,
  createReferralLink,
  generateShortCode,
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
  getLifetimeCustomers,
  removeSelfReferralConversions
};
