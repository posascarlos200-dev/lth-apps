(function () {
  'use strict';

  window.LTH_APPS = window.LTH_APPS || {};
  if (window.LTH_APPS['lth-prueba']) return;

  const LOGO = `
    <svg viewBox="0 0 128 128" role="img" aria-label="Logo LTH" fill="none">
      <rect x="4" y="4" width="120" height="120" rx="30" fill="#ffffff" stroke="#19cfff" stroke-width="4"/>
      <path d="M35 45h58l8 13v37a9 9 0 0 1-9 9H36a9 9 0 0 1-9-9V58l8-13Z" fill="#0bb5ef"/>
      <path d="M43 45v-8c0-12 9-21 21-21s21 9 21 21v8" stroke="#08b8f5" stroke-width="8" stroke-linecap="round"/>
      <path d="M27 58h74" stroke="#8beaff" stroke-width="3"/>
      <path d="M58 59h14v37H58z" fill="#ffffff" opacity=".95"/>
      <path d="m58 59 14 14v23H58z" fill="#d8f8ff"/>
      <path d="m61 76 9-9 9 9-9 9-9-9Z" fill="#07a8e8"/>
    </svg>`;

  const CSS = `
    :host, .lth-prueba { height: 100%; }
    .lth-prueba { box-sizing: border-box; overflow: auto; padding: 34px; color: #0d376d; font-family: ui-sans-serif, system-ui, sans-serif; background: linear-gradient(145deg,#ffffff 0%,#effcff 48%,#d9f7ff 100%); }
    .lth-prueba * { box-sizing: border-box; }
    .lth-prueba-card { max-width: 720px; margin: 0 auto; padding: 34px; border: 1px solid rgba(0,189,239,.35); border-radius: 26px; background: rgba(255,255,255,.84); box-shadow: 0 22px 55px rgba(0,137,199,.16), inset 0 1px 0 #fff; text-align: center; }
    .lth-prueba-logo { width: 92px; height: 92px; margin: 0 auto 18px; filter: drop-shadow(0 12px 18px rgba(0,174,239,.24)); }
    .lth-prueba-logo svg { width: 100%; height: 100%; display: block; }
    h1 { margin: 0; font-size: 28px; color: #0a3671; }
    p { margin: 10px auto 0; max-width: 520px; color: #55779c; line-height: 1.55; }
    .lth-prueba-ok { display: inline-flex; align-items: center; gap: 8px; margin-top: 24px; padding: 10px 14px; border-radius: 999px; background: rgba(0,191,145,.12); color: #007d65; font-size: 13px; font-weight: 800; }
    .lth-prueba-dot { width: 9px; height: 9px; border-radius: 50%; background: #00bd91; box-shadow: 0 0 12px rgba(0,189,145,.7); }
    .lth-prueba-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 24px; text-align: left; }
    .lth-prueba-meta div { padding: 12px; border: 1px solid rgba(0,157,224,.14); border-radius: 12px; background: rgba(233,249,255,.7); }
    .lth-prueba-meta small { display: block; margin-bottom: 4px; color: #6a8cab; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; }
    .lth-prueba-meta strong { color: #0d3b72; font-size: 13px; }
    @media (max-width: 600px) { .lth-prueba { padding: 16px; } .lth-prueba-card { padding: 24px 18px; } }
  `;

  const APP_VERSION = '1.0.2';

  window.LTH_APPS['lth-prueba'] = {
    name: 'LTH Prueba',
    version: APP_VERSION,
    icon: LOGO,
    gradient: 'linear-gradient(135deg,#007edb,#00c9f3)',

    render(container) {
      container.innerHTML = `
        <style>${CSS}</style>
        <main class="lth-prueba">
          <section class="lth-prueba-card">
            <div class="lth-prueba-logo">${LOGO}</div>
            <h1>LTH Prueba</h1>
            <p>Actualizacion descargada desde LTH Store. Esta version confirma el flujo de actualizacion y conserva el logo.</p>
            <div class="lth-prueba-ok"><span class="lth-prueba-dot"></span>Actualizada correctamente</div>
            <div class="lth-prueba-meta">
              <div><small>Version</small><strong>${APP_VERSION}</strong></div>
              <div><small>Origen</small><strong>Catalogo firmado</strong></div>
            </div>
          </section>
        </main>`;
    },

    onClose() {}
  };
})();
