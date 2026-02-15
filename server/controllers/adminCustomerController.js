/**
 * Admin customer API: search by email, create customer.
 * Used by affiliate submission approval and other flows.
 */

const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION;

async function getShopAccess(shop, db) {
  const shopData = await db.collection('shops').findOne({ shop });
  if (!shopData || !shopData.accessToken) return null;
  return shopData.accessToken;
}

async function searchCustomerByEmail(req, res, db) {
  try {
    const shop = req.query.shop;
    const email = (req.query.email || '').trim();
    if (!shop || !email) {
      return res.status(400).json({ success: false, error: 'shop and email are required' });
    }
    const accessToken = await getShopAccess(shop, db);
    if (!accessToken) {
      return res.status(401).json({ success: false, error: 'Shop not authenticated' });
    }
    const url = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/customers/search.json?query=email:${encodeURIComponent(email)}&limit=1`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' }
    });
    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ success: false, error: 'Failed to search customer', details: text });
    }
    const data = await response.json();
    const customers = data.customers || [];
    const customer = customers[0] || null;
    if (!customer) {
      return res.json({ success: true, customer: null, found: false });
    }
    res.json({
      success: true,
      found: true,
      customer: {
        id: customer.id,
        email: customer.email || '',
        firstName: customer.first_name || '',
        lastName: customer.last_name || '',
        tags: (customer.tags && typeof customer.tags === 'string') ? customer.tags.split(',').map(t => t.trim()).filter(Boolean) : []
      }
    });
  } catch (error) {
    console.error('searchCustomerByEmail error:', error);
    res.status(500).json({ success: false, error: 'Failed to search customer', message: error.message });
  }
}

async function createCustomer(req, res, db) {
  try {
    const { shop, email, firstName, lastName, tags } = req.body || {};
    if (!shop || !email) {
      return res.status(400).json({ success: false, error: 'shop and email are required' });
    }
    const accessToken = await getShopAccess(shop, db);
    if (!accessToken) {
      return res.status(401).json({ success: false, error: 'Shop not authenticated' });
    }
    const customerPayload = {
      email: String(email).trim(),
      first_name: (firstName || '').trim() || undefined,
      last_name: (lastName || '').trim() || undefined,
      tags: typeof tags === 'string' ? tags.trim() : (Array.isArray(tags) ? tags.join(', ') : '')
    };
    if (!customerPayload.first_name && !customerPayload.last_name) {
      delete customerPayload.first_name;
      delete customerPayload.last_name;
    }
    if (!customerPayload.tags) delete customerPayload.tags;
    const url = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/customers.json`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer: customerPayload })
    });
    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ success: false, error: 'Failed to create customer', details: text });
    }
    const data = await response.json();
    const customer = data.customer || {};
    res.status(201).json({
      success: true,
      customer: {
        id: customer.id,
        email: customer.email || '',
        firstName: customer.first_name || '',
        lastName: customer.last_name || '',
        tags: (customer.tags && typeof customer.tags === 'string') ? customer.tags.split(',').map(t => t.trim()).filter(Boolean) : []
      }
    });
  } catch (error) {
    console.error('createCustomer error:', error);
    res.status(500).json({ success: false, error: 'Failed to create customer', message: error.message });
  }
}

module.exports = { searchCustomerByEmail, createCustomer };
