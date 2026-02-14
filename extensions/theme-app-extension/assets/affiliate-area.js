/**
 * Affiliate Area – tab switching and primary referral link for /pages/affiliate-area
 * Tabs: Affiliate URLs, Creatives, Statistics, Graphs, Referrals, Payouts, Visits, Settings, Lifetime Customers, Log out
 * Earnings and static data migrated from Practitioner Dashboard Affiliate tab.
 */
(function () {
  const API_BASE_URL = 'https://kisciapp.ebizonstg.com';
  const CONTAINER_ID = 'affiliate-area-container';
  const TAB_SELECTOR = '.ks-tab:not(.ks-affiliate-area__tab--logout)';
  const PANEL_SELECTOR = '.ks-tab-content';
  const REFERRAL_LINKS_PER_PAGE = 5;

  let affiliateData = null;
  let currentAffiliateId = null;
  let referralLinksCurrentPage = 1;

  function getCustomerId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('customerId') || localStorage.getItem('customerId') ||
      (window.KISCENCE_CUSTOMER && window.KISCENCE_CUSTOMER.id) ||
      (window.Shopify && window.Shopify.checkout && window.Shopify.checkout.customer && window.Shopify.checkout.customer.id) || '';
  }

  function getCustomerEmail() {
    return (window.KISCENCE_CUSTOMER && window.KISCENCE_CUSTOMER.email) ||
      localStorage.getItem('customerEmail') || '';
  }

  function getAffiliateId() {
    return currentAffiliateId ||
      (typeof URLSearchParams !== 'undefined' && new URLSearchParams(window.location.search).get('affiliateId')) ||
      localStorage.getItem('affiliateId');
  }

  async function apiCall(endpoint, method, body) {
    method = method || 'GET';
    try {
      var options = { method: method, headers: { 'Content-Type': 'application/json' } };
      if (body) options.body = JSON.stringify(body);
      var response = await fetch(API_BASE_URL + endpoint, options);
      var data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Request failed' };
      }
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  function getStatusBadge(status) {
    var map = {
      active: 'ks-status-active',
      replaced: 'ks-status-inactive',
      inactive: 'ks-status-inactive',
      suspended: 'ks-status-suspended',
      deactivated: 'ks-status-deactivated',
      Paid: 'ks-status-paid',
      Pending: 'ks-status-pending',
      Unpaid: 'ks-status-pending',
      Rejected: 'ks-status-inactive',
      Processing: 'ks-status-pending',
      Failed: 'ks-status-inactive'
    };
    var lower = (status || '').toString().toLowerCase();
    var cls = map[status] || map[lower] || (lower === 'paid' ? 'ks-status-paid' : lower === 'processing' ? 'ks-status-pending' : lower === 'failed' ? 'ks-status-inactive' : 'ks-status-inactive');
    var label = (status || '').toString();
    if (lower === 'replaced') label = 'Replaced';
    return '<span class="ks-status ' + cls + '">' + escapeAttr(label) + '</span>';
  }

  function formatCurrency(amount, currency) {
    currency = currency || 'USD';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(amount || 0);
  }

  function showToast(message, type) {
    var existing = document.getElementById('ks-toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.id = 'ks-toast';
    toast.className = 'ks-toast ks-toast--' + (type || 'success');
    toast.setAttribute('role', 'alert');
    toast.innerHTML = '<span class="ks-toast__message">' + message + '</span><button type="button" class="ks-toast__close" aria-label="Close">×</button>';
    document.body.appendChild(toast);
    var close = function () {
      toast.classList.add('ks-toast--hide');
      setTimeout(function () { toast.remove(); }, 300);
    };
    toast.querySelector('.ks-toast__close').addEventListener('click', close);
    setTimeout(close, 3000);
  }

  function copyPrimaryReferralLink() {
    var urlEl = document.getElementById('primary-link-url');
    if (urlEl) {
      var text = urlEl.textContent || urlEl.innerText;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          showToast('Referral link copied to clipboard!', 'success');
        }).catch(function () {
          showToast('Failed to copy link. Please try again.', 'error');
        });
      } else {
        showToast('Copy not supported in this browser.', 'error');
      }
    }
  }

  function shareReferralLink(url) {
    var u = url || (window._ksPrimaryReferralUrl);
    if (!u) return;
    if (navigator.share) {
      navigator.share({ title: 'Join our Affiliate Program', text: 'Earn commissions by sharing this link', url: u }).catch(function () {});
    } else {
      copyPrimaryReferralLink();
    }
  }

  function shareToFacebook(url) {
    var u = url || window._ksPrimaryReferralUrl;
    if (u) window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(u), '_blank', 'noopener,noreferrer,width=800,height=600');
  }
  function shareToLinkedIn(url) {
    var u = url || window._ksPrimaryReferralUrl;
    if (u) window.open('https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(u), '_blank', 'noopener,noreferrer,width=900,height=600');
  }
  function shareToWhatsApp(url) {
    var u = url || window._ksPrimaryReferralUrl;
    if (u) window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent('Check this out: ' + u), '_blank', 'noopener,noreferrer');
  }
  function shareByMail(url) {
    var u = url || window._ksPrimaryReferralUrl;
    if (u) window.location.href = 'mailto:?subject=' + encodeURIComponent('Join our Affiliate Program') + '&body=' + encodeURIComponent('Hi,\n\nCheck out this referral link:\n' + u + '\n\nBest regards');
  }

  window.copyPrimaryReferralLink = copyPrimaryReferralLink;
  window.shareReferralLink = shareReferralLink;
  window.shareToFacebook = shareToFacebook;
  window.shareToLinkedIn = shareToLinkedIn;
  window.shareToWhatsApp = shareToWhatsApp;
  window.shareByMail = shareByMail;

  function escapeAttr(str) {
    if (str == null) return '';
    var s = String(str);
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function renderPrimaryReferralLink(linkUrl) {
    var el = document.getElementById('affiliate-area-primary-referral-link');
    var placeholder = document.getElementById('affiliate-area-urls-content');
    if (!el) return;

    window._ksPrimaryReferralUrl = linkUrl;

    el.innerHTML = '<div class="referral-url-card ks-primary-referral-card">' +
      '<div class="ks-primary-referral-card__header">' +
      '<h4 class="ks-primary-referral-card__title">Your Primary Referral Link</h4>' +
      '<span class="ks-primary-referral-card__badge">Active</span>' +
      '</div>' +
      '<p class="ks-primary-referral-card__desc">Use this single link for everything: general sharing and Share Cart. Tracking works for both.</p>' +
      '<div class="ks-primary-referral-card__url-wrap">' +
      '<div class="referral-url-display ks-primary-referral-card__url" id="primary-link-url">' + escapeAttr(linkUrl) + '</div>' +
      '</div>' +
      '<div class="ks-primary-referral-card__actions">' +
      '<button class="ks-btn ks-primary-referral-card__btn" type="button" onclick="copyPrimaryReferralLink()">Copy Link</button>' +
      '<button class="ks-btn ks-primary-referral-card__btn ks-primary-referral-card__btn--share" type="button" onclick="shareReferralLink()">Share</button>' +
      '</div>' +
      '<div class="fast-share ks-primary-referral-card__fast-share" aria-hidden="false">' +
      '<span class="fast-share-label">Share to</span>' +
      '<div class="fast-share-icons">' +
      '<a href="#" class="facebook" onclick="shareToFacebook();return false;" title="Share on Facebook"><svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.99 3.66 9.12 8.44 9.88V14.89h-2.54v-2.9h2.54V9.97c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.23.2 2.23.2v2.45h-1.25c-1.23 0-1.61.77-1.61 1.56v1.87h2.74l-.44 2.9h-2.3v6.99C18.34 21.12 22 16.99 22 12z"/></svg></a>' +
      '<a href="#" class="linkedin" onclick="shareToLinkedIn();return false;" title="Share on LinkedIn"><svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M19 0h-14C2.9 0 2 0.9 2 2v20c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V2c0-1.1-.9-2-2-2zM8 18H5V9h3v9zM6.5 7.5C5.67 7.5 5 6.83 5 6s.67-1.5 1.5-1.5S8 5.17 8 6s-.33 1.5-1.5 1.5zM19 18h-3v-4.5c0-1.07-.93-1.5-1.5-1.5S13 12.43 13 13.5V18h-3V9h3v1.25c.78-1.2 2.22-1.25 3.03-.3.98 1.12.97 3.05.97 4.05V18z"/></svg></a>' +
      '<a href="#" class="whatsapp" onclick="shareToWhatsApp();return false;" title="Share on WhatsApp"><svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M20.52 3.48A11.93 11.93 0 0012 0C5.373 0 .05 5.324.05 11.95c0 2.108.55 4.178 1.6 6.02L0 24l6.23-1.63a11.93 11.93 0 005.77 1.48c6.628 0 11.95-5.324 11.95-11.95 0-3.19-1.24-6.19-3.43-8.37zM12 21.7c-1.78 0-3.5-.47-4.99-1.36l-.36-.22L4 20l1.2-2.43-.24-.38A8.7 8.7 0 013.1 12c0-4.92 4.01-8.93 8.9-8.93 2.38 0 4.62.93 6.3 2.61A8.85 8.85 0 0120.9 12c0 4.9-4 8.9-8.9 8.9z"/></svg></a>' +
      '<a href="#" class="mail" onclick="shareByMail();return false;" title="Share via Email"><svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/></svg></a>' +
      '</div></div></div>';
    if (placeholder) placeholder.style.display = 'none';
    var builderWrap = document.getElementById('affiliate-area-share-cart-builder');
    if (builderWrap && linkUrl) {
      builderWrap.style.display = 'block';
      initShareCartBuilder();
    }
  }

  var shareCartSelectedItems = [];

  function initShareCartBuilder() {
    var searchInput = document.getElementById('affiliate-area-product-search');
    var searchResults = document.getElementById('affiliate-area-search-results');
    var selectedList = document.getElementById('affiliate-area-selected-products');
    var actionsWrap = document.getElementById('affiliate-area-share-cart-actions');
    var generateBtn = document.getElementById('affiliate-area-generate-share-url-btn');
    var outputWrap = document.getElementById('affiliate-area-generated-share-wrap');
    var outputInput = document.getElementById('affiliate-area-generated-share-url');
    var copyBtn = document.getElementById('affiliate-area-copy-share-url-btn');
    var clearBtn = document.getElementById('affiliate-area-search-clear-btn');
    var loadingEl = document.getElementById('affiliate-area-search-loading');
    if (!searchInput || !searchResults || !selectedList) return;

    var searchTimeout = null;
    var searchAbortController = null;
    var MIN_SEARCH_LENGTH = 2;
    var DEBOUNCE_MS = 320;

    function setResultsVisible(visible) {
      searchResults.style.display = visible ? 'block' : 'none';
      searchInput.setAttribute('aria-expanded', visible ? 'true' : 'false');
    }

    function setLoading(loading) {
      if (loadingEl) loadingEl.style.display = loading ? 'inline' : 'none';
    }

    function updateClearButton() {
      var hasValue = (searchInput.value || '').trim().length > 0;
      if (clearBtn) clearBtn.style.display = hasValue ? '' : 'none';
    }

    function runSearch(q) {
      if (searchAbortController) searchAbortController.abort();
      searchAbortController = new AbortController();
      setLoading(true);
      fetch('/search/suggest.json?q=' + encodeURIComponent(q) + '&resources[type]=product&resources[limit]=10', { signal: searchAbortController.signal })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var products = (data.resources && data.resources.results && data.resources.results.products) ||
            (data.results && data.results.products) || (data.products) || [];
          setLoading(false);
          setResultsVisible(true);
          if (!products.length) {
            searchResults.innerHTML = '<p class="ks-share-cart-builder__results-empty">No products found. Try a different term.</p>';
            return;
          }
          searchResults.innerHTML = '<ul class="ks-share-cart-builder__results-list" role="listbox">' +
            products.map(function (p) {
              var handle = p.handle || (p.url && p.url.split('/').filter(Boolean).pop()) || '';
              var title = escapeAttr(p.title || 'Product');
              var imgUrl = p.image || (p.featured_image && p.featured_image.url) || '';
              var imgHtml = imgUrl
                ? '<img class="ks-share-cart-builder__result-img" src="' + escapeAttr(imgUrl) + '" alt="" width="48" height="48" loading="lazy">'
                : '<span class="ks-share-cart-builder__result-img ks-share-cart-builder__result-img--placeholder" aria-hidden="true"></span>';
              return '<li class="ks-share-cart-builder__result-item" role="option">' +
                '<span class="ks-share-cart-builder__result-thumb">' + imgHtml + '</span>' +
                '<span class="ks-share-cart-builder__result-title">' + title + '</span>' +
                '<button type="button" class="ks-btn ks-btn-small ks-share-cart-builder__add-btn" data-handle="' + escapeAttr(handle) + '" data-title="' + title + '">Add</button>' +
                '</li>';
            }).join('') + '</ul>';
          searchResults.querySelectorAll('.ks-share-cart-builder__add-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
              var handle = this.getAttribute('data-handle');
              var title = this.getAttribute('data-title') || 'Product';
              if (!handle) return;
              addProductToShareCart(handle, title);
            });
          });
        })
        .catch(function (err) {
          if (err && err.name === 'AbortError') return;
          setLoading(false);
          setResultsVisible(true);
          searchResults.innerHTML = '<p class="ks-share-cart-builder__results-empty">Search unavailable. Please try again.</p>';
        });
    }

    searchInput.addEventListener('input', function () {
      var q = (this.value || '').trim();
      updateClearButton();
      if (searchTimeout) clearTimeout(searchTimeout);
      if (!q) {
        searchResults.innerHTML = '';
        setResultsVisible(false);
        return;
      }
      if (q.length < MIN_SEARCH_LENGTH) {
        setResultsVisible(true);
        searchResults.innerHTML = '<p class="ks-share-cart-builder__results-empty">Type at least ' + MIN_SEARCH_LENGTH + ' characters to search.</p>';
        return;
      }
      searchTimeout = setTimeout(function () { runSearch(q); }, DEBOUNCE_MS);
    });

    searchInput.addEventListener('focus', function () {
      var q = (searchInput.value || '').trim();
      if (q.length >= MIN_SEARCH_LENGTH && searchResults.innerHTML) setResultsVisible(true);
    });

    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        setResultsVisible(false);
        searchInput.focus();
      }
    });

    searchInput.addEventListener('blur', function () {
      setTimeout(function () {
        var active = document.activeElement;
        if (searchResults.contains(active) || (clearBtn && clearBtn.contains(active))) return;
        setResultsVisible(false);
      }, 150);
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        searchInput.value = '';
        searchResults.innerHTML = '';
        setResultsVisible(false);
        updateClearButton();
        searchInput.focus();
      });
    }

    function addProductToShareCart(handle, displayTitle) {
      fetch('/products/' + encodeURIComponent(handle) + '.js')
        .then(function (r) { return r.json(); })
        .then(function (product) {
          var variants = product.variants || [];
          if (variants.length === 0) {
            showToast('Product has no variants.', 'error');
            return;
          }
          var v = variants[0];
          var variantId = v.id || (v.id && String(v.id).split('/').pop()) || '';
          if (!variantId) {
            showToast('Could not get variant ID.', 'error');
            return;
          }
          var title = product.title || displayTitle || 'Product';
          var existing = shareCartSelectedItems.find(function (it) { return it.variantId === String(variantId); });
          if (existing) {
            existing.quantity += 1;
            showToast('Quantity increased for ' + title, 'success');
          } else {
            shareCartSelectedItems.push({ variantId: String(variantId), quantity: 1, title: title });
          }
          renderShareCartSelected();
          setResultsVisible(false);
          searchInput.value = '';
          updateClearButton();
        })
        .catch(function () {
          showToast('Could not load product.', 'error');
        });
    }

    function renderShareCartSelected() {
      selectedList.innerHTML = shareCartSelectedItems.length === 0
        ? '<li class="ks-share-cart-builder__list-empty">No products added. Search above and click Add.</li>'
        : shareCartSelectedItems.map(function (item, i) {
            return '<li class="ks-share-cart-builder__list-item">' +
              '<span class="ks-share-cart-builder__list-title">' + escapeAttr(item.title) + '</span>' +
              '<div class="ks-share-cart-builder__qty-wrap">' +
              '<button type="button" class="ks-share-cart-builder__qty-btn" data-index="' + i + '" data-delta="-1" aria-label="Decrease quantity">−</button>' +
              '<span class="ks-share-cart-builder__list-qty" aria-live="polite">' + item.quantity + '</span>' +
              '<button type="button" class="ks-share-cart-builder__qty-btn" data-index="' + i + '" data-delta="1" aria-label="Increase quantity">+</button>' +
              '</div>' +
              '<button type="button" class="ks-share-cart-builder__remove-btn" data-index="' + i + '" aria-label="Remove">Remove</button>' +
              '</li>';
          }).join('');
      if (actionsWrap) actionsWrap.style.display = shareCartSelectedItems.length > 0 ? 'block' : 'none';
      outputWrap.style.display = 'none';
      selectedList.querySelectorAll('.ks-share-cart-builder__remove-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var idx = parseInt(this.getAttribute('data-index'), 10);
          if (!isNaN(idx) && idx >= 0 && idx < shareCartSelectedItems.length) {
            shareCartSelectedItems.splice(idx, 1);
            renderShareCartSelected();
          }
        });
      });
      selectedList.querySelectorAll('.ks-share-cart-builder__qty-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var idx = parseInt(this.getAttribute('data-index'), 10);
          var delta = parseInt(this.getAttribute('data-delta'), 10);
          if (isNaN(idx) || idx < 0 || idx >= shareCartSelectedItems.length) return;
          var item = shareCartSelectedItems[idx];
          var newQty = item.quantity + delta;
          if (newQty < 1) {
            shareCartSelectedItems.splice(idx, 1);
          } else {
            item.quantity = newQty;
          }
          renderShareCartSelected();
        });
      });
    }

    var shareDiscountModal = document.getElementById('affiliate-area-share-discount-modal');
    var shareDiscountModalCodes = document.getElementById('affiliate-area-share-discount-modal-codes');
    var shareDiscountModalCancel = document.getElementById('affiliate-area-share-discount-modal-cancel');
    var shareDiscountModalGenerate = document.getElementById('affiliate-area-share-discount-modal-generate');
    var pendingBaseShareUrl = null;

    function openShareDiscountModal(baseShareUrl) {
      pendingBaseShareUrl = baseShareUrl;
      if (shareDiscountModalGenerate) {
        shareDiscountModalGenerate.disabled = true;
      }
      if (shareDiscountModal) {
        shareDiscountModal.removeAttribute('hidden');
        shareDiscountModal.setAttribute('aria-hidden', 'false');
      }
      if (!shareDiscountModalCodes) {
        if (shareDiscountModalGenerate) shareDiscountModalGenerate.disabled = false;
        return;
      }
      shareDiscountModalCodes.innerHTML = '<p class="ks-share-discount-modal__loading">Loading your codes…</p>';
      var shop = getShop();
      var aid = getAffiliateId();
      if (!shop || !aid) {
        shareDiscountModalCodes.innerHTML = '<p class="ks-share-discount-modal__empty">Shop or affiliate not available.</p>';
        if (shareDiscountModalGenerate) shareDiscountModalGenerate.disabled = false;
        return;
      }
      var url = '/api/affiliates/discounts/created?shop=' + encodeURIComponent(shop) + '&affiliateId=' + encodeURIComponent(aid) + '&limit=50';
      apiCall(url, 'GET').then(function (result) {
        if (!result.success || !Array.isArray(result.discounts)) {
          shareDiscountModalCodes.innerHTML = '<p class="ks-share-discount-modal__empty">Unable to load your discount codes.</p>';
        } else {
          var active = (result.discounts || []).filter(function (d) {
          var s = (d.status || '').toLowerCase();
          return s !== 'deactivated' && s !== 'usage_limit_reached';
        });
          var html = '<label class="ks-share-discount-modal__tier"><input type="radio" name="affiliate-share-discount-code" value="" checked> No discount</label>';
          active.forEach(function (d) {
            var code = (d.code || '').toString().trim();
            if (!code) return;
            var label = escapeAttr(code) + (d.percentage != null ? ' (' + d.percentage + '%)' : '');
            html += '<label class="ks-share-discount-modal__tier"><input type="radio" name="affiliate-share-discount-code" value="' + escapeAttr(code) + '"> ' + label + '</label>';
          });
          if (active.length === 0) {
            html += '<p class="ks-share-discount-modal__empty">No active single-use codes. Create one in Settings → Single-use discount codes.</p>';
          }
          shareDiscountModalCodes.innerHTML = html;
        }
        if (shareDiscountModalGenerate) shareDiscountModalGenerate.disabled = false;
      }).catch(function () {
        shareDiscountModalCodes.innerHTML = '<p class="ks-share-discount-modal__empty">Failed to load your discount codes.</p>';
        if (shareDiscountModalGenerate) shareDiscountModalGenerate.disabled = false;
      });
    }

    function closeShareDiscountModal() {
      if (shareDiscountModal) {
        shareDiscountModal.setAttribute('hidden', '');
        shareDiscountModal.setAttribute('aria-hidden', 'true');
      }
      pendingBaseShareUrl = null;
    }

    if (shareDiscountModal) {
      var backdrop = shareDiscountModal.querySelector('.ks-share-discount-modal__backdrop');
      if (backdrop) backdrop.addEventListener('click', closeShareDiscountModal);
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && shareDiscountModal && !shareDiscountModal.hasAttribute('hidden')) closeShareDiscountModal();
      });
    }
    if (shareDiscountModalCancel) shareDiscountModalCancel.addEventListener('click', closeShareDiscountModal);

    if (shareDiscountModalGenerate) {
      shareDiscountModalGenerate.addEventListener('click', function () {
        var baseShareUrl = pendingBaseShareUrl;
        closeShareDiscountModal();
        if (!baseShareUrl) return;
        var selected = document.querySelector('input[name="affiliate-share-discount-code"]:checked');
        var code = selected ? (selected.value || '').trim() : '';
        var shareUrl = baseShareUrl;
        if (code) {
          shareUrl = baseShareUrl + (baseShareUrl.indexOf('?') >= 0 ? '&' : '?') + 'discount=' + encodeURIComponent(code);
          showToast('Share link includes discount code: ' + code, 'success');
        }
        if (outputInput) outputInput.value = shareUrl;
        if (outputWrap) outputWrap.style.display = 'block';
      });
    }

    if (generateBtn) {
      generateBtn.addEventListener('click', function () {
        var baseUrl = window._ksPrimaryReferralUrl || '';
        if (!baseUrl) {
          showToast('Referral link not loaded.', 'error');
          return;
        }
        if (shareCartSelectedItems.length === 0) {
          showToast('Add at least one product first.', 'error');
          return;
        }
        var cartParam = shareCartSelectedItems.map(function (i) { return i.variantId + ':' + i.quantity; }).join(',');
        var sep = baseUrl.indexOf('?') >= 0 ? '&' : '?';
        var baseShareUrl = baseUrl + sep + 'cart=' + encodeURIComponent(cartParam);
        openShareDiscountModal(baseShareUrl);
      });
    }
    if (copyBtn && outputInput) {
      copyBtn.addEventListener('click', function () {
        var url = outputInput.value;
        if (!url) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () {
            showToast('Share Cart URL copied to clipboard!', 'success');
          }).catch(function () { showToast('Failed to copy.', 'error'); });
        } else {
          showToast('Copy not supported.', 'error');
        }
      });
    }

    renderShareCartSelected();
  }

  function showAccessDenied(message) {
    var errorEl = document.getElementById('affiliate-area-error');
    var messageEl = document.getElementById('affiliate-area-error-message');
    var containerEl = document.getElementById('affiliate-area-container');
    if (messageEl && message) messageEl.textContent = message;
    if (errorEl) errorEl.style.display = 'block';
    if (containerEl) containerEl.style.setProperty('display', 'none', 'important');
  }

  function hideAccessDenied() {
    var errorEl = document.getElementById('affiliate-area-error');
    var containerEl = document.getElementById('affiliate-area-container');
    if (errorEl) errorEl.style.display = 'none';
    if (containerEl) containerEl.style.removeProperty('display');
  }

  function populateAffiliateSidebar() {
    var nameEl = document.getElementById('affiliate-area-sidebar-name');
    var emailEl = document.getElementById('affiliate-area-sidebar-email');
    var email = getCustomerEmail() || '';
    if (emailEl) emailEl.textContent = email || '—';
    var name = '';
    if (affiliateData && affiliateData.profile) {
      name = (affiliateData.profile.name || (affiliateData.profile.firstName && affiliateData.profile.lastName ? affiliateData.profile.firstName + ' ' + affiliateData.profile.lastName : '') || '').trim();
    }
    if (!name && window.KISCENCE_CUSTOMER && window.KISCENCE_CUSTOMER.name) name = window.KISCENCE_CUSTOMER.name;
    if (!name && email) name = email.replace(/@.*/, '').replace(/[._]/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    if (nameEl) nameEl.textContent = name || 'Affiliate';
  }

  function getAffiliateTabIcon(type) {
    var icons = {
      'affiliate-urls': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
      statistics: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
      graphs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
      referrals: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
      payouts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
      visits: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
      settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
      'lifetime-customers': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
    };
    return icons[type] || '';
  }

  function populateAffiliateSidebarIcons() {
    var container = document.getElementById(CONTAINER_ID);
    if (!container) return;
    var sidebar = container.querySelector('.ks-sidebar');
    if (!sidebar) return;
    sidebar.querySelectorAll('.ks-tab').forEach(function (tab) {
      var iconEl = tab.querySelector('.ks-tab__icon');
      if (!iconEl) return;
      var type = tab.getAttribute('data-tab') || '';
      var svg = getAffiliateTabIcon(type);
      if (svg) iconEl.innerHTML = svg;
    });
  }

  function showNoReferralLink() {
    var el = document.getElementById('affiliate-area-primary-referral-link');
    var placeholder = document.getElementById('affiliate-area-urls-content');
    if (el) el.innerHTML = '';
    if (placeholder) {
      placeholder.innerHTML = '<p class="ks-affiliate-area__placeholder">No referral link found. You may need to be an approved affiliate. You can also check the <a href="/pages/affiliate-dashboard">Practitioner Dashboard</a>.</p>';
      placeholder.style.display = 'block';
    }
  }

  function populateReferralLinksList() {
    var wrap = document.getElementById('affiliate-area-referral-links-wrap');
    var el = document.getElementById('affiliate-area-referral-links');
    if (!el || !affiliateData) return;
    var links = affiliateData.referralLinks || [];
    if (links.length === 0) {
      if (wrap) wrap.style.display = 'none';
      referralLinksCurrentPage = 1;
      return;
    }
    var totalPages = Math.ceil(links.length / REFERRAL_LINKS_PER_PAGE) || 1;
    if (referralLinksCurrentPage > totalPages) referralLinksCurrentPage = totalPages;
    if (referralLinksCurrentPage < 1) referralLinksCurrentPage = 1;
    var start = (referralLinksCurrentPage - 1) * REFERRAL_LINKS_PER_PAGE;
    var pageLinks = links.slice(start, start + REFERRAL_LINKS_PER_PAGE);

    var linkUrl = function (link) {
      return link.url || (API_BASE_URL + '/ref=' + (link.shortCode || ''));
    };
    var currency = (affiliateData.earnings && affiliateData.earnings.currency) || 'USD';
    var listHtml =
      '<div class="ks-affiliate-links-list">' +
      pageLinks.map(function (link) {
        var isReplaced = (link.status || '').toLowerCase() === 'replaced';
        var url = linkUrl(link);
        var urlAttr = url.replace(/"/g, '&quot;');
        var actionsHtml = isReplaced
          ? '<p class="ks-affiliate-link-card__expired">This link has expired and can no longer be used. Use your current referral link above.</p>'
          : '<div class="ks-affiliate-link-card__actions">' +
            '<button type="button" class="ks-btn ks-btn-small js-copy-link-btn" data-copy-url="' + urlAttr + '">Copy link</button>' +
            '</div>';
        return (
          '<div class="ks-affiliate-link-card' + (isReplaced ? ' ks-affiliate-link-card--replaced' : '') + '">' +
          '<div class="ks-affiliate-link-card__top">' +
          '<span class="ks-affiliate-link-card__code">' + escapeAttr(link.shortCode) + '</span> ' +
          getStatusBadge(link.status) +
          '</div>' +
          (link.description ? '<p class="ks-affiliate-link-card__desc">' + escapeAttr(link.description) + '</p>' : '') +
          '<div class="ks-affiliate-link-card__stats">' +
          '<span class="ks-affiliate-link-card__stat"><span class="ks-affiliate-link-card__stat-label">Clicks</span> ' + (link.stats && link.stats.clicks || 0) + '</span> ' +
          '<span class="ks-affiliate-link-card__stat"><span class="ks-affiliate-link-card__stat-label">Conversions</span> ' + (link.stats && link.stats.conversions || 0) + '</span> ' +
          '<span class="ks-affiliate-link-card__stat"><span class="ks-affiliate-link-card__stat-label">Revenue</span> ' + formatCurrency(link.stats && link.stats.revenue || 0, currency) + '</span>' +
          '</div>' +
          actionsHtml +
          '</div>'
        );
      }).join('') +
      '</div>' +
      '<button type="button" class="ks-btn ks-affiliate-links-create js-create-referral-link">Create New Link</button>';

    var paginationHtml = '';
    if (totalPages > 1) {
      var page = referralLinksCurrentPage;
      var prev = page > 1 ? page - 1 : 1;
      var next = page < totalPages ? page + 1 : totalPages;
      paginationHtml =
        '<div class="ks-visits-footer ks-affiliate-links-pagination-wrap">' +
        '<span class="ks-visits-pagination-info">' + links.length + ' link' + (links.length !== 1 ? 's' : '') + '</span>' +
        '<div id="affiliate-area-referral-links-pagination" class="ks-visits-pagination">' +
        '<button type="button" class="ks-visits-pagination-btn" data-page="1" ' + (page <= 1 ? 'disabled' : '') + ' aria-label="First page">&laquo;</button>' +
        '<button type="button" class="ks-visits-pagination-btn" data-page="' + prev + '" ' + (page <= 1 ? 'disabled' : '') + ' aria-label="Previous">&lsaquo;</button>' +
        '<span class="ks-visits-pagination-info">' + page + ' of ' + totalPages + '</span>' +
        '<button type="button" class="ks-visits-pagination-btn" data-page="' + next + '" ' + (page >= totalPages ? 'disabled' : '') + ' aria-label="Next">&rsaquo;</button>' +
        '<button type="button" class="ks-visits-pagination-btn" data-page="' + totalPages + '" ' + (page >= totalPages ? 'disabled' : '') + ' aria-label="Last page">&raquo;</button>' +
        '</div></div>';
    }

    el.innerHTML = listHtml + paginationHtml;
    if (wrap) wrap.style.display = 'block';

    el.querySelectorAll('.js-copy-link-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var url = this.getAttribute('data-copy-url');
        if (url && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () { showToast('Referral link copied to clipboard!', 'success'); }).catch(function () { showToast('Failed to copy.', 'error'); });
        }
      });
    });
    var createBtn = el.querySelector('.js-create-referral-link');
    if (createBtn) {
      createBtn.addEventListener('click', createNewReferralLink);
      console.log('[CreateLink] Create New Link button wired in populateReferralLinksList');
    } else {
      console.warn('[CreateLink] Create New Link button .js-create-referral-link not found in list');
    }

    if (totalPages > 1) {
      var paginationEl = document.getElementById('affiliate-area-referral-links-pagination');
      if (paginationEl) {
        paginationEl.querySelectorAll('.ks-visits-pagination-btn').forEach(function (btn) {
          var p = parseInt(btn.getAttribute('data-page'), 10);
          if (btn.disabled) return;
          btn.addEventListener('click', function () {
            referralLinksCurrentPage = p;
            populateReferralLinksList();
          });
        });
      }
    }
  }

  function populateStatistics() {
    var el = document.getElementById('affiliate-area-statistics-content');
    if (!el || !affiliateData) return;
    var stats = affiliateData.stats || {};
    var earnings = affiliateData.earnings || {};
    var links = affiliateData.referralLinks || [];
    var currency = earnings.currency || 'USD';
    el.innerHTML =
      '<div class="ks-affiliate-analytics-card">' +
      '<h4 class="ks-affiliate-analytics-card__title">Performance Summary</h4>' +
      '<ul class="ks-affiliate-analytics-card__list">' +
      '<li class="ks-affiliate-analytics-card__row"><span class="ks-affiliate-analytics-card__label">Total Referral Links</span><span class="ks-affiliate-analytics-card__value">' + links.length + '</span></li>' +
      '<li class="ks-affiliate-analytics-card__row"><span class="ks-affiliate-analytics-card__label">Total Clicks</span><span class="ks-affiliate-analytics-card__value">' + (stats.totalClicks || 0) + '</span></li>' +
      '<li class="ks-affiliate-analytics-card__row"><span class="ks-affiliate-analytics-card__label">Total Conversions</span><span class="ks-affiliate-analytics-card__value">' + (stats.totalConversions || 0) + '</span></li>' +
      '<li class="ks-affiliate-analytics-card__row"><span class="ks-affiliate-analytics-card__label">Conversion Rate</span><span class="ks-affiliate-analytics-card__value">' + (stats.conversionRate != null && String(stats.conversionRate).indexOf('%') !== -1 ? stats.conversionRate : (stats.conversionRate != null ? stats.conversionRate : '0') + '%') + '</span></li>' +
      '<li class="ks-affiliate-analytics-card__row"><span class="ks-affiliate-analytics-card__label">Commission Rate</span><span class="ks-affiliate-analytics-card__value">' + ((stats.commissionRate != null ? Number(stats.commissionRate) : 0.1) * 100).toFixed(1) + '%</span></li>' +
      '<li class="ks-affiliate-analytics-card__row"><span class="ks-affiliate-analytics-card__label">Total Revenue Generated</span><span class="ks-affiliate-analytics-card__value">' + formatCurrency(stats.totalRevenue || 0, currency) + '</span></li>' +
      '<li class="ks-affiliate-analytics-card__row" style="margin-top:4px"><span class="ks-affiliate-analytics-card__label" style="font-size:12px;opacity:0.85">(Total value of orders from your links; commission is a % of this)</span></li>' +
      '</ul></div>';
  }

  function toLocalYYYYMMDD(d) {
    var y = d.getFullYear();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return y + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  function getGraphDateRange(period) {
    var now = new Date();
    var from, to;
    if (period === 'last-month') {
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (period === 'last-3-months') {
      from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    return {
      from: toLocalYYYYMMDD(from),
      to: toLocalYYYYMMDD(to)
    };
  }

  function loadGraphData() {
    var aid = getAffiliateId();
    var el = document.getElementById('affiliate-area-graphs-content');
    var periodEl = document.getElementById('affiliate-area-graphs-period');
    if (!el || !aid) return;
    var period = (periodEl && periodEl.value) ? periodEl.value : 'this-month';
    var range = getGraphDateRange(period);
    el.innerHTML = '<div class="ks-graphs-loading"><span class="ks-loader" aria-hidden="true"></span> Loading graph…</div>';
    var url = API_BASE_URL + '/api/affiliates/' + encodeURIComponent(aid) + '/graph-data?from=' + encodeURIComponent(range.from) + '&to=' + encodeURIComponent(range.to);
    fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var useData = data;
        if (!data.success || !data.labels || data.labels.length === 0) {
          useData = { success: true, labels: [], unpaid: [], pending: [], rejected: [], paid: [] };
        } else {
          var maxVal = 0;
          (data.unpaid || []).forEach(function (v, i) {
            var sum = (data.unpaid[i] || 0) + (data.pending[i] || 0) + (data.rejected[i] || 0) + (data.paid[i] || 0);
            if (sum > maxVal) maxVal = sum;
          });
          if (maxVal === 0) {
            useData = { success: true, labels: data.labels || [], unpaid: [], pending: [], rejected: [], paid: [] };
          }
        }
        renderReferralGraph(el, useData, period);
      })
      .catch(function () {
        renderReferralGraph(el, { success: true, labels: [], unpaid: [], pending: [], rejected: [], paid: [] }, period);
      });
  }

  function renderReferralGraph(container, data, period) {
    period = period || 'this-month';
    var labels = data.labels || [];
    var unpaid = data.unpaid || [];
    var pending = data.pending || [];
    var rejected = data.rejected || [];
    var paid = data.paid || [];
    var maxVal = 0;
    unpaid.forEach(function (v, i) {
      var sum = (unpaid[i] || 0) + (pending[i] || 0) + (rejected[i] || 0) + (paid[i] || 0);
      if (sum > maxVal) maxVal = sum;
    });
    var hasData = maxVal > 0;
    if (maxVal === 0) maxVal = 1;
    var yMax = Math.ceil(maxVal);
    if (yMax < 1) yMax = 1;
    var legend = [
      { key: 'unpaid', label: 'Unpaid Referral Earnings', color: '#f0ad4e' },
      { key: 'pending', label: 'Pending Referral Earnings', color: '#5bc0de' },
      { key: 'rejected', label: 'Rejected Referral Earnings', color: '#d9534f' },
      { key: 'paid', label: 'Paid Referral Earnings', color: '#5cb85c' }
    ];
    var series = [
      { data: unpaid, color: legend[0].color },
      { data: pending, color: legend[1].color },
      { data: rejected, color: legend[2].color },
      { data: paid, color: legend[3].color }
    ];

    var controlsHtml =
      '<div class="ks-graphs-controls">' +
      '<label class="ks-graphs-period-label">' +
      '<select id="affiliate-area-graphs-period" class="ks-graphs-period-select" aria-label="Time period">' +
      '<option value="this-month"' + (period === 'this-month' ? ' selected' : '') + '>This Month</option>' +
      '<option value="last-month"' + (period === 'last-month' ? ' selected' : '') + '>Last Month</option>' +
      '<option value="last-3-months"' + (period === 'last-3-months' ? ' selected' : '') + '>Last 3 Months</option>' +
      '</select>' +
      '</label>' +
      '<button type="button" id="affiliate-area-graphs-filter-btn" class="ks-btn">Filter</button>' +
      '</div>';

    var chartHtml;
    if (!hasData) {
      chartHtml =
        '<div class="ks-graphs-chart-wrap ks-graphs-chart-wrap--empty">' +
        '<div class="ks-graph-y-axis">' +
        '<div class="ks-graph-y-tick">0</div><div class="ks-graph-y-tick">1</div>' +
        '</div>' +
        '<div class="ks-graphs-no-data" role="img" aria-label="No referral data for this period">No data for this period.</div>' +
        '</div>';
    } else {
      var pad = { top: 14, right: 16, bottom: 30, left: 48 };
      var w = 880;
      var h = 260;
      var plotW = w - pad.left - pad.right;
      var plotH = h - pad.top - pad.bottom;
      var n = labels.length;
      var stepX = n > 1 ? plotW / (n - 1) : plotW;
      var pointsToPath = function (pts) {
        return pts.map(function (p, i) { return (i === 0 ? 'M' : 'L') + p.x + ',' + p.y; }).join(' ');
      };
      var maxYTicks = 7;
      var yStep = yMax <= maxYTicks ? 1 : Math.ceil(yMax / (maxYTicks - 1));
      var yAxisTicks = [];
      for (var y = 0; y <= yMax; y += yStep) {
        yAxisTicks.push(y);
      }
      if (yAxisTicks[yAxisTicks.length - 1] !== yMax) {
        yAxisTicks.push(yMax);
      }
      var gridLines = yAxisTicks.map(function (y) {
        var yy = pad.top + plotH - (y / yMax) * plotH;
        return '<line class="ks-line-grid" x1="' + pad.left + '" y1="' + yy + '" x2="' + (w - pad.right) + '" y2="' + yy + '"/>';
      }).join('');
      var yLabels = yAxisTicks.map(function (y) {
        var yy = pad.top + plotH - (y / yMax) * plotH;
        return '<text class="ks-line-axis-text" x="' + (pad.left - 8) + '" y="' + (yy + 4) + '" text-anchor="end">' + y + '</text>';
      }).join('');
      var xLabels = labels.map(function (lbl, i) {
        var xx = pad.left + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
        return '<text class="ks-line-axis-text ks-line-axis-text--x" x="' + xx + '" y="' + (h - 6) + '" text-anchor="middle">' + escapeAttr(lbl) + '</text>';
      }).join('');
      var linesHtml = series.map(function (s) {
        var pts = [];
        for (var i = 0; i < n; i++) {
          var val = s.data[i] || 0;
          var xx = pad.left + (n > 1 ? (i / (n - 1)) * plotW : 0);
          var yy = pad.top + plotH - (yMax > 0 ? (val / yMax) * plotH : 0);
          pts.push({ x: xx, y: yy });
        }
        var d = pointsToPath(pts);
        return '<polyline class="ks-line-series" fill="none" stroke="' + s.color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="' + pts.map(function (p) { return p.x + ',' + p.y; }).join(' ') + '"/>';
      }).join('');
      chartHtml =
        '<div class="ks-graphs-chart-wrap ks-graphs-line-wrap">' +
        '<svg class="ks-line-chart-svg" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Referral earnings by status: line chart">' +
        '<g class="ks-line-grid-group">' + gridLines + '</g>' +
        '<g class="ks-line-y-labels">' + yLabels + '</g>' +
        '<g class="ks-line-series-group">' + linesHtml + '</g>' +
        '<g class="ks-line-x-labels">' + xLabels + '</g>' +
        '</svg>' +
        '</div>';
    }

    container.innerHTML =
      '<div class="ks-referral-graphs">' +
      '<h4 class="ks-referral-graphs__title">Referral Earnings by Status</h4>' +
      controlsHtml +
      chartHtml +
      '<div class="ks-graphs-legend">' +
      legend.map(function (l) {
        return '<span class="ks-graphs-legend-item"><span class="ks-graphs-legend-swatch" style="background:' + l.color + ';"></span>' + escapeAttr(l.label) + '</span>';
      }).join('') +
      '</div>' +
      '</div>';
    var filterBtn = container.querySelector('#affiliate-area-graphs-filter-btn');
    var periodSelect = container.querySelector('#affiliate-area-graphs-period');
    if (filterBtn) filterBtn.addEventListener('click', loadGraphData);
    if (periodSelect) periodSelect.addEventListener('change', loadGraphData);
  }

  function populateGraphs() {
    var el = document.getElementById('affiliate-area-graphs-content');
    if (!el || !affiliateData) return;
    el.innerHTML = '<div class="ks-graphs-loading"><span class="ks-loader" aria-hidden="true"></span> Loading graph…</div>';
    loadGraphData();
  }

  function formatPayoutDate(d) {
    if (!d) return '—';
    var date = new Date(d);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function populatePayouts() {
    var el = document.getElementById('affiliate-area-payouts-content');
    if (!el || !affiliateData) return;
    var earnings = affiliateData.earnings || { total: 0, pending: 0, paid: 0, currency: 'USD' };
    var payouts = affiliateData.payouts || [];
    var paidCount = payouts.filter(function (p) { return String(p.status || '').toLowerCase() === 'paid'; }).length;
    var processingCount = payouts.filter(function (p) { return String(p.status || '').toLowerCase() === 'processing'; }).length;
    var failedCount = payouts.filter(function (p) { return String(p.status || '').toLowerCase() === 'failed'; }).length;
    var summary = payouts.length === 0
      ? 'All (0)'
      : 'All (' + payouts.length + ')' +
        (processingCount ? ' | Processing (' + processingCount + ')' : '') +
        (paidCount ? ' | Paid (' + paidCount + ')' : '') +
        (failedCount ? ' | Failed (' + failedCount + ')' : '');
    el.innerHTML =
      '<p class="ks-affiliate-area__visits-intro">Payout history: date, amount, method, and status.</p>' +
      (payouts.length > 0 ? '<p class="ks-payouts-summary">' + escapeAttr(summary) + '</p>' : '') +
      '<div class="ks-payouts-table-wrap">' +
      '<table class="ks-referrals-table ks-payouts-table" role="grid">' +
      '<thead><tr>' +
      '<th class="ks-referrals-th">Date</th>' +
      '<th class="ks-referrals-th">Amount</th>' +
      '<th class="ks-referrals-th">Payout Method</th>' +
      '<th class="ks-referrals-th">Status</th>' +
      '</tr></thead>' +
      '<tbody id="affiliate-area-payouts-tbody">' +
      (payouts.length === 0
        ? '<tr><td colspan="4" class="ks-referrals-empty">No payouts yet.</td></tr>'
        : payouts.map(function (p) {
            var dateStr = formatPayoutDate(p.date || p.timestamp);
            var amount = formatCurrency(p.amount != null ? p.amount : 0, p.currency || earnings.currency);
            var method = escapeAttr(p.payoutMethod || p.payout_method || '—');
            var statusBadge = getStatusBadge(p.status || 'Pending');
            return '<tr><td class="ks-referrals-td ks-referrals-td--date">' + dateStr + '</td><td class="ks-referrals-td">' + amount + '</td><td class="ks-referrals-td ks-referrals-td--payout">' + method + '</td><td class="ks-referrals-td">' + statusBadge + '</td></tr>';
          }).join('')) +
      '</tbody></table></div>';
  }

  function formatVisitDate(d) {
    if (!d) return '—';
    var date = new Date(d);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) + ' ' + date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  function loadVisitsPage(page) {
    var customerId = getCustomerId();
    var shop = (window.Shopify && window.Shopify.shop) || window.location.hostname;
    var email = getCustomerEmail();
    var tbody = document.getElementById('affiliate-area-visits-tbody');
    var countEl = document.getElementById('affiliate-area-visits-count');
    var paginationEl = document.getElementById('affiliate-area-visits-pagination');
    var noVisitsEl = document.getElementById('affiliate-area-no-visits');
    if (!tbody || !customerId || !shop) return;

    var fromEl = document.getElementById('affiliate-area-visits-from');
    var toEl = document.getElementById('affiliate-area-visits-to');
    var from = fromEl && fromEl.value ? fromEl.value : '';
    var to = toEl && toEl.value ? toEl.value : '';

    tbody.innerHTML = '<tr><td colspan="5" class="ks-visits-loading"><span class="ks-loader" aria-hidden="true"></span> Loading visits…</td></tr>';
    if (noVisitsEl) noVisitsEl.style.display = 'none';

    var url = API_BASE_URL + '/api/affiliates/customer/' + encodeURIComponent(customerId) + '/visits?shop=' + encodeURIComponent(shop) + '&email=' + encodeURIComponent(email) + '&page=' + page + '&limit=20';
    if (from) url += '&from=' + encodeURIComponent(from);
    if (to) url += '&to=' + encodeURIComponent(to);

    fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.success) {
          tbody.innerHTML = '<tr><td colspan="5" class="ks-visits-error">Unable to load visits.</td></tr>';
          return;
        }
        var visits = data.visits || [];
        var total = data.total || 0;
        var totalPages = data.totalPages || 0;

        if (countEl) countEl.textContent = total + ' item' + (total !== 1 ? 's' : '');
        if (paginationEl) {
          var prev = page > 1 ? page - 1 : 1;
          var next = page < totalPages ? page + 1 : totalPages;
          paginationEl.innerHTML =
            '<button type="button" class="ks-visits-pagination-btn" data-page="1" ' + (page <= 1 ? 'disabled' : '') + ' aria-label="First page">&laquo;</button>' +
            '<button type="button" class="ks-visits-pagination-btn" data-page="' + prev + '" ' + (page <= 1 ? 'disabled' : '') + ' aria-label="Previous">&lsaquo;</button>' +
            '<span class="ks-visits-pagination-info">' + page + ' of ' + (totalPages || 1) + '</span>' +
            '<button type="button" class="ks-visits-pagination-btn" data-page="' + next + '" ' + (page >= totalPages ? 'disabled' : '') + ' aria-label="Next">&rsaquo;</button>' +
            '<button type="button" class="ks-visits-pagination-btn" data-page="' + totalPages + '" ' + (page >= totalPages ? 'disabled' : '') + ' aria-label="Last page">&raquo;</button>';
          paginationEl.querySelectorAll('.ks-visits-pagination-btn').forEach(function (btn) {
            var p = parseInt(btn.getAttribute('data-page'), 10);
            if (btn.disabled) return;
            btn.addEventListener('click', function () { loadVisitsPage(p); });
          });
        }

        if (visits.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" class="ks-visits-empty">No visits in this range.</td></tr>';
          if (noVisitsEl) noVisitsEl.style.display = 'block';
          return;
        }
        if (noVisitsEl) noVisitsEl.style.display = 'none';
        tbody.innerHTML = visits.map(function (v) {
          var converted = v.converted ? '<span class="ks-visits-converted ks-visits-converted--yes" aria-label="Converted">&#x2713;</span>' : '<span class="ks-visits-converted ks-visits-converted--no" aria-label="Not converted">&#x2717;</span>';
          var productCell = (v.productPurchased && v.productPurchased.length) ? escapeAttr(v.productPurchased) : '—';
          return '<tr>' +
            '<td class="ks-visits-td ks-visits-td--id">' + (v.rowNumber != null ? v.rowNumber : '') + '</td>' +
            '<td class="ks-visits-td">' + productCell + '</td>' +
            '<td class="ks-visits-td ks-visits-td--referrer">' + escapeAttr(v.referringUrl || 'Direct traffic') + '</td>' +
            '<td class="ks-visits-td">' + converted + '</td>' +
            '<td class="ks-visits-td ks-visits-td--date">' + escapeAttr(formatVisitDate(v.date)) + '</td>' +
            '</tr>';
        }).join('');
      })
      .catch(function () {
        tbody.innerHTML = '<tr><td colspan="5" class="ks-visits-error">Failed to load visits.</td></tr>';
      });
  }

  function populateVisits() {
    var el = document.getElementById('affiliate-area-visits-content');
    if (!el || !affiliateData) return;

    el.innerHTML =
      '<p class="ks-affiliate-area__visits-intro">Each row is a visit (click) on your referral or Share Cart link. Use the date range to filter.</p>' +
      '<div class="ks-visits-filters">' +
      '<label class="ks-visits-filter-label">From <input type="date" id="affiliate-area-visits-from" class="ks-visits-input"></label>' +
      '<label class="ks-visits-filter-label">To <input type="date" id="affiliate-area-visits-to" class="ks-visits-input"></label>' +
      '<button type="button" id="affiliate-area-visits-filter-btn" class="ks-btn">Filter</button>' +
      '</div>' +
      '<div class="ks-visits-table-wrap">' +
      '<table class="ks-visits-table" role="grid">' +
      '<thead><tr>' +
      '<th class="ks-visits-th">Visit ID</th>' +
      '<th class="ks-visits-th">Product(s) purchased</th>' +
      '<th class="ks-visits-th">Referring URL</th>' +
      '<th class="ks-visits-th">Converted</th>' +
      '<th class="ks-visits-th">Date</th>' +
      '</tr></thead>' +
      '<tbody id="affiliate-area-visits-tbody"></tbody>' +
      '</table></div>' +
      '<div class="ks-visits-footer">' +
      '<span id="affiliate-area-visits-count">0 items</span>' +
      '<div id="affiliate-area-visits-pagination" class="ks-visits-pagination"></div>' +
      '</div>' +
      '<p id="affiliate-area-no-visits" class="ks-affiliate-area__placeholder" style="display:none;">No visits to display.</p>';

    var filterBtn = document.getElementById('affiliate-area-visits-filter-btn');
    if (filterBtn) filterBtn.addEventListener('click', function () { loadVisitsPage(1); });

    loadVisitsPage(1);
  }

  function loadLifetimeCustomersPage(page) {
    var customerId = getCustomerId();
    var shop = (window.Shopify && window.Shopify.shop) || window.location.hostname;
    var email = getCustomerEmail();
    var tbody = document.getElementById('affiliate-area-lifetime-tbody');
    var countEl = document.getElementById('affiliate-area-lifetime-count');
    var paginationEl = document.getElementById('affiliate-area-lifetime-pagination');
    if (!tbody || !customerId || !shop) return;

    page = Math.max(1, parseInt(page, 10) || 1);
    tbody.innerHTML = '<tr><td colspan="4" class="ks-visits-loading"><span class="ks-loader" aria-hidden="true"></span> Loading lifetime customers…</td></tr>';

    var url = API_BASE_URL + '/api/affiliates/customer/' + encodeURIComponent(customerId) + '/lifetime-customers?shop=' + encodeURIComponent(shop) + '&email=' + encodeURIComponent(email) + '&page=' + page + '&limit=20';
    fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.success) {
          tbody.innerHTML = '<tr><td colspan="4" class="ks-visits-error">Unable to load lifetime customers.</td></tr>';
          return;
        }
        var customers = data.customers || [];
        var total = data.total || 0;
        var totalPages = data.totalPages || 0;

        if (countEl) countEl.textContent = total + ' customer' + (total !== 1 ? 's' : '');
        if (paginationEl) {
          var prev = page > 1 ? page - 1 : 1;
          var next = page < totalPages ? page + 1 : totalPages;
          paginationEl.innerHTML =
            '<button type="button" class="ks-visits-pagination-btn" data-page="1" ' + (page <= 1 ? 'disabled' : '') + ' aria-label="First page">&laquo;</button>' +
            '<button type="button" class="ks-visits-pagination-btn" data-page="' + prev + '" ' + (page <= 1 ? 'disabled' : '') + ' aria-label="Previous">&lsaquo;</button>' +
            '<span class="ks-visits-pagination-info">' + page + ' of ' + (totalPages || 1) + '</span>' +
            '<button type="button" class="ks-visits-pagination-btn" data-page="' + next + '" ' + (page >= totalPages ? 'disabled' : '') + ' aria-label="Next">&rsaquo;</button>' +
            '<button type="button" class="ks-visits-pagination-btn" data-page="' + totalPages + '" ' + (page >= totalPages ? 'disabled' : '') + ' aria-label="Last page">&raquo;</button>';
          paginationEl.querySelectorAll('.ks-visits-pagination-btn').forEach(function (btn) {
            var p = parseInt(btn.getAttribute('data-page'), 10);
            if (btn.disabled) return;
            btn.addEventListener('click', function () { loadLifetimeCustomersPage(p); });
          });
        }

        if (customers.length === 0) {
          tbody.innerHTML = '<tr><td colspan="4" class="ks-visits-empty">No lifetime customers yet.</td></tr>';
          return;
        }
        tbody.innerHTML = customers.map(function (c) {
          var customerDisplay = (c.customerName && c.customerName !== '—' ? escapeAttr(c.customerName) + ' &lt;' + escapeAttr(c.customerEmail || '') + '&gt;' : escapeAttr(c.customerEmail || '—'));
          var dateStr = formatVisitDate(c.firstOrderDate);
          var revenue = formatCurrency(c.totalRevenue, c.currency);
          return '<tr>' +
            '<td class="ks-referrals-td ks-referrals-td--desc">' + customerDisplay + '</td>' +
            '<td class="ks-referrals-td ks-referrals-td--date">' + dateStr + '</td>' +
            '<td class="ks-referrals-td">' + (c.orderCount || 0) + '</td>' +
            '<td class="ks-referrals-td">' + revenue + '</td>' +
            '</tr>';
        }).join('');
      })
      .catch(function () {
        tbody.innerHTML = '<tr><td colspan="4" class="ks-visits-error">Failed to load lifetime customers.</td></tr>';
      });
  }

  function populateLifetimeCustomers() {
    var el = document.getElementById('affiliate-area-lifetime-content');
    if (!el || !affiliateData) return;

    el.innerHTML =
      '<p class="ks-affiliate-area__visits-intro">Customers attributed to your referral links (first order date, order count, and revenue).</p>' +
      '<div class="ks-visits-table-wrap">' +
      '<table class="ks-referrals-table ks-visits-table" role="grid">' +
      '<thead><tr>' +
      '<th class="ks-referrals-th">Customer</th>' +
      '<th class="ks-referrals-th">First order</th>' +
      '<th class="ks-referrals-th">Orders</th>' +
      '<th class="ks-referrals-th">Total revenue</th>' +
      '</tr></thead>' +
      '<tbody id="affiliate-area-lifetime-tbody"></tbody>' +
      '</table></div>' +
      '<div class="ks-visits-footer">' +
      '<span id="affiliate-area-lifetime-count">0 customers</span>' +
      '<div id="affiliate-area-lifetime-pagination" class="ks-visits-pagination"></div>' +
      '</div>';

    loadLifetimeCustomersPage(1);
  }

  function formatReferralDate(d) {
    if (!d) return '—';
    var date = new Date(d);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function loadReferralsPage(page) {
    var aid = getAffiliateId();
    var tbody = document.getElementById('affiliate-area-referrals-tbody');
    var countEl = document.getElementById('affiliate-area-referrals-count');
    var paginationEl = document.getElementById('affiliate-area-referrals-pagination');
    var noReferralsEl = document.getElementById('affiliate-area-no-referrals');
    if (!tbody || !aid) return;

    var fromEl = document.getElementById('affiliate-area-referrals-from');
    var toEl = document.getElementById('affiliate-area-referrals-to');
    var from = fromEl && fromEl.value ? fromEl.value : '';
    var to = toEl && toEl.value ? toEl.value : '';

    tbody.innerHTML = '<tr><td colspan="5" class="ks-visits-loading"><span class="ks-loader" aria-hidden="true"></span> Loading referrals…</td></tr>';
    if (noReferralsEl) noReferralsEl.style.display = 'none';

    var url = API_BASE_URL + '/api/affiliates/' + encodeURIComponent(aid) + '/orders?page=' + page + '&limit=20';
    if (from) url += '&from=' + encodeURIComponent(from);
    if (to) url += '&to=' + encodeURIComponent(to);

    fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.success) {
          tbody.innerHTML = '<tr><td colspan="5" class="ks-visits-error">Unable to load referrals.</td></tr>';
          return;
        }
        var referrals = data.orders || [];
        var total = data.total || 0;
        var totalPages = data.totalPages || 0;

        if (countEl) countEl.textContent = total + ' item' + (total !== 1 ? 's' : '');
        if (paginationEl) {
          var prev = page > 1 ? page - 1 : 1;
          var next = page < totalPages ? page + 1 : totalPages;
          paginationEl.innerHTML =
            '<button type="button" class="ks-visits-pagination-btn" data-page="1" ' + (page <= 1 ? 'disabled' : '') + ' aria-label="First page">&laquo;</button>' +
            '<button type="button" class="ks-visits-pagination-btn" data-page="' + prev + '" ' + (page <= 1 ? 'disabled' : '') + ' aria-label="Previous">&lsaquo;</button>' +
            '<span class="ks-visits-pagination-info">' + page + ' of ' + (totalPages || 1) + '</span>' +
            '<button type="button" class="ks-visits-pagination-btn" data-page="' + next + '" ' + (page >= totalPages ? 'disabled' : '') + ' aria-label="Next">&rsaquo;</button>' +
            '<button type="button" class="ks-visits-pagination-btn" data-page="' + totalPages + '" ' + (page >= totalPages ? 'disabled' : '') + ' aria-label="Last page">&raquo;</button>';
          paginationEl.querySelectorAll('.ks-visits-pagination-btn').forEach(function (btn) {
            var p = parseInt(btn.getAttribute('data-page'), 10);
            if (btn.disabled) return;
            btn.addEventListener('click', function () { loadReferralsPage(p); });
          });
        }

        if (referrals.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" class="ks-referrals-empty">No referrals in this range.</td></tr>';
          if (noReferralsEl) noReferralsEl.style.display = 'block';
          return;
        }
        if (noReferralsEl) noReferralsEl.style.display = 'none';
        tbody.innerHTML = referrals.map(function (r) {
          var reference = escapeAttr(r.reference || r.orderId || r.id || '—');
          var amount = formatCurrency(r.commissionAmount != null ? r.commissionAmount : 0, r.currency);
          var description = Array.isArray(r.productNames) && r.productNames.length ? escapeAttr(r.productNames.join(', ')) : '—';
          var statusBadge = getStatusBadge(r.status || 'Unpaid');
          var dateStr = formatReferralDate(r.date || r.timestamp);
          return '<tr><td class="ks-referrals-td ks-referrals-td--ref">' + reference + '</td><td class="ks-referrals-td">' + amount + '</td><td class="ks-referrals-td ks-referrals-td--desc">' + description + '</td><td class="ks-referrals-td">' + statusBadge + '</td><td class="ks-referrals-td ks-referrals-td--date">' + dateStr + '</td></tr>';
        }).join('');
      })
      .catch(function () {
        tbody.innerHTML = '<tr><td colspan="5" class="ks-visits-error">Failed to load referrals.</td></tr>';
      });
  }

  function populateReferrals() {
    var el = document.getElementById('affiliate-area-referrals-content');
    if (!el) return;

    var aid = getAffiliateId();
    if (!aid || !affiliateData) {
      el.innerHTML = '<p class="ks-affiliate-area__placeholder">Load your affiliate data to see referrals.</p>';
      return;
    }

    el.innerHTML =
      '<p class="ks-affiliate-area__visits-intro">Each row is a referral (order) that came from your link. Commission status: Unpaid until we process payout; Paid when sent; Rejected if not eligible.</p>' +
      '<div class="ks-visits-filters">' +
      '<label class="ks-visits-filter-label">From <input type="date" id="affiliate-area-referrals-from" class="ks-visits-input"></label>' +
      '<label class="ks-visits-filter-label">To <input type="date" id="affiliate-area-referrals-to" class="ks-visits-input"></label>' +
      '<button type="button" id="affiliate-area-referrals-filter-btn" class="ks-btn">Filter</button>' +
      '</div>' +
      '<div class="ks-referrals-table-wrap">' +
      '<table class="ks-referrals-table" role="grid">' +
      '<thead><tr>' +
      '<th class="ks-referrals-th">Reference</th>' +
      '<th class="ks-referrals-th">Amount</th>' +
      '<th class="ks-referrals-th">Description</th>' +
      '<th class="ks-referrals-th">Status</th>' +
      '<th class="ks-referrals-th">Date</th>' +
      '</tr></thead>' +
      '<tbody id="affiliate-area-referrals-tbody"></tbody>' +
      '</table></div>' +
      '<div class="ks-visits-footer">' +
      '<span id="affiliate-area-referrals-count">0 items</span>' +
      '<div id="affiliate-area-referrals-pagination" class="ks-visits-pagination"></div>' +
      '</div>' +
      '<p id="affiliate-area-no-referrals" class="ks-affiliate-area__placeholder" style="display:none;">No referrals to display.</p>';

    var filterBtn = document.getElementById('affiliate-area-referrals-filter-btn');
    if (filterBtn) filterBtn.addEventListener('click', function () { loadReferralsPage(1); });

    loadReferralsPage(1);
  }

  function populateProfile() {
    var el = document.getElementById('affiliate-area-profile');
    if (!el || !affiliateData) return;
    var profile = affiliateData.profile || {};
    if (!profile.email && !profile.name) {
      el.innerHTML = '<p class="ks-affiliate-area__placeholder">Unable to load profile data.</p>';
      return;
    }
    var paymentEmailValue = (profile.paymentEmail && profile.paymentEmail.trim()) ? escapeAttr(profile.paymentEmail.trim()) : '';
    var notifyChecked = profile.enableNewReferralNotifications ? ' checked' : '';
    var shareDiscountChecked = profile.shareCartDiscountEnabled ? ' checked' : '';
    var shareDiscountPct = profile.shareCartDiscountPercent != null ? Number(profile.shareCartDiscountPercent) : 0;
    if (![0, 5, 10, 15, 20].includes(shareDiscountPct)) shareDiscountPct = 0;
    var pctOptions = [0, 5, 10, 15, 20].map(function (p) {
      return '<option value="' + p + '"' + (p === shareDiscountPct ? ' selected' : '') + '>' + p + '%</option>';
    }).join('');
    el.innerHTML =
      '<div class="ks-affiliate-profile-card">' +
      '<div class="ks-affiliate-profile-card__main">' +
      '<div class="ks-affiliate-profile-card__row">' +
      '<label class="ks-affiliate-profile-card__label" for="affiliate-area-payment-email">Your Payment Email</label>' +
      '<input type="email" id="affiliate-area-payment-email" class="ks-settings-input" value="' + paymentEmailValue + '" placeholder="PayPal or payment email" aria-label="Your Payment Email">' +
      '</div>' +
      '</div>' +
      '<div class="ks-settings-section">' +
      '<h4 class="ks-settings-section__title">Notification Settings</h4>' +
      '<label class="ks-settings-checkbox-label">' +
      '<input type="checkbox" id="affiliate-area-enable-notifications" class="ks-settings-checkbox"' + notifyChecked + ' aria-label="Enable new referral notifications">' +
      ' Enable New Referral Notifications' +
      '</label>' +
      '</div>' +
      '<div class="ks-settings-section">' +
      '<h4 class="ks-settings-section__title">Share Cart Discount</h4>' +
      '<p class="ks-settings-section__hint">Offer a discount to customers who use your share cart link. The discount is funded from your commission (affiliate-funded).</p>' +
      '<label class="ks-settings-checkbox-label">' +
      '<input type="checkbox" id="affiliate-area-share-discount-enabled" class="ks-settings-checkbox"' + shareDiscountChecked + ' aria-label="Enable share cart discount">' +
      ' Enable discount on shared cart products' +
      '</label>' +
      '<div class="ks-affiliate-profile-card__row" style="margin-top:10px">' +
      '<label class="ks-affiliate-profile-card__label" for="affiliate-area-share-discount-percent">Discount tier</label>' +
      '<select id="affiliate-area-share-discount-percent" class="ks-settings-input" aria-label="Discount percentage">' + pctOptions + '</select>' +
      '</div>' +
      '</div>' +
      '<div class="ks-settings-section">' +
      '<h4 class="ks-settings-section__title">Single-use discount codes</h4>' +
      '<p class="ks-settings-section__hint">Create a one-time code for a customer. Each code can be used only once. Add the code to your share URL as <code>?discount=CODE</code>.</p>' +
      '<button type="button" id="affiliate-area-create-single-use-code-btn" class="ks-btn" style="margin-bottom:12px">Create single-use code</button>' +
      '<div id="affiliate-area-created-discounts-list" class="ks-created-discounts-list"></div>' +
      '</div>' +
      '<div class="ks-settings-actions">' +
      '<button type="button" id="affiliate-area-save-settings-btn" class="ks-btn">Save Profile Settings</button>' +
      '</div></div>';
    var saveBtn = document.getElementById('affiliate-area-save-settings-btn');
    if (saveBtn) saveBtn.addEventListener('click', saveProfileSettings);
    var createCodeBtn = document.getElementById('affiliate-area-create-single-use-code-btn');
    if (createCodeBtn) createCodeBtn.addEventListener('click', createSingleUseCode);
    var shareDiscountEnabledEl = document.getElementById('affiliate-area-share-discount-enabled');
    var shareDiscountPercentEl = document.getElementById('affiliate-area-share-discount-percent');
    if (shareDiscountEnabledEl) shareDiscountEnabledEl.addEventListener('change', saveShareCartDiscountImmediate);
    if (shareDiscountPercentEl) shareDiscountPercentEl.addEventListener('change', saveShareCartDiscountImmediate);
    var notificationsEl = document.getElementById('affiliate-area-enable-notifications');
    if (notificationsEl) notificationsEl.addEventListener('change', saveNotificationsImmediate);
    populateCreatedDiscounts();
  }

  function saveNotificationsImmediate() {
    var aid = getAffiliateId();
    if (!aid) return;
    var notificationsEl = document.getElementById('affiliate-area-enable-notifications');
    var enableNewReferralNotifications = notificationsEl ? notificationsEl.checked : false;
    var shop = getShop();
    var updateUrl = '/api/affiliates/' + encodeURIComponent(aid) + '/update';
    if (shop) updateUrl += '?shop=' + encodeURIComponent(shop);
    apiCall(updateUrl, 'PUT', {
      enableNewReferralNotifications: enableNewReferralNotifications
    }).then(function (result) {
      if (result.success) {
        if (affiliateData && affiliateData.profile) {
          affiliateData.profile.enableNewReferralNotifications = enableNewReferralNotifications;
        }
        showToast('Notification setting saved.', 'success');
      } else {
        showToast(result.error || 'Failed to save', 'error');
      }
    }).catch(function () {
      showToast('Failed to save notification setting', 'error');
    });
  }

  function saveShareCartDiscountImmediate() {
    var aid = getAffiliateId();
    if (!aid) return;
    var shareDiscountEnabledEl = document.getElementById('affiliate-area-share-discount-enabled');
    var shareDiscountPercentEl = document.getElementById('affiliate-area-share-discount-percent');
    var shareCartDiscountEnabled = shareDiscountEnabledEl ? shareDiscountEnabledEl.checked : false;
    var shareCartDiscountPercent = shareDiscountPercentEl ? parseInt(shareDiscountPercentEl.value, 10) : 0;
    if (![0, 5, 10, 15, 20].includes(shareCartDiscountPercent)) shareCartDiscountPercent = 0;
    var shop = getShop();
    var updateUrl = '/api/affiliates/' + encodeURIComponent(aid) + '/update';
    if (shop) updateUrl += '?shop=' + encodeURIComponent(shop);
    apiCall(updateUrl, 'PUT', {
      shareCartDiscountEnabled: shareCartDiscountEnabled,
      shareCartDiscountPercent: shareCartDiscountPercent
    }).then(function (result) {
      if (result.success) {
        if (affiliateData && affiliateData.profile) {
          affiliateData.profile.shareCartDiscountEnabled = shareCartDiscountEnabled;
          affiliateData.profile.shareCartDiscountPercent = shareCartDiscountPercent;
        }
        showToast('Share cart discount saved.', 'success');
      } else {
        showToast(result.error || 'Failed to save', 'error');
      }
    }).catch(function () {
      showToast('Failed to save share cart discount', 'error');
    });
  }

  function saveProfileSettings() {
    var aid = getAffiliateId();
    if (!aid) {
      showToast('Please load affiliate profile first', 'error');
      return;
    }
    var paymentEmailEl = document.getElementById('affiliate-area-payment-email');
    var notificationsEl = document.getElementById('affiliate-area-enable-notifications');
    var shareDiscountEnabledEl = document.getElementById('affiliate-area-share-discount-enabled');
    var shareDiscountPercentEl = document.getElementById('affiliate-area-share-discount-percent');
    var saveBtn = document.getElementById('affiliate-area-save-settings-btn');
    var paymentEmail = paymentEmailEl ? (paymentEmailEl.value || '').trim() : '';
    var enableNewReferralNotifications = notificationsEl ? notificationsEl.checked : false;
    var shareCartDiscountEnabled = shareDiscountEnabledEl ? shareDiscountEnabledEl.checked : false;
    var shareCartDiscountPercent = shareDiscountPercentEl ? parseInt(shareDiscountPercentEl.value, 10) : 0;
    if (![0, 5, 10, 15, 20].includes(shareCartDiscountPercent)) shareCartDiscountPercent = 0;
    var shop = (window.Shopify && window.Shopify.shop) || window.location.hostname || '';
    var updateUrl = '/api/affiliates/' + encodeURIComponent(aid) + '/update';
    if (shop) updateUrl += '?shop=' + encodeURIComponent(shop);
    if (saveBtn) saveBtn.disabled = true;
    apiCall(updateUrl, 'PUT', {
      paymentEmail: paymentEmail || undefined,
      enableNewReferralNotifications: enableNewReferralNotifications,
      shareCartDiscountEnabled: shareCartDiscountEnabled,
      shareCartDiscountPercent: shareCartDiscountPercent
    }).then(function (result) {
      if (saveBtn) saveBtn.disabled = false;
      if (result.success) {
        showToast('Settings saved successfully.', 'success');
        if (affiliateData && affiliateData.profile) {
          affiliateData.profile.paymentEmail = paymentEmail || null;
          affiliateData.profile.enableNewReferralNotifications = enableNewReferralNotifications;
          affiliateData.profile.shareCartDiscountEnabled = shareCartDiscountEnabled;
          affiliateData.profile.shareCartDiscountPercent = shareCartDiscountPercent;
        }
      } else {
        showToast(result.error || 'Failed to save settings', 'error');
      }
    }).catch(function () {
      if (saveBtn) saveBtn.disabled = false;
      showToast('Failed to save settings', 'error');
    });
  }

  function getShop() {
    return (window.Shopify && window.Shopify.shop) || window.location.hostname || '';
  }

  function populateCreatedDiscounts() {
    var listEl = document.getElementById('affiliate-area-created-discounts-list');
    if (!listEl) return;
    var shop = getShop();
    var aid = getAffiliateId();
    if (!shop || !aid) {
      listEl.innerHTML = '<p class="ks-affiliate-area__placeholder">Shop or affiliate not available.</p>';
      return;
    }
    listEl.innerHTML = '<p class="ks-affiliate-area__placeholder">Loading…</p>';
    var url = '/api/affiliates/discounts/created?shop=' + encodeURIComponent(shop) + '&affiliateId=' + encodeURIComponent(aid) + '&limit=30';
    apiCall(url, 'GET').then(function (result) {
      if (!result.success || !Array.isArray(result.discounts)) {
        listEl.innerHTML = '<p class="ks-affiliate-area__placeholder">Unable to load created codes.</p>';
        return;
      }
      var discounts = result.discounts;
      if (discounts.length === 0) {
        listEl.innerHTML = '<p class="ks-affiliate-area__placeholder">No single-use codes created yet. Click "Create single-use code" above.</p>';
        return;
      }
      var rows = discounts.map(function (d) {
        var dateStr = d.createdAt ? new Date(d.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
        var s = (d.status || '').toLowerCase();
        var isDeactivated = s === 'deactivated';
        var isUsageLimitReached = s === 'usage_limit_reached';
        var statusLabel = isUsageLimitReached ? 'Usage limit reached' : (isDeactivated ? 'Deactivated' : 'Active');
        var statusClass = (isDeactivated || isUsageLimitReached) ? 'ks-status-inactive' : 'ks-status-active';
        var showDeactivateBtn = !isDeactivated && !isUsageLimitReached;
        var actionCell = showDeactivateBtn
          ? '<button type="button" class="ks-btn ks-btn-small ks-btn-delete" data-deactivate-id="' + escapeAttr(d.id) + '" aria-label="Deactivate ' + escapeAttr(d.code) + '">Deactivate</button>'
          : '<span class="ks-status ' + statusClass + '">' + escapeAttr(statusLabel) + '</span>';
        return '<tr><td class="ks-referrals-td">' + escapeAttr(d.code) + '</td><td class="ks-referrals-td">' + (d.percentage != null ? d.percentage + '%' : '—') + '</td><td class="ks-referrals-td ks-referrals-td--date">' + escapeAttr(dateStr) + '</td><td class="ks-referrals-td"><span class="ks-status ' + statusClass + '">' + escapeAttr(statusLabel) + '</span></td><td class="ks-referrals-td">' + actionCell + '</td></tr>';
      }).join('');
      listEl.innerHTML = '<table class="ks-referrals-table ks-payouts-table" role="grid"><thead><tr><th class="ks-referrals-th">Code</th><th class="ks-referrals-th">Discount</th><th class="ks-referrals-th">Created</th><th class="ks-referrals-th">Status</th><th class="ks-referrals-th">Actions</th></tr></thead><tbody>' + rows + '</tbody></table>';
      listEl.querySelectorAll('[data-deactivate-id]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var recordId = this.getAttribute('data-deactivate-id');
          if (!recordId) return;
          deactivateCreatedDiscount(recordId, btn);
        });
      });
    }).catch(function () {
      listEl.innerHTML = '<p class="ks-affiliate-area__placeholder">Failed to load created codes.</p>';
    });
  }

  function deactivateCreatedDiscount(recordId, buttonEl) {
    if (!recordId) return;
    var shop = getShop();
    var aid = getAffiliateId();
    var customerId = getCustomerId();
    var email = getCustomerEmail();
    if (!shop) {
      showToast('Shop is required.', 'error');
      return;
    }
    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.textContent = 'Deactivating…';
    }
    var query = 'shop=' + encodeURIComponent(shop);
    if (aid) query += '&affiliateId=' + encodeURIComponent(aid);
    else if (customerId && email) {
      query += '&customerId=' + encodeURIComponent(customerId) + '&email=' + encodeURIComponent(email);
    }
    apiCall('/api/affiliates/discounts/created/' + encodeURIComponent(recordId) + '?' + query, 'DELETE')
      .then(function (result) {
        if (result.success) {
          showToast('Discount deactivated on store. It remains in the list.', 'success');
          populateCreatedDiscounts();
        } else {
          showToast(result.error || 'Failed to deactivate discount', 'error');
          if (buttonEl) { buttonEl.disabled = false; buttonEl.textContent = 'Deactivate'; }
        }
      })
      .catch(function () {
        showToast('Failed to deactivate discount', 'error');
        if (buttonEl) { buttonEl.disabled = false; buttonEl.textContent = 'Deactivate'; }
      });
  }

  function createSingleUseCode() {
    var shop = getShop();
    var customerId = getCustomerId();
    var email = getCustomerEmail();
    if (!shop || !customerId || !email) {
      showToast('Shop, customer ID and email are required.', 'error');
      return;
    }
    var btn = document.getElementById('affiliate-area-create-single-use-code-btn');
    if (btn) btn.disabled = true;
    apiCall('/api/affiliates/discounts/create-single-use', 'POST', { shop: shop, customerId: customerId, email: email }).then(function (result) {
      if (btn) btn.disabled = false;
      if (result.success && result.code) {
        showToast('Code created: ' + result.code + ' — Add to share URL as ?discount=' + result.code, 'success');
        populateCreatedDiscounts();
      } else {
        showToast(result.error || 'Failed to create code', 'error');
      }
    }).catch(function () {
      if (btn) btn.disabled = false;
      showToast('Failed to create single-use code', 'error');
    });
  }

  function openCreateLinkModal() {
    console.log('[CreateLink] openCreateLinkModal called');
    var modal = document.getElementById('ks-create-link-modal');
    if (!modal) {
      console.warn('[CreateLink] Modal #ks-create-link-modal not found in DOM');
      return;
    }
    console.log('[CreateLink] Modal found, hidden before:', modal.hasAttribute('hidden'));
    var input = document.getElementById('ks-create-link-description');
    if (input) {
      input.value = '';
      input.placeholder = 'e.g. Main Referral Link';
    }
    modal.removeAttribute('hidden');
    console.log('[CreateLink] Modal hidden after removeAttribute:', modal.hasAttribute('hidden'), 'display:', window.getComputedStyle(modal).display);
  }

  function closeCreateLinkModal() {
    var modal = document.getElementById('ks-create-link-modal');
    if (modal) modal.setAttribute('hidden', 'hidden');
  }

  function createNewReferralLink() {
    var aid = getAffiliateId();
    if (!aid) {
      console.warn('[CreateLink] No affiliate ID, showing toast');
      showToast('Please load affiliate profile first', 'error');
      return;
    }
    console.log('[CreateLink] Affiliate ID:', aid, '- opening modal');
    openCreateLinkModal();
  }

  function submitCreateLinkModal() {
    var aid = getAffiliateId();
    if (!aid) return;
    var input = document.getElementById('ks-create-link-description');
    var description = (input && input.value && input.value.trim()) ? input.value.trim() : 'Main Referral Link';
    var submitBtn = document.getElementById('ks-create-link-modal-submit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating…';
    }
    apiCall('/api/affiliates/' + encodeURIComponent(aid) + '/referral-links', 'POST', {
      description: description,
      productIds: [],
      productVariantIds: [],
      replacePrimary: true
    }).then(function (result) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Link';
      }
      closeCreateLinkModal();
      if (result.success) {
        showToast('New referral link created. Your previous link has been replaced.', 'success');
        loadAffiliateData();
      } else {
        showToast('Error: ' + (result.error || 'Failed'), 'error');
      }
    }).catch(function () {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Link';
      }
      showToast('Failed to create link. Please try again.', 'error');
    });
  }

  function loadAffiliateData() {
    var customerId = getCustomerId();
    var shop = (window.Shopify && window.Shopify.shop) || window.location.hostname;
    var email = getCustomerEmail();
    if (!customerId || !shop) {
      showAccessDenied('You don\'t have access to this area. Please log in to your account.');
      hideLoadersShowPlaceholders();
      return;
    }
    var primaryEl = document.getElementById('affiliate-area-primary-referral-link');
    if (primaryEl) primaryEl.innerHTML = '<div class="ks-loader" aria-hidden="true"></div>';
    showLoaders();
    hideAccessDenied();
    var url = API_BASE_URL + '/api/affiliates/customer/' + encodeURIComponent(customerId) + '/dashboard?shop=' + encodeURIComponent(shop) + '&email=' + encodeURIComponent(email);
    fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.success) {
          showAccessDenied(data.error || 'You don\'t have access to this area. Please ensure you\'re logged in as an approved affiliate.');
          hideLoadersShowPlaceholders();
          return;
        }
        hideAccessDenied();
        affiliateData = data.dashboard || data;
        currentAffiliateId = data.affiliateId || currentAffiliateId;
        var links = (affiliateData && (affiliateData.referralLinks || [])) || [];
        if (links.length > 0) {
          var primary = links[0];
          var linkUrl = primary.url || (API_BASE_URL + '/ref=' + (primary.shortCode || ''));
          renderPrimaryReferralLink(linkUrl);
        } else {
          showNoReferralLink();
        }
        populateReferralLinksList();
        populateStatistics();
        populatePayouts();
        populateProfile();
        populateVisits();
        populateReferrals();
        populateLifetimeCustomers();
        populateGraphs();
        populateAffiliateSidebar();
        hideLoadersShowPlaceholders();
      })
      .catch(function () {
        showAccessDenied('Unable to load affiliate area. Please try again or log in to your account.');
        hideLoadersShowPlaceholders();
      });
  }

  function showLoaders() {
    [ 'affiliate-area-statistics-content', 'affiliate-area-payouts-content', 'affiliate-area-profile', 'affiliate-area-visits-content', 'affiliate-area-referrals-content', 'affiliate-area-lifetime-content', 'affiliate-area-graphs-content' ].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.querySelector && !el.querySelector('.ks-loader')) el.innerHTML = '<div class="ks-loader" aria-hidden="true"></div>';
    });
  }

  function hideLoadersShowPlaceholders() {
    [ 'affiliate-area-statistics-content', 'affiliate-area-payouts-content', 'affiliate-area-profile', 'affiliate-area-visits-content', 'affiliate-area-referrals-content', 'affiliate-area-lifetime-content', 'affiliate-area-graphs-content' ].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (el.id === 'affiliate-area-profile' && affiliateData && affiliateData.profile) return;
      if (el.id === 'affiliate-area-statistics-content' && affiliateData && affiliateData.stats) return;
      if (el.id === 'affiliate-area-payouts-content' && affiliateData && affiliateData.earnings) return;
      if (el.id === 'affiliate-area-visits-content' && affiliateData && affiliateData.stats) return;
      if (el.id === 'affiliate-area-referrals-content' && affiliateData) return;
      if (el.id === 'affiliate-area-lifetime-content' && affiliateData) return;
      if (el.id === 'affiliate-area-graphs-content' && affiliateData) return;
      if (el.innerHTML.indexOf('ks-loader') !== -1) {
        el.innerHTML = '<p class="ks-affiliate-area__placeholder">Unable to load data.</p>';
      }
    });
  }

  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function renderGreetingMessage(text) {
    if (!text || !text.trim()) return '';
    var escaped = escapeHtml(text.trim());
    var paragraphs = escaped.split(/\n\n+/);
    return paragraphs.map(function (p) {
      var line = p.replace(/\n/g, '<br>\n');
      return '<p>' + line + '</p>';
    }).join('\n');
  }

  function loadAffiliateAreaGreeting() {
    var shop = (window.Shopify && window.Shopify.shop) || window.location.hostname;
    if (!shop) return;
    var el = document.getElementById('affiliate-area-greeting-message');
    if (!el) return;
    var url = API_BASE_URL + '/api/affiliates/area-config?shop=' + encodeURIComponent(shop);
    fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.success && data.greetingMessage && data.greetingMessage.trim()) {
          el.innerHTML = renderGreetingMessage(data.greetingMessage);
        }
      })
      .catch(function () {});
  }

  function init() {
    // console.log('[CreateLink] affiliate-area.js init() running');
    var container = document.getElementById(CONTAINER_ID);
    if (!container) {
      // console.warn('[CreateLink] Container #affiliate-area-container not found');
      return;
    }

    var tabs = container.querySelectorAll(TAB_SELECTOR);
    var panels = container.querySelectorAll(PANEL_SELECTOR);

    // Mobile hamburger: toggle sidebar, close on backdrop or tab select
    var hamburger = document.getElementById('affiliate-area-hamburger');
    var backdrop = document.getElementById('affiliate-area-nav-backdrop');
    function setNavOpen(open) {
      container.classList.toggle('ks-affiliate-area--nav-open', open);
      if (hamburger) {
        hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
        hamburger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      }
    }
    function closeNav() {
      setNavOpen(false);
    }
    if (hamburger) {
      hamburger.addEventListener('click', function () {
        setNavOpen(!container.classList.contains('ks-affiliate-area--nav-open'));
      });
    }
    if (backdrop) {
      backdrop.addEventListener('click', closeNav);
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var tabId = this.getAttribute('data-tab');
        switchTab(tabId, tabs, panels);
        updateUrlHash(tabId);
        closeNav();
      });
    });

    var hash = (window.location.hash || '').replace(/^#/, '');
    if (hash) {
      var panel = container.querySelector('#' + hash);
      if (panel && panel.classList.contains('ks-tab-content')) {
        switchTab(hash, tabs, panels);
      }
    }

    loadAffiliateAreaGreeting();
    populateAffiliateSidebar();
    populateAffiliateSidebarIcons();
    loadAffiliateData();

    // Create New Link modal: close and submit
    var createLinkModal = document.getElementById('ks-create-link-modal');
    if (createLinkModal) {
      var closeEls = createLinkModal.querySelectorAll('[data-close]');
      closeEls.forEach(function (el) {
        el.addEventListener('click', closeCreateLinkModal);
      });
      var submitBtn = document.getElementById('ks-create-link-modal-submit');
      if (submitBtn) submitBtn.addEventListener('click', submitCreateLinkModal);
    } else {
      console.warn('[CreateLink] init: Cannot wire modal - #ks-create-link-modal missing. Check that affiliate-area.liquid includes the modal markup.');
    }
  }

  function switchTab(tabId, tabs, panels) {
    tabs.forEach(function (t) {
      var isActive = t.getAttribute('data-tab') === tabId;
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    panels.forEach(function (panel) {
      var isActive = panel.id === tabId;
      panel.classList.toggle('active', isActive);
    });
  }

  function updateUrlHash(tabId) {
    if (typeof window.history !== 'undefined' && window.history.replaceState) {
      window.history.replaceState(null, '', '#' + tabId);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
