import { parseDateString, getISTDate, getISTTimestamp, formatISTDate } from './dateUtils';

const isTicketBreached = (t) => {
    if (!t) return false;
    if (t.solver_delay_hours !== undefined && t.solver_delay_hours !== null && Number(t.solver_delay_hours) > 0) return true;
    if (!t.deadline || String(t.deadline).toLowerCase() === 'nan') return false;

    const deadlineDate = parseDateString(t.deadline);
    if (!deadlineDate) return false;

    const st = String(t.status || '').toLowerCase();
    const ct = String(t.closure_type || '').toLowerCase();
    const isFinished = ['closed', 'declined', 'on hold', 'on-hold'].includes(st) || ['declined', 'on hold'].includes(ct);

    if (isFinished) {
        const finishStr = t.solved_timestamp || t.closed_timestamp;
        if (finishStr && String(finishStr).toLowerCase() !== 'nan') {
            const finishDate = parseDateString(finishStr);
            if (finishDate) return finishDate > deadlineDate;
        }
        return t.SLA_Breach === true || t.SLA_Breach === 'True';
    }

    return getISTDate() > deadlineDate;
};

const getTicketDelayHours = (t) => {
    if (!t) return 0;
    if (t.solver_delay_hours !== undefined && t.solver_delay_hours !== null && Number(t.solver_delay_hours) > 0) {
        return Number(t.solver_delay_hours);
    }
    if (!t.deadline || String(t.deadline).toLowerCase() === 'nan') return 0;
    const deadlineDate = parseDateString(t.deadline);
    if (!deadlineDate) return 0;

    const st = String(t.status || '').toLowerCase();
    const ct = String(t.closure_type || '').toLowerCase();
    const isFinished = ['closed', 'declined', 'on hold', 'on-hold'].includes(st) || ['declined', 'on hold'].includes(ct);

    if (isFinished) {
        const finishStr = t.closed_timestamp || t.solved_timestamp;
        if (finishStr && String(finishStr).toLowerCase() !== 'nan') {
            const finishDate = parseDateString(finishStr);
            if (finishDate) {
                const diffMs = finishDate.getTime() - deadlineDate.getTime();
                return diffMs > 0 ? (diffMs / (1000 * 3600)) : 0;
            }
        }
        return 0;
    } else {
        const diffMs = getISTDate().getTime() - deadlineDate.getTime();
        return diffMs > 0 ? (diffMs / (1000 * 3600)) : 0;
    }
};

const formatDays = (hours) => {
    if (hours === undefined || hours === null || hours === '' || isNaN(Number(hours))) return '-';
    const h = Number(hours);
    if (h === 0) return '0d (0h)';
    const d = (h / 24).toFixed(1);
    return `${d}d (${Math.round(h)}h)`;
};

