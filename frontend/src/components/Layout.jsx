// frontend/src/components/Layout.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { LogOut, LayoutDashboard, Ticket, CheckSquare, Settings, Bell, CheckCircle2, Sun, Moon, ChevronDown, ChevronRight, TrendingUp, Clock, Users, MapPin, Cog, PlusCircle, ClipboardList, Zap, CheckCircle, BarChart2, Calendar, Menu, X, ArrowUpRight } from 'lucide-react';
import CalendarModal from './CalendarModal';

const TABS_CONFIG = {
    '/admin': [
        { id: 'analytics', label: <><TrendingUp size={12} /> Global Analytics</> },
        { id: 'ageing', label: <><Clock size={12} /> Ageing Report</> },
        { id: 'users', label: <><Users size={12} /> User Directory</> },
        { id: 'locations', label: <><MapPin size={12} /> Locations & Outlets</> },
        { id: 'rules', label: <><Cog size={12} /> Master Logic Rules</> }
    ],
    '/superadmin': [
        { id: 'analytics', label: <><TrendingUp size={12} /> Global Analytics</> },
        { id: 'ageing', label: <><Clock size={12} /> Ageing Report</> },
        { id: 'users', label: <><Users size={12} /> User Directory</> },
        { id: 'locations', label: <><MapPin size={12} /> Locations & Outlets</> },
        { id: 'rules', label: <><Cog size={12} /> Master Logic Rules</> }
    ],
    '/requestor': [
        { id: 'history', label: <><ClipboardList size={12} /> My Ticket History</> },
        { id: 'raise', label: <><PlusCircle size={12} /> Raise New Issue</> }
    ],
    '/solver': [
        { id: 'active_tasks', label: <><Zap size={12} /> Active Tasks</> },
        { id: 'escalated_tasks', label: <><ArrowUpRight size={12} /> Escalated Tasks</> },
        { id: 'closed_tasks', label: <><CheckCircle size={12} /> Closed Tasks</> }
    ],
    '/viewer': [
        { id: 'analytics', label: <><TrendingUp size={12} /> Global Analytics</> },
        { id: 'ageing', label: <><Clock size={12} /> Ageing Report</> }
    ]
};
import api, { fetchUsers } from '../api';

