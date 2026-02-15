/**
 * Customer Controller
 * Fetches and updates Shopify customer profile and addresses for the storefront Account Details tab.
 * Address changes (add/edit/delete/set default) are applied directly in Shopify via Admin API.
 */

const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION;

/** Get shop access token or 401 */
async function getShopAccess(shop, db) {
  const shopData = await db.collection('shops').findOne({ shop });
  if (!shopData || !shopData.accessToken) {
    return null;
  }
  return shopData.accessToken;
}

/** Normalize customer id: return { numericId, gid } for REST and GraphQL. */
function parseCustomerId(customerId) {
  if (customerId == null || customerId === '') return { numericId: null, gid: null };
  const s = String(customerId).trim();
  const gidMatch = s.match(/^gid:\/\/shopify\/Customer\/(\d+)$/i);
  if (gidMatch) {
    const numericId = gidMatch[1];
    return { numericId, gid: s };
  }
  if (/^\d+$/.test(s)) {
    return { numericId: s, gid: `gid://shopify/Customer/${s}` };
  }
  return { numericId: s, gid: `gid://shopify/Customer/${s}` };
}

/** Map GraphQL Order.displayFulfillmentStatus enum to display status for storefront. */
function mapDisplayFulfillmentStatus(enumVal) {
  if (!enumVal) return null;
  const s = String(enumVal).toUpperCase();
  const map = {
    ON_HOLD: 'on_hold',
    FULFILLED: 'fulfilled',
    IN_PROGRESS: 'in progress',
    PARTIALLY_FULFILLED: 'partial',
    SCHEDULED: 'scheduled',
    UNFULFILLED: 'unfulfilled',
    OPEN: 'unfulfilled',
    OUT_OF_STOCK: 'unfulfilled',
    RESTOCKED: 'unfulfilled',
    PENDING_FULFILLMENT: 'in progress'
  };
  return map[s] || null;
}

/**
 * GET /api/customers/profile?shop=...&customerId=...
 * Returns the logged-in customer's profile (name, email, phone) from Shopify.
 */
const getCustomerProfile = async (req, res, db) => {
  try {
    const shop = req.query.shop;
    const customerId = req.query.customerId;

    if (!shop || !customerId) {
      return res.status(400).json({
        success: false,
        error: 'shop and customerId are required'
      });
    }

    const { numericId } = parseCustomerId(customerId);
    if (!numericId) {
      return res.status(400).json({ success: false, error: 'Invalid customerId' });
    }

    const shopData = await db.collection('shops').findOne({ shop });
    if (!shopData || !shopData.accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Shop not authenticated'
      });
    }

    const url = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/customers/${numericId}.json`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': shopData.accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 404) {
        return res.status(404).json({ success: false, error: 'Customer not found' });
      }
      console.error('Shopify customer get error:', response.status, text);
      return res.status(response.status).json({
        success: false,
        error: 'Failed to fetch customer',
        details: text
      });
    }

    const data = await response.json();
    const c = data.customer || {};
    const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || '';

    // Email marketing consent (newsletter): Shopify returns state "subscribed" | "not_subscribed" | "unsubscribed" | "pending"
    const emailConsent = c.email_marketing_consent || {};
    const newsletterSubscribed = (emailConsent.state || '').toLowerCase() === 'subscribed';

    // Order updates preference: stored in customer metafield preferences.order_updates
    let orderUpdates = true; // default on
    try {
      const mfUrl = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/customers/${numericId}/metafields.json?namespace=preferences&key=order_updates`;
      const mfRes = await fetch(mfUrl, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': shopData.accessToken,
          'Content-Type': 'application/json'
        }
      });
      if (mfRes.ok) {
        const mfData = await mfRes.json();
        const list = mfData.metafields || [];
        const orderMf = list.find(m => m.namespace === 'preferences' && m.key === 'order_updates');
        if (orderMf && orderMf.value !== undefined && orderMf.value !== null) {
          orderUpdates = String(orderMf.value).toLowerCase() === 'true' || orderMf.value === true;
        }
      }
    } catch (e) {
      console.warn('getCustomerProfile: could not fetch order_updates metafield', e.message);
    }

    // Tags: Shopify returns comma-separated string; normalize to array for frontend
    const tags = (c.tags && typeof c.tags === 'string')
      ? c.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    res.json({
      success: true,
      profile: {
        name: name.trim() || 'Customer',
        firstName: c.first_name || '',
        lastName: c.last_name || '',
        email: c.email || '',
        phone: c.phone || '',
        newsletterSubscribed,
        orderUpdates,
        tags
      }
    });
  } catch (error) {
    console.error('getCustomerProfile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customer profile',
      message: error.message
    });
  }
};

/**
 * POST /api/customers/update
 * Body: { shop, customerId, firstName?, lastName?, email?, phone?, password? }
 * Updates the customer in Shopify.
 */
