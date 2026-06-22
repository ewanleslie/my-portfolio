// Source for the Options Workbench artifact.
// Build with:  npm install && npm run build
// Produces ../bundle.js (React bundled in, minified). Do not edit bundle.js by hand.

import React, { useState, useMemo, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";

/* ============================================================
   OPTIONS WORKBENCH
   A three-pillar tool for an incoming investments analyst:
     1. EXPLORE  — payoff + Greeks visualizers, live sliders
     2. DRILL    — quizzes: definitions/terms (MC + typed) and
                   math drills (typed, precise entry), L1→L3
     3. BUILD    — single & multi-leg strategy builder w/ optional
                   Black-Scholes pricing
   Single file. State only (no storage). Monospace numerics.
   ============================================================ */

/* ---------- design tokens ---------- */
const T = {
  ground: "#ffffff",   // page / input / control background
  panel: "#f7f9fc",    // panel surface
  panelHi: "#eef2f7",  // raised surface / inactive control
  line: "#e2e8f0",     // hairline border
  lineHi: "#cbd5e1",   // stronger border
  ink: "#0a1628",      // navy — primary text
  inkDim: "#5b6673",   // secondary text
  inkFaint: "#94a3b8", // tertiary / labels
  pos: "#16a34a",      // green — profit / correct / live up
  posDim: "#dcfce7",   // light green tint (backgrounds)
  neg: "#dc2626",      // red — loss / wrong
  negDim: "#fee2e2",   // light red tint (backgrounds)
  accent: "#0a1628",   // navy — primary active accent
  accentDim: "#e8edf5",// light navy tint (active backgrounds)
  live: "#16a34a",     // green — sliders & live numeric pop
  call: "#2f6fb0",     // blue — call legs
  put: "#9333ea",      // purple — put legs
  mono: "'SF Mono','JetBrains Mono','Fira Code',ui-monospace,Menlo,monospace",
  sans: "'Inter',system-ui,-apple-system,sans-serif",
};

/* ---------- math ---------- */
function erf(x) {
  const s = x < 0 ? -1 : 1; x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
const cdf = (x) => 0.5 * (1 + erf(x / Math.SQRT2));
const pdf = (x) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);

function blackScholes({ S, K, T: t, r, sigma, type }) {
  if (t <= 0 || sigma <= 0) {
    const intr = type === "call" ? Math.max(S - K, 0) : Math.max(K - S, 0);
    return { price: intr, delta: type === "call" ? (S > K ? 1 : 0) : (S < K ? -1 : 0), gamma: 0, theta: 0, vega: 0, rho: 0 };
  }
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * t) / (sigma * Math.sqrt(t));
  const d2 = d1 - sigma * Math.sqrt(t);
  const Nd1 = cdf(d1), Nd2 = cdf(d2);
  let price, delta, rho, theta;
  const gamma = pdf(d1) / (S * sigma * Math.sqrt(t));
  const vega = S * pdf(d1) * Math.sqrt(t) / 100;
  if (type === "call") {
    price = S * Nd1 - K * Math.exp(-r * t) * Nd2;
    delta = Nd1;
    rho = K * t * Math.exp(-r * t) * Nd2 / 100;
    theta = (-(S * pdf(d1) * sigma) / (2 * Math.sqrt(t)) - r * K * Math.exp(-r * t) * Nd2) / 365;
  } else {
    price = K * Math.exp(-r * t) * cdf(-d2) - S * cdf(-d1);
    delta = Nd1 - 1;
    rho = -K * t * Math.exp(-r * t) * cdf(-d2) / 100;
    theta = (-(S * pdf(d1) * sigma) / (2 * Math.sqrt(t)) + r * K * Math.exp(-r * t) * cdf(-d2)) / 365;
  }
  return { price, delta, gamma, theta, vega, rho };
}

/* per-leg payoff at terminal spot ST (excludes premium) */
function legIntrinsic(leg, ST) {
  return leg.type === "call" ? Math.max(ST - leg.strike, 0) : Math.max(leg.strike - ST, 0);
}
/* per-leg P&L at expiry, per share, signed by long/short */
function legPnL(leg, ST) {
  const intr = legIntrinsic(leg, ST);
  const sign = leg.dir === "long" ? 1 : -1;
  return sign * (intr - leg.premium) * leg.qty;
}

const fmt = (n, d = 2) =>
  (n === null || n === undefined || isNaN(n)) ? "—" :
  n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtUSD = (n, d = 2) => (n < 0 ? "-$" : "$") + fmt(Math.abs(n), d);

