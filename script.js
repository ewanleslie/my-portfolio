// Add your projects here. Each entry becomes a card on the homepage.
// Fields:
//   title       - project name (required)
//   description - one or two sentences (required)
//   url         - link to the project, repo, or demo (required)
//   linkLabel   - optional custom text for the link (defaults to "View project")
const projects = [
  {
    title: "Accounting Trainer Tool",
    description: "Interactive model explorer and quiz covering income statement, balance sheet, cash flow, and supporting schedules.",
    url: "/three-statement-studio/index.html",
    linkLabel: "Open studio",
  },
];

function createCard(project) {
  const card = document.createElement("article");
  card.className = "card";

  const title = document.createElement("h3");
  title.className = "card-title";
  title.textContent = project.title;

  const description = document.createElement("p");
  description.className = "card-description";
  description.textContent = project.description;

  const link = document.createElement("a");
  link.className = "card-link";
  link.href = project.url;
  link.textContent = project.linkLabel || "View project";
  link.target = "_blank";
  link.rel = "noopener noreferrer";

  card.append(title, description, link);
  return card;
}

function renderProjects() {
  const grid = document.getElementById("projects");
  if (!grid) return;

  grid.innerHTML = "";

  if (projects.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No projects yet — check back soon.";
    grid.appendChild(empty);
    return;
  }

  for (const project of projects) {
    grid.appendChild(createCard(project));
  }
}

function setYear() {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

document.addEventListener("DOMContentLoaded", () => {
  renderProjects();
  setYear();
});
