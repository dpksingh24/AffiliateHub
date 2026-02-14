/**
 * KiScience Shared Cart Landing
 * Runs on all pages: persists ref for tracking; when ref+cart in URL shows modal with shared cart products.
 */
(function() {
  'use strict';

  const configEl = document.getElementById('kiscience-config');
  const config = configEl ? JSON.parse(configEl.textContent || '{}') : {};
  const shop = config.shop;
  const appApiBaseUrl = config.appApiBaseUrl;

  function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      ref: params.get('ref') || params.get('affiliate'),
      cart: params.get('cart'),
      visitId: params.get('visitId'),
      discount: params.get('discount')
    };
  }

  // Persist ref and visitId so affiliate tracking and visit→conversion linking work
  function persistRef(ref, visitId) {
    if (!ref) return;
    try {
      localStorage.setItem('kiscience_affiliate_ref', ref);
      var attrs = { affiliate: ref };
      if (visitId) attrs.affiliate_visit_id = visitId;
      fetch('/cart/update.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attributes: attrs })
      }).then(function(resp) {
        if (resp.ok) localStorage.setItem('kiscience_affiliate_ref_set', '1');
      }).catch(function() {});
    } catch (e) {}
  }

  function fetchCartPreview(cartParam) {
    if (!shop || !cartParam) return Promise.resolve({ products: [] });
    const url = appApiBaseUrl + '/api/affiliates/cart-preview?shop=' + encodeURIComponent(shop) + '&cart=' + encodeURIComponent(cartParam);
    return fetch(url).then(function(r) { return r.json(); }).then(function(data) { return data.products || []; }).catch(function() { return []; });
  }

  function addToCart(variantId, quantity) {
    return fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: variantId, quantity: quantity || 1 })
    });
  }

  // Set cart attribute listing variant:qty so commission is only on shared-cart items, not full order
  function setAttributedVariants(products) {
    if (!products || products.length === 0) return Promise.resolve();
    var parts = products.map(function(p) {
      var vid = p.variantId || p.variant_id || p.id;
      var q = p.quantity || p.qty || 1;
      return vid ? String(vid) + ':' + q : null;
    }).filter(Boolean);
    if (parts.length === 0) return Promise.resolve();
    var value = parts.join(',');
    return fetch('/cart/update.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attributes: { affiliate_attributed_variants: value } })
    }).catch(function() {});
  }

  function ensureModalStyles() {
    if (document.getElementById('kiscience-shared-cart-modal-styles')) return;
    var style = document.createElement('style');
    style.id = 'kiscience-shared-cart-modal-styles';
    style.textContent =
      '.kiscience-shared-cart-modal{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}' +
      '.kiscience-sc-modal__backdrop{position:absolute;inset:0;background:rgba(17,24,39,0.45);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);opacity:0;transition:opacity 0.25s ease}' +
      '.kiscience-sc-modal--open .kiscience-sc-modal__backdrop{opacity:1}' +
      '.kiscience-sc-modal__box{position:relative;background:#fff;border-radius:20px;max-width:420px;width:100%;max-height:88vh;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,0.2),0 0 0 1px rgba(0,0,0,0.04);transform:scale(0.96);transition:transform 0.25s ease}' +
      '.kiscience-sc-modal--open .kiscience-sc-modal__box{transform:scale(1)}' +
      '.kiscience-sc-modal__content{display:flex;flex-direction:column;min-width:0}' +
      '.kiscience-sc-modal__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:24px 24px 20px;background:linear-gradient(180deg,#f8fafc 0%,#fff 100%);border-bottom:1px solid #e2e8f0}' +
      '.kiscience-sc-modal__head h3{margin:0;font-size:20px;font-weight:700;color:#0f172a;line-height:1.25;letter-spacing:-0.02em}' +
      '.kiscience-sc-modal__head-sub{display:block;margin-top:4px;font-size:13px;font-weight:400;color:#64748b}' +
      '.kiscience-sc-modal__close{background:#f1f5f9;border:none;width:36px;height:36px;border-radius:10px;font-size:20px;line-height:1;cursor:pointer;color:#64748b;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background 0.2s,color 0.2s}' +
      '.kiscience-sc-modal__close:hover{background:#e2e8f0;color:#0f172a}' +
      '.kiscience-sc-modal__body{padding:20px 24px;max-height:38vh;overflow-y:auto;flex:1}' +
      '.kiscience-sc-modal__body-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;margin:0 0 12px}' +
      '.kiscience-sc-modal__list{display:flex;flex-direction:column;gap:12px}' +
      '.kiscience-sc-modal__item{display:flex;gap:14px;align-items:center;padding:14px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0}' +
      '.kiscience-sc-modal__img{width:56px;height:56px;object-fit:cover;border-radius:10px;flex-shrink:0;display:block}' +
      '.kiscience-sc-modal__img--placeholder{width:56px;height:56px;background:#e2e8f0;color:#94a3b8;font-size:18px;font-weight:600;display:flex;align-items:center;justify-content:center;border-radius:10px}' +
      '.kiscience-sc-modal__info{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1}' +
      '.kiscience-sc-modal__title{font-size:14px;font-weight:600;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.kiscience-sc-modal__price{font-size:15px;font-weight:700;color:#059669}' +
      '.kiscience-sc-modal__qty{font-size:12px;color:#64748b}' +
      '.kiscience-sc-modal__discount{padding:20px 24px;margin:0 24px;background:linear-gradient(135deg,#ecfdf5 0%,#d1fae5 100%);border-radius:14px;border:1px solid #a7f3d0}' +
      '.kiscience-sc-modal__discount-title{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#047857;margin:0 0 10px;display:flex;align-items:center;gap:6px}' +
      '.kiscience-sc-modal__discount-title::before{content:"";width:18px;height:18px;background:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%23047857\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z\'/%3E%3C/svg%3E") center/contain no-repeat}' +
      '.kiscience-sc-modal__discount-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}' +
      '.kiscience-sc-modal__discount-code{font-family:ui-monospace,monospace;font-size:15px;font-weight:700;letter-spacing:0.08em;color:#065f46;background:#fff;padding:10px 14px;border-radius:8px;border:1px dashed #059669;flex:1;min-width:0}' +
      '.kiscience-sc-modal__btn--copy{padding:10px 16px;font-size:13px;font-weight:600;border-radius:8px;cursor:pointer;background:#065f46;color:#fff;border:none;flex-shrink:0;transition:background 0.2s,transform 0.1s}' +
      '.kiscience-sc-modal__btn--copy:hover{background:#047857}' +
      '.kiscience-sc-modal__btn--copy:active{transform:scale(0.98)}' +
      '.kiscience-sc-modal__foot{padding:24px;border-top:1px solid #e2e8f0;background:#fff}' +
      '.kiscience-sc-modal__btn{display:inline-flex;align-items:center;justify-content:center;padding:14px 24px;font-size:15px;font-weight:600;border-radius:12px;cursor:pointer;text-decoration:none;border:none;width:100%;transition:background 0.2s,transform 0.1s}' +
      '.kiscience-sc-modal__btn--primary{background:linear-gradient(145deg,#4f46e5 0%,#4338ca 100%);color:#fff;box-shadow:0 2px 8px rgba(79,70,229,0.35)}' +
      '.kiscience-sc-modal__btn--primary:hover:not(:disabled){background:linear-gradient(145deg,#4338ca 0%,#3730a3 100%);box-shadow:0 4px 12px rgba(79,70,229,0.4)}' +
      '.kiscience-sc-modal__btn--primary:active:not(:disabled){transform:scale(0.99)}' +
      '.kiscience-sc-modal__btn--primary:disabled{opacity:0.8;cursor:not-allowed}' +
      '.kiscience-sc-modal__btn--secondary{background:#f1f5f9;color:#334155;border:1px solid #e2e8f0}' +
      '.kiscience-sc-modal__btn--secondary:hover{background:#e2e8f0}' +
      '';
    document.head.appendChild(style);
  }

  function showModal(products, cartParam, discountCode) {
    if (products.length === 0) return;
    ensureModalStyles();
    var existing = document.getElementById('kiscience-shared-cart-modal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'kiscience-shared-cart-modal';
    modal.className = 'kiscience-shared-cart-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'Shared cart');

    var productTitle = function(p) { return (p.productTitle || p.title || 'Product').replace(/"/g, '&quot;'); };
    const itemsHtml = products.map(function(p) {
      var imgSrc = p.imageUrl ? p.imageUrl.replace(/"/g, '&quot;') : '';
      var img = imgSrc
        ? '<img src="' + imgSrc + '" alt="' + productTitle(p) + '" class="kiscience-sc-modal__img" loading="lazy" />'
        : '<div class="kiscience-sc-modal__img kiscience-sc-modal__img--placeholder" aria-hidden="true">?</div>';
      var priceVal = p.price != null ? parseFloat(p.price) : NaN;
      var price = isNaN(priceVal) ? '' : '£' + priceVal.toFixed(2);
      return '<div class="kiscience-sc-modal__item">' + img + '<div class="kiscience-sc-modal__info"><span class="kiscience-sc-modal__title">' + (p.productTitle || p.title || 'Product') + '</span><span class="kiscience-sc-modal__price">' + price + '</span><span class="kiscience-sc-modal__qty">Qty: ' + (p.quantity || 1) + '</span></div></div>';
    }).join('');

    var hasDiscount = !!(discountCode && String(discountCode).trim());
    var discountHtml = '';
    if (hasDiscount) {
      var safeCode = String(discountCode).trim().replace(/</g, '&lt;').replace(/"/g, '&quot;');
      discountHtml =
        '<div class="kiscience-sc-modal__discount">' +
          '<div class="kiscience-sc-modal__discount-title">Your discount code</div>' +
          '<div class="kiscience-sc-modal__discount-row">' +
            '<span class="kiscience-sc-modal__discount-code">' + safeCode + '</span>' +
            '<button type="button" class="kiscience-sc-modal__btn kiscience-sc-modal__btn--copy" data-action="copy-discount" data-code="' + safeCode + '" aria-label="Copy discount code">Copy</button>' +
          '</div>' +
        '</div>';
    }
    var headSub = hasDiscount
      ? 'Add these items to your cart—use the code below at checkout for a discount.'
      : 'Add these items to your cart in one click.';

    modal.innerHTML =
      '<div class="kiscience-sc-modal__backdrop"></div>' +
      '<div class="kiscience-sc-modal__box">' +
        '<div class="kiscience-sc-modal__content">' +
          '<div class="kiscience-sc-modal__head">' +
            '<div><h3>Someone shared a cart with you</h3><span class="kiscience-sc-modal__head-sub">' + headSub + '</span></div>' +
            '<button type="button" class="kiscience-sc-modal__close" aria-label="Close">&times;</button>' +
          '</div>' +
          '<div class="kiscience-sc-modal__body">' +
            '<p class="kiscience-sc-modal__body-title">In this cart</p>' +
            '<div class="kiscience-sc-modal__list">' + itemsHtml + '</div>' +
          '</div>' +
          discountHtml +
          '<div class="kiscience-sc-modal__foot">' +
            '<button type="button" class="kiscience-sc-modal__btn kiscience-sc-modal__btn--primary" data-action="add-all">Add all to cart</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    function closeModal() {
      modal.classList.remove('kiscience-sc-modal--open');
      setTimeout(function() { modal.remove(); }, 300);
      var url = new URL(window.location.href);
      url.searchParams.delete('cart');
      window.history.replaceState({}, '', url.toString());
    }

    modal.querySelector('.kiscience-sc-modal__backdrop').addEventListener('click', closeModal);
    modal.querySelector('.kiscience-sc-modal__close').addEventListener('click', closeModal);

    var copyBtn = modal.querySelector('[data-action="copy-discount"]');
    if (copyBtn) {
      copyBtn.addEventListener('click', function() {
        var code = this.getAttribute('data-code') || '';
        if (!code) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(code).then(function() {
            var lbl = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            setTimeout(function() { copyBtn.textContent = lbl; }, 2000);
          }).catch(function() {});
        }
      });
    }

    modal.querySelector('[data-action="add-all"]').addEventListener('click', function() {
      var btn = this;
      btn.disabled = true;
      btn.textContent = 'Adding…';
      var chain = Promise.resolve();
      products.forEach(function(p) {
        chain = chain.then(function() { return addToCart(p.variantId, p.quantity); });
      });
      chain.then(function() {
        return setAttributedVariants(products);
      }).then(function() {
        btn.textContent = 'Added!';
        setTimeout(function() { closeModal(); window.location.href = '/cart'; }, 600);
      }).catch(function() {
        btn.disabled = false;
        btn.textContent = 'Add all to cart';
      });
    });

    document.body.appendChild(modal);
    requestAnimationFrame(function() { modal.classList.add('kiscience-sc-modal--open'); });
  }

  function init() {
    var params = getUrlParams();
    if (params.ref) persistRef(params.ref, params.visitId);

    if (params.ref && params.cart) {
      fetchCartPreview(params.cart).then(function(products) {
        showModal(products, params.cart, params.discount);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
