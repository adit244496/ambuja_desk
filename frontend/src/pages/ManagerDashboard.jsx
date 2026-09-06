import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api, { fetchTickets, fetchUsers, fetchTicketLogs } from '../api';
import Layout from '../components/Layout';
import { Users, Clock, Filter, Download, FileText, Activity, ChevronDown, ChevronUp, CheckCircle, Zap, ArrowUpRight, Paperclip, Minimize2, Maximize2, MessageSquare, RefreshCw, UserPlus, PlusCircle, Lock } from 'lucide-react';
import DocumentPreview from '../components/DocumentPreview';
import AttachmentBadge from '../components/AttachmentBadge';
import SLACountdownBadge from '../components/SLACountdownBadge';
import SLABreachModeToggle from '../components/SLABreachModeToggle';
import { exportExecutiveCSV, exportExecutivePDF } from '../utils/exportExecutiveReports';
import { parseDateString, getISTDate } from '../utils/dateUtils';

const ExpandableDescription = ({ text }) => {
    const [expanded, setExpanded] = useState(false);
    if (!text) return null;
    const isLong = text.length > 200;

    return (
        <div>
            <span style={{ color: '#a1a1aa', whiteSpace: 'pre-wrap', display: 'block', wordBreak: 'break-word' }}>
                {expanded || !isLong ? text : `${text.substring(0, 200)}...`}
            </span>
            {isLong && (
                <button
                    onClick={(e) => { e.preventDefault(); setExpanded(!expanded); }}
                    style={{
                        background: 'none', border: 'none', color: 'var(--text-muted)',
                        fontSize: '11px', cursor: 'pointer', padding: 0,
                        marginTop: '8px', fontWeight: 'bold'
                    }}
                >
                    {expanded ? 'View Less' : 'View Detailed Description'}
                </button>
            )}
        </div>
    );
};

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
                            {toName && <span style={{ marginLeft: '16px' }}><span style={{ fontWeight: 600, color: 'var(--text-main, #18181b)' }}>Target:</span> <span style={{ color: 'var(--text-muted)' }}>{toName}</span></span>}
                        </div>

                        {(hasDetails || hasRemarks) && (
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary, #3f3f46)', lineHeight: '1.5', padding: '10px 12px', backgroundColor: 'var(--bg-subtle, #f4f4f5)', borderRadius: '4px', borderLeft: `3px solid ${iconColor}` }}>
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

const ManagerDashboard = ({ user, setUser }) => {
    const location = useLocation();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showKPIs, setShowKPIs] = useState(true);
    const [usersList, setUsersList] = useState([]);
    const [ageingData, setAgeingData] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [panelTicket, setPanelTicket] = useState(null);
    const [isClosing, setIsClosing] = useState(false);
    const [ticketLogs, setTicketLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isAgeingExpanded, setIsAgeingExpanded] = useState(false);
    const [isSidePanelExpanded, setIsSidePanelExpanded] = useState(false);
    const [activeDetailsTab, setActiveDetailsTab] = useState('details');
    const [slaBreachMode, setSlaBreachMode] = useState('active'); // 'active' (Live / Active Breach) or 'all' (All-Time SLA Breach)

    const [comments, setComments] = useState([]);

    useEffect(() => {
        if (selectedTicket) {
            setPanelTicket(selectedTicket);
            setIsClosing(false);
            fetchComments(selectedTicket.ticket_id);
        } else if (panelTicket) {
            setIsClosing(true);
            const timer = setTimeout(() => {
                setPanelTicket(null);
                setIsClosing(false);
            }, 900);
            return () => clearTimeout(timer);
        }
    }, [selectedTicket, panelTicket]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [usersData, ageingRes] = await Promise.all([
                fetchUsers(),
                api.get('/reports/ageing').catch(() => ({ data: [] }))
            ]);
            setUsersList(Array.isArray(usersData) ? usersData : []);
            setAgeingData(Array.isArray(ageingRes?.data) ? ageingRes.data : []);
        } catch (err) {
            setError("Failed to load manager dashboard data.");
        } finally {
            setLoading(false);
        }
    };

    const fetchComments = async (ticketId) => {
        try {
            const res = await api.get(`/tickets/${ticketId}/comments`);
            setComments(res.data || []);
        } catch (err) {
            setComments([]);
        }
    };

    const handleTicketClick = async (ticket) => {
        setSelectedTicket(ticket);
        setLogsLoading(true);
        try {
            const logs = await fetchTicketLogs(ticket.ticket_id);
            setTicketLogs(logs);
        } catch (err) {
            setTicketLogs([]);
        } finally {
            setLogsLoading(false);
        }
    };

    const handlePreviewUrl = (url) => {
        if (!url) return;
        setPreviewUrl(url);
    };

    // Filter team members who report to this user
    const subordinateUsers = useMemo(() => {
        if (!user || !usersList || usersList.length === 0) return [];
        return usersList.filter(u =>
            u.reporting_manager && (String(u.reporting_manager) === String(user.employee_id) || String(u.reporting_manager) === String(user.email))
        );
    }, [usersList, user]);

    // Subordinate IDs / Names
    const subordinateIds = useMemo(() => {
        const set = new Set();
        subordinateUsers.forEach(u => {
            if (u.employee_id) set.add(String(u.employee_id));
            if (u.email) set.add(String(u.email));
        });
        return set;
    }, [subordinateUsers]);

    // Team Ageing Tickets
    const teamAgeingData = useMemo(() => {
        if (subordinateUsers.length === 0) return [];
        return ageingData.filter(a => {
            const assigned = String(a.assigned_to || '').trim();
            return subordinateIds.has(assigned) || subordinateUsers.some(u => u.name && assigned.includes(u.name));
        });
    }, [ageingData, subordinateUsers, subordinateIds]);

    // Search filter
    const filteredAgeing = useMemo(() => {
        if (!searchQuery.trim()) return teamAgeingData;
        const q = searchQuery.toLowerCase();
        return teamAgeingData.filter(t =>
            String(t.ticket_id).toLowerCase().includes(q) ||
            String(t.dept_assigned || '').toLowerCase().includes(q) ||
            String(t.issue_category || '').toLowerCase().includes(q) ||
            String(t.description || '').toLowerCase().includes(q) ||
            String(t.assigned_to || '').toLowerCase().includes(q) ||
            String(t.status || '').toLowerCase().includes(q)
        );
    }, [teamAgeingData, searchQuery]);

    const getUserObject = (identifier) => {
        if (!identifier || String(identifier).toLowerCase() === 'nan') return null;
        const str = String(identifier).trim().toLowerCase();
        return usersList.find(u => {
            const empId = String(u.employee_id || '').trim().toLowerCase();
            const email = String(u.email || '').trim().toLowerCase();
            const name = String(u.name || '').trim().toLowerCase();
            if (empId && (str === empId || str.includes(empId))) return true;
            if (email && (str === email || str.includes(email))) return true;
            if (name && (str === name || str.includes(name))) return true;
            return false;
        });
    };

    const formatSolverDetails = (solverId) => {
        if (!solverId || String(solverId).toLowerCase() === 'nan') return '-';
        const s = getUserObject(solverId);
        return s ? `${s.name} (${s.employee_id || s.email})` : solverId;
    };

    const getRaiserName = (ticket) => {
        if (!ticket) return '-';
        const identifier = ticket.raiser_name || ticket.raised_by || ticket.assigned_by;
        const u = getUserObject(identifier);
        return u ? `${u.name} (${u.employee_id || u.email})` : (ticket.raiser_name || ticket.raised_by || ticket.assigned_by || '-');
    };

    const getRaiserDesig = (ticket) => {
        if (!ticket) return '-';
        const identifier = ticket.raised_by || ticket.assigned_by || ticket.raiser_name;
        const u = getUserObject(identifier);
        return u?.designation || '-';
    };

    const getSolverDesig = (ticket) => {
        if (!ticket) return '-';
        const identifier = ticket.assigned_to;
        const u = getUserObject(identifier);
        return u?.designation || '-';
    };

    const getDisplayDelayDays = (a) => {
        if (!a) return '0d';
        if (a.solver_delay_hours !== undefined && a.solver_delay_hours !== null && Number(a.solver_delay_hours) > 0) {
            return (Number(a.solver_delay_hours) / 24).toFixed(1) + 'd';
        }
        if (a.delay_hours !== undefined && a.delay_hours !== null && Number(a.delay_hours) > 0) {
            return (Number(a.delay_hours) / 24).toFixed(1) + 'd';
        }
        if (!a.deadline || String(a.deadline).toLowerCase() === 'nan') return '0d';
        const deadlineDate = parseDateString(a.deadline);
        if (!deadlineDate) return '0d';

        const st = String(a.status || '').toLowerCase();
        const ct = String(a.closure_type || '').toLowerCase();
        const isFinished = ['closed', 'declined', 'on hold', 'on-hold'].includes(st) || ['declined', 'on hold'].includes(ct);

        if (isFinished) {
            const finishStr = a.closed_timestamp || a.solved_timestamp;
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

    const isLate = (ticket, targetMode = slaBreachMode) => {
        if (!ticket) return false;
        if (ticket.solver_delay_hours !== undefined && ticket.solver_delay_hours !== null && Number(ticket.solver_delay_hours) > 0) return true;
        if (!ticket.deadline || String(ticket.deadline).toLowerCase() === 'nan') return false;

        const deadlineDate = parseDateString(ticket.deadline);
        if (!deadlineDate) return false;

        const st = String(ticket.status || '').toLowerCase();
        const ct = String(ticket.closure_type || '').toLowerCase();
        const isFinished = ['closed', 'declined', 'on hold', 'on-hold'].includes(st) || ['declined', 'on hold'].includes(ct);

        if (targetMode === 'active') {
            if (isFinished) return false;
            return getISTDate() > deadlineDate;
        }

        if (isFinished) {
            const finishStr = ticket.closed_timestamp || ticket.solved_timestamp;
            if (finishStr && String(finishStr).toLowerCase() !== 'nan') {
                const finishDate = parseDateString(finishStr);
                if (finishDate) return finishDate > deadlineDate;
            }
            return ticket.SLA_Breach === true || ticket.SLA_Breach === 'True';
        }

        return getISTDate() > deadlineDate;
    };

    // Calculate Manager KPI stat counts
    const managerKPI = useMemo(() => {
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
        teamAgeingData.forEach(t => {
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

        teamAgeingData.forEach(t => {
            const stat = t.status ? String(t.status).toLowerCase() : '';
            const lvl = t.escalation_level || 'L1';

            increment('totalSubTasks', lvl);

            if (stat === 'open') increment('open', lvl);
            else if (stat === 'in progress') increment('inProgress', lvl);
            else if (stat === 'resolved') increment('resolved', lvl);
            else if (stat === 'closed') increment('closed', lvl);
            else if (stat === 'declined') increment('declined', lvl);
            else if (stat === 'on hold') increment('onHold', lvl);
            else if (stat === 'escalated' || stat === 'escalation resolved') increment('escalated', lvl);

            if (isLate(t, slaBreachMode)) {
                increment('late', lvl);
            }
        });

        return counts;
    }, [teamAgeingData, slaBreachMode]);

    const renderTooltip = (levels) => {
        const entries = Object.entries(levels || {});
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

    const handleDownloadCSV = () => {
        exportExecutiveCSV(filteredAgeing, {}, usersList);
    };

    return (
        <Layout user={user} setUser={setUser} sidebarTabs={[]} activeTab={''} setActiveTab={() => { }}>
            <div className="content-wrapper" style={{ paddingRight: selectedTicket && window.innerWidth > 768 ? '450px' : '0', transition: 'padding-right 0.9s', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>

                {/* HEADER */}
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '10px' }}>
                    <div>
                        <h2 style={{ fontSize: '19px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Clock size={22} color="#10b981" /> Manager Dashboard
                        </h2>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                            Ageing analytics and metrics report for tickets assigned to reporting team members
                        </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="🔍 Search team tickets..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ padding: '6px 12px', fontSize: '11px', width: '220px', margin: 0 }}
                        />
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
                        <button className="btn badge-success p-2 text-xs flex-row gap-1" onClick={handleDownloadCSV} title="Export CSV Report">
                            <Download size={13} /> Export CSV
                        </button>
                        <button className="btn badge-primary p-2 text-xs flex-row gap-1" onClick={() => exportExecutivePDF(filteredAgeing, {})} title="Export PDF Executive Summary">
                            <FileText size={13} /> Export PDF
                        </button>
                    </div>
                </div>

                {error && <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '8px', borderRadius: '4px', marginBottom: '12px', fontSize: '11px' }}>{error}</div>}

                {/* --- MANAGER KPI STAT TILES BOARD (COLLAPSIBLE) --- */}
                {showKPIs && (
                    <div className="kpi-grid">
                        <div className="card kpi-card kpi-blue" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #3b82f6', background: 'linear-gradient(180deg, rgba(59,130,246,0.25) 0%, rgba(59,130,246,0) 100%)' }}>
                            <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Total</p>
                            <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{managerKPI.total.count}</h2>
                        </div>
                        <div className="card kpi-card kpi-purple" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #8b5cf6', background: 'linear-gradient(180deg, rgba(139,92,246,0.25) 0%, rgba(139,92,246,0) 100%)' }}>
                            {renderTooltip(managerKPI.totalSubTasks.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Total Sub-Tasks</p>
                            <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{managerKPI.totalSubTasks.count}</h2>
                        </div>
                        <div className="card kpi-card kpi-amber" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #f59e0b', background: 'linear-gradient(180deg, rgba(245,158,11,0.25) 0%, rgba(245,158,11,0) 100%)' }}>
                            {renderTooltip(managerKPI.open.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Open</p>
                            <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{managerKPI.open.count}</h2>
                        </div>
                        <div className="card kpi-card kpi-purple" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #8b5cf6', background: 'linear-gradient(180deg, rgba(139,92,246,0.25) 0%, rgba(139,92,246,0) 100%)' }}>
                            {renderTooltip(managerKPI.inProgress.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>In Progress</p>
                            <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{managerKPI.inProgress.count}</h2>
                        </div>
                        <div className="card kpi-card kpi-teal" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #14b8a6', background: 'linear-gradient(180deg, rgba(20,184,166,0.25) 0%, rgba(20,184,166,0) 100%)' }}>
                            {renderTooltip(managerKPI.resolved.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Resolved</p>
                            <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{managerKPI.resolved.count}</h2>
                        </div>
                        <div className="card kpi-card kpi-green" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #10b981', background: 'linear-gradient(180deg, rgba(16,185,129,0.25) 0%, rgba(16,185,129,0) 100%)' }}>
                            {renderTooltip(managerKPI.closed.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Closed</p>
                            <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{managerKPI.closed.count}</h2>
                        </div>
                        <div className="card kpi-card kpi-gray" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #6b7280', background: 'linear-gradient(180deg, rgba(107,114,128,0.25) 0%, rgba(107,114,128,0) 100%)' }}>
                            {renderTooltip(managerKPI.declined.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Declined</p>
                            <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{managerKPI.declined.count}</h2>
                        </div>
                        <div className="card kpi-card kpi-gray" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #3b82f6', background: 'linear-gradient(180deg, rgba(59,130,246,0.25) 0%, rgba(59,130,246,0) 100%)' }}>
                            {renderTooltip(managerKPI.onHold.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>On Hold</p>
                            <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{managerKPI.onHold.count}</h2>
                        </div>
                        <div className="card kpi-card kpi-red" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #ef4444', background: 'linear-gradient(180deg, rgba(239,68,68,0.25) 0%, rgba(239,68,68,0) 100%)' }}>
                            {renderTooltip(managerKPI.escalated.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Escalate</p>
                            <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{managerKPI.escalated.count}</h2>
                        </div>
                        <div className="card kpi-card kpi-sla kpi-orange" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #F7941D', background: 'linear-gradient(180deg, rgba(247,148,29,0.25) 0%, rgba(247,148,29,0) 100%)' }}>
                            {renderTooltip(managerKPI.late.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>
                                {slaBreachMode === 'all' ? 'All-Time SLA Breach' : 'Live SLA Breach'}
                            </p>
                            <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{managerKPI.late.count}</h2>
                        </div>
                    </div>
                )}

                {/* TABLE CONTAINER */}
                <div className="card" style={isAgeingExpanded ? { position: 'fixed', inset: '16px', zIndex: 1000, backgroundColor: 'var(--bg-main, #0f172a)', margin: 0, padding: '20px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,0.8)' } : { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '16px' }}>
                    <div className="flex-row justify-between mb-4 gap-3">
                        <h3 className="m-0 text-lg" style={{ whiteSpace: 'nowrap' }}>⏳ Full Ticket Ageing Analytics</h3>
                        <div className="flex-row justify-end gap-2 flex-1" style={{ alignItems: 'center' }}>
                            <button className="btn badge-success p-2 text-xs flex-row gap-1" onClick={handleDownloadCSV} style={{ whiteSpace: 'nowrap' }} title="Download CSV">
                                <Download size={11} />
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
                                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>ID</th>
                                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Dept</th>
                                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Issue Cat.</th>
                                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Act. Cat.</th>
                                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Description</th>
                                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Location</th>
                                        <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold' }}>Image</th>
                                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Deadline</th>
                                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Level</th>
                                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Severity</th>
                                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Status</th>
                                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Assigned By</th>
                                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Assigned To</th>
                                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Ticket Age</th>
                                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Res. Time</th>
                                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Turnaround</th>
                                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Delay</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="17" className="text-center p-4 text-muted">Loading team ageing report...</td></tr>
                                    ) : filteredAgeing.length === 0 ? (
                                        <tr><td colSpan="17" className="text-center p-4 text-muted">No tickets found for your reporting team members.</td></tr>
                                    ) : (
                                        filteredAgeing.map((a, index) => {
                                            const isGrouped = index > 0 && a.ticket_id === filteredAgeing[index - 1].ticket_id;
                                            let rowSpan = 1;
                                            let anySLA = a.SLA_Breach;
                                            if (!isGrouped) {
                                                for (let i = index + 1; i < filteredAgeing.length; i++) {
                                                    if (filteredAgeing[i].ticket_id === a.ticket_id) {
                                                        rowSpan++;
                                                        if (filteredAgeing[i].SLA_Breach === true || String(filteredAgeing[i].SLA_Breach).toLowerCase() === 'true') {
                                                            anySLA = true;
                                                        }
                                                    }
                                                    else break;
                                                }
                                            }
                                            const dDays = getDisplayDelayDays(a);
                                            const isDelay = dDays !== '0d';
                                            return (
                                                <tr key={`${a.ticket_id}-${a.escalation_level || 'L1'}-${a.timestamp || ''}-${index}`} className="clickable" onClick={() => handleTicketClick(a)}>
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
                                                    <td style={{ padding: '12px 8px' }}>{a.deadline ? String(a.deadline).split(' ')[0] : '-'}</td>
                                                    <td style={{ padding: '12px 8px' }}><span style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold' }}>{a.escalation_level || 'L1'}</span></td>
                                                    <td style={{ padding: '12px 8px' }}>{a.severity || '-'}</td>
                                                    <td style={{ padding: '12px 8px' }}>{a.status}</td>
                                                    <td style={{ padding: '12px 8px' }} className="text-muted">{formatSolverDetails(a.assigned_by)}</td>
                                                    <td style={{ padding: '12px 8px' }} className="text-primary">{formatSolverDetails(a.assigned_to)}</td>
                                                    <td style={{ padding: '12px 8px' }} className="font-bold">{a.ticket_age_hours ? `${(a.ticket_age_hours / 24).toFixed(1)}d` : '-'}</td>
                                                    <td style={{ padding: '12px 8px' }}>{a.solver_resolution_hours ? `${(a.solver_resolution_hours / 24).toFixed(1)}d` : '-'}</td>
                                                    <td style={{ padding: '12px 8px' }}>{a.total_turnaround_hours ? `${(a.total_turnaround_hours / 24).toFixed(1)}d` : '-'}</td>
                                                    <td style={{ padding: '12px 8px', color: isDelay ? '#ef4444' : 'inherit', fontWeight: isDelay ? 'bold' : 'normal' }}>
                                                        {dDays}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* DETAILS RIGHT SIDE PANEL */}
            {panelTicket && (() => {
                const selectedTicket = panelTicket;
                return (
                    <div className={isClosing ? "slide-out-right-panel ticket-details-panel" : "slide-in-right-panel ticket-details-panel"} style={{
                        position: 'fixed',
                        top: isSidePanelExpanded ? '2vh' : '52px',
                        bottom: isSidePanelExpanded ? '2vh' : '0',
                        right: isSidePanelExpanded ? 'max(5vw, calc(50% - 700px))' : '0',
                        width: isSidePanelExpanded ? 'min(90vw, 1400px)' : '450px',
                        margin: 0, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
                        zIndex: isSidePanelExpanded ? 1050 : 900,
                        borderRadius: isSidePanelExpanded ? '12px' : 0,
                        boxShadow: isSidePanelExpanded ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)' : '-10px 0 30px rgba(0,0,0,0.05)',
                        backgroundColor: 'var(--bg-card)',
                        backdropFilter: 'var(--glass-blur)',
                        WebkitBackdropFilter: 'var(--glass-blur)',
                        transform: 'translateZ(0)',
                        transition: 'top 0.9s cubic-bezier(0.4, 0, 0.2, 1), right 0.9s cubic-bezier(0.4, 0, 0.2, 1), width 0.9s cubic-bezier(0.4, 0, 0.2, 1), bottom 0.9s cubic-bezier(0.4, 0, 0.2, 1), border-radius 0.9s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.9s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}>
                        <div style={{ padding: '24px 30px 0 30px', zIndex: 10, backgroundColor: 'var(--bg-card)', borderRadius: isSidePanelExpanded ? '12px 12px 0 0' : 0 }}>
                            <div className="side-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    #{selectedTicket.ticket_id}
                                    <span style={{ backgroundColor: selectedTicket.status === 'Closed' ? '#e4e4e7' : selectedTicket.status === 'Resolved' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)', color: selectedTicket.status === 'Closed' ? '#71717a' : selectedTicket.status === 'Resolved' ? '#10b981' : '#3b82f6', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold' }}>{selectedTicket.status}</span>
                                </h3>
                                <div className="side-panel-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <button onClick={() => setIsSidePanelExpanded(!isSidePanelExpanded)} style={{ background: 'none', border: 'none', color: 'var(--text-main, #0f172a)', fontSize: '16px', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={isSidePanelExpanded ? "Collapse" : "Expand"}>
                                        {isSidePanelExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                                    </button>
                                    <button onClick={() => { setSelectedTicket(null); setIsSidePanelExpanded(false); }} style={{ background: 'none', border: 'none', color: 'var(--text-main, #0f172a)', fontSize: '16px', cursor: 'pointer', padding: '4px' }}>✕</button>
                                </div>
                            </div>
                            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                                <button onClick={() => setActiveDetailsTab('details')} style={{ flex: 1, padding: '10px 4px', fontSize: '13px', fontWeight: '600', backgroundColor: 'transparent', color: activeDetailsTab === 'details' ? '#3b82f6' : 'var(--text-main, #0f172a)', border: 'none', borderBottom: activeDetailsTab === 'details' ? '2px solid #3b82f6' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '-1px' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><FileText size={14} /> Details</div></button>
                                <button onClick={() => setActiveDetailsTab('timeline')} style={{ flex: 1, padding: '10px 4px', fontSize: '13px', fontWeight: '600', backgroundColor: 'transparent', color: activeDetailsTab === 'timeline' ? '#3b82f6' : 'var(--text-main, #0f172a)', border: 'none', borderBottom: activeDetailsTab === 'timeline' ? '2px solid #3b82f6' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '-1px' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Clock size={14} /> Timeline</div></button>
                                <button onClick={() => setActiveDetailsTab('chat')} style={{ flex: 1, padding: '10px 4px', fontSize: '13px', fontWeight: '600', backgroundColor: 'transparent', color: activeDetailsTab === 'chat' ? '#3b82f6' : 'var(--text-main, #0f172a)', border: 'none', borderBottom: activeDetailsTab === 'chat' ? '2px solid #3b82f6' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '-1px' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><MessageSquare size={14} /> Chat</div></button>
                            </div>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', zIndex: 10, display: 'flex', flexDirection: 'column', background: 'transparent' }}>
                            {activeDetailsTab === 'details' && (
                                <div style={{ paddingBottom: '20px' }}>
                                    <div className="ticket-info-grid" style={{ display: 'grid', gridTemplateColumns: isSidePanelExpanded ? 'repeat(4, 1fr)' : '1fr 1fr', gap: '14px', fontSize: '13px', color: '#71717a', marginBottom: '16px' }}>
                                        <div><strong style={{ color: 'var(--text-main)' }}>Raised On:</strong> <span style={{ color: '#a1a1aa' }}>{(selectedTicket.timestamp || selectedTicket.created_at || selectedTicket.deadline)?.split(' ')[0]}</span></div>
                                        {selectedTicket.deadline ? <div><strong style={{ color: 'var(--text-main)' }}>Deadline:</strong> <span style={{ color: 'var(--text-muted)' }}>{selectedTicket.deadline?.split(' ')[0]}</span></div> : <div></div>}
                                        <div><strong style={{ color: 'var(--text-main)' }}>Current Raiser:</strong> <span style={{ color: 'var(--text-muted)' }}>{getRaiserName(selectedTicket)}</span></div>
                                        <div><strong style={{ color: 'var(--text-main)' }}>Raiser Desig:</strong> <span style={{ color: '#a1a1aa' }}>{getRaiserDesig(selectedTicket)}</span></div>
                                        <div><strong style={{ color: 'var(--text-main)' }}>Assigned To:</strong> <span style={{ color: 'var(--text-muted)' }}>{formatSolverDetails(selectedTicket.assigned_to)}</span></div>
                                        <div><strong style={{ color: 'var(--text-main)' }}>Solver Desig:</strong> <span style={{ color: '#a1a1aa' }}>{getSolverDesig(selectedTicket)}</span></div>
                                        <div style={{ gridColumn: '1 / -1' }}><strong style={{ color: 'var(--text-main)' }}>Location:</strong> <span style={{ color: '#a1a1aa' }}>{selectedTicket.location}</span></div>
                                        {selectedTicket.original_raiser && String(selectedTicket.original_raiser).toLowerCase() !== 'nan' && selectedTicket.original_raiser !== selectedTicket.raised_by && (
                                            <div><strong style={{ color: 'var(--text-main)' }}>Original Raiser:</strong> <span style={{ color: 'var(--text-muted)' }}>{selectedTicket.original_raiser_name || selectedTicket.original_raiser}</span></div>
                                        )}
                                        {selectedTicket.parent_ticket_id && String(selectedTicket.parent_ticket_id).toLowerCase() !== 'nan' && <div><strong style={{ color: 'var(--text-main)' }}>Escalated From:</strong> <span style={{ color: '#ef4444' }}>#{selectedTicket.parent_ticket_id}</span></div>}
                                        {selectedTicket.solved_timestamp && String(selectedTicket.solved_timestamp).toLowerCase() !== 'nan' && selectedTicket.status !== 'Closed' && <div><strong style={{ color: 'var(--text-main)' }}>Resolved On:</strong> <span style={{ color: 'var(--text-muted)' }}>{selectedTicket.solved_timestamp?.split(' ')[0]}</span></div>}
                                        {selectedTicket.closed_timestamp && String(selectedTicket.closed_timestamp).toLowerCase() !== 'nan' && selectedTicket.status === 'Closed' && <div><strong style={{ color: 'var(--text-main)' }}>Closed On:</strong> <span style={{ color: 'var(--text-muted)' }}>{selectedTicket.closed_timestamp?.split(' ')[0]}</span></div>}
                                    </div>

                                    <div className="ticket-desc-attachment-row" style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '20px', position: 'relative', zIndex: 10 }}>
                                        <div className="detail-box" style={{ flex: 1, minWidth: 0, fontSize: '13px', padding: '14px', borderRadius: '6px', lineHeight: '1.6', backgroundColor: 'var(--bg-main)', height: selectedTicket.attachment && String(selectedTicket.attachment).toLowerCase() !== 'nan' ? '142px' : 'auto', maxHeight: '142px', overflowY: 'auto' }}>
                                            <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '8px', fontSize: '13px' }}>Issue Description:</strong>
                                            <ExpandableDescription text={selectedTicket.description} />
                                        </div>
                                        {selectedTicket.attachment && String(selectedTicket.attachment).toLowerCase() !== 'nan' && (
                                            <div style={{ flexShrink: 0, width: '112px' }}>
                                                <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '8px', fontSize: '13px' }}>Attached File:</strong>
                                                {(() => {
                                                    const attachStr = String(selectedTicket.attachment);
                                                    const fileUrl = attachStr.startsWith('data:') ? attachStr : `/uploads/${attachStr}`;
                                                    return (
                                                        <div
                                                            style={{ width: '112px', height: '112px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #3f3f46', cursor: 'pointer', position: 'relative', backgroundColor: '#000' }}
                                                            onClick={() => handlePreviewUrl(fileUrl)}
                                                        >
                                                            <img src={fileUrl} alt="Attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
                                                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px', backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '8px', textAlign: 'center' }}>Click to view</div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
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

                            {activeDetailsTab === 'chat' && (
                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative', zIndex: 10, height: '100%' }}>
                                    <div className="chat-container frosted-chat-box" style={{ flex: 1, overflowY: 'auto', padding: '12px', borderRadius: '5px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {ticketLogs.filter(l => l.action === 'Chat' || l.action === 'Message').length === 0 && comments.length === 0 ? (
                                            <p style={{ color: '#71717a', fontSize: '11px', textAlign: 'center' }}>No chat history available.</p>
                                        ) : (
                                            [
                                                ...ticketLogs.filter(l => l.action === 'Chat' || l.action === 'Message').map(l => ({
                                                    user: l.user || l.user_id || 'System',
                                                    text: l.remarks || l.details,
                                                    time: l.timestamp?.split(' ')[0] || ''
                                                })),
                                                ...comments.map(c => ({
                                                    user: formatSolverDetails(c.sender_id),
                                                    text: c.comment,
                                                    time: c.created_at?.split(' ')[0] || ''
                                                }))
                                            ].map((msg, i) => (
                                                <div key={i} style={{ alignSelf: 'flex-start', maxWidth: '85%', borderRadius: '8px', padding: '10px 12px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border)' }}>
                                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 'bold' }}>{msg.user} • {msg.time}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-main)', whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <div style={{ padding: '10px', borderTop: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '0 0 6px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                        <Lock size={12} /> Read-only mode for Manager Dashboard
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
                                        <linearGradient id={`mgrCityGlow${i}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" className="glow-stop-top" />
                                            <stop offset="50%" className="glow-stop-base" />
                                            <stop offset="100%" className="glow-stop-base" />
                                        </linearGradient>
                                    </defs>
                                    <rect x="0" y="170" width="200" height="230" fill={`url(#mgrCityGlow${i})`} />
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

            {/* PREVIEW MODAL */}
            {previewUrl && (
                <DocumentPreview url={previewUrl} onClose={() => setPreviewUrl(null)} />
            )}
        </Layout>
    );
};

export default ManagerDashboard;
