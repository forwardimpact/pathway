/**
 * Level Slide View
 *
 * Printer-friendly view of a level.
 */

import { div, h1, p } from "../lib/render.js";
import { levelToDOM } from "../formatters/index.js";

/**
 * Render level slide
 * @param {Object} params
 * @param {Function} params.render
 * @param {Object} params.data
 * @param {Object} params.params
 */
export function renderLevelSlide({ render, data, params }) {
  const level = data.levels.find((g) => g.id === params.id);

  if (!level) {
    render(
      div(
        { className: "slide-error" },
        h1({}, "Level Not Found"),
        p({}, `No level found with ID: ${params.id}`),
      ),
    );
    return;
  }

  render(levelToDOM(level, { framework: data.framework, showBackLink: false }));
}
