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

  #renderOptionSection(options, title) {
    if (!options) return [];
    const entries = Object.entries(options);
    if (entries.length === 0) return [];
    const lines = [this.#sectionHeader(title)];
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

  #renderExamplesArray(examples) {
    if (!examples || examples.length === 0) return [];
    const lines = [this.#sectionHeader("Examples:")];
    for (const ex of examples) {
      lines.push(`  ${ex}`);
    }
    lines.push("");
    return lines;
  }

  #renderExamples(definition) {
    return this.#renderExamplesArray(definition.examples);
  }

  #renderDocumentation(definition) {
    if (!definition.documentation || definition.documentation.length === 0) {
      return [];
    }
    const lines = [this.#sectionHeader("Documentation:")];
    for (const entry of definition.documentation) {
      lines.push(`  ${entry.title}`);
      lines.push(`    ${entry.url}`);
      if (entry.description) lines.push(`    ${entry.description}`);
    }
    lines.push("");
    return lines;
  }

  #renderHintLine(definition) {
    if (!definition.commands || definition.commands.length === 0) return [];
    return [
      `Use ${definition.name} <command> --help for command-specific options.`,
      "",
    ];
  }

  #renderCommand(definition, stream, command) {
    let header = `${definition.name} ${command.name}`;
    if (command.args) header += ` ${command.args}`;
    if (command.description) header += ` \u2014 ${command.description}`;
    const formatted = supportsColor(this.#proc)
      ? formatHeader(header, this.#proc)
      : header;

    let usage = `Usage: ${definition.name} ${command.name}`;
    if (command.args) usage += ` ${command.args}`;
    usage += " [options]";

    const globalWithoutVersion = definition.globalOptions
      ? Object.fromEntries(
          Object.entries(definition.globalOptions).filter(
            ([name]) => name !== "version",
          ),
        )
      : null;

    const lines = [
      formatted,
      "",
      usage,
      "",
      ...this.#renderOptionSection(command.options, "Options:"),
      ...this.#renderOptionSection(globalWithoutVersion, "Global options:"),
      ...this.#renderExamplesArray(command.examples),
    ];
    stream.write(lines.join("\n"));
  }

  render(definition, stream, command) {
    const out = stream || this.#proc.stdout;
    if (command) {
      this.#renderCommand(definition, out, command);
      return;
    }
    const lines = [
      ...this.#renderHeader(definition),
      ...this.#renderUsage(definition),
      ...this.#renderCommands(definition),
      ...this.#renderOptionSection(definition.globalOptions, "Options:"),
      ...this.#renderExamples(definition),
      ...this.#renderDocumentation(definition),
      ...this.#renderHintLine(definition),
    ];
    out.write(lines.join("\n"));
  }

  renderJson(definition, stream, command) {
    const out = stream || this.#proc.stdout;
    if (command) {
      const globalWithoutVersion = definition.globalOptions
        ? Object.fromEntries(
            Object.entries(definition.globalOptions).filter(
              ([name]) => name !== "version",
            ),
          )
        : undefined;
      const obj = {
        name: command.name,
        args: command.args,
        description: command.description,
        parent: definition.name,
        options: command.options,
        globalOptions: globalWithoutVersion,
        examples: command.examples,
        documentation: definition.documentation,
      };
      out.write(JSON.stringify(obj, null, 2) + "\n");
    } else {
      out.write(JSON.stringify(definition, null, 2) + "\n");
    }
  }
}
