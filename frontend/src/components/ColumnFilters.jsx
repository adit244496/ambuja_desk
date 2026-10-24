import { useMemo } from 'react';
import { Filter } from 'lucide-react';

// Second header row with a filter under each column title. Column definitions and
// applyColumnFilters live in utils/columnFilters.js.

// Small button placed beside a report's search bar to show/hide the column filter row.
// Hiding the row clears any filters that were set, via onClear.
export const ColumnFilterToggle = ({ enabled, onToggle, onClear, activeCount = 0 }) => (
    <button
        type="button"
        className={`column-filter-toggle${enabled ? ' active' : ''}`}
        onClick={() => {
            if (enabled) onClear();
            onToggle();
        }}
        title={enabled ? (activeCount > 0 ? 'Clear and hide column filters' : 'Hide column filters') : 'Show column filters'}
    >
        <Filter size={12} />
        {enabled && activeCount > 0 && <span className="column-filter-toggle-count">{activeCount}</span>}
    </button>
);

// leadingCells: number of extra columns before `columns` (e.g. a selection checkbox) to leave blank.
export const ColumnFilterRow = ({ columns, rows, filters, onChange, leadingCells = 0 }) => {
    const options = useMemo(() => {
        const result = {};
        columns.forEach(c => {
            if (c.type !== 'select') return;
            const values = new Set();
            rows.forEach(row => {
                const v = String(c.getValue(row) ?? '').trim();
                if (v) values.add(v);
            });
            result[c.key] = [...values].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        });
        return result;
    }, [columns, rows]);

    const setFilter = (key, value) => onChange({ ...filters, [key]: value });

    return (
        <tr className="column-filter-row">
            {Array.from({ length: leadingCells }, (_, i) => <th key={`lead-${i}`} />)}
            {columns.map(c => (
                <th key={c.key} onClick={(e) => e.stopPropagation()}>
                    {c.type === 'select' && (
                        <select
                            className="column-filter-control"
                            value={filters?.[c.key] || ''}
                            onChange={(e) => setFilter(c.key, e.target.value)}
                            title="Filter this column"
                        >
                            <option value="">All</option>
                            {(options[c.key] || []).map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    )}
                    {c.type === 'daterange' && (
                        <div className="column-filter-daterange">
                            <input
                                type="date"
                                className="column-filter-control"
                                value={filters?.[c.key]?.from || ''}
                                max={filters?.[c.key]?.to || undefined}
                                onChange={(e) => setFilter(c.key, { ...filters?.[c.key], from: e.target.value })}
                                title="From date"
                            />
                            <input
                                type="date"
                                className="column-filter-control"
                                value={filters?.[c.key]?.to || ''}
                                min={filters?.[c.key]?.from || undefined}
                                onChange={(e) => setFilter(c.key, { ...filters?.[c.key], to: e.target.value })}
                                title="To date"
                            />
                        </div>
                    )}
                    {c.type === 'text' && (
                        <input
                            type="text"
                            className="column-filter-control"
                            placeholder="Filter..."
                            value={filters?.[c.key] || ''}
                            onChange={(e) => setFilter(c.key, e.target.value)}
                            title="Filter this column"
                        />
                    )}
                </th>
            ))}
        </tr>
    );
};
