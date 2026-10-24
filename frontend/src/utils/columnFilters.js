import { useState } from 'react';
import { parseDateString } from './dateUtils';

// Column-wise filters for report tables; rendered by components/ColumnFilters.jsx.
// A column is { key, type: 'text' | 'select' | 'daterange' | 'none', getValue: row => value }.
// 'text' matches anywhere in the displayed value; 'select' matches one exact value picked from the data;
// 'daterange' keeps rows whose date falls within { from, to } (inclusive, either end optional).

const normalize = (val) => String(val ?? '').trim().toLowerCase();

// Calendar day as YYYY-MM-DD, the same format <input type="date"> uses, so days compare as strings.
const toDayKey = (val) => {
    const dt = parseDateString(val);
    if (!dt) return null;
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const isFilterActive = (column, filter) => {
    if (column.type === 'none') return false;
    if (column.type === 'daterange') return Boolean(filter?.from || filter?.to);
    return String(filter ?? '').trim() !== '';
};

export const applyColumnFilters = (rows, columns, filters) => {
    const active = columns.filter(c => isFilterActive(c, filters?.[c.key]));
    if (active.length === 0) return rows;
    return rows.filter(row => active.every(c => {
        const filter = filters[c.key];
        if (c.type === 'daterange') {
            const day = toDayKey(c.getValue(row));
            if (!day) return false;
            return (!filter.from || day >= filter.from) && (!filter.to || day <= filter.to);
        }
        const val = normalize(c.getValue(row));
        const q = normalize(filter);
        return c.type === 'select' ? val === q : val.includes(q);
    }));
};

export const countActiveColumnFilters = (columns, filters) =>
    columns.filter(c => isFilterActive(c, filters?.[c.key])).length;

// Show/hide state for the column filter row, shared by every report table and remembered across visits.
// Hiding the filters also clears them (see ColumnFilterToggle's onClear).
const ENABLED_STORAGE_KEY = 'columnFiltersEnabled';

export const useColumnFiltersEnabled = () => {
    const [enabled, setEnabled] = useState(() => localStorage.getItem(ENABLED_STORAGE_KEY) === 'true');
    const toggle = () => {
        const next = !enabled;
        localStorage.setItem(ENABLED_STORAGE_KEY, String(next));
        setEnabled(next);
    };
    return [enabled, toggle];
};

const formatDays = (hours) => (hours ? `${(hours / 24).toFixed(1)}d` : '-');

// Columns of the ageing report table (Admin, Super Admin, Manager, Viewer), in display order.
export const getAgeingFilterColumns = ({ formatPerson, getDelayDays }) => [
    { key: 'ticket_id', type: 'text', getValue: a => `#${a.ticket_id ?? ''}` },
    { key: 'dept_assigned', type: 'select', getValue: a => a.dept_assigned || '-' },
    { key: 'issue_category', type: 'select', getValue: a => a.issue_category || '-' },
    { key: 'activity_category', type: 'select', getValue: a => a.activity_category || '-' },
    { key: 'description', type: 'text', getValue: a => a.description || '-' },
    { key: 'location', type: 'select', getValue: a => a.location || '-' },
    { key: 'attachment', type: 'none', getValue: () => '' },
    { key: 'timestamp', type: 'daterange', getValue: a => a.timestamp },
    { key: 'deadline', type: 'daterange', getValue: a => a.deadline },
    { key: 'escalation_level', type: 'select', getValue: a => a.escalation_level || 'L1' },
    { key: 'severity', type: 'select', getValue: a => a.severity || '-' },
    { key: 'status', type: 'select', getValue: a => a.status || '-' },
    { key: 'assigned_by', type: 'select', getValue: a => formatPerson(a.assigned_by) || '-' },
    { key: 'assigned_to', type: 'select', getValue: a => formatPerson(a.assigned_to) || '-' },
    { key: 'ticket_age_hours', type: 'text', getValue: a => formatDays(a.ticket_age_hours) },
    { key: 'solver_resolution_hours', type: 'text', getValue: a => formatDays(a.solver_resolution_hours) },
    { key: 'total_turnaround_hours', type: 'text', getValue: a => formatDays(a.total_turnaround_hours) },
    { key: 'solver_delay_hours', type: 'text', getValue: a => getDelayDays(a) }
];

// Columns of the Requestor / Solver ticket tables, in display order.
export const getTicketFilterColumns = ({ formatPerson }) => [
    { key: 'ticket_id', type: 'text', getValue: t => `#${t.ticket_id ?? ''}` },
    { key: 'attachment', type: 'none', getValue: () => '' },
    { key: 'dept_assigned', type: 'select', getValue: t => t.dept_assigned || '-' },
    { key: 'issue_category', type: 'select', getValue: t => t.issue_category || '-' },
    { key: 'activity_category', type: 'select', getValue: t => t.activity_category || '-' },
    { key: 'description', type: 'text', getValue: t => t.description || '-' },
    { key: 'location', type: 'select', getValue: t => t.location || '-' },
    { key: 'assigned_to', type: 'select', getValue: t => formatPerson(t.assigned_to) || '-' },
    { key: 'severity', type: 'select', getValue: t => t.severity || '-' },
    { key: 'status', type: 'select', getValue: t => t.status || '-' }
];
