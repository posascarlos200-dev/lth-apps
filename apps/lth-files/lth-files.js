/* =========================================================
   LTH FILES — Explorador de Archivos LTH OS
   Versión 1.0.0
   Ruta raíz: carpeta privada del usuario (APPDATA/Downloads)
   ========================================================= */

(function () {
  'use strict';

  window.LTH_APPS = window.LTH_APPS || {};

  const ROOT_STORAGE_KEY = 'lth_files_root_path_v2';

  function getRuntimePaths() {
    return window.LTHRuntimePaths?.get?.() || window.__LTH_RUNTIME_PATHS || {};
  }

  function getWorkspaceRoot() {
    const runtimeRoot = String(getRuntimePaths()?.packageRoot || '').trim();
    if (runtimeRoot) return runtimeRoot;
    try {
      const href = decodeURIComponent(String(window.location.href || ''));
      const normalized = href.replace(/^file:\/\/\//i, '').replace(/\//g, '\\');
      const parts = normalized.split('\\');
      const srcIndex = parts.findIndex(part => String(part || '').toLowerCase() === 'src');
      if (srcIndex > 0) return parts.slice(0, srcIndex).join('\\');
      if (parts.length > 1) return parts.slice(0, -1).join('\\');
    } catch (e) {}
    return '';
  }

  function getFilesDataFolder() {
    const runtimeData = String(getRuntimePaths()?.appData || '').trim();
    if (runtimeData) return runtimeData + '\\LTH Files';
    const workspaceRoot = getWorkspaceRoot();
    return workspaceRoot ? (workspaceRoot + '\\sistema LTH\\LTH Files') : '';
  }

  function getFolderColorsPath() {
    return getFilesDataFolder() + '\\folder-colors.json';
  }

  function normalizePath(pathValue) {
    const raw = String(pathValue || '').trim().replace(/\//g, '\\');
    if (!raw) return '';
    const collapsed = raw.replace(/\\+/g, '\\');
    if (/^[A-Za-z]:\\$/.test(collapsed)) return collapsed;
    return collapsed.replace(/\\+$/, '');
  }

  function pathEquals(a, b) {
    return normalizePath(a).toLowerCase() === normalizePath(b).toLowerCase();
  }

  window.LTH_APPS['lth-files'] = {
    id: 'lth-files',
    legacyIds: ['files'],
    name: 'Archivos LTH',
    version: '1.0.0',
    icon: '📁',
    iconUrl: '../assets/Archivos.png',
    gradient: 'linear-gradient(135deg,#2a0f06 0%,#5b1e08 45%,#ff6a00 100%)',

    _folderColorsCache: {},

    state: {
      rootPath: '',
      navRootPath: '',
      defaultPath: '',
      currentPath: '',
      history: [],
      historyIndex: 0,
      unlockedVaults: {},
      view: 'grid',       // 'grid' | 'list'
      selected: null,
      contextTarget: null,
    },

    getUninstallManifest() {
      return {
        dataPaths: [getFilesDataFolder()],
        storageKeys: ['lth_folder_colors']
      };
    },

    // ── Utilidades de ruta ────────────────────────────────────
    joinPath(...parts) {
      return parts.join('\\').replace(/\\+/g, '\\');
    },

    parentPath(p) {
      const idx = p.lastIndexOf('\\');
      if (idx <= 0) return p;
      return p.substring(0, idx);
    },

    basename(p) {
      return p.split('\\').pop() || p;
    },

    _getDefaultRootPath() {
      const runtimeDownloads = String(getRuntimePaths()?.downloads || '').trim();
      if (runtimeDownloads) return normalizePath(runtimeDownloads);
      const workspaceRoot = getWorkspaceRoot();
      return normalizePath(workspaceRoot ? (workspaceRoot + '\\Descargas') : '');
    },

    _isInsideRoot(path) {
      const root = this._getNavRootPath();
      const candidate = normalizePath(path);
      if (!root || !candidate) return false;
      const rootBoundary = /^[A-Za-z]:\\$/.test(root) ? root : (root + '\\');
      return pathEquals(candidate, root) || candidate.toLowerCase().startsWith(rootBoundary.toLowerCase());
    },

    _getNavRootPath() {
      return normalizePath(
        this.state.navRootPath
        || this.state.rootPath
        || this.state.defaultPath
        || this._getDefaultRootPath()
      );
    },

    _loadRootPathPreference() {
      const fallback = this._getDefaultRootPath();
      try {
        const stored = normalizePath(localStorage.getItem(ROOT_STORAGE_KEY) || '');
        return stored || fallback;
      } catch (e) {
        return fallback;
      }
    },

    _saveRootPathPreference(path) {
      try { localStorage.setItem(ROOT_STORAGE_KEY, normalizePath(path)); } catch (e) {}
    },

    _rootLabel(path) {
      const normalized = normalizePath(path);
      const base = this.basename(normalized);
      if (base && base !== normalized) return base;
      return normalized || 'Raiz';
    },

    async _activateLocation(path, options = {}) {
      const { persistRoot = false } = options;
      const target = normalizePath(path);
      if (!target) return;

      this.state.navRootPath = target;
      if (persistRoot) {
        this.state.rootPath = target;
        this._saveRootPathPreference(target);
      }

      this.state.history = [target];
      this.state.historyIndex = 0;
      this.state.currentPath = target;
      await this.navigate(target);
    },

    isRoot(p) {
      return pathEquals(p, this._getNavRootPath());
    },

    // ── API Electron filesystem ───────────────────────────────
    async fsReadDir(path) {
      try {
        const vault = this._getVaultSessionForPath(path);
        if (vault && window.electron?.vault?.readDirectory) {
          const result = await window.electron.vault.readDirectory(vault.sessionId, vault.relativePath || '');
          if (!result?.success) return { error: result?.error || 'Error al leer vault encriptado' };
          const folders = Array.isArray(result.folders) ? result.folders : [];
          const files = Array.isArray(result.files) ? result.files : [];
          return [...folders, ...files].map(item => ({
            ...item,
            mtime: item.modified ? new Date(item.modified) : new Date()
          }));
        }
        if (window.electron?.fs?.readDirectory) {
          const result = await window.electron.fs.readDirectory(path);
          if (!result?.success) return { error: result?.error || 'Error al leer directorio' };
          const folders = Array.isArray(result.folders) ? result.folders : [];
          const files   = Array.isArray(result.files)   ? result.files   : [];
          return [...folders, ...files].map(item => ({
            ...item,
            mtime: item.modified ? new Date(item.modified) : new Date()
          }));
        }
        return this._demoContents(path);
      } catch(e) {
        return { error: e.message || 'No se pudo leer la carpeta' };
      }
    },

    async fsReadTextFile(path) {
      const vault = this._getVaultSessionForPath(path);
      if (vault && window.electron?.vault?.readFile) {
        const result = await window.electron.vault.readFile(vault.sessionId, vault.relativePath || '');
        if (!result?.success) throw new Error(result?.error || 'No se pudo leer el archivo del vault');
        return typeof result.content === 'string' ? result.content : '';
      }
      if (window.electron?.fs?.readFile) {
        const result = await window.electron.fs.readFile(path);
        if (!result?.success && typeof result !== 'string') {
          throw new Error(result?.error || 'No se pudo leer el archivo');
        }
        return (typeof result === 'string') ? result : (result?.content || result?.data || '');
      }
      return '';
    },

    async fsReadBinaryFile(path) {
      const vault = this._getVaultSessionForPath(path);
      if (vault && window.electron?.vault?.readFile) {
        const result = await window.electron.vault.readFile(vault.sessionId, vault.relativePath || '');
        if (!result?.success) throw new Error(result?.error || 'No se pudo leer el archivo del vault');
        return result;
      }
      return null;
    },

    async fsStat(path) {
      try {
        const vault = this._getVaultSessionForPath(path);
        if (vault) {
          return { isDirectory: true, size: 0, mtime: new Date() };
        }
        if (window.electron?.fs?.itemExists) {
          const exists = await window.electron.fs.itemExists(path);
          return exists?.exists ? { isDirectory: true, size: 0, mtime: new Date() } : null;
        }
        return { isDirectory: true, size: 0, mtime: new Date() };
      } catch(e) { return null; }
    },

    async fsMkdir(path) {
      try {
        if (this._isInsideUnlockedVaultBody(path)) {
          return { error: 'El vault encriptado se abre en modo lectura por seguridad' };
        }
        if (window.electron?.fs?.createFolder) return await window.electron.fs.createFolder(path);
        return { success: true };
      } catch(e) { return { error: e.message }; }
    },

    async fsRename(oldPath, newPath) {
      try {
        if (this._isInsideUnlockedVaultBody(oldPath) || this._isInsideUnlockedVaultBody(newPath)) {
          return { error: 'Renombrar dentro de un vault encriptado aun no esta disponible' };
        }
        if (window.electron?.fs?.renameItem) return await window.electron.fs.renameItem(oldPath, newPath);
        return { success: true };
      } catch(e) { return { error: e.message }; }
    },

    async fsDelete(path) {
      try {
        if (this._isInsideUnlockedVaultBody(path)) {
          return { error: 'Eliminar dentro de un vault encriptado aun no esta disponible' };
        }
        if (window.electron?.fs?.deleteItem) return await window.electron.fs.deleteItem(path);
        return { success: true };
      } catch(e) { return { error: e.message }; }
    },

    _getVaultSessionForPath(path) {
      const normalized = normalizePath(path);
      if (!normalized) return null;
      const sessions = Object.values(this.state.unlockedVaults || {});
      let match = null;

      sessions.forEach((session) => {
        const root = normalizePath(session?.rootPath);
        if (!root) return;
        const inside = pathEquals(normalized, root) || normalized.toLowerCase().startsWith((root + '\\').toLowerCase());
        if (!inside) return;
        const relativePath = pathEquals(normalized, root)
          ? ''
          : normalized.slice(root.length).replace(/^\\+/, '');
        if (!match || root.length > match.rootPath.length) {
          match = {
            ...session,
            rootPath: root,
            relativePath
          };
        }
      });

      return match;
    },

    _isInsideUnlockedVaultBody(path) {
      const vault = this._getVaultSessionForPath(path);
      return !!(vault && !pathEquals(path, vault.rootPath));
    },

    async _inspectEncryptedFolder(path) {
      try {
        if (!window.electron?.vault?.inspectFolder) return { success: false, isEncrypted: false };
        return await window.electron.vault.inspectFolder(path);
      } catch (e) {
        return { success: false, isEncrypted: false, error: e?.message || String(e) };
      }
    },

    async _promptSecret(title, placeholder, description, okLabel) {
      return new Promise((resolve) => {
        this._showModal(title, placeholder, '', okLabel || 'Aceptar', (value) => resolve(value), {
          type: 'password',
          description: description || '',
          onCancel: () => resolve('')
        });
      });
    },

    async _requestVaultUnlock(path) {
      const normalized = normalizePath(path);
      const existing = this.state.unlockedVaults?.[normalized];
      if (existing?.sessionId) return existing;

      const passphrase = await this._promptSecret(
        'Desbloquear vault',
        'Clave del vault',
        'La carpeta esta encriptada. Solo LTH OS puede leerla con la clave correcta.',
        'Desbloquear'
      );
      if (!passphrase) return null;

      const result = await window.electron?.vault?.unlockFolder?.(normalized, passphrase);
      if (!result?.success || !result.sessionId) {
        alert('No se pudo desbloquear el vault: ' + (result?.error || 'Clave incorrecta'));
        return null;
      }

      this.state.unlockedVaults = this.state.unlockedVaults || {};
      this.state.unlockedVaults[normalized] = {
        sessionId: result.sessionId,
        rootPath: normalized,
        unlockedAt: Date.now()
      };
      return this.state.unlockedVaults[normalized];
    },

    async _ensureVaultAccess(path) {
      const vault = this._getVaultSessionForPath(path);
      if (vault) return true;
      const info = await this._inspectEncryptedFolder(path);
      if (!info?.isEncrypted) return true;
      return !!(await this._requestVaultUnlock(path));
    },

    async _openEncryptedFolder(path) {
      const unlocked = await this._ensureVaultAccess(path);
      if (!unlocked) return;
      await this.navigate(path);
    },

    async _encryptFolder(path) {
      const folderName = this.basename(path);
      const normalizedPath = normalizePath(path);
      const firstPass = await this._promptSecret(
        'Encriptar carpeta',
        'Clave nueva',
        'Windows vera esta carpeta cifrada. Guarda la clave: si la pierdes, no podremos recuperarla.',
        'Siguiente'
      );
      if (!firstPass) return;
      if (firstPass.length < 4) {
        alert('La clave debe tener al menos 4 caracteres.');
        return;
      }

      const secondPass = await this._promptSecret(
        'Confirmar clave',
        'Repite la clave',
        'Confirma la clave del vault para encriptar la carpeta.',
        'Encriptar'
      );
      if (!secondPass) return;
      if (firstPass !== secondPass) {
        alert('Las claves no coinciden.');
        return;
      }

      const result = await window.electron?.vault?.encryptFolder?.(path, firstPass);
      if (!result?.success) {
        alert('No se pudo encriptar la carpeta: ' + (result?.error || 'Error desconocido'));
        return;
      }

      if (this.state.unlockedVaults?.[normalizedPath]) {
        delete this.state.unlockedVaults[normalizedPath];
      }

      const unlocked = await window.electron?.vault?.unlockFolder?.(normalizedPath, firstPass);
      if (unlocked?.success && unlocked.sessionId) {
        this.state.unlockedVaults = this.state.unlockedVaults || {};
        this.state.unlockedVaults[normalizedPath] = {
          sessionId: unlocked.sessionId,
          rootPath: normalizedPath,
          unlockedAt: Date.now()
        };
      }

      await this._loadDir(this.state.currentPath);
      const statusEl = document.getElementById('lfStatus');
      if (statusEl) {
        const previous = statusEl.textContent || 'Listo';
        const message = 'Vault listo: ' + folderName;
        statusEl.textContent = message;
        if (this._statusTimer) clearTimeout(this._statusTimer);
        this._statusTimer = setTimeout(() => {
          if (statusEl.textContent === message) statusEl.textContent = previous;
        }, 4200);
      }
    },

    _getFolderColors() {
      if (this._folderColorsCache && typeof this._folderColorsCache === 'object') {
        return this._folderColorsCache;
      }
      try {
        this._folderColorsCache = JSON.parse(localStorage.getItem('lth_folder_colors') || '{}');
      } catch(e) {
        this._folderColorsCache = {};
      }
      return this._folderColorsCache;
    },

    async _loadFolderColors() {
      try {
        if (window.electron?.fs) {
          const exists = await window.electron.fs.itemExists(getFolderColorsPath());
          if (exists?.exists === true) {
            const result = await window.electron.fs.readFile(getFolderColorsPath());
            const parsed = JSON.parse(result?.content || '{}');
            this._folderColorsCache = parsed && typeof parsed === 'object' ? parsed : {};
            localStorage.setItem('lth_folder_colors', JSON.stringify(this._folderColorsCache));
            return this._folderColorsCache;
          }
        }
      } catch(e) {}

      this._getFolderColors();
      await this._saveFolderColorsToDisk();
      return this._folderColorsCache;
    },

    async _saveFolderColorsToDisk() {
      if (!window.electron?.fs) return;
      try {
        await window.electron.fs.createFolder(getFilesDataFolder());
        await window.electron.fs.writeFile(
          getFolderColorsPath(),
          JSON.stringify(this._getFolderColors(), null, 2)
        );
      } catch(e) {}
    },

    async fsOpenFile(path) {
      try {
        const ext = path.split('.').pop().toLowerCase();
        const vault = this._getVaultSessionForPath(path);

        if (vault) {
          const imgExts = ['png','jpg','jpeg','gif','webp','svg','bmp','ico'];
          if (imgExts.includes(ext)) {
            return this._openImageViewer(path);
          }
          if (ext === 'pdf') {
            return this._openPdfViewer(path);
          }
          return this._openCodeViewer(path, ext, { readOnlyVault: true });
        }

        // ── Archivos HTML → abrir en el Navegador del OS ──────
        if (ext === 'html' || ext === 'htm' || ext === 'js' || ext === 'py' || ext === 'css' || ext === 'json') {
          return this._openInLthProg(path);
        }

        // ── Archivos de código/texto → visor interno ──────────
        const codeExts = ['css','json','txt','md','ts','jsx','tsx','xml','csv','php','java','c','cpp','h','sh','bat','env','gitignore','sql'];
        if (codeExts.includes(ext)) {
          return this._openCodeViewer(path, ext);
        }

        // ── Imágenes → visor de imagen ────────────────────────
        const imgExts = ['png','jpg','jpeg','gif','webp','svg','bmp','ico'];
        if (imgExts.includes(ext)) {
          return this._openImageViewer(path);
        }

        // ── Todo lo demás → app nativa de Windows ─────────────
        if (ext === 'pdf') {
          return this._openPdfViewer(path);
        }
        if (window.electron?.shell?.openPath) {
          return await window.electron.shell.openPath(path);
        }
        return { success: true };
      } catch(e) { return { error: e.message }; }
    },

    // ── Abrir HTML en el Navegador del OS ─────────────────────
    async _openInLthProg(path) {
      try {
        let fileContent = '';
        try {
          fileContent = await this.fsReadTextFile(path);
        } catch (e) {}

        const tryOpenInProg = async () => {
          const prog = window.LTH_APPS?.['lth-prog'];
          if (!prog || typeof prog.openExternalFile !== 'function') return false;
          try {
            const result = await prog.openExternalFile(path, {
              content: fileContent,
              from: 'lth-files',
              includeSiblingFiles: false
            });
            return !!result?.success;
          } catch (e) {
            return false;
          }
        };

        window._lthProgPendingOpen = { path, content: fileContent, source: 'lth-files' };
        if (typeof openApp === 'function') {
          await openApp('lth-prog');
        }

        const startedAt = Date.now();
        while (Date.now() - startedAt < 6000) {
          if (await tryOpenInProg()) {
            if (window._lthProgPendingOpen?.path === path) window._lthProgPendingOpen = null;
            return { success: true };
          }
          await new Promise(resolve => setTimeout(resolve, 120));
        }

        const ext = String(path).split('.').pop().toLowerCase();
        return this._openCodeViewer(path, ext);
      } catch (e) {
        return { error: e.message || String(e) };
      }
    },

    async _openInBrowser(path) {
      try {
        const url = 'file:///' + path.replace(/\\/g, '/');

        // Helper: esperar a que navigateTo esté disponible (máx 4s)
        function waitForNavigateTo(ms, interval) {
          ms = ms || 4000; interval = interval || 80;
          return new Promise(function(resolve) {
            var start = Date.now();
            (function check() {
              var app = window.LTH_APPS && window.LTH_APPS['browser'];
              if (app && typeof app.navigateTo === 'function') return resolve(app);
              if (Date.now() - start >= ms) return resolve(null);
              setTimeout(check, interval);
            })();
          });
        }

        // ── Caso 1: navigateTo ya disponible (browser abierto y renderizado) ──
        var browserApp = window.LTH_APPS && window.LTH_APPS['browser'];
        if (browserApp && typeof browserApp.navigateTo === 'function') {
          browserApp.navigateTo(url);
          return { success: true };
        }

        // ── Caso 2: browser registrado pero no renderizado aún ──
        // Guardar URL pendiente ANTES de abrir el browser
        window._lthBrowserPendingUrl = url;

        var opened = false;

        // Método A: AppLoader.openApp si existe (más seguro - nunca confunde el path con un app ID)
        if (window.AppLoader && typeof window.AppLoader.openApp === 'function') {
          try { window.AppLoader.openApp('browser'); opened = true; } catch(e) {}
        }

        // Método B: Buscar el ícono del Navegador en el dock y clickearlo
        if (!opened) {
          var dockIcons = document.querySelectorAll('[data-app-id="browser"], [data-id="browser"]');
          if (dockIcons.length > 0) {
            dockIcons[0].click();
            opened = true;
          }
        }

        // Método C: openApp global con id fijo 'browser' (nunca con path del archivo)
        if (!opened && typeof openApp === 'function') {
          try { openApp('browser'); opened = true; } catch(e) {}
        }

        if (opened) {
          var app = await waitForNavigateTo(4000);
          if (app && typeof app.navigateTo === 'function') {
            window._lthBrowserPendingUrl = null;
            app.navigateTo(url);
          }
          return { success: true };
        }

        // ── Fallback: abrir con Windows nativo ──
        if (window.electron && window.electron.shell && window.electron.shell.openPath) {
          return await window.electron.shell.openPath(path);
        }

        return { success: true };
      } catch(e) { return { error: e.message }; }
    },

    // ── Visor de código interno ────────────────────────────────
    async _openCodeViewer(path, ext, options = {}) {
      let fileContent = '';
      const readOnlyVault = !!options.readOnlyVault;
      try {
        fileContent = await this.fsReadTextFile(path);
      } catch(e) { fileContent = 'Error al leer archivo: ' + e.message; }

      const fileName = path.split('\\').pop();
      const langColors = { js:'#f7df1e', css:'#264de4', html:'#e34c26', json:'#4ade80', ts:'#3178c6', md:'#e2e8f0', txt:'#94a3b8', py:'#3b82f6', sql:'#fb923c' };
      const badgeColor = langColors[ext] || '#64748b';

      // Escapar HTML para mostrar
      const escaped = fileContent.toString()
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;');

      // Crear modal de visor
      let modal = document.getElementById('lfCodeModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'lfCodeModal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:24px;';
        document.body.appendChild(modal);
      }

      modal.innerHTML =
        '<div style="background:#0d1117;border:1px solid #30363d;border-radius:14px;width:100%;max-width:860px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,0.9);">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #21262d;flex-shrink:0;">' +
            '<div style="display:flex;align-items:center;gap:10px;">' +
              '<span style="background:' + badgeColor + ';color:#000;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;text-transform:uppercase;">' + ext + '</span>' +
              '<span style="color:#e2e8f0;font-size:14px;font-weight:600;">' + fileName + '</span>' +
            '</div>' +
            '<button id="lfCodeModalClose" style="background:none;border:none;color:#7d8590;cursor:pointer;font-size:20px;line-height:1;padding:4px 8px;border-radius:6px;" title="Cerrar">&#10005;</button>' +
          '</div>' +
          '<div style="overflow:auto;flex:1;padding:0;">' +
            '<pre style="margin:0;padding:20px;font-family:Consolas,Monaco,monospace;font-size:13px;line-height:1.6;color:#e2e8f0;tab-size:2;white-space:pre-wrap;word-break:break-all;">' +
              escaped +
            '</pre>' +
          '</div>' +
          '<div style="display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid #21262d;flex-shrink:0;">' +
            '<button id="lfCodeModalCopy" style="background:#21262d;color:#e2e8f0;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;">Copiar</button>' +
            '<button id="lfCodeModalNative" style="background:linear-gradient(135deg,#1f6feb,#388bfd);color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;' + (readOnlyVault ? 'opacity:0.5;pointer-events:none;' : '') + '">' + (readOnlyVault ? 'Solo lectura' : 'Abrir con editor') + '</button>' +
          '</div>' +
        '</div>';

      modal.style.display = 'flex';

      modal.querySelector('#lfCodeModalClose').onclick = () => { modal.style.display = 'none'; };
      modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
      modal.querySelector('#lfCodeModalCopy').onclick = () => {
        navigator.clipboard.writeText(fileContent).catch(() => {});
        const btn = modal.querySelector('#lfCodeModalCopy');
        btn.textContent = '¡Copiado!'; btn.style.background = '#166534';
        setTimeout(() => { btn.textContent = 'Copiar'; btn.style.background = '#21262d'; }, 1500);
      };
      modal.querySelector('#lfCodeModalNative').onclick = async () => {
        if (readOnlyVault) return;
        if (window.electron?.shell?.openPath) await window.electron.shell.openPath(path);
        modal.style.display = 'none';
      };

      return { success: true };
    },

    // ── Visor de imagen ────────────────────────────────────────
    async _openImageViewer(path) {
      const ext = String(path).split('.').pop().toLowerCase();
      const vault = this._getVaultSessionForPath(path);
      const readOnlyVault = !!vault;
      const mimeTypes = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        svg: 'image/svg+xml',
        bmp: 'image/bmp',
        ico: 'image/x-icon'
      };
      let url = 'file:///' + path.replace(/\\/g, '/');
      if (vault) {
        const binary = await this.fsReadBinaryFile(path);
        if (!binary?.base64) {
          return { error: binary?.error || 'No se pudo leer la imagen del vault' };
        }
        url = 'data:' + (mimeTypes[ext] || 'application/octet-stream') + ';base64,' + binary.base64;
      }
      const fileName = path.split('\\').pop();

      let modal = document.getElementById('lfImgModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'lfImgModal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.88);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;padding:24px;';
        document.body.appendChild(modal);
      }

      modal.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:space-between;width:100%;max-width:900px;">' +
          '<span style="color:#e2e8f0;font-size:14px;font-weight:600;">' + fileName + '</span>' +
          '<div style="display:flex;gap:8px;">' +
            '<button id="lfImgNative" style="background:#21262d;color:#e2e8f0;border:none;padding:7px 14px;border-radius:8px;cursor:pointer;font-size:13px;' + (readOnlyVault ? 'opacity:0.5;pointer-events:none;' : '') + '">' + (readOnlyVault ? 'Solo lectura' : 'Abrir con visor') + '</button>' +
            '<button id="lfImgClose" style="background:none;border:none;color:#7d8590;cursor:pointer;font-size:20px;padding:4px 8px;">&#10005;</button>' +
          '</div>' +
        '</div>' +
        '<img src="' + url + '" style="max-width:100%;max-height:70vh;border-radius:10px;box-shadow:0 8px 40px rgba(0,0,0,0.8);object-fit:contain;" onerror="this.src=\'\';this.alt=\'No se pudo cargar la imagen\';">' +
        '<span style="color:#7d8590;font-size:12px;">' + path + '</span>';

      modal.style.display = 'flex';

      modal.querySelector('#lfImgClose').onclick = () => { modal.style.display = 'none'; };
      modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
      modal.querySelector('#lfImgNative').onclick = async () => {
        if (readOnlyVault) return;
        if (window.electron?.shell?.openPath) await window.electron.shell.openPath(path);
        modal.style.display = 'none';
      };

      return { success: true };
    },

    // ── Demo contents cuando no hay Electron ─────────────────
    async _openPdfViewer(path) {
      const vault = this._getVaultSessionForPath(path);
      const readOnlyVault = !!vault;
      let url = 'file:///' + path.replace(/\\/g, '/');

      if (vault) {
        const binary = await this.fsReadBinaryFile(path);
        if (!binary?.base64) {
          return { error: binary?.error || 'No se pudo leer el PDF del vault' };
        }
        url = 'data:application/pdf;base64,' + binary.base64;
      }

      const fileName = path.split('\\').pop();
      let modal = document.getElementById('lfPdfModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'lfPdfModal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(3,6,12,0.92);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;';
        document.body.appendChild(modal);
      }

      modal.innerHTML =
        '<div style="width:min(1100px,96vw);height:min(860px,92vh);background:#0d1117;border:1px solid #30363d;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(0,0,0,0.85);">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #21262d;background:#111827;flex-shrink:0;">' +
            '<div style="display:flex;align-items:center;gap:10px;min-width:0;">' +
              '<span style="background:#f87171;color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;">PDF</span>' +
              '<span style="color:#e5e7eb;font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + fileName + '</span>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:8px;">' +
              '<button id="lfPdfNative" style="background:#1f2937;color:#e5e7eb;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:13px;' + (readOnlyVault ? 'opacity:0.5;pointer-events:none;' : '') + '">' + (readOnlyVault ? 'Solo lectura' : 'Abrir con Windows') + '</button>' +
              '<button id="lfPdfClose" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:20px;padding:4px 8px;line-height:1;">&#10005;</button>' +
            '</div>' +
          '</div>' +
          '<div style="flex:1;min-height:0;background:#0b1220;">' +
            '<iframe src="' + url + '" style="width:100%;height:100%;border:none;background:#0b1220;" title="' + fileName.replace(/"/g, '&quot;') + '"></iframe>' +
          '</div>' +
        '</div>';

      modal.style.display = 'flex';

      const close = () => { modal.style.display = 'none'; };
      modal.querySelector('#lfPdfClose').onclick = close;
      modal.onclick = (e) => { if (e.target === modal) close(); };
      modal.querySelector('#lfPdfNative').onclick = async () => {
        if (readOnlyVault) return;
        if (window.electron?.shell?.openPath) await window.electron.shell.openPath(path);
        close();
      };

      return { success: true };
    },

    _demoContents(path) {
      if (this.isRoot(path)) {
        return [
          { name: 'Descargas', isDirectory: true, size: 0, mtime: new Date() },
          { name: 'Proyectos', isDirectory: true, size: 0, mtime: new Date() },
          { name: 'README.txt', isDirectory: false, size: 1024, mtime: new Date() },
        ];
      }
      if (pathEquals(path, this.state.defaultPath)) {
        return [
          { name: 'archivo1.zip', isDirectory: false, size: 5242880, mtime: new Date() },
          { name: 'foto.png',     isDirectory: false, size: 204800,  mtime: new Date() },
        ];
      }
      return [];
    },

    // ── Iconos por tipo ───────────────────────────────────────
    iconForItem(item) {
      if (item.isDirectory) {
        if (item.isEncryptedVault) {
          return '<svg viewBox="0 0 56 48" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<defs>' +
              '<linearGradient id="vaultGold" x1="0" y1="0" x2="56" y2="48" gradientUnits="userSpaceOnUse">' +
                '<stop offset="0%" stop-color="#facc15" stop-opacity="0.30"/>' +
                '<stop offset="100%" stop-color="#f59e0b" stop-opacity="0.14"/>' +
              '</linearGradient>' +
              '<filter id="vaultGlow">' +
                '<feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#fbbf24" flood-opacity="0.9"/>' +
                '<feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#f59e0b" flood-opacity="0.45"/>' +
              '</filter>' +
            '</defs>' +
            '<g filter="url(#vaultGlow)">' +
              '<rect x="2" y="12" width="52" height="34" rx="7" fill="url(#vaultGold)"/>' +
              '<rect x="2" y="12" width="52" height="34" rx="7" fill="none" stroke="#fbbf24" stroke-width="1.5" opacity="0.92"/>' +
              '<path d="M3 18Q3 12 9 12H21l5-5H9Q3 7 3 13Z" fill="#facc15" opacity="0.46"/>' +
              '<rect x="20" y="20" width="16" height="13" rx="3" fill="#120d04" stroke="#fbbf24" stroke-width="1.5"/>' +
              '<path d="M24 20v-3a4 4 0 018 0v3" stroke="#fde68a" stroke-width="1.8" stroke-linecap="round"/>' +
              '<circle cx="28" cy="27" r="1.6" fill="#fde68a"/>' +
            '</g>' +
          '</svg>';
        }
        const name = item.name.toLowerCase();
        // Carpeta Descargas — ícono con flecha
        if (name === 'descargas' || name === 'downloads') {
          return '<svg viewBox="0 0 56 48" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<defs>' +
              '<linearGradient id="fdl" x1="0" y1="0" x2="56" y2="48" gradientUnits="userSpaceOnUse">' +
                '<stop offset="0%" stop-color="#00f5ff" stop-opacity="0.35"/>' +
                '<stop offset="100%" stop-color="#0080ff" stop-opacity="0.18"/>' +
              '</linearGradient>' +
              '<filter id="fdlsh">' +
                '<feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#00f5ff" flood-opacity="0.9"/>' +
                '<feDropShadow dx="0" dy="5" stdDeviation="6" flood-color="#00d4ff" flood-opacity="0.55"/>' +
              '</filter>' +
            '</defs>' +
            '<g filter="url(#fdlsh)">' +
              '<rect x="1" y="11" width="54" height="35" rx="7" fill="url(#fdl)"/>' +
              '<rect x="1" y="11" width="54" height="35" rx="7" fill="none" stroke="#00f5ff" stroke-width="1.5" opacity="0.85"/>' +
              '<path d="M2 17 Q2 11 8 11 H22 L27 6 H8 Q2 6 2 12Z" fill="#00f5ff" opacity="0.55"/>' +
              '<rect x="2" y="11" width="52" height="4" fill="white" opacity="0.07"/>' +
              '<rect x="8" y="15" width="18" height="1.5" rx="1" fill="#00f5ff" opacity="0.5"/>' +
              '<line x1="28" y1="22" x2="28" y2="33" stroke="#00f5ff" stroke-width="2.2" stroke-linecap="round"/>' +
              '<polyline points="22,29 28,36 34,29" fill="none" stroke="#00f5ff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
            '</g>' +
          '</svg>';
        }
        // Leer color guardado o calcular por hash
        var _savedColors = this._getFolderColors();
        var neonPalettes = [
          { a: '#00f5ff', b: '#0055ff', glow: '#00d4ff' },
          { a: '#ff2d78', b: '#cc0060', glow: '#ff0066' },
          { a: '#39ff14', b: '#00cc44', glow: '#00ff55' },
          { a: '#ff9500', b: '#ff3300', glow: '#ff6600' },
          { a: '#ffef00', b: '#ffaa00', glow: '#ffe000' },
          { a: '#cc00ff', b: '#7700ee', glow: '#bb00ff' },
          { a: '#ff6ec7', b: '#ff00aa', glow: '#ff44cc' },
          { a: '#00ffaa', b: '#00cc88', glow: '#00ffbb' },
        ];
        var hash = 0;
        for (var ci = 0; ci < item.name.length; ci++) hash = (hash * 31 + item.name.charCodeAt(ci)) & 0xffff;
        var savedPalStr = _savedColors[item.name];
        var pal;
        if (savedPalStr) {
          pal = { a: savedPalStr, b: savedPalStr, glow: savedPalStr };
        } else {
          pal = neonPalettes[hash % neonPalettes.length];
        }
        var uid = 'f' + Math.abs(hash % 9999);
        return '<svg viewBox="0 0 56 48" fill="none" xmlns="http://www.w3.org/2000/svg">' +
          '<defs>' +
            '<filter id="fsh_' + uid + '">' +
              '<feDropShadow dx="0" dy="0" stdDeviation="2.5" flood-color="' + pal.glow + '" flood-opacity="0.95"/>' +
              '<feDropShadow dx="0" dy="4" stdDeviation="7" flood-color="' + pal.glow + '" flood-opacity="0.5"/>' +
            '</filter>' +
          '</defs>' +
          '<g filter="url(#fsh_' + uid + ')">' +
            // Cuerpo principal: solo borde neón, fondo semi-transparente
            '<rect x="2" y="12" width="52" height="34" rx="7" fill="' + pal.a + '" fill-opacity="0.08"/>' +
            '<rect x="2" y="12" width="52" height="34" rx="7" fill="none" stroke="' + pal.a + '" stroke-width="1.6"/>' +
            // Solapa superior
            '<path d="M3 18 Q3 12 9 12 H22 L26 7 H9 Q3 7 3 13Z" fill="' + pal.a + '" fill-opacity="0.22"/>' +
            '<path d="M3 18 Q3 12 9 12 H22 L26 7 H9 Q3 7 3 13Z" fill="none" stroke="' + pal.a + '" stroke-width="1.4"/>' +
            // Brillo interior sutil
            '<rect x="3" y="12" width="50" height="5" rx="3" fill="white" fill-opacity="0.06"/>' +
            // Líneas internas de documentos
            '<line x1="11" y1="26" x2="45" y2="26" stroke="' + pal.a + '" stroke-width="0.8" stroke-opacity="0.35"/>' +
            '<line x1="11" y1="31" x2="39" y2="31" stroke="' + pal.a + '" stroke-width="0.8" stroke-opacity="0.28"/>' +
            '<line x1="11" y1="36" x2="42" y2="36" stroke="' + pal.a + '" stroke-width="0.8" stroke-opacity="0.22"/>' +
          '</g>' +
        '</svg>';
      }
      const ext = item.name.split('.').pop().toLowerCase();
      // Helper: genera ícono de archivo con badge de color
      function fileIcon(color, glyph) {
        return '<svg viewBox="0 0 44 52" fill="none" xmlns="http://www.w3.org/2000/svg">' +
          '<defs>' +
            '<linearGradient id="fi_' + ext + '" x1="0" y1="0" x2="44" y2="52" gradientUnits="userSpaceOnUse">' +
              '<stop offset="0%" stop-color="' + color + '" stop-opacity="0.25"/>' +
              '<stop offset="100%" stop-color="' + color + '" stop-opacity="0.08"/>' +
            '</linearGradient>' +
          '</defs>' +
          '<path d="M6 2 H28 L42 16 V48 Q42 50 40 50 H6 Q4 50 4 48 V4 Q4 2 6 2Z" fill="url(#fi_' + ext + ')" stroke="' + color + '" stroke-width="1.2" stroke-opacity="0.6"/>' +
          '<path d="M28 2 L28 16 L42 16" fill="none" stroke="' + color + '" stroke-width="1.2" stroke-opacity="0.4"/>' +
          '<rect x="4" y="30" width="36" height="14" rx="3" fill="' + color + '" opacity="0.85"/>' +
          '<text x="22" y="41" text-anchor="middle" font-size="9" font-weight="700" font-family="monospace" fill="white" letter-spacing="0.5">' + glyph + '</text>' +
        '</svg>';
      }
      const icons = {
        js:   fileIcon('#f7df1e', 'JS'),
        ts:   fileIcon('#3b82f6', 'TS'),
        html: fileIcon('#f97316', 'HTML'),
        htm:  fileIcon('#f97316', 'HTML'),
        css:  fileIcon('#818cf8', 'CSS'),
        png:  fileIcon('#4ade80', 'IMG'),
        jpg:  fileIcon('#4ade80', 'IMG'),
        jpeg: fileIcon('#4ade80', 'IMG'),
        gif:  fileIcon('#4ade80', 'GIF'),
        webp: fileIcon('#4ade80', 'IMG'),
        svg:  fileIcon('#a78bfa', 'SVG'),
        zip:  fileIcon('#fb923c', 'ZIP'),
        rar:  fileIcon('#fb923c', 'RAR'),
        pdf:  fileIcon('#f87171', 'PDF'),
        txt:  fileIcon('#94a3b8', 'TXT'),
        md:   fileIcon('#e2e8f0', 'MD'),
        json: fileIcon('#34d399', 'JSON'),
        sql:  fileIcon('#f59e0b', 'SQL'),
        py:   fileIcon('#60a5fa', 'PY'),
        php:  fileIcon('#a855f7', 'PHP'),
        sh:   fileIcon('#6ee7b7', 'SH'),
        bat:  fileIcon('#64748b', 'BAT'),
      };
      return icons[ext] || fileIcon('#475569', ext.toUpperCase().slice(0,3) || 'FILE');
    },

    colorForItem(item) {
      if (item.isDirectory) {
        if (item.isEncryptedVault) return '#fbbf24';
        return '#e2e8f0';
      }
      const ext = item.name.split('.').pop().toLowerCase();
      const colors = { js:'#f7df1e', ts:'#3178c6', html:'#e34c26', css:'#264de4', png:'#4ade80', jpg:'#4ade80', zip:'#fb923c', pdf:'#f87171' };
      return colors[ext] || '#64748b';
    },

    formatSize(bytes) {
      if (!bytes) return '—';
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1048576) return (bytes/1024).toFixed(1) + ' KB';
      return (bytes/1048576).toFixed(1) + ' MB';
    },

    formatDate(d) {
      if (!d) return '—';
      const dt = new Date(d);
      return dt.toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' });
    },

    // ── Render principal ──────────────────────────────────────
    render(container) {
      container.innerHTML = '';
      container.style.cssText = 'height:100%;display:flex;flex-direction:column;overflow:hidden;background:#0d1117;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';

      container.innerHTML = `
<style>
  .lf-root { display:flex; flex-direction:column; height:100%; background:#0d1117; color:#e2e8f0; }

  /* ── Toolbar ── */
  .lf-toolbar {
    display:flex; align-items:center; gap:8px; padding:10px 16px;
    background:#161b22; border-bottom:1px solid #21262d;
    flex-shrink:0;
  }
  .lf-nav-btn {
    width:32px; height:32px; border-radius:8px; border:none; cursor:pointer;
    background:transparent; color:#8b949e; display:flex; align-items:center; justify-content:center;
    transition:background 0.15s, color 0.15s;
  }
  .lf-nav-btn:hover:not(:disabled) { background:#21262d; color:#e2e8f0; }
  .lf-nav-btn:disabled { opacity:0.3; cursor:not-allowed; }
  .lf-breadcrumb {
    flex:1; display:flex; align-items:center; gap:4px; overflow:hidden;
    background:#0d1117; border-radius:8px; padding:6px 12px; min-width:0;
    border:1px solid #21262d; font-size:13px;
  }
  .lf-crumb { color:#7d8590; cursor:pointer; white-space:nowrap; transition:color 0.15s; }
  .lf-crumb:hover { color:#58a6ff; }
  .lf-crumb.active { color:#e2e8f0; cursor:default; }
  .lf-crumb-sep { color:#30363d; flex-shrink:0; }
  .lf-view-btn {
    width:32px; height:32px; border-radius:8px; border:none; cursor:pointer;
    background:transparent; color:#8b949e; display:flex; align-items:center; justify-content:center;
    transition:all 0.15s;
  }
  .lf-view-btn.active { background:#21262d; color:#58a6ff; }
  .lf-view-btn:hover { background:#21262d; color:#e2e8f0; }
  .lf-new-btn {
    display:flex; align-items:center; gap:6px; padding:0 12px; height:32px;
    background:linear-gradient(135deg,#1f6feb,#388bfd); color:#fff; border:none;
    border-radius:8px; cursor:pointer; font-size:13px; font-weight:500;
    transition:opacity 0.15s;
  }
  .lf-new-btn:hover { opacity:0.85; }

  /* ── Sidebar + content ── */
  .lf-body { display:flex; flex:1; overflow:hidden; }
  .lf-sidebar {
    width:180px; flex-shrink:0; background:#161b22; border-right:1px solid #21262d;
    padding:12px 8px; display:flex; flex-direction:column; gap:4px;
  }
  .lf-side-label { font-size:11px; color:#7d8590; padding:4px 8px; text-transform:uppercase; letter-spacing:0.06em; font-weight:600; }
  .lf-side-item {
    display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:8px;
    cursor:pointer; font-size:13px; color:#8b949e; transition:all 0.15s;
  }
  .lf-side-item:hover { background:#21262d; color:#e2e8f0; }
  .lf-side-item.active { background:#1f3a5f; color:#58a6ff; }
  .lf-side-icon { width:16px; height:16px; flex-shrink:0; }

  /* Acceso a la nube privada (LTH Cloud) */
  .lf-side-cloud {
    background:linear-gradient(135deg,rgba(31,111,235,.16),rgba(163,113,247,.13));
    border:1px solid rgba(148,186,255,.2); color:#c9d4e2;
  }
  .lf-side-cloud:hover { background:linear-gradient(135deg,rgba(31,111,235,.3),rgba(163,113,247,.22)); color:#fff; }
  .lf-side-cloud.drag-over { border-color:#58a6ff; box-shadow:0 0 0 2px rgba(88,166,255,.35); color:#fff; }
  .lf-cloud-note { padding:6px 10px 0; font-size:10.5px; line-height:1.4; color:#6e7681; }

  /* ── Área de archivos ── */
  .lf-content { flex:1; overflow-y:auto; padding:16px; }
  .lf-content::-webkit-scrollbar { width:6px; }
  .lf-content::-webkit-scrollbar-track { background:transparent; }
  .lf-content::-webkit-scrollbar-thumb { background:#30363d; border-radius:3px; }

  /* Vista grid */
  .lf-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(100px,1fr)); gap:12px; }
  .lf-item-grid {
    display:flex; flex-direction:column; align-items:center; gap:8px; padding:12px 8px;
    border-radius:10px; cursor:pointer; transition:background 0.15s; position:relative;
    border:2px solid transparent;
  }
  .lf-item-grid:hover { background:#161b22; }
  .lf-item-grid[draggable='true']:hover { cursor:grab; }
  .lf-item-grid.selected { background:#1f3a5f; border-color:#1f6feb; }
  .lf-item-icon { width:56px; height:48px; display:flex; align-items:center; justify-content:center; }
  .lf-item-icon svg { width:100%; height:100%; filter:drop-shadow(0 2px 8px rgba(59,130,246,0.0)); transition:filter 0.2s; }
  .lf-item-grid:hover .lf-item-icon svg { filter:brightness(1.15) drop-shadow(0 0 10px currentColor); }
  .lf-item-name {
    font-size:12px; color:#e2e8f0; text-align:center; word-break:break-all;
    line-height:1.3; max-height:2.6em; overflow:hidden;
  }

  /* Vista lista */
  .lf-list { display:flex; flex-direction:column; gap:2px; }
  .lf-list-header {
    display:grid; grid-template-columns:1fr 80px 120px; gap:12px;
    padding:6px 12px; font-size:11px; color:#7d8590; text-transform:uppercase;
    letter-spacing:0.05em; font-weight:600; border-bottom:1px solid #21262d;
    margin-bottom:4px;
  }
  .lf-item-list {
    display:grid; grid-template-columns:1fr 80px 120px; gap:12px;
    padding:8px 12px; border-radius:8px; cursor:pointer;
    transition:background 0.12s; align-items:center; border:2px solid transparent;
  }
  .lf-item-list:hover { background:#161b22; }
  .lf-item-list[draggable='true']:hover { cursor:grab; }
  .lf-item-list.selected { background:#1f3a5f; border-color:#1f6feb; }
  .lf-item-list-name { display:flex; align-items:center; gap:10px; font-size:13px; color:#e2e8f0; min-width:0; }
  .lf-item-list-name svg { width:18px; height:18px; flex-shrink:0; }
  .lf-item-list-name span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .lf-item-size { font-size:12px; color:#7d8590; }
  .lf-item-date { font-size:12px; color:#7d8590; }

  /* Estado vacío / error / cargando */
  .lf-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; height:200px; gap:12px; color:#7d8590; }
  .lf-empty svg { width:48px; height:48px; opacity:0.4; }
  .lf-empty p { font-size:14px; margin:0; }

  /* ── Menú contextual ── */
  .lf-ctx {
    position:fixed; z-index:99999; background:rgba(22,27,34,0.96);
    backdrop-filter:blur(20px); border:1px solid #30363d; border-radius:10px;
    padding:6px; min-width:170px; box-shadow:0 8px 32px rgba(0,0,0,0.7);
    display:none; flex-direction:column; gap:2px;
    animation:lfCtxIn 0.12s ease;
  }
  @keyframes lfCtxIn { from{opacity:0;transform:scale(0.93)} to{opacity:1;transform:scale(1)} }
  .lf-ctx.visible { display:flex; }
  .lf-ctx-item {
    display:flex; align-items:center; gap:10px; padding:8px 12px; border-radius:7px;
    cursor:pointer; font-size:13px; color:#e2e8f0; transition:background 0.12s;
  }
  .lf-ctx-item:hover { background:#21262d; }
  .lf-ctx-item.danger { color:#f87171; }
  .lf-ctx-item.danger:hover { background:rgba(248,113,113,0.12); }
  .lf-ctx-item svg { width:15px; height:15px; flex-shrink:0; opacity:0.8; }
  .lf-ctx-sep { height:1px; background:#21262d; margin:3px 8px; }

  /* ── Modal ── */
  .lf-modal-overlay {
    position:absolute; inset:0; background:rgba(0,0,0,0.7); z-index:9999;
    display:none; align-items:center; justify-content:center;
    backdrop-filter:blur(4px);
  }
  .lf-modal-overlay.visible { display:flex; }
  .lf-modal {
    background:#161b22; border:1px solid #30363d; border-radius:14px;
    padding:24px; min-width:320px; display:flex; flex-direction:column; gap:16px;
    box-shadow:0 20px 60px rgba(0,0,0,0.8);
  }
  .lf-modal h3 { margin:0; font-size:16px; color:#e2e8f0; }
  .lf-modal input {
    padding:10px 14px; background:#0d1117; border:1px solid #30363d; border-radius:8px;
    color:#e2e8f0; font-size:14px; outline:none; transition:border-color 0.15s;
  }
  .lf-modal input:focus { border-color:#1f6feb; }
  .lf-modal-actions { display:flex; gap:8px; justify-content:flex-end; }
  .lf-btn { padding:8px 16px; border-radius:8px; border:none; cursor:pointer; font-size:13px; font-weight:500; transition:opacity 0.15s; }
  .lf-btn-primary { background:linear-gradient(135deg,#1f6feb,#388bfd); color:#fff; }
  .lf-btn-primary:hover { opacity:0.85; }
  .lf-btn-secondary { background:#21262d; color:#e2e8f0; }
  .lf-btn-secondary:hover { background:#30363d; }
  .lf-btn-danger { background:#b91c1c; color:#fff; }
  .lf-btn-danger:hover { opacity:0.85; }

  /* ── Status bar ── */
  .lf-statusbar {
    display:flex; align-items:center; justify-content:space-between;
    padding:6px 16px; background:#161b22; border-top:1px solid #21262d;
    font-size:11px; color:#7d8590; flex-shrink:0;
  }
</style>

<div class="lf-root" id="lfRoot">

  <!-- Toolbar -->
  <div class="lf-toolbar">
    <button class="lf-nav-btn" id="lfBack" title="Atrás">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
    </button>
    <button class="lf-nav-btn" id="lfForward" title="Adelante">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
    </button>
    <button class="lf-nav-btn" id="lfUp" title="Carpeta superior">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="18 15 12 9 6 15"/></svg>
    </button>

    <div class="lf-breadcrumb" id="lfBreadcrumb"></div>

    <button class="lf-view-btn active" id="lfViewGrid" title="Vista grid">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
    </button>
    <button class="lf-view-btn" id="lfViewList" title="Vista lista">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
    </button>

    <button class="lf-new-btn" id="lfPickRoot" title="Elegir carpeta raíz">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 7h5l2 2h11v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 11v6"/><path d="M9 14h6"/></svg>
      Elegir ruta
    </button>

    <button class="lf-new-btn" id="lfNewFolder">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Nueva carpeta
    </button>
  </div>

  <!-- Body -->
  <div class="lf-body">

    <!-- Sidebar -->
    <div class="lf-sidebar">
      <div class="lf-side-label">Accesos rápidos</div>
      <div class="lf-side-item active" id="lfSideRoot">
        <svg class="lf-side-icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z"/></svg>
        Ruta actual
      </div>
      <div class="lf-side-item" id="lfSideDownloads">
        <svg class="lf-side-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Descargas (default)
      </div>

      <div class="lf-side-label" style="margin-top:14px;">Nube privada</div>
      <div class="lf-side-item lf-side-cloud" id="lfSideCloud" title="Tu propia nube cifrada dentro de esta PC">
        <svg class="lf-side-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A6.5 6.5 0 0 0 5.2 11.2 3.9 3.9 0 0 0 6 19z"/><path d="M12 16V9"/><path d="m9 12 3-3 3 3"/></svg>
        Mi nube LTH
      </div>
      <div class="lf-cloud-note" id="lfCloudNote">Cifrada · se ve desde el telefono con LTH Remote</div>
    </div>

    <!-- Contenido -->
    <div class="lf-content" id="lfContent">
      <div class="lf-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <p>Cargando…</p>
      </div>
    </div>

  </div>

  <!-- Status bar -->
  <div class="lf-statusbar">
    <span id="lfStatus">Listo</span>
    <span id="lfPath" style="color:#30363d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60%;direction:rtl;"></span>
  </div>

  <!-- Menú contextual -->
  <div class="lf-ctx" id="lfCtx">
    <div class="lf-ctx-item" id="lfCtxOpen">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      Abrir
    </div>
    <div class="lf-ctx-item" id="lfCtxDesktop">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8"/><path d="M12 16v4"/></svg>
      Enviar al escritorio
    </div>
    <div class="lf-ctx-item" id="lfCtxCloud">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A6.5 6.5 0 0 0 5.2 11.2 3.9 3.9 0 0 0 6 19z"/><path d="M12 16V9"/><path d="m9 12 3-3 3 3"/></svg>
      Guardar en mi nube
    </div>
    <div class="lf-ctx-item" id="lfCtxRename">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      Renombrar
    </div>
    <div class="lf-ctx-item" id="lfCtxColor" style="display:none;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="13.5" cy="6.5" r="2.5" fill="#ff2d78" stroke="none"/><circle cx="17.5" cy="10.5" r="2.5" fill="#39ff14" stroke="none"/><circle cx="8.5" cy="10.5" r="2.5" fill="#00f5ff" stroke="none"/><circle cx="6.5" cy="14.5" r="2.5" fill="#ffef00" stroke="none"/><path d="M12 21C8 21 3 17 3 12c0-4.97 4.03-9 9-9s9 4.03 9 9" stroke="currentColor"/></svg>
      Diseñar color
    </div>
    <div class="lf-ctx-item" id="lfCtxEncrypt" style="display:none;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><circle cx="12" cy="16" r="1"/></svg>
      Encriptar carpeta
    </div>
    <div class="lf-ctx-sep"></div>
    <div class="lf-ctx-item danger" id="lfCtxDelete">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
      Eliminar
    </div>
  </div>

  <!-- Color Picker Modal para carpetas -->
  <div class="lf-modal-overlay" id="lfColorModal">
    <div class="lf-modal" style="min-width:340px;">
      <h3 id="lfColorModalTitle" style="font-size:14px;">Color de carpeta</h3>
      <div id="lfColorGrid" style="display:grid;grid-template-columns:repeat(8,1fr);gap:10px;padding:8px 0;"></div>
      <div style="display:flex;align-items:center;gap:10px;padding-top:4px;border-top:1px solid #21262d;margin-top:4px;">
        <span style="color:#7d8590;font-size:12px;">Personalizado:</span>
        <input type="color" id="lfColorCustom" value="#00f5ff" style="width:40px;height:32px;border:none;border-radius:6px;cursor:pointer;background:none;padding:0;">
        <button id="lfColorCustomApply" class="lf-btn lf-btn-primary" style="font-size:12px;padding:6px 12px;">Aplicar</button>
      </div>
      <div class="lf-modal-actions">
        <button class="lf-btn lf-btn-secondary" id="lfColorReset">Quitar color</button>
        <button class="lf-btn lf-btn-secondary" id="lfColorCancel">Cancelar</button>
      </div>
    </div>
  </div>

  <!-- Modal -->
  <div class="lf-modal-overlay" id="lfModal">
    <div class="lf-modal">
      <h3 id="lfModalTitle">Nueva carpeta</h3>
      <div id="lfModalNote" style="display:none;color:#7d8590;font-size:12px;line-height:1.5;margin-bottom:10px;"></div>
      <input type="text" id="lfModalInput" placeholder="Nombre…" autocomplete="off">
      <div class="lf-modal-actions">
        <button class="lf-btn lf-btn-secondary" id="lfModalCancel">Cancelar</button>
        <button class="lf-btn lf-btn-primary" id="lfModalOk">Crear</button>
      </div>
    </div>
  </div>

</div>`;

      this._container = container;
      this._initEvents(container);
      this._checkDriveAndStart();
    },

    // ── LTH Cloud: nube privada cifrada dentro de esta PC ─────
    // El modulo se carga bajo demanda (no pesa en el arranque) y toma
    // la ventana completa de Archivos hasta que el usuario vuelve.
    _loadCloudModule() {
      if (window.LTH_MODULES?.cloud) return Promise.resolve(window.LTH_MODULES.cloud);
      if (this._cloudModulePromise) return this._cloudModulePromise;
      this._cloudModulePromise = new Promise((resolve, reject) => {
        const src = 'apps/modulos/lth-cloud.js';
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
          existing.addEventListener('load', () => resolve(window.LTH_MODULES?.cloud));
          existing.addEventListener('error', () => reject(new Error('No se pudo cargar el modulo de nube.')));
          if (window.LTH_MODULES?.cloud) resolve(window.LTH_MODULES.cloud);
          return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve(window.LTH_MODULES?.cloud);
        script.onerror = () => reject(new Error('No se pudo cargar el modulo de nube.'));
        document.head.appendChild(script);
      });
      return this._cloudModulePromise;
    },

    async openCloud() {
      const container = this._container;
      if (!container) return;
      try {
        const cloud = await this._loadCloudModule();
        if (!cloud) throw new Error('El modulo de nube no quedo disponible.');
        container.style.position = 'relative';
        await cloud.mount(container, {
          onExit: () => {
            container.style.position = '';
            this.render(container);
          }
        });
      } catch (error) {
        alert('No se pudo abrir tu nube LTH: ' + (error?.message || error));
      }
    },

    async sendToCloud(targetPath, name) {
      const api = window.electron?.cloud;
      if (!api) {
        alert('Esta version de LTH OS no tiene el modulo de nube cifrada.');
        return;
      }
      const statusEl = document.getElementById('lfStatus');
      if (statusEl) statusEl.textContent = 'Cifrando en tu nube: ' + (name || '');
      const result = await api.importFiles({ paths: [targetPath] });
      if (!result?.success || (result.errors?.length && !result.imported)) {
        const detail = result?.errors?.[0] || result?.error || 'Error desconocido';
        if (statusEl) statusEl.textContent = 'No se pudo subir a la nube';
        alert('No se pudo guardar en tu nube: ' + detail);
        return;
      }
      if (statusEl) statusEl.textContent = `Guardado cifrado en tu nube: ${name || result.imported + ' elemento(s)'}`;
    },

    async _checkDriveAndStart() {
      await this._loadFolderColors();
      const defaultPath = this._getDefaultRootPath();
      const preferredPath = normalizePath(this._loadRootPathPreference()) || defaultPath;

      this.state.defaultPath = defaultPath;
      this.state.rootPath = preferredPath;
      this.state.navRootPath = preferredPath;

      try { await this.fsMkdir(defaultPath); } catch (e) {}
      try { await this.fsMkdir(preferredPath); } catch (e) {}

      this._saveRootPathPreference(preferredPath);
      this.state.history = [preferredPath];
      this.state.historyIndex = 0;
      this.state.currentPath = preferredPath;
      this.navigate(preferredPath);
    },

    async _isDriveAvailable() {
      return true;
    },

    _showDriveOverlay(state) {
      let ov = document.getElementById('lfDriveOverlay');
      if (!ov) {
        ov = document.createElement('div');
        ov.id = 'lfDriveOverlay';
        ov.style.cssText = 'position:absolute;inset:0;z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;background:rgba(13,17,23,0.97);backdrop-filter:blur(8px);font-family:sans-serif;';
        document.getElementById('lfRoot') && document.getElementById('lfRoot').appendChild(ov);
      }
      if (state === 'checking') {
        ov.innerHTML =
          '<div style="width:64px;height:64px;border:3px solid #21262d;border-top-color:#3b82f6;border-radius:50%;animation:lfSpin 0.8s linear infinite;"></div>' +
          '<div style="color:#8b949e;font-size:14px;">Verificando Klave.LTH...</div>' +
          '<style>@keyframes lfSpin{to{transform:rotate(360deg)}}</style>';
      } else {
        ov.innerHTML =
          '<div style="font-size:56px;">&#128268;</div>' +
          '<div style="color:#e2e8f0;font-size:18px;font-weight:600;">Klave.LTH no conectada</div>' +
          '<div style="color:#7d8590;font-size:13px;text-align:center;max-width:280px;line-height:1.6;">' +
            'Conecta tu USB <strong style="color:#58a6ff;">Klave.LTH (F:)</strong><br>' +
            'Se detectara automaticamente.' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
            '<div style="width:8px;height:8px;border-radius:50%;background:#f87171;"></div>' +
            '<span style="color:#f87171;font-size:12px;">Sin conexion</span>' +
          '</div>' +
          '<style>@keyframes lfPulse{0%,100%{opacity:1}50%{opacity:0.5}}</style>';
      }
      ov.style.display = 'flex';
    },

    _hideDriveOverlay() {
      var ov = document.getElementById('lfDriveOverlay');
      if (ov) ov.style.display = 'none';
    },

    // ── Asegurar que exista la carpeta Descargas ──────────────
    async _ensureDownloads() {
      try {
        const target = this.state.defaultPath || this._getDefaultRootPath();
        const stat = await this.fsStat(target);
        if (!stat) await this.fsMkdir(target);
      } catch(e) { /* no bloquear inicio */ }
    },

    // ── Navegar a una ruta ────────────────────────────────────
    async navigate(path) {
      // Proteger salida de la raíz
      if (!this._isInsideRoot(path)) path = this._getNavRootPath();
      path = normalizePath(path);

      const s = this.state;
      // Actualizar historial
      if (s.currentPath !== path) {
        s.history = s.history.slice(0, s.historyIndex + 1);
        s.history.push(path);
        s.historyIndex = s.history.length - 1;
      }
      s.currentPath = path;
      s.selected = null;

      this._updateToolbar();
      this._updateBreadcrumb();
      this._updateSidebar();
      document.getElementById('lfPath').textContent = path;

      await this._loadDir(path);
    },

    async _loadDir(path) {
      const content = document.getElementById('lfContent');
      content.innerHTML = `<div class="lf-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg><p>Cargando…</p></div>`;

      const vaultReady = await this._ensureVaultAccess(path);
      if (!vaultReady) {
        content.innerHTML = `<div class="lf-empty"><svg viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="1.5"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg><p style="color:#fbbf24">Vault bloqueado. Abre la carpeta con su clave.</p></div>`;
        document.getElementById('lfStatus').textContent = 'Vault bloqueado';
        return;
      }

      const items = await this.fsReadDir(path);

      if (items.error) {
        content.innerHTML = `<div class="lf-empty"><svg viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p style="color:#f87171">${items.error}</p></div>`;
        return;
      }

      if (!items.length) {
        content.innerHTML = `<div class="lf-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg><p>Carpeta vacía</p></div>`;
        document.getElementById('lfStatus').textContent = '0 elementos';
        return;
      }

      // Ordenar: carpetas primero, luego archivos
      items.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      document.getElementById('lfStatus').textContent = `${items.length} elemento${items.length !== 1 ? 's' : ''}`;

      if (this.state.view === 'grid') {
        this._renderGrid(content, items, path);
      } else {
        this._renderList(content, items, path);
      }
    },

    _renderGrid(content, items, path) {
      const grid = document.createElement('div');
      grid.className = 'lf-grid';
      items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'lf-item-grid';
        el.dataset.name = item.name;
        el.dataset.isDir = item.isDirectory;
        el.draggable = true;
        el.innerHTML = `
          <div class="lf-item-icon" style="color:${this.colorForItem(item)}">${this.iconForItem(item)}</div>
          <div class="lf-item-name">${item.name}</div>`;
        this._attachItemEvents(el, item, path);
        grid.appendChild(el);
      });
      content.innerHTML = '';
      content.appendChild(grid);
    },

    _renderList(content, items, path) {
      const list = document.createElement('div');
      list.className = 'lf-list';
      list.innerHTML = `<div class="lf-list-header"><span>Nombre</span><span>Tamaño</span><span>Modificado</span></div>`;
      items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'lf-item-list';
        el.dataset.name = item.name;
        el.dataset.isDir = item.isDirectory;
        el.draggable = true;
        el.innerHTML = `
          <div class="lf-item-list-name" style="color:${item.isDirectory ? this.colorForItem(item) : '#e2e8f0'}">
            <svg style="color:${this.colorForItem(item)}">${this.iconForItem(item)}</svg>
            <span>${item.name}</span>
          </div>
          <div class="lf-item-size">${item.isDirectory ? '—' : this.formatSize(item.size)}</div>
          <div class="lf-item-date">${this.formatDate(item.mtime)}</div>`;
        this._attachItemEvents(el, item, path);
        list.appendChild(el);
      });
      content.innerHTML = '';
      content.appendChild(list);
    },

    async _openItem(item, fullPath) {
      try {
        if (item.isDirectory) {
          if (item.isEncryptedVault) await this._openEncryptedFolder(fullPath);
          else await this.navigate(fullPath);
        } else {
          await this.fsOpenFile(fullPath);
        }
      } catch (e) {
        const message = e?.message || String(e) || 'No se pudo abrir el elemento';
        const statusEl = document.getElementById('lfStatus');
        if (statusEl) statusEl.textContent = 'Error al abrir: ' + message;
        alert('No se pudo abrir "' + (item?.name || 'elemento') + '": ' + message);
      }
    },

    _attachItemEvents(el, item, path) {
      const fullPath = this.joinPath(path, item.name);

      // Click simple → seleccionar
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasSelected = this.state.selected?.path === fullPath;
        document.querySelectorAll('.lf-item-grid.selected, .lf-item-list.selected').forEach(x => x.classList.remove('selected'));
        el.classList.add('selected');
        this.state.selected = { item, path: fullPath };

        // En algunas rutas USB/Electron el dblclick no siempre dispara bien.
        // Si el elemento ya estaba seleccionado, el segundo click tambien abre.
        if (wasSelected || e.detail >= 2) {
          e.preventDefault();
          void this._openItem(item, fullPath);
        }
      });

      el.addEventListener('dragstart', function(e) {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('application/lth-item', JSON.stringify({
          type: 'lth-file-item', name: item.name, path: fullPath, isDirectory: item.isDirectory
        }));
        e.dataTransfer.setData('text/plain', fullPath);
        el.style.opacity = '0.5';
      });

      el.addEventListener('dragend', function() {
        el.style.opacity = '';
      });

      // Clic derecho → menú contextual
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        document.querySelectorAll('.lf-item-grid.selected, .lf-item-list.selected').forEach(x => x.classList.remove('selected'));
        el.classList.add('selected');
        this.state.selected = { item, path: fullPath };
        this.state.contextTarget = { item, path: fullPath };
        this._showCtx(e.clientX, e.clientY);
      });
    },

    // ── Barra de navegación ───────────────────────────────────
    _updateToolbar() {
      const s = this.state;
      document.getElementById('lfBack').disabled    = s.historyIndex <= 0;
      document.getElementById('lfForward').disabled = s.historyIndex >= s.history.length - 1;
      document.getElementById('lfUp').disabled      = this.isRoot(s.currentPath);
    },

    _updateBreadcrumb() {
      const bc = document.getElementById('lfBreadcrumb');
      const root = this._getNavRootPath();
      const current = normalizePath(this.state.currentPath);
      const rel = current.toLowerCase().startsWith(root.toLowerCase())
        ? current.slice(root.length).replace(/^\\+/, '')
        : '';
      const parts = [this._rootLabel(root), ...rel.split('\\').filter(Boolean)];
      const paths = [root];
      parts.slice(1).forEach((p, i) => paths.push(this.joinPath(root, parts.slice(1, i + 2).join('\\'))));

      bc.innerHTML = parts.map((p, i) => {
        const isLast = i === parts.length - 1;
        return (i > 0 ? '<span class="lf-crumb-sep">›</span>' : '') +
          '<span class="lf-crumb' + (isLast ? ' active' : '') + '" data-path="' + paths[i] + '">' + p + '</span>';
      }).join('');

      bc.querySelectorAll('.lf-crumb:not(.active)').forEach(el => {
        el.addEventListener('click', () => this.navigate(el.dataset.path));
      });
    },

    _updateSidebar() {
      const p = this.state.currentPath;
      const root = this.state.rootPath;
      const defaultPath = this.state.defaultPath || this._getDefaultRootPath();
      document.getElementById('lfSideRoot').classList.toggle('active', pathEquals(p, root));
      document.getElementById('lfSideDownloads').classList.toggle('active', pathEquals(p, defaultPath));
    },

    // ── Menú contextual ───────────────────────────────────────
    _showCtx(x, y) {
      const ctx = document.getElementById('lfCtx');
      const target = this.state.contextTarget;
      const isDir = !!(target && target.item && target.item.isDirectory);
      const isEncryptedVault = !!target?.item?.isEncryptedVault;
      const canEncrypt = !!(isDir && !isEncryptedVault && !this._isInsideUnlockedVaultBody(target?.path));

      const desktopBtn = document.getElementById('lfCtxDesktop');
      if (desktopBtn) {
        desktopBtn.style.display = target ? '' : 'none';
      }
      const cloudBtn = document.getElementById('lfCtxCloud');
      if (cloudBtn) {
        // Dentro de un vault ya cifrado no tiene sentido re-subir a la nube.
        cloudBtn.style.display = (target && !this._isInsideUnlockedVaultBody(target?.path) && !isEncryptedVault) ? '' : 'none';
      }
      const colorBtn = document.getElementById('lfCtxColor');
      if (colorBtn) {
        colorBtn.style.display = isDir && !isEncryptedVault ? '' : 'none';
      }
      const encryptBtn = document.getElementById('lfCtxEncrypt');
      if (encryptBtn) {
        encryptBtn.style.display = canEncrypt ? '' : 'none';
      }
      ctx.classList.add('visible');
      const mw = 190, mh = canEncrypt ? 246 : 206;
      ctx.style.left = (x + mw > window.innerWidth  ? x - mw : x) + 'px';
      ctx.style.top  = (y + mh > window.innerHeight ? y - mh : y) + 'px';
    },

    _hideCtx() {
      document.getElementById('lfCtx')?.classList.remove('visible');
    },

    _saveFolderColor(name, color) {
      try {
        var colors = this._getFolderColors();
        if (color === null) { delete colors[name]; }
        else { colors[name] = color; }
        this._folderColorsCache = colors;
        localStorage.setItem('lth_folder_colors', JSON.stringify(colors));
      } catch(e) {}
      void this._saveFolderColorsToDisk();
    },

    // ── Modal ─────────────────────────────────────────────────
    _showModal(title, placeholder, value, okLabel, onOk, options = {}) {
      const { type = 'text', description = '', onCancel = null } = options;
      const overlay = document.getElementById('lfModal');
      const input   = document.getElementById('lfModalInput');
      const noteEl  = document.getElementById('lfModalNote');
      const okBtn   = document.getElementById('lfModalOk');
      const keepModalKeysLocal = (e) => e.stopPropagation();
      document.getElementById('lfModalTitle').textContent = title;
      if (noteEl) {
        noteEl.textContent = description || '';
        noteEl.style.display = description ? 'block' : 'none';
      }
      input.type = type;
      input.disabled = false;
      input.readOnly = false;
      input.placeholder = placeholder;
      input.value = value || '';
      okBtn.textContent = okLabel;
      overlay.classList.add('visible');
      input.onkeydown = null;
      input.onkeyup = null;
      input.onkeypress = null;
      input.addEventListener('keydown', keepModalKeysLocal, { capture: false });
      input.addEventListener('keyup', keepModalKeysLocal, { capture: false });
      input.addEventListener('keypress', keepModalKeysLocal, { capture: false });
      input.addEventListener('click', keepModalKeysLocal, { capture: false });

      const focusInput = () => {
        try { input.focus({ preventScroll: true }); } catch (e) { try { input.focus(); } catch (e2) {} }
        try { input.click(); } catch (e) {}
        if (type !== 'password') {
          try { input.select(); } catch (e) {}
        }
      };
      focusInput();
      requestAnimationFrame(focusInput);
      setTimeout(focusInput, 40);
      setTimeout(focusInput, 120);

      const close = () => {
        overlay.classList.remove('visible');
        input.type = 'text';
        input.removeEventListener('keydown', keepModalKeysLocal, { capture: false });
        input.removeEventListener('keyup', keepModalKeysLocal, { capture: false });
        input.removeEventListener('keypress', keepModalKeysLocal, { capture: false });
        input.removeEventListener('click', keepModalKeysLocal, { capture: false });
        if (noteEl) {
          noteEl.textContent = '';
          noteEl.style.display = 'none';
        }
      };
      const handleOk = () => { close(); onOk(input.value.trim()); };

      document.getElementById('lfModalCancel').onclick = () => {
        close();
        if (typeof onCancel === 'function') onCancel();
      };
      okBtn.onclick = handleOk;
      input.onkeydown = e => {
        if (e.key === 'Enter') handleOk();
        if (e.key === 'Escape') {
          close();
          if (typeof onCancel === 'function') onCancel();
        }
      };
    },

    // ── Eventos globales ──────────────────────────────────────
    _initEvents(container) {
      // Navegación
      document.getElementById('lfBack').onclick = () => {
        const s = this.state;
        if (s.historyIndex > 0) { s.historyIndex--; this.navigate(s.history[s.historyIndex]); }
      };
      document.getElementById('lfForward').onclick = () => {
        const s = this.state;
        if (s.historyIndex < s.history.length - 1) { s.historyIndex++; this.navigate(s.history[s.historyIndex]); }
      };
      document.getElementById('lfUp').onclick = () => {
        if (!this.isRoot(this.state.currentPath)) this.navigate(this.parentPath(this.state.currentPath));
      };

      // Sidebar
      document.getElementById('lfSideRoot').onclick = async () => {
        await this._activateLocation(this.state.rootPath, { persistRoot: false });
      };
      document.getElementById('lfSideDownloads').onclick = async () => {
        const target = this.state.defaultPath || this._getDefaultRootPath();
        try { await this.fsMkdir(target); } catch (e) {}
        await this._activateLocation(target, { persistRoot: false });
      };
      const cloudSide = document.getElementById('lfSideCloud');
      if (cloudSide) {
        cloudSide.onclick = () => this.openCloud();
        // Arrastrar un archivo del explorador a "Mi nube LTH" lo cifra y lo sube.
        cloudSide.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          cloudSide.classList.add('drag-over');
        });
        cloudSide.addEventListener('dragleave', () => cloudSide.classList.remove('drag-over'));
        cloudSide.addEventListener('drop', async (e) => {
          e.preventDefault();
          cloudSide.classList.remove('drag-over');
          const raw = e.dataTransfer.getData('application/lth-item');
          let target = '';
          let name = '';
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              target = parsed?.path || '';
              name = parsed?.name || '';
            } catch (err) {}
          }
          if (!target) {
            const file = Array.from(e.dataTransfer.files || [])[0];
            if (file) {
              target = window.electron?.getPathForFile?.(file) || file.path || '';
              name = file.name;
            }
          }
          if (!target) return;
          await this.sendToCloud(target, name);
        });
      }

      document.getElementById('lfPickRoot').onclick = async () => {
        try {
          const selected = await window.electron?.fs?.selectFolder?.();
          if (!selected?.success || !selected.path) return;
          const newRoot = normalizePath(selected.path);
          if (!newRoot) return;
          await this.fsMkdir(newRoot);
          await this._activateLocation(newRoot, { persistRoot: true });
        } catch (e) {
          alert('No se pudo cambiar la ruta: ' + (e?.message || e));
        }
      };

      // Vista
      document.getElementById('lfViewGrid').onclick = () => {
        this.state.view = 'grid';
        document.getElementById('lfViewGrid').classList.add('active');
        document.getElementById('lfViewList').classList.remove('active');
        this._loadDir(this.state.currentPath);
      };
      document.getElementById('lfViewList').onclick = () => {
        this.state.view = 'list';
        document.getElementById('lfViewList').classList.add('active');
        document.getElementById('lfViewGrid').classList.remove('active');
        this._loadDir(this.state.currentPath);
      };

      // Nueva carpeta
      document.getElementById('lfNewFolder').onclick = () => {
        this._showModal('Nueva carpeta', 'Nombre de la carpeta', 'Nueva carpeta', 'Crear', async (name) => {
          if (!name) return;
          const newPath = this.joinPath(this.state.currentPath, name);
          const res = await this.fsMkdir(newPath);
          if (res?.error) { alert('Error: ' + res.error); return; }
          this._loadDir(this.state.currentPath);
        });
      };

      // Menú contextual → acciones
      document.getElementById('lfCtxOpen').onclick = () => {
        this._hideCtx();
        const t = this.state.contextTarget;
        if (!t) return;
        if (t.item.isDirectory) {
          if (t.item.isEncryptedVault) this._openEncryptedFolder(t.path);
          else this.navigate(t.path);
        } else this.fsOpenFile(t.path);
      };

      document.getElementById('lfCtxDesktop').onclick = () => {
        this._hideCtx();
        const t = this.state.contextTarget;
        if (!t) return;
        const desktop = window.LTHDesktop;
        if (!desktop || typeof desktop.pinItem !== 'function') {
          alert('El escritorio aun no esta listo para recibir archivos.');
          return;
        }
        desktop.pinItem({
          name: t.item.name,
          path: t.path,
          isDirectory: !!t.item.isDirectory
        });
      };

      document.getElementById('lfCtxCloud').onclick = async () => {
        this._hideCtx();
        const t = this.state.contextTarget;
        if (!t) return;
        await this.sendToCloud(t.path, t.item.name);
      };

      document.getElementById('lfCtxRename').onclick = () => {
        this._hideCtx();
        const t = this.state.contextTarget;
        if (!t) return;
        this._showModal('Renombrar', 'Nuevo nombre', t.item.name, 'Renombrar', async (newName) => {
          if (!newName || newName === t.item.name) return;
          const newPath = this.joinPath(this.state.currentPath, newName);
          const res = await this.fsRename(t.path, newPath);
          if (res?.error) { alert('Error: ' + res.error); return; }
          this._loadDir(this.state.currentPath);
        });
      };

      document.getElementById('lfCtxDelete').onclick = () => {
        this._hideCtx();
        const t = this.state.contextTarget;
        if (!t) return;
        if (!confirm(`¿Eliminar "${t.item.name}"?`)) return;
        this.fsDelete(t.path).then(res => {
          if (res?.error) { alert('Error: ' + res.error); return; }
          this._loadDir(this.state.currentPath);
        });
      };

      // ── Color picker para carpetas ──
      document.getElementById('lfCtxEncrypt').onclick = () => {
        this._hideCtx();
        const t = this.state.contextTarget;
        if (!t || !t.item?.isDirectory || t.item?.isEncryptedVault) return;
        this._encryptFolder(t.path);
      };

      const NEON_PRESETS = [
        '#00f5ff','#0080ff','#ff2d78','#ff00aa','#ff6ec7',
        '#39ff14','#00ffaa','#ff9500','#ff3300','#ffef00',
        '#cc00ff','#7700ee','#ffffff','#e2e8f0','#64748b','#ff4444'
      ];

      document.getElementById('lfCtxColor').onclick = () => {
        this._hideCtx();
        const t = this.state.contextTarget;
        if (!t || !t.item.isDirectory) return;

        // Rellenar la grilla de colores presets
        const grid = document.getElementById('lfColorGrid');
        grid.innerHTML = '';
        NEON_PRESETS.forEach(color => {
          const dot = document.createElement('div');
          dot.style.cssText = 'width:28px;height:28px;border-radius:50%;cursor:pointer;transition:transform 0.15s,box-shadow 0.15s;border:2px solid transparent;';
          dot.style.background = color;
          dot.style.boxShadow = '0 0 8px ' + color + '88';
          dot.onmouseenter = () => { dot.style.transform = 'scale(1.25)'; dot.style.boxShadow = '0 0 14px ' + color; };
          dot.onmouseleave = () => { dot.style.transform = ''; dot.style.boxShadow = '0 0 8px ' + color + '88'; };
          dot.onclick = () => {
            this._saveFolderColor(t.item.name, color);
            document.getElementById('lfColorModal').classList.remove('visible');
            this._loadDir(this.state.currentPath);
          };
          grid.appendChild(dot);
        });

        document.getElementById('lfColorModalTitle').textContent = 'Color: ' + t.item.name;
        document.getElementById('lfColorModal').classList.add('visible');
      };

      document.getElementById('lfColorCancel').onclick = () => {
        document.getElementById('lfColorModal').classList.remove('visible');
      };

      document.getElementById('lfColorReset').onclick = () => {
        const t = this.state.contextTarget;
        if (t) this._saveFolderColor(t.item.name, null);
        document.getElementById('lfColorModal').classList.remove('visible');
        this._loadDir(this.state.currentPath);
      };

      document.getElementById('lfColorCustomApply').onclick = () => {
        const t = this.state.contextTarget;
        const color = document.getElementById('lfColorCustom').value;
        if (t) this._saveFolderColor(t.item.name, color);
        document.getElementById('lfColorModal').classList.remove('visible');
        this._loadDir(this.state.currentPath);
      };

      // Cerrar ctx al click fuera
      document.getElementById('lfContent').addEventListener('click', () => {
        this._hideCtx();
        this.state.selected = null;
        document.querySelectorAll('.lf-item-grid.selected, .lf-item-list.selected').forEach(x => x.classList.remove('selected'));
      });

      document.addEventListener('click', () => this._hideCtx());
    },

    onClose() {
      if (this._drivePoller) { clearInterval(this._drivePoller); this._drivePoller = null; }
    }
  };

  // ── Registrar en AppLoader ────────────────────────────────
  if (window.AppLoader) {
    window.AppLoader.registerApp({
      id: 'lth-files',
      name: 'Archivos',
      icon: '📁',
      iconUrl: '../assets/Archivos.png',
      gradient: 'linear-gradient(135deg,#2a0f06 0%,#5b1e08 45%,#ff6a00 100%)'
    });
  }

  console.log('LTH Files registrado: raiz configurable en Descargas');

})();
