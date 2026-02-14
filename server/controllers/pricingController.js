/**
 * Custom Pricing Controller
 * Handles CRUD operations for custom pricing rules
 * and Shopify product/customer/collection search
 * Integrates with Shopify Automatic Discounts API and Metafields
 */

const { ObjectId } = require('mongodb');

// Optional override: Function ID for the discount-function extension.
// If not set, we'll look it up via the Admin API.
const DISCOUNT_FUNCTION_ID = process.env.DISCOUNT_FUNCTION_ID || null;

// ===== SHOPIFY HELPER FUNCTIONS =====

// Helper function to get shop access token
const getShopAccessToken = async (shop, db) => {
  const shopData = await db.collection('shops').findOne({ shop });
  if (!shopData || !shopData.accessToken) {
    throw new Error('Shop not authenticated');
  }
  return shopData.accessToken;
};

// Helper: fetch this app's discount function ID from Shopify and log it
const getDiscountFunctionId = async (shop, accessToken) => {
  const query = `
  query AppFunctions {
    shopifyFunctions(first: 50) {
      edges {
        node {
          id
          apiType
          title
        }
      }
    }
  }

`;


  const response = await fetch(`https://${shop}/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  const data = await response.json();

  if (data.errors) {
    console.error('Error fetching app functions:', data.errors);
    return null;
  }

  const edges = data.data?.shopifyFunctions?.edges || [];

  // Log all functions for debugging
  console.log(
    'Kiscience – shopifyFunctions:',
    JSON.stringify(
      edges.map((e) => e.node),
      null,
      2,
    ),
  );

  // We already filtered by apiType in the query; just take the first result
  const match = edges[0]?.node;

  if (!match) {
    console.log(
      'Kiscience – No cart.lines.discounts.generate function found for this app.',
    );
    return null;
  }

  console.log(
    'Kiscience – Discount Function ID:',
    match.id,
    '| title:',
    '| apiType:',
    match.apiType,
  );

  return match.id;
};

// ===== METAFIELD SYNC FUNCTIONS =====

// Sync all pricing rules to shop metafield for theme app extension
const syncPricingRulesToShopMetafield = async (shop, accessToken, db) => {
  try {
    // Get all active pricing rules for this shop
    const rules = await db.collection('pricing_rules')
      .find({ shop, status: 'active' })
      .toArray();
    
    // Format rules for the metafield (minimal data needed for theme)
    const rulesForMetafield = rules.map(rule => ({
      id: rule._id.toString(),
      name: rule.name,
      status: rule.status,
      discountTitle: rule.discountTitle || rule.name,
      applyToCustomers: rule.applyToCustomers,
      customerTags: rule.customerTags || [],
      specificCustomers: (rule.specificCustomers || []).map(c => ({ id: c.id })),
      applyToProducts: rule.applyToProducts,
      specificProducts: (rule.specificProducts || []).map(p => ({ id: p.id })),
      specificVariants: (rule.specificVariants || []).map(v => ({ id: v.id })),
      collections: (rule.collections || []).map(c => ({ id: c.id })),
      productTags: rule.productTags || [],
      priceType: rule.priceType,
      discountValue: rule.discountValue
    }));

    const metafieldValue = JSON.stringify(rulesForMetafield);

    // Use GraphQL to set shop metafield
    const mutation = `
      mutation SetShopMetafield($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            namespace
            key
            value
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      metafields: [
        {
          namespace: "kiscience",
          key: "pricing_rules",
          value: metafieldValue,
          type: "json",
          ownerId: `gid://shopify/Shop`
        }
      ]
    };

    // First get the shop ID
    const shopQuery = `
      query {
        shop {
          id
        }
      }
    `;

    const shopResponse = await fetch(`https://${shop}/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: shopQuery })
    });

    const shopData = await shopResponse.json();
    const shopGid = shopData.data?.shop?.id;

    if (!shopGid) {
      console.error('Could not get shop ID for metafield');
      return false;
    }

    // Update variables with actual shop ID
    variables.metafields[0].ownerId = shopGid;

    // Log what we're about to sync
    console.log('Kiscience: Syncing metafield with data:', metafieldValue);

    const response = await fetch(`https://${shop}/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: mutation, variables })
    });

    const data = await response.json();
    
    // Log the full response
    console.log('Kiscience: Metafield sync response:', JSON.stringify(data, null, 2));

    if (data.errors) {
      console.error('GraphQL errors syncing metafield:', data.errors);
      return false;
    }

    if (data.data?.metafieldsSet?.userErrors?.length > 0) {
      console.error('User errors syncing metafield:', data.data.metafieldsSet.userErrors);
      return false;
    }

    console.log(`Successfully synced ${rules.length} pricing rules to shop metafield`);
    return true;
  } catch (error) {
    console.error('Error syncing pricing rules to metafield:', error);
    return false;
  }
};

// Sync pricing rule config to discount metafield (for Shopify Function)
const syncRuleToDiscountMetafield = async (shop, accessToken, rule, discountId) => {
  if (!discountId) return false;

  try {
    const ruleConfig = {
      id: rule._id?.toString() || rule.id,
      name: rule.name,
      discountTitle: rule.discountTitle || rule.name,
      priceType: rule.priceType,
      discountValue: rule.discountValue,
      applyToCustomers: rule.applyToCustomers,
      customerTags: rule.customerTags || [],
      specificCustomers: rule.specificCustomers || [],
      applyToProducts: rule.applyToProducts,
      specificProducts: rule.specificProducts || [],
      specificVariants: rule.specificVariants || [],
      collections: rule.collections || [],
      productTags: rule.productTags || []
    };

    const mutation = `
      mutation SetDiscountMetafield($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      metafields: [
        {
          namespace: "$app:kiscience",
          key: "pricing-config",
          value: JSON.stringify(ruleConfig),
          type: "json",
          ownerId: discountId
        }
      ]
    };

    const response = await fetch(`https://${shop}/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: mutation, variables })
    });

    const data = await response.json();

    if (data.errors || data.data?.metafieldsSet?.userErrors?.length > 0) {
      console.error('Error syncing rule to discount metafield:', data.errors || data.data?.metafieldsSet?.userErrors);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error syncing rule to discount metafield:', error);
    return false;
  }
};

// ===== SHOPIFY DISCOUNT HELPER FUNCTIONS =====

// Build customer selection for Shopify discount
const buildCustomerSelection = (rule) => {
  switch (rule.applyToCustomers) {
    case 'all':
      return { all: true };
    case 'customer_tags':
      if (rule.customerTags && rule.customerTags.length > 0) {
        return {
          customers: {
            add: rule.customerTags.map(tag => `gid://shopify/CustomerSegment/${tag}`)
          }
        };
      }
      // If customer tags but with actual tag filter, use customerGetsPercentage with customer segment
      return { all: true };
    case 'specific':
      if (rule.specificCustomers && rule.specificCustomers.length > 0) {
        return {
          customers: {
            add: rule.specificCustomers.map(c => `gid://shopify/Customer/${c.id}`)
          }
        };
      }
      return { all: true };
    default:
      return { all: true };
  }
};

// Normalize product id to Shopify GID (handles numeric or existing GID)
const toProductGid = (id) => {
  const str = String(id).trim();
  const numeric = str.replace(/^gid:\/\/shopify\/Product\//, '');
  return `gid://shopify/Product/${numeric}`;
};

// Fetch current product GIDs on a discount (for computing productsToRemove). Returns [] if not Basic or error.
// Tries: discountNode(Basic GID) -> discountNode(Node GID) -> automaticDiscountNode(Basic/Node) -> metafield fallback.
const getDiscountProductGidsFromShopify = async (shop, accessToken, shopifyDiscountId) => {
  const apiVersion = process.env.SHOPIFY_API_VERSION || '2025-01';
  const numericId = String(shopifyDiscountId).match(/\/(\d+)$/)?.[1];
  const basicGid = numericId ? `gid://shopify/DiscountAutomaticBasic/${numericId}` : null;
  const nodeGid = numericId ? `gid://shopify/DiscountAutomaticNode/${numericId}` : null;

  const runDiscountNode = async (id) => {
    const query = `
      query getDiscountItems($id: ID!) {
        discountNode(id: $id) {
          id
          discount {
            ... on DiscountAutomaticBasic {
              customerGets {
                items {
                  ... on AllDiscountItems { __typename }
                  ... on DiscountProducts {
                    products(first: 250) {
                      edges { node { id } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
    const res = await fetch(`https://${shop}/admin/api/${apiVersion}/graphql.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { id } })
    });
    const data = await res.json();
    const items = data.data?.discountNode?.discount?.customerGets?.items;
    return { items, errors: data.errors };
  };

  const runAutomaticDiscountNode = async (id) => {
    const query = `
      query getAutoDiscountItems($id: ID!) {
        automaticDiscountNode(id: $id) {
          id
          automaticDiscount {
            ... on DiscountAutomaticBasic {
              customerGets {
                items {
                  ... on AllDiscountItems { __typename }
                  ... on DiscountProducts {
                    products(first: 250) {
                      edges { node { id } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
    const res = await fetch(`https://${shop}/admin/api/${apiVersion}/graphql.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { id } })
    });
    const data = await res.json();
    const autoDiscount = data.data?.automaticDiscountNode?.automaticDiscount;
    const items = autoDiscount?.customerGets?.items;
    return { items, errors: data.errors };
  };

  const parseItemsToGids = (items) => {
    if (!items || items.__typename === 'AllDiscountItems' || !items.products?.edges) return [];
    return items.products.edges.map(({ node }) => node.id).filter(Boolean);
  };

  try {
    // 1) Try discountNode with Basic GID first (Node GID often returns "invalid id")
    if (basicGid) {
      const { items, errors } = await runDiscountNode(basicGid);
      if (!errors?.length && items) {
        const gids = parseItemsToGids(items);
        if (gids.length > 0) {
          console.log('[App → Store] getDiscountProductGids: got', gids.length, 'from discountNode(Basic)');
          return gids;
        }
      }
    }
    // 2) Try discountNode with Node GID
    const { items: itemsNode, errors: errorsNode } = await runDiscountNode(shopifyDiscountId);
    if (!errorsNode?.length && itemsNode) {
      const gids = parseItemsToGids(itemsNode);
      if (gids.length > 0) {
        console.log('[App → Store] getDiscountProductGids: got', gids.length, 'from discountNode(Node)');
        return gids;
      }
    }
    // 3) Try automaticDiscountNode with Basic then Node
    if (basicGid) {
      const { items: autoItems } = await runAutomaticDiscountNode(basicGid);
      if (autoItems) {
        const gids = parseItemsToGids(autoItems);
        if (gids.length > 0) {
          console.log('[App → Store] getDiscountProductGids: got', gids.length, 'from automaticDiscountNode(Basic)');
          return gids;
        }
      }
    }
    const { items: autoItemsNode } = await runAutomaticDiscountNode(shopifyDiscountId);
    if (autoItemsNode) {
      const gids = parseItemsToGids(autoItemsNode);
      if (gids.length > 0) {
        console.log('[App → Store] getDiscountProductGids: got', gids.length, 'from automaticDiscountNode(Node)');
        return gids;
      }
    }
    // 4) Fallback: read our pricing-config metafield on the discount (last-synced product list)
    const metaQuery = `
      query getDiscountMetafield($ownerId: ID!) {
        metafields(first: 5, ownerId: $ownerId, namespace: "$app:kiscience") {
          edges { node { key value } }
        }
      }
    `;
    for (const ownerId of [basicGid, nodeGid, shopifyDiscountId].filter(Boolean)) {
      const res = await fetch(`https://${shop}/admin/api/${apiVersion}/graphql.json`, {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: metaQuery, variables: { ownerId } })
      });
      const metaData = await res.json();
      const edges = metaData.data?.metafields?.edges || [];
      const configMf = edges.find((e) => e.node?.key === 'pricing-config');
      if (configMf?.node?.value) {
        const config = JSON.parse(configMf.node.value);
        const products = Array.isArray(config.specificProducts) ? config.specificProducts : [];
        const gids = products.map((p) => (typeof p === 'object' && p?.id ? toProductGid(p.id) : toProductGid(p))).filter(Boolean);
        if (gids.length > 0) {
          console.log('[App → Store] getDiscountProductGids: got', gids.length, 'from metafield pricing-config (fallback)');
          return gids;
        }
      }
    }
    return [];
  } catch (e) {
    console.warn('Kiscience: getDiscountProductGidsFromShopify error:', e.message);
    return [];
  }
};

