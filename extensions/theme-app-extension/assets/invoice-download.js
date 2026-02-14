/**
 * Kiscience Invoice Download – standalone script for theme Liquid
 *
 * To fix 404: In Shopify Admin → Themes → Edit code → Assets → Add a new asset.
 * Name it "invoice-download.js" and paste this entire file. Then theme.liquid's
 * {{ 'invoice-download.js' | asset_url }} will work.
 *
 * Usage: Use data-invoice-order-id="ORDER_ID" on a link/button, or call
 * window.downloadKiscienceInvoice(orderId). Order ID = Shopify order.id (numeric).
 */
(function () {
  'use strict';

  function getConfig() {
    return window.KISCENCE_INVOICE_CONFIG || {};
  }

  function escapeHtml(text) {
    if (text == null) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function escapeAttr(text) {
    if (text == null) return '';
    return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function apiFetch(url) {
    return fetch(url, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    }).then(function (r) {
      return r.text().then(function (text) {
        var data = null;
        if (text && text.trim()) {
          try {
            data = JSON.parse(text);
          } catch (e) {}
        }
        if (!r.ok) {
          var msg = (data && (data.error || data.message)) || r.statusText || 'Request failed';
          var err = new Error(msg);
          err.responseData = data;
          throw err;
        }
        if (!data) throw new Error('Empty response');
        return data;
      });
    });
  }

  function showToast(message, type) {
    if (window.showToast && typeof window.showToast === 'function') {
      window.showToast(message, type);
      return;
    }
    if (typeof window.alert === 'function') window.alert(message);
  }

  function openInvoiceModal(orderId) {
    var config = getConfig();
    var apiBase = (config.apiBase || '/apps/kiscience').replace(/\/$/, '');
    var shop = config.shop || (window.Shopify && window.Shopify.shop) || window.location.hostname;
    var customerId = config.customerId || (window.Shopify && window.Shopify.checkout && window.Shopify.checkout.customer_id) || '';

    if (!customerId) {
      showToast('Please log in to view your invoice.', 'error');
      return;
    }

    var url = apiBase + '/api/customers/orders/' + encodeURIComponent(orderId) + '?shop=' + encodeURIComponent(shop) + '&customerId=' + encodeURIComponent(customerId);

    apiFetch(url)
      .then(function (result) {
        if (!result.success || !result.order) {
          showToast(result.error || 'Order not found', 'error');
          return;
        }
        try {
          renderInvoiceModal(result.order, orderId);
        } catch (err) {
          console.error('Kiscience invoice render error:', err);
          showToast('Could not show invoice. Please try again.', 'error');
        }
      })
      .catch(function (err) {
        var message = (err && err.message) || 'Could not load invoice. Please try again.';
        showToast(message, 'error');
        console.warn('Kiscience invoice fetch error:', err);
      });
  }

  function renderInvoiceModal(o, orderId) {
    var orderNum = o.order_number || o.id || orderId;
    var currency = o.currency || 'USD';
    var currPrefix = currency === 'GBP' ? '£' : currency + ' ';
    function fmt(val) {
      if (val == null || val === '') return currPrefix + '0.00';
      var n = parseFloat(val);
      return isNaN(n) ? currPrefix + '0.00' : currPrefix + n.toFixed(2);
    }
    var subtotal = fmt(o.subtotal_price);
    var shipping = fmt(o.total_shipping_price);
    var tax = fmt(o.total_tax);
    var total = fmt(o.total_price);

    var lineItemsHtml = (o.line_items || []).map(function (item) {
      var title = escapeHtml(item.title || 'Product');
      var sku = item.sku ? '<div class="ks-invoice-item__sku">SKU: ' + escapeHtml(item.sku) + '</div>' : '';
      var weight = item.weight ? '<div class="ks-invoice-item__weight">Weight: ' + escapeHtml(item.weight) + '</div>' : '';
      var qty = item.quantity || 1;
      var price = fmt(item.price);
      return '<tr class="ks-invoice-row"><td class="ks-invoice-cell ks-invoice-cell--product"><div class="ks-invoice-item__name">' + title + '</div>' + sku + weight + '</td><td class="ks-invoice-cell ks-invoice-cell--qty">' + qty + '</td><td class="ks-invoice-cell ks-invoice-cell--price">' + escapeHtml(price) + '</td></tr>';
    }).join('');

    var shippingAddr = (o.shipping_address || '').toString().trim() || '—';
    var billingAddr = (o.billing_address || '').toString().trim() || shippingAddr;
    var paymentMethod = (o.gateway || '').toString().trim() || '—';
    var shippingMethod = (o.shipping_lines && o.shipping_lines[0]) ? (o.shipping_lines[0].title + ' – ' + fmt(o.shipping_lines[0].price)) : (shipping !== currPrefix + '0.00' ? shipping : '—');
    var createdDate = o.created_at ? new Date(o.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '';

    var modalId = 'ks-invoice-modal';
    var existing = document.getElementById(modalId);
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'ks-invoice-modal';
    modal.setAttribute('style', 'position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;');
    var baseCss = '.ks-invoice-modal__backdrop{position:absolute;inset:0;background:rgba(0,0,0,0.5);cursor:pointer}.ks-invoice-modal__box{position:relative;background:#fff;border-radius:8px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);max-width:700px;width:100%;max-height:90vh;overflow-y:auto;padding:0;border:1px solid #e5e7eb}.ks-invoice-modal__header{display:flex;justify-content:space-between;align-items:flex-start;padding:20px 24px;border-bottom:1px solid #e5e7eb}.ks-invoice-modal__close{background:none;border:none;font-size:24px;cursor:pointer;color:#6b7280}.ks-invoice-print{padding:24px;font-size:14px;color:#000}.ks-invoice-table{width:100%;border-collapse:collapse;margin:20px 0}.ks-invoice-table th,.ks-invoice-table td{border:1px solid #e5e7eb;padding:10px 12px;text-align:left}.ks-invoice-table thead tr{background:#000;color:#fff}.ks-invoice-table thead th{font-weight:700;font-size:12px}.ks-invoice-table th.ks-invoice-cell--qty,.ks-invoice-table th.ks-invoice-cell--price,.ks-invoice-table td.ks-invoice-cell--qty,.ks-invoice-table td.ks-invoice-cell--price{text-align:right}.ks-invoice-item__name{font-weight:500}.ks-invoice-item__sku,.ks-invoice-item__weight{font-size:12px;color:#6b7280;margin-top:2px}.ks-invoice-totals-box{margin:20px 0;margin-left:auto;max-width:320px;text-align:right}.ks-invoice-totals__row{display:flex;justify-content:space-between;align-items:baseline;gap:16px;margin:8px 0}.ks-invoice-totals__row>span:first-child{font-weight:700}.ks-invoice-totals__row>span:last-child{font-weight:400}.ks-invoice-totals__row--total span{font-weight:700}.ks-invoice-totals__row--total{font-weight:700;font-size:16px;margin-top:12px;padding-top:12px;border-top:1px solid #000}.ks-invoice-modal__actions{display:flex;gap:12px;justify-content:flex-end;padding:16px 24px;border-top:1px solid #e5e7eb;background:#fafafa}.ks-btn{padding:8px 16px;border-radius:6px;cursor:pointer;border:1px solid #d1d5db;background:#fff}.ks-btn-primary{background:#111;color:#fff;border-color:#111}';
    modal.innerHTML =
      '<style id="ks-invoice-modal-styles">' + baseCss + '</style>' +
      '<div class="ks-invoice-modal__backdrop" data-close></div>' +
      '<div class="ks-invoice-modal__box">' +
        '<div class="ks-invoice-modal__header">' +
          '<div class="ks-invoice-modal__header-left">' +
            '<h1 class="ks-invoice-doc-title">INVOICE</h1>' +
            '<p class="ks-invoice-doc-meta">Order #' + escapeHtml(String(orderNum)) + '</p>' +
            (createdDate ? '<p class="ks-invoice-doc-date">' + escapeHtml(createdDate) + '</p>' : '') +
          '</div>' +
          '<button type="button" class="ks-invoice-modal__close" data-close aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="ks-invoice-print" id="ks-invoice-print">' +
          '<div class="ks-invoice-print-header">' +
            '<h1 class="ks-invoice-doc-title">INVOICE</h1>' +
            '<p class="ks-invoice-doc-meta">Order #' + escapeHtml(String(orderNum)) + '</p>' +
            (createdDate ? '<p class="ks-invoice-doc-date">' + escapeHtml(createdDate) + '</p>' : '') +
          '</div>' +
          '<table class="ks-invoice-table">' +
            '<thead><tr class="ks-invoice-row ks-invoice-row--head">' +
              '<th class="ks-invoice-cell ks-invoice-cell--product">Product</th>' +
              '<th class="ks-invoice-cell ks-invoice-cell--qty">Quantity</th>' +
              '<th class="ks-invoice-cell ks-invoice-cell--price">Price</th>' +
            '</tr></thead><tbody>' +
            (lineItemsHtml || '<tr><td colspan="3" class="ks-invoice-cell ks-invoice-cell--empty">No items</td></tr>') +
            '</tbody></table>' +
          '<div class="ks-invoice-totals-box">' +
            '<div class="ks-invoice-totals__row"><span>Subtotal</span><span>' + escapeHtml(subtotal) + '</span></div>' +
            '<div class="ks-invoice-totals__row"><span>Shipping</span><span>' + escapeHtml(shipping) + '</span></div>' +
            '<div class="ks-invoice-totals__row"><span>Taxes</span><span>' + escapeHtml(tax) + '</span></div>' +
            '<div class="ks-invoice-totals__row ks-invoice-totals__row--total"><span>Total</span><span>' + escapeHtml(total) + '</span></div>' +
          '</div>' +
          '<div class="ks-invoice-addresses">' +
            '<div class="ks-invoice-address-block"><h4 class="ks-invoice-address-title">Shipping address</h4><pre class="ks-invoice-address-text">' + escapeHtml(shippingAddr) + '</pre></div>' +
            '<div class="ks-invoice-address-block"><h4 class="ks-invoice-address-title">Billing address</h4><pre class="ks-invoice-address-text">' + escapeHtml(billingAddr) + '</pre></div>' +
          '</div>' +
          '<div class="ks-invoice-methods">' +
            '<p class="ks-invoice-method-row"><strong>Payment:</strong> ' + escapeHtml(paymentMethod) + '</p>' +
            '<p class="ks-invoice-method-row"><strong>Shipping method:</strong> ' + escapeHtml(shippingMethod) + '</p>' +
          '</div>' +
          '<p class="ks-invoice-thanks">Thank you for your order.</p>' +
        '</div>' +
        '<div class="ks-invoice-modal__actions">' +
          '<button type="button" class="ks-btn" data-close>Close</button>' +
          '<button type="button" class="ks-btn ks-btn-primary" id="ks-invoice-print-btn">Print / Save as PDF</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    function closeModal() {
      modal.remove();
    }

    modal.querySelectorAll('[data-close]').forEach(function (el) {
      el.addEventListener('click', closeModal);
    });

    var printBtn = modal.querySelector('#ks-invoice-print-btn');
    if (printBtn) {
      printBtn.addEventListener('click', function () {
        var printArea = modal.querySelector('#ks-invoice-print');
        if (!printArea) return;
        // Keep as ONE string (avoid accidental truncation from missed '+' concatenations).
        var printStyles = `
          html, body {
            font-family: Arial, Helvetica, sans-serif;
            padding: 32px;
            max-width: 700px;
            margin: 0 auto;
            font-size: 14px;
            color: #000;
            background: #fff;
          }
          *, *::before, *::after { box-sizing: border-box; }

          .ks-invoice-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .ks-invoice-table thead tr { background: #000; color: #fff; }
          .ks-invoice-table th, .ks-invoice-table td { border: 1px solid #e5e7eb; padding: 10px 12px; text-align: left; }
          .ks-invoice-table th:nth-child(2), .ks-invoice-table th:nth-child(3),
          .ks-invoice-table td:nth-child(2), .ks-invoice-table td:nth-child(3) { text-align: right; }

          .ks-invoice-item__name { font-weight: 500; }
          .ks-invoice-item__sku, .ks-invoice-item__weight { font-size: 12px; color: #6b7280; margin-top: 2px; }

          .ks-invoice-totals-box { margin: 20px 0; text-align: right; max-width: 320px; margin-left: auto; }
          .ks-invoice-totals__row { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; margin: 8px 0; }
          .ks-invoice-totals__row > span:first-child { font-weight: 700; }
          .ks-invoice-totals__row > span:last-child { font-weight: 400; }
          .ks-invoice-totals__row--total span { font-weight: 700; }
          .ks-invoice-totals__row--total { font-weight: 700; font-size: 16px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #000; }

          .ks-invoice-footer { text-align: center !important; margin-top: 32px; padding-top: 24px; border-top: 1px solid #000 !important; }
          .ks-invoice-thanks, .ks-invoice-terms, .ks-invoice-copyright, .ks-invoice-vat { text-align: center !important; }

          @media print {
            html, body { padding: 0; }
            .ks-invoice-footer { text-align: center !important; border-top: 1px solid #000 !important; }
            .ks-invoice-footer * { text-align: center !important; }
          }
        `;
        var filename = 'invoice-' + orderNum + '.pdf';
        var pdfScript = '(function(){var filename=' + JSON.stringify(filename) + ';var s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";s.crossOrigin="anonymous";s.onload=function(){function doPdf(){var opt={margin:12,filename:filename,image:{type:"jpeg",quality:0.98},html2canvas:{scale:2,useCORS:true},jsPDF:{unit:"mm",format:"a4",orientation:"portrait"}};html2pdf().set(opt).from(document.body).save().then(function(){window.close();}).catch(function(){window.print();setTimeout(function(){window.close();},100);});}if(document.readyState==="complete")setTimeout(doPdf,200);else window.addEventListener("load",function(){setTimeout(doPdf,200);});};s.onerror=function(){window.print();setTimeout(function(){window.close();},100);};document.head.appendChild(s);})();';
        var win = window.open('', '_blank');
        win.document.write('<html><head><title>Invoice – Order #' + orderNum + '</title><style>' + printStyles + '</style></head><body>' + printArea.innerHTML + '<script>' + pdfScript + '<\/script></body></html>');
        win.document.close();
        win.focus();
      });
    }
  }

  window.downloadKiscienceInvoice = openInvoiceModal;

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-invoice-order-id]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        var id = el.getAttribute('data-invoice-order-id');
        if (id) openInvoiceModal(id.trim());
      });
    });
  });
})();
