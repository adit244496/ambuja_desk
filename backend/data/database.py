import os
import sys
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
from dotenv import load_dotenv

# Explicit India Standard Timezone (Asia/Kolkata - UTC+05:30)
IST = timezone(timedelta(hours=5, minutes=30))

def get_ist_now():
    """Returns naive datetime representing exact current India Standard Time (IST)."""
    return datetime.now(IST).replace(tzinfo=None)

def get_ist_now_str(fmt="%d-%m-%Y %H:%M"):
    """Returns formatted string of current time in India Standard Time."""
    return get_ist_now().strftime(fmt)

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from models import Base, User, Ticket, TicketLog, Notification, Location, Department, IssueCategory, ActivityCategory, SystemLog, CannedResponse, AIRoutingFeedback

# Load environment variables from .env
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

def auto_sync_schema(engine):
    """
    Auto-creates:
    1. Missing whole tables (Base.metadata.create_all)
    2. Missing individual columns in existing tables (ALTER TABLE ADD COLUMN)
    """
    if not engine:
        return
    try:
        from sqlalchemy import inspect, text
        inspector = inspect(engine)
        Base.metadata.create_all(engine)
        
        # Re-inspect to get current database state
        inspector = inspect(engine)
        with engine.begin() as conn:
            for table_name, table in Base.metadata.tables.items():
                if inspector.has_table(table_name):
                    existing_cols = {col['name']: col for col in inspector.get_columns(table_name)}
                    for column in table.columns:
                        col_name = column.name
                        if col_name not in existing_cols:
                            col_type = column.type.compile(engine.dialect)
                            print(f"[Schema Sync] Auto-creating missing column '{col_name}' ({col_type}) in table '{table_name}'...")
                            conn.execute(text(f'ALTER TABLE "{table_name}" ADD COLUMN "{col_name}" {col_type}'))
                            print(f"[Schema Sync] Column '{col_name}' added to '{table_name}'.")
    except Exception as e:
        print(f"[Schema Sync] Auto-sync schema warning: {e}")

def seed_canned_responses(Session):
    if not Session: return
    db = Session()
    try:
        if db.query(CannedResponse).count() == 0:
            defaults = [
                ("Issue Resolved & Tested", "Issue resolved & tested successfully. Working as expected."),
                ("Equipment Replaced", "Part/equipment replaced and recalibrated. Verified operational."),
                ("Access Provided", "Access credentials and permissions updated. User verified access."),
                ("Site Cleared", "Site inspection completed and physical obstruction cleared."),
                ("Awaiting Diagnostic Info", "Inspected issue. Contacted requestor for additional diagnostic details."),
                ("Material/Part Ordered", "Required material/part has been ordered. Delivery pending."),
                ("Specialized Expertise Needed", "Handover requested: Requires specialized department technical expertise."),
                ("Site Access Hold", "Ticket placed on hold pending site access clearance."),
                ("Duplicate Ticket", "Declined: Duplicate ticket raised for an existing active issue.")
            ]
            for label, txt in defaults:
                db.add(CannedResponse(
                    label=label,
                    text=txt,
                    is_custom=False,
                    timestamp=get_ist_now_str('%d/%b/%Y %H:%M:%S')
                ))
            db.commit()
            print("[Canned Responses] Seeded default templates into PostgreSQL.")
    except Exception as e:
        print(f"[Canned Responses] Seed error: {e}")
    finally:
        db.close()

DB_URL = os.environ.get('DATABASE_URL')
if DB_URL:
    engine = create_engine(DB_URL)
    auto_sync_schema(engine)
    session_factory = sessionmaker(bind=engine)
    Session = scoped_session(session_factory)
    seed_canned_responses(Session)
else:
    print("WARNING: DATABASE_URL not found in .env!")
    engine = None
    Session = None

def get_db():
    db = Session()
    try:
        yield db
    finally:
        db.close()

# Map the old CSV references to PostgreSQL table models (for dynamic lookups if needed)
MODEL_MAP = {
    'users': User,
    'locations': Location,
    'tickets': Ticket,
    'logs': TicketLog,
    'notifications': Notification,
    'departments': Department,
    'issue_categories': IssueCategory,
    'activity_categories': ActivityCategory
}

