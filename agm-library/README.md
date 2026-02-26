# AGM Corporate Library — Deployment Guide

A secure document management portal built on Cloudflare Pages, D1, R2, and Zero Trust. No CLI or npm installs required — everything is configured through the Cloudflare Dashboard.

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

## File Structure

```
agm-corporate-library/
├── index.html
├── schema.sql
├── wrangler.toml
├── functions/
│   ├── _shared/
│   │   └── utils.js
│   └── api/
│       ├── auth/
│       │   └── me.js
│       ├── folders/
│       │   ├── index.js
│       │   └── [id]/
│       │       └── subfolders.js
│       └── documents/
│           ├── index.js
│           └── [id].js
└── README.md
```

---

## Step 1 — Create a D1 Database

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages → D1**
2. Click **"Create database"**
3. Name it `agm-library` → click **"Create"**
4. Copy the **Database ID** shown on the database page
5. Open `wrangler.toml` and replace `REPLACE_WITH_YOUR_D1_DATABASE_ID` with the ID you copied

### Apply the Schema

1. In the D1 dashboard, click your `agm-library` database
2. Click the **"Console"** tab
3. Open `schema.sql`, copy the entire contents, and paste it into the console
4. Click **"Execute"**

This creates the `folders` and `documents` tables and seeds the four default folders.

---

## Step 2 — Create an R2 Bucket

1. Go to **Cloudflare Dashboard → R2**
2. Click **"Create bucket"**
3. Name it exactly `agm-documents` → click **"Create bucket"**

---

## Step 3 — Deploy to Cloudflare Pages

1. Push this project to a GitHub repository
2. Go to **Cloudflare Dashboard → Workers & Pages → Pages**
3. Click **"Create a project"** → **"Connect to Git"**
4. Authorize Cloudflare and select your repository
5. Configure build settings:
   - **Framework preset:** None
   - **Build command:** *(leave blank)*
   - **Build output directory:** `.`
6. Click **"Save and Deploy"**

Cloudflare will deploy and give you a URL like `https://agm-corporate-library.pages.dev`.

---

## Step 4 — Add D1 and R2 Bindings

The database and storage bucket need to be connected to your Pages project. Bindings only take effect after a redeploy.

1. Go to your Pages project → **Settings → Functions**
2. Scroll to **"D1 database bindings"** → click **"Add binding"**
   - Variable name: `DB`
   - D1 database: `agm-library`
3. Scroll to **"R2 bucket bindings"** → click **"Add binding"**
   - Variable name: `DOCUMENTS_BUCKET`
   - R2 bucket: `agm-documents`
4. Go to **Deployments** → click **"Retry deploy"** on the latest deployment

---

## Step 5 — Configure Zero Trust Authentication

This locks the portal so only authorized users can access it.

### Enable Zero Trust

1. Go to [Cloudflare Zero Trust](https://one.dash.cloudflare.com/)
2. If this is your first time, create a Zero Trust organization — the free tier covers this use case

### Create an Access Application

1. In the Zero Trust dashboard → **Access → Applications**
2. Click **"Add an application"** → **"Self-hosted"**
3. Fill in:
   - **Application name:** AGM Corporate Library
   - **Application domain:** your Pages URL (e.g. `agm-corporate-library.pages.dev`)
   - **Session duration:** 8 hours
4. Click **"Next"** → create an Allow policy:
   - **Policy name:** AGM Team
   - **Action:** Allow
   - **Include rule:** Emails ending in `@yourdomain.com` — or list specific email addresses
5. Click **"Next"** → **"Add application"**

Once configured, anyone visiting the URL will see a Cloudflare login page. After they authenticate, their name and initials automatically appear in the sidebar.

---

## Step 6 — Custom Domain (Optional)

1. Go to your Pages project → **Custom domains** → **"Set up a custom domain"**
2. Enter your domain (e.g. `library.agmrealestate.com`)
3. Follow the DNS instructions to add a CNAME record pointing to your Pages URL
4. Update the Zero Trust Application domain to match the custom domain

---

## Troubleshooting

**Blank page or "Unable to connect to server" error**
- Confirm D1 and R2 bindings are set under Pages → Settings → Functions
- Make sure you redeployed after adding the bindings

**Documents not loading**
- Open the D1 console and run `SELECT * FROM folders` to confirm the schema applied correctly
- Check that the `database_id` in `wrangler.toml` matches your actual D1 database

**File uploads failing**
- Confirm the R2 bucket is named exactly `agm-documents`
- Files are limited to 25MB

**Users see a login loop**
- Verify the Zero Trust Application domain exactly matches your Pages URL (no trailing slash)
- Confirm the Access policy includes the user's email or domain

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/auth/me` | Returns authenticated user info from CF Access |
| `GET` | `/api/folders` | List all folders |
| `POST` | `/api/folders` | Create a folder |
| `POST` | `/api/folders/:id/subfolders` | Add a subfolder |
| `DELETE` | `/api/folders/:id/subfolders` | Remove a subfolder |
| `GET` | `/api/documents` | List documents (filterable by folder/subfolder) |
| `POST` | `/api/documents` | Upload a document to R2 |
| `GET` | `/api/documents/:id` | Get document metadata + presigned download URL |
| `PATCH` | `/api/documents/:id` | Update favorite status or notes |
| `DELETE` | `/api/documents/:id` | Delete document from R2 and D1 |