/* ============================================================ */
function OptionsWorkbench() {
  const [tab, setTab] = useState("explore");
  const tabs = [
    ["explore", "Explore", "payoff & greeks"],
    ["drill", "Drill", "quizzes & math"],
    ["build", "Build", "strategy builder"],
  ];

  return (
    <div style={{ background: T.ground, color: T.ink, fontFamily: T.sans, minHeight: "100vh", padding: "0 0 60px" }}>
      <style>{`
        * { box-sizing: border-box; }
        @media (prefers-reduced-motion: reduce){ *{transition:none!important;animation:none!important} }
        input[type=range]{ -webkit-appearance:none; appearance:none; height:3px; background:${T.line}; border-radius:2px; outline:none; }
        input[type=range]::-webkit-slider-thumb{ -webkit-appearance:none; appearance:none; width:16px; height:16px; border-radius:50%; background:${T.live}; cursor:pointer; border:2px solid ${T.ground}; box-shadow:0 0 0 1px ${T.lineHi}; }
        input[type=range]::-moz-range-thumb{ width:16px; height:16px; border-radius:50%; background:${T.live}; cursor:pointer; border:2px solid ${T.ground}; box-shadow:0 0 0 1px ${T.lineHi}; }
        .ow-num{ font-family:${T.mono}; font-variant-numeric:tabular-nums; }
        .ow-btn{ cursor:pointer; transition:all .12s ease; }
        .ow-btn:focus-visible{ outline:2px solid ${T.accent}; outline-offset:2px; }
        input:focus-visible{ outline:2px solid ${T.accent}; outline-offset:1px; }
      `}</style>

      {/* header */}
      <div style={{ borderBottom: `1px solid ${T.line}`, padding: "18px 24px 0", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 16 }}>
          <span className="ow-num" style={{ fontSize: 11, color: T.accent, letterSpacing: 2, border: `1px solid ${T.accentDim}`, padding: "3px 7px", borderRadius: 3 }}>DERIV</span>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: -0.3 }}>Options Workbench</h1>
          <span style={{ fontSize: 12, color: T.inkFaint }}>right vs. obligation · price vs. vol · shape vs. thesis</span>
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          {tabs.map(([id, label, sub]) => (
            <button key={id} className="ow-btn" onClick={() => setTab(id)}
              style={{
                background: "none", border: "none", borderBottom: `2px solid ${tab === id ? T.accent : "transparent"}`,
                padding: "8px 16px 12px", textAlign: "left",
              }}>
              <div style={{ color: tab === id ? T.ink : T.inkDim, fontWeight: 600, fontSize: 14 }}>{label}</div>
              <div className="ow-num" style={{ color: tab === id ? T.accent : T.inkFaint, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>{sub}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px" }}>
        {tab === "explore" && <Explore />}
        {tab === "drill" && <Drill />}
        {tab === "build" && <Build />}
      </div>
    </div>
  );
}

/* ============================================================
   SHARED: payoff chart
   ============================================================ */
function PayoffChart({ legs, spotRef, width = 620, height = 320, showLegs = false }) {
  const pad = { l: 56, r: 16, t: 16, b: 36 };
  const strikes = legs.map(l => l.strike);
  const lo = Math.max(0.01, Math.min(...strikes) * 0.6);
  const hi = Math.max(...strikes) * 1.4;
  const N = 160;
  const xs = Array.from({ length: N + 1 }, (_, i) => lo + (hi - lo) * i / N);

  const combined = xs.map(ST => ({ ST, y: legs.reduce((s, l) => s + legPnL(l, ST), 0) }));
  const allY = combined.map(p => p.y);
  let yMin = Math.min(...allY, 0), yMax = Math.max(...allY, 0);
  const yPad = (yMax - yMin) * 0.12 || 1;
  yMin -= yPad; yMax += yPad;

  const X = (v) => pad.l + (v - lo) / (hi - lo) * (width - pad.l - pad.r);
  const Y = (v) => pad.t + (1 - (v - yMin) / (yMax - yMin)) * (height - pad.t - pad.b);

  const path = combined.map((p, i) => `${i ? "L" : "M"}${X(p.ST).toFixed(1)},${Y(p.y).toFixed(1)}`).join(" ");
  // split into pos/neg fill via clip at y=0
  const zeroY = Y(0);

  const legColors = (l) => l.type === "call" ? T.call : T.put;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {/* grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
        const yv = yMin + (yMax - yMin) * f;
        return (
          <g key={i}>
            <line x1={pad.l} x2={width - pad.r} y1={Y(yv)} y2={Y(yv)} stroke={T.line} strokeWidth={0.5} />
            <text x={pad.l - 8} y={Y(yv) + 3} textAnchor="end" fontFamily={T.mono} fontSize={9} fill={T.inkFaint}>{fmt(yv, 0)}</text>
          </g>
        );
      })}
      {/* zero line */}
      <line x1={pad.l} x2={width - pad.r} y1={zeroY} y2={zeroY} stroke={T.lineHi} strokeWidth={1} />
      {/* strikes */}
      {[...new Set(strikes)].map((k, i) => (
        <g key={i}>
          <line x1={X(k)} x2={X(k)} y1={pad.t} y2={height - pad.b} stroke={T.line} strokeWidth={0.5} strokeDasharray="2 3" />
          <text x={X(k)} y={height - pad.b + 14} textAnchor="middle" fontFamily={T.mono} fontSize={9} fill={T.inkDim}>{fmt(k, 0)}</text>
        </g>
      ))}
      {/* spot marker */}
      {spotRef != null && spotRef >= lo && spotRef <= hi && (
        <g>
          <line x1={X(spotRef)} x2={X(spotRef)} y1={pad.t} y2={height - pad.b} stroke={T.accent} strokeWidth={1} strokeDasharray="3 2" opacity={0.7} />
          <text x={X(spotRef)} y={pad.t - 4} textAnchor="middle" fontFamily={T.mono} fontSize={9} fill={T.accent}>S {fmt(spotRef, 0)}</text>
        </g>
      )}
      {/* per-leg faint lines */}
      {showLegs && legs.length > 1 && legs.map((l, i) => {
        const lp = xs.map(ST => `${X(ST).toFixed(1)},${Y(legPnL(l, ST)).toFixed(1)}`).join(" ");
        return <polyline key={i} points={lp} fill="none" stroke={legColors(l)} strokeWidth={1} opacity={0.4} strokeDasharray="4 3" />;
      })}
      {/* combined payoff, colored by sign via two clipped copies */}
      <defs>
        <clipPath id="posClip"><rect x={pad.l} y={pad.t} width={width - pad.l - pad.r} height={Math.max(0, zeroY - pad.t)} /></clipPath>
        <clipPath id="negClip"><rect x={pad.l} y={zeroY} width={width - pad.l - pad.r} height={Math.max(0, height - pad.b - zeroY)} /></clipPath>
      </defs>
      <path d={path} fill="none" stroke={T.pos} strokeWidth={2.2} clipPath="url(#posClip)" strokeLinejoin="round" />
      <path d={path} fill="none" stroke={T.neg} strokeWidth={2.2} clipPath="url(#negClip)" strokeLinejoin="round" />
      <text x={width - pad.r} y={height - 4} textAnchor="end" fontFamily={T.mono} fontSize={9} fill={T.inkFaint}>terminal spot →</text>
    </svg>
  );
}

/* compute stats for a set of legs */
function strategyStats(legs) {
  if (!legs.length) return null;
  const strikes = legs.map(l => l.strike);
  const lo = 0, hi = Math.max(...strikes) * 3 + 50;
  const N = 4000;
  let maxG = -Infinity, maxL = Infinity, breakevens = [];
  let prev = null, prevST = null;
  const netDebit = legs.reduce((s, l) => s + (l.dir === "long" ? 1 : -1) * l.premium * l.qty, 0);
  for (let i = 0; i <= N; i++) {
    const ST = lo + (hi - lo) * i / N;
    const y = legs.reduce((s, l) => s + legPnL(l, ST), 0);
    if (y > maxG) maxG = y;
    if (y < maxL) maxL = y;
    if (prev !== null && ((prev < 0 && y >= 0) || (prev > 0 && y <= 0))) {
      const frac = Math.abs(prev) / (Math.abs(prev) + Math.abs(y));
      breakevens.push(prevST + (ST - prevST) * frac);
    }
    prev = y; prevST = ST;
  }
  // detect unbounded ends
  const endSlopeUp = legs.reduce((s, l) => s + (l.dir === "long" ? 1 : -1) * (l.type === "call" ? 1 : 0) * l.qty, 0);
  const startSlopeDown = legs.reduce((s, l) => s + (l.dir === "long" ? 1 : -1) * (l.type === "put" ? 1 : 0) * l.qty, 0);
  return {
    maxGain: endSlopeUp > 0 ? Infinity : maxG,
    maxLoss: (endSlopeUp < 0 || startSlopeDown < 0) ? -Infinity : maxL,
    breakevens: [...new Set(breakevens.map(b => Math.round(b * 100) / 100))],
    netDebit,
  };
}

/* ============================================================
   PILLAR 1 — EXPLORE
   ============================================================ */
function Explore() {
  const [mode, setMode] = useState("payoff");
  return (
    <div>
      <Instructions>
        <Lead>Explore</Lead> how a single option behaves. Drag the sliders and the chart updates live.
        Use the sub-tabs for the expiry <Lead>payoff diagram</Lead>, how each <Lead>Greek</Lead> responds to
        spot, volatility and time, and how value <Lead>decays</Lead> as expiry approaches.
      </Instructions>
      <SubTabs value={mode} onChange={setMode} options={[["payoff", "Payoff diagram"], ["greeks", "Greeks vs. input"], ["decay", "Time decay"]]} />
      {mode === "payoff" && <ExplorePayoff />}
      {mode === "greeks" && <ExploreGreeks />}
      {mode === "decay" && <ExploreDecay />}
    </div>
  );
}

function ExplorePayoff() {
  const [type, setType] = useState("call");
  const [dir, setDir] = useState("long");
  const [strike, setStrike] = useState(100);
  const [premium, setPremium] = useState(5);
  const [spot, setSpot] = useState(100);

  const leg = { type, dir, strike, premium, qty: 1 };
  const stats = strategyStats([leg]);
  const intrinsic = legIntrinsic(leg, spot);
  const timeVal = premium - intrinsic;

  return (
    <Grid>
      <Panel title="Single leg" sub="one option, payoff at expiry">
        <Seg label="Right" value={type} onChange={setType} options={[["call", "Call"], ["put", "Put"]]} />
        <Seg label="Position" value={dir} onChange={setDir} options={[["long", "Long (buy)"], ["short", "Short (sell)"]]} />
        <Slider label="Strike K" value={strike} min={40} max={160} step={1} onChange={setStrike} unit="$" />
        <Slider label="Premium" value={premium} min={0} max={30} step={0.25} onChange={setPremium} unit="$" />
        <Slider label="Spot S (marker)" value={spot} min={40} max={160} step={1} onChange={setSpot} unit="$" />
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.line}` }}>
          <StatRow label="Breakeven" value={stats.breakevens.length ? stats.breakevens.map(b => fmtUSD(b)).join(", ") : "—"} />
          <StatRow label="Max gain" value={stats.maxGain === Infinity ? "Unlimited" : fmtUSD(stats.maxGain)} pos />
          <StatRow label="Max loss" value={stats.maxLoss === -Infinity ? "Unlimited" : fmtUSD(stats.maxLoss)} neg />
          <StatRow label="Intrinsic @ S" value={fmtUSD(intrinsic)} />
          <StatRow label="Time value @ S" value={fmtUSD(timeVal)} hint={timeVal < 0 ? "premium below intrinsic" : ""} />
        </div>
      </Panel>
      <Panel title="P&L at expiry" sub="per share · green = profit, red = loss">
        <PayoffChart legs={[leg]} spotRef={spot} />
        <Note>The line is intrinsic value minus premium paid (long) or collected (short). The kink sits at the strike — that's where the option starts paying off.</Note>
      </Panel>
    </Grid>
  );
}

function ExploreGreeks() {
  const [type, setType] = useState("call");
  const [strike, setStrike] = useState(100);
  const [iv, setIv] = useState(0.30);
  const [dte, setDte] = useState(60);
  const [rate, setRate] = useState(0.045);
  const [axis, setAxis] = useState("S");        // vary spot
  const [greek, setGreek] = useState("delta");

  const sweep = useMemo(() => {
    const pts = [];
    const ranges = {
      S: [strike * 0.55, strike * 1.45],
      iv: [0.05, 0.90],
      dte: [1, 365],
    };
    const [a, b] = ranges[axis];
    for (let i = 0; i <= 100; i++) {
      const v = a + (b - a) * i / 100;
      const inp = { S: strike, K: strike, T: dte / 365, r: rate, sigma: iv, type };
      if (axis === "S") inp.S = v;
      if (axis === "iv") inp.sigma = v;
      if (axis === "dte") inp.T = v / 365;
      const g = blackScholes(inp);
      pts.push({ x: v, y: g[greek] });
    }
    return pts;
  }, [type, strike, iv, dte, rate, axis, greek]);

  const cur = blackScholes({ S: strike, K: strike, T: dte / 365, r: rate, sigma: iv, type });
  const axisLabel = { S: "spot S", iv: "implied vol σ", dte: "days to expiry" }[axis];

  return (
    <Grid>
      <Panel title="Inputs" sub="ATM by construction (S=K)">
        <Seg label="Right" value={type} onChange={setType} options={[["call", "Call"], ["put", "Put"]]} />
        <Slider label="Strike K" value={strike} min={50} max={150} step={1} onChange={setStrike} unit="$" />
        <Slider label="Implied vol σ" value={iv} min={0.05} max={0.9} step={0.01} onChange={setIv} unit="" pct />
        <Slider label="Days to expiry" value={dte} min={1} max={365} step={1} onChange={setDte} />
        <Slider label="Risk-free r" value={rate} min={0} max={0.1} step={0.005} onChange={setRate} unit="" pct />
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.line}` }}>
          <StatRow label="Price" value={fmtUSD(cur.price)} />
          <StatRow label="Delta" value={fmt(cur.delta, 3)} />
          <StatRow label="Gamma" value={fmt(cur.gamma, 4)} />
          <StatRow label="Theta /day" value={fmt(cur.theta, 3)} />
          <StatRow label="Vega /1% iv" value={fmt(cur.vega, 3)} />
        </div>
      </Panel>
      <Panel title="Sensitivity curve" sub={`${greek} as ${axisLabel} varies`}>
        <div style={{ display: "flex", gap: 16, marginBottom: 10, flexWrap: "wrap" }}>
          <MiniSeg label="Greek" value={greek} onChange={setGreek} options={[["delta", "Δ"], ["gamma", "Γ"], ["theta", "Θ"], ["vega", "V"]]} />
          <MiniSeg label="Vary" value={axis} onChange={setAxis} options={[["S", "Spot"], ["iv", "IV"], ["dte", "DTE"]]} />
        </div>
        <LineChart pts={sweep} xLabel={axisLabel} yLabel={greek} markerX={axis === "S" ? strike : axis === "iv" ? iv : dte} />
        <Note>{greekHint(greek)}</Note>
      </Panel>
    </Grid>
  );
}
function greekHint(g) {
  return {
    delta: "Delta ≈ probability of finishing in-the-money, and the hedge ratio. Calls run 0→1, puts −1→0. Steepest at the money.",
    gamma: "Gamma is delta's rate of change. It peaks at-the-money and explodes as expiry nears — that's pin risk for short gamma.",
    theta: "Theta is daily time decay. Most negative for ATM options and accelerates into the final weeks. You pay it to be long.",
    vega: "Vega is sensitivity to a 1-point move in implied vol. Largest for ATM, longer-dated options. Buying high IV is structurally costly.",
  }[g];
}

