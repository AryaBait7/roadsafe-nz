export interface TableColumn<T> {
  header: string;
  /** Right-aligned and tabular when the column holds figures. */
  numeric?: boolean;
  cell: (row: T) => React.ReactNode;
}

/**
 * The table-view twin every chart ships with.
 *
 * Two jobs: it is the WCAG-clean equivalent for anyone who cannot use the
 * visual encoding, and it is the relief channel that makes a sub-3:1 fill
 * legal. Values are reachable here without hovering anything.
 */
export function DataTable<T>({
  rows,
  columns,
  caption,
}: {
  rows: T[];
  columns: TableColumn<T>[];
  caption: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-md border-collapse text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-surface-200">
            {columns.map((column) => (
              <th
                key={column.header}
                scope="col"
                className={`py-2 font-medium text-surface-500 ${
                  column.numeric ? "text-right" : "text-left"
                }`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-surface-100 last:border-0">
              {columns.map((column) => (
                <td
                  key={column.header}
                  className={`py-2 text-navy-900 ${
                    column.numeric ? "tabular text-right" : "text-left"
                  }`}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
