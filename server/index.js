const express = require('express');
const multer = require('multer');
const cors = require('cors');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const { MongoClient } = require('mongodb');
const Shopify = require('shopify-api-node');
const { verifyShopifyWebhook } = require('./utils/webhookVerification');
const { 
  handleCustomerDataRequest, 
  handleCustomerRedact, 
  handleShopRedact 
} = require('./utils/gdprWebhooks');
const createFormRoutes = require('./routes/formRoutes');
const createAdminRoutes = require('./routes/adminRoutes');
const createCustomerRoutes = require('./routes/customerRoutes');
require('dotenv').config({ path: '../.env' });

let fetch;
if (typeof globalThis.fetch === 'undefined') {
  fetch = require('node-fetch');
} else {
  fetch = globalThis.fetch;
}

const app = express();
const PORT = process.env.PORT || 4300;

// Middleware - ngrok bypass (must be before other middleware)
app.use((req, res, next) => {
  // Set ngrok-skip-browser-warning header in response
  // Note: ngrok checks this in REQUEST headers, but we set it here for API responses
  res.setHeader('ngrok-skip-browser-warning', 'true');
  
  // Also set a custom User-Agent header workaround (ngrok alternative method)
  // This helps bypass the warning for requests that include custom headers
  if (req.headers['user-agent'] && !req.headers['user-agent'].includes('ngrok')) {
    // Keep original user agent
  }
  
  next();
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", "https://admin.shopify.com", "https://*.myshopify.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://admin.shopify.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://admin.shopify.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      fontSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:", "https://admin.shopify.com", "wss:"],
      frameSrc: ["'self'", "https://admin.shopify.com"],
      frameAncestors: ["'self'", "https://admin.shopify.com", "https://*.myshopify.com"]
    }
  },
  frameguard: false,
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(morgan('combined'));
app.use(cors({
  origin: [
    process.env.HOST,
    'https://admin.shopify.com',
    /\.myshopify\.com$/,
    /\.trycloudflare\.com$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'ngrok-skip-browser-warning']
}));
// Skip body parsers for multipart/form-data and webhook requests (let their own middleware handle them)
app.use((req, res, next) => {
  if (req.is('multipart/form-data') || req.path === '/webhooks' || req.path === '/webhooks/app/uninstalled') {
    return next();
  }
  express.json()(req, res, next);
});
app.use((req, res, next) => {
  if (req.is('multipart/form-data')) {
    return next();
  }
  express.urlencoded({ extended: true })(req, res, next);
});
app.use(cookieParser());

// App proxy path fix: Shopify appends path to proxy URL, so we get /api/api/... instead of /api/...
// Rewrite so /api/api/* is handled as /api/* (proxy URL is .../api, path is /api/customers/...)
app.use((req, res, next) => {
  if (req.path.indexOf('/api/api/') === 0) {
    req.url = req.url.replace(/^\/api\/api/, '/api');
  }
  next();
});

// Serve uploaded files statically with proper MIME types and CORS headers
app.use('/uploads', (req, res, next) => {
  // Set CORS headers for uploaded files
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    // Set correct content type for common file types
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.gif': 'image/gif',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
    if (mimeTypes[ext]) {
      res.setHeader('Content-Type', mimeTypes[ext]);
    }
  }
}));

// Email logo as PNG (Outlook and many clients don't support WebP)
const sharp = require('sharp');
const fs = require('fs');
app.get('/assets/images/ki_logo.png', (req, res) => {
  const webpPath = path.join(__dirname, 'assets', 'images', 'ki_logo.png');
  if (!fs.existsSync(webpPath)) {
    return res.status(404).send('Logo not found');
  }
  fs.readFile(webpPath, (err, buffer) => {
    if (err) return res.status(500).send('Error reading logo');
    sharp(buffer)
      .png()
      .toBuffer()
      .then((pngBuffer) => {
        res.type('image/png').send(pngBuffer);
      })
      .catch((e) => res.status(500).send('Error converting logo'));
  });
});

