(function () {
  const iconUrl = '../assets/lth-remote.png';

  const icon = `
    <svg viewBox="0 0 64 64" width="42" height="42" fill="none" aria-hidden="true">
      <rect x="15" y="7" width="34" height="50" rx="10" fill="rgba(8,13,24,.96)" stroke="rgba(255,255,255,.72)" stroke-width="2"/>
      <rect x="20" y="14" width="24" height="34" rx="4" fill="url(#lthrPhone)"/>
      <path d="M26 30h12M31 25l5 5-5 5" stroke="#ffe7a3" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="32" cy="52" r="2" fill="#fff"/>
      <defs>
        <linearGradient id="lthrPhone" x1="20" y1="14" x2="44" y2="48">
          <stop stop-color="#18d5ff"/>
          <stop offset=".52" stop-color="#6b5cff"/>
          <stop offset="1" stop-color="#d7a41a"/>
        </linearGradient>
      </defs>
    </svg>
  `;

  const CSS = `
    .lthr-root {
      height: 100%;
      color: #edf4ff;
      background:
        radial-gradient(circle at 18% 14%, rgba(24,213,255,.18), transparent 28%),
        radial-gradient(circle at 84% 18%, rgba(215,164,26,.14), transparent 26%),
        linear-gradient(135deg, #070a12 0%, #11172a 48%, #070a12 100%);
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      overflow: auto;
    }
    .lthr-shell {
      width: min(1440px, calc(100% - 56px));
      margin: 0 auto;
      min-height: 100%;
      padding: 30px 0 44px;
      display: grid;
      gap: 16px;
    }
    .lthr-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .lthr-title {
      display: flex;
      align-items: center;
      gap: 14px;
      min-width: 0;
    }
    .lthr-mark {
      width: 56px;
      height: 56px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 8px;
      background: rgba(255,255,255,.08);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
    }
    .lthr-title h2 {
      margin: 0;
      font-size: 24px;
      line-height: 1.05;
      letter-spacing: 0;
    }
    .lthr-title p {
      margin: 5px 0 0;
      color: rgba(237,244,255,.62);
      font-size: 13px;
    }
    .lthr-pill {
      min-width: 132px;
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 999px;
      padding: 9px 13px;
      text-align: center;
      background: rgba(255,255,255,.08);
      color: rgba(237,244,255,.82);
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .08em;
    }
    .lthr-pill.online { color: #9bf7cc; border-color: rgba(64,220,148,.32); background: rgba(64,220,148,.12); }
    .lthr-pill.disabled { color: #ffd28a; border-color: rgba(215,164,26,.32); background: rgba(215,164,26,.12); }
    .lthr-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(260px, .9fr);
      gap: 16px;
    }
    .lthr-panel {
      border: 1px solid rgba(255,255,255,.13);
      border-radius: 8px;
      background: rgba(8,12,22,.72);
      box-shadow: 0 20px 50px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.05);
      padding: 16px;
    }
    .lthr-panel h3 {
      margin: 0 0 12px;
      font-size: 13px;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: rgba(237,244,255,.68);
    }
    .lthr-switch-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 13px 0;
      border-top: 1px solid rgba(255,255,255,.08);
    }
    .lthr-switch-row:first-of-type { border-top: 0; padding-top: 2px; }
    .lthr-switch-row strong { display: block; font-size: 14px; }
    .lthr-switch-row span { display: block; margin-top: 4px; color: rgba(237,244,255,.58); font-size: 12px; line-height: 1.35; }
    .lthr-toggle {
      position: relative;
      width: 52px;
      height: 30px;
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 999px;
      background: rgba(255,255,255,.09);
      cursor: pointer;
      flex: 0 0 auto;
    }
    .lthr-toggle::after {
      content: "";
      position: absolute;
      width: 22px;
      height: 22px;
      left: 3px;
      top: 3px;
      border-radius: 50%;
      background: #dbeafe;
      transition: transform .16s ease, background .16s ease;
    }
    .lthr-toggle.on {
      background: linear-gradient(135deg, rgba(24,213,255,.72), rgba(215,164,26,.72));
      border-color: rgba(255,255,255,.28);
    }
    .lthr-toggle.on::after {
      transform: translateX(22px);
      background: #fff;
    }
    .lthr-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 14px;
    }
    .lthr-btn {
      border: 1px solid rgba(255,255,255,.13);
      border-radius: 8px;
      background: rgba(255,255,255,.09);
      color: #edf4ff;
      min-height: 38px;
      padding: 0 13px;
      cursor: pointer;
      font-weight: 800;
      font-size: 12px;
    }
    .lthr-btn:hover { background: rgba(255,255,255,.14); }
    .lthr-auth {
      display: none;
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px solid rgba(255,255,255,.08);
      gap: 10px;
    }
    .lthr-auth.show {
      display: grid;
    }
    .lthr-auth label {
      display: grid;
      gap: 6px;
      color: rgba(237,244,255,.58);
      font-size: 12px;
      font-weight: 800;
    }
    .lthr-auth input {
      width: 100%;
      min-height: 38px;
      border: 1px solid rgba(255,255,255,.13);
      border-radius: 8px;
      padding: 0 11px;
      color: #edf4ff;
      background: rgba(0,0,0,.22);
      outline: none;
    }
    .lthr-auth-note {
      color: rgba(255,210,138,.82);
      font-size: 12px;
      line-height: 1.35;
    }
    .lthr-subpanel {
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px solid rgba(255,255,255,.08);
      display: grid;
      gap: 10px;
    }
    .lthr-subpanel h4 {
      margin: 0;
      font-size: 12px;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: rgba(237,244,255,.62);
    }
    .lthr-pin-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .lthr-pin-grid input {
      width: 100%;
      min-height: 38px;
      border: 1px solid rgba(255,255,255,.13);
      border-radius: 8px;
      padding: 0 11px;
      color: #edf4ff;
      background: rgba(0,0,0,.22);
      outline: none;
      letter-spacing: .22em;
      font-weight: 800;
      text-align: center;
    }
    .lthr-hint {
      color: rgba(237,244,255,.58);
      font-size: 12px;
      line-height: 1.35;
    }
    .lthr-kv {
      display: grid;
      gap: 10px;
    }
    .lthr-kv div {
      display: grid;
      grid-template-columns: 118px minmax(0, 1fr);
      gap: 10px;
      align-items: start;
      border-bottom: 1px solid rgba(255,255,255,.07);
      padding-bottom: 9px;
      font-size: 12px;
    }
    .lthr-kv div:last-child { border-bottom: 0; padding-bottom: 0; }
    .lthr-kv dt { color: rgba(237,244,255,.52); }
    .lthr-kv dd {
      margin: 0;
      color: rgba(237,244,255,.9);
      overflow-wrap: anywhere;
    }
    .lthr-log {
      min-height: 84px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,.1);
      background: rgba(0,0,0,.2);
      padding: 11px;
      color: rgba(237,244,255,.72);
      font-family: Consolas, monospace;
      font-size: 12px;
      white-space: pre-wrap;
    }
    @media (max-width: 820px) {
      .lthr-grid { grid-template-columns: 1fr; }
      .lthr-head { align-items: flex-start; flex-direction: column; }
      .lthr-pill { min-width: 0; width: 100%; }
    }
  `;

  function ensureCss() {
    if (document.getElementById('lthr-css')) return;
    const style = document.createElement('style');
    style.id = 'lthr-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function formatDate(value) {
    if (!value) return 'sin datos';
    try {
      return new Date(value).toLocaleString();
    } catch {
      return String(value);
    }
  }

  function clampPercent(value) {
    return Math.max(0, Math.min(100, Number(value || 0) || 0));
  }

  function formatUsage(used, total, percent) {
    const safeUsed = Math.max(0, Number(used || 0) || 0);
    const safeTotal = Math.max(0, Number(total || 0) || 0);
    const safePercent = clampPercent(percent);
    if (!safeTotal) return 'sin datos';
    return `${safeUsed} / ${safeTotal} (${safePercent.toFixed(0)}%)`;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function planAllowsImage(plan) {
    return ['pro', 'studio', 'ultra'].includes(String(plan || 'free').trim().toLowerCase());
  }

  window.LTH_APPS = window.LTH_APPS || {};
  window.LTH_APPS['lth-remote'] = {
    id: 'lth-remote',
    name: 'LTH Remote',
    icon,
    iconUrl,
    gradient: 'linear-gradient(135deg,#07111f,#18d5ff 48%,#d7a41a)',
    position: 4,
    render(container) {
      ensureCss();
      container.innerHTML = `
        <div class="lthr-root">
          <div class="lthr-shell">
            <div class="lthr-head">
              <div class="lthr-title">
                <div class="lthr-mark">${icon}</div>
                <div>
                  <h2>LTH Remote</h2>
                  <p>Canal seguro para telefono y LTH OS</p>
                </div>
              </div>
              <div class="lthr-pill" data-status-pill>cargando</div>
            </div>

            <div class="lthr-grid">
              <section class="lthr-panel">
                <h3>Permisos</h3>
                <div class="lthr-switch-row">
                  <div><strong>Remote activo</strong><span>Conecta esta PC al canal privado del usuario.</span></div>
                  <button class="lthr-toggle" type="button" data-toggle="enabled" aria-label="Remote activo"></button>
                </div>
                <div class="lthr-switch-row">
                  <div><strong>Permitir ver</strong><span>Estado, ventanas y capturas del escritorio LTH.</span></div>
                  <button class="lthr-toggle" type="button" data-toggle="allowView" aria-label="Permitir ver"></button>
                </div>
                <div class="lthr-switch-row">
                  <div><strong>Permitir controlar</strong><span>Abrir y cerrar apps dentro de LTH OS.</span></div>
                  <button class="lthr-toggle" type="button" data-toggle="allowControl" aria-label="Permitir controlar"></button>
                </div>
                <div class="lthr-switch-row">
                  <div><strong>Nube privada en el telefono</strong><span>Deja que el telefono vea y suba archivos a tu nube cifrada de LTH OS.</span></div>
                  <button class="lthr-toggle" type="button" data-toggle="allowCloud" aria-label="Nube privada en el telefono"></button>
                </div>
                <div class="lthr-switch-row">
                  <div><strong>Disponible en segundo plano</strong><span>Permite mantener LTH Remote en bandeja solo cuando se inicia en modo background.</span></div>
                  <button class="lthr-toggle" type="button" data-toggle="backgroundEnabled" aria-label="Disponible en segundo plano"></button>
                </div>
                <div class="lthr-switch-row">
                  <div><strong>Iniciar con Windows</strong><span>Activa LTH Remote al iniciar sesion en Windows.</span></div>
                  <button class="lthr-toggle" type="button" data-toggle="startWithWindows" aria-label="Iniciar con Windows"></button>
                </div>
                <div class="lthr-actions">
                  <button class="lthr-btn" type="button" data-action="refresh">Actualizar</button>
                </div>
                <div class="lthr-subpanel">
                  <h4>PIN de acceso</h4>
                  <div class="lthr-hint">Configura un PIN numerico de 6 digitos. El iPhone lo pedira en cada sesion para desbloquear esta PC.</div>
                  <form data-pin-form>
                    <div class="lthr-pin-grid">
                      <input type="password" inputmode="numeric" maxlength="6" placeholder="PIN" autocomplete="one-time-code" data-pin-one>
                      <input type="password" inputmode="numeric" maxlength="6" placeholder="Confirmar" autocomplete="one-time-code" data-pin-two>
                    </div>
                    <div class="lthr-actions">
                      <button class="lthr-btn" type="submit">Guardar PIN</button>
                      <button class="lthr-btn" type="button" data-action="clear-pin">Limpiar PIN</button>
                    </div>
                  </form>
                </div>
                <div class="lthr-auth" data-auth-form>
                  <div class="lthr-auth-note">Esta app usa automáticamente la sesión principal de LTH OS. No necesitas iniciar sesión otra vez.</div>
                </div>
                <section class="lthr-subpanel" data-device-security hidden>
                  <h4>Dispositivo seguro</h4>
                  <div class="lthr-hint" data-device-security-copy>Vincula esta PC antes de autorizar un telefono.</div>
                  <form data-device-enroll-form>
                    <label>Confirma tu correo
                      <input type="email" data-device-email autocomplete="email">
                    </label>
                    <label>Confirma tu contrasena
                      <input type="password" data-device-password autocomplete="current-password">
                    </label>
                    <div class="lthr-actions">
                      <button class="lthr-btn" type="submit" data-device-enroll>Vincular esta PC</button>
                      <button class="lthr-btn" type="button" data-device-refresh>Actualizar seguridad</button>
                    </div>
                  </form>
                  <div class="lthr-actions">
                    <button class="lthr-btn" type="button" data-device-code hidden>Generar codigo para telefono</button>
                    <button class="lthr-btn" type="button" data-device-code-os hidden>Autorizar la otra PC</button>
                    <button class="lthr-btn" type="button" data-device-revoke hidden>Quitar telefono vinculado</button>
                  </div>
                  <div class="lthr-hint" data-device-code-output hidden></div>
                </section>
              </section>

              <section class="lthr-panel">
                <h3>Resumen seguro</h3>
                <dl class="lthr-kv" data-kv></dl>
              </section>
            </div>

            <section class="lthr-panel">
              <h3>Actividad</h3>
              <div class="lthr-log" data-log>Esperando estado...</div>
            </section>
          </div>
        </div>
      `;

      const state = { status: null, auth: null };
      const logEl = container.querySelector('[data-log]');
      const pill = container.querySelector('[data-status-pill]');
      const kv = container.querySelector('[data-kv]');
      const authForm = container.querySelector('[data-auth-form]');
      const pinForm = container.querySelector('[data-pin-form]');
      const copyChannelBtn = container.querySelector('[data-action="copy-channel"]');
      const devicePanel = container.querySelector('[data-device-security]');
      const deviceEnrollForm = container.querySelector('[data-device-enroll-form]');
      const deviceCopy = container.querySelector('[data-device-security-copy]');
      const deviceCodeBtn = container.querySelector('[data-device-code]');
      const deviceCodeOsBtn = container.querySelector('[data-device-code-os]');
      const deviceRevokeBtn = container.querySelector('[data-device-revoke]');
      const deviceCodeOutput = container.querySelector('[data-device-code-output]');

      const writeLog = (message) => {
        logEl.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
      };

      const renderStatus = (status, authState = state.auth) => {
        state.status = status || {};
        state.auth = authState || null;
        const text = state.status.status || 'sin estado';
        pill.textContent = text;
        pill.className = `lthr-pill ${state.status.connected ? 'online' : (state.status.enabled ? '' : 'disabled')}`;
        container.querySelectorAll('[data-toggle]').forEach((button) => {
          const key = button.dataset.toggle;
          button.classList.toggle('on', Boolean(state.status[key]));
        });
        authForm.classList.toggle('show', true);
        if (copyChannelBtn) copyChannelBtn.hidden = state.status.sensitiveDetailsVisible !== true;
        kv.innerHTML = `
          <div><dt>PC principal</dt><dd>${state.auth?.signedIn ? 'Verificada con tu sesión LTH OS' : 'Inicia sesión en LTH OS'}</dd></div>
          <div><dt>Remote</dt><dd>${state.status.enabled ? (state.status.connected ? 'Activo y listo' : 'Activándose…') : 'Desactivado'}</dd></div>
          <div><dt>Teléfono</dt><dd>${state.status.phonePresenceCount ? 'Conectado' : 'Sin teléfono activo'}</dd></div>
          <div><dt>Control</dt><dd>${state.status.allowControl ? 'Permitido' : 'Solo vista'}</dd></div>
          <div><dt>Nube privada</dt><dd>${state.status.allowCloud !== false ? 'Visible desde el telefono' : 'Bloqueada para el telefono'}</dd></div>
          <div><dt>PIN</dt><dd>${state.status.pinConfigured ? 'Protección configurada' : 'Sin PIN adicional'}</dd></div>
          <div><dt>Última actividad</dt><dd>${escapeHtml(formatDate(state.status.lastCommandAt) || 'Sin actividad todavía')}</dd></div>
        `;
      };

      const renderDeviceSecurity = (securityResult, authState = state.auth) => {
        const security = securityResult?.security || null;
        const account = security?.account || null;
        const devices = Array.isArray(security?.devices) ? security.devices : [];
        const challenges = Array.isArray(security?.challenges) ? security.challenges : [];
        const os = devices.find((device) => device.product === 'lth_os' && device.status === 'approved');
        const phone = devices.find((device) => device.product === 'lth_remote' && device.device_kind === 'phone' && device.status === 'approved');
        const pendingPhone = challenges.find((challenge) => challenge.requested_product === 'lth_remote' && challenge.requested_kind === 'phone' && challenge.status === 'pending');
        // Otra PC pidiendo entrar. Antes esta solicitud no la podia atender
        // nadie desde aqui: quien no tuviera telefono se quedaba sin manera de
        // autorizar una segunda maquina.
        const pendingOs = challenges.find((challenge) => challenge.requested_product === 'lth_os' && challenge.requested_kind === 'desktop' && challenge.status === 'pending');
        state.deviceSecurity = { account, os, phone, pendingPhone, pendingOs, error: securityResult?.error || '' };
        if (!devicePanel) return;
        const signedIn = Boolean(authState?.signedIn);
        devicePanel.hidden = !signedIn;
        if (!signedIn) return;
        if (securityResult?.success === false) {
          deviceCopy.textContent = securityResult.error || 'No se pudo leer la seguridad del dispositivo.';
        } else if (!os) {
          deviceCopy.textContent = 'Esta es la primera PC LTH OS. Confirma tu contrasena una vez para anclarla de forma segura.';
        } else if (pendingOs) {
          deviceCopy.textContent = `Otra PC (${pendingOs.requested_name || 'nueva'}) pide entrar a tu cuenta. Autorizala solo si eres tu: al hacerlo, esa PC pasa a ser la principal y esta se desvincula.`;
        } else if (pendingPhone) {
          deviceCopy.textContent = `Un telefono (${pendingPhone.requested_name || 'nuevo'}) espera aprobacion. Genera el codigo solo si eres tu.`;
        } else if (phone) {
          deviceCopy.textContent = `PC vinculada y telefono unico activo: ${phone.display_name || 'Telefono LTH Remote'}.`;
        } else {
          deviceCopy.textContent = 'PC vinculada. Abre LTH Remote desde un telefono nuevo para solicitar su vinculacion.';
        }
        deviceEnrollForm.hidden = Boolean(os);
        deviceCodeBtn.hidden = !(os && pendingPhone);
        deviceCodeOsBtn.hidden = !(os && pendingOs);
        deviceRevokeBtn.hidden = !(os && phone);
      };

      const refresh = async () => {
        try {
          const [status, auth, security] = await Promise.all([
            window.electron?.remote?.getStatus?.(),
            window.electron?.auth?.getState?.(),
            window.electron?.deviceSecurity?.state?.()
          ]);
          renderStatus(status, auth);
          renderDeviceSecurity(security, auth);
          writeLog(status?.success ? `Estado: ${status.status}` : (status?.error || 'No disponible'));
        } catch (error) {
          writeLog(error?.message || String(error));
        }
      };

      const updateConfig = async (patch) => {
        try {
          const status = await window.electron?.remote?.setConfig?.(patch);
          const auth = await window.electron?.auth?.getState?.();
          renderStatus(status, auth);
          writeLog(status?.success ? 'Configuracion guardada.' : (status?.error || 'No se pudo guardar.'));
        } catch (error) {
          writeLog(error?.message || String(error));
        }
      };

      container.querySelectorAll('[data-toggle]').forEach((button) => {
        button.addEventListener('click', () => {
          const key = button.dataset.toggle;
          updateConfig({ [key]: !Boolean(state.status?.[key]) });
        });
      });

      container.querySelector('[data-action="refresh"]').addEventListener('click', refresh);
      container.querySelector('[data-action="copy-channel"]')?.addEventListener('click', async () => {
        if (state.status?.sensitiveDetailsVisible !== true) {
          writeLog('El canal real queda oculto en produccion.');
          return;
        }
        const channel = state.status?.channel || '';
        if (!channel) {
          writeLog('No hay canal activo para copiar.');
          return;
        }
        try {
          await navigator.clipboard.writeText(channel);
          writeLog('Canal copiado.');
        } catch {
          writeLog(channel);
        }
      });

      container.querySelector('[data-action="clear-pin"]').addEventListener('click', async () => {
        try {
          const status = await window.electron?.remote?.clearPin?.();
          renderStatus(status, state.auth);
          writeLog(status?.success ? 'PIN remoto limpiado.' : (status?.error || 'No se pudo limpiar el PIN.'));
        } catch (error) {
          writeLog(error?.message || String(error));
        }
      });

      pinForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const pinOne = String(container.querySelector('[data-pin-one]')?.value || '').trim();
        const pinTwo = String(container.querySelector('[data-pin-two]')?.value || '').trim();
        if (!/^\d{6}$/.test(pinOne)) {
          writeLog('El PIN debe tener 6 digitos numericos.');
          return;
        }
        if (pinOne !== pinTwo) {
          writeLog('La confirmacion del PIN no coincide.');
          return;
        }

        try {
          const status = await window.electron?.remote?.setPin?.({ pin: pinOne });
          renderStatus(status, state.auth);
          container.querySelector('[data-pin-one]').value = '';
          container.querySelector('[data-pin-two]').value = '';
          writeLog(status?.success ? 'PIN remoto guardado.' : (status?.error || 'No se pudo guardar el PIN.'));
        } catch (error) {
          writeLog(error?.message || String(error));
        }
      });

      container.querySelector('[data-device-refresh]')?.addEventListener('click', refresh);
      deviceEnrollForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = String(container.querySelector('[data-device-email]')?.value || '').trim();
        const password = String(container.querySelector('[data-device-password]')?.value || '');
        if (!email || !password) {
          writeLog('Confirma correo y contrasena para vincular esta PC.');
          return;
        }
        writeLog('Vinculando esta PC con cifrado local...');
        const result = await window.electron?.deviceSecurity?.enrollOs?.({ email, password });
        container.querySelector('[data-device-password]').value = '';
        if (!result?.success) {
          writeLog(result?.error || 'No se pudo vincular esta PC.');
          return;
        }
        writeLog('PC vinculada. Ya puedes aprobar un solo telefono LTH Remote.');
        await refresh();
      });

      deviceCodeBtn?.addEventListener('click', async () => {
        const pending = state.deviceSecurity?.pendingPhone;
        const account = state.deviceSecurity?.account;
        const os = state.deviceSecurity?.os;
        if (!pending || !account || !os) {
          writeLog('No hay una solicitud de telefono pendiente.');
          return;
        }
        const result = await window.electron?.deviceSecurity?.issuePairingCode?.({
          challengeId: pending.id,
          nonce: pending.nonce,
          securityEpoch: account.securityEpoch,
          approverDeviceId: os.id
        });
        if (!result?.success || !result?.pairingCode?.code) {
          writeLog(result?.error || 'No se pudo generar el codigo.');
          return;
        }
        deviceCodeOutput.hidden = false;
        deviceCodeOutput.textContent = `Codigo de un solo uso: ${result.pairingCode.code}. Vence pronto; escribelo solamente en el telefono que solicitaste.`;
        writeLog('Codigo seguro generado en esta PC.');
      });

      deviceCodeOsBtn?.addEventListener('click', async () => {
        const pending = state.deviceSecurity?.pendingOs;
        const account = state.deviceSecurity?.account;
        if (!pending || !account) {
          writeLog('No hay una solicitud de PC pendiente.');
          return;
        }
        // Autorizar otra PC tiene una consecuencia que la de telefono no tiene:
        // solo puede haber UNA maquina LTH OS, asi que esta se queda fuera. Hay
        // que decirlo antes, no despues.
        const confirmado = window.confirm(
          'Autorizar la otra PC hara que ESTA deje de estar vinculada a tu cuenta.\n\n'
          + 'Para volver a entrar aqui tendrias que pedir autorizacion desde la otra PC.\n\n'
          + 'Continuar?'
        );
        if (!confirmado) return;
        const result = await window.electron?.deviceSecurity?.issueOsPairingCode?.({
          challengeId: pending.id,
          nonce: pending.nonce,
          securityEpoch: account.securityEpoch
        });
        if (!result?.success || !result?.pairingCode?.code) {
          writeLog(result?.error || 'No se pudo autorizar la otra PC.');
          return;
        }
        deviceCodeOutput.hidden = false;
        deviceCodeOutput.textContent = `Codigo de un solo uso: ${result.pairingCode.code}. Escribelo en la otra PC. Vence pronto y solo sirve una vez.`;
        writeLog('Codigo de PC generado en esta maquina.');
      });

      deviceRevokeBtn?.addEventListener('click', async () => {
        const account = state.deviceSecurity?.account;
        const os = state.deviceSecurity?.os;
        if (!account || !os) return;
        const confirmed = window.confirm('Esto desconectara el telefono vinculado. Deseas continuar?');
        if (!confirmed) return;
        const result = await window.electron?.deviceSecurity?.revokeRemotePhone?.({
          securityEpoch: account.securityEpoch,
          approverDeviceId: os.id
        });
        if (!result?.success) {
          writeLog(result?.error || 'No se pudo quitar el telefono.');
          return;
        }
        deviceCodeOutput.hidden = true;
        writeLog('Telefono desvinculado. Debe solicitar acceso de nuevo.');
        await refresh();
      });

      refresh();
      const timer = setInterval(refresh, 10000);
      container.__lthRemoteCleanup = () => clearInterval(timer);
    },
    onClose() {
      document.querySelectorAll('.lthr-root').forEach((root) => {
        const parent = root.parentElement;
        if (parent && typeof parent.__lthRemoteCleanup === 'function') {
          parent.__lthRemoteCleanup();
        }
      });
    }
  };
})();
