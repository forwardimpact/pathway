import { tokenize } from './tokenizer.js'
import { parse } from './parser.js'

/**
 * Parse universe DSL source into an AST.
 * @param {string} source - DSL source text
 * @returns {import('./parser.js').UniverseAST}
 */
export function parseUniverse(source) {
  const tokens = tokenize(source)
  return parse(tokens)
}
