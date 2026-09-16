"use client";

import { Button } from "@/components/ui/Button";

type Cell = string | number;

/**
 * Quote a value for CSV, and neutralise anything a spreadsheet would treat
 * as a formula. Values here come from the dataset rather than from users, but
 * an export is exactly where CSV injection bites, so it is handled at the
 * point the file is written rather than trusted upstream.
 */
function toCsvCell(value: Cell): string {
  let text = String(value);
  if (/^[=+\-@]/.test(text) && typeof value !== "number") text = `'${text}`;
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Downloads real aggregates as CSV, built in the browser from the rows the
 * page already rendered. Props are plain arrays so they can cross the
 * Server/Client boundary — a formatter function could not.
 */
export function CsvExportButton({
  filename,
  columns,
  rows,
}: {
  filename: string;
  columns: string[];
  rows: Cell[][];
}) {
  const download = () => {
    const csv = [columns, ...rows]
      .map((row) => row.map(toCsvCell).join(","))
      .join("\r\n");

    // Leading BOM so Excel reads macrons (Manawatū) as UTF-8.
    const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Button size="sm" variant="secondary" onClick={download} disabled={rows.length === 0}>
      Download CSV
    </Button>
  );
}
