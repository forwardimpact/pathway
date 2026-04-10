import { parseArgs } from "node:util";
import { HelpRenderer } from "./help.js";

export class Cli {
  #definition;
  #proc;
  #helpRenderer;

  constructor(definition, { process, helpRenderer }) {
    this.#definition = definition;
    this.#proc = process;
    this.#helpRenderer = helpRenderer;
  }

  get name() {
    return this.#definition.name;
  }

  parse(argv) {
    const options = {};
    for (const [name, opt] of Object.entries(this.#definition.options || {})) {
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
        this.#helpRenderer.renderJson(this.#definition, this.#proc.stdout);
      } else {
        this.#helpRenderer.render(this.#definition, this.#proc.stdout);
      }
      return null;
    }

    if (values.version && this.#definition.version) {
      this.#proc.stdout.write(this.#definition.version + "\n");
      return null;
    }

    return { values, positionals };
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
