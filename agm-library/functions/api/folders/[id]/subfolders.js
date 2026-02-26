// functions/api/folders/[id]/subfolders.js
// POST   /api/folders/:id/subfolders  → add a subfolder name
// DELETE /api/folders/:id/subfolders  → remove a subfolder name

import { jsonResponse, errorResponse, handleOptions } from '../../../_shared/utils.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestPost({ params, request, env }) {
  try {
    const folderId = params.id;
    const body = await request.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return errorResponse('Subfolder name is required');
    }

    const folder = await env.DB.prepare('SELECT * FROM folders WHERE id = ?').bind(folderId).first();
    if (!folder) return errorResponse('Folder not found', 404);

    const subcategories = JSON.parse(folder.subcategories || '[]');

    if (subcategories.includes(name.trim())) {
      return errorResponse('A subfolder with that name already exists');
    }

    subcategories.push(name.trim());

    await env.DB.prepare('UPDATE folders SET subcategories = ? WHERE id = ?')
      .bind(JSON.stringify(subcategories), folderId)
      .run();

    return jsonResponse({
      subfolder: name.trim(),
      subcategories,
      message: `Subfolder "${name.trim()}" created`
    }, 201);
  } catch (err) {
    console.error('POST /api/folders/:id/subfolders error:', err);
    return errorResponse('Failed to create subfolder', 500);
  }
}

export async function onRequestDelete({ params, request, env }) {
  try {
    const folderId = params.id;
    const body = await request.json();
    const { name } = body;

    if (!name) return errorResponse('Subfolder name is required');

    const folder = await env.DB.prepare('SELECT * FROM folders WHERE id = ?').bind(folderId).first();
    if (!folder) return errorResponse('Folder not found', 404);

    const subcategories = JSON.parse(folder.subcategories || '[]').filter(s => s !== name);

    await env.DB.prepare('UPDATE folders SET subcategories = ? WHERE id = ?')
      .bind(JSON.stringify(subcategories), folderId)
      .run();

    return jsonResponse({ subcategories, message: `Subfolder "${name}" removed` });
  } catch (err) {
    console.error('DELETE /api/folders/:id/subfolders error:', err);
    return errorResponse('Failed to remove subfolder', 500);
  }
}
