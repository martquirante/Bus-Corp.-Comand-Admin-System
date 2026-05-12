import type { ReactNode } from "react";

type Column<T> = {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
};

type DataTableProps<T> = {
  rows: T[];
  columns: Column<T>[];
  emptyText?: string;
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectedRowKey?: string;
};

export function DataTable<T>({
  rows,
  columns,
  emptyText = "No records found.",
  getRowKey,
  onRowClick,
  selectedRowKey
}: DataTableProps<T>) {
  return (
    <div className="table-shell">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.header} className={column.className}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => {
              const key = getRowKey(row);
              const isSelected = selectedRowKey === key;
              return (
                <tr
                  key={key}
                  className={isSelected ? "row-selected" : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  style={onRowClick ? { cursor: "pointer" } : undefined}
                >
                  {columns.map((column) => (
                    <td key={column.header} className={column.className}>
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={columns.length} className="empty-cell">
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
