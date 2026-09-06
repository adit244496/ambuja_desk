import axios from 'axios';

// Point this to your Flask server address
const API_URL = '/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Attach current user identity in requests if logged in
api.interceptors.request.use((config) => {
    try {
        const stored = sessionStorage.getItem('ticket_user');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.email) config.headers['X-User-Email'] = parsed.email;
            if (parsed.employee_id) config.headers['X-User-EmpId'] = parsed.employee_id;
        }
    } catch (e) { }
    return config;
}, (error) => Promise.reject(error));

// Global response interceptor to handle instant logout if deactivated
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            const errMsg = error.response.data?.error || '';
            if (errMsg.toLowerCase().includes('deactivated') || errMsg.toLowerCase().includes('no longer exists')) {
                sessionStorage.removeItem('ticket_user');
                alert(errMsg || "Your account has been deactivated. Logging out.");
                window.location.href = '/';
            }
        }
        return Promise.reject(error);
    }
);

// --- AUTHENTICATION ---
export const checkUserAuthStatus = async (user) => {
    if (!user) return { active: false };
    const params = {
        email: user.email || '',
        emp_id: user.employee_id || ''
    };
    const response = await api.get('/auth/status', { params });
    return response.data;
};

export const loginUser = async (credentials) => {
    const response = await api.post('/login', credentials);
    return response.data;
};

export const resetFirstPassword = async (data) => {
    const response = await api.post('/reset-first-password', data);
    return response.data;
};

// --- TICKETS ---
export const deleteTickets = async (ticketIds, userEmail) => {
    const response = await api.post('/tickets/delete', { ticket_ids: ticketIds, user_email: userEmail });
    return response.data;
};

export const fetchTickets = async (returnAllRows = false) => {
    const response = await api.get('/tickets');
    if (Array.isArray(response.data) && !returnAllRows) {
        // The backend appends updates; keep only the latest (last) entry for each ticket_id
        const uniqueTickets = {};
        for (const t of response.data) {
            const existing = uniqueTickets[t.ticket_id];

            if (!existing) {
                uniqueTickets[t.ticket_id] = t;
                continue;
            }

            const existingClosed = existing.closed_timestamp && String(existing.closed_timestamp).trim() !== '' && String(existing.closed_timestamp).toLowerCase() !== 'nan';
            const newClosed = t.closed_timestamp && String(t.closed_timestamp).trim() !== '' && String(t.closed_timestamp).toLowerCase() !== 'nan';

            // If the existing row is still active (no closed_timestamp) but the newer row is closed (e.g. an escalation that was Declined),
            // keep the active row as the master state for the ticket.
            if (!existingClosed && newClosed) {
                continue;
            } else {
                uniqueTickets[t.ticket_id] = t;
            }
        }
        return Object.values(uniqueTickets);
    }
    return response.data;
};

export const createTicket = async (ticketData) => {
    // Let browser set the correct multipart/form-data boundary automatically
    const response = await axios.post(`${API_URL}/tickets/create`, ticketData);
    return response.data;
};

export const updateTicketStatus = async (updateData) => {
    if (updateData instanceof FormData) {
        const response = await axios.post(`${API_URL}/tickets/update_status`, updateData);
        return response.data;
    } else {
        const response = await api.post('/tickets/update_status', updateData);
        return response.data;
    }
};

export const requestTicketHandover = async (data) => {
    const response = await api.post('/tickets/handover', data);
    return response.data;
};

export const approveHandover = async (data) => {
    const payload = {
        ...data,
        decision: data?.decision || (data?.approve !== undefined ? (data.approve ? 'approve' : 'reject') : 'approve')
    };
    const response = await api.post('/tickets/approve-handover', payload);
    return response.data;
};

export const adminReassignTicket = async (data) => {
    const response = await api.post('/tickets/admin-reassign', data);
    return response.data;
};

export const escalateTicketL1 = async (data) => {
    if (data instanceof FormData) {
        const response = await axios.post(`${API_URL}/tickets/escalate`, data);
        return response.data;
    } else {
        const response = await api.post('/tickets/escalate', data);
        return response.data;
    }
};

export const rateRequestor = async (data) => {
    const response = await api.post('/tickets/rate-requestor', data);
    return response.data;
};

// --- TICKET AUDIT LOGS (NEW) ---
export const fetchTicketLogs = async (ticketId) => {
    const response = await api.get(`/tickets/${ticketId}/logs`);
    return response.data;
};

// --- NOTIFICATIONS (NEW) ---
export const fetchNotifications = async (email) => {
    const response = await api.get(`/notifications/${email}`);
    return response.data;
};

export const markNotificationRead = async (notifId) => {
    const response = await api.post('/notifications/read', { notif_id: notifId });
    return response.data;
};

export const markAllNotificationsRead = async (email) => {
    const response = await api.post('/notifications/read-all', { email });
    return response.data;
};



// --- ADMIN ---
export const fetchUsers = async () => {
    const response = await api.get('/admin/users');
    return response.data;
};

