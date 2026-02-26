// functions/api/documents/[id].js
// GET    /api/documents/:id          → fetch metadata + generate presigned R2 download URL
// PATCH  /api/documents/:id          → update favorite, notes
// DELETE /api/documents/:id          → delete from R2 + D1

import { jsonResponse, errorResponse, handleOptions } from '../../_shared/utils.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestGet({ params, env }) {
  try {
    const doc = await env.DB.prepare('SELECT * FROM documents WHERE id = ?')
      .bind(params.id)
      .first();

    if (!doc) return errorResponse('Document not found', 404);

    // Generate a presigned URL via R2 (valid 1 hour)
    let downloadUrl = null;
    try {
      const signedUrl = await env.DOCUMENTS_BUCKET.createSignedUrl(doc.r2_key, {
        expiresIn: 3600,
      });
      downloadUrl = signedUrl.url;
    } catch (_) {
      // R2 object may not exist; that's okay, return metadata only
    }

    return jsonResponse({
      document: {
        ...doc,
        tags: JSON.parse(doc.tags || '[]'),
        notes: JSON.parse(doc.notes || '[]'),
        favorite: doc.favorite === 1,
        downloadUrl,
      }
    });
  } catch (err) {
    console.error('GET /api/documents/:id error:', err);
    return errorResponse('Failed to fetch document', 500);
  }
}

export async function onRequestPatch({ params, request, env }) {
  try {
    const body = await request.json();
    const { favorite, notes } = body;

    const doc = await env.DB.prepare('SELECT * FROM documents WHERE id = ?')
      .bind(params.id)
      .first();
    if (!doc) return errorResponse('Document not found', 404);

    const updates = [];
    const values = [];

    if (typeof favorite === 'boolean') {
      updates.push('favorite = ?');
      values.push(favorite ? 1 : 0);
    }

    if (Array.isArray(notes)) {
      updates.push('notes = ?');
      values.push(JSON.stringify(notes));
    }

    if (updates.length === 0) {
      return errorResponse('Nothing to update');
    }

    values.push(params.id);
    await env.DB.prepare(`UPDATE documents SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    const updated = await env.DB.prepare('SELECT * FROM documents WHERE id = ?')
      .bind(params.id)
      .first();

    return jsonResponse({
      document: {
        ...updated,
        tags: JSON.parse(updated.tags || '[]'),
        notes: JSON.parse(updated.notes || '[]'),
        favorite: updated.favorite === 1,
      }
    });
  } catch (err) {
    console.error('PATCH /api/documents/:id error:', err);
    return errorResponse('Failed to update document', 500);
  }
}

export async function onRequestDelete({ params, env }) {
  try {
    const doc = await env.DB.prepare('SELECT * FROM documents WHERE id = ?')
      .bind(params.id)
      .first();
    if (!doc) return errorResponse('Document not found', 404);

    // Delete from R2
    try {
      await env.DOCUMENTS_BUCKET.delete(doc.r2_key);
    } catch (_) {
      // Continue even if R2 delete fails
    }

    // Delete from D1
    await env.DB.prepare('DELETE FROM documents WHERE id = ?').bind(params.id).run();

    return jsonResponse({ message: `"${doc.name}" deleted`, id: params.id });
  } catch (err) {
    console.error('DELETE /api/documents/:id error:', err);
    return errorResponse('Failed to delete document', 500);
  }
}
