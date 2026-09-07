import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api, { fetchTickets, createTicket, fetchLocations, fetchUsers, fetchTicketLogs, fetchIssueCategories, fetchActivityCategories, fetchDepartments, updateTicketStatus } from '../api';
import Layout from '../components/Layout';
import { Paperclip, AlertCircle, CheckCircle2, Filter, MessageSquare, PlusCircle, ClipboardList, Users, FileText, Clock, Activity, ArrowUpRight, RefreshCw, CheckCircle, UserPlus, ChevronDown, ChevronUp, Maximize2, Minimize2, ImagePlus, Download, Zap, Calendar } from 'lucide-react';
import DocumentPreview from '../components/DocumentPreview';
import AttachmentBadge from '../components/AttachmentBadge';
import SLACountdownBadge from '../components/SLACountdownBadge';
import SLABreachModeToggle from '../components/SLABreachModeToggle';
import { getISTDate, getISTMinDatetime, getISTTomorrowDate, parseDateString } from '../utils/dateUtils';

// --- COLLAPSIBLE TIMELINE NODE ---
const CollapsibleTimelineNode = ({ log, iconColor, Icon, toName, onPreview }) => {
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
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary, #3f3f46)', lineHeight: '1.5', padding: '6px 10px', backgroundColor: 'var(--bg-subtle, #f4f4f5)', borderRadius: '4px', borderLeft: `3px solid ${iconColor}` }}>
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

// --- CUSTOM SINGLE SELECT SEARCH DROPDOWN ---
const SearchSelect = ({ options, value, onChange, placeholder, usersList }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');

    const filtered = options.filter(o => {
        const label = typeof o === 'object' && o !== null ? o.label : o;
        if (!search) return true;
        return label && String(label).toLowerCase().startsWith(String(search).toLowerCase());
    });

    const randomName = useMemo(() => "search_" + Math.random().toString(36).substring(7), []);

    const displayValue = useMemo(() => {
        if (!value) return '';
        const valStr = String(value).trim().toLowerCase();
        const selected = options.find(o => {
            const oVal = typeof o === 'object' && o !== null ? o.value : o;
            return String(oVal).trim().toLowerCase() === valStr;
        });
        if (selected) return typeof selected === 'object' ? selected.label : selected;
        if (Array.isArray(usersList)) {
            const solver = usersList.find(u =>
                String(u.employee_id).trim().toLowerCase() === valStr ||
                String(u.email).trim().toLowerCase() === valStr
            );
            if (solver) return `${solver.name} (${solver.phone_number || solver.phone || 'N/A'})`;
        }
        return value;
    }, [value, options, usersList]);

    return (
        <div style={{ position: 'relative', zIndex: isOpen ? 1000 : 1 }}>
            <input
                type="search"
                name={randomName}
                id={randomName}
                className="form-control form-control-sm"
                placeholder={placeholder}
                value={isOpen ? search : displayValue}
                onChange={e => { setSearch(e.target.value); setIsOpen(true); }}
                onFocus={() => { setIsOpen(true); setSearch(''); }}
                onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                autoComplete="new-password"
                spellCheck="false"
                style={{ padding: '8px 12px', fontSize: '11px', borderBottomLeftRadius: isOpen ? 0 : 4, borderBottomRightRadius: isOpen ? 0 : 4 }}
            />
            {isOpen && (
                <div className="dropdown-menu-solid" style={{
                    position: 'absolute', top: '100%', left: 0, width: '100%',
                    border: '1px solid var(--border)', borderTop: 'none',
                    zIndex: 1000, maxHeight: '160px', overflowY: 'auto',
                    boxShadow: '0 8px 12px -2px rgba(0,0,0,0.1)', borderRadius: '0 0 4px 4px'
                }}>
                    {filtered.length === 0 ? (
                        <div style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-muted)' }}>No results</div>
                    ) : (
                        filtered.map((opt, idx) => {
                            const val = typeof opt === 'object' && opt !== null ? opt.value : opt;
                            const label = typeof opt === 'object' && opt !== null ? opt.label : opt;
                            return (
                                <div
                                    key={val || idx}
                                    onMouseDown={(e) => { e.preventDefault(); onChange(val); setIsOpen(false); }}
                                    style={{ padding: '8px 12px', fontSize: '11px', cursor: 'pointer', color: 'var(--text-main)', borderBottom: '1px solid var(--border)' }}
                                    onMouseOver={e => { e.currentTarget.style.backgroundColor = 'var(--primary)'; e.currentTarget.style.color = '#fff'; }}
                                    onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-main)'; }}
                                >
                                    {label}
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};

// --- CUSTOM MULTI SELECT SEARCH DROPDOWN ---
const MultiSearchSelect = ({ options, selectedValues, onChange, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const wrapperRef = React.useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filtered = options.filter(o =>
        o && (!search || String(o).toLowerCase().startsWith(String(search).toLowerCase())) && !selectedValues.includes(o)
    );

    const removeValue = (val) => {
        onChange(selectedValues.filter(v => v !== val));
    };

    const randomName = useMemo(() => "multi_search_" + Math.random().toString(36).substring(7), []);

    return (
        <div ref={wrapperRef} style={{ position: 'relative', zIndex: isOpen ? 1000 : 1 }}>
            <style>{`
                .no-inner-border {
                    border: none !important;
                    box-shadow: none !important;
                    background: transparent !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    outline: none !important;
                    color: inherit !important;
                }
            `}</style>
            <div
                className="form-control"
                style={{ padding: '6px', minHeight: '36px', display: 'flex', flexWrap: 'wrap', gap: '6px', cursor: 'text', borderBottomLeftRadius: isOpen ? 0 : 4, borderBottomRightRadius: isOpen ? 0 : 4 }}
                onClick={() => setIsOpen(true)}
            >
                {selectedValues.map(val => (
                    <span key={val} style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border)', fontSize: '10px', padding: '3px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                        {val}
                        <span onClick={(e) => { e.stopPropagation(); removeValue(val); }} style={{ cursor: 'pointer', opacity: 0.5, fontSize: '8px' }} onMouseOver={e => e.currentTarget.style.opacity = 1} onMouseOut={e => e.currentTarget.style.opacity = 0.5}>✕</span>
                    </span>
                ))}
                <input
                    type="search"
                    name={randomName}
                    id={randomName}
                    className="no-inner-border"
                    placeholder={selectedValues.length === 0 ? placeholder : ''}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onFocus={() => setIsOpen(true)}
                    autoComplete="new-password"
                    spellCheck="false"
                    style={{ flex: 1, minWidth: '80px', fontSize: '11px', alignSelf: 'center' }}
                />
            </div>
            {isOpen && (
                <div className="dropdown-menu-solid" style={{
                    position: 'absolute', top: '100%', left: 0, width: '100%',
                    border: '1px solid var(--border)', borderTop: 'none',
                    zIndex: 1000, maxHeight: '160px', overflowY: 'auto',
                    boxShadow: '0 8px 12px -2px rgba(0,0,0,0.1)', borderRadius: '0 0 4px 4px'
                }}>
                    {filtered.length === 0 ? (
                        <div style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-muted)' }}>No results</div>
                    ) : (
                        filtered.map(opt => (
                            <div
                                key={opt}
                                onMouseDown={(e) => { e.preventDefault(); onChange([...selectedValues, opt]); setSearch(''); }}
                                style={{ padding: '8px 12px', fontSize: '11px', cursor: 'pointer', color: 'var(--text-main)', borderBottom: '1px solid var(--border)' }}
                                onMouseOver={e => { e.currentTarget.style.backgroundColor = 'var(--primary)'; e.currentTarget.style.color = '#fff'; }}
                                onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-main)'; }}
                            >
                                {opt}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

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
                        background: 'none', border: 'none', color: '#3b82f6',
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

const RequestorDashboard = ({ user, setUser }) => {
    const routerLocation = useLocation();
    const navigate = useNavigate();
    const [tickets, setTickets] = useState([]);
    const [locations, setLocations] = useState([]);
    const [issueCategoriesList, setIssueCategoriesList] = useState([]);
    const [activityCategoriesList, setActivityCategoriesList] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [usersList, setUsersList] = useState([]);

    const [activeTab, setActiveTab] = useState('history');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showKPIs, setShowKPIs] = useState(true);
    const [slaBreachMode, setSlaBreachMode] = useState('active'); // 'active' (Live / Active Breach) or 'all' (All-Time SLA Breach)

    const [selectedTicket, setSelectedTicket] = useState(null);
    const [panelTicket, setPanelTicket] = useState(null);
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        if (selectedTicket) {
            setPanelTicket(selectedTicket);
            setIsClosing(false);
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
        if (panelTicket && !isClosing) {
            document.body.classList.add('panel-open');
            document.documentElement.classList.add('panel-open');
        } else if (!panelTicket || isClosing) {
            document.body.classList.remove('panel-open');
            document.documentElement.classList.remove('panel-open');
        }
        return () => {
            document.body.classList.remove('panel-open');
            document.documentElement.classList.remove('panel-open');
        };
    }, [panelTicket, isClosing]);

    const [isSidePanelExpanded, setIsSidePanelExpanded] = useState(false);
    const [enlargedPreviewImage, setEnlargedPreviewImage] = useState(null);
    const [previewFile, setPreviewFile] = useState(null);
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

    const handlePreviewFile = (file) => {
        if (!file) return;
        if (file.name?.toLowerCase().endsWith('.doc')) {
            window.open(URL.createObjectURL(file), '_blank');
        } else {
            setPreviewFile(file);
        }
    };

    useEffect(() => {
        const params = new URLSearchParams(routerLocation.search);
        const ticketId = params.get('ticket_id');
        if (ticketId && tickets.length > 0) {
            const ticket = tickets.find(t => String(t.ticket_id) === String(ticketId));
            if (ticket) {
                setActiveTab('history');
                handleTicketClick(ticket);
                navigate(routerLocation.pathname, { replace: true });
            }
        }
    }, [routerLocation.search, tickets]);

    const [reassignTarget, setReassignTarget] = useState('');
    const [ticketLogs, setTicketLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [activeDetailsTab, setActiveDetailsTab] = useState('details');
    const [acceptRemarks, setAcceptRemarks] = useState('');
    const [acceptAttachment, setAcceptAttachment] = useState(null);
    const [chatInput, setChatInput] = useState('');

    const [severity, setSeverity] = useState('Minor');
    const [dept, setDept] = useState('');
    const [issueCat, setIssueCat] = useState('');
    const [activityCat, setActivityCat] = useState('');
    const [location, setLocation] = useState('');
    const [assignedTo, setAssignedTo] = useState('');
    const [notifyUsers, setNotifyUsers] = useState([]);
    const [deadline, setDeadline] = useState('');
    const [description, setDescription] = useState('');
    const [attachment, setAttachment] = useState(null);
    const [fileName, setFileName] = useState('');
    const [isCompressing, setIsCompressing] = useState(false);

    const [smartKbMatches, setSmartKbMatches] = useState([]);
    const [smartSuggestions, setSmartSuggestions] = useState(null);
    const [isSuggesting, setIsSuggesting] = useState(false);
    const userTouchedSolverRef = useRef(false);
    const userTouchedDeadlineRef = useRef(false);

    useEffect(() => {
        if (!description || description.trim().length < 2) {
            setSmartKbMatches([]);
            setSmartSuggestions(null);
            return;
        }
        const timer = setTimeout(async () => {
            setIsSuggesting(true);
            try {
                const res = await api.post('/tickets/smart_suggest', { query: description });
                if (res.data && res.data.suggested_categories) {
                    const sug = res.data.suggested_categories;
                    setSmartKbMatches(res.data.knowledge_base_matches || []);
                    setSmartSuggestions(sug);
                }
            } catch (err) {
                console.error("Smart suggest failed:", err);
            } finally {
                setIsSuggesting(false);
            }
        }, 200);
        return () => clearTimeout(timer);
    }, [description]);

    const [searchQuery, setSearchQuery] = useState('');
    const [showAdvancedSearchModal, setShowAdvancedSearchModal] = useState(false);
    const [tempFilters, setTempFilters] = useState({ search: '', dept: '', activityCat: '', issueCat: '', location: '', assignedTo: '', status: '', severity: '' });
    const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
    const [advDept, setAdvDept] = useState('');
    const [advIssueCat, setAdvIssueCat] = useState('');
    const [advActivityCat, setAdvActivityCat] = useState('');
    const [advLocation, setAdvLocation] = useState('');
    const [advAssignedTo, setAdvAssignedTo] = useState('');
    const [advStatus, setAdvStatus] = useState('');
    const [advSeverity, setAdvSeverity] = useState('');
    const [advLevel, setAdvLevel] = useState('');

    const formatDatetimeLocal = (date) => {
        const d = new Date(date);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 16);
    };

    const getLocalMinDatetime = () => {
        return getISTMinDatetime().slice(0, 10);
    };

    const getTomorrowDatetime = () => {
        return getISTTomorrowDate();
    };

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            const [ticketData, locationData, issueCatData, actCatData, usersData, deptData] = await Promise.all([
                fetchTickets(true), fetchLocations(), fetchIssueCategories(), fetchActivityCategories(), fetchUsers(), fetchDepartments()
            ]);

            let safeTickets = ticketData?.data || ticketData;
            if (typeof safeTickets === 'string') safeTickets = JSON.parse(safeTickets);
            setTickets(Array.isArray(safeTickets) ? safeTickets : []);

            setLocations(locationData);
            setIssueCategoriesList(Array.isArray(issueCatData) ? issueCatData : []); setActivityCategoriesList(Array.isArray(actCatData) ? actCatData : []);
            setUsersList(usersData);
            setDepartments(Array.isArray(deptData) ? deptData : []);

            if (usersData.length > 0) {
                const uniqueDepts = (Array.isArray(deptData) && deptData.length > 0) ? deptData.map(d => d.department) : [...new Set((usersData || []).map(u => u.department).filter(Boolean))];
                if (uniqueDepts.length > 0) setDept(uniqueDepts[0]);
            }

            // Deadline left empty so the browser shows native placeholder (dd-mm-yyyy hh:mm)
            setDeadline('');

        } catch (err) {
            setError("Failed to load dashboard data.");
        } finally {
            setLoading(false);
        }
    };

    const handleTicketClick = async (ticket) => {
        setSelectedTicket(ticket);
        setReassignTarget('');
        setActiveDetailsTab('details');
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

    const handleAcceptSubmit = async (e) => {
        e.preventDefault();
        try {
            const formData = new FormData();
            formData.append('ticket_id', selectedTicket.ticket_id);
            formData.append('escalation_level', selectedTicket.escalation_level || 'L1');
            formData.append('status', 'Closed');
            formData.append('remarks', acceptRemarks);
            formData.append('user_email', user.email);
            formData.append('user_role', user.role || 'User');
            if (acceptAttachment) {
                formData.append('attachment', acceptAttachment);
            }

            await api.post('/tickets/update_status', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            alert('Resolution accepted and ticket closed successfully.');
            setSelectedTicket(null);
            setAcceptRemarks('');
            setAcceptAttachment(null);
            loadDashboardData();
        } catch (err) {
            alert(err.response?.data?.error || "Failed to accept resolution.");
        }
    };

    const handleStatusAction = async (newStatus, customRemarks = null) => {
        try {
            let remarks = customRemarks;
            if (!remarks) {
                if (newStatus === 'Closed') {
                    remarks = selectedTicket.status === 'Declined' ? 'Requestor closed the ticket after it was declined.' : 'Requestor accepted the resolution and closed the ticket.';
                } else {
                    remarks = selectedTicket.status === 'Declined' ? 'Requestor reopened the declined ticket.' : 'Requestor rejected the resolution and reopened the ticket.';
                }
            }

            const formData = new FormData();
            formData.append('ticket_id', selectedTicket.ticket_id);
            formData.append('escalation_level', selectedTicket.escalation_level || 'L1');
            formData.append('status', newStatus);
            formData.append('remarks', remarks);
            formData.append('user_email', user.email);
            formData.append('user_role', user.role || 'User');
            if (acceptAttachment) {
                formData.append('attachment', acceptAttachment);
            }

            if (newStatus === 'Reopened' && reassignTarget) {
                formData.append('new_solver', reassignTarget);
            }

            await api.post('/tickets/update_status', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            // Refresh ticket data
            const res = await fetchTickets(true);
            let parsed = res?.data || res;
            if (typeof parsed === 'string') parsed = JSON.parse(parsed);

            setTickets(Array.isArray(parsed) ? parsed : []);

            const updated = (Array.isArray(parsed) ? parsed : []).find(t => t.ticket_id === selectedTicket.ticket_id);
            if (updated) setSelectedTicket(updated);

            const logs = await fetchTicketLogs(selectedTicket.ticket_id);
            setTicketLogs(logs);

        } catch (err) {
            console.error(err);
            alert("Failed to update status.");
        }
    };

    const handleDirectReassign = async () => {
        if (!reassignTarget) return;
        try {
            const payload = {
                ticket_id: selectedTicket.ticket_id,
                escalation_level: selectedTicket.escalation_level || 'L1',
                status: selectedTicket.status, // keep current status
                remarks: `Requestor reassigned the ticket to the new solver.`,
                user_email: user.email,
                user_role: user.role || 'User',
                new_solver: reassignTarget,
                is_direct_reassign: true
            };

            await updateTicketStatus(payload);

            const res = await fetchTickets(true);
            let parsed = res?.data || res;
            if (typeof parsed === 'string') parsed = JSON.parse(parsed);

            setTickets(Array.isArray(parsed) ? parsed : []);

            alert("Ticket successfully reassigned!");
            setSelectedTicket(null);
            setReassignTarget('');
            loadDashboardData();
        } catch (err) {
            alert("Error reassigning ticket: " + (err.response?.data?.error || err.message));
        }
    };

    const handleSendChat = async (e) => {
        e.preventDefault();
        if (!chatInput.trim()) return;

        try {
            await api.post('/tickets/chat', { ticket_id: selectedTicket.ticket_id, user_email: user.email, message: chatInput });
            setChatInput('');
            const logs = await fetchTicketLogs(selectedTicket.ticket_id);
            setTicketLogs(logs);
        } catch (err) {
            alert("Failed to send message. Ensure your backend is updated.");
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const validTypes = [
            'image/jpeg', 'image/png', 'image/jpg', 'application/pdf',
            'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        const validExtensions = /\.(jpg|jpeg|png|pdf|xlsx|xls|doc|docx)$/i;

        if (!validTypes.includes(file.type) && !file.name.match(validExtensions)) {
            alert("Only image, PDF, Excel, and Word files can be uploaded.");
            e.target.value = ''; setAttachment(null); setFileName('');
            return;
        }

        const MAX_IMG_KB = 20;
        const MAX_IMG_BYTES = MAX_IMG_KB * 1024;

        if (file.type === 'application/pdf' || file.name.match(/\.(xlsx|xls|doc|docx|pdf)$/i)) {
            const MAX_DOC_MB = 5;
            const MAX_DOC_BYTES = MAX_DOC_MB * 1024 * 1024;
            if (file.size > MAX_DOC_BYTES) {
                alert(`Document file must be under ${MAX_DOC_MB}MB.`);
                e.target.value = ''; setAttachment(null); setFileName('');
                return;
            }
            setFileName(file.name);
            setAttachment(file);
            if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                window.open(URL.createObjectURL(file), '_blank');
            }
            return;
        }

        setFileName(file.name);
        setIsCompressing(true);
        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let { width, height } = img;
                    const max_dim = 960;
                    if (width > max_dim || height > max_dim) {
                        if (width > height) { height *= max_dim / width; width = max_dim; }
                        else { width *= max_dim / height; height = max_dim; }
                    }
                    canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    let quality = 0.9;
                    const attemptCompression = () => {
                        canvas.toBlob((blob) => {
                            if (blob.size > MAX_IMG_BYTES && quality > 0.1) {
                                quality -= 0.15; attemptCompression();
                            } else {
                                const compressedFile = new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() });
                                setAttachment(compressedFile);
                                setIsCompressing(false);
                            }
                        }, 'image/jpeg', quality);
                    };
                    attemptCompression();
                };
            };
        } catch (err) {
            alert("Failed to process image.");
            e.target.value = ''; setAttachment(null); setFileName(''); setIsCompressing(false);
        }
    };

    const handleRaiseTicket = async (e) => {
        e.preventDefault();
        if (isCompressing) return alert("Please wait for the image to finish compressing.");
        if (!assignedTo) return alert("Please assign the ticket to a user.");
        if (String(assignedTo) === String(user.employee_id)) return alert("You cannot raise a ticket for an issue assigned to you.");

        try {
            const formData = new FormData();
            formData.append('raised_by', user.employee_id);
            formData.append('dept', dept);
            formData.append('issue_category', issueCat);
            formData.append('activity_category', activityCat);
            formData.append('location', location);
            formData.append('assigned_to', assignedTo);
            formData.append('notify_users', notifyUsers.join(','));

            const dDate = new Date(deadline);
            const formattedDeadline = `${String(dDate.getDate()).padStart(2, '0')}-${String(dDate.getMonth() + 1).padStart(2, '0')}-${dDate.getFullYear()} 23:59`;
            formData.append('deadline', formattedDeadline);

            formData.append('description', description);
            formData.append('severity', severity);

            if (smartSuggestions) {
                if (smartSuggestions.dept_assigned) formData.append('suggested_dept', smartSuggestions.dept_assigned);
                if (smartSuggestions.issue_category) formData.append('suggested_issue', smartSuggestions.issue_category);
                if (smartSuggestions.activity_category) formData.append('suggested_act', smartSuggestions.activity_category);
            }

            if (attachment) formData.append('attachment', attachment);

            await createTicket(formData);
            alert("Ticket Raised Successfully!");

            setIssueCat(''); setActivityCat(''); setDescription(''); setAttachment(null); setFileName(''); setSeverity('Minor');
            setAssignedTo(''); setNotifyUsers([]);

            loadDashboardData();
            setActiveTab('history');
        } catch (err) {
            alert(err.response?.data?.error || "Failed to raise ticket");
        }
    };


    const getSolverDetails = (solverId) => {
        if (!solverId || String(solverId).toLowerCase() === 'nan' || solverId === 'Unassigned') return 'Unassigned';
        const targetStr = String(solverId).trim().toLowerCase();
        const solver = usersList.find(u =>
            String(u.employee_id).trim().toLowerCase() === targetStr ||
            String(u.email).trim().toLowerCase() === targetStr
        );
        if (solver) return `${solver.name} (${solver.phone_number || solver.phone || 'N/A'})`;
        return solverId;
    };

    const myRequests = [];
    const ticketGroups = {};

    // Group tickets by ID
    for (const t of tickets) {
        if (!t.escalation_level || t.escalation_level === 'L1') {
            if (String(t.raised_by) === String(user.employee_id) || String(t.original_raiser) === String(user.employee_id)) {
                if (!ticketGroups[t.ticket_id]) ticketGroups[t.ticket_id] = [];
                ticketGroups[t.ticket_id].push(t);
            }
        }
    }

    // Pick active row per ticket
    for (const tid in ticketGroups) {
        const group = ticketGroups[tid];
        const activeRows = group.filter(t => ['Open', 'In Progress', 'Resolved'].includes(t.status));

        if (activeRows.length > 0) {
            myRequests.push(activeRows[activeRows.length - 1]);
        } else {
            const l1Rows = group.filter(t => !t.escalation_level || t.escalation_level === 'L1');
            if (l1Rows.length > 0) {
                myRequests.push(l1Rows[l1Rows.length - 1]);
            } else {
                myRequests.push(group[group.length - 1]);
            }
        }
    }

    // Sort: Resolved tickets at the top (action required by raiser), then descending by ticket ID
    myRequests.sort((a, b) => {
        const aResolved = String(a.status || '').toLowerCase() === 'resolved' ? 1 : 0;
        const bResolved = String(b.status || '').toLowerCase() === 'resolved' ? 1 : 0;
        if (aResolved !== bResolved) return bResolved - aResolved;
        return Number(b.ticket_id) - Number(a.ticket_id);
    });

    const filteredRequests = myRequests.filter(t => {
        const q = searchQuery.toLowerCase();
        const assignedName = getSolverDetails(t.assigned_to) || '';
        const matchBasic = !searchQuery || (
            String(t.ticket_id).toLowerCase().includes(q) ||
            t.department?.toLowerCase().includes(q) ||
            t.dept_assigned?.toLowerCase().includes(q) ||
            t.issue_category?.toLowerCase().includes(q) ||
            t.activity_category?.toLowerCase().includes(q) ||
            t.location?.toLowerCase().includes(q) ||
            t.status?.toLowerCase().includes(q) ||
            assignedName.toLowerCase().includes(q)
        );

        if (!showAdvancedSearch) return matchBasic;

        const matchDept = !advDept || (t.dept_assigned && t.dept_assigned.toLowerCase().includes(advDept.toLowerCase()));
        const matchIssueCat = !advIssueCat || (t.issue_category && t.issue_category.toLowerCase() === advIssueCat.toLowerCase());
        const matchActivityCat = !advActivityCat || (t.activity_category && t.activity_category.toLowerCase() === advActivityCat.toLowerCase());
        const matchLocation = !advLocation || (t.location && t.location.toLowerCase() === advLocation.toLowerCase());
        const matchAssignedTo = !advAssignedTo || (assignedName.toLowerCase() === advAssignedTo.toLowerCase());
        const matchStatus = !advStatus || (t.status && t.status.toLowerCase() === advStatus.toLowerCase());
        const matchLevel = !advLevel || (t.escalation_level && t.escalation_level.toLowerCase() === advLevel.toLowerCase());

        const matchSeverity = !advSeverity || (t.severity && t.severity.toLowerCase() === advSeverity.toLowerCase());
        return matchBasic && matchDept && matchIssueCat && matchActivityCat && matchLocation && matchAssignedTo && matchStatus && matchLevel && matchSeverity;
    });

    const uniqueDepts = (Array.isArray(departments) && departments.length > 0) ? departments.map(d => d.department) : [...new Set((usersList || []).map(u => u.department).filter(Boolean))];
    const uniqueIssueCats = [...new Set((Array.isArray(issueCategoriesList) ? issueCategoriesList : []).map(i => i.issue_category).filter(Boolean))];
    const uniqueActivityCats = [...new Set((Array.isArray(activityCategoriesList) ? activityCategoriesList : []).map(a => a.activity_category).filter(Boolean))];
    const locationOptions = locations.map(l => l.location);
    const assignableUsers = usersList.filter(u => (!dept || (u.department || '').trim().toLowerCase() === (dept || '').trim().toLowerCase()) && String(u.role).toLowerCase() !== 'viewer' && String(u.employee_id) !== String(user.employee_id)).map(u => ({ label: getSolverDetails(u.employee_id), value: u.employee_id }));
    const notifiableUsers = usersList.map(u => u.email);
    const uniqueStatuses = [...new Set(myRequests.map(t => t.status).filter(Boolean))];

    const sidebarTabs = [
        { id: 'history', label: <><ClipboardList size={12} /> My Ticket History</> },
        { id: 'raise', label: <><PlusCircle size={12} /> Raise New Issue</> }
    ];

    // =========================================================================
    // GLOBAL KPI ENGINE (PINNED TO TOP OF ALL TABS)
    // =========================================================================
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
            const finishStr = ticket.solved_timestamp || ticket.closed_timestamp;
            if (finishStr && String(finishStr).toLowerCase() !== 'nan') {
                const finishDate = parseDateString(finishStr);
                if (finishDate) return finishDate > deadlineDate;
            }
            return ticket.SLA_Breach === true || ticket.SLA_Breach === 'True';
        }

        return getISTDate() > deadlineDate;
    };

    const requestorKPI = useMemo(() => {
        const filteredTickets = filteredRequests;

        const counts = {
            total: { count: 0, levels: {} },
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

        filteredTickets.forEach(t => {
            const stat = t.status ? t.status.toLowerCase() : '';
            const lvl = t.escalation_level || 'L1';

            increment('total', lvl);

            if (stat === 'open') increment('open', lvl);
            else if (stat === 'in progress') increment('inProgress', lvl);
            else if (stat === 'resolved') increment('resolved', lvl);
            else if (stat === 'closed') {
                if (t.closure_type === 'Declined') increment('declined', lvl);
                else if (t.closure_type === 'On Hold') increment('onHold', lvl);
                else increment('closed', lvl);
            }
            else if (stat === 'declined') increment('declined', lvl);
            else if (stat === 'on hold') increment('onHold', lvl);
            else if (stat === 'escalate' || stat === 'escalated') increment('escalated', lvl);

            if (isLate(t, slaBreachMode)) increment('late', lvl);
        });

        return counts;
    }, [filteredRequests, slaBreachMode]);

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

    const renderTicketTable = (ticketList) => (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div className="table-responsive" style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
                <table className="data-table ageing-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead>
                        <tr>
                            <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Ticket ID</th>
                            <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold' }}>Attach</th>
                            <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Department</th>
                            <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Issue Cat</th>
                            <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Activity Cat</th>
                            <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Description</th>
                            <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Location</th>
                            <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Assigned To</th>
                            <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Severity</th>
                            <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold' }}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ticketList.length === 0 ? (
                            <tr><td colSpan="10" className="text-center p-4 text-muted">No tickets found.</td></tr>
                        ) : (
                            ticketList.map(t => {
                                const isResolved = String(t.status || '').toLowerCase() === 'resolved';
                                return (
                                    <tr
                                        key={`${t.ticket_id}-${t.escalation_level || 'L1'}`}
                                        className="clickable"
                                        onClick={() => handleTicketClick(t)}
                                        style={{
                                            borderLeft: isResolved ? '4px solid #10b981' : (t.status !== 'Closed' ? '2px solid #ef4444' : '2px solid transparent'),
                                            backgroundColor: isResolved ? 'rgba(16, 185, 129, 0.04)' : undefined
                                        }}
                                    >
                                        <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }} className="font-bold">
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                                                <span style={{ color: (isLate(t) || t.SLA_Breach === 'True' || t.SLA_Breach === true) ? '#ef4444' : 'inherit' }}>#{t.ticket_id}</span>
                                                {t.original_raiser && t.raised_by === user.employee_id && <span style={{ color: '#f59e0b', fontSize: '8px', fontWeight: 'normal', backgroundColor: 'rgba(245,158,11,0.1)', padding: '2px 4px', borderRadius: '4px', whiteSpace: 'nowrap', display: 'inline-block' }}>L{t.escalation_level ? String(t.escalation_level).replace('L', '') : '1'} Sub-task</span>}
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                            <AttachmentBadge attachment={t.attachment} />
                                        </td>
                                        <td style={{ padding: '12px 8px' }}>{t.dept_assigned}</td>
                                        <td style={{ padding: '12px 8px' }}>{t.issue_category}</td>
                                        <td style={{ padding: '12px 8px' }}>{t.activity_category || '-'}</td>
                                        <td style={{ padding: '12px 8px', maxWidth: '200px', minWidth: '150px' }} title={t.description || ''}>
                                            <div style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.4', wordBreak: 'break-word', fontSize: '10.5px', color: '#a1a1aa' }}>
                                                {t.description || '-'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 8px' }}>{t.location}</td>
                                        <td style={{ padding: '12px 8px' }} className="text-primary">{getSolverDetails(t.assigned_to) || '-'}</td>
                                        <td style={{ padding: '12px 8px' }}>{t.severity || '-'}</td>
                                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                                <span style={{
                                                    backgroundColor: t.status === 'Escalated' ? 'rgba(239, 68, 68, 0.1)' : t.status === 'Closed' ? '#27272a' : t.status === 'Resolved' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.1)',
                                                    color: t.status === 'Escalated' ? '#ef4444' : t.status === 'Closed' ? '#a1a1aa' : t.status === 'Resolved' ? '#10b981' : '#60a5fa',
                                                    border: isResolved ? '1px solid rgba(16, 185, 129, 0.4)' : 'none',
                                                    padding: '3px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold'
                                                }}>{t.status}</span>
                                                {isResolved && (
                                                    <span style={{
                                                        fontSize: '8.5px',
                                                        fontWeight: '700',
                                                        color: '#f59e0b',
                                                        backgroundColor: 'rgba(245, 158, 11, 0.12)',
                                                        border: '1px solid rgba(245, 158, 11, 0.3)',
                                                        padding: '2px 5px',
                                                        borderRadius: '4px',
                                                        whiteSpace: 'nowrap',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '3px'
                                                    }}>
                                                        🔔 Action: Close/Reopen
                                                    </span>
                                                )}
                                                <SLACountdownBadge deadline={t.deadline} status={t.status} />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const handleTabChange = (newTab) => {
        setActiveTab(newTab);
        setSelectedTicket(null);
        setReassignTarget('');
    };

    return (
        <Layout user={user} setUser={setUser} sidebarTabs={sidebarTabs} activeTab={activeTab} setActiveTab={handleTabChange}>
            <div className="content-wrapper" style={{ paddingRight: selectedTicket && window.innerWidth > 768 ? '450px' : '0', transition: 'padding-right 0.9s cubic-bezier(0.4, 0, 0.2, 1)', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

                <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px', width: '100%' }}>
                        <h2 style={{ fontSize: '19px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            <Activity size={22} color="#3b82f6" /> My Dashboard
                        </h2>
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
                            {activeTab === 'history' && (
                                <button className="btn badge-primary p-2 text-xs flex-row gap-1" onClick={() => setShowAdvancedSearchModal(true)} style={{ whiteSpace: 'nowrap', borderRadius: '20px' }}>
                                    <Filter size={14} /> Advanced Search & Filter
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {error && <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '8px', borderRadius: '3px', marginBottom: '12px', fontSize: '10px' }}>{error}</div>}

                {/* --- GLOBAL KPI METRICS BOARD (COLLAPSIBLE) --- */}
                {showKPIs && (
                    <div className="kpi-grid">
                        <div className="card kpi-card kpi-blue" style={{ padding: '8px 4px', margin: 0, textAlign: 'center', borderTop: '2px solid #3b82f6', background: 'linear-gradient(180deg, rgba(59,130,246,0.25) 0%, rgba(59,130,246,0) 100%)' }}>
                            {renderTooltip(requestorKPI.total.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '9px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 2px 0' }}>Total</p>
                            <h2 style={{ fontSize: '17px', margin: 0, color: '#fff' }}>{requestorKPI.total.count}</h2>
                        </div>
                        <div className="card kpi-card kpi-amber" style={{ padding: '8px 4px', margin: 0, textAlign: 'center', borderTop: '2px solid #f59e0b', background: 'linear-gradient(180deg, rgba(245,158,11,0.25) 0%, rgba(245,158,11,0) 100%)' }}>
                            {renderTooltip(requestorKPI.open.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '9px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 2px 0' }}>Open</p>
                            <h2 style={{ fontSize: '17px', margin: 0, color: '#fff' }}>{requestorKPI.open.count}</h2>
                        </div>
                        <div className="card kpi-card kpi-purple" style={{ padding: '8px 4px', margin: 0, textAlign: 'center', borderTop: '2px solid #8b5cf6', background: 'linear-gradient(180deg, rgba(139,92,246,0.25) 0%, rgba(139,92,246,0) 100%)' }}>
                            {renderTooltip(requestorKPI.inProgress.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '9px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 2px 0' }}>In Progress</p>
                            <h2 style={{ fontSize: '17px', margin: 0, color: '#fff' }}>{requestorKPI.inProgress.count}</h2>
                        </div>
                        <div className="card kpi-card kpi-teal" style={{ padding: '8px 4px', margin: 0, textAlign: 'center', borderTop: '2px solid #14b8a6', background: 'linear-gradient(180deg, rgba(20,184,166,0.25) 0%, rgba(20,184,166,0) 100%)' }}>
                            {renderTooltip(requestorKPI.resolved.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '9px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 2px 0' }}>Resolved</p>
                            <h2 style={{ fontSize: '17px', margin: 0, color: '#fff' }}>{requestorKPI.resolved.count}</h2>
                        </div>
                        <div className="card kpi-card kpi-green" style={{ padding: '8px 4px', margin: 0, textAlign: 'center', borderTop: '2px solid #10b981', background: 'linear-gradient(180deg, rgba(16,185,129,0.25) 0%, rgba(16,185,129,0) 100%)' }}>
                            {renderTooltip(requestorKPI.closed.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '9px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 2px 0' }}>Closed</p>
                            <h2 style={{ fontSize: '17px', margin: 0, color: '#fff' }}>{requestorKPI.closed.count}</h2>
                        </div>
                        <div className="card kpi-card kpi-gray" style={{ padding: '8px 4px', margin: 0, textAlign: 'center', borderTop: '2px solid #6b7280', background: 'linear-gradient(180deg, rgba(107,114,128,0.25) 0%, rgba(107,114,128,0) 100%)' }}>
                            {renderTooltip(requestorKPI.declined.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '9px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 2px 0' }}>Declined</p>
                            <h2 style={{ fontSize: '17px', margin: 0, color: '#fff' }}>{requestorKPI.declined.count}</h2>
                        </div>
                        <div className="card kpi-card kpi-gray" style={{ padding: '8px 4px', margin: 0, textAlign: 'center', borderTop: '2px solid #3b82f6', background: 'linear-gradient(180deg, rgba(59,130,246,0.25) 0%, rgba(59,130,246,0) 100%)' }}>
                            {renderTooltip(requestorKPI.onHold.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '9px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 2px 0' }}>On Hold</p>
                            <h2 style={{ fontSize: '17px', margin: 0, color: '#fff' }}>{requestorKPI.onHold.count}</h2>
                        </div>
                        <div className="card kpi-card kpi-red" style={{ padding: '8px 4px', margin: 0, textAlign: 'center', borderTop: '2px solid #ef4444', background: 'linear-gradient(180deg, rgba(239,68,68,0.25) 0%, rgba(239,68,68,0) 100%)' }}>
                            {renderTooltip(requestorKPI.escalated.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '9px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 2px 0' }}>Escalate</p>
                            <h2 style={{ fontSize: '17px', margin: 0, color: '#fff' }}>{requestorKPI.escalated.count}</h2>
                        </div>
                        <div className="card kpi-card kpi-sla kpi-orange" style={{ padding: '8px 4px', margin: 0, textAlign: 'center', borderTop: '2px solid #F7941D', background: 'linear-gradient(180deg, rgba(247,148,29,0.25) 0%, rgba(247,148,29,0) 100%)' }}>
                            {renderTooltip(requestorKPI.late.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '9px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 2px 0' }}>
                                {slaBreachMode === 'all' ? 'All-Time SLA Breach' : 'Live SLA Breach'}
                            </p>
                            <h2 style={{ fontSize: '17px', margin: 0, color: '#fff' }}>{requestorKPI.late.count}</h2>
                        </div>
                    </div>
                )}

                {activeTab === 'raise' && !loading && (
                    <div className="card" style={{ padding: '8px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px', flexWrap: 'wrap' }}>
                            <h3 style={{ margin: 0, fontSize: '15px' }}>Raise a New Ticket</h3>
                            <span style={{ fontSize: '10px', color: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(59,130,246,0.25)', fontWeight: '500' }}>
                                💡 To use Smart assist add description first.
                            </span>
                        </div>
                        <form onSubmit={handleRaiseTicket} autoComplete="off">
                            {/* Defeat Chrome Autofill */}
                            <input autoComplete="false" name="hidden" type="text" style={{ display: 'none' }} />
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '6px' }}>
                                <div className="form-group form-group-sm" style={{ position: 'relative', zIndex: 100 }}><label className="form-label-sm">Department</label><SearchSelect className="dropdown-menu-solid" options={uniqueDepts} value={dept} onChange={(val) => { setDept(val); setAssignedTo(''); }} placeholder="Search Department..." /></div>
                                <div className="form-group form-group-sm" style={{ position: 'relative', zIndex: 90 }}><label className="form-label-sm">Issue Category</label><SearchSelect className="dropdown-menu-solid" options={uniqueIssueCats} value={issueCat} onChange={setIssueCat} placeholder="Search Issue..." /></div>
                                <div className="form-group form-group-sm" style={{ position: 'relative', zIndex: 80 }}><label className="form-label-sm">Activity Category</label><SearchSelect className="dropdown-menu-solid" options={uniqueActivityCats} value={activityCat} onChange={setActivityCat} placeholder="Search Activity..." /></div>
                                <div className="form-group form-group-sm" style={{ position: 'relative', zIndex: 75 }}><label className="form-label-sm">Severity</label><SearchSelect className="dropdown-menu-solid" options={['Major', 'Moderate', 'Minor', 'Urgent']} value={severity} onChange={setSeverity} placeholder="Select Severity..." /></div>


                                <div className="form-group form-group-sm" style={{ position: 'relative', zIndex: 70 }}><label className="form-label-sm">Location</label><SearchSelect className="dropdown-menu-solid" options={locationOptions} value={location} onChange={setLocation} placeholder="Search Location..." /></div>
                                <div className="form-group form-group-sm" style={{ position: 'relative', zIndex: 60 }}>
                                    <label className="form-label-sm">
                                        Assigned To (Solver)
                                        {smartSuggestions?.assigned_to && (
                                            <span style={{ color: smartSuggestions.solver_source === 'department_directory' ? '#3b82f6' : '#10b981', fontSize: '9px', fontWeight: 'normal', marginLeft: '6px' }}>
                                                {smartSuggestions.solver_source === 'department_directory' ? '🏢 Dept Default Solver' : '⚡ AI Learned Solver'}
                                            </span>
                                        )}
                                    </label>
                                    <SearchSelect className="dropdown-menu-solid" options={assignableUsers} value={assignedTo} onChange={(val) => { userTouchedSolverRef.current = true; setAssignedTo(val); }} placeholder="Select Solver..." usersList={usersList} />
                                </div>
                                <div className="form-group form-group-sm" style={{ position: 'relative', zIndex: 50 }}>
                                    <label className="form-label-sm">
                                        Deadline
                                        {smartSuggestions?.deadline_hours && (
                                            <span style={{ color: '#10b981', fontSize: '9px', fontWeight: 'normal', marginLeft: '6px' }}>⚡ AI Learned ({smartSuggestions.deadline_hours}h avg)</span>
                                        )}
                                    </label>
                                    <div
                                        style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', cursor: 'pointer' }}
                                        onClick={() => {
                                            const dateEl = document.getElementById('raiseTicketDeadlinePicker');
                                            if (dateEl && dateEl.showPicker) {
                                                try { dateEl.showPicker(); } catch (err) { }
                                            }
                                        }}
                                    >
                                        <input
                                            type="text"
                                            className="form-control form-control-sm"
                                            placeholder="dd/mm/yyyy"
                                            required
                                            readOnly
                                            style={{
                                                padding: '6px 36px 6px 10px',
                                                fontSize: '11px',
                                                width: '100%',
                                                cursor: 'pointer',
                                                backgroundColor: 'var(--bg-main, #18181b)'
                                            }}
                                            value={
                                                deadline
                                                    ? (() => {
                                                        const p = deadline.split('-');
                                                        return p.length === 3 && p[0].length === 4 ? `${p[2]}/${p[1]}/${p[0]}` : deadline;
                                                    })()
                                                    : ''
                                            }
                                        />
                                        <input
                                            id="raiseTicketDeadlinePicker"
                                            type="date"
                                            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
                                            value={deadline}
                                            onChange={(e) => {
                                                userTouchedDeadlineRef.current = true;
                                                const val = e.target.value;
                                                if (val) {
                                                    const minAllowed = getTomorrowDatetime();
                                                    if (minAllowed && new Date(val) < new Date(minAllowed)) {
                                                        alert("Deadline cannot be set to today or a past date.");
                                                        setDeadline(minAllowed);
                                                        return;
                                                    }
                                                }
                                                setDeadline(val);
                                            }}
                                            min={getTomorrowDatetime()}
                                        />
                                        <Calendar size={14} style={{ position: 'absolute', right: '10px', pointerEvents: 'none', color: '#a1a1aa', zIndex: 1 }} />
                                    </div>
                                </div>

                                <div className="form-group form-group-sm" style={{ position: 'relative', zIndex: 40 }}>
                                    <label className="form-label-sm">Notify Users (CC)</label>
                                    <MultiSearchSelect className="dropdown-menu-solid" options={notifiableUsers} selectedValues={notifyUsers} onChange={setNotifyUsers} placeholder="Search Emails..." />
                                </div>
                                <div className="form-group" style={{ marginBottom: '6px' }}>
                                    <label style={{ fontSize: '10px', marginBottom: '4px', display: 'block' }}>Attach File (Optional)</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ position: 'relative', width: '56px', height: '56px', flexShrink: 0 }}>
                                            {attachment ? (
                                                <div onClick={() => {
                                                    if (attachment.type?.startsWith('image/')) setEnlargedPreviewImage(URL.createObjectURL(attachment));
                                                    if (attachment.type === 'application/pdf' || attachment.name?.toLowerCase().endsWith('.pdf')) window.open(URL.createObjectURL(attachment), '_blank');
                                                }} style={{ position: 'absolute', inset: 0, borderRadius: '6px', overflow: 'hidden', border: '1px solid #10b981', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backgroundColor: (attachment.type === 'application/pdf' || attachment.name?.match(/\.(xlsx|xls|doc|docx)$/i)) ? 'rgba(16, 185, 129, 0.1)' : 'transparent' }}>
                                                    {attachment.type === 'application/pdf' ? (
                                                        <>
                                                            <FileText size={24} color="#10b981" />
                                                            <span style={{ fontSize: '8px', marginTop: '4px', color: '#10b981' }}>PDF Attached</span>
                                                        </>
                                                    ) : attachment.name?.match(/\.(xlsx|xls|doc|docx)$/i) ? (
                                                        <>
                                                            <FileText size={24} color="#10b981" />
                                                            <span style={{ fontSize: '8px', marginTop: '4px', color: '#10b981' }}>{attachment.name.match(/\.(xlsx|xls)$/i) ? 'Excel' : 'Word'} Attached</span>
                                                        </>
                                                    ) : (
                                                        <img src={URL.createObjectURL(attachment)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} title="Click to enlarge" />
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.preventDefault(); setAttachment(null); setFileName(''); }}
                                                        style={{ position: 'absolute', top: 0, right: 0, background: 'rgba(239, 68, 68, 0.9)', color: '#fff', border: 'none', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '10px', borderRadius: '0 0 0 6px', padding: 0 }}
                                                        title="Remove file"
                                                    >✕</button>
                                                </div>
                                            ) : (
                                                <div style={{ position: 'relative', width: '100%', height: '100%', border: '2px dashed #71717a', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.04)', transition: 'all 0.2s', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <input type="file" id="file-upload" style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 5, width: '100%', height: '100%' }} accept=".jpg,.jpeg,.png,.pdf,.xlsx,.xls,.doc,.docx,image/jpeg,image/png,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleFileChange} title="Click to attach file" />
                                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#a1a1aa', pointerEvents: 'none' }}>
                                                        <ImagePlus size={16} style={{ marginBottom: '2px' }} />
                                                        <span style={{ fontSize: '8px', textAlign: 'center', padding: '0 4px' }}>Add File</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            {isCompressing ? <span style={{ fontSize: '11px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={13} /> Optimizing file...</span> : fileName ? <span style={{ fontSize: '11px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}><CheckCircle2 size={13} /> {fileName}</span> : <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Auto-compressed (IMG) / 5MB (DOC)</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="form-group form-group-sm" style={{ position: 'relative', zIndex: 30, marginBottom: '6px' }}>
                                <label className="form-label-sm">Description of Issue</label>
                                <textarea className="form-control" required rows="3" style={{ fontSize: '11px', padding: '6px 10px', minHeight: '60px', maxHeight: '110px', height: 'auto', resize: 'none', overflowY: 'auto', lineHeight: '1.4', margin: 0 }} value={description} onChange={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; setDescription(e.target.value); }} placeholder="Please provide detailed information..."></textarea>

                                {description && description.trim().length >= 2 && (
                                    <div style={{ marginTop: '4px', padding: '8px', borderRadius: '8px', backgroundColor: 'var(--bg-card)', border: '1px solid #3b82f6', boxShadow: '0 4px 12px rgba(59,130,246,0.08)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#3b82f6', fontSize: '11px', fontWeight: 'bold' }}>
                                                <Zap size={14} /> Smart Assistance & AI Routing
                                            </div>
                                            {isSuggesting && <span style={{ fontSize: '10px', color: '#f59e0b', fontWeight: 'bold' }}>⚡ Analyzing description & matching master categories...</span>}
                                        </div>

                                        {smartSuggestions && (smartSuggestions.dept_assigned || smartSuggestions.issue_category || smartSuggestions.activity_category) ? (
                                            <div style={{ backgroundColor: 'rgba(59,130,246,0.08)', padding: '6px 8px', borderRadius: '6px', marginBottom: smartKbMatches.length > 0 ? '4px' : '0', border: '1px solid rgba(59,130,246,0.2)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: (smartSuggestions.assigned_to || smartSuggestions.deadline_hours) ? '4px' : '0' }}>
                                                    <div style={{ fontSize: '10.5px', color: 'var(--text-main)' }}>
                                                        💡 Suggested Routing: {[
                                                            smartSuggestions.dept_assigned && <strong key="dept">{smartSuggestions.dept_assigned}</strong>,
                                                            smartSuggestions.issue_category && <strong key="issue">{smartSuggestions.issue_category}</strong>,
                                                            smartSuggestions.activity_category && <strong key="act">{smartSuggestions.activity_category}</strong>
                                                        ].filter(Boolean).reduce((prev, curr) => [prev, ' → ', curr])}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="btn force-white-text"
                                                        onClick={() => {
                                                            if (smartSuggestions.dept_assigned) setDept(smartSuggestions.dept_assigned);
                                                            if (smartSuggestions.issue_category) setIssueCat(smartSuggestions.issue_category);
                                                            if (smartSuggestions.activity_category) setActivityCat(smartSuggestions.activity_category);
                                                            if (smartSuggestions.assigned_to) setAssignedTo(smartSuggestions.assigned_to);
                                                            if (smartSuggestions.deadline_hours) {
                                                                const targetDate = getISTDate();
                                                                targetDate.setHours(targetDate.getHours() + Math.round(smartSuggestions.deadline_hours));
                                                                const yyyy = targetDate.getFullYear();
                                                                const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
                                                                const dd = String(targetDate.getDate()).padStart(2, '0');
                                                                setDeadline(`${yyyy}-${mm}-${dd}`);
                                                            }
                                                        }}
                                                        style={{ backgroundColor: '#3b82f6', color: '#ffffff', padding: '4px 10px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                                                    >
                                                        ⚡ Auto-Fill Form
                                                    </button>
                                                </div>

                                                {(smartSuggestions.assigned_to || smartSuggestions.deadline_hours) && (
                                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '10px', paddingTop: '4px', borderTop: '1px solid rgba(59,130,246,0.15)' }}>
                                                        {smartSuggestions.assigned_to && (
                                                            <span
                                                                onClick={() => setAssignedTo(smartSuggestions.assigned_to)}
                                                                style={{
                                                                    cursor: 'pointer',
                                                                    backgroundColor: smartSuggestions.solver_source === 'department_directory' ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)',
                                                                    border: `1px solid ${smartSuggestions.solver_source === 'department_directory' ? '#3b82f6' : '#10b981'}`,
                                                                    color: smartSuggestions.solver_source === 'department_directory' ? '#3b82f6' : '#10b981',
                                                                    padding: '2px 8px', borderRadius: '4px', fontWeight: '500'
                                                                }}
                                                                title={smartSuggestions.solver_source === 'department_directory' ? 'Assigned to primary department solver (no past ticket history yet)' : 'Learned from past resolved ticket history'}
                                                            >
                                                                {smartSuggestions.solver_source === 'department_directory' ? '🏢 Dept Default Solver: ' : '🎯 AI Learned Solver: '}
                                                                {getSolverDetails(smartSuggestions.assigned_to)}
                                                            </span>
                                                        )}
                                                        {smartSuggestions.deadline_hours && (
                                                            <span
                                                                onClick={() => {
                                                                    const targetDate = getISTDate();
                                                                    targetDate.setHours(targetDate.getHours() + Math.round(smartSuggestions.deadline_hours));
                                                                    const yyyy = targetDate.getFullYear();
                                                                    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
                                                                    const dd = String(targetDate.getDate()).padStart(2, '0');
                                                                    setDeadline(`${yyyy}-${mm}-${dd}`);
                                                                }}
                                                                style={{ cursor: 'pointer', backgroundColor: 'rgba(139,92,246,0.15)', border: '1px solid #8b5cf6', color: '#8b5cf6', padding: '2px 8px', borderRadius: '4px', fontWeight: '500' }}
                                                                title="Click to apply suggested deadline"
                                                            >
                                                                ⏱ Avg Turnaround: {smartSuggestions.deadline_hours}h
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (!isSuggesting && (
                                            <div style={{ fontSize: '10px', color: description && description.trim().length >= 3 ? '#f59e0b' : 'var(--text-muted)', fontStyle: 'italic', padding: '4px 0' }}>
                                                {description && description.trim().length >= 3
                                                    ? "🤖 AI Assistance: Description is unrecognized or too vague. Please describe the specific issue (e.g., 'Power outage', 'Drawing missing', 'Material shortage') to get AI recommendations."
                                                    : "Type a detailed issue description to get AI category & solver recommendations..."}
                                            </div>
                                        ))}

                                        {smartKbMatches.length > 0 && (
                                            <div>
                                                <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#10b981', marginBottom: '6px' }}>
                                                    📖 Solved Knowledge Base Matches ({smartKbMatches.length})
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    {smartKbMatches.map((kb, idx) => (
                                                        <details key={idx} style={{ backgroundColor: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 8px', fontSize: '10px' }}>
                                                            <summary style={{ fontWeight: 'bold', cursor: 'pointer', color: '#60a5fa', outline: 'none' }}>
                                                                [{kb.ticket_id}] {kb.issue_category} - {kb.description.slice(0, 60)}...
                                                            </summary>
                                                            <div style={{ marginTop: '4px', padding: '4px 8px', backgroundColor: 'rgba(16, 185, 129, 0.08)', borderRadius: '4px', borderLeft: '3px solid #10b981' }}>
                                                                <strong>Known Resolution:</strong> {kb.resolution}
                                                            </div>
                                                        </details>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <button type="submit" className="btn btn-full" disabled={isCompressing} style={{ marginTop: '4px', fontSize: '10px', padding: '8px' }}>Submit Ticket</button>
                        </form>
                    </div>
                )}

                {activeTab === 'history' && !loading && (
                    <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0, flexDirection: 'column' }}>
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                            {renderTicketTable(filteredRequests)}
                        </div>
                    </div>
                )}

            </div>

            {selectedTicket && isSidePanelExpanded && (
                <div
                    className="blur-in"
                    style={{ position: 'fixed', inset: 0, zIndex: 1040 }}
                    onClick={() => setIsSidePanelExpanded(false)}
                />
            )}
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

                        <div style={{ padding: '24px 24px 0 24px', zIndex: 10, backgroundColor: 'var(--bg-card)', borderRadius: isSidePanelExpanded ? '12px 12px 0 0' : 0 }}>
                            <div className="side-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    #{selectedTicket.ticket_id}
                                    <span style={{ backgroundColor: selectedTicket.status === 'Closed' ? '#e4e4e7' : selectedTicket.status === 'Resolved' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)', color: selectedTicket.status === 'Closed' ? '#71717a' : selectedTicket.status === 'Resolved' ? '#10b981' : '#3b82f6', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold' }}>{selectedTicket.status}</span>
                                </h3>
                                <div className="side-panel-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                                        style={{ padding: '4px 8px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--text-main)', borderRadius: '4px', cursor: 'pointer', marginRight: '8px' }}
                                        title="Download Timeline (CSV)"
                                    >
                                        <Download size={12} /> Download Timeline
                                    </button>
                                    <button onClick={() => setIsSidePanelExpanded(!isSidePanelExpanded)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '18px', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={isSidePanelExpanded ? "Collapse" : "Expand"}>
                                        {isSidePanelExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                                    </button>
                                    <button onClick={() => { setSelectedTicket(null); setIsSidePanelExpanded(false); }} style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '16px', cursor: 'pointer', padding: '4px' }}>✕</button>
                                </div>
                            </div>

                            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                                <button onClick={() => setActiveDetailsTab('details')} style={{ flex: 1, padding: '10px 4px', fontSize: '13px', fontWeight: '600', backgroundColor: 'transparent', color: activeDetailsTab === 'details' ? '#3b82f6' : 'var(--text-main)', border: 'none', borderBottom: activeDetailsTab === 'details' ? '2px solid #3b82f6' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '-1px' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><FileText size={14} /> Details</div></button>
                                <button onClick={() => setActiveDetailsTab('timeline')} style={{ flex: 1, padding: '10px 4px', fontSize: '13px', fontWeight: '600', backgroundColor: 'transparent', color: activeDetailsTab === 'timeline' ? '#3b82f6' : 'var(--text-main)', border: 'none', borderBottom: activeDetailsTab === 'timeline' ? '2px solid #3b82f6' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '-1px' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Clock size={14} /> Timeline</div></button>
                                <button onClick={() => setActiveDetailsTab('chat')} style={{ flex: 1, padding: '10px 4px', fontSize: '13px', fontWeight: '600', backgroundColor: 'transparent', color: activeDetailsTab === 'chat' ? '#3b82f6' : 'var(--text-main)', border: 'none', borderBottom: activeDetailsTab === 'chat' ? '2px solid #3b82f6' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '-1px' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><MessageSquare size={14} /> Chat</div></button>
                            </div>
                        </div>

                        <div className="ticket-details-panel-body" style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', touchAction: 'pan-y', padding: '24px', zIndex: 10, display: 'flex', flexDirection: 'column' }}>

                            {activeDetailsTab === 'chat' && (
                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative', zIndex: 10, height: '100%' }}>
                                    <div className="chat-container frosted-chat-box" style={{ flex: 1, overflowY: 'auto', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid var(--border)' }}>
                                        {logsLoading ? (
                                            <p style={{ color: '#71717a', fontSize: '11px', textAlign: 'center' }}>Loading conversation...</p>
                                        ) : ticketLogs.filter(l => l.action === 'Chat' || l.action === 'Message').length === 0 ? (
                                            <p style={{ color: '#71717a', fontSize: '11px', textAlign: 'center' }}>No chat history available yet.</p>
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
                                    {selectedTicket.status !== 'Closed' && selectedTicket.status !== 'Declined' && selectedTicket.status !== 'On Hold' && (
                                        <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '8px', marginTop: '12px', position: 'relative', zIndex: 10 }}>
                                            <input type="text" className="form-control frosted-chat-box" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Type a message..." style={{ margin: 0, flex: 1, fontSize: '11px', padding: '6px 10px', color: 'var(--text-main)' }} />
                                            <button type="submit" className="btn" style={{ backgroundColor: '#10b981', fontSize: '11px', padding: '10px 16px', color: '#fefefe', border: 'none', borderRadius: '6px' }}>Send</button>
                                        </form>
                                    )}
                                </div>
                            )}

                            {activeDetailsTab === 'timeline' && (
                                <div style={{ paddingBottom: '20px', position: 'relative', zIndex: 10 }}>
                                    <div style={{ position: 'relative', borderLeft: '2px solid #3f3f46', paddingLeft: '20px', marginLeft: '10px' }}>
                                        {ticketLogs.map((log, i) => {
                                            let Icon = Activity;
                                            let iconColor = '#3b82f6';
                                            if (log.action.includes('Created')) { Icon = PlusCircle; iconColor = '#10b981'; }
                                            else if (log.action.includes('Escalated')) { Icon = ArrowUpRight; iconColor = '#ef4444'; }
                                            else if (log.action.includes('Status')) { Icon = RefreshCw; iconColor = '#f59e0b'; }
                                            else if (log.action === 'Chat' || log.action === 'Message') { Icon = MessageSquare; iconColor = '#a855f7'; }
                                            else if (log.action.includes('Resolved') || log.action.includes('Accepted') || log.action.includes('Closed')) { Icon = CheckCircle; iconColor = '#10b981'; }
                                            else if (log.action.includes('Handover') || log.action.includes('Assigned')) { Icon = UserPlus; iconColor = '#8b5cf6'; } let toName = "";
                                            let detailsText = String(log.details || log.remarks || "");
                                            if (log.action.includes('Created') && detailsText.includes('Assigned to')) {
                                                toName = detailsText.split('Assigned to')[1].trim();
                                            } else if (log.action.includes('Escalated') && detailsText.includes('Escalated to')) {
                                                toName = detailsText.split('Escalated to')[1].trim();
                                                toName = toName.split('(')[0].trim(); // remove department
                                            } else if (log.action.includes('Handover Requested') && detailsText.includes('transfer to')) {
                                                toName = detailsText.split('transfer to')[1].trim();
                                            } else if (log.action.includes('Handover Approved') && detailsText.includes('Assigned to')) {
                                                toName = detailsText.split('Assigned to')[1].trim();
                                            } else if (log.action.includes('Override') && detailsText.includes('Transferred to')) {
                                                toName = detailsText.split('Transferred to')[1].trim();
                                            }

                                            return (
                                                <CollapsibleTimelineNode key={i} log={log} iconColor={iconColor} Icon={Icon} toName={toName} onPreview={handlePreviewUrl} />
                                            );
                                        })}
                                        {ticketLogs.length === 0 && (
                                            <p style={{ color: '#71717a', fontSize: '11px' }}>No timeline events available.</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeDetailsTab === 'details' && (
                                <div style={{ paddingBottom: '40px' }}>
                                    <div className="ticket-info-grid" style={{ display: 'grid', gridTemplateColumns: isSidePanelExpanded ? 'repeat(4, 1fr)' : '1fr 1fr', gap: '14px', fontSize: '12px', color: '#71717a', marginBottom: '16px' }}>
                                        <div><strong style={{ color: 'var(--text-main)' }}>Raised On:</strong> <span style={{ color: '#a1a1aa' }}>{selectedTicket.timestamp?.split(' ')[0]}</span></div>
                                        {selectedTicket.deadline ? <div><strong style={{ color: 'var(--text-main)' }}>Deadline:</strong> <span style={{ color: '#10b981' }}>{selectedTicket.deadline?.split(' ')[0]}</span></div> : <div></div>}
                                        <div><strong style={{ color: 'var(--text-main)' }}>Current Raiser:</strong> <span style={{ color: '#3b82f6' }}>{selectedTicket.raiser_name || selectedTicket.raised_by}</span></div>
                                        <div><strong style={{ color: 'var(--text-main)' }}>Raiser Desig:</strong> <span style={{ color: '#a1a1aa' }}>{usersList.find(u => u.employee_id === selectedTicket.raised_by || u.email === selectedTicket.raised_by)?.designation || '-'}</span></div>
                                        <div><strong style={{ color: 'var(--text-main)' }}>Assigned To:</strong> <span style={{ color: '#3b82f6' }}>{getSolverDetails(selectedTicket.assigned_to)}</span></div>
                                        <div><strong style={{ color: 'var(--text-main)' }}>Solver Desig:</strong> <span style={{ color: '#a1a1aa' }}>{usersList.find(u => String(u.employee_id) === String(selectedTicket.assigned_to) || String(u.email) === String(selectedTicket.assigned_to))?.designation || '-'}</span></div>
                                        <div style={{ gridColumn: '1 / -1' }}><strong style={{ color: 'var(--text-main)' }}>Location:</strong> <span style={{ color: '#a1a1aa' }}>{selectedTicket.location}</span></div>
                                        {selectedTicket.original_raiser && String(selectedTicket.original_raiser).toLowerCase() !== 'nan' && selectedTicket.original_raiser !== selectedTicket.raised_by && (
                                            <div><strong style={{ color: 'var(--text-main)' }}>Original Raiser:</strong> <span style={{ color: '#3b82f6' }}>{selectedTicket.original_raiser_name || selectedTicket.original_raiser}</span></div>
                                        )}
                                        {selectedTicket.parent_ticket_id && String(selectedTicket.parent_ticket_id).toLowerCase() !== 'nan' && <div><strong style={{ color: 'var(--text-main)' }}>Escalated From:</strong> <span style={{ color: '#ef4444' }}>#{selectedTicket.parent_ticket_id}</span></div>}
                                        {selectedTicket.solved_timestamp && String(selectedTicket.solved_timestamp).toLowerCase() !== 'nan' && selectedTicket.status !== 'Closed' && <div><strong style={{ color: 'var(--text-main)' }}>Resolved On:</strong> <span style={{ color: '#3b82f6' }}>{selectedTicket.solved_timestamp?.split(' ')[0]}</span></div>}
                                        {selectedTicket.closed_timestamp && String(selectedTicket.closed_timestamp).toLowerCase() !== 'nan' && selectedTicket.status === 'Closed' && <div><strong style={{ color: 'var(--text-main)' }}>Closed On:</strong> <span style={{ color: '#10b981' }}>{selectedTicket.closed_timestamp?.split(' ')[0]}</span></div>}
                                    </div>
                                    <div className="ticket-desc-attachment-row" style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '20px', position: 'relative', zIndex: 10 }}>
                                        <div className="detail-box" style={{ flex: 1, minWidth: 0, fontSize: '12px', padding: '14px', borderRadius: '6px', lineHeight: '1.6', backgroundColor: 'var(--bg-main)', height: selectedTicket.attachment && String(selectedTicket.attachment).toLowerCase() !== 'nan' ? '142px' : 'auto', maxHeight: '142px', overflowY: 'auto' }}>
                                            <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '8px', fontSize: '13px' }}>Issue Description:</strong>
                                            <span style={{ color: '#a1a1aa', whiteSpace: 'pre-wrap', display: 'block', wordBreak: 'break-word' }}>
                                                {selectedTicket.description}
                                            </span>
                                        </div>
                                        {selectedTicket.attachment && String(selectedTicket.attachment).toLowerCase() !== 'nan' && (
                                            <div style={{ flexShrink: 0, minWidth: '130px', maxWidth: '200px' }}>
                                                <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '8px', fontSize: '12px' }}>Attached File:</strong>
                                                {(() => {
                                                    const attachStr = String(selectedTicket.attachment);
                                                    const isImage = attachStr.match(/\.(jpeg|jpg|gif|png|webp)$/i);
                                                    const isPdf = attachStr.toLowerCase().endsWith('.pdf');
                                                    const fileUrl = attachStr.startsWith('data:') || attachStr.startsWith('http') ? attachStr : `/uploads/${attachStr}`;
                                                    if (isImage) {
                                                        return (
                                                            <div
                                                                style={{ width: '112px', height: '112px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #3f3f46', cursor: 'pointer', position: 'relative', transition: 'transform 0.2s', backgroundColor: '#000' }}
                                                                onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
                                                                onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                                                                onClick={() => setEnlargedPreviewImage(fileUrl)}
                                                            >
                                                                <img src={fileUrl} alt="Attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px', backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '8px', textAlign: 'center' }}>Click to enlarge</div>
                                                            </div>
                                                        );
                                                    }
                                                    if (isPdf) {
                                                        return (
                                                            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-filter" style={{ display: 'inline-block', fontSize: '10px', padding: '6px 10px', textDecoration: 'none', color: '#ef4444', fontWeight: 'bold', wordBreak: 'break-word' }} title={`Open ${attachStr} in new tab`}>
                                                                📄 {attachStr}
                                                            </a>
                                                        );
                                                    }
                                                    return (
                                                        <a href={fileUrl} download={attachStr} target="_blank" rel="noopener noreferrer" className="btn btn-filter" style={{ display: 'inline-block', fontSize: '10px', padding: '6px 10px', textDecoration: 'none', color: '#2563eb', fontWeight: 'bold', wordBreak: 'break-word' }} title={`Download ${attachStr}`}>
                                                            ⬇ {attachStr}
                                                        </a>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>



                                    {/* ACTION FORMS INSIDE SCROLL CONTAINER */}
                                    {(!selectedTicket.assigned_to || String(selectedTicket.assigned_to).toLowerCase() === 'nan' || selectedTicket.assigned_to === 'Unassigned') && selectedTicket.status !== 'Closed' && selectedTicket.status !== 'Resolved' && selectedTicket.status !== 'On Hold' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px', marginTop: '20px', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.05)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <UserPlus size={16} color="#60a5fa" />
                                                </div>
                                                <div>
                                                    <h4 style={{ margin: 0, fontSize: '13px', color: '#e2e8f0', fontWeight: '500' }}>Assign Solver</h4>
                                                    <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>Ticket is currently unassigned</p>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1.5 }}>
                                                <select
                                                    className="form-control"
                                                    style={{ flex: 1, fontSize: '12px', padding: '0 12px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', margin: 0, height: '32px' }}
                                                    onChange={(e) => setReassignTarget(e.target.value)}
                                                    value={reassignTarget}
                                                >
                                                    <option value="">Select Solver...</option>
                                                    {usersList.filter(u => u.department === (selectedTicket.department || selectedTicket.dept_assigned) && String(u.role).toLowerCase() !== 'viewer' && String(u.employee_id) !== String(selectedTicket.original_raiser || selectedTicket.raised_by)).map(u => (
                                                        <option key={u.email} value={u.email}>{u.name} ({u.employee_id})</option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={handleDirectReassign}
                                                    disabled={!reassignTarget || reassignTarget === selectedTicket.assigned_to}
                                                    className="btn btn-full"
                                                    style={{ fontSize: '12px', padding: '0 16px', borderRadius: '6px', whiteSpace: 'nowrap', margin: 0, height: '32px', display: 'flex', alignItems: 'center' }}
                                                >
                                                    Assign
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {selectedTicket.status === 'Resolved' && (
                                        <div className="card" style={{ padding: '16px', marginTop: '20px', position: 'relative', zIndex: 10, backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#10b981' }}>Resolution Review Required</h4>

                                            <form onSubmit={handleAcceptSubmit}>
                                                <div className="ticket-update-form-row" style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '16px' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <label style={{ fontSize: '10px', color: '#a1a1aa', marginBottom: '4px', display: 'block' }}>Remarks (Mandatory for Acceptance)</label>
                                                        <textarea
                                                            className="form-control"
                                                            required
                                                            value={acceptRemarks}
                                                            onChange={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; setAcceptRemarks(e.target.value); }}
                                                            placeholder="Enter remarks to accept the resolution..."
                                                            style={{ width: '100%', fontSize: '11px', padding: '6px 10px', minHeight: '28px', maxHeight: '48px', height: 'auto', margin: 0, resize: 'none', overflowY: 'auto' }}
                                                        />
                                                    </div>
                                                    <div style={{ flex: '0 0 80px' }}>
                                                        <label style={{ fontSize: '10px', color: '#a1a1aa', marginBottom: '4px', display: 'block' }}>File (Optional)</label>
                                                        <div style={{ position: 'relative', width: '80px', height: '36px' }}>
                                                            {acceptAttachment ? (
                                                                <div style={{ position: 'absolute', inset: 0, borderRadius: '6px', overflow: 'hidden', border: '1px solid #10b981' }}>
                                                                    {acceptAttachment.type === 'application/pdf' ? (
                                                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0fdf4' }}><FileText size={16} color="#10b981" /></div>
                                                                    ) : acceptAttachment.name?.match(/\.(xlsx|xls|doc|docx)$/i) ? (
                                                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0fdf4' }}><FileText size={16} color="#10b981" /></div>
                                                                    ) : (
                                                                        <img src={URL.createObjectURL(acceptAttachment)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }} onClick={() => setEnlargedPreviewImage(URL.createObjectURL(acceptAttachment))} title="Click to enlarge" />
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => { e.preventDefault(); setAcceptAttachment(null); }}
                                                                        style={{ position: 'absolute', top: 0, right: 0, background: 'rgba(239, 68, 68, 0.9)', color: '#fff', border: 'none', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '8px', borderRadius: '0 0 0 4px', padding: 0 }}
                                                                    >✕</button>
                                                                </div>
                                                            ) : (
                                                                <div style={{ position: 'relative', width: '100%', height: '100%', border: '2px dashed #71717a', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.04)', transition: 'all 0.2s', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                    <input type="file" accept=".jpg,.jpeg,.png,.pdf,.xlsx,.xls,.doc,.docx,image/jpeg,image/png,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 5, width: '100%', height: '100%' }} onChange={(e) => {
                                                                        const file = e.target.files[0];
                                                                        if (file) {
                                                                            if (file.type === 'application/pdf' || file.name.match(/\.(xlsx|xls|doc|docx|pdf)$/i)) {
                                                                                if (file.size > 5 * 1024 * 1024) return alert('Document file must be under 5MB.');
                                                                            }
                                                                            setAcceptAttachment(file);
                                                                            if (file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')) {
                                                                                window.open(URL.createObjectURL(file), '_blank');
                                                                            }
                                                                        }
                                                                    }} title="Click to attach file" />
                                                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#a1a1aa', pointerEvents: 'none' }}>
                                                                        <ImagePlus size={14} />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', gap: '12px' }}>
                                                    <button type="submit" className="btn btn-accept-close" style={{ fontSize: '11px', padding: '8px 16px', flex: 1, borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Accept & Close Ticket</button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const reason = window.prompt("Enter reason for rejecting the resolution & reopening ticket:");
                                                            if (reason === null) return;
                                                            if (!reason.trim()) {
                                                                alert("Rejection reason is required to reopen the ticket.");
                                                                return;
                                                            }
                                                            handleStatusAction('Reopened', reason.trim());
                                                        }}
                                                        className="btn btn-reject-reopen"
                                                        style={{ fontSize: '11px', padding: '8px 16px', flex: 1, borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                                                    >
                                                        Reject & Reopen
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    )}

                                    {(selectedTicket.status === 'Declined' || selectedTicket.status === 'On Hold') && (
                                        <div className="card" style={{ padding: '16px', marginTop: '20px', position: 'relative', zIndex: 10, backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#ef4444' }}>Ticket {selectedTicket.status} by Solver</h4>
                                            <p style={{ fontSize: '11px', color: '#a1a1aa', margin: 0 }}>The assigned solver has {selectedTicket.status === 'Declined' ? 'declined' : 'put on hold'} this ticket. If you wish to reassign this issue, please create a new ticket.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <style>{`
                        .skyline-layer {
                            position: absolute; bottom: 0; left: 0; right: 0;
                            display: flex; overflow: hidden; height: 160px; pointer-events: none;
                        }
                        .skyline-status-mode { z-index: 1; }
                        .skyline-chat-mode { z-index: 0; }
                        
                        .skyline-bg { fill: #334155; }
                        .skyline-mg { fill: #1e293b; }
                        .skyline-fg { fill: #0f172a; }
                        .window-dim { fill: rgba(255,255,255,0.06); }
                        .window-lit { fill: #fde047; transition: fill 1.5s ease; }
                        
                        .glow-stop-top { stop-color: #fde047; stop-opacity: 0; transition: all 1.5s ease; }
                        .glow-stop-base { stop-color: #fde047; stop-opacity: 0.25; transition: all 1.5s ease; }
                        
                        .frosted-chat-box {
                            background-color: rgba(30, 41, 59, 0.7) !important;
                            backdrop-filter: blur(8px) !important;
                            -webkit-backdrop-filter: blur(8px) !important;
                        }
                        
                        body.light-mode .skyline-bg { fill: #e2e8f0; }
                        body.light-mode .skyline-mg { fill: #cbd5e1; }
                        body.light-mode .skyline-fg { fill: #94a3b8; }
                        body.light-mode .window-dim { fill: rgba(255,255,255,0.3); }
                        body.light-mode .window-lit { fill: rgba(255,255,255,0.6); }
                        
                        body.light-mode .glow-stop-top { stop-color: #ffffff; stop-opacity: 0; }
                        body.light-mode .glow-stop-base { stop-color: #ffffff; stop-opacity: 0.6; }
                        
                        body.light-mode .frosted-chat-box {
                            background-color: rgba(255, 255, 255, 0.6) !important;
                        }
                        
                        .btn.btn-accept-close, body.light-mode .btn.btn-accept-close {
                            background-color: #10b981 !important;
                            color: #fefefe !important;
                            border: none !important;
                        }
                        
                        .btn.btn-reject-reopen, body.light-mode .btn.btn-reject-reopen {
                            background-color: #ef4444 !important;
                            color: #fefefe !important;
                            border: none !important;
                        }
                    `}</style>

                        {/* DYNAMIC CITYSCAPE LANDSCAPE FOR DETAILS PANE */}
                        <div className={"skyline-layer " + (activeDetailsTab === 'chat' ? "skyline-chat-mode" : "skyline-status-mode")}>
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
            {enlargedPreviewImage && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 10000, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }} onClick={() => setEnlargedPreviewImage(null)}>
                    <img src={enlargedPreviewImage} alt="Enlarged" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', borderRadius: '8px', border: '2px solid rgba(255,255,255,0.1)' }} />
                </div>
            )}

            {(previewFile || previewUrl) && (
                <DocumentPreview
                    file={previewFile}
                    url={previewUrl}
                    onClose={() => { setPreviewFile(null); setPreviewUrl(null); }}
                />
            )}

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
                                <input type="text" className="form-control" style={{ fontSize: '12px', padding: '8px' }} placeholder="Filter by ID, Desc, Status..." value={tempFilters.search} onChange={e => setTempFilters({ ...tempFilters, search: e.target.value })} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Department</label>
                                    <select className="form-control" style={{ fontSize: '12px', padding: '8px' }} value={tempFilters.dept} onChange={e => setTempFilters({ ...tempFilters, dept: e.target.value })}>
                                        <option value="">All Depts</option>
                                        {[...new Set(myRequests.map(a => a.dept_assigned).filter(Boolean))].sort().map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Location</label>
                                    <select className="form-control" style={{ fontSize: '12px', padding: '8px' }} value={tempFilters.location} onChange={e => setTempFilters({ ...tempFilters, location: e.target.value })}>
                                        <option value="">All Locations</option>
                                        {[...new Set(myRequests.map(a => a.location).filter(Boolean))].sort().map(l => <option key={l} value={l}>{l}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Issue Category</label>
                                    <select className="form-control" style={{ fontSize: '12px', padding: '8px' }} value={tempFilters.issueCat} onChange={e => setTempFilters({ ...tempFilters, issueCat: e.target.value })}>
                                        <option value="">All Issue Cats</option>
                                        {[...new Set(myRequests.map(a => a.issue_category).filter(Boolean))].sort().map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Activity Category</label>
                                    <select className="form-control" style={{ fontSize: '12px', padding: '8px' }} value={tempFilters.activityCat} onChange={e => setTempFilters({ ...tempFilters, activityCat: e.target.value })}>
                                        <option value="">All Activity Cats</option>
                                        {[...new Set(myRequests.map(a => a.activity_category).filter(Boolean))].sort().map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Assigned To</label>
                                    <select className="form-control" style={{ fontSize: '12px', padding: '8px' }} value={tempFilters.assignedTo} onChange={e => setTempFilters({ ...tempFilters, assignedTo: e.target.value })}>
                                        <option value="">All Assignees</option>
                                        {[...new Set(myRequests.map(a => a.assigned_to).filter(Boolean))].sort().map(u => <option key={u} value={u}>{getSolverDetails(u)}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Status</label>
                                    <select className="form-control" style={{ fontSize: '12px', padding: '8px' }} value={tempFilters.status} onChange={e => setTempFilters({ ...tempFilters, status: e.target.value })}>
                                        <option value="">All Statuses</option>
                                        {[...new Set(myRequests.map(a => a.status).filter(Boolean))].sort().map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Severity</label>
                                    <select className="form-control" style={{ fontSize: '12px', padding: '8px' }} value={tempFilters.severity} onChange={e => setTempFilters({ ...tempFilters, severity: e.target.value })}>
                                        <option value="">All Severities</option>
                                        {[...new Set(myRequests.map(a => a.severity).filter(Boolean))].sort().map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                                <button className="btn badge-primary" style={{ flex: 1, justifyContent: 'center', padding: '10px' }} onClick={() => {
                                    setSearchQuery(tempFilters.search);
                                    setAdvDept(tempFilters.dept);
                                    setAdvLocation(tempFilters.location);
                                    setAdvIssueCat(tempFilters.issueCat);
                                    setAdvActivityCat(tempFilters.activityCat);
                                    setAdvAssignedTo(tempFilters.assignedTo);
                                    setAdvStatus(tempFilters.status);
                                    setAdvSeverity(tempFilters.severity);
                                    setShowAdvancedSearchModal(false);
                                }}>Apply Filters</button>
                                <button className="btn badge-danger" style={{ flex: 1, justifyContent: 'center', padding: '10px' }} onClick={() => {
                                    const empty = { search: '', dept: '', location: '', issueCat: '', activityCat: '', assignedTo: '', status: '', severity: '' };
                                    setTempFilters(empty);
                                    setSearchQuery('');
                                    setAdvDept('');
                                    setAdvLocation('');
                                    setAdvIssueCat('');
                                    setAdvActivityCat('');
                                    setAdvAssignedTo('');
                                    setAdvStatus('');
                                    setAdvSeverity('');
                                    setShowAdvancedSearchModal(false);
                                }}>Clear & Reset</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default RequestorDashboard;