# ==========================================
# CENTRALIZED ACTION & LOGGING
# ==========================================
def log_ticket_action(ticket_id, user_identifier, action, details="", remarks="", attachment="", severity=None):
    """Logs an action to the ticket_logs table."""
    db = Session()
    try:
        if ticket_id and not severity:
            ticket = db.query(Ticket).filter(Ticket.ticket_id == str(ticket_id)).first()
            if ticket:
                severity = ticket.severity

        new_log = TicketLog(
            timestamp=get_ist_now_str("%d-%m-%Y %H:%M"),
            ticket_id=ticket_id,
            user=user_identifier,
            action=action,
            details=details,
            remarks=remarks,
            attachment=attachment,
            severity=severity
        )
        db.add(new_log)
        db.commit()
    except Exception as e:
        print(f"Error logging ticket action: {e}")
        db.rollback()

def log_system_action(actor_email, action, target="", details=""):
    """Logs system management actions into SystemLog, resolving actor identity to rich format: Name [Role] (email)."""
    db = Session()
    try:
        actor_display = str(actor_email or '').strip()

        # If actor identifier is generic or missing, try to resolve from active request headers
        try:
            from flask import has_request_context, request
            if has_request_context():
                if not actor_display or actor_display.lower() in ['admin', 'unknown admin', 'none', 'superadmin']:
                    req_actor = request.headers.get('X-User-Email') or request.headers.get('X-User-EmpId') or request.args.get('admin_email')
                    if req_actor and str(req_actor).strip():
                        actor_display = str(req_actor).strip()
        except Exception:
            pass

        # If actor identifier is an email or emp_id, resolve to rich user identity
        if actor_display and actor_display not in ['System', 'Cron']:
            try:
                matched_user = db.query(User).filter(
                    (User.email == actor_display) | (User.employee_id == actor_display)
                ).first()
                if matched_user:
                    role_name = matched_user.role or 'Admin'
                    user_name = (matched_user.name or '').strip()
                    user_email = (matched_user.email or '').strip()
                    if user_name and user_email:
                        actor_display = f"{user_name} [{role_name}] ({user_email})"
                    elif user_name:
                        actor_display = f"{user_name} [{role_name}]"
                    elif user_email:
                        actor_display = f"{user_email} [{role_name}]"
                    else:
                        actor_display = f"{role_name} ({actor_display})"
            except Exception:
                pass

        if not actor_display or actor_display.lower() == 'unknown admin':
            actor_display = 'Admin'

        log = SystemLog(
            timestamp=get_ist_now_str('%d-%m-%Y %H:%M'),
            actor_email=actor_display,
            action=action,
            target=target,
            details=details
        )
        db.add(log)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[log_system_action] Failed to log action: {e}")
    finally:
        db.close()

import re
try:
    from data.email_utils import send_ticket_email
except ImportError:
    from email_utils import send_ticket_email

