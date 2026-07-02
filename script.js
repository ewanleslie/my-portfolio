// Live projects. The first one renders as the featured banner; any further
// live projects render as smaller cards alongside the "Coming Soon" placeholders.
// Fields: title, description, url, linkLabel (optional)
const projects = [
  {
    title: "Accounting Trainer Tool",
    description: "Interactive model explorer and quiz covering income statement, balance sheet, cash flow, and supporting schedules.",
    url: "/three-statement-studio/index.html",
    linkLabel: "Open Studio",
    categories: "Financial Modelling, Accounting",
  },
  {
    title: "Options Workbench",
    description: "Explore option payoffs and Greeks, drill derivatives terms and pricing math, and build multi-leg strategies with Black-Scholes pricing.",
    url: "/options-workbench/index.html",
    linkLabel: "Open Workbench",
    theme: "green",
    categories: "Derivatives, Financial Modelling",
  },
];

// Number of "Coming Soon" placeholder cards to render after the live ones.
const COMING_SOON = 2;

const prefersReducedMotion =
  window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function pad(n) {
  return String(n).padStart(2, "0");
}

/* ---------- card builders ---------- */

function featuredCard(project, n) {
  const wrap = document.createElement("div");
  wrap.className = "reveal-featured";
  wrap.dataset.categories = project.categories || "";

  const a = document.createElement("a");
  a.className = "featured-card";
  if (project.theme) a.classList.add("featured-card--" + project.theme);
  a.href = project.url;
  a.dataset.navigate = "true";

  const watermark = document.createElement("span");
  watermark.className = "featured-watermark";
  watermark.textContent = pad(n);
  watermark.setAttribute("aria-hidden", "true");

  const title = document.createElement("h3");
  title.className = "featured-title";
  title.textContent = project.title;

  const desc = document.createElement("p");
  desc.className = "featured-desc";
  desc.textContent = project.description;

  const link = document.createElement("span");
  link.className = "featured-link";
  const label = document.createElement("span");
  label.className = "featured-link-label";
  label.textContent = project.linkLabel || "Open";
  const arrow = document.createElement("span");
  arrow.className = "arrow";
  arrow.textContent = "→";
  link.append(label, document.createTextNode(" "), arrow);

  a.append(watermark, title, desc, link);
  wrap.appendChild(a);
  return wrap;
}

function makeReveal(child) {
  const reveal = document.createElement("div");
  reveal.className = "reveal";
  reveal.appendChild(child);
  return reveal;
}

function liveCard(project, n) {
  const a = document.createElement("a");
  a.className = "card";
  a.href = project.url;
  a.dataset.navigate = "true";

  const num = document.createElement("span");
  num.className = "card-num";
  num.textContent = pad(n);

  const title = document.createElement("h3");
  title.className = "card-title";
  title.textContent = project.title;

  const desc = document.createElement("p");
  desc.className = "card-desc";
  desc.textContent = project.description;

  const link = document.createElement("span");
  link.className = "card-link";
  const label = document.createTextNode((project.linkLabel || "View project") + " ");
  const arrow = document.createElement("span");
  arrow.className = "arrow";
  arrow.textContent = "→";
  link.append(label, arrow);

  a.append(num, title, desc, link);
  return makeReveal(a);
}

function soonCard(n) {
  const card = document.createElement("div");
  card.className = "card card--soon";

  const num = document.createElement("span");
  num.className = "card-num";
  num.textContent = pad(n);

  const title = document.createElement("h3");
  title.className = "card-title";
  title.textContent = "Coming Soon";

  const desc = document.createElement("p");
  desc.className = "card-desc";
  desc.textContent = "A new project is in the works — check back shortly.";

  const link = document.createElement("span");
  link.className = "card-link";
  link.textContent = "In progress";

  card.append(num, title, desc, link);
  return makeReveal(card);
}

/* ---------- render ---------- */

function render() {
  const featured = document.getElementById("featured");
  const grid = document.getElementById("projects");
  if (!featured || !grid) return;
  featured.innerHTML = "";
  grid.innerHTML = "";

  let n = 1;
  // every live project renders as a full-width featured banner
  projects.forEach((p) => featured.appendChild(featuredCard(p, n++)));
  for (let i = 0; i < COMING_SOON; i++) grid.appendChild(soonCard(n++));

  setupReveals();
  wireNavigation();
}

