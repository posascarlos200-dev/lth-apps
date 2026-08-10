/* =========================================================
   LTH DOCUMENT — Creador de documentos PDF profesional
   Plantillas: Factura, Cotizacion, Contrato, Carta, En blanco
   Editor enriquecido + vista previa + tablas + imagenes
   Tema: blanco + rojo · Iconos vectoriales (sin emojis)
   Version 2.0.0
   ========================================================= */

(function () {
  'use strict';

  window.LTH_APPS = window.LTH_APPS || {};
  if (window.LTH_APPS['lth-document']) return;

  // ── Helpers ──────────────────────────────────────────────
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const todayStr = () => {
    try { return new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }); }
    catch { return new Date().toISOString().slice(0, 10); }
  };
  const money = (n) => (Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ── Iconos (line icons, stroke currentColor) ─────────────
  const sv = (inner, s = 18) =>
    `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  const IC = {
    alignLeft:   sv('<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="10" x2="13" y2="10"/><line x1="4" y1="14" x2="20" y2="14"/><line x1="4" y1="18" x2="13" y2="18"/>'),
    alignCenter: sv('<line x1="4" y1="6" x2="20" y2="6"/><line x1="7" y1="10" x2="17" y2="10"/><line x1="4" y1="14" x2="20" y2="14"/><line x1="7" y1="18" x2="17" y2="18"/>'),
    alignRight:  sv('<line x1="4" y1="6" x2="20" y2="6"/><line x1="11" y1="10" x2="20" y2="10"/><line x1="4" y1="14" x2="20" y2="14"/><line x1="11" y1="18" x2="20" y2="18"/>'),
    alignJustify:sv('<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="10" x2="20" y2="10"/><line x1="4" y1="14" x2="20" y2="14"/><line x1="4" y1="18" x2="20" y2="18"/>'),
    dirLtr:      sv('<line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="16" y2="17"/><polyline points="14 14 17 17 14 20"/>'),
    dirRtl:      sv('<line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="8" y1="17" x2="20" y2="17"/><polyline points="10 14 7 17 10 20"/>'),
    listUl:      sv('<line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4.5" cy="6" r="1.4"/><circle cx="4.5" cy="12" r="1.4"/><circle cx="4.5" cy="18" r="1.4"/>'),
    listOl:      sv('<line x1="10" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="10" y1="18" x2="20" y2="18"/><path d="M4 5.2h1.2V9"/><path d="M3.5 15.4a1 1 0 1 1 1.8.6c-.2.6-1.1 1-1.8 1.8h2"/>'),
    clear:       sv('<path d="M5 7h14"/><path d="M9 7l1-2h4l1 2"/><path d="M7 7l1 12h8l1-12"/><line x1="10" y1="11" x2="14" y2="16"/><line x1="14" y1="11" x2="10" y2="16"/>'),
    image:       sv('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>'),
    table:       sv('<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>'),
    rowAdd:      sv('<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="13" x2="12" y2="18"/><line x1="9.5" y1="15.5" x2="14.5" y2="15.5"/>'),
    colAdd:      sv('<rect x="4" y="3" width="16" height="18" rx="2"/><line x1="10" y1="3" x2="10" y2="21"/><line x1="15" y1="9" x2="15" y2="15"/><line x1="12.5" y1="12" x2="17.5" y2="12"/>'),
    rowDel:      sv('<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9.5" y1="15.5" x2="14.5" y2="15.5"/>'),
    colDel:      sv('<rect x="4" y="3" width="16" height="18" rx="2"/><line x1="10" y1="3" x2="10" y2="21"/><line x1="12.5" y1="12" x2="17.5" y2="12"/>'),
    download:    sv('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
    eye:         sv('<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>'),
    edit:        sv('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
    back:        sv('<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>'),
    caret:       sv('<polyline points="6 9 12 15 18 9"/>', 14),
    file:        sv('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>', 26),
    fileText:    sv('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>', 26),
    receipt:     sv('<path d="M5 2v20l2-1.2L9 22l2-1.2L13 22l2-1.2L17 22l2-1.2V2l-2 1.2L15 2l-2 1.2L11 2 9 3.2 7 2 5 3.2z"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="13" y2="16"/>', 26),
    clipboard:   sv('<rect x="4" y="4" width="16" height="18" rx="2"/><rect x="8" y="2" width="8" height="4" rx="1"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="13" y2="15"/>', 26),
    mail:        sv('<rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22 6 12 13 2 6"/>', 26),
  };

  // Logo blanco para el icono del escritorio (sobre gradiente rojo)
  const LOGO_GRID = `
    <svg viewBox="0 0 48 48" width="40" height="40" fill="none">
      <path d="M13 5h14l8 8v28a2.5 2.5 0 0 1-2.5 2.5H13A2.5 2.5 0 0 1 10.5 41V7.5A2.5 2.5 0 0 1 13 5z" fill="#ffffff"/>
      <path d="M27 5l8 8h-6a2 2 0 0 1-2-2V5z" fill="#ffd2d5"/>
      <rect x="16" y="22" width="16" height="2.6" rx="1.3" fill="#e11d2a"/>
      <rect x="16" y="28" width="16" height="2.6" rx="1.3" fill="#e11d2a"/>
      <rect x="16" y="34" width="10" height="2.6" rx="1.3" fill="#e11d2a"/>
    </svg>`;
  // Logo rojo para la barra superior (sobre fondo blanco)
  const LOGO_MARK = `
    <svg viewBox="0 0 48 48" width="24" height="24" fill="none">
      <path d="M13 5h14l8 8v28a2.5 2.5 0 0 1-2.5 2.5H13A2.5 2.5 0 0 1 10.5 41V7.5A2.5 2.5 0 0 1 13 5z" fill="#e11d2a"/>
      <path d="M27 5l8 8h-6a2 2 0 0 1-2-2V5z" fill="#ff9aa0"/>
      <rect x="16" y="22" width="16" height="2.6" rx="1.3" fill="#fff"/>
      <rect x="16" y="28" width="16" height="2.6" rx="1.3" fill="#fff"/>
      <rect x="16" y="34" width="10" height="2.6" rx="1.3" fill="#fff"/>
    </svg>`;

  // ── Plantillas ───────────────────────────────────────────
  function tplBlank() {
    return `
      <h1 data-ph="Titulo del documento">Titulo del documento</h1>
      <p data-ph="Escribe aqui...">Empieza a escribir tu documento. Usa la barra superior para dar formato, insertar tablas, pegar imagenes y mas.</p>
    `;
  }
  function tplLetter() {
    return `
      <p style="text-align:right">${esc(todayStr())}</p>
      <p><strong>Para:</strong> Nombre del destinatario</p>
      <p><strong>Asunto:</strong> Asunto de la carta</p>
      <p>Estimado/a:</p>
      <p>Por medio de la presente me dirijo a usted con el fin de... Desarrolla aqui el cuerpo de tu carta de forma clara y profesional.</p>
      <p>Sin otro particular, quedo a sus ordenes.</p>
      <p style="margin-top:48px">Atentamente,</p>
      <p><strong>Nombre y firma</strong><br>Cargo / Empresa</p>
    `;
  }
  function tplContract() {
    return `
      <h1>CONTRATO DE PRESTACION DE SERVICIOS</h1>
      <p>En la ciudad de <strong>[Ciudad]</strong>, a ${esc(todayStr())}, celebran el presente contrato:</p>
      <p>Por una parte <strong>[Nombre del prestador]</strong>, en adelante "EL PRESTADOR", y por la otra parte <strong>[Nombre del cliente]</strong>, en adelante "EL CLIENTE", al tenor de las siguientes clausulas:</p>
      <h2>PRIMERA — Objeto</h2>
      <p>EL PRESTADOR se obliga a realizar los siguientes servicios: [describir el servicio].</p>
      <h2>SEGUNDA — Contraprestacion</h2>
      <p>EL CLIENTE pagara la cantidad de $[monto] ([cantidad con letra]) en la forma y plazos acordados.</p>
      <h2>TERCERA — Vigencia</h2>
      <p>El presente contrato tendra vigencia del [fecha inicio] al [fecha fin].</p>
      <h2>CUARTA — Obligaciones de las partes</h2>
      <p>Las partes se obligan a cumplir de buena fe lo aqui pactado.</p>
      <p style="margin-top:56px">Leido el presente y conformes con su contenido, lo firman por duplicado.</p>
      <table class="doc-signs"><tr>
        <td>_____________________________<br><strong>EL PRESTADOR</strong></td>
        <td>_____________________________<br><strong>EL CLIENTE</strong></td>
      </tr></table>
    `;
  }
  function invoiceRow(desc, qty, price) {
    return `
      <tr>
        <td data-cell="desc">${esc(desc)}</td>
        <td data-cell="qty" class="num">${esc(qty)}</td>
        <td data-cell="price" class="num">${esc(price)}</td>
        <td data-cell="amount" class="num amount" contenteditable="false">0.00</td>
        <td class="row-del" contenteditable="false" title="Eliminar fila">&times;</td>
      </tr>`;
  }
  function tplInvoice(kind) {
    const title = kind === 'quote' ? 'COTIZACION' : 'FACTURA';
    const numLabel = kind === 'quote' ? 'Cotizacion No.' : 'Factura No.';
    return `
      <div class="inv-head" contenteditable="false">
        <div class="inv-from">
          <div class="inv-logo" contenteditable="true">TU EMPRESA</div>
          <p contenteditable="true">Direccion de la empresa<br>Ciudad, CP &middot; Tel. 000-000-0000<br>correo@empresa.com &middot; RFC: XXXX000000XX0</p>
        </div>
        <div class="inv-meta">
          <h1 contenteditable="true">${title}</h1>
          <table class="inv-metatable">
            <tr><td>${numLabel}</td><td contenteditable="true">000123</td></tr>
            <tr><td>Fecha</td><td contenteditable="true">${esc(todayStr())}</td></tr>
            <tr><td>Vence</td><td contenteditable="true">—</td></tr>
          </table>
        </div>
      </div>

      <div class="inv-billto">
        <span class="inv-tag">Cliente</span>
        <p contenteditable="true"><strong>Nombre del cliente</strong><br>Direccion del cliente<br>Ciudad, CP &middot; RFC: XXXX000000XX0</p>
      </div>

      <table class="inv-items" data-inv-items>
        <thead>
          <tr><th>Descripcion</th><th class="num">Cant.</th><th class="num">P. Unitario</th><th class="num">Importe</th><th class="th-act"></th></tr>
        </thead>
        <tbody>
          ${invoiceRow('Servicio o producto', '1', '1000.00')}
          ${invoiceRow('Otro concepto', '2', '500.00')}
        </tbody>
      </table>
      <button type="button" class="inv-addrow" contenteditable="false" data-add-row>+ Agregar fila</button>

      <div class="inv-totals" contenteditable="false">
        <table>
          <tr><td>Subtotal</td><td class="num" data-tot="subtotal">0.00</td></tr>
          <tr><td>IVA (<span contenteditable="true" data-tax-rate>16</span>%)</td><td class="num" data-tot="tax">0.00</td></tr>
          <tr class="grand"><td>TOTAL</td><td class="num" data-tot="total">0.00</td></tr>
        </table>
      </div>

      <div class="inv-notes">
        <span class="inv-tag">Notas</span>
        <p contenteditable="true">Condiciones de pago, datos bancarios o cualquier nota relevante.</p>
      </div>
    `;
  }

  const TEMPLATES = {
    invoice:  { name: 'Factura',    icon: IC.receipt,   desc: 'Factura con tabla e importes automaticos', build: () => tplInvoice('invoice'), invoice: true },
    quote:    { name: 'Cotizacion', icon: IC.clipboard, desc: 'Presupuesto o cotizacion profesional',     build: () => tplInvoice('quote'),   invoice: true },
    contract: { name: 'Contrato',   icon: IC.fileText,  desc: 'Contrato de servicios con clausulas',      build: tplContract },
    letter:   { name: 'Carta',      icon: IC.mail,      desc: 'Carta formal lista para firmar',           build: tplLetter },
    blank:    { name: 'En blanco',  icon: IC.file,      desc: 'Documento libre estilo Word',              build: tplBlank },
  };

  // ── Recalculo de totales de factura ──────────────────────
  function recalcInvoice(paper) {
    const items = paper.querySelector('[data-inv-items] tbody');
    if (!items) return;
    let subtotal = 0;
    items.querySelectorAll('tr').forEach((tr) => {
      const qty = parseFloat((tr.querySelector('[data-cell="qty"]')?.textContent || '').replace(/[^\d.\-]/g, '')) || 0;
      const price = parseFloat((tr.querySelector('[data-cell="price"]')?.textContent || '').replace(/[^\d.\-]/g, '')) || 0;
      const cell = tr.querySelector('[data-cell="amount"]');
      const amount = qty * price;
      subtotal += amount;
      if (cell) cell.textContent = money(amount);
    });
    const rate = parseFloat((paper.querySelector('[data-tax-rate]')?.textContent || '').replace(/[^\d.\-]/g, '')) || 0;
    const tax = subtotal * (rate / 100);
    const set = (k, v) => { const el = paper.querySelector(`[data-tot="${k}"]`); if (el) el.textContent = money(v); };
    set('subtotal', subtotal); set('tax', tax); set('total', subtotal + tax);
  }

  // ── CSS ──────────────────────────────────────────────────
  const CSS = `
  .lthd-root{
    --red:#e11d2a; --red-d:#b3121d; --red-l:#ff4d59; --red-soft:#fdeaeb;
    --ink:#1b1f24; --muted:#6b7280; --line:#e7e9ee; --paper:#ffffff;
    height:100%; display:flex; flex-direction:column; overflow:hidden;
    background:#f3f4f8; color:var(--ink);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif;
  }
  .lthd-root *{ box-sizing:border-box; }

  .lthd-top{
    display:flex; align-items:center; gap:12px; padding:10px 16px;
    background:linear-gradient(135deg,var(--red),var(--red-d));
    color:#fff; box-shadow:0 4px 18px rgba(225,29,42,.28); flex-shrink:0; z-index:6;
  }
  .lthd-brand{ display:flex; align-items:center; gap:11px; font-weight:800; letter-spacing:.01em; }
  .lthd-brand .dot{ width:36px;height:36px;border-radius:11px;background:#fff;
    display:grid;place-items:center;box-shadow:0 3px 10px rgba(0,0,0,.20); }
  .lthd-brand .ttl{ line-height:1.1; }
  .lthd-brand small{ display:block; font-weight:600; font-size:11px; opacity:.85; margin-top:2px; }
  .lthd-top .spacer{ flex:1; }
  .lthd-btn{
    border:0; cursor:pointer; font-weight:700; font-size:13px; border-radius:10px;
    padding:9px 14px; display:inline-flex; align-items:center; gap:7px; transition:.15s;
  }
  .lthd-btn svg{ width:17px;height:17px; }
  .lthd-btn.ghost{ background:rgba(255,255,255,.16); color:#fff; }
  .lthd-btn.ghost:hover{ background:rgba(255,255,255,.28); }
  .lthd-btn.solid{ background:#fff; color:var(--red); box-shadow:0 3px 10px rgba(0,0,0,.18); }
  .lthd-btn.solid:hover{ transform:translateY(-1px); }
  .lthd-btn[disabled]{ opacity:.6; cursor:default; transform:none; }

  /* Toolbar */
  .lthd-toolbar{
    display:flex; flex-wrap:wrap; align-items:center; gap:6px; padding:8px 14px;
    background:#fff; border-bottom:1px solid var(--line); flex-shrink:0; position:relative; z-index:5;
  }
  .lthd-toolbar .grp{ display:flex; gap:3px; align-items:center; padding:0 9px; border-right:1px solid var(--line); }
  .lthd-toolbar .grp:first-child{ padding-left:0; }
  .lthd-toolbar .grp:last-child{ border-right:0; padding-right:0; }
  .tb-b{ width:34px;height:34px;border:1px solid transparent;background:transparent;border-radius:8px;
    cursor:pointer;color:var(--ink);display:grid;place-items:center;transition:.12s;font-size:14px;font-weight:700; }
  .tb-b svg{ display:block; width:18px; height:18px; }
  .tb-b:hover{ background:var(--red-soft); color:var(--red); }
  .tb-b.on{ background:var(--red); color:#fff; border-color:var(--red); }
  .tb-sel{ height:34px;border:1px solid var(--line);border-radius:8px;background:#fff;
    padding:0 8px;font-size:13px;color:var(--ink);cursor:pointer; }
  .tb-color{ width:34px;height:34px;border:1px solid var(--line);border-radius:8px;padding:3px;cursor:pointer;background:#fff; }
  .tb-dd{ position:relative; }
  .tb-dd .tb-b{ width:auto; padding:0 8px; gap:3px; }
  .tb-menu{ position:absolute; top:40px; left:0; background:#fff; border:1px solid var(--line);
    border-radius:12px; box-shadow:0 14px 40px rgba(20,20,40,.18); padding:6px; min-width:188px; z-index:20; }
  .tb-menu[hidden]{ display:none; }
  .tb-menu button{ display:flex; align-items:center; gap:10px; width:100%; border:0; background:transparent;
    padding:9px 10px; border-radius:8px; cursor:pointer; font-size:13px; color:var(--ink); text-align:left; }
  .tb-menu button svg{ width:17px;height:17px;color:var(--muted); flex-shrink:0; }
  .tb-menu button:hover{ background:var(--red-soft); color:var(--red); }
  .tb-menu button:hover svg{ color:var(--red); }
  .tb-menu .sep{ height:1px; background:var(--line); margin:5px 4px; }

  /* Layout: el contenedor de vista debe poder encoger para que el stage scrollee */
  .lthd-root > [data-view]{ flex:1 1 auto; min-height:0; display:flex; flex-direction:column; overflow:hidden; }

  /* Stage / paper */
  .lthd-stage{ flex:1 1 auto; min-height:0; overflow-y:auto; overflow-x:auto; padding:28px 16px 64px; }
  .doc-paper{
    width:210mm; max-width:100%; min-height:297mm; margin:0 auto;
    background:var(--paper); color:#222; padding:22mm 20mm;
    box-shadow:0 10px 40px rgba(20,20,40,.18); border-radius:2px;
    font-size:14px; line-height:1.6; outline:none;
  }
  .doc-paper:focus-within{ box-shadow:0 12px 48px rgba(225,29,42,.18); }
  .doc-paper h1{ font-size:26px; margin:0 0 10px; color:#16181d; }
  .doc-paper h2{ font-size:17px; margin:20px 0 6px; color:var(--red-d); }
  .doc-paper h3{ font-size:15px; margin:16px 0 5px; }
  .doc-paper p{ margin:0 0 11px; }
  .doc-paper [contenteditable]:empty:before{ content:attr(data-ph); color:#b8bcc4; }
  .doc-img{ max-width:100%; height:auto; border-radius:6px; margin:6px 0; }
  table.doc-table{ width:100%; border-collapse:collapse; margin:14px 0; font-size:13px; table-layout:fixed; }
  table.doc-table td, table.doc-table th{ border:1px solid #cfd3da; padding:7px 9px; vertical-align:top;
    word-break:break-word; overflow-wrap:anywhere; min-width:40px; }
  table.doc-table th{ background:var(--red-soft); color:var(--red-d); font-weight:700; }
  .doc-paper > p, .doc-paper > h1, .doc-paper > h2, .doc-paper > h3{ overflow-wrap:anywhere; }
  table.doc-signs{ width:100%; margin-top:40px; }
  table.doc-signs td{ text-align:center; padding:8px 18px; width:50%; vertical-align:top; }

  /* Invoice */
  .inv-head{ display:flex; justify-content:space-between; gap:20px; border-bottom:3px solid var(--red); padding-bottom:14px; }
  .inv-logo{ font-size:22px; font-weight:800; color:var(--red); }
  .inv-from p{ font-size:12px; color:#555; margin-top:6px; }
  .inv-meta{ text-align:right; min-width:200px; }
  .inv-meta h1{ color:var(--red); font-size:30px; letter-spacing:.06em; margin:0 0 8px; }
  .inv-metatable{ margin-left:auto; font-size:12px; }
  .inv-metatable td{ padding:2px 0; }
  .inv-metatable td:first-child{ color:#888; padding-right:14px; text-align:right; }
  .inv-metatable td:last-child{ font-weight:700; text-align:right; }
  .inv-billto, .inv-notes{ margin-top:18px; }
  .inv-tag{ display:inline-block; font-size:11px; font-weight:800; letter-spacing:.08em;
    color:var(--red); background:var(--red-soft); padding:3px 9px; border-radius:6px; }
  .inv-billto p, .inv-notes p{ font-size:13px; margin-top:6px; }
  table.inv-items{ width:100%; border-collapse:collapse; margin-top:18px; font-size:13px; }
  table.inv-items th{ background:var(--red); color:#fff; padding:9px 10px; text-align:left; font-weight:700; }
  table.inv-items th.num, table.inv-items td.num{ text-align:right; }
  table.inv-items th.th-act{ width:26px; }
  table.inv-items td{ padding:9px 10px; border-bottom:1px solid var(--line); vertical-align:top; }
  table.inv-items tr:nth-child(even) td{ background:#fafafb; }
  td.amount{ font-weight:700; }
  td.row-del{ width:26px; text-align:center; color:#cbd0d8; cursor:pointer; user-select:none; font-weight:700; }
  td.row-del:hover{ color:var(--red); }
  .inv-addrow{ margin-top:8px; background:var(--red-soft); color:var(--red); border:1px dashed var(--red-l);
    border-radius:8px; padding:7px 12px; font-weight:700; cursor:pointer; font-size:12px; }
  .inv-totals{ display:flex; justify-content:flex-end; margin-top:14px; }
  .inv-totals table{ min-width:260px; font-size:13px; }
  .inv-totals td{ padding:5px 4px; }
  .inv-totals td:last-child{ text-align:right; font-weight:700; }
  .inv-totals tr.grand td{ border-top:2px solid var(--red); font-size:16px; color:var(--red); padding-top:8px; }

  /* Preview mode */
  .lthd-root.preview .lthd-toolbar{ display:none; }
  .lthd-root.preview .row-del, .lthd-root.preview .th-act, .lthd-root.preview .inv-addrow{ display:none !important; }
  .lthd-root.preview .doc-paper{ cursor:default; }
  .lthd-root.preview .doc-paper [contenteditable]:empty:before{ content:""; }

  /* Picker */
  .lthd-picker{ flex:1 1 auto; min-height:0; overflow:auto; padding:34px 24px 64px; }
  .lthd-picker h2{ text-align:center; font-size:24px; margin:6px 0 4px; }
  .lthd-picker .sub{ text-align:center; color:var(--muted); margin:0 0 28px; }
  .tpl-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); gap:18px; max-width:880px; margin:0 auto; }
  .tpl-card{ background:#fff; border:1px solid var(--line); border-radius:16px; padding:22px 18px;
    cursor:pointer; transition:.18s; text-align:left; position:relative; overflow:hidden; }
  .tpl-card:before{ content:""; position:absolute; inset:0 auto 0 0; width:4px; background:var(--red); transform:scaleY(0); transition:.18s; transform-origin:top; }
  .tpl-card:hover{ transform:translateY(-3px); box-shadow:0 14px 36px rgba(225,29,42,.16); border-color:var(--red-l); }
  .tpl-card:hover:before{ transform:scaleY(1); }
  .tpl-card .ic{ width:52px;height:52px;border-radius:14px;background:var(--red-soft);color:var(--red);
    display:grid;place-items:center; }
  .tpl-card h3{ margin:14px 0 4px; font-size:17px; }
  .tpl-card p{ margin:0; font-size:12.5px; color:var(--muted); line-height:1.45; }

  @media (max-width:760px){ .doc-paper{ padding:16mm 12mm; } .inv-head{ flex-direction:column; } .inv-meta{ text-align:left; } .inv-metatable{ margin-left:0; } }
  `;

  // ── App ──────────────────────────────────────────────────
  window.LTH_APPS['lth-document'] = {
    name: 'LTH Document',
    icon: LOGO_GRID,
    gradient: 'linear-gradient(135deg,#e11d2a,#b3121d)',
    version: '2.0.0',

    render(container) {
      container.innerHTML = '';
      container.style.cssText = 'height:100%;display:flex;flex-direction:column;overflow:hidden;';

      const root = document.createElement('div');
      root.className = 'lthd-root';
      root.innerHTML = `
        <style>${CSS}</style>
        <div class="lthd-top">
          <div class="lthd-brand">
            <span class="dot">${LOGO_MARK}</span>
            <span class="ttl">LTH Document<small data-doc-sub>Crea PDF profesionales</small></span>
          </div>
          <div class="spacer"></div>
          <button class="lthd-btn ghost" data-act="home" style="display:none">${IC.back}<span>Plantillas</span></button>
          <button class="lthd-btn ghost" data-act="preview" style="display:none">${IC.eye}<span>Vista previa</span></button>
          <button class="lthd-btn solid" data-act="export" style="display:none">${IC.download}<span>Exportar PDF</span></button>
        </div>
        <div data-view></div>
        <input type="file" accept="image/*" data-img-input hidden>
      `;
      container.appendChild(root);

      // La interfaz esta montada pero la app todavia no funciona. Sin aviso
      // parece terminada y el usuario cree que esta rota.
      window.LTHConstruccion?.marcar(container, {
        app: 'LTH Document',
        nota: 'Ahora mismo es solo la parte visual: puedes escribir y probar la barra de herramientas, pero todavia no guarda ni exporta.'
      });

      const view = root.querySelector('[data-view]');
      const sub = root.querySelector('[data-doc-sub]');
      const btnHome = root.querySelector('[data-act="home"]');
      const btnPrev = root.querySelector('[data-act="preview"]');
      const btnExport = root.querySelector('[data-act="export"]');
      const imgInput = root.querySelector('[data-img-input]');

      let currentKey = null;
      let previewing = false;
      let savedRange = null; // ultima seleccion valida dentro de la hoja

      // ── Utilidades de seleccion ─────────────────────────
      const paperEl = () => view.querySelector('[data-paper]');
      const rememberRange = () => {
        const paper = paperEl();
        const sel = window.getSelection();
        if (paper && sel && sel.rangeCount) {
          const r = sel.getRangeAt(0);
          if (paper.contains(r.commonAncestorContainer)) savedRange = r.cloneRange();
        }
      };
      // Devuelve un rango usable dentro de la hoja (vivo > guardado > final)
      const activeRange = (paper) => {
        const sel = window.getSelection();
        if (sel && sel.rangeCount) {
          const r = sel.getRangeAt(0);
          if (paper.contains(r.commonAncestorContainer)) return r;
        }
        if (savedRange && paper.contains(savedRange.commonAncestorContainer)) return savedRange.cloneRange();
        const end = document.createRange();
        end.selectNodeContents(paper); end.collapse(false);
        return end;
      };
      // Celda (td/th) que contiene el cursor actual
      const currentCell = (paper) => {
        const r = activeRange(paper);
        let node = r.startContainer;
        while (node && node !== paper) {
          if (node.nodeType === 1 && (node.tagName === 'TD' || node.tagName === 'TH')) return node;
          node = node.parentNode;
        }
        return null;
      };
      // Hijo directo de la hoja que contiene a 'node' (para insertar bloques en el flujo)
      const topBlock = (paper, node) => {
        if (!node || node === paper || !paper.contains(node)) return null;
        while (node && node.parentNode && node.parentNode !== paper) node = node.parentNode;
        return (node && node.parentNode === paper) ? node : null;
      };
      const setCaret = (node, atStart) => {
        const sel = window.getSelection();
        const r = document.createRange();
        if (atStart) { r.setStart(node, 0); } else { r.setStartAfter(node); }
        r.collapse(true);
        sel.removeAllRanges(); sel.addRange(r);
        savedRange = r.cloneRange();
      };

      const BLOCK_TAGS = ['P', 'H1', 'H2', 'H3', 'H4', 'LI', 'TD', 'TH', 'DIV', 'BLOCKQUOTE', 'PRE'];
      // Bloque (parrafo/celda) que contiene el cursor
      const blockAt = (paper) => {
        let node = activeRange(paper).startContainer;
        if (node.nodeType === 3) node = node.parentNode;
        while (node && node !== paper) {
          if (node.nodeType === 1 && BLOCK_TAGS.includes(node.tagName)) return node;
          node = node.parentNode;
        }
        return null;
      };
      // Bloques que toca la seleccion (para aplicar direccion a varios parrafos)
      const selectedBlocks = (paper) => {
        const sel = window.getSelection();
        if (sel && sel.rangeCount) {
          const range = sel.getRangeAt(0);
          const all = Array.from(paper.querySelectorAll(BLOCK_TAGS.join(',')))
            .filter((el) => range.intersectsNode(el));
          const leaves = all.filter((el) => !all.some((o) => o !== el && el.contains(o)));
          if (leaves.length) return leaves;
        }
        const b = blockAt(paper);
        return b ? [b] : [];
      };
      // Direccion de texto LTR / RTL sobre el/los parrafos seleccionados
      const applyDir = (paper, dir) => {
        const blocks = selectedBlocks(paper);
        if (!blocks.length) return;
        blocks.forEach((b) => {
          b.setAttribute('dir', dir);
          b.style.textAlign = ''; // que la alineacion siga el inicio segun la direccion
        });
      };
      // Resalta los botones activos segun el estado del cursor
      const updateToolbar = () => {
        const paper = paperEl();
        if (!paper) return;
        view.querySelectorAll('.tb-b[data-cmd]').forEach((b) => {
          let on = false;
          try { on = document.queryCommandState(b.dataset.cmd); } catch (_) {}
          b.classList.toggle('on', !!on);
        });
        const block = blockAt(paper);
        let dir = 'ltr';
        if (block) dir = (block.getAttribute('dir') || getComputedStyle(block).direction || 'ltr');
        view.querySelectorAll('.tb-b[data-dir]').forEach((b) => b.classList.toggle('on', b.dataset.dir === dir));
      };

      // ── Picker ──────────────────────────────────────────
      const showPicker = () => {
        currentKey = null; previewing = false; root.classList.remove('preview');
        btnHome.style.display = 'none';
        btnPrev.style.display = 'none';
        btnExport.style.display = 'none';
        sub.textContent = 'Crea PDF profesionales';
        const cards = Object.entries(TEMPLATES).map(([key, t]) => `
          <button class="tpl-card" data-tpl="${key}">
            <div class="ic">${t.icon}</div>
            <h3>${esc(t.name)}</h3>
            <p>${esc(t.desc)}</p>
          </button>`).join('');
        view.innerHTML = `
          <div class="lthd-picker">
            <h2>¿Qué quieres crear hoy?</h2>
            <p class="sub">Elige una plantilla, edítala a tu gusto y expórtala a PDF.</p>
            <div class="tpl-grid">${cards}</div>
          </div>`;
        view.querySelectorAll('[data-tpl]').forEach((c) =>
          c.addEventListener('click', () => openEditor(c.dataset.tpl)));
      };

      // ── Toolbar ─────────────────────────────────────────
      const toolbarHtml = () => `
        <div class="lthd-toolbar">
          <div class="grp">
            <select class="tb-sel" data-cmd="formatBlock" title="Estilo de texto">
              <option value="p">Texto</option>
              <option value="h1">Título 1</option>
              <option value="h2">Título 2</option>
              <option value="h3">Título 3</option>
            </select>
            <select class="tb-sel" data-cmd="fontSize" title="Tamaño">
              <option value="">Tamaño</option>
              <option value="2">Pequeño</option>
              <option value="3">Normal</option>
              <option value="5">Grande</option>
              <option value="6">Enorme</option>
            </select>
          </div>
          <div class="grp">
            <button class="tb-b" data-cmd="bold" title="Negrita"><b>B</b></button>
            <button class="tb-b" data-cmd="italic" title="Cursiva"><i>I</i></button>
            <button class="tb-b" data-cmd="underline" title="Subrayado"><u>U</u></button>
            <button class="tb-b" data-cmd="strikeThrough" title="Tachado"><s>S</s></button>
            <input type="color" class="tb-color" data-cmd="foreColor" value="#e11d2a" title="Color de texto">
          </div>
          <div class="grp">
            <button class="tb-b" data-cmd="justifyLeft" title="Alinear a la izquierda">${IC.alignLeft}</button>
            <button class="tb-b" data-cmd="justifyCenter" title="Alinear al centro">${IC.alignCenter}</button>
            <button class="tb-b" data-cmd="justifyRight" title="Alinear a la derecha">${IC.alignRight}</button>
            <button class="tb-b" data-cmd="justifyFull" title="Justificar">${IC.alignJustify}</button>
          </div>
          <div class="grp">
            <button class="tb-b" data-dir="ltr" title="Texto de izquierda a derecha (LTR)">${IC.dirLtr}</button>
            <button class="tb-b" data-dir="rtl" title="Texto de derecha a izquierda (RTL)">${IC.dirRtl}</button>
          </div>
          <div class="grp">
            <button class="tb-b" data-cmd="insertUnorderedList" title="Lista con viñetas">${IC.listUl}</button>
            <button class="tb-b" data-cmd="insertOrderedList" title="Lista numerada">${IC.listOl}</button>
            <button class="tb-b" data-cmd="removeFormat" title="Limpiar formato">${IC.clear}</button>
          </div>
          <div class="grp">
            <button class="tb-b" data-img-btn title="Insertar imagen">${IC.image}</button>
            <div class="tb-dd">
              <button class="tb-b" data-dd-toggle title="Herramientas de tabla">${IC.table}${IC.caret}</button>
              <div class="tb-menu" hidden>
                <button data-tblcmd="insertTable">${IC.table}<span>Insertar tabla</span></button>
                <div class="sep"></div>
                <button data-tblcmd="addRow">${IC.rowAdd}<span>Agregar fila</span></button>
                <button data-tblcmd="addCol">${IC.colAdd}<span>Agregar columna</span></button>
                <div class="sep"></div>
                <button data-tblcmd="delRow">${IC.rowDel}<span>Eliminar fila</span></button>
                <button data-tblcmd="delCol">${IC.colDel}<span>Eliminar columna</span></button>
              </div>
            </div>
          </div>
        </div>`;

      // ── Editor ──────────────────────────────────────────
      const openEditor = (key) => {
        const tpl = TEMPLATES[key];
        if (!tpl) return;
        currentKey = key; previewing = false; root.classList.remove('preview');
        btnHome.style.display = '';
        btnPrev.style.display = '';
        btnExport.style.display = '';
        btnPrev.innerHTML = `${IC.eye}<span>Vista previa</span>`;
        sub.textContent = tpl.name;

        view.innerHTML = `
          ${toolbarHtml()}
          <div class="lthd-stage">
            <div class="doc-paper" contenteditable="true" data-paper>${tpl.build()}</div>
          </div>`;

        const paper = view.querySelector('[data-paper]');

        // Recordar la seleccion del usuario + refrescar estado de botones
        ['keyup', 'mouseup', 'input', 'focus'].forEach((ev) =>
          paper.addEventListener(ev, () => { rememberRange(); updateToolbar(); }));

        // Comandos simples (negrita, alineacion, listas...)
        view.querySelectorAll('.tb-b[data-cmd]').forEach((b) => {
          b.addEventListener('mousedown', (e) => e.preventDefault());
          b.addEventListener('click', () => { document.execCommand(b.dataset.cmd, false, null); paper.focus(); updateToolbar(); });
        });

        // Direccion del texto LTR / RTL
        view.querySelectorAll('.tb-b[data-dir]').forEach((b) => {
          b.addEventListener('mousedown', (e) => e.preventDefault());
          b.addEventListener('click', () => { applyDir(paper, b.dataset.dir); paper.focus(); updateToolbar(); });
        });
        view.querySelectorAll('select.tb-sel[data-cmd]').forEach((sel) => {
          sel.addEventListener('change', () => { if (sel.value) document.execCommand(sel.dataset.cmd, false, sel.value); paper.focus(); });
        });
        const colorInput = view.querySelector('.tb-color[data-cmd]');
        colorInput?.addEventListener('input', () => { document.execCommand('foreColor', false, colorInput.value); paper.focus(); });

        // Imagen
        view.querySelector('[data-img-btn]')?.addEventListener('mousedown', (e) => e.preventDefault());
        view.querySelector('[data-img-btn]')?.addEventListener('click', () => imgInput.click());

        // Menu de tabla
        const dd = view.querySelector('.tb-dd');
        const ddBtn = dd.querySelector('[data-dd-toggle]');
        const ddMenu = dd.querySelector('.tb-menu');
        ddBtn.addEventListener('mousedown', (e) => e.preventDefault());
        ddBtn.addEventListener('click', () => { ddMenu.hidden = !ddMenu.hidden; });
        document.addEventListener('mousedown', (e) => { if (!dd.contains(e.target)) ddMenu.hidden = true; }, { signal: window._appSignal });
        ddMenu.querySelectorAll('[data-tblcmd]').forEach((b) => {
          b.addEventListener('mousedown', (e) => e.preventDefault());
          b.addEventListener('click', () => { runTableCmd(paper, b.dataset.tblcmd); ddMenu.hidden = true; paper.focus(); if (tpl.invoice) recalcInvoice(paper); });
        });

        // Pegar / soltar imagenes
        paper.addEventListener('paste', (e) => handlePaste(e, paper));
        paper.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
        paper.addEventListener('drop', (e) => handleDrop(e, paper));

        // Factura: totales en vivo + filas
        if (tpl.invoice) {
          recalcInvoice(paper);
          paper.addEventListener('input', () => recalcInvoice(paper));
          paper.addEventListener('click', (e) => {
            const del = e.target.closest('.row-del');
            if (del) {
              const rows = paper.querySelectorAll('[data-inv-items] tbody tr');
              if (rows.length > 1) del.closest('tr').remove();
              recalcInvoice(paper); return;
            }
            if (e.target.closest('[data-add-row]')) {
              paper.querySelector('[data-inv-items] tbody')
                .insertAdjacentHTML('beforeend', invoiceRow('Nuevo concepto', '1', '0.00'));
              recalcInvoice(paper);
            }
          });
        }

        paper.focus();
        updateToolbar();
      };

      // ── Comandos de tabla ───────────────────────────────
      function runTableCmd(paper, cmd) {
        if (cmd === 'insertTable') {
          const rows = 3, cols = 3;
          let html = '<table class="doc-table"><thead><tr>';
          for (let c = 0; c < cols; c++) html += `<th>Columna ${c + 1}</th>`;
          html += '</tr></thead><tbody>';
          for (let r = 0; r < rows; r++) { html += '<tr>'; for (let c = 0; c < cols; c++) html += '<td><br></td>'; html += '</tr>'; }
          html += '</tbody></table>';

          // Insertar como bloque en el flujo, justo despues del bloque actual.
          // Esto evita que execCommand encime tablas o las meta dentro de un <p>.
          const range = activeRange(paper);
          const tmp = document.createElement('div');
          tmp.innerHTML = html + '<p><br></p>';
          const nodes = Array.from(tmp.childNodes);
          const tableNode = nodes[0];
          const trailing = nodes[nodes.length - 1];
          const frag = document.createDocumentFragment();
          nodes.forEach((n) => frag.appendChild(n));

          const ref = topBlock(paper, range.startContainer);
          if (ref) {
            ref.after(frag);
          } else {
            paper.appendChild(frag);
          }
          // Cursor en el parrafo que queda debajo de la tabla, listo para seguir
          setCaret(trailing, true);
          tableNode.scrollIntoView({ block: 'nearest' });
          return;
        }
        const cell = currentCell(paper);
        if (!cell) { alert('Coloca el cursor dentro de una celda de tabla.'); return; }
        const tableEl = cell.closest('table');
        const row = cell.parentElement;
        const idx = cell.cellIndex;

        if (cmd === 'addRow') {
          const isInv = tableEl.matches('[data-inv-items]');
          const newRow = row.cloneNode(true);
          newRow.querySelectorAll('td, th').forEach((td) => {
            if (td.classList.contains('row-del')) return;
            if (td.dataset.cell === 'amount') { td.textContent = '0.00'; return; }
            td.innerHTML = '<br>';
          });
          row.after(newRow);
          if (isInv) recalcInvoice(paper);
        } else if (cmd === 'delRow') {
          const section = row.parentElement;
          if (section.tagName === 'THEAD') { alert('No se puede eliminar la fila de encabezado.'); return; }
          if (section.children.length > 1) row.remove();
        } else if (cmd === 'addCol') {
          Array.from(tableEl.rows).forEach((tr) => {
            const ref = tr.cells[idx] || null;
            const isHead = tr.parentElement.tagName === 'THEAD' || tr.cells[idx]?.tagName === 'TH';
            const nc = document.createElement(isHead ? 'th' : 'td');
            nc.innerHTML = isHead ? 'Columna' : '<br>';
            tr.insertBefore(nc, ref ? ref.nextSibling : null);
          });
        } else if (cmd === 'delCol') {
          Array.from(tableEl.rows).forEach((tr) => { if (tr.cells[idx]) tr.deleteCell(idx); });
        }
      }

      // ── Imagenes ────────────────────────────────────────
      function insertImage(dataUrl) {
        const paper = view.querySelector('[data-paper]');
        if (!paper) return;
        const range = activeRange(paper);
        range.collapse(false);
        const img = document.createElement('img');
        img.className = 'doc-img';
        img.src = dataUrl;
        img.alt = 'imagen';
        range.insertNode(img);
        setCaret(img, false); // cursor justo despues de la imagen
        img.scrollIntoView({ block: 'nearest' });
      }
      function fileToImage(file) {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = () => insertImage(reader.result);
        reader.readAsDataURL(file);
      }
      function handlePaste(e, paper) {
        const items = e.clipboardData?.items || [];
        for (const it of items) {
          if (it.type && it.type.startsWith('image/')) { e.preventDefault(); fileToImage(it.getAsFile()); return; }
        }
        // texto normal: dejar el comportamiento por defecto (pegado enriquecido)
      }
      function handleDrop(e, paper) {
        const files = e.dataTransfer?.files;
        if (files && files.length) { e.preventDefault(); Array.from(files).forEach(fileToImage); }
      }
      imgInput.addEventListener('change', () => { Array.from(imgInput.files || []).forEach(fileToImage); imgInput.value = ''; });

      // ── Vista previa ────────────────────────────────────
      const togglePreview = () => {
        const paper = view.querySelector('[data-paper]');
        if (!paper) return;
        previewing = !previewing;
        root.classList.toggle('preview', previewing);
        // bloquear/permitir edicion respetando que solo se restaure lo que era editable
        if (previewing) {
          const list = [paper, ...paper.querySelectorAll('[contenteditable="true"]')];
          list.forEach((el) => { el.dataset.wasCe = '1'; el.setAttribute('contenteditable', 'false'); });
        } else {
          paper.querySelectorAll('[data-was-ce="1"]').forEach((el) => {
            el.setAttribute('contenteditable', 'true'); delete el.dataset.wasCe;
          });
          if (paper.dataset.wasCe === '1') { paper.setAttribute('contenteditable', 'true'); delete paper.dataset.wasCe; }
        }
        btnPrev.innerHTML = previewing ? `${IC.edit}<span>Editar</span>` : `${IC.eye}<span>Vista previa</span>`;
        if (!previewing) paper.focus();
      };

      // ── Exportar PDF ────────────────────────────────────
      const exportPdf = async () => {
        const paper = view.querySelector('[data-paper]');
        if (!paper) return;
        const tpl = TEMPLATES[currentKey];
        if (tpl?.invoice) recalcInvoice(paper);

        const clone = paper.cloneNode(true);
        clone.querySelectorAll('[data-add-row], .row-del, .th-act').forEach((el) => el.remove());
        clone.querySelectorAll('[contenteditable]').forEach((el) => el.removeAttribute('contenteditable'));

        const fname = `${(tpl?.name || 'documento').toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.pdf`;
        const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
          <style>${CSS}
            body{ margin:0; background:#fff; }
            .doc-paper{ box-shadow:none !important; border-radius:0; width:auto; min-height:auto; margin:0; }
            .inv-addrow, .row-del, .th-act{ display:none !important; }
          </style></head>
          <body><div class="lthd-root" style="height:auto;background:#fff;">
            <div class="doc-paper">${clone.innerHTML}</div>
          </div></body></html>`;

        const original = btnExport.innerHTML;
        btnExport.innerHTML = '<span>Generando…</span>';
        btnExport.disabled = true;
        try {
          const api = window.electron?.ai?.exportChatPdf;
          if (!api) { alert('La exportación a PDF no está disponible en este entorno.'); return; }
          const res = await api({ html, defaultPath: fname });
          if (res?.success) {
            btnExport.innerHTML = `${IC.download}<span>PDF guardado</span>`;
            setTimeout(() => { btnExport.innerHTML = original; }, 1800);
          } else {
            btnExport.innerHTML = original;
            if (res && res.error) alert('No se pudo exportar: ' + res.error);
          }
        } catch (err) {
          btnExport.innerHTML = original;
          alert('Error al exportar: ' + (err?.message || err));
        } finally {
          btnExport.disabled = false;
        }
      };

      btnHome.addEventListener('click', showPicker);
      btnPrev.addEventListener('click', togglePreview);
      btnExport.addEventListener('click', exportPdf);

      showPicker();
    },

    onClose() {}
  };
})();