// Build product selection for Shopify discount.
// For specific_products: sends productsToAdd and productsToRemove so removals sync to the store discount.
const buildProductSelection = (rule) => {
  switch (rule.applyToProducts) {
    case 'all':
      return { all: true };
    case 'specific_products':
      if (rule.specificProducts && rule.specificProducts.length > 0) {
        // Variant selection (Edit variants) — commented out for now; always use product-level
        // const allHaveVariantIds = rule.specificProducts.every((p) => Array.isArray(p.variantIds) && p.variantIds.length > 0);
        // if (allHaveVariantIds) {
        //   const variantGids = rule.specificProducts.flatMap((p) =>
        //     (p.variantIds || []).map((vid) => `gid://shopify/ProductVariant/${vid}`)
        //   );
        //   return { products: { productVariantsToAdd: variantGids } };
        // }
        return {
          products: {
            productsToAdd: rule.specificProducts.map((p) => toProductGid(p.id))
          }
        };
      }
      return { all: true };
    case 'specific_variants':
      if (rule.specificVariants && rule.specificVariants.length > 0) {
        // Try variant-level targeting (Shopify Admin supports "Edit variants" on discounts).
        // If the API returns "has some of its variants entitled" we may need to fall back to product-level.
        const variantGids = rule.specificVariants.map((v) => `gid://shopify/ProductVariant/${v.id}`);
        return {
          products: {
            productVariantsToAdd: variantGids
          }
        };
      }
      return { all: true };
    case 'collections':
      if (rule.collections && rule.collections.length > 0) {
        return {
          products: {
            collectionsToAdd: rule.collections.map(c => `gid://shopify/Collection/${c.id}`)
          }
        };
      }
      return { all: true };
    default:
      return { all: true };
  }
};

// Fetch product prices from Shopify to calculate amount off for new_price
const fetchProductPrices = async (shop, accessToken, productIds) => {
  if (!productIds || productIds.length === 0) return {};
  
  const query = `
    query getProductPrices($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Product {
          id
          variants(first: 1) {
            edges {
              node {
                price
              }
            }
          }
        }
      }
    }
  `;
  
  const gids = productIds.map(id => `gid://shopify/Product/${id}`);
  
  const response = await fetch(`https://${shop}/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables: { ids: gids } })
  });
  
  const data = await response.json();
  const prices = {};
  
  if (data.data && data.data.nodes) {
    data.data.nodes.forEach(node => {
      if (node && node.id && node.variants?.edges?.[0]?.node?.price) {
        const numericId = node.id.replace('gid://shopify/Product/', '');
        prices[numericId] = parseFloat(node.variants.edges[0].node.price);
      }
    });
  }
  
  return prices;
};

// Fetch variant prices from Shopify
const fetchVariantPrices = async (shop, accessToken, variantIds) => {
  if (!variantIds || variantIds.length === 0) return {};
  
  const query = `
    query getVariantPrices($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on ProductVariant {
          id
          price
        }
      }
    }
  `;
  
  const gids = variantIds.map(id => `gid://shopify/ProductVariant/${id}`);
  
  const response = await fetch(`https://${shop}/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables: { ids: gids } })
  });
  
  const data = await response.json();
  const prices = {};
  
  if (data.data && data.data.nodes) {
    data.data.nodes.forEach(node => {
      if (node && node.id && node.price) {
        const numericId = node.id.replace('gid://shopify/ProductVariant/', '');
        prices[numericId] = parseFloat(node.price);
      }
    });
  }
  
  return prices;
};

// Fetch all products from the shop (paginated)
const fetchAllShopProducts = async (shop, accessToken, limit = 250) => {
  const products = [];
  let cursor = null;
  let hasNextPage = true;
  
  while (hasNextPage) {
    const query = `
      query getAllProducts($first: Int!, $after: String) {
        products(first: $first, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              id
              variants(first: 1) {
                edges {
                  node {
                    id
                    price
                  }
                }
              }
            }
          }
        }
      }
    `;
    
    const response = await fetch(`https://${shop}/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, variables: { first: limit, after: cursor } })
    });
    
    const data = await response.json();
    
    if (data.data?.products?.edges) {
      for (const edge of data.data.products.edges) {
        const node = edge.node;
        if (node.variants?.edges?.[0]?.node) {
          const variant = node.variants.edges[0].node;
          products.push({
            productId: node.id.replace('gid://shopify/Product/', ''),
            variantId: variant.id.replace('gid://shopify/ProductVariant/', ''),
            price: parseFloat(variant.price)
          });
        }
      }
      hasNextPage = data.data.products.pageInfo.hasNextPage;
      cursor = data.data.products.pageInfo.endCursor;
    } else {
      hasNextPage = false;
    }
  }
  
  return products;
};

// Fetch products from collections
const fetchProductsFromCollections = async (shop, accessToken, collectionIds) => {
  const products = [];
  
  for (const collectionId of collectionIds) {
    const gid = `gid://shopify/Collection/${collectionId}`;
    let cursor = null;
    let hasNextPage = true;
    
    while (hasNextPage) {
      const query = `
        query getCollectionProducts($id: ID!, $first: Int!, $after: String) {
          collection(id: $id) {
            products(first: $first, after: $after) {
              pageInfo {
                hasNextPage
                endCursor
              }
              edges {
                node {
                  id
                  variants(first: 1) {
                    edges {
                      node {
                        id
                        price
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;
      
      const response = await fetch(`https://${shop}/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, variables: { id: gid, first: 100, after: cursor } })
      });
      
      const data = await response.json();
      
      if (data.data?.collection?.products?.edges) {
        for (const edge of data.data.collection.products.edges) {
          const node = edge.node;
          if (node.variants?.edges?.[0]?.node) {
            const variant = node.variants.edges[0].node;
            products.push({
              productId: node.id.replace('gid://shopify/Product/', ''),
              variantId: variant.id.replace('gid://shopify/ProductVariant/', ''),
              price: parseFloat(variant.price)
            });
          }
        }
        hasNextPage = data.data.collection.products.pageInfo.hasNextPage;
        cursor = data.data.collection.products.pageInfo.endCursor;
      } else {
        hasNextPage = false;
      }
    }
  }
  
  // Remove duplicates
  const uniqueProducts = [];
  const seen = new Set();
  for (const p of products) {
    if (!seen.has(p.productId)) {
      seen.add(p.productId);
      uniqueProducts.push(p);
    }
  }
  
  return uniqueProducts;
};

// Fetch products by tags
const fetchProductsByTags = async (shop, accessToken, tags) => {
  const products = [];
  
  for (const tag of tags) {
    let cursor = null;
    let hasNextPage = true;
    
    while (hasNextPage) {
      const query = `
        query getProductsByTag($query: String!, $first: Int!, $after: String) {
          products(first: $first, after: $after, query: $query) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                id
                variants(first: 1) {
                  edges {
                    node {
                      id
                      price
                    }
                  }
                }
              }
            }
          }
        }
      `;
      
      const response = await fetch(`https://${shop}/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, variables: { query: `tag:${tag}`, first: 100, after: cursor } })
      });
      
      const data = await response.json();
      
      if (data.data?.products?.edges) {
        for (const edge of data.data.products.edges) {
          const node = edge.node;
          if (node.variants?.edges?.[0]?.node) {
            const variant = node.variants.edges[0].node;
            products.push({
              productId: node.id.replace('gid://shopify/Product/', ''),
              variantId: variant.id.replace('gid://shopify/ProductVariant/', ''),
              price: parseFloat(variant.price)
            });
          }
        }
        hasNextPage = data.data.products.pageInfo.hasNextPage;
        cursor = data.data.products.pageInfo.endCursor;
      } else {
        hasNextPage = false;
      }
    }
  }
  
  // Remove duplicates
  const uniqueProducts = [];
  const seen = new Set();
  for (const p of products) {
    if (!seen.has(p.productId)) {
      seen.add(p.productId);
      uniqueProducts.push(p);
    }
  }
  
  return uniqueProducts;
};

// Get all products that match the rule's product selection criteria
const getMatchingProducts = async (shop, accessToken, rule) => {
  switch (rule.applyToProducts) {
    case 'all':
      return await fetchAllShopProducts(shop, accessToken);
    
    case 'specific_products':
      if (rule.specificProducts?.length > 0) {
        const productIds = rule.specificProducts.map(p => p.id);
        const prices = await fetchProductPrices(shop, accessToken, productIds);
        return Object.entries(prices).map(([productId, price]) => ({
          productId,
          price
        }));
      }
      return [];
    
    case 'specific_variants':
      if (rule.specificVariants?.length > 0) {
        const variantIds = rule.specificVariants.map(v => v.id);
        const prices = await fetchVariantPrices(shop, accessToken, variantIds);
        return Object.entries(prices).map(([variantId, price]) => ({
          variantId,
          price
        }));
      }
      return [];
    
    case 'collections':
      if (rule.collections?.length > 0) {
        const collectionIds = rule.collections.map(c => c.id);
        return await fetchProductsFromCollections(shop, accessToken, collectionIds);
      }
      return [];
    
    case 'product_tags':
      if (rule.productTags?.length > 0) {
        return await fetchProductsByTags(shop, accessToken, rule.productTags);
      }
      return [];
    
    default:
      return [];
  }
};

// Create individual discounts for each product when using new_price
// This ensures each product gets the correct discount to reach the new price
const createPerProductDiscountsForNewPrice = async (shop, accessToken, rule, ruleId) => {
  const newPrice = parseFloat(rule.discountValue);
  const discountTitle = rule.discountTitle || rule.name;
  
  // Get all matching products with their prices
  const products = await getMatchingProducts(shop, accessToken, rule);
  
  if (products.length === 0) {
    console.log('Kiscience: No matching products found for new_price calculation');
    return [];
  }
  
  const discountIds = [];
  
  // Create a discount for each product
  for (const product of products) {
    const originalPrice = product.price;
    
    // Skip if new price is higher than or equal to original price
    if (originalPrice <= newPrice) {
      console.log(`Kiscience: Skipping product ${product.productId || product.variantId} - new price (${newPrice}) >= original price (${originalPrice})`);
      continue;
    }
    
    const amountOff = originalPrice - newPrice;
    
    // Build product selection for this specific product/variant
    let productSelection;
    if (product.variantId) {
      productSelection = {
        products: {
          productVariantsToAdd: [`gid://shopify/ProductVariant/${product.variantId}`]
        }
      };
    } else {
      productSelection = {
        products: {
          productsToAdd: [`gid://shopify/Product/${product.productId}`]
        }
      };
    }
    
    // Build discount value
    const discountValue = {
      discountAmount: {
        amount: amountOff,
        appliesOnEachItem: true
      }
    };
    
    // Create the discount
    const mutation = `
      mutation discountAutomaticBasicCreate($automaticBasicDiscount: DiscountAutomaticBasicInput!) {
        discountAutomaticBasicCreate(automaticBasicDiscount: $automaticBasicDiscount) {
          automaticDiscountNode {
            id
            automaticDiscount {
              ... on DiscountAutomaticBasic {
                title
                status
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;
    
    const variables = {
      automaticBasicDiscount: {
        title: `${discountTitle} [${product.productId || product.variantId}]`,
        startsAt: new Date().toISOString(),
        customerGets: {
          value: discountValue,
          items: productSelection
        },
        minimumRequirement: {
          quantity: {
            greaterThanOrEqualToQuantity: "1"
          }
        }
      }
    };
    
    try {
      const response = await fetch(`https://${shop}/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: mutation, variables })
      });
      
      const data = await response.json();
      
      if (data.errors) {
        console.error(`Shopify GraphQL errors for product ${product.productId || product.variantId}:`, data.errors);
        continue;
      }
      
      const result = data.data.discountAutomaticBasicCreate;
      
      if (result.userErrors && result.userErrors.length > 0) {
        console.error(`Shopify user errors for product ${product.productId || product.variantId}:`, result.userErrors);
        continue;
      }
      
      if (result.automaticDiscountNode?.id) {
        discountIds.push(result.automaticDiscountNode.id);
        console.log(`Kiscience: Created discount for product ${product.productId || product.variantId}: ${originalPrice} -> ${newPrice} (${amountOff} off)`);
      }
    } catch (error) {
      console.error(`Error creating discount for product ${product.productId || product.variantId}:`, error);
      continue;
    }
  }
  
  console.log(`Kiscience: Created ${discountIds.length} discounts for new_price rule`);
  return discountIds;
};