const updateCustomer = async (req, res, db) => {
  try {
    const { shop, customerId, firstName, lastName, email, phone, password, newsletterSubscribed, orderUpdates } = req.body;

    if (!shop || !customerId) {
      return res.status(400).json({
        success: false,
        error: 'shop and customerId are required'
      });
    }

    const { numericId, gid: customerGid } = parseCustomerId(customerId);
    if (!numericId || !customerGid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid customerId'
      });
    }

    const shopData = await db.collection('shops').findOne({ shop });
    if (!shopData || !shopData.accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Shop not authenticated'
      });
    }

    const customer = {};
    if (firstName !== undefined) customer.first_name = firstName;
    if (lastName !== undefined) customer.last_name = lastName;
    if (email !== undefined) customer.email = email;
    if (phone !== undefined) customer.phone = phone;
    if (password !== undefined && String(password).trim() !== '') {
      customer.password = password;
      customer.password_confirmation = password;
    }

    const graphqlUrl = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
    const graphqlHeaders = {
      'X-Shopify-Access-Token': shopData.accessToken,
      'Content-Type': 'application/json'
    };

    // 1) Update profile fields (name, email, phone, password) via REST if any (REST requires numeric id)
    if (Object.keys(customer).length > 0) {
      const url = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/customers/${numericId}.json`;
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'X-Shopify-Access-Token': shopData.accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ customer })
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('Shopify customer update error:', response.status, text);
        return res.status(response.status).json({
          success: false,
          error: 'Failed to update customer',
          details: text
        });
      }
    }

    // 2) Update email marketing consent (newsletter) via GraphQL when provided (GraphQL requires GID)
    if (typeof newsletterSubscribed === 'boolean') {
      const consentUpdatedAt = new Date().toISOString();
      const consentMutation = `
        mutation customerEmailMarketingConsentUpdate($input: CustomerEmailMarketingConsentUpdateInput!) {
          customerEmailMarketingConsentUpdate(input: $input) {
            customer { id }
            userErrors { field message }
          }
        }
      `;
      const consentRes = await fetch(graphqlUrl, {
        method: 'POST',
        headers: graphqlHeaders,
        body: JSON.stringify({
          query: consentMutation,
          variables: {
            input: {
              customerId: customerGid,
              emailMarketingConsent: {
                marketingState: newsletterSubscribed ? 'SUBSCRIBED' : 'UNSUBSCRIBED',
                marketingOptInLevel: 'SINGLE_OPT_IN',
                consentUpdatedAt
              }
            }
          }
        })
      });
      const consentData = await consentRes.json();
      if (consentData.errors) {
        console.error('Shopify email marketing consent GraphQL errors:', consentData.errors);
        return res.status(500).json({
          success: false,
          error: 'Failed to update newsletter preference',
          details: consentData.errors[0]?.message
        });
      }
      const userErrors = consentData.data?.customerEmailMarketingConsentUpdate?.userErrors || [];
      if (userErrors.length > 0) {
        console.error('Shopify email marketing consent userErrors:', userErrors);
        return res.status(400).json({
          success: false,
          error: userErrors[0].message || 'Failed to update newsletter preference'
        });
      }
    }

    // 3) Update order updates preference (customer metafield) via GraphQL when provided
    const orderUpdatesBool = orderUpdates === true || orderUpdates === 'true';
    const orderUpdatesProvided = typeof orderUpdates === 'boolean' || orderUpdates === 'true' || orderUpdates === 'false';
    if (orderUpdatesProvided) {
      const metafieldValue = orderUpdatesBool ? 'true' : 'false';
      const metafieldMutation = `
        mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields { id key namespace value }
            userErrors { field message }
          }
        }
      `;
      const mfRes = await fetch(graphqlUrl, {
        method: 'POST',
        headers: graphqlHeaders,
        body: JSON.stringify({
          query: metafieldMutation,
          variables: {
            metafields: [
              {
                ownerId: customerGid,
                namespace: 'preferences',
                key: 'order_updates',
                type: 'boolean',
                value: metafieldValue
              }
            ]
          }
        })
      });
      const mfData = await mfRes.json();
      if (mfData.errors) {
        console.error('Shopify metafield GraphQL errors:', mfData.errors);
        return res.status(500).json({
          success: false,
          error: 'Failed to update order updates preference',
          details: mfData.errors[0]?.message
        });
      }
      const mfUserErrors = mfData.data?.metafieldsSet?.userErrors || [];
      if (mfUserErrors.length > 0) {
        console.error('Shopify metafield userErrors:', mfUserErrors);
        return res.status(400).json({
          success: false,
          error: mfUserErrors[0].message || 'Failed to update order updates preference'
        });
      }
    }

    res.json({ success: true, message: 'Account details updated successfully' });
  } catch (error) {
    console.error('updateCustomer error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update customer',
      message: error.message
    });
  }
};

/**
 * GET /api/customers/addresses?shop=...&customerId=...
 * Returns the customer's saved addresses from Shopify (shipping/billing).
 */
const getCustomerAddresses = async (req, res, db) => {
  try {
    const shop = req.query.shop;
    const customerId = req.query.customerId;

    if (!shop || !customerId) {
      return res.status(400).json({
        success: false,
        error: 'shop and customerId are required'
      });
    }

    const accessToken = await getShopAccess(shop, db);
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Shop not authenticated'
      });
    }

    const url = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/customers/${customerId}/addresses.json?limit=20`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 404) {
        return res.status(404).json({ success: false, error: 'Customer not found' });
      }
      console.error('Shopify customer addresses get error:', response.status, text);
      return res.status(response.status).json({
        success: false,
        error: 'Failed to fetch addresses',
        details: text
      });
    }

    const data = await response.json();
    const raw = data.addresses || [];
    const addresses = raw.map((a) => ({
      id: a.id,
      firstName: a.first_name || '',
      lastName: a.last_name || '',
      company: a.company || '',
      address1: a.address1 || '',
      address2: a.address2 || '',
      city: a.city || '',
      province: a.province || '',
      provinceCode: a.province_code || '',
      country: a.country || '',
      countryCode: a.country_code || '',
      zip: a.zip || '',
      phone: a.phone || '',
      default: !!a.default,
      name: [a.first_name, a.last_name].filter(Boolean).join(' ') || 'Address'
    }));

    res.json({ success: true, addresses });
  } catch (error) {
    console.error('getCustomerAddresses error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch addresses',
      message: error.message
    });
  }
};

/**
 * POST /api/customers/addresses
 * Body: { shop, customerId, address: { firstName, lastName, company?, address1, address2?, city, province?, provinceCode?, country, countryCode?, zip, phone?, default? } }
 * Creates a new address in Shopify for the customer.
 */
