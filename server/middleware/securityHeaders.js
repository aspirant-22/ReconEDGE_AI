/**
 * Lightweight HTTP security headers for a JSON-only API.
 *
 * Kept deliberately minimal and universally safe so it cannot interfere with
 * the separately-hosted Vite/React SPA, React routing, or CORS/API calls.
 * A strict Content-Security-Policy is intentionally NOT emitted here: this
 * server returns only JSON (no HTML/scripts), so a CSP would provide no
 * protection and could break the SPA if it were ever served through Express.
 */
function securityHeaders(req, res, next) {
  // Prevent MIME-type sniffing (JSON served with correct content type).
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Deny framing / clickjacking for any HTML-ish browser responses.
  res.setHeader('X-Frame-Options', 'DENY');
  // Do not leak the referring URL to third parties.
  res.setHeader('Referrer-Policy', 'no-referrer');

  next();
}

module.exports = { securityHeaders };
