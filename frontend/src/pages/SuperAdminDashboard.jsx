import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api, {
    fetchUsers, createUser, updateUser,
    fetchLocations, createLocation, updateLocation, deleteLocation,
    fetchProjects, createProject, updateProject, deleteProject,
    fetchDepartments, createDepartment, updateDepartment, deleteDepartment,
    fetchIssueCategories, fetchActivityCategories, createIssueCategory, createActivityCategory, updateIssueCategory, updateActivityCategory, deleteIssueCategory, deleteActivityCategory,
    fetchTickets, deleteTickets, approveHandover, adminReassignTicket, resetUserPassword, toggleUserActive, fetchSystemLogs, uploadImportFile, getImportTemplateUrl,
    fetchCannedResponses, createCannedResponse, updateCannedResponse, deleteCannedResponse
} from '../api';
import Layout from '../components/Layout';
import DocumentPreview from '../components/DocumentPreview';
import AttachmentBadge from '../components/AttachmentBadge';
import SLACountdownBadge from '../components/SLACountdownBadge';
import SLABreachModeToggle from '../components/SLABreachModeToggle';
import { exportExecutivePDF, exportExecutiveCSV } from '../utils/exportExecutiveReports';
import { parseDateToTimestamp, parseDateString, getISTDate } from '../utils/dateUtils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import AdminAnalytics from '../components/AdminAnalytics';
import { Download, AlertTriangle, Settings, TrendingUp, Clock, Users, MapPin, Cog, CheckCircle2, ClipboardCheck, Zap, ChevronDown, ChevronUp, PlusCircle, ArrowUpRight, RefreshCw, CheckCircle, UserPlus, UserCheck, Activity, FileText, Maximize2, Minimize2, MessageSquare, Filter, Pencil, Key, Power, Trash2, ArrowUp, ArrowDown, X, Calendar, Search } from 'lucide-react';

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


