// ══════════════════════════════════════════════════
// Git MIRA — Upload Logic (Renderer)
// Token NEVER exists here. All API calls go through IPC to main process.
// ══════════════════════════════════════════════════

let selectedFiles = [];

// ── Window Controls ──
document.getElementById('btn-min').onclick = () => window.gitCommit.winMinimize();
document.getElementById('btn-max').onclick = () => window.gitCommit.winMaximize();
document.getElementById('btn-close').onclick = () => window.gitCommit.winClose();

// ── Page Navigation ──
document.querySelectorAll('.nav-item[data-page]').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.getElementById('page-' + item.dataset.page).style.display = 'block';
    if (item.dataset.page === 'profile') loadProfile();
    if (item.dataset.page === 'repos') loadRepos();
    if (item.dataset.page === 'gitcmd') loadGitCmd();
  });
});

// ── Clone Repo Page ──
document.getElementById('clone-browse').addEventListener('click', async () => {
  const folder = await window.gitCommit.selectFolder();
  if (folder) document.getElementById('clone-path').value = folder;
  checkCloneReady();
});
document.getElementById('clone-url').addEventListener('input', checkCloneReady);

function checkCloneReady() {
  const url = document.getElementById('clone-url').value.trim();
  const path = document.getElementById('clone-path').value.trim();
  document.getElementById('clone-btn').disabled = !(url && path);
}

document.getElementById('clone-btn').addEventListener('click', async () => {
  let url = document.getElementById('clone-url').value.trim();
  const dest = document.getElementById('clone-path').value.trim();
  if (!url || !dest) return;

  // Normalize: owner/repo → https://github.com/owner/repo.git
  if (!url.startsWith('http') && !url.startsWith('git@')) {
    url = `https://github.com/${url}.git`;
  }

  const repoName = url.split('/').pop().replace('.git', '');
  const fullDest = dest + '\\' + repoName;

  const terminal = document.getElementById('clone-terminal');
  const body = document.getElementById('clone-terminal-body');
  terminal.style.display = 'block';
  body.innerHTML = '';
  document.getElementById('clone-btn').disabled = true;

  function log(text, cls) { const d = document.createElement('div'); d.className = cls || ''; d.textContent = text; body.appendChild(d); body.scrollTop = body.scrollHeight; }

  log(`$ git clone ${url}`, 'cmd');
  log(`Destination: ${fullDest}`, 'info');
  log('Cloning...', 'progress');

  try {
    const result = await window.gitCommit.cloneRepo(url, fullDest);
    log(result, 'info');
    log('✓ Clone complete!', 'success');
  } catch (e) {
    log('✕ ' + e.message, 'error');
  }
  document.getElementById('clone-btn').disabled = false;
});

