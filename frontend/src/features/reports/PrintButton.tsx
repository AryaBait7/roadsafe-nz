"use client";

import { Button } from "@/components/ui/Button";

/**
 * Opens the browser's print dialog, which also offers "Save as PDF". The
 * navigation chrome is hidden by print styles, so the output is the summary
 * alone — a real document of real figures, not a pre-made report.
 */
export function PrintButton() {
  return (
    <Button size="sm" onClick={() => window.print()} className="print:hidden">
      Print or save as PDF
    </Button>
  );
}
