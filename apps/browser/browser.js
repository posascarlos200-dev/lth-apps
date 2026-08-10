/**
 * browser.js — LTH Browser v3
 * Renderer: solo UI. Toda la lógica de seguridad vive en browser-engine.js.
 *
 * Registro en AppLoader:
 *   window.LTH_APPS['browser'] = { ... }
 *   AppLoader.registerApp({ id:'browser', name:'Browser LTH', ... })
 */

(function () {
  'use strict';

  // ─── Derivar path del preload del webview ──────────────────────────────────
  // Convierte "file:///D:/LTH-iOs/index.html" → "file:///D:/LTH-iOs/electron/browser-preload.js"
  const _preloadPath = (() => {
    try {
      // window.location.href = "file:///D:/LTH-iOs/src/index.html"
      // base  = "file:///D:/LTH-iOs/src"
      // root  = "file:///D:/LTH-iOs"   ← un nivel arriba
      const base = window.location.href.replace(/\/[^/]+\.html.*$/, '');
      const root = base.substring(0, base.lastIndexOf('/'));
      return root + '/electron/browser-preload.js';
    } catch {
      return '';
    }
  })();

  const ipc = window.electron?.browser;
  const AUTH_IN_EMBEDDED_BROWSER = true;
  const EXTERNAL_AUTH_HOSTS = new Set([
    'accounts.google.com',
    'auth.openai.com',
    'login.microsoftonline.com',
    'appleid.apple.com',
  ]);

  // ─── Estado del renderer ───────────────────────────────────────────────────
  const state = {
    url:        '',
    title:      '',
    loading:    false,
    canBack:    false,
    canForward: false,
    blocked:    false,
    blockReason:'',
    favorites:  [],
    showFavBar: true,
    notice:     '',
    activeTab:  'browser', // 'browser' | 'newtab' | 'blocked'
  };

  // ─── Referencia al webview ─────────────────────────────────────────────────
  let $webview = null;
  let $root    = null;
  let _noticeTimer = null;

  // ══════════════════════════════════════════════════════════════════════════
  // HTML
  // ══════════════════════════════════════════════════════════════════════════
  function _buildHTML() {
    return `
    <style>
      /* ── Reset ─────────────────────────────────────────── */
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

      /* ── Variables ─────────────────────────────────────── */
      :root {
        --bg-deep:    #080c12;
        --bg-glass:   rgba(12, 18, 30, 0.82);
        --bg-glass2:  rgba(18, 26, 44, 0.72);
        --border:     rgba(80, 160, 255, 0.13);
        --border-hov: rgba(80, 160, 255, 0.32);
        --neon:       #3ecfff;
        --neon2:      #7b5fff;
        --neon-glow:  rgba(62, 207, 255, 0.18);
        --text:       #ddeeff;
        --text-dim:   rgba(180, 210, 240, 0.55);
        --red:        #ff4466;
        --green:      #39ffb0;
        --radius:     10px;
        --bar-h:      42px;
        --favbar-h:   32px;
        --transition: 0.18s cubic-bezier(.4,0,.2,1);
      }

      /* ── Shell ──────────────────────────────────────────── */
      #lth-browser {
        position: absolute; inset: 0;
        display: flex; flex-direction: column;
        background: var(--bg-deep);
        font-family: 'Inter', 'Segoe UI', sans-serif;
        color: var(--text);
        overflow: hidden;
        user-select: none;
      }

      /* ── Toolbar ────────────────────────────────────────── */
      #br-toolbar {
        height: var(--bar-h);
        min-height: var(--bar-h);
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 0 10px;
        background: var(--bg-glass);
        border-bottom: 1px solid var(--border);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        z-index: 10;
      }

      /* Botones de nav */
      .br-navbtn {
        width: 30px; height: 30px;
        border: none; background: transparent;
        color: var(--text-dim);
        cursor: pointer;
        border-radius: 7px;
        display: flex; align-items: center; justify-content: center;
        transition: background var(--transition), color var(--transition);
        flex-shrink: 0;
      }
      .br-navbtn:hover { background: rgba(62,207,255,0.1); color: var(--neon); }
      .br-navbtn:active { background: rgba(62,207,255,0.2); }
      .br-navbtn:disabled { opacity: 0.28; cursor: default; pointer-events: none; }
      .br-navbtn svg { width: 16px; height: 16px; }

      /* Barra de URL */
      #br-urlwrap {
        flex: 1;
        position: relative;
        display: flex; align-items: center;
      }
      #br-url {
        width: 100%;
        height: 28px;
        background: rgba(8,14,24,0.7);
        border: 1px solid var(--border);
        border-radius: 7px;
        color: var(--text);
        font-size: 12.5px;
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
        padding: 0 32px 0 10px;
        outline: none;
        transition: border-color var(--transition), box-shadow var(--transition);
        caret-color: var(--neon);
      }
      #br-url:focus {
        border-color: var(--neon);
        box-shadow: 0 0 0 3px var(--neon-glow);
        background: rgba(8,14,24,0.95);
      }
      #br-url::selection { background: rgba(62,207,255,0.25); }
      #br-secure {
        position: absolute; right: 8px;
        width: 14px; height: 14px;
        opacity: 0.5;
        pointer-events: none;
      }

      /* Botón buscar / ir */
      #br-go {
        width: 30px; height: 30px;
        border: 1px solid var(--border);
        background: rgba(62,207,255,0.08);
        color: var(--neon);
        border-radius: 7px;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
        transition: all var(--transition);
      }
      #br-go:hover { background: rgba(62,207,255,0.18); border-color: var(--neon); }
      #br-go svg { width: 14px; height: 14px; }

      /* Botón favorito */
      #br-favbtn {
        width: 30px; height: 30px;
        border: none; background: transparent;
        color: var(--text-dim);
        cursor: pointer; border-radius: 7px;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
        transition: all var(--transition);
      }
      #br-favbtn:hover { color: #ffd966; background: rgba(255,217,102,0.1); }
      #br-favbtn.active { color: #ffd966; }
      #br-favbtn svg { width: 16px; height: 16px; }

      /* Botón cerrar */
      #br-close {
        width: 30px; height: 30px;
        border: none; background: transparent;
        color: var(--text-dim);
        cursor: pointer; border-radius: 7px;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
        transition: background var(--transition), color var(--transition);
        margin-left: 2px;
      }
      #br-close:hover { background: rgba(255,68,102,0.15); color: var(--red); }
      #br-close:active { background: rgba(255,68,102,0.28); }
      #br-close svg { width: 15px; height: 15px; }

      /* Loader bar */
      #br-loader {
        position: absolute; bottom: 0; left: 0;
        height: 2px; width: 0%;
        background: linear-gradient(90deg, var(--neon), var(--neon2));
        transition: width 0.3s ease;
        border-radius: 0 2px 2px 0;
        box-shadow: 0 0 8px var(--neon);
        opacity: 0;
      }
      #br-toolbar.loading #br-loader { opacity: 1; }

      /* ── Barra de favoritos ─────────────────────────────── */
      #br-favbar {
        height: var(--favbar-h);
        min-height: var(--favbar-h);
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 0 10px;
        background: var(--bg-glass2);
        border-bottom: 1px solid var(--border);
        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-width: none;
      }
      #br-favbar::-webkit-scrollbar { display: none; }
      #br-favbar.hidden { display: none; }

      .br-favitem {
        display: flex; align-items: center; gap: 5px;
        padding: 0 9px;
        height: 22px;
        border-radius: 5px;
        background: transparent;
        border: none;
        color: var(--text-dim);
        font-size: 11.5px;
        cursor: pointer;
        white-space: nowrap;
        flex-shrink: 0;
        transition: all var(--transition);
        max-width: 160px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .br-favitem:hover {
        background: rgba(62,207,255,0.1);
        color: var(--neon);
      }
      .br-favitem img { width: 12px; height: 12px; border-radius: 2px; }
      .br-favitem .br-fav-globe {
        width: 12px; height: 12px; opacity: 0.4; flex-shrink: 0;
      }

      /* ── Content area ───────────────────────────────────── */
      #br-content {
        flex: 1;
        position: relative;
        overflow: hidden;
      }

      /* Webview */
      #br-webview {
        position: absolute; inset: 0;
        width: 100%; height: 100%;
        border: none;
        background: #fff;
      }
      #br-webview.hidden { visibility: hidden; }

      /* ── New Tab ────────────────────────────────────────── */
      #br-newtab {
        position: absolute; inset: 0;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 32px;
        background: radial-gradient(ellipse at 50% 30%, rgba(62,207,255,0.06) 0%, transparent 60%),
                    var(--bg-deep);
        opacity: 0; pointer-events: none;
        transition: opacity 0.25s ease;
      }
      #br-newtab.visible { opacity: 1; pointer-events: all; }

      .br-nt-logo {
        display: flex; flex-direction: column; align-items: center; gap: 10px;
      }
      .br-nt-logo-icon {
        width: 52px; height: 52px;
        border-radius: 14px;
        background: linear-gradient(135deg, rgba(62,207,255,0.15), rgba(123,95,255,0.15));
        border: 1px solid rgba(62,207,255,0.2);
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 0 24px rgba(62,207,255,0.08);
      }
      .br-nt-logo-icon svg { width: 26px; height: 26px; color: var(--neon); }
      .br-nt-title {
        font-size: 13px; font-weight: 500;
        color: var(--text-dim); letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      /* Buscador new tab */
      #br-nt-form {
        display: flex; gap: 8px;
        width: min(420px, 88%);
      }
      #br-nt-input {
        flex: 1;
        height: 42px;
        background: rgba(12,18,30,0.9);
        border: 1px solid var(--border);
        border-radius: 10px;
        color: var(--text);
        font-size: 14px;
        padding: 0 16px;
        outline: none;
        transition: border-color var(--transition), box-shadow var(--transition);
        caret-color: var(--neon);
      }
      #br-nt-input:focus {
        border-color: var(--neon);
        box-shadow: 0 0 0 3px var(--neon-glow);
      }
      #br-nt-input::placeholder { color: var(--text-dim); }
      #br-nt-btn {
        height: 42px; padding: 0 18px;
        background: linear-gradient(135deg, rgba(62,207,255,0.2), rgba(123,95,255,0.2));
        border: 1px solid rgba(62,207,255,0.25);
        border-radius: 10px;
        color: var(--neon);
        font-size: 13px; font-weight: 600;
        cursor: pointer;
        transition: all var(--transition);
        letter-spacing: 0.04em;
      }
      #br-nt-btn:hover {
        background: linear-gradient(135deg, rgba(62,207,255,0.3), rgba(123,95,255,0.3));
        box-shadow: 0 0 16px var(--neon-glow);
      }

      /* Accesos rápidos */
      #br-nt-shortcuts {
        display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;
        width: min(480px, 92%);
      }
      .br-shortcut {
        display: flex; flex-direction: column; align-items: center; gap: 6px;
        width: 68px; cursor: pointer; border-radius: 10px;
        padding: 10px 4px;
        transition: background var(--transition);
        border: none; background: transparent;
        color: var(--text-dim);
      }
      .br-shortcut:hover { background: rgba(62,207,255,0.07); color: var(--text); }
      .br-shortcut-icon {
        width: 40px; height: 40px; border-radius: 10px;
        display: flex; align-items: center; justify-content: center;
        font-size: 18px;
        border: 1px solid var(--border);
        background: rgba(12,18,30,0.6);
      }
      .br-shortcut span { font-size: 10.5px; text-align: center; line-height: 1.2; }

      /* ── Página bloqueada ───────────────────────────────── */
      #br-blocked {
        position: absolute; inset: 0;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 16px;
        background: radial-gradient(ellipse at 50% 40%, rgba(255,68,102,0.06) 0%, transparent 60%),
                    var(--bg-deep);
        opacity: 0; pointer-events: none;
        transition: opacity 0.25s ease;
        text-align: center; padding: 32px;
      }
      #br-blocked.visible { opacity: 1; pointer-events: all; }

      .br-blocked-icon {
        width: 60px; height: 60px; border-radius: 16px;
        background: rgba(255,68,102,0.1);
        border: 1px solid rgba(255,68,102,0.25);
        display: flex; align-items: center; justify-content: center;
      }
      .br-blocked-icon svg { width: 28px; height: 28px; color: var(--red); }
      .br-blocked-title { font-size: 17px; font-weight: 600; color: var(--text); }
      .br-blocked-url {
        font-size: 12px; color: var(--text-dim);
        font-family: monospace;
        max-width: 380px; overflow: hidden; text-overflow: ellipsis;
        white-space: nowrap;
      }
      .br-blocked-reason {
        font-size: 11.5px; color: rgba(255,68,102,0.7);
        padding: 4px 12px; border-radius: 20px;
        background: rgba(255,68,102,0.08);
        border: 1px solid rgba(255,68,102,0.15);
      }
      #br-blocked-back {
        margin-top: 8px;
        height: 36px; padding: 0 20px;
        background: transparent;
        border: 1px solid var(--border);
        border-radius: 8px;
        color: var(--text-dim); font-size: 13px;
        cursor: pointer;
        transition: all var(--transition);
      }
      #br-blocked-back:hover { border-color: var(--neon); color: var(--neon); }

      /* ── Status bar ─────────────────────────────────────── */
      #br-status {
        position: absolute;
        bottom: 8px; left: 10px;
        font-size: 10.5px; color: var(--text-dim);
        background: rgba(8,12,20,0.85);
        padding: 2px 8px; border-radius: 4px;
        max-width: 60%;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        opacity: 0; pointer-events: none;
        transition: opacity 0.2s;
        border: 1px solid var(--border);
        backdrop-filter: blur(8px);
      }
      #br-status.visible { opacity: 1; }

      #br-notice {
        position: absolute;
        top: 10px; right: 12px;
        max-width: min(420px, calc(100% - 24px));
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid rgba(62,207,255,0.24);
        background: rgba(8, 15, 26, 0.92);
        color: var(--text);
        font-size: 11.5px;
        line-height: 1.45;
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.24);
        backdrop-filter: blur(12px);
        opacity: 0;
        transform: translateY(-6px);
        pointer-events: none;
        transition: opacity 0.2s ease, transform 0.2s ease;
        z-index: 12;
      }
      #br-notice.visible {
        opacity: 1;
        transform: translateY(0);
      }

      /* ── Loading spinner en webview ─────────────────────── */
      #br-spinner {
        position: absolute;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        width: 36px; height: 36px;
        border: 2.5px solid rgba(62,207,255,0.12);
        border-top-color: var(--neon);
        border-radius: 50%;
        animation: br-spin 0.75s linear infinite;
        opacity: 0; pointer-events: none;
        transition: opacity 0.2s;
      }
      #br-spinner.visible { opacity: 1; }
      @keyframes br-spin { to { transform: translate(-50%,-50%) rotate(360deg); } }

      /* ── Scrollbar global ───────────────────────────────── */
      ::-webkit-scrollbar { width: 5px; height: 5px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(62,207,255,0.2); border-radius: 3px; }
    </style>

    <div id="lth-browser">

      <!-- TOOLBAR -->
      <div id="br-toolbar">
        <button class="br-navbtn" id="br-back" title="Atrás" disabled>
          ${_icon('back')}
        </button>
        <button class="br-navbtn" id="br-forward" title="Adelante" disabled>
          ${_icon('forward')}
        </button>
        <button class="br-navbtn" id="br-reload" title="Recargar">
          ${_icon('reload')}
        </button>
        <button class="br-navbtn" id="br-home" title="Nueva pestaña">
          ${_icon('home')}
        </button>

        <div id="br-urlwrap">
          <input id="br-url" type="text" spellcheck="false"
                 placeholder="Buscar o escribir URL…" autocomplete="off" />
          <svg id="br-secure" viewBox="0 0 16 16" fill="currentColor" style="display:none">
            <path d="M8 1a4 4 0 0 1 4 4v1h.5A1.5 1.5 0 0 1 14 7.5v6A1.5 1.5 0 0 1 12.5 15h-9A1.5 1.5 0 0 1 2 13.5v-6A1.5 1.5 0 0 1 3.5 6H4V5a4 4 0 0 1 4-4zm0 1.5A2.5 2.5 0 0 0 5.5 5v1h5V5A2.5 2.5 0 0 0 8 2.5z"/>
          </svg>
        </div>

        <button id="br-go" title="Ir">
          ${_icon('go')}
        </button>
        <button class="br-navbtn" id="br-favbtn" title="Agregar a favoritos">
          ${_icon('star')}
        </button>
        <button id="br-close" title="Cerrar browser">
          <svg viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <path d="M2 2l11 11M13 2L2 13"/>
          </svg>
        </button>
        <div id="br-loader"></div>
      </div>

      <!-- BARRA DE FAVORITOS -->
      <div id="br-favbar"></div>

      <!-- CONTENT -->
      <div id="br-content">
        <webview
          id="br-webview"
          class="hidden"
          partition="persist:lth-browser-v3"
          nodeintegration="false"
          contextIsolation="true"
          webSecurity="true"
          allowpopups="false"
          src="about:blank">
        </webview>

        <div id="br-spinner"></div>

        <!-- NEW TAB -->
        <div id="br-newtab" class="visible">
          <div class="br-nt-logo">
            <div class="br-nt-logo-icon">${_icon('globe')}</div>
            <span class="br-nt-title">Browser LTH</span>
          </div>
          <div id="br-nt-form">
            <input id="br-nt-input" type="text" placeholder="Buscar con DuckDuckGo o escribir URL…"
                   autocomplete="off" spellcheck="false" />
            <button id="br-nt-btn">Ir</button>
          </div>
          <div id="br-nt-shortcuts">
            <button class="br-shortcut" data-url="https://google.com">
              <div class="br-shortcut-icon">🔍</div><span>Google</span>
            </button>
            <button class="br-shortcut" data-url="https://youtube.com">
              <div class="br-shortcut-icon">▶️</div><span>YouTube</span>
            </button>
            <button class="br-shortcut" data-url="https://github.com">
              <div class="br-shortcut-icon">🐙</div><span>GitHub</span>
            </button>
            <button class="br-shortcut" data-url="https://duckduckgo.com">
              <div class="br-shortcut-icon">🦆</div><span>DDG</span>
            </button>
            <button class="br-shortcut" data-url="https://wikipedia.org">
              <div class="br-shortcut-icon">📖</div><span>Wikipedia</span>
            </button>
          </div>
        </div>

        <!-- BLOQUEADO -->
        <div id="br-blocked">
          <div class="br-blocked-icon">${_icon('shield')}</div>
          <div class="br-blocked-title">Contenido bloqueado</div>
          <div class="br-blocked-url" id="br-blocked-url">—</div>
          <div class="br-blocked-reason" id="br-blocked-reason">Dominio restringido</div>
          <button id="br-blocked-back">← Volver</button>
        </div>

        <!-- STATUS BAR -->
        <div id="br-notice" aria-live="polite"></div>
        <div id="br-status" id="br-status"></div>
      </div>
    </div>
    `;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ICONOS SVG INLINE
  // ══════════════════════════════════════════════════════════════════════════
  function _icon(name) {
    const icons = {
      back:    `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 12L6 8l4-4"/></svg>`,
      forward: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12l4-4-4-4"/></svg>`,
      reload:  `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M13.5 8A5.5 5.5 0 1 1 8 2.5c1.8 0 3.4.87 4.4 2.2"/><path d="M11 4.7l1.9 0 0-1.9" stroke-linejoin="round"/></svg>`,
      home:    `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7l6-5 6 5v7H10v-4H6v4H2z"/></svg>`,
      go:      `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>`,
      star:    `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2l1.65 3.5 3.85.56-2.8 2.7.66 3.84L8 10.77l-3.36 1.83.66-3.84L2.5 6.06l3.85-.56z"/></svg>`,
      globe:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
      shield:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6z"/><path d="M8 12l2.5 2.5L16 9"/></svg>`,
      starfill:`<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 2l1.65 3.5 3.85.56-2.8 2.7.66 3.84L8 10.77l-3.36 1.83.66-3.84L2.5 6.06l3.85-.56z"/></svg>`,
    };
    return icons[name] || '';
  }

  function _shouldRouteExternally(rawUrl) {
    if (AUTH_IN_EMBEDDED_BROWSER) return false;

    try {
      const parsed = new URL(rawUrl);
      if (!['https:', 'http:'].includes(parsed.protocol)) return false;

      const hostname = parsed.hostname.toLowerCase();
      const pathname = parsed.pathname.toLowerCase();

      if (EXTERNAL_AUTH_HOSTS.has(hostname)) return true;
      if (hostname === 'github.com' && (pathname.startsWith('/login') || pathname.startsWith('/session'))) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  function _showNotice(message, timeoutMs = 5200) {
    const $notice = $root?.querySelector('#br-notice');
    if (!$notice || !message) return;

    clearTimeout(_noticeTimer);
    $notice.textContent = message;
    $notice.classList.add('visible');
    _noticeTimer = setTimeout(() => {
      $notice.classList.remove('visible');
    }, timeoutMs);
  }

  async function _openSensitiveUrlExternally(url) {
    if (!url || !_shouldRouteExternally(url)) return false;

    const result = ipc
      ? await ipc.invoke('lth-browser:open-external', url)
      : { ok: false };

    if (result?.ok) {
      _applyState({ loading: false });
      _showNotice('Por seguridad, este inicio de sesión se abrió en tu navegador predeterminado.');
      return true;
    }

    if (window.electron?.shell?.openExternal) {
      await window.electron.shell.openExternal(url);
      _applyState({ loading: false });
      _showNotice('Por seguridad, este inicio de sesión se abrió en tu navegador predeterminado.');
      return true;
    }

    return false;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // NAVEGACIÓN
  // ══════════════════════════════════════════════════════════════════════════
  async function _navigate(rawInput) {
    if (!rawInput || !rawInput.trim()) return;
    const nextUrl = rawInput.trim();

    const $url = $root.querySelector('#br-url');
    $url.value = nextUrl;

    if (await _openSensitiveUrlExternally(nextUrl)) {
      if (!state.url || state.url === 'about:blank') {
        _showView('newtab');
      }
      return;
    }

    if (!ipc) {
      // Sin IPC (dev mode sin Electron) → navegar directo
      _setWebviewUrl(nextUrl);
      return;
    }

    const result = await ipc.invoke('lth-browser:navigate', nextUrl);
    if (result.ok) {
      _setWebviewUrl(result.url);
      _showView('browser');
    }
    // Si está bloqueado, el engine ya mandó lth-browser:blocked
  }

  function _setWebviewUrl(url) {
    if (!$webview) return;
    try {
      if (typeof $webview.loadURL === 'function') {
        $webview.loadURL(url);
      } else {
        $webview.src = url;
      }
    } catch (e) {
      console.warn('[Browser] loadURL error:', e.message);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VISTAS (browser / newtab / blocked)
  // ══════════════════════════════════════════════════════════════════════════
  function _showView(view) {
    const $newtab   = $root.querySelector('#br-newtab');
    const $blocked  = $root.querySelector('#br-blocked');
    const $wv       = $root.querySelector('#br-webview');

    $newtab.classList.toggle('visible',  view === 'newtab');
    $blocked.classList.toggle('visible', view === 'blocked');
    $wv.classList.toggle('hidden',       view !== 'browser');

    if (view === 'newtab') {
      setTimeout(() => $root.querySelector('#br-nt-input')?.focus(), 80);
    }
    state.activeTab = view;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ACTUALIZAR UI DESDE ESTADO
  // ══════════════════════════════════════════════════════════════════════════
  function _applyState(s) {
    Object.assign(state, s);

    const $toolbar  = $root.querySelector('#br-toolbar');
    const $url      = $root.querySelector('#br-url');
    const $back     = $root.querySelector('#br-back');
    const $forward  = $root.querySelector('#br-forward');
    const $reload   = $root.querySelector('#br-reload');
    const $spinner  = $root.querySelector('#br-spinner');
    const $secure   = $root.querySelector('#br-secure');
    const $favbtn   = $root.querySelector('#br-favbtn');

    // URL en la barra (solo si el input no está enfocado)
    if (document.activeElement !== $url) {
      $url.value = s.url || '';
    }

    // Botones nav
    $back.disabled    = !s.canBack;
    $forward.disabled = !s.canForward;

    // Loading
    $toolbar.classList.toggle('loading', !!s.loading);
    $spinner.classList.toggle('visible', !!s.loading);

    // Icono reload ↔ stop
    $reload.innerHTML = s.loading ? _icon('stop') || '✕' : _icon('reload');
    $reload.title     = s.loading ? 'Detener' : 'Recargar';

    // Candado HTTPS
    if ($secure) {
      const isHttps = (s.url || '').startsWith('https://');
      $secure.style.display = isHttps ? 'block' : 'none';
      $secure.style.color   = isHttps ? 'var(--green)' : 'var(--text-dim)';
    }

    // Estrella favorito
    const isFav = state.favorites.some(f => f.url === s.url);
    $favbtn.classList.toggle('active', isFav);
    $favbtn.innerHTML = isFav ? _icon('starfill') : _icon('star');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FAVORITOS
  // ══════════════════════════════════════════════════════════════════════════
  function _renderFavBar() {
    const $favbar = $root.querySelector('#br-favbar');
    $favbar.innerHTML = '';

    if (!state.favorites.length) {
      $favbar.innerHTML = `<span style="font-size:11px;color:var(--text-dim);padding:0 8px">
        Sin favoritos — presioná ★ para agregar</span>`;
      return;
    }

    state.favorites.forEach(fav => {
      const btn = document.createElement('button');
      btn.className = 'br-favitem';
      btn.title     = fav.url;

      const iconHtml = fav.icon
        ? `<img src="${fav.icon}" onerror="this.style.display='none'">`
        : `<svg class="br-fav-globe" viewBox="0 0 16 16" fill="none" stroke="currentColor"
             stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2a9 9 0 0 1 0 12"/></svg>`;

      btn.innerHTML = iconHtml + `<span>${fav.title || fav.url}</span>`;
      btn.onclick   = () => _navigate(fav.url);
      $favbar.appendChild(btn);
    });
  }

  async function _toggleFavorite() {
    if (!state.url || state.url === 'about:blank') return;

    const icon = (() => {
      try {
        const u = new URL(state.url);
        return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
      } catch { return ''; }
    })();

    if (ipc) {
      const res = await ipc.invoke('lth-browser:toggle-fav', {
        url:   state.url,
        title: state.title || state.url,
        icon,
      });
      if (res.ok) {
        state.favorites = res.favorites;
        _renderFavBar();
        _applyState(state);
      }
    } else {
      // Fallback sin IPC
      const idx = state.favorites.findIndex(f => f.url === state.url);
      if (idx >= 0) state.favorites.splice(idx, 1);
      else state.favorites.push({ url: state.url, title: state.title || state.url, icon });
      _renderFavBar();
      _applyState(state);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // WEBVIEW — EVENTOS
  // ══════════════════════════════════════════════════════════════════════════
  function _bindWebviewEvents() {
    if (!$webview) return;

    // Preload del webview — solo en Electron real
    if (_preloadPath && _preloadPath !== '/electron/browser-preload.js') {
      $webview.setAttribute('preload', _preloadPath);
    }

    $webview.addEventListener('will-navigate', (e) => {
      const nextUrl = e.url || '';
      if (!_shouldRouteExternally(nextUrl)) return;
      e.preventDefault?.();
      void _openSensitiveUrlExternally(nextUrl);
    });

    $webview.addEventListener('did-start-loading', () => {
      _applyState({ loading: true });
      _animateLoader(0, 60, 1200);
    });

    $webview.addEventListener('did-stop-loading', () => {
      _animateLoader(100, 100, 200, () => {
        const $loader = $root.querySelector('#br-loader');
        if ($loader) { $loader.style.width = '0%'; }
      });
      _applyState({
        loading:    false,
        url:        $webview.getURL?.() || state.url,
        canBack:    $webview.canGoBack?.()    || false,
        canForward: $webview.canGoForward?.() || false,
      });
      _reportPageInfo();
    });

    $webview.addEventListener('did-navigate', (e) => {
      const url = e.url || $webview.getURL?.() || '';
      _applyState({ url, canBack: $webview.canGoBack?.() || false, canForward: $webview.canGoForward?.() || false });
      _reportPageInfo();
    });

    $webview.addEventListener('did-navigate-in-page', (e) => {
      if (e.isMainFrame) {
        _applyState({ url: e.url });
        _reportPageInfo();
      }
    });

    $webview.addEventListener('page-title-updated', (e) => {
      _applyState({ title: e.title });
    });

    $webview.addEventListener('did-fail-load', (e) => {
      if (e.errorCode === -3) return; // ERR_ABORTED (navegación cancelada normal)
      console.warn('[Browser] did-fail-load:', e.errorDescription);
      _applyState({ loading: false });
    });

    $webview.addEventListener('update-target-url', (e) => {
      const $status = $root.querySelector('#br-status');
      if (e.url) {
        $status.textContent = e.url;
        $status.classList.add('visible');
      } else {
        $status.classList.remove('visible');
      }
    });

    // Mensajes desde browser-preload.js
    $webview.addEventListener('ipc-message', (e) => {
      const { channel, args } = e;
      const data = args?.[0] || {};

      if (channel === 'browser:title-changed') {
        _applyState({ title: data.title });
        _reportPageInfo();
      } else if (channel === 'browser:popup-request') {
        // El preload interceptó un window.open() — navegar en el mismo webview
        if (data.url) {
          if (_shouldRouteExternally(data.url)) {
            void _openSensitiveUrlExternally(data.url);
          } else {
            _navigate(data.url);
          }
        }
      } else if (channel === 'browser:key-action') {
        if (data.action === 'reload') $webview.reload?.();
        if (data.action === 'back')    $webview.goBack?.();
        if (data.action === 'forward') $webview.goForward?.();
      } else if (channel === 'browser:load-error') {
        console.warn('[Browser] Page error:', data.message);
      }
    });
  }

  function _reportPageInfo() {
    if (!ipc || !$webview) return;
    ipc.send('lth-browser:page-info', {
      url:        $webview.getURL?.()         || state.url,
      title:      $webview.getTitle?.()       || state.title,
      canBack:    $webview.canGoBack?.()      || false,
      canForward: $webview.canGoForward?.()   || false,
      loading:    false,
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ANIMACIÓN DE LA BARRA DE PROGRESO
  // ══════════════════════════════════════════════════════════════════════════
  let _loaderTimer = null;
  function _animateLoader(from, to, duration, onDone) {
    const $loader = $root?.querySelector('#br-loader');
    if (!$loader) return;
    clearTimeout(_loaderTimer);
    $loader.style.transition = `width ${duration}ms ease`;
    $loader.style.width      = to + '%';
    if (onDone) _loaderTimer = setTimeout(onDone, duration + 50);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // IPC LISTENERS (main → renderer)
  // ══════════════════════════════════════════════════════════════════════════
  function _bindIpc() {
    if (!ipc) return;

    ipc.on('lth-browser:state-update', (_e, s) => {
      _applyState(s);
      if (!s.blocked && s.url && s.url !== 'about:blank') {
        _showView('browser');
      }
    });

    ipc.on('lth-browser:blocked', (_e, { url, reason }) => {
      const labels = {
        blocked_domain:       'Dominio restringido',
        blocked_keyword:      'Contenido no permitido',
        protocol_not_allowed: 'Protocolo no permitido',
        invalid_url:          'URL inválida',
      };
      const $url    = $root.querySelector('#br-blocked-url');
      const $reason = $root.querySelector('#br-blocked-reason');
      if ($url)    $url.textContent    = url;
      if ($reason) $reason.textContent = labels[reason] || reason;
      _showView('blocked');
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BIND EVENTOS DE LA UI
  // ══════════════════════════════════════════════════════════════════════════
  function _bindUI() {
    const $ = (sel) => $root.querySelector(sel);

    // Botones de navegación
    $('#br-back').onclick    = () => $webview?.goBack?.();
    $('#br-forward').onclick = () => $webview?.goForward?.();
    $('#br-reload').onclick  = () => {
      if (state.loading) $webview?.stop?.();
      else               $webview?.reload?.();
    };
    $('#br-home').onclick    = () => {
      $root.querySelector('#br-url').value = '';
      _showView('newtab');
    };
    $('#br-go').onclick      = () => _navigate($('#br-url').value);
    $('#br-favbtn').onclick  = () => _toggleFavorite();

    $('#br-close').onclick = () => {
      onClose();
      // El wid es el id del .wm-win que contiene esta app
      const wmWin = $root.closest('.wm-win');
      const wid   = wmWin?.id;
      if (wid && window.WM?.close) window.WM.close(wid);
    };
    $('#br-url').addEventListener('keydown', (e) => {
      if (e.key === 'Enter')  _navigate(e.target.value);
      if (e.key === 'Escape') { e.target.value = state.url; e.target.blur(); }
    });
    $('#br-url').addEventListener('focus', (e) => e.target.select());

    // New tab form
    $('#br-nt-btn').onclick = () => _navigate($('#br-nt-input').value);
    $('#br-nt-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') _navigate(e.target.value);
    });

    // Shortcuts del new tab
    $root.querySelectorAll('.br-shortcut').forEach(btn => {
      btn.onclick = () => _navigate(btn.dataset.url);
    });

    // Volver desde bloqueado
    $('#br-blocked-back').onclick = () => {
      if ($webview?.canGoBack?.()) {
        $webview.goBack();
        _showView('browser');
      } else {
        _showView('newtab');
      }
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER — punto de entrada del WM
  // ══════════════════════════════════════════════════════════════════════════
  function render(container) {
    container.innerHTML = _buildHTML();
    $root    = container.querySelector('#lth-browser');
    $webview = container.querySelector('#br-webview');

    _bindWebviewEvents();
    _bindIpc();
    _bindUI();

    // Cargar favoritos desde disco al abrir
    if (ipc) {
      ipc.invoke('lth-browser:load-favs').then(favs => {
        state.favorites = favs || [];
        _renderFavBar();
        _applyState(state);
      });
    } else {
      _renderFavBar();
    }

    // Foco en el buscador del new tab al abrir
    setTimeout(() => $root.querySelector('#br-nt-input')?.focus(), 120);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LIMPIEZA AL CERRAR
  // ══════════════════════════════════════════════════════════════════════════
  function onClose() {
    try {
      if ($webview) {
        $webview.stop?.();
        $webview.loadURL?.('about:blank');
      }
    } catch { /* ya destruido */ }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // REGISTRO EN LTH iOS
  // ══════════════════════════════════════════════════════════════════════════
  const APP_DEF = {
    id:       'browser',
    name:     'Browser LTH',
    icon: `<img src="../assets/lth-browser.png" alt="LTH Browser" style="width:36px;height:36px;object-fit:contain;display:block;">`,
    iconUrl: '../assets/lth-browser.png',
    gradient: 'linear-gradient(135deg,transparent 0%,transparent 60%,transparent 100%)',
    render,
    onClose,
    // API pública para otros módulos de LTH iOS
    navigateTo: (url) => _navigate(url),
  };

  if (window.LTH_APPS)              window.LTH_APPS['browser'] = APP_DEF;
  if (window.AppLoader?.registerApp) window.AppLoader.registerApp(APP_DEF);

})();