/* ---------- scroll reveals (single observer, one-shot per element) ---------- */

function runCountUp(section, instant) {
  section.querySelectorAll(".stat-num").forEach((el) => {
    if (el.dataset.counted) return;
    el.dataset.counted = "1";
    const target = parseInt(el.dataset.target, 10) || 0;
    const suffix = el.dataset.suffix || "";

    if (instant) {
      el.textContent = target + suffix;
      return;
    }

    const duration = 1200;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      el.textContent = Math.round(eased * target) + suffix;
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = target + suffix;
    }
    requestAnimationFrame(tick);
  });
}

function setupReveals() {
  const tagRow = document.getElementById("tag-row");
  const statsSection = document.getElementById("stats-section");
  const featuredWraps = Array.from(document.querySelectorAll(".reveal-featured"));
  const cardReveals = Array.from(document.querySelectorAll("#projects .reveal"));

  const targets = [];
  if (tagRow) targets.push(tagRow);
  if (statsSection) targets.push(statsSection);
  featuredWraps.forEach((f) => targets.push(f));
  cardReveals.forEach((c) => targets.push(c));

  // No-motion / no-IO fallback: show everything immediately.
  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    if (tagRow) tagRow.classList.add("in-view");
    if (statsSection) {
      statsSection.classList.add("in-view");
      runCountUp(statsSection, true);
    }
    featuredWraps.forEach((f) => f.classList.add("in-view"));
    cardReveals.forEach((c) => c.classList.add("in-view"));
    return;
  }

  const io = new IntersectionObserver(
    (entries, obs) => {
      let cardIndex = 0; // stagger cards that appear in the same batch
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;

        if (el === tagRow) {
          el.querySelectorAll(".tag").forEach((t, i) => {
            t.style.animationDelay = i * 0.05 + "s";
          });
          el.classList.add("in-view");
        } else if (el === statsSection) {
          el.classList.add("in-view");
          runCountUp(el);
        } else if (el.classList.contains("reveal-featured")) {
          el.classList.add("in-view");
        } else {
          // smaller card
          el.style.transitionDelay = cardIndex * 0.12 + "s";
          cardIndex++;
          el.classList.add("in-view");
        }

        obs.unobserve(el); // each element animates only once
      });
    },
    { threshold: 0.15 }
  );

  targets.forEach((t) => io.observe(t));
}

/* ---------- click-to-navigate fade ---------- */

function wireNavigation() {
  const fade = document.querySelector(".page-fade");

  document.querySelectorAll("a[data-navigate]").forEach((a) => {
    a.addEventListener("click", (e) => {
      // let new-tab / modified clicks behave normally
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      const url = a.href;

      if (prefersReducedMotion || !fade) {
        window.location.href = url;
        return;
      }
      fade.classList.add("active");
      setTimeout(() => {
        window.location.href = url;
      }, 250);
    });
  });
}

function setYear() {
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
}

// Light/dark toggle. The initial theme is set by the inline <head> script;
// here we wire the button and persist changes to localStorage (shared with
// the artifact pages so the choice follows the visitor around the site).
function setupThemeToggle() {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  const root = document.documentElement;
  const apply = (t) => {
    root.setAttribute("data-theme", t);
    btn.textContent = t === "dark" ? "☀" : "☾"; // icon = the mode you switch to
    btn.setAttribute("aria-pressed", String(t === "dark"));
    btn.title = t === "dark" ? "Switch to light mode" : "Switch to dark mode";
  };
  let theme = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
  apply(theme);
  btn.addEventListener("click", () => {
    theme = theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem("theme", theme);
    } catch (e) {}
    apply(theme);
  });
}