async function loadProfile() {
  const user = await window.gitCommit.getUser();
  const repos = await window.gitCommit.getRepos();

  // Language stats
  const langs = {};
  repos.forEach(r => { if (r.language) langs[r.language] = (langs[r.language] || 0) + 1; });
  const topLangs = Object.entries(langs).sort((a,b) => b[1] - a[1]).slice(0, 8);

  // Repo analytics
  const totalStars = repos.reduce((s, r) => s + r.stargazers_count, 0);
  const totalForks = repos.reduce((s, r) => s + r.forks_count, 0);
  const totalIssues = repos.reduce((s, r) => s + r.open_issues_count, 0);
  const totalSize = repos.reduce((s, r) => s + r.size, 0);
  const publicRepos = repos.filter(r => !r.private);
  const privateRepos = repos.filter(r => r.private);
  const forkedRepos = repos.filter(r => r.fork);
  const archivedRepos = repos.filter(r => r.archived);
  const recentRepos = repos.slice(0, 5);
  const mostStarred = [...repos].sort((a,b) => b.stargazers_count - a.stargazers_count).slice(0, 5);
  const largestRepos = [...repos].sort((a,b) => b.size - a.size).slice(0, 5);

  // Events
  let events = [];
  try { events = await window.gitCommit.ghApi(`/users/${user.login}/events?per_page=100`); } catch {}
  const pushEvents = events.filter(e => e.type === 'PushEvent');
  const commits = [];
  pushEvents.forEach(e => { (e.payload.commits || []).forEach(c => { commits.push({ msg: c.message, repo: e.repo.name, date: e.created_at, sha: c.sha }); }); });

  // Activity chart (30 days)
  const dayCounts = {};
  const today = new Date();
  for (let i = 29; i >= 0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); dayCounts[d.toISOString().slice(0,10)] = 0; }
  events.forEach(e => { const day = e.created_at.slice(0,10); if (dayCounts[day] !== undefined) dayCounts[day]++; });
  const dayEntries = Object.entries(dayCounts);
  const maxEvents = Math.max(...dayEntries.map(d => d[1]), 1);

  // Advanced: weekday, hour, streak
  const weekdayCounts = [0,0,0,0,0,0,0];
  const hourCounts = Array(24).fill(0);
  events.forEach(e => { const d = new Date(e.created_at); weekdayCounts[d.getDay()]++; hourCounts[d.getHours()]++; });
  let streak = 0;
  for (let i = dayEntries.length - 1; i >= 0; i--) { if (dayEntries[i][1] > 0) streak++; else break; }
  const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const peakDay = weekdays[weekdayCounts.indexOf(Math.max(...weekdayCounts))];
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
  const maxHour = Math.max(...hourCounts, 1);
  const maxWeekday = Math.max(...weekdayCounts, 1);
  const activeDays = dayEntries.filter(d => d[1] > 0).length;
  const avgPerDay = (events.length / 30).toFixed(1);

  // Event breakdown
  const typeCounts = {};
  events.forEach(e => { typeCounts[e.type] = (typeCounts[e.type] || 0) + 1; });
  const topTypes = Object.entries(typeCounts).sort((a,b) => b[1] - a[1]).slice(0, 6);

  // Created per year
  const yearCounts = {};
  repos.forEach(r => { const y = new Date(r.created_at).getFullYear(); yearCounts[y] = (yearCounts[y] || 0) + 1; });
  const yearEntries = Object.entries(yearCounts).sort((a,b) => a[0] - b[0]);

  const blogLink = user.blog ? (user.blog.startsWith('http') ? user.blog : 'https://' + user.blog) : '';

  document.getElementById('profile-content').innerHTML = `
    <div class="profile-card">
      <img src="${user.avatar_url}" class="profile-avatar">
      <div class="profile-info">
        <h2 class="profile-name">${user.name || user.login}</h2>
        <div class="profile-login">@${user.login}</div>
        ${user.bio ? `<div class="profile-bio">${user.bio}</div>` : ''}
        <div class="profile-meta">
          ${user.location ? `<span>📍 ${user.location}</span>` : ''}
          ${blogLink ? `<span>🔗 <a href="#" onclick="window.gitCommit.openExternal('${blogLink}');return false;">${user.blog}</a></span>` : ''}
          ${user.company ? `<span>🏢 ${user.company}</span>` : ''}
          ${user.twitter_username ? `<span>🐦 @${user.twitter_username}</span>` : ''}
          <span>📅 Joined ${new Date(user.created_at).toLocaleDateString('en', { month: 'short', year: 'numeric' })}</span>
        </div>
        <div class="profile-stats">
          <div><div class="stat-value">${user.public_repos}</div><div class="stat-label">Repos</div></div>
          <div><div class="stat-value">${user.followers}</div><div class="stat-label">Followers</div></div>
          <div><div class="stat-value">${user.following}</div><div class="stat-label">Following</div></div>
          <div><div class="stat-value">${totalStars}</div><div class="stat-label">Stars</div></div>
          <div><div class="stat-value">${totalForks}</div><div class="stat-label">Forks</div></div>
          <div><div class="stat-value">${commits.length}</div><div class="stat-label">Commits</div></div>
        </div>
      </div>
    </div>

    <!-- QUICK STATS -->
    <div class="quick-stats">
      <div class="quick-stat"><span class="qs-value">${publicRepos.length}</span><span class="qs-label">Public</span></div>
      <div class="quick-stat"><span class="qs-value">${privateRepos.length}</span><span class="qs-label">Private</span></div>
      <div class="quick-stat"><span class="qs-value">${forkedRepos.length}</span><span class="qs-label">Forked</span></div>
      <div class="quick-stat"><span class="qs-value">${archivedRepos.length}</span><span class="qs-label">Archived</span></div>
      <div class="quick-stat"><span class="qs-value">${totalIssues}</span><span class="qs-label">Open Issues</span></div>
      <div class="quick-stat"><span class="qs-value">${Math.round(totalSize/1024)} MB</span><span class="qs-label">Total Size</span></div>
      <div class="quick-stat"><span class="qs-value">${Object.keys(langs).length}</span><span class="qs-label">Languages</span></div>
      <div class="quick-stat"><span class="qs-value">${events.length}</span><span class="qs-label">Events (recent)</span></div>
    </div>

    <!-- ACTIVITY CHART -->
    <div class="profile-section" style="margin-top:18px;">
      <h3 class="section-title">Activity · Last 30 Days</h3>
      <div class="activity-highlights">
        <div class="ah-item"><span class="ah-value">${streak}</span><span class="ah-label">Day Streak</span></div>
        <div class="ah-item"><span class="ah-value">${activeDays}/30</span><span class="ah-label">Active Days</span></div>
        <div class="ah-item"><span class="ah-value">${avgPerDay}</span><span class="ah-label">Avg/Day</span></div>
        <div class="ah-item"><span class="ah-value">${peakDay}</span><span class="ah-label">Peak Day</span></div>
        <div class="ah-item"><span class="ah-value">${peakHour}:00</span><span class="ah-label">Peak Hour</span></div>
      </div>
      <div class="activity-chart">
        ${dayEntries.map(([day, count]) => `<div class="chart-bar-wrap" title="${day}: ${count} events"><div class="chart-bar" style="height:${Math.round(count / maxEvents * 100)}%"></div><div class="chart-day">${new Date(day).getDate()}</div></div>`).join('')}
      </div>
      <div class="chart-summary">
        <span>${events.length} events</span>
        <span>${pushEvents.length} pushes</span>
        <span>${commits.length} commits</span>
      </div>

      <div class="activity-sub-sections">
        <div class="activity-sub">
          <div class="sub-title">By Weekday</div>
          <div class="weekday-chart">
            ${weekdays.map((d, i) => `<div class="wd-bar-wrap"><div class="wd-bar" style="height:${Math.round(weekdayCounts[i] / maxWeekday * 100)}%"></div><div class="wd-label">${d}</div></div>`).join('')}
          </div>
        </div>
        <div class="activity-sub">
          <div class="sub-title">By Hour</div>
          <div class="hour-chart">
            ${hourCounts.map((c, i) => `<div class="hr-bar-wrap" title="${i}:00 — ${c} events"><div class="hr-bar" style="height:${Math.round(c / maxHour * 100)}%"></div></div>`).join('')}
          </div>
          <div class="hour-labels"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span></div>
        </div>
      </div>
    </div>

    <div class="profile-sections">
      <!-- LANGUAGES -->
      <div class="profile-section">
        <h3 class="section-title">Languages Used</h3>
        <div class="lang-list">
          ${topLangs.map(([lang, count]) => `
            <div class="lang-item">
              <span class="lang-name">${lang}</span>
              <div class="lang-bar-bg"><div class="lang-bar" style="width:${Math.round(count / repos.length * 100)}%"></div></div>
              <span class="lang-count">${count} (${Math.round(count / repos.length * 100)}%)</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- EVENT BREAKDOWN -->
      <div class="profile-section">
        <h3 class="section-title">Event Breakdown</h3>
        <div class="lang-list">
          ${topTypes.map(([type, count]) => `
            <div class="lang-item">
              <span class="lang-name">${type.replace('Event','')}</span>
              <div class="lang-bar-bg"><div class="lang-bar" style="width:${Math.round(count / events.length * 100)}%"></div></div>
              <span class="lang-count">${count}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <div class="profile-sections" style="margin-top:18px;">
      <!-- MOST STARRED -->
      <div class="profile-section">
        <h3 class="section-title">Most Starred Repos</h3>
        <div class="recent-repos">
          ${mostStarred.map(r => `
            <div class="recent-repo-item">
              <span class="recent-repo-name">${r.name}</span>
              <span class="recent-repo-lang">${r.language || ''}</span>
              <span class="recent-repo-stars">★ ${r.stargazers_count}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- LARGEST REPOS -->
      <div class="profile-section">
        <h3 class="section-title">Largest Repos (by size)</h3>
        <div class="recent-repos">
          ${largestRepos.map(r => `
            <div class="recent-repo-item">
              <span class="recent-repo-name">${r.name}</span>
              <span class="recent-repo-lang">${r.language || ''}</span>
              <span class="recent-repo-stars">${r.size > 1024 ? Math.round(r.size/1024)+'MB' : r.size+'KB'}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <div class="profile-sections" style="margin-top:18px;">
      <!-- REPOS PER YEAR -->
      <div class="profile-section">
        <h3 class="section-title">Repos Created Per Year</h3>
        <div class="lang-list">
          ${yearEntries.map(([year, count]) => `
            <div class="lang-item">
              <span class="lang-name">${year}</span>
              <div class="lang-bar-bg"><div class="lang-bar" style="width:${Math.round(count / Math.max(...yearEntries.map(e=>e[1])) * 100)}%"></div></div>
              <span class="lang-count">${count}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- PUBLIC vs PRIVATE PIE -->
      <div class="profile-section">
        <h3 class="section-title">Repo Visibility</h3>
        <div class="visibility-stats">
          <div class="vis-bar">
            <div class="vis-public" style="width:${Math.round(publicRepos.length / repos.length * 100)}%"></div>
          </div>
          <div class="vis-legend">
            <span><span class="vis-dot vis-dot-public"></span>Public: ${publicRepos.length} (${Math.round(publicRepos.length / repos.length * 100)}%)</span>
            <span><span class="vis-dot vis-dot-private"></span>Private: ${privateRepos.length} (${Math.round(privateRepos.length / repos.length * 100)}%)</span>
          </div>
        </div>
      </div>
    </div>

    <!-- RECENT COMMITS -->
    <div class="profile-section" style="margin-top:18px;">
      <h3 class="section-title">Recent Commits</h3>
      <div class="commit-list">
        ${commits.slice(0, 20).map(c => `
          <div class="commit-row">
            <span class="commit-sha">${c.sha.slice(0,7)}</span>
            <span class="commit-msg">${c.msg.split('\n')[0]}</span>
            <span class="commit-repo">${c.repo.split('/')[1]}</span>
            <span class="commit-date">${timeAgo(c.date)}</span>
          </div>
        `).join('') || '<div style="padding:12px;color:var(--ink-3);font-size:12px;">No recent commits.</div>'}
      </div>
    </div>

    <!-- ACCOUNT DETAILS -->
    <div class="profile-section" style="margin-top:18px;">
      <h3 class="section-title">Account Details</h3>
      <div class="details-grid">
        <div class="detail-item"><span class="detail-label">User ID</span><span class="detail-value">${user.id}</span></div>
        <div class="detail-item"><span class="detail-label">Type</span><span class="detail-value">${user.type}</span></div>
        <div class="detail-item"><span class="detail-label">Disk Usage</span><span class="detail-value">${user.disk_usage ? Math.round(user.disk_usage / 1024) + ' MB' : 'N/A'}</span></div>
        <div class="detail-item"><span class="detail-label">Plan</span><span class="detail-value">${user.plan?.name || 'Free'}</span></div>
        <div class="detail-item"><span class="detail-label">2FA</span><span class="detail-value">${user.two_factor_authentication ? '✓ Enabled' : '✕ Disabled'}</span></div>
        <div class="detail-item"><span class="detail-label">Profile</span><span class="detail-value"><a href="#" onclick="window.gitCommit.openExternal('${user.html_url}');return false;">Open on GitHub ↗</a></span></div>
      </div>
    </div>`;
}

function timeAgo(iso) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  const intervals = [[31536000,'y'],[2592000,'mo'],[604800,'w'],[86400,'d'],[3600,'h'],[60,'m']];
  for (const [secs, label] of intervals) {
    const v = Math.floor(seconds / secs);
    if (v >= 1) return `${v}${label} ago`;
  }
  return 'now';
}

let allRepos = [];
let currentFilter = 'all';

async function loadRepos() {
  if (!allRepos.length) allRepos = await window.gitCommit.getRepos();
  applyRepoFilters();

  document.getElementById('repo-search').oninput = () => applyRepoFilters();
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      applyRepoFilters();
    };
  });
}

function applyRepoFilters() {
  const q = (document.getElementById('repo-search').value || '').toLowerCase();
  let filtered = allRepos;
  if (currentFilter === 'public') filtered = filtered.filter(r => !r.private);
  else if (currentFilter === 'private') filtered = filtered.filter(r => r.private);
  if (q) filtered = filtered.filter(r => r.name.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q) || (r.language || '').toLowerCase().includes(q));
  renderRepos(filtered);
}

function renderRepos(repos) {
  document.getElementById('repo-count').textContent = repos.length + ' repos';
  document.getElementById('repos-grid').innerHTML = repos.map((r, i) => `
    <div class="repo-card" data-owner="${r.owner.login}" data-repo="${r.name}" style="cursor:pointer">
      <div class="repo-card-header">
        <span class="repo-name">${r.name}</span>
        <span class="repo-tag">${r.visibility}</span>
      </div>
      <div class="repo-desc">${r.description || '<span style="opacity:0.4">No description</span>'}</div>
      <div class="repo-meta">
        ${r.language ? `<span>${r.language}</span>` : ''}
        <span>★ ${r.stargazers_count}</span>
        <span>⑂ ${r.forks_count}</span>
        <span>⚠ ${r.open_issues_count}</span>
        <span>${r.size > 1024 ? Math.round(r.size/1024)+'MB' : r.size+'KB'}</span>
      </div>
    </div>
  `).join('') || '<div style="color:var(--ink-3)">No repositories found.</div>';

  document.querySelectorAll('.repo-card[data-owner]').forEach(card => {
    card.addEventListener('click', () => {
      openRepoDetail(card.dataset.owner, card.dataset.repo);
    });
  });
}

// ── Repo Detail View ──
async function openRepoDetail(owner, repo) {
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  document.getElementById('page-repo-detail').style.display = 'block';
  const detail = document.getElementById('repo-detail-content');
  detail.innerHTML = '<div style="padding:40px;text-align:center;color:var(--ink-3);font-family:var(--mono);">Loading repository...</div>';

  try {
    const info = await window.gitCommit.ghApi(`/repos/${owner}/${repo}`);
    const [tree, langs, commits] = await Promise.all([
      window.gitCommit.ghApi(`/repos/${owner}/${repo}/git/trees/${info.default_branch}?recursive=1`).catch(() => ({tree:[]})),
      window.gitCommit.ghApi(`/repos/${owner}/${repo}/languages`).catch(() => ({})),
      window.gitCommit.ghApi(`/repos/${owner}/${repo}/commits?per_page=10`).catch(() => [])
    ]);

    const files = tree.tree ? tree.tree.filter(t => t.type === 'blob') : [];
    const dirs = tree.tree ? tree.tree.filter(t => t.type === 'tree') : [];

    // Language breakdown
    const totalBytes = Object.values(langs).reduce((s, v) => s + v, 0) || 1;
    const langEntries = Object.entries(langs).sort((a,b) => b[1] - a[1]);

    // File extensions
    const exts = {};
    files.forEach(f => { const ext = f.path.split('.').pop().toLowerCase(); exts[ext] = (exts[ext] || 0) + 1; });
    const topExts = Object.entries(exts).sort((a,b) => b[1] - a[1]).slice(0, 10);

    // Build file tree HTML
    const fileTreeHtml = buildFileTree(tree.tree || []);

    detail.innerHTML = `
      <div style="margin-bottom:16px;display:flex;gap:8px;">
        <button class="btn" id="btn-back-repos">← Back to Repositories</button>
        <button class="btn" id="btn-repo-gh">View on GitHub ↗</button>
        <button class="btn" id="btn-repo-analyze" style="margin-left:auto;">🔍 Analyze Repository</button>
      </div>

      <div class="rd-header">
        <h1 class="rd-title">${info.full_name}</h1>
        <span class="repo-tag">${info.visibility}</span>
      </div>
      ${info.description ? `<p class="rd-desc">${info.description}</p>` : ''}

      <div class="rd-stats">
        <span>★ ${info.stargazers_count} stars</span>
        <span>⑂ ${info.forks_count} forks</span>
        <span>⚠ ${info.open_issues_count} issues</span>
        <span>📦 ${info.size > 1024 ? Math.round(info.size/1024)+'MB' : info.size+'KB'}</span>
        <span>⑂ ${info.default_branch}</span>
        ${info.license ? `<span>📄 ${info.license.spdx_id}</span>` : ''}
        ${info.language ? `<span>💻 ${info.language}</span>` : ''}
      </div>

      <div class="profile-sections" style="margin-top:18px;">
        <!-- LANGUAGES -->
        <div class="profile-section">
          <h3 class="section-title">Languages</h3>
          <div class="lang-list">
            ${langEntries.map(([lang, bytes]) => `
              <div class="lang-item">
                <span class="lang-name">${lang}</span>
                <div class="lang-bar-bg"><div class="lang-bar" style="width:${Math.round(bytes/totalBytes*100)}%"></div></div>
                <span class="lang-count">${Math.round(bytes/totalBytes*100)}%</span>
              </div>
            `).join('') || '<div style="color:var(--ink-3);font-size:12px;">No language data</div>'}
          </div>
        </div>

        <!-- FILE TYPES -->
        <div class="profile-section">
          <h3 class="section-title">File Types (${files.length} files, ${dirs.length} dirs)</h3>
          <div class="lang-list">
            ${topExts.map(([ext, count]) => `
              <div class="lang-item">
                <span class="lang-name">.${ext}</span>
                <div class="lang-bar-bg"><div class="lang-bar" style="width:${Math.round(count/files.length*100)}%"></div></div>
                <span class="lang-count">${count}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- RECENT COMMITS -->
      <div class="profile-section" style="margin-top:18px;">
        <h3 class="section-title">Recent Commits</h3>
        <div class="commit-list">
          ${commits.map(c => `
            <div class="commit-row">
              <span class="commit-sha">${c.sha.slice(0,7)}</span>
              <span class="commit-msg">${c.commit.message.split('\n')[0]}</span>
              <span class="commit-repo">${c.commit.author.name}</span>
              <span class="commit-date">${timeAgo(c.commit.author.date)}</span>
            </div>
          `).join('') || '<div style="padding:12px;color:var(--ink-3);font-size:12px;">No commits.</div>'}
        </div>
      </div>

      <!-- FILE TREE + VIEWER SIDE BY SIDE -->
      <div class="profile-section" style="margin-top:18px;">
        <h3 class="section-title">File Explorer</h3>
        <div class="file-explorer">
          <div class="file-tree" id="file-tree-container">${fileTreeHtml}</div>
          <div class="file-viewer-panel" id="file-viewer-section">
            <div class="file-viewer-title" id="file-viewer-title">Select a file to view</div>
            <div id="file-viewer-content" class="file-viewer-content"><div style="padding:40px;text-align:center;color:var(--ink-3);font-family:var(--mono);font-size:12px;">← Click a file from the tree</div></div>
          </div>
        </div>
      </div>

      <!-- REPOSITORY ANALYSIS (hidden until Analyze clicked) -->
      <div id="repo-analysis" style="display:none;"></div>
    `;

    // Back button
    document.getElementById('btn-back-repos').addEventListener('click', backToRepos);
    document.getElementById('btn-repo-gh').addEventListener('click', () => {
      window.gitCommit.openExternal(info.html_url);
    });
    document.getElementById('btn-repo-analyze').addEventListener('click', () => {
      analyzeRepo(owner, repo, files, tree.tree || []);
    });

    // File click handlers
    document.querySelectorAll('.ft-file').forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => {
        document.querySelectorAll('.ft-file').forEach(f => f.classList.remove('active'));
        el.classList.add('active');
        const filePath = el.dataset.path;
        viewFile(owner, repo, filePath);
      });
    });
  } catch (e) {
    detail.innerHTML = `<div style="padding:40px;color:var(--danger);">Error: ${e.message}</div><button class="btn" id="btn-back-repos-err" style="margin-top:12px;">← Back</button>`;
    document.getElementById('btn-back-repos-err').addEventListener('click', backToRepos);
  }
}

function backToRepos() {
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  document.getElementById('page-repos').style.display = 'block';
}

function buildFileTree(items) {
  const root = {};
  const pathMap = {};
  items.forEach(item => {
    const parts = item.path.split('/');
    let node = root;
    parts.forEach((p, i) => {
      if (!node[p]) node[p] = i === parts.length - 1 && item.type === 'blob' ? null : {};
      if (node[p] !== null) node = node[p];
    });
    if (item.type === 'blob') pathMap[item.path] = item;
  });

  function renderNode(obj, depth, parentPath) {
    let html = '';
    const entries = Object.entries(obj).sort(([a, av], [b, bv]) => {
      if (av !== null && bv === null) return -1;
      if (av === null && bv !== null) return 1;
      return a.localeCompare(b);
    });
    for (const [name, children] of entries) {
      const fullPath = parentPath ? parentPath + '/' + name : name;
      const indent = depth * 16;
      if (children !== null) {
        html += `<div class="ft-item ft-dir" style="padding-left:${indent}px">📁 ${name}</div>`;
        html += renderNode(children, depth + 1, fullPath);
      } else {
        html += `<div class="ft-item ft-file" style="padding-left:${indent}px" data-path="${fullPath}">📄 ${name}</div>`;
      }
    }
    return html;
  }
  return renderNode(root, 0, '');
}

async function viewFile(owner, repo, filePath) {
  const title = document.getElementById('file-viewer-title');
  const content = document.getElementById('file-viewer-content');
  title.textContent = filePath;
  content.innerHTML = '<div style="padding:16px;color:var(--ink-3);font-family:var(--mono);font-size:11px;">Loading...</div>';

  try {
    const data = await window.gitCommit.ghApi(`/repos/${owner}/${repo}/contents/${filePath}`);
    const ext = filePath.split('.').pop().toLowerCase();
    const imgExts = ['png','jpg','jpeg','gif','svg','webp','ico','bmp'];
    const pdfExts = ['pdf'];

    if (imgExts.includes(ext)) {
      // Image preview
      const src = data.download_url || `data:image/${ext};base64,${data.content}`;
      content.innerHTML = `<img src="${src}" style="max-width:100%;height:auto;border:2px solid var(--ink);">`;
    } else if (pdfExts.includes(ext)) {
      // PDF link
      content.innerHTML = `<div style="padding:20px;text-align:center;"><p style="margin-bottom:12px;">PDF files cannot be previewed inline.</p><a href="#" id="pdf-link" style="color:var(--saffron-deep);font-weight:600;">Open in browser ↗</a></div>`;
      document.getElementById('pdf-link').addEventListener('click', (e) => { e.preventDefault(); window.gitCommit.openExternal(data.html_url); });
    } else if (data.size > 500000) {
      content.innerHTML = '<div style="padding:16px;color:var(--ink-3);">File too large to preview (>500KB)</div>';
    } else {
      // Code/text file
      const text = atob(data.content);
      const escaped = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const lines = escaped.split('\n');
      content.innerHTML = `<div class="code-view"><table class="code-table">${lines.map((line, i) => `<tr><td class="line-num">${i+1}</td><td class="line-code">${line}</td></tr>`).join('')}</table></div>`;
    }
  } catch (e) {
    content.innerHTML = `<div style="padding:16px;color:var(--danger);">Failed to load: ${e.message}</div>`;
  }
}

// ── Auth Flow ──
document.getElementById('link-tokens').addEventListener('click', (e) => {
  e.preventDefault();
  window.gitCommit.openExternal('https://github.com/settings/tokens');
});

document.getElementById('token-login-btn').addEventListener('click', async () => {
  const token = document.getElementById('token-input').value.trim();
  const error = document.getElementById('login-error');
  if (!token) return;
  error.style.display = 'none';
  try {
    await window.gitCommit.loginWithToken(token);
    document.getElementById('token-input').value = '';
    await showApp();
  } catch {
    error.textContent = '✕ Invalid token. Check and try again.';
    error.style.display = 'block';
  }
});

// Check if already authenticated on load
(async () => {
  if (await window.gitCommit.isAuthenticated()) await showApp();
})();

async function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'flex';
  try {
    const user = await window.gitCommit.getUser();
    document.getElementById('sidebar-avatar').src = user.avatar_url;
    document.getElementById('sidebar-name').textContent = user.name || user.login;
    document.getElementById('sidebar-login').textContent = '@' + user.login;

    // GitHub links
    document.getElementById('profile-gh-link').onclick = (e) => { e.preventDefault(); window.gitCommit.openExternal(user.html_url); };
    document.getElementById('repos-gh-link').onclick = (e) => { e.preventDefault(); window.gitCommit.openExternal(user.html_url + '?tab=repositories'); };

    const repos = await window.gitCommit.getRepos();
    const select = document.getElementById('repo-select');
    select.innerHTML = '<option value="">— Select a repository —</option>' +
      repos.map(r => `<option value="${r.full_name}">${r.full_name}${r.private ? ' 🔒' : ''}</option>`).join('');
  } catch (e) {
    document.getElementById('sidebar-name').textContent = 'Error loading';
    document.getElementById('sidebar-login').textContent = e.message;
  }
  loadProfile();
}

