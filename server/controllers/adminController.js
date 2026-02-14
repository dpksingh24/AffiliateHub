/**
 * Admin Controller
 * Handles admin-level operations like share cart feature management and email templates
 */

const { ObjectId } = require('mongodb');
const { getEmailTemplates, putEmailTemplates } = require('../services/emailTemplates');
const { extractEmailFromSubmission, extractNameFromSubmission, extractFirstAndLastNameFromSubmission } = require('./affiliateFormSubmissonController');

/**
 * Get share cart status
 * GET /api/admin/share-cart/status
 */
const getShareCartStatus = async (req, res, db) => {
  try {
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({
        success: false,
        error: 'shop parameter is required'
      });
    }

    // Check if admin has enabled share cart
    const adminSettings = await db.collection('admin_settings').findOne({
      shop,
      setting: 'shareCartEnabled'
    });

    const enabled = adminSettings?.value || false;
    const cartExpiryDays = adminSettings?.cartExpiryDays || 30;

    res.json({
      success: true,
      enabled,
      cartExpiryDays,
      updatedAt: adminSettings?.updatedAt || null
    });
  } catch (error) {
    console.error('Error fetching share cart status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch status',
      message: error.message
    });
  }
};

/**
 * Enable/Disable share cart feature
 * POST /api/admin/share-cart/enable
 * Body: { shop: 'store-name', enabled: true/false, cartExpiryDays: 30 }
 */
