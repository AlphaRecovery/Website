import { useMemo, useState } from 'react';

export default function DataTable({ columns, rows, empty = 'No records found.' }) {
  const [sortKey, setSortKey] = useState(columns[0]?.key);
  const [direction, setDirection] = useState('asc');

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const left = String(a[sortKey] ?? '').toLowerCase();
      const right = String(b[sortKey] ?? '').toLowerCase();
      const result = left.localeCompare(right);
      return direction === 'asc' ? result : -result;
    });
  }, [rows, sortKey, direction]);

  function sort(column) {
    if (!column.sortable) return;
    if (sortKey === column.key) setDirection(direction === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(column.key);
      setDirection('asc');
    }
  }

  if (!rows.length) return <div className="empty-state">{empty}</div>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>
                <button type="button" className="table-sort" onClick={() => sort(column)}>
                  {column.label}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
