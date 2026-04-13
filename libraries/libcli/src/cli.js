import { parseArgs } from "node:util";
import { HelpRenderer } from "./help.js";

export class Cli {
  #definition;
  #proc;
  #helpRenderer;

  constructor(definition, { process, helpRenderer }) {
    if (definition.options) {
      throw new Error(
        `${definition.name}: "options" is no longer supported. ` +
          `Use "globalOptions" for shared options and per-command "options" ` +
          `for command-specific options.`,
      );
    }
    if (definition.commands && definition.globalOptions) {
      const globalNames = new Set(Object.keys(definition.globalOptions));
      for (const cmd of definition.commands) {
        if (!cmd.options) continue;
        for (const name of Object.keys(cmd.options)) {
          if (globalNames.has(name)) {
            throw new Error(
              `${definition.name}: option "${name}" in command ` +
                `"${cmd.name}" collides with a global option`,
            );
          }
        }
      }
    }
    this.#definition = definition;
    this.#proc = process;
    this.#helpRenderer = helpRenderer;
  }

  get name() {
    return this.#definition.name;
  }

  parse(argv) {
    const command = this.#findCommand(argv);

    const globalOpts = this.#definition.globalOptions || {};
    const commandOpts = command?.options || {};
    const merged = { ...globalOpts, ...commandOpts };

    const options = {};
    for (const [name, opt] of Object.entries(merged)) {
      options[name] = { type: opt.type };
      if (opt.short) options[name].short = opt.short;
      if (opt.default !== undefined) options[name].default = opt.default;
      if (opt.multiple) options[name].multiple = opt.multiple;
    }

    const { values, positionals } = parseArgs({
      options,
      allowPositionals: true,
      args: argv,
    });

    if (values.help) {
      if (values.json) {
        this.#helpRenderer.renderJson(
          this.#definition,
          this.#proc.stdout,
          command,
        );
      } else {
        this.#helpRenderer.render(this.#definition, this.#proc.stdout, command);
      }
      return null;
    }

    if (values.version && this.#definition.version) {
      this.#proc.stdout.write(this.#definition.version + "\n");
      return null;
    }

    return { values, positionals };
  }

  #findCommand(argv) {
    const commands = this.#definition.commands;
    if (!commands || commands.length === 0) return null;

    const positionals = argv.filter((a) => !a.startsWith("-"));

    for (let len = Math.min(positionals.length, 3); len > 0; len--) {
      const candidate = positionals.slice(0, len).join(" ");
      const found = commands.find((c) => c.name === candidate);
      if (found) return found;
    }
    return null;
  }

  showHelp() {
    this.#helpRenderer.render(this.#definition, this.#proc.stdout);
  }

  error(message) {
    this.#proc.stderr.write(`${this.#definition.name}: error: ${message}\n`);
    this.#proc.exitCode = 1;
  }

  usageError(message) {
    this.#proc.stderr.write(`${this.#definition.name}: error: ${message}\n`);
    this.#proc.exitCode = 2;
  }
}

export function createCli(definition) {
  const helpRenderer = new HelpRenderer({ process });
  return new Cli(definition, { process, helpRenderer });
}