const Layout = ({ children, user, setUser, sidebarTabs, activeTab, setActiveTab }) => {
    const navigate = useNavigate();
    const location = useLocation();

    // --- THEME STATE ---
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const savedTheme = localStorage.getItem('theme');
        return savedTheme === 'dark'; // Default to light mode
    });

    const [skyRotation, setSkyRotation] = useState(() => {
        const savedTheme = localStorage.getItem('theme');
        return savedTheme === 'dark' ? -180 : 0;
    });

    // --- NOTIFICATION STATE ---
    const [notifications, setNotifications] = useState([]);
    const [showNotifs, setShowNotifs] = useState(false);
    const notifRef = useRef(null);

    const [openNavMenus, setOpenNavMenus] = useState({});
    const [mountedPath, setMountedPath] = useState(null);
    const lastPath = sessionStorage.getItem('lastPath') || null;

    const [showCalendar, setShowCalendar] = useState(false);

    const [isShining, setIsShining] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleLogoClick = () => {
        setIsShining(true);
        setTimeout(() => setIsShining(false), 600);
    };

    // --- ORNAMENTAL CLOCK & GREETING ---
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        setIsMobileMenuOpen(false);
        const timer = setTimeout(() => {
            setMountedPath(location.pathname);
            sessionStorage.setItem('lastPath', location.pathname);
        }, 10);
        return () => clearTimeout(timer);
    }, [location.pathname]);

    // Lock background scrolling on mobile when sidebar is open
    useEffect(() => {
        if (isMobileMenuOpen) {
            document.body.classList.add('sidebar-open');
            document.documentElement.classList.add('sidebar-open');
        } else {
            document.body.classList.remove('sidebar-open');
            document.documentElement.classList.remove('sidebar-open');
        }
        return () => {
            document.body.classList.remove('sidebar-open');
            document.documentElement.classList.remove('sidebar-open');
        };
    }, [isMobileMenuOpen]);

    // Dynamic Theme Variables for Native Elements - Flat 2.0
    const t = isDarkMode ? {
        bg: '#0b0f17',
        surface: '#131b2e',
        card: '#131b2e',
        border: '#1e293b',
        borderHover: '#334155',
        text: '#f1f5f9',
        textMuted: '#94a3b8',
        textSub: '#64748b',
        navActiveBg: '#2563eb',
        navActiveText: '#ffffff',
        dangerBg: 'rgba(239, 68, 68, 0.1)',
        dangerText: '#ef4444'
    } : {
        bg: '#f8fafc',
        surface: '#ffffff',
        card: '#ffffff',
        border: '#e2e8f0',
        borderHover: '#cbd5e1',
        text: '#0f172a',
        textMuted: '#475569',
        textSub: '#64748b',
        navActiveBg: '#0f172a',
        navActiveText: '#ffffff',
        dangerBg: '#fef2f2',
        dangerText: '#b91c1c'
    };

    const sb = isDarkMode ? {
        bg: t.surface,
        border: t.border,
        borderLight: t.border,
        text: t.text,
        textMuted: t.textMuted,
        textSub: t.textSub,
        card: t.card,
        navActiveBg: t.navActiveBg,
        navActiveText: t.navActiveText,
        navHoverBg: t.card,
        navHoverText: t.text
    } : {
        bg: '#184F7E',
        border: 'rgba(255, 255, 255, 0.1)',
        borderLight: 'rgba(255, 255, 255, 0.05)',
        text: '#ffffff',
        textMuted: 'rgba(255, 255, 255, 0.7)',
        textSub: 'rgba(255, 255, 255, 0.5)',
        card: 'rgba(0, 0, 0, 0.2)',
        navActiveBg: 'rgba(255, 255, 255, 0.2)',
        navActiveText: '#ffffff',
        navHoverBg: 'rgba(255, 255, 255, 0.1)',
        navHoverText: '#ffffff'
    };

    // Apply global body classes when theme changes
    useEffect(() => {
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        if (isDarkMode) {
            document.body.classList.remove('light-mode');
            document.body.style.backgroundColor = '#1e1e1e';
        } else {
            document.body.classList.add('light-mode');
            document.body.style.backgroundColor = 'var(--bg-main)';
        }

        return () => {
            document.body.classList.remove('light-mode');
            document.body.style.backgroundColor = '';
        };
    }, [isDarkMode]);

    useEffect(() => {
        const fetchNotifs = async () => {
            if (!user?.employee_id) return;
            try {
                const response = await api.get(`/notifications?emp_id=${user.employee_id}`);
                setNotifications(response.data);
            } catch (err) { console.error("Notification fetch failed"); }
        };

        fetchNotifs();
        const interval = setInterval(fetchNotifs, 30000);
        return () => clearInterval(interval);
    }, [user]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notifRef.current && !notifRef.current.contains(event.target)) {
                setShowNotifs(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("touchstart", handleClickOutside, { passive: true });
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("touchstart", handleClickOutside);
        };
    }, []);

    // Close mobile menu when route changes
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    const markAsRead = async (ticketId) => {
        try {
            await api.post('/notifications/mark-read', { ticket_id: ticketId });
            setNotifications(notifications.map(n => n.ticket_id === ticketId ? { ...n, is_read: true } : n));
        } catch (err) { console.error("Failed to mark as read"); }
    };

    const markAllAsRead = async () => {
        if (!user || !user.employee_id) return;
        try {
            await api.post('/notifications/mark-all-read', { emp_id: user.employee_id });
            setNotifications(notifications.map(n => ({ ...n, is_read: true })));
        } catch (err) { console.error("Failed to mark all as read"); }
    };

    const handleLogout = () => {
        sessionStorage.removeItem('ticket_user');
        if (setUser) setUser(null);
        navigate('/');
    };

    if (!user) {
        return (
            <div style={{ height: '100vh', minHeight: 0, backgroundColor: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMuted }}>
                <p>Authenticating session...</p>
            </div>
        );
    }

    const [isReportingManager, setIsReportingManager] = useState(false);

    useEffect(() => {
        const checkManagerStatus = async () => {
            if (!user?.employee_id && !user?.email) return;
            try {
                const usersData = await fetchUsers();
                if (Array.isArray(usersData)) {
                    const isMgr = usersData.some(u =>
                        u.reporting_manager && (String(u.reporting_manager) === String(user.employee_id) || String(u.reporting_manager) === String(user.email))
                    );
                    setIsReportingManager(isMgr);
                }
            } catch (err) {
                console.error("Failed to check reporting manager status", err);
            }
        };
        checkManagerStatus();
    }, [user]);

    const getNavLinks = () => {
        const links = [];
        const secRoles = (user.secondary_roles || '').split(',').map(r => r.trim());
        const isUserRole = user.role === 'User' || secRoles.includes('User');
        const isViewerRole = user.role === 'Viewer' || secRoles.includes('Viewer');

        if (['Admin'].includes(user.role)) {
            links.push({ name: 'System Admin', path: '/admin', icon: <Settings size={13} /> });
        }
        if (['Superadmin', 'Super Admin'].includes(user.role)) {
            links.push({ name: 'Super Admin Workspace', path: '/superadmin', icon: <Settings size={13} /> });
        }
        if (isUserRole) {
            links.push({ name: 'Requestor Workspace', path: '/requestor', icon: <Ticket size={13} /> });
            links.push({ name: 'Solver Workspace', path: '/solver', icon: <CheckSquare size={13} /> });
        }
        if (isViewerRole) {
            links.push({ name: 'Viewer Dashboard', path: '/viewer', icon: <BarChart2 size={13} /> });
        }
        if (isReportingManager) {
            links.push({ name: 'Manager Dashboard', path: '/manager', icon: <Users size={13} /> });
        }
        return links;
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const toggleNavMenu = (path) => {
        setOpenNavMenus(prev => ({
            ...prev,
            [path]: !prev[path]
        }));
    };

    // --- DYNAMIC GREETING LOGIC (ENFORCED INDIA STANDARD TIME - ASIA/KOLKATA) ---
    const istDateStr = currentTime.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const istDate = new Date(istDateStr);
    const hour = istDate.getHours();
    let greeting = 'Good Evening';
    if (hour < 12) greeting = 'Good Morning';
    else if (hour < 17) greeting = 'Good Afternoon';

    const dateOptions = { timeZone: 'Asia/Kolkata', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateString = currentTime.toLocaleDateString('en-IN', dateOptions);
    const shortDateString = currentTime.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });
    const timeString = currentTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });

    return (
        <div className="app-layout" style={{ display: 'flex', height: '100%', minHeight: '100%', overflow: 'hidden', backgroundColor: t.bg, color: t.text, transition: 'background-color 0.3s' }}>

            {/* GLOBAL CSS OVERRIDE ENGINE FOR LIGHT MODE */}
            <style>{`
                body.light-mode .dashboard-wrapper div[style*="background-color: rgb(24, 24, 27)"],
                body.light-mode .dashboard-wrapper div[style*="background-color: #18181b"],
                body.light-mode .dashboard-wrapper div[style*="background-color: rgb(9, 9, 11)"],
                body.light-mode .dashboard-wrapper div[style*="background-color: #09090b"],
                body.light-mode .dashboard-wrapper div[style*="backgroundColor: #18181b"],
                body.light-mode .dashboard-wrapper div[style*="background-color: #000000"],
                body.light-mode .dashboard-wrapper div[style*="background-color: rgb(0, 0, 0)"] {
                    background-color: #ffffff !important;
                    border-color: #cbd5e1 !important; 
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06) !important; 
                }

                body.light-mode .dashboard-wrapper div[style*="rgba(0, 0, 0, 0.75)"],
                body.light-mode .dashboard-wrapper div[style*="rgba(0, 0, 0, 0.85)"] {
                    background-color: rgba(15, 23, 42, 0.5) !important;
                    backdrop-filter: blur(4px) !important;
                }

                body.light-mode .dashboard-wrapper,
                body.light-mode .dashboard-wrapper h1, 
                body.light-mode .dashboard-wrapper h2, 
                body.light-mode .dashboard-wrapper h3, 
                body.light-mode .dashboard-wrapper h4, 
                body.light-mode .dashboard-wrapper h5, 
                body.light-mode .dashboard-wrapper h6, 
                body.light-mode .dashboard-wrapper strong,
                body.light-mode .dashboard-wrapper .card h2,
                body.light-mode .dashboard-wrapper .card h3 {
                    color: #0f172a !important;
                }

                body.light-mode .dashboard-wrapper [style*="color: rgb(255, 255, 255)"],
                body.light-mode .dashboard-wrapper [style*="color: rgb(237, 237, 237)"],
                body.light-mode .dashboard-wrapper [style*="color: rgb(212, 212, 216)"],
                body.light-mode .dashboard-wrapper [style*="color: #fff"],
                body.light-mode .dashboard-wrapper [style*="color: #ffffff"],
                body.light-mode .dashboard-wrapper [style*="color: #ededed"],
                body.light-mode .dashboard-wrapper [style*="color: #d4d4d8"] {
                    color: #0f172a !important;
                }

                body.light-mode .dashboard-wrapper [style*="color: rgb(161, 161, 170)"],
                body.light-mode .dashboard-wrapper [style*="color: rgb(113, 113, 122)"],
                body.light-mode .dashboard-wrapper [style*="color: #a1a1aa"],
                body.light-mode .dashboard-wrapper [style*="color: #71717a"] {
                    color: #475569 !important;
                    font-weight: 600 !important;
                }

                body.light-mode .dashboard-wrapper input:not(.no-inner-border),
                body.light-mode .dashboard-wrapper select,
                body.light-mode .dashboard-wrapper textarea,
                body.light-mode .dashboard-wrapper .form-control {
                    background-color: #f8fafc !important;
                    color: #0f172a !important;
                    border: 1px solid #94a3b8 !important;
                    box-shadow: inset 0 1px 2px rgba(0,0,0,0.05) !important;
                }
                body.light-mode .dashboard-wrapper input::placeholder,
                body.light-mode .dashboard-wrapper textarea::placeholder {
                    color: #94a3b8 !important;
                }

                body.light-mode .dashboard-wrapper table {
                    color: #0f172a !important;
                }
                body.light-mode .dashboard-wrapper table thead,
                body.light-mode .dashboard-wrapper table th {
                    background-color: #f1f5f9 !important;
                    color: #1e293b !important;
                    border-bottom: 2px solid #94a3b8 !important;
                    font-weight: 700 !important;
                }
                body.light-mode .dashboard-wrapper table tr {
                    border-bottom: 1px solid #cbd5e1 !important;
                }
                body.light-mode .dashboard-wrapper table td {
                    color: #0f172a !important;
                    font-weight: 500 !important;
                }
                body.light-mode .dashboard-wrapper table tr:hover {
                    background-color: #f1f5f9 !important;
                }

                body.light-mode .dashboard-wrapper table td[style*="color: rgb(255, 255, 255)"],
                body.light-mode .dashboard-wrapper table td[style*="color: rgb(161, 161, 170)"] {
                    color: #0f172a !important;
                }

                body.light-mode .dashboard-wrapper [style*="border-bottom: 1px solid #27272a"],
                body.light-mode .dashboard-wrapper [style*="border-top: 1px solid #27272a"],
                body.light-mode .dashboard-wrapper [style*="border: 1px solid #27272a"],
                body.light-mode .dashboard-wrapper [style*="border: 1px solid #3f3f46"],
                body.light-mode .dashboard-wrapper [style*="border-bottom: 2px solid #27272a"],
                body.light-mode .dashboard-wrapper [style*="borderBottom: 1px solid #27272a"],
                body.light-mode .dashboard-wrapper [style*="borderTop: 1px solid #27272a"] {
                    border-color: #cbd5e1 !important;
                }

                body.light-mode .dashboard-wrapper span[style*="background-color: rgba(59, 130, 246, 0.1)"] {
                    background-color: #eff6ff !important;
                    color: #1d4ed8 !important;
                    border: 1px solid #bfdbfe !important;
                }
                body.light-mode .dashboard-wrapper span[style*="background-color: rgba(16, 185, 129, 0.1)"] {
                    background-color: #ecfdf5 !important;
                    color: #047857 !important;
                    border: 1px solid #a7f3d0 !important;
                }
                body.light-mode .dashboard-wrapper span[style*="background-color: rgba(239, 68, 68, 0.1)"] {
                    background-color: #fef2f2 !important;
                    color: #b91c1c !important;
                    border: 1px solid #fecaca !important;
                }
            `}</style>

            {/* SIDEBAR NAVIGATION */}
            <aside className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`} style={{
                width: '200px', backgroundColor: sb.bg, borderRight: `1px solid ${sb.border}`,
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 400' preserveAspectRatio='xMidYMax slice'%3E%3Cpath fill='rgba(255,255,255,0.04)' d='M10,400V250h20v-30h30v-40h20v70h30v-80h25v50h30v-20h35v200H10z'/%3E%3Cpath fill='rgba(255,255,255,0.06)' d='M0,400V280h25v-50h20v-20h35v70h15v-40h45v30h30v-10h30v190H0z'/%3E%3Cpath fill='rgba(255,255,255,0.08)' d='M0,400V310h30v-40h25v20h20v-60h30v80h25v-30h40v-20h30v150H0z'/%3E%3C/svg%3E")`,
                backgroundPosition: 'bottom center', backgroundRepeat: 'no-repeat', backgroundSize: 'cover',
                position: 'fixed', top: 0, bottom: 0, height: '100%', maxHeight: '100dvh', display: 'flex', flexDirection: 'column', zIndex: 1100, transition: 'background-color 0.3s, border-color 0.3s',
                overflow: 'hidden', // Ensure the sun/moon don't peek outside when they drop down
                overscrollBehavior: 'contain'
            }}>
                {/* CELESTIAL ANIMATION & GLOW */}
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>

                    {/* Sun Glow */}
                    <div style={{
                        position: 'absolute', top: 0, left: 0, width: '100%', height: '50%',
                        background: 'radial-gradient(circle at 75% 15%, rgba(253, 224, 71, 0.25) 0%, transparent 120px), radial-gradient(circle at top left, rgba(253, 224, 71, 0.15) 0%, transparent 100px)',
                        transition: 'opacity 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
                        opacity: isDarkMode ? 0 : 1,
                    }}></div>

                    {/* Moon Glow */}
                    <div style={{
                        position: 'absolute', top: 0, left: 0, width: '100%', height: '50%',
                        background: 'radial-gradient(circle at 75% 15%, rgba(226, 232, 240, 0.12) 0%, transparent 120px)',
                        transition: 'opacity 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
                        opacity: isDarkMode ? 1 : 0,
                    }}></div>

                    {/* Skyline Windows */}
                    <svg
                        viewBox="0 0 200 400"
                        preserveAspectRatio="xMidYMax slice"
                        style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '85%', zIndex: 1, pointerEvents: 'none' }}
                    >
                        {/* Always Dim Windows */}
                        <g fill="rgba(255,255,255,0.06)">
                            <rect x="20" y="325" width="3" height="4" />
                            <rect x="15" y="365" width="3" height="4" />
                            <rect x="35" y="305" width="3" height="4" />
                            <rect x="40" y="325" width="3" height="4" />
                            <rect x="68" y="325" width="3" height="4" />
                            <rect x="82" y="245" width="3" height="4" />
                            <rect x="94" y="265" width="3" height="4" />
                            <rect x="82" y="305" width="3" height="4" />
                            <rect x="117" y="345" width="3" height="4" />
                            <rect x="140" y="295" width="3" height="4" />
                            <rect x="155" y="315" width="3" height="4" />
                            <rect x="140" y="335" width="3" height="4" />
                            <rect x="188" y="275" width="3" height="4" />
                            <rect x="178" y="335" width="3" height="4" />
                        </g>

                        {/* Lit at Night Windows */}
                        <g
                            fill={isDarkMode ? '#fde047' : 'rgba(255,255,255,0.12)'}
                            style={{ transition: 'fill 1.5s cubic-bezier(0.4, 0, 0.2, 1)' }}
                        >
                            <rect x="10" y="325" width="3" height="4" />
                            <rect x="10" y="345" width="3" height="4" />
                            <rect x="20" y="345" width="3" height="4" />
                            <rect x="35" y="285" width="3" height="4" />
                            <rect x="45" y="285" width="3" height="4" />
                            <rect x="45" y="305" width="3" height="4" />
                            <rect x="35" y="345" width="3" height="4" />
                            <rect x="45" y="345" width="3" height="4" />
                            <rect x="60" y="305" width="3" height="4" />
                            <rect x="68" y="305" width="3" height="4" />
                            <rect x="60" y="325" width="3" height="4" />
                            <rect x="64" y="345" width="3" height="4" />
                            <rect x="94" y="245" width="3" height="4" />
                            <rect x="82" y="265" width="3" height="4" />
                            <rect x="88" y="285" width="3" height="4" />
                            <rect x="94" y="305" width="3" height="4" />
                            <rect x="88" y="325" width="3" height="4" />
                            <rect x="112" y="325" width="3" height="4" />
                            <rect x="122" y="325" width="3" height="4" />
                            <rect x="150" y="295" width="3" height="4" />
                            <rect x="160" y="295" width="3" height="4" />
                            <rect x="145" y="315" width="3" height="4" />
                            <rect x="160" y="335" width="3" height="4" />
                            <rect x="178" y="275" width="3" height="4" />
                            <rect x="178" y="295" width="3" height="4" />
                            <rect x="188" y="295" width="3" height="4" />
                            <rect x="183" y="315" width="3" height="4" />
                            <rect x="188" y="335" width="3" height="4" />
                        </g>
                    </svg>

                    {/* Celestial Icons */}
                    <div style={{ position: 'absolute', top: '15%', right: '25%' }}>
                        {/* Sun */}
                        <div style={{
                            position: 'absolute',
                            transition: 'all 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
                            opacity: isDarkMode ? 0 : 1,
                            transformOrigin: '50% 150px',
                            transform: `rotate(${skyRotation}deg)`,
                            color: '#fde047'
                        }}>
                            <div style={{ transition: 'transform 1.5s cubic-bezier(0.4, 0, 0.2, 1)', transform: `rotate(${-skyRotation}deg)` }}>
                                <Sun size={70} strokeWidth={1} fill="currentColor" />
                            </div>
                        </div>

                        {/* Moon */}
                        <div style={{
                            position: 'absolute',
                            transition: 'all 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
                            opacity: isDarkMode ? 1 : 0,
                            transformOrigin: '50% 150px',
                            transform: `rotate(${skyRotation - 180}deg)`,
                            color: '#e2e8f0'
                        }}>
                            <div style={{ transition: 'transform 1.5s cubic-bezier(0.4, 0, 0.2, 1)', transform: `rotate(${-(skyRotation - 180)}deg)` }}>
                                <Moon size={70} strokeWidth={1} fill="currentColor" />
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1, position: 'relative', flexShrink: 0 }}>
                    <h2 style={{ fontSize: '13px', color: sb.text, margin: 0, fontWeight: '700', letterSpacing: '0.05em' }}>ISSUE TRACKER</h2>
                    {isMobileMenuOpen && (
                        <button
                            onClick={() => setIsMobileMenuOpen(false)}
                            style={{
                                background: 'transparent', border: 'none', color: sb.textMuted, cursor: 'pointer',
                                padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                            title="Close Sidebar"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>

                <div style={{ padding: '11px 13px', margin: '16px 13px 8px 13px', backgroundColor: sb.card, borderRadius: '8px', border: `1px solid ${sb.borderLight}`, flexShrink: 0, zIndex: 1, position: 'relative' }}>
                    <h3 style={{ fontSize: '11px', margin: '0 0 4px 0', color: sb.text }}>{user.name || 'Unknown User'}</h3>
                    <p style={{ fontSize: '10px', color: sb.textMuted, margin: '0 0 4px 0', fontWeight: '500' }}>
                        {user.role || 'No Role'} | {user.department || 'No Dept'}
                    </p>
                    <p style={{ fontSize: '10px', color: sb.textSub, margin: 0, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        ID: {user.employee_id || 'N/A'}
                    </p>
                </div>

                <div className="sidebar-nav-scroll" style={{ flex: '1 1 0', minHeight: 0, padding: '8px 13px', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', touchAction: 'pan-y', zIndex: 1, position: 'relative' }}>
                    <p style={{ fontSize: '10px', fontWeight: '600', color: sb.textSub, marginBottom: '10px', marginTop: '8px', textTransform: 'uppercase', paddingLeft: '6px', letterSpacing: '0.05em' }}>
                        Navigation
                    </p>
                    {getNavLinks().map((link) => {
                        const isActiveRoute = location.pathname.startsWith(link.path);
                        const wasActive = lastPath && lastPath.startsWith(link.path);

                        let isOpen = false;
                        if (mountedPath === location.pathname) {
                            isOpen = openNavMenus[link.path] !== undefined ? openNavMenus[link.path] : isActiveRoute;
                        } else {
                            isOpen = openNavMenus[link.path] !== undefined ? openNavMenus[link.path] : wasActive;
                        }

                        const linkTabs = isActiveRoute ? sidebarTabs : TABS_CONFIG[link.path];
                        const hasTabs = linkTabs && linkTabs.length > 0;

                        return (
                            <div key={link.path}>
                                <Link
                                    to={link.path}
                                    onClick={(e) => {
                                        if (isActiveRoute) {
                                            e.preventDefault();
                                        } else {
                                            setIsMobileMenuOpen(false);
                                        }
                                        toggleNavMenu(link.path);
                                    }}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '8px 11px', textDecoration: 'none',
                                        borderRadius: '6px', marginBottom: '5px',
                                        backgroundColor: isActiveRoute ? sb.navActiveBg : 'transparent',
                                        color: isActiveRoute ? sb.navActiveText : sb.textMuted,
                                        fontWeight: isActiveRoute ? '600' : '500',
                                        fontSize: '11px',
                                        transition: 'all 0.2s',
                                    }}
                                    onMouseOver={(e) => { if (!isActiveRoute) { e.currentTarget.style.backgroundColor = sb.navHoverBg; e.currentTarget.style.color = sb.navHoverText; } }}
                                    onMouseOut={(e) => { if (!isActiveRoute) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = sb.textMuted; } }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {link.icon}
                                        {link.name}
                                    </div>

                                    {hasTabs && (
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            {isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                        </div>
                                    )}
                                </Link>

                                {hasTabs && (
                                    <div style={{
                                        display: 'flex', flexDirection: 'column', gap: '4px',
                                        paddingLeft: '26px',
                                        borderLeft: `1px solid ${sb.border}`, marginLeft: '13px',
                                        maxHeight: isOpen ? '300px' : '0px',
                                        opacity: isOpen ? 1 : 0,
                                        overflow: 'hidden',
                                        transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), margin 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        marginBottom: isOpen ? '13px' : '0px',
                                        marginTop: isOpen ? '4px' : '0px',
                                        pointerEvents: isOpen ? 'auto' : 'none'
                                    }}>
                                        {linkTabs.map(tab => (
                                            <button
                                                key={tab.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsMobileMenuOpen(false);
                                                    if (isActiveRoute && setActiveTab) {
                                                        setActiveTab(tab.id);
                                                    } else {
                                                        navigate(link.path);
                                                    }
                                                }}
                                                style={{
                                                    textAlign: 'left', padding: '6px 10px',
                                                    backgroundColor: activeTab === tab.id ? sb.navHoverBg : 'transparent',
                                                    color: activeTab === tab.id ? sb.navHoverText : sb.textSub,
                                                    border: 'none', borderRadius: '4px', cursor: 'pointer',
                                                    fontSize: '10px', fontWeight: activeTab === tab.id ? '600' : '400',
                                                    transition: 'all 0.2s',
                                                    display: 'flex', alignItems: 'center', gap: '8px'
                                                }}
                                                onMouseOver={(e) => { if (activeTab !== tab.id) { e.currentTarget.style.color = sb.navHoverText; e.currentTarget.style.backgroundColor = isDarkMode ? sb.navHoverBg : 'rgba(255, 255, 255, 0.05)'; } }}
                                                onMouseOut={(e) => { if (activeTab !== tab.id) { e.currentTarget.style.color = sb.textSub; e.currentTarget.style.backgroundColor = 'transparent'; } }}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div style={{ padding: '16px', borderTop: `1px solid ${t.border}`, flexShrink: 0, marginTop: 'auto', zIndex: 1, position: 'relative' }}>
                    <button
                        onClick={handleLogout}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            padding: '10px', background: t.dangerBg, border: 'none', borderRadius: '6px',
                            color: t.dangerText, cursor: 'pointer', fontWeight: '600', width: '100%', fontSize: '11px',
                            transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#ef4444'; e.currentTarget.style.color = '#ffffff'; }}
                        onMouseOut={(e) => { e.currentTarget.style.backgroundColor = t.dangerBg; e.currentTarget.style.color = t.dangerText; }}
                    >
                        <LogOut size={13} /> Log Out
                    </button>
                </div>
            </aside>

            {/* MOBILE SIDEBAR BACKDROP OVERLAY */}
            {isMobileMenuOpen && (
                <div
                    className="mobile-sidebar-backdrop"
                    onClick={() => setIsMobileMenuOpen(false)}
                    onTouchMove={(e) => e.preventDefault()}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                        backdropFilter: 'blur(2px)',
                        WebkitBackdropFilter: 'blur(2px)',
                        zIndex: 1090,
                        cursor: 'pointer',
                        touchAction: 'none',
                        overscrollBehavior: 'contain'
                    }}
                />
            )}

            {/* MAIN DASHBOARD CONTENT AREA */}
            <div className="dashboard-wrapper main-content" style={{ marginLeft: '200px', flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden', maxWidth: '100%' }}>

                <header className="app-header" style={{
                    height: '52px', backgroundColor: t.surface, borderBottom: `1px solid ${t.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px',
                    position: 'fixed', top: 0, right: 0, left: '200px', zIndex: 1000, transition: 'background-color 0.3s, border-color 0.3s, left 0.3s'
                }}>
                    {/* ORNAMENTAL GREETING (LEFT BAR) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button
                            className="mobile-menu-btn"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            style={{
                                background: 'transparent', border: 'none', color: t.text, cursor: 'pointer',
                                display: 'none', padding: '4px'
                            }}
                        >
                            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                        <style>{`
                            @media (max-width: 768px) {
                                .mobile-menu-btn { display: block !important; }
                                .app-header { left: 0 !important; }
                            }
                        `}</style>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0, overflow: 'hidden' }}>
                            <h2 className="header-greeting-text" style={{ fontSize: '13px', margin: 0, fontWeight: 600, color: t.text, display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                <span className="greeting-prefix">{greeting}, </span><span style={{ color: '#3b82f6', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name || 'User'}</span>
                            </h2>
                            <span className="header-date-time" style={{ fontSize: '10px', color: t.textMuted, fontWeight: 500, display: 'flex', alignItems: 'center' }}>
                                <span className="header-date-desktop">{dateString}</span>
                                <span className="header-date-mobile">{shortDateString}</span>
                                <span style={{ margin: '0 4px', color: t.borderHover }}>|</span>
                                <span style={{ fontFamily: 'monospace', fontSize: '10.5px', letterSpacing: '0.04em' }}>{timeString}</span>
                            </span>
                        </div>
                    </div>

                    <style>{`
                        @keyframes slideTagline {
                            0% { transform: translateX(-70vw); opacity: 0; filter: blur(4px); animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1); }
                            25% { transform: translateX(0); opacity: 1; filter: blur(0px); }
                            85% { transform: translateX(0); opacity: 1; filter: blur(0px); animation-timing-function: ease-in; }
                            95% { transform: translateX(3vw); opacity: 0; filter: blur(4px); }
                            100% { transform: translateX(-70vw); opacity: 0; filter: blur(4px); }
                        }
                    `}</style>

                    {/* ACTIONS & LOGO (RIGHT BAR) */}
                    <div className="header-actions" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                        <div className="header-logo-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: '20px' }}>
                            <img
                                src="/logo.png"
                                alt="Ambuja Neotia Logo"
                                style={{ height: '26px', objectFit: 'contain', marginBottom: '1px', cursor: 'pointer' }}
                                onClick={handleLogoClick}
                                className={isShining ? 'logo-shine' : ''}
                            />
                            <span className="header-tagline" style={{
                                fontSize: '7.5px',
                                color: t.textMuted,
                                fontWeight: '500',
                                letterSpacing: '1.2px',
                                textTransform: 'uppercase',
                                whiteSpace: 'nowrap',
                                animation: 'slideTagline 25s infinite'
                            }}>
                                making a difference to the way people live
                            </span>
                        </div>

                        <button
                            className="header-action-btn"
                            onClick={() => setShowCalendar(true)}
                            style={{
                                background: 'transparent', border: 'none', cursor: 'pointer',
                                padding: '6px', borderRadius: '50%', marginRight: '8px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: t.textMuted, transition: 'all 0.2s', flexShrink: 0
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = t.card}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            title="Open Calendar"
                        >
                            <Calendar size={16} />
                        </button>

                        <button
                            className="header-action-btn"
                            onClick={() => {
                                setIsDarkMode(!isDarkMode);
                                setSkyRotation(prev => prev - 180);
                            }}
                            style={{
                                background: 'transparent', border: 'none', cursor: 'pointer',
                                padding: '6px', borderRadius: '50%', marginRight: '12px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: t.textMuted, transition: 'all 0.2s', flexShrink: 0
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = t.card}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                        >
                            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                        </button>

                        <div ref={notifRef} className="header-notif-wrapper" style={{ position: 'relative', flexShrink: 0, zIndex: 1200 }}>
                            <button
                                className="header-notif-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowNotifs(prev => !prev);
                                }}
                                style={{
                                    background: showNotifs ? t.card : 'transparent', border: '1px solid', borderColor: showNotifs ? t.borderHover : 'transparent',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    padding: '6px', borderRadius: '50%', transition: 'all 0.2s', flexShrink: 0
                                }}
                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = t.card}
                                onMouseOut={(e) => { if (!showNotifs) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                title="Notifications"
                            >
                                <Bell size={16} color={unreadCount > 0 ? t.text : t.textMuted} />

                                {unreadCount > 0 && (
                                    <span style={{
                                        position: 'absolute', top: '-2px', right: '-2px', backgroundColor: '#ef4444',
                                        color: '#fff', borderRadius: '50%', width: '13px', height: '13px', fontSize: '10px',
                                        fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        border: `2px solid ${t.surface}`
                                    }}>
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </button>

                            {showNotifs && (
                                <div style={{
                                    position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: '280px', maxWidth: 'calc(100vw - 16px)',
                                    backgroundColor: t.card, border: `1px solid ${t.borderHover}`, borderRadius: '6px',
                                    boxShadow: '0 8px 20px rgba(0,0,0,0.2)', overflow: 'hidden', zIndex: 2000
                                }}>
                                    <div style={{ padding: '12px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: t.surface }}>
                                        <h4 style={{ margin: 0, fontSize: '11px', color: t.text, fontWeight: '600' }}>Notifications</h4>
                                        {unreadCount > 0 && (
                                            <button onClick={markAllAsRead} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <CheckCircle2 size={10} /> Mark all read
                                            </button>
                                        )}
                                    </div>

                                    <div style={{ maxHeight: '320px', overflowY: 'auto', overflowX: 'hidden' }}>
                                        {notifications.length === 0 ? (
                                            <div style={{ padding: '24px 16px', textAlign: 'center', color: t.textSub, fontSize: '10px' }}>
                                                You're all caught up! No notifications yet.
                                            </div>
                                        ) : (
                                            notifications.map((n, idx) => (
                                                <div
                                                    key={`notif-${idx}`}
                                                    onClick={() => !n.is_read && markAsRead(n.ticket_id)}
                                                    style={{
                                                        padding: '10px 12px', borderBottom: `1px solid ${t.border}`, cursor: n.is_read ? 'default' : 'pointer',
                                                        backgroundColor: n.is_read ? 'transparent' : (isDarkMode ? 'rgba(59, 130, 246, 0.05)' : '#eff6ff'),
                                                        transition: 'background-color 0.2s'
                                                    }}
                                                    onMouseOver={e => { if (!n.is_read) e.currentTarget.style.backgroundColor = t.border; }}
                                                    onMouseOut={e => { if (!n.is_read) e.currentTarget.style.backgroundColor = (isDarkMode ? 'rgba(59, 130, 246, 0.05)' : '#eff6ff'); }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            {n.role_context && n.role_context !== 'System' && (
                                                                <span style={{
                                                                    fontSize: '8px', padding: '2px 6px', borderRadius: '12px', fontWeight: 'bold', width: 'fit-content',
                                                                    backgroundColor: n.role_context === 'Requestor' ? (isDarkMode ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe') :
                                                                        n.role_context === 'Solver' ? (isDarkMode ? 'rgba(249, 115, 22, 0.2)' : '#ffedd5') :
                                                                            n.role_context === 'Superadmin' ? (isDarkMode ? 'rgba(234, 179, 8, 0.2)' : '#fef3c7') :
                                                                                n.role_context === 'Admin' ? (isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2') :
                                                                                    n.role_context === 'Viewer' ? (isDarkMode ? 'rgba(168, 85, 247, 0.2)' : '#f3e8ff') :
                                                                                        (isDarkMode ? 'rgba(156, 163, 175, 0.2)' : '#f3f4f6'),
                                                                    color: n.role_context === 'Requestor' ? (isDarkMode ? '#93c5fd' : '#2563eb') :
                                                                        n.role_context === 'Solver' ? (isDarkMode ? '#fdba74' : '#ea580c') :
                                                                            n.role_context === 'Superadmin' ? (isDarkMode ? '#fde047' : '#d97706') :
                                                                                n.role_context === 'Admin' ? (isDarkMode ? '#fca5a5' : '#dc2626') :
                                                                                    n.role_context === 'Viewer' ? (isDarkMode ? '#d8b4fe' : '#9333ea') :
                                                                                        (isDarkMode ? '#d1d5db' : '#4b5563')
                                                                }}>
                                                                    {n.role_context === 'Viewer' ? 'CC (Viewer)' : n.role_context}
                                                                </span>
                                                            )}
                                                            <span style={{ fontSize: '10px', lineHeight: '1.4', color: n.is_read ? t.textMuted : t.text, fontWeight: n.is_read ? '400' : '600', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                                                                {n.message}
                                                            </span>
                                                        </div>
                                                        {!n.is_read && <span style={{ width: '6px', height: '6px', backgroundColor: '#3b82f6', borderRadius: '50%', flexShrink: 0, marginTop: '4px' }}></span>}
                                                    </div>
                                                    <div style={{ fontSize: '10px', color: t.textSub, marginTop: '5px' }}>{n.timestamp}</div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <main className="app-main-content" style={{ padding: '16px 24px 8px 24px', flex: 1, marginTop: '52px', display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        {children}
                    </div>
                </main>
            </div>

            {showCalendar && (
                <CalendarModal
                    user={user}
                    isDarkMode={isDarkMode}
                    onClose={() => setShowCalendar(false)}
                />
            )}
        </div>
    );
};

export default Layout;