function ExploreDecay() {
  const [playing, setPlaying] = useState(false);
  const [dte, setDte] = useState(90);
  const [type, setType] = useState("call");
  const [moneyness, setMoneyness] = useState("atm");
  const raf = useRef(null);

  const S = 100;
  const K = moneyness === "atm" ? 100 : moneyness === "itm" ? 90 : 110;
  const iv = 0.30, r = 0.045;

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (now) => {
      const dt = (now - last) / 1000; last = now;
      setDte(d => {
        const nd = d - dt * 18;
        if (nd <= 1) { setPlaying(false); return 1; }
        return nd;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);

  const g = blackScholes({ S, K, T: dte / 365, r, sigma: iv, type });
  const intrinsic = type === "call" ? Math.max(S - K, 0) : Math.max(K - S, 0);
  const timeVal = g.price - intrinsic;

  const curve = useMemo(() => {
    const pts = [];
    for (let d = 365; d >= 0.5; d -= 2) {
      const gg = blackScholes({ S, K, T: d / 365, r, sigma: iv, type });
      pts.push({ x: d, y: gg.price });
    }
    return pts;
  }, [K, type]);

  return (
    <Grid>
      <Panel title="Decay controls" sub="watch time value erode toward intrinsic">
        <Seg label="Right" value={type} onChange={setType} options={[["call", "Call"], ["put", "Put"]]} />
        <Seg label="Moneyness" value={moneyness} onChange={setMoneyness} options={[["itm", "ITM"], ["atm", "ATM"], ["otm", "OTM"]]} />
        <Slider label="Days to expiry" value={Math.round(dte)} min={1} max={365} step={1} onChange={(v) => { setPlaying(false); setDte(v); }} />
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button className="ow-btn" onClick={() => { if (dte <= 2) setDte(365); setPlaying(p => !p); }}
            style={{ flex: 1, background: playing ? T.negDim : T.accentDim, color: playing ? T.neg : T.accent, border: `1px solid ${playing ? T.neg : T.accent}`, borderRadius: 4, padding: "9px", fontSize: 13, fontWeight: 600 }}>
            {playing ? "■ Pause" : "▶ Play decay"}
          </button>
          <button className="ow-btn" onClick={() => { setPlaying(false); setDte(365); }}
            style={{ background: T.panelHi, color: T.inkDim, border: `1px solid ${T.line}`, borderRadius: 4, padding: "9px 14px", fontSize: 13 }}>↻</button>
        </div>
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.line}` }}>
          <StatRow label="Option price" value={fmtUSD(g.price)} />
          <StatRow label="Intrinsic" value={fmtUSD(intrinsic)} />
          <StatRow label="Time value" value={fmtUSD(timeVal)} pos />
          <StatRow label="Theta /day" value={fmt(g.theta, 3)} neg />
        </div>
      </Panel>
      <Panel title="Value vs. days to expiry" sub="the gap above intrinsic is time value">
        <LineChart pts={curve} xLabel="days to expiry" yLabel="price" markerX={dte} flipX
          floor={intrinsic} floorLabel="intrinsic" />
        <Note>Notice the curve isn't linear — it bows. Decay is gentle when expiry is far off and steepens sharply in the last weeks. That convex shape is why short-dated options bleed fast.</Note>
      </Panel>
    </Grid>
  );
}

/* ============================================================
   PILLAR 2 — DRILL
   ============================================================ */
function Drill() {
  const [mode, setMode] = useState("terms");
  return (
    <div>
      <Instructions>
        <Lead>Test yourself.</Lead> <Lead>Definitions &amp; terms</Lead> mixes multiple-choice and typed answers —
        type a word and press Enter or Check. <Lead>Math drills</Lead> generate fresh numeric problems across three
        levels (intrinsic &amp; breakeven → parity &amp; spreads → Black-Scholes); enter a precise value to check it.
      </Instructions>
      <SubTabs value={mode} onChange={setMode} options={[["terms", "Definitions & terms"], ["math", "Math drills"]]} />
      {mode === "terms" && <DrillTerms />}
      {mode === "math" && <DrillMath />}
    </div>
  );
}

/* ---- terms bank: mix of MC and typed ---- */
const TERMS = [
  { q: "An option granting the right to BUY the underlying at the strike is a:", a: "call", format: "mc", choices: ["call", "put", "forward", "swap"] },
  { q: "An option granting the right to SELL the underlying at the strike is a:", a: "put", format: "mc", choices: ["call", "put", "future", "collar"] },
  { q: "The price paid to acquire an option is called the:", a: "premium", format: "typed", accept: ["premium"] },
  { q: "Option premium decomposes into intrinsic value plus ___ value.", a: "time", format: "typed", accept: ["time", "time value", "extrinsic"] },
  { q: "The Greek measuring price sensitivity to a $1 move in the underlying:", a: "delta", format: "mc", choices: ["delta", "gamma", "theta", "vega"] },
  { q: "The Greek measuring the rate of change of delta:", a: "gamma", format: "mc", choices: ["vega", "gamma", "rho", "theta"] },
  { q: "The Greek measuring daily time decay:", a: "theta", format: "typed", accept: ["theta"] },
  { q: "The Greek measuring sensitivity to implied volatility:", a: "vega", format: "typed", accept: ["vega"] },
  { q: "The no-arbitrage relationship linking calls, puts, strike and the discounted forward:", a: "put-call parity", format: "mc", choices: ["put-call parity", "Black-Scholes", "CAPM", "interest rate parity"] },
  { q: "Market's forward-looking volatility estimate embedded in an option's price:", a: "implied volatility", format: "typed", accept: ["implied volatility", "implied vol", "iv"] },
  { q: "The tendency of OTM puts to trade at higher IV than equidistant calls in equities:", a: "skew", format: "typed", accept: ["skew", "volatility skew", "vol skew"] },
  { q: "The historical edge from IV exceeding subsequent realized vol is the volatility ___ premium.", a: "risk", format: "typed", accept: ["risk", "vol risk premium", "variance risk premium"] },
  { q: "A long call + long put at the same strike and expiry is a:", a: "straddle", format: "mc", choices: ["strangle", "straddle", "collar", "butterfly"] },
  { q: "Buying a lower-strike call and selling a higher-strike call (same expiry) is a:", a: "bull call spread", format: "mc", choices: ["bull call spread", "bear put spread", "iron condor", "calendar"] },
  { q: "Holding stock, buying a protective put, and selling a call to fund it is a:", a: "collar", format: "mc", choices: ["straddle", "collar", "strangle", "condor"] },
  { q: "A delta of 0.50 implies roughly a ___ % chance of finishing in-the-money.", a: "50", format: "typed", accept: ["50", "50%", "fifty"] },
  { q: "The party with the OBLIGATION to perform if the option is exercised is the:", a: "seller", format: "mc", choices: ["buyer", "seller", "exchange", "clearinghouse"] },
  { q: "An option that can only be exercised at expiry (not before) is ___-style.", a: "european", format: "typed", accept: ["european", "euro"] },
];

function DrillTerms() {
  const [order, setOrder] = useState(() => shuffle([...Array(TERMS.length).keys()]));
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null); // 'right'|'wrong'|null
  const [score, setScore] = useState({ right: 0, total: 0 });

  const q = TERMS[order[idx]];

  const submit = (val) => {
    if (result) return;
    const ok = q.format === "mc"
      ? val === q.a
      : q.accept.some(a => norm(val) === norm(a));
    setResult(ok ? "right" : "wrong");
    setScore(s => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1 }));
  };
  const next = () => {
    if (idx + 1 >= order.length) { setOrder(shuffle([...Array(TERMS.length).keys()])); setIdx(0); }
    else setIdx(i => i + 1);
    setInput(""); setResult(null);
  };

  return (
    <Panel title="Definitions & terms" sub={`question ${idx + 1} of ${order.length}`} wide
      right={<ScorePill score={score} />}>
      <div style={{ fontSize: 17, lineHeight: 1.5, margin: "8px 0 20px", minHeight: 52 }}>{q.q}</div>

      {q.format === "mc" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {q.choices.map(c => {
            const chosen = result && c === q.a;
            const wrongPick = result === "wrong" && c === input;
            return (
              <button key={c} className="ow-btn" disabled={!!result}
                onClick={() => { setInput(c); submit(c); }}
                style={{
                  textAlign: "left", padding: "12px 14px", borderRadius: 5, fontSize: 14,
                  background: chosen ? T.posDim : wrongPick ? T.negDim : T.panelHi,
                  border: `1px solid ${chosen ? T.pos : wrongPick ? T.neg : T.line}`,
                  color: T.ink,
                }}>{c}</button>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10 }}>
          <input value={input} disabled={!!result}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit(input)}
            placeholder="type your answer…"
            style={inputStyle} />
          <button className="ow-btn" disabled={!!result || !input.trim()} onClick={() => submit(input)}
            style={primaryBtn}>Check</button>
        </div>
      )}

      {result && (
        <Feedback ok={result === "right"} answer={q.a} onNext={next} />
      )}
    </Panel>
  );
}

/* ---- math drills: randomized, typed, three levels ---- */
function DrillMath() {
  const [level, setLevel] = useState(1);
  const [q, setQ] = useState(() => genMath(1));
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);
  const [score, setScore] = useState({ right: 0, total: 0 });

  const regen = (lv) => { setQ(genMath(lv)); setInput(""); setResult(null); };
  useEffect(() => { regen(level); /* eslint-disable-next-line */ }, [level]);

  const submit = () => {
    if (result) return;
    const val = parseFloat(input.replace(/[$,%\s]/g, ""));
    const ok = !isNaN(val) && Math.abs(val - q.answer) <= q.tol;
    setResult(ok ? "right" : "wrong");
    setScore(s => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1 }));
  };

  return (
    <Panel title="Math drills" sub="precise numeric entry · randomized each attempt" wide
      right={<ScorePill score={score} />}>
      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {[1, 2, 3].map(lv => (
          <button key={lv} className="ow-btn" onClick={() => setLevel(lv)}
            style={{
              flex: 1, padding: "10px", borderRadius: 5, fontSize: 13, fontWeight: 600,
              background: level === lv ? T.accentDim : T.panelHi,
              border: `1px solid ${level === lv ? T.accent : T.line}`,
              color: level === lv ? T.accent : T.inkDim,
            }}>
            <div>Level {lv}</div>
            <div style={{ fontSize: 10, fontWeight: 400, color: T.inkFaint, marginTop: 2 }}>{["intrinsic & breakeven", "parity & spreads", "Black-Scholes"][lv - 1]}</div>
          </button>
        ))}
      </div>

      <div style={{ background: T.panelHi, border: `1px solid ${T.line}`, borderRadius: 6, padding: "18px 16px", marginBottom: 16 }}>
        <div style={{ fontSize: 15, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: q.prompt }} />
        {q.givens && (
          <div className="ow-num" style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", marginTop: 14, fontSize: 13, color: T.inkDim }}>
            {q.givens.map((g, i) => <span key={i}>{g[0]} <span style={{ color: T.ink }}>{g[1]}</span></span>)}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input value={input} disabled={!!result}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder={q.placeholder || "enter value…"}
          style={inputStyle} />
        <button className="ow-btn" disabled={!!result || !input.trim()} onClick={submit} style={primaryBtn}>Check</button>
      </div>

      {result && (
        <div>
          <div style={{
            marginTop: 16, padding: "12px 14px", borderRadius: 5,
            background: result === "right" ? T.posDim : T.negDim,
            border: `1px solid ${result === "right" ? T.pos : T.neg}`,
          }}>
            <div style={{ fontWeight: 600, color: result === "right" ? T.pos : T.neg, marginBottom: 6 }}>
              {result === "right" ? "Correct" : "Not quite"} — answer: <span className="ow-num">{q.display}</span>
            </div>
            <div style={{ fontSize: 13, color: T.inkDim, lineHeight: 1.55 }} dangerouslySetInnerHTML={{ __html: q.explain }} />
          </div>
          <button className="ow-btn" onClick={() => regen(level)} style={{ ...primaryBtn, marginTop: 12, width: "100%" }}>Next question →</button>
        </div>
      )}
    </Panel>
  );
}

function genMath(level) {
  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const rf = (a, b, d = 2) => +(a + Math.random() * (b - a)).toFixed(d);

  if (level === 1) {
    const variants = [
      () => { // intrinsic
        const type = Math.random() < 0.5 ? "call" : "put";
        const K = ri(80, 120), S = K + ri(-20, 20);
        const ans = type === "call" ? Math.max(S - K, 0) : Math.max(K - S, 0);
        return {
          prompt: `What is the <b>intrinsic value</b> of a <b>${type}</b> option?`,
          givens: [["Spot S", `$${S}`], ["Strike K", `$${K}`]],
          answer: ans, tol: 0.01, display: fmtUSD(ans), placeholder: "$",
          explain: `Intrinsic = max(${type === "call" ? "S − K" : "K − S"}, 0) = max(${type === "call" ? `${S} − ${K}` : `${K} − ${S}`}, 0) = <b>${fmtUSD(ans)}</b>. ${ans === 0 ? "Out-of-the-money, so intrinsic is zero." : "In-the-money."}`,
        };
      },
      () => { // long breakeven
        const type = Math.random() < 0.5 ? "call" : "put";
        const K = ri(80, 120), prem = rf(2, 12);
        const be = type === "call" ? K + prem : K - prem;
        return {
          prompt: `What is the <b>breakeven</b> spot price at expiry for a <b>long ${type}</b>?`,
          givens: [["Strike K", `$${K}`], ["Premium", `$${prem}`]],
          answer: be, tol: 0.01, display: fmtUSD(be), placeholder: "$",
          explain: `A long ${type} breaks even when intrinsic value equals the premium paid. Breakeven = K ${type === "call" ? "+" : "−"} premium = ${K} ${type === "call" ? "+" : "−"} ${prem} = <b>${fmtUSD(be)}</b>.`,
        };
      },
      () => { // time value
        const intr = ri(0, 15), tv = rf(1, 8), prem = +(intr + tv).toFixed(2);
        return {
          prompt: `An option trades at a premium of <b>$${prem}</b> with intrinsic value of <b>$${intr}</b>. What is its <b>time value</b>?`,
          answer: tv, tol: 0.01, display: fmtUSD(tv), placeholder: "$",
          explain: `Time value = premium − intrinsic = ${prem} − ${intr} = <b>${fmtUSD(tv)}</b>.`,
        };
      },
    ];
    return variants[ri(0, variants.length - 1)]();
  }

  if (level === 2) {
    const variants = [
      () => { // put-call parity solve for call
        const S = ri(80, 120), K = ri(80, 120), P = rf(3, 12), r = rf(0.02, 0.06, 3), t = rf(0.25, 1, 2);
        const pv = K * Math.exp(-r * t);
        const C = P + S - pv;
        return {
          prompt: `Using <b>put-call parity</b> (C − P = S − K·e<sup>−rt</sup>), solve for the <b>call price</b>.`,
          givens: [["Put P", `$${P}`], ["Spot S", `$${S}`], ["Strike K", `$${K}`], ["r", `${(r * 100).toFixed(1)}%`], ["t", `${t} yr`]],
          answer: +C.toFixed(2), tol: 0.05, display: fmtUSD(C), placeholder: "$",
          explain: `C = P + S − K·e<sup>−rt</sup> = ${P} + ${S} − ${K}·e<sup>−${r}·${t}</sup> = ${P} + ${S} − ${pv.toFixed(2)} = <b>${fmtUSD(C)}</b>.`,
        };
      },
      () => { // vertical spread max gain
        const Klo = ri(90, 100), w = ri(5, 15), Khi = Klo + w;
        const cLo = rf(5, 12), cHi = rf(1, cLo - 1);
        const netDebit = +(cLo - cHi).toFixed(2);
        const maxGain = +(w - netDebit).toFixed(2);
        return {
          prompt: `A <b>bull call spread</b>: long the $${Klo} call, short the $${Khi} call. What is the <b>maximum gain</b> per share?`,
          givens: [["Long call", `$${cLo}`], ["Short call", `$${cHi}`], ["Width", `$${w}`]],
          answer: maxGain, tol: 0.02, display: fmtUSD(maxGain), placeholder: "$",
          explain: `Net debit = ${cLo} − ${cHi} = ${netDebit}. Max gain = strike width − net debit = ${w} − ${netDebit} = <b>${fmtUSD(maxGain)}</b> (achieved when spot ≥ $${Khi}).`,
        };
      },
      () => { // straddle breakeven
        const K = ri(90, 110), cP = rf(3, 8), pP = rf(3, 8), tot = +(cP + pP).toFixed(2);
        const upper = K + tot;
        return {
          prompt: `A <b>long straddle</b> at strike $${K}. What is the <b>upper breakeven</b>?`,
          givens: [["Call premium", `$${cP}`], ["Put premium", `$${pP}`]],
          answer: +upper.toFixed(2), tol: 0.02, display: fmtUSD(upper), placeholder: "$",
          explain: `Total premium paid = ${cP} + ${pP} = ${tot}. Upper breakeven = K + total premium = ${K} + ${tot} = <b>${fmtUSD(upper)}</b>. (Lower would be K − total.)`,
        };
      },
    ];
    return variants[ri(0, variants.length - 1)]();
  }

  // level 3 — Black-Scholes
  const type = Math.random() < 0.5 ? "call" : "put";
  const S = ri(90, 110), K = ri(90, 110), iv = rf(0.18, 0.45, 2), t = rf(0.25, 1, 2), r = rf(0.02, 0.05, 3);
  const g = blackScholes({ S, K, T: t, r, sigma: iv, type });
  const target = Math.random() < 0.6 ? "price" : "delta";
  if (target === "price") {
    return {
      prompt: `Use <b>Black-Scholes</b> to price this European <b>${type}</b>.`,
      givens: [["S", `$${S}`], ["K", `$${K}`], ["σ", `${(iv * 100).toFixed(0)}%`], ["t", `${t} yr`], ["r", `${(r * 100).toFixed(1)}%`]],
      answer: +g.price.toFixed(2), tol: 0.15, display: fmtUSD(g.price), placeholder: "$ (±0.15)",
      explain: `d₁ = [ln(S/K) + (r + σ²/2)t] / (σ√t); d₂ = d₁ − σ√t. ${type === "call" ? "C = S·N(d₁) − K·e<sup>−rt</sup>·N(d₂)" : "P = K·e<sup>−rt</sup>·N(−d₂) − S·N(−d₁)"} = <b>${fmtUSD(g.price)}</b>. Delta here is ${fmt(g.delta, 3)}.`,
    };
  }
  return {
    prompt: `Use <b>Black-Scholes</b> to find the <b>delta</b> of this European <b>${type}</b>.`,
    givens: [["S", `$${S}`], ["K", `$${K}`], ["σ", `${(iv * 100).toFixed(0)}%`], ["t", `${t} yr`], ["r", `${(r * 100).toFixed(1)}%`]],
    answer: +g.delta.toFixed(3), tol: 0.02, display: fmt(g.delta, 3), placeholder: "± 0.02",
    explain: `Delta = ${type === "call" ? "N(d₁)" : "N(d₁) − 1"} where d₁ = [ln(S/K) + (r + σ²/2)t]/(σ√t). Result = <b>${fmt(g.delta, 3)}</b>. A ${type} this close to ATM sits near ${type === "call" ? "+0.5" : "−0.5"}.`,
  };
}

/* ============================================================
   PILLAR 3 — BUILD
   ============================================================ */
const TEMPLATES = {
  custom: { name: "Custom (empty)", legs: [] },
  longCall: { name: "Long call", legs: [{ type: "call", dir: "long", strike: 100, premium: 5, qty: 1 }] },
  longPut: { name: "Long put", legs: [{ type: "put", dir: "long", strike: 100, premium: 5, qty: 1 }] },
  straddle: { name: "Long straddle", legs: [{ type: "call", dir: "long", strike: 100, premium: 5, qty: 1 }, { type: "put", dir: "long", strike: 100, premium: 5, qty: 1 }] },
  strangle: { name: "Long strangle", legs: [{ type: "call", dir: "long", strike: 110, premium: 3, qty: 1 }, { type: "put", dir: "long", strike: 90, premium: 3, qty: 1 }] },
  bullCall: { name: "Bull call spread", legs: [{ type: "call", dir: "long", strike: 95, premium: 8, qty: 1 }, { type: "call", dir: "short", strike: 110, premium: 2, qty: 1 }] },
  bearPut: { name: "Bear put spread", legs: [{ type: "put", dir: "long", strike: 105, premium: 8, qty: 1 }, { type: "put", dir: "short", strike: 90, premium: 2, qty: 1 }] },
  collar: { name: "Collar", legs: [{ type: "put", dir: "long", strike: 95, premium: 3, qty: 1 }, { type: "call", dir: "short", strike: 110, premium: 3, qty: 1 }] },
  ironCondor: { name: "Iron condor", legs: [{ type: "put", dir: "long", strike: 85, premium: 1, qty: 1 }, { type: "put", dir: "short", strike: 95, premium: 3, qty: 1 }, { type: "call", dir: "short", strike: 105, premium: 3, qty: 1 }, { type: "call", dir: "long", strike: 115, premium: 1, qty: 1 }] },
};

function Build() {
  const [legs, setLegs] = useState(TEMPLATES.bullCall.legs.map(l => ({ ...l })));
  const [tmpl, setTmpl] = useState("bullCall");
  const [spot, setSpot] = useState(100);
  const [priceMode, setPriceMode] = useState(false);
  const [iv, setIv] = useState(0.30);
  const [dte, setDte] = useState(60);

  const loadTemplate = (key) => {
    setTmpl(key);
    setLegs(TEMPLATES[key].legs.map(l => ({ ...l })));
  };
  const update = (i, field, val) => setLegs(ls => ls.map((l, j) => j === i ? { ...l, [field]: val } : l));
  const addLeg = () => { setTmpl("custom"); setLegs(ls => [...ls, { type: "call", dir: "long", strike: 100, premium: 5, qty: 1 }]); };
  const removeLeg = (i) => { setTmpl("custom"); setLegs(ls => ls.filter((_, j) => j !== i)); };

  // optional BS pricing recomputes premium from S/K/iv/t
  const pricedLegs = useMemo(() => {
    if (!priceMode) return legs;
    return legs.map(l => ({ ...l, premium: +blackScholes({ S: spot, K: l.strike, T: dte / 365, r: 0.045, sigma: iv, type: l.type }).price.toFixed(2) }));
  }, [legs, priceMode, spot, iv, dte]);

  const stats = pricedLegs.length ? strategyStats(pricedLegs) : null;
  const netGreeks = useMemo(() => {
    if (!priceMode) return null;
    return pricedLegs.reduce((acc, l) => {
      const g = blackScholes({ S: spot, K: l.strike, T: dte / 365, r: 0.045, sigma: iv, type: l.type });
      const s = l.dir === "long" ? 1 : -1;
      return { delta: acc.delta + s * g.delta * l.qty, gamma: acc.gamma + s * g.gamma * l.qty, theta: acc.theta + s * g.theta * l.qty, vega: acc.vega + s * g.vega * l.qty };
    }, { delta: 0, gamma: 0, theta: 0, vega: 0 });
  }, [pricedLegs, priceMode, spot, iv, dte]);

  return (
    <div>
      <Instructions>
        <Lead>Build a strategy.</Lead> Start from a <Lead>template</Lead> or add legs yourself, then edit each leg's
        right, direction, strike, premium and quantity. Tick <Lead>Price premiums with Black-Scholes</Lead> to
        fair-value the legs and read net Greeks. The chart sums every leg into one payoff at expiry.
      </Instructions>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: T.inkDim, marginRight: 4 }}>Template:</span>
        {Object.entries(TEMPLATES).map(([k, v]) => (
          <button key={k} className="ow-btn" onClick={() => loadTemplate(k)}
            style={{
              padding: "6px 11px", borderRadius: 20, fontSize: 12,
              background: tmpl === k ? T.accentDim : T.panelHi,
              border: `1px solid ${tmpl === k ? T.accent : T.line}`,
              color: tmpl === k ? T.accent : T.inkDim,
            }}>{v.name}</button>
        ))}
      </div>

      <Grid>
        <Panel title="Legs" sub={`${legs.length} leg${legs.length !== 1 ? "s" : ""} · edit or add`}>
          {legs.map((l, i) => (
            <div key={i} style={{ background: T.panelHi, border: `1px solid ${T.line}`, borderRadius: 6, padding: 12, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span className="ow-num" style={{ fontSize: 11, color: T.inkFaint }}>LEG {i + 1}</span>
                <button className="ow-btn" onClick={() => removeLeg(i)} style={{ background: "none", border: "none", color: T.neg, fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <MiniToggle value={l.dir} onChange={v => update(i, "dir", v)} options={[["long", "Long"], ["short", "Short"]]} />
                <MiniToggle value={l.type} onChange={v => update(i, "type", v)} options={[["call", "Call"], ["put", "Put"]]} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <NumField label="Strike" value={l.strike} onChange={v => update(i, "strike", v)} prefix="$" />
                <NumField label="Premium" value={l.premium} onChange={v => update(i, "premium", v)} prefix="$" disabled={priceMode} />
                <NumField label="Qty" value={l.qty} onChange={v => update(i, "qty", v)} />
              </div>
            </div>
          ))}
          <button className="ow-btn" onClick={addLeg}
            style={{ width: "100%", padding: 10, borderRadius: 5, background: "none", border: `1px dashed ${T.lineHi}`, color: T.inkDim, fontSize: 13 }}>+ Add leg</button>

          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.line}` }}>
            <label className="ow-btn" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: T.ink, cursor: "pointer" }}>
              <input type="checkbox" checked={priceMode} onChange={e => setPriceMode(e.target.checked)} style={{ accentColor: T.accent }} />
              Price premiums with Black-Scholes
            </label>
            {priceMode && (
              <div style={{ marginTop: 12 }}>
                <Slider label="Implied vol σ" value={iv} min={0.05} max={0.9} step={0.01} onChange={setIv} pct />
                <Slider label="Days to expiry" value={dte} min={1} max={365} step={1} onChange={setDte} />
                <div className="ow-num" style={{ fontSize: 11, color: T.inkFaint, marginTop: 4 }}>r fixed at 4.5%. Premiums recompute from S, K, σ, t.</div>
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Combined payoff" sub="all legs summed · per share at expiry">
          <Slider label="Spot S (marker)" value={spot} min={40} max={160} step={1} onChange={setSpot} unit="$" />
          {pricedLegs.length ? (
            <>
              <PayoffChart legs={pricedLegs} spotRef={spot} showLegs />
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.line}` }}>
                <StatRow label="Net debit (cost)" value={fmtUSD(stats.netDebit)} hint={stats.netDebit < 0 ? "credit received" : ""} />
                <StatRow label="Breakeven(s)" value={stats.breakevens.length ? stats.breakevens.map(b => fmtUSD(b)).join(" · ") : "none"} />
                <StatRow label="Max gain" value={stats.maxGain === Infinity ? "Unlimited" : fmtUSD(stats.maxGain)} pos />
                <StatRow label="Max loss" value={stats.maxLoss === -Infinity ? "Unlimited" : fmtUSD(stats.maxLoss)} neg />
              </div>
              {priceMode && netGreeks && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.line}` }}>
                  <div className="ow-num" style={{ fontSize: 10, color: T.inkFaint, letterSpacing: 1, marginBottom: 8 }}>NET GREEKS @ SPOT</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                    <GreekBox label="Δ" value={fmt(netGreeks.delta, 2)} />
                    <GreekBox label="Γ" value={fmt(netGreeks.gamma, 3)} />
                    <GreekBox label="Θ" value={fmt(netGreeks.theta, 2)} />
                    <GreekBox label="V" value={fmt(netGreeks.vega, 2)} />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: "48px 16px", textAlign: "center", color: T.inkFaint, fontSize: 14 }}>
              No legs yet. Add a leg or pick a template to see the payoff.
            </div>
          )}
        </Panel>
      </Grid>
    </div>
  );
}

