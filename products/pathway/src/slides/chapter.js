/**
 * Chapter Slide View
 *
 * Displays chapter cover slides for each section.
 */

import { div, h1, p, span } from "../lib/render.js";

/**
 * Render chapter slide
 * @param {Object} params
 * @param {Function} params.render
 * @param {Object} params.data
 * @param {Object} params.params
 */
export function renderChapterSlide({ render, data, params }) {
  const { chapter } = params;
  const { standard } = data;

  const chapterConfig = {
    driver: {
      title: standard.entityDefinitions.driver.title,
      emojiIcon: standard.entityDefinitions.driver.emojiIcon,
      description: standard.entityDefinitions.driver.description,
    },
    skill: {
      title: standard.entityDefinitions.skill.title,
      emojiIcon: standard.entityDefinitions.skill.emojiIcon,
      description: standard.entityDefinitions.skill.description,
    },
    behaviour: {
      title: standard.entityDefinitions.behaviour.title,
      emojiIcon: standard.entityDefinitions.behaviour.emojiIcon,
      description: standard.entityDefinitions.behaviour.description,
    },
    discipline: {
      title: standard.entityDefinitions.discipline.title,
      emojiIcon: standard.entityDefinitions.discipline.emojiIcon,
      description: standard.entityDefinitions.discipline.description,
    },
    level: {
      title: standard.entityDefinitions.level.title,
      emojiIcon: standard.entityDefinitions.level.emojiIcon,
      description: standard.entityDefinitions.level.description,
    },
    track: {
      title: standard.entityDefinitions.track.title,
      emojiIcon: standard.entityDefinitions.track.emojiIcon,
      description: standard.entityDefinitions.track.description,
    },
    job: {
      title: standard.entityDefinitions.job.title,
      emojiIcon: standard.entityDefinitions.job.emojiIcon,
      description: standard.entityDefinitions.job.description,
    },
  };

  const config = chapterConfig[chapter];

  if (!config) {
    render(
      div(
        { className: "slide-error" },
        h1({}, "Chapter Not Found"),
        p({}, `No chapter found with ID: ${chapter}`),
      ),
    );
    return;
  }

  const slide = div(
    { className: "slide chapter-cover" },
    h1(
      { className: "chapter-title" },
      config.emojiIcon ? `${config.emojiIcon} ` : "",
      span({ className: "gradient-text" }, config.title),
    ),
    p({ className: "chapter-description" }, config.description.trim()),
  );

  render(slide);
}
