import React from 'react';
import { Activity, History } from 'lucide-react';

/**
 * SLABreachModeToggle
 * Segmented switch component placed beside 'Hide KPIs' across dashboards.
 * Modes:
 * - 'active' (Live / Active Breach): Breached tickets currently Open, In Progress, or Resolved.
 * - 'all' (All-Time SLA Breach): Includes historically breached Closed, Declined, and On Hold tickets.
 */
const SLABreachModeToggle = ({ mode = 'active', onChange }) => {
    return (
        <div
            className="sla-toggle-container"
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: 'var(--bg-card, #131b2e)',
                border: '1px solid var(--border, #1e293b)',
                borderRadius: '8px',
                padding: '2px',
                gap: '2px',
                flexShrink: 0
            }}
            title="Toggle SLA Breach calculation mode across KPI metrics and charts"
        >
            <button
                type="button"
                onClick={() => onChange && onChange('active')}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    fontSize: '10.5px',
                    fontWeight: mode === 'active' ? 'bold' : 'normal',
                    color: mode === 'active' ? '#fff' : 'var(--text-muted, #94a3b8)',
                    backgroundColor: mode === 'active' ? '#ea580c' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease-in-out',
                    whiteSpace: 'nowrap'
                }}
            >
                <Activity size={12} color={mode === 'active' ? '#fff' : '#f97316'} />
                <span>Live Breach</span>
            </button>
            <button
                type="button"
                onClick={() => onChange && onChange('all')}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    fontSize: '10.5px',
                    fontWeight: mode === 'all' ? 'bold' : 'normal',
                    color: mode === 'all' ? '#fff' : 'var(--text-muted, #94a3b8)',
                    backgroundColor: mode === 'all' ? '#ea580c' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease-in-out',
                    whiteSpace: 'nowrap'
                }}
            >
                <History size={12} color={mode === 'all' ? '#fff' : '#f97316'} />
                <span>All-Time Breach</span>
            </button>
        </div>
    );
};

export default SLABreachModeToggle;