const createCustomerAddress = async (req, res, db) => {
  try {
    const { shop, customerId, address: addressInput } = req.body;

    if (!shop || !customerId || !addressInput) {
      return res.status(400).json({
        success: false,
        error: 'shop, customerId and address are required'
      });
    }

    const accessToken = await getShopAccess(shop, db);
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Shop not authenticated'
      });
    }

    // Shopify REST does not accept "default" on create; set default via PUT .../default.json after creation
    const address = {
      first_name: addressInput.firstName ?? addressInput.first_name ?? '',
      last_name: addressInput.lastName ?? addressInput.last_name ?? '',
      company: addressInput.company ?? '',
      address1: addressInput.address1 ?? '',
      address2: addressInput.address2 ?? '',
      city: addressInput.city ?? '',
      province: addressInput.province ?? addressInput.provinceCode ?? '',
      province_code: addressInput.provinceCode ?? addressInput.province_code ?? '',
      country: addressInput.country ?? '',
      country_code: addressInput.countryCode ?? addressInput.country_code ?? '',
      zip: addressInput.zip ?? '',
      phone: addressInput.phone ?? ''
    };

    const url = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/customers/${customerId}/addresses.json`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ address })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Shopify customer address create error:', response.status, text);
      return res.status(response.status).json({
        success: false,
        error: 'Failed to create address',
        details: text
      });
    }

    const data = await response.json();
    const created = data.address || {};
    const newAddressId = created.id;

    // If user requested this as default, set it via the default endpoint (Shopify doesn't accept default on create)
    if (!!addressInput.default && newAddressId) {
      const defaultUrl = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/customers/${customerId}/addresses/${newAddressId}/default.json`;
      const defaultRes = await fetch(defaultUrl, {
        method: 'PUT',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      if (!defaultRes.ok) {
        console.warn('Shopify set default address after create failed:', defaultRes.status, await defaultRes.text());
      }
    }

    res.status(201).json({
      success: true,
      message: 'Address added successfully',
      address: {
        id: created.id,
        firstName: created.first_name || '',
        lastName: created.last_name || '',
        company: created.company || '',
        address1: created.address1 || '',
        address2: created.address2 || '',
        city: created.city || '',
        province: created.province || '',
        country: created.country || '',
        zip: created.zip || '',
        phone: created.phone || '',
        default: !!created.default
      }
    });
  } catch (error) {
    console.error('createCustomerAddress error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create address',
      message: error.message
    });
  }
};

/**
 * PUT /api/customers/addresses/:addressId
 * Body: { shop, customerId, address: { firstName?, lastName?, company?, address1?, address2?, city?, province?, country?, zip?, phone?, default? } }
 * Updates an existing address in Shopify.
 */
const updateCustomerAddress = async (req, res, db) => {
  try {
    const { addressId } = req.params;
    const { shop, customerId, address: addressInput } = req.body;

    if (!shop || !customerId || !addressId || !addressInput) {
      return res.status(400).json({
        success: false,
        error: 'shop, customerId, addressId and address are required'
      });
    }

    const accessToken = await getShopAccess(shop, db);
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Shop not authenticated'
      });
    }

    const address = {};
    if (addressInput.firstName !== undefined) address.first_name = addressInput.firstName;
    else if (addressInput.first_name !== undefined) address.first_name = addressInput.first_name;
    if (addressInput.lastName !== undefined) address.last_name = addressInput.lastName;
    else if (addressInput.last_name !== undefined) address.last_name = addressInput.last_name;
    if (addressInput.company !== undefined) address.company = addressInput.company;
    if (addressInput.address1 !== undefined) address.address1 = addressInput.address1;
    if (addressInput.address2 !== undefined) address.address2 = addressInput.address2;
    if (addressInput.city !== undefined) address.city = addressInput.city;
    if (addressInput.province !== undefined) address.province = addressInput.province;
    if (addressInput.provinceCode !== undefined) address.province_code = addressInput.provinceCode;
    if (addressInput.country !== undefined) address.country = addressInput.country;
    if (addressInput.countryCode !== undefined) address.country_code = addressInput.countryCode;
    if (addressInput.zip !== undefined) address.zip = addressInput.zip;
    if (addressInput.phone !== undefined) address.phone = addressInput.phone;
    // Shopify REST may not accept "default" on update; set default via PUT .../default.json after update
    const setAsDefault = addressInput.default === true;

    const url = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/customers/${customerId}/addresses/${addressId}.json`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ address })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Shopify customer address update error:', response.status, text);
      return res.status(response.status).json({
        success: false,
        error: 'Failed to update address',
        details: text
      });
    }

    const data = await response.json();
    const updated = data.address || {};
    if (setAsDefault) {
      const defaultUrl = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/customers/${customerId}/addresses/${addressId}/default.json`;
      const defaultRes = await fetch(defaultUrl, {
        method: 'PUT',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      if (!defaultRes.ok) {
        console.warn('Shopify set default address after update failed:', defaultRes.status, await defaultRes.text());
      }
    }
    res.json({
      success: true,
      message: 'Address updated successfully',
      address: {
        id: updated.id,
        firstName: updated.first_name || '',
        lastName: updated.last_name || '',
        company: updated.company || '',
        address1: updated.address1 || '',
        address2: updated.address2 || '',
        city: updated.city || '',
        province: updated.province || '',
        country: updated.country || '',
        zip: updated.zip || '',
        phone: updated.phone || '',
        default: !!updated.default
      }
    });
  } catch (error) {
    console.error('updateCustomerAddress error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update address',
      message: error.message
    });
  }
};

/**
 * DELETE /api/customers/addresses/:addressId?shop=...&customerId=...
 * Deletes an address in Shopify.
 */
