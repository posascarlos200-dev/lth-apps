// ===== LTH Bitcoin =====
// App de CONSUMO de las senales del motor Bitcoin. Es la version de escritorio
// de lo que el telefono ve en LTH Remote: misma fuente (canal central publico
// en Supabase), pero aprovechando la pantalla grande de una PC.
//
// Solo lectura. No publica, no liquida y no toca el historial: eso vive en
// LTH Bitcoin Admin, que sigue reservado a la PC administradora.
(function () {
  'use strict';

  window.LTH_APPS = window.LTH_APPS || {};

  const CFG = {
    pollMs: 3000,             // el motor late cada ~5 s; 3 s mantiene la UI viva
    marketPollMs: 15000,
    windowMs: 15 * 60 * 1000,
    // Los mismos 3 puntos de decision reales del motor rapido.
    decisionMinutes: [5, 7, 10],
    coinbaseCandles: 'https://api.coinbase.com/api/v3/brokerage/market/products/BTC-USD/candles',
    coinbaseSpot: 'https://api.coinbase.com/v2/prices/BTC-USD/spot',
    historyLimit: 60,
    pcOnlineMs: 50000,
  };

  const esc = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const fmtUSD = (value, decimals = 2) => (isFinite(Number(value))
    ? '$' + Number(value).toLocaleString('en-US', {
      minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    })
    : '--');

  const fmtClock = (value) => {
    const ms = typeof value === 'number' ? value : Date.parse(value || '');
    if (!isFinite(ms)) return '--:--';
    const date = new Date(ms);
    return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
  };

  const fmtCountdown = (ms) => {
    const total = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
    return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
  };

  const fmtAgo = (value) => {
    const ms = Date.parse(value || '');
    if (!isFinite(ms)) return '--';
    const diff = Math.max(0, Date.now() - ms);
    if (diff < 5000) return 'ahora';
    if (diff < 60000) return 'hace ' + Math.round(diff / 1000) + ' s';
    if (diff < 3600000) return 'hace ' + Math.round(diff / 60000) + ' min';
    return 'hace ' + Math.round(diff / 3600000) + ' h';
  };

  // El resultado de una senal: ganada, perdida o todavia en curso.
  function outcomeOf(row) {
    const status = String(row?.status || 'open').toLowerCase();
    if (status === 'won') return { key: 'won', label: 'GANADA', tone: 'win' };
    if (status === 'lost') return { key: 'lost', label: 'PERDIDA', tone: 'loss' };
    const closeMs = Date.parse(row?.window_close || '');
    if (isFinite(closeMs) && closeMs <= Date.now()) {
      return { key: 'settling', label: 'LIQUIDANDO', tone: 'pending' };
    }
    return { key: 'open', label: 'EN CURSO', tone: 'pending' };
  }

  function shortEngine(value) {
    const raw = String(value || '');
    const match = raw.match(/v\d+/i);
    return match ? match[0].toUpperCase() : (raw.slice(0, 14) || '--');
  }

  // ── Simulador de dinero ficticio ────────────────────────────────────────
  // Responde "cuanto habria ganado si hubiera entrado en cada senal".
  // Modela la apuesta binaria igual que el Admin: se compran contratos a un
  // precio en centavos y cada contrato ganador paga $1.00.
  //
  // El precio real de mercado no viaja en la senal, asi que se usa la propia
  // confianza del motor como valor justo (es su probabilidad estimada) mas un
  // centavo de spread, tal como hace estimateCoinbaseEntryCents en el Admin.
  // Es una estimacion honesta y se rotula como tal en la interfaz.
  const SIM = {
    entrySpreadCents: 1,
    feeRate: 0.006,        // mismo supuesto conservador que coinbasePaperFee
    minPriceCents: 2,
    maxPriceCents: 97,
  };

  function simEntryCents(confidence) {
    const fair = Math.max(50, Math.min(100, Number(confidence) || 50));
    return Math.max(SIM.minPriceCents, Math.min(SIM.maxPriceCents, fair + SIM.entrySpreadCents));
  }

  function simFee(notional) {
    return Math.ceil(Math.max(0, Number(notional) || 0) * SIM.feeRate * 100) / 100;
  }

  // Recalcula la simulacion completa desde cero en cada refresco: es una
  // funcion pura de (senales, config), asi que nunca puede desincronizarse
  // ni contar dos veces la misma vela.
  function runSimulation(signals, config) {
    const startingBalance = Math.max(1, Number(config?.startingBalance) || 100);
    const stakeSetting = Math.max(1, Number(config?.stake) || 10);
    const settled = (Array.isArray(signals) ? signals : [])
      .filter(row => ['won', 'lost'].includes(String(row?.status || '').toLowerCase()))
      .slice()
      .sort((a, b) => Date.parse(a.window_start || a.emitted_at || 0)
        - Date.parse(b.window_start || b.emitted_at || 0));

    let balance = startingBalance;
    let peak = startingBalance;
    let maxDrawdown = 0;
    let wins = 0;
    let losses = 0;
    let streak = 0;
    let bestStreak = 0;
    let worstStreak = 0;
    let totalFees = 0;
    const curve = [{ t: null, balance }];
    const trades = [];

    for (const row of settled) {
      // Nunca se apuesta mas de lo que queda: el simulador puede quebrar,
      // igual que la cuenta real. La comision se cobra ADEMAS de la apuesta,
      // asi que hay que dejarle sitio o el saldo terminaria en negativo.
      let stake = Math.min(stakeSetting, balance);
      if (stake + simFee(stake) > balance) {
        stake = Math.floor((balance / (1 + SIM.feeRate)) * 100) / 100;
      }
      if (stake < 1) break;
      const priceCents = simEntryCents(row.confidence);
      const contracts = stake / (priceCents / 100);
      const fee = simFee(stake);
      const won = String(row.status).toLowerCase() === 'won';
      const payout = won ? contracts * 1 : 0;
      const net = payout - stake - fee;

      balance = Math.round((balance + net) * 100) / 100;
      totalFees = Math.round((totalFees + fee) * 100) / 100;
      if (won) { wins++; streak = streak > 0 ? streak + 1 : 1; }
      else { losses++; streak = streak < 0 ? streak - 1 : -1; }
      bestStreak = Math.max(bestStreak, streak);
      worstStreak = Math.min(worstStreak, streak);
      peak = Math.max(peak, balance);
      maxDrawdown = Math.max(maxDrawdown, peak - balance);

      const trade = {
        id: row.id,
        t: Date.parse(row.window_start || row.emitted_at || 0),
        direction: row.direction,
        confidence: Number(row.confidence) || 0,
        priceCents,
        stake,
        fee,
        won,
        net: Math.round(net * 100) / 100,
        balance,
      };
      trades.push(trade);
      curve.push({ t: trade.t, balance });
      if (balance < 1) break;
    }

    const total = wins + losses;
    const profit = Math.round((balance - startingBalance) * 100) / 100;
    // Punto de equilibrio: en una apuesta binaria comprada a P centavos hay que
    // acertar mas de P% de las veces para no perder (mas la comision). Es el
    // dato que explica por que acertar 60% con contratos caros aun pierde.
    const avgPriceCents = trades.length
      ? trades.reduce((sum, t) => sum + t.priceCents, 0) / trades.length
      : null;
    const breakEvenPct = avgPriceCents == null
      ? null
      : Math.min(99, avgPriceCents * (1 + SIM.feeRate));
    return {
      ready: total > 0,
      startingBalance,
      stake: stakeSetting,
      balance,
      profit,
      roiPct: startingBalance > 0 ? (profit / startingBalance) * 100 : 0,
      wins,
      losses,
      total,
      winRatePct: total ? (wins / total) * 100 : null,
      streak,
      bestStreak,
      worstStreak,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      totalFees,
      avgPriceCents,
      breakEvenPct,
      curve,
      trades,
      lastTrade: trades.length ? trades[trades.length - 1] : null,
      broke: balance < 1,
    };
  }

  window.LTH_APPS['lth-bitcoin'] = {
    name: 'LTH Bitcoin',
    version: '1.0.0',
    icon: '₿',
    gradient: 'linear-gradient(135deg,#f7931a 0%,#ffb347 55%,#ffd166 100%)',

    state: null,

    render(container) {
      this._closed = false;
      this.state = {
        stream: null,
        signals: [],
        statuses: [],
        market: { price: null, candles: [], at: 0 },
        link: null,        // diagnostico de por que no hay datos, si aplica
        loading: true,
        sim: this._loadSim(),
        simResult: null,
      };
      this._seenOutcomes = new Map();   // para detectar el momento exacto de una victoria
      this._celebrating = false;
      this._timers = [];
      this._buildDom(container);
      this._bind();
      this._refresh();
      this._loadMarket();
      this._timers.push(setInterval(() => this._refresh(), CFG.pollMs));
      this._timers.push(setInterval(() => this._loadMarket(), CFG.marketPollMs));
      this._timers.push(setInterval(() => this._paint(), 1000));

      // Igual que las demas apps: si el OS cambia de app sin llamar onClose(),
      // el abort corta los timers para no dejar sondeos huerfanos.
      this._abortHandler = () => this._cleanup();
      if (window._appSignal) {
        window._appSignal.addEventListener('abort', this._abortHandler, { once: true });
      }
    },

    onClose() { this._cleanup(); },

    _cleanup() {
      if (this._closed) return;
      this._closed = true;
      (this._timers || []).forEach(clearInterval);
      this._timers = [];
      if (this._abortHandler && window._appSignal) {
        window._appSignal.removeEventListener('abort', this._abortHandler);
      }
      this._abortHandler = null;
    },

    _$(selector) { return this._root ? this._root.querySelector(selector) : null; },

    _loadSim() {
      const fallback = { startingBalance: 100, stake: 10 };
      try {
        const raw = JSON.parse(localStorage.getItem('ltb.sim.v1') || 'null');
        if (!raw || typeof raw !== 'object') return fallback;
        return {
          startingBalance: Math.max(1, Number(raw.startingBalance) || fallback.startingBalance),
          stake: Math.max(1, Number(raw.stake) || fallback.stake),
        };
      } catch (error) { return fallback; }
    },

    _saveSim() {
      try { localStorage.setItem('ltb.sim.v1', JSON.stringify(this.state.sim)); }
      catch (error) { /* sin espacio: la simulacion sigue viva en memoria */ }
    },

    // Celebracion al ganar: solo se dispara cuando una senal PASA a ganada
    // estando la app abierta, nunca al recargar historial ya conocido.
    _detectWins(signals) {
      const first = !this._seenOutcomes.size;
      let justWon = null;
      for (const row of signals || []) {
        if (!row || row.id == null) continue;
        const key = String(row.id);
        const status = String(row.status || 'open').toLowerCase();
        const before = this._seenOutcomes.get(key);
        if (!first && before && before !== status && status === 'won') justWon = row;
        this._seenOutcomes.set(key, status);
      }
      if (justWon) this._celebrate(justWon);
    },

    _celebrate(signal) {
      if (this._celebrating || !this._root) return;
      const layer = this._$('#ltbCelebrate');
      if (!layer) return;
      this._celebrating = true;
      const profit = this.state.simResult && this.state.simResult.lastTrade
        ? this.state.simResult.lastTrade.net
        : null;
      const pieces = Array.from({ length: 46 }, () => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.5;
        const duration = 1.6 + Math.random() * 1.4;
        const hue = [46, 152, 200, 28][Math.floor(Math.random() * 4)];
        const size = 6 + Math.random() * 8;
        return '<i style="left:' + left.toFixed(2) + '%;animation-delay:' + delay.toFixed(2)
          + 's;animation-duration:' + duration.toFixed(2) + 's;background:hsl(' + hue + ',95%,62%);'
          + 'width:' + size.toFixed(0) + 'px;height:' + (size * 0.6).toFixed(0) + 'px;"></i>';
      }).join('');
      layer.innerHTML = '<div class="ltb-celebrate-burst">'
        + '<strong>&#10003; GANADA</strong>'
        + '<span>' + esc(signal.direction === 'UP' ? 'UP' : 'DOWN') + ' &middot; '
        + Math.round(Number(signal.confidence) || 0) + '% de confianza</span>'
        + (profit != null ? '<b>' + (profit >= 0 ? '+' : '') + fmtUSD(profit, 2) + '</b>' : '')
        + '</div><div class="ltb-confetti">' + pieces + '</div>';
      layer.hidden = false;
      layer.classList.add('show');
      setTimeout(() => {
        if (!this._root) return;
        layer.classList.remove('show');
        setTimeout(() => {
          if (layer) { layer.hidden = true; layer.innerHTML = ''; }
          this._celebrating = false;
        }, 600);
      }, 3200);
    },

    _buildDom(container) {
      container.innerHTML = `
<div class="ltb-root">
  <header class="ltb-top">
    <div class="ltb-brand">
      <span class="ltb-logo">&#8383;</span>
      <div>
        <h1>LTH Bitcoin</h1>
        <p id="ltbStreamName">Canal central</p>
      </div>
    </div>
    <div class="ltb-top-live">
      <div class="ltb-price">
        <span>BTC-USD</span>
        <strong id="ltbPrice">--</strong>
      </div>
      <div class="ltb-link" id="ltbLink">
        <i></i><span id="ltbLinkText">Conectando</span>
      </div>
    </div>
  </header>

  <div class="ltb-grid">
    <section class="ltb-col ltb-col-main">
      <article class="ltb-card ltb-signal" id="ltbSignalCard">
        <div class="ltb-card-head">
          <span class="ltb-eyebrow">SENAL DEL MOTOR</span>
          <span class="ltb-chip" id="ltbSignalTime">--:--</span>
        </div>
        <div class="ltb-signal-main">
          <div class="ltb-dir" id="ltbDir">
            <span class="ltb-dir-icon" id="ltbDirIcon">&#8645;</span>
            <div>
              <span class="ltb-dir-label" id="ltbDirLabel">ESPERANDO</span>
              <strong id="ltbDirText">Sin senal activa</strong>
            </div>
          </div>
          <div class="ltb-conf">
            <span>CONFIANZA</span>
            <strong id="ltbConfidence">--</strong>
            <div class="ltb-conf-track"><i id="ltbConfidenceBar"></i></div>
          </div>
        </div>
        <p class="ltb-signal-copy" id="ltbSignalCopy">Esperando la proxima indicacion del motor central.</p>
        <div class="ltb-signal-stats">
          <div><span>Cierre</span><strong id="ltbCloseTime">--:--</strong></div>
          <div><span>Faltan</span><strong id="ltbCountdown">--:--</strong></div>
          <div><span>Entrada BTC</span><strong id="ltbEntryPrice">--</strong></div>
          <div><span>Resultado</span><strong id="ltbResult">--</strong></div>
        </div>
      </article>

      <article class="ltb-card ltb-chart-card">
        <div class="ltb-card-head">
          <span class="ltb-eyebrow">VELA DE 15 MIN EN VIVO</span>
          <span class="ltb-chip" id="ltbChartNote">Coinbase BTC-USD</span>
        </div>
        <div class="ltb-chart" id="ltbChart"></div>
      </article>

      <article class="ltb-card ltb-clock-card">
        <div class="ltb-card-head">
          <span class="ltb-eyebrow">RELOJ DEL MOTOR</span>
          <span class="ltb-chip" id="ltbClockBadge">EN ESPERA</span>
        </div>
        <div class="ltb-clock">
          <div class="ltb-clock-dial">
            <svg viewBox="0 0 132 132" aria-hidden="true">
              <circle class="ltb-ring-track" cx="66" cy="66" r="56"></circle>
              <circle class="ltb-ring-fill" id="ltbRing" cx="66" cy="66" r="56"></circle>
            </svg>
            <div class="ltb-clock-read">
              <span id="ltbClockEyebrow">PROXIMA</span>
              <strong id="ltbClockValue">--:--</strong>
            </div>
          </div>
          <div class="ltb-clock-copy">
            <strong id="ltbClockTitle">Esperando la proxima indicacion</strong>
            <p id="ltbClockText">El motor evalua el primer bloque de 5 min de cada vela.</p>
          </div>
        </div>
      </article>
    </section>

    <section class="ltb-col ltb-col-side">
      <article class="ltb-card ltb-live" id="ltbLiveCard">
        <div class="ltb-card-head">
          <span class="ltb-eyebrow">ANALISIS EN VIVO</span>
          <span class="ltb-chip" id="ltbRegime">--</span>
        </div>
        <strong class="ltb-verdict" id="ltbVerdict">Construyendo la tesis</strong>
        <div class="ltb-risk" id="ltbRisk">
          <div class="ltb-risk-copy">
            <span>RIESGO DE RECHAZO</span>
            <strong id="ltbRiskValue">--%</strong>
          </div>
          <div class="ltb-risk-track"><i id="ltbRiskBar"></i></div>
          <small id="ltbRiskNote">Mide si la vela puede darse la vuelta antes del cierre.</small>
        </div>
        <p class="ltb-reasoning" id="ltbReasoning" hidden></p>
        <ul class="ltb-watch" id="ltbWatch" hidden></ul>
      </article>

      <article class="ltb-card ltb-specialists-card">
        <div class="ltb-card-head"><span class="ltb-eyebrow">ESPECIALISTAS</span></div>
        <div class="ltb-specialists" id="ltbSpecialists">
          <div class="ltb-empty">Sin datos todavia.</div>
        </div>
      </article>

      <article class="ltb-card ltb-phases-card">
        <div class="ltb-card-head"><span class="ltb-eyebrow">CAPAS DEL MOTOR</span></div>
        <div class="ltb-phases" id="ltbPhases">
          <div class="ltb-empty">Sin datos todavia.</div>
        </div>
      </article>
    </section>

    <section class="ltb-col ltb-col-history">
      <article class="ltb-card ltb-sim-card" id="ltbSimCard">
        <div class="ltb-card-head">
          <span class="ltb-eyebrow">SIMULADOR &middot; DINERO FICTICIO</span>
          <span class="ltb-chip" id="ltbSimTrades">0</span>
        </div>
        <div class="ltb-sim-balance">
          <span>SALDO SIMULADO</span>
          <strong id="ltbSimBalance">$100.00</strong>
          <em id="ltbSimProfit">--</em>
        </div>
        <div class="ltb-sim-curve" id="ltbSimCurve"></div>
        <div class="ltb-sim-inputs">
          <label>Capital inicial
            <span class="ltb-field"><i>$</i><input id="ltbSimCapital" type="number" min="1" step="10" value="100"></span>
          </label>
          <label>Por senal
            <span class="ltb-field"><i>$</i><input id="ltbSimStake" type="number" min="1" step="1" value="10"></span>
          </label>
        </div>
        <div class="ltb-sim-stats">
          <div><span>Aciertos</span><strong id="ltbSimWinRate">--</strong></div>
          <div><span>Racha</span><strong id="ltbSimStreak">--</strong></div>
          <div><span>Caida max.</span><strong id="ltbSimDrawdown">--</strong></div>
          <div><span>Equilibrio</span><strong id="ltbSimBreakEven">--</strong></div>
        </div>
        <p class="ltb-sim-note" id="ltbSimNote">Calcula cuanto habrias ganado siguiendo cada senal.</p>
      </article>

      <article class="ltb-card ltb-score-card">
        <div class="ltb-card-head"><span class="ltb-eyebrow">RENDIMIENTO</span></div>
        <div class="ltb-score">
          <div class="win"><span id="ltbWon">0</span><small>ganadas</small></div>
          <div class="loss"><span id="ltbLost">0</span><small>perdidas</small></div>
          <div class="rate"><span id="ltbRate">--</span><small>acierto</small></div>
        </div>
        <div class="ltb-score-bar"><i id="ltbScoreBar"></i></div>
      </article>

      <article class="ltb-card ltb-history-card">
        <div class="ltb-card-head">
          <span class="ltb-eyebrow">HISTORIAL</span>
          <span class="ltb-chip" id="ltbHistoryCount">0</span>
        </div>
        <div class="ltb-history" id="ltbHistory">
          <div class="ltb-empty">Sin entradas recibidas todavia.</div>
        </div>
      </article>
    </section>
  </div>

  <div class="ltb-error" id="ltbError" hidden></div>
  <div class="ltb-celebrate" id="ltbCelebrate" hidden aria-live="polite"></div>
</div>`;
      this._root = container.querySelector('.ltb-root');
      this._injectStyles();
    },

    // Lo unico interactivo de la app: los parametros del simulador. Se guardan
    // localmente; nada de esto viaja al canal ni afecta al motor.
    _bind() {
      const capital = this._$('#ltbSimCapital');
      const stake = this._$('#ltbSimStake');
      if (capital) {
        capital.value = String(this.state.sim.startingBalance);
        capital.onchange = () => {
          this.state.sim.startingBalance = Math.max(1, Number(capital.value) || 100);
          capital.value = String(this.state.sim.startingBalance);
          this._saveSim();
          this._paint();
        };
      }
      if (stake) {
        stake.value = String(this.state.sim.stake);
        stake.onchange = () => {
          this.state.sim.stake = Math.max(1, Number(stake.value) || 10);
          stake.value = String(this.state.sim.stake);
          this._saveSim();
          this._paint();
        };
      }
    },

    _paintSimulator() {
      const sim = this.state.simResult;
      if (!sim) return;
      const card = this._$('#ltbSimCard');
      const balance = this._$('#ltbSimBalance');
      const profit = this._$('#ltbSimProfit');
      const trades = this._$('#ltbSimTrades');
      if (balance) balance.textContent = fmtUSD(sim.balance, 2);
      if (trades) trades.textContent = sim.total + (sim.total === 1 ? ' senal' : ' senales');
      if (profit) {
        const positive = sim.profit >= 0;
        profit.textContent = (positive ? '+' : '') + fmtUSD(sim.profit, 2)
          + ' · ' + (positive ? '+' : '') + sim.roiPct.toFixed(1) + '%';
        profit.className = sim.total ? (positive ? 'up' : 'down') : '';
      }
      if (card) {
        card.className = 'ltb-card ltb-sim-card'
          + (sim.total ? (sim.profit >= 0 ? ' winning' : ' losing') : '');
      }

      const winRate = this._$('#ltbSimWinRate');
      if (winRate) {
        winRate.textContent = sim.winRatePct == null
          ? '--'
          : Math.round(sim.winRatePct) + '% (' + sim.wins + '/' + sim.total + ')';
      }
      const streak = this._$('#ltbSimStreak');
      if (streak) {
        streak.textContent = !sim.streak
          ? '--'
          : (sim.streak > 0 ? sim.streak + ' ganadas' : Math.abs(sim.streak) + ' perdidas');
        streak.className = sim.streak > 0 ? 'up' : (sim.streak < 0 ? 'down' : '');
      }
      const drawdown = this._$('#ltbSimDrawdown');
      if (drawdown) drawdown.textContent = sim.total ? fmtUSD(sim.maxDrawdown, 2) : '--';
      const breakEven = this._$('#ltbSimBreakEven');
      if (breakEven) {
        breakEven.textContent = sim.breakEvenPct == null ? '--' : Math.round(sim.breakEvenPct) + '%';
        // Verde solo si el acierto real supera el punto de equilibrio.
        breakEven.className = sim.winRatePct == null || sim.breakEvenPct == null
          ? ''
          : (sim.winRatePct >= sim.breakEvenPct ? 'up' : 'down');
      }
      const note = this._$('#ltbSimNote');
      if (note) {
        if (!sim.total) {
          note.textContent = 'Aun no hay velas liquidadas. En cuanto cierre la primera, veras el resultado.';
        } else if (sim.broke) {
          note.textContent = 'El capital simulado se agoto: la racha de perdidas consumio el saldo.';
        } else {
          // Explicar el "por que" cuando acertar no basta: con contratos caros
          // el punto de equilibrio sube por encima del acierto conseguido.
          const short = sim.breakEvenPct != null && sim.winRatePct != null
            && sim.winRatePct < sim.breakEvenPct;
          note.textContent = short
            ? 'Acertar ' + Math.round(sim.winRatePct) + '% no alcanza: comprando a '
              + Math.round(sim.avgPriceCents) + ' centavos hay que acertar mas de '
              + Math.round(sim.breakEvenPct) + '% para no perder.'
            : 'Estimacion sobre ' + sim.total + ' velas liquidadas apostando '
              + fmtUSD(sim.stake, 2) + ' por senal. El precio se estima con la confianza del motor.';
        }
      }
      this._paintSimCurve(sim);
    },

    // Curva de saldo: una linea vale mas que la cifra final para ver si el
    // resultado fue estable o una montana rusa.
    _paintSimCurve(sim) {
      const host = this._$('#ltbSimCurve');
      if (!host) return;
      const points = Array.isArray(sim.curve) ? sim.curve : [];
      if (points.length < 2) {
        host.innerHTML = '<div class="ltb-empty">Sin operaciones simuladas todavia.</div>';
        return;
      }
      const values = points.map(p => p.balance);
      const max = Math.max(...values);
      const min = Math.min(...values);
      const span = Math.max(0.01, max - min);
      const step = 100 / (points.length - 1);
      const coords = points.map((p, i) => {
        const x = i * step;
        const y = 100 - ((p.balance - min) / span) * 100;
        return x.toFixed(2) + ',' + y.toFixed(2);
      });
      const positive = sim.profit >= 0;
      const baseY = (100 - ((sim.startingBalance - min) / span) * 100).toFixed(2);
      host.innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="none">'
        + '<line x1="0" x2="100" y1="' + baseY + '" y2="' + baseY + '" class="ltb-sim-base"/>'
        + '<polyline points="' + coords.join(' ') + '" class="ltb-sim-line ' + (positive ? 'up' : 'down') + '"/>'
        + '<polygon points="0,100 ' + coords.join(' ') + ' 100,100" class="ltb-sim-fill ' + (positive ? 'up' : 'down') + '"/>'
        + '</svg>';
    },

    // El diagnostico distingue POR QUE no hay datos. Antes todo terminaba en
    // "canal sin enlazar", que apuntaba al servidor cuando el problema real
    // solia ser local (LTH OS sin reiniciar tras actualizar el lector).
    async _refresh() {
      if (this._closed) return;
      const bridge = window.electron && window.electron.bitcoinFeed;
      if (!bridge || typeof bridge.load !== 'function') {
        this.state.link = {
          code: 'no-bridge',
          title: 'Falta reiniciar LTH OS',
          detail: 'El lector de senales se instalo con una actualizacion. Cierra y vuelve a abrir LTH OS por completo para activarlo.',
        };
        this.state.loading = false;
        this._paint();
        return;
      }
      try {
        const result = await bridge.load({ limit: CFG.historyLimit });
        if (this._closed) return;
        if (!result || !result.success) {
          const message = result && result.error ? String(result.error) : 'No se pudo leer el canal Bitcoin.';
          // invoke() rechaza asi cuando el proceso principal aun corre una
          // version sin el manejador: es el mismo caso de "falta reiniciar".
          const staleHandler = /No handler registered|bitcoin-feed:load/i.test(message);
          this.state.link = result && result.signedIn === false
            ? {
              code: 'signed-out',
              title: 'Inicia sesion en LTH OS',
              detail: 'Las senales del canal central requieren una sesion activa.',
            }
            : {
              code: staleHandler ? 'no-bridge' : 'error',
              title: staleHandler ? 'Falta reiniciar LTH OS' : 'No se pudo leer el canal',
              detail: staleHandler
                ? 'El proceso principal todavia corre la version anterior. Cierra LTH OS por completo y vuelve a abrirlo.'
                : message,
            };
        } else if (!result.stream) {
          this.state.link = {
            code: 'no-stream',
            title: 'El canal central aun no existe',
            detail: 'LTH Bitcoin Admin todavia no ha publicado el canal publico desde la PC administradora.',
          };
          this.state.signals = [];
          this.state.statuses = [];
          this.state.stream = null;
        } else {
          this.state.link = null;
          this.state.stream = result.stream;
          this.state.signals = Array.isArray(result.signals) ? result.signals : [];
          this.state.statuses = Array.isArray(result.statuses) ? result.statuses : [];
        }
      } catch (error) {
        const message = error && error.message ? error.message : 'Fallo la lectura del canal.';
        const staleHandler = /No handler registered|bitcoin-feed:load/i.test(message);
        this.state.link = {
          code: staleHandler ? 'no-bridge' : 'error',
          title: staleHandler ? 'Falta reiniciar LTH OS' : 'Fallo la lectura del canal',
          detail: staleHandler
            ? 'El proceso principal todavia corre la version anterior. Cierra LTH OS por completo y vuelve a abrirlo.'
            : message,
        };
      }
      this.state.loading = false;
      this._paint();
    },

    async _loadMarket() {
      if (this._closed) return;
      try {
        const end = Math.floor(Date.now() / 1000);
        const start = end - 60 * 60;
        const url = CFG.coinbaseCandles + '?granularity=ONE_MINUTE&start=' + start + '&end=' + end;
        const response = await fetch(url);
        if (!response.ok) return;
        const payload = await response.json();
        const rows = Array.isArray(payload && payload.candles) ? payload.candles : [];
        const candles = rows.map(row => ({
          t: Number(row.start) * 1000,
          o: Number(row.open), h: Number(row.high), l: Number(row.low), c: Number(row.close),
        })).filter(row => isFinite(row.t) && isFinite(row.c)).sort((a, b) => a.t - b.t);
        if (this._closed || !candles.length) return;
        this.state.market.candles = candles;
        this.state.market.price = candles[candles.length - 1].c;
        this.state.market.at = Date.now();
        this._paint();
      } catch (error) { /* el mercado es decorativo: un fallo no rompe la app */ }
    },

    _newestStatus() {
      return (this.state.statuses || []).slice()
        .sort((a, b) => Date.parse(b.last_seen_at || 0) - Date.parse(a.last_seen_at || 0))[0] || null;
    },

    _activeSignal() {
      const rows = (this.state.signals || []).slice()
        .sort((a, b) => Date.parse(b.emitted_at || 0) - Date.parse(a.emitted_at || 0));
      const latest = rows[0] || null;
      if (!latest) return null;
      const open = String(latest.status || 'open').toLowerCase() === 'open';
      const closeMs = Date.parse(latest.window_close || '');
      return (open || (isFinite(closeMs) && closeMs > Date.now())) ? latest : null;
    },

    _paint() {
      if (this._closed || !this._root) return;
      const status = this._newestStatus();
      const signal = this._activeSignal();
      const statusAge = status ? Date.now() - Date.parse(status.last_seen_at || 0) : Infinity;
      const engineState = ['online', 'maintenance', 'offline']
        .includes(String(status?.engine_state || '').toLowerCase())
        ? String(status.engine_state).toLowerCase()
        : (status?.active === false ? 'offline' : 'online');
      const pcOnline = !!status && statusAge >= 0 && statusAge <= CFG.pcOnlineMs;
      const botActive = pcOnline && status?.active !== false && engineState === 'online';

      this.state.simResult = runSimulation(this.state.signals, this.state.sim);
      this._detectWins(this.state.signals);

      this._paintHeader(status, engineState, pcOnline, botActive);
      this._paintSignal(signal, botActive, engineState);
      this._paintChart(signal);
      this._paintClock(signal, botActive, engineState, status);
      this._paintLive(status, botActive);
      this._paintSimulator();
      this._paintHistory();

      const errorEl = this._$('#ltbError');
      if (errorEl) {
        const issue = this.state.link;
        errorEl.hidden = !issue;
        errorEl.textContent = issue ? issue.title + ' — ' + issue.detail : '';
      }
    },

    _paintHeader(status, engineState, pcOnline, botActive) {
      const issue = this.state.link;
      const name = this._$('#ltbStreamName');
      if (name) {
        name.textContent = issue
          ? issue.title
          : (this.state.stream?.title
            ? this.state.stream.title + ' · motor ' + shortEngine(status?.engine_version)
            : (this.state.loading ? 'Conectando con el canal central' : 'Canal central'));
      }
      const price = this._$('#ltbPrice');
      if (price) price.textContent = fmtUSD(this.state.market.price, 2);
      const link = this._$('#ltbLink');
      const linkText = this._$('#ltbLinkText');
      if (link && linkText) {
        if (issue) {
          link.className = 'ltb-link ' + (issue.code === 'error' ? 'offline' : 'maint');
          linkText.textContent = issue.code === 'no-bridge'
            ? 'Reinicia LTH OS'
            : (issue.code === 'signed-out'
              ? 'Sin sesion'
              : (issue.code === 'no-stream' ? 'Canal no publicado' : 'Sin lectura'));
          return;
        }
        link.className = 'ltb-link ' + (botActive ? 'online' : (engineState === 'maintenance' ? 'maint' : 'offline'));
        linkText.textContent = engineState === 'maintenance'
          ? 'Motor en mantenimiento'
          : (engineState === 'offline'
            ? 'Motor apagado'
            : (botActive ? 'Motor transmitiendo' : (pcOnline ? 'Motor pausado' : 'Motor fuera de linea')));
      }
    },

    _paintSignal(signal, botActive, engineState) {
      const card = this._$('#ltbSignalCard');
      const dirIcon = this._$('#ltbDirIcon');
      const dirLabel = this._$('#ltbDirLabel');
      const dirText = this._$('#ltbDirText');
      const copy = this._$('#ltbSignalCopy');
      const confidence = this._$('#ltbConfidence');
      const confidenceBar = this._$('#ltbConfidenceBar');
      if (!card) return;

      const issue = this.state.link;
      if (!signal) {
        card.className = 'ltb-card ltb-signal empty' + (issue ? ' issue' : '');
        if (dirIcon) dirIcon.innerHTML = issue ? '&#9888;' : '&#8645;';
        if (dirLabel) {
          dirLabel.textContent = issue
            ? 'SIN LECTURA'
            : (engineState === 'maintenance'
              ? 'MANTENIMIENTO'
              : (engineState === 'offline' ? 'MOTOR APAGADO' : (botActive ? 'ANALIZANDO' : 'ESPERANDO')));
        }
        if (dirText) {
          dirText.textContent = issue
            ? issue.title
            : (botActive ? 'Sin entrada abierta' : 'Sin senal activa');
        }
        if (copy) {
          copy.textContent = issue
            ? issue.detail
            : (botActive
              ? 'El motor esta conectado y analizando. Publicara la entrada cuando cierre su lectura.'
              : 'Esperando que el motor central publique una indicacion.');
        }
        if (confidence) confidence.textContent = '--';
        if (confidenceBar) confidenceBar.style.width = '0%';
        this._$('#ltbSignalTime').textContent = '--:--';
        this._$('#ltbCloseTime').textContent = '--:--';
        this._$('#ltbCountdown').textContent = '--:--';
        this._$('#ltbEntryPrice').textContent = '--';
        this._$('#ltbResult').textContent = '--';
        return;
      }

      const up = signal.direction === 'UP';
      const closeMs = Date.parse(signal.window_close || '');
      const remaining = Math.max(0, closeMs - Date.now());
      const settling = isFinite(closeMs) && closeMs <= Date.now();
      const value = Math.max(50, Math.min(100, Number(signal.confidence) || 50));

      card.className = 'ltb-card ltb-signal ' + (up ? 'up' : 'down');
      if (dirIcon) dirIcon.innerHTML = up ? '&#8593;' : '&#8595;';
      if (dirLabel) dirLabel.textContent = settling ? 'PENDIENTE DE RESULTADO' : 'ENTRADA ACTIVA';
      if (dirText) dirText.textContent = up ? 'UP / ARRIBA' : 'DOWN / ABAJO';
      if (copy) {
        copy.textContent = settling
          ? 'La vela cerro a las ' + fmtClock(signal.window_close) + '. El motor esta confirmando el resultado oficial.'
          : (signal.reasoning_headline
            || ((up ? 'UP' : 'DOWN') + ' para la vela que cierra a las ' + fmtClock(signal.window_close) + '.'));
      }
      if (confidence) confidence.textContent = Math.round(value) + '%';
      if (confidenceBar) {
        confidenceBar.style.width = value + '%';
        confidenceBar.className = up ? 'up' : 'down';
      }
      this._$('#ltbSignalTime').textContent = fmtClock(signal.emitted_at);
      this._$('#ltbCloseTime').textContent = fmtClock(signal.window_close);
      this._$('#ltbCountdown').textContent = settling ? 'CERRADA' : fmtCountdown(remaining);
      this._$('#ltbEntryPrice').textContent = fmtUSD(signal.entry_price, 2);
      const outcome = outcomeOf(signal);
      const resultEl = this._$('#ltbResult');
      resultEl.textContent = outcome.label;
      resultEl.className = 'ltb-outcome ' + outcome.tone;
    },

    // Grafico de velas 1m de la ventana vigente, con la apertura oficial como
    // linea de referencia: es exactamente lo que decide ganar o perder.
    _paintChart(signal) {
      const host = this._$('#ltbChart');
      if (!host) return;
      const candles = this.state.market.candles || [];
      const winStart = Math.floor(Date.now() / CFG.windowMs) * CFG.windowMs;
      const rows = candles.filter(row => row.t >= winStart - CFG.windowMs);
      if (rows.length < 2) {
        host.innerHTML = '<div class="ltb-empty">Cargando velas reales de Coinbase...</div>';
        return;
      }
      const openRef = Number(signal?.window_open_price)
        || (rows.find(row => row.t >= winStart) || rows[0]).o;
      const highs = rows.map(row => row.h).concat(openRef);
      const lows = rows.map(row => row.l).concat(openRef);
      const max = Math.max(...highs);
      const min = Math.min(...lows);
      const span = Math.max(1e-6, max - min);
      const width = 100;
      const height = 100;
      const step = width / rows.length;
      const y = (price) => ((max - price) / span) * height;

      const bars = rows.map((row, index) => {
        const x = index * step + step / 2;
        const up = row.c >= row.o;
        const bodyTop = y(Math.max(row.o, row.c));
        const bodyBottom = y(Math.min(row.o, row.c));
        const bodyHeight = Math.max(0.6, bodyBottom - bodyTop);
        const bodyWidth = Math.max(0.8, step * 0.6);
        return '<line x1="' + x.toFixed(2) + '" x2="' + x.toFixed(2) + '" y1="' + y(row.h).toFixed(2)
          + '" y2="' + y(row.l).toFixed(2) + '" class="wick ' + (up ? 'up' : 'down') + '"/>'
          + '<rect x="' + (x - bodyWidth / 2).toFixed(2) + '" y="' + bodyTop.toFixed(2)
          + '" width="' + bodyWidth.toFixed(2) + '" height="' + bodyHeight.toFixed(2)
          + '" class="body ' + (up ? 'up' : 'down') + '"/>';
      }).join('');

      const refY = y(openRef).toFixed(2);
      host.innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="none" class="ltb-chart-svg">'
        + '<line x1="0" x2="100" y1="' + refY + '" y2="' + refY + '" class="ltb-openline"/>'
        + bars + '</svg>'
        + '<div class="ltb-chart-legend">'
        + '<span><i class="ref"></i>Apertura ' + fmtUSD(openRef, 2) + '</span>'
        + '<span>' + fmtUSD(min, 0) + ' - ' + fmtUSD(max, 0) + '</span>'
        + '</div>';
      const note = this._$('#ltbChartNote');
      if (note) {
        note.textContent = this.state.market.at
          ? 'Coinbase · ' + fmtAgo(new Date(this.state.market.at).toISOString())
          : 'Coinbase BTC-USD';
      }
    },

    // Reloj por tramos reales del motor (5 / 7 / 10 min), anclado al inicio de
    // la vela vigente por reloj de pared: se recupera solo tras cualquier hueco.
    _paintClock(signal, botActive, engineState, status) {
      const badge = this._$('#ltbClockBadge');
      const value = this._$('#ltbClockValue');
      const eyebrow = this._$('#ltbClockEyebrow');
      const title = this._$('#ltbClockTitle');
      const text = this._$('#ltbClockText');
      const ring = this._$('#ltbRing');
      if (!badge || !value) return;

      const now = Date.now();
      const closeMs = signal ? Date.parse(signal.window_close || '') : NaN;
      let remaining = null;
      let total = null;
      let label = 'PROXIMA';

      if (engineState === 'maintenance' || engineState === 'offline') {
        const scheduled = Date.parse(status?.scheduled_start_at || '');
        remaining = isFinite(scheduled) && scheduled > now ? scheduled - now : null;
        badge.textContent = engineState === 'maintenance' ? 'MANTENIMIENTO' : 'MOTOR APAGADO';
        label = 'MOTOR';
        title.textContent = engineState === 'maintenance' ? 'Motor en mantenimiento' : 'Motor apagado';
        text.textContent = remaining == null
          ? 'La cuenta regresiva vuelve cuando el administrador encienda el motor.'
          : 'Se encendera automaticamente a las ' + fmtClock(now + remaining) + '.';
      } else if (isFinite(closeMs) && closeMs > now) {
        remaining = closeMs - now;
        const startMs = Date.parse(signal.window_start || signal.emitted_at || '');
        total = isFinite(startMs) && closeMs > startMs ? closeMs - startMs : CFG.windowMs;
        label = 'CIERRA EN';
        badge.textContent = signal.direction === 'UP' ? 'ENTRADA UP ACTIVA' : 'ENTRADA DOWN ACTIVA';
        title.textContent = 'La vela de 15 min sigue abierta';
        text.textContent = 'Sostiene la entrada hasta el cierre oficial de las ' + fmtClock(signal.window_close) + '.';
      } else if (!botActive) {
        badge.textContent = 'SIN SENAL';
        title.textContent = 'Sin indicaciones todavia';
        text.textContent = 'El motor central no esta enviando actualizaciones en este momento.';
      } else {
        const anchor = Math.floor(now / CFG.windowMs) * CFG.windowMs;
        const elapsed = now - anchor;
        const index = CFG.decisionMinutes.findIndex(minute => minute * 60000 > elapsed);
        if (index !== -1) {
          const targetMs = CFG.decisionMinutes[index] * 60000;
          const startMs = index > 0 ? CFG.decisionMinutes[index - 1] * 60000 : 0;
          remaining = anchor + targetMs - now;
          total = targetMs - startMs;
          label = 'PROXIMA EN';
          badge.textContent = index === 0
            ? 'INTENTO AL MIN ' + CFG.decisionMinutes[index]
            : 'TRAMO ' + (index + 1) + ' · MIN ' + CFG.decisionMinutes[index];
          title.textContent = 'El motor decide la siguiente entrada';
          text.textContent = index === 0
            ? 'Evalua el primer bloque de ' + CFG.decisionMinutes[index] + ' min de la vela nueva.'
            : 'El tramo anterior no alcanzo; sigue evaluando hasta el minuto ' + CFG.decisionMinutes[index] + '.';
        } else {
          remaining = 0;
          label = 'AHORA';
          badge.textContent = 'INDICACION INMINENTE';
          title.textContent = 'El corte forzado ya paso';
          text.textContent = 'El motor puede publicar la siguiente entrada en cualquier momento.';
        }
      }

      eyebrow.textContent = label;
      value.textContent = remaining == null ? '--:--' : fmtCountdown(remaining);
      if (ring) {
        const fraction = total && remaining != null
          ? Math.max(0, Math.min(1, remaining / total))
          : (remaining == null ? 0 : 1);
        const length = 2 * Math.PI * 56;
        ring.style.strokeDasharray = length.toFixed(2);
        ring.style.strokeDashoffset = (length * (1 - fraction)).toFixed(2);
      }
    },

    _paintLive(status, botActive) {
      const riskRaw = Number(status?.live_rejection_risk);
      const hasRisk = isFinite(riskRaw);
      const plan = status?.live_plan && typeof status.live_plan === 'object' ? status.live_plan : null;
      const phases = Array.isArray(status?.live_phases) ? status.live_phases : [];
      const specialists = Array.isArray(status?.live_specialists) ? status.live_specialists : [];
      const headline = typeof status?.live_reasoning_headline === 'string'
        ? status.live_reasoning_headline.trim() : '';

      const verdict = this._$('#ltbVerdict');
      if (verdict) {
        verdict.textContent = botActive
          ? (plan?.verdict || (headline ? 'Lectura tecnica en curso' : 'Construyendo la tesis'))
          : 'Motor sin transmitir';
        verdict.className = 'ltb-verdict ' + (plan?.verdict === 'RECHAZO PROBABLE'
          ? 'danger'
          : (plan?.verdict === 'RECHAZO EN DUDA' ? 'warn'
            : (plan?.verdict === 'TESIS FIRME' ? 'good' : '')));
      }
      const regime = this._$('#ltbRegime');
      if (regime) regime.textContent = status?.live_regime || '--';

      const riskPct = hasRisk ? Math.max(0, Math.min(100, Math.round(riskRaw))) : null;
      const riskValue = this._$('#ltbRiskValue');
      const riskBar = this._$('#ltbRiskBar');
      const riskWrap = this._$('#ltbRisk');
      if (riskValue) riskValue.textContent = riskPct == null ? '--%' : riskPct + '%';
      if (riskBar) riskBar.style.width = riskPct == null ? '0%' : riskPct + '%';
      if (riskWrap) {
        const level = String(status?.live_rejection_level || '').toUpperCase();
        riskWrap.className = 'ltb-risk '
          + (level === 'EXTREMO' ? 'extreme' : (level === 'ALTO' ? 'high' : (level === 'MODERADO' ? 'mid' : 'low')));
      }
      const riskNote = this._$('#ltbRiskNote');
      if (riskNote) {
        const level = status?.live_rejection_level || null;
        const odds = plan && isFinite(Number(plan.rejectionOdds)) ? Number(plan.rejectionOdds) : null;
        riskNote.textContent = level
          ? 'Nivel ' + level + (odds != null ? ' · rechazo proyectado ' + odds + '%' : '')
            + (plan?.riskTrend ? ' · ' + plan.riskTrend : '') + '.'
          : 'Mide si la vela puede darse la vuelta antes del cierre.';
      }

      const reasoning = this._$('#ltbReasoning');
      if (reasoning) {
        const value = plan?.headline || headline;
        reasoning.textContent = value;
        reasoning.hidden = !value;
      }
      const watch = this._$('#ltbWatch');
      const watchItems = Array.isArray(plan?.watch) ? plan.watch.filter(Boolean) : [];
      if (watch) {
        watch.hidden = !watchItems.length;
        if (watchItems.length) {
          watch.innerHTML = watchItems.map(item => '<li>' + esc(item) + '</li>').join('');
        }
      }

      const specialistHost = this._$('#ltbSpecialists');
      if (specialistHost) {
        specialistHost.innerHTML = specialists.length
          ? specialists.map(item => {
            const value = Number(item?.p);
            if (!isFinite(value)) return '';
            const tone = value > 55 ? 'up' : (value < 45 ? 'down' : 'flat');
            return '<div class="ltb-spec ' + tone + '">'
              + '<span>' + esc(item?.l || item?.k || '') + '</span>'
              + '<div class="ltb-spec-bar"><i style="width:' + Math.round(value) + '%"></i></div>'
              + '<strong>' + Math.round(value) + '%</strong></div>';
          }).join('')
          : '<div class="ltb-empty">Sin especialistas con datos todavia.</div>';
      }

      const phaseHost = this._$('#ltbPhases');
      if (phaseHost) {
        phaseHost.innerHTML = phases.length
          ? phases.map(item => {
            const value = Number(item?.p);
            return '<div class="ltb-phase ' + esc(String(item?.s || 'missing')) + '">'
              + '<i></i><span>' + esc(item?.l || '') + '</span>'
              + '<b>' + (isFinite(value) ? Math.round(value) + '%' : '--') + '</b></div>';
          }).join('')
          : '<div class="ltb-empty">Sin capas reportadas todavia.</div>';
      }
    },

    _paintHistory() {
      const rows = (this.state.signals || []).slice()
        .sort((a, b) => Date.parse(b.emitted_at || 0) - Date.parse(a.emitted_at || 0));
      const settled = rows.filter(row => ['won', 'lost'].includes(String(row.status || '').toLowerCase()));
      const won = settled.filter(row => String(row.status).toLowerCase() === 'won').length;
      const lost = settled.length - won;
      const rate = settled.length ? Math.round((won / settled.length) * 100) : null;

      this._$('#ltbWon').textContent = String(won);
      this._$('#ltbLost').textContent = String(lost);
      this._$('#ltbRate').textContent = rate == null ? '--' : rate + '%';
      const bar = this._$('#ltbScoreBar');
      if (bar) {
        bar.style.width = (rate == null ? 0 : rate) + '%';
        bar.className = rate == null ? '' : (rate >= 55 ? 'good' : (rate >= 45 ? 'mid' : 'bad'));
      }
      this._$('#ltbHistoryCount').textContent = String(rows.length);

      const host = this._$('#ltbHistory');
      if (!host) return;
      host.innerHTML = rows.length
        ? rows.slice(0, 40).map(row => {
          const outcome = outcomeOf(row);
          const up = row.direction === 'UP';
          return '<div class="ltb-hist ' + outcome.tone + '">'
            + '<span class="ltb-hist-time">' + esc(fmtClock(row.window_start || row.emitted_at)) + '</span>'
            + '<span class="ltb-hist-dir ' + (up ? 'up' : 'down') + '">' + (up ? '&#8593; UP' : '&#8595; DOWN') + '</span>'
            + '<span class="ltb-hist-conf">' + Math.round(Number(row.confidence) || 0) + '%</span>'
            + '<span class="ltb-hist-res">' + esc(outcome.label) + '</span>'
            + '</div>';
        }).join('')
        : '<div class="ltb-empty">Sin entradas recibidas todavia.</div>';
    },

    _injectStyles() {
      if (document.getElementById('ltb-styles')) return;
      const style = document.createElement('style');
      style.id = 'ltb-styles';
      style.textContent = `
.ltb-root{
  --ltb-bg:#080c12;--ltb-panel:#101720;--ltb-panel-raised:#131c27;--ltb-panel-deep:#0b1119;
  --ltb-edge:#222d3a;--ltb-edge-strong:#2c3a49;--ltb-ink:#f4f6f8;--ltb-dim:#9ba7b5;
  --ltb-faint:#657180;--ltb-up:#28cf91;--ltb-down:#ff627b;--ltb-gold:#f4a524;
  --ltb-orange:#f7931a;--ltb-blue:#63a7ff;
  position:absolute;inset:0;display:flex;flex-direction:column;gap:18px;padding:0 22px 22px;
  overflow-y:auto;overflow-x:hidden;isolation:isolate;color:var(--ltb-ink);background:
    radial-gradient(900px 360px at 52% -18%,rgba(78,125,184,.13),transparent 72%),
    linear-gradient(180deg,#090d13 0%,var(--ltb-bg) 100%);
  font-family:Inter,'Segoe UI',system-ui,-apple-system,sans-serif;
  font-size:14px;line-height:1.45;-webkit-font-smoothing:antialiased;}
.ltb-root::before{content:'';position:absolute;inset:0;pointer-events:none;z-index:0;opacity:.42;
  background-image:linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),
    linear-gradient(90deg,rgba(255,255,255,.014) 1px,transparent 1px);
  background-size:48px 48px;mask-image:linear-gradient(to bottom,black,transparent 78%);}
.ltb-root>*{position:relative;z-index:1;}
.ltb-root *{box-sizing:border-box;}
.ltb-root ::selection{color:#1b1103;background:var(--ltb-gold);}

.ltb-top{position:sticky;top:0;z-index:20;min-height:94px;display:flex;align-items:center;justify-content:space-between;gap:24px;flex:none;
  border-bottom:1px solid rgba(255,255,255,.07);background:rgba(9,13,19,.94);backdrop-filter:blur(14px);}
.ltb-brand{display:flex;align-items:center;gap:13px;min-width:0;}
.ltb-logo{display:grid;place-items:center;width:48px;height:48px;flex:none;border-radius:14px;
  color:#1b1103;background:var(--ltb-orange);font-size:26px;font-weight:700;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.32),0 8px 22px rgba(0,0,0,.22);}
.ltb-brand h1{margin:0;color:var(--ltb-ink);font-size:21px;font-weight:680;letter-spacing:-.025em;}
.ltb-brand p{max-width:380px;margin:3px 0 0;overflow:hidden;color:var(--ltb-dim);font-size:12px;
  text-overflow:ellipsis;white-space:nowrap;}
.ltb-top-live{display:flex;align-items:center;gap:18px;}
.ltb-price{text-align:right;}
.ltb-price span{display:block;margin-bottom:1px;color:var(--ltb-faint);font-size:10px;font-weight:650;
  letter-spacing:.18em;}
.ltb-price strong{display:block;color:var(--ltb-ink);font-size:30px;font-weight:680;
  font-variant-numeric:tabular-nums;letter-spacing:-.035em;line-height:1.1;}
.ltb-link{display:flex;align-items:center;gap:9px;min-height:40px;padding:9px 14px;border:1px solid var(--ltb-edge);
  border-radius:12px;color:var(--ltb-dim);background:#0d141d;font-size:12px;font-weight:520;white-space:nowrap;}
.ltb-link i{width:8px;height:8px;flex:none;border-radius:50%;background:var(--ltb-faint);}
.ltb-link.online{color:#bdebd9;border-color:rgba(40,207,145,.32);background:rgba(40,207,145,.07);}
.ltb-link.online i{background:var(--ltb-up);}
.ltb-link.maint{color:#f6d59a;border-color:rgba(244,165,36,.34);background:rgba(244,165,36,.07);}
.ltb-link.maint i{background:var(--ltb-gold);}
.ltb-link.offline{color:#f2b2bd;border-color:rgba(255,98,123,.32);background:rgba(255,98,123,.07);}
.ltb-link.offline i{background:var(--ltb-down);}

.ltb-grid{flex:none;min-height:auto;display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:14px;align-items:stretch;padding-bottom:2px;}
.ltb-col{display:contents;}
#ltbSignalCard{grid-column:1 / 8;grid-row:1;}#ltbLiveCard{grid-column:8 / 13;grid-row:1;}
.ltb-chart-card{grid-column:1 / 8;grid-row:2;}#ltbSimCard{grid-column:8 / 13;grid-row:2;}
.ltb-clock-card{grid-column:1 / 5;grid-row:3;}.ltb-specialists-card{grid-column:5 / 9;grid-row:3;}
.ltb-phases-card{grid-column:9 / 13;grid-row:3;}.ltb-score-card{grid-column:1 / 5;grid-row:4;}
.ltb-history-card{grid-column:5 / 13;grid-row:4;}
.ltb-root::-webkit-scrollbar,.ltb-history::-webkit-scrollbar,.ltb-phases::-webkit-scrollbar{width:7px;}
.ltb-root::-webkit-scrollbar-track,.ltb-history::-webkit-scrollbar-track,.ltb-phases::-webkit-scrollbar-track{background:transparent;}
.ltb-root::-webkit-scrollbar-thumb,.ltb-history::-webkit-scrollbar-thumb,.ltb-phases::-webkit-scrollbar-thumb{
  border:2px solid transparent;border-radius:999px;background:#344252;background-clip:padding-box;}

.ltb-card{position:relative;flex:none;padding:19px;border:1px solid var(--ltb-edge);border-radius:16px;
  background:linear-gradient(180deg,var(--ltb-panel-raised),var(--ltb-panel));
  box-shadow:0 12px 30px rgba(0,0,0,.18);}
.ltb-card-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:16px;}
.ltb-eyebrow{color:#7d8998;font-size:10px;font-weight:700;letter-spacing:.14em;line-height:1.2;}
.ltb-chip{max-width:58%;overflow:hidden;padding:5px 9px;border:1px solid var(--ltb-edge);
  border-radius:8px;color:var(--ltb-dim);background:#0d141d;font-size:10.5px;font-weight:550;
  text-overflow:ellipsis;white-space:nowrap;}

.ltb-signal{overflow:hidden;transition:border-color .25s ease;}
.ltb-signal::after{content:'';position:absolute;top:-1px;left:18px;right:18px;height:2px;border-radius:0 0 2px 2px;
  background:var(--ltb-edge-strong);transition:background .25s ease;}
.ltb-signal.up{border-color:rgba(40,207,145,.34);background:
  linear-gradient(135deg,rgba(40,207,145,.065),transparent 44%),linear-gradient(180deg,var(--ltb-panel-raised),var(--ltb-panel));}
.ltb-signal.up::after{background:var(--ltb-up);}
.ltb-signal.down{border-color:rgba(255,98,123,.34);background:
  linear-gradient(135deg,rgba(255,98,123,.065),transparent 44%),linear-gradient(180deg,var(--ltb-panel-raised),var(--ltb-panel));}
.ltb-signal.down::after{background:var(--ltb-down);}
.ltb-signal.issue{border-color:rgba(244,165,36,.34);}
.ltb-signal.issue::after{background:var(--ltb-gold);}
.ltb-signal.issue .ltb-dir-icon{color:var(--ltb-gold);border-color:rgba(244,165,36,.34);background:rgba(244,165,36,.08);}
.ltb-signal-main{display:flex;align-items:center;justify-content:space-between;gap:24px;margin-bottom:15px;}
.ltb-dir{display:flex;align-items:center;gap:15px;min-width:0;}
.ltb-dir-icon{display:grid;place-items:center;width:58px;height:58px;flex:none;border:1px solid var(--ltb-edge-strong);
  border-radius:14px;color:var(--ltb-dim);background:var(--ltb-panel-deep);font-size:29px;line-height:1;}
.ltb-signal.up .ltb-dir-icon{color:var(--ltb-up);border-color:rgba(40,207,145,.36);background:rgba(40,207,145,.08);}
.ltb-signal.down .ltb-dir-icon{color:var(--ltb-down);border-color:rgba(255,98,123,.36);background:rgba(255,98,123,.08);}
.ltb-dir-label{display:block;margin-bottom:4px;color:var(--ltb-faint);font-size:10px;font-weight:650;letter-spacing:.12em;}
.ltb-dir strong{display:block;overflow:hidden;color:var(--ltb-ink);font-size:25px;font-weight:700;letter-spacing:-.025em;
  text-overflow:ellipsis;white-space:nowrap;}
.ltb-conf{min-width:174px;text-align:right;}
.ltb-conf span{display:block;color:var(--ltb-faint);font-size:10px;font-weight:650;letter-spacing:.12em;}
.ltb-conf strong{display:block;margin-top:1px;color:var(--ltb-ink);font-size:34px;font-weight:700;
  font-variant-numeric:tabular-nums;letter-spacing:-.035em;line-height:1.1;}
.ltb-conf-track{height:6px;margin-top:9px;overflow:hidden;border-radius:999px;background:#28323f;}
.ltb-conf-track i{display:block;width:0;height:100%;border-radius:999px;background:var(--ltb-blue);
  transition:width .55s cubic-bezier(.22,1,.36,1);}
.ltb-conf-track i.up{background:var(--ltb-up);}.ltb-conf-track i.down{background:var(--ltb-down);}
.ltb-signal-copy{margin:0 0 16px;color:#b9c2cd;font-size:13px;line-height:1.55;}
.ltb-signal-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;}
.ltb-signal-stats div{min-width:0;padding:11px 12px;border:1px solid #1d2834;border-radius:11px;background:var(--ltb-panel-deep);}
.ltb-signal-stats span{display:block;margin-bottom:5px;color:var(--ltb-faint);font-size:10px;font-weight:600;letter-spacing:.09em;}
.ltb-signal-stats strong{display:block;overflow:hidden;color:#e8ebef;font-size:15px;font-weight:650;
  font-variant-numeric:tabular-nums;text-overflow:ellipsis;white-space:nowrap;}
.ltb-outcome.win{color:var(--ltb-up);}.ltb-outcome.loss{color:var(--ltb-down);}.ltb-outcome.pending{color:var(--ltb-gold);}

.ltb-chart-card{height:480px;min-height:0;display:flex;flex-direction:column;}
.ltb-chart{position:relative;flex:1;min-height:300px;display:flex;flex-direction:column;padding:12px 12px 9px;
  overflow:hidden;border:1px solid #1d2834;border-radius:12px;background-color:#0a1017;
  background-image:linear-gradient(rgba(125,145,168,.075) 1px,transparent 1px),
    linear-gradient(90deg,rgba(125,145,168,.055) 1px,transparent 1px);
  background-size:100% 25%,12.5% 100%;}
.ltb-chart>.ltb-empty{margin:auto;}
.ltb-chart-svg{display:block;flex:1;width:100%;min-height:0;overflow:visible;shape-rendering:geometricPrecision;}
.ltb-chart-svg .body.up,.ltb-chart-svg .wick.up{fill:var(--ltb-up);stroke:var(--ltb-up);}
.ltb-chart-svg .body.down,.ltb-chart-svg .wick.down{fill:var(--ltb-down);stroke:var(--ltb-down);}
.ltb-chart-svg .body{filter:none;}.ltb-chart-svg .wick{stroke-width:.24;}
.ltb-openline{stroke:var(--ltb-gold);stroke-width:.28;stroke-dasharray:2 2;opacity:.72;filter:none;}
.ltb-chart-legend{display:flex;justify-content:space-between;gap:12px;margin-top:8px;color:var(--ltb-dim);font-size:10px;
  font-variant-numeric:tabular-nums;}
.ltb-chart-legend i.ref{display:inline-block;width:13px;height:1px;margin-right:6px;vertical-align:middle;background:var(--ltb-gold);box-shadow:none;}

.ltb-clock{display:flex;align-items:center;gap:20px;}
.ltb-clock-dial{position:relative;width:116px;height:116px;flex:none;}
.ltb-clock-dial svg{width:100%;height:100%;transform:rotate(-90deg);}
.ltb-ring-track{fill:none;stroke:#27313e;stroke-width:8;}
.ltb-ring-fill{fill:none;stroke:var(--ltb-blue);stroke-width:8;stroke-linecap:round;filter:none;
  transition:stroke-dashoffset .55s cubic-bezier(.22,1,.36,1);}
.ltb-clock-read{position:absolute;inset:0;display:grid;place-content:center;text-align:center;}
.ltb-clock-read span{display:block;margin-bottom:2px;color:var(--ltb-faint);font-size:8px;font-weight:650;letter-spacing:.15em;}
.ltb-clock-read strong{color:var(--ltb-ink);font-size:23px;font-weight:680;font-variant-numeric:tabular-nums;}
.ltb-clock-copy strong{display:block;margin-bottom:6px;color:#e7ebef;font-size:15px;font-weight:650;}
.ltb-clock-copy p{margin:0;color:var(--ltb-dim);font-size:12px;line-height:1.55;}

.ltb-verdict{display:block;margin-bottom:16px;color:#e9edf1;font-size:18px;font-weight:680;letter-spacing:-.018em;}
.ltb-verdict.good{color:var(--ltb-up);}.ltb-verdict.warn{color:var(--ltb-gold);}.ltb-verdict.danger{color:var(--ltb-down);}
.ltb-risk{margin-bottom:14px;}.ltb-risk-copy{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:8px;}
.ltb-risk-copy span{color:var(--ltb-faint);font-size:10px;font-weight:650;letter-spacing:.1em;}
.ltb-risk-copy strong{color:var(--ltb-ink);font-size:23px;font-weight:680;font-variant-numeric:tabular-nums;}
.ltb-risk-track{height:7px;overflow:hidden;border-radius:999px;background:#28323f;}
.ltb-risk-track i{display:block;width:0;height:100%;border-radius:999px;background:var(--ltb-up);
  transition:width .55s cubic-bezier(.22,1,.36,1);}
.ltb-risk.mid .ltb-risk-track i{background:var(--ltb-gold);}.ltb-risk.high .ltb-risk-track i{background:#ef8f2f;}
.ltb-risk.extreme .ltb-risk-track i{background:var(--ltb-down);}
.ltb-risk.high .ltb-risk-copy strong{color:#ef9b48;}.ltb-risk.extreme .ltb-risk-copy strong{color:var(--ltb-down);}
.ltb-risk small{display:block;margin-top:9px;color:var(--ltb-dim);font-size:11px;line-height:1.5;}
.ltb-reasoning{margin:0 0 12px;color:#bcc5cf;font-size:12px;line-height:1.55;}
.ltb-watch{display:grid;gap:6px;margin:0;padding-left:17px;color:var(--ltb-dim);font-size:11.5px;line-height:1.5;}
.ltb-watch li::marker{color:var(--ltb-gold);}

.ltb-specialists{display:grid;gap:11px;}
.ltb-spec{display:grid;grid-template-columns:minmax(0,1fr) 88px 42px;align-items:center;gap:10px;font-size:11.5px;}
.ltb-spec span{overflow:hidden;color:var(--ltb-dim);text-overflow:ellipsis;white-space:nowrap;}
.ltb-spec-bar{height:6px;overflow:hidden;border-radius:999px;background:#28323f;}
.ltb-spec-bar i{display:block;height:100%;border-radius:999px;background:var(--ltb-blue);transition:width .5s cubic-bezier(.22,1,.36,1);}
.ltb-spec.up .ltb-spec-bar i{background:var(--ltb-up);}.ltb-spec.down .ltb-spec-bar i{background:var(--ltb-down);}
.ltb-spec strong{text-align:right;font-weight:650;font-variant-numeric:tabular-nums;}
.ltb-spec.up strong{color:var(--ltb-up);}.ltb-spec.down strong{color:var(--ltb-down);}

.ltb-phases-card{min-height:220px;display:flex;flex-direction:column;}
.ltb-phases{display:grid;gap:6px;min-height:0;max-height:240px;overflow-y:auto;}
.ltb-phase{display:grid;grid-template-columns:8px minmax(0,1fr) 44px;align-items:center;gap:10px;padding:8px 10px;
  border:1px solid #1c2631;border-radius:9px;background:var(--ltb-panel-deep);font-size:11.5px;}
.ltb-phase i{width:7px;height:7px;border-radius:50%;background:#536171;}
.ltb-phase.support i{background:var(--ltb-up);}.ltb-phase.oppose i{background:var(--ltb-down);}
.ltb-phase.neutral i{background:var(--ltb-gold);}.ltb-phase.missing{opacity:.46;}
.ltb-phase span{overflow:hidden;color:#b6c0cb;text-overflow:ellipsis;white-space:nowrap;}
.ltb-phase b{text-align:right;font-weight:650;font-variant-numeric:tabular-nums;}

.ltb-sim-card{transition:border-color .25s ease;}
.ltb-sim-card.winning{border-color:rgba(40,207,145,.34);}.ltb-sim-card.losing{border-color:rgba(255,98,123,.32);}
.ltb-sim-balance{text-align:center;margin-bottom:13px;}
.ltb-sim-balance span{display:block;margin-bottom:5px;color:var(--ltb-faint);font-size:10px;font-weight:650;letter-spacing:.12em;}
.ltb-sim-balance strong{display:block;color:var(--ltb-ink);font-size:37px;font-weight:700;letter-spacing:-.04em;
  font-variant-numeric:tabular-nums;line-height:1.15;}
.ltb-sim-balance em{display:block;margin-top:4px;color:var(--ltb-dim);font-size:13px;font-style:normal;font-weight:620;
  font-variant-numeric:tabular-nums;}.ltb-sim-balance em.up{color:var(--ltb-up);}.ltb-sim-balance em.down{color:var(--ltb-down);}
.ltb-sim-curve{height:82px;margin-bottom:14px;padding:8px;border:1px solid #1d2834;border-radius:10px;background:var(--ltb-panel-deep);}
.ltb-sim-curve svg{display:block;width:100%;height:100%;overflow:visible;}
.ltb-sim-line{fill:none;stroke-width:1.7;stroke-linejoin:round;vector-effect:non-scaling-stroke;filter:none;}
.ltb-sim-line.up{stroke:var(--ltb-up);}.ltb-sim-line.down{stroke:var(--ltb-down);}
.ltb-sim-fill{stroke:none;opacity:.11;}.ltb-sim-fill.up{fill:var(--ltb-up);}.ltb-sim-fill.down{fill:var(--ltb-down);}
.ltb-sim-base{stroke:#3a4654;stroke-width:.6;stroke-dasharray:2 2;vector-effect:non-scaling-stroke;}
.ltb-sim-inputs{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:12px;}
.ltb-sim-inputs label{display:block;color:var(--ltb-faint);font-size:10px;font-weight:600;letter-spacing:.08em;}
.ltb-field{display:flex;align-items:center;gap:5px;margin-top:6px;padding:9px 10px;border:1px solid var(--ltb-edge);
  border-radius:9px;background:var(--ltb-panel-deep);transition:border-color .18s ease,box-shadow .18s ease;}
.ltb-field:focus-within{border-color:var(--ltb-blue);box-shadow:0 0 0 3px rgba(99,167,255,.11);}
.ltb-field i{color:var(--ltb-faint);font-size:12px;font-style:normal;}
.ltb-field input{flex:1;min-width:0;border:0;outline:0;color:var(--ltb-ink);background:transparent;
  font-family:inherit;font-size:14px;font-weight:650;font-variant-numeric:tabular-nums;}
.ltb-field input::-webkit-outer-spin-button,.ltb-field input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
.ltb-sim-stats{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:11px;}
.ltb-sim-stats div{padding:9px 10px;border:1px solid #1c2631;border-radius:9px;background:var(--ltb-panel-deep);}
.ltb-sim-stats span{display:block;margin-bottom:3px;color:var(--ltb-faint);font-size:9.5px;font-weight:600;letter-spacing:.07em;}
.ltb-sim-stats strong{color:#e6eaee;font-size:13px;font-weight:650;font-variant-numeric:tabular-nums;}
.ltb-sim-stats strong.up{color:var(--ltb-up);}.ltb-sim-stats strong.down{color:var(--ltb-down);}
.ltb-sim-note{margin:0;color:var(--ltb-faint);font-size:10.5px;line-height:1.5;}

.ltb-score{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:13px;text-align:center;}
.ltb-score div span{display:block;color:var(--ltb-ink);font-size:29px;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.03em;}
.ltb-score div small{color:var(--ltb-faint);font-size:9.5px;font-weight:600;letter-spacing:.09em;}
.ltb-score .win span{color:var(--ltb-up);}.ltb-score .loss span{color:var(--ltb-down);}
.ltb-score-bar{height:6px;overflow:hidden;border-radius:999px;background:#28323f;}
.ltb-score-bar i{display:block;width:0;height:100%;border-radius:999px;background:var(--ltb-blue);transition:width .55s cubic-bezier(.22,1,.36,1);}
.ltb-score-bar i.good{background:var(--ltb-up);}.ltb-score-bar i.mid{background:var(--ltb-gold);}.ltb-score-bar i.bad{background:var(--ltb-down);}

.ltb-history-card{min-height:290px;display:flex;flex-direction:column;}
.ltb-history{display:grid;gap:6px;min-height:0;max-height:330px;overflow-y:auto;}
.ltb-hist{display:grid;grid-template-columns:48px 74px 42px minmax(0,1fr);align-items:center;gap:8px;padding:9px 10px;
  border:1px solid #1c2631;border-left:2px solid #475362;border-radius:9px;background:var(--ltb-panel-deep);font-size:11px;}
.ltb-hist.win{border-left-color:var(--ltb-up);}.ltb-hist.loss{border-left-color:var(--ltb-down);}.ltb-hist.pending{border-left-color:var(--ltb-gold);}
.ltb-hist-time{color:var(--ltb-faint);font-variant-numeric:tabular-nums;}.ltb-hist-dir{font-weight:650;}
.ltb-hist-dir.up{color:var(--ltb-up);}.ltb-hist-dir.down{color:var(--ltb-down);}
.ltb-hist-conf{color:var(--ltb-dim);font-variant-numeric:tabular-nums;}
.ltb-hist-res{overflow:hidden;color:var(--ltb-faint);font-size:9px;font-weight:650;letter-spacing:.05em;text-align:right;text-overflow:ellipsis;white-space:nowrap;}
.ltb-hist.win .ltb-hist-res{color:var(--ltb-up);}.ltb-hist.loss .ltb-hist-res{color:var(--ltb-down);}

.ltb-empty{padding:11px 0;color:var(--ltb-faint);font-size:11.5px;}
.ltb-error{flex:none;padding:11px 14px;border:1px solid rgba(244,165,36,.34);border-radius:10px;
  color:#efd19d;background:rgba(244,165,36,.07);font-size:11.5px;}.ltb-error[hidden]{display:none;}
.ltb-celebrate{position:absolute;inset:0;z-index:40;display:grid;place-items:center;opacity:0;pointer-events:none;transition:opacity .35s ease;}
.ltb-celebrate.show{opacity:1;}.ltb-celebrate[hidden]{display:none;}
.ltb-celebrate-burst{display:grid;justify-items:center;gap:8px;padding:30px 46px;border:1px solid rgba(40,207,145,.4);
  border-radius:18px;background:#101a21;box-shadow:0 24px 80px rgba(0,0,0,.5);animation:ltbBurst .55s cubic-bezier(.22,1.2,.36,1);}
.ltb-celebrate-burst strong{color:var(--ltb-up);font-size:39px;font-weight:800;letter-spacing:-.03em;}
.ltb-celebrate-burst span{color:#c4ccd5;font-size:13px;}.ltb-celebrate-burst b{color:var(--ltb-gold);font-size:24px;font-weight:700;font-variant-numeric:tabular-nums;}
@keyframes ltbBurst{0%{transform:scale(.84);opacity:0}100%{transform:scale(1);opacity:1}}
.ltb-confetti{position:absolute;inset:0;overflow:hidden;}.ltb-confetti i{position:absolute;top:-6%;border-radius:2px;opacity:.9;
  animation-name:ltbFallDown;animation-timing-function:linear;animation-iteration-count:1;animation-fill-mode:forwards;}
@keyframes ltbFallDown{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(105vh) rotate(760deg);opacity:0}}

@media (max-width:1560px){
  .ltb-card{padding:17px;}.ltb-signal-stats strong{font-size:14px;}}
@media (max-width:1320px){
  .ltb-grid{grid-template-columns:repeat(2,minmax(0,1fr));}
  #ltbSignalCard{grid-column:1 / 3;grid-row:1;}#ltbLiveCard{grid-column:1 / 3;grid-row:2;}
  .ltb-chart-card{grid-column:1;grid-row:3;}#ltbSimCard{grid-column:2;grid-row:3;}
  .ltb-clock-card{grid-column:1;grid-row:4;}.ltb-specialists-card{grid-column:2;grid-row:4;}
  .ltb-phases-card{grid-column:1;grid-row:5;}.ltb-score-card{grid-column:2;grid-row:5;}
  .ltb-history-card{grid-column:1 / 3;grid-row:6;}}
@media (max-width:900px){
  .ltb-grid{grid-template-columns:1fr;}
  #ltbSignalCard{grid-column:1;grid-row:1;}#ltbLiveCard{grid-column:1;grid-row:2;}
  .ltb-chart-card{grid-column:1;grid-row:3;}#ltbSimCard{grid-column:1;grid-row:4;}
  .ltb-clock-card{grid-column:1;grid-row:5;}.ltb-specialists-card{grid-column:1;grid-row:6;}
  .ltb-phases-card{grid-column:1;grid-row:7;}.ltb-score-card{grid-column:1;grid-row:8;}
  .ltb-history-card{grid-column:1;grid-row:9;}.ltb-chart-card{height:430px;}.ltb-phases-card,.ltb-history-card{min-height:300px;}}
@media (max-width:680px){
  .ltb-root{gap:14px;padding:0 12px 16px;}.ltb-top{min-height:0;flex-wrap:wrap;padding:16px 0;}.ltb-brand{width:100%;}
  .ltb-top-live{width:100%;justify-content:space-between;}.ltb-price{text-align:left;}.ltb-price strong{font-size:26px;}
  .ltb-card{padding:15px;border-radius:14px;}.ltb-signal-main{align-items:stretch;flex-direction:column;gap:15px;}
  .ltb-conf{width:100%;min-width:0;text-align:left;}.ltb-signal-stats{grid-template-columns:1fr 1fr;}
  .ltb-clock{align-items:flex-start;flex-direction:column;}.ltb-sim-inputs{grid-template-columns:1fr;}.ltb-chart{padding:9px;}}
@media (prefers-reduced-motion:reduce){
  .ltb-root *{scroll-behavior:auto!important;}.ltb-confetti i{animation:none!important;}.ltb-celebrate-burst{animation-duration:.01s;}}
`;
      document.head.appendChild(style);
    },
  };
})();
