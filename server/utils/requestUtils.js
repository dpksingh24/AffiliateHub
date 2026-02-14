/**
 * Request utilities for server-side handling (proxy-aware client IP, etc.)
 */

/**
 * Get the client's real IP address from the request.
 * When behind a reverse proxy (Nginx, Cloudflare, etc.), req.connection.remoteAddress
 * is the proxy's IP (often 127.0.0.1). This reads standard proxy headers first.
 *
 * @param {object} req - Express request
 * @returns {string} Client IP or fallback (e.g. 127.0.0.1)
 */
function getClientIp(req) {
  if (!req) return '';
  // X-Forwarded-For can be "client, proxy1, proxy2" – first is the client
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded[0];
    const ip = (first && first.trim()) || '';
    if (ip) return ip;
  }
  if (req.headers['x-real-ip']) {
    const ip = req.headers['x-real-ip'].trim();
    if (ip) return ip;
  }
  if (req.headers['cf-connecting-ip']) {
    return req.headers['cf-connecting-ip'].trim();
  }
  if (req.ip) return req.ip;
  if (req.connection && req.connection.remoteAddress) return req.connection.remoteAddress;
  if (req.socket && req.socket.remoteAddress) return req.socket.remoteAddress;
  return '';
}

module.exports = { getClientIp };
