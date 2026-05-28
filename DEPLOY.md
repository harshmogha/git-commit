# How to Upload to GitHub & Release

## Files to Upload (✅) vs Ignore (❌)

| Upload | Ignore |
|--------|--------|
| ✅ `main.js` | ❌ `node_modules/` |
| ✅ `preload.js` | ❌ `dist/` |
| ✅ `package.json` | ❌ `.env` (has your secrets) |
| ✅ `public/` (all files) | ❌ `*.exe` |
| ✅ `.env.example` | ❌ `*.blockmap` |
| ✅ `.gitignore` | ❌ `*.yml` (auto-generated) |
| ✅ `gitcommit.ico` | |
| ✅ `README.md` | |
| ✅ `TERMS.md` | |

The `.gitignore` file already handles this automatically.

---

## Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. **Repository name:** `git-commit`
3. **Visibility:** Public
4. **Do NOT** add README or .gitignore (you already have them)
5. Click **"Create repository"**

---

## Step 2: Push Code to GitHub

Open terminal/PowerShell in `Git Upload` folder:

```bash
cd "D:\github - Copy\Git Upload"
git init
git add .
git commit -m "v1.0.0 - Git Commit by MIRA_FUTURE.AI"
git branch -M main
git remote add origin https://github.com/harshmogha/git-commit.git
git push -u origin main
```

---

## Step 3: Create a Release (for auto-updater to work)

### Option A: Automatic (recommended)

```bash
# Set your GitHub token (needs 'repo' scope)
set GH_TOKEN=ghp_your_token_here

# Build + auto-publish to GitHub Releases
npx electron-builder --win --publish always
```

This creates a release `v1.0.0` with the EXE automatically.

### Option B: Manual

1. Build locally:
   ```bash
   npx electron-builder --win
   ```

2. Go to https://github.com/harshmogha/git-commit/releases

3. Click **"Draft a new release"**

4. **Tag:** `v1.0.0`

5. **Title:** `Git - Commit v1.0.0`

6. **Description:**
   ```
   🚀 Initial Release — Git - Commit by MIRA_FUTURE.AI

   Features:
   - Secure GitHub upload via API
   - Profile analytics dashboard
   - Repository browser with file viewer
   - Clone repos with native folder picker
   - Git command reference with animations
   - OS Keychain token storage

   Download Git-Commit.exe below to install.
   ```

7. **Upload these files** from `dist/` folder:
   - `Git-Commit.exe` (the installer)
   - `latest.yml` (required for auto-updater)

8. Click **"Publish release"**

---

## Step 4: Share with Users

Share this link:
```
https://github.com/harshmogha/git-commit/releases/latest
```

Users download `Git-Commit.exe`, run it, accept Terms & Conditions, and install.

---

## Future Updates

When you want to release a new version:

1. Make your code changes

2. Update version in `package.json`:
   ```json
   "version": "1.1.0"
   ```

3. Commit and push:
   ```bash
   git add .
   git commit -m "v1.1.0 - description of changes"
   git push
   ```

4. Build and publish:
   ```bash
   set GH_TOKEN=ghp_your_token_here
   npx electron-builder --win --publish always
   ```

5. Users who have the app installed will see "Update available" in About page.

---

## Folder Structure on GitHub

```
git-commit/
├── main.js              ← Main process
├── preload.js           ← IPC bridge
├── package.json         ← Config + dependencies
├── .env.example         ← Template (no secrets)
├── .gitignore           ← Ignores node_modules, dist, .env
├── gitcommit.ico        ← App icon
├── README.md            ← Project documentation
├── TERMS.md             ← Legal terms
├── DEPLOY.md            ← This file
└── public/
    ├── index.html       ← UI
    ├── upload.js        ← Logic
    └── style.css        ← Styles
```

---

## Important Notes

- ⚠️ **Never push `.env`** — it contains your OAuth secrets
- ⚠️ **Never push `node_modules/`** — users run `npm install` themselves
- ⚠️ **Never push `dist/`** — EXEs go in GitHub Releases, not in the repo
- ✅ The `GH_TOKEN` is only needed on YOUR machine for publishing releases
- ✅ Users don't need any token to download and install the EXE
