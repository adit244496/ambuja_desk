import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Filter, ChevronDown } from 'lucide-react';

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

const POPOVER_WIDTH = 220;

// Checkbox dropdown for 'multiselect' columns. The list is portalled to <body> with fixed
// positioning so the table's scroll container can't clip it.
const MultiSelectFilter = ({ options, selected, onChange }) => {
    const [position, setPosition] = useState(null);
    const [search, setSearch] = useState('');
    const buttonRef = useRef(null);
    const popoverRef = useRef(null);
    const isOpen = position !== null;

    useEffect(() => {
        if (!isOpen) return undefined;
        const close = () => setPosition(null);
        const onMouseDown = (e) => {
            if (!popoverRef.current?.contains(e.target) && !buttonRef.current?.contains(e.target)) close();
        };
        const onScroll = (e) => {
            if (!popoverRef.current?.contains(e.target)) close();
        };
        const onKeyDown = (e) => { if (e.key === 'Escape') close(); };
        document.addEventListener('mousedown', onMouseDown);
        document.addEventListener('keydown', onKeyDown);
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', close);
        return () => {
            document.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', close);
        };
    }, [isOpen]);

    const toggleOpen = () => {
        if (isOpen) {
            setPosition(null);
            return;
        }
        const rect = buttonRef.current.getBoundingClientRect();
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - 8));
        // Open upwards when there's more room above the button than below it
        const openUp = window.innerHeight - rect.bottom < 280 && rect.top > window.innerHeight - rect.bottom;
        setSearch('');
        setPosition(openUp ? { left, bottom: window.innerHeight - rect.top + 2 } : { left, top: rect.bottom + 2 });
    };

    const isSelected = (v) => selected.includes(v);
    const toggleValue = (v) => onChange(isSelected(v) ? selected.filter(x => x !== v) : [...selected, v]);
    const q = search.trim().toLowerCase();
    const visible = q ? options.filter(v => v.toLowerCase().includes(q)) : options;

    const label = selected.length === 0 ? 'All' : selected.length === 1 ? selected[0] : `${selected.length} selected`;

    return (
        <>
            <button
                type="button"
                ref={buttonRef}
                className={`column-filter-control column-filter-multiselect${selected.length > 0 ? ' has-value' : ''}`}
                onClick={toggleOpen}
                title={selected.length > 0 ? selected.join(', ') : 'Filter this column'}
            >
                <span className="column-filter-multiselect-label">{label}</span>
                <ChevronDown size={11} />
            </button>
            {isOpen && createPortal(
                <div ref={popoverRef} className="column-filter-popover" style={{ ...position, width: POPOVER_WIDTH }}>
                    {options.length > 8 && (
                        <input
                            type="text"
                            className="column-filter-control"
                            placeholder="Search..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                        />
                    )}
                    <div className="column-filter-popover-actions">
                        <button type="button" onClick={() => onChange([...new Set([...selected, ...visible])])}>Select all</button>
                        <button type="button" onClick={() => onChange([])} disabled={selected.length === 0}>Clear</button>
                    </div>
                    <div className="column-filter-popover-list">
                        {visible.length === 0 ? (
                            <div className="column-filter-popover-empty">No matches</div>
                        ) : visible.map(v => (
                            <label key={v} className="column-filter-popover-option">
                                <input type="checkbox" checked={isSelected(v)} onChange={() => toggleValue(v)} />
                                <span>{v}</span>
                            </label>
                        ))}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

// leadingCells: number of extra columns before `columns` (e.g. a selection checkbox) to leave blank.
export const ColumnFilterRow = ({ columns, rows, filters, onChange, leadingCells = 0 }) => {
    const options = useMemo(() => {
        const result = {};
        columns.forEach(c => {
            if (c.type !== 'select' && c.type !== 'multiselect') return;
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
                    {c.type === 'multiselect' && (
                        <MultiSelectFilter
                            options={options[c.key] || []}
                            selected={Array.isArray(filters?.[c.key]) ? filters[c.key] : []}
                            onChange={(values) => setFilter(c.key, values)}
                        />
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
