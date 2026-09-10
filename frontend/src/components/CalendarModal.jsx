import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import { Calendar, ChevronLeft, ChevronRight, X, Circle, Clock, Ticket } from 'lucide-react';

import { getISTDate } from '../utils/dateUtils';

const CalendarModal = ({ user, isDarkMode, onClose }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(getISTDate());
    const [selectedDate, setSelectedDate] = useState(null);
    const [filterType, setFilterType] = useState('all'); // 'all', 'created', 'due'

    // Filter tickets based on user role
    useEffect(() => {
        const fetchTickets = async () => {
            try {
                const response = await api.get('/tickets');
                let allTickets = response.data;
                
                // Group tickets by ticket_id to avoid L1/L2 duplicates if any, but since we are just checking dates it's fine.
                // We will filter by user access
                if (user.role !== 'Admin' && user.role !== 'Superadmin' && user.role !== 'Super Admin') {
                    allTickets = allTickets.filter(t => {
                        const emailMatches = String(t.raised_by) === String(user.employee_id) ||
                                             String(t.original_raiser).toLowerCase() === String(user.email).toLowerCase() ||
                                             String(t.assigned_to).toLowerCase() === String(user.email).toLowerCase();
                        const idMatches = String(t.assigned_to) === String(user.employee_id);
                                          
                        const deptMatches = t.dept_assigned === user.department;
                        
                        return emailMatches || idMatches || deptMatches;
                    });
                }
                
                // Keep unique tickets
                const uniqueTickets = [];
                const seenIds = new Set();
                for (let t of allTickets) {
                    if (!seenIds.has(t.ticket_id)) {
                        seenIds.add(t.ticket_id);
                        uniqueTickets.push(t);
                    }
                }

                setTickets(uniqueTickets);
                setLoading(false);
            } catch (err) {
                console.error("Failed to load tickets for calendar", err);
                setLoading(false);
            }
        };
        fetchTickets();
    }, [user]);

    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const changeMonth = (offset) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
        setSelectedDate(null);
    };

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    // Generate dates
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    // Format DD-MM-YYYY to match the CSV format
    const formatStr = (d, m, y) => {
        const dd = String(d).padStart(2, '0');
        const mm = String(m + 1).padStart(2, '0');
        return `${dd}-${mm}-${y}`;
    };

    // Helper to get tickets for a day
    const getTicketsForDay = (day) => {
        if (!day) return { created: [], due: [] };
        const dateStr = formatStr(day, month, year);
        
        const created = tickets.filter(t => t.timestamp && String(t.timestamp).startsWith(dateStr));
        const due = tickets.filter(t => t.deadline && String(t.deadline).startsWith(dateStr) && t.status !== 'Closed' && t.status !== 'Resolved');
        
        return { created, due };
    };

    const handleDayClick = (day) => {
        if (day) {
            setSelectedDate(day);
        }
    };

    const selectedTickets = getTicketsForDay(selectedDate);

    const navigateToTicket = (t) => {
        onClose();
        const currentPath = location.pathname;

        // If the user is an admin or super admin, or currently on that workspace, always route to their dashboard
        if (currentPath.startsWith('/superadmin') || user.role === 'Superadmin' || user.role === 'Super Admin') {
            navigate(`/superadmin?ticket_id=${t.ticket_id}`);
            return;
        }
        if (currentPath.startsWith('/admin') || user.role === 'Admin') {
            navigate(`/admin?ticket_id=${t.ticket_id}`);
            return;
        }
        if (currentPath.startsWith('/viewer') || user.role === 'Viewer') {
            navigate(`/viewer?ticket_id=${t.ticket_id}`);
            return;
        }
        if (currentPath.startsWith('/manager') || user.role === 'Manager' || user.role === 'RM') {
            navigate(`/manager?ticket_id=${t.ticket_id}`);
            return;
        }
        const userEmail = String(user.email || '').toLowerCase().trim();
        const userEmpId = String(user.employee_id || '').toLowerCase().trim();
        const userName = String(user.name || '').toLowerCase().trim();
        const userDept = String(user.department || '').toLowerCase().trim();

        const raiserFull = String(t.raised_by || '').toLowerCase() + ' ' + String(t.employee_id || '').toLowerCase() + ' ' + String(t.raiser_name || '').toLowerCase() + ' ' + String(t.original_raiser || '').toLowerCase();
        const isRequestor = (userEmail !== '' && raiserFull.includes(userEmail)) || 
                            (userEmpId !== '' && raiserFull.includes(userEmpId)) || 
                            (userName !== '' && raiserFull.includes(userName));

        const assignedToFull = String(t.assigned_to || '').toLowerCase();
        const ticketDept = String(t.dept_assigned || '').toLowerCase().trim();
        const isSolver = (userEmail !== '' && assignedToFull.includes(userEmail)) || 
                         (userEmpId !== '' && assignedToFull.includes(userEmpId)) || 
                         (userName !== '' && assignedToFull.includes(userName)) || 
                         (ticketDept !== '' && ticketDept === userDept && userDept !== 'unassigned');

        if (currentPath.startsWith('/solver')) {
            if (!isSolver && isRequestor) {
                navigate(`/requestor?ticket_id=${t.ticket_id}`);
            } else {
                navigate(`/solver?ticket_id=${t.ticket_id}`);
            }
            return;
        }

        if (currentPath.startsWith('/requestor')) {
            if (!isRequestor && isSolver) {
                navigate(`/solver?ticket_id=${t.ticket_id}`);
            } else {
                navigate(`/requestor?ticket_id=${t.ticket_id}`);
            }
            return;
        }

        // For standard users from other pages:
        if (isSolver) {
            navigate(`/solver?ticket_id=${t.ticket_id}`);
        } else {
            navigate(`/requestor?ticket_id=${t.ticket_id}`);
        }
    };

    const modalContent = (
        <div className="glass-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999
        }}>
            <div className="glass-modal" style={{
                width: '750px', maxWidth: '90vw', height: '550px',
                display: 'flex', flexDirection: 'column',
                borderRadius: '16px', overflow: 'hidden', position: 'relative'
            }}>
                <div style={{
                    padding: '16px 24px', borderBottom: `1px solid ${isDarkMode ? '#3f3f46' : '#cbd5e1'}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <h2 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: isDarkMode ? '#fff' : '#0f172a' }}>
                        <Calendar size={18} color="#3b82f6" /> Ticket Calendar & Deadlines
                    </h2>
                    <button onClick={onClose} style={{
                        background: 'transparent', border: 'none', cursor: 'pointer', color: isDarkMode ? '#a1a1aa' : '#64748b'
                    }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {/* Left: Calendar View */}
                    <div style={{ flex: '1', padding: '24px', borderRight: `1px solid ${isDarkMode ? '#3f3f46' : '#cbd5e1'}`, display: 'flex', flexDirection: 'column' }}>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <button onClick={() => changeMonth(-1)} className="btn" style={{ padding: '6px', backgroundColor: 'transparent', border: 'none' }}><ChevronLeft size={20} /></button>
                            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold' }}>
                                {currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                            </h3>
                            <button onClick={() => changeMonth(1)} className="btn" style={{ padding: '6px', backgroundColor: 'transparent', border: 'none' }}><ChevronRight size={20} /></button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center', marginBottom: '8px', fontSize: '11px', fontWeight: 'bold', color: isDarkMode ? '#71717a' : '#64748b' }}>
                            <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', flex: 1 }}>
                            {days.map((day, idx) => {
                                const { created, due } = getTicketsForDay(day);
                                const hasCreated = created.length > 0;
                                const hasDue = due.length > 0;
                                const isSelected = selectedDate === day;

                                return (
                                    <div
                                        key={idx}
                                        onClick={() => handleDayClick(day)}
                                        style={{
                                            padding: '8px 4px',
                                            borderRadius: '8px',
                                            cursor: day ? 'pointer' : 'default',
                                            backgroundColor: isSelected ? '#3b82f6' : (day ? (isDarkMode ? '#1e1e1e' : '#f8fafc') : 'transparent'),
                                            border: `1px solid ${isSelected ? '#3b82f6' : (day ? (isDarkMode ? '#27272a' : '#e2e8f0') : 'transparent')}`,
                                            color: isSelected ? '#fff' : (day ? (isDarkMode ? '#d4d4d4' : '#0f172a') : 'transparent'),
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
                                            transition: 'all 0.2s',
                                            minHeight: '45px'
                                        }}
                                        onMouseOver={(e) => { if (day && !isSelected) { e.currentTarget.style.borderColor = '#3b82f6'; } }}
                                        onMouseOut={(e) => { if (day && !isSelected) { e.currentTarget.style.borderColor = isDarkMode ? '#27272a' : '#e2e8f0'; } }}
                                    >
                                        <span style={{ fontSize: '13px', fontWeight: isSelected ? 'bold' : 'normal' }}>{day}</span>
                                        <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                                            {hasCreated && <Circle size={6} fill="#10b981" color="#10b981" title="Created on this day" />}
                                            {hasDue && <Circle size={6} fill="#ef4444" color="#ef4444" title="Deadline on this day" />}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        
                        <div style={{ display: 'flex', gap: '16px', marginTop: '16px', justifyContent: 'center', fontSize: '10px', color: isDarkMode ? '#a1a1aa' : '#64748b' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Circle size={8} fill="#10b981" color="#10b981" /> Tickets Created</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Circle size={8} fill="#ef4444" color="#ef4444" /> Pending Deadlines</div>
                        </div>

                    </div>

                    {/* Right: Ticket Details */}
                    <div style={{ width: '320px', padding: '24px', backgroundColor: isDarkMode ? 'var(--bg-subtle)' : '#f8fafc', overflowY: 'auto' }}>
                        {!selectedDate ? (
                            <div style={{ textAlign: 'center', color: isDarkMode ? '#71717a' : '#64748b', marginTop: '50px', fontSize: '12px' }}>
                                <Calendar size={32} style={{ marginBottom: '16px', opacity: 0.5 }} />
                                <p>Select a date on the calendar to view related tickets and deadlines.</p>
                            </div>
                        ) : loading ? (
                            <div style={{ textAlign: 'center', color: isDarkMode ? '#71717a' : '#64748b', marginTop: '50px', fontSize: '12px' }}>Loading...</div>
                        ) : (selectedTickets.created.length === 0 && selectedTickets.due.length === 0) ? (
                            <div style={{ textAlign: 'center', color: isDarkMode ? '#71717a' : '#64748b', marginTop: '50px', fontSize: '12px' }}>
                                No tickets created or due on this date.
                            </div>
                        ) : (
                            <div>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', borderBottom: `1px solid ${isDarkMode ? '#3f3f46' : '#cbd5e1'}`, paddingBottom: '8px' }}>
                                    {formatStr(selectedDate, month, year)}
                                </h3>

                                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                                    <button 
                                        onClick={() => setFilterType('all')}
                                        style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '10px', border: 'none', cursor: 'pointer', backgroundColor: filterType === 'all' ? '#3b82f6' : (isDarkMode ? '#27272a' : '#e2e8f0'), color: filterType === 'all' ? '#fff' : (isDarkMode ? '#a1a1aa' : '#64748b') }}
                                    >All</button>
                                    <button 
                                        onClick={() => setFilterType('created')}
                                        style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '10px', border: 'none', cursor: 'pointer', backgroundColor: filterType === 'created' ? '#10b981' : (isDarkMode ? '#27272a' : '#e2e8f0'), color: filterType === 'created' ? '#fff' : (isDarkMode ? '#a1a1aa' : '#64748b') }}
                                    >Created</button>
                                    <button 
                                        onClick={() => setFilterType('due')}
                                        style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '10px', border: 'none', cursor: 'pointer', backgroundColor: filterType === 'due' ? '#ef4444' : (isDarkMode ? '#27272a' : '#e2e8f0'), color: filterType === 'due' ? '#fff' : (isDarkMode ? '#a1a1aa' : '#64748b') }}
                                    >Deadlines</button>
                                </div>

                                {(filterType === 'all' || filterType === 'due') && selectedTickets.due.length > 0 && (
                                    <div style={{ marginBottom: '24px' }}>
                                        <h4 style={{ fontSize: '11px', color: '#ef4444', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Clock size={12} /> Pending Deadlines ({selectedTickets.due.length})
                                        </h4>
                                        {selectedTickets.due.map(t => (
                                            <div key={`due-${t.ticket_id}`} onClick={() => navigateToTicket(t)} style={{ 
                                                padding: '10px', backgroundColor: isDarkMode ? '#27272a' : '#ffffff', 
                                                border: `1px solid ${isDarkMode ? '#3f3f46' : '#e2e8f0'}`, borderRadius: '6px', marginBottom: '8px', cursor: 'pointer' 
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                    <span style={{ fontSize: '11px', fontWeight: 'bold' }}>#{t.ticket_id}</span>
                                                    <span style={{ fontSize: '9px', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '2px 6px', borderRadius: '8px' }}>{t.status}</span>
                                                </div>
                                                <div style={{ fontSize: '10px', color: isDarkMode ? '#d4d4d4' : '#0f172a', marginBottom: '4px' }}>{t.issue_category}</div>
                                                <div style={{ fontSize: '10px', color: isDarkMode ? '#a1a1aa' : '#64748b' }}>Assigned: {t.dept_assigned}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {(filterType === 'all' || filterType === 'created') && selectedTickets.created.length > 0 && (
                                    <div>
                                        <h4 style={{ fontSize: '11px', color: '#10b981', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Ticket size={12} /> Tickets Created ({selectedTickets.created.length})
                                        </h4>
                                        {selectedTickets.created.map(t => (
                                            <div key={`created-${t.ticket_id}`} onClick={() => navigateToTicket(t)} style={{ 
                                                padding: '10px', backgroundColor: isDarkMode ? '#27272a' : '#ffffff', 
                                                border: `1px solid ${isDarkMode ? '#3f3f46' : '#e2e8f0'}`, borderRadius: '6px', marginBottom: '8px', cursor: 'pointer' 
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                    <span style={{ fontSize: '11px', fontWeight: 'bold' }}>#{t.ticket_id}</span>
                                                    <span style={{ fontSize: '9px', backgroundColor: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '2px 6px', borderRadius: '8px' }}>{t.status}</span>
                                                </div>
                                                <div style={{ fontSize: '10px', color: isDarkMode ? '#d4d4d4' : '#0f172a', marginBottom: '4px' }}>{t.issue_category}</div>
                                                <div style={{ fontSize: '10px', color: isDarkMode ? '#a1a1aa' : '#64748b' }}>Raiser: {t.raiser_name || t.raised_by}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default CalendarModal;
