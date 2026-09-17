"use client";

import { Button } from "@/components/ui/Button";
import { buildCsv, type CsvCell } from "@/lib/csv";

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
  rows: CsvCell[][];
}) {
  const download = () => {
    const csv = buildCsv(columns, rows);

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