// Email assets (e.g. logo) - public URL needed for email clients like Gmail
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use(session({
  secret: process.env.SHOPIFY_API_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.PRODUCTION === 'true' }
}));

// MongoDB connection
let db;
let mongoClient; // Keep reference to prevent garbage collection
const connectDB = async () => {
  try {
    // Validate DB_URL format
    if (!process.env.DB_URL) {
      throw new Error('DB_URL environment variable is not set');
    }
    
    // Check if DB_URL looks like a valid MongoDB connection string
    const dbUrl = process.env.DB_URL;
    if (!dbUrl.startsWith('mongodb://') && !dbUrl.startsWith('mongodb+srv://')) {
      throw new Error('DB_URL must start with mongodb:// or mongodb+srv://');
    }
    
    // Validate authentication is present
    try {
      const urlObj = new URL(dbUrl.replace('mongodb+srv://', 'https://').replace('mongodb://', 'http://'));
      const hasAuth = urlObj.username && urlObj.password;
      if (!hasAuth) {
        console.warn('WARNING: DB_URL appears to be missing username/password');
      }
    } catch (urlErr) {
      // URL parsing failed, continue anyway
    }
    
    const clientOptions = {
      serverSelectionTimeoutMS: 15000,
      tls: true
    };
    // If Atlas TLS handshake fails (e.g. SSL alert 80), try: MONGODB_TLS_INSECURE=1 npm start (dev only)
    if (process.env.MONGODB_TLS_INSECURE === '1') {
      clientOptions.tlsAllowInvalidCertificates = true;
      console.warn('MONGODB_TLS_INSECURE=1: certificate verification relaxed (use only for debugging)');
    }
    mongoClient = new MongoClient(dbUrl, clientOptions);
    await mongoClient.connect();
    db = mongoClient.db(process.env.DB_NAME);
    // Prevent duplicate referral conversions at DB level (unique index on orderId)
    try {
      await db.collection('referral_conversions').createIndex({ orderId: 1 }, { unique: true });
      console.log('Referral conversions unique index on orderId ensured');
    } catch (idxErr) {
      if (idxErr.code === 85) console.warn('Referral conversions index already exists');
      else if (idxErr.code === 86) console.warn('Referral conversions: unique index not created (duplicate orderIds in collection). Remove duplicates and restart to enforce index.');
      else console.warn('Referral conversions index create:', idxErr.message);
    }
    console.log('Connected to MongoDB');
    
    // Register API routes
    const formRoutes = createFormRoutes(db);
    app.use('/api', formRoutes);
    console.log('API routes registered');

    // Register Admin API routes
    const adminRoutes = createAdminRoutes(db);
    app.use('/api/admin', adminRoutes);
    console.log('Admin API routes registered');

    // Register Customer API routes (storefront Account Details)
    const customerRoutes = createCustomerRoutes(db);
    app.use('/api/customers', customerRoutes);
    console.log('Customer API routes registered');

  // Referral link redirect route - handles /ref=SHORTCODE format
  app.get(/^\/ref=(.+)$/, async (req, res) => {
    try {
      // Extract shortCode from URL path (format: /ref=SHORTCODE)
      const pathMatch = req.path.match(/^\/ref=(.+)$/);
      const shortCode = pathMatch ? pathMatch[1] : null;
      const { shop } = req.query; // Optional shop parameter for redirect

      if (!shortCode) {
        return res.status(400).json({ error: 'Referral code is required' });
      }

      // Check if database is available
      if (!db) {
        console.error('Database not connected yet');
        return res.status(503).json({ error: 'Database not available. Please try again in a moment.' });
      }

      // Find affiliate by referral link shortCode
      const affiliate = await db.collection('affiliates').findOne({
        'referralLinks.shortCode': shortCode
      });

      if (!affiliate) {
        return res.status(404).json({ error: 'Invalid referral code' });
      }

      // Replaced links must not redirect or track – only the current primary (active) link works
      const link = (affiliate.referralLinks || []).find((l) => l.shortCode === shortCode);
      if (link && (link.status || '').toLowerCase() === 'replaced') {
        return res.status(410).json({
          error: 'This referral link is no longer active',
          message: 'The affiliate has created a new link. Please use their current referral link.'
        });
      }

      const { trackReferralClick } = require('./models/affiliate.model');
      const { getClientIp } = require('./utils/requestUtils');
      const metadata = {
        ipAddress: getClientIp(req) || req.ip || req.connection?.remoteAddress,
        userAgent: req.headers['user-agent'],
        referrer: req.headers['referer']?.trim() || 'Referral link'
      };

      let visitId = null;
      try {
        visitId = await trackReferralClick(db, shortCode, metadata);
      } catch (trackError) {
        console.error('Error tracking click:', trackError);
      }

      // Determine store URL
      let storeUrl;
      if (shop) {
        // Use shop parameter if provided
        storeUrl = `https://${shop}`;
      } else if (affiliate.shop) {
        // Use shop from affiliate record
        const shopDomain = affiliate.shop.includes('.myshopify.com')
          ? affiliate.shop
          : `${affiliate.shop}.myshopify.com`;
        storeUrl = `https://${shopDomain}`;
      } else {
        // Fallback to a default store URL or return error
        return res.status(400).json({ error: 'Unable to determine store URL' });
      }

      const cartVariantPath = req.query.cart;
      const discountCode = typeof req.query.discount === 'string' ? req.query.discount.trim() : '';
      const visitParam = visitId ? '&visitId=' + encodeURIComponent(visitId) : '';
      const discountParam = discountCode ? '&discount=' + encodeURIComponent(discountCode) : '';
      if (cartVariantPath && typeof cartVariantPath === 'string' && /^[\d,:]+$/.test(cartVariantPath)) {
        const homeUrl = `${storeUrl}?ref=${encodeURIComponent(shortCode)}&cart=${encodeURIComponent(cartVariantPath)}&utm_source=affiliate_share&utm_medium=cart_share${visitParam}${discountParam}`;
        return res.redirect(homeUrl);
      }

      const referralUrl = `${storeUrl}?ref=${encodeURIComponent(shortCode)}&utm_source=affiliate&utm_medium=referral${visitParam}${discountParam}`;
      res.redirect(referralUrl);
    } catch (error) {
      console.error('Error processing referral link:', error);
      res.status(500).json({ error: 'Failed to process referral link', message: error.message });
    }
  });

  // Register Affiliate API routes
  const createAffiliateRoutes = require('./routes/affiliateRoutes');
  const affiliateRoutes = createAffiliateRoutes(db);
  app.use('/api/affiliates', affiliateRoutes);
  console.log('Affiliate API routes registered');

    app.use((err, req, res, next) => {
      // Handle Multer (file upload) errors gracefully with JSON
      if (err instanceof multer.MulterError) {
        const isSizeError = err.code === 'LIMIT_FILE_SIZE';
        return res.status(isSizeError ? 413 : 400).json({
          success: false,
          error: 'Upload failed',
          code: err.code,
          message: isSizeError
            ? 'One or more files exceed the maximum size of 10MB.'
            : err.message,
          maxFileSizeMb: 10
        });
      }
      // Generic error formatting for API routes
      if (req.path.startsWith('/api')) {
        return res.status(500).json({
          success: false,
          error: 'Server error',
          message: err && err.message ? err.message : 'Unknown server error'
        });
      }
      next(err);
    });
    
    // Note: /uploads is already served by middleware above
    
    // Serve static files from React build (AFTER API routes)
    app.use(express.static(path.join(__dirname, '../client/dist')));
    
    // Catch all route for React app (MUST be last)
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '../client/dist/index.html'));
    });
    console.log('Static files and catch-all route registered');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    
    // Provide helpful error messages based on error type
    if (error.code === 8000 || error.codeName === 'AtlasError') {
      console.error('\n❌ MongoDB Authentication Failed');
      console.error('Possible causes:');
      console.error('  1. Incorrect username or password in DB_URL');
      console.error('  2. Database user does not exist or was deleted');
      console.error('  3. IP address not whitelisted in MongoDB Atlas');
      console.error('  4. Database user does not have required permissions');
      console.error('\nTo fix:');
      console.error('  1. Check your MongoDB Atlas dashboard');
      console.error('  2. Verify Database Access user credentials');
      console.error('  3. Add your IP address to Network Access whitelist');
      console.error('  4. Ensure DB_URL format is: mongodb+srv://username:password@cluster.mongodb.net/');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.error('\n❌ MongoDB Host Not Found');
      console.error('Check that your DB_URL hostname is correct');
    } else if (error.message.includes('timeout')) {
      console.error('\n❌ MongoDB Connection Timeout');
      console.error('Check your network connection and MongoDB Atlas firewall settings');
    } else if (error.message.includes('SSL') || error.message.includes('ssl3_read_bytes') || error.message.includes('tlsv1 alert')) {
      console.error('\n❌ MongoDB TLS/SSL Handshake Error');
      console.error('MongoDB Atlas requires TLS 1.2+. Try one of:');
      console.error('  1. Use Node.js 18 or 20 LTS: nvm use 18 (or install from nodejs.org)');
      console.error('  2. Force TLS 1.2: NODE_OPTIONS=\'--tls-min-v1.2\' npm start');
      console.error('  3. In Atlas: Network Access -> add 0.0.0.0/0 to allow from anywhere (if safe for your setup)');
    }
    
    console.error('\nCurrent DB_URL format (without password):', 
      process.env.DB_URL ? process.env.DB_URL.replace(/:[^:@]+@/, ':****@') : 'Not set');
  }
};

