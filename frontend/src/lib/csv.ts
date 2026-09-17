export type CsvCell = string | number;

/**
 * Quote a value for CSV, and neutralise anything a spreadsheet would treat
 * as a formula. Values here come from the dataset rather than from users, but
 * an export is exactly where CSV injection bites, so it is handled at the
 * point the file is written rather than trusted upstream.
 *
 * Numbers are exempt: a negative figure such as -0.0079 is data, not a
 * formula, and prefixing it would turn it into text in the spreadsheet.
 */
export function toCsvCell(value: CsvCell): string {
  let text = String(value);
  if (typeof value !== "number" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** RFC 4180 line endings (CRLF), header row first. */
export function buildCsv(columns: string[], rows: CsvCell[][]): string {
  return [columns, ...rows]
    .map((row) => row.map(toCsvCell).join(","))
    .join("\r\n");
}
