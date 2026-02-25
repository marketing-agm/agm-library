// functions/api/folders/index.js
// GET  /api/folders        → list all folders
// POST /api/folders        → create a new folder

import { jsonResponse, errorResponse, handleOptions, getUser } from '../../_shared/utils.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM folders ORDER BY created_at ASC'
    ).all();

    // Parse subcategories JSON for each folder
    const folders = results.map(f => ({
      ...f,
      subcategories: JSON.parse(f.subcategories || '[]'),
    }));

    return jsonResponse({ folders });
  } catch (err) {
    console.error('GET /api/folders error:', err);
    return errorResponse('Failed to load folders', 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { title, description, icon, iconType } = body;

    if (!title || !title.trim()) {
      return errorResponse('Folder title is required');
    }

    const user = getUser(request);

    // Generate a URL-safe unique ID from the title
    const id = title.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();

    await env.DB.prepare(
      `INSERT INTO folders (id, title, description, icon, icon_type, subcategories, created_by)
       VALUES (?, ?, ?, ?, ?, '[]', ?)`
    ).bind(
      id,
      title.trim(),
      (description || `${title} documents and records`).trim(),
      icon || '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
      iconType || 'primary',
      user.email
    ).run();

    const folder = await env.DB.prepare('SELECT * FROM folders WHERE id = ?').bind(id).first();

    return jsonResponse({
      folder: { ...folder, subcategories: [] },
      message: `Folder "${title}" created`
    }, 201);
  } catch (err) {
    console.error('POST /api/folders error:', err);
    return errorResponse('Failed to create folder', 500);
  }
}