// Helper function to normalize URLs (remove trailing slashes)
const normalizeUrl = (baseUrl, path = '') => {
  const cleanBase = baseUrl.replace(/\/+$/, ''); // Remove trailing slashes
  const cleanPath = path.replace(/^\/+/, ''); // Remove leading slashes
  return cleanPath ? `${cleanBase}/${cleanPath}` : cleanBase;
};

// Routes
app.get('/', (req, res) => {
  const { shop, hmac, host, timestamp } = req.query;
  
  // If this is an installation request with shop parameter
  if (shop) {
    // Redirect to the installation page
    return res.redirect(`/install?shop=${shop}&hmac=${hmac || ''}&host=${host || ''}&timestamp=${timestamp || ''}`);
  }
  
  // Otherwise serve the React app
  const indexPath = path.join(__dirname, '../client/dist/index.html');
  const fs = require('fs');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  
  // Fallback if React app not built
  res.json({ message: 'kiscience Shopify App API - Please build the client app' });
});

// Installation page route
app.get('/install', (req, res) => {
  const { shop, hmac, host, timestamp } = req.query;
  
  
  if (!shop) {
    return res.status(400).json({ error: 'Shop parameter is required' });
  }

  // Redirect to Shopify OAuth
  const scopes = process.env.SCOPES;
  const redirectUri = normalizeUrl(process.env.HOST, '/auth/callback');
  
  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_API_KEY}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${Buffer.from(shop).toString('base64')}`;
  
  res.redirect(authUrl);
});

// Shopify OAuth routes
app.get('/auth', (req, res) => {
  const shop = req.query.shop;
  if (!shop) {
    return res.status(400).json({ error: 'Shop parameter is required' });
  }

  const scopes = process.env.SCOPES;
  const redirectUri = normalizeUrl(process.env.HOST, '/auth/callback');
  
  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_API_KEY}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${Buffer.from(shop).toString('base64')}`;
  
  res.redirect(authUrl);
});


