/**
 * Organization People Ingestion
 *
 * Imports people from CSV or YAML into activity.organization_people.
 * Validates discipline, level, and track against framework data.
 */

import { readFile } from "fs/promises";
import { parse as parseYaml } from "yaml";
import { loadAllData } from "../../src/loader.js";

/**
 * Parse a CSV string into an array of objects using the header row as keys.
 * @param {string} csv - CSV content
 * @returns {Array<Object>} Array of row objects
 */
function parseCsv(csv) {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    return Object.fromEntries(headers.map((h, i) => [h, values[i] || null]));
  });
}

/**
 * Load people from a file (CSV or YAML).
 * @param {string} filePath - Path to the people file
 * @returns {Promise<Array<Object>>} Array of person objects
 */
export async function loadPeopleFile(filePath) {
  const content = await readFile(filePath, "utf-8");

  if (filePath.endsWith(".yaml") || filePath.endsWith(".yml")) {
    const data = parseYaml(content);
    return Array.isArray(data) ? data : data.people || [];
  }

  if (filePath.endsWith(".csv")) {
    return parseCsv(content);
  }

  throw new Error(`Unsupported file format: ${filePath}. Use .yaml or .csv`);
}

/**
 * Validate people against framework data.
 * Checks that discipline, level, and track values exist in the framework.
 * @param {Array<Object>} people - Array of person objects
 * @param {string} dataDir - Path to framework data directory
 * @returns {Promise<{valid: Array<Object>, errors: Array<{row: number, message: string}>}>}
 */
export async function validatePeople(people, dataDir) {
  const data = await loadAllData(dataDir, { validate: false });

  const disciplineIds = new Set(data.disciplines.map((d) => d.id));
  const levelIds = new Set(data.levels.map((l) => l.id));
  const trackIds = new Set(data.tracks.map((t) => t.id));

  const valid = [];
  const errors = [];

  for (let i = 0; i < people.length; i++) {
    const person = people[i];
    const rowErrors = [];

    if (!person.email) {
      rowErrors.push("missing email");
    }
    if (!person.name) {
      rowErrors.push("missing name");
    }
    if (!person.discipline) {
      rowErrors.push("missing discipline");
    } else if (!disciplineIds.has(person.discipline)) {
      rowErrors.push(`unknown discipline: ${person.discipline}`);
    }
    if (!person.level) {
      rowErrors.push("missing level");
    } else if (!levelIds.has(person.level)) {
      rowErrors.push(`unknown level: ${person.level}`);
    }
    if (person.track && !trackIds.has(person.track)) {
      rowErrors.push(`unknown track: ${person.track}`);
    }

    if (rowErrors.length > 0) {
      errors.push({ row: i + 1, message: rowErrors.join("; ") });
    } else {
      valid.push({
        email: person.email,
        name: person.name,
        github_username: person.github_username || null,
        discipline: person.discipline,
        level: person.level,
        track: person.track || null,
        manager_email: person.manager_email || null,
      });
    }
  }

  return { valid, errors };
}

/**
 * Import people into Supabase.
 * Upserts rows into activity.organization_people.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Supabase client
 * @param {Array<Object>} people - Validated person objects
 * @returns {Promise<{imported: number, errors: Array<string>}>}
 */
export async function importPeople(supabase, people) {
  const errors = [];
  let imported = 0;

  // Insert in dependency order: people without managers first, then with managers.
  // This avoids foreign key violations on manager_email.
  const withoutManager = people.filter((p) => !p.manager_email);
  const withManager = people.filter((p) => p.manager_email);

  for (const batch of [withoutManager, withManager]) {
    if (batch.length === 0) continue;

    const { error } = await supabase.from("organization_people").upsert(
      batch.map((p) => ({ ...p, updated_at: new Date().toISOString() })),
      { onConflict: "email" },
    );

    if (error) {
      errors.push(error.message);
    } else {
      imported += batch.length;
    }
  }

  return { imported, errors };
}
