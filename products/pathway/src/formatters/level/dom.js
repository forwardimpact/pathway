/**
 * Level formatting for DOM output
 */

import {
  div,
  heading1,
  heading2,
  p,
  span,
  table,
  tbody,
  thead,
  tr,
  th,
  td,
  formatLevel,
} from "../../lib/render.js";
import { createBackLink } from "../../components/nav.js";
import { createLevelDots } from "../../components/detail.js";
import {
  SKILL_PROFICIENCY_ORDER,
  BEHAVIOUR_MATURITY_ORDER,
  getConceptEmoji,
} from "@forwardimpact/map/levels";
import { createJobBuilderButton } from "../../components/action-buttons.js";
import { prepareLevelDetail } from "./shared.js";
import { createJsonLdScript, levelToJsonLd } from "../json-ld.js";

/**
 * Format level detail as DOM elements
 * @param {Object} level - Raw level entity
 * @param {Object} options - Formatting options
 * @param {Object} [options.framework] - Framework config for emojis
 * @param {boolean} [options.showBackLink=true] - Whether to show back navigation link
 * @returns {HTMLElement}
 */
export function levelToDOM(level, { framework, showBackLink = true } = {}) {
  const view = prepareLevelDetail(level);
  const emoji = framework ? getConceptEmoji(framework, "level") : "📊";
  return div(
    { className: "detail-page level-detail" },
    // JSON-LD structured data
    createJsonLdScript(levelToJsonLd(level)),
    // Header
    div(
      { className: "page-header" },
      showBackLink ? createBackLink("/level", "← Back to Levels") : null,
      heading1({ className: "page-title" }, `${emoji} `, view.displayName),
      div(
        { className: "page-meta" },
        span({ className: "badge badge-default" }, view.id),
      ),
      view.typicalExperienceRange
        ? p(
            { className: "page-description" },
            `Typical experience: ${view.typicalExperienceRange}`,
          )
        : null,
      showBackLink
        ? div(
            { className: "page-actions" },
            createJobBuilderButton({
              paramName: "level",
              paramValue: level.id,
            }),
          )
        : null,
    ),

    // Titles section
    view.professionalTitle || view.managementTitle
      ? div(
          { className: "detail-section" },
          heading2({ className: "section-title" }, "Titles"),
          div(
            { className: "content-columns" },
            view.professionalTitle
              ? div(
                  { className: "card" },
                  p({ className: "label" }, "Professional Track"),
                  p({ className: "card-description" }, view.professionalTitle),
                )
              : null,
            view.managementTitle
              ? div(
                  { className: "card" },
                  p({ className: "label" }, "Management Track"),
                  p({ className: "card-description" }, view.managementTitle),
                )
              : null,
          ),
        )
      : null,

    // Expectations
    view.expectations && Object.keys(view.expectations).length > 0
      ? div(
          { className: "detail-section" },
          heading2({ className: "section-title" }, "Expectations"),
          div(
            { className: "content-columns" },
            ...Object.entries(view.expectations).map(([key, value]) =>
              div(
                { className: "card" },
                p({ className: "label" }, formatLevel(key)),
                p({ className: "card-description" }, value),
              ),
            ),
          ),
        )
      : null,

    // Base Skill Proficiencies and Base Behaviour Maturity in two columns
    div(
      { className: "detail-section" },
      div(
        { className: "content-columns" },
        // Base Skill Proficiencies column
        div(
          { className: "column" },
          heading2({ className: "section-title" }, "Base Skill Proficiencies"),
          table(
            { className: "level-table" },
            thead({}, tr({}, th({}, "Type"), th({}, "Level"))),
            tbody(
              {},
              tr(
                {},
                td({}, span({ className: "badge badge-primary" }, "Primary")),
                td(
                  {},
                  view.baseSkillProficiencies?.primary
                    ? createLevelDots(
                        SKILL_PROFICIENCY_ORDER.indexOf(
                          view.baseSkillProficiencies.primary,
                        ),
                        SKILL_PROFICIENCY_ORDER.length,
                      )
                    : span({ className: "text-muted" }, "—"),
                ),
              ),
              tr(
                {},
                td(
                  {},
                  span({ className: "badge badge-secondary" }, "Secondary"),
                ),
                td(
                  {},
                  view.baseSkillProficiencies?.secondary
                    ? createLevelDots(
                        SKILL_PROFICIENCY_ORDER.indexOf(
                          view.baseSkillProficiencies.secondary,
                        ),
                        SKILL_PROFICIENCY_ORDER.length,
                      )
                    : span({ className: "text-muted" }, "—"),
                ),
              ),
              tr(
                {},
                td({}, span({ className: "badge badge-broad" }, "Broad")),
                td(
                  {},
                  view.baseSkillProficiencies?.broad
                    ? createLevelDots(
                        SKILL_PROFICIENCY_ORDER.indexOf(
                          view.baseSkillProficiencies.broad,
                        ),
                        SKILL_PROFICIENCY_ORDER.length,
                      )
                    : span({ className: "text-muted" }, "—"),
                ),
              ),
            ),
          ),
        ),
        // Base Behaviour Maturity column
        div(
          { className: "column" },
          heading2({ className: "section-title" }, "Base Behaviour Maturity"),
          view.baseBehaviourMaturity
            ? table(
                { className: "level-table" },
                thead({}, tr({}, th({}, "Maturity"), th({}, "Level"))),
                tbody(
                  {},
                  tr(
                    {},
                    td(
                      {},
                      view.baseBehaviourMaturity.charAt(0).toUpperCase() +
                        view.baseBehaviourMaturity.slice(1),
                    ),
                    td(
                      {},
                      createLevelDots(
                        BEHAVIOUR_MATURITY_ORDER.indexOf(
                          view.baseBehaviourMaturity,
                        ),
                        BEHAVIOUR_MATURITY_ORDER.length,
                      ),
                    ),
                  ),
                ),
              )
            : p({ className: "text-muted" }, "—"),
        ),
      ),
    ),
  );
}
