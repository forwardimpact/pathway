/**
 * Update Command
 *
 * Re-downloads the distribution bundle from the published site URL
 * and updates the local ~/.fit/data/pathway/ installation.
 * Updates the global @forwardimpact/pathway package if the version changed.
 */

import { cp, mkdir, rm, readFile, writeFile, access } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import { execFileSync } from "child_process";
import { tmpdir } from "os";
import { createLogger } from "@forwardimpact/libtelemetry";
import { createDataLoader } from "@forwardimpact/map/loader";

const logger = createLogger("pathway");

const BASE_DIR = join(homedir(), ".fit", "data");
const INSTALL_DIR = join(BASE_DIR, "pathway");

/**
 * Run the update command.
 * Reads siteUrl from the installed framework.yaml, re-downloads the bundle,
 * extracts data, and updates the global pathway package if the version changed.
 *
 * @param {Object} params - Command parameters
 * @param {string} params.dataDir - Path to data directory (may be the installed one)
 * @param {Object} params.options - Command options
 */
export async function runUpdateCommand({ dataDir: _dataDir, options }) {
  // Verify we have a home-directory installation
  try {
    await access(INSTALL_DIR);
  } catch {
    console.error("Error: No local installation found at ~/.fit/data/pathway/");
    console.error(
      "Install first using the install.sh script from your organization's pathway site.",
    );
    process.exit(1);
  }

  // Load framework config to get siteUrl
  const loader = createDataLoader();
  const framework = await loader.loadFrameworkConfig(INSTALL_DIR);
  const siteUrl = options.url || framework.distribution?.siteUrl;

  if (!siteUrl) {
    console.error(
      "Error: No siteUrl found in ~/.fit/data/pathway/framework.yaml (distribution.siteUrl)",
    );
    console.error("Provide one with --url=<URL> or add it to framework.yaml.");
    process.exit(1);
  }

  const baseUrl = siteUrl.replace(/\/$/, "");
  const bundleName = "bundle.tar.gz";

  logger.info(`\n🔄 Updating from ${baseUrl}...\n`);

  // 1. Download bundle to temp location
  const tmpDir = join(tmpdir(), "fit-pathway-update");
  await mkdir(tmpDir, { recursive: true });

  const tmpBundle = join(tmpDir, bundleName);

  try {
    logger.info("   Downloading bundle...");
    execFileSync("curl", [
      "-fsSL",
      `${baseUrl}/${bundleName}`,
      "-o",
      tmpBundle,
    ]);
    logger.info("   ✓ Downloaded");

    // 2. Extract bundle
    logger.info("   Extracting...");
    const extractDir = join(tmpDir, "extracted");
    await mkdir(extractDir, { recursive: true });
    execFileSync("tar", [
      "-xzf",
      tmpBundle,
      "-C",
      extractDir,
      "--strip-components=1",
    ]);
    logger.info("   ✓ Extracted");

    // 3. Compare versions from bundle's package.json (version manifest)
    const newPkgPath = join(extractDir, "package.json");
    const oldPkgPath = join(BASE_DIR, "package.json");
    const newPkg = JSON.parse(await readFile(newPkgPath, "utf8"));
    let oldPkg;
    try {
      oldPkg = JSON.parse(await readFile(oldPkgPath, "utf8"));
    } catch {
      oldPkg = { version: "unknown", dependencies: {} };
    }

    const oldVersion =
      oldPkg.dependencies?.["@forwardimpact/pathway"] || "unknown";
    const newVersion =
      newPkg.dependencies?.["@forwardimpact/pathway"] || "unknown";

    // 4. Replace data
    logger.info("   Updating data files...");
    await rm(INSTALL_DIR, { recursive: true });
    await cp(join(extractDir, "data"), INSTALL_DIR, { recursive: true });
    logger.info("   ✓ Data updated");

    // 5. Update version manifest
    await writeFile(oldPkgPath, JSON.stringify(newPkg, null, 2) + "\n");

    // 6. Update global pathway package if version changed
    if (oldVersion !== newVersion) {
      logger.info(`   Updating pathway ${oldVersion} → ${newVersion}...`);
      execFileSync(
        "npm",
        ["install", "-g", `@forwardimpact/pathway@${newVersion}`],
        {
          stdio: "ignore",
        },
      );
      logger.info("   ✓ Global package updated");
    }

    // 7. Report
    logger.info(`
✅ Update complete!

  Pathway: ${oldVersion === newVersion ? newVersion + " (unchanged)" : oldVersion + " → " + newVersion}
  Data:    updated from ${baseUrl}
`);
  } finally {
    // Clean up temp directory
    await rm(tmpDir, { recursive: true, force: true });
  }
}
