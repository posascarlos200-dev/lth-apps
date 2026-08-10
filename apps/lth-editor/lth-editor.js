/* =========================================================
   LTH.editor — Video Editor estilo CapCut para LTH OS
   Archivo: src/apps/lth-editor.js
   App ID interno: lth-editor
   Nombre visible: LTH.editor

   Funciones reales:
   1) Importar video, audio e imágenes (biblioteca de medios)
   2) Reproductor con preview en vivo de overlays
   3) Timeline multi-pista (Video / Imagen / Texto / Audio)
   4) Marcar inicio / final, dividir, mover, redimensionar
   5) Extraer audio de video como pista independiente
   6) Textos con presets TikTok / YouTube / Reels / Neón
   7) Overlays de imagen con posición, escala, opacidad
   8) Formatos: TikTok 9:16, YouTube 16:9, Cuadrado, Stories 4:5, Libre
   9) Export compositado WebM (canvas + audio mezclado)
  10) Guardar / cargar proyecto en sistema LTH
   ========================================================= */

(function () {
  'use strict';

  window.LTH_APPS = window.LTH_APPS || {};

  const APP_ID = 'lth-editor';
  const APP_NAME = 'LTH.editor';
  const VERSION = '0.2.0';
  const CSS_ID = 'lth-editor-css';
  const APP_ICON_URL = '../assets/LTH-EDIT.png';

  /* ---------------------------------------------------------
     Resolver root portátil de LTH-iOs
     --------------------------------------------------------- */
  function resolveLthRoot() {
    try {
      let href = String(window.location.href || '');
      href = href.replace(/^file:\/\/\/?/, '').replace(/\?.*$/, '').replace(/#.*$/, '');
      try { href = decodeURIComponent(href); } catch (e) {}
      let path = href.replace(/\//g, '\\').replace(/\\index\.html$/i, '');
      const cut = path.lastIndexOf('\\');
      if (cut > 0) path = path.slice(0, cut);
      return path;
    } catch (e) {
      return '';
    }
  }

  const LTH_ROOT = resolveLthRoot();
  const APP_DATA_DIR = LTH_ROOT ? `${LTH_ROOT}\\sistema LTH\\LTH editor` : '';
  const PROJECTS_FILE = APP_DATA_DIR ? `${APP_DATA_DIR}\\projects.json` : '';
  const editorModules = (window.LTH_EDITOR && window.LTH_EDITOR.modules) || {};
  const projectSchema = editorModules.projectSchema || null;
  const mediaInspector = editorModules.mediaInspector || null;
  const engineClient = editorModules.engineClient || null;

  /* ---------------------------------------------------------
     Icono de la app (SVG inline + base64 para iconUrl)
     --------------------------------------------------------- */
  const ICON = `
    <svg width="60" height="60" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="ltheditor_g" x1="10" y1="10" x2="70" y2="70">
          <stop stop-color="#07284b"/>
          <stop offset="0.48" stop-color="#0b1324"/>
          <stop offset="1" stop-color="#030711"/>
        </linearGradient>
        <linearGradient id="ltheditor_play" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#67e8f9"/>
          <stop offset="1" stop-color="#0ea5e9"/>
        </linearGradient>
      </defs>
      <rect x="9" y="11" width="62" height="58" rx="18" fill="url(#ltheditor_g)" stroke="rgba(255,255,255,.35)" stroke-width="1.5"/>
      <path d="M22 26H58M22 40H50M22 54H58" stroke="rgba(255,255,255,.18)" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M34 28L52 40L34 52Z" fill="url(#ltheditor_play)" stroke="rgba(255,255,255,.85)" stroke-width="1.5" stroke-linejoin="round"/>
      <circle cx="22" cy="26" r="2.6" fill="#f8d775"/>
      <circle cx="22" cy="40" r="2.6" fill="#67e8f9"/>
      <circle cx="22" cy="54" r="2.6" fill="#a78bfa"/>
    </svg>
  `;

  /* ---------------------------------------------------------
     Presets de formato (TikTok, YouTube, etc.)
     --------------------------------------------------------- */
  const FORMATS = {
    tiktok:  { id:'tiktok',  label:'TikTok / Reels',   icon:'9:16', w:1080, h:1920, ratio: 9/16 },
    youtube: { id:'youtube', label:'YouTube',          icon:'16:9', w:1920, h:1080, ratio: 16/9 },
    square:  { id:'square',  label:'Cuadrado',         icon:'1:1',  w:1080, h:1080, ratio: 1 },
    stories: { id:'stories', label:'Stories / Feed',   icon:'4:5',  w:1080, h:1350, ratio: 4/5 },
    free:    { id:'free',    label:'Libre',            icon:'∎',    w:1280, h:720,  ratio: 0 }
  };

  /* ---------------------------------------------------------
     Presets de texto estilo redes sociales
     --------------------------------------------------------- */
  const TEXT_PRESETS = {
    tiktok: {
      label: 'TikTok',
      font: '"Inter", "Segoe UI", sans-serif',
      weight: 800,
      size: 42,
      color: '#ffffff',
      bg: 'rgba(0,0,0,.86)',
      pad: '6px 12px',
      radius: 8,
      shadow: '0 4px 22px rgba(0,0,0,.55)',
      stroke: 0
    },
    caption: {
      label: 'Subtítulo',
      font: '"Inter", "Segoe UI", sans-serif',
      weight: 800,
      size: 38,
      color: '#ffffff',
      bg: 'transparent',
      pad: '4px 8px',
      radius: 0,
      shadow: 'none',
      stroke: 6
    },
    youtube: {
      label: 'YouTube',
      font: '"Roboto", "Inter", sans-serif',
      weight: 900,
      size: 64,
      color: '#ffffff',
      bg: 'transparent',
      pad: '0',
      radius: 0,
      shadow: '4px 4px 0 rgba(0,0,0,.85), 0 0 16px rgba(0,0,0,.65)',
      stroke: 0
    },
    reels: {
      label: 'Reels',
      font: '"Inter", "Segoe UI", sans-serif',
      weight: 700,
      size: 40,
      color: '#0b0d12',
      bg: 'linear-gradient(135deg,#67e8f9,#f8d775)',
      pad: '8px 18px',
      radius: 999,
      shadow: '0 10px 30px rgba(103,232,249,.45)',
      stroke: 0
    },
    neon: {
      label: 'Neón LTH',
      font: '"Inter", "Segoe UI", sans-serif',
      weight: 900,
      size: 56,
      color: '#67e8f9',
      bg: 'transparent',
      pad: '0',
      radius: 0,
      shadow: '0 0 18px #67e8f9, 0 0 36px rgba(103,232,249,.6), 0 0 60px rgba(103,232,249,.3)',
      stroke: 0
    },
    title: {
      label: 'Título',
      font: '"Inter", "Segoe UI", sans-serif',
      weight: 900,
      size: 80,
      color: '#ffffff',
      bg: 'transparent',
      pad: '0',
      radius: 0,
      shadow: '0 8px 40px rgba(0,0,0,.7)',
      stroke: 0
    },
    minimal: {
      label: 'Minimal',
      font: '"Inter", "Segoe UI", sans-serif',
      weight: 300,
      size: 36,
      color: '#ffffff',
      bg: 'transparent',
      pad: '0',
      radius: 0,
      shadow: 'none',
      stroke: 0
    },
    facebook: {
      label: 'Facebook',
      font: '"Inter", "Segoe UI", sans-serif',
      weight: 700,
      size: 44,
      color: '#ffffff',
      bg: 'rgba(24,119,242,.95)',
      pad: '8px 16px',
      radius: 12,
      shadow: '0 8px 24px rgba(24,119,242,.45)',
      stroke: 0
    }
  };

  /* ---------------------------------------------------------
     CSS principal
     --------------------------------------------------------- */
  const CSS = `
    .le-root, .le-root * { box-sizing: border-box; }

    .le-root {
      width: 100%;
      height: 100%;
      min-height: 0;
      overflow: hidden;
      color: #eef5ff;
      background:
        radial-gradient(circle at 18% -4%, rgba(103,232,249,.13), transparent 36%),
        radial-gradient(circle at 86% 8%, rgba(248,215,117,.09), transparent 30%),
        radial-gradient(circle at 50% 110%, rgba(167,139,250,.10), transparent 38%),
        linear-gradient(135deg, #050814 0%, #080d18 46%, #02040a 100%);
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      display: grid;
      grid-template-rows: 56px minmax(0, 1fr) 240px;
    }

    /* ============== TOPBAR ============== */
    .le-topbar {
      height: 56px;
      padding: 0 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      border-bottom: 1px solid rgba(255,255,255,.08);
      background: linear-gradient(180deg, rgba(255,255,255,.055), rgba(255,255,255,.015));
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
    }

    .le-brand { display:flex; align-items:center; gap:11px; min-width:0; }
    .le-brand-icon {
      width:36px; height:36px; display:grid; place-items:center;
      border-radius:13px;
      background: linear-gradient(135deg, rgba(103,232,249,.18), rgba(248,215,117,.12));
      border:1px solid rgba(255,255,255,.12);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 12px 28px rgba(0,0,0,.36);
      overflow:hidden;
    }
    .le-brand-icon svg { width:28px; height:28px; }
    .le-brand-title { min-width:0; line-height:1.08; }
    .le-brand-title strong {
      display:block; font-size:13px; letter-spacing:.08em;
      text-transform:uppercase; color: rgba(245,248,255,.96);
    }
    .le-brand-title span {
      display:block; margin-top:5px; font-size:11px;
      color: rgba(198,210,230,.62);
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      max-width:340px;
    }

    .le-format-pills {
      display: flex;
      gap: 4px;
      padding: 4px;
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,.08);
      background: rgba(3,6,13,.45);
    }
    .le-format-pill {
      border: 0;
      background: transparent;
      color: rgba(220,230,248,.7);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .04em;
      padding: 6px 11px;
      border-radius: 10px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background .15s ease, color .15s ease;
    }
    .le-format-pill:hover { color: rgba(255,255,255,.95); background: rgba(255,255,255,.05); }
    .le-format-pill.le-active {
      background: linear-gradient(135deg, rgba(13,148,204,.55), rgba(9,76,128,.6));
      color: #fff;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.16), 0 4px 14px rgba(13,148,204,.32);
    }
    .le-format-pill .le-pill-ratio {
      font-family: ui-monospace, "SF Mono", Menlo, monospace;
      font-size: 10px;
      opacity: .85;
    }

    .le-top-actions { display:flex; align-items:center; gap:8px; flex-shrink:0; }

    /* ============== BUTTONS ============== */
    .le-btn, .le-icon-btn, .le-toggle, .le-mini-btn {
      border:1px solid rgba(255,255,255,.11);
      color: rgba(240,247,255,.92);
      background: linear-gradient(180deg, rgba(255,255,255,.09), rgba(255,255,255,.035));
      box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
      border-radius:12px;
      height:36px;
      padding:0 13px;
      display:inline-flex; align-items:center; justify-content:center;
      gap:8px;
      cursor:pointer;
      font-size:12px; font-weight:750; letter-spacing:.015em;
      user-select:none;
      transition: transform .13s ease, border-color .13s ease, background .13s ease, opacity .13s ease;
      font-family: inherit;
    }
    .le-icon-btn { width:38px; padding:0; font-size:15px; }
    .le-mini-btn { height:30px; padding:0 10px; font-size:11px; border-radius:9px; }

    .le-btn:hover, .le-icon-btn:hover, .le-toggle:hover, .le-mini-btn:hover {
      transform: translateY(-1px);
      border-color: rgba(103,232,249,.34);
      background: linear-gradient(180deg, rgba(103,232,249,.15), rgba(255,255,255,.04));
    }
    .le-btn:disabled, .le-icon-btn:disabled, .le-toggle:disabled, .le-mini-btn:disabled {
      opacity:.42; cursor:not-allowed; transform:none;
    }
    .le-btn-primary {
      background: linear-gradient(135deg, rgba(13,148,204,.92), rgba(9,76,128,.96));
      border-color: rgba(103,232,249,.42);
      box-shadow: 0 14px 30px rgba(6,182,212,.13), inset 0 1px 0 rgba(255,255,255,.16);
    }
    .le-btn-gold {
      background: linear-gradient(135deg, rgba(246,204,91,.92), rgba(195,141,28,.95));
      border-color: rgba(255,229,153,.42);
      color:#1a0f02;
      box-shadow: 0 14px 30px rgba(248,215,117,.18), inset 0 1px 0 rgba(255,255,255,.22);
    }
    .le-btn-danger {
      background: linear-gradient(135deg, rgba(244,63,94,.78), rgba(159,18,57,.86));
      border-color: rgba(251,113,133,.4);
    }
    .le-toggle.le-active {
      border-color: rgba(103,232,249,.45);
      background: linear-gradient(135deg, rgba(13,148,204,.5), rgba(9,76,128,.34));
      box-shadow: 0 0 18px rgba(103,232,249,.13), inset 0 1px 0 rgba(255,255,255,.08);
    }

    .le-file-input { display:none; }

    /* ============== MAIN GRID ============== */
    .le-main {
      min-height: 0;
      display: grid;
      grid-template-columns: 286px minmax(0,1fr) 286px;
      gap: 12px;
      padding: 12px;
    }

    .le-panel {
      min-height: 0;
      border: 1px solid rgba(255,255,255,.09);
      background:
        linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.017)),
        rgba(5,9,17,.64);
      border-radius: 18px;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.045);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /* ============== LIBRARY (LEFT PANEL) ============== */
    .le-lib-tabs {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      padding: 8px;
      gap: 4px;
      border-bottom: 1px solid rgba(255,255,255,.07);
      background: rgba(3,6,13,.4);
    }
    .le-lib-tab {
      border: 0;
      background: transparent;
      color: rgba(218,228,247,.62);
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: .04em;
      padding: 8px 4px;
      border-radius: 10px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      transition: background .14s ease, color .14s ease;
      font-family: inherit;
    }
    .le-lib-tab svg { width: 16px; height: 16px; }
    .le-lib-tab:hover { color: rgba(255,255,255,.92); background: rgba(255,255,255,.04); }
    .le-lib-tab.le-active {
      color: #67e8f9;
      background: linear-gradient(135deg, rgba(103,232,249,.18), rgba(13,148,204,.18));
      box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
    }

    .le-lib-body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .le-lib-body::-webkit-scrollbar { width: 8px; }
    .le-lib-body::-webkit-scrollbar-track { background: transparent; }
    .le-lib-body::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,.08);
      border-radius: 999px;
    }
    .le-lib-body::-webkit-scrollbar-thumb:hover { background: rgba(103,232,249,.3); }

    .le-lib-import {
      width: 100%;
      min-height: 64px;
      display: grid;
      place-items: center;
      border: 1px dashed rgba(103,232,249,.28);
      border-radius: 13px;
      cursor: pointer;
      padding: 10px;
      text-align: center;
      color: rgba(220,230,248,.78);
      background: radial-gradient(circle at 50% 0%, rgba(103,232,249,.10), transparent 60%);
      transition: border-color .14s ease, background .14s ease, transform .14s ease;
    }
    .le-lib-import:hover, .le-lib-import.le-drag {
      border-color: rgba(103,232,249,.55);
      background: radial-gradient(circle at 50% 0%, rgba(103,232,249,.18), transparent 62%);
      transform: translateY(-1px);
    }
    .le-lib-import strong {
      display: block; font-size: 12px; color: rgba(248,250,255,.96);
      letter-spacing: .02em;
    }
    .le-lib-import span {
      display: block; font-size: 10.5px; margin-top: 2px;
      color: rgba(190,205,232,.65);
    }

    .le-lib-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }

    .le-lib-card {
      position: relative;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,.08);
      background: rgba(0,0,0,.55);
      cursor: grab;
      transition: transform .14s ease, border-color .14s ease, box-shadow .14s ease;
      aspect-ratio: 1 / 1;
    }
    .le-lib-card:hover {
      transform: translateY(-2px);
      border-color: rgba(103,232,249,.4);
      box-shadow: 0 12px 24px rgba(0,0,0,.45);
    }
    .le-lib-card:active { cursor: grabbing; }
    .le-lib-card img, .le-lib-card video, .le-lib-card canvas {
      width:100%; height:100%; object-fit: cover; display:block;
    }
    .le-lib-card .le-lib-fallback {
      width:100%; height:100%;
      display:grid; place-items:center;
      color: rgba(220,235,255,.65);
      font-size: 22px;
      background: linear-gradient(135deg, rgba(13,148,204,.22), rgba(167,139,250,.18));
    }
    .le-lib-card .le-lib-name {
      position: absolute; left: 0; right: 0; bottom: 0;
      padding: 5px 7px;
      font-size: 10px;
      font-weight: 600;
      color: rgba(245,248,255,.95);
      background: linear-gradient(180deg, transparent, rgba(0,0,0,.85));
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .le-lib-card .le-lib-type {
      position: absolute; top: 5px; left: 5px;
      padding: 2px 6px;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: .04em;
      text-transform: uppercase;
      border-radius: 5px;
      color: #0b0d12;
    }
    .le-lib-card .le-lib-type.le-type-video { background: #67e8f9; }
    .le-lib-card .le-lib-type.le-type-audio { background: #f8d775; }
    .le-lib-card .le-lib-type.le-type-image { background: #a78bfa; color: #fff; }
    .le-lib-card .le-lib-add {
      position: absolute; top: 5px; right: 5px;
      width: 22px; height: 22px;
      border-radius: 50%;
      background: rgba(0,0,0,.7);
      color: #67e8f9;
      border: 1px solid rgba(103,232,249,.5);
      display: grid; place-items: center;
      font-size: 14px;
      font-weight: 800;
      cursor: pointer;
      opacity: 0;
      transition: opacity .14s ease, transform .14s ease;
    }
    .le-lib-card:hover .le-lib-add { opacity: 1; }
    .le-lib-card .le-lib-add:hover { transform: scale(1.1); }
    .le-lib-card .le-lib-extract {
      position: absolute; bottom: 22px; right: 5px;
      padding: 3px 7px;
      border-radius: 5px;
      background: rgba(248,215,117,.92);
      color: #1a0f02;
      border: 0;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: .03em;
      cursor: pointer;
      opacity: 0;
      transition: opacity .14s ease;
      font-family: inherit;
    }
    .le-lib-card .le-lib-extract.le-always {
  opacity: 1;
  bottom: 24px;
}
    .le-lib-card:hover .le-lib-extract { opacity: 1; }
    .le-lib-card .le-lib-extract:hover { transform: scale(1.04); }

    .le-lib-empty {
      padding: 20px 12px;
      text-align: center;
      color: rgba(192,206,232,.55);
      font-size: 11px;
      line-height: 1.5;
    }

    .le-text-presets {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .le-text-preset {
      border: 1px solid rgba(255,255,255,.1);
      background: rgba(0,0,0,.4);
      border-radius: 12px;
      padding: 14px 10px;
      cursor: pointer;
      text-align: center;
      min-height: 76px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform .14s ease, border-color .14s ease;
      overflow: hidden;
      position: relative;
    }
    .le-text-preset:hover {
      transform: translateY(-2px);
      border-color: rgba(103,232,249,.45);
    }
    .le-text-preset .le-tp-name {
      position: absolute; bottom: 4px; left: 0; right: 0;
      font-size: 9px;
      color: rgba(198,212,238,.7);
      letter-spacing: .04em;
      text-transform: uppercase;
      pointer-events: none;
    }

    /* ============== STAGE (PREVIEW CENTER) ============== */
    .le-preview-panel { min-width: 0; flex: 1; display: flex; flex-direction: column; }

    .le-stage {
      position: relative;
      flex: 1;
      min-height: 0;
      display: grid;
      place-items: center;
      background:
        linear-gradient(45deg, rgba(255,255,255,.025) 25%, transparent 25%),
        linear-gradient(-45deg, rgba(255,255,255,.025) 25%, transparent 25%),
        radial-gradient(circle at center, rgba(103,232,249,.06), transparent 58%),
        #03060d;
      background-size: 22px 22px, 22px 22px, auto, auto;
      overflow: hidden;
    }

.le-canvas-wrap {
  position: relative;
  width: min(98%, 620px);
  height: min(98%, 860px);
  max-width: 98%;
  max-height: 98%;
  aspect-ratio: 9 / 16;
  background: #000;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 24px 60px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.06);
  display: grid;
  place-items: center;
}

.le-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
  display: none;
  z-index: 1;
}
    .le-video.le-on { display: block; }

    .le-overlay-layer {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 2;
    }
    .le-overlay {
      position: absolute;
      transform: translate(-50%, -50%);
      pointer-events: auto;
      cursor: move;
      user-select: none;
      max-width: 95%;
    }
    .le-overlay.le-selected {
      outline: 2px dashed rgba(103,232,249,.85);
      outline-offset: 4px;
    }
    .le-overlay-text {
      white-space: pre-wrap;
      text-align: center;
      line-height: 1.18;
    }
    .le-overlay-img {
      max-width: 100%;
      max-height: 100%;
      display: block;
      pointer-events: none;
    }

    .le-empty {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      text-align: center;
      padding: 30px;
      color: rgba(215,225,242,.68);
      pointer-events: none;
    }
    .le-empty-card {
      width: min(460px, 90%);
      border: 1px solid rgba(255,255,255,.09);
      border-radius: 24px;
      padding: 28px;
      background: linear-gradient(180deg, rgba(255,255,255,.055), rgba(255,255,255,.019));
      box-shadow: 0 24px 72px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.07);
    }
    .le-empty-card .le-empty-icon {
      width: 62px; height: 62px;
      display: grid; place-items: center;
      border-radius: 21px;
      margin: 0 auto 14px;
      background: linear-gradient(135deg, rgba(103,232,249,.18), rgba(248,215,117,.13));
      border: 1px solid rgba(255,255,255,.11);
      font-size: 28px;
    }
    .le-empty-card strong { display:block; color:rgba(249,251,255,.96); font-size:17px; letter-spacing:-.02em; margin-bottom:7px; }
    .le-empty-card span { display:block; font-size:12px; line-height:1.55; color: rgba(198,212,238,.7); }

    .le-format-badge {
      position: absolute;
      top: 14px;
      left: 14px;
      padding: 6px 11px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .04em;
      border-radius: 999px;
      background: rgba(3,9,18,.78);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(103,232,249,.28);
      color: rgba(225,242,255,.92);
      pointer-events: none;
    }
    .le-format-badge .le-fb-dot {
      display: inline-block;
      width: 7px; height: 7px;
      border-radius: 50%;
      background: #67e8f9;
      box-shadow: 0 0 12px rgba(103,232,249,.7);
      margin-right: 6px;
      vertical-align: middle;
    }

    .le-controls {
      display: grid;
      grid-template-columns: auto auto minmax(0,1fr) auto auto;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-top: 1px solid rgba(255,255,255,.08);
      background: rgba(3,6,13,.58);
    }
    .le-time {
      min-width: 130px;
      text-align: right;
      font-variant-numeric: tabular-nums;
      color: rgba(216,226,244,.86);
      font-size: 12px;
      font-weight: 600;
    }
    .le-scrub { width:100%; accent-color:#67e8f9; cursor:pointer; }

    /* ============== INSPECTOR (RIGHT PANEL) ============== */
    .le-insp-head {
      padding: 14px 14px 10px;
      border-bottom: 1px solid rgba(255,255,255,.07);
    }
    .le-insp-head h3 {
      margin: 0;
      font-size: 11px;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: rgba(247,250,255,.94);
    }
    .le-insp-head .le-insp-sub {
      display: block;
      margin-top: 4px;
      font-size: 11px;
      color: rgba(198,212,238,.65);
    }

    .le-insp-body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .le-insp-body::-webkit-scrollbar { width: 8px; }
    .le-insp-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,.08); border-radius: 999px; }

    .le-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .le-field-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .le-field-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .04em;
      color: rgba(220,230,248,.72);
    }
    .le-field-value {
      font-size: 11px;
      font-variant-numeric: tabular-nums;
      color: rgba(247,250,255,.92);
      font-weight: 700;
    }
    .le-field input[type="range"] {
      width: 100%;
      accent-color: #67e8f9;
    }
    .le-field input[type="text"],
    .le-field input[type="number"],
    .le-field textarea,
    .le-field select {
      width: 100%;
      padding: 8px 10px;
      border-radius: 9px;
      border: 1px solid rgba(255,255,255,.1);
      background: rgba(0,0,0,.42);
      color: #fff;
      font-size: 12px;
      font-family: inherit;
      outline: none;
      transition: border-color .14s ease, background .14s ease;
    }
    .le-field input[type="text"]:focus,
    .le-field input[type="number"]:focus,
    .le-field textarea:focus,
    .le-field select:focus {
      border-color: rgba(103,232,249,.5);
      background: rgba(0,0,0,.6);
    }
    .le-field textarea { min-height: 64px; resize: vertical; }
    .le-field input[type="color"] {
      width: 100%;
      height: 32px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,.14);
      background: transparent;
      cursor: pointer;
    }

    .le-meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }
    .le-meta-cell {
      padding: 8px 10px;
      border: 1px solid rgba(255,255,255,.07);
      background: rgba(255,255,255,.025);
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .le-meta-cell span { font-size: 9.5px; letter-spacing:.05em; text-transform:uppercase; color: rgba(190,205,232,.6); }
    .le-meta-cell b { font-size: 12px; color: rgba(248,250,255,.95); font-variant-numeric: tabular-nums; }

    .le-status {
      padding: 11px;
      border-radius: 11px;
      border: 1px solid rgba(255,255,255,.07);
      background: rgba(255,255,255,.025);
      font-size: 11px;
      line-height: 1.45;
      color: rgba(207,218,237,.78);
      overflow: hidden;
    }
    .le-status strong { color: rgba(246,250,255,.95); }
    .le-export-bar {
      margin-top: 10px;
      width: 100%;
      height: 8px;
      border-radius: 999px;
      overflow: hidden;
      background: rgba(255,255,255,.07);
      border: 1px solid rgba(255,255,255,.06);
    }
    .le-export-fill {
      width: 0%; height: 100%;
      background: linear-gradient(90deg, #67e8f9, #f8d775);
      transition: width .12s linear;
    }
.le-export-overlay {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(440px, calc(100% - 32px));
  transform: translate(-50%, -50%);
  z-index: 60;
  display: none;
  padding: 18px;
  border-radius: 18px;
  border: 1px solid rgba(103,232,249,.28);
  background:
    radial-gradient(circle at 12% 0%, rgba(103,232,249,.16), transparent 42%),
    linear-gradient(180deg, rgba(8,13,24,.96), rgba(3,6,13,.96));
  box-shadow: 0 28px 80px rgba(0,0,0,.62), inset 0 1px 0 rgba(255,255,255,.08);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  pointer-events: none;
}

.le-export-overlay.le-on {
  display: block;
}

.le-export-overlay.le-done {
  border-color: rgba(248,215,117,.48);
}

.le-export-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 12px;
}

.le-export-title {
  font-size: 12px;
  font-weight: 900;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: rgba(248,250,255,.96);
}

.le-export-percent {
  font-size: 24px;
  font-weight: 950;
  color: #67e8f9;
  font-variant-numeric: tabular-nums;
}

.le-export-detail {
  font-size: 11px;
  line-height: 1.45;
  color: rgba(205,218,240,.78);
  margin-bottom: 12px;
}

.le-export-overlay.le-done .le-export-percent {
  color: #f8d775;
}

.le-export-bar-big {
  width: 100%;
  height: 10px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(255,255,255,.08);
  border: 1px solid rgba(255,255,255,.08);
}

.le-export-bar-big > div {
  width: 0%;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #67e8f9, #f8d775);
  transition: width .16s linear;
}
    /* ============== TIMELINE (BOTTOM) ============== */
    .le-timeline {
      min-height: 0;
      padding: 10px 12px 12px;
      border-top: 1px solid rgba(255,255,255,.08);
      background:
        linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.008)),
        rgba(3,6,13,.85);
      display: grid;
      grid-template-rows: 26px minmax(0,1fr);
      gap: 6px;
    }
    .le-timeline-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      color: rgba(223,232,248,.78);
      font-size: 11px;
    }
    .le-timeline-head strong {
      color: rgba(249,251,255,.94);
      letter-spacing: .08em;
      text-transform: uppercase;
      font-size: 11px;
    }
    .le-tl-actions { display:flex; gap:6px; }
    .le-zoom {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 0 8px;
      height: 24px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,.1);
      background: rgba(0,0,0,.4);
    }
    .le-zoom span { font-size: 10px; color: rgba(220,230,248,.65); }
    .le-zoom input { width: 90px; accent-color: #67e8f9; }

    .le-timeline-body {
      position: relative;
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 14px;
      background: rgba(255,255,255,.012);
      overflow: hidden;
      display: grid;
      grid-template-columns: 80px minmax(0,1fr);
    }

    .le-track-labels {
      border-right: 1px solid rgba(255,255,255,.08);
      background: rgba(0,0,0,.36);
      display: grid;
      grid-template-rows: repeat(4, 1fr);
      min-height: 0;
    }
    .le-track-label {
      padding: 0 10px;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .06em;
      text-transform: uppercase;
      color: rgba(220,230,248,.74);
      border-bottom: 1px solid rgba(255,255,255,.05);
    }
    .le-track-label:last-child { border-bottom: 0; }
    .le-track-label .le-tl-icon {
      width: 14px; height: 14px;
      display: grid; place-items: center;
      border-radius: 4px;
      font-size: 10px;
    }
    .le-track-label.le-t-video .le-tl-icon { background: rgba(103,232,249,.7); color:#000; }
    .le-track-label.le-t-image .le-tl-icon { background: rgba(167,139,250,.78); color:#fff; }
    .le-track-label.le-t-text .le-tl-icon  { background: rgba(248,215,117,.86); color:#000; }
    .le-track-label.le-t-audio .le-tl-icon { background: rgba(34,197,94,.85); color:#000; }

    .le-tracks {
      position: relative;
      overflow-x: auto;
      overflow-y: hidden;
    }
    .le-tracks::-webkit-scrollbar { height: 8px; }
    .le-tracks::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 999px; }

.le-tracks-inner {
  position: relative;
  display: grid;
  grid-template-rows: repeat(4, 1fr);
  height: 100%;
  min-width: 0;
}

    .le-track {
      position: relative;
      border-bottom: 1px solid rgba(255,255,255,.05);
      min-height: 0;
      cursor: crosshair;
      overflow: hidden;
    }
    .le-track:last-child { border-bottom: 0; }

    .le-track.le-t-video { background: linear-gradient(180deg, rgba(103,232,249,.045), transparent); }
    .le-track.le-t-image { background: linear-gradient(180deg, rgba(167,139,250,.045), transparent); }
    .le-track.le-t-text  { background: linear-gradient(180deg, rgba(248,215,117,.045), transparent); }
    .le-track.le-t-audio { background: linear-gradient(180deg, rgba(34,197,94,.045), transparent); }

    .le-clip {
      position: absolute;
      top: 4px;
      bottom: 4px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,.16);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.1), 0 4px 14px rgba(0,0,0,.45);
      display: flex;
      align-items: center;
      padding: 0 10px;
      gap: 6px;
      cursor: grab;
      overflow: hidden;
      font-size: 11px;
      font-weight: 700;
      color: rgba(255,255,255,.96);
      letter-spacing: .02em;
      white-space: nowrap;
      transition: box-shadow .14s ease, border-color .14s ease;
    }
    .le-clip:active { cursor: grabbing; }
    .le-clip.le-c-video {
      background: linear-gradient(135deg, rgba(13,148,204,.75), rgba(7,89,133,.85));
    }
    .le-clip.le-c-image {
      background: linear-gradient(135deg, rgba(139,92,246,.78), rgba(91,33,182,.85));
    }
    .le-clip.le-c-text {
      background: linear-gradient(135deg, rgba(234,179,8,.8), rgba(161,98,7,.88));
      color: #2a1a02;
    }
    .le-clip.le-c-audio {
      background: linear-gradient(135deg, rgba(34,197,94,.8), rgba(21,128,61,.88));
    }
    .le-clip .le-clip-icon { font-size: 12px; flex-shrink: 0; }
    .le-clip .le-clip-name {
      flex: 1; min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }
.le-clip.le-dragging {
  z-index: 30;
  opacity: .94;
  box-shadow: 0 0 0 2px #67e8f9, 0 8px 28px rgba(103,232,249,.38);
}
.le-clip-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 16px;
  cursor: ew-resize;
  background: linear-gradient(180deg, rgba(255,255,255,.48), rgba(255,255,255,.16));
  transition: background .14s ease;
  z-index: 6;
  touch-action: none;
}
    .le-clip-handle:hover { background: rgba(255,255,255,.7); }
    .le-clip-handle.le-h-l { left: 0; border-radius: 8px 0 0 8px; }
    .le-clip-handle.le-h-r { right: 0; border-radius: 0 8px 8px 0; }

    .le-track-empty {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: rgba(202,213,233,.32);
      font-size: 10.5px;
      font-style: italic;
      pointer-events: none;
    }

    .le-playhead {
      position: absolute;
      top: 0; bottom: 0;
      width: 2px;
      background: #fff;
      box-shadow: 0 0 12px rgba(103,232,249,.84);
      pointer-events: none;
      z-index: 10;
    }
    .le-playhead::before {
      content: "";
      position: absolute;
      top: -2px; left: 50%;
      transform: translateX(-50%);
      width: 12px; height: 12px;
      border-radius: 50%;
      background: #fff;
      border: 2px solid #67e8f9;
    }

    .le-ruler {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 16px;
      pointer-events: none;
      z-index: 5;
      background: linear-gradient(180deg, rgba(0,0,0,.5), transparent);
    }
    .le-ruler-tick {
      position: absolute;
      top: 0; bottom: 0;
      width: 1px;
      background: rgba(255,255,255,.18);
    }
    .le-ruler-label {
      position: absolute;
      top: 1px;
      transform: translateX(-50%);
      font-size: 9px;
      font-variant-numeric: tabular-nums;
      color: rgba(220,230,248,.72);
      letter-spacing: .02em;
      pointer-events: none;
    }

    /* ============== KEYBINDS HINT ============== */
    .le-kbd {
      padding: 2px 7px;
      border-radius: 7px;
      background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.08);
      color: rgba(235,241,252,.78);
      font-size: 10px;
      font-family: ui-monospace, "SF Mono", Menlo, monospace;
    }

    /* ============== RESPONSIVE ============== */
    @media (max-width: 1180px) {
      .le-main { grid-template-columns: 240px minmax(0,1fr) 240px; }
      .le-format-pill .le-pill-label { display: none; }
    }
    @media (max-width: 980px) {
      .le-main { grid-template-columns: 220px minmax(0,1fr); }
      .le-right { display: none; }
    }
    @media (max-width: 760px) {
      .le-main { grid-template-columns: 1fr; }
      .le-left { display: none; }
      .le-brand-title span { max-width: 200px; }
    }
  `;

  /* =========================================================
     CSS injection + helpers genéricos
     ========================================================= */
  function injectCSS() {
    if (document.getElementById(CSS_ID)) return;
    const style = document.createElement('style');
    style.id = CSS_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function fmtTime(seconds) {
    const value = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const h = Math.floor(value / 3600);
    const m = Math.floor((value % 3600) / 60);
    const s = Math.floor(value % 60);
    const ms = Math.floor((value % 1) * 10);
    if (h > 0) return `${pad2(h)}:${pad2(m)}:${pad2(s)}.${ms}`;
    return `${pad2(m)}:${pad2(s)}.${ms}`;
  }
  function pad2(n) { return String(n).padStart(2, '0'); }

  function safeFileName(name) {
    const base = String(name || 'video')
      .replace(/\.[^.]+$/, '')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 70);
    return base || 'video';
  }

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function uid(prefix) {
    return `${prefix || 'id'}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function once(el, eventName, timeoutMs) {
    return new Promise((resolve, reject) => {
      let timer = null;
      const cleanup = () => {
        clearTimeout(timer);
        el.removeEventListener(eventName, onEvent);
        el.removeEventListener('error', onError);
      };
      const onEvent = () => { cleanup(); resolve(); };
      const onError = () => { cleanup(); reject(new Error(`Error en evento ${eventName}.`)); };
      el.addEventListener(eventName, onEvent, { once: true });
      el.addEventListener('error', onError, { once: true });
      if (timeoutMs) {
        timer = setTimeout(() => { cleanup(); reject(new Error(`Tiempo agotado: ${eventName}.`)); }, timeoutMs);
      }
    });
  }

  function chooseMimeType() {
    const list = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ];
    if (!window.MediaRecorder || typeof MediaRecorder.isTypeSupported !== 'function') return '';
    return list.find(t => MediaRecorder.isTypeSupported(t)) || '';
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} a.remove(); }, 1200);
  }

  function fileSizeStr(bytes) {
    const b = Number(bytes || 0);
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
    return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  function mediaTypeFromFile(file) {
    const t = String(file.type || '').toLowerCase();
    if (t.startsWith('video/')) return 'video';
    if (t.startsWith('audio/')) return 'audio';
    if (t.startsWith('image/')) return 'image';
    const n = String(file.name || '').toLowerCase();
    if (/\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(n)) return 'video';
    if (/\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i.test(n)) return 'audio';
    if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(n)) return 'image';
    return null;
  }

  /* Generar thumbnail de video mediante canvas */
  function generateVideoThumbnail(url, atSeconds) {
    return new Promise((resolve) => {
      const v = document.createElement('video');
      v.crossOrigin = 'anonymous';
      v.muted = true;
      v.playsInline = true;
      v.preload = 'metadata';
      v.src = url;
      v.style.position = 'fixed';
      v.style.left = '-9999px';
      document.body.appendChild(v);

      const cleanup = () => {
        try { v.pause(); v.removeAttribute('src'); v.load(); v.remove(); } catch (e) {}
      };

      const fail = () => { cleanup(); resolve({ src: '', w: 0, h: 0, duration: 0 }); };

      v.addEventListener('loadedmetadata', () => {
        const dur = Number.isFinite(v.duration) ? v.duration : 0;
        const t = clamp(Number.isFinite(atSeconds) ? atSeconds : Math.min(1, dur * 0.1), 0, Math.max(0, dur - 0.1));
        try { v.currentTime = t; } catch (e) { fail(); }
      });

      v.addEventListener('seeked', () => {
        try {
          const w = v.videoWidth || 320;
          const h = v.videoHeight || 180;
          const c = document.createElement('canvas');
          const maxSide = 240;
          const scale = Math.min(1, maxSide / Math.max(w, h));
          c.width = Math.max(1, Math.round(w * scale));
          c.height = Math.max(1, Math.round(h * scale));
          const ctx = c.getContext('2d');
          ctx.drawImage(v, 0, 0, c.width, c.height);
          const dataUrl = c.toDataURL('image/jpeg', 0.78);
          cleanup();
          resolve({ src: dataUrl, w, h, duration: v.duration || 0 });
        } catch (e) { fail(); }
      });

      v.addEventListener('error', fail, { once: true });
      setTimeout(fail, 12000);
    });
  }

  function getMediaDuration(url, kind) {
    return new Promise((resolve) => {
      const el = kind === 'audio' ? document.createElement('audio') : document.createElement('video');
      el.preload = 'metadata';
      el.src = url;
      el.muted = true;
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      const cleanup = () => { try { el.removeAttribute('src'); el.load(); el.remove(); } catch (e) {} };
      el.addEventListener('loadedmetadata', () => {
        const d = Number.isFinite(el.duration) ? el.duration : 0;
        cleanup();
        resolve(d);
      }, { once: true });
      el.addEventListener('error', () => { cleanup(); resolve(0); }, { once: true });
      setTimeout(() => { cleanup(); resolve(0); }, 10000);
    });
  }

  function getImageSize(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth || 0, h: img.naturalHeight || 0 });
      img.onerror = () => resolve({ w: 0, h: 0 });
      img.src = url;
    });
  }

  /* SVG icons reutilizables para tabs/labels */
  const SVG_ICONS = {
    video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="14" height="12" rx="2"/><path d="M17 10l4-2v8l-4-2z"/></svg>',
    audio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.6"/><path d="M21 15l-5-5-9 9"/></svg>',
    text:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6h14M12 6v14M8 20h8"/></svg>',
    fx:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 16l-4.9 2.7.9-5.5-4-3.9 5.5-.8z"/></svg>',
    play:  '▶',
    pause: '⏸'
  };


  /* =========================================================
     OBJETO PRINCIPAL DE LA APP
     ========================================================= */
  const app = {
    id: APP_ID,
    name: APP_NAME,
    version: VERSION,
    icon: ICON,
    iconUrl: APP_ICON_URL,
    gradient: 'linear-gradient(135deg,#082f49,#020617 55%,#0f172a)',
    position: 9,

    /* ======= ESTADO ======= */
    _root: null,
    _dom: {},

    // Proyecto
    _format: 'tiktok',
    _library: [],          // [{id, type, name, src, duration, thumb, w, h, size, file}]
    _clips: [],            // [{id, type, libId, start, end, sourceStart, sourceEnd, ...props}]
    _duration: 0,          // duración total del timeline
    _currentTime: 0,
    _playing: false,
    _selectedClipId: null,
    _activeTab: 'video',   // tab de la biblioteca
    _zoom: 1,              // zoom de timeline

    // Reproducción
    _videoEls: {},         // libId -> video element (oculto)
    _audioEls: {},         // libId -> audio element (oculto)
    _activeVideoEl: null,
    _activeVideoClipId: null,
    _raf: 0,
    _exportPulseTimer: 0,
    _exporting: false,
    _exportCancelled: false,

    // UI flags
    _draggingClip: null,   // { clipId, mode:'move'|'resize-l'|'resize-r', startX, startStart, startEnd }
    _draggingOverlay: null,// { clipId, startX, startY, startXp, startYp }
    _kbdHandler: null,

    /* ======= LIFECYCLE ======= */
    render(container) {
      injectCSS();
      this._dispose(false);

      this._root = container;
      container.innerHTML = this._template();

      this._collectDom();
      this._bindEvents();
      this._bindKeyboard();
      this._setFormat(this._format);
      this._renderLibrary();
      this._renderTimeline();
      this._renderOverlays();
      this._updateAll();
      this._setStatus('Listo.', 'Importa video, audio o imagen para empezar.');
    },

    onClose() {
      this._dispose(true);
    },

    /* ======= TEMPLATE HTML ======= */
    _template() {
      const formatPills = Object.values(FORMATS).map(f => `
        <button class="le-format-pill" data-le="formatPill" data-format="${f.id}" type="button">
          <span class="le-pill-ratio">${f.icon}</span>
          <span class="le-pill-label">${escapeHtml(f.label)}</span>
        </button>
      `).join('');

      const tabs = [
        { id:'video', label:'Video', icon: SVG_ICONS.video },
        { id:'audio', label:'Audio', icon: SVG_ICONS.audio },
        { id:'image', label:'Imagen', icon: SVG_ICONS.image },
        { id:'text',  label:'Texto', icon: SVG_ICONS.text },
        { id:'fx',    label:'Ajustes', icon: SVG_ICONS.fx }
      ].map(t => `
        <button class="le-lib-tab" data-le="libTab" data-tab="${t.id}" type="button">
          ${t.icon}
          <span>${t.label}</span>
        </button>
      `).join('');

      return `
        <div class="le-root">
          <input class="le-file-input" data-le="fileInput" type="file" accept="video/*,audio/*,image/*" multiple />

          <header class="le-topbar">
            <div class="le-brand">
              <div class="le-brand-icon">${ICON}</div>
              <div class="le-brand-title">
                <strong>${APP_NAME}</strong>
                <span data-le="subtitle">Editor estilo CapCut · ${VERSION}</span>
              </div>
            </div>

            <div class="le-format-pills" data-le="formatPills">
              ${formatPills}
            </div>

            <div class="le-top-actions">
              <button class="le-btn" data-le="importTop" type="button">+ Importar</button>
              <button class="le-btn" data-le="saveProject" type="button" title="Guardar proyecto">💾</button>
              <button class="le-btn le-btn-gold" data-le="exportTop" type="button" disabled>Exportar</button>
            </div>
          </header>

          <main class="le-main">
            <!-- ===== LIBRARY ===== -->
            <aside class="le-panel le-left">
              <nav class="le-lib-tabs">${tabs}</nav>
              <div class="le-lib-body" data-le="libBody"></div>
            </aside>

            <!-- ===== STAGE ===== -->
            <section class="le-panel le-preview-panel">
              <div class="le-stage" data-le="stage">
                <div class="le-canvas-wrap" data-le="canvasWrap">
                  <video class="le-video" data-le="video" playsinline></video>
                  <div class="le-overlay-layer" data-le="overlayLayer"></div>
                </div>

                <div class="le-format-badge" data-le="formatBadge">
                  <span class="le-fb-dot"></span>
                  <span data-le="formatBadgeText">TikTok / Reels · 9:16</span>
                </div>

                <div class="le-empty" data-le="empty">
                  <div class="le-empty-card">
                    <div class="le-empty-icon">🎬</div>
                    <strong>Empieza tu video</strong>
                    <span>Importa video, audio o imagen desde el panel izquierdo. Elige el formato (TikTok, YouTube, etc.) y arrastra los clips a la timeline.</span>
                  </div>
                </div>
                                <div class="le-export-overlay" data-le="exportOverlay">
                  <div class="le-export-top">
                    <div class="le-export-title" data-le="exportTitle">Exportando</div>
                    <div class="le-export-percent" data-le="exportPercent">0%</div>
                  </div>
                  <div class="le-export-detail" data-le="exportDetail">Preparando exportación...</div>
                  <div class="le-export-bar-big">
                    <div data-le="exportOverlayFill"></div>
                  </div>
                </div>
              </div>

              <div class="le-controls">
                <button class="le-icon-btn" data-le="play" type="button" disabled>▶</button>
                <button class="le-icon-btn" data-le="rewind" type="button" disabled title="Volver al inicio">⏮</button>
                <input class="le-scrub" data-le="scrub" type="range" min="0" max="10000" value="0" disabled />
                <div class="le-time">
                  <span data-le="current">00:00.0</span>
                  /
                  <span data-le="total">00:00.0</span>
                </div>
                <button class="le-icon-btn" data-le="splitBtn" type="button" disabled title="Dividir clip (S)">✂</button>
              </div>
            </section>

            <!-- ===== INSPECTOR ===== -->
            <aside class="le-panel le-right">
              <div class="le-insp-head">
                <h3 data-le="inspTitle">Inspector</h3>
                <span class="le-insp-sub" data-le="inspSub">Selecciona un clip para editar sus propiedades</span>
              </div>
              <div class="le-insp-body" data-le="inspBody">
                ${this._renderInspectorEmpty()}
              </div>
            </aside>
          </main>

          <!-- ===== TIMELINE ===== -->
          <footer class="le-timeline">
            <div class="le-timeline-head">
              <strong>Timeline</strong>
              <div class="le-tl-actions">
                <button class="le-mini-btn" data-le="splitMini" type="button" disabled>✂ Dividir</button>
                <button class="le-mini-btn le-btn-danger" data-le="deleteMini" type="button" disabled>🗑 Borrar</button>
                <div class="le-zoom">
                  <span>🔍</span>
              <input data-le="zoomRange" type="range" min="1" max="800" value="100" step="1" />
                </div>
              </div>
            </div>

            <div class="le-timeline-body" data-le="tlBody">
              <div class="le-track-labels">
                <div class="le-track-label le-t-video"><span class="le-tl-icon">V</span> Video</div>
                <div class="le-track-label le-t-image"><span class="le-tl-icon">I</span> Imagen</div>
                <div class="le-track-label le-t-text"><span class="le-tl-icon">T</span> Texto</div>
                <div class="le-track-label le-t-audio"><span class="le-tl-icon">A</span> Audio</div>
              </div>
              <div class="le-tracks" data-le="tracks">
                <div class="le-tracks-inner" data-le="tracksInner">
                  <div class="le-ruler" data-le="ruler"></div>
                  <div class="le-track le-t-video" data-le="trackVideo" data-track="video"></div>
                  <div class="le-track le-t-image" data-le="trackImage" data-track="image"></div>
                  <div class="le-track le-t-text"  data-le="trackText"  data-track="text"></div>
                  <div class="le-track le-t-audio" data-le="trackAudio" data-track="audio"></div>
                  <div class="le-playhead" data-le="playhead"></div>
                </div>
              </div>
            </div>
          </footer>
        </div>
      `;
    },

    _renderInspectorEmpty() {
      return `
        <div class="le-status" data-le="status">
          <strong>Inspector vacío</strong><br>
          Haz click en un clip de la timeline para editar inicio, fin, posición, color, volumen, etc.
        </div>
        <div class="le-meta-grid">
          <div class="le-meta-cell"><span>Formato</span><b data-le="metaFormat">9:16</b></div>
          <div class="le-meta-cell"><span>Resolución</span><b data-le="metaRes">1080×1920</b></div>
          <div class="le-meta-cell"><span>Clips</span><b data-le="metaClips">0</b></div>
          <div class="le-meta-cell"><span>Duración</span><b data-le="metaDur">00:00.0</b></div>
        </div>
        <div class="le-export-bar"><div class="le-export-fill" data-le="exportFill"></div></div>
      `;
    },

    _collectDom() {
      const root = this._root;
      const q = (key) => root.querySelector(`[data-le="${key}"]`);
      const qa = (key) => Array.from(root.querySelectorAll(`[data-le="${key}"]`));

      this._dom = {
        fileInput: q('fileInput'),
        subtitle: q('subtitle'),
        importTop: q('importTop'),
        saveProject: q('saveProject'),
        exportTop: q('exportTop'),
        formatPills: qa('formatPill'),
        libTabs: qa('libTab'),
        libBody: q('libBody'),
        stage: q('stage'),
        canvasWrap: q('canvasWrap'),
        video: q('video'),
        overlayLayer: q('overlayLayer'),
        formatBadge: q('formatBadge'),
        formatBadgeText: q('formatBadgeText'),
     empty: q('empty'),
exportOverlay: q('exportOverlay'),
exportTitle: q('exportTitle'),
exportPercent: q('exportPercent'),
exportDetail: q('exportDetail'),
exportOverlayFill: q('exportOverlayFill'),
play: q('play'),
        rewind: q('rewind'),
        scrub: q('scrub'),
        current: q('current'),
        total: q('total'),
        splitBtn: q('splitBtn'),
        inspTitle: q('inspTitle'),
        inspSub: q('inspSub'),
        inspBody: q('inspBody'),
        splitMini: q('splitMini'),
        deleteMini: q('deleteMini'),
        zoomRange: q('zoomRange'),
        tlBody: q('tlBody'),
        tracks: q('tracks'),
        tracksInner: q('tracksInner'),
        ruler: q('ruler'),
        trackVideo: q('trackVideo'),
        trackImage: q('trackImage'),
        trackText:  q('trackText'),
        trackAudio: q('trackAudio'),
        playhead: q('playhead')
      };
    },


    /* ======= EVENT BINDING ======= */
    _bindEvents() {
      const d = this._dom;

      // Imports
      d.importTop.addEventListener('click', () => this._openImportPicker());
      d.fileInput.addEventListener('change', () => {
        const files = Array.from(d.fileInput.files || []);
        files.forEach(f => this._loadFile(f));
        d.fileInput.value = '';
      });

      // Drag-drop sobre el stage
      const stage = d.stage;
      stage.addEventListener('dragover', (e) => { e.preventDefault(); });
      stage.addEventListener('drop', (e) => {
        e.preventDefault();
        const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
        files.forEach(f => this._loadFile(f));
      });

      // Format pills
      d.formatPills.forEach(p => {
        p.addEventListener('click', () => {
          this._setFormat(p.getAttribute('data-format'));
        });
      });

      // Library tabs
      d.libTabs.forEach(t => {
        t.addEventListener('click', () => {
          this._activeTab = t.getAttribute('data-tab');
          this._renderLibrary();
        });
      });

      // Save / export
      d.saveProject.addEventListener('click', () => this._saveProject());
      d.exportTop.addEventListener('click', () => this._exportProject());

      // Playback controls
      d.play.addEventListener('click', () => this._togglePlay());
      d.rewind.addEventListener('click', () => this._seek(0));
      d.scrub.addEventListener('input', () => {
        const pct = Number(d.scrub.value || 0) / 10000;
        this._seek(pct * this._duration);
      });
      d.splitBtn.addEventListener('click', () => this._splitAtPlayhead());
      d.splitMini.addEventListener('click', () => this._splitAtPlayhead());
      d.deleteMini.addEventListener('click', () => this._deleteSelected());

      // Zoom
      d.zoomRange.addEventListener('input', () => {
this._zoom = clamp(Number(d.zoomRange.value || 100) / 100, 0.01, 8);
this._renderTimeline();
      });

      // Click on tracks => seek + deselect
      ['trackVideo','trackImage','trackText','trackAudio'].forEach(key => {
        const tr = d[key];
        tr.addEventListener('click', (e) => {
          if (e.target !== tr) return; // ignorar clicks sobre clips
          const rect = d.tracksInner.getBoundingClientRect();
          const x = clamp(e.clientX - rect.left, 0, rect.width);
          const pct = rect.width ? x / rect.width : 0;
          this._seek(pct * Math.max(0.1, this._duration));
          this._selectClip(null);
        });
      });

      // Click on tracks empty area to seek (también en ruler)
      d.tracksInner.addEventListener('mousedown', (e) => {
        if (this._draggingClip || this._draggingOverlay) return;
        if (!e.target.classList.contains('le-tracks-inner') &&
            !e.target.classList.contains('le-track')) return;
      });
    },

    _bindKeyboard() {
      this._kbdHandler = (e) => {
        if (!this._root || !document.contains(this._root)) return;
        const tag = (e.target && e.target.tagName) || '';
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) && e.target.type !== 'range') return;

        if (e.code === 'Space') {
          if (this._duration > 0) { e.preventDefault(); this._togglePlay(); }
        } else if (e.key === 's' || e.key === 'S') {
          if (!e.ctrlKey && !e.metaKey) { e.preventDefault(); this._splitAtPlayhead(); }
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          if (this._selectedClipId) { e.preventDefault(); this._deleteSelected(); }
        } else if (e.key === 'ArrowLeft') {
          this._seek(this._currentTime - (e.shiftKey ? 1 : 0.1));
        } else if (e.key === 'ArrowRight') {
          this._seek(this._currentTime + (e.shiftKey ? 1 : 0.1));
        }
      };
      document.addEventListener('keydown', this._kbdHandler);
    },

    /* ======= FORMAT ======= */
_setFormat(formatId) {
  const f = FORMATS[formatId] || FORMATS.tiktok;
  this._format = f.id;

  this._dom.formatPills.forEach(p => {
    p.classList.toggle('le-active', p.getAttribute('data-format') === f.id);
  });

  const wrap = this._dom.canvasWrap;
  if (wrap) {
    if (f.id === 'free') {
      const lib = this._library.find(it => it.type === 'video');
      const w = (lib && lib.w) || 1280;
      const h = (lib && lib.h) || 720;
      wrap.style.aspectRatio = `${w} / ${h}`;
    } else {
      wrap.style.aspectRatio = `${f.w} / ${f.h}`;
    }
  }

  this._dom.formatBadgeText.textContent = `${f.label} · ${f.icon}`;

  const meta = this._root.querySelector('[data-le="metaFormat"]');
  const metaRes = this._root.querySelector('[data-le="metaRes"]');

  if (meta) meta.textContent = f.icon;
  if (metaRes) metaRes.textContent = `${f.w}×${f.h}`;

  this._resizeCanvasWrap();
},

_resizeCanvasWrap() {
  const stage = this._dom.stage;
  const wrap = this._dom.canvasWrap;

  if (!stage || !wrap) return;

  const f = FORMATS[this._format] || FORMATS.tiktok;

  let ratio = f.ratio || (f.w / f.h) || (9 / 16);

  if (f.id === 'free') {
    const lib = this._library.find(it => it.type === 'video');
    if (lib && lib.w && lib.h) {
      ratio = lib.w / lib.h;
    }
  }

  const rect = stage.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const maxW = rect.width * 0.92;
  const maxH = rect.height * 0.92;

  let w = maxW;
  let h = w / ratio;

  if (h > maxH) {
    h = maxH;
    w = h * ratio;
  }

wrap.style.width = `${Math.max(120, Math.round(w))}px`;
wrap.style.height = `${Math.max(120, Math.round(h))}px`;
wrap.style.aspectRatio = `${ratio} / 1`;
},

    async _openImportPicker() {
      if (!engineClient || typeof engineClient.pickMediaFiles !== 'function') {
        this._dom.fileInput.click();
        return;
      }

      try {
        const result = await engineClient.pickMediaFiles();
        if (!result || !result.success || !Array.isArray(result.files) || !result.files.length) {
          if (result && result.error) {
            console.warn('[LTH.editor] Importacion nativa no disponible:', result.error);
            this._setStatus('Importacion web.', 'No se pudo abrir el selector nativo. Usa el selector clasico.');
            this._dom.fileInput.click();
          }
          return;
        }

        for (const entry of result.files) {
          await this._loadNativeEntry(entry);
        }
      } catch (error) {
        console.warn('[LTH.editor] Error al abrir importacion nativa:', error);
        this._dom.fileInput.click();
      }
    },

    async _loadNativeEntry(entry) {
      if (!entry || !entry.path) return;
      const type = entry.type || mediaTypeFromFile({ name: entry.name || entry.path, type: '' });
      if (!type) {
        this._setStatus('Archivo no soportado.', `${entry.name || entry.path}: tipo no reconocido.`);
        return;
      }

      this._setStatus('Importando...', `Analizando ${entry.name || entry.path}`);

      let item = null;
      if (mediaInspector && typeof mediaInspector.inspectPath === 'function') {
        try {
          item = await mediaInspector.inspectPath(entry.path, {
            uid,
            type,
            engineClient,
            fallback: entry
          });
        } catch (error) {
          console.warn('[LTH.editor] Error en mediaInspector.inspectPath:', error);
        }
      }

      if (!item) {
        this._setStatus('Importacion web.', 'Ese archivo no pudo analizarse por el motor nativo todavia.');
        return;
      }

      this._library.push(item);
      this._renderLibrary();
      this._setStatus('Importado.', `${item.name} (${type}, ${fileSizeStr(item.size)})`);

      if (type === 'video' && !this._clips.some(c => c.type === 'video')) {
        this._addLibraryToTimeline(item);
        if (this._format === 'free') this._setFormat('free');
      }
    },

    /* ======= LIBRARY ======= */
    async _loadFile(file) {
      if (!file) return;
      const type = mediaTypeFromFile(file);
      if (!type) {
        this._setStatus('Archivo no soportado.', `${file.name}: tipo no reconocido.`);
        return;
      }
      this._setStatus('Importando...', `Procesando ${file.name}`);
      let item = null;

      if (mediaInspector && typeof mediaInspector.inspectFile === 'function') {
        try {
          item = await mediaInspector.inspectFile(file, {
            uid,
            type,
            engineClient,
            mediaTypeFromFile,
            generateVideoThumbnail,
            getMediaDuration,
            getImageSize
          });
        } catch (error) {
          console.warn('[LTH.editor] Error en mediaInspector.inspectFile:', error);
        }
      }

      if (!item) {
        const url = URL.createObjectURL(file);
        item = {
          id: uid('lib'),
          type,
          name: file.name || `${type}-${Date.now()}`,
          src: url,
          file,
          sourcePath: projectSchema && typeof projectSchema.getFilePath === 'function'
            ? projectSchema.getFilePath(file)
            : '',
          mimeType: String(file.type || ''),
          lastModified: Number(file.lastModified || 0),
          size: file.size || 0,
          duration: 0,
          thumb: '',
          w: 0,
          h: 0,
          muteVideoAudio: false
        };

        try {
          if (type === 'video') {
            const t = await generateVideoThumbnail(url, 0.5);
            item.thumb = t.src;
            item.duration = t.duration || await getMediaDuration(url, 'video');
            item.w = t.w; item.h = t.h;
          } else if (type === 'audio') {
            item.duration = await getMediaDuration(url, 'audio');
          } else if (type === 'image') {
            const sz = await getImageSize(url);
            item.thumb = url;
            item.w = sz.w; item.h = sz.h;
            item.duration = 5; // duración por defecto al añadir a timeline
          }
        } catch (e) {}
      }

      this._library.push(item);
      this._renderLibrary();
      this._setStatus('Importado.', `${item.name} (${type}, ${fileSizeStr(item.size)})`);

      // Auto-añadir el primer video al timeline si está vacío
      if (type === 'video' && !this._clips.some(c => c.type === 'video')) {
        this._addLibraryToTimeline(item);
        if (this._format === 'free') this._setFormat('free'); // re-evaluar aspect
      }
    },

    _renderLibrary() {
      const tab = this._activeTab;
      const body = this._dom.libBody;

      // Highlight tab activo
      this._dom.libTabs.forEach(t => {
        t.classList.toggle('le-active', t.getAttribute('data-tab') === tab);
      });

      if (tab === 'text') {
        body.innerHTML = `
          <div class="le-lib-import" data-le="textHint">
            <div>
              <strong>Estilos de texto</strong>
              <span>Click en un estilo para añadirlo al timeline</span>
            </div>
          </div>
          <div class="le-text-presets">
            ${Object.entries(TEXT_PRESETS).map(([key, p]) => `
              <button class="le-text-preset" data-le="textPreset" data-preset="${key}" type="button">
                <span style="
                  font-family:${p.font};
                  font-weight:${p.weight};
                  font-size:${Math.min(p.size * 0.42, 22)}px;
                  color:${p.color};
                  background:${p.bg};
                  padding:${p.pad};
                  border-radius:${p.radius}px;
                  text-shadow:${p.shadow};
                  -webkit-text-stroke:${p.stroke ? p.stroke + 'px #000' : '0'};
                  display:inline-block;
                  max-width:90%;
                  text-align:center;
                ">Texto</span>
                <span class="le-tp-name">${escapeHtml(p.label)}</span>
              </button>
            `).join('')}
          </div>
        `;
        body.querySelectorAll('[data-le="textPreset"]').forEach(btn => {
          btn.addEventListener('click', () => this._addTextClip(btn.getAttribute('data-preset')));
        });
        return;
      }

      if (tab === 'fx') {
        body.innerHTML = `
          <div class="le-status">
            <strong>Ajustes del proyecto</strong><br>
            Volumen del video original, mute, recorte rápido y más.
          </div>
          <div class="le-field">
            <div class="le-field-row">
              <span class="le-field-label">🔊 Volumen video original</span>
              <span class="le-field-value" data-le="masterVolValue">100%</span>
            </div>
            <input type="range" min="0" max="100" value="100" data-le="masterVol" />
          </div>
          <button class="le-btn" data-le="muteAllVideo" type="button">🔇 Silenciar todos los videos</button>
          <button class="le-btn" data-le="extractAllAudio" type="button" ${this._library.some(l=>l.type==='video')?'':'disabled'}>🎵 Extraer audio del primer video</button>
          <button class="le-btn le-btn-danger" data-le="clearAll" type="button">🗑 Limpiar timeline</button>
        `;
        const mv = body.querySelector('[data-le="masterVol"]');
        const mvLabel = body.querySelector('[data-le="masterVolValue"]');
        mv.addEventListener('input', () => {
          const v = Number(mv.value);
          mvLabel.textContent = `${v}%`;
          this._clips.filter(c => c.type === 'video').forEach(c => { c.volume = v / 100; });
          if (this._activeVideoEl) this._activeVideoEl.volume = clamp(v / 100, 0, 1);
        });
        const muteBtn = body.querySelector('[data-le="muteAllVideo"]');
        muteBtn.addEventListener('click', () => {
          this._clips.filter(c => c.type === 'video').forEach(c => { c.muted = true; c.volume = 0; });
          if (this._activeVideoEl) this._activeVideoEl.muted = true;
          this._setStatus('Audio del video silenciado.', 'Activa una pista de audio o extrae el audio del video para usarlo.');
        });
        const extractBtn = body.querySelector('[data-le="extractAllAudio"]');
        if (extractBtn) extractBtn.addEventListener('click', () => {
          const v = this._library.find(l => l.type === 'video');
          if (v) this._extractAudioFromVideo(v);
        });
        const clearBtn = body.querySelector('[data-le="clearAll"]');
        clearBtn.addEventListener('click', () => {
          if (!this._clips.length) return;
          this._clips = [];
          this._selectedClipId = null;
          this._duration = 0;
          this._currentTime = 0;
          this._activeVideoClipId = null;
          this._destroyMediaElements();
          this._renderTimeline();
          this._syncPreview();
          this._setStatus('Timeline limpiada.', 'Arrastra clips desde la biblioteca.');
        });
        return;
      }

// tabs video / audio / image
const items = tab === 'audio'
  ? this._library.filter(it => it.type === 'audio' || it.type === 'video')
  : this._library.filter(it => it.type === tab);

const importLabel = tab === 'video' ? 'video' : tab === 'audio' ? 'audio' : 'imagen';

const emptyText = tab === 'audio'
  ? 'No hay audios ni videos en la biblioteca.<br>Importa un audio o un video para extraer su sonido.'
  : `No hay ${importLabel} en la biblioteca.<br>Importa para empezar.`;

body.innerHTML = `
  <div class="le-lib-import" data-le="libImport">
    <div>
      <strong>+ Importar ${importLabel}</strong>
      <span>Click o arrastra archivos aquí</span>
    </div>
  </div>
  ${items.length === 0
    ? `<div class="le-lib-empty">${emptyText}</div>`
    : `<div class="le-lib-grid">${items.map(it => this._renderLibCard(it, tab)).join('')}</div>`
  }
`;

      // import dropzone
      const drop = body.querySelector('[data-le="libImport"]');
      drop.addEventListener('click', () => this._openImportPicker());
      drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('le-drag'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('le-drag'));
      drop.addEventListener('drop', (e) => {
        e.preventDefault();
        drop.classList.remove('le-drag');
        const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
        files.forEach(f => this._loadFile(f));
      });

      // cards
      body.querySelectorAll('[data-le="libCard"]').forEach(card => {
        const id = card.getAttribute('data-id');
        const item = this._library.find(it => it.id === id);
        if (!item) return;

        card.addEventListener('dblclick', () => this._addLibraryToTimeline(item));
        const addBtn = card.querySelector('[data-le="libAdd"]');
        if (addBtn) addBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this._addLibraryToTimeline(item);
        });
        const extractBtn = card.querySelector('[data-le="libExtract"]');
        if (extractBtn) extractBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this._extractAudioFromVideo(item);
        });
      });
    },

_renderLibCard(item, contextTab) {
  const isVideoInAudioTab = contextTab === 'audio' && item.type === 'video';

  const typeBadge = item.type === 'video' ? 'VID' : item.type === 'audio' ? 'AUD' : 'IMG';
  const thumb = item.thumb
    ? `<img src="${item.thumb}" alt="" />`
    : `<div class="le-lib-fallback">${item.type === 'audio' ? '🎵' : item.type === 'video' ? '🎬' : '📁'}</div>`;

  const addBtn = isVideoInAudioTab
    ? ''
    : `<button class="le-lib-add" data-le="libAdd" type="button" title="Añadir al timeline">+</button>`;

  const extractBtn = item.type === 'video'
    ? `<button class="le-lib-extract ${isVideoInAudioTab ? 'le-always' : ''}" data-le="libExtract" type="button" title="Extraer audio">🎵 audio</button>`
    : '';

  const name = isVideoInAudioTab
    ? `${item.name} · extraer audio`
    : item.name;

  return `
    <div class="le-lib-card" data-le="libCard" data-id="${item.id}" title="${escapeHtml(item.name)} · ${fmtTime(item.duration)} · ${fileSizeStr(item.size)}">
      ${thumb}
      <span class="le-lib-type le-type-${item.type}">${typeBadge}</span>
      ${addBtn}
      ${extractBtn}
      <span class="le-lib-name">${escapeHtml(name)}</span>
    </div>
  `;
},


    /* ======= AGREGAR CLIPS A LA TIMELINE ======= */
    _addLibraryToTimeline(item) {
      if (!item) return;
      const tlStart = this._currentTime || 0;

      if (item.type === 'video') {
        const dur = Math.max(0.5, item.duration || 5);
        const clip = {
          id: uid('clip'),
          type: 'video',
          libId: item.id,
          start: tlStart,
          end: tlStart + dur,
          sourceStart: 0,
          sourceEnd: dur,
          volume: 1,
          muted: false,
          name: item.name
        };
        this._clips.push(clip);
        if (this._format === 'free' && !this._clips.filter(c=>c.type==='video').slice(0,-1).length) {
          this._setFormat('free');
        }
      } else if (item.type === 'audio') {
        const dur = Math.max(0.5, item.duration || 10);
        this._clips.push({
          id: uid('clip'),
          type: 'audio',
          libId: item.id,
          start: tlStart,
          end: tlStart + dur,
          sourceStart: 0,
          sourceEnd: dur,
          volume: 1,
          muted: false,
          name: item.name
        });
      } else if (item.type === 'image') {
        this._clips.push({
          id: uid('clip'),
          type: 'image',
          libId: item.id,
          start: tlStart,
          end: tlStart + (item.duration || 5),
          x: 50, y: 50,        // posición % en canvas
          scale: 60,           // % del canvas
          rotation: 0,
          opacity: 100,
          name: item.name
        });
      }

      this._recomputeDuration();
      this._renderTimeline();
      this._renderOverlays();
      this._ensureMediaElements();
      this._syncPreview();
      this._setStatus('Clip añadido.', `${item.name} en ${fmtTime(tlStart)}`);
    },

    _addTextClip(presetKey) {
      const preset = TEXT_PRESETS[presetKey] || TEXT_PRESETS.tiktok;
      const tlStart = this._currentTime || 0;
      const clip = {
        id: uid('clip'),
        type: 'text',
        preset: presetKey,
        text: 'Tu texto aquí',
        font: preset.font,
        weight: preset.weight,
        size: preset.size,
        color: preset.color,
        bg: preset.bg,
        pad: preset.pad,
        radius: preset.radius,
        shadow: preset.shadow,
        stroke: preset.stroke,
        x: 50,
        y: 80,
        rotation: 0,
        opacity: 100,
        start: tlStart,
        end: tlStart + 3,
        name: `Texto · ${preset.label}`
      };
      this._clips.push(clip);
      this._recomputeDuration();
      this._selectedClipId = clip.id;
      this._renderTimeline();
      this._renderInspector();
      this._syncPreview();
      this._setStatus('Texto añadido.', `${preset.label} en ${fmtTime(tlStart)}`);
    },

    /* ======= EXTRAER AUDIO DE VIDEO ======= */
    _extractAudioFromVideo(videoItem) {
      if (!videoItem || videoItem.type !== 'video') return;

      // Crea un item de audio que apunta al mismo source pero como audio-only
      const audioItem = {
        id: uid('lib'),
        type: 'audio',
        name: `${videoItem.name.replace(/\.[^.]+$/, '')} · audio`,
        src: videoItem.src,           // mismo Blob URL
        file: videoItem.file,         // mismo File (lo usaremos como audio)
        sourcePath: String(videoItem.sourcePath || ''),
        mimeType: String(videoItem.mimeType || ''),
        lastModified: Number(videoItem.lastModified || 0),
        size: 0,
        duration: videoItem.duration || 0,
        thumb: '',
        w: 0, h: 0,
        extractedFrom: videoItem.id
      };
      this._library.push(audioItem);

      // Mute el video original automáticamente
      this._clips.filter(c => c.type === 'video' && c.libId === videoItem.id).forEach(c => {
        c.muted = true;
        c.volume = 0;
      });
      if (this._activeVideoEl) this._activeVideoEl.muted = true;

      // Auto-añadir el audio al timeline
      this._addLibraryToTimeline(audioItem);

      // Cambiar a tab audio para que el usuario lo vea
      this._activeTab = 'audio';
      this._renderLibrary();
      this._setStatus('Audio extraído.', `Pista de audio creada desde "${videoItem.name}". El video original quedó silenciado.`);
    },

    /* ======= TIMELINE ======= */
    _recomputeDuration() {
      const max = this._clips.reduce((acc, c) => Math.max(acc, c.end || 0), 0);
      this._duration = Math.max(max, 0);
      // si hay clips pero duración 0, usar al menos 5s
      if (this._clips.length && this._duration < 0.5) this._duration = 5;
    },

    _renderTimeline() {
      const tlInner = this._dom.tracksInner;
      if (!tlInner) return;

// Tamaño real del timeline según zoom.
// Permite alejar mucho más para proyectos largos.
const seconds = Math.max(this._duration || 10, 1);

// Menor número = timeline más comprimida.
// 10 funciona bien para videos largos.
const PX_PER_SECOND = 5;
const MIN_TIMELINE_WIDTH = 140;

const baseWidthPx = Math.max(
  MIN_TIMELINE_WIDTH,
  seconds * PX_PER_SECOND * this._zoom
);

tlInner.style.width = `${baseWidthPx}px`;

      // Render por track
      const trackMap = {
        video: this._dom.trackVideo,
        image: this._dom.trackImage,
        text:  this._dom.trackText,
        audio: this._dom.trackAudio
      };

      const totalDur = Math.max(this._duration, 1);

      Object.entries(trackMap).forEach(([trackType, trackEl]) => {
        // Limpia clips existentes
        Array.from(trackEl.querySelectorAll('.le-clip, .le-track-empty')).forEach(n => n.remove());

        const trackClips = this._clips.filter(c => c.type === trackType);

        if (!trackClips.length) {
          const empty = document.createElement('div');
          empty.className = 'le-track-empty';
          empty.textContent = trackType === 'video' ? 'Arrastra videos aquí'
            : trackType === 'image' ? 'Imágenes (overlays)'
            : trackType === 'text' ? 'Textos / títulos / subtítulos'
            : 'Audio (música, voz, extraído)';
          trackEl.appendChild(empty);
          return;
        }

        trackClips.forEach(clip => {
          const node = this._buildClipNode(clip, totalDur);
          trackEl.appendChild(node);
        });
      });

      // Render ruler
      this._renderRuler(baseWidthPx, totalDur);
    },

_buildClipNode(clip, totalDur) {
  const viewDur = Math.max(totalDur || this._duration || 1, 1);
  const startPct = clamp((clip.start || 0) / viewDur, 0, 1);
  const endPct = clamp((clip.end || 0) / viewDur, 0, 1);

  const node = document.createElement('div');
  node.className = `le-clip le-c-${clip.type}`;
  node.setAttribute('data-clip-id', clip.id);
  node.style.left = `${startPct * 100}%`;
  node.style.width = `${Math.max(0.3, (endPct - startPct) * 100)}%`;

  const icon = clip.type === 'video' ? '🎬'
    : clip.type === 'audio' ? '🎵'
    : clip.type === 'image' ? '🖼'
    : 'T';

  const labelName = clip.type === 'text'
    ? (clip.text || 'Texto').slice(0, 28)
    : (clip.name || clip.id);

  node.innerHTML = `
    <div class="le-clip-handle le-h-l" data-handle="l"></div>
    <span class="le-clip-icon">${icon}</span>
    <span class="le-clip-name">${escapeHtml(labelName)}</span>
    <div class="le-clip-handle le-h-r" data-handle="r"></div>
  `;

  if (clip.id === this._selectedClipId) node.classList.add('le-selected');

  const updateNodeVisual = (targetClip) => {
    const visualDur = Math.max(viewDur, targetClip.end || 0, 1);
    const leftPct = clamp((targetClip.start || 0) / visualDur, 0, 1);
    const widthPct = Math.max(0.3, (((targetClip.end || 0) - (targetClip.start || 0)) / visualDur) * 100);

    node.style.left = `${leftPct * 100}%`;
    node.style.width = `${widthPct}%`;
  };

  const onMouseDown = (e) => {
    e.stopPropagation();
    e.preventDefault();

    this._pause();

    const handle = e.target && e.target.getAttribute
      ? e.target.getAttribute('data-handle')
      : '';

    const mode = handle === 'l' ? 'resize-l' : handle === 'r' ? 'resize-r' : 'move';
    const rect = this._dom.tracksInner.getBoundingClientRect();

    const sourceStart = Number.isFinite(Number(clip.sourceStart)) ? Number(clip.sourceStart) : 0;
    const sourceEnd = Number.isFinite(Number(clip.sourceEnd))
      ? Number(clip.sourceEnd)
      : sourceStart + Math.max(0.2, (clip.end || 0) - (clip.start || 0));

    const mediaItem = this._library.find(item => item.id === clip.libId) || null;
    const sourceDuration = mediaItem && Number.isFinite(Number(mediaItem.duration))
      ? Number(mediaItem.duration)
      : 0;

    this._selectedClipId = clip.id;

    if (node.parentNode) {
      Array.from(node.parentNode.querySelectorAll('.le-clip.le-selected')).forEach(el => {
        el.classList.remove('le-selected');
      });
    }

    node.classList.add('le-selected');
    node.classList.add('le-dragging');

    this._draggingClip = {
      clipId: clip.id,
      mode,
      startX: e.clientX,
      startStart: Number(clip.start || 0),
      startEnd: Number(clip.end || 0),
      startSourceStart: sourceStart,
      startSourceEnd: sourceEnd,
      sourceDuration,
      rectWidth: Math.max(1, rect.width),
      viewDur
    };

    this._renderOverlays();
    this._renderInspector();
    this._updateAll();

    const onMove = (ev) => {
      if (!this._draggingClip) return;

      ev.preventDefault();
      ev.stopPropagation();

      const drag = this._draggingClip;
      const dx = ev.clientX - drag.startX;
      const dt = (dx / drag.rectWidth) * drag.viewDur;
      const c = this._clips.find(cc => cc.id === drag.clipId);
      if (!c) return;

      const minLen = 0.2;
      const originalLen = Math.max(minLen, drag.startEnd - drag.startStart);

      node.__leDragged = true;

      if (drag.mode === 'move') {
        const newStart = Math.max(0, drag.startStart + dt);
        c.start = newStart;
        c.end = newStart + originalLen;
      }

      if (drag.mode === 'resize-l') {
        let minStart = 0;

        if (c.type === 'video' || c.type === 'audio') {
          minStart = Math.max(0, drag.startStart - drag.startSourceStart);
        }

        const newStart = clamp(
          drag.startStart + dt,
          minStart,
          drag.startEnd - minLen
        );

        c.start = newStart;
        c.end = drag.startEnd;

        if (c.type === 'video' || c.type === 'audio') {
          const delta = newStart - drag.startStart;
          c.sourceStart = Math.max(0, drag.startSourceStart + delta);
          c.sourceEnd = drag.startSourceEnd;
        }
      }

      if (drag.mode === 'resize-r') {
        let maxEnd = Infinity;

        if ((c.type === 'video' || c.type === 'audio') && drag.sourceDuration > 0) {
          maxEnd = drag.startStart + Math.max(minLen, drag.sourceDuration - drag.startSourceStart);
        }

        const newEnd = clamp(
          drag.startEnd + dt,
          drag.startStart + minLen,
          maxEnd
        );

        c.start = drag.startStart;
        c.end = newEnd;

        if (c.type === 'video' || c.type === 'audio') {
          c.sourceStart = drag.startSourceStart;
          c.sourceEnd = drag.startSourceStart + Math.max(minLen, c.end - c.start);
        }
      }

      updateNodeVisual(c);
    };

    const onUp = (ev) => {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }

      node.classList.remove('le-dragging');

      this._draggingClip = null;

      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup', onUp, true);

      this._recomputeDuration();
      this._renderTimeline();
      this._renderInspector();
      this._updateAll();
      this._syncPreview();
    };

    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup', onUp, true);
  };

  node.addEventListener('mousedown', onMouseDown);

  node.addEventListener('click', (e) => {
    e.stopPropagation();

    if (node.__leDragged) {
      node.__leDragged = false;
      return;
    }

    this._selectClip(clip.id);
  });

  return node;
},
    _renderRuler(widthPx, totalDur) {
      const ruler = this._dom.ruler;
      if (!ruler) return;

      // tick spacing target ~ 80px
      const targetSpacing = 80;
      const totalSec = Math.max(totalDur, 1);
      let secStep = (totalSec / (widthPx / targetSpacing));
      // redondear a paso "lindo"
      const nice = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60];
      secStep = nice.reduce((a, b) => Math.abs(b - secStep) < Math.abs(a - secStep) ? b : a, nice[0]);
      if (secStep < 0.1) secStep = 0.1;

      const ticks = [];
      for (let t = 0; t <= totalSec + 0.001; t += secStep) {
        const pct = t / totalSec;
        const isMajor = Math.abs((t / secStep) % 1) < 0.001;
        ticks.push(`<div class="le-ruler-tick" style="left:${pct * 100}%;height:${isMajor ? '100%' : '50%'};"></div>`);
        ticks.push(`<div class="le-ruler-label" style="left:${pct * 100}%">${fmtTime(t)}</div>`);
      }
      ruler.innerHTML = ticks.join('');
    },

    /* ======= SELECCIÓN + INSPECTOR ======= */
    _selectClip(clipId) {
      this._selectedClipId = clipId;
      this._renderTimeline();
      this._renderOverlays();
      this._renderInspector();
      this._updateAll();
    },

    _getSelectedClip() {
      return this._clips.find(c => c.id === this._selectedClipId) || null;
    },

    _renderInspector() {
      const body = this._dom.inspBody;
      const clip = this._getSelectedClip();

      if (!clip) {
        body.innerHTML = this._renderInspectorEmpty();
        this._dom.inspTitle.textContent = 'Inspector';
        this._dom.inspSub.textContent = 'Selecciona un clip para editar sus propiedades';
        // Re-collect dom referencia a status / exportFill
        this._dom.status = body.querySelector('[data-le="status"]');
        this._dom.exportFill = body.querySelector('[data-le="exportFill"]');
        this._updateMetaCells();
        return;
      }

      this._dom.inspTitle.textContent = `${clip.type.toUpperCase()}: ${(clip.name || '').slice(0, 26)}`;
      this._dom.inspSub.textContent = `${fmtTime(clip.start)} → ${fmtTime(clip.end)} · ${fmtTime(clip.end - clip.start)}`;

      let html = '';

      // Tiempos básicos (todos los clips)
      html += `
        <div class="le-meta-grid">
          <div class="le-meta-cell"><span>Inicio</span><b>${fmtTime(clip.start)}</b></div>
          <div class="le-meta-cell"><span>Fin</span><b>${fmtTime(clip.end)}</b></div>
          <div class="le-meta-cell"><span>Duración</span><b>${fmtTime(clip.end - clip.start)}</b></div>
          <div class="le-meta-cell"><span>Tipo</span><b>${clip.type}</b></div>
        </div>
      `;

      // Por tipo
      if (clip.type === 'video' || clip.type === 'audio') {
        html += `
          <div class="le-field">
            <div class="le-field-row">
              <span class="le-field-label">🔊 Volumen</span>
              <span class="le-field-value" data-le="iVolValue">${Math.round((clip.volume || 0) * 100)}%</span>
            </div>
            <input type="range" min="0" max="200" value="${Math.round((clip.volume || 0) * 100)}" data-le="iVol" />
          </div>
          <button class="le-mini-btn" data-le="iMute" type="button">${clip.muted ? '🔈 Activar audio' : '🔇 Silenciar'}</button>
        `;
      }

      if (clip.type === 'image') {
        html += `
          <div class="le-field">
            <div class="le-field-row"><span class="le-field-label">↔ Posición X</span><span class="le-field-value" data-le="iXValue">${clip.x}%</span></div>
            <input type="range" min="0" max="100" value="${clip.x}" data-le="iX" />
          </div>
          <div class="le-field">
            <div class="le-field-row"><span class="le-field-label">↕ Posición Y</span><span class="le-field-value" data-le="iYValue">${clip.y}%</span></div>
            <input type="range" min="0" max="100" value="${clip.y}" data-le="iY" />
          </div>
          <div class="le-field">
            <div class="le-field-row"><span class="le-field-label">⤢ Tamaño</span><span class="le-field-value" data-le="iScaleValue">${clip.scale}%</span></div>
            <input type="range" min="5" max="200" value="${clip.scale}" data-le="iScale" />
          </div>
          <div class="le-field">
            <div class="le-field-row"><span class="le-field-label">⟳ Rotación</span><span class="le-field-value" data-le="iRotValue">${clip.rotation}°</span></div>
            <input type="range" min="-180" max="180" value="${clip.rotation}" data-le="iRot" />
          </div>
          <div class="le-field">
            <div class="le-field-row"><span class="le-field-label">◐ Opacidad</span><span class="le-field-value" data-le="iOpacityValue">${clip.opacity}%</span></div>
            <input type="range" min="0" max="100" value="${clip.opacity}" data-le="iOpacity" />
          </div>
        `;
      }

      if (clip.type === 'text') {
        html += `
          <div class="le-field">
            <span class="le-field-label">Texto</span>
            <textarea data-le="iText" rows="3">${escapeHtml(clip.text)}</textarea>
          </div>
          <div class="le-field">
            <span class="le-field-label">Estilo preset</span>
            <select data-le="iPreset">
              ${Object.entries(TEXT_PRESETS).map(([k, p]) =>
                `<option value="${k}" ${clip.preset===k?'selected':''}>${p.label}</option>`
              ).join('')}
            </select>
          </div>
          <div class="le-field">
            <div class="le-field-row"><span class="le-field-label">Tamaño fuente</span><span class="le-field-value" data-le="iSizeValue">${clip.size}px</span></div>
            <input type="range" min="14" max="160" value="${clip.size}" data-le="iSize" />
          </div>
          <div class="le-field">
            <span class="le-field-label">Color del texto</span>
            <input type="color" value="${clip.color}" data-le="iColor" />
          </div>
          <div class="le-field">
            <div class="le-field-row"><span class="le-field-label">↔ Posición X</span><span class="le-field-value" data-le="iXValue">${clip.x}%</span></div>
            <input type="range" min="0" max="100" value="${clip.x}" data-le="iX" />
          </div>
          <div class="le-field">
            <div class="le-field-row"><span class="le-field-label">↕ Posición Y</span><span class="le-field-value" data-le="iYValue">${clip.y}%</span></div>
            <input type="range" min="0" max="100" value="${clip.y}" data-le="iY" />
          </div>
          <div class="le-field">
            <div class="le-field-row"><span class="le-field-label">◐ Opacidad</span><span class="le-field-value" data-le="iOpacityValue">${clip.opacity}%</span></div>
            <input type="range" min="0" max="100" value="${clip.opacity}" data-le="iOpacity" />
          </div>
        `;
      }

      // Tiempo numérico editable
      html += `
        <div class="le-field">
          <div class="le-field-row">
            <span class="le-field-label">⏱ Inicio (s)</span>
            <span class="le-field-value">${fmtTime(clip.start)}</span>
          </div>
          <input type="number" step="0.1" min="0" value="${clip.start.toFixed(2)}" data-le="iStart" />
        </div>
        <div class="le-field">
          <div class="le-field-row">
            <span class="le-field-label">⏱ Fin (s)</span>
            <span class="le-field-value">${fmtTime(clip.end)}</span>
          </div>
          <input type="number" step="0.1" min="0" value="${clip.end.toFixed(2)}" data-le="iEnd" />
        </div>
      `;

      html += `
        <button class="le-btn le-btn-danger" data-le="iDelete" type="button">🗑 Eliminar clip</button>
        <div class="le-status" data-le="status"><strong>Atajos</strong><br>Espacio: play/pausa · S: dividir · Supr: borrar · ←/→: mover playhead</div>
        <div class="le-export-bar"><div class="le-export-fill" data-le="exportFill"></div></div>
      `;

      body.innerHTML = html;
      this._dom.status = body.querySelector('[data-le="status"]');
      this._dom.exportFill = body.querySelector('[data-le="exportFill"]');

      this._bindInspectorEvents(clip, body);
    },

    _bindInspectorEvents(clip, body) {
      const link = (sel, valSel, onChange, fmt) => {
        const inp = body.querySelector(sel);
        const lbl = valSel ? body.querySelector(valSel) : null;
        if (!inp) return;
        inp.addEventListener('input', () => {
          const v = inp.type === 'number' || inp.type === 'range' ? Number(inp.value) : inp.value;
          if (lbl && fmt) lbl.textContent = fmt(v);
          onChange(v);
        });
      };

      // Volumen / mute
      link('[data-le="iVol"]', '[data-le="iVolValue"]', (v) => {
        clip.volume = v / 100;
        if (this._activeVideoEl && clip.type === 'video' && clip.id === this._activeVideoClipId) {
          this._activeVideoEl.volume = clamp(v / 100, 0, 1);
        }
        this._updateAudioVolumes();
      }, (v) => `${Math.round(v)}%`);

      const muteBtn = body.querySelector('[data-le="iMute"]');
      if (muteBtn) muteBtn.addEventListener('click', () => {
        clip.muted = !clip.muted;
        if (clip.muted) clip.volume = 0; else clip.volume = clip.volume || 1;
        this._renderInspector();
        this._updateAudioVolumes();
      });

      // Image / Text
      link('[data-le="iX"]', '[data-le="iXValue"]', (v) => { clip.x = v; this._renderOverlays(); }, (v) => `${Math.round(v)}%`);
      link('[data-le="iY"]', '[data-le="iYValue"]', (v) => { clip.y = v; this._renderOverlays(); }, (v) => `${Math.round(v)}%`);
      link('[data-le="iScale"]', '[data-le="iScaleValue"]', (v) => { clip.scale = v; this._renderOverlays(); }, (v) => `${Math.round(v)}%`);
      link('[data-le="iRot"]', '[data-le="iRotValue"]', (v) => { clip.rotation = v; this._renderOverlays(); }, (v) => `${Math.round(v)}°`);
      link('[data-le="iOpacity"]', '[data-le="iOpacityValue"]', (v) => { clip.opacity = v; this._renderOverlays(); }, (v) => `${Math.round(v)}%`);

      // Texto
      const textArea = body.querySelector('[data-le="iText"]');
      if (textArea) textArea.addEventListener('input', () => {
        clip.text = textArea.value;
        this._renderOverlays();
        this._renderTimeline();
      });

      const presetSel = body.querySelector('[data-le="iPreset"]');
      if (presetSel) presetSel.addEventListener('change', () => {
        const k = presetSel.value;
        const p = TEXT_PRESETS[k];
        if (!p) return;
        clip.preset = k;
        clip.font = p.font;
        clip.weight = p.weight;
        clip.size = p.size;
        clip.color = p.color;
        clip.bg = p.bg;
        clip.pad = p.pad;
        clip.radius = p.radius;
        clip.shadow = p.shadow;
        clip.stroke = p.stroke;
        this._renderInspector();
        this._renderOverlays();
      });

      link('[data-le="iSize"]', '[data-le="iSizeValue"]', (v) => { clip.size = v; this._renderOverlays(); }, (v) => `${Math.round(v)}px`);

      const colorInp = body.querySelector('[data-le="iColor"]');
      if (colorInp) colorInp.addEventListener('input', () => {
        clip.color = colorInp.value;
        this._renderOverlays();
      });

      // Inicio / fin numéricos
      const startInp = body.querySelector('[data-le="iStart"]');
      const endInp = body.querySelector('[data-le="iEnd"]');
      if (startInp) startInp.addEventListener('change', () => {
        const v = clamp(Number(startInp.value || 0), 0, Math.max(0, clip.end - 0.1));
        clip.start = v;
        this._recomputeDuration();
        this._renderTimeline(); this._renderInspector(); this._updateAll();
      });
      if (endInp) endInp.addEventListener('change', () => {
        const v = Math.max(clip.start + 0.1, Number(endInp.value || 0));
        clip.end = v;
        this._recomputeDuration();
        this._renderTimeline(); this._renderInspector(); this._updateAll();
      });

      // Delete
      const delBtn = body.querySelector('[data-le="iDelete"]');
      if (delBtn) delBtn.addEventListener('click', () => this._deleteSelected());
    },

    _updateMetaCells() {
      const f = FORMATS[this._format] || FORMATS.tiktok;
      const root = this._root;
      const set = (key, value) => {
        const el = root.querySelector(`[data-le="${key}"]`);
        if (el) el.textContent = value;
      };
      set('metaFormat', f.icon);
      set('metaRes', `${f.w}×${f.h}`);
      set('metaClips', String(this._clips.length));
      set('metaDur', fmtTime(this._duration));
    },


    /* ======= OVERLAYS (preview en vivo) ======= */
    _renderOverlays() {
      const layer = this._dom.overlayLayer;
      if (!layer) return;

      const t = this._currentTime || 0;
      const activeOverlays = this._clips.filter(c =>
        (c.type === 'image' || c.type === 'text') &&
        t >= (c.start || 0) && t <= (c.end || 0)
      );

      // Limpia
      layer.innerHTML = '';

      activeOverlays.forEach(clip => {
        const el = document.createElement('div');
        el.className = 'le-overlay';
        el.setAttribute('data-clip-id', clip.id);
        el.style.left = `${clip.x || 50}%`;
        el.style.top = `${clip.y || 50}%`;
        el.style.opacity = `${(clip.opacity ?? 100) / 100}`;
        el.style.transform = `translate(-50%, -50%) rotate(${clip.rotation || 0}deg)`;

        if (clip.type === 'image') {
          const item = this._library.find(it => it.id === clip.libId);
          if (!item) return;
          const scaleVal = (clip.scale || 50) / 100;
          el.style.width = `${scaleVal * 100}%`;
          el.innerHTML = `<img class="le-overlay-img" src="${item.src}" alt="" draggable="false" />`;
        } else if (clip.type === 'text') {
          const inner = document.createElement('div');
          inner.className = 'le-overlay-text';
          inner.style.fontFamily = clip.font || 'Inter, sans-serif';
          inner.style.fontWeight = String(clip.weight || 700);
          inner.style.fontSize = `${clip.size || 40}px`;
          inner.style.color = clip.color || '#fff';
          if (clip.bg && clip.bg !== 'transparent') inner.style.background = clip.bg;
          if (clip.pad) inner.style.padding = clip.pad;
          if (clip.radius) inner.style.borderRadius = `${clip.radius}px`;
          if (clip.shadow && clip.shadow !== 'none') inner.style.textShadow = clip.shadow;
          if (clip.stroke) inner.style.webkitTextStroke = `${clip.stroke}px #000`;
          inner.textContent = clip.text || 'Texto';
          el.appendChild(inner);
        }

        if (clip.id === this._selectedClipId) el.classList.add('le-selected');

        // Click selecciona
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          this._selectClip(clip.id);
        });

        // Drag para mover en canvas
        el.addEventListener('mousedown', (e) => {
          if (e.button !== 0) return;
          e.stopPropagation(); e.preventDefault();
          this._selectClip(clip.id);

          const wrapRect = this._dom.canvasWrap.getBoundingClientRect();
          this._draggingOverlay = {
            clipId: clip.id,
            startX: e.clientX,
            startY: e.clientY,
            startXp: clip.x || 50,
            startYp: clip.y || 50,
            wrapW: wrapRect.width,
            wrapH: wrapRect.height
          };

          const onMove = (ev) => {
            if (!this._draggingOverlay) return;
            const dxp = ((ev.clientX - this._draggingOverlay.startX) / this._draggingOverlay.wrapW) * 100;
            const dyp = ((ev.clientY - this._draggingOverlay.startY) / this._draggingOverlay.wrapH) * 100;
            const c = this._clips.find(cc => cc.id === this._draggingOverlay.clipId);
            if (!c) return;
            c.x = clamp(this._draggingOverlay.startXp + dxp, 0, 100);
            c.y = clamp(this._draggingOverlay.startYp + dyp, 0, 100);
            this._renderOverlays();
            // actualizar inspector si está abierto
            const xLbl = this._dom.inspBody.querySelector('[data-le="iXValue"]');
            const yLbl = this._dom.inspBody.querySelector('[data-le="iYValue"]');
            const xInp = this._dom.inspBody.querySelector('[data-le="iX"]');
            const yInp = this._dom.inspBody.querySelector('[data-le="iY"]');
            if (xLbl) xLbl.textContent = `${Math.round(c.x)}%`;
            if (yLbl) yLbl.textContent = `${Math.round(c.y)}%`;
            if (xInp) xInp.value = String(Math.round(c.x));
            if (yInp) yInp.value = String(Math.round(c.y));
          };
          const onUp = () => {
            this._draggingOverlay = null;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
          };
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        });

        layer.appendChild(el);
      });
    },

    /* ======= REPRODUCCIÓN ======= */
    _ensureMediaElements() {
      // Crear elementos de video / audio ocultos por libId si no existen
      this._library.forEach(item => {
        if (item.type === 'video' && !this._videoEls[item.id]) {
          const v = document.createElement('video');
          v.src = item.src;
          v.preload = 'auto';
          v.playsInline = true;
          v.muted = true;
          v.style.position = 'fixed';
          v.style.left = '-9999px';
          v.style.width = '1px';
          v.style.height = '1px';
          document.body.appendChild(v);
          this._videoEls[item.id] = v;
        }
        if (item.type === 'audio' && !this._audioEls[item.id]) {
          const a = document.createElement('audio');
          a.src = item.src;
          a.preload = 'auto';
          a.volume = 1;
          a.style.position = 'fixed';
          a.style.left = '-9999px';
          document.body.appendChild(a);
          this._audioEls[item.id] = a;
        }
      });
    },

    _destroyMediaElements() {
      Object.values(this._videoEls).forEach(v => {
        try { v.pause(); v.removeAttribute('src'); v.load(); v.remove(); } catch (e) {}
      });
      Object.values(this._audioEls).forEach(a => {
        try { a.pause(); a.removeAttribute('src'); a.load(); a.remove(); } catch (e) {}
      });
      this._videoEls = {};
      this._audioEls = {};
      try { this._dom.video.pause(); this._dom.video.removeAttribute('src'); this._dom.video.load(); } catch (e) {}
      this._activeVideoEl = null;
      this._activeVideoClipId = null;
    },

