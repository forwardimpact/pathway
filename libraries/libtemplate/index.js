/**
 * Template Loader
 *
 * Loads Mustache templates with a two-tier resolution order:
 * 1. {dataDir}/templates/{name} — user customization
 * 2. {packageDir}/templates/{name} — package defaults
 *
 * @module libtemplate
 */

import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

/**
 * Create a template loader bound to a package's default templates directory.
 * @param {string} defaultsDir - Absolute path to the package's templates/ folder
 * @returns {{ load: (name: string, dataDir?: string) => Promise<string> }}
 */
export function createTemplateLoader(defaultsDir) {
  /**
   * Load a template file with fallback to package defaults.
   * @param {string} name - Template filename (e.g., 'agent.template.md')
   * @param {string} [dataDir] - Optional data directory for user overrides
   * @returns {Promise<string>} Template content
   * @throws {Error} If template not found in either location
   */
  async function load(name, dataDir) {
    const paths = []
    if (dataDir) paths.push(join(dataDir, 'templates', name))
    paths.push(join(defaultsDir, name))

    for (const path of paths) {
      if (existsSync(path)) return readFile(path, 'utf-8')
    }

    throw new Error(
      `Template '${name}' not found. Checked:\n` +
      paths.map(p => `  - ${p}`).join('\n')
    )
  }

  return { load }
}
