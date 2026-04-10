import { supportsColor } from "./color.js";
import { formatHeader, formatSubheader } from "./format.js";

export class HelpRenderer {
  #proc;

  constructor({ process }) {
    this.#proc = process;
  }

  #sectionHeader(text) {
    return supportsColor(this.#proc) ? formatSubheader(text, this.#proc) : text;
  }

  #renderHeader(definition) {
    let header = definition.name;
    if (definition.version) header += ` ${definition.version}`;
    if (definition.description) header += ` \u2014 ${definition.description}`;
    const formatted = supportsColor(this.#proc)
      ? formatHeader(header, this.#proc)
      : header;
    return [formatted, ""];
  }

  #renderUsage(definition) {
    if (definition.usage) {
      return [`Usage: ${definition.usage}`, ""];
    }
    if (definition.commands && definition.commands.length > 0) {
      return [`Usage: ${definition.name} <command> [options]`, ""];
    }
    return [`Usage: ${definition.name} [options]`, ""];
  }

  #renderCommands(definition) {
    if (!definition.commands || definition.commands.length === 0) return [];
    const lines = [this.#sectionHeader("Commands:")];
    const maxWidth = Math.max(
      ...definition.commands.map(
        (c) => c.name.length + (c.args ? c.args.length + 1 : 0),
      ),
    );
    for (const cmd of definition.commands) {
      const left = cmd.args ? `${cmd.name} ${cmd.args}` : cmd.name;
      lines.push(`  ${left.padEnd(maxWidth)}  ${cmd.description}`);
    }
    lines.push("");
    return lines;
  }

  #renderOptions(definition) {
    if (!definition.options) return [];
    const entries = Object.entries(definition.options);
    if (entries.length === 0) return [];
    const lines = [this.#sectionHeader("Options:")];
    const optStrings = entries.map(([name, opt]) => {
      let s = `--${name}`;
      if (opt.type === "string") s += `=<${opt.type}>`;
      if (opt.short) s += `, -${opt.short}`;
      return s;
    });
    const maxOptWidth = Math.max(...optStrings.map((s) => s.length));
    for (let i = 0; i < entries.length; i++) {
      lines.push(
        `  ${optStrings[i].padEnd(maxOptWidth)}  ${entries[i][1].description}`,
      );
    }
    lines.push("");
    return lines;
  }

  #renderExamples(definition) {
    if (!definition.examples || definition.examples.length === 0) return [];
    const lines = [this.#sectionHeader("Examples:")];
    for (const ex of definition.examples) {
      lines.push(`  ${ex}`);
    }
    lines.push("");
    return lines;
  }

  render(definition, stream) {
    const out = stream || this.#proc.stdout;
    const lines = [
      ...this.#renderHeader(definition),
      ...this.#renderUsage(definition),
      ...this.#renderCommands(definition),
      ...this.#renderOptions(definition),
      ...this.#renderExamples(definition),
    ];
    out.write(lines.join("\n"));
  }

  renderJson(definition, stream) {
    const out = stream || this.#proc.stdout;
    out.write(JSON.stringify(definition, null, 2) + "\n");
  }
}
