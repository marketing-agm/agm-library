// functions/api/auth/me.js
// Returns the currently authenticated user from Cloudflare Access headers.

import { jsonResponse, handleOptions, getUser } from '../../_shared/utils.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestGet({ request }) {
  const user = getUser(request);
  return jsonResponse({ ...user, authenticated: true });
}