/* ---------- market ticker ---------- */
// Hardcoded placeholder quotes that look authentic. `chg` is the % change;
// a negative value renders red with a ▼, positive renders green with a ▲.
// Swap this array for a live API feed later — the rendering stays the same.
const TICKER = [
  { sym: "S&P 500", price: "5,432.10", chg: 0.82 },
  { sym: "NASDAQ", price: "17,210.45", chg: 1.05 },
  { sym: "DOW JONES", price: "39,875.30", chg: -0.21 },
  { sym: "FTSE 100", price: "8,210.60", chg: 0.34 },
  { sym: "DAX", price: "18,455.20", chg: -0.12 },
  { sym: "NIKKEI 225", price: "38,920.15", chg: 0.95 },
  { sym: "VIX", price: "13.45", chg: -3.10 },
  { sym: "10Y US Treasury", price: "4.28%", chg: 0.65 },
  { sym: "2Y US Treasury", price: "4.72%", chg: -0.41 },
  { sym: "USD/GBP", price: "0.7845", chg: 0.12 },
  { sym: "USD/EUR", price: "0.9210", chg: -0.08 },
  { sym: "USD/JPY", price: "157.20", chg: 0.45 },
  { sym: "Gold", price: "2,358.40", chg: 0.67 },
  { sym: "Silver", price: "30.85", chg: 1.42 },
  { sym: "Crude Oil (WTI)", price: "78.32", chg: -0.94 },
  { sym: "Brent Crude", price: "82.65", chg: -0.71 },
  { sym: "Natural Gas", price: "2.74", chg: 2.15 },
  { sym: "Bitcoin", price: "67,420.00", chg: 3.28 },
  { sym: "Ethereum", price: "3,512.75", chg: 2.04 },
  { sym: "Apple (AAPL)", price: "214.30", chg: 0.58 },
  { sym: "Microsoft (MSFT)", price: "448.10", chg: 0.91 },
  { sym: "NVIDIA (NVDA)", price: "122.45", chg: 2.76 },
  { sym: "Amazon (AMZN)", price: "185.20", chg: -0.33 },
  { sym: "Tesla (TSLA)", price: "246.80", chg: -1.85 },
  { sym: "Meta (META)", price: "502.15", chg: 1.12 },
];

function tickerItem(t) {
  const item = document.createElement("span");
  item.className = "ticker-item";

  const sym = document.createElement("span");
  sym.className = "ticker-symbol";
  sym.textContent = t.sym;

  const price = document.createElement("span");
  price.className = "ticker-price";
  price.textContent = t.price;

  const up = t.chg >= 0;
  const chg = document.createElement("span");
  chg.className = "ticker-change " + (up ? "up" : "down");
  chg.textContent = (up ? "▲ " : "▼ ") + Math.abs(t.chg).toFixed(2) + "%";

  item.append(sym, price, chg);
  return item;
}

function tickerSep() {
  const sep = document.createElement("span");
  sep.className = "ticker-sep";
  sep.setAttribute("aria-hidden", "true");
  sep.textContent = "•";
  return sep;
}

let lastTickerCount = -1;

function buildTicker(items = TICKER) {
  const track = document.getElementById("ticker-track");
  if (!track) return;
  track.innerHTML = "";

  // Two identical groups side by side; CSS shifts the track by -50% so the
  // second group seamlessly takes the first's place and the loop is invisible.
  for (let copy = 0; copy < 2; copy++) {
    const group = document.createElement("span");
    group.className = "ticker-group";
    if (copy === 1) group.setAttribute("aria-hidden", "true");
    items.forEach((t) => {
      group.appendChild(tickerItem(t));
      group.appendChild(tickerSep());
    });
    track.appendChild(group);
  }

  // Only re-baseline the scroll animation when the number of items changes
  // (e.g. switching from the hardcoded fallback to live data). Routine value
  // refreshes keep the same count, so the scroll continues without a jump.
  if (items.length !== lastTickerCount) {
    track.style.animation = "none";
    void track.offsetWidth; // force reflow so the restart registers
    track.style.animation = "";
    lastTickerCount = items.length;
  }
}

