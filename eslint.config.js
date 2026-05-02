import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import security from "eslint-plugin-security";

const universalGlobals = {
  console: "readonly",
  process: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  AbortController: "readonly",
  AbortSignal: "readonly",
  TextEncoder: "readonly",
  TextDecoder: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  queueMicrotask: "readonly",
  structuredClone: "readonly",
  crypto: "readonly",
  performance: "readonly",
  Event: "readonly",
  EventTarget: "readonly",
  Blob: "readonly",
  Response: "readonly",
  Headers: "readonly",
  ReadableStream: "readonly",
  fetch: "readonly",
  btoa: "readonly",
  atob: "readonly",
};

const browserGlobals = {
  document: "readonly",
  window: "readonly",
  history: "readonly",
  location: "readonly",
  localStorage: "readonly",
  navigator: "readonly",
  customElements: "readonly",
  HTMLElement: "readonly",
  ClipboardItem: "readonly",
  IntersectionObserver: "readonly",
  requestAnimationFrame: "readonly",
  confirm: "readonly",
};

const nodeGlobals = {
  global: "readonly",
  Buffer: "readonly",
  require: "readonly",
};

export default [
  js.configs.recommended,
  security.configs.recommended,
  prettierConfig,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...universalGlobals, ...browserGlobals },
    },
    rules: {
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "max-lines": [
        "error",
        { max: 400, skipBlankLines: true, skipComments: true },
      ],
      complexity: ["error", 14],
      "security/detect-buffer-noassert": "error",
      "security/detect-child-process": "error",
      "security/detect-disable-mustache-escape": "error",
      "security/detect-eval-with-expression": "error",
      "security/detect-new-buffer": "error",
      "security/detect-no-csrf-before-method-override": "error",
      "security/detect-non-literal-regexp": "error",
      "security/detect-non-literal-require": "error",
      "security/detect-object-injection": "off",
      "security/detect-non-literal-fs-filename": "off",
      "security/detect-possible-timing-attacks": "error",
      "security/detect-pseudoRandomBytes": "error",
      "security/detect-unsafe-regex": "error",
      "security/detect-bidi-characters": "error",
    },
  },
  {
    files: [
      "libraries/**/*.js",
      "services/**/*.js",
      "products/outpost/**/*.js",
      "products/outpost/**/*.mjs",
    ],
    languageOptions: {
      globals: nodeGlobals,
    },
  },
  {
    ignores: [
      "node_modules/**",
      "tmp/**",
      "**/dist/**",
      "**/generated/**",
      "public/**",
    ],
  },
];
