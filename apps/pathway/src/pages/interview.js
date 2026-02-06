/**
 * Interview detail page with interview questions
 */

import {
  render,
  div,
  h1,
  h2,
  h4,
  p,
  a,
  button,
  span,
  ul,
  li,
  formatLevel,
} from "../lib/render.js";
import { getState } from "../lib/state.js";
import { createBadge } from "../components/card.js";
import { createBackLink } from "../components/nav.js";
import { createDetailSection } from "../components/detail.js";
import { renderError } from "../components/error-page.js";
import { getConceptEmoji } from "@forwardimpact/schema/levels";
import {
  prepareAllInterviews,
  INTERVIEW_TYPES,
} from "../formatters/interview/shared.js";

/**
 * Render interview detail page
 * @param {Object} params - Route params
 */
export function renderInterviewDetail(params) {
  const { discipline: disciplineId, grade: gradeId, track: trackId } = params;
  const { data } = getState();

  // Find the components
  const discipline = data.disciplines.find((d) => d.id === disciplineId);
  const grade = data.grades.find((g) => g.id === gradeId);
  const track = trackId ? data.tracks.find((t) => t.id === trackId) : null;

  if (!discipline || !grade) {
    renderError({
      title: "Interview Not Found",
      message: "Invalid combination. Discipline or grade not found.",
      backPath: "/interview-prep",
      backText: "← Back to Interview Prep",
    });
    return;
  }

  // If trackId was provided but not found, error
  if (trackId && !track) {
    renderError({
      title: "Interview Not Found",
      message: `Track "${trackId}" not found.`,
      backPath: "/interview-prep",
      backText: "← Back to Interview Prep",
    });
    return;
  }

  // Use formatter shared module to get all interview types
  const interviewsView = prepareAllInterviews({
    discipline,
    grade,
    track,
    skills: data.skills,
    behaviours: data.behaviours,
    questions: data.questions,
  });

  if (!interviewsView) {
    renderError({
      title: "Invalid Combination",
      message: "This discipline, track, and grade combination is not valid.",
      backPath: "/interview-prep",
      backText: "← Back to Interview Prep",
    });
    return;
  }

  // State for current interview type (default to first: Mission Fit)
  let currentType = "mission";

  const page = div(
    { className: "interview-detail-page" },
    // Header
    div(
      { className: "page-header" },
      createBackLink("/interview-prep", "← Back to Interview Prep"),
      h1({ className: "page-title" }, `Interview: ${interviewsView.title}`),
      div(
        { className: "page-description" },
        "Interview questions for: ",
        a(
          { href: `#/discipline/${interviewsView.disciplineId}` },
          interviewsView.disciplineName,
        ),
        " × ",
        a(
          { href: `#/grade/${interviewsView.gradeId}` },
          interviewsView.gradeId,
        ),
        " × ",
        a(
          { href: `#/track/${interviewsView.trackId}` },
          interviewsView.trackName,
        ),
      ),
    ),

    // Interview type toggle
    div(
      { className: "interview-type-toggle", id: "interview-type-toggle" },
      ...Object.values(INTERVIEW_TYPES).map((type) =>
        createTypeButton(type, type.id === currentType, () => {
          currentType = type.id;
          updateTypeToggle();
          updateQuestions();
        }),
      ),
    ),

    // Questions container
    div({ id: "interview-questions-container" }),
  );

  render(page);

  // Generate and display initial questions
  updateQuestions();

  function updateTypeToggle() {
    const toggleEl = document.getElementById("interview-type-toggle");
    toggleEl.innerHTML = "";
    Object.values(INTERVIEW_TYPES).forEach((type) => {
      toggleEl.appendChild(
        createTypeButton(type, type.id === currentType, () => {
          currentType = type.id;
          updateTypeToggle();
          updateQuestions();
        }),
      );
    });
  }

  function updateQuestions() {
    const container = document.getElementById("interview-questions-container");
    container.innerHTML = "";

    // Get interview data from presenter
    const interview = interviewsView.interviews[currentType];

    container.appendChild(
      div(
        {},
        // Interview summary
        createInterviewSummary(interview),

        // Questions sections
        createQuestionsDisplay(interview, data.framework),
      ),
    );
  }
}

/**
 * Create type button
 */
function createTypeButton(type, isActive, onClick) {
  const btn = button(
    {
      className: `interview-type-btn ${isActive ? "active" : ""}`,
    },
    span({ className: "interview-type-icon" }, type.icon),
    span({ className: "interview-type-name" }, type.name),
  );

  btn.addEventListener("click", onClick);
  return btn;
}

/**
 * Create interview summary
 */