def create_notification(emp_id, message, ticket_id=None, role_context='System', action_attachment=None, severity=None, notify_manager=True, custom_subject=None):
    db = Session()
    try:
        # Check if recipient is an Admin or Super Admin, or if role_context is Admin - suppress notification completely
        if role_context in ['Admin', 'Superadmin', 'Super Admin']:
            return

        recipient_str = str(emp_id or '').strip()
        if not recipient_str:
            return

        # Query user to check role & reporting manager
        user = None
        if '@' in recipient_str:
            user = db.query(User).filter(User.email == recipient_str).first()
        else:
            user = db.query(User).filter(User.employee_id == recipient_str).first()

        if user and str(user.role or '').strip().lower() in ['admin', 'superadmin', 'super admin']:
            # Do not send notifications or emails to Admin or Super Admin
            return

        # Extract ticket_id from message if not explicitly provided
        if not ticket_id:
            import re
            match = re.search(r'Ticket #(\d+)', message)
            if match:
                ticket_id = match.group(1)
        
        # If no severity provided, try to fetch it from the ticket
        ticket = None
        if ticket_id:
            ticket = db.query(Ticket).filter(Ticket.ticket_id == str(ticket_id)).order_by(Ticket.id.desc()).first()
            if ticket and not severity:
                severity = ticket.severity

        new_notif = Notification(
            emp_id=recipient_str,
            message=message,
            timestamp=get_ist_now_str("%d-%m-%Y %H:%M"),
            is_read=False,
            ticket_id=ticket_id,
            role_context=role_context,
            severity=severity
        )
        db.add(new_notif)
        db.commit()

        # Find actual email address for the recipient
        actual_email = None
        if '@' in recipient_str:
            actual_email = recipient_str
        elif user and user.email:
            actual_email = user.email

        # Resolve location string for custom subject
        loc_str = ""
        if ticket and getattr(ticket, 'location', None) and str(ticket.location).strip() and str(ticket.location).lower() != 'nan':
            loc_str = f" for {str(ticket.location).strip()}"

        # Proceed with email sending if actual_email is resolved
        if actual_email:
            ticket_details = None
            attachment_filepath = None
            if ticket:
                deadline_val = str(ticket.deadline or 'N/A').strip()
                if deadline_val and deadline_val.lower() not in ['n/a', 'none', 'nan', '']:
                    deadline_val = deadline_val.split(' ')[0]

                ticket_details = {
                    "Ticket ID": ticket.ticket_id,
                    "Status": ticket.status,
                    "Description": ticket.description or 'N/A',
                    "Priority/Escalation": ticket.escalation_level or 'L1',
                    "Deadline": deadline_val
                }
                if ticket.solver_comments and str(ticket.solver_comments).strip() and str(ticket.solver_comments).lower() != 'nan':
                    ticket_details["Solver Comments"] = ticket.solver_comments
                if action_attachment:
                    import os
                    from flask import current_app
                    try:
                        # Attempt to get upload folder from Flask app context
                        upload_folder = current_app.config['UPLOAD_FOLDER']
                        attachment_filepath = os.path.join(upload_folder, action_attachment)
                    except RuntimeError:
                        # Fallback if no app context
                        attachment_filepath = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads', action_attachment)

            if custom_subject:
                subject = custom_subject
            elif ticket_id:
                subject = f"Ambuja Desk Notification - Ticket #{ticket_id}{loc_str}"
            else:
                subject = "Ambuja Desk Notification"

            # Start a background thread to send email so it doesn't block the API
            import threading
            def send_email_bg(to, sub, msg, details, cc, attach):
                send_ticket_email(to, sub, msg, details, cc, attach)
            
            thread = threading.Thread(target=send_email_bg, args=(actual_email, subject, message, ticket_details, None, attachment_filepath))
            thread.start()

        # --- AUTO-NOTIFY REPORTING MANAGER OF DIRECTLY INVOLVED ACTOR ---
        if notify_manager and user and getattr(user, 'reporting_manager', None):
            mgr_id = str(user.reporting_manager).strip()
            if mgr_id and mgr_id != recipient_str:
                mgr = None
                if '@' in mgr_id:
                    mgr = db.query(User).filter(User.email == mgr_id).first()
                else:
                    mgr = db.query(User).filter(User.employee_id == mgr_id).first()

                if mgr and str(mgr.role or '').strip().lower() not in ['admin', 'superadmin', 'super admin']:
                    mgr_target = mgr.email or mgr.employee_id
                    mgr_msg = f"Manager FYI: Your subordinate {user.name or user.email} received an update on Ticket #{ticket_id or ''}:\n{message}"
                    mgr_subject = f"Manager FYI: Subordinate received an update on Ticket #{ticket_id or ''}{loc_str}"
                    # Call create_notification without recursive manager notification
                    create_notification(mgr_target, mgr_msg, ticket_id=ticket_id, role_context='Viewer', action_attachment=action_attachment, severity=severity, notify_manager=False, custom_subject=mgr_subject)

    except Exception as e:
        print(f"Error creating notification: {e}")
        db.rollback()

def get_admin_emails(db):
    # Admins and Super Admins do not receive automated ticket notifications
    return []

def send_omni_blast(emails_to_notify, message, role_context='System', ticket_id=None, custom_subject=None):
    """Sends a notification to a specific list of emails, ensuring no duplicates."""
    notified = set()
    for email in emails_to_notify:
        if email and email not in notified:
            create_notification(email, message, ticket_id=ticket_id, role_context=role_context, custom_subject=custom_subject)
            notified.add(email)