// Calculate the maximum discount amount for new_price rules (legacy - for single discount approach)
// Returns the amount to subtract from the highest-priced item
const calculateNewPriceDiscount = async (shop, accessToken, rule) => {
  const newPrice = parseFloat(rule.discountValue);
  
  // Get all matching products
  const products = await getMatchingProducts(shop, accessToken, rule);
  
  if (products.length === 0) {
    console.log('Kiscience: No matching products found for new_price calculation');
    return null;
  }
  
  // Find the maximum original price
  const maxOriginalPrice = Math.max(...products.map(p => p.price), 0);
  
  if (maxOriginalPrice > 0 && maxOriginalPrice > newPrice) {
    const amountOff = maxOriginalPrice - newPrice;
    console.log(`Kiscience: Converting new_price (${newPrice}) to amount_off (${amountOff}) based on max price (${maxOriginalPrice}) from ${products.length} products`);
    return amountOff;
  }
  
  return null;
};

// Create Shopify Automatic App Discount (Function-based)
// This connects a pricing rule to the discount-function extension
const createFunctionDiscountForRule = async (shop, accessToken, rule, ruleId) => {
  const discountTitle = rule.discountTitle || rule.name;

  // Resolve the function ID: use env override if present, otherwise
  // query the Admin API for this app's cart.lines.discounts.generate function.
  let functionId = DISCOUNT_FUNCTION_ID;
  if (!functionId) {
    functionId = await getDiscountFunctionId(shop, accessToken);
    if (!functionId) {
      throw new Error(
        'Unable to resolve discount function ID. Ensure the discount-function extension is deployed for this app.',
      );
    }
  }

  const mutation = `
      mutation discountAutomaticAppCreate($automaticAppDiscount: DiscountAutomaticAppInput!) {
      discountAutomaticAppCreate(automaticAppDiscount: $automaticAppDiscount) {
        automaticAppDiscount {
          discountId
          title
          appDiscountType {
            functionId
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    automaticAppDiscount: {
      title: discountTitle,
      functionId,
      startsAt: new Date().toISOString(),
      discountClasses: ["PRODUCT"],
      combinesWith: {
        orderDiscounts: true,
        productDiscounts: true,
        shippingDiscounts: true,
      },
    },
  };
  

  const response = await fetch(
    `https://${shop}/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: mutation, variables }),
    },
  );

  const data = await response.json();

  if (data.errors) {
    console.error('Shopify GraphQL errors (discountAutomaticAppCreate):', data.errors);
    throw new Error(
      `Failed to create Function-based discount: ${JSON.stringify(data.errors)}`,
    );
  }

  const payload = data.data?.discountAutomaticAppCreate;

  if (payload?.userErrors && payload.userErrors.length > 0) {
    console.error('Shopify user errors (discountAutomaticAppCreate):', payload.userErrors);
    throw new Error(
      `Failed to create Function-based discount: ${payload.userErrors
        .map((e) => e.message)
        .join(', ')}`,
    );
  }

  const discountId = payload?.automaticAppDiscount?.discountId || null;

  if (discountId) {
    // Store the rule configuration on the discount so the Function can read it.
    await syncRuleToDiscountMetafield(shop, accessToken, rule, discountId);
  }

  return discountId;
};

// Create Shopify Automatic Discount (basic / legacy)
// How it works:
// When you set new_price = £2 for a product that costs £40
// System fetches the product's original price (£40)
// Calculates: £40 - £2 = £38 amount off
// Creates Shopify discount with £38 amount off
// At checkout, the discount applies automatically: £40 - £38 = £2

/**
 * @param {string} shop
 * @param {string} accessToken
 * @param {object} rule
 * @param {string} ruleId
 * @param {{ allowCustomerTagsFallback?: boolean }} [options] - If true, create Basic discount even for customer_tags (e.g. when Function requires Plus)
 */
const createShopifyDiscount = async (shop, accessToken, rule, ruleId, options = {}) => {
  const { allowCustomerTagsFallback = false } = options;
  const discountTitle = rule.discountTitle || rule.name;
  
  // For new_price, create individual discounts per product to ensure correct pricing
  if (rule.priceType === 'new_price') {
    const discountIds = await createPerProductDiscountsForNewPrice(shop, accessToken, rule, ruleId);
    if (discountIds.length > 0) {
      // Return the first discount ID for backward compatibility (we'll store all IDs separately)
      // Note: We may need to update the database schema to store multiple discount IDs
      return discountIds[0];
    } else {
      console.log('Kiscience: No discounts created for new_price - no valid products found');
      return null;
    }
  }
  
  // For percent_off and amount_off, use the standard single discount approach
  let effectivePriceType = rule.priceType;
  let effectiveDiscountValue = parseFloat(rule.discountValue);
  
  // Build product selection first to determine if we're targeting all items
  const productSelection = buildProductSelection(rule);
  const isAllItems = productSelection.all === true;
  
  // Build the discount value based on effective priceType (may have been converted from new_price to amount_off)
  let discountValue;
  if (effectivePriceType === 'percent_off') {
    discountValue = {
      percentage: effectiveDiscountValue / 100
    };
  } else if (effectivePriceType === 'amount_off') {
    // appliesOnEachItem must be false when targeting all items (no specific items specified)
    discountValue = {
      discountAmount: {
        amount: effectiveDiscountValue,
        appliesOnEachItem: !isAllItems
      }
    };
  } else {
    // Unknown price type - skip (shouldn't reach here as new_price is converted above)
    console.log('Kiscience: Unknown effective price type:', effectivePriceType);
    return null;
  }
  
  // Build customer selection based on conditions
  // IMPORTANT: Shopify automatic discounts have customer filtering limitations
  // The theme app extension on PDP handles ALL customer conditions properly
  // At checkout: Only certain conditions can be handled by Shopify discounts
  
  // Customer conditions that CANNOT be filtered at checkout (Shopify limitation):
  // - customer_tags: Shopify discounts don't support tag-based filtering
  // - specific: Shopify doesn't support filtering by specific customer emails
  // - non_logged_in: Shopify doesn't support filtering by login status
  // When allowCustomerTagsFallback is true (e.g. shop not on Plus), we still create a Basic discount;
  // merchant can assign a customer segment in the app to restrict who gets it.
  const skipForCustomerCondition =
    !allowCustomerTagsFallback &&
    ((rule.applyToCustomers === 'customer_tags' && rule.customerTags && rule.customerTags.length > 0) ||
      (rule.applyToCustomers === 'specific' && rule.specificCustomers && rule.specificCustomers.length > 0) ||
      rule.applyToCustomers === 'non_logged_in');

  if (skipForCustomerCondition) {
    console.log(`Kiscience: Skipping Shopify discount for ${rule.applyToCustomers} rule: ${rule.name}`);
    console.log('         Reason: Shopify automatic discounts cannot filter by this customer condition');
    console.log('         The theme app extension will handle discount display/calculation on PDP');
    console.log('         At checkout: Discount will NOT appear (Shopify limitation)');
    return null;
  }

  if (allowCustomerTagsFallback && rule.applyToCustomers === 'customer_tags') {
    console.log(`Kiscience: Creating Basic discount (Function requires Plus). Assign a customer segment in the app to restrict who gets it.`);
  }
  
  // For 'all' and 'logged_in' conditions, create Shopify discount
  // Note: 'logged_in' will apply at checkout to all users (can't filter by login status in Shopify)
  // The PDP will show correct filtered pricing via theme app extension
  if (rule.applyToCustomers === 'logged_in') {
    console.log(`Kiscience: Creating Shopify discount for logged_in rule: ${rule.name}`);
    console.log('         Note: At checkout, this discount will apply to all users (Shopify limitation)');
    console.log('         On PDP: Only logged-in customers see the discounted price (via theme app)');
  }

  let mutation;
  let variables;

  // Standard automatic discount for all customers or specific products
  mutation = `
      mutation discountAutomaticBasicCreate($automaticBasicDiscount: DiscountAutomaticBasicInput!) {
        discountAutomaticBasicCreate(automaticBasicDiscount: $automaticBasicDiscount) {
          automaticDiscountNode {
            id
            automaticDiscount {
              ... on DiscountAutomaticBasic {
                title
                status
                startsAt
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;
    
    variables = {
      automaticBasicDiscount: {
        title: discountTitle,
        startsAt: new Date().toISOString(),
        customerGets: {
          value: discountValue,
          items: productSelection
        },
        minimumRequirement: {
          quantity: {
            greaterThanOrEqualToQuantity: "1"
          }
        }
      }
    };

  const response = await fetch(`https://${shop}/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: mutation, variables })
  });

  const data = await response.json();
  
  if (data.errors) {
    console.error('Shopify GraphQL errors:', data.errors);
    throw new Error(`Failed to create Shopify discount: ${JSON.stringify(data.errors)}`);
  }
  
  const result = data.data.discountAutomaticBasicCreate;
  
  if (result.userErrors && result.userErrors.length > 0) {
    console.error('Shopify user errors:', result.userErrors);
    throw new Error(`Failed to create Shopify discount: ${result.userErrors.map(e => e.message).join(', ')}`);
  }
  
  return result.automaticDiscountNode?.id || null;
};