function createInterviewSummary(interview) {
  const typeInfo = interview.typeInfo;

  return div(
    { className: "interview-summary card" },
    div(
      { className: "interview-summary-header" },
      h2({}, `${typeInfo.icon} ${typeInfo.name}`),
      p({ className: "text-muted" }, typeInfo.description),
      typeInfo.panel
        ? p({ className: "text-muted" }, `Panel: ${typeInfo.panel}`)
        : null,
    ),
    div(
      { className: "interview-summary-stats" },
      createBadge(`${interview.questions.length} questions`, "default"),
      createBadge(`~${interview.expectedDurationMinutes} minutes`, "secondary"),
      interview.coverage.skills?.length > 0
        ? createBadge(
            `${interview.coverage.skills.length} skills covered`,
            "primary",
          )
        : null,
      interview.coverage.behaviours?.length > 0
        ? createBadge(
            `${interview.coverage.behaviours.length} behaviours covered`,
            "primary",
          )
        : null,
      interview.coverage.capabilities?.length > 0
        ? createBadge(
            `${interview.coverage.capabilities.length} capabilities covered`,
            "primary",
          )
        : null,
    ),
  );
}

/**
 * Create questions display
 */
function createQuestionsDisplay(interview, framework) {
  // Group questions by type
  const skillQuestions = interview.questions.filter(
    (q) => q.targetType === "skill",
  );
  const behaviourQuestions = interview.questions.filter(
    (q) => q.targetType === "behaviour",
  );
  const capabilityQuestions = interview.questions.filter(
    (q) => q.targetType === "capability",
  );

  const sections = [];

  if (skillQuestions.length > 0) {
    sections.push(
      createDetailSection({
        title: `${getConceptEmoji(framework, "skill")} Skill Questions (${skillQuestions.length})`,
        content: createQuestionsList(skillQuestions),
      }),
    );
  }

  if (behaviourQuestions.length > 0) {
    sections.push(
      createDetailSection({
        title: `${getConceptEmoji(framework, "behaviour")} Behaviour Questions (${behaviourQuestions.length})`,
        content: createQuestionsList(behaviourQuestions),
      }),
    );
  }

  if (capabilityQuestions.length > 0) {
    sections.push(
      createDetailSection({
        title: `${getConceptEmoji(framework, "capability") || "🧩"} Decomposition Questions (${capabilityQuestions.length})`,
        content: createQuestionsList(capabilityQuestions, true),
      }),
    );
  }

  if (sections.length === 0) {
    return div(
      { className: "card" },
      p(
        { className: "text-muted" },
        "No questions available for this combination. Please check that question data exists for the required skills and behaviours.",
      ),
    );
  }

  return div({}, ...sections);
}

/**
 * Create questions list
 * @param {Array} questions - Questions to display
 * @param {boolean} isDecomposition - Whether these are decomposition questions
 */
function createQuestionsList(questions, isDecomposition = false) {
  return div(
    { className: "questions-list" },
    ...questions.map((q, index) =>
      createQuestionCard(q, index + 1, isDecomposition),
    ),
  );
}

/**
 * Create question card
 * @param {Object} questionEntry - Question entry
 * @param {number} number - Question number
 * @param {boolean} isDecomposition - Whether this is a decomposition question
 */
function createQuestionCard(questionEntry, number, isDecomposition = false) {
  const { question, targetName, targetLevel } = questionEntry;

  // Context section (only for decomposition questions)
  const contextSection =
    question.context && isDecomposition
      ? div(
          { className: "question-context" },
          h4({}, "Context:"),
          p({}, question.context),
        )
      : null;

  // Decomposition prompts (only for decomposition questions)
  const decompositionPromptsList =
    question.decompositionPrompts &&
    question.decompositionPrompts.length > 0 &&
    isDecomposition
      ? div(
          { className: "question-decomposition-prompts" },
          h4({}, "Guide candidate thinking:"),
          ul(
            {},
            ...question.decompositionPrompts.map((prompt) => li({}, prompt)),
          ),
        )
      : null;

  const followUpsList =
    question.followUps && question.followUps.length > 0
      ? div(
          { className: "question-followups" },
          h4({}, "Follow-up questions:"),
          ul({}, ...question.followUps.map((fu) => li({}, fu))),
        )
      : null;

  const lookingForList =
    question.lookingFor && question.lookingFor.length > 0
      ? div(
          { className: "question-looking-for" },
          h4({}, "What to look for:"),
          ul({}, ...question.lookingFor.map((lf) => li({}, lf))),
        )
      : null;

  return div(
    { className: "question-card" },
    div(
      { className: "question-header" },
      span({ className: "question-number" }, `Q${number}`),
      div(
        { className: "question-meta" },
        createBadge(targetName, "default"),
        createBadge(formatLevel(targetLevel), "secondary"),
        question.expectedDurationMinutes
          ? createBadge(`~${question.expectedDurationMinutes} min`, "secondary")
          : null,
      ),
    ),
    div({ className: "question-text" }, question.text),
    contextSection,
    decompositionPromptsList,
    followUpsList,
    lookingForList,
  );
}
