{% comment %}
  Kiscience Invoice Download – add this block to theme.liquid (or account/order templates)
  so customers can view and print invoices. Uses app proxy to fetch order details.
  - Links/buttons with data-invoice-order-id="SHOPIFY_ORDER_ID" will open the invoice modal.
  - Or call window.downloadKiscienceInvoice(orderId) from your script.
  Order ID must be the numeric Shopify order ID (from order.id in Liquid), not order_number.
{% endcomment %}
<script>
  window.KISCENCE_INVOICE_CONFIG = {
    apiBase: "/apps/kiscience",
    shop: "{{ shop.permanent_domain }}",
    customerId: "{{ customer.id | default: '' }}"
  };
</script>
<link rel="stylesheet" href="{{ 'customer-dashboard.css' | asset_url }}">
<script src="{{ 'invoice-download.js' | asset_url }}" defer></script>

{% schema %}
{
  "name": "Invoice download",
  "target": "section",
  "enabled_on": { "groups": ["*"] },
  "settings": [
    {
      "type": "paragraph",
      "content": "Enables invoice view/print for logged-in customers. Add links with data-invoice-order-id=\"ORDER_ID\" (use order.id from Liquid) or call window.downloadKiscienceInvoice(orderId)."
    }
  ]
}
{% endschema %}
