const fs = require('fs');
const http = require('http');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const buildDir = path.join(root, 'build');
const portalDist = path.join(root, 'portal', 'client', 'dist');
const contentPath = path.join(root, 'content', 'site.json');
const uploadDir = path.join(root, 'assets', 'uploads');
const port = Number(process.env.PORT || 4180);
const portalApiPort = Number(process.env.PORTAL_API_PORT || 8787);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
};

function runBuild() {
  execFileSync(process.execPath, [path.join(root, 'scripts', 'build-static.js')], {
    cwd: root,
    stdio: 'inherit'
  });
}

function runPortalBuild() {
  const portalPackage = path.join(root, 'portal', 'package.json');
  if (!fs.existsSync(portalPackage)) return;
  if (process.platform === 'win32') {
    execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm', '--prefix', path.join(root, 'portal'), 'run', 'build'], {
      cwd: root,
      stdio: 'inherit'
    });
    return;
  }
  execFileSync('npm', ['--prefix', path.join(root, 'portal'), 'run', 'build'], { cwd: root, stdio: 'inherit' });
}

function readContent() {
  return JSON.parse(fs.readFileSync(contentPath, 'utf8'));
}

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 12_000_000) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function listMedia() {
  const files = [];
  const roots = [path.join(root, 'assets')];
  for (const base of roots) {
    if (!fs.existsSync(base)) continue;
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!['.jpg', '.jpeg', '.png', '.webp', '.svg'].includes(path.extname(entry.name).toLowerCase())) continue;
        const relative = path.relative(root, full).replace(/\\/g, '/');
        files.push({ path: relative, name: entry.name, size: fs.statSync(full).size });
      }
    };
    walk(base);
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function safeUploadName(name) {
  const ext = path.extname(name).toLowerCase();
  const base = path.basename(name, ext).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'upload';
  return `${base}-${Date.now()}${ext}`;
}

function serveFile(res, baseDir, urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split('?')[0]);
  const requested = cleanPath === '/' || cleanPath === '/site/' ? '/index.html' : cleanPath.replace(/^\/site/, '');
  const filePath = path.resolve(baseDir, `.${requested}`);
  if (!filePath.startsWith(baseDir)) {
    send(res, 403, 'Forbidden');
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      fs.readFile(path.join(baseDir, 'index.html'), (fallbackError, fallbackData) => {
        if (fallbackError) return send(res, 404, 'Not found');
        send(res, 200, fallbackData, mimeTypes['.html']);
      });
      return;
    }
    send(res, 200, data, mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
  });
}

function servePortalApp(res, urlPath) {
  if (!fs.existsSync(path.join(portalDist, 'index.html'))) {
    send(res, 503, 'Portal app is not built yet. Run: cd portal && npm run build');
    return;
  }
  serveFile(res, portalDist, urlPath.startsWith('/portal-app') ? urlPath.replace(/^\/portal-app/, '') || '/' : '/');
}

function proxyPortalApi(req, res) {
  const options = {
    hostname: '127.0.0.1',
    port: portalApiPort,
    path: req.url,
    method: req.method,
    headers: req.headers
  };
  delete options.headers.host;

  const proxy = http.request(options, (upstream) => {
    const headers = { ...upstream.headers };
    res.writeHead(upstream.statusCode || 502, headers);
    upstream.pipe(res);
  });

  proxy.on('error', () => {
    send(res, 502, `Portal API is not running on http://127.0.0.1:${portalApiPort}`);
  });

  req.pipe(proxy);
}