// ── Logout ──
document.getElementById('nav-logout-btn').addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  document.getElementById('logout-modal').style.display = 'flex';
});
document.getElementById('logout-cancel').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('logout-modal').style.display = 'none';
});
document.getElementById('logout-confirm').addEventListener('click', async (e) => {
  e.preventDefault();
  document.getElementById('logout-modal').style.display = 'none';
  await window.gitCommit.logout();
  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = '';
});

// ── Repo mode toggle ──
document.querySelectorAll('input[name="repo-mode"]').forEach(radio => {
  radio.addEventListener('change', () => {
    const isNew = radio.value === 'new' && radio.checked;
    document.getElementById('existing-fields').style.display = isNew ? 'none' : 'block';
    document.getElementById('new-fields').style.display = isNew ? 'block' : 'none';
    checkReady();
  });
});

// ── File Selection ──
const dropZone = document.getElementById('drop-zone');
document.getElementById('btn-folder').onclick = () => document.getElementById('file-input').click();
document.getElementById('btn-files').onclick = () => document.getElementById('file-input-files').click();
dropZone.onclick = () => document.getElementById('file-input-files').click();

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('dragover'); handleItems(e.dataTransfer.items); });

document.getElementById('file-input').addEventListener('change', e => addFiles(e.target.files));
document.getElementById('file-input-files').addEventListener('change', e => addFiles(e.target.files));

