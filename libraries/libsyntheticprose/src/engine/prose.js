/**
 * Prose Engine — LLM-assisted prose generation with cache.
 *
 * Uses an LLM client for completions, libutil for cache key hashing,
 * and libprompt for prompt template loading.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { generateHash } from "@forwardimpact/libutil";
import { createLogger } from "@forwardimpact/libtelemetry";
import { PromptLoader } from "@forwardimpact/libprompt";

const __dirname = dirname(fileURLToPath(import.meta.url));

export class ProseEngine {
  /**
   * @param {object} options
   * @param {string} options.cachePath      Path to prose cache JSON file
   * @param {string} options.mode           "cached" | "generate" | "no-prose"
   * @param {boolean} [options.strict]      Fail on cache miss
   * @param {{ createCompletions: Function }} options.llmApi
   *        Pre-configured LLM client — required when mode is "generate"
   * @param {import('@forwardimpact/libprompt').PromptLoader} options.promptLoader
   *        Prompt template loader
   * @param {object} options.logger         Logger instance
   */
  constructor({
    cachePath,
    mode,
    strict = false,
    llmApi,
    promptLoader,
    logger,
  }) {
    if (!cachePath) throw new Error("cachePath is required");
    if (!mode) throw new Error("mode is required");
    if (!promptLoader) throw new Error("promptLoader is required");
    if (!logger) throw new Error("logger is required");
    this.cachePath = cachePath;
    this.mode = mode;
    this.strict = strict;
    this.llmApi = llmApi;
    this.promptLoader = promptLoader;
    this.logger = logger;
    this.cache = this.#loadCache();
    this.dirty = false;
    this.stats = { hits: 0, misses: 0, generated: 0 };
  }

  /**
   * Generate or retrieve prose for a key.
   * @param {string} key
   * @param {object} context
   * @returns {Promise<string|null>}
   */
  async generateProse(key, context) {
    if (this.mode === "no-prose") return null;

    const cacheKey = generateHash(key, JSON.stringify(context));

    if (this.cache.has(cacheKey)) {
      this.stats.hits++;
      return this.cache.get(cacheKey);
    }

    if (this.mode === "cached") {
      this.stats.misses++;
      if (this.strict) throw new Error(`Cache miss: '${key}'`);
      return null;
    }

    // Tier 1: generate via LLM
    const prose = await this.#callLlm(key, context);
    this.stats.generated++;
    if (prose) {
      this.cache.set(cacheKey, prose);
      this.dirty = true;
    }
    return prose;
  }

  /**
   * @param {string} key
   * @param {object} context
   * @returns {Promise<string|null>}
   */
  async #callLlm(key, context) {
    const prompt = this.#buildPrompt(key, context);
    this.logger.info("prose", `Calling LLM: ${key}`);
    const startedAt = Date.now();
    const response = await this.llmApi.createCompletions({
      messages: [
        { role: "system", content: this.promptLoader.load("prose-system") },
        { role: "user", content: prompt },
      ],
      max_tokens: context.maxTokens || 500,
    });
    const elapsedMs = Date.now() - startedAt;
    const content = response.choices?.[0]?.message?.content?.trim() || null;
    this.logger.info("prose", `Generated: ${key}`, {
      chars: content ? content.length : 0,
      ms: elapsedMs,
    });
    return content;
  }

  /**
   * Generate or retrieve a structured response (pre-built messages).
   *
   * Cache key includes both the entity key and the prompt content so
   * that prompt changes automatically invalidate stale entries.
   *
   * @param {string} key - Cache key
   * @param {object[]} messages - Pre-built messages array [{role, content}]
   * @returns {Promise<string|null>}
   */
  async generateStructured(key, messages, { maxTokens = 4000 } = {}) {
    if (this.mode === "no-prose") return null;

    const cacheKey = generateHash(key, JSON.stringify(messages));

    if (this.cache.has(cacheKey)) {
      this.stats.hits++;
      this.logger.debug("prose", `Cache hit: ${key}`);
      return this.cache.get(cacheKey);
    }

    if (this.mode === "cached") {
      this.stats.misses++;
      if (this.strict) throw new Error(`Cache miss: '${key}'`);
      return null;
    }

    this.logger.info("prose", `Calling LLM: ${key}`);
    const startedAt = Date.now();
    const response = await this.llmApi.createCompletions({
      messages,
      max_tokens: maxTokens,
    });
    const elapsedMs = Date.now() - startedAt;
    const content = response.choices?.[0]?.message?.content?.trim() || null;
    this.stats.generated++;
    if (content) {
      this.cache.set(cacheKey, content);
      this.dirty = true;
      this.saveCache();
    }
    this.logger.info("prose", `Generated: ${key}`, {
      chars: content ? content.length : 0,
      ms: elapsedMs,
    });
    return content;
  }

  /**
   * Generate structured output and parse as JSON.
   * @param {string} key - Cache key
   * @param {object[]} messages - Pre-built messages array
   * @returns {Promise<object|null>}
   */
  async generateJson(key, messages, options) {
    const raw = await this.generateStructured(key, messages, options);
    if (!raw) return null;
    const cleaned = raw
      .replace(/^```(?:json)?\s*\n?/m, "")
      .replace(/\n?```\s*$/m, "")
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch (err) {
      this.logger.error(
        "prose",
        `Failed to parse JSON for ${key} (likely truncated): ${err.message}`,
        { chars: cleaned.length, tail: cleaned.slice(-200) },
      );
      throw new Error(
        `Failed to parse JSON for ${key} (${cleaned.length} chars): ${err.message}`,
      );
    }
  }

  /** @returns {Map<string, string>} */
  getProseMap() {
    return this.cache;
  }

  saveCache() {
    if (!this.dirty || !this.cachePath) return;
    writeFileSync(
      this.cachePath,
      JSON.stringify(Object.fromEntries(this.cache), null, 2),
    );
    this.dirty = false;
  }

  /**
   * Build a prompt from key and context.
   * @param {string} key
   * @param {object} context
   * @returns {string}
   */
  #buildPrompt(key, context) {
    return this.promptLoader.render("prose-user", {
      topic: context.topic || key.replace(/_/g, " ").replace(/-/g, " "),
      tone: context.tone || "technical",
      length: context.length || "2-3 paragraphs",
      domain: context.domain,
      orgName: context.orgName,
      role: context.role,
      audience: context.audience,
      scenario: context.scenario,
      driver: context.driver,
      direction: context.direction,
      magnitude: context.magnitude,
    });
  }

  #loadCache() {
    try {
      if (this.cachePath && existsSync(this.cachePath)) {
        return new Map(
          Object.entries(JSON.parse(readFileSync(this.cachePath, "utf-8"))),
        );
      }
    } catch {
      /* cache corrupt or missing */
    }
    return new Map();
  }
}

/**
 * Creates a ProseEngine with real dependencies wired.
 * @param {object} options
 * @param {string} options.cachePath - Path to prose cache JSON file
 * @param {string} options.mode - "cached" | "generate" | "no-prose"
 * @param {boolean} [options.strict] - Fail on cache miss
 * @param {{ createCompletions: Function }} [options.llmApi] - LLM client
 * @returns {ProseEngine}
 */
export function createProseEngine(options) {
  const logger = createLogger("terrain");
  const promptLoader = new PromptLoader(join(__dirname, "..", "prompts"));
  return new ProseEngine({ ...options, promptLoader, logger });
}
