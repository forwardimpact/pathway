import { mkdir, rm } from "fs/promises";
import { join } from "path";

export class PackBuilder {
  #stager;
  #emitters;

  constructor({ stager, emitters }) {
    this.#stager = stager;
    this.#emitters = emitters;
  }

  async build({ combinations, outputDir, version }) {
    const stagingDir = join(outputDir, "_packs");
    const packsDir = join(outputDir, "packs");
    await mkdir(stagingDir, { recursive: true });
    await mkdir(packsDir, { recursive: true });

    const allPackEntries = [];

    for (const combo of combinations) {
      const fullDir = join(stagingDir, combo.name);
      const apmDir = join(stagingDir, `${combo.name}-apm`);

      await mkdir(fullDir, { recursive: true });
      await mkdir(apmDir, { recursive: true });

      await this.#stager.stageFull(fullDir, combo.content);
      await this.#stager.stageApm(fullDir, apmDir, combo.name, version);

      await this.#emitters.tar.emit(
        fullDir,
        join(packsDir, `${combo.name}.raw.tar.gz`),
      );
      await this.#emitters.tar.emit(
        apmDir,
        join(packsDir, `${combo.name}.apm.tar.gz`),
      );
      await this.#emitters.git.emit(
        apmDir,
        join(packsDir, `${combo.name}.apm.git`),
        { version, name: combo.name },
      );

      const skillsSrcDir = this.#stager.skillsDir(fullDir);
      const entries = await this.#emitters.disc.emit(
        skillsSrcDir,
        join(packsDir, combo.name),
      );
      await this.#emitters.git.emit(
        skillsSrcDir,
        join(packsDir, `${combo.name}.skills.git`),
        { version, name: combo.name },
      );

      allPackEntries.push({ packName: combo.name, entries });
    }

    await this.#emitters.disc.emitAggregate(packsDir, allPackEntries);
    await rm(stagingDir, { recursive: true, force: true });

    return {
      packs: combinations.map((c) => ({ name: c.name, description: c.description })),
    };
  }
}