/* ============================================================
   PRIMITIVES
   ============================================================ */
function Grid({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 360px) 1fr", gap: 20, alignItems: "start" }} className="ow-grid">
    <style>{`@media(max-width:760px){.ow-grid{grid-template-columns:1fr!important}}`}</style>
    {children}
  </div>;
}
function Panel({ title, sub, children, right, wide }) {
  return (
    <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 8, padding: 18, maxWidth: wide ? 720 : "none", margin: wide ? "0 auto" : 0, width: wide ? "100%" : "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
          {sub && <div className="ow-num" style={{ fontSize: 10, color: T.inkFaint, letterSpacing: 1, textTransform: "uppercase", marginTop: 2 }}>{sub}</div>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}
function SubTabs({ value, onChange, options }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 20, background: T.panel, padding: 4, borderRadius: 8, border: `1px solid ${T.line}`, width: "fit-content" }}>
      {options.map(([id, label]) => (
        <button key={id} className="ow-btn" onClick={() => onChange(id)}
          style={{ padding: "7px 16px", borderRadius: 5, fontSize: 13, fontWeight: 500, border: "none",
            background: value === id ? T.panelHi : "transparent", color: value === id ? T.ink : T.inkDim }}>{label}</button>
      ))}
    </div>
  );
}
function Seg({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <Label>{label}</Label>
      <div style={{ display: "flex", gap: 6 }}>
        {options.map(([id, lbl]) => (
          <button key={id} className="ow-btn" onClick={() => onChange(id)}
            style={{ flex: 1, padding: "8px", borderRadius: 5, fontSize: 13,
              background: value === id ? T.accentDim : T.panelHi,
              border: `1px solid ${value === id ? T.accent : T.line}`,
              color: value === id ? T.accent : T.inkDim, fontWeight: value === id ? 600 : 400 }}>{lbl}</button>
        ))}
      </div>
    </div>
  );
}
function MiniSeg({ label, value, onChange, options }) {
  return (
    <div>
      <Label>{label}</Label>
      <div style={{ display: "flex", gap: 4 }}>
        {options.map(([id, lbl]) => (
          <button key={id} className="ow-btn" onClick={() => onChange(id)}
            style={{ padding: "6px 12px", borderRadius: 4, fontSize: 13, fontFamily: T.mono,
              background: value === id ? T.accentDim : T.panelHi,
              border: `1px solid ${value === id ? T.accent : T.line}`,
              color: value === id ? T.accent : T.inkDim }}>{lbl}</button>
        ))}
      </div>
    </div>
  );
}
function MiniToggle({ value, onChange, options }) {
  return (
    <div style={{ display: "flex", flex: 1, gap: 4 }}>
      {options.map(([id, lbl]) => (
        <button key={id} className="ow-btn" onClick={() => onChange(id)}
          style={{ flex: 1, padding: "6px", borderRadius: 4, fontSize: 12,
            background: value === id ? T.accentDim : T.ground,
            border: `1px solid ${value === id ? T.accent : T.line}`,
            color: value === id ? T.accent : T.inkDim }}>{lbl}</button>
      ))}
    </div>
  );
}
function Slider({ label, value, min, max, step, onChange, unit = "", pct }) {
  const disp = pct ? `${(value * 100).toFixed(0)}%` : `${unit}${fmt(value, step < 1 ? 2 : 0)}`;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <Label nm>{label}</Label>
        <span className="ow-num" style={{ fontSize: 13, color: T.live }}>{disp}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} style={{ width: "100%" }} />
    </div>
  );
}
function NumField({ label, value, onChange, prefix = "", disabled }) {
  return (
    <div>
      <Label>{label}</Label>
      <div style={{ display: "flex", alignItems: "center", background: disabled ? T.ground : T.ground, border: `1px solid ${T.line}`, borderRadius: 4, padding: "0 8px", opacity: disabled ? 0.6 : 1 }}>
        {prefix && <span className="ow-num" style={{ color: T.inkFaint, fontSize: 12 }}>{prefix}</span>}
        <input type="number" value={value} disabled={disabled}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="ow-num"
          style={{ width: "100%", background: "none", border: "none", color: T.ink, padding: "7px 4px", fontSize: 13, outline: "none" }} />
      </div>
    </div>
  );
}
function Label({ children, nm }) {
  return <div className={nm ? "" : "ow-num"} style={{ fontSize: nm ? 12 : 10, color: T.inkDim, letterSpacing: nm ? 0 : 1, textTransform: nm ? "none" : "uppercase", marginBottom: 5 }}>{children}</div>;
}
function StatRow({ label, value, pos, neg, hint }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "5px 0" }}>
      <span style={{ fontSize: 13, color: T.inkDim }}>{label}{hint && <span style={{ color: T.inkFaint, fontSize: 11 }}> · {hint}</span>}</span>
      <span className="ow-num" style={{ fontSize: 13, color: pos ? T.pos : neg ? T.neg : T.ink, fontWeight: 500 }}>{value}</span>
    </div>
  );
}
function GreekBox({ label, value }) {
  return (
    <div style={{ background: T.ground, border: `1px solid ${T.line}`, borderRadius: 4, padding: "8px 6px", textAlign: "center" }}>
      <div className="ow-num" style={{ fontSize: 15, color: T.call }}>{label}</div>
      <div className="ow-num" style={{ fontSize: 13, color: T.ink, marginTop: 2 }}>{value}</div>
    </div>
  );
}
function Note({ children }) {
  return <div style={{ marginTop: 14, fontSize: 12.5, lineHeight: 1.55, color: T.inkDim, borderLeft: `2px solid ${T.lineHi}`, paddingLeft: 12 }}>{children}</div>;
}
function Instructions({ children }) {
  return (
    <div style={{
      background: T.accentDim, border: `1px solid ${T.line}`, borderLeft: `3px solid ${T.accent}`,
      borderRadius: 6, padding: "11px 14px", marginBottom: 18, fontSize: 13, lineHeight: 1.55, color: T.inkDim,
    }}>{children}</div>
  );
}
function Lead({ children }) {
  return <b style={{ color: T.ink }}>{children}</b>;
}
function ScorePill({ score }) {
  const pct = score.total ? Math.round(score.right / score.total * 100) : 0;
  return (
    <div className="ow-num" style={{ fontSize: 12, color: T.inkDim, textAlign: "right" }}>
      <span style={{ color: T.pos }}>{score.right}</span>/{score.total}
      {score.total > 0 && <span style={{ color: T.inkFaint }}> · {pct}%</span>}
    </div>
  );
}
function Feedback({ ok, answer, onNext }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ padding: "11px 14px", borderRadius: 5, background: ok ? T.posDim : T.negDim, border: `1px solid ${ok ? T.pos : T.neg}`, color: ok ? T.pos : T.neg, fontWeight: 600, fontSize: 14 }}>
        {ok ? "Correct" : <>Not quite — answer: <span style={{ color: T.ink }}>{answer}</span></>}
      </div>
      <button className="ow-btn" onClick={onNext} style={{ ...primaryBtn, marginTop: 12, width: "100%" }}>Next →</button>
    </div>
  );
}