const deleteCustomerAddress = async (req, res, db) => {
  try {
    const { addressId } = req.params;
    const shop = req.query.shop || req.body?.shop;
    const customerId = req.query.customerId || req.body?.customerId;

    if (!shop || !customerId || !addressId) {
      return res.status(400).json({
        success: false,
        error: 'shop, customerId and addressId are required'
      });
    }

    const accessToken = await getShopAccess(shop, db);
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Shop not authenticated'
      });
    }

    const url = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/customers/${customerId}/addresses/${addressId}.json`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Shopify customer address delete error:', response.status, text);
      return res.status(response.status).json({
        success: false,
        error: 'Failed to delete address',
        details: text
      });
    }

    res.json({ success: true, message: 'Address deleted successfully' });
  } catch (error) {
    console.error('deleteCustomerAddress error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete address',
      message: error.message
    });
  }
};

/**
 * PUT /api/customers/addresses/:addressId/default
 * Body: { shop, customerId }
 * Sets the customer's default address in Shopify.
 */
const setDefaultCustomerAddress = async (req, res, db) => {
  try {
    const { addressId } = req.params;
    const { shop, customerId } = req.body;

    if (!shop || !customerId || !addressId) {
      return res.status(400).json({
        success: false,
        error: 'shop, customerId and addressId are required'
      });
    }

    const accessToken = await getShopAccess(shop, db);
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Shop not authenticated'
      });
    }

    const url = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/customers/${customerId}/addresses/${addressId}/default.json`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Shopify set default address error:', response.status, text);
      return res.status(response.status).json({
        success: false,
        error: 'Failed to set default address',
        details: text
      });
    }

    res.json({ success: true, message: 'Default address updated successfully' });
  } catch (error) {
    console.error('setDefaultCustomerAddress error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set default address',
      message: error.message
    });
  }
};

/* ---------- Billing addresses (stored in app DB; synced to Shopify so they appear at checkout) ---------- */
const BILLING_COLLECTION = 'customerBillingAddresses';

/**
 * Create an address in Shopify for the given customer (so it appears at checkout).
 * Returns { shopifyAddressId } or null on failure.
 */
async function createBillingAddressInShopify(shop, customerId, addressPayload, db) {
  const accessToken = await getShopAccess(shop, db);
  const { numericId } = parseCustomerId(customerId);
  if (!accessToken || !numericId) return null;
  const body = {
    address: {
      first_name: addressPayload.firstName || '',
      last_name: addressPayload.lastName || '',
      company: addressPayload.company || '',
      address1: addressPayload.address1 || '',
      address2: addressPayload.address2 || '',
      city: addressPayload.city || '',
      province: addressPayload.province || addressPayload.provinceCode || '',
      province_code: addressPayload.provinceCode || addressPayload.province_code || '',
      country: addressPayload.country || '',
      country_code: addressPayload.countryCode || addressPayload.country_code || '',
      zip: addressPayload.zip || '',
      phone: addressPayload.phone || ''
    }
  };
  const url = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/customers/${numericId}/addresses.json`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) return null;
    const data = await response.json();
    const created = data.address || {};
    return { shopifyAddressId: created.id };
  } catch (e) {
    console.warn('createBillingAddressInShopify error:', e.message);
    return null;
  }
}

/**
 * Update an address in Shopify by id.
 */
async function updateBillingAddressInShopify(shop, customerId, shopifyAddressId, addressPayload, db) {
  const accessToken = await getShopAccess(shop, db);
  const { numericId } = parseCustomerId(customerId);
  if (!accessToken || !numericId || !shopifyAddressId) return false;
  const address = {};
  if (addressPayload.firstName !== undefined) address.first_name = addressPayload.firstName;
  if (addressPayload.lastName !== undefined) address.last_name = addressPayload.lastName;
  if (addressPayload.company !== undefined) address.company = addressPayload.company;
  if (addressPayload.address1 !== undefined) address.address1 = addressPayload.address1;
  if (addressPayload.address2 !== undefined) address.address2 = addressPayload.address2;
  if (addressPayload.city !== undefined) address.city = addressPayload.city;
  if (addressPayload.province !== undefined) address.province = addressPayload.province;
  if (addressPayload.provinceCode !== undefined) address.province_code = addressPayload.provinceCode;
  if (addressPayload.country !== undefined) address.country = addressPayload.country;
  if (addressPayload.countryCode !== undefined) address.country_code = addressPayload.countryCode;
  if (addressPayload.zip !== undefined) address.zip = addressPayload.zip;
  if (addressPayload.phone !== undefined) address.phone = addressPayload.phone;
  if (Object.keys(address).length === 0) return true;
  const url = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/customers/${numericId}/addresses/${shopifyAddressId}.json`;
  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ address })
    });
    return response.ok;
  } catch (e) {
    console.warn('updateBillingAddressInShopify error:', e.message);
    return false;
  }
}

/**
 * Delete an address from Shopify by id.
 */