# ==========================================
# BACKGROUND WORKERS & ANALYTICS
# ==========================================
def auto_close_resolved_tickets():
    db = Session()
    try:
        now = get_ist_now()
        tickets = db.query(Ticket).filter(Ticket.status.ilike('resolved')).all()
        
        for t in tickets:
            if t.solved_timestamp:
                try:
                    solved_time = datetime.strptime(t.solved_timestamp, "%d-%m-%Y %H:%M")
                    hours_passed = (now - solved_time).total_seconds() / 3600
                    if hours_passed >= 24:
                        t.status = 'Closed'
                        t.closed_timestamp = now.strftime("%d-%m-%Y %H:%M")
                        
                        loc_str = f" for {t.location.strip()}" if t.location and str(t.location).strip() and str(t.location).lower() != 'nan' else ""
                        req_sub = f"System Auto-Closed: Ticket #{t.ticket_id} has been Closed{loc_str}"
                        solv_sub = f"System Auto-Closed: Ticket #{t.ticket_id} has been Closed{loc_str}"

                        # LOG & MASS NOTIFY
                        log_ticket_action(t.ticket_id, "SYSTEM", "Auto Closed", "No response in 24 hours")
                        send_omni_blast([t.raised_by], f"System Auto-Closed: Ticket #{t.ticket_id} has been automatically closed after 24h of inactivity.", role_context='Requestor', ticket_id=t.ticket_id, custom_subject=req_sub)
                        send_omni_blast([t.assigned_to], f"System Auto-Closed: Ticket #{t.ticket_id} (Resolved) was automatically closed.", role_context='Solver', ticket_id=t.ticket_id, custom_subject=solv_sub)
                except ValueError:
                    pass
        db.commit()
    finally:
        db.close()

def auto_check_sla_breaches():
    db = Session()
    try:
        now = get_ist_now()
        admin_emails = get_admin_emails(db)
        
        tickets = db.query(Ticket).filter(Ticket.status.notin_(['Closed', 'Closed '])).all()
        
        for t in tickets:
            status = str(t.status or '').strip().lower()
            closure_type = str(getattr(t, 'closure_type', '') or '').strip().lower()

            # Tickets marked on hold, declined, closed, resolved, escalation resolved, or dormant escalated parents
            # must NEVER receive periodic notices or trigger SLA breaches
            if status in ['closed', 'declined', 'on hold', 'on-hold', 'resolved', 'escalation resolved', 'escalated']:
                continue
            if closure_type in ['declined', 'on hold', 'closed', 'accepted']:
                continue
                
            # Helper to resolve solver by employee_id or email
            assigned_raw = str(t.assigned_to or '').strip()
            solver = None
            if assigned_raw and assigned_raw.lower() not in ['nan', 'none', '', 'unassigned']:
                if '@' in assigned_raw:
                    solver = db.query(User).filter(User.email.ilike(assigned_raw)).first()
                else:
                    solver = db.query(User).filter(User.employee_id == assigned_raw).first()

            # --- PERIODIC NOTICES ---
            # Rule: Only send periodic notice if NO status has been updated by solver (any level)
            # for more than 1/3rd the time limit given.
            if status == 'open' and t.deadline and t.timestamp:
                try:
                    create_time = datetime.strptime(str(t.timestamp).strip(), "%d-%m-%Y %H:%M")
                    deadline_time = datetime.strptime(str(t.deadline).strip(), "%d-%m-%Y %H:%M")
                    total_duration_hours = (deadline_time - create_time).total_seconds() / 3600.0
                    
                    if total_duration_hours > 0:
                        elapsed_hours = (now - create_time).total_seconds() / 3600.0
                        fraction = elapsed_hours / total_duration_hours
                        
                        # Verify that no solver action/status update has occurred on this ticket
                        has_status_update = db.query(TicketLog).filter(
                            TicketLog.ticket_id == str(t.ticket_id),
                            TicketLog.action.in_([
                                'Status Update', 'Declined', 'On Hold', 'Resolved',
                                'Escalated Ticket', 'Escalation Put On Hold', 'Escalation Declined',
                                'Escalation Resolved', 'Resolution Accepted', 'Resolution Rejected',
                                'Deadline Extended', 'Handover Requested'
                            ])
                        ).first() is not None
                        
                        if not has_status_update:
                            loc_str = f" for {t.location.strip()}" if t.location and str(t.location).strip() and str(t.location).lower() != 'nan' else ""
                            to_notify = []
                            if solver:
                                if solver.email: to_notify.append(solver.email)
                                if getattr(solver, 'reporting_manager', None):
                                    rm_id = str(solver.reporting_manager).strip()
                                    if '@' not in rm_id:
                                        match = db.query(User).filter_by(employee_id=rm_id).first()
                                        if match and match.email:
                                            to_notify.append(match.email)
                                    else:
                                        to_notify.append(rm_id)

                            if fraction >= (1.0 / 3.0) and not getattr(t, 'notified_1_3', False):
                                t.notified_1_3 = True
                                if to_notify:
                                    send_omni_blast(to_notify, f"Periodic Reminder (1/3 time elapsed): Ticket #{t.ticket_id} is awaiting initial solver action.", role_context='Solver', ticket_id=t.ticket_id, custom_subject=f"Reminder: Ticket #{t.ticket_id} is awaiting solver action{loc_str}")
                                log_ticket_action(t.ticket_id, "SYSTEM", "Periodic Notice 1/3", "1/3 time elapsed with no solver status update - reminder sent to solver and RM")
                                
                            if fraction >= (2.0 / 3.0) and not getattr(t, 'notified_2_3', False):
                                t.notified_2_3 = True
                                if to_notify:
                                    send_omni_blast(to_notify, f"Periodic Reminder (2/3 time elapsed): Ticket #{t.ticket_id} is still awaiting initial solver action.", role_context='Solver', ticket_id=t.ticket_id, custom_subject=f"Reminder: Ticket #{t.ticket_id} is awaiting solver action{loc_str}")
                                log_ticket_action(t.ticket_id, "SYSTEM", "Periodic Notice 2/3", "2/3 time elapsed with no solver status update - reminder sent to solver and RM")
                except ValueError:
                    pass

            # --- SLA BREACH CHECK ---
            # Only active 'open' or 'in progress' tickets can breach SLA
            if t.deadline and not t.sla_notified and status in ['open', 'in progress']:
                try:
                    deadline_time = datetime.strptime(str(t.deadline).strip(), "%d-%m-%Y %H:%M")
                    if now > deadline_time:
                        t.sla_notified = True
                        t.SLA_Breach = True
                        loc_str = f" for {t.location.strip()}" if t.location and str(t.location).strip() and str(t.location).lower() != 'nan' else ""
                        log_ticket_action(t.ticket_id, "SYSTEM", "SLA Breach", "Deadline exceeded", "System automatically flagged SLA breach")
                        
                        to_notify = [str(t.raised_by)]
                        if solver:
                            if solver.email:
                                to_notify.append(solver.email)
                            if getattr(solver, 'reporting_manager', None):
                                to_notify.append(solver.reporting_manager)
                        
                        to_notify.extend(admin_emails)
                        if t.notify_users:
                            cc_emails = [u.strip() for u in t.notify_users.split(',') if u.strip()]
                            to_notify.extend(cc_emails)
                            
                        final_emails = []
                        for u in to_notify:
                            if '@' not in str(u):
                                match = db.query(User).filter_by(employee_id=str(u)).first()
                                if match and match.email:
                                    final_emails.append(match.email)
                            else:
                                final_emails.append(u)
                                
                        send_omni_blast(final_emails, f"URGENT SLA Breach: Ticket #{t.ticket_id} has exceeded its resolution deadline!", role_context='System', ticket_id=t.ticket_id, custom_subject=f"URGENT SLA Breach: Ticket #{t.ticket_id} exceeded resolution deadline{loc_str}")
                except ValueError:
                    pass
        db.commit()
    finally:
        db.close()