async function handleItems(items) {
  const files = [];
  for (const item of items) {
    const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
    if (entry) await traverseEntry(entry, '', files);
    else files.push({ path: item.name, file: item.getAsFile() });
  }
  selectedFiles = selectedFiles.concat(files);
  renderFileList();
}

function traverseEntry(entry, basePath, results) {
  return new Promise(resolve => {
    if (entry.isFile) {
      entry.file(f => { results.push({ path: basePath + entry.name, file: f }); resolve(); });
    } else if (entry.isDirectory) {
      entry.createReader().readEntries(async entries => {
        for (const e of entries) await traverseEntry(e, basePath + entry.name + '/', results);
        resolve();
      });
    } else resolve();
  });
}

function addFiles(fileList) {
  for (const f of fileList) selectedFiles.push({ path: f.webkitRelativePath || f.name, file: f });
  renderFileList();
}

// .gitignore patterns — files that should NOT be uploaded by default
const defaultIgnorePatterns = [
  // Dependencies
  'node_modules', 'vendor', 'bower_components', '.pnp', '.yarn',
  // Environment & secrets
  '.env', '.env.local', '.env.development', '.env.production', '.env.test',
  // Build outputs
  'dist', 'build', 'out', '.output', '.next', '.nuxt', '.svelte-kit',
  // Cache
  '.cache', '.parcel-cache', '.turbo', '__pycache__', '.pytest_cache',
  '*.pyc', '*.pyo',
  // IDE & OS
  '.vscode', '.idea', '.DS_Store', 'Thumbs.db', 'desktop.ini', '*.swp', '*.swo',
  // Git
  '.git',
  // Logs
  '*.log', 'npm-debug.log', 'yarn-debug.log', 'yarn-error.log',
  // Package locks (optional but large)
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  // Compiled
  '*.exe', '*.dll', '*.so', '*.dylib', '*.class', '*.o',
  // Coverage
  'coverage', '.nyc_output', 'htmlcov',
  // Misc
  '.terraform', '.serverless', '.vercel', '.firebase'
];

function matchesIgnore(filePath) {
  const useIgnore = document.getElementById('gitignore-check')?.checked;
  if (!useIgnore) return false;
  const fileName = filePath.split('/').pop();
  return defaultIgnorePatterns.some(p => {
    if (p.startsWith('*.')) return fileName.endsWith(p.slice(1));
    return filePath.split('/').some(part => part === p) || filePath.includes(p + '/') || fileName === p;
  });
}

function getUploadFiles() {
  return selectedFiles.filter(f => !f.excluded);
}

function renderFileList() {
  const preview = document.getElementById('file-preview');
  const warnings = document.getElementById('file-warnings');

  if (!selectedFiles.length) {
    preview.style.display = 'none';
    warnings.style.display = 'none';
    document.getElementById('file-count').textContent = '';
    checkReady();
    return;
  }

  preview.style.display = 'block';

  // Auto-exclude ignored files (set on first render)
  selectedFiles.forEach(f => {
    if (f.excluded === undefined) f.excluded = matchesIgnore(f.path);
  });

  // Check for large files (>25MB)
  const largeFiles = selectedFiles.filter(f => f.file.size > 25 * 1024 * 1024);
  if (largeFiles.length) {
    warnings.style.display = 'block';
    warnings.innerHTML = `⚠ <strong>${largeFiles.length} file(s) exceed GitHub's 25MB limit:</strong>` +
      largeFiles.map(f => `<div class="warn-item">• ${f.path} (${fmtSize(f.file.size)})</div>`).join('');
  } else {
    warnings.style.display = 'none';
  }

  // Render file list as hierarchical tree
  document.getElementById('file-list').innerHTML = buildUploadTree(selectedFiles);

  document.querySelectorAll('.file-check').forEach(el => {
    el.addEventListener('change', () => {
      selectedFiles[+el.dataset.i].excluded = !el.checked;
      updateFileCounts();
    });
  });

  // Folder checkboxes toggle all children
  document.querySelectorAll('.folder-check').forEach(el => {
    el.addEventListener('change', () => {
      const prefix = el.dataset.dir;
      const checked = el.checked;
      selectedFiles.forEach((f, i) => {
        if (f.path.startsWith(prefix + '/') || f.path === prefix) f.excluded = !checked;
      });
      renderFileList();
    });
  });

  updateFileCounts();
}

function updateFileCounts() {
  const uploadable = getUploadFiles();
  document.getElementById('file-count').textContent = `${uploadable.length} of ${selectedFiles.length} file(s) will upload · ${fmtSize(uploadable.reduce((s,f)=>s+f.file.size,0))}`;
  checkReady();
}

function buildUploadTree(files) {
  // Build tree structure
  const root = {};
  files.forEach((f, i) => {
    const parts = f.path.split('/');
    let node = root;
    parts.forEach((part, pi) => {
      if (pi === parts.length - 1) {
        // File
        if (!node.__files) node.__files = [];
        node.__files.push({ name: part, index: i, file: f });
      } else {
        // Directory
        if (!node[part]) node[part] = {};
        node = node[part];
      }
    });
  });

  function renderTree(obj, depth, pathPrefix) {
    let html = '';
    // Render directories first
    const dirs = Object.keys(obj).filter(k => k !== '__files').sort();
    dirs.forEach(dir => {
      const fullPath = pathPrefix ? pathPrefix + '/' + dir : dir;
      const indent = depth * 18;
      // Check if all files in this dir are excluded
      const dirFiles = selectedFiles.filter(f => f.path.startsWith(fullPath + '/'));
      const allExcluded = dirFiles.length > 0 && dirFiles.every(f => f.excluded);
      const someExcluded = dirFiles.some(f => f.excluded) && !allExcluded;

      html += `<div class="tree-folder" style="padding-left:${indent}px">
        <input type="checkbox" class="folder-check" data-dir="${fullPath}" ${allExcluded ? '' : 'checked'} ${someExcluded ? 'style="opacity:0.5"' : ''}>
        <span class="tree-folder-icon">📁</span>
        <span class="tree-folder-name">${dir}/</span>
        <span class="tree-folder-count">${dirFiles.length} files</span>
      </div>`;
      html += renderTree(obj[dir], depth + 1, fullPath);
    });

    // Render files
    if (obj.__files) {
      obj.__files.sort((a, b) => a.name.localeCompare(b.name)).forEach(item => {
        const indent = depth * 18;
        const isLarge = item.file.file.size > 25 * 1024 * 1024;
        const cls = item.file.excluded ? 'tree-file excluded' : isLarge ? 'tree-file warn' : 'tree-file';
        html += `<div class="${cls}" style="padding-left:${indent}px">
          <input type="checkbox" class="file-check" data-i="${item.index}" ${!item.file.excluded ? 'checked' : ''}>
          <span class="tree-file-icon">📄</span>
          <span class="tree-file-name">${item.name}</span>
          <span class="tree-file-size">${fmtSize(item.file.file.size)}</span>
          ${item.file.excluded && matchesIgnore(item.file.path) ? '<span class="tree-auto-tag">auto</span>' : ''}
        </div>`;
      });
    }
    return html;
  }

  return renderTree(root, 0, '');
}

// Re-render when gitignore toggle changes
document.getElementById('gitignore-check').addEventListener('change', () => {
  const checked = document.getElementById('gitignore-check').checked;
  selectedFiles.forEach(f => {
    if (checked) { f.excluded = matchesIgnore(f.path); }
    else { if (matchesIgnore(f.path)) f.excluded = false; }
  });
  renderFileList();
});

function fmtSize(b) { return b < 1024 ? b+'B' : b < 1048576 ? (b/1024).toFixed(1)+'KB' : (b/1048576).toFixed(1)+'MB'; }

function checkReady() {
  const mode = document.querySelector('input[name="repo-mode"]:checked').value;
  let ready = getUploadFiles().length > 0;
  if (mode === 'existing') ready = ready && document.getElementById('repo-select').value;
  else ready = ready && document.getElementById('new-repo-name').value.trim();
  document.getElementById('upload-btn').disabled = !ready;
}
document.getElementById('repo-select').addEventListener('change', () => { checkReady(); loadBranchCommits(); });
document.getElementById('branch-input').addEventListener('change', loadBranchCommits);
document.getElementById('new-repo-name').addEventListener('input', checkReady);