async function deleteBillingAddressFromShopify(shop, customerId, shopifyAddressId, db) {
  const accessToken = await getShopAccess(shop, db);
  const { numericId } = parseCustomerId(customerId);
  if (!accessToken || !numericId || !shopifyAddressId) return false;
  const url = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/customers/${numericId}/addresses/${shopifyAddressId}.json`;
  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 'X-Shopify-Access-Token': accessToken }
    });
    return response.ok;
  } catch (e) {
    console.warn('deleteBillingAddressFromShopify error:', e.message);
    return false;
  }
}

function normalizeBillingAddress(a, defaultId) {
  return {
    id: a.id,
    firstName: a.firstName || '',
    lastName: a.lastName || '',
    company: a.company || '',
    address1: a.address1 || '',
    address2: a.address2 || '',
    city: a.city || '',
    province: a.province || '',
    provinceCode: a.provinceCode || '',
    country: a.country || '',
    countryCode: a.countryCode || '',
    zip: a.zip || '',
    phone: a.phone || '',
    default: a.id === defaultId,
    name: [a.firstName, a.lastName].filter(Boolean).join(' ') || 'Address'
  };
}

/**
 * GET /api/customers/billing-addresses?shop=...&customerId=...
 * Returns the customer's billing addresses (app DB).
 */
const getCustomerBillingAddresses = async (req, res, db) => {
  try {
    const shop = req.query.shop;
    const customerId = req.query.customerId;
    if (!shop || !customerId) {
      return res.status(400).json({ success: false, error: 'shop and customerId are required' });
    }
    const doc = await db.collection(BILLING_COLLECTION).findOne({ shop, customerId });
    const addresses = (doc && doc.addresses) || [];
    const defaultId = (doc && doc.defaultId) || null;
    const list = addresses.map((a) => normalizeBillingAddress(a, defaultId));
    res.json({ success: true, addresses: list });
  } catch (error) {
    console.error('getCustomerBillingAddresses error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch billing addresses', message: error.message });
  }
};

/**
 * POST /api/customers/billing-addresses
 * Body: { shop, customerId, address: { firstName, lastName, company?, address1, address2?, city, province?, country?, zip?, phone?, default? } }
 */
const createCustomerBillingAddress = async (req, res, db) => {
  try {
    const { shop, customerId, address: addressInput } = req.body;
    if (!shop || !customerId || !addressInput) {
      return res.status(400).json({ success: false, error: 'shop, customerId and address are required' });
    }
    const id = require('crypto').randomUUID();
    const address = {
      id,
      firstName: addressInput.firstName ?? addressInput.first_name ?? '',
      lastName: addressInput.lastName ?? addressInput.last_name ?? '',
      company: addressInput.company ?? '',
      address1: addressInput.address1 ?? '',
      address2: addressInput.address2 ?? '',
      city: addressInput.city ?? '',
      province: addressInput.province ?? addressInput.provinceCode ?? '',
      provinceCode: addressInput.provinceCode ?? addressInput.province_code ?? '',
      country: addressInput.country ?? '',
      countryCode: addressInput.countryCode ?? addressInput.country_code ?? '',
      zip: addressInput.zip ?? '',
      phone: addressInput.phone ?? ''
    };
    const setAsDefault = !!addressInput.default;
    // Sync to Shopify so this address appears at checkout
    const shopifyResult = await createBillingAddressInShopify(shop, customerId, address, db);
    if (shopifyResult && shopifyResult.shopifyAddressId) {
      address.shopifyAddressId = shopifyResult.shopifyAddressId;
    }
    await db.collection(BILLING_COLLECTION).updateOne(
      { shop, customerId },
      {
        $setOnInsert: { shop, customerId },
        $push: { addresses: address },
        $set: {
          ...(setAsDefault ? { defaultId: id } : {}),
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
    const doc = await db.collection(BILLING_COLLECTION).findOne({ shop, customerId });
    const defaultId = (doc && doc.defaultId != null) ? doc.defaultId : (setAsDefault ? id : null);
    res.status(201).json({
      success: true,
      message: 'Billing address added',
      address: normalizeBillingAddress(address, defaultId)
    });
  } catch (error) {
    console.error('createCustomerBillingAddress error:', error);
    res.status(500).json({ success: false, error: 'Failed to create billing address', message: error.message });
  }
};

/**
 * PUT /api/customers/billing-addresses/:addressId
 * Body: { shop, customerId, address: { firstName?, lastName?, ... } }
 */
const updateCustomerBillingAddress = async (req, res, db) => {
  try {
    const { addressId } = req.params;
    const { shop, customerId, address: addressInput } = req.body;
    if (!shop || !customerId || !addressId || !addressInput) {
      return res.status(400).json({ success: false, error: 'shop, customerId, addressId and address are required' });
    }
    const doc = await db.collection(BILLING_COLLECTION).findOne({ shop, customerId });
    if (!doc || !Array.isArray(doc.addresses)) {
      return res.status(404).json({ success: false, error: 'Billing address not found' });
    }
    const idx = doc.addresses.findIndex((a) => String(a.id) === String(addressId));
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Billing address not found' });
    }
    const a = doc.addresses[idx];
    const updated = {
      id: a.id,
      firstName: addressInput.firstName !== undefined ? addressInput.firstName : a.firstName,
      lastName: addressInput.lastName !== undefined ? addressInput.lastName : a.lastName,
      company: addressInput.company !== undefined ? addressInput.company : a.company,
      address1: addressInput.address1 !== undefined ? addressInput.address1 : a.address1,
      address2: addressInput.address2 !== undefined ? addressInput.address2 : a.address2,
      city: addressInput.city !== undefined ? addressInput.city : a.city,
      province: addressInput.province !== undefined ? addressInput.province : a.province,
      provinceCode: addressInput.provinceCode !== undefined ? addressInput.provinceCode : a.provinceCode,
      country: addressInput.country !== undefined ? addressInput.country : a.country,
      countryCode: addressInput.countryCode !== undefined ? addressInput.countryCode : a.countryCode,
      zip: addressInput.zip !== undefined ? addressInput.zip : a.zip,
      phone: addressInput.phone !== undefined ? addressInput.phone : a.phone
    };
    if (a.shopifyAddressId != null) updated.shopifyAddressId = a.shopifyAddressId;
    const setAsDefault = addressInput.default === true;
    // Sync to Shopify so checkout shows updated billing address
    if (updated.shopifyAddressId) {
      await updateBillingAddressInShopify(shop, customerId, updated.shopifyAddressId, updated, db);
    } else {
      const shopifyResult = await createBillingAddressInShopify(shop, customerId, updated, db);
      if (shopifyResult && shopifyResult.shopifyAddressId) updated.shopifyAddressId = shopifyResult.shopifyAddressId;
    }
    const updateFields = { [`addresses.${idx}`]: updated, updatedAt: new Date() };
    if (setAsDefault) {
      updateFields.defaultId = addressId;
    }
    await db.collection(BILLING_COLLECTION).updateOne(
      { shop, customerId },
      { $set: updateFields }
    );
    const defaultId = setAsDefault ? addressId : (doc.defaultId || null);
    res.json({
      success: true,
      message: 'Billing address updated',
      address: normalizeBillingAddress(updated, setAsDefault ? addressId : doc.defaultId)
    });
  } catch (error) {
    console.error('updateCustomerBillingAddress error:', error);
    res.status(500).json({ success: false, error: 'Failed to update billing address', message: error.message });
  }
};

/**
 * DELETE /api/customers/billing-addresses/:addressId?shop=...&customerId=...
 */
const deleteCustomerBillingAddress = async (req, res, db) => {
  try {
    const { addressId } = req.params;
    const shop = req.query.shop || req.body?.shop;
    const customerId = req.query.customerId || req.body?.customerId;
    if (!shop || !customerId || !addressId) {
      return res.status(400).json({ success: false, error: 'shop, customerId and addressId are required' });
    }
    const doc = await db.collection(BILLING_COLLECTION).findOne({ shop, customerId });
    if (!doc || !Array.isArray(doc.addresses)) {
      return res.json({ success: true, message: 'Address deleted' });
    }
    const toRemove = doc.addresses.find((a) => String(a.id) === String(addressId));
    if (toRemove && toRemove.shopifyAddressId) {
      await deleteBillingAddressFromShopify(shop, customerId, toRemove.shopifyAddressId, db);
    }
    const nextAddresses = doc.addresses.filter((a) => String(a.id) !== String(addressId));
    const update = {
      addresses: nextAddresses,
      updatedAt: new Date()
    };
    if (doc.defaultId === addressId) {
      update.defaultId = nextAddresses.length ? nextAddresses[0].id : null;
    }
    await db.collection(BILLING_COLLECTION).updateOne(
      { shop, customerId },
      { $set: update }
    );
    res.json({ success: true, message: 'Billing address deleted' });
  } catch (error) {
    console.error('deleteCustomerBillingAddress error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete billing address', message: error.message });
  }
};

/**
 * PUT /api/customers/billing-addresses/:addressId/default
 * Body: { shop, customerId }
 */
const setDefaultCustomerBillingAddress = async (req, res, db) => {
  try {
    const { addressId } = req.params;
    const { shop, customerId } = req.body;
    if (!shop || !customerId || !addressId) {
      return res.status(400).json({ success: false, error: 'shop, customerId and addressId are required' });
    }
    const doc = await db.collection(BILLING_COLLECTION).findOne({ shop, customerId });
    if (!doc || !Array.isArray(doc.addresses) || !doc.addresses.some((a) => String(a.id) === String(addressId))) {
      return res.status(404).json({ success: false, error: 'Billing address not found' });
    }
    await db.collection(BILLING_COLLECTION).updateOne(
      { shop, customerId },
      { $set: { defaultId: addressId, updatedAt: new Date() } }
    );
    res.json({ success: true, message: 'Default billing address updated' });
  } catch (error) {
    console.error('setDefaultCustomerBillingAddress error:', error);
    res.status(500).json({ success: false, error: 'Failed to set default billing address', message: error.message });
  }
};

/**
 * GET /api/customers/orders?shop=...&customerId=...
 * Returns the current customer's order history from Shopify (REST).
 */
const getCustomerOrders = async (req, res, db) => {
  try {
    const shop = req.query.shop;
    const customerId = req.query.customerId;

    if (!shop || !customerId) {
      return res.status(400).json({
        success: false,
        error: 'shop and customerId are required'
      });
    }

    const accessToken = await getShopAccess(shop, db);
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Shop not authenticated'
      });
    }

    /** Normalize fulfillment_status from API (e.g. on_hold, ON_HOLD -> on_hold for frontend). */
    function normalizeFulfillmentStatus(value) {
      if (value == null || value === '') return null;
      const s = String(value).trim().toLowerCase().replace(/\s+/g, '_');
      const map = {
        on_hold: 'on_hold',
        onhold: 'on_hold',
        scheduled: 'scheduled',
        in_progress: 'in progress',
        inprogress: 'in progress',
        partially_fulfilled: 'partial',
        partial: 'partial',
        fulfilled: 'fulfilled',
        unfulfilled: 'unfulfilled',
        open: 'unfulfilled',
        restocked: 'unfulfilled',
        request_declined: 'partial',
        pending_fulfillment: 'in progress'
      };
      return map[s] || value;
    }

    /** Derive fulfillment_status from order when API returns null (e.g. list endpoint omits it). */
    function deriveFulfillmentStatus(order) {
      const raw = order.fulfillment_status;
      if (raw != null && raw !== '') {
        const normalized = normalizeFulfillmentStatus(raw);
        if (normalized) return normalized;
      }
      const fulfillments = order.fulfillments || [];
      if (fulfillments.length === 0) return 'unfulfilled';
      const hasOpen = fulfillments.some((f) => (f.status || '').toLowerCase() === 'open' || (f.status || '').toLowerCase() === 'pending');
      const hasSuccess = fulfillments.some((f) => (f.status || '').toLowerCase() === 'success');
      if (hasOpen && !hasSuccess) return 'in progress';
      if (hasOpen && hasSuccess) return 'partial';
      if (hasSuccess) return 'fulfilled';
      return 'unfulfilled';
    }

    const orders = [];
    const baseParams = `customer_id=${customerId}&limit=250&status=any`;
    const fieldsParam = 'id,order_number,created_at,total_price,currency,financial_status,fulfillment_status,fulfillments';
    let nextUrl = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/orders.json?${baseParams}&fields=${encodeURIComponent(fieldsParam)}`;
    let usedFields = true;

    while (nextUrl) {
      const response = await fetch(nextUrl, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 400 && usedFields) {
          nextUrl = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/orders.json?${baseParams}`;
          usedFields = false;
          continue;
        }
        const text = await response.text();
        console.error('Shopify customer orders get error:', response.status, text);
        return res.status(response.status).json({
          success: false,
          error: 'Failed to fetch orders',
          details: text
        });
      }

      const data = await response.json();
      const raw = data.orders || [];
      raw.forEach(function (o) {
        const fulfillmentStatus = deriveFulfillmentStatus(o);
        const status = o.financial_status || fulfillmentStatus || 'pending';
        orders.push({
          id: o.id,
          orderId: o.order_number || o.id,
          date: o.created_at,
          timestamp: o.created_at,
          total: parseFloat(o.total_price || 0),
          amount: parseFloat(o.total_price || 0),
          currency: o.currency || 'USD',
          status: status,
          financial_status: o.financial_status || null,
          fulfillment_status: fulfillmentStatus
        });
      });

      const linkHeader = response.headers.get('Link');
      const nextMatch = linkHeader && linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      nextUrl = nextMatch ? nextMatch[1] : null;
    }

    const { numericId } = parseCustomerId(customerId);
    if (numericId && orders.length > 0) {
      try {
        const graphqlUrl = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
        const query = `
          query getOrdersFulfillmentStatus($query: String!) {
            orders(first: 250, query: $query) {
              edges { node { id, displayFulfillmentStatus } }
            }
          }
        `;
        const gqlRes = await fetch(graphqlUrl, {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query,
            variables: { query: `customer_id:${numericId}` }
          })
        });
        if (gqlRes.ok) {
          const gqlData = await gqlRes.json();
          const edges = gqlData?.data?.orders?.edges || [];
          const byId = {};
          edges.forEach(function (e) {
            const node = e.node;
            const idMatch = (node?.id || '').match(/Order\/(\d+)/);
            const numId = idMatch ? idMatch[1] : null;
            const status = mapDisplayFulfillmentStatus(node?.displayFulfillmentStatus);
            if (numId && status != null) byId[String(numId)] = status;
          });
          orders.forEach(function (o) {
            const graphqlStatus = byId[String(o.id)];
            if (graphqlStatus != null) o.fulfillment_status = graphqlStatus;
          });
        }
      } catch (gqlErr) {
        console.warn('getCustomerOrders GraphQL enrichment failed:', gqlErr.message);
      }
    }

    orders.sort(function (a, b) {
      const tA = new Date(a.date || 0).getTime();
      const tB = new Date(b.date || 0).getTime();
      return tB - tA;
    });

    res.json({ success: true, orders });
  } catch (error) {
    console.error('getCustomerOrders error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders',
      message: error.message
    });
  }
};

/**
 * GET /api/customers/orders/:orderId?shop=...&customerId=...
 * Returns full order details for invoice (line_items, addresses, totals). Verifies order belongs to customer.
 */
const getCustomerOrderById = async (req, res, db) => {
  try {
    const { orderId } = req.params;
    const shop = req.query.shop;
    const customerId = req.query.customerId;

    if (!shop || !customerId || !orderId) {
      return res.status(400).json({
        success: false,
        error: 'shop, customerId and orderId are required'
      });
    }

    const accessToken = await getShopAccess(shop, db);
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Shop not authenticated'
      });
    }

    const url = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/orders/${orderId}.json`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 404) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }
      console.error('Shopify order get error:', response.status, text);
      return res.status(response.status).json({
        success: false,
        error: 'Failed to fetch order',
        details: text
      });
    }

    const data = await response.json();
    const order = data.order || {};
    const orderCustomerId = order.customer_id || (order.customer && order.customer.id);
    const customerIdNum = typeof customerId === 'string' ? customerId.replace(/\D/g, '') : String(customerId);
    const orderCustomerIdStr = orderCustomerId != null ? String(orderCustomerId).replace(/\D/g, '') : '';
    if (orderCustomerIdStr && customerIdNum && orderCustomerIdStr !== customerIdNum) {
      return res.status(403).json({
        success: false,
        error: 'Order does not belong to this customer'
      });
    }

    let fulfillmentStatus = order.fulfillment_status;
    const orderGid = `gid://shopify/Order/${order.id}`;
    try {
      const graphqlUrl = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
      const gqlRes = await fetch(graphqlUrl, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: `query getOrderFulfillmentStatus($id: ID!) { order(id: $id) { displayFulfillmentStatus } }`,
          variables: { id: orderGid }
        })
      });
      if (gqlRes.ok) {
        const gqlData = await gqlRes.json();
        const mapped = mapDisplayFulfillmentStatus(gqlData?.data?.order?.displayFulfillmentStatus);
        if (mapped != null) fulfillmentStatus = mapped;
      }
    } catch (e) {
      // keep REST fulfillment_status
    }

    const shipping = order.shipping_address || {};
    const billing = order.billing_address || {};
    const formatAddr = (addr) => {
      if (!addr || !addr.first_name) return null;
      const lines = [
        [addr.first_name, addr.last_name].filter(Boolean).join(' '),
        addr.address1,
        addr.address2,
        [addr.city, addr.province_code || addr.province].filter(Boolean).join(', '),
        addr.zip,
        addr.country
      ].filter(Boolean);
      return lines.join('\n');
    };

    // Order line_items don't include image/handle in REST API; fetch product images and handles by product_id
    const productIds = [...new Set((order.line_items || []).map((item) => item.product_id).filter(Boolean))];
    const productImageMap = {};
    const productHandleMap = {};
    if (productIds.length > 0) {
      try {
        const idsParam = productIds.slice(0, 250).join(',');
        const productsUrl = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/products.json?ids=${idsParam}&limit=250`;
        const productsRes = await fetch(productsUrl, {
          method: 'GET',
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json'
          }
        });
        if (productsRes.ok) {
          const productsData = await productsRes.json();
          const products = productsData.products || [];
          for (const p of products) {
            const idKey = String(p.id);
            const src = (p.image && p.image.src) || (p.images && p.images[0] && p.images[0].src);
            if (src) productImageMap[idKey] = src;
            if (p.handle) productHandleMap[idKey] = p.handle;
          }
        }
      } catch (e) {
        console.warn('getCustomerOrderById: could not fetch product images', e.message);
      }
    }

    res.json({
      success: true,
      order: {
        id: order.id,
        order_number: order.order_number,
        name: order.name,
        email: order.email || (order.customer && order.customer.email) || '',
        created_at: order.created_at,
        financial_status: order.financial_status,
        fulfillment_status: fulfillmentStatus,
        gateway: order.gateway || (order.payment_gateway_names && order.payment_gateway_names[0]) || '',
        total_price: order.total_price,
        subtotal_price: order.subtotal_price,
        total_tax: order.total_tax,
        total_shipping_price: order.total_shipping_price,
        currency: order.currency || 'USD',
        line_items: (order.line_items || []).map((item) => {
          const handle = productHandleMap[String(item.product_id)];
          return {
            title: item.title,
            quantity: item.quantity,
            price: item.price,
            variant_id: item.variant_id != null ? String(item.variant_id) : null,
            image: productImageMap[String(item.product_id)] || (item.image && item.image.src) || null,
            variant_title: item.variant_title,
            sku: item.sku || null,
            weight: item.grams != null ? (item.grams / 1000).toFixed(3) + 'kg' : (item.weight != null ? item.weight + ' ' + (item.weight_unit || 'kg') : null),
            product_url: handle ? `/products/${handle}` : null
          };
        }),
        shipping_address: formatAddr(shipping),
        shipping_address_raw: shipping,
        billing_address: formatAddr(billing),
        billing_address_raw: billing,
        shipping_lines: (order.shipping_lines || []).map((s) => ({
          title: s.title,
          price: s.price
        }))
      }
    });
  } catch (error) {
    console.error('getCustomerOrderById error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order',
      message: error.message
    });
  }
};

/**
 * GET /api/customers/payment-methods?shop=...&customerId=...
 * Returns the customer's saved payment methods from Shopify (GraphQL).
 * Requires read_customer_payment_methods scope.
 */
const getCustomerPaymentMethods = async (req, res, db) => {
  try {
    const shop = req.query.shop;
    const customerId = req.query.customerId;

    if (!shop || !customerId) {
      return res.status(400).json({
        success: false,
        error: 'shop and customerId are required'
      });
    }

    const accessToken = await getShopAccess(shop, db);
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Shop not authenticated'
      });
    }

    const customerGid = `gid://shopify/Customer/${customerId}`;
    const query = `
      query getCustomerPaymentMethods($id: ID!) {
        customer(id: $id) {
          id
          paymentMethods(first: 20) {
            edges {
              node {
                id
                instrument {
                  ... on CustomerCreditCard {
                    lastDigits
                    expiryMonth
                    expiryYear
                    brand
                    name
                  }
                  ... on CustomerPaypalBillingAgreement {
                    paypalAccountEmail
                  }
                }
              }
            }
          }
        }
      }
    `;

    const graphqlUrl = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, variables: { id: customerGid } })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Shopify customer payment methods GraphQL error:', response.status, text);
      return res.status(response.status).json({
        success: false,
        error: 'Failed to fetch payment methods',
        details: text
      });
    }

    const data = await response.json();
    if (data.errors && data.errors.length > 0) {
      console.error('Shopify GraphQL errors:', data.errors);
      return res.status(400).json({
        success: false,
        error: data.errors[0]?.message || 'GraphQL error',
        details: data.errors
      });
    }

    const edges = data.data?.customer?.paymentMethods?.edges || [];
    const payments = edges.map(({ node }) => {
      const inst = node.instrument || {};
      const type = inst.brand || (inst.paypalAccountEmail ? 'PayPal' : 'Payment method');
      const last4 = inst.lastDigits != null ? String(inst.lastDigits) : (inst.paypalAccountEmail ? '••••' : '');
      const expiry = (inst.expiryMonth && inst.expiryYear)
        ? `${String(inst.expiryMonth).padStart(2, '0')}/${String(inst.expiryYear).slice(-2)}`
        : '';
      return {
        id: node.id,
        type,
        last4,
        expiry,
        name: inst.name || ''
      };
    });

    res.json({ success: true, payments });
  } catch (error) {
    console.error('getCustomerPaymentMethods error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment methods',
      message: error.message
    });
  }
};

