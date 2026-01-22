const crypto = require('crypto');

/**
 * Verify that the webhook request came from Shopify
 * @param {string} body - Raw request body
 * @param {string} hmacHeader - HMAC header from Shopify
 * @param {string} secret - Shopify API secret
 * @returns {boolean} - Whether the webhook is verified
 */
function verifyWebhook(body, hmacHeader, secret) {
  if (!hmacHeader || !secret || !body) {
    console.error('Missing required parameters for webhook verification');
    console.error(`HMAC: ${!!hmacHeader}, Secret: ${!!secret}, Body: ${!!body}`);
    return false;
  }

  try {
    // body can be a Buffer or string - handle both
    const bodyBuffer = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
    
    const hash = crypto
      .createHmac('sha256', secret)
      .update(bodyBuffer)
      .digest('base64');

    // Use timingSafeEqual to prevent timing attacks
    const hmacBuffer = Buffer.from(hmacHeader);
    const hashBuffer = Buffer.from(hash);
    
    if (hmacBuffer.length !== hashBuffer.length) {
      console.error(`HMAC length mismatch: expected ${hashBuffer.length}, got ${hmacBuffer.length}`);
      return false;
    }

    return crypto.timingSafeEqual(hmacBuffer, hashBuffer);
  } catch (error) {
    console.error('Error verifying webhook:', error);
    return false;
  }
}

/**
 * Middleware to verify Shopify webhooks
 */
function verifyShopifyWebhook(req, res, next) {
  const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
  const shopDomain = req.get('X-Shopify-Shop-Domain');
  const topic = req.get('X-Shopify-Topic');
  
  console.log(`Webhook received - Topic: ${topic}, Shop: ${shopDomain}`);
  console.log(`HMAC Header present: ${!!hmacHeader}, Body type: ${typeof req.body}, Is Buffer: ${Buffer.isBuffer(req.body)}`);

  // Get the raw body - it should be a Buffer when using express.raw()
  const rawBody = req.body;
  
  // For webhook verification, we need the raw body as it was received
  // If it's a Buffer, use it directly. If it's a string, convert to Buffer.
  let bodyForVerification;
  if (Buffer.isBuffer(rawBody)) {
    bodyForVerification = rawBody;
  } else if (typeof rawBody === 'string') {
    bodyForVerification = Buffer.from(rawBody, 'utf8');
  } else {
    // If it's already been parsed as JSON, we can't verify it properly
    // This shouldn't happen with express.raw(), but handle it anyway
    bodyForVerification = Buffer.from(JSON.stringify(rawBody), 'utf8');
  }

  // Verify the webhook - pass the Buffer directly
  const isVerified = verifyWebhook(
    bodyForVerification,
    hmacHeader,
    process.env.SHOPIFY_API_SECRET
  );

  if (!isVerified) {
    console.error(`Webhook verification failed for topic: ${topic}`);
    console.error('Check that SHOPIFY_API_SECRET is set correctly');
    return res.status(401).json({ error: 'Webhook verification failed' });
  }

  console.log(`Webhook verified successfully - Topic: ${topic}`);
  
  // Parse the body for use in handlers (if it's a Buffer, parse it)
  if (Buffer.isBuffer(rawBody)) {
    try {
      req.body = JSON.parse(rawBody.toString('utf8'));
    } catch (e) {
      console.error('Error parsing webhook body:', e);
      req.body = {};
    }
  }
  
  // Add shop domain to request for use in handlers
  req.shopDomain = shopDomain;
  req.webhookTopic = topic;
  
  next();
}

module.exports = {
  verifyWebhook,
  verifyShopifyWebhook
};

