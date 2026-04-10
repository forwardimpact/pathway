import { createTraceCollector } from "@forwardimpact/libeval";

/**
 * Output command — process a complete NDJSON trace from stdin and write
 * formatted output to stdout.
 *
 * Usage: fit-eval output [--format=json|text] < trace.ndjson
 *
 * @param {object} values - Parsed option values from cli.parse()
 * @param {string[]} args - Positional arguments
 */
export async function runOutputCommand(values, _args) {
  const format =
    values.format === "text" || values.format === "json"
      ? values.format
      : "json";
  const collector = createTraceCollector();

  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const input = Buffer.concat(chunks).toString("utf8");

  for (const line of input.split("\n")) {
    collector.addLine(line);
  }

  if (format === "text") {
    process.stdout.write(collector.toText() + "\n");
  } else {
    process.stdout.write(JSON.stringify(collector.toJSON()) + "\n");
  }
}
