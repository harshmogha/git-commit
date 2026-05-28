<h1 align="center">Git - Commit</h1>
<h3 align="center">🚀 Secure GitHub Desktop Client by MIRA_FUTURE.AI</h3>

<p align="center">
  <img src="https://readme-typing-svg.herokuapp.com/?lines=Upload+Files+to+GitHub;Clone+Repositories;View+Profile+Analytics;Secure+Token+Storage;No+Telemetry;Built+with+Electron&center=true&width=500&height=45&color=B84915">
</p>

---

# 🌐 About

<p align="center">
  <img src="https://img.shields.io/badge/MIRA__FUTURE.AI-000000?style=for-the-badge&logoColor=B84915"/>
  <img src="https://img.shields.io/badge/Version-1.0-B84915?style=for-the-badge"/>
  <img src="https://img.shields.io/badge/Platform-Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white"/>
  <img src="https://img.shields.io/badge/Security-OS%20Keychain-1F5A2E?style=for-the-badge&logo=shield&logoColor=white"/>
</p>

**Git - Commit** is a secure, local-first GitHub desktop client for uploading, cloning, and managing repositories. Built with privacy and simplicity in mind — no telemetry, no external servers, no data collection.

---

# 💫 Features

<table>
<tr>

<td width="50%">

<h3>👤 <span style="color:#B84915;">Profile Dashboard</span></h3>

<p>
Complete GitHub profile with analytics, activity charts, commit history, language breakdown, and repo stats.
</p>

</td>

<td width="50%">

<h3>📁 <span style="color:#B84915;">Repository Manager</span></h3>

<p>
Browse all repos with search & filters (public/private). Click to view file tree, code viewer, and repo analysis.
</p>

</td>

</tr>

<tr>

<td width="50%">

<h3>⬆️ <span style="color:#B84915;">Smart Upload</span></h3>

<p>
Upload files/folders to GitHub via API. .gitignore support, progress bar, branch creation, file size warnings.
</p>

</td>

<td width="50%">

<h3>📥 <span style="color:#B84915;">Clone Repos</span></h3>

<p>
Clone any repository with native folder picker. Supports full URLs and shorthand (owner/repo).
</p>

</td>

</tr>

<tr>

<td width="50%">

<h3>📖 <span style="color:#B84915;">Git CMD Reference</span></h3>

<p>
22 Git commands with descriptions, flags, and animated terminal examples. Searchable.
</p>

</td>

<td width="50%">

<h3>🔍 <span style="color:#B84915;">Repo Analysis</span></h3>

<p>
Health indicators, file type breakdown, directory size map, and code structure visualization.
</p>

</td>

</tr>

</table>

---

# 🔒 Security Architecture

<table>
<tr>
<th>Layer</th>
<th>Protection</th>
<th>Status</th>
</tr>
<tr>
<td>Token Storage</td>
<td>Windows Credential Manager (DPAPI encrypted)</td>
<td>✅</td>
</tr>
<tr>
<td>Process Isolation</td>
<td>Token only in main process, never in renderer/UI</td>
<td>✅</td>
</tr>
<tr>
<td>Context Isolation</td>
<td>contextIsolation: true — renderer cannot access Node.js</td>
<td>✅</td>
</tr>
<tr>
<td>IPC Bridge</td>
<td>Only whitelisted functions exposed via preload.js</td>
<td>✅</td>
</tr>
<tr>
<td>CSP Headers</td>
<td>Content Security Policy blocks external scripts</td>
<td>✅</td>
</tr>
<tr>
<td>No localStorage</td>
<td>Token never stored in browser storage</td>
<td>✅</td>
</tr>
<tr>
<td>No Telemetry</td>
<td>Zero analytics, zero tracking, zero external calls</td>
<td>✅</td>
</tr>
<tr>
<td>Network</td>
<td>Only communicates with api.github.com (HTTPS)</td>
<td>✅</td>
</tr>
<tr>
<td>Frameless Window</td>
<td>No browser chrome — no DevTools access for casual users</td>
<td>✅</td>
</tr>
</table>

### How Token Security Works

```
User enters PAT → IPC call to main process → Validated against GitHub API
                                            → Stored in Windows Credential Manager (encrypted)
                                            → Never crosses back to renderer
                                            → Loaded from keychain on next app start
                                            → Deleted from keychain on sign out
```

