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
    Cli.#validateNoCollisions(definition);
    this.#definition = definition;
    this.#proc = process;
    this.#helpRenderer = helpRenderer;
  }

  static #validateNoCollisions(definition) {
    if (!definition.commands || !definition.globalOptions) return;
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

  get name() {
    return this.#definition.name;
  }

  parse(argv) {
    const command = this.#findCommand(argv);
    const options = this.#buildOptions(command);
    const { values, positionals } = this.#parseArgs(argv, options);

    if (values.help) {
      this.#renderHelp(command, values.json);
      return null;
    }

    if (values.version && this.#definition.version) {
      this.#proc.stdout.write(this.#definition.version + "\n");
      return null;
    }

    return { values, positionals };
  }

  #buildOptions(command) {
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
    return options;
  }

  #parseArgs(argv, options) {
    try {
      return parseArgs({ options, allowPositionals: true, args: argv });
    } catch (err) {
      if (err.code === "ERR_PARSE_ARGS_UNKNOWN_OPTION") {
        const commandError = this.#commandAsOptionError(err);
        if (commandError) throw commandError;
      }
      throw err;
    }
  }

  #commandAsOptionError(err) {
    const match = err.message.match(/'(--?)([^']+)'/);
    if (!match) return null;
    const bare = match[2];
    const asCommand = this.#definition.commands?.find((c) => c.name === bare);
    if (!asCommand) return null;
    const usage = asCommand.args
      ? `${this.#definition.name} ${bare} ${asCommand.args}`
      : `${this.#definition.name} ${bare}`;
    return new Error(
      `Unknown option "${match[1]}${bare}". "${bare}" is a command, not an option. Usage: ${usage}`,
      { cause: err },
    );
  }

  #renderHelp(command, asJson) {
    if (asJson) {
      this.#helpRenderer.renderJson(
        this.#definition,
        this.#proc.stdout,
        command,
      );
    } else {
      this.#helpRenderer.render(this.#definition, this.#proc.stdout, command);
    }
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
