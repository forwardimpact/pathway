export class SummaryRenderer {
  #proc;

  constructor({ process }) {
    this.#proc = process;
  }

  render({ title, items }, stream = this.#proc.stdout) {
    stream.write(title + "\n");
    if (!items || items.length === 0) return;

    const maxLabel = Math.max(...items.map((item) => item.label.length));
    for (const item of items) {
      stream.write(
        `  ${item.label.padEnd(maxLabel)}  \u2014 ${item.description}\n`,
      );
    }
  }
}
