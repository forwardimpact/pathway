/**
 * Bundle generation for Pathway distribution.
 *
 * Emits `bundle.tar.gz` and `install.sh` alongside the static site so
 * engineers can install `@forwardimpact/pathway` globally via
 * `curl -fsSL <site>/install.sh | bash`. Invoked from build.js when
 * `framework.distribution.siteUrl` is configured.
 */

import { cp, mkdir, rm, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { execFileSync } from "child_process";
import Mustache from "mustache";

/**
 * Generate distribution bundle (bundle.tar.gz + install.sh)
 * @param {Object} params
 * @param {string} params.outputDir - Build output directory
 * @param {string} params.dataDir - Source data directory
 * @param {string} params.siteUrl - Base URL for the published site
 * @param {Object} params.framework - Framework configuration
 * @param {string} params.version - Pathway package version
 * @param {string} params.templatesDir - Absolute path to pathway/templates
 */
export async function generateBundle({
  outputDir,
  dataDir,
  siteUrl,
  framework,
  version,
  templatesDir,
}) {
  console.log("📦 Generating distribution bundle...");

  const frameworkTitle = framework.title || "Engineering Pathway";

  // 1. Create temporary bundle directory
  const bundleDir = join(outputDir, "_bundle");
  await mkdir(bundleDir, { recursive: true });

  // 2. Generate minimal package.json for the bundle
  const bundlePkg = {
    name: "fit-pathway-local",
    version: version,
    private: true,
    dependencies: {
      "@forwardimpact/pathway": `^${version}`,
    },
  };
  await writeFile(
    join(bundleDir, "package.json"),
    JSON.stringify(bundlePkg, null, 2) + "\n",
  );
  console.log(`   ✓ package.json (pathway ^${version})`);

  // 3. Copy data files into bundle
  await cp(dataDir, join(bundleDir, "data"), {
    recursive: true,
    dereference: true,
  });
  console.log("   ✓ data/");

  // 4. Create tar.gz from the bundle directory
  execFileSync("tar", [
    "-czf",
    join(outputDir, "bundle.tar.gz"),
    "-C",
    outputDir,
    "_bundle",
  ]);
  console.log("   ✓ bundle.tar.gz");

  // 5. Clean up temporary bundle directory
  await rm(bundleDir, { recursive: true });

  // 6. Render install.sh from template
  const templatePath = join(templatesDir, "install.template.sh");
  const template = await readFile(templatePath, "utf8");
  const installScript = Mustache.render(template, {
    siteUrl: siteUrl.replace(/\/$/, ""),
    version,
    frameworkTitle,
  });
  await writeFile(join(outputDir, "install.sh"), installScript, {
    mode: 0o755,
  });
  console.log("   ✓ install.sh");
}
