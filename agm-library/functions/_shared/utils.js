// functions/_shared/utils.js
// Shared utilities for AGM Corporate Library API

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, CF-Access-Jwt-Assertion',
};

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

export function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

export function handleOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Extracts authenticated user info from Cloudflare Access headers.
 * CF Access injects these headers automatically when Zero Trust is configured.
 */
export function getUser(request) {
  const email = request.headers.get('Cf-Access-Authenticated-User-Email') || 'unknown@agm.local';
  const name = email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  // Derive initials
  const parts = name.split(' ');
  const initials = parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : name.slice(0, 2).toUpperCase();
  return { email, name, initials };
}