const inputStyle = {
  flex: 1, background: T.ground, border: `1px solid ${T.lineHi}`, borderRadius: 5,
  color: T.ink, padding: "11px 14px", fontSize: 15, fontFamily: T.mono, outline: "none",
};
const primaryBtn = {
  background: T.accent, color: T.ground, border: "none", borderRadius: 5,
  padding: "11px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer",
};

/* generic line chart for greeks/decay */
function LineChart({ pts, xLabel, yLabel, markerX, flipX, floor, floorLabel }) {
  const width = 620, height = 300, pad = { l: 52, r: 16, t: 16, b: 34 };
  const xsRaw = pts.map(p => p.x);
  let xMin = Math.min(...xsRaw), xMax = Math.max(...xsRaw);
  const ys = pts.map(p => p.y);
  let yMin = Math.min(...ys, floor != null ? floor : Infinity), yMax = Math.max(...ys);
  const yp = (yMax - yMin) * 0.1 || 1; yMin -= yp; yMax += yp;
  const X = (v) => { const f = (v - xMin) / (xMax - xMin); return pad.l + (flipX ? 1 - f : f) * (width - pad.l - pad.r); };
  const Y = (v) => pad.t + (1 - (v - yMin) / (yMax - yMin)) * (height - pad.t - pad.b);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(" ");
  const zeroIn = yMin < 0 && yMax > 0;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {[0, 0.5, 1].map((f, i) => {
        const yv = yMin + (yMax - yMin) * f;
        return <g key={i}>
          <line x1={pad.l} x2={width - pad.r} y1={Y(yv)} y2={Y(yv)} stroke={T.line} strokeWidth={0.5} />
          <text x={pad.l - 8} y={Y(yv) + 3} textAnchor="end" fontFamily={T.mono} fontSize={9} fill={T.inkFaint}>{fmt(yv, Math.abs(yv) < 1 ? 2 : 1)}</text>
        </g>;
      })}
      {zeroIn && <line x1={pad.l} x2={width - pad.r} y1={Y(0)} y2={Y(0)} stroke={T.lineHi} strokeWidth={1} />}
      {floor != null && <>
        <line x1={pad.l} x2={width - pad.r} y1={Y(floor)} y2={Y(floor)} stroke={T.put} strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
        <text x={width - pad.r} y={Y(floor) - 4} textAnchor="end" fontFamily={T.mono} fontSize={9} fill={T.put}>{floorLabel}</text>
      </>}
      {markerX != null && markerX >= xMin && markerX <= xMax && (
        <line x1={X(markerX)} x2={X(markerX)} y1={pad.t} y2={height - pad.b} stroke={T.accent} strokeWidth={1} strokeDasharray="3 2" opacity={0.7} />
      )}
      <path d={path} fill="none" stroke={T.accent} strokeWidth={2.2} strokeLinejoin="round" />
      {[xMin, (xMin + xMax) / 2, xMax].map((xv, i) => (
        <text key={i} x={X(xv)} y={height - pad.b + 16} textAnchor="middle" fontFamily={T.mono} fontSize={9} fill={T.inkDim}>{fmt(xv, xv < 1 && xv > 0 ? 2 : 0)}</text>
      ))}
      <text x={width - pad.r} y={height - 3} textAnchor="end" fontFamily={T.mono} fontSize={9} fill={T.inkFaint}>{xLabel} →</text>
      <text x={pad.l} y={11} fontFamily={T.mono} fontSize={9} fill={T.inkFaint}>{yLabel}</text>
    </svg>
  );
}

/* ---------- utils ---------- */
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; }
function norm(s) { return s.toLowerCase().trim().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " "); }

/* ---------- mount ---------- */
createRoot(document.getElementById("root")).render(<OptionsWorkbench />);
