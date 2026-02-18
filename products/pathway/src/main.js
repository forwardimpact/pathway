/**
 * Main application entry point
 */

import { createPagesRouter } from "./lib/router-pages.js";
import { setData, setError, getBranding } from "./lib/state.js";
import { loadAllData } from "./lib/yaml-loader.js";
import { render, div, h1, p, showError } from "./lib/render.js";
import { updateActiveNav } from "./components/nav.js";
import { setupTopBar, updateCommand } from "./components/top-bar.js";

const router = createPagesRouter({
  onNotFound: renderNotFound,
});

// Import pages
import { renderLanding } from "./pages/landing.js";
import { renderSkillsList, renderSkillDetail } from "./pages/skill.js";
import {
  renderBehavioursList,
  renderBehaviourDetail,
} from "./pages/behaviour.js";
import {
  renderDisciplinesList,
  renderDisciplineDetail,
} from "./pages/discipline.js";
import { renderTracksList, renderTrackDetail } from "./pages/track.js";
import { renderGradesList, renderGradeDetail } from "./pages/grade.js";
import { renderDriversList, renderDriverDetail } from "./pages/driver.js";
import { renderStagesList, renderStageDetail } from "./pages/stage.js";
import { renderToolsList } from "./pages/tool.js";
import { renderJobBuilder } from "./pages/job-builder.js";
import { renderJobDetail } from "./pages/job.js";
import { renderInterviewPrep } from "./pages/interview-builder.js";
import { renderInterviewDetail } from "./pages/interview.js";
import { renderCareerProgress } from "./pages/progress-builder.js";
import { renderProgressDetail } from "./pages/progress.js";
import { renderSelfAssessment } from "./pages/self-assessment.js";
import { renderAssessmentResults } from "./pages/assessment-results.js";
import { renderAgentBuilder } from "./pages/agent-builder.js";

/**
 * Initialize the application
 */
async function init() {
  // Set up top bar (sidebar toggle + CLI command display)
  setupTopBar();
  setupDrawerOverlay();

  // Load data
  try {
    const data = await loadAllData("./data");
    setData(data);

    // Populate branding from framework data
    populateBranding();
  } catch (error) {
    console.error("Failed to load data:", error);
    setError(error);
    showError(`Failed to load data: ${error.message}`);
    return;
  }

  // Set up routes
  setupRoutes();

  // Start router
  router.start();

  // Update active nav link and CLI command on route changes
  const updateNav = () => {
    updateActiveNav(window.location.hash.slice(1) || "/");
    updateCommand();
  };
  window.addEventListener("hashchange", updateNav);
  updateNav();
}

/**
 * Set up all application routes
 */
function setupRoutes() {
  // Landing page
  router.on("/", renderLanding);

  // Skill
  router.on("/skill", renderSkillsList);
  router.on("/skill/:id", renderSkillDetail);

  // Behaviour
  router.on("/behaviour", renderBehavioursList);
  router.on("/behaviour/:id", renderBehaviourDetail);

  // Discipline
  router.on("/discipline", renderDisciplinesList);
  router.on("/discipline/:id", renderDisciplineDetail);

  // Track
  router.on("/track", renderTracksList);
  router.on("/track/:id", renderTrackDetail);

  // Grade
  router.on("/grade", renderGradesList);
  router.on("/grade/:id", renderGradeDetail);

  // Driver
  router.on("/driver", renderDriversList);
  router.on("/driver/:id", renderDriverDetail);

  // Stage
  router.on("/stage", renderStagesList);
  router.on("/stage/:id", renderStageDetail);

  // Tool
  router.on("/tool", renderToolsList);

  // Job builder
  router.on("/job-builder", renderJobBuilder);
  router.on("/job/:discipline/:grade/:track", renderJobDetail);
  router.on("/job/:discipline/:grade", renderJobDetail);

  // Interview prep
  router.on("/interview-prep", renderInterviewPrep);
  router.on("/interview/:discipline/:grade/:track", renderInterviewDetail);
  router.on("/interview/:discipline/:grade", renderInterviewDetail);

  // Career progress
  router.on("/career-progress", renderCareerProgress);
  router.on("/progress/:discipline/:grade/:track", renderProgressDetail);
  router.on("/progress/:discipline/:grade", renderProgressDetail);

  // Self-assessment
  router.on("/self-assessment", renderSelfAssessment);
  router.on("/self-assessment/results", renderAssessmentResults);

  // Agent builder
  router.on("/agent-builder", renderAgentBuilder);
  router.on("/agent/:discipline/:track/:stage", renderAgentBuilder);
  router.on("/agent/:discipline/:track", renderAgentBuilder);
  router.on("/agent/:discipline", renderAgentBuilder);
}

/**
 * Render 404 page
 */
function renderNotFound() {
  render(
    div(
      { className: "not-found" },
      h1({}, "404 - Page Not Found"),
      p({}, "The page you are looking for does not exist."),
      div(
        { className: "not-found-actions" },
        div(
          {},
          createElement(
            "a",
            { href: "#/", className: "btn btn-primary" },
            "Go Home",
          ),
        ),
      ),
    ),
  );
}

/**
 * Helper to create elements (used in not found)
 */
function createElement(tag, attrs, text) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === "className") el.className = value;
    else el.setAttribute(key, value);
  });
  if (text) el.textContent = text;
  return el;
}

/**
 * Populate branding elements from framework data
 */
function populateBranding() {
  const branding = getBranding();

  // Update document title
  document.title = branding.title;

  // Update drawer brand
  const brandTitle = document.querySelector(".nav-brand .brand-title");
  if (brandTitle) {
    brandTitle.textContent = branding.title;
  }

  // Update drawer brand emoji
  const brandEmoji = document.querySelector(".nav-brand .brand-emoji");
  if (brandEmoji) {
    brandEmoji.textContent = branding.emojiIcon;
  }

  // Update drawer brand tag
  const brandTag = document.querySelector(".nav-brand .brand-tag");
  if (brandTag) {
    brandTag.textContent = branding.tag;
  }

  // Update footer
  const footer = document.querySelector("#app-footer p");
  if (footer) {
    footer.textContent = branding.title;
  }
}

/**
 * Set up drawer overlay for mobile backdrop and auto-close behavior
 */
function setupDrawerOverlay() {
  const app = document.getElementById("app");
  const drawer = document.getElementById("app-drawer");

  if (!drawer) return;

  // Create overlay element for mobile backdrop
  const overlay = document.createElement("div");
  overlay.className = "drawer-overlay";
  app.insertBefore(overlay, drawer);

  // Close drawer when overlay is clicked (mobile)
  overlay.addEventListener("click", () => {
    app.classList.remove("drawer-open");
  });

  // Close drawer on mobile when a link is clicked
  drawer.addEventListener("click", (e) => {
    if (e.target.tagName === "A" && window.innerWidth <= 768) {
      app.classList.remove("drawer-open");
    }
  });
}

// Start the app
init();