def sync_computed_ticket_metrics():
    """Forces an immediate calculation and update of all ticket ages and SLAs in the DB."""
    db = Session()
    try:
        now = get_ist_now()

        def parse_dt(val):
            if not val or str(val).strip().lower() in ['nan', 'none', '', 'null']:
                return None
            val_str = str(val).strip()
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

        def to_hm(td):
            if td is None: return None
            ts = td.total_seconds()
            return round(int(ts // 3600) + (int((ts % 3600) // 60) / 100.0), 2)
            
        tickets = db.query(Ticket).all()
        if not tickets:
            return
            
        # Group logic (assuming ordered by ID asc for timestamp logic)
        first_timestamps = {}
        for t in tickets:
            dt = parse_dt(t.timestamp)
            if dt and (t.ticket_id not in first_timestamps or dt < first_timestamps[t.ticket_id]):
                first_timestamps[t.ticket_id] = dt
                    
        # Apply to all tickets
        for t in tickets:
            true_ticket_start = first_timestamps.get(t.ticket_id) or parse_dt(t.timestamp)
            
            closed_time = parse_dt(t.closed_timestamp)
            solved_time = parse_dt(t.solved_timestamp)
            deadline_time = parse_dt(t.deadline)
            
            status = str(t.status).strip().lower()
            closure_type = str(getattr(t, 'closure_type', '') or '').strip().lower()
            is_globally_finished = status in ['closed', 'declined', 'on hold', 'on-hold'] or closure_type in ['declined', 'on hold']
            
            if closed_time and is_globally_finished:
                age_hours = round((closed_time - true_ticket_start).total_seconds() / 3600.0, 2) if true_ticket_start else None
            else:
                age_hours = round((now - true_ticket_start).total_seconds() / 3600.0, 2) if true_ticket_start else None
                
            if age_hours is not None:
                age_hours = max(0.0, age_hours)

            res_hours = round((solved_time - true_ticket_start).total_seconds() / 3600.0, 2) if (solved_time and true_ticket_start and is_globally_finished) else None
            if res_hours is not None:
                res_hours = max(0.0, res_hours)

            turn_hours = round((closed_time - true_ticket_start).total_seconds() / 3600.0, 2) if (closed_time and true_ticket_start and is_globally_finished) else None
            if turn_hours is not None:
                turn_hours = max(0.0, turn_hours)
            
            SLA_Breach = False
            solver_delay = 0.0
            if deadline_time:
                completion_t = closed_time
                if is_globally_finished:
                    if not completion_t and t.timestamp:
                        completion_t = parse_dt(t.timestamp)
                    if completion_t and completion_t > deadline_time:
                        SLA_Breach = True
                        solver_delay = round((completion_t - deadline_time).total_seconds() / 3600.0, 2)
                    elif status in ['on hold', 'on-hold', 'declined'] or closure_type in ['on hold', 'declined']:
                        # On hold or declined within deadline should never be an SLA breach
                        SLA_Breach = False
                        solver_delay = 0.0
                    elif getattr(t, 'SLA_Breach', False) in [True, 'True']:
                        SLA_Breach = True
                        solver_delay = float(getattr(t, 'solver_delay_hours', 0.0) or 0.0)
                else:
                    if now > deadline_time:
                        SLA_Breach = True
                        solver_delay = round((now - deadline_time).total_seconds() / 3600.0, 2)
            
            closure_delay = 0.0
            if closed_time and solved_time and closed_time >= solved_time:
                closure_delay = round((closed_time - solved_time).total_seconds() / 3600.0, 2)

            t.ticket_age_hours = age_hours
            t.solver_resolution_hours = res_hours
            t.solver_delay_hours = solver_delay
            t.closure_delay_hours = closure_delay
            t.total_turnaround_hours = turn_hours
            t.SLA_Breach = SLA_Breach
            
        db.commit()
    finally:
        db.close()

def generate_full_ageing_report():
    """Generates the Ageing Report using the perfectly synced Postgres data."""
    sync_computed_ticket_metrics()
    db = Session()
    try:
        # Get the latest state of each ticket
        tickets = db.query(Ticket).all()
        if not tickets: return []
        
        # Keep only the latest record for each ticket_id and escalation_level
        latest_tickets = {}
        for t in tickets:
            key = (t.ticket_id, t.escalation_level)
            if t.timestamp:
                try:
                    dt = datetime.strptime(t.timestamp, "%d-%m-%Y %H:%M")
                    if key not in latest_tickets or dt > latest_tickets[key]['dt']:
                        latest_tickets[key] = {'dt': dt, 'ticket': t}
                except ValueError:
                    if key not in latest_tickets:
                        latest_tickets[key] = {'dt': datetime.min, 'ticket': t}
        
        report_rows = []
        for v in latest_tickets.values():
            t = v['ticket']
            report_rows.append({
                'ticket_id': t.ticket_id,
                'dept_assigned': t.dept_assigned,
                'attachment': t.attachment,
                'escalation_level': t.escalation_level or 'L1',
                'severity': getattr(t, 'severity', None),
                'status': t.status,
                'assigned_by': t.raised_by,
                'assigned_to': t.assigned_to,
                'description': t.description,
                'issue_category': t.issue_category,
                'activity_category': t.activity_category,
                'location': t.location,
                'deadline': t.deadline,
                'absolute_deadline': getattr(t, 'absolute_deadline', t.deadline),
                'ticket_age_hours': t.ticket_age_hours,
                'solver_resolution_hours': t.solver_resolution_hours,
                'solver_delay_hours': getattr(t, 'solver_delay_hours', 0),
                'closure_delay_hours': getattr(t, 'closure_delay_hours', 0),
                'total_turnaround_hours': t.total_turnaround_hours,
                'solved_timestamp': getattr(t, 'solved_timestamp', None),
                'closed_timestamp': getattr(t, 'closed_timestamp', None),
                'SLA_Breach': bool(t.SLA_Breach),
                'timestamp': t.timestamp,
                'original_raiser_name': t.original_raiser,
                'closure_remarks': t.solver_comments
            })
            
        return report_rows
    finally:
        db.close()
