# Ngrok Bypass Implementation

This document describes how ngrok browser warning bypass is implemented in the kiscience Shopify app.

## Overview

When using ngrok for local development, ngrok displays a warning page that requires manual interaction. This implementation automatically bypasses that warning to streamline development.

## Implementation Details

### Backend (Server)

The ngrok bypass is implemented in `server/index.js` as middleware that runs before other middleware:

```javascript
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
});
```

This sets the `ngrok-skip-browser-warning` header in all responses, which tells ngrok to skip the warning page.

### Frontend (Client)

#### 1. HTML Meta Tag

In `client/index.html`, a meta tag is included:

```html
<meta http-equiv="X-ngrok-skip-browser-warning" content="true" />
```

#### 2. Axios Configuration

In `client/src/main.jsx`, axios is configured to send the bypass header with all requests:

```javascript
axios.defaults.headers.common['ngrok-skip-browser-warning'] = 'true'
```

#### 3. Auto-Click Script

The `client/index.html` also includes a script that automatically clicks the "Visit Site" button on ngrok's warning page if it appears, providing a fallback method.

## How It Works

1. **Server-side**: The Express middleware sets the `ngrok-skip-browser-warning` header on all responses
2. **Client-side**: Axios includes the header in all API requests
3. **HTML Meta**: Provides an alternative method via meta tag
4. **Auto-click**: JavaScript fallback to automatically click through if the warning still appears

## Testing

When accessing the app through ngrok:
- The warning page should be automatically bypassed
- If the warning appears, the auto-click script should handle it
- All API requests should include the bypass header

## Notes

- This bypass only works for development environments using ngrok
- In production, these headers won't cause any issues
- The implementation uses multiple methods to ensure reliability
