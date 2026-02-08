---
name: playwright-e2e
description:
  "Run and write Playwright E2E tests. Use when adding end-to-end tests,
  debugging test failures, or verifying web app behavior in the browser."
---

# Playwright E2E Testing

Run and write end-to-end tests for the Engineering Pathway web application using
Playwright.

## When to Use

- Adding new E2E tests for web app features
- Debugging E2E test failures
- Verifying that pages render correctly after changes
- Testing user flows (navigation, form interactions, data loading)

## Setup

### Install Browsers

Playwright requires browser binaries. Install them before running tests:

```sh
npx playwright install --with-deps
```

If `--with-deps` fails (common in sandboxed environments due to apt/GPG
issues), install the browser only:

```sh
npx playwright install chromium
```

### Sandboxed / Container Environments

When running in Docker, CI containers, or restricted environments, Chromium may
crash or timeout due to missing permissions. The `playwright.config.js` includes
launch args to handle this:

- `--no-sandbox` — disables Chromium's sandbox (required in most containers)
- `--disable-setuid-sandbox` — disables setuid sandbox
- `--disable-dev-shm-usage` — uses `/tmp` instead of `/dev/shm` for shared
  memory (avoids "Page crashed" errors when `/dev/shm` is too small)

If Chromium crashes with `Creating shared memory failed: Permission denied`,
ensure `/tmp` has correct permissions:

```sh
chmod 1777 /tmp
```

### Proxy Environments

The app loads external CDN resources (fonts, JS libraries). If the environment
uses an HTTP proxy, the `playwright.config.js` auto-detects `HTTPS_PROXY` /
`HTTP_PROXY` environment variables and configures the browser proxy. Localhost
requests bypass the proxy automatically.

If CDN resources fail to load through the proxy, the page may show a loading
spinner indefinitely. This does not affect the Playwright infrastructure
itself — it means external resources are unreachable from the browser.

## Running Tests

```sh
# Run all E2E tests
npm run test:e2e

# Run a single test file
npx playwright test tests/landing.spec.js

# Run with visible browser (headed mode)
npx playwright test --headed

# Run with debug inspector
npx playwright test --debug

# Show HTML report after failures
npx playwright show-report
```

## Configuration

The config lives at `playwright.config.js` in the repository root:

| Setting              | Value                    | Notes                                    |
| -------------------- | ------------------------ | ---------------------------------------- |
| `testDir`            | `./tests`                | All E2E tests live here                  |
| `testMatch`          | `*.spec.js`              | Distinguishes E2E from unit tests        |
| `timeout`            | 30000ms                  | Per-test timeout                         |
| `expect.timeout`     | 5000ms                   | Assertion timeout                        |
| `baseURL`            | `http://localhost:3000/`  | App URL                                  |
| `trace`              | `on-first-retry`         | Captures trace on retry for debugging    |
| `fullyParallel`      | `true`                   | Tests run in parallel                    |
| `retries`            | 2 in CI, 0 locally       | Auto-retry flaky tests in CI             |
| `workers`            | 1 in CI, auto locally    | Single worker in CI for stability        |
| `webServer.command`  | `npm start`              | Auto-starts the dev server               |

The `webServer` block automatically runs `npm start` (which builds the site and
serves it) before tests. It reuses an existing server locally but starts fresh
in CI.

## Test Structure

Tests live in `tests/` and use the `*.spec.js` naming convention. Unit tests in
the same directory use `*.test.js` and are run separately via `npm test`.

### File Overview

| File                   | Tests                                              |
| ---------------------- | -------------------------------------------------- |
| `landing.spec.js`      | Landing page loads, h1 renders, no JS errors       |
| `navigation.spec.js`   | Hash-based routing, nav links, page transitions    |
| `job-builder.spec.js`  | Form interactions, discipline/grade/track selection |
| `data-loading.spec.js` | Skills list loads, capability grouping, detail nav  |

### Writing a New Test

```js
import { test, expect } from "@playwright/test";

test("descriptive test name", async ({ page }) => {
  const errors = [];

  // Collect JS errors to catch regressions
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });

  // Navigate using relative paths (baseURL is set in config)
  await page.goto("./#/your-page");

  // Wait for JS-rendered content (the app renders via JavaScript)
  await expect(page.locator("h1")).toContainText("Expected Title");

  // Interact with elements
  await page.selectOption("#some-select", "value");
  await page.click("#some-button");

  // Assert visibility and content
  await expect(page.locator(".result")).toBeVisible();
  await expect(page.locator(".result")).toContainText("expected text");

  // Always verify no JS errors occurred
  expect(errors).toEqual([]);
});
```

### Key Patterns

1. **Error collection** — Every test listens for `pageerror` events and asserts
   no JS errors occurred. This catches runtime regressions.

2. **Relative URLs** — Use `"./"` and `"./#/route"` instead of absolute URLs.
   The `baseURL` in config handles the rest.

3. **Wait for rendering** — The app renders content via JavaScript. Use
   `expect(locator).toContainText()` which auto-waits, rather than manual
   `waitForSelector` calls.

4. **Hash-based routing** — The app uses hash routing (`#/discipline`,
   `#/skill`, etc.). Navigate with `page.goto("./#/route")`.

5. **Data from examples** — Tests use entity IDs from `apps/schema/examples/`.
   If example data changes, tests may need updating.

## CI Integration

E2E tests run in GitHub Actions (`.github/workflows/check.yml`) as the `e2e`
job, which depends on unit tests passing first:

```yaml
e2e:
  runs-on: ubuntu-latest
  needs: test
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 22
        cache: npm
    - run: npm ci
    - run: npx playwright install --with-deps
    - run: npm run generate-index
    - run: npm run test:e2e
```

## Debugging Failures

1. **Run with trace** — Failed tests in CI capture a trace. Download the trace
   artifact and view with `npx playwright show-trace trace.zip`.

2. **Run headed** — Use `npx playwright test --headed` to watch the browser.

3. **Use debug mode** — `npx playwright test --debug` opens the Playwright
   Inspector with step-by-step execution.

4. **Check console errors** — If a page doesn't render, check for failed CDN
   requests or JS errors in the test output. The `pageerror` listener catches
   runtime errors.

5. **Timeout on `browserContext.newPage`** — Usually means Chromium can't start.
   Check that `--no-sandbox` is set and `/tmp` is writable.

6. **"Page crashed"** — Chromium shared memory issue. Add
   `--disable-dev-shm-usage` to launch args or fix `/tmp` permissions with
   `chmod 1777 /tmp`.

7. **Content not found but page loads** — The app depends on external CDN
   resources (mustache, yaml, fonts). If those fail to load, JS modules won't
   initialize and the page stays in a loading state.
