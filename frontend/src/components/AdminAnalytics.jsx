import React, { useState, useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell,
    ResponsiveContainer, AreaChart, Area, CartesianGrid, ComposedChart, LabelList, Line
} from 'recharts';
import { Filter, XCircle, Maximize2, X, Download, FileText, TrendingUp, BarChart3, MapPin, Users, UserCheck, CheckCircle, AlertTriangle, ShieldAlert, Layers, Clock, Tag } from 'lucide-react';
import { exportExecutivePDF, exportExecutiveCSV } from '../utils/exportExecutiveReports';
import { getISTDate, parseDateString } from '../utils/dateUtils';
import SLABreachModeToggle from './SLABreachModeToggle';

// --- PREMIUM COLOR SYSTEM ---
const GRADIENT_PAIRS = [
    { start: '#6366f1', end: '#818cf8' },   // Indigo
    { start: '#f59e0b', end: '#fbbf24' },   // Amber
    { start: '#10b981', end: '#34d399' },   // Emerald
    { start: '#3b82f6', end: '#60a5fa' },   // Blue
    { start: '#ec4899', end: '#f472b6' },   // Pink
    { start: '#8b5cf6', end: '#a78bfa' },   // Violet
    { start: '#14b8a6', end: '#2dd4bf' },   // Teal
    { start: '#f97316', end: '#fb923c' },   // Orange
];

const STATUS_COLORS = {
    'Open': '#f59e0b',
    'In Progress': '#6366f1',
    'Resolved': '#10b981',
    'Closed': '#64748b',
    'Declined': '#ef4444',
    'On Hold': '#8b5cf6',
    'Escalated': '#f97316'
};

const SEVERITY_COLORS = { 'High (>=10)': '#ef4444', 'Normal (<10)': '#3b82f6' };

// --- CARD WRAPPER WITH HOVER GLOW ---
const ChartCard = ({ children, onClick, title, subtitle, icon: Icon, accentColor = '#6366f1', flex = 1, minWidth = '300px', style = {} }) => {
    const [hovered, setHovered] = useState(false);
    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                padding: '16px 18px',
                marginBottom: 0,
                borderRadius: '12px',
                border: `1px solid ${hovered ? accentColor + '50' : 'rgba(255,255,255,0.06)'}`,
                background: hovered
                    ? `linear-gradient(135deg, ${accentColor}08 0%, transparent 60%), var(--bg-card)`
                    : 'var(--bg-card)',
                display: 'flex',
                flexDirection: 'column',
                cursor: onClick ? 'pointer' : 'default',
                flex,
                minWidth,
                transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: hovered
                    ? `0 8px 32px ${accentColor}18, 0 0 0 1px ${accentColor}15`
                    : '0 1px 3px rgba(0,0,0,0.12)',
                transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
                position: 'relative',
                overflow: 'visible',
                ...style
            }}
        >
            {/* Top accent line */}
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                borderRadius: '12px 12px 0 0',
                background: `linear-gradient(90deg, ${accentColor}, ${accentColor}00)`,
                opacity: hovered ? 1 : 0.4,
                transition: 'opacity 0.35s ease'
            }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {Icon && <Icon size={14} color={accentColor} style={{ opacity: 0.8 }} />}
                    <div>
                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>{title}</h4>
                        {subtitle && <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{subtitle}</span>}
                    </div>
                </div>
                {onClick && <Maximize2 size={12} color="var(--text-muted)" style={{ opacity: hovered ? 0.7 : 0.3, transition: 'opacity 0.3s' }} />}
            </div>
            {children}
        </div>
    );
};

