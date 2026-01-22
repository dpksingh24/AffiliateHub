/**
 * GDPR Webhook Controllers
 * These are mandatory webhooks for public Shopify apps
 */

/**
 * Handle customer data request
 * Shopify sends this webhook when a customer requests their data
 * You have 30 days to provide the data
 */
async function handleCustomerDataRequest(req, res, db) {
  try {
    const webhookData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { shop_id, shop_domain, customer, orders_requested } = webhookData;

    console.log('Customer Data Request received:', {
      shop_domain,
      customer_id: customer?.id,
      customer_email: customer?.email,
      orders_requested
    });

    // Store the data request for processing
    await db.collection('gdpr_requests').insertOne({
      type: 'customer_data_request',
      shop_id,
      shop_domain,
      customer_id: customer?.id,
      customer_email: customer?.email,
      customer_phone: customer?.phone,
      orders_requested,
      status: 'pending',
      requested_at: new Date(),
      webhook_data: webhookData
    });

    console.log(`Customer data request stored for shop: ${shop_domain}`);

    // TODO: Implement data collection and delivery process
    // You should:
    // 1. Collect all customer data from your database
    // 2. Generate a report
    // 3. Send it to the customer within 30 days
    
    res.status(200).send();
  } catch (error) {
    console.error('Error handling customer data request:', error);
    res.status(500).json({ error: 'Failed to process customer data request' });
  }
}

/**
 * Handle customer redaction request
 * Shopify sends this 30 days after a customer requests deletion
 * You must delete the customer's personal data
 */
async function handleCustomerRedact(req, res, db) {
  try {
    const webhookData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { shop_id, shop_domain, customer, orders_to_redact } = webhookData;

    console.log('Customer Redaction Request received:', {
      shop_domain,
      customer_id: customer?.id,
      customer_email: customer?.email,
      orders_to_redact
    });

    // Log the redaction request
    await db.collection('gdpr_requests').insertOne({
      type: 'customer_redact',
      shop_id,
      shop_domain,
      customer_id: customer?.id,
      customer_email: customer?.email,
      orders_to_redact,
      status: 'processing',
      requested_at: new Date(),
      webhook_data: webhookData
    });

    // Delete or anonymize customer data from your database
    // This is a placeholder - implement based on your data structure
    
    // Example: If you store customer customization data
    const deleteResult = await db.collection('customer_customizations').deleteMany({
      shop_domain,
      customer_id: customer?.id
    });

    console.log(`Deleted ${deleteResult.deletedCount} customer customization records`);

    // Example: If you have customer sessions or preferences
    await db.collection('customer_sessions').deleteMany({
      shop_domain,
      customer_id: customer?.id
    });

    // Update the request status
    await db.collection('gdpr_requests').updateOne(
      {
        shop_domain,
        customer_id: customer?.id,
        type: 'customer_redact'
      },
      {
        $set: {
          status: 'completed',
          completed_at: new Date()
        }
      }
    );

    console.log(`Customer data redacted for customer ${customer?.id} from shop: ${shop_domain}`);
    
    res.status(200).send();
  } catch (error) {
    console.error('Error handling customer redact:', error);
    res.status(500).json({ error: 'Failed to process customer redaction' });
  }
}

/**
 * Handle shop redaction request
 * Shopify sends this 48 hours after a shop uninstalls your app
 * You must delete all shop data
 */
async function handleShopRedact(req, res, db) {
  try {
    const webhookData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { shop_id, shop_domain } = webhookData;

    console.log('Shop Redaction Request received:', {
      shop_id,
      shop_domain
    });

    // Log the redaction request
    await db.collection('gdpr_requests').insertOne({
      type: 'shop_redact',
      shop_id,
      shop_domain,
      status: 'processing',
      requested_at: new Date(),
      webhook_data: webhookData
    });

    // Delete ALL shop data from your database
    // Be thorough - check all collections that might have shop data
    
    // 1. Delete shop authentication data
    const shopDeleteResult = await db.collection('shops').deleteMany({ shop: shop_domain });
    console.log(`Deleted ${shopDeleteResult.deletedCount} shop records`);

    // 2. Delete customization options/settings
    const customizationDeleteResult = await db.collection('customization_options').deleteMany({ 
      shop: shop_domain 
    });
    console.log(`Deleted ${customizationDeleteResult.deletedCount} customization records`);

    // 3. Delete any customer data associated with this shop
    const customerDataDeleteResult = await db.collection('customer_customizations').deleteMany({ 
      shop_domain 
    });
    console.log(`Deleted ${customerDataDeleteResult.deletedCount} customer customization records`);

    // 4. Delete any orders/transactions data if you store any
    await db.collection('orders').deleteMany({ shop_domain });
    
    // 5. Delete any logs or analytics (optional, but recommended)
    await db.collection('shop_analytics').deleteMany({ shop_domain });
    await db.collection('shop_logs').deleteMany({ shop_domain });

    // 6. Delete GDPR requests for this shop (keep for 30 days for audit purposes)
    // You might want to archive these instead of deleting immediately
    await db.collection('gdpr_requests').updateMany(
      { shop_domain },
      { 
        $set: { 
          archived: true,
          archived_at: new Date()
        } 
      }
    );

    console.log(`All data redacted for shop: ${shop_domain}`);
    
    res.status(200).send();
  } catch (error) {
    console.error('Error handling shop redact:', error);
    res.status(500).json({ error: 'Failed to process shop redaction' });
  }
}

module.exports = {
  handleCustomerDataRequest,
  handleCustomerRedact,
  handleShopRedact
};

