/* =========================================================
   LTH-code (PREMIUM LIBRARY VERSION 2.0)
     <div class="lth-prog-tabs">
    <button class="lth-prog-tab" data-tab="terminal">Terminal</button>
    <button class="lth-prog-tab active" data-tab="editor">Editor</button>
    <button class="lth-prog-tab" data-tab="tools">Tools</button>
  </div>
   ========================================================= */


(function () {
  'use strict';

  function getRuntimePaths() {
    return window.LTHRuntimePaths?.get?.() || window.__LTH_RUNTIME_PATHS || {};
  }

  const PROG_APP_ID = 'lth-prog';
  const PROG_APP_NAME = 'LTH PROG';
  const PROG_APP_ICON_URL = '../assets/LTH-CODE.png';
  const PROG_APP_GRADIENT = 'linear-gradient(135deg,#140726 0%,#43207d 54%,#f3b347 100%)';
  const PROG_APP_ICON_HTML = `<img src="${PROG_APP_ICON_URL}" alt="${PROG_APP_NAME}" style="width:72px;height:72px;object-fit:contain;display:block;filter:drop-shadow(0 10px 18px rgba(28,10,58,.38));">`;

  // ── _ProgFS: reemplazo de electron.storage usando electron.fs ──
  // Solo usa: createFolder, writeFile, readFile, itemExists
  const _ProgFS = {
    _root: null,
    _getRoot() {
      if (this._root) return this._root;
      const runtimeRoot = String(getRuntimePaths()?.packageRoot || '').trim();
      if (runtimeRoot) {
        this._root = runtimeRoot;
        return this._root;
      }
      try {
        let base = decodeURIComponent(window.location.href)
          .replace(/^file:\/\/\//, '').replace(/\/index\.html.*$/, '').replace(/\//g, '\\');
        if (!base.match(/^[A-Za-z]:\\/)) base = base.replace(/^\\/, '');
        const i = base.lastIndexOf('\\');
        if (i > 2) base = base.substring(0, i);
        this._root = base;
      } catch(e) { this._root = ''; }
      return this._root;
    },
    _systemDataRoot() {
      const runtimeData = String(getRuntimePaths()?.data || '').trim();
      return runtimeData || (this._getRoot() ? (this._getRoot() + '\\sistema LTH') : '');
    },
    _base() {
      const runtimeAppData = String(getRuntimePaths()?.appData || '').trim();
      return runtimeAppData ? (runtimeAppData + '\\LTH PROG') : (this._systemDataRoot() + '\\LTH PROG');
    },
    _projDir() {
      const runtimeProjects = String(getRuntimePaths()?.projects || '').trim();
      return runtimeProjects || (this._base() + '\\projects');
    },
    _dir(name)    { return this._projDir() + '\\' + name; },
    _meta(name)   { return this._dir(name) + '\\' + name + '.lthproject'; },
    _indexPath()  { return this._projDir() + '\\_index.json'; },
    _cfgPath(key) { return this._base() + '\\' + key + '.json'; },
    _appsDir() {
      const runtimeInstalled = String(getRuntimePaths()?.installedApps || '').trim();
      return runtimeInstalled || (this._getRoot() ? (this._getRoot() + '\\src\\apps') : '');
    },
    _systemRegistryPath() {
      const runtimeRegistry = String(getRuntimePaths()?.systemRegistry || '').trim();
      return runtimeRegistry || (this._systemDataRoot() + '\\system.lth');
    },
    _appDataDir(appId) {
      const runtimeAppData = String(getRuntimePaths()?.appData || '').trim();
      const base = runtimeAppData || (this._systemDataRoot() + '\\Apps Data');
      return base + '\\' + String(appId || 'app');
    },

    // ── Leer/escribir índice de proyectos ──
    async _readIndex() {
      try {
        const r = await window.electron.fs.readFile(this._indexPath());
        const t = typeof r === 'string' ? r : (r?.content || r?.data || '');
        return JSON.parse(t);
      } catch(e) { return []; }
    },
    async _writeIndex(list) {
      try { await window.electron.fs.writeFile(this._indexPath(), JSON.stringify(list)); } catch(e) {}
    },

    async init() {
      try {
        await window.electron.fs.createFolder(this._systemDataRoot(), { recursive: true });
        await window.electron.fs.createFolder(this._projDir(), { recursive: true });
      } catch(e) {}
    },

    async saveProject(name, data) {
      const FS = window.electron?.fs;
      if (!FS) return { success: false };
      try {
        const dir = this._dir(name);
        await FS.createFolder(dir, { recursive: true });

        // Escribir cada archivo real
        const files = data.filesList || [];
        for (const f of files) {
          if (f.name && f.content != null) {
            await FS.writeFile(dir + '\\' + f.name, f.content);
          }
        }

        // .lthproject = metadata (sin contenido, solo estructura)
        const meta = {
          name: data.name || name,
          filesList: files.map(f => ({ id: f.id, name: f.name, type: f.type })),
          activeFileId: data.activeFileId || null,
          hiddenFiles: data.hiddenFiles || [],
          device: data.device, split: data.split,
          lastModified: data.lastModified || new Date().toISOString()
        };
        await FS.writeFile(this._meta(name), JSON.stringify(meta, null, 2));

        // Actualizar índice
        const idx = await this._readIndex();
        if (!idx.includes(name)) { idx.push(name); await this._writeIndex(idx); }

        return { success: true };
      } catch(e) { return { success: false, error: e.message }; }
    },

    async loadProject(name) {
      const FS = window.electron?.fs;
      if (!FS) return { success: false };
      const dir = this._dir(name);

      const _read = async (p) => {
        try {
          const r = await FS.readFile(p);
          return typeof r === 'string' ? r : (r?.content || r?.data || '');
        } catch(e) { return null; }
      };

      // Leer .lthproject
      let meta = null;
      const raw = await _read(this._meta(name));
      if (raw) try { meta = JSON.parse(raw); } catch(e) {}

      if (!meta) return { success: false };

      // Leer contenido de cada archivo del disco
      if (Array.isArray(meta.filesList)) {
        for (const f of meta.filesList) {
          f.content = (await _read(dir + '\\' + f.name)) || '';
        }
      }

      // Reconstruir legacy files
      const h = (meta.filesList||[]).find(f => f.type === 'html');
      const c = (meta.filesList||[]).find(f => f.type === 'css');
      const j = (meta.filesList||[]).find(f => f.type === 'js');
      meta.files = { html: h ? {...h} : {content:''}, css: c ? {...c} : {content:''}, js: j ? {...j} : {content:''} };

      return { success: true, project: meta };
    },

    async listProjects() {
      const idx = await this._readIndex();
      return { success: true, projects: idx };
    },

    async deleteProject(name) {
      // Quitar del índice (no podemos borrar archivos sin deleteFolder)
      const idx = await this._readIndex();
      const filtered = idx.filter(n => n !== name);
      await this._writeIndex(filtered);
      return { success: true };
    },

    async saveAppConfig(key, data) {
      try {
        await window.electron.fs.createFolder(this._base(), { recursive: true });
        await window.electron.fs.writeFile(this._cfgPath(key), JSON.stringify(data, null, 2));
      } catch(e) {}
    },

    async loadAppConfig(key) {
      try {
        const r = await window.electron.fs.readFile(this._cfgPath(key));
        const t = typeof r === 'string' ? r : (r?.content || r?.data || '');
        return { success: true, config: JSON.parse(t) };
      } catch(e) { return { success: false }; }
    },

    async getPaths() {
      return {
        success: true,
        paths: {
          root: this._getRoot(),
          dataRoot: this._systemDataRoot(),
          data: this._base(),
          projects: this._projDir()
        }
      };
    },

    // Solo lee metadata (sin contenido de archivos) — para listar proyectos rápido
    async loadProjectMeta(name) {
      const FS = window.electron?.fs;
      if (!FS) return { success: false };
      try {
        const r = await FS.readFile(this._meta(name));
        const t = typeof r === 'string' ? r : (r?.content || r?.data || '');
        const meta = JSON.parse(t);
        // Reconstruir legacy files vacíos para compat con el panel
        const h = (meta.filesList||[]).find(f => f.type === 'html');
        const c = (meta.filesList||[]).find(f => f.type === 'css');
        const j = (meta.filesList||[]).find(f => f.type === 'js');
        meta.files = { html: h||{content:''}, css: c||{content:''}, js: j||{content:''} };
        return { success: true, project: meta };
      } catch(e) { return { success: false }; }
    },

    _normalizeInstalledAppEntry(appId, entry = {}) {
      return {
        appId: String(entry.appId || appId || '').trim(),
        name: String(entry.name || entry.appId || appId || 'App').trim(),
        jsPath: String(entry.jsPath || '').trim(),
        sourceFolder: String(entry.sourceFolder || '').trim(),
        htmlFile: String(entry.htmlFile || '').trim(),
        installedAt: entry.installedAt || new Date().toISOString(),
        dataPaths: Array.isArray(entry.dataPaths)
          ? entry.dataPaths.map(value => String(value || '').trim()).filter(Boolean)
          : [],
        storageKeys: Array.isArray(entry.storageKeys)
          ? entry.storageKeys.map(value => String(value || '').trim()).filter(Boolean)
          : [],
        storagePrefixes: Array.isArray(entry.storagePrefixes)
          ? entry.storagePrefixes.map(value => String(value || '').trim()).filter(Boolean)
          : [],
        legacyIds: Array.isArray(entry.legacyIds)
          ? entry.legacyIds.map(value => String(value || '').trim()).filter(Boolean)
          : []
      };
    },

    async loadSystemRegistry() {
      const empty = { version: 1, apps: {} };
      try {
        const result = await window.electron.fs.readFile(this._systemRegistryPath());
        const raw = typeof result === 'string' ? result : (result?.content || result?.data || '');
        const parsed = JSON.parse(raw || '{}');
        const apps = {};

        Object.entries(parsed?.apps || {}).forEach(([appId, entry]) => {
          apps[appId] = this._normalizeInstalledAppEntry(appId, entry);
        });

        return { success: true, registry: { version: 1, apps } };
      } catch (e) {
        return { success: true, registry: empty };
      }
    },

    async saveSystemRegistry(registry) {
      try {
        await window.electron.fs.createFolder(this._systemDataRoot(), { recursive: true });
        await window.electron.fs.writeFile(
          this._systemRegistryPath(),
          JSON.stringify(registry, null, 2)
        );
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },

    async registerInstalledApp(entry) {
      const loaded = await this.loadSystemRegistry();
      const registry = loaded.registry || { version: 1, apps: {} };
      const normalized = this._normalizeInstalledAppEntry(entry?.appId, entry);
      if (!normalized.appId) return { success: false, error: 'App sin ID' };
      registry.apps[normalized.appId] = normalized;
      const saved = await this.saveSystemRegistry(registry);
      return saved.success
        ? { success: true, app: normalized }
        : saved;
    },

    async unregisterInstalledApp(appId) {
      const loaded = await this.loadSystemRegistry();
      const registry = loaded.registry || { version: 1, apps: {} };
      const existing = registry.apps?.[appId] || null;
      if (registry.apps && appId in registry.apps) {
        delete registry.apps[appId];
      }
      const saved = await this.saveSystemRegistry(registry);
      return saved.success
        ? { success: true, app: existing }
        : saved;
    },

    async listInstalledApps() {
      const loaded = await this.loadSystemRegistry();
      const registry = loaded.registry || { version: 1, apps: {} };
      const systemIds = new Set(
        (window.AppLoader?.systemApps || []).map(id => String(id || '').toLowerCase())
      );
      const found = new Map();

      try {
        const result = await window.electron.fs.readDirectory(this._appsDir());
        const files = result?.files || [];

        files
          .filter(file => file?.name?.endsWith('.js'))
          .forEach(file => {
            const fileId = String(file.name || '').replace(/\.js$/i, '');
            const appDef = window.LTH_APPS?.[fileId] || window.LTH_APPS?.[fileId.toLowerCase()];
            const canonicalId = String(appDef?.id || fileId).trim();

            if (!canonicalId || systemIds.has(canonicalId.toLowerCase())) return;

            const registryEntry = registry.apps?.[canonicalId] || registry.apps?.[fileId] || {};
            found.set(canonicalId, this._normalizeInstalledAppEntry(canonicalId, {
              name: appDef?.name || registryEntry.name || fileId,
              jsPath: registryEntry.jsPath || file.path || (this._appsDir() + '\\' + file.name),
              sourceFolder: registryEntry.sourceFolder || '',
              htmlFile: registryEntry.htmlFile || '',
              installedAt: registryEntry.installedAt,
              dataPaths: registryEntry.dataPaths || [],
              storageKeys: registryEntry.storageKeys || [],
              storagePrefixes: registryEntry.storagePrefixes || [],
              legacyIds: [
                ...(registryEntry.legacyIds || []),
                ...((Array.isArray(appDef?.legacyIds) ? appDef.legacyIds : []))
              ]
            }));
          });
      } catch (e) {}

      Object.entries(registry.apps || {}).forEach(([appId, entry]) => {
        if (!appId || systemIds.has(appId.toLowerCase()) || found.has(appId)) return;
        found.set(appId, this._normalizeInstalledAppEntry(appId, entry));
      });

      return {
        success: true,
        apps: [...found.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
      };
    }
  };

  function uniqStrings(values) {
    return [...new Set(
      (Array.isArray(values) ? values : [])
        .map(value => String(value || '').trim())
        .filter(Boolean)
    )];
  }

  function resolveInstalledAppManifest(entry) {
    const appDef = window.LTH_APPS?.[entry?.appId]
      || window.LTH_APPS?.[String(entry?.appId || '').toLowerCase()]
      || null;

    let dynamicManifest = {};
    try {
      if (typeof appDef?.getUninstallManifest === 'function') {
        dynamicManifest = appDef.getUninstallManifest() || {};
      }
    } catch (e) {
      console.warn('[LTH PROG] No se pudo leer manifest de desinstalación:', e?.message || e);
    }

    return {
      appId: String(appDef?.id || entry?.appId || '').trim(),
      name: String(appDef?.name || entry?.name || entry?.appId || 'App').trim(),
      jsPath: String(entry?.jsPath || dynamicManifest?.jsPath || '').trim(),
      dataPaths: uniqStrings([...(entry?.dataPaths || []), ...(dynamicManifest?.dataPaths || [])]),
      storageKeys: uniqStrings([...(entry?.storageKeys || []), ...(dynamicManifest?.storageKeys || [])]),
      storagePrefixes: uniqStrings([...(entry?.storagePrefixes || []), ...(dynamicManifest?.storagePrefixes || [])]),
      legacyIds: uniqStrings([
        ...(entry?.legacyIds || []),
        ...(Array.isArray(appDef?.legacyIds) ? appDef.legacyIds : []),
        ...(dynamicManifest?.legacyIds || [])
      ])
    };
  }

  // Inicializar carpeta
  if (window.electron?.fs) _ProgFS.init();

  window.LTH_APPS = window.LTH_APPS || {};

  window.LTH_APPS[PROG_APP_ID] = {
    id: PROG_APP_ID,
    name: PROG_APP_NAME,
    version: '1.2.0',
    iconUrl: PROG_APP_ICON_URL,
    icon: PROG_APP_ICON_HTML,
    gradient: PROG_APP_GRADIENT,
    titlebarIconWrapStyle: 'width:18px;height:18px;display:block;border-radius:7px;overflow:hidden;background:linear-gradient(160deg,rgba(31,12,60,.98),rgba(79,34,145,.92));box-shadow:0 2px 8px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.12);',
    titlebarIconStyle: 'width:100%;height:100%;object-fit:cover;display:block;transform:scale(1.08);filter:saturate(1.03) contrast(1.02);',
    chipIconStyle: 'width:100%;height:100%;object-fit:cover;border-radius:14px;display:block;',

    state: {
      currentTab: 'editor',
      editorTab: 'html',
      split: false,
      live: false,
      device: 'pc',
      
      // ✅ NUEVO: Sistema de proyectos
      currentProject: null,  // Nombre del proyecto actual
      autoSave: false,       // Autoguardado activado/desactivado
      lastSaved: null,       // Timestamp del último guardado
      exportPath: null,      // Ruta de exportación guardada
      workspaceMode: 'project', // 'project' | 'folder'
      folderPath: null,      // Ruta de la carpeta abierta externamente
      folderTree: null,      // Árbol recursivo de la carpeta externa
      folderFilesIndex: [],  // Índice plano de archivos vistos en esa carpeta
      expandedFolderPaths: [], // Carpetas abiertas en el explorador
      folderMemoryPath: null,
      folderMemoryContext: '',

      

// ✅ NUEVO: multi-archivo (VS style)
activeFileId: 'html-1',

filesList: [],
      hiddenFiles: [],   // Archivos ocultos del tab bar (no borrados)
      terminalHistory: [],
      lastPlan: null,
      lastExecutableEdits: null,
      lastTargetFiles: [],
      lastApplySummary: null,
      lastApplyFailure: null,
      lastPreviewSnapshot: null
    },

async _loadProgCssFragment(relativePath) {
  this._cssFragmentCache = this._cssFragmentCache || {};
  const cacheKey = String(relativePath || '').trim();
  if (cacheKey && this._cssFragmentCache[cacheKey]) return this._cssFragmentCache[cacheKey];

  const normalizeRelativePath = (value) => String(value || '')
    .replace(/^[/\\]+/, '')
    .replace(/\//g, '\\');

  const looksLikeCss = (value) => {
    const cleaned = String(value || '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim();
    return cleaned.length > 24;
  };

  const getFileCandidates = (value) => {
    const normalizedRelative = normalizeRelativePath(value);
    const runtime = getRuntimePaths();
    const candidates = new Set();
    const push = (basePath, suffix = '') => {
      const base = String(basePath || '').trim().replace(/[\\\/]+$/, '');
      if (!base) return;
      candidates.add(`${base}${suffix}${normalizedRelative}`);
    };

    push(runtime?.builtinApps, '\\lth-prog\\');
    push(runtime?.packageRoot, '\\src\\apps\\lth-prog\\');
    push(_ProgFS._getRoot(), '\\src\\apps\\lth-prog\\');

    return [...candidates];
  };

  const getUrlCandidates = (value) => {
    const normalizedRelative = String(value || '')
      .replace(/^[/\\]+/, '')
      .replace(/\\/g, '/');
    const urls = new Set();
    const addRelative = (relativeHref) => {
      try {
        urls.add(new URL(relativeHref, window.location.href).href);
      } catch {}
    };

    addRelative(`./apps/lth-prog/${normalizedRelative}`);
    addRelative(`./src/apps/lth-prog/${normalizedRelative}`);

    const builtinApps = String(getRuntimePaths()?.builtinApps || '').trim();
    if (builtinApps) {
      const normalizedBase = builtinApps.replace(/\\/g, '/').replace(/^\/+/, '');
      urls.add(encodeURI(`file:///${normalizedBase}/lth-prog/${normalizedRelative}`));
    }

    return [...urls];
  };

  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (window.electron?.fs) {
      for (const absolutePath of getFileCandidates(relativePath)) {
        try {
          const result = await window.electron.fs.readFile(absolutePath);
          const cssCandidate = typeof result === 'string'
            ? result
            : (result?.content || result?.data || '');

          if (looksLikeCss(cssCandidate)) {
            this._cssFragmentCache[cacheKey] = cssCandidate;
            return cssCandidate;
          }

          if (result?.success === false && result?.error) {
            lastError = new Error(result.error);
          }
        } catch (err) {
          lastError = err;
        }
      }
    }

    for (const href of getUrlCandidates(relativePath)) {
      try {
        const response = await fetch(href);
        if (!response.ok) {
          lastError = new Error(`HTTP ${response.status} al cargar ${href}`);
          continue;
        }

        const cssCandidate = await response.text();
        if (looksLikeCss(cssCandidate)) {
          this._cssFragmentCache[cacheKey] = cssCandidate;
          return cssCandidate;
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (attempt < 3) {
      await wait(120 * attempt);
    }
  }

  console.warn('[LTH PROG] No se pudo cargar CSS externo:', relativePath, lastError?.message || lastError || 'sin detalle');
  return '';
},

render(container) {
  // ═══════════════════════════════════════════════════════
  //  SPLASH SCREEN — se muestra INMEDIATAMENTE mientras
  //  todo el editor pesado carga por detrás sin pantallazos
  // ═══════════════════════════════════════════════════════
  try { this._cleanupGlobalNodes && this._cleanupGlobalNodes(); } catch {}
  this._isClosed = false;
  this._activeRenderCycle = (Number(this._activeRenderCycle) || 0) + 1;
  const renderCycle = this._activeRenderCycle;
  this._currentContainer = container;
  if (this._bootFrame) {
    try { cancelAnimationFrame(this._bootFrame); } catch {}
    this._bootFrame = null;
  }
  if (this._bootTimer) {
    clearTimeout(this._bootTimer);
    this._bootTimer = null;
  }

  container.innerHTML = `
<style>
.lthp-splash{position:absolute;inset:0;z-index:999999;background:radial-gradient(circle at top,#241048 0%,#10081f 28%,#05070e 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.lthp-splash *{box-sizing:border-box}

/* Fondo animado */
.lthp-splash-bg{position:absolute;inset:0;overflow:hidden}
.lthp-splash-bg::before{content:'';position:absolute;width:640px;height:640px;top:-240px;left:-160px;background:radial-gradient(circle,rgba(173,94,255,.24) 0%,transparent 72%);animation:lthpOrb1 8s ease-in-out infinite}
.lthp-splash-bg::after{content:'';position:absolute;width:540px;height:540px;bottom:-200px;right:-120px;background:radial-gradient(circle,rgba(243,179,71,.18) 0%,transparent 72%);animation:lthpOrb2 10s ease-in-out infinite}
@keyframes lthpOrb1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(60px,40px) scale(1.15)}}
@keyframes lthpOrb2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-50px,-30px) scale(1.1)}}

/* Grid de código fake en el fondo */
.lthp-splash-grid{position:absolute;inset:0;opacity:.03;background-image:
  linear-gradient(rgba(173,94,255,.34) 1px,transparent 1px),
  linear-gradient(90deg,rgba(173,94,255,.34) 1px,transparent 1px);
  background-size:40px 40px}

/* Partículas de código */
.lthp-particle{position:absolute;font-family:'Courier New',monospace;font-size:11px;color:rgba(196,154,255,.2);animation:lthpFloat var(--dur,12s) linear infinite;white-space:nowrap;pointer-events:none}
@keyframes lthpFloat{0%{transform:translateY(100vh) rotate(0deg);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateY(-20vh) rotate(8deg);opacity:0}}

/* Contenido central */
.lthp-splash-center{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;gap:20px}

/* Logo actual de LTH PROG */
.lthp-splash-bolt-wrap{
  width:116px;height:116px;position:relative;
  display:flex;align-items:center;justify-content:center;
}
.lthp-splash-bolt-ring{
  position:absolute;inset:0;border-radius:32px;
  border:1px solid rgba(143,105,220,.3);
  animation:lthpRingPulse 2s ease-in-out infinite;
}
.lthp-splash-bolt-ring:nth-child(2){animation-delay:.5s;border-color:rgba(243,179,71,.2);inset:-8px;border-radius:36px}
.lthp-splash-bolt-ring:nth-child(3){animation-delay:1s;border-color:rgba(173,94,255,.12);inset:-16px;border-radius:40px}
@keyframes lthpRingPulse{0%,100%{opacity:.3;transform:scale(1)}50%{opacity:1;transform:scale(1.04)}}

.lthp-splash-bolt{
  width:90px;height:90px;padding:0;
  background:linear-gradient(160deg,rgba(42,18,80,.96),rgba(84,39,156,.88));
  border:1px solid rgba(214,170,255,.28);
  border-radius:28px;display:grid;place-items:center;
  box-shadow:0 0 60px rgba(118,75,162,.3),0 0 120px rgba(243,179,71,.14),0 20px 50px rgba(0,0,0,.45);
  animation:lthpBoltFloat 3s ease-in-out infinite;
  position:relative;z-index:2;overflow:hidden;
}
@keyframes lthpBoltFloat{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-6px) scale(1.02)}}
.lthp-splash-bolt::before{
  content:'';
  position:absolute;inset:5px;
  border-radius:22px;
  background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,0) 28%),linear-gradient(160deg,#6332b9 0%,#2a0f59 100%);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.12), inset 0 -8px 18px rgba(12,4,28,.28);
}
.lthp-splash-bolt img{
  position:relative;z-index:1;
  width:114%;height:114%;
  object-fit:cover;object-position:center;
  display:block;
  transform:scale(.96);
  filter:drop-shadow(0 8px 20px rgba(2,12,32,.55))
}

.lthp-splash-kicker{
  font-size:10px;font-weight:800;letter-spacing:4px;text-transform:uppercase;
  color:rgba(215,189,255,.76);margin-bottom:-10px;
}

/* Texto */
.lthp-splash-title{
  font-size:28px;font-weight:900;letter-spacing:1.5px;
  background:linear-gradient(135deg,#f7f0ff,#a78bfa,#f3b347,#f7f0ff);
  background-size:300% 100%;
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
  background-clip:text;
  animation:lthpTextShimmer 3s ease-in-out infinite;
}
@keyframes lthpTextShimmer{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}

.lthp-splash-version{
  font-size:11px;letter-spacing:3.6px;text-transform:uppercase;
  color:rgba(224,210,245,.62);font-weight:600;margin-top:-10px;
}

/* Barra de progreso */
.lthp-splash-progress{
  width:240px;display:flex;flex-direction:column;align-items:center;gap:10px;margin-top:8px;
}
.lthp-splash-bar-track{
  width:100%;height:3px;background:rgba(173,94,255,.14);border-radius:99px;overflow:hidden;
  position:relative;
}
.lthp-splash-bar-fill{
  height:100%;width:0%;border-radius:99px;
  background:linear-gradient(90deg,#8b5cf6,#f3b347,#8b5cf6);
  background-size:200% 100%;
  animation:lthpBarShimmer 1.5s linear infinite;
  transition:width .6s cubic-bezier(.4,0,.2,1);
}
@keyframes lthpBarShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}

.lthp-splash-status{
  font-size:11px;color:rgba(220,212,235,.5);font-weight:500;
  min-height:16px;transition:color .3s;letter-spacing:.5px;
}

/* Líneas de código decorativas */
.lthp-splash-code-lines{
  position:absolute;bottom:40px;left:50%;transform:translateX(-50%);
  display:flex;flex-direction:column;gap:4px;opacity:.06;
}
.lthp-splash-code-line{
  height:2px;border-radius:99px;background:linear-gradient(90deg,#a78bfa,transparent);
  animation:lthpCodeLine .8s ease-out forwards;
  opacity:0;transform:translateX(-20px);
}
@keyframes lthpCodeLine{to{opacity:1;transform:translateX(0)}}

/* Hide transition */
.lthp-splash.hide{opacity:0;visibility:hidden;transition:opacity .5s ease,visibility .5s ease}
</style>

<div class="lthp-splash" id="lthpSplash">
  <div class="lthp-splash-bg"></div>
  <div class="lthp-splash-grid"></div>

  <!-- Partículas de código flotantes -->
  <div class="lthp-particle" style="left:8%;--dur:14s;animation-delay:0s">&lt;div class="app"&gt;</div>
  <div class="lthp-particle" style="left:22%;--dur:11s;animation-delay:-3s">const x = await fetch()</div>
  <div class="lthp-particle" style="left:45%;--dur:16s;animation-delay:-7s">function render() {</div>
  <div class="lthp-particle" style="left:65%;--dur:13s;animation-delay:-2s">.container { display: grid }</div>
  <div class="lthp-particle" style="left:80%;--dur:15s;animation-delay:-5s">export default App</div>
  <div class="lthp-particle" style="left:35%;--dur:12s;animation-delay:-9s">import { useState }</div>
  <div class="lthp-particle" style="left:55%;--dur:17s;animation-delay:-4s">npm run build</div>
  <div class="lthp-particle" style="left:12%;--dur:14s;animation-delay:-8s">git commit -m "feat"</div>
  <div class="lthp-particle" style="left:72%;--dur:11s;animation-delay:-1s">border-radius: 12px;</div>
  <div class="lthp-particle" style="left:90%;--dur:13s;animation-delay:-6s">console.log('⚡')</div>

  <div class="lthp-splash-center">
    <div class="lthp-splash-bolt-wrap">
      <div class="lthp-splash-bolt-ring"></div>
      <div class="lthp-splash-bolt-ring"></div>
      <div class="lthp-splash-bolt-ring"></div>
      <div class="lthp-splash-bolt">
        <img src="${PROG_APP_ICON_URL}" alt="${PROG_APP_NAME}">
      </div>
    </div>
    <div class="lthp-splash-kicker">Programación Inteligente</div>
    <div class="lthp-splash-title">${PROG_APP_NAME}</div>
    <div class="lthp-splash-version">Editor + IA integrada</div>
    <div class="lthp-splash-progress">
      <div class="lthp-splash-bar-track"><div class="lthp-splash-bar-fill" id="lthpSplashBar"></div></div>
      <div class="lthp-splash-status" id="lthpSplashStatus">Preparando workspace...</div>
    </div>
  </div>

  <div class="lthp-splash-code-lines">
    <div class="lthp-splash-code-line" style="width:120px;animation-delay:.2s"></div>
    <div class="lthp-splash-code-line" style="width:80px;animation-delay:.35s"></div>
    <div class="lthp-splash-code-line" style="width:160px;animation-delay:.5s"></div>
    <div class="lthp-splash-code-line" style="width:60px;animation-delay:.65s"></div>
    <div class="lthp-splash-code-line" style="width:140px;animation-delay:.8s"></div>
  </div>
</div>
<div id="lthpAppContainer" style="opacity:0;transition:opacity .4s ease"></div>
`;

  // Animar barra inmediatamente
  const splashBar = container.querySelector('#lthpSplashBar');
  const splashStatus = container.querySelector('#lthpSplashStatus');
  if (splashBar) setTimeout(() => splashBar.style.width = '15%', 50);

  // Cargar todo por detrás después de que el splash pinte
  this._bootFrame = requestAnimationFrame(() => {
    this._bootTimer = setTimeout(() => {
      this._bootTimer = null;
      this._bootEditor(container, splashBar, splashStatus, renderCycle);
    }, 80);
  });
},

_bootEditor(container, splashBar, splashStatus, renderCycle) {
  const isStaleBoot = () => (
    this._isClosed ||
    this._currentContainer !== container ||
    this._activeRenderCycle !== renderCycle ||
    !container?.isConnected
  );

  if (isStaleBoot()) return;

  const appContainer = container.querySelector('#lthpAppContainer');
  if (!appContainer) return;

  const updateSplash = (pct, msg) => {
    if (isStaleBoot()) return;
    if (splashBar) splashBar.style.width = pct + '%';
    if (splashStatus) splashStatus.textContent = msg;
  };

  updateSplash(25, 'Construyendo interfaz...');

  // Función async interna para poder usar await
  (async () => {
  try {
  updateSplash(30, 'Cargando estilos...');
  // Carga fragmentos CSS externos para mantener el archivo raiz mas liviano.
  const [
    externalLayoutCss,
    externalComponentsCss,
    externalEffectsCss,
    externalSettingsCss,
    externalExplorerCss
  ] = await Promise.all([
    this._loadProgCssFragment('styles/lth-prog-layout.css'),
    this._loadProgCssFragment('styles/lth-prog-components.css'),
    this._loadProgCssFragment('styles/lth-prog-effects.css'),
    this._loadProgCssFragment('styles/lth-prog-settings.css'),
    this._loadProgCssFragment('styles/lth-prog-explorer.css')
  ]);
  if (isStaleBoot()) return;
  updateSplash(38, 'Construyendo interfaz...');

  // Insertar todo el HTML pesado en el contenedor oculto
  appContainer.innerHTML = `
<div class="lth-prog-root compact split-off" data-device="pc">
  <!-- 🟢 PUNTO VERDE ACTIVADOR -->
  <div class="tools-trigger" id="toolsTrigger" title="Click para mostrar/ocultar herramientas"></div>

  <!-- 🔴 OVERLAY FULLSCREEN PARA RUN -->
      <div class="lth-run-overlay" id="lthRunOverlay">
        <button class="lth-run-exit" id="runOverlayClose" type="button" aria-label="Salir de RUN" title="Salir de RUN (ESC)">ESC</button>
        <iframe id="runOverlayFrame" sandbox="allow-scripts allow-modals allow-same-origin allow-forms allow-popups" allowfullscreen></iframe>
      </div>

  <!-- ⚙️ PANEL DE CONFIGURACIÓN -->
  <div class="lth-settings-overlay" id="lthSettingsOverlay">
    <div class="lth-settings-panel" id="lthSettingsPanel">
      <div class="lth-settings-header">
        <span style="font-size:20px">⚙️</span>
        <h2>Configuración — LTH PROG</h2>
        <button class="lth-settings-close" id="lthSettingsClose">✕</button>
      </div>
      <div class="lth-settings-body">
        <nav class="lth-settings-nav" id="lthSettingsNav">
          <div class="lth-settings-nav-item active" data-tab="rutas"><span class="lth-snav-icon">📂</span> Rutas</div>
          <div class="lth-settings-nav-item" data-tab="editor"><span class="lth-snav-icon">✏️</span> Editor</div>
          <div class="lth-settings-nav-item" data-tab="portabilidad"><span class="lth-snav-icon">📦</span> Portabilidad</div>
          <div class="lth-settings-nav-item" data-tab="sistema"><span class="lth-snav-icon">🖥️</span> Sistema</div>
          <div class="lth-settings-nav-item" data-tab="acerca"><span class="lth-snav-icon">ℹ️</span> Acerca de</div>
        </nav>
        <div class="lth-settings-content" id="lthSettingsContent">
          <!-- Contenido dinámico -->
        </div>
      </div>
    </div>
  </div>
 
 









  

  <div class="lth-prog-content">
    <div class="lth-prog-panel" data-panel="terminal">
      <div class="terminal-container">
        <div class="terminal-header">
          <div class="terminal-dot red"></div>
          <div class="terminal-dot yellow"></div>
          <div class="terminal-dot green"></div>
          <div class="terminal-title">LTH Terminal</div>
        </div>
        <div class="terminal-output" id="terminalOutput">
          <div class="terminal-line"><span class="terminal-success">LTH PROG Terminal v1.2</span></div>
          <div class="terminal-line"><span class="terminal-info">help | run | clear — Live console también llega aquí</span></div>
        </div>
        <div class="terminal-input-line">
          <span class="terminal-prompt">$</span>
          <input type="text" class="terminal-input" id="terminalInput" placeholder="Enter command..." autocomplete="off">
        </div>
      </div>
    </div>

    <div class="lth-prog-panel active" data-panel="editor">
      <div class="editor-container">
        <div class="editor-toolbar" id="editorToolbar">
          <div class="toolbar-left">
            <div class="menu-wrap">
              <button class="toolbar-btn menu-btn" id="fileMenuBtn" title="Archivo">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6L9 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                  <path d="M9 2v4h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M5.5 9h5M5.5 11.5h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                </svg>
                <span>Archivo</span>
                <svg class="caret-svg" width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2.5 3.5L5 6.5l2.5-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>













              <div class="menu-panel" id="fileMenuPanel" aria-hidden="true">
                <button class="menu-item" id="newFileBtn">
                  <span class="menu-item-icon" aria-hidden="true">
                    <svg viewBox="0 0 16 16" fill="none">
                      <path d="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6L9 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                      <path d="M9 2v4h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M6 9h4M8 7v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                    </svg>
                  </span>
                  <span>Nuevo</span>
                </button>
                <button class="menu-item" id="openFileBtn">
                  <span class="menu-item-icon" aria-hidden="true">
                    <svg viewBox="0 0 16 16" fill="none">
                      <path d="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6L9 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                      <path d="M9 2v4h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M5.5 9h5M5.5 11.5h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                    </svg>
                  </span>
                  <span>Abrir Archivo</span>
                </button>
                <button class="menu-item" id="openFolderBtn">
                  <span class="menu-item-icon" aria-hidden="true">
                    <svg viewBox="0 0 16 16" fill="none">
                      <path d="M2 5a1 1 0 011-1h3.586a1 1 0 01.707.293L8 5h5a1 1 0 011 1v6.5a1 1 0 01-1 1H3a1 1 0 01-1-1V5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                    </svg>
                  </span>
                  <span>Abrir Carpeta</span>
                </button>
                <div class="menu-sep"></div>
                <button class="menu-item" id="saveFileBtn">
                  <span class="menu-item-icon" aria-hidden="true">
                    <svg viewBox="0 0 16 16" fill="none">
                      <path d="M3 2.5h8l2 2V13a1 1 0 01-1 1H4a1 1 0 01-1-1V2.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                      <path d="M5 2.5v3h5v-3M5.5 10h5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                    </svg>
                  </span>
                  <span>Guardar</span>
                </button>
                <button class="menu-item" id="saveAsBtn">
                  <span class="menu-item-icon" aria-hidden="true">
                    <svg viewBox="0 0 16 16" fill="none">
                      <path d="M3 2.5h8l2 2V13a1 1 0 01-1 1H4a1 1 0 01-1-1V2.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                      <path d="M5 2.5v3h5v-3M5.5 10h5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                      <path d="M11.5 11.5h2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                    </svg>
                  </span>
                  <span>Guardar como...</span>
                </button>
              </div>
            </div>
           <button class="toolbar-btn" id="guideBtn" title="Guía">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2C5.24 2 3 4.24 3 7c0 1.85 1 3.47 2.5 4.33V13h5v-1.67C12 10.47 13 8.85 13 7c0-2.76-2.24-5-5-5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                  <path d="M6 13h4M8 6v3M8 5v.01" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                </svg>
                <span>Guía</span>
           </button>

           <button class="toolbar-btn toolbar-btn-ia" id="iaBtn" title="LTH IA · GLM-5.2 (Pro)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
                  <path d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"/>
                </svg>
                <span>IA</span>
           </button>


















            <div class="menu-wrap">
              <button class="toolbar-btn menu-btn" id="projectMenuBtn" title="Proyectos">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M2 5a1 1 0 011-1h3.586a1 1 0 01.707.293L8 1h5a1 1 0 011 1" stroke="currentColor" stroke-width="1.3"/>
                  <rect x="2" y="5" width="12" height="9" rx="1" stroke="currentColor" stroke-width="1.3"/>
                  <path d="M5.5 9.5l1.5 1.5 3-3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>Proyectos</span>
                <svg class="caret-svg" width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2.5 3.5L5 6.5l2.5-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <div class="menu-panel" id="projectMenuPanel" aria-hidden="true">
                <button class="menu-item" id="saveProjectBtn">
                  <span class="menu-item-icon" aria-hidden="true">
                    <svg viewBox="0 0 16 16" fill="none">
                      <path d="M3 2.5h8l2 2V13a1 1 0 01-1 1H4a1 1 0 01-1-1V2.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                      <path d="M5 2.5v3h5v-3M5.5 10h5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                    </svg>
                  </span>
                  <span>Guardar Proyecto</span>
                </button>
                <button class="menu-item lth-save-to-btn" id="saveProjectToBtn">
                  <span class="menu-item-icon" aria-hidden="true">
                    <svg viewBox="0 0 16 16" fill="none">
                      <path d="M2.5 8h8.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                      <path d="M8.5 5l3 3-3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M2.5 3.5h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity=".55"/>
                      <path d="M2.5 12.5h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity=".55"/>
                    </svg>
                  </span>
                  <span>Guardar en...</span>
                </button>
                <button class="menu-item lth-quick-save-btn" id="saveProjectQuickBtn" style="display:none">
                  <span class="menu-item-icon" aria-hidden="true">
                    <svg viewBox="0 0 16 16" fill="none">
                      <path d="M8.8 1.5L4.5 8h2.8L6.8 14.5 11.5 7.5H8.7l.1-6z" fill="currentColor"/>
                    </svg>
                  </span>
                  <span>Guardar en ruta guardada</span>
                </button>
                <div class="lth-path-indicator" id="exportPathIndicator"></div>
                <button class="menu-item lth-change-path-btn" id="changeExportPathBtn" style="display:none">
                  <span class="menu-item-icon" aria-hidden="true">
                    <svg viewBox="0 0 16 16" fill="none">
                      <path d="M2 5a1 1 0 011-1h3.586a1 1 0 01.707.293L8 5h5a1 1 0 011 1v6.5a1 1 0 01-1 1H3a1 1 0 01-1-1V5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                    </svg>
                  </span>
                  <span>Cambiar ruta de exportacion</span>
                </button>
                <button class="menu-item" id="openProjectBtn">
                  <span class="menu-item-icon" aria-hidden="true">
                    <svg viewBox="0 0 16 16" fill="none">
                      <path d="M2 5a1 1 0 011-1h3.586a1 1 0 01.707.293L8 5h5a1 1 0 011 1v6.5a1 1 0 01-1 1H3a1 1 0 01-1-1V5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                      <path d="M5.5 9l1.5 1.5L10.5 7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </span>
                  <span>Abrir Proyecto</span>
                </button>
                <div class="menu-sep"></div>
                <button class="menu-item" id="autoSaveToggle">
                  <span class="menu-item-icon" aria-hidden="true">
                    <svg viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.3"/>
                      <path d="M8 4.7v3.5l2.2 1.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </span>
                  <span>Autoguardado: OFF</span>
                </button>
              </div>
            </div>
          </div>

          <div class="toolbar-center">
            <span class="current-file" id="currentFileName">index.html</span>
            <span class="project-indicator" id="projectIndicator" style="display:none;margin-left:10px;color:#7dd3fc;font-size:11px;"></span>
            <span class="lth-workspace-badge" id="workspaceBadge"></span>
          </div>

          <div class="toolbar-right">
            <div class="chip-row">

              <!-- Nuevo archivo -->
              <button class="chip" id="newExtraFileBtn" title="Nuevo archivo">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6L9 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                  <path d="M9 2v4h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M6 9h4M8 7v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                </svg>
                <span>Archivo</span>
              </button>


            </div>

            <!-- Separador visual -->
            <div class="chip-sep"></div>

            <!-- Live preview — destacado -->
            <button class="chip chip-live" id="liveBtn" title="Live Preview">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <polygon points="4,2 13,8 4,14" fill="currentColor" opacity=".85"/>
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.2" opacity=".4"/>
              </svg>
              <span>Live</span>
            </button>

            <!-- Settings -->
            <button class="chip chip-icon" id="settingsBtn" title="Configuración">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="2.2" stroke="currentColor" stroke-width="1.3"/>
                <path d="M8 1.5v1.2M8 13.3v1.2M1.5 8h1.2M13.3 8h1.2M3.4 3.4l.85.85M11.75 11.75l.85.85M12.6 3.4l-.85.85M4.25 11.75l-.85.85" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              </svg>
            </button>

            <button class="run-btn" id="runBtn" title="Ejecutar (Ctrl+Enter)">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <polygon points="3,1.5 14.5,8 3,14.5" fill="currentColor"/>
              </svg>
              RUN
            </button>
          </div>
        </div>

    <div class="file-tabs" id="fileTabs"></div>

        <!-- 📁 EXPLORADOR LATERAL (VS Code style) -->
        <div class="lth-sidebar-wrap">
        <div class="lth-file-explorer" id="lthFileExplorer">
          <div class="lfe-header">
            <span class="lfe-title">
              <span class="lfe-title-icon">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M2 5a1 1 0 011-1h3.172a1 1 0 01.707.293L8 5.414V13a1 1 0 01-1 1H3a1 1 0 01-1-1V5z" stroke="currentColor" stroke-width="1.2"/>
                  <path d="M8 5.414V13a1 1 0 001 1h4a1 1 0 001-1V6a1 1 0 00-1-1H8.586a1 1 0 00-.586.414z" stroke="currentColor" stroke-width="1.2"/>
                </svg>
              </span>
              Explorador
            </span>
            <div class="lfe-header-actions">
              <button class="lfe-header-btn" id="lfeNewFileBtn" title="Nuevo archivo">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
                  <path d="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6L9 2z" stroke-linejoin="round"/>
                  <path d="M9 2v4h4M8 8.5v3M6.5 10h3" stroke-linecap="round"/>
                </svg>
              </button>
              <button class="lfe-header-btn" id="lfeNewFolderBtn" title="Nueva carpeta">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
                  <path d="M2 5a1 1 0 011-1h3l1.2 1.3H13a1 1 0 011 1V12a1 1 0 01-1 1H3a1 1 0 01-1-1V5z" stroke-linejoin="round"/>
                  <path d="M8 7.5v3M6.5 9h3" stroke-linecap="round"/>
                </svg>
              </button>
              <button class="lfe-close-btn" id="lfeCloseBtn" title="Cerrar explorador">
                <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M2 2l10 10M12 2L2 12"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="lfe-drop-zone" id="lfeDropZone">
            <div class="lfe-drop-hint">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v8M5 7l3 3 3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M2 13h12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
              Arrastra archivos aquí
            </div>
          </div>
          <div class="lfe-list" id="lfeList"></div>
        </div>

        <div class="workspace">

          <!-- 🤖 PANEL CLAUDE IA -->
          <div class="lth-ia-panel hidden" id="lthIaPanel">
            <div class="ia-panel-header">
              <div class="ia-panel-logo">
                <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5">
                  <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
                </svg>
              </div>
              <div>
                <div class="ia-panel-title">LTH IA</div>
                <div class="ia-panel-sub">GLM-5.2 · Pro</div>
              </div>
              <select class="ia-model-sel" id="iaModelSel" title="Modelo" style="display:none">
                <option value="auto">Auto</option>
              </select>
              <select class="ia-mode-sel" id="iaModeSel" title="Modo de trabajo">
                <option value="efficiency">Eficiencia</option>
                <option value="expert">Experto</option>
                <option value="engineer">Ingeniero</option>
                <option value="offline">Sin IA</option>
              </select>
              <button class="ia-panel-close" id="iaCloseBtn">×</button>
            </div>
            <div class="ia-panel-ctx">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                <path d="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6L9 2z" stroke="currentColor" stroke-width="1.3"/>
                <path d="M9 2v4h4" stroke="currentColor" stroke-width="1.3"/>
              </svg>
              <span class="ia-panel-ctx-file" id="iaCtxFile">—</span>
              <span class="ia-panel-ctx-lines" id="iaCtxLines"></span>
              <span class="ia-panel-ctx-sel hidden" id="iaCtxSel">Selección</span>
            </div>
            <div class="ia-attached-bar hidden" id="iaAttachedBar">
              <span class="ia-attached-label">📎 Contexto extra:</span>
              <div class="ia-attached-chips" id="iaAttachedChips"></div>
              <button class="ia-attached-add" id="iaAttachBtn" title="Adjuntar archivo">+</button>
            </div>
            <div class="ia-quick-actions" id="iaQuickActions"></div>
            <div class="ia-panel-messages" id="iaPanelMessages"></div>
            <div class="ia-panel-controls">
              <label class="ia-toggle" title="Aplicar ediciones automáticamente">
                <input type="checkbox" id="iaAutoApply" checked>
                <span class="ia-toggle-slider"></span>
                <span class="ia-toggle-label">Auto-apply</span>
              </label>
              <div class="ia-funding-switch" id="iaFundingSwitch">
                <button class="ia-funding-btn active" id="iaFundingPlanBtn" type="button">Usar plan</button>
                <button class="ia-funding-btn" id="iaFundingGiftBtn" type="button">Usar creditos</button>
                <span class="ia-funding-hint" id="iaFundingHint">Elige la fuente premium.</span>
              </div>
              <span class="ia-cost-counter" id="iaCostCounter" title="Uso de tu ventana de créditos (compartido con LTH IA)">—</span>
            </div>
            <div class="ia-panel-footer">
              <textarea class="ia-pinput" id="iaInput" placeholder="Dime qué quieres hacer..." rows="1"></textarea>
              <button class="ia-psend" id="iaSendBtn">
                <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                  <path d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/>
                </svg>
              </button>
            </div>
          </div>

          <div class="pane editor-pane">
            <textarea class="editor-textarea" id="codeEditor" spellcheck="false"></textarea>
            <div class="editor-status-bar">
              <span id="editorStatus">Listo</span>
              <span id="editorInfo">Líneas: 1 | Caracteres: 0</span>
            </div>
          </div>

          <!-- Herramientas rápidas: columna fija entre editor y preview -->
          <div class="workspace-tools-rail" id="workspaceToolsRail" aria-label="Herramientas rápidas">
            <button class="chip chip-icon" id="explorerBtn" title="Explorador (Ctrl+B)">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M2 4a1 1 0 011-1h3.586a1 1 0 01.707.293L8 4h5a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
              </svg>
            </button>

            <button class="chip chip-icon" id="devicePcBtn" title="Vista PC">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <rect x="1.5" y="2.5" width="13" height="9" rx="1" stroke="currentColor" stroke-width="1.3"/>
                <path d="M5.5 14.5h5M8 11.5v3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              </svg>
            </button>

            <button class="chip chip-icon" id="devicePhoneBtn" title="Vista Teléfono">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <rect x="4.5" y="1.5" width="7" height="13" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
                <circle cx="8" cy="12.5" r=".7" fill="currentColor"/>
              </svg>
            </button>

            <button class="chip chip-icon" id="splitBtn" title="Split View">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <rect x="1.5" y="2.5" width="13" height="11" rx="1" stroke="currentColor" stroke-width="1.3"/>
                <path d="M8 2.5v11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              </svg>
            </button>

            <button class="chip chip-icon" id="inspectorBtn" title="Inspector (Ctrl+E)">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" stroke-width="1.3"/>
                <path d="M10 10l3.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M5 6.5h3M6.5 5v3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
              </svg>
            </button>

            <button class="chip chip-icon" id="guardianBtn" title="Guardian (Ctrl+Q)">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M8 2L3 4v4c0 3 2.5 5.5 5 6 2.5-.5 5-3 5-6V4L8 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                <path d="M6 8l1.5 1.5L10 6.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>

            <button class="chip chip-icon" id="rotuladorBtn" title="Rotulador (Ctrl+H)">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M10.5 2.5l3 3-7 7H3.5v-3l7-7z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                <path d="M8.5 4.5l3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                <path d="M1.5 14.5h13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity=".4"/>
              </svg>
            </button>

            <button class="chip chip-icon chip-colorvision" id="colorVisionBtn" title="Color de Sintaxis (Ctrl+K)">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2" opacity=".4"/>
                <circle cx="5.5" cy="6.5" r="1.8" fill="#f87171"/>
                <circle cx="10.5" cy="6.5" r="1.8" fill="#fbbf24"/>
                <circle cx="8" cy="10.5" r="1.8" fill="#34d399"/>
              </svg>
            </button>

            <button class="chip chip-icon" id="blockHlBtn" title="Rotular bloque al hacer click en número de línea">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="2" width="5" height="12" rx="1" fill="rgba(96,165,250,.6)" stroke="rgba(96,165,250,.9)" stroke-width="1"/>
                <rect x="9" y="2" width="5" height="12" rx="1" fill="rgba(251,191,36,.6)" stroke="rgba(251,191,36,.9)" stroke-width="1"/>
              </svg>
            </button>
          </div>

          <div class="pane live-pane">
            <div class="live-header">
     
    
            </div>
            <div class="device-stage" id="deviceStage">
              <div class="device-frame" id="deviceFrame">
                <span class="lth-phone-btn-power" style="display:none"></span>
                <span class="lth-phone-btn-vol1" style="display:none"></span>
                <span class="lth-phone-btn-vol2" style="display:none"></span>
                <iframe class="live-iframe" id="liveFrame" sandbox="allow-scripts allow-modals allow-same-origin allow-forms allow-popups"></iframe>
              </div>
              <!-- Empty state: se oculta cuando hay contenido -->
              <div class="preview-empty-state" id="previewEmptyState">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" opacity=".35">
                  <rect x="6" y="8" width="36" height="28" rx="3" stroke="white" stroke-width="2"/>
                  <path d="M6 14h36" stroke="white" stroke-width="1.5"/>
                  <circle cx="11" cy="11" r="1.5" fill="white"/>
                  <circle cx="16" cy="11" r="1.5" fill="white"/>
                  <circle cx="21" cy="11" r="1.5" fill="white"/>
                  <path d="M16 22l4 4-4 4M24 30h8" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M14 40h20M24 36v4" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                <p>Preview en vivo</p>
                <span>Escribe código y presiona <kbd>RUN</kbd> o activa <kbd>⚡ Live</kbd></span>
              </div>
            </div>
          </div>
        </div>
        </div><!-- /lth-sidebar-wrap -->
      </div>
    </div>

         <div class="calculator-container">
          <h2 style="margin: 6px 0 10px; text-align:center;">Calculator</h2>
           <div class="calculator">
          <div class="calculator-display" id="calcDisplay">0</div>
          <div class="calculator-buttons" id="calcButtons">
            <button class="calc-btn special" data-action="clear">C</button>
            <button class="calc-btn special" data-action="sign">+/-</button>
            <button class="calc-btn special" data-action="percent">%</button>
            <button class="calc-btn operator" data-action="divide">÷</button>
            <button class="calc-btn" data-num="7">7</button>
            <button class="calc-btn" data-num="8">8</button>
            <button class="calc-btn" data-num="9">9</button>
            <button class="calc-btn operator" data-action="multiply">×</button>
            <button class="calc-btn" data-num="4">4</button>
            <button class="calc-btn" data-num="5">5</button>
            <button class="calc-btn" data-num="6">6</button>
            <button class="calc-btn operator" data-action="subtract">-</button>
            <button class="calc-btn" data-num="1">1</button>
            <button class="calc-btn" data-num="2">2</button>
            <button class="calc-btn" data-num="3">3</button>
            <button class="calc-btn operator" data-action="add">+</button>
            <button class="calc-btn zero" data-num="0">0</button>
            <button class="calc-btn" data-action="decimal">.</button>
            <button class="calc-btn operator" data-action="equals">=</button>
          </div>
        </div>
       </div>
       </div>
       </div>
        </div>

<style>
/* =========================================================
   LTH PROG — STYLE ORGANIZADO (sin tocar HTML/JS)
   Objetivo: herramientas arriba, ordenadas en la barra superior
   ========================================================= */

/* ---------- Variables de control ---------- */
:root{
  --lift: 64px; /* cuánto se “sube” la toolbar del editor hacia la barra superior */
}

/* ---------- Root / Layout base ---------- */
.lth-prog-root{
  height:100%;
  display:flex;
  flex-direction:column;
  font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
  background:
    radial-gradient(ellipse 80% 50% at 15% 0%, rgba(99,102,241,.13) 0%, transparent 60%),
    radial-gradient(ellipse 60% 40% at 85% 100%, rgba(139,92,246,.10) 0%, transparent 55%),
    radial-gradient(ellipse 50% 60% at 50% 50%, rgba(15,10,40,.0) 0%, transparent 100%),
    linear-gradient(160deg, #07060f 0%, #0b0a1a 35%, #0a0818 65%, #060510 100%);
  color:#fff;
  overflow:hidden;
  position:relative;
}
/* Grain VIP sutil */
.lth-prog-root::before{
  content:'';
  position:absolute;
  inset:0;
  pointer-events:none;
  z-index:0;
  opacity:.018;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size:180px 180px;
}
/* Borde top luminoso */
.lth-prog-root::after{
  content:'';
  position:absolute;
  top:0; left:10%; right:10%; height:1px;
  background:linear-gradient(90deg, transparent, rgba(139,92,246,.5) 40%, rgba(99,102,241,.6) 60%, transparent);
  pointer-events:none; z-index:1;
}
.lth-prog-root > *{ position:relative; z-index:1; }

.lth-prog-content{ flex:1; min-height:0; }

.lth-prog-panel{ display:none; height:100%; }
.lth-prog-panel.active{ display:block; }

/* ── Panel de Claude IA ── */
.lth-ia-panel {
  position: relative;
  grid-column: 1;
  grid-row: 1;
  min-height: 0;
  width: 320px;
  background: linear-gradient(160deg, #09091a, #060612);
  border-right: 1px solid rgba(99,102,241,.2);
  display: flex; flex-direction: column;
  z-index: 5; overflow: hidden;
  transition: width .25s ease;
  flex-shrink: 0;
}
.lth-ia-panel.hidden { width: 0; min-width: 0; overflow: hidden; border: none; }

.ia-panel-header {
  display: flex; align-items: center; gap: 9px;
  padding: 11px 14px;
  border-bottom: 1px solid rgba(255,255,255,.06);
  flex-shrink: 0;
}
.ia-panel-logo {
  width: 28px; height: 28px; border-radius: 9px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  box-shadow: 0 0 12px rgba(99,102,241,.4);
}
.ia-panel-logo svg { width: 15px; height: 15px; }
.ia-panel-title { flex: 1; font-size: 13px; font-weight: 700; color: #fff; }
.ia-panel-sub { font-size: 10px; color: rgba(255,255,255,.3); }
.ia-panel-close {
  width: 26px; height: 26px; border-radius: 7px; border: none;
  background: rgba(255,255,255,.06); color: rgba(255,255,255,.4);
  cursor: pointer; font-size: 15px; display: flex; align-items: center; justify-content: center;
  transition: background .12s, color .12s;
}
.ia-panel-close:hover { background: rgba(255,80,80,.2); color: #f87171; }

.ia-panel-ctx {
  padding: 6px 14px;
  background: rgba(99,102,241,.08);
  border-bottom: 1px solid rgba(99,102,241,.1);
  font-size: 10px; color: rgba(167,139,250,.7);
  display: flex; align-items: center; gap: 5px;
  flex-shrink: 0;
}
.ia-panel-ctx-file { color: #a5b4fc; font-weight: 700; }
.ia-panel-ctx-lines { color: rgba(255,255,255,.25); margin-left: auto; }
.ia-panel-ctx-sel { padding:1px 7px; border-radius:4px; font-size:9px; font-weight:700; background:rgba(52,211,153,.2); color:#34d399; border:1px solid rgba(52,211,153,.25); margin-left:5px; }
.ia-panel-ctx-sel.hidden { display:none; }

/* ── Model / mode selectors ── */
.ia-model-sel,
.ia-mode-sel {
  padding:3px 6px; border-radius:7px; font-size:10px; font-weight:700;
  background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1);
  color:rgba(255,255,255,.6); cursor:pointer; outline:none;
  appearance:none; -webkit-appearance:none;
  background-image:url("data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 8 5' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l3 3 3-3' stroke='%23888' stroke-width='1.2'/%3E%3C/svg%3E");
  background-repeat:no-repeat; background-position:right 5px center; padding-right:16px;
}
.ia-model-sel { margin-left:auto; max-width:92px; }
.ia-mode-sel { max-width:104px; }
.ia-model-sel:hover,
.ia-mode-sel:hover { border-color:rgba(129,140,248,.4); color:#fff; }
.ia-model-sel option,
.ia-mode-sel option { background:#111; color:#fff; }

/* ── Attached files bar ── */
.ia-attached-bar { display:flex; align-items:center; gap:5px; padding:4px 10px; border-bottom:1px solid rgba(255,255,255,.04); font-size:10px; flex-shrink:0; }
.ia-attached-bar.hidden { display:none; }
.ia-attached-label { color:rgba(255,255,255,.25); flex-shrink:0; }
.ia-attached-chips { display:flex; gap:3px; flex-wrap:wrap; flex:1; min-width:0; }
.ia-attached-chip { padding:2px 7px; border-radius:5px; font-size:9px; font-weight:600; background:rgba(99,102,241,.15); color:#a5b4fc; border:1px solid rgba(99,102,241,.2); display:flex; align-items:center; gap:3px; max-width:120px; }
.ia-attached-chip-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ia-attached-chip-x { cursor:pointer; opacity:.4; font-size:11px; line-height:1; }
.ia-attached-chip-x:hover { opacity:1; color:#f87171; }
.ia-attached-add { width:20px; height:20px; border-radius:5px; border:1px dashed rgba(255,255,255,.12); background:transparent; color:rgba(255,255,255,.3); cursor:pointer; font-size:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.ia-attached-add:hover { border-color:rgba(129,140,248,.4); color:#a5b4fc; }

/* ── Diff view ── */
.ia-diff-wrap { border-radius:10px; overflow:hidden; border:1px solid rgba(99,102,241,.2); margin-top:2px; }
.ia-diff-header { display:flex; align-items:center; justify-content:space-between; padding:6px 10px; background:rgba(99,102,241,.1); font-size:10px; color:rgba(255,255,255,.5); }
.ia-diff-header strong { color:#a5b4fc; }
.ia-diff-body { max-height:220px; overflow-y:auto; font-family:'Consolas',monospace; font-size:10px; line-height:1.6; }
.ia-diff-body::-webkit-scrollbar { width:3px; }
.ia-diff-body::-webkit-scrollbar-thumb { background:rgba(255,255,255,.08); border-radius:2px; }
.ia-diff-line { padding:0 10px; white-space:pre-wrap; word-break:break-all; }
.ia-diff-line.add { background:rgba(52,211,153,.08); color:#6ee7b7; }
.ia-diff-line.rem { background:rgba(248,113,113,.08); color:#fca5a5; text-decoration:line-through; opacity:.6; }
.ia-diff-line.ctx { color:rgba(255,255,255,.2); }
.ia-diff-actions { display:flex; gap:5px; padding:6px 10px; background:rgba(0,0,0,.2); border-top:1px solid rgba(255,255,255,.04); }
.ia-diff-btn { padding:4px 12px; border-radius:6px; border:none; cursor:pointer; font-size:10px; font-weight:700; }
.ia-diff-btn.accept { background:rgba(52,211,153,.25); color:#34d399; border:1px solid rgba(52,211,153,.3); }
.ia-diff-btn.accept:hover { background:rgba(52,211,153,.4); color:#fff; }
.ia-diff-btn.reject { background:rgba(248,113,113,.12); color:#f87171; border:1px solid rgba(248,113,113,.2); }
.ia-diff-btn.reject:hover { background:rgba(248,113,113,.25); color:#fff; }

/* ── Auto-applied card ── */
.ia-auto-applied {
  display:flex; align-items:center; gap:8px; padding:9px 12px;
  background:linear-gradient(135deg, rgba(52,211,153,.08), rgba(99,102,241,.08));
  border:1px solid rgba(52,211,153,.2); border-radius:11px;
}
.ia-auto-applied-icon { font-size:18px; color:#34d399; animation:iaPulseApply 1.5s ease-in-out; }
@keyframes iaPulseApply { 0%{transform:scale(0.5);opacity:0} 50%{transform:scale(1.2);opacity:1} 100%{transform:scale(1)} }
.ia-auto-applied-info { display:flex; flex-direction:column; gap:2px; }
.ia-auto-applied-info strong { font-size:11px; color:#34d399; }
.ia-auto-applied-stats { display:flex; gap:6px; font-size:9px; }
.ia-stat-add { color:#6ee7b7; font-weight:700; }
.ia-stat-rem { color:#fca5a5; font-weight:700; }
.ia-stat-ctx { color:rgba(255,255,255,.2); }
.ia-auto-applied-actions { display:flex; gap:4px; flex-wrap:wrap; margin-top:4px; }
.ia-undo-btn { background:rgba(248,113,113,.15)!important; color:#f87171!important; border:1px solid rgba(248,113,113,.25)!important; }
.ia-undo-btn:hover { background:rgba(248,113,113,.3)!important; color:#fff!important; }
.ia-undo-btn:disabled { opacity:.35; cursor:not-allowed; }
.ia-work-progress {
  width:100%;
  display:flex;
  flex-direction:column;
  gap:8px;
  padding:10px 12px;
  border-radius:11px;
  border:1px solid rgba(99,102,241,.2);
  background:linear-gradient(135deg, rgba(15,23,42,.88), rgba(30,41,59,.72));
}
.ia-work-progress-head {
  display:flex;
  align-items:center;
  gap:8px;
  font-size:11px;
  font-weight:700;
  color:#dbeafe;
}
.ia-work-progress-dot {
  width:8px;
  height:8px;
  border-radius:999px;
  background:#60a5fa;
  box-shadow:0 0 0 0 rgba(96,165,250,.45);
  animation:iaWorkPulse 1.2s ease-in-out infinite;
}
@keyframes iaWorkPulse {
  0% { transform:scale(.9); box-shadow:0 0 0 0 rgba(96,165,250,.42); }
  70% { transform:scale(1.15); box-shadow:0 0 0 7px rgba(96,165,250,0); }
  100% { transform:scale(.95); box-shadow:0 0 0 0 rgba(96,165,250,0); }
}
.ia-work-progress-badge {
  margin-left:auto;
  padding:2px 7px;
  border-radius:999px;
  background:rgba(99,102,241,.16);
  border:1px solid rgba(99,102,241,.24);
  color:#a5b4fc;
  font-size:9px;
  font-weight:700;
  letter-spacing:.02em;
  text-transform:uppercase;
}
.ia-work-progress-body {
  font-size:10px;
  line-height:1.55;
  color:rgba(255,255,255,.72);
}
.ia-work-progress-files {
  display:flex;
  flex-direction:column;
  gap:4px;
}
.ia-work-progress-file {
  display:grid;
  grid-template-columns:minmax(0,1fr) auto auto auto;
  gap:8px;
  align-items:center;
  padding:5px 8px;
  border-radius:8px;
  background:rgba(255,255,255,.03);
  border:1px solid rgba(255,255,255,.05);
  font-size:10px;
  font-family:'Consolas', monospace;
}
.ia-work-progress-file-name {
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  color:#e2e8f0;
}
.ia-work-progress-add { color:#6ee7b7; font-weight:700; }
.ia-work-progress-rem { color:#fca5a5; font-weight:700; }
.ia-work-progress-note { color:rgba(255,255,255,.42); font-size:9px; }

/* ── Editor highlight for changed lines ── */
.ia-editor-highlight { background:rgba(52,211,153,.12)!important; transition:background 1s ease-out; }

/* ── Controls bar (auto-apply + cost) ── */
.ia-panel-controls {
  display:flex; align-items:center; justify-content:space-between;
  padding:4px 10px; border-top:1px solid rgba(255,255,255,.04); flex-shrink:0;
}
.ia-funding-switch {
  display:flex; align-items:center; gap:6px;
  padding:0 8px;
}
.ia-funding-btn {
  border:1px solid rgba(255,255,255,.08);
  background:rgba(255,255,255,.04);
  color:rgba(255,255,255,.64);
  border-radius:999px;
  padding:4px 10px;
  font-size:9px;
  font-weight:700;
  cursor:pointer;
}
.ia-funding-btn.active {
  color:#fff;
  border-color:rgba(112, 158, 255, .42);
  background:linear-gradient(135deg, rgba(68,98,255,.22), rgba(120,78,255,.18));
}
.ia-funding-btn:disabled {
  opacity:.45;
  cursor:not-allowed;
}
.ia-funding-hint {
  font-size:9px;
  color:rgba(255,255,255,.35);
  max-width:150px;
}
.ia-toggle { display:flex; align-items:center; gap:5px; cursor:pointer; font-size:9px; color:rgba(255,255,255,.35); user-select:none; }
.ia-toggle input { display:none; }
.ia-toggle-slider {
  width:24px; height:13px; border-radius:7px; background:rgba(255,255,255,.1);
  position:relative; transition:background .2s; flex-shrink:0;
}
.ia-toggle-slider::after {
  content:''; position:absolute; top:2px; left:2px; width:9px; height:9px;
  border-radius:50%; background:rgba(255,255,255,.3); transition:transform .2s, background .2s;
}
.ia-toggle input:checked + .ia-toggle-slider { background:rgba(52,211,153,.3); }
.ia-toggle input:checked + .ia-toggle-slider::after { transform:translateX(11px); background:#34d399; }
.ia-toggle-label { color:rgba(255,255,255,.3); }
.ia-toggle input:checked ~ .ia-toggle-label { color:rgba(52,211,153,.7); }

.ia-key-reset {
  border:1px solid rgba(248,113,113,.18);
  background:rgba(248,113,113,.08);
  color:rgba(252,165,165,.75);
  border-radius:6px;
  padding:3px 7px;
  font-size:9px;
  font-weight:700;
  cursor:pointer;
}
.ia-key-reset:hover {
  background:rgba(248,113,113,.18);
  color:#fff;
  border-color:rgba(248,113,113,.35);
}

.ia-cost-counter {
  font-size:9px; font-family:'Consolas',monospace; font-weight:700;
  color:rgba(255,255,255,.2); padding:2px 6px; border-radius:4px;
  background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.05);
}

.ia-panel-messages {
  flex: 1; overflow-y: auto; padding: 10px;
  display: flex; flex-direction: column; gap: 8px; min-height: 0;
}
.ia-panel-messages::-webkit-scrollbar { width: 3px; }
.ia-panel-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,.08); border-radius: 2px; }

.ia-pmsg { display: flex; flex-direction: column; gap: 4px; max-width: 95%; }
.ia-pmsg.user { align-self: flex-end; align-items: flex-end; }
.ia-pmsg.assistant { align-self: flex-start; align-items: flex-start; }

.ia-pbubble {
  padding: 8px 11px; border-radius: 13px;
  font-size: 12px; line-height: 1.5; word-break: break-word;
}
.ia-pmsg.user .ia-pbubble {
  background: linear-gradient(135deg, rgba(99,102,241,.5), rgba(139,92,246,.45));
  border: 1px solid rgba(129,140,248,.3); color: #fff;
  border-bottom-right-radius: 3px;
}
.ia-pmsg.assistant .ia-pbubble {
  background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08);
  color: rgba(255,255,255,.82); border-bottom-left-radius: 3px;
  white-space: pre-wrap;
}
.ia-pmsg.assistant.is-code .ia-pbubble {
  font-family: 'Consolas', monospace; font-size: 10.5px;
  background: rgba(0,0,0,.4); border-color: rgba(99,102,241,.2);
  color: #c4b5fd; max-height: 180px; overflow-y: auto;
}

.ia-pmsg-actions { display: flex; gap: 4px; flex-wrap: wrap; }
.ia-paction {
  padding: 3px 9px; border-radius: 6px; border: none; cursor: pointer;
  font-size: 10px; font-weight: 700; transition: background .12s;
}
.ia-paction.apply { background: rgba(99,102,241,.2); color: #a5b4fc; border: 1px solid rgba(99,102,241,.3); }
.ia-paction.apply:hover { background: rgba(99,102,241,.4); color: #fff; }
.ia-paction.insert { background: rgba(52,211,153,.12); color: #34d399; border: 1px solid rgba(52,211,153,.25); }
.ia-paction.insert:hover { background: rgba(52,211,153,.25); color: #fff; }
.ia-paction.copy { background: rgba(255,255,255,.05); color: rgba(255,255,255,.4); border: 1px solid rgba(255,255,255,.08); }
.ia-paction.copy:hover { background: rgba(255,255,255,.1); color: #fff; }

.ia-ptyping {
  display: flex; gap: 3px; align-items: center;
  padding: 8px 11px; border-radius: 13px; border-bottom-left-radius: 3px;
  background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08);
  width: fit-content;
}
.ia-pdot {
  width: 5px; height: 5px; border-radius: 50%;
  background: rgba(129,140,248,.6);
  animation: iaPDot .9s ease-in-out infinite;
}
.ia-pdot:nth-child(2) { animation-delay: .15s; }
.ia-pdot:nth-child(3) { animation-delay: .3s; }
@keyframes iaPDot { 0%,80%,100%{transform:scale(.7);opacity:.4} 40%{transform:scale(1);opacity:1} }

.ia-panel-empty {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 8px; padding: 20px; text-align: center;
}
.ia-panel-empty-icon { font-size: 26px; opacity: .2; }
.ia-panel-empty-text { font-size: 11px; color: rgba(255,255,255,.2); line-height: 1.5; }

.ia-panel-suggestions {
  display: flex; flex-direction: column; gap: 4px;
  padding: 0 10px 8px;
}
.ia-quick-actions {
  display: flex; flex-wrap: wrap; gap: 6px;
  padding: 8px 10px 0;
}
.ia-quick-actions.hidden { display: none; }
.ia-quick-btn {
  padding: 6px 10px; border-radius: 999px;
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.035);
  color: rgba(255,255,255,.72);
  font-size: 10px; font-weight: 700; letter-spacing: .02em;
  cursor: pointer;
  transition: transform .12s ease, border-color .12s ease, background .12s ease, color .12s ease;
}
.ia-quick-btn:hover {
  transform: translateY(-1px);
  border-color: rgba(129,140,248,.35);
  background: rgba(99,102,241,.16);
  color: #fff;
}
.ia-quick-btn.visual {
  border-color: rgba(34,211,238,.2);
  background: linear-gradient(135deg, rgba(16,185,129,.12), rgba(59,130,246,.14));
  color: #d9f7ff;
}
.ia-psug {
  padding: 6px 11px; border-radius: 8px;
  border: 1px solid rgba(255,255,255,.07);
  background: rgba(255,255,255,.03); color: rgba(255,255,255,.4);
  font-size: 11px; cursor: pointer; text-align: left;
  transition: background .12s, color .12s, border-color .12s;
}
.ia-psug:hover { background: rgba(99,102,241,.15); color: rgba(255,255,255,.8); border-color: rgba(99,102,241,.3); }
.ia-apply-diagnostics {
  margin: 6px 10px 0;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgba(248,113,113,.24);
  background: rgba(90,18,30,.36);
  font-size: 10px;
  line-height: 1.45;
  color: rgba(255,255,255,.82);
}
.ia-apply-diagnostics strong { color: #fecaca; }
.ia-apply-diagnostics pre {
  margin: 6px 0 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: "SF Mono","JetBrains Mono","Cascadia Code","Fira Code","Consolas",monospace;
  color: rgba(255,255,255,.72);
}

.ia-panel-setup {
  padding: 14px; display: flex; flex-direction: column; gap: 9px;
}
.ia-setup-label { font-size: 11px; color: rgba(255,255,255,.4); line-height: 1.6; }
.ia-setup-input {
  width: 100%; padding: 9px 11px;
  background: rgba(0,0,0,.4); border: 1px solid rgba(255,255,255,.1);
  border-radius: 9px; color: #fff; font-size: 12px; outline: none;
}
.ia-setup-input:focus { border-color: rgba(129,140,248,.4); }
.ia-setup-save {
  width: 100%; padding: 9px; border-radius: 9px;
  border: 1px solid rgba(99,102,241,.4);
  background: linear-gradient(135deg, rgba(99,102,241,.4), rgba(139,92,246,.35));
  color: #fff; font-size: 12px; font-weight: 700; cursor: pointer;
}
.ia-setup-save:hover { background: linear-gradient(135deg, rgba(99,102,241,.6), rgba(139,92,246,.55)); }
.ia-setup-note { font-size: 10px; color: rgba(255,255,255,.25); text-align: center; }

.ia-panel-footer {
  display: flex; gap: 7px; padding: 9px 10px;
  border-top: 1px solid rgba(255,255,255,.06); flex-shrink: 0;
}
.ia-pinput {
  flex: 1; padding: 9px 11px;
  background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.09);
  border-radius: 11px; color: #fff; font-size: 12px; outline: none;
  resize: none; min-height: 38px; max-height: 100px; overflow-y: auto;
  font-family: inherit; line-height: 1.4; transition: border-color .15s;
}
.ia-pinput:focus { border-color: rgba(129,140,248,.4); }
.ia-pinput::placeholder { color: rgba(255,255,255,.2); }
.ia-psend {
  width: 38px; height: 38px; border-radius: 11px; border: none;
  background: linear-gradient(135deg, rgba(99,102,241,.55), rgba(139,92,246,.5));
  color: #fff; cursor: pointer; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; align-self: flex-end;
  transition: background .15s; box-shadow: 0 0 14px rgba(99,102,241,.25);
}
.ia-psend:hover { background: linear-gradient(135deg, rgba(99,102,241,.75), rgba(139,92,246,.7)); }
.ia-psend:disabled { opacity: .35; cursor: not-allowed; }
.ia-psend svg { width: 16px; height: 16px; }

.editor-toolbar {
  transition: all 0.3s ease-in-out;
}

${externalLayoutCss}
${externalComponentsCss}

${externalEffectsCss}
${externalSettingsCss}
${externalExplorerCss}

/* Rename inline */
.current-file.renaming{ opacity:.85; }
.rename-input{
  width:min(380px, 90%);
  padding:6px 10px;
  border-radius:12px;
  border:1px solid rgba(125,211,252,.35);
  background:rgba(0,0,0,.45);
  color:#fff;
  font:600 13px ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
  outline:none;
}
.rename-hint{ margin-left:10px; font-size:11px; opacity:.65; }

/* ================================
   CodeMirror — LTH PROG Purple Premium
   ================================ */

.editor-pane .CodeMirror{
  flex:1 !important;
  height:100% !important;
  min-height:0 !important;
  max-width:100% !important;
  border-radius:16px !important;
  overflow:hidden !important;
}

.editor-pane .CodeMirror-scroll{
  min-height:0 !important;
}

/* Base visual */
.editor-pane .CodeMirror.cm-s-lth-vscode,
.editor-pane .CodeMirror.cm-s-lth-vscode.CodeMirror,
.editor-pane .CodeMirror.cm-s-material-darker,
.editor-pane .CodeMirror{
  background: linear-gradient(180deg, #0c0818 0%, #0a0714 100%) !important;
  color: #eee9ff !important;
  border: 1px solid rgba(139,92,246,.20) !important;
  box-shadow:
    0 0 0 1px rgba(99,102,241,.06),
    inset 0 1px 0 rgba(255,255,255,.03),
    0 12px 38px rgba(0,0,0,.45) !important;
}

.editor-pane .CodeMirror-gutters{
  background: #120b23 !important;
  border-right: 1px solid rgba(139,92,246,.14) !important;
}

.editor-pane .CodeMirror-linenumber{
  color: rgba(196,181,253,.42) !important;
}

/* Cursor / selección / línea activa */
.editor-pane .CodeMirror-cursor{
  border-left: 2px solid #c4b5fd !important;
}

.editor-pane .CodeMirror-selected,
.editor-pane .CodeMirror-focused .CodeMirror-selected{
  background: rgba(124,58,237,.24) !important;
}

.editor-pane .CodeMirror-activeline-background{
  background: rgba(139,92,246,.08) !important;
}

/* Brackets */
.editor-pane .CodeMirror-matchingbracket{
  color: #ffffff !important;
  background: rgba(139,92,246,.22) !important;
  border-bottom: 1px solid rgba(196,181,253,.7) !important;
}

.editor-pane .CodeMirror-nonmatchingbracket{
  color: #ff6b81 !important;
}

/* Typography */
.editor-textarea,
.editor-pane .CodeMirror,
.editor-pane .CodeMirror pre,
.editor-pane .CodeMirror-line,
.editor-pane .CodeMirror-lines{
  font-family: "SF Mono","JetBrains Mono","Cascadia Code","Fira Code","Consolas",monospace !important;
  font-size: 15px !important;
  line-height: 1.65 !important;
  letter-spacing: 0.1px !important;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Syntax colors — premium balanced */
.editor-pane .CodeMirror .cm-comment{
  color: #7c8aa5 !important;
  font-style: italic;
}

.editor-pane .CodeMirror .cm-keyword,
.editor-pane .CodeMirror .cm-tag{
  color: #8ab4ff !important;
}

.editor-pane .CodeMirror .cm-operator,
.editor-pane .CodeMirror .cm-bracket{
  color: #d9d4f7 !important;
}

.editor-pane .CodeMirror .cm-string,
.editor-pane .CodeMirror .cm-string-2{
  color: #ffb38a !important;
}

.editor-pane .CodeMirror .cm-number,
.editor-pane .CodeMirror .cm-atom{
  color: #b8f2a6 !important;
}

.editor-pane .CodeMirror .cm-def{
  color: #f4e28a !important;
}

.editor-pane .CodeMirror .cm-variable,
.editor-pane .CodeMirror .cm-variable-2,
.editor-pane .CodeMirror .cm-property,
.editor-pane .CodeMirror .cm-attribute{
  color: #9cdcfe !important;
}

.editor-pane .CodeMirror .cm-variable-3,
.editor-pane .CodeMirror .cm-type,
.editor-pane .CodeMirror .cm-builtin,
.editor-pane .CodeMirror .cm-qualifier{
  color: #63e6be !important;
}

.editor-pane .CodeMirror .cm-meta{
  color: #d8a8ff !important;
}

.editor-pane .CodeMirror .cm-error{
  color: #ff6b6b !important;
  text-decoration: underline wavy #ff6b6b;
}

/* =========================================================
   Terminal
   ========================================================= */
.terminal-container{ height:100%; display:flex; flex-direction:column; padding:10px; }

.terminal-header{
  display:flex;
  align-items:center;
  gap:8px;
  padding:10px;
  border-radius:14px;
  background:rgba(0,0,0,.35);
  border:1px solid rgba(255,255,255,.12);
}
.terminal-dot{ width:10px;height:10px;border-radius:50%; }
.terminal-dot.red{ background:#ff5f57; }
.terminal-dot.yellow{ background:#febc2e; }
.terminal-dot.green{ background:#28c840; }
.terminal-title{ margin-left:6px; color:#fff; font-weight:800; }

.terminal-output{
  flex:1;
  min-height:0;
  margin-top:10px;
  padding:12px;
  border-radius:16px;
  background:rgba(0,0,0,.35);
  border:1px solid rgba(255,255,255,.12);
  overflow:auto;
}
.terminal-input-line{
  display:flex;
  align-items:center;
  gap:8px;
  margin-top:10px;
  padding:10px;
  border-radius:14px;
  background:rgba(0,0,0,.35);
  border:1px solid rgba(255,255,255,.12);
}
.terminal-prompt{ color:#8ef; }
.terminal-input{
  flex:1;
  background:transparent;
  border:none;
  outline:none;
  color:#fff;
  font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
}
.terminal-line{ margin-bottom:6px; }
.terminal-success{ color:#6ef2a5; }
.terminal-info{ color:#8fb7ff; }
.terminal-warn{ color:#ffd37a; }
.terminal-error{ color:#ff8a8a; }

/* =========================================================
   Calculator
   ========================================================= */
.calculator-container{ padding:14px; }
.calculator{
  max-width:360px;
  margin:0 auto;
  border-radius:18px;
  padding:12px;
  background:rgba(0,0,0,.25);
  border:1px solid rgba(255,255,255,.12);
}
.calculator-display{
  padding:14px;
  border-radius:14px;
  background:rgba(0,0,0,.35);
  border:1px solid rgba(255,255,255,.12);
  color:#fff;
  text-align:right;
  font-size:26px;
}
.calculator-buttons{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:8px;
  margin-top:10px;
}
.calc-btn{
  padding:12px;
  border-radius:14px;
  border:1px solid rgba(255,255,255,.12);
  background:rgba(255,255,255,.06);
  color:#fff;
  cursor:pointer;
  font-size:16px;
}
.calc-btn.operator{ background:rgba(0,122,255,.20); }
.calc-btn.special{ background:rgba(255,255,255,.10); }
.calc-btn.zero{ grid-column:span 2; }

/* =========================================================
   Preview panel (sección preview “RUN manual”)
   ========================================================= */
.lth-prog-panel[data-panel="preview"]{
  display:flex!important;
  flex-direction:column!important;
  background:#000!important;
  padding:0!important;
}

.preview-toolbar{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding:10px 16px;
  background:rgba(0,0,0,.35);
  border-bottom:1px solid rgba(255,255,255,.12);
}

.preview-mode-selector{ display:flex; gap:6px; }
.preview-mode-btn{
  border:1px solid rgba(255,255,255,.14);
  background:rgba(255,255,255,.06);
  color:#fff;
  padding:6px 12px;
  border-radius:12px;
  cursor:pointer;
  font-size:12px;
}
.preview-mode-btn.active{
  background:rgba(0,122,255,.35);
  border-color:rgba(125,211,252,.35);
}

.preview-dimensions{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.dimension-input{
  width:80px;
  padding:6px 8px;
  border:1px solid rgba(255,255,255,.14);
  background:rgba(255,255,255,.08);
  color:#fff;
  border-radius:10px;
  font-size:12px;
  text-align:center;
}
.dimension-preset{
  border:1px solid rgba(255,255,255,.14);
  background:rgba(255,255,255,.06);
  color:#fff;
  padding:6px 10px;
  border-radius:10px;
  cursor:pointer;
  font-size:11px;
}
.dimension-preset:hover{ background:rgba(255,255,255,.12); }

.preview-container{
  flex:1!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  overflow:hidden!important;
  padding:20px!important;
  background:#000!important;
  min-height:0!important;
}

.preview-frame-wrapper{
  background:#fff;
  border-radius:8px;
  box-shadow:0 20px 60px rgba(0,0,0,.8);
  overflow:hidden;
  transition:all .3s ease;
}

.preview-container[data-mode="desktop"] .preview-frame-wrapper{
  width:100%;
  height:100%;
  max-width:100%;
  max-height:100%;
}
.preview-container[data-mode="tablet"] .preview-frame-wrapper{
  width:768px;
  height:1024px;
  max-width:90%;
  max-height:90%;
}
.preview-container[data-mode="phone"] .preview-frame-wrapper{
  width:375px;
  height:667px;
  max-width:90%;
  max-height:90%;
  border-radius:40px;
  background:linear-gradient(145deg,#1c1c1f,#000);
  padding:12px;
  box-shadow:0 0 0 6px #0a0a0a,0 40px 80px rgba(0,0,0,.9);
  position:relative;
}
.preview-container[data-mode="phone"] .preview-frame-wrapper::before{
  content:'';
  position:absolute;
  top:20px;
  left:50%;
  transform:translateX(-50%);
  width:100px;
  height:30px;
  background:#000;
  border-radius:18px;
  z-index:1000;
  pointer-events:none;
}

.preview-iframe{
  width:100%!important;
  height:100%!important;
  border:none!important;
  background:#fff!important;
}
.preview-container[data-mode="phone"] .preview-iframe{ border-radius:35px; }

/* =========================================================
   Compact mode
   ========================================================= */
.lth-prog-root.compact .lth-prog-tabs{ padding:6px 8px; gap:6px; }
.lth-prog-root.compact .lth-prog-tab{ padding:6px 10px; border-radius:12px; }
.lth-prog-root.compact .editor-container{ padding:6px; gap:6px; }
.lth-prog-root.compact .file-tab{ padding:6px 10px; }
.lth-prog-root.compact .toolbar-btn{ padding:6px 10px; }
.lth-prog-root.compact .run-btn{ padding:6px 12px; }
.lth-prog-root.compact .chip{ padding:6px 10px; }
.lth-prog-root.compact .editor-status-bar{ padding:4px 2px 0; }

  










/* ===============================
   TOP DRAWER (tabs + toolbar)
   Click arriba para desplegar
   =============================== */

/* ===============================
   TOP DRAWER (tabs + toolbar)
   Click arriba para desplegar
   =============================== */
















/* === MODO RUN FULLSCREEN — iframe como overlay fijo === */

/* Overlay que cubre TODO cuando está en modo RUN */
.lth-run-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  background: #000;
}
.lth-run-overlay.active {
  display: block;
}
.lth-run-overlay iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
  background: #000;
}
.lth-run-exit {
  position: absolute;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  min-width: 58px;
  height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid rgba(255, 76, 76, 0.55);
  background: rgba(15, 4, 8, 0.84);
  color: #fff;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.12em;
  cursor: pointer;
  box-shadow: 0 0 18px rgba(255, 60, 60, 0.34);
}
.lth-run-exit:hover {
  background: rgba(42, 8, 12, 0.92);
  border-color: rgba(255, 120, 120, 0.82);
}
.wm-win.lth-run-performance-mode,
.wm-win.lth-run-performance-mode .wm-tb,
.wm-win.lth-run-performance-mode .wm-body {
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
.wm-win.lth-run-performance-mode {
  contain: none !important;
  will-change: auto !important;
  box-shadow: none !important;
}
.wm-win.lth-run-performance-mode::before {
  display: none !important;
}

/* Punto verde en modo RUN */
.lth-prog-root.run-fullscreen .tools-trigger {
  background: linear-gradient(135deg, #ff4444, #cc0000) !important;
  box-shadow: 0 0 10px rgba(255,60,60,.8), 0 0 20px rgba(255,60,60,.4) !important;
  animation: none !important;
  z-index: 99999;
}
.lth-prog-root.run-fullscreen .tools-trigger::after {
  content: 'ESC';
  position: absolute;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 9px;
  color: rgba(255,100,100,.8);
  white-space: nowrap;
  font-weight: 700;
  letter-spacing: .05em;
}

/* Menú contextual del editor */
.lth-editor-ctx-menu {
  position: fixed;
  background: linear-gradient(160deg, rgba(6,12,28,.98) 0%, rgba(10,18,36,.98) 100%);
  border: 1px solid rgba(0,180,255,.25);
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0,0,0,.8), 0 0 0 1px rgba(0,180,255,.08);
  padding: 6px;
  z-index: 99999;
  min-width: 190px;
  animation: ctxMenuIn .12s ease;
  backdrop-filter: blur(16px);
  user-select: none;
}
@keyframes ctxMenuIn {
  from { opacity:0; transform: scale(.93) translateY(-4px); }
  to   { opacity:1; transform: scale(1) translateY(0); }
}
.lth-ctx-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: rgba(255,255,255,.88);
  transition: background .11s;
}
.lth-ctx-item:hover { background: rgba(0,180,255,.12); color: #fff; }
.lth-ctx-item .lth-ctx-kbd {
  margin-left: auto;
  font-size: 10px;
  opacity: .45;
  font-family: monospace;
}
.lth-ctx-item.lth-ctx-save { color: #5efc8d; }
.lth-ctx-item.lth-ctx-save:hover { background: rgba(0,220,80,.14); }
.lth-ctx-item.lth-ctx-disabled { opacity: .3; pointer-events: none; }
.lth-ctx-sep {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0,180,255,.2), transparent);
  margin: 4px 6px;
}

/* Botones de proyecto deshabilitados en modo carpeta */
.lth-prog-root.folder-mode #projectMenuBtn {
  opacity: .38;
  pointer-events: none;
  filter: grayscale(1);
}
.lth-prog-root.folder-mode #saveProjectBtn,
.lth-prog-root.folder-mode #saveProjectToBtn,
.lth-prog-root.folder-mode #saveProjectQuickBtn {
  opacity: .3;
  pointer-events: none;
}

/* En modo proyecto, guardar individual se muestra más tenue si no hay path */
.lth-prog-root.project-mode .lth-save-external-only {
  opacity: .4;
  pointer-events: none;
}

/* ── LAYOUT LIMPIO: sin bordes redondeados, paneles nivelados ── */

/* 1) Editor — sin radios, sin borde, sin sombra */
.editor-pane .CodeMirror,
.editor-pane .CodeMirror.cm-s-material-darker,
.editor-pane .CodeMirror.cm-s-lth-vscode {
  border-radius: 0 !important;
  border: none !important;
  box-shadow: none !important;
}

/* 2) Device-stage — sin radios, sin borde */
.device-stage {
  border-radius: 0 !important;
  border: none !important;
}

/* 3) Device-frame base (PC) — recto, sin borde, sin sombra */
.device-frame {
  border-radius: 0 !important;
  border: none !important;
  box-shadow: none !important;
}
.lth-prog-root[data-device="pc"] .device-frame {
  border-radius: 0 !important;
}

/* 4) Device-frame teléfono — conserva forma de teléfono */
.lth-prog-root[data-device="phone"] .device-frame {
  border-radius: 44px !important;
  border: none !important;
  box-shadow:
    0 0 0 1.5px rgba(120,120,130,.35),
    0 0 0 2.5px rgba(0,0,0,.9),
    0 25px 70px rgba(0,0,0,.9),
    0 8px 25px rgba(0,0,0,.7),
    0 0 50px rgba(139,92,246,.06) !important;
}

/* 5) Nivelar paneles — colapsar live-header vacío */
.live-header {
  display: none !important;
}

/* 6) Textarea fallback — sin radios, sin borde */
.editor-textarea {
  border-radius: 0 !important;
  border: none !important;
}

/* 7) Phone iframe */
.lth-prog-root[data-device="phone"] .live-iframe {
  transform: scale(0.643) translateZ(0) !important;
  -webkit-font-smoothing: subpixel-antialiased !important;
  background: #000 !important;
}

/* 8) Iframe base — quitar GPU promotion innecesaria */
.live-iframe {
  -webkit-backface-visibility: initial !important;
  backface-visibility: initial !important;
  will-change: auto !important;
}


</style>

`;

  // ── FASE 2: Init tabs y terminal (ligeros) ──
  updateSplash(45, 'Inicializando terminal...');

  // Usar appContainer como el "container" para los inits
  this.initTabs(appContainer);
  this.initTerminal(appContainer);
  this.initCalculator(appContainer);

  updateSplash(60, 'Cargando editor de código...');

  // Defer editor init (el más pesado) para que el splash siga fluyendo
  await new Promise(r => setTimeout(r, 60));
  if (isStaleBoot()) return;

  this.initEditor(appContainer);

  // Esperar a que el editor (y addons CDN) estén listos (máx 5s)
  await Promise.race([
    this._editorReady || Promise.resolve(),
    new Promise(r => setTimeout(r, 5000))
  ]);
  if (isStaleBoot()) return;

  updateSplash(80, 'Preparando preview...');
  await new Promise(r => setTimeout(r, 40));
  if (isStaleBoot()) return;

  this.initPreviewControls(appContainer);
  this.applyUILayout(appContainer);
  this.initToolbarToggle(appContainer);
  this.initSettings(appContainer);

  updateSplash(92, 'Compilando vista...');
  await new Promise(r => setTimeout(r, 40));
  if (isStaleBoot()) return;

  this.refreshLive(appContainer, true);

  updateSplash(100, '¡Listo!');

  // ── FASE 3: Mostrar app, ocultar splash ──
  await new Promise(r => setTimeout(r, 350));
  if (isStaleBoot()) return;
  appContainer.style.opacity = '1';

  const splash = container.querySelector('#lthpSplash');
  if (splash) {
    splash.classList.add('hide');
    setTimeout(() => splash.remove(), 600);
  }

// ✅ Cargar último proyecto al iniciar

  } catch(bootErr) {
    console.error('[LTH PROG] Boot error:', bootErr);
  } finally {
    if (isStaleBoot()) return;
    // Siempre mostrar app y ocultar splash, incluso si algo falla
    const _app = container.querySelector('#lthpAppContainer');
    if (_app) _app.style.opacity = '1';
    const _splash = container.querySelector('#lthpSplash');
    if (_splash) { _splash.classList.add('hide'); setTimeout(() => _splash.remove(), 600); }
  }

  })(); // end async boot
    },

    async loadLastProject(container) {
      // ❌ DESACTIVADO — App abre limpia sin cargar último proyecto
      return;
      // eslint-disable-next-line no-unreachable
      if (!window.electron?.fs) return;
      
      try {
        // Cargar configuración de la app
        const configResult = await _ProgFS.loadAppConfig('lth-prog');
        if (!configResult.success || !configResult.config || !configResult.config.lastProject) {
          return; // No hay proyecto guardado
        }
        
        const lastProjectName = configResult.config.lastProject;
        
        // Cargar el proyecto
     const result = await _ProgFS.loadProject(lastProjectName);

if (result.success && result.project) {
  const project = result.project;

  // ✅ MULTI-ARCHIVO REAL
  if (Array.isArray(project.filesList) && project.filesList.length) {
    this.state.filesList = project.filesList.map(f => ({
      id: f.id || `${f.type || 'html'}-${Date.now()}`,
      name: f.name || 'Sin nombre',
      type: f.type || 'html',
      path: f.path || null,
      content: f.content || ''
    }));

    this.state.activeFileId =
      project.activeFileId && this.state.filesList.some(x => x.id === project.activeFileId)
        ? project.activeFileId
        : this.state.filesList[0].id;

    // Restaurar archivos ocultos
    this.state.hiddenFiles = Array.isArray(project.hiddenFiles) ? project.hiddenFiles : [];

    // set editorTab según el activo
    const active = this.state.filesList.find(x => x.id === this.state.activeFileId);
    if (active) this.state.editorTab = active.type;

    // mantener legacy vivo (html/css/js)
    this._syncLegacyFiles && this._syncLegacyFiles();
  } else {
    // 🔁 Fallback a proyectos viejos (solo 3 tabs)
    this.state.files.html.content = project.files?.html?.content || '';
    this.state.files.css.content  = project.files?.css?.content  || '';
    this.state.files.js.content   = project.files?.js?.content   || '';
    this.state.editorTab = 'html';

    // asegurar filesList mínimo para no romper tu UI multi-file
    this.state.filesList = [
      { id: 'html-1', name: this.state.files?.html?.name || 'index.html',  type: 'html', path: null, content: this.state.files.html.content || '' },
      { id: 'css-1',  name: this.state.files?.css?.name  || 'styles.css', type: 'css',  path: null, content: this.state.files.css.content  || '' },
      { id: 'js-1',   name: this.state.files?.js?.name   || 'app.js',     type: 'js',   path: null, content: this.state.files.js.content   || '' }
    ];
    this.state.activeFileId = 'html-1';

    this._syncLegacyFiles && this._syncLegacyFiles();
  }

  // Cargar configuración
  if (project.device) this.state.device = project.device;
  this.state.split = false;
  this.state.live = false;

  // Actualizar estado
  this.state.currentProject = lastProjectName;

  // ✅ FIX REAL: abrir archivo activo + nombre correcto + tabs correctas
  this._syncLegacyFiles && this._syncLegacyFiles();
  this._renderDynamicTabs && this._renderDynamicTabs();

  if (this._openFileById && this.state.activeFileId) {
    this._openFileById(this.state.activeFileId);
  } else if (this.editor && this.editor.setValue) {
    const a =
      (this.state.filesList || []).find(f => f.id === this.state.activeFileId) ||
      (this.state.filesList || [])[0];

    this.editor.setValue(a?.content ?? '');
    const currentFileName = container.querySelector('#currentFileName');
    if (currentFileName) currentFileName.textContent = a?.name || 'Sin nombre';
  }

  const projectIndicator = container.querySelector('#projectIndicator');
  if (projectIndicator) {
    projectIndicator.style.display = 'inline';
    projectIndicator.textContent = `📁 ${lastProjectName}`;
  }

  this.refreshLive(container, true);
  this.showNotification(`📂 Proyecto "${lastProjectName}" cargado`);
}

      } catch (err) {
        console.error('Error cargando último proyecto:', err);
      }
    },

    initColorPicker(editor, container) {
      if (!editor || !editor.on) return; // Solo funciona con CodeMirror
      
      const colorRegex = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b|rgba?\s*\([^)]+\)|\btransparent\b/gi;
      let colorWidgets = [];
      let currentPicker = null;
      const trackGlobalNode = (node) => {
        if (!node) return node;
        this._globalNodes = this._globalNodes || new Set();
        try { node.dataset.lthProgGlobal = '1'; } catch {}
        this._globalNodes.add(node);
        return node;
      };
      const cleanupTrackedNode = (node) => {
        if (!node) return;
        try { this._globalNodes?.delete(node); } catch {}
        try { if (node.isConnected) node.remove(); } catch {}
      };
      
      const removeAllWidgets = () => {
        colorWidgets.forEach(widget => widget.clear());
        colorWidgets = [];
      };
      
      const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : null;
      };
      
      const rgbToHex = (r, g, b) => {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
      };

      const parseCssColor = (value) => {
        const color = String(value || '').trim();
        if (!color) return null;
        if (/^transparent$/i.test(color)) {
          return { r: 255, g: 255, b: 255, a: 0 };
        }
        if (color.startsWith('#')) {
          const rgb = hexToRgb(color);
          return rgb ? { ...rgb, a: 1 } : null;
        }
        if (/^rgba?/i.test(color)) {
          const match = color.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?/);
          if (!match) return null;
          return {
            r: parseInt(match[1], 10),
            g: parseInt(match[2], 10),
            b: parseInt(match[3], 10),
            a: match[4] != null ? Math.max(0, Math.min(1, parseFloat(match[4]))) : 1
          };
        }
        return null;
      };

      const formatCssColor = (r, g, b, a) => {
        const alpha = Math.max(0, Math.min(1, Number(a ?? 1)));
        if (alpha <= 0) return 'transparent';
        if (alpha >= 1) return rgbToHex(r, g, b);
        return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')})`;
      };
      
      const showColorPicker = (color, line, ch, matchLength) => {
        if (currentPicker) {
          document.body.removeChild(currentPicker);
          currentPicker = null;
        }
        
        const picker = document.createElement('div');
        picker.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;background:linear-gradient(135deg,#1a1a24,#0f0f14);border:2px solid rgba(100,150,255,0.4);border-radius:20px;padding:24px;box-shadow:0 30px 90px rgba(0,0,0,0.95),0 0 60px rgba(100,150,255,0.3);width:340px';
        
        let r = 255, g = 255, b = 255, a = 1;
        const parsedColor = parseCssColor(color);
        if (parsedColor) {
          r = parsedColor.r;
          g = parsedColor.g;
          b = parsedColor.b;
          a = parsedColor.a;
        }
        
        // Convertir RGB a HSL
        const rgbToHsl = (r, g, b) => {
          r /= 255; g /= 255; b /= 255;
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          let h, s, l = (max + min) / 2;
          if (max === min) { h = s = 0; }
          else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
              case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
              case g: h = ((b - r) / d + 2) / 6; break;
              case b: h = ((r - g) / d + 4) / 6; break;
            }
          }
          return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
        };
        
        const hslToRgb = (h, s, l) => {
          h /= 360; s /= 100; l /= 100;
          let r, g, b;
          if (s === 0) { r = g = b = l; }
          else {
            const hue2rgb = (p, q, t) => {
              if (t < 0) t += 1; if (t > 1) t -= 1;
              if (t < 1/6) return p + (q - p) * 6 * t;
              if (t < 1/2) return q;
              if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
              return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
          }
          return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
        };
        
        let hsl = rgbToHsl(r, g, b);
        
        const updateColor = () => {
          const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
          r = rgb.r; g = rgb.g; b = rgb.b;
          const hexColor = rgbToHex(r, g, b);
          const cssColor = formatCssColor(r, g, b, a);
          
          picker.querySelector('.color-preview-fill').style.background = cssColor;
          picker.querySelector('#colorHex').value = cssColor;
          picker.querySelector('#hueValue').textContent = hsl.h + '°';
          picker.querySelector('#satValue').textContent = hsl.s + '%';
          picker.querySelector('#lightValue').textContent = hsl.l + '%';
          picker.querySelector('#alphaValue').textContent = Math.round(a * 100) + '%';
          picker.querySelector('#hueSlider').value = hsl.h;
          picker.querySelector('#satSlider').value = hsl.s;
          picker.querySelector('#lightSlider').value = hsl.l;
          picker.querySelector('#alphaSlider').value = Math.round(a * 100);
          picker.querySelector('#alphaSlider').style.background = `linear-gradient(to right, rgba(${r}, ${g}, ${b}, 0), rgba(${r}, ${g}, ${b}, 1))`;
        };
        
        picker.innerHTML = `
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
            <div style="font-size:16px;font-weight:700;color:#fff;flex:1">🎨 Color Picker</div>
            <button id="closePickerBtn" style="width:32px;height:32px;border:2px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.05);color:#fff;border-radius:8px;cursor:pointer;font-size:16px">×</button>
          </div>
          
          <div style="display:flex;gap:16px;margin-bottom:20px">
            <div class="color-preview" style="width:80px;height:80px;border-radius:12px;border:2px solid rgba(255,255,255,0.2);background:
              linear-gradient(45deg, rgba(255,255,255,0.08) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.08) 75%),
              linear-gradient(45deg, rgba(255,255,255,0.08) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.08) 75%);
              background-size:16px 16px;
              background-position:0 0,8px 8px;
              box-shadow:0 8px 24px rgba(0,0,0,0.4);
              overflow:hidden;
              position:relative">
              <div class="color-preview-fill" style="position:absolute;inset:0;background:${formatCssColor(r, g, b, a)}"></div>
            </div>
            <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:10px">
              <input type="text" id="colorHex" value="${formatCssColor(r, g, b, a)}" style="width:100%;padding:10px 12px;border:2px solid rgba(100,150,255,0.3);border-radius:10px;background:rgba(0,0,0,0.3);color:#fff;font-size:14px;font-family:monospace;font-weight:600;text-align:center">
              <div style="color:rgba(255,255,255,0.45);font-size:11px;line-height:1.3">Acepta <code style="color:#c4b5fd">#hex</code>, <code style="color:#c4b5fd">rgba(...)</code> y <code style="color:#c4b5fd">transparent</code></div>
            </div>
          </div>
          
          <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:20px">
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                <span style="color:rgba(255,255,255,0.7);font-size:12px;font-weight:600">Tono (Hue)</span>
                <span id="hueValue" style="color:#fff;font-size:12px;font-weight:700">${hsl.h}°</span>
              </div>
              <input type="range" id="hueSlider" min="0" max="360" value="${hsl.h}" style="width:100%;height:8px;border-radius:4px;background:linear-gradient(to right,#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000);outline:none;-webkit-appearance:none;appearance:none;cursor:pointer">
            </div>
            
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                <span style="color:rgba(255,255,255,0.7);font-size:12px;font-weight:600">Saturación</span>
                <span id="satValue" style="color:#fff;font-size:12px;font-weight:700">${hsl.s}%</span>
              </div>
              <input type="range" id="satSlider" min="0" max="100" value="${hsl.s}" style="width:100%;height:8px;border-radius:4px;background:linear-gradient(to right,#808080,hsl(${hsl.h},100%,50%));outline:none;-webkit-appearance:none;appearance:none;cursor:pointer">
            </div>
            
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                <span style="color:rgba(255,255,255,0.7);font-size:12px;font-weight:600">Luminosidad</span>
                <span id="lightValue" style="color:#fff;font-size:12px;font-weight:700">${hsl.l}%</span>
              </div>
              <input type="range" id="lightSlider" min="0" max="100" value="${hsl.l}" style="width:100%;height:8px;border-radius:4px;background:linear-gradient(to right,#000000,hsl(${hsl.h},${hsl.s}%,50%),#ffffff);outline:none;-webkit-appearance:none;appearance:none;cursor:pointer">
            </div>

            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                <span style="color:rgba(255,255,255,0.7);font-size:12px;font-weight:600">Transparencia / Opacidad</span>
                <span id="alphaValue" style="color:#fff;font-size:12px;font-weight:700">${Math.round(a * 100)}%</span>
              </div>
              <input type="range" id="alphaSlider" min="0" max="100" value="${Math.round(a * 100)}" style="width:100%;height:8px;border-radius:4px;background:linear-gradient(to right,rgba(${r},${g},${b},0),rgba(${r},${g},${b},1));outline:none;-webkit-appearance:none;appearance:none;cursor:pointer">
            </div>
          </div>
          
          <div style="margin-bottom:16px">
            <div style="color:rgba(255,255,255,0.7);font-size:12px;font-weight:600;margin-bottom:10px">Colores rápidos</div>
            <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px">
              <button class="preset-color" data-color="#ff6b6b" style="height:36px;border-radius:8px;border:2px solid rgba(255,107,107,0.3);background:#ff6b6b;cursor:pointer;transition:transform 0.2s"></button>
              <button class="preset-color" data-color="#4ecdc4" style="height:36px;border-radius:8px;border:2px solid rgba(78,205,196,0.3);background:#4ecdc4;cursor:pointer;transition:transform 0.2s"></button>
              <button class="preset-color" data-color="#ffe66d" style="height:36px;border-radius:8px;border:2px solid rgba(255,230,109,0.3);background:#ffe66d;cursor:pointer;transition:transform 0.2s"></button>
              <button class="preset-color" data-color="#a8e6cf" style="height:36px;border-radius:8px;border:2px solid rgba(168,230,207,0.3);background:#a8e6cf;cursor:pointer;transition:transform 0.2s"></button>
              <button class="preset-color" data-color="#ff8b94" style="height:36px;border-radius:8px;border:2px solid rgba(255,139,148,0.3);background:#ff8b94;cursor:pointer;transition:transform 0.2s"></button>
              <button class="preset-color" data-color="#c7ceea" style="height:36px;border-radius:8px;border:2px solid rgba(199,206,234,0.3);background:#c7ceea;cursor:pointer;transition:transform 0.2s"></button>
              <button class="preset-color" data-color="transparent" title="Transparente" style="height:36px;border-radius:8px;border:2px dashed rgba(255,255,255,0.35);background:
                linear-gradient(45deg, rgba(255,255,255,0.12) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.12) 75%),
                linear-gradient(45deg, rgba(255,255,255,0.12) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.12) 75%);
                background-size:12px 12px;
                background-position:0 0,6px 6px;
                cursor:pointer;transition:transform 0.2s"></button>
            </div>
          </div>
          
          <div style="display:flex;gap:10px">
            <button id="applyColor" style="flex:1;padding:12px;border:2px solid rgba(99,102,241,0.5);background:linear-gradient(135deg,rgba(99,102,241,0.4),rgba(139,92,246,0.4));color:#fff;border-radius:12px;cursor:pointer;font-weight:700;font-size:14px;transition:all 0.2s">✓ Aplicar</button>
            <button id="cancelColor" style="padding:12px 20px;border:2px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.8);border-radius:12px;cursor:pointer;font-size:14px;transition:all 0.2s">Cancelar</button>
          </div>
        `;
        
        document.body.appendChild(trackGlobalNode(picker));
        currentPicker = picker;
        
        const colorHex = picker.querySelector('#colorHex');
        const hueSlider = picker.querySelector('#hueSlider');
        const satSlider = picker.querySelector('#satSlider');
        const lightSlider = picker.querySelector('#lightSlider');
        const alphaSlider = picker.querySelector('#alphaSlider');
        const applyBtn = picker.querySelector('#applyColor');
        const cancelBtn = picker.querySelector('#cancelColor');
        const closeBtn = picker.querySelector('#closePickerBtn');
        const presets = picker.querySelectorAll('.preset-color');
        
        // Actualizar sliders dinámicamente
        hueSlider.oninput = () => {
          hsl.h = parseInt(hueSlider.value);
          satSlider.style.background = `linear-gradient(to right,#808080,hsl(${hsl.h},100%,50%))`;
          lightSlider.style.background = `linear-gradient(to right,#000000,hsl(${hsl.h},${hsl.s}%,50%),#ffffff)`;
          updateColor();
        };
        
        satSlider.oninput = () => {
          hsl.s = parseInt(satSlider.value);
          lightSlider.style.background = `linear-gradient(to right,#000000,hsl(${hsl.h},${hsl.s}%,50%),#ffffff)`;
          updateColor();
        };
        
        lightSlider.oninput = () => {
          hsl.l = parseInt(lightSlider.value);
          updateColor();
        };

        alphaSlider.oninput = () => {
          a = parseInt(alphaSlider.value, 10) / 100;
          updateColor();
        };
        
        colorHex.oninput = (e) => {
          const val = e.target.value;
          const parsed = parseCssColor(val);
          if (parsed) {
            r = parsed.r; g = parsed.g; b = parsed.b; a = parsed.a;
            hsl = rgbToHsl(r, g, b);
            updateColor();
          }
        };
        
        presets.forEach(btn => {
          btn.onmouseenter = () => btn.style.transform = 'scale(1.1)';
          btn.onmouseleave = () => btn.style.transform = 'scale(1)';
          btn.onclick = () => {
            const presetColor = btn.dataset.color;
            const parsed = parseCssColor(presetColor);
            if (parsed) {
              r = parsed.r; g = parsed.g; b = parsed.b; a = parsed.a;
              hsl = rgbToHsl(r, g, b);
              updateColor();
            }
          };
        });

        updateColor();
        
        applyBtn.onclick = () => {
          const newColor = colorHex.value;
          editor.replaceRange(newColor, {line, ch}, {line, ch: ch + matchLength});
          cleanupTrackedNode(picker);
          currentPicker = null;
          updateColorWidgets();
        };
        
        const closePicker = () => {
          if (currentPicker) {
            cleanupTrackedNode(currentPicker);
            currentPicker = null;
          }
        };
        
        cancelBtn.onclick = closePicker;
        closeBtn.onclick = closePicker;
        
        // Cerrar con ESC
        const escHandler = (e) => {
          if (e.key === 'Escape') {
            closePicker();
            document.removeEventListener('keydown', escHandler);
          }
        };
        document.addEventListener('keydown', escHandler);
        
        // Cerrar al hacer click fuera - EVITAR que se cierre al arrastrar sliders
        setTimeout(() => {
          let isDraggingSlider = false;
          
          hueSlider.onmousedown = () => { isDraggingSlider = true; };
          satSlider.onmousedown = () => { isDraggingSlider = true; };
          lightSlider.onmousedown = () => { isDraggingSlider = true; };
          alphaSlider.onmousedown = () => { isDraggingSlider = true; };
          
          document.addEventListener('mouseup', () => { isDraggingSlider = false; });
          
          const clickOutside = (e) => {
            if (isDraggingSlider) return; // NO cerrar si está arrastrando slider
            if (!picker.contains(e.target)) {
              closePicker();
              document.removeEventListener('click', clickOutside);
              document.removeEventListener('mousedown', clickOutside);
            }
          };
          document.addEventListener('mousedown', clickOutside);
        }, 100);
      };
      
      const updateColorWidgets = () => {
        removeAllWidgets();
        
        const lineCount = editor.lineCount();
        for (let i = 0; i < lineCount; i++) {
          const line = editor.getLine(i);
          if (!line) continue;
          
          let match;
          const regex = new RegExp(colorRegex);
          while ((match = regex.exec(line)) !== null) {
            const color = match[0];
            const ch = match.index;
            
            const widget = document.createElement('span');
            widget.className = 'color-widget';
            widget.style.cssText = `
              display:inline-block;
              width:14px;
              height:14px;
              border-radius:3px;
              border:1px solid rgba(255,255,255,0.3);
              margin:0 4px;
              cursor:pointer;
              vertical-align:middle;
              background:${color};
              box-shadow:0 2px 4px rgba(0,0,0,0.3);
            `;
            
            widget.onclick = (e) => {
              e.stopPropagation();
              showColorPicker(color, i, ch, color.length);
            };
            
            const bookmark = editor.setBookmark(
              {line: i, ch: ch + color.length},
              {widget, insertLeft: true}
            );
            
            colorWidgets.push(bookmark);
          }
        }
      };
      
      // Actualizar widgets al cambiar el código
      editor.on('change', () => {
        clearTimeout(this._colorWidgetTimer);
        this._colorWidgetTimer = setTimeout(updateColorWidgets, 300);
      });
      
      // Inicializar
      setTimeout(updateColorWidgets, 500);
    },

    initEditor(container) {
      const root = container.querySelector('.lth-prog-root');
      const codeEditor = container.querySelector('#codeEditor');
      const fileTabs = Array.from(container.querySelectorAll('.file-tab'));
      const fileMenuBtn = container.querySelector('#fileMenuBtn');
      const fileMenuPanel = container.querySelector('#fileMenuPanel');
      const newFileBtn = container.querySelector('#newFileBtn');
      const openFileBtn = container.querySelector('#openFileBtn');
      const saveFileBtn = container.querySelector('#saveFileBtn');
      const saveAsBtn = container.querySelector('#saveAsBtn');
      const runBtn = container.querySelector('#runBtn');
      const currentFileName = container.querySelector('#currentFileName');
      this._globalNodes = this._globalNodes || new Set();
      const trackGlobalNode = (node) => {
        if (!node) return node;
        try { node.dataset.lthProgGlobal = '1'; } catch {}
        this._globalNodes.add(node);
        return node;
      };
      const cleanupTrackedNode = (node) => {
        if (!node) return;
        try { this._globalNodes.delete(node); } catch {}
        try { if (node.isConnected) node.remove(); } catch {}
      };
      this._cleanupGlobalNodes = () => {
        try {
          Array.from(this._globalNodes || []).forEach((node) => {
            try { if (node?.isConnected) node.remove(); } catch {}
          });
        } catch {}
        this._globalNodes = new Set();
        try {
          document.querySelectorAll('[data-lth-prog-global="1"]').forEach((node) => {
            try { node.remove(); } catch {}
          });
        } catch {}
      };

              


          






















































/* =========================================================
   GUIA MODULE — LTH PROG (BOTÓN BLINDADO)
   - 1 listener único (no se acumula al re-init)
   - anti doble click / anti spam
   - load single-flight (una sola carga a la vez)
   ========================================================= */

const guideBtn = container.querySelector('#guideBtn');

// getAppsPath() devuelve algo como "D:/LTH-iOs/src/apps"
// electron.fs.readFile en Windows necesita backslashes
const _appsBase = (window.AppLoader?.getAppsPath?.() || '');
// Convertir a backslashes para Windows
const _appsBaseWin = _appsBase.replace(/\//g, '\\');
const GUIA_PATH = _appsBaseWin ? `${_appsBaseWin}\\modulos\\guia.main.js` : null;
const GUIA_CSS  = _appsBaseWin ? `${_appsBaseWin}\\modulos\\guia-style.css` : null;

// --- 1) Limpieza automática si initEditor se llama otra vez
container.__lthGuiaAbort?.abort?.();
const guiaAbort = new AbortController();
container.__lthGuiaAbort = guiaAbort;

// --- 2) Single-flight loader
let guiaLoadingPromise = null;

async function loadGuiaModuleOnce() {
  if (window.LTH_Guia?.open) return true;
  if (guiaLoadingPromise) return guiaLoadingPromise;

  guiaLoadingPromise = (async () => {
    try {
      // CSS (opcional)
      if (!document.querySelector('style[data-guia-style="1"]')) {
        try {
          const cssRes = await window.electron.fs.readFile(GUIA_CSS);
          const css = String(cssRes?.content || '');
          if (css.trim()) {
            const style = document.createElement('style');
            style.setAttribute('data-guia-style', '1');
            style.textContent = css;
            document.head.appendChild(style);
          }
        } catch {}
      }

      // JS — igual que la versión original que funcionaba
      const jsRes = await window.electron.fs.readFile(GUIA_PATH);
      if (!jsRes?.success) throw new Error(jsRes?.error || 'readFile failed');

      const code = String(jsRes.content || '');
      if (!code.trim()) throw new Error('guia.main.js vacío');

      if (!document.querySelector('script[data-guia-src="1"]')) {
        const tag = document.createElement('script');
        tag.type = 'text/javascript';
        tag.setAttribute('data-guia-src', '1');
        tag.text = code + `\n//# sourceURL=${GUIA_PATH.replace(/\\/g, '/')}\n`;
        document.head.appendChild(tag);
      }

      return !!window.LTH_Guia?.open;
    } catch (e) {
      console.error('❌ GUIA load error:', e);
      return false;
    } finally {
      guiaLoadingPromise = null;
    }
  })();

  return guiaLoadingPromise;
}

// --- 3) Handler
let guiaClickLock = false;

async function onGuideClick(e) {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  if (guiaClickLock) return;
  guiaClickLock = true;

  const btn = guideBtn;
  const prevHTML = btn ? btn.innerHTML : null;
  try {
    if (btn) {
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      btn.innerHTML = '<span>⏳ Guía...</span>';
    }

    const ok = await loadGuiaModuleOnce();
    if (!ok) {
      this?.showNotification
        ? this.showNotification('❌ No cargó guia.main.js')
        : alert('❌ No cargó guia.main.js');
      return;
    }

    window.LTH_Guia.open(container, this);

    // El overlay usa position:fixed — debe estar en document.body para funcionar.
    // Si hay un transform/will-change en algún ancestro crea un nuevo stacking context
    // y rompe el fixed. Solucion: asegurar z-index máximo y que esté en body.
    setTimeout(() => {
      const overlay = document.getElementById('lthGuiaOverlay');
      if (overlay) {
        // Mover a body si no está
        if (overlay.parentNode !== document.body) {
          document.body.appendChild(trackGlobalNode(overlay));
        }
        // Forzar visibilidad con z-index máximo
        overlay.style.position = 'fixed';
        overlay.style.zIndex = '2147483647'; // max int z-index
        overlay.style.display = 'flex';
      }
    }, 0);

  } finally {
    if (btn) {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      if (prevHTML) btn.innerHTML = prevHTML;
    }
    setTimeout(() => { guiaClickLock = false; }, 180);
  }
}

// Bind único por init
if (guideBtn) {
  guideBtn.addEventListener('click', onGuideClick.bind(this), {
    signal: guiaAbort.signal,
    passive: false
  });
}

























 // ===============================
// GUARDIAN ABSOLUTO v2.4.1 — LEE EDITOR REAL + anti-duplicados + evita [object Object]
// Pega esto dentro de LTH PROG (después de crear this.editor)
// ===============================
(function initGuardianBlock(){
  const APP = this;                 // <- importante: referencia estable a tu app
  const guardianBtn = container.querySelector('#guardianBtn');
  if (!guardianBtn) return;

  // ✅ anti listeners duplicados
  try { container.__guardianAbort?.abort?.(); } catch {}
  container.__guardianAbort = new AbortController();
  const __G_SIG = container.__guardianAbort.signal;

  let __guardianRunning = false;
  let __guardianLastRun = 0;

  const __voidTags = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);

  function __escapeHTML(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function __safeText(x){
    if (x == null) return '';
    if (typeof x === 'string') return x;
    if (typeof x === 'number' || typeof x === 'boolean') return String(x);
    try { return JSON.stringify(x, null, 2); } catch { return String(x); }
  }

  function __posFromIndex(text, idx){
    const pre = text.slice(0, idx);
    const lines = pre.split(/\r\n|\r|\n/);
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;
    return { line, col };
  }

  function __mkIssue(level, engine, message, file='(unknown)', line=0, col=0, extra={}){
    return { level, engine, message: __safeText(message), file, line, col, ...extra };
  }

  // --- Local checks ---
  function __checkHTML(html, fileName='index.html'){
    const issues = [];
    const re = /<\/?([a-zA-Z][\w:-]*)\b[^>]*>/g;
    const stack = [];
    let m;

    while ((m = re.exec(String(html || '')))) {
      const full = m[0];
      const tag = (m[1] || '').toLowerCase();
      const isClose = full.startsWith('</');
      const selfClose = full.endsWith('/>') || __voidTags.has(tag);
      if (!tag || selfClose) continue;

      const { line, col } = __posFromIndex(html, m.index);

      if (!isClose) {
        stack.push({ tag, line, col });
      } else {
        const top = stack.pop();
        if (!top) {
          issues.push(__mkIssue('error','HTML',`Cierre inesperado </${tag}>`, fileName, line, col));
        } else if (top.tag !== tag) {
          issues.push(__mkIssue(
            'error','HTML',
            `Tags desbalanceados: abriste <${top.tag}> (L${top.line}) pero cerraste </${tag}>`,
            fileName, line, col,
            { hint:`Revisa orden de cierres: deberías cerrar </${top.tag}> antes.` }
          ));
        }
      }
    }

    while (stack.length) {
      const top = stack.pop();
      issues.push(__mkIssue('error','HTML',`Tag sin cerrar <${top.tag}>`, fileName, top.line, top.col));
    }

    // a11y quick win
    if (/<img\b(?![^>]*\balt=)[^>]*>/i.test(html || '')) {
      issues.push(__mkIssue('warning','A11Y','Hay <img> sin alt (accesibilidad/SEO).', fileName, 0, 0));
    }

    return issues;
  }

  function __checkJS(js, fileName='app.js'){
    const issues = [];
    const code = String(js || '');
    if (!code.trim()) return issues;

    try {
      // Solo syntax-check
      new Function(code);
    } catch (e) {
      const msg = __safeText(e?.message || e);
      const st = String(e?.stack || '');
      let line = 0, col = 0;
      const m = st.match(/<anonymous>:(\d+):(\d+)/);
      if (m) { line = Number(m[1]||0); col = Number(m[2]||0); }
      issues.push(__mkIssue('error','JS',`SyntaxError: ${msg}`, fileName, line, col));
    }
    return issues;
  }

  function __checkCSS(css, fileName='styles.css'){
    const issues = [];
    const s = String(css || '');
    if (!s.trim()) return issues;

    const open = (s.match(/{/g) || []).length;
    const close = (s.match(/}/g) || []).length;
    if (open !== close) {
      issues.push(__mkIssue('error','CSS',`Llaves desbalanceadas: {=${open} }=${close}`, fileName, 0, 0));
    }
    if (/\bwidht\s*:/.test(s)) issues.push(__mkIssue('warning','CSS','Typo: "widht" → "width"', fileName, 0, 0));
    if (/justify-content\s*:\s*middle\b/.test(s)) issues.push(__mkIssue('warning','CSS','Valor inválido: justify-content: middle (usa center)', fileName, 0, 0));
    return issues;
  }

  // ✅ SIEMPRE lee el archivo activo desde CodeMirror
  function __syncActiveFromEditor(){
    const list = Array.isArray(APP.state?.filesList) ? APP.state.filesList : [];
    const activeId = APP.state?.activeFileId;
    const active = list.find(f => f.id === activeId);

    if (active && APP.editor && typeof APP.editor.getValue === 'function') {
      active.content = String(APP.editor.getValue() || '');
    }
  }

  function __readFileContent(file){
    const isActive = file?.id && file.id === APP.state?.activeFileId;
    if (isActive && APP.editor && typeof APP.editor.getValue === 'function') {
      return String(APP.editor.getValue() || '');
    }
    return String(file?.content || '');
  }

  function collectBundleForGuardian(){
    // Prefer multi-file
    const filesList = Array.isArray(APP.state?.filesList) ? APP.state.filesList : [];

    if (filesList.length) {
      __syncActiveFromEditor();

      const snapshot = filesList.map(f => {
        const content = __readFileContent(f);
        const lines = content ? content.split(/\r\n|\r|\n/).length : 0;
        return {
          id: f.id,
          name: f.name || f.id,
          type: f.type || '',
          content,
          bytes: content.length,
          lines
        };
      });

      const pick = (pred) => snapshot.find(pred)?.content || '';
      const html = pick(x => x.type === 'html' || /\.html$/i.test(x.name));
      const css  = pick(x => x.type === 'css'  || /\.css$/i.test(x.name));
      const js   = pick(x => x.type === 'js'   || /\.js$/i.test(x.name));

      const stats = {
        files: snapshot.length,
        lines: snapshot.reduce((a,x)=>a + (x.lines||0), 0),
        bytes: snapshot.reduce((a,x)=>a + (x.bytes||0), 0),
        activeFileId: APP.state?.activeFileId || null
      };

      return { html, css, js, files: snapshot.map(({id,name,type,content})=>({id,name,type,content})), stats };
    }

    // Fallback (si todavía no usas filesList)
    const activeTab = (APP.state?.editorTab || 'html').toLowerCase();
    const activeText = (APP.editor && typeof APP.editor.getValue === 'function') ? String(APP.editor.getValue()||'') : '';
    const html = activeTab === 'html' ? activeText : String(APP.state?.html || '');
    const css  = activeTab === 'css'  ? activeText : String(APP.state?.css  || '');
    const js   = activeTab === 'js'   ? activeText : String(APP.state?.js   || '');

    const files = [
      { id:'html-1', name:'index.html', type:'html', content: html },
      { id:'css-1',  name:'styles.css', type:'css',  content: css  },
      { id:'js-1',   name:'app.js',     type:'js',   content: js   },
    ];

    const stats = {
      files: 3,
      lines: files.reduce((a,f)=>a + ((f.content||'').split(/\r\n|\r|\n/).length), 0),
      bytes: files.reduce((a,f)=>a + (f.content||'').length, 0),
      activeFileId: null
    };

    return { html, css, js, files, stats };
  }

  // --- UI overlay ---
  function ensureGuardianOverlay(){
    let ov = container.querySelector('#lth-guardian-overlay');
    if (ov) return ov;

    ov = document.createElement('div');
    ov.id = 'lth-guardian-overlay';
    ov.style.cssText = `
      position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
      background:rgba(0,0,0,.55); backdrop-filter: blur(8px); z-index:9999;
    `;
    ov.innerHTML = `
      <div style="width:min(980px,92vw); border-radius:18px; background:rgba(20,20,20,.92);
                  border:1px solid rgba(255,255,255,.12); box-shadow:0 30px 90px rgba(0,0,0,.55);
                  padding:16px 16px 14px; color:#fff; font-family:system-ui;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <div id="ga-score" style="width:52px; height:52px; border-radius:14px; display:grid; place-items:center;
                                     background:rgba(100,100,100,.20); border:2px solid rgba(255,255,255,.14); 
                                     font-weight:900; font-size:20px; color:#aaa; transition:all 0.3s ease;">—</div>
            <div>
              <div style="font-weight:800">Guardian Absoluto • LTH</div>
              <div id="ga-meta" style="opacity:.72; font-size:12px">—</div>
            </div>
          </div>
          <button id="ga-close" style="border-radius:12px; padding:10px 14px; cursor:pointer;
                                       background:rgba(255,255,255,.06); color:#fff; border:1px solid rgba(255,255,255,.14);">
            Cerrar
          </button>
        </div>

        <div style="display:flex; gap:12px; margin-top:12px; flex-wrap:wrap;">
          <div style="flex:1; min-width:260px; border-radius:14px; padding:12px; background:rgba(255,255,255,.05);
                      border:1px solid rgba(255,255,255,.10);">
            <div style="font-weight:700; opacity:.85">Resumen</div>
            <div id="ga-summary" style="margin-top:6px; opacity:.92; font-size:13px">Errors: 0 • Warnings: 0 • Hints: 0</div>
          </div>

          <div style="flex:1; min-width:260px; border-radius:14px; padding:12px; background:rgba(255,255,255,.05);
                      border:1px solid rgba(255,255,255,.10);">
            <div style="font-weight:700; opacity:.85">Proyecto</div>
            <div id="ga-project" style="margin-top:6px; opacity:.92; font-size:13px">Files: 0 • Lines: 0 • Bytes: 0</div>
          </div>
        </div>

        <div style="margin-top:12px; border-radius:14px; padding:12px; background:rgba(140,40,40,.16);
                    border:1px solid rgba(255,255,255,.10);">
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <div style="font-weight:800">RESULTADOS</div>
            <div id="ga-engine" style="opacity:.75; font-size:12px">Engine: —</div>
          </div>
          <div id="ga-list" style="margin-top:10px; max-height:260px; overflow:auto; font-size:13px; line-height:1.35; opacity:.95;">
            —
          </div>
        </div>

        <div style="margin-top:10px; opacity:.65; font-size:12px">
          Analiza: HTML/CSS/JS • seguridad • performance • best practices.
        </div>
      </div>
    `;
    container.appendChild(ov);

    ov.querySelector('#ga-close')?.addEventListener('click', () => ov.remove(), { signal: __G_SIG });
    return ov;
  }

  function renderGuardian(overlay, model){
    const errs = model.errors.length;
    const warns = model.warnings.length;
    const hints = model.hints.length;

    // Usar el score del Guardian Python si está disponible, sino calcularlo
    const score = model.score !== undefined ? model.score : Math.max(0, 100 - (errs * 18 + warns * 6 + hints * 2));
    
    // Determinar color según score
    let bgColor, borderColor, textColor;
    if (score >= 90) {
      // Verde - Excelente
      bgColor = 'rgba(34, 197, 94, 0.25)';
      borderColor = 'rgba(34, 197, 94, 0.5)';
      textColor = '#22c55e';
    } else if (score >= 70) {
      // Verde claro - Bueno
      bgColor = 'rgba(74, 222, 128, 0.20)';
      borderColor = 'rgba(74, 222, 128, 0.45)';
      textColor = '#4ade80';
    } else if (score >= 50) {
      // Amarillo - Aceptable
      bgColor = 'rgba(250, 204, 21, 0.20)';
      borderColor = 'rgba(250, 204, 21, 0.45)';
      textColor = '#facc15';
    } else if (score >= 30) {
      // Naranja - Necesita mejoras
      bgColor = 'rgba(251, 146, 60, 0.22)';
      borderColor = 'rgba(251, 146, 60, 0.5)';
      textColor = '#fb923c';
    } else {
      // Rojo - Crítico
      bgColor = 'rgba(239, 68, 68, 0.22)';
      borderColor = 'rgba(239, 68, 68, 0.5)';
      textColor = '#ef4444';
    }
    
    const scoreEl = overlay.querySelector('#ga-score');
    scoreEl.textContent = String(score);
    scoreEl.style.background = bgColor;
    scoreEl.style.border = `2px solid ${borderColor}`;
    scoreEl.style.color = textColor;
    scoreEl.style.fontSize = '20px';
    scoreEl.style.fontWeight = '900';
    scoreEl.style.transition = 'all 0.3s ease';
    
    overlay.querySelector('#ga-meta').textContent = `took ${model.tookMs}ms • engines: ${model.engines.join(', ')}`;
    overlay.querySelector('#ga-engine').textContent = `Engine: ${model.engineLabel || 'GEN'}`;

    overlay.querySelector('#ga-summary').textContent = `Errors: ${errs} • Warnings: ${warns} • Hints: ${hints}`;
    overlay.querySelector('#ga-project').textContent = `Files: ${model.stats.files} • Lines: ${model.stats.lines} • Bytes: ${model.stats.bytes}`;

    const listEl = overlay.querySelector('#ga-list');
    const all = [...model.errors, ...model.warnings, ...model.hints];

    if (!all.length) {
      listEl.textContent = '✅ Limpio. No se detectaron issues.';
      return;
    }

    listEl.innerHTML = all.map((x)=>`
      <div style="padding:10px; border-radius:12px; margin-bottom:8px; background:rgba(255,255,255,.05);
                  border:1px solid rgba(255,255,255,.10);">
        <div style="display:flex; justify-content:space-between; gap:10px;">
          <div><b>${String(x.level||'').toUpperCase()}</b> • <span style="opacity:.8">${__escapeHTML(x.engine)}</span></div>
          <div style="opacity:.75">${__escapeHTML(x.file)}${x.line?` : L${x.line}${x.col?`:${x.col}`:''}`:''}</div>
        </div>
        <div style="margin-top:6px; white-space:pre-wrap">${__escapeHTML(x.message)}</div>
        ${x.hint ? `<div style="margin-top:6px; opacity:.8">💡 ${__escapeHTML(x.hint)}</div>` : ``}
      </div>
    `).join('');
  }

  async function runGuardianNow(){
    const now = Date.now();
    if (__guardianRunning) return;
    if (now - __guardianLastRun < 250) return; // throttle
    __guardianLastRun = now;

    __guardianRunning = true;
    guardianBtn?.classList.add('is-loading');
    guardianBtn?.setAttribute('disabled','disabled');

    const overlay = ensureGuardianOverlay();
    const t0 = performance.now();

    try {
      const bundle = collectBundleForGuardian();

      // Local checks (rápidos)
      const localIssues = [
        ...__checkHTML(bundle.html, 'index.html'),
        ...__checkCSS(bundle.css,  'styles.css'),
        ...__checkJS(bundle.js,    'app.js'),
      ];

      // Remote guardian.py (por preload)
      let remoteErrors = [];
      let remoteWarnings = [];
      let remoteHints = [];
      let stderr = '';

      if (window.electron?.py?.guardian) {
        const res = await window.electron.py.guardian(
          { html: bundle.html, css: bundle.css, js: bundle.js, files: bundle.files },
          { timeoutMs: 15000 }
        );

        stderr = __safeText(res?.stderr || '');
        if (stderr.trim()) remoteHints.push(__mkIssue('hint','GUARDIAN.PY', `stderr:\n${stderr}`, '(py)'));

        if (res?.ok && res?.data) {
          const re = Array.isArray(res.data.errors) ? res.data.errors : [];
          const rw = Array.isArray(res.data.warnings) ? res.data.warnings : [];
          const rh = Array.isArray(res.data.hints) ? res.data.hints : [];

          remoteErrors = re.map(e => __mkIssue('error','GUARDIAN.PY', e?.message ?? e, e?.file||'(bundle)', e?.line||0, e?.col||0));
          remoteWarnings = rw.map(w => __mkIssue('warning','GUARDIAN.PY', w?.message ?? w, w?.file||'(bundle)', w?.line||0, w?.col||0));
          remoteHints = remoteHints.concat(rh.map(h => __mkIssue('hint','GUARDIAN.PY', h?.message ?? h, h?.file||'(bundle)', h?.line||0, h?.col||0)));
        } else if (!res?.ok) {
          remoteErrors = [__mkIssue('error','GUARDIAN.PY', res?.error || res || 'Falló guardian.py', '(py)')];
        }
      } else {
        remoteWarnings = [__mkIssue('warning','GEN','No existe window.electron.py.guardian (preload).', '(preload)')];
      }

      const errors = [...localIssues.filter(x=>x.level==='error'), ...remoteErrors];
      const warnings = [...localIssues.filter(x=>x.level==='warning'), ...remoteWarnings];
      const hints = [...localIssues.filter(x=>x.level==='hint'), ...remoteHints];

      renderGuardian(overlay, {
        engineLabel: 'LTH',
        engines: ['HTML','CSS','JS','GUARDIAN.PY'],
        tookMs: Math.round(performance.now()-t0),
        stats: bundle.stats || {files:0,lines:0,bytes:0},
        errors, warnings, hints
      });

    } catch (e) {
      renderGuardian(overlay, {
        engineLabel:'GEN',
        engines:['GEN'],
        tookMs: Math.round(performance.now()-t0),
        stats: {files:0,lines:0,bytes:0},
        errors: [__mkIssue('error','GEN', e?.message || e, '(runtime)')],
        warnings: [],
        hints: []
      });
    } finally {
      __guardianRunning = false;
      guardianBtn?.classList.remove('is-loading');
      guardianBtn?.removeAttribute('disabled');
    }
  }

  // ✅ click
  guardianBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    runGuardianNow();
  }, { capture: true, signal: __G_SIG });

  // ✅ Ctrl+Q (captura arriba, pero sin romper el editor)
  container.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (String(e.key||'').toLowerCase() === 'q')) {
      e.preventDefault();
      e.stopPropagation();
      runGuardianNow();
    }
  }, { capture: true, signal: __G_SIG });
}).call(this);

// =====================================================================
// 🖍️ SISTEMA DE ROTULADOR / HIGHLIGHTER
// =====================================================================
(function initRotuladorBlock() {
  const rotuladorBtn = container.querySelector('#rotuladorBtn');
  if (!rotuladorBtn) return;

  const COLORS = [
    { id: 'yellow', label: 'Amarillo', bg: '#ffe600', cls: 'hl-yellow' },
    { id: 'green',  label: 'Verde',    bg: '#39ffb0', cls: 'hl-green'  },
    { id: 'cyan',   label: 'Cyan',     bg: '#00e5ff', cls: 'hl-cyan'   },
    { id: 'pink',   label: 'Rosa',     bg: '#ff50b4', cls: 'hl-pink'   },
    { id: 'orange', label: 'Naranja',  bg: '#ff8c00', cls: 'hl-orange' },
    { id: 'purple', label: 'Lila',     bg: '#be64ff', cls: 'hl-purple' },
    { id: 'red',    label: 'Rojo',     bg: '#ff4646', cls: 'hl-red'    },
    { id: 'white',  label: 'Blanco',   bg: '#ffffff', cls: 'hl-white'  },
  ];

  // ── Inyectar CSS propio al iniciar (no depende del buscador) ─────────
  if (!document.querySelector('#rotulador-styles')) {
    const s = document.createElement('style');
    s.id = 'rotulador-styles';
    s.textContent = `
      .hl-yellow  { background: rgba(255,230,0,0.32)  !important; border-bottom: 1.5px solid rgba(255,230,0,0.7); }
      .hl-green   { background: rgba(57,255,176,0.28) !important; border-bottom: 1.5px solid rgba(57,255,176,0.7); }
      .hl-cyan    { background: rgba(0,229,255,0.28)  !important; border-bottom: 1.5px solid rgba(0,229,255,0.7); }
      .hl-pink    { background: rgba(255,80,180,0.28) !important; border-bottom: 1.5px solid rgba(255,80,180,0.7); }
      .hl-orange  { background: rgba(255,140,0,0.30)  !important; border-bottom: 1.5px solid rgba(255,140,0,0.7); }
      .hl-purple  { background: rgba(190,100,255,0.30)!important; border-bottom: 1.5px solid rgba(190,100,255,0.7); }
      .hl-red     { background: rgba(255,70,70,0.28)  !important; border-bottom: 1.5px solid rgba(255,70,70,0.7); }
      .hl-white   { background: rgba(255,255,255,0.18)!important; border-bottom: 1.5px solid rgba(255,255,255,0.5); }
      .lth-rotulador-panel {
        position: fixed; z-index: 99998;
        background: linear-gradient(135deg,#1a1a2e,#0f0f1a);
        border: 1.5px solid rgba(100,150,255,0.35);
        border-radius: 16px; padding: 12px 14px;
        box-shadow: 0 12px 48px rgba(0,0,0,0.85), 0 0 24px rgba(100,150,255,0.15);
        display: flex; flex-direction: column; gap: 10px;
        min-width: 230px; font-family: 'DM Sans',sans-serif; font-size: 13px;
      }
      .lth-rotulador-panel .rp-title {
        font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.45);
        text-transform: uppercase; letter-spacing: 0.08em;
      }
      .lth-rotulador-panel .rp-colors { display: flex; gap: 7px; flex-wrap: wrap; }
      .lth-rotulador-panel .rp-swatch {
        width: 24px; height: 24px; border-radius: 50%; cursor: pointer;
        border: 2px solid transparent; transition: transform 0.15s, border-color 0.15s;
      }
      .lth-rotulador-panel .rp-swatch:hover { transform: scale(1.25); }
      .lth-rotulador-panel .rp-swatch.active { border-color: #fff; transform: scale(1.2); }
      .lth-rotulador-panel .rp-label-row { display: flex; gap: 6px; align-items: center; }
      .lth-rotulador-panel .rp-label-input {
        flex: 1; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15);
        border-radius: 8px; color: #fff; font-size: 12px; padding: 5px 9px; outline: none;
      }
      .lth-rotulador-panel .rp-label-input::placeholder { color: rgba(255,255,255,0.3); }
      .lth-rotulador-panel .rp-btn {
        background: rgba(100,150,255,0.18); border: 1px solid rgba(100,150,255,0.4);
        border-radius: 8px; color: #a0b8ff; font-size: 12px; padding: 5px 10px;
        cursor: pointer; white-space: nowrap; transition: background 0.15s;
      }
      .lth-rotulador-panel .rp-btn:hover { background: rgba(100,150,255,0.32); }
      .lth-rotulador-panel .rp-btn-clear {
        background: rgba(255,80,80,0.12); border-color: rgba(255,80,80,0.35); color: #ff9898;
      }
      .lth-rotulador-panel .rp-btn-clear:hover { background: rgba(255,80,80,0.25); }
      .lth-rotulador-panel .rp-divider { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 0; }
      .lth-rotulador-panel .rp-list-title { font-size: 10px; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.07em; }
      .lth-rotulador-panel .rp-list { display: flex; flex-direction: column; gap: 4px; max-height: 140px; overflow-y: auto; }
      .lth-rotulador-panel .rp-list::-webkit-scrollbar { width: 3px; }
      .lth-rotulador-panel .rp-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
      .lth-rotulador-panel .rp-item {
        display: flex; align-items: center; gap: 7px; padding: 4px 6px;
        border-radius: 7px; cursor: pointer; transition: background 0.12s;
        font-size: 11px; color: rgba(255,255,255,0.75);
      }
      .lth-rotulador-panel .rp-item:hover { background: rgba(255,255,255,0.06); }
      .lth-rotulador-panel .rp-item-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
      .lth-rotulador-panel .rp-item-del {
        margin-left: auto; color: rgba(255,100,100,0.6); font-size: 14px; line-height: 1;
        padding: 0 2px; cursor: pointer;
      }
      .lth-rotulador-panel .rp-item-del:hover { color: rgba(255,100,100,1); }
      .lth-rotulador-panel .rp-close-btn:hover { color: rgba(255,100,100,0.9) !important; }
      .lth-rotulador-panel .rp-empty { font-size: 11px; color: rgba(255,255,255,.3); padding: 2px 0; }
      .hl-tooltip {
        position: fixed; z-index: 99999;
        background: rgba(20,20,30,0.95); border: 1px solid rgba(255,255,255,0.15);
        border-radius: 8px; padding: 4px 10px; font-size: 11px; color: #fff;
        pointer-events: none; white-space: nowrap;
        box-shadow: 0 4px 16px rgba(0,0,0,0.6);
      }
      /* === CODE FOLDING (foldGutter) === */
      .CodeMirror-foldgutter {
        width: 14px;
      }
      .CodeMirror-foldgutter-open,
      .CodeMirror-foldgutter-folded {
        cursor: pointer;
        color: #858585;
        font-size: 13px;
        line-height: 1;
        padding: 0 2px;
        transition: color 0.15s;
        user-select: none;
      }
      .CodeMirror-foldgutter-open::after   { content: '▾'; }
      .CodeMirror-foldgutter-folded::after { content: '▸'; }
      .CodeMirror-foldgutter-open:hover,
      .CodeMirror-foldgutter-folded:hover  { color: #c5c5c5; }
      /* Línea plegada — marca visual premium */
      .CodeMirror-foldmarker {
        background: rgba(81,92,106,.45);
        border: 1px solid rgba(122,132,145,.55);
        border-radius: 5px;
        color: #d4d4d4;
        font-family: ui-monospace, monospace;
        font-size: 10px;
        padding: 0 6px;
        margin: 0 4px;
        cursor: pointer;
        box-shadow: none;
      }
      .CodeMirror-foldmarker:hover {
        background: rgba(38,79,120,.9);
        color: #fff;
      }
    `;
    document.head.appendChild(s);
  }

  // Estado persistido por archivo
  // highlights[fileId] = [{from, to, color, label, markObj}]
  if (!this.state) this.state = {};
  if (!this.state.highlights) this.state.highlights = {};

  let panel = null;
  let activeColor = COLORS[0];
  let tooltip = null;
  const self = this;

  // ── helpers ──────────────────────────────────────────────────────────
  const getFileId = () => {
    const f = self.state?.filesList?.find(f => f.id === self.state?.activeFileId);
    return f?.id || '__default__';
  };

  const getMarks = () => {
    const id = getFileId();
    if (!self.state.highlights[id]) self.state.highlights[id] = [];
    return self.state.highlights[id];
  };

  const colorDotStyle = (colorId) => {
    const c = COLORS.find(x => x.id === colorId);
    return c ? `background:${c.bg}` : 'background:#888';
  };

  // ── aplicar mark al editor ───────────────────────────────────────────
  const applyMark = (from, to, colorObj, label) => {
    const ed = self.editor;
    if (!ed || !ed.markText) return null;
    const markObj = ed.markText(from, to, {
      className: colorObj.cls,
      title: label || colorObj.label,
      inclusiveLeft: false,
      inclusiveRight: false,
    });
    // tooltip on mouseover via CodeMirror wrapper
    if (label) {
      const cmWrapper = ed.getWrapperElement();
      const handler = (e) => {
        const spans = cmWrapper.querySelectorAll('.' + colorObj.cls);
        spans.forEach(span => {
          span.addEventListener('mouseenter', (ev) => {
            showTooltip(label, ev.clientX, ev.clientY);
          });
          span.addEventListener('mouseleave', () => hideTooltip());
        });
      };
      // run once after render
      setTimeout(handler, 50);
    }
    return markObj;
  };

  const showTooltip = (text, x, y) => {
    hideTooltip();
    tooltip = document.createElement('div');
    tooltip.className = 'hl-tooltip';
    tooltip.textContent = '🏷️ ' + text;
    tooltip.style.left = (x + 12) + 'px';
    tooltip.style.top  = (y - 28) + 'px';
      document.body.appendChild(trackGlobalNode(tooltip));
  };
  const hideTooltip = () => {
    if (tooltip) { tooltip.remove(); tooltip = null; }
  };

  // ── re-aplicar marks al cambiar de archivo ───────────────────────────
  const reapplyMarksForFile = (fileId) => {
    const marks = self.state.highlights[fileId] || [];
    marks.forEach(m => {
      if (m.markObj && typeof m.markObj.clear === 'function') {
        try { m.markObj.clear(); } catch {}
      }
      const colorObj = COLORS.find(c => c.id === m.color) || COLORS[0];
      m.markObj = applyMark(m.from, m.to, colorObj, m.label);
    });
  };

  // Hook: cuando cambia el archivo activo, reaplicar marks
  const origSetActive = self._setActiveFileId?.bind(self);
  if (origSetActive) {
    self._setActiveFileId = (id) => {
      origSetActive(id);
      setTimeout(() => reapplyMarksForFile(id), 80);
    };
  }
  // También escuchar tab clicks directamente
  container.addEventListener('click', (e) => {
    const tab = e.target.closest('.lth-prog-tab');
    if (tab) {
      setTimeout(() => reapplyMarksForFile(getFileId()), 80);
    }
  });

  // ── render panel ─────────────────────────────────────────────────────
  const buildPanel = () => {
    if (panel) { panel.remove(); panel = null; return; }

    panel = document.createElement('div');
    panel.className = 'lth-rotulador-panel';

    // Posicionar relativo al botón, corrigiendo offset del container en Electron
    const btnRect = rotuladorBtn.getBoundingClientRect();
    const appRoot = container.closest('.lth-app-window, .app-window, [data-app]') || document.body;
    const rootRect = appRoot !== document.body ? appRoot.getBoundingClientRect() : { top: 0, left: 0 };
    const panelWidth = 260; // min-width(230) + padding(28) + margen
    let panelLeft = btnRect.left - rootRect.left - 60;
    // Clamp: si se sale por la derecha del viewport, mover a la izquierda del botón
    const maxLeft = window.innerWidth - rootRect.left - panelWidth - 8;
    if (panelLeft > maxLeft) panelLeft = Math.max(8, maxLeft);
    panel.style.top  = (btnRect.bottom - rootRect.top + 8) + 'px';
    panel.style.left = Math.max(8, panelLeft) + 'px';
    panel.style.maxHeight = '80vh';
    panel.style.maxWidth = 'calc(100vw - 16px)';

    const renderPanel = () => {
      const marks = getMarks();
      panel.innerHTML = `
        <div class="rp-title" style="display:flex;align-items:center;justify-content:space-between;">
          <span>🖍️ ROTULADOR</span>
          <span class="rp-close-btn" id="rpCloseBtn" title="Cerrar" style="cursor:pointer;font-size:16px;line-height:1;color:rgba(255,255,255,0.45);padding:0 2px;margin:-2px -4px -2px 0;transition:color 0.15s;">✕</span>
        </div>
        <div class="rp-colors">
          ${COLORS.map(c => `
            <div class="rp-swatch ${activeColor.id === c.id ? 'active' : ''}"
              style="background:${c.bg};box-shadow:0 0 8px ${c.bg}55"
              data-color="${c.id}" title="${c.label}"></div>
          `).join('')}
        </div>
        <div class="rp-label-row">
          <input class="rp-label-input" id="rpLabelInput" placeholder="Etiqueta opcional…" maxlength="40">
          <button class="rp-btn" id="rpApplyBtn">Marcar</button>
        </div>
        <hr class="rp-divider">
        <div class="rp-label-row" style="justify-content:space-between">
          <span class="rp-list-title">Marcas en este archivo (${marks.length})</span>
          ${marks.length ? `<button class="rp-btn rp-btn-clear" id="rpClearAllBtn">🗑 Limpiar todo</button>` : ''}
        </div>
        ${marks.length ? `
          <div class="rp-list" id="rpList">
            ${marks.map((m, i) => `
              <div class="rp-item" data-idx="${i}">
                <div class="rp-item-dot" style="${colorDotStyle(m.color)}"></div>
                <span>${m.label || ('Línea ' + (m.from.line + 1))}</span>
                <span class="rp-item-del" data-del="${i}" title="Eliminar">×</span>
              </div>
            `).join('')}
          </div>
        ` : `<div style="font-size:11px;color:rgba(255,255,255,.3);padding:2px 0">Sin marcas aún. Selecciona texto y haz click en <strong>Marcar</strong>.</div>`}
      `;

      // Swatches
      panel.querySelectorAll('.rp-swatch').forEach(s => {
        s.addEventListener('click', () => {
          const c = COLORS.find(x => x.id === s.dataset.color);
          if (c) { activeColor = c; renderPanel(); }
        });
      });

      // Marcar botón
      panel.querySelector('#rpApplyBtn')?.addEventListener('click', () => {
        const ed = self.editor;
        if (!ed || !ed.getSelection) return;
        const sel = ed.getSelection();
        if (!sel) { self.showNotification?.('⚠️ Selecciona texto primero'); return; }
        const from = ed.getCursor('from');
        const to   = ed.getCursor('to');
        const label = panel.querySelector('#rpLabelInput')?.value?.trim() || '';
        const markObj = applyMark(from, to, activeColor, label);
        getMarks().push({ from, to, color: activeColor.id, label, markObj });
        if (panel.querySelector('#rpLabelInput')) panel.querySelector('#rpLabelInput').value = '';
        self.showNotification?.('🖍️ Texto marcado');
        renderPanel();
      });

      // Limpiar todo
      panel.querySelector('#rpClearAllBtn')?.addEventListener('click', () => {
        const marks = getMarks();
        marks.forEach(m => { try { m.markObj?.clear(); } catch {} });
        self.state.highlights[getFileId()] = [];
        renderPanel();
        self.showNotification?.('🗑 Marcas eliminadas');
      });

      // Click en item → saltar a posición
      panel.querySelectorAll('.rp-item').forEach(item => {
        item.addEventListener('click', (e) => {
          if (e.target.dataset.del !== undefined) return;
          const idx = parseInt(item.dataset.idx);
          const m = getMarks()[idx];
          if (!m) return;
          self.editor?.setCursor?.(m.from);
          self.editor?.scrollIntoView?.({ from: m.from, to: m.to }, 80);
          self.editor?.focus?.();
        });
      });

      // Borrar marca individual
      panel.querySelectorAll('[data-del]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.del);
          const marks = getMarks();
          try { marks[idx]?.markObj?.clear(); } catch {}
          marks.splice(idx, 1);
          renderPanel();
        });
      });

      // Cerrar panel con X
      panel.querySelector('#rpCloseBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        buildPanel();
        rotuladorBtn.classList.remove('active');
      });
    };

    renderPanel();
    appRoot.appendChild(panel);

    // Cerrar al click fuera
    const outsideClick = (e) => {
      if (!panel.contains(e.target) && e.target !== rotuladorBtn) {
        panel.remove(); panel = null;
        document.removeEventListener('click', outsideClick, true);
      }
    };
    setTimeout(() => document.addEventListener('click', outsideClick, true), 10);
  };

  // ── wiring ───────────────────────────────────────────────────────────
  rotuladorBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    buildPanel();
    rotuladorBtn.classList.toggle('active', !!panel);
  });

  // Ctrl+H para abrir/cerrar
  container.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
      e.preventDefault();
      e.stopPropagation();
      rotuladorBtn.click();
    }
  }, { capture: true });

  // Limpiar al cerrar la app
  const origOnClose = self.onClose?.bind(self);
  self.onClose = function() {
    if (panel) { panel.remove(); panel = null; }
    hideTooltip();
    if (origOnClose) origOnClose();
  };

}).call(this);

// =====================================================================
// 🎨 COLOR DE SINTAXIS FLUORESCENTE
// =====================================================================
(function initColorVisionBlock() {
  const btn       = container.querySelector('#colorVisionBtn');
  const editorPane= container.querySelector('.editor-pane');
  if (!btn || !editorPane) return;

  const STORAGE_KEY = 'lth_cv_active';
  let active = localStorage.getItem(STORAGE_KEY) === '1';

  const apply = () => {
    if (active) {
      editorPane.classList.add('lth-cv-on');
      btn.classList.add('active');
    } else {
      editorPane.classList.remove('lth-cv-on');
      btn.classList.remove('active');
    }
    localStorage.setItem(STORAGE_KEY, active ? '1' : '0');
  };

  // Aplicar estado guardado al cargar
  apply();

  btn.addEventListener('click', () => {
    active = !active;
    apply();
  });

  // Ctrl+K toggle
  container.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      e.stopPropagation();
      btn.click();
    }
  }, { capture: true });

}).call(this);

// =====================================================================
// 🎨 RESALTADOR DE BLOQUES — markText por tipo de token
// =====================================================================
// =====================================================================
// 🎨 RESALTADOR DE BLOQUES — color uniforme por bloque completo
// =====================================================================



// =====================================================================
// =====================================================================
// 🎨 ROTULADOR DE BLOQUES
// =====================================================================
(function initBlockHL() {
  const self = this;
  const btn  = container.querySelector('#blockHlBtn');
  if (!btn) return;

  // Inyectar CSS
  if (!document.getElementById('lth-bhl-css')) {
    const s = document.createElement('style');
    s.id = 'lth-bhl-css';
    s.textContent = `
      #blockHlBtn.active { background:rgba(96,165,250,.2)!important; border-color:rgba(96,165,250,.5)!important; }
      .lth-bhl-wrap { transition: background .12s; }
    `;
    document.head.appendChild(s);
  }

  const PALETTE = [
    ['rgba(99,102,241,.2)','rgba(99,102,241,.9)'],
    ['rgba(251,191,36,.2)','rgba(251,191,36,.9)'],
    ['rgba(52,211,153,.2)','rgba(52,211,153,.9)'],
    ['rgba(248,113,113,.2)','rgba(248,113,113,.9)'],
    ['rgba(96,165,250,.2)','rgba(96,165,250,.9)'],
    ['rgba(167,139,250,.2)','rgba(167,139,250,.9)'],
    ['rgba(251,146,60,.2)','rgba(251,146,60,.9)'],
    ['rgba(45,212,191,.2)','rgba(45,212,191,.9)'],
  ];

  let enabled  = false;
  let active   = [];   // { line }[]
  let activeFr = -1;
  let colorIdx = 0;

  btn.addEventListener('click', () => {
    enabled = !enabled;
    btn.classList.toggle('active', enabled);
    if (!enabled) clearHL();
  });

  const clearHL = () => {
    const cm = self.editor; if (!cm) return;
    active.forEach(({ line }) => {
      try {
        cm.removeLineClass(line, 'wrap', 'lth-bhl-wrap');
        cm.removeLineClass(line, 'background', 'lth-bhl-bg');
      } catch {}
    });
    active = []; activeFr = -1;
  };

  const applyHL = (cm, from, to) => {
    clearHL();
    const [bg, brd] = PALETTE[colorIdx % PALETTE.length];
    colorIdx++;

    // CSS dinámico con alta especificidad
    let s = document.getElementById('lth-bhl-dyn');
    if (!s) { s = document.createElement('style'); s.id='lth-bhl-dyn'; document.head.appendChild(s); }
    s.textContent = `.CodeMirror-wrap .lth-bhl-wrap,.CodeMirror .lth-bhl-wrap{background:${bg}!important;box-shadow:inset 3px 0 0 ${brd}!important;}`;

    for (let i = from; i <= to; i++) {
      try { cm.addLineClass(i, 'wrap', 'lth-bhl-wrap'); } catch {}
      active.push({ line: i });
    }
    activeFr = from;
    if (to - from > 6) cm.scrollIntoView({ line: from, ch: 0 }, 80);
  };

  // ── Buscar fin de bloque { } ──────────────────────────────────────
  const findBraceEnd = (cm, start) => {
    const n = cm.lineCount();
    let depth = 0, opened = false, end = start;
    for (let i = start; i < Math.min(start+800, n); i++) {
      for (const c of cm.getLine(i)||'') {
        if (c==='{'){depth++;opened=true;}
        if (c==='}') depth--;
      }
      if (opened && depth<=0){end=i;break;}
    }
    return end;
  };

  // ── Buscar fin de tag HTML ────────────────────────────────────────
  const findTagEnd = (cm, start, tag) => {
    const n = cm.lineCount();
    const SC = ['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'];
    if (SC.includes(tag.toLowerCase()) || (cm.getLine(start)||'').includes('/>')) return start;
    const rO = new RegExp('<'+tag+'[\\s>/]','ig');
    const rC = new RegExp('</'+tag+'\\s*>','ig');
    let depth = 1;
    for (let i = start+1; i < Math.min(start+800,n); i++) {
      const t = cm.getLine(i)||'';
      depth += (t.match(rO)||[]).length - (t.match(rC)||[]).length;
      if (depth<=0) return i;
    }
    return start;
  };

  // ── Detectar bloque desde una línea ──────────────────────────────
  const detect = (cm, lineNum) => {
    const text = cm.getLine(lineNum)||'';
    const trim = text.trim();
    if (!trim) return null;

    // HTML tag apertura
    const m = trim.match(/^<([a-zA-Z][a-zA-Z0-9-]*)[\s>\/]/);
    if (m && !trim.startsWith('</') && !trim.startsWith('<!')) {
      return { from: lineNum, to: findTagEnd(cm, lineNum, m[1]) };
    }

    // Bloque { }
    if (trim.includes('{') && !trim.match(/^\s*\/\//)) {
      const end = findBraceEnd(cm, lineNum);
      return { from: lineNum, to: end };
    }

    // Línea indentada → subir al padre
    const indent = text.match(/^(\s+)/)?.[1]?.length || 0;
    if (indent > 0) {
      for (let i = lineNum-1; i >= Math.max(0, lineNum-150); i--) {
        const t = cm.getLine(i)||'';
        const ind = t.match(/^(\s+)/)?.[1]?.length || 0;
        if (ind < indent && t.trim()) {
          const b = detect(cm, i);
          if (b) return b;
          break;
        }
      }
    }
    return null;
  };

  // ── Conectar al editor via gutterClick ───────────────────────────
  const wire = (cm) => {
    // Registrar DESPUÉS de que el fold ya esté inicializado
    // usando 'gutterClick' en orden — CM llama todos los listeners
    cm.on('gutterClick', (instance, lineNum, gutter, e) => {
      if (!enabled) return;
      // Aceptar click en números O en foldgutter (cualquier lado)
      if (lineNum === activeFr) { clearHL(); return; }
      const block = detect(cm, lineNum);
      if (block) applyHL(cm, block.from, block.to);
    });
  };

  // Esperar hasta que el editor Y el gutter estén listos
  const tryWire = (tries=0) => {
    const cm = self.editor;
    if (cm && typeof cm.on === 'function' && cm.lineCount() >= 0) {
      wire(cm); return;
    }
    if (tries < 80) setTimeout(() => tryWire(tries+1), 250);
  };
  tryWire();

  // Reset al cambiar archivo
  container.addEventListener('click', e => {
    if (e.target.closest?.('.file-tab,.lfe-file-item')) setTimeout(clearHL, 80);
  });

}).call(this);

// 🤖 CLAUDE IA — Panel integrado en LTH PROG
// =====================================================================
(function initIABlock() {
  const iaBtn    = container.querySelector('#iaBtn');
  const iaPanel  = container.querySelector('#lthIaPanel');
  const closeBtn = container.querySelector('#iaCloseBtn');
  const messages = container.querySelector('#iaPanelMessages');
  const input    = container.querySelector('#iaInput');
  const sendBtn  = container.querySelector('#iaSendBtn');
  const ctxFile  = container.querySelector('#iaCtxFile');
  const ctxLines = container.querySelector('#iaCtxLines');
  const ctxSel   = container.querySelector('#iaCtxSel');
  const modelSel = container.querySelector('#iaModelSel');
  const modeSel  = container.querySelector('#iaModeSel');
  const attachBar = container.querySelector('#iaAttachedBar');
  const attachChips = container.querySelector('#iaAttachedChips');
  const attachBtn = container.querySelector('#iaAttachBtn');
  const quickActionsEl = container.querySelector('#iaQuickActions');
  const resetKeyBtn = container.querySelector('#iaResetKeyBtn');
  const fundingPlanBtn = container.querySelector('#iaFundingPlanBtn');
  const fundingGiftBtn = container.querySelector('#iaFundingGiftBtn');
  const fundingHintEl = container.querySelector('#iaFundingHint');

  if (!iaBtn || !iaPanel) return;

  const self = this;
  const IA_KEY      = 'lth_ia_apikey';
  const IA_HIST_KEY = 'lth_ia_history';
  const IA_MODE_KEY = 'lth_ia_mode';
  const IA_FUNDING_KEY = 'lth_prog_ai_funding_source';
  const IA_BRAIN_PREFIX = 'lth-prog:brain:v1:';
  const getModel    = () => modelSel?.value || 'auto';
  const getMode     = () => modeSel?.value || localStorage.getItem(IA_MODE_KEY) || 'efficiency';
  const getRealPlan = (state) => String(state?.profile?.plan || state?.credits?.plan || 'free').trim().toLowerCase() || 'free';
  const hasGiftPremiumAccess = (state) => (state?.hasGiftPremiumAccess === true || state?.credits?.gift_premium_access === true)
    && (Number(state?.credits?.gift_credits_balance ?? 0) || 0) > 0;
  const sanitizeFundingSource = (preferred = localStorage.getItem(IA_FUNDING_KEY) || 'plan') => {
    const wanted = String(preferred || 'plan').trim().toLowerCase();
    return wanted === 'gift' ? 'gift' : 'plan';
  };
  const restoreFundingSource = (state, preferred = localStorage.getItem(IA_FUNDING_KEY) || 'plan') => {
    const wanted = sanitizeFundingSource(preferred);
    if (wanted === 'gift' && !hasGiftPremiumAccess(state)) return 'plan';
    return wanted;
  };
  const hasPlanPremiumAccess = (state) => state?.signedIn && state?.profile?.plan_active === true && getRealPlan(state) !== 'free';
  const hasPremiumAccessForSource = (state, source = sanitizeFundingSource()) => source === 'gift'
    ? hasGiftPremiumAccess(state)
    : hasPlanPremiumAccess(state);
  const getFundingSource = async () => {
    let state = window.LTHAuth?.getStateSync?.();
    if (!state) {
      try { state = await window.LTHAuth?.getState?.(); } catch {}
    }
    return sanitizeFundingSource(localStorage.getItem(IA_FUNDING_KEY) || restoreFundingSource(state));
  };
  const renderFundingSourceSwitch = (state = window.LTHAuth?.getStateSync?.()) => {
    const source = sanitizeFundingSource(localStorage.getItem(IA_FUNDING_KEY) || restoreFundingSource(state));
    if (fundingPlanBtn) fundingPlanBtn.classList.toggle('active', source === 'plan');
    if (fundingGiftBtn) {
      fundingGiftBtn.classList.toggle('active', source === 'gift');
      fundingGiftBtn.disabled = !hasGiftPremiumAccess(state);
    }
    if (fundingHintEl) {
      const giftBalance = Math.max(0, Number(state?.credits?.gift_credits_balance ?? 0) || 0);
      fundingHintEl.textContent = source === 'gift'
        ? `Saldo premium: ${giftBalance} CR`
        : (getRealPlan(state) === 'free' ? 'Plan free: mantendra el bloqueo premium.' : 'Usando el wallet del plan.');
    }
  };
  try { localStorage.setItem(IA_FUNDING_KEY, restoreFundingSource(window.LTHAuth?.getStateSync?.(), localStorage.getItem(IA_FUNDING_KEY) || 'plan')); } catch {}

  let isOpen    = false;
  let isLoading = false;
  let history   = [];
  let attachedFiles = []; // {name, content}
  let sessionCost = 0; // USD
  let cachedApiKey = '';
  const hydrateStoredApiKey = async () => {
    if (window.electron?.secureStore?.get) {
      try {
        const result = await window.electron.secureStore.get(IA_KEY);
        if (result?.success && result.value) {
          cachedApiKey = String(result.value || '').trim();
          try { localStorage.removeItem(IA_KEY); } catch {}
          return cachedApiKey;
        }
      } catch (error) {
        console.warn('[LTH PROG] No se pudo leer la API Key segura:', error?.message || error);
      }
    }

    cachedApiKey = String(localStorage.getItem(IA_KEY) || '').trim();
    if (cachedApiKey && window.electron?.secureStore?.set) {
      try {
        await window.electron.secureStore.set(IA_KEY, cachedApiKey);
        localStorage.removeItem(IA_KEY);
      } catch {}
    }
    return cachedApiKey;
  };
  const keyReady = hydrateStoredApiKey();
  try {
    history = JSON.parse(localStorage.getItem(IA_HIST_KEY) || '[]');
    // Clean old bloated history entries (from before smart context)
    history = history.map(h => ({
      role: h.role,
      content: (h.content || '').length > 500 ? h.content.substring(0, 200) + '...' : h.content
    })).slice(-16);
    localStorage.setItem(IA_HIST_KEY, JSON.stringify(history));
  } catch { history = []; }

  const autoApplyEl = container.querySelector('#iaAutoApply');
  const costCounterEl = container.querySelector('#iaCostCounter');

  // ── Medidor de uso COMPARTIDO con LTH IA ──
  // Lee los creditos del wallet (via LTHAuth) y muestra el % de la ventana usado.
  // Es el mismo dato que ve LTH IA y la web: gastar en Prog mueve esta barra en todos lados.
  const renderUsageMeter = () => {
    if (!costCounterEl) return;
    const state = window.LTHAuth?.getStateSync?.();
    const credits = state?.credits || window.LTHAuth?.getCredits?.();
    const source = sanitizeFundingSource(localStorage.getItem(IA_FUNDING_KEY) || restoreFundingSource(state));
    if (!credits) { costCounterEl.textContent = '—'; costCounterEl.title = 'Inicia sesion para ver tu uso.'; renderFundingSourceSwitch(state); return; }
    if (source === 'gift') {
      const giftBalance = Math.max(0, Number(credits.gift_credits_balance ?? 0) || 0);
      const giftDisplay = Number.isInteger(giftBalance) ? String(giftBalance) : giftBalance.toFixed(2);
      costCounterEl.textContent = `${giftDisplay} CR`;
      costCounterEl.title = 'Saldo disponible, usable en todos los modelos.';
      renderFundingSourceSwitch(state);
      return;
    }
    const limit = Number(credits.window_budget_cents ?? credits.window_credits_limit ?? 0) || 0;
    const used = Number(credits.window_used_cents ?? credits.window_credits_used ?? 0) || 0;
    const rawPct = Number(credits.window_usage_percent);
    const pct = Number.isFinite(rawPct) && rawPct > 0 ? rawPct : (limit > 0 ? (used / limit) * 100 : 0);
    costCounterEl.textContent = `${Math.max(0, Math.min(100, Math.round(pct)))}% uso`;
    costCounterEl.title = 'Uso de tu ventana de creditos (compartido con LTH IA)';
    renderFundingSourceSwitch(state);
  };
  // Tiempo real: cualquier cambio de creditos (este Prog, LTH IA o la web) repinta
  // el medidor al instante, sin esperar a reiniciar. LTHAuth.onChange emite cuando
  // alguna app hace applyCredits tras consumir.
  try {
    if (self._usageMeterUnsub) { try { self._usageMeterUnsub(); } catch (_) {} }
    self._usageMeterUnsub = window.LTHAuth?.onChange?.(() => { try { renderUsageMeter(); } catch (_) {} }) || null;
  } catch (_) {}
  self.state = self.state || {};
  // ── Puente de estado para los helpers de nivel-módulo ──
  // Las funciones de memoria física (.md) y "brain" viven en el top-level del
  // archivo (fuera del bloque IA), así que dentro de ellas `self`/`this` === window.
  // Sin este puente, `self.state` es undefined y al consultar/crear la memoria
  // de carpeta truena con "Cannot set properties of undefined (setting 'workspaceMode')".
  // El objeto state es estable (siempre se muta, nunca se reemplaza), así que basta aliasarlo.
  try { window.state = self.state; } catch {}
  // ── Fase 3: buffer de errores del preview ──
  // El script lth-prog-error-bridge (inyectado por refreshLive) manda por
  // postMessage cada error de runtime del iframe. Vive en la instancia (NO en
  // state) para no persistirse jamás en sesión/disco.
  if (!self._previewErrorListener) {
    self._previewErrorLog = [];
    self._previewErrorListener = (event) => {
      const data = event?.data;
      if (!data || data.type !== 'LTH_PROG_PREVIEW_ERROR') return;
      if (!Array.isArray(self._previewErrorLog)) self._previewErrorLog = [];
      self._previewErrorLog.push({
        ts: Date.now(),
        kind: String(data.kind || 'error').slice(0, 24),
        message: String(data.message || '').slice(0, 300),
        source: String(data.source || '').slice(0, 120),
        line: Number(data.line) || 0
      });
      if (self._previewErrorLog.length > 24) self._previewErrorLog.shift();
    };
    window.addEventListener('message', self._previewErrorListener);
  }
  if (!Array.isArray(self.state.lastTargetFiles)) self.state.lastTargetFiles = [];
  if (!Object.prototype.hasOwnProperty.call(self.state, 'lastPlan')) self.state.lastPlan = null;
  if (!Object.prototype.hasOwnProperty.call(self.state, 'lastExecutableEdits')) self.state.lastExecutableEdits = null;
  if (!Object.prototype.hasOwnProperty.call(self.state, 'lastApplySummary')) self.state.lastApplySummary = null;
  if (!Object.prototype.hasOwnProperty.call(self.state, 'lastApplyFailure')) self.state.lastApplyFailure = null;
  if (!Object.prototype.hasOwnProperty.call(self.state, 'lastPreviewSnapshot')) self.state.lastPreviewSnapshot = null;
  if (!Object.prototype.hasOwnProperty.call(self.state, 'lastBrainSnapshot')) self.state.lastBrainSnapshot = null;

  // ── Token cost estimation ──
  const estimateTokens = (text) => Math.ceil((text || '').length / 3.5);
  const COST_PER_1K = { // input/output per 1K tokens
    auto:   { input: 0.003, output: 0.015 },
    sonnet: { input: 0.003, output: 0.015 },
    opus:   { input: 0.005, output: 0.025 },
    haiku:  { input: 0.001, output: 0.005 },
  };
  const trackCost = (inputText, outputText) => {
    const model = getModel();
    const rates = COST_PER_1K[model] || COST_PER_1K.auto;
    const inT = estimateTokens(inputText) / 1000;
    const outT = estimateTokens(outputText) / 1000;
    const cost = inT * rates.input + outT * rates.output;
    sessionCost += cost;
    // El medidor visible ahora muestra el uso REAL del wallet compartido, no el estimado local.
    renderUsageMeter();
    return cost;
  };
  const getRetryableErrorMeta = (input) => {
    const status = Number(input?.status) || 0;
    const code = String(input?.code || input?.errorType || '').trim().toLowerCase();
    const message = String(input?.error || input?.message || '').trim();
    const retryAfterMs = Number(input?.retryAfterMs) || 0;
    const retryable = !!input?.retryable
      || status === 429
      || status === 529
      || /overload|overloaded|temporar|unavailable|rate limit|try again|busy|timeout|timed?\s*out|tard[oó]\s+demasiado/i.test(`${code} ${message}`);
    return {
      status,
      code,
      message,
      retryAfterMs,
      retryable
    };
  };
  const isRetryableAIError = (input) => getRetryableErrorMeta(input).retryable;
  const isTimeoutAIError = (input) => {
    const meta = getRetryableErrorMeta(input);
    return meta.status === 408 || /timeout|timed?\s*out|tard[oó]\s+demasiado/i.test(`${meta.code} ${meta.message}`);
  };
  const getRetryWaitMs = (input, attempt = 0) => {
    const meta = getRetryableErrorMeta(input);
    if (meta.retryAfterMs > 0) {
      return Math.min(Math.max(meta.retryAfterMs, 4000), 30000);
    }
    return Math.min(6000 + (attempt * 5000), 26000);
  };
  const formatRetryableErrorLabel = (input) => {
    const meta = getRetryableErrorMeta(input);
    if (meta.status === 429) return 'Límite alcanzado temporalmente';
    if (meta.status === 529 || /overload|overloaded/i.test(`${meta.code} ${meta.message}`)) return 'Claude está saturado temporalmente';
    if (/network|fetch|socket|reset|econn/i.test(`${meta.code} ${meta.message}`)) return 'Problema temporal de red';
    return 'Error transitorio del servicio IA';
  };

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cloneJSON = (value, fallback = null) => {
    try { return JSON.parse(JSON.stringify(value)); } catch { return fallback; }
  };
  const safeJSONStringify = (value, spacing = 2) => {
    try { return JSON.stringify(value, null, spacing); } catch { return String(value ?? ''); }
  };
  const shortText = (value, max = 160) => {
    const raw = String(value ?? '').replace(/\s+/g, ' ').trim();
    return raw.length > max ? `${raw.slice(0, Math.max(0, max - 1))}…` : raw;
  };
  const normalizeLooseFileRef = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\//g, '\\');
  const FIX_INTENT_RE = /\b(corr[ií]g|soluciona|repara|arregla|fix|debug|revisa|errores|bugs?|problemas|falla|rompe|no\s?funciona|no\s?sirve|no\s?carga|audita)\b/i;
  const READ_ONLY_INTENT_RE = /\b(explica|expl[ií]came|qu[eé]\s+hace|c[oó]mo\s+funciona|describe|solo\s+dime|sin\s+cambiar|sin\s+modificar|no\s+modifiques|no\s+edites)\b/i;
  const VISUAL_INTENT_RE = /\b(visual(?:mente)?|dise[ñn]o|interfaz|ui|ux|premium|bonit[oa]|modern[oa]|espaciado|tipograf[ií]a|layout|colores?|responsive|alineaci[oó]n|jerarqu[ií]a|est[eé]tica|maquetaci[oó]n|pulir|pulido|ordena(?:r)?\s+la\s+interfaz|hazlo\s+m[aá]s\s+premium|mejora(?:me)?\s+visualmente)\b/i;
  const INTERACTIVE_CONTROL_RE = /\b(icono|ícono|bot[oó]n|telefono|tel[eé]fono|phone|llamar|llamad|simul|presiona|presionar|clic|click|onclick|modal|popup)\b/i;
  const PROJECT_OPERATION_INTENT_RE = /\b(nuevo\s+archivo|crea(?:r)?\s+(?:un\s+)?archivo|agrega(?:r)?\s+(?:un\s+)?archivo|renombra|renombrar|borra(?:r)?\s+(?:el\s+)?archivo|elimina(?:r)?\s+(?:el\s+)?archivo|quita(?:r)?\s+(?:el\s+)?archivo)\b/i;
  const MEMORY_APPLY_INTENT_RE = /\b(apl[ií]calo|apl[ií]ca(?:\s+eso)?|integra(?:\s+eso|\s+esos\s+cambios)?|haz(?:\s+esos)?\s+cambios|ahora\s+s[ií]\s+apl[ií]calo|ponlo\s+en|ll[eé]valo\s+a|m[eé]telo\s+en)\b/i;
  const APPLY_CONFIRM_RE = /\b(bien\s+hazlo|ok(?:ay)?\s+hazlo|dale\s+hazlo|ahora\s+s[ií]|s[ií],?\s+hazlo|hazlo|adelante|dale|ok(?:ay)?|va|venga|perfecto)\b/i;
  const BUILD_FROM_SCRATCH_RE = /\b(crea|crear|genera|generar|construye|construir|arma|armar|dise[ñn]a|dise[ñn]ar|monta|montar|hazme|nuevo|nueva)\b/i;
  const WEB_BOOTSTRAP_RE = /\b(html|p[aá]gina|landing|sitio|website|web|portfolio|portafolio|formulario|dashboard|tienda|login|registro|navbar|spa|app\s+web)\b/i;
  const EXPLICIT_FULL_REWRITE_RE = /\b(desde\s+cero|cambia\s+todo|todo\s+el\s+archivo|todo\s+el\s+dise[ñn]o|archivo\s+completo|p[aá]gina\s+completa|layout\s+completo|ui\s+completa|interfaz\s+completa|redise[ñn]a(?:lo)?\s+todo|refactoriza(?:\s+todo|\s+completo|\s+el\s+proyecto)|reconstruye(?:\s+todo|\s+completo|\s+desde\s+cero)?|rehaz(?:lo)?(?:\s+todo|\s+completo|\s+desde\s+cero)?|reescribe(?:\s+todo|\s+completo|\s+desde\s+cero)?)\b/i;
  const AGENT_LOOP_RE = /\b(modo\s+agente|auto(?:m[aá]tico)?|contin[uú]a(?:\s+hasta\s+terminar)?|sigue(?:\s+hasta\s+terminar)?|encadena(?:\s+los)?\s+pasos|paso\s+a\s+paso)\b/i;
  const QUICK_VISUAL_ACTIONS = [
    {
      label: 'Modernizar UI',
      kind: 'visual',
      prompt: 'Trata esto como visual_edit. Moderniza la interfaz actual con cambios aplicables reales, prioriza CSS, mejora jerarquía visual, espaciado, colores y componentes, conserva el contenido y toca HTML solo si hace falta.'
    },
    {
      label: 'Hacer premium',
      kind: 'visual',
      prompt: 'Trata esto como visual_edit. Haz que esta UI se vea más premium con cambios aplicables reales, mejorando contraste, profundidad, tipografía y acabados sin romper la estructura existente.'
    },
    {
      label: 'Mejorar spacing',
      kind: 'visual',
      prompt: 'Trata esto como visual_edit. Mejora el spacing y la alineación con cambios aplicables reales, corrige paddings, márgenes, densidad visual y respiración entre bloques.'
    },
    {
      label: 'Mejorar tipografía',
      kind: 'visual',
      prompt: 'Trata esto como visual_edit. Mejora la tipografía de la interfaz con cambios aplicables reales, ajusta tamaños, pesos, jerarquía y legibilidad sin cambiar el contenido.'
    },
    {
      label: 'Responsive móvil',
      kind: 'visual',
      prompt: 'Trata esto como visual_edit. Optimiza la interfaz para móvil con cambios aplicables reales, prioriza CSS responsive, corrige overflow, stacking, tamaños y espaciado en phone.'
    },
    {
      label: 'Limpiar layout',
      kind: 'visual',
      prompt: 'Trata esto como visual_edit. Limpia el layout actual con cambios aplicables reales, ordena la estructura, mejora consistencia visual y deja el mínimo cambio necesario con máximo impacto.'
    }
  ];

  const extractExplicitTargetFiles = (text = '') => {
    const raw = String(text || '');
    const directMatches = raw.match(/\b[a-z0-9._-]+\.(?:html|css|js|json|py)\b/ig) || [];
    const knownMatches = (self.state?.filesList || [])
      .filter(file => file?.name && new RegExp(`\\b${escapeRegExp(file.name)}\\b`, 'i').test(raw))
      .map(file => file.name);
    return uniqStrings([...directMatches, ...knownMatches]).slice(0, 8);
  };

  const getKey  = () => cachedApiKey;
  const saveKey = async (k) => {
    cachedApiKey = String(k || '').trim();
    if (window.electron?.secureStore?.set) {
      const result = await window.electron.secureStore.set(IA_KEY, cachedApiKey);
      if (!result?.success) {
        throw new Error(result?.error || 'No se pudo guardar la API Key de forma segura.');
      }
    } else {
      localStorage.setItem(IA_KEY, cachedApiKey);
    }
    try { localStorage.removeItem(IA_KEY); } catch {}
    return cachedApiKey;
  };
  const clearKey = async () => {
    cachedApiKey = '';
    if (window.electron?.secureStore?.delete) {
      await window.electron.secureStore.delete(IA_KEY);
    }
    try { localStorage.removeItem(IA_KEY); } catch {}
  };
  const saveHist= () => localStorage.setItem(IA_HIST_KEY, JSON.stringify(history.slice(-40)));

  const getModeProfile = (mode = getMode()) => ({
    efficiency: {
      label: 'Eficiencia',
      subtitle: 'rapido y ligero',
      includeWorkspace: false,
      strict: false,
      maxHistory: 20
    },
    expert: {
      label: 'Experto',
      subtitle: 'lee el proyecto abierto',
      includeWorkspace: true,
      strict: false,
      maxHistory: 12
    },
    engineer: {
      label: 'Ingeniero',
      subtitle: 'directo, sin relleno',
      includeWorkspace: true,
      strict: true,
      maxHistory: 6
    },
    offline: {
      label: 'Sin API',
      subtitle: 'analisis local',
      includeWorkspace: true,
      strict: false,
      maxHistory: 0
    }
  }[mode] || {
    label: 'Eficiencia',
    subtitle: 'rapido y ligero',
    includeWorkspace: false,
    strict: false,
    maxHistory: 20
  });

  if (modeSel) {
    const storedMode = localStorage.getItem(IA_MODE_KEY);
    if (storedMode && [...modeSel.options].some(opt => opt.value === storedMode)) modeSel.value = storedMode;
    modeSel.addEventListener('change', () => {
      localStorage.setItem(IA_MODE_KEY, modeSel.value);
      updateCtxBar();
      iaToast(`Modo IA: ${getModeProfile().label}`);
      if (isOpen && modeSel.value === 'offline' && messages.querySelector('.ia-panel-setup')) {
        messages.innerHTML = '';
        container.querySelector('#iaSuggestions')?.remove();
        showWelcome();
      }
    });
  }

  const createAnthropicError = (result) => {
    const err = new Error(result?.error || 'No se pudo conectar con Claude.');
    const meta = getRetryableErrorMeta(result || {});
    err.status = meta.status || 0;
    err.code = meta.code || '';
    err.retryable = meta.retryable;
    err.retryAfterMs = meta.retryAfterMs || 0;
    err.errorType = result?.errorType || '';
    return err;
  };

  // Extrae el primer objeto JSON balanceado de un texto (tolera bloques ``` y prosa).
  const extractJsonObject = (raw) => {
    let s = String(raw || '').trim();
    if (!s) return null;
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) s = fence[1].trim();
    try { return JSON.parse(s); } catch {}
    const start = s.indexOf('{');
    if (start < 0) return null;
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < s.length; i++) {
      const ch = s[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
      } else if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) { try { return JSON.parse(s.slice(start, i + 1)); } catch { return null; } }
      }
    }
    return null;
  };

  // Cerebro de la IA de LTH Prog: ahora usa GLM-5.2 via el wallet compartido con LTH IA
  // (canal lthia:prog-agent). Ya NO requiere API key del usuario; el cobro por tokens
  // descuenta del mismo saldo. Exclusivo del plan Pro (gating en cliente + 403 en servidor).
  //
  // El panel fue construido sobre tool-use de Anthropic (respuestas con bloques tool_use).
  // GLM-5.2 (via OpenRouter/edge) responde TEXTO, asi que aqui hacemos de ADAPTADOR:
  // cuando se pide una herramienta, instruimos al modelo a devolver JSON del schema del tool,
  // parseamos ese JSON y sintetizamos un result.content tipo Anthropic. Asi todo el pipeline
  // de planner/editor/preview/apply sigue funcionando SIN cambios.
  const callAnthropicBridge = async (payload) => {
    if (!window.electron?.ai?.progAgent) {
      throw new Error('Bridge IA no disponible. Reinicia LTH.OS para cargar el nuevo motor.');
    }

    // Gating Pro en cliente (defensa en profundidad; el servidor tambien valida).
    const auth = window.LTHAuth;
    if (auth) {
      let state = auth.getStateSync();
      if (!state) { try { state = await auth.getState(); } catch {} }
      const fundingSource = sanitizeFundingSource(localStorage.getItem(IA_FUNDING_KEY) || restoreFundingSource(state));
      if (state && !state.signedIn) { const e = new Error('Inicia sesion en LTH.OS para usar la IA de LTH Prog.'); e.status = 401; throw e; }
      if (state && !hasPremiumAccessForSource(state, fundingSource)) {
        const e = new Error(fundingSource === 'gift'
          ? 'No tienes saldo premium regalado suficiente para usar la IA de LTH Prog.'
          : 'La IA de LTH Prog es exclusiva del plan Pro.');
        e.status = 403;
        throw e;
      }
    }

    // ¿Se pide una herramienta concreta? (toolChoice) o hay una sola tool disponible.
    const tools = Array.isArray(payload.tools) ? payload.tools : null;
    const forcedTool = tools
      ? (payload.toolChoice?.name
          ? tools.find(t => t?.name === payload.toolChoice.name)
          : (tools.length === 1 ? tools[0] : null))
      : null;

    let system = String(payload.system || '');
    if (forcedTool) {
      const schemaStr = JSON.stringify(forcedTool.input_schema || forcedTool.inputSchema || {}, null, 2);
      system += `\n\n[FORMATO DE SALIDA OBLIGATORIO]\n`
        + `Responde EXCLUSIVAMENTE con UN objeto JSON valido (sin texto antes ni despues, SIN bloques \`\`\`) `
        + `que cumpla EXACTAMENTE este JSON Schema de la herramienta "${forcedTool.name}":\n${schemaStr}\n`
        + `No incluyas explicaciones fuera del JSON.`;
      // Fase 2: herramientas de lectura. La excepcion va DESPUES del bloque de
      // formato para que el modelo la tome como alternativa valida al schema.
      if (payload.readToolsHint) system += `\n\n${payload.readToolsHint}`;
    }

    let result;
    try {
      result = await window.electron.ai.progAgent({
        fundingSource: await getFundingSource(),
        messages: payload.messages,
        system,
        maxTokens: payload.maxTokens,
        timeoutMs: payload.timeoutMs
      });
    } catch (err) {
      const msg = String(err?.message || err || '');
      if (/No handler registered|lthia:prog-agent/i.test(msg)) {
        throw new Error('Puente IA no cargado. Cierra y vuelve a abrir LTH.OS para activar el motor nuevo.');
      }
      throw err;
    }

    if (!result?.success) throw createAnthropicError(result);

    // Refresca el medidor de uso compartido tras consumir creditos del wallet.
    try { await window.LTHAuth?.getState?.({ force: true }); } catch {}
    renderUsageMeter();

    // Emula la forma Anthropic (content con tool_use) para que los callers no cambien.
    if (forcedTool) {
      const parsed = extractJsonObject(result.text || '');
      result.content = parsed
        ? [{ type: 'tool_use', name: forcedTool.name, input: parsed }]
        : [];
    }
    return result;
  };

  // ===== SKILLS DEL AGENTE (packs de instrucciones .md desde el repo lth-os-skills) =====
  // El agente detecta la tarea, descarga la(s) habilidad(es) relevante(s) y las inyecta en
  // el prompt. Si el repo no existe o falla la red, degrada en silencio (agente normal).
  const SKILLS_CACHE_TTL = 10 * 60 * 1000;
  let _skillsManifest = null;
  let _skillsManifestAt = 0;
  const _skillContentCache = new Map();

  const fetchSkillsManifest = async () => {
    if (_skillsManifest && (Date.now() - _skillsManifestAt) < SKILLS_CACHE_TTL) return _skillsManifest;
    try {
      const res = await window.electron?.ai?.fetchSkill?.({ path: 'skills.json' });
      if (res?.success && res.content) {
        const parsed = JSON.parse(res.content);
        const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.skills) ? parsed.skills : []);
        _skillsManifest = list.filter(s => s && s.id && s.path);
        _skillsManifestAt = Date.now();
        return _skillsManifest;
      }
    } catch (_) {}
    _skillsManifest = _skillsManifest || [];
    _skillsManifestAt = Date.now();
    return _skillsManifest;
  };

  const pickSkills = (text, manifest, max = 2) => {
    const t = String(text || '').toLowerCase();
    const scored = manifest.map((s) => {
      let score = 0;
      (Array.isArray(s.triggers) ? s.triggers : []).forEach((k) => {
        if (k && t.includes(String(k).toLowerCase())) score += 2;
      });
      String(s.description || '').toLowerCase().split(/\W+/).filter((w) => w.length > 4).forEach((w) => {
        if (t.includes(w)) score += 0.5;
      });
      return { skill: s, score };
    }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
    return scored.slice(0, max).map((x) => x.skill);
  };

  const loadSkillContent = async (skill) => {
    if (_skillContentCache.has(skill.id)) return _skillContentCache.get(skill.id);
    try {
      const res = await window.electron?.ai?.fetchSkill?.({ path: skill.path });
      if (res?.success && res.content) {
        const content = String(res.content).slice(0, 8000);
        _skillContentCache.set(skill.id, content);
        return content;
      }
    } catch (_) {}
    return '';
  };

  const buildSkillPriorityBlock = (picked = []) => {
    if (!Array.isArray(picked) || !picked.length) return '';
    return `\n\n[PRIORIDAD DE HABILIDADES]\nSi una habilidad activa define una regla más específica que tus heurísticas genéricas, la habilidad activa tiene prioridad. No la contradigas. Mantén coherencia con: ${picked.map((s) => s.name || s.id).join(', ')}.`;
  };

  const buildSkillContext = async (text) => {
    try {
      const manifest = await fetchSkillsManifest();
      if (!manifest.length) return { block: '', picked: [], ids: [], priorityBlock: '' };
      const picked = pickSkills(text, manifest);
      if (!picked.length) return { block: '', picked: [], ids: [], priorityBlock: '' };
      const parts = [];
      for (const sk of picked) {
        const content = await loadSkillContent(sk);
        if (content) parts.push(`### HABILIDAD: ${sk.name || sk.id}\n${content}`);
      }
      if (!parts.length) return { block: '', picked: [], ids: [], priorityBlock: '' };
      iaToast(`✦ Habilidad activa: ${picked.map((s) => s.name || s.id).join(', ')}`);
      return {
        block: `\n\n[HABILIDADES ACTIVAS]\nGuias especializadas para esta tarea. Aplicalas cuando sean relevantes:\n${parts.join('\n\n')}`,
        picked,
        ids: picked.map((skill) => String(skill.id || '').trim()).filter(Boolean),
        priorityBlock: buildSkillPriorityBlock(picked)
      };
    } catch (_) {
      return { block: '', picked: [], ids: [], priorityBlock: '' };
    }
  };

  // Compat: conserva el helper viejo cuando solo se necesita el bloque.
  const buildSkillBlock = async (text) => (await buildSkillContext(text)).block;

  const getVisibleActiveFileId = () =>
    container.querySelector('.file-tab.active')?.dataset?.fileId || self.state?.activeFileId || null;

  const getVisibleActiveFileName = () => {
    const tabName = container.querySelector('.file-tab.active .file-tab-name')?.textContent?.trim();
    const currentName = container.querySelector('#currentFileName')?.textContent?.trim();
    return (tabName && tabName !== 'Sin archivo')
      ? tabName
      : ((currentName && currentName !== 'Sin archivo') ? currentName : '');
  };

  const getActiveFileRecord = () => {
    const files = self.state?.filesList || [];
    const visibleId = getVisibleActiveFileId();
    const visibleName = getVisibleActiveFileName().toLowerCase();
    return files.find(file => file.id === visibleId)
      || files.find(file => String(file.name || '').toLowerCase() === visibleName)
      || files.find(file => file.id === self.state?.activeFileId)
      || null;
  };

  const getCtx = () => {
    const ed = self.editor;
    const code = ed?.getValue?.() || '';
    const selection = ed?.getSelection?.() || '';
    const f = getActiveFileRecord();
    const filename = f?.name || getVisibleActiveFileName() || 'archivo-activo.html';
    const ext  = filename.split('.').pop()?.toLowerCase() || 'html';
    const type = ext === 'css'
      ? 'CSS'
      : ['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx'].includes(ext)
        ? 'JavaScript'
        : ext === 'py'
          ? 'Python'
          : ['json', 'yml', 'yaml'].includes(ext)
            ? 'JSON'
            : ['md', 'markdown'].includes(ext)
              ? 'Markdown'
              : (ext === 'html' || ext === 'htm') ? 'HTML' : 'Text';
    const lines = code.split('\n').length;
    return { code, selection, filename, type, lines, editor: ed, file: f };
  };

  const getWorkspaceFiles = (ctx = getCtx()) => {
    const activeId = getVisibleActiveFileId();
    const files = self.state?.filesList || [];
    const mapped = files.map((file) => {
      const isActive = file.id === activeId || file.id === ctx.file?.id || file.name === ctx.filename;
      return {
        id: file.id,
        name: file.workspaceRelativePath || file.relativePath || file.name || 'archivo',
        displayName: file.name || getDisplayFileName(file),
        type: file.type || 'txt',
        path: file.path || '',
        relativePath: file.workspaceRelativePath || file.relativePath || '',
        content: isActive ? ctx.code : (file.content || '')
      };
    }).filter(file => file.content || file.name);

    if (!mapped.length && ctx.code) {
      mapped.push({
        id: '__active__',
        name: ctx.filename || 'archivo-activo.html',
        type: String(ctx.type || 'html').toLowerCase(),
        path: '',
        content: ctx.code
      });
    }

    return mapped;
  };

  const normalizePlannerIntent = (value, fallback = 'chat') => (
    ['chat', 'project_edit', 'visual_edit', 'fix_edit'].includes(String(value || '').trim())
      ? String(value || '').trim()
      : fallback
  );

  const resolveWorkspaceFileMatch = (ref, files = getWorkspaceFiles()) => {
    const wanted = normalizeLooseFileRef(ref);
    if (!wanted) return null;
    const basename = wanted.split('\\').pop();
    return files.find((file) => {
      const id = normalizeLooseFileRef(file?.id);
      const name = normalizeLooseFileRef(file?.name);
      const displayName = normalizeLooseFileRef(file?.displayName);
      const relativePath = normalizeLooseFileRef(file?.relativePath);
      const path = normalizeLooseFileRef(file?.path);
      return wanted === id
        || wanted === name
        || wanted === displayName
        || wanted === relativePath
        || wanted === path
        || basename === name
        || basename === displayName
        || (path && path.endsWith(`\\${basename}`));
    }) || null;
  };

  const normalizeMemorySearchText = (value = '') => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._/-]+/g, ' ')
    .trim();

  /* ─────────────────────────────────────────
     Targeting semantico por memoria (Fase 1).
     El matching lexical (termino incluido en la linea) sigue siendo la base;
     encima se suma coseno de embeddings REALES (MiniLM multilingue 384d) que
     corren en main via window.electron.ai.embedTexts — el mismo motor local
     que usa el GraphBrain de LTH IA, mismo modelo ya cacheado en userData.
     Asi "el jet debe ser mas agil" encuentra la linea de File Roles que dice
     "juego.html: nave/avion/velocidad" aunque no compartan ni una palabra.
     Los vectores viven SOLO en RAM (nunca en el .md ni en localStorage).
     Sin motor (offline, modelo cargando, tests): comportamiento identico al
     lexical de antes. La memoria orienta pero NO decide sola: un candidato
     puramente semantico necesita señal fuerte (>=0.45 re-escalado).
  ───────────────────────────────────────── */
  const _folderMemSem = { lines: new Map(), queries: new Map(), failedAt: 0 };

  const _memSemLineKey = (line = '') => {
    let hash = 2166136261;
    const value = String(line || '');
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `${value.length}:${hash >>> 0}`;
  };

  const _memSemCosine = (a = [], b = []) => {
    const len = Math.min(a.length, b.length);
    if (!len) return 0;
    let dot = 0; let ma = 0; let mb = 0;
    for (let i = 0; i < len; i += 1) {
      dot += Number(a[i] || 0) * Number(b[i] || 0);
      ma += Number(a[i] || 0) ** 2;
      mb += Number(b[i] || 0) ** 2;
    }
    return ma && mb ? dot / (Math.sqrt(ma) * Math.sqrt(mb)) : 0;
  };

  // Re-escala calibrada del coseno MiniLM (igual que en LTH IA): no relacionado
  // da 0.04-0.16 => ~0; relacionado fuerte 0.6+ => ~0.75-1.
  const _memSemScore = (queryVector, lineVector) => {
    if (!Array.isArray(queryVector) || !Array.isArray(lineVector)) return 0;
    return Math.max(0, Math.min(1, (_memSemCosine(queryVector, lineVector) - 0.15) / 0.6));
  };

  // Parser compartido de la memoria canonica: lineas de secciones de targeting
  // que referencian un archivo. Lo usan tanto la busqueda como el backfill.
  const collectFolderMemoryTargetLines = () => {
    const memory = String(self.state?.folderMemoryContext || '');
    if (!memory.trim()) return [];
    const section = (name) => {
      const match = memory.match(new RegExp(`## ${escapeRegExp(name)}\\n([\\s\\S]*?)(?=\\n## |$)`, 'i'));
      return match ? match[1] : '';
    };
    const searchable = [
      section('File Roles'),
      section('Folder Map'),
      section('Canonical Fixes'),
      section('Known Issues'),
      section('Change Log')
    ].join('\n');
    const entries = [];
    searchable.split(/\r?\n/).forEach((line) => {
      const fileMatch = line.match(/(?:^|[\s\[])([a-z0-9._/-]+\.(?:html?|css|js|mjs|cjs|jsx|ts|tsx|json|py|md|txt|svg|php))/i);
      if (!fileMatch) return;
      const clean = String(line).replace(/\s+/g, ' ').trim();
      if (!clean) return;
      // Texto para EMBEBER: sin filename, guiones ni slashes. Medido con el
      // modelo real: "zapatos" vs "- prueba.html: tienda/calzado" da 0.08,
      // pero vs "tienda calzado" da 0.82. El lexical sigue usando la linea cruda.
      const embedText = clean
        .replace(/(?:^|[\s\[])[a-z0-9._/-]+\.(?:html?|css|js|mjs|cjs|jsx|ts|tsx|json|py|md|txt|svg|php)/gi, ' ')
        .replace(/[\/_-]+/g, ' ')
        .replace(/[^\p{L}\p{N} ]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      entries.push({ fileRef: fileMatch[1], line: clean, embedText, key: _memSemLineKey(embedText || clean) });
    });
    return entries;
  };

  /* Se llama al inicio del turno IA (despues de cargar la memoria .md): pide el
     vector de la consulta con tope de 900 ms y rellena en background los vectores
     de lineas nuevas/cambiadas de la memoria. Las lineas del .md cambian poco,
     asi que despues del primer turno esto es casi siempre cache hit (~0 ms).
     Fallo silencioso => extractFolderMemoryTargetCandidates queda lexical puro. */
  const warmFolderMemorySemanticTargeting = async (queryText = '') => {
    try {
      if (!window?.electron?.ai?.embedTexts) return;
      if (_folderMemSem.failedAt && (Date.now() - _folderMemSem.failedAt) < 5 * 60 * 1000) return;
      const qKey = normalizeMemorySearchText(queryText).slice(0, 300);
      const pendingLines = collectFolderMemoryTargetLines()
        .filter(entry => entry.embedText && !_folderMemSem.lines.has(entry.key))
        .slice(0, 28);
      const wantQuery = !!qKey && !_folderMemSem.queries.has(qKey);
      if (!wantQuery && !pendingLines.length) return;
      const texts = [];
      if (wantQuery) texts.push(String(queryText || '').replace(/\s+/g, ' ').trim().slice(0, 600));
      pendingLines.forEach(entry => texts.push(entry.embedText.slice(0, 400)));
      const request = window.electron.ai.embedTexts({ texts }).then((res) => {
        if (!res?.ok || !Array.isArray(res.vectors)) {
          if (res?.unavailable) _folderMemSem.failedAt = Date.now();
          return;
        }
        _folderMemSem.failedAt = 0;
        let index = 0;
        if (wantQuery) {
          const vector = res.vectors[index++];
          if (Array.isArray(vector) && vector.length) {
            _folderMemSem.queries.set(qKey, vector);
            if (_folderMemSem.queries.size > 24) {
              _folderMemSem.queries.delete(_folderMemSem.queries.keys().next().value);
            }
          }
        }
        pendingLines.forEach((entry) => {
          const vector = res.vectors[index++];
          if (Array.isArray(vector) && vector.length) _folderMemSem.lines.set(entry.key, vector);
        });
        while (_folderMemSem.lines.size > 400) {
          _folderMemSem.lines.delete(_folderMemSem.lines.keys().next().value);
        }
      }).catch(() => { _folderMemSem.failedAt = Date.now(); });
      // Tope de espera: si el modelo aun carga, el turno sigue (lexical) y los
      // vectores quedan guardados igual cuando la promesa resuelva mas tarde.
      await Promise.race([request, new Promise(resolve => setTimeout(resolve, 900))]);
    } catch {}
  };

  const extractFolderMemoryTargetCandidates = (query = '', files = getWorkspaceFiles()) => {
    const q = normalizeMemorySearchText(query);
    if (!q) return [];
    const entries = collectFolderMemoryTargetLines();
    if (!entries.length) return [];
    const qTerms = q.split(/\s+/).filter(term => term.length >= 3 && !/^(que|con|para|pero|esta|este|mas|más|muy|una|uno|los|las|del|por|como|haz|hacer|quiero|necesito)$/.test(term));
    const queryVector = _folderMemSem.queries.get(q.slice(0, 300)) || null;
    if (!qTerms.length && !queryVector) return [];
    const scores = new Map();
    entries.forEach((entry) => {
      const normalizedLine = normalizeMemorySearchText(entry.line);
      const termScore = qTerms.reduce((total, term) => total + (normalizedLine.includes(term) ? 1 : 0), 0);
      let semScore = 0;
      if (queryVector) {
        semScore = _memSemScore(queryVector, _folderMemSem.lines.get(entry.key) || null);
      }
      // Con hit lexical, lo semantico solo re-ordena (umbral suave 0.3).
      // SIN hit lexical exige señal fuerte (0.45) para no editar por corazonada.
      const semBoost = semScore >= (termScore > 0 ? 0.3 : 0.45) ? semScore * 2 : 0;
      const score = termScore + semBoost;
      if (score <= 0) return;
      scores.set(entry.fileRef, (scores.get(entry.fileRef) || 0) + score);
    });
    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([ref]) => resolveWorkspaceFileMatch(ref, files)?.name || ref)
      .filter(Boolean)
      .slice(0, 5);
  };

  const getRelevantWorkspaceFiles = (ctx = getCtx(), options = {}) => {
    const files = getWorkspaceFiles(ctx);
    const seen = new Set();
    const ordered = [];
    const add = (file) => {
      if (!file?.name) return;
      const key = file.id || file.name;
      if (seen.has(key)) return;
      seen.add(key);
      ordered.push(file);
    };
    const intent = normalizePlannerIntent(options.intent, 'project_edit');
    const active = files.find(file =>
      file.id === ctx.file?.id ||
      normalizeLooseFileRef(file.name) === normalizeLooseFileRef(ctx.filename)
    ) || files[0] || null;
    const activeBase = String(active?.name || ctx.filename || '')
      .replace(/\.(html?|css|js|json|py)$/i, '')
      .toLowerCase();
    const htmlFiles = files.filter(file => file.type === 'html');
    const cssFiles = files.filter(file => file.type === 'css');
    const jsFiles = files.filter(file => file.type === 'js');
    const relatedHtml = htmlFiles.find(file =>
      String(file.name || '').replace(/\.html?$/i, '').toLowerCase() === activeBase
    ) || htmlFiles[0] || null;
    const relatedCss = cssFiles.find(file =>
      String(file.name || '').replace(/\.css$/i, '').toLowerCase() === activeBase
    ) || cssFiles[0] || null;
    const relatedJs = jsFiles.find(file =>
      String(file.name || '').replace(/\.js$/i, '').toLowerCase() === activeBase
    ) || jsFiles[0] || null;

    const memoryTargets = extractFolderMemoryTargetCandidates(options.query || options.userText || '', files);
    (options.targetFiles || []).forEach(ref => add(resolveWorkspaceFileMatch(ref, files)));
    memoryTargets.forEach(ref => add(resolveWorkspaceFileMatch(ref, files)));
    if (!ordered.length) add(active);

    if (intent === 'visual_edit') {
      add(relatedCss);
      cssFiles.slice(0, 3).forEach(add);
      add(relatedHtml);
      htmlFiles.slice(0, 2).forEach(add);
      add(relatedJs);
      jsFiles.slice(0, 1).forEach(add);
    } else {
      add(relatedHtml);
      add(relatedCss);
      add(relatedJs);
    }

    files.forEach(add);
    return ordered.slice(0, options.maxFiles || (intent === 'visual_edit' ? 12 : 10));
  };

  const clipForAI = (text, maxChars) => {
    const raw = String(text || '');
    if (raw.length <= maxChars) return raw;
    const head = Math.floor(maxChars * 0.58);
    const tail = maxChars - head;
    return `${raw.slice(0, head)}\n\n/* ... contenido recortado por eficiencia ... */\n\n${raw.slice(-tail)}`;
  };

  const summarizePreviewElement = (el) => {
    const tag = el?.tagName?.toLowerCase?.() || 'div';
    const id = el?.id ? `#${el.id}` : '';
    const cls = String(el?.className || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(name => `.${name}`)
      .join('');
    const text = shortText(String(el?.textContent || '').replace(/\s+/g, ' '), 56);
    return `${tag}${id}${cls}${text ? ` :: ${text}` : ''}`;
  };

  const getPreviewSnapshot = () => {
    const liveFrame = container.querySelector('#liveFrame');
    const emptyState = container.querySelector('#previewEmptyState');
    const snapshot = {
      device: self.state?.device || 'pc',
      split: !!self.state?.split,
      live: !!self.state?.live,
      source: liveFrame?.src ? 'url' : (liveFrame?.srcdoc ? 'srcdoc' : 'empty'),
      iframeSize: liveFrame ? `${Math.round(liveFrame.clientWidth || 0)}x${Math.round(liveFrame.clientHeight || 0)}` : '0x0',
      previewVisible: !!(liveFrame && emptyState?.classList.contains('hidden')),
      ready: false,
      url: liveFrame?.src ? String(liveFrame.src).replace(/\?.*$/, '') : ''
    };

    if (!liveFrame) {
      self.state.lastPreviewSnapshot = snapshot;
      return snapshot;
    }

    try {
      const doc = liveFrame.contentDocument || liveFrame.contentWindow?.document;
      if (!doc?.body) {
        self.state.lastPreviewSnapshot = snapshot;
        return snapshot;
      }

      const count = (selector) => {
        try { return doc.querySelectorAll(selector).length; } catch { return 0; }
      };
      const view = doc.defaultView || window;
      const bodyStyle = view?.getComputedStyle ? view.getComputedStyle(doc.body) : null;

      snapshot.ready = true;
      snapshot.title = doc.title || '';
      snapshot.body = summarizePreviewElement(doc.body);
      snapshot.counts = {
        sections: count('section'),
        cards: count('[class*="card"],[class*="panel"],[class*="hero"]'),
        headings: count('h1,h2,h3,h4'),
        buttons: count('button'),
        links: count('a'),
        inputs: count('input,textarea,select')
      };
      snapshot.structure = Array.from(doc.body.children || []).slice(0, 8).map(summarizePreviewElement);
      snapshot.textHints = Array.from(doc.querySelectorAll('h1,h2,h3,p,button,a,label'))
        .map(node => shortText(String(node.textContent || '').replace(/\s+/g, ' '), 72))
        .filter(Boolean)
        .slice(0, 8);
      if (bodyStyle) {
        snapshot.styles = {
          background: bodyStyle.backgroundColor || '',
          color: bodyStyle.color || '',
          font: shortText(bodyStyle.fontFamily || '', 90)
        };
      }
    } catch (err) {
      snapshot.error = String(err?.message || err || 'preview inaccesible');
    }

    self.state.lastPreviewSnapshot = snapshot;
    return snapshot;
  };

  const buildRuntimeContextSummary = (ctx, options = {}) => {
    const preview = getPreviewSnapshot();
    const relevantFiles = getRelevantWorkspaceFiles(ctx, options);
    const htmlKey = relevantFiles.filter(file => file.type === 'html').slice(0, 2).map(file => file.name).join(', ') || 'ninguno';
    const cssKey = relevantFiles.filter(file => file.type === 'css').slice(0, 3).map(file => file.name).join(', ') || 'ninguno';
    const jsKey = relevantFiles.filter(file => file.type === 'js').slice(0, 2).map(file => file.name).join(', ') || 'ninguno';
    const selectionInfo = ctx.selection
      ? `${ctx.selection.split('\n').length} línea(s) seleccionadas`
      : 'sin selección activa';
    const countsLine = preview.ready
      ? Object.entries(preview.counts || {})
        .filter(([, amount]) => Number(amount) > 0)
        .map(([key, amount]) => `${key}:${amount}`)
        .join(', ') || 'sin conteos relevantes'
      : 'preview no disponible';
    const structureLine = preview.ready
      ? (preview.structure || []).join(' | ') || 'sin estructura visible'
      : (preview.error ? `preview inaccesible: ${preview.error}` : 'preview no listo');
    const textLine = preview.ready
      ? ((preview.textHints || []).join(' | ') || 'sin textos visibles relevantes')
      : 'sin lectura de preview';

    return `--- Estado actual de LTH PROG ---
Archivo activo: ${ctx.filename} (${ctx.type}, ${ctx.lines} líneas)
Selección: ${selectionInfo}
Dispositivo: ${self.state?.device || 'pc'} · Split: ${self.state?.split ? 'on' : 'off'} · Live: ${self.state?.live ? 'on' : 'off'}
Workspace abierto: ${(self.state?.filesList || []).length} archivo(s)
Archivos relevantes: ${relevantFiles.map(file => `${file.name}${file.id === ctx.file?.id ? ' [activo]' : ''}`).join(', ') || ctx.filename}
HTML clave: ${htmlKey}
CSS clave: ${cssKey}
JS clave: ${jsKey}
Preview: ${preview.ready ? `listo (${preview.source}, ${preview.iframeSize})` : `no accesible (${preview.source})`}
Preview documento: ${preview.title || 'sin título'}${preview.body ? ` · ${preview.body}` : ''}
Preview conteos: ${countsLine}
Preview estructura visible: ${structureLine}
Preview textos: ${textLine}
${preview.styles ? `Preview estilo base: bg ${preview.styles.background} · color ${preview.styles.color} · font ${preview.styles.font}` : ''}`;
  };

  const detectIntentMeta = (text, ctx = getCtx(), profile = getModeProfile()) => {
    const raw = String(text || '').trim();
    const explicitTargets = extractExplicitTargetFiles(raw);
    const readOnly = READ_ONLY_INTENT_RE.test(raw);
    const wantsFix = !readOnly && FIX_INTENT_RE.test(raw) && !!ctx.code;
    const wantsVisual = !readOnly && VISUAL_INTENT_RE.test(raw);
    const wantsInteractiveControl = !readOnly && INTERACTIVE_CONTROL_RE.test(raw);
    const wantsProjectOperation = !readOnly && PROJECT_OPERATION_INTENT_RE.test(raw);
    const wantsEdit = !readOnly && isEditIntent(raw);
    const shortPrompt = raw.split(/\s+/).filter(Boolean).length <= 10;
    const wantsMemoryApply = !readOnly
      && !!self.state?.lastExecutableEdits
      && (MEMORY_APPLY_INTENT_RE.test(raw) || (shortPrompt && APPLY_CONFIRM_RE.test(raw)))
      && (shortPrompt || explicitTargets.length > 0);

    const hasProject = ctx.code.length > 0 || (self.state?.filesList || []).length > 0;
    let intent = 'chat';
    if (wantsMemoryApply) {
      intent = normalizePlannerIntent(self.state?.lastPlan?.intent, 'project_edit');
    } else if (wantsFix) {
      intent = 'fix_edit';
    } else if (wantsVisual) {
      intent = 'visual_edit';
    } else if (wantsEdit || wantsProjectOperation) {
      intent = 'project_edit';
    } else if (!readOnly && raw.split(/\s+/).filter(Boolean).length >= 2) {
      // SESGO DE AGENTE: todo lo que NO sea una pregunta (read-only) se trata como
      // construir/editar y se INYECTA al editor, en vez de quedarse en el chat. Esto
      // aplica AUNQUE el proyecto este vacio (se crean los archivos desde cero).
      intent = 'project_edit';
    }

    const useProjectTool = intent !== 'chat'
      && ((self.state?.filesList || []).length > 0)
      && (profile.includeWorkspace || intent === 'visual_edit' || wantsProjectOperation || wantsMemoryApply || explicitTargets.length > 0);

    return {
      intent,
      explicitTargets,
      readOnly,
      wantsFix,
      wantsVisual,
      wantsInteractiveControl,
      wantsEdit,
      wantsProjectOperation,
      wantsMemoryApply,
      useProjectTool
    };
  };

  const renderQuickActions = () => {
    if (!quickActionsEl) return;
    quickActionsEl.innerHTML = '';
    QUICK_VISUAL_ACTIONS.forEach((action) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `ia-quick-btn${action.kind === 'visual' ? ' visual' : ''}`;
      btn.textContent = action.label;
      btn.addEventListener('click', () => send(action.prompt));
      quickActionsEl.appendChild(btn);
    });
    quickActionsEl.classList.toggle('hidden', QUICK_VISUAL_ACTIONS.length === 0);
  };

  fundingPlanBtn?.addEventListener('click', () => {
    try { localStorage.setItem(IA_FUNDING_KEY, 'plan'); } catch {}
    renderUsageMeter();
  });
  fundingGiftBtn?.addEventListener('click', async () => {
    let state = window.LTHAuth?.getStateSync?.();
    if (!state) {
      try { state = await window.LTHAuth?.getState?.(); } catch {}
    }
    if (!hasGiftPremiumAccess(state)) {
      iaToast('No tienes saldo premium regalado disponible.', true);
      renderFundingSourceSwitch(state);
      return;
    }
    try { localStorage.setItem(IA_FUNDING_KEY, 'gift'); } catch {}
    renderUsageMeter();
  });

  // ── Mapa de secciones del archivo activo (local, 0 tokens) ──
  // Para archivos grandes, en vez de mandar TODO el archivo en cada edit, ubicamos la
  // seccion relevante y mandamos solo ese pedazo + un indice de estructura. Si el modelo
  // no encuentra el objetivo en el pedazo, el retry/repair manda el archivo completo.
  const FOCUS_MIN_LINES = 160;
  const FOCUS_PAD = 24;
  const FOCUS_STOPWORDS = new Set(['el','la','los','las','un','una','de','del','que','con','por','para','como','cambia','cambiale','cambies','cambiar','cambialo','pon','ponle','quita','quiero','necesito','hacer','haz','pagina','página','app','archivo','nombre','texto','ahora','esto','eso','este','esta','sea','sera','mejora','agrega','añade']);

  const buildSectionIndex = (code = '', type = '') => {
    const lines = String(code || '').split('\n');
    const kind = String(type || '').toLowerCase();
    const isHtml = kind.includes('html');
    const isCss = kind.includes('css');
    const isJs = kind.includes('javascript') || kind.includes('typescript') || /\bjs\b|\bts\b/.test(kind);
    const boundaries = [];
    const pushB = (i, label) => {
      const clean = String(label || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 70);
      if (clean) boundaries.push({ line: i, label: clean });
    };
    lines.forEach((raw, i) => {
      const line = raw.trim();
      if (!line) return;
      let m;
      if (isHtml) {
        if ((m = line.match(/<!--\s*(.+?)\s*-->/))) return pushB(i, m[1]);
        if ((m = line.match(/<(section|header|footer|nav|main|aside|form|article)\b[^>]*\bid=["']([^"']+)["']/i))) return pushB(i, `<${m[1]} #${m[2]}>`);
        if ((m = line.match(/<(section|header|footer|nav|main|aside|form|article)\b[^>]*\bclass=["']([^"']+)["']/i))) return pushB(i, `<${m[1]} .${m[2].split(/\s+/)[0]}>`);
        if ((m = line.match(/<(section|header|footer|nav|main|aside|article)\b/i))) return pushB(i, `<${m[1]}>`);
        if ((m = line.match(/<h([1-3])\b[^>]*>(.+?)<\/h\1>/i))) return pushB(i, `h${m[1]}: ${m[2]}`);
        if ((m = line.match(/<(style|script)\b/i))) return pushB(i, `<${m[1]}>`);
        if (line.length < 120 && (m = line.match(/\bid=["']([^"']+)["']/i))) return pushB(i, `#${m[1]}`);
        return;
      }
      if (isCss) {
        if ((m = line.match(/\/\*\s*(.+?)\s*\*\//))) return pushB(i, m[1]);
        if (/\{\s*$/.test(line) && (m = line.match(/^([.#]?[\w-][\w\s.,:#>\-\[\]="']*?)\s*\{/))) return pushB(i, m[1].trim());
        return;
      }
      if (isJs) {
        if ((m = line.match(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([\w$]+)/))) return pushB(i, `function ${m[1]}`);
        if ((m = line.match(/^(?:export\s+)?(?:default\s+)?class\s+([\w$]+)/))) return pushB(i, `class ${m[1]}`);
        if ((m = line.match(/^(?:export\s+)?(?:const|let|var)\s+([\w$]+)\s*=/))) return pushB(i, m[1]);
        if ((m = line.match(/\/\/\s*[=─-]{2,}\s*(.+)/))) return pushB(i, m[1]);
        return;
      }
      if ((m = raw.match(/^#{1,3}\s+(.+)/))) return pushB(i, m[1]);
    });
    if (boundaries.length < 2 && lines.length > 80) {
      for (let i = 0; i < lines.length; i += 50) pushB(i, `bloque ${Math.floor(i / 50) + 1}`);
    }
    boundaries.sort((a, b) => a.line - b.line);
    const sections = [];
    for (let k = 0; k < boundaries.length; k++) {
      const from = boundaries[k].line;
      const to = (k + 1 < boundaries.length ? boundaries[k + 1].line - 1 : lines.length - 1);
      if (to < from) continue;
      sections.push({ index: sections.length + 1, label: boundaries[k].label, from: from + 1, to: to + 1 });
    }
    return sections;
  };

  const buildStructureOutline = (sections = []) =>
    sections.length ? sections.map(s => `#${s.index} ${s.label} (líneas ${s.from}-${s.to})`).join('\n') : '';

  const extractFocusTargets = (text = '') => {
    const targets = [];
    const quoted = String(text).match(/["'“”«»]([^"'“”«»]{2,40})["'“”«»]/g);
    if (quoted) quoted.forEach(s => targets.push(s.replace(/["'“”«»]/g, '').trim()));
    String(text).toLowerCase().split(/[^0-9a-záéíóúñü]+/i).forEach(w => {
      if (w.length >= 4 && !FOCUS_STOPWORDS.has(w)) targets.push(w);
    });
    return Array.from(new Set(targets.filter(Boolean)));
  };

  // Devuelve {from, to, sections, outline} para mandar solo ese pedazo, o null para mandar todo.
  const computeActiveFocus = (text, ctx, opts = {}) => {
    try {
      const code = ctx.code || '';
      const lines = code.split('\n');
      if (lines.length < FOCUS_MIN_LINES) return null;
      if (opts.allowFullReplace || opts.isProjectOp) return null;
      const sections = buildSectionIndex(code, ctx.type);
      if (sections.length < 2) return null;
      const targets = extractFocusTargets(text);
      if (!targets.length) return null;
      const lower = lines.map(l => l.toLowerCase());
      const hitLines = [];
      targets.forEach(t => {
        const tl = t.toLowerCase();
        for (let i = 0; i < lower.length; i++) if (lower[i].includes(tl)) hitLines.push(i + 1);
      });
      let from;
      let to;
      if (hitLines.length) {
        const minH = Math.min(...hitLines);
        const maxH = Math.max(...hitLines);
        if (maxH - minH <= 160) {
          from = Math.max(1, minH - FOCUS_PAD);
          to = Math.min(lines.length, maxH + FOCUS_PAD);
        } else {
          const covering = sections.filter(s => hitLines.some(h => h >= s.from && h <= s.to));
          if (!covering.length) return null;
          from = Math.min(...covering.map(s => s.from));
          to = Math.max(...covering.map(s => s.to));
        }
      } else {
        let best = null;
        let bestScore = 0;
        sections.forEach(s => {
          const body = lower.slice(s.from - 1, s.to).join(' ');
          let score = 0;
          targets.forEach(t => { if (body.includes(t.toLowerCase())) score += 1; });
          if (score > bestScore) { bestScore = score; best = s; }
        });
        if (!best || bestScore === 0) return null;
        from = best.from;
        to = best.to;
      }
      // Si el pedazo ya es casi todo el archivo, no vale la pena focalizar.
      if (to - from + 1 >= lines.length * 0.7) return null;
      return { from, to, sections, outline: buildStructureOutline(sections) };
    } catch (_) {
      return null;
    }
  };

  const buildWorkspaceContext = (ctx, profile, options = {}) => {
    const forceWorkspace = !!options.forceWorkspace;
    const includeWorkspace = profile.includeWorkspace || forceWorkspace;
    const intent = normalizePlannerIntent(options.intent, 'project_edit');
    const runtimeSummary = buildRuntimeContextSummary(ctx, options);
    if (!includeWorkspace) return `\n\n${runtimeSummary}`;

    const files = getRelevantWorkspaceFiles(ctx, options);
    if (!files.length) return `\n\n${runtimeSummary}`;

    const targetSet = new Set((options.targetFiles || []).map(normalizeLooseFileRef));
    const activeLimit = intent === 'visual_edit' ? 22000 : (profile.strict ? 28000 : 45000);
    const sideFileLimit = intent === 'visual_edit' ? 11000 : (profile.strict ? 8000 : 12000);
    const maxFiles = intent === 'visual_edit' ? 12 : (profile.strict ? 14 : 24);
    const blocks = files.slice(0, maxFiles).map((file, index) => {
      const isActive = file.id === self.state?.activeFileId || normalizeLooseFileRef(file.name) === normalizeLooseFileRef(ctx.filename);
      const isTarget = targetSet.has(normalizeLooseFileRef(file.name))
        || targetSet.has(normalizeLooseFileRef(file.relativePath))
        || targetSet.has(normalizeLooseFileRef(file.id))
        || targetSet.has(normalizeLooseFileRef(file.path));
      const activeMark = isActive ? ' (activo)' : isTarget ? ' (objetivo)' : '';
      const pathLine = file.path ? `\nRuta: ${file.path}` : '';
      const relativeLine = file.relativePath ? `\nRuta relativa: ${file.relativePath}` : '';
      // Edicion focalizada: para el archivo activo grande mandamos SOLO la seccion relevante
      // (con numeros de linea reales) + el indice de secciones, en vez del archivo completo.
      if (options.focus && isActive) {
        const allLines = String(file.content || '').split('\n');
        const from = Math.max(1, options.focus.from);
        const to = Math.min(allLines.length, options.focus.to);
        const sliceNumbered = allLines.slice(from - 1, to).map((line, k) => `${from + k}| ${line}`).join('\n');
        const outline = options.focus.outline ? `Índice de secciones (archivo de ${allLines.length} líneas):\n${options.focus.outline}\n\n` : '';
        return `### ${index + 1}. ${file.name}${activeMark}${relativeLine}${pathLine}\nTipo: ${file.type}\n${outline}Se muestra SOLO la sección relevante, líneas ${from}-${to} (el resto del archivo existe). Edita por search exacto o start_line/end_line REALES; NO incluyas el "N|". Si tu objetivo no está en este rango, dilo y se te dará otra sección.\n\`\`\`${file.type}\n${sliceNumbered}\n\`\`\``;
      }
      const contentLimit = isActive ? activeLimit : (isTarget ? Math.max(sideFileLimit, 14000) : sideFileLimit);
      const content = clipForAI(file.content, contentLimit);
      const numbered = content.split('\n').map((line, lineIndex) => `${lineIndex + 1}| ${line}`).join('\n');
      return `### ${index + 1}. ${file.name}${activeMark}${relativeLine}${pathLine}\nTipo: ${file.type}\nLineas mostradas con numero para ubicacion. En search NO incluyas el numero ni el separador.\n\`\`\`${file.type}\n${numbered}\n\`\`\``;
    });

    const omitted = files.length > maxFiles ? `\n\nArchivos omitidos por seguridad de contexto: ${files.length - maxFiles}.` : '';
    const folderMap = self.state?.workspaceMode === 'folder' && self.state?.folderTree
      ? buildFolderTreeSummaryBlock()
      : '';
    return `\n\n${runtimeSummary}${folderMap}\n\n--- Proyecto abierto en LTH PROG ---\nModo: ${profile.label}\nIntención: ${intent}\nArchivos visibles: ${(self.state?.filesList || []).length}\n${blocks.join('\n\n')}${omitted}`;
  };

  const runOfflineAssistant = (txt, ctx) => {
    const files = getWorkspaceFiles(ctx);
    const code = ctx.code || '';
    const lines = code ? code.split('\n') : [];
    const names = files.map(file => file.name).join(', ') || ctx.filename;
    const wantsEdit = isEditIntent(txt);
    const wantsFix = /\b(corr[ií]g|soluciona|repara|arregla|fix|debug|revisa|errores|bugs?|problemas|falla|no\s?funciona|audita|optimiza|limpia|mejora)\b/i.test(txt);
    const notes = [];

    if (!code && !files.length) {
      return 'Modo Sin API activo. Abre un archivo o carpeta para que pueda revisar contexto local sin enviar datos a Anthropic.';
    }

    if (wantsFix) {
      if (/\bconsole\.log\b/.test(code)) notes.push('Detecte `console.log`; revisa si debe quedarse en produccion.');
      if (/<script\b/i.test(code) && !/<\/script>/i.test(code)) notes.push('Hay apertura de `<script>` sin cierre visible.');
      if (/<style\b/i.test(code) && !/<\/style>/i.test(code)) notes.push('Hay apertura de `<style>` sin cierre visible.');
      if (/\bTODO\b|\bFIXME\b/i.test(code)) notes.push('Hay marcas TODO/FIXME pendientes.');
      if (!notes.length) notes.push('No detecte errores simples por heuristica local. Para correccion profunda usa Eficiencia, Experto o Ingeniero con API.');
    } else if (wantsEdit) {
      notes.push('Sin API no aplico ediciones automaticas todavia. Puedo preparar una guia local, pero para modificar codigo con IA activa Experto o Ingeniero.');
    } else {
      notes.push(`Archivo activo: ${ctx.filename}, ${lines.length || 0} lineas.`);
      notes.push(`Proyecto visible: ${files.length} archivo${files.length !== 1 ? 's' : ''}: ${names}.`);
    }

    return `Modo Sin API activo.\n${notes.map(note => `- ${note}`).join('\n')}`;
  };

  const updateCtxBar = () => {
    const ctx = getCtx();
    const profile = getModeProfile();
    if (ctxFile)  ctxFile.textContent  = ctx.filename;
    if (ctxLines) ctxLines.textContent = `${profile.label} · ${ctx.lines} líneas`;
    if (ctxSel) {
      if (ctx.selection) {
        const sl = ctx.selection.split('\n').length;
        ctxSel.textContent = sl + ' lín seleccionadas';
        ctxSel.classList.remove('hidden');
      } else { ctxSel.classList.add('hidden'); }
    }
    // Show attach bar if files attached
    if (attachBar) attachBar.classList.toggle('hidden', attachedFiles.length === 0);
  };

  const openPanel = async () => {
    isOpen = true;
    container.querySelector('.lth-prog-root')?.classList.add('ia-open');
    iaPanel.classList.remove('hidden');
    iaBtn.classList.add('active');
    renderQuickActions();
    updateCtxBar();
    renderUsageMeter();
    // La IA de LTH Prog (GLM-5.2) es exclusiva del plan Pro y usa el wallet compartido
    // con LTH IA. El modo 'offline' (heuristicas locales, sin IA) sigue libre.
    if (getMode() !== 'offline') {
      let state = null;
      try { state = await window.LTHAuth?.getState?.({ force: true }); } catch {}
      if (!state?.signedIn) { showProGate('signin'); return; }
      const fundingSource = sanitizeFundingSource(localStorage.getItem(IA_FUNDING_KEY) || restoreFundingSource(state));
      if (!hasPremiumAccessForSource(state, fundingSource)) { showProGate(fundingSource === 'gift' ? 'gift' : 'pro'); return; }
      renderUsageMeter();
    }
    if (messages.children.length === 0) showWelcome();
    setTimeout(() => input?.focus(), 100);
  };

  // Pantalla de bloqueo: pide iniciar sesion (signin) o subir a Pro (pro).
  const showProGate = (kind = 'pro') => {
    const signin = kind === 'signin';
    const gift = kind === 'gift';
    messages.innerHTML = `
      <div class="ia-panel-setup">
        <div class="ia-setup-label">
          ${signin
            ? 'Inicia sesion en LTH.OS para usar la IA de LTH Prog.'
            : (gift
              ? 'No tienes saldo premium regalado disponible para esta ruta.'
              : 'La IA de LTH Prog (GLM-5.2) es exclusiva del plan <strong>Pro</strong>.')}<br>
          ${signin
            ? 'Tu identidad y tu uso se comparten con LTH IA.'
            : (gift
              ? 'Cambia a "Usar plan" o espera a que el admin te regale saldo premium.'
              : 'Construye y edita tus proyectos con IA; el uso se descuenta del mismo saldo que LTH IA.')}
        </div>
        <button class="ia-setup-save" id="iaProGateAction">${signin ? 'Iniciar sesion' : 'Ver mi cuenta'}</button>
        <div class="ia-setup-note">Tambien puedes usar el modo Offline (sin IA) desde el selector de modo.</div>
      </div>`;
    container.querySelector('#iaProGateAction')?.addEventListener('click', () => {
      if (typeof openApp === 'function') openApp('settings');
    });
  };

  const closePanel = () => {
    isOpen = false;
    container.querySelector('.lth-prog-root')?.classList.remove('ia-open');
    iaPanel.classList.add('hidden');
    iaBtn.classList.remove('active');
  };

  iaBtn.addEventListener('click', () => {
    if (isOpen) closePanel();
    else void openPanel();
  });
  closeBtn?.addEventListener('click', closePanel);

  // LEGACY NEUTRALIZADO: la IA de LTH Prog ya NO usa API key de Anthropic; corre con
  // GLM-5.2 via el wallet compartido. Cualquier llamada residual a showSetup muestra el
  // gate correcto (Pro/sesion) en vez de la vieja pantalla de API key.
  const showSetup = () => showProGate('pro');

  const showWelcome = () => {
    const ctx = getCtx();
    const profile = getModeProfile();
    renderQuickActions();
    messages.innerHTML = `
      <div class="ia-panel-empty">
        <div class="ia-panel-empty-icon">✦</div>
        <div class="ia-panel-empty-text">
          ${profile.label} · ${profile.subtitle}<br>
          <strong style="color:#a5b4fc">${ctx.filename}</strong>
        </div>
      </div>`;
    const sugs = ctx.code
      ? ['Explícame este código','Agrega un botón','Corrige los errores','Mejora el CSS']
      : ['Crea un navbar','Crea una tarjeta','Crea un formulario de contacto'];
    const sugEl = document.createElement('div');
    sugEl.className = 'ia-panel-suggestions';
    sugEl.id = 'iaSuggestions';
    sugs.forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'ia-psug';
      btn.textContent = s;
      btn.onclick = () => send(s);
      sugEl.appendChild(btn);
    });
    messages.after(sugEl);
  };

  // ── Simple diff generator ──
  const makeDiff = (oldText, newText) => {
    const oldL = oldText.split('\n'), newL = newText.split('\n');
    const lines = [];
    let oi=0, ni=0;
    while (oi < oldL.length || ni < newL.length) {
      if (oi < oldL.length && ni < newL.length && oldL[oi] === newL[ni]) {
        lines.push({type:'ctx', text:oldL[oi]}); oi++; ni++;
      } else if (ni < newL.length && (oi >= oldL.length || oldL.indexOf(newL[ni], oi) !== -1)) {
        lines.push({type:'add', text:newL[ni]}); ni++;
      } else if (oi < oldL.length) {
        lines.push({type:'rem', text:oldL[oi]}); oi++;
      } else { ni++; }
    }
    // Collapse unchanged blocks >3 lines
    const result = []; let skipping = 0;
    for (let i=0; i<lines.length; i++) {
      const prev = lines[i-1]?.type, next = lines[i+1]?.type, cur = lines[i];
      if (cur.type==='ctx' && prev==='ctx' && next?.type==='ctx' && i>2 && i<lines.length-2) { skipping++; continue; }
      if (skipping) { result.push({type:'skip', text:`  ··· ${skipping} líneas sin cambios ···`}); skipping=0; }
      result.push(cur);
    }
    if (skipping) result.push({type:'skip', text:`  ··· ${skipping} líneas sin cambios ···`});
    return result;
  };

  const collectProjectDiffStats = (projectResult) => {
    const perFile = [];
    let added = 0;
    let removed = 0;

    (projectResult?.snapshots || []).forEach((snapshot) => {
      const diffLines = makeDiff(snapshot.oldContent || '', snapshot.newContent || '');
      const fileAdded = diffLines.filter(line => line.type === 'add').length;
      const fileRemoved = diffLines.filter(line => line.type === 'rem').length;
      added += fileAdded;
      removed += fileRemoved;
      perFile.push({
        name: snapshot.file?.name || 'archivo',
        added: fileAdded,
        removed: fileRemoved,
        note: snapshot.fullReplace ? 'reemplazo' : ''
      });
    });

    (projectResult?.structuralOps || []).forEach((op) => {
      const opAdded = op.type === 'create'
        ? String(op.file?.content || '').split('\n').filter(Boolean).length
        : 0;
      const opRemoved = op.type === 'delete'
        ? String(op.file?.content || '').split('\n').filter(Boolean).length
        : 0;
      added += opAdded;
      removed += opRemoved;
      perFile.push({
        name: op.newName || op.file?.name || 'archivo',
        added: opAdded,
        removed: opRemoved,
        note: op.type === 'rename' ? 'renombrado' : (op.type === 'create' ? 'nuevo' : 'borrado')
      });
    });

    return { added, removed, perFile };
  };

  const buildProjectDiffRowsHtml = (projectResult, maxRows = 6) => {
    const stats = collectProjectDiffStats(projectResult);
    const rows = stats.perFile.slice(0, maxRows).map((file) => `
      <div class="ia-work-progress-file">
        <span class="ia-work-progress-file-name">${escapeHtml(file.name)}</span>
        <span class="ia-work-progress-add">+${file.added}</span>
        <span class="ia-work-progress-rem">-${file.removed}</span>
        <span class="ia-work-progress-note">${escapeHtml(file.note || '')}</span>
      </div>`).join('');
    return {
      added: stats.added,
      removed: stats.removed,
      rowsHtml: rows,
      hidden: Math.max(0, stats.perFile.length - maxRows)
    };
  };

  const addMsg = (role, text, isCode = false) => {
    messages.querySelector('.ia-panel-empty')?.remove();
    container.querySelector('#iaSuggestions')?.remove();
    const msg = document.createElement('div');
    msg.className = `ia-pmsg ${role}${isCode ? ' is-code' : ''}`;
    const bubble = document.createElement('div');
    bubble.className = 'ia-pbubble';
    bubble.textContent = text;
    msg.appendChild(bubble);
    if (role === 'assistant') {
      const acts = document.createElement('div');
      acts.className = 'ia-pmsg-actions';
      if (isCode) {
        // ── Diff preview button ──
        const diffBtn = document.createElement('button');
        diffBtn.className = 'ia-paction apply';
        diffBtn.textContent = '⇄ Ver cambios';
        diffBtn.onclick = () => {
          const existing = msg.querySelector('.ia-diff-wrap');
          if (existing) { existing.remove(); return; }
          const ctx = getCtx();
          const oldCode = ctx.code || '';
          const diffLines = makeDiff(oldCode, text);
          const added = diffLines.filter(l=>l.type==='add').length;
          const removed = diffLines.filter(l=>l.type==='rem').length;
          const wrap = document.createElement('div');
          wrap.className = 'ia-diff-wrap';
          wrap.innerHTML = `
            <div class="ia-diff-header"><strong>+${added} / -${removed} líneas</strong><span>${ctx.filename}</span></div>
            <div class="ia-diff-body">${diffLines.map(l =>
              `<div class="ia-diff-line ${l.type==='skip'?'ctx':l.type}">${l.type==='add'?'+ ':''}${l.type==='rem'?'- ':''}${l.text.replace(/</g,'&lt;')}</div>`
            ).join('')}</div>
            <div class="ia-diff-actions">
              <button class="ia-diff-btn accept">✓ Aplicar</button>
              <button class="ia-diff-btn reject">✕ Descartar</button>
            </div>`;
          wrap.querySelector('.accept').onclick = () => { ctx.editor?.setValue?.(text); ctx.editor?.focus?.(); iaToast('✅ Código aplicado'); wrap.remove(); };
          wrap.querySelector('.reject').onclick = () => { wrap.remove(); iaToast('Descartado'); };
          msg.appendChild(wrap);
          messages.scrollTop = messages.scrollHeight;
        };
        const insBtn = document.createElement('button');
        insBtn.className = 'ia-paction insert';
        insBtn.textContent = '+ En cursor';
        insBtn.onclick = () => {
          const ed = getCtx().editor;
          if (ed?.replaceRange && ed?.getCursor) ed.replaceRange('\n' + text, ed.getCursor());
          else ed?.setValue?.((ed.getValue()||'') + '\n' + text);
          ed?.focus?.(); iaToast('✅ Insertado');
        };
        acts.appendChild(diffBtn);
        acts.appendChild(insBtn);
      }
      const copyBtn = document.createElement('button');
      copyBtn.className = 'ia-paction copy';
      copyBtn.textContent = '⎘ Copiar';
      copyBtn.onclick = () => { navigator.clipboard?.writeText(text).catch(()=>{}); iaToast('⎘ Copiado'); };
      acts.appendChild(copyBtn);
      msg.appendChild(acts);
    }
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
  };

  const showTyping = () => {
    const t = document.createElement('div');
    t.className = 'ia-pmsg assistant'; t.id = 'iaTyping';
    t.innerHTML = '<div class="ia-ptyping"><div class="ia-pdot"></div><div class="ia-pdot"></div><div class="ia-pdot"></div></div>';
    messages.appendChild(t);
    messages.scrollTop = messages.scrollHeight;
    return t;
  };

  const setTypingProgress = (typingEl, { title = 'Pensando…', detail = '', badge = 'trabajando', projectResult = null } = {}) => {
    if (!typingEl) return;
    const diff = projectResult ? buildProjectDiffRowsHtml(projectResult) : null;
    typingEl.innerHTML = `
      <div class="ia-work-progress">
        <div class="ia-work-progress-head">
          <span class="ia-work-progress-dot"></span>
          <strong>${escapeHtml(title)}</strong>
          <span class="ia-work-progress-badge">${escapeHtml(badge)}</span>
        </div>
        <div class="ia-work-progress-body">${escapeHtml(detail || 'Procesando solicitud…')}</div>
        ${diff && diff.rowsHtml ? `
          <div class="ia-work-progress-files">
            ${diff.rowsHtml}
            ${diff.hidden > 0 ? `<div class="ia-work-progress-note">+ ${diff.hidden} archivo(s) más</div>` : ''}
          </div>` : ''}
      </div>`;
    messages.scrollTop = messages.scrollHeight;
  };

  const iaToast = (msg, kind='ok') => {
    let t = document.getElementById('lthIaToast');
    if (!t) {
      t = document.createElement('div'); t.id = 'lthIaToast';
      Object.assign(t.style, { position:'fixed', bottom:'16px', left:'50%', transform:'translateX(-50%) translateY(8px)',
        zIndex:'2147483647', padding:'9px 18px', borderRadius:'10px', fontSize:'12px', fontWeight:'700',
        color:'#fff', opacity:'0', transition:'opacity .18s, transform .18s', whiteSpace:'nowrap',
        backdropFilter:'blur(10px)', border:'1px solid rgba(255,255,255,.15)' });
  document.body.appendChild(trackGlobalNode(t));
    }
    t.style.background = kind==='err' ? 'rgba(200,60,60,.92)' : 'rgba(20,160,90,.92)';
    t.textContent = msg;
    requestAnimationFrame(() => { t.style.opacity='1'; t.style.transform='translateX(-50%) translateY(0)'; });
    clearTimeout(iaToast._t);
    iaToast._t = setTimeout(() => { t.style.opacity='0'; t.style.transform='translateX(-50%) translateY(8px)'; }, 2200);
  };

  const isEditIntent = (text) => {
    const editWords = /\b(agrega|agregar|añade|a[ñn]adir|a[ñn]adas|crea|crear|modifica|modificar|cambia|cambiar|quita|quitar|ponle|arregla|arreglar|corrige|corregir|implementa|implementar|integra|integrar|incorpora|habilita|activa|conecta|mejora|mejorar|mejores|edita|editar|actualiza|actualizar|refactoriza|optimiza|hazlo|hazle|pon|mete|saca|elimina|reemplaza|mueve|renombra|ajusta|repara|limpia|formatea|ordena|reorganiza|escribe|genera|haz|dale|borra|aplica|agr[eé]gale|c[aá]mbiale|qui?tale|arr[eé]gla|quiero|necesito|dame|ponme|hazme|agr[eé]game|c[aá]mbiame|metele|meteme|quitame|quitale|agregale|a[ñn]adele|a[ñn]ademe|insertame|inserta|funci[oó]n|mensajes?|visibilidad|visible|abajo|arriba|antes|despues|después|dentro|al\s?final|al\s?inicio|un\s?bot[oó]n|un\s?link|un\s?enlace|una?\s?seccion|una?\s?imagen)\b/i;
    return editWords.test(text);
  };

  const buildTaskUserContent = (txt, ctx, options = {}) => {
    const kind = options.kind || 'edit';
    const lines = ctx.code.split('\n');
    const totalLines = lines.length;
    const isAddRequest = /\b(agrega|añade|crea|quiero|necesito|inserta|ponme|metele|un\s?bot[oó]n|un\s?link|una?\s?seccion|abajo|arriba|al\s?final|al\s?inicio|icono|ícono|llamar|llamad|simul|tel[eé]fono|phone|modal|popup|click|clic)\b/i.test(txt);

    // Cuando el contenido del archivo ya viaja aparte en el bloque de workspace (numerado),
    // NO lo repetimos aquí. Repetirlo duplicaba el archivo en el mismo prompt y disparaba el
    // input al doble (p. ej. 27k en vez de ~14k para un rename de <title>).
    if (options.omitCode) {
      return `Archivo activo: ${ctx.filename} (${ctx.type}, ${totalLines} líneas). El contenido completo y numerado está en el bloque de workspace de abajo; ubícate por número de línea y devuelve solo el edit mínimo.\n\nInstrucción: ${txt}`;
    }

    if (kind === 'fix') {
      return `Archivo: ${ctx.filename} (${ctx.type}, ${ctx.lines} líneas)\n\nCódigo completo:\n${ctx.code}\n\nInstrucción: ${txt}`;
    }

    if (kind === 'edit' || kind === 'visual') {
      if (ctx.selection) {
        const selLines = ctx.selection.split('\n');
        const selStart = Math.max(0, ctx.code.indexOf(ctx.selection));
        const linesBefore = ctx.code.substring(0, selStart).split('\n').length - 1;
        const pad = kind === 'visual' ? 14 : 10;
        const from = Math.max(0, linesBefore - pad);
        const to = Math.min(totalLines, linesBefore + selLines.length + pad);
        const fragment = lines.slice(from, to).map((line, index) => `${from + index + 1}| ${line}`).join('\n');
        return `Archivo: ${ctx.filename} (${totalLines} líneas)\n\nLíneas ${from + 1}-${to}:\n${fragment}\n\nSELECCIÓN (líneas ${linesBefore + 1}-${linesBefore + selLines.length}):\n${ctx.selection}\n\nInstrucción: ${txt}`;
      }

      if (totalLines > 120 && !isAddRequest) {
        const ed = ctx.editor;
        const cursorLine = ed?.getCursor?.()?.line || 0;
        const pad = kind === 'visual' ? 40 : 30;
        const from = Math.max(0, cursorLine - pad);
        const to = Math.min(totalLines, cursorLine + pad);
        const header = lines.slice(0, 18).map((line, index) => `${index + 1}| ${line}`).join('\n');
        const fragment = lines.slice(from, to).map((line, index) => `${from + index + 1}| ${line}`).join('\n');
        return `Archivo: ${ctx.filename} (${totalLines} líneas)\n\nEstructura:\n${header}\n···\nLíneas ${from + 1}-${to}:\n${fragment}\n\nInstrucción: ${txt}`;
      }

      return `Archivo: ${ctx.filename}\n\nCódigo (${totalLines} líneas):\n${ctx.code}\n\nInstrucción: ${txt}`;
    }

    const codeRelated = /\b(código|code|función|function|variable|error|bug|línea|estilo|css|html|script|clase|class|div|tag|elemento|selector|this|return|loop|array|import|export|componente|qué hace|explica|explícame|cómo funciona|para qué sirve|estructura|sección|section)\b/i.test(txt);
    if (codeRelated && ctx.code) {
      return `Archivo: ${ctx.filename}\n\nCódigo:\n${ctx.code}\n\nPregunta: ${txt}`;
    }
    return txt;
  };

  const buildHeuristicPlan = (txt, ctx, intentMeta = detectIntentMeta(txt, ctx)) => {
    const memoryTargets = extractFolderMemoryTargetCandidates(txt);
    const relevantTargets = intentMeta.explicitTargets.length
      ? intentMeta.explicitTargets
      : memoryTargets.length
        ? memoryTargets
      : getRelevantWorkspaceFiles(ctx, {
          intent: intentMeta.intent,
          targetFiles: intentMeta.explicitTargets,
          query: txt,
          maxFiles: intentMeta.intent === 'visual_edit' ? 4 : 3
        }).map(file => file.name).filter(Boolean);

    const constraints = [
      'Evita green dot, toolbar frágil, drawer y RUN salvo necesidad real',
      intentMeta.intent === 'visual_edit'
        ? 'Prioriza CSS y conserva el contenido existente'
        : 'Devuelve cambios aplicables y puntuales'
    ];
    if (intentMeta.wantsInteractiveControl) {
      constraints.push('Si el usuario pide un icono o interacción, agrega HTML + CSS + JS mínimos sin rehacer la vista');
    }

    return {
      intent: normalizePlannerIntent(intentMeta.intent, 'chat'),
      targetFiles: relevantTargets,
      changeType: intentMeta.intent === 'visual_edit'
        ? 'css_first_visual_refresh'
        : intentMeta.wantsInteractiveControl
          ? 'interactive_ui_control'
        : intentMeta.wantsProjectOperation
          ? 'project_structure_change'
          : intentMeta.wantsFix
            ? 'bug_fix'
            : 'targeted_edits',
      strategy: intentMeta.intent === 'visual_edit'
        ? 'Intentar impacto visual alto con cambios mínimos, empezando por CSS y tocando HTML solo si hace falta.'
        : intentMeta.wantsInteractiveControl
          ? 'Agregar controles interactivos pequeños sobre la UI actual, con el mínimo HTML, CSS y JS necesario.'
        : intentMeta.wantsFix
          ? 'Corregir problemas reales con ediciones puntuales y seguras.'
          : 'Aplicar cambios precisos sobre archivos existentes del proyecto.',
      userGoal: txt,
      constraints,
      fallback: intentMeta.intent === 'visual_edit'
        ? 'Si falla el search exacto, usar rangos mínimos o fallback flexible sobre CSS/HTML.'
        : intentMeta.wantsInteractiveControl
          ? 'Si el modelo no devuelve edits, intentar fallback local para insertar control, estilos y script mínimo en el HTML activo.'
        : 'Si falla el search exacto, usar rangos mínimos o reintento con snapshot fresco.',
      canApplyFromMemory: !!intentMeta.wantsMemoryApply
    };
  };

  const ensurePlanTargets = (plan, ctx) => {
    const nextPlan = cloneJSON(plan, {}) || {};
    const intent = normalizePlannerIntent(nextPlan.intent, 'chat');
    const activeFileName = String(ctx?.filename || '').trim();
    const activeRecordName = String(ctx?.file?.name || '').trim();
    const declaredTargets = Array.isArray(nextPlan.targetFiles) ? nextPlan.targetFiles : [];
    const mergedTargets = uniqStrings([
      ...declaredTargets,
      ...(intent !== 'chat' && !declaredTargets.length ? [activeFileName, activeRecordName] : [])
    ]).filter(Boolean).slice(0, 8);
    nextPlan.intent = intent;
    nextPlan.targetFiles = mergedTargets;
    return nextPlan;
  };

  const normalizePlannerPlanPayload = (plan, fallbackPlan) => {
    const fallback = fallbackPlan || {};
    return {
      intent: normalizePlannerIntent(plan?.intent, normalizePlannerIntent(fallback.intent, 'chat')),
      targetFiles: uniqStrings([
        ...(Array.isArray(plan?.target_files) ? plan.target_files : []),
        ...(Array.isArray(plan?.targetFiles) ? plan.targetFiles : []),
        ...(Array.isArray(fallback.targetFiles) ? fallback.targetFiles : [])
      ]).slice(0, 8),
      changeType: String(plan?.change_type || plan?.changeType || fallback.changeType || '').trim() || 'targeted_edits',
      strategy: String(plan?.strategy || fallback.strategy || '').trim() || 'Aplicar ediciones puntuales seguras.',
      userGoal: String(plan?.user_goal || plan?.userGoal || fallback.userGoal || '').trim(),
      constraints: uniqStrings([
        ...(Array.isArray(plan?.constraints) ? plan.constraints : []),
        ...(Array.isArray(fallback.constraints) ? fallback.constraints : [])
      ]),
      fallback: String(plan?.fallback || fallback.fallback || '').trim(),
      canApplyFromMemory: !!(plan?.can_apply_from_memory ?? plan?.canApplyFromMemory ?? fallback.canApplyFromMemory)
    };
  };

  const buildPlannerContext = (txt, ctx, profile, intentMeta) => {
    const taskKind = intentMeta.intent === 'fix_edit'
      ? 'fix'
      : intentMeta.intent === 'chat'
        ? 'chat'
        : (intentMeta.intent === 'visual_edit' ? 'visual' : 'edit');
    const brainBlock = safeBuildProgBrainContextBlock(txt);
    const memorySummary = self.state?.lastExecutableEdits
      ? `\n\nMemoria ejecutable disponible:\n- Último intent: ${normalizePlannerIntent(self.state?.lastPlan?.intent, 'project_edit')}\n- Últimos archivos objetivo: ${(self.state?.lastTargetFiles || []).join(', ') || 'sin archivos'}\n- Último apply: ${shortText(self.state?.lastApplySummary?.headline || self.state?.lastApplySummary?.summary || 'pendiente', 120)}`
      : '\n\nMemoria ejecutable disponible: no';

    return `${buildTaskUserContent(txt, ctx, { kind: taskKind })}${buildWorkspaceContext(ctx, profile, {
      forceWorkspace: intentMeta.useProjectTool || intentMeta.intent === 'visual_edit',
      intent: intentMeta.intent,
      targetFiles: uniqStrings([...intentMeta.explicitTargets, ...extractFolderMemoryTargetCandidates(txt)])
    })}${brainBlock}${safeBuildFolderMemoryContextBlock(txt)}${memorySummary}`;
  };

  const buildPlanSummaryBlock = (plan, ctx = getCtx()) => `Plan actual:
- intent: ${plan.intent}
- archivos objetivo: ${(plan.targetFiles || []).join(', ') || 'sin archivo explícito'}
- archivo activo prioritario: ${ctx.filename || 'sin archivo'}
- change_type: ${plan.changeType || 'targeted_edits'}
- strategy: ${plan.strategy || 'sin estrategia'}
- constraints: ${(plan.constraints || []).join(' | ') || 'sin restricciones extra'}
- fallback: ${plan.fallback || 'sin fallback declarado'}`;

  const buildTargetGuardBlock = (plan, ctx = getCtx()) => {
    const forcedTargets = uniqStrings([
      ...(Array.isArray(plan?.targetFiles) ? plan.targetFiles : []),
      ...(!Array.isArray(plan?.targetFiles) || !plan.targetFiles.length ? [ctx.filename || ''] : [])
    ]).filter(Boolean);
    return `Regla obligatoria de ejecución:
- Debes tocar al menos uno de estos archivos: ${forcedTargets.join(', ') || ctx.filename || 'archivo activo'}
- Si la memoria apunta a un archivo diferente del activo, prioriza el archivo de memoria.
- Si no tienes confianza suficiente sobre el archivo objetivo, pregunta al usuario antes de aplicar.
- No devuelvas arrays vacíos. Si no puedes editar varios archivos, edita al menos ${forcedTargets[0] || ctx.filename || 'el archivo objetivo'}.`;
  };

  const canUseLocalVisualFallback = (ctx) => {
    const code = String(ctx?.code || '');
    if (!code.trim()) return false;
    if (!/\.html?$/i.test(String(ctx?.filename || ''))) return false;
    if (code.split('\n').length > 55) return false;
    if (/\b(class|id|onclick|href|src)=["'][^"']+["']/i.test(code)) return false;
    if (/<(button|img|a|section|article|header|footer|nav|main|form|input|dialog|video|iframe|svg)\b/i.test(code)) return false;
    return /<h1\b/i.test(code) && /<p\b/i.test(code);
  };

  const buildLocalVisualFallbackPayload = (ctx, plan) => {
    const activeFile = String(ctx?.filename || '').trim();
    const code = String(ctx?.code || '');
    if (!activeFile || !/\.html?$/i.test(activeFile) || !code.trim()) return null;
    if (!canUseLocalVisualFallback(ctx)) return null;

    const styleCloseTag = code.match(/<\/style>/i)?.[0] || '';
    const headCloseTag = code.match(/<\/head>/i)?.[0] || '';
    const visualPatch = `
    /* LTH visual patch */
    :root{
      color-scheme: light;
      --lth-bg-1:#f7f7ff;
      --lth-bg-2:#eef4ff;
      --lth-accent:#7c3aed;
      --lth-accent-2:#06b6d4;
      --lth-text:#111827;
      --lth-muted:#475569;
      --lth-shadow:0 24px 60px rgba(15,23,42,.14);
    }

    body{
      min-height:100vh;
      padding:32px 18px;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      gap:18px;
      background:
        radial-gradient(circle at top left, rgba(124,58,237,.16), transparent 32%),
        radial-gradient(circle at bottom right, rgba(6,182,212,.16), transparent 28%),
        linear-gradient(180deg, var(--lth-bg-1), var(--lth-bg-2));
      font-family:"Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
      color:var(--lth-text);
    }

    body > *{
      width:min(100%, 760px);
    }

    h1{
      margin:0;
      padding:28px 32px;
      border-radius:28px;
      background:linear-gradient(135deg, var(--lth-accent), var(--lth-accent-2));
      color:#fff;
      text-align:center;
      font-size:clamp(2.4rem, 6vw, 4.2rem);
      line-height:1.04;
      letter-spacing:-0.04em;
      box-shadow:var(--lth-shadow);
    }

    p{
      margin:0;
      padding:22px 26px;
      border-radius:22px;
      background:rgba(255,255,255,.88);
      color:var(--lth-muted);
      font-size:1.08rem;
      line-height:1.7;
      box-shadow:0 18px 40px rgba(15,23,42,.08);
      border:1px solid rgba(124,58,237,.08);
      text-align:center;
    }

    @media (max-width: 640px){
      body{
        padding:20px 14px;
      }

      h1{
        padding:22px 18px;
        border-radius:22px;
      }

      p{
        padding:18px 16px;
        font-size:1rem;
      }
    }`;

    const targetFile = (plan?.targetFiles || []).find(file => normalizeLooseFileRef(file) === normalizeLooseFileRef(activeFile)) || activeFile;

    if (styleCloseTag) {
      return {
        files: [{
          file: targetFile,
          edits: [{
            search: styleCloseTag,
            replace: `${visualPatch}\n  ${styleCloseTag}`
          }]
        }]
      };
    }

    if (!headCloseTag) return null;

    return {
      files: [{
        file: targetFile,
        edits: [{
          search: headCloseTag,
          replace: `<style>${visualPatch}\n  </style>\n  ${headCloseTag}`
        }]
      }]
    };
  };

  const buildGenericVisualUpgradeFallbackPayload = (ctx, plan, text = '', skillContext = {}) => {
    const activeFile = String(ctx?.filename || '').trim();
    const code = String(ctx?.code || '');
    if (!activeFile || !/\.html?$/i.test(activeFile) || !code.trim()) return null;
    if (!/<body[\s>]/i.test(code)) return null;

    const activeSkillIds = Array.isArray(skillContext?.ids) ? skillContext.ids : [];
    const prefersSeparatedCss = activeSkillIds.includes('vanilla-spa');
    const prefersTailwindScale = activeSkillIds.includes('tailwind-ui');
    const prefersResponsiveLayout = activeSkillIds.includes('responsive-layout');
    const targetFile = (plan?.targetFiles || []).find(file => normalizeLooseFileRef(file) === normalizeLooseFileRef(activeFile)) || activeFile;
    const files = self.state?.filesList || [];
    const activeBase = String(activeFile).replace(/\.html?$/i, '').toLowerCase();
    const cssTarget = files.find(file =>
      file?.type === 'css' &&
      String(file.name || '').replace(/\.css$/i, '').toLowerCase() === activeBase
    ) || files.find(file => file?.type === 'css') || null;
    const wantsModern = /\b(modern|moderna|moderno|premium|pulid|elegan|clean|sofisticad|m[aá]s\s+bonit|mejor\s+dise[ñn]o)\b/i.test(String(text || ''));
    const accentA = wantsModern ? '#ff6a3d' : '#7c3aed';
    const accentB = wantsModern ? '#c2410c' : '#06b6d4';
    const shadow = wantsModern ? '0 30px 80px rgba(8, 12, 24, 0.42)' : '0 22px 60px rgba(15, 23, 42, 0.18)';
    const visualPatch = `
  /* LTH visual upgrade fallback */
  :root{
    --space-1:4px;
    --space-2:8px;
    --space-3:12px;
    --space-4:16px;
    --space-5:24px;
    --space-6:32px;
    --lth-surface-0:#0f1014;
    --lth-surface-1:#17181f;
    --lth-surface-2:#20222b;
    --lth-line:rgba(255,255,255,.06);
    --lth-text-1:#f4f7fb;
    --lth-text-2:rgba(244,247,251,.72);
    --lth-accent-a:${accentA};
    --lth-accent-b:${accentB};
    --lth-shadow:${shadow};
    --lth-radius-xl:${prefersTailwindScale ? '16px' : '28px'};
    --lth-radius-lg:${prefersTailwindScale ? '16px' : '20px'};
    --lth-radius-md:${prefersTailwindScale ? '12px' : '16px'};
  }

  html{
    color-scheme:dark;
    background:
      radial-gradient(circle at top, rgba(255,255,255,.04), transparent 30%),
      linear-gradient(180deg, #090a0f 0%, #0e1018 100%);
  }

  body{
    background:transparent !important;
    color:var(--lth-text-1) !important;
    -webkit-font-smoothing:antialiased;
    text-rendering:optimizeLegibility;
  }

  .hero, .banner, .jumbotron, [class*="hero"], [class*="banner"]{
    position:relative;
    overflow:hidden;
    border-radius:var(--lth-radius-xl) !important;
    background:
      linear-gradient(135deg, color-mix(in srgb, var(--lth-accent-a) 76%, #111 24%), color-mix(in srgb, var(--lth-accent-b) 72%, #111 28%)) !important;
    box-shadow:var(--lth-shadow) !important;
    border:1px solid rgba(255,255,255,.08) !important;
  }

  .hero::after, .banner::after, .jumbotron::after, [class*="hero"]::after, [class*="banner"]::after{
    content:"";
    position:absolute;
    inset:auto -10% -40% auto;
    width:220px;
    height:220px;
    border-radius:50%;
    background:radial-gradient(circle, rgba(255,255,255,.18), transparent 68%);
    pointer-events:none;
  }

  h1, h2, h3{
    letter-spacing:-0.04em;
    line-height:1.02;
    color:var(--lth-text-1) !important;
    font-size:${prefersResponsiveLayout ? 'clamp(1.5rem, 4vw, 3.25rem)' : 'inherit'};
  }

  p, span, small, label, .muted, [class*="subtitle"], [class*="desc"]{
    color:var(--lth-text-2) !important;
  }

  .card, .product-card, .item-card, [class*="card"], [class*="tile"], [class*="product"]{
    border-radius:var(--lth-radius-lg) !important;
    background:linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.02)) !important;
    border:1px solid var(--lth-line) !important;
    box-shadow:0 14px 36px rgba(0,0,0,.26) !important;
    backdrop-filter:blur(10px);
    transition:transform .22s ease, box-shadow .22s ease, border-color .22s ease;
  }

  .card:hover, .product-card:hover, .item-card:hover, [class*="card"]:hover, [class*="tile"]:hover, [class*="product"]:hover{
    transform:translateY(-3px);
    box-shadow:0 22px 46px rgba(0,0,0,.34) !important;
    border-color:rgba(255,255,255,.12) !important;
  }

  button, .btn, [class*="btn"], a.cta, a.button{
    border-radius:999px !important;
    border:1px solid rgba(255,255,255,.08) !important;
    background:linear-gradient(135deg, var(--lth-accent-a), var(--lth-accent-b)) !important;
    color:#fff !important;
    box-shadow:0 14px 32px color-mix(in srgb, var(--lth-accent-a) 32%, transparent) !important;
    transition:transform .16s ease, filter .16s ease, box-shadow .16s ease;
  }

  button:hover, .btn:hover, [class*="btn"]:hover, a.cta:hover, a.button:hover{
    transform:translateY(-1px);
    filter:saturate(1.06) brightness(1.02);
  }

  header, nav, .navbar, [class*="nav"], [class*="header"]{
    backdrop-filter:blur(12px);
    background:rgba(12,14,22,.72) !important;
    border-bottom:1px solid rgba(255,255,255,.06) !important;
  }

  .container, .wrapper, .content, main, section{
    width:${prefersResponsiveLayout ? 'min(100% - 2rem, 1100px)' : 'auto'};
    margin-inline:${prefersResponsiveLayout ? 'auto' : 'initial'};
  }

  .grid, [class*="grid"], [class*="products"], [class*="list"]{
    gap:${prefersTailwindScale ? 'var(--space-4)' : 'var(--space-5)'};
  }

  img{
    border-radius:18px;
    max-width:100%;
    height:auto;
  }
`;

    if (prefersSeparatedCss && cssTarget) {
      return {
        replace_files: [{
          file: cssTarget.name || cssTarget.id,
          content: `${String(cssTarget.content || '').trimEnd()}\n\n${visualPatch}\n`
        }]
      };
    }

    if (/<\/style>/i.test(code)) {
      return {
        files: [{
          file: targetFile,
          edits: [{
            search: '</style>',
            replace: `${visualPatch}\n</style>`
          }]
        }]
      };
    }

    if (/<\/head>/i.test(code)) {
      return {
        files: [{
          file: targetFile,
          edits: [{
            search: '</head>',
            replace: `<style>${visualPatch}\n</style>\n</head>`
          }]
        }]
      };
    }

    return null;
  };

  const isInteractiveControlRequest = (text) => INTERACTIVE_CONTROL_RE.test(String(text || ''));

  const buildInteractiveGuardBlock = (text, ctx = getCtx()) => {
    if (!isInteractiveControlRequest(text)) return '';
    return `Regla obligatoria de interacción:
- Si el pedido habla de icono, botón, llamada, teléfono, click o modal, debes devolver HTML + CSS + JS mínimos sobre ${ctx.filename || 'el archivo activo'}.
- No dejes arrays vacíos.
- Puedes inyectar un <script> pequeño antes de </body> si hace falta para simular la interacción.`;
  };

  const buildLocalCallActionFallbackPayload = (ctx, text, plan) => {
    const activeFile = String(ctx?.filename || '').trim();
    const code = String(ctx?.code || '');
    if (!activeFile || !/\.html?$/i.test(activeFile) || !code.trim()) return null;
    if (!isInteractiveControlRequest(text)) return null;
    if (/card-call-btn|simulateCallMock|data-contact=/i.test(code)) return null;

    const nameMatches = Array.from(code.matchAll(/<div class="card-name">([\s\S]*?)<\/div>/g));
    if (!nameMatches.length) return null;

    const targetFile = (plan?.targetFiles || []).find(file => normalizeLooseFileRef(file) === normalizeLooseFileRef(activeFile)) || activeFile;
    const nameEdits = nameMatches.slice(0, 12).map((match) => {
      const full = match[0];
      const rawName = String(match[1] || '').replace(/<[^>]*>/g, '').trim() || 'contacto';
      const safeName = rawName.replace(/"/g, '&quot;');
      return {
        search: full,
        replace: `<div class="card-name-row"><div class="card-name">${match[1]}</div><button class="card-call-btn" type="button" aria-label="Llamar a ${safeName}" data-contact="${safeName}">📞</button></div>`
      };
    });

    const cssPatch = `

  .card-name-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .card-call-btn {
    width: 34px;
    height: 34px;
    border-radius: 999px;
    border: 1px solid rgba(201,168,76,0.28);
    background: rgba(201,168,76,0.12);
    color: #d7b35d;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    cursor: pointer;
    flex-shrink: 0;
    transition: transform 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
    box-shadow: 0 6px 16px rgba(0,0,0,0.22);
  }

  .card-call-btn:hover,
  .card-call-btn:active {
    transform: scale(0.96);
    background: rgba(201,168,76,0.18);
  }

  .card-call-btn.is-calling {
    background: rgba(34,197,94,0.18);
    border-color: rgba(34,197,94,0.34);
    color: #86efac;
  }`;

    const scriptPatch = `
<script>
  (function(){
    if (window.__simulateCallMockInit) return;
    window.__simulateCallMockInit = true;
    document.addEventListener('click', function(event){
      const btn = event.target.closest('.card-call-btn');
      if (!btn) return;
      const contact = btn.getAttribute('data-contact') || 'este contacto';
      const baseLabel = '📞';
      btn.classList.add('is-calling');
      btn.textContent = '...';
      window.setTimeout(function(){
        btn.classList.remove('is-calling');
        btn.textContent = baseLabel;
        alert('Llamada simulada con ' + contact);
      }, 700);
    });
  })();
</script>`;

    const edits = [...nameEdits];
    if (/<\/style>/i.test(code)) {
      edits.push({
        search: '</style>',
        replace: `${cssPatch}\n</style>`
      });
    }
    if (/<\/body>/i.test(code)) {
      edits.push({
        search: '</body>',
        replace: `${scriptPatch}\n</body>`
      });
    }

    if (edits.length === nameEdits.length) return null;

    return {
      files: [{
        file: targetFile,
        edits
      }]
    };
  };

  const VISUAL_EXECUTION_RULES = [
    'Modo visual_edit obligatorio.',
    'Debes devolver cambios aplicables reales.',
    'No respondas solo con recomendaciones.',
    'No te quedes en explicación.',
    'Prioriza CSS y toca HTML solo si hace falta.',
    'No rehagas el archivo completo ni reemplaces todo el bloque <style> si puedes hacer overrides puntuales.',
    'Mantén contenido, textos y estructura funcional existente.',
    'Mejora jerarquía visual, espaciado, estructura, colores y tipografía.',
    'Haz el mínimo cambio necesario con máximo impacto visual.'
  ].join(' ');

  const PLANNER_TOOL = {
    name: 'plan_lth_edit',
    description: 'Decide la intención y estrategia de edición antes de ejecutar cambios en LTH PROG.',
    input_schema: {
      type: 'object',
      required: ['intent', 'target_files', 'strategy'],
      properties: {
        intent: {
          type: 'string',
          enum: ['chat', 'project_edit', 'visual_edit', 'fix_edit'],
          description: 'Tipo real de intención detectada para esta solicitud'
        },
        target_files: {
          type: 'array',
          description: 'Archivos concretos que deberían tocarse primero',
          items: { type: 'string' }
        },
        change_type: {
          type: 'string',
          description: 'css_first, targeted_edits, project_structure_change, bug_fix u otro valor corto útil'
        },
        strategy: {
          type: 'string',
          description: 'Plan corto de ejecución aplicable'
        },
        user_goal: {
          type: 'string',
          description: 'Objetivo del usuario reinterpretado en una línea'
        },
        constraints: {
          type: 'array',
          items: { type: 'string' }
        },
        fallback: {
          type: 'string',
          description: 'Qué hacer si el primer apply falla'
        },
        can_apply_from_memory: {
          type: 'boolean',
          description: 'Marca true si la solicitud parece pedir aplicar la última edición guardada'
        }
      }
    }
  };

  // ── Tool definition for code edits ──
  const EDIT_TOOL = {
    name: 'apply_edits',
    description: 'Aplica cambios puntuales al código del archivo abierto. Cada edit busca un texto exacto en el código y lo reemplaza.',
    input_schema: {
      type: 'object',
      required: ['edits'],
      properties: {
        edits: {
          type: 'array',
          description: 'Lista de cambios a aplicar',
          items: {
            type: 'object',
            required: ['replace'],
            properties: {
              search:  { type:'string', description:'Texto EXACTO del código original a reemplazar (copiar tal cual, con indentado)' },
              start_line: { type:'number', description:'Linea inicial 1-based para editar si no usas search exacto' },
              end_line: { type:'number', description:'Linea final 1-based incluida para editar si no usas search exacto' },
              replace: { type:'string', description:'Texto nuevo que sustituye al buscado o al rango de lineas' }
            }
          }
        }
      }
    }
  };

  const PROJECT_EDIT_TOOL = {
    name: 'apply_project_edits',
    description: 'Modifica el proyecto abierto en LTH PROG. Puede editar archivos existentes, crear archivos nuevos, renombrar archivos o solicitar borrados controlados.',
    input_schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          description: 'Lista de archivos del proyecto que deben modificarse',
          items: {
            type: 'object',
            required: ['file', 'edits'],
            properties: {
              file: {
                type: 'string',
                description: 'Nombre, ruta o id exacto del archivo a modificar'
              },
              edits: {
                type: 'array',
                description: 'Lista de cambios a aplicar en ese archivo',
                items: {
                  type: 'object',
                  required: ['replace'],
                  properties: {
                    search: { type:'string', description:'Texto EXACTO del código original a reemplazar (sin números de línea)' },
                    start_line: { type:'number', description:'Linea inicial 1-based para editar si el search exacto puede fallar' },
                    end_line: { type:'number', description:'Linea final 1-based incluida para editar si el search exacto puede fallar' },
                    replace: { type:'string', description:'Texto nuevo que sustituye al buscado' }
                  }
                }
              }
            }
          }
        },
        replace_files: {
          type: 'array',
          description: 'Reemplazo completo de archivos existentes. Ultimo recurso: usalo solo si el usuario pide reconstruir/refactorizar una parte grande, o si un cambio amplio no puede expresarse con edits puntuales.',
          items: {
            type: 'object',
            required: ['file', 'content'],
            properties: {
              file: { type:'string', description:'Nombre, ruta o id exacto del archivo existente' },
              content: { type:'string', description:'Contenido completo actualizado del archivo' }
            }
          }
        },
        create_files: {
          type: 'array',
          description: 'Archivos nuevos a crear dentro del proyecto abierto. Puede usar rutas relativas seguras como src/page.html.',
          items: {
            type: 'object',
            required: ['name', 'content'],
            properties: {
              name: { type:'string', description:'Nombre o ruta relativa con extension de texto/codigo: .html, .css, .js, .ts, .tsx, .py, .json, .md, .txt, .yml, etc.' },
              content: { type:'string', description:'Contenido inicial del archivo nuevo' }
            }
          }
        },
        rename_files: {
          type: 'array',
          description: 'Renombres de archivos existentes',
          items: {
            type: 'object',
            required: ['file', 'new_name'],
            properties: {
              file: { type:'string', description:'Nombre, ruta o id exacto del archivo existente' },
              new_name: { type:'string', description:'Nuevo nombre con extension soportada' }
            }
          }
        },
        delete_files: {
          type: 'array',
          description: 'Archivos existentes que deben borrarse solo si el usuario lo pidio explicitamente',
          items: {
            type: 'object',
            required: ['file'],
            properties: {
              file: { type:'string', description:'Nombre, ruta o id exacto del archivo a borrar' },
              reason: { type:'string', description:'Motivo breve del borrado' }
            }
          }
        }
      }
    }
  };

  const getProjectEditTool = (options = {}) => {
    if (!options.requireFileEdits) return PROJECT_EDIT_TOOL;
    const tool = JSON.parse(JSON.stringify(PROJECT_EDIT_TOOL));
    tool.input_schema.required = ['files'];
    tool.input_schema.properties.files.minItems = 1;
    tool.input_schema.properties.files.items.properties.edits.minItems = 1;
    return tool;
  };

  const callClaudePlanner = async (apiMessages, systemPrompt, fallbackPlan, attempt = 0) => {
    const result = await callAnthropicBridge({
      maxTokens: 1400,
      system: systemPrompt,
      messages: apiMessages,
      tools: [PLANNER_TOOL],
      toolChoice: { type: 'tool', name: PLANNER_TOOL.name },
      timeoutMs: 90000
    }).catch((err) => {
      if (isTimeoutAIError(err)) return err;
      if (isRetryableAIError(err) && attempt < 3) return err;
      throw err;
    });

    if (result instanceof Error) {
      if (isTimeoutAIError(result)) throw result;
      const waitMs = getRetryWaitMs(result, attempt);
      iaToast(`⏳ ${formatRetryableErrorLabel(result)}. Reintentando...`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      return callClaudePlanner(apiMessages, systemPrompt, fallbackPlan, attempt + 1);
    }

    const toolBlock = result.content?.find(block => block.type === 'tool_use' && block.name === PLANNER_TOOL.name);
    return {
      plan: normalizePlannerPlanPayload(toolBlock?.input, fallbackPlan),
      rawText: result.text || '',
      hadToolUse: !!toolBlock
    };
  };

  // ── Call Claude with tools (non-streaming, for edits) + retry on 429 ──
  /* ─────────────────────────────────────────
     Fase 2 — Herramientas de LECTURA para el ejecutor (estilo Claude Code).
     En vez de solo EMPUJAR contexto adivinado (planner + focus + memoria), el
     modelo puede PEDIR lo que necesita antes de editar: leer un rango de un
     archivo, buscar texto en el workspace o listar secciones. Todo se resuelve
     LOCAL (getWorkspaceFiles ya tiene el contenido en memoria): cero red y
     cero tokens extra por la lectura en si; el costo es la llamada adicional
     al modelo por ronda, por eso hay presupuesto duro de rondas.
     Solo se activa en el PRIMER intento del ejecutor; retry/repair conservan
     su red de seguridad con archivo completo.
  ───────────────────────────────────────── */
  const READ_TOOL_NAMES = ['leer_archivo', 'buscar_en_carpeta', 'listar_secciones'];
  const READ_TOOL_MAX_ROUNDS = 3;
  const READ_TOOL_RESULT_MAX_CHARS = 6500;
  const READ_TOOL_MAX_WINDOW_LINES = 200;

  const detectReadToolRequest = (input) => {
    if (!input || typeof input !== 'object') return null;
    const name = String(input.tool || '').trim().toLowerCase();
    if (!READ_TOOL_NAMES.includes(name)) return null;
    return { name, args: (input.args && typeof input.args === 'object') ? input.args : {} };
  };

  const clampReadToolOutput = (text) => {
    const raw = String(text || '');
    return raw.length > READ_TOOL_RESULT_MAX_CHARS
      ? `${raw.slice(0, READ_TOOL_RESULT_MAX_CHARS)}\n[... resultado recortado; pide un rango mas especifico ...]`
      : raw;
  };

  const runLocalReadTool = (name, args = {}) => {
    const files = getWorkspaceFiles();
    const listNames = () => files.map(file => file.name).slice(0, 30).join(', ') || 'sin archivos';
    if (name === 'leer_archivo') {
      const file = resolveWorkspaceFileMatch(args.archivo, files);
      if (!file) return `ERROR: no existe "${String(args.archivo || '')}". Archivos disponibles: ${listNames()}.`;
      const lines = String(file.content || '').split('\n');
      const from = Math.max(1, Math.min(lines.length, Math.floor(Number(args.desde_linea) || 1)));
      const requestedTo = Math.floor(Number(args.hasta_linea) || (from + READ_TOOL_MAX_WINDOW_LINES - 1));
      const to = Math.max(from, Math.min(lines.length, requestedTo, from + READ_TOOL_MAX_WINDOW_LINES - 1));
      const body = lines.slice(from - 1, to).map((line, i) => `${from + i}: ${line}`).join('\n');
      return clampReadToolOutput(`ARCHIVO ${file.name} (lineas ${from}-${to} de ${lines.length}):\n${body}`);
    }
    if (name === 'buscar_en_carpeta') {
      const needle = String(args.texto || '').trim();
      if (needle.length < 2) return 'ERROR: pasa en args.texto un texto de al menos 2 caracteres.';
      const lowered = needle.toLowerCase();
      const hits = [];
      let total = 0;
      files.forEach((file) => {
        String(file.content || '').split('\n').forEach((line, i) => {
          if (!line.toLowerCase().includes(lowered)) return;
          total += 1;
          if (hits.length < 12) hits.push(`${file.name}:${i + 1}: ${line.trim().slice(0, 160)}`);
        });
      });
      if (!total) return `Sin coincidencias de "${needle}" en el workspace (${listNames()}).`;
      return clampReadToolOutput(`${total} coincidencia(s) de "${needle}"${total > hits.length ? ` (mostrando ${hits.length})` : ''}:\n${hits.join('\n')}`);
    }
    if (name === 'listar_secciones') {
      const file = resolveWorkspaceFileMatch(args.archivo, files);
      if (!file) return `ERROR: no existe "${String(args.archivo || '')}". Archivos disponibles: ${listNames()}.`;
      const lines = String(file.content || '').split('\n');
      const outline = buildStructureOutline(buildSectionIndex(file.content || '', file.type));
      return clampReadToolOutput(`SECCIONES DE ${file.name} (${lines.length} lineas):\n${outline || 'Sin secciones detectables; usa leer_archivo por rangos.'}`);
    }
    return `ERROR: herramienta desconocida "${name}". Disponibles: ${READ_TOOL_NAMES.join(', ')}.`;
  };

  const buildReadToolsPromptBlock = (rounds) =>
    `[HERRAMIENTAS DE LECTURA — te quedan ${rounds} peticiones]\n` +
    'EXCEPCION al formato anterior: si el contexto dado NO basta para editar con precision, ' +
    'ANTES de dar el JSON final puedes responder con UN solo objeto JSON de lectura (sin texto extra):\n' +
    '{"tool":"leer_archivo","args":{"archivo":"index.html","desde_linea":40,"hasta_linea":140}}\n' +
    '{"tool":"buscar_en_carpeta","args":{"texto":"add-to-cart"}}\n' +
    '{"tool":"listar_secciones","args":{"archivo":"index.html"}}\n' +
    'Recibiras el resultado y podras pedir otra lectura o responder el JSON final. ' +
    'Usa lecturas SOLO si de verdad te falta contexto: cada lectura cuesta una llamada extra.';

  const callClaudeWithTools = async (apiMessages, systemPrompt, options = {}, attempt = 0) => {
    const projectMode = !!options.projectMode;
    const tool = projectMode ? getProjectEditTool(options) : EDIT_TOOL;
    const toolName = tool.name;
    const readRounds = options.readTools === true
      ? Math.max(0, Math.floor(Number(options.readToolRounds ?? READ_TOOL_MAX_ROUNDS)))
      : 0;
    const result = await callAnthropicBridge({
      maxTokens: 4096,
      system: systemPrompt,
      messages: apiMessages,
      tools: [tool],
      toolChoice: { type:'tool', name: toolName },
      readToolsHint: readRounds > 0 ? buildReadToolsPromptBlock(readRounds) : '',
      timeoutMs: Number(options.timeoutMs || 120000)
    }).catch((err) => {
      if (isTimeoutAIError(err)) return err;
      if (isRetryableAIError(err) && attempt < 3) return err;
      throw err;
    });

    if (result instanceof Error) {
      if (isTimeoutAIError(result)) throw result;
      const waitMs = getRetryWaitMs(result, attempt);
      iaToast(`⏳ ${formatRetryableErrorLabel(result)}. Reintentando...`);
      await new Promise(r => setTimeout(r, waitMs));
      return callClaudeWithTools(apiMessages, systemPrompt, options, attempt + 1);
    }

    const toolBlock = result.content?.find(b => b.type === 'tool_use' && b.name === toolName);

    // Fase 2: ¿el modelo pidio LEER antes de editar? Se ejecuta local, se anexa
    // el resultado a la conversacion y se re-llama con una ronda menos.
    if (readRounds > 0) {
      const readReq = detectReadToolRequest(toolBlock?.input);
      if (readReq) {
        const toolOutput = runLocalReadTool(readReq.name, readReq.args);
        try { options.onReadTool?.(readReq, readRounds - 1, toolOutput); } catch {}
        const nextMessages = [
          ...apiMessages,
          { role: 'assistant', content: JSON.stringify({ tool: readReq.name, args: readReq.args }) },
          {
            role: 'user',
            content: `RESULTADO ${readReq.name}:\n${toolOutput}\n\n` +
              (readRounds - 1 > 0
                ? `Te quedan ${readRounds - 1} lecturas. Si ya tienes el contexto necesario, responde AHORA con el JSON final de "${toolName}".`
                : `Ya no puedes pedir mas lecturas. Responde AHORA con el JSON final de "${toolName}".`)
          }
        ];
        return callClaudeWithTools(nextMessages, systemPrompt, { ...options, readToolRounds: readRounds - 1 }, attempt);
      }
    }

    return {
      payload: projectMode
        ? (toolBlock?.input || {})
        : (toolBlock?.input?.edits || []),
      rawText: result.text || '',
      hadToolUse: !!toolBlock,
      toolName
    };
  };

  /* ─────────────────────────────────────────
     Fase 3 — Ciclo de verificacion con el preview.
     Despues de aplicar edits, se recarga el preview (aunque el visualizador
     este apagado: el iframe ejecuta igual), se esperan ~2.2 s y se recogen los
     errores que el puente lth-prog-error-bridge reporto por postMessage.
     Si hay errores y autoApply esta activo, se da UN solo turno de reparacion
     (con herramientas de lectura de la Fase 2) y se re-verifica. Presupuesto
     duro de 1 reparacion por mensaje: un bug terco no se come la wallet.
  ───────────────────────────────────────── */
  const PREVIEW_VERIFY_WAIT_MS = 2200;

  const collectPreviewErrors = () => {
    const log = Array.isArray(self._previewErrorLog) ? self._previewErrorLog : [];
    const seen = new Set();
    const out = [];
    log.forEach((entry) => {
      const key = `${entry.kind}|${entry.message}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(entry);
    });
    return out.slice(0, 6);
  };

  const runPreviewErrorScan = async () => {
    self._previewErrorLog = [];
    try { self.refreshLive?.(container, true); } catch {}
    await new Promise(resolve => setTimeout(resolve, PREVIEW_VERIFY_WAIT_MS));
    return collectPreviewErrors();
  };

  const formatPreviewErrorReport = (errors = []) => errors
    .map(entry => `- [${entry.kind}] ${entry.message}${entry.source ? ` (${entry.source}${entry.line ? `:${entry.line}` : ''})` : ''}`)
    .join('\n');

  const payloadTouchesPreviewFiles = (memoryPayload) => {
    const targets = extractTargetFilesFromOperations(memoryPayload) || [];
    return targets.some(name => /\.(html?|css|mjs|cjs|jsx?|tsx?)$/i.test(String(name || '')))
      || /\.(html?|css|js)$/i.test(String(getCtx()?.filename || ''));
  };

  const verifyPreviewAndRepairAfterApply = async ({ txt, activePlan, systemPrompt, effectiveIntent, autoApply, cleanHistory, profile, memoryPayload }) => {
    try {
      // Solo aplica a codigo que el preview puede ejecutar, y si hay HTML base.
      if (!payloadTouchesPreviewFiles(memoryPayload)) return;
      const hasHtml = (self.state?.filesList || []).some(file =>
        String(file?.type || '').toLowerCase() === 'html' || /\.html?$/i.test(String(file?.name || '')));
      if (!hasHtml) return;

      const errors = await runPreviewErrorScan();
      if (!errors.length) {
        iaToast('🧪 Verificado en preview: sin errores');
        return;
      }

      if (!autoApply) {
        addMsg('assistant', `🧪 El preview reporta ${errors.length} error(es) tras los cambios (auto-aplicar esta apagado, no reparo solo):\n${formatPreviewErrorReport(errors)}`, false);
        return;
      }

      // ── UN turno de reparacion, con ojos (read tools) ──
      const repairTyping = showTyping();
      setTypingProgress(repairTyping, {
        title: 'Reparando errores del preview',
        detail: `El preview reporto ${errors.length} error(es) en runtime. Corrigiendo antes de entregarte el resultado.`,
        badge: 'verificador'
      });
      let fixResult = null;
      let remaining = errors;
      try {
        const repairInput = `${buildTaskUserContent(txt, getCtx(), { kind: 'project', omitCode: true })}

VERIFICACION POST-EDICION: despues de aplicar los cambios, el preview ejecuto el proyecto y reporto estos errores de runtime:
${formatPreviewErrorReport(errors)}

Corrige SOLO lo necesario para eliminar estos errores con files.edits quirurgicos (search exacto o start_line/end_line). No rehagas nada que ya funciona, no cambies el diseño ni agregues features.${buildWorkspaceContext(getCtx(), profile, {
          forceWorkspace: true,
          intent: effectiveIntent,
          targetFiles: activePlan.targetFiles
        })}`;
        const fixer = await callClaudeWithTools(
          [...cleanHistory, { role: 'user', content: repairInput }],
          `${systemPrompt}\nEres el paso de VERIFICACION: tu unica meta es que el proyecto corra sin errores de runtime. Cambios minimos.`,
          { projectMode: true, requireFileEdits: true, timeoutMs: 60000, readTools: true, readToolRounds: 2 }
        );
        const safePayload = sanitizeProjectEditPayload(fixer.payload, getCtx(), {
          text: txt,
          intent: effectiveIntent,
          allowFullReplace: false,
          isBuildRequest: false,
          activeFileEmpty: false
        });
        const fixMemoryPayload = normalizeExecutableForMemory(safePayload, getCtx(), { projectMode: true });
        fixResult = applyProjectEdits(fixMemoryPayload, { autoApply: true });
        trackCost(repairInput, safeJSONStringify(safePayload));
        if (fixResult.totalApplied > 0) {
          remaining = await runPreviewErrorScan();
        }
      } finally {
        repairTyping?.remove();
      }

      if (fixResult?.totalApplied > 0 && !remaining.length) {
        addMsg('assistant', `🧪 Verificador: detecte ${errors.length} error(es) de runtime en el preview y los repare (${fixResult.totalApplied} cambio${fixResult.totalApplied !== 1 ? 's' : ''}). El preview ya corre limpio.`, false);
        iaToast('🧪 Errores del preview reparados');
        await appendFolderMemoryEvent({
          user: `[verificador] ${txt}`,
          assistant: `[preview-repair: ${fixResult.totalApplied} cambios]`,
          outcome: `Error de runtime reparado tras verificar en preview: ${shortText(errors.map(e => e.message).join(' | '), 180)}`,
          targetFiles: extractTargetFilesFromOperations(memoryPayload),
          success: true
        });
      } else {
        addMsg('assistant', `🧪 Verificador: el preview aun reporta ${remaining.length} error(es) tras un intento de reparacion. Los dejo aqui para que decidas:\n${formatPreviewErrorReport(remaining)}`, false);
        await appendFolderMemoryEvent({
          user: `[verificador] ${txt}`,
          assistant: '[preview-repair sin exito]',
          outcome: `Error de runtime pendiente detectado en preview: ${shortText(remaining.map(e => e.message).join(' | '), 180)}`,
          targetFiles: activePlan.targetFiles,
          success: false
        });
      }
    } catch (err) {
      // La verificacion es un extra: jamas debe romper el flujo del turno.
      console.warn('[LTH PROG] Verificacion de preview omitida:', err?.message || err);
    }
  };

  // ── Call Claude streaming (for chat/explanations) + retry on 429 ──
  const callClaudeStream = async (apiMessages, systemPrompt, onChunk, attempt = 0) => {
    const result = await callAnthropicBridge({
      maxTokens: 2048,
      system: systemPrompt,
      messages: apiMessages,
      timeoutMs: 90000
    }).catch((err) => {
      if (isRetryableAIError(err) && attempt < 3) return err;
      throw err;
    });

    if (result instanceof Error) {
      const waitMs = getRetryWaitMs(result, attempt);
      iaToast(`⏳ ${formatRetryableErrorLabel(result)}. Reintentando...`);
      await new Promise(r => setTimeout(r, waitMs));
      return callClaudeStream(apiMessages, systemPrompt, onChunk, attempt + 1);
    }

    const full = result.text || '';
    onChunk?.(full, full);
    return full;
  };

  // ── Apply edits to code ──
  const normalizeWS = (s) => s.replace(/\t/g, '  ').replace(/\r/g, '').replace(/ +$/gm, '');
  const collapseInlineWhitespace = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const applyLineRangeEdit = (source, edit) => {
    const start = Number(edit?.start_line ?? edit?.startLine);
    const end = Number(edit?.end_line ?? edit?.endLine ?? edit?.start_line ?? edit?.startLine);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < start) return null;

    const lines = String(source || '').split('\n');
    const from = Math.max(0, Math.min(lines.length, Math.floor(start) - 1));
    const to = Math.max(from, Math.min(lines.length, Math.floor(end)));
    const replacement = String(edit?.replace ?? '').replace(/^\d+\|\s?/gm, '');
    const next = [
      ...lines.slice(0, from),
      ...replacement.split('\n'),
      ...lines.slice(to)
    ].join('\n');

    return { result: next, from, to };
  };

  const applyEdits = (code, edits) => {
    let result = code;
    let applied = 0, failed = 0;
    const details = [];
    const orderedEdits = [...(edits || [])].sort((a, b) => {
      const aRangeOnly = !String(a?.search || '').trim() && Number(a?.start_line ?? a?.startLine);
      const bRangeOnly = !String(b?.search || '').trim() && Number(b?.start_line ?? b?.startLine);
      if (aRangeOnly && bRangeOnly) return Number(b.start_line ?? b.startLine) - Number(a.start_line ?? a.startLine);
      return 0;
    });
    for (const edit of orderedEdits) {
      // Strip line numbers if Claude included them (e.g. "42| code")
      const cleanSearch = String(edit.search || '').replace(/^\d+\|\s?/gm, '');
      const cleanReplace = String(edit.replace || '').replace(/^\d+\|\s?/gm, '');
      const failureBase = {
        searchPreview: shortText(cleanSearch.split('\n')[0] || '', 90),
        replacePreview: shortText(cleanReplace.split('\n')[0] || '', 90),
        searchLines: cleanSearch ? cleanSearch.split('\n').length : 0,
        replaceLines: cleanReplace ? cleanReplace.split('\n').length : 0
      };

      if (!cleanSearch.trim() && (edit.start_line || edit.startLine)) {
        const lineEdit = applyLineRangeEdit(result, edit);
        if (lineEdit) {
          result = lineEdit.result;
          applied++;
          details.push({
            ok:true,
            preview: `Lineas ${lineEdit.from + 1}-${lineEdit.to}`,
            lineRange:true,
            code:'line_range_applied',
            strategy:'line_range'
          });
          continue;
        }

        failed++;
        details.push({
          ok:false,
          preview:'Rango de líneas inválido',
          code:'invalid_line_range',
          reason:'Las líneas start/end no fueron válidas para el snapshot actual.',
          strategy:'line_range',
          ...failureBase
        });
        continue;
      }

      if (!cleanSearch.trim()) {
        // search VACÍO = la IA entrega el ARCHIVO COMPLETO. Lo inyectamos tal cual.
        // Clave para poblar el editor cuando esta vacio o crear el archivo desde cero
        // (comportamiento de agente estilo VS Code): la IA escribe, el editor lo recibe.
        if (cleanReplace.length) {
          result = cleanReplace;
          applied++;
          details.push({
            ok:true,
            preview: `Archivo completo (${cleanReplace.split('\n').length} líneas)`,
            code:'full_write',
            strategy:'full_content'
          });
          continue;
        }
        failed++;
        details.push({
          ok:false,
          preview:'Edit sin search ni contenido',
          code:'invalid_edit',
          reason:'La respuesta no trajo un search, un rango ni contenido para escribir.',
          strategy:'invalid',
          ...failureBase
        });
        continue;
      }

      // Try 1: exact match
      let idx = result.indexOf(cleanSearch);
      if (idx !== -1) {
        result = result.substring(0, idx) + cleanReplace + result.substring(idx + cleanSearch.length);
        applied++;
        details.push({
          ok:true,
          preview: (cleanReplace||'(eliminado)').split('\n')[0]?.substring(0,60),
          code:'exact_match',
          strategy:'exact'
        });
        continue;
      }

      // Try 2: normalized whitespace match
      const normCode = normalizeWS(result);
      const normSearch = normalizeWS(cleanSearch);
      idx = normCode.indexOf(normSearch);
      if (idx !== -1) {
        // Map back to original positions via line counting
        const linesBefore = normCode.substring(0, idx).split('\n').length - 1;
        const searchLineCount = normSearch.split('\n').length;
        const lines = result.split('\n');
        const before = lines.slice(0, linesBefore);
        const after = lines.slice(linesBefore + searchLineCount);
        result = [...before, cleanReplace, ...after].join('\n');
        applied++;
        details.push({
          ok:true,
          preview: (cleanReplace||'(eliminado)').split('\n')[0]?.substring(0,60),
          fuzzy:true,
          code:'normalized_whitespace_match',
          strategy:'normalized_whitespace'
        });
        continue;
      }

      // Try 3: trimmed line-by-line match
      const searchTrimmed = cleanSearch.split('\n').map(l=>l.trim()).join('\n');
      const codeTrimmed = result.split('\n').map(l=>l.trim()).join('\n');
      const fuzzyIdx = codeTrimmed.indexOf(searchTrimmed);
      if (fuzzyIdx !== -1) {
        const linesBefore = codeTrimmed.substring(0, fuzzyIdx).split('\n').length - 1;
        const searchLineCount = cleanSearch.split('\n').length;
        const lines = result.split('\n');
        const before = lines.slice(0, linesBefore);
        const after = lines.slice(linesBefore + searchLineCount);
        result = [...before, cleanReplace, ...after].join('\n');
        applied++;
        details.push({
          ok:true,
          preview: (cleanReplace||'(eliminado)').split('\n')[0]?.substring(0,60),
          fuzzy:true,
          code:'trimmed_line_match',
          strategy:'trimmed_line'
        });
        continue;
      }

      // Try 4: first+last line anchor match (for multi-line blocks)
      if (cleanSearch.includes('\n')) {
        const sLines = cleanSearch.split('\n');
        const firstLine = sLines[0].trim();
        const lastLine = sLines[sLines.length-1].trim();
        const cLines = result.split('\n');
        for (let i=0; i<cLines.length; i++) {
          if (cLines[i].trim() === firstLine) {
            for (let j=i+1; j<cLines.length && j<i+sLines.length+5; j++) {
              if (cLines[j].trim() === lastLine) {
                const before = cLines.slice(0, i);
                const after = cLines.slice(j+1);
                result = [...before, cleanReplace, ...after].join('\n');
                applied++;
                details.push({
                  ok:true,
                  preview: (cleanReplace||'(eliminado)').split('\n')[0]?.substring(0,60),
                  fuzzy:true,
                  code:'anchor_match',
                  strategy:'anchor'
                });
                break;
              }
            }
            if (details.length === applied + failed) break; // found
          }
        }
        if (details.length > applied + failed - 1 && details[details.length-1]?.ok) continue;
      }

      // Try 5: collapsed single-line whitespace match
      if (!cleanSearch.includes('\n')) {
        const wantedLine = collapseInlineWhitespace(cleanSearch);
        const resultLines = result.split('\n');
        const matchedLineIndex = resultLines.findIndex(line => collapseInlineWhitespace(line) === wantedLine);
        if (matchedLineIndex !== -1) {
          resultLines[matchedLineIndex] = cleanReplace;
          result = resultLines.join('\n');
          applied++;
          details.push({
            ok:true,
            preview: (cleanReplace||'(eliminado)').split('\n')[0]?.substring(0,60),
            fuzzy:true,
            code:'collapsed_whitespace_line_match',
            strategy:'collapsed_whitespace'
          });
          continue;
        }
      }

      failed++;
      details.push({
        ok:false,
        preview: cleanSearch.split('\n')[0]?.substring(0,50) || '?',
        code:'pattern_not_found',
        reason:'No se encontró el patrón en el snapshot actual del archivo.',
        strategy:'exact>normalized_whitespace>trimmed_line>anchor>collapsed_whitespace',
        ...failureBase
      });
    }
    return { result, applied, failed, details };
  };

  const normalizeProjectRef = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\//g, '\\');

  const pathIsAbsoluteLike = (value) => /^[a-z]:[\\/]/i.test(String(value || '').trim())
    || /^[/\\]{1,2}/.test(String(value || '').trim());

  const resolveProjectFile = (ref) => {
    const wanted = normalizeProjectRef(ref);
    const activeRecord = getActiveFileRecord();
    const activeName = normalizeProjectRef(getVisibleActiveFileName());
    const activeCtx = () => {
      const ctx = getCtx();
      return {
        id: '__active__',
        name: ctx.filename || 'archivo-activo.html',
        type: String(ctx.type || 'html').toLowerCase(),
        path: null,
        content: ctx.code || '',
        savedContent: ctx.code || '',
        virtualActive: true
      };
    };
    if (!wanted || wanted === '__active__' || wanted === 'archivo' || wanted === 'archivo actual' || wanted === 'archivo-activo.html' || wanted === 'sin archivo') {
      return activeRecord || activeCtx();
    }
    const basename = wanted.split('\\').pop();
    const found = (self.state?.filesList || []).find((file) => {
      const id = normalizeProjectRef(file.id);
      const name = normalizeProjectRef(file.name);
      const relativePath = normalizeProjectRef(file.workspaceRelativePath || file.relativePath);
      const path = normalizeProjectRef(file.path);
      return id === wanted
        || name === wanted
        || relativePath === wanted
        || path === wanted
        || name === basename
        || relativePath.endsWith(`\\${basename}`)
        || path.endsWith(`\\${basename}`);
    }) || null;
    if (found) return found;
    if (activeRecord && (activeName === wanted || activeName === basename || !self.state?.filesList?.length)) return activeRecord;
    if (!self.state?.filesList?.length) return activeCtx();
    return null;
  };

  const sanitizeProjectFileName = (name) => String(name || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/[<>:"|?*\x00-\x1F]/g, '')
    .split('/')
    .map(part => part.trim().replace(/\s+/g, ' '))
    .filter(part => part && part !== '.' && part !== '..')
    .join('/');

  const getProjectExt = (name) => (String(name || '').split('.').pop() || '').toLowerCase();
  const projectExtToType = (ext) => (
    isSupportedTextFile({ name: ext ? `file.${ext}` : 'Dockerfile', size: 0 })
      ? fileNameToEditorType(ext ? `file.${ext}` : 'Dockerfile')
      : ''
  );

  const validateProjectFileName = (rawName, currentFile = null) => {
    const name = sanitizeProjectFileName(rawName);
    const ext = getProjectExt(name);
    const type = projectExtToType(ext);
    if (!name || name.length > 180 || pathIsAbsoluteLike(name) || !type) {
      return { ok:false, name, type, error:'Nombre o extension no soportada' };
    }
    const displayName = name.split('/').pop() || name;
    const duplicate = (self.state?.filesList || []).some(file =>
      file.id !== currentFile?.id &&
      (
        normalizeProjectRef(file.workspaceRelativePath || file.relativePath || file.name) === normalizeProjectRef(name)
        || (!name.includes('/') && String(file.name || '').trim().toLowerCase() === name.toLowerCase())
      )
    );
    if (duplicate) return { ok:false, name, type, error:'Ya existe un archivo con ese nombre' };
    return { ok:true, name, displayName, type };
  };

  const makeProjectFilePath = (name) => {
    const base = String(self.state?.folderPath || '').replace(/[\\/]+$/, '');
    const relative = String(name || '').replace(/\//g, '\\').replace(/^[\\/]+/, '');
    return base ? `${base}\\${relative}` : null;
  };

  const getAutoAiWorkspacePath = () => {
    const base = String(_ProgFS._projDir?.() || _ProgFS._appDataDir?.('lth-prog') || '').replace(/[\\/]+$/, '');
    return base ? `${base}\\app` : '';
  };

  const writeTextFileSafe = async (filePath, content = '') => {
    if (!filePath || !window.electron?.fs?.writeFile) return { success: false, error: 'No hay ruta de escritura' };
    const result = await window.electron.fs.writeFile(filePath, String(content ?? ''));
    if (result?.success === false) throw new Error(result.error || 'No se pudo escribir archivo');
    return result || { success: true };
  };

  const ensureAiWorkspaceFolder = async () => {
    if (self.state?.workspaceMode === 'folder' && self.state?.folderPath) return self.state.folderPath;
    const folder = getAutoAiWorkspacePath();
    if (!folder) return '';
    try { await window.electron?.fs?.createFolder?.(folder, { recursive: true }); } catch {}
    self.state.workspaceMode = 'folder';
    self.state.currentProject = null;
    self.state.folderPath = folder;
    self.state.expandedFolderPaths = Array.from(new Set([...(self.state.expandedFolderPaths || []), folder]));
    self.state.folderMemoryPath = getFolderMemoryPath(folder);
    self.state.folderMemoryContext = self.state.folderMemoryContext || '';
    return folder;
  };

  const materializeFileOnDisk = async (file, contentOverride) => {
    if (!file) return null;
    const folder = await ensureAiWorkspaceFolder();
    if (!folder) return null;
    const relative = normalizeRelativePath(file.workspaceRelativePath || file.relativePath || file.name || 'index.html');
    const safeRelative = sanitizeProjectFileName(relative) || sanitizeProjectFileName(file.name) || 'index.html';
    const filePath = file.path || makeProjectFilePath(safeRelative);
    if (!filePath) return null;
    file.path = filePath;
    file.relativePath = normalizeRelativePath(safeRelative);
    file.workspaceRelativePath = normalizeRelativePath(safeRelative);
    file.externalFolder = folder;
    const content = String(contentOverride ?? file.content ?? '');
    await writeTextFileSafe(filePath, content);
    const indexed = {
      name: file.name,
      path: filePath,
      relativePath: normalizeRelativePath(safeRelative),
      size: content.length,
      isDirectory: false
    };
    const key = normalizePathKey(filePath);
    const nextIndex = (self.state.folderFilesIndex || []).filter(item => normalizePathKey(item.path) !== key);
    nextIndex.push(indexed);
    self.state.folderFilesIndex = nextIndex;
    if (!self.state.folderTree || normalizePathKey(self.state.folderTree.path) !== normalizePathKey(folder)) {
      self.state.folderTree = {
        name: folder.split(/[\\/]/).pop() || 'app',
        path: folder,
        relativePath: '',
        isDirectory: true,
        children: nextIndex.map(item => ({ ...item }))
      };
    }
    return filePath;
  };

  const normalizeProjectOperations = (payload) => {
    if (Array.isArray(payload)) {
      return { files: payload, replaceFiles: [], createFiles: [], renameFiles: [], deleteFiles: [] };
    }
    return {
      files: Array.isArray(payload?.files) ? payload.files : [],
      replaceFiles: Array.isArray(payload?.replace_files) ? payload.replace_files : (Array.isArray(payload?.replaceFiles) ? payload.replaceFiles : []),
      createFiles: Array.isArray(payload?.create_files) ? payload.create_files : (Array.isArray(payload?.createFiles) ? payload.createFiles : []),
      renameFiles: Array.isArray(payload?.rename_files) ? payload.rename_files : (Array.isArray(payload?.renameFiles) ? payload.renameFiles : []),
      deleteFiles: Array.isArray(payload?.delete_files) ? payload.delete_files : (Array.isArray(payload?.deleteFiles) ? payload.deleteFiles : [])
    };
  };

  const hasProjectToolWork = (payload) => {
    const ops = normalizeProjectOperations(payload);
    return ops.files.some(change => Array.isArray(change?.edits) && change.edits.length)
      || ops.replaceFiles.length
      || ops.createFiles.length
      || ops.renameFiles.length
      || ops.deleteFiles.length;
  };

  const allowsFullReplaceRequest = (text) => EXPLICIT_FULL_REWRITE_RE.test(String(text || ''));

  const shouldTreatAsBuildRequest = (text, ctx = getCtx(), intentMeta = detectIntentMeta(text, ctx)) => {
    const raw = String(text || '').trim();
    if (!raw || intentMeta?.readOnly) return false;
    if (intentMeta?.wantsProjectOperation) return false;
    if (EXPLICIT_FULL_REWRITE_RE.test(raw)) return true;

    const workspaceFiles = (self.state?.filesList || []).length;
    const activeCode = String(ctx?.code || '').trim();
    const activeLooksEmpty = activeCode.length < 24;

    if (!activeLooksEmpty) return false;
    if (!BUILD_FROM_SCRATCH_RE.test(raw)) return false;

    return workspaceFiles === 0
      || WEB_BOOTSTRAP_RE.test(raw)
      || /\.(html?|css|js|py|json)$/i.test(String(ctx?.filename || ''));
  };

  const shouldEnableAgentLoop = (text, options = {}) => {
    const raw = String(text || '').trim();
    if (!raw) return false;
    if (AGENT_LOOP_RE.test(raw)) return true;
    return options.isBuildRequest === true && options.activeFileEmpty === true;
  };

  const inferAiStarterFiles = (text) => {
    const raw = String(text || '').trim();
    const lower = raw.toLowerCase();
    const explicitFile = raw.match(/\b([\w.-]+\.(?:html?|css|js|mjs|cjs|jsx|ts|tsx|py|json|md|txt|sql|cpp|cc|cxx|c|h|hpp|cs|java|kt|swift|go|rs|php|rb|dart|sh|ps1))\b/i)?.[1];
    if (explicitFile && isSupportedTextFile({ name: explicitFile, size: 0 })) {
      return [{ name: explicitFile, type: fileNameToEditorType(explicitFile), content: '' }];
    }
    if (WEB_BOOTSTRAP_RE.test(raw)) {
      return [
      {
        id: `html-${Date.now()}`,
        name: 'index.html',
        type: 'html',
        path: null,
        content: `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nueva pagina</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <main class="page">
    <section class="hero">
      <span class="eyebrow">LTH PROG</span>
      <h1>Tu nueva pagina empieza aqui</h1>
      <p>Pidele a la IA cambios sobre este proyecto y editara estos archivos en vez de rehacer todo desde cero.</p>
      <button class="hero-btn" type="button">Empezar</button>
    </section>
  </main>

  <script src="app.js"></script>
</body>
</html>`
      },
      {
        id: `css-${Date.now() + 1}`,
        name: 'styles.css',
        type: 'css',
        path: null,
        content: `:root {
  color-scheme: light;
  font-family: "Segoe UI", sans-serif;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  min-height: 100vh;
  background: linear-gradient(180deg, #eef4ff 0%, #ffffff 100%);
  color: #111827;
}

.page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 32px 20px;
}

.hero {
  width: min(680px, 100%);
  padding: 32px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.12);
}

.eyebrow {
  display: inline-block;
  margin-bottom: 12px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #4f46e5;
}

.hero h1 {
  margin: 0 0 12px;
  font-size: clamp(2rem, 5vw, 3.5rem);
  line-height: 1.02;
}

.hero p {
  margin: 0 0 20px;
  line-height: 1.6;
  color: #475569;
}

.hero-btn {
  border: 0;
  border-radius: 999px;
  padding: 12px 18px;
  background: #111827;
  color: #fff;
  font: inherit;
  cursor: pointer;
}`
      },
      {
        id: `js-${Date.now() + 2}`,
        name: 'app.js',
        type: 'js',
        path: null,
        content: `document.querySelector('.hero-btn')?.addEventListener('click', () => {
  console.log('LTH PROG listo para seguir editando este proyecto.');
});`
      }
      ];
    }
    const languageStarters = [
      { re: /\b(c\+\+|cpp|cplusplus)\b/i, name: 'main.cpp', type: 'cpp' },
      { re: /\b(c#|csharp|\.net)\b/i, name: 'Program.cs', type: 'csharp' },
      { re: /\bpython|py\b/i, name: 'main.py', type: 'py' },
      { re: /\b(java)\b/i, name: 'Main.java', type: 'java' },
      { re: /\b(kotlin)\b/i, name: 'Main.kt', type: 'kotlin' },
      { re: /\b(swift|ios)\b/i, name: 'App.swift', type: 'swift' },
      { re: /\b(golang|go)\b/i, name: 'main.go', type: 'go' },
      { re: /\b(rust)\b/i, name: 'main.rs', type: 'rust' },
      { re: /\b(php)\b/i, name: 'index.php', type: 'php' },
      { re: /\b(ruby)\b/i, name: 'main.rb', type: 'ruby' },
      { re: /\b(dart|flutter)\b/i, name: 'main.dart', type: 'dart' },
      { re: /\b(sql|database|base de datos)\b/i, name: 'schema.sql', type: 'sql' },
      { re: /\b(shell|bash|script)\b/i, name: 'script.sh', type: 'shell' },
      { re: /\b(json)\b/i, name: 'data.json', type: 'json' },
      { re: /\b(markdown|readme|documentaci[oó]n)\b/i, name: 'README.md', type: 'md' },
      { re: /\b(typescript|ts)\b/i, name: 'app.ts', type: 'js' },
      { re: /\b(javascript|js)\b/i, name: 'app.js', type: 'js' }
    ];
    const match = languageStarters.find(item => item.re.test(lower));
    return match ? [{ name: match.name, type: match.type, content: '' }] : [];
  };

  const ensureActiveFileMaterializedForAi = async (text, ctx = {}) => {
    const active = getActiveFileRecord();
    if (!active || active.path) return false;
    const inferred = inferAiStarterFiles(text)[0] || null;
    const currentName = String(active.name || '').trim().toLowerCase();
    const genericName = !currentName
      || /^(archivo-activo|sin-nombre|untitled|nuevo-archivo)(\.[a-z0-9]+)?$/i.test(currentName);
    const activeEmpty = !String(ctx.code ?? active.content ?? '').trim();
    if (inferred && activeEmpty && (genericName || active.type !== inferred.type)) {
      active.name = inferred.name;
      active.type = inferred.type;
      active.relativePath = normalizeRelativePath(inferred.name);
      active.workspaceRelativePath = normalizeRelativePath(inferred.name);
    }
    await materializeFileOnDisk(active, active.content || '');
    self._syncLegacyFiles?.();
    self._renderDynamicTabs?.();
    self._renderFileExplorer?.();
    self._persistSessionMeta?.();
    return true;
  };

  const ensureWebStarterWorkspace = async (text) => {
    const raw = String(text || '').trim();
    if (!raw) return false;
    if ((self.state?.filesList || []).length > 0) return false;
    if (!BUILD_FROM_SCRATCH_RE.test(raw)) return false;

    const rawStarterFiles = inferAiStarterFiles(raw);
    if (!rawStarterFiles.length) return false;
    const folder = await ensureAiWorkspaceFolder();

    const starterFiles = rawStarterFiles.map(file => hydrateFileRecord({
      ...file,
      id: file.id || `${file.type || fileNameToEditorType(file.name)}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
      path: folder ? `${String(folder).replace(/[\\/]+$/, '')}\\${String(file.name).replace(/\//g, '\\')}` : null,
      relativePath: normalizeRelativePath(file.name),
      workspaceRelativePath: normalizeRelativePath(file.name),
      externalFolder: folder || null
    }, {
      officialContent: file.content,
      hasOfficialSource: true
    }));

    self.state.filesList = starterFiles;
    self.state.hiddenFiles = [];
    self.state.activeFileId = starterFiles[0].id;
    self.state.editorTab = 'html';

    for (const file of starterFiles) {
      try { await materializeFileOnDisk(file, file.content || ''); } catch {}
      persistFileState(file);
    }
    self._syncLegacyFiles?.();
    self._renderDynamicTabs?.();
    self._renderFileExplorer?.();
    openFileById(starterFiles[0].id, { skipCapture: true, restoreView: true, queueLive: true });
    persistSessionMeta();
    self.refreshLive?.(container, true);
    self.showNotification(starterFiles.length > 1
      ? '🧩 Base web creada con archivos reales'
      : `🧩 Archivo real creado para IA: ${starterFiles[0].name}`);
    return true;
  };

  const stripProjectFullReplacements = (payload) => {
    const ops = normalizeProjectOperations(payload);
    return {
      files: ops.files,
      create_files: ops.createFiles,
      rename_files: ops.renameFiles,
      delete_files: ops.deleteFiles,
      replace_files: []
    };
  };

  const getProjectFileSnapshot = (ref) => {
    const file = resolveProjectFile(ref);
    if (!file) return '';
    const isActive = file.virtualActive || file.id === self.state?.activeFileId;
    return isActive ? (getCtx().editor?.getValue?.() || file.content || '') : (file.content || '');
  };

  const isBroadVisualEdit = (edit, fileCode = '') => {
    const code = String(fileCode || '');
    if (!code.trim()) return false;

    const cleanSearch = String(edit?.search || '').replace(/^\d+\|\s?/gm, '').trim();
    const cleanReplace = String(edit?.replace || '').replace(/^\d+\|\s?/gm, '').trim();
    const totalLines = Math.max(1, code.split('\n').length);

    if (cleanSearch && /^(<\/style>|<\/head>|<body[^>]*>|<\/body>)$/i.test(cleanSearch)) return false;

    if (!cleanSearch && (edit.start_line || edit.startLine)) {
      const start = Number(edit.start_line ?? edit.startLine);
      const end = Number(edit.end_line ?? edit.endLine ?? start);
      const span = Math.max(1, end - start + 1);
      return (span / totalLines) >= 0.45;
    }

    if (!cleanSearch) return false;

    const searchLines = cleanSearch.split('\n').length;
    const replaceLines = cleanReplace ? cleanReplace.split('\n').length : 0;
    const searchRatio = cleanSearch.length / Math.max(1, code.length);
    const lineRatio = searchLines / totalLines;
    return searchRatio >= 0.45 || lineRatio >= 0.45 || replaceLines >= Math.max(32, Math.floor(totalLines * 0.5));
  };

  const stripBroadVisualProjectEdits = (payload, ctx = getCtx()) => {
    const ops = normalizeProjectOperations(payload);
    const files = ops.files
      .map((change) => {
        const fileRef = change?.file || change?.name || ctx.filename || '__active__';
        const snapshot = getProjectFileSnapshot(fileRef);
        const safeEdits = (Array.isArray(change?.edits) ? change.edits : [])
          .filter(edit => !isBroadVisualEdit(edit, snapshot));
        return safeEdits.length ? { ...change, file: fileRef, edits: safeEdits } : null;
      })
      .filter(Boolean);

    return {
      files,
      create_files: cloneJSON(ops.createFiles, []),
      rename_files: cloneJSON(ops.renameFiles, []),
      delete_files: cloneJSON(ops.deleteFiles, []),
      replace_files: []
    };
  };

  const getLargeRewriteRiskMeta = (text, ctx = getCtx(), options = {}) => {
    const code = String(ctx?.code || '');
    const hasCode = code.trim().length > 24;
    const lines = hasCode ? code.split('\n').length : 0;
    const chars = code.length;
    const fileCount = Math.max(1, (self.state?.filesList || []).length);
    const explicitFullRewrite = options.allowFullReplace === true
      || options.isBuildRequest === true
      || options.activeFileEmpty === true
      || allowsFullReplaceRequest(text);
    const largeByLines = lines >= 260;
    const largeByChars = chars >= 18000;
    const largeMultiFile = fileCount > 1 && lines >= FOCUS_MIN_LINES;
    const protect = hasCode && !explicitFullRewrite && (largeByLines || largeByChars || largeMultiFile);
    return {
      protect,
      lines,
      chars,
      fileCount,
      explicitFullRewrite,
      file: ctx?.filename || 'archivo activo'
    };
  };

  const buildLargeRewriteGuardBlock = (text, ctx = getCtx(), options = {}) => {
    const risk = getLargeRewriteRiskMeta(text, ctx, options);
    if (!risk.protect) return '';
    return `\nGUARDIA DE PROYECTO GRANDE: el archivo activo "${risk.file}" tiene ${risk.lines} líneas y el workspace tiene ${risk.fileCount} archivo(s). Trátalo como proyecto existente: aplica cambios quirúrgicos con files.edits, conserva nombres, estructura, textos, estilos y funcionalidad no solicitados. No uses replace_files ni reemplaces <style>, <body> o todo el HTML/CSS/JS para una solicitud puntual. Si el cambio parece estructural, divídelo en pasos y aplica solo el primer bloque necesario.`;
  };

  const stripBroadProtectedProjectEdits = (payload, ctx = getCtx()) => {
    const ops = normalizeProjectOperations(payload);
    const files = ops.files
      .map((change) => {
        const fileRef = change?.file || change?.name || ctx.filename || '__active__';
        const snapshot = getProjectFileSnapshot(fileRef);
        const safeEdits = (Array.isArray(change?.edits) ? change.edits : [])
          .filter(edit => !isBroadVisualEdit(edit, snapshot));
        return safeEdits.length ? { ...change, file: fileRef, edits: safeEdits } : null;
      })
      .filter(Boolean);

    return {
      files,
      create_files: cloneJSON(ops.createFiles, []),
      rename_files: cloneJSON(ops.renameFiles, []),
      delete_files: cloneJSON(ops.deleteFiles, []),
      replace_files: []
    };
  };

  const sanitizeProjectEditPayload = (payload, ctx = getCtx(), options = {}) => {
    const risk = getLargeRewriteRiskMeta(options.text || '', ctx, options);
    let next = payload || {};
    if (!options.allowFullReplace || risk.protect) next = stripProjectFullReplacements(next);
    if (risk.protect) return stripBroadProtectedProjectEdits(next, ctx);
    if (options.intent === 'visual_edit' && !options.allowFullReplace) return stripBroadVisualProjectEdits(next, ctx);
    return next;
  };

  const buildProtectedRewriteDiagnostic = (text, ctx = getCtx(), err = null) => {
    const risk = getLargeRewriteRiskMeta(text, ctx, { allowFullReplace: false });
    return {
      code: 'protected_large_file_timeout',
      reason: `El patch tardó demasiado y se evitó reemplazar automáticamente ${risk.file} (${risk.lines} líneas).`,
      file: risk.file,
      pattern: 'patch quirúrgico por secciones',
      invalidEdits: 0,
      responsePreview: shortText(err?.message || 'Sin cambios aplicados; reintenta con un objetivo más localizado o deja que la IA edite por secciones.', 280),
      details: [],
      canRetry: true,
      retryStrategy: 'surgical_section_patch',
      headline: 'Patch protegido: no se hizo reemplazo completo automático',
      updatedAt: Date.now()
    };
  };

  const markProjectFileDirty = (file, content) => {
    if (!file) return;
    if (file.virtualActive) {
      getCtx().editor?.setValue?.(content || '');
      return;
    }
    file.content = content;
    file.draftUpdatedAt = Date.now();
    file.isDirty = hasMeaningfulContentChange(file.content, file.savedContent ?? '');
    self._persistFileState?.(file);
  };

  const refreshProjectChrome = () => {
    self._syncLegacyFiles?.();
    self._persistSessionMeta?.();
    self._renderDynamicTabs?.();
    self._renderFileExplorer?.();
    self.refreshLive?.(container, true);
    updateCtxBar();
  };

  const applyProjectEdits = (fileChanges, { autoApply = true } = {}) => {
    self._saveCurrentTabContent?.();
    const operations = normalizeProjectOperations(fileChanges);
    const structuralCount = operations.createFiles.length + operations.renameFiles.length + operations.deleteFiles.length;
    const effectiveAutoApply = autoApply && structuralCount === 0;

    const normalized = operations.files
      .map(change => ({
        file: change?.file || change?.name || change?.path || change?.id || '',
        edits: Array.isArray(change?.edits) ? change.edits : []
      }))
      .filter(change => change.file && change.edits.length);

    const results = [];
    const snapshots = [];
    const structuralOps = [];
    let totalApplied = 0;
    let totalFailed = 0;

    operations.replaceFiles.forEach((entry) => {
      const file = resolveProjectFile(entry?.file);
      if (!file) {
        totalFailed++;
        results.push({ ok:false, file: entry?.file || 'reemplazar', applied:0, failed:1, details:[{ ok:false, preview:'Archivo no encontrado', code:'wrong_file', reason:'El archivo objetivo no existe o no coincide con el workspace abierto.' }] });
        return;
      }

      const isActive = file.id === self.state?.activeFileId;
      const oldContent = isActive ? (getCtx().editor?.getValue?.() || file.content || '') : (file.content || '');
      const newContent = String(entry?.content ?? '');
      if (newContent === oldContent) {
        results.push({ ok:false, file: file.name, applied:0, failed:1, details:[{ ok:false, preview:'El contenido nuevo es igual al actual', code:'same_content', reason:'El replace completo no cambia nada respecto al snapshot actual.' }] });
        totalFailed++;
        return;
      }

      snapshots.push({ file, oldContent, newContent, wasActive: isActive, fullReplace: true });
      totalApplied++;
      results.push({ ok:true, file: file.name, applied:1, failed:0, details:[{ ok:true, preview:'Reemplazo completo' }] });
    });

    normalized.forEach((change) => {
      const file = resolveProjectFile(change.file);
      if (!file) {
        totalFailed += change.edits.length || 1;
        results.push({ ok:false, file: change.file, applied:0, failed:change.edits.length || 1, details:[{ ok:false, preview:'Archivo no encontrado', code:'wrong_file', reason:'El archivo objetivo no existe o no coincide con el workspace abierto.' }] });
        return;
      }

      const isActive = file.id === self.state?.activeFileId;
      const oldContent = isActive ? (getCtx().editor?.getValue?.() || file.content || '') : (file.content || '');
      const appliedResult = applyEdits(oldContent, change.edits);
      totalApplied += appliedResult.applied;
      totalFailed += appliedResult.failed;
      results.push({ ok: appliedResult.applied > 0 && appliedResult.failed === 0, file: file.name, fileId: file.id, oldContent, ...appliedResult });

      if (appliedResult.applied > 0) {
        snapshots.push({ file, oldContent, newContent: appliedResult.result, wasActive: isActive });
      }
    });

    operations.createFiles.forEach((entry) => {
      const validation = validateProjectFileName(entry?.name);
      if (!validation.ok) {
        totalFailed++;
        results.push({ ok:false, file: entry?.name || 'nuevo archivo', applied:0, failed:1, details:[{ ok:false, preview:validation.error, code:'invalid_file_name', reason:validation.error }] });
        return;
      }

      const content = String(entry?.content ?? '');
      const newFile = {
        id: `${validation.type}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        name: validation.displayName,
        type: validation.type,
        path: makeProjectFilePath(validation.name),
        relativePath: normalizeRelativePath(validation.name),
        workspaceRelativePath: normalizeRelativePath(validation.name),
        externalFolder: self.state?.folderPath || null,
        content,
        savedContent: '',
        savedAt: Date.now(),
        draftUpdatedAt: Date.now(),
        isDirty: content.length > 0
      };
      structuralOps.push({ type:'create', file: newFile });
      totalApplied++;
      results.push({ ok:true, file: validation.name, applied:1, failed:0, details:[{ ok:true, preview:'Crear archivo' }] });
    });

    operations.renameFiles.forEach((entry) => {
      const file = resolveProjectFile(entry?.file);
      if (!file) {
        totalFailed++;
        results.push({ ok:false, file: entry?.file || 'renombrar', applied:0, failed:1, details:[{ ok:false, preview:'Archivo no encontrado', code:'wrong_file', reason:'El archivo objetivo no existe o no coincide con el workspace abierto.' }] });
        return;
      }
      const validation = validateProjectFileName(entry?.new_name, file);
      if (!validation.ok) {
        totalFailed++;
        results.push({ ok:false, file: file.name, applied:0, failed:1, details:[{ ok:false, preview:validation.error, code:'invalid_file_name', reason:validation.error }] });
        return;
      }
      structuralOps.push({
        type:'rename',
        file,
        oldName: file.name,
        oldType: file.type,
        oldPath: file.path || null,
        oldRelativePath: file.workspaceRelativePath || file.relativePath || file.name,
        newName: validation.displayName,
        newType: validation.type,
        newRelativePath: normalizeRelativePath(validation.name),
        newPath: file.path ? makeProjectFilePath(validation.name) : null
      });
      totalApplied++;
      results.push({ ok:true, file: `${file.name} -> ${validation.name}`, applied:1, failed:0, details:[{ ok:true, preview:'Renombrar archivo' }] });
    });

    operations.deleteFiles.forEach((entry) => {
      const file = resolveProjectFile(entry?.file);
      if (!file) {
        totalFailed++;
        results.push({ ok:false, file: entry?.file || 'borrar', applied:0, failed:1, details:[{ ok:false, preview:'Archivo no encontrado', code:'wrong_file', reason:'El archivo objetivo no existe o no coincide con el workspace abierto.' }] });
        return;
      }
      const list = self.state?.filesList || [];
      if (list.length <= 1) {
        totalFailed++;
        results.push({ ok:false, file: file.name, applied:0, failed:1, details:[{ ok:false, preview:'No se puede borrar el unico archivo', code:'delete_blocked', reason:'No se puede dejar el proyecto sin archivos.' }] });
        return;
      }
      if (file.type === 'html' && list.filter(item => item.type === 'html').length <= 1) {
        totalFailed++;
        results.push({ ok:false, file: file.name, applied:0, failed:1, details:[{ ok:false, preview:'Debe quedar al menos un HTML', code:'delete_blocked', reason:'Debe quedar al menos un archivo HTML en el proyecto.' }] });
        return;
      }
      structuralOps.push({
        type:'delete',
        file,
        index: Math.max(0, list.findIndex(item => item.id === file.id)),
        wasActive: file.id === self.state?.activeFileId
      });
      totalApplied++;
      results.push({ ok:true, file: file.name, applied:1, failed:0, details:[{ ok:true, preview:entry?.reason || 'Borrar archivo' }] });
    });

    const commit = () => {
      snapshots.forEach((snapshot) => {
        markProjectFileDirty(snapshot.file, snapshot.newContent);
        if (snapshot.file.id === self.state?.activeFileId) {
          getCtx().editor?.setValue?.(snapshot.newContent);
        }
      });
      structuralOps.forEach((op) => {
        if (op.type === 'create') {
          if (!self.state.filesList) self.state.filesList = [];
          self.state.filesList.push(op.file);
          self.state.hiddenFiles = (self.state.hiddenFiles || []).filter(id => id !== op.file.id);
          markProjectFileDirty(op.file, op.file.content || '');
        } else if (op.type === 'rename') {
          op.file.name = op.newName;
          op.file.type = op.newType;
          op.file.relativePath = op.newRelativePath || op.newName;
          op.file.workspaceRelativePath = op.newRelativePath || op.newName;
          if (op.newPath) op.file.path = op.newPath;
          markProjectFileDirty(op.file, op.file.content || '');
        } else if (op.type === 'delete') {
          self.state.filesList = (self.state.filesList || []).filter(file => file.id !== op.file.id);
          self.state.hiddenFiles = (self.state.hiddenFiles || []).filter(id => id !== op.file.id);
          self._removeStoredFileState?.(op.file);
        }
      });
      if (!(self.state?.filesList || []).some(file => file.id === self.state?.activeFileId)) {
        const next = (self.state?.filesList || []).find(file => !(self.state.hiddenFiles || []).includes(file.id))
          || (self.state?.filesList || [])[0];
        if (next) self._openFileById?.(next.id, { skipCapture:true, restoreView:true, queueLive:true });
      }
      refreshProjectChrome();
    };

    const undo = () => {
      structuralOps.slice().reverse().forEach((op) => {
        if (op.type === 'create') {
          self.state.filesList = (self.state.filesList || []).filter(file => file.id !== op.file.id);
          self.state.hiddenFiles = (self.state.hiddenFiles || []).filter(id => id !== op.file.id);
          self._removeStoredFileState?.(op.file);
        } else if (op.type === 'rename') {
          op.file.name = op.oldName;
          op.file.type = op.oldType;
          op.file.path = op.oldPath;
          op.file.relativePath = op.oldRelativePath || op.oldName;
          op.file.workspaceRelativePath = op.oldRelativePath || op.oldName;
          markProjectFileDirty(op.file, op.file.content || '');
        } else if (op.type === 'delete') {
          if (!(self.state.filesList || []).some(file => file.id === op.file.id)) {
            const nextList = self.state.filesList || [];
            nextList.splice(Math.min(op.index, nextList.length), 0, op.file);
            self.state.filesList = nextList;
          }
          markProjectFileDirty(op.file, op.file.content || '');
        }
      });
      snapshots.forEach((snapshot) => {
        markProjectFileDirty(snapshot.file, snapshot.oldContent);
        if (snapshot.file.id === self.state?.activeFileId) {
          getCtx().editor?.setValue?.(snapshot.oldContent);
        }
      });
      if (!(self.state?.filesList || []).some(file => file.id === self.state?.activeFileId)) {
        const next = (self.state?.filesList || [])[0];
        if (next) self._openFileById?.(next.id, { skipCapture:true, restoreView:true, queueLive:true });
      }
      refreshProjectChrome();
    };

    if (effectiveAutoApply) commit();

    return {
      results,
      snapshots,
      structuralOps,
      totalApplied,
      totalFailed,
      changedFiles: new Set([
        ...snapshots.map(snapshot => snapshot.file?.id || snapshot.file?.name),
        ...structuralOps.map(op => op.file?.id || op.file?.name)
      ].filter(Boolean)).size,
      hasStructuralChanges: structuralCount > 0,
      effectiveAutoApply,
      commit,
      undo
    };
  };

  const extractTargetFilesFromOperations = (payload) => {
    const ops = normalizeProjectOperations(payload);
    return uniqStrings([
      ...ops.files.map(change => change?.file || ''),
      ...ops.replaceFiles.map(change => change?.file || ''),
      ...ops.createFiles.map(change => change?.name || ''),
      ...ops.renameFiles.map(change => change?.file || change?.new_name || ''),
      ...ops.deleteFiles.map(change => change?.file || '')
    ]).slice(0, 10);
  };

  const normalizeExecutableForMemory = (payload, ctx, options = {}) => {
    if (options.projectMode) {
      const ops = normalizeProjectOperations(payload);
      return {
        files: cloneJSON(ops.files, []),
        replace_files: cloneJSON(ops.replaceFiles, []),
        create_files: cloneJSON(ops.createFiles, []),
        rename_files: cloneJSON(ops.renameFiles, []),
        delete_files: cloneJSON(ops.deleteFiles, [])
      };
    }

    const edits = Array.isArray(payload) ? cloneJSON(payload, []) : [];
    return {
      files: edits.length ? [{ file: ctx.filename || '__active__', edits }] : [],
      replace_files: [],
      create_files: [],
      rename_files: [],
      delete_files: []
    };
  };

  const retargetExecutablePayload = (payload, targetFiles = []) => {
    const primaryTarget = Array.isArray(targetFiles) ? targetFiles[0] : '';
    if (!payload || !primaryTarget) return cloneJSON(payload, payload);
    const ops = normalizeProjectOperations(cloneJSON(payload, {}));
    if (ops.files.length === 1) ops.files[0].file = primaryTarget;
    if (ops.replaceFiles.length === 1) ops.replaceFiles[0].file = primaryTarget;
    if (ops.renameFiles.length === 1) ops.renameFiles[0].file = primaryTarget;
    if (ops.deleteFiles.length === 1) ops.deleteFiles[0].file = primaryTarget;
    return {
      files: ops.files,
      replace_files: ops.replaceFiles,
      create_files: ops.createFiles,
      rename_files: ops.renameFiles,
      delete_files: ops.deleteFiles
    };
  };

  const summarizeProjectApplyResult = (projectResult, meta = {}) => ({
    intent: normalizePlannerIntent(meta.intent, 'project_edit'),
    totalApplied: Number(projectResult?.totalApplied) || 0,
    totalFailed: Number(projectResult?.totalFailed) || 0,
    changedFiles: Number(projectResult?.changedFiles) || 0,
    targetFiles: extractTargetFilesFromOperations(meta.memoryPayload || {}).slice(0, 8),
    headline: (projectResult?.totalApplied || 0) > 0
      ? `${projectResult.totalApplied} cambio(s) aplicables en ${projectResult.changedFiles} archivo(s)`
      : '0 cambios aplicables',
    summary: (projectResult?.totalApplied || 0) > 0
      ? `${projectResult.totalApplied} cambios ${projectResult.effectiveAutoApply ? 'aplicados' : 'listos para aplicar'}`
      : 'No se pudo aplicar ningún cambio',
    updatedAt: Date.now()
  });

  const rememberExecutableState = ({ plan, memoryPayload, applySummary = null, failure = null }) => {
    if (plan) self.state.lastPlan = cloneJSON(plan, null);
    if (memoryPayload) {
      self.state.lastExecutableEdits = cloneJSON(memoryPayload, null);
      self.state.lastTargetFiles = extractTargetFilesFromOperations(memoryPayload);
    }
    if (applySummary) self.state.lastApplySummary = cloneJSON(applySummary, null);
    self.state.lastApplyFailure = failure ? cloneJSON(failure, null) : null;
  };

  const buildApplyFailureDiagnostics = (projectResult, meta = {}) => {
    const failedItems = [];
    (projectResult?.results || []).forEach((result) => {
      const details = Array.isArray(result?.details) ? result.details : [];
      if (!details.length && !result?.applied) {
        failedItems.push({
          file: result?.file || '',
          code: 'no_changes_applied',
          reason: 'No hubo cambios aplicables sobre ese archivo.',
          preview: 'Sin cambios aplicables'
        });
      }
      details.forEach((detail) => {
        if (detail?.ok) return;
        failedItems.push({
          file: result?.file || '',
          code: detail?.code || 'apply_failed',
          reason: detail?.reason || detail?.preview || 'Falló apply',
          preview: detail?.preview || '',
          searchPreview: detail?.searchPreview || '',
          strategy: detail?.strategy || ''
        });
      });
    });

    const noValidEdits = !hasProjectToolWork(meta.payload);
    const modelTextOnly = meta.hadToolUse === false;
    const firstFail = failedItems[0] || null;
    const code = modelTextOnly
      ? 'model_text_instead_of_changes'
      : noValidEdits
        ? 'response_without_valid_edits'
        : firstFail?.code || 'no_changes_applied';
    const reason = modelTextOnly
      ? 'El modelo respondió texto en vez de edits ejecutables.'
      : noValidEdits
        ? 'La respuesta no trajo edits válidos.'
        : firstFail?.reason || 'No se pudo aplicar ningún cambio.';

    const metaTargets = Array.isArray(meta.targetFiles)
      ? uniqStrings(meta.targetFiles).filter(Boolean).slice(0, 8)
      : [];

    return {
      code,
      reason,
      file: firstFail?.file || metaTargets.join(', ') || extractTargetFilesFromOperations(meta.memoryPayload || meta.payload || {}).join(', ') || '',
      pattern: firstFail?.searchPreview || '',
      invalidEdits: failedItems.filter(item => String(item.code || '').startsWith('invalid')).length,
      responsePreview: shortText(meta.rawText || safeJSONStringify(meta.payload), 280),
      details: failedItems.slice(0, 6),
      canRetry: true,
      retryStrategy: 'fresh_snapshot_flexible_apply',
      headline: `${code}: ${reason}`,
      updatedAt: Date.now()
    };
  };

  const buildFailureReport = (diagnostic) => {
    const lines = (diagnostic?.details || []).map(detail =>
      `- Archivo: ${detail.file || 'sin archivo'} | fallo: ${detail.code || 'unknown'} | patrón: ${detail.searchPreview || detail.preview || 'sin patrón'}`
    );
    if (!lines.length) lines.push(`- ${diagnostic?.code || 'no_changes_applied'}: ${diagnostic?.reason || 'Sin detalle'}`);
    return lines.join('\n');
  };

  const appendApplyFailureMessage = (diagnostic, onRetry) => {
    const msg = document.createElement('div');
    msg.className = 'ia-pmsg assistant';
    msg.innerHTML = `
      <div class="ia-auto-applied">
        <div class="ia-auto-applied-icon">⚠</div>
        <div class="ia-auto-applied-info">
          <strong>No pude aplicar los cambios</strong>
          <span class="ia-auto-applied-stats">${escapeHtml(diagnostic?.code || 'apply_failed')}</span>
        </div>
      </div>
      <div class="ia-apply-diagnostics">
        <strong>Archivo:</strong> ${escapeHtml(diagnostic?.file || 'sin archivo detectado')}<br>
        <strong>Patrón:</strong> ${escapeHtml(diagnostic?.pattern || 'sin patrón útil')}<br>
        <strong>Motivo:</strong> ${escapeHtml(diagnostic?.reason || 'sin diagnóstico')}<br>
        <strong>Edits inválidos:</strong> ${escapeHtml(String(diagnostic?.invalidEdits ?? 0))}<br>
        <strong>Respuesta:</strong>
        <pre>${escapeHtml(diagnostic?.responsePreview || 'sin respuesta cruda')}</pre>
      </div>
      <div class="ia-auto-applied-actions">
        <button class="ia-diff-btn accept ia-retry-alt-btn">↻ Reintentar</button>
      </div>`;
    msg.querySelector('.ia-retry-alt-btn')?.addEventListener('click', () => onRetry?.());
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
    return msg;
  };

  const appendRetryableAIErrorMessage = (error, retryText) => {
    const meta = getRetryableErrorMeta(error || {});
    const msg = document.createElement('div');
    msg.className = 'ia-pmsg assistant';
    msg.innerHTML = `
      <div class="ia-auto-applied">
        <div class="ia-auto-applied-icon">⏳</div>
        <div class="ia-auto-applied-info">
          <strong>${escapeHtml(formatRetryableErrorLabel(meta))}</strong>
          <span class="ia-auto-applied-stats">${escapeHtml(meta.status ? `HTTP ${meta.status}` : 'retryable')}</span>
        </div>
      </div>
      <div class="ia-apply-diagnostics">
        <strong>Motivo:</strong> ${escapeHtml(meta.message || 'Error temporal del servicio IA')}<br>
        <strong>Acción:</strong> puedes reintentar este mismo pedido sin volver a escribirlo.
      </div>
      <div class="ia-auto-applied-actions">
        <button class="ia-diff-btn accept ia-retry-request-btn">↻ Reintentar IA</button>
      </div>`;
    msg.querySelector('.ia-retry-request-btn')?.addEventListener('click', () => {
      if (!retryText) return;
      send(retryText);
    });
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
    return msg;
  };

  const tryApplyStoredExecutable = (text, { autoApply = true } = {}) => {
    const stored = cloneJSON(self.state?.lastExecutableEdits, null);
    if (!stored) return null;
    const retargeted = retargetExecutablePayload(stored, extractExplicitTargetFiles(text));
    const result = applyProjectEdits(retargeted, { autoApply });
    const summary = summarizeProjectApplyResult(result, {
      intent: normalizePlannerIntent(self.state?.lastPlan?.intent, 'project_edit'),
      memoryPayload: retargeted
    });
    const failure = result.totalApplied === 0
      ? buildApplyFailureDiagnostics(result, {
          payload: retargeted,
          memoryPayload: retargeted,
          rawText: '',
          hadToolUse: true
        })
      : null;

    rememberExecutableState({
      plan: self.state?.lastPlan,
      memoryPayload: retargeted,
      applySummary: summary,
      failure
    });

    return { payload: retargeted, result, summary, failure };
  };

  const appendProjectResultCard = (projectResult, meta = {}) => {
    const appliedNow = projectResult.effectiveAutoApply;
    const changedFiles = projectResult.changedFiles;
    const diffStats = buildProjectDiffRowsHtml(projectResult);
    const detailsHtml = projectResult.results.map((result) => {
      const detail = (result.details || []).find(Boolean);
      const preview = detail?.preview || `${result.applied || 0} aplicado(s), ${result.failed || 0} fallido(s)`;
      return `<div style="font-size:9px;padding:2px 0;color:${result.applied ? '#6ee7b7' : '#fca5a5'}">${result.applied ? '✓' : '✗'} ${escapeHtml(result.file)} · ${escapeHtml(preview)}</div>`;
    }).join('');

    const msg = document.createElement('div');
    msg.className = 'ia-pmsg assistant';
    msg.innerHTML = `
      <div class="ia-auto-applied">
        <div class="ia-auto-applied-icon">${appliedNow ? '✦' : '⏸'}</div>
        <div class="ia-auto-applied-info">
          <strong>${meta.title || (appliedNow
            ? `${projectResult.totalApplied} cambios aplicados en ${changedFiles} archivo${changedFiles !== 1 ? 's' : ''}`
            : `${projectResult.totalApplied} cambios listos en ${changedFiles} archivo${changedFiles !== 1 ? 's' : ''}`)}</strong>
          <span class="ia-auto-applied-stats">
            <span class="ia-stat-add">${projectResult.totalApplied} ✓</span>
            ${projectResult.totalFailed ? `<span class="ia-stat-rem">${projectResult.totalFailed} ✗</span>` : ''}
            <span class="ia-stat-add">+${diffStats.added}</span>
            <span class="ia-stat-rem">-${diffStats.removed}</span>
          </span>
        </div>
      </div>
      <div style="padding:4px 10px;font-family:monospace">
        ${diffStats.rowsHtml ? `<div class="ia-work-progress-files" style="margin-bottom:6px">${diffStats.rowsHtml}</div>` : ''}
        ${detailsHtml || '<span style="font-size:9px;color:#fca5a5">No se pudo aplicar ningún cambio.</span>'}
      </div>
      <div class="ia-auto-applied-actions">
        ${appliedNow ? '<button class="ia-diff-btn ia-undo-project-btn">↩ Deshacer todo</button>' : '<button class="ia-diff-btn accept ia-apply-project-btn">✓ Aplicar todo</button><button class="ia-diff-btn reject ia-discard-project-btn">✕ Descartar</button>'}
        <button class="ia-paction apply ia-show-project-diff-btn">⇄ Ver archivos</button>
      </div>`;

    if (appliedNow) {
      msg.querySelector('.ia-undo-project-btn')?.addEventListener('click', () => {
        projectResult.undo();
        iaToast('↩ Cambios del proyecto restaurados');
        const btn = msg.querySelector('.ia-undo-project-btn');
        if (btn) {
          btn.disabled = true;
          btn.textContent = '✓ Restaurado';
        }
      });
    } else {
      msg.querySelector('.ia-apply-project-btn')?.addEventListener('click', () => {
        projectResult.commit();
        iaToast(`✦ ${projectResult.totalApplied} cambio${projectResult.totalApplied !== 1 ? 's' : ''} aplicado${projectResult.totalApplied !== 1 ? 's' : ''}`);
        const applyBtn = msg.querySelector('.ia-apply-project-btn');
        const discardBtn = msg.querySelector('.ia-discard-project-btn');
        if (applyBtn) {
          applyBtn.textContent = '✓ Aplicado';
          applyBtn.disabled = true;
        }
        if (discardBtn) discardBtn.disabled = true;
      });
      msg.querySelector('.ia-discard-project-btn')?.addEventListener('click', () => {
        const applyBtn = msg.querySelector('.ia-apply-project-btn');
        const discardBtn = msg.querySelector('.ia-discard-project-btn');
        if (applyBtn) applyBtn.disabled = true;
        if (discardBtn) discardBtn.disabled = true;
        iaToast('Descartado');
      });
    }

    msg.querySelector('.ia-show-project-diff-btn')?.addEventListener('click', () => {
      const existing = msg.querySelector('.ia-diff-wrap');
      if (existing) {
        existing.remove();
        return;
      }
      const wrap = document.createElement('div');
      wrap.className = 'ia-diff-wrap';
      const fileRows = projectResult.snapshots.map((snapshot) => {
        const diffLines = makeDiff(snapshot.oldContent, snapshot.newContent);
        const added = diffLines.filter(line => line.type === 'add').length;
        const removed = diffLines.filter(line => line.type === 'rem').length;
        return `<div class="ia-diff-line ctx">⇄ ${escapeHtml(snapshot.file.name)} · +${added} / -${removed}</div>`;
      }).concat(projectResult.structuralOps.map((op) => {
        const label = op.type === 'create' ? 'crear' : op.type === 'rename' ? `renombrar a ${op.newName}` : 'borrar';
        return `<div class="ia-diff-line ${op.type === 'delete' ? 'rem' : 'add'}">◆ ${escapeHtml(op.file.name)} · ${escapeHtml(label)}</div>`;
      })).join('');
      wrap.innerHTML = `
        <div class="ia-diff-header"><strong>${changedFiles} archivo${changedFiles !== 1 ? 's' : ''}</strong><span>${escapeHtml(meta.badge || getModeProfile().label)}</span></div>
        <div class="ia-diff-body">${fileRows || '<div class="ia-diff-line rem">Sin archivos modificados</div>'}</div>`;
      msg.appendChild(wrap);
      messages.scrollTop = messages.scrollHeight;
    });

    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
    return msg;
  };

  // ===== BUCLE DE AGENTE (aplica y sigue, con tope de pasos) =====
  const AGENT_MAX_STEPS = 6;
  let agentGoal = null;
  let agentStepsLeft = 0;
  let pendingAgentStep = null;

  // Decide si la meta del usuario ya quedo cumplida; si no, da la siguiente subtarea.
  const decideAgentContinue = async (goal, lastSummaryText) => {
    try {
      const fileList = (self.state?.filesList || []).map((f) => f.name).join(', ');
      const brainBlock = safeBuildProgBrainContextBlock(goal);
      const folderMemoryBlock = safeBuildFolderMemoryContextBlock(goal);
      const sys = 'Eres el coordinador de un agente de programacion en LTH PROG. Decide si la META del usuario ya quedo cumplida con el proyecto actual. '
        + 'Responde SOLO JSON valido: {"done": true|false, "next": "siguiente subtarea concreta o cadena vacia"}. '
        + 'Si la meta es simple o ya esta cubierta, done=true. Maximo UNA subtarea por paso, concreta y accionable.';
      const user = `META DEL USUARIO:\n${goal}\n\nARCHIVOS ACTUALES: ${fileList || '(ninguno)'}\nULTIMO PASO: ${lastSummaryText || 'cambios aplicados'}${brainBlock}${folderMemoryBlock}\n\n¿Esta cumplida la meta? Si no, ¿cual es la SIGUIENTE subtarea concreta?`;
      const res = await callAnthropicBridge({ maxTokens: 400, system: sys, messages: [{ role: 'user', content: user }] });
      const parsed = extractJsonObject(res.text || '');
      if (!parsed) return { done: true, next: '' };
      return { done: parsed.done === true, next: String(parsed.next || '').trim() };
    } catch (_) {
      return { done: true, next: '' };
    }
  };

  // Quita bloques ``` que el modelo a veces envuelve alrededor del codigo.
  const stripCodeFences = (s) => {
    let t = String(s || '').replace(/^﻿/, '');
    t = t.replace(/^\s*```[a-zA-Z0-9._-]*[ \t]*\r?\n/, '');
    t = t.replace(/\r?\n?```[ \t]*\s*$/, '');
    return t;
  };

  // Red de seguridad: solo si el proveedor reinicia en vez de continuar (no deberia con
  // prefill), recorta un solape GRANDE para no duplicar. En el flujo normal es no-op.
  const safetyTrimOverlap = (a, b) => {
    const maxK = Math.min(a.length, b.length, 800);
    for (let k = maxK; k >= 40; k--) {
      if (a.slice(-k) === b.slice(0, k)) return b.slice(k);
    }
    return b;
  };

  // ESCRITURA EN VIVO: la IA escribe el archivo token por token DENTRO del editor.
  // El previewer refleja el editor en tiempo real, asi que se ve construir.
  // CONTINUACION POR PREFILL: si el modelo se trunca por limite de tokens, le devolvemos
  // lo que YA escribio como su propio turno de asistente y el lo continua exactamente
  // desde ahi (sin reenviar instrucciones, sin re-generar, sin recortar). Soporta
  // archivos grandes por tramos limpios. Devuelve { ok, totalApplied, file, headline }.
  const runStreamingFileBuild = (instruction, ctx, skillBlock, options = {}) => new Promise((resolve) => {
    const bridge = window.electron?.ai;
    if (!bridge?.progAgentStreamStart || !bridge?.onProgAgentStreamEvent) { resolve({ ok: false, fallback: true }); return; }

    const fileName = ctx.filename || 'index.html';
    const fileType = ctx.type || 'HTML';
    const targetFile = ctx.file || getActiveFileRecord();
    const MAX_CONT = 10;
    const brainBlock = safeBuildProgBrainContextBlock(instruction);
    const folderMemoryBlock = safeBuildFolderMemoryContextBlock(instruction);
    const editMode = options.mode === 'edit';
    const existingCode = String(options.existingCode ?? ctx.code ?? '').trim();

    const baseSys = `Eres el agente de LTH Prog. Vas a ${editMode ? 'EDITAR preservando' : 'ESCRIBIR'} el archivo "${fileName}" (${fileType}).\n`
      + 'Devuelve UNICAMENTE el contenido COMPLETO del archivo: nada de explicaciones y SIN bloques ```.\n'
      + 'Empieza directo por el codigo (para HTML, por <!DOCTYPE html>). Si es una pagina en un solo archivo, '
      + 'incluye el CSS en <style> y el JS en <script> dentro del HTML.\n'
      + (editMode
        ? 'Conserva la estructura, textos y funcionalidad que el usuario no pidió cambiar. Aplica la petición como una mejora concreta sobre el archivo existente.\n'
        : '')
      + 'IMPORTANTE para no inflar el archivo: si un icono/SVG se repite, defínelo UNA sola vez '
      + '(usa <symbol> + <use>, una clase CSS, o una plantilla JS) y reutilízalo; nunca pegues el mismo '
      + 'path SVG largo muchas veces. Manten el codigo limpio y conciso. '
      + `Prioriza velocidad: entrega una primera version completa y usable, sin relleno ni secciones repetidas.${skillBlock || ''}${brainBlock}${folderMemoryBlock}`;

    const firstUser = editMode
      ? `${instruction}${brainBlock}${folderMemoryBlock}\n\nArchivo actual ${fileName}:\n\`\`\`${fileType.toLowerCase()}\n${existingCode}\n\`\`\`\n\nEdita el archivo y devuelve ${fileName} COMPLETO. Solo el codigo del archivo.`
      : `${instruction}${brainBlock}${folderMemoryBlock}\n\nEscribe el archivo ${fileName} COMPLETO desde cero. Solo el codigo del archivo.`;

    let committed = '';   // texto ya consolidado de tramos anteriores
    let seg = '';         // texto del tramo en curso (sin consolidar)
    let conts = 0;
    let done = false;
    let off = null;
    let lastPaint = 0;
    let lastLivePaint = 0;
    let lastChunkAt = Date.now();
    let activeStreamId = null;
    const ignoredStreamIds = new Set();
    let watchdogTimer = null;
    let hardTimer = null;
    const STREAM_IDLE_MS = 15000;
    const STREAM_HARD_MS = 180000;
    const STREAM_SEGMENT_TOKENS = 12000;

    addMsg('assistant', `✍️ Escribiendo ${fileName} en el editor…`, false);

    const paint = (force) => {
      const now = Date.now();
      if (!force && now - lastPaint < 50) return;
      lastPaint = now;
      const clean = stripCodeFences(committed + seg);
      try {
        if (self.editor?.setValue && self.editor.getValue() !== clean) {
          self.editor.setValue(clean);
          if (self.editor.lineCount) self.editor.setCursor?.(self.editor.lineCount(), 0);
        }
      } catch {}
      if (force || now - lastLivePaint > 900) {
        lastLivePaint = now;
        try { self.refreshLive?.(container, true); } catch {}
      }
    };

    const commitSeg = () => {
      // Prefill normalmente da continuacion limpia (sin solape). El safetyTrim es no-op
      // salvo que el proveedor reinicie el contenido.
      committed = committed + (committed ? safetyTrimOverlap(committed, seg) : seg);
      seg = '';
    };

    const looksCompleteGeneratedFile = (text) => {
      const clean = stripCodeFences(text).trim();
      if (!clean) return false;
      const isHtml = /\.html?$/i.test(fileName) || /html/i.test(fileType);
      if (isHtml) return /<\/html>\s*$/i.test(clean) || /<\/body>\s*<\/html>\s*$/i.test(clean);
      return clean.length > 200;
    };

    const finalize = (ok, errMsg) => {
      if (done) return; done = true;
      if (off) { try { off(); } catch {} off = null; }
      if (watchdogTimer) { clearInterval(watchdogTimer); watchdogTimer = null; }
      if (hardTimer) { clearTimeout(hardTimer); hardTimer = null; }
      if (activeStreamId) {
        ignoredStreamIds.add(activeStreamId);
        try { bridge.progAgentStreamAbort?.(activeStreamId); } catch {}
        activeStreamId = null;
      }
      if (ok) {
        if (seg) commitSeg();
        const clean = stripCodeFences(committed).trim();
        try {
          if (self.editor?.setValue) self.editor.setValue(clean);
          if (targetFile) {
            targetFile.content = clean;
            self._persistFileState?.(targetFile);
            void (async () => {
              try {
                const path = targetFile.path
                  ? targetFile.path
                  : await materializeFileOnDisk(targetFile, clean);
                if (path) {
                  await writeTextFileSafe(path, clean);
                  markFileAsSaved?.(targetFile, clean);
                  self._renderDynamicTabs?.();
                  self._renderFileExplorer?.();
                }
              } catch (diskErr) {
                console.warn('[LTH PROG] No se pudo materializar archivo IA:', diskErr?.message || diskErr);
              }
            })();
          }
          self._saveCurrentTabContent?.();
          self._persistSessionMeta?.();
          self.refreshLive?.(container, true);
        } catch {}
        renderUsageMeter();
        const lines = clean.split('\n').length;
        const extra = conts > 0 ? ` en ${conts + 1} tramos` : '';
        addMsg('assistant', `✦ ${fileName} escrito en el editor (${lines} líneas${extra}).`, false);
        resolve({ ok: true, totalApplied: 1, file: fileName, headline: `${fileName} escrito (${lines} líneas)` });
      } else {
        addMsg('assistant', `⚠️ ${errMsg || 'No se pudo completar la escritura en vivo.'}`, false);
        resolve({ ok: false, totalApplied: 0 });
      }
    };

    const startSegment = (messages) => {
      seg = '';
      activeStreamId = null;
      lastChunkAt = Date.now();
      Promise.resolve(getFundingSource()).then((fundingSource) =>
        bridge.progAgentStreamStart({ fundingSource, messages, system: baseSys, maxTokens: STREAM_SEGMENT_TOKENS })
      )
        .then((res) => {
          if (!res?.success || !res.streamId) {
            if (committed) finalize(true); else finalize(false, res?.error || 'No se pudo iniciar el stream.');
            return;
          }
          activeStreamId = res.streamId;
        })
        .catch((e) => { if (committed) finalize(true); else finalize(false, e?.message); });
    };

    // Continuacion por PREFILL: el modelo recibe su propia salida parcial como turno de
    // asistente y la continua exactamente donde se corto (mismo system, misma instruccion).
    const continueOrFinish = () => {
      commitSeg();
      conts++;
      addMsg('assistant', `… continuando (tramo ${conts + 1})…`, false);
      startSegment([
        { role: 'user', content: firstUser },
        { role: 'assistant', content: stripCodeFences(committed) }
      ]);
    };

    // Una sola generacion activa por panel: filtramos por streamId para no mezclar eventos.
    off = bridge.onProgAgentStreamEvent((data) => {
      if (!data || done) return;
      if (data.streamId && ignoredStreamIds.has(data.streamId)) return;
      if (activeStreamId && data.streamId && data.streamId !== activeStreamId) return;
      if (data.type === 'content' && data.text) {
        lastChunkAt = Date.now();
        seg += String(data.text);
        paint(false);
      }
      else if (data.type === 'complete') {
        lastChunkAt = Date.now();
        // Descuento en tiempo real: empuja los creditos reconciliados al estado
        // compartido; el medidor de uso se repinta solo por la suscripcion onChange.
        if (data.credits) { try { window.LTHAuth?.applyCredits?.(data.credits); } catch (_) {} }
        if (!seg && data.text) seg = String(data.text);
        if (data.success === false && data.error) {
          if (committed) finalize(true); else finalize(false, data.error);
          return;
        }
        paint(true);
        const truncated = data.truncated === true || /length/i.test(String(data.finishReason || ''));
        const grew = seg.trim().length > 0;
        const draft = stripCodeFences(committed + seg).trim();
        const incompleteHtml = (/\.html?$/i.test(fileName) || /html/i.test(fileType)) && !looksCompleteGeneratedFile(draft);
        if ((truncated || incompleteHtml) && grew && conts < MAX_CONT) continueOrFinish();
        else { commitSeg(); finalize(true); }
      }
      else if (data.type === 'error') {
        const draft = stripCodeFences(committed + seg).trim();
        if (committed && looksCompleteGeneratedFile(draft)) finalize(true);
        else finalize(false, data.error);
      }
      else if (data.type === 'aborted') { if (committed) finalize(true); else finalize(false, 'Generación cancelada.'); }
    });

    watchdogTimer = setInterval(() => {
      if (done) return;
      const draft = stripCodeFences(committed + seg).trim();
      const hasWritten = draft.length > 80;
      if (hasWritten && Date.now() - lastChunkAt > STREAM_IDLE_MS) {
        paint(true);
        if (!looksCompleteGeneratedFile(draft) && conts < MAX_CONT) {
          if (activeStreamId) {
            ignoredStreamIds.add(activeStreamId);
            try { bridge.progAgentStreamAbort?.(activeStreamId); } catch {}
            activeStreamId = null;
          }
          continueOrFinish();
          return;
        }
        finalize(true);
      }
    }, 1000);

    hardTimer = setTimeout(() => {
      if (done) return;
      const hasWritten = stripCodeFences(committed + seg).trim().length > 80;
      if (hasWritten) finalize(true);
      else finalize(false, 'La generación tardó demasiado y no entregó contenido.');
    }, STREAM_HARD_MS);

    startSegment([{ role: 'user', content: firstUser }]);
  });

  const send = async (text, opts = {}) => {
    const isCont = opts._cont === true;
    const txt = (text || input?.value || '').trim();
    if (!txt || isLoading) return;
    const mode = getMode();
    // La IA (no-offline) requiere plan Pro + sesion. El cobro va al wallet compartido.
    if (mode !== 'offline' && !isCont) {
      let state = null;
      try { state = await window.LTHAuth?.getState?.(); } catch {}
      if (!state?.signedIn) { showProGate('signin'); return; }
      const fundingSource = sanitizeFundingSource(localStorage.getItem(IA_FUNDING_KEY) || restoreFundingSource(state));
      if (!hasPremiumAccessForSource(state, fundingSource)) { showProGate(fundingSource === 'gift' ? 'gift' : 'pro'); return; }
    }
    // Nuevo turno de usuario (no continuacion): reinicia el estado del bucle de agente.
    if (!isCont) { agentGoal = txt; agentStepsLeft = 0; pendingAgentStep = null; }

    if (!isCont && input) { input.value=''; input.style.height='auto'; }
    isLoading=true; if(sendBtn)sendBtn.disabled=true; if(input)input.disabled=true;
    if (!isCont) addMsg('user', txt);
    let ctx = getCtx();
    const profile = getModeProfile(mode);
    let intentMeta = detectIntentMeta(txt, ctx, profile);

    if (await ensureWebStarterWorkspace(txt)) {
      ctx = getCtx();
      intentMeta = detectIntentMeta(txt, ctx, profile);
    }

    if (mode === 'offline') {
      const typingEl = showTyping();
      try {
        const reply = runOfflineAssistant(txt, ctx);
        typingEl?.remove();
        addMsg('assistant', reply, false);
        history.push({role:'user',content:txt});
        history.push({role:'assistant',content:'[Sin API]'});
        saveHist();
      } finally {
        isLoading=false; if(sendBtn)sendBtn.disabled=false; if(input){input.disabled=false;input.focus();}
      }
      return;
    }
    const strictRule = profile.strict ? '\nMODO INGENIERO: responde solo con lo necesario. No expliques decisiones, no des introducciones, no agregues relleno.' : '';
    // GLM-5.2 puede construir archivos completos de forma fiable cuando el proyecto nace
    // desde cero o el archivo activo esta vacio. Sobre codigo existente, especialmente grande,
    // el flujo debe quedarse en edits quirurgicos para no reemplazar trabajo previo.
    const isBuildRequest = shouldTreatAsBuildRequest(txt, ctx, intentMeta);
    let activeFileEmpty = !(ctx.code && ctx.code.trim().length > 24);
    if ((isBuildRequest || activeFileEmpty) && !intentMeta.wantsProjectOperation) {
      await ensureActiveFileMaterializedForAi(txt, ctx);
      ctx = getCtx();
      activeFileEmpty = !(ctx.code && ctx.code.trim().length > 24);
      intentMeta = detectIntentMeta(txt, ctx, profile);
    }
    const allowFullReplace = allowsFullReplaceRequest(txt) || isBuildRequest || activeFileEmpty;
    // Habilidades descargables (skills .md): solo cuando aportan (build desde cero, archivo
    // vacio u operacion de proyecto). En un edit puntual sobre codigo existente no se inyectan,
    // para no gastar ~700-900 tokens de guias que no aplican a un cambio chico.
    const skillsRelevant = isBuildRequest || activeFileEmpty || intentMeta.wantsProjectOperation;
    const skillContext = skillsRelevant
      ? await buildSkillContext(txt)
      : { block: '', priorityBlock: '', picked: [], ids: [] };
    const skillBlock = skillContext.block;
    const skillPriorityBlock = skillContext.priorityBlock || '';
    self.state.lastActiveSkills = Array.isArray(skillContext.picked)
      ? skillContext.picked.map((skill) => ({ id: skill.id, name: skill.name }))
      : [];
    const enableAgentLoop = shouldEnableAgentLoop(txt, { isBuildRequest, activeFileEmpty });
    const cleanHistory = profile.maxHistory
      ? history.slice(-profile.maxHistory).map(h => ({ role: h.role, content: h.content }))
      : [];
    const typingEl = showTyping();

    try {
      setTypingProgress(typingEl, {
        title: 'Analizando solicitud',
        detail: 'Leyendo el archivo activo, el workspace y el contexto reciente antes de editar.',
        badge: 'análisis'
      });
      await safeEnsureFolderMemoryForAiTurn(txt);
      // Targeting semantico: vectoriza la consulta y las lineas nuevas de la
      // memoria .md (tope 900 ms; cache hit ~0 ms) antes de que el planner y
      // getRelevantWorkspaceFiles pidan candidatos por memoria.
      await warmFolderMemorySemanticTargeting(txt);
      safeUpdateProgBrainFromUserTurn(txt, ctx, intentMeta);
      const autoApply = autoApplyEl?.checked !== false;

      if (intentMeta.wantsMemoryApply) {
        typingEl?.remove();
        const memoryAttempt = tryApplyStoredExecutable(txt, { autoApply });
        if (memoryAttempt?.result?.totalApplied > 0) {
          appendProjectResultCard(memoryAttempt.result, {
            badge: 'memoria',
            title: memoryAttempt.result.effectiveAutoApply
              ? `${memoryAttempt.result.totalApplied} cambios de memoria aplicados`
              : `${memoryAttempt.result.totalApplied} cambios de memoria listos`
          });
          safeUpdateProgBrainFromOutcome({
            summary: memoryAttempt.summary?.headline || 'Cambios de memoria aplicados',
            intent: self.state?.lastPlan?.intent || 'project_edit',
            targetFiles: self.state?.lastTargetFiles || [],
            success: true
          });
          await appendFolderMemoryEvent({
            user: txt,
            assistant: '[Memory apply]',
            outcome: memoryAttempt.summary?.headline || 'Cambios de memoria aplicados',
            targetFiles: self.state?.lastTargetFiles || [],
            success: true
          });
          iaToast(memoryAttempt.result.effectiveAutoApply
            ? `✦ ${memoryAttempt.result.totalApplied} cambio${memoryAttempt.result.totalApplied !== 1 ? 's' : ''} aplicado${memoryAttempt.result.totalApplied !== 1 ? 's' : ''}`
            : `⏸ ${memoryAttempt.result.totalApplied} cambio${memoryAttempt.result.totalApplied !== 1 ? 's' : ''} pendiente${memoryAttempt.result.totalApplied !== 1 ? 's' : ''}`);
        } else {
          safeUpdateProgBrainFromOutcome({
            summary: memoryAttempt?.failure?.headline || 'No se pudo aplicar la memoria guardada',
            intent: self.state?.lastPlan?.intent || 'project_edit',
            targetFiles: self.state?.lastTargetFiles || [],
            success: false
          });
          await appendFolderMemoryEvent({
            user: txt,
            assistant: '[Memory apply failed]',
            outcome: memoryAttempt?.failure?.headline || 'No se pudo aplicar la memoria guardada',
            targetFiles: self.state?.lastTargetFiles || [],
            success: false
          });
          appendApplyFailureMessage(memoryAttempt?.failure || {
            code: 'memory_apply_failed',
            reason: 'No pude aplicar la última edición guardada.',
            file: (self.state?.lastTargetFiles || []).join(', '),
            responsePreview: 'Sin payload reutilizable',
            canRetry: true
          }, () => send(`reintenta con snapshot fresco y fallback flexible: ${txt}`));
          iaToast('No pude aplicar la memoria guardada', 'err');
        }
        history.push({ role:'user', content:txt });
        history.push({ role:'assistant', content:'[Memory apply]' });
        saveHist();
        return;
      }

      const plannerFallback = buildHeuristicPlan(txt, ctx, intentMeta);
      let activePlan = plannerFallback;

      if (intentMeta.intent !== 'chat') {
        // Plan rapido local: si es un edit sobre el archivo activo sin operacion de proyecto
        // multi-archivo ni multiples objetivos, saltamos el planner remoto (ahorra una llamada
        // extra de ~16k tokens por accion). El plan heuristico ya apunta al archivo activo.
        const useFastVisualPlan = intentMeta.intent !== 'chat'
          && !intentMeta.wantsProjectOperation
          && !!ctx.filename
          && intentMeta.explicitTargets.length <= 1;
        if (useFastVisualPlan) {
          activePlan = ensurePlanTargets(plannerFallback, ctx);
          self.state.lastPlan = cloneJSON(activePlan, null);
          safeUpdateProgBrainFromPlan(activePlan, ctx);
          setTypingProgress(typingEl, {
            title: 'Plan rápido',
            detail: 'Uso el archivo activo como objetivo y paso directo a preparar el cambio.',
            badge: 'plan'
          });
        } else {
          setTypingProgress(typingEl, {
            title: 'Planeando cambios',
            detail: 'Decidiendo intención, archivos objetivo y la estrategia más segura para tocar el código.',
            badge: 'plan'
          });
          const plannerSystemPrompt = `Eres el planner técnico de la IA integrada en LTH PROG.
No escribes código ni explicaciones largas. Debes decidir la intención correcta y qué archivos tocar primero.
Si existe MEMORIA FISICA DE CARPETA con File Roles, Canonical Fixes, Known Issues o Change Log, úsala como fuente principal de targeting.
Si la memoria relaciona una frase del usuario con un archivo concreto, ese archivo debe ir primero en target_files aunque no sea el archivo activo.
Si la memoria no cubre la petición y el workspace no da confianza suficiente, devuelve estrategia de investigación/pregunta antes de aplicar cambios dudosos.
Usa visual_edit para solicitudes vagas o visuales de UI, diseño, interfaz, premium, spacing, tipografía, layout, colores, responsive o alineación.
En visual_edit prioriza CSS, luego HTML si hace falta.
Evita green dot, toolbar frágil, drawer y RUN salvo que sea imprescindible.
Si el usuario parece pedir aplicar la última edición ejecutable, marca can_apply_from_memory=true.${strictRule}${skillPriorityBlock}${skillBlock}`;
          const plannerInput = buildPlannerContext(txt, ctx, profile, intentMeta);
          const plannerMessages = [...cleanHistory.slice(-Math.min(cleanHistory.length, 6)), { role:'user', content: plannerInput }];
          let plannerResult;
          try {
            plannerResult = await callClaudePlanner(plannerMessages, plannerSystemPrompt, plannerFallback);
          } catch (err) {
            if (!isTimeoutAIError(err)) throw err;
            plannerResult = { plan: plannerFallback, rawText: '[planner-timeout-fallback]', hadToolUse: false };
            iaToast('⏳ Planner tardó; sigo con plan rápido local.');
          }
          const normalizedPlannerPlan = ensurePlanTargets(normalizePlannerPlanPayload(plannerResult.plan, plannerFallback), ctx);
          const heuristicIntent = normalizePlannerIntent(plannerFallback.intent, intentMeta.intent);
          const plannerIntent = normalizePlannerIntent(normalizedPlannerPlan.intent, heuristicIntent);
          activePlan = (heuristicIntent !== 'chat' && plannerIntent === 'chat')
            ? ensurePlanTargets(plannerFallback, ctx)
            : normalizedPlannerPlan;
          self.state.lastPlan = cloneJSON(activePlan, null);
          safeUpdateProgBrainFromPlan(activePlan, ctx);
          trackCost(plannerInput, safeJSONStringify(plannerResult.plan));
        }
      } else {
        activePlan = ensurePlanTargets(activePlan, ctx);
        safeUpdateProgBrainFromPlan(activePlan, ctx);
      }

      if (normalizePlannerIntent(activePlan.intent, intentMeta.intent) === 'chat') {
        const chatUserContent = `${buildTaskUserContent(txt, ctx, { kind:'chat' })}${buildWorkspaceContext(ctx, profile, {
          intent: 'chat',
          targetFiles: intentMeta.explicitTargets
        })}${safeBuildProgBrainContextBlock(txt)}${safeBuildFolderMemoryContextBlock(txt)}`;
        const chatSystemPrompt = `Eres un asistente de programación dentro de LTH PROG. Responde en español, conciso y útil.${strictRule}`;
        const fullReply = await callClaudeStream([...cleanHistory, { role:'user', content: chatUserContent }], chatSystemPrompt, (_, full) => {
          const pre = typingEl?.querySelector('.ia-ptyping');
          if (pre) pre.innerHTML = `<span style="font-size:10px;color:rgba(167,139,250,.6);font-family:monospace;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(full.slice(-60))}</span>`;
        });
        typingEl?.remove();
        trackCost(chatUserContent, fullReply);
        addMsg('assistant', fullReply, false);
        safeUpdateProgBrainFromOutcome({
          summary: shortText(fullReply, 180),
          intent: 'chat',
          targetFiles: intentMeta.explicitTargets,
          success: true
        });
        await appendFolderMemoryEvent({
          user: txt,
          assistant: fullReply,
          outcome: 'Respuesta de chat registrada',
          targetFiles: intentMeta.explicitTargets,
          success: true
        });
        history.push({ role:'user', content:txt });
        history.push({ role:'assistant', content:fullReply });
        saveHist();
        return;
      }

      const effectiveIntent = normalizePlannerIntent(activePlan.intent, intentMeta.intent);
      // Turno de edicion de nivel superior: habilita el bucle de agente (pasos restantes).
      if (!isCont) agentStepsLeft = enableAgentLoop ? (AGENT_MAX_STEPS - 1) : 0;

      // ── MODO STREAMING (construir): la IA escribe el archivo EN VIVO en el editor. ──
      // Para builds desde cero / archivo vacio (un solo archivo). Edits puntuales sobre
      // codigo existente siguen por el ejecutor (search/replace) mas abajo.
      const useStreamBuild = (isBuildRequest || activeFileEmpty)
        && !intentMeta.wantsProjectOperation
        && !!window.electron?.ai?.progAgentStreamStart;
      if (useStreamBuild) {
        typingEl?.remove();
        const streamResult = await runStreamingFileBuild(txt, getCtx(), `${skillPriorityBlock}${skillBlock}`);
        if (streamResult?.ok) {
          rememberExecutableState({ plan: activePlan, applySummary: { headline: streamResult.headline, summary: streamResult.headline } });
          safeUpdateProgBrainFromOutcome({
            summary: streamResult.headline,
            intent: effectiveIntent,
            targetFiles: activePlan.targetFiles,
            success: true
          });
          await appendFolderMemoryEvent({
            user: txt,
            assistant: `[stream-build: ${streamResult.file}]`,
            outcome: streamResult.headline,
            targetFiles: activePlan.targetFiles,
            success: true
          });
          history.push({ role: 'user', content: txt });
          history.push({ role: 'assistant', content: `[stream-build: ${streamResult.file}]` });
          saveHist();
          if (agentStepsLeft > 0) {
            const decision = await decideAgentContinue(agentGoal || txt, streamResult.headline);
            if (!decision.done && decision.next) {
              agentStepsLeft--;
              pendingAgentStep = decision.next;
              const stepNo = AGENT_MAX_STEPS - agentStepsLeft;
              addMsg('assistant', `▶ Paso ${stepNo} del agente: ${decision.next}`, false);
            } else { agentStepsLeft = 0; }
          }
          return;
        }
        // Si el stream fallo, seguimos con el ejecutor normal (no return).
      }

      const taskKind = effectiveIntent === 'fix_edit'
        ? 'fix'
        : effectiveIntent === 'visual_edit'
          ? 'visual'
          : 'edit';
      const requireFileEdits = !intentMeta.wantsProjectOperation;
      const largeRewriteGuard = buildLargeRewriteGuardBlock(txt, ctx, {
        allowFullReplace,
        isBuildRequest,
        activeFileEmpty
      });
      const workspaceRule = `\nTienes contexto del proyecto abierto. Trabaja sobre el código existente, no lo reconstruyas. Modifica solo los bloques necesarios y conserva estructura, nombres, estilos y contenido que el usuario no pidió cambiar. Usa el nombre exacto del archivo. Solo usa delete_files cuando el usuario pida borrar/eliminar/quitar un archivo de forma explícita. ${allowFullReplace ? 'El usuario permitió un cambio amplio; replace_files está permitido si es más seguro.' : 'No uses replace_files salvo que sea imposible aplicar edits puntuales; prioriza files con search/replace exacto.'}`;
      const toolRule = 'USA la herramienta apply_project_edits. Regla principal: usa files con edits pequeños. Si puedes copiar el bloque exacto, usa search + replace. Si el search exacto puede fallar, usa start_line + end_line + replace con las líneas 1-based mostradas. No incluyas números de línea dentro de replace. No cambies todo el archivo para una solicitud puntual. En visual_edit evita reemplazar el CSS completo o reescribir el HTML entero si bastan overrides puntuales. Si el usuario pide iconos, botones, llamadas simuladas o interacción pequeña, agrega HTML + CSS + JS mínimos dentro del archivo activo. Nunca devuelvas listas vacías para una solicitud de edición.';
      // En builds desde cero / archivos vacios: forzar contenido COMPLETO (GLM lo hace fiable).
      const buildRule = (isBuildRequest || activeFileEmpty)
        ? '\nMODO CONSTRUCCION: si el archivo no existe o esta vacio, créalo con create_files (o reemplázalo con replace_files) incluyendo el CONTENIDO COMPLETO del archivo. No uses search/replace sobre archivos vacios. Para una app web crea index.html, styles.css y app.js enlazados entre si.'
        : '';
      const systemPrompt = effectiveIntent === 'fix_edit'
        ? `Eres un auditor de código experto dentro de LTH PROG. ANALIZA y corrige problemas reales usando cambios ejecutables.${workspaceRule}\n${toolRule}${largeRewriteGuard}${strictRule}${buildRule}${skillPriorityBlock}${skillBlock}`
        : `Eres un editor de código dentro de LTH PROG. Devuelve cambios ejecutables sobre archivos reales.${workspaceRule}\n${toolRule}${largeRewriteGuard}${effectiveIntent === 'visual_edit' ? `\n${VISUAL_EXECUTION_RULES}` : ''}${strictRule}${buildRule}${skillPriorityBlock}${skillBlock}`;

      setTypingProgress(typingEl, {
        title: 'Preparando patch',
        detail: 'Generando cambios aplicables sobre archivos reales del proyecto.',
        badge: effectiveIntent === 'visual_edit' ? 'visual' : 'edit'
      });
      // Edicion focalizada: si el archivo es grande y ubicamos la seccion del objetivo,
      // mandamos solo ese pedazo + el indice (no el archivo entero). Retry/repair pueden
      // usar snapshot fresco, pero el guardia de proyecto grande evita reemplazos completos.
      const activeFocus = computeActiveFocus(txt, ctx, {
        allowFullReplace,
        isProjectOp: intentMeta.wantsProjectOperation
      });
      if (activeFocus) {
        iaToast(`🎯 Edición focalizada: líneas ${activeFocus.from}-${activeFocus.to} (no mando el archivo completo)`);
      }
      let executionInput = `${buildTaskUserContent(txt, ctx, { kind: taskKind, omitCode: true })}\n\n${buildPlanSummaryBlock(activePlan, ctx)}\n${buildTargetGuardBlock(activePlan, ctx)}${safeBuildProgBrainContextBlock(txt)}${safeBuildFolderMemoryContextBlock(txt)}`;
      const interactiveGuard = buildInteractiveGuardBlock(txt, ctx);
      if (interactiveGuard) executionInput += `\n${interactiveGuard}`;
      executionInput += buildWorkspaceContext(ctx, profile, {
        forceWorkspace: true,
        intent: effectiveIntent,
        targetFiles: activePlan.targetFiles,
        focus: activeFocus
      });
      if (attachedFiles.length) {
        executionInput += '\n\n--- Archivos adjuntos ---';
        attachedFiles.forEach(file => { executionInput += `\n\n📎 ${file.name}:\n${file.content}`; });
      }
      let executorCostInput = executionInput;

      // Fase 2: lecturas bajo demanda solo cuando hay donde perderse (workspace
      // multiarchivo o archivo grande). En archivos chicos el contexto ya cabe.
      const readToolsWorthIt = getWorkspaceFiles().length > 1
        || String(getCtx()?.code || '').split('\n').length >= FOCUS_MIN_LINES;
      let executorResult;
      try {
        executorResult = await callClaudeWithTools(
          [...cleanHistory, { role:'user', content: executionInput }],
          systemPrompt,
          {
            projectMode: true,
            requireFileEdits,
            timeoutMs: effectiveIntent === 'visual_edit' ? 45000 : 120000,
            readTools: readToolsWorthIt,
            onReadTool: (req, left) => setTypingProgress(typingEl, {
              title: `Leyendo ${shortText(req.args?.archivo || req.args?.texto || 'el workspace', 42)}`,
              detail: `La IA pidió ${req.name.replace(/_/g, ' ')} antes de editar (${left} lectura${left === 1 ? '' : 's'} restante${left === 1 ? '' : 's'}).`,
              badge: 'investigando'
            })
          }
        );
      } catch (err) {
        const fallbackCtx = getCtx();
        const fallbackIsHtml = /html/i.test(String(fallbackCtx.type || '')) || /\.html?$/i.test(String(fallbackCtx.filename || ''));
        const fallbackRisk = getLargeRewriteRiskMeta(txt, fallbackCtx, {
          allowFullReplace,
          isBuildRequest,
          activeFileEmpty
        });
        const canProtectedPatchRetry = isTimeoutAIError(err)
          && effectiveIntent === 'visual_edit'
          && !intentMeta.wantsProjectOperation
          && fallbackRisk.protect;
        const canStreamEditFallback = isTimeoutAIError(err)
          && effectiveIntent === 'visual_edit'
          && !intentMeta.wantsProjectOperation
          && fallbackIsHtml
          && !fallbackRisk.protect
          && !!window.electron?.ai?.progAgentStreamStart;
        if (canProtectedPatchRetry) {
          const protectedFocus = activeFocus || computeActiveFocus(txt, fallbackCtx, {
            allowFullReplace: false,
            isProjectOp: false
          });
          setTypingProgress(typingEl, {
            title: 'Patch protegido',
            detail: `${fallbackRisk.file} tiene ${fallbackRisk.lines} líneas; reintento con un cambio por secciones para conservar el proyecto.`,
            badge: 'guardia'
          });
          addMsg('assistant', `⏳ El patch tardó. ${fallbackRisk.file} tiene ${fallbackRisk.lines} líneas; reintento con patch por secciones para conservar el trabajo existente.`, false);
          const protectedInput = `${buildTaskUserContent(txt, fallbackCtx, { kind: taskKind, omitCode: true })}\n\n${buildPlanSummaryBlock(activePlan, fallbackCtx)}\n${buildTargetGuardBlock(activePlan, fallbackCtx)}${buildInteractiveGuardBlock(txt, fallbackCtx) ? `\n${buildInteractiveGuardBlock(txt, fallbackCtx)}` : ''}${safeBuildProgBrainContextBlock(txt)}${safeBuildFolderMemoryContextBlock(txt)}\nEl intento anterior tardó. Aplica un patch más pequeño y estable.${buildWorkspaceContext(fallbackCtx, profile, {
            forceWorkspace: true,
            intent: effectiveIntent,
            targetFiles: activePlan.targetFiles,
            focus: protectedFocus
          })}`;
          const protectedPrompt = `${systemPrompt}
El intento anterior tardó. Este archivo está protegido como proyecto grande.
Responde usando SOLO files.edits con 1 a 4 edits pequeños. Si puedes, usa start_line/end_line reales con el rango mínimo necesario.
No uses replace_files, no reemplaces todo <style>, todo <body> ni todo el HTML. Si el objetivo requiere más pasos, aplica solo el primer paso concreto.
No expliques nada.`;
          try {
            executorResult = await callClaudeWithTools(
              [...cleanHistory, { role:'user', content: protectedInput }],
              protectedPrompt,
              { projectMode: true, requireFileEdits: true, timeoutMs: 90000 }
            );
            executorCostInput = protectedInput;
          } catch (protectedErr) {
            if (!isTimeoutAIError(protectedErr)) throw protectedErr;
            typingEl?.remove();
            const diagnostic = buildProtectedRewriteDiagnostic(txt, fallbackCtx, protectedErr);
            rememberExecutableState({ plan: activePlan, failure: diagnostic });
            safeUpdateProgBrainFromOutcome({
              summary: diagnostic.headline,
              intent: effectiveIntent,
              targetFiles: activePlan.targetFiles,
              success: false
            });
            await appendFolderMemoryEvent({
              user: txt,
              assistant: '[protected-large-file-timeout]',
              outcome: diagnostic.headline,
              targetFiles: activePlan.targetFiles,
              success: false
            });
            appendApplyFailureMessage(diagnostic, () => send(`reintenta con patch quirúrgico por secciones: ${txt}`));
            history.push({ role:'user', content:txt });
            history.push({ role:'assistant', content:'[protected-large-file-timeout]' });
            saveHist();
            iaToast('Patch protegido sin reemplazo completo', 'err');
            return;
          }
        } else if (canStreamEditFallback) {
          typingEl?.remove();
          addMsg('assistant', '⏳ El patch tardó demasiado; cambio a edición en vivo para no dejarte esperando.', false);
          const streamResult = await runStreamingFileBuild(txt, fallbackCtx, `${skillPriorityBlock}${skillBlock}`, {
            mode: 'edit',
            existingCode: fallbackCtx.code
          });
          if (streamResult?.ok) {
            rememberExecutableState({ plan: activePlan, applySummary: { headline: streamResult.headline, summary: streamResult.headline } });
            safeUpdateProgBrainFromOutcome({
              summary: streamResult.headline,
              intent: effectiveIntent,
              targetFiles: activePlan.targetFiles,
              success: true
            });
            await appendFolderMemoryEvent({
              user: txt,
              assistant: `[stream-edit-fallback: ${streamResult.file}]`,
              outcome: streamResult.headline,
              targetFiles: activePlan.targetFiles,
              success: true
            });
            history.push({ role: 'user', content: txt });
            history.push({ role: 'assistant', content: `[stream-edit-fallback: ${streamResult.file}]` });
            saveHist();
            return;
          }
        }
        if (!executorResult) throw err;
      }
      let payload = sanitizeProjectEditPayload(executorResult.payload, ctx, {
        text: txt,
        intent: effectiveIntent,
        allowFullReplace,
        isBuildRequest,
        activeFileEmpty
      });
      let memoryPayload = normalizeExecutableForMemory(payload, ctx, { projectMode: true });

      if (!hasProjectToolWork(memoryPayload)) {
        const emptyDiagnostic = buildApplyFailureDiagnostics({
          results: [],
          totalApplied: 0,
          totalFailed: 0,
          changedFiles: 0,
          snapshots: [],
          structuralOps: [],
          effectiveAutoApply: autoApply,
          commit() {},
          undo() {}
        }, {
          payload,
          memoryPayload,
          rawText: executorResult.rawText,
          hadToolUse: executorResult.hadToolUse,
          targetFiles: activePlan.targetFiles
        });
        const retryInput = `${buildTaskUserContent(txt, getCtx(), { kind: taskKind, omitCode: true })}\n\n${buildPlanSummaryBlock(activePlan, getCtx())}\n${buildTargetGuardBlock(activePlan, getCtx())}${buildInteractiveGuardBlock(txt, getCtx()) ? `\n${buildInteractiveGuardBlock(txt, getCtx())}` : ''}${safeBuildProgBrainContextBlock(txt)}${safeBuildFolderMemoryContextBlock(txt)}\nDiagnóstico apply previo:\n${buildFailureReport(emptyDiagnostic)}${buildWorkspaceContext(getCtx(), profile, {
          forceWorkspace: true,
          intent: effectiveIntent,
          targetFiles: activePlan.targetFiles
        })}`;
        const retryPrompt = `${systemPrompt}
La respuesta anterior no trajo edits válidos.
Diagnóstico:
${buildFailureReport(emptyDiagnostic)}
Debes devolver cambios reales usando files.edits puntuales sobre ${activePlan.targetFiles.join(', ') || getCtx().filename}. Si falla search exacto, usa start_line/end_line con el rango mínimo necesario. No expliques nada.`;
        const retriedExecutor = await callClaudeWithTools(
          [...cleanHistory, { role:'user', content: retryInput }],
          retryPrompt,
          { projectMode: true, requireFileEdits: true, timeoutMs: effectiveIntent === 'visual_edit' ? 45000 : 120000 }
        );
        payload = sanitizeProjectEditPayload(retriedExecutor.payload, getCtx(), {
          text: txt,
          intent: effectiveIntent,
          allowFullReplace,
          isBuildRequest,
          activeFileEmpty
        });
        memoryPayload = normalizeExecutableForMemory(payload, getCtx(), { projectMode: true });
        executorResult = retriedExecutor;
        trackCost(retryInput, safeJSONStringify(payload));
        if (!hasProjectToolWork(memoryPayload) && effectiveIntent === 'visual_edit') {
          const localVisualFallback = buildLocalVisualFallbackPayload(getCtx(), activePlan);
          if (localVisualFallback) {
            payload = localVisualFallback;
            memoryPayload = normalizeExecutableForMemory(payload, getCtx(), { projectMode: true });
            executorResult = {
              ...executorResult,
              rawText: '[fallback local visual sobre archivo activo]',
              hadToolUse: true,
              payload
            };
          } else {
            const genericVisualFallback = buildGenericVisualUpgradeFallbackPayload(getCtx(), activePlan, txt, skillContext);
            if (genericVisualFallback) {
              payload = genericVisualFallback;
              memoryPayload = normalizeExecutableForMemory(payload, getCtx(), { projectMode: true });
              executorResult = {
                ...executorResult,
                rawText: '[fallback generic visual upgrade sobre archivo activo]',
                hadToolUse: true,
                payload
              };
            }
          }
        } else if (!hasProjectToolWork(memoryPayload) && isInteractiveControlRequest(txt)) {
          const localCallFallback = buildLocalCallActionFallbackPayload(getCtx(), txt, activePlan);
          if (localCallFallback) {
            payload = localCallFallback;
            memoryPayload = normalizeExecutableForMemory(payload, getCtx(), { projectMode: true });
            executorResult = {
              ...executorResult,
              rawText: '[fallback local interactive control sobre archivo activo]',
              hadToolUse: true,
              payload
            };
          }
        }
      } else {
        trackCost(executorCostInput, safeJSONStringify(payload));
      }

      rememberExecutableState({ plan: activePlan, memoryPayload });

      setTypingProgress(typingEl, {
        title: 'Calculando diff',
        detail: 'Comparando el antes y el después para preparar el resumen visual de cambios.',
        badge: 'diff'
      });
      let projectResult = applyProjectEdits(memoryPayload, { autoApply });
      let failureDiagnostic = projectResult.totalApplied === 0 || projectResult.totalFailed > 0
        ? buildApplyFailureDiagnostics(projectResult, {
            payload,
            memoryPayload,
            rawText: executorResult.rawText,
            hadToolUse: executorResult.hadToolUse,
            targetFiles: activePlan.targetFiles
          })
        : null;

      if (projectResult.totalApplied === 0) {
        const repairInput = `${buildTaskUserContent(txt, getCtx(), { kind: taskKind, omitCode: true })}\n\n${buildPlanSummaryBlock(activePlan, getCtx())}\n${buildTargetGuardBlock(activePlan, getCtx())}${buildInteractiveGuardBlock(txt, getCtx()) ? `\n${buildInteractiveGuardBlock(txt, getCtx())}` : ''}${safeBuildFolderMemoryContextBlock(txt)}\nUsa un snapshot fresco y fallback flexible.\nDiagnóstico previo:\n${buildFailureReport(failureDiagnostic)}${buildWorkspaceContext(getCtx(), profile, {
          forceWorkspace: true,
          intent: effectiveIntent,
          targetFiles: activePlan.targetFiles
        })}`;
        const repairPrompt = `${systemPrompt}
La propuesta anterior NO se pudo aplicar.
Diagnóstico:
${buildFailureReport(failureDiagnostic)}
Reintenta ahora usando SOLO files.edits con search exacto o start_line/end_line sobre ${activePlan.targetFiles.join(', ') || getCtx().filename}. Si el patrón no aparece, usa un bloque más corto, estable y cercano al objetivo. ${effectiveIntent === 'visual_edit' ? VISUAL_EXECUTION_RULES : ''}
No expliques nada.`;
        const repairedExecutor = await callClaudeWithTools(
          [...cleanHistory, { role:'user', content: repairInput }],
          repairPrompt,
          { projectMode: true, requireFileEdits: true, timeoutMs: effectiveIntent === 'visual_edit' ? 45000 : 120000 }
        );
        const safeRepairedPayload = sanitizeProjectEditPayload(repairedExecutor.payload, getCtx(), {
          text: txt,
          intent: effectiveIntent,
          allowFullReplace,
          isBuildRequest,
          activeFileEmpty
        });
        const repairedMemoryPayload = normalizeExecutableForMemory(safeRepairedPayload, getCtx(), { projectMode: true });
        const repairedResult = applyProjectEdits(repairedMemoryPayload, { autoApply });
        const repairedDiagnostic = repairedResult.totalApplied === 0 || repairedResult.totalFailed > 0
          ? buildApplyFailureDiagnostics(repairedResult, {
              payload: safeRepairedPayload,
              memoryPayload: repairedMemoryPayload,
              rawText: repairedExecutor.rawText,
              hadToolUse: repairedExecutor.hadToolUse,
              targetFiles: activePlan.targetFiles
            })
          : null;

        if (repairedResult.totalApplied > 0 || repairedResult.totalFailed < projectResult.totalFailed) {
          payload = safeRepairedPayload;
          memoryPayload = repairedMemoryPayload;
          projectResult = repairedResult;
          failureDiagnostic = repairedDiagnostic;
          executorResult = repairedExecutor;
          trackCost(repairInput, safeJSONStringify(safeRepairedPayload));
          rememberExecutableState({ plan: activePlan, memoryPayload });
        } else if (effectiveIntent === 'visual_edit') {
          const finalLocalVisualFallback = buildLocalVisualFallbackPayload(getCtx(), activePlan);
          if (finalLocalVisualFallback) {
            payload = finalLocalVisualFallback;
            memoryPayload = normalizeExecutableForMemory(payload, getCtx(), { projectMode: true });
            projectResult = applyProjectEdits(memoryPayload, { autoApply });
            failureDiagnostic = projectResult.totalApplied === 0 || projectResult.totalFailed > 0
              ? buildApplyFailureDiagnostics(projectResult, {
                  payload,
                  memoryPayload,
                  rawText: '[fallback local visual sobre archivo activo]',
                  hadToolUse: true,
                  targetFiles: activePlan.targetFiles
                })
              : null;
            rememberExecutableState({ plan: activePlan, memoryPayload });
          } else {
            const finalGenericVisualFallback = buildGenericVisualUpgradeFallbackPayload(getCtx(), activePlan, txt, skillContext);
            if (finalGenericVisualFallback) {
              payload = finalGenericVisualFallback;
              memoryPayload = normalizeExecutableForMemory(payload, getCtx(), { projectMode: true });
              projectResult = applyProjectEdits(memoryPayload, { autoApply });
              failureDiagnostic = projectResult.totalApplied === 0 || projectResult.totalFailed > 0
                ? buildApplyFailureDiagnostics(projectResult, {
                    payload,
                    memoryPayload,
                    rawText: '[fallback generic visual upgrade sobre archivo activo]',
                    hadToolUse: true,
                    targetFiles: activePlan.targetFiles
                  })
                : null;
              rememberExecutableState({ plan: activePlan, memoryPayload });
            }
          }
        } else if (isInteractiveControlRequest(txt)) {
          const finalInteractiveFallback = buildLocalCallActionFallbackPayload(getCtx(), txt, activePlan);
          if (finalInteractiveFallback) {
            payload = finalInteractiveFallback;
            memoryPayload = normalizeExecutableForMemory(payload, getCtx(), { projectMode: true });
            projectResult = applyProjectEdits(memoryPayload, { autoApply });
            failureDiagnostic = projectResult.totalApplied === 0 || projectResult.totalFailed > 0
              ? buildApplyFailureDiagnostics(projectResult, {
                  payload,
                  memoryPayload,
                  rawText: '[fallback local interactive control sobre archivo activo]',
                  hadToolUse: true,
                  targetFiles: activePlan.targetFiles
                })
              : null;
            rememberExecutableState({ plan: activePlan, memoryPayload });
          }
        }
      }

      setTypingProgress(typingEl, {
        title: projectResult.totalApplied > 0 ? 'Patch listo' : 'Patch sin cambios',
        detail: projectResult.totalApplied > 0
          ? (projectResult.effectiveAutoApply
              ? 'Los cambios ya se aplicaron al editor. Preparando el resumen visual.'
              : 'Los cambios quedaron listos para aplicar. Preparando el resumen visual.')
          : 'No pude obtener cambios aplicables todavía. Generando diagnóstico.',
        badge: projectResult.totalApplied > 0 ? 'patch' : 'retry',
        projectResult: projectResult.totalApplied > 0 ? projectResult : null
      });
      typingEl?.remove();
      const applySummary = summarizeProjectApplyResult(projectResult, {
        intent: effectiveIntent,
        memoryPayload
      });
      rememberExecutableState({
        plan: activePlan,
        memoryPayload,
        applySummary,
        failure: failureDiagnostic
      });

      if (projectResult.totalApplied > 0) {
        safeUpdateProgBrainFromOutcome({
          summary: applySummary?.headline || `${projectResult.totalApplied} cambios aplicables`,
          intent: effectiveIntent,
          targetFiles: extractTargetFilesFromOperations(memoryPayload),
          success: true
        });
        // Mapa de secciones recalculado del archivo YA editado: queda fresco y evoluciona.
        const freshCtx = getCtx();
        const sectionOutline = freshCtx.code.split('\n').length >= FOCUS_MIN_LINES
          ? buildStructureOutline(buildSectionIndex(freshCtx.code, freshCtx.type))
          : '';
        await appendFolderMemoryEvent({
          user: txt,
          assistant: `[${effectiveIntent}: ${projectResult.totalApplied} cambios]`,
          outcome: applySummary?.headline || `${projectResult.totalApplied} cambios aplicables`,
          targetFiles: extractTargetFilesFromOperations(memoryPayload),
          success: true,
          sectionMap: sectionOutline,
          sectionFile: freshCtx.filename
        });
        appendProjectResultCard(projectResult, {
          badge: effectiveIntent === 'visual_edit' ? 'visual_edit' : profile.label,
          title: effectiveIntent === 'visual_edit'
            ? (projectResult.effectiveAutoApply
                ? `${projectResult.totalApplied} cambios visuales aplicados en ${projectResult.changedFiles} archivo${projectResult.changedFiles !== 1 ? 's' : ''}`
                : `${projectResult.totalApplied} cambios visuales listos en ${projectResult.changedFiles} archivo${projectResult.changedFiles !== 1 ? 's' : ''}`)
            : null
        });
        iaToast(projectResult.effectiveAutoApply
          ? `✦ ${projectResult.totalApplied} cambio${projectResult.totalApplied !== 1 ? 's' : ''} aplicado${projectResult.totalApplied !== 1 ? 's' : ''}`
          : `⏸ ${projectResult.totalApplied} cambio${projectResult.totalApplied !== 1 ? 's' : ''} pendiente${projectResult.totalApplied !== 1 ? 's' : ''}`);
        if (failureDiagnostic && projectResult.totalFailed > 0) {
          appendApplyFailureMessage(failureDiagnostic, () => send(`reintenta con snapshot fresco y fallback flexible: ${txt}`));
        }
        // Fase 3: verificar en el preview lo recien escrito y reparar (max 1 turno).
        await verifyPreviewAndRepairAfterApply({
          txt,
          activePlan,
          systemPrompt,
          effectiveIntent,
          autoApply: projectResult.effectiveAutoApply,
          cleanHistory,
          profile,
          memoryPayload
        });
      } else {
        safeUpdateProgBrainFromOutcome({
          summary: failureDiagnostic?.headline || 'No se pudo aplicar ningun cambio',
          intent: effectiveIntent,
          targetFiles: activePlan.targetFiles,
          success: false
        });
        await appendFolderMemoryEvent({
          user: txt,
          assistant: shortText(executorResult.rawText || safeJSONStringify(payload), 600),
          outcome: failureDiagnostic?.headline || 'No se pudo aplicar ningun cambio',
          targetFiles: activePlan.targetFiles,
          success: false
        });
        appendApplyFailureMessage(failureDiagnostic || {
          code: 'no_changes_applied',
          reason: 'No se pudo aplicar ningún cambio.',
          file: (activePlan.targetFiles || []).join(', '),
          responsePreview: shortText(executorResult.rawText || safeJSONStringify(payload), 280),
          canRetry: true
        }, () => send(`reintenta con snapshot fresco y fallback flexible: ${txt}`));
        iaToast('No se pudo aplicar ningún cambio', 'err');
      }

      if (effectiveIntent === 'fix_edit' && projectResult.totalApplied > 0) {
        const explainMsg = [{ role:'user', content:`Hiciste ${projectResult.totalApplied} correcciones al código. Resume en español en máximo 3 oraciones qué problemas encontraste y qué corregiste. No muestres código.` }];
        const explanation = await callClaudeStream(explainMsg, 'Eres un asistente. Responde en español, máximo 3 oraciones.', () => {});
        trackCost(explainMsg[0].content, explanation);
        addMsg('assistant', explanation, false);
      }

      history.push({ role:'user', content:txt });
      history.push({ role:'assistant', content:`[${effectiveIntent}: ${projectResult.totalApplied} cambios]` });
      saveHist();

      // ── Bucle de agente: si la meta aun no se cumple, encadena el siguiente paso ──
      // Solo si se aplico algo y quedan pasos. La decision se toma con el modelo (cobra).
      if (projectResult.totalApplied > 0 && agentStepsLeft > 0) {
        const decision = await decideAgentContinue(agentGoal || txt, applySummary?.headline);
        if (!decision.done && decision.next) {
          agentStepsLeft--;
          pendingAgentStep = decision.next;
          const stepNo = AGENT_MAX_STEPS - agentStepsLeft;
          addMsg('assistant', `▶ Paso ${stepNo} del agente: ${decision.next}`, false);
        } else {
          agentStepsLeft = 0;
        }
      }
    } catch(err) {
      typingEl?.remove();
      const status = Number(err?.status) || 0;
      const retryable = isRetryableAIError(err);
      const e = status === 401 || err.message.includes('401') ? '❌ Sesión/Plan inválido'
        : retryable ? `⚠️ ${formatRetryableErrorLabel(err)}`
        : status === 429 || err.message.includes('429') ? '⚠️ Límite alcanzado'
        : status === 403 ? '🔒 La IA de LTH Prog requiere plan Pro'
        : '❌ ' + err.message;
      if (retryable) {
        appendRetryableAIErrorMessage(err, txt);
      } else {
        addMsg('assistant', e);
      }
      safeUpdateProgBrainFromOutcome({
        summary: e,
        intent: self.state?.lastPlan?.intent || intentMeta.intent || 'project_edit',
        targetFiles: self.state?.lastTargetFiles || intentMeta.explicitTargets || [],
        success: false
      });
      await appendFolderMemoryEvent({
        user: txt,
        assistant: e,
        outcome: e,
        targetFiles: self.state?.lastTargetFiles || intentMeta.explicitTargets || [],
        success: false
      });
      iaToast(e,'err');
      // Corta cualquier continuacion pendiente del agente ante un error.
      pendingAgentStep = null; agentStepsLeft = 0;
    } finally {
      isLoading=false; if(sendBtn)sendBtn.disabled=false; if(input){input.disabled=false;input.focus();}
      // Encadena el siguiente paso del agente FUERA del lock (cada paso cobra al wallet).
      if (pendingAgentStep) {
        const nextStep = pendingAgentStep; pendingAgentStep = null;
        setTimeout(() => { void send(nextStep, { _cont: true }); }, 80);
      }
    }
  };

  input?.addEventListener('input', () => { input.style.height='auto'; input.style.height=Math.min(input.scrollHeight,100)+'px'; });
  input?.addEventListener('keydown', (e) => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();} });
  sendBtn?.addEventListener('click', () => send());
  container.addEventListener('click', (e) => { if(e.target.closest('.file-tab')&&isOpen) setTimeout(updateCtxBar,50); });

  // ── Selection change detection ──
  const watchSelection = () => {
    if (self.editor?.on) {
      self.editor.on('cursorActivity', () => { if (isOpen) updateCtxBar(); });
    }
  };
  setTimeout(watchSelection, 2000);

  // ── Attach files logic ──
  const renderAttachChips = () => {
    if (!attachChips) return;
    attachChips.innerHTML = '';
    attachedFiles.forEach((af, i) => {
      const chip = document.createElement('span');
      chip.className = 'ia-attached-chip';
      chip.innerHTML = `<span class="ia-attached-chip-name">${af.name}</span><span class="ia-attached-chip-x" data-idx="${i}">×</span>`;
      chip.querySelector('.ia-attached-chip-x').onclick = () => { attachedFiles.splice(i, 1); renderAttachChips(); updateCtxBar(); };
      attachChips.appendChild(chip);
    });
    if (attachBar) attachBar.classList.toggle('hidden', attachedFiles.length === 0);
  };

  attachBtn?.addEventListener('click', () => {
    const filesList = self.state?.filesList || [];
    const activeId = self.state?.activeFileId;
    const available = filesList.filter(f => f.id !== activeId && !attachedFiles.some(a => a.name === f.name));
    if (!available.length) { iaToast('No hay más archivos para adjuntar', 'err'); return; }
    // Show quick picker
    const picker = document.createElement('div');
    picker.style.cssText = 'position:absolute;bottom:100%;left:0;right:0;background:rgba(10,10,30,.95);border:1px solid rgba(99,102,241,.25);border-radius:8px;padding:4px;z-index:999;max-height:150px;overflow-y:auto;';
    available.forEach(f => {
      const btn = document.createElement('button');
      btn.style.cssText = 'display:block;width:100%;padding:5px 8px;background:none;border:none;color:#a5b4fc;font-size:11px;text-align:left;cursor:pointer;border-radius:5px;';
      btn.textContent = f.name;
      btn.onmouseenter = () => btn.style.background='rgba(99,102,241,.2)';
      btn.onmouseleave = () => btn.style.background='none';
      btn.onclick = () => {
        attachedFiles.push({ name: f.name, content: f.content || '' });
        renderAttachChips();
        updateCtxBar();
        picker.remove();
      };
      picker.appendChild(btn);
    });
    attachBar.style.position = 'relative';
    attachBar.appendChild(picker);
    const dismiss = (e) => { if (!picker.contains(e.target) && e.target !== attachBtn) { picker.remove(); document.removeEventListener('click', dismiss); } };
    setTimeout(() => document.addEventListener('click', dismiss), 50);
  });

}).call(this);

// ✅ RENOMBRAR archivo por UI
const sanitizeName = (name) => {
  // quita cosas raras, deja algo seguro
  name = String(name || '').trim();
  name = name.replace(/[<>:"|?*\x00-\x1F]/g, '').replace(/\s+/g,' ');
  return name;
};

const getExt = (n) => (String(n).split('.').pop() || '').toLowerCase();
const extToType = (ext) => fileNameToEditorType(`file.${ext || 'txt'}`);

const isValidName = (n) => {
  if (!n) return false;
  if (n.length > 80) return false;
  if (!/^[^\\/]+$/.test(n)) return false; // no rutas
  return isSupportedTextFile({ name: n, size: 0 });
};

const renameActiveFile = async (newNameRaw) => {
  const list = this.state.filesList || [];
  const active = list.find(f => f.id === this.state.activeFileId);
  if (!active) return;
  const previousStorageKey = getFileStateStorageKey(active);

  let newName = sanitizeName(newNameRaw);
  if (!isValidName(newName)) {
    this.showNotification('❌ Nombre inválido');
    return;
  }

  // Si no trae extensión, conserva la del archivo actual
  if (!newName.includes('.')) {
    const oldExt = getExt(active.name || '');
    if (oldExt) newName += '.' + oldExt;
  }

  const newExt  = getExt(newName);
  const newType = extToType(newExt);

  // Evitar duplicados por nombre (case-insensitive)
  const dup = list.some(f =>
    f.id !== active.id &&
    String(f.name || '').trim().toLowerCase() === String(newName).trim().toLowerCase()
  );
  if (dup) {
    this.showNotification('⚠️ Ya existe un archivo con ese nombre');
    return;
  }

  // ✅ Actualizar modelo principal
  active.name = newName;
  active.type = newType;

  // Si cambió de tipo, el editor debe seguir el tipo nuevo
  this.state.editorTab = newType;

  // ✅ Legacy SIEMPRE sincronizado (esto evita el "rebote" a defaults)
  if (!this.state.files) this.state.files = { html:{}, css:{}, js:{}, py:{} };

  // Asegura estructura mínima
  if (!this.state.files.html) this.state.files.html = {};
  if (!this.state.files.css)  this.state.files.css  = {};
  if (!this.state.files.js)   this.state.files.js   = {};
  if (!this.state.files.py)   this.state.files.py   = {};

  // Importante: mantener el name del tipo ACTIVO actualizado
  this.state.files[newType].name = newName;

  // (Opcional pero recomendado) Mantén content del legacy en sync con el archivo activo
  // por si tu saveProject usa this.state.files.*.content
  if (typeof active.content === 'string') {
    this.state.files[newType].content = active.content;
  }

  // ✅ Refrescar modo del editor
  const modes = {
    html: 'htmlmixed',
    css: 'css',
    js: 'javascript',
    py: 'python',
    json: 'application/json',
    md: 'markdown',
    sql: 'text/x-sql',
    shell: 'shell',
    cpp: 'text/x-c++src',
    csharp: 'text/x-csharp',
    java: 'text/x-java',
    kotlin: 'text/x-kotlin',
    swift: 'text/x-swift',
    go: 'text/x-go',
    rust: 'text/x-rustsrc',
    php: 'application/x-httpd-php',
    ruby: 'ruby',
    dart: 'text/x-dart',
    docker: 'dockerfile',
    makefile: 'text/x-makefile',
    txt: 'text/plain'
  };
  if (this.editor?.setOption) this.editor.setOption('mode', modes[newType] || 'htmlmixed');

  // ✅ Actualizar UI segura (si el nodo existe)
  if (typeof currentFileName !== 'undefined' && currentFileName) {
    currentFileName.textContent = newName;
      // ✅ Persistir rename si hay proyecto cargado
  if (!this._isLoadingProject && window.electron?.fs && this.state.currentProject) {
    try {
      // asegurar que editor/tab y legacy estén alineados
      this._syncLegacyFiles && this._syncLegacyFiles();

      const projectData = {
        name: this.state.currentProject,
        filesList: (this.state.filesList || []).map(f => ({
          id: f.id,
          name: f.name,
          type: f.type,
          path: f.path || null,
          content: f.content || ''
        })),
        activeFileId: this.state.activeFileId || null,
        files: {
          html: { ...this.state.files.html },
          css:  { ...this.state.files.css  },
          js:   { ...this.state.files.js   }
        },
        device: this.state.device,
        split: this.state.split,
        lastModified: new Date().toISOString()
      };

      await _ProgFS.saveProject(this.state.currentProject, projectData);
      // ❌ No guardar lastProject — app abre limpia al iniciar
      // await _ProgFS.saveAppConfig('lth-prog', { lastProject: this.state.currentProject });
      this.state.lastSaved = new Date().toISOString();

      // opcional: mini feedback
      // this.showNotification('💾 Nombre guardado en el proyecto');
    } catch (e) {
      console.warn('No se pudo persistir rename:', e);
    }
  }

  }

  // ✅ Re-render tabs si aplica (para que el label se actualice)
  this._renderDynamicTabs && this._renderDynamicTabs();

  // ✅ Si tienes syncLegacyFiles, llámala pero SIN pisar names con defaults
  this._syncLegacyFiles && this._syncLegacyFiles();
  persistFileState(active);
  if (previousStorageKey !== getFileStateStorageKey(active)) removeStoredFileState(previousStorageKey);
  persistSessionMeta();

  // ✅ Marca “dirty” / dispara autosave si lo usas
  this.state.lastSaved = null;
};

const startInlineRename = () => {
  const active = (this.state.filesList || []).find(f => f.id === this.state.activeFileId);
  if (!active || !currentFileName) return;

  // si ya hay input, no duplicar
  if (currentFileName.dataset.renaming === '1') return;

  currentFileName.dataset.renaming = '1';
  currentFileName.classList.add('renaming');

  const oldText = active.name || currentFileName.textContent || 'Sin nombre';

  // crear input reemplazando el texto
  const input = document.createElement('input');
  input.className = 'rename-input';
  input.value = oldText;

  const hint = document.createElement('span');
  hint.className = 'rename-hint';
  hint.textContent = 'Enter = guardar • Esc = cancelar';

  const parent = currentFileName.parentElement;
  if (!parent) return;

  // ocultar texto y poner input
  currentFileName.style.display = 'none';
  parent.appendChild(input);
  parent.appendChild(hint);
let _renameFinished = false;

const finish = async (commit) => {
  if (_renameFinished) return;
  _renameFinished = true;

  // cortar eventos para que NO se dispare doble (Enter dispara blur también)
  input.onblur = null;
  input.onkeydown = null;

  const next = input.value; // guarda antes de quitar el input

  // limpiar UI (seguro, sin error de remove)
  if (input && input.isConnected) input.remove();
  if (hint && hint.isConnected) hint.remove();

  currentFileName.style.display = '';
  currentFileName.classList.remove('renaming');
  delete currentFileName.dataset.renaming;

  if (commit) {
    if (next !== oldText) await renameActiveFile(next);
    else currentFileName.textContent = oldText;
  } else {
    currentFileName.textContent = oldText;
  }
};


  input.focus();
  input.select();

  // ✅ anti doble-disparo (Enter → blur)
  let _renameDone = false;

  const safeFinish = async (commit) => {
    if (_renameDone) return;
    _renameDone = true;

    // mata eventos antes de remover el input (evita blur tardío)
    try { input.onblur = null; input.onkeydown = null; } catch {}

    await finish(commit);
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); safeFinish(true); }
    else if (e.key === 'Escape') { e.preventDefault(); safeFinish(false); }
  });

  input.addEventListener('blur', () => safeFinish(true));
};


// doble click en nombre para renombrar
currentFileName?.addEventListener('dblclick', (e) => {
  e.preventDefault();
  e.stopPropagation();
  startInlineRename();
});

      const editorStatus = container.querySelector('#editorStatus');
      const editorInfo = container.querySelector('#editorInfo');
      const devicePcBtn = container.querySelector('#devicePcBtn');
      const newExtraFileBtn = container.querySelector('#newExtraFileBtn');

      const devicePhoneBtn = container.querySelector('#devicePhoneBtn');
      const splitBtn = container.querySelector('#splitBtn');
      const liveBtn = container.querySelector('#liveBtn');
      const previewFrame = container.querySelector('#previewFrame');
      const liveFrame = container.querySelector('#liveFrame');
      const fileTabsHost = container.querySelector('#fileTabs');


      const FS = {
        async openDialog(opts) {
          if (window.electron?.fs?.selectFile) return window.electron.fs.selectFile(opts);
          if (window.FileSystem?.openFileDialog) return window.FileSystem.openFileDialog(opts);
          throw new Error('No hay API para abrir archivos');
        },
        async writeFile(path, content) {
          if (window.electron?.fs?.writeFile) return window.electron.fs.writeFile({ path, content });
          if (window.FileSystem?.writeFile) return window.FileSystem.writeFile(path, content);
          throw new Error('No hay API para guardar');
        },
        async saveAsDialog(content, defaultName, filters) {
          // ✅ FIX: preload expone saveFileAs, no saveFile
          if (window.electron?.fs?.saveFileAs) return window.electron.fs.saveFileAs(content, { defaultName, filters });
          if (window.electron?.fs?.saveFile)   return window.electron.fs.saveFile({ content, defaultName, filters });
          if (window.FileSystem?.saveFileDialog) return window.FileSystem.saveFileDialog(content, defaultName, filters);
          throw new Error('No hay API para Guardar Como');
        }
      };
      this._FS = FS;

      // 🔧 COMPAT BRIDGE: mantener vivo el código viejo que usa this.state.files.html/css/js
this._getActiveFile = () =>
  (this.state.filesList || []).find(f => f.id === this.state.activeFileId) || null;

this._getPreferActiveByType = (t) => {
  const active = this._getActiveFile();
  if (active && active.type === t) return active;
  return (this.state.filesList || []).find(f => f.type === t) || null;
};

this._syncLegacyFiles = () => {
  const list = this.state.filesList || [];

  const byTypePreferActive = (type) => {
    const active = list.find(f => f.id === this.state.activeFileId && f.type === type);
    return active || list.find(f => f.type === type) || null;
  };

  const html = byTypePreferActive('html');
  const css  = byTypePreferActive('css');
  const js   = byTypePreferActive('js');

  // legacy container
  this.state.files = this.state.files || { html: {content:''}, css: {content:''}, js: {content:''} };

  // copia segura (evita referencias raras)
  this.state.files.html = html ? { ...html } : { content: '' };
  this.state.files.css  = css  ? { ...css  } : { content: '' };
  this.state.files.js   = js   ? { ...js   } : { content: '' };
};

const DRAFT_STORAGE_PREFIX = 'lth-prog:file-state:v3:';
const SESSION_STORAGE_KEY = 'lth-prog:session:v3';
let _draftPersistTimer = null;
let _chromeRefreshRaf = 0;
let _isRestoringEditorView = false;

const toText = (value) => typeof value === 'string' ? value : (value == null ? '' : String(value));
const comparableFileText = (value) => toText(value).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
const hasMeaningfulContentChange = (current, saved) =>
  comparableFileText(current) !== comparableFileText(saved);
const parseJSONSafe = (raw, fallback = null) => {
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
};

// ── Helpers compartidos con el bloque IA (mismo patron que ensureAiWorkspaceFolder) ──
// Las funciones de memoria fisica (.md) y brain viven AQUI, en el scope del IIFE
// externo; las copias originales de estos helpers estan DENTRO de initIABlock
// (4333-9248) y no son visibles desde aca. Sin estas copias, cada turno IA tronaba
// con "shortText is not defined" (y luego normalizePlannerIntent / escapeRegExp),
// dejando el brain y la memoria de carpeta sin actualizar en silencio.
const shortText = (value, max = 160) => {
  const raw = String(value ?? '').replace(/\s+/g, ' ').trim();
  return raw.length > max ? `${raw.slice(0, Math.max(0, max - 1))}…` : raw;
};
const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizePlannerIntent = (value, fallback = 'chat') => (
  ['chat', 'project_edit', 'visual_edit', 'fix_edit'].includes(String(value || '').trim())
    ? String(value || '').trim()
    : fallback
);
const clipForAI = (text, maxChars) => {
  const raw = String(text || '');
  if (raw.length <= maxChars) return raw;
  const head = Math.floor(maxChars * 0.58);
  const tail = maxChars - head;
  return `${raw.slice(0, head)}\n\n/* ... contenido recortado por eficiencia ... */\n\n${raw.slice(-tail)}`;
};

const buildWorkspaceKey = (mode, currentProject, folderPath) => {
  if (mode === 'folder' && folderPath) return `folder:${String(folderPath).toLowerCase()}`;
  if (currentProject) return `project:${String(currentProject).toLowerCase()}`;
  return 'scratch:default';
};

const getWorkspaceKey = (state = this.state) =>
  buildWorkspaceKey(state?.workspaceMode, state?.currentProject, state?.folderPath);

const FOLDER_MEMORY_FILENAME = '.lth-prog-memory.md';
const FOLDER_MEMORY_TITLE = 'lth.code.md';
const FOLDER_MEMORY_VERSION = 2;
const TEXT_FILE_EXTENSIONS = new Set([
  'html', 'htm', 'css', 'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx',
  'py', 'json', 'md', 'markdown', 'txt', 'yml', 'yaml', 'env',
  'sql', 'xml', 'svg', 'vue', 'svelte', 'astro',
  'c', 'h', 'cpp', 'cc', 'cxx', 'hpp', 'hxx', 'cs', 'java',
  'kt', 'kts', 'swift', 'go', 'rs', 'php', 'rb', 'dart', 'lua',
  'sh', 'bash', 'zsh', 'ps1', 'r', 'scala', 'clj', 'ex', 'exs',
  'erl', 'hrl', 'fs', 'fsx', 'vb', 'pl', 'pm', 'toml', 'ini',
  'conf', 'graphql', 'gql', 'proto', 'gradle'
]);
const TEXT_FILE_NAMES = new Set([
  'dockerfile', 'makefile', 'readme', 'license', 'gemfile', 'rakefile'
]);
const BINARY_SKIP_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'avif', 'mp4', 'mov',
  'zip', 'rar', '7z', 'exe', 'dll', 'pdf', 'woff', 'woff2', 'ttf', 'otf'
]);
const MAX_FOLDER_FILE_BYTES = 1024 * 1024;

const getFileExt = (name = '') => {
  const clean = String(name || '').trim();
  const parts = clean.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
};

const isFolderMemoryFileName = (name = '') =>
  String(name || '').trim().toLowerCase() === FOLDER_MEMORY_FILENAME;

const fileNameToEditorType = (name = '') => {
  const baseName = String(name || '').split(/[\\/]/).pop().toLowerCase();
  const ext = getFileExt(name);
  if (baseName === 'dockerfile' || ext === 'dockerfile') return 'docker';
  if (baseName === 'makefile') return 'makefile';
  if (['c', 'h', 'cpp', 'cc', 'cxx', 'hpp', 'hxx'].includes(ext)) return 'cpp';
  if (ext === 'cs') return 'csharp';
  if (ext === 'java') return 'java';
  if (['kt', 'kts'].includes(ext)) return 'kotlin';
  if (ext === 'swift') return 'swift';
  if (ext === 'go') return 'go';
  if (ext === 'rs') return 'rust';
  if (ext === 'php') return 'php';
  if (ext === 'rb') return 'ruby';
  if (ext === 'dart') return 'dart';
  if (['sh', 'bash', 'zsh', 'ps1'].includes(ext)) return 'shell';
  if (ext === 'sql') return 'sql';
  if (ext === 'css') return 'css';
  if (['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx'].includes(ext)) return 'js';
  if (ext === 'py') return 'py';
  if (['json', 'yml', 'yaml'].includes(ext)) return 'json';
  if (['md', 'markdown'].includes(ext)) return 'md';
  if (['txt', 'env', 'sql', 'xml', 'svg', 'vue', 'svelte', 'astro'].includes(ext)) return 'txt';
  if (ext === 'html' || ext === 'htm') return 'html';
  return 'txt';
};

const isSupportedTextFile = (entry = {}) => {
  const rawName = String(entry.name || entry.path || '');
  const baseName = rawName.split(/[\\/]/).pop().toLowerCase();
  const ext = getFileExt(rawName);
  if (!ext && !TEXT_FILE_NAMES.has(baseName)) return false;
  if (BINARY_SKIP_EXTENSIONS.has(ext)) return false;
  if (ext && !TEXT_FILE_EXTENSIONS.has(ext)) return false;
  const size = Number(entry.size || 0);
  return !size || size <= MAX_FOLDER_FILE_BYTES;
};

const normalizeRelativePath = (value = '') => String(value || '')
  .replace(/\\/g, '/')
  .replace(/^\/+/, '')
  .trim();

const getDisplayFileName = (file = {}) =>
  normalizeRelativePath(file.relativePath || file.workspaceRelativePath || file.name || '').split('/').pop() || file.name || 'archivo';

const getFolderMemoryPath = (folderPath = self.state?.folderPath) => {
  const base = String(folderPath || '').replace(/[\\/]+$/, '');
  return base ? `${base}\\${FOLDER_MEMORY_FILENAME}` : null;
};

const getAutoAiWorkspacePath = () => {
  const base = String(_ProgFS._projDir?.() || _ProgFS._appDataDir?.('lth-prog') || '').replace(/[\\/]+$/, '');
  return base ? `${base}\\app` : '';
};

const writeTextFileSafe = async (filePath, content = '') => {
  if (!filePath || !window.electron?.fs?.writeFile) return { success: false, error: 'No hay ruta de escritura' };
  const result = await window.electron.fs.writeFile(filePath, String(content ?? ''));
  if (result?.success === false) throw new Error(result.error || 'No se pudo escribir archivo');
  return result || { success: true };
};

const sanitizeWorkspaceRelativePath = (value = '') => {
  const cleaned = normalizeRelativePath(value)
    .replace(/[<>:"|?*\x00-\x1F]/g, '')
    .split('/')
    .map(part => part.trim())
    .filter(part => part && part !== '.' && part !== '..')
    .join('/');
  return cleaned || 'index.html';
};

const ensureAiWorkspaceFolder = async () => {
  if (self.state?.workspaceMode === 'folder' && self.state?.folderPath) return self.state.folderPath;
  const folder = getAutoAiWorkspacePath();
  if (!folder) return '';
  try { await window.electron?.fs?.createFolder?.(folder, { recursive: true }); } catch {}
  self.state.workspaceMode = 'folder';
  self.state.currentProject = null;
  self.state.folderPath = folder;
  self.state.expandedFolderPaths = Array.from(new Set([...(self.state.expandedFolderPaths || []), folder]));
  self.state.folderMemoryPath = getFolderMemoryPath(folder);
  self.state.folderMemoryContext = self.state.folderMemoryContext || '';
  return folder;
};

const materializeFileOnDisk = async (file, contentOverride) => {
  if (!file) return null;
  const folder = await ensureAiWorkspaceFolder();
  if (!folder) return null;
  const safeRelative = sanitizeWorkspaceRelativePath(file.workspaceRelativePath || file.relativePath || file.name || 'index.html');
  const filePath = file.path || `${String(folder).replace(/[\\/]+$/, '')}\\${safeRelative.replace(/\//g, '\\')}`;
  file.path = filePath;
  file.name = file.name || safeRelative.split('/').pop() || 'index.html';
  file.type = file.type || fileNameToEditorType(file.name);
  file.relativePath = normalizeRelativePath(safeRelative);
  file.workspaceRelativePath = normalizeRelativePath(safeRelative);
  file.externalFolder = folder;
  const content = String(contentOverride ?? file.content ?? '');
  await writeTextFileSafe(filePath, content);
  const indexed = {
    name: file.name,
    path: filePath,
    relativePath: normalizeRelativePath(safeRelative),
    size: content.length,
    isDirectory: false
  };
  const key = normalizePathKey(filePath);
  const nextIndex = (self.state.folderFilesIndex || []).filter(item => normalizePathKey(item.path) !== key);
  nextIndex.push(indexed);
  self.state.folderFilesIndex = nextIndex;
  if (!self.state.folderTree || normalizePathKey(self.state.folderTree.path) !== normalizePathKey(folder)) {
    self.state.folderTree = {
      name: folder.split(/[\\/]/).pop() || 'app',
      path: folder,
      relativePath: '',
      isDirectory: true,
      children: nextIndex.map(item => ({ ...item }))
    };
  }
  return filePath;
};

const getBrainStorageKey = (workspaceKey = getWorkspaceKey()) =>
  `${IA_BRAIN_PREFIX}${encodeURIComponent(workspaceKey || 'scratch:default')}`;

const createEmptyProgBrain = (workspaceKey = getWorkspaceKey()) => ({
  version: 1,
  workspaceKey: workspaceKey || 'scratch:default',
  runningSummary: '',
  userGoal: '',
  activeTask: '',
  currentIntent: '',
  targetFiles: [],
  recentRequests: [],
  decisions: [],
  importantConstraints: [],
  lastKnownState: '',
  lastApplyHeadline: '',
  lastPreviewState: '',
  updatedAt: Date.now()
});

const normalizeBrainList = (value, max = 6, itemMax = 180) =>
  Array.from(new Set((Array.isArray(value) ? value : [])
    .map(item => shortText(item, itemMax))
    .filter(Boolean)))
    .slice(-max);

const normalizeProgBrain = (value, workspaceKey = getWorkspaceKey()) => {
  const base = createEmptyProgBrain(workspaceKey);
  if (!value || typeof value !== 'object') return base;
  return {
    ...base,
    version: Number(value.version) || 1,
    workspaceKey: String(value.workspaceKey || workspaceKey || base.workspaceKey),
    runningSummary: shortText(value.runningSummary, 700),
    userGoal: shortText(value.userGoal, 220),
    activeTask: shortText(value.activeTask, 220),
    currentIntent: shortText(value.currentIntent, 80),
    targetFiles: normalizeBrainList(value.targetFiles, 8, 80),
    recentRequests: normalizeBrainList(value.recentRequests, 6, 180),
    decisions: normalizeBrainList(value.decisions, 6, 180),
    importantConstraints: normalizeBrainList(value.importantConstraints, 6, 180),
    lastKnownState: shortText(value.lastKnownState, 260),
    lastApplyHeadline: shortText(value.lastApplyHeadline, 180),
    lastPreviewState: shortText(value.lastPreviewState, 220),
    updatedAt: Number(value.updatedAt) || Date.now()
  };
};

const readProgBrain = (workspaceKey = getWorkspaceKey()) =>
  normalizeProgBrain(parseJSONSafe(localStorage.getItem(getBrainStorageKey(workspaceKey)), null), workspaceKey);

const writeProgBrain = (brain, workspaceKey = getWorkspaceKey()) => {
  const next = normalizeProgBrain(brain, workspaceKey);
  next.updatedAt = Date.now();
  try {
    localStorage.setItem(getBrainStorageKey(workspaceKey), JSON.stringify(next));
  } catch (err) {
    console.warn('[LTH PROG] No se pudo persistir la memoria del workspace:', err);
  }
  self.state.lastBrainSnapshot = next;
  return next;
};

const mergeProgBrain = (patch = {}, workspaceKey = getWorkspaceKey()) => {
  const current = readProgBrain(workspaceKey);
  const next = normalizeProgBrain({
    ...current,
    ...patch,
    targetFiles: patch.targetFiles ?? current.targetFiles,
    recentRequests: patch.recentRequests ?? current.recentRequests,
    decisions: patch.decisions ?? current.decisions,
    importantConstraints: patch.importantConstraints ?? current.importantConstraints
  }, workspaceKey);
  return writeProgBrain(next, workspaceKey);
};

const extractBrainConstraints = (text = '') => {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const found = [];
  if (/\bno\s+rehag|no\s+reescrib|sin\s+rehacer|no\s+desde\s+cero\b/i.test(raw)) found.push('No rehacer desde cero; editar sobre lo existente.');
  if (/\bsolo\s+edita|solo\s+cambia|mant[eé]n|conserva\b/i.test(raw)) found.push('Conservar estructura y tocar solo lo pedido.');
  if (/\bhtml\b/i.test(raw) && /\bcrea|crear|genera|hazme|monta|arma\b/i.test(raw)) found.push('Si la tarea es web, priorizar proyecto HTML/CSS/JS.');
  return found;
};

const summarizeBrainPreview = () => {
  // getPreviewSnapshot vive dentro de initIABlock (usa `container`); desde este
  // scope no existe. typeof evita el ReferenceError y cae al snapshot cacheado.
  const preview = self.state?.lastPreviewSnapshot
    || (typeof getPreviewSnapshot === 'function' ? getPreviewSnapshot() : null);
  if (!preview) return '';
  const title = shortText(preview.title || preview.body || '', 80);
  const counts = preview.ready
    ? Object.entries(preview.counts || {})
      .filter(([, amount]) => Number(amount) > 0)
      .map(([key, amount]) => `${key}:${amount}`)
      .join(', ')
    : '';
  return shortText(`${preview.ready ? 'preview listo' : 'preview no listo'}${title ? ` | ${title}` : ''}${counts ? ` | ${counts}` : ''}`, 220);
};

// Nota de scope: los callers (initIABlock) SIEMPRE pasan ctx/intentMeta; los
// defaults son null porque getCtx/detectIntentMeta no existen en este scope.
const updateProgBrainFromUserTurn = (text, ctx = null, intentMeta = null) => {
  const raw = String(text || '').trim();
  if (!raw) return readProgBrain();
  const brain = readProgBrain();
  const nextRequests = [...brain.recentRequests, raw].slice(-6);
  const nextTargets = uniqStrings([
    ...brain.targetFiles,
    ...extractExplicitTargetFiles(raw),
    ctx?.filename || ''
  ]).filter(Boolean).slice(-8);
  const nextConstraints = normalizeBrainList([
    ...brain.importantConstraints,
    ...extractBrainConstraints(raw)
  ], 6, 180);
  const activeTask = shortText(raw, 220);
  const userGoal = brain.userGoal || activeTask;
  const runningBits = normalizeBrainList([
    brain.runningSummary,
    `Usuario: ${shortText(raw, 180)}`
  ], 6, 180);
  return mergeProgBrain({
    userGoal,
    activeTask,
    currentIntent: normalizePlannerIntent(intentMeta?.intent, 'project_edit'),
    targetFiles: nextTargets,
    recentRequests: nextRequests,
    importantConstraints: nextConstraints,
    runningSummary: runningBits.join(' | '),
    lastPreviewState: summarizeBrainPreview()
  });
};

const updateProgBrainFromPlan = (plan, ctx = null) => {
  if (!plan) return readProgBrain();
  const brain = readProgBrain();
  const nextTargets = uniqStrings([
    ...(brain.targetFiles || []),
    ...(Array.isArray(plan.targetFiles) ? plan.targetFiles : []),
    ctx?.filename || ''
  ]).filter(Boolean).slice(-8);
  const nextDecisions = normalizeBrainList([
    ...(brain.decisions || []),
    plan.strategy ? `Estrategia: ${plan.strategy}` : '',
    plan.changeType ? `Cambio: ${plan.changeType}` : ''
  ], 6, 180);
  return mergeProgBrain({
    userGoal: shortText(plan.userGoal || brain.userGoal || '', 220),
    activeTask: shortText(plan.strategy || brain.activeTask || '', 220),
    currentIntent: normalizePlannerIntent(plan.intent, brain.currentIntent || 'project_edit'),
    targetFiles: nextTargets,
    decisions: nextDecisions
  });
};

const updateProgBrainFromOutcome = ({ summary = '', intent = '', targetFiles = [], success = true, note = '' } = {}) => {
  const brain = readProgBrain();
  const summaryText = shortText(summary || note || '', 220);
  const statusLine = summaryText
    ? `${success ? 'OK' : 'Pendiente'}: ${summaryText}`
    : (success ? 'OK' : 'Pendiente');
  const nextDecisions = normalizeBrainList([
    ...(brain.decisions || []),
    summaryText
  ], 6, 180);
  const nextTargets = uniqStrings([
    ...(brain.targetFiles || []),
    ...(Array.isArray(targetFiles) ? targetFiles : [])
  ]).filter(Boolean).slice(-8);
  const runningBits = normalizeBrainList([
    brain.runningSummary,
    statusLine
  ], 6, 180);
  return mergeProgBrain({
    activeTask: success ? '' : (brain.activeTask || summaryText),
    currentIntent: intent ? normalizePlannerIntent(intent, brain.currentIntent || 'project_edit') : brain.currentIntent,
    targetFiles: nextTargets,
    decisions: nextDecisions,
    lastKnownState: statusLine,
    lastApplyHeadline: summaryText || brain.lastApplyHeadline,
    runningSummary: runningBits.join(' | '),
    lastPreviewState: summarizeBrainPreview()
  });
};

const buildProgBrainContextBlock = (query = '', options = {}) => {
  const brain = readProgBrain(options.workspaceKey || getWorkspaceKey());
  const lines = [];
  if (brain.runningSummary) lines.push(`- Resumen vivo: ${brain.runningSummary}`);
  if (brain.userGoal) lines.push(`- Meta activa del usuario: ${brain.userGoal}`);
  if (brain.activeTask) lines.push(`- Tarea en curso: ${brain.activeTask}`);
  if (brain.currentIntent) lines.push(`- Intent actual: ${brain.currentIntent}`);
  if (brain.targetFiles.length) lines.push(`- Archivos objetivo recientes: ${brain.targetFiles.join(', ')}`);
  if (brain.importantConstraints.length) lines.push(`- Restricciones importantes: ${brain.importantConstraints.join(' | ')}`);
  if (brain.decisions.length) lines.push(`- Decisiones recientes: ${brain.decisions.join(' | ')}`);
  if (brain.lastKnownState) lines.push(`- Ultimo estado conocido: ${brain.lastKnownState}`);
  if (brain.lastApplyHeadline) lines.push(`- Ultimo apply relevante: ${brain.lastApplyHeadline}`);
  if (brain.lastPreviewState) lines.push(`- Estado del preview: ${brain.lastPreviewState}`);
  if (brain.recentRequests.length) lines.push(`- Ultimos pedidos del usuario: ${brain.recentRequests.join(' | ')}`);
  if (!lines.length) return '';
  return `\n\nMEMORIA DEL WORKSPACE (LTH PROG):\n${lines.join('\n')}\nUsa esta memoria para continuar el proyecto sin rehacer desde cero, resolver referencias como "eso", "lo anterior" o "ese archivo", y mantener coherencia entre pasos. Peticion actual: ${shortText(query, 180)}`;
};

const safelyRunProgBrain = (fn, fallback = null) => {
  try {
    return fn();
  } catch (err) {
    console.warn('[LTH PROG] Memoria desactivada en este turno:', err?.message || err);
    return fallback;
  }
};

const safeUpdateProgBrainFromUserTurn = (text, ctx = null, intentMeta = null) =>
  safelyRunProgBrain(() => updateProgBrainFromUserTurn(text, ctx, intentMeta), null);

const safeUpdateProgBrainFromPlan = (plan, ctx = null) =>
  safelyRunProgBrain(() => updateProgBrainFromPlan(plan, ctx), null);

const safeUpdateProgBrainFromOutcome = (payload = {}) =>
  safelyRunProgBrain(() => updateProgBrainFromOutcome(payload), null);

const safeBuildProgBrainContextBlock = (query = '', options = {}) =>
  safelyRunProgBrain(() => buildProgBrainContextBlock(query, options), '');

const flattenFolderTreeFiles = (node, acc = []) => {
  if (!node) return acc;
  if (node.isDirectory) {
    (node.children || []).forEach(child => flattenFolderTreeFiles(child, acc));
  } else {
    acc.push(node);
  }
  return acc;
};

const getFolderTreeStats = () => {
  const tree = self.state?.folderTree;
  const files = Array.isArray(self.state?.folderFilesIndex) && self.state.folderFilesIndex.length
    ? self.state.folderFilesIndex
    : flattenFolderTreeFiles(tree, []);
  const memoryFiles = files.filter(file => file && !isFolderMemoryFileName(file.name) && isSupportedTextFile(file));
  const folders = [];
  const visit = (node) => {
    if (!node?.isDirectory) return;
    if (node.relativePath) folders.push(node);
    (node.children || []).forEach(visit);
  };
  visit(tree);
  const byExt = {};
  memoryFiles.forEach((file) => {
    const ext = getFileExt(file.name || file.path || '') || 'sin-ext';
    byExt[ext] = (byExt[ext] || 0) + 1;
  });
  return { files: memoryFiles, allFiles: files, folders, byExt };
};

const findLoadedFileForMemoryEntry = (entry = {}) => {
  const pathKey = normalizePathKey(entry.path || '');
  const relKey = normalizeRelativePath(entry.relativePath || entry.name || '').toLowerCase();
  const nameKey = normalizeNameKey(entry.name || '');
  return (self.state?.filesList || []).find(file => {
    if (pathKey && normalizePathKey(file.path || '') === pathKey) return true;
    if (relKey && normalizeRelativePath(file.workspaceRelativePath || file.relativePath || file.name || '').toLowerCase() === relKey) return true;
    return nameKey && normalizeNameKey(file.name || '') === nameKey;
  }) || null;
};

const summarizeFileForFolderMemory = (entry = {}) => {
  const loaded = findLoadedFileForMemoryEntry(entry);
  const content = String(loaded?.content || '').slice(0, 50000);
  if (!content) return '';
  const hints = [];
  const title = content.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    || content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    || '';
  const cleanTitle = shortText(title.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), 80);
  if (cleanTitle) hints.push(cleanTitle);
  const keywordRules = [
    { re: /\b(avion|avión|plane|ship|nave|skies|missi[oó]n)\b/i, label: 'juego/nave/avion' },
    { re: /\b(speed|velocidad|boost|vx|vy)\b/i, label: 'velocidad/movimiento' },
    { re: /\b(solar|planeta|planetas|orbit|órbita|sol)\b/i, label: 'sistema solar' },
    { re: /\b(zapato|calzado|producto|carrito|tienda|precio)\b/i, label: 'tienda/calzado' },
    { re: /\b(landing|software|desarrollo|servicios|proyectos|contacto)\b/i, label: 'landing/software' }
  ];
  keywordRules.forEach(rule => {
    if (rule.re.test(content) && !hints.includes(rule.label)) hints.push(rule.label);
  });
  return hints.slice(0, 4).join('; ');
};

const buildFolderTreeSummaryBlock = (limit = 90) => {
  if (self.state?.workspaceMode !== 'folder' || !self.state?.folderTree) return '';
  const { files, folders, byExt } = getFolderTreeStats();
  const fileLines = files
    .filter(file => !isFolderMemoryFileName(file.name))
    .slice(0, limit)
    .map(file => {
      const summary = summarizeFileForFolderMemory(file);
      return `- ${normalizeRelativePath(file.relativePath || file.name)} (${getFileExt(file.name) || 'archivo'}, ${Math.round(Number(file.size || 0) / 1024)} KB)${summary ? ` - ${summary}` : ''}`;
    });
  const omitted = Math.max(0, files.length - fileLines.length);
  const extLine = Object.entries(byExt)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([ext, count]) => `${ext}:${count}`)
    .join(', ') || 'sin archivos';
  return `\n\n--- Mapa de carpeta abierta ---\nRaiz: ${self.state.folderPath || ''}\nCarpetas indexadas: ${folders.length}\nArchivos indexados: ${files.length}\nTipos: ${extLine}\nArchivos principales:\n${fileLines.join('\n') || '- sin archivos de texto/codigo visibles'}${omitted ? `\n... ${omitted} archivos mas omitidos del mapa corto.` : ''}`;
};

const buildFolderMemoryFileRoles = (limit = 80) => {
  const { files } = getFolderTreeStats();
  const lines = files
    .filter(file => !isFolderMemoryFileName(file.name))
    .slice(0, limit)
    .map(file => {
      const rel = normalizeRelativePath(file.relativePath || file.name);
      const summary = summarizeFileForFolderMemory(file);
      return `- ${rel}: ${summary || `${getFileExt(file.name) || 'archivo'} editable; rol pendiente de confirmar`}`;
    });
  return lines.join('\n') || '- pendiente: aun no hay archivos editables indexados.';
};

const buildFolderMemoryHealthBlock = () => {
  const { files } = getFolderTreeStats();
  const trusted = isTrustedFolderMemoryContent(self.state?.folderMemoryContext || '');
  const hasRoles = files.length > 0;
  const status = trusted && hasRoles ? 'confiable' : 'requiere reindexacion';
  return [
    `- Estado: ${status}`,
    `- Firma esperada: # ${FOLDER_MEMORY_TITLE}`,
    `- Archivos editables indexados: ${files.length}`,
    `- Politica: si Estado no es confiable o la peticion no aparece en File Roles/Canonical Fixes/Change Log, refrescar mapa desde la carpeta raiz antes de editar.`
  ].join('\n');
};

const formatFolderMemoryText = (value = '', max = 6000) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.length > max
    ? `${raw.slice(0, max)}\n\n[recortado por LTH Prog para mantener la memoria usable]`
    : raw;
};

const buildFolderMemoryInitialAnalysis = () => {
  const { files, folders, byExt } = getFolderTreeStats();
  const names = files.map(file => normalizeRelativePath(file.relativePath || file.name));
  const entryCandidates = names.filter(name => /(^|\/)(index|main|app|server|src\/main|src\/app)\.(html?|js|jsx|ts|tsx|py)$/i.test(name)).slice(0, 12);
  const configCandidates = names.filter(name => /(^|\/)(package\.json|vite\.config|next\.config|tailwind\.config|tsconfig|pyproject|requirements|README|readme|\.env)/i.test(name)).slice(0, 16);
  const styleCandidates = names.filter(name => /\.(css|scss|sass|less)$/i.test(name)).slice(0, 12);
  const extLine = Object.entries(byExt)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16)
    .map(([ext, count]) => `${ext}: ${count}`)
    .join(', ') || 'sin tipos detectados';

  return [
    `- Raiz: ${self.state?.folderPath || 'sin ruta'}`,
    `- Carpetas detectadas: ${folders.length}`,
    `- Archivos detectados: ${files.length}`,
    `- Tipos principales: ${extLine}`,
    `- Entradas candidatas: ${entryCandidates.join(', ') || 'pendiente de confirmar'}`,
    `- Configuracion/documentacion candidata: ${configCandidates.join(', ') || 'pendiente de confirmar'}`,
    `- Estilos candidatos: ${styleCandidates.join(', ') || 'pendiente de confirmar'}`
  ].join('\n');
};

const createFolderMemoryTemplate = (userText = '') => {
  const now = new Date().toISOString();
  const folderMap = buildFolderTreeSummaryBlock(140).replace(/^\n+/, '');
  return `# ${FOLDER_MEMORY_TITLE}

Memory-Origin: LTH Prog
Memory-Version: ${FOLDER_MEMORY_VERSION}

Workspace: ${self.state?.folderPath || 'sin ruta'}
Created: ${now}
Updated: ${now}

## Operating Rules
- Primero consultar esta memoria antes de editar.
- Si la peticion coincide con File Roles, Canonical Fixes o Change Log, usar esos archivos como candidatos principales.
- Si la peticion no aparece en la memoria o la memoria parece incompleta, reindexar la carpeta raiz y refrescar este archivo antes de planear.
- Si no hay confianza suficiente sobre que archivo tocar, preguntar al usuario antes de aplicar cambios.
- Editar sobre archivos existentes y evitar rehacer desde cero salvo pedido explicito.

## How This Folder Works
${buildFolderMemoryInitialAnalysis()}

## Folder Map
${folderMap || 'Pendiente de indexar.'}

## File Roles
${buildFolderMemoryFileRoles(140)}

## Memory Health
${buildFolderMemoryHealthBlock()}

## Canonical Fixes
- pendiente: aun no hay fixes canonicos registrados.

## Known Issues
- pendiente: aun no hay bugs abiertos registrados.

## Decisions
- La IA debe editar sobre archivos existentes y evitar rehacer desde cero salvo pedido explicito.
- Usar rutas relativas cuando existan archivos con nombres repetidos.
- Consultar esta memoria antes de analizar toda la carpeta otra vez.

## Conversation
${userText ? `\n### ${now} - Usuario\n${formatFolderMemoryText(userText, 4000)}\n` : 'Aun no hay conversacion registrada.'}

## Change Log
- ${now}: Memoria creada por LTH Prog al usar IA en esta carpeta.
`;
};

const isTrustedFolderMemoryContent = (content = '') => {
  const firstLine = String(content || '').split(/\r?\n/).find(line => line.trim()) || '';
  return /^#\s*lth\.code\.md\s*$/i.test(firstLine.trim());
};

const normalizeFolderMemoryEnvelope = (content = '', userText = '') => {
  const raw = String(content || '').trim();
  if (isTrustedFolderMemoryContent(raw)) return raw;
  const fresh = createFolderMemoryTemplate(userText);
  if (!raw) return fresh;
  return `${fresh.trim()}\n\n## Imported Legacy Notes\nEstas notas existian antes de la firma ${FOLDER_MEMORY_TITLE}; se conservan como referencia, pero el mapa canonico se reconstruyo desde la carpeta raiz.\n\n${formatFolderMemoryText(raw, 5000)}\n`;
};

const upsertFolderMemorySection = (content = '', heading = '', body = '') => {
  const title = `## ${heading}`;
  const section = `${title}\n${String(body || '').trim() || 'Pendiente de indexar.'}`;
  const re = new RegExp(`## ${escapeRegExp(heading)}\\n[\\s\\S]*?(?=\\n## |$)`, 'i');
  const raw = String(content || '').trim();
  if (!raw) return section;
  return re.test(raw)
    ? raw.replace(re, section)
    : `${raw}\n\n${section}`;
};

const refreshFolderMemoryIndexSections = (content = '') => {
  let next = normalizeFolderMemoryEnvelope(content, '');
  next = upsertFolderMemorySection(next, 'How This Folder Works', buildFolderMemoryInitialAnalysis());
  next = upsertFolderMemorySection(
    next,
    'Folder Map',
    buildFolderTreeSummaryBlock(140).replace(/^\n+/, '') || 'Pendiente de indexar.'
  );
  next = upsertFolderMemorySection(next, 'File Roles', buildFolderMemoryFileRoles(140));
  next = upsertFolderMemorySection(next, 'Memory Health', buildFolderMemoryHealthBlock());
  if (!/## Canonical Fixes/i.test(next)) next += '\n\n## Canonical Fixes\n- pendiente: aun no hay fixes canonicos registrados.\n';
  if (!/## Known Issues/i.test(next)) next += '\n\n## Known Issues\n- pendiente: aun no hay bugs abiertos registrados.\n';
  return next;
};

const readFolderMemoryFile = async () => {
  const memoryPath = getFolderMemoryPath();
  if (!memoryPath || !window.electron?.fs?.readFile) return '';
  const result = await window.electron.fs.readFile(memoryPath);
  return typeof result === 'string' ? result : toText(result?.content || result?.data || '');
};

const writeFolderMemoryFile = async (content) => {
  const memoryPath = getFolderMemoryPath();
  if (!memoryPath || !window.electron?.fs?.writeFile) return false;
  const result = await window.electron.fs.writeFile(memoryPath, content);
  if (result?.success === false) throw new Error(result.error || 'No se pudo escribir la memoria de carpeta');
  self.state.folderMemoryPath = memoryPath;
  self.state.folderMemoryContext = content;
  return true;
};

const syncFolderMemoryToFolder = async (folderPath, userText = '') => {
  const folder = String(folderPath || '').replace(/[\\/]+$/, '');
  if (!folder || !window.electron?.fs?.writeFile) return false;
  const memoryPath = getFolderMemoryPath(folder);
  let content = String(self.state?.folderMemoryContext || '').trim();
  const previousFolder = self.state.folderPath;
  self.state.folderPath = folder;
  if (!content) {
    content = createFolderMemoryTemplate(userText);
  }
  const now = new Date().toISOString();
  content = refreshFolderMemoryIndexSections(content)
    .replace(/^Workspace:\s.*$/m, `Workspace: ${folder}`)
    .replace(/^Updated:\s.*$/m, `Updated: ${now}`);
  self.state.folderPath = previousFolder;
  if (!/## Change Log/i.test(content)) content += '\n\n## Change Log\n';
  content = content.replace(/## Change Log\n/, `## Change Log\n- ${now}: Memoria sincronizada con la carpeta guardada.\n`);
  const result = await window.electron.fs.writeFile(memoryPath, content);
  if (result?.success === false) throw new Error(result.error || 'No se pudo sincronizar memoria');
  self.state.folderMemoryPath = memoryPath;
  self.state.folderMemoryContext = content;
  return true;
};

const ensureFolderMemoryForAiTurn = async (userText = '') => {
  if (!self.state?.folderPath) await ensureAiWorkspaceFolder();
  if (!self.state?.folderPath) return '';
  const memoryPath = getFolderMemoryPath();
  self.state.folderMemoryPath = memoryPath;
  let content = '';
  try {
    content = await readFolderMemoryFile();
  } catch {
    content = '';
  }
  if (!String(content || '').trim()) {
    content = createFolderMemoryTemplate(userText);
    await writeFolderMemoryFile(content);
    self.showNotification?.(`🧠 Memoria creada: ${FOLDER_MEMORY_FILENAME}`);
    return content;
  }
  const now = new Date().toISOString();
  const needsTurn = userText && !content.includes(shortText(userText, 160));
  let next = refreshFolderMemoryIndexSections(content);
  if (!/## Conversation/i.test(next)) next += '\n\n## Conversation\n';
  if (needsTurn) next += `\n### ${now} - Usuario\n${formatFolderMemoryText(userText, 4000)}\n`;
  next = next.replace(/^Updated:\s.*$/m, `Updated: ${now}`);
  if (next !== content) await writeFolderMemoryFile(next);
  else self.state.folderMemoryContext = content;
  return next;
};

const buildCanonicalMemoryLine = ({ user = '', outcome = '', targetFiles = [], success = true } = {}) => {
  const combined = `${user}\n${outcome}`;
  const isFixLike = /\b(no\s+carga|no\s+sale|no\s+funciona|bug|error|fall[ao]|falla|arregl|corrig|fix|solucion|repar)\b/i.test(combined);
  if (success && !isFixLike) return '';
  const files = Array.isArray(targetFiles) && targetFiles.length
    ? ` [${targetFiles.join(', ')}]`
    : '';
  const summary = shortText(outcome || user || (success ? 'Cambio aplicado' : 'Cambio pendiente'), 220);
  return `- ${new Date().toISOString()}:${files} ${summary}`;
};

const appendFolderMemoryEvent = async ({ user = '', assistant = '', outcome = '', targetFiles = [], success = true, sectionMap = '', sectionFile = '' } = {}) => {
  if (!self.state?.folderPath) await ensureAiWorkspaceFolder();
  if (!self.state?.folderPath) return;
  try {
    let content = await ensureFolderMemoryForAiTurn('');
    const now = new Date().toISOString();
    const targets = Array.isArray(targetFiles) && targetFiles.length ? `\nArchivos: ${targetFiles.join(', ')}` : '';
    const userBlock = user ? `\n\n### ${now} - Usuario\n${formatFolderMemoryText(user, 4000)}` : '';
    const assistantBlock = assistant ? `\n\n### ${now} - IA\n${formatFolderMemoryText(assistant, 6000)}` : '';
    const outcomeBlock = outcome ? `\n\n## Change Log\n- ${now}: ${success ? 'OK' : 'Pendiente'} - ${shortText(outcome, 220)}${targets}` : '';
    if (userBlock && !content.includes(shortText(user, 160))) {
      content += userBlock;
    }
    if (assistantBlock) content += assistantBlock;
    if (outcomeBlock) {
      content = content.includes('## Change Log')
        ? content.replace(/## Change Log\n/, `## Change Log\n- ${now}: ${success ? 'OK' : 'Pendiente'} - ${shortText(outcome, 220)}${targets}\n`)
        : `${content}${outcomeBlock}`;
    }
    const canonicalLine = buildCanonicalMemoryLine({ user, outcome, targetFiles, success });
    if (canonicalLine) {
      const sectionName = success ? 'Canonical Fixes' : 'Known Issues';
      if (!new RegExp(`## ${escapeRegExp(sectionName)}`, 'i').test(content)) {
        content += `\n\n## ${sectionName}\n`;
      }
      const placeholder = success
        ? '- pendiente: aun no hay fixes canonicos registrados.\n'
        : '- pendiente: aun no hay bugs abiertos registrados.\n';
      content = content.replace(placeholder, '');
      content = content.replace(new RegExp(`## ${escapeRegExp(sectionName)}\\n`, 'i'), `## ${sectionName}\n${canonicalLine}\n`);
    }
    content = content.replace(/^Updated:\s.*$/m, `Updated: ${now}`);
    if (sectionMap) {
      // Mapa de secciones del archivo activo: la IA lo consulta para ubicar QUE pedazo tocar
      // sin releer todo el archivo. Se reescribe en cada edit focalizado, asi evoluciona.
      const heading = '## Mapa de secciones (archivo activo)';
      const body = `Archivo: ${sectionFile || 'activo'} · actualizado ${now}\n${sectionMap}`;
      const re = /## Mapa de secciones \(archivo activo\)\n[\s\S]*?(?=\n## |$)/;
      content = re.test(content)
        ? content.replace(re, `${heading}\n${body}\n`)
        : `${content.trim()}\n\n${heading}\n${body}\n`;
    }
    await writeFolderMemoryFile(content);
  } catch (err) {
    console.warn('[LTH PROG] No se pudo actualizar memoria de carpeta:', err?.message || err);
  }
};

const buildFolderMemoryContextBlock = (query = '') => {
  const raw = String(self.state?.folderMemoryContext || '').trim();
  if (!raw) return '';
  return `\n\nMEMORIA FISICA DE CARPETA (${FOLDER_MEMORY_FILENAME}):\n${clipForAI(raw, 9000)}\nReglas de uso de memoria:\n- Esta memoria es la fuente principal para entender la carpeta y decidir archivos objetivo.\n- Si la memoria contiene File Roles, Canonical Fixes o Change Log relacionados con la peticion, prioriza esos archivos.\n- Si la peticion no aparece en memoria, usa el mapa de carpeta y el contexto del workspace para investigar antes de editar.\n- Si aun no hay confianza suficiente sobre que archivo tocar, pregunta al usuario en vez de aplicar un cambio dudoso.\n- Si haces cambios o resuelves un bug, la memoria se actualizara con el aprendizaje canonico.\nPeticion actual: ${shortText(query, 180)}`;
};

const safeEnsureFolderMemoryForAiTurn = async (userText = '') => {
  try {
    return await ensureFolderMemoryForAiTurn(userText);
  } catch (err) {
    console.warn('[LTH PROG] Memoria markdown no disponible:', err?.message || err);
    return '';
  }
};

const safeBuildFolderMemoryContextBlock = (query = '') =>
  safelyRunProgBrain(() => buildFolderMemoryContextBlock(query), '');

const normalizePathKey = (value) => toText(value).replace(/\//g, '\\').trim().toLowerCase();
const normalizeNameKey = (value) => toText(value).trim().toLowerCase();
const buildDraftStorageKey = (workspaceKey, token) =>
  `${DRAFT_STORAGE_PREFIX}${encodeURIComponent(`${workspaceKey}::${token}`)}`;

const getFileStateIdentityToken = (file) => {
  if (file?.path) return `path:${normalizePathKey(file.path)}`;
  if (file?.name) return `name:${normalizeNameKey(file.name)}`;
  if (file?.id) return `id:${normalizeNameKey(file.id)}`;
  return 'name:sin-archivo';
};

const getLegacyFileStateTokens = (file) => {
  const tokens = [];
  if (file?.path) tokens.push(normalizePathKey(file.path));
  if (file?.name) tokens.push(normalizeNameKey(file.name));
  if (file?.id) tokens.push(normalizeNameKey(file.id));
  return Array.from(new Set(tokens.filter(Boolean)));
};

const getFileStateStorageKey = (file, workspaceKey = getWorkspaceKey()) =>
  buildDraftStorageKey(workspaceKey, getFileStateIdentityToken(file));

const getFileStateStorageKeys = (file, workspaceKey = getWorkspaceKey()) => {
  const keys = [getFileStateStorageKey(file, workspaceKey)];
  getLegacyFileStateTokens(file).forEach(token => keys.push(buildDraftStorageKey(workspaceKey, token)));
  return Array.from(new Set(keys.filter(Boolean)));
};

const normalizePos = (pos) => ({
  line: Math.max(0, Number(pos?.line) || 0),
  ch: Math.max(0, Number(pos?.ch) || 0)
});

const indexToPos = (text, index) => {
  const safeText = toText(text);
  const bounded = Math.max(0, Math.min(Number(index) || 0, safeText.length));
  const before = safeText.slice(0, bounded);
  const lines = before.split('\n');
  return { line: Math.max(0, lines.length - 1), ch: (lines[lines.length - 1] || '').length };
};

const normalizeEditorState = (state) => {
  if (!state || typeof state !== 'object') return null;

  const selections = Array.isArray(state.selections)
    ? state.selections.map(sel => ({
        anchor: normalizePos(sel?.anchor),
        head: normalizePos(sel?.head)
      }))
    : [];

  const selectionStart = Number.isFinite(Number(state.selectionStart)) ? Number(state.selectionStart) : null;
  const selectionEnd = Number.isFinite(Number(state.selectionEnd)) ? Number(state.selectionEnd) : null;

  return {
    cursor: normalizePos(state.cursor || state.head),
    anchor: normalizePos(state.anchor || (selections[0] && selections[0].anchor)),
    head: normalizePos(state.head || (selections[0] && selections[0].head)),
    selections,
    selectionStart,
    selectionEnd,
    scrollTop: Math.max(0, Number(state.scrollTop) || 0),
    scrollLeft: Math.max(0, Number(state.scrollLeft) || 0)
  };
};

const normalizeFileRecord = (file, options = {}) => {
  const savedContent = toText(options.savedContent ?? file?.savedContent ?? file?.content);
  const content = toText(options.content ?? file?.content ?? savedContent);
  const now = Date.now();
  const savedAtRaw = Number(options.savedAt ?? file?.savedAt);
  const draftAtRaw = Number(options.draftUpdatedAt ?? file?.draftUpdatedAt);
  const savedAt = Number.isFinite(savedAtRaw) ? savedAtRaw : now;
  const draftUpdatedAt = Number.isFinite(draftAtRaw) ? draftAtRaw : savedAt;

  return {
    ...file,
    id: file?.id || `${file?.type || 'file'}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name: file?.name || 'Sin nombre',
    type: file?.type || 'html',
    path: file?.path || null,
    relativePath: normalizeRelativePath(file?.relativePath || file?.workspaceRelativePath || ''),
    workspaceRelativePath: normalizeRelativePath(file?.workspaceRelativePath || file?.relativePath || ''),
    externalFolder: file?.externalFolder || null,
    content,
    savedContent,
    savedAt,
    draftUpdatedAt,
    editorState: normalizeEditorState(options.editorState ?? file?.editorState),
    isDirty: hasMeaningfulContentChange(content, savedContent)
  };
};

const readStoredFileState = (file, workspaceKey = getWorkspaceKey()) => {
  try {
    const keys = getFileStateStorageKeys(file, workspaceKey);
    for (const key of keys) {
      const payload = parseJSONSafe(localStorage.getItem(key), null);
      if (!payload) continue;

      if (file?.path) {
        if (normalizePathKey(payload.path) !== normalizePathKey(file.path)) continue;
      } else if (file?.name) {
        if (normalizeNameKey(payload.name) !== normalizeNameKey(file.name)) continue;
      }

      return payload;
    }
  } catch {}
  return null;
};

const removeStoredFileState = (fileOrKey, workspaceKey = getWorkspaceKey()) => {
  try {
    const keys = String(fileOrKey || '').startsWith(DRAFT_STORAGE_PREFIX)
      ? [String(fileOrKey)]
      : getFileStateStorageKeys(fileOrKey, workspaceKey);
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {}
};

const hydrateFileRecord = (file, options = {}) => {
  const hasOfficialSource = options.hasOfficialSource !== false;
  const workspaceKey = options.workspaceKey || getWorkspaceKey();
  const officialContent = toText(options.officialContent ?? file?.savedContent ?? file?.content);
  const persisted = options.ignoreStoredState
    ? null
    : (Object.prototype.hasOwnProperty.call(options, 'persisted')
        ? options.persisted
        : readStoredFileState(file, workspaceKey));
  const savedFromSource = hasOfficialSource
    ? officialContent
    : toText(persisted?.savedContent ?? officialContent);
  const savedAt = Number.isFinite(Number(persisted?.savedAt))
    ? Number(persisted.savedAt)
    : (Number.isFinite(Number(file?.savedAt)) ? Number(file.savedAt) : Date.now());
  const draftUpdatedAt = Number.isFinite(Number(persisted?.draftUpdatedAt))
    ? Number(persisted.draftUpdatedAt)
    : savedAt;
  const persistedContent = persisted && typeof persisted.content === 'string'
    ? persisted.content
    : savedFromSource;
  const shouldUseDraft = !!persisted && (
    persisted.isDirty ||
    hasMeaningfulContentChange(persistedContent, savedFromSource) ||
    draftUpdatedAt >= savedAt
  );

  return normalizeFileRecord({
    ...file,
    content: shouldUseDraft ? persistedContent : savedFromSource,
    savedContent: savedFromSource,
    savedAt,
    draftUpdatedAt,
    editorState: persisted?.editorState || file?.editorState
  });
};

const readOfficialFileContent = async (filePath) => {
  if (!filePath || !window.electron?.fs?.readFile) {
    return { success: false, content: '' };
  }

  try {
    const result = await window.electron.fs.readFile(filePath);
    const content = typeof result === 'string'
      ? result
      : toText(result?.content ?? result?.data ?? '');
    return {
      success: typeof result === 'string' || !!result?.success || content.length > 0,
      content
    };
  } catch (err) {
    console.warn('[LTH PROG] No se pudo leer archivo real desde disco:', filePath, err);
    return { success: false, content: '' };
  }
};

const buildOfficialFilesList = async (files, options = {}) => {
  const workspaceKey = options.workspaceKey || getWorkspaceKey();
  const ignoreStoredState = options.ignoreStoredState !== false;
  const preferDisk = options.preferDisk !== false;

  return (await Promise.all((files || []).map(async (file) => {
    if (!file) return null;

    if (ignoreStoredState) removeStoredFileState(file, workspaceKey);

    let officialContent = toText(file?.content);
    let hasOfficialSource = options.hasOfficialSource !== false;

    if (preferDisk && file?.path) {
      const disk = await readOfficialFileContent(file.path);
      if (disk.success) {
        officialContent = disk.content;
        hasOfficialSource = true;
      }
    }

    return hydrateFileRecord({
      ...file,
      content: officialContent
    }, {
      officialContent,
      hasOfficialSource,
      workspaceKey,
      ignoreStoredState
    });
  }))).filter(Boolean);
};

const persistFileState = (file) => {
  if (!file) return;
  const snapshot = normalizeFileRecord(file);
  try {
    localStorage.setItem(getFileStateStorageKey(snapshot), JSON.stringify({
      id: snapshot.id,
      name: snapshot.name,
      type: snapshot.type,
      path: snapshot.path || null,
      relativePath: snapshot.relativePath || null,
      workspaceRelativePath: snapshot.workspaceRelativePath || null,
      externalFolder: snapshot.externalFolder || null,
      content: snapshot.content,
      savedContent: snapshot.savedContent,
      savedAt: snapshot.savedAt,
      draftUpdatedAt: snapshot.draftUpdatedAt,
      isDirty: snapshot.isDirty,
      editorState: snapshot.editorState || null
    }));
  } catch (err) {
    console.warn('[LTH PROG] No se pudo persistir el borrador local:', err);
  }
};

const persistAllFileStates = () => {
  (this.state.filesList || []).forEach(file => persistFileState(file));
};

const persistSessionMeta = () => {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      version: 3,
      workspaceMode: this.state.workspaceMode || 'project',
      currentProject: this.state.currentProject || null,
      folderPath: this.state.folderPath || null,
      expandedFolderPaths: Array.isArray(this.state.expandedFolderPaths) ? this.state.expandedFolderPaths : [],
      activeFileId: this.state.activeFileId || null,
      hiddenFiles: Array.isArray(this.state.hiddenFiles) ? this.state.hiddenFiles : [],
      device: this.state.device,
      split: this.state.split,
      live: this.state.live,
      currentTab: this.state.currentTab,
      filesList: (this.state.filesList || []).map(file => ({
        id: file.id,
        name: file.name,
        type: file.type,
        path: file.path || null,
        relativePath: file.relativePath || null,
        workspaceRelativePath: file.workspaceRelativePath || null,
        externalFolder: file.externalFolder || null
      }))
    }));
  } catch (err) {
    console.warn('[LTH PROG] No se pudo persistir la sesión del editor:', err);
  }

  try {
    if (typeof this._saveWorkspaceToDisk === 'function') {
      this._saveWorkspaceToDisk(
        this.state.workspaceMode === 'folder' ? this.state.folderPath : null
      );
    }
  } catch (err) {
    console.warn('[LTH PROG] No se pudo persistir el workspace en disco:', err);
  }
};

const persistWorkspaceSnapshot = () => {
  persistAllFileStates();
  persistSessionMeta();
};

const decodeDraftStorageKey = (key) => {
  if (typeof key !== 'string' || !key.startsWith(DRAFT_STORAGE_PREFIX)) return null;
  try {
    const encoded = key.slice(DRAFT_STORAGE_PREFIX.length);
    const decoded = decodeURIComponent(encoded);
    const sepIndex = decoded.indexOf('::');
    if (sepIndex === -1) return { raw: decoded, workspaceKey: null, token: decoded };
    return {
      raw: decoded,
      workspaceKey: decoded.slice(0, sepIndex),
      token: decoded.slice(sepIndex + 2)
    };
  } catch {
    return { raw: key, workspaceKey: null, token: null };
  }
};

const getAllDraftStorageEntries = () => {
  const entries = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(DRAFT_STORAGE_PREFIX)) continue;
    const decoded = decodeDraftStorageKey(key);
    entries.push({
      key,
      workspaceKey: decoded?.workspaceKey || null,
      token: decoded?.token || null,
      payload: parseJSONSafe(localStorage.getItem(key), null)
    });
  }
  return entries;
};

const sanitizeWorkspaceDraftState = (workspaceKey, files = []) => {
  if (!workspaceKey) return { scanned: 0, removed: 0 };

  const allowedKeys = new Set();
  const allowedPaths = new Set();
  const allowedNames = new Set();
  const safeFiles = (files || []).filter(Boolean);

  safeFiles.forEach((file) => {
    getFileStateStorageKeys(file, workspaceKey).forEach((key) => allowedKeys.add(key));
    if (file?.path) allowedPaths.add(normalizePathKey(file.path));
    if (file?.name) allowedNames.add(normalizeNameKey(file.name));
  });

  let scanned = 0;
  let removed = 0;

  getAllDraftStorageEntries().forEach((entry) => {
    if (entry.workspaceKey !== workspaceKey) return;
    scanned += 1;

    const payload = entry.payload;
    if (!payload || (!payload.path && !payload.name)) {
      try { localStorage.removeItem(entry.key); } catch {}
      removed += 1;
      return;
    }

    if (!safeFiles.length) return;

    const payloadPath = payload.path ? normalizePathKey(payload.path) : '';
    const payloadName = payload.name ? normalizeNameKey(payload.name) : '';
    const matchesKnownPath = payloadPath && allowedPaths.has(payloadPath);
    const matchesKnownName = !payloadPath && payloadName && allowedNames.has(payloadName);
    const matchesKnownKey = allowedKeys.has(entry.key);

    if (!matchesKnownKey && !matchesKnownPath && !matchesKnownName) {
      try { localStorage.removeItem(entry.key); } catch {}
      removed += 1;
    }
  });

  return { scanned, removed };
};

const sanitizeStoredSessionMeta = () => {
  const session = parseJSONSafe(localStorage.getItem(SESSION_STORAGE_KEY), null);
  if (!session) return null;

  const hasValidFilesList = Array.isArray(session.filesList);
  const workspaceMode = session.workspaceMode || 'project';
  const hasValidFolderContext = workspaceMode !== 'folder' || !!session.folderPath;

  if (!hasValidFilesList || !hasValidFolderContext) {
    discardSessionSnapshot(session);
    return null;
  }

  return session;
};

const buildEditorStorageAuditReport = () => {
  const report = {
    generatedAt: new Date().toISOString(),
    sessionKey: SESSION_STORAGE_KEY,
    draftPrefix: DRAFT_STORAGE_PREFIX,
    session: null,
    drafts: [],
    workspaces: {}
  };

  try {
    report.session = parseJSONSafe(localStorage.getItem(SESSION_STORAGE_KEY), null);
  } catch {
    report.session = null;
  }

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(DRAFT_STORAGE_PREFIX)) continue;

    const decoded = decodeDraftStorageKey(key);
    const payload = parseJSONSafe(localStorage.getItem(key), null);
    const entry = {
      key,
      workspaceKey: decoded?.workspaceKey || null,
      token: decoded?.token || null,
      id: payload?.id || null,
      name: payload?.name || null,
      path: payload?.path || null,
      externalFolder: payload?.externalFolder || null,
      type: payload?.type || null,
      isDirty: !!payload?.isDirty,
      savedAt: payload?.savedAt || null,
      draftUpdatedAt: payload?.draftUpdatedAt || null,
      contentLength: typeof payload?.content === 'string' ? payload.content.length : 0,
      savedContentLength: typeof payload?.savedContent === 'string' ? payload.savedContent.length : 0
    };

    report.drafts.push(entry);

    const bucketKey = entry.workspaceKey || 'unknown';
    if (!report.workspaces[bucketKey]) {
      report.workspaces[bucketKey] = {
        count: 0,
        dirtyCount: 0,
        files: []
      };
    }
    report.workspaces[bucketKey].count += 1;
    if (entry.isDirty) report.workspaces[bucketKey].dirtyCount += 1;
    report.workspaces[bucketKey].files.push({
      name: entry.name,
      token: entry.token,
      path: entry.path,
      isDirty: entry.isDirty
    });
  }

  report.summary = {
    sessionPresent: !!report.session,
    totalDrafts: report.drafts.length,
    dirtyDrafts: report.drafts.filter(item => item.isDirty).length,
    workspaceCount: Object.keys(report.workspaces).length
  };

  const fileIndex = {};
  report.drafts.forEach((entry) => {
    const key = String(entry.name || entry.token || 'sin-nombre').toLowerCase();
    if (!fileIndex[key]) fileIndex[key] = [];
    fileIndex[key].push({
      workspaceKey: entry.workspaceKey,
      path: entry.path,
      token: entry.token,
      isDirty: entry.isDirty,
      contentLength: entry.contentLength,
      savedContentLength: entry.savedContentLength
    });
  });
  report.duplicatesByName = Object.entries(fileIndex)
    .filter(([, items]) => items.length > 1)
    .map(([name, items]) => ({ name, items }));

  return report;
};

this.inspectStorageAudit = () => buildEditorStorageAuditReport();
this.inspectStorageAuditSummary = () => {
  const report = buildEditorStorageAuditReport();
  return {
    generatedAt: report.generatedAt,
    summary: report.summary,
    session: report.session ? {
      workspaceMode: report.session.workspaceMode,
      currentProject: report.session.currentProject,
      folderPath: report.session.folderPath,
      activeFileId: report.session.activeFileId,
      fileCount: Array.isArray(report.session.filesList) ? report.session.filesList.length : 0
    } : null,
    duplicatesByName: report.duplicatesByName
  };
};
this.logStorageAudit = () => {
  const report = buildEditorStorageAuditReport();
  try {
    console.groupCollapsed('[LTH PROG] Storage audit');
    console.log('summary', report.summary);
    console.log('session', report.session);
    console.log('duplicatesByName', report.duplicatesByName);
    console.table(report.drafts.map(item => ({
      workspaceKey: item.workspaceKey,
      name: item.name,
      path: item.path,
      isDirty: item.isDirty,
      contentLength: item.contentLength,
      savedContentLength: item.savedContentLength
    })));
    console.groupEnd();
  } catch {}
  return report;
};

const discardSessionSnapshot = (session) => {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {}

  const workspaceKey = buildWorkspaceKey(
    session?.workspaceMode || 'project',
    session?.currentProject || null,
    session?.folderPath || null
  );

  try {
    (session?.filesList || []).forEach(file => removeStoredFileState(file, workspaceKey));
  } catch {}
};

const restoreSessionSnapshot = () => {
  const session = sanitizeStoredSessionMeta();
  if (!session || !Array.isArray(session.filesList)) return false;

  const isLooseFileSession =
    (session.workspaceMode || 'project') !== 'folder' &&
    !session.currentProject &&
    session.filesList.some(file => typeof file?.path === 'string' && file.path);

  if (isLooseFileSession) {
    discardSessionSnapshot(session);
    return false;
  }

  this.state.currentProject = session.currentProject || null;
  this.state.workspaceMode = session.workspaceMode || (session.folderPath ? 'folder' : session.currentProject ? 'project' : 'project');
  this.state.folderPath = session.folderPath || null;
  this.state.expandedFolderPaths = Array.isArray(session.expandedFolderPaths) ? session.expandedFolderPaths.slice() : [];
  this.state.hiddenFiles = Array.isArray(session.hiddenFiles) ? session.hiddenFiles.slice() : [];
  if (session.device) this.state.device = session.device;
  this.state.split = false;
  this.state.live = false;
  this.state.currentTab = 'editor';

  const workspaceKey = buildWorkspaceKey(this.state.workspaceMode, this.state.currentProject, this.state.folderPath);
  this.state.filesList = session.filesList
    .map(file => hydrateFileRecord(file, {
      hasOfficialSource: false,
      workspaceKey,
      ignoreStoredState: false
    }))
    .filter(Boolean);

  if (!this.state.filesList.length) {
    this.state.activeFileId = null;
    return true;
  }

  this.state.hiddenFiles = this.state.hiddenFiles.filter(id => this.state.filesList.some(file => file.id === id));
  const nextActive = session.activeFileId
    ? (this.state.filesList.find(file => file.id === session.activeFileId) || this.state.filesList[0])
    : null;
  this.state.activeFileId = nextActive?.id || null;
  this.state.editorTab = nextActive?.type || this.state.editorTab || 'html';
  this._syncLegacyFiles && this._syncLegacyFiles();
  return true;
};

const scheduleChromeRefresh = () => {
  if (_chromeRefreshRaf) return;
  _chromeRefreshRaf = requestAnimationFrame(() => {
    _chromeRefreshRaf = 0;
    this._renderDynamicTabs && this._renderDynamicTabs();
    this._renderFileExplorer && this._renderFileExplorer();
  });
};

const getDirtyFiles = () => (this.state.filesList || []).filter(file => !!file.isDirty);
const hasDirtyFiles = () => getDirtyFiles().length > 0;

const setStatusForFile = (file, cleanLabel = 'Listo') => {
  if (!editorStatus) return;
  if (!file) {
    editorStatus.textContent = cleanLabel;
    return;
  }
  editorStatus.textContent = file.isDirty ? 'Pendiente de guardar' : cleanLabel;
};

const captureEditorViewState = () => {
  if (this.editor && !this.editor._isStub && typeof this.editor.listSelections === 'function') {
    const selections = this.editor.listSelections().map(sel => ({
      anchor: normalizePos(sel.anchor),
      head: normalizePos(sel.head)
    }));
    const info = this.editor.getScrollInfo ? this.editor.getScrollInfo() : { left: 0, top: 0 };
    return normalizeEditorState({
      cursor: this.editor.getCursor ? this.editor.getCursor() : selections[0]?.head,
      anchor: selections[0]?.anchor,
      head: selections[0]?.head,
      selections,
      scrollTop: info.top || 0,
      scrollLeft: info.left || 0
    });
  }

  if (!codeEditor) return null;

  const value = toText(codeEditor.value);
  const start = Number.isFinite(Number(codeEditor.selectionStart)) ? Number(codeEditor.selectionStart) : 0;
  const end = Number.isFinite(Number(codeEditor.selectionEnd)) ? Number(codeEditor.selectionEnd) : start;
  return normalizeEditorState({
    cursor: indexToPos(value, end),
    anchor: indexToPos(value, start),
    head: indexToPos(value, end),
    selections: [{ anchor: indexToPos(value, start), head: indexToPos(value, end) }],
    selectionStart: start,
    selectionEnd: end,
    scrollTop: codeEditor.scrollTop || 0,
    scrollLeft: codeEditor.scrollLeft || 0
  });
};

const captureEditorHistoryState = () => {
  if (this.editor && !this.editor._isStub && typeof this.editor.getHistory === 'function') {
    try { return this.editor.getHistory(); } catch {}
  }
  return null;
};

const restoreEditorHistoryState = (historyState) => {
  if (!this.editor || this.editor._isStub) return;

  try {
    if (typeof this.editor.clearHistory === 'function') {
      this.editor.clearHistory();
    }
    if (historyState && typeof this.editor.setHistory === 'function') {
      this.editor.setHistory(historyState);
    }
  } catch (err) {
    console.warn('[LTH PROG] No se pudo restaurar el historial del editor:', err);
  }
};

const restoreEditorViewState = (state, options = {}) => {
  const normalized = normalizeEditorState(state);
  const shouldFocus = options.focus !== false;

  const finish = () => {
    _isRestoringEditorView = false;
    if (shouldFocus) setTimeout(() => this.editor?.focus && this.editor.focus(), 0);
  };

  if (!normalized) {
    finish();
    return;
  }

  const applyState = () => {
    try {
      if (this.editor && !this.editor._isStub) {
        const applySelections = () => {
          if (normalized.selections.length && typeof this.editor.setSelections === 'function') {
            this.editor.setSelections(normalized.selections.map(sel => ({
              anchor: normalizePos(sel.anchor),
              head: normalizePos(sel.head)
            })));
          } else if (this.editor.setSelection) {
            this.editor.setSelection(normalized.anchor, normalized.head);
          } else if (this.editor.setCursor) {
            this.editor.setCursor(normalized.cursor);
          }
        };

        if (typeof this.editor.operation === 'function') this.editor.operation(applySelections);
        else applySelections();

        if (typeof this.editor.scrollTo === 'function') {
          this.editor.scrollTo(normalized.scrollLeft, normalized.scrollTop);
        } else if (codeEditor) {
          codeEditor.scrollLeft = normalized.scrollLeft;
          codeEditor.scrollTop = normalized.scrollTop;
        }
      } else if (codeEditor) {
        codeEditor.scrollLeft = normalized.scrollLeft;
        codeEditor.scrollTop = normalized.scrollTop;
        if (typeof normalized.selectionStart === 'number' && typeof normalized.selectionEnd === 'number' && codeEditor.setSelectionRange) {
          codeEditor.setSelectionRange(normalized.selectionStart, normalized.selectionEnd);
        }
      }
    } catch (err) {
      console.warn('[LTH PROG] No se pudo restaurar el estado visual del editor:', err);
    } finally {
      setTimeout(finish, 0);
    }
  };

  requestAnimationFrame(() => requestAnimationFrame(applyState));
};

const markFileDirtyState = (file, { touchDraft = true } = {}) => {
  if (!file) return null;
  file.content = toText(file.content);
  file.savedContent = toText(file.savedContent);
  file.isDirty = hasMeaningfulContentChange(file.content, file.savedContent);

  if (file.isDirty && touchDraft) {
    file.draftUpdatedAt = Date.now();
  } else if (!file.isDirty) {
    file.draftUpdatedAt = file.savedAt || Date.now();
  }

  return file;
};

const serializeFilesList = () => (this.state.filesList || []).map(file => ({
  id: file.id,
  name: file.name,
  type: file.type,
  path: file.path || null,
  externalFolder: file.externalFolder || null,
  content: toText(file.content)
}));

const markFileAsSaved = (file, contentOverride) => {
  if (!file) return null;
  file.content = toText(contentOverride ?? file.content);
  file.savedContent = file.content;
  file.savedAt = Date.now();
  file.draftUpdatedAt = file.savedAt;
  file.isDirty = false;
  if (file.id === this.state.activeFileId) file.editorState = captureEditorViewState();
  persistFileState(file);
  persistSessionMeta();
  scheduleChromeRefresh();
  setStatusForFile(file, 'Guardado');
  return file;
};

const markWorkspaceAsSaved = () => {
  const now = Date.now();
  (this.state.filesList || []).forEach(file => {
    file.content = toText(file.content);
    file.savedContent = file.content;
    file.savedAt = now;
    file.draftUpdatedAt = now;
    file.isDirty = false;
    persistFileState(file);
  });
  persistSessionMeta();
  scheduleChromeRefresh();
  setStatusForFile(this._getActiveFile(), 'Guardado');
};

// sincroniza una vez al iniciar el editor
this._syncLegacyFiles();

      // Stub temporal — evita crashes mientras CDN carga
      const normalizeEditorTheme = (theme) => {
        const value = String(theme || '').trim().toLowerCase();
        if ([
          'lth-vscode',
          'vscode',
          'vscode-dark',
          'vs-dark',
          'dark-plus',
          'darkplus',
          'visual-studio'
        ].includes(value)) return 'lth-vscode';
        return 'lth-vscode';
      };

      const editorPrefsPromise = _ProgFS.loadAppConfig('lth-prog-settings')
        .then((r) => (r?.success && r.config ? r.config : {}))
        .catch(() => ({}));

      const applyEditorPrefs = (ed, prefs = {}) => {
        if (!ed?.setOption) return;
        const indent = Number.parseInt(prefs.indent, 10);
        const fontSize = Number.parseInt(prefs.fontSize, 10);

        ed.setOption('theme', normalizeEditorTheme(prefs.theme));
        ed.setOption('lineNumbers', prefs.lineNums !== false);
        ed.setOption('indentUnit', Number.isFinite(indent) ? indent : 2);
        ed.setOption('tabSize', Number.isFinite(indent) ? indent : 2);
        ed.setOption('styleActiveLine', prefs.highlightLine !== false);

        const cmEl = container.querySelector('.CodeMirror');
        if (cmEl) cmEl.style.fontSize = `${Number.isFinite(fontSize) ? fontSize : 13}px`;

        if (typeof ed.refresh === 'function') ed.refresh();
      };

      this.editor = {
        getValue: () => codeEditor?.value || '',
        setValue: (v) => { if (codeEditor) codeEditor.value = v ?? ''; },
        on: () => {}, off: () => {},
        setOption: () => {}, addKeyMap: () => {},
        getSelection: () => '', somethingSelected: () => false,
        replaceSelection: () => {}, replaceRange: () => {},
        getCursor: () => ({ line: 0, ch: 0 }), setCursor: () => {},
        setSelection: () => {}, scrollIntoView: () => {},
        markText: () => ({ clear: () => {} }),
        posFromIndex: (i) => ({ line: 0, ch: i }),
        lineCount: () => (codeEditor?.value || '').split('\n').length,
        getLine: (n) => (codeEditor?.value || '').split('\n')[n] || '',
        focus: () => codeEditor?.focus(), refresh: () => {},
        foldCode: () => {}, toTextArea: () => {},
        _isStub: true
      };

      let editor = null;
      const CM_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16';
      const CM_LOCAL_BASE = (() => {
        try {
          return new URL('./vendor/codemirror/5.65.16', window.location.href).href.replace(/\/$/, '');
        } catch {
          return '';
        }
      })();
      const CM_BASES = [...new Set([CM_LOCAL_BASE, CM_BASE].filter(Boolean))];
      const loadScript = (src) => new Promise((res, rej) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing?.dataset?.lthLoaded === '1') { res(); return; }
        if (existing?.dataset?.lthLoading === '1') {
          existing.addEventListener('load', () => res(), { once: true });
          existing.addEventListener('error', () => rej(new Error(`No se pudo cargar script: ${src}`)), { once: true });
          return;
        }
        if (existing) {
          try { existing.remove(); } catch {}
        }
        const s = document.createElement('script');
        s.src = src;
        s.dataset.lthLoading = '1';
        s.onload = () => {
          delete s.dataset.lthLoading;
          s.dataset.lthLoaded = '1';
          res();
        };
        s.onerror = () => {
          try { s.remove(); } catch {}
          rej(new Error(`No se pudo cargar script: ${src}`));
        };
        document.head.appendChild(s);
      });
      const loadStyle = (href) => new Promise((res, rej) => {
        const existing = document.querySelector(`link[href="${href}"]`);
        if (existing?.dataset?.lthLoaded === '1') { res(); return; }
        if (existing?.dataset?.lthLoading === '1') {
          existing.addEventListener('load', () => res(), { once: true });
          existing.addEventListener('error', () => rej(new Error(`No se pudo cargar estilo: ${href}`)), { once: true });
          return;
        }
        if (existing) {
          try { existing.remove(); } catch {}
        }
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.dataset.lthLoading = '1';
        link.onload = () => {
          delete link.dataset.lthLoading;
          link.dataset.lthLoaded = '1';
          res();
        };
        link.onerror = () => {
          try { link.remove(); } catch {}
          rej(new Error(`No se pudo cargar estilo: ${href}`));
        };
        document.head.appendChild(link);
      });
      const loadCodeMirrorAsset = async (type, relativePath) => {
        let lastError = null;
        for (const base of CM_BASES) {
          const target = `${base}/${relativePath}`;
          try {
            if (type === 'style') {
              await loadStyle(target);
            } else {
              await loadScript(target);
            }
            return target;
          } catch (err) {
            lastError = err;
          }
        }
        throw lastError || new Error(`No se pudo cargar asset CodeMirror: ${relativePath}`);
      };
      const loadCodeMirrorScript = (relativePath) => loadCodeMirrorAsset('script', relativePath);
      const loadCodeMirrorStyle = (relativePath) => loadCodeMirrorAsset('style', relativePath);
      const loadExtraCodeMirrorModes = () => {
        [
          'mode/python/python.min.js',
          'mode/clike/clike.min.js',
          'mode/go/go.min.js',
          'mode/rust/rust.min.js',
          'mode/php/php.min.js',
          'mode/ruby/ruby.min.js',
          'mode/shell/shell.min.js',
          'mode/sql/sql.min.js',
          'mode/dockerfile/dockerfile.min.js',
          'mode/markdown/markdown.min.js',
          'mode/swift/swift.min.js'
        ].forEach((modePath) => {
          loadCodeMirrorScript(modePath).catch(() => {});
        });
      };

      if (window.CodeMirror && typeof window.CodeMirror.fromTextArea === 'function') {
        const initEditor = () => {
          const hasFold = !!(CodeMirror.fold?.brace || CodeMirror.fold?.comment);
          const gutterIds = ['CodeMirror-linenumbers'];
          if (hasFold) gutterIds.push('CodeMirror-foldgutter');

          editor = CodeMirror.fromTextArea(codeEditor, {
            mode: 'htmlmixed',
            theme: 'lth-vscode',
            lineNumbers: true,
            lineWrapping: true,
            tabSize: 2,
            indentUnit: 2,
            autoCloseBrackets: true,
            autoCloseTags: true,
            matchBrackets: true,
            styleActiveLine: true,
            foldGutter: hasFold,
            gutters: gutterIds,
            ...(hasFold ? {
              extraKeys: {
                'Ctrl-[': (cm) => cm.foldCode(cm.getCursor()),
                'Ctrl-]': (cm) => cm.foldCode(cm.getCursor(), null, 'unfold'),
              }
            } : {})
          });

          this.editor = editor;

          // Cargar modos extra de forma local/offline cuando sea posible.
          loadExtraCodeMirrorModes();

          // Exponer para guia_main.js
          if (window.LTH_APPS?.['lth-prog']) {
            window.LTH_APPS['lth-prog'].editor = editor;
            window.LTH_APPS['lth-prog'].insertSnippet = (snippet) => {
              const cm = editor;
              if (!cm?.replaceSelection) return;
              if (cm.somethingSelected()) cm.replaceSelection(snippet);
              else cm.replaceRange('\n' + snippet, cm.getCursor());
              cm.focus();
            };
          }

          // 🎨 COLOR PICKER
          this.initColorPicker(editor, container);
          editorPrefsPromise.then((prefs) => applyEditorPrefs(editor, prefs));
          Promise.resolve().then(() => {
            const activeFile = getActiveFile();
            if (activeFile) {
              loadFileIntoEditor(activeFile, { restoreView: true, refreshChrome: false, queueLive: false });
            }
          }).catch(() => {});
        };

        // Si los addons ya están cargados, inicializar de inmediato
        if (CodeMirror.fold?.brace) {
          this._editorReady = loadCodeMirrorStyle('lib/codemirror.min.css')
            .catch(() => {})
            .then(() => initEditor());
        } else {
          // Asegurar CSS base y folding incluso si el JS ya existe en memoria.
          this._editorReady = Promise.all([
            loadCodeMirrorStyle('lib/codemirror.min.css').catch(() => {}),
            loadCodeMirrorStyle('addon/fold/foldgutter.min.css').catch(() => {}),
            loadCodeMirrorScript('addon/fold/foldcode.min.js'),
            loadCodeMirrorScript('addon/fold/foldgutter.min.js'),
            loadCodeMirrorScript('addon/fold/brace-fold.min.js'),
            loadCodeMirrorScript('addon/fold/xml-fold.min.js'),
            loadCodeMirrorScript('addon/fold/comment-fold.min.js'),
          ]).then(initEditor).catch(() => {
            // Si falla el extra de folding, igual dejamos el editor listo.
            initEditor();
          });
        }
      } else {
        this.editor = {
          getValue: () => codeEditor.value,
          setValue: (v) => { codeEditor.value = v ?? ''; },
          on: (evt, fn) => { if (evt === 'change') codeEditor.addEventListener('input', fn); },
          setOption: () => {},
          addKeyMap: () => {},
          focus: () => codeEditor.focus(),
          toTextArea: () => {},
          _isStub: true
        };
        editor = this.editor;
        const initLoadedCodeMirror = () => {
          if (!(window.CodeMirror && typeof window.CodeMirror.fromTextArea === 'function')) {
            throw new Error('CodeMirror core no disponible');
          }

          const hasFold = !!(CodeMirror.fold?.brace || CodeMirror.fold?.comment);
          const gutterIds = ['CodeMirror-linenumbers'];
          if (hasFold) gutterIds.push('CodeMirror-foldgutter');

          editor = CodeMirror.fromTextArea(codeEditor, {
            mode: 'htmlmixed',
            theme: 'lth-vscode',
            lineNumbers: true,
            lineWrapping: true,
            tabSize: 2,
            indentUnit: 2,
            autoCloseBrackets: true,
            autoCloseTags: true,
            matchBrackets: true,
            styleActiveLine: true,
            foldGutter: hasFold,
            gutters: gutterIds,
            ...(hasFold ? {
              extraKeys: {
                'Ctrl-[': (cm) => cm.foldCode(cm.getCursor()),
                'Ctrl-]': (cm) => cm.foldCode(cm.getCursor(), null, 'unfold'),
              }
            } : {})
          });

          this.editor = editor;
          loadExtraCodeMirrorModes();

          if (window.LTH_APPS?.['lth-prog']) {
            window.LTH_APPS['lth-prog'].editor = editor;
            window.LTH_APPS['lth-prog'].insertSnippet = (snippet) => {
              const cm = editor;
              if (!cm?.replaceSelection) return;
              if (cm.somethingSelected()) cm.replaceSelection(snippet);
              else cm.replaceRange('\n' + snippet, cm.getCursor());
              cm.focus();
            };
          }

          this.initColorPicker(editor, container);
          editorPrefsPromise.then((prefs) => applyEditorPrefs(editor, prefs));
          Promise.resolve().then(() => {
            const activeFile = getActiveFile();
            if (activeFile) {
              loadFileIntoEditor(activeFile, { restoreView: true, refreshChrome: false, queueLive: false });
            }
          }).catch(() => {});
        };

        this._editorReady = Promise.all([
          loadCodeMirrorStyle('lib/codemirror.min.css'),
          loadCodeMirrorScript('lib/codemirror.min.js')
        ]).then(() => Promise.all([
          loadCodeMirrorScript('mode/xml/xml.min.js'),
          loadCodeMirrorScript('mode/javascript/javascript.min.js'),
          loadCodeMirrorScript('mode/css/css.min.js'),
          loadCodeMirrorScript('mode/htmlmixed/htmlmixed.min.js'),
          loadCodeMirrorScript('addon/edit/matchbrackets.min.js'),
          loadCodeMirrorScript('addon/edit/closebrackets.min.js'),
          loadCodeMirrorScript('addon/edit/closetag.min.js'),
          loadCodeMirrorScript('addon/selection/active-line.min.js'),
          loadCodeMirrorStyle('addon/fold/foldgutter.min.css'),
          loadCodeMirrorScript('addon/fold/foldcode.min.js'),
          loadCodeMirrorScript('addon/fold/foldgutter.min.js'),
          loadCodeMirrorScript('addon/fold/brace-fold.min.js'),
          loadCodeMirrorScript('addon/fold/xml-fold.min.js'),
          loadCodeMirrorScript('addon/fold/comment-fold.min.js')
        ])).then(() => {
          initLoadedCodeMirror();
        }).catch((err) => {
          console.warn('[LTH PROG] No se pudo cargar CodeMirror:', err);
          this.showNotification('⚠️ CodeMirror no cargado: usando editor simple');
        });
      }

const getCode = () => this.editor?.getValue?.() || '';
      const setCode = (v) => {
        if (!this.editor?.setValue) return;
        this.editor.setValue(v ?? '');
      };
// ✅ evita que eventos "change/live/autosave" pisen mientras carga un proyecto
// NOTA: Este flag se pondrá en false DESPUÉS de cargar el proyecto
this._isLoadingProject = false;

      // ===== MULTI-FILE (helpers mínimos) =====
const getActiveFile = () =>
  this.state.activeFileId
    ? (this.state.filesList.find(f => f.id === this.state.activeFileId) || null)
    : null;

const saveActiveFileContent = () => {
  return flushActiveFilePersistence({ touchDraft: true });
};

const loadFileIntoEditor = (file, options = {}) => {
  cancelPendingEditorWork();

  if (!file) {
    if (currentFileName) currentFileName.textContent = 'Sin archivo';
    setCode('');
    updateEditorInfo();
    setStatusForFile(null, 'Sin archivo');
    persistSessionMeta();
    return;
  }

  this.state.activeFileId = file.id;
  this.state.editorTab = file.type || 'html';
  this._syncLegacyFiles && this._syncLegacyFiles();

  _isRestoringEditorView = true;
  setCode(file.content || '');
  restoreEditorHistoryState(file.historyState || null);

  const modes = {
    html: 'htmlmixed',
    css: 'css',
    js: 'javascript',
    py: 'python',
    json: 'application/json',
    md: 'markdown',
    sql: 'text/x-sql',
    shell: 'shell',
    cpp: 'text/x-c++src',
    csharp: 'text/x-csharp',
    java: 'text/x-java',
    kotlin: 'text/x-kotlin',
    swift: 'text/x-swift',
    go: 'text/x-go',
    rust: 'text/x-rustsrc',
    php: 'application/x-httpd-php',
    ruby: 'ruby',
    dart: 'text/x-dart',
    docker: 'dockerfile',
    makefile: 'text/x-makefile',
    txt: 'text/plain'
  };
  if (this.editor?.setOption) this.editor.setOption('mode', modes[file.type] || 'htmlmixed');
  if (currentFileName) currentFileName.textContent = file.name || 'Sin nombre';

  updateEditorInfo();
  setStatusForFile(file);
  persistSessionMeta();

  if (file.path) {
    readOfficialFileContent(file.path).then((disk) => {
      if (!disk.success) return;
      const latest = (this.state.filesList || []).find((entry) => entry.id === file.id);
      if (!latest) return;
      const wasDirty = !!latest.isDirty;
      const hadContent = !!toText(latest.content).length;
      const editorHasMeaningfulDiff = hasMeaningfulContentChange(latest.content, disk.content);
      const shouldRefreshFromDisk = !latest.isDirty || !editorHasMeaningfulDiff || !toText(latest.content).length;
      if (!shouldRefreshFromDisk) return;

      latest.content = disk.content;
      latest.savedContent = disk.content;
      latest.savedAt = Date.now();
      latest.draftUpdatedAt = latest.savedAt;
      latest.isDirty = false;
      persistFileState(latest);

      if (this.state.activeFileId === latest.id && (!wasDirty || !hadContent || !editorHasMeaningfulDiff)) {
        _isRestoringEditorView = true;
        setCode(latest.content || '');
        restoreEditorHistoryState(latest.historyState || null);
        updateEditorInfo();
        setStatusForFile(latest);
        restoreEditorViewState(latest.editorState, { focus: options.focus !== false });
        if (options.queueLive !== false && this.queueLiveUpdate) this.queueLiveUpdate(container);
      }
    }).catch((err) => {
      console.warn('[LTH PROG] No se pudo hidratar el archivo desde disco al abrirlo:', err);
    });
  }

  if (options.restoreView === false) {
    _isRestoringEditorView = false;
    if (options.focus !== false) setTimeout(() => this.editor?.focus && this.editor.focus(), 0);
  } else {
    restoreEditorViewState(file.editorState, { focus: options.focus !== false });
  }

  if (options.refreshChrome !== false) scheduleChromeRefresh();
  if (options.queueLive !== false && this.queueLiveUpdate) this.queueLiveUpdate(container);
};

const loadActiveFileIntoEditor = (options = {}) => {
  const f = getActiveFile();
  if (!f) {
    loadFileIntoEditor(null, options);
    return;
  }
  loadFileIntoEditor(f, options);
};

const refreshPathBackedFilesFromDisk = async (options = {}) => {
  const workspaceKey = options.workspaceKey || getWorkspaceKey();
  const files = (this.state.filesList || []).filter(file => !!file?.path);
  if (!files.length) return false;

  let changed = false;
  for (const file of files) {
    const disk = await readOfficialFileContent(file.path);
    if (!disk.success) continue;

    removeStoredFileState(file, workspaceKey);
    const refreshed = hydrateFileRecord({
      ...file,
      content: disk.content,
      savedContent: disk.content
    }, {
      officialContent: disk.content,
      hasOfficialSource: true,
      workspaceKey,
      ignoreStoredState: true,
      editorState: file.editorState
    });

    Object.assign(file, refreshed, { isDirty: false });
    persistFileState(file);
    changed = true;
  }

  if (!changed) return false;

  this._syncLegacyFiles && this._syncLegacyFiles();
  persistSessionMeta();
  scheduleChromeRefresh();

  const active = getActiveFile();
  if (active?.path) {
    loadFileIntoEditor(active, {
      restoreView: true,
      refreshChrome: true,
      queueLive: false,
      focus: options.focus === true
    });
  }

  return true;
};
this._refreshPathBackedFilesFromDisk = refreshPathBackedFilesFromDisk;

const cancelPendingEditorWork = () => {
  if (_draftPersistTimer) {
    clearTimeout(_draftPersistTimer);
    _draftPersistTimer = null;
  }
  if (this._debounceTimer) {
    clearTimeout(this._debounceTimer);
    this._debounceTimer = null;
  }
};


      const updateEditorInfo = () => {
        const content = getCode();
        const lines = content.split('\n').length;
        const chars = content.length;
        editorInfo.textContent = `Líneas: ${lines} | Caracteres: ${chars}`;
      };

const saveCurrentTabContent = () => {
  return flushActiveFilePersistence({ touchDraft: true, refreshChrome: true });
};

const switchEditorTab = (tabName) => {
  // tabName viene como: "html" | "css" | "js"
  saveCurrentTabContent();


  // escoger el primer archivo de ese type en filesList
  const target = (this.state.filesList || []).find(f => f.type === tabName);
  if (!target) {
    this.showNotification(`❌ No existe archivo tipo ${tabName}`);
    return;
  }

  if (typeof openFileById === 'function') {
    openFileById(target.id, { skipCapture: true, restoreView: true });
  }
};

const captureActiveFileState = ({ touchDraft = true, persist = true, refreshChrome = true } = {}) => {
  if (this._isLoadingProject) return null;

  const active = getActiveFile();
  if (!active) return null;

  active.content = getCode();
  active.editorState = captureEditorViewState();
  active.historyState = captureEditorHistoryState();
  markFileDirtyState(active, { touchDraft });

  this._syncLegacyFiles && this._syncLegacyFiles();

  if (persist) {
    persistFileState(active);
    persistSessionMeta();
  }

  if (refreshChrome) scheduleChromeRefresh();
  setStatusForFile(active);
  return active;
};

const scheduleActiveFilePersistence = ({ delay = 120, touchDraft = true, refreshChrome = true } = {}) => {
  if (_isRestoringEditorView || this._isLoadingProject) return;
  clearTimeout(_draftPersistTimer);
  _draftPersistTimer = setTimeout(() => {
    _draftPersistTimer = null;
    captureActiveFileState({ touchDraft, persist: true, refreshChrome });
  }, delay);
};

const flushActiveFilePersistence = ({ touchDraft = true, refreshChrome = true } = {}) => {
  if (_draftPersistTimer) {
    clearTimeout(_draftPersistTimer);
    _draftPersistTimer = null;
  }
  return captureActiveFileState({ touchDraft, persist: true, refreshChrome });
};
this._flushEditorPersistence = flushActiveFilePersistence;
this._persistEditorSession = persistSessionMeta;

  const assembleHTML = () => {
  // ✅ Sincronizar contenido del editor al archivo activo ANTES de ensamblar
  const activeFile = (this.state.filesList || []).find(f => f.id === this.state.activeFileId);
  if (activeFile && this.editor && typeof this.editor.getValue === 'function') {
    activeFile.content = this.editor.getValue() || '';
  }

  if (this._isLoadingProject) return '';

  const filesList = this.state.filesList || [];

  // HTML principal
  const activeHtml = filesList.find(f => f.id === this.state.activeFileId && f.type === 'html')
                  || filesList.find(f => f.type === 'html');
  const htmlContent = activeHtml?.content || '';

  // Detectar qué CSS/JS referencia el HTML por nombre de archivo
  const linkedCssNames = new Set();
  const linkedJsNames  = new Set();
  if (htmlContent) {
    const linkRe   = /<link[^>]+href=["']([^"'?#]+\.css)[^"']*["'][^>]*>/gi;
    const scriptRe = /<script[^>]+src=["']([^"'?#]+\.js)[^"']*["'][^>]*>/gi;
    let m;
    while ((m = linkRe.exec(htmlContent))   !== null) linkedCssNames.add(m[1].split('/').pop());
    while ((m = scriptRe.exec(htmlContent)) !== null) linkedJsNames.add(m[1].split('/').pop());
  }

  // Si el HTML referencia archivos por nombre → usar SOLO esos (evita mezcla de proyectos)
  // Si no referencia nada → inyectar todos los CSS/JS de la lista (modo proyecto inline)
  const cssFiles = linkedCssNames.size > 0
    ? filesList.filter(f => f.type === 'css' && linkedCssNames.has(f.name))
    : filesList.filter(f => f.type === 'css');

  const jsFiles = linkedJsNames.size > 0
    ? filesList.filter(f => f.type === 'js'  && linkedJsNames.has(f.name))
    : filesList.filter(f => f.type === 'js');

  const cssContent = cssFiles.map(f => f.content || '').join('\n');
  const jsContent  = jsFiles.map(f => f.content || '').join('\n');

  // Si no hay HTML, arma uno básico
  let finalHTML = (htmlContent && htmlContent.trim())
    ? htmlContent
    : `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preview</title></head><body></body></html>`;

  // Limpia links/scripts externos e injected viejos para no duplicar
  finalHTML = finalHTML
    .replace(/<link[^>]*href=["'][^"']*\.css(\?[^"']*)?["'][^>]*>/gi, '')
    .replace(/<script[^>]*src=["'][^"']*\.js(\?[^"']*)?["'][^>]*>\s*<\/script>/gi, '')
    .replace(/<style[^>]*id=["']injected-css["'][^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*id=["']injected-js["'][^>]*>[\s\S]*?<\/script>/gi, '');

  // Inyecta CSS en <head>
  const cssTag = `<style id="injected-css">\n${cssContent}\n</style>`;
  if (/<\/head>/i.test(finalHTML)) finalHTML = finalHTML.replace(/<\/head>/i, `${cssTag}\n</head>`);
  else finalHTML = `${cssTag}\n${finalHTML}`;

  // Hook de consola + JS al final del <body>
  const phoneScrollHide = `<style id="lth-phone-scroll">html::-webkit-scrollbar,body::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}html,body{scrollbar-width:none!important;-ms-overflow-style:none!important}</style>`;
  const consoleHook = `${phoneScrollHide}<script>(function(){document.addEventListener('keydown',function(e){if(e.key==='Escape'){try{window.parent.postMessage({type:'LTH_WM_ESCAPE'},'*')}catch(_){}}},true);const send=(level,args)=>{try{window.parent.postMessage({type:'console',level,data:Array.from(args).map(a=>{if(typeof a==='string')return a;try{return JSON.stringify(a)}catch{return String(a)}}).join(' ')},'*')}catch(e){}};['log','warn','error','info'].forEach(level=>{const orig=console[level];console[level]=function(){send(level,arguments);orig&&orig.apply(console,arguments)}});window.addEventListener('error',e=>send('error',[e.message||'Error']));window.addEventListener('unhandledrejection',e=>send('error',[String(e.reason||'Unhandled')]))})();</script>`;
  const jsTag = `${consoleHook}\n<script id="injected-js">\n${jsContent}\n</script>`;

  if (/<\/body>/i.test(finalHTML)) finalHTML = finalHTML.replace(/<\/body>/i, `${jsTag}\n</body>`);
  else finalHTML += `\n${jsTag}`;

  return finalHTML;
};

      fileTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          switchEditorTab(tab.dataset.file);
        });
      });

      loadActiveFileIntoEditor();
      updateEditorInfo();
this._renderDynamicTabs && this._renderDynamicTabs();

      // ✅ FIX CURSOR: CodeMirror calcula dimensiones cuando el contenedor ya es visible.
      // Si se inicializa mientras el contenedor aún está oculto (display:none / opacity:0),
      // el caret no se dibuja. refresh() fuerza un recálculo seguro.
      const _cmRefreshOnVisible = () => {
        if (!this.editor || !this.editor.refresh) return;
        // Intentar hasta que el elemento tenga altura real (máx 600ms)
        let _attempts = 0;
        const _tryRefresh = () => {
          const cmEl = container.querySelector('.CodeMirror');
          if (cmEl && cmEl.offsetHeight > 0) {
            this.editor.refresh();
            this.editor.focus();
          } else if (_attempts < 12) {
            _attempts++;
            setTimeout(_tryRefresh, 50);
          }
        };
        setTimeout(_tryRefresh, 60);
      };
      _cmRefreshOnVisible();

      this._debounceTimer = null;
      this.queueLiveUpdate = (container) => {
        if (!this.state.live) return;
        clearTimeout(this._debounceTimer);
        this._debounceTimer = setTimeout(() => {
          this.refreshLive(container, false);
        }, 180);
      };

      const handleActiveEditorMutation = () => {
        if (_isRestoringEditorView || this._isLoadingProject) return;
        const active = getActiveFile();
        if (active) {
          active.content = getCode();
          markFileDirtyState(active, { touchDraft: false });
          setStatusForFile(active);
        }
        updateEditorInfo();
        scheduleActiveFilePersistence({ delay: 70, touchDraft: true, refreshChrome: true });
        this.queueLiveUpdate(container);
      };

      const handleActiveEditorViewChange = () => {
        if (_isRestoringEditorView || this._isLoadingProject) return;
        scheduleActiveFilePersistence({ delay: 90, touchDraft: false, refreshChrome: false });
      };

  // Bindear cambios al textarea como fallback inmediato
  if (codeEditor) {
    codeEditor.addEventListener('input', handleActiveEditorMutation);
    ['click', 'keyup', 'mouseup', 'scroll'].forEach(evt => {
      codeEditor.addEventListener(evt, handleActiveEditorViewChange);
    });
  }

  // Cuando el editor real (CM) cargue, bindear contenido + cursor + scroll
  (this._editorReady || Promise.resolve()).then(() => {
    if (this.editor?.on && !this.editor._isStub) {
      this.editor.on('change', handleActiveEditorMutation);
      this.editor.on('cursorActivity', handleActiveEditorViewChange);
      this.editor.on('scroll', handleActiveEditorViewChange);
    }
  });


      const closeMenu = () => {
        fileMenuPanel?.classList.remove('open');
        fileMenuPanel?.setAttribute('aria-hidden', 'true');
      };
      const toggleMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!fileMenuPanel) return;
        const open = fileMenuPanel.classList.toggle('open');
        fileMenuPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
      };
      fileMenuBtn?.addEventListener('click', toggleMenu);

      this._fileMenuOutside = (ev) => {
        if (!fileMenuPanel || !fileMenuPanel.classList.contains('open')) return;
        const inside = fileMenuPanel.contains(ev.target) || fileMenuBtn?.contains(ev.target);
        if (!inside) closeMenu();
      };
      window.addEventListener('click', this._fileMenuOutside);

      this._fileMenuEsc = (ev) => { if (ev.key === 'Escape') closeMenu(); };
      window.addEventListener('keydown', this._fileMenuEsc);

      [newFileBtn, openFileBtn, saveFileBtn, saveAsBtn].forEach(b => b && b.addEventListener('click', () => closeMenu()));

      // ============================================================
      // WORKSPACE MODE — distingue archivos de carpeta vs proyectos
      // ============================================================
      const workspaceBadge = container.querySelector('#workspaceBadge');
      const lthRoot = container.querySelector('.lth-prog-root');

      const setWorkspaceMode = (mode, folderPath) => {
        this.state.workspaceMode = mode;
        this.state.folderPath = folderPath || null;
        lthRoot?.classList.toggle('folder-mode', mode === 'folder');
        lthRoot?.classList.toggle('project-mode', mode === 'project');
        if (workspaceBadge) {
          workspaceBadge.className = 'lth-workspace-badge ' + (mode === 'folder' ? 'folder-mode' : 'project-mode');
          if (mode === 'folder') {
            const shortPath = folderPath ? folderPath.split(/[\\/]/).slice(-2).join('/') : '?';
            workspaceBadge.textContent = `📁 ${shortPath}`;
            workspaceBadge.title = `Carpeta externa: ${folderPath}`;
          } else {
            workspaceBadge.textContent = `💼 Proyecto`;
            workspaceBadge.title = 'Modo proyecto interno';
          }
        }
        persistSessionMeta();
      };

      // ⚠️ Restaurar la sesión ANTES de tocar el modo: setWorkspaceMode() persiste
      // en localStorage, así que llamarlo primero sobrescribía la sesión del run
      // anterior (carpeta/proyecto abierto) y por eso no se reabría al reiniciar.
      const restoredSession = restoreSessionSnapshot();
      if (restoredSession) {
        setWorkspaceMode(this.state.workspaceMode || 'project', this.state.folderPath || null);
        loadActiveFileIntoEditor({ restoreView: true, refreshChrome: true, queueLive: false });
        Promise.resolve().then(async () => {
          await refreshPathBackedFilesFromDisk({ focus: false });
          if (this.state.workspaceMode === 'folder' && this.state.folderPath && window.electron?.fs?.readDirectoryTree) {
            const restoredTree = await window.electron.fs.readDirectoryTree(this.state.folderPath, { maxDepth: 12, maxEntries: 2200 });
            if (restoredTree?.success) {
              this.state.folderTree = restoredTree.tree;
              this.state.folderFilesIndex = restoredTree.files || [];
              if (!this.state.expandedFolderPaths?.length) this.state.expandedFolderPaths = [this.state.folderPath];
              this._renderFileExplorer?.();
              // Mostrar el explorador para que se vea la carpeta reabierta.
              const restoredExplorer = container.querySelector('#lthFileExplorer');
              restoredExplorer?.classList.add('lfe-open');
              container.querySelector('#explorerBtn')?.classList.add('active');
              // Reanudar la observación de la carpeta restaurada.
              this._startFolderWatch && this._startFolderWatch(this.state.folderPath);
              // Espejar en disco por si localStorage no persiste al cerrar.
              this._saveWorkspaceToDisk && this._saveWorkspaceToDisk(this.state.folderPath);
            }
          }
        }).catch((err) => console.warn('[LTH PROG] No se pudo refrescar archivos reales tras restaurar sesión:', err));
        this.showNotification('↺ Sesión restaurada');
      } else {
        // Sin sesión en localStorage: dejar la UI estable por ahora. La restauración
        // desde disco se dispara más abajo, cuando los helpers del explorador ya existen.
        setWorkspaceMode('project', null);
      }

      // ============================================================
      // ABRIR CARPETA — carga todos los archivos web de la carpeta
      // ============================================================
      const openFolderBtn = container.querySelector('#openFolderBtn');
      openFolderBtn?.addEventListener('click', () => closeMenu());
      openFolderBtn?.addEventListener('click', async (e) => {
        e.preventDefault(); e.stopPropagation();
        try {
          if (!this._isLoadingProject) {
            saveCurrentTabContent();
          }
          cancelPendingEditorWork();

          const folderResult = await window.electron.fs.selectFolder();
          if (!folderResult?.success || !folderResult.path) return;
          const folderPath = folderResult.path;

          const treeResult = window.electron.fs.readDirectoryTree
            ? await window.electron.fs.readDirectoryTree(folderPath, { maxDepth: 12, maxEntries: 2200 })
            : null;
          const dirResult = treeResult?.success
            ? treeResult
            : await window.electron.fs.readDirectory(folderPath);
          if (!dirResult?.success) {
            this.showNotification('❌ No se pudo leer la carpeta');
            return;
          }

          const indexedFiles = treeResult?.success
            ? (treeResult.files || [])
            : (dirResult.files || []);
          const webFiles = indexedFiles
            .filter(f => f && !f.isDirectory && !isFolderMemoryFileName(f.name) && isSupportedTextFile(f))
            .slice(0, 320);

          if (!webFiles.length) {
            this.showNotification('⚠️ No se encontraron archivos de texto/código soportados en esa carpeta');
            return;
          }

          // Leer contenido de cada archivo
          this._isLoadingProject = true;
          const folderWorkspaceKey = buildWorkspaceKey('folder', null, folderPath);
          const sourceFiles = webFiles.map((f, index) => {
            const type = fileNameToEditorType(f.name);
            const relativePath = normalizeRelativePath(f.relativePath || f.name);
            return {
              id: `${type}-${Date.now()}-${index}-${Math.random().toString(36).slice(2,6)}`,
              name: f.name,
              type,
              path: String(f.path || '').replace(/\//g, '\\'),
              relativePath,
              workspaceRelativePath: relativePath,
              content: '',
              externalFolder: folderPath
            };
          });
          const newFilesList = await buildOfficialFilesList(sourceFiles, {
            workspaceKey: folderWorkspaceKey,
            ignoreStoredState: true,
            preferDisk: true,
            hasOfficialSource: true
          });
          sanitizeWorkspaceDraftState(folderWorkspaceKey, newFilesList);

          // Ordenar: HTML primero, luego CSS, luego JS
          const typeOrder = { html: 0, css: 1, js: 2, py: 3, json: 4, md: 5, txt: 6 };
          newFilesList.sort((a, b) => {
            const byType = (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9);
            if (byType !== 0) return byType;
            return String(a.workspaceRelativePath || a.name || '').localeCompare(String(b.workspaceRelativePath || b.name || ''), 'es');
          });

          // Reemplazar filesList
          this.state.filesList = newFilesList;
          this.state.activeFileId = null;
          this.state.hiddenFiles = newFilesList.map(file => file.id);
          this.state.editorTab = 'html';
          this.state.currentProject = null;
          this.state.folderTree = treeResult?.success ? treeResult.tree : {
            name: folderPath.split(/[\\/]/).pop() || folderPath,
            path: folderPath,
            relativePath: '',
            isDirectory: true,
            children: indexedFiles.map(file => ({ ...file, isDirectory: false, relativePath: file.name }))
          };
          this.state.folderFilesIndex = indexedFiles;
          this.state.expandedFolderPaths = [String(folderPath).replace(/\//g, '\\')];
          this.state.folderMemoryPath = getFolderMemoryPath(folderPath);
          this.state.folderMemoryContext = '';
          try {
            const existingMemory = await window.electron.fs.readFile(this.state.folderMemoryPath);
            this.state.folderMemoryContext = typeof existingMemory === 'string'
              ? existingMemory
              : toText(existingMemory?.content || '');
          } catch {}

          this.state.files = {
            html: { content: '', name: 'Sin archivo' },
            css: { content: '', name: 'Sin archivo' },
            js: { content: '', name: 'Sin archivo' },
            py: { content: '', name: 'Sin archivo' }
          };

          // Activar modo carpeta
          setWorkspaceMode('folder', folderPath);
          await syncFolderMemoryToFolder(folderPath);
          updateProjectIndicator();

          // No auto-abrir archivos al abrir carpeta: el usuario elige desde el árbol.
          loadFileIntoEditor(null, { restoreView: true, refreshChrome: false, queueLive: false });

          this._isLoadingProject = false;
          persistWorkspaceSnapshot();
          this._renderDynamicTabs && this._renderDynamicTabs();
          this._renderFileExplorer && this._renderFileExplorer();
          updateEditorInfo();
          setStatusForFile(null, 'Carpeta abierta');
          this.refreshLive(container, true);
          // Observar la carpeta para reflejar cambios externos sin reiniciar.
          this._startFolderWatch && this._startFolderWatch(folderPath);
          // Persistir la carpeta en disco para reabrirla al reiniciar.
          this._saveWorkspaceToDisk && this._saveWorkspaceToDisk(folderPath);

          const folderName = folderPath.split(/[\\/]/).pop();
          const totalLabel = indexedFiles.length > newFilesList.length
            ? `${newFilesList.length}/${indexedFiles.length} archivos de texto`
            : `${newFilesList.length} archivos`;
          this.showNotification(`📁 Carpeta abierta: "${folderName}" (${totalLabel})`);
        } catch (err) {
          this._isLoadingProject = false;
          console.error(err);
          this.showNotification('❌ Error al abrir carpeta: ' + (err?.message || err));
        }
      });

      newFileBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm('¿Resetear todos los archivos a valores por defecto?')) {
          this.state.files.html.content = `<!DOCTYPE html>\n<html>\n<head>\n  <title>Nuevo Proyecto</title>\n  <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n  <h1>Nuevo Proyecto</h1>\n  <script src="app.js"></script>\n</body>\n</html>`;
          this.state.files.css.content = `body { padding: 20px; font-family: Arial; }`;
          this.state.files.js.content = `console.log('Nuevo proyecto');`;
          this.state.files.html.path = null;
          this.state.files.css.path = null;
          this.state.files.js.path = null;
          switchEditorTab('html');
          this.showNotification('📄 Archivos reseteados');
          this.refreshLive(container, true);
        }
      });

      const openExternalFileInEditor = async (filePath, options = {}) => {
        if (!filePath) return { success: false, error: 'Ruta vacia' };

        if (!this._isLoadingProject) {
          saveCurrentTabContent();
        }
        cancelPendingEditorWork();

        const normalizedPath = String(filePath).replace(/\//g, '\\');
        const fileName = options.displayName
          || normalizedPath.split(/[\\/]/).pop()
          || 'archivo';
        const ext = String(fileName).split('.').pop().toLowerCase();
        const type = fileNameToEditorType(fileName);
        const folder = normalizedPath.replace(/[\\/][^\\/]+$/, '');
        const workspaceKey = buildWorkspaceKey('folder', null, folder);
        const normalizedFilePath = normalizePathKey(normalizedPath);
        const providedContent = typeof options.content === 'string' ? options.content : '';
        const includeSiblingFiles = options.includeSiblingFiles === true;

        const loadFolderWorkspace = async () => {
          const dirResult = window.electron?.fs?.readDirectoryTree
            ? await window.electron.fs.readDirectoryTree(folder, { maxDepth: 12, maxEntries: 2200 })
            : await window.electron?.fs?.readDirectory?.(folder);
          const folderFiles = (dirResult?.success ? dirResult.files : [])
            .filter((entry) => {
              if (!entry || entry.isDirectory || !entry.path || !entry.name) return false;
              return !isFolderMemoryFileName(entry.name) && isSupportedTextFile(entry);
            });

          if (!folderFiles.length) return [];

          const sourceFiles = folderFiles.map((entry, index) => {
            const relativePath = normalizeRelativePath(entry.relativePath || entry.name);
            return {
              id: `${fileNameToEditorType(entry.name)}-${Date.now()}-${index}`,
              name: entry.name,
              type: fileNameToEditorType(entry.name),
              path: String(entry.path).replace(/\//g, '\\'),
              relativePath,
              workspaceRelativePath: relativePath,
              content: '',
              externalFolder: folder
            };
          });

          const hydratedFiles = (await Promise.all(sourceFiles.map(async (sourceFile) => {
            let officialContent = '';
            let hasOfficialSource = false;

            if (normalizePathKey(sourceFile.path) === normalizedFilePath && providedContent) {
              officialContent = providedContent;
              hasOfficialSource = true;
            } else {
              const disk = await readOfficialFileContent(sourceFile.path);
              if (disk.success) {
                officialContent = disk.content;
                hasOfficialSource = true;
              }
            }

            return hydrateFileRecord({
              ...sourceFile,
              content: officialContent
            }, {
              officialContent,
              hasOfficialSource,
              workspaceKey,
              ignoreStoredState: true
            });
          }))).filter(Boolean);

          const typeOrder = { html: 0, css: 1, js: 2, py: 3, json: 4, md: 5, txt: 6 };
          hydratedFiles.sort((a, b) => {
            const byType = (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9);
            if (byType !== 0) return byType;
            return String(a.workspaceRelativePath || a.name || '').localeCompare(String(b.workspaceRelativePath || b.name || ''), 'es');
          });

          return hydratedFiles;
        };

        let nextFilesList = [];
        if (includeSiblingFiles) {
          try {
            nextFilesList = await loadFolderWorkspace();
          } catch (err) {
            console.warn('[LTH PROG] No se pudo reconstruir la carpeta del archivo externo:', err);
          }
        }

        if (!nextFilesList.length) {
          let content = providedContent;
          if (!content) {
            const disk = await readOfficialFileContent(normalizedPath);
            if (disk.success) content = disk.content;
          }

          nextFilesList = [hydrateFileRecord({
            id: `${type}-${Date.now()}`,
            name: fileName,
            type,
            path: normalizedPath,
            relativePath: fileName,
            workspaceRelativePath: fileName,
            content: content || '',
            externalFolder: folder
          }, {
            officialContent: content || '',
            hasOfficialSource: true,
            workspaceKey,
            ignoreStoredState: true
          })];
        }

        sanitizeWorkspaceDraftState(workspaceKey, nextFilesList);

        const activeFile = nextFilesList.find((file) =>
          normalizedFilePath && normalizePathKey(file?.path) === normalizedFilePath
        ) || nextFilesList[0] || null;

        if (!activeFile) {
          return { success: false, error: 'No se pudo preparar el archivo para el editor' };
        }

        this._isLoadingProject = true;
        this.state.filesList = nextFilesList;
        this.state.currentProject = null;
        this.state.folderTree = null;
        this.state.folderFilesIndex = [];
        this.state.expandedFolderPaths = [folder];
        this.state.folderMemoryPath = getFolderMemoryPath(folder);
        this.state.activeFileId = activeFile.id;
        this.state.hiddenFiles = nextFilesList
          .filter(file => file.id !== activeFile.id)
          .map(file => file.id);
        this.state.editorTab = activeFile.type || 'html';
        this._syncLegacyFiles && this._syncLegacyFiles();

        setWorkspaceMode('folder', folder);
        updateProjectIndicator();

        this._isLoadingProject = false;
        persistWorkspaceSnapshot();
        persistFileState(activeFile);
        loadFileIntoEditor(activeFile, { restoreView: true, refreshChrome: true, queueLive: true });
        persistSessionMeta();
        editorStatus.textContent = 'Archivo abierto';
        this.showNotification('✅ Archivo abierto: ' + (activeFile.name || fileName));
        this.refreshLive(container, true);
        return { success: true, file: activeFile, filesList: nextFilesList };
      };
      this.openExternalFile = openExternalFileInEditor;
      if (window._lthProgPendingOpen?.path) {
        const pendingOpen = window._lthProgPendingOpen;
        window._lthProgPendingOpen = null;
        setTimeout(() => {
          openExternalFileInEditor(pendingOpen.path, {
            content: typeof pendingOpen.content === 'string' ? pendingOpen.content : '',
            displayName: pendingOpen.path ? pendingOpen.path.split(/[\\/]/).pop() : '',
            includeSiblingFiles: false
          }).catch(() => {});
        }, 30);
      }

      openFileBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          const result = await FS.openDialog({
            filters: [
              { name: 'Archivos de código', extensions: ['html', 'htm', 'css', 'js', 'jsx', 'ts', 'tsx', 'py', 'json', 'md', 'txt', 'yml', 'yaml'] },
              { name: 'Todos', extensions: ['*'] }
            ]
          });
          if (!result || !result.success) return;
          await openExternalFileInEditor(result.path, {
            content: (typeof result.content === 'string') ? result.content : '',
            displayName: result.name,
            includeSiblingFiles: false
          });
        } catch (err) {
          console.error(err);
          this.showNotification('❌ Error al abrir: ' + (err?.message || String(err)));
        }
      });

    const guardarArchivoComo = async () => {
  saveCurrentTabContent();

  // ✅ archivo activo real (filesList)
  const active = (this.state.filesList || []).find(f => f.id === this.state.activeFileId);
  if (!active) {
    this.showNotification('❌ No hay archivo activo');
    return;
  }

  const content = active.content || '';
  const type = active.type || 'html';

  const defaultNames = { html: 'index.html', css: 'styles.css', js: 'app.js', py: 'script.py', json: 'data.json' };
  const filters = {
    html: [{ name: 'HTML', extensions: ['html', 'htm'] }],
    css: [{ name: 'CSS', extensions: ['css'] }],
    js: [{ name: 'JavaScript', extensions: ['js'] }],
    py: [{ name: 'Python', extensions: ['py'] }],
    json: [{ name: 'JSON', extensions: ['json'] }]
  };

  const result = await FS.saveAsDialog(content, active.name || defaultNames[type] || 'file.txt', filters[type] || [{ name: 'Todos', extensions: ['*'] }]);
  if (!result) return;

  const savedPath = result.path || result?.filePath || result?.savedPath;
  const newName = savedPath ? savedPath.split(/[\\/]/).pop() : (result.name || active.name || 'Sin nombre');
  const previousStorageKey = getFileStateStorageKey(active);

  // ✅ actualizar archivo activo real
  active.path = savedPath || active.path || null;
  active.name = newName;
  active.relativePath = normalizeRelativePath(newName);
  active.workspaceRelativePath = normalizeRelativePath(newName);
  if (savedPath) {
    const folder = savedPath.replace(/[\\/][^\\/]+$/, '');
    this.state.currentProject = null;
    setWorkspaceMode('folder', folder);
    try { await materializeFileOnDisk(active, active.content || ''); } catch (indexErr) {
      console.warn('[LTH PROG] No se pudo actualizar indice de carpeta al guardar:', indexErr?.message || indexErr);
    }
    try { await syncFolderMemoryToFolder(folder, `Archivo guardado como ${newName}`); } catch (memoryErr) {
      console.warn('[LTH PROG] No se pudo sincronizar memoria al guardar:', memoryErr?.message || memoryErr);
    }
    updateProjectIndicator();
  }

  // ✅ mantener compat legacy y UI
  this._syncLegacyFiles && this._syncLegacyFiles();
  currentFileName.textContent = active.name || 'Sin nombre';
  markFileAsSaved(active, active.content || '');
  if (previousStorageKey !== getFileStateStorageKey(active)) removeStoredFileState(previousStorageKey);
  this._renderDynamicTabs && this._renderDynamicTabs();

  this.showNotification('✅ Guardado como: ' + (active.name || 'Sin nombre'));
};


const guardarArchivo = async () => {
  try {
    saveCurrentTabContent();

    const active = (this.state.filesList || []).find(f => f.id === this.state.activeFileId);
    if (!active) {
      this.showNotification('❌ No hay archivo activo');
      return;
    }

    if (active.path) {
      // Guardar directamente al path del sistema (modo carpeta o archivo externo)
      await window.electron.fs.writeFile(active.path, active.content || '');
      markFileAsSaved(active, active.content || '');
      this.showNotification(`💾 Guardado: ${active.name}`);
    } else {
      await guardarArchivoComo();
    }

    // refrescar nombres/tabs por si cambió algo
    currentFileName.textContent = active.name || 'Sin nombre';
    this._renderDynamicTabs && this._renderDynamicTabs();
    // Actualizar live preview al guardar
    this.refreshLive(container, true);
  } catch (err) {
    console.error(err);
    this.showNotification('❌ Error al guardar: ' + (err?.message || err));
  }
};


      saveFileBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); guardarArchivo(); });
      saveAsBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); guardarArchivoComo(); });

      // ===== MENÚ PROYECTOS =====
      
      // Función para mostrar un prompt personalizado (Electron no soporta prompt())
      const showPrompt = (message, defaultValue = '') => {
        return new Promise((resolve) => {
          const overlay = document.createElement('div');
          overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(4px)';
          
          const dialog = document.createElement('div');
          dialog.style.cssText = 'background:rgba(20,20,24,0.95);border:1px solid rgba(255,255,255,0.2);border-radius:16px;padding:24px;min-width:400px;box-shadow:0 20px 60px rgba(0,0,0,0.8)';
          
          dialog.innerHTML = `
            <div style="color:#fff;font-size:15px;margin-bottom:16px;font-weight:600">${message}</div>
            <input type="text" id="promptInput" value="${defaultValue}" style="width:100%;padding:10px;border:1px solid rgba(255,255,255,0.2);border-radius:10px;background:rgba(255,255,255,0.08);color:#fff;font-size:14px;margin-bottom:16px;outline:none" />
            <div style="display:flex;gap:8px;justify-content:flex-end">
              <button id="promptCancel" style="padding:8px 16px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.06);color:#fff;border-radius:10px;cursor:pointer">Cancelar</button>
              <button id="promptOk" style="padding:8px 16px;border:1px solid rgba(0,122,255,0.4);background:rgba(0,122,255,0.3);color:#fff;border-radius:10px;cursor:pointer;font-weight:600">Aceptar</button>
            </div>
          `;
          
          overlay.appendChild(dialog);
          document.body.appendChild(trackGlobalNode(overlay));
          
          const input = dialog.querySelector('#promptInput');
          const okBtn = dialog.querySelector('#promptOk');
          const cancelBtn = dialog.querySelector('#promptCancel');
          
          input.focus();
          input.select();
          
          const cleanup = (value) => {
            cleanupTrackedNode(overlay);
            resolve(value);
          };
          
          okBtn.onclick = () => cleanup(input.value.trim() || null);
          cancelBtn.onclick = () => cleanup(null);
          input.onkeydown = (e) => {
            if (e.key === 'Enter') cleanup(input.value.trim() || null);
            if (e.key === 'Escape') cleanup(null);
          };
        });
      };

      // ===== TABS DINÁMICAS (VS style) =====
const iconForType = (t) => {
  if (t === 'folder' || t === 'folder-open') return `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" style="flex-shrink:0"><path d="M2 5.2c0-.9.7-1.6 1.6-1.6h3l1.2 1.3h4.6c.9 0 1.6.7 1.6 1.6v5.1c0 .9-.7 1.6-1.6 1.6H3.6c-.9 0-1.6-.7-1.6-1.6V5.2z" stroke="#a5b4fc" stroke-width="1.2" stroke-linejoin="round"/><path d="${t === 'folder-open' ? 'M2.6 7h10.8l-1 5.2H3.6L2.6 7z' : 'M2 6.6h12'}" stroke="#a5b4fc" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
  if (t === 'css') return `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" style="flex-shrink:0"><path d="M2 2l1.2 10.5L8 14l4.8-1.5L14 2H2z" stroke="#60a5fa" stroke-width="1.2" stroke-linejoin="round"/><path d="M5 5.5h6M5.5 8.5h5M6.5 11l1.5.5 1.5-.5" stroke="#60a5fa" stroke-width="1.1" stroke-linecap="round"/></svg>`;
  if (t === 'js')  return `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" style="flex-shrink:0"><rect x="2" y="2" width="12" height="12" rx="2" stroke="#fbbf24" stroke-width="1.2"/><path d="M6.5 6.5v3.5c0 1-.5 1.5-1.5 1.5M9.5 6.5h2v1.8c0 .9-.8 1.7-2 1.7h-.3" stroke="#fbbf24" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  if (t === 'py')  return `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" style="flex-shrink:0"><path d="M8 2C5.2 2 5.5 3.3 5.5 3.3V5h2.6v.6H4.5S2 5.3 2 8s2.2 2.4 2.2 2.4H5.5v-2.3s-.1-2.2 2.5-2.2h2.5s2.1 0 2.1-2V3.4S12.8 2 8 2zm-1.3 1a.6.6 0 110 1.2.6.6 0 010-1.2z" fill="#34d399"/><path d="M8 14c2.8 0 2.5-1.3 2.5-1.3V11H7.9v-.6h3.6S14 10.7 14 8s-2.2-2.4-2.2-2.4H10.5v2.3s.1 2.2-2.5 2.2H5.5s-2.1 0-2.1 2v.5S3.2 14 8 14zm1.3-1a.6.6 0 110-1.2.6.6 0 010 1.2z" fill="#34d399" opacity=".6"/></svg>`;
  if (t === 'html') return `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" style="flex-shrink:0"><path d="M2 2l1 10 5 2 5-2 1-10H2z" stroke="#f87171" stroke-width="1.2" stroke-linejoin="round"/><path d="M5.5 5.5l-1.5 3 1.5 3M10.5 5.5l1.5 3-1.5 3M7 10l2-5" stroke="#f87171" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  if (t === 'json') return `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" style="flex-shrink:0"><rect x="2" y="2" width="12" height="12" rx="2" stroke="#fb923c" stroke-width="1.2"/><path d="M5.5 5C5.5 5 4.5 5 4.5 6.5s1 1 1 2S4.5 10 4.5 10M10.5 5c0 0 1 0 1 1.5s-1 1-1 2 1 1.5 1 1.5" stroke="#fb923c" stroke-width="1.1" stroke-linecap="round"/><circle cx="8" cy="8" r=".8" fill="#fb923c"/></svg>`;
  if (t === 'md') return `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" style="flex-shrink:0"><rect x="2" y="3" width="12" height="10" rx="2" stroke="#c084fc" stroke-width="1.2"/><path d="M4.5 10V6l2 2 2-2v4M11.5 6v4M10 8.5l1.5 1.5L13 8.5" stroke="#c084fc" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  if (['cpp','csharp','java','kotlin','swift','go','rust','php','ruby','dart','shell','sql','docker','makefile'].includes(t)) return `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" style="flex-shrink:0"><rect x="2" y="2" width="12" height="12" rx="2.3" stroke="#38bdf8" stroke-width="1.2"/><path d="M6.2 5.2L3.8 8l2.4 2.8M9.8 5.2L12.2 8l-2.4 2.8" stroke="#38bdf8" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  if (t === 'txt') return `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" style="flex-shrink:0"><path d="M4 2.5h5L12.5 6v7.5H4V2.5z" stroke="#94a3b8" stroke-width="1.2" stroke-linejoin="round"/><path d="M9 2.5V6h3.5M5.7 8h4.6M5.7 10.3h4.6" stroke="#94a3b8" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  // fallback genérico
  return `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" style="flex-shrink:0"><path d="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6L9 2z" stroke="rgba(255,255,255,.5)" stroke-width="1.2" stroke-linejoin="round"/><path d="M9 2v4h4" stroke="rgba(255,255,255,.5)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
};

const renderDynamicTabs = () => {
  if (!fileTabsHost) return;

  if (
    this.state.workspaceMode === 'folder' &&
    (this.state.filesList || []).length > 8 &&
    (!Array.isArray(this.state.hiddenFiles) || this.state.hiddenFiles.length === 0)
  ) {
    const activeId = this.state.activeFileId || null;
    this.state.hiddenFiles = (this.state.filesList || [])
      .filter(file => !activeId || file.id !== activeId)
      .map(file => file.id);
    persistSessionMeta();
  }

  const hidden = this.state.hiddenFiles || [];
  const filesToShow = (this.state.filesList || []).filter(f => !hidden.includes(f.id));

  fileTabsHost.innerHTML = filesToShow.map(f => {
    const active = f.id === this.state.activeFileId ? 'active' : '';
    const dirty = f.isDirty ? 'is-dirty' : '';
    const safeName = (f.name || 'Sin nombre').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const dirtyDot = f.isDirty ? '<span class="lfe-unsaved-dot" title="Cambios sin guardar"></span>' : '';

    return `
      <div class="file-tab ${active} ${dirty}" data-file-id="${f.id}" title="${safeName}" draggable="true">
        <span class="file-tab-icon">${iconForType(f.type)}</span>
        <span class="file-tab-name">${safeName}</span>
        ${dirtyDot}
        <button class="file-tab-close" data-close-id="${f.id}" title="Ocultar (va al explorador)">×</button>
      </div>
    `;
  }).join('');

  // Abrir archivo al click
  Array.from(fileTabsHost.querySelectorAll('.file-tab')).forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target?.classList?.contains('file-tab-close')) return;
      e.preventDefault();
      e.stopPropagation();
      openFileById(el.dataset.fileId);
    });
    // Drag tab para reordenar (futuro) — por ahora marca origen
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('lth-tab-id', el.dataset.fileId);
    });
  });

  // Cerrar archivo (X) → OCULTAR, no borrar
  Array.from(fileTabsHost.querySelectorAll('.file-tab-close')).forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeFileById(btn.dataset.closeId);
    });
  });

  // Drag & drop de archivos externos al tab bar
  if (!fileTabsHost.dataset.dndBound) {
    fileTabsHost.dataset.dndBound = '1';
    fileTabsHost.addEventListener('dragover', (e) => {
      e.preventDefault();
      fileTabsHost.classList.add('lfe-tab-drag-over');
    });
    fileTabsHost.addEventListener('dragleave', () => {
      fileTabsHost.classList.remove('lfe-tab-drag-over');
    });
    fileTabsHost.addEventListener('drop', (e) => {
      e.preventDefault();
      fileTabsHost.classList.remove('lfe-tab-drag-over');
      handleFileDrop(e.dataTransfer.files, e.dataTransfer.getData('lth-hidden-id'));
    });
  }
};
const openFileById = (id, options = {}) => {
  if (!options.skipCapture && !this._isLoadingProject) saveCurrentTabContent();
  const f = (this.state.filesList || []).find(x => x.id === id);
  if (!f) return;
  loadFileIntoEditor(f, {
    restoreView: options.restoreView !== false,
    refreshChrome: true,
    queueLive: options.queueLive !== false,
    focus: options.focus !== false
  });
};

const closeFileById = (id) => {
  const list = this.state.filesList || [];
  
  const closing = list.find(f => f.id === id);
  if (!closing) return;

  if (this.state.activeFileId === id) saveCurrentTabContent();

  // ✅ NUEVO: Si es el último archivo visible, no lo escondemos
  const visibleFiles = list.filter(f => !(this.state.hiddenFiles||[]).includes(f.id));
  if (visibleFiles.length <= 1 && visibleFiles[0]?.id === id) {
    this.showNotification('⚠️ No puedes ocultar el último archivo visible');
    return;
  }

  const wasActive = (this.state.activeFileId === id);

  if (closing.isDirty) {
    const confirmClose = window.confirm
      ? window.confirm(`"${closing.name}" tiene cambios sin guardar. ¿Ocultarlo de todas formas?`)
      : true;
    if (!confirmClose) return;
  }

  // ✅ OCULTAR (mover a hiddenFiles) en vez de borrar
  if (!this.state.hiddenFiles) this.state.hiddenFiles = [];
  if (!this.state.hiddenFiles.includes(id)) {
    this.state.hiddenFiles.push(id);
  }

  // si cerraste el activo, abre otro visible
  if (wasActive) {
    const nextVisible = list.find(f => 
      f.id !== id && !(this.state.hiddenFiles||[]).includes(f.id)
    ) || list.find(f => f.id !== id) || list[0];
    
    if (nextVisible) {
      // quitar de hidden si estaba
      this.state.hiddenFiles = (this.state.hiddenFiles||[]).filter(x => x !== nextVisible.id);
      loadFileIntoEditor(nextVisible, { restoreView: true, refreshChrome: false, queueLive: true });
    }
  }

  this._syncLegacyFiles && this._syncLegacyFiles();
  persistSessionMeta();
  renderDynamicTabs();
  renderFileExplorer();
  this.showNotification(`👁️ "${closing.name}" oculto del tab bar`);
};

// ✅ BORRAR REAL (desde menú contextual del explorador)
const deleteFileById = (id) => {
  const list = this.state.filesList || [];
  if (list.length <= 1) {
    this.showNotification('⚠️ No puedes borrar el único archivo');
    return;
  }
  const deleting = list.find(f => f.id === id);
  if (!deleting) return;

  // Requerimiento: debe quedar al menos un HTML
  if (deleting.type === 'html' && list.filter(f => f.type === 'html').length <= 1) {
    this.showNotification('❌ Debe existir al menos un archivo HTML');
    return;
  }

  const wasActive = (this.state.activeFileId === id);
  if (wasActive) saveCurrentTabContent();

  // Eliminar de filesList y hiddenFiles
  this.state.filesList = list.filter(f => f.id !== id);
  this.state.hiddenFiles = (this.state.hiddenFiles||[]).filter(x => x !== id);
  removeStoredFileState(deleting);

  if (wasActive) {
    const next = this.state.filesList.find(f => !(this.state.hiddenFiles||[]).includes(f.id)) || this.state.filesList[0];
    if (next) {
      loadFileIntoEditor(next, { restoreView: true, refreshChrome: false, queueLive: true });
    }
  }

  this._syncLegacyFiles && this._syncLegacyFiles();
  persistSessionMeta();
  renderDynamicTabs();
  renderFileExplorer();
  this.showNotification(`🗑️ Archivo borrado: ${deleting.name}`);
};

// 👉 Exportar para usarlo desde otras partes (por ejemplo createNewFile)
this._renderDynamicTabs = renderDynamicTabs;
this._openFileById = openFileById;
this._closeFileById = closeFileById;
this._saveCurrentTabContent = saveCurrentTabContent;
this._persistFileState = persistFileState;
this._persistSessionMeta = persistSessionMeta;
this._removeStoredFileState = removeStoredFileState;

// ===================================================
// 📁 FILE EXPLORER — Ventanilla lateral VS Code style
// ===================================================
const explorerPanel = container.querySelector('#lthFileExplorer');
const lfeList = container.querySelector('#lfeList');
const lfeDropZone = container.querySelector('#lfeDropZone');
const lfeCloseBtn = container.querySelector('#lfeCloseBtn');
const explorerBtn = container.querySelector('#explorerBtn');

// Toggle explorador
const toggleExplorer = () => {
  const open = explorerPanel.classList.toggle('lfe-open');
  explorerBtn?.classList.toggle('active', open);
  if (open) renderFileExplorer();
};

explorerBtn?.addEventListener('click', toggleExplorer);
lfeCloseBtn?.addEventListener('click', () => {
  explorerPanel.classList.remove('lfe-open');
  explorerBtn?.classList.remove('active');
});

// Botones del header: nuevo archivo / nueva carpeta (en la raíz de la carpeta abierta)
const lfeNewFileBtn = container.querySelector('#lfeNewFileBtn');
const lfeNewFolderBtn = container.querySelector('#lfeNewFolderBtn');
lfeNewFileBtn?.addEventListener('click', (e) => {
  e.preventDefault(); e.stopPropagation();
  this._createFileAt ? this._createFileAt(null) : null;
});
lfeNewFolderBtn?.addEventListener('click', (e) => {
  e.preventDefault(); e.stopPropagation();
  this._createFolderAt ? this._createFolderAt(null) : null;
});

// Ctrl+B para abrir/cerrar explorador
container.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
    e.preventDefault();
    toggleExplorer();
  }
});

// ===================================================
// 📁 HELPERS DE CARPETA: crear, renombrar, recargar, media
// ===================================================
const LFE_IMAGE_EXTS = ['png','jpg','jpeg','gif','webp','avif','bmp','svg','ico'];
const LFE_VIDEO_EXTS = ['mp4','m4v','webm','ogv','mov','mkv','avi'];
const LFE_AUDIO_EXTS = ['mp3','wav','ogg','m4a','flac','aac'];
const LFE_MEDIA_MIME = {
  png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', webp:'image/webp',
  avif:'image/avif', bmp:'image/bmp', svg:'image/svg+xml', ico:'image/x-icon',
  mp4:'video/mp4', m4v:'video/mp4', webm:'video/webm', ogv:'video/ogg', mov:'video/quicktime',
  mkv:'video/x-matroska', avi:'video/x-msvideo',
  mp3:'audio/mpeg', wav:'audio/wav', ogg:'audio/ogg', m4a:'audio/mp4', flac:'audio/flac', aac:'audio/aac'
};
const lfeExtOf = (name) => String(name || '').split('.').pop().toLowerCase();
const lfeIsImage = (name) => LFE_IMAGE_EXTS.includes(lfeExtOf(name));
const lfeIsVideo = (name) => LFE_VIDEO_EXTS.includes(lfeExtOf(name));
const lfeIsAudio = (name) => LFE_AUDIO_EXTS.includes(lfeExtOf(name));
const lfeIsMedia = (name) => lfeIsImage(name) || lfeIsVideo(name) || lfeIsAudio(name);

const lfeJoinPath = (parent, name) =>
  String(parent || '').replace(/[\\/]+$/, '') + '\\' + String(name || '');
const lfeParentOf = (p) =>
  String(p || '').replace(/[\\/]+$/, '').replace(/[\\/][^\\/]+$/, '');
const lfeSanitizeName = (raw) =>
  String(raw || '').trim().replace(/[\\/:*?"<>|]/g, '').trim();
const lfeRelFromFolder = (fullPath) => {
  const folder = String(this.state.folderPath || '');
  let rel = String(fullPath || '');
  if (folder && rel.toLowerCase().startsWith(folder.toLowerCase())) {
    rel = rel.slice(folder.length);
  }
  return normalizeRelativePath(rel.replace(/^[\\/]+/, ''));
};

// Re-lee el árbol de la carpeta abierta desde disco y re-renderiza el explorador.
const reloadFolderTreeFromDisk = async () => {
  if (this.state.workspaceMode !== 'folder' || !this.state.folderPath) return;
  if (!window.electron?.fs?.readDirectoryTree) return;
  try {
    const res = await window.electron.fs.readDirectoryTree(this.state.folderPath, { maxDepth: 12, maxEntries: 2200 });
    if (res?.success) {
      this.state.folderTree = res.tree;
      this.state.folderFilesIndex = res.files || [];
      await syncFolderMemoryToFolder(this.state.folderPath);
      renderFileExplorer();
    }
  } catch (e) { console.warn('[LTH PROG] reloadFolderTreeFromDisk', e); }
};
this._reloadFolderTreeFromDisk = reloadFolderTreeFromDisk;

// Recarga desde disco los archivos abiertos que cambiaron por fuera, SIN pisar
// los que tienen cambios sin guardar (dirty). Devuelve true si algo cambió.
const reloadOpenFilesFromDiskSafe = async () => {
  const files = (this.state.filesList || []).filter(f => f && f.path && !f.isDirty);
  if (!files.length) return false;
  const workspaceKey = getWorkspaceKey();
  let changed = false;
  let activeChanged = false;
  for (const file of files) {
    let disk;
    try { disk = await readOfficialFileContent(file.path); } catch { disk = null; }
    if (!disk || !disk.success) continue;
    if ((disk.content ?? '') === (file.content ?? '')) continue; // sin cambios reales
    removeStoredFileState(file, workspaceKey);
    const refreshed = hydrateFileRecord({
      ...file, content: disk.content, savedContent: disk.content
    }, {
      officialContent: disk.content, hasOfficialSource: true,
      workspaceKey, ignoreStoredState: true, editorState: file.editorState
    });
    Object.assign(file, refreshed, { isDirty: false });
    persistFileState(file);
    changed = true;
    if (file.id === this.state.activeFileId) activeChanged = true;
  }
  if (!changed) return false;
  this._syncLegacyFiles && this._syncLegacyFiles();
  persistSessionMeta();
  scheduleChromeRefresh();
  const active = getActiveFile();
  if (activeChanged && active?.path) {
    loadFileIntoEditor(active, { restoreView: true, refreshChrome: true, queueLive: true, focus: false });
  } else if (this.queueLiveUpdate) {
    this.queueLiveUpdate(container);
  }
  return true;
};

// Observa la carpeta abierta y reacciona a cambios externos sin reiniciar la app.
let _folderWatchTimer = null;
const startFolderWatch = (folderPath) => {
  if (!folderPath || !window.electron?.fs?.watchFolder) return;
  try { this._folderWatchUnsub && this._folderWatchUnsub(); } catch {}
  this._folderWatchUnsub = window.electron.fs.watchFolder(folderPath, () => {
    // Debounce: agrupar ráfagas de eventos del sistema de archivos.
    if (_folderWatchTimer) clearTimeout(_folderWatchTimer);
    _folderWatchTimer = setTimeout(async () => {
      _folderWatchTimer = null;
      if (this.state.workspaceMode !== 'folder' || !this.state.folderPath) return;
      await reloadFolderTreeFromDisk();
      await reloadOpenFilesFromDiskSafe();
    }, 300);
  });
};
const stopFolderWatch = () => {
  try { this._folderWatchUnsub && this._folderWatchUnsub(); } catch {}
  this._folderWatchUnsub = null;
  if (_folderWatchTimer) { clearTimeout(_folderWatchTimer); _folderWatchTimer = null; }
};
this._startFolderWatch = startFolderWatch;
this._stopFolderWatch = stopFolderWatch;

// ── Persistencia EN DISCO de la última carpeta abierta ────────────────────
// localStorage no sobrevive el cierre de la app en LTH OS, así que la carpeta
// abierta se guarda también en un archivo de config (mismo mecanismo que los
// ajustes, que sí persisten) y se restaura al arrancar.
const WORKSPACE_DISK_KEY = 'lth-prog-workspace';
const saveWorkspaceToDisk = (folderPath) => {
  try {
    const activeFile = typeof getActiveFile === 'function' ? getActiveFile() : null;
    const pathFor = (file) => file?.path ? String(file.path).replace(/\//g, '\\') : null;
    const openFilePaths = [...new Set((this.state.filesList || [])
      .map(pathFor)
      .filter(Boolean))];
    const payload = folderPath
      ? {
          folderPath,
          workspaceMode: 'folder',
          expandedFolderPaths: this.state.expandedFolderPaths || [],
          openFilePaths,
          activeFilePath: pathFor(activeFile),
          savedAt: Date.now()
        }
      : { folderPath: null, workspaceMode: 'project', savedAt: Date.now() };
    // Fire-and-forget: usar el storage nativo de Electron y dejar _ProgFS como respaldo.
    if (window.electron?.storage?.saveAppConfig) {
      window.electron.storage.saveAppConfig(WORKSPACE_DISK_KEY, payload)
        .catch((err) => console.warn('[LTH PROG] storage save workspace', err));
    }
    _ProgFS.saveAppConfig(WORKSPACE_DISK_KEY, payload);
  } catch (e) { console.warn('[LTH PROG] saveWorkspaceToDisk', e); }
};
this._saveWorkspaceToDisk = saveWorkspaceToDisk;

// Reabre desde disco la última carpeta (si sigue existiendo). Devuelve true si
// pudo restaurarla. Pensado para llamarse en el arranque cuando localStorage no
// trajo ninguna sesión.
const restoreFolderFromDisk = async () => {
  if (!window.electron?.fs?.readDirectoryTree) return false;
  let cfg;
  try {
    cfg = window.electron?.storage?.loadAppConfig
      ? await window.electron.storage.loadAppConfig(WORKSPACE_DISK_KEY)
      : null;
  } catch { cfg = null; }
  if (!cfg?.config?.folderPath) {
    try { cfg = await _ProgFS.loadAppConfig(WORKSPACE_DISK_KEY); } catch { cfg = null; }
  }
  const cfgConfig = cfg?.success && cfg.config ? cfg.config : {};
  const existingFolderPath = this.state.workspaceMode === 'folder' && this.state.folderPath
    ? this.state.folderPath
    : '';
  const folderPath = existingFolderPath || cfgConfig.folderPath || '';
  if (!folderPath) return false;
  let tree;
  try { tree = await window.electron.fs.readDirectoryTree(folderPath, { maxDepth: 12, maxEntries: 2200 }); }
  catch { tree = null; }
  if (!tree?.success) return false; // carpeta borrada/movida → no reabrir

  const byPath = new Map((tree.files || [])
    .filter(entry => entry?.path && !entry.isDirectory && !isFolderMemoryFileName(entry.name) && isSupportedTextFile(entry))
    .map(entry => [normalizePathKey(entry.path), entry]));
  const currentOpenPaths = (this.state.filesList || [])
    .map(file => file?.path ? String(file.path).replace(/\//g, '\\') : '')
    .filter(Boolean);
  const currentActivePath = (this.state.filesList || [])
    .find(file => file?.id === this.state.activeFileId)?.path || '';
  const requestedPaths = [...new Set([
    ...(Array.isArray(cfgConfig.openFilePaths) ? cfgConfig.openFilePaths : []),
    cfgConfig.activeFilePath || '',
    ...currentOpenPaths,
    currentActivePath || ''
  ].map(value => String(value || '').replace(/\//g, '\\')).filter(Boolean))];
  const workspaceKey = buildWorkspaceKey('folder', null, folderPath);
  const restoredFiles = [];
  for (const savedPath of requestedPaths) {
    const indexed = byPath.get(normalizePathKey(savedPath));
    if (!indexed) continue;
    const disk = await readOfficialFileContent(indexed.path);
    if (!disk.success) continue;
    const type = fileNameToEditorType(indexed.name);
    const relativePath = normalizeRelativePath(indexed.relativePath || indexed.name);
    restoredFiles.push(hydrateFileRecord({
      id: `${type}-${Date.now()}-${restoredFiles.length}-${Math.random().toString(36).slice(2, 7)}`,
      name: indexed.name,
      type,
      path: String(indexed.path).replace(/\//g, '\\'),
      relativePath,
      workspaceRelativePath: relativePath,
      externalFolder: folderPath,
      content: disk.content
    }, {
      officialContent: disk.content,
      hasOfficialSource: true,
      workspaceKey,
      ignoreStoredState: false
    }));
  }

  if (restoredFiles.length || !this.state.filesList?.length) {
    this.state.filesList = restoredFiles.filter(Boolean);
  }
  this.state.hiddenFiles = Array.isArray(this.state.hiddenFiles) ? this.state.hiddenFiles : [];
  const activeKey = normalizePathKey(cfgConfig.activeFilePath || currentActivePath || '');
  const activeFile = activeKey
    ? (this.state.filesList.find(file => normalizePathKey(file.path) === activeKey) || this.state.filesList[0] || null)
    : (this.state.filesList[0] || null);
  this.state.activeFileId = activeFile?.id || null;
  this.state.editorTab = activeFile?.type || this.state.editorTab || 'html';
  this.state.currentProject = null;
  this.state.folderTree = tree.tree;
  this.state.folderFilesIndex = tree.files || [];
  this.state.expandedFolderPaths = (cfgConfig.expandedFolderPaths && cfgConfig.expandedFolderPaths.length)
    ? cfgConfig.expandedFolderPaths
    : [String(folderPath).replace(/\//g, '\\')];
  this.state.folderMemoryPath = getFolderMemoryPath(folderPath);
  this.state.folderMemoryContext = '';
  try {
    const existingMemory = await window.electron.fs.readFile(this.state.folderMemoryPath);
    this.state.folderMemoryContext = typeof existingMemory === 'string'
      ? existingMemory
      : toText(existingMemory?.content || existingMemory?.data || '');
  } catch {}
  this.state.files = {
    html: { content: '', name: 'Sin archivo' },
    css: { content: '', name: 'Sin archivo' },
    js: { content: '', name: 'Sin archivo' },
    py: { content: '', name: 'Sin archivo' }
  };
  setWorkspaceMode('folder', folderPath);
  await syncFolderMemoryToFolder(folderPath);
  this._syncLegacyFiles && this._syncLegacyFiles();
  this._renderDynamicTabs && this._renderDynamicTabs();
  this._renderFileExplorer && this._renderFileExplorer();
  loadFileIntoEditor(activeFile || null, { restoreView: true, refreshChrome: true, queueLive: false, focus: false });
  const panel = container.querySelector('#lthFileExplorer');
  panel?.classList.add('lfe-open');
  container.querySelector('#explorerBtn')?.classList.add('active');
  startFolderWatch(folderPath);
  this.showNotification('📁 Carpeta reabierta');
  return true;
};
this._restoreFolderFromDisk = restoreFolderFromDisk;

// Visor de imágenes / video / audio dentro de la app.
const openMediaViewer = async (filePath, displayName) => {
  const name = displayName || String(filePath).split(/[\\/]/).pop();
  const ext = lfeExtOf(name);
  const mime = LFE_MEDIA_MIME[ext] || 'application/octet-stream';
  const kind = lfeIsVideo(name) ? 'video' : lfeIsAudio(name) ? 'audio' : 'image';

  let src = '';
  let objectUrl = null;

  // Cargar el binario y crear un blob URL. Se usa blob (no http://localhost) porque
  // la CSP del renderer principal bloquea imágenes/media servidas por HTTP; blob: sí
  // está permitido y funciona igual para imagen, video y audio.
  if (window.electron?.fs?.readBinaryFile) {
    try {
      const bin = await window.electron.fs.readBinaryFile(filePath);
      if (bin?.success && bin.base64) {
        const chars = atob(bin.base64);
        const bytes = new Uint8Array(chars.length);
        for (let i = 0; i < chars.length; i++) bytes[i] = chars.charCodeAt(i);
        objectUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
        src = objectUrl;
      } else if (bin && bin.success === false) {
        console.warn('[LTH PROG] readBinaryFile:', bin.error);
      }
    } catch (e) { console.warn('[LTH PROG] openMediaViewer read', e); }
  }

  if (!src) {
    this.showNotification('❌ No se pudo leer el archivo de media');
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'lfe-media-overlay';
  const safeName = String(name).replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let mediaTag = '';
  if (kind === 'video') {
    mediaTag = `<video src="${src}" controls autoplay playsinline class="lfe-media-el"></video>`;
  } else if (kind === 'audio') {
    mediaTag = `<audio src="${src}" controls autoplay class="lfe-media-audio"></audio>`;
  } else {
    mediaTag = `<img src="${src}" alt="${safeName}" class="lfe-media-el" />`;
  }
  overlay.innerHTML = `
    <div class="lfe-media-box">
      <div class="lfe-media-bar">
        <span class="lfe-media-name" title="${safeName}">${safeName}</span>
        <button class="lfe-media-close" title="Cerrar">✕</button>
      </div>
      <div class="lfe-media-stage">${mediaTag}</div>
    </div>`;

  const cleanup = () => {
    overlay.remove();
    if (objectUrl) { try { URL.revokeObjectURL(objectUrl); } catch {} }
    document.removeEventListener('keydown', onKey, true);
  };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); cleanup(); } };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(); });
  overlay.querySelector('.lfe-media-close')?.addEventListener('click', cleanup);
  document.addEventListener('keydown', onKey, true);
  container.appendChild(overlay);
};

// Crear una subcarpeta dentro de parentPath (o de la raíz de la carpeta abierta).
const createFolderAt = async (parentPath) => {
  const parent = parentPath || this.state.folderPath;
  if (!parent || this.state.workspaceMode !== 'folder') { this.showNotification('⚠️ Abre una carpeta primero'); return; }
  if (!window.electron?.fs?.createFolder) { this.showNotification('⚠️ Función no disponible'); return; }
  const raw = await showPrompt('Nombre de la nueva carpeta:', 'nueva-carpeta');
  if (!raw) return;
  const clean = lfeSanitizeName(raw);
  if (!clean) { this.showNotification('⚠️ Nombre inválido'); return; }
  const target = lfeJoinPath(parent, clean);
  const res = await window.electron.fs.createFolder(target);
  if (!res?.success) { this.showNotification('❌ No se pudo crear la carpeta: ' + (res?.error || '')); return; }
  const key = normalizePathKey(parent);
  if (!(this.state.expandedFolderPaths || []).map(normalizePathKey).includes(key)) {
    this.state.expandedFolderPaths = [...(this.state.expandedFolderPaths || []), String(parent).replace(/\//g, '\\')];
  }
  await reloadFolderTreeFromDisk();
  persistSessionMeta();
  this.showNotification('📁 Carpeta creada: ' + clean);
};

// Crear un archivo nuevo dentro de parentPath (o de la raíz de la carpeta abierta).
const createFileAt = async (parentPath) => {
  const parent = parentPath || this.state.folderPath;
  if (!parent || this.state.workspaceMode !== 'folder') { this.showNotification('⚠️ Abre una carpeta primero'); return; }
  if (!window.electron?.fs?.writeFile) { this.showNotification('⚠️ Función no disponible'); return; }
  const raw = await showPrompt('Nombre del nuevo archivo (con extensión):', 'nuevo.html');
  if (!raw) return;
  const clean = lfeSanitizeName(raw);
  if (!clean) { this.showNotification('⚠️ Nombre inválido'); return; }
  const target = lfeJoinPath(parent, clean);
  if (window.electron.fs.itemExists) {
    const ex = await window.electron.fs.itemExists(target);
    if (ex?.exists) { this.showNotification('⚠️ Ya existe un archivo con ese nombre'); return; }
  }
  const res = await window.electron.fs.writeFile(target, '');
  if (!res?.success) { this.showNotification('❌ No se pudo crear: ' + (res?.error || '')); return; }
  const key = normalizePathKey(parent);
  if (!(this.state.expandedFolderPaths || []).map(normalizePathKey).includes(key)) {
    this.state.expandedFolderPaths = [...(this.state.expandedFolderPaths || []), String(parent).replace(/\//g, '\\')];
  }
  await reloadFolderTreeFromDisk();
  persistSessionMeta();
  if (isSupportedTextFile({ name: clean, size: 0 })) {
    const type = fileNameToEditorType(clean);
    const relativePath = lfeRelFromFolder(target);
    const newFile = hydrateFileRecord({
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: clean, type,
      path: String(target).replace(/\//g, '\\'),
      relativePath, workspaceRelativePath: relativePath,
      externalFolder: this.state.folderPath || null, content: ''
    }, { officialContent: '', hasOfficialSource: true, workspaceKey: getWorkspaceKey(), ignoreStoredState: true });
    this.state.filesList = [...(this.state.filesList || []), newFile];
    this.state.hiddenFiles = (this.state.hiddenFiles || []).filter(x => x !== newFile.id);
    persistFileState(newFile);
    loadFileIntoEditor(newFile, { restoreView: true, refreshChrome: true, queueLive: true });
    markFileAsSaved(newFile, '');
  }
  this._saveWorkspaceToDisk && this._saveWorkspaceToDisk(this.state.folderPath);
  this.showNotification('📄 Archivo creado: ' + clean);
};

// Renombrar un archivo o carpeta y actualizar el estado en memoria.
const renameEntryAt = async (oldPath, isDirectory, currentName) => {
  if (!oldPath || this.state.workspaceMode !== 'folder') return;
  if (!window.electron?.fs?.renameItem) { this.showNotification('⚠️ Función no disponible'); return; }
  const cur = currentName || String(oldPath).split(/[\\/]/).pop();
  const raw = await showPrompt('Nuevo nombre:', cur);
  if (!raw) return;
  const clean = lfeSanitizeName(raw);
  if (!clean || clean === cur) return;
  const parent = lfeParentOf(oldPath);
  const target = lfeJoinPath(parent, clean);
  if (window.electron.fs.itemExists) {
    const ex = await window.electron.fs.itemExists(target);
    if (ex?.exists) { this.showNotification('⚠️ Ya existe algo con ese nombre'); return; }
  }
  const res = await window.electron.fs.renameItem(oldPath, target);
  if (!res?.success) { this.showNotification('❌ No se pudo renombrar: ' + (res?.error || '')); return; }

  const oldKey = normalizePathKey(oldPath);
  (this.state.filesList || []).forEach(f => {
    if (!f.path) return;
    const fKey = normalizePathKey(f.path);
    if (fKey === oldKey || fKey.startsWith(oldKey + '\\')) {
      const suffix = String(f.path).slice(oldPath.length);
      f.path = String(target + suffix).replace(/\//g, '\\');
      if (fKey === oldKey && !isDirectory) f.name = clean;
      const rel = lfeRelFromFolder(f.path);
      f.relativePath = rel;
      f.workspaceRelativePath = rel;
      persistFileState(f);
    }
  });
  this.state.expandedFolderPaths = (this.state.expandedFolderPaths || []).map(p => {
    const k = normalizePathKey(p);
    if (k === oldKey || k.startsWith(oldKey + '\\')) {
      return String(target + String(p).slice(oldPath.length)).replace(/\//g, '\\');
    }
    return p;
  });

  await reloadFolderTreeFromDisk();
  this._renderDynamicTabs && this._renderDynamicTabs();
  persistSessionMeta();
  this.showNotification('✏️ Renombrado a: ' + clean);
};

this._createFolderAt = createFolderAt;
this._createFileAt = createFileAt;

// Menú contextual para una CARPETA del árbol.
const showFolderContextMenu = (x, y, folderPath, folderName) => {
  closeCtxMenu();
  const menu = document.createElement('div');
  menu.className = 'lfe-ctx-menu';
  menu.style.left = `${Math.min(x, window.innerWidth - 200)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - 170)}px`;
  const isRoot = normalizePathKey(folderPath) === normalizePathKey(this.state.folderPath || '');
  menu.innerHTML = `
    <div class="lfe-ctx-item" data-action="new-file">📄 Nuevo archivo</div>
    <div class="lfe-ctx-item" data-action="new-folder">📁 Nueva carpeta</div>
    ${isRoot ? '' : `<div class="lfe-ctx-sep"></div>
    <div class="lfe-ctx-item" data-action="rename">✏️ Renombrar</div>`}
  `;
  container.appendChild(menu);
  _ctxMenu = menu;
  menu.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    closeCtxMenu();
    if (action === 'new-file') createFileAt(folderPath);
    if (action === 'new-folder') createFolderAt(folderPath);
    if (action === 'rename') renameEntryAt(folderPath, true, folderName);
  });
};

// Menú contextual para un ARCHIVO del árbol de carpeta (con o sin id abierto).
const showTreeFileContextMenu = (x, y, filePath, fileName, openId) => {
  closeCtxMenu();
  const menu = document.createElement('div');
  menu.className = 'lfe-ctx-menu';
  menu.style.left = `${Math.min(x, window.innerWidth - 200)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - 170)}px`;
  const media = lfeIsMedia(fileName);
  menu.innerHTML = `
    <div class="lfe-ctx-item" data-action="open">${media ? '👁️ Ver' : '📂 Abrir'}</div>
    <div class="lfe-ctx-sep"></div>
    <div class="lfe-ctx-item" data-action="rename">✏️ Renombrar</div>
    <div class="lfe-ctx-item lfe-danger" data-action="delete">🗑️ Eliminar</div>
  `;
  container.appendChild(menu);
  _ctxMenu = menu;
  menu.addEventListener('click', async (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    closeCtxMenu();
    if (action === 'open') {
      if (media) { openMediaViewer(filePath, fileName); return; }
      if (openId) { this.state.hiddenFiles = (this.state.hiddenFiles || []).filter(v => v !== openId); openFileById(openId); }
    }
    if (action === 'rename') renameEntryAt(filePath, false, fileName);
    if (action === 'delete') {
      const ok = window.confirm ? window.confirm(`¿Borrar "${fileName}" del disco? No se puede deshacer.`) : false;
      if (!ok) return;
      if (window.electron?.fs?.deleteItem) {
        const r = await window.electron.fs.deleteItem(filePath);
        if (!r?.success) { this.showNotification('❌ No se pudo borrar: ' + (r?.error || '')); return; }
      }
      if (openId) {
        this.state.filesList = (this.state.filesList || []).filter(f => f.id !== openId);
        this.state.hiddenFiles = (this.state.hiddenFiles || []).filter(v => v !== openId);
      }
      await reloadFolderTreeFromDisk();
      this._renderDynamicTabs && this._renderDynamicTabs();
      persistSessionMeta();
      this.showNotification('🗑️ Eliminado: ' + fileName);
    }
  });
};

// Renderizar lista del explorador
const renderFileExplorer = () => {
  if (!lfeList) return;
  const allFiles = this.state.filesList || [];
  const hidden   = this.state.hiddenFiles || [];

  const visible    = allFiles.filter(f => !hidden.includes(f.id));
  const hiddenList = allFiles.filter(f =>  hidden.includes(f.id));
  const safeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // Helper: clase de color por tipo
  const iconClass = (type) =>
    type === 'html' ? 'lfe-icon-html' :
    type === 'css'  ? 'lfe-icon-css'  :
    type === 'js'   ? 'lfe-icon-js'   :
    type === 'py'   ? 'lfe-icon-py'   :
    type === 'json' ? 'lfe-icon-json' :
    type === 'md'   ? 'lfe-icon-md'   :
    ['cpp','csharp','java','kotlin','swift','go','rust','php','ruby','dart','shell','sql','docker','makefile'].includes(type) ? 'lfe-icon-code' :
    type === 'txt'  ? 'lfe-icon-txt'  : 'lfe-icon-other';

  let html = '';

  if (this.state.workspaceMode === 'folder' && this.state.folderTree) {
    try {
    const expanded = new Set((this.state.expandedFolderPaths || []).map(normalizePathKey));
    expanded.add(normalizePathKey(this.state.folderTree.path || this.state.folderPath || ''));
    const fileByPath = new Map();
    const fileByRelative = new Map();
    allFiles.forEach((file) => {
      if (file.path) fileByPath.set(normalizePathKey(file.path), file);
      if (file.workspaceRelativePath || file.relativePath) {
        fileByRelative.set(normalizeRelativePath(file.workspaceRelativePath || file.relativePath).toLowerCase(), file);
      }
    });

    const renderTreeNode = (node, depth = 0) => {
      if (!node) return '';
      const nodePath = String(node.path || '').replace(/\//g, '\\');
      const relativePath = normalizeRelativePath(node.relativePath || node.name || '');
      const safeName = safeHtml(node.name || relativePath || 'carpeta');
      const safeTitle = safeHtml(relativePath || nodePath || node.name || '');
      const indent = Math.min(16 + depth * 13, 72);

      if (node.isDirectory) {
        const isOpen = expanded.has(normalizePathKey(nodePath));
        const childHtml = isOpen
          ? (node.children || []).map(child => renderTreeNode(child, depth + 1)).join('')
          : '';
        return `
          <div class="lfe-tree-row lfe-folder-row ${isOpen ? 'is-open' : ''}" data-lfe-folder="${safeHtml(nodePath)}" style="padding-left:${indent}px" title="${safeTitle}">
            <span class="lfe-folder-caret">${isOpen ? 'v' : '>'}</span>
            <span class="lfe-folder-icon">${isOpen ? iconForType('folder-open') : iconForType('folder')}</span>
            <span class="lfe-name">${safeName}</span>
            <span class="lfe-folder-count">${(node.children || []).length || ''}</span>
          </div>
          ${childHtml}`;
      }

      const file = fileByPath.get(normalizePathKey(nodePath))
        || fileByRelative.get(relativePath.toLowerCase())
        || null;
      const type = file?.type || fileNameToEditorType(node.name || relativePath);
      const active = file?.id === this.state.activeFileId ? 'lfe-active' : '';
      const dirty = file?.isDirty ? 'lfe-dirty' : '';
      const memory = isFolderMemoryFileName(node.name) ? 'lfe-memory-file' : '';
      const unsupported = !isSupportedTextFile(node) && !file ? 'lfe-unsupported-file' : '';
      const dirtyDot = file?.isDirty ? '<span class="lfe-unsaved-dot" title="Cambios sin guardar"></span>' : '';
      return `
        <div class="lfe-file-item lfe-tree-row ${active} ${dirty} ${memory} ${unsupported}"
          data-lfe-id="${file?.id || ''}"
          data-lfe-path="${safeHtml(nodePath)}"
          data-lfe-relative="${safeHtml(relativePath)}"
          data-lfe-name="${safeName}"
          style="padding-left:${indent + 17}px"
          title="${safeTitle}">
          <span class="lfe-icon ${iconClass(type)}">${iconForType(type)}</span>
          <span class="lfe-name">${safeName}</span>
          ${dirtyDot}
        </div>`;
    };

    html = `
      <div class="lfe-section-title">Carpeta</div>
      <div class="lfe-tree">
        ${renderTreeNode(this.state.folderTree, 0)}
      </div>
      `;

    lfeList.innerHTML = html;

    Array.from(lfeList.querySelectorAll('[data-lfe-folder]')).forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const key = normalizePathKey(el.dataset.lfeFolder || '');
        const next = new Set((this.state.expandedFolderPaths || []).map(normalizePathKey));
        if (next.has(key)) next.delete(key);
        else next.add(key);
        this.state.expandedFolderPaths = [...next];
        persistSessionMeta();
        renderFileExplorer();
      });
      // Clic derecho en carpeta → nuevo archivo / nueva carpeta / renombrar
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const folderPath = el.dataset.lfeFolder || '';
        const folderName = (el.querySelector('.lfe-name')?.textContent || folderPath.split(/[\\/]/).pop() || '').trim();
        showFolderContextMenu(e.clientX, e.clientY, folderPath, folderName);
      });
    });

    Array.from(lfeList.querySelectorAll('.lfe-file-item')).forEach(el => {
      el.addEventListener('click', async (e) => {
        if (e.target?.dataset?.lfeShow) return;
        const id = el.dataset.lfeId;
        if (id) {
          this.state.hiddenFiles = (this.state.hiddenFiles||[]).filter(x => x !== id);
          openFileById(id);
          return;
        }
        const filePath = el.dataset.lfePath;
        const clickName = el.dataset.lfeName || String(filePath).split(/[\\/]/).pop();
        // Imágenes / video / audio → abrir en el visor de media.
        if (lfeIsMedia(clickName)) {
          openMediaViewer(filePath, clickName);
          return;
        }
        const indexed = (this.state.folderFilesIndex || []).find(file => normalizePathKey(file.path) === normalizePathKey(filePath));
        if (!indexed || !isSupportedTextFile(indexed)) {
          this.showNotification('⚠️ Ese archivo no es texto editable');
          return;
        }
        const disk = await readOfficialFileContent(filePath);
        if (!disk.success) {
          this.showNotification('❌ No se pudo leer el archivo');
          return;
        }
        const relativePath = normalizeRelativePath(indexed.relativePath || indexed.name);
        const type = fileNameToEditorType(indexed.name);
        const newFile = hydrateFileRecord({
          id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: indexed.name,
          type,
          path: String(indexed.path || filePath).replace(/\//g, '\\'),
          relativePath,
          workspaceRelativePath: relativePath,
          externalFolder: this.state.folderPath || null,
          content: disk.content
        }, {
          officialContent: disk.content,
          hasOfficialSource: true,
          workspaceKey: getWorkspaceKey(),
          ignoreStoredState: true
        });
        this.state.filesList = [...(this.state.filesList || []), newFile];
        this.state.hiddenFiles = (this.state.hiddenFiles || []).filter(x => x !== newFile.id);
        persistFileState(newFile);
        loadFileIntoEditor(newFile, { restoreView: true, refreshChrome: true, queueLive: true });
        this.showNotification(`📄 Abierto: ${relativePath}`);
      });
    });

    Array.from(lfeList.querySelectorAll('[data-lfe-show]')).forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.lfeShow;
        this.state.hiddenFiles = (this.state.hiddenFiles||[]).filter(x => x !== id);
        openFileById(id);
      });
    });

    Array.from(lfeList.querySelectorAll('.lfe-hidden-file')).forEach(el => {
      el.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('lth-hidden-id', el.dataset.lfeId);
      });
    });

    Array.from(lfeList.querySelectorAll('.lfe-file-item')).forEach(el => {
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = el.dataset.lfeId || '';
        const filePath = el.dataset.lfePath || '';
        const fileName = el.dataset.lfeName || (filePath ? filePath.split(/[\\/]/).pop() : '');
        // Menú del árbol de carpeta: renombrar/borrar en disco + ver media.
        showTreeFileContextMenu(e.clientX, e.clientY, filePath, fileName, id);
      });
    });
    return;
    } catch (err) {
      console.warn('[LTH PROG] No se pudo renderizar el árbol de carpeta:', err);
      lfeList.innerHTML = `
        <div class="lfe-section-title">Carpeta</div>
        <div style="padding:14px 12px;color:rgba(255,255,255,.55);font-size:11px;line-height:1.5">
          No pude pintar el árbol todavía. Abre/cierra el explorador o reabre la carpeta.
        </div>`;
      return;
    }
  }

  if (visible.length) {
    html += `<div class="lfe-section-title">Abiertos (${visible.length})</div>`;
    html += visible.map(f => {
      const active   = f.id === this.state.activeFileId ? 'lfe-active' : '';
      const dirty    = f.isDirty ? 'lfe-dirty' : '';
      const safeName = (f.name || '').replace(/</g,'&lt;');
      const dirtyDot = f.isDirty ? '<span class="lfe-unsaved-dot" title="Cambios sin guardar"></span>' : '';
      return `
        <div class="lfe-file-item ${active} ${dirty}" data-lfe-id="${f.id}" data-lfe-name="${safeName}">
          <span class="lfe-icon ${iconClass(f.type)}">${iconForType(f.type)}</span>
          <span class="lfe-name">${safeName}</span>
          ${dirtyDot}
        </div>`;
    }).join('');
  }

  if (hiddenList.length) {
    html += `<div class="lfe-section-title" style="margin-top:8px">Ocultos (${hiddenList.length})</div>`;
    html += hiddenList.map(f => {
      const safeName = (f.name || '').replace(/</g,'&lt;');
      const dirty = f.isDirty ? 'lfe-dirty' : '';
      const dirtyDot = f.isDirty ? '<span class="lfe-unsaved-dot" title="Cambios sin guardar"></span>' : '';
      return `
        <div class="lfe-file-item lfe-hidden-file ${dirty}" data-lfe-id="${f.id}" data-lfe-name="${safeName}" draggable="true" title="Arrastra al tab bar para abrir">
          <span class="lfe-icon ${iconClass(f.type)}">${iconForType(f.type)}</span>
          <span class="lfe-name">${safeName}</span>
          ${dirtyDot}
          <button class="lfe-show-btn" data-lfe-show="${f.id}">Abrir</button>
        </div>`;
    }).join('');
  }

  if (!allFiles.length) {
    html = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:28px 16px;color:rgba(255,255,255,.2)">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" opacity=".3">
          <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" stroke-width="1.3"/>
        </svg>
        <span style="font-size:11px;text-align:center;line-height:1.5">Sin archivos.<br>Abre un proyecto o arrastra archivos aquí.</span>
      </div>`;
  }

  lfeList.innerHTML = html;

  // Click → abrir archivo
  Array.from(lfeList.querySelectorAll('.lfe-file-item')).forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target?.dataset?.lfeShow) return;
      const id = el.dataset.lfeId;
      if (!id) return;
      this.state.hiddenFiles = (this.state.hiddenFiles||[]).filter(x => x !== id);
      openFileById(id);
    });
  });

  // Botón Abrir en ocultos
  Array.from(lfeList.querySelectorAll('[data-lfe-show]')).forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.lfeShow;
      this.state.hiddenFiles = (this.state.hiddenFiles||[]).filter(x => x !== id);
      openFileById(id);
    });
  });

  // Drag archivos ocultos al tab bar
  Array.from(lfeList.querySelectorAll('.lfe-hidden-file')).forEach(el => {
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('lth-hidden-id', el.dataset.lfeId);
    });
  });

  // Menú contextual clic derecho
  Array.from(lfeList.querySelectorAll('.lfe-file-item')).forEach(el => {
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showLfeContextMenu(e.clientX, e.clientY, el.dataset.lfeId, el.dataset.lfeName);
    });
  });
};

// Drag & drop de archivos externos a la drop zone del explorador
const handleFileDrop = async (files, hiddenId) => {
  // Si viene un id de tab oculta (drag desde explorador)
  if (hiddenId) {
    this.state.hiddenFiles = (this.state.hiddenFiles||[]).filter(x => x !== hiddenId);
    openFileById(hiddenId);
    return;
  }
  if (!files || !files.length) return;

  for (const file of Array.from(files)) {
    const ext = (file.name.split('.').pop()||'').toLowerCase();
    if (!isSupportedTextFile({ name: file.name, size: file.size || 0 })) {
      this.showNotification(`⚠️ Tipo no soportado: ${file.name}`);
      continue;
    }
    const type = fileNameToEditorType(file.name);
    const content = await file.text();
    const existing = (this.state.filesList||[]).find(f => (f.name||'').toLowerCase() === file.name.toLowerCase());
    if (existing) {
      existing.content = content;
      existing.savedContent = content;
      existing.savedAt = Date.now();
      existing.draftUpdatedAt = existing.savedAt;
      existing.isDirty = false;
      persistFileState(existing);
      this.showNotification(`🔄 Actualizado: ${file.name}`);
      openFileById(existing.id);
    } else {
      const id = `${type}-${Date.now()}`;
      const newFile = hydrateFileRecord(
        { id, name: file.name, type, path: null, content },
        { officialContent: content, hasOfficialSource: true }
      );
      if (!this.state.filesList) this.state.filesList = [];
      this.state.filesList.push(newFile);
      persistFileState(newFile);
      openFileById(id);
      this.showNotification(`📂 Abierto: ${file.name}`);
    }
  }
  persistSessionMeta();
  renderDynamicTabs();
  renderFileExplorer();
};

// Drop zone del explorador
lfeDropZone?.addEventListener('dragover', (e) => {
  e.preventDefault();
  lfeDropZone.classList.add('lfe-drag-over');
});
lfeDropZone?.addEventListener('dragleave', () => lfeDropZone.classList.remove('lfe-drag-over'));
lfeDropZone?.addEventListener('drop', (e) => {
  e.preventDefault();
  lfeDropZone.classList.remove('lfe-drag-over');
  handleFileDrop(e.dataTransfer.files, e.dataTransfer.getData('lth-hidden-id'));
});

// También drop en el explorador directamente
explorerPanel?.addEventListener('dragover', (e) => { e.preventDefault(); });
explorerPanel?.addEventListener('drop', (e) => {
  e.preventDefault();
  handleFileDrop(e.dataTransfer.files, e.dataTransfer.getData('lth-hidden-id'));
});

// Menú contextual del explorador
let _ctxMenu = null;
const closeCtxMenu = () => { _ctxMenu?.remove(); _ctxMenu = null; };
document.addEventListener('click', closeCtxMenu);

const showLfeContextMenu = (x, y, fileId, fileName) => {
  closeCtxMenu();
  const file = (this.state.filesList||[]).find(f => f.id === fileId);
  if (!file) return;

  const menu = document.createElement('div');
  menu.className = 'lfe-ctx-menu';
  menu.style.left = `${Math.min(x, window.innerWidth - 200)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - 120)}px`;

  const isHidden = (this.state.hiddenFiles||[]).includes(fileId);
  const isActive = this.state.activeFileId === fileId;

  menu.innerHTML = `
    <div class="lfe-ctx-item" data-action="open">
      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M1 7a6 6 0 1012 0A6 6 0 001 7z"/><path d="M7 4.5V7l1.5 1.5" stroke-linecap="round"/></svg>
      Abrir / Activar
    </div>
    ${isHidden
      ? `<div class="lfe-ctx-item" data-action="show">
           <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z"/><circle cx="7" cy="7" r="1.8"/></svg>
           Mostrar en tab bar
         </div>`
      : `<div class="lfe-ctx-item" data-action="hide">
           <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M2 2l10 10M6.5 3.1A5.8 5.8 0 0113 7s-.9 1.7-2.5 2.9M1 7s1.2-2.1 3.5-3.2"/><path d="M5 9.5A3 3 0 0010 7" stroke-linecap="round"/></svg>
           Ocultar del tab bar
         </div>`
    }
    <div class="lfe-ctx-sep"></div>
    <div class="lfe-ctx-item" data-action="copy">
      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="5" y="5" width="8" height="8" rx="1.2"/><path d="M9 5V3a1 1 0 00-1-1H3a1 1 0 00-1 1v5a1 1 0 001 1h2"/></svg>
      Copiar código
    </div>
    <div class="lfe-ctx-sep"></div>
    <div class="lfe-ctx-item lfe-danger" data-action="delete">
      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M2 4h10M5 4V2.5h4V4M5.5 6.5v4M8.5 6.5v4M3 4l.7 7.5a1 1 0 001 .9h4.6a1 1 0 001-.9L11 4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Eliminar archivo
    </div>
  `;

  container.appendChild(menu);
  _ctxMenu = menu;

  menu.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    closeCtxMenu();

    if (action === 'open') {
      this.state.hiddenFiles = (this.state.hiddenFiles||[]).filter(x => x !== fileId);
      openFileById(fileId);
    }
    if (action === 'show') {
      this.state.hiddenFiles = (this.state.hiddenFiles||[]).filter(x => x !== fileId);
      persistSessionMeta();
      renderDynamicTabs();
      renderFileExplorer();
      this.showNotification(`👁️ "${file.name}" visible en tab bar`);
    }
    if (action === 'hide') {
      closeFileById(fileId);
    }
    if (action === 'copy') {
      // Obtener contenido actualizado
      const content = isActive && this.editor ? (this.editor.getValue() || file.content || '') : (file.content || '');
      if (navigator.clipboard) {
        navigator.clipboard.writeText(content).then(() => this.showNotification(`📋 Copiado: ${file.name}`));
      } else {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = content; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy');
        ta.remove(); this.showNotification(`📋 Copiado: ${file.name}`);
      }
    }
    if (action === 'delete') {
      // Confirmar con prompt personalizado
      const confirmed = window.confirm
        ? window.confirm(`¿Borrar "${file.name}"? Esta acción no se puede deshacer.`)
        : false;
      if (confirmed) deleteFileById(fileId);
    }
  });
};

// Exponer renderFileExplorer para que se llame desde otras partes
this._renderFileExplorer = renderFileExplorer;

Promise.resolve().then(async () => {
  const restored = await restoreFolderFromDisk();
  if (!restored && !restoredSession && this.state.workspaceMode !== 'folder') {
    setWorkspaceMode('project', null);
  }
}).catch((err) => {
  console.warn('[LTH PROG] No se pudo restaurar carpeta desde disco:', err);
  try {
    if (!restoredSession && this.state.workspaceMode !== 'folder') setWorkspaceMode('project', null);
  } catch {}
});


      
      // ➕ Crear archivo extra (sin cambiar layout)
const NEW_FILE_TYPE_CARDS = [
  { label: 'HTML', ext: 'html', name: 'page.html', hint: 'Web UI', type: 'html' },
  { label: 'CSS', ext: 'css', name: 'style.css', hint: 'Estilos', type: 'css' },
  { label: 'JS', ext: 'js', name: 'app.js', hint: 'Frontend', type: 'js' },
  { label: 'TS', ext: 'ts', name: 'app.ts', hint: 'Apps modernas', type: 'js' },
  { label: 'React', ext: 'tsx', name: 'App.tsx', hint: 'Componentes', type: 'js' },
  { label: 'Python', ext: 'py', name: 'main.py', hint: 'IA/backend', type: 'py' },
  { label: 'C++', ext: 'cpp', name: 'main.cpp', hint: 'Nativo/alto rendimiento', type: 'cpp' },
  { label: 'C#', ext: 'cs', name: 'Program.cs', hint: '.NET/apps', type: 'csharp' },
  { label: 'Java', ext: 'java', name: 'Main.java', hint: 'Android/backend', type: 'java' },
  { label: 'Kotlin', ext: 'kt', name: 'Main.kt', hint: 'Android', type: 'kotlin' },
  { label: 'Swift', ext: 'swift', name: 'App.swift', hint: 'iOS/macOS', type: 'swift' },
  { label: 'Go', ext: 'go', name: 'main.go', hint: 'APIs/cloud', type: 'go' },
  { label: 'Rust', ext: 'rs', name: 'main.rs', hint: 'Seguro/rápido', type: 'rust' },
  { label: 'PHP', ext: 'php', name: 'index.php', hint: 'Web backend', type: 'php' },
  { label: 'Dart', ext: 'dart', name: 'main.dart', hint: 'Flutter', type: 'dart' },
  { label: 'SQL', ext: 'sql', name: 'schema.sql', hint: 'Base de datos', type: 'sql' },
  { label: 'Shell', ext: 'sh', name: 'script.sh', hint: 'Automación', type: 'shell' },
  { label: 'Docker', ext: '', name: 'Dockerfile', hint: 'Deploy', type: 'docker' },
  { label: 'JSON', ext: 'json', name: 'data.json', hint: 'Config/datos', type: 'json' },
  { label: 'MD', ext: 'md', name: 'README.md', hint: 'Docs/memoria', type: 'md' }
];

const replaceFileExtension = (fileName, ext) => {
  const clean = String(fileName || '').trim() || 'archivo';
  if (!ext) return clean.includes('.') ? clean.replace(/\.[^./\\]+$/, '') : clean;
  if (/[/\\]$/.test(clean)) return `${clean}archivo.${ext}`;
  if (clean.includes('.')) return clean.replace(/\.[^./\\]+$/, `.${ext}`);
  return `${clean}.${ext}`;
};

const safeNewFileHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const showNewFilePicker = () => new Promise((resolve) => {
  const overlay = document.createElement('div');
  overlay.className = 'lth-new-file-overlay';
  overlay.innerHTML = `
    <div class="lth-new-file-dialog" role="dialog" aria-modal="true">
      <div class="lth-new-file-head">
        <div>
          <div class="lth-new-file-kicker">Nuevo archivo</div>
          <h3>Elige el lenguaje</h3>
          <p>Selecciona una tarjeta y cambia solo el nombre si quieres.</p>
        </div>
        <button class="lth-new-file-close" type="button" aria-label="Cerrar">×</button>
      </div>
      <div class="lth-new-file-grid">
        ${NEW_FILE_TYPE_CARDS.map((card, index) => `
          <button class="lth-new-file-card ${index === 0 ? 'selected' : ''}" type="button" data-index="${index}">
            <span class="lth-new-file-card-icon">${iconForType(card.type)}</span>
            <strong>${safeNewFileHtml(card.label)}</strong>
            <small>${safeNewFileHtml(card.hint)}</small>
          </button>
        `).join('')}
      </div>
      <label class="lth-new-file-label" for="lthNewFileName">Nombre del archivo</label>
      <input class="lth-new-file-input" id="lthNewFileName" value="${safeNewFileHtml(NEW_FILE_TYPE_CARDS[0].name)}" spellcheck="false" />
      <div class="lth-new-file-actions">
        <button class="lth-new-file-cancel" type="button">Cancelar</button>
        <button class="lth-new-file-ok" type="button">Crear archivo</button>
      </div>
    </div>
  `;

  const finish = (value) => {
    try { overlay.remove(); } catch {}
    resolve(value);
  };

  document.body.appendChild(trackGlobalNode(overlay));
  const input = overlay.querySelector('#lthNewFileName');
  const cards = Array.from(overlay.querySelectorAll('.lth-new-file-card'));
  let selected = NEW_FILE_TYPE_CARDS[0];

  const selectCard = (card, button) => {
    selected = card;
    cards.forEach(item => item.classList.remove('selected'));
    button.classList.add('selected');
    input.value = card.ext ? replaceFileExtension(input.value || card.name, card.ext) : card.name;
    input.focus();
    input.select();
  };

  cards.forEach((button) => {
    button.addEventListener('click', () => {
      const card = NEW_FILE_TYPE_CARDS[Number(button.dataset.index) || 0] || NEW_FILE_TYPE_CARDS[0];
      selectCard(card, button);
    });
  });

  overlay.querySelector('.lth-new-file-close')?.addEventListener('click', () => finish(null));
  overlay.querySelector('.lth-new-file-cancel')?.addEventListener('click', () => finish(null));
  overlay.querySelector('.lth-new-file-ok')?.addEventListener('click', () => {
    const value = String(input.value || '').trim();
    finish(value || selected.name);
  });
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) finish(null);
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const value = String(input.value || '').trim();
      finish(value || selected.name);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      finish(null);
    }
  });

  setTimeout(() => {
    input.focus();
    input.select();
  }, 30);
});

const createNewFile = async () => {
  const fileName = await showNewFilePicker();
  if (!fileName) return;

  if (!isSupportedTextFile({ name: fileName, size: 0 })) {
    this.showNotification('❌ Extensión no soportada para archivo de código/texto');
    return;
  }
  const type = fileNameToEditorType(fileName);

  // evitar duplicados por nombre
  const wantedRelative = normalizeRelativePath(fileName).toLowerCase();
  const exists = (this.state.filesList || []).some(f => {
    const rel = normalizeRelativePath(f.workspaceRelativePath || f.relativePath || f.name || '').toLowerCase();
    return rel === wantedRelative || (!wantedRelative.includes('/') && (f.name || '').toLowerCase() === fileName.toLowerCase());
  });
  if (exists) {
    this.showNotification('⚠️ Ya existe un archivo con ese nombre');
    return;
  }

 // ✅ Archivos VACÍOS (sin plantilla)
  const templates = {
    html: '',
    css: '',
    js: '',
    py: ''
  };
  const id = `${type}-${Date.now()}`;
  const relativePath = normalizeRelativePath(fileName);

  const newFile = hydrateFileRecord(
    {
      id,
      name: fileName.split(/[\\/]/).pop() || fileName,
      type,
      path: null,
      relativePath,
      workspaceRelativePath: relativePath,
      externalFolder: null,
      content: templates[type] || ''
    },
    { officialContent: templates[type] || '', hasOfficialSource: false }
  );

  if (!this.state.filesList) this.state.filesList = [];
  this.state.filesList.push(newFile);
  persistFileState(newFile);

  // abrirlo
  openFileById(id, { skipCapture: true, restoreView: true });
  persistSessionMeta();
  this.showNotification(`➕ Archivo creado: ${fileName}`);
  this._renderFileExplorer && this._renderFileExplorer();
};

newExtraFileBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  createNewFile();
});


      const projectMenuBtn = container.querySelector('#projectMenuBtn');
      const projectMenuPanel = container.querySelector('#projectMenuPanel');
      const saveProjectBtn = container.querySelector('#saveProjectBtn');
      const openProjectBtn = container.querySelector('#openProjectBtn');
      const autoSaveToggle = container.querySelector('#autoSaveToggle');
      const projectIndicator = container.querySelector('#projectIndicator');

      // Toggle menú proyectos
      const closeProjectMenu = () => {
        if (!projectMenuPanel) return;
        projectMenuPanel.classList.remove('open');
        projectMenuPanel.setAttribute('aria-hidden', 'true');
      };

      const toggleProjectMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!projectMenuPanel) return;
        const open = projectMenuPanel.classList.toggle('open');
        projectMenuPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
      };
      projectMenuBtn?.addEventListener('click', toggleProjectMenu);

      this._projectMenuOutside = (ev) => {
        if (!projectMenuPanel || !projectMenuPanel.classList.contains('open')) return;
        const inside = projectMenuPanel.contains(ev.target) || projectMenuBtn?.contains(ev.target);
        if (!inside) closeProjectMenu();
      };
      window.addEventListener('click', this._projectMenuOutside);

      this._projectMenuEsc = (ev) => { if (ev.key === 'Escape') closeProjectMenu(); };
      window.addEventListener('keydown', this._projectMenuEsc);

      [saveProjectBtn, openProjectBtn, autoSaveToggle].forEach(b => b && b.addEventListener('click', () => closeProjectMenu()));

      // Actualizar indicador de proyecto
      const updateProjectIndicator = () => {
        if (this.state.currentProject) {
          projectIndicator.style.display = 'inline';
          projectIndicator.textContent = `📁 ${this.state.currentProject}`;
        } else {
          projectIndicator.style.display = 'none';
        }
      };
      if (restoredSession) updateProjectIndicator();
      this.repairLocalMemory = ({ resetRuntime = true, includeExportPath = false } = {}) => {
        let draftsCleared = 0;
        let sessionCleared = false;

        try {
          getAllDraftStorageEntries().forEach((entry) => {
            try { localStorage.removeItem(entry.key); draftsCleared += 1; } catch {}
          });
        } catch {}

        try {
          sessionCleared = !!localStorage.getItem(SESSION_STORAGE_KEY);
          localStorage.removeItem(SESSION_STORAGE_KEY);
        } catch {}

        if (includeExportPath) {
          try { localStorage.removeItem('lth-export-path'); } catch {}
        }

        if (_draftPersistTimer) {
          clearTimeout(_draftPersistTimer);
          _draftPersistTimer = null;
        }
        if (this._debounceTimer) {
          clearTimeout(this._debounceTimer);
          this._debounceTimer = null;
        }

        if (resetRuntime) {
          this.state.currentTab = 'editor';
          this.state.editorTab = 'html';
          this.state.currentProject = null;
          this.state.folderPath = null;
          this.state.workspaceMode = 'project';
          this.state.activeFileId = null;
          this.state.hiddenFiles = [];
          this.state.filesList = [];
          this.state.terminalHistory = [];
          this.state.files = {
            html: { name: 'index.html', content: '', path: null },
            css: { name: 'styles.css', content: '', path: null },
            js: { name: 'app.js', content: '', path: null },
            py: { name: 'main.py', content: '', path: null }
          };
          this._syncLegacyFiles && this._syncLegacyFiles();

          try {
            if (this.editor?.setValue) this.editor.setValue('');
            if (this.editor?.clearHistory) this.editor.clearHistory();
          } catch {}

          if (currentFileName) currentFileName.textContent = 'Sin archivo';
          updateEditorInfo();
          setStatusForFile(null, 'Memoria local reparada');
          setWorkspaceMode('project', null);
          updateProjectIndicator();
          this._renderDynamicTabs && this._renderDynamicTabs();
          this._renderFileExplorer && this._renderFileExplorer();
          scheduleChromeRefresh();
          this.refreshLive(container, true);

          try { localStorage.removeItem(SESSION_STORAGE_KEY); } catch {}
        }

        return { draftsCleared, sessionCleared };
      };
const normalizeNamesBeforeSave = () => {
  if (!this.state.files) this.state.files = { html:{}, css:{}, js:{} };

  const pick = (t) => (this.state.filesList || []).find(f => f.type === t) || null;

  const html = pick('html');
  const css  = pick('css');
  const js   = pick('js');

  if (html) this.state.files.html.name = html.name || this.state.files.html.name || 'index.html';
  if (css)  this.state.files.css.name  = css.name  || this.state.files.css.name  || 'styles.css';
  if (js)   this.state.files.js.name   = js.name   || this.state.files.js.name   || 'app.js';
};

      // Guardar proyecto
      saveProjectBtn?.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!window.electron?.fs) {
          this.showNotification('❌ Storage API no disponible');
          return;
        }

        saveCurrentTabContent();
        
        let projectName = this.state.currentProject;
        if (!projectName) {
          projectName = await showPrompt('Nombre del proyecto:', 'mi-proyecto');
          if (!projectName) return;
        }

saveCurrentTabContent();
this._syncLegacyFiles && this._syncLegacyFiles();
normalizeNamesBeforeSave(); // ✅ <--- AQUI

const _html = (this.state.filesList||[]).find(f=>f.type==='html') || this.state.files?.html;
const _css  = (this.state.filesList||[]).find(f=>f.type==='css')  || this.state.files?.css;
const _js   = (this.state.filesList||[]).find(f=>f.type==='js')   || this.state.files?.js;

if (_html) this.state.files.html.name = _html.name || this.state.files.html.name || 'index.html';
if (_css)  this.state.files.css.name  = _css.name  || this.state.files.css.name  || 'styles.css';
if (_js)   this.state.files.js.name   = _js.name   || this.state.files.js.name   || 'app.js';

const projectData = {
  name: projectName,

  filesList: (this.state.filesList || [])
    .map(f => ({
      id: f.id,
      name: f.name,
      type: f.type,
      path: f.path || null,
      content: f.content || ''
    })),
  activeFileId: this.state.activeFileId || null,
  hiddenFiles: this.state.hiddenFiles || [],

  // ✅ compat (por si algo del sistema todavía usa legacy)
  files: {
    html: { ...this.state.files.html },
    css:  { ...this.state.files.css  },
    js:   { ...this.state.files.js   }
  },

  device: this.state.device,
  split: this.state.split,
  lastModified: new Date().toISOString()
};

        const result = await _ProgFS.saveProject(projectName, projectData);
        
        if (result.success) {
          this.state.currentProject = projectName;
          this.state.lastSaved = new Date().toISOString();
          setWorkspaceMode('project', null);
          updateProjectIndicator();
          persistWorkspaceSnapshot();
          
          // ✅ Guardar como último proyecto para cargar automáticamente
          await _ProgFS.saveAppConfig('lth-prog', {
            lastProject: projectName
          });
          
          this.showNotification(`💾 Proyecto "${projectName}" guardado`);
        } else {
          this.showNotification('❌ Error al guardar proyecto');
        }
      });

      // =====================================================
      // 📤 GUARDAR EN… / ⚡ GUARDAR RÁPIDO / 📂 CAMBIAR RUTA
      // =====================================================
      const saveProjectToBtn    = container.querySelector('#saveProjectToBtn');
      const saveProjectQuickBtn = container.querySelector('#saveProjectQuickBtn');
      const changeExportPathBtn = container.querySelector('#changeExportPathBtn');
      const exportPathIndicator = container.querySelector('#exportPathIndicator');

      // Carga ruta guardada de localStorage al iniciar
      const EXPORT_PATH_KEY = 'lth-export-path';
      const loadExportPath = () => {
        try {
          const saved = localStorage.getItem(EXPORT_PATH_KEY);
          if (saved) {
            this.state.exportPath = saved;
            return saved;
          }
        } catch(e) {}
        return null;
      };
      const saveExportPath = (path) => {
        this.state.exportPath = path;
        try { localStorage.setItem(EXPORT_PATH_KEY, path); } catch(e) {}
      };
      const clearExportPath = () => {
        this.state.exportPath = null;
        try { localStorage.removeItem(EXPORT_PATH_KEY); } catch(e) {}
      };

      const updateExportPathUI = () => {
        const path = this.state.exportPath;
        const hasPath = !!(path);
        if (saveProjectQuickBtn) saveProjectQuickBtn.style.display = hasPath ? '' : 'none';
        if (changeExportPathBtn) changeExportPathBtn.style.display = hasPath ? '' : 'none';
        if (exportPathIndicator) {
          if (hasPath) {
            // Mostrar solo el último segmento de la ruta
            const short = path.split(/[/\\]/).filter(Boolean).slice(-3).join(' › ');
            exportPathIndicator.textContent = `📍 ${short}`;
            exportPathIndicator.classList.add('visible');
          } else {
            exportPathIndicator.classList.remove('visible');
          }
        }
      };

      // Inicializar UI con ruta guardada
      loadExportPath();
      updateExportPathUI();

      // Helper: construye projectData y lo exporta a una ruta
      const buildProjectExportData = () => {
        saveCurrentTabContent();
        this._syncLegacyFiles && this._syncLegacyFiles();
        normalizeNamesBeforeSave();
        const files = (this.state.filesList || []).slice();
        return {
          projectName: this.state.currentProject || 'mi-proyecto',
          files,
          meta: {
            activeFileId: this.state.activeFileId || null,
            hiddenFiles: this.state.hiddenFiles || [],
            device: this.state.device,
            split: this.state.split,
            lastModified: new Date().toISOString()
          }
        };
      };

      // Guarda archivos exportando a una carpeta del sistema
      const doExportToPath = async (basePath) => {
        const data = buildProjectExportData();
        const projectName = data.projectName;

        // Si no hay ruta, abrir diálogo de selección de carpeta
        let targetFolder = basePath;
        if (!targetFolder) {
          const result = await window.electron.fs.selectFolder();
          // selectFolder devuelve string (ruta) o null/undefined si cancela
          if (!result) return; // usuario canceló
          targetFolder = typeof result === 'string' ? result : (result?.path || result?.filePath || null);
          if (!targetFolder) return;
          // Guardar ruta para la próxima vez
          saveExportPath(targetFolder);
          updateExportPathUI();
        }

        // Construir separador de path correcto (Windows usa \, Linux/Mac /)
        const sep = targetFolder.includes('\\') ? '\\' : '/';
        const join = (...parts) => parts.map(p => p.replace(/[\\/]+$/, '')).join(sep);

        // JSON de proyecto completo para restaurar
        const projectJson = JSON.stringify({
          name: projectName,
          filesList: data.files.map(f => ({ id:f.id, name:f.name, type:f.type, path:f.path||null, content:f.content||'' })),
          ...data.meta
        }, null, 2);

        let successCount = 0;
        const errors = [];

        try {
          // Guardar cada archivo del proyecto en la carpeta
          for (const f of data.files) {
            const filePath = join(targetFolder, f.name || f.id);
            try {
              await window.electron.fs.writeFile(filePath, f.content || '');
              successCount++;
            } catch(e) {
              errors.push(f.name);
            }
          }

          // Guardar también el .lthproject (backup JSON completo)
          const projFilePath = join(targetFolder, projectName + '.lthproject');
          await window.electron.fs.writeFile(projFilePath, projectJson);

          if (errors.length) {
            this.showNotification(`⚠️ ${successCount} guardados, ${errors.length} con error`);
          } else {
            this.showNotification(`✅ Proyecto exportado (${successCount} archivos) → ${targetFolder.split(/[\\/]/).slice(-2).join('/')}`);
          }
          if (!errors.length) markWorkspaceAsSaved();
        } catch(err) {
          console.error('Export error:', err);
          this.showNotification('❌ Error al exportar: ' + (err?.message || err));
        }
      };

      // Botón "Guardar en…" — siempre pide nueva carpeta via diálogo
      saveProjectToBtn?.addEventListener('click', async (e) => {
        e.preventDefault(); e.stopPropagation(); closeProjectMenu();
        if (!this.state.currentProject) {
          const name = await showPrompt('Nombre del proyecto antes de exportar:', 'mi-proyecto');
          if (!name) return;
          this.state.currentProject = name;
        }
        // Limpiar ruta previa para forzar nuevo diálogo de carpeta
        clearExportPath();
        await doExportToPath(null);
        updateExportPathUI();
      });

      // Botón "⚡ Guardar en ruta guardada" — usa ruta sin diálogo
      saveProjectQuickBtn?.addEventListener('click', async (e) => {
        e.preventDefault(); e.stopPropagation(); closeProjectMenu();
        const path = this.state.exportPath;
        if (!path) { this.showNotification('⚠️ No hay ruta guardada'); return; }
        if (!this.state.currentProject) {
          const name = await showPrompt('Nombre del proyecto:', 'mi-proyecto');
          if (!name) return;
          this.state.currentProject = name;
        }
        await doExportToPath(path);
      });

      // Botón "📂 Cambiar ruta de exportación"
      changeExportPathBtn?.addEventListener('click', async (e) => {
        e.preventDefault(); e.stopPropagation(); closeProjectMenu();
        clearExportPath(); updateExportPathUI();
        // Volver a pedir ruta con diálogo
        if (!this.state.currentProject) {
          const name = await showPrompt('Nombre del proyecto:', 'mi-proyecto');
          if (!name) return;
          this.state.currentProject = name;
        }
        await doExportToPath(null);
        updateExportPathUI();
      });

      // Abrir proyecto - GESTOR VISUAL PROFESIONAL
      openProjectBtn?.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!window.electron?.fs) {
          this.showNotification('❌ Storage API no disponible');
          return;
        }

        const listResult = await _ProgFS.listProjects();
        
        // Crear overlay del gestor de proyectos
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(8px);animation:fadeIn 0.2s ease';
        
        const panel = document.createElement('div');
        panel.style.cssText = 'background:linear-gradient(135deg, #0f0f14 0%, #1a1a24 100%);border:2px solid rgba(100,150,255,0.3);border-radius:28px;padding:0;width:850px;max-height:88vh;box-shadow:0 40px 120px rgba(0,0,0,0.95),0 0 80px rgba(100,150,255,0.15);overflow:hidden;display:flex;flex-direction:column;position:relative';
        
        // Agregar efecto de brillo animado en el borde
        const shimmer = document.createElement('div');
        shimmer.style.cssText = 'position:absolute;top:-2px;left:-2px;right:-2px;bottom:-2px;background:linear-gradient(90deg,transparent,rgba(100,150,255,0.4),transparent);border-radius:28px;pointer-events:none;animation:shimmer 3s infinite;z-index:0';
        panel.appendChild(shimmer);
        
        const styleSheet = document.createElement('style');
        styleSheet.textContent = `
          @keyframes shimmer { 0%,100%{transform:translateX(-100%)} 50%{transform:translateX(100%)} }
          @keyframes slideIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
          @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
        `;
        document.head.appendChild(styleSheet);
        
        let projectsData = [];
        
        // Cargar metadatos de todos los proyectos
        if (listResult.success && listResult.projects.length > 0) {
          for (const projectName of listResult.projects) {
            this._isLoadingProject = true;
clearTimeout(this._debounceTimer);
this.stopAutoSave && this.stopAutoSave();

            const result = await _ProgFS.loadProjectMeta(projectName);
            if (result.success && result.project) {
              projectsData.push({
                name: projectName,
                data: result.project
                
              });
            }
          }
          this._isLoadingProject = false;

        }
        
        const renderProjects = (searchTerm = '') => {
          const filtered = projectsData.filter(p => 
            p.name.toLowerCase().includes(searchTerm.toLowerCase())
          );
          
          panel.innerHTML = `
            <div style="padding:32px 36px 24px;border-bottom:1px solid rgba(100,150,255,0.2);background:linear-gradient(180deg,rgba(20,20,30,0.8),transparent);position:relative;z-index:1">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
                <div style="display:flex;align-items:center;gap:16px">
                  <div style="width:48px;height:48px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(99,102,241,0.4)">
                    <span style="font-size:26px">💼</span>
                  </div>
                  <div>
                    <h2 style="color:#fff;margin:0;font-size:28px;font-weight:800;letter-spacing:-0.5px">Mis Proyectos</h2>
                    <p style="color:rgba(255,255,255,0.5);margin:4px 0 0;font-size:13px">${filtered.length} proyecto${filtered.length !== 1 ? 's' : ''} disponible${filtered.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <button id="closeProjectManager" style="width:42px;height:42px;border:2px solid rgba(255,100,100,0.3);background:rgba(255,100,100,0.1);color:#ff6b6b;border-radius:12px;cursor:pointer;font-size:20px;display:flex;align-items:center;justify-content:center;transition:all 0.3s;font-weight:700">×</button>
              </div>
              <div style="display:flex;gap:12px">
                <div style="flex:1;position:relative">
                  <span style="position:absolute;left:16px;top:50%;transform:translateY(-50%);font-size:18px">🔍</span>
                  <input type="text" id="projectSearch" placeholder="Buscar proyectos..." value="${searchTerm}" style="width:100%;padding:14px 16px 14px 48px;border:2px solid rgba(100,150,255,0.25);border-radius:14px;background:rgba(20,20,30,0.6);color:#fff;font-size:15px;outline:none;transition:all 0.3s;font-weight:500" />
                </div>
                <button id="newProjectBtn" style="padding:14px 28px;border:2px solid rgba(99,102,241,0.5);background:linear-gradient(135deg,rgba(99,102,241,0.4),rgba(139,92,246,0.4));color:#fff;border-radius:14px;cursor:pointer;font-weight:700;font-size:15px;display:flex;align-items:center;gap:10px;white-space:nowrap;transition:all 0.3s;box-shadow:0 4px 16px rgba(99,102,241,0.3)">
                  <span style="font-size:20px">+</span> Nuevo
                </button>
              </div>
            </div>
            
            <div style="flex:1;overflow-y:auto;padding:24px 36px;position:relative;z-index:1">
              ${filtered.length === 0 ? `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,0.4);text-align:center;padding:60px 40px">
                  <div style="width:120px;height:120px;background:linear-gradient(135deg,rgba(99,102,241,0.1),rgba(139,92,246,0.1));border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:24px;border:2px solid rgba(100,150,255,0.2)">
                    <span style="font-size:56px;opacity:0.4">📂</span>
                  </div>
                  <div style="font-size:22px;font-weight:700;margin-bottom:12px;color:rgba(255,255,255,0.6)">No hay proyectos${searchTerm ? ' que coincidan' : ''}</div>
                  <div style="font-size:15px;opacity:0.6;max-width:320px">Crea tu primer proyecto y comienza a desarrollar aplicaciones increíbles</div>
                </div>
              ` : `
                <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:20px;animation:slideIn 0.4s ease">
                  ${filtered.map((project, idx) => {
                    const date = new Date(project.data.lastModified || Date.now());
                    const dateStr = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
                    const timeStr = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                    
                    const gradients = [
                      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                      'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                      'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                      'linear-gradient(135deg, #30cfd0 0%, #330867 100%)'
                    ];
                    const gradient = gradients[idx % gradients.length];
                    
                    const htmlLines = (project.data.files?.html?.content || '').split('\n').length;
                    const cssLines = (project.data.files?.css?.content || '').split('\n').length;
                    const jsLines = (project.data.files?.js?.content || '').split('\n').length;
                    const totalLines = htmlLines + cssLines + jsLines;
                    
                    return `
                      <div class="project-card" data-project="${project.name}" style="background:linear-gradient(135deg,rgba(30,30,45,0.95),rgba(20,20,35,0.95));border:2px solid rgba(100,150,255,0.2);border-radius:20px;padding:0;cursor:pointer;transition:all 0.3s cubic-bezier(0.4,0,0.2,1);overflow:hidden;position:relative;animation:slideIn 0.5s ease ${idx * 0.1}s backwards">
                        
                        <!-- Header con gradiente -->
                        <div style="height:100px;background:${gradient};position:relative;overflow:hidden">
                          <div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 0%,rgba(20,20,35,0.8) 100%)"></div>
                          <div style="position:absolute;bottom:16px;left:20px;right:20px;display:flex;align-items:end;justify-content:space-between;z-index:1">
                            <div style="flex:1;min-width:0">
                              <div style="font-size:20px;font-weight:800;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,0.4);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${project.name}</div>
                              <div style="font-size:11px;color:rgba(255,255,255,0.8);margin-top:4px;text-shadow:0 1px 4px rgba(0,0,0,0.3)">${totalLines} líneas de código</div>
                            </div>
                            <button class="delete-project" data-project="${project.name}" style="width:36px;height:36px;border:2px solid rgba(255,255,255,0.3);background:rgba(0,0,0,0.3);backdrop-filter:blur(10px);color:#fff;border-radius:10px;cursor:pointer;font-size:18px;opacity:0;transition:all 0.3s;flex-shrink:0">🗑️</button>
                          </div>
                        </div>
                        
                        <!-- Contenido -->
                        <div style="padding:20px">
                          <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
                            <span style="padding:6px 12px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);border-radius:8px;font-size:11px;color:#a5b4fc;font-weight:600;display:flex;align-items:center;gap:6px">
                              <span>${project.data.device === 'phone' ? '📱' : '💻'}</span>
                              ${project.data.device === 'phone' ? 'Móvil' : 'Desktop'}
                            </span>
                            ${project.data.split ? '<span style="padding:6px 12px;background:rgba(168,85,247,0.15);border:1px solid rgba(168,85,247,0.3);border-radius:8px;font-size:11px;color:#d8b4fe;font-weight:600">🪟 Split</span>' : ''}
                          </div>
                          
                          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
                            <div style="background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.25);border-radius:10px;padding:10px;text-align:center">
                              <div style="font-size:10px;color:rgba(255,255,255,0.5);margin-bottom:4px;font-weight:600">HTML</div>
                              <div style="font-size:18px;font-weight:800;color:#f87171">${htmlLines}</div>
                            </div>
                            <div style="background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.25);border-radius:10px;padding:10px;text-align:center">
                              <div style="font-size:10px;color:rgba(255,255,255,0.5);margin-bottom:4px;font-weight:600">CSS</div>
                              <div style="font-size:18px;font-weight:800;color:#60a5fa">${cssLines}</div>
                            </div>
                            <div style="background:rgba(250,204,21,0.1);border:1px solid rgba(250,204,21,0.25);border-radius:10px;padding:10px;text-align:center">
                              <div style="font-size:10px;color:rgba(255,255,255,0.5);margin-bottom:4px;font-weight:600">JS</div>
                              <div style="font-size:18px;font-weight:800;color:#facc15">${jsLines}</div>
                            </div>
                          </div>
                          
                          <div style="display:flex;align-items:center;justify-content:space-between;padding-top:12px;border-top:1px solid rgba(255,255,255,0.08)">
                            <div style="font-size:11px;color:rgba(255,255,255,0.4)">
                              <span style="color:rgba(255,255,255,0.5)">📅</span> ${dateStr}
                            </div>
                            <div style="font-size:11px;color:rgba(255,255,255,0.4)">
                              <span style="color:rgba(255,255,255,0.5)">🕐</span> ${timeStr}
                            </div>
                          </div>
                        </div>
                        
                      </div>
                    `;
                  }).join('')}
                </div>
              `}
            </div>
          `;
          
          // Event listeners
          const closeBtn = panel.querySelector('#closeProjectManager');

closeBtn.onclick = () => cleanupTrackedNode(overlay);
          
          const searchInput = panel.querySelector('#projectSearch');
          searchInput.oninput = (e) => renderProjects(e.target.value);
          searchInput.focus();
          
const newBtn = panel.querySelector('#newProjectBtn');
newBtn.onclick = async () => {
  const projectName = await showPrompt('Nombre del nuevo proyecto:', 'mi-proyecto');
  if (!projectName) return;
  
  // ✅ LIMPIAR completamente el estado anterior
  this.state.filesList = [];
  this.state.activeFileId = null;
  this.state.hiddenFiles = [];
  this.state.currentProject = projectName;
  
  // Limpiar editor
  if (this.editor) {
    this.editor.setValue('');
  }
  
  // Limpiar nombre de archivo
  if (currentFileName) {
    currentFileName.textContent = 'Sin archivo';
  }
  
  // Limpiar tabs
  if (fileTabsHost) {
    fileTabsHost.innerHTML = '';
  }

  // ✅ NO crear archivos por defecto - proyecto VACÍO
  this.state.files.html.content = '';
  this.state.files.css.content = '';
  this.state.files.js.content = '';
  this._syncLegacyFiles && this._syncLegacyFiles();
  setWorkspaceMode('project', null);

  const projectData = {
    name: projectName,
    filesList: [], // ✅ Proyecto vacío sin archivos
    activeFileId: null,
    files: {
      html: { content: '' },
      css: { content: '' },
      js: { content: '' }
    },
    device: this.state.device,
    split: this.state.split,
    lastModified: new Date().toISOString()
  };
  
  await _ProgFS.saveProject(projectName, projectData);
  // ❌ No guardar lastProject — app abre limpia al iniciar
  // await _ProgFS.saveAppConfig('lth-prog', { lastProject: projectName });
  
  cleanupTrackedNode(overlay);
  
  updateProjectIndicator();
  persistSessionMeta();
  this.refreshLive(container, true);
  this.showNotification(`✨ Proyecto "${projectName}" creado (vacío)`);
};
          // Click en tarjetas de proyecto
          const cards = panel.querySelectorAll('.project-card');
          cards.forEach(card => {
            const projectName = card.dataset.project;
            
            card.onmouseenter = () => {
              card.style.transform = 'translateY(-8px) scale(1.02)';
              card.style.borderColor = 'rgba(100,150,255,0.6)';
              card.style.boxShadow = '0 20px 50px rgba(99,102,241,0.4),0 0 40px rgba(99,102,241,0.2)';
              const deleteBtn = card.querySelector('.delete-project');
              if (deleteBtn) {
                deleteBtn.style.opacity = '1';
                deleteBtn.style.transform = 'scale(1)';
              }
            };
            
            card.onmouseleave = () => {
              card.style.transform = 'translateY(0) scale(1)';
              card.style.borderColor = 'rgba(100,150,255,0.2)';
              card.style.boxShadow = 'none';
              const deleteBtn = card.querySelector('.delete-project');
              if (deleteBtn) {
                deleteBtn.style.opacity = '0';
                deleteBtn.style.transform = 'scale(0.8)';
              }
            };
            
            card.onclick = async (e) => {
              this._isLoadingProject = true;
clearTimeout(this._debounceTimer);
this.stopAutoSave && this.stopAutoSave();

              if (e.target.classList.contains('delete-project')) return;
              
              const result = await _ProgFS.loadProject(projectName);
              
              if (result.success && result.project) {
                const project = result.project;
                const projectWorkspaceKey = buildWorkspaceKey('project', projectName, null);
                
console.log('📦 PROYECTO CARGADO DESDE BACKEND:');
   console.log('   filesList:', project.filesList);
   if (project.filesList) {
     project.filesList.forEach((f, i) => {
       console.log(`   ${i}. ${f.name}: ${f.content?.length || 0} chars - "${(f.content || '').substring(0, 30)}..."`);
     });
   }

   if (Array.isArray(project.filesList) && project.filesList.length) {
  this.state.filesList = await buildOfficialFilesList(project.filesList.map(f => ({
    id: f.id || `${f.type || 'html'}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: f.name || 'Sin nombre',
    type: f.type || 'html',
    path: f.path || null,
    content: f.content || ''
  })), {
    workspaceKey: projectWorkspaceKey,
    ignoreStoredState: true,
    preferDisk: true,
    hasOfficialSource: true
  });

  this.state.activeFileId =
    project.activeFileId && this.state.filesList.some(x => x.id === project.activeFileId)
      ? project.activeFileId
      : this.state.filesList[0].id;

  const active = this.state.filesList.find(x => x.id === this.state.activeFileId);
  if (active) this.state.editorTab = active.type;

  this._syncLegacyFiles && this._syncLegacyFiles();
  this._renderDynamicTabs && this._renderDynamicTabs();
  sanitizeWorkspaceDraftState(projectWorkspaceKey, this.state.filesList);
} else {
  // fallback viejo
  const legacyFiles = [
    { id: 'html-1', name: project.files?.html?.name || 'index.html', type: 'html', path: null, content: project.files?.html?.content || '' },
    { id: 'css-1', name: project.files?.css?.name || 'styles.css', type: 'css', path: null, content: project.files?.css?.content || '' },
    { id: 'js-1', name: project.files?.js?.name || 'app.js', type: 'js', path: null, content: project.files?.js?.content || '' }
  ];
  this.state.filesList = await buildOfficialFilesList(legacyFiles, {
    workspaceKey: projectWorkspaceKey,
    ignoreStoredState: true,
    preferDisk: true,
    hasOfficialSource: true
  });
  this.state.activeFileId = 'html-1';
  this.state.editorTab = 'html';
  this._syncLegacyFiles && this._syncLegacyFiles();
  this._renderDynamicTabs && this._renderDynamicTabs();
  sanitizeWorkspaceDraftState(projectWorkspaceKey, this.state.filesList);
}

                
                if (project.device) this.state.device = project.device;
                this.state.split = false;
                this.state.live = false;
                
                this.state.currentProject = projectName;
                setWorkspaceMode('project', null);
                
                await _ProgFS.saveAppConfig('lth-prog', {
                  lastProject: projectName
                });
                
                // ✅ Mostrar SIEMPRE el archivo activo real (evita que se quede el proyecto anterior)
this._syncLegacyFiles && this._syncLegacyFiles();
this._renderDynamicTabs && this._renderDynamicTabs();

if (this._openFileById && this.state.activeFileId) {
  this._openFileById(this.state.activeFileId, { skipCapture: true, restoreView: true, queueLive: false });
}

updateProjectIndicator();
                persistWorkspaceSnapshot();
                this.refreshLive(container, true);
                
                // ✅ VERIFICACIÓN FINAL
console.log('🔍 VERIFICACIÓN POST-CARGA:');
                console.log('   Editor tiene contenido:', this.editor.getValue().length, 'chars');
                console.log('   Preview:', this.editor.getValue().substring(0, 50));
                
                // ✅ Cerrar el overlay
                cleanupTrackedNode(overlay);
                
                // ✅ Marcar que terminó de cargar (DESPUÉS de cerrar overlay)
                this._isLoadingProject = false;
                
                // ✅ Activar auto-save si estaba activo
                if (this.state.autoSave) this.startAutoSave && this.startAutoSave();
                
                this.showNotification(`📂 Proyecto "${projectName}" cargado`);
              }
            };
          });
          
          // Botones eliminar
          const deleteBtns = panel.querySelectorAll('.delete-project');
          deleteBtns.forEach(btn => {
            btn.onclick = async (e) => {
              e.stopPropagation();
              const projectName = btn.dataset.project;
              
              const confirmDelete = await showPrompt(`¿Eliminar "${projectName}"? Escribe "ELIMINAR" para confirmar:`, '');
              if (confirmDelete !== 'ELIMINAR') return;
              
              await _ProgFS.deleteProject(projectName);
              projectsData = projectsData.filter(p => p.name !== projectName);
              renderProjects(searchInput.value);
              this.showNotification(`🗑️ Proyecto "${projectName}" eliminado`);
            };
          });
        };
        
        overlay.appendChild(panel);
        document.body.appendChild(trackGlobalNode(overlay));
        
        renderProjects();
      });

      // Toggle autoguardado
autoSaveToggle?.addEventListener('click', async (e) => {
  e.preventDefault();
  e.stopPropagation();

  const next = !this.state.autoSave;

  // ✅ Si lo estás activando y NO hay nombre de proyecto, pedirlo y crear/guardar 1 vez
  if (next && !this.state.currentProject) {
    const name = await showPrompt('Nombre del proyecto para autoguardado:', 'mi-proyecto');
    if (!name) {
      this.showNotification('⚠️ Autoguardado cancelado (sin nombre)');
      return;
    }

    this.state.currentProject = name;

    // guarda una primera vez para que exista en la lista
    saveCurrentTabContent();
    const active = (this.state.filesList || []).find(f => f.id === this.state.activeFileId);
    if (active && this.editor?.getValue) active.content = this.editor.getValue();

    const projectData = {
      name,
      filesList: (this.state.filesList || []).map(f => ({
        id: f.id, name: f.name, type: f.type, path: f.path || null, content: f.content || ''
      })),
      activeFileId: this.state.activeFileId || null,
      hiddenFiles: this.state.hiddenFiles || [],
      files: {
        html: { ...this.state.files.html },
        css:  { ...this.state.files.css  },
        js:   { ...this.state.files.js   }
      },
      device: this.state.device,
      split: this.state.split,
      lastModified: new Date().toISOString()
    };

    const bootSaveResult = await _ProgFS.saveProject(name, projectData);
    if (!bootSaveResult?.success) {
      this.showNotification('❌ No se pudo iniciar el autoguardado');
      return;
    }
    setWorkspaceMode('project', null);
    updateProjectIndicator();
    markWorkspaceAsSaved();
    persistWorkspaceSnapshot();
    // ❌ No guardar lastProject — app abre limpia al iniciar
    // await _ProgFS.saveAppConfig('lth-prog', { lastProject: name });

    this.showNotification(`📌 Proyecto "${name}" creado para autoguardado`);
  }

  // toggle normal
  this.state.autoSave = next;
  autoSaveToggle.innerHTML = `
    <span class="menu-item-icon" aria-hidden="true">
      <svg viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.3"/>
        <path d="M8 4.7v3.5l2.2 1.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </span>
    <span>Autoguardado: ${this.state.autoSave ? 'ON' : 'OFF'}</span>
  `;

  if (this.state.autoSave) {
    this.startAutoSave();
    this.showNotification('✅ Autoguardado activado (cada 30s)');
  } else {
    this.stopAutoSave();
    this.showNotification('⏸️ Autoguardado desactivado');
  }
});


      // Sistema de autoguardado
      this.startAutoSave = () => {
        if (this._autoSaveInterval) clearInterval(this._autoSaveInterval);
        
        this._autoSaveInterval = setInterval(async () => {
         if (!this.state.autoSave || !this.state.currentProject || this._isLoadingProject) return;

          
          saveCurrentTabContent();
          // ✅ antes de guardar: asegura que el editor vuelca al archivo activo REAL
const a = (this.state.filesList || []).find(f => f.id === this.state.activeFileId);
if (a && this.editor?.getValue) a.content = this.editor.getValue();

const projectData = {
  name: this.state.currentProject,

  filesList: (this.state.filesList || []).map(f => ({
    id: f.id,
    name: f.name,
    type: f.type,
    path: f.path || null,
    content: f.content || ''
  })),
  activeFileId: this.state.activeFileId || null,
  hiddenFiles: this.state.hiddenFiles || [],

  files: {
    html: { ...this.state.files.html },
    css:  { ...this.state.files.css  },
    js:   { ...this.state.files.js   }
  },

  device: this.state.device,
  split: this.state.split,
  lastModified: new Date().toISOString()
};


          const result = await _ProgFS.saveProject(this.state.currentProject, projectData);
          
          if (result.success) {
            this.state.lastSaved = new Date().toISOString();
            markWorkspaceAsSaved();
            persistWorkspaceSnapshot();
            console.log('🔄 Autoguardado:', this.state.currentProject);
          }
        }, 30000); // 30 segundos
      };

      this.stopAutoSave = () => {
        if (this._autoSaveInterval) {
          clearInterval(this._autoSaveInterval);
          this._autoSaveInterval = null;
        }
      };

      // Inicializar indicador de proyecto
      updateProjectIndicator();
      this._beforeUnloadDraftHandler && window.removeEventListener('beforeunload', this._beforeUnloadDraftHandler);
      this._beforeUnloadDraftHandler = (event) => {
        try {
          flushActiveFilePersistence({ touchDraft: true, refreshChrome: true });
          persistSessionMeta();
        } catch {}
        if (!hasDirtyFiles()) return;
        event.preventDefault();
        event.returnValue = '';
        return '';
      };
      window.addEventListener('beforeunload', this._beforeUnloadDraftHandler);

      // =====================================================================
      // 🔴 MODO RUN FULLSCREEN — esconde todo, solo muestra el iframe
      // =====================================================================
      const runRoot = container.querySelector('.lth-prog-root');
      const runOverlay = container.querySelector('#lthRunOverlay');
      const runOverlayFrame = container.querySelector('#runOverlayFrame');
      const runOverlayClose = container.querySelector('#runOverlayClose');
      const hostWindow = container.closest('.wm-win');
      const previewEmptyState = container.querySelector('#previewEmptyState');
      let _runMode = false;
      let _runZoomFactor = null;
      let _runPreviewState = null;

      const ensureRunOverlayHost = () => {
        if (!runOverlay) return;
        if (runOverlay.parentNode !== document.body) {
          document.body.appendChild(trackGlobalNode(runOverlay));
        }
      };

      const setRunZoomMode = async (enabled) => {
        if (!window.electron?.window?.setZoomFactor) return;

        try {
          if (enabled) {
            if (_runZoomFactor == null && window.electron.window.getZoomFactor) {
              const currentZoom = await window.electron.window.getZoomFactor();
              if (currentZoom?.success) {
                const rawZoom = Number(currentZoom.zoomFactor);
                _runZoomFactor = Number.isFinite(rawZoom) ? rawZoom : 1;
              }
            }

            if (_runZoomFactor == null) _runZoomFactor = 1;
            if (Math.abs(_runZoomFactor - 1) > 0.001) {
              await window.electron.window.setZoomFactor(1);
            }
            return;
          }

          if (_runZoomFactor != null && Math.abs(_runZoomFactor - 1) > 0.001) {
            await window.electron.window.setZoomFactor(_runZoomFactor);
          }
        } catch (err) {
          console.warn('RUN zoom mode error:', err);
        } finally {
          if (!enabled) _runZoomFactor = null;
        }
      };
      const runEscapeBridge = `<script>(function(){document.addEventListener('keydown',function(e){if(e.key==='Escape'){try{window.parent.postMessage({type:'LTH_RUN_ESCAPE'},'*')}catch(_){}}},true);})();<\/script>`;
      const suspendLivePreviewForRun = () => {
        if (!liveFrame) return;

        const hasSrc = !!String(liveFrame.getAttribute('src') || '').trim();
        const hasSrcdoc = !!String(liveFrame.getAttribute('srcdoc') || '').trim();
        const previewVisible = !!(previewEmptyState?.classList.contains('hidden') && (hasSrc || hasSrcdoc));

        _runPreviewState = {
          shouldRestore: previewVisible || !!this.state.live
        };

        if (!previewVisible) return;

        try { liveFrame.removeAttribute('srcdoc'); } catch {}
        try { liveFrame.src = 'about:blank'; } catch {}
        try { previewEmptyState?.classList.remove('hidden'); } catch {}
      };
      const restoreLivePreviewAfterRun = () => {
        const shouldRestore = !!_runPreviewState?.shouldRestore;
        _runPreviewState = null;

        if (!shouldRestore) return;
        try {
          this.refreshLive(container, true);
        } catch (err) {
          console.warn('RUN preview restore error:', err);
        }
      };

      const enterRunMode = async () => {
        _runMode = true;
        ensureRunOverlayHost();
        suspendLivePreviewForRun();
        runRoot?.classList.add('run-fullscreen');
        hostWindow?.classList.add('lth-run-performance-mode');
        runOverlay?.classList.add('active');
        if (runOverlayFrame) {
          runOverlayFrame.removeAttribute('srcdoc');
          runOverlayFrame.src = 'about:blank';
        }
        await setRunZoomMode(true);
      };

      const exitRunMode = async () => {
        if (!_runMode && !runOverlay?.classList.contains('active')) return;
        _runMode = false;
        runRoot?.classList.remove('run-fullscreen');
        if (runOverlayFrame) {
          runOverlayFrame.removeAttribute('srcdoc');
          runOverlayFrame.src = 'about:blank';
        }
        await setRunZoomMode(false);
        hostWindow?.classList.remove('lth-run-performance-mode');
        runOverlay?.classList.remove('active');
        restoreLivePreviewAfterRun();
      };
      this._exitRunMode = exitRunMode;
      ensureRunOverlayHost();

      // Punto verde: en modo RUN sale, en modo normal toggle toolbar
      const toolsTrigger = container.querySelector('#toolsTrigger');
      toolsTrigger?.addEventListener('click', (e) => {
        if (_runMode) { e.stopPropagation(); void exitRunMode(); }
        // Si no está en run mode, la lógica de toggle ya está en initToolbarToggle
      });
      runOverlayClose?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        void exitRunMode();
      });
      if (this._runOverlayMessageHandler) {
        window.removeEventListener('message', this._runOverlayMessageHandler);
      }
      this._runOverlayMessageHandler = (event) => {
        const msg = event?.data || {};
        if (msg.type !== 'LTH_RUN_ESCAPE') return;
        if (runOverlayFrame?.contentWindow && event.source === runOverlayFrame.contentWindow) {
          void exitRunMode();
        }
      };
      window.addEventListener('message', this._runOverlayMessageHandler);

      // ESC también sale del modo RUN
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && _runMode) { e.preventDefault(); void exitRunMode(); }
      });

      runBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Sincronizar editor al archivo activo
        const activeFile = (this.state.filesList || []).find(f => f.id === this.state.activeFileId);
        if (activeFile && this.editor?.getValue) {
          activeFile.content = this.editor.getValue();
        }
        this._syncLegacyFiles && this._syncLegacyFiles();

        const fileType = activeFile?.type || this.state.editorTab || 'html';
        const code = activeFile?.content || this.editor?.getValue?.() || '';

        // ════════════════════════════════════════════════════════
        // 🟡 JAVASCRIPT — envolver en HTML con consola visual
        // ════════════════════════════════════════════════════════
        if (fileType === 'js') {
          if (!code.trim()) { this.showNotification('⚠️ No hay código JS para ejecutar'); return; }
          const jsRunner = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a14;color:#e0e0e0;font-family:'Cascadia Code','Fira Code',monospace;font-size:13px;padding:16px;overflow-y:auto}
.line{padding:3px 0;border-bottom:1px solid rgba(255,255,255,.03);white-space:pre-wrap;word-break:break-all}
.log{color:#a5d6ff}.warn{color:#fbbf24}.error{color:#f87171}.info{color:#34d399}
.header{color:rgba(255,255,255,.3);font-size:11px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,.08)}
.time{color:rgba(255,255,255,.2);font-size:10px;margin-right:8px}
.result{color:#c4b5fd;border-top:1px solid rgba(139,92,246,.2);margin-top:12px;padding-top:8px}
.err-stack{color:rgba(248,113,113,.6);font-size:11px;margin-top:4px}
</style></head><body>
<div class="header">▶ JavaScript Console — LTH PROG</div>
<div id="out"></div>
${runEscapeBridge}
<script>
const _out = document.getElementById('out');
const _t = () => new Date().toLocaleTimeString();
const _add = (cls, ...args) => {
  const d = document.createElement('div');
  d.className = 'line ' + cls;
  d.innerHTML = '<span class="time">' + _t() + '</span>' + args.map(a => {
    if (a === null) return '<i>null</i>';
    if (a === undefined) return '<i>undefined</i>';
    if (typeof a === 'object') try { return JSON.stringify(a, null, 2); } catch { return String(a); }
    return String(a);
  }).join(' ');
  _out.appendChild(d);
  window.scrollTo(0, document.body.scrollHeight);
  try { window.parent.postMessage({type:'console',level:cls,data:args.join(' ')},'*'); } catch{}
};
console.log = (...a) => _add('log', ...a);
console.warn = (...a) => _add('warn', ...a);
console.error = (...a) => _add('error', ...a);
console.info = (...a) => _add('info', ...a);
console.clear = () => { _out.innerHTML = ''; };
console.table = (data) => { console.log(JSON.stringify(data, null, 2)); };

// Capturar prompt/confirm/alert
window.alert = (msg) => _add('info', '📢 alert:', msg);

const _start = performance.now();
try {
  ${code.replace(/<\/script>/gi, '<\\/script>')}
} catch(_e) {
  _add('error', '❌ ' + _e.message);
  if (_e.stack) { const s = document.createElement('div'); s.className='err-stack'; s.textContent=_e.stack; _out.appendChild(s); }
}
const _elapsed = (performance.now() - _start).toFixed(1);
_add('result', '✅ Completado en ' + _elapsed + 'ms');
</script></body></html>`;

          await enterRunMode();
          if (runOverlayFrame) {
            runOverlayFrame.removeAttribute('src');
            runOverlayFrame.srcdoc = jsRunner;
          }
          return;
        }

        // ════════════════════════════════════════════════════════
        // 🐍 PYTHON — ejecutar via electron.execPython
        // ════════════════════════════════════════════════════════
        if (fileType === 'py') {
          if (!code.trim()) { this.showNotification('⚠️ No hay código Python para ejecutar'); return; }

          if (!window.electron?.py?.execPython) {
            this.showNotification('⚠️ Python no configurado — necesitás agregar py.execPython en preload.js');
            return;
          }

          // Ejecutar Python directamente desde el renderer
          this.showNotification('🐍 Ejecutando Python...');
          const startTime = performance.now();
          let result;
          try {
            result = await window.electron.py.execPython(code);
          } catch (err) {
            result = { success: false, stdout: '', stderr: String(err.message || err), code: 1 };
          }
          const elapsed = (performance.now() - startTime).toFixed(0);

          // Escapar HTML
          const esc = (s) => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

          // Construir output visual
          let outputLines = '';
          if (result.stdout) {
            result.stdout.split('\n').forEach(line => {
              if (line || line === '') outputLines += `<div class="line log">${esc(line)}</div>`;
            });
          }
          if (result.stderr) {
            result.stderr.split('\n').forEach(line => {
              if (line.trim()) outputLines += `<div class="line error">${esc(line)}</div>`;
            });
          }
          const statusClass = result.success ? 'result' : 'error';
          const statusIcon = result.success ? '✅' : '❌';
          outputLines += `<div class="line ${statusClass}">${statusIcon} ${result.success ? 'Completado' : 'Error'} en ${elapsed}ms</div>`;

          const pyOutput = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a14;color:#e0e0e0;font-family:'Cascadia Code','Fira Code',monospace;font-size:13px;padding:16px;overflow-y:auto}
.line{padding:3px 0;border-bottom:1px solid rgba(255,255,255,.03);white-space:pre-wrap;word-break:break-all}
.log{color:#34d399}.error{color:#f87171}
.header{color:rgba(255,255,255,.3);font-size:11px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,.08)}
.result{color:#c4b5fd;border-top:1px solid rgba(139,92,246,.2);margin-top:12px;padding-top:8px}
</style></head><body>
${runEscapeBridge}
<div class="header">🐍 Python Console — LTH PROG</div>
<div id="out">${outputLines}</div>
</body></html>`;

          await enterRunMode();
          if (runOverlayFrame) {
            runOverlayFrame.removeAttribute('src');
            runOverlayFrame.srcdoc = pyOutput;
          }
          return;
        }

        // ════════════════════════════════════════════════════════
        // 📄 HTML — comportamiento original
        // ════════════════════════════════════════════════════════
        let htmlContent = this.state.files?.html?.content || '';
        const cssContent = this.state.files?.css?.content  || '';
        const jsContent  = this.state.files?.js?.content   || '';

        // HTML elegido: si el activo es HTML, ese; si no, el primero del proyecto.
        let runHtmlFile = (activeFile && activeFile.type === 'html')
          ? activeFile
          : (this.state.filesList || []).find(f => f.type === 'html') || null;
        if (!htmlContent) {
          htmlContent = runHtmlFile?.content || '';
        } else if (runHtmlFile && runHtmlFile.content) {
          htmlContent = runHtmlFile.content;
        }

        if (!htmlContent) { this.showNotification('⚠️ No hay HTML para ejecutar'); return; }

        const hasInjectedPlaceholders = htmlContent.includes('id="injected-css"') || htmlContent.includes('id="injected-js"');
        if (hasInjectedPlaceholders) {
          htmlContent = htmlContent
            .replace('<style id="injected-css"></style>', `<style id="injected-css">${cssContent}</style>`)
            .replace('<script id="injected-js"></script>', `<script id="injected-js">${jsContent}</script>`);
        }
        if (!htmlContent.includes('LTH_RUN_ESCAPE')) {
          if (/<\/head>/i.test(htmlContent)) {
            htmlContent = htmlContent.replace(/<\/head>/i, `${runEscapeBridge}\n</head>`);
          } else {
            htmlContent = `${runEscapeBridge}\n${htmlContent}`;
          }
        }

        await enterRunMode();
        if (window.electron?.preview) {
          try {
            const runRelKeyFor = (f) => normalizeRelativePath(
              f.workspaceRelativePath || f.relativePath || f.name || ''
            ) || (f.name || '');

            // Escribir todos los archivos de texto por su ruta relativa real, para
            // que CSS/JS separados y subcarpetas resuelvan.
            const filesToWrite = {};
            for (const f of (this.state.filesList || [])) {
              if (!f || f.content == null) continue;
              const key = runRelKeyFor(f);
              if (key) filesToWrite[key] = f.content || '';
            }
            let runHtmlKey = runHtmlFile ? runRelKeyFor(runHtmlFile) : 'index.html';
            if (!runHtmlKey) runHtmlKey = 'index.html';
            filesToWrite[runHtmlKey] = htmlContent;
            if (!filesToWrite['index.html']) filesToWrite['index.html'] = htmlContent;

            // Servir imágenes/videos/assets desde la carpeta real en modo carpeta.
            if (window.electron.preview.setFallbackRoot) {
              const runFallback = (this.state.workspaceMode === 'folder' && this.state.folderPath)
                ? this.state.folderPath : null;
              try { await window.electron.preview.setFallbackRoot(runFallback); } catch {}
            }

            const result = await window.electron.preview.writeFiles(filesToWrite);
            if (result.success && runOverlayFrame) {
              const baseUrl = String(result.url || '').replace(/\/index\.html$/i, '');
              const loadPath = runHtmlKey.replace(/^\/+/, '');
              runOverlayFrame.removeAttribute('srcdoc');
              runOverlayFrame.src = `${baseUrl}/${loadPath}?t=${Date.now()}`;
            } else if (runOverlayFrame) {
              runOverlayFrame.removeAttribute('src');
              runOverlayFrame.srcdoc = htmlContent;
            }
          } catch (err) {
            console.error('RUN error:', err);
            if (runOverlayFrame) { runOverlayFrame.removeAttribute('src'); runOverlayFrame.srcdoc = htmlContent; }
          }
        } else {
          if (runOverlayFrame) { runOverlayFrame.removeAttribute('src'); runOverlayFrame.srcdoc = htmlContent; }
        }
      });

      const setDevice = (d) => {
        this.state.device = d;
        root.setAttribute('data-device', d);
        devicePcBtn?.classList.toggle('active', d === 'pc');
        devicePhoneBtn?.classList.toggle('active', d === 'phone');
      };
      devicePcBtn?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); setDevice('pc'); });
      devicePhoneBtn?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); setDevice('phone'); });

      // Evitar que clicks dentro del device-stage burbujeen y activen tabs de abajo
      const deviceStageEl = container.querySelector('#deviceStage');
      if (deviceStageEl) {
        deviceStageEl.addEventListener('click', (e) => { e.stopPropagation(); });
        deviceStageEl.addEventListener('mousedown', (e) => { e.stopPropagation(); });
        deviceStageEl.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
      }

      const setSplit = (on) => {
        this.state.split = !!on;
        root.classList.toggle('split-on', this.state.split);
        root.classList.toggle('split-off', !this.state.split);
        splitBtn?.classList.toggle('active', this.state.split);
      };
      splitBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setSplit(!this.state.split);
      });

      // 🌐 Abrir en navegador externo
      const openBrowserBtn = container.querySelector('#openBrowserBtn');
      openBrowserBtn?.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const htmlContent = this.state.files.html.content || '';
        const cssContent = this.state.files.css.content || '';
        const jsContent = this.state.files.js.content || '';

        // Inyectar CSS y JS en el HTML
        let fullHTML = htmlContent.replace(
          '<style id="injected-css"></style>',
          `<style id="injected-css">${cssContent}</style>`
        );
        fullHTML = fullHTML.replace(
          '<script id="injected-js"></script>',
          `<script id="injected-js">${jsContent}</script>`
        );

        if (window.electron?.preview) {
          const result = await window.electron.preview.writeFiles({
            'index.html': fullHTML,
            'styles.css': '',
            'app.js': ''
          });

          if (result.success) {
            // Abrir en navegador externo
            if (window.electronBrowser) {
              window.electronBrowser.show();
              window.electronBrowser.go(result.url);
            } else {
              window.open(result.url, '_blank');
            }
            this.showNotification('🌐 Abierto en navegador');
          }
        }
      });

      const setLive = (on) => {
        this.state.live = !!on;
        liveBtn?.classList.toggle('active', this.state.live);
        editorStatus.textContent = this.state.live ? 'Live ON' : 'Live OFF';
        if (this.state.live) this.refreshLive(container, true);
      };
      liveBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setLive(!this.state.live);
      });

      setDevice(this.state.device);
      setSplit(this.state.split);
      setLive(this.state.live);

      const bindShortcutsToTextarea = () => {
        codeEditor.addEventListener('keydown', (ev) => {
          const isMac = navigator.platform.toLowerCase().includes('mac');
          const ctrl = isMac ? ev.metaKey : ev.ctrlKey;
          if (!ctrl) return;
          if (ev.key.toLowerCase() === 's') { ev.preventDefault(); ev.stopPropagation(); guardarArchivo(); }
          if (ev.key.toLowerCase() === 'o') { ev.preventDefault(); ev.stopPropagation(); openFileBtn.click(); }
          if (ev.key.toLowerCase() === 'n') { ev.preventDefault(); ev.stopPropagation(); newFileBtn.click(); }
          if (ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); runBtn.click(); }
        });
      };

      // 🔍 SISTEMA DE BÚSQUEDA (Ctrl+F)
      const initSearchBox = () => {
        const self = this; // Guardar referencia a LthProgApp
        let searchBox = null;
        let searchQuery = '';
        let currentMatchIndex = 0;
        let matches = [];
        let searchMarks = [];
        let searchMode = '';
        const SEARCH_MAX_MATCHES = 10000;
        const SEARCH_MAX_MARKS = 500;

        const normalizeSearchChar = (ch) => {
          if (!ch) return '';
          if (ch === '\r' || ch === '\uFFFD') return '';

          const code = ch.charCodeAt(0);
          if ((code >= 0x200B && code <= 0x200F) || (code >= 0x202A && code <= 0x202E) || code === 0x2060 || code === 0xFEFF) {
            return '';
          }

          if (/\s/.test(ch)) return ' ';

          switch (ch) {
            case '\u2018':
            case '\u2019':
            case '\u201A':
            case '\u2032':
              return "'";
            case '\u201C':
            case '\u201D':
            case '\u201E':
            case '\u2033':
              return '"';
            case '\u2013':
            case '\u2014':
            case '\u2212':
              return '-';
            case '\u2026':
              return '...';
            default:
              return ch.toLowerCase();
          }
        };

        const buildFlexibleTextIndex = (text) => {
          const source = String(text ?? '');
          let normalized = '';
          const map = [];
          let prevWasSpace = false;

          for (let i = 0; i < source.length; i++) {
            const replacement = normalizeSearchChar(source[i]);
            if (!replacement) continue;

            for (const normalizedChar of replacement) {
              if (normalizedChar === ' ') {
                if (!normalized.length || prevWasSpace) continue;
                normalized += ' ';
                map.push(i);
                prevWasSpace = true;
                continue;
              }

              normalized += normalizedChar;
              map.push(i);
              prevWasSpace = false;
            }
          }

          return { text: normalized, map };
        };

        const normalizeFlexibleQuery = (text) => buildFlexibleTextIndex(text).text.trim();

        const renderSearchMarks = () => {
          clearMarks();
          const currentEditor = self.editor;
          if (!currentEditor) return;

          const maxMarks = Math.min(matches.length, SEARCH_MAX_MARKS);
          for (let idx = 0; idx < maxMarks; idx++) {
            try {
              const mark = currentEditor.markText(matches[idx].from, matches[idx].to, {
                className: idx === currentMatchIndex ? 'search-highlight-current' : 'search-highlight'
              });
              searchMarks.push(mark);
            } catch(e) {}
          }
        };

        const collectExactMatches = (fullText, query, currentEditor) => {
          const found = [];
          const searchLower = String(query || '').toLowerCase();
          const fullTextLower = String(fullText || '').toLowerCase();
          let startPos = 0;

          while (true) {
            const index = fullTextLower.indexOf(searchLower, startPos);
            if (index === -1) break;

            found.push({
              from: currentEditor.posFromIndex(index),
              to: currentEditor.posFromIndex(index + query.length)
            });

            startPos = index + 1;
            if (found.length > SEARCH_MAX_MATCHES) break;
          }

          return found;
        };

        const collectFlexibleMatches = (fullText, query, currentEditor) => {
          const normalizedQuery = normalizeFlexibleQuery(query);
          if (!normalizedQuery || normalizedQuery.length < 2) return [];

          const { text: normalizedSource, map } = buildFlexibleTextIndex(fullText);
          const found = [];
          let startPos = 0;

          while (true) {
            const index = normalizedSource.indexOf(normalizedQuery, startPos);
            if (index === -1) break;

            const startOriginal = map[index] ?? 0;
            const lastMappedIndex = index + normalizedQuery.length - 1;
            const endOriginal = Math.min(
              String(fullText || '').length,
              Math.max(startOriginal + 1, (map[lastMappedIndex] ?? startOriginal) + 1)
            );

            found.push({
              from: currentEditor.posFromIndex(startOriginal),
              to: currentEditor.posFromIndex(endOriginal)
            });

            startPos = index + 1;
            if (found.length > SEARCH_MAX_MATCHES) break;
          }

          return found;
        };
        
        const clearMarks = () => {
          searchMarks.forEach(mark => {
            try { mark.clear(); } catch(e) {}
          });
          searchMarks = [];
        };
        
        const highlightMatches = (query) => {
          matches = [];
          searchMode = '';
          
          if (!query || query.length < 2) return 0;
          
          const currentEditor = self.editor;
          if (!currentEditor || !currentEditor.getValue) {
            return 0;
          }
          
          try {
            const fullText = currentEditor.getValue();
            matches = collectExactMatches(fullText, query, currentEditor);
            searchMode = matches.length ? 'exact' : '';

            if (!matches.length) {
              matches = collectFlexibleMatches(fullText, query, currentEditor);
              if (matches.length) searchMode = 'smart';
            }

            renderSearchMarks();
          } catch(e) {
            console.error('Error en búsqueda:', e);
          }
          
          return matches.length;
        };
        
        const goToMatch = (direction) => {
          if (matches.length === 0) return;
          
          currentMatchIndex = direction === 'next' 
            ? (currentMatchIndex + 1) % matches.length
            : (currentMatchIndex - 1 + matches.length) % matches.length;
          
          const currentEditor = self.editor;
          if (!currentEditor) return;
          
          renderSearchMarks();
          
          const match = matches[currentMatchIndex];
          if (match && currentEditor) {
            // Scroll a la línea primero, luego al match — evita quedar perdido en líneas largas
            const lineStart = { line: match.from.line, ch: 0 };
            currentEditor.scrollIntoView(lineStart, 100);
            currentEditor.setSelection(match.from, match.to);
            // Scroll horizontal mínimo para ver el match
            if (currentEditor.scrollIntoView) currentEditor.scrollIntoView({ from: match.from, to: match.to }, 50);
            currentEditor.focus();
            updateSearchCounter();
          }
        };
        
        const updateSearchCounter = () => {
          if (!searchBox) return;
          const counter = searchBox.querySelector('.search-counter');
          if (counter) {
            if (matches.length > 0) {
              counter.textContent = `${currentMatchIndex + 1} / ${matches.length}${searchMode === 'smart' ? ' · Flex' : ''}`;
              counter.title = searchMode === 'smart'
                ? 'Busqueda flexible: ignora tabs, espacios raros, saltos de linea distintos y algunos caracteres Unicode invisibles.'
                : 'Busqueda exacta';
            } else {
              counter.textContent = 'Sin resultados';
              counter.title = 'No hubo coincidencias';
            }
          }
        };
        
        const showSearchBox = () => {
          // Verificar si ya existe en el DOM (no solo la variable)
          const existingBox = document.querySelector('.lth-search-box');
          if (existingBox) {
            const input = existingBox.querySelector('.search-input');
            input.focus();
            input.select();
            return;
          }
          
          // Agregar estilos CSS
          if (!document.querySelector('#search-styles')) {
            const styles = document.createElement('style');
            styles.id = 'search-styles';
            styles.textContent = `
              .search-highlight { 
                background-color: rgba(255,200,0,0.4) !important;
                border-bottom: 2px solid rgba(255,200,0,0.8);
              }
              .search-highlight-current { 
                background-color: rgba(255,120,0,0.7) !important;
                border-bottom: 2px solid rgba(255,120,0,1);
                box-shadow: 0 0 8px rgba(255,120,0,0.6);
              }
              .inspector-found-line {
                background-color: rgba(34,211,238,0.25) !important;
                animation: inspectorPulse 2.5s ease;
              }
              @keyframes inspectorPulse {
                0%, 100% { background-color: rgba(34,211,238,0.25); }
                50% { background-color: rgba(34,211,238,0.45); }
              }
              .inspector-found-text {
                background-color: rgba(34,211,238,0.35) !important;
                border-radius: 3px;
                box-shadow: 0 0 8px rgba(34,211,238,0.5);
                animation: inspectorTextPulse 3s ease;
              }
              @keyframes inspectorTextPulse {
                0%, 100% { background-color: rgba(34,211,238,0.35); }
                50% { background-color: rgba(34,211,238,0.6); }
              }
            `;
            document.head.appendChild(styles);
          }
          
          searchBox = document.createElement('div');
          searchBox.className = 'lth-search-box'; // Agregar clase para identificarlo
          searchBox.style.cssText = 'position:fixed;top:140px;right:40px;z-index:99999;background:linear-gradient(135deg,#1a1a24,#0f0f14);border:2px solid rgba(100,150,255,0.4);border-radius:14px;padding:12px 16px;box-shadow:0 10px 40px rgba(0,0,0,0.8),0 0 30px rgba(100,150,255,0.2);display:flex;align-items:center;gap:10px;min-width:360px';
          
          searchBox.innerHTML = `
            <span style="font-size:16px">🔍</span>
            <textarea class="search-input" placeholder="Buscar código (soporta multilínea)..." style="flex:1;padding:8px 12px;border:2px solid rgba(100,150,255,0.3);border-radius:8px;background:rgba(0,0,0,0.4);color:#fff;font-size:13px;outline:none;font-family:monospace;resize:vertical;min-height:36px;max-height:200px">${searchQuery}</textarea>
            <span class="search-counter" style="color:rgba(255,255,255,0.6);font-size:12px;min-width:90px;text-align:center;font-weight:600">0 / 0</span>
            <button class="search-prev" style="width:34px;height:34px;border:2px solid rgba(100,150,255,0.3);background:rgba(100,150,255,0.15);color:#fff;border-radius:8px;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;transition:all 0.2s" title="Anterior (Shift+Enter)">↑</button>
            <button class="search-next" style="width:34px;height:34px;border:2px solid rgba(100,150,255,0.3);background:rgba(100,150,255,0.15);color:#fff;border-radius:8px;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;transition:all 0.2s" title="Siguiente (Ctrl+Enter)">↓</button>
            <button class="search-close" style="width:34px;height:34px;border:2px solid rgba(255,100,100,0.3);background:rgba(255,100,100,0.15);color:#ff6b6b;border-radius:8px;cursor:pointer;font-size:20px;font-weight:700;display:flex;align-items:center;justify-content:center;transition:all 0.2s" title="Cerrar (Esc)">×</button>
          `;
          
          document.body.appendChild(searchBox);
          
          const input = searchBox.querySelector('.search-input');
          const prevBtn = searchBox.querySelector('.search-prev');
          const nextBtn = searchBox.querySelector('.search-next');
          const closeBtn = searchBox.querySelector('.search-close');
          
          // Buscar mientras escribe (con debounce para archivos grandes)
          let _searchTimer = null;
          input.oninput = (e) => {
            searchQuery = e.target.value;
            currentMatchIndex = 0;
            clearTimeout(_searchTimer);
            // Si < 2 chars, limpiar inmediatamente
            if (!searchQuery || searchQuery.length < 2) {
              clearMarks(); matches = []; searchMode = '';
              updateSearchCounter();
              return;
            }
            _searchTimer = setTimeout(() => {
              const count = highlightMatches(searchQuery);
              updateSearchCounter();
              if (count > 0 && matches[0]) {
                const currentEditor = self.editor;
                if (currentEditor) {
                  currentEditor.scrollIntoView({ line: matches[0].from.line, ch: 0 }, 100);
                  currentEditor.scrollIntoView({ from: matches[0].from, to: matches[0].to }, 50);
                }
              }
            }, 200);
          };
          
          input.onkeydown = (e) => {
            // Ctrl+Enter o Cmd+Enter para siguiente resultado
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              if (matches.length > 0) {
                goToMatch(e.shiftKey ? 'prev' : 'next');
              }
            } 
            // Escape para cerrar
            else if (e.key === 'Escape') {
              closeSearchBox();
            }
            // Enter solo hace salto de línea (comportamiento normal de textarea)
          };
          
          prevBtn.onclick = () => {
            if (matches.length > 0) goToMatch('prev');
          };
          
          nextBtn.onclick = () => {
            if (matches.length > 0) goToMatch('next');
          };
          
          prevBtn.onmouseenter = () => { prevBtn.style.background = 'rgba(100,150,255,0.3)'; };
          prevBtn.onmouseleave = () => { prevBtn.style.background = 'rgba(100,150,255,0.15)'; };
          nextBtn.onmouseenter = () => { nextBtn.style.background = 'rgba(100,150,255,0.3)'; };
          nextBtn.onmouseleave = () => { nextBtn.style.background = 'rgba(100,150,255,0.15)'; };
          closeBtn.onmouseenter = () => { closeBtn.style.background = 'rgba(255,100,100,0.25)'; };
          closeBtn.onmouseleave = () => { closeBtn.style.background = 'rgba(255,100,100,0.15)'; };
          
          closeBtn.onclick = () => closeSearchBox();
          
          input.focus();
          
          // Si ya había una búsqueda, restaurarla
          if (searchQuery) {
            highlightMatches(searchQuery);
            updateSearchCounter();
          }
        };
        
        const closeSearchBox = () => {
          const existingBox = document.querySelector('.lth-search-box');
          if (existingBox) {
            existingBox.remove();
          }
          searchBox = null;
          clearMarks();
          matches = [];
          currentMatchIndex = 0;
          searchMode = '';
        };
        
        return { showSearchBox, closeSearchBox };
      };
      
      const search = initSearchBox();

      // 🎯 INSPECTOR MODE (Ctrl+E)
      const initInspectorMode = () => {
        const self = this;
        let inspectorActive = false;
        let overlayDiv = null;
        let tooltipDiv = null;
        
        const toggleInspector = () => {
          inspectorActive = !inspectorActive;
          const inspectorBtn = container.querySelector('#inspectorBtn');
          
          if (inspectorActive) {
            inspectorBtn?.classList.add('active');
            self._inspectorActive = true; // Marcar para inyección
            // Refrescar preview para inyectar código
            self.refreshLive(container, true);
            // Agregar listener para mensajes del iframe
            window.addEventListener('message', handleInspectorMessage);
            console.log('🎯 Inspector Mode ACTIVADO');
          } else {
            inspectorBtn?.classList.remove('active');
            self._inspectorActive = false;
            // Refrescar para quitar código del inspector
            self.refreshLive(container, true);
            window.removeEventListener('message', handleInspectorMessage);
            console.log('🎯 Inspector Mode DESACTIVADO');
          }
        };
        
        const handleInspectorMessage = (event) => {
          if (event.data.type === 'INSPECTOR_CLICK') {
            const { searchTerm, element, textContent } = event.data;
            console.log('🔍 Click en:', element);
            console.log('📝 Texto:', textContent);
            
            const currentEditor = self.editor;
            if (!currentEditor) return;
            
            const fullText = currentEditor.getValue();
            let index = -1;
            let searchPattern = '';
            
            // Intentar diferentes patrones de búsqueda
            const patterns = [];
            
            // 0. PRIMERO: Si tiene texto, buscar por el texto (MÁS ESPECÍFICO)
            if (textContent && textContent.trim().length > 3) {
              patterns.push(textContent.trim());
            }
            
            // 1. Si tiene ID, buscar por ID
            if (element.id) {
              patterns.push(`id="${element.id}"`);
              patterns.push(`id='${element.id}'`);
            }
            
            // 2. Si tiene clase, buscar por la primera clase
            if (element.className) {
              const firstClass = element.className.split(' ')[0];
              patterns.push(`class="${firstClass}"`);
              patterns.push(`class='${firstClass}'`);
            }
            
            // 3. Buscar el patrón original (tag completo)
            patterns.push(searchTerm);
            
            // 4. Solo el tag
            patterns.push(`<${element.tagName}`);
            
            console.log('🔍 Intentando patrones:', patterns);
            
            // Intentar cada patrón hasta encontrar uno
            for (const pattern of patterns) {
              index = fullText.indexOf(pattern);
              if (index !== -1) {
                searchPattern = pattern;
                console.log(`✅ Encontrado con patrón: "${pattern}"`);
                break;
              }
            }
            
            if (index !== -1) {
              const fromPos = currentEditor.posFromIndex(index);
              const toPos = currentEditor.posFromIndex(index + searchPattern.length);
              
              console.log(`✅ Encontrado desde línea ${fromPos.line + 1}, col ${fromPos.ch} hasta línea ${toPos.line + 1}, col ${toPos.ch}`);
              
              // Scroll al texto
              currentEditor.scrollIntoView(fromPos, 100);
              currentEditor.setCursor(fromPos);
              currentEditor.focus();
              
              // Highlight el texto específico con CSS fuerte
              const mark = currentEditor.markText(fromPos, toPos, {
                css: 'background-color: rgba(34,211,238,0.45) !important; border-radius: 3px; box-shadow: 0 0 8px rgba(34,211,238,0.6); animation: inspectorTextPulse 3s ease;',
                clearOnEnter: false
              });
              
              // Remover el highlight después de 3 segundos
              setTimeout(() => {
                try {
                  mark.clear();
                } catch(e) {}
              }, 3000);
            } else {
              console.warn('⚠️ No se encontró ningún patrón en el código');
              console.log('Elemento:', element);
              console.log('Texto:', textContent);
            }
          }
        };
        
        return { toggleInspector };
      };
      
      const inspector = initInspectorMode();
      
      // Agregar event listener al botón de inspector
      const inspectorBtn = container.querySelector('#inspectorBtn');
      inspectorBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        inspector.toggleInspector();
      });





       // COMANDOS CON Ctrl
      const _keyMap = {
          'Ctrl-Z': (cm) => { cm.undo?.(); return true; },
          'Cmd-Z': (cm) => { cm.undo?.(); return true; },
          'Ctrl-Y': (cm) => { cm.redo?.(); return true; },
          'Cmd-Y': (cm) => { cm.redo?.(); return true; },
          'Ctrl-Shift-Z': (cm) => { cm.redo?.(); return true; },
          'Shift-Cmd-Z': (cm) => { cm.redo?.(); return true; },
          'Ctrl-E': () => { inspector.toggleInspector(); return true; },
          'Cmd-E': () => { inspector.toggleInspector(); return true; },
          'Ctrl-F': () => { search.showSearchBox(); return true; },
          'Cmd-F': () => { search.showSearchBox(); return true; },
          'Ctrl-S': () => { guardarArchivo(); return true; },
          'Ctrl-Shift-S': () => { guardarArchivoComo(); return true; },
          'Ctrl-O': () => { openFileBtn.click(); return true; },
          'Ctrl-N': () => { newFileBtn.click(); return true; },
          'Ctrl-Enter': () => { runBtn.click(); return true; },
          'Cmd-S': () => { guardarArchivo(); return true; },
          'Cmd-Shift-S': () => { guardarArchivoComo(); return true; },
          'Cmd-O': () => { openFileBtn.click(); return true; },
          'Cmd-N': () => { newFileBtn.click(); return true; },
          'Cmd-Enter': () => { runBtn.click(); return true; }
      };
      bindShortcutsToTextarea();
      if (this.editor?.addKeyMap) this.editor.addKeyMap(_keyMap);
      (this._editorReady || Promise.resolve()).then(() => {
        if (this.editor?.addKeyMap && !this.editor._isStub) this.editor.addKeyMap(_keyMap);
      });



      this._assembleHTML = assembleHTML;
      setTimeout(() => this.editor.focus && this.editor.focus(), 60);

      // =====================================================================
      // 🖱️ MENÚ CONTEXTUAL DEL EDITOR (clic derecho)
      // =====================================================================
      let _ctxEditorMenu = null;
      const closeEditorCtx = () => { _ctxEditorMenu?.remove(); _ctxEditorMenu = null; };
      document.addEventListener('click', closeEditorCtx);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeEditorCtx(); });

      const showEditorContextMenu = async (x, y) => {
        closeEditorCtx();

        // Detectar si hay selección en el editor
        let hasSelection = false;
        let selectedText = '';
        if (this.editor?.getSelection) {
          selectedText = this.editor.getSelection() || '';
          hasSelection = selectedText.length > 0;
        } else {
          selectedText = window.getSelection()?.toString() || '';
          hasSelection = selectedText.length > 0;
        }

        // Detectar modo de guardado inteligente
        const inFolderMode = this.state.workspaceMode === 'folder';
        const activeFile = (this.state.filesList || []).find(f => f.id === this.state.activeFileId);
        const saveLabel = inFolderMode
          ? `💾 Guardar en carpeta`
          : (this.state.currentProject ? `💾 Guardar proyecto` : `💾 Guardar`);

        const menu = document.createElement('div');
        menu.className = 'lth-editor-ctx-menu';
        menu.style.left = `${Math.min(x, window.innerWidth - 210)}px`;
        menu.style.top = `${Math.min(y, window.innerHeight - 200)}px`;

        menu.innerHTML = `
          <div class="lth-ctx-item ${!hasSelection ? 'lth-ctx-disabled' : ''}" data-action="cut">
            ✂️ Cortar <span class="lth-ctx-kbd">Ctrl+X</span>
          </div>
          <div class="lth-ctx-item ${!hasSelection ? 'lth-ctx-disabled' : ''}" data-action="copy">
            📋 Copiar <span class="lth-ctx-kbd">Ctrl+C</span>
          </div>
          <div class="lth-ctx-item" data-action="paste">
            📌 Pegar <span class="lth-ctx-kbd">Ctrl+V</span>
          </div>
          <div class="lth-ctx-sep"></div>
          <div class="lth-ctx-item" data-action="select-all">
            🔲 Seleccionar todo <span class="lth-ctx-kbd">Ctrl+A</span>
          </div>
          <div class="lth-ctx-sep"></div>
          <div class="lth-ctx-item lth-ctx-save" data-action="save">
            ${saveLabel}  <span class="lth-ctx-kbd">Ctrl+S</span>
          </div>
        `;

        document.body.appendChild(menu);
        _ctxEditorMenu = menu;

        menu.addEventListener('click', async (e) => {
          const action = e.target.closest('[data-action]')?.dataset.action;
          if (!action) return;
          closeEditorCtx();

          if (action === 'cut') {
            if (this.editor?.getSelection && this.editor.getSelection()) {
              navigator.clipboard?.writeText(this.editor.getSelection());
              this.editor.replaceSelection('');
            } else { document.execCommand('cut'); }
          }
          if (action === 'copy') {
            if (this.editor?.getSelection && this.editor.getSelection()) {
              navigator.clipboard?.writeText(this.editor.getSelection());
            } else { document.execCommand('copy'); }
          }
          if (action === 'paste') {
            try {
              const text = await navigator.clipboard.readText();
              if (this.editor?.replaceSelection) this.editor.replaceSelection(text);
              else document.execCommand('paste');
            } catch(e) { document.execCommand('paste'); }
          }
          if (action === 'select-all') {
            if (this.editor?.execCommand) this.editor.execCommand('selectAll');
            else document.execCommand('selectAll');
          }
          if (action === 'save') {
            guardarArchivo();
          }
        });
      };

      // Escuchar contextmenu en el área del editor (CodeMirror o textarea)
      const editorEl = container.querySelector('.CodeMirror') || codeEditor;
      editorEl?.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showEditorContextMenu(e.clientX, e.clientY);
      });
      // También capturar en el wrapper por si CodeMirror está encima
      const editorPane = container.querySelector('.editor-pane');
      editorPane?.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showEditorContextMenu(e.clientX, e.clientY);
      });
    },

    initPreviewControls(container) {
      const previewContainer = container.querySelector('.preview-container');
      const previewFrame = container.querySelector('#previewFrame');
      const previewWrapper = container.querySelector('.preview-frame-wrapper');
      const modeButtons = container.querySelectorAll('.preview-mode-btn');
      const widthInput = container.querySelector('#previewWidth');
      const heightInput = container.querySelector('#previewHeight');
      const presetButtons = container.querySelectorAll('.dimension-preset');

      // Cambiar modo (desktop/tablet/phone)
      modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const mode = btn.dataset.mode;
          modeButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          previewContainer.setAttribute('data-mode', mode);

          // Actualizar dimensiones según el modo
          if (mode === 'desktop') {
            widthInput.value = 1920;
            heightInput.value = 1080;
          } else if (mode === 'tablet') {
            widthInput.value = 768;
            heightInput.value = 1024;
          } else if (mode === 'phone') {
            widthInput.value = 375;
            heightInput.value = 667;
          }
        });
      });

      // Cambiar dimensiones personalizadas
      const updateDimensions = () => {
        const w = parseInt(widthInput.value) || 1920;
        const h = parseInt(heightInput.value) || 1080;
        if (previewWrapper) {
          previewWrapper.style.width = w + 'px';
          previewWrapper.style.height = h + 'px';
        }
      };

      widthInput?.addEventListener('change', updateDimensions);
      heightInput?.addEventListener('change', updateDimensions);

      // Presets
      presetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const [w, h] = btn.dataset.size.split('x');
          widthInput.value = w;
          heightInput.value = h;
          updateDimensions();
        });
      });
    },

    initTabs(container) {
      const tabs = Array.from(container.querySelectorAll('.lth-prog-tab'));
      const panels = Array.from(container.querySelectorAll('.lth-prog-panel'));
      tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const target = tab.dataset.tab;
          if (target !== this.state.currentTab && this._flushEditorPersistence) {
            this._flushEditorPersistence({ touchDraft: true, refreshChrome: true });
          }
          tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          panels.forEach(p => p.classList.remove('active'));
          const panel = container.querySelector(`[data-panel="${target}"]`);
          panel?.classList.add('active');
          this.state.currentTab = target;
          if (target === 'editor' && this._openFileById && this.state.activeFileId) {
            this._openFileById(this.state.activeFileId, { skipCapture: true, restoreView: true, queueLive: false, focus: false });
          }
        });
      });
    },

    applyUILayout(container) {
      const root = container.querySelector('.lth-prog-root');
      if (!root) return;
      root.classList.add('compact');
      root.classList.toggle('split-on', !!this.state.split);
      root.classList.toggle('split-off', !this.state.split);
      root.setAttribute('data-device', this.state.device || 'pc');
    },
    initTopDrawer(container){
  const root = container.querySelector('.lth-prog-root');
  if (!root) return;

  // Activa el modo drawer
  root.classList.add('top-drawer');

  // Evita duplicados si se re-renderiza
  if (root.querySelector('.lth-prog-top-hit')) return;

  // Crea franja clickeable arriba
  const hit = document.createElement('div');
  hit.className = 'lth-prog-top-hit';
  hit.title = 'Click para mostrar barra superior';
  root.appendChild(hit);

  const open = () => root.classList.add('top-open');
  const close = () => root.classList.remove('top-open');
  const toggle = () => root.classList.toggle('top-open');

  // Click en la franja → abre
  hit.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    open();
  });

  // Click en las barras (tabs o toolbar) también alterna (por si quieres)
  const tabs = root.querySelector('.lth-prog-tabs');
  const toolbar = root.querySelector('.editor-toolbar');
  [tabs, toolbar].forEach(el => {
    if (!el) return;
    el.addEventListener('dblclick', (e) => { // doble click para cerrar rápido
      e.preventDefault();
      e.stopPropagation();
      close();
    });
  });

  // Click fuera → cierra
  const outside = (ev) => {
    if (!root.classList.contains('top-open')) return;
    const insideBars =
      root.querySelector('.lth-prog-tabs')?.contains(ev.target) ||
      root.querySelector('.editor-toolbar')?.contains(ev.target);

    if (!insideBars) close();
  };

  // ESC → cierra
  const esc = (ev) => {
    if (ev.key === 'Escape') close();
  };

  window.addEventListener('mousedown', outside);
  window.addEventListener('keydown', esc);

  // Limpieza en onClose (si quieres fino)
  this._topDrawerCleanup = () => {
    window.removeEventListener('mousedown', outside);
    window.removeEventListener('keydown', esc);
  };
},

// 🟢 NUEVO MÉTODO - Sistema de punto verde para toolbar
initToolbarToggle(container) {
  const trigger = container.querySelector('#toolsTrigger');
  const toolbar = container.querySelector('#editorToolbar');
  let isVisible = false;

  if (!trigger || !toolbar) return;

  // Ocultar toolbar inicialmente
  toolbar.classList.add('toolbar-hidden');

  trigger.addEventListener('click', (e) => {
    // Si estamos en modo RUN, el click lo maneja el handler de RUN (exitRunMode)
    const root = container.querySelector('.lth-prog-root');
    if (root?.classList.contains('run-fullscreen')) return;

    e.stopPropagation();
    isVisible = !isVisible;
    
    if (isVisible) {
      toolbar.classList.remove('toolbar-hidden');
      toolbar.classList.add('tools-active');
      trigger.classList.add('active');
    } else {
      toolbar.classList.add('toolbar-hidden');
      toolbar.classList.remove('tools-active');
      trigger.classList.remove('active');
    }
  });

  // Cerrar toolbar al hacer click fuera
  const _toolbarOutsideClick = (e) => {
    const root = container.querySelector('.lth-prog-root');
    if (root?.classList.contains('run-fullscreen')) return;
    // Si el click fue dentro del toolbar o sus hijos, NO cerrar
    if (e.target.closest && e.target.closest('#editorToolbar')) return;
    if (isVisible && !toolbar.contains(e.target) && e.target !== trigger) {
      isVisible = false;
      toolbar.classList.add('toolbar-hidden');
      toolbar.classList.remove('tools-active');
      trigger.classList.remove('active');
    }
  };
  this._toolbarOutsideClick = _toolbarOutsideClick;
  document.addEventListener('click', _toolbarOutsideClick);

  // Atajo de teclado: Ctrl+T para toggle
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 't') {
      e.preventDefault();
      trigger.click();
    }
  });
},

    // =====================================================================
    // ⚙️ PANEL DE CONFIGURACIÓN
    // =====================================================================
    async initSettings(container) {
      const overlay   = container.querySelector('#lthSettingsOverlay');
      const panel     = container.querySelector('#lthSettingsPanel');
      const closeBtn  = container.querySelector('#lthSettingsClose');
      const nav       = container.querySelector('#lthSettingsNav');
      const content   = container.querySelector('#lthSettingsContent');
      const settingsBtn = container.querySelector('#settingsBtn');
      if (!overlay || !content) return;

      // Config en memoria
      let cfg = {};

      // Cargar config guardada
      const loadCfg = async () => {
        try {
          const r = await _ProgFS.loadAppConfig('lth-prog-settings');
          if (r?.success && r.config) cfg = { ...cfg, ...r.config };
        } catch(e) {}
      };
      const saveCfg = async () => {
        try {
          await _ProgFS.saveAppConfig('lth-prog-settings', cfg);
        } catch(e) {}
      };

      await loadCfg();
      cfg.theme = cfg.theme || 'lth-vscode';

      // Cargar rutas del sistema
      let sysPaths = {};
      try {
        const r = await _ProgFS.getPaths();
        if (r?.success) sysPaths = r.paths || {};
      } catch(e) {}

      // ---- Renderizar tab ----
      let activeTab = 'rutas';

      const tabs = {
        rutas: () => `
          <div class="lth-cfg-section">
            <div class="lth-cfg-section-title">📂 Rutas del Sistema</div>
            <div class="lth-cfg-info-card">
              Estas rutas son donde LTH PROG guarda tus proyectos y configuración.<br>
              <strong>Si cambias de PC</strong>, usa la sección Portabilidad para exportar/importar.
            </div>
            <div class="lth-cfg-path-row">
              <label>📁 Carpeta de Proyectos <span class="lth-cfg-desc">Donde se guardan los proyectos internos</span></label>
              <div class="lth-cfg-path-display">
                <span id="pathProjects">${sysPaths.projects || 'Cargando...'}</span>
                <button id="btnOpenProjects">📂 Abrir</button>
              </div>
            </div>
            <div class="lth-cfg-path-row">
              <label>🗄️ Carpeta de Datos <span class="lth-cfg-desc">Configuración del sistema LTH OS</span></label>
              <div class="lth-cfg-path-display">
                <span id="pathData">${sysPaths.data || 'Cargando...'}</span>
                <button id="btnOpenData">📂 Abrir</button>
              </div>
            </div>
            <div class="lth-cfg-path-row">
              <label>📤 Carpeta de Exportación <span class="lth-cfg-desc">Donde se guardan los proyectos exportados</span></label>
              <div class="lth-cfg-path-display">
                <span id="pathExport">${cfg.exportPath || localStorage.getItem('lth-export-path') || 'No configurada'}</span>
                <button id="btnChangeExport">✏️ Cambiar</button>
              </div>
            </div>
          </div>`,

        editor: () => `
          <div class="lth-cfg-section">
            <div class="lth-cfg-section-title">✏️ Preferencias del Editor</div>
            <div class="lth-cfg-row">
              <label>Tamaño de fuente <span class="lth-cfg-desc">Tamaño en píxeles del texto en el editor</span></label>
              <select class="lth-cfg-select" id="cfgFontSize">
                ${[11,12,13,14,15,16,18].map(s=>`<option value="${s}" ${(cfg.fontSize||13)==s?'selected':''}>${s}px</option>`).join('')}
              </select>
            </div>
            <div class="lth-cfg-row">
              <label>Tema del editor <span class="lth-cfg-desc">Esquema de colores</span></label>
              <select class="lth-cfg-select" id="cfgTheme">
                <option value="lth-vscode" ${(cfg.theme||'lth-vscode')==='lth-vscode'?'selected':''}>Visual Studio Dark+</option>
              </select>
            </div>
            <div class="lth-cfg-row">
              <label>Indentación <span class="lth-cfg-desc">Espacios por tab</span></label>
              <select class="lth-cfg-select" id="cfgIndent">
                ${[2,4].map(n=>`<option value="${n}" ${(cfg.indent||2)==n?'selected':''}>${n} espacios</option>`).join('')}
              </select>
            </div>
            <div class="lth-cfg-row">
              <label>Números de línea <span class="lth-cfg-desc">Mostrar numeración en el editor</span></label>
              <label class="lth-cfg-toggle"><input type="checkbox" id="cfgLineNums" ${cfg.lineNums!==false?'checked':''}><span class="lth-cfg-toggle-slider"></span></label>
            </div>
            <div class="lth-cfg-row">
              <label>Autocompletar <span class="lth-cfg-desc">Sugerencias mientras escribes</span></label>
              <label class="lth-cfg-toggle"><input type="checkbox" id="cfgAutocomplete" ${cfg.autocomplete!==false?'checked':''}><span class="lth-cfg-toggle-slider"></span></label>
            </div>
            <div class="lth-cfg-row">
              <label>Resaltar línea activa</label>
              <label class="lth-cfg-toggle"><input type="checkbox" id="cfgHighlightLine" ${cfg.highlightLine!==false?'checked':''}><span class="lth-cfg-toggle-slider"></span></label>
            </div>
            <button class="lth-cfg-btn lth-cfg-btn-blue" id="btnApplyEditor">✅ Aplicar cambios</button>
          </div>`,

        preview: () => `
          <div class="lth-cfg-section">
            <div class="lth-cfg-section-title">👁️ Preview en Vivo</div>
            <div class="lth-cfg-row">
              <label>Live Preview al abrir <span class="lth-cfg-desc">Activar automáticamente al abrir un proyecto</span></label>
              <label class="lth-cfg-toggle"><input type="checkbox" id="cfgAutoLive" ${cfg.autoLive?'checked':''}><span class="lth-cfg-toggle-slider"></span></label>
            </div>
            <div class="lth-cfg-row">
              <label>Delay del Live (ms) <span class="lth-cfg-desc">Tiempo de espera antes de actualizar preview</span></label>
              <select class="lth-cfg-select" id="cfgLiveDelay">
                ${[300,500,800,1000,1500].map(n=>`<option value="${n}" ${(cfg.liveDelay||500)==n?'selected':''}>${n}ms</option>`).join('')}
              </select>
            </div>
            <div class="lth-cfg-row">
              <label>Modo RUN por defecto <span class="lth-cfg-desc">Qué hace el botón RUN</span></label>
              <select class="lth-cfg-select" id="cfgRunMode">
                <option value="fullscreen" ${(cfg.runMode||'fullscreen')==='fullscreen'?'selected':''}>Pantalla completa</option>
                <option value="split" ${cfg.runMode==='split'?'selected':''}>Split view</option>
              </select>
            </div>
            <button class="lth-cfg-btn lth-cfg-btn-blue" id="btnApplyPreview">✅ Guardar</button>
          </div>`,

        portabilidad: () => {
          const folderPath = this.state?.folderPath || '';
          const htmlFile   = (this.state.filesList || []).find(f => f.type === 'html');
          const guessedName = htmlFile?.content?.match(/<title>([^<]+)<\/title>/)?.[1]
                           || htmlFile?.name?.replace(/\.[^.]+$/,'')
                           || 'mi-proyecto';
          return `
          <div class="lth-cfg-section">
            <div class="lth-cfg-section-title">🚀 Publicar como App en LTH OS</div>
            <div class="lth-cfg-info-card">
              Crea un ícono en el <strong>Home Screen</strong> de LTH OS que abre tu proyecto<br>
              usando el mismo servidor HTTP del preview — <strong>Supabase y APIs funcionan perfectamente.</strong><br>
              <span style="color:#5efc8d">✅ Es exactamente como el preview en vivo pero como app instalada.</span>
            </div>

            <div class="lth-cfg-path-row">
              <label>Nombre de la App</label>
              <input id="cfgAppName" type="text"
                style="background:rgba(0,0,0,.3);border:1px solid rgba(0,180,255,.2);border-radius:9px;color:#e2e8f0;font-size:13px;padding:8px 12px;outline:none;width:100%"
                value="${guessedName}">
            </div>

            <div style="display:flex;gap:12px">
              <div style="flex:0 0 auto">
                <label style="font-size:12px;color:rgba(255,255,255,.6);display:block;margin-bottom:6px">Ícono</label>
                <input id="cfgAppIcon" type="text" maxlength="4" value="🖥️"
                  style="background:rgba(0,0,0,.3);border:1px solid rgba(0,180,255,.2);border-radius:9px;color:#e2e8f0;font-size:22px;padding:6px;width:60px;text-align:center;outline:none">
              </div>
              <div style="flex:1">
                <label style="font-size:12px;color:rgba(255,255,255,.6);display:block;margin-bottom:6px">Color</label>
                <select class="lth-cfg-select" id="cfgAppGradient" style="width:100%">
                  <option value="linear-gradient(135deg,#667eea,#764ba2)">Morado</option>
                  <option value="linear-gradient(135deg,#00b4ff,#0062cc)">Azul</option>
                  <option value="linear-gradient(135deg,#00d4a1,#0096c7)">Verde Mar</option>
                  <option value="linear-gradient(135deg,#ff6b6b,#ee0979)">Rojo Rosa</option>
                  <option value="linear-gradient(135deg,#f7971e,#ffd200)">Naranja</option>
                  <option value="linear-gradient(135deg,#11998e,#38ef7d)">Verde</option>
                  <option value="linear-gradient(135deg,#1a1a2e,#16213e)">Oscuro</option>
                </select>
              </div>
            </div>

            ${folderPath ? `
            <div class="lth-cfg-info-card" style="border-color:rgba(94,252,141,.25)">
              <strong style="color:#5efc8d">📂 Carpeta detectada:</strong><br>
              <span style="font-family:monospace;font-size:11px;color:#7dd3fc">${folderPath}</span>
            </div>` : `
            <div class="lth-cfg-info-card" style="border-color:rgba(255,179,71,.25)">
              <strong style="color:#ffb347">⚠️ No hay carpeta abierta</strong><br>
              Usa el botón <strong>📂 Abrir Carpeta</strong> en el editor para abrir tu proyecto primero.
            </div>`}

            <button class="lth-cfg-btn" id="btnPublishApp"
              style="background:${folderPath?'rgba(0,180,255,.15)':'rgba(255,255,255,.05)'};border-color:${folderPath?'rgba(0,180,255,.4)':'rgba(255,255,255,.1)'};color:${folderPath?'#7dd3fc':'rgba(255,255,255,.3)'};font-size:13px;padding:11px 20px;width:100%;margin-top:4px;${!folderPath?'cursor:not-allowed':''}"
              ${!folderPath ? 'disabled' : ''}>
              🚀 Instalar App en LTH OS
            </button>

            <div class="lth-cfg-section-title" style="margin-top:18px">🗑️ Desinstalar App</div>
            <div class="lth-cfg-info-card">
              La desinstalación integrada elimina el archivo <strong>.js</strong>, quita su registro de <strong>system.lth</strong> y borra los datos declarados por la app.
            </div>
            <div class="lth-cfg-path-row">
              <label>App instalada</label>
              <select class="lth-cfg-select" id="cfgInstalledApp" style="width:100%">
                <option value="">Cargando apps instaladas...</option>
              </select>
            </div>
            <div class="lth-cfg-info-card" id="installedAppMeta">
              Selecciona una app para ver qué se va a borrar.
            </div>
            <button class="lth-cfg-btn lth-cfg-btn-red" id="btnUninstallApp" style="width:100%;margin-top:4px">
              🗑️ Desinstalar App
            </button>

            <div class="lth-cfg-section-title" style="margin-top:18px">📦 Portabilidad — Mover a otra PC</div>
            <div class="lth-cfg-info-card">
              <strong>¿Vas a cambiar de computadora?</strong><br>
              1. Exporta todos tus proyectos con el botón de abajo<br>
              2. Copia la carpeta exportada a tu nueva PC<br>
              3. En la nueva PC, usa <strong>Importar proyectos</strong>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap">
              <button class="lth-cfg-btn lth-cfg-btn-green" id="btnExportAll">📤 Exportar TODOS los proyectos</button>
              <button class="lth-cfg-btn lth-cfg-btn-blue" id="btnImportProjects">📥 Importar proyectos</button>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">
              <button class="lth-cfg-btn lth-cfg-btn-orange" id="btnExportCfg">💾 Exportar configuración</button>
              <button class="lth-cfg-btn lth-cfg-btn-blue" id="btnImportCfg">📂 Importar configuración</button>
            </div>
          </div>`;
        },

        sistema: () => `
          <div class="lth-cfg-section">
            <div class="lth-cfg-section-title">🖥️ Sistema</div>
            <div class="lth-cfg-row">
              <label>Autoguardado de proyectos <span class="lth-cfg-desc">Guardar automáticamente cada cierto tiempo</span></label>
              <label class="lth-cfg-toggle"><input type="checkbox" id="cfgAutoSave" ${cfg.autoSave?'checked':''}><span class="lth-cfg-toggle-slider"></span></label>
            </div>
            <div class="lth-cfg-row">
              <label>Intervalo de autoguardado</label>
              <select class="lth-cfg-select" id="cfgAutoSaveInterval">
                ${[30,60,120,300].map(n=>`<option value="${n}" ${(cfg.autoSaveInterval||60)==n?'selected':''}>${n}s</option>`).join('')}
              </select>
            </div>
            <div class="lth-cfg-row">
              <label>Restaurar último proyecto al abrir <span class="lth-cfg-desc">Cargar el proyecto donde quedaste</span></label>
              <label class="lth-cfg-toggle"><input type="checkbox" id="cfgRestoreLast" ${cfg.restoreLast!==false?'checked':''}><span class="lth-cfg-toggle-slider"></span></label>
            </div>
            <div class="lth-cfg-section-title" style="margin-top:8px">🗑️ Mantenimiento</div>
            <div style="display:flex;gap:10px;flex-wrap:wrap">
              <button class="lth-cfg-btn lth-cfg-btn-blue" id="btnRepairMemory">🩹 Reparar memoria local</button>
              <button class="lth-cfg-btn lth-cfg-btn-orange" id="btnClearCache">🧹 Limpiar caché</button>
              <button class="lth-cfg-btn lth-cfg-btn-red" id="btnResetCfg">⚠️ Restablecer configuración</button>
            </div>
            <button class="lth-cfg-btn lth-cfg-btn-blue" id="btnApplySistema" style="margin-top:4px">✅ Guardar</button>
          </div>`,

        acerca: () => `
          <div class="lth-cfg-section">
            <div class="lth-cfg-section-title">ℹ️ Acerca de LTH PROG</div>
            <div class="lth-cfg-info-card" style="line-height:2">
              <strong>LTH PROG</strong> — Editor de código integrado<br>
              Parte del ecosistema <strong>LTH OS</strong><br>
              <br>
              <strong>Versión:</strong> 2.0.0<br>
              <strong>Motor:</strong> Electron + CodeMirror<br>
              <strong>Lenguajes:</strong> HTML, CSS, JavaScript<br>
              <strong>Preview:</strong> Servidor HTTP local<br>
            </div>
            <div class="lth-cfg-section-title" style="margin-top:8px">📊 Almacenamiento actual</div>
            <div class="lth-cfg-info-card" id="storageInfo">Cargando...</div>
          </div>`
      };

      const renderTab = (tab) => {
        activeTab = tab;
        nav.querySelectorAll('.lth-settings-nav-item').forEach(el => {
          el.classList.toggle('active', el.dataset.tab === tab);
        });
        content.innerHTML = tabs[tab] ? tabs[tab]() : '';
        bindTabEvents(tab);
      };

      const bindTabEvents = async (tab) => {
        if (tab === 'rutas') {
          content.querySelector('#btnOpenProjects')?.addEventListener('click', async () => {
            if (window.electron?.fs?.selectFolder) {
              // Solo abrir el explorador en esa ruta (read-only info)
              this.showNotification(`📂 Proyectos en: ${sysPaths.projects}`);
            }
          });
          content.querySelector('#btnOpenData')?.addEventListener('click', () => {
            this.showNotification(`📂 Datos en: ${sysPaths.data}`);
          });
          content.querySelector('#btnChangeExport')?.addEventListener('click', async () => {
            const result = await window.electron?.fs?.selectFolder();
            if (result?.success && result.path) {
              cfg.exportPath = result.path;
              try { localStorage.setItem('lth-export-path', result.path); } catch(e) {}
              await saveCfg();
              renderTab('rutas');
              this.showNotification('✅ Ruta de exportación actualizada');
            }
          });
        }

        if (tab === 'editor') {
          content.querySelector('#btnApplyEditor')?.addEventListener('click', async () => {
            cfg.fontSize     = parseInt(content.querySelector('#cfgFontSize')?.value || 13);
            cfg.theme = content.querySelector('#cfgTheme')?.value || 'lth-vscode';
            cfg.indent       = parseInt(content.querySelector('#cfgIndent')?.value || 2);
            cfg.lineNums     = content.querySelector('#cfgLineNums')?.checked ?? true;
            cfg.autocomplete = content.querySelector('#cfgAutocomplete')?.checked ?? true;
            cfg.highlightLine= content.querySelector('#cfgHighlightLine')?.checked ?? true;
            await saveCfg();
            // Aplicar al editor si existe
            if (this.editor?.setOption) {
              this.editor.setOption('lineNumbers', cfg.lineNums);
              this.editor.setOption('indentUnit', cfg.indent);
              this.editor.setOption('tabSize', cfg.indent);
              this.editor.setOption('styleActiveLine', cfg.highlightLine);
              this.editor.setOption('theme', cfg.theme || 'lth-vscode');
            }
            // Aplicar tamaño de fuente al editor
            const cmEl = container.querySelector('.CodeMirror');
            if (cmEl) cmEl.style.fontSize = cfg.fontSize + 'px';
            this.showNotification('✅ Editor actualizado');
          });
        }

        if (tab === 'preview') {
          content.querySelector('#btnApplyPreview')?.addEventListener('click', async () => {
            cfg.autoLive   = content.querySelector('#cfgAutoLive')?.checked ?? false;
            cfg.liveDelay  = parseInt(content.querySelector('#cfgLiveDelay')?.value || 500);
            cfg.runMode    = content.querySelector('#cfgRunMode')?.value || 'fullscreen';
            await saveCfg();
            this.showNotification('✅ Preview guardado');
          });
        }

        if (tab === 'portabilidad') {
          // ── INSTALAR APP EN LTH OS ───────────────────────────────────────
          content.querySelector('#btnPublishApp')?.addEventListener('click', async () => {
            const appName  = content.querySelector('#cfgAppName')?.value?.trim() || 'Mi App';
            const appIcon  = content.querySelector('#cfgAppIcon')?.value || '🖥️';
            const gradient = content.querySelector('#cfgAppGradient')?.value || 'linear-gradient(135deg,#667eea,#764ba2)';
            const folderPath = this.state?.folderPath;

            if (!folderPath) { this.showNotification('⚠️ Abre una carpeta primero'); return; }

            // ID limpio para el archivo
            const appId = appName.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9\-]/g,'') || 'mi-app';

            // HTML principal (mantener nombre real para que el servidor lo sirva)
            const htmlFile = (this.state.filesList || []).find(f => f.type === 'html');
            const htmlName = htmlFile?.name || 'index.html';
            const folderNorm = folderPath.replace(/\\/g, '/');

            // Generar el .js — usa el mismo mecanismo que refreshLive (writeFiles + src=url)
            const appJS = `// ===== LTH OS APP — ${appName} =====
// Instalado desde LTH PROG — ${new Date().toLocaleDateString('es')}

window.LTH_APPS = window.LTH_APPS || {};

window.LTH_APPS['${appId}'] = {
  id: '${appId}',
  name: '${appName}',
  icon: '${appIcon}',
  gradient: '${gradient}',
  _folderPath: '${folderNorm}',
  _htmlFile: '${htmlName}',
  _dataRoot: '${_ProgFS._appDataDir(appId).replace(/\\/g, '\\\\')}',

  getUninstallManifest() {
    return {
      dataPaths: [this._dataRoot]
    };
  },

  render(container) {
    container.style.cssText = 'width:100%;height:100%;padding:0;margin:0;overflow:hidden;background:#000';

    // Sin Electron: mostrar aviso
    if (!window.electron?.fs || !window.electron?.preview) {
      container.innerHTML = '<div style="padding:24px;color:#ffb347;font-family:sans-serif">' +
        '<h2>⚠️ Requiere LTH OS con Electron</h2>' +
        '<p>Ruta: ${folderNorm}</p></div>';
      return;
    }

    // Mostrar spinner mientras carga
    container.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#0a0a14;color:#7dd3fc;font-family:sans-serif;font-size:14px">' +
      '<div style="text-align:center"><div style="font-size:32px;margin-bottom:12px">${appIcon}</div><div>Cargando ${appName}…</div></div></div>';

    // Leer todos los archivos de la carpeta y servirlos con el servidor HTTP
    // (igual que hace refreshLive — Supabase funciona perfectamente)
    (async () => {
      try {
        const dir = await window.electron.fs.readDirectory(this._folderPath);
        const allFiles = [...(dir.files || [])];
        const toWrite = {};

        for (const f of allFiles) {
          const r = await window.electron.fs.readFile(f.path);
          if (r.success) toWrite[f.name] = r.content;
        }

        const result = await window.electron.preview.writeFiles(toWrite);

        if (result.success) {
          const url = result.url + '/' + this._htmlFile + '?t=' + Date.now();
          container.innerHTML = '<iframe ' +
            'style="width:100%;height:100%;border:none;display:block" ' +
            'sandbox="allow-scripts allow-modals allow-same-origin allow-forms allow-popups allow-top-navigation" ' +
            'src="' + url + '">' +
            '</iframe>';
        } else {
          throw new Error('Servidor no disponible');
        }
      } catch (e) {
        container.innerHTML = '<div style="padding:24px;color:#ff6b6b;font-family:sans-serif">' +
          '<h2>❌ Error al cargar</h2><p>' + e.message + '</p>' +
          '<p style="opacity:.6;font-size:12px">Ruta: ${folderNorm}</p></div>';
      }
    })();
  },

  onClose() {}
};

console.log('✅ App "${appName}" instalada en LTH OS');
`;

            const appFilePath = `${_ProgFS._appsDir()}\\${appId}.js`;
            const appDataPath = _ProgFS._appDataDir(appId);
            await window.electron?.fs?.createFolder?.(appDataPath);
            const writeResult = await window.electron?.fs?.writeFile?.(appFilePath, appJS);
            if (!writeResult?.success) {
              this.showNotification(`❌ No pude instalar "${appName}" en la carpeta segura de apps`);
              return;
            }

            const registryResult = await _ProgFS.registerInstalledApp({
              appId,
              name: appName,
              jsPath: appFilePath,
              sourceFolder: folderPath,
              htmlFile: htmlName,
              dataPaths: [appDataPath],
              storageKeys: []
            });

            if (!registryResult?.success) {
              this.showNotification(`⚠️ "${appName}" se instaló, pero no pude actualizar system.lth`);
              return;
            }

            this.showNotification(`✅ "${appName}" instalada en la carpeta segura de apps y registrada en system.lth`);
          });

          const installedAppSelect = content.querySelector('#cfgInstalledApp');
          const installedAppMeta = content.querySelector('#installedAppMeta');
          const uninstallBtn = content.querySelector('#btnUninstallApp');
          let installedApps = [];

          const updateInstalledAppMeta = () => {
            const selectedId = installedAppSelect?.value || '';
            const entry = installedApps.find(app => app.appId === selectedId);

            if (!entry) {
              if (installedAppMeta) {
                installedAppMeta.innerHTML = 'Selecciona una app para ver qué se va a borrar.';
              }
              if (uninstallBtn) uninstallBtn.disabled = true;
              return;
            }

            const manifest = resolveInstalledAppManifest(entry);
            const dataPaths = manifest.dataPaths.length
              ? manifest.dataPaths.map(path => `<div style="font-family:monospace;font-size:11px;color:#fca5a5">${path}</div>`).join('')
              : '<span style="color:rgba(255,255,255,.6)">Sin carpetas de datos registradas.</span>';
            const storageKeys = manifest.storageKeys.length
              ? manifest.storageKeys.map(key => `<code style="font-size:11px">${key}</code>`).join(', ')
              : '<span style="color:rgba(255,255,255,.6)">Sin claves locales registradas.</span>';
            const storagePrefixes = manifest.storagePrefixes.length
              ? manifest.storagePrefixes.map(prefix => `<code style="font-size:11px">${prefix}*</code>`).join(', ')
              : '<span style="color:rgba(255,255,255,.6)">Sin prefijos locales registrados.</span>';

            if (installedAppMeta) {
              installedAppMeta.innerHTML = `
                <strong>${manifest.name}</strong><br>
                <span style="font-family:monospace;font-size:11px;color:#7dd3fc">${manifest.jsPath || 'Sin ruta .js registrada'}</span>
                <div style="margin-top:8px"><strong>Datos a limpiar:</strong></div>
                ${dataPaths}
                <div style="margin-top:8px"><strong>Claves locales:</strong> ${storageKeys}</div>
                <div style="margin-top:8px"><strong>Prefijos locales:</strong> ${storagePrefixes}</div>
              `;
            }

            if (uninstallBtn) uninstallBtn.disabled = false;
          };

          const refreshInstalledApps = async () => {
            const result = await _ProgFS.listInstalledApps();
            installedApps = result?.apps || [];

            if (!installedAppSelect) return;

            if (!installedApps.length) {
              installedAppSelect.innerHTML = '<option value="">No hay apps instaladas</option>';
              if (uninstallBtn) uninstallBtn.disabled = true;
              if (installedAppMeta) {
                installedAppMeta.innerHTML = 'No encontré apps instaladas fuera del sistema.';
              }
              return;
            }

            installedAppSelect.innerHTML = [
              '<option value="">Selecciona una app</option>',
              ...installedApps.map(app => `<option value="${app.appId}">${app.name}</option>`)
            ].join('');

            updateInstalledAppMeta();
          };

          installedAppSelect?.addEventListener('change', updateInstalledAppMeta);

          uninstallBtn?.addEventListener('click', async () => {
            const selectedId = installedAppSelect?.value || '';
            const entry = installedApps.find(app => app.appId === selectedId);
            if (!entry) {
              this.showNotification('⚠️ Selecciona una app instalada');
              return;
            }

            const manifest = resolveInstalledAppManifest(entry);
            const confirmed = window.confirm(
              `Se desinstalará "${manifest.name}".\n\n` +
              `Esto borrará el archivo JS, quitará su registro de system.lth` +
              `${manifest.dataPaths.length ? ' y también limpiará sus datos registrados.' : '.'}`
            );

            if (!confirmed) return;

            const deletedPaths = [];
            const failedPaths = [];
            const targets = uniqStrings([manifest.jsPath, ...manifest.dataPaths]);

            for (const targetPath of targets) {
              if (!targetPath) continue;
              try {
                const exists = await window.electron?.fs?.itemExists?.(targetPath);
                if (exists?.exists === false) continue;
                const removed = await window.electron?.fs?.deleteItem?.(targetPath);
                if (removed?.success) deletedPaths.push(targetPath);
                else failedPaths.push(targetPath);
              } catch (e) {
                failedPaths.push(targetPath);
              }
            }

            manifest.storageKeys.forEach(key => {
              try { localStorage.removeItem(key); } catch (e) {}
            });

            manifest.storagePrefixes.forEach(prefix => {
              try {
                for (let i = localStorage.length - 1; i >= 0; i--) {
                  const key = localStorage.key(i);
                  if (key && key.startsWith(prefix)) localStorage.removeItem(key);
                }
              } catch (e) {}
            });

            await _ProgFS.unregisterInstalledApp(manifest.appId);

            try {
              delete window.LTH_APPS[manifest.appId];
              manifest.legacyIds.forEach(id => { delete window.LTH_APPS[id]; });
              if (window.AppLoader) {
                window.AppLoader.loadedApps.delete(manifest.appId);
                manifest.legacyIds.forEach(id => window.AppLoader.loadedApps.delete(id));
                window.AppLoader.registeredApps = window.AppLoader.registeredApps.filter(app => {
                  return app.id !== manifest.appId && !manifest.legacyIds.includes(app.id);
                });
              }
              document.querySelectorAll(`.app-icon[data-app="${manifest.appId}"]`).forEach(node => node.remove());
              manifest.legacyIds.forEach(id => {
                document.querySelectorAll(`.app-icon[data-app="${id}"]`).forEach(node => node.remove());
              });
            } catch (e) {}

            await refreshInstalledApps();

            if (failedPaths.length) {
              this.showNotification(`⚠️ "${manifest.name}" quedó parcialmente desinstalada`);
            } else if (deletedPaths.length || manifest.storageKeys.length || manifest.storagePrefixes.length) {
              this.showNotification(`✅ "${manifest.name}" desinstalada y limpiada de system.lth`);
            } else {
              this.showNotification(`✅ "${manifest.name}" quitada de system.lth`);
            }
          });

          await refreshInstalledApps();
          content.querySelector('#btnExportAll')?.addEventListener('click', async () => {
            if (!window.electron?.fs || !window.electron?.fs) {
              this.showNotification('❌ APIs no disponibles'); return;
            }
            const folderResult = await window.electron.fs.selectFolder();
            if (!folderResult?.success || !folderResult.path) return;
            const destFolder = folderResult.path;
            const listResult = await _ProgFS.listProjects();
            if (!listResult?.projects?.length) { this.showNotification('⚠️ No hay proyectos'); return; }
            let count = 0;
            for (const pName of listResult.projects) {
              const proj = await _ProgFS.loadProject(pName);
              if (proj?.success) {
                const sep = destFolder.includes('\\') ? '\\' : '/';
                const filePath = destFolder + sep + pName + '.lthproject';
                const json = JSON.stringify(proj.project || proj, null, 2);
                try { await window.electron.fs.writeFile(filePath, json); count++; } catch(e) {}
              }
            }
            this.showNotification(`✅ ${count} proyectos exportados a: ${destFolder}`);
          });

          // Importar proyectos desde .lthproject
          content.querySelector('#btnImportProjects')?.addEventListener('click', async () => {
            if (!window.electron?.fs?.selectFile) { this.showNotification('❌ API no disponible'); return; }
            const result = await window.electron.fs.selectFile({
              filters: [{ name: 'LTH Project', extensions: ['lthproject', 'json'] }]
            });
            if (!result?.success || !result.content) return;
            try {
              const data = JSON.parse(result.content);
              const projectName = data.name || result.name?.replace(/\.(lthproject|json)$/,'') || 'importado';
              await _ProgFS.saveProject(projectName, data);
              this.showNotification(`✅ Proyecto "${projectName}" importado`);
            } catch(e) { this.showNotification('❌ Archivo inválido'); }
          });

          // Exportar configuración
          content.querySelector('#btnExportCfg')?.addEventListener('click', async () => {
            const json = JSON.stringify(cfg, null, 2);
            const result = await window.electron?.fs?.saveFileAs(json, {
              defaultPath: 'lth-prog-config.json',
              filters: [{ name: 'JSON', extensions: ['json'] }]
            });
            if (result?.success) this.showNotification('✅ Configuración exportada');
          });

          // Importar configuración
          content.querySelector('#btnImportCfg')?.addEventListener('click', async () => {
            const result = await window.electron?.fs?.selectFile({
              filters: [{ name: 'JSON', extensions: ['json'] }]
            });
            if (!result?.success || !result.content) return;
            try {
              const imported = JSON.parse(result.content);
              cfg = { ...cfg, ...imported };
              await saveCfg();
              this.showNotification('✅ Configuración importada — reinicia para aplicar todo');
            } catch(e) { this.showNotification('❌ Archivo inválido'); }
          });
        }

        if (tab === 'sistema') {
          content.querySelector('#btnApplySistema')?.addEventListener('click', async () => {
            cfg.autoSave         = content.querySelector('#cfgAutoSave')?.checked ?? false;
            cfg.autoSaveInterval = parseInt(content.querySelector('#cfgAutoSaveInterval')?.value || 60);
            cfg.restoreLast      = content.querySelector('#cfgRestoreLast')?.checked ?? true;
            await saveCfg();
            this.showNotification('✅ Sistema guardado');
          });
          content.querySelector('#btnRepairMemory')?.addEventListener('click', () => {
            const result = this.repairLocalMemory
              ? this.repairLocalMemory({ resetRuntime: true, includeExportPath: false })
              : { draftsCleared: 0, sessionCleared: false };
            this.showNotification(`🩹 Memoria local reparada (${result.draftsCleared} drafts${result.sessionCleared ? ', sesión limpiada' : ''})`);
          });
          content.querySelector('#btnClearCache')?.addEventListener('click', () => {
            try { localStorage.removeItem('lth-export-path'); } catch(e) {}
            this.showNotification('🧹 Caché limpiada');
          });
          content.querySelector('#btnResetCfg')?.addEventListener('click', async () => {
            cfg = {};
            await saveCfg();
            try { localStorage.removeItem('lth-export-path'); } catch(e) {}
            this.showNotification('⚠️ Configuración restablecida');
            renderTab('sistema');
          });
        }

        if (tab === 'acerca') {
          // Cargar info de almacenamiento
          try {
            const listResult = await _ProgFS.listProjects();
            const count = listResult?.projects?.length || 0;
            const infoEl = content.querySelector('#storageInfo');
            if (infoEl) {
              infoEl.innerHTML = `
                <strong>Proyectos guardados:</strong> ${count}<br>
                <strong>Ruta datos:</strong> ${sysPaths.data || 'N/A'}<br>
                <strong>Ruta proyectos:</strong> ${sysPaths.projects || 'N/A'}<br>
                <strong>Exportación:</strong> ${cfg.exportPath || 'No configurada'}
              `;
            }
          } catch(e) {}
        }
      };

      // Navegación
      nav.querySelectorAll('.lth-settings-nav-item').forEach(item => {
        item.addEventListener('click', () => renderTab(item.dataset.tab));
      });

      // Abrir/cerrar
const openSettings = () => {
  try {
    overlay.style.display = 'flex';
    overlay.classList.add('open');
    settingsBtn?.classList.add('active');
    renderTab(activeTab);
  } catch (err) {
    console.error('Error abriendo settings:', err);
    overlay.style.display = 'flex';
    overlay.classList.add('open');
    settingsBtn?.classList.add('active');
  }
};

const closeSettings = () => {
  overlay.classList.remove('open');
  overlay.style.display = '';
  settingsBtn?.classList.remove('active');
};

settingsBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  openSettings();
});

closeBtn?.addEventListener('click', closeSettings);

overlay?.addEventListener('click', (e) => {
  if (e.target === overlay) closeSettings();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && overlay.classList.contains('open')) {
    closeSettings();
  }
});
      // Aplicar configuración guardada al editor al iniciar
      if (this.editor?.setOption) {
        this.editor.setOption('theme', cfg.theme || 'lth-vscode');
        const cmEl = container.querySelector('.CodeMirror');
        if (cmEl && cfg.fontSize) cmEl.style.fontSize = cfg.fontSize + 'px';
      }
    },

    refreshLive(container, force) {
      try {
        this._syncLegacyFiles && this._syncLegacyFiles();

        const liveFrame = container.querySelector('#liveFrame');
        if (!liveFrame) return;
        if (!this.state.live && !force) return;

        // ✅ Guardar contenido actual del editor en el archivo activo
        const getCode = () => this.editor?.getValue ? this.editor.getValue() : '';
        const activeFile = (this.state.filesList || []).find(f => f.id === this.state.activeFileId);
        if (activeFile && getCode) {
          activeFile.content = getCode();
        }
        // También actualizar legacy por compatibilidad
        const tab = this.state.editorTab;
        if (getCode && this.state.files?.[tab]) {
          this.state.files[tab].content = getCode();
        }

        const isHtmlPreviewFile = (file) =>
          !!file && (String(file.type || '').toLowerCase() === 'html' || /\.html?$/i.test(String(file.name || file.path || '')));
        const isCssPreviewFile = (file) =>
          !!file && (String(file.type || '').toLowerCase() === 'css' || /\.css$/i.test(String(file.name || file.path || '')));
        const isJsPreviewFile = (file) =>
          !!file && (String(file.type || '').toLowerCase() === 'js' || /\.(?:mjs|cjs|jsx?|tsx?)$/i.test(String(file.name || file.path || '')));

        // 🛡️ No preview para archivos standalone (py, json, js sin HTML, js externo)
        const filesList = this.state.filesList || [];
        const hasHTML = filesList.some(isHtmlPreviewFile);
        if (activeFile && activeFile.type === 'py') return;
        if (activeFile && activeFile.type === 'json') return;
        if (activeFile && isJsPreviewFile(activeFile) && !hasHTML) return;
        if (activeFile && isJsPreviewFile(activeFile) && activeFile.path && !hasHTML) return;

        // ✅ Construir preview desde filesList real
        // Si el activo es HTML → mostrarlo directamente
        // Si el activo es CSS/JS → mostrar el HTML que tenga nombre similar, o el primero
        const activeF = filesList.find(f => f.id === this.state.activeFileId);

        let htmlContent = '';
        let chosenHtmlFile = null; // archivo HTML que se va a cargar (para su ruta relativa)
        if (activeF && isHtmlPreviewFile(activeF)) {
          // El activo es HTML → usarlo directamente
          chosenHtmlFile = activeF;
          htmlContent = activeF.content || '';
        } else if (activeF && (isCssPreviewFile(activeF) || isJsPreviewFile(activeF))) {
          // El activo es CSS/JS → buscar HTML con nombre relacionado
          const baseName = (activeF.name || '').replace(/\.(css|mjs|cjs|jsx?|tsx?)$/i, '').replace(/^Style-|^main-/i, '');
          const related = filesList.find(f =>
            isHtmlPreviewFile(f) &&
            (f.name || '').replace(/\.html?$/i, '').toLowerCase() === baseName.toLowerCase()
          ) || filesList.find(isHtmlPreviewFile);
          chosenHtmlFile = related || null;
          htmlContent = related ? (related.content || '') : (this.state.files?.html?.content || '');
        } else {
          chosenHtmlFile = filesList.find(isHtmlPreviewFile) || null;
          htmlContent = chosenHtmlFile ? (chosenHtmlFile.content || '') : (this.state.files?.html?.content || '');
        }

        if (!String(htmlContent || '').trim() && activeF && isHtmlPreviewFile(activeF)) {
          htmlContent = getCode() || activeF.content || '';
          chosenHtmlFile = activeF;
        }
        if (!String(htmlContent || '').trim()) {
          const fallbackHtml = filesList.find(file => isHtmlPreviewFile(file) && String(file.content || '').trim());
          if (fallbackHtml) {
            chosenHtmlFile = fallbackHtml;
            htmlContent = fallbackHtml.content || '';
          }
        }
        if (!String(htmlContent || '').trim()) {
          console.warn('[LTH PROG] Live preview sin HTML renderizable', {
            active: activeF ? { name: activeF.name, type: activeF.type, id: activeF.id } : null,
            files: filesList.map(f => ({ name: f?.name, type: f?.type, len: String(f?.content || '').length })).slice(0, 20)
          });
          return;
        }

        // Recolectar CSS y JS del proyecto para inyección (excluir externos y json)
        const cssContent = filesList
          .filter(f => isCssPreviewFile(f) && !f.path)
          .map(f => f.content || '')
          .join('\n') || this.state.files?.css?.content || '';
        const jsContent = filesList
          .filter(f => isJsPreviewFile(f) && !f.path)
          .map(f => f.content || '')
          .join('\n') || this.state.files?.js?.content || '';

        // ✅ Agregar meta viewport si no existe para mejor renderizado móvil
        if (!htmlContent.includes('viewport')) {
          htmlContent = htmlContent.replace(
            '<head>',
            '<head>\n  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">'
          );
        }

        const previewEscapeBridge = `<script id="lth-wm-escape-bridge">(function(){document.addEventListener('keydown',function(e){if(e.key==='Escape'){try{window.parent.postMessage({type:'LTH_WM_ESCAPE'},'*')}catch(_){}}},true);})();<\/script>`;
        if (!htmlContent.includes('lth-wm-escape-bridge')) {
          if (/<\/head>/i.test(htmlContent)) {
            htmlContent = htmlContent.replace(/<\/head>/i, `${previewEscapeBridge}\n</head>`);
          } else {
            htmlContent = `${previewEscapeBridge}\n${htmlContent}`;
          }
        }

        // Fase 3: puente de errores del preview -> panel IA. Captura errores de
        // runtime, promesas rechazadas, console.error y recursos que no cargan,
        // y los manda al padre por postMessage (LTH_PROG_PREVIEW_ERROR). Se
        // inyecta al INICIO del <head> para atrapar errores de scripts tempranos.
        // Solo vive en la copia del preview: nunca se escribe al archivo real.
        const previewErrorBridge = `<script id="lth-prog-error-bridge">(function(){var send=function(kind,msg,src,line){try{window.parent.postMessage({type:'LTH_PROG_PREVIEW_ERROR',kind:kind,message:String(msg||'').slice(0,300),source:String(src||'').slice(0,120),line:Number(line)||0},'*')}catch(_){}};window.addEventListener('error',function(e){if(e&&e.message){send('error',e.message,e.filename,e.lineno)}else{var t=e&&e.target;var u=t&&(t.src||t.href);if(u){send('resource','No cargo el recurso: '+u,String((t&&t.tagName)||'').toLowerCase(),0)}}},true);window.addEventListener('unhandledrejection',function(e){var r=e&&e.reason;send('rejection',String((r&&(r.message||r))||'promesa rechazada'),'',0)});var ce=console.error;console.error=function(){try{send('console.error',Array.prototype.slice.call(arguments).map(String).join(' '),'',0)}catch(_){}try{ce.apply(console,arguments)}catch(_){}};})();<\/script>`;
        if (!htmlContent.includes('lth-prog-error-bridge')) {
          if (/<head[^>]*>/i.test(htmlContent)) {
            htmlContent = htmlContent.replace(/<head[^>]*>/i, (m) => `${m}\n${previewErrorBridge}`);
          } else {
            htmlContent = `${previewErrorBridge}\n${htmlContent}`;
          }
        }

        // ✅ INYECTAR CSS Y JS EN EL HTML
        htmlContent = htmlContent.replace(
          '<style id="injected-css"></style>',
          `<style id="injected-css">${cssContent}</style>`
        );
        htmlContent = htmlContent.replace(
          '<script id="injected-js"></script>',
          `<script id="injected-js">${jsContent}</script>`
        );


        // 🎯 INYECTAR CÓDIGO DEL INSPECTOR si está activo
        if (this._inspectorActive) {
          const inspectorCode = `<style id="inspector-injected">*{cursor:crosshair!important}.inspector-hl{outline:3px solid #00d4ff!important;outline-offset:2px!important;background-color:rgba(0,212,255,0.15)!important}.inspector-tip{position:fixed!important;top:10px!important;right:10px!important;background:linear-gradient(135deg,#1a1a24,#0f0f14)!important;border:2px solid #00d4ff!important;border-radius:12px!important;padding:12px 16px!important;font-family:monospace!important;font-size:13px!important;color:#00d4ff!important;z-index:999999!important;pointer-events:none!important;box-shadow:0 8px 32px rgba(0,0,0,0.9)!important;font-weight:bold!important}</style><div class="inspector-tip">🎯 Pasa el mouse y click</div><script>(function(){let h=null;const t=document.querySelector('.inspector-tip');document.addEventListener('mousemove',e=>{const el=e.target;if(el===t)return;if(h&&h!==el)h.classList.remove('inspector-hl');el.classList.add('inspector-hl');h=el;const tag=el.tagName.toLowerCase(),id=el.id?'#'+el.id:'',cls=el.className.replace('inspector-hl','').trim(),c=cls?'.'+cls.split(' ').join('.'):'';t.textContent='🎯 <'+tag+id+c+'>';});document.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const el=e.target;if(el===t)return;const tag=el.tagName.toLowerCase(),id=el.id,cls=el.className.replace('inspector-hl','').trim(),txt=el.textContent.trim().substring(0,100);let s='<'+tag;if(id)s+=' id="'+id+'"';else if(cls){const fc=cls.split(' ')[0];s+=' class="'+fc+'"';}window.parent.postMessage({type:'INSPECTOR_CLICK',searchTerm:s,element:{tagName:tag,id:id,className:cls},textContent:txt},'*');},true);})();<\/script>`;
          if (htmlContent.includes('</body>')) {
            htmlContent = htmlContent.replace('</body>', inspectorCode + '</body>');
          } else {
            htmlContent += inspectorCode;
          }
        }
        // ✅ USAR SERVIDOR HTTP REAL
        if (window.electron?.preview) {
          const previewFiles = {
            'index.html': htmlContent,
            'styles.css': '',
            'app.js': ''
          };
          filesList.filter(f => String(f?.type || '').toLowerCase() === 'json' || /\.json$/i.test(String(f?.name || ''))).forEach(f => {
            const fname = f.name || 'data.json';
            previewFiles[fname] = f.content || '{}';
          });
          window.electron.preview.writeFiles(previewFiles).then(result => {
            if (result && result.success) {
              liveFrame.removeAttribute('srcdoc');
              liveFrame.src = result.url + '?t=' + Date.now();
              liveFrame.dataset.inspectorReady = 'true';
              const es = container.querySelector('#previewEmptyState');
              if (es) es.classList.add('hidden');
            } else {
              liveFrame.removeAttribute('src');
              liveFrame.srcdoc = htmlContent;
              liveFrame.dataset.inspectorReady = 'false';
              const es = container.querySelector('#previewEmptyState');
              if (es) es.classList.add('hidden');
              console.warn('[LTH PROG] Preview writeFiles falló:', result);
            }
          }).catch(err => {
            console.error('Preview error:', err);
            liveFrame.removeAttribute('src');
            liveFrame.srcdoc = htmlContent;
            liveFrame.dataset.inspectorReady = 'false';
            const es = container.querySelector('#previewEmptyState');
            if (es) es.classList.add('hidden');
          });
        } else {
          // Fallback a srcdoc
          liveFrame.srcdoc = htmlContent;
          liveFrame.dataset.inspectorReady = 'false';
          const es = container.querySelector('#previewEmptyState');
          if (es) es.classList.add('hidden');
        }

        const editorStatus = container.querySelector('#editorStatus');
        if (editorStatus) editorStatus.textContent = this.state.live ? '' : 'Live OFF';
      } catch (err) {
        console.error(err);
      }
    },

    initTerminal(container) {
      const terminalInput = container.querySelector('#terminalInput');
      const terminalOutput = container.querySelector('#terminalOutput');
      const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = String(text ?? '');
        return div.innerHTML;
      };
      const addLine = (html) => {
        const line = document.createElement('div');
        line.className = 'terminal-line';
        line.innerHTML = html;
        terminalOutput.appendChild(line);
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
      };
      const commands = {
        help: () => `<div class="terminal-success">📚 Comandos:</div><div class="terminal-info"><b>help</b> - ayuda</div><div class="terminal-info"><b>run</b> - ejecuta (RUN)</div><div class="terminal-info"><b>clear</b> - limpia terminal</div>`,
        run: () => {
          const runBtn = container.querySelector('#runBtn');
          runBtn?.click();
          return `<div class="terminal-success">✅ RUN ejecutado</div>`;
        },
        clear: () => { terminalOutput.innerHTML = ''; return ''; }
      };
      terminalInput.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const input = terminalInput.value.trim();
        terminalInput.value = '';
        if (!input) return;
        addLine(`<span class="terminal-prompt">$</span> <span>${escapeHtml(input)}</span>`);
        const cmd = input.split(/\s+/)[0].toLowerCase();
        if (commands[cmd]) {
          const out = commands[cmd]();
          if (out) addLine(out);
        } else {
          addLine(`<div class="terminal-error">❌ Comando no encontrado: ${escapeHtml(cmd)}</div>`);
        }
      });
      this._previewConsoleHandler = (ev) => {
        const msg = ev.data;
        if (!msg || msg.type !== 'console') return;
        const level = msg.level || 'log';
        const text = String(msg.data ?? '');
        const cls = level === 'error' ? 'terminal-error' : level === 'warn' ? 'terminal-warn' : level === 'info' ? 'terminal-info' : 'terminal-success';
        addLine(`<span class="${cls}">[${escapeHtml(level)}]</span> <span>${escapeHtml(text)}</span>`);
      };
      window.addEventListener('message', this._previewConsoleHandler);
    },

    initCalculator(container) {
      const display = container.querySelector('#calcDisplay');
      const buttons = container.querySelector('#calcButtons');
      let currentValue = '0';
      let previousValue = null;
      let operation = null;
      let shouldReset = false;
      const update = () => { display.textContent = currentValue; };
      const calculate = () => {
        if (!operation || previousValue === null) return;
        const current = parseFloat(currentValue || '0');
        const prev = previousValue;
        let result = current;
        switch (operation) {
          case 'add': result = prev + current; break;
          case 'subtract': result = prev - current; break;
          case 'multiply': result = prev * current; break;
          case 'divide': result = prev / current; break;
        }
        currentValue = String(result);
      };
      const act = (a) => {
        switch (a) {
          case 'clear': currentValue = '0'; previousValue = null; operation = null; shouldReset = false; break;
          case 'sign': currentValue = String(-parseFloat(currentValue || '0')); break;
          case 'percent': currentValue = String(parseFloat(currentValue || '0') / 100); break;
          case 'decimal': if (!currentValue.includes('.')) currentValue += '.'; break;
          case 'add':
          case 'subtract':
          case 'multiply':
          case 'divide':
            if (operation && previousValue !== null && !shouldReset) calculate();
            previousValue = parseFloat(currentValue || '0');
            operation = a;
            shouldReset = true;
            break;
          case 'equals':
            calculate();
            operation = null;
            previousValue = null;
            shouldReset = true;
            break;
        }
        update();
      };
      buttons.addEventListener('click', (e) => {
        const btn = e.target;
        if (!btn.classList.contains('calc-btn')) return;
        const num = btn.dataset.num;
        const action = btn.dataset.action;
        if (num !== undefined) {
          if (shouldReset || currentValue === '0') { currentValue = num; shouldReset = false; }
          else currentValue += num;
          update();
          return;
        }
        if (action) act(action);
      });
      update();
    },

    showNotification(message) {
      if (window.showNotification) window.showNotification(message);
      else console.log(message);
    },

    onClose() {
      this._isClosed = true;
      this._activeRenderCycle = (Number(this._activeRenderCycle) || 0) + 1;
      const closingContainer = this._currentContainer;
      this._currentContainer = null;
      try { this._exitRunMode && this._exitRunMode(); } catch {}
      this._exitRunMode = null;
      if (this._bootFrame) {
        try { cancelAnimationFrame(this._bootFrame); } catch {}
        this._bootFrame = null;
      }
      if (this._bootTimer) {
        clearTimeout(this._bootTimer);
        this._bootTimer = null;
      }
      try { this._topDrawerCleanup && this._topDrawerCleanup(); } catch {}

      try { console.log('LTH PROG cerrado'); } catch {}
      try { this.editor?.toTextArea && this.editor.toTextArea(); } catch {}
      if (this._previewConsoleHandler) {
        window.removeEventListener('message', this._previewConsoleHandler);
        this._previewConsoleHandler = null;
      }
      if (this._runOverlayMessageHandler) {
        window.removeEventListener('message', this._runOverlayMessageHandler);
        this._runOverlayMessageHandler = null;
      }
      if (this._fileMenuOutside) {
        window.removeEventListener('click', this._fileMenuOutside);
        this._fileMenuOutside = null;
      }
      if (this._fileMenuEsc) {
        window.removeEventListener('keydown', this._fileMenuEsc);
        this._fileMenuEsc = null;
      }
      if (this._projectMenuOutside) {
        window.removeEventListener('click', this._projectMenuOutside);
        this._projectMenuOutside = null;
      }
      if (this._projectMenuEsc) {
        window.removeEventListener('keydown', this._projectMenuEsc);
        this._projectMenuEsc = null;
      }
      if (this._debounceTimer) {
        clearTimeout(this._debounceTimer);
        this._debounceTimer = null;
      }
      if (this._toolbarOutsideClick) {
        document.removeEventListener('click', this._toolbarOutsideClick);
        this._toolbarOutsideClick = null;
      }
      if (this._beforeUnloadDraftHandler) {
        window.removeEventListener('beforeunload', this._beforeUnloadDraftHandler);
        this._beforeUnloadDraftHandler = null;
      }
      if (this._autoSaveInterval) {
        clearInterval(this._autoSaveInterval);
        this._autoSaveInterval = null;
      }
      try { this._flushEditorPersistence && this._flushEditorPersistence({ touchDraft: true, refreshChrome: true }); } catch {}
      // Guardar la sesión (carpeta/proyecto abierto) para reabrirla al volver.
      // Antes se borraba con removeItem aquí, por eso no persistía al cerrar.
      try { this._persistEditorSession && this._persistEditorSession(); } catch {}
      // Persistir en disco la carpeta abierta (localStorage no sobrevive el cierre).
      try {
        this._saveWorkspaceToDisk && this._saveWorkspaceToDisk(
          this.state.workspaceMode === 'folder' ? this.state.folderPath : null
        );
      } catch {}
      // Detener el observador de la carpeta para no dejarlo colgado.
      try { this._stopFolderWatch && this._stopFolderWatch(); } catch {}
      try {
        if (closingContainer?.isConnected) {
          closingContainer.innerHTML = '';
        }
      } catch {}
      // No borrar workspace aquí: el window manager mantiene viva la instancia de
      // la app al cerrar con X. Si limpiamos folderPath/filesList, al reabrir dentro
      // del mismo OS la carpeta desaparece aunque ya se haya guardado en disco.
      this.state.currentTab = 'editor';
      this.state.terminalHistory = [];
      this._editorReady = null;
      this.editor = null;
      this.insertSnippet = null;
      this._isLoadingProject = false;
    }
  };

  console.log('⚡ LTH PROG registrado');

  if (window.AppLoader) {
    window.AppLoader.registerApp({
      id: PROG_APP_ID,
      name: 'LTH Prog',
      icon: PROG_APP_ICON_HTML,
      iconUrl: PROG_APP_ICON_URL,
      gradient: PROG_APP_GRADIENT,
    });
  }
})();
