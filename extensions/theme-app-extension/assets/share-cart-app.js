/**
 * KiScience Share Cart App
 * Handles cart sharing functionality for affiliates
 */

(function() {
  'use strict';

  // Persist affiliate/ref param into cart attributes so orders include it
  (function persistAffiliateRefFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref') || params.get('affiliate');
      if (!ref) return;

      // Save to localStorage for later pages
      localStorage.setItem('kiscience_affiliate_ref', ref);

      // Only attempt to set cart attribute once per session
      if (localStorage.getItem('kiscience_affiliate_ref_set')) return;

      // Try to update Shopify cart attributes so they persist into the order
      // POST /cart/update.js with JSON { attributes: { affiliate: ref } }
      fetch('/cart/update.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attributes: { affiliate: ref } })
      }).then(resp => {
        if (!resp.ok) {
          console.warn('Failed to set cart attribute for affiliate ref');
          return;
        }
        console.log('Affiliate ref persisted to cart attributes');
        localStorage.setItem('kiscience_affiliate_ref_set', '1');
      }).catch(err => {
        console.warn('Error persisting affiliate ref to cart:', err);
      });
    } catch (e) {
      // ignore
    }
  })();

  // Get config from Liquid
  const configElement = document.getElementById('kiscience-share-cart-config');
  const config = configElement ? JSON.parse(configElement.textContent) : {};

  const container = document.getElementById('kiscience-share-cart-container');
  if (!container) return;

  // Fetch affiliate's referral shortCode, app base URL, and status (Share Cart only when approved)
  let affiliateShortCode = null;
  let appReferralBaseUrl = null;
  let affiliateStatus = null;
  const fetchAffiliateData = async () => {
    if (!config.customerId || !config.shop) return { shortCode: null, appReferralBaseUrl: null, status: null };
    const apiBase = config.appApiBaseUrl;
    try {
      const response = await fetch(`${apiBase}/api/affiliates/${config.customerId}?shop=${encodeURIComponent(config.shop)}`);
      if (!response.ok) return { shortCode: null, appReferralBaseUrl: null, status: null };
      const data = await response.json();
      if (!data.affiliate) return { shortCode: null, appReferralBaseUrl: null, status: null };
      const shortCode = data.affiliate.referralLinks && data.affiliate.referralLinks.length > 0
        ? data.affiliate.referralLinks[0].shortCode
        : null;
      const baseUrl = data.affiliate.appReferralBaseUrl || null;
      const status = data.affiliate.status || null;
      return { shortCode, appReferralBaseUrl: baseUrl, status };
    } catch (err) {
      console.warn('Failed to fetch affiliate data:', err);
      return { shortCode: null, appReferralBaseUrl: null, status: null };
    }
  };

  // Always the same short affiliate link (what we show everywhere)
  function getDisplayLink() {
    if (!affiliateShortCode) {
      affiliateShortCode = config.customerId;
    }
    const baseUrl = appReferralBaseUrl || window.location.origin;
    return `${baseUrl}/ref=${affiliateShortCode}`;
  }

  // Actual URL used when copying/sharing: includes ?cart= for cart share (behind the scenes)
  function getActualShareLink() {
    if (!affiliateShortCode) {
      affiliateShortCode = config.customerId;
    }
    const baseUrl = appReferralBaseUrl || window.location.origin;
    const isAppUrl = !!appReferralBaseUrl;

    if (!config.cartItems || !Array.isArray(config.cartItems) || config.cartItems.length === 0) {
      return isAppUrl ? `${baseUrl}/ref=${affiliateShortCode}` : `${baseUrl}/cart?ref=${affiliateShortCode}&utm_source=affiliate_share&utm_medium=cart_share`;
    }

    const variants = [];
    config.cartItems.forEach(item => {
      const variantId = item.variant_id || item.variantId || item.id;
      const qty = item.quantity || item.qty || 1;
      if (variantId) variants.push(`${variantId}:${qty}`);
    });

    if (variants.length === 0) {
      return isAppUrl ? `${baseUrl}/ref=${affiliateShortCode}` : `${baseUrl}/cart?ref=${affiliateShortCode}&utm_source=affiliate_share&utm_medium=cart_share`;
    }

    const variantPath = variants.join(',');
    if (isAppUrl) {
      return `${baseUrl}/ref=${affiliateShortCode}?cart=${encodeURIComponent(variantPath)}`;
    }
    return `${baseUrl}/cart/${variantPath}?ref=${affiliateShortCode}&utm_source=affiliate_share&utm_medium=cart_share`;
  }

  function displayShareOptions(approved) {
    if (approved !== true) {
      container.innerHTML = `
        <div class="kiscience-share-cart kiscience-share-cart--pending">
          <p style="font-size: 13px; color: #6b7280; margin: 0; padding: 12px; background: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb;">
            Share Cart will be available after your affiliate registration is approved.
          </p>
        </div>
      `;
      return;
    }
    const html = `
      <div class="kiscience-share-cart">
        <button 
          type="button"
          class="kiscience-share-cart-btn"
          onclick="window.kiscience.shareCart()"
        >
          Share cart
        </button>
      </div>
    `;

    container.innerHTML = html;
  }

  function showToast(message, type) {
    type = type || 'success';
    const existing = document.getElementById('kiscience-share-cart-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'kiscience-share-cart-toast';
    toast.className = 'kiscience-toast kiscience-toast--' + type;
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('kiscience-toast--visible'));
    const t = setTimeout(() => {
      toast.classList.remove('kiscience-toast--visible');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
    toast.addEventListener('click', () => clearTimeout(t));
  }

  // Expose functions to window
  window.kiscience = window.kiscience || {};
  window.kiscience.getActualShareLink = getActualShareLink;

  window.kiscience.shareCart = function() {
    const shareLink = getActualShareLink();
    if (navigator.share) {
      navigator.share({
        title: 'Check Out My Cart',
        text: 'I found some great products! Check out my cart and earn rewards when you purchase.',
        url: shareLink
      }).catch(err => console.log('Share failed:', err));
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareLink).then(() => {
        showToast('Link copied! Share it with your friends.');
      }).catch(() => {
        prompt('Copy this link:', shareLink);
        showToast('Link copied! Share it with your friends.');
      });
    } else {
      prompt('Copy this link:', shareLink);
      showToast('Link copied! Share it with your friends.');
    }
  };

  // Initialize - show Share Cart only when customer is logged in, has cart items, and affiliate is approved (status === 'active')
  if (config.customerId && config.cartItems && config.cartItems.length > 0) {
    fetchAffiliateData().then(({ shortCode, appReferralBaseUrl: baseUrl, status }) => {
      if (shortCode) affiliateShortCode = shortCode;
      if (baseUrl) appReferralBaseUrl = baseUrl;
      if (status) affiliateStatus = status;
      const approved = affiliateStatus === 'active';
      displayShareOptions(approved);
    }).catch(err => {
      console.warn('Error fetching affiliate data:', err);
      displayShareOptions(false);
    });
  }
})();
