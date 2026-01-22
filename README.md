# kiscience Shopify Custom App

A complete Shopify custom app built with Node.js backend and React frontend, designed specifically for kiscience.

## Features

- 🔐 **Shopify OAuth Integration** - Secure app installation and authentication
- 🎨 **Modern React UI** - Built with Shopify Polaris design system
- 🚀 **Vite Build System** - Fast development and optimized production builds
- 💾 **MongoDB Integration** - Store shop data and access tokens
- 📱 **Responsive Design** - Works on all devices
- 🔄 **Real-time Updates** - Live installation status and verification
- 🔒 **GDPR Compliant** - Mandatory webhooks for public app submission
- ✅ **Webhook Verification** - HMAC-SHA256 signature validation for all webhooks

## Tech Stack

### Backend
- **Node.js** - Server runtime
- **Express.js** - Web framework
- **MongoDB** - Database
- **Shopify API** - Official Shopify Node.js library

### Frontend
- **React 18** - UI library
- **Vite** - Build tool and dev server
- **Shopify Polaris** - Design system
- **React Router** - Client-side routing

## Prerequisites

- Node.js 16+ 
- MongoDB database
- Shopify Partner account
- ngrok or similar for local development

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd kiscience-shopify-app
   ```

2. **Install dependencies**
   ```bash
   npm run install:all
   ```

3. **Configure environment**
   - Copy `.env.example` to `.env`
   - Update with your Shopify API credentials and database URL

4. **Build the frontend**
   ```bash
   npm run build
   ```

## Configuration

### Environment Variables

Create `.env` with the following variables:

```env
# Shopify API Configuration
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_API_VERSION=2025-07

# App Scopes
SCOPES=read_products,write_products,read_themes,write_themes,write_content

# Application URLs
HOST=https://your-ngrok-url.ngrok-free.app
REDIRECT_URL=https://your-ngrok-url.ngrok-free.app/running

# Database Configuration
DB_URL=mongodb+srv://username:password@cluster.mongodb.net/database

# Server Configuration
PORT=4300
PRODUCTION=false
```

### Shopify App Setup

1. Create a new custom app in your Shopify Partner dashboard
2. Set the App URL to your ngrok URL
3. Configure the redirect URL: `https://your-ngrok-url.ngrok-free.app/running`
4. Add the required scopes
5. Copy the API key and secret to your environment file

## Usage

### Development

Run both backend and frontend in development mode:

```bash
npm run dev
```

This will start:
- Backend server on port 4300
- Frontend dev server on port 3000
- Vite proxy configured for API calls

### Production

Build and start the production server:

```bash
npm run build
npm start
```

## App Flow

1. **Installation**: User visits app URL with shop parameter
2. **OAuth**: Redirects to Shopify for authorization
3. **Callback**: Shopify redirects back with access token
4. **Welcome**: Shows success page after installation
5. **Dashboard**: Main app interface with tabs and features

## API Endpoints

### Authentication
- `GET /` - API status
- `GET /auth` - Initiate OAuth flow
- `GET /auth/callback` - OAuth callback handler
- `GET /api/verify-installation` - Check app installation status

### Webhooks (GDPR Compliant)
- `POST /webhooks/app/uninstalled` - Handle app uninstallation
- `POST /webhooks/customers/data_request` - Handle customer data access requests
- `POST /webhooks/customers/redact` - Handle customer data deletion
- `POST /webhooks/shop/redact` - Handle shop data deletion (48h after uninstall)

All webhooks include HMAC-SHA256 signature verification for security.

## Project Structure

```
kiscience-shopify-app/
├── server/                      # Backend Node.js server
│   ├── index.js                # Main server file
│   ├── controllers/            # Request handlers
│   │   └── gdprWebhooks.js    # GDPR webhook controllers
│   ├── utils/                  # Utility functions
│   │   └── webhookVerification.js  # HMAC verification
│   ├── models/                 # Database schemas
│   └── package.json            # Server dependencies
├── client/                     # React frontend
│   ├── src/                    # Source code
│   │   ├── components/         # React components
│   │   ├── hooks/              # Custom hooks
│   │   ├── App.jsx            # Main app component
│   │   └── main.jsx           # Entry point
│   ├── package.json           # Client dependencies
│   ├── vite.config.js         # Vite configuration
│   └── index.html             # HTML template
├── extensions/                 # Shopify extensions
│   └── theme-app-extension/   # Theme app extension
├── shopify.app.toml           # Shopify app configuration
├── package.json               # Root package.json
├── README.md                  # This file
└── GDPR_COMPLIANCE.md         # GDPR documentation
```

## Development

### Adding New Features

1. **Backend**: Add new routes in `server/index.js`
2. **Frontend**: Create new components in `client/src/components/`
3. **Database**: Add new collections as needed

### Testing

- Backend: Test API endpoints with tools like Postman
- Frontend: Use React DevTools and browser console
- Integration: Test complete OAuth flow

## Deployment

1. **Build the frontend**: `npm run build`
2. **Deploy backend**: Upload server files to your hosting provider
3. **Update environment**: Set production environment variables
4. **Update Shopify**: Change app URLs to production domain

## GDPR Compliance

This app is fully GDPR compliant with all three mandatory webhooks implemented:

1. **Customer Data Request** - Handles customer data access requests (30-day response time)
2. **Customer Redact** - Automatically deletes customer data upon request
3. **Shop Redact** - Deletes all shop data 48 hours after uninstallation

For detailed information, see [GDPR_COMPLIANCE.md](./GDPR_COMPLIANCE.md)

## Troubleshooting

### Common Issues

- **OAuth errors**: Check API key, secret, and redirect URL
- **Database connection**: Verify MongoDB connection string
- **Build errors**: Ensure all dependencies are installed
- **CORS issues**: Check origin configuration in server
- **Webhook verification fails**: Ensure SHOPIFY_API_SECRET is correctly set

### Logs

Check server console for detailed error messages and API responses.

### Testing Webhooks

Use Shopify CLI or tools like ngrok to test webhooks locally. See GDPR_COMPLIANCE.md for testing instructions.

## Support

For issues and questions:
- Check the troubleshooting section
- Review Shopify API documentation
- Contact the development team

## License

MIT License - see LICENSE file for details.

---

**Built with ❤️ for kiscience**