// Format a numeric price the way the hardcoded values look: thousands
// separators and 2 decimals (4 for sub-1 values like some FX rates).
function formatPrice(value) {
  const n = typeof value === "number" ? value : parseFloat(value);
  if (!isFinite(n)) return String(value);
  const decimals = Math.abs(n) >= 1 ? 2 : 4;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// Live quotes accumulate here across polls. The API returns a rotating subset
// of symbols each call (to stay within the free-tier rate limit), so the page
// stitches the chunks together and keeps them refreshed. Keyed by symbol.
const marketCache = {};

// Fetch the current chunk of live quotes, merge it into marketCache, and
// rebuild the ticker from everything gathered so far. On any failure we
// silently keep whatever is already showing (live cache or hardcoded
// fallback), so it never breaks.
async function loadMarketData() {
  try {
    const res = await fetch("/api/market-data", { cache: "no-store" });
    if (!res.ok) throw new Error("status " + res.status);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error("empty payload");

    data.forEach((d) => {
      marketCache[d.symbol] = {
        sym: d.name || d.symbol,
        price: formatPrice(d.price),
        chg: typeof d.changePct === "number" ? d.changePct : parseFloat(d.changePct) || 0,
        order: typeof d.order === "number" ? d.order : 999,
      };
    });

    const items = Object.values(marketCache).sort((a, b) => a.order - b.order);
    if (items.length) buildTicker(items);
    updateTimestamp(); // only reached on a successful fetch
  } catch (e) {
    // keep whatever is already showing (and leave the timestamp untouched)
  }
}

// Stamp the ticker with the current HH:MM. Called only after a successful fetch.
function updateTimestamp() {
  const el = document.getElementById("ticker-updated");
  if (!el) return;
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  el.textContent = hh + ":" + mm;
}

/* ---------- category filters ---------- */
function projectCards() {
  return document.querySelectorAll("#featured > .reveal-featured, #projects > .reveal");
}

// Smoothly collapse or expand a card wrapper: fade the inner card and animate
// its height from the real pixel height to 0 (and back) so the grid reflows.
function setCardHidden(card, hidden) {
  const isHidden = card.classList.contains("card-hidden");
  if (hidden === isHidden) return;

  if (hidden) {
    card.style.overflow = "hidden";
    card.style.maxHeight = card.scrollHeight + "px";
    void card.offsetHeight; // reflow so the collapse animates from the real height
    card.classList.add("card-hidden");
    card.style.maxHeight = "0px";
  } else {
    card.classList.remove("card-hidden");
    card.style.overflow = "hidden";
    card.style.maxHeight = card.scrollHeight + "px";
    const onEnd = (e) => {
      if (e.propertyName !== "max-height") return;
      card.style.maxHeight = "";
      card.style.overflow = "";
      card.removeEventListener("transitionend", onEnd);
    };
    card.addEventListener("transitionend", onEnd);
  }
}

function setupFilters() {
  const pills = Array.from(document.querySelectorAll("#tag-row .tag"));
  if (!pills.length) return;

  const apply = (filter) => {
    projectCards().forEach((card) => {
      const cats = (card.dataset.categories || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const match = filter === "all" || cats.includes(filter);
      setCardHidden(card, !match);
    });
  };

  pills.forEach((pill) => {
    pill.addEventListener("click", () => {
      pills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      apply(pill.dataset.filter);
    });
  });
}

/* ---------- featured-card interactions ---------- */

// Magnetic hover: the featured card drifts toward the cursor (max ~8px in any
// direction) and springs back to centre when the cursor leaves. The -4px hover
// lift is folded in so it doesn't fight the CSS :hover transform.
function setupMagnetic() {
  if (prefersReducedMotion) return;
  const MAX = 8;
  document.querySelectorAll(".featured-card").forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const r = card.getBoundingClientRect();
      const nx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const ny = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const dx = Math.max(-1, Math.min(1, nx)) * MAX;
      const dy = Math.max(-1, Math.min(1, ny)) * MAX;
      card.style.transform = `translate(${dx.toFixed(1)}px, ${(dy - 4).toFixed(1)}px)`;
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = ""; // CSS transition eases it back to rest
    });
  });
}

// Scroll parallax: the large watermark numbers drift at a marginally different
// rate than their card as it moves through the viewport. rAF-throttled.
function setupParallax() {
  if (prefersReducedMotion) return;
  const marks = Array.from(document.querySelectorAll(".featured-watermark"));
  if (!marks.length) return;
  let ticking = false;
  const update = () => {
    const vh = window.innerHeight || document.documentElement.clientHeight;
    marks.forEach((m) => {
      const card = m.closest(".featured-card");
      if (!card) return;
      const r = card.getBoundingClientRect();
      const rel = (r.top + r.height / 2 - vh / 2) / vh; // ~ -0.5 .. 0.5
      m.style.transform = `translateY(${(rel * 16).toFixed(1)}px)`; // gentle drift
    });
    ticking = false;
  };
  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  update();
}

document.addEventListener("DOMContentLoaded", () => {
  setupThemeToggle();
  render();
  setupFilters(); // wire the category pills after cards exist
  setupMagnetic(); // magnetic hover on the featured banners
  setupParallax(); // watermark parallax on scroll
  buildTicker(); // hardcoded values render immediately
  loadMarketData(); // then swap in live data if the API responds
  setInterval(loadMarketData, 60000); // refresh every 60s
  setYear();
});
