-- AGM Corporate Library - D1 Database Schema
-- Run: wrangler d1 execute agm-library --file=schema.sql

CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT NOT NULL DEFAULT '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  icon_type TEXT DEFAULT 'primary',
  subcategories TEXT DEFAULT '[]',
  created_at INTEGER DEFAULT (unixepoch()),
  created_by TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  folder_id TEXT NOT NULL,
  subfolder TEXT DEFAULT '',
  file_type TEXT DEFAULT 'PDF',
  file_size INTEGER DEFAULT 0,
  tags TEXT DEFAULT '[]',
  favorite INTEGER DEFAULT 0,
  notes TEXT DEFAULT '[]',
  date_added TEXT DEFAULT (datetime('now')),
  added_by TEXT DEFAULT '',
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents(folder_id);
CREATE INDEX IF NOT EXISTS idx_documents_subfolder ON documents(folder_id, subfolder);
CREATE INDEX IF NOT EXISTS idx_documents_favorite ON documents(favorite);

-- Default folders
INSERT OR IGNORE INTO folders (id, title, description, icon, icon_type, subcategories) VALUES
  ('corporate', 'Corporate', 'Entity documents, governance, compliance, and executive records',
   '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
   'primary', '[]'),
  ('construction', 'Construction & Facilities', 'Construction, facilities, and infrastructure documentation',
   '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
   'primary', '[]'),
  ('management', 'Management', 'Management operations and administrative records',
   '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
   'dark', '[]'),
  ('marketing', 'Marketing & Business Development', 'Marketing assets, campaigns, and business development resources',
   '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
   'primary', '[]');