// Load last 3 commits of selected branch
async function loadBranchCommits() {
  const repo = document.getElementById('repo-select').value;
  const branch = document.getElementById('branch-input').value || 'main';
  const container = document.getElementById('branch-commits');
  const list = document.getElementById('branch-commits-list');
  if (!repo) { container.style.display = 'none'; return; }
  try {
    const commits = await window.gitCommit.ghApi(`/repos/${repo}/commits?sha=${branch}&per_page=3`);
    container.style.display = 'block';
    list.innerHTML = commits.map(c => `
      <div class="commit-row">
        <span class="commit-sha">${c.sha.slice(0,7)}</span>
        <span class="commit-msg" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.commit.message.split('\n')[0]}</span>
        <span class="commit-date">${timeAgo(c.commit.author.date)}</span>
      </div>
    `).join('');
  } catch { container.style.display = 'none'; }
}


// ── Terminal ──
function termLog(text, cls = '') {
  const body = document.getElementById('terminal-body');
  const div = document.createElement('div');
  div.className = cls;
  div.textContent = text;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}
function termCmd(cmd) { termLog(`$ ${cmd}`, 'cmd'); }

document.getElementById('terminal-close').onclick = () => document.getElementById('terminal-overlay').classList.remove('active');
document.getElementById('terminal-done-btn').onclick = () => document.getElementById('terminal-overlay').classList.remove('active');

// ── Upload ──
document.getElementById('upload-btn').addEventListener('click', startUpload);

async function startUpload() {
  const filesToUpload = getUploadFiles();
  if (!filesToUpload.length) return;

  const overlay = document.getElementById('terminal-overlay');
  document.getElementById('terminal-body').innerHTML = '';
  overlay.classList.add('active');
  document.getElementById('terminal-done-btn').style.display = 'none';
  document.getElementById('terminal-status').textContent = 'Running...';
  document.getElementById('upload-btn').disabled = true;

  // Show progress bar
  const progressEl = document.getElementById('upload-progress');
  const progressBar = document.getElementById('progress-bar');
  const progressLabel = document.getElementById('progress-label');
  const progressDetail = document.getElementById('progress-detail');
  progressEl.style.display = 'block';
  progressBar.style.width = '0%';

  const mode = document.querySelector('input[name="repo-mode"]:checked').value;
  const commitMsg = document.getElementById('commit-msg').value || 'Upload files';
  const isNewBranch = document.getElementById('new-branch-check')?.checked;
  let repoFullName, branch;

  try {
    if (mode === 'new') {
      const name = document.getElementById('new-repo-name').value.trim();
      const desc = document.getElementById('new-repo-desc').value.trim();
      const isPrivate = document.getElementById('new-repo-private').checked;
      const addReadme = document.getElementById('new-repo-readme').checked;
      const license = document.getElementById('new-repo-license').value;

      termCmd(`gh repo create ${name} --${isPrivate ? 'private' : 'public'}`);
      progressLabel.textContent = 'Creating repository...';
      const payload = { name, description: desc, private: isPrivate, auto_init: addReadme };
      if (license) payload.license_template = license;

      const newRepo = await window.gitCommit.ghApi('/user/repos', 'POST', payload);
      repoFullName = newRepo.full_name;
      branch = newRepo.default_branch || 'main';
      termLog(`✓ Created: ${repoFullName}`, 'success');
      if (addReadme) await new Promise(r => setTimeout(r, 2000));
    } else {
      repoFullName = document.getElementById('repo-select').value;
      branch = document.getElementById('branch-input').value || 'main';
      termLog(`✓ Using: ${repoFullName} (${branch})`, 'success');
    }

    // Get HEAD from default branch (for new branch, branch off main)
    termCmd('git rev-parse HEAD');
    progressLabel.textContent = 'Getting branch info...';
    let baseSha = null;
    let sourceBranch = branch;

    if (isNewBranch && mode === 'existing') {
      // For new branch, get SHA from default branch first
      try {
        const repoInfo = await window.gitCommit.ghApi(`/repos/${repoFullName}`);
        const ref = await window.gitCommit.ghApi(`/repos/${repoFullName}/git/ref/heads/${repoInfo.default_branch}`);
        baseSha = ref.object.sha;
        termLog(`✓ Branching from ${repoInfo.default_branch}: ${baseSha.slice(0,7)}`, 'success');
      } catch { termLog('Could not find base branch', 'info'); }
    } else {
      try {
        const ref = await window.gitCommit.ghApi(`/repos/${repoFullName}/git/ref/heads/${branch}`);
        baseSha = ref.object.sha;
        termLog(`✓ HEAD: ${baseSha.slice(0,7)}`, 'success');
      } catch { termLog('New branch, creating from scratch', 'info'); }
    }

    // Create blobs with progress
    const pathPrefix = document.getElementById('path-input')?.value?.trim() || '';
    const treeItems = [];
    const total = filesToUpload.length;
    termCmd(`git add . (${total} files)`);
    progressLabel.textContent = 'Uploading files...';

    for (let i = 0; i < total; i++) {
      const f = filesToUpload[i];
      const content = await readFileBase64(f.file);
      const filePath = pathPrefix ? pathPrefix.replace(/\/$/,'') + '/' + f.path : f.path;
      termLog(`  [${i+1}/${total}] ${filePath}`, 'progress');

      const pct = Math.round(((i + 1) / total) * 80);
      progressBar.style.width = pct + '%';
      progressDetail.textContent = `${i+1} / ${total} files uploaded`;

      const blob = await window.gitCommit.ghApi(`/repos/${repoFullName}/git/blobs`, 'POST', { content, encoding: 'base64' });
      treeItems.push({ path: filePath, mode: '100644', type: 'blob', sha: blob.sha });
    }
    termLog(`✓ ${total} blobs created`, 'success');

    // Create tree
    termCmd('git write-tree');
    progressLabel.textContent = 'Creating tree...';
    progressBar.style.width = '85%';
    const treePayload = { tree: treeItems };
    if (baseSha) {
      const baseCommit = await window.gitCommit.ghApi(`/repos/${repoFullName}/git/commits/${baseSha}`);
      treePayload.base_tree = baseCommit.tree.sha;
    }
    const tree = await window.gitCommit.ghApi(`/repos/${repoFullName}/git/trees`, 'POST', treePayload);
    termLog(`✓ Tree: ${tree.sha.slice(0,7)}`, 'success');

    // Commit
    termCmd(`git commit -m "${commitMsg}"`);
    progressLabel.textContent = 'Committing...';
    progressBar.style.width = '90%';
    const commit = await window.gitCommit.ghApi(`/repos/${repoFullName}/git/commits`, 'POST', {
      message: commitMsg, tree: tree.sha, parents: baseSha ? [baseSha] : []
    });
    termLog(`✓ Commit: ${commit.sha.slice(0,7)}`, 'success');

    // Push
    termCmd(`git push origin ${branch}`);
    progressLabel.textContent = 'Pushing...';
    progressBar.style.width = '95%';
    try {
      await window.gitCommit.ghApi(`/repos/${repoFullName}/git/refs/heads/${branch}`, 'PATCH', { sha: commit.sha });
    } catch {
      await window.gitCommit.ghApi(`/repos/${repoFullName}/git/refs`, 'POST', { ref: `refs/heads/${branch}`, sha: commit.sha });
    }

    progressBar.style.width = '100%';
    progressLabel.textContent = '✓ Upload complete!';
    progressDetail.textContent = `${total} files → github.com/${repoFullName} (${branch})`;

    termLog('', '');
    termLog('═══════════════════════════════════', 'success');
    termLog('  ✓ UPLOAD COMPLETE', 'success');
    termLog(`  ${total} files → github.com/${repoFullName}`, 'success');
    termLog(`  Branch: ${branch}`, 'success');
    termLog('═══════════════════════════════════', 'success');
    document.getElementById('terminal-status').textContent = '✓ Complete';
    document.getElementById('terminal-done-btn').style.display = 'block';
  } catch (err) {
    termLog(`✕ ERROR: ${err.message}`, 'error');
    document.getElementById('terminal-status').textContent = '✕ Failed';
    document.getElementById('terminal-done-btn').style.display = 'block';
    progressLabel.textContent = '✕ Failed';
    progressBar.style.width = '100%';
    progressBar.style.background = 'var(--danger)';
  }
  document.getElementById('upload-btn').disabled = false;
}

function readFileBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Git CMD Page ──
const gitCommands = [
  { cmd: 'git init', cat: 'Setup', desc: 'Initialize a new Git repository. Creates a .git folder to track changes.', flags: '--bare (create bare repo), --initial-branch=name', example: ['$ git init', 'Initialized empty Git repository in /project/.git/', '', '$ ls -a', '.  ..  .git'] },
  { cmd: 'git clone <url>', cat: 'Setup', desc: 'Download a complete copy of a remote repository including all history and branches.', flags: '--depth 1 (shallow), --branch name, --recursive', example: ['$ git clone https://github.com/user/repo.git', 'Cloning into \'repo\'...', 'remote: Enumerating objects: 150, done.', 'remote: Compressing objects: 100% (98/98)', 'Receiving objects: 100% (150/150), 2.1 MiB, done.', 'Resolving deltas: 100% (52/52), done.'] },
  { cmd: 'git add <file>', cat: 'Staging', desc: 'Stage changes for commit. Moves files from working directory to staging area.', flags: '. (all files), -A (all+deleted), -p (interactive patch)', example: ['$ git add src/app.js', '$ git add .', '$ git status', 'Changes to be committed:', '  new file:   src/utils.js', '  modified:   src/app.js'] },
  { cmd: 'git commit -m "msg"', cat: 'Staging', desc: 'Save staged changes as a new commit with a message describing what changed.', flags: '--amend (edit last), -a (auto-stage tracked), --no-verify', example: ['$ git commit -m "feat: add user authentication"', '[main a1b2c3d] feat: add user authentication', ' 3 files changed, 87 insertions(+), 4 deletions(-)', ' create mode 100644 src/auth.js'] },
  { cmd: 'git status', cat: 'Info', desc: 'Display the state of working directory: staged, unstaged, and untracked files.', flags: '-s (short format), -b (show branch)', example: ['$ git status', 'On branch feature/auth', 'Changes to be committed:', '  new file:   src/auth.js', '', 'Changes not staged for commit:', '  modified:   package.json', '', 'Untracked files:', '  .env.local'] },
  { cmd: 'git log', cat: 'Info', desc: 'Show commit history. Displays SHA, author, date, and message for each commit.', flags: '--oneline, --graph, --all, -n 5, --author="name"', example: ['$ git log --oneline --graph -5', '* a1b2c3d (HEAD -> main) feat: add auth', '* f4e5d6c fix: resolve header bug', '* b7c8d9e docs: update README', '|\\', '| * c9d0e1f (feature/ui) style: new theme', '|/', '* e2f3g4h init: project setup'] },
  { cmd: 'git diff', cat: 'Info', desc: 'Show line-by-line differences between working directory, staging area, or commits.', flags: '--staged (staged vs last commit), --stat, HEAD~1', example: ['$ git diff --staged', 'diff --git a/src/auth.js b/src/auth.js', '+++ b/src/auth.js', '@@ -0,0 +1,15 @@', '+export function login(user, pass) {', '+  return fetch(\'/api/auth\', {', '+    method: \'POST\',', '+    body: JSON.stringify({ user, pass })', '+  });', '+}'] },
  { cmd: 'git push', cat: 'Remote', desc: 'Upload local commits to the remote repository. Syncs your branch with origin.', flags: '-u origin branch (set upstream), --force, --tags', example: ['$ git push -u origin feature/auth', 'Enumerating objects: 12, done.', 'Counting objects: 100% (12/12), done.', 'Delta compression using up to 8 threads', 'Writing objects: 100% (8/8), 2.4 KiB, done.', 'To https://github.com/user/repo.git', ' * [new branch]  feature/auth -> feature/auth', 'Branch set up to track remote branch.'] },
  { cmd: 'git pull', cat: 'Remote', desc: 'Fetch remote changes and merge them into your current branch in one step.', flags: '--rebase (rebase instead of merge), --no-commit', example: ['$ git pull origin main', 'remote: Enumerating objects: 5, done.', 'Updating f4e5d6c..x9y8z7w', 'Fast-forward', '  src/index.js | 12 +++++++++---', '  src/api.js   |  8 ++++++++', '  2 files changed, 17 insertions(+), 3 deletions(-)'] },
  { cmd: 'git fetch', cat: 'Remote', desc: 'Download commits and refs from remote without merging. Safe way to check updates.', flags: '--all (all remotes), --prune (remove stale refs)', example: ['$ git fetch origin', 'remote: Enumerating objects: 20, done.', 'From https://github.com/user/repo', '   a1b2c3d..x9y8z7w  main       -> origin/main', ' * [new branch]      hotfix/bug -> origin/hotfix/bug'] },
  { cmd: 'git branch', cat: 'Branching', desc: 'List, create, rename, or delete branches. Branches are lightweight pointers to commits.', flags: '-a (all), -d name (delete), -m old new (rename)', example: ['$ git branch -a', '* main', '  feature/auth', '  feature/ui', '  remotes/origin/main', '  remotes/origin/feature/auth', '', '$ git branch feature/api', '$ git branch -d feature/ui', 'Deleted branch feature/ui.'] },
  { cmd: 'git checkout', cat: 'Branching', desc: 'Switch branches or restore working tree files. Creates branch with -b flag.', flags: '-b name (create+switch), -- file (restore file)', example: ['$ git checkout -b feature/dashboard', 'Switched to a new branch \'feature/dashboard\'', '', '$ git checkout main', 'Switched to branch \'main\'', 'Your branch is up to date with \'origin/main\'.'] },
  { cmd: 'git switch', cat: 'Branching', desc: 'Modern alternative to checkout for switching branches (Git 2.23+).', flags: '-c name (create), -d (detach HEAD)', example: ['$ git switch -c feature/settings', 'Switched to a new branch \'feature/settings\'', '', '$ git switch main', 'Switched to branch \'main\''] },
  { cmd: 'git merge <branch>', cat: 'Merging', desc: 'Combine another branch into current branch. Creates a merge commit if not fast-forward.', flags: '--no-ff (force merge commit), --squash, --abort', example: ['$ git merge feature/auth', 'Merge made by the \'ort\' strategy.', '  src/auth.js    | 45 ++++++++++++++++++++++++', '  src/routes.js  | 12 +++++++', '  2 files changed, 57 insertions(+)', '', '$ git log --oneline -1', 'h8i9j0k Merge branch \'feature/auth\''] },
  { cmd: 'git rebase <branch>', cat: 'Merging', desc: 'Reapply your commits on top of another branch for a clean, linear history.', flags: '-i (interactive), --abort, --continue', example: ['$ git rebase main', 'First, rewinding head to replay your work...', 'Applying: feat: add login page', 'Applying: feat: add auth validation', 'Applying: test: add auth tests', '', 'Successfully rebased 3 commits.'] },
  { cmd: 'git stash', cat: 'Temporary', desc: 'Save uncommitted changes temporarily. Useful when switching branches mid-work.', flags: 'pop (restore), list, drop, apply stash@{n}', example: ['$ git stash', 'Saved working directory and index state', '  WIP on feature/auth: a1b2c3d add login', '', '$ git stash list', 'stash@{0}: WIP on feature/auth: a1b2c3d add login', '', '$ git stash pop', 'On branch feature/auth', 'Changes restored successfully.'] },
  { cmd: 'git reset', cat: 'Undo', desc: 'Move HEAD and optionally modify staging/working directory. Use carefully!', flags: '--soft (keep staged), --mixed (unstage), --hard (discard all)', example: ['$ git reset --soft HEAD~1', '# Last commit undone, changes kept staged', '', '$ git reset --hard HEAD~2', 'HEAD is now at b7c8d9e docs: update README', '⚠ 2 commits and all changes permanently lost!'] },
  { cmd: 'git revert <sha>', cat: 'Undo', desc: 'Create a new commit that undoes a previous commit. Safe way to undo in shared branches.', flags: '--no-commit (stage only), -m 1 (merge commit)', example: ['$ git revert a1b2c3d', '[main k2l3m4n] Revert "feat: add auth"', ' 3 files changed, 4 insertions(+), 87 deletions(-)', '', '# Original commit still in history, safely undone'] },
  { cmd: 'git tag <name>', cat: 'Releases', desc: 'Mark a specific commit with a version label. Used for releases.', flags: '-a (annotated), -m "msg", -d (delete), -l (list)', example: ['$ git tag -a v1.2.0 -m "Release 1.2.0"', '$ git push origin v1.2.0', 'To https://github.com/user/repo.git', ' * [new tag]  v1.2.0 -> v1.2.0', '', '$ git tag -l "v1.*"', 'v1.0.0', 'v1.1.0', 'v1.2.0'] },
  { cmd: 'git cherry-pick <sha>', cat: 'Advanced', desc: 'Apply a specific commit from another branch to your current branch.', flags: '--no-commit (stage only), -x (add source ref)', example: ['$ git cherry-pick e5f6g7h', '[main p5q6r7s] feat: add dark mode toggle', ' 1 file changed, 22 insertions(+)', '', '# Commit from feature/ui applied to main'] },
  { cmd: 'git remote', cat: 'Remote', desc: 'Manage remote repository connections. View, add, or remove remotes.', flags: '-v (verbose), add name url, remove name, rename', example: ['$ git remote -v', 'origin  https://github.com/user/repo.git (fetch)', 'origin  https://github.com/user/repo.git (push)', '', '$ git remote add upstream https://github.com/org/repo.git', '$ git remote -v', 'origin    https://github.com/user/repo.git', 'upstream  https://github.com/org/repo.git'] },
  { cmd: 'git config', cat: 'Setup', desc: 'Set Git configuration values like username, email, editor, and aliases.', flags: '--global (all repos), --local, --list', example: ['$ git config --global user.name "Harsh Mogha"', '$ git config --global user.email "harsh@example.com"', '$ git config --global init.defaultBranch main', '', '$ git config --list', 'user.name=Harsh Mogha', 'user.email=harsh@example.com', 'init.defaultbranch=main'] },
  { cmd: 'git rm <file>', cat: 'Staging', desc: 'Remove files from working directory and staging area in one step.', flags: '--cached (untrack only, keep file), -r (recursive)', example: ['$ git rm src/old-utils.js', 'rm \'src/old-utils.js\'', '', '$ git rm --cached .env', 'rm \'.env\'', '# File kept on disk but untracked by git'] },
  { cmd: 'git bisect', cat: 'Advanced', desc: 'Binary search through commits to find which one introduced a bug.', flags: 'start, good <sha>, bad <sha>, reset', example: ['$ git bisect start', '$ git bisect bad HEAD', '$ git bisect good v1.0.0', 'Bisecting: 12 revisions left to test', '[c9d0e1f] style: refactor components', '', '$ git bisect bad', 'Bisecting: 6 revisions left...', '# Keep marking good/bad until bug found'] },
];

let cmdRendered = false;
function loadGitCmd() {
  if (cmdRendered) return;
  cmdRendered = true;
  renderCmds(gitCommands);
  document.getElementById('cmd-search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    renderCmds(gitCommands.filter(c => c.cmd.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q)));
  });
}