// Update Shopify Automatic Discount
// When rule is customer_tags/specific/non_logged_in we still update the discount (products, title, value)
// if one exists (e.g. Basic discount created via Plus fallback), so product changes sync to Shopify.
// Optional currentProductGidsOverride: when API/metafield can't return current products, use this (e.g. rule's previous specificProducts as GIDs).
const updateShopifyDiscount = async (shop, accessToken, rule, shopifyDiscountId, currentProductGidsOverride = null) => {
  const discountTitle = rule.discountTitle || rule.name;
  
  // For new_price, delete old discount and create new per-product discounts
  if (rule.priceType === 'new_price') {
    // Delete the existing discount first
    if (shopifyDiscountId) {
      try {
        await deleteShopifyDiscount(shop, accessToken, shopifyDiscountId);
        console.log('Kiscience: Deleted old discount for new_price update');
      } catch (error) {
        console.error('Kiscience: Error deleting old discount:', error);
        // Continue anyway - try to create new discounts
      }
    }
    
    // Create new per-product discounts
    const discountIds = await createPerProductDiscountsForNewPrice(shop, accessToken, rule, null);
    if (discountIds.length > 0) {
      // Return the first discount ID for backward compatibility
      return discountIds[0];
    } else {
      console.log('Kiscience: No discounts created for new_price update - no valid products found');
      return null;
    }
  }
  
  // For percent_off and amount_off, use the standard update approach
  let effectivePriceType = rule.priceType;
  let effectiveDiscountValue = parseFloat(rule.discountValue);
  
  // Build product selection. For specific_products (product-level only), fetch current and send add/remove.
  // Variant selection (Edit variants) commented out — always use product-level path for specific_products.
  // const specificProductsWithVariants = rule.applyToProducts === 'specific_products' &&
  //   Array.isArray(rule.specificProducts) &&
  //   rule.specificProducts.every((p) => Array.isArray(p.variantIds) && p.variantIds.length > 0);
  let productSelection;
  if (rule.applyToProducts === 'specific_products' && Array.isArray(rule.specificProducts)) {
    if (rule.specificProducts.length === 0) {
      productSelection = { all: true };
      console.log('[App → Store] Product selection: switching to all products (sync to store)');
    } else {
      let currentGids = await getDiscountProductGidsFromShopify(shop, accessToken, shopifyDiscountId);
      if (currentGids.length === 0 && Array.isArray(currentProductGidsOverride) && currentProductGidsOverride.length > 0) {
        currentGids = currentProductGidsOverride;
        console.log('[App → Store] Product selection: using previous app list as current (API/metafield returned none)', currentGids.length);
      }
      const desiredGids = rule.specificProducts.map(p => toProductGid(p.id));
      const productsToAdd = desiredGids.filter(g => !currentGids.includes(g));
      const productsToRemove = currentGids.filter(g => !desiredGids.includes(g));
      console.log('[App → Store] Product selection: current on store', currentGids.length, 'desired', desiredGids.length, 'toAdd', productsToAdd.length, 'toRemove', productsToRemove.length, { productsToAdd, productsToRemove });
      productSelection = {
        products: {
          productsToAdd,
          ...(productsToRemove.length > 0 && { productsToRemove })
        }
      };
    }
  } else {
    productSelection = buildProductSelection(rule);
  }
  const isAllItems = productSelection.all === true;
  
  // Build the discount value based on effective priceType (may have been converted from new_price)
  let discountValue;
  if (effectivePriceType === 'percent_off') {
    discountValue = {
      percentage: effectiveDiscountValue / 100
    };
  } else if (effectivePriceType === 'amount_off') {
    // appliesOnEachItem must be false when targeting all items (no specific items specified)
    discountValue = {
      discountAmount: {
        amount: effectiveDiscountValue,
        appliesOnEachItem: !isAllItems
      }
    };
  } else {
    // Unknown price type - skip
    console.log('Kiscience: Unknown effective price type:', effectivePriceType);
    return null;
  }
  
  const mutation = `
    mutation discountAutomaticBasicUpdate($id: ID!, $automaticBasicDiscount: DiscountAutomaticBasicInput!) {
      discountAutomaticBasicUpdate(id: $id, automaticBasicDiscount: $automaticBasicDiscount) {
        automaticDiscountNode {
          id
          automaticDiscount {
            ... on DiscountAutomaticBasic {
              title
              status
              startsAt
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const runBasicUpdate = async (id) => {
    const variables = {
      id,
      automaticBasicDiscount: {
        title: discountTitle,
        customerGets: {
          value: discountValue,
          items: productSelection
        }
      }
    };
    const response = await fetch(`https://${shop}/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: mutation, variables })
    });
    const data = await response.json();
    if (data.errors) {
      return { errors: data.errors, userErrors: [] };
    }
    const result = data.data.discountAutomaticBasicUpdate;
    return { result, userErrors: result?.userErrors || [] };
  };

  const isNotFoundOrInvalidId = (errs) =>
    (errs || []).some(e =>
      e.message && (
        e.message.includes('does not exist') ||
        e.message.includes('Discount does not exist') ||
        e.message.includes('Invalid id') ||
        e.message.includes('not found')
      )
    );

  // Try Basic update: use given ID first, then explicit Basic GID if we have Node/numeric (so product list syncs in Shopify admin)
  let out = await runBasicUpdate(shopifyDiscountId);
  if (out.errors) {
    console.error('Shopify GraphQL errors:', out.errors);
    throw new Error(`Failed to update Shopify discount: ${JSON.stringify(out.errors)}`);
  }
  if (out.userErrors.length > 0 && isNotFoundOrInvalidId(out.userErrors)) {
    const idStr = String(shopifyDiscountId).trim();
    const numeric = idStr.match(/\/(\d+)$/)?.[1] || idStr;
    const basicGid = `gid://shopify/DiscountAutomaticBasic/${numeric}`;
    if (basicGid !== shopifyDiscountId) {
      console.log('Kiscience: Retrying discount update with Basic GID for product sync');
      out = await runBasicUpdate(basicGid);
    }
  }
  if (out.errors) {
    console.error('Shopify GraphQL errors:', out.errors);
    throw new Error(`Failed to update Shopify discount: ${JSON.stringify(out.errors)}`);
  }
  if (out.userErrors && out.userErrors.length > 0) {
    const hasNotFound = isNotFoundOrInvalidId(out.userErrors);
    if (hasNotFound) {
      console.log('Kiscience: Discount does not exist (may be App discount) - will create new one if needed');
      return null;
    }
    throw new Error(`Failed to update Shopify discount: ${out.userErrors.map(e => e.message).join(', ')}`);
  }
  console.log('[App → Store] Product selection: success — discount updated in app and store');
  return (out.result && out.result.automaticDiscountNode?.id) || shopifyDiscountId;
};

