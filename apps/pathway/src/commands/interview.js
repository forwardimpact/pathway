/**
 * Interview CLI Command
 *
 * Generates and displays interview questions in the terminal.
 *
 * Usage:
 *   npx pathway interview <discipline> <grade>                    # Interview for trackless job
 *   npx pathway interview <discipline> <grade> --track=<track>    # Interview with track
 *   npx pathway interview <discipline> <grade> --track=<track> --type=short
 */

import { createCompositeCommand } from "./command-factory.js";
import {
  prepareInterviewDetail,
  INTERVIEW_TYPES,
} from "../formatters/interview/shared.js";
import { interviewToMarkdown } from "../formatters/interview/markdown.js";

/**
 * Format interview output
 * @param {Object} view - Presenter view
 * @param {Object} options - Options including framework
 */
function formatInterview(view, options) {
  console.log(interviewToMarkdown(view, { framework: options.framework }));
}

export const runInterviewCommand = createCompositeCommand({
  commandName: "interview",
  requiredArgs: ["discipline_id", "grade_id"],
  findEntities: (data, args, options) => {
    const interviewType = options.type || "full";

    if (!INTERVIEW_TYPES[interviewType]) {
      console.error(`Unknown interview type: ${interviewType}`);
      console.error("Available types: full, short, behaviour");
      process.exit(1);
    }

    return {
      discipline: data.disciplines.find((d) => d.id === args[0]),
      grade: data.grades.find((g) => g.id === args[1]),
      track: options.track
        ? data.tracks.find((t) => t.id === options.track)
        : null,
      interviewType,
    };
  },
  validateEntities: (entities, _data, options) => {
    if (!entities.discipline) {
      return `Discipline not found: ${entities.discipline}`;
    }
    if (!entities.grade) {
      return `Grade not found: ${entities.grade}`;
    }
    if (options.track && !entities.track) {
      return `Track not found: ${options.track}`;
    }
    return null;
  },
  presenter: (entities, data, _options) =>
    prepareInterviewDetail({
      discipline: entities.discipline,
      grade: entities.grade,
      track: entities.track,
      skills: data.skills,
      behaviours: data.behaviours,
      questions: data.questions,
      interviewType: entities.interviewType,
    }),
  formatter: (view, options, data) =>
    formatInterview(view, { ...options, framework: data.framework }),
  usageExample:
    "npx pathway interview software_engineering L4 --track=platform --type=short",
});