function renderCmds(cmds) {
  document.getElementById('cmd-list').innerHTML = cmds.map((c, i) => `
    <div class="cmd-card">
      <div class="cmd-category">${c.cat}</div>
      <div class="cmd-header">
        <code class="cmd-code">${c.cmd}</code>
        <button class="cmd-run-btn" data-idx="${i}">▶ Run</button>
      </div>
      <p class="cmd-desc">${c.desc}</p>
      <div class="cmd-flags">Flags: ${c.flags.split(', ').map(f => `<code>${f}</code>`).join(' ')}</div>
      <div class="cmd-terminal" id="cmd-term-${i}"></div>
    </div>
  `).join('');

  document.querySelectorAll('.cmd-run-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      animateTerminal(idx, cmds[idx].example);
    });
  });
}

function animateTerminal(idx, lines) {
  const term = document.getElementById('cmd-term-' + idx);
  term.innerHTML = '';
  term.style.display = 'block';
  let i = 0;
  function typeLine() {
    if (i >= lines.length) return;
    const line = lines[i];
    const div = document.createElement('div');
    div.className = line.startsWith('$') ? 'cmd' : line.startsWith('⚠') ? 'error' : 'info';
    term.appendChild(div);
    let charIdx = 0;
    const speed = line.startsWith('$') ? 30 : 10;
    function typeChar() {
      if (charIdx <= line.length) {
        div.textContent = line.slice(0, charIdx);
        charIdx++;
        setTimeout(typeChar, speed);
      } else {
        i++;
        setTimeout(typeLine, 200);
      }
    }
    typeChar();
    term.scrollTop = term.scrollHeight;
  }
  typeLine();
}

// ── About Page Orb Animation ──
(function() {
  let rotation = 0;
  function animateOrb() {
    rotation += 0.4;
    const outer = document.querySelector('.orb-outer');
    const ring = document.querySelector('.orb-ring');
    if (outer) outer.style.transform = `rotate(-${rotation * 0.5}deg)`;
    if (ring) ring.style.transform = `rotate(${rotation}deg)`;
    requestAnimationFrame(animateOrb);
  }
  animateOrb();
})();

// ── Terms Modal ──
document.getElementById('terms-btn').addEventListener('click', () => {
  document.getElementById('terms-modal').style.display = 'flex';
});
document.getElementById('instagram-btn').addEventListener('click', () => {
  window.gitCommit.openExternal('https://www.instagram.com/mira_future.ai');
});
document.getElementById('feedback-btn').addEventListener('click', () => {
  window.gitCommit.openExternal('mailto:mirafeedport@gmail.com');
});

// ── Auto Updater ──
document.getElementById('update-btn').addEventListener('click', async () => {
  const modal = document.getElementById('update-modal');
  const content = document.getElementById('update-modal-content');
  const downloadBtn = document.getElementById('update-download-btn');
  const installBtn = document.getElementById('update-install-btn');
  modal.style.display = 'flex';
  downloadBtn.style.display = 'none';
  installBtn.style.display = 'none';

  const version = await window.gitCommit.getAppVersion();
  content.innerHTML = `<p style="margin-bottom:8px;">Current version: <strong>v${version}</strong></p><p>Checking for updates...</p>`;

  const result = await window.gitCommit.checkForUpdates();
  if (result.available) {
    content.innerHTML = `<p style="margin-bottom:8px;">Current version: <strong>v${version}</strong></p><p>✨ New version <strong>v${result.version}</strong> is available!</p>`;
    downloadBtn.style.display = 'inline-block';
  } else {
    content.innerHTML = `<p style="margin-bottom:8px;">Current version: <strong>v${version}</strong></p><p style="color:var(--success);font-weight:600;">✓ Up to date.</p>`;
  }
});

document.getElementById('update-modal-close').addEventListener('click', () => {
  document.getElementById('update-modal').style.display = 'none';
});

document.getElementById('update-download-btn').addEventListener('click', () => {
  document.getElementById('update-modal-content').innerHTML += '<p style="margin-top:8px;">Downloading... <span id="update-pct">0%</span></p>';
  document.getElementById('update-download-btn').style.display = 'none';
  window.gitCommit.downloadUpdate();
});

document.getElementById('update-install-btn').addEventListener('click', () => {
  window.gitCommit.installUpdate();
});

window.gitCommit.onUpdateProgress((pct) => {
  const el = document.getElementById('update-pct');
  if (el) el.textContent = pct + '%';
});

window.gitCommit.onUpdateDownloaded(() => {
  document.getElementById('update-modal-content').innerHTML += '<p style="color:var(--success);font-weight:600;margin-top:8px;">✓ Download complete! Ready to install.</p>';
  document.getElementById('update-install-btn').style.display = 'inline-block';
});
document.getElementById('terms-close').addEventListener('click', () => {
  document.getElementById('terms-modal').style.display = 'none';
});
document.getElementById('terms-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) document.getElementById('terms-modal').style.display = 'none';
});