app.get('/auth/callback', async (req, res) => {
  const { shop, code, state } = req.query;
  
  if (!shop || !code) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  // Check if database is available
  if (!db) {
    console.error('Database not connected yet');
    return res.status(503).json({ error: 'Database not available. Please try again in a moment.' });
  }

  try {
    // Exchange code for access token using direct HTTP request
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code: code
      })
    });
    
    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokenResponse.status}`);
    }
    
    const tokenData = await tokenResponse.json();
    
    // Verify database is still connected
    if (!db) {
      throw new Error('Database connection lost');
    }
    
    // Store shop and access token in database
    let updateResult;
    try {
      updateResult = await db.collection('shops').updateOne(
        { shop },
        { 
          $set: { 
            shop, 
            accessToken: tokenData.access_token,
            installedAt: new Date(),
            scopes: process.env.SCOPES,
            status: 'installed'
          }
        },
        { upsert: true }
      );
      // Shop data saved successfully
    } catch (dbError) {
      console.error('Database operation failed:', dbError);
      throw new Error(`Failed to save shop data: ${dbError.message}`);
    }

    // Register required webhooks for this shop (orders/create)
    try {
      await registerWebhooksForShop(shop, tokenData.access_token);
    } catch (e) {
      console.warn('Webhook registration attempt failed:', e.message || e);
    }
    
    // Verify the installation was saved
    try {
      const savedShop = await db.collection('shops').findOne({ shop });
      if (!savedShop || !savedShop.accessToken) {
        console.error('WARNING: Installation may not have been saved correctly');
      }
    } catch (verifyError) {
      console.error('Error verifying installation:', verifyError.message);
    }

    // Redirect to app with success and include the host parameter
    const hostParam = req.query.host || '';
    const redirectUrl = normalizeUrl(process.env.HOST, `/running?shop=${shop}&installed=true&host=${hostParam}`);
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('OAuth error:', error.message);
    res.status(500).json({ 
      error: 'OAuth failed',
      message: error.message
    });
  }
});

// Register standard webhooks after installation: orders/create
const registerWebhooksForShop = async (shop, accessToken) => {
  try {
    if (!shop || !accessToken) return;

    const webhookUrl = normalizeUrl(process.env.HOST, '/webhooks');
    const topics = [ 'orders/create' ];

    for (const topic of topics) {
      try {
        // Create webhook subscription via Admin API
        const resp = await fetch(`https://${shop}/admin/api/${process.env.SHOPIFY_API_VERSION}/webhooks.json`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': accessToken
          },
          body: JSON.stringify({
            webhook: {
              topic,
              address: webhookUrl,
              format: 'json'
            }
          })
        });

        if (!resp.ok) {
          const body = await resp.text();
          console.warn(`Webhook registration for ${topic} returned ${resp.status}: ${body}`);
        } else {
          console.log(`Registered webhook ${topic} for shop ${shop}`);
        }
      } catch (e) {
        console.error(`Failed to register webhook ${topic} for ${shop}:`, e.message || e);
      }
    }
  } catch (e) {
    console.error('registerWebhooksForShop error:', e.message || e);
  }
};

