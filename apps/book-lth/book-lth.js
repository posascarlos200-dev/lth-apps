(function () {
  'use strict';

  window.LTH_APPS = window.LTH_APPS || {};

  const BOOK_LTH_ICON_URL = '../assets/Libros.png';

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

  function getSystemDataRoot() {
    const runtimeData = String(getRuntimePaths()?.appData || '').trim();
    if (runtimeData) return runtimeData;
    const workspaceRoot = getWorkspaceRoot();
    return workspaceRoot ? (workspaceRoot + '\\sistema LTH') : '';
  }

  window.LTH_APPS['book-lth'] = {
    id: 'book-lth',
    name: 'Book LTH',
    icon: '📚',
    iconUrl: BOOK_LTH_ICON_URL,
    gradient: 'linear-gradient(135deg, #8B5E3C, #D4A76A)',

    state: {
      books: [],
      view: 'library',
      activeBook: null,
      searchQuery: '',
      contextMenu: null,
      saveTimer: null,
    },

    _folder()     { return getSystemDataRoot() + '\\Book LTH'; },
    _docsFolder() { return this._folder() + '\\docs'; },
    _dataPath()   { return this._folder() + '\\library-data.json'; },
    _infoPath()   { return this._folder() + '\\app-info.json'; },
    _docPath(id)  { return this._docsFolder() + '\\' + id + '.json'; },

    getUninstallManifest() {
      return {
        dataPaths: [this._folder()],
        storageKeys: ['book-lth-data'],
        storagePrefixes: ['book-lth-doc-']
      };
    },

    _genId() {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    },

    _bookColors: [
      '#2c3e50', '#8e44ad', '#c0392b', '#16a085',
      '#d35400', '#1a5276', '#117a65', '#6c3483',
      '#922b21', '#1f618d', '#1e8449', '#784212'
    ],

    // ─── STORAGE ───
    async _initStorage() {
      if (!window.electron?.fs) return;
      try {
        await window.electron.fs.createFolder(this._folder());
        await window.electron.fs.createFolder(this._docsFolder());
        const dataExists = await window.electron.fs.itemExists(this._dataPath());
        if (!dataExists) {
          await window.electron.fs.writeFile(this._dataPath(), JSON.stringify({
            books: [],
            _meta: { version: 2, app: 'Book LTH', creado: new Date().toISOString() }
          }, null, 2));
        }
        await window.electron.fs.writeFile(this._infoPath(), JSON.stringify({
          id: 'book-lth', name: 'Book LTH', version: 2,
          descripcion: 'Librería personal de documentos',
          carpeta: this._folder(),
          archivos: { datos: 'library-data.json', info: 'app-info.json', documentos: 'docs/' },
          actualizado: new Date().toISOString()
        }, null, 2));
      } catch (e) {
        console.warn('[Book LTH] ⚠️ Storage init error:', e);
      }
    },

    async _loadBooks() {
      try {
        if (window.electron?.fs) {
          const exists = await window.electron.fs.itemExists(this._dataPath());
          if (exists) {
            const res = await window.electron.fs.readFile(this._dataPath());
            const data = JSON.parse(res.content);
            this.state.books = data.books || [];
            return;
          }
        }
      } catch (e) { console.warn('[Book LTH] load error', e); }
      try {
        const local = localStorage.getItem('book-lth-data');
        if (local) this.state.books = JSON.parse(local).books || [];
      } catch (e) {}
    },

    async _saveIndex() {
      const data = { books: this.state.books, _meta: { version: 2, app: 'Book LTH', actualizado: new Date().toISOString() } };
      const json = JSON.stringify(data, null, 2);
      try { localStorage.setItem('book-lth-data', json); } catch (e) {}
      if (!window.electron?.fs) return;
      try {
        await window.electron.fs.createFolder(this._folder());
        await window.electron.fs.writeFile(this._dataPath(), json);
      } catch (e) { console.warn('[Book LTH] save index error', e); }
    },

    async _saveDoc(book) {
      const json = JSON.stringify(book, null, 2);
      try { localStorage.setItem('book-lth-doc-' + book.id, json); } catch (e) {}
      if (!window.electron?.fs) return;
      try {
        await window.electron.fs.createFolder(this._docsFolder());
        await window.electron.fs.writeFile(this._docPath(book.id), json);
      } catch (e) { console.warn('[Book LTH] save doc error', e); }
    },

    async _loadDoc(id) {
      try {
        if (window.electron?.fs) {
          const exists = await window.electron.fs.itemExists(this._docPath(id));
          if (exists) {
            const res = await window.electron.fs.readFile(this._docPath(id));
            return JSON.parse(res.content);
          }
        }
      } catch (e) {}
      try {
        const local = localStorage.getItem('book-lth-doc-' + id);
        if (local) return JSON.parse(local);
      } catch (e) {}
      return null;
    },

    async _deleteDoc(id) {
      try { localStorage.removeItem('book-lth-doc-' + id); } catch (e) {}
      if (!window.electron?.fs) return;
      try { await window.electron.fs.deleteItem(this._docPath(id)); } catch (e) {}
    },

    // ─── STYLES ───
    _injectStyles(scopeId) {
      if (document.getElementById('book-lth-styles')) return;
      const style = document.createElement('style');
      style.id = 'book-lth-styles';
      style.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@400;500;600&display=swap');

        #${scopeId} {
          --bg: #0c0806;
          --bg2: #110d09;
          --shelf: linear-gradient(180deg, #7a5633 0%, #6b4423 30%, #5a3818 70%, #4a2d10 100%);
          --shelf-edge: #3d2310;
          --gold: #d4a84b;
          --gold-soft: rgba(212,168,75,0.15);
          --cream: #e8d5c0;
          --cream50: rgba(232,213,192,0.5);
          --btn-red: #c0392b;
          --modal-bg: #140e08;
          --input-bg: #1e150d;
          --input-border: rgba(212,168,75,0.18);
          font-family: 'DM Sans', sans-serif;
          background: var(--bg);
          color: var(--cream);
          position: absolute !important;
          top: 0 !important; left: 0 !important;
          right: 0 !important; bottom: 0 !important;
          display: flex; flex-direction: column;
          overflow: hidden; box-sizing: border-box;
        }
        #${scopeId} * { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── AMBIENT ── */
        #${scopeId}::before {
          content: '';
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 60% 40% at 30% 10%, rgba(212,168,75,0.06) 0%, transparent 60%),
            radial-gradient(ellipse 50% 60% at 80% 90%, rgba(139,94,60,0.05) 0%, transparent 50%);
          pointer-events: none; z-index: 0;
        }
        #${scopeId}::after {
          content: '';
          position: absolute; inset: 0;
          background: url("data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
          pointer-events: none; z-index: 0; opacity: 0.5;
        }

        /* ── HEADER ── */
        #${scopeId} .blth-header {
          position: relative; z-index: 10;
          flex: 0 0 auto;
          display: flex; align-items: center; gap: 12px;
          padding: 12px 20px;
          border-bottom: 1px solid rgba(212,168,75,0.1);
          background: rgba(10,6,4,0.97);
          min-height: 56px;
        }
        #${scopeId} .blth-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 26px; font-weight: 700;
          color: var(--gold);
          text-shadow: 0 0 30px rgba(212,168,75,0.3);
          letter-spacing: 1.5px;
          flex: 0 0 auto;
          display: flex; align-items: baseline; gap: 8px;
        }
        #${scopeId} .blth-title span {
          font-style: italic; color: var(--cream50);
          font-size: 13px; font-weight: 400; letter-spacing: 2px;
          text-transform: uppercase;
        }
        #${scopeId} .blth-search-wrap {
          position: relative; flex: 1; max-width: 320px; margin-left: auto;
        }
        #${scopeId} .blth-search-wrap::before {
          content: '';
          position: absolute; left: 12px; top: 50%;
          transform: translateY(-50%);
          width: 14px; height: 14px;
          background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23d4a84b' stroke-width='2' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'/%3E%3C/svg%3E") center/contain no-repeat;
          opacity: 0.4; pointer-events: none; z-index: 1;
        }
        #${scopeId} .blth-search {
          width: 100%;
          background: var(--input-bg);
          border: 1px solid var(--input-border);
          border-radius: 10px;
          padding: 9px 14px 9px 34px;
          color: var(--cream); font-size: 13px;
          outline: none; transition: border-color 0.2s, box-shadow 0.2s;
          font-family: 'DM Sans', sans-serif;
        }
        #${scopeId} .blth-search:focus {
          border-color: rgba(212,168,75,0.4);
          box-shadow: 0 0 0 3px rgba(212,168,75,0.06);
        }
        #${scopeId} .blth-search::placeholder { color: rgba(232,213,192,0.25); }

        /* ── BUTTONS ── */
        #${scopeId} .blth-btn {
          padding: 9px 18px; border-radius: 10px;
          border: none; cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px; font-weight: 600;
          transition: all 0.2s; white-space: nowrap;
        }
        #${scopeId} .blth-btn-add {
          background: linear-gradient(135deg, var(--gold), #b8912e);
          color: #1a0e0a;
          box-shadow: 0 2px 8px rgba(212,168,75,0.25);
        }
        #${scopeId} .blth-btn-add:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(212,168,75,0.35);
        }
        #${scopeId} .blth-btn-back {
          background: rgba(212,168,75,0.08);
          color: var(--gold); border: 1px solid rgba(212,168,75,0.2);
        }
        #${scopeId} .blth-btn-back:hover { background: rgba(212,168,75,0.15); }

        /* ── LIBRARY ── */
        #${scopeId} .blth-library {
          flex: 1 1 0; min-height: 0;
          overflow-y: auto; overflow-x: hidden;
          padding: 24px 20px 60px;
          position: relative; z-index: 1;
          scroll-behavior: smooth;
        }
        #${scopeId} .blth-library::-webkit-scrollbar { width: 5px; }
        #${scopeId} .blth-library::-webkit-scrollbar-track { background: transparent; }
        #${scopeId} .blth-library::-webkit-scrollbar-thumb { background: rgba(212,168,75,0.15); border-radius: 3px; }

        #${scopeId} .blth-empty {
          text-align: center; padding: 80px 20px;
          color: rgba(232,213,192,0.25);
        }
        #${scopeId} .blth-empty-icon {
          font-size: 64px; margin-bottom: 16px;
          filter: grayscale(0.5);
        }
        #${scopeId} .blth-empty-text {
          font-family: 'Cormorant Garamond', serif;
          font-size: 18px; font-style: italic;
          line-height: 1.6;
        }
        #${scopeId} .blth-empty-sub {
          font-size: 12px; margin-top: 8px;
          color: rgba(232,213,192,0.15);
          letter-spacing: 1px; text-transform: uppercase;
        }

        /* ── SHELF ── */
        #${scopeId} .blth-shelf-wrap {
          margin-bottom: 32px;
          animation: blthSlideUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        #${scopeId} .blth-shelf-label {
          font-family: 'Cormorant Garamond', serif;
          font-size: 12px; letter-spacing: 3px;
          text-transform: uppercase;
          color: rgba(212,168,75,0.3);
          margin-bottom: 8px; padding-left: 10px;
          font-weight: 600;
        }
        #${scopeId} .blth-shelf {
          background: var(--shelf);
          border-radius: 3px 3px 0 0;
          padding: 24px 20px 0;
          position: relative;
          box-shadow:
            inset 0 2px 0 rgba(255,255,255,0.12),
            inset 0 -6px 0 rgba(0,0,0,0.5),
            0 2px 0 var(--shelf-edge);
          min-height: 90px;
        }
        /* Wood grain */
        #${scopeId} .blth-shelf::before {
          content: '';
          position: absolute; inset: 0;
          background: repeating-linear-gradient(
            90deg,
            transparent 0px, transparent 40px,
            rgba(0,0,0,0.03) 40px, rgba(0,0,0,0.03) 42px
          );
          border-radius: 3px 3px 0 0;
          pointer-events: none;
        }
        #${scopeId} .blth-shelf-floor {
          height: 14px;
          background: linear-gradient(180deg, var(--shelf-edge) 0%, #2a1808 100%);
          border-radius: 0 0 3px 3px;
          box-shadow:
            0 4px 12px rgba(0,0,0,0.5),
            0 8px 24px rgba(0,0,0,0.3);
          margin-bottom: 4px;
        }
        #${scopeId} .blth-books-row {
          display: flex; align-items: flex-end; gap: 6px;
          min-height: 210px; flex-wrap: nowrap;
          overflow-x: auto; padding-bottom: 0;
        }
        #${scopeId} .blth-books-row::-webkit-scrollbar { height: 0; }

        /* ── 3D BOOK ── */
        #${scopeId} .blth-book {
          flex: 0 0 auto;
          width: 54px;
          perspective: 600px;
          cursor: pointer;
          position: relative;
          transform-origin: bottom center;
          animation: blthBookDrop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        #${scopeId} .blth-book-3d {
          position: relative;
          width: 100%; height: 100%;
          transform-style: preserve-3d;
          transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        #${scopeId} .blth-book:hover .blth-book-3d {
          transform: translateY(-14px) rotateY(-18deg) rotateX(2deg);
        }

        /* Front cover */
        #${scopeId} .blth-book-cover {
          position: relative;
          width: 100%; height: 100%;
          border-radius: 1px 4px 4px 1px;
          overflow: hidden;
          box-shadow:
            4px 2px 10px rgba(0,0,0,0.5),
            1px 0 3px rgba(0,0,0,0.4),
            inset 0 0 0 1px rgba(255,255,255,0.06);
        }
        /* Cover decorative elements */
        #${scopeId} .blth-book-cover-art {
          position: absolute; inset: 0;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 12px 6px;
        }
        #${scopeId} .blth-book-cover-line {
          width: 60%; height: 1px;
          background: rgba(255,255,255,0.2);
          margin: 3px 0;
        }
        #${scopeId} .blth-book-cover-ornament {
          width: 16px; height: 16px;
          margin: 6px 0;
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 50%;
          position: relative;
        }
        #${scopeId} .blth-book-cover-ornament::after {
          content: '';
          position: absolute; top: 3px; left: 3px; right: 3px; bottom: 3px;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 50%;
        }

        /* Spine (left side) */
        #${scopeId} .blth-book-spine {
          position: absolute; left: 0; top: 0; bottom: 0;
          width: 7px;
          background: rgba(0,0,0,0.35);
          border-radius: 2px 0 0 2px;
          z-index: 2;
        }
        #${scopeId} .blth-book-spine::after {
          content: '';
          position: absolute; left: 2px; top: 8px; bottom: 8px;
          width: 1px;
          background: rgba(255,255,255,0.08);
        }

        /* Pages (right side peek) */
        #${scopeId} .blth-book-pages {
          position: absolute;
          right: -3px; top: 3px; bottom: 3px;
          width: 6px;
          background: repeating-linear-gradient(
            180deg,
            #f5f0e8 0px, #f5f0e8 1px,
            #e8e0d4 1px, #e8e0d4 2px
          );
          border-radius: 0 2px 2px 0;
          box-shadow: 1px 0 3px rgba(0,0,0,0.2);
          z-index: 1;
          opacity: 0;
          transition: opacity 0.25s;
        }
        #${scopeId} .blth-book:hover .blth-book-pages {
          opacity: 1;
        }

        /* Shine on cover */
        #${scopeId} .blth-book-shine {
          position: absolute; left: 8px; top: 0; bottom: 0;
          width: 4px;
          background: linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.05) 40%, transparent 70%);
          z-index: 3; pointer-events: none;
        }

        /* Title on book */
        #${scopeId} .blth-book-title {
          writing-mode: vertical-rl;
          text-orientation: mixed;
          transform: rotate(180deg);
          font-family: 'Cormorant Garamond', serif;
          font-size: 11px; font-weight: 600;
          color: rgba(255,255,255,0.88);
          text-shadow: 0 1px 3px rgba(0,0,0,0.6);
          line-height: 1.2;
          max-height: 140px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          user-select: none;
          position: relative; z-index: 4;
        }

        /* Stars on book cover (tiny) */
        #${scopeId} .blth-book-stars-mini {
          position: absolute; bottom: 6px; left: 50%;
          transform: translateX(-50%);
          display: flex; gap: 1px;
          z-index: 4;
        }
        #${scopeId} .blth-book-stars-mini span {
          font-size: 5px; line-height: 1;
          color: rgba(255,255,255,0.25);
        }
        #${scopeId} .blth-book-stars-mini span.filled {
          color: #f0c674;
          text-shadow: 0 0 3px rgba(240,198,116,0.5);
        }

        #${scopeId} .blth-book.blth-hidden { opacity: 0.06; pointer-events: none; }
        #${scopeId} .blth-book.blth-removing {
          animation: blthBookFall 0.4s ease-in forwards;
        }
        #${scopeId} .blth-book.blth-new {
          animation: blthBookDrop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }

        /* ── TOOLTIP ── */
        #${scopeId} .blth-tooltip {
          position: absolute;
          bottom: calc(100% + 16px);
          left: 50%; transform: translateX(-50%);
          background: rgba(12, 8, 4, 0.97);
          border: 1px solid rgba(212,168,75,0.2);
          border-radius: 10px; padding: 12px 16px;
          width: 180px; z-index: 100;
          pointer-events: none;
          opacity: 0; transform: translateX(-50%) translateY(8px);
          transition: opacity 0.25s, transform 0.25s;
          box-shadow: 0 12px 32px rgba(0,0,0,0.7);
          white-space: normal;
        }
        #${scopeId} .blth-book:hover .blth-tooltip {
          opacity: 1; transform: translateX(-50%) translateY(0);
        }
        #${scopeId} .blth-tooltip-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 13px; color: var(--gold);
          margin-bottom: 4px; font-weight: 700;
        }
        #${scopeId} .blth-tooltip-desc {
          font-size: 10px; color: rgba(232,213,192,0.5);
          margin-bottom: 4px;
          display: -webkit-box; -webkit-line-clamp: 2;
          -webkit-box-orient: vertical; overflow: hidden;
        }
        #${scopeId} .blth-tooltip-meta {
          font-size: 9px; color: rgba(232,213,192,0.3);
          display: flex; align-items: center; gap: 6px;
        }
        #${scopeId} .blth-tooltip-stars {
          display: flex; gap: 1px;
        }
        #${scopeId} .blth-tooltip-stars span {
          font-size: 9px; color: rgba(255,255,255,0.2);
        }
        #${scopeId} .blth-tooltip-stars span.filled { color: #f0c674; }

        /* ── CONTEXT MENU ── */
        #${scopeId} .blth-ctx-menu {
          position: fixed; z-index: 9999;
          background: #140e08;
          border: 1px solid rgba(212,168,75,0.2);
          border-radius: 12px;
          padding: 6px;
          box-shadow: 0 16px 48px rgba(0,0,0,0.7);
          min-width: 170px;
          animation: blthFadeIn 0.15s ease;
          backdrop-filter: blur(12px);
        }
        #${scopeId} .blth-ctx-item {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 14px; border-radius: 8px;
          cursor: pointer; font-size: 13px; color: var(--cream);
          transition: background 0.15s;
        }
        #${scopeId} .blth-ctx-item:hover { background: rgba(212,168,75,0.08); }
        #${scopeId} .blth-ctx-item.danger { color: #e74c3c; }
        #${scopeId} .blth-ctx-item.danger:hover { background: rgba(231,76,60,0.08); }
        #${scopeId} .blth-ctx-sep {
          height: 1px; background: rgba(212,168,75,0.08); margin: 4px 8px;
        }

        /* ── MODAL (create + preview) ── */
        #${scopeId} .blth-modal-overlay {
          position: absolute; inset: 0;
          background: rgba(0,0,0,0.75);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; backdrop-filter: blur(8px);
          animation: blthFadeIn 0.2s ease;
        }
        #${scopeId} .blth-modal {
          background: var(--modal-bg);
          border: 1px solid rgba(212,168,75,0.15);
          border-radius: 18px; padding: 32px;
          width: 400px; max-width: 92%;
          box-shadow: 0 32px 80px rgba(0,0,0,0.8);
          animation: blthSlideUp 0.35s cubic-bezier(0.22, 1, 0.36, 1);
          position: relative; overflow: hidden;
        }
        /* Modal gold accent line */
        #${scopeId} .blth-modal::before {
          content: '';
          position: absolute; top: 0; left: 32px; right: 32px;
          height: 2px;
          background: linear-gradient(90deg, transparent, var(--gold), transparent);
          opacity: 0.3;
        }
        #${scopeId} .blth-modal-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 22px; color: var(--gold);
          margin-bottom: 24px; font-weight: 700;
          display: flex; align-items: center; gap: 10px;
        }
        #${scopeId} .blth-modal-title .blth-modal-icon {
          width: 32px; height: 32px;
          background: var(--gold-soft);
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px;
        }
        #${scopeId} .blth-modal label {
          display: block; font-size: 11px; text-transform: uppercase;
          letter-spacing: 1.5px; color: rgba(232,213,192,0.4);
          margin-bottom: 6px; margin-top: 18px;
          font-weight: 500;
        }
        #${scopeId} .blth-modal label:first-of-type { margin-top: 0; }
        #${scopeId} .blth-input {
          width: 100%; background: var(--input-bg);
          border: 1px solid var(--input-border);
          border-radius: 10px; padding: 10px 14px;
          color: var(--cream); font-size: 14px;
          outline: none; transition: border-color 0.2s, box-shadow 0.2s;
          font-family: 'DM Sans', sans-serif;
        }
        #${scopeId} .blth-input:focus {
          border-color: rgba(212,168,75,0.4);
          box-shadow: 0 0 0 3px rgba(212,168,75,0.06);
        }
        #${scopeId} .blth-textarea {
          width: 100%; background: var(--input-bg);
          border: 1px solid var(--input-border);
          border-radius: 10px; padding: 10px 14px;
          color: var(--cream); font-size: 13px;
          outline: none; transition: border-color 0.2s;
          font-family: 'DM Sans', sans-serif;
          resize: vertical; min-height: 60px; max-height: 120px;
          line-height: 1.5;
        }
        #${scopeId} .blth-textarea:focus {
          border-color: rgba(212,168,75,0.4);
          box-shadow: 0 0 0 3px rgba(212,168,75,0.06);
        }
        #${scopeId} .blth-textarea::placeholder,
        #${scopeId} .blth-input::placeholder {
          color: rgba(232,213,192,0.2);
        }
        #${scopeId} .blth-color-row {
          display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px;
        }
        #${scopeId} .blth-color-dot {
          width: 28px; height: 28px; border-radius: 50%;
          cursor: pointer; transition: transform 0.15s, box-shadow 0.15s;
          border: 2px solid transparent;
        }
        #${scopeId} .blth-color-dot:hover { transform: scale(1.15); }
        #${scopeId} .blth-color-dot.selected {
          border-color: var(--gold);
          box-shadow: 0 0 0 3px rgba(212,168,75,0.25);
          transform: scale(1.2);
        }
        #${scopeId} .blth-modal-btns {
          display: flex; gap: 10px; margin-top: 28px;
        }
        #${scopeId} .blth-modal-btns .blth-btn {
          flex: 1; padding: 11px; text-align: center; border-radius: 10px;
        }
        #${scopeId} .blth-btn-primary {
          background: linear-gradient(135deg, var(--gold), #b8912e);
          color: #1a0e0a; font-weight: 700;
          box-shadow: 0 2px 8px rgba(212,168,75,0.2);
        }
        #${scopeId} .blth-btn-primary:hover {
          box-shadow: 0 4px 16px rgba(212,168,75,0.3);
          transform: translateY(-1px);
        }
        #${scopeId} .blth-btn-ghost {
          background: transparent; border: 1px solid rgba(212,168,75,0.15);
          color: rgba(232,213,192,0.5);
        }
        #${scopeId} .blth-btn-ghost:hover {
          border-color: rgba(212,168,75,0.3);
          color: var(--cream);
        }

        /* ── PREVIEW MODAL ── */
        #${scopeId} .blth-preview-modal {
          background: var(--modal-bg);
          border: 1px solid rgba(212,168,75,0.15);
          border-radius: 20px;
          width: 380px; max-width: 92%;
          box-shadow: 0 32px 80px rgba(0,0,0,0.8);
          animation: blthSlideUp 0.35s cubic-bezier(0.22, 1, 0.36, 1);
          overflow: hidden;
        }
        #${scopeId} .blth-preview-cover {
          height: 120px;
          position: relative; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
        }
        #${scopeId} .blth-preview-cover-bg {
          position: absolute; inset: 0;
          opacity: 0.25;
        }
        #${scopeId} .blth-preview-cover::after {
          content: '';
          position: absolute; bottom: 0; left: 0; right: 0;
          height: 60px;
          background: linear-gradient(transparent, var(--modal-bg));
        }
        #${scopeId} .blth-preview-book-icon {
          position: relative; z-index: 1;
          width: 44px; height: 62px;
          border-radius: 2px 4px 4px 2px;
          box-shadow: 4px 4px 16px rgba(0,0,0,0.5);
          display: flex; align-items: center; justify-content: center;
        }
        #${scopeId} .blth-preview-book-icon::before {
          content: '';
          position: absolute; left: 0; top: 0; bottom: 0; width: 5px;
          background: rgba(0,0,0,0.3); border-radius: 2px 0 0 2px;
        }
        #${scopeId} .blth-preview-book-icon .pbi-label {
          writing-mode: vertical-rl; transform: rotate(180deg);
          font-family: 'Cormorant Garamond', serif;
          font-size: 9px; color: rgba(255,255,255,0.7);
          font-weight: 600; padding: 0 4px;
          max-height: 50px; overflow: hidden;
          text-overflow: ellipsis; white-space: nowrap;
        }
        #${scopeId} .blth-preview-body {
          padding: 20px 28px 28px;
          text-align: center;
        }
        #${scopeId} .blth-preview-name {
          font-family: 'Cormorant Garamond', serif;
          font-size: 22px; font-weight: 700;
          color: var(--gold);
          margin-bottom: 4px;
        }
        #${scopeId} .blth-preview-type {
          font-size: 11px;
          color: rgba(232,213,192,0.3);
          text-transform: uppercase;
          letter-spacing: 2px;
          margin-bottom: 12px;
        }
        #${scopeId} .blth-preview-desc {
          font-size: 13px; color: rgba(232,213,192,0.55);
          line-height: 1.6;
          margin-bottom: 16px;
          min-height: 20px;
          font-style: italic;
        }
        #${scopeId} .blth-preview-desc:empty::after {
          content: 'Sin descripción';
          color: rgba(232,213,192,0.2);
        }

        /* Star rating */
        #${scopeId} .blth-stars-row {
          display: flex; gap: 4px;
          justify-content: center;
          margin-bottom: 20px;
        }
        #${scopeId} .blth-star {
          font-size: 22px; cursor: pointer;
          color: rgba(232,213,192,0.15);
          transition: color 0.15s, transform 0.15s, text-shadow 0.15s;
          user-select: none;
        }
        #${scopeId} .blth-star:hover {
          transform: scale(1.2);
        }
        #${scopeId} .blth-star.filled {
          color: #f0c674;
          text-shadow: 0 0 8px rgba(240,198,116,0.4);
        }
        #${scopeId} .blth-star.hovered {
          color: rgba(240,198,116,0.7);
        }
        #${scopeId} .blth-preview-date {
          font-size: 10px; color: rgba(232,213,192,0.2);
          margin-bottom: 20px;
        }
        #${scopeId} .blth-preview-btns {
          display: flex; gap: 10px;
        }
        #${scopeId} .blth-preview-btns .blth-btn {
          flex: 1; padding: 11px; text-align: center; border-radius: 10px;
          font-size: 14px;
        }

        /* Editable desc in preview */
        #${scopeId} .blth-preview-desc-edit {
          background: var(--input-bg);
          border: 1px solid var(--input-border);
          border-radius: 8px; padding: 8px 12px;
          color: rgba(232,213,192,0.6);
          font-size: 13px; font-style: italic;
          font-family: 'DM Sans', sans-serif;
          outline: none; resize: none;
          width: 100%; min-height: 44px;
          text-align: center; line-height: 1.5;
          margin-bottom: 16px;
          transition: border-color 0.2s;
        }
        #${scopeId} .blth-preview-desc-edit:focus {
          border-color: rgba(212,168,75,0.4);
        }

        /* ── EDITOR ── */
        #${scopeId} .blth-editor-wrap {
          flex: 1; display: flex; flex-direction: column;
          overflow: hidden;
          animation: blthBookOpen 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        #${scopeId} .blth-editor-header {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 20px;
          border-bottom: 1px solid rgba(212,168,75,0.08);
          background: rgba(14,10,6,0.97);
          position: relative; z-index: 5;
        }
        #${scopeId} .blth-editor-color-stripe {
          width: 4px; height: 28px; border-radius: 2px; flex: 0 0 auto;
        }
        #${scopeId} .blth-editor-doc-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 18px; color: var(--gold);
          outline: none; min-width: 80px;
          border-bottom: 1px dashed transparent;
          transition: border-color 0.2s;
        }
        #${scopeId} .blth-editor-doc-title:focus { border-color: rgba(212,168,75,0.3); }
        #${scopeId} .blth-save-indicator {
          font-size: 11px; color: rgba(46,204,113,0.8);
          margin-left: auto; opacity: 0;
          transition: opacity 0.3s;
        }
        #${scopeId} .blth-save-indicator.visible { opacity: 1; }
        #${scopeId} .blth-toolbar {
          display: flex; gap: 4px; align-items: center;
          padding: 7px 20px;
          border-bottom: 1px solid rgba(212,168,75,0.06);
          background: rgba(12,8,4,0.97);
        }
        #${scopeId} .blth-tool-btn {
          padding: 5px 11px; border-radius: 6px;
          border: 1px solid rgba(212,168,75,0.1);
          background: transparent; color: var(--cream);
          cursor: pointer; font-size: 13px; font-weight: 700;
          transition: all 0.15s;
        }
        #${scopeId} .blth-tool-btn:hover {
          background: rgba(212,168,75,0.08);
          border-color: rgba(212,168,75,0.25);
        }
        #${scopeId} .blth-tool-sep {
          width: 1px; height: 18px;
          background: rgba(212,168,75,0.1);
          margin: 0 4px;
        }
        #${scopeId} .blth-editor-body {
          flex: 1; overflow-y: auto;
          padding: 36px 44px;
          outline: none;
          font-size: 15px; line-height: 1.85;
          color: var(--cream);
          background: #0a0705;
          caret-color: var(--gold);
        }
        #${scopeId} .blth-editor-body::-webkit-scrollbar { width: 5px; }
        #${scopeId} .blth-editor-body::-webkit-scrollbar-thumb { background: rgba(212,168,75,0.12); border-radius: 3px; }
        #${scopeId} .blth-editor-body:empty::before {
          content: attr(data-placeholder);
          color: rgba(232,213,192,0.15);
          font-style: italic; pointer-events: none;
        }
        #${scopeId} .blth-editor-body h1, #${scopeId} .blth-editor-body h2 {
          font-family: 'Cormorant Garamond', serif; color: var(--gold);
        }
        #${scopeId} .blth-editor-body b, #${scopeId} .blth-editor-body strong { color: var(--gold); }
        #${scopeId} .blth-editor-body ul, #${scopeId} .blth-editor-body ol { padding-left: 24px; }

        /* ── KEYFRAMES ── */
        @keyframes blthSlideUp {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes blthBookDrop {
          from { opacity: 0; transform: translateY(-60px) scaleX(0.7); }
          to   { opacity: 1; transform: translateY(0) scaleX(1); }
        }
        @keyframes blthBookFall {
          0%   { transform: translateY(0) rotateX(0); opacity: 1; }
          100% { transform: translateY(60px) rotateX(90deg); opacity: 0; }
        }
        @keyframes blthFadeIn {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes blthBookOpen {
          from { opacity: 0; transform: scaleX(0.9) translateX(20px); }
          to   { opacity: 1; transform: scaleX(1) translateX(0); }
        }
        @keyframes blthShimmer {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(200%); }
        }

        /* ── DUST PARTICLES ── */
        #${scopeId} .blth-particles {
          position: absolute; inset: 0; pointer-events: none; z-index: 0;
          overflow: hidden;
        }
        #${scopeId} .blth-particle {
          position: absolute;
          width: 2px; height: 2px; border-radius: 50%;
          background: rgba(212,168,75,0.25);
          animation: blthFloat linear infinite;
        }
        @keyframes blthFloat {
          0%   { transform: translateY(0) translateX(0); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 0.4; }
          100% { transform: translateY(-100px) translateX(30px); opacity: 0; }
        }

        /* ── RENAME INLINE ── */
        #${scopeId} .blth-rename-input {
          writing-mode: vertical-rl; transform: rotate(180deg);
          background: rgba(0,0,0,0.5); border: 1px solid rgba(212,168,75,0.3);
          color: #fff; font-size: 11px; font-family: 'Cormorant Garamond', serif;
          outline: none; width: 100%; max-height: 140px; text-align: center;
          border-radius: 3px;
        }

        /* Color picker mini */
        #${scopeId} .blth-color-mini-row {
          display: flex; gap: 5px; flex-wrap: wrap; padding: 10px 14px;
        }
        #${scopeId} .blth-color-mini-dot {
          width: 22px; height: 22px; border-radius: 50%;
          cursor: pointer; border: 2px solid transparent;
          transition: transform 0.15s;
        }
        #${scopeId} .blth-color-mini-dot:hover { transform: scale(1.2); }
        #${scopeId} .blth-color-mini-dot.selected { border-color: var(--gold); }

        /* ── STATS BAR ── */
        #${scopeId} .blth-stats-bar {
          display: flex; gap: 20px;
          padding: 8px 20px;
          border-bottom: 1px solid rgba(212,168,75,0.06);
          background: rgba(10,6,4,0.6);
          position: relative; z-index: 1;
        }
        #${scopeId} .blth-stat {
          font-size: 11px; color: rgba(232,213,192,0.3);
          display: flex; align-items: center; gap: 5px;
        }
        #${scopeId} .blth-stat-num {
          color: var(--gold); font-weight: 600;
          font-size: 13px;
        }
      `;
      document.head.appendChild(style);
    },

    // ─── RENDER ───
    async render(container) {
      const scopeId = 'book-lth-app';
      container.innerHTML = '';
      container.style.cssText = 'position:relative;width:100%;height:100%;overflow:hidden;display:block;';

      const root = document.createElement('div');
      root.id = scopeId;
      container.appendChild(root);

      this._injectStyles(scopeId);
      await this._initStorage();
      await this._loadBooks();

      this._container = root;
      this._renderMain();

      // Book LTH tiene la interfaz montada pero todavia no funciona. Sin este
      // aviso parece terminada y el usuario cree que esta rota.
      window.LTHConstruccion?.marcar(container, {
        app: 'Book LTH',
        nota: 'Ahora mismo es solo la parte visual: puedes recorrer la biblioteca y el editor, pero todavia no guarda tus libros.'
      });
    },

    _renderMain() {
      const c = this._container;
      if (this.state.view === 'library') {
        this._renderLibrary(c);
      } else if (this.state.view === 'editor') {
        this._renderEditor(c);
      }
    },

    // ───────────────────────────── LIBRARY ─────────────────────────────
    _renderLibrary(c) {
      c.innerHTML = '';

      // Particles
      const particles = document.createElement('div');
      particles.className = 'blth-particles';
      for (let i = 0; i < 15; i++) {
        const p = document.createElement('div');
        p.className = 'blth-particle';
        p.style.cssText = `
          left: ${Math.random() * 100}%;
          bottom: ${Math.random() * 50}%;
          animation-duration: ${5 + Math.random() * 8}s;
          animation-delay: ${Math.random() * 6}s;
          width: ${1 + Math.random() * 1.5}px; height: ${1 + Math.random() * 1.5}px;
        `;
        particles.appendChild(p);
      }
      c.appendChild(particles);

      // Header
      const header = document.createElement('div');
      header.className = 'blth-header';
      header.innerHTML = `
        <div class="blth-title">Book LTH <span>Biblioteca</span></div>
        <div class="blth-search-wrap">
          <input class="blth-search" type="text" placeholder="Buscar en la biblioteca..." value="${this._esc(this.state.searchQuery)}">
        </div>
        <button class="blth-btn blth-btn-add">＋ Nuevo libro</button>
      `;
      c.appendChild(header);

      header.querySelector('.blth-search').addEventListener('input', (e) => {
        this.state.searchQuery = e.target.value.toLowerCase();
        this._refreshBooks();
      });

      header.querySelector('.blth-btn-add').addEventListener('click', () => {
        this._showCreateModal();
      });

      // Stats bar
      const totalBooks = this.state.books.length;
      const avgRating = totalBooks > 0
        ? (this.state.books.reduce((s, b) => s + (b.rating || 0), 0) / totalBooks).toFixed(1)
        : '—';
      const statsBar = document.createElement('div');
      statsBar.className = 'blth-stats-bar';
      statsBar.innerHTML = `
        <div class="blth-stat"><span class="blth-stat-num">${totalBooks}</span> libros</div>
        <div class="blth-stat">⭐ <span class="blth-stat-num">${avgRating}</span> promedio</div>
      `;
      c.appendChild(statsBar);

      // Library content
      const library = document.createElement('div');
      library.className = 'blth-library';
      library.id = 'blth-library-content';
      c.appendChild(library);

      this._refreshBooks();
    },

    _refreshBooks() {
      const library = this._container.querySelector('#blth-library-content');
      if (!library) return;
      const q = this.state.searchQuery;
      const books = this.state.books;

      if (books.length === 0) {
        library.innerHTML = `
          <div class="blth-empty">
            <div class="blth-empty-icon">📖</div>
            <div class="blth-empty-text">Tu biblioteca está vacía</div>
            <div class="blth-empty-sub">Crea tu primer libro con ＋ Nuevo libro</div>
          </div>`;
        return;
      }

      const shelfSize = 7;
      const shelves = [];
      for (let i = 0; i < books.length; i += shelfSize) {
        shelves.push(books.slice(i, i + shelfSize));
      }

      library.innerHTML = '';
      shelves.forEach((shelfBooks, si) => {
        const wrap = document.createElement('div');
        wrap.className = 'blth-shelf-wrap';
        wrap.style.animationDelay = si * 0.1 + 's';

        const label = document.createElement('div');
        label.className = 'blth-shelf-label';
        label.textContent = `Estante ${si + 1}`;
        wrap.appendChild(label);

        const shelf = document.createElement('div');
        shelf.className = 'blth-shelf';

        const row = document.createElement('div');
        row.className = 'blth-books-row';

        shelfBooks.forEach((book, bi) => {
          const el = this._createBookEl(book, bi);
          const hidden = q && !book.title.toLowerCase().includes(q);
          if (hidden) el.classList.add('blth-hidden');
          row.appendChild(el);
        });

        shelf.appendChild(row);
        wrap.appendChild(shelf);

        const floor = document.createElement('div');
        floor.className = 'blth-shelf-floor';
        wrap.appendChild(floor);

        library.appendChild(wrap);
      });
    },

    _createBookEl(book, index) {
      const el = document.createElement('div');
      el.className = 'blth-book';
      el.dataset.id = book.id;
      const bookHeight = 160 + (book.id.charCodeAt(0) % 5) * 12;
      el.style.cssText = `
        height: ${bookHeight}px;
        animation-delay: ${index * 0.06}s;
      `;

      const color = book.color;
      const lighten = this._lighten(color, 25);
      const darken = this._lighten(color, -30);
      const date = new Date(book.createdAt).toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric' });
      const rating = book.rating || 0;
      const desc = book.description || '';

      // Build stars HTML (mini on book)
      let starsBookHTML = '';
      for (let i = 1; i <= 5; i++) {
        starsBookHTML += `<span class="${i <= rating ? 'filled' : ''}">★</span>`;
      }

      // Tooltip stars
      let starsTooltipHTML = '';
      for (let i = 1; i <= 5; i++) {
        starsTooltipHTML += `<span class="${i <= rating ? 'filled' : ''}">★</span>`;
      }

      el.innerHTML = `
        <div class="blth-book-3d">
          <div class="blth-book-cover" style="background: linear-gradient(160deg, ${lighten} 0%, ${color} 40%, ${darken} 100%);">
            <div class="blth-book-spine"></div>
            <div class="blth-book-shine"></div>
            <div class="blth-book-cover-art">
              <div class="blth-book-cover-line"></div>
              <div class="blth-book-cover-line" style="width:40%"></div>
              <div class="blth-book-cover-ornament"></div>
              <div class="blth-book-title">${this._esc(book.title)}</div>
              <div class="blth-book-cover-line" style="margin-top:auto; width:50%"></div>
            </div>
            <div class="blth-book-stars-mini">${starsBookHTML}</div>
          </div>
          <div class="blth-book-pages"></div>
        </div>
        <div class="blth-tooltip">
          <div class="blth-tooltip-title">${this._esc(book.title)}</div>
          ${desc ? `<div class="blth-tooltip-desc">${this._esc(desc)}</div>` : ''}
          <div class="blth-tooltip-meta">
            <span>${date}</span>
            <div class="blth-tooltip-stars">${starsTooltipHTML}</div>
          </div>
        </div>
      `;

      // Click → show preview modal
      el.addEventListener('click', (e) => {
        if (e.target.closest('.blth-ctx-menu')) return;
        this._showPreviewModal(book);
      });

      // Right click → context menu
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this._showContextMenu(e.clientX, e.clientY, book, el);
      });

      return el;
    },

    _lighten(hex, amount) {
      try {
        let r = parseInt(hex.slice(1, 3), 16);
        let g = parseInt(hex.slice(3, 5), 16);
        let b = parseInt(hex.slice(5, 7), 16);
        r = Math.min(255, Math.max(0, r + amount));
        g = Math.min(255, Math.max(0, g + amount));
        b = Math.min(255, Math.max(0, b + amount));
        return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
      } catch { return hex; }
    },

    // ───────────────────────────── PREVIEW MODAL ─────────────────────────────
    _showPreviewModal(book) {
      const overlay = document.createElement('div');
      overlay.className = 'blth-modal-overlay';

      const rating = book.rating || 0;
      const desc = book.description || '';
      const date = new Date(book.createdAt).toLocaleDateString('es-HN', {
        day: '2-digit', month: 'long', year: 'numeric'
      });
      const color = book.color;
      const lighten = this._lighten(color, 30);

      let starsHTML = '';
      for (let i = 1; i <= 5; i++) {
        starsHTML += `<span class="blth-star ${i <= rating ? 'filled' : ''}" data-val="${i}">★</span>`;
      }

      const modal = document.createElement('div');
      modal.className = 'blth-preview-modal';
      modal.innerHTML = `
        <div class="blth-preview-cover">
          <div class="blth-preview-cover-bg" style="background: linear-gradient(135deg, ${color}, ${lighten});"></div>
          <div class="blth-preview-book-icon" style="background: linear-gradient(160deg, ${lighten}, ${color});">
            <span class="pbi-label">${this._esc(book.title)}</span>
          </div>
        </div>
        <div class="blth-preview-body">
          <div class="blth-preview-name">${this._esc(book.title)}</div>
          <div class="blth-preview-type">${book.type === 'note' ? '📝 Nota' : '📄 Documento'}</div>
          <textarea class="blth-preview-desc-edit" placeholder="Agregar descripción...">${this._esc(desc)}</textarea>
          <div class="blth-stars-row">${starsHTML}</div>
          <div class="blth-preview-date">Creado el ${date}</div>
          <div class="blth-preview-btns">
            <button class="blth-btn blth-btn-ghost" id="blth-preview-close">Cerrar</button>
            <button class="blth-btn blth-btn-primary" id="blth-preview-open">📖 Abrir libro</button>
          </div>
        </div>
      `;

      overlay.appendChild(modal);
      this._container.appendChild(overlay);

      // Star rating interaction
      let currentRating = rating;
      const stars = modal.querySelectorAll('.blth-star');
      stars.forEach(star => {
        star.addEventListener('mouseenter', () => {
          const val = parseInt(star.dataset.val);
          stars.forEach(s => {
            const sv = parseInt(s.dataset.val);
            s.classList.toggle('hovered', sv <= val && sv > currentRating);
          });
        });
        star.addEventListener('mouseleave', () => {
          stars.forEach(s => s.classList.remove('hovered'));
        });
        star.addEventListener('click', async () => {
          currentRating = parseInt(star.dataset.val);
          stars.forEach(s => {
            const sv = parseInt(s.dataset.val);
            s.classList.toggle('filled', sv <= currentRating);
            s.classList.remove('hovered');
          });
          // Save rating
          book.rating = currentRating;
          const idx = this.state.books.findIndex(b => b.id === book.id);
          if (idx >= 0) this.state.books[idx].rating = currentRating;
          const fullDoc = await this._loadDoc(book.id);
          if (fullDoc) { fullDoc.rating = currentRating; await this._saveDoc(fullDoc); }
          await this._saveIndex();
        });
      });

      // Description auto-save on blur
      const descEl = modal.querySelector('.blth-preview-desc-edit');
      descEl.addEventListener('blur', async () => {
        const newDesc = descEl.value.trim();
        book.description = newDesc;
        const idx = this.state.books.findIndex(b => b.id === book.id);
        if (idx >= 0) this.state.books[idx].description = newDesc;
        const fullDoc = await this._loadDoc(book.id);
        if (fullDoc) { fullDoc.description = newDesc; await this._saveDoc(fullDoc); }
        await this._saveIndex();
      });

      // Close
      modal.querySelector('#blth-preview-close').addEventListener('click', () => {
        // trigger desc save before closing
        descEl.blur();
        setTimeout(() => {
          overlay.remove();
          this._refreshBooks();
        }, 50);
      });
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          descEl.blur();
          setTimeout(() => {
            overlay.remove();
            this._refreshBooks();
          }, 50);
        }
      });

      // Open
      modal.querySelector('#blth-preview-open').addEventListener('click', () => {
        descEl.blur();
        setTimeout(() => {
          overlay.remove();
          this._openBook(book.id);
        }, 50);
      });
    },

    // ───────────────────────────── CONTEXT MENU ─────────────────────────────
    _showContextMenu(x, y, book, bookEl) {
      this._closeContextMenu();

      const menu = document.createElement('div');
      menu.className = 'blth-ctx-menu';
      menu.id = 'blth-ctx-menu';

      const items = [
        { icon: '📖', label: 'Abrir', action: () => this._showPreviewModal(book) },
        { icon: '✏️', label: 'Renombrar', action: () => this._renameBook(book, bookEl) },
        { icon: '🎨', label: 'Cambiar color', action: () => this._changeColor(book, bookEl, menu) },
        { sep: true },
        { icon: '🗑️', label: 'Eliminar', action: () => this._deleteBook(book.id, bookEl), danger: true },
      ];

      items.forEach(item => {
        if (item.sep) {
          const sep = document.createElement('div');
          sep.className = 'blth-ctx-sep';
          menu.appendChild(sep);
          return;
        }
        const el = document.createElement('div');
        el.className = 'blth-ctx-item' + (item.danger ? ' danger' : '');
        el.innerHTML = `<span>${item.icon}</span><span>${item.label}</span>`;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          this._closeContextMenu();
          item.action();
        });
        menu.appendChild(el);
      });

      menu.style.left = x + 'px';
      menu.style.top = y + 'px';
      document.body.appendChild(menu);

      requestAnimationFrame(() => {
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + 'px';
        if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + 'px';
      });

      setTimeout(() => {
        document.addEventListener('click', this._closeContextMenu.bind(this), { once: true });
      }, 0);
    },

    _closeContextMenu() {
      const m = document.getElementById('blth-ctx-menu');
      if (m) m.remove();
    },

    // ───────────────────────────── CREATE MODAL ─────────────────────────────
    _showCreateModal() {
      const overlay = document.createElement('div');
      overlay.className = 'blth-modal-overlay';

      let selectedColor = this._bookColors[Math.floor(Math.random() * this._bookColors.length)];

      overlay.innerHTML = `
        <div class="blth-modal">
          <div class="blth-modal-title">
            <div class="blth-modal-icon">📖</div>
            Nuevo Libro
          </div>
          <label>Título</label>
          <input class="blth-input" id="blth-new-title" type="text" placeholder="El título de tu libro..." autofocus>
          <label>Descripción breve</label>
          <textarea class="blth-textarea" id="blth-new-desc" placeholder="¿De qué trata este libro?"></textarea>
          <label>Tipo</label>
          <select class="blth-input" id="blth-new-type">
            <option value="note">📝 Nota</option>
            <option value="doc">📄 Documento</option>
          </select>
          <label>Color de portada</label>
          <div class="blth-color-row" id="blth-color-row"></div>
          <div class="blth-modal-btns">
            <button class="blth-btn blth-btn-ghost" id="blth-modal-cancel">Cancelar</button>
            <button class="blth-btn blth-btn-primary" id="blth-modal-create">Crear libro</button>
          </div>
        </div>
      `;

      this._container.appendChild(overlay);

      // Colors
      const colorRow = overlay.querySelector('#blth-color-row');
      this._bookColors.forEach(color => {
        const dot = document.createElement('div');
        dot.className = 'blth-color-dot' + (color === selectedColor ? ' selected' : '');
        dot.style.background = color;
        dot.addEventListener('click', () => {
          colorRow.querySelectorAll('.blth-color-dot').forEach(d => d.classList.remove('selected'));
          dot.classList.add('selected');
          selectedColor = color;
        });
        colorRow.appendChild(dot);
      });

      setTimeout(() => overlay.querySelector('#blth-new-title').focus(), 100);

      overlay.querySelector('#blth-modal-cancel').addEventListener('click', () => overlay.remove());
      overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

      const create = () => {
        const title = overlay.querySelector('#blth-new-title').value.trim() || 'Sin título';
        const desc = overlay.querySelector('#blth-new-desc').value.trim();
        const type = overlay.querySelector('#blth-new-type').value;
        overlay.remove();
        this._createBook(title, type, selectedColor, desc);
      };
      overlay.querySelector('#blth-modal-create').addEventListener('click', create);
      overlay.querySelector('#blth-new-title').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') create();
        if (e.key === 'Escape') overlay.remove();
      });
    },

    async _createBook(title, type, color, description) {
      const id = this._genId();
      const now = new Date().toISOString();
      const book = { id, title, color, type, description: description || '', rating: 0, content: '', createdAt: now, updatedAt: now };
      this.state.books.push(book);
      await this._saveIndex();
      await this._saveDoc(book);

      this._refreshBooks();
      setTimeout(() => {
        const el = this._container.querySelector(`[data-id="${id}"]`);
        if (el) {
          el.classList.add('blth-new');
          const shimmer = document.createElement('div');
          shimmer.style.cssText = `
            position:absolute; top:0; left:0; right:0; height:30px;
            background: linear-gradient(180deg, rgba(255,255,255,0.3) 0%, transparent 100%);
            animation: blthShimmer 0.6s ease both;
            pointer-events:none; border-radius: 2px; z-index: 10;
          `;
          el.appendChild(shimmer);
          setTimeout(() => shimmer.remove(), 700);
        }
      }, 50);

      // Open preview instead of editor directly
      setTimeout(() => this._showPreviewModal(book), 350);
    },

    // ───────────────────────────── OPEN / EDITOR ─────────────────────────────
    async _openBook(id) {
      const bookMeta = this.state.books.find(b => b.id === id);
      if (!bookMeta) return;

      const fullDoc = await this._loadDoc(id);
      const book = fullDoc || bookMeta;

      this.state.activeBook = { ...bookMeta, content: book.content || '' };
      this.state.view = 'editor';
      this._renderEditor(this._container);
    },

    _renderEditor(c) {
      c.innerHTML = '';

      const book = this.state.activeBook;
      if (!book) { this.state.view = 'library'; this._renderLibrary(c); return; }

      // Header
      const header = document.createElement('div');
      header.className = 'blth-header blth-editor-header';
      header.innerHTML = `
        <button class="blth-btn blth-btn-back">← Biblioteca</button>
        <div class="blth-editor-color-stripe" style="background:${book.color}"></div>
        <div class="blth-editor-doc-title" contenteditable="true" spellcheck="false">${this._esc(book.title)}</div>
        <div class="blth-save-indicator" id="blth-save-ind">✓ Guardado</div>
      `;
      c.appendChild(header);

      header.querySelector('.blth-btn-back').addEventListener('click', () => {
        this._flushSave();
        this.state.view = 'library';
        this.state.activeBook = null;
        this._renderLibrary(c);
      });

      const titleEl = header.querySelector('.blth-editor-doc-title');
      titleEl.addEventListener('input', () => {
        this._scheduleSave(titleEl, editorBody);
      });

      // Toolbar
      const toolbar = document.createElement('div');
      toolbar.className = 'blth-toolbar';
      toolbar.innerHTML = `
        <button class="blth-tool-btn" data-cmd="bold" title="Negrita">B</button>
        <button class="blth-tool-btn" style="font-style:italic" data-cmd="italic" title="Itálica">I</button>
        <button class="blth-tool-btn" style="text-decoration:underline" data-cmd="underline" title="Subrayado">U</button>
        <div class="blth-tool-sep"></div>
        <button class="blth-tool-btn" data-cmd="insertUnorderedList" title="Lista">☰</button>
        <button class="blth-tool-btn" data-cmd="insertOrderedList" title="Lista num.">①</button>
        <div class="blth-tool-sep"></div>
        <button class="blth-tool-btn" data-cmd="h2" title="Título">H</button>
        <button class="blth-tool-btn" data-cmd="removeFormat" title="Limpiar">✕</button>
      `;
      c.appendChild(toolbar);

      toolbar.querySelectorAll('.blth-tool-btn').forEach(btn => {
        btn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          const cmd = btn.dataset.cmd;
          if (cmd === 'h2') {
            document.execCommand('formatBlock', false, 'h2');
          } else {
            document.execCommand(cmd, false, null);
          }
          editorBody.focus();
        });
      });

      // Editor
      const editorWrap = document.createElement('div');
      editorWrap.className = 'blth-editor-wrap';

      const editorBody = document.createElement('div');
      editorBody.className = 'blth-editor-body';
      editorBody.contentEditable = 'true';
      editorBody.dataset.placeholder = 'Escribe aquí tu documento...';
      editorBody.innerHTML = book.content || '';
      editorWrap.appendChild(editorBody);
      c.appendChild(editorWrap);

      editorBody.focus();

      editorBody.addEventListener('input', () => {
        this._scheduleSave(titleEl, editorBody);
      });
    },

    _scheduleSave(titleEl, bodyEl) {
      if (this.state.saveTimer) clearTimeout(this.state.saveTimer);
      this.state.saveTimer = setTimeout(() => this._doSave(titleEl, bodyEl), 2500);
    },

    async _doSave(titleEl, bodyEl) {
      const book = this.state.activeBook;
      if (!book) return;
      const newTitle = titleEl?.innerText?.trim() || book.title;
      const newContent = bodyEl?.innerHTML || book.content;

      book.title = newTitle;
      book.content = newContent;
      book.updatedAt = new Date().toISOString();

      const idx = this.state.books.findIndex(b => b.id === book.id);
      if (idx >= 0) {
        this.state.books[idx].title = newTitle;
        this.state.books[idx].updatedAt = book.updatedAt;
      }

      await this._saveDoc(book);
      await this._saveIndex();

      const ind = this._container.querySelector('#blth-save-ind');
      if (ind) {
        ind.classList.add('visible');
        setTimeout(() => ind.classList.remove('visible'), 2000);
      }
    },

    _flushSave() {
      if (this.state.saveTimer) {
        clearTimeout(this.state.saveTimer);
        this.state.saveTimer = null;
      }
    },

    // ───────────────────────────── RENAME ─────────────────────────────
    _renameBook(book, bookEl) {
      const titleEl = bookEl.querySelector('.blth-book-title');
      if (!titleEl) return;
      const input = document.createElement('input');
      input.className = 'blth-rename-input';
      input.value = book.title;
      titleEl.replaceWith(input);
      input.focus();

      const finish = async () => {
        const newTitle = input.value.trim() || book.title;
        book.title = newTitle;
        const idx = this.state.books.findIndex(b => b.id === book.id);
        if (idx >= 0) this.state.books[idx].title = newTitle;
        const div = document.createElement('div');
        div.className = 'blth-book-title';
        div.textContent = newTitle;
        input.replaceWith(div);
        await this._saveIndex();
        const fullDoc = await this._loadDoc(book.id);
        if (fullDoc) { fullDoc.title = newTitle; await this._saveDoc(fullDoc); }
      };

      input.addEventListener('blur', finish);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { input.value = book.title; input.blur(); }
      });
    },

    // ───────────────────────────── CHANGE COLOR ─────────────────────────────
    _changeColor(book, bookEl, menu) {
      const picker = document.createElement('div');
      picker.className = 'blth-ctx-menu';
      picker.id = 'blth-color-picker-menu';
      picker.style.cssText = menu.style.cssText;

      const row = document.createElement('div');
      row.className = 'blth-color-mini-row';
      this._bookColors.forEach(color => {
        const dot = document.createElement('div');
        dot.className = 'blth-color-mini-dot' + (color === book.color ? ' selected' : '');
        dot.style.background = color;
        dot.addEventListener('click', async () => {
          book.color = color;
          const idx = this.state.books.findIndex(b => b.id === book.id);
          if (idx >= 0) this.state.books[idx].color = color;
          // Refresh the book element
          this._refreshBooks();
          const fullDoc = await this._loadDoc(book.id);
          if (fullDoc) { fullDoc.color = color; await this._saveDoc(fullDoc); }
          await this._saveIndex();
          picker.remove();
        });
        row.appendChild(dot);
      });
      picker.appendChild(row);
      document.body.appendChild(picker);
      setTimeout(() => document.addEventListener('click', () => picker.remove(), { once: true }), 0);
    },

    // ───────────────────────────── DELETE ─────────────────────────────
    async _deleteBook(id, bookEl) {
      if (bookEl) {
        bookEl.classList.add('blth-removing');
        await new Promise(r => setTimeout(r, 400));
        bookEl.remove();
      }
      this.state.books = this.state.books.filter(b => b.id !== id);
      await this._deleteDoc(id);
      await this._saveIndex();
      this._refreshBooks();
    },

    // ───────────────────────────── UTILS ─────────────────────────────
    _esc(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    },
  };

  // Register with AppLoader
  if (window.AppLoader?.registerApp) {
    window.AppLoader.registerApp({
      id: 'book-lth',
      name: 'Book LTH',
      icon: '📚',
      iconUrl: BOOK_LTH_ICON_URL,
      gradient: 'linear-gradient(135deg, #8B5E3C, #D4A76A)'
    });
  }

})();