// --- CUSTOM ENTERPRISE SEARCH DROPDOWN ---
const SearchSelect = ({ options = [], value, onChange, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const dropdownRef = React.useRef(null);

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const filtered = (options || []).filter(o =>
        o && String(o).toLowerCase().includes(String(search).toLowerCase())
    );

    return (
        <div ref={dropdownRef} style={{ position: 'relative', width: '100%', maxWidth: '240px' }}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    padding: '8px 12px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    color: value ? 'var(--text-main)' : 'var(--text-muted)',
                    userSelect: 'none'
                }}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {value || placeholder}
                </span>
                <span style={{ fontSize: '10px', marginLeft: '6px', opacity: 0.7 }}>{isOpen ? '▲' : '▼'}</span>
            </div>

            {isOpen && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
                    backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: '6px', boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
                    zIndex: 9999, maxHeight: '250px', display: 'flex', flexDirection: 'column'
                }}>
                    <div style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>
                        <input
                            autoFocus
                            type="text"
                            placeholder="Search..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{
                                width: '100%', padding: '6px 8px', fontSize: '12px',
                                border: '1px solid var(--border)', borderRadius: '4px',
                                backgroundColor: 'var(--bg-subtle)', color: 'var(--text-main)',
                                boxSizing: 'border-box', outline: 'none'
                            }}
                        />
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1, padding: '4px', maxHeight: '180px' }}>
                        <div
                            onClick={() => { onChange(''); setIsOpen(false); setSearch(''); }}
                            style={{ padding: '8px', fontSize: '13px', cursor: 'pointer', color: 'var(--text-muted)', borderRadius: '4px' }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                        >
                            All
                        </div>
                        {filtered.map(opt => (
                            <div
                                key={opt}
                                onClick={() => { onChange(opt); setIsOpen(false); setSearch(''); }}
                                style={{
                                    padding: '8px', fontSize: '13px', cursor: 'pointer',
                                    backgroundColor: value === opt ? 'rgba(99,102,241,0.15)' : 'transparent',
                                    color: value === opt ? '#818cf8' : 'var(--text-main)',
                                    fontWeight: value === opt ? 600 : 400,
                                    borderRadius: '4px'
                                }}
                                onMouseEnter={(e) => { if (value !== opt) e.target.style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
                                onMouseLeave={(e) => { if (value !== opt) e.target.style.backgroundColor = 'transparent'; }}
                            >
                                {opt}
                            </div>
                        ))}
                        {filtered.length === 0 && <div style={{ padding: '8px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>No results</div>}
                    </div>
                </div>
            )}
        </div>
    );
}; const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;

        if (data.Open !== undefined && data.Closed !== undefined && !data.Raised) {
            return (
                <div style={{
                    backgroundColor: 'var(--bg-card)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    color: 'var(--text-main)',
                    fontSize: '12px',
                    minWidth: '170px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.25)'
                }}>
                    <p style={{ margin: '0 0 10px 0', fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: '8px', color: 'var(--text-main)', fontSize: '13px' }}>
                        {label || data.name || data.department || data.location}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 12px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Total Tickets:</span> <strong>{data.total || data.tickets || data.value || 0}</strong>
                        {data.Open > 0 && <><span style={{ color: STATUS_COLORS['Open'] }}>Open:</span> <strong>{data.Open}</strong></>}
                        {data['In Progress'] > 0 && <><span style={{ color: STATUS_COLORS['In Progress'] }}>In Progress:</span> <strong>{data['In Progress']}</strong></>}
                        {data.Resolved > 0 && <><span style={{ color: STATUS_COLORS['Resolved'] }}>Resolved:</span> <strong>{data.Resolved}</strong></>}
                        {data.Closed > 0 && <><span style={{ color: STATUS_COLORS['Closed'] }}>Closed:</span> <strong>{data.Closed}</strong></>}
                        {data.Declined > 0 && <><span style={{ color: STATUS_COLORS['Declined'] }}>Declined:</span> <strong>{data.Declined}</strong></>}
                        {data['On Hold'] > 0 && <><span style={{ color: STATUS_COLORS['On Hold'] }}>On Hold:</span> <strong>{data['On Hold']}</strong></>}
                    </div>
                </div>
            );
        }

        if (data.Assigned !== undefined) {
            return (
                <div style={{
                    backgroundColor: 'var(--bg-card)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    color: 'var(--text-main)',
                    fontSize: '12px',
                    minWidth: '170px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.25)'
                }}>
                    <p style={{ margin: '0 0 10px 0', fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: '8px', color: 'var(--text-main)', fontSize: '13px' }}>
                        {label || data.user}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 12px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Total Assigned:</span> <strong>{data.Assigned}</strong>
                        <span style={{ color: '#f59e0b' }}>Active Load:</span> <strong>{data.ActiveLoad || 0} tickets</strong>
                        <span style={{ color: '#10b981' }}>Resolved/Closed:</span> <strong>{data.Resolved || 0}</strong>
                        <span style={{ color: 'var(--text-muted)' }}>SLA Breaches:</span> <strong style={{ color: '#ef4444' }}>{data.SLA || 0}</strong>
                    </div>
                </div>
            );
        }

        if (data.Raised !== undefined) {
            return (
                <div style={{
                    backgroundColor: 'var(--bg-card)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    color: 'var(--text-main)',
                    fontSize: '12px',
                    minWidth: '170px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.25)'
                }}>
                    <p style={{ margin: '0 0 10px 0', fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: '8px', color: 'var(--text-main)', fontSize: '13px' }}>
                        {label || data.user}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 12px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Total Raised:</span> <strong>{data.Raised}</strong>
                        <span style={{ color: '#6366f1' }}>Open / Active:</span> <strong>{data.Open || 0}</strong>
                        <span style={{ color: '#10b981' }}>Resolved/Closed:</span> <strong>{data.Resolved || 0}</strong>
                    </div>
                </div>
            );
        }

        const pieLabel = payload[0].name || label;
        return (
            <div style={{
                backgroundColor: 'var(--bg-card)',
                backdropFilter: 'blur(16px)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '12px 14px',
                color: 'var(--text-main)',
                fontSize: '12px',
                minWidth: '150px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.25)'
            }}>
                {pieLabel && <p style={{ margin: '0 0 8px 0', fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: '8px', color: 'var(--text-main)', fontSize: '13px' }}>{pieLabel}</p>}
                {payload.map((entry, index) => (
                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '4px' }}>
                        <span style={{ color: entry.color || 'var(--text-muted)' }}>{entry.name}:</span>
                        <strong>{entry.value}</strong>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

// --- CUSTOM PIE CENTER LABEL ---
const PieCenterLabel = ({ total, cy = "50%" }) => (
    <text x="50%" y={cy} textAnchor="middle" dominantBaseline="middle">
        <tspan x="50%" dy="-6" fontSize="24" fontWeight="700" fill="var(--text-main)">{total}</tspan>
        <tspan x="50%" dy="22" fontSize="10" fontWeight="600" fill="var(--text-muted)" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>TOTAL</tspan>
    </text>
);

// --- CUSTOM LEGEND ---
const CustomLegend = ({ payload }) => (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', paddingTop: '12px', flexWrap: 'wrap' }}>
        {payload && payload.map((entry, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#a1a1aa' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: entry.color }} />
                <span>{entry.value}</span>
            </div>
        ))}
    </div>
);


const AdminAnalytics = ({ tickets = [], usersList = [], slaBreachMode = 'active', onSlaBreachModeChange = null }) => {
    const [showFilters, setShowFilters] = useState(false);
    const [enlargedChart, setEnlargedChart] = useState(null);
    const [internalSlaMode, setInternalSlaMode] = useState('active');

    const currentSlaBreachMode = onSlaBreachModeChange ? slaBreachMode : internalSlaMode;
    const handleSlaBreachModeToggle = onSlaBreachModeChange || setInternalSlaMode;

    // Filters
    const [filterDept, setFilterDept] = useState('');
    const [filterLocation, setFilterLocation] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterTime, setFilterTime] = useState('');

    const [localFilterDept, setLocalFilterDept] = useState('');
    const [localFilterLocation, setLocalFilterLocation] = useState('');
    const [localFilterStatus, setLocalFilterStatus] = useState('');
    const [localFilterTime, setLocalFilterTime] = useState('');

    const uniqueDepts = useMemo(() => {
        const set = new Set();
        tickets.forEach(t => {
            const d = t.dept_assigned || t.department;
            if (d && String(d).trim()) set.add(String(d).trim());
        });
        return [...set].sort();
    }, [tickets]);

    const uniqueLocations = useMemo(() => {
        const set = new Set();
        tickets.forEach(t => {
            if (t.location && String(t.location).trim()) set.add(String(t.location).trim());
        });
        return [...set].sort();
    }, [tickets]);

    const uniqueStatuses = ['Open', 'In Progress', 'Resolved', 'Closed', 'Declined', 'On Hold'];
    const timeOptions = ['All Time', 'Today', 'Last 7 Days', 'Last 30 Days', 'Last 6 Months', 'Last 12 Months', 'More than 12 Months'];

    // Master User Name Lookup Map
    const userMap = useMemo(() => {
        const map = new Map();

        const addPair = (rawKey, nameVal) => {
            if (!rawKey || !nameVal) return;
            const keyStr = String(rawKey).trim();
            let clean = String(nameVal).replace(/\s*[-/(]*\+?[\d\s]{7,20}[-/)]*\s*/g, '').trim();
            clean = clean.replace(/\s*-\s*$/, '').trim();
            if (clean && !clean.includes('@') && !/^\d+$/.test(clean) && clean.toLowerCase() !== 'unassigned') {
                map.set(keyStr, clean);
                map.set(keyStr.toLowerCase(), clean);
            }
        };

        if (Array.isArray(usersList)) {
            usersList.forEach(u => {
                if (u.name) {
                    if (u.employee_id) addPair(u.employee_id, u.name);
                    if (u.email) addPair(u.email, u.name);
                }
            });
        }

        tickets.forEach(t => {
            if (t.raised_by) addPair(t.raised_by, t.raiser_name);
            if (t.assigned_to) addPair(t.assigned_to, t.assigned_to_name || t.solver_name);
            if (t.original_raiser) addPair(t.original_raiser, t.original_raiser_name);
        });

        return map;
    }, [tickets, usersList]);

    const getCleanName = useMemo(() => (rawIdentifier, displayName) => {
        const sanitize = (str) => {
            if (!str) return '';
            let s = String(str).replace(/\s*[-/(]*\+?[\d\s]{7,20}[-/)]*\s*/g, '').trim();
            return s.replace(/\s*-\s*$/, '').trim();
        };

        // 1. Try display name if provided and not email/pure digit
        const cleanDisplay = sanitize(displayName);
        if (cleanDisplay && !cleanDisplay.includes('@') && !/^\d+$/.test(cleanDisplay) && cleanDisplay.toLowerCase() !== 'unassigned') {
            return cleanDisplay;
        }

        // 2. Try raw identifier in userMap
        if (rawIdentifier) {
            const k = String(rawIdentifier).trim();
            if (userMap.has(k)) return userMap.get(k);
            if (userMap.has(k.toLowerCase())) return userMap.get(k.toLowerCase());
        }

        // 3. Try display name in userMap
        if (cleanDisplay) {
            if (userMap.has(cleanDisplay)) return userMap.get(cleanDisplay);
            if (userMap.has(cleanDisplay.toLowerCase())) return userMap.get(cleanDisplay.toLowerCase());
        }

        // 4. Format email handle into Title Case Name (e.g. "koushik.roy@domain.com" -> "Koushik Roy")
        const checkStr = cleanDisplay || String(rawIdentifier || '');
        if (checkStr.includes('@')) {
            const handle = checkStr.split('@')[0];
            const formatted = handle
                .split(/[\._-]/)
                .filter(Boolean)
                .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
                .join(' ');
            if (formatted) return formatted;
        }

        // 5. If cleanDisplay is a valid non-digit string, return it
        if (cleanDisplay && !/^\d+$/.test(cleanDisplay) && cleanDisplay.toLowerCase() !== 'unassigned') {
            return cleanDisplay;
        }

        return null;
    }, [userMap]);

    // Helper to normalize status into canonical display groups
    const normalizeStatus = (statusStr, closureType) => {
        const s = String(statusStr || '').trim().toLowerCase();
        const ct = String(closureType || '').trim().toLowerCase();
        if (ct === 'declined' || s === 'declined' || s === 'rejected') return 'Declined';
        if (ct === 'on hold' || s === 'on hold' || s === 'on-hold') return 'On Hold';
        if (s === 'in progress' || s === 'in-progress') return 'In Progress';
        if (s === 'open') return 'Open';
        if (s === 'resolved') return 'Resolved';
        if (s === 'closed') return 'Closed';
        if (s === 'escalate' || s === 'escalated') return 'Escalated';
        return statusStr ? String(statusStr).trim() : 'Open';
    };

    // Apply Global Filters
    const filteredTickets = useMemo(() => {
        const now = getISTDate();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        return tickets.filter(t => {
            const ticketDept = (t.dept_assigned || t.department || '').trim().toLowerCase();
            const matchDept = !filterDept || ticketDept === filterDept.trim().toLowerCase() || ticketDept.includes(filterDept.trim().toLowerCase());

            const ticketLoc = (t.location || '').trim().toLowerCase();
            const matchLocation = !filterLocation || ticketLoc === filterLocation.trim().toLowerCase() || ticketLoc.includes(filterLocation.trim().toLowerCase());

            const normStatus = normalizeStatus(t.status, t.closure_type);
            const matchStatus = !filterStatus || normStatus.toLowerCase() === filterStatus.trim().toLowerCase();

            let matchTime = true;
            if (filterTime && filterTime !== 'All Time' && t.timestamp) {
                const ticketDate = parseDateString(t.timestamp);
                if (!ticketDate || isNaN(ticketDate.getTime())) {
                    matchTime = false;
                } else {
                    const ticketDayStart = new Date(ticketDate.getFullYear(), ticketDate.getMonth(), ticketDate.getDate());
                    if (filterTime === 'Today') {
                        matchTime = ticketDayStart.getTime() === today.getTime();
                    } else if (filterTime === 'Last 7 Days') {
                        const sevenDaysAgo = new Date(today);
                        sevenDaysAgo.setDate(today.getDate() - 7);
                        matchTime = ticketDayStart >= sevenDaysAgo;
                    } else if (filterTime === 'Last 30 Days') {
                        const thirtyDaysAgo = new Date(today);
                        thirtyDaysAgo.setDate(today.getDate() - 30);
                        matchTime = ticketDayStart >= thirtyDaysAgo;
                    } else if (filterTime === 'Last 6 Months') {
                        const sixMonthsAgo = new Date(today);
                        sixMonthsAgo.setMonth(today.getMonth() - 6);
                        matchTime = ticketDayStart >= sixMonthsAgo;
                    } else if (filterTime === 'Last 12 Months') {
                        const twelveMonthsAgo = new Date(today);
                        twelveMonthsAgo.setMonth(today.getMonth() - 12);
                        matchTime = ticketDayStart >= twelveMonthsAgo;
                    } else if (filterTime === 'More than 12 Months') {
                        const twelveMonthsAgo = new Date(today);
                        twelveMonthsAgo.setMonth(today.getMonth() - 12);
                        matchTime = ticketDayStart < twelveMonthsAgo;
                    }
                }
            }
            return matchDept && matchLocation && matchStatus && matchTime;
        });
    }, [tickets, filterDept, filterLocation, filterStatus, filterTime]);

    // Apply Local Modal Filters
    const localFilteredTickets = useMemo(() => {
        const now = getISTDate();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        return tickets.filter(t => {
            const ticketDept = (t.dept_assigned || t.department || '').trim().toLowerCase();
            const matchDept = !localFilterDept || ticketDept === localFilterDept.trim().toLowerCase() || ticketDept.includes(localFilterDept.trim().toLowerCase());

            const ticketLoc = (t.location || '').trim().toLowerCase();
            const matchLocation = !localFilterLocation || ticketLoc === localFilterLocation.trim().toLowerCase() || ticketLoc.includes(localFilterLocation.trim().toLowerCase());

            const normStatus = normalizeStatus(t.status, t.closure_type);
            const matchStatus = !localFilterStatus || normStatus.toLowerCase() === localFilterStatus.trim().toLowerCase();

            let matchTime = true;
            if (localFilterTime && localFilterTime !== 'All Time' && t.timestamp) {
                const ticketDate = parseDateString(t.timestamp);
                if (!ticketDate || isNaN(ticketDate.getTime())) {
                    matchTime = false;
                } else {
                    const ticketDayStart = new Date(ticketDate.getFullYear(), ticketDate.getMonth(), ticketDate.getDate());
                    if (localFilterTime === 'Today') {
                        matchTime = ticketDayStart.getTime() === today.getTime();
                    } else if (localFilterTime === 'Last 7 Days') {
                        const sevenDaysAgo = new Date(today);
                        sevenDaysAgo.setDate(today.getDate() - 7);
                        matchTime = ticketDayStart >= sevenDaysAgo;
                    } else if (localFilterTime === 'Last 30 Days') {
                        const thirtyDaysAgo = new Date(today);
                        thirtyDaysAgo.setDate(today.getDate() - 30);
                        matchTime = ticketDayStart >= thirtyDaysAgo;
                    } else if (localFilterTime === 'Last 6 Months') {
                        const sixMonthsAgo = new Date(today);
                        sixMonthsAgo.setMonth(today.getMonth() - 6);
                        matchTime = ticketDayStart >= sixMonthsAgo;
                    } else if (localFilterTime === 'Last 12 Months') {
                        const twelveMonthsAgo = new Date(today);
                        twelveMonthsAgo.setMonth(today.getMonth() - 12);
                        matchTime = ticketDayStart >= twelveMonthsAgo;
                    } else if (localFilterTime === 'More than 12 Months') {
                        const twelveMonthsAgo = new Date(today);
                        twelveMonthsAgo.setMonth(today.getMonth() - 12);
                        matchTime = ticketDayStart < twelveMonthsAgo;
                    }
                }
            }
            return matchDept && matchLocation && matchStatus && matchTime;
        });
    }, [tickets, localFilterDept, localFilterLocation, localFilterStatus, localFilterTime]);

    // Helper to robustly check if a ticket has breached its deadline
    const checkTicketLate = (t, targetMode = currentSlaBreachMode) => {
        if (!t) return false;
        if (t.solver_delay_hours !== undefined && t.solver_delay_hours !== null && Number(t.solver_delay_hours) > 0) return true;
        if (!t.deadline || String(t.deadline).toLowerCase() === 'nan') return false;

        const deadlineDate = parseDateString(t.deadline);
        if (!deadlineDate) return false;

        const st = String(t.status || '').toLowerCase();
        const ct = String(t.closure_type || '').toLowerCase();
        const isFinished = ['closed', 'declined', 'on hold', 'on-hold'].includes(st) || ['declined', 'on hold'].includes(ct);

        if (targetMode === 'active') {
            if (isFinished) return false;
            return getISTDate() > deadlineDate;
        }

        if (isFinished) {
            const finishStr = t.closed_timestamp || t.solved_timestamp;
            if (finishStr && String(finishStr).toLowerCase() !== 'nan') {
                const finishDate = parseDateString(finishStr);
                if (finishDate) return finishDate > deadlineDate;
            }
            return t.SLA_Breach === true || t.SLA_Breach === 'True';
        }

        return getISTDate() > deadlineDate;
    };

    // --- AGGREGATIONS ---
    const deptStats = useMemo(() => {
        const stats = {};
        filteredTickets.forEach(t => {
            const d = t.dept_assigned || t.department || 'General';
            if (!stats[d]) stats[d] = { department: d, total: 0, Open: 0, 'In Progress': 0, Resolved: 0, Closed: 0, Declined: 0, 'On Hold': 0, Escalated: 0 };
            stats[d].total += 1;
            const norm = normalizeStatus(t.status, t.closure_type);
            if (stats[d][norm] !== undefined) {
                stats[d][norm] += 1;
            } else {
                stats[d][norm] = 1;
            }
        });
        return Object.values(stats).sort((a, b) => b.total - a.total);
    }, [filteredTickets]);

    // 5. Top Issue Categories
    const categoryStats = useMemo(() => {
        const stats = {};
        filteredTickets.forEach(t => {
            const cat = t.issue_category || t.category || 'General';
            if (!stats[cat]) stats[cat] = { category: cat, tickets: 0 };
            stats[cat].tickets += 1;
        });
        return Object.values(stats).sort((a, b) => b.tickets - a.tickets).slice(0, 10);
    }, [filteredTickets]);

    // 6. SLA Compliance by Department
    const slaDeptStats = useMemo(() => {
        const stats = {};
        filteredTickets.forEach(t => {
            const d = t.dept_assigned || t.department || 'General';
            if (!stats[d]) stats[d] = { department: d, compliant: 0, breached: 0, total: 0 };
            stats[d].total += 1;
            if (checkTicketLate(t, currentSlaBreachMode)) {
                stats[d].breached += 1;
            } else {
                stats[d].compliant += 1;
            }
        });
        return Object.values(stats).sort((a, b) => b.total - a.total).slice(0, 8);
    }, [filteredTickets, currentSlaBreachMode]);

    // 7. Escalation Levels Breakdown (L1, L2, L3, L4, L5)
    const escalationStats = useMemo(() => {
        const counts = { 'L1': 0, 'L2': 0, 'L3': 0, 'L4': 0, 'L5': 0 };
        filteredTickets.forEach(t => {
            const lvl = (t.escalation_level || 'L1').toUpperCase();
            if (counts[lvl] !== undefined) counts[lvl]++;
            else counts['L1']++;
        });
        return Object.keys(counts).filter(k => counts[k] > 0).map(k => ({ name: k, value: counts[k] }));
    }, [filteredTickets]);

    // 8. Resolution Speed / Turnaround by Department (Average Days)
    const turnaroundStats = useMemo(() => {
        const stats = {};
        filteredTickets.forEach(t => {
            const st = (t.status || '').toLowerCase();
            if (st === 'resolved' || st === 'closed') {
                const d = t.dept_assigned || t.department || 'General';
                let days = 0;
                if (t.solver_resolution_hours && Number(t.solver_resolution_hours) > 0) {
                    days = Number(t.solver_resolution_hours) / 24;
                } else if (t.total_turnaround_hours && Number(t.total_turnaround_hours) > 0) {
                    days = Number(t.total_turnaround_hours) / 24;
                } else if (t.ticket_age_hours && Number(t.ticket_age_hours) > 0) {
                    days = Number(t.ticket_age_hours) / 24;
                }
                if (days > 0) {
                    if (!stats[d]) stats[d] = { department: d, totalDays: 0, count: 0 };
                    stats[d].totalDays += days;
                    stats[d].count += 1;
                }
            }
        });
        return Object.values(stats)
            .map(s => ({ department: s.department, avgDays: Number((s.totalDays / s.count).toFixed(1)), count: s.count }))
            .sort((a, b) => a.avgDays - b.avgDays)
            .slice(0, 8);
    }, [filteredTickets]);

    const statusBreakdown = useMemo(() => {
        const counts = {};
        filteredTickets.forEach(t => {
            const norm = normalizeStatus(t.status, t.closure_type);
            counts[norm] = (counts[norm] || 0) + 1;
        });
        return Object.keys(counts).filter(k => counts[k] > 0).map(k => ({ name: k, value: counts[k] }));
    }, [filteredTickets]);

    const locationLoad = useMemo(() => {
        const stats = {};
        filteredTickets.forEach(t => {
            const l = t.location || t.project || 'General';
            if (!stats[l]) stats[l] = { location: l, tickets: 0, Open: 0, 'In Progress': 0, Resolved: 0, Closed: 0, Declined: 0, 'On Hold': 0, Escalated: 0 };
            stats[l].tickets += 1;
            const norm = normalizeStatus(t.status, t.closure_type);
            if (stats[l][norm] !== undefined) {
                stats[l][norm] += 1;
            } else {
                stats[l][norm] = 1;
            }
        });
        return Object.values(stats).sort((a, b) => b.tickets - a.tickets).slice(0, 10);
    }, [filteredTickets]);

    const dateTrend = useMemo(() => {
        const counts = {};
        filteredTickets.forEach(t => {
            if (!t.timestamp) return;
            const date = t.timestamp.split(' ')[0];
            counts[date] = (counts[date] || 0) + 1;
        });
        return Object.keys(counts).sort((a, b) => {
            const [d1, m1, y1] = a.split('-'); const [d2, m2, y2] = b.split('-');
            return new Date(y1, m1 - 1, d1) - new Date(y2, m2 - 1, d2);
        }).map(date => ({ date, tickets: counts[date] }));
    }, [filteredTickets]);

    const assignedStats = useMemo(() => {
        const stats = {};
        filteredTickets.forEach(t => {
            const solverRaw = t.assigned_to || t.assigned_to_name || t.solver_name;
            if (solverRaw) {
                const solver = getCleanName(t.assigned_to, t.assigned_to_name || t.solver_name) || t.assigned_to_name || t.solver_name || t.assigned_to;
                if (solver && solver.toLowerCase() !== 'unassigned' && solver.toLowerCase() !== 'nan') {
                    if (!stats[solver]) stats[solver] = { user: solver, Assigned: 0, ActiveLoad: 0, Resolved: 0, SLA: 0 };
                    stats[solver].Assigned += 1;
                    const st = (t.status || '').toLowerCase();
                    const ct = (t.closure_type || '').toLowerCase();
                    if (st === 'resolved' || st === 'closed' || ct === 'resolved' || ct === 'closed' || ct === 'accepted') {
                        stats[solver].Resolved += 1;
                    } else if (st === 'open' || st === 'in progress' || st === 'on hold') {
                        stats[solver].ActiveLoad += 1;
                    }
                    if (checkTicketLate(t)) {
                        stats[solver].SLA += 1;
                    }
                }
            }
        });
        return Object.values(stats).sort((a, b) => b.Assigned - a.Assigned).slice(0, 15);
    }, [filteredTickets, getCleanName, checkTicketLate]);

    const raisedStats = useMemo(() => {
        const stats = {};
        filteredTickets.forEach(t => {
            const raiser = getCleanName(t.raised_by, t.raiser_name) || t.raiser_name || t.raised_by || 'Unknown';
            if (raiser && raiser.toLowerCase() !== 'nan') {
                if (!stats[raiser]) stats[raiser] = { user: raiser, Raised: 0, Open: 0, Resolved: 0 };
                stats[raiser].Raised += 1;
                const st = (t.status || '').toLowerCase();
                const ct = (t.closure_type || '').toLowerCase();
                if (st === 'resolved' || st === 'closed' || ct === 'resolved' || ct === 'closed' || ct === 'accepted') {
                    stats[raiser].Resolved += 1;
                } else {
                    stats[raiser].Open += 1;
                }
            }
        });
        return Object.values(stats).sort((a, b) => b.Raised - a.Raised).slice(0, 15);
    }, [filteredTickets, getCleanName]);

    const localStats = useMemo(() => {
        if (!enlargedChart) return [];
        if (enlargedChart === 'deptStats' || enlargedChart === 'statusBreakdown') {
            const stats = {};
            localFilteredTickets.forEach(t => {
                const d = t.dept_assigned || t.department || 'General';
                if (!stats[d]) stats[d] = { department: d, total: 0, Open: 0, 'In Progress': 0, Resolved: 0, Closed: 0, Declined: 0, 'On Hold': 0, Escalated: 0 };
                stats[d].total += 1;
                const norm = normalizeStatus(t.status, t.closure_type);
                if (stats[d][norm] !== undefined) {
                    stats[d][norm] += 1;
                } else {
                    stats[d][norm] = 1;
                }
            });
            return Object.values(stats).sort((a, b) => b.total - a.total);
        }
        if (enlargedChart === 'locationLoad') {
            const stats = {};
            localFilteredTickets.forEach(t => {
                const l = t.location || t.project || 'General';
                if (!stats[l]) stats[l] = { location: l, tickets: 0, Open: 0, 'In Progress': 0, Resolved: 0, Closed: 0, Declined: 0, 'On Hold': 0, Escalated: 0 };
                stats[l].tickets += 1;
                const norm = normalizeStatus(t.status, t.closure_type);
                if (stats[l][norm] !== undefined) {
                    stats[l][norm] += 1;
                } else {
                    stats[l][norm] = 1;
                }
            });
            return Object.values(stats).sort((a, b) => b.tickets - a.tickets).slice(0, 10);
        }
        if (enlargedChart === 'dateTrend') {
            const counts = {};
            localFilteredTickets.forEach(t => {
                if (!t.timestamp) return;
                const date = t.timestamp.split(' ')[0];
                counts[date] = (counts[date] || 0) + 1;
            });
            return Object.keys(counts).sort((a, b) => {
                const [d1, m1, y1] = a.split('-'); const [d2, m2, y2] = b.split('-');
                return new Date(y1, m1 - 1, d1) - new Date(y2, m2 - 1, d2);
            }).map(date => ({ date, tickets: counts[date] }));
        }
        if (enlargedChart === 'assignedStats') {
            const stats = {};
            localFilteredTickets.forEach(t => {
                const solverRaw = t.assigned_to || t.assigned_to_name || t.solver_name;
                if (solverRaw) {
                    const solver = getCleanName(t.assigned_to, t.assigned_to_name || t.solver_name) || t.assigned_to_name || t.solver_name || t.assigned_to;
                    if (solver && solver.toLowerCase() !== 'unassigned' && solver.toLowerCase() !== 'nan') {
                        if (!stats[solver]) stats[solver] = { user: solver, Assigned: 0, ActiveLoad: 0, Resolved: 0, SLA: 0 };
                        stats[solver].Assigned += 1;
                        const st = (t.status || '').toLowerCase();
                        const ct = (t.closure_type || '').toLowerCase();
                        if (st === 'resolved' || st === 'closed' || ct === 'resolved' || ct === 'closed' || ct === 'accepted') {
                            stats[solver].Resolved += 1;
                        } else if (st === 'open' || st === 'in progress' || st === 'on hold') {
                            stats[solver].ActiveLoad += 1;
                        }
                        if (checkTicketLate(t)) {
                            stats[solver].SLA += 1;
                        }
                    }
                }
            });
            return Object.values(stats).sort((a, b) => b.Assigned - a.Assigned).slice(0, 20);
        }
        if (enlargedChart === 'raisedStats') {
            const stats = {};
            localFilteredTickets.forEach(t => {
                const raiser = getCleanName(t.raised_by, t.raiser_name) || t.raiser_name || t.raised_by || 'Unknown';
                if (raiser && raiser.toLowerCase() !== 'nan') {
                    if (!stats[raiser]) stats[raiser] = { user: raiser, Raised: 0, Open: 0, Resolved: 0 };
                    stats[raiser].Raised += 1;
                    const st = (t.status || '').toLowerCase();
                    const ct = (t.closure_type || '').toLowerCase();
                    if (st === 'resolved' || st === 'closed' || ct === 'resolved' || ct === 'closed' || ct === 'accepted') {
                        stats[raiser].Resolved += 1;
                    } else {
                        stats[raiser].Open += 1;
                    }
                }
            });
            return Object.values(stats).sort((a, b) => b.Raised - a.Raised).slice(0, 20);
        }
        if (enlargedChart === 'globalPie') {
            const counts = {};
            localFilteredTickets.forEach(t => {
                const norm = normalizeStatus(t.status, t.closure_type);
                counts[norm] = (counts[norm] || 0) + 1;
            });
            return Object.keys(counts).filter(k => counts[k] > 0).map(k => ({ name: k, value: counts[k] }));
        }
        if (enlargedChart === 'categoryStats') {
            const stats = {};
            localFilteredTickets.forEach(t => {
                const cat = t.issue_category || t.category || 'General';
                if (!stats[cat]) stats[cat] = { category: cat, tickets: 0 };
                stats[cat].tickets += 1;
            });
            return Object.values(stats).sort((a, b) => b.tickets - a.tickets).slice(0, 15);
        }
        if (enlargedChart === 'slaDeptStats') {
            const stats = {};
            localFilteredTickets.forEach(t => {
                const d = t.dept_assigned || t.department || 'General';
                if (!stats[d]) stats[d] = { department: d, compliant: 0, breached: 0, total: 0 };
                stats[d].total += 1;
                if (checkTicketLate(t, currentSlaBreachMode)) stats[d].breached += 1;
                else stats[d].compliant += 1;
            });
            return Object.values(stats).sort((a, b) => b.total - a.total);
        }
        if (enlargedChart === 'escalationStats') {
            const counts = { 'L1': 0, 'L2': 0, 'L3': 0, 'L4': 0, 'L5': 0 };
            localFilteredTickets.forEach(t => {
                const lvl = (t.escalation_level || 'L1').toUpperCase();
                if (counts[lvl] !== undefined) counts[lvl]++;
                else counts['L1']++;
            });
            return Object.keys(counts).filter(k => counts[k] > 0).map(k => ({ name: k, value: counts[k] }));
        }
        if (enlargedChart === 'turnaroundStats') {
            const stats = {};
            localFilteredTickets.forEach(t => {
                const st = (t.status || '').toLowerCase();
                if (st === 'resolved' || st === 'closed') {
                    const d = t.dept_assigned || t.department || 'General';
                    let days = 0;
                    if (t.solver_resolution_hours && Number(t.solver_resolution_hours) > 0) {
                        days = Number(t.solver_resolution_hours) / 24;
                    } else if (t.total_turnaround_hours && Number(t.total_turnaround_hours) > 0) {
                        days = Number(t.total_turnaround_hours) / 24;
                    } else if (t.ticket_age_hours && Number(t.ticket_age_hours) > 0) {
                        days = Number(t.ticket_age_hours) / 24;
                    }
                    if (days > 0) {
                        if (!stats[d]) stats[d] = { department: d, totalDays: 0, count: 0 };
                        stats[d].totalDays += days;
                        stats[d].count += 1;
                    }
                }
            });
            return Object.values(stats)
                .map(s => ({ department: s.department, avgDays: Number((s.totalDays / s.count).toFixed(1)), count: s.count }))
                .sort((a, b) => a.avgDays - b.avgDays);
        }
        return [];
    }, [localFilteredTickets, enlargedChart, currentSlaBreachMode]);

    const openEnlargedChart = (chart) => {
        setEnlargedChart(chart);
        setLocalFilterDept('');
        setLocalFilterLocation('');
        setLocalFilterStatus('');
        setLocalFilterTime('');
    };

    const maxAssignedTotal = assignedStats.length > 0 ? Math.max(...assignedStats.map(u => u.Assigned || 0)) : 0;
    const maxRaisedTotal = raisedStats.length > 0 ? Math.max(...raisedStats.map(u => u.Raised || 0)) : 0;
    const maxDeptTotal = deptStats.length > 0 ? deptStats[0].total : 0;
    const maxLocTotal = locationLoad.length > 0 ? locationLoad[0].tickets : 0;
    const maxCatTotal = categoryStats.length > 0 ? categoryStats[0].tickets : 0;

    const getTickCount = (maxVal) => {
        const domainMax = maxVal === 0 ? 4 : maxVal + 2;
        return domainMax <= 5 ? domainMax + 1 : 5;
    };

    // --- GRADIENT DEFINITIONS (shared across charts) ---
    const GradientDefs = () => (
        <defs>
            <linearGradient id="gradUser1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.8} />
            </linearGradient>
            <linearGradient id="gradUser2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity={1} />
                <stop offset="100%" stopColor="#d97706" stopOpacity={0.8} />
            </linearGradient>
            <linearGradient id="gradArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gradAreaStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
            {GRADIENT_PAIRS.map((pair, i) => (
                <linearGradient key={`grad-h-${i}`} id={`gradH${i}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={pair.start} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={pair.end} stopOpacity={1} />
                </linearGradient>
            ))}
        </defs>
    );

    const renderEnlargedChart = () => {
        if (enlargedChart === 'deptStats') {
            const maxVal = localStats.length > 0 ? Math.max(...localStats.map(s => s.total)) : 0;
            return (
                <BarChart data={localStats} layout="vertical" margin={{ left: 50, right: 30 }} barCategoryGap="20%">
                    <GradientDefs />
                    <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" domain={[0, maxVal <= 0 ? 4 : maxVal + 2]} tickCount={getTickCount(maxVal)} tick={{ fontSize: 12, fill: '#a1a1aa' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="department" tick={{ fontSize: 12, fill: '#d4d4d8' }} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<CustomTooltip />} />
                    <Bar dataKey="total" radius={[0, 6, 6, 0]} maxBarSize={50} animationDuration={800}>
                        <LabelList dataKey="total" position="insideRight" fill="#fff" fontSize={12} fontWeight={600} />
                        {localStats.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={`url(#gradH${index % GRADIENT_PAIRS.length})`} />
                        ))}
                    </Bar>
                </BarChart>
            );
        }
        if (enlargedChart === 'dateTrend') return (
            <AreaChart data={localStats}>
                <GradientDefs />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#a1a1aa' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }} content={<CustomTooltip />} />
                <Area type="monotone" dataKey="tickets" stroke="url(#gradAreaStroke)" strokeWidth={2.5} fillOpacity={1} fill="url(#gradArea)" name="Tickets Raised" dot={{ fill: '#6366f1', strokeWidth: 0, r: 3 }} activeDot={{ r: 5, fill: '#818cf8', stroke: '#6366f1', strokeWidth: 2 }} />
            </AreaChart>
        );
        if (enlargedChart === 'assignedStats') {
            const maxVal = localStats.length > 0 ? Math.max(...localStats.map(u => u.Assigned || 0)) : 0;
            return (
                <BarChart data={localStats} margin={{ top: 20, right: 20, left: 10, bottom: 20 }} barCategoryGap="20%">
                    <GradientDefs />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} horizontal={true} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="user" tick={{ fontSize: 11, fill: '#d4d4d8' }} tickLine={false} axisLine={false} angle={-45} textAnchor="end" height={80} />
                    <YAxis domain={[0, maxVal <= 0 ? 4 : maxVal + 2]} tickCount={getTickCount(maxVal)} tick={{ fontSize: 12, fill: '#a1a1aa' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<CustomTooltip />} />
                    <Bar dataKey="Assigned" name="Assigned" fill="url(#gradUser2)" radius={[6, 6, 0, 0]} maxBarSize={50}>
                        <LabelList dataKey="Assigned" position="top" fill="#f59e0b" fontSize={12} fontWeight={600} />
                    </Bar>
                </BarChart>
            );
        }
        if (enlargedChart === 'raisedStats') {
            const maxVal = localStats.length > 0 ? Math.max(...localStats.map(u => u.Raised || 0)) : 0;
            return (
                <BarChart data={localStats} margin={{ top: 20, right: 20, left: 10, bottom: 20 }} barCategoryGap="20%">
                    <GradientDefs />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} horizontal={true} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="user" tick={{ fontSize: 11, fill: '#d4d4d8' }} tickLine={false} axisLine={false} angle={-45} textAnchor="end" height={80} />
                    <YAxis domain={[0, maxVal <= 0 ? 4 : maxVal + 2]} tickCount={getTickCount(maxVal)} tick={{ fontSize: 12, fill: '#a1a1aa' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<CustomTooltip />} />
                    <Bar dataKey="Raised" name="Raised" fill="url(#gradUser1)" radius={[6, 6, 0, 0]} maxBarSize={50}>
                        <LabelList dataKey="Raised" position="top" fill="#818cf8" fontSize={12} fontWeight={600} />
                    </Bar>
                </BarChart>
            );
        }
        if (enlargedChart === 'statusBreakdown') return (
            <BarChart data={localStats} stackOffset="expand">
                <GradientDefs />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="department" tick={{ fontSize: 12, fill: '#d4d4d8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#a1a1aa' }} tickLine={false} axisLine={false} tickFormatter={(tick) => `${tick * 100}%`} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<CustomTooltip />} />
                <Legend content={<CustomLegend />} />
                <Bar dataKey="Open" stackId="a" fill={STATUS_COLORS['Open']} />
                <Bar dataKey="In Progress" stackId="a" fill={STATUS_COLORS['In Progress']} />
                <Bar dataKey="Resolved" stackId="a" fill={STATUS_COLORS['Resolved']} />
                <Bar dataKey="Closed" stackId="a" fill={STATUS_COLORS['Closed']} />
            </BarChart>
        );
        if (enlargedChart === 'locationLoad') {
            const maxVal = localStats.length > 0 ? localStats[0].tickets : 0;
            return (
                <BarChart data={localStats} layout="vertical" margin={{ left: 50, right: 30 }} barCategoryGap="20%">
                    <GradientDefs />
                    <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" domain={[0, maxVal <= 0 ? 4 : maxVal + 2]} tickCount={getTickCount(maxVal)} tick={{ fontSize: 12, fill: '#a1a1aa' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis dataKey="location" type="category" tick={{ fontSize: 12, fill: '#d4d4d8' }} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<CustomTooltip />} />
                    <Bar dataKey="tickets" radius={[0, 6, 6, 0]} maxBarSize={50} animationDuration={800}>
                        <LabelList dataKey="tickets" position="insideRight" fill="#fff" fontSize={12} fontWeight={600} />
                        {localStats.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={`url(#gradH${index % GRADIENT_PAIRS.length})`} />
                        ))}
                    </Bar>
                </BarChart>
            );
        }
        if (enlargedChart === 'globalPie') {
            const total = localStats.reduce((s, e) => s + e.value, 0);
            return (
                <PieChart>
                    <Pie
                        data={localStats}
                        cx="50%"
                        cy="45%"
                        innerRadius="45%"
                        outerRadius="72%"
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        labelLine={{ stroke: 'var(--text-muted)', strokeWidth: 1 }}
                        animationDuration={800}
                        stroke="rgba(0,0,0,0.2)"
                        strokeWidth={1}
                    >
                        {localStats.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || GRADIENT_PAIRS[index % GRADIENT_PAIRS.length].start} />
                        ))}
                    </Pie>
                    <Tooltip cursor={false} content={<CustomTooltip />} />
                    <Legend content={<CustomLegend />} />
                    <PieCenterLabel total={total} cy="45%" />
                </PieChart>
            );
        }
        if (enlargedChart === 'categoryStats') {
            const maxVal = localStats.length > 0 ? localStats[0].tickets : 0;
            return (
                <BarChart data={localStats} layout="vertical" margin={{ left: 50, right: 30 }} barCategoryGap="20%">
                    <GradientDefs />
                    <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" domain={[0, maxVal <= 0 ? 4 : maxVal + 2]} tickCount={getTickCount(maxVal)} tick={{ fontSize: 12, fill: '#a1a1aa' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis dataKey="category" type="category" tick={{ fontSize: 12, fill: '#d4d4d8' }} tickLine={false} axisLine={false} width={130} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<CustomTooltip />} />
                    <Bar dataKey="tickets" radius={[0, 6, 6, 0]} maxBarSize={50} animationDuration={800}>
                        <LabelList dataKey="tickets" position="insideRight" fill="#fff" fontSize={12} fontWeight={600} />
                        {localStats.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={`url(#gradH${index % GRADIENT_PAIRS.length})`} />
                        ))}
                    </Bar>
                </BarChart>
            );
        }
        if (enlargedChart === 'slaDeptStats') {
            return (
                <BarChart data={localStats} margin={{ top: 20, right: 30, left: 20 }}>
                    <GradientDefs />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="department" tick={{ fontSize: 12, fill: '#d4d4d8' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#a1a1aa' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<CustomTooltip />} />
                    <Legend content={<CustomLegend />} />
                    <Bar dataKey="compliant" name="Within SLA" stackId="a" fill="#10b981" maxBarSize={60} />
                    <Bar dataKey="breached" name="SLA Breached" stackId="a" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={60} />
                </BarChart>
            );
        }
        if (enlargedChart === 'escalationStats') {
            const total = localStats.reduce((s, e) => s + e.value, 0);
            return (
                <PieChart>
                    <Pie
                        data={localStats}
                        cx="50%"
                        cy="45%"
                        innerRadius="45%"
                        outerRadius="72%"
                        paddingAngle={4}
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        labelLine={{ stroke: 'var(--text-muted)', strokeWidth: 1 }}
                        animationDuration={800}
                        stroke="rgba(0,0,0,0.2)"
                        strokeWidth={1}
                    >
                        {localStats.map((entry, index) => {
                            const escColors = { 'L1': '#3b82f6', 'L2': '#8b5cf6', 'L3': '#f59e0b', 'L4': '#f97316', 'L5': '#ef4444' };
                            return <Cell key={`cell-${index}`} fill={escColors[entry.name] || GRADIENT_PAIRS[index % GRADIENT_PAIRS.length].start} />;
                        })}
                    </Pie>
                    <Tooltip cursor={false} content={<CustomTooltip />} />
                    <Legend content={<CustomLegend />} />
                    <PieCenterLabel total={total} cy="45%" />
                </PieChart>
            );
        }
        if (enlargedChart === 'turnaroundStats') {
            return (
                <BarChart data={localStats} margin={{ top: 20, right: 30, left: 20 }}>
                    <defs>
                        <linearGradient id="turnGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#14b8a6" stopOpacity={1} />
                            <stop offset="100%" stopColor="#0d9488" stopOpacity={0.7} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="department" tick={{ fontSize: 12, fill: '#d4d4d8' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#a1a1aa' }} tickLine={false} axisLine={false} unit="d" />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} formatter={(val) => [`${val} Days`, 'Avg Turnaround']} />
                    <Bar dataKey="avgDays" name="Avg Turnaround (Days)" fill="url(#turnGrad)" radius={[6, 6, 0, 0]} maxBarSize={50}>
                        <LabelList dataKey="avgDays" position="top" fill="#14b8a6" fontSize={11} fontWeight={600} formatter={(v) => `${v}d`} />
                    </Bar>
                </BarChart>
            );
        }
        return null;
    };



    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, minHeight: '600px' }}>


            {/* INLINE FILTERS & TOGGLE */}
            <div className="analytics-filter-bar" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', minHeight: '32px' }}>

                <div className="analytics-filter-inputs" style={{
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'center',
                    overflow: showFilters ? 'visible' : 'hidden',
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    maxWidth: showFilters ? '800px' : '0px',
                    opacity: showFilters ? 1 : 0,
                    visibility: showFilters ? 'visible' : 'hidden'
                }}>
                    <div style={{ width: '155px' }}>
                        <SearchSelect options={uniqueDepts} value={filterDept} onChange={setFilterDept} placeholder="Department..." />
                    </div>
                    <div style={{ width: '155px' }}>
                        <SearchSelect options={uniqueLocations} value={filterLocation} onChange={setFilterLocation} placeholder="Location..." />
                    </div>
                    <div style={{ width: '155px' }}>
                        <SearchSelect options={uniqueStatuses} value={filterStatus} onChange={setFilterStatus} placeholder="Status..." />
                    </div>
                    <div style={{ width: '155px' }}>
                        <SearchSelect options={timeOptions} value={filterTime} onChange={setFilterTime} placeholder="Date Range" />
                    </div>
                    <button
                        className="btn"
                        onClick={() => { setFilterDept(''); setFilterLocation(''); setFilterStatus(''); setFilterTime(''); }}
                        style={{
                            backgroundColor: 'transparent', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444',
                            padding: '6px 12px', fontSize: '11px', borderRadius: '6px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <XCircle size={12} /> Clear
                    </button>
                </div>

                <button
                    className="btn"
                    onClick={() => setShowFilters(!showFilters)}
                    style={{
                        padding: '6px 14px', fontSize: '11px', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap',
                        backgroundColor: showFilters ? 'rgba(99,102,241,0.15)' : 'transparent',
                        border: `1px solid ${showFilters ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.1)'}`,
                        color: showFilters ? '#818cf8' : 'var(--text-muted)',
                        borderRadius: '6px', cursor: 'pointer',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <Filter size={12} /> {showFilters ? 'Hide Filters' : 'Filter Analytics'}
                </button>

                <button
                    className="btn"
                    onClick={() => exportExecutivePDF(filteredTickets, { dept: filterDept, time: filterTime })}
                    style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        padding: '6px 14px', fontSize: '11px', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap',
                        borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s ease'
                    }}
                    title="Export Executive PDF Summary Report"
                >
                    <FileText size={12} /> PDF Report
                </button>

                <button
                    className="btn"
                    onClick={() => exportExecutiveCSV(filteredTickets, { dept: filterDept, time: filterTime })}
                    style={{
                        backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        padding: '6px 14px', fontSize: '11px', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap',
                        borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s ease'
                    }}
                    title="Export Executive CSV Report"
                >
                    <Download size={12} /> CSV Report
                </button>
            </div>

            {/* TREND SPARKLINE ROW */}
            {dateTrend.length > 1 && (
                <ChartCard
                    onClick={() => openEnlargedChart('dateTrend')}
                    title="Ticket Volume Trend"
                    subtitle={`${dateTrend.length} data points`}
                    icon={TrendingUp}
                    accentColor="#6366f1"
                    flex="none"
                    minWidth="auto"
                    style={{ height: '180px' }}
                >
                    <div style={{ flex: 1, minHeight: 0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={dateTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#71717a' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                                <YAxis tick={{ fontSize: 9, fill: '#71717a' }} tickLine={false} axisLine={false} allowDecimals={false} />
                                <Tooltip cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }} content={<CustomTooltip />} />
                                <Area type="monotone" dataKey="tickets" stroke="#818cf8" strokeWidth={2} fillOpacity={1} fill="url(#sparkGrad)" name="Tickets" dot={false} activeDot={{ r: 4, fill: '#818cf8', stroke: '#6366f1', strokeWidth: 2 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>
            )}

            {/* MAIN CHARTS ROW */}
            <div className="analytics-charts-row" style={{ display: 'flex', gap: '14px', flex: 1, minHeight: '360px', overflowX: 'auto', paddingBottom: '4px' }}>

                {/* 1. Ticket Count by Assigned To */}
                <ChartCard
                    onClick={() => openEnlargedChart('assignedStats')}
                    title="Ticket Count by Assigned To"
                    subtitle={`${assignedStats.length} solvers`}
                    icon={UserCheck}
                    accentColor="#f59e0b"
                    flex={1.15}
                    minWidth="280px"
                    style={{ height: '360px', minHeight: '360px' }}
                >
                    <div style={{ flex: 1, minHeight: '260px', height: '280px', position: 'relative' }}>
                        <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                            <BarChart data={assignedStats} margin={{ top: 20, right: 10, left: -10 }} barCategoryGap="18%">
                                <defs>
                                    <linearGradient id="ugrAssigned" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={1} />
                                        <stop offset="100%" stopColor="#d97706" stopOpacity={0.75} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} horizontal={true} stroke="rgba(255,255,255,0.04)" />
                                <XAxis dataKey="user" tick={{ fontSize: 9, fill: '#a1a1aa' }} tickLine={false} axisLine={false} angle={-35} textAnchor="end" height={55} />
                                <YAxis width={35} domain={[0, maxAssignedTotal <= 0 ? 4 : maxAssignedTotal + 2]} tickCount={getTickCount(maxAssignedTotal)} tick={{ fontSize: 10, fill: '#71717a' }} tickLine={false} axisLine={false} allowDecimals={false} />
                                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<CustomTooltip />} />
                                <Bar dataKey="Assigned" name="Assigned" fill="url(#ugrAssigned)" radius={[5, 5, 0, 0]} maxBarSize={32}>
                                    <LabelList dataKey="Assigned" position="top" fill="#f59e0b" fontSize={10} fontWeight={600} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>

                {/* 2. Ticket Count by Raiser */}
                <ChartCard
                    onClick={() => openEnlargedChart('raisedStats')}
                    title="Ticket Count by Raiser"
                    subtitle={`${raisedStats.length} requestors`}
                    icon={Users}
                    accentColor="#6366f1"
                    flex={1.15}
                    minWidth="280px"
                    style={{ height: '360px', minHeight: '360px' }}
                >
                    <div style={{ flex: 1, minHeight: '260px', height: '280px', position: 'relative' }}>
                        <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                            <BarChart data={raisedStats} margin={{ top: 20, right: 10, left: -10 }} barCategoryGap="18%">
                                <defs>
                                    <linearGradient id="ugrRaised" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                                        <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.75} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} horizontal={true} stroke="rgba(255,255,255,0.04)" />
                                <XAxis dataKey="user" tick={{ fontSize: 9, fill: '#a1a1aa' }} tickLine={false} axisLine={false} angle={-35} textAnchor="end" height={55} />
                                <YAxis width={35} domain={[0, maxRaisedTotal <= 0 ? 4 : maxRaisedTotal + 2]} tickCount={getTickCount(maxRaisedTotal)} tick={{ fontSize: 10, fill: '#71717a' }} tickLine={false} axisLine={false} allowDecimals={false} />
                                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<CustomTooltip />} />
                                <Bar dataKey="Raised" name="Raised" fill="url(#ugrRaised)" radius={[5, 5, 0, 0]} maxBarSize={32}>
                                    <LabelList dataKey="Raised" position="top" fill="#818cf8" fontSize={10} fontWeight={600} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 2, minWidth: '380px', height: '360px' }}>
                    {/* 2. Ticket Volume by Dept */}
                    <ChartCard
                        onClick={() => openEnlargedChart('deptStats')}
                        title="Volume by Department"
                        icon={BarChart3}
                        accentColor="#f59e0b"
                        flex={1}
                        minWidth="auto"
                        style={{ height: 'calc(50% - 7px)', minHeight: '170px' }}
                    >
                        <div style={{ flex: 1, minHeight: '110px', height: '100%', position: 'relative' }}>
                            <ResponsiveContainer width="100%" height="100%" minHeight={100}>
                                <BarChart data={deptStats} layout="vertical" margin={{ left: 15, right: 30 }} barCategoryGap="18%">
                                    <defs>
                                        {GRADIENT_PAIRS.map((pair, i) => (
                                            <linearGradient key={`dg-${i}`} id={`deptGrad${i}`} x1="0" y1="0" x2="1" y2="0">
                                                <stop offset="0%" stopColor={pair.start} stopOpacity={0.85} />
                                                <stop offset="100%" stopColor={pair.end} stopOpacity={1} />
                                            </linearGradient>
                                        ))}
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={false} stroke="rgba(255,255,255,0.04)" />
                                    <XAxis type="number" domain={[0, maxDeptTotal <= 0 ? 4 : maxDeptTotal + 2]} tickCount={getTickCount(maxDeptTotal)} tick={{ fontSize: 9, fill: '#71717a' }} tickLine={false} axisLine={false} allowDecimals={false} />
                                    <YAxis type="category" dataKey="department" tick={{ fontSize: 9, fill: '#a1a1aa' }} tickLine={false} axisLine={false} width={80} />
                                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<CustomTooltip />} allowEscapeViewBox={{ x: true, y: true }} position={{ y: 0 }} wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }} />
                                    <Bar dataKey="total" radius={[0, 5, 5, 0]} maxBarSize={28} animationDuration={600}>
                                        <LabelList dataKey="total" position="insideRight" fill="#fff" fontSize={9} fontWeight={600} />
                                        {deptStats.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={`url(#deptGrad${index % GRADIENT_PAIRS.length})`} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </ChartCard>

                    {/* 3. Ticket Volume by Location */}
                    <ChartCard
                        onClick={() => openEnlargedChart('locationLoad')}
                        title="Volume by Location"
                        subtitle="Top 10"
                        icon={MapPin}
                        accentColor="#10b981"
                        flex={1}
                        minWidth="auto"
                        style={{ height: 'calc(50% - 7px)', minHeight: '170px' }}
                    >
                        <div style={{ flex: 1, minHeight: '110px', height: '100%', position: 'relative' }}>
                            <ResponsiveContainer width="100%" height="100%" minHeight={100}>
                                <BarChart data={locationLoad} layout="vertical" margin={{ left: 15, right: 30 }} barCategoryGap="18%">
                                    <defs>
                                        {GRADIENT_PAIRS.map((pair, i) => (
                                            <linearGradient key={`lg-${i}`} id={`locGrad${i}`} x1="0" y1="0" x2="1" y2="0">
                                                <stop offset="0%" stopColor={pair.start} stopOpacity={0.85} />
                                                <stop offset="100%" stopColor={pair.end} stopOpacity={1} />
                                            </linearGradient>
                                        ))}
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={false} stroke="rgba(255,255,255,0.04)" />
                                    <XAxis type="number" domain={[0, maxLocTotal <= 0 ? 4 : maxLocTotal + 2]} tickCount={getTickCount(maxLocTotal)} tick={{ fontSize: 9, fill: '#71717a' }} tickLine={false} axisLine={false} allowDecimals={false} />
                                    <YAxis type="category" dataKey="location" tick={{ fontSize: 9, fill: '#a1a1aa' }} tickLine={false} axisLine={false} width={80} />
                                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<CustomTooltip />} allowEscapeViewBox={{ x: true, y: true }} position={{ y: 0 }} wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }} />
                                    <Bar dataKey="tickets" radius={[0, 5, 5, 0]} maxBarSize={28} animationDuration={600}>
                                        <LabelList dataKey="tickets" position="insideRight" fill="#fff" fontSize={9} fontWeight={600} />
                                        {locationLoad.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={`url(#locGrad${index % GRADIENT_PAIRS.length})`} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </ChartCard>
                </div>

                {/* 4. Status Distribution Donut */}
                <ChartCard
                    onClick={() => openEnlargedChart('globalPie')}
                    title="Status Distribution"
                    icon={CheckCircle}
                    accentColor="#8b5cf6"
                    flex={0.8}
                    minWidth="240px"
                    style={{ height: '360px', minHeight: '360px' }}
                >
                    <div style={{ flex: 1, minHeight: '260px', height: '280px', position: 'relative' }}>
                        <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                            <PieChart>
                                <Pie
                                    data={statusBreakdown}
                                    cx="50%"
                                    cy="45%"
                                    innerRadius="55%"
                                    outerRadius="85%"
                                    paddingAngle={3}
                                    dataKey="value"
                                    animationDuration={800}
                                    stroke="rgba(0,0,0,0.2)"
                                    strokeWidth={1}
                                >
                                    {statusBreakdown.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || GRADIENT_PAIRS[index % GRADIENT_PAIRS.length].start} />
                                    ))}
                                </Pie>
                                <Tooltip cursor={false} content={<CustomTooltip />} />
                                <Legend content={<CustomLegend />} />
                                <PieCenterLabel total={filteredTickets.length} cy="45%" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>

            </div>

            {/* SECONDARY ELABORATE CHARTS ROW */}
            <div className="analytics-charts-row" style={{ display: 'flex', gap: '14px', flex: 1, minHeight: '340px', overflowX: 'auto', paddingBottom: '4px' }}>

                {/* 5. Top Issue Categories */}
                <ChartCard
                    onClick={() => openEnlargedChart('categoryStats')}
                    title="Top Issue Categories"
                    subtitle="Most frequent issues"
                    icon={Tag}
                    accentColor="#0ea5e9"
                    flex={1.2}
                    minWidth="300px"
                    style={{ height: '340px', minHeight: '340px' }}
                >
                    <div style={{ flex: 1, minHeight: '240px', height: '260px', position: 'relative' }}>
                        <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                            <BarChart data={categoryStats} layout="vertical" margin={{ left: 10, right: 25 }} barCategoryGap="16%">
                                <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={false} stroke="rgba(255,255,255,0.04)" />
                                <XAxis type="number" domain={[0, maxCatTotal <= 0 ? 4 : maxCatTotal + 2]} tick={{ fontSize: 9, fill: '#71717a' }} tickLine={false} axisLine={false} allowDecimals={false} />
                                <YAxis type="category" dataKey="category" tick={{ fontSize: 9, fill: '#a1a1aa' }} tickLine={false} axisLine={false} width={100} />
                                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<CustomTooltip />} />
                                <Bar dataKey="tickets" radius={[0, 4, 4, 0]} maxBarSize={22} fill="#0ea5e9">
                                    <LabelList dataKey="tickets" position="insideRight" fill="#fff" fontSize={9} fontWeight={600} />
                                    {categoryStats.map((entry, index) => (
                                        <Cell key={`cat-${index}`} fill={GRADIENT_PAIRS[(index + 3) % GRADIENT_PAIRS.length].start} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>

                {/* 6. SLA Compliance by Department */}
                <ChartCard
                    onClick={() => openEnlargedChart('slaDeptStats')}
                    title="SLA Compliance by Department"
                    subtitle="Compliant vs Breached"
                    icon={ShieldAlert}
                    accentColor="#10b981"
                    flex={1.4}
                    minWidth="320px"
                    style={{ height: '340px', minHeight: '340px' }}
                >
                    <div style={{ flex: 1, minHeight: '240px', height: '260px', position: 'relative' }}>
                        <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                            <BarChart data={slaDeptStats} margin={{ top: 15, right: 10, left: -15 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                                <XAxis dataKey="department" tick={{ fontSize: 9, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                                <YAxis tick={{ fontSize: 9, fill: '#71717a' }} tickLine={false} axisLine={false} allowDecimals={false} />
                                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<CustomTooltip />} />
                                <Legend content={<CustomLegend />} />
                                <Bar dataKey="compliant" name="Within SLA" stackId="a" fill="#10b981" maxBarSize={30} />
                                <Bar dataKey="breached" name="SLA Breached" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={30} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>

                {/* 7. Escalation Distribution Donut */}
                <ChartCard
                    onClick={() => openEnlargedChart('escalationStats')}
                    title="Escalation Levels"
                    subtitle="L1 through L5 tiers"
                    icon={Layers}
                    accentColor="#f97316"
                    flex={0.8}
                    minWidth="230px"
                    style={{ height: '340px', minHeight: '340px' }}
                >
                    <div style={{ flex: 1, minHeight: '240px', height: '260px', position: 'relative' }}>
                        <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                            <PieChart>
                                <Pie
                                    data={escalationStats}
                                    cx="50%"
                                    cy="45%"
                                    innerRadius="50%"
                                    outerRadius="80%"
                                    paddingAngle={3}
                                    dataKey="value"
                                    animationDuration={800}
                                    stroke="rgba(0,0,0,0.2)"
                                    strokeWidth={1}
                                >
                                    {escalationStats.map((entry, index) => {
                                        const escColors = { 'L1': '#3b82f6', 'L2': '#8b5cf6', 'L3': '#f59e0b', 'L4': '#f97316', 'L5': '#ef4444' };
                                        return <Cell key={`esc-${index}`} fill={escColors[entry.name] || GRADIENT_PAIRS[index % GRADIENT_PAIRS.length].start} />;
                                    })}
                                </Pie>
                                <Tooltip cursor={false} content={<CustomTooltip />} />
                                <Legend content={<CustomLegend />} />
                                <PieCenterLabel total={filteredTickets.length} cy="45%" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>

                {/* 8. Avg Resolution Turnaround by Dept */}
                <ChartCard
                    onClick={() => openEnlargedChart('turnaroundStats')}
                    title="Avg Turnaround (Days)"
                    subtitle="Dept resolution speed"
                    icon={Clock}
                    accentColor="#14b8a6"
                    flex={1.1}
                    minWidth="280px"
                    style={{ height: '340px', minHeight: '340px' }}
                >
                    <div style={{ flex: 1, minHeight: '240px', height: '260px', position: 'relative' }}>
                        <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                            <BarChart data={turnaroundStats} margin={{ top: 20, right: 10, left: -15 }}>
                                <defs>
                                    <linearGradient id="turnSmallGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#14b8a6" stopOpacity={1} />
                                        <stop offset="100%" stopColor="#0d9488" stopOpacity={0.7} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                                <XAxis dataKey="department" tick={{ fontSize: 9, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                                <YAxis tick={{ fontSize: 9, fill: '#71717a' }} tickLine={false} axisLine={false} unit="d" />
                                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} formatter={(val) => [`${val} Days`, 'Avg Turnaround']} />
                                <Bar dataKey="avgDays" name="Avg Turnaround" fill="url(#turnSmallGrad)" radius={[4, 4, 0, 0]} maxBarSize={28}>
                                    <LabelList dataKey="avgDays" position="top" fill="#14b8a6" fontSize={9} fontWeight={600} formatter={(v) => `${v}d`} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>

            </div>

            {/* ENLARGED CHART MODAL */}
            {enlargedChart && (
                <div
                    className="glass-overlay"
                    style={{
                        position: 'fixed', inset: 0,
                        zIndex: 9999,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '24px',
                        animation: 'fadeIn 0.2s ease-out'
                    }}
                    onClick={() => setEnlargedChart(null)}
                >
                    <div
                        className="glass-modal"
                        style={{
                            width: '90vw', height: '85vh', maxWidth: '1100px',
                            padding: '24px 32px', borderRadius: '16px',
                            display: 'flex', flexDirection: 'column', position: 'relative',
                            overflow: 'visible'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setEnlargedChart(null)}
                            style={{
                                position: 'absolute', top: '16px', right: '16px',
                                background: 'transparent',
                                border: '1px solid var(--border)',
                                color: 'var(--text-main)', cursor: 'pointer', padding: '6px',
                                borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <X size={18} />
                        </button>

                        <h3 style={{
                            margin: '0 0 4px 0', fontSize: '18px', fontWeight: 700,
                            color: 'var(--text-main)', textAlign: 'center', letterSpacing: '-0.01em'
                        }}>
                            {enlargedChart === 'deptStats' ? 'Ticket Volume by Department' :
                                enlargedChart === 'dateTrend' ? 'Historical Ticket Volume Trend' :
                                    enlargedChart === 'assignedStats' ? 'Ticket Count by Assigned To' :
                                        enlargedChart === 'raisedStats' ? 'Ticket Count by Raiser' :
                                            enlargedChart === 'statusBreakdown' ? 'Department Status Breakdown (100%)' :
                                                enlargedChart === 'locationLoad' ? 'Ticket Volume by Location (Top 10)' :
                                                    enlargedChart === 'categoryStats' ? 'Top Issue Categories' :
                                                        enlargedChart === 'slaDeptStats' ? 'SLA Compliance by Department' :
                                                            enlargedChart === 'escalationStats' ? 'Escalation Level Distribution' :
                                                                enlargedChart === 'turnaroundStats' ? 'Average Resolution Turnaround Time (Days)' :
                                                                    'Global Status Distribution'}
                        </h3>
                        <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
                            {localFilteredTickets.length} tickets • Click anywhere outside to close
                        </p>

                        {/* LOCAL FILTERS FOR ENLARGED CHART */}
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                            <div style={{ flex: '1 1 130px', minWidth: '120px', maxWidth: '180px' }}>
                                <SearchSelect options={uniqueDepts} value={localFilterDept} onChange={setLocalFilterDept} placeholder="Department..." />
                            </div>
                            <div style={{ flex: '1 1 130px', minWidth: '120px', maxWidth: '180px' }}>
                                <SearchSelect options={uniqueLocations} value={localFilterLocation} onChange={setLocalFilterLocation} placeholder="Location..." />
                            </div>
                            <div style={{ flex: '1 1 130px', minWidth: '120px', maxWidth: '180px' }}>
                                <SearchSelect options={uniqueStatuses} value={localFilterStatus} onChange={setLocalFilterStatus} placeholder="Status..." />
                            </div>
                            <div style={{ flex: '1 1 120px', minWidth: '110px', maxWidth: '160px' }}>
                                <SearchSelect options={timeOptions} value={localFilterTime} onChange={setLocalFilterTime} placeholder="Date Range" />
                            </div>
                            <button
                                className="btn"
                                onClick={() => {
                                    setLocalFilterDept('');
                                    setLocalFilterLocation('');
                                    setLocalFilterStatus('');
                                    setLocalFilterTime('');
                                }}
                                style={{
                                    backgroundColor: 'transparent', border: '1px solid rgba(239,68,68,0.4)',
                                    color: '#ef4444', padding: '6px 12px', fontSize: '11px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    gap: '4px', whiteSpace: 'nowrap', borderRadius: '6px', cursor: 'pointer',
                                    height: '34px'
                                }}
                            >
                                <XCircle size={12} /> Clear Filters
                            </button>
                        </div>

                        <div style={{ flex: 1, minHeight: '380px', height: '100%', width: '100%', display: 'flex', justifyContent: 'center', position: 'relative' }}>
                            <div style={{ width: '100%', maxWidth: '1000px', height: '100%', minHeight: '360px', position: 'relative' }}>
                                <ResponsiveContainer width="100%" height="100%" minHeight={320}>
                                    {renderEnlargedChart()}
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* INLINE KEYFRAME ANIMATION */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default AdminAnalytics;