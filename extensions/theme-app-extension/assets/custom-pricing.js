(function() {
  'use strict';

  var configEl = document.getElementById('kiscience-config');
  var rulesEl = document.getElementById('kiscience-rules');
  var config = {};
  var rules = [];
  try {
    if (configEl && configEl.textContent) config = JSON.parse(configEl.textContent);
  } catch (e) {}
  try {
    if (rulesEl && rulesEl.textContent) {
      var parsed = JSON.parse(rulesEl.textContent);
      rules = Array.isArray(parsed) ? parsed : (parsed && parsed.rules ? parsed.rules : []);
    }
  } catch (e) {}
  window.KiscienceConfig = config;
  window.KisciencePricingRules = rules;
  if (!rules || !rules.length) return;

  function formatMoney(amount, currency) {
    var formatted = parseFloat(amount).toFixed(2);
    switch (currency || config.currency || 'GBP') {
      case 'GBP': return '£' + formatted;
      case 'EUR': return '€' + formatted;
      case 'USD': return '$' + formatted;
      default: return currency + ' ' + formatted;
    }
  }

  function customerMatches(rule) {
    switch (rule.applyToCustomers) {
      case 'all':
        return true;
      case 'logged_in':
        return config.customerLoggedIn;
      case 'non_logged_in':
        return !config.customerLoggedIn;
      case 'specific':
        if (!config.customerLoggedIn || !rule.specificCustomers) return false;
        return rule.specificCustomers.some(function(c) {
          return String(c.id) === String(config.customerId);
        });
      case 'customer_tags':
        if (!config.customerLoggedIn || !rule.customerTags) return false;
        return rule.customerTags.some(function(tag) {
          return (config.customerTags || []).indexOf(tag) !== -1;
        });
      default:
        return false;
    }
  }

  function productMatches(rule, productId, variantId, productTags, productCollections) {
    var productIdNum = String(productId).replace(/\D/g, '');
    var variantIdNum = String(variantId).replace(/\D/g, '');
    switch (rule.applyToProducts) {
      case 'all':
        return true;
      case 'specific_products':
        if (!rule.specificProducts) return false;
        return rule.specificProducts.some(function(p) {
          return String(p.id) === productIdNum;
        });
      case 'specific_variants':
        if (!rule.specificVariants) return false;
        return rule.specificVariants.some(function(v) {
          return String(v.id) === variantIdNum;
        });
      case 'collections':
        if (!rule.collections || !productCollections) return false;
        return rule.collections.some(function(c) {
          return productCollections.indexOf(String(c.id)) !== -1;
        });
      case 'product_tags':
        if (!rule.productTags || !productTags) return false;
        return rule.productTags.some(function(tag) {
          return productTags.indexOf(tag) !== -1;
        });
      default:
        return false;
    }
  }

  // Calculate custom price
  function calculatePrice(rule, originalPrice) {
    var discount = parseFloat(rule.discountValue);
    switch (rule.priceType) {
      case 'percent_off':
        return originalPrice * (1 - discount / 100);
      case 'amount_off':
        return Math.max(0, originalPrice - discount);
      case 'new_price':
        return discount;
      default:
        return originalPrice;
    }
  }

  function findMatchingRule(productId, variantId, productTags, productCollections) {
    for (var i = 0; i < rules.length; i++) {
      var rule = rules[i];
      if (rule.status !== 'active') continue;
      if (customerMatches(rule) && productMatches(rule, productId, variantId, productTags, productCollections)) return rule;
    }
    return null;
  }

  // Extract price from text
  function extractPrice(text) {
    if (!text) return null;
    var match = text.match(/[\d,]+\.?\d*/);
    if (match) {
      return parseFloat(match[0].replace(/,/g, ''));
    }
    return null;
  }

  // Parse price from JSON (may be string "16.50" or cents number)
  function parseVariantPrice(val) {
    if (val == null || val === '') return null;
    var num = parseFloat(String(val).replace(/,/g, ''));
    if (isNaN(num)) return null;
    if (num > 1000 && num === Math.floor(num)) num = num / 100; // cents
    return num;
  }

  // Get original price for a variant from product JSON (reliable on variant switch; theme may not have updated DOM yet)
  // Uses the higher of compare_at_price and price so strikethrough always shows the true "original" (never the sale price).
  function getOriginalPriceFromProductJson(variantId) {
    if (!variantId) return null;
    var variantIdStr = String(variantId).replace(/\D/g, '');
    var scripts = document.querySelectorAll('script[type="application/json"]');
    for (var i = 0; i < scripts.length; i++) {
      try {
        var json = JSON.parse(scripts[i].textContent);
        if (!json || !json.variants || !Array.isArray(json.variants)) continue;
        for (var j = 0; j < json.variants.length; j++) {
          var v = json.variants[j];
          if (String(v.id).replace(/\D/g, '') === variantIdStr) {
            var compareAt = parseVariantPrice(v.compare_at_price);
            var price = parseVariantPrice(v.price);
            // Use the higher as "original" so we never show a sale price as the strikethrough (e.g. price=15.53, compare_at=16.50 -> 16.50)
            if (compareAt != null && price != null) return Math.max(compareAt, price);
            if (compareAt != null && compareAt > 0) return compareAt;
            if (price != null) return price;
            return null;
          }
        }
      } catch (e) {}
    }
    return null;
  }

  function getProductData() {
    var data = {
      productId: null,
      variantId: null,
      productTags: [],
      productCollections: []
    };

    // Method 1: Look for product JSON (common in many themes)
    var scripts = document.querySelectorAll('script[type="application/json"]');
    scripts.forEach(function(script) {
      try {
        var json = JSON.parse(script.textContent);
        if (json && json.id && (json.variants || json.title)) {
          data.productId = json.id;
          data.variantId = json.selected_variant ? json.selected_variant.id : 
                          (json.variants && json.variants[0] ? json.variants[0].id : null);
          data.productTags = json.tags || [];
        }
      } catch (e) {}
    });

    // Method 2: From form input
    if (!data.productId) {
      var productInput = document.querySelector('form[action*="/cart/add"] input[name="product-id"], input[data-product-id]');
      if (productInput) {
        data.productId = productInput.value || productInput.dataset.productId;
      }
    }

    // Method 3: From data attributes
    if (!data.productId) {
      var productEl = document.querySelector('[data-product-id]');
      if (productEl) {
        data.productId = productEl.dataset.productId;
      }
    }

    // Method 4: From meta tags
    if (!data.productId) {
      var metaProduct = document.querySelector('meta[property="og:id"], meta[property="product:id"]');
      if (metaProduct) {
        data.productId = metaProduct.content;
      }
    }
    
    // Method 5: Look in window object (many themes expose this)
    if (!data.productId && window.product) {
      data.productId = window.product.id;
      data.productTags = window.product.tags || [];
    }
    
    if (!data.productId && window.ShopifyAnalytics && window.ShopifyAnalytics.meta && window.ShopifyAnalytics.meta.product) {
      data.productId = window.ShopifyAnalytics.meta.product.id;
    }

    // Get variant from select or URL
    var variantSelect = document.querySelector('select[name="id"], input[name="id"]:checked, input[name="id"][type="hidden"]');
    if (variantSelect) {
      data.variantId = variantSelect.value;
    }
    if (!data.variantId) {
      var urlParams = new URLSearchParams(window.location.search);
      data.variantId = urlParams.get('variant');
    }
    // Fallback: resolve variant from selected option values (e.g. theme uses radios name="Size" value="250ml" with [data-variant-option])
    if (!data.variantId && data.productId) {
      var optionContainers = Array.prototype.slice.call(document.querySelectorAll('[data-variant-option]'));
      optionContainers.sort(function(a, b) {
        var i = parseInt(a.getAttribute('data-variant-option-index'), 10) || 0;
        var j = parseInt(b.getAttribute('data-variant-option-index'), 10) || 0;
        return i - j;
      });
      var selectedOptions = [];
      optionContainers.forEach(function(container) {
        var chosen = container.getAttribute('data-variant-option-chosen-value');
        if (chosen) {
          selectedOptions.push(chosen.trim());
        } else {
          var checked = container.querySelector('input:checked');
          if (checked && checked.value) {
            selectedOptions.push(checked.value.trim());
          }
        }
      });
      if (selectedOptions.length > 0) {
        var variantIdFromOptions = findVariantIdByOptions(selectedOptions);
        if (variantIdFromOptions) data.variantId = variantIdFromOptions;
      }
    }
    return data;
  }

  // Find variant id in product JSON that matches selected option values (option1, option2, ...)
  function findVariantIdByOptions(selectedOptions) {
    var scripts = document.querySelectorAll('script[type="application/json"]');
    for (var i = 0; i < scripts.length; i++) {
      try {
        var json = JSON.parse(scripts[i].textContent);
        if (!json || !json.variants || !Array.isArray(json.variants)) continue;
        for (var j = 0; j < json.variants.length; j++) {
          var v = json.variants[j];
          var match = true;
          for (var k = 0; k < selectedOptions.length; k++) {
            var opt = (v['option' + (k + 1)] || v['option' + (k + 1) + '_value'] || '').toString().trim();
            if (opt !== selectedOptions[k]) {
              match = false;
              break;
            }
          }
          if (match) return v.id;
        }
      } catch (e) {}
    }
    return null;
  }

  // Reset product pricing state (call on actual variant change so first run gets fresh original from JSON)
  function resetProductPricingState() {
    document.querySelectorAll('.price.product__price, .product-pricing .price').forEach(function(container) {
      container.classList.remove('kiscience-processed');
    });
    window.KiscienceOriginalPrice = null;
    window.KiscienceAppliedRule = null;
    window.KiscienceCustomPrice = null;
    window.KisciencePricingApplied = false;
  }

  // Clear only processed flags so we re-apply to new DOM (e.g. after theme re-renders). Do NOT clear original price – otherwise we read our own discounted value from DOM and compound.
  function clearProcessedOnly() {
    document.querySelectorAll('.price.product__price, .product-pricing .price').forEach(function(container) {
      container.classList.remove('kiscience-processed');
    });
  }

  // Apply custom pricing to price elements
  function applyCustomPricing() {
    var productData = getProductData();
    if (!productData.productId) return;

    var rule = findMatchingRule(
      productData.productId,
      productData.variantId,
      productData.productTags,
      productData.productCollections
    );

    if (!rule) return;

    // Get original price: always from product JSON by current variantId when available (so variant switch shows correct original)
    var originalPrice = null;
    if (productData.variantId) {
      originalPrice = getOriginalPriceFromProductJson(productData.variantId);
    }
    if (!originalPrice) {
      originalPrice = window.KiscienceOriginalPrice;
    }
    if (!originalPrice) {
      // Fallback: read from DOM only when we have no variantId or no product JSON
      var visiblePriceEl = document.querySelector('.price__current:not(.price__current--hidden) [data-price], [data-price-container] [data-price], .price__current [data-price], .price__current .money');
      if (visiblePriceEl) {
        originalPrice = extractPrice(visiblePriceEl.textContent);
      }
      if (!originalPrice) {
        var hiddenPriceEl = document.querySelector('[data-current-price-hidden] [data-price]');
        if (hiddenPriceEl) {
          originalPrice = extractPrice(hiddenPriceEl.textContent);
        }
      }
    }
    
    if (!originalPrice) return;
    
    // Store original price (for same-variant re-runs; cleared on variant change)
    window.KiscienceOriginalPrice = originalPrice;

    var customPrice = calculatePrice(rule, originalPrice);
    // Find all price containers and update them
    var priceContainers = document.querySelectorAll('.price.product__price, .product-pricing .price');
    
    priceContainers.forEach(function(container) {
      // Skip if already processed
      if (container.classList.contains('kiscience-processed')) return;
      container.classList.add('kiscience-processed');
      container.classList.add('kiscience-active');
      
      // Update compare-at (strikethrough) price – all compare elements including min/max and hidden
      var compareEls = container.querySelectorAll('[data-price-compare], [data-price-compare-min], [data-price-compare-max], .price__compare-at .money, .price__compare-at--hidden .money, .price__compare-at--min, .price__compare-at--max');
      compareEls.forEach(function(el) {
        el.textContent = formatMoney(originalPrice);
      });
      
      // Show compare price container (visible block and ensure it’s not hidden by theme)
      var compareContainer = container.querySelector('.price__compare-at:not(.price__compare-at--hidden), [data-price-compare-container]');
      if (compareContainer) {
        compareContainer.style.setProperty('display', 'inline-block', 'important');
        compareContainer.style.setProperty('visibility', 'visible', 'important');
      }
      
      // Update current price
      var currentEls = container.querySelectorAll('[data-price], .price__current .money');
      currentEls.forEach(function(el) {
        // Don't update compare price elements
        if (!el.closest('.price__compare-at') && !el.hasAttribute('data-price-compare')) {
          el.textContent = formatMoney(customPrice);
        }
      });
    });

    // Update ALL current price elements (visible and hidden) so the displayed one shows discount
    document.querySelectorAll('.price.product__price [data-price], .product-pricing .price [data-price]').forEach(function(el) {
      if (!el.closest('.price__compare-at') && !el.hasAttribute('data-price-compare')) {
        el.textContent = formatMoney(customPrice);
      }
    });
    // Also catch any other [data-price] in product price context
    document.querySelectorAll('[data-price-container] [data-price], .price__current [data-price]').forEach(function(el) {
      if (!el.closest('.price__compare-at')) {
        el.textContent = formatMoney(customPrice);
      }
    });

    // Update ALL compare (strikethrough) prices – visible and hidden, including min/max
    document.querySelectorAll('.price.product__price [data-price-compare], .price.product__price [data-price-compare-min], .price.product__price [data-price-compare-max], .product-pricing [data-price-compare], .product-pricing [data-price-compare-min], .product-pricing [data-price-compare-max], .price__compare-at .money, .price__compare-at--hidden .money, .price__compare-at--min, .price__compare-at--max').forEach(function(el) {
      el.textContent = formatMoney(originalPrice);
    });

    // Store applied rule globally
    window.KiscienceAppliedRule = rule;
    window.KiscienceCustomPrice = customPrice;
    window.KisciencePricingApplied = true;
    
  }

  // Get product ID (and optionally variant ID) from a product card element (collection grid, best selling, etc.)
  function getProductIdFromCard(priceContainer) {
    var card = priceContainer.closest('.productitem, .product-item, .product-card, .card-wrapper, .productgrid--item, .product-card-wrapper, [data-product-id]');
    if (!card) return { productId: null, variantId: null };
    var productId = card.getAttribute('data-product-id') || card.getAttribute('data-product_id');
    var variantId = card.getAttribute('data-variant-id') || card.getAttribute('data-variant_id');
    if (!productId) {
      var el = card.querySelector('[data-product-id], [data-product_id]');
      if (el) productId = el.getAttribute('data-product-id') || el.getAttribute('data-product_id');
    }
    if (!productId) {
      var link = card.querySelector('a[href*="/products/"]');
      if (link && link.getAttribute('data-product-id')) productId = link.getAttribute('data-product-id');
    }
    if (!productId) {
      var input = card.querySelector('input[name="product_id"], input[name="product-id"], input[data-product-id]');
      if (input) productId = input.value || input.getAttribute('data-product-id');
    }
    if (!variantId) {
      var vEl = card.querySelector('[data-variant-id], input[name="id"]');
      if (vEl) variantId = vEl.getAttribute('data-variant-id') || vEl.value || vEl.getAttribute('value');
    }
    return {
      productId: productId ? String(productId).replace(/\D/g, '') : null,
      variantId: variantId ? String(variantId).replace(/\D/g, '') : null
    };
  }

  // Apply custom pricing to product cards (collection pages, best selling, featured, etc.)
  function applyCustomPricingToProductCards() {
    var cardPriceSelectors = '.price.productitem__price, .price.product-item__price, .product-card .price, .card__price, .productgrid--item .price, .card-wrapper .price';
    var containers = document.querySelectorAll(cardPriceSelectors);
    containers.forEach(function(container) {
      if (container.classList.contains('kiscience-processed')) return;
      var ids = getProductIdFromCard(container);
      if (!ids.productId) return;
      var rule = findMatchingRule(ids.productId, ids.variantId, [], []);
      if (!rule) return;

      var originalPrice = null;
      var currentEl = container.querySelector('.price__current [data-price], .price__current .money, [data-price-container] [data-price]');
      if (currentEl) originalPrice = extractPrice(currentEl.textContent);
      if (!originalPrice) {
        var anyMoney = container.querySelector('[data-price], .money');
        if (anyMoney) originalPrice = extractPrice(anyMoney.textContent);
      }
      if (!originalPrice) return;

      var customPrice = calculatePrice(rule, originalPrice);
      if (customPrice >= originalPrice) return;

      container.classList.add('kiscience-processed');
      container.classList.add('kiscience-active');

      var compareContainer = container.querySelector('.price__compare-at');
      if (compareContainer) {
        compareContainer.style.display = 'inline-block';
        compareContainer.style.visibility = 'visible';
      }
      container.querySelectorAll('[data-price-compare], .price__compare-at .money, [data-price-original], .price__compare-at--min, .price__compare-at--max, .price__compare-at--single').forEach(function(el) {
        el.textContent = formatMoney(originalPrice);
      });
      container.querySelectorAll('[data-price], .price__current .money, [data-price-min], [data-price-max]').forEach(function(el) {
        if (!el.closest('.price__compare-at') && !el.hasAttribute('data-price-compare') && !el.hasAttribute('data-price-compare-min') && !el.hasAttribute('data-price-compare-max')) {
          el.textContent = formatMoney(customPrice);
        }
      });

      // When min and max are the same, show a single price instead of "£X - £X"
      var currentContainer = container.querySelector('.price__current[data-price-container], .price__current:not(.price__current--hidden)');
      var minEl = currentContainer && currentContainer.querySelector('.price__current--min, [data-price-min]');
      var maxEl = currentContainer && currentContainer.querySelector('.price__current--max, [data-price-max]');
      if (currentContainer && minEl && maxEl) {
        var singleSpan = document.createElement('span');
        singleSpan.className = 'money price__current--single';
        singleSpan.setAttribute('data-price', '');
        singleSpan.setAttribute('translate', 'no');
        singleSpan.textContent = formatMoney(customPrice);
        currentContainer.innerHTML = '';
        currentContainer.appendChild(singleSpan);
      }
    });
  }

  // Get cart JSON (items include original_price = price before discounts; price = selling price). Cached for the run.
  function getCartData(callback) {
    if (window.KiscienceCartData && window.KiscienceCartData.items && window.KiscienceCartData.items.length > 0) {
        callback(window.KiscienceCartData);
        return;
    }
    var base = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) ? window.Shopify.routes.root : '/';
    fetch(base + 'cart.js')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        window.KiscienceCartData = data;
        callback(data);
      })
      .catch(function() {
        callback(window.cart || (window.Shopify && window.Shopify.cart) || { items: [] });
      });
  }

  // Apply custom pricing to cart items
  function applyCustomPricingToCart() {
    // Get cart items - try multiple selectors for different themes
    var cartItems = document.querySelectorAll('.cart-item, .cart__item, [data-cart-item], .cart-item-row, .line-item');
    
    if (cartItems.length === 0) {
      return;
    }

    getCartData(function(cartData) {
      var cartItemsByVariant = {};
      if (cartData && cartData.items && cartData.items.length) {
        cartData.items.forEach(function(cartItem, idx) {
          var vid = cartItem.variant_id != null ? String(cartItem.variant_id).replace(/\D/g, '') : null;
          if (vid) cartItemsByVariant[vid] = cartItem;
          if (cartItem.key) cartItemsByVariant[cartItem.key] = cartItem;
        });
      }

      cartItems.forEach(function(item, index) {
        // Skip if already processed
        if (item.classList.contains('kiscience-processed')) return;
        item.classList.add('kiscience-processed');

        // Try to get product ID and variant ID from various sources
        var productId = null;
        var variantId = null;
        var productTags = [];
        var productCollections = [];
        var itemKey = item.getAttribute('data-cartitem-key');

        // Method 1: From data attributes
        productId = item.getAttribute('data-product-id') || item.getAttribute('data-product_id');
        variantId = item.getAttribute('data-variant-id') || item.getAttribute('data-variant_id');
        if (!variantId && item.getAttribute('data-cartitem-id')) variantId = item.getAttribute('data-cartitem-id');

        // Method 2: From hidden inputs
        if (!productId) {
          var productInput = item.querySelector('input[name="product_id"], input[name="product-id"], input[data-product-id]');
          if (productInput) {
            productId = productInput.value || productInput.getAttribute('data-product-id');
          }
        }

        if (!variantId) {
          var variantInput = item.querySelector('input[name="variant_id"], input[name="variant-id"], input[name="id"]');
          if (variantInput) {
            variantId = variantInput.value || variantInput.getAttribute('data-variant-id');
          }
        }

        // Method 3: From cart JSON (if available)
        if (!productId && cartData && cartData.items && cartData.items[index]) {
          var cartItemByIndex = cartData.items[index];
          productId = cartItemByIndex.product_id;
          variantId = cartItemByIndex.variant_id;
        }

        // Method 4: From Shopify cart object
        if (!productId && window.Shopify && window.Shopify.cart && window.Shopify.cart.items && window.Shopify.cart.items[index]) {
          var shopifyCartItem = window.Shopify.cart.items[index];
          productId = shopifyCartItem.product_id;
          variantId = shopifyCartItem.variant_id;
        }

        if (!productId) {
          return;
        }

        // Clean IDs (remove non-numeric characters)
        productId = String(productId).replace(/\D/g, '');
        variantId = variantId ? String(variantId).replace(/\D/g, '') : null;

        // Find matching rule
        var rule = findMatchingRule(productId, variantId, productTags, productCollections);

        if (!rule) {
          return;
        }

        // Resolve cart line item for original_price (cart API has original_price = before discounts; price = selling price)
        var cartLineItem = (variantId && cartItemsByVariant[variantId]) || (itemKey && cartItemsByVariant[itemKey]) || (cartData && cartData.items && cartData.items[index] ? cartData.items[index] : null);

        // Get original price: prefer cart API original_price so we don't use already-discounted theme price
        var originalPrice = null;
        if (cartLineItem) {
          var cartOriginal = cartLineItem.original_price != null ? parseFloat(cartLineItem.original_price) : null;
          var cartPrice = cartLineItem.price != null ? parseFloat(cartLineItem.price) : null;
          if (cartOriginal != null && cartOriginal > 0) {
            originalPrice = cartOriginal > 1000 && cartOriginal === Math.floor(cartOriginal) ? cartOriginal / 100 : cartOriginal;
          }
          if (originalPrice == null && cartPrice != null && cartPrice > 0) {
            originalPrice = cartPrice > 1000 && cartPrice === Math.floor(cartPrice) ? cartPrice / 100 : cartPrice;
          }
        }

        // Fallback: from DOM (theme may use .cart-item--content-price and .cart-item--sale-price)
        var priceContainer = item.querySelector('.cart-item--content-price, .cart-item__price, .cart__price, [data-cart-item-price], .line-item__price, .price');
        if (!originalPrice && priceContainer) {
          var comparePriceEl = priceContainer.querySelector('.cart-item--sale-price, [data-price-compare], .price__compare-at .money, .compare-at-price');
          if (comparePriceEl) {
            originalPrice = extractPrice(comparePriceEl.textContent);
          }
          if (!originalPrice) {
            var moneyEls = priceContainer.querySelectorAll('.money');
            for (var m = 0; m < moneyEls.length; m++) {
              if (!moneyEls[m].classList.contains('cart-item--sale-price')) {
                originalPrice = extractPrice(moneyEls[m].textContent);
                if (originalPrice) break;
              }
            }
          }
        }

        if (!originalPrice && window.cart && window.cart.items && window.cart.items[index]) {
          var p = parseFloat(window.cart.items[index].price);
          originalPrice = p > 1000 && p === Math.floor(p) ? p / 100 : p;
        }
        if (!originalPrice && window.Shopify && window.Shopify.cart && window.Shopify.cart.items && window.Shopify.cart.items[index]) {
          var sp = parseFloat(window.Shopify.cart.items[index].price);
          originalPrice = sp > 1000 && sp === Math.floor(sp) ? sp / 100 : sp;
        }

        if (!originalPrice) {
          return;
        }

        // Calculate custom price
        var customPrice = calculatePrice(rule, originalPrice);

        // Update price display: support theme classes .cart-item--content-price and .cart-item--sale-price
        if (priceContainer) {
          // Strikethrough (original): .cart-item--sale-price or existing compare elements
          var compareEls = priceContainer.querySelectorAll('.cart-item--sale-price, .price__compare-at, .compare-at-price, [data-price-compare], .kiscience-compare-price');
          if (compareEls.length > 0) {
            compareEls.forEach(function(el) {
              el.textContent = formatMoney(originalPrice);
              el.style.display = 'inline-block';
              el.style.visibility = 'visible';
            });
          } else {
            var compareContainer = document.createElement('span');
            compareContainer.className = 'price__compare-at kiscience-compare-price';
            compareContainer.style.textDecoration = 'line-through';
            compareContainer.style.color = '#888';
            compareContainer.style.marginRight = '10px';
            priceContainer.insertBefore(compareContainer, priceContainer.firstChild);
            compareContainer.textContent = formatMoney(originalPrice);
            compareContainer.style.display = 'inline-block';
          }

          // Current price: .money that is NOT the sale-price (strikethrough)
          var allMoney = priceContainer.querySelectorAll('.money, [data-price], .price__current');
          var updated = false;
          for (var i = 0; i < allMoney.length; i++) {
            var el = allMoney[i];
            if (el.classList.contains('cart-item--sale-price') || el.classList.contains('kiscience-compare-price') || el.closest('.price__compare-at')) continue;
            el.textContent = formatMoney(customPrice);
            el.style.color = '#dc2626';
            el.style.fontWeight = '700';
            updated = true;
          }
          if (!updated) {
            var newPriceEl = document.createElement('span');
            newPriceEl.className = 'money kiscience-custom-price';
            newPriceEl.setAttribute('translate', 'no');
            newPriceEl.textContent = formatMoney(customPrice);
            newPriceEl.style.color = '#dc2626';
            newPriceEl.style.fontWeight = '700';
            priceContainer.appendChild(newPriceEl);
          }
        }

        // Also update line item total if it exists
        var lineTotalEl = item.querySelector('.cart-item__total, .cart__total, [data-cart-item-total], .line-item__total');
        if (lineTotalEl && customPrice !== originalPrice) {
          var quantity = 1;
          var quantityInput = item.querySelector('input[name="quantity"], input[data-quantity]');
          if (quantityInput) {
            quantity = parseInt(quantityInput.value) || 1;
          }
          var lineTotal = customPrice * quantity;
          lineTotalEl.textContent = formatMoney(lineTotal);
        }
      });
    });
  }

  // Run on page load
  function init() {
    if (window.location.pathname.includes('/products/')) {
      applyCustomPricing();
    }
    if (window.location.pathname.includes('/cart') || window.location.pathname === '/cart') {
      applyCustomPricingToCart();
    }
    // Collection, index, best selling, etc. – apply discount to product cards (strikethrough + custom price)
    if (!window.location.pathname.includes('/products/')) {
      applyCustomPricingToProductCards();
    }
  }

  // Listen for variant changes on product pages (standard input[name="id"] / select[name="id"] OR option-based pickers like [data-variant-option] radios)
  document.addEventListener('change', function(e) {
    var isVariantChange = e.target.matches('select[name="id"], input[name="id"]') ||
      (e.target.closest && e.target.closest('[data-variant-option]'));
    if (isVariantChange) {
      var source = e.target.matches('select[name="id"], input[name="id"]') ? 'input/select name="id"' : 'option picker [data-variant-option]';
      var value = (e.target.value != null) ? e.target.value : (e.target.selectedOptions && e.target.selectedOptions[0] ? e.target.selectedOptions[0].value : '');
      resetProductPricingState();
      // First run: get original from JSON and apply. Later runs: only clear processed (keep original) so we re-apply to new DOM without re-reading our own discounted value.
      [100, 350, 700, 1200].forEach(function(delay) {
        setTimeout(function() {
          clearProcessedOnly();
          applyCustomPricing();
        }, delay);
      });
    }
    
    // Listen for quantity changes in cart
    if (e.target.matches('input[name="quantity"], input[data-quantity]')) {
      if (window.location.pathname.includes('/cart') || window.location.pathname === '/cart') {
        window.KiscienceCartData = null;
        document.querySelectorAll('.cart-item, .cart__item, [data-cart-item]').forEach(function(item) {
          item.classList.remove('kiscience-processed');
        });
        setTimeout(applyCustomPricingToCart, 300);
      }
    }
  });

  // Listen for cart updates (AJAX cart updates)
  document.addEventListener('cart:updated', function() {
    if (window.location.pathname.includes('/cart') || window.location.pathname === '/cart') {
      window.KiscienceCartData = null;
      document.querySelectorAll('.cart-item, .cart__item, [data-cart-item]').forEach(function(item) {
        item.classList.remove('kiscience-processed');
      });
      setTimeout(applyCustomPricingToCart, 500);
    }
  });

  // Listen for Shopify cart updates
  if (window.Shopify && window.Shopify.cart) {
    var originalCartUpdate = window.Shopify.cart.update;
    if (originalCartUpdate) {
      window.Shopify.cart.update = function() {
        var result = originalCartUpdate.apply(this, arguments);
        setTimeout(function() {
          if (window.location.pathname.includes('/cart') || window.location.pathname === '/cart') {
            window.KiscienceCartData = null;
            document.querySelectorAll('.cart-item, .cart__item, [data-cart-item]').forEach(function(item) {
              item.classList.remove('kiscience-processed');
            });
            applyCustomPricingToCart();
          }
        }, 500);
        return result;
      };
    }
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(init, 500);
    });
  } else {
    setTimeout(init, 500);
  }
  
  // Also run after full page load for themes that load content dynamically (and retry product page for late-rendered price blocks)
  window.addEventListener('load', function() {
    [500, 1000, 2000].forEach(function(delay) {
      setTimeout(function() {
        if (window.location.pathname.includes('/products/')) {
          clearProcessedOnly();
          applyCustomPricing();
        }
        if (window.location.pathname.includes('/cart') || window.location.pathname === '/cart') {
          document.querySelectorAll('.cart-item, .cart__item, [data-cart-item]').forEach(function(item) { item.classList.remove('kiscience-processed'); });
          applyCustomPricingToCart();
        }
        if (!window.location.pathname.includes('/products/')) {
          applyCustomPricingToProductCards();
        }
      }, delay);
    });
  });

  // Use MutationObserver to watch for cart updates and product price section updates (theme may replace price DOM on variant change)
  if (typeof MutationObserver !== 'undefined') {
    var productPriceDebounce;
    var cardPriceDebounce;
    function addedNodeTouchesProductPrice(added) {
      if (!added || added.nodeType !== 1) return false;
      if (added.closest && (added.closest('.price.product__price') || added.closest('.product__price') || added.closest('[data-price-container]') || added.closest('.product-pricing') || added.closest('[data-product-pricing]'))) return true;
      if (added.classList && (added.classList.contains('price') || added.classList.contains('product__price') || added.classList.contains('product-pricing') || added.hasAttribute('data-product-pricing'))) return true;
      if (added.querySelector && (added.querySelector('[data-price]') || added.querySelector('.price.product__price') || added.querySelector('.product-pricing .price'))) return true;
      return false;
    }
    var cartObserver = new MutationObserver(function(mutations) {
      if (window.location.pathname.includes('/products/')) {
        var touchesPrice = false;
        for (var i = 0; i < mutations.length; i++) {
          var m = mutations[i];
          var n = m.target;
          if (n.nodeType === 1 && n.closest && (n.closest('.price.product__price') || n.closest('.product__price') || n.closest('[data-price-container]') || n.closest('.product-pricing') || n.closest('[data-product-pricing]'))) {
            touchesPrice = true;
            break;
          }
          if (m.type === 'childList' && m.addedNodes && m.addedNodes.length > 0) {
            for (var j = 0; j < m.addedNodes.length; j++) {
              if (addedNodeTouchesProductPrice(m.addedNodes[j])) {
                touchesPrice = true;
                break;
              }
            }
          }
        }
        if (touchesPrice) {
          clearTimeout(productPriceDebounce);
          productPriceDebounce = setTimeout(function() {
            clearProcessedOnly();
            applyCustomPricing();
          }, 250);
        }
      }
      if (window.location.pathname.includes('/cart') || window.location.pathname === '/cart' || document.querySelector('.cart, .cart-drawer, [data-cart]')) {
        var cartItems = document.querySelectorAll('.cart-item, .cart__item, [data-cart-item]');
        var hasUnprocessed = false;
        cartItems.forEach(function(item) {
          if (!item.classList.contains('kiscience-processed')) {
            hasUnprocessed = true;
          }
        });
        if (hasUnprocessed) {
          setTimeout(applyCustomPricingToCart, 500);
        }
      }
      // Collection / cards: when new product cards or price blocks appear, apply pricing
      if (!window.location.pathname.includes('/products/')) {
        var touchesCard = false;
        for (var i = 0; i < mutations.length; i++) {
          var m = mutations[i];
          if (m.type === 'childList' && m.addedNodes && m.addedNodes.length > 0) {
            for (var j = 0; j < m.addedNodes.length; j++) {
              var node = m.addedNodes[j];
              if (node.nodeType === 1 && (node.classList && (node.classList.contains('productitem') || node.classList.contains('product-item') || node.classList.contains('product-card')) || (node.querySelector && node.querySelector('.price.productitem__price, .price.product-item__price')))) {
                touchesCard = true;
                break;
              }
            }
          }
        }
        if (touchesCard) {
          clearTimeout(cardPriceDebounce);
          cardPriceDebounce = setTimeout(applyCustomPricingToProductCards, 350);
        }
      }
    });

    cartObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
})();
