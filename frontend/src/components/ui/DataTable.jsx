import Icon from './Icon.jsx';
import { EmptyState, Skeleton } from './primitives.jsx';

/**
 * Table primitive for the staff workspaces.
 *
 * Tables scroll horizontally rather than collapsing into cards, because
 * operators compare columns - and the skeleton keeps the layout from jumping
 * while the first page of data is in flight.
 */
export default function DataTable({
  columns,
  rows,
  loading = false,
  error = null,
  emptyTitle = 'Nothing to show yet',
  emptyDescription,
  emptyAction,
  rowKey = (row, index) => row.id ?? index,
  onRowClick,
  initialSkeletonRows = 5,
  className = '',
}) {
  if (error) {
    return (
      <div className="surface px-6 py-12 text-center">
        <p className="text-[14px] text-signal-danger">{error.message}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="table-shell">
        <div className="bg-ink-850/60 px-4 py-3">
          <Skeleton className="h-3 w-40" />
        </div>
        {Array.from({ length: initialSkeletonRows }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 border-t border-white/[0.04] px-4 py-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="ml-auto h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!rows?.length) {
    return (
      <div className="surface">
        <EmptyState icon="search" title={emptyTitle} description={emptyDescription} action={emptyAction} />
      </div>
    );
  }

  return (
    <div className={`table-shell ${className}`}>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  style={column.width ? { width: column.width } : undefined}
                  className={column.align === 'right' ? 'text-right' : undefined}
                >
                  {column.header}
                </th>
              ))}
              {onRowClick && <th scope="col" className="w-10"><span className="sr-only">Open</span></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={rowKey(row, index)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? 'cursor-pointer' : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={column.align === 'right' ? 'text-right' : undefined}
                  >
                    {column.render ? column.render(row, index) : row[column.key]}
                  </td>
                ))}
                {onRowClick && (
                  <td className="text-mist-500">
                    <Icon name="chevronRight" size={16} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