const SearchableDropdown = ({ options, value, onChange, placeholder, disabled, placement = 'bottom' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const normalizedOptions = options.map(opt => typeof opt === 'string' ? { value: opt, label: opt } : opt);

    const filteredOptions = normalizedOptions
        .filter(opt => opt.label.toLowerCase().includes(searchTerm.toLowerCase()));

    const displayValue = normalizedOptions.find(opt => opt.value === value)?.label || value;

    const isTop = placement === 'top';

    return (
        <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    backgroundColor: disabled ? 'rgba(0,0,0,0.1)' : 'var(--bg-main)', border: '1px solid var(--border)',
                    borderRadius: '4px', padding: '8px', fontSize: '11px', cursor: disabled ? 'not-allowed' : 'pointer',
                    color: value ? 'var(--text-main)' : 'var(--text-muted)'
                }}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayValue || placeholder}</span>
                <ChevronDown size={12} style={{ flexShrink: 0, transform: isOpen && isTop ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>

            {isOpen && !disabled && (
                <div style={{
                    position: 'absolute',
                    ...(isTop ? { bottom: '100%', marginBottom: '4px' } : { top: '100%', marginTop: '4px' }),
                    left: 0, right: 0, zIndex: 1000,
                    backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: '4px', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.4)',
                    maxHeight: '220px', display: 'flex', flexDirection: 'column'
                }}>
                    <div style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>
                        <input
                            type="text"
                            autoFocus
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%', padding: '6px', fontSize: '11px',
                                backgroundColor: 'var(--bg-main)', border: '1px solid var(--border)',
                                borderRadius: '4px', color: 'var(--text-main)', boxSizing: 'border-box'
                            }}
                        />
                    </div>
                    <div style={{ overflowY: 'auto', padding: '4px', maxHeight: '160px' }}>
                        {filteredOptions.length === 0 ? (
                            <div style={{ padding: '8px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>No results found</div>
                        ) : (
                            filteredOptions.map((opt, i) => (
                                <div
                                    key={i}
                                    onClick={() => {
                                        onChange(opt.value);
                                        setIsOpen(false);
                                        setSearchTerm('');
                                    }}
                                    style={{
                                        padding: '8px', fontSize: '11px', cursor: 'pointer',
                                        borderRadius: '4px', color: 'var(--text-main)',
                                        backgroundColor: value === opt.value ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                    }}
                                    onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(59, 130, 246, 0.15)'}
                                    onMouseLeave={(e) => e.target.style.backgroundColor = value === opt.value ? 'rgba(59, 130, 246, 0.15)' : 'transparent'}
                                >
                                    {opt.label}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const SuperAdminDashboard = ({ user, setUser }) => {
    const navigate = useNavigate();
    const location = useLocation();
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

    const [usersList, setUsersList] = useState([]);
    const [locationsList, setLocationsList] = useState([]);
    const [departmentsList, setDepartmentsList] = useState([]);
    const [issueCategoriesList, setIssueCategoriesList] = useState([]);
    const [activityCategoriesList, setActivityCategoriesList] = useState([]);
    const [projectsList, setProjectsList] = useState([]);
    const [masterControlTab, setMasterControlTab] = useState('users');
    const [cannedResponsesList, setCannedResponsesList] = useState([]);
    const [cannedSearchQuery, setCannedSearchQuery] = useState('');
    const [isCannedModalOpen, setIsCannedModalOpen] = useState(false);
    const [cannedModalMode, setCannedModalMode] = useState('add');
    const [cannedFormData, setCannedFormData] = useState({ id: null, label: '', text: '', created_by: '' });
    const [cannedSortField, setCannedSortField] = useState('id');
    const [cannedSortOrder, setCannedSortOrder] = useState('asc');

    const selectingTicketFromUrlRef = useRef(false);

    // Auto-close ticket details pane when changing tabs (except when navigating to a ticket from URL)
    useEffect(() => {
        if (selectingTicketFromUrlRef.current) {
            selectingTicketFromUrlRef.current = false;
            return;
        }
        setSelectedTicket(null);
        setIsSidePanelExpanded(false);
    }, [activeTab, masterControlTab]);

    const handleCannedSortClick = (field) => {
        if (cannedSortField === field) {
            setCannedSortOrder(cannedSortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setCannedSortField(field);
            setCannedSortOrder('asc');
        }
    };

    const ownerOptions = useMemo(() => {
        const userOpts = usersList
            .map(u => {
                const val = u.name || u.email || u.employee_id;
                const label = u.name ? `${u.name} (${u.department || u.role || u.email})` : (u.email || u.employee_id);
                return { value: val, label: label };
            })
            .filter(opt => opt.value)
            .sort((a, b) => a.label.localeCompare(b.label));

        return [
            { value: 'System Default', label: 'System Default / Global' },
            ...userOpts
        ];
    }, [usersList]);

    // --- MASTER CONTROL SELECTION STATE ---
    const [selectedMasterLocations, setSelectedMasterLocations] = useState([]);
    const [selectedMasterDepartments, setSelectedMasterDepartments] = useState([]);
    const [selectedMasterIssues, setSelectedMasterIssues] = useState([]);
    const [selectedMasterActivities, setSelectedMasterActivities] = useState([]);

    // --- DEPT UI STATE ---
    const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
    const [deptModalMode, setDeptModalMode] = useState('add');
    const [deptFormData, setDeptFormData] = useState({ department: '' });

    // --- ISSUE UI STATE ---
    const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
    const [issueModalMode, setIssueModalMode] = useState('add');
    const [issueFormData, setIssueFormData] = useState({ 'Issue Category': '', 'Activity Category': '' });
    const [categoryModalType, setCategoryModalType] = useState('both');

    const [ticketsList, setTicketsList] = useState([]);

    // --- AGEING REPORT STATE ---
    const [ageingData, setAgeingData] = useState([]);
    const [ageingSearch, setAgeingSearch] = useState('');
    const [ageingSearchConstraint, setAgeingSearchConstraint] = useState('all');
    const [isAgeingExpanded, setIsAgeingExpanded] = useState(false);
    const [showAdvancedAgeing, setShowAdvancedAgeing] = useState(false);
    const [advAgeingDept, setAdvAgeingDept] = useState('');
    const [advAgeingStatus, setAdvAgeingStatus] = useState('');
    const [advAgeingLevel, setAdvAgeingLevel] = useState('');
    const [advAgeingSeverity, setAdvAgeingSeverity] = useState('');
    const [showAdvancedSearchModal, setShowAdvancedSearchModal] = useState(false);
    const [tempFilters, setTempFilters] = useState({ search: '', dept: '', status: '', location: '', issueCat: '', level: '', severity: '' });
    const [advAgeingLocation, setAdvAgeingLocation] = useState('');
    const [advAgeingIssueCat, setAdvAgeingIssueCat] = useState('');
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [selectedAgeingTickets, setSelectedAgeingTickets] = useState([]);
    const [isSidePanelExpanded, setIsSidePanelExpanded] = useState(false);
    const [ticketLogs, setTicketLogs] = useState([]);
    const [systemLogs, setSystemLogs] = useState([]);
    const [systemLogSearch, setSystemLogSearch] = useState('');
    const [systemLogActorFilter, setSystemLogActorFilter] = useState('');
    const [systemLogActionFilter, setSystemLogActionFilter] = useState('');
    const [systemLogStartDate, setSystemLogStartDate] = useState('');
    const [systemLogEndDate, setSystemLogEndDate] = useState('');
    const [logSortField, setLogSortField] = useState('timestamp');
    const [logSortOrder, setLogSortOrder] = useState('desc');
    const [activeDetailsTab, setActiveDetailsTab] = useState('details');

    // --- FORCE REASSIGN MODAL STATE ---
    const [isForceReassignModalOpen, setIsForceReassignModalOpen] = useState(false);
    const [reassignTicketObj, setReassignTicketObj] = useState(null);
    const [reassignDept, setReassignDept] = useState('');
    const [reassignTarget, setReassignTarget] = useState('');
    const [reassignReason, setReassignReason] = useState('');

    const openForceReassignModal = (ticket) => {
        if (!ticket) return;
        const currentStatus = String(ticket.status || '').trim();
        if (!['Open', 'In Progress'].includes(currentStatus)) {
            alert(`Force reassign is only possible for tickets marked Open or In Progress.\nTicket #${ticket.ticket_id} is currently ${ticket.status}.`);
            return;
        }
        setReassignTicketObj(ticket);
        setReassignDept(ticket?.dept_assigned || ticket?.department || '');
        setReassignTarget('');
        setReassignReason('');
        setIsForceReassignModalOpen(true);
    };

    const restrictedReassignUserIdentifiers = useMemo(() => {
        if (!reassignTicketObj || !reassignTicketObj.ticket_id) return new Set();
        const restricted = new Set();
        const relatedTickets = (ticketsList || []).filter(t => String(t.ticket_id) === String(reassignTicketObj.ticket_id));
        const rawList = [];
        relatedTickets.forEach(t => {
            if (t.raised_by) rawList.push(String(t.raised_by));
            if (t.assigned_to) rawList.push(String(t.assigned_to));
            if (t.original_raiser) rawList.push(String(t.original_raiser));
        });
        if (reassignTicketObj.raised_by) rawList.push(String(reassignTicketObj.raised_by));
        if (reassignTicketObj.assigned_to) rawList.push(String(reassignTicketObj.assigned_to));
        if (reassignTicketObj.original_raiser) rawList.push(String(reassignTicketObj.original_raiser));

        rawList.forEach(val => {
            const strVal = String(val).trim();
            if (strVal && !['nan', 'none', '', 'unassigned'].includes(strVal.toLowerCase())) {
                restricted.add(strVal.toLowerCase());
                const u = (usersList || []).find(usr => String(usr.employee_id) === strVal || String(usr.email).toLowerCase() === strVal.toLowerCase());
                if (u) {
                    if (u.employee_id) restricted.add(String(u.employee_id).toLowerCase());
                    if (u.email) restricted.add(String(u.email).toLowerCase());
                }
            }
        });
        return restricted;
    }, [ticketsList, reassignTicketObj, usersList]);

    const reassignSolverOptions = useMemo(() => {
        if (!reassignDept || !reassignDept.trim()) return [];
        const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
        const targetNorm = norm(reassignDept);
        return usersList.filter(u => {
            const uDeptNorm = norm(u.department);
            const isActive = String(u.active).toUpperCase() !== 'FALSE';
            const isNotAdmin = !['Admin', 'Superadmin', 'Super Admin'].includes(u.role);
            const matchDept = uDeptNorm && targetNorm && (uDeptNorm === targetNorm || uDeptNorm.includes(targetNorm) || targetNorm.includes(uDeptNorm));
            const isRestricted = restrictedReassignUserIdentifiers.has(String(u.employee_id).toLowerCase()) || restrictedReassignUserIdentifiers.has(String(u.email || '').toLowerCase());
            return matchDept && isActive && isNotAdmin && !isRestricted;
        });
    }, [usersList, reassignDept, restrictedReassignUserIdentifiers]);

    const handleForceReassignSubmit = async (e) => {
        e.preventDefault();
        if (!reassignTarget) {
            alert("Please select a target solver.");
            return;
        }
        try {
            await adminReassignTicket({
                ticket_id: reassignTicketObj.ticket_id,
                department: reassignDept,
                new_solver: reassignTarget,
                reason: reassignReason || 'Force reassigned by Admin',
                admin_email: user.email || user.employee_id || 'Admin'
            });
            alert("Ticket force reassigned successfully.");
            setIsForceReassignModalOpen(false);
            setReassignTicketObj(null);
            setReassignTarget('');
            setReassignReason('');
            loadSystemData();
        } catch (err) {
            alert(err.response?.data?.error || "Failed to force reassign ticket.");
        }
    };

    // --- USERS UI STATE ---
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [userSearchConstraint, setUserSearchConstraint] = useState('all');
    const [userSortField, setUserSortField] = useState('name');
    const [userSortOrder, setUserSortOrder] = useState('asc');
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [userModalMode, setUserModalMode] = useState('add');
    const [selectedUsers, setSelectedUsers] = useState([]);
    const defaultUser = { employee_id: '', email: '', name: '', role: '', department: '', phone: '', secondary_roles: '', viewer_locations: '' };
    const [userFormData, setUserFormData] = useState(defaultUser);
    const [viewerSelectedProject, setViewerSelectedProject] = useState('');

    // --- LOCATIONS UI STATE ---
    const [locSearchQuery, setLocSearchQuery] = useState('');
    const [locSearchConstraint, setLocSearchConstraint] = useState('all');
    const [locSortField, setLocSortField] = useState('project');
    const [locSortOrder, setLocSortOrder] = useState('asc');
    const [isLocModalOpen, setIsLocModalOpen] = useState(false);
    const [locModalMode, setLocModalMode] = useState('add');
    const defaultLocation = { project: '', tower: '', location: '' };
    const [locFormData, setLocFormData] = useState(defaultLocation);

    // --- PROJECTS/DEPTS & CATEGORIES UI STATE ---
    const [deptSearchQuery, setDeptSearchQuery] = useState('');
    const [deptSearchConstraint, setDeptSearchConstraint] = useState('all');
    const [deptSortField, setDeptSortField] = useState('project');
    const [deptSortOrder, setDeptSortOrder] = useState('asc');

    const [catSearchQuery, setCatSearchQuery] = useState('');
    const [catSearchConstraint, setCatSearchConstraint] = useState('all');
    const [catSortField, setCatSortField] = useState('issue_category');
    const [catSortOrder, setCatSortOrder] = useState('asc');

    // --- PROJECT UI STATE ---
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [projectModalMode, setProjectModalMode] = useState('add');
    const [selectedProjects, setSelectedProjects] = useState([]);
    const defaultProject = { project: '' };
    const [projectFormData, setProjectFormData] = useState(defaultProject);

    // --- IMPORT UI STATE ---
    const [activeImportTab, setActiveImportTab] = useState('users');
    const [importError, setImportError] = useState('');
    const [importSuccess, setImportSuccess] = useState('');
    const [importFile, setImportFile] = useState(null);
    const [importValidationErrors, setImportValidationErrors] = useState([]);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        loadSystemData();
    }, []);

    const loadSystemData = async () => {
        setLoading(true);
        try {
            const results = await Promise.allSettled([
                fetchUsers(), fetchLocations(), fetchDepartments(), fetchIssueCategories(), fetchActivityCategories(), fetchTickets(), fetchProjects(), fetchSystemLogs(), fetchCannedResponses()
            ]);

            if (results[0].status === 'fulfilled') setUsersList(Array.isArray(results[0].value) ? results[0].value : []);
            if (results[1].status === 'fulfilled') setLocationsList(Array.isArray(results[1].value) ? results[1].value : []);
            if (results[2].status === 'fulfilled') setDepartmentsList(Array.isArray(results[2].value) ? results[2].value : []);
            if (results[3].status === 'fulfilled') setIssueCategoriesList(Array.isArray(results[3].value) ? results[3].value : []);
            if (results[4] && results[4].status === 'fulfilled') setActivityCategoriesList(Array.isArray(results[4].value) ? results[4].value : []);

            if (results[5].status === 'fulfilled') {
                let safeTickets = results[5].value?.data || results[5].value;
                if (typeof safeTickets === 'string') {
                    try { safeTickets = JSON.parse(safeTickets); } catch (e) { safeTickets = []; }
                }
                setTicketsList(Array.isArray(safeTickets) ? safeTickets : []);
            }
            if (results[6].status === 'fulfilled') setProjectsList(Array.isArray(results[6].value) ? results[6].value : []);
            if (results[7].status === 'fulfilled') setSystemLogs(Array.isArray(results[7].value) ? results[7].value : []);
            if (results[8] && results[8].status === 'fulfilled') setCannedResponsesList(Array.isArray(results[8].value) ? results[8].value : []);
        } catch (err) {
            console.error("Failed to load system data.", err);
            setError("Failed to load system data.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSelectedTickets = async (ticketIdsToDelete = selectedAgeingTickets) => {
        const ids = Array.isArray(ticketIdsToDelete) ? ticketIdsToDelete : [ticketIdsToDelete];
        if (ids.length === 0) return;

        const confirmMsg = ids.length === 1
            ? `Are you sure you want to permanently delete ticket #${ids[0]} and all associated timeline logs and notifications?`
            : `Are you sure you want to permanently delete these ${ids.length} selected tickets and all associated timeline logs and notifications?`;

        if (!window.confirm(confirmMsg)) return;

        try {
            const res = await deleteTickets(ids, user.email);
            alert(res.message || "Ticket(s) deleted successfully.");
            setSelectedAgeingTickets(prev => prev.filter(id => !ids.includes(id)));
            if (selectedTicket && ids.includes(selectedTicket.ticket_id)) {
                setSelectedTicket(null);
                setIsSidePanelExpanded(false);
            }
            loadSystemData();
            const ageingRes = await api.get('/reports/ageing');
            setAgeingData(ageingRes.data);
        } catch (err) {
            console.error("Failed to delete ticket(s):", err);
            alert(err.response?.data?.error || "Failed to delete ticket(s).");
        }
    };

    // Load Ageing Report fresh when the tab is clicked (and immediately on mount for KPIs)
    useEffect(() => {
        const fetchAgeing = async () => {
            try {
                const res = await api.get('/reports/ageing');
                setAgeingData(res.data);
            } catch (err) {
                console.error("Failed to fetch ageing report");
            }
        };
        fetchAgeing();
    }, [activeTab]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const ticketId = params.get('ticket_id');
        if (ticketId && ticketsList.length > 0) {
            const ticket = ticketsList.find(t => String(t.ticket_id) === String(ticketId));
            if (ticket) {
                if (activeTab !== 'ageing') {
                    selectingTicketFromUrlRef.current = true;
                    setActiveTab('ageing');
                }
                handleAgeingTicketClick(ticket);
                navigate(location.pathname, { replace: true });
            }
        }
    }, [location.search, ticketsList, activeTab]);

    const handleAgeingTicketClick = async (ticket) => {
        setSelectedTicket(ticket);
        setActiveDetailsTab('details');
        setTicketLogs([]);
        try {
            const res = await api.get(`/tickets/${ticket.ticket_id}/logs`);
            setTicketLogs(res.data);
        } catch (err) {
            console.error("Failed to fetch ticket logs");
        }
    };

    const getSolverDetails = (solverId) => {
        if (!solverId || String(solverId).toLowerCase() === 'nan' || solverId === 'Unassigned') return 'Unassigned';
        const solver = usersList.find(u => String(u.employee_id) === String(solverId) || String(u.email) === String(solverId));
        if (solver) return `${solver.name} (${solver.phone_number || solver.phone || 'N/A'})`;
        return solverId;
    };

    const formatSolverDetails = (solverData) => {
        if (!solverData || String(solverData).toLowerCase() === 'nan' || String(solverData).trim() === '') {
            return <span style={{ color: '#ef4444' }}>Unassigned</span>;
        }
        const ids = String(solverData).split(',').map(id => id.trim()).filter(Boolean);
        const formattedNames = ids.map(id => {
            const solver = usersList.find(u => String(u.employee_id) === id || String(u.email) === id);
            return solver ? `${solver.name} (${solver.phone_number || solver.phone || 'N/A'})` : id;
        });
        return formattedNames.join(', ');
    };

    // --- CSV DOWNLOAD EXPORTER ---
    const handleDownloadCSV = () => {
        exportExecutiveCSV(filteredAgeing, {}, usersList);
    };

    const handleDownloadSystemLogsCSV = () => {
        const dataToExport = filteredSystemLogs && filteredSystemLogs.length > 0 ? filteredSystemLogs : systemLogs;
        if (!dataToExport || dataToExport.length === 0) {
            alert("No system logs to download.");
            return;
        }

        const exportColumns = [
            { label: 'Timestamp', key: 'timestamp' },
            { label: 'Actor Email', key: 'actor_email' },
            { label: 'Action', key: 'action' },
            { label: 'Target', key: 'target' },
            { label: 'Details', key: 'details' }
        ];

        const headers = exportColumns.map(col => col.label);
        const csvRows = [headers.join(',')];

        for (const row of dataToExport) {
            const values = exportColumns.map(col => {
                const val = row[col.key] !== null && row[col.key] !== undefined ? row[col.key] : '';
                const escaped = ('' + val).replace(/"/g, '""');
                return `"${escaped}"`;
            });
            csvRows.push(values.join(','));
        }

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.setAttribute('download', `System_Logs_${timestamp}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- USER HANDLERS ---
    const handleUserSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...userFormData, admin_email: user.email };
            if (userModalMode === 'add') { await createUser(payload); alert('User created successfully.'); }
            else { await updateUser(payload); alert('User updated successfully.'); }
            setIsUserModalOpen(false); loadSystemData();
        } catch (err) { alert(err.response?.data?.error || "Failed to save user."); }
    };
    const openUserModal = (mode, userData = defaultUser) => {
        setUserModalMode(mode);
        setUserFormData({
            ...userData,
            phone: userData.phone_number || userData.phone || '',
            old_email: userData.email,
            old_employee_id: userData.employee_id,
            secondary_roles: userData.secondary_roles || '',
            viewer_locations: userData.viewer_locations || ''
        });
        setIsUserModalOpen(true);
    };

    const handleResetPassword = async () => {
        if (selectedUsers.length !== 1) {
            alert('Please select exactly one user to reset their password.');
            return;
        }
        const userEmail = selectedUsers[0];
        if (window.confirm(`Are you sure you want to reset the password for ${userEmail} to the default (Kolkata@123)?`)) {
            try {
                await resetUserPassword({ email: userEmail, admin_email: user.email });
                alert(`Password for ${userEmail} has been reset to Kolkata@123 and first login flag is set.`);
                setSelectedUsers([]);
                loadSystemData();
            } catch (err) {
                alert(err.response?.data?.error || 'Failed to reset password.');
            }
        }
    };

    const handleToggleActive = async () => {
        if (selectedUsers.length !== 1) return;
        const targetUser = usersList.find(u => u.email === selectedUsers[0]);
        if (!targetUser) return;

        const currentActive = String(targetUser.active).toUpperCase() !== 'FALSE';
        const newActive = !currentActive;

        try {
            await toggleUserActive({
                email: targetUser.email,
                active: newActive,
                admin_email: user.email
            });
            setSelectedUsers([]);
            loadSystemData();
        } catch (e) {
            console.error('Failed to toggle active status', e);
            alert(e.response?.data?.error || 'Failed to update status');
        }
    };

    const handleDeleteUsers = async () => {
        if (selectedUsers.length === 0) return;
        if (window.confirm(`Are you sure you want to delete ${selectedUsers.length} selected user(s)?`)) {
            try {
                await api.post('/admin/users/delete', { emails: selectedUsers, admin_email: user.email });
                alert(`Successfully deleted ${selectedUsers.length} user(s).`);
                setSelectedUsers([]);
                loadSystemData();
            } catch (err) {
                alert(err.response?.data?.error || "Failed to delete users.");
            }
        }
    };


    // --- LOCATION HANDLERS ---
    const handleLocSubmit = async (e) => {
        e.preventDefault();
        try {
            if (locModalMode === 'add') { await createLocation(locFormData); alert('Location added successfully.'); }
            else { await updateLocation(locFormData); alert('Location updated successfully.'); }
            setIsLocModalOpen(false); setSelectedMasterLocations([]); loadSystemData();
        } catch (err) { alert(err.response?.data?.error || "Failed to save location."); }
    };
    const openLocModal = (mode, locData = defaultLocation) => {
        setLocModalMode(mode);
        if (mode === 'edit') {
            setLocFormData({ ...locData, old_location: locData.location });
        } else {
            setLocFormData({ ...locData });
        }
        setIsLocModalOpen(true);
    };

    // --- APPROVALS HANDLERS ---
    const handleApproval = async (ticketId, approve, escalationLevel = 'L1') => {
        if (!window.confirm(`Are you sure you want to ${approve ? 'approve' : 'reject'} this handover?`)) return;
        try {
            await approveHandover({
                ticket_id: ticketId,
                decision: approve ? 'approve' : 'reject',
                approve,
                escalation_level: escalationLevel,
                user_email: user?.email || user?.employee_id || 'Admin'
            });
            alert(`Handover ${approve ? 'approved' : 'rejected'} successfully.`);
            loadSystemData();
        } catch (err) {
            alert(err.response?.data?.error || "Failed to process handover.");
        }
    };

    const getManagerDisplay = (managerId) => {
        if (!managerId || String(managerId).toLowerCase() === 'nan') return '-';
        const mgr = usersList.find(u => String(u.employee_id) === String(managerId));
        return mgr ? `${mgr.name} (${managerId})` : managerId;
    };

    // --- FILTER LOGIC ---
    const matchStartOfWord = (text, query) => {
        if (!query || !query.trim()) return true;
        if (text === null || text === undefined) return false;
        const q = query.trim().toLowerCase();
        const str = String(text).toLowerCase();
        const words = str.split(/[^a-z0-9]+/i).filter(Boolean);
        return str.startsWith(q) || words.some(w => w.startsWith(q));
    };

    const filteredUsers = useMemo(() => {
        const q = userSearchQuery.trim();

        let result = usersList.filter(u => {
            if (!q) return true;

            const managerDisplay = getManagerDisplay(u.reporting_manager);
            const fields = {
                employee_id: String(u.employee_id || ''),
                email: String(u.email || ''),
                department: String(u.department || ''),
                reporting_manager: String(managerDisplay || u.reporting_manager || ''),
                name: String(u.name || ''),
                designation: String(u.designation || ''),
                role: String(u.role || '')
            };

            if (userSearchConstraint !== 'all' && fields[userSearchConstraint] !== undefined) {
                return matchStartOfWord(fields[userSearchConstraint], q);
            }

            return (
                matchStartOfWord(fields.employee_id, q) ||
                matchStartOfWord(fields.name, q) ||
                matchStartOfWord(fields.email, q) ||
                matchStartOfWord(fields.department, q) ||
                matchStartOfWord(fields.designation, q) ||
                matchStartOfWord(fields.reporting_manager, q) ||
                matchStartOfWord(fields.role, q)
            );
        });

        if (userSortField) {
            result.sort((a, b) => {
                let valA = '';
                let valB = '';

                if (userSortField === 'reporting_manager') {
                    valA = getManagerDisplay(a.reporting_manager);
                    valB = getManagerDisplay(b.reporting_manager);
                } else if (userSortField === 'employee_id') {
                    const numA = parseFloat(a.employee_id);
                    const numB = parseFloat(b.employee_id);
                    if (!isNaN(numA) && !isNaN(numB)) {
                        return userSortOrder === 'asc' ? numA - numB : numB - numA;
                    }
                    valA = String(a.employee_id || '');
                    valB = String(b.employee_id || '');
                } else {
                    valA = String(a[userSortField] || '');
                    valB = String(b[userSortField] || '');
                }

                const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
                return userSortOrder === 'asc' ? cmp : -cmp;
            });
        }

        return result;
    }, [usersList, userSearchQuery, userSearchConstraint, userSortField, userSortOrder]);

    const handleSortClick = (field) => {
        if (userSortField === field) {
            setUserSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setUserSortField(field);
            setUserSortOrder('asc');
        }
    };

    // --- LOCATION FILTER & SORT ---
    const handleLocSortClick = (field) => {
        if (locSortField === field) {
            setLocSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setLocSortField(field);
            setLocSortOrder('asc');
        }
    };

    const filteredLocations = useMemo(() => {
        const q = locSearchQuery.trim();

        let result = locationsList.filter(l => {
            if (!q) return true;
            const fields = {
                project: String(l.project || ''),
                tower: String(l.tower || ''),
                location: String(l.location || '')
            };

            if (locSearchConstraint !== 'all' && fields[locSearchConstraint] !== undefined) {
                return matchStartOfWord(fields[locSearchConstraint], q);
            }

            return (
                matchStartOfWord(fields.project, q) ||
                matchStartOfWord(fields.tower, q) ||
                matchStartOfWord(fields.location, q)
            );
        });

        if (locSortField) {
            result.sort((a, b) => {
                const valA = String(a[locSortField] || '');
                const valB = String(b[locSortField] || '');
                const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
                return locSortOrder === 'asc' ? cmp : -cmp;
            });
        }

        return result;
    }, [locationsList, locSearchQuery, locSearchConstraint, locSortField, locSortOrder]);

    // --- PROJECTS & DEPTS FILTER & SORT ---
    const handleDeptSortClick = (field) => {
        if (deptSortField === field) {
            setDeptSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setDeptSortField(field);
            setDeptSortOrder('asc');
        }
    };

    const filteredDepartments = useMemo(() => {
        const q = deptSearchQuery.trim();
        let result = departmentsList.filter(d => {
            if (!q) return true;
            if (deptSearchConstraint === 'project') return false;
            const deptName = String(d.department || d.Department || d['Department'] || '');
            return matchStartOfWord(deptName, q);
        });

        if (deptSortField === 'department' || deptSortField === 'all') {
            result.sort((a, b) => {
                const valA = String(a.department || a.Department || a['Department'] || '');
                const valB = String(b.department || b.Department || b['Department'] || '');
                const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
                return deptSortOrder === 'asc' ? cmp : -cmp;
            });
        }
        return result;
    }, [departmentsList, deptSearchQuery, deptSearchConstraint, deptSortField, deptSortOrder]);

    const filteredProjects = useMemo(() => {
        const q = deptSearchQuery.trim();
        let result = projectsList.filter(p => {
            if (!q) return true;
            if (deptSearchConstraint === 'department') return false;
            const projName = String(p.project_name || p.project || p.Project || p['Project'] || '');
            return matchStartOfWord(projName, q);
        });

        if (deptSortField === 'project' || deptSortField === 'all') {
            result.sort((a, b) => {
                const valA = String(a.project_name || a.project || a.Project || a['Project'] || '');
                const valB = String(b.project_name || b.project || b.Project || b['Project'] || '');
                const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
                return deptSortOrder === 'asc' ? cmp : -cmp;
            });
        }
        return result;
    }, [projectsList, deptSearchQuery, deptSearchConstraint, deptSortField, deptSortOrder]);

    // --- CATEGORIES FILTER & SORT ---
    const handleCatSortClick = (field) => {
        if (catSortField === field) {
            setCatSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setCatSortField(field);
            setCatSortOrder('asc');
        }
    };

    const filteredIssueCategories = useMemo(() => {
        const q = catSearchQuery.trim();
        let result = issueCategoriesList.filter(i => {
            if (!q) return true;
            if (catSearchConstraint === 'activity_category') return false;
            const issueCat = String(i.issue_category || i.issue_category_name || '');
            return matchStartOfWord(issueCat, q);
        });

        if (catSortField === 'issue_category' || catSortField === 'all') {
            result.sort((a, b) => {
                const valA = String(a.issue_category || a.issue_category_name || '');
                const valB = String(b.issue_category || b.issue_category_name || '');
                const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
                return catSortOrder === 'asc' ? cmp : -cmp;
            });
        }
        return result;
    }, [issueCategoriesList, catSearchQuery, catSearchConstraint, catSortField, catSortOrder]);

    const filteredActivityCategories = useMemo(() => {
        const q = catSearchQuery.trim();
        let result = activityCategoriesList.filter(a => {
            if (!q) return true;
            if (catSearchConstraint === 'issue_category') return false;
            const actCat = String(a.activity_category || a.activity_category_name || '');
            return matchStartOfWord(actCat, q);
        });

        if (catSortField === 'activity_category' || catSortField === 'all') {
            result.sort((a, b) => {
                const valA = String(a.activity_category || a.activity_category_name || '');
                const valB = String(b.activity_category || b.activity_category_name || '');
                const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
                return catSortOrder === 'asc' ? cmp : -cmp;
            });
        }
        return result;
    }, [activityCategoriesList, catSearchQuery, catSearchConstraint, catSortField, catSortOrder]);

    const handleLogSortClick = (field) => {
        if (logSortField === field) {
            setLogSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setLogSortField(field);
            setLogSortOrder('asc');
        }
    };

    const isSystemLogFiltered = Boolean(
        systemLogSearch.trim() ||
        systemLogActorFilter ||
        systemLogActionFilter ||
        systemLogStartDate ||
        systemLogEndDate
    );

    const filteredSystemLogs = useMemo(() => {
        const q = systemLogSearch.trim().toLowerCase();
        const actorQ = systemLogActorFilter.trim().toLowerCase();
        const actionQ = systemLogActionFilter.trim().toLowerCase();
        const startDt = systemLogStartDate ? new Date(systemLogStartDate) : null;
        const endDt = systemLogEndDate ? new Date(systemLogEndDate) : null;

        return (systemLogs || []).filter(log => {
            if (q) {
                const matchAny = String(log.timestamp || '').toLowerCase().includes(q) ||
                    String(log.actor_email || '').toLowerCase().includes(q) ||
                    String(log.action || '').toLowerCase().includes(q) ||
                    String(log.target || '').toLowerCase().includes(q) ||
                    String(log.details || '').toLowerCase().includes(q);
                if (!matchAny) return false;
            }

            if (actorQ) {
                const actorVal = String(log.actor_email || '').toLowerCase();
                if (!actorVal.includes(actorQ)) return false;
            }

            if (actionQ) {
                const actionVal = String(log.action || '').toLowerCase();
                if (!actionVal.includes(actionQ)) return false;
            }

            if (startDt || endDt) {
                const logDt = parseDateString(log.timestamp);
                if (logDt) {
                    if (startDt && logDt < startDt) return false;
                    if (endDt && logDt > endDt) return false;
                }
            }

            return true;
        });
    }, [systemLogs, systemLogSearch, systemLogActorFilter, systemLogActionFilter, systemLogStartDate, systemLogEndDate]);

    const sortedSystemLogs = useMemo(() => {
        const list = [...filteredSystemLogs];
        list.sort((a, b) => {
            if (logSortField === 'timestamp') {
                const dtA = parseDateString(a.timestamp);
                const dtB = parseDateString(b.timestamp);
                const timeA = dtA ? dtA.getTime() : 0;
                const timeB = dtB ? dtB.getTime() : 0;
                return logSortOrder === 'asc' ? timeA - timeB : timeB - timeA;
            }
            const valA = String(a[logSortField] || '');
            const valB = String(b[logSortField] || '');
            const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
            return logSortOrder === 'asc' ? cmp : -cmp;
        });

        // If NO filter is applied, only show top 20 results. If filter is applied, show full filtered list.
        if (!isSystemLogFiltered) {
            return list.slice(0, 20);
        }
        return list;
    }, [filteredSystemLogs, logSortField, logSortOrder, isSystemLogFiltered]);

    const uniqueLogActors = useMemo(() => {
        return [...new Set((systemLogs || []).map(l => l.actor_email).filter(Boolean))].sort();
    }, [systemLogs]);

    const uniqueLogActions = useMemo(() => {
        return [...new Set((systemLogs || []).map(l => l.action).filter(Boolean))].sort();
    }, [systemLogs]);

    const pendingApprovals = ticketsList.filter(t => t.reassign_requested_to && String(t.reassign_requested_to).toLowerCase() !== 'nan' && t.reassign_requested_to !== '');

    const sidebarTabs = [
        { id: 'analytics', label: <><TrendingUp size={12} /> Global Analytics</> },
        { id: 'ageing', label: <><Clock size={12} /> Ageing Report</> },
        { id: 'master_control', label: <><Settings size={12} /> Master Control</> },
        { id: 'system_logs', label: <><FileText size={12} /> System Logs</> }
    ];

    // =========================================================================
    // GLOBAL KPI ENGINE (PINNED TO TOP OF ALL TABS)
    // =========================================================================
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
            if (targetMode === 'active') return false; // In Active/Live mode, closed/declined/held are not active breaches
            const finishStr = ticket.closed_timestamp || ticket.solved_timestamp;
            if (finishStr && String(finishStr).toLowerCase() !== 'nan') {
                const finishDate = parseDateString(finishStr);
                if (finishDate) return finishDate > deadlineDate;
            }
            return ticket.SLA_Breach === true || ticket.SLA_Breach === 'True';
        }

        return getISTDate() > deadlineDate;
    };

    const filteredAgeing = ageingData.filter(a => {
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
        const matchStatus = !advAgeingStatus || (a.status && a.status.toLowerCase() === advAgeingStatus.toLowerCase());
        const matchLevel = !advAgeingLevel || (a.escalation_level && a.escalation_level.toLowerCase() === advAgeingLevel.toLowerCase());
        const matchLocation = !advAgeingLocation || (a.location && a.location.toLowerCase() === advAgeingLocation.toLowerCase());
        const matchIssueCat = !advAgeingIssueCat || (a.issue_category && a.issue_category.toLowerCase() === advAgeingIssueCat.toLowerCase());
        const matchSeverity = !advAgeingSeverity || (a.severity && a.severity.toLowerCase() === advAgeingSeverity.toLowerCase());

        return matchBasic && matchDept && matchStatus && matchLevel && matchLocation && matchIssueCat && matchSeverity;
    });

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
            <div className="content-wrapper" style={{ paddingRight: selectedTicket && window.innerWidth > 768 ? '426px' : '0', transition: 'padding-right 0.9s', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '10px' }}>
                    <h2 style={{ fontSize: '19px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <Settings size={22} color="#3b82f6" /> System Administration
                    </h2>

                    {activeTab === 'master_control' && masterControlTab === 'issue_category' && (user.role === 'Superadmin' || user.role === 'Super Admin') && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <button className="btn" onClick={() => {
                                if (selectedMasterDepartments.length === 1) {
                                    const dName = selectedMasterDepartments[0];
                                    if (dName) { setDeptModalMode('edit'); setDeptFormData({ department: dName, old_department: dName }); setIsDeptModalOpen(true); }
                                } else if (selectedMasterIssues.length === 1) {
                                    const icName = selectedMasterIssues[0];
                                    if (icName) { setIssueModalMode('edit'); setCategoryModalType('issue'); setIssueFormData({ 'Issue Category': icName, 'Activity Category': '', 'old_Issue Category': icName, 'old_Activity Category': '' }); setIsIssueModalOpen(true); }
                                } else if (selectedMasterActivities.length === 1) {
                                    const acName = selectedMasterActivities[0];
                                    if (acName) { setIssueModalMode('edit'); setCategoryModalType('activity'); setIssueFormData({ 'Issue Category': '', 'Activity Category': acName, 'old_Issue Category': '', 'old_Activity Category': acName }); setIsIssueModalOpen(true); }
                                }
                            }} disabled={selectedMasterDepartments.length !== 1 && selectedMasterIssues.length !== 1 && selectedMasterActivities.length !== 1} style={{ backgroundColor: (selectedMasterDepartments.length === 1 || selectedMasterIssues.length === 1 || selectedMasterActivities.length === 1) ? '#3b82f6' : '#93c5fd', padding: '6px 12px', fontSize: '11px', whiteSpace: 'nowrap', minHeight: 'auto', margin: 0, cursor: (selectedMasterDepartments.length === 1 || selectedMasterIssues.length === 1 || selectedMasterActivities.length === 1) ? 'pointer' : 'not-allowed' }}>Edit Selected</button>

                            <button className="btn" onClick={async () => {
                                if (selectedMasterDepartments.length > 0) {
                                    if (window.confirm(`Delete ${selectedMasterDepartments.length} selected department(s)?`)) {
                                        try { await deleteDepartment(selectedMasterDepartments); alert('Deleted successfully'); setSelectedMasterDepartments([]); loadSystemData(); }
                                        catch (e) { alert(e.response?.data?.error || 'Failed'); }
                                    }
                                } else if (selectedMasterIssues.length > 0) {
                                    if (window.confirm(`Delete ${selectedMasterIssues.length} selected issue category(s)?`)) {
                                        try { await deleteIssueCategory(selectedMasterIssues); alert('Deleted successfully'); setSelectedMasterIssues([]); loadSystemData(); }
                                        catch (e) { alert(e.response?.data?.error || 'Failed'); }
                                    }
                                } else if (selectedMasterActivities.length > 0) {
                                    if (window.confirm(`Delete ${selectedMasterActivities.length} selected activity category(s)?`)) {
                                        try { await deleteActivityCategory(selectedMasterActivities); alert('Deleted successfully'); setSelectedMasterActivities([]); loadSystemData(); }
                                        catch (e) { alert(e.response?.data?.error || 'Failed'); }
                                    }
                                }
                            }} disabled={selectedMasterDepartments.length === 0 && selectedMasterIssues.length === 0 && selectedMasterActivities.length === 0} style={{ backgroundColor: (selectedMasterDepartments.length > 0 || selectedMasterIssues.length > 0 || selectedMasterActivities.length > 0) ? '#ef4444' : '#fca5a5', padding: '6px 12px', fontSize: '11px', whiteSpace: 'nowrap', minHeight: 'auto', margin: 0, cursor: (selectedMasterDepartments.length > 0 || selectedMasterIssues.length > 0 || selectedMasterActivities.length > 0) ? 'pointer' : 'not-allowed' }}>Delete Selected</button>
                        </div>
                    )}
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
                {error && <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '8px', borderRadius: '3px', marginBottom: '12px', fontSize: '10px' }}>{error}</div>}

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

                {/* TAB CONTENT VIEWS */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, paddingBottom: '16px' }}>
                    {activeTab === 'analytics' && !loading && <AdminAnalytics tickets={ageingData && ageingData.length > 0 ? ageingData : ticketsList} usersList={usersList} slaBreachMode={slaBreachMode} onSlaBreachModeChange={setSlaBreachMode} />}

                    {activeTab === 'approvals' && !loading && (
                        <div className="card">
                            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Pending Handover Approvals</h3>
                            {pendingApprovals.length === 0 ? (
                                <p style={{ textAlign: 'center', color: '#71717a', padding: '20px' }}>No pending approvals.</p>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '10px' }}>
                                    <thead style={{ backgroundColor: '#18181b' }}>
                                        <tr>
                                            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #27272a', position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 10 }}>Ticket ID</th>
                                            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #27272a', position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 10 }}>Issue Cat.</th>
                                            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #27272a', position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 10 }}>Act. Cat.</th>
                                            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #27272a', position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 10 }}>Description</th>
                                            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #27272a', position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 10 }}>Original Solver</th>
                                            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #27272a', position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 10 }}>Requested Solver</th>
                                            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #27272a', position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 10 }}>Reason</th>
                                            <th style={{ padding: '10px', textAlign: 'right', borderBottom: '2px solid #27272a', position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 10 }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingApprovals.map(ticket => (
                                            <tr key={ticket.ticket_id} style={{ borderBottom: '1px solid #27272a' }}>
                                                <td style={{ padding: '10px', fontWeight: 'bold' }}><span style={{ color: (isLate(ticket) || ticket.SLA_Breach === 'True' || ticket.SLA_Breach === true) ? '#ef4444' : 'inherit' }}>#{ticket.ticket_id}</span></td>
                                                <td style={{ padding: '10px' }}>{ticket.issue_category || '-'}</td>
                                                <td style={{ padding: '10px' }}>{ticket.activity_category || '-'}</td>
                                                <td style={{ padding: '10px', maxWidth: '200px', minWidth: '150px' }} title={ticket.description || ''}>
                                                    <div style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.4', wordBreak: 'break-word', fontSize: '10.5px', color: '#a1a1aa' }}>
                                                        {ticket.description || '-'}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '10px', color: '#60a5fa' }}>{formatSolverDetails(ticket.assigned_to)}</td>
                                                <td style={{ padding: '10px', color: 'var(--text-muted)' }}>{formatSolverDetails(ticket.reassign_requested_to)}</td>
                                                <td style={{ padding: '10px', maxWidth: '200px', minWidth: '120px' }} title={ticket.reassign_reason || ''}>
                                                    <div style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.4', wordBreak: 'break-word', fontSize: '10.5px' }}>
                                                        {ticket.reassign_reason || '-'}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '10px', textAlign: 'right', whiteSpace: 'nowrap', minWidth: '120px' }}>
                                                    <button onClick={() => handleApproval(ticket.ticket_id, true, ticket.escalation_level)} className="btn btn-success" style={{ padding: '4px 8px', fontSize: '9px', marginRight: '5px' }}>Approve</button>
                                                    <button onClick={() => handleApproval(ticket.ticket_id, false, ticket.escalation_level)} className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '9px' }}>Reject</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}
                    {activeTab === 'ageing' && !loading && (
                        <div className="card flex-table-card" style={isAgeingExpanded ? { position: 'fixed', inset: '16px', zIndex: 1000, backgroundColor: 'var(--bg-main, #0f172a)', margin: 0, padding: '20px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,0.8)' } : { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, marginBottom: 0 }}>
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
                                    {(user.role === 'Superadmin' || user.role === 'Super Admin') && (
                                        <button
                                            className="btn force-white-text p-2 text-xs flex-row gap-1"
                                            onClick={() => handleDeleteSelectedTickets()}
                                            disabled={selectedAgeingTickets.length === 0}
                                            style={{
                                                whiteSpace: 'nowrap',
                                                backgroundColor: selectedAgeingTickets.length > 0 ? '#ef4444' : 'rgba(239,68,68,0.3)',
                                                color: '#ffffff',
                                                border: 'none',
                                                borderRadius: '6px',
                                                cursor: selectedAgeingTickets.length > 0 ? 'pointer' : 'not-allowed'
                                            }}
                                            title="Delete Selected Tickets"
                                        >
                                            <Trash2 size={11} /> Delete Selected {selectedAgeingTickets.length > 0 ? `(${selectedAgeingTickets.length})` : ''}
                                        </button>
                                    )}
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
                                                {(user.role === 'Superadmin' || user.role === 'Super Admin') && (
                                                    <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold', width: '36px' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={filteredAgeing.length > 0 && selectedAgeingTickets.length === new Set(filteredAgeing.map(t => t.ticket_id)).size}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedAgeingTickets(Array.from(new Set(filteredAgeing.map(t => t.ticket_id))));
                                                                } else {
                                                                    setSelectedAgeingTickets([]);
                                                                }
                                                            }}
                                                        />
                                                    </th>
                                                )}
                                                <th onClick={() => handleAgeingSortClick('ticket_id')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Ticket ID">
                                                    ID {ageingSortField === 'ticket_id' ? (ageingSortOrder === 'asc' ? '▲' : '▼') : ''}
                                                </th>
                                                <th onClick={() => handleAgeingSortClick('dept_assigned')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Department">
                                                    Dept {ageingSortField === 'dept_assigned' ? (ageingSortOrder === 'asc' ? '▲' : '▼') : ''}
                                                </th>
                                                <th onClick={() => handleAgeingSortClick('issue_category')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Issue Category">
                                                    Issue Cat. {ageingSortField === 'issue_category' ? (ageingSortOrder === 'asc' ? '▲' : '▼') : ''}
                                                </th>
                                                <th onClick={() => handleAgeingSortClick('activity_category')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Activity Category">
                                                    Act. Cat. {ageingSortField === 'activity_category' ? (ageingSortOrder === 'asc' ? '▲' : '▼') : ''}
                                                </th>
                                                <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Description</th>
                                                <th onClick={() => handleAgeingSortClick('location')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Location">
                                                    Location {ageingSortField === 'location' ? (ageingSortOrder === 'asc' ? '▲' : '▼') : ''}
                                                </th>
                                                <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold' }}>Image</th>
                                                <th onClick={() => handleAgeingSortClick('deadline')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Target Deadline">
                                                    Deadline {ageingSortField === 'deadline' ? (ageingSortOrder === 'asc' ? '▲' : '▼') : ''}
                                                </th>
                                                <th onClick={() => handleAgeingSortClick('escalation_level')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Escalation Level">
                                                    Level {ageingSortField === 'escalation_level' ? (ageingSortOrder === 'asc' ? '▲' : '▼') : ''}
                                                </th>
                                                <th onClick={() => handleAgeingSortClick('severity')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Severity">
                                                    Severity {ageingSortField === 'severity' ? (ageingSortOrder === 'asc' ? '▲' : '▼') : ''}
                                                </th>
                                                <th onClick={() => handleAgeingSortClick('status')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Status">
                                                    Status {ageingSortField === 'status' ? (ageingSortOrder === 'asc' ? '▲' : '▼') : ''}
                                                </th>
                                                <th onClick={() => handleAgeingSortClick('assigned_by')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Assigned By">
                                                    Assigned By {ageingSortField === 'assigned_by' ? (ageingSortOrder === 'asc' ? '▲' : '▼') : ''}
                                                </th>
                                                <th onClick={() => handleAgeingSortClick('assigned_to')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Assigned To">
                                                    Assigned To {ageingSortField === 'assigned_to' ? (ageingSortOrder === 'asc' ? '▲' : '▼') : ''}
                                                </th>
                                                <th onClick={() => handleAgeingSortClick('ticket_age_hours')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Ticket Age">
                                                    Ticket Age {ageingSortField === 'ticket_age_hours' ? (ageingSortOrder === 'asc' ? '▲' : '▼') : ''}
                                                </th>
                                                <th onClick={() => handleAgeingSortClick('solver_resolution_hours')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Resolution Time">
                                                    Res. Time {ageingSortField === 'solver_resolution_hours' ? (ageingSortOrder === 'asc' ? '▲' : '▼') : ''}
                                                </th>
                                                <th onClick={() => handleAgeingSortClick('total_turnaround_hours')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Total Turnaround">
                                                    Turnaround {ageingSortField === 'total_turnaround_hours' ? (ageingSortOrder === 'asc' ? '▲' : '▼') : ''}
                                                </th>
                                                <th onClick={() => handleAgeingSortClick('solver_delay_hours')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Delay">
                                                    Delay {ageingSortField === 'solver_delay_hours' ? (ageingSortOrder === 'asc' ? '▲' : '▼') : ''}
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedAgeing.length === 0 ? (
                                                <tr><td colSpan="18" className="text-center p-4 text-muted">No records found.</td></tr>
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
                                                            {(user.role === 'Superadmin' || user.role === 'Super Admin') && !isGrouped && (
                                                                <td style={{ padding: '6px 8px', textAlign: 'center' }} rowSpan={rowSpan} onClick={(e) => e.stopPropagation()}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedAgeingTickets.includes(a.ticket_id)}
                                                                        onChange={(e) => {
                                                                            const tid = a.ticket_id;
                                                                            setSelectedAgeingTickets(prev =>
                                                                                prev.includes(tid) ? prev.filter(x => x !== tid) : [...prev, tid]
                                                                            );
                                                                        }}
                                                                    />
                                                                </td>
                                                            )}
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
                                                            <td style={{ padding: '12px 8px' }}><span style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold' }}>{a.escalation_level || 'L1'}</span></td>
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







                    {/* MASTER CONTROL TAB */}
                    {activeTab === 'system_logs' && !loading && (
                        <div className="card fade-in" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, marginBottom: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <h3 style={{ margin: 0, whiteSpace: 'nowrap', fontSize: '16px' }}>System Logs</h3>
                                    <span style={{
                                        fontSize: '11px',
                                        padding: '3px 8px',
                                        borderRadius: '12px',
                                        backgroundColor: isSystemLogFiltered ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                                        color: isSystemLogFiltered ? '#60a5fa' : 'var(--text-muted)',
                                        fontWeight: '600'
                                    }}>
                                        {isSystemLogFiltered
                                            ? `Showing all ${filteredSystemLogs.length} matching logs`
                                            : `Showing Top ${sortedSystemLogs.length} of ${systemLogs.length} logs`}
                                    </span>
                                </div>
                                <button
                                    className="btn force-white-text p-2 text-xs flex-row gap-1"
                                    onClick={handleDownloadSystemLogsCSV}
                                    style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#3b82f6', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 6px rgba(59, 130, 246, 0.3)' }}
                                    title={isSystemLogFiltered ? `Download ${filteredSystemLogs.length} filtered logs (CSV)` : `Download all ${systemLogs.length} system logs (CSV)`}
                                >
                                    <Download size={13} style={{ color: '#ffffff' }} />
                                    <span style={{ color: '#ffffff' }}>
                                        {isSystemLogFiltered ? `Download Filtered CSV (${filteredSystemLogs.length})` : `Download Full CSV (${systemLogs.length})`}
                                    </span>
                                </button>
                            </div>

                            {/* FILTER TOOLBAR */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                gap: '10px',
                                padding: '12px',
                                backgroundColor: 'var(--bg-card, #18181b)',
                                border: '1px solid var(--border, rgba(255,255,255,0.08))',
                                borderRadius: '6px',
                                marginBottom: '16px',
                                alignItems: 'center'
                            }}>
                                {/* General Text Search */}
                                <div style={{ position: 'relative' }}>
                                    <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        type="text"
                                        placeholder="Search keyword / target..."
                                        value={systemLogSearch}
                                        onChange={(e) => setSystemLogSearch(e.target.value)}
                                        style={{ width: '100%', padding: '6px 10px 6px 30px', fontSize: '11px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-main)', boxSizing: 'border-box' }}
                                    />
                                </div>

                                {/* Actor Filter */}
                                <div>
                                    <select
                                        value={systemLogActorFilter}
                                        onChange={(e) => setSystemLogActorFilter(e.target.value)}
                                        style={{ width: '100%', padding: '6px 10px', fontSize: '11px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-main)', boxSizing: 'border-box' }}
                                    >
                                        <option value="">All Actors ({uniqueLogActors.length})</option>
                                        {uniqueLogActors.map((actor, idx) => (
                                            <option key={idx} value={actor}>{actor}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Action Filter */}
                                <div>
                                    <select
                                        value={systemLogActionFilter}
                                        onChange={(e) => setSystemLogActionFilter(e.target.value)}
                                        style={{ width: '100%', padding: '6px 10px', fontSize: '11px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-main)', boxSizing: 'border-box' }}
                                    >
                                        <option value="">All Actions ({uniqueLogActions.length})</option>
                                        {uniqueLogActions.map((act, idx) => (
                                            <option key={idx} value={act}>{act}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Start Date Filter */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <label style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>From:</label>
                                    <input
                                        type="date"
                                        value={systemLogStartDate}
                                        onChange={(e) => setSystemLogStartDate(e.target.value)}
                                        style={{ width: '100%', padding: '5px 8px', fontSize: '11px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-main)', boxSizing: 'border-box' }}
                                    />
                                </div>

                                {/* End Date Filter */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <label style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>To:</label>
                                    <input
                                        type="date"
                                        value={systemLogEndDate}
                                        onChange={(e) => setSystemLogEndDate(e.target.value)}
                                        style={{ width: '100%', padding: '5px 8px', fontSize: '11px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-main)', boxSizing: 'border-box' }}
                                    />
                                </div>

                                {/* Clear Filters */}
                                {isSystemLogFiltered && (
                                    <div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSystemLogSearch('');
                                                setSystemLogActorFilter('');
                                                setSystemLogActionFilter('');
                                                setSystemLogStartDate('');
                                                setSystemLogEndDate('');
                                            }}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                fontSize: '11px',
                                                padding: '6px 12px',
                                                color: '#ef4444',
                                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                width: '100%',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            <X size={12} /> Clear Filters
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', tableLayout: 'fixed' }}>
                                    <thead>
                                        <tr>
                                            <th onClick={() => handleLogSortClick('timestamp')} style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none', width: '15%' }} title="Sort by Timestamp">
                                                Timestamp {logSortField === 'timestamp' ? (logSortOrder === 'asc' ? '▲' : '▼') : ''}
                                            </th>
                                            <th onClick={() => handleLogSortClick('actor_email')} style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none', width: '18%' }} title="Sort by Actor">
                                                Actor {logSortField === 'actor_email' ? (logSortOrder === 'asc' ? '▲' : '▼') : ''}
                                            </th>
                                            <th onClick={() => handleLogSortClick('action')} style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none', width: '18%' }} title="Sort by Action">
                                                Action {logSortField === 'action' ? (logSortOrder === 'asc' ? '▲' : '▼') : ''}
                                            </th>
                                            <th onClick={() => handleLogSortClick('target')} style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none', width: '22%' }} title="Sort by Target">
                                                Target {logSortField === 'target' ? (logSortOrder === 'asc' ? '▲' : '▼') : ''}
                                            </th>
                                            <th onClick={() => handleLogSortClick('details')} style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none', width: '27%' }} title="Sort by Details">
                                                Details {logSortField === 'details' ? (logSortOrder === 'asc' ? '▲' : '▼') : ''}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedSystemLogs.map((log, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '12px 14px', color: 'var(--text-muted)', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{log.timestamp}</td>
                                                <td style={{ padding: '12px 14px', color: 'var(--text-muted)', fontWeight: 'bold', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{log.actor_email}</td>
                                                <td style={{ padding: '12px 14px', color: '#60a5fa', fontWeight: '600', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{log.action}</td>
                                                <td style={{ padding: '12px 14px', color: 'var(--text-muted)', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{log.target || '-'}</td>
                                                <td style={{ padding: '12px 14px', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{log.details || '-'}</td>
                                            </tr>
                                        ))}
                                        {sortedSystemLogs.length === 0 && (
                                            <tr>
                                                <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No system logs found.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'master_control' && !loading && (
                        <div className="card fade-in" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, marginBottom: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <h3 style={{ margin: 0, whiteSpace: 'nowrap', fontSize: '16px' }}>Master Control</h3>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    {masterControlTab === 'users' && (
                                        <>
                                            {(user.role === 'Superadmin' || user.role === 'Super Admin') && (
                                                <button className="btn" onClick={handleDeleteUsers} disabled={selectedUsers.length === 0} style={{ backgroundColor: selectedUsers.length > 0 ? '#ef4444' : '#fca5a5', padding: '6px 13px', fontSize: '10px', whiteSpace: 'nowrap', cursor: selectedUsers.length > 0 ? 'pointer' : 'not-allowed' }}>
                                                    Delete User {selectedUsers.length > 0 ? `(${selectedUsers.length})` : ''}
                                                </button>
                                            )}
                                            <button className="btn" onClick={() => openUserModal('add')} style={{ backgroundColor: '#10b981', padding: '6px 13px', fontSize: '10px', whiteSpace: 'nowrap' }}>+ Add Employee</button>
                                        </>
                                    )}

                                    {masterControlTab === 'locations' && (
                                        <>
                                            {(user.role === 'Superadmin' || user.role === 'Super Admin') && (
                                                <>
                                                    <button className="btn" onClick={() => {
                                                        const loc = locationsList.find(l => l.location === selectedMasterLocations[0]);
                                                        if (loc) openLocModal('edit', loc);
                                                    }} disabled={selectedMasterLocations.length !== 1} style={{ backgroundColor: selectedMasterLocations.length === 1 ? '#3b82f6' : '#93c5fd', padding: '6px 13px', fontSize: '10px', whiteSpace: 'nowrap', cursor: selectedMasterLocations.length === 1 ? 'pointer' : 'not-allowed' }}>Edit</button>
                                                    <button className="btn" onClick={async () => {
                                                        if (window.confirm(`Delete ${selectedMasterLocations.length} selected location(s)?`)) {
                                                            try { await deleteLocation(selectedMasterLocations); alert('Deleted successfully'); setSelectedMasterLocations([]); loadSystemData(); }
                                                            catch (e) { alert(e.response?.data?.error || 'Failed'); }
                                                        }
                                                    }} disabled={selectedMasterLocations.length === 0} style={{ backgroundColor: selectedMasterLocations.length > 0 ? '#ef4444' : '#fca5a5', padding: '6px 13px', fontSize: '10px', whiteSpace: 'nowrap', cursor: selectedMasterLocations.length > 0 ? 'pointer' : 'not-allowed' }}>Delete</button>
                                                </>
                                            )}
                                            <button className="btn" onClick={() => openLocModal('add')} style={{ backgroundColor: '#10b981', padding: '6px 13px', fontSize: '10px', whiteSpace: 'nowrap' }}>Add</button>
                                        </>
                                    )}
                                </div>
                            </div>


                            {/* PILL NAVIGATION & CONTEXTUAL ACTIONS */}
                            <div className="master-controls-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>

                                {/* PILLS */}
                                <div className="master-pills-bar" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {['users', 'projects_dept', 'locations', 'categories', 'canned_responses', 'import'].map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => setMasterControlTab(tab)}
                                            style={{
                                                padding: '6px 16px',
                                                borderRadius: '20px',
                                                border: 'none',
                                                fontSize: '11px',
                                                fontWeight: '500',
                                                cursor: 'pointer',
                                                backgroundColor: masterControlTab === tab ? '#3b82f6' : '#e2e8f0',
                                                color: masterControlTab === tab ? '#ffffff' : '#64748b',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {tab === 'users' ? 'User Directory' : tab === 'projects_dept' ? 'Projects & Departments' : tab === 'locations' ? 'Location' : tab === 'categories' ? 'Categories' : tab === 'canned_responses' ? '⚡ Canned Responses' : 'Bulk Import'}
                                        </button>
                                    ))}
                                </div>

                                {/* ACTIONS */}
                                <div className="master-actions-bar" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    {masterControlTab === 'canned_responses' && (
                                        <div className="master-search-bar" style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="🔍 Search templates..."
                                                value={cannedSearchQuery}
                                                onChange={(e) => setCannedSearchQuery(e.target.value)}
                                                style={{ padding: '5px 8px', fontSize: '10px', width: '160px', margin: 0, height: '28px' }}
                                            />
                                            <select
                                                className="form-control"
                                                value={cannedSortField}
                                                onChange={(e) => setCannedSortField(e.target.value)}
                                                style={{ padding: '5px 8px', fontSize: '10px', width: '130px', margin: 0, height: '28px' }}
                                            >
                                                <option value="id">Sort by ID</option>
                                                <option value="label">Sort by Title</option>
                                                <option value="text">Sort by Content</option>
                                                <option value="created_by">Sort by Owner</option>
                                                <option value="is_custom">Sort by Scope</option>
                                            </select>
                                            <button
                                                type="button"
                                                className="btn"
                                                onClick={() => setCannedSortOrder(cannedSortOrder === 'asc' ? 'desc' : 'asc')}
                                                title={`Sort ${cannedSortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
                                                style={{ padding: '4px 8px', fontSize: '10px', margin: 0, height: '28px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border)', color: 'var(--text-main)', whiteSpace: 'nowrap' }}
                                            >
                                                {cannedSortOrder === 'asc' ? '▲ ASC' : '▼ DESC'}
                                            </button>
                                            <button
                                                className="btn"
                                                onClick={() => {
                                                    setCannedModalMode('add');
                                                    setCannedFormData({ id: null, label: '', text: '', created_by: user.name || user.email || user.employee_id || 'System Admin' });
                                                    setIsCannedModalOpen(true);
                                                }}
                                                style={{ backgroundColor: '#10b981', padding: '4px 10px', fontSize: '10px', whiteSpace: 'nowrap', minHeight: 'auto', margin: 0 }}
                                            >
                                                + Add Template
                                            </button>
                                        </div>
                                    )}
                                    {masterControlTab === 'users' && (
                                        <div className="master-search-bar" style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <select
                                                className="form-control"
                                                value={userSearchConstraint}
                                                onChange={(e) => setUserSearchConstraint(e.target.value)}
                                                style={{ padding: '5px 8px', fontSize: '10px', width: '120px', margin: 0, height: '28px' }}
                                                title="Search constraint field"
                                            >
                                                <option value="all">All Fields</option>
                                                <option value="employee_id">Emp ID</option>
                                                <option value="name">Name</option>
                                                <option value="email">Email</option>
                                                <option value="designation">Designation</option>
                                                <option value="department">Department</option>
                                                <option value="reporting_manager">Reporting Mgr</option>
                                            </select>
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="🔍 Search users..."
                                                value={userSearchQuery}
                                                onChange={(e) => setUserSearchQuery(e.target.value)}
                                                style={{ padding: '5px 8px', fontSize: '10px', width: '160px', margin: 0, height: '28px' }}
                                            />
                                            <select
                                                className="form-control"
                                                value={userSortField}
                                                onChange={(e) => setUserSortField(e.target.value)}
                                                style={{ padding: '5px 8px', fontSize: '10px', width: '130px', margin: 0, height: '28px' }}
                                                title="Sort field"
                                            >
                                                <option value="employee_id">Sort: Emp ID</option>
                                                <option value="name">Sort: Name</option>
                                                <option value="email">Sort: Email</option>
                                                <option value="department">Sort: Dept</option>
                                                <option value="designation">Sort: Designation</option>
                                                <option value="reporting_manager">Sort: Reporting Mgr</option>
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => setUserSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                                style={{
                                                    padding: '4px 8px',
                                                    fontSize: '10px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    fontWeight: 'bold',
                                                    margin: 0,
                                                    cursor: 'pointer',
                                                    backgroundColor: 'var(--bg-main)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: '4px',
                                                    color: 'var(--text-main)',
                                                    height: '28px',
                                                    whiteSpace: 'nowrap'
                                                }}
                                                title={`Toggle sort order (Currently ${userSortOrder === 'asc' ? 'Ascending' : 'Descending'})`}
                                            >
                                                {userSortOrder === 'asc' ? <ArrowUp size={12} color="#3b82f6" /> : <ArrowDown size={12} color="#ef4444" />}
                                                {userSortOrder.toUpperCase()}
                                            </button>
                                        </div>
                                    )}
                                    {masterControlTab === 'locations' && (
                                        <div className="master-search-bar" style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <select
                                                className="form-control"
                                                value={locSearchConstraint}
                                                onChange={(e) => setLocSearchConstraint(e.target.value)}
                                                style={{ padding: '5px 8px', fontSize: '10px', width: '110px', margin: 0, height: '28px' }}
                                                title="Search constraint field"
                                            >
                                                <option value="all">All Fields</option>
                                                <option value="project">Project</option>
                                                <option value="tower">Tower</option>
                                                <option value="location">Location</option>
                                            </select>
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="🔍 Search locations..."
                                                value={locSearchQuery}
                                                onChange={(e) => setLocSearchQuery(e.target.value)}
                                                style={{ padding: '5px 8px', fontSize: '10px', width: '160px', margin: 0, height: '28px' }}
                                            />
                                            <select
                                                className="form-control"
                                                value={locSortField}
                                                onChange={(e) => setLocSortField(e.target.value)}
                                                style={{ padding: '5px 8px', fontSize: '10px', width: '120px', margin: 0, height: '28px' }}
                                                title="Sort field"
                                            >
                                                <option value="project">Sort: Project</option>
                                                <option value="tower">Sort: Tower</option>
                                                <option value="location">Sort: Location</option>
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => setLocSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                                style={{
                                                    padding: '4px 8px',
                                                    fontSize: '10px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    fontWeight: 'bold',
                                                    margin: 0,
                                                    cursor: 'pointer',
                                                    backgroundColor: 'var(--bg-main)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: '4px',
                                                    color: 'var(--text-main)',
                                                    height: '28px',
                                                    whiteSpace: 'nowrap'
                                                }}
                                                title={`Toggle sort order (Currently ${locSortOrder === 'asc' ? 'Ascending' : 'Descending'})`}
                                            >
                                                {locSortOrder === 'asc' ? <ArrowUp size={12} color="#3b82f6" /> : <ArrowDown size={12} color="#ef4444" />}
                                                {locSortOrder.toUpperCase()}
                                            </button>
                                        </div>
                                    )}
                                    {masterControlTab === 'projects_dept' && (
                                        <div className="master-search-bar" style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <select
                                                className="form-control"
                                                value={deptSearchConstraint}
                                                onChange={(e) => setDeptSearchConstraint(e.target.value)}
                                                style={{ padding: '5px 8px', fontSize: '10px', width: '120px', margin: 0, height: '28px' }}
                                                title="Search constraint field"
                                            >
                                                <option value="all">All Fields</option>
                                                <option value="project">Project</option>
                                                <option value="department">Department</option>
                                            </select>
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="🔍 Search projects & depts..."
                                                value={deptSearchQuery}
                                                onChange={(e) => setDeptSearchQuery(e.target.value)}
                                                style={{ padding: '5px 8px', fontSize: '10px', width: '160px', margin: 0, height: '28px' }}
                                            />
                                            <select
                                                className="form-control"
                                                value={deptSortField}
                                                onChange={(e) => setDeptSortField(e.target.value)}
                                                style={{ padding: '5px 8px', fontSize: '10px', width: '130px', margin: 0, height: '28px' }}
                                                title="Sort field"
                                            >
                                                <option value="project">Sort: Project</option>
                                                <option value="department">Sort: Dept</option>
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => setDeptSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                                style={{
                                                    padding: '4px 8px',
                                                    fontSize: '10px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    fontWeight: 'bold',
                                                    margin: 0,
                                                    cursor: 'pointer',
                                                    backgroundColor: 'var(--bg-main)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: '4px',
                                                    color: 'var(--text-main)',
                                                    height: '28px',
                                                    whiteSpace: 'nowrap'
                                                }}
                                                title={`Toggle sort order (Currently ${deptSortOrder === 'asc' ? 'Ascending' : 'Descending'})`}
                                            >
                                                {deptSortOrder === 'asc' ? <ArrowUp size={12} color="#3b82f6" /> : <ArrowDown size={12} color="#ef4444" />}
                                                {deptSortOrder.toUpperCase()}
                                            </button>
                                        </div>
                                    )}
                                    {masterControlTab === 'categories' && (
                                        <div className="master-search-bar" style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <select
                                                className="form-control"
                                                value={catSearchConstraint}
                                                onChange={(e) => setCatSearchConstraint(e.target.value)}
                                                style={{ padding: '5px 8px', fontSize: '10px', width: '130px', margin: 0, height: '28px' }}
                                                title="Search constraint field"
                                            >
                                                <option value="all">All Categories</option>
                                                <option value="issue_category">Issue Category</option>
                                                <option value="activity_category">Activity Category</option>
                                            </select>
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="🔍 Search categories..."
                                                value={catSearchQuery}
                                                onChange={(e) => setCatSearchQuery(e.target.value)}
                                                style={{ padding: '5px 8px', fontSize: '10px', width: '160px', margin: 0, height: '28px' }}
                                            />
                                            <select
                                                className="form-control"
                                                value={catSortField}
                                                onChange={(e) => setCatSortField(e.target.value)}
                                                style={{ padding: '5px 8px', fontSize: '10px', width: '140px', margin: 0, height: '28px' }}
                                                title="Sort field"
                                            >
                                                <option value="issue_category">Sort: Issue Cat</option>
                                                <option value="activity_category">Sort: Activity Cat</option>
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => setCatSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                                style={{
                                                    padding: '4px 8px',
                                                    fontSize: '10px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    fontWeight: 'bold',
                                                    margin: 0,
                                                    cursor: 'pointer',
                                                    backgroundColor: 'var(--bg-main)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: '4px',
                                                    color: 'var(--text-main)',
                                                    height: '28px',
                                                    whiteSpace: 'nowrap'
                                                }}
                                                title={`Toggle sort order (Currently ${catSortOrder === 'asc' ? 'Ascending' : 'Descending'})`}
                                            >
                                                {catSortOrder === 'asc' ? <ArrowUp size={12} color="#3b82f6" /> : <ArrowDown size={12} color="#ef4444" />}
                                                {catSortOrder.toUpperCase()}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* SUB-TABS CONTENT */}

                            {/* USERS */}
                            {masterControlTab === 'users' && (
                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                                    <div style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
                                        <table style={{ width: '100%', minWidth: '980px', borderCollapse: 'collapse', fontSize: '11px' }}>
                                            <thead>
                                                <tr style={{ position: 'sticky', top: 0, zIndex: 5, backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border)' }}>
                                                    <th onClick={() => handleSortClick('employee_id')} style={{ width: '100px', minWidth: '100px', padding: '12px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none', backgroundColor: 'var(--bg-main)', whiteSpace: 'nowrap' }} title="Click to sort by Emp ID">
                                                        Emp ID {userSortField === 'employee_id' ? (userSortOrder === 'asc' ? '▲' : '▼') : ''}
                                                    </th>
                                                    <th onClick={() => handleSortClick('name')} style={{ width: '170px', minWidth: '170px', padding: '12px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none', backgroundColor: 'var(--bg-main)', whiteSpace: 'nowrap' }} title="Click to sort by Name">
                                                        Name {userSortField === 'name' ? (userSortOrder === 'asc' ? '▲' : '▼') : ''}
                                                    </th>
                                                    <th onClick={() => handleSortClick('email')} style={{ width: '180px', minWidth: '180px', padding: '12px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none', backgroundColor: 'var(--bg-main)', whiteSpace: 'nowrap' }} title="Click to sort by Email">
                                                        Email {userSortField === 'email' ? (userSortOrder === 'asc' ? '▲' : '▼') : ''}
                                                    </th>
                                                    <th style={{ width: '90px', minWidth: '90px', padding: '12px', textAlign: 'left', fontWeight: 'bold', backgroundColor: 'var(--bg-main)', whiteSpace: 'nowrap' }}>Role</th>
                                                    <th onClick={() => handleSortClick('department')} style={{ width: '130px', minWidth: '130px', padding: '12px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none', backgroundColor: 'var(--bg-main)', whiteSpace: 'nowrap' }} title="Click to sort by Dept">
                                                        Dept {userSortField === 'department' ? (userSortOrder === 'asc' ? '▲' : '▼') : ''}
                                                    </th>
                                                    <th onClick={() => handleSortClick('designation')} style={{ width: '130px', minWidth: '130px', padding: '12px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none', backgroundColor: 'var(--bg-main)', whiteSpace: 'nowrap' }} title="Click to sort by Designation">
                                                        Designation {userSortField === 'designation' ? (userSortOrder === 'asc' ? '▲' : '▼') : ''}
                                                    </th>
                                                    <th onClick={() => handleSortClick('reporting_manager')} style={{ width: '180px', minWidth: '180px', padding: '12px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none', backgroundColor: 'var(--bg-main)', whiteSpace: 'nowrap' }} title="Click to sort by Reporting Manager">
                                                        Reporting Manager {userSortField === 'reporting_manager' ? (userSortOrder === 'asc' ? '▲' : '▼') : ''}
                                                    </th>
                                                    <th style={{ width: '100px', minWidth: '100px', padding: '12px', textAlign: 'center', fontWeight: 'bold', backgroundColor: 'var(--bg-main)', whiteSpace: 'nowrap' }}>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredUsers.map(u => {
                                                    const isActive = String(u.active).toUpperCase() !== 'FALSE';
                                                    return (
                                                        <tr
                                                            key={u.email}
                                                            onClick={() => {
                                                                if (selectedUsers.includes(u.email)) {
                                                                    setSelectedUsers(selectedUsers.filter(e => e !== u.email));
                                                                } else {
                                                                    setSelectedUsers([...selectedUsers, u.email]);
                                                                }
                                                            }}
                                                            style={{
                                                                borderBottom: '1px solid var(--border)',
                                                                cursor: 'pointer',
                                                                backgroundColor: selectedUsers.includes(u.email) ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                                                transition: 'background-color 0.2s'
                                                            }}
                                                        >
                                                            <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>{u.employee_id}</td>
                                                            <td style={{ padding: '12px', fontWeight: 'bold' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                                    <span>{u.name}</span>
                                                                    {isActive ? (
                                                                        <span style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 'normal', whiteSpace: 'nowrap' }}>Active</span>
                                                                    ) : (
                                                                        <span style={{ backgroundColor: '#fee2e2', color: '#ef4444', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 'normal', whiteSpace: 'nowrap' }}>Inactive</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td style={{ padding: '12px', color: 'var(--text-muted)', wordBreak: 'break-all' }}>{u.email}</td>
                                                            <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                                                                <span style={{
                                                                    backgroundColor: u.role === 'Admin' || u.role === 'Superadmin' || u.role === 'Super Admin' ? 'rgba(239, 68, 68, 0.1)' : u.role === 'Viewer' ? 'rgba(168, 85, 247, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                                                    color: u.role === 'Admin' || u.role === 'Superadmin' || u.role === 'Super Admin' ? '#ef4444' : u.role === 'Viewer' ? '#a855f7' : '#3b82f6',
                                                                    padding: '4px 8px',
                                                                    borderRadius: '4px',
                                                                    fontSize: '10px',
                                                                    fontWeight: 'bold',
                                                                    display: 'inline-block'
                                                                }}>
                                                                    {u.role}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{u.department}</td>
                                                            <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{u.designation || '-'}</td>
                                                            <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{getSolverDetails(u.reporting_manager)}</td>
                                                            <td style={{ padding: '12px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openUserModal('edit', u)}
                                                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                                                                        title="Edit User"
                                                                    >
                                                                        <Pencil size={15} color="#3b82f6" />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={async () => {
                                                                            if (window.confirm(`Are you sure you want to reset the password for ${u.email} to the default (Kolkata@123)?`)) {
                                                                                try {
                                                                                    await resetUserPassword({ email: u.email, admin_email: user.email });
                                                                                    alert(`Password for ${u.email} has been reset to Kolkata@123 and first login flag is set.`);
                                                                                    loadSystemData();
                                                                                } catch (err) {
                                                                                    alert(err.response?.data?.error || 'Failed to reset password.');
                                                                                }
                                                                            }
                                                                        }}
                                                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                                                                        title="Reset Password"
                                                                    >
                                                                        <Key size={15} color="#f59e0b" />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={async () => {
                                                                            try {
                                                                                await toggleUserActive({
                                                                                    email: u.email,
                                                                                    active: !isActive,
                                                                                    admin_email: user.email
                                                                                });
                                                                                loadSystemData();
                                                                            } catch (e) {
                                                                                console.error('Failed to toggle active status', e);
                                                                                alert(e.response?.data?.error || 'Failed to update status');
                                                                            }
                                                                        }}
                                                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                                                                        title={isActive ? "Deactivate User" : "Activate User"}
                                                                    >
                                                                        <Power size={15} color={isActive ? "#10b981" : "#ef4444"} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* PROJECTS */}
                            {masterControlTab === 'projects' && (
                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                                    <div style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
                                        <table style={{ width: '100%', minWidth: '350px', borderCollapse: 'collapse', fontSize: '11px' }}>
                                            <thead>
                                                <tr style={{ position: 'sticky', top: 0, zIndex: 5, backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border)' }}>
                                                    <th style={{ width: '100%', padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', backgroundColor: 'var(--bg-main)' }}>Project Name</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {projectsList.filter(p => (p.project_name || '').toLowerCase().includes(locSearchQuery.toLowerCase())).map((proj, idx) => (
                                                    <tr key={idx} onClick={() => {
                                                        if (selectedProjects.includes(proj.project_name)) setSelectedProjects(selectedProjects.filter(p => p !== proj.project_name));
                                                        else setSelectedProjects([...selectedProjects, proj.project_name]);
                                                    }} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', backgroundColor: selectedProjects.includes(proj.project_name) ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }} >
                                                        <td style={{ width: '100%', padding: '12px 16px', fontWeight: '600', color: 'var(--text-muted)', fontSize: '11px' }}>{proj.project_name}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* LOCATIONS */}
                            {masterControlTab === 'locations' && (
                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                                    <div style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
                                        <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', fontSize: '11px' }}>
                                            <thead>
                                                <tr style={{ position: 'sticky', top: 0, zIndex: 5, backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border)' }}>
                                                    <th onClick={() => handleLocSortClick('project')} style={{ width: '30%', minWidth: '160px', padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none', backgroundColor: 'var(--bg-main)', whiteSpace: 'nowrap' }} title="Click to sort by Project">
                                                        Project {locSortField === 'project' ? (locSortOrder === 'asc' ? '▲' : '▼') : ''}
                                                    </th>
                                                    <th onClick={() => handleLocSortClick('tower')} style={{ width: '30%', minWidth: '160px', padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none', backgroundColor: 'var(--bg-main)', whiteSpace: 'nowrap' }} title="Click to sort by Tower">
                                                        Tower {locSortField === 'tower' ? (locSortOrder === 'asc' ? '▲' : '▼') : ''}
                                                    </th>
                                                    <th onClick={() => handleLocSortClick('location')} style={{ width: '40%', minWidth: '220px', padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none', backgroundColor: 'var(--bg-main)', whiteSpace: 'nowrap' }} title="Click to sort by Location">
                                                        Location {locSortField === 'location' ? (locSortOrder === 'asc' ? '▲' : '▼') : ''}
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredLocations.map(loc => (
                                                    <tr key={loc.location} onClick={() => {
                                                        if (selectedMasterLocations.includes(loc.location)) setSelectedMasterLocations(selectedMasterLocations.filter(l => l !== loc.location));
                                                        else setSelectedMasterLocations([...selectedMasterLocations, loc.location]);
                                                    }} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', backgroundColor: selectedMasterLocations.includes(loc.location) ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }} >
                                                        <td style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text-muted)', fontSize: '11px' }}>{loc.project}</td>
                                                        <td style={{ padding: '12px 16px' }}>{loc.tower}</td>
                                                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{loc.location}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* CATEGORIES & DEPARTMENTS */}


                            {/* PROJECTS & DEPARTMENTS */}
                            {masterControlTab === 'projects_dept' && (
                                <div className="master-split-grid" style={{ display: 'flex', flex: 1, gap: '20px', minHeight: 0 }}>
                                    {/* PROJECTS */}
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-main)', fontWeight: '600', color: 'var(--text-muted)', fontSize: '11px' }}>
                                            <span onClick={() => handleDeptSortClick('project')} style={{ cursor: 'pointer', userSelect: 'none' }} title="Click to sort Projects">
                                                Projects {deptSortField === 'project' ? (deptSortOrder === 'asc' ? '▲' : '▼') : ''}
                                            </span>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button className="btn" onClick={() => {
                                                    const p = projectsList.find(proj => proj.project_name === selectedProjects[0]);
                                                    if (p) {
                                                        setProjectFormData({ project: p.project_name });
                                                        setProjectModalMode('edit');
                                                        setIsProjectModalOpen(true);
                                                    }
                                                }} disabled={selectedProjects.length !== 1} style={{ backgroundColor: selectedProjects.length === 1 ? '#3b82f6' : '#93c5fd', padding: '4px 8px', fontSize: '10px', whiteSpace: 'nowrap', minHeight: 'auto', margin: 0, cursor: selectedProjects.length === 1 ? 'pointer' : 'not-allowed' }}>Edit</button>
                                                <button className="btn" onClick={async () => {
                                                    if (window.confirm(`Delete ${selectedProjects.length} selected project(s)?`)) {
                                                        try { await deleteProject(selectedProjects); alert('Deleted successfully'); setSelectedProjects([]); loadSystemData(); }
                                                        catch (e) { alert(e.response?.data?.error || 'Failed'); }
                                                    }
                                                }} disabled={selectedProjects.length === 0} style={{ backgroundColor: selectedProjects.length > 0 ? '#ef4444' : '#fca5a5', padding: '4px 8px', fontSize: '10px', whiteSpace: 'nowrap', minHeight: 'auto', margin: 0, cursor: selectedProjects.length > 0 ? 'pointer' : 'not-allowed' }}>Delete</button>
                                                <button className="btn" onClick={() => { setProjectFormData({ project: '' }); setProjectModalMode('add'); setIsProjectModalOpen(true); }} style={{ backgroundColor: '#10b981', padding: '4px 8px', fontSize: '10px', whiteSpace: 'nowrap', minHeight: 'auto', margin: 0 }}>Add</button>
                                            </div>
                                        </div>
                                        <div style={{ flex: 1, overflowY: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                                <tbody>
                                                    {filteredProjects.map((proj, idx) => (
                                                        <tr key={idx} onClick={() => {
                                                            setSelectedMasterDepartments([]);
                                                            if (selectedProjects.includes(proj.project_name)) setSelectedProjects(selectedProjects.filter(p => p !== proj.project_name));
                                                            else setSelectedProjects([...selectedProjects, proj.project_name]);
                                                        }} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', backgroundColor: selectedProjects.includes(proj.project_name) ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}>
                                                            <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: '500', textAlign: 'center' }}>{proj.project_name}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* DEPARTMENTS */}
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-main)', fontWeight: '600', color: 'var(--text-muted)', fontSize: '11px' }}>
                                            <span onClick={() => handleDeptSortClick('department')} style={{ cursor: 'pointer', userSelect: 'none' }} title="Click to sort Departments">
                                                Departments {deptSortField === 'department' ? (deptSortOrder === 'asc' ? '▲' : '▼') : ''}
                                            </span>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button className="btn" onClick={() => {
                                                    const dept = selectedMasterDepartments[0];
                                                    setDeptModalMode('edit');
                                                    setDeptFormData({ old_department: dept, department: dept });
                                                    setIsDeptModalOpen(true);
                                                }} disabled={selectedMasterDepartments.length !== 1} style={{ backgroundColor: selectedMasterDepartments.length === 1 ? '#3b82f6' : '#93c5fd', padding: '4px 8px', fontSize: '10px', whiteSpace: 'nowrap', minHeight: 'auto', margin: 0, cursor: selectedMasterDepartments.length === 1 ? 'pointer' : 'not-allowed' }}>Edit</button>
                                                <button className="btn" onClick={async () => {
                                                    if (window.confirm(`Delete ${selectedMasterDepartments.length} selected department(s)?`)) {
                                                        try { await deleteDepartment(selectedMasterDepartments); alert('Deleted successfully'); setSelectedMasterDepartments([]); loadSystemData(); }
                                                        catch (e) { alert(e.response?.data?.error || 'Failed'); }
                                                    }
                                                }} disabled={selectedMasterDepartments.length === 0} style={{ backgroundColor: selectedMasterDepartments.length > 0 ? '#ef4444' : '#fca5a5', padding: '4px 8px', fontSize: '10px', whiteSpace: 'nowrap', minHeight: 'auto', margin: 0, cursor: selectedMasterDepartments.length > 0 ? 'pointer' : 'not-allowed' }}>Delete</button>
                                                <button className="btn" onClick={() => { setDeptModalMode('add'); setDeptFormData({ department: '' }); setIsDeptModalOpen(true); }} style={{ backgroundColor: '#10b981', padding: '4px 8px', fontSize: '10px', whiteSpace: 'nowrap', minHeight: 'auto', margin: 0 }}>Add</button>
                                            </div>
                                        </div>
                                        <div style={{ flex: 1, overflowY: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                                <tbody>
                                                    {filteredDepartments.map((dept, i) => {
                                                        const deptName = dept.department || dept.Department || dept['Department'];
                                                        return (
                                                            <tr key={i} onClick={() => {
                                                                setSelectedProjects([]);
                                                                if (selectedMasterDepartments.includes(deptName)) setSelectedMasterDepartments(selectedMasterDepartments.filter(d => d !== deptName));
                                                                else setSelectedMasterDepartments([...selectedMasterDepartments, deptName]);
                                                            }} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', backgroundColor: selectedMasterDepartments.includes(deptName) ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}>
                                                                <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: '500', textAlign: 'center' }}>{deptName}</td>
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* CATEGORIES */}
                            {masterControlTab === 'categories' && (
                                <div className="master-split-grid" style={{ display: 'flex', flex: 1, gap: '20px', minHeight: 0 }}>
                                    {/* ISSUE CATEGORIES */}
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-main)', fontWeight: '600', color: 'var(--text-muted)', fontSize: '11px' }}>
                                            <span onClick={() => handleCatSortClick('issue_category')} style={{ cursor: 'pointer', userSelect: 'none' }} title="Click to sort Issue Categories">
                                                Issue Categories {catSortField === 'issue_category' ? (catSortOrder === 'asc' ? '▲' : '▼') : ''}
                                            </span>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button className="btn" onClick={() => {
                                                    const ic = selectedMasterIssues[0];
                                                    setIssueModalMode('edit');
                                                    setCategoryModalType('issue');
                                                    setIssueFormData({ 'old_Issue Category': ic, 'Issue Category': ic, 'Activity Category': '' });
                                                    setIsIssueModalOpen(true);
                                                }} disabled={selectedMasterIssues.length !== 1} style={{ backgroundColor: selectedMasterIssues.length === 1 ? '#3b82f6' : '#93c5fd', padding: '4px 8px', fontSize: '10px', whiteSpace: 'nowrap', minHeight: 'auto', margin: 0, cursor: selectedMasterIssues.length === 1 ? 'pointer' : 'not-allowed' }}>Edit</button>
                                                <button className="btn" onClick={async () => {
                                                    if (window.confirm(`Delete ${selectedMasterIssues.length} selected issue category(s)?`)) {
                                                        try { await deleteIssueCategory(selectedMasterIssues); alert('Deleted successfully'); setSelectedMasterIssues([]); loadSystemData(); }
                                                        catch (e) { alert(e.response?.data?.error || 'Failed'); }
                                                    }
                                                }} disabled={selectedMasterIssues.length === 0} style={{ backgroundColor: selectedMasterIssues.length > 0 ? '#ef4444' : '#fca5a5', padding: '4px 8px', fontSize: '10px', whiteSpace: 'nowrap', minHeight: 'auto', margin: 0, cursor: selectedMasterIssues.length > 0 ? 'pointer' : 'not-allowed' }}>Delete</button>
                                                <button className="btn" onClick={() => { setIssueModalMode('add'); setCategoryModalType('issue'); setIssueFormData({ 'Issue Category': '', 'Activity Category': '' }); setIsIssueModalOpen(true); }} style={{ backgroundColor: '#10b981', padding: '4px 8px', fontSize: '10px', whiteSpace: 'nowrap', minHeight: 'auto', margin: 0 }}>Add</button>
                                            </div>
                                        </div>
                                        <div style={{ flex: 1, overflowY: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                                <tbody>
                                                    {filteredIssueCategories.map(i => i.issue_category).map((ic, i) => (
                                                        <tr key={i} onClick={() => {
                                                            setSelectedMasterActivities([]);
                                                            if (selectedMasterIssues.includes(ic)) setSelectedMasterIssues(selectedMasterIssues.filter(d => d !== ic));
                                                            else setSelectedMasterIssues([...selectedMasterIssues, ic]);
                                                        }} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', backgroundColor: selectedMasterIssues.includes(ic) ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}>
                                                            <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: '500', textAlign: 'center' }}>{ic}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* ACTIVITY CATEGORIES */}
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-main)', fontWeight: '600', color: 'var(--text-muted)', fontSize: '11px' }}>
                                            <span onClick={() => handleCatSortClick('activity_category')} style={{ cursor: 'pointer', userSelect: 'none' }} title="Click to sort Activity Categories">
                                                Activity Categories {catSortField === 'activity_category' ? (catSortOrder === 'asc' ? '▲' : '▼') : ''}
                                            </span>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button className="btn" onClick={() => {
                                                    const ac = selectedMasterActivities[0];
                                                    setIssueModalMode('edit');
                                                    setCategoryModalType('activity');
                                                    setIssueFormData({ 'old_Activity Category': ac, 'Issue Category': '', 'Activity Category': ac });
                                                    setIsIssueModalOpen(true);
                                                }} disabled={selectedMasterActivities.length !== 1} style={{ backgroundColor: selectedMasterActivities.length === 1 ? '#3b82f6' : '#93c5fd', padding: '4px 8px', fontSize: '10px', whiteSpace: 'nowrap', minHeight: 'auto', margin: 0, cursor: selectedMasterActivities.length === 1 ? 'pointer' : 'not-allowed' }}>Edit</button>
                                                <button className="btn" onClick={async () => {
                                                    if (window.confirm(`Delete ${selectedMasterActivities.length} selected activity category(s)?`)) {
                                                        try { await deleteActivityCategory(selectedMasterActivities); alert('Deleted successfully'); setSelectedMasterActivities([]); loadSystemData(); }
                                                        catch (e) { alert(e.response?.data?.error || 'Failed'); }
                                                    }
                                                }} disabled={selectedMasterActivities.length === 0} style={{ backgroundColor: selectedMasterActivities.length > 0 ? '#ef4444' : '#fca5a5', padding: '4px 8px', fontSize: '10px', whiteSpace: 'nowrap', minHeight: 'auto', margin: 0, cursor: selectedMasterActivities.length > 0 ? 'pointer' : 'not-allowed' }}>Delete</button>
                                                <button className="btn" onClick={() => { setIssueModalMode('add'); setCategoryModalType('activity'); setIssueFormData({ 'Issue Category': '', 'Activity Category': '' }); setIsIssueModalOpen(true); }} style={{ backgroundColor: '#10b981', padding: '4px 8px', fontSize: '10px', whiteSpace: 'nowrap', minHeight: 'auto', margin: 0 }}>Add</button>
                                            </div>
                                        </div>
                                        <div style={{ flex: 1, overflowY: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                                <tbody>
                                                    {filteredActivityCategories.map(i => i.activity_category).map((ac, i) => (
                                                        <tr key={i} onClick={() => {
                                                            setSelectedMasterIssues([]);
                                                            if (selectedMasterActivities.includes(ac)) setSelectedMasterActivities(selectedMasterActivities.filter(d => d !== ac));
                                                            else setSelectedMasterActivities([...selectedMasterActivities, ac]);
                                                        }} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', backgroundColor: selectedMasterActivities.includes(ac) ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}>
                                                            <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: '500', textAlign: 'center' }}>{ac}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* CANNED RESPONSES MANAGEMENT */}
                            {masterControlTab === 'canned_responses' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <h3 style={{ margin: '0 0 4px 0', fontSize: '15px' }}>⚡ Master Canned Response Templates</h3>
                                            <p style={{ margin: 0, fontSize: '11px', color: '#a1a1aa' }}>Manage global and user-created quick response remarks across the system.</p>
                                        </div>
                                    </div>

                                    <div className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border)' }}>
                                        <div className="table-responsive" style={{ maxHeight: '550px', overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
                                            <table className="data-table" style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', fontSize: '11px' }}>
                                                <thead>
                                                    <tr style={{ position: 'sticky', top: 0, zIndex: 5, backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border)' }}>
                                                        <th onClick={() => handleCannedSortClick('id')} style={{ padding: '10px 12px', textAlign: 'center', width: '60px', minWidth: '60px', cursor: 'pointer', userSelect: 'none', backgroundColor: 'var(--bg-main)', whiteSpace: 'nowrap' }} title="Click to sort by ID">
                                                            ID {cannedSortField === 'id' ? (cannedSortOrder === 'asc' ? '▲' : '▼') : ''}
                                                        </th>
                                                        <th onClick={() => handleCannedSortClick('label')} style={{ padding: '10px 12px', textAlign: 'left', width: '200px', minWidth: '200px', cursor: 'pointer', userSelect: 'none', backgroundColor: 'var(--bg-main)', whiteSpace: 'nowrap' }} title="Click to sort by Title">
                                                            Template Title / Label {cannedSortField === 'label' ? (cannedSortOrder === 'asc' ? '▲' : '▼') : ''}
                                                        </th>
                                                        <th onClick={() => handleCannedSortClick('text')} style={{ padding: '10px 12px', textAlign: 'left', minWidth: '250px', cursor: 'pointer', userSelect: 'none', backgroundColor: 'var(--bg-main)', whiteSpace: 'nowrap' }} title="Click to sort by Content">
                                                            Response Content Text {cannedSortField === 'text' ? (cannedSortOrder === 'asc' ? '▲' : '▼') : ''}
                                                        </th>
                                                        <th onClick={() => handleCannedSortClick('created_by')} style={{ padding: '10px 12px', textAlign: 'left', width: '160px', minWidth: '160px', cursor: 'pointer', userSelect: 'none', backgroundColor: 'var(--bg-main)', whiteSpace: 'nowrap' }} title="Click to sort by Owner">
                                                            Created By / Owner {cannedSortField === 'created_by' ? (cannedSortOrder === 'asc' ? '▲' : '▼') : ''}
                                                        </th>
                                                        <th onClick={() => handleCannedSortClick('is_custom')} style={{ padding: '10px 12px', textAlign: 'center', width: '120px', minWidth: '120px', cursor: 'pointer', userSelect: 'none', backgroundColor: 'var(--bg-main)', whiteSpace: 'nowrap' }} title="Click to sort by Scope">
                                                            Scope / Type {cannedSortField === 'is_custom' ? (cannedSortOrder === 'asc' ? '▲' : '▼') : ''}
                                                        </th>
                                                        <th style={{ padding: '10px 12px', textAlign: 'center', width: '100px', minWidth: '100px', backgroundColor: 'var(--bg-main)', whiteSpace: 'nowrap' }}>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(() => {
                                                        const query = String(cannedSearchQuery || '').trim().toLowerCase();
                                                        let filtered = cannedResponsesList.filter(tpl =>
                                                            !query ||
                                                            (tpl.label || '').toLowerCase().includes(query) ||
                                                            (tpl.text || '').toLowerCase().includes(query) ||
                                                            (tpl.created_by || '').toLowerCase().includes(query)
                                                        );

                                                        if (cannedSortField) {
                                                            filtered = [...filtered].sort((a, b) => {
                                                                let valA = a[cannedSortField];
                                                                let valB = b[cannedSortField];
                                                                if (cannedSortField === 'id') {
                                                                    valA = Number(valA || 0);
                                                                    valB = Number(valB || 0);
                                                                } else if (typeof valA === 'boolean') {
                                                                    valA = valA ? 1 : 0;
                                                                    valB = valB ? 1 : 0;
                                                                } else {
                                                                    valA = String(valA || '').toLowerCase();
                                                                    valB = String(valB || '').toLowerCase();
                                                                }
                                                                if (valA < valB) return cannedSortOrder === 'asc' ? -1 : 1;
                                                                if (valA > valB) return cannedSortOrder === 'asc' ? 1 : -1;
                                                                return 0;
                                                            });
                                                        }

                                                        if (filtered.length === 0) {
                                                            return (
                                                                <tr>
                                                                    <td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                                        No canned responses found. Click "+ Add Template" to create one.
                                                                    </td>
                                                                </tr>
                                                            );
                                                        }

                                                        return filtered.map((tpl, idx) => (
                                                            <tr key={tpl.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                                                <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 'bold', color: '#71717a' }}>{tpl.id ? `#${tpl.id}` : '-'}</td>
                                                                <td style={{ padding: '10px 12px', fontWeight: 'bold', color: 'var(--text-main)' }}>
                                                                    {tpl.label}
                                                                </td>
                                                                <td style={{ padding: '10px 12px', color: '#a1a1aa', maxWidth: '350px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                                    {tpl.text}
                                                                </td>
                                                                <td style={{ padding: '10px 12px' }}>
                                                                    <span style={{ fontSize: '10px', color: '#3b82f6', fontWeight: '500' }}>
                                                                        👤 {tpl.created_by || 'System Default'}
                                                                    </span>
                                                                </td>
                                                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                                                    <span style={{
                                                                        fontSize: '9px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '10px',
                                                                        backgroundColor: tpl.is_custom ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)',
                                                                        color: tpl.is_custom ? '#f59e0b' : '#3b82f6'
                                                                    }}>
                                                                        {tpl.is_custom ? 'User Custom' : 'System Default'}
                                                                    </span>
                                                                </td>
                                                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setCannedModalMode('edit');
                                                                                setCannedFormData({
                                                                                    id: tpl.id,
                                                                                    label: tpl.label || '',
                                                                                    text: tpl.text || '',
                                                                                    created_by: tpl.created_by || '',
                                                                                    category: tpl.category || ''
                                                                                });
                                                                                setIsCannedModalOpen(true);
                                                                            }}
                                                                            title="Edit template"
                                                                            style={{ backgroundColor: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: 'none', padding: '4px 6px', borderRadius: '4px', cursor: 'pointer' }}
                                                                        >
                                                                            <Pencil size={12} />
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={async () => {
                                                                                if (window.confirm(`Delete canned template "${tpl.label}"?`)) {
                                                                                    try {
                                                                                        await deleteCannedResponse(tpl.id);
                                                                                        loadSystemData();
                                                                                    } catch (err) {
                                                                                        alert(err.response?.data?.error || 'Failed to delete canned template');
                                                                                    }
                                                                                }
                                                                            }}
                                                                            title="Delete template"
                                                                            style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', padding: '4px 6px', borderRadius: '4px', cursor: 'pointer' }}
                                                                        >
                                                                            <Trash2 size={12} />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ));
                                                    })()}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* BULK IMPORT */}
                            {masterControlTab === 'import' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div style={{ marginBottom: '10px' }}>
                                        <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>Bulk Data Import</h3>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#a1a1aa' }}>Download the required templates, populate your data, and upload the Excel (.xlsx) files below.</p>
                                    </div>

                                    {/* Import Tabs Sub-Navigation */}
                                    <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '12px', flexWrap: 'wrap' }}>
                                        {['users', 'locations', 'departments', 'issue_categories', 'activity_categories'].map(tab => (
                                            <button key={tab} className={`btn ${activeImportTab === tab ? 'force-white-text' : ''}`} style={{ backgroundColor: activeImportTab === tab ? '#3b82f6' : 'transparent', border: activeImportTab === tab ? 'none' : '1px solid #cbd5e1', fontSize: '11px', padding: '6px 16px', color: activeImportTab === tab ? '#fff' : '#475569' }} onClick={() => { setActiveImportTab(tab); setImportError(''); setImportSuccess(''); setImportFile(null); setImportValidationErrors([]); }}>
                                                {tab.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="card" style={{ maxWidth: '800px', padding: '24px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                                            <div>
                                                <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', textTransform: 'capitalize' }}>Import {activeImportTab.replace('_', ' ')}</h4>
                                                <p style={{ margin: 0, fontSize: '10px', color: '#71717a' }}>Ensure your Excel file follows the exact template structure.</p>
                                            </div>
                                            <a
                                                href={getImportTemplateUrl(activeImportTab)}
                                                className="btn force-white-text"
                                                style={{ backgroundColor: '#10b981', border: 'none', fontSize: '11px', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                                                download
                                            >
                                                <Download size={14} /> Download Template
                                            </a>
                                        </div>

                                        {importSuccess && <div style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '12px', borderRadius: '4px', marginBottom: '16px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14} /> {importSuccess}</div>}
                                        {importError && <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '12px', borderRadius: '4px', marginBottom: '16px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={14} /> {importError}</div>}

                                        {importValidationErrors.length > 0 && (
                                            <div style={{ backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '6px', padding: '16px', marginBottom: '20px' }}>
                                                <h5 style={{ margin: '0 0 12px 0', color: '#be123c', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={14} /> Validation Errors ({importValidationErrors.length})</h5>
                                                <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                                        <thead style={{ position: 'sticky', top: 0, backgroundColor: '#fecdd3' }}>
                                                            <tr>
                                                                <th style={{ padding: '6px 12px', textAlign: 'left', color: '#881337', fontWeight: 'bold', width: '70px' }}>Row</th>
                                                                <th style={{ padding: '6px 12px', textAlign: 'left', color: '#881337', fontWeight: 'bold', width: '160px' }}>Column</th>
                                                                <th style={{ padding: '6px 12px', textAlign: 'left', color: '#881337', fontWeight: 'bold' }}>Error Details</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {importValidationErrors.map((err, idx) => (
                                                                <tr key={idx} style={{ borderBottom: '1px solid #fecdd3' }}>
                                                                    <td style={{ padding: '6px 12px', color: '#be123c', fontWeight: '600' }}>Row {err.row}</td>
                                                                    <td style={{ padding: '6px 12px', color: '#be123c', fontWeight: '500' }}>{err.column || 'General'}</td>
                                                                    <td style={{ padding: '6px 12px', color: '#be123c' }}>{err.error}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        <div style={{ border: '2px dashed #cbd5e1', borderRadius: '8px', padding: '30px', textAlign: 'center', backgroundColor: 'var(--bg-main)' }}>
                                            <input
                                                type="file"
                                                accept=".xlsx"
                                                id="importUpload"
                                                style={{ display: 'none' }}
                                                onChange={(e) => {
                                                    if (e.target.files && e.target.files.length > 0) {
                                                        setImportFile(e.target.files[0]);
                                                        setImportError('');
                                                    }
                                                }}
                                            />
                                            <label htmlFor="importUpload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                                                <FileText size={32} color="#94a3b8" />
                                                <span style={{ fontSize: '13px', color: '#475569', fontWeight: '500' }}>{importFile ? importFile.name : 'Click to select .xlsx file'}</span>
                                            </label>
                                        </div>

                                        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                                            <button
                                                className="btn force-white-text"
                                                disabled={!importFile || isUploading}
                                                onClick={async () => {
                                                    setIsUploading(true);
                                                    setImportError('');
                                                    setImportSuccess('');
                                                    setImportValidationErrors([]);
                                                    try {
                                                        const res = await uploadImportFile(activeImportTab, importFile);
                                                        if (res.errors && res.errors.length > 0) {
                                                            setImportValidationErrors(res.errors);
                                                            if (res.success_count > 0) {
                                                                setImportSuccess(`Import partially completed. ${res.success_count} rows inserted successfully, but there were some errors.`);
                                                            } else {
                                                                setImportError("Import completed with errors. No rows were inserted.");
                                                            }
                                                        } else {
                                                            setImportSuccess(res.message || "Import successful!");
                                                        }
                                                        setImportFile(null);
                                                        document.getElementById('importUpload').value = '';
                                                        loadSystemData();
                                                    } catch (e) {
                                                        setImportError(e.response?.data?.error || "An error occurred during import.");
                                                    } finally {
                                                        setIsUploading(false);
                                                    }
                                                }}
                                                style={{ backgroundColor: !importFile || isUploading ? '#94a3b8' : '#3b82f6', color: '#fff', padding: '8px 24px', fontSize: '13px', border: 'none', cursor: !importFile || isUploading ? 'not-allowed' : 'pointer' }}
                                            >
                                                {isUploading ? 'Uploading...' : 'Upload & Import'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    )}
                </div>

                {/* MODALS */}
                {(isUserModalOpen || isLocModalOpen || isDeptModalOpen || isIssueModalOpen || isProjectModalOpen || isForceReassignModalOpen) && (
                    <div className="glass-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

                        {/* USER MODAL */}
                        {isUserModalOpen && (
                            <div className="glass-modal" style={{ padding: '20px', borderRadius: '6px', width: '480px', maxWidth: '90%' }}>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>{userModalMode === 'add' ? 'Register New Employee' : 'Edit Employee Details'}</h3>
                                <form onSubmit={handleUserSubmit}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                        <input type="text" className="form-control" required placeholder="Employee ID" value={userFormData.employee_id || ''} onChange={e => setUserFormData({ ...userFormData, employee_id: e.target.value })} style={{ fontSize: '11px', padding: '8px' }} />
                                        <input type="email" className="form-control" required placeholder="Email Address" value={userFormData.email || ''} onChange={e => setUserFormData({ ...userFormData, email: e.target.value })} style={{ fontSize: '11px', padding: '8px' }} />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                        <input type="text" className="form-control" required placeholder="Full Name" value={userFormData.name} onChange={e => setUserFormData({ ...userFormData, name: e.target.value })} style={{ fontSize: '11px', padding: '8px' }} />
                                        <input
                                            type="text"
                                            className="form-control"
                                            required
                                            placeholder="Phone Number (10 digits)"
                                            maxLength={10}
                                            pattern="[0-9]{10}"
                                            title="Please enter a valid 10-digit mobile number"
                                            value={userFormData.phone || ''}
                                            onChange={e => {
                                                const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
                                                setUserFormData({ ...userFormData, phone: digitsOnly });
                                            }}
                                            style={{ fontSize: '11px', padding: '8px' }}
                                        />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                        <select
                                            className="form-control"
                                            required
                                            disabled={userFormData.role === 'Superadmin' || userFormData.role === 'Super Admin'}
                                            value={userFormData.role}
                                            onChange={e => {
                                                const newRole = e.target.value;
                                                // Clear viewer settings if role is not User
                                                if (newRole !== 'User') {
                                                    setUserFormData({ ...userFormData, role: newRole, secondary_roles: '', viewer_locations: '' });
                                                } else {
                                                    setUserFormData({ ...userFormData, role: newRole });
                                                }
                                            }}
                                            style={{ fontSize: '11px', padding: '8px' }}
                                        >
                                            <option value="" disabled>Select Role</option>
                                            <option value="User">User</option>
                                            {(user.role === 'Superadmin' || user.role === 'Super Admin') && (
                                                <option value="Admin">Admin</option>
                                            )}
                                            {(userFormData.role === 'Superadmin' || userFormData.role === 'Super Admin') && (
                                                <option value={userFormData.role}>{userFormData.role}</option>
                                            )}
                                        </select>
                                        <SearchableDropdown
                                            options={departmentsList.map(d => d.department || d.department_name || d.Department || d['Department']).filter(Boolean)}
                                            value={userFormData.department}
                                            onChange={(val) => setUserFormData({ ...userFormData, department: val })}
                                            placeholder="Select Department"
                                        />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                        <input type="text" className="form-control" placeholder="Designation" value={userFormData.designation || ''} onChange={e => setUserFormData({ ...userFormData, designation: e.target.value })} style={{ fontSize: '11px', padding: '8px' }} />
                                        <SearchableDropdown
                                            options={[
                                                { value: '', label: '🚫 No Manager (None)' },
                                                ...usersList.filter(u => {
                                                    if (u.employee_id && userFormData.employee_id && String(u.employee_id).trim() === String(userFormData.employee_id).trim()) return false;
                                                    const uDept = (u.department || u.department_name || u.Department || '').toString().trim().toLowerCase();
                                                    // CXO department users can be reporting manager across any department
                                                    if (uDept === 'cxo') return true;
                                                    if (userFormData.reporting_manager && String(u.employee_id).trim() === String(userFormData.reporting_manager).trim()) return true;
                                                    if (userFormData.department) {
                                                        const selDept = userFormData.department.toString().trim().toLowerCase();
                                                        return uDept === selDept;
                                                    }
                                                    return true;
                                                }).map(u => {
                                                    const uDept = (u.department || u.department_name || u.Department || '').toString().trim().toLowerCase();
                                                    const selDept = (userFormData.department || '').toString().trim().toLowerCase();
                                                    const isCrossCxo = uDept === 'cxo' && selDept !== 'cxo';
                                                    return {
                                                        value: u.employee_id,
                                                        label: `${getSolverDetails(u.employee_id)}${isCrossCxo ? ' [CXO]' : ''}`
                                                    };
                                                })
                                            ]}
                                            value={userFormData.reporting_manager || ''}
                                            onChange={(val) => setUserFormData({ ...userFormData, reporting_manager: val })}
                                            placeholder="Select Reporting Manager (Optional)"
                                        />
                                    </div>

                                    {/* VIEWER PRIVILEGES & LOCATION ASSIGNMENT - STRICTLY FOR 'User' ROLE ONLY */}
                                    {userFormData.role === 'User' && (
                                        <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-main, #18181b)', border: '1px solid var(--border)', borderRadius: '6px', marginBottom: '12px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main)' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={(userFormData.secondary_roles || '').split(',').map(s => s.trim()).includes('Viewer')}
                                                    onChange={e => {
                                                        const isChecked = e.target.checked;
                                                        let sec = (userFormData.secondary_roles || '').split(',').map(s => s.trim()).filter(Boolean);
                                                        if (isChecked) {
                                                            if (!sec.includes('Viewer')) sec.push('Viewer');
                                                            setUserFormData({ ...userFormData, secondary_roles: sec.join(','), viewer_locations: userFormData.viewer_locations || 'ALL' });
                                                        } else {
                                                            sec = sec.filter(r => r !== 'Viewer');
                                                            setUserFormData({ ...userFormData, secondary_roles: sec.join(','), viewer_locations: '' });
                                                        }
                                                    }}
                                                    style={{ cursor: 'pointer' }}
                                                />
                                                <span>Enable Viewer Dashboard & Analytics Rights</span>
                                            </label>

                                            {((userFormData.secondary_roles || '').split(',').map(s => s.trim()).includes('Viewer')) && (
                                                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Assigned Locations for Viewer Access:</span>
                                                        <label style={{ fontSize: '10px', color: '#3b82f6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={(userFormData.viewer_locations || '').trim().toUpperCase() === 'ALL'}
                                                                onChange={e => {
                                                                    setUserFormData({ ...userFormData, viewer_locations: e.target.checked ? 'ALL' : '' });
                                                                }}
                                                            />
                                                            All Locations (Global)
                                                        </label>
                                                    </div>

                                                    {((userFormData.viewer_locations || '').trim().toUpperCase() !== 'ALL' && (userFormData.viewer_locations || '').trim() !== '') && (
                                                        <div style={{ fontSize: '10px', color: '#10b981', marginBottom: '8px', wordBreak: 'break-word' }}>
                                                            Selected: {userFormData.viewer_locations}
                                                        </div>
                                                    )}

                                                    {((userFormData.viewer_locations || '').trim().toUpperCase() !== 'ALL') && (
                                                        <div>
                                                            {/* PROJECT FILTER DROPDOWN */}
                                                            <div style={{ marginBottom: '8px' }}>
                                                                <select
                                                                    className="form-control"
                                                                    value={viewerSelectedProject}
                                                                    onChange={e => setViewerSelectedProject(e.target.value)}
                                                                    style={{ fontSize: '10px', padding: '6px 8px', width: '100%' }}
                                                                >
                                                                    <option value="">-- Filter by Project --</option>
                                                                    {Array.from(new Set(locationsList.map(l => l.project).filter(Boolean))).sort().map(p => (
                                                                        <option key={p} value={p}>{p}</option>
                                                                    ))}
                                                                </select>
                                                            </div>

                                                            {/* SELECT ALL LOCATIONS FOR SELECTED PROJECT / GLOBAL */}
                                                            {viewerSelectedProject && (
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', padding: '0 2px' }}>
                                                                    {(() => {
                                                                        const projLocs = locationsList.filter(l => l.project === viewerSelectedProject).map(l => l.location);
                                                                        const currentLocs = (userFormData.viewer_locations || '').split(',').map(l => l.trim()).filter(Boolean);
                                                                        const areAllSelected = projLocs.length > 0 && projLocs.every(l => currentLocs.includes(l));
                                                                        return (
                                                                            <label style={{ fontSize: '10px', color: '#60a5fa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={areAllSelected}
                                                                                    onChange={e => {
                                                                                        let updated = [...currentLocs];
                                                                                        if (e.target.checked) {
                                                                                            projLocs.forEach(pl => { if (!updated.includes(pl)) updated.push(pl); });
                                                                                        } else {
                                                                                            updated = updated.filter(l => !projLocs.includes(l));
                                                                                        }
                                                                                        setUserFormData({ ...userFormData, viewer_locations: updated.join(', ') });
                                                                                    }}
                                                                                />
                                                                                Select All {viewerSelectedProject} Locations ({projLocs.length})
                                                                            </label>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            )}

                                                            {/* LOCATIONS LIST */}
                                                            <div style={{ maxHeight: '120px', overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '6px', backgroundColor: 'var(--bg-card)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                                                                {(() => {
                                                                    const displayedLocs = viewerSelectedProject
                                                                        ? locationsList.filter(l => l.project === viewerSelectedProject)
                                                                        : locationsList;

                                                                    if (displayedLocs.length === 0) {
                                                                        return <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>No locations found.</div>;
                                                                    }

                                                                    return displayedLocs.map(loc => {
                                                                        const locName = loc.location;
                                                                        const currentLocs = (userFormData.viewer_locations || '').split(',').map(l => l.trim()).filter(Boolean);
                                                                        const isSelected = currentLocs.includes(locName);
                                                                        return (
                                                                            <button
                                                                                key={locName}
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    let updated;
                                                                                    if (isSelected) {
                                                                                        updated = currentLocs.filter(l => l !== locName);
                                                                                    } else {
                                                                                        updated = [...currentLocs, locName];
                                                                                    }
                                                                                    setUserFormData({ ...userFormData, viewer_locations: updated.join(', ') });
                                                                                }}
                                                                                style={{
                                                                                    fontSize: '9.5px',
                                                                                    padding: '2px 8px',
                                                                                    borderRadius: '4px',
                                                                                    border: isSelected ? '1px solid #3b82f6' : '1px solid var(--border)',
                                                                                    backgroundColor: isSelected ? 'rgba(59,130,246,0.2)' : 'transparent',
                                                                                    color: isSelected ? '#60a5fa' : 'var(--text-muted)',
                                                                                    cursor: 'pointer'
                                                                                }}
                                                                            >
                                                                                {isSelected ? '✓ ' : '+ '}{locName}
                                                                            </button>
                                                                        );
                                                                    });
                                                                })()}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                                        <button type="button" className="btn" onClick={() => setIsUserModalOpen(false)} style={{ backgroundColor: 'transparent', border: '1px solid #3f3f46', fontSize: '11px', padding: '6px 10px' }}>Cancel</button>
                                        <button type="submit" className="btn" style={{ backgroundColor: '#3b82f6', fontSize: '11px', padding: '6px 10px' }}>Save</button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* PROJECT MODAL */}
                        {isProjectModalOpen && (
                            <div className="glass-modal" style={{ padding: '20px', borderRadius: '6px', width: '400px', maxWidth: '90%' }}>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>{projectModalMode === 'add' ? 'Register New Project' : 'Edit Project Details'}</h3>
                                <form onSubmit={async (e) => {
                                    e.preventDefault();
                                    const payload = { project_name: projectFormData.project, admin_email: user?.email };
                                    try {
                                        if (projectModalMode === 'add') {
                                            await createProject(payload);
                                            alert('Project added successfully.');
                                        } else {
                                            await updateProject({ ...payload, old_project_name: selectedProjects[0], admin_email: user?.email });
                                            alert('Project updated successfully.');
                                            setSelectedProjects([]);
                                        }
                                        setIsProjectModalOpen(false);
                                        loadSystemData();
                                    } catch (err) { alert(err.response?.data?.error || "Failed to save project."); }
                                }}>
                                    <input type="text" className="form-control" required placeholder="Project Name" value={projectFormData.project} onChange={e => setProjectFormData({ project: e.target.value })} style={{ marginBottom: '12px', fontSize: '11px', padding: '8px' }} />
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                        <button type="button" className="btn" onClick={() => setIsProjectModalOpen(false)} style={{ backgroundColor: 'transparent', border: '1px solid #3f3f46', fontSize: '11px', padding: '6px 10px' }}>Cancel</button>
                                        <button type="submit" className="btn" style={{ backgroundColor: '#3b82f6', fontSize: '11px', padding: '6px 10px' }}>Save</button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* LOCATION MODAL */}
                        {isLocModalOpen && (
                            <div className="glass-modal" style={{ padding: '20px', borderRadius: '6px', width: '400px', maxWidth: '90%' }}>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>{locModalMode === 'add' ? 'Register New Location' : 'Edit Location Details'}</h3>
                                <form onSubmit={async (e) => {
                                    e.preventDefault();
                                    const autoLocation = `${(locFormData.project || '').trim()}-${(locFormData.tower || '').trim()}`;
                                    const payload = { ...locFormData, location: autoLocation, admin_email: user?.email };
                                    try {
                                        if (locModalMode === 'add') { await createLocation(payload); alert('Location added successfully.'); }
                                        else { await updateLocation({ ...payload, old_location: locFormData.location, admin_email: user?.email }); alert('Location updated successfully.'); }
                                        setIsLocModalOpen(false); setSelectedMasterLocations([]); loadSystemData();
                                    } catch (err) { alert(err.response?.data?.error || "Failed to save location."); }
                                }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                        <select className="form-control" required value={locFormData.project} onChange={e => setLocFormData({ ...locFormData, project: e.target.value })} style={{ fontSize: '11px', padding: '8px' }}>
                                            <option value="" disabled>Select Project</option>
                                            {projectsList.map((proj, i) => (
                                                <option key={i} value={proj.project_name}>{proj.project_name}</option>
                                            ))}
                                        </select>
                                        <input type="text" className="form-control" required placeholder="Tower" value={locFormData.tower} onChange={e => setLocFormData({ ...locFormData, tower: e.target.value })} style={{ fontSize: '11px', padding: '8px' }} />
                                    </div>
                                    <input type="text" className="form-control" disabled placeholder="Location Details (Auto-generated)" value={`${(locFormData.project || '').trim()}${(locFormData.project || '').trim() && (locFormData.tower || '').trim() ? '-' : ''}${(locFormData.tower || '').trim()}`} style={{ marginBottom: '12px', fontSize: '11px', padding: '8px', backgroundColor: 'var(--bg-main)', color: '#a1a1aa' }} />
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                        <button type="button" className="btn" onClick={() => setIsLocModalOpen(false)} style={{ backgroundColor: 'transparent', border: '1px solid #3f3f46', fontSize: '11px', padding: '6px 10px' }}>Cancel</button>
                                        <button type="submit" className="btn" style={{ backgroundColor: '#3b82f6', fontSize: '11px', padding: '6px 10px' }}>Save</button>
                                    </div>
                                </form>
                            </div>
                        )}


                        {/* DEPARTMENT MODAL */}
                        {isDeptModalOpen && (
                            <div className="glass-modal" style={{ padding: '20px', borderRadius: '6px', width: '400px', maxWidth: '90%' }}>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>{deptModalMode === 'add' ? 'Register New Department' : 'Edit Department'}</h3>
                                <form onSubmit={async (e) => {
                                    e.preventDefault();
                                    try {
                                        if (deptModalMode === 'add') { await createDepartment({ ...deptFormData, admin_email: user?.email }); alert('Department added successfully.'); }
                                        else { await updateDepartment({ ...deptFormData, admin_email: user?.email }); alert('Department updated successfully.'); }
                                        setIsDeptModalOpen(false); setSelectedMasterDepartments([]); loadSystemData();
                                    } catch (err) { alert(err.response?.data?.error || "Failed to save department."); }
                                }}>
                                    <input type="text" className="form-control" required placeholder="Department Name" value={deptFormData.department} onChange={e => setDeptFormData({ ...deptFormData, department: e.target.value })} style={{ marginBottom: '12px', fontSize: '11px', padding: '8px' }} />
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                        <button type="button" className="btn" onClick={() => setIsDeptModalOpen(false)} style={{ backgroundColor: 'transparent', border: '1px solid #3f3f46', fontSize: '11px', padding: '6px 10px' }}>Cancel</button>
                                        <button type="submit" className="btn" style={{ backgroundColor: '#3b82f6', fontSize: '11px', padding: '6px 10px' }}>Save</button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* CATEGORY MODAL */}
                        {isIssueModalOpen && (
                            <div className="glass-modal" style={{ padding: '20px', borderRadius: '6px', width: '400px', maxWidth: '90%' }}>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>{issueModalMode === 'add' ? `Add New ${categoryModalType === 'issue' ? 'Issue' : categoryModalType === 'activity' ? 'Activity' : ''} Category` : 'Edit Category'}</h3>
                                <form onSubmit={async (e) => {
                                    e.preventDefault();
                                    if (!issueFormData['Issue Category'] && !issueFormData['Activity Category']) {
                                        alert('Please provide at least an Issue Category or an Activity Category.');
                                        return;
                                    }
                                    try {
                                        if (issueModalMode === 'add') { if (categoryModalType === 'issue') { await createIssueCategory({ issue_name: issueFormData['Issue Category'], admin_email: user?.email }); } else { await createActivityCategory({ activity_name: issueFormData['Activity Category'], admin_email: user?.email }); } alert('Category added successfully.'); }
                                        else { if (categoryModalType === 'issue') { await updateIssueCategory({ old_issue_name: issueFormData['old_Issue Category'], issue_name: issueFormData['Issue Category'], admin_email: user?.email }); } else { await updateActivityCategory({ old_activity_name: issueFormData['old_Activity Category'], activity_name: issueFormData['Activity Category'], admin_email: user?.email }); } alert('Category updated successfully.'); }
                                        setIsIssueModalOpen(false); setSelectedMasterIssues([]); setSelectedMasterActivities([]); loadSystemData();
                                    } catch (err) { alert(err.response?.data?.error || "Failed to save category."); }
                                }}>
                                    <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '16px', lineHeight: '1.4' }}>Fill in the {categoryModalType === 'issue' ? 'Issue' : categoryModalType === 'activity' ? 'Activity' : ''} category you want to add.</p>
                                    {categoryModalType === 'issue' && (
                                        <input type="text" className="form-control" required placeholder="Issue Category Name" value={issueFormData['Issue Category']} onChange={e => setIssueFormData({ ...issueFormData, 'Issue Category': e.target.value })} style={{ marginBottom: '12px', fontSize: '13px', padding: '8px' }} />
                                    )}
                                    {categoryModalType === 'activity' && (
                                        <input type="text" className="form-control" required placeholder="Activity Category Name" value={issueFormData['Activity Category']} onChange={e => setIssueFormData({ ...issueFormData, 'Activity Category': e.target.value })} style={{ marginBottom: '12px', fontSize: '13px', padding: '8px' }} />
                                    )}
                                    {categoryModalType === 'both' && (
                                        <>
                                            <input type="text" className="form-control" placeholder="Issue Category" value={issueFormData['Issue Category']} onChange={e => setIssueFormData({ ...issueFormData, 'Issue Category': e.target.value })} style={{ marginBottom: '12px', fontSize: '13px', padding: '8px' }} />
                                            <input type="text" className="form-control" placeholder="Activity Category" value={issueFormData['Activity Category']} onChange={e => setIssueFormData({ ...issueFormData, 'Activity Category': e.target.value })} style={{ marginBottom: '12px', fontSize: '13px', padding: '8px' }} />
                                        </>
                                    )}
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                        <button type="button" className="btn" onClick={() => setIsIssueModalOpen(false)} style={{ backgroundColor: 'transparent', border: '1px solid #cbd5e1', color: 'var(--text-muted)', fontSize: '13px', padding: '6px 10px' }}>Cancel</button>
                                        <button type="submit" className="btn" style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', fontSize: '13px', padding: '6px 12px', borderRadius: '4px' }}>Save</button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* FORCE REASSIGN MODAL */}
                        {isForceReassignModalOpen && reassignTicketObj && (
                            <div className="glass-modal" style={{ padding: '20px', borderRadius: '8px', width: '450px', maxWidth: '90%' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
                                    <h3 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                                        <UserCheck size={18} color="#3b82f6" /> Force Reassign Ticket #{reassignTicketObj.ticket_id}
                                    </h3>
                                    <button onClick={() => setIsForceReassignModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
                                </div>
                                <form onSubmit={handleForceReassignSubmit}>
                                    <div style={{ marginBottom: '12px' }}>
                                        <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block', fontWeight: 'bold' }}>Current Solver</label>
                                        <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-main)', borderRadius: '6px', fontSize: '11px', color: 'var(--text-main)', border: '1px solid var(--border)' }}>
                                            {formatSolverDetails(reassignTicketObj.assigned_to)}
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: '12px' }}>
                                        <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block', fontWeight: 'bold' }}>Target Department</label>
                                        <select
                                            className="form-control"
                                            style={{ fontSize: '11px', padding: '8px' }}
                                            value={reassignDept}
                                            onChange={(e) => {
                                                setReassignDept(e.target.value);
                                                setReassignTarget('');
                                            }}
                                            required
                                        >
                                            <option value="">Select Department...</option>
                                            {departmentsList.map(d => (
                                                <option key={d.department || d} value={d.department || d}>{d.department || d}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div style={{ marginBottom: '12px' }}>
                                        <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block', fontWeight: 'bold' }}>Target Solver (Active Only)</label>
                                        <select
                                            className="form-control"
                                            style={{ fontSize: '11px', padding: '8px' }}
                                            value={reassignTarget}
                                            onChange={(e) => setReassignTarget(e.target.value)}
                                            required
                                            disabled={!reassignDept}
                                        >
                                            <option value="">{reassignDept ? 'Select Active Solver...' : 'Select Department First'}</option>
                                            {reassignSolverOptions.map(u => (
                                                <option key={u.employee_id || u.email} value={u.employee_id || u.email}>
                                                    {u.name} ({u.employee_id}) — {u.designation || u.role}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div style={{ marginBottom: '16px' }}>
                                        <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block', fontWeight: 'bold' }}>Reason for Force Reassignment</label>
                                        <textarea
                                            className="form-control"
                                            rows="3"
                                            placeholder="Reason (e.g. Current solver deactivated or unavailable)..."
                                            value={reassignReason}
                                            onChange={(e) => setReassignReason(e.target.value)}
                                            style={{ fontSize: '11px', padding: '8px', width: '100%', resize: 'vertical' }}
                                        ></textarea>
                                    </div>

                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                        <button type="button" className="btn" onClick={() => setIsForceReassignModalOpen(false)} style={{ backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '11px', padding: '6px 12px' }}>Cancel</button>
                                        <button type="submit" className="btn badge-primary force-white-text" style={{ fontSize: '11px', padding: '6px 14px', color: '#ffffff', backgroundColor: '#2563eb', border: '1px solid #2563eb' }}>
                                            <span style={{ color: '#ffffff', fontWeight: '600' }}>Force Reassign</span>
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

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
            {selectedTicket && (
                <div className="ticket-details-panel slide-in-right-panel" style={{
                    position: 'fixed',
                    top: isSidePanelExpanded ? '2vh' : '52px',
                    bottom: isSidePanelExpanded ? '2vh' : '0',
                    right: isSidePanelExpanded ? 'max(5vw, calc(50% - 700px))' : '0',
                    width: isSidePanelExpanded ? 'min(90vw, 1400px)' : '450px',
                    margin: 0, borderLeft: '1px solid var(--border, #cbd5e1)', display: 'flex', flexDirection: 'column',
                    zIndex: isSidePanelExpanded ? 1050 : 900,
                    borderRadius: isSidePanelExpanded ? '12px' : 0,
                    backgroundColor: 'var(--bg-card)',
                    backdropFilter: 'var(--glass-blur)',
                    WebkitBackdropFilter: 'var(--glass-blur)',
                    transform: 'translateZ(0)',
                    boxShadow: isSidePanelExpanded ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)' : 'none',
                    transition: 'top 0.9s cubic-bezier(0.4, 0, 0.2, 1), right 0.9s cubic-bezier(0.4, 0, 0.2, 1), width 0.9s cubic-bezier(0.4, 0, 0.2, 1), bottom 0.9s cubic-bezier(0.4, 0, 0.2, 1), border-radius 0.9s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.9s cubic-bezier(0.4, 0, 0.2, 1)'
                }}>
                    <div style={{ padding: '24px 24px 0 24px', zIndex: 10, borderBottom: '1px solid var(--border, #cbd5e1)', background: 'transparent' }}>
                        <div className="side-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div className="side-panel-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <h3 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    #{selectedTicket.ticket_id}
                                    <span style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold' }}>{selectedTicket.status}</span>
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
                                    style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--text-main)', borderRadius: '4px', cursor: 'pointer' }}
                                    title="Download Timeline (CSV)"
                                >
                                    <Download size={12} /> Download Timeline (CSV)
                                </button>
                                {['Open', 'In Progress'].includes(String(selectedTicket?.status || '').trim()) && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openForceReassignModal(selectedTicket);
                                        }}
                                        className="btn force-white-text"
                                        style={{
                                            padding: '5px 12px',
                                            fontSize: '11px',
                                            fontWeight: '600',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            backgroundColor: '#6366f1',
                                            color: '#ffffff',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            boxShadow: '0 1px 3px rgba(99, 102, 241, 0.3)',
                                            transition: 'all 0.15s ease',
                                            letterSpacing: '0.2px'
                                        }}
                                        onMouseOver={(e) => {
                                            e.currentTarget.style.backgroundColor = '#4f46e5';
                                            e.currentTarget.style.boxShadow = '0 2px 6px rgba(99, 102, 241, 0.45)';
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.backgroundColor = '#6366f1';
                                            e.currentTarget.style.boxShadow = '0 1px 3px rgba(99, 102, 241, 0.3)';
                                        }}
                                        title="Force Reassign Ticket"
                                    >
                                        <UserCheck size={13} color="#ffffff" strokeWidth={2.2} />
                                        <span style={{ color: '#ffffff', fontWeight: '600' }}>Force Reassign</span>
                                    </button>
                                )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button onClick={() => setIsSidePanelExpanded(!isSidePanelExpanded)} style={{ background: 'none', border: 'none', color: 'var(--text-main, #0f172a)', fontSize: '16px', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={isSidePanelExpanded ? "Collapse" : "Expand"}>
                                    {isSidePanelExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                                </button>
                                <button onClick={() => { setSelectedTicket(null); setIsSidePanelExpanded(false); }} style={{ background: 'none', border: 'none', color: 'var(--text-main, #0f172a)', fontSize: '16px', cursor: 'pointer', padding: '4px' }}>✕</button>
                            </div>
                        </div>
                        <div style={{ display: 'flex' }}>
                            <button onClick={() => setActiveDetailsTab('details')} style={{ flex: 1, padding: '10px 4px', fontSize: '13px', fontWeight: '600', backgroundColor: 'transparent', color: activeDetailsTab === 'details' ? '#3b82f6' : 'var(--text-main, #0f172a)', border: 'none', borderBottom: activeDetailsTab === 'details' ? '2px solid #3b82f6' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '-1px' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><FileText size={14} /> Details</div></button>
                            <button onClick={() => setActiveDetailsTab('timeline')} style={{ flex: 1, padding: '10px 4px', fontSize: '13px', fontWeight: '600', backgroundColor: 'transparent', color: activeDetailsTab === 'timeline' ? '#3b82f6' : 'var(--text-main, #0f172a)', border: 'none', borderBottom: activeDetailsTab === 'timeline' ? '2px solid #3b82f6' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '-1px' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Clock size={14} /> Timeline</div></button>
                            <button onClick={() => setActiveDetailsTab('chat')} style={{ flex: 1, padding: '10px 4px', fontSize: '13px', fontWeight: '600', backgroundColor: 'transparent', color: activeDetailsTab === 'chat' ? '#3b82f6' : 'var(--text-main, #0f172a)', border: 'none', borderBottom: activeDetailsTab === 'chat' ? '2px solid #3b82f6' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '-1px' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><MessageSquare size={14} /> Chat</div></button>
                        </div>
                    </div>
                    <div className="ticket-details-panel-body" style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', touchAction: 'pan-y', padding: '24px', zIndex: 10, display: 'flex', flexDirection: 'column', background: 'transparent' }}>

                        {activeDetailsTab === 'details' && (
                            <div style={{ paddingBottom: '20px' }}>
                                <div className="ticket-info-grid" style={{ display: 'grid', gridTemplateColumns: isSidePanelExpanded ? 'repeat(4, 1fr)' : '1fr 1fr', gap: '14px', fontSize: '13px', color: '#71717a', marginBottom: '16px' }}>
                                    <div><strong style={{ color: 'var(--text-main)' }}>Raised On:</strong> <span style={{ color: '#a1a1aa' }}>{selectedTicket.timestamp?.split(' ')[0]}</span></div>
                                    {selectedTicket.deadline ? <div><strong style={{ color: 'var(--text-main)' }}>Deadline:</strong> <span style={{ color: 'var(--text-muted)' }}>{selectedTicket.deadline?.split(' ')[0]}</span></div> : <div></div>}
                                    <div><strong style={{ color: 'var(--text-main)' }}>Current Raiser:</strong> <span style={{ color: 'var(--text-muted)' }}>{selectedTicket.raiser_name || selectedTicket.raised_by}</span></div>
                                    <div><strong style={{ color: 'var(--text-main)' }}>Raiser Desig:</strong> <span style={{ color: '#a1a1aa' }}>{usersList.find(u => String(u.employee_id) === String(selectedTicket.raised_by) || String(u.email) === String(selectedTicket.raised_by) || (selectedTicket.raiser_name && `${u.name} (${u.phone_number || u.phone || 'N/A'})` === String(selectedTicket.raiser_name)))?.designation || '-'}</span></div>
                                    <div><strong style={{ color: 'var(--text-main)' }}>Assigned To:</strong> <span style={{ color: 'var(--text-muted)' }}>{getSolverDetails(selectedTicket.assigned_to)}</span></div>
                                    <div><strong style={{ color: 'var(--text-main)' }}>Solver Desig:</strong> <span style={{ color: '#a1a1aa' }}>{usersList.find(u => String(u.employee_id) === String(selectedTicket.assigned_to) || String(u.email) === String(selectedTicket.assigned_to) || `${u.name} (${u.phone_number || u.phone || 'N/A'})` === String(selectedTicket.assigned_to))?.designation || '-'}</span></div>
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
                                        <span style={{ color: '#a1a1aa', whiteSpace: 'pre-wrap', display: 'block', wordBreak: 'break-word' }}>
                                            {selectedTicket.description}
                                        </span>
                                    </div>
                                    {selectedTicket.attachment && String(selectedTicket.attachment).toLowerCase() !== 'nan' && (
                                        <div style={{ flexShrink: 0, minWidth: '130px', maxWidth: '200px' }}>
                                            <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '8px', fontSize: '13px' }}>Attached File:</strong>
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
                                                            onClick={() => window.open(fileUrl, '_blank')}
                                                        >
                                                            <img src={fileUrl} alt="Attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px', backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '8px', textAlign: 'center' }}>Click to enlarge</div>
                                                        </div>
                                                    );
                                                }
                                                if (isPdf) {
                                                    return (
                                                        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-filter" style={{ display: 'inline-block', fontSize: '11px', padding: '6px 10px', textDecoration: 'none', color: '#ef4444', fontWeight: 'bold', wordBreak: 'break-word' }} title={`Open ${attachStr} in new tab`}>
                                                            📄 {attachStr}
                                                        </a>
                                                    );
                                                }
                                                return (
                                                    <a href={fileUrl} download={attachStr} target="_blank" rel="noopener noreferrer" className="btn btn-filter" style={{ display: 'inline-block', fontSize: '11px', padding: '6px 10px', textDecoration: 'none', color: '#2563eb', fontWeight: 'bold', wordBreak: 'break-word' }} title={`Download ${attachStr}`}>
                                                        ⬇ {attachStr}
                                                    </a>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

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
                                                    <div className="chat-bubble-text" style={{ fontSize: '13px', lineHeight: '1.4' }}>{log.remarks || log.details}</div>
                                                    <div className="chat-bubble-time" style={{ fontSize: '11px', marginTop: '6px', textAlign: isSystem ? 'center' : 'right' }}>{log.timestamp}</div>
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

                    {/* DEPARTMENT MODAL */}
                    {isDeptModalOpen && (
                        <div className="glass-modal" style={{ padding: '20px', borderRadius: '6px', width: '400px', maxWidth: '90%' }}>
                            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>{deptModalMode === 'add' ? 'Register New Department' : 'Edit Department'}</h3>
                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                try {
                                    if (deptModalMode === 'add') { await createDepartment(deptFormData); alert('Department added successfully.'); }
                                    else { await updateDepartment(deptFormData); alert('Department updated successfully.'); }
                                    setIsDeptModalOpen(false); setSelectedMasterDepartments([]); loadSystemData();
                                } catch (err) { alert(err.response?.data?.error || "Failed to save department."); }
                            }}>
                                <input type="text" className="form-control" required placeholder="Department Name" value={deptFormData.department} onChange={e => setDeptFormData({ ...deptFormData, department: e.target.value })} style={{ marginBottom: '12px', fontSize: '11px', padding: '8px' }} />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                    <button type="button" className="btn" onClick={() => setIsDeptModalOpen(false)} style={{ backgroundColor: 'transparent', border: '1px solid #3f3f46', fontSize: '11px', padding: '6px 10px' }}>Cancel</button>
                                    <button type="submit" className="btn" style={{ backgroundColor: '#3b82f6', fontSize: '11px', padding: '6px 10px' }}>Save</button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* ISSUE CATEGORY MODAL */}
                    {isIssueModalOpen && (
                        <div className="glass-modal" style={{ padding: '20px', borderRadius: '6px', width: '400px', maxWidth: '90%' }}>
                            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>{issueModalMode === 'add' ? 'Register New Issue & Category' : 'Edit Issue & Category'}</h3>
                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                try {
                                    if (issueModalMode === 'add') { if (categoryModalType === 'issue') { await createIssueCategory({ issue_name: issueFormData['Issue Category'] }); } else { await createActivityCategory({ activity_name: issueFormData['Activity Category'] }); } alert('Issue Category added successfully.'); }
                                    else { if (categoryModalType === 'issue') { await updateIssueCategory({ old_issue_name: issueFormData['old_Issue Category'], issue_name: issueFormData['Issue Category'] }); } else { await updateActivityCategory({ old_activity_name: issueFormData['old_Activity Category'], activity_name: issueFormData['Activity Category'] }); } alert('Issue Category updated successfully.'); }
                                    setIsIssueModalOpen(false); setSelectedMasterIssues([]); setSelectedMasterActivities([]); loadSystemData();
                                } catch (err) { alert(err.response?.data?.error || "Failed to save issue category."); }
                            }}>
                                <input type="text" className="form-control" required placeholder="Issue Category" value={issueFormData['Issue Category']} onChange={e => setIssueFormData({ ...issueFormData, 'Issue Category': e.target.value })} style={{ marginBottom: '12px', fontSize: '11px', padding: '8px' }} />
                                <input type="text" className="form-control" required placeholder="Activity Category" value={issueFormData['Activity Category']} onChange={e => setIssueFormData({ ...issueFormData, 'Activity Category': e.target.value })} style={{ marginBottom: '12px', fontSize: '11px', padding: '8px' }} />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                    <button type="button" className="btn" onClick={() => setIsIssueModalOpen(false)} style={{ backgroundColor: 'transparent', border: '1px solid #3f3f46', fontSize: '11px', padding: '6px 10px' }}>Cancel</button>
                                    <button type="submit" className="btn" style={{ backgroundColor: '#3b82f6', fontSize: '11px', padding: '6px 10px' }}>Save</button>
                                </div>
                            </form>
                        </div>
                    )}

                </div>
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
                                <input type="text" className="form-control" style={{ fontSize: '13px', padding: '8px' }} placeholder="Filter by ID, Dept, Status..." value={tempFilters.search} onChange={e => setTempFilters({ ...tempFilters, search: e.target.value })} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Department</label>
                                    <select className="form-control" style={{ fontSize: '13px', padding: '8px' }} value={tempFilters.dept} onChange={e => setTempFilters({ ...tempFilters, dept: e.target.value })}>
                                        <option value="">All Depts</option>
                                        {[...new Set(ageingData.map(a => a.dept_assigned).filter(Boolean))].sort().map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Status</label>
                                    <select className="form-control" style={{ fontSize: '13px', padding: '8px' }} value={tempFilters.status} onChange={e => setTempFilters({ ...tempFilters, status: e.target.value })}>
                                        <option value="">All Statuses</option>
                                        {[...new Set(ageingData.map(a => a.status).filter(Boolean))].sort().map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Location</label>
                                    <select className="form-control" style={{ fontSize: '13px', padding: '8px' }} value={tempFilters.location} onChange={e => setTempFilters({ ...tempFilters, location: e.target.value })}>
                                        <option value="">All Locations</option>
                                        {[...new Set(ageingData.map(a => a.location).filter(Boolean))].sort().map(l => <option key={l} value={l}>{l}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Issue Category</label>
                                    <select className="form-control" style={{ fontSize: '13px', padding: '8px' }} value={tempFilters.issueCat} onChange={e => setTempFilters({ ...tempFilters, issueCat: e.target.value })}>
                                        <option value="">All Issue Cats</option>
                                        {[...new Set(ageingData.map(a => a.issue_category).filter(Boolean))].sort().map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Escalation Level</label>
                                    <select className="form-control" style={{ fontSize: '13px', padding: '8px' }} value={tempFilters.level} onChange={e => setTempFilters({ ...tempFilters, level: e.target.value })}>
                                        <option value="">All Levels</option>
                                        {[...new Set(ageingData.map(a => a.escalation_level).filter(Boolean))].sort().map(l => <option key={l} value={l}>{l}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Severity</label>
                                    <select className="form-control" style={{ fontSize: '13px', padding: '8px' }} value={tempFilters.severity} onChange={e => setTempFilters({ ...tempFilters, severity: e.target.value })}>
                                        <option value="">All Severities</option>
                                        {[...new Set(ageingData.map(a => a.severity).filter(Boolean))].sort().map(s => <option key={s} value={s}>{s}</option>)}
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

            {/* CANNED RESPONSE MODAL */}
            {isCannedModalOpen && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
                    <div className="card" style={{ width: '500px', padding: '24px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>{cannedModalMode === 'add' ? 'Add New Canned Template' : 'Edit Canned Template'}</h3>
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            try {
                                if (cannedModalMode === 'add') {
                                    await createCannedResponse(cannedFormData);
                                } else {
                                    await updateCannedResponse(cannedFormData.id, cannedFormData);
                                }
                                setIsCannedModalOpen(false);
                                loadSystemData();
                            } catch (err) {
                                alert(err.response?.data?.error || 'Failed to save canned response');
                            }
                        }}>
                            <div className="form-group" style={{ marginBottom: '12px' }}>
                                <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Owner / Created By</label>
                                <SearchableDropdown
                                    options={ownerOptions}
                                    value={cannedFormData.created_by || 'System Default'}
                                    onChange={val => setCannedFormData({ ...cannedFormData, created_by: val })}
                                    placeholder="Select Owner / Created By..."
                                    placement="bottom"
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: '12px' }}>
                                <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Template Title / Label</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    required
                                    placeholder="e.g. Issue Resolved & Tested"
                                    value={cannedFormData.label}
                                    onChange={e => setCannedFormData({ ...cannedFormData, label: e.target.value })}
                                    style={{ width: '100%', padding: '8px', fontSize: '11px' }}
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: '16px' }}>
                                <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Response Text</label>
                                <textarea
                                    className="form-control"
                                    required
                                    rows="4"
                                    placeholder="Enter the quick response text..."
                                    value={cannedFormData.text}
                                    onChange={e => setCannedFormData({ ...cannedFormData, text: e.target.value })}
                                    style={{ width: '100%', padding: '8px', fontSize: '11px', resize: 'vertical' }}
                                ></textarea>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                <button type="button" className="btn" onClick={() => setIsCannedModalOpen(false)} style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border)' }}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{cannedModalMode === 'add' ? 'Create Template' : 'Save Changes'}</button>
                            </div>
                        </form>
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

export default SuperAdminDashboard;