export const fetchLocations = async () => {
    const response = await api.get('/admin/locations');
    return response.data;
};

export const fetchProjects = async () => {
    const response = await api.get('/admin/projects');
    return response.data;
};

export const fetchMasterRules = async () => {
    const response = await api.get('/admin/master-rules');
    return response.data;
};

export const fetchIssueCategories = async () => {
    const response = await api.get('/admin/issue_categories');
    return response.data;
};

export const fetchActivityCategories = async () => {
    const response = await api.get('/admin/activity_categories');
    return response.data;
};

export const fetchDepartments = async () => {
    const response = await api.get('/admin/departments');
    return response.data;
};

export const createUser = async (data) => {
    const response = await api.post('/admin/users/create', data);
    return response.data;
};

export const createLocation = async (data) => {
    const response = await api.post('/admin/locations/create', data);
    return response.data;
};

export const createProject = async (data) => {
    const response = await api.post('/admin/projects/create', data);
    return response.data;
};

export const updateProject = async (data) => {
    const response = await api.post('/admin/projects/update', data);
    return response.data;
};

export const deleteProject = async (projectNames) => {
    const response = await api.post('/admin/projects/delete', { project_names: projectNames });
    return response.data;
};

export const createDepartment = async (data) => {
    const response = await api.post('/admin/departments/create', data);
    return response.data;
};

export const createIssueCategory = async (data) => {
    const response = await api.post('/admin/issue_categories/create', data);
    return response.data;
};

export const createActivityCategory = async (data) => {
    const response = await api.post('/admin/activity_categories/create', data);
    return response.data;
};

export const updateDepartment = async (data) => {
    const response = await api.post('/admin/departments/update', data);
    return response.data;
};

export const updateIssueCategory = async (data) => {
    const response = await api.post('/admin/issue_categories/update', data);
    return response.data;
};

export const updateActivityCategory = async (data) => {
    const response = await api.post('/admin/activity_categories/update', data);
    return response.data;
};



export const updateUser = async (userData) => {
    const response = await api.post('/admin/users/update', userData);
    return response.data;
};

export const resetUserPassword = async (data) => {
    const response = await api.post('/admin/users/reset_password', data);
    return response.data;
};

export const toggleUserActive = async (data) => {
    const response = await api.post('/admin/users/toggle_active', data);
    return response.data;
};

export const fetchSystemLogs = async () => {
    const response = await api.get('/admin/system_logs');
    return response.data;
};

export const updateLocation = async (locData) => {
    const response = await api.post('/admin/locations/update', locData);
    return response.data;
};

export const deleteLocation = async (locations) => {
    const response = await api.post('/admin/locations/delete', { locations });
    return response.data;
};

export const deleteDepartment = async (departments) => {
    const response = await api.post('/admin/departments/delete', { departments });
    return response.data;
};

export const deleteIssueCategory = async (categories) => {
    const response = await api.post('/admin/issue_categories/delete', { categories });
    return response.data;
};

export const deleteActivityCategory = async (categories) => {
    const response = await api.post('/admin/activity_categories/delete', { categories });
    return response.data;
};

// --- BULK IMPORT & TEMPLATES ---
export const getImportTemplateUrl = (entity) => {
    return `${API_URL}/admin/template/${entity}`;
};

export const uploadImportFile = async (entity, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/admin/import/${entity}`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

// --- CANNED RESPONSES ---
export const fetchCannedResponses = async (user = null) => {
    let currentUser = user;
    if (!currentUser) {
        try { currentUser = JSON.parse(sessionStorage.getItem('ticket_user')); } catch (e) { }
    }
    const params = {};
    if (currentUser) {
        params.user_email = currentUser.email || currentUser.employee_id;
        params.role = currentUser.role;
    }
    const response = await api.get('/canned_responses', { params });
    return response.data;
};

export const createCannedResponse = async (data) => {
    let currentUser = null;
    try { currentUser = JSON.parse(sessionStorage.getItem('ticket_user')); } catch (e) { }
    const payload = { ...data };
    if (currentUser && !payload.role) {
        payload.role = currentUser.role;
    }
    const response = await api.post('/canned_responses', payload);
    return response.data;
};

export const updateCannedResponse = async (id, data) => {
    let currentUser = null;
    try { currentUser = JSON.parse(sessionStorage.getItem('ticket_user')); } catch (e) { }
    const params = {};
    if (currentUser) {
        params.user_email = currentUser.email || currentUser.employee_id;
        params.role = currentUser.role;
    }
    const response = await api.put(`/canned_responses/${id}`, data, { params });
    return response.data;
};

export const deleteCannedResponse = async (id) => {
    let currentUser = null;
    try { currentUser = JSON.parse(sessionStorage.getItem('ticket_user')); } catch (e) { }
    const params = {};
    if (currentUser) {
        params.user_email = currentUser.email || currentUser.employee_id;
        params.role = currentUser.role;
    }
    const response = await api.delete(`/canned_responses/${id}`, { params });
    return response.data;
};

export default api;