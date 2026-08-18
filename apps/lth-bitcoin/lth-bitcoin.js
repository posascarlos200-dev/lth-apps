// ===== LTH Bitcoin =====
// App de CONSUMO de las senales del motor. Es la version de escritorio de lo que
// el telefono ve en LTH Remote: misma fuente (canal central publico en Supabase),
// pero aprovechando la pantalla grande de una PC.
//
// Solo lectura. No publica, no liquida y no toca el historial: eso vive en
// LTH Bitcoin Admin, que sigue reservado a la PC administradora.
//
// v2 "remaster": los 4 activos (BTC/ETH/SOL/XRP) con selector, vista de los 4 a
// la vez en cuadrantes, y la tecnica/tesis/plan del motor explicada en palabras.
//
// Color: la DIRECCION es lo unico que lleva color propio — UP amarillo neon,
// DOWN rojo (ΔE 29 en deuteranopia, verificado con el validador del skill de
// visualizacion). La identidad del activo va por ticker + glifo + posicion,
// nunca por color solo, porque 4 tonos calidos se confunden entre si.
(function () {
  'use strict';

  window.LTH_APPS = window.LTH_APPS || {};

  // Los 4 activos del motor. `id` es el mismo que usa el canal (`asset`) y el
  // producto de Coinbase, asi que sirve para el feed y para las velas.
  const ASSETS = [
    { id: 'BTC-USD', ticker: 'BTC', name: 'Bitcoin', glyph: '₿', decimals: 2 },
    { id: 'ETH-USD', ticker: 'ETH', name: 'Ethereum', glyph: 'Ξ', decimals: 2 },
    { id: 'SOL-USD', ticker: 'SOL', name: 'Solana', glyph: '◎', decimals: 2 },
    { id: 'XRP-USD', ticker: 'XRP', name: 'XRP', glyph: '✕', decimals: 4 },
  ];
  const ASSET_IDS = ASSETS.map(a => a.id);
  const metaOf = (id) => ASSETS.find(a => a.id === id) || ASSETS[0];

  const CFG = {
    pollMs: 3000,             // el motor late cada ~5 s; 3 s mantiene la UI viva
    marketPollMs: 15000,      // velas de 1m completas: alimentan el grafico, no necesitan ser al segundo
    spotPollMs: 2000,         // precio suelto: es lo que mueve el marcador del target EN VIVO
    bgPollMs: 5000,           // rotacion de los activos que no estan en foco
    tfPollMs: 20000,          // temporalidades 5/15 min: no necesitan latir tan rapido
    windowMs: 15 * 60 * 1000,
    // Los mismos 3 puntos de decision reales del motor rapido.
    decisionMinutes: [5, 7, 10],
    candlesUrl: (id) => 'https://api.coinbase.com/api/v3/brokerage/market/products/'
      + id + '/candles',
    spotUrl: (id) => 'https://api.coinbase.com/v2/prices/' + id + '/spot',
    // Mismo canal publico que usa el Admin. El sondeo REST cada 2 s dejaba el
    // precio hasta 2 s viejo y la vela en curso hasta 15 s vieja; por aqui el
    // precio llega en cuanto se opera, sin pedirlo.
    coinbaseWs: 'wss://advanced-trade-ws.coinbase.com',
    wsFreshMs: 6000,          // con el WS vivo, el sondeo REST se hace a un lado
    historyLimit: 60,
    // El recuadro del grafico muestra los ULTIMOS 5 minutos, no la vela entera.
    // Con los 15 minutos completos el trazo quedaba tan comprimido que los
    // movimientos no se distinguian; con 5 se leen, y lo mas viejo se va
    // desvaneciendo por la izquierda en vez de encogerse.
    baselineWindowMs: 5 * 60 * 1000,
    pcOnlineMs: 50000,
    viewKey: 'ltb.view.v2',
    chartTfKey: 'ltb.chartTf.v1',
    themeKey: 'ltb.theme.v1',
  };

  // Temporalidades del grafico grande. El minuto 1 se queda "windowed": solo
  // dibuja la vela de 15 min en curso tick a tick (como siempre), porque ahi
  // es donde importa ver la vela construirse. 5/15 min amplian a una franja de
  // historia real en vez de una sola barra degenerada por vela.
  const CHART_TIMEFRAMES = {
    1: { key: '1', label: '1 min', granularity: 'ONE_MINUTE', lookbackSec: 90 * 60, windowed: true },
    5: { key: '5', label: '5 min', granularity: 'FIVE_MINUTE', lookbackSec: 8 * 3600, windowed: false },
    15: { key: '15', label: '15 min', granularity: 'FIFTEEN_MINUTE', lookbackSec: 30 * 3600, windowed: false },
  };
  const CHART_TF_DEFAULT = '15';

  const esc = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  // Ojo con `Number(null) === 0`: sin el guardia, un precio que todavia no
  // llego se pintaba como "$0.00" en vez de "--".
  const fmtUSD = (value, decimals = 2) => (value != null && value !== '' && isFinite(Number(value))
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

  // ── La tecnica del motor, en palabras ───────────────────────────────────
  // `live_plan` viaja en el latido con TODO lo que esta pensando el motor: que
  // configuracion trabaja esta vela, la tesis que defiende y el plan de entrada
  // que esta armando. Antes solo se leia el veredicto; aqui se traduce entero.
  const TECHNIQUES = {
    hunt: {
      name: 'CAZA EN LA APERTURA',
      how: 'Entra al abrir la vela con la tesis ya formada y la defiende con zonas de rechazo de 5 min como plan B.',
    },
    super: {
      name: 'M11 SUPER · CAZA DE PROFIT',
      how: 'Persigue el objetivo de ganancia: salta las velas que no pagan y se releva solo tras dos perdidas.',
    },
    fast: {
      name: 'V14 · CORTES 5 / 7 / 10',
      how: 'Evalua la vela por tramos y entra en el primer corte donde los especialistas se alinean.',
    },
  };

  // Lectura del consenso que llega desde el Admin, MEZCLADA con una lectura
  // propia por precio en vivo. Esta funcion solo prepara datos para la
  // interfaz: no cambia la senal, el plan ni las guardas del bot central.
  //
  // Antes exigia que el latido fuera "fresco" (misma vela + menos de 50 s de
  // antiguedad) para mostrar CUALQUIER cosa: en el minuto 0 de la vela, o si
  // el motor tardaba un latido, el panel se quedaba en un 50/50 sin sentido
  // ("siempre dice neutral"). Ahora la frescura del motor solo decide CUANTO
  // PESA su consenso en la mezcla; el precio en vivo frente a la apertura
  // aporta una lectura propia desde el primer segundo, que se va reforzando
  // segun avanza la vela y puede voltearse sola si el precio cruza de lado.
  function describeForecast(status, asset) {
    const numeric = value => value == null || value === '' ? NaN : Number(value);
    const now = Date.now();
    const currentStart = Math.floor(now / CFG.windowMs) * CFG.windowMs;
    const elapsedFrac = Math.max(0, Math.min(1, (now - currentStart) / CFG.windowMs));
    const reportedStart = Date.parse(status?.live_window_start || '');
    const analyzedAt = Date.parse(status?.live_analysis_at || status?.last_seen_at || '');
    const sameCandle = isFinite(reportedStart) && Math.abs(reportedStart - currentStart) < 60000;
    // 0 = el motor no dijo nada de ESTA vela; 1 = latido reciente. Entre medio
    // decae suave en vez de caer en seco a "no fresco" a los 50 s exactos.
    const freshWeight = sameCandle && isFinite(analyzedAt)
      ? Math.max(0, 1 - Math.max(0, now - analyzedAt) / (CFG.pcOnlineMs * 3))
      : 0;
    const specialists = Array.isArray(status?.live_specialists)
      ? status.live_specialists.filter(item => item && isFinite(numeric(item.p)))
      : [];
    let engineUp = numeric(status?.live_probability_up);
    let engineDown = numeric(status?.live_probability_down);
    if (!isFinite(engineUp) && isFinite(engineDown)) engineUp = 100 - engineDown;
    if (isFinite(engineUp) && !isFinite(engineDown)) engineDown = 100 - engineUp;
    if (!isFinite(engineUp) && specialists.length) {
      let weighted = 0;
      let weightTotal = 0;
      specialists.forEach(item => {
        const itemWeight = numeric(item.w);
        const itemProbability = numeric(item.p);
        const weight = isFinite(itemWeight) && itemWeight > 0 ? itemWeight : 1;
        weighted += Math.max(0, Math.min(100, itemProbability)) * weight;
        weightTotal += weight;
      });
      if (weightTotal) { engineUp = weighted / weightTotal; engineDown = 100 - engineUp; }
    }
    const engineReady = sameCandle && isFinite(engineUp) && isFinite(engineDown);
    const engineLean = engineReady ? (engineUp - 50) / 50 : 0; // -1..1

    // Lectura propia: cuanto se aleja el precio de la apertura, pesada por
    // cuanto ya paso de la vela (un movimiento chico al minuto 1 vale poco;
    // el mismo movimiento al minuto 13 casi no deja tiempo de revertir). Es
    // lo unico que existe desde el segundo 0, antes de que el motor reporte.
    const snapshot = typeof targetSnapshot === 'function' ? targetSnapshot({ asset }) : null;
    let priceLean = 0;
    let priceReady = false;
    if (snapshot && isFinite(snapshot.movePct)) {
      const magnitude = Math.min(1, Math.abs(snapshot.movePct) / 0.12);
      const growth = 0.35 + 0.65 * elapsedFrac;
      priceLean = Math.sign(snapshot.movePct) * magnitude * growth;
      priceReady = magnitude > 0.02;
    }

    // El consenso del motor pesa mas cuanto mas fresco esta; el precio en
    // vivo siempre aporta un minimo para poder adelantarse o corregirlo,
    // nunca depende solo de si el latido llego a tiempo.
    const engineWeight = engineReady ? Math.max(0.3, freshWeight) : 0;
    const priceWeight = Math.max(0.25, 1 - engineWeight);
    const totalWeight = engineWeight + priceWeight;
    const lean = totalWeight > 0
      ? (engineLean * engineWeight + priceLean * priceWeight) / totalWeight
      : 0;

    const ready = engineReady || priceReady;
    const upPct = ready ? Math.max(5, Math.min(95, Math.round(50 + lean * 45))) : null;
    const downPct = ready ? 100 - upPct : null;
    const direction = !ready
      ? ''
      : (upPct > downPct ? 'UP' : (downPct > upPct ? 'DOWN' : 'NEUTRAL'));
    const minute = Math.max(0, Math.min(14, Math.floor((now - currentStart) / 60000)));
    const upVotes = specialists.filter(item => numeric(item.p) > 50).length;
    const downVotes = specialists.filter(item => numeric(item.p) < 50).length;
    return {
      ready,
      up: upPct,
      down: downPct,
      direction,
      minute,
      specialists: specialists.length,
      upVotes,
      downVotes,
      engineFresh: freshWeight > 0.34,
      byPrice: !engineReady && priceReady,
      readings: specialists.map(item => ({
        label: String(item.l || item.k || 'Especialista'),
        probability: Math.round(Number(item.p)),
      })),
    };
  }

  function describeTactic(status, signal) {
    const plan = status?.live_plan && typeof status.live_plan === 'object' ? status.live_plan : null;
    const profile = String(plan?.engineProfile || 'fast').toLowerCase();
    const technique = TECHNIQUES[profile] || TECHNIQUES.fast;
    const hunt = plan?.huntPlan && typeof plan.huntPlan === 'object' ? plan.huntPlan : null;
    const superPlan = plan?.superPlan && typeof plan.superPlan === 'object' ? plan.superPlan : null;
    const superHunt = plan?.superHunt && typeof plan.superHunt === 'object' ? plan.superHunt : null;
    const detail = hunt || superPlan || null;

    const headline = String(hunt?.headline || superPlan?.headline || (plan?.planReady ? plan?.headline : '') || '').trim();
    const verdict = String(hunt?.verdict || (plan?.planReady ? plan?.verdict : '') || '').trim();
    const verdictDetail = String(hunt?.verdictDetail || '').trim();

    const side = String(detail?.side || superHunt?.side || signal?.direction || '').toUpperCase();
    const steps = [];
    const push = (label, value, tone) => {
      if (value == null || value === '' || value === '--') return;
      steps.push({ label, value: String(value), tone: tone || '' });
    };

    if (side === 'UP' || side === 'DOWN') {
      push('Lado', side === 'UP' ? '↑ UP / ARRIBA' : '↓ DOWN / ABAJO', side === 'UP' ? 'up' : 'down');
    }
    const closeProb = Number(detail?.closeProbability ?? superHunt?.confidence);
    if (isFinite(closeProb) && closeProb > 0) push('Cierre a favor', Math.round(closeProb) + '%');
    const ask = Number(hunt?.askCents);
    if (isFinite(ask) && ask > 0) push('Precio del contrato', Math.round(ask) + '¢');
    const distance = Number(hunt?.distancePct ?? superHunt?.distancePct);
    if (isFinite(distance)) push('Distancia al objetivo', distance.toFixed(2) + '%');
    const sigma = Number(hunt?.favorSigma);
    if (isFinite(sigma)) push('Fuerza a favor', sigma.toFixed(2) + ' σ');
    if (hunt?.zone) push('Zona', String(hunt.zone));
    if (superHunt?.play || superPlan?.play) push('Jugada', String(superHunt?.play || superPlan?.play));
    const rejection = Number(superHunt?.rejectionPct);
    if (isFinite(rejection)) push('Rechazo detectado', Math.round(rejection) + '%');

    // Estado del capital: es lo que separa "el motor lo esta pensando" de
    // "el motor ya entro". Sin esto el usuario no sabe si copiar la jugada.
    let stage = 'Observando la vela';
    let stageTone = 'wait';
    if (detail?.entered) { stage = 'Capital dentro'; stageTone = 'live'; }
    else if (detail?.capitalApproved) { stage = 'Aprobado · esperando el gatillo'; stageTone = 'ready'; }
    else if (hunt?.executable) { stage = 'Ejecutable a mano'; stageTone = 'ready'; }
    else if (hunt?.processing) {
      const left = Number(hunt.processRemainingSec);
      stage = 'Procesando la tesis' + (isFinite(left) && left > 0 ? ' · ' + left + ' s' : '');
      stageTone = 'wait';
    } else if (superPlan?.holding) { stage = 'Sosteniendo la posicion'; stageTone = 'live'; }

    const missing = Array.isArray(superPlan?.missing) ? superPlan.missing.filter(Boolean) : [];
    const watch = Array.isArray(plan?.watch) ? plan.watch.filter(Boolean) : [];
    const remaining = Number(detail?.remainingSec);

    const flags = [];
    if (plan?.vanguardArmed) flags.push('VANGUARDIA ARMADA');
    else if (plan?.vanguardSafety) flags.push('VANGUARDIA ON');
    if (hunt?.vanguardStrict) flags.push('ESTANDAR REFORZADO');
    if (hunt?.closed) flags.push('TESIS CERRADA');
    if (superHunt?.lateWindow) flags.push('TRAMO FINAL');
    if (superPlan?.backedRisk) flags.push('RIESGO RESPALDADO');

    return {
      ready: !!plan,
      planReady: !!plan?.planReady,
      profile,
      engine: String(plan?.engineLabel || 'V14 5/7'),
      technique: technique.name,
      how: technique.how,
      thesis: headline,
      verdict,
      verdictDetail,
      side,
      stage,
      stageTone,
      steps,
      missing,
      watch,
      remainingSec: isFinite(remaining) ? remaining : null,
      flags,
      notice: plan?.superNotice && plan.superNotice.message ? String(plan.superNotice.message) : '',
      source: hunt?.sourceReason ? String(hunt.sourceReason) : '',
    };
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

  // Velas 1m de la ventana vigente con la apertura oficial como referencia:
  // es exactamente la linea que decide ganar o perder. Se usa igual en el
  // grafico grande y en los 4 cuadrantes.
  function candleSvg(candles, openRef, options) {
    const opts = options || {};
    const rows = Array.isArray(candles) ? candles : [];
    if (rows.length < 2) return '';
    const highs = rows.map(row => row.h).concat(isFinite(openRef) ? openRef : []);
    const lows = rows.map(row => row.l).concat(isFinite(openRef) ? openRef : []);
    const max = Math.max(...highs);
    const min = Math.min(...lows);
    const span = Math.max(1e-9, max - min);
    const step = 100 / rows.length;
    const y = (price) => ((max - price) / span) * 100;

    const bars = rows.map((row, index) => {
      const x = index * step + step / 2;
      const up = row.c >= row.o;
      const bodyTop = y(Math.max(row.o, row.c));
      const bodyBottom = y(Math.min(row.o, row.c));
      const bodyHeight = Math.max(opts.mini ? 0.9 : 0.6, bodyBottom - bodyTop);
      const bodyWidth = Math.max(0.8, step * 0.62);
      return '<line x1="' + x.toFixed(2) + '" x2="' + x.toFixed(2) + '" y1="' + y(row.h).toFixed(2)
        + '" y2="' + y(row.l).toFixed(2) + '" class="wick ' + (up ? 'up' : 'down') + '"/>'
        + '<rect x="' + (x - bodyWidth / 2).toFixed(2) + '" y="' + bodyTop.toFixed(2)
        + '" width="' + bodyWidth.toFixed(2) + '" height="' + bodyHeight.toFixed(2)
        + '" class="body ' + (up ? 'up' : 'down') + '"/>';
    }).join('');

    const refLine = isFinite(openRef)
      ? '<line x1="0" x2="100" y1="' + y(openRef).toFixed(2) + '" y2="' + y(openRef).toFixed(2)
        + '" class="ltb-openline"/>'
      : '';
    return {
      svg: '<svg viewBox="0 0 100 100" preserveAspectRatio="none" class="ltb-chart-svg">'
        + refLine + bars + '</svg>',
      min, max,
    };
  }

  // Grafico "baseline" (el mismo lenguaje del medidor de arriba, extendido en
  // el tiempo): la apertura de la vela va SIEMPRE en el centro, el precio en
  // vivo dibuja una linea que se pinta verde por encima y roja por debajo. La
  // tecnica es la del "mountain/baseline chart": dos trazos, cada uno con su
  // Y recortada (`clamp`) al nivel de la apertura donde el precio esta del
  // otro lado — asi la parte "apagada" de cada trazo queda pegada a la
  // apertura en vez de dibujarse por debajo/encima como si fuera real.
  //
  // El eje X es por TIEMPO (no por indice de muestra): el ultimo punto se
  // estira hasta "ahora" en cada repintado, asi la linea sigue avanzando
  // sola entre un tick del spot y el siguiente en vez de quedarse fija.
  //
  // `lookbackMs` acota la ventana a una franja RODANTE reciente (por ejemplo
  // los ultimos 4 min) en vez de "desde que abrio la vela": sin esto, pasados
  // varios minutos la linea quedaba pegada al borde izquierdo con un tramo
  // plano larguisimo y el punto (lo unico que importa ver en vivo) se
  // apretaba contra el borde derecho.
  // Traza una curva suave que PASA por todos los puntos reales (Catmull-Rom
  // convertido a bezier). No inventa datos: solo redondea las esquinas entre
  // muestra y muestra, que es lo que hacia que el trazo se viera "por cortes"
  // cuando el precio llega cada dos segundos.
  function smoothPath(points) {
    if (!points.length) return '';
    if (points.length < 3) {
      return 'M' + points.map(p => p.x.toFixed(2) + ',' + p.y.toFixed(2)).join(' L');
    }
    // Interpolacion monotona (Fritsch-Carlson).
    //
    // El suavizado anterior (Catmull-Rom) podia PASARSE del valor de los puntos
    // que unia: tras una subida fuerte seguida de un tramo plano dibujaba un
    // pico y un doblez que no existieron. En un grafico de precios eso no es un
    // defecto estetico, es dibujar un maximo que nunca ocurrio.
    //
    // Esta version calcula las pendientes de forma que la curva NUNCA se sale
    // del rango de los dos puntos que une. Sigue pasando por todos los puntos
    // reales; simplemente ya no se inventa nada entre ellos.
    const n = points.length;
    const dx = new Array(n - 1);
    const pend = new Array(n - 1);
    for (let i = 0; i < n - 1; i++) {
      dx[i] = points[i + 1].x - points[i].x;
      pend[i] = dx[i] === 0 ? 0 : (points[i + 1].y - points[i].y) / dx[i];
    }
    const t = new Array(n);
    t[0] = pend[0];
    t[n - 1] = pend[n - 2];
    for (let i = 1; i < n - 1; i++) {
      // Si el precio cambia de sentido en este punto, la tangente es plana: asi
      // el maximo o el minimo queda EXACTAMENTE en el dato, sin sobrepasarlo.
      if (pend[i - 1] * pend[i] <= 0) { t[i] = 0; continue; }
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      t[i] = (w1 + w2) / (w1 / pend[i - 1] + w2 / pend[i]);
    }
    let d = 'M' + points[0].x.toFixed(2) + ',' + points[0].y.toFixed(2);
    for (let i = 0; i < n - 1; i++) {
      const paso = dx[i] / 3;
      const c1x = points[i].x + paso;
      const c1y = points[i].y + t[i] * paso;
      const c2x = points[i + 1].x - paso;
      const c2y = points[i + 1].y - t[i + 1] * paso;
      d += ' C' + c1x.toFixed(2) + ',' + c1y.toFixed(2)
        + ' ' + c2x.toFixed(2) + ',' + c2y.toFixed(2)
        + ' ' + points[i + 1].x.toFixed(2) + ',' + points[i + 1].y.toFixed(2);
    }
    return d;
  }

  // Estructura vacia del grafico de un cuadrante. Se escribe UNA vez y despues
  // solo se le cambian los atributos: reconstruir el nodo entero varias veces
  // por segundo es lo que hacia que el trazo pareciera avanzar a tirones.
  // La capa existe para que el trazo y la pelota compartan EXACTAMENTE la misma
  // caja. El recuadro del grafico tiene 6 px de relleno: el SVG se dibujaba
  // dentro del relleno y la pelota, al ser un elemento absoluto, media sus
  // porcentajes contra la caja de fuera. Por eso iba descuadrada de la punta de
  // la linea, y mas cuanto mas cerca del borde.
  const BASELINE_SKELETON = '<div class="ltb-baseline-layer">'
    + '<svg viewBox="0 0 100 100" preserveAspectRatio="none" class="ltb-baseline-svg">'
    + '<path class="ltb-baseline-fill up" d=""/>'
    + '<path class="ltb-baseline-fill down" d=""/>'
    + '<path class="ltb-baseline-line up" d=""/>'
    + '<path class="ltb-baseline-line down" d=""/>'
    + '<line x1="0" x2="100" y1="50" y2="50" class="ltb-baseline-ref"/>'
    + '</svg>'
    + '<i class="ltb-baseline-dot"></i>'
    + '</div>'
    + '<span class="ltb-q-open"></span>'
    + '<span class="ltb-q-dev"></span>';

  // El eje de tiempo arranca SIEMPRE en la apertura de la vela y se estira
  // hasta ahora. Dos correcciones en una:
  //
  //   * Antes era una ventana rodante de 4 minutos, asi que pasado el minuto 4
  //     la parte vieja de la vela se iba cortando por detras. Anclado en la
  //     apertura, no se pierde nada de la vela.
  //   * Con el eje fijo a los 15 minutos completos, el trazo ocupaba solo la
  //     fraccion ya corrida y avanzaba a paso de tortuga por la tarjeta. Al
  //     estirar hasta "ahora", el dibujo llena el ancho desde el principio y se
  //     mueve con cada precio que entra.
  function baselineSvg(samples, target, windowStart, spanMs, scale) {
    const now = Date.now();
    const apertura = isFinite(windowStart) ? windowStart : NaN;
    if (!isFinite(apertura)) return null;
    const ventana = Math.max(60000, Number(spanMs) || 0);
    // Ventana rodante: arranca en la apertura de la vela y, pasados los 5
    // minutos, empieza a avanzar dejando atras lo mas viejo. Asi el trazo
    // conserva siempre el mismo detalle en vez de comprimirse segun corre la
    // vela. El borde izquierdo se desvanece por CSS para que lo que sale lo
    // haga difuminandose, no cortado de golpe.
    const t0 = Math.max(apertura, now - ventana);
    const span = Math.max(15000, now - t0);
    const rows = (Array.isArray(samples) ? samples : [])
      .filter(row => row && isFinite(Number(row.t)) && isFinite(Number(row.p)) && Number(row.p) > 0
        && row.t >= t0 && row.t <= now)
      .sort((a, b) => a.t - b.t);
    if (rows.length < 2 || !isFinite(target) || target <= 0) return null;

    // El cierre mapea a 97, no a 100: deja aire a la derecha para que el punto
    // (con su brillo) no quede pegado al borde y se lo corte el
    // overflow:hidden del recuadro.
    const NOW_X = Math.max(0, Math.min(97, ((now - t0) / span) * 97));
    const x = (t) => Math.max(0, Math.min(97, ((t - t0) / span) * 97));

    const movePct = (p) => ((p - target) / target) * 100;
    const maxDeviation = Math.max(0.02, ...rows.map(row => Math.abs(movePct(row.p))));
    const desiredRange = maxDeviation * 1.25;
    // La escala vertical solo puede crecer de golpe (un extremo nuevo es real y
    // hay que mostrarlo); encoger lo hace despacio. Antes, cuando el extremo se
    // salia de la ventana de 4 minutos, la escala volvia a su sitio de un tiron
    // y toda la linea daba un salto.
    let range = desiredRange;
    if (scale && scale.key === windowStart && isFinite(Number(scale.range)) && Number(scale.range) > 0) {
      const previous = Number(scale.range);
      range = Math.max(desiredRange, previous - (previous - desiredRange) * 0.03);
    }
    if (scale) { scale.key = windowStart; scale.range = range; }
    const y = (p) => Math.max(2, Math.min(98, 50 - (movePct(p) / range) * 48));

    const points = rows.map(row => ({ x: x(row.t), y: y(row.p) }));
    const last = points[points.length - 1];
    // Estira el ultimo punto hasta "ahora" (el borde con aire): sin esto la
    // linea se quedaba corta y parecia atrasada entre tick y tick.
    if (last.x < NOW_X - 0.5) points.push({ x: NOW_X, y: last.y });

    const above = points.map(p => ({ x: p.x, y: Math.min(p.y, 50) }));
    const below = points.map(p => ({ x: p.x, y: Math.max(p.y, 50) }));
    const firstX = points[0].x.toFixed(2);
    const lastX = points[points.length - 1].x.toFixed(2);
    const abovePath = smoothPath(above);
    const belowPath = smoothPath(below);
    const lastUp = last.y < 50;

    return {
      // El guia punteado de la apertura va AL FINAL (encima): las dos lineas
      // de color se "aplanan" contra el mismo y=50 donde el precio esta del
      // otro lado, y si el guia se dibuja primero esos tramos aplanados lo
      // tapan por completo (se veia como si la apertura fuera roja o verde
      // en vez de neutral).
      svg: '<svg viewBox="0 0 100 100" preserveAspectRatio="none" class="ltb-baseline-svg">'
        + '<path d="M' + firstX + ',50 ' + abovePath.slice(1) + ' L' + lastX + ',50 Z" class="ltb-baseline-fill up"/>'
        + '<path d="M' + firstX + ',50 ' + belowPath.slice(1) + ' L' + lastX + ',50 Z" class="ltb-baseline-fill down"/>'
        + '<path d="' + abovePath + '" class="ltb-baseline-line up"/>'
        + '<path d="' + belowPath + '" class="ltb-baseline-line down"/>'
        + '<line x1="0" x2="100" y1="50" y2="50" class="ltb-baseline-ref"/>'
        + '</svg>',
      // Los mismos trazos sueltos, para poder refrescarlos en sitio (sin
      // reconstruir el nodo) varias veces por segundo: es lo que hace que la
      // linea se deslice en vez de avanzar a saltos.
      paths: {
        fillUp: 'M' + firstX + ',50 ' + abovePath.slice(1) + ' L' + lastX + ',50 Z',
        fillDown: 'M' + firstX + ',50 ' + belowPath.slice(1) + ' L' + lastX + ',50 Z',
        lineUp: abovePath,
        lineDown: belowPath,
      },
      // Coordenadas del ultimo punto en el MISMO 0-100 del viewBox: al ser
      // porcentaje puro, sirven tal cual como left/top de un marcador HTML
      // (un <circle> de SVG saldria ovalado por el preserveAspectRatio="none"
      // sobre un contenedor que no es cuadrado).
      lastX: last.x, lastY: last.y, lastUp, maxDeviation,
    };
  }

  // Mismo target de la web: el centro es la apertura de la vela de 15 min y
  // el punto se desplaza a la izquierda/derecha segun el precio vivo. El rango
  // se adapta a lo que ya recorrio la vela para que un movimiento pequeno siga
  // siendo legible sin exagerar ni salirse de la pista.
  function targetSnapshot(read) {
    const market = read?.asset?.market;
    const currentPrice = Number(market?.price);
    const candles = Array.isArray(market?.candles) ? market.candles : [];
    const marketAt = Number(market?.at);
    if (!isFinite(currentPrice) || !candles.length || !isFinite(marketAt)
      || marketAt <= 0 || Date.now() - marketAt > CFG.marketPollMs * 3) return null;

    const windowStart = Math.floor(Date.now() / CFG.windowMs) * CFG.windowMs;
    const rows = candles.filter(row => row.t >= windowStart && row.t < windowStart + CFG.windowMs);
    if (!rows.length) return null;

    // La barra web siempre usa la apertura de la vela ACTUAL. No se toma la
    // apertura de una senal porque una fila aun marcada `open` puede pertenecer
    // a la vela anterior mientras el servidor confirma su resultado.
    const target = Number(rows[0].o);
    if (!isFinite(target) || target <= 0) return null;

    const high = Math.max(target, currentPrice, ...rows.map(row => Number(row.h)).filter(isFinite));
    const low = Math.min(target, currentPrice, ...rows.map(row => Number(row.l)).filter(isFinite));
    const move = currentPrice - target;
    const movePct = (move / target) * 100;
    const observedRangePct = Math.max(
      Math.abs(((high - target) / target) * 100),
      Math.abs(((low - target) / target) * 100)
    );
    const displayRangePct = Math.max(0.06, observedRangePct * 1.18, Math.abs(movePct) * 1.22);
    const position = Math.max(4, Math.min(96,
      50 + Math.max(-1, Math.min(1, movePct / displayRangePct)) * 44));

    return { target, currentPrice, move, movePct, position };
  }

  // Sube con cada publicacion en la Store: sella la hoja de estilos para que
  // una actualizacion no se quede con el CSS de la version anterior.
  const APP_VERSION = '2.6.1';

  window.LTH_APPS['lth-bitcoin'] = {
    name: 'LTH Bitcoin',
    version: APP_VERSION,
    icon: '₿',
    gradient: 'linear-gradient(135deg,#e8ff26 0%,#ffa31a 48%,#ff2d46 100%)',

    state: null,

    render(container) {
      this._closed = false;
      this.state = {
        view: this._loadView(),          // 'BTC-USD' ... 'XRP-USD' | 'ALL'
        chartTf: this._loadChartTf(),    // '15' | '5' | '1' — temporalidad del grafico grande
        theme: this._loadTheme(),        // 'dark' | 'light'
        assets: {},
        sim: this._loadSim(),
        simResult: null,
      };
      ASSET_IDS.forEach(id => { this.state.assets[id] = this._blankAsset(); });
      this._seenOutcomes = new Map();   // para detectar el momento exacto de una victoria
      this._celebrating = false;
      this._sigCache = new Map();       // evita repintar listas que no cambiaron
      this._timers = [];
      this._rr = 0;
      this._bgRr = 0;
      this._marketRr = 0;
      this._buildDom(container);
      this._bind();
      this._applyTheme();
      this._applyView();
      this._paintChartTfButtons();
      this._tickFeed();
      this._tickMarket();
      this._tickSpot();
      this._tickChartTf();
      this._timers.push(setInterval(() => this._tickFeed(), CFG.pollMs));
      this._timers.push(setInterval(() => this._tickMarket(), CFG.marketPollMs));
      this._timers.push(setInterval(() => this._tickSpot(), CFG.spotPollMs));
      this._timers.push(setInterval(() => this._tickBackground(), CFG.bgPollMs));
      this._timers.push(setInterval(() => this._tickChartTf(), CFG.tfPollMs));
      this._timers.push(setInterval(() => this._paint(), 1000));
      this._connectTickerWs();
      this._syncQuadFlow();

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
      if (this._quadFlow) { cancelAnimationFrame(this._quadFlow); this._quadFlow = null; }
      if (this._zoomKey) { document.removeEventListener('keydown', this._zoomKey); this._zoomKey = null; }
      if (this._wsRetryTimer) { clearTimeout(this._wsRetryTimer); this._wsRetryTimer = null; }
      try { if (this._ws) { this._ws.onclose = null; this._ws.close(1000); } } catch (error) { /* ya cerrado */ }
      this._ws = null;
      if (this._abortHandler && window._appSignal) {
        window._appSignal.removeEventListener('abort', this._abortHandler);
      }
      this._abortHandler = null;
    },

    _blankAsset() {
      return {
        stream: null,
        signals: [],
        statuses: [],
        // `candles` es SIEMPRE 1 min (precio en vivo + reloj + meta de target,
        // que necesitan velas finas dentro de la ventana). `tfCandles` es la
        // temporalidad que el usuario eligio (5/15 min), solo para el grafico
        // grande cuando no esta en 1 min. `priceSamples` es el trazo fino de
        // precio suelto (cada ~2 s) que dibuja el grafico "baseline" de LOS 4.
        market: { price: null, candles: [], at: 0, tfCandles: [], tfKey: null, tfAt: 0, priceSamples: [] },
        link: null,        // diagnostico de por que no hay datos, si aplica
        loading: true,
      };
    },

    _$(selector) { return this._root ? this._root.querySelector(selector) : null; },
    _asset(id) { return this.state.assets[id] || this._blankAsset(); },
    _focusId() { return this.state.view === 'ALL' ? ASSET_IDS[0] : this.state.view; },
    _focusIds() { return this.state.view === 'ALL' ? ASSET_IDS.slice() : [this.state.view]; },

    _loadView() {
      try {
        const raw = String(localStorage.getItem(CFG.viewKey) || '');
        return raw === 'ALL' || ASSET_IDS.includes(raw) ? raw : 'BTC-USD';
      } catch (error) { return 'BTC-USD'; }
    },

    _saveView() {
      try { localStorage.setItem(CFG.viewKey, this.state.view); }
      catch (error) { /* sin espacio: la vista sigue viva en memoria */ }
    },

    _loadChartTf() {
      try {
        const raw = String(localStorage.getItem(CFG.chartTfKey) || '');
        return CHART_TIMEFRAMES[raw] ? raw : CHART_TF_DEFAULT;
      } catch (error) { return CHART_TF_DEFAULT; }
    },

    _saveChartTf() {
      try { localStorage.setItem(CFG.chartTfKey, this.state.chartTf); }
      catch (error) { /* sin espacio: la temporalidad sigue viva en memoria */ }
    },

    // ── Apariencia ──────────────────────────────────────────────────────────
    // El tema es puro CSS: se marca la raiz y las variables de color cambian de
    // valor. Ningun componente necesita enterarse.
    _loadTheme() {
      try {
        const raw = String(localStorage.getItem(CFG.themeKey) || '');
        return raw === 'light' ? 'light' : 'dark';
      } catch (error) { return 'dark'; }
    },

    _saveTheme() {
      try { localStorage.setItem(CFG.themeKey, this.state.theme); }
      catch (error) { /* sin espacio: el tema sigue vivo en memoria */ }
    },

    _applyTheme() {
      if (!this._root) return;
      const light = this.state.theme === 'light';
      this._root.classList.toggle('light', light);
      const dark = this._$('#ltbThemeDark');
      const claro = this._$('#ltbThemeLight');
      if (dark) dark.classList.toggle('active', !light);
      if (claro) claro.classList.toggle('active', light);
    },

    _setTheme(next) {
      const value = next === 'light' ? 'light' : 'dark';
      if (value === this.state.theme) return;
      this.state.theme = value;
      this._saveTheme();
      this._applyTheme();
    },

    _toggleSettings(open) {
      const panel = this._$('#ltbSettings');
      const gear = this._$('#ltbGear');
      if (!panel) return;
      const show = open == null ? panel.hidden : !!open;
      panel.hidden = !show;
      if (gear) gear.setAttribute('aria-expanded', show ? 'true' : 'false');
    },

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
    _detectWins() {
      const first = !this._seenOutcomes.size;
      let justWon = null;
      let wonAsset = null;
      for (const id of ASSET_IDS) {
        for (const row of this._asset(id).signals || []) {
          if (!row || row.id == null) continue;
          const key = id + ':' + row.id;
          const status = String(row.status || 'open').toLowerCase();
          const before = this._seenOutcomes.get(key);
          if (!first && before && before !== status && status === 'won') {
            justWon = row; wonAsset = id;
          }
          this._seenOutcomes.set(key, status);
        }
      }
      if (justWon) this._celebrate(justWon, wonAsset);
    },

    _celebrate(signal, assetId) {
      if (this._celebrating || !this._root) return;
      const layer = this._$('#ltbCelebrate');
      if (!layer) return;
      this._celebrating = true;
      const meta = metaOf(assetId);
      const profit = assetId === this._focusId() && this.state.simResult && this.state.simResult.lastTrade
        ? this.state.simResult.lastTrade.net
        : null;
      const pieces = Array.from({ length: 46 }, () => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.5;
        const duration = 1.6 + Math.random() * 1.4;
        const color = ['#e8ff26', '#ffa31a', '#ff2d46', '#fff7a1'][Math.floor(Math.random() * 4)];
        const size = 6 + Math.random() * 8;
        return '<i style="left:' + left.toFixed(2) + '%;animation-delay:' + delay.toFixed(2)
          + 's;animation-duration:' + duration.toFixed(2) + 's;background:' + color + ';'
          + 'width:' + size.toFixed(0) + 'px;height:' + (size * 0.6).toFixed(0) + 'px;"></i>';
      }).join('');
      layer.innerHTML = '<div class="ltb-celebrate-burst">'
        + '<em>' + esc(meta.ticker) + '</em>'
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
      const rail = ASSETS.map(asset => `
        <button class="ltb-tab" type="button" data-view="${asset.id}">
          <span class="ltb-tab-glyph">${asset.glyph}</span>
          <span class="ltb-tab-id">
            <strong>${asset.ticker}</strong>
            <small class="js-price">--</small>
          </span>
          <span class="ltb-tab-dot js-dot" aria-hidden="true"></span>
        </button>`).join('');

      const quads = ASSETS.map(asset => `
        <article class="ltb-q" data-q="${asset.id}" tabindex="0" role="button">
          <header class="ltb-q-head">
            <span class="ltb-q-glyph">${asset.glyph}</span>
            <span class="ltb-q-id"><strong>${asset.ticker}</strong><small>${asset.name}</small></span>
            <span class="ltb-q-price"><strong class="js-price">--</strong><small class="js-engine">--</small></span>
          </header>
          <div class="ltb-q-signal js-signal"></div>
          <div class="ltb-q-chart js-chart"></div>
          <div class="ltb-q-tactic js-tactic"></div>
          <div class="ltb-q-foot">
            <span class="js-risk">Riesgo --</span>
            <span class="js-record">--</span>
          </div>
          <div class="ltb-q-dots js-dots" role="img"
            aria-label="Historial de velas liquidadas: verde ganada, rojo perdida"></div>
        </article>`).join('');

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
    <div class="ltb-target-meter waiting" id="ltbTargetMeter"
      role="img" aria-label="Precio actual comparado con la apertura de la vela">
      <div class="ltb-target-timer" aria-hidden="true">
        <span>VELA 15 MIN</span>
        <strong id="ltbTargetTimerValue">15:00</strong>
        <i id="ltbTargetTimerProgress"></i>
      </div>
      <div class="ltb-target-track">
        <i class="ltb-target-fill" id="ltbTargetFill"></i>
        <span class="ltb-target-center" aria-hidden="true"></span>
        <span class="ltb-target-marker" id="ltbTargetMarker" aria-hidden="true"></span>
      </div>
    </div>
    <div class="ltb-top-live">
      <div class="ltb-candleclock" id="ltbCandleClock" role="timer"
        aria-label="Tiempo que le queda a la vela de 15 minutos">
        <span class="ltb-candleclock-tag">VELA 15 MIN</span>
        <strong id="ltbCandleClockValue">--:--</strong>
        <i class="ltb-candleclock-track"><b id="ltbCandleClockFill"></b></i>
      </div>
      <div class="ltb-price">
        <span id="ltbPriceLabel">BTC-USD</span>
        <strong id="ltbPrice">--</strong>
      </div>
      <div class="ltb-link" id="ltbLink">
        <i></i><span id="ltbLinkText">Conectando</span>
      </div>
      <button class="ltb-gear" id="ltbGear" type="button"
        aria-haspopup="dialog" aria-expanded="false" aria-label="Ajustes" title="Ajustes">&#9881;</button>
    </div>
  </header>
  <div class="ltb-settings" id="ltbSettings" role="dialog" aria-label="Ajustes" hidden>
    <header class="ltb-settings-head">
      <strong>Ajustes</strong>
      <button class="ltb-settings-close" id="ltbSettingsClose" type="button" aria-label="Cerrar">&#10005;</button>
    </header>
    <section class="ltb-settings-block">
      <h3>Apariencia</h3>
      <p>Elige como se ve la app. Se recuerda para la proxima vez.</p>
      <div class="ltb-theme-row">
        <button class="ltb-theme-btn" id="ltbThemeDark" type="button" data-theme="dark">
          <i class="ltb-theme-chip dark" aria-hidden="true"></i>
          <span>Modo oscuro</span>
        </button>
        <button class="ltb-theme-btn" id="ltbThemeLight" type="button" data-theme="light">
          <i class="ltb-theme-chip light" aria-hidden="true"></i>
          <span>Modo claro</span>
        </button>
      </div>
    </section>
  </div>

  <nav class="ltb-rail" id="ltbRail" aria-label="Activos del motor">
    ${rail}
    <button class="ltb-tab ltb-tab-all" type="button" data-view="ALL">
      <span class="ltb-tab-grid" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <span class="ltb-tab-id"><strong>LOS 4</strong><small>pantalla dividida</small></span>
    </button>
  </nav>

  <div class="ltb-quad" id="ltbQuad" hidden>${quads}</div>
  <div class="ltb-zoom" id="ltbZoom" role="dialog" aria-label="Grafico ampliado" hidden>
    <div class="ltb-zoom-card">
      <header class="ltb-zoom-head">
        <span class="ltb-zoom-glyph" id="ltbZoomGlyph"></span>
        <div class="ltb-zoom-id">
          <strong id="ltbZoomTicker">--</strong>
          <small id="ltbZoomName">--</small>
        </div>
        <div class="ltb-zoom-price">
          <strong id="ltbZoomPrice">--</strong>
          <small id="ltbZoomMove">--</small>
        </div>
        <div class="ltb-zoom-clock">
          <span>CIERRA EN</span>
          <strong id="ltbZoomClock">--:--</strong>
        </div>
        <button class="ltb-zoom-close" id="ltbZoomClose" type="button" aria-label="Cerrar">&#10005;</button>
      </header>
      <div class="ltb-zoom-chart" id="ltbZoomChart"></div>
      <footer class="ltb-zoom-foot">
        <span id="ltbZoomOpen">apertura --</span>
        <span id="ltbZoomRange">rango --</span>
        <span id="ltbZoomThesis">--</span>
      </footer>
    </div>
  </div>

  <div class="ltb-grid" id="ltbSolo">
    <article class="ltb-card ltb-signal" id="ltbSignalCard">
      <div class="ltb-card-head">
        <span class="ltb-eyebrow">SENAL DEL MOTOR &middot; <b id="ltbSignalAsset">BTC</b></span>
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
        <div><span>Entrada</span><strong id="ltbEntryPrice">--</strong></div>
        <div><span>Resultado</span><strong id="ltbResult">--</strong></div>
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
          <span class="ltb-clock-badge" id="ltbClockBadge">EN ESPERA</span>
          <strong id="ltbClockTitle">Esperando la proxima indicacion</strong>
          <p id="ltbClockText">El motor evalua el primer bloque de 5 min de cada vela.</p>
        </div>
      </div>
    </article>

    <article class="ltb-card ltb-tactic-card" id="ltbTacticCard">
      <div class="ltb-card-head">
        <span class="ltb-eyebrow">TECNICA DEL MOTOR</span>
        <span class="ltb-chip" id="ltbEngineChip">--</span>
      </div>
      <strong class="ltb-technique" id="ltbTechnique">Esperando al motor</strong>
      <p class="ltb-technique-how" id="ltbTechniqueHow">La app describira la tecnica en cuanto el motor lata.</p>
      <div class="ltb-flags" id="ltbFlags" hidden></div>
      <div class="ltb-thesis" id="ltbThesis">
        <span class="ltb-eyebrow">TESIS DE LA VELA</span>
        <strong id="ltbThesisVerdict">Construyendo la tesis</strong>
        <p id="ltbThesisText">Sin tesis publicada todavia.</p>
      </div>
      <div class="ltb-forecast waiting" id="ltbForecast" aria-live="polite">
        <div class="ltb-forecast-head">
          <span class="ltb-eyebrow">PROBABILIDAD DE CIERRE</span>
          <span class="ltb-forecast-chip" id="ltbForecastChip">ANALISIS INTERNO</span>
        </div>
        <div class="ltb-forecast-main">
          <strong id="ltbForecastDirection">--</strong>
          <span id="ltbForecastPhase">Desde el minuto 0 de la vela</span>
        </div>
        <div class="ltb-forecast-track" aria-hidden="true">
          <i class="down" id="ltbForecastDownBar"></i>
          <i class="up" id="ltbForecastUpBar"></i>
        </div>
        <div class="ltb-forecast-legend">
          <span class="down">DOWN <b id="ltbForecastDown">--%</b></span>
          <span class="up">UP <b id="ltbForecastUp">--%</b></span>
        </div>
        <div class="ltb-forecast-specialists" id="ltbForecastSpecialists"></div>
        <p id="ltbForecastNote">Esperando la lectura de los especialistas de esta vela.</p>
      </div>
      <div class="ltb-plan">
        <div class="ltb-plan-head">
          <span class="ltb-eyebrow">PLAN A EJECUTAR</span>
          <span class="ltb-stage" id="ltbStage">Observando</span>
        </div>
        <div class="ltb-plan-grid" id="ltbPlanGrid">
          <div class="ltb-empty">El plan aparece cuando el motor arma una entrada.</div>
        </div>
        <ul class="ltb-watch" id="ltbWatch" hidden></ul>
        <p class="ltb-notice" id="ltbNotice" hidden></p>
      </div>
    </article>

    <article class="ltb-card ltb-chart-card">
      <div class="ltb-card-head">
        <div class="ltb-chart-head-left">
          <span class="ltb-eyebrow">GRAFICO EN VIVO</span>
          <div class="ltb-tf-group" id="ltbTfGroup" role="group" aria-label="Temporalidad del grafico">
            <button type="button" class="ltb-tf-btn" data-tf="15">15m</button>
            <button type="button" class="ltb-tf-btn" data-tf="5">5m</button>
            <button type="button" class="ltb-tf-btn" data-tf="1">1m</button>
          </div>
        </div>
        <span class="ltb-chip" id="ltbChartNote">Coinbase</span>
      </div>
      <div class="ltb-chart" id="ltbChart"></div>
    </article>

    <article class="ltb-card ltb-live" id="ltbLiveCard">
      <div class="ltb-card-head">
        <span class="ltb-eyebrow">ANALISIS EN VIVO</span>
        <span class="ltb-chip" id="ltbRegime">--</span>
      </div>
      <div class="ltb-risk" id="ltbRisk">
        <div class="ltb-risk-copy">
          <span>RIESGO DE RECHAZO</span>
          <strong id="ltbRiskValue">--%</strong>
        </div>
        <div class="ltb-risk-track"><i id="ltbRiskBar"></i></div>
        <small id="ltbRiskNote">Mide si la vela puede darse la vuelta antes del cierre.</small>
      </div>
      <p class="ltb-reasoning" id="ltbReasoning" hidden></p>
      <div class="ltb-spec-health" id="ltbSpecHealth" hidden></div>
      <div class="ltb-specialists" id="ltbSpecialists">
        <div class="ltb-empty">Sin especialistas con datos todavia.</div>
      </div>
    </article>

    <article class="ltb-card ltb-phases-card">
      <div class="ltb-card-head"><span class="ltb-eyebrow">CAPAS DEL MOTOR</span></div>
      <div class="ltb-phases" id="ltbPhases">
        <div class="ltb-empty">Sin datos todavia.</div>
      </div>
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

    <article class="ltb-card ltb-sim-card" id="ltbSimCard">
      <div class="ltb-card-head">
        <span class="ltb-eyebrow">SIMULADOR &middot; DINERO FICTICIO</span>
        <span class="ltb-chip" id="ltbSimTrades">0</span>
      </div>
      <div class="ltb-sim-top">
        <div class="ltb-sim-balance">
          <span>SALDO SIMULADO</span>
          <strong id="ltbSimBalance">$100.00</strong>
          <em id="ltbSimProfit">--</em>
        </div>
        <div class="ltb-sim-curve" id="ltbSimCurve"></div>
      </div>
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
  </div>

  <div class="ltb-error" id="ltbError" hidden></div>
  <div class="ltb-celebrate" id="ltbCelebrate" hidden aria-live="polite"></div>
</div>`;
      this._root = container.querySelector('.ltb-root');
      this._injectStyles();
    },

    _bind() {
      const zoom = this._$('#ltbZoom');
      if (zoom) {
        zoom.addEventListener('click', (event) => {
          if (event.target === zoom || event.target.closest('#ltbZoomClose')) this._closeZoom();
        });
      }
      this._zoomKey = (event) => { if (event.key === 'Escape') this._closeZoom(); };
      document.addEventListener('keydown', this._zoomKey);

      const gear = this._$('#ltbGear');
      if (gear) gear.addEventListener('click', () => this._toggleSettings());
      const close = this._$('#ltbSettingsClose');
      if (close) close.addEventListener('click', () => this._toggleSettings(false));
      const panel = this._$('#ltbSettings');
      if (panel) {
        panel.addEventListener('click', (event) => {
          const button = event.target.closest('[data-theme]');
          if (!button) return;
          this._setTheme(button.getAttribute('data-theme'));
        });
      }
      // Un clic fuera cierra el panel; dentro, no.
      if (this._root) {
        this._root.addEventListener('click', (event) => {
          const dentro = event.target.closest('#ltbSettings, #ltbGear');
          if (!dentro) this._toggleSettings(false);
        });
      }
      const rail = this._$('#ltbRail');
      if (rail) {
        rail.addEventListener('click', (event) => {
          const button = event.target.closest('[data-view]');
          if (!button) return;
          this._setView(button.getAttribute('data-view'));
        });
      }
      const quad = this._$('#ltbQuad');
      if (quad) {
        // Un cuadrante es tambien el atajo para abrir ese activo a pantalla
        // completa: es el gesto que el usuario espera al ver algo interesante.
        const open = (event) => {
          const panel = event.target.closest('[data-q]');
          if (!panel) return;
          this._openZoom(panel.getAttribute('data-q'));
        };
        quad.addEventListener('click', open);
        quad.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(event); }
        });
      }

      const tfGroup = this._$('#ltbTfGroup');
      if (tfGroup) {
        tfGroup.addEventListener('click', (event) => {
          const btn = event.target.closest('[data-tf]');
          if (!btn) return;
          this._setChartTf(btn.getAttribute('data-tf'));
        });
      }

      // Los parametros del simulador se guardan localmente; nada de esto viaja
      // al canal ni afecta al motor.
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

    _setView(view) {
      const next = view === 'ALL' || ASSET_IDS.includes(view) ? view : 'BTC-USD';
      if (next === this.state.view) return;
      this.state.view = next;
      this._saveView();
      this._sigCache.clear();
      this._applyView();
      // El activo recien enfocado no espera al siguiente sondeo.
      this._focusIds().forEach(id => { this._loadFeed(id); this._loadMarket(id); });
      this._tickSpot();
      this._tickChartTf();
      this._paint();
      this._syncQuadFlow();
    },

    // Los 4 cuadrantes se redibujan a ~20 por segundo mientras esa vista esta
    // en pantalla. No pide datos nuevos: el eje de tiempo depende del reloj, y
    // repintarlo seguido es lo que hace que la linea se deslice en vez de dar
    // un salto cada vez que llega un precio. Fuera de esa vista el bucle no
    // existe, asi que no gasta nada.
    _syncQuadFlow() {
      const wanted = this.state.view === 'ALL' && !this._closed;
      if (wanted && !this._quadFlow) {
        const tick = () => {
          if (this._closed || this.state.view !== 'ALL') { this._quadFlow = null; return; }
          this._quadFlow = requestAnimationFrame(tick);
          const now = Date.now();
          if (now - (this._quadFlowAt || 0) < 50) return;
          this._quadFlowAt = now;
          this._paintCandleClock();
          if (this._zoom) this._paintZoom();
          ASSET_IDS.forEach(id => {
            const panel = this._root && this._root.querySelector('[data-q="' + id + '"]');
            if (panel) this._paintQuadChart(this._read(id), panel);
          });
        };
        this._quadFlow = requestAnimationFrame(tick);
      } else if (!wanted && this._quadFlow) {
        cancelAnimationFrame(this._quadFlow);
        this._quadFlow = null;
      }
    },

    // El usuario elige la temporalidad del grafico grande (15/5/1 min). Vive
    // aparte de `view`: cambiar de activo no la reinicia.
    _setChartTf(tfKey) {
      const next = CHART_TIMEFRAMES[tfKey] ? tfKey : CHART_TF_DEFAULT;
      if (next === this.state.chartTf) return;
      this.state.chartTf = next;
      this._saveChartTf();
      this._paintChartTfButtons();
      this._tickChartTf();
      this._paint();
    },

    _paintChartTfButtons() {
      const group = this._$('#ltbTfGroup');
      if (!group) return;
      group.querySelectorAll('[data-tf]').forEach(btn => {
        const active = btn.getAttribute('data-tf') === this.state.chartTf;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    },

    _applyView() {
      const all = this.state.view === 'ALL';
      const solo = this._$('#ltbSolo');
      const quad = this._$('#ltbQuad');
      if (solo) solo.hidden = all;
      if (quad) quad.hidden = !all;
      if (this._root) this._root.classList.toggle('all-mode', all);
      (this._root ? this._root.querySelectorAll('.ltb-tab') : []).forEach(tab => {
        const active = tab.getAttribute('data-view') === this.state.view;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    },

    // ── Sondeo ──────────────────────────────────────────────────────────────
    // En vista simple solo late el activo en pantalla. En "LOS 4" se rota de dos
    // en dos: cada activo se refresca cada ~6 s y la carga sobre el canal se
    // mantiene constante en vez de multiplicarse por cuatro.
    _tickFeed() {
      if (this._closed) return;
      const ids = this._focusIds();
      if (ids.length <= 1) { this._loadFeed(ids[0]); return; }
      this._loadFeed(ids[this._rr % ids.length]);
      this._loadFeed(ids[(this._rr + 1) % ids.length]);
      this._rr += 2;
    },

    _tickMarket() {
      if (this._closed) return;
      const ids = this._focusIds();
      if (ids.length <= 1) { this._loadMarket(ids[0]); return; }
      this._loadMarket(ids[this._marketRr % ids.length]);
      this._loadMarket(ids[(this._marketRr + 1) % ids.length]);
      this._marketRr += 2;
    },

    // El precio suelto (sin velas) es lo que mantiene el marcador del target
    // y el grafico "baseline" de LOS 4 EN VIVO de verdad: antes solo se
    // actualizaba con la vela de 1m completa cada `marketPollMs` (15 s), asi
    // que el punto se quedaba quieto y luego saltaba de golpe — se veia
    // atrasado. En la vista de un activo solo hace falta ese; en "LOS 4" hacen
    // falta los 4 (son 4 llamadas ligeras cada 2 s, no 4 velas completas).
    _tickSpot() {
      if (this._closed) return;
      if (this.state.view === 'ALL') { ASSET_IDS.forEach(id => this._loadSpot(id)); return; }
      this._loadSpot(this._focusId());
    },

    // ── Precio en vivo por WebSocket ────────────────────────────────────────
    // Los 4 productos por el mismo socket publico de Coinbase. Cada trade que
    // se cruza llega solo; no hay ventana de sondeo que esperar, asi que el
    // precio del encabezado, el medidor del target y la vela en curso dejan de
    // ir por detras de lo que ya paso.
    _connectTickerWs() {
      if (this._closed) return;
      try {
        if (this._ws) { this._ws.onclose = null; this._ws.close(1000); }
      } catch (error) { /* la anterior ya estaba cerrada */ }
      let ws;
      try { ws = new WebSocket(CFG.coinbaseWs); }
      catch (error) { this._scheduleTickerReconnect(); return; }
      this._ws = ws;
      ws.onopen = () => {
        if (this._closed || this._ws !== ws) return;
        this._wsRetries = 0;
        ws.send(JSON.stringify({ type: 'subscribe', product_ids: ASSET_IDS, channel: 'ticker' }));
        ws.send(JSON.stringify({ type: 'subscribe', product_ids: ASSET_IDS, channel: 'heartbeats' }));
      };
      ws.onmessage = (event) => {
        if (this._closed || this._ws !== ws) return;
        let payload;
        try { payload = JSON.parse(event.data); } catch (error) { return; }
        const events = Array.isArray(payload && payload.events) ? payload.events : [];
        let touched = false;
        for (const item of events) {
          const tickers = item && Array.isArray(item.tickers) ? item.tickers : [];
          for (const ticker of tickers) {
            const id = ticker && ticker.product_id;
            const price = Number(ticker && ticker.price);
            if (!ASSET_IDS.includes(id) || !isFinite(price) || price <= 0) continue;
            const at = Date.now();
            this._applyLivePrice(id, price, at);
            if (!this._wsAt) this._wsAt = {};
            this._wsAt[id] = at;
            touched = true;
          }
        }
        if (touched) this._requestLivePaint();
      };
      ws.onerror = () => { /* el cierre dispara la reconexion */ };
      ws.onclose = () => {
        if (this._closed || this._ws !== ws) return;
        this._ws = null;
        this._scheduleTickerReconnect();
      };
    },

    _scheduleTickerReconnect() {
      if (this._closed || this._wsRetryTimer) return;
      this._wsRetries = (Number(this._wsRetries) || 0) + 1;
      const delay = Math.min(30000, 1000 * Math.pow(2, Math.min(this._wsRetries - 1, 5)));
      this._wsRetryTimer = setTimeout(() => {
        this._wsRetryTimer = null;
        this._connectTickerWs();
      }, delay);
    },

    // La frescura se mide por activo. Si se midiera del socket entero, un
    // activo sin operaciones durante medio minuto se quedaria con el precio
    // viejo y ademas sin sondeo de respaldo, porque el socket "estaria vivo"
    // gracias a los otros tres.
    _wsFresh(assetId) {
      const at = this._wsAt && this._wsAt[assetId];
      return isFinite(Number(at)) && Date.now() - Number(at) <= CFG.wsFreshMs;
    },

    // Un precio nuevo, venga del socket o del sondeo, entra siempre por aqui:
    // ademas de guardarlo, alarga la vela de 1 minuto en curso. Sin esto el
    // grafico principal seguia dibujando la vela como estaba en el ultimo
    // sondeo de velas (hasta 15 s atras) mientras el resto de la pantalla ya
    // mostraba el precio nuevo.
    _applyLivePrice(assetId, price, at) {
      const asset = this.state.assets[assetId];
      if (!asset || !isFinite(price) || price <= 0) return;
      asset.market.price = price;
      asset.market.at = at;
      this._recordPriceSample(asset, at, price);
      const candles = asset.market.candles;
      if (!Array.isArray(candles) || !candles.length) return;
      const minuteStart = Math.floor(at / 60000) * 60000;
      const live = candles[candles.length - 1];
      if (!live) return;
      if (live.t === minuteStart) {
        live.c = price;
        live.h = Math.max(Number(live.h) || price, price);
        live.l = Math.min(Number(live.l) || price, price);
      } else if (minuteStart > live.t) {
        // Minuto nuevo: se abre con el ultimo precio conocido y el sondeo de
        // velas la reemplaza por la oficial de Coinbase en cuanto llegue.
        candles.push({ t: minuteStart, o: price, h: price, l: price, c: price });
        if (candles.length > 400) candles.splice(0, candles.length - 400);
      }
    },

    // Repintado coalescido: llegan varios trades por segundo y no tiene sentido
    // redibujar una vez por mensaje.
    _requestLivePaint() {
      if (this._livePaintPending || this._closed) return;
      this._livePaintPending = true;
      requestAnimationFrame(() => {
        this._livePaintPending = false;
        if (!this._closed) this._paint();
      });
    },

    async _loadSpot(assetId) {
      if (this._closed || !assetId) return;
      if (this._wsFresh(assetId)) return;
      const asset = this.state.assets[assetId];
      if (!asset) return;
      try {
        const response = await fetch(CFG.spotUrl(assetId));
        if (!response.ok) return;
        const payload = await response.json();
        const price = Number(payload && payload.data && payload.data.amount);
        if (this._closed || !isFinite(price) || price <= 0) return;
        const now = Date.now();
        asset.market.price = price;
        asset.market.at = now;
        this._recordPriceSample(asset, now, price);
        this._paint();
      } catch (error) { /* el ticker es decorativo: un fallo no rompe la app */ }
    },

    // Trazo fino de precio para el grafico "baseline". Colapsa ticks a menos
    // de 400 ms de distancia (el spot y la vela de 1m pueden llegar casi
    // juntos) y se recorta solo por edad: la ventana vigente ya filtra al
    // dibujar, asi que aqui basta con no crecer sin limite.
    _recordPriceSample(asset, t, p) {
      if (!asset || !isFinite(p) || p <= 0) return;
      if (!Array.isArray(asset.market.priceSamples)) asset.market.priceSamples = [];
      const rows = asset.market.priceSamples;
      const ts = isFinite(t) ? t : Date.now();
      const last = rows[rows.length - 1];
      if (last && ts - last.t < 400) rows[rows.length - 1] = { t: ts, p };
      else rows.push({ t: ts, p });
      const cut = Date.now() - 20 * 60 * 1000;
      while (rows.length && rows[0].t < cut) rows.shift();
      if (rows.length > 400) rows.splice(0, rows.length - 400);
    },

    // Solo el grafico grande (vista de un activo) usa una temporalidad
    // distinta a 1 min; en 1 min ya alcanza con `market.candles`, que late
    // cada `marketPollMs` sin importar la temporalidad elegida. Los 4
    // cuadrantes de "LOS 4" se quedan siempre en la vela de 1 min en vivo.
    _tickChartTf() {
      if (this._closed || this.state.view === 'ALL') return;
      const tf = CHART_TIMEFRAMES[this.state.chartTf] || CHART_TIMEFRAMES[CHART_TF_DEFAULT];
      if (tf.windowed) return;
      this._loadChartTfCandles(this._focusId());
    },

    async _loadChartTfCandles(assetId) {
      if (this._closed || !assetId) return;
      const asset = this.state.assets[assetId];
      if (!asset) return;
      const tfKey = this.state.chartTf;
      const tf = CHART_TIMEFRAMES[tfKey] || CHART_TIMEFRAMES[CHART_TF_DEFAULT];
      if (tf.windowed) return;
      try {
        const end = Math.floor(Date.now() / 1000);
        const start = end - tf.lookbackSec;
        const url = CFG.candlesUrl(assetId) + '?granularity=' + tf.granularity
          + '&start=' + start + '&end=' + end;
        const response = await fetch(url);
        if (!response.ok) return;
        const payload = await response.json();
        const rows = Array.isArray(payload && payload.candles) ? payload.candles : [];
        const candles = rows.map(row => ({
          t: Number(row.start) * 1000,
          o: Number(row.open), h: Number(row.high), l: Number(row.low), c: Number(row.close),
        })).filter(row => isFinite(row.t) && isFinite(row.c)).sort((a, b) => a.t - b.t);
        // Si el usuario ya cambio de activo o de temporalidad mientras esta
        // respuesta viajaba, se descarta: sin este guardia, la vela de otro
        // activo podia pintarse un instante sobre el que esta en pantalla.
        if (this._closed || !candles.length
          || assetId !== this._focusId() || tfKey !== this.state.chartTf) return;
        asset.market.tfCandles = candles;
        asset.market.tfKey = tfKey;
        asset.market.tfAt = Date.now();
        this._paint();
      } catch (error) { /* el mercado es decorativo: un fallo no rompe la app */ }
    },

    // Los activos que NO estan en pantalla igual se refrescan despacio: es lo
    // que mantiene vivos el precio y el punto de senal de las pestanas.
    _tickBackground() {
      if (this._closed || this.state.view === 'ALL') return;
      const others = ASSET_IDS.filter(id => id !== this.state.view);
      if (!others.length) return;
      const id = others[this._bgRr % others.length];
      this._bgRr += 1;
      this._loadFeed(id);
      this._loadMarket(id);
    },

    // El diagnostico distingue POR QUE no hay datos. Antes todo terminaba en
    // "canal sin enlazar", que apuntaba al servidor cuando el problema real
    // solia ser local (LTH OS sin reiniciar tras actualizar el lector).
    async _loadFeed(assetId) {
      if (this._closed || !assetId) return;
      const asset = this.state.assets[assetId];
      if (!asset) return;
      const bridge = window.electron && window.electron.bitcoinFeed;
      if (!bridge || typeof bridge.load !== 'function') {
        asset.link = {
          code: 'no-bridge',
          title: 'Falta reiniciar LTH OS',
          detail: 'El lector de senales se instalo con una actualizacion. Cierra y vuelve a abrir LTH OS por completo para activarlo.',
        };
        asset.loading = false;
        this._paint();
        return;
      }
      try {
        const result = await bridge.load({ asset: assetId, limit: CFG.historyLimit });
        if (this._closed) return;
        if (!result || !result.success) {
          const message = result && result.error ? String(result.error) : 'No se pudo leer el canal.';
          // invoke() rechaza asi cuando el proceso principal aun corre una
          // version sin el manejador: es el mismo caso de "falta reiniciar".
          const staleHandler = /No handler registered|bitcoin-feed:load/i.test(message);
          asset.link = result && result.signedIn === false
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
          asset.link = {
            code: 'no-stream',
            title: 'El canal de ' + metaOf(assetId).ticker + ' aun no existe',
            detail: 'LTH Bitcoin Admin todavia no ha publicado este canal publico desde la PC administradora.',
          };
          asset.signals = [];
          asset.statuses = [];
          asset.stream = null;
        } else {
          asset.link = null;
          asset.stream = result.stream;
          asset.signals = Array.isArray(result.signals) ? result.signals : [];
          asset.statuses = Array.isArray(result.statuses) ? result.statuses : [];
        }
      } catch (error) {
        const message = error && error.message ? error.message : 'Fallo la lectura del canal.';
        const staleHandler = /No handler registered|bitcoin-feed:load/i.test(message);
        asset.link = {
          code: staleHandler ? 'no-bridge' : 'error',
          title: staleHandler ? 'Falta reiniciar LTH OS' : 'Fallo la lectura del canal',
          detail: staleHandler
            ? 'El proceso principal todavia corre la version anterior. Cierra LTH OS por completo y vuelve a abrirlo.'
            : message,
        };
      }
      asset.loading = false;
      this._paint();
    },

    async _loadMarket(assetId) {
      if (this._closed || !assetId) return;
      const asset = this.state.assets[assetId];
      if (!asset) return;
      try {
        const end = Math.floor(Date.now() / 1000);
        const start = end - 60 * 60;
        const url = CFG.candlesUrl(assetId) + '?granularity=ONE_MINUTE&start=' + start + '&end=' + end;
        const response = await fetch(url);
        if (!response.ok) return;
        const payload = await response.json();
        const rows = Array.isArray(payload && payload.candles) ? payload.candles : [];
        const candles = rows.map(row => ({
          t: Number(row.start) * 1000,
          o: Number(row.open), h: Number(row.high), l: Number(row.low), c: Number(row.close),
        })).filter(row => isFinite(row.t) && isFinite(row.c)).sort((a, b) => a.t - b.t);
        if (this._closed || !candles.length) return;
        asset.market.candles = candles;
        asset.market.price = candles[candles.length - 1].c;
        asset.market.at = Date.now();
        // Siembra el trazo fino con los cierres de 1m mientras llega el
        // primer tick del spot: sin esto el grafico "baseline" arrancaba en
        // blanco durante los primeros ~2 s de cada apertura de la app.
        if (!Array.isArray(asset.market.priceSamples) || !asset.market.priceSamples.length) {
          candles.slice(-30).forEach(c => this._recordPriceSample(asset, c.t, c.c));
        }
        this._paint();
      } catch (error) { /* el mercado es decorativo: un fallo no rompe la app */ }
    },

    // ── Lectura del estado de un activo ─────────────────────────────────────
    _read(assetId) {
      const asset = this._asset(assetId);
      const status = (asset.statuses || []).slice()
        .sort((a, b) => Date.parse(b.last_seen_at || 0) - Date.parse(a.last_seen_at || 0))[0] || null;
      const rows = (asset.signals || []).slice()
        .sort((a, b) => Date.parse(b.emitted_at || 0) - Date.parse(a.emitted_at || 0));
      const latest = rows[0] || null;
      let signal = null;
      if (latest) {
        const open = String(latest.status || 'open').toLowerCase() === 'open';
        const closeMs = Date.parse(latest.window_close || '');
        signal = (open || (isFinite(closeMs) && closeMs > Date.now())) ? latest : null;
      }
      const statusAge = status ? Date.now() - Date.parse(status.last_seen_at || 0) : Infinity;
      const engineState = ['online', 'maintenance', 'offline']
        .includes(String(status?.engine_state || '').toLowerCase())
        ? String(status.engine_state).toLowerCase()
        : (status?.active === false ? 'offline' : 'online');
      const pcOnline = !!status && statusAge >= 0 && statusAge <= CFG.pcOnlineMs;
      const botActive = pcOnline && status?.active !== false && engineState === 'online';
      const settled = rows.filter(row => ['won', 'lost'].includes(String(row.status || '').toLowerCase()));
      const won = settled.filter(row => String(row.status).toLowerCase() === 'won').length;
      return {
        id: assetId, meta: metaOf(assetId), asset, status, signal, rows, settled,
        won, lost: settled.length - won,
        rate: settled.length ? Math.round((won / settled.length) * 100) : null,
        engineState, pcOnline, botActive,
        tactic: describeTactic(status, signal),
        forecast: describeForecast(status, asset),
      };
    },

    _paint() {
      if (this._closed || !this._root) return;
      const focus = this._read(this._focusId());
      this.state.simResult = runSimulation(focus.asset.signals, this.state.sim);
      this._detectWins();

      this._paintTabs();
      this._paintHeader(focus);
      this._paintCandleClock();

      if (this.state.view === 'ALL') {
        ASSET_IDS.forEach(id => this._paintQuad(this._read(id)));
      } else {
        this._paintSignal(focus);
        this._paintChart(focus);
        this._paintClock(focus);
        this._paintTactic(focus);
        this._paintLive(focus);
        this._paintSimulator();
        this._paintHistory(focus);
      }

      const errorEl = this._$('#ltbError');
      if (errorEl) {
        const issue = this.state.view === 'ALL'
          ? (ASSET_IDS.map(id => this._asset(id).link).find(Boolean) || null)
          : focus.asset.link;
        errorEl.hidden = !issue;
        errorEl.textContent = issue ? issue.title + ' — ' + issue.detail : '';
      }
    },

    // Repinta solo si el contenido cambio: con 4 activos y un repintado por
    // segundo, escribir innerHTML a ciegas quema CPU sin cambiar un pixel.
    _setHTML(node, key, html) {
      if (!node) return;
      if (this._sigCache.get(key) === html) return;
      this._sigCache.set(key, html);
      node.innerHTML = html;
    },

    _paintTabs() {
      (this._root.querySelectorAll('.ltb-tab[data-view]') || []).forEach(tab => {
        const id = tab.getAttribute('data-view');
        if (!ASSET_IDS.includes(id)) return;
        const read = this._read(id);
        const price = tab.querySelector('.js-price');
        if (price) price.textContent = fmtUSD(read.asset.market.price, read.meta.decimals);
        const dot = tab.querySelector('.js-dot');
        if (dot) {
          const live = read.signal ? (read.signal.direction === 'UP' ? 'up' : 'down') : '';
          dot.className = 'ltb-tab-dot js-dot ' + (live || (read.botActive ? 'idle' : 'off'));
          dot.title = read.signal
            ? 'Senal ' + read.signal.direction + ' activa'
            : (read.botActive ? 'Motor transmitiendo' : 'Motor sin transmitir');
        }
      });
    },

    _paintTarget(focus) {
      const meter = this._$('#ltbTargetMeter');
      const timerValue = this._$('#ltbTargetTimerValue');
      const timerProgress = this._$('#ltbTargetTimerProgress');
      const fill = this._$('#ltbTargetFill');
      const marker = this._$('#ltbTargetMarker');
      if (!meter || !fill || !marker) return;
      meter.hidden = !focus;
      if (!focus) return;

      const now = Date.now();
      const candleStart = Math.floor(now / CFG.windowMs) * CFG.windowMs;
      const candleElapsed = Math.max(0, now - candleStart);
      const candleRemaining = Math.max(0, candleStart + CFG.windowMs - now);
      if (timerValue) timerValue.textContent = fmtCountdown(candleRemaining);
      if (timerProgress) timerProgress.style.width = Math.min(100,
        (candleElapsed / CFG.windowMs) * 100) + '%';
      meter.setAttribute('aria-label', 'Vela de 15 minutos; faltan ' + fmtCountdown(candleRemaining));

      const snapshot = targetSnapshot(focus);
      meter.classList.remove('waiting', 'up', 'down', 'flat');
      if (!snapshot) {
        meter.classList.add('waiting');
        meter.setAttribute('aria-label', 'Vela de 15 minutos; faltan ' + fmtCountdown(candleRemaining)
          + '; esperando precio y apertura');
        marker.style.left = '50%';
        fill.style.left = '50%';
        fill.style.width = '0%';
        return;
      }

      const tick = Math.pow(10, -(Number(focus?.meta?.decimals) || 2)) / 2;
      const direction = snapshot.move > tick ? 'up' : (snapshot.move < -tick ? 'down' : 'flat');
      const position = Math.max(4, Math.min(96, snapshot.position));
      meter.classList.add(direction);
      meter.setAttribute('aria-label', 'Vela de 15 minutos; faltan ' + fmtCountdown(candleRemaining)
        + '; precio ' + (direction === 'up' ? 'arriba' : (direction === 'down' ? 'abajo' : 'en la apertura')));
      marker.style.left = position + '%';
      fill.style.left = Math.min(50, position) + '%';
      fill.style.width = Math.abs(position - 50) + '%';
    },

    _paintHeader(focus) {
      const all = this.state.view === 'ALL';
      // En la vista conjunta no existe un unico target representativo: ocultar
      // la barra evita presentar silenciosamente la apertura de BTC como si
      // describiera a los cuatro activos.
      this._paintTarget(all ? null : focus);
      const issue = focus.asset.link;
      const name = this._$('#ltbStreamName');
      if (name) {
        name.textContent = all
          ? 'Los 4 activos del canal central en paralelo'
          : (issue
            ? issue.title
            : (focus.asset.stream?.title
              ? focus.asset.stream.title + ' · motor ' + shortEngine(focus.status?.engine_version)
              : (focus.asset.loading ? 'Conectando con el canal central' : 'Canal central')));
      }
      const label = this._$('#ltbPriceLabel');
      const price = this._$('#ltbPrice');
      if (label) label.textContent = all ? 'ACTIVOS' : focus.id;
      if (price) {
        price.textContent = all
          ? String(ASSET_IDS.filter(id => this._read(id).botActive).length) + ' / 4 en vivo'
          : fmtUSD(focus.asset.market.price, focus.meta.decimals);
        price.classList.toggle('small', all);
      }

      const link = this._$('#ltbLink');
      const linkText = this._$('#ltbLinkText');
      if (link && linkText) {
        if (all) {
          const live = ASSET_IDS.filter(id => this._read(id).botActive).length;
          link.className = 'ltb-link ' + (live === 4 ? 'online' : (live ? 'maint' : 'offline'));
          linkText.textContent = live === 4
            ? 'Los 4 motores transmitiendo'
            : (live ? live + ' de 4 transmitiendo' : 'Ningun motor transmitiendo');
          return;
        }
        if (issue) {
          link.className = 'ltb-link ' + (issue.code === 'error' ? 'offline' : 'maint');
          linkText.textContent = issue.code === 'no-bridge'
            ? 'Reinicia LTH OS'
            : (issue.code === 'signed-out'
              ? 'Sin sesion'
              : (issue.code === 'no-stream' ? 'Canal no publicado' : 'Sin lectura'));
          return;
        }
        link.className = 'ltb-link ' + (focus.botActive
          ? 'online'
          : (focus.engineState === 'maintenance' ? 'maint' : 'offline'));
        linkText.textContent = focus.engineState === 'maintenance'
          ? 'Motor en mantenimiento'
          : (focus.engineState === 'offline'
            ? 'Motor apagado'
            : (focus.botActive ? 'Motor transmitiendo' : (focus.pcOnline ? 'Motor pausado' : 'Motor fuera de linea')));
      }
    },

    _paintSignal(focus) {
      const { signal, botActive, engineState } = focus;
      const card = this._$('#ltbSignalCard');
      const dirIcon = this._$('#ltbDirIcon');
      const dirLabel = this._$('#ltbDirLabel');
      const dirText = this._$('#ltbDirText');
      const copy = this._$('#ltbSignalCopy');
      const confidence = this._$('#ltbConfidence');
      const confidenceBar = this._$('#ltbConfidenceBar');
      if (!card) return;

      const tickerEl = this._$('#ltbSignalAsset');
      if (tickerEl) tickerEl.textContent = focus.meta.ticker;

      const issue = focus.asset.link;
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
              ? 'El motor esta conectado y analizando ' + focus.meta.name + '. Publicara la entrada cuando cierre su lectura.'
              : 'Esperando que el motor central publique una indicacion de ' + focus.meta.ticker + '.');
        }
        if (confidence) confidence.textContent = '--';
        if (confidenceBar) confidenceBar.style.width = '0%';
        this._$('#ltbSignalTime').textContent = '--:--';
        this._$('#ltbCloseTime').textContent = '--:--';
        this._$('#ltbCountdown').textContent = '--:--';
        this._$('#ltbEntryPrice').textContent = '--';
        const resultEl = this._$('#ltbResult');
        resultEl.textContent = '--';
        resultEl.className = '';
        return;
      }

      const up = signal.direction === 'UP';
      const closeMs = Date.parse(signal.window_close || '');
      const remaining = Math.max(0, closeMs - Date.now());
      const settling = isFinite(closeMs) && closeMs <= Date.now();
      const value = Math.max(50, Math.min(100, Number(signal.confidence) || 50));

      card.className = 'ltb-card ltb-signal ' + (up ? 'up' : 'down') + (settling ? '' : ' live');
      if (dirIcon) dirIcon.innerHTML = up ? '&#8593;' : '&#8595;';
      if (dirLabel) dirLabel.textContent = settling ? 'PENDIENTE DE RESULTADO' : 'ENTRADA ACTIVA';
      if (dirText) dirText.textContent = up ? 'UP / ARRIBA' : 'DOWN / ABAJO';
      if (copy) {
        copy.textContent = settling
          ? 'La vela cerro a las ' + fmtClock(signal.window_close) + '. El motor esta confirmando el resultado oficial.'
          : (signal.reasoning_headline
            || ((up ? 'UP' : 'DOWN') + ' en ' + focus.meta.ticker + ' para la vela que cierra a las '
              + fmtClock(signal.window_close) + '.'));
      }
      if (confidence) confidence.textContent = Math.round(value) + '%';
      if (confidenceBar) {
        confidenceBar.style.width = value + '%';
        confidenceBar.className = up ? 'up' : 'down';
      }
      this._$('#ltbSignalTime').textContent = fmtClock(signal.emitted_at);
      this._$('#ltbCloseTime').textContent = fmtClock(signal.window_close);
      this._$('#ltbCountdown').textContent = settling ? 'CERRADA' : fmtCountdown(remaining);
      this._$('#ltbEntryPrice').textContent = fmtUSD(signal.entry_price, focus.meta.decimals);
      const outcome = outcomeOf(signal);
      const resultEl = this._$('#ltbResult');
      resultEl.textContent = outcome.label;
      resultEl.className = 'ltb-outcome ' + outcome.tone;
    },

    _paintChart(focus) {
      const host = this._$('#ltbChart');
      if (!host) return;
      const tfKey = this.state.chartTf;
      const tf = CHART_TIMEFRAMES[tfKey] || CHART_TIMEFRAMES[CHART_TF_DEFAULT];
      const winStart = Math.floor(Date.now() / CFG.windowMs) * CFG.windowMs;
      const oneMin = focus.asset.market.candles || [];

      // La apertura de la vela vigente es la misma referencia sea cual sea la
      // temporalidad elegida: en 1 min ancla la vela en curso; en 5/15 min da
      // contexto de donde esta parada la vela actual dentro de la historia.
      // Misma regla que en los cuadrantes: manda la vela oficial de Coinbase.
      // La apertura publicada por el motor pierde decimales en el camino y a
      // XRP le cambia el signo del movimiento.
      const openRef = this._windowOpenPrice(focus, winStart);

      const rows = tf.windowed
        ? oneMin.filter(row => row.t >= winStart - CFG.windowMs)
        : (focus.asset.market.tfKey === tfKey ? (focus.asset.market.tfCandles || []).slice(-70) : []);

      if (rows.length < 2) {
        this._setHTML(host, 'chart:' + focus.id + ':' + tfKey,
          '<div class="ltb-empty">Cargando velas de ' + tf.label + ' de Coinbase…</div>');
        return;
      }
      const drawn = candleSvg(rows, openRef, {});
      if (!drawn) return;
      const html = drawn.svg
        + '<div class="ltb-chart-legend">'
        + (isFinite(openRef)
          ? '<span><i class="ref"></i>Apertura vela ' + fmtUSD(openRef, focus.meta.decimals) + '</span>'
          : '<span></span>')
        + '<span>' + fmtUSD(drawn.min, focus.meta.decimals) + ' – ' + fmtUSD(drawn.max, focus.meta.decimals) + '</span>'
        + '</div>';
      this._setHTML(host, 'chart:' + focus.id + ':' + tfKey, html);
      const note = this._$('#ltbChartNote');
      if (note) {
        const at = tf.windowed ? focus.asset.market.at : focus.asset.market.tfAt;
        note.textContent = 'Coinbase ' + focus.id + ' · ' + tf.label
          + (at ? ' · ' + fmtAgo(new Date(at).toISOString()) : '');
      }
    },

    // Reloj por tramos reales del motor (5 / 7 / 10 min), anclado al inicio de
    // la vela vigente por reloj de pared: se recupera solo tras cualquier hueco.
    _paintClock(focus) {
      const { signal, botActive, engineState, status } = focus;
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
        remaining = null;
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

    // ── Tecnica / tesis / plan ──────────────────────────────────────────────
    _paintTactic(focus) {
      const tactic = focus.tactic;
      const card = this._$('#ltbTacticCard');
      if (card) {
        card.className = 'ltb-card ltb-tactic-card'
          + (tactic.side === 'UP' ? ' up' : (tactic.side === 'DOWN' ? ' down' : ''))
          + (tactic.stageTone === 'live' ? ' engaged' : '');
      }
      const chip = this._$('#ltbEngineChip');
      if (chip) chip.textContent = focus.botActive ? tactic.engine : 'MOTOR EN SILENCIO';

      const technique = this._$('#ltbTechnique');
      if (technique) {
        technique.textContent = focus.botActive ? tactic.technique : 'Sin motor en linea';
        technique.className = 'ltb-technique ' + (focus.botActive ? tactic.profile : '');
      }
      const how = this._$('#ltbTechniqueHow');
      if (how) {
        how.textContent = focus.botActive
          ? tactic.how
          : 'Cuando el motor vuelva a transmitir se vera aqui que tecnica esta ejecutando sobre ' + focus.meta.name + '.';
      }

      const flags = this._$('#ltbFlags');
      if (flags) {
        const html = tactic.flags.map(flag => '<span>' + esc(flag) + '</span>').join('');
        flags.hidden = !html;
        this._setHTML(flags, 'flags:' + focus.id, html);
      }

      const verdictEl = this._$('#ltbThesisVerdict');
      if (verdictEl) {
        const verdict = tactic.verdict || (tactic.thesis ? 'Lectura tecnica en curso' : 'Construyendo la tesis');
        verdictEl.textContent = focus.botActive ? verdict : 'Motor sin transmitir';
        verdictEl.className = verdict === 'RECHAZO PROBABLE'
          ? 'danger'
          : (verdict === 'RECHAZO EN DUDA' ? 'warn' : (verdict === 'TESIS FIRME' ? 'good' : ''));
      }
      const thesisText = this._$('#ltbThesisText');
      if (thesisText) {
        const parts = [tactic.thesis, tactic.verdictDetail, tactic.source].filter(Boolean);
        thesisText.textContent = parts.length
          ? parts.join(' · ')
          : 'El motor todavia no publico una tesis para esta vela.';
      }

      // Pronostico visual independiente: usa el consenso que el Admin ya
      // publica en el heartbeat, pero nunca lo convierte en una orden.
      const forecast = focus.forecast || describeForecast(focus.status);
      const forecastEl = this._$('#ltbForecast');
      if (forecastEl) {
        const tone = forecast.ready ? forecast.direction.toLowerCase() : 'waiting';
        forecastEl.className = 'ltb-forecast ' + tone;
      }
      const forecastDirection = this._$('#ltbForecastDirection');
      if (forecastDirection) {
        forecastDirection.textContent = forecast.ready
          ? forecast.direction + ' ' + Math.max(forecast.up, forecast.down) + '%'
          : '--';
      }
      const forecastPhase = this._$('#ltbForecastPhase');
      if (forecastPhase) {
        forecastPhase.textContent = !forecast.ready
          ? 'Esperando el primer precio de esta vela'
          : 'Minuto ' + forecast.minute + ' · '
            + (forecast.specialists
              ? forecast.specialists + ' especialistas'
              : 'lectura por precio en vivo');
      }
      const forecastUp = this._$('#ltbForecastUp');
      const forecastDown = this._$('#ltbForecastDown');
      if (forecastUp) forecastUp.textContent = forecast.up == null ? '--%' : forecast.up + '%';
      if (forecastDown) forecastDown.textContent = forecast.down == null ? '--%' : forecast.down + '%';
      const forecastUpBar = this._$('#ltbForecastUpBar');
      const forecastDownBar = this._$('#ltbForecastDownBar');
      if (forecastUpBar) forecastUpBar.style.width = (forecast.ready ? forecast.up : 0) + '%';
      if (forecastDownBar) forecastDownBar.style.width = (forecast.ready ? forecast.down : 0) + '%';
      const forecastSpecialists = this._$('#ltbForecastSpecialists');
      if (forecastSpecialists) {
        const html = forecast.ready && forecast.readings.length
          ? forecast.readings.map(item => {
            const tone = item.probability > 50 ? 'up' : (item.probability < 50 ? 'down' : 'flat');
            return '<span class="ltb-forecast-specialist ' + tone + '">'
              + '<b>' + esc(item.label) + '</b><strong>' + item.probability + '%</strong></span>';
          }).join('')
          : '<span class="ltb-forecast-specialist flat"><b>Especialistas</b><strong>--</strong></span>';
        this._setHTML(forecastSpecialists, 'forecast-specialists:' + focus.id, html);
      }
      const forecastNote = this._$('#ltbForecastNote');
      if (forecastNote) {
        const tail = ' Solo analisis; no modifica la decision del bot central.';
        forecastNote.textContent = !forecast.ready
          ? 'Esperando el primer precio de esta vela.' + tail
          : (forecast.specialists
            ? forecast.specialists + ' especialistas · ' + forecast.upVotes + ' UP / '
              + forecast.downVotes + ' DOWN'
              + (forecast.engineFresh ? '' : ' (ultima lectura del motor, combinada con el precio en vivo)')
              + '.' + tail
            : 'Estimacion por precio en vivo frente a la apertura; el motor aun no reporto especialistas para esta vela.' + tail);
      }

      const stage = this._$('#ltbStage');
      if (stage) {
        stage.textContent = tactic.stage;
        stage.className = 'ltb-stage ' + tactic.stageTone;
      }

      const grid = this._$('#ltbPlanGrid');
      if (grid) {
        const steps = tactic.steps.slice();
        if (tactic.remainingSec != null) {
          steps.push({ label: 'Cierra en', value: fmtCountdown(tactic.remainingSec * 1000), tone: '' });
        }
        if (tactic.missing.length) {
          steps.push({ label: 'Falta para entrar', value: tactic.missing[0], tone: 'warn' });
        }
        const html = steps.length
          ? steps.map(step => '<div class="ltb-plan-cell ' + esc(step.tone) + '">'
            + '<span>' + esc(step.label) + '</span>'
            + '<strong>' + esc(step.value) + '</strong></div>').join('')
          : '<div class="ltb-empty">El plan aparece cuando el motor arma una entrada.</div>';
        this._setHTML(grid, 'plan:' + focus.id, html);
      }

      const watch = this._$('#ltbWatch');
      if (watch) {
        const html = tactic.watch.map(item => '<li>' + esc(item) + '</li>').join('');
        watch.hidden = !html;
        this._setHTML(watch, 'watch:' + focus.id, html);
      }
      const notice = this._$('#ltbNotice');
      if (notice) {
        notice.hidden = !tactic.notice;
        notice.textContent = tactic.notice || '';
      }
    },

    _paintLive(focus) {
      const status = focus.status;
      const riskRaw = Number(status?.live_rejection_risk);
      const hasRisk = isFinite(riskRaw);
      const plan = status?.live_plan && typeof status.live_plan === 'object' ? status.live_plan : null;
      const specialists = Array.isArray(status?.live_specialists) ? status.live_specialists : [];
      const phases = Array.isArray(status?.live_phases) ? status.live_phases : [];
      const headline = typeof status?.live_reasoning_headline === 'string'
        ? status.live_reasoning_headline.trim() : '';

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
        reasoning.textContent = headline;
        reasoning.hidden = !headline;
      }

      // Salud del jurado: un especialista sin dato NO vota, y el consenso sale
      // igual de confiado con 4 votos que con 7. El motor ya lo reporta, asi
      // que aqui se ve en vez de desaparecer de la lista.
      const health = plan?.specialistHealth && typeof plan.specialistHealth === 'object'
        ? plan.specialistHealth : null;
      const healthEl = this._$('#ltbSpecHealth');
      if (healthEl) {
        const off = specialists.filter(item => item && (item.off || item.p == null));
        const voting = health ? Number(health.voting) : specialists.length - off.length;
        const total = health ? Number(health.total) : specialists.length;
        const degraded = total > 0 && voting < total;
        healthEl.hidden = !specialists.length;
        healthEl.className = 'ltb-spec-health' + (degraded ? ' degraded' : '');
        healthEl.textContent = !total
          ? ''
          : voting + '/' + total + ' votando'
            + (degraded
              ? ' · sin voto: ' + (health && health.missing?.length
                ? health.missing.map(item => item.label || item.key).join(', ')
                : off.map(item => item.l || item.k).join(', '))
                + (health && health.missingWeightPct ? ' (' + health.missingWeightPct + '% del peso)' : '')
              : '');
      }

      const specialistHost = this._$('#ltbSpecialists');
      if (specialistHost) {
        const html = specialists.length
          ? specialists.map(item => {
            const value = Number(item?.p);
            const name = esc(item?.l || item?.k || '');
            if (!isFinite(value) || item?.off) {
              return '<div class="ltb-spec off">'
                + '<span>' + name + '</span>'
                + '<div class="ltb-spec-bar"></div>'
                + '<strong>sin voto</strong></div>';
            }
            const tone = value > 55 ? 'up' : (value < 45 ? 'down' : 'flat');
            return '<div class="ltb-spec ' + tone + '">'
              + '<span>' + name + '</span>'
              + '<div class="ltb-spec-bar"><i style="width:' + Math.round(value) + '%"></i></div>'
              + '<strong>' + Math.round(value) + '%</strong></div>';
          }).join('')
          : '<div class="ltb-empty">Sin especialistas con datos todavia.</div>';
        this._setHTML(specialistHost, 'spec:' + focus.id, html);
      }

      const phaseHost = this._$('#ltbPhases');
      if (phaseHost) {
        const html = phases.length
          ? phases.map(item => {
            const value = Number(item?.p);
            return '<div class="ltb-phase ' + esc(String(item?.s || 'missing')) + '">'
              + '<i></i><span>' + esc(item?.l || '') + '</span>'
              + '<b>' + (isFinite(value) ? Math.round(value) + '%' : '--') + '</b></div>';
          }).join('')
          : '<div class="ltb-empty">Sin capas reportadas todavia.</div>';
        this._setHTML(phaseHost, 'phase:' + focus.id, html);
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
        const ticker = metaOf(this._focusId()).ticker;
        if (!sim.total) {
          note.textContent = 'Aun no hay velas liquidadas de ' + ticker + '. En cuanto cierre la primera, veras el resultado.';
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
            : 'Solo ' + ticker + ' · ' + sim.total + ' velas liquidadas apostando '
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
        this._setHTML(host, 'simcurve', '<div class="ltb-empty">Sin operaciones simuladas todavia.</div>');
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
      this._setHTML(host, 'simcurve', '<svg viewBox="0 0 100 100" preserveAspectRatio="none">'
        + '<line x1="0" x2="100" y1="' + baseY + '" y2="' + baseY + '" class="ltb-sim-base"/>'
        + '<polygon points="0,100 ' + coords.join(' ') + ' 100,100" class="ltb-sim-fill ' + (positive ? 'up' : 'down') + '"/>'
        + '<polyline points="' + coords.join(' ') + '" class="ltb-sim-line ' + (positive ? 'up' : 'down') + '"/>'
        + '</svg>');
    },

    _paintHistory(focus) {
      this._$('#ltbWon').textContent = String(focus.won);
      this._$('#ltbLost').textContent = String(focus.lost);
      this._$('#ltbRate').textContent = focus.rate == null ? '--' : focus.rate + '%';
      const bar = this._$('#ltbScoreBar');
      if (bar) {
        bar.style.width = (focus.rate == null ? 0 : focus.rate) + '%';
        bar.className = focus.rate == null ? '' : (focus.rate >= 55 ? 'good' : (focus.rate >= 45 ? 'mid' : 'bad'));
      }
      this._$('#ltbHistoryCount').textContent = String(focus.rows.length);

      const host = this._$('#ltbHistory');
      if (!host) return;
      const html = focus.rows.length
        ? focus.rows.slice(0, 40).map(row => {
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
      this._setHTML(host, 'hist:' + focus.id, html);
    },

    // La apertura que manda es la de la vela oficial de Coinbase que la app ya
    // tiene en local. La que publica el motor viaja en una columna de solo dos
    // decimales, y a XRP (~$1) eso le borra el movimiento entero: una apertura
    // real de 1.0021 se guarda como 1.00 y el grafico pintaba verde (+0.13%)
    // una vela que en realidad iba en rojo. Tampoco vale caer a "la primera
    // vela que haya": si todavia no llego la del minuto de apertura, se dice
    // que falta el dato en vez de dibujar contra una referencia inventada.
    _windowOpenPrice(read, winStart) {
      const oneMin = read.asset.market.candles || [];
      const openRow = oneMin.find(row => row && row.t >= winStart) || null;
      const local = openRow ? Number(openRow.o) : NaN;
      if (isFinite(local) && local > 0) return local;
      const published = Number(read.signal && read.signal.window_open_price);
      return isFinite(published) && published > 0 ? published : NaN;
    },

    // Reloj de la vela para la vista de los 4. La ventana de 15 minutos es la
    // misma para los cuatro activos, asi que basta uno arriba. Lo mueve el
    // mismo bucle que los graficos (~20 veces por segundo), asi que la barra
    // avanza de verdad en vez de dar un salto por segundo.
    _paintCandleClock() {
      const value = this._$('#ltbCandleClockValue');
      const fill = this._$('#ltbCandleClockFill');
      const box = this._$('#ltbCandleClock');
      if (!value || !fill) return;
      const now = Date.now();
      const winStart = Math.floor(now / CFG.windowMs) * CFG.windowMs;
      const elapsed = Math.max(0, now - winStart);
      const remaining = Math.max(0, CFG.windowMs - elapsed);
      const text = fmtCountdown(remaining);
      if (value.textContent !== text) value.textContent = text;
      fill.style.width = Math.min(100, (elapsed / CFG.windowMs) * 100).toFixed(2) + '%';
      if (box) {
        // Ultimo minuto: el aviso de que la vela esta por liquidar.
        box.classList.toggle('closing', remaining <= 60000);
        box.setAttribute('aria-label', 'A la vela de 15 minutos le quedan ' + text);
      }
    },

    // Serie del grafico de la vela en curso, de la apertura hasta ahora.
    //
    // Antes se dibujaba SOLO con los ticks que la app hubiera alcanzado a
    // recolectar, asi que la linea empezaba donde el activo hubiera empezado a
    // recibir precio: si un sondeo fallo o la app se abrio a mitad de vela, ese
    // cuadrante arrancaba tarde y no se parecia a los demas (le paso a XRP).
    // Las velas de 1 minuto de Coinbase, en cambio, siempre cubren la ventana
    // entera: se usan para los minutos donde no hay tick fino y el trazo fino
    // manda donde si lo hay.
    _baselineSeries(read, winStart) {
      const now = Date.now();
      const fine = (read.asset.market.priceSamples || [])
        .filter(row => row && row.t >= winStart && row.t <= now && Number(row.p) > 0);
      const covered = new Set(fine.map(row => Math.floor(row.t / 60000)));
      const rows = fine.slice();
      for (const candle of (read.asset.market.candles || [])) {
        if (!candle || candle.t < winStart || candle.t > now) continue;
        if (covered.has(Math.floor(candle.t / 60000))) continue;
        const open = Number(candle.o);
        const close = Number(candle.c);
        if (open > 0) rows.push({ t: candle.t, p: open });
        const closeAt = Math.min(candle.t + 59000, now);
        if (close > 0 && closeAt > candle.t) rows.push({ t: closeAt, p: close });
      }
      return rows.sort((a, b) => a.t - b.t);
    },

    // ── Grafico ampliado ────────────────────────────────────────────────────
    _openZoom(assetId) {
      if (!ASSET_IDS.includes(assetId)) return;
      this._zoom = assetId;
      const panel = this._$('#ltbZoom');
      if (panel) panel.hidden = false;
      this._paintZoom();
    },

    _closeZoom() {
      this._zoom = null;
      const panel = this._$('#ltbZoom');
      if (panel) panel.hidden = true;
    },

    // El grande se dibuja en pixeles reales, no en un lienzo estirado. Es la
    // diferencia entre un grafico y un adorno: aqui los textos no se deforman,
    // asi que caben ejes de precio y de tiempo de verdad.
    _paintZoom() {
      if (!this._zoom) return;
      const read = this._read(this._zoom);
      const host = this._$('#ltbZoomChart');
      if (!host) return;

      const winStart = Math.floor(Date.now() / CFG.windowMs) * CFG.windowMs;
      const openRef = this._windowOpenPrice(read, winStart);
      const serie = this._baselineSeries(read, winStart);
      const ahora = Date.now();
      const t0 = Math.max(winStart, ahora - CFG.baselineWindowMs);
      const filas = serie.filter(row => row.t >= t0);
      const dec = read.meta.decimals;

      const cabecera = {
        '#ltbZoomTicker': read.meta.ticker,
        '#ltbZoomName': read.meta.name,
        '#ltbZoomPrice': fmtUSD(read.asset.market.price, dec),
        '#ltbZoomClock': fmtCountdown(Math.max(0, winStart + CFG.windowMs - ahora)),
      };
      Object.entries(cabecera).forEach(([sel, valor]) => {
        const nodo = this._$(sel);
        if (nodo && nodo.textContent !== valor) nodo.textContent = valor;
      });
      const glyph = this._$('#ltbZoomGlyph');
      if (glyph) glyph.textContent = read.meta.glyph;

      const precio = Number(read.asset.market.price);
      const movePct = isFinite(precio) && openRef > 0 ? ((precio - openRef) / openRef) * 100 : null;
      const move = this._$('#ltbZoomMove');
      if (move) {
        move.textContent = movePct == null ? '--' : (movePct >= 0 ? '+' : '') + movePct.toFixed(3) + '%';
        move.className = 'ltb-zoom-move ' + (movePct == null ? '' : (movePct >= 0 ? 'up' : 'down'));
      }
      const tesis = this._$('#ltbZoomThesis');
      if (tesis) tesis.textContent = read.tactic?.thesis || read.tactic?.verdict || 'Sin tesis publicada para esta vela.';

      if (!isFinite(openRef) || filas.length < 2) {
        this._setHTML(host, 'zoom:' + read.id + ':vacio', '<div class="ltb-empty">Esperando precio en vivo…</div>');
        return;
      }

      const W = Math.max(320, host.clientWidth || 640);
      const H = Math.max(200, host.clientHeight || 320);
      const M = { top: 14, right: 74, bottom: 26, left: 12 };
      const pw = W - M.left - M.right;
      const ph = H - M.top - M.bottom;

      const precios = filas.map(row => row.p).concat([openRef]);
      let lo = Math.min(...precios);
      let hi = Math.max(...precios);
      // Un poco de aire arriba y abajo, y un minimo para que una vela plana no
      // se dibuje como una linea temblando sobre si misma.
      const minRango = openRef * 0.0004;
      if (hi - lo < minRango) { const c = (hi + lo) / 2; lo = c - minRango / 2; hi = c + minRango / 2; }
      const aire = (hi - lo) * 0.12;
      lo -= aire; hi += aire;

      const span = Math.max(15000, ahora - t0);
      const X = (t) => M.left + ((t - t0) / span) * pw;
      const Y = (p) => M.top + (1 - (p - lo) / (hi - lo)) * ph;

      // Rejilla de precio: cinco niveles redondos, con su etiqueta a la derecha.
      const niveles = [];
      for (let i = 0; i <= 4; i++) {
        const p = lo + ((hi - lo) * i) / 4;
        niveles.push(`<line class="ltb-zg" x1="${M.left}" x2="${M.left + pw}" y1="${Y(p).toFixed(1)}" y2="${Y(p).toFixed(1)}"/>`
          + `<text class="ltb-zlabel" x="${(M.left + pw + 8).toFixed(1)}" y="${(Y(p) + 3.5).toFixed(1)}">${fmtUSD(p, dec)}</text>`);
      }

      // Rejilla de tiempo: una marca por minuto cumplido.
      const marcas = [];
      const primerMinuto = Math.ceil(t0 / 60000) * 60000;
      for (let t = primerMinuto; t <= ahora; t += 60000) {
        const etiqueta = new Date(t);
        const hh = String(etiqueta.getHours()).padStart(2, '0');
        const mm = String(etiqueta.getMinutes()).padStart(2, '0');
        marcas.push(`<line class="ltb-zg" x1="${X(t).toFixed(1)}" x2="${X(t).toFixed(1)}" y1="${M.top}" y2="${M.top + ph}"/>`
          + `<text class="ltb-ztime" x="${X(t).toFixed(1)}" y="${(M.top + ph + 16).toFixed(1)}">${hh}:${mm}</text>`);
      }

      const puntos = filas.map(row => ({ x: X(row.t), y: Y(row.p) }));
      const arriba = puntos.map(p => ({ x: p.x, y: Math.min(p.y, Y(openRef)) }));
      const abajo = puntos.map(p => ({ x: p.x, y: Math.max(p.y, Y(openRef)) }));
      const trazoArriba = smoothPath(arriba);
      const trazoAbajo = smoothPath(abajo);
      const yOpen = Y(openRef).toFixed(1);
      const x0 = puntos[0].x.toFixed(1);
      const xN = puntos[puntos.length - 1].x.toFixed(1);
      const ultimo = puntos[puntos.length - 1];
      const sube = filas[filas.length - 1].p >= openRef;

      // Maximo y minimo del tramo visible: los dos datos que un operador busca
      // primero al mirar un grafico.
      let alto = filas[0], bajo = filas[0];
      for (const row of filas) { if (row.p > alto.p) alto = row; if (row.p < bajo.p) bajo = row; }
      const extremo = (row, clase, ancla) => `<circle class="ltb-zx ${clase}" cx="${X(row.t).toFixed(1)}" cy="${Y(row.p).toFixed(1)}" r="2.6"/>`
        + `<text class="ltb-zxl ${clase}" x="${X(row.t).toFixed(1)}" y="${(Y(row.p) + (clase === 'alto' ? -8 : 14)).toFixed(1)}" text-anchor="${ancla}">${fmtUSD(row.p, dec)}</text>`;

      const svg = `<svg class="ltb-zoom-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
        ${niveles.join('')}
        ${marcas.join('')}
        <path class="ltb-zfill up" d="M${x0},${yOpen} ${trazoArriba.slice(1)} L${xN},${yOpen} Z"/>
        <path class="ltb-zfill down" d="M${x0},${yOpen} ${trazoAbajo.slice(1)} L${xN},${yOpen} Z"/>
        <line class="ltb-zopen" x1="${M.left}" x2="${M.left + pw}" y1="${yOpen}" y2="${yOpen}"/>
        <text class="ltb-zopenl" x="${(M.left + pw + 8).toFixed(1)}" y="${(Y(openRef) + 3.5).toFixed(1)}">apertura</text>
        <path class="ltb-zline up" d="${trazoArriba}"/>
        <path class="ltb-zline down" d="${trazoAbajo}"/>
        ${extremo(alto, 'alto', 'middle')}
        ${extremo(bajo, 'bajo', 'middle')}
        <circle class="ltb-zdot ${sube ? 'up' : 'down'}" cx="${ultimo.x.toFixed(1)}" cy="${ultimo.y.toFixed(1)}" r="3.6"/>
        <rect class="ltb-ztag ${sube ? 'up' : 'down'}" x="${(M.left + pw + 3).toFixed(1)}" y="${(ultimo.y - 9).toFixed(1)}" width="${(M.right - 6).toFixed(1)}" height="18" rx="4"/>
        <text class="ltb-ztagl" x="${(M.left + pw + 8).toFixed(1)}" y="${(ultimo.y + 3.5).toFixed(1)}">${fmtUSD(filas[filas.length - 1].p, dec)}</text>
      </svg>`;
      this._setHTML(host, 'zoom:' + read.id + ':' + W + 'x' + H + ':' + ahora, svg);

      const apertura = this._$('#ltbZoomOpen');
      if (apertura) apertura.textContent = 'apertura ' + fmtUSD(openRef, dec);
      const rango = this._$('#ltbZoomRange');
      if (rango) rango.textContent = 'rango ' + fmtUSD(bajo.p, dec) + ' — ' + fmtUSD(alto.p, dec);
    },

    // ── Vista "LOS 4": un cuadrante por activo ──────────────────────────────
    _paintQuad(read) {
      const panel = this._root.querySelector('[data-q="' + read.id + '"]');
      if (!panel) return;
      const signal = read.signal;
      const up = signal && signal.direction === 'UP';
      panel.className = 'ltb-q'
        + (signal ? (up ? ' up' : ' down') : '')
        + (signal && Date.parse(signal.window_close || '') > Date.now() ? ' live' : '')
        + (read.asset.link ? ' issue' : '');

      const price = panel.querySelector('.js-price');
      if (price) price.textContent = fmtUSD(read.asset.market.price, read.meta.decimals);
      const engine = panel.querySelector('.js-engine');
      if (engine) {
        engine.textContent = read.asset.link
          ? 'sin lectura'
          : (read.botActive ? read.tactic.engine : (read.engineState === 'maintenance' ? 'mantenimiento' : 'apagado'));
        engine.className = 'js-engine' + (read.botActive ? ' on' : '');
      }

      const signalHost = panel.querySelector('.js-signal');
      if (signalHost) {
        let html;
        if (signal) {
          const closeMs = Date.parse(signal.window_close || '');
          const settling = isFinite(closeMs) && closeMs <= Date.now();
          const outcome = outcomeOf(signal);
          html = '<span class="ltb-q-arrow">' + (up ? '&#8593;' : '&#8595;') + '</span>'
            + '<strong>' + (up ? 'UP' : 'DOWN') + '</strong>'
            + '<span class="ltb-q-conf">' + Math.round(Number(signal.confidence) || 0) + '%</span>'
            + '<span class="ltb-q-cd">' + (settling ? 'CERRADA' : fmtCountdown(Math.max(0, closeMs - Date.now()))) + '</span>'
            + '<span class="ltb-q-res ' + outcome.tone + '">' + esc(outcome.label) + '</span>';
        } else {
          html = '<span class="ltb-q-arrow idle">&#8645;</span>'
            + '<strong class="idle">' + (read.botActive ? 'ANALIZANDO' : 'SIN SENAL') + '</strong>'
            + '<span class="ltb-q-cd">' + (read.botActive ? 'sin entrada abierta' : 'motor en silencio') + '</span>';
        }
        this._setHTML(signalHost, 'q-signal:' + read.id, html);
      }

      this._paintQuadChart(read, panel);
      this._paintQuadDots(read, panel);

      const tacticHost = panel.querySelector('.js-tactic');
      if (tacticHost) {
        const tactic = read.tactic;
        const thesis = tactic.thesis || tactic.verdict || '';
        const html = read.botActive
          ? '<span class="ltb-q-tech">' + esc(tactic.technique) + '</span>'
            + '<span class="ltb-q-stage ' + esc(tactic.stageTone) + '">' + esc(tactic.stage) + '</span>'
            + '<p>' + esc(thesis || 'Sin tesis publicada para esta vela.') + '</p>'
          : '<span class="ltb-q-tech idle">Motor sin transmitir</span>'
            + '<p>' + esc(read.asset.link ? read.asset.link.title : 'Esperando el latido del motor.') + '</p>';
        this._setHTML(tacticHost, 'q-tactic:' + read.id, html);
      }

      const riskEl = panel.querySelector('.js-risk');
      if (riskEl) {
        const risk = Number(read.status?.live_rejection_risk);
        const level = String(read.status?.live_rejection_level || '').toUpperCase();
        riskEl.textContent = isFinite(risk) ? 'Rechazo ' + Math.round(risk) + '% · ' + (level || '--') : 'Rechazo --';
        riskEl.className = 'js-risk ' + (level === 'EXTREMO' || level === 'ALTO' ? 'hot' : (level === 'MODERADO' ? 'mid' : ''));
      }
      const recordEl = panel.querySelector('.js-record');
      if (recordEl) {
        recordEl.textContent = read.settled.length
          ? read.won + 'G / ' + read.lost + 'P · ' + (read.rate == null ? '--' : read.rate + '%')
          : 'sin velas liquidadas';
      }
    },

    // Grafico del cuadrante. Se separa del resto de la tarjeta porque se
    // refresca mucho mas seguido: el resto cambia cuando llega el latido del
    // motor, esto se mueve con el precio.
    _paintQuadChart(read, panel) {
      const host = panel && panel.querySelector('.js-chart');
      if (!host) return;
      const winStart = Math.floor(Date.now() / CFG.windowMs) * CFG.windowMs;
      const openRef = this._windowOpenPrice(read, winStart);
      const priceSamples = this._baselineSeries(read, winStart);
      if (!this._baselineScale) this._baselineScale = {};
      const scale = this._baselineScale[read.id] || (this._baselineScale[read.id] = {});
      const drawn = isFinite(openRef)
        ? baselineSvg(priceSamples, openRef, winStart, CFG.baselineWindowMs, scale)
        : null;
      if (!drawn) {
        this._setHTML(host, 'q-chart:' + read.id, isFinite(openRef)
          ? '<div class="ltb-empty">Cargando precio en vivo…</div>'
          : '<div class="ltb-empty">Esperando la apertura oficial de la vela…</div>');
        return;
      }
      if (!host.querySelector('.ltb-baseline-svg')) {
        this._setHTML(host, 'q-chart:' + read.id, BASELINE_SKELETON);
      }
      const setPath = (selector, d) => {
        const node = host.querySelector(selector);
        if (node && node.getAttribute('d') !== d) node.setAttribute('d', d);
      };
      setPath('.ltb-baseline-fill.up', drawn.paths.fillUp);
      setPath('.ltb-baseline-fill.down', drawn.paths.fillDown);
      setPath('.ltb-baseline-line.up', drawn.paths.lineUp);
      setPath('.ltb-baseline-line.down', drawn.paths.lineDown);

      const dot = host.querySelector('.ltb-baseline-dot');
      if (dot) {
        const tone = 'ltb-baseline-dot ' + (drawn.lastUp ? 'up' : 'down');
        if (dot.className !== tone) dot.className = tone;
        dot.style.left = drawn.lastX.toFixed(2) + '%';
        dot.style.top = drawn.lastY.toFixed(2) + '%';
      }
      const openEl = host.querySelector('.ltb-q-open');
      if (openEl) openEl.textContent = 'apertura ' + fmtUSD(openRef, read.meta.decimals);
      const devEl = host.querySelector('.ltb-q-dev');
      if (devEl) {
        const livePrice = Number(read.asset.market.price);
        const movePct = isFinite(livePrice) && openRef > 0 ? ((livePrice - openRef) / openRef) * 100 : null;
        devEl.className = 'ltb-q-dev ' + (movePct == null ? '' : (movePct >= 0 ? 'up' : 'down'));
        devEl.textContent = movePct == null ? '' : (movePct >= 0 ? '+' : '') + movePct.toFixed(3) + '%';
      }
    },

    // Historial lateral: un punto por vela ya liquidada, de la mas vieja a la
    // mas nueva. El ultimo es la vela que acaba de cerrar y va fosforescente
    // para que se vea de un golpe cual fue la anterior.
    _paintQuadDots(read, panel) {
      const host = panel && panel.querySelector('.js-dots');
      if (!host) return;
      const rows = read.settled.slice(0, 30).reverse();
      if (!rows.length) {
        this._setHTML(host, 'q-dots:' + read.id, '<span class="ltb-q-dots-empty">sin velas liquidadas</span>');
        return;
      }
      const html = rows.map((row, index) => {
        const won = String(row.status).toLowerCase() === 'won';
        const last = index === rows.length - 1;
        const title = fmtClock(row.window_start || row.emitted_at) + ' · '
          + String(row.direction || '--').toUpperCase() + ' · ' + (won ? 'ganada' : 'perdida');
        return '<i class="' + (won ? 'win' : 'loss') + (last ? ' last' : '')
          + '" title="' + esc(title) + (last ? ' (vela anterior)' : '') + '"></i>';
      }).join('');
      this._setHTML(host, 'q-dots:' + read.id, html);
    },

    _injectStyles() {
      // Ojo con esto al actualizar por Store: antes se salia si YA existia un
      // <style> con este id, y tras una actualizacion el que sigue en la pagina
      // es el de la version vieja. El codigo entraba nuevo y los estilos se
      // quedaban viejos, asi que lo que se acababa de agregar salia en crudo.
      // Ahora la etiqueta lleva la version y se reescribe cuando no coincide.
      const previo = document.getElementById('ltb-styles');
      if (previo && previo.getAttribute('data-version') === APP_VERSION) return;
      const style = previo || document.createElement('style');
      style.id = 'ltb-styles';
      style.setAttribute('data-version', APP_VERSION);
      style.textContent = `
.ltb-root{
  --ltb-void:#07070a;--ltb-panel:#101015;--ltb-panel-raised:#15151d;--ltb-deep:#0b0b10;
  --ltb-edge:#25252f;--ltb-edge-hot:#3c1420;--ltb-ink:#f3f4f6;--ltb-dim:#9a9aa8;
  --ltb-faint:#6b6b78;
  /* La direccion es lo unico con color propio: amarillo neon = UP, rojo = DOWN.
     Separan DE 29 en deuteranopia (validado), y siempre van con flecha y texto. */
  --ltb-up:#e8ff26;--ltb-down:#ff2d46;--ltb-target-up:#39ff14;
  --ltb-amber:#ffa31a;--ltb-red-deep:#7d0f1c;
  position:absolute;inset:0;display:flex;flex-direction:column;gap:12px;padding:0 16px 16px;
  overflow-y:auto;overflow-x:hidden;isolation:isolate;color:var(--ltb-ink);background:
    radial-gradient(760px 300px at 50% -14%,rgba(232,255,38,.06),transparent 70%),
    radial-gradient(600px 320px at 12% 4%,rgba(125,15,28,.22),transparent 68%),
    linear-gradient(180deg,#08080c 0%,var(--ltb-void) 100%);
  font-family:Inter,'Segoe UI',system-ui,-apple-system,sans-serif;
  font-size:13px;line-height:1.42;-webkit-font-smoothing:antialiased;}
.ltb-root.all-mode{overflow:hidden;}
.ltb-root::before{content:'';position:absolute;inset:0;pointer-events:none;z-index:0;opacity:.5;
  background-image:linear-gradient(rgba(232,255,38,.028) 1px,transparent 1px),
    linear-gradient(90deg,rgba(255,45,70,.03) 1px,transparent 1px);
  background-size:44px 44px;mask-image:linear-gradient(to bottom,black,transparent 82%);}
.ltb-root>*{position:relative;z-index:1;}
.ltb-root *{box-sizing:border-box;}
.ltb-root ::selection{color:#0b0b10;background:var(--ltb-up);}

.ltb-top{position:sticky;top:0;z-index:20;min-height:70px;display:flex;align-items:center;
  justify-content:space-between;gap:18px;flex:none;
  border-bottom:1px solid rgba(255,45,70,.24);background:rgba(8,8,12,.95);backdrop-filter:blur(14px);}
.ltb-brand{display:flex;align-items:center;gap:11px;min-width:0;}
.ltb-logo{display:grid;place-items:center;width:40px;height:40px;flex:none;border-radius:11px;
  color:#0b0b10;background:linear-gradient(150deg,var(--ltb-up),var(--ltb-amber) 60%,var(--ltb-down));
  font-size:21px;font-weight:800;box-shadow:0 0 18px rgba(232,255,38,.24);}
.ltb-brand h1{margin:0;color:var(--ltb-ink);font-size:17px;font-weight:700;letter-spacing:.01em;}
.ltb-brand p{max-width:420px;margin:2px 0 0;overflow:hidden;color:var(--ltb-dim);font-size:11px;
  text-overflow:ellipsis;white-space:nowrap;}
.ltb-target-meter{position:absolute;top:50%;left:50%;display:flex;align-items:stretch;justify-content:center;flex-direction:column;
  gap:10px;width:clamp(280px,28vw,440px);height:46px;padding:2px 9px;pointer-events:none;
  transform:translate(-50%,-40%);transition:opacity .25s ease;}
.ltb-target-meter[hidden]{display:none;}
.ltb-target-timer{position:relative;display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:13px;
  color:rgba(218,232,228,.58);font-size:8px;font-weight:800;letter-spacing:.14em;line-height:1;}
.ltb-target-timer strong{color:#e8ff26;font-size:11px;font-variant-numeric:tabular-nums;letter-spacing:.04em;
  text-shadow:0 0 10px rgba(232,255,38,.42);}
.ltb-target-timer i{position:absolute;left:0;bottom:-3px;width:0;height:2px;border-radius:999px;
  background:var(--ltb-up);box-shadow:0 0 8px var(--ltb-up);transition:width .8s linear;}
.ltb-target-track{position:relative;width:100%;height:7px;border:1px solid rgba(255,255,255,.14);
  border-radius:999px;background:linear-gradient(90deg,
    rgba(255,45,70,.92) 0%,rgba(255,45,70,.72) 43%,rgba(255,45,70,.15) 49%,
    rgba(57,255,20,.15) 51%,rgba(57,255,20,.72) 57%,rgba(57,255,20,.92) 100%);
  box-shadow:-12px 0 22px rgba(255,45,70,.2),12px 0 22px rgba(57,255,20,.2),
    inset 0 1px 3px rgba(0,0,0,.72);}
.ltb-target-track::before{content:'';position:absolute;inset:1px;border-radius:inherit;
  background:linear-gradient(180deg,rgba(255,255,255,.32),transparent 58%);opacity:.68;}
.ltb-target-fill{position:absolute;z-index:2;top:1px;left:50%;width:0;height:4px;border-radius:999px;
  background:#f4fff0;box-shadow:0 0 10px currentColor,0 0 18px currentColor;
  transition:left .14s linear,width .14s linear,background .2s ease;}
.ltb-target-center{position:absolute;z-index:3;top:50%;left:50%;width:2px;height:20px;border-radius:3px;
  background:#f8fff7;box-shadow:0 0 10px rgba(255,255,255,.92);transform:translate(-50%,-50%);}
.ltb-target-marker{position:absolute;z-index:4;top:50%;left:50%;width:15px;height:15px;border:2px solid #f5fff3;
  border-radius:50%;background:#101015;box-shadow:0 0 0 3px rgba(255,255,255,.1),0 0 14px rgba(255,255,255,.34);
  transform:translate(-50%,-50%);transition:left .14s linear,border-color .2s ease,
  background .2s ease,box-shadow .2s ease;}
.ltb-target-meter.up .ltb-target-fill{color:var(--ltb-target-up);background:var(--ltb-target-up);}
.ltb-target-meter.up .ltb-target-marker{border-color:#b6ffa8;background:#1bd000;
  box-shadow:0 0 0 3px rgba(57,255,20,.16),0 0 14px var(--ltb-target-up),0 0 24px rgba(57,255,20,.72);}
.ltb-target-meter.down .ltb-target-fill{color:var(--ltb-down);background:var(--ltb-down);}
.ltb-target-meter.down .ltb-target-marker{border-color:#ff9aaa;background:#ed1639;
  box-shadow:0 0 0 3px rgba(255,45,70,.16),0 0 14px var(--ltb-down),0 0 24px rgba(255,45,70,.72);}
.ltb-target-meter.flat .ltb-target-marker{border-color:#f5fff3;background:#58605a;}
.ltb-target-meter.waiting{opacity:.72;}
.ltb-top-live{display:flex;align-items:center;gap:14px;}
.ltb-price{text-align:right;}
.ltb-price span{display:block;margin-bottom:1px;color:var(--ltb-faint);font-size:9px;font-weight:700;letter-spacing:.2em;}
.ltb-price strong{display:block;color:var(--ltb-ink);font-size:25px;font-weight:700;
  font-variant-numeric:tabular-nums;letter-spacing:-.03em;line-height:1.1;}
.ltb-price strong.small{font-size:17px;color:var(--ltb-up);}
.ltb-link{display:flex;align-items:center;gap:8px;min-height:34px;padding:7px 12px;border:1px solid var(--ltb-edge);
  border-radius:9px;color:var(--ltb-dim);background:#0d0d13;font-size:11px;font-weight:600;white-space:nowrap;}
.ltb-link i{width:7px;height:7px;flex:none;border-radius:50%;background:var(--ltb-faint);}
.ltb-link.online{color:#e9ffb0;border-color:rgba(232,255,38,.4);background:rgba(232,255,38,.07);}
.ltb-link.online i{background:var(--ltb-up);box-shadow:0 0 9px var(--ltb-up);}
.ltb-link.maint{color:#ffd9a1;border-color:rgba(255,163,26,.4);background:rgba(255,163,26,.07);}
.ltb-link.maint i{background:var(--ltb-amber);}
.ltb-link.offline{color:#ffb4be;border-color:rgba(255,45,70,.4);background:rgba(255,45,70,.08);}
.ltb-link.offline i{background:var(--ltb-down);}

/* Selector de activos */
.ltb-rail{display:grid;grid-template-columns:repeat(4,minmax(0,1fr)) 1.15fr;gap:8px;flex:none;}
.ltb-tab{display:flex;align-items:center;gap:9px;padding:9px 12px;border:1px solid var(--ltb-edge);
  border-radius:11px;color:var(--ltb-dim);background:linear-gradient(180deg,#131319,#0d0d12);
  font-family:inherit;font-size:12px;text-align:left;cursor:pointer;
  transition:border-color .18s ease,background .18s ease,transform .18s ease;}
.ltb-tab:hover{border-color:rgba(232,255,38,.36);transform:translateY(-1px);}
.ltb-tab.active{border-color:var(--ltb-up);color:var(--ltb-ink);
  background:linear-gradient(180deg,rgba(232,255,38,.13),rgba(232,255,38,.03));
  box-shadow:0 0 0 1px rgba(232,255,38,.22),0 8px 22px rgba(232,255,38,.09);}
.ltb-tab-glyph{display:grid;place-items:center;width:26px;height:26px;flex:none;border-radius:8px;
  color:var(--ltb-ink);background:#1b1b23;font-size:14px;font-weight:700;}
.ltb-tab.active .ltb-tab-glyph{color:#0b0b10;background:var(--ltb-up);}
.ltb-tab-id{display:flex;flex-direction:column;min-width:0;flex:1;}
.ltb-tab-id strong{color:inherit;font-size:12.5px;font-weight:700;letter-spacing:.04em;}
.ltb-tab-id small{overflow:hidden;color:var(--ltb-faint);font-size:10.5px;font-variant-numeric:tabular-nums;
  text-overflow:ellipsis;white-space:nowrap;}
.ltb-tab.active .ltb-tab-id small{color:var(--ltb-dim);}
.ltb-tab-dot{width:8px;height:8px;flex:none;border-radius:50%;background:#2c2c36;}
.ltb-tab-dot.idle{background:#3c3c48;}
.ltb-tab-dot.up{background:var(--ltb-up);box-shadow:0 0 10px var(--ltb-up);animation:ltbPulse 1.9s infinite;}
.ltb-tab-dot.down{background:var(--ltb-down);box-shadow:0 0 10px var(--ltb-down);animation:ltbPulse 1.9s infinite;}
.ltb-tab-grid{display:grid;grid-template-columns:1fr 1fr;gap:2px;width:26px;height:26px;flex:none;padding:5px;
  border-radius:8px;background:#1b1b23;}
.ltb-tab-grid i{border-radius:1px;background:var(--ltb-faint);}
.ltb-tab.active .ltb-tab-grid{background:var(--ltb-up);}
.ltb-tab.active .ltb-tab-grid i{background:#0b0b10;}
@keyframes ltbPulse{0%,100%{opacity:1}50%{opacity:.35}}

/* Vista simple */
.ltb-grid{flex:none;display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:10px;align-items:stretch;}
.ltb-grid[hidden]{display:none;}
/* La tecnica ocupa la columna derecha entera: es la lectura larga y evita que
   la tarjeta de senal se estire con un hueco vacio debajo del reloj. */
#ltbSignalCard{grid-column:1 / 8;grid-row:1;}#ltbTacticCard{grid-column:8 / 13;grid-row:1 / 3;}
.ltb-chart-card{grid-column:1 / 8;grid-row:2;}
#ltbLiveCard{grid-column:1 / 6;grid-row:3;}.ltb-phases-card{grid-column:6 / 10;grid-row:3;}
.ltb-score-card{grid-column:10 / 13;grid-row:3;}
.ltb-history-card{grid-column:1 / 8;grid-row:4;}#ltbSimCard{grid-column:8 / 13;grid-row:4;}
.ltb-root::-webkit-scrollbar,.ltb-history::-webkit-scrollbar,.ltb-phases::-webkit-scrollbar,
.ltb-specialists::-webkit-scrollbar{width:6px;}
.ltb-root::-webkit-scrollbar-track,.ltb-history::-webkit-scrollbar-track,.ltb-phases::-webkit-scrollbar-track,
.ltb-specialists::-webkit-scrollbar-track{background:transparent;}
.ltb-root::-webkit-scrollbar-thumb,.ltb-history::-webkit-scrollbar-thumb,.ltb-phases::-webkit-scrollbar-thumb,
.ltb-specialists::-webkit-scrollbar-thumb{border:2px solid transparent;border-radius:999px;background:#3a3a46;
  background-clip:padding-box;}

.ltb-card{position:relative;padding:14px;border:1px solid var(--ltb-edge);border-radius:13px;
  background:linear-gradient(180deg,var(--ltb-panel-raised),var(--ltb-panel));
  box-shadow:0 10px 26px rgba(0,0,0,.4);}
.ltb-card::after{content:'';position:absolute;top:-1px;left:14px;right:14px;height:1px;
  background:linear-gradient(90deg,transparent,rgba(255,45,70,.55),transparent);}
.ltb-card-head{display:flex;align-items:center;justify-content:space-between;gap:9px;margin-bottom:12px;}
.ltb-eyebrow{color:#8a8a98;font-size:9.5px;font-weight:800;letter-spacing:.16em;line-height:1.2;}
.ltb-eyebrow b{color:var(--ltb-up);font-weight:800;}
.ltb-chip{max-width:58%;overflow:hidden;padding:4px 8px;border:1px solid var(--ltb-edge);
  border-radius:7px;color:var(--ltb-dim);background:#0d0d13;font-size:10px;font-weight:600;
  letter-spacing:.05em;text-overflow:ellipsis;white-space:nowrap;}

/* Senal */
.ltb-signal{display:flex;flex-direction:column;overflow:hidden;
  transition:border-color .25s ease,box-shadow .25s ease;}
.ltb-signal.up{border-color:rgba(232,255,38,.42);background:
  linear-gradient(140deg,rgba(232,255,38,.08),transparent 46%),linear-gradient(180deg,var(--ltb-panel-raised),var(--ltb-panel));}
.ltb-signal.up::after{background:var(--ltb-up);box-shadow:0 0 14px var(--ltb-up);}
.ltb-signal.down{border-color:rgba(255,45,70,.45);background:
  linear-gradient(140deg,rgba(255,45,70,.09),transparent 46%),linear-gradient(180deg,var(--ltb-panel-raised),var(--ltb-panel));}
.ltb-signal.down::after{background:var(--ltb-down);box-shadow:0 0 14px var(--ltb-down);}
.ltb-signal.up.live{box-shadow:0 0 0 1px rgba(232,255,38,.3),0 10px 40px rgba(232,255,38,.13);}
.ltb-signal.down.live{box-shadow:0 0 0 1px rgba(255,45,70,.32),0 10px 40px rgba(255,45,70,.15);}
.ltb-signal.issue{border-color:rgba(255,163,26,.4);}
.ltb-signal.issue::after{background:var(--ltb-amber);}
.ltb-signal.issue .ltb-dir-icon{color:var(--ltb-amber);border-color:rgba(255,163,26,.4);background:rgba(255,163,26,.09);}
.ltb-signal-main{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:11px;}
.ltb-dir{display:flex;align-items:center;gap:12px;min-width:0;}
.ltb-dir-icon{display:grid;place-items:center;width:48px;height:48px;flex:none;border:1px solid var(--ltb-edge);
  border-radius:12px;color:var(--ltb-dim);background:var(--ltb-deep);font-size:24px;line-height:1;}
.ltb-signal.up .ltb-dir-icon{color:var(--ltb-up);border-color:rgba(232,255,38,.45);background:rgba(232,255,38,.09);
  text-shadow:0 0 14px rgba(232,255,38,.6);}
.ltb-signal.down .ltb-dir-icon{color:var(--ltb-down);border-color:rgba(255,45,70,.45);background:rgba(255,45,70,.1);
  text-shadow:0 0 14px rgba(255,45,70,.6);}
.ltb-signal.live .ltb-dir-icon{animation:ltbBreath 2.2s ease-in-out infinite;}
@keyframes ltbBreath{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
.ltb-dir-label{display:block;margin-bottom:3px;color:var(--ltb-faint);font-size:9.5px;font-weight:700;letter-spacing:.14em;}
.ltb-signal.up .ltb-dir-label{color:var(--ltb-up);}.ltb-signal.down .ltb-dir-label{color:var(--ltb-down);}
.ltb-dir strong{display:block;overflow:hidden;color:var(--ltb-ink);font-size:22px;font-weight:800;letter-spacing:-.02em;
  text-overflow:ellipsis;white-space:nowrap;}
.ltb-conf{min-width:150px;text-align:right;}
.ltb-conf span{display:block;color:var(--ltb-faint);font-size:9.5px;font-weight:700;letter-spacing:.14em;}
.ltb-conf strong{display:block;margin-top:1px;color:var(--ltb-ink);font-size:28px;font-weight:800;
  font-variant-numeric:tabular-nums;letter-spacing:-.035em;line-height:1.1;}
.ltb-conf-track{height:5px;margin-top:7px;overflow:hidden;border-radius:999px;background:#22222c;}
.ltb-conf-track i{display:block;width:0;height:100%;border-radius:999px;background:var(--ltb-faint);
  transition:width .55s cubic-bezier(.22,1,.36,1);}
.ltb-conf-track i.up{background:var(--ltb-up);box-shadow:0 0 10px rgba(232,255,38,.6);}
.ltb-conf-track i.down{background:var(--ltb-down);box-shadow:0 0 10px rgba(255,45,70,.6);}
.ltb-signal-copy{margin:0 0 12px;color:#b6b6c2;font-size:12px;line-height:1.5;}
.ltb-signal-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-bottom:12px;}
.ltb-signal-stats div{min-width:0;padding:9px 10px;border:1px solid #1e1e27;border-radius:9px;background:var(--ltb-deep);}
.ltb-signal-stats span{display:block;margin-bottom:4px;color:var(--ltb-faint);font-size:9px;font-weight:700;letter-spacing:.1em;}
.ltb-signal-stats strong{display:block;overflow:hidden;color:#e6e7ec;font-size:14px;font-weight:700;
  font-variant-numeric:tabular-nums;text-overflow:ellipsis;white-space:nowrap;}
.ltb-outcome.win{color:var(--ltb-up);}.ltb-outcome.loss{color:var(--ltb-down);}.ltb-outcome.pending{color:var(--ltb-amber);}

/* Reloj, ahora dentro de la tarjeta de senal */
.ltb-clock{display:flex;align-items:center;gap:14px;margin-top:auto;padding-top:12px;border-top:1px solid #1c1c25;}
.ltb-clock-dial{position:relative;width:92px;height:92px;flex:none;}
.ltb-clock-dial svg{width:100%;height:100%;transform:rotate(-90deg);}
.ltb-ring-track{fill:none;stroke:#22222c;stroke-width:8;}
.ltb-ring-fill{fill:none;stroke:var(--ltb-up);stroke-width:8;stroke-linecap:round;
  filter:drop-shadow(0 0 5px rgba(232,255,38,.45));transition:stroke-dashoffset .55s cubic-bezier(.22,1,.36,1);}
.ltb-signal.down .ltb-ring-fill{stroke:var(--ltb-down);filter:drop-shadow(0 0 5px rgba(255,45,70,.45));}
.ltb-clock-read{position:absolute;inset:0;display:grid;place-content:center;text-align:center;}
.ltb-clock-read span{display:block;margin-bottom:2px;color:var(--ltb-faint);font-size:7.5px;font-weight:700;letter-spacing:.16em;}
.ltb-clock-read strong{color:var(--ltb-ink);font-size:19px;font-weight:700;font-variant-numeric:tabular-nums;}
.ltb-clock-badge{display:inline-block;margin-bottom:5px;padding:3px 7px;border:1px solid var(--ltb-edge);
  border-radius:6px;color:var(--ltb-dim);background:var(--ltb-deep);font-size:9px;font-weight:700;letter-spacing:.1em;}
.ltb-clock-copy strong{display:block;margin-bottom:4px;color:#e6e7ec;font-size:13.5px;font-weight:700;}
.ltb-clock-copy p{margin:0;color:var(--ltb-dim);font-size:11.5px;line-height:1.5;}

/* Tecnica / tesis / plan */
.ltb-tactic-card{display:flex;flex-direction:column;}
.ltb-tactic-card.up{border-color:rgba(232,255,38,.3);}
.ltb-tactic-card.down{border-color:rgba(255,45,70,.32);}
.ltb-tactic-card.engaged::after{background:linear-gradient(90deg,transparent,var(--ltb-up),transparent);}
.ltb-technique{display:block;color:var(--ltb-up);font-size:16px;font-weight:800;letter-spacing:.02em;
  text-shadow:0 0 18px rgba(232,255,38,.28);}
.ltb-technique.hunt{color:var(--ltb-amber);text-shadow:0 0 18px rgba(255,163,26,.28);}
.ltb-technique.super{color:var(--ltb-up);}
.ltb-technique-how{margin:6px 0 10px;color:var(--ltb-dim);font-size:11.5px;line-height:1.5;}
.ltb-flags{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;}
.ltb-flags[hidden]{display:none;}
.ltb-flags span{padding:3px 7px;border:1px solid rgba(255,45,70,.4);border-radius:6px;color:#ffb4be;
  background:rgba(255,45,70,.09);font-size:9px;font-weight:700;letter-spacing:.08em;}
.ltb-thesis{padding:10px 11px;margin-bottom:10px;border:1px solid #1e1e27;border-left:2px solid var(--ltb-down);
  border-radius:9px;background:var(--ltb-deep);}
.ltb-thesis strong{display:block;margin:5px 0 4px;color:#e9eaef;font-size:13.5px;font-weight:700;}
.ltb-thesis strong.good{color:var(--ltb-up);}.ltb-thesis strong.warn{color:var(--ltb-amber);}
.ltb-thesis strong.danger{color:var(--ltb-down);}
.ltb-thesis p{margin:0;color:#b0b0be;font-size:11.5px;line-height:1.5;}
.ltb-forecast{padding:10px 11px;margin-bottom:10px;border:1px solid rgba(255,255,255,.08);
  border-left:2px solid var(--ltb-faint);border-radius:9px;background:linear-gradient(180deg,#101017,#0c0c11);}
.ltb-forecast.up{border-left-color:var(--ltb-up);}.ltb-forecast.down{border-left-color:var(--ltb-down);}
.ltb-forecast.waiting{opacity:.82;}
.ltb-forecast-head{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.ltb-forecast-chip{padding:3px 6px;border:1px solid rgba(232,255,38,.28);border-radius:5px;
  color:var(--ltb-up);font-size:8px;font-weight:800;letter-spacing:.08em;}
.ltb-forecast-main{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin:5px 0 7px;}
.ltb-forecast-main strong{color:var(--ltb-ink);font-size:20px;font-weight:800;letter-spacing:.01em;font-variant-numeric:tabular-nums;}
.ltb-forecast.up .ltb-forecast-main strong{color:var(--ltb-up);text-shadow:0 0 14px rgba(232,255,38,.3);}
.ltb-forecast.down .ltb-forecast-main strong{color:var(--ltb-down);text-shadow:0 0 14px rgba(255,45,70,.3);}
.ltb-forecast-main span{color:var(--ltb-dim);font-size:10px;white-space:nowrap;}
.ltb-forecast-track{display:flex;height:7px;overflow:hidden;border-radius:999px;background:#22222c;}
.ltb-forecast-track i{display:block;height:100%;transition:width .55s cubic-bezier(.22,1,.36,1);}
.ltb-forecast-track i.down{background:var(--ltb-down);box-shadow:0 0 12px rgba(255,45,70,.42);}
.ltb-forecast-track i.up{background:var(--ltb-up);box-shadow:0 0 12px rgba(232,255,38,.42);}
.ltb-forecast-legend{display:flex;justify-content:space-between;margin-top:5px;font-size:10px;font-weight:700;font-variant-numeric:tabular-nums;}
.ltb-forecast-legend .down{color:var(--ltb-down);}.ltb-forecast-legend .up{color:var(--ltb-up);}
.ltb-forecast-legend b{font-weight:800;}
.ltb-forecast-specialists{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;margin-top:8px;}
.ltb-forecast-specialist{display:flex;align-items:center;justify-content:space-between;gap:5px;min-width:0;padding:4px 6px;
  border:1px solid #1e1e27;border-radius:6px;background:rgba(0,0,0,.18);font-size:9px;}
.ltb-forecast-specialist b{overflow:hidden;color:var(--ltb-dim);font-weight:600;text-overflow:ellipsis;white-space:nowrap;}
.ltb-forecast-specialist strong{color:var(--ltb-faint);font-weight:800;font-variant-numeric:tabular-nums;}
.ltb-forecast-specialist.up strong{color:var(--ltb-up);}.ltb-forecast-specialist.down strong{color:var(--ltb-down);}
.ltb-forecast p{margin:7px 0 0;color:var(--ltb-dim);font-size:10px;line-height:1.4;}
.ltb-plan{margin-top:0;}
.ltb-plan-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;}
.ltb-stage{padding:3px 8px;border:1px solid var(--ltb-edge);border-radius:6px;color:var(--ltb-dim);
  background:var(--ltb-deep);font-size:9.5px;font-weight:700;letter-spacing:.06em;}
.ltb-stage.live{color:#0b0b10;border-color:var(--ltb-up);background:var(--ltb-up);}
.ltb-stage.ready{color:var(--ltb-up);border-color:rgba(232,255,38,.45);background:rgba(232,255,38,.1);}
.ltb-stage.wait{color:var(--ltb-amber);border-color:rgba(255,163,26,.35);background:rgba(255,163,26,.08);}
.ltb-plan-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;}
.ltb-plan-cell{padding:8px 9px;border:1px solid #1e1e27;border-radius:8px;background:var(--ltb-deep);}
.ltb-plan-cell span{display:block;margin-bottom:3px;color:var(--ltb-faint);font-size:9px;font-weight:700;letter-spacing:.08em;}
.ltb-plan-cell strong{display:block;overflow:hidden;color:#e6e7ec;font-size:12.5px;font-weight:700;
  font-variant-numeric:tabular-nums;text-overflow:ellipsis;white-space:nowrap;}
.ltb-plan-cell.up strong{color:var(--ltb-up);}.ltb-plan-cell.down strong{color:var(--ltb-down);}
.ltb-plan-cell.warn{border-color:rgba(255,163,26,.3);}.ltb-plan-cell.warn strong{color:var(--ltb-amber);}
.ltb-plan-cell.warn strong{white-space:normal;font-size:11px;}
.ltb-watch{display:grid;gap:4px;margin:9px 0 0;padding-left:15px;color:var(--ltb-dim);font-size:11px;line-height:1.45;}
.ltb-watch[hidden]{display:none;}
.ltb-watch li::marker{color:var(--ltb-up);}
.ltb-notice{margin:9px 0 0;padding:7px 9px;border:1px solid rgba(255,163,26,.32);border-radius:8px;
  color:#ffd9a1;background:rgba(255,163,26,.08);font-size:11px;line-height:1.45;}
.ltb-notice[hidden]{display:none;}

/* Grafico */
.ltb-chart-card .ltb-card-head{flex-wrap:wrap;}
.ltb-chart-head-left{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.ltb-tf-group{display:inline-flex;gap:3px;padding:3px;border:1px solid var(--ltb-edge);border-radius:8px;
  background:var(--ltb-deep);}
.ltb-tf-btn{padding:4px 9px;border:0;border-radius:6px;color:var(--ltb-dim);background:transparent;
  font-family:inherit;font-size:10.5px;font-weight:700;letter-spacing:.03em;cursor:pointer;
  transition:background .15s ease,color .15s ease;}
.ltb-tf-btn:hover{color:var(--ltb-ink);}
.ltb-tf-btn.active{color:#0b0b10;background:var(--ltb-up);box-shadow:0 0 10px rgba(232,255,38,.35);}
.ltb-chart-card{height:330px;min-height:0;display:flex;flex-direction:column;}
.ltb-chart{position:relative;flex:1;min-height:0;display:flex;flex-direction:column;padding:10px 10px 7px;
  overflow:hidden;border:1px solid #1e1e27;border-radius:10px;background-color:#08080c;
  background-image:linear-gradient(rgba(255,45,70,.07) 1px,transparent 1px),
    linear-gradient(90deg,rgba(255,45,70,.05) 1px,transparent 1px);
  background-size:100% 25%,12.5% 100%;}
.ltb-chart>.ltb-empty{margin:auto;}
.ltb-chart-svg{display:block;flex:1;width:100%;min-height:0;overflow:visible;shape-rendering:geometricPrecision;}
.ltb-chart-svg .body.up,.ltb-chart-svg .wick.up{fill:var(--ltb-up);stroke:var(--ltb-up);}
.ltb-chart-svg .body.down,.ltb-chart-svg .wick.down{fill:var(--ltb-down);stroke:var(--ltb-down);}
.ltb-chart-svg .wick{stroke-width:.24;}
.ltb-openline{stroke:#ffffff;stroke-width:.3;stroke-dasharray:2 2;opacity:.5;}
.ltb-chart-legend{display:flex;justify-content:space-between;gap:10px;margin-top:6px;color:var(--ltb-dim);font-size:9.5px;
  font-variant-numeric:tabular-nums;}
.ltb-chart-legend i.ref{display:inline-block;width:12px;height:1px;margin-right:5px;vertical-align:middle;background:#fff;opacity:.6;}

/* Analisis en vivo */
.ltb-live{display:flex;flex-direction:column;}
.ltb-risk{margin-bottom:11px;}
.ltb-risk-copy{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:6px;}
.ltb-risk-copy span{color:var(--ltb-faint);font-size:9.5px;font-weight:700;letter-spacing:.12em;}
.ltb-risk-copy strong{color:var(--ltb-ink);font-size:20px;font-weight:700;font-variant-numeric:tabular-nums;}
.ltb-risk-track{height:6px;overflow:hidden;border-radius:999px;background:#22222c;}
.ltb-risk-track i{display:block;width:0;height:100%;border-radius:999px;background:var(--ltb-up);
  transition:width .55s cubic-bezier(.22,1,.36,1);}
.ltb-risk.mid .ltb-risk-track i{background:var(--ltb-amber);}
.ltb-risk.high .ltb-risk-track i{background:#ff6a2a;}
.ltb-risk.extreme .ltb-risk-track i{background:var(--ltb-down);box-shadow:0 0 10px rgba(255,45,70,.7);}
.ltb-risk.high .ltb-risk-copy strong{color:#ff7a3d;}
.ltb-risk.extreme .ltb-risk-copy strong{color:var(--ltb-down);}
.ltb-risk small{display:block;margin-top:7px;color:var(--ltb-dim);font-size:10.5px;line-height:1.45;}
.ltb-reasoning{margin:0 0 10px;color:#b0b0be;font-size:11.5px;line-height:1.5;}
.ltb-spec-health{margin-bottom:9px;padding:5px 8px;border:1px solid var(--ltb-edge);border-radius:7px;
  color:var(--ltb-dim);background:var(--ltb-deep);font-size:10px;font-weight:600;line-height:1.4;}
.ltb-spec-health[hidden]{display:none;}
.ltb-spec-health.degraded{color:#ffd9a1;border-color:rgba(255,163,26,.4);background:rgba(255,163,26,.08);}
.ltb-specialists{display:grid;gap:8px;max-height:220px;overflow-y:auto;}
.ltb-spec.off{opacity:.55;}
.ltb-spec.off strong{color:var(--ltb-amber);font-size:9.5px;font-weight:700;letter-spacing:.04em;}
.ltb-spec.off .ltb-spec-bar{background:repeating-linear-gradient(90deg,#22222c 0 4px,transparent 4px 8px);}
.ltb-spec{display:grid;grid-template-columns:minmax(0,1fr) 76px 38px;align-items:center;gap:8px;font-size:11px;}
.ltb-spec span{overflow:hidden;color:var(--ltb-dim);text-overflow:ellipsis;white-space:nowrap;}
.ltb-spec-bar{height:5px;overflow:hidden;border-radius:999px;background:#22222c;}
.ltb-spec-bar i{display:block;height:100%;border-radius:999px;background:var(--ltb-faint);transition:width .5s cubic-bezier(.22,1,.36,1);}
.ltb-spec.up .ltb-spec-bar i{background:var(--ltb-up);}.ltb-spec.down .ltb-spec-bar i{background:var(--ltb-down);}
.ltb-spec strong{text-align:right;font-weight:700;font-variant-numeric:tabular-nums;}
.ltb-spec.up strong{color:var(--ltb-up);}.ltb-spec.down strong{color:var(--ltb-down);}

.ltb-phases-card{display:flex;flex-direction:column;}
.ltb-phases{display:grid;gap:5px;min-height:0;max-height:214px;overflow-y:auto;}
.ltb-phase{display:grid;grid-template-columns:8px minmax(0,1fr) 40px;align-items:center;gap:8px;padding:7px 9px;
  border:1px solid #1c1c25;border-radius:8px;background:var(--ltb-deep);font-size:11px;}
.ltb-phase i{width:6px;height:6px;border-radius:50%;background:#4a4a58;}
.ltb-phase.support i{background:var(--ltb-up);}.ltb-phase.oppose i{background:var(--ltb-down);}
.ltb-phase.neutral i{background:var(--ltb-amber);}.ltb-phase.missing{opacity:.45;}
.ltb-phase span{overflow:hidden;color:#aeaebc;text-overflow:ellipsis;white-space:nowrap;}
.ltb-phase b{text-align:right;font-weight:700;font-variant-numeric:tabular-nums;}

.ltb-score{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px;text-align:center;}
.ltb-score div span{display:block;color:var(--ltb-ink);font-size:25px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.03em;}
.ltb-score div small{color:var(--ltb-faint);font-size:9px;font-weight:700;letter-spacing:.1em;}
.ltb-score .win span{color:var(--ltb-up);}.ltb-score .loss span{color:var(--ltb-down);}
.ltb-score-bar{height:5px;overflow:hidden;border-radius:999px;background:#22222c;}
.ltb-score-bar i{display:block;width:0;height:100%;border-radius:999px;background:var(--ltb-faint);transition:width .55s cubic-bezier(.22,1,.36,1);}
.ltb-score-bar i.good{background:var(--ltb-up);}.ltb-score-bar i.mid{background:var(--ltb-amber);}.ltb-score-bar i.bad{background:var(--ltb-down);}

.ltb-history-card{display:flex;flex-direction:column;}
.ltb-history{display:grid;gap:5px;min-height:0;max-height:250px;overflow-y:auto;}
.ltb-hist{display:grid;grid-template-columns:44px 70px 40px minmax(0,1fr);align-items:center;gap:8px;padding:7px 9px;
  border:1px solid #1c1c25;border-left:2px solid #3a3a46;border-radius:8px;background:var(--ltb-deep);font-size:10.5px;}
.ltb-hist.win{border-left-color:var(--ltb-up);}.ltb-hist.loss{border-left-color:var(--ltb-down);}
.ltb-hist.pending{border-left-color:var(--ltb-amber);}
.ltb-hist-time{color:var(--ltb-faint);font-variant-numeric:tabular-nums;}
.ltb-hist-dir{font-weight:700;}
.ltb-hist-dir.up{color:var(--ltb-up);}.ltb-hist-dir.down{color:var(--ltb-down);}
.ltb-hist-conf{color:var(--ltb-dim);font-variant-numeric:tabular-nums;}
.ltb-hist-res{overflow:hidden;color:var(--ltb-faint);font-size:8.5px;font-weight:700;letter-spacing:.06em;text-align:right;
  text-overflow:ellipsis;white-space:nowrap;}
.ltb-hist.win .ltb-hist-res{color:var(--ltb-up);}.ltb-hist.loss .ltb-hist-res{color:var(--ltb-down);}

.ltb-sim-card{display:flex;flex-direction:column;transition:border-color .25s ease;}
.ltb-sim-card.winning{border-color:rgba(232,255,38,.34);}.ltb-sim-card.losing{border-color:rgba(255,45,70,.34);}
.ltb-sim-top{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:10px;align-items:center;margin-bottom:10px;}
.ltb-sim-balance span{display:block;margin-bottom:3px;color:var(--ltb-faint);font-size:9px;font-weight:700;letter-spacing:.14em;}
.ltb-sim-balance strong{display:block;color:var(--ltb-ink);font-size:26px;font-weight:800;letter-spacing:-.04em;
  font-variant-numeric:tabular-nums;line-height:1.1;}
.ltb-sim-balance em{display:block;margin-top:2px;color:var(--ltb-dim);font-size:11.5px;font-style:normal;font-weight:700;
  font-variant-numeric:tabular-nums;}
.ltb-sim-balance em.up{color:var(--ltb-up);}.ltb-sim-balance em.down{color:var(--ltb-down);}
.ltb-sim-curve{height:64px;padding:6px;border:1px solid #1e1e27;border-radius:9px;background:var(--ltb-deep);}
.ltb-sim-curve svg{display:block;width:100%;height:100%;overflow:visible;}
.ltb-sim-line{fill:none;stroke-width:1.7;stroke-linejoin:round;vector-effect:non-scaling-stroke;}
.ltb-sim-line.up{stroke:var(--ltb-up);}.ltb-sim-line.down{stroke:var(--ltb-down);}
.ltb-sim-fill{stroke:none;opacity:.13;}.ltb-sim-fill.up{fill:var(--ltb-up);}.ltb-sim-fill.down{fill:var(--ltb-down);}
.ltb-sim-base{stroke:#3a3a46;stroke-width:.6;stroke-dasharray:2 2;vector-effect:non-scaling-stroke;}
.ltb-sim-inputs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:9px;}
.ltb-sim-inputs label{display:block;color:var(--ltb-faint);font-size:9px;font-weight:700;letter-spacing:.09em;}
.ltb-field{display:flex;align-items:center;gap:4px;margin-top:5px;padding:7px 9px;border:1px solid var(--ltb-edge);
  border-radius:8px;background:var(--ltb-deep);transition:border-color .18s ease,box-shadow .18s ease;}
.ltb-field:focus-within{border-color:var(--ltb-up);box-shadow:0 0 0 3px rgba(232,255,38,.12);}
.ltb-field i{color:var(--ltb-faint);font-size:11px;font-style:normal;}
.ltb-field input{flex:1;min-width:0;border:0;outline:0;color:var(--ltb-ink);background:transparent;
  font-family:inherit;font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;}
.ltb-field input::-webkit-outer-spin-button,.ltb-field input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
.ltb-sim-stats{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:9px;}
.ltb-sim-stats div{padding:7px 9px;border:1px solid #1c1c25;border-radius:8px;background:var(--ltb-deep);}
.ltb-sim-stats span{display:block;margin-bottom:2px;color:var(--ltb-faint);font-size:9px;font-weight:700;letter-spacing:.07em;}
.ltb-sim-stats strong{color:#e6e7ec;font-size:12.5px;font-weight:700;font-variant-numeric:tabular-nums;}
.ltb-sim-stats strong.up{color:var(--ltb-up);}.ltb-sim-stats strong.down{color:var(--ltb-down);}
.ltb-sim-note{margin:auto 0 0;color:var(--ltb-faint);font-size:10px;line-height:1.45;}

/* Vista de los 4 a la vez */
.ltb-quad{flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:10px;}
.ltb-quad[hidden]{display:none;}
.ltb-q{position:relative;min-height:0;display:flex;flex-direction:column;gap:8px;padding:12px;
  overflow:hidden;border:1px solid var(--ltb-edge);border-radius:13px;
  background:linear-gradient(180deg,var(--ltb-panel-raised),var(--ltb-panel));
  box-shadow:0 10px 26px rgba(0,0,0,.4);cursor:pointer;outline:none;
  transition:border-color .2s ease,box-shadow .2s ease,transform .2s ease;}
.ltb-q::after{content:'';position:absolute;top:-1px;left:12px;right:12px;height:1px;
  background:linear-gradient(90deg,transparent,rgba(255,45,70,.5),transparent);}
.ltb-q:hover,.ltb-q:focus-visible{transform:translateY(-2px);border-color:rgba(232,255,38,.4);}
.ltb-q.up{border-color:rgba(232,255,38,.42);}
.ltb-q.up::after{background:var(--ltb-up);box-shadow:0 0 12px var(--ltb-up);}
.ltb-q.down{border-color:rgba(255,45,70,.45);}
.ltb-q.down::after{background:var(--ltb-down);box-shadow:0 0 12px var(--ltb-down);}
.ltb-q.up.live{box-shadow:0 0 0 1px rgba(232,255,38,.3),0 10px 34px rgba(232,255,38,.12);}
.ltb-q.down.live{box-shadow:0 0 0 1px rgba(255,45,70,.32),0 10px 34px rgba(255,45,70,.14);}
.ltb-q.issue{border-color:rgba(255,163,26,.35);}
.ltb-q-head{display:flex;align-items:center;gap:9px;}
.ltb-q-glyph{display:grid;place-items:center;width:28px;height:28px;flex:none;border-radius:8px;
  color:var(--ltb-ink);background:#1b1b23;font-size:15px;font-weight:700;}
.ltb-q.up .ltb-q-glyph{color:#0b0b10;background:var(--ltb-up);}
.ltb-q.down .ltb-q-glyph{color:#0b0b10;background:var(--ltb-down);}
.ltb-q-id{display:flex;flex-direction:column;min-width:0;flex:1;}
.ltb-q-id strong{color:var(--ltb-ink);font-size:14px;font-weight:800;letter-spacing:.05em;}
.ltb-q-id small{color:var(--ltb-faint);font-size:9.5px;}
.ltb-q-price{display:flex;flex-direction:column;align-items:flex-end;min-width:0;}
.ltb-q-price strong{color:var(--ltb-ink);font-size:16px;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.02em;}
.ltb-q-price small{color:var(--ltb-faint);font-size:9px;font-weight:700;letter-spacing:.07em;}
.ltb-q-price small.on{color:var(--ltb-up);}
.ltb-q-signal{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid #1e1e27;border-radius:9px;
  background:var(--ltb-deep);}
.ltb-q-arrow{font-size:18px;line-height:1;color:var(--ltb-dim);}
.ltb-q.up .ltb-q-arrow{color:var(--ltb-up);text-shadow:0 0 12px rgba(232,255,38,.6);}
.ltb-q.down .ltb-q-arrow{color:var(--ltb-down);text-shadow:0 0 12px rgba(255,45,70,.6);}
.ltb-q-arrow.idle{color:var(--ltb-faint);}
.ltb-q-signal strong{font-size:14px;font-weight:800;letter-spacing:.04em;}
.ltb-q.up .ltb-q-signal strong{color:var(--ltb-up);}
.ltb-q.down .ltb-q-signal strong{color:var(--ltb-down);}
.ltb-q-signal strong.idle{color:var(--ltb-dim);font-size:11.5px;font-weight:700;}
.ltb-q-conf{color:#d6d7de;font-size:12px;font-weight:700;font-variant-numeric:tabular-nums;}
.ltb-q-cd{margin-left:auto;color:var(--ltb-dim);font-size:11px;font-variant-numeric:tabular-nums;}
.ltb-q-res{padding:2px 6px;border-radius:5px;color:var(--ltb-faint);background:#17171f;font-size:8.5px;font-weight:700;letter-spacing:.06em;}
.ltb-q-res.win{color:#0b0b10;background:var(--ltb-up);}
.ltb-q-res.loss{color:#fff;background:var(--ltb-down);}
.ltb-q-res.pending{color:var(--ltb-amber);}
.ltb-q-chart{position:relative;flex:1;min-height:64px;padding:6px;overflow:hidden;border:1px solid #1e1e27;
  border-radius:9px;background-color:#08080c;
  background-image:linear-gradient(rgba(255,45,70,.06) 1px,transparent 1px);background-size:100% 25%;}
.ltb-q-chart .ltb-chart-svg{height:100%;}
.ltb-q-open{position:absolute;left:7px;bottom:5px;padding:1px 4px;border-radius:4px;color:var(--ltb-faint);
  background:rgba(8,8,12,.82);font-size:8.5px;font-variant-numeric:tabular-nums;}
.ltb-q-dev{position:absolute;right:7px;bottom:5px;padding:1px 4px;border-radius:4px;
  background:rgba(8,8,12,.82);font-size:8.5px;font-weight:700;font-variant-numeric:tabular-nums;}
.ltb-q-dev.up{color:var(--ltb-target-up);}.ltb-q-dev.down{color:var(--ltb-down);}
/* Grafico "baseline" de LOS 4: arriba verde, abajo rojo, la apertura en medio. */
.ltb-baseline-svg{display:block;width:100%;height:100%;overflow:visible;}
.ltb-baseline-ref{stroke:#ffffff;stroke-width:1;stroke-dasharray:2.4 2.4;opacity:.45;
  vector-effect:non-scaling-stroke;}
.ltb-baseline-fill{stroke:none;}
.ltb-baseline-fill.up{fill:var(--ltb-target-up);opacity:.22;}
.ltb-baseline-fill.down{fill:var(--ltb-down);opacity:.22;}
.ltb-baseline-line{fill:none;stroke-width:1.7;stroke-linejoin:round;stroke-linecap:round;
  vector-effect:non-scaling-stroke;}
.ltb-baseline-line.up{stroke:var(--ltb-target-up);filter:drop-shadow(0 0 3px rgba(57,255,20,.55));}
.ltb-baseline-line.down{stroke:var(--ltb-down);filter:drop-shadow(0 0 3px rgba(255,45,70,.55));}
.ltb-baseline-dot{position:absolute;width:7px;height:7px;margin:-3.5px 0 0 -3.5px;border-radius:50%;
  border:1.5px solid #0b0b10;transition:left .5s linear,top .35s cubic-bezier(.22,1,.36,1);}
.ltb-baseline-dot.up{background:var(--ltb-target-up);box-shadow:0 0 8px rgba(57,255,20,.85);}
.ltb-baseline-dot.down{background:var(--ltb-down);box-shadow:0 0 8px rgba(255,45,70,.85);}
/* ===== Grafico ampliado =====
   Se dibuja en pixeles reales, asi que los textos no se deforman y caben ejes de
   precio y de tiempo. Es lo que separa un grafico de un adorno. */
.ltb-zoom{position:absolute;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;
  padding:26px;background:rgba(4,4,8,.72);backdrop-filter:blur(6px);}
.ltb-zoom[hidden]{display:none;}
.ltb-zoom-card{display:flex;flex-direction:column;width:min(1180px,100%);height:min(680px,100%);
  border:1px solid var(--ltb-edge);border-radius:16px;overflow:hidden;
  background:linear-gradient(180deg,var(--ltb-panel-raised),var(--ltb-panel));
  box-shadow:0 30px 70px rgba(0,0,0,.6);}
.ltb-zoom-head{display:flex;align-items:center;gap:14px;padding:14px 16px;
  border-bottom:1px solid var(--ltb-edge);}
.ltb-zoom-glyph{display:grid;place-items:center;width:34px;height:34px;flex:none;border-radius:10px;
  color:var(--ltb-ink);background:#1b1b23;font-size:17px;font-weight:700;}
.ltb-zoom-id{display:flex;flex-direction:column;min-width:0;}
.ltb-zoom-id strong{color:var(--ltb-ink);font-size:16px;letter-spacing:.02em;}
.ltb-zoom-id small{color:var(--ltb-faint);font-size:10.5px;}
.ltb-zoom-price{margin-left:auto;text-align:right;}
.ltb-zoom-price strong{display:block;color:var(--ltb-ink);font-size:22px;font-variant-numeric:tabular-nums;}
.ltb-zoom-move{font-size:11px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--ltb-faint);}
.ltb-zoom-move.up{color:var(--ltb-target-up);}.ltb-zoom-move.down{color:var(--ltb-down);}
.ltb-zoom-clock{text-align:right;padding-left:14px;border-left:1px solid var(--ltb-edge);}
.ltb-zoom-clock span{display:block;color:var(--ltb-faint);font-size:8.5px;letter-spacing:.16em;}
.ltb-zoom-clock strong{color:var(--ltb-ink);font-size:17px;font-variant-numeric:tabular-nums;}
.ltb-zoom-close{width:30px;height:30px;flex:none;border:1px solid var(--ltb-edge);border-radius:9px;
  background:var(--ltb-deep);color:var(--ltb-dim);font-size:12px;cursor:pointer;}
.ltb-zoom-close:hover{color:var(--ltb-ink);border-color:var(--ltb-down);}
.ltb-zoom-chart{flex:1;min-height:0;position:relative;background:var(--ltb-deep);}
.ltb-zoom-svg{display:block;width:100%;height:100%;}
.ltb-zoom-foot{display:flex;align-items:center;gap:16px;padding:9px 16px;
  border-top:1px solid var(--ltb-edge);color:var(--ltb-faint);font-size:10.5px;
  font-variant-numeric:tabular-nums;}
.ltb-zoom-foot span:last-child{margin-left:auto;color:var(--ltb-dim);overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap;}
/* Piezas del dibujo */
.ltb-zg{stroke:currentColor;color:var(--ltb-edge);stroke-width:1;opacity:.34;}
.ltb-zlabel,.ltb-ztime{fill:var(--ltb-faint);font-size:10px;font-family:inherit;
  font-variant-numeric:tabular-nums;}
.ltb-ztime{text-anchor:middle;}
.ltb-zopen{stroke:#ffffff;stroke-width:1;stroke-dasharray:4 4;opacity:.5;}
.ltb-zopenl{fill:var(--ltb-dim);font-size:9.5px;font-family:inherit;letter-spacing:.08em;}
.ltb-zfill{stroke:none;}
.ltb-zfill.up{fill:var(--ltb-target-up);opacity:.16;}
.ltb-zfill.down{fill:var(--ltb-down);opacity:.16;}
.ltb-zline{fill:none;stroke-width:1.8;stroke-linejoin:round;stroke-linecap:round;}
.ltb-zline.up{stroke:var(--ltb-target-up);}
.ltb-zline.down{stroke:var(--ltb-down);}
.ltb-zx{fill:none;stroke-width:1.4;}
.ltb-zx.alto{stroke:var(--ltb-target-up);}.ltb-zx.bajo{stroke:var(--ltb-down);}
.ltb-zxl{font-size:9.5px;font-family:inherit;font-variant-numeric:tabular-nums;opacity:.85;}
.ltb-zxl.alto{fill:var(--ltb-target-up);}.ltb-zxl.bajo{fill:var(--ltb-down);}
.ltb-zdot.up{fill:var(--ltb-target-up);}
.ltb-zdot.down{fill:var(--ltb-down);}
.ltb-ztag.up{fill:var(--ltb-target-up);}
.ltb-ztag.down{fill:var(--ltb-down);}
.ltb-ztagl{fill:#07070a;font-size:10.5px;font-weight:700;font-family:inherit;
  font-variant-numeric:tabular-nums;}
.ltb-root.light .ltb-zoom-glyph{color:#ffffff;background:#3a4150;}
.ltb-root.light .ltb-zopen{stroke:#2b3240;opacity:.55;}
.ltb-root.light .ltb-ztagl{fill:#ffffff;}

/* ===== Ajustes y apariencia ===== */
.ltb-gear{flex:none;width:34px;height:34px;border:1px solid var(--ltb-edge);border-radius:10px;
  background:rgba(8,8,12,.72);color:var(--ltb-dim);font-size:16px;line-height:1;cursor:pointer;
  transition:color .18s ease,border-color .18s ease,transform .18s ease;}
.ltb-gear:hover{color:var(--ltb-ink);border-color:var(--ltb-up);transform:rotate(35deg);}
.ltb-settings{position:absolute;top:74px;right:16px;z-index:60;width:270px;padding:14px;
  border:1px solid var(--ltb-edge);border-radius:14px;background:var(--ltb-panel-raised);
  box-shadow:0 18px 44px rgba(0,0,0,.5);}
.ltb-settings[hidden]{display:none;}
.ltb-settings-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
.ltb-settings-head strong{color:var(--ltb-ink);font-size:13px;letter-spacing:.04em;}
.ltb-settings-close{width:24px;height:24px;border:none;border-radius:7px;background:transparent;
  color:var(--ltb-faint);font-size:12px;cursor:pointer;}
.ltb-settings-close:hover{color:var(--ltb-ink);background:rgba(255,255,255,.06);}
.ltb-settings-block h3{margin:0 0 3px;color:var(--ltb-ink);font-size:11px;letter-spacing:.14em;
  text-transform:uppercase;}
.ltb-settings-block p{margin:0 0 10px;color:var(--ltb-faint);font-size:11px;line-height:1.4;}
.ltb-theme-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.ltb-theme-btn{display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 6px;
  border:1px solid var(--ltb-edge);border-radius:11px;background:var(--ltb-deep);
  color:var(--ltb-dim);font-size:11px;cursor:pointer;transition:border-color .18s ease,color .18s ease;}
.ltb-theme-btn:hover{color:var(--ltb-ink);}
.ltb-theme-btn.active{border-color:var(--ltb-up);color:var(--ltb-ink);}
.ltb-theme-chip{width:34px;height:22px;border-radius:6px;border:1px solid var(--ltb-edge);}
.ltb-theme-chip.dark{background:linear-gradient(135deg,#0b0b10,#22222c);}
.ltb-theme-chip.light{background:linear-gradient(135deg,#f4f5f8,#dfe2ea);}

/* ===== Modo claro =====
   Empieza por las variables de color, pero no basta: hay componentes con el
   fondo oscuro escrito a mano (los iconos cuadrados, las pestañas, las chapas
   del grafico). Sobre blanco esos salian como cuadros negros y la interfaz se
   veia, pero no se entendia. Aqui se traducen uno por uno.

   Los colores de direccion conservan su tono (ambar = UP, rojo = DOWN, verde =
   cierre sobre la apertura) pero oscurecidos, porque el amarillo neon del modo
   oscuro sobre blanco es ilegible. */
.ltb-root.light{
  --ltb-void:#eceff4;--ltb-panel:#ffffff;--ltb-panel-raised:#ffffff;--ltb-deep:#f3f5f9;
  --ltb-edge:#d3d7e0;--ltb-edge-hot:#f0c2cc;--ltb-ink:#12141a;--ltb-dim:#4d5361;
  --ltb-faint:#697082;
  --ltb-up:#8a6400;--ltb-down:#c8102e;--ltb-target-up:#0a7d2f;
  --ltb-amber:#a35b00;--ltb-red-deep:#e8b6be;
  color:var(--ltb-ink);
  background:
    radial-gradient(760px 300px at 50% -14%,rgba(138,100,0,.07),transparent 70%),
    radial-gradient(600px 320px at 12% 4%,rgba(200,16,46,.05),transparent 68%),
    linear-gradient(180deg,#f8f9fc 0%,var(--ltb-void) 100%);}
/* La rejilla de fondo era para pantalla negra: sobre blanco solo ensucia. */
.ltb-root.light::before{display:none;}

/* Cabecera y barra superior */
.ltb-root.light .ltb-top{background:rgba(255,255,255,.96);border-bottom-color:rgba(200,16,46,.16);}
.ltb-root.light .ltb-logo{color:#ffffff;
  background:linear-gradient(150deg,#e8a800,#e07b00 55%,var(--ltb-down));
  box-shadow:0 3px 10px rgba(200,16,46,.22);}
.ltb-root.light .ltb-gear,
.ltb-root.light .ltb-candleclock{background:#ffffff;}
.ltb-root.light .ltb-candleclock-track{background:#e2e5ec;}

/* Pestañas de activo: eran un degradado casi negro */
.ltb-root.light .ltb-tab{background:linear-gradient(180deg,#ffffff,#f5f6fa);}
.ltb-root.light .ltb-tab:hover{background:#ffffff;}
.ltb-root.light .ltb-tab.active{background:#ffffff;}
.ltb-root.light .ltb-tab-glyph,
.ltb-root.light .ltb-q-glyph{color:#ffffff;background:#3a4150;}
.ltb-root.light .ltb-tab.active .ltb-tab-glyph,
.ltb-root.light .ltb-q.up .ltb-q-glyph{color:#ffffff;background:var(--ltb-up);}
.ltb-root.light .ltb-q.down .ltb-q-glyph{color:#ffffff;background:var(--ltb-down);}

/* Tarjetas */
.ltb-root.light .ltb-q,
.ltb-root.light .ltb-card{background:linear-gradient(180deg,#ffffff,#fbfcfe);
  box-shadow:0 6px 18px rgba(18,20,26,.07);}
.ltb-root.light .ltb-q-signal{border-color:#e0e3ea;background:#f7f8fb;}
.ltb-root.light .ltb-q-chart{background-color:#fbfcfe;border-color:#e2e5ec;
  background-image:linear-gradient(rgba(200,16,46,.045) 1px,transparent 1px);}
.ltb-root.light .ltb-baseline-ref{stroke:#2b3240;opacity:.55;}
/* Las chapas del grafico eran negras translucidas */
.ltb-root.light .ltb-q-open,
.ltb-root.light .ltb-q-dev{color:var(--ltb-dim);background:rgba(255,255,255,.9);
  border:1px solid #e2e5ec;}
.ltb-root.light .ltb-q-dev.up{color:var(--ltb-target-up);}
.ltb-root.light .ltb-q-dev.down{color:var(--ltb-down);}
/* La chapa del motor: amarillo neon sobre blanco no se leia */
.ltb-root.light .ltb-q-tech{color:#6d5000;border-color:rgba(138,100,0,.4);
  background:rgba(138,100,0,.10);}
.ltb-root.light .ltb-q-foot{border-top-color:#e6e9ef;}

/* Panel de ajustes */
.ltb-root.light .ltb-settings{box-shadow:0 16px 40px rgba(18,20,26,.14);}
.ltb-root.light .ltb-settings-close:hover{background:rgba(18,20,26,.07);}
.ltb-root.light .ltb-theme-btn{background:#f7f8fb;}
.ltb-root.light .ltb-theme-btn.active{background:#ffffff;border-color:var(--ltb-up);}

/* Reloj de la vela de 15 min. Solo en la vista de los 4: en la de un activo ya
   esta el medidor del target con su propio contador. */
.ltb-candleclock{display:none;flex-direction:column;gap:3px;min-width:104px;padding:6px 10px 7px;
  border:1px solid var(--ltb-edge);border-radius:10px;background:rgba(8,8,12,.72);}
.ltb-root.all-mode .ltb-candleclock{display:flex;}
.ltb-candleclock-tag{color:var(--ltb-faint);font-size:9px;letter-spacing:.16em;}
.ltb-candleclock strong{color:var(--ltb-ink);font-size:19px;line-height:1;
  font-variant-numeric:tabular-nums;letter-spacing:.02em;}
.ltb-candleclock-track{display:block;height:3px;border-radius:999px;background:#1d1d26;overflow:hidden;}
.ltb-candleclock-track b{display:block;height:100%;width:0;border-radius:inherit;
  background:linear-gradient(90deg,rgba(232,255,38,.55),var(--ltb-up));}
.ltb-candleclock.closing strong{color:var(--ltb-down);}
.ltb-candleclock.closing .ltb-candleclock-track b{background:linear-gradient(90deg,rgba(255,45,70,.55),var(--ltb-down));}
/* Misma caja que el trazo: sin esto la pelota se despegaba de la punta de la
   linea por los 6 px de relleno del recuadro. */
.ltb-baseline-layer{position:absolute;inset:6px;}
/* Lo que sale por la izquierda se difumina en vez de cortarse en seco. */
.ltb-baseline-svg{-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 11%,#000 100%);
  mask-image:linear-gradient(90deg,transparent 0,#000 11%,#000 100%);}
/* Sin transicion: la linea se redibuja al instante y cualquier animacion en la
   pelota la deja atras de su propia punta. */
.ltb-baseline-dot{transition:none;}
/* Historial lateral de cada cuadrante: una vela liquidada, un punto. */
.ltb-q-dots{display:flex;align-items:center;gap:5px;overflow-x:auto;
  scrollbar-width:none;min-height:14px;margin-top:-2px;}
.ltb-q-dots::-webkit-scrollbar{display:none;}
.ltb-q-dots i{flex:0 0 auto;width:8px;height:8px;border-radius:50%;}
.ltb-q-dots i.win{background:var(--ltb-target-up);box-shadow:0 0 4px rgba(57,255,20,.45);}
.ltb-q-dots i.loss{background:var(--ltb-down);box-shadow:0 0 4px rgba(255,45,70,.45);}
/* La vela que acaba de cerrar: mas grande y fosforescente, para que se
   distinga sin leer nada de cual fue la anterior. */
.ltb-q-dots i.last{width:12px;height:12px;}
.ltb-q-dots i.last.win{animation:ltb-dot-glow-up 1.7s ease-in-out infinite;}
.ltb-q-dots i.last.loss{animation:ltb-dot-glow-down 1.7s ease-in-out infinite;}
@keyframes ltb-dot-glow-up{
  0%,100%{box-shadow:0 0 5px rgba(57,255,20,.6);}
  50%{box-shadow:0 0 16px rgba(57,255,20,1),0 0 26px rgba(57,255,20,.6);}}
@keyframes ltb-dot-glow-down{
  0%,100%{box-shadow:0 0 5px rgba(255,45,70,.6);}
  50%{box-shadow:0 0 16px rgba(255,45,70,1),0 0 26px rgba(255,45,70,.6);}}
.ltb-q-dots-empty{color:var(--ltb-faint);font-size:10.5px;letter-spacing:.04em;}
@media (prefers-reduced-motion:reduce){
  .ltb-q-dots i.last.win,.ltb-q-dots i.last.loss{animation:none;
    box-shadow:0 0 14px currentColor;}
  .ltb-baseline-dot{transition:none;}}
.ltb-q-tactic{display:flex;flex-wrap:wrap;align-items:center;gap:6px;}
.ltb-q-tech{padding:3px 7px;border:1px solid rgba(232,255,38,.35);border-radius:6px;color:var(--ltb-up);
  background:rgba(232,255,38,.08);font-size:9px;font-weight:800;letter-spacing:.06em;}
.ltb-q-tech.idle{color:var(--ltb-dim);border-color:var(--ltb-edge);background:var(--ltb-deep);}
.ltb-q-stage{padding:3px 7px;border:1px solid var(--ltb-edge);border-radius:6px;color:var(--ltb-dim);
  background:var(--ltb-deep);font-size:9px;font-weight:700;}
.ltb-q-stage.live{color:#0b0b10;border-color:var(--ltb-up);background:var(--ltb-up);}
.ltb-q-stage.ready{color:var(--ltb-up);border-color:rgba(232,255,38,.4);}
.ltb-q-tactic p{width:100%;margin:0;overflow:hidden;color:#a9a9b8;font-size:10.5px;line-height:1.4;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
.ltb-q-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:7px;
  border-top:1px solid #1c1c25;color:var(--ltb-faint);font-size:10px;font-variant-numeric:tabular-nums;}
.ltb-q-foot .js-risk.mid{color:var(--ltb-amber);}.ltb-q-foot .js-risk.hot{color:var(--ltb-down);}

.ltb-empty{padding:9px 0;color:var(--ltb-faint);font-size:11px;}
.ltb-error{flex:none;padding:9px 12px;border:1px solid rgba(255,163,26,.35);border-radius:9px;
  color:#ffd9a1;background:rgba(255,163,26,.07);font-size:11px;}.ltb-error[hidden]{display:none;}
.ltb-celebrate{position:absolute;inset:0;z-index:40;display:grid;place-items:center;opacity:0;pointer-events:none;
  transition:opacity .35s ease;}
.ltb-celebrate.show{opacity:1;}.ltb-celebrate[hidden]{display:none;}
.ltb-celebrate-burst{display:grid;justify-items:center;gap:6px;padding:26px 42px;border:1px solid rgba(232,255,38,.45);
  border-radius:16px;background:#0d0d12;box-shadow:0 24px 80px rgba(0,0,0,.66),0 0 60px rgba(232,255,38,.12);
  animation:ltbBurst .55s cubic-bezier(.22,1.2,.36,1);}
.ltb-celebrate-burst em{color:var(--ltb-dim);font-size:12px;font-style:normal;font-weight:800;letter-spacing:.2em;}
.ltb-celebrate-burst strong{color:var(--ltb-up);font-size:35px;font-weight:800;letter-spacing:-.03em;
  text-shadow:0 0 28px rgba(232,255,38,.5);}
.ltb-celebrate-burst span{color:#c0c0cc;font-size:12px;}
.ltb-celebrate-burst b{color:var(--ltb-amber);font-size:22px;font-weight:800;font-variant-numeric:tabular-nums;}
@keyframes ltbBurst{0%{transform:scale(.84);opacity:0}100%{transform:scale(1);opacity:1}}
.ltb-confetti{position:absolute;inset:0;overflow:hidden;}
.ltb-confetti i{position:absolute;top:-6%;border-radius:2px;opacity:.9;
  animation-name:ltbFallDown;animation-timing-function:linear;animation-iteration-count:1;animation-fill-mode:forwards;}
@keyframes ltbFallDown{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(105vh) rotate(760deg);opacity:0}}

@media (max-width:1400px){
  #ltbSignalCard{grid-column:1 / 7;}#ltbTacticCard{grid-column:7 / 13;}
  .ltb-chart-card{grid-column:1 / 7;}
  #ltbLiveCard{grid-column:1 / 6;}.ltb-phases-card{grid-column:6 / 10;}.ltb-score-card{grid-column:10 / 13;}
  .ltb-history-card{grid-column:1 / 7;}#ltbSimCard{grid-column:7 / 13;}}
@media (max-width:1120px){
  .ltb-top{min-height:0;flex-wrap:wrap;padding:10px 0;}
  .ltb-target-meter{position:relative;top:auto;left:auto;order:3;flex:0 0 100%;width:100%;height:46px;
    margin-top:3px;transform:none;}
  .ltb-target-track{max-width:460px;margin:0 auto;}
  .ltb-rail{grid-template-columns:repeat(3,minmax(0,1fr));}
  #ltbSignalCard{grid-column:1 / 13;grid-row:1;}#ltbTacticCard{grid-column:1 / 13;grid-row:2;}
  .ltb-chart-card{grid-column:1 / 13;grid-row:3;}#ltbLiveCard{grid-column:1 / 7;grid-row:4;}
  .ltb-phases-card{grid-column:7 / 13;grid-row:4;}.ltb-score-card{grid-column:1 / 7;grid-row:5;}
  #ltbSimCard{grid-column:7 / 13;grid-row:5;}.ltb-history-card{grid-column:1 / 13;grid-row:6;}
  .ltb-quad{grid-template-columns:1fr;grid-template-rows:repeat(4,minmax(230px,1fr));overflow-y:auto;}
  .ltb-root.all-mode{overflow-y:auto;}}
@media (max-width:760px){
  .ltb-root{gap:10px;padding:0 10px 14px;}
  .ltb-top{min-height:0;flex-wrap:wrap;padding:12px 0;}.ltb-brand{width:100%;}
  .ltb-top-live{width:100%;justify-content:space-between;}.ltb-price{text-align:left;}
  .ltb-target-meter{position:relative;top:auto;left:auto;order:3;width:100%;height:46px;margin-top:3px;
    padding:0 4px;transform:none;}
  .ltb-rail{grid-template-columns:repeat(2,minmax(0,1fr));}
  .ltb-grid{display:flex;flex-direction:column;}
  .ltb-grid>*{grid-column:auto;grid-row:auto;}
  .ltb-signal-main{align-items:stretch;flex-direction:column;gap:12px;}
  .ltb-conf{width:100%;min-width:0;text-align:left;}
  .ltb-signal-stats{grid-template-columns:1fr 1fr;}
  .ltb-clock{align-items:flex-start;flex-direction:column;}
  .ltb-sim-top{grid-template-columns:1fr;}.ltb-sim-inputs{grid-template-columns:1fr;}}
@media (prefers-reduced-motion:reduce){
  .ltb-root *{scroll-behavior:auto!important;animation:none!important;}
  .ltb-celebrate-burst{animation-duration:.01s!important;}}
`;
      if (!previo) document.head.appendChild(style);
    },
  };
})();
