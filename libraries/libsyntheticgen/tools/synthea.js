/**
 * Synthea tool — generates FHIR R4 patient data via Java subprocess.
 */

import { join } from "path";

export class SyntheaTool {
  /**
   * @param {object} deps
   * @param {object} deps.logger
   * @param {string} deps.syntheaJar - Absolute path to synthea-with-dependencies.jar
   * @param {Function} deps.execFileFn - async (cmd, args) => { stdout }
   * @param {object} deps.fsFns - { readFile, readdir, mkdtemp, rm }
   */
  constructor({ logger, syntheaJar, execFileFn, fsFns }) {
    if (!logger) throw new Error("SyntheaTool requires logger");
    if (!syntheaJar) throw new Error("SyntheaTool requires syntheaJar");
    if (!execFileFn) throw new Error("SyntheaTool requires execFileFn");
    if (!fsFns) throw new Error("SyntheaTool requires fsFns");
    this.logger = logger;
    this.syntheaJar = syntheaJar;
    this.execFileFn = execFileFn;
    this.fsFns = fsFns;
  }

  /**
   * Check that Java and the Synthea jar are available.
   * @returns {Promise<boolean>}
   */
  async checkAvailability() {
    try {
      await this.execFileFn("java", ["-version"]);
      await this.fsFns.readFile(this.syntheaJar);
      return true;
    } catch {
      throw new Error(
        `Synthea requires Java and ${this.syntheaJar}. ` +
          "Install Java (java.com) and download Synthea " +
          "(github.com/synthetichealth/synthea/releases). " +
          "Set SYNTHEA_JAR to the jar path.",
      );
    }
  }

  /**
   * Generate FHIR patient data, returning one dataset per resource type.
   * @param {object} config
   * @param {string} config.name - Dataset name from DSL
   * @param {number} [config.population=100] - Number of patients
   * @param {string[]} [config.modules] - Synthea modules to enable
   * @param {number} config.seed - RNG seed
   * @returns {Promise<Dataset[]>}
   */
  async generate(config) {
    const tmpDir = await this.fsFns.mkdtemp("synthea-");
    const args = [
      "-jar",
      this.syntheaJar,
      "-p",
      String(config.population || 100),
      "-s",
      String(config.seed),
      "--exporter.fhir.export",
      "true",
      "--exporter.baseDirectory",
      tmpDir,
    ];
    if (config.modules) {
      for (const mod of config.modules) {
        args.push("-m", mod);
      }
    }

    this.logger.info(
      "synthea",
      `Running Synthea: population=${config.population || 100}`,
    );
    await this.execFileFn("java", args);

    // Read FHIR bundles from output
    const fhirDir = join(tmpDir, "fhir");
    const bundleFiles = (await this.fsFns.readdir(fhirDir)).filter((f) =>
      f.endsWith(".json"),
    );
    const bundles = await Promise.all(
      bundleFiles.map(async (f) =>
        JSON.parse(await this.fsFns.readFile(join(fhirDir, f), "utf-8")),
      ),
    );

    // Flatten bundles into datasets by resource type
    const byType = new Map();
    for (const bundle of bundles) {
      for (const entry of bundle.entry || []) {
        const resource = entry.resource;
        const type = resource.resourceType;
        if (!byType.has(type)) byType.set(type, []);
        byType.get(type).push(resource);
      }
    }

    // Return one dataset per resource type
    const datasets = [];
    for (const [type, records] of byType) {
      datasets.push({
        name: `${config.name}_${type.toLowerCase()}`,
        schema: null,
        records,
        metadata: { tool: "synthea", resourceType: type },
      });
    }

    // Clean up
    await this.fsFns.rm(tmpDir, { recursive: true });

    return datasets;
  }
}

/**
 * @param {object} deps
 * @returns {SyntheaTool}
 */
export function createSyntheaTool(deps) {
  return new SyntheaTool(deps);
}