// ── Repository Analysis ──
function analyzeRepo(owner, repo, files, allItems) {
  const container = document.getElementById('repo-analysis');
  container.style.display = 'block';
  container.scrollIntoView({ behavior: 'smooth' });

  // File stats
  const dirs = allItems.filter(t => t.type === 'tree');
  const exts = {};
  const dirSizes = {};
  files.forEach(f => {
    const ext = f.path.includes('.') ? f.path.split('.').pop().toLowerCase() : 'no-ext';
    exts[ext] = (exts[ext] || 0) + 1;
    const dir = f.path.split('/').slice(0, -1).join('/') || '(root)';
    dirSizes[dir] = (dirSizes[dir] || 0) + (f.size || 0);
  });
  const topExts = Object.entries(exts).sort((a,b) => b[1] - a[1]);
  const topDirs = Object.entries(dirSizes).sort((a,b) => b[1] - a[1]).slice(0, 10);
  const totalSize = files.reduce((s, f) => s + (f.size || 0), 0);

  // Detect dependencies (by naming, directory, imports)
  const nodes = [];
  const edges = [];
  const codeExts = ['js','ts','jsx','tsx','py','rb','go','rs','java','c','cpp','h','cs','php','vue','svelte'];
  const codeFiles = files.filter(f => {
    const ext = f.path.split('.').pop().toLowerCase();
    return codeExts.includes(ext);
  });

  codeFiles.forEach((f, i) => {
    nodes.push({ id: i, path: f.path, name: f.path.split('/').pop(), dir: f.path.split('/').slice(0,-1).join('/') });
  });

  // Build edges: only meaningful connections (not all same-dir files)
  codeFiles.forEach((f, i) => {
    const dir = f.path.split('/').slice(0,-1).join('/');
    const base = f.path.split('/').pop().replace(/\.[^.]+$/, '');
    codeFiles.forEach((f2, j) => {
      if (i >= j) return;
      const dir2 = f2.path.split('/').slice(0,-1).join('/');
      const base2 = f2.path.split('/').pop().replace(/\.[^.]+$/, '');

      // Strong: same base name different extension (app.tsx + app.css)
      if (dir === dir2 && base === base2) {
        edges.push({ from: i, to: j, strength: 3 });
      }
      // Strong: test file connects to source
      else if (base.replace(/\.(test|spec)/, '') === base2 || base2.replace(/\.(test|spec)/, '') === base) {
        edges.push({ from: i, to: j, strength: 3 });
      }
      // Medium: index file connects to same-dir files
      else if (dir === dir2 && (base === 'index' || base2 === 'index')) {
        edges.push({ from: i, to: j, strength: 2 });
      }
      // Medium: layout/page relationship
      else if (dir === dir2 && (base.includes('layout') || base2.includes('layout')) && (base.includes('page') || base2.includes('page'))) {
        edges.push({ from: i, to: j, strength: 2 });
      }
      // NO weak same-dir connections — they create the mess
    });
  });

  // Directory depth analysis
  const depths = files.map(f => f.path.split('/').length);
  const maxDepth = Math.max(...depths, 1);
  const avgDepth = (depths.reduce((s,d) => s+d, 0) / depths.length).toFixed(1);

  // Complexity indicators
  const hasTests = files.some(f => f.path.includes('test') || f.path.includes('spec'));
  const hasCI = files.some(f => f.path.includes('.github/workflows') || f.path.includes('.gitlab-ci'));
  const hasDocker = files.some(f => f.path.toLowerCase().includes('dockerfile') || f.path.includes('docker-compose'));
  const hasConfig = files.some(f => /package\.json|requirements\.txt|go\.mod|Cargo\.toml|pom\.xml/.test(f.path));
  const hasReadme = files.some(f => f.path.toLowerCase() === 'readme.md');
  const hasLicense = files.some(f => f.path.toLowerCase().startsWith('license'));
  const hasEnv = files.some(f => f.path.includes('.env'));

  container.innerHTML = `
    <div class="profile-section" style="margin-top:18px;">
      <h3 class="section-title">Repository Analysis</h3>

      <!-- Quick Stats -->
      <div class="quick-stats" style="margin-bottom:18px;">
        <div class="quick-stat"><span class="qs-value">${files.length}</span><span class="qs-label">Files</span></div>
        <div class="quick-stat"><span class="qs-value">${dirs.length}</span><span class="qs-label">Directories</span></div>
        <div class="quick-stat"><span class="qs-value">${maxDepth}</span><span class="qs-label">Max Depth</span></div>
        <div class="quick-stat"><span class="qs-value">${avgDepth}</span><span class="qs-label">Avg Depth</span></div>
        <div class="quick-stat"><span class="qs-value">${topExts.length}</span><span class="qs-label">File Types</span></div>
        <div class="quick-stat"><span class="qs-value">${fmtSize(totalSize)}</span><span class="qs-label">Total Size</span></div>
      </div>

      <!-- Health Indicators -->
      <div class="analysis-health">
        <div class="health-item ${hasReadme ? 'health-good' : 'health-bad'}">📝 README ${hasReadme ? '✓' : '✕'}</div>
        <div class="health-item ${hasLicense ? 'health-good' : 'health-bad'}">📄 License ${hasLicense ? '✓' : '✕'}</div>
        <div class="health-item ${hasTests ? 'health-good' : 'health-bad'}">🧪 Tests ${hasTests ? '✓' : '✕'}</div>
        <div class="health-item ${hasCI ? 'health-good' : 'health-bad'}">⚙️ CI/CD ${hasCI ? '✓' : '✕'}</div>
        <div class="health-item ${hasDocker ? 'health-good' : 'health-bad'}">🐳 Docker ${hasDocker ? '✓' : '✕'}</div>
        <div class="health-item ${hasConfig ? 'health-good' : 'health-bad'}">📦 Package Manager ${hasConfig ? '✓' : '✕'}</div>
        <div class="health-item ${hasEnv ? 'health-warn' : 'health-good'}">🔑 .env file ${hasEnv ? '⚠ Found' : '✓ None'}</div>
      </div>
    </div>

    <div class="profile-sections" style="margin-top:18px;">
      <!-- File Types Breakdown -->
      <div class="profile-section">
        <h3 class="section-title">File Types</h3>
        <div class="lang-list">
          ${topExts.slice(0, 12).map(([ext, count]) => `
            <div class="lang-item">
              <span class="lang-name">.${ext}</span>
              <div class="lang-bar-bg"><div class="lang-bar" style="width:${Math.round(count/files.length*100)}%"></div></div>
              <span class="lang-count">${count} (${Math.round(count/files.length*100)}%)</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Largest Directories -->
      <div class="profile-section">
        <h3 class="section-title">Largest Directories</h3>
        <div class="lang-list">
          ${topDirs.map(([dir, size]) => `
            <div class="lang-item">
              <span class="lang-name">${dir || '(root)'}</span>
              <div class="lang-bar-bg"><div class="lang-bar" style="width:${Math.round(size/totalSize*100)}%"></div></div>
              <span class="lang-count">${fmtSize(size)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Directory Tree Map -->
    <div class="profile-section" style="margin-top:18px;">
      <h3 class="section-title">Directory Structure Map</h3>
      <div class="dir-tree-map" id="dir-tree-map"></div>
    </div>
  `;

  // Draw directory tree map
  drawDirTreeMap(files);
}

// ── Graph zoom/pan state ──
let _graphScale = 1;
let _graphOffset = { x: 0, y: 0 };
let _graphNodes = [];
let _graphEdges = [];

function graphZoom(factor) {
  _graphScale *= factor;
  redrawGraph();
}

function redrawGraph() {
  drawAnalysisGraph(_graphNodes, _graphEdges, true);
}

function drawAnalysisGraph(nodes, edges, skipLayout) {
  const canvas = document.getElementById('analysis-graph');
  if (!canvas || !nodes.length) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  _graphNodes = nodes;
  _graphEdges = edges;

  // Color palette for directories
  const colors = ['#B84915','#1F5A2E','#2f81f7','#C9A227','#8B1A1A','#6B3FA0','#3178c6','#00ADD8','#f1e05a','#3572A5'];

  // Group by directory
  const dirGroups = {};
  nodes.forEach(n => {
    const dir = n.dir || '(root)';
    if (!dirGroups[dir]) dirGroups[dir] = [];
    dirGroups[dir].push(n);
  });

  const dirKeys = Object.keys(dirGroups);
  const dirColorMap = {};
  dirKeys.forEach((dir, i) => { dirColorMap[dir] = colors[i % colors.length]; });

  if (!skipLayout) {
    // Position: circular layout per group
    const centerX = W / 2, centerY = H / 2;
    const groupRadius = Math.min(W, H) * 0.35;

    dirKeys.forEach((dir, di) => {
      const angle = (di / dirKeys.length) * Math.PI * 2 - Math.PI / 2;
      const cx = centerX + Math.cos(angle) * groupRadius;
      const cy = centerY + Math.sin(angle) * groupRadius;
      const group = dirGroups[dir];
      const nodeRadius = Math.min(40, group.length * 12);

      group.forEach((n, fi) => {
        const nodeAngle = (fi / group.length) * Math.PI * 2;
        n.x = cx + Math.cos(nodeAngle) * nodeRadius;
        n.y = cy + Math.sin(nodeAngle) * nodeRadius;
        n.color = dirColorMap[dir];
      });
    });

    // Force simulation
    for (let iter = 0; iter < 100; iter++) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y;
          const dist = Math.max(Math.sqrt(dx*dx + dy*dy), 1);
          const force = 2000 / (dist * dist);
          nodes[i].x -= (dx/dist)*force; nodes[i].y -= (dy/dist)*force;
          nodes[j].x += (dx/dist)*force; nodes[j].y += (dy/dist)*force;
        }
      }
      edges.forEach(e => {
        const a = nodes[e.from], b = nodes[e.to];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx*dx + dy*dy), 1);
        const force = (dist - 150) * 0.005 * (e.strength || 1);
        a.x += (dx/dist)*force; a.y += (dy/dist)*force;
        b.x -= (dx/dist)*force; b.y -= (dy/dist)*force;
      });
      nodes.forEach(n => {
        n.x += (W/2 - n.x) * 0.003;
        n.y += (H/2 - n.y) * 0.003;
        n.x = Math.max(60, Math.min(W-60, n.x));
        n.y = Math.max(40, Math.min(H-40, n.y));
      });
    }
  }

  // Draw
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#F4EBD7';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(_graphOffset.x, _graphOffset.y);
  ctx.scale(_graphScale, _graphScale);

  // Draw directory group backgrounds
  dirKeys.forEach(dir => {
    const group = dirGroups[dir];
    if (group.length < 2) return;
    const avgX = group.reduce((s,n) => s+n.x, 0) / group.length;
    const avgY = group.reduce((s,n) => s+n.y, 0) / group.length;
    const maxDist = Math.max(...group.map(n => Math.sqrt((n.x-avgX)**2 + (n.y-avgY)**2))) + 30;
    ctx.beginPath();
    ctx.arc(avgX, avgY, maxDist, 0, Math.PI * 2);
    ctx.fillStyle = dirColorMap[dir] + '10';
    ctx.fill();
    ctx.strokeStyle = dirColorMap[dir] + '30';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    // Directory label
    ctx.font = 'bold 10px JetBrains Mono, monospace';
    ctx.fillStyle = dirColorMap[dir];
    ctx.textAlign = 'center';
    ctx.fillText(dir || '(root)', avgX, avgY - maxDist - 6);
  });

  // Draw edges with curves
  edges.forEach(e => {
    const a = nodes[e.from], b = nodes[e.to];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    // Slight curve offset
    const dx = b.x - a.x, dy = b.y - a.y;
    const cx = mx + dy * 0.1, cy = my - dx * 0.1;

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(cx, cy, b.x, b.y);

    if (e.strength >= 3) { ctx.strokeStyle = 'rgba(184,73,21,0.8)'; ctx.lineWidth = 2.5; }
    else if (e.strength >= 2) { ctx.strokeStyle = 'rgba(31,90,46,0.6)'; ctx.lineWidth = 2; }
    else { ctx.strokeStyle = 'rgba(26,17,8,0.15)'; ctx.lineWidth = 1; }
    ctx.stroke();

    // Arrow at midpoint
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(4, 0); ctx.lineTo(-4, -3); ctx.lineTo(-4, 3); ctx.closePath();
    ctx.fillStyle = e.strength >= 3 ? 'rgba(184,73,21,0.8)' : 'rgba(31,90,46,0.6)';
    ctx.fill();
    ctx.restore();
  });

  // Draw nodes
  ctx.textAlign = 'left';
  nodes.forEach(n => {
    // Node circle
    ctx.beginPath();
    ctx.arc(n.x, n.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = n.color;
    ctx.fill();
    ctx.strokeStyle = '#1A1108';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // White inner dot
    ctx.beginPath();
    ctx.arc(n.x, n.y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#F4EBD7';
    ctx.fill();

    // Label
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillStyle = '#1A1108';
    ctx.fillText(n.name, n.x + 11, n.y + 4);
  });

  // Legend in corner
  ctx.textAlign = 'left';
  ctx.font = 'bold 10px JetBrains Mono, monospace';
  ctx.fillStyle = '#6A5440';
  ctx.fillText('Directory Groups:', 12, 20);
  dirKeys.slice(0, 6).forEach((dir, i) => {
    ctx.fillStyle = dirColorMap[dir];
    ctx.fillRect(12, 28 + i * 16, 10, 10);
    ctx.strokeStyle = '#1A1108';
    ctx.strokeRect(12, 28 + i * 16, 10, 10);
    ctx.fillStyle = '#3A2A1C';
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.fillText(dir || '(root)', 26, 37 + i * 16);
  });

  ctx.restore();
}

function drawDirTreeMap(files) {
  const container = document.getElementById('dir-tree-map');
  if (!container) return;

  // Build directory structure with file counts
  const dirCounts = {};
  files.forEach(f => {
    const parts = f.path.split('/');
    for (let i = 1; i <= parts.length - 1; i++) {
      const dir = parts.slice(0, i).join('/');
      dirCounts[dir] = (dirCounts[dir] || 0) + 1;
    }
  });
  dirCounts['(root)'] = files.filter(f => !f.path.includes('/')).length;

  const sorted = Object.entries(dirCounts).sort((a,b) => b[1] - a[1]).slice(0, 20);
  const max = sorted[0]?.[1] || 1;

  container.innerHTML = sorted.map(([dir, count]) => {
    const depth = dir.split('/').length;
    const width = Math.round(count / max * 100);
    return `<div class="treemap-row">
      <span class="treemap-name" style="padding-left:${(depth-1)*12}px">${dir}</span>
      <div class="treemap-bar-bg"><div class="treemap-bar" style="width:${width}%"></div></div>
      <span class="treemap-count">${count} files</span>
    </div>`;
  }).join('');
}