/**
 * DELETE /api/customers/payment-methods/:paymentMethodId?shop=...&customerId=...
 * Revokes (removes) a customer payment method in Shopify via GraphQL.
 */
const deleteCustomerPaymentMethod = async (req, res, db) => {
  try {
    const { paymentMethodId } = req.params;
    const shop = req.query.shop || req.body?.shop;
    const customerId = req.query.customerId || req.body?.customerId;

    if (!shop || !paymentMethodId) {
      return res.status(400).json({
        success: false,
        error: 'shop and paymentMethodId are required'
      });
    }

    const accessToken = await getShopAccess(shop, db);
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Shop not authenticated'
      });
    }

    const mutation = `
      mutation customerPaymentMethodRevoke($id: ID!, $revocationReason: CustomerPaymentMethodRevocationReason) {
        customerPaymentMethodRevoke(id: $id, revocationReason: $revocationReason) {
          customerPaymentMethod {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const graphqlUrl = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          id: paymentMethodId,
          revocationReason: 'MANUALLY_REVOKED'
        }
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Shopify customer payment method revoke error:', response.status, text);
      return res.status(response.status).json({
        success: false,
        error: 'Failed to remove payment method',
        details: text
      });
    }

    const data = await response.json();
    if (data.errors && data.errors.length > 0) {
      console.error('Shopify GraphQL revoke errors:', data.errors);
      return res.status(400).json({
        success: false,
        error: data.errors[0]?.message || 'GraphQL error',
        details: data.errors
      });
    }

    const revoke = data.data?.customerPaymentMethodRevoke;
    const userErrors = revoke?.userErrors || [];
    if (userErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: userErrors[0].message || 'Failed to remove payment method'
      });
    }

    res.json({ success: true, message: 'Payment method removed successfully' });
  } catch (error) {
    console.error('deleteCustomerPaymentMethod error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove payment method',
      message: error.message
    });
  }
};

module.exports = {
  getCustomerProfile,
  updateCustomer,
  getCustomerAddresses,
  createCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
  setDefaultCustomerAddress,
  getCustomerBillingAddresses,
  createCustomerBillingAddress,
  updateCustomerBillingAddress,
  deleteCustomerBillingAddress,
  setDefaultCustomerBillingAddress,
  getCustomerOrders,
  getCustomerOrderById,
  getCustomerPaymentMethods,
  deleteCustomerPaymentMethod
};
