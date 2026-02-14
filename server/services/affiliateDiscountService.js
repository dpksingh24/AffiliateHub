/**
 * Affiliate Share Cart Discount Service
 * Creates and fetches discount codes on the store via Shopify GraphQL Admin API.
 * Used for affiliate-funded customer discounts (single-use codes in Phase 2).
 */

const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-01';

/**
 * Create a single discount code on the store (percentage off, all items).
 * @param {string} shop - Shop domain
 * @param {string} accessToken - Shopify Admin API access token
 * @param {Object} options
 * @param {string} options.code - The code customers enter at checkout
 * @param {string} options.title - Discount title (e.g. "Affiliate 10% off")
 * @param {number} options.percentage - 0–100 (e.g. 10 for 10% off)
 * @param {number} [options.usageLimit] - Max total uses (e.g. 1 for single-use)
 * @param {boolean} [options.appliesOncePerCustomer=true] - One use per customer
 * @returns {Promise<{ id: string, code: string }|null>} Created discount node id and code, or null on failure
 */
async function createDiscountCode(shop, accessToken, options) {
  const { code, title, percentage, usageLimit, appliesOncePerCustomer = true } = options || {};
  if (!code || !title || percentage == null || percentage < 0 || percentage > 100) {
    throw new Error('code, title, and percentage (0–100) are required');
  }

  const startsAt = new Date().toISOString();
  // Optional: end date far in future if you want expiry
  const endsAt = null;

  // DiscountCodeBasicInput: customerSelection can be "all" for all buyers
  const mutation = `
    mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
      discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
        codeDiscountNode {
          id
          codeDiscount {
            ... on DiscountCodeBasic {
              title
              codes(first: 5) {
                nodes { code }
              }
            }
          }
        }
        userErrors { field message }
      }
    }
  `;

  const basicCodeDiscount = {
    title: title.trim(),
    code: String(code).trim().toUpperCase(),
    startsAt,
    endsAt,
    customerSelection: { all: true },
    customerGets: {
      value: { percentage: percentage / 100 },
      items: { all: true }
    },
    appliesOncePerCustomer: !!appliesOncePerCustomer
  };
  if (usageLimit != null && usageLimit >= 1) {
    basicCodeDiscount.usageLimit = Math.floor(usageLimit);
  }

  const response = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken
    },
    body: JSON.stringify({ query: mutation, variables: { basicCodeDiscount } })
  });

  const data = await response.json();
  if (data.errors) {
    console.error('affiliateDiscountService.createDiscountCode GraphQL errors:', data.errors);
    throw new Error(data.errors[0]?.message || 'Failed to create discount code');
  }

  const payload = data.data?.discountCodeBasicCreate;
  const userErrors = payload?.userErrors || [];
  if (userErrors.length > 0) {
    console.error('affiliateDiscountService.createDiscountCode userErrors:', userErrors);
    throw new Error(userErrors.map((e) => e.message).join(', '));
  }

  const node = payload?.codeDiscountNode;
  const createdCode = node?.codeDiscount?.codes?.nodes?.[0]?.code || code;
  return { id: node?.id || null, code: createdCode };
}

/**
 * Fetch discount code nodes from the store (code discounts only, first 50).
 * @param {string} shop - Shop domain
 * @param {string} accessToken - Shopify Admin API access token
 * @param {Object} [opts] - Optional: query (search), first (limit)
 * @returns {Promise<Array<{ id: string, title: string, code: string, status: string }>>}
 */
async function getDiscountCodes(shop, accessToken, opts = {}) {
  const first = Math.min(100, Math.max(1, parseInt(opts.first, 10) || 50));
  const query = opts.query ? String(opts.query).trim() : '';

  const gql = `
    query getCodeDiscounts($first: Int!, $query: String) {
      codeDiscountNodes(first: $first, query: $query) {
        edges {
          node {
            id
            codeDiscount {
              ... on DiscountCodeBasic {
                title
                status
                codes(first: 10) {
                  nodes { code }
                }
              }
            }
          }
        }
      }
    }
  `;

  const variables = { first };
  if (query) variables.query = query;

  const response = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken
    },
    body: JSON.stringify({ query: gql, variables })
  });

  const data = await response.json();
  if (data.errors) {
    console.error('affiliateDiscountService.getDiscountCodes GraphQL errors:', data.errors);
    throw new Error(data.errors[0]?.message || 'Failed to fetch discount codes');
  }

  const edges = data.data?.codeDiscountNodes?.edges || [];
  return edges.map(({ node: n }) => {
    const discount = n?.codeDiscount;
    const codes = discount?.codes?.nodes || [];
    return {
      id: n?.id || '',
      title: discount?.title || '',
      code: codes[0]?.code || '',
      status: discount?.status || 'ACTIVE'
    };
  });
}

/**
 * Generate a unique code for single-use affiliate discount (e.g. AFF7X2K9M).
 */
