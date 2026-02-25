# AGM Corporate Library — Cloudflare Deployment Guide

A secure document management portal built on Cloudflare Pages, D1, R2, and Zero Trust.

---

## Architecture

| Layer | Service | Purpose |
|-------|---------|---------|
| Frontend | Cloudflare Pages | Hosts `index.html` |
| API | Pages Functions | REST API (`/functions/api/`) |
| Database | D1 (SQLite) | Document metadata, folder structure |
| Storage | R2 | Actual file storage |
| Auth | Zero Trust / Access | SSO, identity, access control |

---

## Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed: `npm install -g wrangler`
- Wrangler authenticated: `wrangler login`
- GitHub repository with this project

---

## Step 1 — Create a D1 Database

```bash
wrangler d1 create agm-library
```

Copy the `database_id` from the output and paste it into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "agm-library"
database_id = "PASTE_YOUR_DATABASE_ID_HERE"
```

Then run the schema to create tables and seed default folders:

```bash
wrangler d1 execute agm-library --file=schema.sql
```

---

## Step 2 — Create an R2 Bucket

```bash
wrangler r2 bucket create agm-documents
```

This matches the bucket name already in `wrangler.toml`. If you use a different name, update:

```toml
[[r2_buckets]]
binding = "DOCUMENTS_BUCKET"
bucket_name = "agm-documents"   # ← change this if needed
```

> **CORS for R2** — If you need presigned URL downloads to work cross-origin, run:
> ```bash
> wrangler r2 bucket cors put agm-documents --rules '[{"allowedOrigins":["*"],"allowedMethods":["GET"],"maxAgeSeconds":3600}]'
> ```

---

## Step 3 — Deploy to Cloudflare Pages

### Option A — GitHub Integration (Recommended)

1. Push this project to a GitHub repository
2. Go to [Cloudflare Dashboard → Pages](https://dash.cloudflare.com/?to=/:account/pages)
3. Click **"Create a project"** → **"Connect to Git"**
4. Select your repository
5. Build settings:
   - **Framework preset:** None
   - **Build command:** *(leave blank)*
   - **Build output directory:** `.`
6. Click **"Save and Deploy"**

After the first deploy, go to **Settings → Functions → D1 database bindings** and add:
- Variable name: `DB`
- D1 database: `agm-library`

Go to **Settings → Functions → R2 bucket bindings** and add:
- Variable name: `DOCUMENTS_BUCKET`
- R2 bucket: `agm-documents`

Then trigger a new deploy for bindings to take effect.

### Option B — Wrangler Direct Deploy

```bash
wrangler pages deploy . --project-name=agm-corporate-library
```

---

## Step 4 — Configure Zero Trust Authentication

This locks the portal so only authorized users can access it.

### 4a — Enable Cloudflare Zero Trust

1. Go to [Cloudflare Zero Trust](https://one.dash.cloudflare.com/)
2. Create a new Zero Trust organization (free tier available)

### 4b — Create an Access Application

1. In Zero Trust Dashboard → **Access → Applications**
2. Click **"Add an application"** → **"Self-hosted"**
3. Configure:
   - **Application name:** AGM Corporate Library
   - **Application domain:** `your-pages-subdomain.pages.dev` (or your custom domain)
   - **Session duration:** 8 hours (or as required)
4. Under **"Policies"**, create an Allow policy:
   - **Policy name:** AGM Team
   - **Action:** Allow
   - **Include rule:** Emails ending in `@yourdomain.com` (or specific email list)
5. Save the application

### 4c — What Happens After Configuration

- Unauthenticated visitors see a Cloudflare Access login page
- After authentication, Cloudflare injects `Cf-Access-Authenticated-User-Email` header into every request
- The `/api/auth/me` endpoint reads this header and returns user info to the frontend
- The user's name and initials automatically appear in the sidebar

---

## Step 5 — Custom Domain (Optional)

1. In Pages → your project → **Custom domains**
2. Add your domain (e.g., `library.agmrealestate.com`)
3. Update your DNS CNAME to point to `<project>.pages.dev`
4. Update the Zero Trust Application domain to match

---

## Local Development

For local testing (without CF Access auth):

```bash
# Install dependencies
npm install -g wrangler

# Start local dev server with D1 and R2 emulation
wrangler pages dev . --d1=DB:agm-library --r2=DOCUMENTS_BUCKET:agm-documents

# The app will be at http://localhost:8788
# Auth headers won't be present locally — the app falls back gracefully
```

To seed local D1:
```bash
wrangler d1 execute agm-library --local --file=schema.sql
```

---

## File Structure

```
agm-corporate-library/
├── index.html                          ← Main frontend (Pages-hosted)
├── schema.sql                          ← D1 database schema + seed data
├── wrangler.toml                       ← Cloudflare configuration
├── functions/
│   ├── _shared/
│   │   └── utils.js                   ← Shared CORS / auth helpers
│   └── api/
│       ├── auth/
│       │   └── me.js                  ← GET /api/auth/me
│       ├── folders/
│       │   ├── index.js               ← GET/POST /api/folders
│       │   └── [id]/
│       │       └── subfolders.js      ← POST/DELETE /api/folders/:id/subfolders
│       └── documents/
│           ├── index.js               ← GET/POST /api/documents
│           └── [id].js                ← GET/PATCH/DELETE /api/documents/:id
└── README.md
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/auth/me` | Returns authenticated user info |
| `GET` | `/api/folders` | List all folders |
| `POST` | `/api/folders` | Create a folder |
| `POST` | `/api/folders/:id/subfolders` | Add a subfolder |
| `DELETE` | `/api/folders/:id/subfolders` | Remove a subfolder |
| `GET` | `/api/documents` | List all documents (filterable) |
| `POST` | `/api/documents` | Upload a document (multipart) |
| `GET` | `/api/documents/:id` | Get document + R2 presigned URL |
| `PATCH` | `/api/documents/:id` | Update favorite/notes |
| `DELETE` | `/api/documents/:id` | Delete document from R2 + D1 |

---

## Troubleshooting

**Blank page after deploy**
- Check that D1 and R2 bindings are set under Pages → Settings → Functions
- Redeploy after adding bindings

**"Failed to load folders" error**
- Confirm D1 database_id in `wrangler.toml` is correct
- Confirm schema.sql was applied: `wrangler d1 execute agm-library --command="SELECT * FROM folders"`

**Upload fails**
- Check that R2 bucket name matches `wrangler.toml`
- File size limit is 25MB (enforced in frontend + Cloudflare's 100MB limit)

**Auth not working**
- Verify the Zero Trust Application domain matches your Pages URL exactly
- Check that the Access policy includes your email domain
