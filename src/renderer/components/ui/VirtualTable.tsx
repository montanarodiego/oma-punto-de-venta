import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface VirtualTableProps<T> {
  items: T[];
  estimateSize?: number;
  /** Contenido del <thead> */
  header: React.ReactNode;
  /** Renderiza una <tr> para el item dado */
  renderRow: (item: T, index: number) => React.ReactNode;
  /** Número de columnas — para los spacer <td colSpan=...> */
  colSpan: number;
  /** Estado vacío cuando items.length === 0 */
  emptyState?: React.ReactNode;
  className?: string;
}

export function VirtualTable<T>({
  items,
  estimateSize = 40,
  header,
  renderRow,
  colSpan,
  emptyState,
  className,
}: VirtualTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count:           items.length,
    getScrollElement: () => parentRef.current,
    estimateSize:    () => estimateSize,
    overscan:        5,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize    = virtualizer.getTotalSize();
  const paddingTop   = virtualItems.length > 0 ? (virtualItems[0]?.start ?? 0) : 0;
  const paddingBottom = virtualItems.length > 0
    ? totalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0)
    : 0;

  return (
    <div ref={parentRef} className={`flex-1 min-h-0 overflow-y-auto ${className ?? ''}`}>
      <table className="tbl">
        <thead>{header}</thead>
        <tbody>
          {paddingTop > 0 && (
            <tr><td colSpan={colSpan} style={{ height: paddingTop, padding: 0, border: 'none' }} /></tr>
          )}
          {items.length === 0
            ? (emptyState
                ? <tr><td colSpan={colSpan}>{emptyState}</td></tr>
                : null)
            : virtualItems.map(vRow => renderRow(items[vRow.index], vRow.index))
          }
          {paddingBottom > 0 && (
            <tr><td colSpan={colSpan} style={{ height: paddingBottom, padding: 0, border: 'none' }} /></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
