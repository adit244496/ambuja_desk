import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api, { fetchTickets, fetchUsers } from '../api';
import Layout from '../components/Layout';
import DocumentPreview from '../components/DocumentPreview';
import AttachmentBadge from '../components/AttachmentBadge';
import AdminAnalytics from '../components/AdminAnalytics';
import SLACountdownBadge from '../components/SLACountdownBadge';
import SLABreachModeToggle from '../components/SLABreachModeToggle';
import { exportExecutivePDF, exportExecutiveCSV } from '../utils/exportExecutiveReports';
import { parseDateToTimestamp, parseDateString, getISTDate } from '../utils/dateUtils';
import { TrendingUp, Clock, Download, FileText, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, PlusCircle, ArrowUpRight, RefreshCw, CheckCircle, UserPlus, Activity, Maximize2, Minimize2, MessageSquare, Filter } from 'lucide-react';

// --- COLLAPSIBLE TIMELINE NODE ---
const CollapsibleTimelineNode = ({ log, iconColor, Icon, toName }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    let detailsText = String(log.details || '').replace('nan', '').trim();
    if (log.action === 'Deadline Extended' && detailsText.startsWith('Changed from')) {
        detailsText = detailsText.replace('Changed from', 'Deadline changed from');
    }
    const remarksText = String(log.remarks || '').replace('nan', '').trim();
    const hasDetails = detailsText !== '';
    const hasRemarks = remarksText !== '';
    const hasAttachment = log.attachment && log.attachment !== 'nan' && log.attachment !== '';

    const isCollapsible = true;

    return (
        <div style={{ position: 'relative', marginBottom: '16px' }}>
            <div style={{ position: 'absolute', left: '-33px', top: '4px', width: '24px', height: '24px', borderRadius: '50%', backgroundColor: `${iconColor}20`, border: `1px solid ${iconColor}80`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: iconColor, zIndex: 2 }}>
                <Icon size={12} strokeWidth={2.5} />
            </div>
            <div
                onClick={() => isCollapsible && setIsExpanded(!isExpanded)}
                style={{
                    backgroundColor: 'var(--bg-card, #ffffff)', border: '1px solid var(--border, #e4e4e7)', padding: '12px 14px', borderRadius: '6px', marginLeft: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    cursor: isCollapsible ? 'pointer' : 'default', transition: 'background-color 0.2s',
                    position: 'relative'
                }}
            >
                {/* MINIMAL TOP BAR */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '13px', color: 'var(--text-main, #18181b)', letterSpacing: '0.2px' }}>{log.action}</strong>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted, #a1a1aa)' }}>{log.timestamp?.split(' ')[0]}</span>
                        {isCollapsible && (
                            <div style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s', display: 'flex', alignItems: 'center', color: 'var(--text-muted, #a1a1aa)' }}>
                                <ChevronDown size={14} />
                            </div>
                        )}
                    </div>
                </div>

                {/* DROPDOWN DETAILS */}
                <div style={{
                    maxHeight: isExpanded ? '500px' : '0px',
                    overflow: 'hidden',
                    transition: 'max-height 0.3s ease, opacity 0.3s ease',
                    opacity: isExpanded ? 1 : 0
                }}>
                    <div style={{ paddingTop: '12px', marginTop: '12px', borderTop: '1px solid var(--border, #e4e4e7)', display: 'flex', flexDirection: 'column', gap: '10px' }}>

                        <div style={{ fontSize: '11px', color: 'var(--text-muted, #a1a1aa)' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-main, #18181b)' }}>Action By:</span> {log.user || log.user_id || 'System'}
                            {toName && <span style={{ marginLeft: '16px' }}><span style={{ fontWeight: 600, color: 'var(--text-main, #18181b)' }}>Target:</span> <span style={{ color: '#3b82f6' }}>{toName}</span></span>}
                        </div>

                        {(hasDetails || hasRemarks) && (
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary, #3f3f46)', lineHeight: '1.5', padding: '10px 12px', backgroundColor: 'var(--bg-subtle, #f4f4f5)', borderRadius: '4px', borderLeft: `3px solid ${iconColor}` }}>
                                {hasDetails && <div style={{ marginBottom: hasRemarks ? '6px' : '0', color: 'var(--text-muted, #a1a1aa)' }}><strong style={{ color: 'var(--text-main, #18181b)' }}>System Info:</strong> {detailsText}</div>}
                                {hasRemarks && <div><strong style={{ color: 'var(--text-main, #18181b)' }}>Remarks / Reason:</strong> <span style={{ color: 'var(--text-secondary, #3f3f46)' }}>{remarksText}</span></div>}
                            </div>
                        )}

                        {hasAttachment && (
                            <div
                                style={{ width: '56px', height: '56px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border, #e4e4e7)', cursor: 'pointer', position: 'relative', marginTop: '4px' }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const fileUrl = String(log.attachment).startsWith('data:') || String(log.attachment).startsWith('http') ? String(log.attachment) : `/uploads/${log.attachment}`;
                                    const extMatch = String(log.attachment).match(/\.(pdf|docx|doc|xlsx|xls|csv|jpg|jpeg|png|gif|webp)$/i);
                                    const ext = extMatch ? extMatch[1].toLowerCase() : '';
                                    if (ext === 'pdf') {
                                        window.open(fileUrl, '_blank');
                                    } else if (['docx', 'doc', 'xlsx', 'xls', 'csv'].includes(ext)) {
                                        const link = document.createElement('a');
                                        link.href = fileUrl;
                                        link.download = String(log.attachment);
                                        link.target = '_blank';
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                    } else {
                                        window.open(fileUrl, '_blank');
                                    }
                                }}
                                title={`Click to ${String(log.attachment).match(/\.(xlsx|xls|doc|docx|csv)$/i) ? 'download' : 'view'} ${log.attachment}`}
                            >
                                {String(log.attachment).match(/\.(xlsx|xls|doc|docx|pdf|csv)$/i) ? (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f4f5' }}>
                                        <FileText size={20} color={String(log.attachment).match(/\.pdf$/i) ? '#ef4444' : '#3b82f6'} />
                                        <span style={{ fontSize: '7.5px', marginTop: '2px', fontWeight: 'bold', color: String(log.attachment).match(/\.pdf$/i) ? '#ef4444' : '#3b82f6' }}>
                                            {String(log.attachment).split('.').pop().toUpperCase()}
                                        </span>
                                    </div>
                                ) : (
                                    <img src={String(log.attachment).startsWith('data:') || String(log.attachment).startsWith('http') ? String(log.attachment) : `/uploads/${log.attachment}`} alt="Attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const ViewerDashboard = ({ user, setUser }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('analytics');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showKPIs, setShowKPIs] = useState(true);
    const [slaBreachMode, setSlaBreachMode] = useState('active'); // 'active' (Live / Active Breach) or 'all' (All-Time SLA Breach)
    const [previewUrl, setPreviewUrl] = useState(null);
    const handlePreviewUrl = (url) => {
        if (!url) return;
        const cleanUrl = String(url).split('?')[0];
        if (cleanUrl.toLowerCase().endsWith('.doc')) {
            window.open(url, '_blank');
        } else {
            setPreviewUrl(url);
        }
    };

    const getDisplayDelayDays = (row) => {
        if (!row) return '0d';
        if (row.solver_delay_hours !== undefined && row.solver_delay_hours !== null && Number(row.solver_delay_hours) > 0) {
            return (Number(row.solver_delay_hours) / 24).toFixed(1) + 'd';
        }
        if (row.delay_hours !== undefined && row.delay_hours !== null && Number(row.delay_hours) > 0) {
            return (Number(row.delay_hours) / 24).toFixed(1) + 'd';
        }
        if (!row.deadline || String(row.deadline).toLowerCase() === 'nan') return '0d';
        const deadlineDate = parseDateString(row.deadline);
        if (!deadlineDate) return '0d';

        const st = String(row.status || '').toLowerCase();
        const ct = String(row.closure_type || '').toLowerCase();
        const isFinished = ['closed', 'declined', 'on hold', 'on-hold'].includes(st) || ['declined', 'on hold'].includes(ct);

        if (isFinished) {
            const finishStr = row.closed_timestamp || row.solved_timestamp;
            if (finishStr && String(finishStr).toLowerCase() !== 'nan') {
                const finishDate = parseDateString(finishStr);
                if (finishDate) {
                    const diffMs = finishDate.getTime() - deadlineDate.getTime();
                    return diffMs > 0 ? (diffMs / (1000 * 60 * 60 * 24)).toFixed(1) + 'd' : '0d';
                }
            }
            return '0d';
        } else {
            const diffMs = getISTDate().getTime() - deadlineDate.getTime();
            return diffMs > 0 ? (diffMs / (1000 * 60 * 60 * 24)).toFixed(1) + 'd' : '0d';
        }
    };

    const [ticketsList, setTicketsList] = useState([]);
    const [usersList, setUsersList] = useState([]);

    // --- AGEING REPORT STATE ---
    const [ageingData, setAgeingData] = useState([]);
    const [ageingSearch, setAgeingSearch] = useState('');
    const [ageingSearchConstraint, setAgeingSearchConstraint] = useState('all');
    const [isAgeingExpanded, setIsAgeingExpanded] = useState(false);
    const [showAdvancedAgeing, setShowAdvancedAgeing] = useState(false);
    const [advAgeingDept, setAdvAgeingDept] = useState('');
    const [advAgeingIssueCat, setAdvAgeingIssueCat] = useState('');
    const [advAgeingActivityCat, setAdvAgeingActivityCat] = useState('');
    const [advAgeingAssignedTo, setAdvAgeingAssignedTo] = useState('');
    const [advAgeingStatus, setAdvAgeingStatus] = useState('');
    const [advAgeingLevel, setAdvAgeingLevel] = useState('');
    const [advAgeingSeverity, setAdvAgeingSeverity] = useState('');
    const [showAdvancedSearchModal, setShowAdvancedSearchModal] = useState(false);
    const [tempFilters, setTempFilters] = useState({ search: '', dept: '', status: '', location: '', issueCat: '', level: '', severity: '' });
    const [advAgeingLocation, setAdvAgeingLocation] = useState('');
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [panelTicket, setPanelTicket] = useState(null);
    const [isClosing, setIsClosing] = useState(false);
    const [isSidePanelExpanded, setIsSidePanelExpanded] = useState(false);
    const [ticketLogs, setTicketLogs] = useState([]);
    const [activeDetailsTab, setActiveDetailsTab] = useState('timeline');

    const handleAgeingTicketClick = async (ticket) => {
        setIsClosing(false);
        setSelectedTicket(ticket);
        setPanelTicket(ticket);
        setTicketLogs([]);
        try {
            const res = await api.get(`/tickets/${ticket.ticket_id}/logs`);
            setTicketLogs(res.data);
        } catch (e) {
            console.error("Failed to fetch logs", e);
        }
    };

    const handleCloseSidePanel = () => {
        setIsClosing(true);
        setSelectedTicket(null);
        setTimeout(() => {
            setPanelTicket(null);
            setIsClosing(false);
        }, 850);
    };

    const sidebarTabs = [
        { id: 'analytics', label: <><TrendingUp size={12} /> Global Analytics</> },
        { id: 'ageing', label: <><Clock size={12} /> Ageing Report</> }
    ];

    useEffect(() => {
        loadSystemData();
    }, []);

    const loadSystemData = async () => {
        setLoading(true);
        try {
            const [ticketsData, usersData] = await Promise.all([
                fetchTickets(), fetchUsers()
            ]);

            let safeTickets = ticketsData?.data || ticketsData;
            if (typeof safeTickets === 'string') safeTickets = JSON.parse(safeTickets);
            let finalTickets = Array.isArray(safeTickets) ? safeTickets : [];

            // Location-specific filtering for Viewers
            const rawLocs = user?.viewer_locations;
            if (user?.role !== 'Superadmin' && user?.role !== 'Admin' && rawLocs && String(rawLocs).trim() !== '' && String(rawLocs).toLowerCase() !== 'all') {
                const allowedLocs = String(rawLocs).split(',').map(l => l.trim().toLowerCase()).filter(Boolean);
                if (allowedLocs.length > 0) {
                    finalTickets = finalTickets.filter(t => allowedLocs.includes(String(t.location || '').trim().toLowerCase()));
                }
            }
            setTicketsList(finalTickets);

            setUsersList(usersData);
        } catch (err) {
            setError("Failed to load global data.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Load Ageing Report fresh when the tab is clicked (and immediately on mount for KPIs)
    useEffect(() => {
        const fetchAgeing = async () => {
            try {
                const res = await api.get('/reports/ageing');
                let rows = res.data || [];
                const rawLocs = user?.viewer_locations;
                if (user?.role !== 'Superadmin' && user?.role !== 'Admin' && rawLocs && String(rawLocs).trim() !== '' && String(rawLocs).toLowerCase() !== 'all') {
                    const allowedLocs = String(rawLocs).split(',').map(l => l.trim().toLowerCase()).filter(Boolean);
                    if (allowedLocs.length > 0) {
                        rows = rows.filter(t => allowedLocs.includes(String(t.location || '').trim().toLowerCase()));
                    }
                }
                setAgeingData(rows);
            } catch (err) {
                console.error("Failed to fetch ageing report");
            }
        };
        fetchAgeing();
    }, [activeTab, user]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const ticketId = params.get('ticket_id');
        if (ticketId && ticketsList.length > 0 && !selectedTicket) {
            const ticket = ticketsList.find(t => String(t.ticket_id) === String(ticketId));
            if (ticket) {
                setActiveTab('ageing');
                handleAgeingTicketClick(ticket);
                navigate(location.pathname, { replace: true });
            }
        }
    }, [location.search, ticketsList]);

    const formatSolverDetails = (solverData) => {
        if (!solverData || String(solverData).toLowerCase() === 'nan' || String(solverData).trim() === '') {
            return <span className="text-danger">Unassigned</span>;
        }
        const ids = String(solverData).split(',').map(id => id.trim()).filter(Boolean);
        const formattedNames = ids.map(id => {
            const solver = usersList.find(u => String(u.employee_id) === id || String(u.email) === id);
            return solver ? `${solver.name} (${solver.phone_number || solver.phone || 'N/A'})` : id;
        });
        return formattedNames.join(', ');
    };

    const handleDownloadCSV = () => {
        exportExecutiveCSV(filteredAgeing, {}, usersList);
    };


    const isLate = (ticket, targetMode = slaBreachMode) => {
        if (!ticket) return false;
        if (ticket.solver_delay_hours !== undefined && ticket.solver_delay_hours !== null && Number(ticket.solver_delay_hours) > 0) {
            const st = String(ticket.status || '').toLowerCase();
            const ct = String(ticket.closure_type || '').toLowerCase();
            const isFinished = ['closed', 'declined', 'on hold', 'on-hold'].includes(st) || ['declined', 'on hold'].includes(ct);
            if (isFinished && targetMode === 'active') return false;
            return true;
        }
        if (!ticket.deadline || String(ticket.deadline).toLowerCase() === 'nan') return false;

        const deadlineDate = parseDateString(ticket.deadline);
        if (!deadlineDate) return false;

        const st = String(ticket.status || '').toLowerCase();
        const ct = String(ticket.closure_type || '').toLowerCase();
        const isFinished = ['closed', 'declined', 'on hold', 'on-hold'].includes(st) || ['declined', 'on hold'].includes(ct);

        if (isFinished) {
            if (targetMode === 'active') return false;
            const finishStr = ticket.closed_timestamp || ticket.solved_timestamp;
            if (finishStr && String(finishStr).toLowerCase() !== 'nan') {
                const finishDate = parseDateString(finishStr);
                if (finishDate) return finishDate > deadlineDate;
            }
            return ticket.SLA_Breach === true || ticket.SLA_Breach === 'True';
        }

        return getISTDate() > deadlineDate;
    };

    const matchStartOfWord = (text, query) => {
        if (!query || !query.trim()) return true;
        if (text === null || text === undefined) return false;
        const q = query.trim().toLowerCase();
        const str = String(text).toLowerCase();
        const words = str.split(/[^a-z0-9]+/i).filter(Boolean);
        return str.startsWith(q) || words.some(w => w.startsWith(q));
    };

    const filteredAgeing = useMemo(() => {
        return (ageingData || []).filter(a => {
            const q = ageingSearch.trim();

            const fields = {
                ticket_id: String(a.ticket_id || ''),
                dept_assigned: String(a.dept_assigned || ''),
                issue_category: String(a.issue_category || ''),
                activity_category: String(a.activity_category || ''),
                location: String(a.location || ''),
                severity: String(a.severity || ''),
                status: String(a.status || ''),
                assigned_by: String(formatSolverDetails(a.assigned_by) || a.assigned_by || ''),
                assigned_to: String(formatSolverDetails(a.assigned_to) || a.assigned_to || ''),
                description: String(a.description || ''),
                escalation_level: String(a.escalation_level || '')
            };

            let matchBasic = false;
            if (!q) {
                matchBasic = true;
            } else if (ageingSearchConstraint !== 'all' && fields[ageingSearchConstraint] !== undefined) {
                matchBasic = matchStartOfWord(fields[ageingSearchConstraint], q);
            } else {
                matchBasic = (
                    matchStartOfWord(fields.ticket_id, q) ||
                    matchStartOfWord(fields.dept_assigned, q) ||
                    matchStartOfWord(fields.issue_category, q) ||
                    matchStartOfWord(fields.activity_category, q) ||
                    matchStartOfWord(fields.location, q) ||
                    matchStartOfWord(fields.severity, q) ||
                    matchStartOfWord(fields.status, q) ||
                    matchStartOfWord(fields.assigned_by, q) ||
                    matchStartOfWord(fields.assigned_to, q) ||
                    matchStartOfWord(fields.description, q) ||
                    matchStartOfWord(fields.escalation_level, q)
                );
            }

            if (!showAdvancedAgeing) return matchBasic;

            const matchDept = !advAgeingDept || (a.dept_assigned && a.dept_assigned.toLowerCase().includes(advAgeingDept.toLowerCase()));
            const matchIssueCat = !advAgeingIssueCat || (a.issue_category && a.issue_category.toLowerCase() === advAgeingIssueCat.toLowerCase());
            const matchActivityCat = !advAgeingActivityCat || (a.activity_category && a.activity_category.toLowerCase() === advAgeingActivityCat.toLowerCase());
            const matchAssignedTo = !advAgeingAssignedTo || (a.assigned_to && a.assigned_to.toLowerCase() === advAgeingAssignedTo.toLowerCase());
            const matchStatus = !advAgeingStatus || (a.status && a.status.toLowerCase() === advAgeingStatus.toLowerCase());
            const matchLevel = !advAgeingLevel || (a.escalation_level && a.escalation_level.toLowerCase() === advAgeingLevel.toLowerCase());
            const matchLocation = !advAgeingLocation || (a.location && a.location.toLowerCase() === advAgeingLocation.toLowerCase());
            const matchSeverity = !advAgeingSeverity || (a.severity && a.severity.toLowerCase() === advAgeingSeverity.toLowerCase());

            return matchBasic && matchDept && matchIssueCat && matchActivityCat && matchAssignedTo && matchStatus && matchLevel && matchLocation && matchSeverity;
        });
    }, [ageingData, ageingSearch, ageingSearchConstraint, showAdvancedAgeing, advAgeingDept, advAgeingIssueCat, advAgeingActivityCat, advAgeingAssignedTo, advAgeingStatus, advAgeingLevel, advAgeingLocation, advAgeingSeverity]);

    const [ageingSortField, setAgeingSortField] = useState('ticket_id');
    const [ageingSortOrder, setAgeingSortOrder] = useState('asc');

    const handleAgeingSortClick = (field) => {
        if (ageingSortField === field) {
            setAgeingSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setAgeingSortField(field);
            setAgeingSortOrder('asc');
        }
    };

    const sortedAgeing = useMemo(() => {
        let result = [...filteredAgeing];
        if (ageingSortField) {
            result.sort((a, b) => {
                let valA = a[ageingSortField];
                let valB = b[ageingSortField];

                if (ageingSortField === 'ticket_id') {
                    const numA = parseInt(String(valA || '').replace(/\D/g, '')) || 0;
                    const numB = parseInt(String(valB || '').replace(/\D/g, '')) || 0;
                    return ageingSortOrder === 'asc' ? numA - numB : numB - numA;
                }

                if (['ticket_age_hours', 'solver_resolution_hours', 'total_turnaround_hours', 'solver_delay_hours'].includes(ageingSortField)) {
                    const numA = parseFloat(valA) || 0;
                    const numB = parseFloat(valB) || 0;
                    return ageingSortOrder === 'asc' ? numA - numB : numB - numA;
                }

                if (ageingSortField === 'deadline') {
                    const timeA = parseDateToTimestamp(valA);
                    const timeB = parseDateToTimestamp(valB);
                    return ageingSortOrder === 'asc' ? timeA - timeB : timeB - timeA;
                }

                valA = String(valA || '').toLowerCase();
                valB = String(valB || '').toLowerCase();
                const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
                return ageingSortOrder === 'asc' ? cmp : -cmp;
            });
        }
        return result;
    }, [filteredAgeing, ageingSortField, ageingSortOrder]);

    const globalKPI = useMemo(() => {
        const counts = {
            total: { count: 0, levels: {} },
            totalSubTasks: { count: 0, levels: {} },
            open: { count: 0, levels: {} },
            inProgress: { count: 0, levels: {} },
            resolved: { count: 0, levels: {} },
            closed: { count: 0, levels: {} },
            declined: { count: 0, levels: {} },
            onHold: { count: 0, levels: {} },
            escalated: { count: 0, levels: {} },
            late: { count: 0, levels: {} }
        };

        const increment = (category, level) => {
            counts[category].count++;
            const lvl = level || 'L1';
            counts[category].levels[lvl] = (counts[category].levels[lvl] || 0) + 1;
        };

        const ticketGroups = {};
        filteredAgeing.forEach(t => {
            const id = t.ticket_id;
            if (!ticketGroups[id]) ticketGroups[id] = [];
            ticketGroups[id].push(t);
        });

        const parseDate = (ts) => {
            if (!ts) return 0;
            try {
                const str = String(ts).trim();
                const parts = str.split(' ');
                const dateParts = parts[0].includes('-') ? parts[0].split('-') : parts[0].split('/');
                if (dateParts.length !== 3) return 0;
                let d, m, y;
                if (dateParts[0].length === 4) {
                    [y, m, d] = dateParts;
                } else {
                    [d, m, y] = dateParts;
                }
                const time = parts[1] || '00:00';
                const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${time.length === 5 ? time + ':00' : time}`;
                const dt = new Date(iso);
                return isNaN(dt.getTime()) ? 0 : dt.getTime();
            } catch (e) {
                return 0;
            }
        };

        Object.values(ticketGroups).forEach(group => {
            const latest = group.reduce((prev, curr) => {
                return parseDate(curr.timestamp) >= parseDate(prev.timestamp) ? curr : prev;
            }, group[0]);
            increment('total', latest.escalation_level);
        });

        filteredAgeing.forEach(t => {
            const stat = t.status ? String(t.status).toLowerCase() : '';
            const lvl = t.escalation_level || 'L1';

            increment('totalSubTasks', lvl);

            if (stat === 'open') increment('open', lvl);
            else if (stat === 'in progress') increment('inProgress', lvl);
            else if (stat === 'resolved') increment('resolved', lvl);
            else if (stat === 'closed') {
                if (t.closure_type === 'Declined' || stat === 'declined') increment('declined', lvl);
                else if (t.closure_type === 'On Hold') increment('onHold', lvl);
                else increment('closed', lvl);
            }
            else if (stat === 'declined') increment('declined', lvl);
            else if (stat === 'on hold') increment('onHold', lvl);
            else if (stat === 'escalate' || stat === 'escalated') increment('escalated', lvl);

            if (isLate(t, slaBreachMode)) increment('late', lvl);
        });

        return counts;
    }, [filteredAgeing, slaBreachMode]);

    const renderTooltip = (levelsObj) => {
        const entries = Object.entries(levelsObj).sort();
        if (entries.length === 0) return null;
        return (
            <div className="kpi-tooltip">
                {entries.map(([lvl, count]) => (
                    <div key={lvl} className="kpi-tooltip-item">
                        <span className="kpi-tooltip-label">{lvl}</span>
                        <span className="kpi-tooltip-value">{count}</span>
                    </div>
                ))}
            </div>
        );
    };


    return (
        <Layout user={user} setUser={setUser} sidebarTabs={sidebarTabs} activeTab={activeTab} setActiveTab={setActiveTab}>
            <div className="content-wrapper" style={{ paddingRight: selectedTicket && window.innerWidth > 768 ? '450px' : '0', transition: 'padding-right 0.9s cubic-bezier(0.4, 0, 0.2, 1)', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

                {error && <div className="badge badge-danger mb-4 p-2" style={{ width: '100%', fontSize: '13px' }}>{error}</div>}

                <div className="mb-5" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div>
                        <h2 className="m-0 text-xl flex-row gap-2">
                            <TrendingUp size={22} color="#3b82f6" /> Global Analytics Viewer
                        </h2>
                        <p className="text-muted text-sm mt-3">
                            Read-only access to global service metrics and ageing reports.
                        </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <SLABreachModeToggle mode={slaBreachMode} onChange={setSlaBreachMode} />
                        <button
                            className="btn p-2 text-xs flex-row gap-1"
                            onClick={() => setShowKPIs(prev => !prev)}
                            title={showKPIs ? "Hide KPI Cards" : "Show KPI Cards"}
                            style={{
                                whiteSpace: 'nowrap',
                                borderRadius: '6px',
                                backgroundColor: 'var(--bg-card, #131b2e)',
                                border: '1px solid var(--border, #1e293b)',
                                color: 'var(--text-main, #f1f5f9)',
                                fontSize: '11px',
                                padding: '6px 10px',
                                cursor: 'pointer'
                            }}
                        >
                            {showKPIs ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            {showKPIs ? 'Hide KPIs' : 'Show KPIs'}
                        </button>
                    </div>
                </div>

                {/* --- GLOBAL KPI METRICS BOARD (COLLAPSIBLE) --- */}
                {showKPIs && (
                    <div className="kpi-grid">
                        <div className="card kpi-card kpi-blue" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #3b82f6', background: 'linear-gradient(180deg, rgba(59,130,246,0.25) 0%, rgba(59,130,246,0) 100%)' }}>
                            <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Total</p>
                            <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{globalKPI.total.count}</h2>
                        </div>
                        <div className="card kpi-card kpi-purple" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #8b5cf6', background: 'linear-gradient(180deg, rgba(139,92,246,0.25) 0%, rgba(139,92,246,0) 100%)' }}>
                            {renderTooltip(globalKPI.totalSubTasks.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Total Sub-Tasks</p>
                            <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{globalKPI.totalSubTasks.count}</h2>
                        </div>
                        <div className="card kpi-card kpi-amber" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #f59e0b', background: 'linear-gradient(180deg, rgba(245,158,11,0.25) 0%, rgba(245,158,11,0) 100%)' }}>
                            {renderTooltip(globalKPI.open.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Open</p>
                            <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{globalKPI.open.count}</h2>
                        </div>
                        <div className="card kpi-card kpi-purple" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #8b5cf6', background: 'linear-gradient(180deg, rgba(139,92,246,0.25) 0%, rgba(139,92,246,0) 100%)' }}>
                            {renderTooltip(globalKPI.inProgress.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>In Progress</p>
                            <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{globalKPI.inProgress.count}</h2>
                        </div>
                        <div className="card kpi-card kpi-teal" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #14b8a6', background: 'linear-gradient(180deg, rgba(20,184,166,0.25) 0%, rgba(20,184,166,0) 100%)' }}>
                            {renderTooltip(globalKPI.resolved.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Resolved</p>
                            <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{globalKPI.resolved.count}</h2>
                        </div>
                        <div className="card kpi-card kpi-green" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #10b981', background: 'linear-gradient(180deg, rgba(16,185,129,0.25) 0%, rgba(16,185,129,0) 100%)' }}>
                            {renderTooltip(globalKPI.closed.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Closed</p>
                            <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{globalKPI.closed.count}</h2>
                        </div>
                        <div className="card kpi-card kpi-gray" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #6b7280', background: 'linear-gradient(180deg, rgba(107,114,128,0.25) 0%, rgba(107,114,128,0) 100%)' }}>
                            {renderTooltip(globalKPI.declined.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Declined</p>
                            <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{globalKPI.declined.count}</h2>
                        </div>
                        <div className="card kpi-card kpi-gray" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #3b82f6', background: 'linear-gradient(180deg, rgba(59,130,246,0.25) 0%, rgba(59,130,246,0) 100%)' }}>
                            {renderTooltip(globalKPI.onHold.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>On Hold</p>
                            <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{globalKPI.onHold.count}</h2>
                        </div>
                        <div className="card kpi-card kpi-red" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #ef4444', background: 'linear-gradient(180deg, rgba(239,68,68,0.25) 0%, rgba(239,68,68,0) 100%)' }}>
                            {renderTooltip(globalKPI.escalated.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Escalate</p>
                            <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{globalKPI.escalated.count}</h2>
                        </div>
                        <div className="card kpi-card kpi-sla kpi-orange" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #F7941D', background: 'linear-gradient(180deg, rgba(247,148,29,0.25) 0%, rgba(247,148,29,0) 100%)' }}>
                            {renderTooltip(globalKPI.late.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>
                                {slaBreachMode === 'active' ? 'Live SLA Breach' : 'All-Time SLA Breach'}
                            </p>
                            <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{globalKPI.late.count}</h2>
                        </div>
                    </div>
                )}

                {activeTab === 'analytics' && !loading && <AdminAnalytics tickets={ticketsList} usersList={usersList} slaBreachMode={slaBreachMode} onSlaBreachModeChange={setSlaBreachMode} />}

                {activeTab === 'ageing' && !loading && (
                    <div className="card" style={isAgeingExpanded ? { position: 'fixed', inset: '16px', zIndex: 1000, backgroundColor: 'var(--bg-main, #0f172a)', margin: 0, padding: '20px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,0.8)' } : { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                        <div className="ageing-controls-bar flex-row justify-between mb-4 gap-3">
                            <h3 className="m-0 text-lg" style={{ whiteSpace: 'nowrap' }}>⏳ Full Ticket Ageing Analytics</h3>
                            <div className="ageing-controls-group flex-row justify-end gap-2 flex-1" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    <select
                                        className="form-control"
                                        value={ageingSearchConstraint}
                                        onChange={(e) => setAgeingSearchConstraint(e.target.value)}
                                        style={{ padding: '4px 8px', fontSize: '11px', width: '120px', margin: 0, height: '28px' }}
                                        title="Filter by field"
                                    >
                                        <option value="all">All Fields</option>
                                        <option value="ticket_id">ID</option>
                                        <option value="dept_assigned">Dept</option>
                                        <option value="issue_category">Issue Category</option>
                                        <option value="activity_category">Activity Category</option>
                                        <option value="location">Location</option>
                                        <option value="severity">Severity</option>
                                        <option value="status">Status</option>
                                        <option value="assigned_by">Assigned By</option>
                                        <option value="assigned_to">Assigned To</option>
                                    </select>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="🔍 Search ageing..."
                                        value={ageingSearch}
                                        onChange={(e) => setAgeingSearch(e.target.value)}
                                        style={{ padding: '4px 8px', fontSize: '11px', width: '160px', margin: 0, height: '28px' }}
                                    />
                                </div>
                                <button className="btn badge-primary p-2 text-xs flex-row gap-1" onClick={() => setShowAdvancedSearchModal(true)} style={{ whiteSpace: 'nowrap', borderRadius: '20px', height: '28px', padding: '0 12px' }}>
                                    <Filter size={14} /> Advanced Search & Filter
                                </button>
                                <button className="btn badge-success p-2 text-xs flex-row gap-1" onClick={handleDownloadCSV} style={{ whiteSpace: 'nowrap' }} title="Download CSV Report">
                                    <Download size={11} /> CSV Report
                                </button>
                                <button className="btn p-2 text-xs flex-row gap-1" onClick={() => exportExecutivePDF(filteredAgeing)} style={{ whiteSpace: 'nowrap', backgroundColor: 'rgba(239,68,68,0.2)', color: '#ef4444' }} title="Export PDF Report">
                                    <FileText size={11} /> PDF Report
                                </button>
                                <button className="btn p-2 text-xs flex-row gap-1" onClick={() => setIsAgeingExpanded(!isAgeingExpanded)} style={{ whiteSpace: 'nowrap', backgroundColor: 'var(--bg-subtle)' }} title={isAgeingExpanded ? "Restore" : "Expand Fullscreen"}>
                                    {isAgeingExpanded ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
                                <table className="data-table ageing-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                    <thead>
                                        <tr>
                                            <th onClick={() => handleAgeingSortClick('ticket_id')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Ticket ID">ID {ageingSortField === 'ticket_id' ? (ageingSortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                                            <th onClick={() => handleAgeingSortClick('dept_assigned')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Department">Dept {ageingSortField === 'dept_assigned' ? (ageingSortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                                            <th onClick={() => handleAgeingSortClick('issue_category')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Issue Category">Issue Cat. {ageingSortField === 'issue_category' ? (ageingSortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                                            <th onClick={() => handleAgeingSortClick('activity_category')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Activity Category">Act. Cat. {ageingSortField === 'activity_category' ? (ageingSortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                                            <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Description</th>
                                            <th onClick={() => handleAgeingSortClick('location')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Location">Location {ageingSortField === 'location' ? (ageingSortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                                            <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold' }}>Image</th>
                                            <th onClick={() => handleAgeingSortClick('deadline')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Target Deadline">Deadline {ageingSortField === 'deadline' ? (ageingSortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                                            <th onClick={() => handleAgeingSortClick('escalation_level')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Escalation Level">Level {ageingSortField === 'escalation_level' ? (ageingSortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                                            <th onClick={() => handleAgeingSortClick('severity')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Severity">Severity {ageingSortField === 'severity' ? (ageingSortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                                            <th onClick={() => handleAgeingSortClick('status')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Status">Status {ageingSortField === 'status' ? (ageingSortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                                            <th onClick={() => handleAgeingSortClick('assigned_by')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Assigned By">Assigned By {ageingSortField === 'assigned_by' ? (ageingSortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                                            <th onClick={() => handleAgeingSortClick('assigned_to')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Assigned To">Assigned To {ageingSortField === 'assigned_to' ? (ageingSortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                                            <th onClick={() => handleAgeingSortClick('ticket_age_hours')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Ticket Age">Ticket Age {ageingSortField === 'ticket_age_hours' ? (ageingSortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                                            <th onClick={() => handleAgeingSortClick('solver_resolution_hours')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Resolution Time">Res. Time {ageingSortField === 'solver_resolution_hours' ? (ageingSortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                                            <th onClick={() => handleAgeingSortClick('total_turnaround_hours')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Total Turnaround">Turnaround {ageingSortField === 'total_turnaround_hours' ? (ageingSortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                                            <th onClick={() => handleAgeingSortClick('solver_delay_hours')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Delay">Delay {ageingSortField === 'solver_delay_hours' ? (ageingSortOrder === 'asc' ? '▲' : '▼') : ''}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedAgeing.length === 0 ? (
                                            <tr><td colSpan="17" className="text-center p-4 text-muted">No records found.</td></tr>
                                        ) : (
                                            sortedAgeing.map((a, index) => {
                                                const isGrouped = index > 0 && a.ticket_id === sortedAgeing[index - 1].ticket_id;
                                                let rowSpan = 1;
                                                let anySLA = a.SLA_Breach;
                                                if (!isGrouped) {
                                                    for (let i = index + 1; i < sortedAgeing.length; i++) {
                                                        if (sortedAgeing[i].ticket_id === a.ticket_id) {
                                                            rowSpan++;
                                                            if (sortedAgeing[i].SLA_Breach === true || String(sortedAgeing[i].SLA_Breach).toLowerCase() === 'true') {
                                                                anySLA = true;
                                                            }
                                                        }
                                                        else break;
                                                    }
                                                }
                                                return (
                                                    <tr key={`${a.ticket_id}-${a.escalation_level || 'L1'}-${a.timestamp || ''}-${index}`} className="clickable" onClick={() => handleAgeingTicketClick(a)}>
                                                        {!isGrouped && (
                                                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }} className="font-bold" rowSpan={rowSpan}>
                                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                                                                    <span style={{ color: (isLate(a) || a.SLA_Breach === 'True' || a.SLA_Breach === true) ? '#ef4444' : 'inherit' }}>#{a.ticket_id}</span>
                                                                    {a.original_raiser && <span style={{ color: '#f59e0b', fontSize: '8px', fontWeight: 'normal', backgroundColor: 'rgba(245,158,11,0.1)', padding: '2px 4px', borderRadius: '4px', whiteSpace: 'nowrap', display: 'inline-block' }}>L{a.escalation_level ? String(a.escalation_level).replace('L', '') : '1'} Sub-task</span>}
                                                                </div>
                                                            </td>
                                                        )}
                                                        <td style={{ padding: '12px 8px' }}>{a.dept_assigned}</td>
                                                        <td style={{ padding: '12px 8px' }}>{a.issue_category || '-'}</td>
                                                        <td style={{ padding: '12px 8px' }}>{a.activity_category || '-'}</td>
                                                        <td style={{ padding: '12px 8px', maxWidth: '200px', minWidth: '150px' }} title={a.description || ''}>
                                                            <div style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.4', wordBreak: 'break-word', fontSize: '10.5px', color: '#a1a1aa' }}>
                                                                {a.description || '-'}
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '12px 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }} title={a.location}>{a.location || '-'}</td>
                                                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                                            <AttachmentBadge attachment={a.attachment} />
                                                        </td>
                                                        <td style={{ padding: '12px 8px' }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                                <span>{a.deadline ? String(a.deadline).split(' ')[0] : '-'}</span>
                                                                <SLACountdownBadge deadline={a.deadline} status={a.status} />
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '12px 8px' }}><span style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold' }}>{a.escalation_level || 'L1'}</span></td>
                                                        <td style={{ padding: '12px 8px' }}>{a.severity || '-'}</td>
                                                        <td style={{ padding: '12px 8px' }}>{a.status}</td>
                                                        <td style={{ padding: '12px 8px' }} className="text-muted">{formatSolverDetails(a.assigned_by)}</td>
                                                        <td style={{ padding: '12px 8px' }} className="text-primary">{formatSolverDetails(a.assigned_to)}</td>
                                                        <td style={{ padding: '12px 8px' }} className="font-bold">{a.ticket_age_hours ? `${(a.ticket_age_hours / 24).toFixed(1)}d` : '-'}</td>
                                                        <td style={{ padding: '12px 8px' }}>{a.solver_resolution_hours ? `${(a.solver_resolution_hours / 24).toFixed(1)}d` : '-'}</td>
                                                        <td style={{ padding: '12px 8px' }}>{a.total_turnaround_hours ? `${(a.total_turnaround_hours / 24).toFixed(1)}d` : '-'}</td>
                                                        {(() => {
                                                            const dDays = getDisplayDelayDays(a);
                                                            const isDelay = dDays !== '0d';
                                                            return (
                                                                <td style={{ padding: '12px 8px', color: isDelay ? '#ef4444' : 'inherit', fontWeight: isDelay ? 'bold' : 'normal' }}>
                                                                    {dDays}
                                                                </td>
                                                            );
                                                        })()}
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

            </div>

            {panelTicket && isSidePanelExpanded && !isClosing && (
                <div
                    className="blur-in"
                    style={{ position: 'fixed', inset: 0, zIndex: 1040 }}
                    onClick={() => setIsSidePanelExpanded(false)}
                />
            )}
            {panelTicket && (() => {
                const isExit = isClosing;
                const currentTicket = selectedTicket || panelTicket;
                return (
                    <div className="ticket-details-panel slide-in-right-panel" style={{
                        position: 'fixed',
                        top: isSidePanelExpanded ? '2vh' : '52px',
                        bottom: isSidePanelExpanded ? '2vh' : '0',
                        right: isExit ? '-470px' : isSidePanelExpanded ? 'max(5vw, calc(50% - 700px))' : '0',
                        width: isSidePanelExpanded ? 'min(90vw, 1400px)' : '450px',
                        margin: 0, borderLeft: '1px solid var(--border, #cbd5e1)', display: 'flex', flexDirection: 'column',
                        zIndex: isSidePanelExpanded ? 1050 : 900,
                        borderRadius: isSidePanelExpanded ? '12px' : 0,
                        boxShadow: isSidePanelExpanded ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)' : '-10px 0 30px rgba(0,0,0,0.05)',
                        backgroundColor: 'var(--bg-card)', backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)', transform: 'translateZ(0)',
                        transition: 'top 0.9s cubic-bezier(0.4, 0, 0.2, 1), right 0.9s cubic-bezier(0.4, 0, 0.2, 1), width 0.9s cubic-bezier(0.4, 0, 0.2, 1), bottom 0.9s cubic-bezier(0.4, 0, 0.2, 1), border-radius 0.9s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.9s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}>
                        <div style={{ padding: '24px 24px 0 24px', zIndex: 10, borderBottom: '1px solid var(--border, #cbd5e1)', background: 'transparent', borderRadius: isSidePanelExpanded ? '12px 12px 0 0' : 0 }}>
                            <div className="side-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <div className="side-panel-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <h3 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        #{currentTicket.ticket_id}
                                        <span style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold' }}>{currentTicket.status}</span>
                                    </h3>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const logsToExport = ticketLogs;
                                            if (!logsToExport || logsToExport.length === 0) {
                                                alert("No timeline events to download.");
                                                return;
                                            }
                                            const headers = ['timestamp', 'ticket_id', 'user', 'action', 'details', 'remarks', 'attachment'];
                                            const csvRows = [headers.join(',')];
                                            for (const log of logsToExport) {
                                                const values = headers.map(header => {
                                                    let val = log[header] !== null && log[header] !== undefined ? log[header] : '';
                                                    if (header === 'attachment' && val && String(val).trim() !== 'nan') {
                                                        let url = String(val).trim();
                                                        if (!url.startsWith('http')) {
                                                            url = `${import.meta.env.VITE_FILE_BASE_URL}/api/token/file/${url}?token=${import.meta.env.VITE_API_SECURE_TOKEN}`;
                                                        }
                                                        val = url;
                                                    }
                                                    const escaped = ('' + val).replace(/"/g, '""');
                                                    return `"${escaped}"`;
                                                });
                                                csvRows.push(values.join(','));
                                            }
                                            const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
                                            const url = URL.createObjectURL(blob);
                                            const link = document.createElement('a');
                                            link.href = url;
                                            const tId = selectedTicket?.ticket_id || 'Audit';
                                            link.setAttribute('download', `Ticket_${tId}_Timeline.csv`);
                                            document.body.appendChild(link);
                                            link.click();
                                            document.body.removeChild(link);
                                        }}
                                        className="btn btn-filter"
                                        style={{ padding: '4px 8px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--text-main)', borderRadius: '4px', cursor: 'pointer' }}
                                        title="Download Timeline (CSV)"
                                    >
                                        <Download size={12} /> Download Timeline (CSV)
                                    </button>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <button onClick={() => setIsSidePanelExpanded(!isSidePanelExpanded)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '18px', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={isSidePanelExpanded ? "Collapse" : "Expand"}>
                                        {isSidePanelExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                                    </button>
                                    <button onClick={() => { handleCloseSidePanel(); setIsSidePanelExpanded(false); }} style={{ background: 'none', border: 'none', color: 'var(--text-main, #0f172a)', fontSize: '16px', cursor: 'pointer', padding: '4px' }}>✕</button>
                                </div>
                            </div>
                            <div style={{ display: 'flex' }}>
                                <button onClick={() => setActiveDetailsTab('timeline')} style={{ flex: 1, padding: '10px 4px', fontSize: '13px', fontWeight: '600', backgroundColor: 'transparent', color: activeDetailsTab === 'timeline' ? '#3b82f6' : 'var(--text-main, #0f172a)', border: 'none', borderBottom: activeDetailsTab === 'timeline' ? '2px solid #3b82f6' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '-1px' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Clock size={14} /> Timeline</div></button>
                                <button onClick={() => setActiveDetailsTab('chat')} style={{ flex: 1, padding: '10px 4px', fontSize: '13px', fontWeight: '600', backgroundColor: 'transparent', color: activeDetailsTab === 'chat' ? '#3b82f6' : 'var(--text-main, #0f172a)', border: 'none', borderBottom: activeDetailsTab === 'chat' ? '2px solid #3b82f6' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '-1px' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><MessageSquare size={14} /> Chat</div></button>
                            </div>
                        </div>
                        <div className="ticket-details-panel-body" style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', touchAction: 'pan-y', padding: '24px', zIndex: 10, display: 'flex', flexDirection: 'column', background: 'transparent' }}>
                            {activeDetailsTab === 'chat' && (
                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative', zIndex: 10, height: '100%' }}>
                                    <div className="chat-container frosted-chat-box" style={{ flex: 1, overflowY: 'auto', padding: '12px', borderRadius: '5px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {ticketLogs.filter(l => l.action === 'Chat' || l.action === 'Message').length === 0 ? (
                                            <p style={{ color: '#71717a', fontSize: '11px', textAlign: 'center' }}>No chat history available.</p>
                                        ) : (
                                            ticketLogs.filter(l => l.action === 'Chat' || l.action === 'Message').map((log, i) => {
                                                const isRequestor = log.user === selectedTicket.raised_by || log.user === selectedTicket.raiser_name || log.user === selectedTicket.original_raiser_name;
                                                const isSystem = log.user === 'System' || !log.user || String(log.user).toLowerCase() === 'system';
                                                const isMe = String(log.user).startsWith(user.name) || log.user === user.email || log.user_id === user.employee_id;
                                                const amIRequestor = String(selectedTicket.raiser_name).startsWith(user.name) || selectedTicket.raised_by === user.email;

                                                let align = 'flex-start';
                                                let bubbleClass = 'chat-bubble-other';

                                                if (isSystem) {
                                                    align = 'center';
                                                    bubbleClass = 'chat-system-pill';
                                                } else if (isMe) {
                                                    align = 'flex-end';
                                                    bubbleClass = 'chat-bubble-me';
                                                } else {
                                                    if (amIRequestor) {
                                                        align = 'flex-start';
                                                        bubbleClass = 'chat-bubble-other';
                                                    } else {
                                                        if (isRequestor) {
                                                            align = 'flex-start';
                                                            bubbleClass = 'chat-bubble-other';
                                                        } else {
                                                            align = 'flex-end';
                                                            bubbleClass = 'chat-bubble-me';
                                                        }
                                                    }
                                                }

                                                return (
                                                    <div key={i} className={bubbleClass} style={{ alignSelf: align, maxWidth: isSystem ? '95%' : '85%', borderRadius: isSystem ? '16px' : '8px', padding: isSystem ? '6px 16px' : '10px 12px', boxShadow: isSystem ? 'none' : '0 2px 5px rgba(0,0,0,0.2)', textAlign: isSystem ? 'center' : 'left' }}>
                                                        {!isSystem && <div className="chat-bubble-user" style={{ fontSize: '11px', marginBottom: '4px', fontWeight: 'bold' }}>{log.user || log.user_id || 'System'}</div>}
                                                        <div className="chat-bubble-text" style={{ fontSize: '12px', lineHeight: '1.4' }}>{log.remarks || log.details}</div>
                                                        <div className="chat-bubble-time" style={{ fontSize: '10px', marginTop: '6px', textAlign: isSystem ? 'center' : 'right' }}>{log.timestamp}</div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeDetailsTab === 'timeline' && (
                                <div style={{ paddingBottom: '20px', position: 'relative', zIndex: 10 }}>
                                    <div style={{ position: 'relative', borderLeft: '2px solid var(--border, #cbd5e1)', paddingLeft: '20px', marginLeft: '10px' }}>
                                        {ticketLogs.map((log, i) => {
                                            let Icon = Activity;
                                            let iconColor = '#3b82f6';
                                            if (log.action.includes('Created')) { Icon = PlusCircle; iconColor = '#10b981'; }
                                            else if (log.action.includes('Escalated')) { Icon = ArrowUpRight; iconColor = '#ef4444'; }
                                            else if (log.action.includes('Status')) { Icon = RefreshCw; iconColor = '#f59e0b'; }
                                            else if (log.action === 'Chat' || log.action === 'Message') { Icon = MessageSquare; iconColor = '#a855f7'; }
                                            else if (log.action.includes('Resolved') || log.action.includes('Accepted') || log.action.includes('Closed')) { Icon = CheckCircle; iconColor = '#10b981'; }
                                            else if (log.action.includes('Handover') || log.action.includes('Assigned')) { Icon = UserPlus; iconColor = '#8b5cf6'; }
                                            let toName = "";
                                            let detailsText = String(log.details || log.remarks || "");
                                            if (log.action.includes('Created') && detailsText.includes('Assigned to')) toName = detailsText.split('Assigned to')[1].trim();
                                            else if (log.action.includes('Escalated') && detailsText.includes('Escalated to')) toName = detailsText.split('Escalated to')[1].split('(')[0].trim();
                                            else if (log.action.includes('Handover Requested') && detailsText.includes('transfer to')) toName = detailsText.split('transfer to')[1].trim();
                                            else if (log.action.includes('Handover Approved') && detailsText.includes('Assigned to')) toName = detailsText.split('Assigned to')[1].trim();
                                            else if (log.action.includes('Override') && detailsText.includes('Transferred to')) toName = detailsText.split('Transferred to')[1].trim();

                                            return <CollapsibleTimelineNode key={i} log={log} iconColor={iconColor} Icon={Icon} toName={toName} />;
                                        })}
                                        {ticketLogs.length === 0 && (
                                            <p style={{ color: '#71717a', fontSize: '11px' }}>No timeline events available.</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <style>{`
                        .skyline-layer {
                            position: absolute; bottom: 0; left: 0; right: 0;
                            display: flex; overflow: hidden; height: 160px; pointer-events: none; z-index: 1;
                        }
                        .skyline-bg { fill: #334155; }
                        .skyline-mg { fill: #1e293b; }
                        .skyline-fg { fill: #0f172a; }
                        .window-dim { fill: rgba(255,255,255,0.06); }
                        .window-lit { fill: #fde047; transition: fill 1.5s ease; }
                        .glow-stop-top { stop-color: #fde047; stop-opacity: 0; transition: all 1.5s ease; }
                        .glow-stop-base { stop-color: #fde047; stop-opacity: 0.25; transition: all 1.5s ease; }
                        
                        body.light-mode .skyline-bg { fill: #e2e8f0; }
                        body.light-mode .skyline-mg { fill: #cbd5e1; }
                        body.light-mode .skyline-fg { fill: #94a3b8; }
                        body.light-mode .window-dim { fill: rgba(255,255,255,0.3); }
                        body.light-mode .window-lit { fill: rgba(255,255,255,0.6); }
                        body.light-mode .glow-stop-top { stop-color: #ffffff; stop-opacity: 0; }
                        body.light-mode .glow-stop-base { stop-color: #ffffff; stop-opacity: 0.6; }

                        .frosted-chat-box {
                            background-color: rgba(30, 41, 59, 0.7) !important;
                            backdrop-filter: blur(8px) !important;
                            -webkit-backdrop-filter: blur(8px) !important;
                        }
                        body.light-mode .frosted-chat-box {
                            background-color: rgba(255, 255, 255, 0.6) !important;
                        }
                    `}</style>
                        <div className="skyline-layer">
                            {[...Array(12)].map((_, i) => (
                                <svg key={i} viewBox="0 170 200 230" preserveAspectRatio="none" style={{ flex: '0 0 150px', height: '100%' }}>
                                    <defs>
                                        <linearGradient id={`cityGlow${i}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" className="glow-stop-top" />
                                            <stop offset="50%" className="glow-stop-base" />
                                            <stop offset="100%" className="glow-stop-base" />
                                        </linearGradient>
                                    </defs>
                                    <rect x="0" y="170" width="200" height="230" fill={`url(#cityGlow${i})`} />
                                    <path className="skyline-bg" d="M10,400V250h20v-30h30v-40h20v70h30v-80h25v50h30v-20h35v200H10z" />
                                    <path className="skyline-mg" d="M0,400V280h25v-50h20v-20h35v70h15v-40h45v30h30v-10h30v190H0z" />
                                    <path className="skyline-fg" d="M0,400V310h30v-40h25v20h20v-60h30v80h25v-30h40v-20h30v150H0z" />
                                    <g className="window-dim">
                                        <rect x="20" y="325" width="3" height="4" /><rect x="15" y="365" width="3" height="4" />
                                        <rect x="35" y="305" width="3" height="4" /><rect x="40" y="325" width="3" height="4" />
                                        <rect x="68" y="325" width="3" height="4" /><rect x="82" y="245" width="3" height="4" />
                                        <rect x="94" y="265" width="3" height="4" /><rect x="82" y="305" width="3" height="4" />
                                        <rect x="117" y="345" width="3" height="4" /><rect x="140" y="295" width="3" height="4" />
                                        <rect x="155" y="315" width="3" height="4" /><rect x="140" y="335" width="3" height="4" />
                                        <rect x="188" y="275" width="3" height="4" /><rect x="178" y="335" width="3" height="4" />
                                    </g>
                                    <g className="window-lit">
                                        <rect x="10" y="325" width="3" height="4" /><rect x="10" y="345" width="3" height="4" />
                                        <rect x="20" y="345" width="3" height="4" /><rect x="35" y="285" width="3" height="4" />
                                        <rect x="45" y="285" width="3" height="4" /><rect x="45" y="305" width="3" height="4" />
                                        <rect x="35" y="345" width="3" height="4" /><rect x="45" y="345" width="3" height="4" />
                                        <rect x="60" y="305" width="3" height="4" /><rect x="68" y="305" width="3" height="4" />
                                        <rect x="60" y="325" width="3" height="4" /><rect x="64" y="345" width="3" height="4" />
                                        <rect x="94" y="245" width="3" height="4" /><rect x="82" y="265" width="3" height="4" />
                                        <rect x="88" y="285" width="3" height="4" /><rect x="94" y="305" width="3" height="4" />
                                        <rect x="88" y="325" width="3" height="4" /><rect x="112" y="325" width="3" height="4" />
                                        <rect x="122" y="325" width="3" height="4" /><rect x="150" y="295" width="3" height="4" />
                                        <rect x="160" y="295" width="3" height="4" /><rect x="145" y="315" width="3" height="4" />
                                        <rect x="160" y="335" width="3" height="4" /><rect x="178" y="275" width="3" height="4" />
                                        <rect x="178" y="295" width="3" height="4" /><rect x="188" y="295" width="3" height="4" />
                                        <rect x="183" y="315" width="3" height="4" /><rect x="188" y="335" width="3" height="4" />
                                    </g>
                                </svg>
                            ))}
                        </div>
                    </div>
                );
            })()}

            {showAdvancedSearchModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '125vw', height: '125vh', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                            <h3 className="m-0 text-md" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Filter size={18} /> Advanced Search & Filter</h3>
                            <button onClick={() => setShowAdvancedSearchModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                                <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Search Keyword</label>
                                <input type="text" className="form-control" style={{ fontSize: '12px', padding: '8px' }} placeholder="Filter by ID, Dept, Status..." value={tempFilters.search} onChange={e => setTempFilters({ ...tempFilters, search: e.target.value })} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Department</label>
                                    <select className="form-control" style={{ fontSize: '12px', padding: '8px' }} value={tempFilters.dept} onChange={e => setTempFilters({ ...tempFilters, dept: e.target.value })}>
                                        <option value="">All Depts</option>
                                        {[...new Set(ageingData.map(a => a.dept_assigned).filter(Boolean))].sort().map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Status</label>
                                    <select className="form-control" style={{ fontSize: '12px', padding: '8px' }} value={tempFilters.status} onChange={e => setTempFilters({ ...tempFilters, status: e.target.value })}>
                                        <option value="">All Statuses</option>
                                        {[...new Set(ageingData.map(a => a.status).filter(Boolean))].sort().map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Location</label>
                                    <select className="form-control" style={{ fontSize: '12px', padding: '8px' }} value={tempFilters.location} onChange={e => setTempFilters({ ...tempFilters, location: e.target.value })}>
                                        <option value="">All Locations</option>
                                        {[...new Set(ageingData.map(a => a.location).filter(Boolean))].sort().map(l => <option key={l} value={l}>{l}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Issue Category</label>
                                    <select className="form-control" style={{ fontSize: '12px', padding: '8px' }} value={tempFilters.issueCat} onChange={e => setTempFilters({ ...tempFilters, issueCat: e.target.value })}>
                                        <option value="">All Issue Cats</option>
                                        {[...new Set(ageingData.map(a => a.issue_category).filter(Boolean))].sort().map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Escalation Level</label>
                                    <select className="form-control" style={{ fontSize: '12px', padding: '8px' }} value={tempFilters.level} onChange={e => setTempFilters({ ...tempFilters, level: e.target.value })}>
                                        <option value="">All Levels</option>
                                        {[...new Set(ageingData.map(a => a.escalation_level).filter(Boolean))].sort().map(l => <option key={l} value={l}>{l}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                                <button className="btn badge-primary" style={{ flex: 1, justifyContent: 'center', padding: '10px' }} onClick={() => {
                                    setAgeingSearch(tempFilters.search);
                                    setAdvAgeingDept(tempFilters.dept);
                                    setAdvAgeingStatus(tempFilters.status);
                                    setAdvAgeingLocation(tempFilters.location);
                                    setAdvAgeingIssueCat(tempFilters.issueCat);
                                    setAdvAgeingLevel(tempFilters.level);
                                    setAdvAgeingSeverity(tempFilters.severity);
                                    setShowAdvancedAgeing(true);
                                    setShowAdvancedSearchModal(false);
                                }}>Apply Filters</button>
                                <button className="btn badge-danger" style={{ flex: 1, justifyContent: 'center', padding: '10px' }} onClick={() => {
                                    const empty = { search: '', dept: '', status: '', location: '', issueCat: '', level: '', severity: '' };
                                    setTempFilters(empty);
                                    setAgeingSearch('');
                                    setAdvAgeingDept('');
                                    setAdvAgeingStatus('');
                                    setAdvAgeingLocation('');
                                    setAdvAgeingIssueCat('');
                                    setAdvAgeingLevel('');
                                    setAdvAgeingSeverity('');
                                    setShowAdvancedAgeing(false);
                                    setShowAdvancedSearchModal(false);
                                }}>Clear & Reset</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {previewUrl && (
                <DocumentPreview
                    url={previewUrl}
                    onClose={() => setPreviewUrl(null)}
                />
            )}
        </Layout>
    );
};

export default ViewerDashboard;
