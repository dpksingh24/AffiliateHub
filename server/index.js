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
// Skip body parsers for multipart/form-data requests (let Multer handle them)
app.use((req, res, next) => {
  if (req.is('multipart/form-data')) {
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
    
    mongoClient = new MongoClient(dbUrl);
    await mongoClient.connect();
    db = mongoClient.db(process.env.DB_NAME);
    console.log('Connected to MongoDB');
    
    // Register Form Builder API routes
    const formRoutes = createFormRoutes(db);
    app.use('/api', formRoutes);
    console.log('Form Builder API routes registered');

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
