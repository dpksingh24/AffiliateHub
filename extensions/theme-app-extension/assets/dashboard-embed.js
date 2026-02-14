/**
 * Practitioner Dashboard – single-script bootstrap
 * Looks for #ks-dashboard-root and injects the full dashboard there, then loads CSS + main JS.
 * Add to any Liquid file: <div id="ks-dashboard-root"></div>
 * Enable the Dashboard app embed: Theme → Customize → App embeds → Dashboard (kiscience) ON.
 *
 * When to update this file: Only when the dashboard DOM structure changes (e.g. new tab,
 * new section ID, or structure change in affiliate-dashboard.liquid). Logic-only changes
 * in affiliate-dashboard.js do NOT require changes here.
 *
 * Affiliate: The Affiliate tab and quick link open /pages/affiliate-area (new page)
 * instead of an in-dashboard tab. The affiliate-area page handles its own access control.
 */
(function () {
  function run() {
    var root = document.getElementById('ks-dashboard-root');
    if (!root) return;
    if (root.innerHTML.trim() !== '') return;

    var configEl = document.getElementById('ks-dashboard-embed-config');
    var config = {};
    try {
      config = configEl && configEl.textContent ? JSON.parse(configEl.textContent) : {};
    } catch (e) {}
    var cssUrl = (config && config.cssUrl) ? config.cssUrl : '';
    var jsUrl = (config && config.jsUrl) ? config.jsUrl : '';

    if (!cssUrl || !jsUrl) {
      root.innerHTML = '<div class="ks-dashboard-embed-message" style="padding:20px;background:#f5f5f5;border:1px solid #ddd;border-radius:8px;text-align:center;max-width:480px;margin:0 auto;"><p style="margin:0 0 12px;font-weight:600;">Practitioner Dashboard</p><p style="margin:0;color:#666;font-size:14px;">Enable the <strong>Dashboard</strong> app embed: go to <strong>Theme → Customize → App embeds</strong> and turn <strong>Dashboard (kiscience)</strong> ON. Use only one <code style="background:#eee;padding:2px 6px;">&lt;div id="ks-dashboard-root"&gt;&lt;/div&gt;</code> on the page.</p></div>';
      return;
    }

  var html = [
    '<div id="dashboard-error" class="ks-error-state" style="display:none;"><div class="ks-error-state__card"><div class="ks-error-state__icon" aria-hidden="true"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div><h2 class="ks-error-state__title">Access Denied</h2><p id="error-message" class="ks-error-state__message">You don\'t have access to this dashboard. Please ensure you\'re logged in.</p><a href="/account" class="ks-error-state__btn ks-btn">Back to Login Page</a></div></div>',
    '<div id="dashboard-skeleton"><div class="ks-skeleton-row"><div class="ks-skeleton-block ks-skeleton-title"></div><div class="ks-skeleton-block ks-skeleton-subtitle"></div></div><div class="ks-skeleton-row"><div class="ks-skeleton-block ks-skeleton-card"></div><div style="flex:1"><div class="ks-skeleton-row"><div class="ks-skeleton-block ks-skeleton-col-3"></div><div class="ks-skeleton-block ks-skeleton-col-3"></div><div class="ks-skeleton-block ks-skeleton-col-3"></div></div><div class="ks-skeleton-row" style="margin-top:12px"><div class="ks-skeleton-block ks-skeleton-col-2"></div><div class="ks-skeleton-block ks-skeleton-col-2"></div></div></div></div></div>',
    '<div class="ks-dashboard" id="dashboard-container" style="display:none"' +
      (config.invoiceLogoUrl ? ' data-invoice-logo-url="' + String(config.invoiceLogoUrl).replace(/"/g, '&quot;') + '"' : '') +
      (config.invoiceCompanyName ? ' data-invoice-company-name="' + String(config.invoiceCompanyName).replace(/"/g, '&quot;') + '"' : '') +
      (config.invoiceCompanyAddress ? ' data-invoice-company-address="' + String(config.invoiceCompanyAddress).replace(/"/g, '&quot;') + '"' : '') +
      (config.invoiceVat ? ' data-invoice-vat="' + String(config.invoiceVat).replace(/"/g, '&quot;') + '"' : '') +
      (config.invoiceTermsUrl ? ' data-invoice-terms-url="' + String(config.invoiceTermsUrl).replace(/"/g, '&quot;') + '"' : '') +
      '>',
    '<aside class="ks-sidebar"><div class="ks-sidebar__profile"><h3 class="ks-sidebar__name" id="ks-sidebar-name"></h3><p class="ks-sidebar__email" id="ks-sidebar-email"></p></div><nav class="ks-tabs" role="tablist" aria-label="Dashboard sections"><button type="button" class="ks-tab active" data-tab="dashboard"><span class="ks-tab__icon"></span><span class="ks-tab__label">Dashboard</span></button><button type="button" class="ks-tab" data-tab="orders"><span class="ks-tab__icon"></span><span class="ks-tab__label">Orders</span></button><button type="button" class="ks-tab" data-tab="addresses"><span class="ks-tab__icon"></span><span class="ks-tab__label">Addresses</span></button><button type="button" class="ks-tab" data-tab="account"><span class="ks-tab__icon"></span><span class="ks-tab__label">Account details</span></button><button type="button" class="ks-tab" data-tab="wishlist"><span class="ks-tab__icon"></span><span class="ks-tab__label">Wish list</span></button><a href="/pages/affiliate-area" class="ks-tab"><span class="ks-tab__icon"></span><span class="ks-tab__label">Affiliate Area</span></a></nav><div class="ks-sidebar__footer"><p class="ks-sidebar__brand">Ki Science</p><p class="ks-sidebar__contact">Phone: <strong>+44 (0) 1273 911789</strong></p><p class="ks-sidebar__contact">Email: info@kiscience.com</p><a href="/account/logout" class="ks-sidebar__logout">Log out</a></div></aside>',
    '<div class="ks-dashboard-main">',
    '<section class="ks-tab-content active" id="dashboard"><div class="ks-dashboard-tab"><div class="ks-dashboard-welcome"><h3 class="ks-dashboard-welcome__title" style="color:#fff">Dashboard</h3><p class="ks-dashboard-welcome__text" style="color:#fff">From your account dashboard you can view your recent orders, manage your shipping and billing addresses, and edit your password and account details.</p></div><div class="ks-stats" id="ks-stats" aria-label="Account statistics"></div></div>',
    '<div class="ks-dashboard-section ks-dashboard-section--orders"><h4 class="ks-dashboard-subtitle"><span class="ks-dashboard-subtitle__icon">📦</span>Recent orders</h4><div class="ks-orders-list ks-orders-list--recent" id="recent-orders"><div class="ks-loader" aria-hidden="true"></div></div><a href="#" class="ks-dashboard-cta" data-ks-goto="orders">See all orders <span class="ks-dashboard-cta__arrow">→</span></a></div>',
    '<div class="ks-dashboard-section ks-dashboard-section--shortcuts"><h4 class="ks-dashboard-subtitle"><span class="ks-dashboard-subtitle__icon">⚡</span>Quick links</h4><div class="ks-shortcuts ks-shortcuts--colorful"><a href="https://kiscience.myshopify.com/blogs/information-and-news" class="ks-shortcut"><span class="ks-shortcut__icon">📰</span><span class="ks-shortcut__label">News</span></a><a href="/pages/contact" class="ks-shortcut"><span class="ks-shortcut__icon">💬</span><span class="ks-shortcut__label">Customer support</span></a><a href="#" class="ks-shortcut" data-ks-goto="account"><span class="ks-shortcut__icon">👤</span><span class="ks-shortcut__label">Update your details</span></a><a href="/blogs/practitioner-information" class="ks-shortcut"><span class="ks-shortcut__icon">📋</span><span class="ks-shortcut__label">Products Information</span></a></div></div></div></section>',
    '<section class="ks-tab-content" id="orders"><div class="ks-orders-header"><h3 class="ks-section-title">Orders</h3><p class="ks-orders-desc">View all your order history and track current orders.</p></div><div class="ks-orders-list" id="all-orders"><div class="ks-orders-loading" aria-label="Loading orders"><div class="ks-loader" aria-hidden="true"></div></div></div><div class="ks-orders-pagination" id="orders-pagination" aria-label="Orders pagination"></div></section>',
    '<section class="ks-tab-content" id="addresses"><h3 class="ks-section-title">Addresses</h3><p class="ks-addresses-intro">You can add and save multiple addresses here. At checkout, <strong>up to 5</strong> of your saved addresses are shown. Use <strong>Set as default</strong> to choose which address is used.</p><div id="addresses-list"><div class="ks-loader" aria-hidden="true"></div></div></section>',
    '<section class="ks-tab-content" id="account"><div class="ks-account-header"><h3 class="ks-account-title">Account Details</h3><p class="ks-account-desc">Manage your account details and preferences.</p></div><div id="account-details"><div class="ks-loader" aria-hidden="true"></div></div></section>',
    '<section class="ks-tab-content" id="wishlist"><h3 class="ks-section-title">Wish list</h3><p>Items you\'ve saved for later.</p><div id="wishlist-grid"><div class="ks-loader" aria-hidden="true"></div></div></section>',
    '</div></div>'
  ].join('');

  root.innerHTML = html;

  root.querySelectorAll('[data-ks-goto]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      var tab = this.getAttribute('data-ks-goto');
      var btn = document.querySelector('.ks-tab[data-tab="' + tab + '"]');
      if (btn) btn.click();
    });
  });

  if (cssUrl) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssUrl;
    document.head.appendChild(link);
  }

  if (jsUrl) {
    var script = document.createElement('script');
    script.src = jsUrl;
    script.defer = true;
    document.body.appendChild(script);
  }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
  setTimeout(run, 800);
})();
