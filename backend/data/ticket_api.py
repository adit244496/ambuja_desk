import os
import re
from flask import Blueprint, request, jsonify, current_app, send_file
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta, timezone
from data.image_utils import compress_image_to_20kb
import database
import math
from models import Ticket, TicketLog, User, Department, IssueCategory, ActivityCategory, CannedResponse, AIRoutingFeedback, Notification, SystemLog

def parse_flexible_dt(val):
    if not val: return None
    val_str = str(val).strip()
    if val_str.lower() in ['nan', 'none', '', 'null']: return None
    formats = [
        "%d-%m-%Y %H:%M:%S", "%d-%m-%Y %H:%M",
        "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M",
        "%d-%m-%Y", "%Y-%m-%d",
        "%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M",
        "%d/%m/%Y", "%m/%d/%Y %H:%M:%S", "%m/%d/%Y %H:%M"
    ]
    for fmt in formats:
        try:
            return datetime.strptime(val_str, fmt)
        except ValueError:
            pass
    try:
        from dateutil import parser
        return parser.parse(val_str, dayfirst=True)
    except Exception:
        pass
    return None

ticket_bp = Blueprint('ticket', __name__)

@ticket_bp.route('/api/tickets/delete', methods=['POST', 'OPTIONS'])
def delete_tickets():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
        
    data = request.json or {}
    ticket_ids = data.get('ticket_ids', [])
    if isinstance(ticket_ids, str):
        ticket_ids = [ticket_ids]
        
    if not ticket_ids:
        return jsonify({"error": "No ticket_ids provided"}), 400

    db = database.Session()
    try:
        # Delete related records from Notification, TicketLog, and Ticket
        db.query(Notification).filter(Notification.ticket_id.in_(ticket_ids)).delete(synchronize_session=False)
        db.query(TicketLog).filter(TicketLog.ticket_id.in_(ticket_ids)).delete(synchronize_session=False)
        deleted_count = db.query(Ticket).filter(Ticket.ticket_id.in_(ticket_ids)).delete(synchronize_session=False)
        db.commit()

        # Create system log entry
        actor_ident = data.get('user_email') or request.headers.get('X-User-Email') or 'Super Admin'
        target_str = ', '.join([str(tid) for tid in ticket_ids[:5]]) + ('...' if len(ticket_ids) > 5 else '')
        database.log_system_action(
            actor_ident,
            'Delete Tickets',
            target_str,
            f"Permanently deleted {len(ticket_ids)} ticket(s) along with all timeline logs and notifications."
        )

        return jsonify({"message": f"Successfully deleted {deleted_count} ticket(s) and associated records.", "deleted_count": deleted_count}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()

# ==========================================
# --- HELPERS: USER RESOLUTION & DISPLAY ---
# ==========================================
def get_user_email(identifier, users):
    """Safely converts an employee_id OR email into a valid email address."""
    if not identifier or str(identifier).strip().lower() in ['nan', 'none', '', 'unassigned']:
        return None
    ident_str = str(identifier).strip()
    
    if '@' in ident_str:
        return ident_str
        
    if users:
        try:
            clean_id = str(int(float(ident_str)))
        except ValueError:
            clean_id = ident_str
        match = next((u for u in users if str(u.employee_id) == clean_id or str(u.employee_id) == ident_str), None)
        if match:
            return match.email
    return None

def get_user_name_dept(identifier, users):
    """Converts ANY identifier to 'Name (Department)' for notifications."""
    if not identifier or str(identifier).strip().lower() in ['nan', 'none', '', 'unassigned']:
        return 'Unassigned'
    ident_str = str(identifier).strip()
    match = None
    if users:
        if '@' in ident_str:
            match = next((u for u in users if u.email and u.email.lower() == ident_str.lower()), None)
        else:
            try:
                clean_id = str(int(float(ident_str)))
            except ValueError:
                clean_id = ident_str
            match = next((u for u in users if str(u.employee_id) == clean_id or str(u.employee_id) == ident_str), None)
        if match:
            name = match.name or ident_str
            phone = match.phone_number or ''
            return f"{name} ({phone})" if phone else name
    return ident_str

def get_user_emp_id(identifier, users):
    """Safely converts any identifier into employee_id FOR STORAGE."""
    if not identifier or str(identifier).strip().lower() in ['nan', 'none', '', 'unassigned']:
        return 'Unassigned'
    ident_str = str(identifier).strip()
    
    if users:
        if '@' in ident_str:
            match = next((u for u in users if u.email and u.email.lower() == ident_str.lower()), None)
            if match:
                return str(match.employee_id)
        else:
            try:
                clean_id = str(int(float(ident_str)))
            except ValueError:
                clean_id = ident_str
            match = next((u for u in users if str(u.employee_id) == clean_id or str(u.employee_id) == ident_str), None)
            if match:
                return str(match.employee_id)
    return ident_str



def get_user_display(identifier, users):
    """Converts ANY identifier to 'Name (Phone)' FOR DISPLAY."""
    if not identifier or str(identifier).strip().lower() in ['nan', 'none', '', 'unassigned']:
        return 'Unassigned'
    ident_str = str(identifier).strip()
    
    match = None
    if users:
        if '@' in ident_str:
            match = next((u for u in users if u.email and u.email.lower() == ident_str.lower()), None)
        else:
            try:
                clean_id = str(int(float(ident_str)))
            except ValueError:
                clean_id = ident_str
            match = next((u for u in users if str(u.employee_id) == clean_id or str(u.employee_id) == ident_str), None)
                
        if match:
            name = match.name or ident_str
            phone = match.phone_number or 'N/A'
            return f"{name} ({phone})"
            
def get_ticket_restricted_user_identifiers(ticket_id, db, users):
    """
    Returns a set of normalized identifiers (lowercase emails and cleaned string employee IDs)
    for all raisers and solvers across all hierarchy levels (L1, L2, L3...) of the ticket.
    """
    restricted = set()
    all_ticket_records = db.query(Ticket).filter(Ticket.ticket_id == str(ticket_id)).all()
    raw_identifiers = set()
    for t in all_ticket_records:
        for field_val in [t.raised_by, t.assigned_to, t.original_raiser]:
            if field_val and str(field_val).strip().lower() not in ['nan', 'none', '', 'unassigned']:
                raw_identifiers.add(str(field_val).strip())
                
    for raw in raw_identifiers:
        # Add the raw value in lower
        restricted.add(raw.lower())
        # Also resolve both email and emp_id
        emp_id = get_user_emp_id(raw, users)
        if emp_id and emp_id != 'Unassigned':
            restricted.add(str(emp_id).lower())
            if str(emp_id).endswith('.0'):
                restricted.add(str(emp_id)[:-2].lower())
        email = get_user_email(raw, users)
        if email:
            restricted.add(email.lower())
    return restricted
# --- CORE TICKET ROUTES ---
# ==========================================
@ticket_bp.route('/api/tickets', methods=['GET'])
def get_tickets():
    
    db = database.Session()
    try:
        tickets = db.query(Ticket).all()
        users = db.query(User).all()
        
        records = [t.to_dict() for t in tickets]
        
        # INTERCEPT AND FORMAT DISPLAY NAMES
        for r in records:
            r['assigned_to_name'] = get_user_display(r.get('assigned_to'), users)
            
            r['raiser_name'] = get_user_display(r.get('raised_by'), users)
            if 'original_raiser' in r:
                r['original_raiser_name'] = get_user_display(r.get('original_raiser'), users)
                
            he = str(r.get('has_extended') or '').strip().lower()
            r['has_extended'] = True if he in ['true', '1', 'yes'] else False
                
        return jsonify(records), 200
    finally:
        db.close()

@ticket_bp.route('/api/tickets/<int:ticket_id>/logs', methods=['GET'])
def get_ticket_logs(ticket_id):
    """Fetches the complete audit history for a specific ticket."""
    db = database.Session()
    try:
        logs_records = db.query(TicketLog).filter(TicketLog.ticket_id == str(ticket_id)).all()
        users = db.query(User).all()
        
        if not logs_records:
            return jsonify([])
            
        logs_data = [l.to_dict() for l in logs_records]
        
        # INTERCEPT AND FORMAT LOG USERS
        for r in logs_data:
            r['user'] = get_user_display(r.get('user'), users)
            
            details = str(r.get('details', ''))
            action = str(r.get('action', ''))
            
            target = None
            prefix = ""
            suffix = ""
            
            if "Created" in action and "Assigned to " in details:
                prefix = "Assigned to "
                target = details.split(prefix)[1].strip()
            elif "Escalated" in action and "Escalated to " in details:
                prefix = "Escalated to "
                parts = details.split(prefix)[1].split(" (")
                target = parts[0].strip()
                if len(parts) > 1:
                    suffix = " (" + parts[1]
            elif "Handover" in action and "transfer to " in details:
                prefix = "transfer to "
                target = details.split(prefix)[1].strip()
            elif "Handover" in action and "Assigned to " in details:
                prefix = "Assigned to "
                target = details.split(prefix)[1].strip()
            # Clean redundant system info for accept, close, and reject actions
            if any(act in action for act in ['Accepted', 'Closed', 'Rejected', 'Reopened', 'Resolved', 'Declined', 'On Hold']):
                if details in [
                    'Requestor accepted the resolution and closed the ticket',
                    'Requestor rejected the resolution and reopened the ticket',
                    'Solver marked the ticket as resolved',
                    'Solver declined the ticket',
                    'Solver placed the ticket on hold',
                    'To Closed', 'To Reopened', 'To Resolved', 'To Decline', 'To On Hold'
                ]:
                    r['details'] = ''

            if target:
                display_name = get_user_display(target, users)
                r['details'] = prefix + display_name + suffix
            
        return jsonify(logs_data), 200
    finally:
        db.close()

@ticket_bp.route('/api/tickets/create', methods=['POST'])
def create_ticket():
    data = request.form
    file = request.files.get('attachment')
    
    dept = data.get('dept')
    issue_category = data.get('issue_category')
    activity_category = data.get('activity_category')
    description = data.get('description')
    raised_by = data.get('raised_by')
    assigned_solver = data.get('assigned_to', 'Unassigned')
    notify_users = data.get('notify_users', '') # Comma separated list of emails or IDs
    deadline = data.get('deadline') # Passed from frontend
    severity = data.get('severity') # Mandatory severity

    db = database.Session()
    try:
        users = db.query(User).all()
        
        if not deadline:
            from datetime import timedelta
            deadline = (database.get_ist_now() + timedelta(hours=24)).strftime("%d-%m-%Y %H:%M")

        # --- STORAGE FIX: FORCE EMPLOYEE ID FOR DATABASE ---
        assigned_solver_emp_id = get_user_emp_id(assigned_solver, users)
        
        max_ticket = db.query(Ticket).order_by(Ticket.ticket_id.desc()).first()
        new_tid = int(max_ticket.ticket_id) + 1 if max_ticket and max_ticket.ticket_id else 1001
        
        filename = ""
        if file and file.filename != '':
            safe_name = secure_filename(file.filename)
            filename = f"ticket_{new_tid}_{safe_name}"
            filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            compress_image_to_20kb(filepath)
        
        new_ticket = Ticket(
            ticket_id=new_tid,
            raised_by=raised_by,
            dept_assigned=dept,
            issue_category=issue_category,
            activity_category=activity_category,
            description=description,
            status='Open',
            assigned_to=assigned_solver_emp_id, # STORE AS ID
            notify_users=notify_users,
            location=data.get('location'),
            timestamp=database.get_ist_now_str("%d-%m-%Y %H:%M"),
            deadline=deadline,
            absolute_deadline=deadline,
            attachment=filename,
            solver_notified=False, 
            solver_resolution_hours=None, solver_delay_hours=None, closure_delay_hours=None,
            ticket_age_hours=0.0, total_turnaround_hours=None, SLA_Breach=False,
            closure_type='', reassign_requested_to='', reassign_reason='',
            solver_comments='',
            original_raiser=raised_by,
            severity=severity,
            escalation_level='L1',
            solved_timestamp='',
            closed_timestamp=''
        )
        db.add(new_ticket)

        # Log AI Routing Override Feedback for Self-Learning Engine
        suggested_dept = data.get('suggested_dept')
        suggested_issue = data.get('suggested_issue')
        suggested_act = data.get('suggested_act')
        suggested_solver = data.get('suggested_solver')
        if description and (dept or issue_category or activity_category or assigned_solver_emp_id):
            fb = AIRoutingFeedback(
                query=description,
                suggested_dept=suggested_dept,
                suggested_issue=suggested_issue,
                suggested_act=suggested_act,
                suggested_solver=suggested_solver,
                user_selected_dept=dept,
                user_selected_issue=issue_category,
                user_selected_act=activity_category,
                user_selected_solver=assigned_solver_emp_id,
                feedback_score=2.0 if (dept != suggested_dept or issue_category != suggested_issue or assigned_solver_emp_id != suggested_solver) else 1.0,
                timestamp=database.get_ist_now_str("%d-%m-%Y %H:%M")
            )
            db.add(fb)

        db.commit()
        
        raised_by_email = get_user_email(raised_by, users)
        assigned_solver_email = get_user_email(assigned_solver_emp_id, users)
        
        loc_val = str(data.get('location') or '').strip()
        loc_suffix = f" for {loc_val}" if loc_val and loc_val.lower() != 'nan' else ""

        database.log_ticket_action(new_tid, raised_by, "Created Ticket", f"Assigned to {assigned_solver_email or assigned_solver_emp_id}", description, attachment=filename)
        
        if raised_by_email:
            database.create_notification(raised_by_email, f"Success: Your Ticket #{new_tid} has been raised.", ticket_id=new_tid, role_context='Requestor', action_attachment=filename, custom_subject=f"Confirmation: Your Ticket #{new_tid} has been raised{loc_suffix}")
        if assigned_solver_email:
            database.create_notification(assigned_solver_email, f"Action Required: Ticket #{new_tid} was assigned to you by {get_user_name_dept(raised_by, users)}.", ticket_id=new_tid, role_context='Solver', action_attachment=filename, custom_subject=f"Action Required: New Ticket #{new_tid} assigned to you{loc_suffix}")
            
        admin_emails = database.get_admin_emails(db)
        for admin_email in admin_emails:
            if admin_email != assigned_solver_email and admin_email != raised_by_email:
                database.create_notification(admin_email, f"Alert: Ticket #{new_tid} was raised by {get_user_name_dept(raised_by, users)} and assigned to {get_user_name_dept(assigned_solver_emp_id or assigned_solver, users)}.", ticket_id=new_tid, role_context='Admin', action_attachment=filename, custom_subject=f"Alert: New Ticket #{new_tid} raised{loc_suffix}")

        if notify_users:
            cc_list = [u.strip() for u in notify_users.split(',') if u.strip()]
            for u in cc_list:
                u_email = get_user_email(u, users)
                if u_email:
                    database.create_notification(u_email, f"FYI: You were CC'd on Ticket #{new_tid} raised by {get_user_name_dept(raised_by, users)} and assigned to {get_user_name_dept(assigned_solver_emp_id or assigned_solver, users)}.", ticket_id=new_tid, role_context='Viewer', action_attachment=filename, custom_subject=f"FYI: You were CC'd on new Ticket #{new_tid}{loc_suffix}")
        
        return jsonify({
            "message": "Ticket created successfully", 
            "ticket_id": new_tid, 
            "assigned_to": assigned_solver_emp_id
        }), 201
    finally:
        db.close()

@ticket_bp.route('/api/tickets/escalate', methods=['POST'])
def escalate_ticket():
    if request.is_json:
        data = request.json
    else:
        data = request.form
        
    ticket_id = data.get('ticket_id')
    escalation_level = data.get('escalation_level', 'L1')
    new_dept = data.get('new_dept')
    new_solver = data.get('new_solver')
    reason = data.get('reason', '')
    
    filename = ""
    file = request.files.get('attachment') if not request.is_json else None
    if file and file.filename != '':
        safe_name = secure_filename(file.filename)
        filename = f"esc_{ticket_id}_{safe_name}"
        filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        compress_image_to_20kb(filepath)
    
    db = database.Session()
    try:
        users = db.query(User).all()
        
        # Find the specific ticket record for the current level
        ticket = db.query(Ticket).filter(
            Ticket.ticket_id == str(ticket_id),
            Ticket.escalation_level == escalation_level
        ).order_by(Ticket.id.desc()).first()
        
        if not ticket:
            ticket = db.query(Ticket).filter(Ticket.ticket_id == str(ticket_id)).order_by(Ticket.id.desc()).first()
            if not ticket:
                return jsonify({"error": "Ticket not found"}), 404
                
        current_raiser = str(ticket.raised_by)
        current_solver = str(ticket.assigned_to)
        orig_raiser = ticket.original_raiser or current_raiser
        
        esc_count = ticket.escalation_level
        try:
            esc_num = int(str(esc_count).replace('L', '')) if esc_count and 'L' in str(esc_count) else 1
        except:
            esc_num = 1
        new_esc_level = f"L{esc_num + 1}"
        
        # Prevent double escalation
        existing_esc = db.query(Ticket).filter(Ticket.ticket_id == str(ticket_id), Ticket.escalation_level == new_esc_level).first()
        if existing_esc:
            return jsonify({"error": "Ticket is already escalated to this level"}), 400
        
        ticket.status = 'Escalated'
        
        absolute_deadline = str(ticket.absolute_deadline) if ticket.absolute_deadline else str(ticket.deadline)
        if absolute_deadline == 'None' or absolute_deadline == 'nan' or not absolute_deadline.strip():
            absolute_deadline = str(ticket.deadline)
            
        final_deadline = str(ticket.deadline)
        new_solver_emp_id = str(new_solver).strip()
        
        # Prevent escalation to raisers or solvers across all previous levels
        restricted_users = get_ticket_restricted_user_identifiers(ticket_id, db, users)
        target_emp_check = get_user_emp_id(new_solver, users)
        target_email_check = get_user_email(new_solver, users)
        if (new_solver_emp_id.lower() in restricted_users or
            (target_emp_check and str(target_emp_check).lower() in restricted_users) or
            (target_email_check and str(target_email_check).lower() in restricted_users)):
            return jsonify({"error": "Ticket cannot be escalated to a raiser or already assigned solver of any level on this ticket."}), 400
        
        new_ticket = Ticket(
            ticket_id=ticket.ticket_id,
            escalation_level=new_esc_level,
            raised_by=current_solver,
            assigned_to=new_solver_emp_id,
            dept_assigned=new_dept,
            status='Open',
            original_raiser=orig_raiser,
            severity=ticket.severity,
            timestamp=database.get_ist_now_str("%d-%m-%Y %H:%M"),
            deadline=final_deadline,
            absolute_deadline=absolute_deadline,
            has_extended='false',
            description=reason if reason else ticket.description,
            attachment=filename if filename else '',
            issue_category=ticket.issue_category,
            activity_category=ticket.activity_category,
            notify_users=ticket.notify_users,
            location=ticket.location,
            solver_notified=False,
            ticket_age_hours=0.0,
            SLA_Breach=False
        )
        

        cc_users_str = str(ticket.notify_users)
        
        notifications_to_send = []
        def queue_notification(email, message, role_context='System', attach=filename):
            notifications_to_send.append((email, message, role_context, attach))
        db.add(new_ticket)
        db.commit()
        
        database.log_ticket_action(ticket_id, current_solver, "Escalated Ticket", f"Escalated to {new_solver} ({new_dept})", reason, attachment=filename)
        
        current_solver_email = get_user_email(current_solver, users)
        new_solver_email = get_user_email(new_solver_emp_id, users)
        requestor = get_user_email(orig_raiser, users) or orig_raiser
    
        loc_val = str(ticket.location or '').strip()
        loc_suffix = f" for {loc_val}" if loc_val and loc_val.lower() != 'nan' else ""

        if new_solver_email:
            database.create_notification(new_solver_email, f"Action Required: Ticket #{ticket_id} has been escalated to you by {get_user_name_dept(current_solver, users)}.", ticket_id=ticket_id, role_context='Solver', action_attachment=filename, custom_subject=f"Action Required: Ticket #{ticket_id} has been Escalated to you{loc_suffix}")
        if current_solver_email:
            database.create_notification(current_solver_email, f"Confirmation: Ticket #{ticket_id} escalated to {get_user_name_dept(new_solver, users)}.", ticket_id=ticket_id, role_context='Solver', action_attachment=filename, custom_subject=f"Confirmation: Ticket #{ticket_id} escalated to {get_user_name_dept(new_solver, users)}{loc_suffix}")
        if requestor:
            database.create_notification(requestor, f"Update: Your Ticket #{ticket_id} has been escalated to {get_user_name_dept(new_solver, users)}.", ticket_id=ticket_id, role_context='Requestor', action_attachment=filename, custom_subject=f"Update: Ticket #{ticket_id} has been Escalated{loc_suffix}")
        
        admin_emails = database.get_admin_emails(db)
        for admin_email in admin_emails:
            database.create_notification(admin_email, f"Escalation Alert: Ticket #{ticket_id} was escalated by {get_user_name_dept(current_solver, users)} to {get_user_name_dept(new_solver, users)}.", ticket_id=ticket_id, role_context='Admin', action_attachment=filename, custom_subject=f"Escalation Alert: Ticket #{ticket_id} was Escalated{loc_suffix}")
            
        if cc_users_str and cc_users_str.lower() not in ['nan', 'none', '']:
            for u in [u.strip() for u in cc_users_str.split(',') if u.strip()]:
                u_email = get_user_email(u, users)
                if u_email:
                    database.create_notification(u_email, f"FYI: Ticket #{ticket_id} (CC'd) was escalated to {get_user_name_dept(new_solver, users)}.", ticket_id=ticket_id, role_context='Viewer', action_attachment=filename, custom_subject=f"FYI: Ticket #{ticket_id} was Escalated{loc_suffix}")
        
        return jsonify({"message": "Ticket escalated successfully"}), 200
    finally:
        db.close()


@ticket_bp.route('/api/tickets/accept_escalation', methods=['POST'])
def accept_escalation():
    data = request.json if request.is_json else request.form
    ticket_id = data.get('ticket_id')
    parent_lvl = data.get('parent_lvl') # L1
    child_lvl = data.get('child_lvl') # L2
    remarks = data.get('remarks', '')
    
    db = database.Session()
    try:
        users = db.query(User).all()
        
        p_ticket = db.query(Ticket).filter(Ticket.ticket_id == str(ticket_id), Ticket.escalation_level == parent_lvl).order_by(Ticket.id.desc()).first()
        c_ticket = db.query(Ticket).filter(Ticket.ticket_id == str(ticket_id), Ticket.escalation_level == child_lvl).order_by(Ticket.id.desc()).first()
        
        if not p_ticket or not c_ticket:
            return jsonify({"error": "Ticket levels not found"}), 404
            
        c_ticket.closed_timestamp = database.get_ist_now_str("%d-%m-%Y %H:%M")
        c_ticket.closure_type = 'Accepted'
        c_ticket.status = 'Closed'
        
        p_ticket.status = 'In Progress'
        p_ticket.solver_comments = f"[Accepted Resolution from {child_lvl}]: {remarks}"
        
        parent_solver = p_ticket.assigned_to
        child_solver = c_ticket.assigned_to
        
        database.log_ticket_action(ticket_id, parent_solver, "Resolution Accepted", f"Accepted resolution from {child_lvl}. Back in {parent_lvl} active queue.", remarks)
        
        loc_val = str(p_ticket.location or c_ticket.location or '').strip()
        loc_paren = f" ({loc_val})" if loc_val and loc_val.lower() != 'nan' else ""

        c_email = get_user_email(child_solver, users)
        if c_email:
            database.create_notification(c_email, f"Success: Your resolution for Ticket #{ticket_id} was accepted by {get_user_name_dept(parent_lvl, users)}.\n\nRemarks: {remarks}", ticket_id=ticket_id, role_context='Solver', custom_subject=f"Success: Your resolution for Ticket #{ticket_id} was Accepted by {get_user_name_dept(parent_lvl, users)}{loc_paren}")
            
        p_email = get_user_email(parent_solver, users)
        if p_email:
            database.create_notification(p_email, f"Confirmation: You accepted the resolution for Ticket #{ticket_id} from {child_lvl}.", ticket_id=ticket_id, role_context='Solver', custom_subject=f"Confirmation: Accepted escalation resolution for Ticket #{ticket_id}{loc_paren}")

        req_email = get_user_email(p_ticket.raised_by, users)
        if req_email:
            database.create_notification(req_email, f"Update: Escalation resolution for your Ticket #{ticket_id} was accepted by {get_user_name_dept(parent_solver, users)} and is back in active progress.", ticket_id=ticket_id, role_context='Requestor', custom_subject=f"Update: Escalation resolution accepted for Ticket #{ticket_id}{loc_paren}")

        cc_users_str = str(p_ticket.notify_users or c_ticket.notify_users or '')
        if cc_users_str and cc_users_str.lower() not in ['nan', 'none', '']:
            for u in [u.strip() for u in cc_users_str.split(',') if u.strip()]:
                u_email = get_user_email(u, users)
                if u_email:
                    database.create_notification(u_email, f"FYI: Escalation resolution for Ticket #{ticket_id} was accepted by {get_user_name_dept(parent_solver, users)}.", ticket_id=ticket_id, role_context='Viewer', custom_subject=f"FYI: Escalation resolution accepted for Ticket #{ticket_id}{loc_paren}")
            
        db.commit()
        return jsonify({"message": "Escalation accepted"}), 200
    finally:
        db.close()

@ticket_bp.route('/api/tickets/reject_escalation', methods=['POST'])
def reject_escalation():
    data = request.json if request.is_json else request.form
    ticket_id = data.get('ticket_id')
    parent_lvl = data.get('parent_lvl') # L1
    child_lvl = data.get('child_lvl') # L2
    remarks = data.get('remarks', '')
    
    db = database.Session()
    try:
        users = db.query(User).all()
        
        p_ticket = db.query(Ticket).filter(Ticket.ticket_id == str(ticket_id), Ticket.escalation_level == parent_lvl).order_by(Ticket.id.desc()).first()
        c_ticket = db.query(Ticket).filter(Ticket.ticket_id == str(ticket_id), Ticket.escalation_level == child_lvl).order_by(Ticket.id.desc()).first()
        
        if not p_ticket or not c_ticket:
            return jsonify({"error": "Ticket levels not found"}), 404
            
        c_ticket.status = 'Open'
        c_ticket.solved_timestamp = ''
        c_ticket.solver_comments = f"[Rejected by {parent_lvl}]: {remarks}"
        
        p_ticket.status = 'Escalated'
        
        parent_solver = p_ticket.assigned_to
        child_solver = c_ticket.assigned_to
        
        database.log_ticket_action(ticket_id, parent_solver, "Resolution Rejected", f"Rejected resolution from {child_lvl}. Ticket returned to {child_lvl}.", remarks)
        
        loc_val = str(p_ticket.location or c_ticket.location or '').strip()
        loc_paren = f" ({loc_val})" if loc_val and loc_val.lower() != 'nan' else ""

        c_email = get_user_email(child_solver, users)
        if c_email:
            database.create_notification(c_email, f"Action Required: Your resolution for Ticket #{ticket_id} was REJECTED by {get_user_name_dept(parent_lvl, users)} and returned to you.\n\nRemarks: {remarks}", ticket_id=ticket_id, role_context='Solver', custom_subject=f"Action Required: Escalation for Ticket #{ticket_id} was Reopened & Returned to you{loc_paren}")
            
        p_email = get_user_email(parent_solver, users)
        if p_email:
            database.create_notification(p_email, f"Confirmation: Escalation for Ticket #{ticket_id} was returned to {child_lvl}.", ticket_id=ticket_id, role_context='Solver', custom_subject=f"Confirmation: Escalation for Ticket #{ticket_id} returned to {child_lvl}{loc_paren}")

        req_email = get_user_email(p_ticket.raised_by, users)
        if req_email:
            database.create_notification(req_email, f"Update: Escalation for Ticket #{ticket_id} was returned to {child_lvl} for further work.\n\nRemarks: {remarks}", ticket_id=ticket_id, role_context='Requestor', custom_subject=f"Update: Escalation for Ticket #{ticket_id} returned for further work{loc_paren}")

        cc_users_str = str(p_ticket.notify_users or c_ticket.notify_users or '')
        if cc_users_str and cc_users_str.lower() not in ['nan', 'none', '']:
            for u in [u.strip() for u in cc_users_str.split(',') if u.strip()]:
                u_email = get_user_email(u, users)
                if u_email:
                    database.create_notification(u_email, f"FYI: Escalation for Ticket #{ticket_id} was returned to {child_lvl} for further work.", ticket_id=ticket_id, role_context='Viewer', custom_subject=f"FYI: Escalation for Ticket #{ticket_id} returned for further work{loc_paren}")
            
        db.commit()
        return jsonify({"message": "Escalation rejected"}), 200
    finally:
        db.close()

@ticket_bp.route('/api/tickets/update_status', methods=['POST'])
def update_ticket_status():
    if request.is_json:
        data = request.json
        file = None
    else:
        data = request.form
        file = request.files.get('attachment')
        
    try:
        ticket_id = int(data.get('ticket_id'))
    except (TypeError, ValueError):
        ticket_id = data.get('ticket_id')

    escalation_level = data.get('escalation_level', 'L1')
    new_status = data.get('status')
    
    # Fallback to handle old cached frontend clients sending 'Open'
    if new_status == 'Open':
        new_status = 'In Progress'
        
    remarks = data.get('remarks', '')
    new_deadline = data.get('new_deadline')
    
    db = database.Session()
    try:
        users = db.query(User).all()
        
        ticket = db.query(Ticket).filter(
            Ticket.ticket_id == str(ticket_id),
            Ticket.escalation_level == escalation_level
        ).order_by(Ticket.id.desc()).first()
        
        if not ticket:
            ticket = db.query(Ticket).filter(Ticket.ticket_id == str(ticket_id)).order_by(Ticket.id.desc()).first()
            if not ticket:
                return jsonify({"error": "Ticket not found"}), 404
                
        if ticket.reassign_requested_to and str(ticket.reassign_requested_to).strip() and str(ticket.reassign_requested_to).lower() not in ['nan', 'none', '']:
            return jsonify({"error": "Ticket is non-actionable as a handover request is pending Admin approval."}), 400
                
        original_ticket_status = str(ticket.status or '').strip()
        requestor_raw = str(ticket.raised_by)
        solver_raw = str(ticket.assigned_to)
        
        # Check authorization if caller identifier is provided
        caller_email = str(data.get('user_email') or '').strip().lower()
        caller_emp_id = str(data.get('user_emp_id') or '').strip().lower()
        caller_role = str(data.get('user_role') or '').strip().lower()
        
        if caller_email or caller_emp_id:
            assigned_emp = str(ticket.assigned_to or '').strip().lower()
            assigned_email = str(get_user_email(ticket.assigned_to, users) or '').strip().lower()
            raiser_emp = str(ticket.raised_by or '').strip().lower()
            raiser_email = str(get_user_email(ticket.raised_by, users) or '').strip().lower()
            orig_raiser_emp = str(ticket.original_raiser or '').strip().lower()
            orig_raiser_email = str(get_user_email(ticket.original_raiser, users) or '').strip().lower()

            is_assigned_solver = (caller_emp_id and caller_emp_id == assigned_emp) or (caller_email and caller_email == assigned_email)
            is_raiser = (caller_emp_id and (caller_emp_id == raiser_emp or caller_emp_id == orig_raiser_emp)) or (caller_email and (caller_email == raiser_email or caller_email == orig_raiser_email))
            is_admin = caller_role in ['admin', 'superadmin', 'super admin']

            if not is_admin:
                if new_status in ['Closed', 'Reopened']:
                    if not is_raiser and not is_assigned_solver:
                        return jsonify({"error": "Unauthorized: Only the ticket raiser or admin can close/reopen this ticket."}), 403
                else:
                    if not is_assigned_solver:
                        return jsonify({"error": "Unauthorized: Only the assigned solver of this escalation level can update its status."}), 403

        requestor_email = get_user_email(requestor_raw, users)
        solver_email = get_user_email(solver_raw, users)
        
        curr_lvl = str(ticket.escalation_level or 'L1').strip()
        action_by = requestor_raw if new_status in ['Closed', 'Reopened'] else solver_raw
        actual_status = new_status
        
        filename = ""
        if file and file.filename != '':
            safe_name = secure_filename(file.filename)
            filename = f"status_{ticket_id}_{safe_name}"
            filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            compress_image_to_20kb(filepath)
        
        if new_status == 'On Hold':
            actual_status = 'On Hold'
            
            ticket.closure_type = 'On Hold'
            ticket.closed_timestamp = database.get_ist_now_str("%d-%m-%Y %H:%M")
            ticket.solver_comments = remarks
            
            curr_lvl = str(ticket.escalation_level).strip()
            if curr_lvl != 'L1':
                try:
                    curr_num = int(curr_lvl.replace('L', ''))
                    parent_lvl = f"L{curr_num - 1}"
                except:
                    parent_lvl = 'L1'
                    
                p_ticket = db.query(Ticket).filter(
                    Ticket.ticket_id == str(ticket_id),
                    Ticket.escalation_level == parent_lvl
                ).order_by(Ticket.id.desc()).first()
                
                loc_val = str(ticket.location or p_ticket.location if p_ticket else '').strip()
                loc_paren = f" ({loc_val})" if loc_val and loc_val.lower() != 'nan' else ""
                loc_suffix = f" for {loc_val}" if loc_val and loc_val.lower() != 'nan' else ""

                if p_ticket:
                    p_ticket.status = 'In Progress'
                    p_ticket.closure_type = ''
                    p_ticket.closed_timestamp = ''
                    p_ticket.solved_timestamp = ''
                    action_name = "Escalation Put On Hold"
                    p_ticket.solver_comments = f"[{action_name} by {curr_lvl}]: {remarks}"
                    
                    parent_solver = str(p_ticket.assigned_to)
                    p_email = get_user_email(parent_solver, users)
                    if p_email:
                        database.create_notification(p_email, f"Action Required: Escalation for Ticket #{ticket_id} was put on hold. It has been returned to you.\n\nRemarks: {remarks}", ticket_id=ticket_id, role_context='Solver', action_attachment=filename, custom_subject=f"Action Required: Escalation for Ticket #{ticket_id} Put On Hold - Returned to you{loc_paren}")
                    
                    req_email = get_user_email(ticket.raised_by or p_ticket.raised_by, users)
                    if req_email:
                        database.create_notification(req_email, f"Notice: Escalation for Ticket #{ticket_id} was placed on hold by specialist ({curr_lvl}).\n\nRemarks: {remarks}", ticket_id=ticket_id, role_context='Requestor', action_attachment=filename, custom_subject=f"Notice: Escalation for Ticket #{ticket_id} Put On Hold by specialist{loc_paren}")

                    esc_cc = str(ticket.notify_users or p_ticket.notify_users or '')
                    if esc_cc and esc_cc.lower() not in ['nan', 'none', '']:
                        for u in [u.strip() for u in esc_cc.split(',') if u.strip()]:
                            u_email = get_user_email(u, users)
                            if u_email:
                                database.create_notification(u_email, f"Notice: Escalation for Ticket #{ticket_id} was placed on hold by {curr_lvl}.", ticket_id=ticket_id, role_context='Viewer', action_attachment=filename, custom_subject=f"Notice: Escalation for Ticket #{ticket_id} Put On Hold{loc_paren}")

                    ticket.status = actual_status
                    database.log_ticket_action(ticket_id, solver_raw, action_name, f"Returned to {parent_lvl} solver")
                else:
                    ticket.status = actual_status
            else:
                ticket.status = actual_status
                
        elif new_status == 'Decline':
            actual_status = 'Declined'
            closure_val = 'Declined'
            
            ticket.closure_type = closure_val
            ticket.closed_timestamp = database.get_ist_now_str("%d-%m-%Y %H:%M")
            ticket.solver_comments = remarks
            
            curr_lvl = str(ticket.escalation_level).strip()
            if curr_lvl != 'L1':
                try:
                    curr_num = int(curr_lvl.replace('L', ''))
                    parent_lvl = f"L{curr_num - 1}"
                except:
                    parent_lvl = 'L1'
                    
                p_ticket = db.query(Ticket).filter(
                    Ticket.ticket_id == str(ticket_id),
                    Ticket.escalation_level == parent_lvl
                ).order_by(Ticket.id.desc()).first()
                
                loc_val = str(ticket.location or p_ticket.location if p_ticket else '').strip()
                loc_paren = f" ({loc_val})" if loc_val and loc_val.lower() != 'nan' else ""
                loc_suffix = f" for {loc_val}" if loc_val and loc_val.lower() != 'nan' else ""

                if p_ticket:
                    p_ticket.status = 'In Progress'
                    p_ticket.closure_type = ''
                    p_ticket.closed_timestamp = ''
                    p_ticket.solved_timestamp = ''
                    action_name = "Escalation Declined"
                    p_ticket.solver_comments = f"[{action_name} by {curr_lvl}]: {remarks}"
                    
                    parent_solver = str(p_ticket.assigned_to)
                    p_email = get_user_email(parent_solver, users)
                    if p_email:
                        database.create_notification(p_email, f"Action Required: Escalation for Ticket #{ticket_id} was declined. It has been returned to you.\n\nRemarks: {remarks}", ticket_id=ticket_id, role_context='Solver', action_attachment=filename, custom_subject=f"Action Required: Escalation for Ticket #{ticket_id} Declined - Returned to you{loc_paren}")

                    req_email = get_user_email(ticket.raised_by or p_ticket.raised_by, users)
                    if req_email:
                        database.create_notification(req_email, f"Notice: Escalation for Ticket #{ticket_id} was declined by specialist ({curr_lvl}).\n\nRemarks: {remarks}", ticket_id=ticket_id, role_context='Requestor', action_attachment=filename, custom_subject=f"Notice: Escalation for Ticket #{ticket_id} Declined by specialist{loc_paren}")

                    esc_cc = str(ticket.notify_users or p_ticket.notify_users or '')
                    if esc_cc and esc_cc.lower() not in ['nan', 'none', '']:
                        for u in [u.strip() for u in esc_cc.split(',') if u.strip()]:
                            u_email = get_user_email(u, users)
                            if u_email:
                                database.create_notification(u_email, f"Notice: Escalation for Ticket #{ticket_id} was declined by {curr_lvl}.", ticket_id=ticket_id, role_context='Viewer', action_attachment=filename, custom_subject=f"Notice: Escalation for Ticket #{ticket_id} Declined{loc_paren}")

                    ticket.status = actual_status
                    database.log_ticket_action(ticket_id, solver_raw, action_name, f"Returned to {parent_lvl} solver")
                else:
                    ticket.status = actual_status
            else:
                ticket.status = actual_status
            
        elif new_status == 'Reopened':
            actual_status = 'In Progress'
            ticket.closure_type = ''
            ticket.closed_timestamp = ''
            ticket.solved_timestamp = ''
            ticket.solver_comments = ''
            
            from datetime import timedelta
            new_deadline_dt = (database.get_ist_now() + timedelta(hours=24)).strftime("%d-%m-%Y %H:%M")
            ticket.deadline = new_deadline_dt
            
            new_solver = data.get('new_solver')
            if new_solver:
                old_solver = ticket.assigned_to
                ticket.assigned_to = new_solver
                database.log_ticket_action(ticket_id, requestor_raw, "Reassigned via Reopen", f"Assigned to {new_solver} (was {old_solver})")
                
                loc_val = str(ticket.location or '').strip()
                loc_suffix = f" for {loc_val}" if loc_val and loc_val.lower() != 'nan' else ""

                ns_email = get_user_email(new_solver, users)
                if ns_email:
                    database.create_notification(ns_email, f"Action Required: Ticket #{ticket_id} has been reopened and assigned to you.\n\nRemarks: {remarks}", ticket_id=ticket_id, role_context='Solver', action_attachment=filename, custom_subject=f"Action Required: Ticket #{ticket_id} was Reopened & Assigned to you{loc_suffix}")
            
        elif new_status == 'Resolved':
            ticket.solved_timestamp = database.get_ist_now_str("%d-%m-%Y %H:%M")
            ticket.solver_comments = remarks
            actual_status = 'Resolved'
            
            curr_lvl = str(ticket.escalation_level).strip()
            if curr_lvl != 'L1':
                actual_status = 'Resolved'
                
                try:
                    curr_num = int(curr_lvl.replace('L', ''))
                    parent_lvl = f"L{curr_num - 1}"
                except:
                    parent_lvl = 'L1'
                    
                p_ticket = db.query(Ticket).filter(
                    Ticket.ticket_id == str(ticket_id),
                    Ticket.escalation_level == parent_lvl
                ).order_by(Ticket.id.desc()).first()
                
                loc_val = str(ticket.location or p_ticket.location if p_ticket else '').strip()
                loc_paren = f" ({loc_val})" if loc_val and loc_val.lower() != 'nan' else ""
                loc_suffix = f" for {loc_val}" if loc_val and loc_val.lower() != 'nan' else ""

                if p_ticket:
                    p_ticket.status = 'Escalation Resolved'
                    p_ticket.closure_type = ''
                    p_ticket.closed_timestamp = ''
                    p_ticket.solved_timestamp = ''
                    p_ticket.solver_comments = f"[Escalation Resolved by {curr_lvl}]: {remarks}"
                    database.log_ticket_action(ticket_id, solver_raw, "Escalation Resolved", f"Pending review by {parent_lvl} solver")
                    
                    parent_solver_raw = p_ticket.assigned_to
                    parent_solver_email = get_user_email(parent_solver_raw, users)
                    if parent_solver_email:
                        database.create_notification(parent_solver_email, f"Action Required: Escalation for Ticket #{ticket_id} was resolved by {get_user_name_dept(curr_lvl, users)}. Please review and Accept or Reject.\n\nRemarks: {remarks}", ticket_id=ticket_id, role_context='Solver', action_attachment=filename, custom_subject=f"Action Required: Escalation for Ticket #{ticket_id} Resolved by {get_user_name_dept(curr_lvl, users)} - Please Review{loc_paren}")

                    req_email = get_user_email(ticket.raised_by or p_ticket.raised_by, users)
                    if req_email:
                        database.create_notification(req_email, f"Update: Escalation for Ticket #{ticket_id} was resolved by specialist ({curr_lvl}). It is now being reviewed by your primary solver.", ticket_id=ticket_id, role_context='Requestor', action_attachment=filename, custom_subject=f"Update: Escalation for Ticket #{ticket_id} resolved, pending primary review{loc_paren}")

                    esc_cc = str(ticket.notify_users or p_ticket.notify_users or '')
                    if esc_cc and esc_cc.lower() not in ['nan', 'none', '']:
                        for u in [u.strip() for u in esc_cc.split(',') if u.strip()]:
                            u_email = get_user_email(u, users)
                            if u_email:
                                database.create_notification(u_email, f"FYI: Escalation for Ticket #{ticket_id} was resolved by specialist ({curr_lvl}), pending primary review.", ticket_id=ticket_id, role_context='Viewer', action_attachment=filename, custom_subject=f"FYI: Escalation for Ticket #{ticket_id} resolved, pending primary review{loc_paren}")
            
        elif new_status == 'Closed':
            curr_lvl = str(ticket.escalation_level).strip()
            if curr_lvl != 'L1':
                ticket.closed_timestamp = database.get_ist_now_str("%d-%m-%Y %H:%M")
                ticket.closure_type = 'Accepted'
                actual_status = 'Closed'
                ticket.status = actual_status
                
                try:
                    curr_num = int(curr_lvl.replace('L', ''))
                    parent_lvl = f"L{curr_num - 1}"
                except:
                    parent_lvl = 'L1'
                    
                p_ticket = db.query(Ticket).filter(
                    Ticket.ticket_id == str(ticket_id),
                    Ticket.escalation_level == parent_lvl
                ).order_by(Ticket.id.desc()).first()
                
                loc_val = str(ticket.location or p_ticket.location if p_ticket else '').strip()
                loc_paren = f" ({loc_val})" if loc_val and loc_val.lower() != 'nan' else ""

                if p_ticket:
                    p_ticket.status = 'In Progress'
                    p_ticket.closure_type = ''
                    p_ticket.closed_timestamp = ''
                    p_ticket.solved_timestamp = ''
                    p_ticket.solver_comments = f"[Escalation Accepted]: {remarks}"
                    database.log_ticket_action(ticket_id, requestor_raw, "Escalation Accepted", f"Returned to {parent_lvl} solver")
                    parent_solver_raw = p_ticket.assigned_to
                    parent_solver_email = get_user_email(parent_solver_raw, users)
                    if parent_solver_email:
                        database.create_notification(parent_solver_email, f"Success: Escalation for Ticket #{ticket_id} was successfully resolved by {get_user_name_dept(curr_lvl, users)} and returned to you.\n\nRemarks: {remarks}", ticket_id=ticket_id, role_context='Solver', action_attachment=filename, custom_subject=f"Success: Escalation for Ticket #{ticket_id} resolved by {get_user_name_dept(curr_lvl, users)}{loc_paren}")
            else:
                ticket.closed_timestamp = database.get_ist_now_str("%d-%m-%Y %H:%M")
                ticket.closure_type = 'Accepted'
                actual_status = 'Closed'
                ticket.status = actual_status
                if remarks and 'Requestor accepted' not in remarks:
                    ticket.solver_comments = f"[Accepted by Requestor]: {remarks}"
                
        elif new_status == 'In Progress':
            ticket.solver_comments = remarks
            
        if data.get('is_direct_reassign') and data.get('new_solver'):
            new_solver = data.get('new_solver')
            old_solver = ticket.assigned_to
            old_timestamp = str(ticket.timestamp or '')
            old_deadline = str(ticket.deadline or '')
            
            dt_old_ts = parse_flexible_dt(old_timestamp)
            dt_old_dl = parse_flexible_dt(old_deadline)
            duration_days = 1
            if dt_old_ts and dt_old_dl and dt_old_dl > dt_old_ts:
                diff_sec = (dt_old_dl - dt_old_ts).total_seconds()
                duration_days = max(1, round(diff_sec / 86400.0))
                
            tz_ist = timezone(timedelta(hours=5, minutes=30))
            now_ist = datetime.now(tz_ist).replace(tzinfo=None)
            new_ts_str = f"{now_ist.strftime('%d-%m-%Y')} 23:59"
            new_dl_dt = now_ist + timedelta(days=duration_days)
            new_dl_str = f"{new_dl_dt.strftime('%d-%m-%Y')} 23:59"
            
            ticket.status = 'Open'
            ticket.timestamp = new_ts_str
            ticket.deadline = new_dl_str
            if hasattr(ticket, 'absolute_deadline'): ticket.absolute_deadline = new_dl_str
            if hasattr(ticket, 'has_extended'): ticket.has_extended = 'false'
            ticket.assigned_to = new_solver
            
            old_ts_date = old_timestamp.split(' ')[0]
            old_dl_date = old_deadline.split(' ')[0]
            new_dl_date = new_dl_dt.strftime('%d-%m-%Y')
            new_ts_date = now_ist.strftime('%d-%m-%Y')
            log_details = f"Assigned to {new_solver} (was {old_solver}). SLA reset to {duration_days}d ({new_dl_date}) [Previous Timestamp: {old_ts_date}, Previous Deadline: {old_dl_date}]"
            database.log_ticket_action(ticket_id, requestor_raw, "Reassigned", log_details)
            database.log_system_action(requestor_raw or 'System', 'Reassigned', f"Ticket #{ticket_id}", f"Ticket #{ticket_id} reassigned to {new_solver}. SLA reset from ({old_ts_date} -> {old_dl_date}) to ({new_ts_date} -> {new_dl_date}).")
            ns_email = get_user_email(new_solver, users)
            if ns_email:
                loc_val_dr = str(ticket.location or '').strip()
                loc_suffix_dr = f" for {loc_val_dr}" if loc_val_dr and loc_val_dr.lower() != 'nan' else ""
                database.create_notification(ns_email, f"Action Required: Ticket #{ticket_id} has been reassigned to you by the requestor.\n\nRemarks: {remarks}", ticket_id=ticket_id, role_context='Solver', action_attachment=filename, custom_subject=f"Action Required: Ticket #{ticket_id} has been reassigned to you{loc_suffix_dr}")
    
        if new_status != 'Closed':
            ticket.status = actual_status
            
        if new_deadline:
            if original_ticket_status != 'Open' or new_status != 'In Progress':
                return jsonify({"error": "Deadline extension is only permitted the first time a ticket transitions from Open to In Progress."}), 400
                
            has_ext_val = str(getattr(ticket, 'has_extended', '') or '').strip().lower()
            if has_ext_val in ['true', '1', 'yes']:
                return jsonify({"error": "Deadline has already been extended once for this ticket. Further extensions are not permitted."}), 400
                
            old_deadline = str(ticket.deadline or '')
            try:
                str_nd = str(new_deadline).strip()
                parts = str_nd.split(' ')
                date_parts = parts[0].replace('/', '-').split('-')
                if len(date_parts) == 3:
                    if len(date_parts[0]) == 4:
                        # YYYY-MM-DD
                        y, m, d = date_parts
                    else:
                        # DD-MM-YYYY
                        d, m, y = date_parts
                    time_part = parts[1] if len(parts) > 1 else '23:59'
                    # Force 23:59 if time defaulted to 00:00 (date-only input)
                    if time_part == '00:00':
                        time_part = '23:59'
                    new_deadline = f"{int(d):02d}-{int(m):02d}-{y} {time_part}"
            except Exception:
                pass

            # Check if current ticket is L1 or an escalated level (L2, L3, etc.)
            curr_esc = str(ticket.escalation_level or '').strip().upper()
            is_l1 = (not curr_esc) or curr_esc == 'L1'

            abs_dl_str = str(ticket.absolute_deadline or '').strip()
            is_beyond_absolute = False
            if abs_dl_str and abs_dl_str.lower() not in ['none', 'nan', '']:
                dt_new_dl = parse_flexible_dt(new_deadline)
                dt_abs_dl = parse_flexible_dt(abs_dl_str)
                if dt_new_dl and dt_abs_dl and dt_new_dl > dt_abs_dl:
                    is_beyond_absolute = True

            old_dl_date = str(old_deadline).split(' ')[0]
            new_dl_date = str(new_deadline).split(' ')[0]
            abs_dl_date = abs_dl_str.split(' ')[0] if abs_dl_str else old_dl_date

            ticket.deadline = new_deadline
            if is_l1:
                # L1 solver extends both level deadline and overall ticket absolute deadline
                ticket.absolute_deadline = new_deadline
                if new_status == 'In Progress':
                    if remarks:
                        ticket.solver_comments = f"{remarks} [Deadline Extended: {old_dl_date} -> {new_dl_date}]"
                    else:
                        ticket.solver_comments = f"[Deadline Extended: {old_dl_date} -> {new_dl_date}]"
                database.log_ticket_action(ticket_id, action_by, "Deadline Extended", f"Changed from {old_dl_date} to {new_dl_date}", remarks)
            else:
                # Escalated solvers (L2, L3, etc.) extend their level deadline
                if is_beyond_absolute:
                    log_detail = f"Changed from {old_dl_date} to {new_dl_date} (Exceeds Original Ticket Deadline: {abs_dl_date})"
                    rule_break_note = f"[Rule Breach: Deadline extended to {new_dl_date} beyond Original Ticket Deadline {abs_dl_date}]"
                    if remarks:
                        ticket.solver_comments = f"{remarks} {rule_break_note}"
                    else:
                        ticket.solver_comments = rule_break_note
                    database.log_ticket_action(ticket_id, action_by, "Deadline Extended (Beyond Absolute)", log_detail, remarks)
                else:
                    if new_status == 'In Progress':
                        if remarks:
                            ticket.solver_comments = f"{remarks} [Deadline Extended: {old_dl_date} -> {new_dl_date}]"
                        else:
                            ticket.solver_comments = f"[Deadline Extended: {old_dl_date} -> {new_dl_date}]"
                    database.log_ticket_action(ticket_id, action_by, "Deadline Extended", f"Changed from {old_dl_date} to {new_dl_date}", remarks)

            ticket.has_extended = True
            

        cc_users_str = str(ticket.notify_users)
        
        loc_val = str(ticket.location or '').strip()
        loc_suffix = f" for {loc_val}" if loc_val and loc_val.lower() != 'nan' else ""

        notifications_to_send = []
        def queue_notification(email, message, role_context='System', attach=filename, custom_subject=None):
            notifications_to_send.append((email, message, role_context, attach, custom_subject))

        info_str = f"To {new_status}"
        action_title = "Status Update"
        if new_status == 'Closed':
            action_title = "Accepted & Closed"
            info_str = ""
        elif new_status == 'Reopened':
            action_title = "Rejected & Reopened"
            info_str = ""
        elif new_status == 'Resolved':
            action_title = "Resolved"
            info_str = ""
        elif new_status == 'Decline':
            action_title = "Declined"
            info_str = ""
        elif new_status == 'On Hold':
            action_title = "On Hold"
            info_str = ""

        database.log_ticket_action(ticket_id, action_by, action_title, info_str, remarks, attachment=filename)
        
        db.commit()

        admin_emails = database.get_admin_emails(db)
        notified_emails = set()
        def send_omni_notification(email, message, role_context='System', custom_subject=None):
            if email and email not in notified_emails:
                queue_notification(email, message, role_context, custom_subject=custom_subject)
                notified_emails.add(email)
    
        if new_status == 'Resolved' and requestor_email and curr_lvl == 'L1':
            send_omni_notification(requestor_email, f"Action Required: Ticket #{ticket_id} has been completely resolved by {get_user_name_dept(solver_raw, users)}! Please review and Accept.", role_context='Requestor', custom_subject=f"Action Required: Ticket #{ticket_id} has been Resolved{loc_suffix} - Please Review")
        elif new_status == 'Closed' and solver_email:
            send_omni_notification(solver_email, f"Ticket #{ticket_id} was Accepted and Closed by the requestor.", role_context='Solver', custom_subject=f"Success: Ticket #{ticket_id} has been Accepted & Closed{loc_suffix}")
        elif new_status == 'Decline' and requestor_email and curr_lvl == 'L1':
            send_omni_notification(requestor_email, f"Notice: Ticket #{ticket_id} was declined by the solver. If you want to reassign the ticket, you have to create a separate ticket for that.", role_context='Requestor', custom_subject=f"Notice: Ticket #{ticket_id} was Declined by Solver{loc_suffix}")
        elif new_status == 'On Hold' and requestor_email and curr_lvl == 'L1':
            send_omni_notification(requestor_email, f"Notice: Ticket #{ticket_id} has been placed on hold by the solver. If you want to reassign the ticket, you have to create a separate ticket for that.", role_context='Requestor', custom_subject=f"Notice: Ticket #{ticket_id} placed On Hold{loc_suffix}")
        elif new_status == 'Reopened' and solver_email:
            send_omni_notification(solver_email, f"Action Required: Ticket #{ticket_id} was REOPENED.", role_context='Solver', custom_subject=f"Action Required: Ticket #{ticket_id} was Reopened{loc_suffix}")
        elif new_status == 'In Progress' and requestor_email:
            send_omni_notification(requestor_email, f"Update: Ticket #{ticket_id} is now In Progress. The solver has started working on it.", role_context='Requestor', custom_subject=f"Update: Ticket #{ticket_id} is now In Progress{loc_suffix}")
        
        for admin_email in admin_emails:
            send_omni_notification(admin_email, f"Admin FYI: Ticket #{ticket_id} status updated to {actual_status}.", role_context='Admin', custom_subject=f"Admin FYI: Ticket #{ticket_id} status updated to {actual_status}{loc_suffix}")
                
        if cc_users_str and cc_users_str.lower() not in ['nan', 'none', ''] and curr_lvl == 'L1':
            for u in [u.strip() for u in cc_users_str.split(',') if u.strip()]:
                u_email = get_user_email(u, users)
                if u_email:
                    if new_status == 'Resolved':
                        cc_sub = f"Update: Ticket #{ticket_id} has been Resolved{loc_suffix}"
                    elif new_status == 'Closed':
                        cc_sub = f"Ticket #{ticket_id} has been Closed{loc_suffix}"
                    elif new_status == 'Reopened':
                        cc_sub = f"Notice: Ticket #{ticket_id} was Reopened{loc_suffix}"
                    elif new_status == 'On Hold':
                        cc_sub = f"Notice: Ticket #{ticket_id} status changed to On Hold{loc_suffix}"
                    elif new_status == 'Decline':
                        cc_sub = f"Notice: Ticket #{ticket_id} was Declined{loc_suffix}"
                    elif new_status == 'In Progress':
                        cc_sub = f"Update: Ticket #{ticket_id} status changed to In Progress{loc_suffix}"
                    else:
                        cc_sub = f"FYI: Ticket #{ticket_id} status updated to: {actual_status}{loc_suffix}"
                    send_omni_notification(u_email, f"FYI: Ticket #{ticket_id} status updated to: {actual_status}.", role_context='Viewer', custom_subject=cc_sub)
                    
        # Now send all queued notifications
        for email, msg, role, attach, c_sub in notifications_to_send:
            database.create_notification(email, msg, ticket_id=ticket_id, role_context=role, action_attachment=attach, custom_subject=c_sub)
        try:
            database.sync_computed_ticket_metrics()
        except Exception as e:
            print(f"Failed to update hours: {e}")
        
        return jsonify({"message": "Ticket updated successfully"}), 200
    finally:
        db.close()

@ticket_bp.route('/api/tickets/handover', methods=['POST', 'OPTIONS'])
def request_handover():
    filename = None
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    data = request.json
    ticket_id = data.get('ticket_id')
    target_id = data.get('target_email') 
    reason = data.get('reason')

    db = database.Session()
    try:
        users = db.query(User).all()
        escalation_level = data.get('escalation_level', 'L1')
        
        ticket = db.query(Ticket).filter(
            Ticket.ticket_id == str(ticket_id),
            Ticket.escalation_level == escalation_level
        ).order_by(Ticket.id.desc()).first()
        
        if not ticket:
            ticket = db.query(Ticket).filter(Ticket.ticket_id == str(ticket_id)).order_by(Ticket.id.desc()).first()
            if not ticket:
                return jsonify({"error": "Ticket not found"}), 404
                
        # Check half SLA duration rule (handover only allowed in first half of SLA window)
        ts_dt = parse_flexible_dt(ticket.timestamp)
        dl_dt = parse_flexible_dt(ticket.deadline)
        if ts_dt and dl_dt and dl_dt > ts_dt:
            sla_seconds = (dl_dt - ts_dt).total_seconds()
            half_threshold_dt = ts_dt + timedelta(seconds=sla_seconds / 2.0)
            
            tz_ist = timezone(timedelta(hours=5, minutes=30))
            now_ist = datetime.now(tz_ist).replace(tzinfo=None)
            
            if now_ist > half_threshold_dt:
                half_str = half_threshold_dt.strftime("%d-%m-%Y %H:%M")
                return jsonify({
                    "error": f"Handover can only be requested within the first half of the SLA duration (before {half_str}). The handover window for this ticket has expired."
                }), 400

        target_emp_id = get_user_emp_id(target_id, users)
        
        # Prevent handover to raisers or solvers across all levels
        restricted_users = get_ticket_restricted_user_identifiers(ticket_id, db, users)
        target_raw_check = str(target_id or '').strip()
        target_email_check = get_user_email(target_id, users)
        if (target_raw_check.lower() in restricted_users or
            (target_emp_id and str(target_emp_id).lower() in restricted_users) or
            (target_email_check and str(target_email_check).lower() in restricted_users)):
            return jsonify({"error": "Ticket cannot be handed over to a raiser or already assigned solver of any level on this ticket."}), 400
        ticket.reassign_requested_to = target_emp_id
        ticket.reassign_reason = reason

        solver_raw = str(ticket.assigned_to)
        solver_email = get_user_email(solver_raw, users)
        target_email = get_user_email(target_emp_id, users)
        raiser_raw = str(ticket.raised_by or '')
        raiser_email = get_user_email(raiser_raw, users)
        admin_emails = database.get_admin_emails(db)
        loc_val = str(ticket.location or '').strip()
        loc_paren = f" ({loc_val})" if loc_val and loc_val.lower() != 'nan' else ""

        for admin_email in admin_emails:
            database.create_notification(admin_email, f"Action Required: Handover Request from {get_user_name_dept(solver_raw, users)} for Ticket #{ticket_id} to {get_user_name_dept(target_emp_id or target_email, users)}.", ticket_id=ticket_id, role_context='Admin', action_attachment=filename, custom_subject=f"Action Required: Handover Request for Ticket #{ticket_id}{loc_paren}")

        if raiser_email:
            database.create_notification(raiser_email, f"Update: Handover requested for your Ticket #{ticket_id} by {get_user_name_dept(solver_raw, users)} to {get_user_name_dept(target_emp_id or target_email, users)}.", ticket_id=ticket_id, role_context='Requestor', action_attachment=filename, custom_subject=f"Update: Handover requested for Ticket #{ticket_id}{loc_paren}")


        cc_users_str = str(ticket.notify_users or '')
        if cc_users_str and cc_users_str.lower() not in ['nan', 'none', '']:
            for u in [u.strip() for u in cc_users_str.split(',') if u.strip()]:
                u_email = get_user_email(u, users)
                if u_email:
                    database.create_notification(u_email, f"FYI: Handover requested for Ticket #{ticket_id} to {target_email or target_emp_id}.", ticket_id=ticket_id, role_context='Viewer', action_attachment=filename, custom_subject=f"FYI: Handover requested for Ticket #{ticket_id}{loc_paren}")

        database.log_ticket_action(ticket_id, solver_raw, "Handover Requested", f"Requested transfer to {target_email or target_emp_id}", reason)
        db.commit()
        return jsonify({"message": "Handover requested successfully"}), 200
    finally:
        db.close()

@ticket_bp.route('/api/tickets/approve-handover', methods=['POST', 'OPTIONS'])
def approve_handover():
    filename = None
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    data = request.json or {}
    ticket_id = data.get('ticket_id')
    decision = data.get('decision') # 'approve' or 'reject'
    if not decision and 'approve' in data:
        decision = 'approve' if data.get('approve') in [True, 'true', 'True', 1, '1'] else 'reject'
    actor_email = data.get('admin_email') or data.get('user_email') or 'Admin'

    if not ticket_id or decision not in ['approve', 'reject']:
        return jsonify({"error": "Invalid payload"}), 400

    db = database.Session()
    try:
        users = db.query(User).all()
        escalation_level = data.get('escalation_level')
        ticket = None
        if escalation_level:
            ticket = db.query(Ticket).filter(
                Ticket.ticket_id == str(ticket_id),
                Ticket.escalation_level == escalation_level
            ).order_by(Ticket.id.desc()).first()
            
        if not ticket or not ticket.reassign_requested_to:
            ticket = db.query(Ticket).filter(
                Ticket.ticket_id == str(ticket_id),
                Ticket.reassign_requested_to.isnot(None),
                Ticket.reassign_requested_to != '',
                Ticket.reassign_requested_to != 'nan'
            ).order_by(Ticket.id.desc()).first()
            
        if not ticket:
            ticket = db.query(Ticket).filter(Ticket.ticket_id == str(ticket_id)).order_by(Ticket.id.desc()).first()
            if not ticket:
                return jsonify({"error": "Ticket not found"}), 404

        solver_raw = str(ticket.assigned_to)
        target_emp_id = ticket.reassign_requested_to

        if decision == 'approve':
            if not target_emp_id:
                return jsonify({"error": "No pending handover to approve"}), 400

            # Prevent handover approval to raisers or solvers across all levels
            restricted_users = get_ticket_restricted_user_identifiers(ticket_id, db, users)
            target_emp_str = str(target_emp_id).strip()
            target_email_str = get_user_email(target_emp_id, users)
            if (target_emp_str.lower() in restricted_users or
                (target_email_str and str(target_email_str).lower() in restricted_users)):
                return jsonify({"error": "Ticket cannot be handed over to a raiser or already assigned solver of any level on this ticket."}), 400

            old_timestamp = str(ticket.timestamp or '')
            old_deadline = str(ticket.deadline or '')
            dt_old_ts = parse_flexible_dt(old_timestamp)
            dt_old_dl = parse_flexible_dt(old_deadline)
            duration_days = 1
            if dt_old_ts and dt_old_dl and dt_old_dl > dt_old_ts:
                diff_sec = (dt_old_dl - dt_old_ts).total_seconds()
                duration_days = max(1, round(diff_sec / 86400.0))
                
            tz_ist = timezone(timedelta(hours=5, minutes=30))
            now_ist = datetime.now(tz_ist).replace(tzinfo=None)
            new_ts_str = f"{now_ist.strftime('%d-%m-%Y')} 23:59"
            new_dl_dt = now_ist + timedelta(days=duration_days)
            new_dl_str = f"{new_dl_dt.strftime('%d-%m-%Y')} 23:59"
            
            ticket.status = 'Open'
            ticket.assigned_to = target_emp_id
            ticket.timestamp = new_ts_str
            ticket.deadline = new_dl_str
            if hasattr(ticket, 'absolute_deadline'): ticket.absolute_deadline = new_dl_str
            if hasattr(ticket, 'has_extended'): ticket.has_extended = 'false'
            ticket.reassign_requested_to = ''
            ticket.reassign_reason = ''
            db.commit()

            try:
                old_ts_date = old_timestamp.split(' ')[0] if old_timestamp else ''
                old_dl_date = old_deadline.split(' ')[0] if old_deadline else ''
                new_ts_date = now_ist.strftime('%d-%m-%Y')
                new_dl_date = new_dl_dt.strftime('%d-%m-%Y')
                
                loc_val = str(ticket.location or '').strip()
                loc_paren = f" ({loc_val})" if loc_val and loc_val.lower() != 'nan' else ""
                loc_suffix = f" for {loc_val}" if loc_val and loc_val.lower() != 'nan' else ""

                target_email = get_user_email(target_emp_id, users)
                solver_email = get_user_email(solver_raw, users)
                raiser_raw = str(ticket.raised_by or '')
                raiser_email = get_user_email(raiser_raw, users)
                if target_email:
                    database.create_notification(target_email, f"Action Required: Ticket #{ticket_id} has been handed over to you from {get_user_name_dept(solver_raw, users)}. SLA reset to {duration_days}d ({new_dl_date}).", ticket_id=ticket_id, role_context='Solver', action_attachment=filename, custom_subject=f"Action Required: Ticket #{ticket_id} handed over to you{loc_suffix}")
                if solver_email:
                    database.create_notification(solver_email, f"Success: Your handover request for Ticket #{ticket_id} was approved.", ticket_id=ticket_id, role_context='Solver', action_attachment=filename, custom_subject=f"Success: Handover request for Ticket #{ticket_id} approved{loc_paren}")
                if raiser_email:
                    database.create_notification(raiser_email, f"Update: Handover of Ticket #{ticket_id} to {get_user_name_dept(target_emp_id or target_email, users)} was approved. SLA reset to {duration_days}d ({new_dl_date}).", ticket_id=ticket_id, role_context='Requestor', action_attachment=filename, custom_subject=f"Update: Ticket #{ticket_id} handed over to new solver{loc_suffix}")
                    
                cc_users_str = str(ticket.notify_users or '')
                if cc_users_str and cc_users_str.lower() not in ['nan', 'none', '']:
                    for u in [u.strip() for u in cc_users_str.split(',') if u.strip()]:
                        u_email = get_user_email(u, users)
                        if u_email:
                            database.create_notification(u_email, f"FYI: Ticket #{ticket_id} handover to {get_user_name_dept(target_emp_id or target_email, users)} was approved.", ticket_id=ticket_id, role_context='Viewer', action_attachment=filename, custom_subject=f"FYI: Ticket #{ticket_id} handover was approved{loc_paren}")
                    
                log_details = f"Handed over to {target_email or target_emp_id}. SLA reset to {duration_days}d ({new_dl_date}) [Previous Timestamp: {old_ts_date}, Previous Deadline: {old_dl_date}]"
                database.log_ticket_action(ticket_id, actor_email, "Handover Approved", log_details, "")
                
                database.sync_computed_ticket_metrics()
            except Exception as post_err:
                print(f"Post-commit operations failed (ticket already saved): {post_err}")

            return jsonify({"message": "Handover approved successfully"}), 200
        else:
            ticket.reassign_requested_to = ''
            ticket.reassign_reason = ''
            db.commit()

            try:
                loc_val = str(ticket.location or '').strip()
                loc_paren = f" ({loc_val})" if loc_val and loc_val.lower() != 'nan' else ""

                solver_email = get_user_email(solver_raw, users)
                raiser_raw = str(ticket.raised_by or '')
                raiser_email = get_user_email(raiser_raw, users)
                if solver_email:
                    database.create_notification(solver_email, f"Alert: Your handover request for Ticket #{ticket_id} was REJECTED.", ticket_id=ticket_id, role_context='Solver', action_attachment=filename, custom_subject=f"Alert: Handover request for Ticket #{ticket_id} was Rejected{loc_paren}")
                if raiser_email:
                    database.create_notification(raiser_email, f"Update: Handover request for Ticket #{ticket_id} was rejected by Admin. Kept with {get_user_name_dept(solver_raw, users)}.", ticket_id=ticket_id, role_context='Requestor', action_attachment=filename, custom_subject=f"Update: Handover request for Ticket #{ticket_id} was rejected by Admin{loc_paren}")
                database.log_ticket_action(ticket_id, actor_email, "Handover Rejected", "Kept with original solver", "")
            except Exception as post_err:
                print(f"Post-commit operations failed on reject (ticket already saved): {post_err}")
            return jsonify({"message": "Handover rejected"}), 200
    except Exception as err:
        db.rollback()
        print(f"Error in approve_handover: {err}")
        return jsonify({"error": f"Failed to process handover: {str(err)}"}), 500
    finally:
        db.close()

@ticket_bp.route('/api/tickets/admin-reassign', methods=['POST', 'OPTIONS'])
def admin_reassign_ticket():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    data = request.json or {}
    ticket_id = data.get('ticket_id')
    new_solver = data.get('new_solver')
    new_dept = data.get('department')
    reason = data.get('reason', 'Force reassigned by Admin')
    admin_email = data.get('admin_email') or data.get('user_email') or 'Admin'

    if not ticket_id or not new_solver:
        return jsonify({"error": "Ticket ID and target solver are required."}), 400

    db = database.Session()
    try:
        users = db.query(User).all()
        ticket = db.query(Ticket).filter(Ticket.ticket_id == str(ticket_id)).order_by(Ticket.id.desc()).first()
        if not ticket:
            return jsonify({"error": "Ticket not found"}), 404

        allowed_reassign_statuses = ['Open', 'In Progress']
        if str(ticket.status).strip() not in allowed_reassign_statuses:
            return jsonify({"error": f"Force reassign is only allowed for tickets marked Open or In Progress. Current status: {ticket.status}"}), 400

        # Prevent force reassigning to raisers or solvers across all levels
        restricted_users = get_ticket_restricted_user_identifiers(ticket_id, db, users)
        target_raw_check = str(new_solver or '').strip()
        target_emp_check = get_user_emp_id(new_solver, users)
        target_email_check = get_user_email(new_solver, users)
        if (target_raw_check.lower() in restricted_users or
            (target_emp_check and str(target_emp_check).lower() in restricted_users) or
            (target_email_check and str(target_email_check).lower() in restricted_users)):
            return jsonify({"error": "Ticket cannot be reassigned to a raiser or already assigned solver of any level on this ticket."}), 400

        old_solver = str(ticket.assigned_to or '')
        old_timestamp = str(ticket.timestamp or '')
        old_deadline = str(ticket.deadline or '')

        # Calculate original duration in days
        dt_old_ts = parse_flexible_dt(old_timestamp)
        dt_old_dl = parse_flexible_dt(old_deadline)
        duration_days = 1
        if dt_old_ts and dt_old_dl and dt_old_dl > dt_old_ts:
            diff_sec = (dt_old_dl - dt_old_ts).total_seconds()
            duration_days = max(1, round(diff_sec / 86400.0))

        tz_ist = timezone(timedelta(hours=5, minutes=30))
        now_ist = datetime.now(tz_ist).replace(tzinfo=None)

        new_ts_str = f"{now_ist.strftime('%d-%m-%Y')} 23:59"
        new_dl_dt = now_ist + timedelta(days=duration_days)
        new_dl_str = f"{new_dl_dt.strftime('%d-%m-%Y')} 23:59"

        ticket.status = 'Open'
        ticket.timestamp = new_ts_str
        ticket.deadline = new_dl_str
        if hasattr(ticket, 'absolute_deadline'):
            ticket.absolute_deadline = new_dl_str
        if hasattr(ticket, 'has_extended'):
            ticket.has_extended = 'false'

        target_emp_str = str(new_solver)
        if target_emp_str.endswith('.0'): target_emp_str = target_emp_str[:-2]
        ticket.assigned_to = target_emp_str

        if new_dept:
            ticket.dept_assigned = new_dept
        else:
            target_u = next((u for u in users if str(u.employee_id) == target_emp_str or str(u.email) == target_emp_str), None)
            if target_u and target_u.department:
                ticket.dept_assigned = target_u.department

        # Clear any pending handover request
        ticket.reassign_requested_to = ''
        ticket.reassign_reason = ''

        db.commit()

        # Post-commit operations
        try:
            old_ts_date = old_timestamp.split(' ')[0] if old_timestamp else ''
            old_dl_date = old_deadline.split(' ')[0] if old_deadline else ''
            new_ts_date = now_ist.strftime('%d-%m-%Y')
            new_dl_date = new_dl_dt.strftime('%d-%m-%Y')

            target_email = get_user_email(target_emp_str, users)
            old_solver_email = get_user_email(old_solver, users)
            raiser_raw = str(ticket.raised_by or '')
            raiser_email = get_user_email(raiser_raw, users)

            loc_val = str(ticket.location or '').strip()
            loc_paren = f" ({loc_val})" if loc_val and loc_val.lower() != 'nan' else ""
            loc_suffix = f" for {loc_val}" if loc_val and loc_val.lower() != 'nan' else ""

            if target_email:
                database.create_notification(target_email, f"Action Required: Ticket #{ticket_id} has been force-reassigned to you by Admin. SLA reset to {duration_days}d ({new_dl_date}). Reason: {reason}", ticket_id=ticket_id, role_context='Solver', custom_subject=f"Action Required: Ticket #{ticket_id} reassigned to you by Admin{loc_suffix}")
            if old_solver_email:
                database.create_notification(old_solver_email, f"FYI: Ticket #{ticket_id} was reassigned to another solver by Admin.", ticket_id=ticket_id, role_context='Solver', custom_subject=f"FYI: Ticket #{ticket_id} was reassigned to another solver{loc_paren}")
            if raiser_email:
                database.create_notification(raiser_email, f"Update: Your Ticket #{ticket_id} was reassigned by Admin to {get_user_name_dept(target_emp_str, users)}. SLA reset to {duration_days}d ({new_dl_date}). Reason: {reason}", ticket_id=ticket_id, role_context='Requestor', custom_subject=f"Update: Ticket #{ticket_id} reassigned to new solver{loc_suffix}")

            cc_users_str = str(ticket.notify_users or '')
            if cc_users_str and cc_users_str.lower() not in ['nan', 'none', '']:
                for u in [u.strip() for u in cc_users_str.split(',') if u.strip()]:
                    u_email = get_user_email(u, users)
                    if u_email:
                        database.create_notification(u_email, f"FYI: Ticket #{ticket_id} was force-reassigned by Admin to {get_user_name_dept(target_emp_str, users)}.", ticket_id=ticket_id, role_context='Viewer', custom_subject=f"FYI: Ticket #{ticket_id} was force-reassigned by Admin{loc_paren}")

            log_details = f"Force reassigned from {get_user_name_dept(old_solver, users)} to {get_user_name_dept(target_emp_str, users)}. Reason: {reason}. SLA reset to {duration_days}d ({new_dl_date}) [Previous: {old_ts_date} -> {old_dl_date}]"
            database.log_ticket_action(ticket_id, admin_email, "Force Reassigned", log_details, reason)
            database.log_system_action(admin_email, 'Force Reassigned', f"Ticket #{ticket_id}", f"Ticket #{ticket_id} force-reassigned to {target_email or target_emp_str}.")

            database.sync_computed_ticket_metrics()
        except Exception as post_err:
            print(f"Post-commit operations failed on admin_reassign: {post_err}")

        return jsonify({"message": "Ticket force reassigned successfully"}), 200
    except Exception as err:
        db.rollback()
        print(f"Error in admin_reassign_ticket: {err}")
        return jsonify({"error": f"Failed to reassign ticket: {str(err)}"}), 500
    finally:
        db.close()

@ticket_bp.route('/api/reports/ageing', methods=['GET'])
def get_ageing_report():
    dept = request.args.get('dept')
    db = database.Session()
    try:
        report_data = database.generate_full_ageing_report()
        users = db.query(User).all()
        
        if dept and dept not in ['undefined', 'null', '']:
            report_data = [t for t in report_data if t.get('dept_assigned') == dept]
            
        for r in report_data:
            r['assigned_to'] = get_user_display(r.get('assigned_to'), users)
            r['assigned_by'] = get_user_display(r.get('assigned_by'), users)
            r['assigned_solver_name'] = r['assigned_to']
            r['raiser_name'] = r['assigned_by']
            r['status'] = str(r['status']).title()
            
        return jsonify(report_data), 200
    finally:
        db.close()

@ticket_bp.route('/api/tickets/chat', methods=['POST', 'OPTIONS'])
def add_ticket_chat():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
        
    data = request.json
    ticket_id = data.get('ticket_id')
    user_email = data.get('user_email')
    message = data.get('message')
    
    database.log_ticket_action(ticket_id, user_email, "Chat", "User Message", message)
    return jsonify({"message": "Chat message saved successfully"}), 200

@ticket_bp.route('/api/canned_responses', methods=['GET', 'POST', 'OPTIONS'])
def handle_canned_responses():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    db = database.Session()
    try:
        user_identifier = (request.args.get('user_email') or request.args.get('user') or request.args.get('created_by') or '').strip()
        user_role = (request.args.get('role') or '').strip().lower()

        if request.method == 'GET':
            all_items = db.query(CannedResponse).all()
            
            # Super Admin sees all templates
            if user_role in ['superadmin', 'super admin']:
                return jsonify([item.to_dict() for item in all_items]), 200

            # For regular users / solvers / admins:
            # Show all Global/Default templates (is_custom is False or empty created_by)
            # PLUS only the custom templates created by THIS specific user
            visible_items = []
            u_clean = user_identifier.lower()
            
            # If user_identifier is provided, also resolve their employee_id and name for complete matching
            u_names = {u_clean}
            if u_clean:
                user_obj = db.query(User).filter((User.email == user_identifier) | (User.employee_id == user_identifier)).first()
                if user_obj:
                    if user_obj.email: u_names.add(user_obj.email.strip().lower())
                    if user_obj.employee_id: u_names.add(user_obj.employee_id.strip().lower())
                    if user_obj.name: u_names.add(user_obj.name.strip().lower())

            for item in all_items:
                is_custom = bool(item.is_custom)
                creator = str(item.created_by or '').strip().lower()

                if not is_custom or not creator:
                    # Global/default template - visible to everyone
                    visible_items.append(item.to_dict())
                elif u_names and creator in u_names:
                    # Custom template created by this user
                    visible_items.append(item.to_dict())

            return jsonify(visible_items), 200

        if request.method == 'POST':
            data = request.json or {}
            label = (data.get('label') or '').strip()
            text_val = (data.get('text') or '').strip()
            created_by = (data.get('created_by') or user_identifier or '').strip()
            is_global = bool(data.get('is_global', False))
            user_role = (data.get('role') or user_role or '').strip().lower()

            if not label or not text_val:
                return jsonify({"error": "Label and text are required"}), 400

            # Super Admin can create Global/Default templates
            if is_global or (user_role in ['superadmin', 'super admin'] and data.get('is_custom') is False):
                new_canned = CannedResponse(
                    label=label,
                    text=text_val,
                    created_by=created_by or 'Super Admin',
                    is_custom=False,
                    timestamp=database.get_ist_now_str('%d/%b/%Y %H:%M:%S')
                )
                db.add(new_canned)
                db.commit()
                return jsonify(new_canned.to_dict()), 201

            # Custom user template creation
            if not created_by:
                return jsonify({"error": "User identification required to save custom template."}), 400

            # Enforce max 10 custom templates limit per user
            u_clean = created_by.lower()
            u_names = {u_clean}
            user_obj = db.query(User).filter((User.email == created_by) | (User.employee_id == created_by)).first()
            if user_obj:
                if user_obj.email: u_names.add(user_obj.email.strip().lower())
                if user_obj.employee_id: u_names.add(user_obj.employee_id.strip().lower())
                if user_obj.name: u_names.add(user_obj.name.strip().lower())

            existing_user_custom = [
                item for item in db.query(CannedResponse).filter(CannedResponse.is_custom == True).all()
                if str(item.created_by or '').strip().lower() in u_names
            ]

            if len(existing_user_custom) >= 10:
                return jsonify({"error": f"Template limit reached. You can save a maximum of 10 custom canned responses (currently {len(existing_user_custom)}/10)."}), 400

            new_canned = CannedResponse(
                label=label,
                text=text_val,
                created_by=created_by,
                is_custom=True,
                timestamp=database.get_ist_now_str('%d/%b/%Y %H:%M:%S')
            )
            db.add(new_canned)
            db.commit()
            return jsonify(new_canned.to_dict()), 201
    finally:
        db.close()

@ticket_bp.route('/api/canned_responses/<int:canned_id>', methods=['PUT', 'DELETE', 'OPTIONS'])
def update_or_delete_canned_response(canned_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    db = database.Session()
    try:
        item = db.query(CannedResponse).filter(CannedResponse.id == canned_id).first()
        if not item:
            return jsonify({"error": "Template not found"}), 404

        user_identifier = (request.args.get('user_email') or request.args.get('user') or request.args.get('created_by') or '').strip()
        user_role = (request.args.get('role') or '').strip().lower()

        # Authorization check: Super Admin can manage all; regular user can only manage their own custom templates
        if user_role not in ['superadmin', 'super admin']:
            u_clean = user_identifier.lower()
            creator_clean = str(item.created_by or '').strip().lower()
            if not item.is_custom or (u_clean and creator_clean != u_clean):
                return jsonify({"error": "Unauthorized. You can only modify your own custom templates."}), 403

        if request.method == 'PUT':
            data = request.json or {}
            label = (data.get('label') or '').strip()
            text_val = (data.get('text') or '').strip()

            if not label or not text_val:
                return jsonify({"error": "Label and text are required"}), 400

            item.label = label
            item.text = text_val
            if 'is_custom' in data and user_role in ['superadmin', 'super admin']:
                item.is_custom = bool(data['is_custom'])

            db.commit()
            return jsonify(item.to_dict()), 200

        if request.method == 'DELETE':
            db.delete(item)
            db.commit()
            return jsonify({"message": "Template deleted successfully"}), 200
    finally:
        db.close()

@ticket_bp.route('/api/tickets/smart_suggest', methods=['POST', 'OPTIONS'])
def smart_suggest_tickets():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
        
    data = request.json or {}
    query = (data.get('query') or '').strip().lower()
    current_solver = str(data.get('current_solver_emp_id') or '').strip().lower()
    
    if not query or len(query) < 2:
        return jsonify({"suggested_categories": None, "knowledge_base_matches": []}), 200
    
    stopwords = {
        'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about',
        'my', 'me', 'i', 'we', 'our', 'you', 'your', 'he', 'she', 'it', 'they',
        'this', 'that', 'these', 'those', 'here', 'there', 'and', 'or', 'but', 'nor',
        'not', 'no', 'non', 'so', 'too', 'very', 'just', 'more', 'less', 'few', 'enough',
        'available', 'unavailable', 'need', 'needed', 'want', 'wanted', 'please',
        'work', 'working', 'finish', 'finishing', 'done', 'doing', 'job', 'task', 'issue', 'problem', 'ticket', 'item'
    }

    SYNONYM_MAP = {
        'ac': ['equipment', 'appliance', 'cooling', 'hvac'],
        'aircon': ['equipment', 'hvac'],
        'chiller': ['equipment', 'cooling'],
        'pump': ['equipment', 'machinery'],
        'motor': ['equipment', 'machinery'],
        'fan': ['equipment'],
        'generator': ['equipment', 'machinery'],
        'transformer': ['equipment', 'electrical'],
        'panel': ['equipment', 'electrical'],
        'ups': ['equipment', 'electrical'],
        'laptop': ['equipment', 'hardware', 'it'],
        'pc': ['equipment', 'hardware', 'it'],
        'desktop': ['equipment', 'hardware', 'it'],
        'printer': ['equipment', 'hardware', 'it'],
        'machine': ['equipment', 'machinery'],
        'device': ['equipment'],
        'appliance': ['equipment'],

        'malfunction': ['breakdown', 'failure', 'fault', 'issue'],
        'breakdown': ['breakdown', 'failure', 'malfunction'],
        'failure': ['breakdown', 'malfunction', 'fault'],
        'fault': ['breakdown', 'malfunction', 'failure'],
        'defect': ['breakdown', 'issue'],
        'damaged': ['breakdown', 'damage'],
        'damage': ['breakdown', 'damage'],
        'burnt': ['breakdown', 'electrical'],
        'tripped': ['breakdown', 'electrical'],
        'leakage': ['breakdown', 'plumbing'],
        'stopped': ['breakdown', 'stoppage'],
        'stopping': ['breakdown', 'stoppage'],
        'notworking': ['breakdown', 'failure'],
        'broken': ['breakdown', 'damage'],
        'crash': ['breakdown', 'failure'],
        'down': ['breakdown', 'outage'],

        'brick': ['bricks', 'masonry', 'civil', 'material', 'construction', 'shortage'],
        'bricks': ['brick', 'masonry', 'civil', 'material', 'construction', 'shortage'],
        'cement': ['concrete', 'civil', 'material', 'construction', 'shortage'],
        'sand': ['civil', 'material', 'construction', 'shortage'],
        'steel': ['rebar', 'civil', 'material', 'construction', 'shortage'],
        'tiles': ['flooring', 'civil', 'finishing', 'material'],
        'tile': ['flooring', 'civil', 'finishing', 'material'],
        'paint': ['painting', 'finishing', 'material'],
        'material': ['materials', 'supply', 'stock', 'shortage'],
        'materials': ['material', 'supply', 'stock', 'shortage'],

        'shortage': ['shortfall', 'scarcity', 'unavailability', 'insufficient', 'materials'],
        'shortfall': ['shortage', 'scarcity', 'materials'],
        'stockout': ['shortfall', 'materials', 'shortage'],
        'scarcity': ['shortfall', 'shortage', 'materials'],
        'insufficient': ['shortage', 'shortfall', 'scarcity', 'materials'],

        'manpower': ['manpower', 'workforce', 'staff', 'labour'],
        'labour': ['manpower', 'workforce'],
        'staff': ['manpower'],

        'clarify': ['clarification'],
        'clarifying': ['clarification'],

        'drawing': ['drawing', 'blueprint', 'design'],
        'drawings': ['drawing', 'blueprint', 'design'],

        'internet': ['network', 'connectivity', 'wifi', 'lan', 'it'],
        'wifi': ['network', 'connectivity', 'internet', 'lan', 'it'],
        'network': ['connectivity', 'internet', 'wifi', 'lan', 'it'],
        'lan': ['network', 'connectivity', 'internet', 'it'],
        'broadband': ['network', 'connectivity', 'internet', 'it'],
        'router': ['network', 'connectivity', 'hardware', 'it'],
        'server': ['network', 'connectivity', 'it', 'software'],
        'system': ['software', 'it', 'connectivity'],

        'water': ['drainage', 'plumbing', 'weather', 'civil', 'leakage'],
        'waterlogging': ['drainage', 'weather', 'flood', 'civil', 'mep'],
        'logging': ['waterlogging', 'drainage', 'weather', 'flood'],
        'flood': ['drainage', 'weather', 'water', 'civil'],
        'rain': ['weather', 'drainage', 'civil'],
        'monsoon': ['weather', 'drainage', 'civil'],
        'seepage': ['leakage', 'waterproofing', 'civil', 'quality'],
        'drain': ['drainage', 'plumbing', 'mep']
    }

    # Extract non-stopword query tokens
    query_clean_tokens = [w for w in re.split(r'\W+', query) if w and w not in stopwords]
    raw_words = query_clean_tokens if query_clean_tokens else [w for w in re.split(r'\W+', query) if w]
    q_words = list(raw_words)
    for w in raw_words:
        if w in SYNONYM_MAP:
            q_words.extend(SYNONYM_MAP[w])

    def get_char_ngrams(text, n=3):
        text = f"#{text.lower().strip()}#"
        return set(text[i:i+n] for i in range(len(text) - n + 1))

    def jaccard_char_similarity(str1, str2):
        ng1 = get_char_ngrams(str1)
        ng2 = get_char_ngrams(str2)
        if not ng1 or not ng2: return 0.0
        intersection = len(ng1.intersection(ng2))
        union = len(ng1.union(ng2))
        return intersection / float(union)

    def jaccard_word_similarity(str1, str2):
        w1 = set(w for w in re.split(r'\W+', str1.lower()) if w and len(w) > 2 and w not in stopwords)
        w2 = set(w for w in re.split(r'\W+', str2.lower()) if w and len(w) > 2 and w not in stopwords)
        if not w1 or not w2: return 0.0
        return len(w1.intersection(w2)) / float(len(w1.union(w2)))

    db = database.Session()
    try:
        all_tickets = db.query(Ticket).all()
        users = db.query(User).all()
        all_depts = [d.department_name for d in db.query(Department).all() if d.department_name]
        all_issues = [ic.issue_name for ic in db.query(IssueCategory).all() if ic.issue_name]
        all_activities = [ac.activity_name for ac in db.query(ActivityCategory).all() if ac.activity_name]

        # 1. Universal Zero-Shot N-Gram Matching Engine
        def match_master(master_list):
            scores = {}
            for master in master_list:
                master_lower = master.lower()
                m_words = [w for w in re.split(r'\W+', master_lower) if w and w not in stopwords]
                
                score = 0.0

                if master_lower in query or query in master_lower:
                    score += 500.0

                matched_words = 0
                for qw in q_words:
                    best_w_score = 0.0
                    for mw in m_words:
                        if qw == mw:
                            best_w_score = max(best_w_score, 200.0)
                        elif len(qw) >= 4 and len(mw) >= 4:
                            # Strict root/stem prefix match to avoid matching 'short' to 'shortage' or 'shortfall'
                            if (mw.startswith(qw) or qw.startswith(mw)) and abs(len(qw) - len(mw)) <= 3:
                                # Guard against short vs shortage
                                if qw == 'short' and mw in ['shortage', 'shortfall']:
                                    pass
                                else:
                                    best_w_score = max(best_w_score, 120.0)
                        else:
                            sim = jaccard_char_similarity(qw, mw)
                            if sim > 0.45:
                                best_w_score = max(best_w_score, sim * 150.0)
                    
                    if best_w_score > 0:
                        matched_words += 1
                        score += best_w_score

                if m_words:
                    coverage = matched_words / float(len(m_words))
                    score *= (1.0 + coverage)

                if score > 0:
                    scores[master] = round(score, 2)

            return scores

        dept_scores = match_master(all_depts)
        issue_scores = match_master(all_issues)
        act_scores = match_master(all_activities)

        # 1b. Exhaustive Real-World Concept Mapping (Electrical, Lighting, Plumbing, Doors, HVAC, Materials, Civil, Malls, Hotels, etc.)
        CONCEPT_MAP = {
            # Electrical, Lighting, Power & Fixtures
            'circuit': {'dept': ['Execution'], 'issue': ['Equipment Breakdown', 'Safety Issues'], 'act': ['MEP']},
            'shortcircuit': {'dept': ['Execution'], 'issue': ['Equipment Breakdown', 'Safety Issues'], 'act': ['MEP']},
            'short': {'dept': ['Execution'], 'issue': ['Equipment Breakdown', 'Safety Issues'], 'act': ['MEP']},
            'light': {'dept': ['Execution', 'Contracts & Procurement'], 'issue': ['Machinery Installation', 'Material Shortage', 'Equipment Breakdown'], 'act': ['MEP']},
            'lights': {'dept': ['Execution', 'Contracts & Procurement'], 'issue': ['Machinery Installation', 'Material Shortage', 'Equipment Breakdown'], 'act': ['MEP']},
            'lighting': {'dept': ['Execution', 'Contracts & Procurement'], 'issue': ['Machinery Installation', 'Material Shortage', 'Equipment Breakdown'], 'act': ['MEP']},
            'bulb': {'dept': ['Execution'], 'issue': ['Equipment Breakdown', 'Other Issues'], 'act': ['MEP']},
            'lamp': {'dept': ['Execution'], 'issue': ['Equipment Breakdown'], 'act': ['MEP']},
            'fixture': {'dept': ['Execution'], 'issue': ['Equipment Breakdown', 'Other Issues'], 'act': ['MEP']},
            'wiring': {'dept': ['Execution'], 'issue': ['Equipment Breakdown'], 'act': ['MEP']},
            'switch': {'dept': ['Execution'], 'issue': ['Equipment Breakdown'], 'act': ['MEP']},
            'socket': {'dept': ['Execution'], 'issue': ['Equipment Breakdown'], 'act': ['MEP']},
            'panel': {'dept': ['Execution'], 'issue': ['Equipment Breakdown'], 'act': ['MEP']},
            'db': {'dept': ['Execution'], 'issue': ['Equipment Breakdown'], 'act': ['MEP']},
            'mcb': {'dept': ['Execution'], 'issue': ['Equipment Breakdown'], 'act': ['MEP']},
            'fitting': {'dept': ['Execution'], 'issue': ['Equipment Breakdown', 'Other Issues'], 'act': ['MEP']},
            'illumination': {'dept': ['Execution'], 'issue': ['Other Issues'], 'act': ['MEP']},
            'fan': {'dept': ['Execution'], 'issue': ['Equipment Breakdown'], 'act': ['MEP']},
            'power': {'dept': ['Execution'], 'issue': ['Equipment Breakdown', 'Other Issues'], 'act': ['MEP']},
            'outage': {'dept': ['Execution'], 'issue': ['Equipment Breakdown', 'Other Issues'], 'act': ['MEP']},
            'electricity': {'dept': ['Execution'], 'issue': ['Equipment Breakdown'], 'act': ['MEP']},
            'trip': {'dept': ['Execution'], 'issue': ['Equipment Breakdown'], 'act': ['MEP']},
            'generator': {'dept': ['Execution'], 'issue': ['Equipment Breakdown'], 'act': ['MEP']},
            'transformer': {'dept': ['Execution'], 'issue': ['Equipment Breakdown'], 'act': ['MEP']},
            'voltage': {'dept': ['Execution'], 'issue': ['Equipment Breakdown'], 'act': ['MEP']},
            'cable': {'dept': ['Execution'], 'issue': ['Equipment Breakdown'], 'act': ['MEP']},
            
            # Installation, Maintenance, Fix & Service Actions
            'fix': {'dept': ['Execution'], 'issue': ['Other Issues', 'Equipment Breakdown'], 'act': ['MEP']},
            'repair': {'dept': ['Execution'], 'issue': ['Other Issues', 'Equipment Breakdown'], 'act': ['MEP']},
            'install': {'dept': ['Execution'], 'issue': ['Other Issues', 'Machinery Installation'], 'act': ['MEP']},
            'installation': {'dept': ['Execution'], 'issue': ['Machinery Installation', 'Other Issues'], 'act': ['MEP']},
            'replace': {'dept': ['Execution'], 'issue': ['Other Issues', 'Equipment Breakdown'], 'act': ['MEP']},
            'change': {'dept': ['Execution'], 'issue': ['Other Issues'], 'act': ['MEP']},
            'broken': {'dept': ['Execution'], 'issue': ['Equipment Breakdown', 'Quality Issues'], 'act': ['MEP']},
            'damaged': {'dept': ['Execution', 'Quality'], 'issue': ['Quality Issues'], 'act': ['Civil/Structural']},

            # Doors, Windows, Glass & Joinery
            'door': {'dept': ['Execution'], 'issue': ['Quality Issues', 'Other Issues'], 'act': ['Door']},
            'doors': {'dept': ['Execution'], 'issue': ['Quality Issues', 'Other Issues'], 'act': ['Door']},
            'window': {'dept': ['Execution'], 'issue': ['Quality Issues', 'Other Issues'], 'act': ['Window']},
            'windows': {'dept': ['Execution'], 'issue': ['Quality Issues', 'Other Issues'], 'act': ['Window']},
            'glass': {'dept': ['Execution'], 'issue': ['Quality Issues'], 'act': ['Window']},
            'pane': {'dept': ['Execution'], 'issue': ['Quality Issues'], 'act': ['Window']},
            'lock': {'dept': ['Execution'], 'issue': ['Quality Issues', 'Other Issues'], 'act': ['Door']},
            'handle': {'dept': ['Execution'], 'issue': ['Quality Issues'], 'act': ['Door']},
            'hinge': {'dept': ['Execution'], 'issue': ['Quality Issues'], 'act': ['Door']},
            'shutter': {'dept': ['Execution'], 'issue': ['Quality Issues'], 'act': ['Window']},
            'frame': {'dept': ['Execution'], 'issue': ['Quality Issues'], 'act': ['Door']},

            # HVAC, Cooling, Elevators & Escalators (Malls, Hotels, Offices)
            'ac': {'dept': ['Execution'], 'issue': ['Equipment Breakdown'], 'act': ['MEP']},
            'hvac': {'dept': ['Execution'], 'issue': ['Equipment Breakdown'], 'act': ['MEP']},
            'chiller': {'dept': ['Execution'], 'issue': ['Equipment Breakdown'], 'act': ['MEP']},
            'cooling': {'dept': ['Execution'], 'issue': ['Equipment Breakdown'], 'act': ['MEP']},
            'fcu': {'dept': ['Execution'], 'issue': ['Equipment Breakdown'], 'act': ['MEP']},
            'ahu': {'dept': ['Execution'], 'issue': ['Equipment Breakdown'], 'act': ['MEP']},
            'lift': {'dept': ['Execution'], 'issue': ['Equipment Breakdown'], 'act': ['MEP']},
            'elevator': {'dept': ['Execution'], 'issue': ['Equipment Breakdown'], 'act': ['MEP']},
            'escalator': {'dept': ['Execution'], 'issue': ['Equipment Breakdown'], 'act': ['MEP']},
            
            # Plumbing, Leakage, Seepage, Drainage & Waterlogging (Residential, Hotels, Malls, Sites)
            'plumbing': {'dept': ['Execution'], 'issue': ['Equipment Breakdown', 'Quality Issues'], 'act': ['MEP']},
            'pipe': {'dept': ['Execution'], 'issue': ['Equipment Breakdown', 'Quality Issues'], 'act': ['MEP']},
            'leakage': {'dept': ['Quality', 'Execution'], 'issue': ['Quality Issues', 'Equipment Breakdown'], 'act': ['MEP']},
            'seepage': {'dept': ['Quality', 'Execution'], 'issue': ['Quality Issues'], 'act': ['Civil/Structural']},
            'waterproofing': {'dept': ['Quality', 'Execution'], 'issue': ['Quality Issues'], 'act': ['Civil/Structural']},
            'dampness': {'dept': ['Quality'], 'issue': ['Quality Issues'], 'act': ['Civil/Structural']},
            'drainage': {'dept': ['Execution'], 'issue': ['Equipment Breakdown', 'Weather Issues', 'Other Issues'], 'act': ['MEP', 'Civil/Structural']},
            'sewage': {'dept': ['Execution'], 'issue': ['Equipment Breakdown'], 'act': ['MEP']},
            'stp': {'dept': ['Execution'], 'issue': ['Equipment Breakdown'], 'act': ['MEP']},
            'water': {'dept': ['Execution', 'Quality'], 'issue': ['Weather Issues', 'Quality Issues', 'Equipment Breakdown'], 'act': ['Civil/Structural', 'MEP', 'Landscape']},
            'waterlogging': {'dept': ['Execution'], 'issue': ['Weather Issues', 'Other Issues'], 'act': ['Civil/Structural', 'Landscape', 'MEP']},
            'logging': {'dept': ['Execution'], 'issue': ['Weather Issues', 'Other Issues'], 'act': ['Civil/Structural', 'Landscape', 'MEP']},
            'flood': {'dept': ['Execution'], 'issue': ['Weather Issues'], 'act': ['Civil/Structural', 'Landscape']},
            'rain': {'dept': ['Execution'], 'issue': ['Weather Issues'], 'act': ['Civil/Structural', 'Landscape']},
            'monsoon': {'dept': ['Execution'], 'issue': ['Weather Issues'], 'act': ['Civil/Structural', 'Landscape']},
            'weather': {'dept': ['Execution'], 'issue': ['Weather Issues'], 'act': ['Civil/Structural', 'Landscape']},
            
            # Civil, Painting, Finishing, Walls & Structure
            'paint': {'dept': ['Execution', 'Quality'], 'issue': ['Quality Issues', 'Other Issues'], 'act': ['Finishing']},
            'painting': {'dept': ['Execution', 'Quality'], 'issue': ['Quality Issues', 'Other Issues'], 'act': ['Finishing']},
            'wall': {'dept': ['Quality', 'Execution'], 'issue': ['Quality Issues'], 'act': ['Civil/Structural']},
            'crack': {'dept': ['Quality', 'Execution'], 'issue': ['Quality Issues'], 'act': ['Civil/Structural']},
            'cracks': {'dept': ['Quality', 'Execution'], 'issue': ['Quality Issues'], 'act': ['Civil/Structural']},
            'plaster': {'dept': ['Execution', 'Quality'], 'issue': ['Quality Issues'], 'act': ['Finishing']},
            'tile': {'dept': ['Execution', 'Quality'], 'issue': ['Quality Issues'], 'act': ['Finishing']},
            'flooring': {'dept': ['Execution', 'Quality'], 'issue': ['Quality Issues'], 'act': ['Finishing']},
            'brick': {'dept': ['Contracts & Procurement', 'Execution', 'Procurement And Stores'], 'issue': ['Vendor Mobilisation', 'Material Shortage'], 'act': ['Civil/Structural']},
            'cement': {'dept': ['Contracts & Procurement', 'Execution', 'Procurement And Stores'], 'issue': ['Vendor Mobilisation', 'Material Shortage'], 'act': ['Civil/Structural']},
            'material': {'dept': ['Contracts & Procurement', 'Execution', 'Procurement And Stores'], 'issue': ['Vendor Mobilisation', 'Material Shortage'], 'act': ['Civil/Structural']},
            
            # Safety, Fire & Security (Malls, Hotels, Commercial)
            'fire': {'dept': ['Safety', 'Execution'], 'issue': ['Safety Issues', 'Equipment Breakdown'], 'act': ['MEP']},
            'sprinkler': {'dept': ['Safety', 'Execution'], 'issue': ['Equipment Breakdown', 'Safety Issues'], 'act': ['MEP']},
            'alarm': {'dept': ['Safety', 'Execution'], 'issue': ['Equipment Breakdown', 'Safety Issues'], 'act': ['MEP']},
            'smoke': {'dept': ['Safety'], 'issue': ['Safety Issues'], 'act': ['MEP']},
            'safety': {'dept': ['Safety'], 'issue': ['Safety Issues'], 'act': ['Civil/Structural']},
            'hazard': {'dept': ['Safety'], 'issue': ['Safety Issues'], 'act': ['Civil/Structural']},
            'cctv': {'dept': ['Safety', 'Execution'], 'issue': ['Equipment Breakdown', 'Safety Issues'], 'act': ['MEP']},
            'security': {'dept': ['Safety'], 'issue': ['Safety Issues'], 'act': ['MEP']},

            # Vendors, Procurement & Commercial
            'vendor': {'dept': ['Contracts & Procurement'], 'issue': ['Vendor Mobilisation'], 'act': ['MEP']},
            'supplier': {'dept': ['Contracts & Procurement'], 'issue': ['Vendor Mobilisation'], 'act': ['MEP']},
            'payment': {'dept': ['Contracts & Procurement'], 'issue': ['Payment/Commercial Issues'], 'act': ['MEP']},
            'invoice': {'dept': ['Contracts & Procurement'], 'issue': ['Payment/Commercial Issues'], 'act': ['MEP']},
            'bill': {'dept': ['Contracts & Procurement'], 'issue': ['Payment/Commercial Issues'], 'act': ['MEP']},

            # Design, Drawings & Planning (Tenant Fit-outs, Malls, Offices)
            'drawing': {'dept': ['Design & Planning', 'Planning & Estimation'], 'issue': ['Drawing Not Available', 'Drawing Clarification'], 'act': ['Civil/Structural']},
            'design': {'dept': ['Design', 'Design & Planning'], 'issue': ['Drawing Not Available', 'Drawing Clarification'], 'act': ['Finishing']},
            'blueprint': {'dept': ['Design & Planning'], 'issue': ['Drawing Not Available'], 'act': ['Civil/Structural']},
            'tenant': {'dept': ['Design & Planning', 'Contracts & Procurement'], 'issue': ['Drawing Clarification', 'Approval Pending'], 'act': ['Finishing']},
            'fit-out': {'dept': ['Design & Planning', 'Execution'], 'issue': ['Drawing Clarification', 'Approval Pending'], 'act': ['Finishing']},
            
            # Statutory, Permits & Approvals
            'statutory': {'dept': ['Statutory'], 'issue': ['Statutory Clearance'], 'act': ['Civil/Structural']},
            'permit': {'dept': ['Statutory'], 'issue': ['Statutory Clearance'], 'act': ['Civil/Structural']},
            'noc': {'dept': ['Statutory'], 'issue': ['Statutory Clearance'], 'act': ['Civil/Structural']},
            'approval': {'dept': ['Statutory', 'Cxo'], 'issue': ['Approval Pending'], 'act': ['Civil/Structural']},
            
            # Manpower & Labour
            'labor': {'dept': ['Execution'], 'issue': ['Manpower Shortfall'], 'act': ['Civil/Structural']},
            'labour': {'dept': ['Execution'], 'issue': ['Manpower Shortfall'], 'act': ['Civil/Structural']},
            'worker': {'dept': ['Execution'], 'issue': ['Manpower Shortfall'], 'act': ['Civil/Structural']},
            'manpower': {'dept': ['Execution'], 'issue': ['Manpower Shortfall'], 'act': ['Civil/Structural']},

            # IT, Network, Hardware & Connectivity
            'internet': {'dept': ['IT support'], 'issue': ['Connectivity Issues', 'Equipment Breakdown'], 'act': ['Network', 'MEP']},
            'wifi': {'dept': ['IT support'], 'issue': ['Connectivity Issues', 'Equipment Breakdown'], 'act': ['Network', 'MEP']},
            'network': {'dept': ['IT support'], 'issue': ['Connectivity Issues', 'Equipment Breakdown'], 'act': ['Network', 'MEP']},
            'connectivity': {'dept': ['IT support'], 'issue': ['Connectivity Issues'], 'act': ['Network', 'MEP']},
            'lan': {'dept': ['IT support'], 'issue': ['Connectivity Issues'], 'act': ['Network', 'MEP']},
            'router': {'dept': ['IT support'], 'issue': ['Connectivity Issues', 'Equipment Breakdown'], 'act': ['Network', 'MEP']},
            'server': {'dept': ['IT support'], 'issue': ['Connectivity Issues', 'Equipment Breakdown'], 'act': ['Network', 'MEP']},
            'software': {'dept': ['IT support'], 'issue': ['Equipment Breakdown', 'Other Issues'], 'act': ['Network', 'MEP']},
            'app': {'dept': ['IT support'], 'issue': ['Equipment Breakdown', 'Other Issues'], 'act': ['Network', 'MEP']},
            'laptop': {'dept': ['IT support'], 'issue': ['Equipment Breakdown'], 'act': ['MEP', 'Network']},
            'desktop': {'dept': ['IT support'], 'issue': ['Equipment Breakdown'], 'act': ['MEP', 'Network']},
            'computer': {'dept': ['IT support'], 'issue': ['Equipment Breakdown'], 'act': ['MEP', 'Network']},
            'printer': {'dept': ['IT support'], 'issue': ['Equipment Breakdown'], 'act': ['MEP', 'Network']},
            'email': {'dept': ['IT support'], 'issue': ['Connectivity Issues', 'Other Issues'], 'act': ['Network', 'MEP']}
        }

        for qw in q_words:
            if qw in CONCEPT_MAP:
                c_info = CONCEPT_MAP[qw]
                for d in c_info.get('dept', []):
                    if d in all_depts: dept_scores[d] = dept_scores.get(d, 0.0) + 600.0
                for i in c_info.get('issue', []):
                    if i in all_issues: issue_scores[i] = issue_scores.get(i, 0.0) + 600.0
                for a in c_info.get('act', []):
                    if a in all_activities: act_scores[a] = act_scores.get(a, 0.0) + 600.0

        # 1c. Advanced Semantic Intent Scoring (Action + Target Intersection)
        q_lower = query.lower()
        
        # Define intent keywords
        install_intents = ['install', 'put', 'add', 'fit', 'new', 'extra', 'additional', 'setup', 'build', 'construct', 'assemble', 'place', 'bring']
        shortage_intents = ['shortage', 'lack', 'need more', 'not enough', 'buy', 'order', 'send more', 'supply', 'require', 'need to send', 'empty', 'out of', 'insufficient', 'depleted', 'finish', 'finished']
        breakdown_intents = ['broken', 'not working', 'damage', 'damaged', 'repair', 'fix', 'replace', 'issue', 'fault', 'stop', 'stopped', 'fail', 'failed', 'malfunction', 'leak', 'leaking', 'burst', 'crack', 'cracked']
        
        # Define target keywords
        mep_targets = ['light', 'lights', 'lighting', 'bulb', 'bulbs', 'lamp', 'lamps', 'fixture', 'fixtures', 'ac', 'hvac', 'chiller', 'lift', 'elevator', 'escalator', 'pump', 'generator', 'motor', 'machine', 'equipment', 'wire', 'wiring', 'panel', 'switch', 'socket', 'plumbing', 'pipe', 'valve']
        civil_targets = ['cement', 'brick', 'sand', 'steel', 'material', 'paint', 'tile', 'plaster', 'concrete', 'wall', 'floor', 'ceiling', 'roof', 'window', 'door', 'glass']
        furniture_targets = ['chair', 'chairs', 'table', 'tables', 'desk', 'desks', 'sofa', 'furniture', 'bed', 'cabinet', 'wardrobe', 'shelf', 'shelves']
        it_targets = ['computer', 'laptop', 'mouse', 'keyboard', 'printer', 'network', 'wifi', 'internet', 'server', 'software', 'app']
        housekeeping_targets = ['clean', 'cleaning', 'sweep', 'mop', 'dust', 'washroom', 'toilet', 'garbage', 'trash', 'waste']

        has_install_intent = any(re.search(rf'\b{w}\b', q_lower) for w in install_intents)
        has_shortage_intent = any(re.search(rf'\b{w}\b', q_lower) for w in shortage_intents)
        has_breakdown_intent = any(re.search(rf'\b{w}\b', q_lower) for w in breakdown_intents)
        
        has_mep_target = any(re.search(rf'\b{w}\b', q_lower) for w in mep_targets)
        has_civil_target = any(re.search(rf'\b{w}\b', q_lower) for w in civil_targets)
        has_furniture_target = any(re.search(rf'\b{w}\b', q_lower) for w in furniture_targets)
        has_it_target = any(re.search(rf'\b{w}\b', q_lower) for w in it_targets)
        has_housekeeping_target = any(re.search(rf'\b{w}\b', q_lower) for w in housekeeping_targets)

        # Route Shortages
        if has_shortage_intent and (has_mep_target or has_civil_target or has_furniture_target or has_it_target or has_housekeeping_target):
            issue_scores['Material Shortage'] = issue_scores.get('Material Shortage', 0.0) + 900.0
            dept_scores['Contracts & Procurement'] = dept_scores.get('Contracts & Procurement', 0.0) + 900.0
            if has_mep_target: act_scores['MEP'] = act_scores.get('MEP', 0.0) + 900.0
            elif has_civil_target: act_scores['Civil/Structural'] = act_scores.get('Civil/Structural', 0.0) + 900.0
            elif has_furniture_target: act_scores['Finishing'] = act_scores.get('Finishing', 0.0) + 900.0
            elif has_it_target: act_scores['MEP'] = act_scores.get('MEP', 0.0) + 900.0 # IT falls under MEP
            elif has_housekeeping_target: act_scores['Finishing'] = act_scores.get('Finishing', 0.0) + 900.0
            
        # Route Installations / Additions
        elif has_install_intent and (has_mep_target or has_civil_target or has_furniture_target or has_it_target):
            issue_scores['Machinery Installation'] = issue_scores.get('Machinery Installation', 0.0) + 900.0
            dept_scores['Execution'] = dept_scores.get('Execution', 0.0) + 900.0
            if has_mep_target: act_scores['MEP'] = act_scores.get('MEP', 0.0) + 900.0
            elif has_civil_target: act_scores['Civil/Structural'] = act_scores.get('Civil/Structural', 0.0) + 900.0
            elif has_furniture_target: act_scores['Finishing'] = act_scores.get('Finishing', 0.0) + 900.0
            elif has_it_target: act_scores['MEP'] = act_scores.get('MEP', 0.0) + 900.0
            
        # Route Breakdowns / Repairs
        elif has_breakdown_intent and (has_mep_target or has_civil_target or has_furniture_target or has_it_target):
            issue_scores['Equipment Breakdown'] = issue_scores.get('Equipment Breakdown', 0.0) + 900.0
            dept_scores['Execution'] = dept_scores.get('Execution', 0.0) + 900.0
            if has_mep_target: act_scores['MEP'] = act_scores.get('MEP', 0.0) + 900.0
            elif has_civil_target: act_scores['Civil/Structural'] = act_scores.get('Civil/Structural', 0.0) + 900.0
            elif has_furniture_target: act_scores['Finishing'] = act_scores.get('Finishing', 0.0) + 900.0
            elif has_it_target: act_scores['MEP'] = act_scores.get('MEP', 0.0) + 900.0

        # 2. Dynamic Cross-Master Relationship Inference (Fully automated for any newly created master)
        # 2a. Direct Master Token Overlap & Semantic Linking
        # If an activity matches (e.g. 'Network'), check if any department name shares tokens (e.g. 'IT support' -> 'IT') or if user designations/departments in DB relate
        for act, a_score in list(act_scores.items()):
            if a_score > 0:
                act_toks = set(w for w in re.split(r'\W+', act.lower()) if w and w not in stopwords)
                for d in all_depts:
                    d_toks = set(w for w in re.split(r'\W+', d.lower()) if w and w not in stopwords)
                    # Check direct or semantic overlap
                    if act_toks & d_toks:
                        dept_scores[d] = dept_scores.get(d, 0.0) + (a_score * 0.8)
                    # Domain heuristics: IT / Network / Software / Hardware
                    if any(t in ['network', 'wifi', 'internet', 'connectivity', 'server', 'it'] for t in act_toks):
                        if any(t in ['it', 'software', 'systems', 'tech', 'computer'] for t in d_toks):
                            dept_scores[d] = dept_scores.get(d, 0.0) + (a_score * 0.9)

                for iss in all_issues:
                    i_toks = set(w for w in re.split(r'\W+', iss.lower()) if w and w not in stopwords)
                    if act_toks & i_toks:
                        issue_scores[iss] = issue_scores.get(iss, 0.0) + (a_score * 0.8)
                    if any(t in ['network', 'wifi', 'internet', 'connectivity'] for t in act_toks):
                        if any(t in ['connectivity', 'network', 'system', 'it'] for t in i_toks):
                            issue_scores[iss] = issue_scores.get(iss, 0.0) + (a_score * 0.9)

        for iss, i_score in list(issue_scores.items()):
            if i_score > 0:
                i_toks = set(w for w in re.split(r'\W+', iss.lower()) if w and w not in stopwords)
                for d in all_depts:
                    d_toks = set(w for w in re.split(r'\W+', d.lower()) if w and w not in stopwords)
                    if i_toks & d_toks:
                        dept_scores[d] = dept_scores.get(d, 0.0) + (i_score * 0.8)
                    if any(t in ['connectivity', 'network', 'software', 'it'] for t in i_toks):
                        if any(t in ['it', 'systems', 'support'] for t in d_toks):
                            dept_scores[d] = dept_scores.get(d, 0.0) + (i_score * 0.9)

        # 2b. Compute Document Frequency (DF) and Co-occurrence across historical ticket corpus
        N = max(len(all_tickets), 1)
        doc_freq = {}
        dept_issue_freq, issue_act_freq, dept_act_freq = {}, {}, {}
        for t in all_tickets:
            d, i, a = (t.dept_assigned or '').strip(), (t.issue_category or '').strip(), (t.activity_category or '').strip()
            if d and i: dept_issue_freq.setdefault(i, {})[d] = dept_issue_freq.get(i, {}).get(d, 0) + 1
            if i and a: issue_act_freq.setdefault(i, {})[a] = issue_act_freq.get(i, {}).get(a, 0) + 1
            if d and a: dept_act_freq.setdefault(d, {})[a] = dept_act_freq.get(d, {}).get(a, 0) + 1
            if d and a: dept_act_freq.setdefault(a, {})[d] = dept_act_freq.get(a, {}).get(d, 0) + 1

            words = set(w for w in re.split(r'\W+', f"{t.description or ''} {t.solver_comments or ''}".lower()) if w and len(w) > 2 and w not in stopwords)
            for w in words:
                doc_freq[w] = doc_freq.get(w, 0) + 1

        # Historical co-occurrence boost
        for a, sc in list(act_scores.items()):
            if sc > 0 and a in dept_act_freq:
                for d, freq in dept_act_freq[a].items():
                    dept_scores[d] = dept_scores.get(d, 0.0) + (freq * 100.0)

        # Historical TF-IDF Learning Boost (Word-level Jaccard to eliminate spurious n-gram overlaps)
        for t in all_tickets:
            comb = f"{t.description or ''} {t.solver_comments or ''}".lower()
            if not comb.strip(): continue
            t_sim = jaccard_word_similarity(query, comb)
            if t_sim > 0.20:
                w_score = t_sim * 150.0
                if t.dept_assigned: dept_scores[t.dept_assigned] = dept_scores.get(t.dept_assigned, 0) + w_score
                if t.issue_category: issue_scores[t.issue_category] = issue_scores.get(t.issue_category, 0) + w_score
                if t.activity_category: act_scores[t.activity_category] = act_scores.get(t.activity_category, 0) + w_score

        # Explicit User Override Feedback Boost (Self-Learning from manual choices)
        all_feedbacks = db.query(AIRoutingFeedback).all()
        for fb in all_feedbacks:
            if not fb.query: continue
            fb_sim = jaccard_char_similarity(query, fb.query.lower())
            if fb_sim > 0.15:
                fb_weight = fb_sim * 250.0 * (fb.feedback_score or 1.0)
                if fb.user_selected_dept: dept_scores[fb.user_selected_dept] = dept_scores.get(fb.user_selected_dept, 0) + fb_weight
                if fb.user_selected_issue: issue_scores[fb.user_selected_issue] = issue_scores.get(fb.user_selected_issue, 0) + fb_weight
                if fb.user_selected_act: act_scores[fb.user_selected_act] = act_scores.get(fb.user_selected_act, 0) + fb_weight

        # 3. Knowledge base matching & Feedback Loop
        kb_matches = []
        bigrams = [f"{raw_words[i]} {raw_words[i+1]}" for i in range(len(raw_words)-1)] if len(raw_words) > 1 else []
        for t in all_tickets:
            t_dept, t_issue, t_act = (t.dept_assigned or '').strip(), (t.issue_category or '').strip(), (t.activity_category or '').strip()
            t_desc, t_sol = (t.description or '').strip(), (t.solver_comments or '').strip()
            t_status = (t.status or '').strip().title()
            combined = f"{t_dept} {t_issue} {t_act} {t_desc} {t_sol}".lower()

            score = 0
            if query in combined: score += 25
            for bg in bigrams:
                if len(bg) >= 5 and bg in combined: score += 10
            for tok in raw_words:
                if len(tok) >= 3 and re.search(rf'\b{re.escape(tok)}\b', combined):
                    score += 5

            if score >= 5 and t_status in ['Resolved', 'Closed'] and t_sol and len(t_sol) > 3:
                kb_matches.append({
                    "ticket_id": t.ticket_id,
                    "dept_assigned": t_dept,
                    "issue_category": t_issue,
                    "activity_category": t_act,
                    "description": t_desc,
                    "resolution": t_sol,
                    "score": round(score, 2)
                })

        kb_matches = sorted(kb_matches, key=lambda x: x['score'], reverse=True)[:3]

        # KB Feedback Loop Boost
        for kb in kb_matches:
            b_score = kb['score'] * 20.0
            if kb['dept_assigned']: dept_scores[kb['dept_assigned']] = dept_scores.get(kb['dept_assigned'], 0) + b_score
            if kb['issue_category']: issue_scores[kb['issue_category']] = issue_scores.get(kb['issue_category'], 0) + b_score
            if kb['activity_category']: act_scores[kb['activity_category']] = act_scores.get(kb['activity_category'], 0) + b_score

        # Confidence checks
        has_issue_confidence = bool(issue_scores and max(issue_scores.values()) > 0)
        has_dept_confidence = bool(dept_scores and max(dept_scores.values()) > 0)
        has_act_confidence = bool(act_scores and max(act_scores.values()) > 0)

        if not (has_issue_confidence or has_dept_confidence or has_act_confidence):
            return jsonify({
                "knowledge_base_matches": [],
                "suggested_categories": None,
                "top_escalation_options": [],
                "confidence": "none",
                "message": "Description is unrecognized or too vague. Please describe the specific issue to get AI recommendations."
            }), 200

        best_issue = max(issue_scores, key=issue_scores.get) if has_issue_confidence else None
        if best_issue and best_issue in dept_issue_freq:
            for d, freq in dept_issue_freq[best_issue].items():
                dept_scores[d] = dept_scores.get(d, 0) + (freq * 150.0)

        if best_issue and best_issue in issue_act_freq:
            for a, freq in issue_act_freq[best_issue].items():
                act_scores[a] = act_scores.get(a, 0) + (freq * 150.0)

        best_act = max(act_scores, key=act_scores.get) if (has_act_confidence and act_scores) else None
        best_dept = max(dept_scores, key=dept_scores.get) if (has_dept_confidence and dept_scores) else None

        # 4. Learned Assigned Solver & Learned Deadline (STRICTLY FROM HISTORICAL DATA MATCHES)
        solver_scores = {}
        solver_scores = {}
        matched_hours = []

        for t in all_tickets:
            comb = f"{t.description or ''} {t.solver_comments or ''}".lower()
            if not comb.strip(): continue
            t_sim = jaccard_char_similarity(query, comb)
            is_category_hit = (
                (t.dept_assigned and t.dept_assigned == best_dept) or
                (t.issue_category and t.issue_category == best_issue) or
                (t.activity_category and t.activity_category == best_act)
            )

            # Department / Category scoring boost
            if t_sim > 0.10 or is_category_hit:
                w = (t_sim * 200.0) + (30.0 if is_category_hit else 0.0)
                if t.dept_assigned and t.dept_assigned in all_depts:
                    dept_scores[t.dept_assigned] = dept_scores.get(t.dept_assigned, 0.0) + w

            # Robust Solver & Deadline Learning: Only learn if high text similarity (>= 0.22) OR exact issue + activity match
            is_exact_issue_hit = (
                (t.issue_category and t.issue_category == best_issue and t.activity_category and t.activity_category == best_act)
            )

            if t_sim >= 0.22 or is_exact_issue_hit:
                score_w = (t_sim * 300.0) + (100.0 if is_exact_issue_hit else 0.0)
                
                # Learns Assigned Solver ONLY if actually assigned
                s_id = str(t.assigned_to or '').strip()
                if s_id and s_id.lower() not in ['unassigned', 'nan', 'none', '']:
                    solver_scores[s_id] = solver_scores.get(s_id, 0.0) + score_w

                # Learns Turnaround / Resolution Hours ONLY if actually recorded
                h_val = t.solver_resolution_hours or t.total_turnaround_hours
                if h_val is not None:
                    try:
                        fh = float(h_val)
                        if fh > 0 and not math.isnan(fh):
                            matched_hours.append(fh)
                    except (ValueError, TypeError):
                        pass

        # 5. Approved Handover & Escalation Log Boost (Self-Learning from Real Handover/Escalation Outcomes)
        handover_logs = db.query(TicketLog).filter(TicketLog.action.in_(['Handover Approved', 'Escalated Ticket'])).all()
        ticket_lookup = {str(t.ticket_id): t for t in all_tickets}

        for log in handover_logs:
            t_obj = ticket_lookup.get(str(log.ticket_id))
            if not t_obj: continue
            comb = f"{t_obj.description or ''} {t_obj.solver_comments or ''}".lower()
            if not comb.strip(): continue
            log_sim = jaccard_char_similarity(query, comb)
            if log_sim >= 0.22:
                log_weight = log_sim * 450.0
                details_str = str(log.details or '')
                
                if log.action == 'Handover Approved' and 'Assigned to ' in details_str:
                    target_raw = details_str.split('Assigned to ')[-1].strip()
                    target_emp = get_user_emp_id(target_raw, users)
                    if target_emp and target_emp.lower() not in ['unassigned', 'nan', 'none', '']:
                        solver_scores[target_emp] = solver_scores.get(target_emp, 0.0) + log_weight
                        target_u = next((u for u in users if str(u.employee_id) == str(target_emp) or str(u.email) == str(target_emp)), None)
                        if target_u and target_u.department and target_u.department in all_depts:
                            dept_scores[target_u.department] = dept_scores.get(target_u.department, 0.0) + log_weight
                        if t_obj.issue_category: issue_scores[t_obj.issue_category] = issue_scores.get(t_obj.issue_category, 0) + (log_weight * 0.5)
                        if t_obj.activity_category: act_scores[t_obj.activity_category] = act_scores.get(t_obj.activity_category, 0) + (log_weight * 0.5)
                        
                elif log.action == 'Escalated Ticket' and 'Escalated to ' in details_str:
                    match = re.search(r'Escalated to (.*?)\s*\((.*?)\)', details_str)
                    if match:
                        esc_solver, esc_dept = match.group(1).strip(), match.group(2).strip()
                        esc_emp = get_user_emp_id(esc_solver, users)
                        if esc_emp and esc_emp.lower() not in ['unassigned', 'nan', 'none', '']:
                            solver_scores[esc_emp] = solver_scores.get(esc_emp, 0.0) + log_weight
                        if esc_dept and esc_dept in all_depts:
                            dept_scores[esc_dept] = dept_scores.get(esc_dept, 0.0) + log_weight

        target_dept = (data.get('department') or data.get('dept_assigned') or '').strip()
        if target_dept:
            matched_dept = next((d for d in all_depts if d.strip().lower() == target_dept.lower()), None)
            best_dept = matched_dept if matched_dept else target_dept
        else:
            best_dept = max(dept_scores, key=dept_scores.get) if (has_dept_confidence and dept_scores) else None

        # Ensure suggested solver matches best_dept strictly to eliminate department/solver mismatches
        dept_solver_scores = {}
        if best_dept:
            best_dept_lower = str(best_dept).strip().lower()
            for s_id, sc in solver_scores.items():
                s_u = next((u for u in users if str(u.employee_id).strip().lower() == str(s_id).strip().lower() or str(u.email).strip().lower() == str(s_id).strip().lower()), None)
                if s_u and (s_u.department or '').strip().lower() == best_dept_lower:
                    if str(s_u.role or '').lower() not in ['viewer', 'requestor']:
                        dept_solver_scores[str(s_u.employee_id or s_u.email)] = sc

        if current_solver:
            dept_solver_scores = {k: v for k, v in dept_solver_scores.items() if str(k).strip().lower() != current_solver}

        solver_source = "historical_learning"
        if dept_solver_scores and max(dept_solver_scores.values()) >= 30.0:
            learned_solver = max(dept_solver_scores, key=dept_solver_scores.get)
        else:
            # Smart Fallback: Pick top active solver strictly from best_dept directory
            best_dept_lower = str(best_dept).strip().lower() if best_dept else ''
            dept_users = [
                u for u in users 
                if u.department and (u.department or '').strip().lower() == best_dept_lower 
                and str(u.role or '').lower() not in ['viewer', 'requestor'] 
                and str(u.employee_id).strip().lower() != current_solver
                and str(u.email or '').strip().lower() != current_solver
            ]
            if not dept_users:
                dept_users = [
                    u for u in users 
                    if u.department and (u.department or '').strip().lower() == best_dept_lower 
                    and str(u.employee_id).strip().lower() != current_solver
                    and str(u.email or '').strip().lower() != current_solver
                ]
            learned_solver = str(dept_users[0].employee_id) if dept_users else None
            solver_source = "department_directory" if learned_solver else None

        # Final sanity check: verify that learned_solver actually exists in best_dept
        if learned_solver and best_dept:
            u_check = next((u for u in users if str(u.employee_id).strip().lower() == str(learned_solver).strip().lower() or str(u.email).strip().lower() == str(learned_solver).strip().lower()), None)
            if not u_check or (u_check.department or '').strip().lower() != str(best_dept).strip().lower():
                learned_solver = None
                solver_source = None

        learned_deadline_hours = round(sum(matched_hours) / len(matched_hours), 1) if matched_hours else None

        learned_emp = get_user_emp_id(learned_solver, users) if learned_solver else None

        suggested = {
            "dept_assigned": best_dept,
            "issue_category": best_issue,
            "activity_category": best_act,
            "assigned_to": learned_emp or learned_solver,
            "solver_source": solver_source,
            "deadline_hours": learned_deadline_hours
        }

        # 6. Compute Top 4 Escalation Route Options (Dept - Assigned Solver - Deadline Hours)
        route_map = {}  # (dept, solver_emp) -> {'score': float, 'hours': list}

        for t in all_tickets:
            comb = f"{t.description or ''} {t.solver_comments or ''}".lower()
            if not comb.strip(): continue
            t_sim = jaccard_char_similarity(query, comb)
            if t_sim > 0.08:
                d = (t.dept_assigned or '').strip()
                s = str(t.assigned_to or '').strip()
                if d and s and s.lower() not in ['unassigned', 'nan', 'none', '']:
                    if current_solver and s.lower() == current_solver: continue
                    s_u = next((u for u in users if str(u.employee_id).strip().lower() == s.lower() or str(u.email).strip().lower() == s.lower()), None)
                    if s_u and (s_u.department or '').strip().lower() == d.lower() and str(s_u.role or '').lower() not in ['viewer', 'requestor']:
                        pair = (d, str(s_u.employee_id or s))
                        if pair not in route_map:
                            route_map[pair] = {'score': 0.0, 'hours': []}
                        route_map[pair]['score'] += t_sim * 250.0
                        h_val = t.solver_resolution_hours or t.ticket_age_hours or t.total_turnaround_hours
                        if h_val:
                            try:
                                fh = float(h_val)
                                if fh > 0 and not math.isnan(fh):
                                    route_map[pair]['hours'].append(fh)
                            except (ValueError, TypeError): pass

        for log in handover_logs:
            t_obj = ticket_lookup.get(str(log.ticket_id))
            if not t_obj: continue
            comb = f"{t_obj.description or ''} {t_obj.solver_comments or ''}".lower()
            if not comb.strip(): continue
            log_sim = jaccard_char_similarity(query, comb)
            if log_sim > 0.08:
                details_str = str(log.details or '')
                log_weight = log_sim * 450.0
                
                target_emp, target_dept = None, None
                if log.action == 'Handover Approved' and 'Assigned to ' in details_str:
                    target_raw = details_str.split('Assigned to ')[-1].strip()
                    target_emp = get_user_emp_id(target_raw, users)
                    target_u = next((u for u in users if str(u.employee_id) == str(target_emp) or str(u.email) == str(target_emp)), None)
                    if target_u: target_dept = target_u.department
                elif log.action == 'Escalated Ticket' and 'Escalated to ' in details_str:
                    match = re.search(r'Escalated to (.*?)\s*\((.*?)\)', details_str)
                    if match:
                        esc_solver, esc_dept = match.group(1).strip(), match.group(2).strip()
                        target_emp = get_user_emp_id(esc_solver, users)
                        target_dept = esc_dept
                
                if target_emp and target_dept:
                    if current_solver and str(target_emp).strip().lower() == current_solver:
                        continue
                    # Verify target_emp actually belongs to target_dept
                    t_u_check = next((u for u in users if str(u.employee_id).strip().lower() == str(target_emp).strip().lower() or str(u.email).strip().lower() == str(target_emp).strip().lower()), None)
                    if t_u_check and (t_u_check.department or '').strip().lower() == str(target_dept).strip().lower():
                        pair = (target_dept, str(t_u_check.employee_id or target_emp))
                        if pair not in route_map:
                            route_map[pair] = {'score': 0.0, 'hours': []}
                        route_map[pair]['score'] += log_weight
                        h_val = t_obj.solver_resolution_hours or t_obj.ticket_age_hours
                        if h_val:
                            try:
                                fh = float(h_val)
                                if fh > 0 and not math.isnan(fh):
                                    route_map[pair]['hours'].append(fh)
                            except (ValueError, TypeError): pass

        # Fill up to 4 options using top scoring departments and active solvers if needed
        sorted_depts = sorted(dept_scores, key=dept_scores.get, reverse=True) if dept_scores else all_depts
        for d in sorted_depts:
            if len(route_map) >= 6: break
            dept_solvers = [
                u for u in users 
                if (u.department or '').strip().lower() == str(d).strip().lower() 
                and str(u.employee_id).strip().lower() != current_solver
                and str(u.email or '').strip().lower() != current_solver
                and str(u.role or '').lower() not in ['viewer', 'requestor']
            ]
            if not dept_solvers:
                continue
            for s_u in dept_solvers:
                emp_id = str(s_u.employee_id or s_u.email)
                pair = (d, emp_id)
                if pair not in route_map:
                    base_score = dept_scores.get(d, 10.0) + (50.0 if (s_u.role or '').lower() in ['solver', 'admin', 'superadmin'] else 20.0)
                    route_map[pair] = {'score': base_score, 'hours': [24.0]}
                if len(route_map) >= 6: break

        top_escalation_options = []
        sorted_pairs = sorted(route_map.keys(), key=lambda k: route_map[k]['score'], reverse=True)
        
        for dept, solver_id in sorted_pairs[:4]:
            hrs_list = route_map[(dept, solver_id)]['hours']
            avg_h = round(sum(hrs_list) / len(hrs_list), 1) if hrs_list else 24.0
            s_name = get_user_name_dept(solver_id, users)
            s_email = get_user_email(solver_id, users)
            
            top_escalation_options.append({
                "dept": dept,
                "solver_emp_id": solver_id,
                "solver_name": s_name,
                "solver_email": s_email,
                "deadline_hours": avg_h,
                "score": round(route_map[(dept, solver_id)]['score'], 2)
            })
            
        return jsonify({
            "suggested_categories": suggested,
            "top_escalation_options": top_escalation_options,
            "knowledge_base_matches": kb_matches
        }), 200
    finally:
        db.close()


@ticket_bp.route('/preview_document', methods=['GET'])
def preview_document():
    filename = request.args.get('filename', '')
    if not filename or filename.lower() == 'nan' or filename.lower() == 'none':
        return jsonify({'error': 'Filename is required'}), 400

    filename = os.path.basename(filename)
    filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)

    if not os.path.exists(filepath):
        return jsonify({'error': 'File not found on server'}), 404

    ext = os.path.splitext(filename)[1].lower()

    if ext == '.docx':
        try:
            import zipfile
            import xml.etree.ElementTree as ET

            with zipfile.ZipFile(filepath, 'r') as z:
                xml_content = z.read('word/document.xml')
                tree = ET.fromstring(xml_content)
                paragraphs = []
                for p in tree.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
                    texts = [node.text for node in p.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if node.text]
                    if texts:
                        paragraphs.append(f"<p style='margin-bottom:8px; line-height:1.6; color:#18181b;'>{' '.join(texts)}</p>")
                html = "".join(paragraphs) or "<p>No text content found in document.</p>"
                return jsonify({'type': 'html', 'html': html}), 200
        except Exception as e:
            return jsonify({'error': f'Failed to parse Word document: {str(e)}'}), 500

    elif ext in ['.xlsx', '.xls']:
        try:
            import pandas as pd
            df = pd.read_excel(filepath, sheet_name=0)
            html = df.to_html(classes='excel-table-preview', index=False, na_rep='-')
            table_styled_html = f"""
            <style>
                .excel-table-preview {{ border-collapse: collapse; width: 100%; font-size: 12px; margin-top: 8px; }}
                .excel-table-preview td, .excel-table-preview th {{ border: 1px solid #e4e4e7; padding: 6px 10px; text-align: left; }}
                .excel-table-preview th {{ background-color: #f4f4f5; font-weight: bold; color: #18181b; }}
                .excel-table-preview tr:nth-child(even) {{ background-color: #fafafa; }}
            </style>
            {html}
            """
            return jsonify({'type': 'html', 'html': table_styled_html}), 200
        except Exception as e:
            return jsonify({'error': f'Failed to parse Excel spreadsheet: {str(e)}'}), 500

    elif ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf']:
        return jsonify({'type': 'direct', 'url': f'/uploads/{filename}'}), 200

    else:
        return jsonify({'error': 'Legacy file format (.doc) is not supported for inline preview. Please download to view.'}), 400