// App installation verification
app.get('/api/verify-installation', async (req, res) => {
  const { shop } = req.query;
  
  if (!shop) {
    return res.status(400).json({ error: 'Shop parameter is required' });
  }

  // Check if database is available
  if (!db) {
    console.error('Database not connected yet');
    return res.status(503).json({ error: 'Database not available. Please try again in a moment.' });
  }

  try {
    const shopData = await db.collection('shops').findOne({ shop });
    
    if (shopData && shopData.accessToken) {
      res.json({ 
        installed: true, 
        shop,
        installedAt: shopData.installedAt,
        scopes: shopData.scopes
      });
    } else {
      res.json({ installed: false, shop });
    }
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ===== WEBHOOK ENDPOINTS =====
// Note: Webhooks must use raw body for HMAC verification

// Unified webhook handler for GDPR compliance webhooks
app.post('/webhooks', 
  express.raw({ type: 'application/json' }), 
  verifyShopifyWebhook,
  async (req, res) => {
    const topic = req.webhookTopic;
    console.log('Webhook received:', topic);
    try {
      switch (topic) {
        case 'customers/data_request':
          await handleCustomerDataRequest(req, res, db);
          break;
        case 'customers/redact':
          await handleCustomerRedact(req, res, db);
          break;
        case 'orders/create':
          // Handle order creation webhook to track affiliate conversions
          try {
            const order = req.body && req.body.order ? req.body.order : req.body;

            const shopifyOrderId = order.id || order.order_id || order.shopify_order_id || null;
            const orderName = order.name || order.order_number || null;
            let amount = parseFloat(order.total_price || order.total || 0) || 0;
            const currency = order.currency || order.currency_code || (order.total_price_currency || 'USD');

            // If cart had affiliate_attributed_variants (shared-cart flow), commission on attributed product total + proportional shipping & tax (so total order value for attributed share)
            const noteAttrs = Array.isArray(order.note_attributes) ? order.note_attributes : [];
            const attributedAttr = noteAttrs.find(n => (n.name || '').toLowerCase() === 'affiliate_attributed_variants');
            let attributedProductNames = null;
            if (attributedAttr && attributedAttr.value && typeof attributedAttr.value === 'string') {
              const attributed = {};
              attributedAttr.value.split(',').forEach(part => {
                const [vid, q] = part.split(':').map(s => (s || '').trim());
                if (vid && q) attributed[vid] = (attributed[vid] || 0) + parseInt(q, 10);
              });
              let attributedLineTotal = 0;
              const names = [];
              (order.line_items || []).forEach(item => {
                const vid = String(item.variant_id || '');
                if (attributed[vid]) {
                  const take = Math.min(Number(item.quantity) || 0, attributed[vid]);
                  attributedLineTotal += (parseFloat(item.price) || 0) * take;
                  if (take > 0 && (item.title || '').trim()) names.push((item.title || '').trim());
                  attributed[vid] -= take;
                }
              });
              if (attributedLineTotal > 0) {
                const subtotal = parseFloat(order.subtotal_price || 0) || 0;
                let shipping = parseFloat(order.total_shipping_price || 0) || 0;
                if (shipping === 0 && order.total_shipping_price_set && order.total_shipping_price_set.shop_money) {
                  shipping = parseFloat(order.total_shipping_price_set.shop_money.amount || 0) || 0;
                }
                if (shipping === 0 && Array.isArray(order.shipping_lines) && order.shipping_lines.length > 0) {
                  shipping = order.shipping_lines.reduce((sum, s) => sum + (parseFloat(s.price || 0) || 0), 0);
                }
                let tax = parseFloat(order.total_tax || 0) || 0;
                if (tax === 0 && order.total_tax_set && order.total_tax_set.shop_money) {
                  tax = parseFloat(order.total_tax_set.shop_money.amount || 0) || 0;
                }
                const ratio = subtotal > 0 ? attributedLineTotal / subtotal : 1;
                const attributedAmount = attributedLineTotal + (shipping * ratio) + (tax * ratio);
                amount = Math.round(attributedAmount * 100) / 100;
                attributedProductNames = names.length ? names : null;
              }
            }

            // Determine affiliate shortCode from multiple possible locations
            // (Cart attributes may not appear in order webhook; landing_site is reliable for share links.)
            let shortCode = null;

            // 1) Check landing_site first — most reliable when customer used share link (ref in URL)
            if (!shortCode && typeof order.landing_site === 'string') {
              try {
                // Store URL: ?ref=SHORTCODE (query) or path /?ref=SHORTCODE
                const base = `https://${req.shopDomain || 'store.myshopify.com'}`;
                const url = new URL(order.landing_site, base);
                shortCode = url.searchParams.get('ref') || url.searchParams.get('affiliate') || shortCode;
                // App redirect URL: first page may be our app path e.g. /ref=SHORTCODE or /ref=SHORTCODE?cart=...
                if (!shortCode && /\/ref=/.test(order.landing_site)) {
                  const pathMatch = order.landing_site.match(/\/ref=([^/?&#]+)/);
                  if (pathMatch) shortCode = pathMatch[1];
                }
              } catch (e) {
                // Fallback: extract ref= from path (app-style URL)
                if (!shortCode && /\/ref=/.test(order.landing_site)) {
                  const pathMatch = order.landing_site.match(/\/ref=([^/?&#]+)/);
                  if (pathMatch) shortCode = pathMatch[1];
                }
              }
            }

            // 2) Check note_attributes (cart/order attributes)
            if (!shortCode && Array.isArray(order.note_attributes)) {
              const found = order.note_attributes.find(n => (n.name || '').toLowerCase() === 'affiliate' || (n.name || '').toLowerCase() === 'ref');
              if (found) shortCode = found.value;
            }

            // 3) Check attributes object
            if (!shortCode && order.attributes) {
              if (Array.isArray(order.attributes)) {
                const f = order.attributes.find(a => (a.name || '').toLowerCase() === 'affiliate' || (a.name || '').toLowerCase() === 'ref');
                if (f) shortCode = f.value || f;
              } else if (typeof order.attributes === 'object') {
                shortCode = order.attributes.affiliate || order.attributes.ref || shortCode;
              }
            }

            // 4) Check tags for affiliate:<code>
            if (!shortCode && typeof order.tags === 'string') {
              const match = order.tags.match(/affiliate:([A-Za-z0-9]+)/i);
              if (match) shortCode = match[1];
            }

            if (!shortCode) {
              // Debug: log what we received so we can fix attribution
              const noteAttrs = Array.isArray(order.note_attributes) ? order.note_attributes : [];
              console.log('orders/create webhook: no affiliate shortCode found for order', shopifyOrderId || orderName, 'landing_site=', typeof order.landing_site === 'string' ? order.landing_site : order.landing_site, 'note_attributes_count=', noteAttrs.length, 'note_attributes_sample=', JSON.stringify(noteAttrs.slice(0, 10)), 'shopDomain=', req.shopDomain);
              res.status(200).send();
              break;
            }

            // Idempotency: don't record the same order twice
            const existing = await db.collection('referral_conversions').findOne({ orderId: String(shopifyOrderId || orderName) });
            if (existing) {
              console.log('orders/create webhook: conversion already recorded for order', shopifyOrderId || orderName);
              res.status(200).send();
              break;
            }

            const addr = order.shipping_address || order.billing_address || {};
            const customerName = [addr.first_name, addr.last_name].filter(Boolean).join(' ') || (order.customer && [order.customer.first_name, order.customer.last_name].filter(Boolean).join(' ')) || '';
            const customerEmail = order.email || order.customer?.email || '';
            const customerPhone = addr.phone || (order.billing_address && order.billing_address.phone) || '';

            let visitId = null;
            if (Array.isArray(order.note_attributes)) {
              const visitAttr = order.note_attributes.find(n => (n.name || '').toLowerCase() === 'affiliate_visit_id');
              if (visitAttr && visitAttr.value) visitId = String(visitAttr.value);
            }
            if (!visitId && Array.isArray(order.note_attributes)) {
              console.log('orders/create webhook: no affiliate_visit_id in order – note_attributes sample:', JSON.stringify((order.note_attributes || []).slice(0, 15)));
            }
            const productNames = attributedProductNames || (order.line_items || []).map(item => (item.title || '').trim()).filter(Boolean);

            const orderDisplay = order.name || (order.order_number != null ? '#' + order.order_number : '');
            const { trackReferralConversion } = require('./models/affiliate.model');
            const result = await trackReferralConversion(db, shortCode, {
              orderId: String(shopifyOrderId || orderName),
              orderDisplay: orderDisplay ? String(orderDisplay).trim() : undefined,
              amount,
              currency,
              customerEmail: customerEmail || undefined,
              customerName: customerName || undefined,
              customerPhone: customerPhone || undefined,
              visitId: visitId || undefined,
              productNames: productNames.length ? productNames : undefined
            });

            if (result && result.inserted && result.affiliate && result.affiliate.email && result.affiliate.settings?.enableNewReferralNotifications) {
              try {
                const EmailService = require('./services/email.services');
                await EmailService.sendNewReferralNotificationToAffiliate(result.affiliate.email, {
                  affiliateName: result.affiliate.name || 'Affiliate',
                  orderDisplay: orderDisplay || String(shopifyOrderId || orderName),
                  amount,
                  currency,
                  commissionAmount: result.commissionAmount
                });
              } catch (emailErr) {
                console.error('orders/create webhook: failed to send new referral notification email:', emailErr);
              }
            }

            if (result && result.inserted) {
              console.log('orders/create webhook: tracked conversion for affiliate', shortCode, 'order', shopifyOrderId || orderName, 'amount', amount);
            } else if (result && result.reason === 'self_referral') {
              console.log('orders/create webhook: skipped conversion (self-referral: purchaser is the same as affiliate) for affiliate', shortCode, 'order', shopifyOrderId || orderName);
            } else if (result && result.reason === 'duplicate') {
              console.log('orders/create webhook: conversion already recorded for order', shopifyOrderId || orderName);
            } else {
              console.log('orders/create webhook: conversion not recorded for order', shopifyOrderId || orderName);
            }
            res.status(200).send();
          } catch (err) {
            console.error('orders/create webhook handler error:', err);
            res.status(500).send();
          }
          break;
        case 'shop/redact':
          await handleShopRedact(req, res, db);
          break;
        default:
          console.error(`Unknown webhook topic: ${topic}`);
          res.status(404).json({ error: 'Unknown webhook topic' });
      }
    } catch (error) {
      console.error(`Error handling webhook ${topic}:`, error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
);

// App uninstalled webhook
app.post('/webhooks/app/uninstalled', 
  express.raw({ type: 'application/json' }), 
  verifyShopifyWebhook,
  async (req, res) => {
    try {
      const shop = req.shopDomain;
      
      // Remove shop from database (access token only, keep for shop/redact)
      await db.collection('shops').updateOne(
        { shop },
        { 
          $set: { 
            accessToken: null,
            uninstalledAt: new Date(),
            status: 'uninstalled'
          }
        }
      );
      
      console.log(`App uninstalled from shop: ${shop}`);
      console.log('Note: Shop data will be deleted after receiving shop/redact webhook in 48 hours');
      
      res.status(200).send();
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).send();
    }
  }
);

// Start server
const startServer = async () => {
  // Validate required environment variables
  const requiredEnvVars = [
    'SHOPIFY_API_KEY',
    'SHOPIFY_API_SECRET',
    'SHOPIFY_API_VERSION',
    'HOST',
    'SCOPES',
    'DB_URL',
    'DB_NAME'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    console.error('Missing required environment variables:', missingVars);
    process.exit(1);
  }
  
  console.log('Environment variables validated successfully');
  console.log('Shopify API Key:', process.env.SHOPIFY_API_KEY ? '✓ Present' : '✗ Missing');
  console.log('Shopify API Secret:', process.env.SHOPIFY_API_SECRET ? '✓ Present' : '✗ Missing');
  console.log('Shopify API Version:', process.env.SHOPIFY_API_VERSION);
  console.log('App Host:', process.env.HOST);
  console.log('App Scopes:', process.env.SCOPES);
  console.log('Database URL:', process.env.DB_URL ? '✓ Present' : '✗ Missing');
  console.log('Database Name:', process.env.DB_NAME || '✗ Missing');
  
  await connectDB();
  
  // Verify database connection after connecting
  if (!db) {
    console.error('ERROR: Database connection failed - db is null');
    process.exit(1);
  }
  
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`App URL: ${process.env.HOST}`);
  });
};

startServer();
