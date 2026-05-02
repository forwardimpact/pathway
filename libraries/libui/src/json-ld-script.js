/**
 * JSON-LD script helper — mints @id through a descriptor's graph formatter.
 */

/**
 * @param {((ctx: import('./invocation-context.js').InvocationContext, vocabularyBase: string) => string)|undefined} graphFormatter
 * @param {import('./invocation-context.js').InvocationContext} ctx
 * @param {Object} body
 * @param {{ vocabularyBase: string }} options
 * @returns {HTMLScriptElement|null}
 */
export function createJsonLdScript(
  graphFormatter,
  ctx,
  body,
  { vocabularyBase },
) {
  if (!graphFormatter) return null;
  const id = graphFormatter(ctx, vocabularyBase);
  const payload = { "@context": vocabularyBase, "@id": id, ...body };
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(payload);
  return script;
}