function editorHtml(content) {
  const initial = JSON.stringify(content).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Alpha Recovery Local Editor</title>
<style>
  :root { --red:#ff1744; --white:#fff; --black:#000; --panel:#0d0d0d; --panel2:#151515; --line:#292929; --muted:#bdbdbd; }
  * { box-sizing:border-box; }
  body { margin:0; min-height:100vh; background:var(--black); color:var(--white); font-family:Montserrat,Arial,sans-serif; overflow:hidden; }
  button, input, textarea, select { font:inherit; }
  .topbar { height:64px; display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:0 1rem; border-bottom:1px solid var(--red); background:#050505; }
  .brand { display:flex; flex-direction:column; gap:0.2rem; }
  .brand strong { font-family:Georgia,serif; font-weight:400; letter-spacing:0.22em; }
  .brand span { color:var(--red); font-size:0.65rem; letter-spacing:0.24em; text-transform:uppercase; }
  .workspace { height:calc(100vh - 64px); display:grid; grid-template-columns:420px minmax(0,1fr); }
  .sidebar { border-right:1px solid var(--line); background:var(--panel); overflow:auto; }
  .canvas { display:flex; flex-direction:column; min-width:0; background:#050505; }
  .toolbar { display:flex; align-items:center; justify-content:space-between; gap:0.75rem; padding:0.75rem; border-bottom:1px solid var(--line); background:#090909; }
  .frame-wrap { flex:1; display:flex; justify-content:center; align-items:stretch; padding:1rem; overflow:auto; }
  iframe { width:100%; max-width:100%; height:100%; border:1px solid var(--red); background:#000; transition:width 0.2s ease; }
  iframe.tablet { width:768px; }
  iframe.mobile { width:390px; }
  .tabs { position:sticky; top:0; z-index:2; display:flex; flex-wrap:wrap; gap:0.35rem; padding:0.75rem; background:#050505; border-bottom:1px solid var(--line); }
  .tab { background:#000; color:#fff; border:1px solid var(--line); padding:0.6rem 0.7rem; cursor:pointer; font-size:0.68rem; letter-spacing:0.12em; text-transform:uppercase; }
  .tab.active { border-color:var(--red); color:var(--red); }
  .panel { padding:1rem; display:grid; gap:1rem; }
  section { border:1px solid var(--line); background:var(--panel2); padding:1rem; }
  h2 { margin:0 0 1rem; color:var(--red); font-size:0.8rem; letter-spacing:0.18em; text-transform:uppercase; font-weight:600; }
  h3 { margin:0 0 0.75rem; font-size:0.72rem; letter-spacing:0.16em; text-transform:uppercase; color:#fff; }
  label { display:grid; gap:0.35rem; margin:0 0 0.85rem; font-size:0.66rem; letter-spacing:0.1em; text-transform:uppercase; color:#ddd; }
  input, textarea, select { width:100%; border:1px solid var(--line); background:#000; color:#fff; padding:0.65rem; line-height:1.4; }
  input[type="color"] { height:42px; padding:0.2rem; }
  textarea { min-height:96px; resize:vertical; }
  .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:0.85rem; }
  .row { display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap; }
  .service, .stat, .media-card, .block-card { border:1px solid #242424; padding:0.9rem; background:#080808; }
  .service[draggable="true"] { cursor:grab; }
  .service.dragging { opacity:0.5; border-color:var(--red); }
  .media-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:0.75rem; }
  .media-card img { width:100%; aspect-ratio:16/10; object-fit:cover; background:#000; border:1px solid var(--line); }
  .media-path { margin-top:0.4rem; font-size:0.62rem; color:var(--muted); word-break:break-all; }
  .button, button { border:1px solid var(--red); background:var(--red); color:#fff; padding:0.65rem 0.85rem; text-decoration:none; text-transform:uppercase; letter-spacing:0.12em; font-size:0.68rem; cursor:pointer; }
  .button.secondary, button.secondary { background:#000; }
  .button.ghost, button.ghost { background:transparent; border-color:var(--line); }
  .button:disabled, button:disabled { opacity:0.45; cursor:not-allowed; }
  #status { color:var(--red); font-size:0.72rem; min-height:1rem; }
  .hint { color:var(--muted); font-size:0.72rem; line-height:1.55; }
  @media (max-width:980px) { body { overflow:auto; } .workspace { height:auto; grid-template-columns:1fr; } .sidebar { max-height:none; } .canvas { height:80vh; } }
</style>
</head>
<body>
<header class="topbar">
  <div class="brand"><strong>ALPHA RECOVERY</strong><span>Local Site Editor</span></div>
  <div class="row">
    <button id="undo" class="secondary" type="button">Undo</button>
    <button id="redo" class="secondary" type="button">Redo</button>
    <button id="save" type="button">Save</button>
    <button id="refreshPreview" class="secondary" type="button">Refresh Preview</button>
    <a class="button secondary" href="/site/" target="_blank" rel="noreferrer">Open Preview</a>
  </div>
</header>
<div class="workspace">
  <aside class="sidebar">
    <nav class="tabs" id="tabs"></nav>
    <main class="panel" id="panel"></main>
  </aside>
  <section class="canvas">
    <div class="toolbar">
      <div class="row">
        <button class="ghost viewport" data-size="desktop" type="button">Desktop</button>
        <button class="ghost viewport" data-size="tablet" type="button">Tablet</button>
        <button class="ghost viewport" data-size="mobile" type="button">Mobile</button>
      </div>
      <div id="status"></div>
    </div>
    <div class="frame-wrap">
      <iframe id="preview" src="/site/?editor=1" title="Local site preview"></iframe>
    </div>
  </section>
</div>
<script>
let state = ${initial};
let activeTab = 'sections';
let media = [];
let history = [JSON.stringify(state)];
let historyIndex = 0;
let saveTimer = null;

const tabs = [
  ['sections', 'Sections'],
  ['content', 'Content'],
  ['design', 'Design'],
  ['media', 'Media'],
  ['seo', 'SEO'],
  ['blocks', 'Blocks'],
  ['forms', 'Forms'],
  ['admin', 'Admin']
];

const panel = document.getElementById('panel');
const statusEl = document.getElementById('status');
const preview = document.getElementById('preview');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function getPath(path) {
  return path.split('.').reduce((current, key) => current && current[key], state);
}

function setPath(path, value, track = true) {
  const parts = path.split('.');
  let target = state;
  while (parts.length > 1) target = target[parts.shift()];
  target[parts[0]] = value;
  if (track) pushHistory();
  scheduleSave();
}

function pushHistory() {
  const snapshot = JSON.stringify(state);
  if (history[historyIndex] === snapshot) return;
  history = history.slice(0, historyIndex + 1);
  history.push(snapshot);
  historyIndex = history.length - 1;
  updateHistoryButtons();
}

function updateHistoryButtons() {
  document.getElementById('undo').disabled = historyIndex === 0;
  document.getElementById('redo').disabled = historyIndex >= history.length - 1;
}

function field(label, path, type = 'input') {
  const value = getPath(path) || '';
  const id = path.replace(/[^a-z0-9]/gi, '-');
  const control = type === 'textarea'
    ? '<textarea id="' + id + '" data-path="' + path + '">' + escapeHtml(value) + '</textarea>'
    : type === 'color'
      ? '<input type="color" id="' + id + '" data-path="' + path + '" value="' + escapeHtml(value) + '" />'
      : '<input id="' + id + '" data-path="' + path + '" value="' + escapeHtml(value) + '" />';
  return '<label><span>' + label + '</span>' + control + '</label>';
}

function imageSelect(path) {
  const value = getPath(path) || '';
  const options = media.map((item) => '<option value="' + escapeHtml(item.path) + '"' + (item.path === value ? ' selected' : '') + '>' + escapeHtml(item.path) + '</option>').join('');
  return '<label><span>Image</span><select data-path="' + path + '"><option value="' + escapeHtml(value) + '">' + escapeHtml(value || 'Choose image') + '</option>' + options + '</select></label>';
}

function selectField(label, path, options) {
  const value = getPath(path);
  return '<label><span>' + label + '</span><select data-path="' + path + '">' + options.map((option) => {
    const selected = String(value) === String(option.value) ? ' selected' : '';
    return '<option value="' + escapeHtml(option.value) + '"' + selected + '>' + escapeHtml(option.label) + '</option>';
  }).join('') + '</select></label>';
}

function isSectionLive(key) {
  state.sections = state.sections || {};
  return state.sections[key] !== false;
}

function sectionCard(key, title, body) {
  const live = isSectionLive(key);
  return \`
    <section class="section-editor-card \${live ? '' : 'deleted'}" data-section-key="\${key}">
      <div class="row">
        <h2 style="flex:1;margin:0">\${title}</h2>
        <button class="\${live ? 'ghost delete-section' : 'secondary restore-section'}" data-section="\${key}" type="button">\${live ? 'Delete Section' : 'Add Section Back'}</button>
      </div>
      \${live ? body : '<p class="hint">This section is deleted from the public page. Add it back to edit or show it again.</p>'}
    </section>
  \`;
}

function renderTabs() {
  document.getElementById('tabs').innerHTML = tabs.map(([id, label]) => '<button type="button" class="tab ' + (activeTab === id ? 'active' : '') + '" data-tab="' + id + '">' + label + '</button>').join('');
}

function renderSections() {
  state.sections = state.sections || { intro: true, nav: true, hero: true, about: true, services: true, contact: true, footer: true };
  state.contact = state.contact || {};
  state.contact.methods = state.contact.methods || [];
  panel.innerHTML = \`
    \${sectionCard('intro', 'Loading Screen', \`
      <div class="grid">\${field('Brand', 'intro.brand')}\${field('Tagline', 'intro.tagline')}</div>
    \`)}
    \${sectionCard('nav', 'Navigation / Header', \`
      <div class="grid">\${field('Brand Title', 'nav.title')}\${field('Subtitle', 'nav.subtitle')}</div>
      \${field('Get Started Button', 'nav.button')}
      <p class="hint">Dropdown links are controlled by the Careers pages and route files.</p>
    \`)}
    \${sectionCard('hero', 'First Section / Hero', \`
      \${field('Hero Line 1', 'hero.titleLines.0')}
      \${field('Hero Line 2', 'hero.titleLines.1')}
      \${field('Hero Line 3 Red', 'hero.titleLines.2')}
      \${field('Description', 'hero.description', 'textarea')}
      <div class="grid">\${field('Primary Button', 'hero.primaryButton')}\${field('Secondary Button', 'hero.secondaryButton')}</div>
    \`)}
    \${sectionCard('about', 'Who We Are / Mission & Vision', \`
      <div class="grid">\${field('Section Label', 'about.tag')}\${field('Section Title', 'about.title')}</div>
      <div class="row"><button id="addParagraph" class="secondary" type="button">Add Paragraph</button><button id="addStat" class="secondary" type="button">Add Stat</button></div>
      \${(state.about?.paragraphs || []).map((paragraph, index) => \`<div class="block-card"><div class="row"><h3 style="flex:1">Paragraph \${index + 1}</h3><button class="ghost remove-paragraph" data-index="\${index}" type="button">Delete Paragraph</button></div>\${field('Text', 'about.paragraphs.' + index, 'textarea')}</div>\`).join('')}
      <div class="grid">\${(state.about?.stats || []).map((stat, index) => \`<div class="stat"><div class="row"><h3 style="flex:1">Stat \${index + 1}</h3><button class="ghost remove-stat" data-index="\${index}" type="button">Delete Stat</button></div>\${field('Value', 'about.stats.' + index + '.value')}\${field('Label', 'about.stats.' + index + '.label')}</div>\`).join('')}</div>
      <div class="grid">\${field('Vision Title', 'missionVision.visionTitle')}\${field('Mission Title', 'missionVision.missionTitle')}</div>
      \${field('Vision Statement', 'missionVision.visionText', 'textarea')}
      \${field('Mission Statement', 'missionVision.missionText', 'textarea')}
    \`)}
    \${sectionCard('services', 'Core Services', \`
      <div class="grid">\${field('Section Label', 'services.tag')}\${field('Section Title', 'services.title')}</div>
      <div class="row"><button id="addService" class="secondary" type="button">Add Service</button></div>
      \${(state.services?.items || []).map((service, index) => \`
        <div class="service" draggable="true" data-service="\${index}">
          <div class="row"><h3 style="flex:1">Service \${index + 1}</h3><button class="ghost move" data-index="\${index}" data-dir="-1" type="button">Up</button><button class="ghost move" data-index="\${index}" data-dir="1" type="button">Down</button><button class="ghost remove-service" data-index="\${index}" type="button">Delete Service</button></div>
          \${field('Name', 'services.items.' + index + '.title')}
          \${field('Description', 'services.items.' + index + '.description', 'textarea')}
          \${imageSelect('services.items.' + index + '.image')}
        </div>
      \`).join('')}
    \`)}
    \${sectionCard('contact', 'Contact', \`
      <div class="grid">\${field('Section Label', 'contact.tag')}\${field('Section Title', 'contact.title')}</div>
      \${field('Description', 'contact.description', 'textarea')}
      <div class="row"><button id="addContactMethod" class="secondary" type="button">Add Contact Option</button></div>
      \${(state.contact.methods || []).map((method, index) => \`
        <div class="block-card">
          <div class="row"><h3 style="flex:1">\${escapeHtml(method.label || 'Contact Option')}</h3><button class="ghost remove-contact-method" data-index="\${index}" type="button">Delete Full Option</button></div>
          <div class="grid">\${field('Label', 'contact.methods.' + index + '.label')}\${selectField('Type', 'contact.methods.' + index + '.type', [{ value: 'email', label: 'Email' }, { value: 'phone', label: 'Phone' }, { value: 'text', label: 'Text / Address' }])}</div>
          \${field('Value', 'contact.methods.' + index + '.value')}
          \${selectField('Display', 'contact.methods.' + index + '.enabled', [{ value: 'true', label: 'On Page' }, { value: 'false', label: 'Deleted From Page' }])}
        </div>
      \`).join('')}
      \${field('Button', 'contact.button')}
    \`)}
    \${sectionCard('footer', 'Footer', \`
      \${field('Copyright', 'footer.copyright')}
      \${field('Tagline', 'footer.tagline')}
    \`)}
    <section>
      <h2>Main Blocks / Added Sections</h2>
      <p class="hint">These are additional page sections. You can add, edit, reorder, disable, or delete them.</p>
      <div class="row"><button class="secondary" data-tab-jump="blocks" type="button">Open Block Editor</button></div>
    </section>
  \`;
}

function renderContent() {
  panel.innerHTML = \`
    <section>
      <h2>Hero</h2>
      <div class="grid">\${field('Intro Tagline', 'intro.tagline')}\${field('Nav Subtitle', 'nav.subtitle')}</div>
      \${field('Hero Line 1', 'hero.titleLines.0')}
      \${field('Hero Line 2', 'hero.titleLines.1')}
      \${field('Hero Line 3 Red', 'hero.titleLines.2')}
      \${field('Hero Description', 'hero.description', 'textarea')}
      <div class="grid">\${field('Primary Button', 'hero.primaryButton')}\${field('Secondary Button', 'hero.secondaryButton')}</div>
    </section>
    <section>
      <h2>Services</h2>
      <div class="grid">\${field('Section Label', 'services.tag')}\${field('Section Title', 'services.title')}</div>
      <p class="hint">Drag service cards here to reorder them. Use Media tab to upload new files.</p>
      <div class="row"><button id="addService" class="secondary" type="button">Add Service</button></div>
      \${state.services.items.map((service, index) => \`
        <div class="service" draggable="true" data-service="\${index}">
          <div class="row"><h3 style="flex:1">Service \${index + 1}</h3><button class="ghost move" data-index="\${index}" data-dir="-1" type="button">Up</button><button class="ghost move" data-index="\${index}" data-dir="1" type="button">Down</button><button class="ghost remove-service" data-index="\${index}" type="button">Delete</button></div>
          \${field('Name', 'services.items.' + index + '.title')}
          \${field('Description', 'services.items.' + index + '.description', 'textarea')}
          \${imageSelect('services.items.' + index + '.image')}
        </div>
      \`).join('')}
    </section>
    <section>
      <h2>About</h2>
      <div class="grid">\${field('Section Label', 'about.tag')}\${field('Section Title', 'about.title')}</div>
      <div class="row"><button id="addParagraph" class="secondary" type="button">Add Paragraph</button></div>
      \${state.about.paragraphs.map((paragraph, index) => \`<div class="block-card"><div class="row"><h3 style="flex:1">Paragraph \${index + 1}</h3><button class="ghost remove-paragraph" data-index="\${index}" type="button">Delete</button></div>\${field('Text', 'about.paragraphs.' + index, 'textarea')}</div>\`).join('')}
      <div class="row"><button id="addStat" class="secondary" type="button">Add Stat</button></div>
      <div class="grid">
        \${state.about.stats.map((stat, index) => \`<div class="stat"><div class="row"><h3 style="flex:1">Stat \${index + 1}</h3><button class="ghost remove-stat" data-index="\${index}" type="button">Delete</button></div>\${field('Value', 'about.stats.' + index + '.value')}\${field('Label', 'about.stats.' + index + '.label')}</div>\`).join('')}
      </div>
    </section>
    <section>
      <h2>Mission & Vision</h2>
      <div class="grid">\${field('Vision Title', 'missionVision.visionTitle')}\${field('Mission Title', 'missionVision.missionTitle')}</div>
      \${field('Vision Statement', 'missionVision.visionText', 'textarea')}
      \${field('Mission Statement', 'missionVision.missionText', 'textarea')}
    </section>
    <section>
      <h2>Careers</h2>
      <div class="grid">\${field('Section Label', 'careers.tag')}\${field('Section Title', 'careers.title')}</div>
      \${field('Description', 'careers.description', 'textarea')}
      <div class="row"><button id="addCareer" class="secondary" type="button">Add Career Card</button></div>
      \${(state.careers?.positions || []).map((position, index) => \`
        <div class="block-card">
          <div class="row"><h3 style="flex:1">Career Card \${index + 1}</h3><button class="ghost remove-career" data-index="\${index}" type="button">Delete</button></div>
          \${field('Title', 'careers.positions.' + index + '.title')}
          \${field('Description', 'careers.positions.' + index + '.description', 'textarea')}
          <div class="grid">\${field('Type', 'careers.positions.' + index + '.type')}\${field('Location', 'careers.positions.' + index + '.location')}</div>
        </div>
      \`).join('')}
      \${field('CTA Text', 'careers.ctaText', 'textarea')}
      <div class="grid">\${field('Button Text', 'careers.button')}\${field('Button Link', 'careers.buttonHref')}</div>
    </section>
    <section>
      <h2>Current Opportunities</h2>
      <p class="hint">These populate the standalone Current Opportunities page. Each role opens into a detail panel when clicked.</p>
      <div class="row"><button id="addJob" class="secondary" type="button">Add Job</button></div>
      \${(state.opportunities?.jobs || []).map((job, index) => \`
        <div class="block-card">
          <div class="row"><h3 style="flex:1">Job \${index + 1}</h3><button class="ghost remove-job" data-index="\${index}" type="button">Delete</button></div>
          \${field('Title', 'opportunities.jobs.' + index + '.title')}
          <div class="grid">\${field('Slug', 'opportunities.jobs.' + index + '.slug')}\${field('Status', 'opportunities.jobs.' + index + '.status')}</div>
          <div class="grid">\${field('Department', 'opportunities.jobs.' + index + '.department')}\${field('Location', 'opportunities.jobs.' + index + '.location')}</div>
          <div class="grid">\${field('Employment Type', 'opportunities.jobs.' + index + '.employmentType')}\${field('Clearance', 'opportunities.jobs.' + index + '.clearanceRequirement')}</div>
          <div class="grid">\${field('Reports To', 'opportunities.jobs.' + index + '.reportsTo')}\${field('Pay Range', 'opportunities.jobs.' + index + '.payRange')}</div>
          <div class="grid">\${field('Travel', 'opportunities.jobs.' + index + '.travelRequirement')}\${field('Background', 'opportunities.jobs.' + index + '.backgroundRequirement')}</div>
          \${field('Apply Link', 'opportunities.jobs.' + index + '.applyUrl')}
          \${field('Summary', 'opportunities.jobs.' + index + '.summary', 'textarea')}
          \${field('Position Summary', 'opportunities.jobs.' + index + '.positionSummary', 'textarea')}
        </div>
      \`).join('')}
    </section>
    <section>
      <h2>Contact</h2>
      <div class="grid">\${field('Section Label', 'contact.tag')}\${field('Section Title', 'contact.title')}</div>
      \${field('Description', 'contact.description', 'textarea')}
      <div class="row"><button id="addContactMethod" class="secondary" type="button">Add Contact Option</button></div>
      \${(state.contact?.methods || []).map((method, index) => \`
        <div class="block-card">
          <div class="row"><h3 style="flex:1">\${escapeHtml(method.label || 'Contact Option')}</h3><button class="ghost remove-contact-method" data-index="\${index}" type="button">Delete Full Option</button></div>
          <div class="grid">\${field('Label', 'contact.methods.' + index + '.label')}\${selectField('Type', 'contact.methods.' + index + '.type', [{ value: 'email', label: 'Email' }, { value: 'phone', label: 'Phone' }, { value: 'text', label: 'Text / Address' }])}</div>
          \${field('Value', 'contact.methods.' + index + '.value')}
          \${selectField('Display', 'contact.methods.' + index + '.enabled', [{ value: 'true', label: 'On Page' }, { value: 'false', label: 'Deleted From Page' }])}
        </div>
      \`).join('')}
      \${field('Button', 'contact.button')}
    </section>
    <section><h2>Footer</h2>\${field('Copyright', 'footer.copyright')}\${field('Tagline', 'footer.tagline')}</section>
  \`;
}

function renderDesign() {
  panel.innerHTML = \`
    <section>
      <h2>Global Design System</h2>
      <div class="grid">\${field('Bright Red', 'design.primaryRed', 'color')}\${field('Background', 'design.background', 'color')}\${field('Text', 'design.text', 'color')}\${field('Section Spacing', 'design.sectionSpacing')}</div>
      <p class="hint">These values apply to the local preview through CSS variables. Typography hooks are stored for the next layout pass.</p>
    </section>
  \`;
}

function renderSeo() {
  panel.innerHTML = \`
    <section>
      <h2>SEO & Technical</h2>
      \${field('Meta Title', 'seo.title')}
      \${field('Meta Description', 'seo.description', 'textarea')}
      \${field('URL Slug', 'seo.slug')}
      \${field('Analytics ID', 'seo.analyticsId')}
      \${field('Custom CSS', 'seo.customCss', 'textarea')}
      \${field('Custom Body Script', 'seo.customBodyScript', 'textarea')}
      <p class="hint">Custom code is for local testing first. We review it before pushing live.</p>
    </section>
  \`;
}

function renderMedia() {
  panel.innerHTML = \`
    <section>
      <h2>Media Library</h2>
      <input id="upload" type="file" accept="image/*" />
      <p class="hint">Uploaded files are saved under assets/uploads and become available in service image dropdowns.</p>
    </section>
    <section>
      <h2>Available Media</h2>
      <div class="media-grid">\${media.map((item) => \`<div class="media-card"><img src="/site/\${escapeHtml(item.path)}" alt=""><div class="media-path">\${escapeHtml(item.path)}</div><button class="ghost copy-path" data-path="\${escapeHtml(item.path)}" type="button">Copy Path</button></div>\`).join('')}</div>
    </section>
  \`;
}

function renderBlocks() {
  panel.innerHTML = \`
    <section>
      <h2>Content Blocks & Templates</h2>
      <p class="hint">Add reusable sections here. Enabled blocks render on the public homepage before Contact.</p>
      <div class="row">
        <button class="secondary add-block" data-type="text" type="button">Add Text Block</button>
        <button class="secondary add-block" data-type="testimonial" type="button">Add Testimonial</button>
        <button class="secondary add-block" data-type="jobs" type="button">Add Jobs Block</button>
        <button class="secondary add-block" data-type="image" type="button">Add Image Block</button>
      </div>
      \${(state.blocks || []).map((block, index) => \`<div class="block-card"><div class="row"><h3 style="flex:1">\${escapeHtml(block.type || 'block')} Block</h3><button class="ghost move-block" data-index="\${index}" data-dir="-1" type="button">Up</button><button class="ghost move-block" data-index="\${index}" data-dir="1" type="button">Down</button><button class="ghost remove-block" data-index="\${index}" type="button">Delete</button></div><label><span>Enabled</span><select data-path="blocks.\${index}.enabled"><option value="true" \${block.enabled ? 'selected' : ''}>Enabled</option><option value="false" \${!block.enabled ? 'selected' : ''}>Disabled</option></select></label>\${field('Title', 'blocks.' + index + '.title')}\${field('Description', 'blocks.' + index + '.description', 'textarea')}\${block.image !== undefined ? imageSelect('blocks.' + index + '.image') : ''}</div>\`).join('')}
    </section>
  \`;
}

function renderForms() {
  panel.innerHTML = \`
    <section>
      <h2>Form Builder</h2>
      <p class="hint">The marketing site can show forms, but submissions need a backend. This area is reserved for the jobs/application portal so we can capture leads and applications properly.</p>
      <div class="grid">\${field('Contact Email', 'contact.email')}\${field('Contact Button', 'contact.button')}</div>
    </section>
    <section>
      <h2>Audience & Social</h2>
      \${field('LinkedIn', 'social.linkedin')}
      \${field('Facebook', 'social.facebook')}
      \${field('Instagram', 'social.instagram')}
      \${field('X / Twitter', 'social.x')}
    </section>
  \`;
}

function renderAdmin() {
  panel.innerHTML = \`
    <section>
      <h2>Management</h2>
      <p class="hint">Local editor mode. Nothing goes live until changes are committed and pushed.</p>
      <div class="row"><button id="exportJson" type="button">Export JSON</button><button id="saveLocal" class="secondary" type="button">Save & Rebuild</button></div>
    </section>
    <section>
      <h2>Roles & Permissions</h2>
      <p class="hint">Local-only editing has one operator. Multi-user roles should be added when we build the portal backend.</p>
    </section>
  \`;
}

function renderPanel() {
  renderTabs();
  if (activeTab === 'sections') renderSections();
  if (activeTab === 'content') renderContent();
  if (activeTab === 'design') renderDesign();
  if (activeTab === 'media') renderMedia();
  if (activeTab === 'seo') renderSeo();
  if (activeTab === 'blocks') renderBlocks();
  if (activeTab === 'forms') renderForms();
  if (activeTab === 'admin') renderAdmin();
  bindControls();
}

function bindControls() {
  document.querySelectorAll('[data-path]').forEach((control) => {
    control.addEventListener('input', () => {
      const value = control.tagName === 'SELECT' && (control.value === 'true' || control.value === 'false') ? control.value === 'true' : control.value;
      setPath(control.dataset.path, value);
    });
  });
  document.querySelectorAll('.move').forEach((button) => button.addEventListener('click', () => moveService(Number(button.dataset.index), Number(button.dataset.dir))));
  document.querySelectorAll('[data-tab-jump]').forEach((button) => button.addEventListener('click', () => {
    activeTab = button.dataset.tabJump;
    renderPanel();
  }));
  document.querySelectorAll('.delete-section').forEach((button) => button.addEventListener('click', () => {
    state.sections = state.sections || {};
    state.sections[button.dataset.section] = false;
    pushHistory();
    scheduleSave();
    renderPanel();
  }));
  document.querySelectorAll('.restore-section').forEach((button) => button.addEventListener('click', () => {
    state.sections = state.sections || {};
    state.sections[button.dataset.section] = true;
    ensureSectionDefaults(button.dataset.section);
    pushHistory();
    scheduleSave();
    renderPanel();
  }));
  const addService = document.getElementById('addService');
  if (addService) addService.addEventListener('click', () => {
    state.services.items.push({
      title: 'New Service',
      description: 'Describe the new service here.',
      image: media[0] ? media[0].path : 'assets/services/security.jpg'
    });
    pushHistory();
    scheduleSave();
    renderPanel();
  });
  document.querySelectorAll('.remove-service').forEach((button) => button.addEventListener('click', () => {
    state.services.items.splice(Number(button.dataset.index), 1);
    pushHistory();
    scheduleSave();
    renderPanel();
  }));
  const addParagraph = document.getElementById('addParagraph');
  if (addParagraph) addParagraph.addEventListener('click', () => {
    state.about.paragraphs.push('New about paragraph.');
    pushHistory();
    scheduleSave();
    renderPanel();
  });
  document.querySelectorAll('.remove-paragraph').forEach((button) => button.addEventListener('click', () => {
    state.about.paragraphs.splice(Number(button.dataset.index), 1);
    pushHistory();
    scheduleSave();
    renderPanel();
  }));
  const addStat = document.getElementById('addStat');
  if (addStat) addStat.addEventListener('click', () => {
    state.about.stats.push({ value: '100+', label: 'New Metric' });
    pushHistory();
    scheduleSave();
    renderPanel();
  });
  document.querySelectorAll('.remove-stat').forEach((button) => button.addEventListener('click', () => {
    state.about.stats.splice(Number(button.dataset.index), 1);
    pushHistory();
    scheduleSave();
    renderPanel();
  }));
  const addCareer = document.getElementById('addCareer');
  if (addCareer) addCareer.addEventListener('click', () => {
    state.careers = state.careers || { tag: 'Careers', title: 'Join Alpha Recovery', description: '', positions: [], ctaText: '', button: 'Apply Now', buttonHref: 'mailto:Admin@alpharecovery.org?subject=Alpha%20Recovery%20Careers' };
    state.careers.positions = state.careers.positions || [];
    state.careers.positions.push({ title: 'New Role', description: 'Describe the opportunity.', type: 'Contract', location: 'Nationwide' });
    pushHistory();
    scheduleSave();
    renderPanel();
  });
  document.querySelectorAll('.remove-career').forEach((button) => button.addEventListener('click', () => {
    state.careers.positions.splice(Number(button.dataset.index), 1);
    pushHistory();
    scheduleSave();
    renderPanel();
  }));
  const addJob = document.getElementById('addJob');
  if (addJob) addJob.addEventListener('click', () => {
    state.opportunities = state.opportunities || { jobs: [] };
    state.opportunities.jobs = state.opportunities.jobs || [];
    state.opportunities.jobs.push({
      id: 'new-role-' + Date.now(),
      slug: 'new-role-' + Date.now(),
      title: 'New Role',
      department: 'Operations',
      location: 'Nationwide',
      employmentType: 'Contract',
      clearanceRequirement: 'Background Investigation Required',
      reportsTo: 'Hiring Manager',
      payRange: 'Based on assignment',
      travelRequirement: 'Varies by assignment',
      backgroundRequirement: 'Background investigation may be required',
      status: 'open',
      summary: 'Describe the opportunity.',
      positionSummary: 'Describe the position overview.',
      responsibilities: ['Add responsibility.'],
      requiredQualifications: ['Add required qualification.'],
      preferredQualifications: ['Add preferred qualification.'],
      workEnvironment: ['Add work environment.'],
      applyUrl: '/portal/register?job=new-role'
    });
    pushHistory();
    scheduleSave();
    renderPanel();
  });
  document.querySelectorAll('.remove-job').forEach((button) => button.addEventListener('click', () => {
    state.opportunities.jobs.splice(Number(button.dataset.index), 1);
    pushHistory();
    scheduleSave();
    renderPanel();
  }));
  const addContactMethod = document.getElementById('addContactMethod');
  if (addContactMethod) addContactMethod.addEventListener('click', () => {
    state.contact = state.contact || {};
    state.contact.methods = state.contact.methods || [];
    state.contact.methods.push({ label: 'New Option', value: 'Add contact detail', type: 'text', enabled: true });
    pushHistory();
    scheduleSave();
    renderPanel();
  });
  document.querySelectorAll('.remove-contact-method').forEach((button) => button.addEventListener('click', () => {
    state.contact.methods.splice(Number(button.dataset.index), 1);
    pushHistory();
    scheduleSave();
    renderPanel();
  }));
  document.querySelectorAll('.add-block').forEach((button) => button.addEventListener('click', () => {
    const type = button.dataset.type;
    const block = { type, title: 'New Block', enabled: true, description: 'Add content here.' };
    if (type === 'testimonial') block.items = [{ quote: 'Add a client quote here.', name: 'Client Name' }];
    if (type === 'image') block.image = media[0] ? media[0].path : 'assets/atlanta-skyline.webp';
    if (type === 'jobs') block.description = 'Add job or hiring details here.';
    state.blocks = state.blocks || [];
    state.blocks.push(block);
    pushHistory();
    scheduleSave();
    renderPanel();
  }));
  document.querySelectorAll('.move-block').forEach((button) => button.addEventListener('click', () => {
    reorderBlock(Number(button.dataset.index), Number(button.dataset.index) + Number(button.dataset.dir));
  }));
  document.querySelectorAll('.remove-block').forEach((button) => button.addEventListener('click', () => {
    state.blocks.splice(Number(button.dataset.index), 1);
    pushHistory();
    scheduleSave();
    renderPanel();
  }));
  document.querySelectorAll('.service[draggable="true"]').forEach((card) => {
    card.addEventListener('dragstart', () => card.classList.add('dragging'));
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    card.addEventListener('dragover', (event) => event.preventDefault());
    card.addEventListener('drop', (event) => {
      event.preventDefault();
      const from = Number(document.querySelector('.service.dragging')?.dataset.service);
      const to = Number(card.dataset.service);
      if (!Number.isNaN(from) && !Number.isNaN(to) && from !== to) reorderService(from, to);
    });
  });
  document.querySelectorAll('.copy-path').forEach((button) => button.addEventListener('click', () => navigator.clipboard.writeText(button.dataset.path)));
  const upload = document.getElementById('upload');
  if (upload) upload.addEventListener('change', uploadMedia);
  const exportButton = document.getElementById('exportJson');
  if (exportButton) exportButton.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'site.json';
    a.click();
  });
  const saveLocal = document.getElementById('saveLocal');
  if (saveLocal) saveLocal.addEventListener('click', saveNow);
}

function moveService(index, dir) {
  reorderService(index, index + dir);
}

function reorderService(from, to) {
  if (to < 0 || to >= state.services.items.length) return;
  const [item] = state.services.items.splice(from, 1);
  state.services.items.splice(to, 0, item);
  pushHistory();
  scheduleSave();
  renderPanel();
}

function reorderBlock(from, to) {
  state.blocks = state.blocks || [];
  if (to < 0 || to >= state.blocks.length) return;
  const [item] = state.blocks.splice(from, 1);
  state.blocks.splice(to, 0, item);
  pushHistory();
  scheduleSave();
  renderPanel();
}

function ensureSectionDefaults(key) {
  if (key === 'intro') state.intro = state.intro || { brand: 'ALPHA RECOVERY', tagline: 'Intelligence Beyond Sight' };
  if (key === 'nav') state.nav = state.nav || { title: 'ALPHA RECOVERY', subtitle: 'Intelligence Beyond Sight', button: 'Get Started' };
  if (key === 'hero') state.hero = state.hero || { titleLines: ['Intelligence', 'that', 'Protects.'], accentLine: 2, description: '', primaryButton: 'Request Consultation', secondaryButton: 'Explore Services' };
  if (key === 'about') {
    state.about = state.about || { tag: 'Who We Are', title: 'We Are Alpha!', paragraphs: ['Add about text here.'], stats: [] };
    state.about.paragraphs = state.about.paragraphs || [];
    state.about.stats = state.about.stats || [];
    state.missionVision = state.missionVision || { visionTitle: 'Vision Statement', visionText: '', missionTitle: 'Mission Statement', missionText: '' };
  }
  if (key === 'services') {
    state.services = state.services || { tag: 'What We Do', title: 'Core Services', items: [] };
    state.services.items = state.services.items || [];
  }
  if (key === 'contact') {
    state.contact = state.contact || { tag: 'Get In Touch', title: 'Contact Us', description: '', button: 'Send Us a Message', methods: [] };
    state.contact.methods = state.contact.methods || [{ label: 'Email', value: 'Admin@alpharecovery.org', type: 'email', enabled: true }];
  }
  if (key === 'footer') state.footer = state.footer || { copyright: '© 2026 Alpha Recovery LLC - All Rights Reserved', tagline: 'Intelligence Beyond Sight' };
}

async function uploadMedia(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    statusEl.textContent = 'Uploading media...';
    const response = await fetch('/api/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: file.name, dataUrl: reader.result })
    });
    if (!response.ok) {
      statusEl.textContent = 'Upload failed.';
      return;
    }
    await loadMedia();
    renderPanel();
    statusEl.textContent = 'Media uploaded.';
  };
  reader.readAsDataURL(file);
}

function scheduleSave() {
  statusEl.textContent = 'Unsaved changes...';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveOnly, 900);
}

async function saveOnly() {
  statusEl.textContent = 'Saving and rebuilding preview...';
  const response = await fetch('/api/content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state, null, 2)
  });
  if (!response.ok) {
    statusEl.textContent = 'Save failed.';
    return;
  }
  statusEl.textContent = 'Saved locally. Refresh preview when ready.';
}

async function saveNow() {
  await saveOnly();
  preview.src = '/site/?editor=1&v=' + Date.now();
  statusEl.textContent = 'Saved locally. Preview refreshed.';
}

async function loadMedia() {
  const response = await fetch('/api/media');
  media = response.ok ? await response.json() : [];
}

document.getElementById('tabs').addEventListener('click', (event) => {
  const tab = event.target.closest('[data-tab]');
  if (!tab) return;
  activeTab = tab.dataset.tab;
  renderPanel();
});

document.getElementById('save').addEventListener('click', saveNow);
document.getElementById('refreshPreview').addEventListener('click', saveNow);
document.getElementById('undo').addEventListener('click', () => {
  if (historyIndex === 0) return;
  historyIndex -= 1;
  state = JSON.parse(history[historyIndex]);
  updateHistoryButtons();
  renderPanel();
  scheduleSave();
});
document.getElementById('redo').addEventListener('click', () => {
  if (historyIndex >= history.length - 1) return;
  historyIndex += 1;
  state = JSON.parse(history[historyIndex]);
  updateHistoryButtons();
  renderPanel();
  scheduleSave();
});
document.querySelectorAll('.viewport').forEach((button) => button.addEventListener('click', () => {
  preview.className = button.dataset.size === 'desktop' ? '' : button.dataset.size;
}));

loadMedia().then(() => {
  updateHistoryButtons();
  renderPanel();
});
</script>
</body>
</html>`;
}

runBuild();
runPortalBuild();

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    send(res, 200, editorHtml(readContent()), mimeTypes['.html']);
    return;
  }

  if (req.method === 'GET' && req.url === '/api/content') {
    send(res, 200, JSON.stringify(readContent()), mimeTypes['.json']);
    return;
  }

  if (req.method === 'GET' && req.url === '/api/media') {
    send(res, 200, JSON.stringify(listMedia()), mimeTypes['.json']);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/content') {
    try {
      const body = await collectBody(req);
      const content = JSON.parse(body);
      fs.writeFileSync(contentPath, `${JSON.stringify(content, null, 2)}\n`);
      runBuild();
      send(res, 200, JSON.stringify({ ok: true }), mimeTypes['.json']);
    } catch (error) {
      send(res, 400, JSON.stringify({ ok: false, error: error.message }), mimeTypes['.json']);
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/media') {
    try {
      const body = JSON.parse(await collectBody(req));
      const match = /^data:([^;]+);base64,(.+)$/.exec(body.dataUrl || '');
      if (!match || !match[1].startsWith('image/')) throw new Error('Only image uploads are supported');
      fs.mkdirSync(uploadDir, { recursive: true });
      const fileName = safeUploadName(body.name || 'upload.png');
      const filePath = path.join(uploadDir, fileName);
      fs.writeFileSync(filePath, Buffer.from(match[2], 'base64'));
      runBuild();
      send(res, 200, JSON.stringify({ ok: true, path: `assets/uploads/${fileName}` }), mimeTypes['.json']);
    } catch (error) {
      send(res, 400, JSON.stringify({ ok: false, error: error.message }), mimeTypes['.json']);
    }
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/site')) {
    serveFile(res, buildDir, req.url);
    return;
  }

  if (req.url.startsWith('/api/')) {
    proxyPortalApi(req, res);
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/portal-app/')) {
    servePortalApp(res, req.url);
    return;
  }

  if (req.method === 'GET' && /^\/(apply|admin|login|portal)(\/|$)/.test(req.url.split('?')[0])) {
    servePortalApp(res, '/');
    return;
  }

  send(res, 404, 'Not found');
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Editor available at http://127.0.0.1:${port}`);
  console.log(`Preview available at http://127.0.0.1:${port}/site/`);
});