_getActiveVideoClipAt(t) {
  const time = Number(t || 0);
  const EPS = 0.05;

  const videos = this._clips
    .filter(c => c.type === 'video')
    .sort((a, b) => a.start - b.start);

  return videos.find((c, index) => {
    const isLast = index === videos.length - 1;
    return time >= c.start - EPS && (time < c.end - EPS || (isLast && time <= c.end + EPS));
  }) || null;
},

_switchActiveVideo(clip) {
  const previewVideo = this._dom.video;

  if (!previewVideo) return;

  if (!clip) {
    previewVideo.classList.remove('le-on');
    try {
      previewVideo.pause();
      previewVideo.removeAttribute('src');
      previewVideo.load();
    } catch (e) {}

    this._activeVideoEl = null;
    this._activeVideoClipId = null;
    return;
  }

  const item = this._library.find(it => it.id === clip.libId);

  if (!item || !item.src) {
    previewVideo.classList.remove('le-on');
    this._activeVideoEl = null;
    this._activeVideoClipId = null;
    return;
  }

  const localT = Math.max(0, (this._currentTime - clip.start) + (clip.sourceStart || 0));

  const applyTime = () => {
    try {
      const maxDur = Number.isFinite(previewVideo.duration) ? previewVideo.duration : 9999;
      previewVideo.currentTime = clamp(localT, 0, maxDur);
    } catch (e) {}
  };

  if (previewVideo.src !== item.src) {
    try {
      previewVideo.pause();
    } catch (e) {}

    previewVideo.src = item.src;
    previewVideo.preload = 'auto';
    previewVideo.playsInline = true;
    previewVideo.load();
  }

  previewVideo.classList.add('le-on');
  this._activeVideoEl = previewVideo;
  this._activeVideoClipId = clip.id;

  previewVideo.muted = !!clip.muted;
  previewVideo.volume = clamp((clip.volume ?? 1), 0, 1);

  if (previewVideo.readyState >= 1) {
    applyTime();
  } else {
    previewVideo.addEventListener('loadedmetadata', applyTime, { once: true });
  }

  if (this._playing) {
    previewVideo.play().catch(() => {});
  }
},