> **Same security model as GitHub Desktop, VS Code, and Git Credential Manager.**

---

# 💻 Tech Stack

<p align="center">
<img src="https://img.shields.io/badge/Electron-47848F?style=for-the-badge&logo=electron&logoColor=white"/>
<img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white"/>
<img src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white"/>
<img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white"/>
<img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white"/>
<img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black"/>
</p>

<p align="center">
<img src="https://img.shields.io/badge/GitHub%20REST%20API-181717?style=for-the-badge&logo=github&logoColor=white"/>
<img src="https://img.shields.io/badge/Keytar-OS%20Keychain-1F5A2E?style=for-the-badge"/>
<img src="https://img.shields.io/badge/electron--builder-47848F?style=for-the-badge"/>
</p>

---

# 🚀 Installation

### Prerequisites
- **Node.js 18+**
- **Git** (for clone feature)
- **Windows 10/11**

### Setup

```bash
git clone https://github.com/harshmogha/git-commit.git
cd git-commit
npm install
```

### Run

```bash
npm start
```

### Build EXE

```bash
npx electron-builder --win
```

Output in `dist/`:
- `Git - Commit Setup 1.0.0.exe` — Installer
- `Git - Commit Portable.exe` — Portable (no install needed)

---

# 📂 Project Structure

```
Git - Commit/
├── main.js              ← Electron main process + Express OAuth + IPC handlers
├── preload.js           ← Secure IPC bridge (token never crosses this)
├── package.json         ← Dependencies + build config
├── gitcommit.ico        ← App icon
├── .gitignore
└── public/
    ├── index.html       ← All pages (Profile, Repos, Upload, Clone, Git CMD, About)
    ├── upload.js        ← All page logic + upload flow + analysis
    └── style.css        ← Editorial/brutalist theme
```

---

# 📊 Pages

| Page | Description |
|------|-------------|
| **Profile** | Avatar, bio, stats, activity chart (30 days), languages, commits, account details |
| **Repositories** | Search + filter (All/Public/Private), click to view file tree + code viewer + analysis |
| **Upload** | Drag & drop, .gitignore support, progress bar, new branch, commit history preview |
| **Clone Repo** | Enter URL + select folder, terminal output |
| **Git CMD** | 22 commands with descriptions, flags, animated terminal examples |
| **About** | MIRA_FUTURE.AI branding, animated orb, terms & conditions |

---

# 🔐 Token Scopes Required

| Scope | Why |
|-------|-----|
| `repo` | Read/write repos, upload files, view private repos |
| `read:user` | Read profile info for sidebar and profile page |

---

# 🏆 Why Git - Commit?

| Feature | Git - Commit | GitHub Web | GitHub Desktop |
|---------|:---:|:---:|:---:|
| Upload without Git CLI | ✅ | ✅ | ❌ |
| Profile analytics | ✅ | ❌ | ❌ |
| Repo file viewer | ✅ | ✅ | ❌ |
| Repo analysis | ✅ | ❌ | ❌ |
| Git command reference | ✅ | ❌ | ❌ |
| No telemetry | ✅ | ❌ | ❌ |
| Portable EXE | ✅ | ❌ | ❌ |
| OS Keychain security | ✅ | N/A | ✅ |

---

# 🌐 Connect

<p align="center">
  <a href="https://www.instagram.com/mira_future.ai"><img src="https://img.shields.io/badge/Instagram-E4405F?style=for-the-badge&logo=instagram&logoColor=white"/></a>
  <a href="https://harshmogha.com"><img src="https://img.shields.io/badge/Portfolio-000000?style=for-the-badge&logo=vercel&logoColor=white"/></a>
  <a href="mailto:mirafeedport@gmail.com"><img src="https://img.shields.io/badge/Feedback-D14836?style=for-the-badge&logo=gmail&logoColor=white"/></a>
</p>

---

# 📄 License & Terms

This software is proprietary. By using Git - Commit, you agree to the [Terms and Conditions](TERMS.md) included in the application.

**© 2026 MIRA_FUTURE.AI · All rights reserved.**

---

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=0:1A1108,100:B84915&height=100&section=footer"/>
</p>
