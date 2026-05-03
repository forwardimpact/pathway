const OPEN_RE = /^<!--\s*xmr:([^:\s]+):([^\s]+)\s*-->\s*$/;
const CLOSE_RE = /^<!--\s*\/xmr\s*-->\s*$/;

export function scanMarkers(text) {
  const lines = text.split("\n");
  const pairs = [];
  let open = null;

  for (let i = 0; i < lines.length; i++) {
    const openMatch = lines[i].match(OPEN_RE);
    if (openMatch) {
      if (open) {
        process.stderr.write(
          `dangling-marker ${open.metric} at line ${open.openLine + 1}\n`,
        );
      }
      open = { metric: openMatch[1], csvPath: openMatch[2], openLine: i };
      continue;
    }

    if (CLOSE_RE.test(lines[i])) {
      if (open) {
        pairs.push({
          metric: open.metric,
          csvPath: open.csvPath,
          openLine: open.openLine,
          closeLine: i,
        });
        open = null;
      }
      continue;
    }
  }

  if (open) {
    process.stderr.write(
      `dangling-marker ${open.metric} at line ${open.openLine + 1}\n`,
    );
  }

  return pairs;
}
