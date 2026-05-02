import { EXPECTED_HEADER, ISO_DATE_RE } from "./constants.js";

// Parse one CSV line into a row object. Quote-aware but does NOT support
// the `""` escape inside quoted fields — Kata-metrics CSVs use the `note`
// field for free text and the schema does not require embedded quotes.
export function parseLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  fields.push(current);
  return {
    date: fields[0],
    metric: fields[1],
    value: Number(fields[2]),
    unit: fields[3] || "",
    run: fields[4] || "",
    note: fields[5] || "",
    raw: { fields },
  };
}

export function parseCSV(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  return lines.slice(1).map((line) => {
    const row = parseLine(line);
    delete row.raw;
    return row;
  });
}

export function validateCSV(text) {
  const errors = [];

  if (text.trim() === "") {
    errors.push({ line: 1, message: "file is empty" });
    return { valid: false, rows: 0, errors };
  }

  const lines = text.trim().split("\n");

  if (lines[0].trim() !== EXPECTED_HEADER) {
    errors.push({
      line: 1,
      message: `expected header "${EXPECTED_HEADER}", got "${lines[0].trim()}"`,
    });
  }

  let dataRows = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;
    dataRows++;
    const row = parseLine(line);

    if (!row.date || !ISO_DATE_RE.test(row.date)) {
      errors.push({
        line: i + 1,
        field: "date",
        message: `invalid ISO 8601 date "${row.date}"`,
      });
    }
    if (!row.metric) {
      errors.push({
        line: i + 1,
        field: "metric",
        message: "missing metric name",
      });
    }
    if (Number.isNaN(row.value)) {
      errors.push({
        line: i + 1,
        field: "value",
        message: `not a number "${row.raw.fields[2] ?? ""}"`,
      });
    }
    if (!row.unit) {
      errors.push({ line: i + 1, field: "unit", message: "missing unit" });
    }
  }

  return { valid: errors.length === 0, rows: dataRows, errors };
}

export function listMetrics(csvText) {
  const rows = parseCSV(csvText);

  const groups = {};
  for (const row of rows) {
    if (!groups[row.metric]) groups[row.metric] = [];
    groups[row.metric].push(row);
  }

  return Object.entries(groups).map(([name, group]) => {
    group.sort((a, b) => a.date.localeCompare(b.date));
    return {
      metric: name,
      unit: group[0].unit,
      n: group.length,
      from: group[0].date,
      to: group[group.length - 1].date,
    };
  });
}