_syncPreview() {
  this._ensureMediaElements();

  if (!this._duration) {
    this._switchActiveVideo(null);
    this._renderOverlays();
    this._updateAll();
    return;
  }

  const t = clamp(this._currentTime, 0, this._duration);
  this._currentTime = t;

  const activeClip = this._getActiveVideoClipAt(t);
  this._switchActiveVideo(activeClip);

  if (!activeClip && this._dom.video) {
    this._dom.video.classList.remove('le-on');
  }

  this._syncAudios(t);
  this._renderOverlays();
  this._updateAll();
},

    _seek(t) {
      if (!this._duration) return;
      this._currentTime = clamp(t, 0, this._duration);

      // Sync video element
      const activeClip = this._getActiveVideoClipAt(this._currentTime);
      this._switchActiveVideo(activeClip);
      if (activeClip && this._activeVideoEl) {
        const local = (this._currentTime - activeClip.start) + (activeClip.sourceStart || 0);
        try { this._activeVideoEl.currentTime = clamp(local, 0, this._activeVideoEl.duration || 9999); } catch (e) {}
      }

      // Sync audios
      this._syncAudios(this._currentTime);
      this._renderOverlays();
      this._updateAll();
    },

    _syncAudios(t) {
      // Para cada clip de audio activo, asegurar que reproduce; otros pause
      const audioClips = this._clips.filter(c => c.type === 'audio');
      audioClips.forEach(clip => {
        const a = this._audioEls[clip.libId];
        if (!a) return;
        const isActive = t >= clip.start && t < clip.end;
        if (isActive) {
          const local = (t - clip.start) + (clip.sourceStart || 0);
          if (Math.abs((a.currentTime || 0) - local) > 0.25) {
            try { a.currentTime = clamp(local, 0, a.duration || 9999); } catch (e) {}
          }
          a.volume = clamp((clip.volume ?? 1), 0, 1);
          a.muted = !!clip.muted;
          if (this._playing && a.paused) {
            a.play().catch(() => {});
          } else if (!this._playing && !a.paused) {
            a.pause();
          }
        } else {
          if (!a.paused) a.pause();
        }
      });
    },

    _updateAudioVolumes() {
      this._clips.filter(c => c.type === 'audio').forEach(clip => {
        const a = this._audioEls[clip.libId];
        if (a) {
          a.volume = clamp((clip.volume ?? 1), 0, 1);
          a.muted = !!clip.muted;
        }
      });
      if (this._activeVideoClipId) {
        const c = this._clips.find(cc => cc.id === this._activeVideoClipId);
        if (c && this._activeVideoEl) {
          this._activeVideoEl.volume = clamp((c.volume ?? 1), 0, 1);
          this._activeVideoEl.muted = !!c.muted;
        }
      }
    },

    _togglePlay() {
      if (!this._duration) return;
      if (this._playing) this._pause();
      else this._play();
    },

    _play() {
      this._ensureMediaElements();

      // Si llegó al final, reset
      if (this._currentTime >= this._duration - 0.1) {
        this._seek(0);
      }

      this._playing = true;
      this._dom.play.textContent = SVG_ICONS.pause;

      const activeClip = this._getActiveVideoClipAt(this._currentTime);
      this._switchActiveVideo(activeClip);
      if (activeClip && this._activeVideoEl) {
        const local = (this._currentTime - activeClip.start) + (activeClip.sourceStart || 0);
        try { this._activeVideoEl.currentTime = clamp(local, 0, this._activeVideoEl.duration || 9999); } catch (e) {}
        this._activeVideoEl.play().catch(() => {});
      }

      this._syncAudios(this._currentTime);
      this._startRaf();
    },

    _pause() {
      this._playing = false;
      this._dom.play.textContent = SVG_ICONS.play;
      if (this._activeVideoEl) try { this._activeVideoEl.pause(); } catch (e) {}
      Object.values(this._audioEls).forEach(a => { try { a.pause(); } catch (e) {} });
      this._stopRaf();
    },

    _startRaf() {
      this._stopRaf();
      let lastT = performance.now();
      const loop = (now) => {
        if (!this._playing) return;
        const dt = (now - lastT) / 1000;
        lastT = now;
        const newT = this._currentTime + dt;

        if (newT >= this._duration) {
          this._seek(this._duration);
          this._pause();
          return;
        }

        // ¿cambiamos de clip de video?
        const activeNow = this._getActiveVideoClipAt(newT);
        if (activeNow && activeNow.id !== this._activeVideoClipId) {
          this._switchActiveVideo(activeNow);
          if (this._activeVideoEl) {
            const local = (newT - activeNow.start) + (activeNow.sourceStart || 0);
            try { this._activeVideoEl.currentTime = clamp(local, 0, this._activeVideoEl.duration || 9999); } catch (e) {}
            this._activeVideoEl.play().catch(() => {});
          }
        } else if (!activeNow && this._activeVideoClipId) {
          this._switchActiveVideo(null);
        }

        this._currentTime = newT;
        this._syncAudios(this._currentTime);
        this._renderOverlays();
        this._updateAll();
        this._raf = requestAnimationFrame(loop);
      };
      this._raf = requestAnimationFrame(loop);
    },

    _stopRaf() {
      if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; }
    },

    /* ======= ACCIONES TIMELINE ======= */
    _splitAtPlayhead() {
      if (!this._duration) return;
      const t = this._currentTime;

      let didSplit = false;
      const newClips = [];
      this._clips.forEach(c => {
        if (t > c.start + 0.1 && t < c.end - 0.1) {
          // dividir
          const a = Object.assign({}, c, {
            id: uid('clip'),
            end: t,
            sourceEnd: c.type === 'video' || c.type === 'audio' ? (c.sourceStart || 0) + (t - c.start) : c.sourceEnd
          });
          const b = Object.assign({}, c, {
            id: uid('clip'),
            start: t,
            sourceStart: c.type === 'video' || c.type === 'audio' ? (c.sourceStart || 0) + (t - c.start) : c.sourceStart
          });
          newClips.push(a, b);
          didSplit = true;
        } else {
          newClips.push(c);
        }
      });
      this._clips = newClips;
      if (didSplit) {
        this._setStatus('Clips divididos.', `Cortes nuevos en ${fmtTime(t)}`);
        this._selectedClipId = null;
        // Forzar re-evaluación: el clip de video activo puede haber cambiado de id
        this._activeVideoClipId = null;
        this._renderTimeline();
        this._renderInspector();
        this._syncPreview();
      } else {
        this._setStatus('No se puede dividir aquí.', 'Mueve el playhead dentro de un clip.');
      }
    },

    _deleteSelected() {
      const id = this._selectedClipId;
      if (!id) return;
      this._clips = this._clips.filter(c => c.id !== id);
      this._selectedClipId = null;
      if (this._activeVideoClipId === id) {
        this._activeVideoClipId = null;
      }
      this._recomputeDuration();
      this._renderTimeline();
      this._renderInspector();
      this._syncPreview();
      this._setStatus('Clip eliminado.', this._clips.length ? `Quedan ${this._clips.length} clip(s).` : 'Timeline vacía.');
    },


    /* ======= UPDATE ALL (sync UI) ======= */
    _updateAll() {
      const d = this._dom;
     if (!d || !d.video) return;

this._resizeCanvasWrap();

      const hasContent = this._clips.length > 0 && this._duration > 0;
      const hasVideo = this._clips.some(c => c.type === 'video');

      d.empty.style.display = hasContent ? 'none' : 'grid';

      d.play.disabled = !hasContent || this._exporting;
      d.rewind.disabled = !hasContent || this._exporting;
      d.scrub.disabled = !hasContent || this._exporting;
      d.splitBtn.disabled = !hasContent || this._exporting;
      d.exportTop.disabled = !hasContent || this._exporting;
      d.splitMini.disabled = !hasContent || this._exporting;
      d.deleteMini.disabled = !this._selectedClipId || this._exporting;

      d.current.textContent = fmtTime(this._currentTime);
      d.total.textContent = fmtTime(this._duration);
      const pct = this._duration ? this._currentTime / this._duration : 0;
      d.scrub.value = String(Math.round(pct * 10000));

      // Playhead position
      d.playhead.style.left = `${pct * 100}%`;

      // Play button icon
      d.play.textContent = this._playing ? SVG_ICONS.pause : SVG_ICONS.play;

      // Meta cells (en inspector vacío)
      this._updateMetaCells();
    },

