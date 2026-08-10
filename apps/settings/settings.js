(function () {
    'use strict';

    window.LTH_APPS = window.LTH_APPS || {};

    const SYSTEM_NAME = 'LTH.OS(Oup.1)';
    const ENGINE_VERSION = '2.4.5';
    const BUILD_CODE = 'Oup.1';
    const PATCH_RELEASE_LABEL = '19 de junio de 2026';
    const PATCH_TITLE = 'Motor 2.4.5 - Motor remoto sin PIN, cobro por tokens y base de actualizacion modular';
    const RELEASE_HIGHLIGHTS_TITLE = 'Novedades de la version 2.4.5';

    function readImageAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('No pude leer la imagen.'));
            reader.readAsDataURL(file);
        });
    }

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    async function runSecurityInspection() {
        const checks = [];

        const hasElectron = Boolean(window.electron && window.electron.isElectron);
        checks.push({
            id: 'electron-bridge',
            label: 'Puente Electron seguro (contextIsolation)',
            ok: hasElectron,
            detail: hasElectron
                ? 'Preload expone APIs controladas. nodeIntegration deshabilitado.'
                : 'No se detecta el puente Electron. La app solo funciona dentro de LTH.OS.'
        });

        const bridgeNarrowed = hasElectron
            && Boolean(window.electron?.fs)
            && Boolean(window.electron?.py)
            && Boolean(window.electron?.browser)
            && !('exec' in window.electron)
            && !('runJS' in window.electron)
            && !('ipcRenderer' in window.electron);
        checks.push({
            id: 'renderer-bridge-scope',
            label: 'Bridge del renderer reducido a APIs minimas',
            ok: bridgeNarrowed,
            detail: bridgeNarrowed
                ? 'No se expone exec, runJS ni ipcRenderer raw; solo namespaces controlados.'
                : 'Se detecto un bridge mas amplio de lo esperado en esta sesion.'
        });

        const hasStorage = Boolean(window.electron?.storage?.getPaths);
        let runtimePaths = null;
        let storageInfo = 'Almacenamiento interno no disponible.';
        if (hasStorage) {
            try {
                const res = await window.electron.storage.getPaths();
                runtimePaths = res?.paths || null;
                if (res?.success && res.paths?.data) {
                    storageInfo = 'Datos aislados en carpeta de usuario: ' + res.paths.data;
                }
            } catch (_) {}
        }
        checks.push({
            id: 'storage-isolation',
            label: 'Almacenamiento aislado del sistema',
            ok: hasStorage,
            detail: storageInfo
        });

        const secureStoreBridge = Boolean(window.electron?.secureStore?.get)
            && Boolean(window.electron?.secureStore?.set)
            && Boolean(window.electron?.secureStore?.delete);
        checks.push({
            id: 'secure-store',
            label: 'Secretos cifrados en el equipo local',
            ok: secureStoreBridge,
            detail: secureStoreBridge
                ? 'Las claves sensibles pueden guardarse cifradas desde el proceso principal con safeStorage.'
                : 'No se detecta el almacen cifrado local para secretos.'
        });

        const browserBridge = Boolean(window.electron?.browser?.invoke)
            && typeof window.electron.browser.invoke === 'function';
        checks.push({
            id: 'browser-bridge',
            label: 'Canales del navegador integrados y limitados',
            ok: browserBridge,
            detail: browserBridge
                ? 'El renderer solo puede hablar con canales lth-browser:* para el navegador integrado.'
                : 'No se detecta el bridge protegido del navegador en esta sesion.'
        });

        const httpsDocs = location.protocol === 'file:' || location.protocol === 'https:';
        checks.push({
            id: 'origin',
            label: 'Origen de la interfaz',
            ok: httpsDocs,
            detail: 'Protocolo actual: ' + location.protocol
        });

        const hasCspHint = document.querySelector('meta[http-equiv="Content-Security-Policy"], link[rel="stylesheet"]');
        checks.push({
            id: 'csp',
            label: 'Politica de contenido (CSP) aplicada por el nucleo',
            ok: Boolean(hasCspHint),
            detail: 'CSP gestionada por el proceso principal sobre la ventana principal.'
        });

        const fsApiPresent = Boolean(window.electron?.fs?.readFile)
            && Boolean(window.electron?.fs?.writeFile)
            && Boolean(window.electron?.fs?.readDirectory);
        checks.push({
            id: 'fs-guard',
            label: 'Acceso a archivos mediado por el proceso principal',
            ok: fsApiPresent,
            detail: fsApiPresent
                ? 'Lectura, escritura y operaciones de archivos pasan por handlers con validacion de rutas.'
                : 'La API de archivos controlada no esta disponible.'
        });

        const vaultApiPresent = Boolean(window.electron?.vault?.inspectFolder)
            && Boolean(window.electron?.vault?.encryptFolder)
            && Boolean(window.electron?.vault?.unlockFolder);
        checks.push({
            id: 'vault-bridge',
            label: 'Vault cifrado disponible en LTH Files',
            ok: vaultApiPresent,
            detail: vaultApiPresent
                ? 'El bridge del vault permite encriptar carpetas y abrirlas solo desde LTH.OS con clave.'
                : 'No se detecta la API del vault cifrado en esta sesion.'
        });

        const aiBridgePresent = Boolean(window.electron?.ai?.groqStatus)
            && Boolean(window.electron?.ai?.groqChat);
        checks.push({
            id: 'ai-bridge',
            label: 'Puente IA mediado por el nucleo',
            ok: aiBridgePresent,
            detail: aiBridgePresent
                ? 'LTH-IA y los puentes cloud visibles pasan por el proceso principal; la ruta publica directa a Anthropic queda cerrada en builds empaquetadas.'
                : 'No se detecta el puente IA del motor 2.4.5 en esta sesion.'
        });

        const secureStore = (() => {
            try {
                const probe = '__lth_probe__';
                localStorage.setItem(probe, '1');
                localStorage.removeItem(probe);
                return true;
            } catch (_) {
                return false;
            }
        })();
        checks.push({
            id: 'local-storage',
            label: 'Almacenamiento local accesible',
            ok: secureStore,
            detail: secureStore
                ? 'localStorage disponible para preferencias (sin datos sensibles).'
                : 'localStorage bloqueado, algunas preferencias no persistiran.'
        });

        const pythonBridge = Boolean(window.electron?.py?.execPython);
        const packagedState = Boolean(runtimePaths?.isPackaged);
        checks.push({
            id: 'python-public-gate',
            label: 'Python directo bloqueable en build publica',
            ok: pythonBridge,
            detail: packagedState
                ? 'La build empaquetada bloquea la ejecucion directa de Python salvo que se abra con el flag --allow-python-exec.'
                : 'En desarrollo el bridge de Python sigue disponible para herramientas internas; en build publica queda bloqueado por defecto.'
        });

        return checks;
    }

    window.LTH_APPS.settings = {
        name: 'Configuracion',
        version: ENGINE_VERSION,
        iconUrl: '../assets/configuracion.png',
        icon: '<img src="../assets/configuracion.png" alt="">',
        gradient: 'linear-gradient(135deg, transparent 0%, transparent 52%, transparent 100%)',
        _wallpaperListener: null,
        _klaveListener: null,

        render(container) {
            this.cleanup();

            container.innerHTML = `
                <div class="settings-shell">
                    <aside class="settings-side">
                        <div class="settings-brand">
                            <span class="settings-brand-mark">
                                <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7">
                                    <circle cx="12" cy="12" r="3.4"/><circle cx="12" cy="12" r="8.6" opacity=".55"/>
                                </svg>
                            </span>
                            <span class="settings-brand-name">LTH.OS</span>
                        </div>

                        <nav class="settings-tabs" data-tabs>
                            <button class="settings-tab" data-tab="info">
                                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
                                <span>Informacion</span>
                            </button>
                            <button class="settings-tab is-active" data-tab="account">
                                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="9" r="3.2"/><path d="M5 20a7 7 0 0 1 14 0"/><circle cx="12" cy="12" r="9.2" opacity=".5"/></svg>
                                <span>Cuenta</span>
                            </button>
                            <button class="settings-tab" data-tab="assistant">
                                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l2.4 5.5L20 11l-5.6 2.5L12 19l-2.4-5.5L4 11l5.6-2.5z"/></svg>
                                <span>Asistente</span>
                            </button>
                            <button class="settings-tab" data-tab="wallpaper">
                                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.4"/><circle cx="8.6" cy="10" r="1.5"/><path d="M4 17l4.8-4.4L14 17"/><path d="M13.5 14.6l2.6-2.3L20 16"/></svg>
                                <span>Fondo</span>
                            </button>
                            <button class="settings-tab" data-tab="security">
                                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l7 3v5.5c0 4.4-3 8-7 9.5-4-1.5-7-5.1-7-9.5V6z"/></svg>
                                <span>Seguridad</span>
                            </button>
                            <button class="settings-tab" data-tab="docs">
                                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/></svg>
                                <span>Documentacion</span>
                            </button>
                        </nav>

                        <div class="settings-side-foot">
                            <button class="settings-side-user" data-goto-tab="account" type="button">
                                <span class="settings-side-avatar" data-side-avatar>L</span>
                                <span class="settings-side-id">
                                    <strong data-side-name>Cuenta LTH</strong>
                                    <small data-side-plan>Sin sesion</small>
                                </span>
                                <span class="settings-side-chevron">&#10095;</span>
                            </button>
                            <div class="settings-side-legal">
                                <span class="settings-side-moon">
                                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>
                                </span>
                                <span>
                                    <b>${esc(SYSTEM_NAME)} &copy; 2026</b>
                                    <small>Todos los derechos reservados.</small>
                                </span>
                            </div>
                        </div>
                    </aside>

                    <div class="settings-main">
                    <section class="settings-hero">
                        <div>
                            <div class="settings-eyebrow">Sistema</div>
                            <h2 class="settings-title">${esc(SYSTEM_NAME)}</h2>
                            <p class="settings-copy">Panel oficial del sistema. Informacion general, fondo de pantalla, inspeccion de seguridad y documentacion.</p>
                        </div>
                        <div class="settings-chip">Motores v${esc(ENGINE_VERSION)}</div>
                    </section>

                    <section class="settings-panel" data-panel="info">
                        <div class="settings-card settings-card-featured">
                            <div class="settings-card-title">Sistema</div>
                            <div class="settings-info-grid">
                                <div class="settings-info-row"><span>Nombre</span><strong>${esc(SYSTEM_NAME)}</strong></div>
                                <div class="settings-info-row"><span>Version de motores</span><strong>${esc(ENGINE_VERSION)}</strong></div>
                                <div class="settings-info-row"><span>Build</span><strong>${esc(BUILD_CODE)}</strong></div>
                                <div class="settings-info-row"><span>Plataforma</span><strong data-info-platform>â€”</strong></div>
                                <div class="settings-info-row"><span>Node</span><strong data-info-node>â€”</strong></div>
                                <div class="settings-info-row"><span>Chrome</span><strong data-info-chrome>â€”</strong></div>
                                <div class="settings-info-row"><span>Electron</span><strong data-info-electron>â€”</strong></div>
                                <div class="settings-info-row"><span>Datos del sistema</span><strong data-info-data>â€”</strong></div>
                            </div>
                        </div>

                        <div class="settings-card settings-card-muted">
                            <div class="settings-card-title">Capacidades principales</div>
                            <ul class="settings-list">
                                <li><strong>Escritorio modular</strong> con arrastre, barra de tareas y gestor de ventanas propio.</li>
                                <li><strong>LTH PROG</strong>: entorno de desarrollo HTML/CSS/JS con preview en servidor local.</li>
                                <li><strong>LTH Files</strong>: explorador con vista neon, rutas persistentes, apertura directa en LTH PROG y vault cifrado de carpetas.</li>
                                <li><strong>LTH Browser</strong>: navegador integrado con particion aislada.</li>
                                <li><strong>LTH Terminal</strong> y ejecucion sandbox de JavaScript/Python.</li>
                                <li><strong>Guardian</strong>: motor de inspeccion nativa de codigo.</li>
                                <li><strong>Libreria LTH</strong>: musica, calculadora, book, IA asistente.</li>
                            </ul>
                        </div>

                        <div class="settings-card settings-card-launch">
                            <div class="settings-launch-badge">Evento principal</div>
                            <div class="settings-launch-head">
                                <div>
                                    <div class="settings-card-title">Motor 2.4.5</div>
                                    <div class="settings-card-subtitle">${esc(PATCH_TITLE)} &middot; Lanzamiento oficial del ${esc(PATCH_RELEASE_LABEL)}</div>
                                </div>
                                <div class="settings-launch-mark">Nucleo superior</div>
                            </div>
                            <p class="settings-copy">LTH.OS Motor 2.4.5 hace el motor remoto mas estable y sin PIN, cambia LTH-IA a cobro por tokens reales y sienta la base para que las apps se actualicen solas sin reinstalar todo el sistema.</p>
                            <ul class="settings-list">
                                <li><strong>Motor remoto sin PIN:</strong> el telefono/web se conecta al motor de la PC con la misma cuenta, sin codigo, y la cola sobrevive caidas del realtime (ya no se queda "sin conexion").</li>
                                <li><strong>Cobro por tokens:</strong> LTH-IA cobra por tokens de entrada y salida segun el modelo, con tarifas editables y presupuesto protegido.</li>
                                <li><strong>Automatico mas fuerte:</strong> el nivel premium del router usa GLM-5.2; el plan free usa un modelo de pago barato y estable.</li>
                                <li><strong>Identidad violeta:</strong> acentos, bordes y glow del sistema pasan a azul-violeta unificado con la web de LTH IA.</li>
                                <li><strong>Base de actualizacion modular:</strong> preparacion para actualizar apps individuales desde GitHub + Supabase sin tocar todo el motor.</li>
                            </ul>
                        </div>

                        <div class="settings-card settings-card-muted settings-release-card">
                            <div class="settings-card-title">Las novedades de 2.4.5</div>
                            <div class="settings-card-subtitle">Funciones nuevas listas para explorar desde el ecosistema LTH.</div>
                            <div class="settings-release-grid">
                                <article class="settings-release-item"><span class="settings-release-icon">▣</span><div><strong>Archivos desde LTH Remote</strong><p>Envía y recibe archivos desde el móvil con una conexión controlada.</p></div></article>
                                <article class="settings-release-item"><span class="settings-release-icon">⌁</span><div><strong>Remote con móvil único</strong><p>Solo cuentas logeadas y verificadas pueden usar el acceso remoto autorizado.</p></div></article>
                                <article class="settings-release-item"><span class="settings-release-icon">✦</span><div><strong>LTH IA · beta</strong><p>Interfaz más clara y preparada para nuevas herramientas de asistencia.</p></div></article>
                                <article class="settings-release-item"><span class="settings-release-icon">✎</span><div><strong>Mady en LTH PROG</strong><p>Agente editor para convertir indicaciones en cambios sobre tus proyectos.</p></div></article>
                                <article class="settings-release-item"><span class="settings-release-icon">⌘</span><div><strong>LTH Code · beta</strong><p>Mady y Klave colaboran en tareas de programación más fuertes y autónomas.</p></div></article>
                            </div>
                        </div>

                        <div class="settings-card settings-card-muted">
                            <div class="settings-card-title">${esc(RELEASE_HIGHLIGHTS_TITLE)}</div>
                            <div class="settings-card-subtitle">Actualizado para la linea 2.4.5 el ${esc(PATCH_RELEASE_LABEL)}.</div>
                            <ul class="settings-list">
                                <li><strong>Reconexion robusta:</strong> el motor LTH IA web-&gt;PC corre en un cliente REST independiente del realtime y se auto-cura sin reiniciar.</li>
                                <li><strong>Modo Razonamiento + modelos manuales:</strong> en LTH IA (web y OS) se puede forzar el modelo o el flujo de razonamiento con juez verificador.</li>
                                <li><strong>Busqueda web real:</strong> las consultas que lo requieren traen datos actuales con fuentes citables.</li>
                                <li><strong>Free con marca propia:</strong> el plan free se presenta como una linea de LTH IA, no con el nombre tecnico del modelo.</li>
                                <li><strong>Preparacion de release:</strong> la build 2.4.5 queda lista para empaquetar con el motor remoto estable y la nueva facturacion.</li>
                            </ul>
                        </div>
                    </section>

                    <section class="settings-panel" data-panel="wallpaper">
                        <div class="settings-card settings-card-muted">
                            <div class="settings-card-head">
                                <div>
                                    <div class="settings-card-title">Fondo actual</div>
                                    <div class="settings-card-subtitle" data-wallpaper-source>Fondo base del sistema</div>
                                </div>
                                <div class="settings-actions">
                                    <button class="settings-btn settings-btn-primary" type="button" data-action="upload">Agregar imagen</button>
                                    <button class="settings-btn" type="button" data-action="reset">Fondo base</button>
                                </div>
                            </div>

                            <div class="settings-wallpaper-preview" data-wallpaper-preview>
                                <div class="settings-wallpaper-overlay">
                                    <span class="settings-wallpaper-badge" data-wallpaper-mode>Sistema</span>
                                    <strong>Vista del escritorio</strong>
                                    <span>Asi se ve el home con tu fondo actual.</span>
                                </div>
                            </div>

                            <input type="file" accept="image/*" hidden data-wallpaper-input>
                            <div class="settings-status" data-wallpaper-status>Selecciona un preset o agrega una imagen.</div>
                        </div>

                        <div class="settings-card settings-card-muted">
                            <div class="settings-card-title">Presets integrados</div>
                            <div class="settings-card-subtitle">Incluye el fondo oficial <strong>LTH.OS Motor 2.4.5</strong> y el clasico M2.4 como opcion.</div>
                            <div class="settings-preset-grid" data-wallpaper-grid></div>
                        </div>
                    </section>

                    <section class="settings-panel is-active" data-panel="account">
                        <div class="settings-card settings-card-featured">
                            <div class="settings-card-title">Tu cuenta LTH</div>
                            <p class="settings-copy">Tu identidad del sistema. Al iniciar sesion, LTH IA, LTH Prog y tu barra de uso quedan ligados a la misma cuenta en todo LTH.OS.</p>

                            <div class="settings-account-shell" data-account-shell></div>
                            <div class="settings-account-msg" data-account-msg hidden></div>
                        </div>
                    </section>

                    <section class="settings-panel" data-panel="assistant">
                        <div class="settings-card settings-card-featured settings-klave-card">
                            <div class="settings-card-head">
                                <div>
                                    <div class="settings-card-title">Klave</div>
                                    <div class="settings-card-subtitle">Asistente de voz del sistema. Si queda activado, toma el puesto central del dock donde esta LTH.</div>
                                </div>
                                <div class="settings-klave-mark" aria-hidden="true">K</div>
                            </div>
                            <div class="settings-klave-control">
                                <div>
                                    <div class="settings-klave-state" data-klave-state>Revisando estado...</div>
                                    <p class="settings-copy settings-klave-copy" data-klave-copy>Activalo para que Klave quede en el centro del dock y puedas abrir la conversacion rapido.</p>
                                </div>
                                <button class="settings-klave-switch" type="button" role="switch" aria-checked="false" data-action="toggle-klave">
                                    <span class="settings-klave-switch-knob"></span>
                                </button>
                            </div>
                            <div class="settings-actions settings-klave-actions">
                                <button class="settings-btn settings-btn-primary" type="button" data-action="open-klave">Abrir Klave</button>
                                <button class="settings-btn" type="button" data-action="test-klave">Abrir conversacion</button>
                            </div>
                            <div class="settings-status" data-klave-status>Listo para configurar.</div>
                        </div>

                        <div class="settings-card settings-card-muted">
                            <div class="settings-card-head">
                                <div>
                                    <div class="settings-card-title">Voz Pro de Klave</div>
                                    <div class="settings-card-subtitle">Conversacion directa por voz con Klave: natural, continua y en tiempo real.</div>
                                </div>
                                <button class="settings-klave-switch" type="button" role="switch" aria-checked="false" data-action="toggle-klave-voice">
                                    <span class="settings-klave-switch-knob"></span>
                                </button>
                            </div>
                            <div class="settings-info-grid">
                                <div class="settings-info-row"><span>Modo</span><strong>Voz conversacional</strong></div>
                                <div class="settings-info-row"><span>Acceso</span><strong data-klave-voice-access>Solo Pro</strong></div>
                            </div>
                            <div class="settings-status" data-settings-klave-voice-status>Revisando Klave Voz...</div>
                        </div>
                    </section>

                    <section class="settings-panel" data-panel="security">
                        <div class="settings-card settings-card-featured">
                            <div class="settings-card-head">
                                <div>
                                    <div class="settings-card-title">Inspeccion de seguridad</div>
                                    <div class="settings-card-subtitle">Revision automatica del estado de proteccion del sistema.</div>
                                </div>
                                <button class="settings-btn settings-btn-primary" type="button" data-action="run-security">Re-inspeccionar</button>
                            </div>
                            <div class="settings-sec-summary" data-sec-summary>Corriendo inspeccion...</div>
                            <div class="settings-sec-list" data-sec-list></div>
                        </div>

                        <div class="settings-card settings-card-muted">
                            <div class="settings-card-title">Principios de seguridad del sistema</div>
                            <ul class="settings-list">
                                <li><strong>Aislamiento de contexto:</strong> la interfaz corre sin acceso directo a Node. Todas las acciones pasan por APIs controladas.</li>
                                <li><strong>Bridge reducido:</strong> el preload ya no expone <code>exec</code>, <code>runJS</code> ni <code>ipcRenderer</code> raw al renderer.</li>
                                <li><strong>Rutas protegidas:</strong> lectura, escritura, borrado y renombrado usan validacion por tipo de operacion y raices permitidas.</li>
                                <li><strong>Preview local endurecido:</strong> el servidor de preview queda en <code>localhost</code>, bloquea traversal y responde con headers seguros.</li>
                                <li><strong>Canales peligrosos deshabilitados:</strong> <code>run-js</code> y <code>exec-cmd</code> quedaron anulados por seguridad desde el proceso principal.</li>
                                <li><strong>Navegador integrado:</strong> usa particion persistente propia, permisos sensibles negados por defecto y <code>webview</code> endurecido desde main.</li>
                                <li><strong>Almacenamiento del usuario:</strong> los datos viven bajo la carpeta privada del sistema operativo y nunca dentro del paquete compilado.</li>
                                <li><strong>Secretos locales cifrados:</strong> las claves sensibles ya pueden quedar cifradas en el equipo con <code>safeStorage</code> en vez de depender de <code>localStorage</code>.</li>
                                <li><strong>Vault de carpetas:</strong> el contenido de carpetas protegidas se cifra en disco y solo se desbloquea dentro de LTH.OS con clave valida.</li>
                            </ul>
                        </div>

                        <div class="settings-card settings-card-muted">
                            <div class="settings-card-title">Actualizacion de seguridad actual</div>
                            <div class="settings-card-subtitle">Version 2.4.5 lanzada el ${esc(PATCH_RELEASE_LABEL)}</div>
                            <ul class="settings-list">
                                <li><strong>Renderer:</strong> APIs expuestas reducidas a <code>fs</code>, <code>vault</code>, <code>system</code>, <code>config</code>, <code>py</code>, <code>preview</code>, <code>storage</code>, <code>secureStore</code>, <code>shell.openExternal</code>, <code>shell.openPath</code> y <code>browser</code>.</li>
                                <li><strong>Filesystem:</strong> permisos separados para lectura, escritura y operaciones destructivas; rutas arbitrarias ya no quedan aprobadas implicitamente.</li>
                                <li><strong>Python endurecido:</strong> la ejecucion directa de Python queda bloqueada por defecto en builds publicas y solo puede reactivarse con un flag explicito.</li>
                                <li><strong>Rutas persistentes:</strong> las carpetas elegidas por dialogo quedan aprobadas de forma explicita y se recargan al iniciar el sistema.</li>
                                <li><strong>Workspace y preview:</strong> <code>storage:save-workspace</code> y <code>preview:set-root</code> ahora validan la ruta antes de aceptarla.</li>
                                <li><strong>Preview HTTP:</strong> se quitaron respuestas con CORS abierto y se agregaron <code>nosniff</code>, <code>same-origin</code> y <code>no-referrer</code>.</li>
                                <li><strong>Browser engine:</strong> permisos como camara, microfono, geolocalizacion y notificaciones quedan negados por defecto en la sesion del navegador.</li>
                                <li><strong>Webview:</strong> popups denegados, protocolos inseguros bloqueados y preload fijado desde el proceso principal para evitar overrides desde el renderer.</li>
                                <li><strong>Supabase/CORS:</strong> el ajuste especial ya no es global; solo aplica a <code>fetch/xhr</code> iniciados desde contextos confiables de la app.</li>
                                <li><strong>Vault cifrado:</strong> carpetas protegidas usan manifiesto y blobs cifrados en disco, con apertura controlada por sesion y clave.</li>
                                <li><strong>Empaquetado externo:</strong> el instalador ya contempla copiar binarios auxiliares fuera del <code>asar</code> para que Guardian siga accesible.</li>
                            </ul>
                        </div>
                    </section>

                    <section class="settings-panel" data-panel="docs">
                        <div class="settings-card settings-card-featured">
                            <div class="settings-card-title">${esc(SYSTEM_NAME)}</div>
                            <p class="settings-copy">Sistema operativo de escritorio construido sobre Electron, orientado a programacion, productividad y uso personal. Todo se ejecuta localmente. No se envian datos a servicios externos sin que el usuario lo inicie.</p>

                            <div class="settings-doc-section">
                                <h3>Lo que puede hacer LTH.OS</h3>
                                <ul class="settings-list">
                                    <li>Escribir, ejecutar y previsualizar proyectos HTML, CSS y JavaScript.</li>
                                    <li>Explorar archivos con una UI propia estilo escritorio, rutas configurables y accesos rapidos persistentes.</li>
                                    <li>Navegar la web desde un navegador integrado.</li>
                                    <li>Ejecutar JavaScript en sandbox con timeout y captura de logs.</li>
                                    <li>Ejecutar codigo Python localmente en modo de desarrollo o sesiones internas autorizadas.</li>
                                    <li>Personalizar fondo, tareas y iconos del escritorio.</li>
                                    <li>Encriptar carpetas para mantenerlas ilegibles fuera de LTH.OS y abrirlas solo con clave dentro del sistema.</li>
                                </ul>
                            </div>

                            <div class="settings-doc-section">
                                <h3>Seguridad por diseno</h3>
                                <ul class="settings-list">
                                    <li>Ventana principal con contextIsolation y sin nodeIntegration.</li>
                                    <li>Bridge del renderer reducido; no se expone ejecucion arbitraria al frontend.</li>
                                    <li>CSP aplicada desde el proceso principal, limitando scripts y conexiones.</li>
                                    <li>Acceso a archivos mediado por el main process con raices permitidas y validacion por operacion.</li>
                                    <li>Canales <code>run-js</code> y <code>exec-cmd</code> deshabilitados por seguridad.</li>
                                    <li>Almacenamiento aislado por usuario bajo APPDATA (Windows) o equivalente, separado del paquete compilado.</li>
                                    <li>Navegador integrado con particion aislada, permisos minimizados y webview endurecido.</li>
                                </ul>
                            </div>

                            <div class="settings-doc-section">
                                <h3>Recomendaciones de uso</h3>
                                <ul class="settings-list">
                                    <li>Usa LTH PROG solo con proyectos que confies; evita pegar codigo de fuentes desconocidas.</li>
                                    <li>Cierra la app cuando no la uses para liberar recursos y puertos locales.</li>
                                    <li>Respalda tus proyectos importantes fuera del sistema cuando sea posible.</li>
                                    <li>Mantente en la ultima version de motores; las actualizaciones incluyen correcciones de seguridad.</li>
                                    <li>No compartas capturas que expongan rutas internas de tu usuario sin necesidad.</li>
                                </ul>
                            </div>

                            <div class="settings-doc-footer">Motores v${esc(ENGINE_VERSION)} &middot; Build ${esc(BUILD_CODE)} &middot; ${esc(SYSTEM_NAME)}</div>
                        </div>
                    </section>
                    </div>
                </div>

                <style>
                /* Dos columnas: la barra lateral queda fija y solo el contenido
                   hace scroll. Antes el shell entero se desplazaba y las
                   pestanas se perdian al bajar. */
                .settings-shell {
                    display: grid;
                    grid-template-columns: 248px minmax(0, 1fr);
                    gap: 0;
                    color: #f8fafc;
                    height: calc(100vh - 86px);
                    max-height: calc(100vh - 86px);
                    overflow: hidden;
                }
                .settings-main {
                    min-width: 0;
                    padding: 22px 24px 40px;
                    overflow-y: auto;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(255,255,255,0.16) transparent;
                }
                .settings-main::-webkit-scrollbar { width: 8px; }
                .settings-main::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.14);
                    border-radius: 999px;
                }

                /* ── Barra lateral ── */
                .settings-side {
                    display: flex;
                    flex-direction: column;
                    min-height: 0;
                    padding: 20px 14px 16px;
                    border-right: 1px solid rgba(255,255,255,0.07);
                    background: linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012));
                }
                .settings-brand {
                    display: flex; align-items: center; gap: 10px;
                    padding: 4px 8px 18px;
                }
                .settings-brand-mark {
                    width: 34px; height: 34px; flex-shrink: 0;
                    display: grid; place-items: center;
                    border-radius: 11px;
                    color: #7dd3fc;
                    background: linear-gradient(135deg, rgba(56,189,248,0.20), rgba(139,92,246,0.14));
                    border: 1px solid rgba(125,211,252,0.24);
                }
                .settings-brand-name {
                    font-size: 15px; font-weight: 800; letter-spacing: 0.01em;
                }
                .settings-side-foot {
                    margin-top: auto;
                    padding-top: 14px;
                    display: flex; flex-direction: column; gap: 10px;
                }
                .settings-side-user {
                    display: flex; align-items: center; gap: 10px; width: 100%;
                    padding: 9px 10px;
                    border: 1px solid rgba(255,255,255,0.09);
                    border-radius: 13px;
                    background: rgba(255,255,255,0.04);
                    color: inherit; cursor: pointer; text-align: left;
                    transition: background 0.15s, border-color 0.15s;
                }
                .settings-side-user:hover {
                    background: rgba(255,255,255,0.08);
                    border-color: rgba(255,255,255,0.16);
                }
                .settings-side-avatar {
                    width: 32px; height: 32px; flex-shrink: 0;
                    display: grid; place-items: center;
                    border-radius: 10px;
                    background: linear-gradient(135deg, #8b5cf6, #6366f1);
                    color: #fff; font-weight: 800; font-size: 14px;
                }
                .settings-side-id { min-width: 0; flex: 1; display: block; }
                .settings-side-id strong,
                .settings-side-id small {
                    display: block; overflow: hidden;
                    text-overflow: ellipsis; white-space: nowrap;
                }
                .settings-side-id strong { font-size: 12px; font-weight: 700; }
                .settings-side-id small { font-size: 10.5px; color: rgba(226,232,240,0.55); margin-top: 1px; }
                .settings-side-chevron { flex-shrink: 0; font-size: 10px; opacity: 0.42; }
                .settings-side-legal {
                    display: flex; align-items: center; gap: 9px;
                    padding: 2px 6px;
                    color: rgba(226,232,240,0.42);
                }
                .settings-side-moon {
                    width: 30px; height: 30px; flex-shrink: 0;
                    display: grid; place-items: center;
                    border-radius: 10px;
                    background: rgba(255,255,255,0.04);
                    color: rgba(191,219,254,0.7);
                }
                .settings-side-legal b { display: block; font-size: 10.5px; font-weight: 700; }
                .settings-side-legal small { display: block; font-size: 9.5px; opacity: 0.75; }

                @media (max-width: 780px) {
                    .settings-shell { grid-template-columns: 1fr; height: auto; max-height: calc(100vh - 86px); overflow-y: auto; }
                    .settings-side { border-right: 0; border-bottom: 1px solid rgba(255,255,255,0.07); }
                    .settings-main { overflow: visible; }
                }
                .settings-hero {
                    display: flex; align-items: flex-end;
                    justify-content: space-between; gap: 16px;
                    margin-bottom: 14px;
                }
                .settings-eyebrow {
                    font-size: 11px; letter-spacing: 0.18em;
                    text-transform: uppercase;
                    color: rgba(255,255,255,0.58); margin-bottom: 8px;
                }
                .settings-title {
                    font-size: clamp(26px, 3.6vw, 34px);
                    line-height: 1; margin: 0 0 8px;
                    letter-spacing: -0.02em;
                }
                .settings-copy {
                    margin: 0; max-width: 620px;
                    color: rgba(226,232,240,0.82); line-height: 1.55;
                }
                .settings-chip {
                    padding: 10px 14px;
                    background: rgba(255,255,255,0.06);
                    border: 1px solid rgba(255,255,255,0.10);
                    color: rgba(255,255,255,0.82);
                    border-radius: 999px;
                    font-size: 11px; letter-spacing: 0.12em;
                    text-transform: uppercase; white-space: nowrap;
                }

                /* Lista vertical dentro de la barra lateral. Se le deja su
                   propio scroll por si algun dia hay mas secciones que alto. */
                .settings-tabs {
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                    min-height: 0;
                    overflow-y: auto;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(255,255,255,0.12) transparent;
                }
                .settings-tab {
                    display: flex; align-items: center; gap: 11px;
                    width: 100%;
                    padding: 11px 12px;
                    border: 0;
                    background: transparent;
                    color: rgba(226,232,240,0.66);
                    font-size: 13.5px; font-weight: 600;
                    border-radius: 11px;
                    cursor: pointer;
                    white-space: nowrap;
                    text-align: left;
                    position: relative;
                    transition: background 0.15s, color 0.15s;
                }
                .settings-tab svg { flex-shrink: 0; opacity: 0.8; }
                .settings-tab:hover { color: #fff; background: rgba(255,255,255,0.05); }
                .settings-tab.is-active {
                    background: linear-gradient(90deg, rgba(56,189,248,0.16), rgba(139,92,246,0.09));
                    color: #fff;
                }
                .settings-tab.is-active svg { opacity: 1; color: #7dd3fc; }
                /* Marca de seleccion a la izquierda, como en la referencia. */
                .settings-tab.is-active::before {
                    content: "";
                    position: absolute; left: 0; top: 50%;
                    width: 3px; height: 22px; margin-top: -11px;
                    border-radius: 0 3px 3px 0;
                    background: linear-gradient(180deg, #7dd3fc, #8b5cf6);
                }

                .settings-panel { display: none; }
                .settings-panel.is-active { display: block; }

                .settings-account-form { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
                .settings-account-input {
                    width: 100%; box-sizing: border-box;
                    padding: 11px 13px; border-radius: 12px;
                    border: 1px solid rgba(255,255,255,0.12);
                    background: rgba(8,11,20,0.7); color: #eaf0ff; font-size: 14px; outline: none;
                    transition: border 0.15s, box-shadow 0.15s;
                }
                .settings-account-input:focus { border-color: rgba(139,92,246,0.55); box-shadow: 0 0 0 3px rgba(139,92,246,0.18); }
                .settings-account-btn {
                    align-self: flex-start;
                    padding: 10px 18px; border-radius: 14px;
                    border: 1px solid rgba(154,177,230,0.16);
                    background: linear-gradient(180deg, rgba(46,58,92,0.72), rgba(31,39,66,0.76));
                    color: #eef4ff;
                    font-size: 13px; font-weight: 600; cursor: pointer;
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
                    transition: filter 0.15s, transform 0.1s, border-color 0.15s;
                }
                .settings-account-btn:hover {
                    filter: brightness(1.08);
                    border-color: rgba(189, 206, 255, 0.26);
                }
                .settings-account-btn:active { transform: translateY(1px); }
                .settings-account-btn:disabled { opacity: 0.55; cursor: default; }
                .settings-account-btn--primary { background: linear-gradient(135deg,#5b7bff,#7c4bff); border-color: transparent; }
                .settings-account-actions { margin-top: 14px; }
                .settings-account-hint { margin: 4px 0 0; font-size: 11.5px; color: rgba(159,176,214,0.8); line-height: 1.45; }
                .settings-account-msg { margin-top: 12px; font-size: 12.5px; color: #a7e3c0; }
                .settings-account-msg.is-error { color: #ff9b9b; }
                .settings-account-shell { margin-top: 16px; }
                .settings-account-state {
                    display: grid;
                    gap: 16px;
                }
                .settings-account-hero {
                    position: relative;
                    overflow: hidden;
                    border-radius: 28px;
                    padding: 26px;
                    background:
                        radial-gradient(circle at 14% 18%, rgba(88, 142, 255, 0.16), transparent 28%),
                        radial-gradient(circle at 86% 16%, rgba(214, 127, 255, 0.11), transparent 26%),
                        linear-gradient(180deg, rgba(15,20,35,0.94), rgba(9,12,23,0.98));
                    border: 1px solid rgba(130, 154, 216, 0.16);
                    box-shadow:
                        0 18px 40px rgba(0,0,0,0.22),
                        inset 0 1px 0 rgba(255,255,255,0.05);
                }
                .settings-account-hero::before {
                    content: '';
                    position: absolute;
                    left: 26px;
                    right: 26px;
                    top: 0;
                    height: 1px;
                    background: linear-gradient(90deg, transparent, rgba(204,221,255,0.22), transparent);
                }
                .settings-account-hero::after {
                    content: '';
                    position: absolute;
                    right: -50px;
                    bottom: -70px;
                    width: 210px;
                    height: 210px;
                    border-radius: 50%;
                    background: radial-gradient(circle, rgba(124,75,255,0.14), transparent 66%);
                    pointer-events: none;
                }
                .settings-account-top {
                    position: relative;
                    z-index: 1;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 18px;
                    flex-wrap: wrap;
                }
                .settings-account-user {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    min-width: 0;
                }
                .settings-account-avatar {
                    width: 56px;
                    height: 56px;
                    border-radius: 17px;
                    display: grid;
                    place-items: center;
                    flex: 0 0 auto;
                    color: #fff;
                    font-size: 17px;
                    font-weight: 700;
                    letter-spacing: 0.08em;
                    background:
                        linear-gradient(145deg, rgba(97,126,255,0.92), rgba(124,75,255,0.82) 52%, rgba(255,186,111,0.84));
                    box-shadow:
                        inset 0 1px 0 rgba(255,255,255,0.22),
                        0 10px 22px rgba(35, 21, 80, 0.26);
                }
                .settings-account-kicker {
                    font-size: 10.5px;
                    letter-spacing: 0.18em;
                    text-transform: uppercase;
                    color: rgba(193, 211, 244, 0.62);
                }
                .settings-account-name {
                    margin-top: 4px;
                    font-size: 22px;
                    font-weight: 700;
                    color: #f7fbff;
                    line-height: 1.05;
                }
                .settings-account-meta {
                    margin-top: 7px;
                    color: rgba(214,224,244,0.68);
                    font-size: 12.5px;
                    overflow-wrap: anywhere;
                }
                .settings-account-side {
                    position: relative;
                    z-index: 1;
                    display: grid;
                    gap: 10px;
                    justify-items: end;
                }
                .settings-account-badge {
                    display: inline-flex;
                    align-items: center;
                    min-height: 32px;
                    padding: 7px 14px;
                    border-radius: 999px;
                    font-size: 10.5px;
                    font-weight: 700;
                    letter-spacing: 0.16em;
                    text-transform: uppercase;
                    border: 1px solid rgba(255,255,255,0.10);
                    color: #eff6ff;
                    background: rgba(255,255,255,0.05);
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
                }
                .settings-account-badge.is-pro {
                    color: #ffecc0;
                    background: linear-gradient(135deg, rgba(255,208,117,0.14), rgba(124,75,255,0.10));
                    border-color: rgba(255,208,117,0.24);
                }
                .settings-account-badge.is-free {
                    color: #d7e6ff;
                    background: rgba(120,150,255,0.10);
                    border-color: rgba(120,150,255,0.18);
                }
                .settings-account-right {
                    position: relative;
                    z-index: 1;
                    display: flex;
                    align-items: stretch;
                    gap: 14px;
                    flex-wrap: wrap;
                    justify-content: flex-end;
                }
                .settings-account-balance {
                    position: relative;
                    overflow: hidden;
                    min-width: 196px;
                    padding: 15px 18px 16px;
                    border-radius: 18px;
                    border: 1px solid rgba(255,208,117,0.24);
                    background:
                        linear-gradient(140deg, rgba(124,75,255,0.22), rgba(97,126,255,0.10) 46%, rgba(255,186,111,0.18));
                    box-shadow:
                        inset 0 1px 0 rgba(255,255,255,0.12),
                        0 16px 32px rgba(30,18,66,0.30);
                    transition: transform 0.25s ease, box-shadow 0.25s ease;
                }
                .settings-account-balance:hover {
                    transform: translateY(-2px);
                    box-shadow:
                        inset 0 1px 0 rgba(255,255,255,0.14),
                        0 20px 40px rgba(30,18,66,0.38);
                }
                .settings-account-balance.is-idle {
                    border-color: rgba(120,150,255,0.16);
                    background: rgba(120,150,255,0.06);
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
                }
                .settings-account-balance-glow {
                    position: absolute;
                    inset: -55% 30% auto -25%;
                    height: 150px;
                    background: radial-gradient(closest-side, rgba(255,208,117,0.38), transparent 70%);
                    filter: blur(4px);
                    pointer-events: none;
                }
                .settings-account-balance.is-idle .settings-account-balance-glow { opacity: 0; }
                .settings-account-balance-label {
                    position: relative;
                    font-size: 10.5px;
                    letter-spacing: 0.2em;
                    text-transform: uppercase;
                    font-weight: 700;
                    color: rgba(255,236,192,0.88);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .settings-account-balance-label::before {
                    content: "";
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #ffd06f;
                    box-shadow: 0 0 10px rgba(255,208,117,0.85);
                }
                .settings-account-balance.is-idle .settings-account-balance-label { color: rgba(190,205,240,0.72); }
                .settings-account-balance.is-idle .settings-account-balance-label::before {
                    background: rgba(160,180,220,0.5);
                    box-shadow: none;
                }
                .settings-account-balance-amount {
                    position: relative;
                    margin-top: 9px;
                    font-size: 30px;
                    font-weight: 800;
                    line-height: 1;
                    color: #fff7ea;
                    letter-spacing: 0.01em;
                }
                .settings-account-balance-amount span {
                    margin-left: 6px;
                    font-size: 12.5px;
                    font-weight: 700;
                    color: rgba(255,236,192,0.78);
                    letter-spacing: 0.14em;
                }
                .settings-account-balance.is-idle .settings-account-balance-amount { color: #eaf0ff; }
                .settings-account-balance-sub {
                    position: relative;
                    margin-top: 9px;
                    font-size: 11px;
                    color: rgba(226,232,248,0.74);
                    line-height: 1.45;
                    max-width: 220px;
                }
                .settings-account-summary {
                    position: relative;
                    z-index: 1;
                    margin-top: 22px;
                    padding-top: 18px;
                    border-top: 1px solid rgba(255,255,255,0.06);
                }
                .settings-account-summary-title {
                    font-size: 16px;
                    font-weight: 700;
                    color: #f8fbff;
                }
                .settings-account-summary-copy {
                    margin: 10px 0 0;
                    max-width: 760px;
                    font-size: 12.5px;
                    line-height: 1.65;
                    color: rgba(210,220,241,0.66);
                }
                .settings-account-stat-grid {
                    position: relative;
                    z-index: 1;
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
                    gap: 12px;
                    margin-top: 18px;
                }
                .settings-account-stat {
                    padding: 15px 16px;
                    border-radius: 20px;
                    background: rgba(8, 12, 22, 0.42);
                    border: 1px solid rgba(255,255,255,0.06);
                    backdrop-filter: blur(12px);
                }
                .settings-account-stat span,
                .settings-account-row span,
                .settings-account-usage-meta span {
                    display: block;
                    color: rgba(185, 201, 232, 0.64);
                    font-size: 11px;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                }
                .settings-account-stat strong,
                .settings-account-row strong {
                    display: block;
                    margin-top: 8px;
                    color: #f9fbff;
                    font-size: 17px;
                    font-weight: 700;
                    line-height: 1.2;
                }
                .settings-account-stat small,
                .settings-account-row small {
                    display: block;
                    margin-top: 6px;
                    color: rgba(205, 220, 247, 0.62);
                    font-size: 12px;
                    line-height: 1.4;
                }
                .settings-account-grid {
                    display: grid;
                    grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.95fr);
                    gap: 16px;
                }
                .settings-account-panel {
                    border-radius: 24px;
                    padding: 20px;
                    background: linear-gradient(180deg, rgba(12,16,28,0.90), rgba(7,10,19,0.94));
                    border: 1px solid rgba(255,255,255,0.07);
                    box-shadow: 0 14px 30px rgba(0,0,0,0.14);
                }
                .settings-account-panel-head {
                    display: flex;
                    justify-content: space-between;
                    align-items: baseline;
                    gap: 12px;
                    margin-bottom: 12px;
                }
                .settings-account-panel-title {
                    font-size: 15px;
                    font-weight: 700;
                    color: #f8fbff;
                }
                .settings-account-panel-copy {
                    color: rgba(182, 198, 228, 0.54);
                    font-size: 11.5px;
                }
                .settings-account-usage-list {
                    display: grid;
                    gap: 14px;
                }
                .settings-account-usage-card {
                    padding: 16px;
                    border-radius: 20px;
                    background: rgba(255,255,255,0.025);
                    border: 1px solid rgba(255,255,255,0.05);
                }
                .settings-account-usage-meta {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 12px;
                }
                .settings-account-usage-meta strong {
                    display: block;
                    color: #f9fbff;
                    font-size: 16px;
                    font-weight: 700;
                }
                .settings-account-usage-meta em {
                    color: #c9defd;
                    font-style: normal;
                    font-size: 18px;
                    font-weight: 700;
                }
                .settings-account-usage-bar {
                    height: 8px;
                    margin-top: 14px;
                    border-radius: 999px;
                    overflow: hidden;
                    background: rgba(255,255,255,0.05);
                }
                .settings-account-usage-fill {
                    display: block;
                    height: 100%;
                    border-radius: inherit;
                    background: linear-gradient(90deg, #68c9ff, #7f73ff 56%, #f2c06b);
                    box-shadow: 0 0 16px rgba(91,123,255,0.22);
                }
                .settings-account-usage-note {
                    margin-top: 12px;
                    font-size: 11.5px;
                    line-height: 1.55;
                    color: rgba(203, 219, 245, 0.60);
                }
                .settings-account-timeline {
                    display: grid;
                    gap: 10px;
                }
                .settings-account-row {
                    padding: 15px 16px;
                    border-radius: 18px;
                    background: rgba(255,255,255,0.025);
                    border: 1px solid rgba(255,255,255,0.05);
                }
                .settings-account-empty {
                    display: grid;
                    gap: 14px;
                }
                .settings-account-empty-card {
                    border-radius: 22px;
                    padding: 22px;
                    background:
                        radial-gradient(circle at 16% 16%, rgba(91,123,255,0.16), transparent 26%),
                        linear-gradient(180deg, rgba(14,19,33,0.96), rgba(8,11,20,0.98));
                    border: 1px solid rgba(136, 164, 255, 0.16);
                }
                .settings-account-empty-badge {
                    display: inline-flex;
                    align-items: center;
                    padding: 6px 12px;
                    border-radius: 999px;
                    border: 1px solid rgba(255,255,255,0.10);
                    background: rgba(255,255,255,0.05);
                    color: rgba(220,231,255,0.82);
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                }
                .settings-account-empty h3 {
                    margin: 12px 0 0;
                    font-size: 24px;
                    line-height: 1.1;
                }
                .settings-account-empty p {
                    margin: 8px 0 0;
                    max-width: 640px;
                    color: rgba(221,232,255,0.72);
                    line-height: 1.55;
                    font-size: 13px;
                }
                .settings-account-form-card {
                    padding: 18px;
                    border-radius: 20px;
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.06);
                }

                .settings-card {
                    border-radius: 20px;
                    padding: 18px;
                    margin-bottom: 14px;
                }
                .settings-card-featured {
                    background:
                        radial-gradient(circle at 14% 18%, rgba(255,255,255,0.09) 0%, transparent 28%),
                        radial-gradient(circle at 82% 20%, rgba(255, 77, 184, 0.10) 0%, transparent 26%),
                        linear-gradient(180deg, rgba(26,30,42,0.96), rgba(13,16,25,0.92));
                    border: 1px solid rgba(255, 215, 130, 0.20);
                    box-shadow:
                        0 22px 50px rgba(0,0,0,0.26),
                        inset 0 1px 0 rgba(255,255,255,0.05);
                }
                .settings-card-muted {
                    background: linear-gradient(180deg, rgba(17,21,31,0.84), rgba(9,12,20,0.80));
                    border: 1px solid rgba(255,255,255,0.08);
                    box-shadow: 0 20px 40px rgba(0,0,0,0.18);
                }
                .settings-card-launch {
                    position: relative;
                    overflow: hidden;
                    background:
                        radial-gradient(circle at top right, rgba(255,219,116,0.26), transparent 34%),
                        radial-gradient(circle at bottom left, rgba(76,172,255,0.18), transparent 32%),
                        linear-gradient(180deg, rgba(27,31,44,0.98), rgba(13,17,27,0.94));
                    border: 1px solid rgba(255,219,116,0.32);
                    box-shadow:
                        0 26px 56px rgba(0,0,0,0.28),
                        inset 0 1px 0 rgba(255,255,255,0.06);
                }
                .settings-card-launch::after {
                    content: '';
                    position: absolute;
                    right: -60px;
                    bottom: -80px;
                    width: 220px;
                    height: 220px;
                    border-radius: 50%;
                    background: radial-gradient(circle, rgba(255,219,116,0.18), transparent 68%);
                    pointer-events: none;
                }
                .settings-launch-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 12px;
                    border-radius: 999px;
                    margin-bottom: 14px;
                    background: rgba(255,219,116,0.12);
                    border: 1px solid rgba(255,219,116,0.26);
                    color: #ffe19a;
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                }
                .settings-launch-head {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 16px;
                    margin-bottom: 10px;
                }
                .settings-launch-mark {
                    padding: 10px 14px;
                    border-radius: 14px;
                    background: linear-gradient(135deg, rgba(255,219,116,0.18), rgba(90,164,255,0.12));
                    border: 1px solid rgba(255,255,255,0.10);
                    color: #fff4c5;
                    font-size: 12px;
                    font-weight: 700;
                    white-space: nowrap;
                }
                .settings-card-head {
                    display: flex; align-items: flex-start;
                    justify-content: space-between; gap: 16px;
                    margin-bottom: 10px;
                }
                .settings-card-title {
                    font-size: 18px; font-weight: 700; margin-bottom: 4px;
                }
                .settings-card-subtitle {
                    color: rgba(226,232,240,0.72);
                    font-size: 13px; line-height: 1.45;
                }

                .settings-info-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 6px 24px;
                    margin-top: 10px;
                }
                .settings-info-row {
                    display: flex; justify-content: space-between;
                    gap: 12px; padding: 8px 0;
                    border-bottom: 1px dashed rgba(255,255,255,0.06);
                    font-size: 13px;
                }
                .settings-info-row:last-child { border-bottom: 0; }
                .settings-info-row span { color: rgba(226,232,240,0.66); }
                .settings-info-row strong {
                    color: #fff; font-weight: 600;
                    text-align: right; overflow-wrap: anywhere;
                }

                .settings-list {
                    margin: 8px 0 0; padding-left: 18px;
                    color: rgba(226,232,240,0.84);
                    line-height: 1.6; font-size: 13px;
                }
                .settings-list li { margin-bottom: 6px; }
                .settings-list strong { color: #ffd98a; }

                .settings-actions { display: flex; gap: 10px; flex-wrap: wrap; }
                .settings-btn {
                    border: 1px solid rgba(255,255,255,0.10);
                    background: rgba(255,255,255,0.05);
                    color: #fff; border-radius: 12px;
                    padding: 10px 14px; cursor: pointer;
                    font-size: 13px;
                }
                .settings-btn:hover { background: rgba(255,255,255,0.08); }
                .settings-btn-primary {
                    background: linear-gradient(135deg, #ff4db8, #8b5cf6);
                    border-color: transparent;
                }

                .settings-wallpaper-preview {
                    position: relative;
                    min-height: 180px;
                    border-radius: 18px;
                    overflow: hidden;
                    margin-top: 14px;
                    border: 1px solid rgba(255,255,255,0.08);
                }
                .settings-wallpaper-overlay {
                    position: absolute;
                    left: 12px; right: 12px; bottom: 12px;
                    display: flex; flex-direction: column; gap: 4px;
                    padding: 12px 14px; border-radius: 14px;
                    background: linear-gradient(180deg, rgba(10,12,18,0.20), rgba(10,12,18,0.48));
                    backdrop-filter: blur(10px);
                }
                .settings-wallpaper-overlay strong { font-size: 16px; }
                .settings-wallpaper-overlay span {
                    color: rgba(255,255,255,0.82); font-size: 12px;
                }
                .settings-wallpaper-badge {
                    align-self: flex-start;
                    padding: 4px 10px;
                    background: rgba(255,255,255,0.14);
                    border: 1px solid rgba(255,255,255,0.18);
                    border-radius: 999px;
                    font-size: 10px; letter-spacing: 0.1em;
                    text-transform: uppercase;
                }
                .settings-status {
                    margin-top: 10px;
                    font-size: 12px;
                    color: rgba(226,232,240,0.72);
                }
                .settings-status.is-error { color: #fda4af; }

                .settings-klave-card {
                    overflow: hidden;
                    position: relative;
                }
                .settings-klave-card::before {
                    content: "";
                    position: absolute;
                    right: -90px;
                    top: -110px;
                    width: 260px;
                    height: 260px;
                    border-radius: 50%;
                    background: radial-gradient(circle, rgba(56,189,248,0.24), transparent 68%);
                    pointer-events: none;
                }
                .settings-klave-mark {
                    width: 54px;
                    height: 54px;
                    border-radius: 18px;
                    display: grid;
                    place-items: center;
                    color: #d7f5ff;
                    font-size: 24px;
                    font-weight: 900;
                    background: linear-gradient(145deg, rgba(17,63,101,0.96), rgba(7,18,40,0.98));
                    border: 1px solid rgba(118,216,255,0.30);
                    box-shadow: 0 0 28px rgba(55,179,255,0.22), inset 0 1px 0 rgba(255,255,255,0.14);
                    flex: 0 0 auto;
                }
                .settings-klave-control {
                    position: relative;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 18px;
                    margin-top: 18px;
                    padding: 16px;
                    border-radius: 18px;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.08);
                }
                .settings-klave-state {
                    font-size: 16px;
                    font-weight: 800;
                    color: #f8fbff;
                    margin-bottom: 4px;
                }
                .settings-klave-copy {
                    font-size: 12.5px;
                    max-width: 560px;
                }
                .settings-klave-switch {
                    width: 68px;
                    height: 38px;
                    padding: 3px;
                    border: 1px solid rgba(255,255,255,0.12);
                    border-radius: 999px;
                    background: rgba(255,255,255,0.08);
                    cursor: pointer;
                    transition: background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
                    flex: 0 0 auto;
                }
                .settings-klave-switch-knob {
                    display: block;
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    background: #dbeafe;
                    box-shadow: 0 8px 18px rgba(0,0,0,0.28);
                    transition: transform 0.18s ease, background 0.18s ease;
                }
                .settings-klave-switch.is-on {
                    background: linear-gradient(135deg, #1fb6ff, #6d5bff);
                    border-color: rgba(160,220,255,0.34);
                    box-shadow: 0 0 24px rgba(31,182,255,0.22);
                }
                .settings-klave-switch.is-on .settings-klave-switch-knob {
                    transform: translateX(30px);
                    background: #ffffff;
                }
                .settings-klave-actions {
                    position: relative;
                    margin-top: 14px;
                }

                .settings-preset-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
                    gap: 12px;
                    margin-top: 14px;
                }
                .settings-preset {
                    border: 1px solid rgba(255,255,255,0.08);
                    background: rgba(255,255,255,0.03);
                    border-radius: 16px;
                    padding: 10px;
                    color: #fff;
                    text-align: left;
                    cursor: pointer;
                }
                .settings-preset.is-active {
                    border-color: rgba(255, 215, 130, 0.72);
                    box-shadow: 0 0 0 1px rgba(255, 215, 130, 0.35);
                }
                .settings-preset-swatch {
                    display: block;
                    width: 100%;
                    aspect-ratio: 1.45;
                    border-radius: 12px;
                    margin-bottom: 10px;
                    border: 1px solid rgba(255,255,255,0.14);
                    background-size: cover;
                    background-position: center;
                }
                .settings-preset-name { display: block; font-weight: 700; margin-bottom: 2px; }
                .settings-preset-meta { display: block; color: rgba(226,232,240,0.66); font-size: 11px; }

                .settings-sec-summary {
                    margin: 10px 0 14px;
                    font-size: 13px;
                    color: rgba(226,232,240,0.82);
                }
                .settings-sec-list {
                    display: grid; gap: 8px;
                }
                .settings-sec-item {
                    display: grid;
                    grid-template-columns: 28px 1fr;
                    gap: 10px;
                    padding: 12px 14px;
                    border-radius: 12px;
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.06);
                }
                .settings-sec-item strong { display: block; margin-bottom: 2px; font-size: 13px; }
                .settings-sec-item .settings-sec-detail {
                    color: rgba(226,232,240,0.72); font-size: 12px; line-height: 1.5;
                }
                .settings-sec-dot {
                    width: 14px; height: 14px; border-radius: 50%;
                    margin-top: 3px;
                    background: #16a34a;
                    box-shadow: 0 0 0 4px rgba(22, 163, 74, 0.18);
                }
                .settings-sec-item.is-bad .settings-sec-dot {
                    background: #f87171;
                    box-shadow: 0 0 0 4px rgba(248, 113, 113, 0.18);
                }

                .settings-doc-section { margin-top: 16px; }
                .settings-doc-section h3 {
                    font-size: 14px;
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                    margin: 0 0 6px;
                    color: #ffd98a;
                }
                .settings-doc-footer {
                    margin-top: 18px;
                    font-size: 11px;
                    letter-spacing: 0.14em;
                    text-transform: uppercase;
                    color: rgba(226,232,240,0.52);
                    text-align: right;
                }

                @media (max-width: 720px) {
                    .settings-hero,
                    .settings-card-head { flex-direction: column; align-items: stretch; }
                    .settings-launch-head { flex-direction: column; align-items: stretch; }
                    .settings-launch-mark { white-space: normal; }
                    .settings-preset-grid { grid-template-columns: 1fr; }
                    .settings-account-grid { grid-template-columns: 1fr; }
                    .settings-account-side { justify-items: stretch; }
                    .settings-account-name { font-size: 21px; }
                    .settings-account-panel-head {
                        flex-direction: column;
                        align-items: flex-start;
                    }
                }
                </style>
            `;

            this.bind(container).catch((error) => {
                const status = container.querySelector('[data-wallpaper-status]');
                if (status) {
                    status.textContent = error.message || 'No pude cargar el panel.';
                    status.classList.add('is-error');
                }
            });
        },

        cleanup() {
            if (this._wallpaperListener) {
                window.removeEventListener('lth:wallpaper-change', this._wallpaperListener);
                this._wallpaperListener = null;
            }
            if (this._klaveListener) {
                window.removeEventListener('klave:state-change', this._klaveListener);
                this._klaveListener = null;
            }
            if (this._accountUnsub) {
                try { this._accountUnsub(); } catch (_) {}
                this._accountUnsub = null;
            }
        },

        async bind(container) {
            // Tabs
            const tabButtons = container.querySelectorAll('[data-tab]');
            const panels = container.querySelectorAll('[data-panel]');
            tabButtons.forEach((btn) => {
                btn.addEventListener('click', () => {
                    const target = btn.dataset.tab;
                    tabButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
                    panels.forEach((p) => p.classList.toggle('is-active', p.dataset.panel === target));
                });
            });

            // La tarjeta de usuario del pie NO es una pestana: usa data-goto-tab
            // y pulsa la pestana real. Si llevara data-tab, el bucle de arriba la
            // marcaria como activa y apagaria "Cuenta" en la lista.
            container.querySelectorAll('[data-goto-tab]').forEach((atajo) => {
                atajo.addEventListener('click', () => {
                    const destino = atajo.dataset.gotoTab;
                    container.querySelector(`.settings-tab[data-tab="${destino}"]`)?.click();
                });
            });

            // System info
            this.loadSystemInfo(container);

            // Account / identidad OS-wide
            await this.bindAccount(container);

            // Assistant
            this.bindKlaveAssistant(container);

            // Wallpaper
            await this.bindWallpaper(container);

            // Security inspection (lazy, but run once at open)
            this.refreshSecurity(container);
            container.querySelector('[data-action="run-security"]')?.addEventListener('click', () => {
                this.refreshSecurity(container);
            });
        },

        clampAccountPercent(value) {
            return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
        },

        formatAccountDate(value, { withTime = true, empty = 'Sin fecha' } = {}) {
            if (!value) return empty;
            try {
                const date = new Date(value);
                if (Number.isNaN(date.getTime())) return empty;
                return date.toLocaleString('es-MX', withTime
                    ? { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
                    : { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
            } catch (_) {
                return empty;
            }
        },

        formatAccountCountdown(seconds, empty = 'Sin dato') {
            if (seconds == null || !Number.isFinite(Number(seconds))) return empty;
            const total = Math.max(0, Math.floor(Number(seconds) || 0));
            if (total <= 0) return 'Ahora';
            const days = Math.floor(total / 86400);
            const hours = Math.floor((total % 86400) / 3600);
            const minutes = Math.floor((total % 3600) / 60);
            if (days > 0) return `${days} d ${hours} h`;
            if (hours > 0) return `${hours} h ${minutes} min`;
            return `${Math.max(1, minutes)} min`;
        },

        getAccountInitials(name, email) {
            const base = String(name || email || 'LTH').trim();
            const letters = base
                .split(/[\s@._-]+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part.charAt(0).toUpperCase())
                .join('');
            return letters || 'LT';
        },

        async bindAccount(container) {
            const auth = window.LTHAuth;
            const shellEl = container.querySelector('[data-account-shell]');
            const msgEl = container.querySelector('[data-account-msg]');
            if (!auth || !shellEl) {
                if (msgEl) { msgEl.hidden = false; msgEl.textContent = 'Puente de identidad no disponible en esta sesion.'; }
                return;
            }

            const setMsg = (text, isError) => {
                if (!msgEl) return;
                msgEl.hidden = !text;
                msgEl.textContent = text || '';
                msgEl.classList.toggle('is-error', Boolean(isError));
            };

            // La tarjeta del pie de la barra lateral refleja la misma cuenta que
            // el panel. Se actualiza desde aqui, en el unico sitio donde ya se
            // sabe si hay sesion: si viviera por su cuenta acabaria mintiendo.
            const pintarLateral = ({ nombre, plan, inicial }) => {
                const elNombre = container.querySelector('[data-side-name]');
                const elPlan = container.querySelector('[data-side-plan]');
                const elAvatar = container.querySelector('[data-side-avatar]');
                if (elNombre) elNombre.textContent = nombre;
                if (elPlan) elPlan.textContent = plan;
                if (elAvatar) elAvatar.textContent = inicial;
            };

            const paint = (state) => {
                const signed = !!state?.signedIn;
                if (!signed) {
                    pintarLateral({ nombre: 'Cuenta LTH', plan: 'Sin sesion', inicial: 'L' });
                    shellEl.innerHTML = `
                        <div class="settings-account-empty">
                            <div class="settings-account-empty-card">
                                <div class="settings-account-empty-badge">Sin sesion</div>
                                <h3>Necesitas iniciar sesion</h3>
                                <p>Inicia sesion para ver tu estado Pro, el uso semanal, la ventana activa y las fechas de renovacion dentro de LTH.OS.</p>
                            </div>
                            <div class="settings-account-form-card">
                                <div class="settings-card-subtitle">Tu cuenta compartida sincroniza LTH IA, LTH Prog y el panel de uso del sistema.</div>
                                <div class="settings-account-form">
                                    <input class="settings-account-input" data-account-email-input type="email" placeholder="Correo" autocomplete="username" spellcheck="false">
                                    <input class="settings-account-input" data-account-pass-input type="password" placeholder="Contrasena" autocomplete="current-password">
                                    <button class="settings-account-btn settings-account-btn--primary" data-action="account-signin" type="button">Entrar</button>
                                    <p class="settings-account-hint">Para crear una cuenta nueva, usa la pantalla de inicio de LTH.OS o abre LTH IA.</p>
                                </div>
                            </div>
                        </div>
                    `;
                    shellEl.querySelector('[data-action="account-signin"]')?.addEventListener('click', async (ev) => {
                        const btn = ev.currentTarget;
                        const email = shellEl.querySelector('[data-account-email-input]')?.value.trim();
                        const password = shellEl.querySelector('[data-account-pass-input]')?.value;
                        if (!email || !password) return setMsg('Escribe correo y contrasena.', true);
                        btn.disabled = true;
                        setMsg('Iniciando sesion...');
                        try {
                            const r = await auth.signIn({ email, password });
                            if (r?.signedIn || r?.success) setMsg('Sesion iniciada.');
                            else setMsg(r?.error || 'No se pudo iniciar sesion.', true);
                        } catch (e) {
                            setMsg(e?.message || 'No se pudo iniciar sesion.', true);
                        } finally {
                            btn.disabled = false;
                        }
                    });
                    return;
                }

                const credits = state?.credits || {};
                const name = state.profile?.display_name || state.profile?.email || state.user?.email || 'Usuario LTH';
                const email = state.profile?.email || state.user?.email || 'Sin correo';
                const plan = String(state.profile?.plan || credits.plan || 'free').trim().toLowerCase() || 'free';
                const hasPro = plan === 'pro' && state.profile?.plan_active === true;
                const windowHours = Math.max(1, Number(credits.window_hours || 4) || 4);
                const windowUsed = Number(credits.window_used_cents ?? credits.window_credits_used ?? 0) || 0;
                const windowLimit = Number(credits.window_budget_cents ?? credits.window_credits_limit ?? 0) || 0;
                const weeklyUsed = Number(credits.weekly_used_credits ?? 0) || 0;
                const weeklyLimit = Number(credits.weekly_credits ?? 0) || 0;
                const windowPercent = this.clampAccountPercent(
                    Number.isFinite(Number(credits.window_usage_percent))
                        ? Number(credits.window_usage_percent)
                        : (windowLimit > 0 ? (windowUsed / windowLimit) * 100 : 0)
                );
                const weeklyPercent = this.clampAccountPercent(
                    Number.isFinite(Number(credits.weekly_usage_percent))
                        ? Number(credits.weekly_usage_percent)
                        : (weeklyLimit > 0 ? (weeklyUsed / weeklyLimit) * 100 : 0)
                );
                const weeklyResetAt = credits.weekly_resets_at || credits.weekly_available_at || credits.cooldown_until || null;
                const weeklyCountdown = this.formatAccountCountdown(credits.weekly_seconds_until_reset, 'Sin dato semanal');
                const windowCountdown = this.formatAccountCountdown(credits.window_seconds_until_reset, 'Sin dato de ventana');
                const billingDate = this.formatAccountDate(credits.billing_period_end, {
                    withTime: false,
                    empty: hasPro ? 'Sin fecha de plan' : 'Sin plan Pro activo'
                });
                const giftBalance = Math.max(0, Number(credits.gift_credits_balance ?? 0) || 0);
                const giftDisplay = Number.isInteger(giftBalance) ? String(giftBalance) : giftBalance.toFixed(2);
                const giftActive = credits.gift_premium_access === true || giftBalance > 0;
                const giftExpiry = this.formatAccountDate(credits.gift_next_expires_at, {
                    withTime: true,
                    empty: giftActive ? 'Sin vencimiento' : 'Sin saldo activo'
                });
                const cloudLabel = credits.enabled === false
                    ? (credits.reason || 'Cloud sin configurar')
                    : (hasPro ? 'Suscripcion premium habilitada' : (giftActive ? 'Free con saldo activo' : 'Cuenta conectada'));

                pintarLateral({
                    nombre: name,
                    plan: hasPro ? 'Pro activo' : 'Plan free',
                    inicial: this.getAccountInitials(name, email)
                });

                shellEl.innerHTML = `
                    <div class="settings-account-state">
                        <div class="settings-account-hero">
                            <div class="settings-account-top">
                                <div class="settings-account-user">
                                    <div class="settings-account-avatar">${esc(this.getAccountInitials(name, email))}</div>
                                    <div>
                                        <div class="settings-account-kicker">Cuenta sincronizada en LTH.OS</div>
                                        <div class="settings-account-name">${esc(name)}</div>
                                        <div class="settings-account-meta">${esc(email)}</div>
                                    </div>
                                </div>
                                <div class="settings-account-right">
                                    <div class="settings-account-balance ${giftActive ? '' : 'is-idle'}">
                                        <div class="settings-account-balance-glow"></div>
                                        <div class="settings-account-balance-label">Saldo</div>
                                        <div class="settings-account-balance-amount">${esc(giftDisplay)}<span>CR</span></div>
                                        <div class="settings-account-balance-sub">${giftActive ? `Disponible en todos los modelos${credits.gift_next_expires_at ? ` · vence ${esc(giftExpiry)}` : ''}` : 'Sin saldo activo por ahora'}</div>
                                    </div>
                                    <div class="settings-account-side">
                                        <div class="settings-account-badge ${hasPro ? 'is-pro' : 'is-free'}">${hasPro ? 'Pro activo' : 'Plan free'}</div>
                                        <button class="settings-account-btn" data-action="account-signout" type="button">Cerrar sesion</button>
                                    </div>
                                </div>
                            </div>

                            <div class="settings-account-summary">
                                <div class="settings-account-summary-title">${hasPro ? 'Estado premium listo para trabajar' : 'Cuenta conectada en modo free'}</div>
                                <p class="settings-account-summary-copy">Vista profesional del plan, del consumo y de las fechas clave del usuario. Aqui puedes revisar la ventana activa, el reinicio semanal y el vencimiento del plan Pro sin abrir otra app.</p>
                            </div>

                            <div class="settings-account-stat-grid">
                                <div class="settings-account-stat">
                                    <span>Plan actual</span>
                                    <strong>${esc(hasPro ? 'LTH Pro' : plan.toUpperCase())}</strong>
                                    <small>${esc(cloudLabel)}</small>
                                </div>
                                <div class="settings-account-stat">
                                    <span>Ventana activa</span>
                                    <strong>${esc(windowCountdown)}</strong>
                                    <small>Se reinicia ${esc(this.formatAccountDate(credits.window_resets_at, { withTime: true, empty: 'sin fecha exacta' }))}</small>
                                </div>
                                <div class="settings-account-stat">
                                    <span>Reset semanal</span>
                                    <strong>${esc(this.formatAccountDate(weeklyResetAt, { withTime: false, empty: 'Sin fecha semanal' }))}</strong>
                                    <small>Faltan ${esc(weeklyCountdown)} para restablecer el uso</small>
                                </div>
                                <div class="settings-account-stat">
                                    <span>Vencimiento Pro</span>
                                    <strong>${esc(billingDate)}</strong>
                                    <small>${hasPro ? 'Fecha de cierre del ciclo Pro actual' : 'Activa Pro para ver una fecha de vencimiento'}</small>
                                </div>
                                <div class="settings-account-stat">
                                    <span>Saldo</span>
                                    <strong>${esc(giftDisplay)} CR</strong>
                                    <small>${giftActive ? `Usable en todos los modelos${credits.gift_next_expires_at ? ` · vence ${esc(giftExpiry)}` : ''}` : 'Sin saldo activo'}</small>
                                </div>
                            </div>
                        </div>

                        <div class="settings-account-grid">
                            <div class="settings-account-panel">
                                <div class="settings-account-panel-head">
                                    <div class="settings-account-panel-title">Uso actual</div>
                                    <div class="settings-account-panel-copy">Vista porcentual del consumo</div>
                                </div>
                                <div class="settings-account-usage-list">
                                    <div class="settings-account-usage-card">
                                        <div class="settings-account-usage-meta">
                                            <div>
                                                <span>Ventana ${esc(String(windowHours))}h</span>
                                                <strong>${esc(String(windowPercent))}% usado</strong>
                                            </div>
                                            <em>${esc(String(windowPercent))}%</em>
                                        </div>
                                        <div class="settings-account-usage-bar">
                                            <span class="settings-account-usage-fill" style="width:${windowPercent}%;"></span>
                                        </div>
                                        <div class="settings-account-usage-note">La ventana actual se reinicia en ${esc(windowCountdown)}.</div>
                                    </div>

                                    <div class="settings-account-usage-card">
                                        <div class="settings-account-usage-meta">
                                            <div>
                                                <span>Uso semanal</span>
                                                <strong>${esc(String(weeklyPercent))}% utilizado</strong>
                                            </div>
                                            <em>${esc(String(weeklyPercent))}%</em>
                                        </div>
                                        <div class="settings-account-usage-bar">
                                            <span class="settings-account-usage-fill" style="width:${weeklyPercent}%;"></span>
                                        </div>
                                        <div class="settings-account-usage-note">El ciclo semanal se restablece ${esc(this.formatAccountDate(weeklyResetAt, { withTime: true, empty: 'sin fecha semanal' }))}.</div>
                                    </div>

                                    <div class="settings-account-usage-card">
                                        <div class="settings-account-usage-meta">
                                            <div>
                                                <span>Saldo</span>
                                                <strong>${esc(giftDisplay)} creditos disponibles</strong>
                                            </div>
                                            <em>${giftActive ? 'Activo' : '0'}</em>
                                        </div>
                                        <div class="settings-account-usage-note">${giftActive ? `Saldo independiente del plan, usable en todos los modelos.${credits.gift_next_expires_at ? ` Proxima expiracion: ${esc(giftExpiry)}.` : ''}` : 'Este bolsillo es independiente del plan y aparece aqui cuando el admin te regala saldo.'}</div>
                                    </div>
                                </div>
                            </div>

                            <div class="settings-account-panel">
                                <div class="settings-account-panel-head">
                                    <div class="settings-account-panel-title">Fechas y estado</div>
                                    <div class="settings-account-panel-copy">Resumen operativo del usuario</div>
                                </div>
                                <div class="settings-account-timeline">
                                    <div class="settings-account-row">
                                        <span>Estado de sesion</span>
                                        <strong>Activa</strong>
                                        <small>La cuenta ya esta conectada y compartida con las apps del sistema.</small>
                                    </div>
                                    <div class="settings-account-row">
                                        <span>Plan visible</span>
                                        <strong>${esc(hasPro ? 'Usuario Pro' : 'Usuario Free')}</strong>
                                        <small>${esc(hasPro ? 'El plan premium esta habilitado para esta cuenta.' : 'No hay plan premium activo en este momento.')}</small>
                                    </div>
                                    <div class="settings-account-row">
                                        <span>Saldo</span>
                                        <strong>${esc(giftActive ? 'Saldo activo' : 'Sin saldo')}</strong>
                                        <small>${esc(giftActive ? `${giftDisplay} creditos disponibles, usables en todos los modelos.${credits.gift_next_expires_at ? ` Proxima expiracion: ${giftExpiry}` : ''}` : 'Si el admin te regala saldo, aqui veras el total exacto y su vencimiento.')}</small>
                                    </div>
                                    <div class="settings-account-row">
                                        <span>Reinicio de ventana</span>
                                        <strong>${esc(windowCountdown)}</strong>
                                        <small>${esc(this.formatAccountDate(credits.window_resets_at, { withTime: true, empty: 'Sin fecha exacta de reinicio' }))}</small>
                                    </div>
                                    <div class="settings-account-row">
                                        <span>Restablecimiento semanal</span>
                                        <strong>${esc(this.formatAccountDate(weeklyResetAt, { withTime: false, empty: 'Sin fecha semanal' }))}</strong>
                                        <small>${esc(this.formatAccountDate(weeklyResetAt, { withTime: true, empty: 'Sin fecha semanal detallada' }))}</small>
                                    </div>
                                    <div class="settings-account-row">
                                        <span>Vence el plan Pro</span>
                                        <strong>${esc(billingDate)}</strong>
                                        <small>${hasPro ? 'El siguiente cobro o renovacion debe tomar esta fecha como referencia.' : 'Cuando el usuario tenga Pro, aqui apareceran la fecha y el ciclo.'}</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                shellEl.querySelector('[data-action="account-signout"]')?.addEventListener('click', async (ev) => {
                    const btn = ev.currentTarget;
                    // Cerrar sesion desvincula esta PC de la cuenta, asi que hay
                    // que decir la consecuencia real antes, no un "¿seguro?".
                    const aceptado = confirm(
                        'CERRAR SESION EN ESTA PC\n\n'
                        + 'Esta maquina es tu equipo principal: aqui vive tu cuenta y tu forma de trabajar.\n\n'
                        + 'Que va a pasar:\n'
                        + '  - Esta PC deja de estar vinculada a tu cuenta.\n'
                        + '  - LTH Remote se desconecta del telefono.\n'
                        + '  - Tu nube privada se cierra y deja de verse.\n\n'
                        + 'Que NO pasa:\n'
                        + '  - Tus archivos de la nube NO se borran ni se pierden. Siguen cifrados\n'
                        + '    en este equipo y vuelven a abrirse al iniciar sesion de nuevo.\n\n'
                        + 'Para volver a entrar necesitaras tu contrasena y, si tienes un telefono\n'
                        + 'vinculado, un codigo de 8 digitos generado en el.\n\n'
                        + '¿Cerrar sesion?'
                    );
                    if (!aceptado) return;

                    btn.disabled = true;
                    setMsg('Cerrando sesion y desvinculando esta PC...');
                    try {
                        const r = await auth.signOut();
                        if (r?.unlinkError) {
                            // La sesion local si se cerro; solo fallo avisar al servidor.
                            setMsg('Sesion cerrada. Esta PC se desvinculara cuando haya conexion.');
                        } else if (r?.unlinked) {
                            setMsg('Sesion cerrada y PC desvinculada.');
                        } else {
                            setMsg('Sesion cerrada.');
                        }
                    } catch (e) {
                        setMsg(e?.message || 'No se pudo cerrar sesion.', true);
                    } finally {
                        btn.disabled = false;
                    }
                });
            };

            if (this._accountUnsub) { try { this._accountUnsub(); } catch (_) {} }
            this._accountUnsub = auth.onChange(paint);
            paint(await auth.getState());
        },

        async loadSystemInfo(container) {
            const set = (sel, val) => {
                const el = container.querySelector(sel);
                if (el) el.textContent = val || 'â€”';
            };

            try {
                if (window.electron?.system?.getInfo) {
                    const res = await window.electron.system.getInfo();
                    if (res?.success && res.info) {
                        set('[data-info-platform]', `${res.info.platform} (${res.info.arch})`);
                        set('[data-info-node]', res.info.nodeVersion);
                        set('[data-info-chrome]', res.info.chromeVersion);
                        set('[data-info-electron]', res.info.electronVersion);
                    }
                }
                if (window.electron?.storage?.getPaths) {
                    const res = await window.electron.storage.getPaths();
                    if (res?.success && res.paths?.data) {
                        set('[data-info-data]', res.paths.data);
                    }
                }
            } catch (_) {}
        },

        async bindWallpaper(container) {
            const wallpaper = window.LTH_WALLPAPER;
            if (!wallpaper) return;

            const grid = container.querySelector('[data-wallpaper-grid]');
            const preview = container.querySelector('[data-wallpaper-preview]');
            const source = container.querySelector('[data-wallpaper-source]');
            const mode = container.querySelector('[data-wallpaper-mode]');
            const status = container.querySelector('[data-wallpaper-status]');
            const input = container.querySelector('[data-wallpaper-input]');
            const uploadBtn = container.querySelector('[data-action="upload"]');
            const resetBtn = container.querySelector('[data-action="reset"]');

            const presets = wallpaper.getPresets();
            grid.innerHTML = presets.map((preset) => `
                <button class="settings-preset" type="button" data-preset="${esc(preset.id)}">
                    <span class="settings-preset-swatch" style="background:${preset.background}"></span>
                    <span class="settings-preset-name">${esc(preset.name)}</span>
                    <span class="settings-preset-meta">Preset integrado</span>
                </button>
            `).join('');

            const updateStatus = (message, isError) => {
                status.textContent = message;
                status.classList.toggle('is-error', Boolean(isError));
            };

            const paintPreview = (state) => {
                const activePreset = presets.find((p) => p.id === state.presetId) || presets[0];

                if (state.mode === 'image' && state.imageDataUrl) {
                    preview.style.background = `linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.05)), url("${state.imageDataUrl}")`;
                    preview.style.backgroundSize = 'cover, cover';
                    preview.style.backgroundPosition = 'center, center';
                    preview.style.backgroundRepeat = 'no-repeat, no-repeat';
                    source.textContent = state.imageName || 'Imagen personalizada';
                    mode.textContent = 'Imagen';
                } else if (state.mode === 'system') {
                    preview.style.background = 'linear-gradient(180deg, rgba(4,10,24,0.12), rgba(4,10,24,0.30)), url("../assets/fondo%20de%20pantallas/fondo-2.4.5.png")';
                    preview.style.backgroundSize = 'cover, cover';
                    preview.style.backgroundPosition = 'center, center';
                    preview.style.backgroundRepeat = 'no-repeat, no-repeat';
                    source.textContent = 'Fondo oficial Motor 2.4.5';
                    mode.textContent = 'Sistema';
                } else {
                    preview.style.background = activePreset.background;
                    preview.style.backgroundSize = '';
                    preview.style.backgroundPosition = '';
                    preview.style.backgroundRepeat = '';
                    source.textContent = activePreset.name;
                    mode.textContent = 'Preset';
                }

                grid.querySelectorAll('[data-preset]').forEach((button) => {
                    button.classList.toggle('is-active', button.dataset.preset === state.presetId && state.mode === 'preset');
                });
            };

            const applyState = () => paintPreview(wallpaper.getState());

            grid.addEventListener('click', async (event) => {
                const button = event.target.closest('[data-preset]');
                if (!button) return;

                updateStatus('Aplicando preset...', false);
                await wallpaper.setPreset(button.dataset.preset);
                applyState();
                updateStatus('Preset aplicado al escritorio.', false);
            });

            uploadBtn?.addEventListener('click', () => input.click());

            input?.addEventListener('change', async () => {
                const file = input.files && input.files[0];
                if (!file) return;
                try {
                    updateStatus('Cargando imagen...', false);
                    const imageDataUrl = await readImageAsDataUrl(file);
                    await wallpaper.setImage(imageDataUrl, file.name || 'Imagen personalizada');
                    applyState();
                    updateStatus('Imagen aplicada al escritorio.', false);
                } catch (error) {
                    updateStatus(error.message || 'No pude aplicar la imagen.', true);
                } finally {
                    input.value = '';
                }
            });

            resetBtn?.addEventListener('click', async () => {
                updateStatus('Volviendo al fondo base...', false);
                await wallpaper.reset();
                applyState();
                updateStatus('Fondo oficial del sistema activo.', false);
            });

            this._wallpaperListener = () => applyState();
            window.addEventListener('lth:wallpaper-change', this._wallpaperListener);
            applyState();
        },

        bindKlaveAssistant(container) {
            const assistant = window.KlaveAssistant;
            const toggle = container.querySelector('[data-action="toggle-klave"]');
            const openBtn = container.querySelector('[data-action="open-klave"]');
            const testBtn = container.querySelector('[data-action="test-klave"]');
            const stateEl = container.querySelector('[data-klave-state]');
            const copyEl = container.querySelector('[data-klave-copy]');
            const statusEl = container.querySelector('[data-klave-status]');
            const voiceToggle = container.querySelector('[data-action="toggle-klave-voice"]');
            const voiceStatusEl = container.querySelector('[data-settings-klave-voice-status]');
            const voiceModelEl = container.querySelector('[data-klave-voice-model]');
            const voiceAccessEl = container.querySelector('[data-klave-voice-access]');
            if (!toggle || !stateEl || !copyEl || !statusEl) return;
            let voiceStatus = null;

            const paint = () => {
                const enabled = Boolean(assistant?.getState?.().enabled);
                const voiceEnabled = Boolean(assistant?.getState?.().voiceProEnabled);
                toggle.classList.toggle('is-on', enabled);
                toggle.setAttribute('aria-checked', enabled ? 'true' : 'false');
                stateEl.textContent = enabled ? 'Klave esta activado' : 'Klave esta desactivado';
                copyEl.textContent = enabled
                    ? 'Klave esta ocupando el puesto central del dock. Al tocar la K, se abre la conversacion.'
                    : 'Activalo para que Klave sustituya el icono central de LTH y quede listo para conversar.';
                statusEl.textContent = enabled
                    ? 'Activo: Klave suplanta el centro del dock.'
                    : 'Desactivado: LTH vuelve a su puesto central.';
                if (voiceToggle) {
                    const voiceAllowed = Boolean(voiceStatus?.configured && voiceStatus?.hasProAccess);
                    voiceToggle.classList.toggle('is-on', voiceEnabled);
                    voiceToggle.setAttribute('aria-checked', voiceEnabled ? 'true' : 'false');
                    voiceToggle.disabled = !assistant || !voiceAllowed;
                }
                if (voiceModelEl) voiceModelEl.textContent = voiceStatus?.model || 'openai/gpt-audio-mini';
                if (voiceAccessEl) {
                    voiceAccessEl.textContent = voiceStatus?.hasProAccess ? 'Pro activo' : 'Solo Pro';
                }
                if (voiceStatusEl) {
                    if (!voiceStatus) {
                        voiceStatusEl.textContent = 'Revisando Klave Voz...';
                        voiceStatusEl.classList.remove('is-error');
                    } else if (!voiceStatus.signedIn) {
                        voiceStatusEl.textContent = 'Inicia sesion para activar la voz conversacional.';
                        voiceStatusEl.classList.add('is-error');
                    } else if (!voiceStatus.hasProAccess) {
                        voiceStatusEl.textContent = 'Disponible solo para usuarios Pro.';
                        voiceStatusEl.classList.add('is-error');
                    } else if (!voiceStatus.configured) {
                        voiceStatusEl.textContent = 'LTH IA Cloud no esta configurado para voz.';
                        voiceStatusEl.classList.add('is-error');
                    } else {
                        voiceStatusEl.textContent = voiceEnabled
                            ? 'Llamada de voz de Klave activa.'
                            : 'Lista para activar la conversacion continua de Klave.';
                        voiceStatusEl.classList.remove('is-error');
                    }
                }
                if (openBtn) openBtn.disabled = !assistant;
                if (testBtn) testBtn.disabled = !assistant;
            };

            if (!assistant) {
                toggle.disabled = true;
                if (openBtn) openBtn.disabled = true;
                if (testBtn) testBtn.disabled = true;
                stateEl.textContent = 'Klave no esta cargado';
                copyEl.textContent = 'El modulo del asistente no esta disponible en esta sesion.';
                statusEl.textContent = 'Reinicia LTH OS si acabas de actualizar.';
                return;
            }

            const refreshVoiceStatus = async () => {
                try {
                    if (!window.electron?.ai?.klaveVoiceStatus) {
                        voiceStatus = { success: false, configured: false, signedIn: false, hasProAccess: false, model: 'openai/gpt-audio-mini', error: 'Bridge Electron no disponible.' };
                    } else {
                        voiceStatus = await window.electron.ai.klaveVoiceStatus();
                    }
                } catch (e) {
                    voiceStatus = { success: false, configured: false, signedIn: window.LTHAuth?.isSignedIn?.(), hasProAccess: false, model: 'openai/gpt-audio-mini', error: e?.message || 'No se pudo verificar Klave Voz.' };
                }
                if (!(voiceStatus?.configured && voiceStatus?.hasProAccess) && assistant.getState?.().voiceProEnabled) {
                    assistant.setVoiceProEnabled?.(false);
                }
                paint();
            };

            toggle.addEventListener('click', () => {
                const enabled = Boolean(assistant.getState?.().enabled);
                assistant.setEnabled?.(!enabled);
                paint();
            });

            voiceToggle?.addEventListener('click', () => {
                const allowed = Boolean(voiceStatus?.configured && voiceStatus?.hasProAccess);
                if (!allowed) {
                    paint();
                    return;
                }
                const enabled = Boolean(assistant.getState?.().voiceProEnabled);
                assistant.setVoiceProEnabled?.(!enabled);
                if (!assistant.getState?.().enabled) assistant.setEnabled?.(true);
                paint();
            });

            openBtn?.addEventListener('click', () => {
                assistant.open?.();
            });

            testBtn?.addEventListener('click', () => {
                if (!assistant.getState?.().enabled) assistant.setEnabled?.(true);
                assistant.open?.();
                paint();
            });

            this._klaveListener = paint;
            window.addEventListener('klave:state-change', this._klaveListener);
            paint();
            refreshVoiceStatus();
        },

        async refreshSecurity(container) {
            const list = container.querySelector('[data-sec-list]');
            const summary = container.querySelector('[data-sec-summary]');
            if (!list || !summary) return;

            summary.textContent = 'Corriendo inspeccion...';
            list.innerHTML = '';

            const checks = await runSecurityInspection();
            const okCount = checks.filter((c) => c.ok).length;
            summary.textContent = `${okCount} de ${checks.length} comprobaciones pasan correctamente.`;

            list.innerHTML = checks.map((check) => `
                <div class="settings-sec-item ${check.ok ? '' : 'is-bad'}">
                    <span class="settings-sec-dot"></span>
                    <div>
                        <strong>${esc(check.label)}</strong>
                        <div class="settings-sec-detail">${esc(check.detail)}</div>
                    </div>
                </div>
            `).join('');
        }
    };
})();
