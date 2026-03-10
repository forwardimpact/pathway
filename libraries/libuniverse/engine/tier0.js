/**
 * Tier 0 — Deterministic Entity & Activity Generation (no LLM).
 *
 * @module libuniverse/engine/tier0
 */

import { createSeededRNG } from './rng.js'
import { buildEntities } from './entities.js'
import { generateActivity } from './activity.js'

/**
 * Generate all entities and activity from a parsed AST.
 * @param {import('../dsl/parser.js').UniverseAST} ast
 * @returns {object} Entity graph with activity data
 */
export function generate(ast) {
  const rng = createSeededRNG(ast.seed)
  const { orgs, departments, teams, people, projects } = buildEntities(ast, rng)
  const activity = generateActivity(ast, rng, people, teams)

  return {
    orgs, departments, teams, people, projects,
    scenarios: ast.scenarios,
    snapshots: ast.snapshots,
    framework: ast.framework,
    content: ast.content,
    activity,
    domain: ast.domain,
  }
}