function generateUniqueCode(prefix = 'AFF') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = prefix.toUpperCase();
  for (let i = 0; i < 8; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

/**
 * Create a single-use discount code (usageLimit: 1, appliesOncePerCustomer: true).
 * Used for affiliate share cart: one code per share, one customer use only.
 * @param {string} shop - Shop domain
 * @param {string} accessToken - Shopify Admin API access token
 * @param {Object} options
 * @param {string} [options.code] - Optional; if omitted a unique code is generated
 * @param {string} options.title - Discount title (e.g. "Affiliate share 10% off")
 * @param {number} options.percentage - 0–100
 * @returns {Promise<{ id: string, code: string }>}
 */
async function createSingleUseDiscountCode(shop, accessToken, options) {
  const code = (options && options.code && String(options.code).trim()) || generateUniqueCode();
  const title = (options && options.title) || `Affiliate share ${options?.percentage ?? 0}% off`;
  const percentage = options?.percentage ?? 0;

  return createDiscountCode(shop, accessToken, {
    code,
    title,
    percentage,
    usageLimit: 1,
    appliesOncePerCustomer: true
  });
}

/**
 * Deactivate a discount code on the store (Shopify does not support permanent delete).
 * Stops the code from being used at checkout.
 * @param {string} shop - Shop domain
 * @param {string} accessToken - Shopify Admin API access token
 * @param {string} discountNodeId - Shopify DiscountCodeNode GID (e.g. gid://shopify/DiscountCodeNode/123)
 * @returns {Promise<void>}
 */
async function deactivateDiscountCode(shop, accessToken, discountNodeId) {
  if (!discountNodeId || typeof discountNodeId !== 'string' || !discountNodeId.trim()) {
    throw new Error('discountNodeId is required');
  }
  const id = discountNodeId.trim();
  if (!id.startsWith('gid://')) {
    throw new Error('discountNodeId must be a Shopify GID (e.g. gid://shopify/DiscountCodeNode/123)');
  }

  const mutation = `
    mutation discountCodeDeactivate($id: ID!) {
      discountCodeDeactivate(id: $id) {
        codeDiscountNode { id }
        userErrors { field message }
      }
    }
  `;

  const response = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken
    },
    body: JSON.stringify({ query: mutation, variables: { id } })
  });

  const data = await response.json();
  if (data.errors) {
    console.error('affiliateDiscountService.deactivateDiscountCode GraphQL errors:', data.errors);
    throw new Error(data.errors[0]?.message || 'Failed to deactivate discount code');
  }

  const payload = data.data?.discountCodeDeactivate;
  const userErrors = payload?.userErrors || [];
  if (userErrors.length > 0) {
    throw new Error(userErrors.map((e) => e.message).join(', '));
  }
}

/**
 * Fetch current status of discount codes from Shopify by their node IDs.
 * Used to sync display with store (e.g. after manual reactivation in Shopify Admin).
 * @param {string} shop - Shop domain
 * @param {string} accessToken - Shopify Admin API access token
 * @param {string[]} ids - Array of DiscountCodeNode GIDs
 * @returns {Promise<Object>} Map of id -> 'active' | 'deactivated' (lowercase for display)
 */
async function getDiscountStatusByIds(shop, accessToken, ids) {
  if (!ids || !ids.length) return {};
  const validIds = ids.filter((id) => id && String(id).trim().startsWith('gid://'));
  if (!validIds.length) return {};

  const gql = `
    query getDiscountStatus($ids: [ID!]!) {
      nodes(ids: $ids) {
        id
        ... on DiscountCodeNode {
          codeDiscount {
            ... on DiscountCodeBasic {
              status
              usageLimit
              asyncUsageCount
            }
          }
        }
      }
    }
  `;

  const response = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken
    },
    body: JSON.stringify({ query: gql, variables: { ids: validIds } })
  });

  const data = await response.json();
  if (data.errors) {
    console.warn('affiliateDiscountService.getDiscountStatusByIds GraphQL errors:', data.errors);
    return {};
  }

  const nodes = data.data?.nodes || [];
  const map = {};
  nodes.forEach((n) => {
    if (!n || !n.id) return;
    const discount = n.codeDiscount || {};
    const status = discount.status || '';
    const usageLimit = discount.usageLimit;
    const asyncUsageCount = discount.asyncUsageCount ?? 0;
    const isActive = String(status).toUpperCase() === 'ACTIVE';
    const limitReached = usageLimit != null && Number(asyncUsageCount) >= Number(usageLimit);
    if (isActive && limitReached) {
      map[n.id] = 'usage_limit_reached';
    } else {
      map[n.id] = isActive ? 'active' : 'deactivated';
    }
  });
  return map;
}

module.exports = {
  createDiscountCode,
  getDiscountCodes,
  createSingleUseDiscountCode,
  generateUniqueCode,
  deactivateDiscountCode,
  getDiscountStatusByIds
};
