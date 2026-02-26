// functions/api/documents/index.js
// GET  /api/documents              → list all documents (optional ?folder=id&subfolder=name)
// POST /api/documents              → upload a document to R2 + record in D1

import { jsonResponse, errorResponse, handleOptions, getUser } from '../../_shared/utils.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const folderId = url.searchParams.get('folder');
    const subfolder = url.searchParams.get('subfolder');

    let query = 'SELECT * FROM documents';
    const bindings = [];

    if (folderId && subfolder) {
      query += ' WHERE folder_id = ? AND subfolder = ?';
      bindings.push(folderId, subfolder);
    } else if (folderId) {
      query += ' WHERE folder_id = ?';
      bindings.push(folderId);
    }

    query += ' ORDER BY date_added DESC';

    const { results } = await env.DB.prepare(query).bind(...bindings).all();

    const documents = results.map(doc => ({
      ...doc,
      tags: JSON.parse(doc.tags || '[]'),
      notes: JSON.parse(doc.notes || '[]'),
      favorite: doc.favorite === 1,
    }));

    return jsonResponse({ documents });
  } catch (err) {
    console.error('GET /api/documents error:', err);
    return errorResponse('Failed to load documents', 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const user = getUser(request);
    const formData = await request.formData();

    const file = formData.get('file');
    const name = formData.get('name');
    const folderId = formData.get('folder');
    const subfolder = formData.get('subfolder') || '';
    const tagsRaw = formData.get('tags') || '';

    if (!file || !name || !folderId) {
      return errorResponse('file, name, and folder are required');
    }

    // Validate folder exists
    const folder = await env.DB.prepare('SELECT id FROM folders WHERE id = ?').bind(folderId).first();
    if (!folder) return errorResponse('Folder not found', 404);

    // File metadata
    const fileExtension = file.name.split('.').pop().toLowerCase();
    const fileType = fileExtension.toUpperCase();
    const fileSize = file.size;
    const timestamp = Date.now();

    // R2 object key: folder/subfolder/timestamp-filename
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const r2Key = subfolder
      ? `${folderId}/${subfolder.replace(/[^a-zA-Z0-9._-]/g, '_')}/${timestamp}-${safeFilename}`
      : `${folderId}/${timestamp}-${safeFilename}`;

    // Upload to R2
    await env.DOCUMENTS_BUCKET.put(r2Key, file.stream(), {
      httpMetadata: {
        contentType: file.type || 'application/octet-stream',
        contentDisposition: `attachment; filename="${file.name}"`,
      },
      customMetadata: {
        uploadedBy: user.email,
        originalName: file.name,
      },
    });

    // Parse tags
    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

    // Insert into D1
    const result = await env.DB.prepare(
      `INSERT INTO documents (name, r2_key, folder_id, subfolder, file_type, file_size, tags, added_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      name.trim(),
      r2Key,
      folderId,
      subfolder,
      fileType,
      fileSize,
      JSON.stringify(tags),
      user.email
    ).run();

    const newDoc = await env.DB.prepare('SELECT * FROM documents WHERE rowid = ?')
      .bind(result.meta.last_row_id)
      .first();

    return jsonResponse({
      document: {
        ...newDoc,
        tags: JSON.parse(newDoc.tags || '[]'),
        notes: JSON.parse(newDoc.notes || '[]'),
        favorite: false,
      },
      message: `"${name}" uploaded successfully`
    }, 201);
  } catch (err) {
    console.error('POST /api/documents error:', err);
    return errorResponse('Failed to upload document: ' + err.message, 500);
  }
}
