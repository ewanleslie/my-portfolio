// Live projects. Each entry becomes a card on the homepage.
// Fields: title, description, url, linkLabel (optional)
const projects = [
  {
    title: "Accounting Trainer Tool",
    description: "Interactive model explorer and quiz covering income statement, balance sheet, cash flow, and supporting schedules.",
    url: "/three-statement-studio/index.html",
    linkLabel: "Open studio",
  },
];

// Number of "Coming Soon" placeholder cards to render after the live ones.
const COMING_SOON = 2;

const prefersReducedMotion =
  window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function pad(n) {
  return String(n).padStart(2, "0");
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

function render() {
  const grid = document.getElementById("projects");
  if (!grid) return;
  grid.innerHTML = "";

  let n = 1;
  projects.forEach((p) => grid.appendChild(liveCard(p, n++)));
  for (let i = 0; i < COMING_SOON; i++) grid.appendChild(soonCard(n++));

  revealOnScroll();
  wireNavigation();
}

// Fade each card into view as it enters the viewport, staggering any
// that appear together by 0.1s.
function revealOnScroll() {
  const reveals = Array.from(document.querySelectorAll(".reveal"));

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    reveals.forEach((r) => r.classList.add("in-view"));
    return;
  }

  const io = new IntersectionObserver(
    (entries, obs) => {
      const shown = entries.filter((e) => e.isIntersecting);
      shown.forEach((entry, i) => {
        const el = entry.target;
        el.style.transitionDelay = i * 0.1 + "s";
        el.classList.add("in-view");
        obs.unobserve(el);
      });
    },
    { threshold: 0.15 }
  );

  reveals.forEach((r) => io.observe(r));
}

// Intercept card clicks to fade the page to white before navigating.
function wireNavigation() {
  const fade = document.querySelector(".page-fade");

  document.querySelectorAll("a.card[data-navigate]").forEach((a) => {
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
