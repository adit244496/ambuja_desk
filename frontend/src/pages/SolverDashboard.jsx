import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api, { fetchTickets, updateTicketStatus, fetchUsers, fetchDepartments, fetchTicketLogs, requestTicketHandover, escalateTicketL1 } from '../api';
import Layout from '../components/Layout';
import { MessageSquare, Zap, CheckCircle, Star, ArrowUpRight, FileText, Clock, Activity, PlusCircle, RefreshCw, UserPlus, ImagePlus, Check, Filter, ChevronDown, ChevronUp, Paperclip, Maximize2, Minimize2, Download, Calendar, Users } from 'lucide-react';
import DocumentPreview from '../components/DocumentPreview';
import AttachmentBadge from '../components/AttachmentBadge';
import SLACountdownBadge from '../components/SLACountdownBadge';
import CannedResponseSelector from '../components/CannedResponseSelector';
import { getISTDate, getISTMinDatetime, getISTTomorrowDate, parseDateToTimestamp } from '../utils/dateUtils';

// --- Expandable Description Component ---
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

// --- CUSTOM SINGLE SELECT SEARCH DROPDOWN ---
const SearchSelect = ({ options = [], value, onChange, placeholder, disabled = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');

    const displayValue = useMemo(() => {
        if (!value) return '';
        const found = options.find(o => typeof o === 'object' ? String(o.value) === String(value) : String(o) === String(value));
        return found ? (typeof found === 'object' ? found.label : found) : value;
    }, [options, value]);

    const filtered = options.filter(o => {
        const text = typeof o === 'object' ? o.label : o;
        return text && (!search || String(text).toLowerCase().includes(String(search).toLowerCase()));
    });

    return (
        <div style={{ position: 'relative', zIndex: isOpen ? 1000 : 1 }}>
            <input
                type="text"
                className="form-control"
                disabled={disabled}
                placeholder={placeholder}
                value={isOpen ? search : displayValue}
                onChange={e => { setSearch(e.target.value); setIsOpen(true); }}
                onFocus={() => { if (!disabled) { setIsOpen(true); setSearch(''); } }}
                onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                style={{ padding: '8px 12px', fontSize: '11px', borderBottomLeftRadius: isOpen ? 0 : 4, borderBottomRightRadius: isOpen ? 0 : 4, backgroundColor: disabled ? 'rgba(255,255,255,0.05)' : undefined }}
            />
            {isOpen && !disabled && (
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
                            const lbl = typeof opt === 'object' ? opt.label : opt;
                            const val = typeof opt === 'object' ? opt.value : opt;
                            return (
                                <div
                                    key={idx}
                                    onMouseDown={(e) => { e.preventDefault(); onChange(val); setIsOpen(false); }}
                                    style={{ padding: '8px 12px', fontSize: '11px', cursor: 'pointer', color: 'var(--text-main)', borderBottom: '1px solid var(--border)' }}
                                    onMouseOver={e => { e.currentTarget.style.backgroundColor = 'var(--primary)'; e.currentTarget.style.color = '#fff'; }}
                                    onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-main)'; }}
                                >
                                    {lbl}
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};

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

const SolverDashboard = ({ user, setUser }) => {
    const location = useLocation();
    const navigate = useNavigate();
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
    const [tickets, setTickets] = useState([]);
    const [usersList, setUsersList] = useState([]);
    const [departments, setDepartments] = useState([]);

    const [activeTab, setActiveTab] = useState('active_tasks');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

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
        const params = new URLSearchParams(location.search);
        const ticketId = params.get('ticket_id');
        if (ticketId && tickets.length > 0) {
            const ticket = tickets.find(t => String(t.ticket_id) === String(ticketId));
            if (ticket) {
                setActiveTab('active_tasks');
                handleTicketClick(ticket);
                navigate(location.pathname, { replace: true });
            }
        }
    }, [location.search, tickets]);

    const [ticketLogs, setTicketLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [activeDetailsTab, setActiveDetailsTab] = useState('details');
    const [chatInput, setChatInput] = useState('');

    const [updateForms, setUpdateForms] = useState({});

    // Handover Modal State
    const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);
    const [handoverDept, setHandoverDept] = useState('');
    const [handoverTarget, setHandoverTarget] = useState('');
    const [handoverReason, setHandoverReason] = useState('');

    // Extend Deadline Modal State
    const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
    const [extendDeadlineDate, setExtendDeadlineDate] = useState('');

    // Escalate Modal State
    const [isEscalateModalOpen, setIsEscalateModalOpen] = useState(false);
    const [showKPIs, setShowKPIs] = useState(true);
    const [escalateDept, setEscalateDept] = useState('');
    const [escalateTarget, setEscalateTarget] = useState('');
    const [escalateReason, setEscalateReason] = useState('');
    const [escalateAttachment, setEscalateAttachment] = useState(null);
    const [escalateFileName, setEscalateFileName] = useState('');
    const [escalateDeadline, setEscalateDeadline] = useState('');
    const [isEscalatingImage, setIsEscalatingImage] = useState(false);
    const [smartEscalationSuggestions, setSmartEscalationSuggestions] = useState(null);
    const [topEscalationOptions, setTopEscalationOptions] = useState([]);
    const [smartHandoverSuggestions, setSmartHandoverSuggestions] = useState(null);

    useEffect(() => {
        if (isEscalateModalOpen && selectedTicket?.description) {
            api.post('/tickets/smart_suggest', {
                query: selectedTicket.description,
                current_solver_emp_id: selectedTicket.assigned_to
            })
                .then(res => {
                    if (res.data) {
                        setSmartEscalationSuggestions(res.data.suggested_categories || null);
                        const rawOptions = res.data.top_escalation_options || [];
                        const filtered = rawOptions.map(opt => {
                            const solverId = String(opt.solver_emp_id || opt.solver_email || '').trim().toLowerCase();
                            const isRestricted = restrictedUserIdentifiers.has(solverId) ||
                                (opt.solver_emp_id && restrictedUserIdentifiers.has(String(opt.solver_emp_id).toLowerCase())) ||
                                (opt.solver_email && restrictedUserIdentifiers.has(String(opt.solver_email).toLowerCase()));
                            if (isRestricted) {
                                return { ...opt, solver_emp_id: '', solver_email: '', solver_name: '' };
                            }
                            return opt;
                        });
                        setTopEscalationOptions(filtered);
                    }
                })
                .catch(err => console.error("Escalation smart suggest error:", err));
        } else {
            setSmartEscalationSuggestions(null);
            setTopEscalationOptions([]);
        }
    }, [isEscalateModalOpen, selectedTicket, restrictedUserIdentifiers]);

    useEffect(() => {
        if (isHandoverModalOpen && selectedTicket?.description) {
            api.post('/tickets/smart_suggest', {
                query: selectedTicket.description,
                current_solver_emp_id: selectedTicket.assigned_to
            })
                .then(res => {
                    if (res.data) {
                        const cats = res.data.suggested_categories;
                        if (cats && cats.assigned_to) {
                            const solverId = String(cats.assigned_to).trim().toLowerCase();
                            if (restrictedUserIdentifiers.has(solverId)) {
                                cats.assigned_to = '';
                            }
                        }
                        setSmartHandoverSuggestions(cats || null);
                    }
                })
                .catch(err => console.error("Handover smart suggest error:", err));
        } else {
            setSmartHandoverSuggestions(null);
        }
    }, [isHandoverModalOpen, selectedTicket, restrictedUserIdentifiers]);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            const [ticketData, usersData, deptData] = await Promise.all([fetchTickets(true), fetchUsers(), fetchDepartments()]);
            setDepartments(Array.isArray(deptData) ? deptData : []);
            let safeTickets = ticketData?.data || ticketData;
            if (typeof safeTickets === 'string') safeTickets = JSON.parse(safeTickets);
            setTickets(Array.isArray(safeTickets) ? safeTickets : []);
            setUsersList(usersData);
        } catch (err) {
            setError("Failed to load dashboard data.");
        } finally {
            setLoading(false);
        }
    };

    const handleTicketClick = async (ticket) => {
        setSelectedTicket(ticket);
        setActiveDetailsTab('details');
        setLogsLoading(true);
        setUpdateForms(prev => ({ ...prev, [ticket.ticket_id]: { status: ticket.status, remarks: '' } }));

        try {
            const logs = await fetchTicketLogs(ticket.ticket_id);
            setTicketLogs(logs);
        } catch (err) {
            setTicketLogs([]);
        } finally {
            setLogsLoading(false);
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
            alert("Failed to send message.");
        }
    };

    const handleStatusUpdate = async (e, ticketId, currentStatus, currentRemarks) => {
        e.preventDefault();
        const formState = updateForms[ticketId] || {};

        // Map currentStatus to a valid dropdown option if it's not one already
        const validOptions = ['In Progress', 'Resolved', 'Decline', 'On Hold'];
        const defaultStatus = validOptions.includes(currentStatus) ? currentStatus : 'In Progress';

        const newStatus = formState.status !== undefined ? formState.status : defaultStatus;
        const remarks = formState.remarks !== undefined ? formState.remarks : (currentRemarks || '');

        const attachment = formState.attachment;
        const newDeadline = formState.deadline;

        if ((newStatus === 'Decline' || newStatus === 'On Hold') && !remarks.trim()) {
            alert(`Remarks are mandatory when setting a ticket to ${newStatus}.`);
            return;
        }

        const formData = new FormData();
        formData.append('ticket_id', ticketId);
        formData.append('escalation_level', selectedTicket.escalation_level || 'L1');
        formData.append('status', newStatus);
        formData.append('remarks', remarks);
        if (attachment) formData.append('attachment', attachment);
        if (newDeadline) {
            const dtObj = new Date(newDeadline);
            const formattedDeadline = `${String(dtObj.getDate()).padStart(2, '0')}-${String(dtObj.getMonth() + 1).padStart(2, '0')}-${dtObj.getFullYear()} 23:59`;
            formData.append('new_deadline', formattedDeadline);
        }

        try {
            await updateTicketStatus(formData);
            alert("Ticket updated successfully!");

            // Clear input fields so they don't persist next time
            setUpdateForms(prev => ({
                ...prev,
                [ticketId]: { status: newStatus, remarks: '', attachment: null, deadline: '' }
            }));

            setSelectedTicket(null);
            loadDashboardData();
        } catch (err) {
            alert("Failed to update ticket.");
        }
    };

    const submitHandoverRequest = async (e) => {
        e.preventDefault();
        if (!handoverTarget || !handoverReason.trim()) {
            alert("Please provide both a target user and a reason.");
            return;
        }

        try {
            await requestTicketHandover({ ticket_id: selectedTicket.ticket_id, escalation_level: selectedTicket.escalation_level || 'L1', target_email: handoverTarget, reason: handoverReason });
            alert("Handover requested successfully. Waiting for admin approval.");
            setIsHandoverModalOpen(false);
            setHandoverTarget('');
            setHandoverReason('');
            setSelectedTicket(null);
            loadDashboardData();
        } catch (err) {
            alert(err.response?.data?.error || "Failed to request handover.");
        }
    };

    const submitExtendDeadlineRequest = async (e) => {
        e.preventDefault();
        if (!extendDeadlineDate) {
            alert("Please select a new deadline.");
            return;
        }

        const currentRemarks = updateForms[selectedTicket.ticket_id]?.remarks || '';
        if (!currentRemarks.trim()) {
            alert("Please provide a reason for extension in the Remarks field.");
            setIsExtendModalOpen(false);
            return;
        }
        try {
            const formData = new FormData();
            formData.append('ticket_id', selectedTicket.ticket_id);
            formData.append('status', 'In Progress');
            formData.append('remarks', currentRemarks);
            formData.append('escalation_level', selectedTicket.escalation_level || 'L1');
            const dParts = extendDeadlineDate.split('-');
            let formattedDeadline = extendDeadlineDate;
            if (dParts.length === 3 && dParts[0].length === 4) {
                formattedDeadline = `${dParts[2]}-${dParts[1]}-${dParts[0]} 23:59`;
            } else if (!extendDeadlineDate.includes(' ')) {
                formattedDeadline = `${extendDeadlineDate} 23:59`;
            }
            formData.append('new_deadline', formattedDeadline);

            await updateTicketStatus(formData);
            alert("Deadline extended successfully.");
            setIsExtendModalOpen(false);
            setExtendDeadlineDate('');

            // Clear the form remarks after success
            setUpdateForms(prev => ({
                ...prev,
                [selectedTicket.ticket_id]: { ...prev[selectedTicket.ticket_id], remarks: '' }
            }));

            loadDashboardData();
        } catch (error) {
            console.error("Extend Deadline Error:", error);
            alert(error.response?.data?.error || "Failed to extend deadline.");
        }
    };

    const handleEscalateFileChange = async (e) => {
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
            e.target.value = ''; setEscalateAttachment(null); setEscalateFileName('');
            return;
        }

        const MAX_IMG_KB = 20;
        const MAX_IMG_BYTES = MAX_IMG_KB * 1024;

        if (file.type === 'application/pdf' || file.name.match(/\.(xlsx|xls|doc|docx|pdf)$/i)) {
            const MAX_DOC_MB = 5;
            const MAX_DOC_BYTES = MAX_DOC_MB * 1024 * 1024;
            if (file.size > MAX_DOC_BYTES) {
                alert(`Document file must be under ${MAX_DOC_MB}MB.`);
                e.target.value = ''; setEscalateAttachment(null); setEscalateFileName('');
                return;
            }
            setEscalateFileName(file.name);
            setEscalateAttachment(file);
            if (file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')) {
                window.open(URL.createObjectURL(file), '_blank');
            }
            return;
        }

        setEscalateFileName(file.name);
        setIsEscalatingImage(true);
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
                                setEscalateAttachment(compressedFile);
                                setIsEscalatingImage(false);
                            }
                        }, 'image/jpeg', quality);
                    };
                    attemptCompression();
                };
            };
        } catch (err) {
            alert("Failed to process image.");
            e.target.value = ''; setEscalateAttachment(null); setEscalateFileName(''); setIsEscalatingImage(false);
        }
    };

    const submitEscalateRequest = async (e) => {
        e.preventDefault();
        if (!escalateDept || !escalateTarget || !escalateReason.trim()) {
            alert("Please provide department, target user, and a reason.");
            return;
        }

        try {
            const formData = new FormData();
            formData.append('ticket_id', selectedTicket.ticket_id);
            formData.append('escalation_level', selectedTicket.escalation_level || 'L1');
            formData.append('new_dept', escalateDept);
            formData.append('new_solver', escalateTarget);
            formData.append('reason', escalateReason);

            if (escalateAttachment) {
                formData.append('attachment', escalateAttachment);
            }

            if (escalateDeadline) {

                const dtObj = new Date(escalateDeadline);
                const formattedDeadline = `${String(dtObj.getDate()).padStart(2, '0')}-${String(dtObj.getMonth() + 1).padStart(2, '0')}-${dtObj.getFullYear()} 23:59`;
                formData.append('new_deadline', formattedDeadline);
            }

            await escalateTicketL1(formData);
            alert("Ticket escalated successfully.");
            setIsEscalateModalOpen(false);
            setEscalateDept('');
            setEscalateTarget('');
            setEscalateReason('');
            setEscalateAttachment(null);
            setEscalateFileName('');
            setSelectedTicket(null);
            loadDashboardData();
        } catch (err) {
            alert(err.response?.data?.error || "Failed to escalate ticket.");
        }
    };

    const handleAcceptEscalation = async () => {
        const remarks = window.prompt("Optional remarks for accepting (or leave blank):") || '';
        try {
            const currLvl = selectedTicket.escalation_level || 'L1';
            const childLvl = 'L' + (parseInt(currLvl.replace('L', '')) + 1);
            await api.post('/tickets/accept_escalation', { ticket_id: selectedTicket.ticket_id, parent_lvl: currLvl, child_lvl: childLvl, remarks: remarks });
            alert("Resolution accepted. Ticket is now back in your Active Tasks queue.");
            setSelectedTicket(null);
            loadDashboardData();
        } catch (err) { alert("Failed to accept"); }
    };

    const handleRejectEscalation = async () => {
        const remarks = window.prompt("Reason for rejecting the resolution:");
        if (remarks === null) return;
        if (!remarks.trim()) { alert("Reason is required."); return; }
        try {
            const currLvl = selectedTicket.escalation_level || 'L1';
            const childLvl = 'L' + (parseInt(currLvl.replace('L', '')) + 1);
            await api.post('/tickets/reject_escalation', { ticket_id: selectedTicket.ticket_id, parent_lvl: currLvl, child_lvl: childLvl, remarks: remarks });
            alert("Resolution rejected. Returned to escalated solver.");
            setSelectedTicket(null);
            loadDashboardData();
        } catch (err) { alert("Failed to reject"); }
    };

    const handleUpdateFormChange = (ticketId, field, value) => {
        setUpdateForms(prev => ({ ...prev, [ticketId]: { ...prev[ticketId] || {}, [field]: value } }));
    };

    const getSolverDetails = (solverId) => {
        if (!solverId || String(solverId).toLowerCase() === 'nan' || solverId === 'Unassigned') return 'Unassigned';
        const solver = usersList.find(u => String(u.employee_id) === String(solverId) || String(u.email) === String(solverId));
        if (solver) return `${solver.name} (${solver.phone_number || solver.phone || 'N/A'})`;
        return solverId;
    };

    const uniqueDepts = (Array.isArray(departments) && departments.length > 0) ? departments.map(d => d.department) : [...new Set((usersList || []).map(u => u.department).filter(Boolean))];

    const restrictedUserIdentifiers = useMemo(() => {
        if (!selectedTicket || !selectedTicket.ticket_id) return new Set();
        const restricted = new Set();
        const relatedTickets = tickets.filter(t => String(t.ticket_id) === String(selectedTicket.ticket_id));
        const rawList = [];
        relatedTickets.forEach(t => {
            if (t.raised_by) rawList.push(String(t.raised_by));
            if (t.assigned_to) rawList.push(String(t.assigned_to));
            if (t.original_raiser) rawList.push(String(t.original_raiser));
        });
        if (selectedTicket.raised_by) rawList.push(String(selectedTicket.raised_by));
        if (selectedTicket.assigned_to) rawList.push(String(selectedTicket.assigned_to));
        if (selectedTicket.original_raiser) rawList.push(String(selectedTicket.original_raiser));

        rawList.forEach(val => {
            const strVal = String(val).trim();
            if (strVal && !['nan', 'none', '', 'unassigned'].includes(strVal.toLowerCase())) {
                restricted.add(strVal.toLowerCase());
                const u = usersList.find(usr => String(usr.employee_id) === strVal || String(usr.email).toLowerCase() === strVal.toLowerCase());
                if (u) {
                    if (u.employee_id) restricted.add(String(u.employee_id).toLowerCase());
                    if (u.email) restricted.add(String(u.email).toLowerCase());
                }
            }
        });
        return restricted;
    }, [tickets, selectedTicket, usersList]);

    const handoverSolverOptions = useMemo(() => {
        if (!handoverDept) return [];
        return usersList
            .filter(u => {
                if (u.department !== handoverDept) return false;
                if (['Admin', 'Superadmin', 'Super Admin', 'Viewer'].includes(u.role)) return false;
                if (restrictedUserIdentifiers.has(String(u.employee_id).toLowerCase()) || restrictedUserIdentifiers.has(String(u.email || '').toLowerCase())) return false;
                return true;
            })
            .map(u => ({ label: `${u.name} (${u.phone_number || u.phone || u.employee_id})`, value: u.employee_id }));
    }, [usersList, handoverDept, restrictedUserIdentifiers]);

    const escalateSolverOptions = useMemo(() => {
        if (!escalateDept) return [];
        return usersList
            .filter(u => {
                if (u.department !== escalateDept) return false;
                if (['Admin', 'Superadmin', 'Super Admin', 'Viewer'].includes(u.role)) return false;
                if (restrictedUserIdentifiers.has(String(u.employee_id).toLowerCase()) || restrictedUserIdentifiers.has(String(u.email || '').toLowerCase())) return false;
                return true;
            })
            .map(u => ({ label: `${u.name} (${u.role})`, value: u.email }));
    }, [usersList, escalateDept, restrictedUserIdentifiers]);

    const myTasks = tickets.filter(t => {
        const assignedRaw = String(t.assigned_to);
        return assignedRaw.includes(user.name) || assignedRaw.includes(String(user.employee_id)) || assignedRaw === String(user.email);
    });

    const deptFilteredTasks = myTasks.filter(t => {
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

    const activeTasks = deptFilteredTasks.filter(t => t.status !== 'Closed' && t.status !== 'Declined' && t.status !== 'On Hold' && t.status !== 'Escalated' && t.status !== 'Escalation Resolved' && t.status !== 'Resolved');
    const escalatedTasks = deptFilteredTasks.filter(t => t.status === 'Escalated' || t.status === 'Escalation Resolved');
    const closedTasks = deptFilteredTasks.filter(t => t.status === 'Closed' || t.status === 'Declined' || t.status === 'On Hold' || t.status === 'Resolved');

    const sidebarTabs = [
        { id: 'active_tasks', label: <><Zap size={12} /> My Active Tasks ({activeTasks.length})</> },
        { id: 'escalated_tasks', label: <><ArrowUpRight size={12} /> My Escalated Tasks ({escalatedTasks.length})</> },
        { id: 'closed_tasks', label: <><CheckCircle size={12} /> My Closed Tasks ({closedTasks.length})</> }
    ];

    const getLocalMinDatetime = () => {
        return getISTMinDatetime().slice(0, 10);
    };

    const getMaxDatetime = (deadlineStr) => {
        if (!deadlineStr) return null;
        try {
            const [datePart, timePart] = deadlineStr.split(' ');
            const parts = datePart.split('-');
            let year, month, day;
            if (parts[0].length === 4) {
                [year, month, day] = parts;
            } else {
                [day, month, year] = parts;
            }
            const [hour, minute] = timePart ? timePart.split(':') : ['00', '00'];
            return `${year}-${month}-${day}T${hour}:${minute}`;
        } catch (e) {
            return null;
        }
    };

    // =========================================================================
    // GLOBAL KPI ENGINE (PINNED TO TOP OF ALL TABS)
    // =========================================================================
    const isLate = (ticket) => {
        if (!ticket.deadline || ticket.status === 'Closed' || ticket.status === 'Resolved') return false;
        try {
            const [datePart, timePart] = ticket.deadline.split(' ');
            const dateParts = datePart.includes('-') ? datePart.split('-') : datePart.split('/');
            let day, month, year;
            if (dateParts[0].length === 4) {
                [year, month, day] = dateParts;
            } else {
                [day, month, year] = dateParts;
            }
            const [hour, minute] = timePart ? timePart.split(':') : [0, 0];
            return new Date(year, month - 1, day, hour, minute) < new Date();
        } catch (err) { return false; }
    };

    const solverKPI = useMemo(() => {
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

        deptFilteredTasks.forEach(t => {
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
            else if (stat === 'escalate' || stat === 'escalated') increment('escalated', lvl);
            else if (stat === 'declined') increment('declined', lvl);
            else if (stat === 'on hold') increment('onHold', lvl);

            if (isLate(t) || t.SLA_Breach === 'True' || t.SLA_Breach === true) increment('late', lvl);
        });

        return counts;
    }, [deptFilteredTasks]);

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

    const [ticketSortField, setTicketSortField] = useState('ticket_id');
    const [ticketSortOrder, setTicketSortOrder] = useState('desc');

    const handleTicketSortClick = (field) => {
        if (ticketSortField === field) {
            setTicketSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setTicketSortField(field);
            setTicketSortOrder('asc');
        }
    };

    const renderTicketTable = (ticketList) => {
        let sorted = [...ticketList];
        if (ticketSortField) {
            sorted.sort((a, b) => {
                let valA = a[ticketSortField];
                let valB = b[ticketSortField];

                if (ticketSortField === 'ticket_id') {
                    const numA = parseInt(String(valA || '').replace(/\D/g, '')) || 0;
                    const numB = parseInt(String(valB || '').replace(/\D/g, '')) || 0;
                    return ticketSortOrder === 'asc' ? numA - numB : numB - numA;
                }

                valA = String(valA || '').toLowerCase();
                valB = String(valB || '').toLowerCase();
                const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
                return ticketSortOrder === 'asc' ? cmp : -cmp;
            });
        }

        return (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                <div className="table-responsive" style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
                    <table className="data-table ageing-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                        <thead>
                            <tr>
                                <th onClick={() => handleTicketSortClick('ticket_id')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Ticket ID">
                                    Ticket ID {ticketSortField === 'ticket_id' ? (ticketSortOrder === 'asc' ? '▲' : '▼') : ''}
                                </th>
                                <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold' }}>Attach</th>
                                <th onClick={() => handleTicketSortClick('dept_assigned')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Department">
                                    Department {ticketSortField === 'dept_assigned' ? (ticketSortOrder === 'asc' ? '▲' : '▼') : ''}
                                </th>
                                <th onClick={() => handleTicketSortClick('issue_category')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Issue Category">
                                    Issue Cat {ticketSortField === 'issue_category' ? (ticketSortOrder === 'asc' ? '▲' : '▼') : ''}
                                </th>
                                <th onClick={() => handleTicketSortClick('activity_category')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Activity Category">
                                    Activity Cat {ticketSortField === 'activity_category' ? (ticketSortOrder === 'asc' ? '▲' : '▼') : ''}
                                </th>
                                <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold' }}>Description</th>
                                <th onClick={() => handleTicketSortClick('location')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Location">
                                    Location {ticketSortField === 'location' ? (ticketSortOrder === 'asc' ? '▲' : '▼') : ''}
                                </th>
                                <th onClick={() => handleTicketSortClick('assigned_to')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Assigned To">
                                    Assigned To {ticketSortField === 'assigned_to' ? (ticketSortOrder === 'asc' ? '▲' : '▼') : ''}
                                </th>
                                <th onClick={() => handleTicketSortClick('severity')} style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Severity">
                                    Severity {ticketSortField === 'severity' ? (ticketSortOrder === 'asc' ? '▲' : '▼') : ''}
                                </th>
                                <th onClick={() => handleTicketSortClick('status')} style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold', cursor: 'pointer', userSelect: 'none' }} title="Sort by Status">
                                    Status {ticketSortField === 'status' ? (ticketSortOrder === 'asc' ? '▲' : '▼') : ''}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.length === 0 ? (
                                <tr><td colSpan="10" className="text-center p-4 text-muted">No tasks found.</td></tr>
                            ) : (
                                sorted.map(t => (
                                    <tr
                                        key={`${t.ticket_id}-${t.escalation_level || 'L1'}`}
                                        className="clickable"
                                        onClick={() => handleTicketClick(t)}
                                        style={{ borderLeft: t.status !== 'Closed' && t.status !== 'Resolved' ? '2px solid #ef4444' : '2px solid transparent' }}
                                    >
                                        <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }} className="font-bold">
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                                                <span style={{ color: (isLate(t) || t.SLA_Breach === 'True' || t.SLA_Breach === true) ? '#ef4444' : 'inherit' }}>#{t.ticket_id}</span>
                                                {t.original_raiser && <span style={{ color: '#f59e0b', fontSize: '8px', fontWeight: 'normal', backgroundColor: 'rgba(245,158,11,0.1)', padding: '2px 4px', borderRadius: '4px', whiteSpace: 'nowrap', display: 'inline-block' }}>L{t.escalation_level ? String(t.escalation_level).replace('L', '') : '1'} Sub-task</span>}
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
                                                <span style={{ backgroundColor: t.status === 'Escalated' ? 'rgba(239, 68, 68, 0.1)' : t.status === 'Closed' ? '#27272a' : t.status === 'Resolved' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)', color: t.status === 'Escalated' ? '#ef4444' : t.status === 'Closed' ? '#a1a1aa' : t.status === 'Resolved' ? '#10b981' : '#60a5fa', padding: '3px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold' }}>{t.status}</span>
                                                <SLACountdownBadge deadline={t.deadline} status={t.status} />
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };


    const handleTabChange = (newTab) => {
        setActiveTab(newTab);
        setSelectedTicket(null);
    };

    return (
        <Layout user={user} setUser={setUser} sidebarTabs={sidebarTabs} activeTab={activeTab} setActiveTab={handleTabChange}>
            <div className="content-wrapper" style={{ paddingRight: selectedTicket && window.innerWidth > 768 ? '450px' : '0', transition: 'padding-right 0.9s cubic-bezier(0.4, 0, 0.2, 1)', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px', width: '100%' }}>
                        <h2 style={{ fontSize: '19px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            <Zap size={22} color="#f59e0b" /> Solver Workspace
                        </h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                            <button className="btn badge-primary p-2 text-xs flex-row gap-1" onClick={() => setShowAdvancedSearchModal(true)} style={{ whiteSpace: 'nowrap', borderRadius: '20px' }}>
                                <Filter size={14} /> Advanced Search & Filter
                            </button>
                        </div>
                    </div>
                </div>
                {error && <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '8px', borderRadius: '3px', marginBottom: '12px', fontSize: '10px' }}>{error}</div>}

                {/* --- GLOBAL KPI METRICS BOARD (COLLAPSIBLE) --- */}
                {showKPIs && (
                    <div className="kpi-grid">
                        <div className="card kpi-card kpi-blue" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #3b82f6', background: 'linear-gradient(180deg, rgba(59,130,246,0.25) 0%, rgba(59,130,246,0) 100%)' }}>
                            {renderTooltip(solverKPI.total.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Total</p>
                            <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{solverKPI.total.count}</h2>
                        </div>
                        <div className="card kpi-card kpi-amber" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #f59e0b', background: 'linear-gradient(180deg, rgba(245,158,11,0.25) 0%, rgba(245,158,11,0) 100%)' }}>
                            {renderTooltip(solverKPI.open.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Open</p>
                            <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{solverKPI.open.count}</h2>
                        </div>
                        <div className="card kpi-card kpi-purple" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #8b5cf6', background: 'linear-gradient(180deg, rgba(139,92,246,0.25) 0%, rgba(139,92,246,0) 100%)' }}>
                            {renderTooltip(solverKPI.inProgress.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>In Progress</p>
                            <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{solverKPI.inProgress.count}</h2>
                        </div>
                        <div className="card kpi-card kpi-teal" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #14b8a6', background: 'linear-gradient(180deg, rgba(20,184,166,0.25) 0%, rgba(20,184,166,0) 100%)' }}>
                            {renderTooltip(solverKPI.resolved.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Resolved</p>
                            <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{solverKPI.resolved.count}</h2>
                        </div>
                        <div className="card kpi-card kpi-green" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #10b981', background: 'linear-gradient(180deg, rgba(16,185,129,0.25) 0%, rgba(16,185,129,0) 100%)' }}>
                            {renderTooltip(solverKPI.closed.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Closed</p>
                            <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{solverKPI.closed.count}</h2>
                        </div>
                        <div className="card kpi-card kpi-gray" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #6b7280', background: 'linear-gradient(180deg, rgba(107,114,128,0.25) 0%, rgba(107,114,128,0) 100%)' }}>
                            {renderTooltip(solverKPI.declined.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Declined</p>
                            <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{solverKPI.declined.count}</h2>
                        </div>
                        <div className="card kpi-card kpi-gray" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #3b82f6', background: 'linear-gradient(180deg, rgba(59,130,246,0.25) 0%, rgba(59,130,246,0) 100%)' }}>
                            {renderTooltip(solverKPI.onHold.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>On Hold</p>
                            <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{solverKPI.onHold.count}</h2>
                        </div>
                        <div className="card kpi-card kpi-red" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #ef4444', background: 'linear-gradient(180deg, rgba(239,68,68,0.25) 0%, rgba(239,68,68,0) 100%)' }}>
                            {renderTooltip(solverKPI.escalated.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>Escalate</p>
                            <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{solverKPI.escalated.count}</h2>
                        </div>
                        <div className="card kpi-card kpi-sla kpi-orange" style={{ padding: '12px 8px', margin: 0, textAlign: 'center', borderTop: '2px solid #F7941D', background: 'linear-gradient(180deg, rgba(247,148,29,0.25) 0%, rgba(247,148,29,0) 100%)' }}>
                            {renderTooltip(solverKPI.late.levels)}
                            <p style={{ color: '#a1a1aa', fontSize: '10px', textTransform: 'uppercase', fontWeight: '600', margin: '0 0 4px 0' }}>SLA Breach</p>
                            <h2 style={{ fontSize: '19px', margin: 0, color: '#fff' }}>{solverKPI.late.count}</h2>
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>

                </div>


                {activeTab === 'active_tasks' && !loading && renderTicketTable(activeTasks)}
                {activeTab === 'escalated_tasks' && !loading && renderTicketTable(escalatedTasks)}
                {activeTab === 'closed_tasks' && !loading && renderTicketTable(closedTasks)}
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
                    <div className={isClosing ? "slide-out-right-panel" : "slide-in-right-panel"} style={{
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
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    #{selectedTicket.ticket_id}
                                    <span style={{ backgroundColor: selectedTicket.status === 'Closed' ? '#e4e4e7' : selectedTicket.status === 'Resolved' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)', color: selectedTicket.status === 'Closed' ? '#71717a' : selectedTicket.status === 'Resolved' ? '#10b981' : '#3b82f6', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{selectedTicket.status}</span>
                                    {Boolean(selectedTicket?.reassign_requested_to && String(selectedTicket.reassign_requested_to).trim() !== '' && String(selectedTicket.reassign_requested_to).toLowerCase() !== 'nan' && String(selectedTicket.reassign_requested_to).toLowerCase() !== 'none') && (
                                        <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '4px 10px', borderRadius: '12px', fontSize: '10.5px', fontWeight: 'bold', border: '1px solid rgba(245, 158, 11, 0.3)' }}>Handover Pending Approval</span>
                                    )}
                                </h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                                    <button onClick={() => { setSelectedTicket(null); setIsSidePanelExpanded(false); }} style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '18px', cursor: 'pointer', padding: '4px' }}>✕</button>
                                </div>
                            </div>

                            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                                <button onClick={() => setActiveDetailsTab('details')} style={{ flex: 1, padding: '10px 4px', fontSize: '13px', fontWeight: '600', backgroundColor: 'transparent', color: activeDetailsTab === 'details' ? '#3b82f6' : 'var(--text-main)', border: 'none', borderBottom: activeDetailsTab === 'details' ? '2px solid #3b82f6' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '-1px' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><FileText size={14} /> Details</div></button>
                                <button onClick={() => setActiveDetailsTab('timeline')} style={{ flex: 1, padding: '10px 4px', fontSize: '13px', fontWeight: '600', backgroundColor: 'transparent', color: activeDetailsTab === 'timeline' ? '#3b82f6' : 'var(--text-main)', border: 'none', borderBottom: activeDetailsTab === 'timeline' ? '2px solid #3b82f6' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '-1px' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Clock size={14} /> Timeline</div></button>
                                <button onClick={() => setActiveDetailsTab('chat')} style={{ flex: 1, padding: '10px 4px', fontSize: '13px', fontWeight: '600', backgroundColor: 'transparent', color: activeDetailsTab === 'chat' ? '#3b82f6' : 'var(--text-main)', border: 'none', borderBottom: activeDetailsTab === 'chat' ? '2px solid #3b82f6' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '-1px' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><MessageSquare size={14} /> Chat</div></button>
                            </div>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 30px', zIndex: 10, display: 'flex', flexDirection: 'column' }}>

                            {activeDetailsTab === 'chat' && (
                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative', zIndex: 10, height: '100%' }}>
                                    <div className="chat-container frosted-chat-box" style={{ flex: 1, overflowY: 'auto', padding: '12px', borderRadius: '5px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                                            <input type="text" className="form-control frosted-chat-box" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Type a message..." style={{ margin: 0, flex: 1, fontSize: '11px', padding: '10px 12px', color: 'var(--text-main)' }} />
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
                                            else if (log.action.includes('Handover') || log.action.includes('Assigned')) { Icon = UserPlus; iconColor = '#8b5cf6'; }

                                            let toName = "";
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
                                    <div style={{ display: 'grid', gridTemplateColumns: isSidePanelExpanded ? 'repeat(4, 1fr)' : '1fr 1fr', gap: '14px', fontSize: '12px', color: '#71717a', marginBottom: '16px' }}>
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
                                    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '20px', position: 'relative', zIndex: 10 }}>
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

                                    {selectedTicket.status === 'Escalation Resolved' && (
                                        <div className="card" style={{ padding: '16px', backgroundColor: '#18181b', border: '1px solid #3b82f6', position: 'relative', zIndex: 10, marginBottom: '16px' }}>
                                            <h4 style={{ color: '#60a5fa', margin: '0 0 8px 0', fontSize: '13px' }}>Resolution Pending Review</h4>
                                            <p style={{ color: '#a1a1aa', fontSize: '11px', marginBottom: '16px' }}>The escalated solver has marked this ticket as resolved. Please review their work and Accept or Reject the resolution.</p>
                                            <div style={{ display: 'flex', gap: '12px' }}>
                                                <button className="btn force-white-text" onClick={handleAcceptEscalation} style={{ backgroundColor: '#10b981', color: '#fff', fontSize: '11px', padding: '8px 16px', flex: 1 }}>Accept Resolution</button>
                                                <button className="btn force-white-text" onClick={handleRejectEscalation} style={{ backgroundColor: '#ef4444', color: '#fff', fontSize: '11px', padding: '8px 16px', flex: 1 }}>Reject (Return to Solver)</button>
                                            </div>
                                        </div>
                                    )}

                                    {Boolean(selectedTicket?.reassign_requested_to && String(selectedTicket.reassign_requested_to).trim() !== '' && String(selectedTicket.reassign_requested_to).toLowerCase() !== 'nan' && String(selectedTicket.reassign_requested_to).toLowerCase() !== 'none') ? (
                                        <div className="card" style={{ padding: '16px', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', borderRadius: '8px', position: 'relative', zIndex: 10 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                                <Clock size={18} color="#f59e0b" />
                                                <h4 style={{ color: '#fbbf24', margin: 0, fontSize: '13px', fontWeight: '600' }}>
                                                    Handover Pending Approval from Admin
                                                </h4>
                                            </div>
                                            <p style={{ color: '#d4d4d8', fontSize: '11px', margin: 0, lineHeight: '1.5' }}>
                                                A handover request to <strong style={{ color: '#f59e0b' }}>{getSolverDetails(selectedTicket.reassign_requested_to)}</strong> has been submitted and is currently awaiting Admin approval. This ticket is non-actionable until the request is granted or denied.
                                            </p>
                                        </div>
                                    ) : selectedTicket.status !== 'Closed' && selectedTicket.status !== 'Resolved' && selectedTicket.status !== 'Escalated' && selectedTicket.status !== 'Escalation Resolved' && selectedTicket.status !== 'Declined' && selectedTicket.status !== 'On Hold' && (
                                        <div className="card" style={{ padding: '16px', backgroundColor: '#18181b', border: '1px solid #27272a', position: 'relative', zIndex: 10 }}>
                                            <form onSubmit={(e) => handleStatusUpdate(e, selectedTicket.ticket_id, selectedTicket.status, selectedTicket.solver_comments)}>
                                                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '16px' }}>
                                                    <div style={{ flex: '0 0 160px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                        <div>
                                                            <label style={{ fontSize: '10px', color: '#a1a1aa', marginBottom: '4px', display: 'block' }}>Status</label>
                                                            <select className="form-control" style={{ width: '100%', fontSize: '11px', padding: '0 10px', height: '36px', margin: 0 }} value={updateForms[selectedTicket.ticket_id]?.status || selectedTicket.status} onChange={(e) => handleUpdateFormChange(selectedTicket.ticket_id, 'status', e.target.value)}>
                                                                {selectedTicket.status === 'Open' && <option value="Open">Open</option>}
                                                                <option value="In Progress">In Progress</option>
                                                                <option value="Resolved">Resolved</option>
                                                                <option value="Decline">Decline</option>
                                                                <option value="On Hold">On Hold</option>
                                                            </select>
                                                        </div>

                                                        <div>
                                                            <label style={{ fontSize: '10px', color: '#a1a1aa', marginBottom: '4px', display: 'block', fontWeight: '500' }}>File (Optional)</label>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                <div style={{ position: 'relative', width: '56px', height: '56px', flexShrink: 0 }}>
                                                                    {updateForms[selectedTicket.ticket_id]?.attachment ? (
                                                                        <div onClick={() => {
                                                                            const file = updateForms[selectedTicket.ticket_id].attachment;
                                                                            if (file && file.type?.startsWith('image/')) setEnlargedPreviewImage(URL.createObjectURL(file));
                                                                            if (file && (file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf'))) window.open(URL.createObjectURL(file), '_blank');
                                                                        }} style={{ position: 'absolute', inset: 0, borderRadius: '6px', overflow: 'hidden', border: '1px solid #10b981', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backgroundColor: (updateForms[selectedTicket.ticket_id].attachment.type === 'application/pdf' || updateForms[selectedTicket.ticket_id].attachment.name?.match(/\.(xlsx|xls|doc|docx)$/i)) ? 'rgba(16, 185, 129, 0.1)' : 'transparent' }}>
                                                                            {updateForms[selectedTicket.ticket_id].attachment.type === 'application/pdf' || updateForms[selectedTicket.ticket_id].attachment.name?.toLowerCase().endsWith('.pdf') ? (
                                                                                <>
                                                                                    <FileText size={22} color="#10b981" />
                                                                                    <span style={{ fontSize: '7.5px', marginTop: '2px', color: '#10b981', fontWeight: 'bold' }}>PDF</span>
                                                                                </>
                                                                            ) : updateForms[selectedTicket.ticket_id].attachment.name?.match(/\.(xlsx|xls|doc|docx)$/i) ? (
                                                                                <>
                                                                                    <FileText size={22} color="#10b981" />
                                                                                    <span style={{ fontSize: '7.5px', marginTop: '2px', color: '#10b981', fontWeight: 'bold' }}>{updateForms[selectedTicket.ticket_id].attachment.name.match(/\.(xlsx|xls)$/i) ? 'Excel' : 'Word'}</span>
                                                                                </>
                                                                            ) : (
                                                                                <img src={URL.createObjectURL(updateForms[selectedTicket.ticket_id].attachment)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} title="Click to enlarge" />
                                                                            )}
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => { e.stopPropagation(); handleUpdateFormChange(selectedTicket.ticket_id, 'attachment', null); }}
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
                                                                                    handleUpdateFormChange(selectedTicket.ticket_id, 'attachment', file);
                                                                                    if (file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')) {
                                                                                        window.open(URL.createObjectURL(file), '_blank');
                                                                                    }
                                                                                }
                                                                            }} title="Click to attach file" />
                                                                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#a1a1aa', pointerEvents: 'none' }}>
                                                                                <ImagePlus size={16} style={{ marginBottom: '2px' }} />
                                                                                <span style={{ fontSize: '8px', textAlign: 'center', padding: '0 2px' }}>Upload</span>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                                                    {updateForms[selectedTicket.ticket_id]?.attachment ? (
                                                                        <span style={{ fontSize: '9.5px', color: '#10b981', fontWeight: '600', display: 'block', wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'normal', lineHeight: '1.3' }} title={updateForms[selectedTicket.ticket_id].attachment.name}>
                                                                            ✓ {updateForms[selectedTicket.ticket_id].attachment.name}
                                                                        </span>
                                                                    ) : (
                                                                        <span style={{ fontSize: '8.5px', color: '#71717a', lineHeight: '1.3', display: 'block', wordBreak: 'break-word' }}>
                                                                            Auto-compressed (IMG) / 5MB (DOC)
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                                                            <label style={{ fontSize: '10px', color: '#a1a1aa', margin: 0 }}>Remark</label>
                                                            <CannedResponseSelector
                                                                currentText={updateForms[selectedTicket.ticket_id]?.remarks || ''}
                                                                onSelect={(val) => handleUpdateFormChange(selectedTicket.ticket_id, 'remarks', val)}
                                                            />
                                                        </div>
                                                        <textarea
                                                            className="form-control"
                                                            style={{ width: '100%', fontSize: '11px', padding: '8px 12px', minHeight: '94px', maxHeight: '190px', height: 'auto', margin: 0, resize: 'vertical', overflowY: 'auto', lineHeight: '1.4' }}
                                                            value={updateForms[selectedTicket.ticket_id]?.remarks || ''}
                                                            rows="4"
                                                            placeholder="Enter operational remarks..."
                                                            onChange={(e) => {
                                                                e.target.style.height = 'auto';
                                                                e.target.style.height = Math.min(e.target.scrollHeight, 190) + 'px';
                                                                handleUpdateFormChange(selectedTicket.ticket_id, 'remarks', e.target.value);
                                                            }}
                                                        />
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '10px', paddingTop: '12px', borderTop: '1px solid var(--border, rgba(255,255,255,0.06))' }}>
                                                    <button type="submit" style={{ backgroundColor: '#10b981', color: '#ffffff', fontWeight: 'bold', fontSize: '11.5px', padding: '0 20px', height: '34px', margin: 0, borderRadius: '6px', border: '1px solid #059669', boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)', cursor: 'pointer' }}>Update Status</button>

                                                    {selectedTicket.status === 'Open' && (updateForms[selectedTicket.ticket_id]?.status || selectedTicket.status) === 'In Progress' && (!selectedTicket.escalation_level || selectedTicket.escalation_level === 'L1') && !selectedTicket.has_extended && String(selectedTicket.has_extended).toLowerCase() !== 'true' && (
                                                        <button type="button" onClick={() => setIsExtendModalOpen(true)} style={{ fontSize: '11px', fontWeight: 'bold', padding: '0 14px', height: '34px', color: '#7c3aed', backgroundColor: 'rgba(139, 92, 246, 0.15)', border: '1px solid #8b5cf6', margin: 0, borderRadius: '6px', cursor: 'pointer', boxShadow: '0 1px 4px rgba(139, 92, 246, 0.15)' }}>Extend Deadline</button>
                                                    )}
                                                    {(selectedTicket.status === 'Open' || selectedTicket.status === 'In Progress') && !['Resolved', 'Decline', 'On Hold'].includes(updateForms[selectedTicket.ticket_id]?.status || selectedTicket.status) && (() => {
                                                        const ts = parseDateToTimestamp(selectedTicket.timestamp);
                                                        const dl = parseDateToTimestamp(selectedTicket.deadline);
                                                        const isHalfExpired = (ts && dl && dl > ts) ? (Date.now() > (ts + ((dl - ts) / 2.0))) : false;
                                                        return (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (isHalfExpired) {
                                                                        alert("Handover is only allowed within the first half of the SLA duration. The handover window for this ticket has expired.");
                                                                        return;
                                                                    }
                                                                    setHandoverDept(selectedTicket?.dept_assigned || selectedTicket?.department || '');
                                                                    setHandoverTarget('');
                                                                    setIsHandoverModalOpen(true);
                                                                }}
                                                                style={{
                                                                    fontSize: '11px', fontWeight: 'bold', padding: '0 14px', height: '34px',
                                                                    color: isHalfExpired ? '#71717a' : '#d97706',
                                                                    backgroundColor: isHalfExpired ? 'rgba(113, 113, 122, 0.1)' : 'rgba(245, 158, 11, 0.15)',
                                                                    border: `1px solid ${isHalfExpired ? '#3f3f46' : '#f59e0b'}`,
                                                                    margin: 0, borderRadius: '6px',
                                                                    cursor: isHalfExpired ? 'not-allowed' : 'pointer',
                                                                    boxShadow: isHalfExpired ? 'none' : '0 1px 4px rgba(245, 158, 11, 0.15)',
                                                                    opacity: isHalfExpired ? 0.6 : 1
                                                                }}
                                                                title={isHalfExpired ? "Handover disabled: Only allowed during first half of SLA duration" : "Request Ticket Handover"}
                                                            >
                                                                Handover {isHalfExpired ? '(Expired)' : ''}
                                                            </button>
                                                        );
                                                    })()}
                                                    {selectedTicket.status === 'In Progress' && !['Resolved', 'Decline', 'On Hold'].includes(updateForms[selectedTicket.ticket_id]?.status || selectedTicket.status) && (
                                                        <button type="button" onClick={() => setIsEscalateModalOpen(true)} style={{ fontSize: '11px', fontWeight: 'bold', padding: '0 14px', height: '34px', color: '#dc2626', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', margin: 0, borderRadius: '6px', cursor: 'pointer', boxShadow: '0 1px 4px rgba(239, 68, 68, 0.15)' }}>Escalate</button>
                                                    )}
                                                </div>
                                            </form>
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
                    `}</style>

                        {/* DYNAMIC CITYSCAPE LANDSCAPE FOR DETAILS PANE */}
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
                                        <rect x="100" y="325" width="3" height="4" /><rect x="110" y="305" width="3" height="4" />
                                        <rect x="125" y="275" width="3" height="4" /><rect x="135" y="295" width="3" height="4" />
                                        <rect x="165" y="355" width="3" height="4" /><rect x="180" y="335" width="3" height="4" />
                                    </g>
                                    <g className="window-lit">
                                        <rect x="10" y="345" width="3" height="4" /><rect x="25" y="305" width="3" height="4" />
                                        <rect x="30" y="345" width="3" height="4" /><rect x="45" y="365" width="3" height="4" />
                                        <rect x="55" y="325" width="3" height="4" /><rect x="62" y="305" width="3" height="4" />
                                        <rect x="75" y="285" width="3" height="4" /><rect x="88" y="325" width="3" height="4" />
                                        <rect x="115" y="345" width="3" height="4" /><rect x="140" y="325" width="3" height="4" />
                                        <rect x="155" y="345" width="3" height="4" /><rect x="190" y="325" width="3" height="4" />
                                    </g>
                                </svg>
                            ))}
                        </div>
                    </div>
                );
            })()}

            {isHandoverModalOpen && (
                <div className="glass-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass-modal" style={{ padding: '20px', borderRadius: '6px', width: '420px', maxWidth: '90%' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Request Ticket Handover</h3>

                        {smartHandoverSuggestions && (
                            <div style={{ backgroundColor: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '6px', padding: '10px', marginBottom: '14px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                    <Zap size={13} /> AI Smart Handover Suggestion
                                </div>
                                <div
                                    onClick={() => {
                                        if (smartHandoverSuggestions.dept_assigned) setHandoverDept(smartHandoverSuggestions.dept_assigned);
                                        if (smartHandoverSuggestions.assigned_to) setTimeout(() => setHandoverTarget(smartHandoverSuggestions.assigned_to), 50);
                                    }}
                                    style={{
                                        backgroundColor: 'var(--bg-card, rgba(24,24,27,0.7))',
                                        border: '1px solid var(--border, rgba(255,255,255,0.12))',
                                        borderRadius: '6px',
                                        padding: '8px 10px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '4px',
                                        transition: 'all 0.2s ease',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.06)'
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.12)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border, rgba(255,255,255,0.12))'; e.currentTarget.style.backgroundColor = 'var(--bg-card, rgba(24,24,27,0.7))'; }}
                                    title="Click to apply this suggestion"
                                >
                                    <span style={{ fontSize: '11px', color: 'var(--text-main, #18181b)', fontWeight: '600' }}>
                                        {smartHandoverSuggestions.dept_assigned}
                                    </span>
                                    {smartHandoverSuggestions.assigned_to && (
                                        <span style={{ fontSize: '10px', color: 'var(--text-muted, #71717a)' }}>
                                            Recommend Solver: {getSolverDetails(smartHandoverSuggestions.assigned_to)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        <form onSubmit={submitHandoverRequest}>
                            <div className="form-group" style={{ marginBottom: '12px', position: 'relative', zIndex: 100 }}>
                                <label style={{ fontSize: '10px' }}>Select Target Department</label>
                                <SearchSelect
                                    options={uniqueDepts}
                                    value={handoverDept}
                                    onChange={(val) => { setHandoverDept(val); setHandoverTarget(''); }}
                                    placeholder="Search Department..."
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: '12px', position: 'relative', zIndex: 90 }}>
                                <label style={{ fontSize: '10px' }}>Select Target Solver</label>
                                <SearchSelect
                                    options={handoverSolverOptions}
                                    value={handoverTarget}
                                    onChange={setHandoverTarget}
                                    placeholder="Search Solver..."
                                    disabled={!handoverDept}
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: '16px' }}>
                                <label style={{ fontSize: '10px' }}>Reason for Handover</label>
                                <textarea className="form-control" rows="3" required placeholder="Explain why you are reassigning..." style={{ padding: '8px', fontSize: '10px' }} value={handoverReason} onChange={e => setHandoverReason(e.target.value)}></textarea>
                                <CannedResponseSelector currentText={handoverReason} onSelect={setHandoverReason} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                <button type="button" className="btn" onClick={() => setIsHandoverModalOpen(false)} style={{ backgroundColor: 'transparent', border: '1px solid #3f3f46', fontSize: '10px', padding: '6px 12px' }}>Cancel</button>
                                <button type="submit" className="btn" style={{ backgroundColor: '#f59e0b', fontSize: '10px', padding: '6px 12px', color: '#000' }}>Submit Request</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isExtendModalOpen && (
                <div className="glass-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass-modal" style={{ padding: '20px', borderRadius: '6px', width: '400px', maxWidth: '90%' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Extend Ticket Deadline</h3>
                        <form onSubmit={submitExtendDeadlineRequest}>
                            <div className="form-group" style={{ marginBottom: '16px' }}>
                                <label style={{ fontSize: '10px' }}>Select New Deadline</label>
                                {selectedTicket && (
                                    <div style={{ fontSize: '9px', color: '#8b5cf6', marginBottom: '4px' }}>
                                        Original Deadline: {selectedTicket.absolute_deadline?.split(' ')[0] || selectedTicket.deadline?.split(' ')[0]}
                                    </div>
                                )}
                                <div
                                    style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', cursor: 'pointer' }}
                                    onClick={() => {
                                        const dateEl = document.getElementById('extendDeadlinePicker');
                                        if (dateEl && dateEl.showPicker) {
                                            try { dateEl.showPicker(); } catch (err) { }
                                        }
                                    }}
                                >
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="dd/mm/yyyy"
                                        required
                                        readOnly
                                        style={{
                                            padding: '8px 36px 8px 10px',
                                            fontSize: '11px',
                                            width: '100%',
                                            cursor: 'pointer',
                                            backgroundColor: 'var(--bg-main, #18181b)'
                                        }}
                                        value={
                                            extendDeadlineDate
                                                ? (() => {
                                                    const p = extendDeadlineDate.split('-');
                                                    return p.length === 3 && p[0].length === 4 ? `${p[2]}/${p[1]}/${p[0]}` : extendDeadlineDate;
                                                })()
                                                : ''
                                        }
                                    />
                                    <input
                                        id="extendDeadlinePicker"
                                        type="date"
                                        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
                                        value={extendDeadlineDate}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (val) {
                                                // Compute minimum: day after current deadline
                                                const deadlineStr = selectedTicket?.deadline || selectedTicket?.absolute_deadline || '';
                                                let minAllowed = getLocalMinDatetime();
                                                if (deadlineStr) {
                                                    try {
                                                        const dp = deadlineStr.split(' ')[0].split('-');
                                                        let dYear, dMonth, dDay;
                                                        if (dp[0].length === 4) { [dYear, dMonth, dDay] = dp; }
                                                        else { [dDay, dMonth, dYear] = dp; }
                                                        const deadlineDate = new Date(Number(dYear), Number(dMonth) - 1, Number(dDay));
                                                        deadlineDate.setDate(deadlineDate.getDate() + 1); // day after deadline
                                                        const afterDeadline = `${deadlineDate.getFullYear()}-${String(deadlineDate.getMonth() + 1).padStart(2, '0')}-${String(deadlineDate.getDate()).padStart(2, '0')}`;
                                                        if (afterDeadline > minAllowed) minAllowed = afterDeadline;
                                                    } catch (ex) { /* fallback to today */ }
                                                }
                                                if (minAllowed && val < minAllowed) {
                                                    alert("New deadline must be after the current deadline.");
                                                    setExtendDeadlineDate(minAllowed);
                                                    return;
                                                }
                                            }
                                            setExtendDeadlineDate(val);
                                        }}
                                        min={(() => {
                                            const deadlineStr = selectedTicket?.deadline || selectedTicket?.absolute_deadline || '';
                                            let minDate = getLocalMinDatetime();
                                            if (deadlineStr) {
                                                try {
                                                    const dp = deadlineStr.split(' ')[0].split('-');
                                                    let dYear, dMonth, dDay;
                                                    if (dp[0].length === 4) { [dYear, dMonth, dDay] = dp; }
                                                    else { [dDay, dMonth, dYear] = dp; }
                                                    const deadlineDate = new Date(Number(dYear), Number(dMonth) - 1, Number(dDay));
                                                    deadlineDate.setDate(deadlineDate.getDate() + 1);
                                                    const afterDeadline = `${deadlineDate.getFullYear()}-${String(deadlineDate.getMonth() + 1).padStart(2, '0')}-${String(deadlineDate.getDate()).padStart(2, '0')}`;
                                                    if (afterDeadline > minDate) minDate = afterDeadline;
                                                } catch (ex) { /* fallback to today */ }
                                            }
                                            return minDate;
                                        })()}
                                    />
                                    <Calendar
                                        size={14}
                                        style={{ position: 'absolute', right: '10px', pointerEvents: 'none', color: '#a1a1aa' }}
                                    />
                                </div>
                                <p style={{ fontSize: '9px', color: '#a1a1aa', marginTop: '8px' }}>Note: The reason for this extension will be pulled from the 'Remark' field on the ticket update panel.</p>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                <button type="button" className="btn" onClick={() => setIsExtendModalOpen(false)} style={{ backgroundColor: 'transparent', border: '1px solid #3f3f46', fontSize: '10px', padding: '6px 12px' }}>Cancel</button>
                                <button type="submit" className="btn" style={{ backgroundColor: '#8b5cf6', fontSize: '10px', padding: '6px 12px' }}>Confirm Extension</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isEscalateModalOpen && (
                <div className="glass-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass-modal" style={{ padding: '20px', borderRadius: '6px', width: '480px', maxWidth: '95%' }}>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>Escalate Ticket to Department</h3>
                        <p style={{ fontSize: '10px', color: '#a1a1aa', marginBottom: '14px' }}>
                            Escalating a ticket will temporarily assign it to another department. You will act as the requestor for this sub-task and will need to accept the work once resolved.
                        </p>

                        {topEscalationOptions && topEscalationOptions.length > 0 && (
                            <div style={{ backgroundColor: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '6px', padding: '10px', marginBottom: '14px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                    <Zap size={13} /> AI Escalation Smart Assistance (Top {topEscalationOptions.slice(0, 4).length} Historical Routes)
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                    {topEscalationOptions.slice(0, 4).map((opt, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => {
                                                if (opt.dept) setEscalateDept(opt.dept);
                                                if (opt.solver_email || opt.solver_emp_id) setEscalateTarget(opt.solver_email || opt.solver_emp_id);
                                                if (opt.deadline_hours) {
                                                    const targetDate = new Date();
                                                    targetDate.setHours(targetDate.getHours() + Math.round(opt.deadline_hours));
                                                    const yyyy = targetDate.getFullYear();
                                                    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
                                                    const dd = String(targetDate.getDate()).padStart(2, '0');
                                                    setEscalateDeadline(`${yyyy}-${mm}-${dd}`);
                                                }
                                            }}
                                            style={{
                                                backgroundColor: 'var(--bg-card, rgba(24,24,27,0.7))',
                                                border: '1px solid rgba(255,255,255,0.12)',
                                                borderRadius: '6px',
                                                padding: '6px 8px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '3px',
                                                transition: 'all 0.2s ease',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.15)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.backgroundColor = 'var(--bg-card, rgba(24,24,27,0.7))'; }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.15)', padding: '1px 5px', borderRadius: '3px' }}>
                                                    Option #{idx + 1}
                                                </span>
                                                <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.15)', padding: '1px 5px', borderRadius: '3px' }}>
                                                    ⏱ {opt.deadline_hours ? `${opt.deadline_hours}h` : '24h'}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '10.5px', fontWeight: 'bold', color: 'var(--text-main, #fff)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {opt.dept}
                                            </div>
                                            <div style={{ fontSize: '9.5px', color: '#10b981', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {opt.solver_name || opt.solver_emp_id || 'Auto Solver'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <form onSubmit={submitEscalateRequest}>
                            <div className="form-group" style={{ marginBottom: '12px', position: 'relative', zIndex: 100 }}>
                                <label style={{ fontSize: '10px' }}>Select Target Department</label>
                                <SearchSelect
                                    options={uniqueDepts}
                                    value={escalateDept}
                                    onChange={(val) => { setEscalateDept(val); setEscalateTarget(''); }}
                                    placeholder="Search Department..."
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: '12px', position: 'relative', zIndex: 90 }}>
                                <label style={{ fontSize: '10px' }}>Select Target Solver</label>
                                <SearchSelect
                                    options={escalateSolverOptions}
                                    value={escalateTarget}
                                    onChange={setEscalateTarget}
                                    placeholder="Search Solver..."
                                    disabled={!escalateDept}
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: '16px' }}>
                                <label style={{ fontSize: '10px' }}>Reason for Escalation</label>
                                <textarea className="form-control" rows="3" required placeholder="Explain why you are escalating this ticket..." style={{ padding: '8px', fontSize: '10px' }} value={escalateReason} onChange={e => setEscalateReason(e.target.value)}></textarea>
                                <CannedResponseSelector currentText={escalateReason} onSelect={setEscalateReason} />
                            </div>

                            <div className="form-group" style={{ marginBottom: '16px' }}>
                                <label style={{ fontSize: '10px' }}>
                                    Set Deadline (Optional)
                                </label>
                                {selectedTicket && (
                                    <div style={{ fontSize: '9px', color: '#8b5cf6', marginBottom: '4px' }}>
                                        Original Deadline: {selectedTicket.absolute_deadline?.split(' ')[0] || selectedTicket.deadline?.split(' ')[0]}
                                    </div>
                                )}
                                <div
                                    style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', cursor: 'pointer' }}
                                    onClick={() => {
                                        const dateEl = document.getElementById('escalateDeadlinePicker');
                                        if (dateEl && dateEl.showPicker) {
                                            try { dateEl.showPicker(); } catch (err) { }
                                        }
                                    }}
                                >
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="dd/mm/yyyy"
                                        required
                                        readOnly
                                        style={{
                                            padding: '8px 36px 8px 10px',
                                            fontSize: '11px',
                                            width: '100%',
                                            cursor: 'pointer',
                                            backgroundColor: 'var(--bg-main, #18181b)'
                                        }}
                                        value={
                                            escalateDeadline
                                                ? (() => {
                                                    const p = escalateDeadline.split('-');
                                                    return p.length === 3 && p[0].length === 4 ? `${p[2]}/${p[1]}/${p[0]}` : escalateDeadline;
                                                })()
                                                : ''
                                        }
                                    />
                                    <input
                                        id="escalateDeadlinePicker"
                                        type="date"
                                        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
                                        value={escalateDeadline}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (val) {
                                                const minAllowed = getLocalMinDatetime();
                                                if (minAllowed && new Date(val) < new Date(minAllowed)) {
                                                    alert("Deadline cannot be set to a past time.");
                                                    setEscalateDeadline(minAllowed);
                                                    return;
                                                }
                                            }
                                            setEscalateDeadline(val);
                                        }}
                                        min={getLocalMinDatetime()}
                                    />
                                    <Calendar size={14} style={{ position: 'absolute', right: '10px', pointerEvents: 'none', color: '#a1a1aa' }} />
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: '16px' }}>
                                <label style={{ fontSize: '10px', marginBottom: '8px', display: 'block', color: 'var(--text-main)' }}>Attach File (Optional)</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ position: 'relative', width: '80px', height: '80px', flexShrink: 0 }}>
                                        {escalateAttachment ? (
                                            <div onClick={() => { if (escalateAttachment.type?.startsWith('image/')) setEnlargedPreviewImage(URL.createObjectURL(escalateAttachment)); }} style={{ position: 'absolute', inset: 0, borderRadius: '6px', overflow: 'hidden', border: '1px solid #10b981', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: escalateAttachment.type?.startsWith('image/') ? 'pointer' : 'default', backgroundColor: (escalateAttachment.type === 'application/pdf' || escalateAttachment.name?.match(/\.(xlsx|xls|doc|docx)$/i)) ? 'rgba(16, 185, 129, 0.1)' : 'transparent' }}>
                                                {escalateAttachment.type === 'application/pdf' ? (
                                                    <>
                                                        <FileText size={24} color="#10b981" />
                                                        <span style={{ fontSize: '9px', marginTop: '4px', color: '#10b981' }}>PDF Attached</span>
                                                    </>
                                                ) : escalateAttachment.name?.match(/\.(xlsx|xls|doc|docx)$/i) ? (
                                                    <>
                                                        <FileText size={24} color="#10b981" />
                                                        <span style={{ fontSize: '9px', marginTop: '4px', color: '#10b981' }}>{escalateAttachment.name.match(/\.(xlsx|xls)$/i) ? 'Excel' : 'Word'} Attached</span>
                                                    </>
                                                ) : (
                                                    <img src={URL.createObjectURL(escalateAttachment)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} title="Click to enlarge" />
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.preventDefault(); setEscalateAttachment(null); setEscalateFileName(''); }}
                                                    style={{ position: 'absolute', top: 0, right: 0, background: 'rgba(239, 68, 68, 0.9)', color: '#fff', border: 'none', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '10px', borderRadius: '0 0 0 6px', padding: 0 }}
                                                    title="Remove file"
                                                >✕</button>
                                            </div>
                                        ) : (
                                            <div style={{ position: 'relative', width: '100%', height: '100%', border: '2px dashed #71717a', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.04)', transition: 'all 0.2s', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <input type="file" id="escalate-file-upload" style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 5, width: '100%', height: '100%' }} accept=".jpg,.jpeg,.png,.pdf,.xlsx,.xls,.doc,.docx,image/jpeg,image/png,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleEscalateFileChange} title="Click to attach file" />
                                                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#a1a1aa', pointerEvents: 'none' }}>
                                                    <ImagePlus size={20} style={{ marginBottom: '4px' }} />
                                                    <span style={{ fontSize: '9px', textAlign: 'center', padding: '0 4px' }}>Add File</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        {isEscalatingImage ? <span style={{ fontSize: '11px', color: '#f59e0b' }}>Processing...</span> : escalateFileName ? <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold' }}>{escalateFileName}</span> : <span style={{ fontSize: '11px', color: '#71717a' }}>Auto-compressed (IMG) / 5MB (DOC)</span>}
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                <button type="button" className="btn" onClick={() => { setIsEscalateModalOpen(false); setEscalateAttachment(null); setEscalateFileName(''); }} style={{ fontSize: '10px', padding: '6px 12px' }}>Cancel</button>
                                <button type="submit" className="btn" disabled={isEscalatingImage} style={{ fontSize: '10px', padding: '6px 12px' }}>Escalate Ticket</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
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
                                        {[...new Set(myTasks.map(a => a.dept_assigned).filter(Boolean))].sort().map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Location</label>
                                    <select className="form-control" style={{ fontSize: '12px', padding: '8px' }} value={tempFilters.location} onChange={e => setTempFilters({ ...tempFilters, location: e.target.value })}>
                                        <option value="">All Locations</option>
                                        {[...new Set(myTasks.map(a => a.location).filter(Boolean))].sort().map(l => <option key={l} value={l}>{l}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Issue Category</label>
                                    <select className="form-control" style={{ fontSize: '12px', padding: '8px' }} value={tempFilters.issueCat} onChange={e => setTempFilters({ ...tempFilters, issueCat: e.target.value })}>
                                        <option value="">All Issue Cats</option>
                                        {[...new Set(myTasks.map(a => a.issue_category).filter(Boolean))].sort().map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Activity Category</label>
                                    <select className="form-control" style={{ fontSize: '12px', padding: '8px' }} value={tempFilters.activityCat} onChange={e => setTempFilters({ ...tempFilters, activityCat: e.target.value })}>
                                        <option value="">All Activity Cats</option>
                                        {[...new Set(myTasks.map(a => a.activity_category).filter(Boolean))].sort().map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Assigned To</label>
                                    <select className="form-control" style={{ fontSize: '12px', padding: '8px' }} value={tempFilters.assignedTo} onChange={e => setTempFilters({ ...tempFilters, assignedTo: e.target.value })}>
                                        <option value="">All Assignees</option>
                                        {[...new Set(myTasks.map(a => a.assigned_to).filter(Boolean))].sort().map(u => <option key={u} value={u}>{getSolverDetails(u)}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Status</label>
                                    <select className="form-control" style={{ fontSize: '12px', padding: '8px' }} value={tempFilters.status} onChange={e => setTempFilters({ ...tempFilters, status: e.target.value })}>
                                        <option value="">All Statuses</option>
                                        {[...new Set(myTasks.map(a => a.status).filter(Boolean))].sort().map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Severity</label>
                                    <select className="form-control" style={{ fontSize: '12px', padding: '8px' }} value={tempFilters.severity} onChange={e => setTempFilters({ ...tempFilters, severity: e.target.value })}>
                                        <option value="">All Severities</option>
                                        {[...new Set(myTasks.map(a => a.severity).filter(Boolean))].sort().map(s => <option key={s} value={s}>{s}</option>)}
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

export default SolverDashboard;