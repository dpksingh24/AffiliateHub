/**
 * Custom Pricing Controller
 * Handles CRUD operations for custom pricing rules
 * and Shopify product/customer/collection search
 * Integrates with Shopify Automatic Discounts API and Metafields
 */

const { ObjectId } = require('mongodb');

// ===== SHOPIFY HELPER FUNCTIONS =====

// Helper function to get shop access token
const getShopAccessToken = async (shop, db) => {
  const shopData = await db.collection('shops').findOne({ shop });
  if (!shopData || !shopData.accessToken) {
    throw new Error('Shop not authenticated');
  }
  return shopData.accessToken;
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

// Build product selection for Shopify discount
const buildProductSelection = (rule) => {
  switch (rule.applyToProducts) {
    case 'all':
      return { all: true };
    case 'specific_products':
      if (rule.specificProducts && rule.specificProducts.length > 0) {
        return {
          products: {
            productsToAdd: rule.specificProducts.map(p => `gid://shopify/Product/${p.id}`)
          }
        };
      }
      return { all: true };
    case 'specific_variants':
      if (rule.specificVariants && rule.specificVariants.length > 0) {
        // IMPORTANT: Shopify API doesn't support variant-only targeting in automatic discounts
        // When you target specific variants, Shopify applies to all variants of those products
        // Solution: Target the product level and let the metafield/theme handle variant filtering
        const uniqueProductIds = [...new Set(rule.specificVariants.map(v => v.productId))];
        return {
          products: {
            productsToAdd: uniqueProductIds.map(id => `gid://shopify/Product/${id}`)
          }
        };
        // COMMENTED OUT: productVariantsToAdd causes "has some of its variants entitled" error
        // return {
        //   products: {
        //     productVariantsToAdd: rule.specificVariants.map(v => `gid://shopify/ProductVariant/${v.id}`)
        //   }
        // };
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

// Create Shopify Automatic Discount
// How it works:
// When you set new_price = £2 for a product that costs £40
// System fetches the product's original price (£40)
// Calculates: £40 - £2 = £38 amount off
// Creates Shopify discount with £38 amount off
// At checkout, the discount applies automatically: £40 - £38 = £2

const createShopifyDiscount = async (shop, accessToken, rule, ruleId) => {
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
  
  if ((rule.applyToCustomers === 'customer_tags' && rule.customerTags && rule.customerTags.length > 0) ||
      (rule.applyToCustomers === 'specific' && rule.specificCustomers && rule.specificCustomers.length > 0) ||
      rule.applyToCustomers === 'non_logged_in') {
    console.log(`Kiscience: Skipping Shopify discount for ${rule.applyToCustomers} rule: ${rule.name}`);
    console.log('         Reason: Shopify automatic discounts cannot filter by this customer condition');
    console.log('         The theme app extension will handle discount display/calculation on PDP');
    console.log('         At checkout: Discount will NOT appear (Shopify limitation)');
    return null;
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
const updateShopifyDiscount = async (shop, accessToken, rule, shopifyDiscountId) => {
  const discountTitle = rule.discountTitle || rule.name;
  
  // Check if rule has customer filtering that prevents Shopify discount creation
  if ((rule.applyToCustomers === 'customer_tags' && rule.customerTags && rule.customerTags.length > 0) ||
      (rule.applyToCustomers === 'specific' && rule.specificCustomers && rule.specificCustomers.length > 0) ||
      rule.applyToCustomers === 'non_logged_in') {
    if (shopifyDiscountId) {
      try {
        await deleteShopifyDiscount(shop, accessToken, shopifyDiscountId);
        console.log(`Kiscience: Deleted Shopify discount for ${rule.applyToCustomers} rule: ${rule.name}`);
        console.log('         The theme app extension will handle filtering on PDP');
      } catch (error) {
        console.error('Kiscience: Error deleting discount:', error);
      }
    }
    return null;
  }
  
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
  
  // Build product selection first to determine if we're targeting all items
  const productSelection = buildProductSelection(rule);
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
  
  const variables = {
    id: shopifyDiscountId,
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
    console.error('Shopify GraphQL errors:', data.errors);
    throw new Error(`Failed to update Shopify discount: ${JSON.stringify(data.errors)}`);
  }
  
  const result = data.data.discountAutomaticBasicUpdate;
  
  if (result.userErrors && result.userErrors.length > 0) {
    console.error('Shopify user errors:', result.userErrors);
    
    // Check if discount doesn't exist - this means it was deleted or never existed
    const hasNotFoundError = result.userErrors.some(err => 
      err.message && (err.message.includes('does not exist') || err.message.includes('Discount does not exist'))
    );
    
    if (hasNotFoundError) {
      console.log('Kiscience: Discount does not exist in Shopify - will create new one');
      return null; // Return null to indicate discount needs to be created
    }
    
    throw new Error(`Failed to update Shopify discount: ${result.userErrors.map(e => e.message).join(', ')}`);
  }
  
  // Return the discount ID on success
  return result.automaticDiscountNode?.id || shopifyDiscountId;
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
        shopifyDiscountId = await createShopifyDiscount(shop, accessToken, newRule, ruleId);
        
        // Update the rule with Shopify discount ID
        if (shopifyDiscountId) {
          await db.collection('pricing_rules').updateOne(
            { _id: result.insertedId },
            { $set: { shopifyDiscountId } }
          );
          newRule.shopifyDiscountId = shopifyDiscountId;
          
          // Sync rule config to discount metafield for Shopify Function
          await syncRuleToDiscountMetafield(shop, accessToken, newRule, shopifyDiscountId);
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
      shopifyDiscountId,
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
        if (shopifyDiscountId) {
          try {
            // Update existing Shopify discount
            // Note: updateShopifyDiscount returns null for new_price (it deletes the discount) or if discount doesn't exist
            const updatedDiscountId = await updateShopifyDiscount(shop, accessToken, { ...existingRule, ...updateData }, shopifyDiscountId);
            
            if (updatedDiscountId) {
              // Discount was updated successfully
              // Activate if it was inactive
              if (!wasActive) {
                await updateShopifyDiscountStatus(shop, accessToken, shopifyDiscountId, true);
              }
              
              // Sync rule config to discount metafield
              await syncRuleToDiscountMetafield(shop, accessToken, { ...existingRule, ...updateData }, shopifyDiscountId);
            } else {
              // Discount was deleted or doesn't exist (e.g., price type changed to new_price, or discount was manually deleted)
              // Create a new discount instead
              console.log('Kiscience: Discount not found or deleted - creating new discount');
              shopifyDiscountId = await createShopifyDiscount(shop, accessToken, { ...existingRule, ...updateData }, id);
              
              // Update the shopifyDiscountId in database
              if (shopifyDiscountId) {
                await db.collection('pricing_rules').updateOne(
                  { _id: new ObjectId(id) },
                  { $set: { shopifyDiscountId } }
                );
                
                // Sync rule config to discount metafield
                await syncRuleToDiscountMetafield(shop, accessToken, { ...existingRule, ...updateData }, shopifyDiscountId);
              } else {
                // Clear the shopifyDiscountId from database if creation failed (e.g., new_price type)
                await db.collection('pricing_rules').updateOne(
                  { _id: new ObjectId(id) },
                  { $unset: { shopifyDiscountId: "" } }
                );
              }
            }
          } catch (updateErr) {
            // If update fails with "does not exist" error, create a new discount
            if (updateErr.message && updateErr.message.includes('does not exist')) {
              console.log('Kiscience: Discount does not exist - creating new discount');
              shopifyDiscountId = await createShopifyDiscount(shop, accessToken, { ...existingRule, ...updateData }, id);
              
              if (shopifyDiscountId) {
                await db.collection('pricing_rules').updateOne(
                  { _id: new ObjectId(id) },
                  { $set: { shopifyDiscountId } }
                );
                
                await syncRuleToDiscountMetafield(shop, accessToken, { ...existingRule, ...updateData }, shopifyDiscountId);
              } else {
                await db.collection('pricing_rules').updateOne(
                  { _id: new ObjectId(id) },
                  { $unset: { shopifyDiscountId: "" } }
                );
              }
            } else {
              // Re-throw other errors
              throw updateErr;
            }
          }
        } else {
          // Create new Shopify discount (only for percent_off and amount_off)
          shopifyDiscountId = await createShopifyDiscount(shop, accessToken, { ...existingRule, ...updateData }, id);
          
          // Update the shopifyDiscountId in database
          if (shopifyDiscountId) {
            await db.collection('pricing_rules').updateOne(
              { _id: new ObjectId(id) },
              { $set: { shopifyDiscountId } }
            );
            
            // Sync rule config to discount metafield
            await syncRuleToDiscountMetafield(shop, accessToken, { ...existingRule, ...updateData }, shopifyDiscountId);
          }
          // Note: If shopifyDiscountId is null (e.g., new_price type), no Shopify discount is created
          // The theme app extension handles new_price display on the storefront
        }
      } else if (!isActive && shopifyDiscountId) {
        // Deactivate Shopify discount (only if it exists)
        try {
          await updateShopifyDiscountStatus(shop, accessToken, shopifyDiscountId, false);
        } catch (deactivateErr) {
          // If discount doesn't exist, just clear the ID from database
          if (deactivateErr.message && deactivateErr.message.includes('does not exist')) {
            console.log('Kiscience: Discount does not exist when deactivating - clearing from database');
            await db.collection('pricing_rules').updateOne(
              { _id: new ObjectId(id) },
              { $unset: { shopifyDiscountId: "" } }
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

    res.json({ 
      success: true, 
      message: shopifyError 
        ? `Pricing rule updated but Shopify sync failed: ${shopifyError}`
        : 'Pricing rule updated and synced with Shopify',
      rule: {
        ...existingRule,
        ...updateData,
        id: existingRule._id.toString(),
        shopifyDiscountId
      }
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
  getStorefrontPricingRules
};
