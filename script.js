// Live projects. The first one renders as the featured banner; any further
// live projects render as smaller cards alongside the "Coming Soon" placeholders.
// Fields: title, description, url, linkLabel (optional)
const projects = [
  {
    title: "Accounting Trainer Tool",
    description: "Interactive model explorer and quiz covering income statement, balance sheet, cash flow, and supporting schedules.",
    url: "/three-statement-studio/index.html",
    linkLabel: "Open Studio",
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

  const a = document.createElement("a");
  a.className = "featured-card";
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
  if (projects.length) {
    featured.appendChild(featuredCard(projects[0], n++));
  }
  // any additional live projects beyond the first become smaller cards
  for (let i = 1; i < projects.length; i++) grid.appendChild(liveCard(projects[i], n++));
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
  const featuredWrap = document.querySelector(".reveal-featured");
  const cardReveals = Array.from(document.querySelectorAll("#projects .reveal"));

  const targets = [];
  if (tagRow) targets.push(tagRow);
  if (statsSection) targets.push(statsSection);
  if (featuredWrap) targets.push(featuredWrap);
  cardReveals.forEach((c) => targets.push(c));

  // No-motion / no-IO fallback: show everything immediately.
  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    if (tagRow) tagRow.classList.add("in-view");
    if (statsSection) {
      statsSection.classList.add("in-view");
      runCountUp(statsSection, true);
    }
    if (featuredWrap) featuredWrap.classList.add("in-view");
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
        } else if (el === featuredWrap) {
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

document.addEventListener("DOMContentLoaded", () => {
  render();
  setYear();
});
