# Invoice Download Script (Theme Liquid)

This lets customers **view and print invoices** from your theme (e.g. account or order history) using the same invoice modal as the affiliate dashboard.

## 1. Add the block to your theme

1. In **Shopify Admin**: Online Store → Themes → Customize.
2. Open **theme.liquid** (or the template where you want invoice download, e.g. a custom account/orders page).
3. Click **Add section** → under **Apps** select **Invoice download**.
4. Save.

The block injects:

- `KISCENCE_INVOICE_CONFIG` (shop, customerId, apiBase)
- `customer-dashboard.css` (invoice modal styles)
- `invoice-download.js` (fetch order, show modal, print)

## 2. Use in your theme

**Option A – Data attribute on a link/button**

Use the **Shopify order ID** (numeric `order.id` in Liquid), not the order number:

```liquid
<a href="#" data-invoice-order-id="{{ order.id }}">Download invoice</a>
```

or

```liquid
<button type="button" data-invoice-order-id="{{ order.id }}">View invoice</button>
```

**Option B – Call from your script**

```javascript
window.downloadKiscienceInvoice(12345678901234);  // Shopify order ID
```

## 3. Requirements

- **App proxy** must be enabled (prefix `apps`, subpath `kiscience`) so storefront requests to `/apps/kiscience/api/...` reach your app.
- Customer must be **logged in** (`customer.id` is set by the block).
- **Order ID** must be the numeric Shopify order ID (`order.id`), not `order.order_number`.

## 4. Files

| File | Purpose |
|------|--------|
| `blocks/invoice-download.liquid` | Block to add in Theme Editor; outputs config + CSS + JS. |
| `assets/invoice-download.js` | Standalone script: fetch order, render invoice modal, print/PDF. |
| `assets/customer-dashboard.css` | Contains `.ks-invoice-modal` and related styles. |