export const exportExecutivePDF = (tickets, filters = {}) => {
    const printWin = window.open('', '_blank', 'width=1100,height=850');
    if (!printWin) {
        alert("Please allow popups to generate the Executive PDF Report.");
        return;
    }

    const now = getISTTimestamp();

    // Advanced Key Aggregations
    const totalCount = tickets.length;
    const openCount = tickets.filter(t => t.status === 'Open').length;
    const inProgressCount = tickets.filter(t => t.status === 'In Progress').length;
    const resolvedCount = tickets.filter(t => t.status === 'Resolved').length;
    const closedCount = tickets.filter(t => t.status === 'Closed').length;
    const onHoldCount = tickets.filter(t => t.status === 'On Hold').length;
    const escalatedCount = tickets.filter(t => t.status === 'Escalated' || (t.escalation_level && t.escalation_level !== 'L1')).length;

    const slaBreachCount = tickets.filter(t => isTicketBreached(t)).length;
    const slaBreachRate = totalCount > 0 ? ((slaBreachCount / totalCount) * 100).toFixed(1) : '0.0';

    const onTimeCount = totalCount - slaBreachCount;
    const onTimeRate = totalCount > 0 ? Math.max(0, ((onTimeCount / totalCount) * 100)).toFixed(1) : '0.0';

    // Averages across dataset
    const validAge = tickets.map(t => Number(t.ticket_age_hours)).filter(h => !isNaN(h) && h >= 0);
    const avgAgeDays = validAge.length > 0 ? (validAge.reduce((a, b) => a + b, 0) / validAge.length / 24).toFixed(1) : '0.0';

    const validRes = tickets.map(t => Number(t.solver_resolution_hours)).filter(h => !isNaN(h) && h >= 0);
    const avgResDays = validRes.length > 0 ? (validRes.reduce((a, b) => a + b, 0) / validRes.length / 24).toFixed(1) : '0.0';

    const validTurn = tickets.map(t => Number(t.total_turnaround_hours)).filter(h => !isNaN(h) && h >= 0);
    const avgTurnDays = validTurn.length > 0 ? (validTurn.reduce((a, b) => a + b, 0) / validTurn.length / 24).toFixed(1) : '0.0';

    const validDelay = tickets.map(t => Number(t.solver_delay_hours)).filter(h => !isNaN(h) && h > 0);
    const avgDelayDays = validDelay.length > 0 ? (validDelay.reduce((a, b) => a + b, 0) / validDelay.length / 24).toFixed(1) : '0.0';

    const urgentMajorCount = tickets.filter(t => t.severity && (t.severity.toLowerCase() === 'urgent' || t.severity.toLowerCase() === 'major')).length;
    const extendedCount = tickets.filter(t => t.has_extended === 'True' || t.has_extended === true || (t.solver_comments && t.solver_comments.includes('Deadline Extended'))).length;

    // Department Stats Matrix
    const deptMap = {};
    tickets.forEach(t => {
        const d = t.dept_assigned || 'Unassigned';
        if (!deptMap[d]) deptMap[d] = { total: 0, resolved: 0, open: 0, breached: 0, totalAge: 0, totalRes: 0, totalDelay: 0 };
        deptMap[d].total++;
        if (t.status === 'Resolved' || t.status === 'Closed') deptMap[d].resolved++;
        if (t.status === 'Open' || t.status === 'In Progress') deptMap[d].open++;
        if (isTicketBreached(t)) deptMap[d].breached++;
        if (t.ticket_age_hours) deptMap[d].totalAge += Number(t.ticket_age_hours);
        if (t.solver_resolution_hours) deptMap[d].totalRes += Number(t.solver_resolution_hours);
        if (t.solver_delay_hours) deptMap[d].totalDelay += Number(t.solver_delay_hours);
    });

    // Location Stats Matrix (Separate Data Metrics)
    const locationMap = {};
    tickets.forEach(t => {
        const loc = t.location || 'Unassigned';
        if (!locationMap[loc]) locationMap[loc] = { total: 0, open: 0, resolved: 0, breached: 0, totalAge: 0 };
        locationMap[loc].total++;
        if (t.status === 'Open' || t.status === 'In Progress' || t.status === 'Escalated') locationMap[loc].open++;
        if (t.status === 'Resolved' || t.status === 'Closed') locationMap[loc].resolved++;
        if (isTicketBreached(t)) locationMap[loc].breached++;
        if (t.ticket_age_hours) locationMap[loc].totalAge += Number(t.ticket_age_hours);
    });

    // Issue Category Stats Matrix (Separate Data Metrics)
    const categoryMap = {};
    tickets.forEach(t => {
        const cat = t.issue_category || 'General';
        if (!categoryMap[cat]) categoryMap[cat] = { total: 0, urgentMajor: 0, breached: 0, totalDelay: 0 };
        categoryMap[cat].total++;
        const sevStr = String(t.severity || '').toLowerCase();
        if (sevStr === 'urgent' || sevStr === 'major') categoryMap[cat].urgentMajor++;
        if (isTicketBreached(t)) categoryMap[cat].breached++;
        if (t.solver_delay_hours) categoryMap[cat].totalDelay += Number(t.solver_delay_hours);
    });

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Executive Ticketing Performance Report - Ambuja Desk</title>
            <style>
                @page { size: A4 landscape; margin: 10mm; }
                body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; margin: 0; padding: 12px; font-size: 9.5px; background: #fff; }
                .header-bar { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #184f7e; padding-bottom: 8px; margin-bottom: 14px; }
                .company-title { font-size: 17px; font-weight: bold; color: #184f7e; margin: 0; }
                .report-title { font-size: 10.5px; color: #64748b; margin-top: 2px; }
                .kpi-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; margin-bottom: 14px; }
                .kpi-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 4px; text-align: center; }
                .kpi-num { font-size: 13.5px; font-weight: bold; color: #184f7e; margin-top: 2px; }
                .kpi-label { color: #64748b; font-size: 7px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.01em; white-space: nowrap; }
                .section-heading { font-size: 11px; font-weight: bold; color: #0f172a; margin: 12px 0 6px 0; border-left: 3px solid #184f7e; padding-left: 6px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 8.5px; }
                th { background: #f1f5f9; color: #334155; text-align: left; padding: 5px 6px; border: 1px solid #cbd5e1; font-weight: bold; white-space: nowrap; }
                td { padding: 4px 6px; border: 1px solid #e2e8f0; white-space: nowrap; }
                tr:nth-child(even) { background: #f8fafc; }
                .badge-breach { color: #ef4444; font-weight: bold; }
                .badge-success { color: #10b981; font-weight: bold; }
                .badge-warning { color: #f59e0b; font-weight: bold; }
                .grid-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
                .footer { margin-top: 18px; border-top: 1px solid #e2e8f0; padding-top: 6px; text-align: center; color: #94a3b8; font-size: 8px; }
            </style>
        </head>
        <body>
            <div class="header-bar">
                <div>
                    <h1 class="company-title">Ambuja Desk — Comprehensive Executive Report</h1>
                    <div class="report-title">Corporate Ticketing Performance, Ageing Analytics & Delay Metrics</div>
                </div>
                <div style="text-align: right; color: #64748b; font-size: 8.5px;">
                    <div><strong>Generated On:</strong> ${now}</div>
                    <div><strong>Scope:</strong> ${filters.time || 'All Time'} | ${filters.dept || 'All Depts'}</div>
                </div>
            </div>

            <div class="kpi-grid">
                <div class="kpi-box"><div class="kpi-label">Total Volume</div><div class="kpi-num">${totalCount}</div></div>
                <div class="kpi-box"><div class="kpi-label">Resolved / Closed</div><div class="kpi-num" style="color: #10b981;">${resolvedCount + closedCount}</div></div>
                <div class="kpi-box"><div class="kpi-label">Active Workload</div><div class="kpi-num" style="color: #3b82f6;">${openCount + inProgressCount}</div></div>
                <div class="kpi-box"><div class="kpi-label">SLA Breach Rate</div><div class="kpi-num" style="color: #ef4444;">${slaBreachRate}%</div></div>
                <div class="kpi-box"><div class="kpi-label">On-Time Rate</div><div class="kpi-num" style="color: #10b981;">${onTimeRate}%</div></div>
                <div class="kpi-box"><div class="kpi-label">Avg Ticket Age</div><div class="kpi-num">${avgAgeDays}d</div></div>
                <div class="kpi-box"><div class="kpi-label">Avg Overdue Delay</div><div class="kpi-num" style="color: #ef4444;">${avgDelayDays}d</div></div>
                <div class="kpi-box"><div class="kpi-label">Urgent & Major</div><div class="kpi-num" style="color: #f59e0b;">${urgentMajorCount}</div></div>
            </div>

            <div class="section-heading">Department Performance & Delay Matrix</div>
            <table>
                <thead>
                    <tr>
                        <th>Department</th>
                        <th>Total Volume</th>
                        <th>Active Workload</th>
                        <th>Resolved Rate</th>
                        <th>SLA Breaches</th>
                        <th>Avg Age (Days)</th>
                        <th>Avg Resolution Days</th>
                        <th>Avg Delay (Hours)</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(deptMap).map(([dept, s]) => {
        const resRate = s.total > 0 ? ((s.resolved / s.total) * 100).toFixed(0) + '%' : '0%';
        const avgAge = s.total > 0 ? (s.totalAge / s.total / 24).toFixed(1) + 'd' : '-';
        const avgRes = s.resolved > 0 ? (s.totalRes / s.resolved / 24).toFixed(1) + 'd' : '-';
        const avgDelay = s.total > 0 ? (s.totalDelay / s.total).toFixed(1) + 'h' : '-';
        return `
                            <tr>
                                <td><strong>${dept}</strong></td>
                                <td>${s.total}</td>
                                <td>${s.open}</td>
                                <td class="badge-success">${resRate}</td>
                                <td class="${s.breached > 0 ? 'badge-breach' : ''}">${s.breached}</td>
                                <td>${avgAge}</td>
                                <td>${avgRes}</td>
                                <td>${avgDelay}</td>
                            </tr>
                        `;
    }).join('')}
                </tbody>
            </table>

            <div class="grid-2col">
                <div>
                    <div class="section-heading">Location Operational Metrics Summary</div>
                    <table>
                        <thead>
                            <tr>
                                <th>Location</th>
                                <th>Volume</th>
                                <th>Active</th>
                                <th>Breaches</th>
                                <th>Avg Age</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.entries(locationMap).sort((a, b) => b[1].total - a[1].total).slice(0, 8).map(([loc, s]) => `
                                <tr>
                                    <td><strong>${loc}</strong></td>
                                    <td>${s.total}</td>
                                    <td>${s.open}</td>
                                    <td class="${s.breached > 0 ? 'badge-breach' : ''}">${s.breached}</td>
                                    <td>${s.total > 0 ? (s.totalAge / s.total / 24).toFixed(1) + 'd' : '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <div>
                    <div class="section-heading">Issue Category & Delay Metrics Breakdown</div>
                    <table>
                        <thead>
                            <tr>
                                <th>Issue Category</th>
                                <th>Volume</th>
                                <th>Urgent / Major</th>
                                <th>Breaches</th>
                                <th>Avg Delay</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.entries(categoryMap).sort((a, b) => b[1].total - a[1].total).slice(0, 8).map(([cat, s]) => `
                                <tr>
                                    <td><strong>${cat}</strong></td>
                                    <td>${s.total}</td>
                                    <td class="${s.urgentMajor > 0 ? 'badge-warning' : ''}">${s.urgentMajor}</td>
                                    <td class="${s.breached > 0 ? 'badge-breach' : ''}">${s.breached}</td>
                                    <td>${s.total > 0 ? (s.totalDelay / s.total / 24).toFixed(1) + 'd' : '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="section-heading">Full Ticket Ageing & Resolution Metrics Inventory</div>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Dept</th>
                        <th>Issue Cat.</th>
                        <th>Location</th>
                        <th>Level</th>
                        <th>Severity</th>
                        <th>Status</th>
                        <th>Target Deadline</th>
                        <th>SLA Breach</th>
                        <th>Age (Days)</th>
                        <th>Resolution Time</th>
                        <th>Total Turnaround</th>
                        <th>Delay Days</th>
                        <th>Assigned By</th>
                        <th>Assigned To</th>
                    </tr>
                </thead>
                <tbody>
                    ${tickets.map(t => {
        const isBreach = isTicketBreached(t);
        return `
                            <tr>
                                <td><strong>#${t.ticket_id}</strong></td>
                                <td>${t.dept_assigned || '-'}</td>
                                <td>${t.issue_category || '-'}</td>
                                <td>${t.location || '-'}</td>
                                <td>${t.escalation_level || 'L1'}</td>
                                <td>${t.severity || 'Normal'}</td>
                                <td>${t.status}</td>
                                <td>${t.deadline || '-'}</td>
                                <td class="${isBreach ? 'badge-breach' : 'badge-success'}">${isBreach ? 'BREACHED' : 'On Track'}</td>
                                <td>${formatDays(t.ticket_age_hours)}</td>
                                <td>${formatDays(t.solver_resolution_hours)}</td>
                                <td>${formatDays(t.total_turnaround_hours)}</td>
                                <td class="${getTicketDelayHours(t) > 0 ? 'badge-breach' : ''}">${formatDays(getTicketDelayHours(t))}</td>
                                <td>${t.assigned_by || t.raised_by || '-'}</td>
                                <td>${t.assigned_to || '-'}</td>
                            </tr>
                        `;
    }).join('')}
                </tbody>
            </table>

            <div class="footer">
                Confidential — Ambuja Desk Enterprise System Report | Generated automatically for Executive Review.
            </div>

            <script>
                window.onload = function() { window.print(); }
            </script>
        </body>
        </html>
    `;

    printWin.document.write(htmlContent);
    printWin.document.close();
};

const formatPersonWithPhone = (personVal, rawId, usersList = []) => {
    if (!personVal && !rawId) return '-';
    let val = String(personVal || rawId || '').trim();
    if (!val || val.toLowerCase() === 'nan' || val === '-') return '-';

    if (/\(\d{5,}\)/.test(val)) return val;

    if (usersList && usersList.length > 0) {
        const u = usersList.find(usr =>
            String(usr.employee_id) === val ||
            String(usr.email).toLowerCase() === val.toLowerCase() ||
            String(usr.name).toLowerCase() === val.toLowerCase() ||
            (rawId && (String(usr.employee_id) === String(rawId) || String(usr.email).toLowerCase() === String(rawId).toLowerCase()))
        );
        if (u) {
            const phone = u.phone || u.phone_number || 'N/A';
            return `${u.name} (${phone})`;
        }
    }
    return val;
};

export const exportExecutiveCSV = (tickets = [], filters = {}, usersList = []) => {
    const headers = [
        "Ticket ID", "Raised Timestamp", "Solved Timestamp", "Closed Timestamp",
        "Target Deadline", "Absolute Deadline", "Escalation Level", "Department",
        "Issue Category", "Activity Category", "Location", "Severity", "Status",
        "SLA Breach Status", "Ticket Age (Days)", "Ticket Age (Hours)",
        "Resolution Time (Days)", "Resolution Time (Hours)",
        "Total Turnaround Days", "Total Turnaround Hours", "SLA Delay Days",
        "SLA Delay Hours", "Closure Delay Hours", "Description", "Attachment",
        "Assigned By (Raiser)", "Assigned To (Solver)", "Original Raiser", "Closure Remarks"
    ];

    const escapeCsv = (str) => {
        const s = String(str || '').replace(/"/g, '""');
        return `"${s}"`;
    };

    let csv = '\uFEFF' + headers.map(escapeCsv).join(',') + '\n';

    tickets.forEach(t => {
        const isBreach = isTicketBreached(t);
        const ageHours = Number(t.ticket_age_hours || 0);
        const resHours = Number(t.solver_resolution_hours || 0);
        const turnHours = Number(t.total_turnaround_hours || 0);
        const delayHours = getTicketDelayHours(t);
        const closureDelayHours = Number(t.closure_delay_hours || 0);

        let attachmentUrl = t.attachment && String(t.attachment).trim() !== 'nan' ? String(t.attachment).trim() : '';
        if (attachmentUrl && !attachmentUrl.startsWith('http')) {
            attachmentUrl = `${import.meta.env.VITE_FILE_BASE_URL}/api/token/file/${attachmentUrl}?token=${import.meta.env.VITE_API_SECURE_TOKEN}`;
        }

        const assignedByFormatted = formatPersonWithPhone(t.assigned_by || t.raiser_name || t.raised_by, t.raised_by, usersList);
        const assignedToFormatted = formatPersonWithPhone(t.assigned_to_name || t.assigned_to, t.assigned_to, usersList);
        const originalRaiserFormatted = formatPersonWithPhone(t.original_raiser_name || t.original_raiser || t.raiser_name || t.raised_by, t.original_raiser || t.raised_by, usersList);

        const row = [
            t.ticket_id,
            t.timestamp || '-',
            t.solved_timestamp || '-',
            t.closed_timestamp || '-',
            t.deadline || '-',
            t.absolute_deadline || t.deadline || '-',
            t.escalation_level || 'L1',
            t.dept_assigned || '-',
            t.issue_category || '-',
            t.activity_category || '-',
            t.location || '-',
            t.severity || 'Normal',
            t.status || '-',
            isBreach ? 'BREACHED' : 'ON TRACK',
            (ageHours / 24).toFixed(1),
            ageHours,
            resHours > 0 ? (resHours / 24).toFixed(1) : '-',
            resHours > 0 ? resHours : '-',
            turnHours > 0 ? (turnHours / 24).toFixed(1) : '-',
            turnHours > 0 ? turnHours : '-',
            delayHours > 0 ? (delayHours / 24).toFixed(1) : 0,
            delayHours,
            closureDelayHours,
            t.description || '-',
            attachmentUrl || '-',
            assignedByFormatted,
            assignedToFormatted,
            originalRaiserFormatted,
            t.closure_remarks || t.solver_comments || '-'
        ];

        csv += row.map(escapeCsv).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const nowStr = formatISTDate(getISTDate());
    link.setAttribute('download', `Ambuja_Executive_Master_Report_${nowStr}.csv`);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
};
