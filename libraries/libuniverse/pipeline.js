/**
 * Pipeline orchestrator — parse → generate → prose → render → validate.
 *
 * @module libuniverse/pipeline
 */

import { readFile } from 'fs/promises'
import { join } from 'path'
import { parseUniverse } from './dsl/index.js'
import { generate } from './engine/tier0.js'
import { collectProseKeys } from './engine/prose-keys.js'
import { ProseEngine } from './engine/prose.js'
import { renderHTML, renderREADME, renderONTOLOGY } from './render/html.js'
import { renderYAML } from './render/yaml.js'
import { renderRawDocuments } from './render/raw.js'
import { renderMarkdown } from './render/markdown.js'
import { validateCrossContent } from './validate.js'

/**
 * Run the full generation pipeline.
 *
 * @param {object} options
 * @param {string} options.universePath - Path to the universe.dsl file
 * @param {string} options.dataDir - Output base directory for framework files
 * @param {string} [options.mode='no-prose'] - Prose mode: no-prose, cached, generate
 * @param {boolean} [options.strict=false] - Fail on cache miss in cached mode
 * @param {string|null} [options.only=null] - Render only a specific content type
 * @param {object|null} [options.llmApi=null] - LLM API instance for prose generation
 * @param {string} [options.cachePath] - Path to .prose-cache.json
 * @returns {Promise<{files: Map<string,string>, rawDocuments: Map<string,string>, entities: object, validation: object}>}
 */
export async function runPipeline(options) {
  const {
    universePath,
    dataDir,
    mode = 'no-prose',
    strict = false,
    only = null,
    llmApi = null,
    cachePath,
  } = options

  // 1. Parse DSL
  const source = await readFile(universePath, 'utf-8')
  const ast = parseUniverse(source)

  // 2. Generate entity graph (Tier 0)
  const entities = generate(ast)

  // 3. Prose generation (Tier 1/2)
  const proseKeys = collectProseKeys(entities)
  const proseEngine = new ProseEngine({ llmApi, cachePath, mode, strict })
  const prose = new Map()
  for (const [key, context] of proseKeys) {
    const result = await proseEngine.generateProse(key, context)
    if (result) prose.set(key, result)
  }
  proseEngine.saveCache()

  // 4. Render outputs
  const files = new Map()
  const rawDocuments = new Map()

  const shouldRender = (type) => !only || only === type

  if (shouldRender('html')) {
    const html = renderHTML(entities, prose)
    for (const [name, content] of html) {
      files.set(join('examples/organizational', name), content)
    }
    files.set('examples/organizational/README.md', renderREADME(entities, prose))
    files.set('examples/organizational/ONTOLOGY.md', renderONTOLOGY(entities))
  }

  if (shouldRender('yaml')) {
    const yaml = renderYAML(entities)
    for (const [name, content] of yaml) {
      files.set(join('examples/framework', name), content)
    }
  }

  if (shouldRender('raw')) {
    const raw = renderRawDocuments(entities)
    for (const [path, content] of raw) {
      rawDocuments.set(path, content)
    }
  }

  if (shouldRender('markdown')) {
    const md = renderMarkdown(entities, prose)
    for (const [name, content] of md) {
      files.set(join('examples/personal', name), content)
    }
  }

  // 5. Validate
  const validation = validateCrossContent(entities)

  return { files, rawDocuments, entities, validation }
}