_setStatus(title, detail) {
  const status = this._dom.status || (this._dom.inspBody && this._dom.inspBody.querySelector('[data-le="status"]'));
  if (status) {
    status.innerHTML = `<strong>${escapeHtml(title || 'Estado')}</strong><br>${escapeHtml(detail || '')}`;
  }
},

_setExportProgress(percent, title, detail) {
  const pct = clamp(Number(percent || 0), 0, 100);
  const rounded = Math.round(pct);

  const fillEl = this._dom.exportFill || (this._dom.inspBody && this._dom.inspBody.querySelector('[data-le="exportFill"]'));
  if (fillEl) fillEl.style.width = `${rounded}%`;

  const overlay = this._dom.exportOverlay;
  const overlayFill = this._dom.exportOverlayFill;
  const percentEl = this._dom.exportPercent;
  const titleEl = this._dom.exportTitle;
  const detailEl = this._dom.exportDetail;

  if (overlay) {
    overlay.classList.add('le-on');
    overlay.classList.toggle('le-done', rounded >= 100);
  }

  if (overlayFill) overlayFill.style.width = `${rounded}%`;
  if (percentEl) percentEl.textContent = `${rounded}%`;
  if (titleEl) titleEl.textContent = title || 'Exportando';
  if (detailEl) detailEl.textContent = detail || `${rounded}%`;

  if (title || detail) {
    this._setStatus(title || 'Exportando...', detail || `${rounded}%`);
  }

  if (rounded >= 100 && overlay) {
    window.setTimeout(() => {
      if (!this._exporting && this._dom.exportOverlay) {
        this._dom.exportOverlay.classList.remove('le-on', 'le-done');
      }
    }, 6500);
  }
},

    _startExportPulse(title, detail) {
      this._stopExportPulse();
      let pct = 6;
      this._setExportProgress(pct, title, detail);
      this._exportPulseTimer = window.setInterval(() => {
        pct = Math.min(92, pct + Math.max(0.35, (92 - pct) * 0.035));
        this._setExportProgress(pct, title, `${Math.round(pct)}% - el motor nativo esta renderizando.`);
      }, 420);
    },

    _stopExportPulse() {
      if (this._exportPulseTimer) {
        try { window.clearInterval(this._exportPulseTimer); } catch (e) {}
        this._exportPulseTimer = 0;
      }
    },

    _buildProjectSnapshot() {
      if (projectSchema && typeof projectSchema.createProjectSnapshot === 'function') {
        return projectSchema.createProjectSnapshot({
          version: VERSION,
          format: this._format,
          duration: this._duration,
          library: this._library,
          clips: this._clips,
          lthRoot: LTH_ROOT
        });
      }

      return {
        version: VERSION,
        savedAt: new Date().toISOString(),
        format: this._format,
        duration: this._duration,
        library: this._library.map(it => ({
          id: it.id,
          type: it.type,
          name: it.name,
          duration: it.duration,
          w: it.w,
          h: it.h,
          size: it.size,
          sourcePath: String(it.sourcePath || ''),
          mimeType: String(it.mimeType || ''),
          lastModified: Number(it.lastModified || 0),
          extractedFrom: String(it.extractedFrom || '')
        })),
        clips: this._clips.map(c => ({ ...c }))
      };
    },

    /* ======= EXPORT ======= */
    async _exportProject() {
      if (this._exporting) return;
      if (!this._clips.length || !this._duration) {
        this._setStatus('Nada que exportar.', 'Añade al menos un clip al timeline.');
        return;
      }

      const project = this._buildProjectSnapshot();
      this._pause();
      this._exporting = true;
      this._exportCancelled = false;
this._startExportPulse('Exportando con motor C++...', 'Preparando proyecto y validando medios.');
this._updateAll();

// Permite que Chromium pinte el panel de progreso antes de iniciar el trabajo pesado.
await new Promise(resolve => window.setTimeout(resolve, 120));

try {
        if (!engineClient || typeof engineClient.exportProject !== 'function') {
          this._setExportProgress(0, 'Motor no disponible.', 'No se encontro el puente videoEngine para exportar.');
          return null;
        }

          const result = await engineClient.exportProject(project, {
            format: this._format
          }, (progress) => {
            this._stopExportPulse();
            const pct = clamp(Number(progress && progress.percent || 0), 0, 100);
            const stage = String(progress && progress.stage || '');
            const detail = progress && progress.detail
              ? progress.detail
              : `${Math.round(pct)}% - el motor nativo esta renderizando.`;
            const title = stage === 'fallback'
              ? 'Reintentando export...'
              : (stage === 'done' ? 'Export listo.' : 'Exportando con motor C++...');
            this._setExportProgress(pct, title, `${Math.round(pct)}% - ${detail}`);
          });

   if (result && result.success && result.handled) {
  this._stopExportPulse();

  const filePath = result.filePath || result.outputPath || '';
  const size = Number(result.outputSize || 0);
  const sizeText = size > 0 ? ` · ${fileSizeStr(size)}` : '';

  this._setExportProgress(
    100,
    'Exportación lista',
    filePath ? `Guardado en: ${filePath}${sizeText}` : 'El video fue exportado correctamente.'
  );

  return result;
}

        this._stopExportPulse();
        if (result && result.canceled) {
          this._setExportProgress(0, 'Export cancelado.', 'No se guardo ningun archivo.');
          return result;
        }

        const message = result && result.error ? result.error : 'El motor nativo no pudo completar la exportacion.';
        const hint = result && result.fallback === 'web'
          ? `${message} Reimporta los medios con el boton + Importar para que el motor use rutas reales.`
          : message;
        this._setExportProgress(0, 'Export detenido.', hint);
        return result;
      } catch (error) {
        this._stopExportPulse();
        this._setExportProgress(0, 'Error al exportar.', error && error.message ? error.message : String(error));
        return null;
      } finally {
        this._stopExportPulse();
        this._exporting = false;
        this._updateAll();
      }
    },

    async _exportProjectLegacy() {
      if (this._exporting) return;
      if (!this._clips.length || !this._duration) {
        this._setStatus('Nada que exportar.', 'Añade al menos un clip al timeline.');
        return;
      }

      const captureFn = HTMLMediaElement.prototype.captureStream || HTMLMediaElement.prototype.mozCaptureStream;
      const canvasCaptureFn = HTMLCanvasElement.prototype.captureStream;
      if (!window.MediaRecorder || !canvasCaptureFn) {
        this._setStatus('Export no soportado.', 'Esta versión de Chromium no soporta MediaRecorder/captureStream.');
        return;
      }

      this._pause();
      this._exporting = true;
      this._exportCancelled = false;
      this._setStatus('Exportando...', 'Preparando canvas y mezclador de audio.');
      const fillEl = this._dom.exportFill;
      if (fillEl) fillEl.style.width = '0%';
      this._updateAll();

      const f = FORMATS[this._format] || FORMATS.tiktok;
      let canvasW = f.w;
      let canvasH = f.h;
      if (f.id === 'free') {
        const firstVid = this._library.find(it => it.type === 'video');
        canvasW = (firstVid && firstVid.w) || 1280;
        canvasH = (firstVid && firstVid.h) || 720;
      }

      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = canvasW;
      exportCanvas.height = canvasH;
      const ctx = exportCanvas.getContext('2d', { alpha: false });

      // Crear elementos de export para cada clip de video / audio
      const exportEls = {};
      const buildExportEl = async (libId, kind) => {
        const item = this._library.find(it => it.id === libId);
        if (!item) return null;
        const el = kind === 'audio' ? document.createElement('audio') : document.createElement('video');
        el.src = item.src;
        el.preload = 'auto';
        el.muted = false;
        el.crossOrigin = 'anonymous';
        if (kind === 'video') { el.playsInline = true; }
        el.style.position = 'fixed';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        if (el.readyState < 1) {
          try { await once(el, 'loadedmetadata', 12000); } catch (e) {}
        }
        return el;
      };

      // Pre-cache imágenes
      const imgCache = {};
      for (const c of this._clips) {
        if (c.type === 'image') {
          const item = this._library.find(it => it.id === c.libId);
          if (item && !imgCache[item.id]) {
            const img = new Image();
            img.src = item.src;
            try { await new Promise((res, rej) => { img.onload = res; img.onerror = rej; setTimeout(rej, 8000); }); } catch (e) {}
            imgCache[item.id] = img;
          }
        }
      }

      // Pre-cache video elements y audio elements
      for (const c of this._clips) {
        if ((c.type === 'video' || c.type === 'audio') && !exportEls[c.libId]) {
          exportEls[c.libId] = await buildExportEl(c.libId, c.type);
        }
      }

      // AudioContext para mezclar
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = AudioCtx ? new AudioCtx() : null;
      const audioDest = audioCtx ? audioCtx.createMediaStreamDestination() : null;

      const audioSources = {};
      const audioGains = {};

      const connectAudio = (clip) => {
        if (!audioCtx || !audioDest) return;
        const el = exportEls[clip.libId];
        if (!el) return;
        if (audioSources[clip.id]) return;
        try {
          const src = audioCtx.createMediaElementSource(el);
          const gain = audioCtx.createGain();
          gain.gain.value = clip.muted ? 0 : (clip.volume ?? 1);
          src.connect(gain).connect(audioDest);
          audioSources[clip.id] = src;
          audioGains[clip.id] = gain;
        } catch (e) {
          // Si ya está conectado, reusar
        }
      };

      // Conectar audio de TODOS los clips de video y audio (un audio source por libId)
      const connectedLibs = new Set();
      this._clips.filter(c => c.type === 'video' || c.type === 'audio').forEach(c => {
        if (connectedLibs.has(c.libId)) return;
        connectedLibs.add(c.libId);
        const el = exportEls[c.libId];
        if (!el || !audioCtx || !audioDest) return;
        try {
          const src = audioCtx.createMediaElementSource(el);
          const gain = audioCtx.createGain();
          gain.gain.value = c.muted ? 0 : (c.volume ?? 1);
          src.connect(gain).connect(audioDest);
          audioSources[c.libId] = src;
          audioGains[c.libId] = gain;
        } catch (e) {}
      });

      // Stream final = canvas + audio
      const canvasStream = exportCanvas.captureStream(30);
      let finalStream = canvasStream;
      if (audioDest) {
        finalStream = new MediaStream();
        canvasStream.getVideoTracks().forEach(t => finalStream.addTrack(t));
        audioDest.stream.getAudioTracks().forEach(t => finalStream.addTrack(t));
      }

      const mimeType = chooseMimeType();
      const recorder = new MediaRecorder(finalStream, mimeType ? { mimeType, videoBitsPerSecond: 6_000_000 } : { videoBitsPerSecond: 6_000_000 });
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };

      const recordPromise = new Promise((resolve, reject) => {
        recorder.onstop = () => {
          if (!chunks.length) return reject(new Error('Sin datos grabados.'));
          resolve(new Blob(chunks, { type: mimeType || 'video/webm' }));
        };
        recorder.onerror = (ev) => reject(new Error(ev && ev.error ? ev.error.message : 'Error de MediaRecorder.'));
      });

      // Función de render por frame
      const drawFrame = (t) => {
        // Fondo
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvasW, canvasH);

        // Video activo
        const vClip = this._clips.find(c => c.type === 'video' && t >= c.start && t < c.end);
        if (vClip) {
          const el = exportEls[vClip.libId];
          if (el && el.readyState >= 2) {
            // Cover
            const vw = el.videoWidth || canvasW;
            const vh = el.videoHeight || canvasH;
            const ratio = Math.max(canvasW / vw, canvasH / vh);
            const drawW = vw * ratio;
            const drawH = vh * ratio;
            const dx = (canvasW - drawW) / 2;
            const dy = (canvasH - drawH) / 2;
            try { ctx.drawImage(el, dx, dy, drawW, drawH); } catch (e) {}
          }
        }

        // Imágenes overlay
        const imgClips = this._clips.filter(c => c.type === 'image' && t >= c.start && t <= c.end);
        imgClips.forEach(clip => {
          const item = this._library.find(it => it.id === clip.libId);
          const img = item && imgCache[item.id];
          if (!img) return;
          const w = (clip.scale / 100) * canvasW;
          const ratio = img.naturalWidth ? (img.naturalHeight / img.naturalWidth) : 1;
          const h = w * ratio;
          const cx = (clip.x / 100) * canvasW;
          const cy = (clip.y / 100) * canvasH;

          ctx.save();
          ctx.globalAlpha = (clip.opacity ?? 100) / 100;
          ctx.translate(cx, cy);
          ctx.rotate(((clip.rotation || 0) * Math.PI) / 180);
          ctx.drawImage(img, -w/2, -h/2, w, h);
          ctx.restore();
        });

        // Texto overlay
        const textClips = this._clips.filter(c => c.type === 'text' && t >= c.start && t <= c.end);
        textClips.forEach(clip => {
          // Escala el size en proporción al canvas (asumiendo height de referencia 1920)
          const refH = 1920;
          const scale = canvasH / refH;
          const fontSize = (clip.size || 40) * scale;

          ctx.save();
          ctx.globalAlpha = (clip.opacity ?? 100) / 100;
          ctx.translate((clip.x / 100) * canvasW, (clip.y / 100) * canvasH);
          ctx.rotate(((clip.rotation || 0) * Math.PI) / 180);

          ctx.font = `${clip.weight || 700} ${fontSize}px ${clip.font || 'Inter, sans-serif'}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const lines = String(clip.text || '').split('\n');
          const lineH = fontSize * 1.18;

          // Background pill (si tiene)
          if (clip.bg && clip.bg !== 'transparent' && clip.bg.indexOf('gradient') === -1) {
            const padH = (parsePadValue(clip.pad, 0)) * scale + 8 * scale;
            const padV = (parsePadValue(clip.pad, 1)) * scale + 4 * scale;
            // medir el ancho máximo
            let maxW = 0;
            lines.forEach(line => {
              const m = ctx.measureText(line);
              if (m.width > maxW) maxW = m.width;
            });
            const bgW = maxW + padH * 2;
            const bgH = lineH * lines.length + padV * 2 - lineH * 0.2;
            ctx.fillStyle = clip.bg;
            roundedRect(ctx, -bgW/2, -bgH/2, bgW, bgH, (clip.radius || 0) * scale);
            ctx.fill();
          } else if (clip.bg && clip.bg.indexOf('gradient') !== -1) {
            // simplificación: usar primer color
            const m = clip.bg.match(/#([0-9a-f]{3,8})/i);
            const fallback = m ? m[0] : '#67e8f9';
            const padH = (parsePadValue(clip.pad, 0)) * scale + 12 * scale;
            const padV = (parsePadValue(clip.pad, 1)) * scale + 4 * scale;
            let maxW = 0;
            lines.forEach(line => { const mm = ctx.measureText(line); if (mm.width > maxW) maxW = mm.width; });
            const bgW = maxW + padH * 2;
            const bgH = lineH * lines.length + padV * 2 - lineH * 0.2;
            ctx.fillStyle = fallback;
            roundedRect(ctx, -bgW/2, -bgH/2, bgW, bgH, (clip.radius || 0) * scale);
            ctx.fill();
          }

          // Stroke (subtítulo style)
          if (clip.stroke) {
            ctx.lineWidth = clip.stroke * scale;
            ctx.strokeStyle = '#000';
            ctx.lineJoin = 'round';
          }
          // Shadow approximation
          if (clip.shadow && clip.shadow !== 'none') {
            ctx.shadowColor = clip.color || '#fff';
            ctx.shadowBlur = 16 * scale;
          }

          ctx.fillStyle = clip.color || '#fff';
          const startY = -((lines.length - 1) / 2) * lineH;
          lines.forEach((line, i) => {
            const ly = startY + i * lineH;
            if (clip.stroke) ctx.strokeText(line, 0, ly);
            ctx.fillText(line, 0, ly);
          });

          ctx.restore();
        });
      };

      function parsePadValue(pad, axis) {
        // pad string "8px 16px" => [8, 16]
        if (!pad || typeof pad !== 'string') return 0;
        const parts = pad.match(/-?\d+(\.\d+)?/g);
        if (!parts) return 0;
        if (parts.length === 1) return Number(parts[0]) || 0;
        return Number(parts[axis === 0 ? 1 : 0]) || 0; // axis 0 = horizontal
      }

      function roundedRect(ctx, x, y, w, h, r) {
        const rr = Math.min(r, w/2, h/2);
        ctx.beginPath();
        ctx.moveTo(x + rr, y);
        ctx.lineTo(x + w - rr, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
        ctx.lineTo(x + w, y + h - rr);
        ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
        ctx.lineTo(x + rr, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
        ctx.lineTo(x, y + rr);
        ctx.quadraticCurveTo(x, y, x + rr, y);
        ctx.closePath();
      }

      try {
        // Audio context resume
        if (audioCtx && audioCtx.state === 'suspended') {
          try { await audioCtx.resume(); } catch (e) {}
        }

        // Iniciar todos los media elements según corresponda
        Object.values(exportEls).forEach(el => { try { el.currentTime = 0; el.muted = false; } catch (e) {} });

        recorder.start(200);

        const startTime = performance.now();
        const totalDur = this._duration;
        const fps = 30;
        const frameMs = 1000 / fps;
        let lastFrame = -1;
        let activeVideoLib = null;
        let activeAudios = new Set();

        await new Promise((resolve) => {
          const tick = () => {
            if (this._exportCancelled) return resolve();
            const elapsed = (performance.now() - startTime) / 1000;
            const t = Math.min(elapsed, totalDur);

            // Sync video element activo (cambiar src no — ya cargamos cada uno; usamos el del clip activo)
            const vClip = this._clips.find(c => c.type === 'video' && t >= c.start && t < c.end);
            if (vClip) {
              const el = exportEls[vClip.libId];
              if (el && activeVideoLib !== vClip.libId) {
                // pausar otros
                Object.entries(exportEls).forEach(([k, e]) => {
                  if (k !== vClip.libId && this._library.find(it => it.id === k && it.type === 'video')) {
                    try { e.pause(); } catch (er) {}
                  }
                });
                const local = (t - vClip.start) + (vClip.sourceStart || 0);
                try { el.currentTime = clamp(local, 0, el.duration || 9999); } catch (er) {}
                el.play().catch(() => {});
                activeVideoLib = vClip.libId;
              }
              if (audioGains[vClip.libId]) audioGains[vClip.libId].gain.value = vClip.muted ? 0 : (vClip.volume ?? 1);
            } else if (activeVideoLib) {
              const el = exportEls[activeVideoLib];
              if (el) try { el.pause(); } catch (er) {}
              activeVideoLib = null;
            }

            // Sync audio clips
            this._clips.filter(c => c.type === 'audio').forEach(c => {
              const el = exportEls[c.libId];
              if (!el) return;
              const isActive = t >= c.start && t < c.end;
              if (isActive) {
                if (!activeAudios.has(c.id)) {
                  const local = (t - c.start) + (c.sourceStart || 0);
                  try { el.currentTime = clamp(local, 0, el.duration || 9999); } catch (er) {}
                  el.play().catch(() => {});
                  activeAudios.add(c.id);
                }
                if (audioGains[c.libId]) audioGains[c.libId].gain.value = c.muted ? 0 : (c.volume ?? 1);
              } else if (activeAudios.has(c.id)) {
                try { el.pause(); } catch (er) {}
                activeAudios.delete(c.id);
              }
            });

            // Dibujar frame
            drawFrame(t);

            // Progress
            const pct = totalDur ? clamp(elapsed / totalDur, 0, 1) : 1;
            if (fillEl) fillEl.style.width = `${Math.round(pct * 100)}%`;
            this._setStatus('Exportando...', `${Math.round(pct * 100)}% — ${fmtTime(elapsed)} / ${fmtTime(totalDur)}`);

            if (elapsed >= totalDur) return resolve();
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });

        // Stop
        try { recorder.stop(); } catch (e) {}
        const blob = await recordPromise;

        if (fillEl) fillEl.style.width = '100%';
        const f0 = FORMATS[this._format] || FORMATS.tiktok;
        const filename = `LTH_editor_${f0.id}_${Date.now()}.webm`;
        downloadBlob(blob, filename);
        this._setStatus('Exportación lista.', `Archivo: ${filename}`);
      } catch (error) {
        this._setStatus('Error al exportar.', error && error.message ? error.message : String(error));
      } finally {
        // Cleanup
        try { if (recorder.state !== 'inactive') recorder.stop(); } catch (e) {}
        try { finalStream.getTracks().forEach(t => t.stop()); } catch (e) {}
        Object.values(exportEls).forEach(el => {
          try { el.pause(); el.removeAttribute('src'); el.load(); el.remove(); } catch (e) {}
        });
        try { if (audioCtx) audioCtx.close(); } catch (e) {}

        this._exporting = false;
        this._updateAll();
      }
    },

    // ---------------------------------------------------------------------
    // Guardar / cargar proyecto (metadata)
    // ---------------------------------------------------------------------
    async _saveProject() {
      try {
        const meta = this._buildProjectSnapshot();
        const json = JSON.stringify(meta, null, 2);
        const localStorageKey = projectSchema && projectSchema.LOCAL_STORAGE_KEY
          ? projectSchema.LOCAL_STORAGE_KEY
          : 'lth-editor:lastProject';
        const storageInfo = projectSchema && typeof projectSchema.resolveProjectStorage === 'function'
          ? projectSchema.resolveProjectStorage(LTH_ROOT)
          : { directory: APP_DATA_DIR, filePath: PROJECTS_FILE };
        const dir = storageInfo.directory || APP_DATA_DIR;
        const filePath = storageInfo.filePath || PROJECTS_FILE;
        let primaryPath = filePath;
        let savedToEngine = false;
        let savedToDisk = false;

        if (engineClient && typeof engineClient.saveProject === 'function') {
          try {
            const result = await engineClient.saveProject(meta);
            if (result && result.success) {
              savedToEngine = true;
              primaryPath = result.filePath || primaryPath;
            }
          } catch (error) {
            console.warn('[LTH.editor] No se pudo guardar via videoEngine:', error);
          }
        }

        if (!savedToEngine && window.electron && window.electron.fs && dir && filePath) {
          try {
            await window.electron.fs.createFolder(dir, { recursive: true });
            await window.electron.fs.writeFile(filePath, json);
            savedToDisk = true;
          } catch (e) {
            console.warn('[LTH.editor] No se pudo guardar en disco:', e);
          }
        }

        try {
          localStorage.setItem(localStorageKey, json);
        } catch (e) {}

        if (savedToEngine || savedToDisk) {
          this._setStatus('Proyecto guardado.', primaryPath);
        } else {
          this._setStatus('Proyecto guardado (localStorage).', 'Solo metadatos. Los archivos deberán reimportarse al abrir.');
        }
      } catch (error) {
        this._setStatus('Error al guardar.', error && error.message ? error.message : String(error));
      }
    },

    async _loadProjectMeta() {
      try {
        const localStorageKey = projectSchema && projectSchema.LOCAL_STORAGE_KEY
          ? projectSchema.LOCAL_STORAGE_KEY
          : 'lth-editor:lastProject';
        let project = null;

        if (engineClient && typeof engineClient.loadProject === 'function') {
          try {
            const result = await engineClient.loadProject();
            if (result && result.success && result.project) {
              project = result.project;
            }
          } catch (e) {}
        }

        if (!project && window.electron && window.electron.fs && PROJECTS_FILE) {
          try {
            const exists = await window.electron.fs.itemExists(PROJECTS_FILE);
            if (exists) {
              const result = await window.electron.fs.readFile(PROJECTS_FILE);
              const json = result && result.content ? result.content : null;
              if (json) {
                project = JSON.parse(json);
              }
            }
          } catch (e) {}
        }

        if (!project) {
          try {
            const json = localStorage.getItem(localStorageKey);
            if (json) {
              project = JSON.parse(json);
            }
          } catch (e) {}
        }

        if (!project) return null;
        if (projectSchema && typeof projectSchema.parseProjectSnapshot === 'function') {
          return projectSchema.parseProjectSnapshot(project);
        }
        return project;
      } catch (e) {
        return null;
      }
    },

    // ---------------------------------------------------------------------
    // Dispose / cleanup
    // ---------------------------------------------------------------------
    _dispose(clearRoot) {
      try { this._stopRaf(); } catch (e) {}
      try { this._stopExportPulse(); } catch (e) {}
      try { this._destroyMediaElements(); } catch (e) {}

      if (this._kbdHandler) {
        try { window.removeEventListener('keydown', this._kbdHandler); } catch (e) {}
        this._kbdHandler = null;
      }

      // Revocar blob URLs de la librería
      try {
        this._library.forEach(it => {
          if (it.src && it.src.startsWith('blob:')) {
            try { URL.revokeObjectURL(it.src); } catch (e) {}
          }
          if (it.thumb && it.thumb.startsWith('blob:')) {
            try { URL.revokeObjectURL(it.thumb); } catch (e) {}
          }
        });
      } catch (e) {}

      this._library = [];
      this._clips = [];
      this._duration = 0;
      this._currentTime = 0;
      this._playing = false;
      this._selectedClipId = null;
      this._activeVideoEl = null;
      this._activeVideoClipId = null;
      this._draggingClip = null;
      this._draggingOverlay = null;
      this._exporting = false;

      if (clearRoot && this._root) {
        try { this._root.innerHTML = ''; } catch (e) {}
      }
      this._root = null;
      this._d = null;
    }
  };

  // -------------------------------------------------------------------------
  // Registro en LTH-iOs
  // -------------------------------------------------------------------------
  window.LTH_APPS[APP_ID] = app;

  if (window.AppLoader && typeof window.AppLoader.registerApp === 'function') {
    try {
      window.AppLoader.registerApp({
        id: APP_ID,
        name: APP_NAME,
        icon: '',
        iconUrl: APP_ICON_URL,
        gradient: 'linear-gradient(135deg, rgba(103,232,249,0.85), rgba(167,139,250,0.85) 55%, rgba(248,215,117,0.85))',
        position: { x: 80, y: 80 }
      });
      console.log(`[${APP_NAME}] v${VERSION} registrado correctamente.`);
    } catch (e) {
      console.warn(`[${APP_NAME}] Error al registrar en AppLoader:`, e);
    }
  } else {
    console.log(`[${APP_NAME}] v${VERSION} cargado (sin AppLoader).`);
  }

})();