const enableShareCart = async (req, res, db) => {
  try {
    const { shop, enabled = true, cartExpiryDays = 30 } = req.body;

    if (!shop) {
      return res.status(400).json({
        success: false,
        error: 'shop is required'
      });
    }

    // Update admin settings
    await db.collection('admin_settings').updateOne(
      { shop, setting: 'shareCartEnabled' },
      {
        $set: {
          shop,
          setting: 'shareCartEnabled',
          value: enabled,
          cartExpiryDays: enabled ? cartExpiryDays : 0,
          enabledAt: enabled ? new Date() : null,
          disabledAt: !enabled ? new Date() : null,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    // Update all affiliates for this shop
    await db.collection('affiliates').updateMany(
      { shop },
      {
        $set: {
          'settings.shareCartEnabled': enabled,
          'settings.cartShareExpiryDays': cartExpiryDays,
          updatedAt: new Date()
        }
      }
    );

    res.json({
      success: true,
      message: `Share Cart feature ${enabled ? 'enabled' : 'disabled'} successfully!`,
      enabled,
      cartExpiryDays
    });
  } catch (error) {
    console.error('Error enabling/disabling share cart:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update share cart',
      message: error.message
    });
  }
};

/**
 * Get email templates for a shop (merged with defaults)
 * GET /api/admin/email-templates?shop=...
 */
const getEmailTemplatesHandler = async (req, res, db) => {
  try {
    const { shop } = req.query;
    if (!shop) {
      return res.status(400).json({ success: false, error: 'shop is required' });
    }
    const templates = await getEmailTemplates(db, shop);
    return res.json({ success: true, templates });
  } catch (err) {
    console.error('getEmailTemplates error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Save email template overrides
 * PUT /api/admin/email-templates
 * Body: { shop, templates: { [key]: { subject?, text?, html? } } }
 */
const putEmailTemplatesHandler = async (req, res, db) => {
  try {
    const { shop, templates } = req.body;
    if (!shop || !templates || typeof templates !== 'object') {
      return res.status(400).json({ success: false, error: 'shop and templates object are required' });
    }
    const updated = await putEmailTemplates(db, shop, templates);
    return res.json({ success: true, templates: updated });
  } catch (err) {
    console.error('putEmailTemplates error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

const AFFILIATE_AREA_GREETING_DEFAULT = `We have paid the referrals earned until 30 October. Next payment date is 17–20 January for referrals earned during the month of November.

Please make sure your PayPal payment email is included in your affiliate account. If not, you can set it up under the Settings tab, in the Affiliate Area, in your Practitioner account.`;

/**
 * Get affiliate area greeting message for admin
 * GET /api/admin/affiliate-area-greeting?shop=...
 */
const getAffiliateAreaGreeting = async (req, res, db) => {
  try {
    const { shop } = req.query;
    if (!shop) {
      return res.status(400).json({ success: false, error: 'shop is required' });
    }
    const doc = await db.collection('admin_settings').findOne({
      shop,
      setting: 'affiliateAreaGreeting'
    });
    const message = (doc && doc.value != null && doc.value !== '') && doc.value;
    return res.json({ success: true, message });
  } catch (err) {
    console.error('getAffiliateAreaGreeting error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Save affiliate area greeting message
 * PUT /api/admin/affiliate-area-greeting
 * Body: { shop, message: string }
 */
const putAffiliateAreaGreeting = async (req, res, db) => {
  try {
    const { shop, message } = req.body;
    if (!shop) {
      return res.status(400).json({ success: false, error: 'shop is required' });
    }
    const value = typeof message === 'string' ? message : '';
    await db.collection('admin_settings').updateOne(
      { shop, setting: 'affiliateAreaGreeting' },
      {
        $set: {
          shop,
          setting: 'affiliateAreaGreeting',
          value,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
    return res.json({ success: true, message: value });
  } catch (err) {
    console.error('putAffiliateAreaGreeting error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/** Default affiliate commission rate (10%) when not set */
const DEFAULT_AFFILIATE_COMMISSION_RATE = 0.1;

/**
 * Get affiliate commission rate for the shop (account setting)
 * GET /api/admin/affiliate-commission-rate?shop=...
 */
const getAffiliateCommissionRate = async (req, res, db) => {
  try {
    const { shop } = req.query;
    if (!shop) {
      return res.status(400).json({ success: false, error: 'shop is required' });
    }
    const { getStoreCommissionRate } = require('../models/affiliate.model');
    const rate = await getStoreCommissionRate(db, shop);
    return res.json({ success: true, commissionRate: rate });
  } catch (err) {
    console.error('getAffiliateCommissionRate error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Set affiliate commission rate for the shop (account setting)
 * PUT /api/admin/affiliate-commission-rate
 * Body: { shop, commissionRate: number } - commissionRate between 0 and 1 (e.g. 0.1 = 10%)
 */
const putAffiliateCommissionRate = async (req, res, db) => {
  try {
    const { shop, commissionRate } = req.body;
    if (!shop) {
      return res.status(400).json({ success: false, error: 'shop is required' });
    }
    const rate = commissionRate != null ? parseFloat(commissionRate) : DEFAULT_AFFILIATE_COMMISSION_RATE;
    if (Number.isNaN(rate) || rate < 0 || rate > 1) {
      return res.status(400).json({
        success: false,
        error: 'commissionRate must be a number between 0 and 1 (e.g. 0.1 for 10%)'
      });
    }
    await db.collection('admin_settings').updateOne(
      { shop, setting: 'affiliateCommissionRate' },
      {
        $set: {
          shop,
          setting: 'affiliateCommissionRate',
          value: rate,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
    return res.json({ success: true, commissionRate: rate });
  } catch (err) {
    console.error('putAffiliateCommissionRate error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Get payouts list for admin (affiliate payout history)
 * GET /api/admin/payouts?shop=...&page=1&limit=20&status=paid|processing|failed
 */
const getPayouts = async (req, res, db) => {
  try {
    const { shop } = req.query;
    if (!shop) {
      return res.status(400).json({ success: false, error: 'shop is required' });
    }
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const status = req.query.status; // optional filter: paid, processing, failed
    const skip = (page - 1) * limit;

    const query = { shop };
    if (status && ['paid', 'processing', 'failed'].includes(status)) {
      query.status = status;
    }

    const [payouts, total] = await Promise.all([
      db.collection('payouts').find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      db.collection('payouts').countDocuments(query)
    ]);

    const affiliateIds = [...new Set(payouts.map((p) => p.affiliateId).filter(Boolean))];
    const { ObjectId } = require('mongodb');
    const validIds = affiliateIds.filter((id) => id && /^[a-f0-9]{24}$/i.test(id)).map((id) => new ObjectId(id));
    const affiliates = validIds.length
      ? await db.collection('affiliates').find({ _id: { $in: validIds } }).project({ _id: 1, name: 1, firstName: 1, lastName: 1, email: 1 }).toArray()
      : [];
    const affiliateMap = {};
    affiliates.forEach((a) => { affiliateMap[a._id.toString()] = a; });

    const totalPages = Math.ceil(total / limit) || 0;
    res.json({
      success: true,
      payouts: payouts.map((p) => ({
        id: p._id?.toString(),
        payoutId: p._id?.toString(),
        amount: p.amount,
        currency: p.currency || 'USD',
        affiliateId: p.affiliateId,
        affiliateName: (() => {
          const aff = affiliateMap[p.affiliateId];
          if (!aff) return `Affiliate ${(p.affiliateId || '').slice(-6)}`;
          const raw = (aff.name && String(aff.name).trim()) ? String(aff.name).trim() : '';
          const isPlaceholder = !raw || raw.toLowerCase() === 'affiliate';
          if (!isPlaceholder) return raw;
          const firstLast = [aff.firstName, aff.lastName].filter(Boolean).map(s => String(s).trim()).join(' ').trim();
          if (firstLast) return firstLast;
          return (aff.email || `Affiliate ${(p.affiliateId || '').slice(-6)}`);
        })(),
        referralIds: p.referralIds || [],
        method: p.method || '',
        status: p.status || 'processing',
        createdAt: p.createdAt,
        paidAt: p.paidAt,
        generatedBy: p.createdBy || null
      })),
      total,
      page,
      limit,
      totalPages
    });
  } catch (err) {
    console.error('getPayouts error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Get referrals list for admin (all referral conversions for the shop)
 * GET /api/admin/referrals?shop=...&page=1&limit=20&status=...&from=YYYY-MM-DD&to=YYYY-MM-DD
 */
const getReferrals = async (req, res, db) => {
  try {
    const { shop } = req.query;
    if (!shop) {
      return res.status(400).json({ success: false, error: 'shop is required' });
    }
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const status = req.query.status;
    const fromDate = req.query.from;
    const toDate = req.query.to;
    const skip = (page - 1) * limit;

    const affiliates = await db.collection('affiliates').find({ shop }).project({ _id: 1, name: 1, firstName: 1, lastName: 1, email: 1, customerId: 1, referralLinks: 1 }).toArray();
    const shortCodes = new Set();
    const shortCodeToAffiliate = {};
    const displayName = (a) => {
      const firstLast = [a.firstName, a.lastName].filter(Boolean).map(s => String(s).trim()).join(' ').trim();
      if (firstLast) return firstLast;
      const raw = (a.name && String(a.name).trim()) ? String(a.name).trim() : '';
      const isPlaceholder = !raw || raw.toLowerCase() === 'affiliate';
      if (!isPlaceholder) return raw;
      return (a.email || `Affiliate ${(a._id || '').toString().slice(-6)}`);
    };
    affiliates.forEach((a) => {
      const aid = a._id.toString();
      const fullName = displayName(a);
      (a.referralLinks || []).forEach((l) => {
        if (l.shortCode) {
          shortCodes.add(l.shortCode);
          shortCodeToAffiliate[l.shortCode] = { id: aid, name: fullName };
        }
      });
      if (a.customerId) {
        const cid = String(a.customerId);
        shortCodes.add(cid);
        shortCodeToAffiliate[cid] = { id: aid, name: fullName };
      }
    });

    let effectiveShortCodes = shortCodes;
    const affiliateIdFilter = req.query.affiliateId;
    if (affiliateIdFilter) {
      const aff = affiliates.find((a) => a._id.toString() === affiliateIdFilter);
      if (!aff) {
        return res.status(400).json({ success: false, error: 'Affiliate not found' });
      }
      const codes = new Set();
      (aff.referralLinks || []).forEach((l) => { if (l.shortCode) codes.add(l.shortCode); });
      if (aff.customerId) codes.add(String(aff.customerId));
      effectiveShortCodes = [...codes];
      if (effectiveShortCodes.length === 0) {
        return res.json({ success: true, referrals: [], total: 0, page: 1, limit, totalPages: 0 });
      }
    }

    const baseQuery = { shortCode: { $in: [...effectiveShortCodes] } };
    if (status && ['pending', 'paid', 'rejected', 'unpaid'].includes(status.toLowerCase())) {
      baseQuery.status = status.toLowerCase() === 'unpaid' ? 'pending' : status.toLowerCase();
    }
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
      referrals: conversions.map((c) => {
        const aff = shortCodeToAffiliate[c.shortCode] || { id: '', name: `—` };
        const description = Array.isArray(c.productNames) && c.productNames.length ? c.productNames.join(', ') : '';
        return {
          id: c._id?.toString(),
          referralId: c._id?.toString(),
          amount: c.commissionAmount != null ? c.commissionAmount : (c.amount || 0) * (c.commissionRate || 0.1),
          currency: c.currency || 'USD',
          affiliateId: aff.id,
          affiliateName: aff.name,
          reference: c.orderDisplay || c.orderId,
          description: description || '—',
          type: 'Order',
          date: c.timestamp,
          timestamp: c.timestamp,
          status: displayStatus(c.status),
          orderId: c.orderId
        };
      }),
      total,
      page,
      limit,
      totalPages
    });
  } catch (err) {
    console.error('getReferrals error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Get referrals grouped by affiliate (one row per affiliate with totals).
 * GET /api/admin/referrals/by-affiliate?shop=...&status=...&from=...&to=...
 */
const getReferralsByAffiliate = async (req, res, db) => {
  try {
    const { shop } = req.query;
    if (!shop) {
      return res.status(400).json({ success: false, error: 'shop is required' });
    }
    const status = req.query.status;
    const fromDate = req.query.from;
    const toDate = req.query.to;

    const affiliates = await db.collection('affiliates').find({ shop }).project({ _id: 1, name: 1, firstName: 1, lastName: 1, email: 1, customerId: 1, referralLinks: 1 }).toArray();
    const shortCodes = new Set();
    const shortCodeToAffiliate = {};
    const displayName = (a) => {
      const firstLast = [a.firstName, a.lastName].filter(Boolean).map(s => String(s).trim()).join(' ').trim();
      if (firstLast) return firstLast;
      const raw = (a.name && String(a.name).trim()) ? String(a.name).trim() : '';
      const isPlaceholder = !raw || raw.toLowerCase() === 'affiliate';
      if (!isPlaceholder) return raw;
      return (a.email || `Affiliate ${(a._id || '').toString().slice(-6)}`);
    };
    affiliates.forEach((a) => {
      const aid = a._id.toString();
      const fullName = displayName(a);
      (a.referralLinks || []).forEach((l) => {
        if (l.shortCode) {
          shortCodes.add(l.shortCode);
          shortCodeToAffiliate[l.shortCode] = { id: aid, name: fullName };
        }
      });
      if (a.customerId) {
        const cid = String(a.customerId);
        shortCodes.add(cid);
        shortCodeToAffiliate[cid] = { id: aid, name: fullName };
      }
    });

    const baseQuery = { shortCode: { $in: [...shortCodes] } };
    if (status && ['pending', 'paid', 'rejected', 'unpaid'].includes(status.toLowerCase())) {
      baseQuery.status = status.toLowerCase() === 'unpaid' ? 'pending' : status.toLowerCase();
    }
    if (fromDate || toDate) {
      baseQuery.timestamp = {};
      if (fromDate) baseQuery.timestamp.$gte = new Date(fromDate);
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        baseQuery.timestamp.$lte = to;
      }
    }

    const conversions = await db.collection('referral_conversions').find(baseQuery).sort({ timestamp: -1 }).toArray();
    const displayStatus = (s) => {
      if (!s) return 'Unpaid';
      const lower = String(s).toLowerCase();
      if (lower === 'paid') return 'Paid';
      if (lower === 'rejected') return 'Rejected';
      return 'Unpaid';
    };

    const groupByAffiliate = {};
    conversions.forEach((c) => {
      const aff = shortCodeToAffiliate[c.shortCode] || { id: '', name: '—' };
      const aid = aff.id || 'unknown';
      if (!groupByAffiliate[aid]) {
        groupByAffiliate[aid] = {
          affiliateId: aid,
          affiliateName: aff.name,
          totalAmount: 0,
          currency: c.currency || 'USD',
          referralCount: 0,
          unpaidCount: 0,
          paidCount: 0,
          rejectedCount: 0,
        };
      }
      const amt = c.commissionAmount != null ? c.commissionAmount : (c.amount || 0) * (c.commissionRate || 0.1);
      groupByAffiliate[aid].totalAmount += amt;
      groupByAffiliate[aid].referralCount += 1;
      const st = displayStatus(c.status);
      if (st === 'Unpaid') groupByAffiliate[aid].unpaidCount += 1;
      else if (st === 'Paid') groupByAffiliate[aid].paidCount += 1;
      else groupByAffiliate[aid].rejectedCount += 1;
    });

    const groups = Object.values(groupByAffiliate).filter((g) => g.affiliateId !== 'unknown').sort((a, b) => (b.totalAmount - a.totalAmount));
    res.json({ success: true, groups });
  } catch (err) {
    console.error('getReferralsByAffiliate error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Get single referral by ID for admin (detail page)
 * GET /api/admin/referrals/:id?shop=...
 */
const getReferralById = async (req, res, db) => {
  try {
    const { shop } = req.query;
    const { id } = req.params;
    if (!shop) {
      return res.status(400).json({ success: false, error: 'shop is required' });
    }
    if (!id || !ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid referral ID' });
    }
    const conversion = await db.collection('referral_conversions').findOne({ _id: new ObjectId(id) });
    if (!conversion) {
      return res.status(404).json({ success: false, error: 'Referral not found' });
    }
    const affiliates = await db.collection('affiliates').find({ shop }).project({ _id: 1, name: 1, firstName: 1, lastName: 1, email: 1, referralLinks: 1, customerId: 1 }).toArray();
    const shortCodeToAffiliate = {};
    const displayName = (a) => {
      const firstLast = [a.firstName, a.lastName].filter(Boolean).map(s => String(s).trim()).join(' ').trim();
      if (firstLast) return firstLast;
      const raw = (a.name && String(a.name).trim()) ? String(a.name).trim() : '';
      const isPlaceholder = !raw || raw.toLowerCase() === 'affiliate';
      if (!isPlaceholder) return raw;
      return (a.email || `Affiliate ${(a._id || '').toString().slice(-6)}`);
    };
    affiliates.forEach((a) => {
      const aid = a._id.toString();
      const fullName = displayName(a);
      (a.referralLinks || []).forEach((l) => {
        if (l.shortCode) {
          shortCodeToAffiliate[l.shortCode] = { id: aid, name: fullName };
        }
      });
      if (a.customerId) {
        shortCodeToAffiliate[String(a.customerId)] = { id: aid, name: fullName };
      }
    });
    const aff = shortCodeToAffiliate[conversion.shortCode] || { id: '', name: '—' };
    if (!aff.id) {
      return res.status(404).json({ success: false, error: 'Referral not found for this shop' });
    }
    const displayStatus = (s) => {
      if (!s) return 'Unpaid';
      const lower = String(s).toLowerCase();
      if (lower === 'paid') return 'Paid';
      if (lower === 'rejected') return 'Rejected';
      return 'Unpaid';
    };
    const description = Array.isArray(conversion.productNames) && conversion.productNames.length
      ? conversion.productNames.join(', ')
      : '';
    const referral = {
      id: conversion._id.toString(),
      referralId: conversion._id.toString(),
      amount: conversion.commissionAmount != null ? conversion.commissionAmount : (conversion.amount || 0) * (conversion.commissionRate || 0.1),
      currency: conversion.currency || 'USD',
      affiliateId: aff.id,
      affiliateName: aff.name,
      reference: conversion.orderDisplay || conversion.orderId,
      description: description || '—',
      type: 'Order',
      date: conversion.timestamp,
      timestamp: conversion.timestamp,
      status: displayStatus(conversion.status),
      orderId: conversion.orderId
    };
    res.json({ success: true, referral });
  } catch (err) {
    console.error('getReferralById error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Helper: resolve conversion's shortCode to affiliate for a shop; returns { affiliateId, shortCode } or null.
 */
async function getConversionAffiliateForShop(db, conversion, shop) {
  const affiliates = await db.collection('affiliates').find({ shop }).project({ _id: 1, referralLinks: 1, customerId: 1 }).toArray();
  const shortCode = conversion.shortCode;
  for (const a of affiliates) {
    const linkMatch = (a.referralLinks || []).some((l) => l.shortCode === shortCode);
    const customerMatch = a.customerId && String(a.customerId) === shortCode;
    if (linkMatch || customerMatch) return { affiliateId: a._id, shortCode };
  }
  return null;
}

/**
 * Helper: update one referral's status and affiliate earnings. Returns true if updated.
 */
const VALID_REFERRAL_STATUSES = ['pending', 'paid', 'rejected'];

async function updateOneReferralStatus(db, id, shop, newStatus) {
  if (!id || !ObjectId.isValid(id) || !VALID_REFERRAL_STATUSES.includes(newStatus)) return false;
  const conversion = await db.collection('referral_conversions').findOne({ _id: new ObjectId(id) });
  if (!conversion) return false;
  const affInfo = await getConversionAffiliateForShop(db, conversion, shop);
  if (!affInfo) return false;
  const currentStatus = (conversion.status || 'pending').toLowerCase();
  const commissionAmount = parseFloat(conversion.commissionAmount) || (parseFloat(conversion.amount) || 0) * (conversion.commissionRate ?? 0.1);
  await db.collection('referral_conversions').updateOne(
    { _id: new ObjectId(id) },
    { $set: { status: newStatus, updatedAt: new Date() } }
  );
  if (newStatus === 'pending' && currentStatus === 'paid') {
    await db.collection('affiliates').updateOne(
      { _id: affInfo.affiliateId },
      { $inc: { 'earnings.paid': -commissionAmount, 'earnings.pending': commissionAmount }, $set: { updatedAt: new Date() } }
    );
  } else if (newStatus === 'paid' && currentStatus !== 'paid') {
    if (currentStatus === 'pending') {
      await db.collection('affiliates').updateOne(
        { _id: affInfo.affiliateId },
        { $inc: { 'earnings.paid': commissionAmount, 'earnings.pending': -commissionAmount }, $set: { updatedAt: new Date() } }
      );
    } else if (currentStatus === 'rejected') {
      await db.collection('affiliates').updateOne(
        { _id: affInfo.affiliateId },
        { $inc: { 'earnings.paid': commissionAmount }, $set: { updatedAt: new Date() } }
      );
    }
  } else if (newStatus === 'rejected') {
    if (currentStatus === 'paid') {
      await db.collection('affiliates').updateOne(
        { _id: affInfo.affiliateId },
        { $inc: { 'earnings.paid': -commissionAmount }, $set: { updatedAt: new Date() } }
      );
    } else if (currentStatus === 'pending') {
      await db.collection('affiliates').updateOne(
        { _id: affInfo.affiliateId },
        { $inc: { 'earnings.pending': -commissionAmount }, $set: { updatedAt: new Date() } }
      );
    }
  }
  return true;
}

/**
 * Update referral status: 'pending' (unpaid) or 'paid'.
 * PATCH /api/admin/referrals/:id/status?shop=...  body: { status: 'pending' | 'paid' }
 */
const updateReferralStatus = async (req, res, db) => {
  try {
    const { shop } = req.query;
    const { id } = req.params;
    const newStatus = (req.body && req.body.status) ? String(req.body.status).toLowerCase() : '';
    if (!shop) return res.status(400).json({ success: false, error: 'shop is required' });
    if (!id || !ObjectId.isValid(id)) return res.status(400).json({ success: false, error: 'Invalid referral ID' });
    if (!VALID_REFERRAL_STATUSES.includes(newStatus)) {
      return res.status(400).json({ success: false, error: 'Status must be "pending" (Unpaid), "paid", or "rejected"' });
    }
    const conversion = await db.collection('referral_conversions').findOne({ _id: new ObjectId(id) });
    if (!conversion) return res.status(404).json({ success: false, error: 'Referral not found' });
    const affInfo = await getConversionAffiliateForShop(db, conversion, shop);
    if (!affInfo) return res.status(404).json({ success: false, error: 'Referral not found for this shop' });
    const ok = await updateOneReferralStatus(db, id, shop, newStatus);
    res.json(ok ? { success: true } : { success: false, error: 'Update failed' });
  } catch (err) {
    console.error('updateReferralStatus error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Mark multiple referrals as paid (or unpaid).
 * POST /api/admin/referrals/bulk-status?shop=...  body: { referralIds: string[], status: 'paid' | 'pending' }
 */
const updateReferralBulkStatus = async (req, res, db) => {
  try {
    const { shop } = req.query;
    const ids = req.body && Array.isArray(req.body.referralIds) ? req.body.referralIds : [];
    const newStatus = (req.body && req.body.status) ? String(req.body.status).toLowerCase() : '';
    if (!shop) return res.status(400).json({ success: false, error: 'shop is required' });
    if (!VALID_REFERRAL_STATUSES.includes(newStatus)) {
      return res.status(400).json({ success: false, error: 'Status must be "pending" (Unpaid), "paid", or "rejected"' });
    }
    const validIds = ids.filter((id) => id && ObjectId.isValid(id));
    let updated = 0;
    for (const id of validIds) {
      const ok = await updateOneReferralStatus(db, id, shop, newStatus);
      if (ok) updated++;
    }
    res.json({ success: true, updated });
  } catch (err) {
    console.error('updateReferralBulkStatus error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Delete a referral (conversion) and reverse affiliate stats/earnings.
 * DELETE /api/admin/referrals/:id?shop=...
 */
const deleteReferral = async (req, res, db) => {
  try {
    const { shop } = req.query;
    const { id } = req.params;
    if (!shop) return res.status(400).json({ success: false, error: 'shop is required' });
    if (!id || !ObjectId.isValid(id)) return res.status(400).json({ success: false, error: 'Invalid referral ID' });

    const conversion = await db.collection('referral_conversions').findOne({ _id: new ObjectId(id) });
    if (!conversion) return res.status(404).json({ success: false, error: 'Referral not found' });

    const affInfo = await getConversionAffiliateForShop(db, conversion, shop);
    if (!affInfo) return res.status(404).json({ success: false, error: 'Referral not found for this shop' });

    const amount = parseFloat(conversion.amount) || 0;
    const commissionAmount = parseFloat(conversion.commissionAmount) || amount * (conversion.commissionRate ?? 0.1);
    const shortCode = conversion.shortCode;
    const currentStatus = (conversion.status || 'pending').toLowerCase();

    await db.collection('referral_conversions').deleteOne({ _id: new ObjectId(id) });

    const inc = {
      'referralLinks.$.stats.conversions': -1,
      'referralLinks.$.stats.revenue': -amount,
      'stats.totalConversions': -1,
      'stats.totalRevenue': -amount
    };
    if (currentStatus === 'paid') {
      inc['earnings.paid'] = -commissionAmount;
    } else {
      inc['earnings.pending'] = -commissionAmount;
    }

    await db.collection('affiliates').updateOne(
      { shop, 'referralLinks.shortCode': shortCode },
      { $inc: inc, $set: { updatedAt: new Date() } }
    );

    res.json({ success: true });
  } catch (err) {
    console.error('deleteReferral error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Get all visits (referral link clicks) for the shop – admin list
 * GET /api/admin/visits?shop=...&page=1&limit=20&from=...&to=...
 */
const getVisits = async (req, res, db) => {
  try {
    const { shop } = req.query;
    if (!shop) return res.status(400).json({ success: false, error: 'shop is required' });
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const fromDate = (req.query.from || '').trim();
    const toDate = (req.query.to || '').trim();

    const affiliates = await db.collection('affiliates').find({ shop }).project({ _id: 1, name: 1, firstName: 1, lastName: 1, email: 1 }).toArray();
    const affiliateIds = affiliates.map((a) => a._id.toString());
    const affiliateMap = {};
    affiliates.forEach((a) => {
      const id = a._id.toString();
      const firstLast = [a.firstName, a.lastName].filter(Boolean).map((s) => String(s).trim()).join(' ').trim();
      const name = firstLast || (a.name && String(a.name).trim()) || (a.email || `Affiliate ${id.slice(-6)}`);
      affiliateMap[id] = { id, name };
    });

    if (affiliateIds.length === 0) {
      return res.json({ success: true, visits: [], total: 0, page: 1, limit, totalPages: 0 });
    }

    const query = { affiliateId: { $in: affiliateIds } };
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

    const clickIds = clicks.map((c) => c._id.toString());
    const conversionsByVisitId = {};
    if (clickIds.length > 0) {
      const conversionsWithVisitId = await db.collection('referral_conversions').find({
        visitId: { $in: clickIds }
      }).toArray();
      conversionsWithVisitId.forEach((c) => {
        conversionsByVisitId[c.visitId] = {
          referralId: c._id.toString(),
          productNames: c.productNames || [],
          orderId: c.orderId
        };
      });
      const shortCodes = [...new Set(clicks.map((c) => c.shortCode).filter(Boolean))];
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
            referralId: conv._id.toString(),
            productNames: conv.productNames || [],
            orderId: conv.orderId
          };
          assignedClickIds.add(best._id.toString());
        }
      }
    }

    const visits = clicks.map((click) => {
      const referrer = click.referrer && click.referrer.trim();
      const referringUrl = referrer || 'Referral link';
      const conv = conversionsByVisitId[click._id.toString()];
      const converted = !!conv;
      const productPurchased = conv && conv.productNames && conv.productNames.length
        ? conv.productNames.join(', ')
        : null;
      const aff = affiliateMap[click.affiliateId] || { id: click.affiliateId, name: '—' };
      return {
        visitId: click._id.toString(),
        shortCode: click.shortCode || null,
        productPurchased: productPurchased || null,
        referringUrl,
        converted,
        date: click.timestamp,
        ipAddress: click.ipAddress || null,
        referralId: conv ? conv.referralId : null,
        affiliateId: aff.id,
        affiliateName: aff.name
      };
    });

    const totalPages = Math.ceil(total / limit) || 0;
    res.json({ success: true, visits, total, page, limit, totalPages });
  } catch (err) {
    console.error('getVisits error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Get affiliates list for admin (all affiliates for the shop with earnings, stats, referral links)
 * GET /api/admin/affiliates?shop=...&page=1&limit=20&status=...
 */
const getAffiliates = async (req, res, db) => {
  try {
    const { shop } = req.query;
    if (!shop) {
      return res.status(400).json({ success: false, error: 'shop is required' });
    }
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const statusFilter = (req.query.status || '').toLowerCase();
    const search = (req.query.search || req.query.query || '').trim();
    const sort = (req.query.sort || 'createdAt desc').toLowerCase();
    const skip = (page - 1) * limit;

    const query = { shop }; 
    if (statusFilter === 'active') {
      query.status = 'active';
    } else if (statusFilter === 'inactive') {
      query.status = { $in: ['pending', 'suspended', 'deactivated'] };
    }
    if (search) {
      const searchRegex = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
      query.$or = [
        { name: searchRegex },
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex }
      ];
    }

    let sortOption = { createdAt: -1 };
    if (sort === 'name asc' || sort === 'fullname asc') sortOption = { name: 1, firstName: 1 };
    else if (sort === 'name desc' || sort === 'fullname desc') sortOption = { name: -1, firstName: -1 };
    else if (sort === 'createdat asc' || sort === 'joined asc') sortOption = { createdAt: 1 };
    else if (sort === 'createdat desc' || sort === 'joined desc') sortOption = { createdAt: -1 };

    const [affiliatesRaw, total] = await Promise.all([
      db.collection('affiliates').find(query).sort(sortOption).skip(skip).limit(limit).toArray(),
      db.collection('affiliates').countDocuments(query)
    ]);

    const shortCodeToPaidCount = {};
    const paidCounts = await db.collection('referral_conversions').aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: '$shortCode', count: { $sum: 1 } } }
    ]).toArray();
    paidCounts.forEach((row) => { shortCodeToPaidCount[row._id] = row.count; });

    const backendUrl = process.env.HOST;
    const displayName = (a) => {
      const firstLast = [a.firstName, a.lastName].filter(Boolean).map(s => String(s).trim()).join(' ').trim();
      if (firstLast) return firstLast;
      const raw = (a.name && String(a.name).trim()) ? String(a.name).trim() : '';
      const isPlaceholder = !raw || raw.toLowerCase() === 'affiliate';
      if (!isPlaceholder) return raw;
      return (a.email || `Affiliate ${(a._id || '').toString().slice(-6)}`);
    };

    const affiliates = affiliatesRaw.map((a) => {
      const shortCodes = (a.referralLinks || []).map((l) => l.shortCode).filter(Boolean);
      const paidReferralCount = shortCodes.reduce((sum, sc) => sum + (shortCodeToPaidCount[sc] || 0), 0);
      const referralLinks = (a.referralLinks || []).map((l) => ({
        shortCode: l.shortCode,
        description: l.description || '',
        url: l.url || `${backendUrl.replace(/\/+$/, '')}/ref=${l.shortCode}`,
        clicks: (l.stats && l.stats.clicks) != null ? l.stats.clicks : 0,
        conversions: (l.stats && l.stats.conversions) != null ? l.stats.conversions : 0,
        revenue: (l.stats && l.stats.revenue) != null ? l.stats.revenue : 0,
        status: l.status || 'active'
      }));
      return {
        id: a._id.toString(),
        fullName: displayName(a),
        email: a.email || '',
        status: a.status || 'pending',
        earningsPaid: (a.earnings && a.earnings.paid != null) ? a.earnings.paid : 0,
        earningsPending: (a.earnings && a.earnings.pending != null) ? a.earnings.pending : 0,
        totalEarnings: (a.earnings && a.earnings.total != null) ? a.earnings.total : 0,
        currency: (a.earnings && a.earnings.currency) || 'USD',
        paidReferralCount,
        visitsCount: (a.stats && a.stats.totalClicks != null) ? a.stats.totalClicks : 0,
        totalConversions: (a.stats && a.stats.totalConversions != null) ? a.stats.totalConversions : 0,
        referralLinks,
        createdAt: a.createdAt,
        customerId: a.customerId
      };
    });

    const totalPages = Math.ceil(total / limit) || 0;
    res.json({ success: true, affiliates, total, page, limit, totalPages });
  } catch (err) {
    console.error('getAffiliates error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Get single affiliate by ID for admin (same shape as list item, for detail page)
 * GET /api/admin/affiliates/:id?shop=...
 */
const getAffiliateById = async (req, res, db) => {
  try {
    const { id } = req.params;
    const { shop } = req.query;
    if (!shop || !id) {
      return res.status(400).json({ success: false, error: 'shop and id are required' });
    }
    let objectId;
    try {
      objectId = new ObjectId(id);
    } catch (e) {
      return res.status(400).json({ success: false, error: 'Invalid affiliate ID' });
    }

    const a = await db.collection('affiliates').findOne({ _id: objectId, shop });
    if (!a) {
      return res.status(404).json({ success: false, error: 'Affiliate not found' });
    }

    const shortCodes = (a.referralLinks || []).map((l) => l.shortCode).filter(Boolean);
    const shortCodeToPaidCount = {};
    if (shortCodes.length > 0) {
      const paidCounts = await db.collection('referral_conversions').aggregate([
        { $match: { status: 'paid', shortCode: { $in: shortCodes } } },
        { $group: { _id: '$shortCode', count: { $sum: 1 } } }
      ]).toArray();
      paidCounts.forEach((row) => { shortCodeToPaidCount[row._id] = row.count; });
    }

    const backendUrl = process.env.HOST;
    const displayName = (aff) => {
      const firstLast = [aff.firstName, aff.lastName].filter(Boolean).map(s => String(s).trim()).join(' ').trim();
      if (firstLast) return firstLast;
      const raw = (aff.name && String(aff.name).trim()) ? String(aff.name).trim() : '';
      const isPlaceholder = !raw || raw.toLowerCase() === 'affiliate';
      if (!isPlaceholder) return raw;
      return (aff.email || `Affiliate ${(aff._id || '').toString().slice(-6)}`);
    };

    const paidReferralCount = shortCodes.reduce((sum, sc) => sum + (shortCodeToPaidCount[sc] || 0), 0);
    const referralLinks = (a.referralLinks || []).map((l) => ({
      shortCode: l.shortCode,
      description: l.description || '',
      url: l.url || `${backendUrl.replace(/\/+$/, '')}/ref=${l.shortCode}`,
      clicks: (l.stats && l.stats.clicks) != null ? l.stats.clicks : 0,
      conversions: (l.stats && l.stats.conversions) != null ? l.stats.conversions : 0,
      revenue: (l.stats && l.stats.revenue) != null ? l.stats.revenue : 0,
      status: l.status || 'active'
    }));

    const affiliate = {
      id: a._id.toString(),
      fullName: displayName(a),
      firstName: (a.firstName && String(a.firstName).trim()) ? String(a.firstName).trim() : undefined,
      lastName: (a.lastName && String(a.lastName).trim()) ? String(a.lastName).trim() : undefined,
      email: a.email || '',
      status: a.status || 'pending',
      earningsPaid: (a.earnings && a.earnings.paid != null) ? a.earnings.paid : 0,
      earningsPending: (a.earnings && a.earnings.pending != null) ? a.earnings.pending : 0,
      totalEarnings: (a.earnings && a.earnings.total != null) ? a.earnings.total : 0,
      currency: (a.earnings && a.earnings.currency) || 'USD',
      paidReferralCount,
      visitsCount: (a.stats && a.stats.totalClicks != null) ? a.stats.totalClicks : 0,
      totalConversions: (a.stats && a.stats.totalConversions != null) ? a.stats.totalConversions : 0,
      referralLinks,
      createdAt: a.createdAt,
      customerId: a.customerId
    };

    res.json({ success: true, affiliate });
  } catch (err) {
    console.error('getAffiliateById error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Sync affiliate names from approved form submissions (backfill)
 * POST /api/admin/affiliates/sync-names-from-submissions?shop=...
 * Updates affiliates that have no name or name "Affiliate" with the name from their approved submission.
 */
const syncAffiliateNamesFromSubmissions = async (req, res, db) => {
  try {
    const { shop } = req.query;
    if (!shop) {
      return res.status(400).json({ success: false, error: 'shop is required' });
    }

    const affiliates = await db.collection('affiliates')
      .find({ shop })
      .project({ _id: 1, email: 1, name: 1 })
      .toArray();

    const needName = affiliates.filter((a) => {
      const n = (a.name && String(a.name).trim()) ? String(a.name).trim() : '';
      return !n || n.toLowerCase() === 'affiliate';
    });

    if (needName.length === 0) {
      return res.json({ success: true, updated: 0, message: 'No affiliates need name update.' });
    }

    const forms = await db.collection('affiliate_forms').find({ shop }).toArray();
    const formIds = forms.map((f) => f._id.toString());
    const formById = {};
    forms.forEach((f) => { formById[f._id.toString()] = f; });

    const submissions = await db.collection('affiliate_form_submissions')
      .find({
        formId: { $in: formIds },
        approvalStatus: 'approved'
      })
      .toArray();

    const normalizeEmail = (e) => (e && typeof e === 'string' ? e.trim().toLowerCase() : '');

    const emailToSubmissionAndForm = {};
    for (const sub of submissions) {
      const form = formById[sub.formId];
      if (!form) continue;
      const email = extractEmailFromSubmission(sub, form);
      const key = normalizeEmail(email);
      if (!key) continue;
      if (!emailToSubmissionAndForm[key]) {
        emailToSubmissionAndForm[key] = { submission: sub, form };
      }
    }

    let updated = 0;
    const updatedIds = [];

    for (const aff of needName) {
      const key = normalizeEmail(aff.email);
      if (!key) continue;
      const pair = emailToSubmissionAndForm[key];
      if (!pair) continue;
      const name = extractNameFromSubmission(pair.submission, pair.form);
      if (!name || name.trim() === '' || name.toLowerCase() === 'affiliate') continue;

      const { firstName, lastName } = extractFirstAndLastNameFromSubmission(pair.submission, pair.form);
      const updateFields = { name: name.trim(), updatedAt: new Date() };
      if (firstName) updateFields.firstName = firstName;
      if (lastName) updateFields.lastName = lastName;

      await db.collection('affiliates').updateOne(
        { _id: aff._id },
        { $set: updateFields }
      );
      updated++;
      updatedIds.push(aff._id.toString());
    }

    res.json({
      success: true,
      updated,
      updatedAffiliateIds: updatedIds,
      message: updated === 0
        ? 'No matching approved submissions found for affiliates missing names.'
        : `Updated ${updated} affiliate name(s) from form submissions.`
    });
  } catch (err) {
    console.error('syncAffiliateNamesFromSubmissions error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
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
  syncAffiliateNamesFromSubmissions,
  AFFILIATE_AREA_GREETING_DEFAULT
};