// Delete Shopify Automatic Discount
const deleteShopifyDiscount = async (shop, accessToken, shopifyDiscountId) => {
  const mutation = `
    mutation discountAutomaticDelete($id: ID!) {
      discountAutomaticDelete(id: $id) {
        deletedAutomaticDiscountId
        userErrors {
          field
          message
        }
      }
    }
  `;
  
  const variables = {
    id: shopifyDiscountId
  };

  const response = await fetch(`https://${shop}/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: mutation, variables })
  });

  const data = await response.json();
  
  if (data.errors) {
    console.error('Shopify GraphQL errors:', data.errors);
    // Don't throw, just log - discount might already be deleted
  }
  
  const result = data.data?.discountAutomaticDelete;
  
  if (result?.userErrors && result.userErrors.length > 0) {
    console.error('Shopify user errors:', result.userErrors);
    // Don't throw, just log
  }
  
  return true;
};

// Activate/Deactivate Shopify Discount based on rule status
const updateShopifyDiscountStatus = async (shop, accessToken, shopifyDiscountId, activate) => {
  const mutation = activate ? `
    mutation discountAutomaticActivate($id: ID!) {
      discountAutomaticActivate(id: $id) {
        automaticDiscountNode {
          id
        }
        userErrors {
          field
          message
        }
      }
    }
  ` : `
    mutation discountAutomaticDeactivate($id: ID!) {
      discountAutomaticDeactivate(id: $id) {
        automaticDiscountNode {
          id
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  
  const variables = { id: shopifyDiscountId };

  const response = await fetch(`https://${shop}/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: mutation, variables })
  });

  const data = await response.json();
  
  if (data.errors) {
    console.error('Shopify GraphQL errors:', data.errors);
    // Check if discount doesn't exist
    const errorMessage = JSON.stringify(data.errors);
    if (errorMessage.includes('does not exist') || errorMessage.includes('Discount does not exist')) {
      throw new Error('Discount does not exist');
    }
  }
  
  const result = data.data?.discountAutomaticActivate || data.data?.discountAutomaticDeactivate;
  
  if (result?.userErrors && result.userErrors.length > 0) {
    console.error('Shopify user errors:', result.userErrors);
    // Check if discount doesn't exist
    const hasNotFoundError = result.userErrors.some(err => 
      err.message && (err.message.includes('does not exist') || err.message.includes('Discount does not exist'))
    );
    
    if (hasNotFoundError) {
      throw new Error('Discount does not exist');
    }
  }
  
  return true;
};

// ===== PRICING RULES CRUD =====

// Get all pricing rules for a shop
const getPricingRules = async (req, res, db) => {
  try {
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({ 
        success: false, 
        error: 'Shop parameter is required' 
      });
    }

    const rules = await db.collection('pricing_rules')
      .find({ shop })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ 
      success: true, 
      rules: rules.map(r => ({
        ...r,
        id: r._id.toString()
      }))
    });
  } catch (error) {
    console.error('Error fetching pricing rules:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch pricing rules',
      message: error.message 
    });
  }
};

// Get a single pricing rule by ID
const getPricingRuleById = async (req, res, db) => {
  try {
    const { id } = req.params;
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({ 
        success: false, 
        error: 'Shop parameter is required' 
      });
    }

    let rule;
    try {
      rule = await db.collection('pricing_rules').findOne({ 
        _id: new ObjectId(id), 
        shop 
      });
    } catch (e) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid rule ID format' 
      });
    }

    if (!rule) {
      return res.status(404).json({ 
        success: false, 
        error: 'Pricing rule not found' 
      });
    }

    res.json({ 
      success: true, 
      rule: {
        ...rule,
        id: rule._id.toString()
      }
    });
  } catch (error) {
    console.error('Error fetching pricing rule:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch pricing rule',
      message: error.message 
    });
  }
};

// Create a new pricing rule
const createPricingRule = async (req, res, db) => {
  try {
    const { shop } = req.query;
    const ruleData = req.body;

    if (!shop) {
      return res.status(400).json({ 
        success: false, 
        error: 'Shop parameter is required' 
      });
    }

    // Validate required fields
    if (!ruleData.name || !ruleData.name.trim()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Rule name is required' 
      });
    }

    if (ruleData.discountValue === undefined || ruleData.discountValue === null || isNaN(parseFloat(ruleData.discountValue))) {
      return res.status(400).json({ 
        success: false, 
        error: 'Valid discount value is required' 
      });
    }

    const newRule = {
      shop,
      name: ruleData.name.trim(),
      status: ruleData.status || 'active',
      discountTitle: ruleData.discountTitle || '',
      
      // Customer targeting
      applyToCustomers: ruleData.applyToCustomers || 'all',
      customerTags: ruleData.customerTags || [],
      specificCustomers: ruleData.specificCustomers || [], // Array of {id, email, name}
      
      // Product targeting
      applyToProducts: ruleData.applyToProducts || 'all',
      specificProducts: ruleData.specificProducts || [], // Array of {id, title, handle, image}
      specificVariants: ruleData.specificVariants || [], // Array of {id, productId, title, sku, price, image}
      collections: ruleData.collections || [], // Array of {id, title, handle}
      productTags: ruleData.productTags || [],
      
      // Pricing
      priceType: ruleData.priceType || 'percent_off',
      discountValue: parseFloat(ruleData.discountValue),
      
      // Shopify discount ID (will be set after creation)
      shopifyDiscountId: null,
      
      // Metadata
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Insert the rule first to get the ID
    const result = await db.collection('pricing_rules').insertOne(newRule);
    const ruleId = result.insertedId.toString();

    // Create Shopify automatic discount if status is active
    let shopifyDiscountId = null;
    let shopifyError = null;
    let metafieldSynced = false;
    
    if (newRule.status === 'active') {
      try {
        const accessToken = await getShopAccessToken(shop, db);

        // For customer tag-based rules, try Function-based automatic discount (requires Shopify Plus).
        if (
          newRule.applyToCustomers === 'customer_tags' &&
          Array.isArray(newRule.customerTags) &&
          newRule.customerTags.length > 0
        ) {
          try {
            shopifyDiscountId = await createFunctionDiscountForRule(
              shop,
              accessToken,
              newRule,
              ruleId,
            );
          } catch (functionErr) {
            // Shop may not be on Plus – Function requires "Shop must be on a Shopify Plus plan"
            const isPlusRequired = functionErr.message && (
              functionErr.message.includes('Plus') ||
              functionErr.message.includes('Shop must be on a Shopify Plus plan') ||
              functionErr.message.includes('functions from a custom app')
            );
            if (isPlusRequired) {
              console.log('Kiscience: Function-based discount not available (Plus required). Creating Basic discount instead; assign a segment in the app to restrict eligibility.');
              shopifyDiscountId = await createShopifyDiscount(
                shop,
                accessToken,
                newRule,
                ruleId,
                { allowCustomerTagsFallback: true },
              );
            } else {
              throw functionErr;
            }
          }
        } else {
          // Fallback: legacy automatic discount behavior
          shopifyDiscountId = await createShopifyDiscount(
            shop,
            accessToken,
            newRule,
            ruleId,
          );
        }

        // Update the rule with Shopify discount ID
        if (shopifyDiscountId) {
          await db.collection('pricing_rules').updateOne(
            { _id: result.insertedId },
            { $set: { shopifyDiscountId } },
          );
          newRule.shopifyDiscountId = shopifyDiscountId;
        }

        // Sync all rules to shop metafield for theme app extension
        metafieldSynced = await syncPricingRulesToShopMetafield(shop, accessToken, db);
      } catch (shopifyErr) {
        console.error('Error creating Shopify discount:', shopifyErr);
        shopifyError = shopifyErr.message;
        // Don't fail the whole operation, just note the error
      }
    }

    res.status(201).json({ 
      success: true, 
      message: shopifyDiscountId 
        ? 'Pricing rule created and Shopify discount activated' 
        : shopifyError 
          ? `Pricing rule created but Shopify discount failed: ${shopifyError}`
          : 'Pricing rule created (discount will activate when status is set to active)',
      rule: {
        ...newRule,
        id: ruleId
      },
      ruleId,
      shopifyDiscountId,
      discountTitle: newRule.discountTitle || newRule.name || '',
      segmentName: (Array.isArray(newRule.customerTags) && newRule.customerTags[0]) || 'Customer Segment',
      metafieldSynced
    });
  } catch (error) {
    console.error('Error creating pricing rule:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create pricing rule',
      message: error.message 
    });
  }
};

// Update an existing pricing rule
const updatePricingRule = async (req, res, db) => {
  try {
    const { id } = req.params;
    const { shop } = req.query;
    const ruleData = req.body;

    if (!shop) {
      return res.status(400).json({ 
        success: false, 
        error: 'Shop parameter is required' 
      });
    }

    // Verify rule exists and belongs to shop
    let existingRule;
    try {
      existingRule = await db.collection('pricing_rules').findOne({ 
        _id: new ObjectId(id), 
        shop 
      });
    } catch (e) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid rule ID format' 
      });
    }

    if (!existingRule) {
      return res.status(404).json({ 
        success: false, 
        error: 'Pricing rule not found' 
      });
    }

    // Validate required fields
    if (!ruleData.name || !ruleData.name.trim()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Rule name is required' 
      });
    }

    if (ruleData.discountValue === undefined || ruleData.discountValue === null || isNaN(parseFloat(ruleData.discountValue))) {
      return res.status(400).json({ 
        success: false, 
        error: 'Valid discount value is required' 
      });
    }

    const updateData = {
      name: ruleData.name.trim(),
      status: ruleData.status || 'active',
      discountTitle: ruleData.discountTitle || '',
      
      // Customer targeting
      applyToCustomers: ruleData.applyToCustomers || 'all',
      customerTags: ruleData.customerTags || [],
      specificCustomers: ruleData.specificCustomers || [],
      
      // Product targeting
      applyToProducts: ruleData.applyToProducts || 'all',
      specificProducts: ruleData.specificProducts || [],
      specificVariants: ruleData.specificVariants || [],
      collections: ruleData.collections || [],
      productTags: ruleData.productTags || [],
      
      // Pricing
      priceType: ruleData.priceType || 'percent_off',
      discountValue: parseFloat(ruleData.discountValue),
      
      updatedAt: new Date()
    };

    // UPDATE DATABASE FIRST before syncing to Shopify
    await db.collection('pricing_rules').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    // Handle Shopify discount sync AFTER database update
    let shopifyDiscountId = existingRule.shopifyDiscountId;
    let shopifyError = null;
    let metafieldSynced = false;
    
    try {
      const accessToken = await getShopAccessToken(shop, db);
      
      const wasActive = existingRule.status === 'active';
      const isActive = updateData.status === 'active';
      
      if (isActive) {
        const mergedRule = { ...existingRule, ...updateData };

        // For customer tag-based rules, manage a Function-based or Basic (fallback) discount.
        if (
          mergedRule.applyToCustomers === 'customer_tags' &&
          Array.isArray(mergedRule.customerTags) &&
          mergedRule.customerTags.length > 0
        ) {
          if (shopifyDiscountId) {
            // Sync product/title/value to Shopify discount (Basic or Function-based)
            try {
              await updateShopifyDiscount(
                shop,
                accessToken,
                mergedRule,
                shopifyDiscountId,
              );
            } catch (updateErr) {
              console.error('Kiscience: Error syncing discount products/title/value:', updateErr);
            }
            // For Function-based discounts, also sync metafield config
            await syncRuleToDiscountMetafield(
              shop,
              accessToken,
              mergedRule,
              shopifyDiscountId,
            );
          } else {
            // Create a new Function-based automatic discount (requires Shopify Plus).
            try {
              shopifyDiscountId = await createFunctionDiscountForRule(
                shop,
                accessToken,
                mergedRule,
                id,
              );
            } catch (functionErr) {
              const isPlusRequired = functionErr.message && (
                functionErr.message.includes('Plus') ||
                functionErr.message.includes('Shop must be on a Shopify Plus plan') ||
                functionErr.message.includes('functions from a custom app')
              );
              if (isPlusRequired) {
                console.log('Kiscience: Function-based discount not available (Plus required). Creating Basic discount instead.');
                shopifyDiscountId = await createShopifyDiscount(
                  shop,
                  accessToken,
                  mergedRule,
                  id,
                  { allowCustomerTagsFallback: true },
                );
              } else {
                throw functionErr;
              }
            }

            if (shopifyDiscountId) {
              await db.collection('pricing_rules').updateOne(
                { _id: new ObjectId(id) },
                { $set: { shopifyDiscountId } },
              );
            }
          }
        } else {
          // Legacy automatic discount path (non tag-based rules)
          if (shopifyDiscountId) {
            try {
              const updatedDiscountId = await updateShopifyDiscount(
                shop,
                accessToken,
                mergedRule,
                shopifyDiscountId,
              );

              if (updatedDiscountId) {
                if (!wasActive) {
                  await updateShopifyDiscountStatus(
                    shop,
                    accessToken,
                    shopifyDiscountId,
                    true,
                  );
                }

                await syncRuleToDiscountMetafield(
                  shop,
                  accessToken,
                  mergedRule,
                  shopifyDiscountId,
                );
              } else {
                console.log(
                  'Kiscience: Discount not found or deleted - creating new discount',
                );
                shopifyDiscountId = await createShopifyDiscount(
                  shop,
                  accessToken,
                  mergedRule,
                  id,
                );

                if (shopifyDiscountId) {
                  await db.collection('pricing_rules').updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { shopifyDiscountId } },
                  );

                  await syncRuleToDiscountMetafield(
                    shop,
                    accessToken,
                    mergedRule,
                    shopifyDiscountId,
                  );
                } else {
                  await db.collection('pricing_rules').updateOne(
                    { _id: new ObjectId(id) },
                    { $unset: { shopifyDiscountId: '' } },
                  );
                }
              }
            } catch (updateErr) {
              if (updateErr.message && updateErr.message.includes('does not exist')) {
                console.log('Kiscience: Discount does not exist - creating new discount');
                shopifyDiscountId = await createShopifyDiscount(
                  shop,
                  accessToken,
                  mergedRule,
                  id,
                );

                if (shopifyDiscountId) {
                  await db.collection('pricing_rules').updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { shopifyDiscountId } },
                  );

                  await syncRuleToDiscountMetafield(
                    shop,
                    accessToken,
                    mergedRule,
                    shopifyDiscountId,
                  );
                } else {
                  await db.collection('pricing_rules').updateOne(
                    { _id: new ObjectId(id) },
                    { $unset: { shopifyDiscountId: '' } },
                  );
                }
              } else {
                throw updateErr;
              }
            }
          } else {
            shopifyDiscountId = await createShopifyDiscount(
              shop,
              accessToken,
              mergedRule,
              id,
            );

            if (shopifyDiscountId) {
              await db.collection('pricing_rules').updateOne(
                { _id: new ObjectId(id) },
                { $set: { shopifyDiscountId } },
              );

              await syncRuleToDiscountMetafield(
                shop,
                accessToken,
                mergedRule,
                shopifyDiscountId,
              );
            }
          }
        }
      } else if (!isActive && shopifyDiscountId) {
        // Deactivate legacy automatic discounts; Function-based ones will simply
        // return no operations when status is inactive based on metafield config.
        try {
          await updateShopifyDiscountStatus(shop, accessToken, shopifyDiscountId, false);
        } catch (deactivateErr) {
          if (
            deactivateErr.message &&
            deactivateErr.message.includes('does not exist')
          ) {
            console.log(
              'Kiscience: Discount does not exist when deactivating - clearing from database',
            );
            await db.collection('pricing_rules').updateOne(
              { _id: new ObjectId(id) },
              { $unset: { shopifyDiscountId: '' } },
            );
            shopifyDiscountId = null;
          } else {
            throw deactivateErr;
          }
        }
      }
      
      // Sync all rules to shop metafield for theme app extension (NOW reads updated data)
      metafieldSynced = await syncPricingRulesToShopMetafield(shop, accessToken, db);
    } catch (shopifyErr) {
      console.error('Error syncing Shopify discount:', shopifyErr);
      shopifyError = shopifyErr.message;
    }

    const ruleId = existingRule._id.toString();
    const finalDiscountTitle = updateData.discountTitle ?? existingRule.discountTitle ?? '';
    const finalSegmentName = (updateData.customerTags && updateData.customerTags[0]) || (existingRule.customerTags && existingRule.customerTags[0]) || 'Customer Segment';

    res.json({ 
      success: true, 
      message: shopifyError 
        ? `Pricing rule updated but Shopify sync failed: ${shopifyError}`
        : 'Pricing rule updated and synced with Shopify',
      rule: {
        ...existingRule,
        ...updateData,
        id: ruleId,
        shopifyDiscountId
      },
      ruleId,
      shopifyDiscountId: shopifyDiscountId || undefined,
      needsSegmentAssignment: !!shopifyDiscountId,
      discountTitle: finalDiscountTitle,
      segmentName: finalSegmentName
    });
  } catch (error) {
    console.error('Error updating pricing rule:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update pricing rule',
      message: error.message 
    });
  }
};

// Delete a pricing rule
const deletePricingRule = async (req, res, db) => {
  try {
    const { id } = req.params;
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({ 
        success: false, 
        error: 'Shop parameter is required' 
      });
    }

    // Verify rule exists and belongs to shop
    let existingRule;
    try {
      existingRule = await db.collection('pricing_rules').findOne({ 
        _id: new ObjectId(id), 
        shop 
      });
    } catch (e) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid rule ID format' 
      });
    }

    if (!existingRule) {
      return res.status(404).json({ 
        success: false, 
        error: 'Pricing rule not found' 
      });
    }

    // Delete Shopify discount if exists
    let shopifyError = null;
    let metafieldSynced = false;
    
    try {
      const accessToken = await getShopAccessToken(shop, db);
      
      if (existingRule.shopifyDiscountId) {
        await deleteShopifyDiscount(shop, accessToken, existingRule.shopifyDiscountId);
      }
      
      // Delete the rule first
      await db.collection('pricing_rules').deleteOne({ _id: new ObjectId(id) });
      
      // Sync updated rules to shop metafield
      metafieldSynced = await syncPricingRulesToShopMetafield(shop, accessToken, db);
    } catch (shopifyErr) {
      console.error('Error deleting Shopify discount:', shopifyErr);
      shopifyError = shopifyErr.message;
      // Still delete the rule from our database
      await db.collection('pricing_rules').deleteOne({ _id: new ObjectId(id) });
    }

    res.json({ 
      success: true, 
      message: shopifyError 
        ? `Pricing rule deleted but Shopify sync failed: ${shopifyError}`
        : 'Pricing rule and Shopify discount deleted successfully',
      metafieldSynced
    });
  } catch (error) {
    console.error('Error deleting pricing rule:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete pricing rule',
      message: error.message 
    });
  }
};

// ===== SHOPIFY SEARCH ENDPOINTS =====

// Search products
const searchProducts = async (req, res, db) => {
  try {
    const { shop, query, limit = 25 } = req.query;

    if (!shop) {
      return res.status(400).json({ 
        success: false, 
        error: 'Shop parameter is required' 
      });
    }

    const accessToken = await getShopAccessToken(shop, db);

    // Use GraphQL for better product search
    const graphqlQuery = `
      query searchProducts($query: String!, $first: Int!) {
        products(first: $first, query: $query) {
          edges {
            node {
              id
              title
              handle
              status
              featuredImage {
                url
              }
              priceRangeV2 {
                minVariantPrice {
                  amount
                  currencyCode
                }
                maxVariantPrice {
                  amount
                  currencyCode
                }
              }
              variants(first: 100) {
                edges {
                  node {
                    id
                    title
                    sku
                    price
                    image {
                      url
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await fetch(`https://${shop}/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: graphqlQuery,
        variables: {
          query: query || '',
          first: parseInt(limit)
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Shopify GraphQL error:', errorText);
      return res.status(response.status).json({ 
        success: false, 
        error: 'Failed to search products',
        details: errorText
      });
    }

    const data = await response.json();
    
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      return res.status(400).json({ 
        success: false, 
        error: 'GraphQL query error',
        details: data.errors
      });
    }

    const products = data.data.products.edges.map(edge => {
      const node = edge.node;
      // Extract numeric ID from gid://shopify/Product/123456
      const id = node.id.split('/').pop();
      return {
        id,
        gid: node.id,
        title: node.title,
        handle: node.handle,
        status: node.status,
        image: node.featuredImage?.url || null,
        priceRange: node.priceRangeV2,
        variants: node.variants.edges.map(vEdge => {
          const vNode = vEdge.node;
          const variantId = vNode.id.split('/').pop();
          return {
            id: variantId,
            gid: vNode.id,
            title: vNode.title,
            sku: vNode.sku,
            price: vNode.price,
            image: vNode.image?.url || null
          };
        })
      };
    });

    res.json({ 
      success: true, 
      products 
    });
  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to search products',
      message: error.message 
    });
  }
};

// Search customers
const searchCustomers = async (req, res, db) => {
  try {
    const { shop, query, limit = 25 } = req.query;

    if (!shop) {
      return res.status(400).json({ 
        success: false, 
        error: 'Shop parameter is required' 
      });
    }

    const accessToken = await getShopAccessToken(shop, db);

    // Use GraphQL for better customer search
    const graphqlQuery = `
      query searchCustomers($query: String!, $first: Int!) {
        customers(first: $first, query: $query) {
          edges {
            node {
              id
              email
              firstName
              lastName
              displayName
              tags
              numberOfOrders
              amountSpent {
                amount
                currencyCode
              }
              createdAt
            }
          }
        }
      }
    `;

    const response = await fetch(`https://${shop}/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: graphqlQuery,
        variables: {
          query: query || '',
          first: parseInt(limit)
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Shopify GraphQL error:', errorText);
      return res.status(response.status).json({ 
        success: false, 
        error: 'Failed to search customers',
        details: errorText
      });
    }

    const data = await response.json();
    
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      return res.status(400).json({ 
        success: false, 
        error: 'GraphQL query error',
        details: data.errors
      });
    }

    const customers = data.data.customers.edges.map(edge => {
      const node = edge.node;
      const id = node.id.split('/').pop();
      return {
        id,
        gid: node.id,
        email: node.email,
        firstName: node.firstName,
        lastName: node.lastName,
        displayName: node.displayName,
        tags: node.tags || [],
        ordersCount: node.numberOfOrders,
        totalSpent: node.amountSpent ? `${node.amountSpent.amount} ${node.amountSpent.currencyCode}` : null,
        createdAt: node.createdAt
      };
    });

    res.json({ 
      success: true, 
      customers 
    });
  } catch (error) {
    console.error('Error searching customers:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to search customers',
      message: error.message 
    });
  }
};

// Search collections
const searchCollections = async (req, res, db) => {
  try {
    const { shop, query, limit = 25 } = req.query;

    if (!shop) {
      return res.status(400).json({ 
        success: false, 
        error: 'Shop parameter is required' 
      });
    }

    const accessToken = await getShopAccessToken(shop, db);

    // Use GraphQL for collection search
    const graphqlQuery = `
      query searchCollections($query: String!, $first: Int!) {
        collections(first: $first, query: $query) {
          edges {
            node {
              id
              title
              handle
              productsCount {
                count
              }
              image {
                url
              }
            }
          }
        }
      }
    `;

    const response = await fetch(`https://${shop}/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: graphqlQuery,
        variables: {
          query: query || '',
          first: parseInt(limit)
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Shopify GraphQL error:', errorText);
      return res.status(response.status).json({ 
        success: false, 
        error: 'Failed to search collections',
        details: errorText
      });
    }

    const data = await response.json();
    
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      return res.status(400).json({ 
        success: false, 
        error: 'GraphQL query error',
        details: data.errors
      });
    }

    const collections = data.data.collections.edges.map(edge => {
      const node = edge.node;
      const id = node.id.split('/').pop();
      return {
        id,
        gid: node.id,
        title: node.title,
        handle: node.handle,
        productsCount: node.productsCount?.count || 0,
        image: node.image?.url || null
      };
    });

    res.json({ 
      success: true, 
      collections 
    });
  } catch (error) {
    console.error('Error searching collections:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to search collections',
      message: error.message 
    });
  }
};

// Get all customer tags from shop
const getCustomerTags = async (req, res, db) => {
  try {
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({ 
        success: false, 
        error: 'Shop parameter is required' 
      });
    }

    const accessToken = await getShopAccessToken(shop, db);

    // Get customers with tags to extract unique tags
    const graphqlQuery = `
      query getCustomerTags {
        customers(first: 250) {
          edges {
            node {
              tags
            }
          }
        }
      }
    `;

    const response = await fetch(`https://${shop}/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: graphqlQuery })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Shopify GraphQL error:', errorText);
      return res.status(response.status).json({ 
        success: false, 
        error: 'Failed to get customer tags',
        details: errorText
      });
    }

    const data = await response.json();
    
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      return res.status(400).json({ 
        success: false, 
        error: 'GraphQL query error',
        details: data.errors
      });
    }

    // Extract unique tags
    const allTags = new Set();
    data.data.customers.edges.forEach(edge => {
      const tags = edge.node.tags || [];
      tags.forEach(tag => allTags.add(tag));
    });

    res.json({ 
      success: true, 
      tags: Array.from(allTags).sort() 
    });
  } catch (error) {
    console.error('Error getting customer tags:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get customer tags',
      message: error.message 
    });
  }
};

// Get all product tags from shop
const getProductTags = async (req, res, db) => {
  try {
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({ 
        success: false, 
        error: 'Shop parameter is required' 
      });
    }

    const accessToken = await getShopAccessToken(shop, db);

    // Get products with tags to extract unique tags
    const graphqlQuery = `
      query getProductTags {
        products(first: 250) {
          edges {
            node {
              tags
            }
          }
        }
      }
    `;

    const response = await fetch(`https://${shop}/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: graphqlQuery })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Shopify GraphQL error:', errorText);
      return res.status(response.status).json({ 
        success: false, 
        error: 'Failed to get product tags',
        details: errorText
      });
    }

    const data = await response.json();
    
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      return res.status(400).json({ 
        success: false, 
        error: 'GraphQL query error',
        details: data.errors
      });
    }

    // Extract unique tags
    const allTags = new Set();
    data.data.products.edges.forEach(edge => {
      const tags = edge.node.tags || [];
      tags.forEach(tag => allTags.add(tag));
    });

    res.json({ 
      success: true, 
      tags: Array.from(allTags).sort() 
    });
  } catch (error) {
    console.error('Error getting product tags:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get product tags',
      message: error.message 
    });
  }
};

// Manual sync pricing rules to metafields
const syncPricingRulesMetafields = async (req, res, db) => {
  try {
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({ 
        success: false, 
        error: 'Shop parameter is required' 
      });
    }

    const accessToken = await getShopAccessToken(shop, db);
    const success = await syncPricingRulesToShopMetafield(shop, accessToken, db);

    if (success) {
      res.json({ 
        success: true, 
        message: 'Pricing rules synced to Shopify metafields successfully'
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to sync pricing rules to metafields'
      });
    }
  } catch (error) {
    console.error('Error syncing pricing rules metafields:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to sync pricing rules',
      message: error.message 
    });
  }
};

// Storefront API - Get pricing rules for theme (app proxy endpoint)
const getStorefrontPricingRules = async (req, res, db) => {
  try {
    // Get shop from app proxy header or query
    const shop = req.query.shop || req.headers['x-shopify-shop-domain'];
    
    if (!shop) {
      return res.status(400).json({ 
        success: false, 
        error: 'Shop parameter is required' 
      });
    }

    // Get all active pricing rules for this shop
    const rules = await db.collection('pricing_rules')
      .find({ shop, status: 'active' })
      .toArray();
    
    // Format rules for storefront (minimal data)
    const storefrontRules = rules.map(rule => ({
      id: rule._id.toString(),
      name: rule.name,
      status: rule.status,
      discountTitle: rule.discountTitle || rule.name,
      applyToCustomers: rule.applyToCustomers,
      customerTags: rule.customerTags || [],
      specificCustomers: (rule.specificCustomers || []).map(c => ({ id: c.id })),
      applyToProducts: rule.applyToProducts,
      specificProducts: (rule.specificProducts || []).map(p => ({ id: p.id })),
      specificVariants: (rule.specificVariants || []).map(v => ({ id: v.id })),
      collections: (rule.collections || []).map(c => ({ id: c.id })),
      productTags: rule.productTags || [],
      priceType: rule.priceType,
      discountValue: rule.discountValue
    }));

    // Set CORS headers for storefront access
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Content-Type': 'application/json'
    });

    res.json({ 
      success: true, 
      rules: storefrontRules 
    });
  } catch (error) {
    console.error('Error getting storefront pricing rules:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get pricing rules'
    });
  }
};

/**
 * Get the "Applies to" product list from the linked Shopify discount (for modal).
 */
const getDiscountProductsFromShopify = async (req, res, db) => {
  try {
    const { shop } = req.query;
    const { id } = req.params;

    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid rule ID' });
    }

    const accessToken = await getShopAccessToken(shop, db);

    const rule = await db.collection('pricing_rules').findOne({
      _id: new ObjectId(id),
      shop
    });

    if (!rule) {
      return res.status(404).json({ error: 'Pricing rule not found' });
    }

    const shopifyDiscountId = rule.shopifyDiscountId;
    if (!shopifyDiscountId) {
      return res.json({
        success: true,
        appliesToAll: false,
        products: rule.specificProducts || []
      });
    }

    const apiVersion = process.env.SHOPIFY_API_VERSION || '2025-01';
    const runGraphQL = async (variables) => {
      const query = `
        query getDiscountItems($id: ID!) {
          discountNode(id: $id) {
            id
            discount {
              ... on DiscountAutomaticBasic {
                customerGets {
                  items {
                    ... on AllDiscountItems { __typename }
                    ... on DiscountProducts {
                      products(first: 250) {
                        edges {
                          node { id title handle }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;
      const res = await fetch(`https://${shop}/admin/api/${apiVersion}/graphql.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, variables })
      });
      return res.json();
    };

    const numericId = String(shopifyDiscountId).match(/\/(\d+)$/)?.[1];
    const basicGid = numericId ? `gid://shopify/DiscountAutomaticBasic/${numericId}` : null;

    // Try Basic GID first (discountNode often returns "invalid id" for Node GID)
    let data = basicGid ? await runGraphQL({ id: basicGid }) : await runGraphQL({ id: shopifyDiscountId });
    let discount = data.data?.discountNode?.discount;
    let items = discount?.customerGets?.items;

    if (!items && basicGid && basicGid !== shopifyDiscountId) {
      data = await runGraphQL({ id: shopifyDiscountId });
      discount = data.data?.discountNode?.discount;
      items = discount?.customerGets?.items;
    }

    // Also try automaticDiscountNode (works even when discountNode returns errors)
    if (!items && shopifyDiscountId) {
      const autoQuery = `
        query getAutoDiscountItems($id: ID!) {
          automaticDiscountNode(id: $id) {
            id
            automaticDiscount {
              ... on DiscountAutomaticBasic {
                customerGets {
                  items {
                    ... on AllDiscountItems { __typename }
                    ... on DiscountProducts {
                      products(first: 250) {
                        edges {
                          node { id title handle }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;
      for (const tryId of [basicGid, shopifyDiscountId].filter(Boolean)) {
        const autoRes = await fetch(`https://${shop}/admin/api/${apiVersion}/graphql.json`, {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query: autoQuery, variables: { id: tryId } })
        });
        const autoData = await autoRes.json();
        const autoDiscount = autoData.data?.automaticDiscountNode?.automaticDiscount;
        const autoItems = autoDiscount?.customerGets?.items;
        if (autoItems && autoItems.products?.edges?.length > 0) {
          items = autoItems;
          discount = { customerGets: { items: autoItems } };
          break;
        }
      }
    }

    if (data.errors) {
      console.error('Kiscience: getDiscountProductsFromShopify GraphQL errors:', data.errors);
      return res.json({
        success: true,
        appliesToAll: false,
        products: rule.specificProducts || []
      });
    }

    const isAllItems = !items || items.__typename === 'AllDiscountItems' || !items.products;
    const productEdges = items?.products?.edges || [];
    let products = productEdges.map(({ node }) => ({
      id: String(node.id).replace(/^gid:\/\/shopify\/Product\//, ''),
      title: node.title || '',
      handle: node.handle || ''
    }));

    // App/function discounts: customerGets not exposed – use our metafield only as last resort
    if (products.length === 0 && shopifyDiscountId) {
      try {
        const mfQuery = `
          query getDiscountMetafields($ownerId: ID!) {
            metafields(first: 5, ownerId: $ownerId, namespace: "$app:kiscience") {
              edges {
                node {
                  key
                  value
                }
              }
            }
          }
        `;
        const mfRes = await fetch(`https://${shop}/admin/api/${apiVersion}/graphql.json`, {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query: mfQuery, variables: { ownerId: shopifyDiscountId } })
        });
        const mfData = await mfRes.json();
        const edges = mfData.data?.metafields?.edges || [];
        const configMf = edges.find((e) => e.node?.key === 'pricing-config');
        if (configMf?.node?.value) {
          const config = JSON.parse(configMf.node.value);
          products = Array.isArray(config.specificProducts) ? config.specificProducts : [];
        }
      } catch (e) {
        console.warn('Kiscience: getDiscountProductsFromShopify metafield fallback:', e.message);
      }
    }

    if (products.length === 0 && (rule.specificProducts || []).length > 0) {
      products = rule.specificProducts;
    }

    return res.json({
      success: true,
      appliesToAll: isAllItems && products.length === 0,
      products
    });
  } catch (err) {
    console.error('Kiscience: getDiscountProductsFromShopify error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to load discount products'
    });
  }
};

/**
 * Update rule's product list and sync to Shopify discount (for product modal confirm).
 */
const updateRuleProducts = async (req, res, db) => {
  try {
    const { shop } = req.query;
    const { id } = req.params;
    const { specificProducts } = req.body || {};

    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid rule ID' });
    }

    const accessToken = await getShopAccessToken(shop, db);

    const rule = await db.collection('pricing_rules').findOne({
      _id: new ObjectId(id),
      shop
    });

    if (!rule) {
      return res.status(404).json({ error: 'Pricing rule not found' });
    }

    const products = Array.isArray(specificProducts) ? specificProducts : [];
    const applyToProducts = products.length > 0 ? 'specific_products' : 'all';

    // Previous product list (before this save) — use as "current on store" when API/metafield return none, so we can compute productsToRemove
    const previousProductGids = (rule.specificProducts || []).map((p) => toProductGid(typeof p === 'object' ? p.id : p)).filter(Boolean);

    await db.collection('pricing_rules').updateOne(
      { _id: new ObjectId(id), shop },
      {
        $set: {
          applyToProducts,
          specificProducts: products,
          updatedAt: new Date()
        }
      }
    );

    const updatedRule = await db.collection('pricing_rules').findOne({ _id: new ObjectId(id), shop });
    const ruleForSync = {
      ...updatedRule,
      id: updatedRule._id.toString(),
      specificProducts: updatedRule.specificProducts || [],
      specificVariants: updatedRule.specificVariants || [],
      collections: updatedRule.collections || [],
      productTags: updatedRule.productTags || []
    };

    const shopifyDiscountId = rule.shopifyDiscountId;
    console.log('[App] updateRuleProducts: rule', id, 'products count', products.length, 'applyTo', applyToProducts, 'shopifyDiscountId', shopifyDiscountId || 'none');
    if (shopifyDiscountId) {
      await updateShopifyDiscount(shop, accessToken, ruleForSync, shopifyDiscountId, previousProductGids);
      await syncRuleToDiscountMetafield(shop, accessToken, ruleForSync, shopifyDiscountId);
      console.log('[App → Store] updateRuleProducts: synced to store discount', shopifyDiscountId);
    }
    await syncPricingRulesToShopMetafield(shop, accessToken, db);

    return res.json({
      success: true,
      message: 'Product selection updated and synced to discount.',
      specificProducts: updatedRule.specificProducts
    });
  } catch (err) {
    console.error('[App] updateRuleProducts error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to update products'
    });
  }
};

/**
* Verify if segment has been assigned to the discount
* Checks Shopify discount to see if customer segments are configured
*/
const verifySegmentAssignment = async (req, res, db) => {
  try {
    const { shop } = req.query;
    const { id } = req.params;

    if (!shop) {
      return res.status(400).json({ 
        success: false, 
        error: 'Shop parameter is required' 
      });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid rule ID' 
      });
    }

    const accessToken = await getShopAccessToken(shop, db);

    // Get the pricing rule
    const rule = await db.collection('pricing_rules').findOne({
      _id: new ObjectId(id),
      shop
    });

    if (!rule) {
      return res.status(404).json({ 
        success: false, 
        error: 'Pricing rule not found' 
      });
    }

    if (!rule.shopifyDiscountId) {
      return res.status(404).json({ 
        success: false, 
        error: 'No Shopify discount associated with this rule',
        segmentAssigned: false
      });
    }

    // Query Shopify 2025-10: segment eligibility is on context (not customerSelection)
    const query = `
      query getDiscount($id: ID!) {
        discountNode(id: $id) {
          id
          discount {
            ... on DiscountAutomaticApp {
              title
              context {
                ... on DiscountCustomerSegments {
                  segments { id name }
                }
              }
            }
            ... on DiscountAutomaticBasic {
              title
              context {
                ... on DiscountCustomerSegments {
                  segments { id name }
                }
              }
            }
          }
        }
      }
    `;

    const variables = {
      id: rule.shopifyDiscountId
    };

    // Use 2025-10 so segment eligibility is returned (older versions filter out segment-based discounts)
    const verifyApiVersion = '2025-10';
    const response = await fetch(`https://${shop}/admin/api/${verifyApiVersion}/graphql.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, variables })
    });

    const data = await response.json();

    if (data.errors) {
      console.error('GraphQL errors (verify segment):', data.errors);
      return res.status(400).json({ 
        success: false, 
        error: 'Failed to fetch discount details',
        details: data.errors
      });
    }

    const discount = data.data?.discountNode?.discount;
    const context = discount?.context;

    // 2025-10: context is union; when segment-based, context has segments { id name }
    let segmentAssigned = false;
    let assignedSegments = [];
    const segments = context?.segments;
    if (Array.isArray(segments) && segments.length > 0) {
      segmentAssigned = true;
      assignedSegments = segments.map((seg) => ({
        id: seg.id,
        name: seg.name || seg.id
      }));

      await db.collection('pricing_rules').updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            segmentAssigned: true,
            assignedSegments: assignedSegments,
            updatedAt: new Date()
          }
        }
      );
    }

    res.json({
      success: true,
      segmentAssigned,
      assignedSegments,
      context
    });
  } catch (error) {
    console.error('Error verifying segment assignment:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to verify segment assignment',
      message: error.message 
    });
  }
};

/**
 * Get customer segments from Shopify
 */
const getCustomerSegments = async (req, res, db) => {
  try {
    const { shop } = req.query;

    // ✅ Only shop is required
    if (!shop) {
      return res.status(400).json({
        success: false,
        error: 'Shop parameter is required',
      });
    }

    const accessToken = await getShopAccessToken(shop, db);

    const graphqlQuery = `
      query getSegments {
        segments(first: 50) {
          edges {
            node {
              id
              name
              query
              creationDate
            }
          }
        }
      }
    `;

    const response = await fetch(
      `https://${shop}/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: graphqlQuery }),
      }
    );

    const data = await response.json();

    if (data.errors) {
      return res.status(400).json({
        success: false,
        error: 'GraphQL query error',
        details: data.errors,
      });
    }

    const segments = data.data.segments.edges.map(({ node }) => ({
      id: node.id,
      name: node.name,
      query: node.query,
      createdAt: node.creationDate,
    }));

    res.json({
      success: true,
      segments,
    });
  } catch (error) {
    console.error('Error getting customer segments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get customer segments',
    });
  }
};






// API version where context.customerSegments is available (2025-10+)
const DISCOUNT_CONTEXT_API_VERSION = '2025-10';

/** Extract numeric ID from any discount GID (e.g. gid://shopify/DiscountAutomaticNode/123 or gid://shopify/DiscountAutomaticBasic/123). */
function extractDiscountNumericId(id) {
  const str = String(id).trim();
  const match = str.match(/\/(\d+)$/);
  return match ? match[1] : str;
}

/** Build concrete discount GID. Update mutations require DiscountAutomaticBasic or DiscountAutomaticApp, not DiscountAutomaticNode. */
function toDiscountGid(id, type) {
  const str = String(id).trim();
  const numeric = extractDiscountNumericId(id);
  const suffix = type === 'Basic' ? 'Basic' : 'App';
  return `gid://shopify/DiscountAutomatic${suffix}/${numeric}`;
}

/** True if this GID is a generic Node (needs trying both Basic and App) or plain numeric. */
function isDiscountNodeOrNumeric(id) {
  const str = String(id).trim();
  if (!str.startsWith('gid://')) return true;
  return str.includes('DiscountAutomaticNode') || (!str.includes('DiscountAutomaticBasic') && !str.includes('DiscountAutomaticApp'));
}

/** Run one GraphQL request and return { data, errors, userErrors from payload }. */
async function graphqlDiscount(shop, accessToken, query, variables, operationKey) {
  const response = await fetch(
    `https://${shop}/admin/api/${DISCOUNT_CONTEXT_API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    }
  );
  const data = await response.json();
  const payload = data.data?.[operationKey];
  return { data, errors: data.errors, userErrors: payload?.userErrors || [] };
}

/**
 * Assign a customer segment to a discount
 * Supports both DiscountAutomaticBasic (e.g. Amount off products) and DiscountAutomaticApp (function-based).
 * Uses Admin API 2025-10 for context.customerSegments.
 */
/** Build minimumRequirement for 2025-10 discount input. options: { type: 'none'|'quantity'|'subtotal', quantity?, amount?, currencyCode? } */
function buildMinimumRequirement(options) {
  if (!options || options.type === 'none') return null;
  if (options.type === 'quantity' && options.quantity != null) {
    return { quantity: { greaterThanOrEqualToQuantity: String(Math.max(1, Math.floor(options.quantity))) } };
  }
  if (options.type === 'subtotal' && options.amount != null) {
    return {
      subtotal: {
        greaterThanOrEqualToSubtotal: {
          amount: String(Number(options.amount).toFixed(2)),
          currencyCode: (options.currencyCode || 'GBP').toUpperCase()
        }
      }
    };
  }
  return null;
}

/** Build combinesWith for discount input. options: { productDiscounts?, orderDiscounts?, shippingDiscounts? } booleans */
function buildCombinesWith(options) {
  if (!options || typeof options !== 'object') return undefined;
  const out = {};
  if (typeof options.productDiscounts === 'boolean') out.productDiscounts = options.productDiscounts;
  if (typeof options.orderDiscounts === 'boolean') out.orderDiscounts = options.orderDiscounts;
  if (typeof options.shippingDiscounts === 'boolean') out.shippingDiscounts = options.shippingDiscounts;
  return Object.keys(out).length ? out : undefined;
}

const assignSegmentToDiscount = async (req, res, db) => {
  try {
    const { shop } = req.query;
    let {
      discountId,
      segmentId,
      minimumRequirement: minReqOpts,
      combinesWith: combinesWithOpts
    } = req.body;

    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    if (!discountId || !segmentId) {
      return res.status(400).json({
        error: 'Both discountId and segmentId are required'
      });
    }

    const shopData = await db.collection('shops').findOne({ shop });
    if (!shopData) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    const accessToken = shopData.accessToken;
    const minimumRequirement = buildMinimumRequirement(minReqOpts);
    const combinesWith = buildCombinesWith(combinesWithOpts);
    const baseContext = { context: { customerSegments: { add: [segmentId] } } };
    const basicInput = {
      ...baseContext,
      ...(minimumRequirement != null && { minimumRequirement }),
      ...(combinesWith && { combinesWith })
    };
    const appInput = {
      ...baseContext,
      ...(combinesWith && { combinesWith })
    };

    // Docs: discountAutomaticAppUpdate accepts gid://shopify/DiscountAutomaticNode/123. Try Node GID as-is first, then concrete Basic/App if needed.
    const idStr = String(discountId).trim();
    const isNodeGid = idStr.includes('DiscountAutomaticNode');
    const idBasic = toDiscountGid(discountId, 'Basic');
    const idApp = toDiscountGid(discountId, 'App');
    const idToTryBasic = isNodeGid ? discountId : (idStr.startsWith('gid://') && idStr.includes('Basic') ? discountId : idBasic);
    const idToTryApp = isNodeGid ? discountId : (idStr.startsWith('gid://') && idStr.includes('App') ? discountId : idApp);

    const runAppUpdate = async (id) => {
      const mutation = `
        mutation discountAutomaticAppUpdate($id: ID!, $automaticAppDiscount: DiscountAutomaticAppInput!) {
          discountAutomaticAppUpdate(id: $id, automaticAppDiscount: $automaticAppDiscount) {
            automaticAppDiscount { discountId title }
            userErrors { field message }
          }
        }
      `;
      return graphqlDiscount(shop, accessToken, mutation, {
        id,
        automaticAppDiscount: appInput
      }, 'discountAutomaticAppUpdate');
    };

    const runBasicUpdate = async (id) => {
      const mutation = `
        mutation discountAutomaticBasicUpdate($id: ID!, $automaticBasicDiscount: DiscountAutomaticBasicInput!) {
          discountAutomaticBasicUpdate(id: $id, automaticBasicDiscount: $automaticBasicDiscount) {
            automaticDiscountNode { id }
            userErrors { field message }
          }
        }
      `;
      return graphqlDiscount(shop, accessToken, mutation, {
        id,
        automaticBasicDiscount: basicInput
      }, 'discountAutomaticBasicUpdate');
    };

    const hasNotFoundError = (userErrors) =>
      userErrors.some(e => e.message && (e.message.includes('does not exist') || e.message.includes('Discount does not exist')));

    /** Top-level GraphQL errors can mean "wrong type" - try other mutation. */
    const isNotFoundOrInvalidId = (errors) =>
      Array.isArray(errors) && errors.some(e =>
        (e.message && (e.message.includes('Invalid id') || e.message.includes('does not exist'))) ||
        (e.extensions && e.extensions.code === 'RESOURCE_NOT_FOUND'));

    // Try Basic update first (with Node GID or Basic GID)
    const { data: dataBasic, errors: errorsBasic, userErrors: userErrorsBasic } = await runBasicUpdate(idToTryBasic);
    if (errorsBasic?.length && !isNotFoundOrInvalidId(errorsBasic)) {
      return res.status(400).json({ success: false, error: `GraphQL error: ${JSON.stringify(errorsBasic)}` });
    }
    if (!errorsBasic?.length && userErrorsBasic.length === 0) {
      const payload = dataBasic?.discountAutomaticBasicUpdate;
      return res.json({ success: true, discount: payload?.automaticDiscountNode, message: 'Customer segment assigned successfully' });
    }
    if (errorsBasic?.length === 0 && !hasNotFoundError(userErrorsBasic)) {
      return res.status(400).json({ success: false, error: userErrorsBasic.map(e => e.message).join(', ') });
    }

    // Basic failed (wrong type or not found) -> try App update with Node GID or App GID
    const { data, errors, userErrors } = await runAppUpdate(idToTryApp);
    if (errors?.length) {
      return res.status(400).json({ success: false, error: `GraphQL error: ${JSON.stringify(errors)}` });
    }
    if (userErrors.length === 0) {
      const payload = data?.discountAutomaticAppUpdate;
      return res.json({ success: true, discount: payload?.automaticAppDiscount, message: 'Customer segment assigned successfully' });
    }
    return res.status(400).json({ success: false, error: userErrors.map(e => e.message).join(', ') });
  } catch (error) {
    console.error('Error assigning segment to discount:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Remove a customer segment from a discount (syncs to store discount).
 * Uses Shopify context.customerSegments.remove (Admin API 2025-10).
 */
const removeSegmentFromDiscount = async (req, res, db) => {
  try {
    const { shop } = req.query;
    const { discountId, segmentId } = req.body || {};

    console.log('[App → Store] Remove segment: request', { shop, discountId, segmentId });

    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }

    if (!discountId || !segmentId) {
      return res.status(400).json({
        success: false,
        error: 'Both discountId and segmentId are required'
      });
    }

    const shopData = await db.collection('shops').findOne({ shop });
    if (!shopData) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    const accessToken = shopData.accessToken;
    const baseContext = { context: { customerSegments: { remove: [segmentId] } } };

    const idStr = String(discountId).trim();
    const isNodeGid = idStr.includes('DiscountAutomaticNode');
    const idBasic = toDiscountGid(discountId, 'Basic');
    const idApp = toDiscountGid(discountId, 'App');
    const idToTryBasic = isNodeGid ? discountId : (idStr.startsWith('gid://') && idStr.includes('Basic') ? discountId : idBasic);
    const idToTryApp = isNodeGid ? discountId : (idStr.startsWith('gid://') && idStr.includes('App') ? discountId : idApp);

    const runAppUpdate = async (id) => {
      const mutation = `
        mutation discountAutomaticAppUpdate($id: ID!, $automaticAppDiscount: DiscountAutomaticAppInput!) {
          discountAutomaticAppUpdate(id: $id, automaticAppDiscount: $automaticAppDiscount) {
            automaticAppDiscount { discountId title }
            userErrors { field message }
          }
        }
      `;
      return graphqlDiscount(shop, accessToken, mutation, {
        id,
        automaticAppDiscount: baseContext
      }, 'discountAutomaticAppUpdate');
    };

    const runBasicUpdate = async (id) => {
      const mutation = `
        mutation discountAutomaticBasicUpdate($id: ID!, $automaticBasicDiscount: DiscountAutomaticBasicInput!) {
          discountAutomaticBasicUpdate(id: $id, automaticBasicDiscount: $automaticBasicDiscount) {
            automaticDiscountNode { id }
            userErrors { field message }
          }
        }
      `;
      return graphqlDiscount(shop, accessToken, mutation, {
        id,
        automaticBasicDiscount: baseContext
      }, 'discountAutomaticBasicUpdate');
    };

    const hasNotFoundError = (userErrors) =>
      userErrors.some(e => e.message && (e.message.includes('does not exist') || e.message.includes('Discount does not exist')));
    const isNotFoundOrInvalidId = (errors) =>
      Array.isArray(errors) && errors.some(e =>
        (e.message && (e.message.includes('Invalid id') || e.message.includes('does not exist'))) ||
        (e.extensions && e.extensions.code === 'RESOURCE_NOT_FOUND'));

    const { data: dataBasic, errors: errorsBasic, userErrors: userErrorsBasic } = await runBasicUpdate(idToTryBasic);
    if (errorsBasic?.length && !isNotFoundOrInvalidId(errorsBasic)) {
      console.log('[App → Store] Remove segment: failed (GraphQL)', errorsBasic);
      return res.status(400).json({ success: false, error: `GraphQL error: ${JSON.stringify(errorsBasic)}` });
    }
    if (!errorsBasic?.length && userErrorsBasic.length === 0) {
      console.log('[App → Store] Remove segment: success — segment removed in app and store discount');
      return res.json({ success: true, message: 'Customer segment removed from discount' });
    }
    if (errorsBasic?.length === 0 && !hasNotFoundError(userErrorsBasic)) {
      console.log('[App → Store] Remove segment: failed (userErrors)', userErrorsBasic);
      return res.status(400).json({ success: false, error: userErrorsBasic.map(e => e.message).join(', ') });
    }

    const { data, errors, userErrors } = await runAppUpdate(idToTryApp);
    if (errors?.length) {
      console.log('[App → Store] Remove segment: failed (GraphQL)', errors);
      return res.status(400).json({ success: false, error: `GraphQL error: ${JSON.stringify(errors)}` });
    }
    if (userErrors.length === 0) {
      console.log('[App → Store] Remove segment: success — segment removed in app and store discount');
      return res.json({ success: true, message: 'Customer segment removed from discount' });
    }
    console.log('[App → Store] Remove segment: failed (userErrors)', userErrors);
    return res.status(400).json({ success: false, error: userErrors.map(e => e.message).join(', ') });
  } catch (error) {
    console.error('[App → Store] Remove segment: error', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};


module.exports = {
  // Pricing Rules CRUD
  getPricingRules,
  getPricingRuleById,
  createPricingRule,
  updatePricingRule,
  deletePricingRule,
  
  // Shopify Search
  searchProducts,
  searchCustomers,
  searchCollections,
  getCustomerTags,
  getProductTags,
  
  // Metafield Sync
  syncPricingRulesMetafields,
  
  // Storefront API
  getStorefrontPricingRules,

  // segment API
  verifySegmentAssignment,
  getCustomerSegments,
  assignSegmentToDiscount,
  removeSegmentFromDiscount,

  getDiscountProductsFromShopify,
  updateRuleProducts
};
