from flask import Blueprint, request, jsonify, send_file
import hashlib
import io
import pandas as pd
import database
from models import User, Location, Department, IssueCategory, ActivityCategory, Project, Ticket, AIRoutingFeedback, Notification, TicketLog, SystemLog, CannedResponse

admin_bp = Blueprint('admin', __name__)
DEFAULT_PASSWORD = "Kolkata@123"

def hash_password(password):
    return hashlib.sha256(str.encode(password)).hexdigest()

def get_actor_from_request(data=None):
    """Extracts actor identifier from payload data or request headers."""
    # 1. Check explicit actor keys in payload data (never target subject keys like 'email' or 'employee_id')
    if data and isinstance(data, dict):
        for key in ['admin_email', 'actor_email', 'user_email', 'actor', 'admin_emp_id', 'actor_emp_id']:
            val = data.get(key)
            if val and str(val).strip() and str(val).strip().lower() not in ['admin', 'unknown admin']:
                return str(val).strip()
    
    # 2. Check request headers populated by frontend Axios interceptor
    header_email = request.headers.get('X-User-Email')
    if header_email and str(header_email).strip():
        return str(header_email).strip()

    header_emp_id = request.headers.get('X-User-EmpId')
    if header_emp_id and str(header_emp_id).strip():
        return str(header_emp_id).strip()

    # 3. Check query parameters
    query_admin = request.args.get('admin_email') or request.args.get('user_email')
    if query_admin and str(query_admin).strip():
        return str(query_admin).strip()

    return 'Admin'

# --- USER MANAGEMENT ---
@admin_bp.route('/api/admin/system_logs', methods=['GET'])
def get_system_logs():
    db = database.Session()
    try:
        from models import SystemLog
        logs = db.query(SystemLog).order_by(SystemLog.id.desc()).all()
        return jsonify([l.to_dict() for l in logs]), 200
    finally:
        db.close()

@admin_bp.route('/api/admin/users', methods=['GET'])
def get_users():
    db = database.Session()
    try:
        users = db.query(User).all()
        result = []
        for u in users:
            d = u.to_dict()
            if 'password' in d:
                del d['password']
            result.append(d)
        return jsonify(result), 200
    finally:
        db.close()

@admin_bp.route('/api/admin/users/create', methods=['POST'])
def create_user():
    data = request.json
    db = database.Session()
    try:
        if db.query(User).filter(User.email == data['email']).first():
            return jsonify({"error": "Email already exists"}), 400
        if db.query(User).filter(User.employee_id == data['employee_id']).first():
            return jsonify({"error": "Employee ID already exists"}), 400
            
        new_user = User(
            employee_id=data['employee_id'],
            email=data['email'],
            password=hash_password(DEFAULT_PASSWORD),
            name=data['name'],
            department=data['department'],
            phone_number=data.get('phone_number', data.get('phone', '')),
            role=data['role'],
            designation=data.get('designation', ''),
            reporting_manager=data.get('reporting_manager', ''),
            first_login=True,
            active=True,
            secondary_roles=data.get('secondary_roles', ''),
            viewer_locations=data.get('viewer_locations', '')
        )
        db.add(new_user)
        
        admin_email = get_actor_from_request(data)
        database.log_system_action(admin_email, 'Create User', data['email'], f"Created user {data['name']} as {data['role']}")
        
        db.commit()
        return jsonify({"message": "User created successfully"}), 201
    finally:
        db.close()

@admin_bp.route('/api/admin/users/update', methods=['POST'])
def update_user():
    data = request.json
    old_email = data.get('old_email') or data.get('email')
    old_emp_id = data.get('old_employee_id') or data.get('employee_id')
    email = data.get('email')
    emp_id = data.get('employee_id')
    
    db = database.Session()
    try:
        user = None
        # 1. Search by employee_id first (primary key)
        if old_emp_id:
            user = db.query(User).filter(User.employee_id == str(old_emp_id).strip()).first()
        if not user and emp_id:
            user = db.query(User).filter(User.employee_id == str(emp_id).strip()).first()
        # 2. Fallback search by email
        if not user and old_email:
            user = db.query(User).filter(User.email == str(old_email).strip()).first()
        if not user and email:
            user = db.query(User).filter(User.email == str(email).strip()).first()
            
        if not user:
            return jsonify({"error": "User not found"}), 404
            
        admin_email = get_actor_from_request(data)
        admin_user = db.query(User).filter((User.email == admin_email) | (User.employee_id == admin_email)).first()
        admin_is_super = admin_user and admin_user.role in ['Superadmin', 'Super Admin']
        target_is_super = user.role in ['Superadmin', 'Super Admin']

        if target_is_super and not admin_is_super:
            return jsonify({"error": "Admins are not authorized to edit Super Admin users."}), 403

        new_role = data.get('role')
        new_active = data.get('active')
        
        is_demoting_solver = new_role and user.role in ['Solver'] and new_role not in ['Solver']
        is_deactivating = new_active is False or (isinstance(new_active, str) and new_active.lower() == 'false')
        
        if is_demoting_solver or is_deactivating:
            u_emp_id = str(user.employee_id or '').strip()
            u_email = str(user.email or '').strip()
            emp_clean = u_emp_id[:-2] if u_emp_id.endswith('.0') else u_emp_id

            all_tickets = db.query(Ticket).all()
            latest_tickets = {}
            for t in all_tickets:
                tid = str(t.ticket_id)
                if tid not in latest_tickets or (t.id and t.id > latest_tickets[tid].id):
                    latest_tickets[tid] = t

            active_tickets = []
            for tid, t in latest_tickets.items():
                status_clean = str(t.status or '').strip().lower()
                if status_clean not in ['resolved', 'closed', 'decline', 'declined']:
                    solver_val = str(t.assigned_to or '').strip()
                    if solver_val.endswith('.0'): solver_val = solver_val[:-2]
                    if solver_val and (solver_val == emp_clean or solver_val == u_email or solver_val == u_emp_id):
                        active_tickets.append(t)

            if active_tickets:
                ticket_labels = [f"#{t.ticket_id}" for t in active_tickets[:10]]
                more_suffix = f" (+{len(active_tickets) - 10} more)" if len(active_tickets) > 10 else ""
                action_word = "deactivate" if is_deactivating else "change role of"
                err_msg = f"Cannot {action_word} {user.name or user.email}. User has {len(active_tickets)} active ticket(s) assigned as solver: {', '.join(ticket_labels)}{more_suffix}. Please force reassign these tickets to an active solver first."
                return jsonify({"error": err_msg}), 400

        original_emp_id = user.employee_id
        original_email = user.email
        
        if email:
            user.email = email
        if emp_id:
            user.employee_id = emp_id
        if 'role' in data and data['role']:
            user.role = data['role']
        if 'department' in data and data['department']:
            user.department = data['department']
        if new_active is not None:
            user.active = bool(new_active)
            
        phone = data.get('phone') if data.get('phone') is not None else data.get('phone_number', '')
        user.phone_number = str(phone)
            
        if 'designation' in data:
            user.designation = data.get('designation', '')
        if 'reporting_manager' in data:
            user.reporting_manager = data.get('reporting_manager', '')
        if 'name' in data and data['name']:
            user.name = data['name']
        if 'secondary_roles' in data:
            user.secondary_roles = str(data.get('secondary_roles') or '')
        if 'viewer_locations' in data:
            user.viewer_locations = str(data.get('viewer_locations') or '')

        # --- CASCADE USER UPDATES ACROSS TABLES ---
        new_emp = str(user.employee_id or '').strip()
        new_em = str(user.email or '').strip()
        old_emp = str(original_emp_id or '').strip()
        old_em = str(original_email or '').strip()

        if (old_emp and new_emp and old_emp != new_emp) or (old_em and new_em and old_em != new_em):
            # 1. Update Tickets raised_by, assigned_to, original_raiser, reassign_requested_to
            if old_emp and new_emp and old_emp != new_emp:
                db.query(Ticket).filter(Ticket.raised_by == old_emp).update({Ticket.raised_by: new_emp}, synchronize_session=False)
                db.query(Ticket).filter(Ticket.assigned_to == old_emp).update({Ticket.assigned_to: new_emp}, synchronize_session=False)
                db.query(Ticket).filter(Ticket.original_raiser == old_emp).update({Ticket.original_raiser: new_emp}, synchronize_session=False)
                db.query(Ticket).filter(Ticket.reassign_requested_to == old_emp).update({Ticket.reassign_requested_to: new_emp}, synchronize_session=False)
                db.query(TicketLog).filter(TicketLog.user == old_emp).update({TicketLog.user: new_emp}, synchronize_session=False)
                db.query(CannedResponse).filter(CannedResponse.created_by == old_emp).update({CannedResponse.created_by: new_emp}, synchronize_session=False)
                db.query(User).filter(User.reporting_manager == old_emp).update({User.reporting_manager: new_emp}, synchronize_session=False)

            # Cascade email
            if old_em != new_em:
                db.query(Ticket).filter(Ticket.assigned_to == old_em).update({Ticket.assigned_to: new_em}, synchronize_session=False)
                db.query(Ticket).filter(Ticket.original_raiser == old_em).update({Ticket.original_raiser: new_em}, synchronize_session=False)
                db.query(Ticket).filter(Ticket.reassign_requested_to == old_em).update({Ticket.reassign_requested_to: new_em}, synchronize_session=False)
                db.query(TicketLog).filter(TicketLog.user == old_em).update({TicketLog.user: new_em}, synchronize_session=False)
                db.query(CannedResponse).filter(CannedResponse.created_by == old_em).update({CannedResponse.created_by: new_em}, synchronize_session=False)
                db.query(User).filter(User.reporting_manager == old_em).update({User.reporting_manager: new_em}, synchronize_session=False)

            # Comma-separated assigned_to or notify_users check in Tickets
            all_tickets = db.query(Ticket).all()
            for t in all_tickets:
                t_changed = False
                if t.assigned_to and (old_emp in t.assigned_to or old_em in t.assigned_to):
                    parts = [p.strip() for p in str(t.assigned_to).split(',') if p.strip()]
                    new_parts = [new_emp if p == old_emp else (new_em if p == old_em else p) for p in parts]
                    t.assigned_to = ", ".join(new_parts)
                    t_changed = True
                if t.notify_users and (old_emp in t.notify_users or old_em in t.notify_users):
                    parts = [p.strip() for p in str(t.notify_users).split(',') if p.strip()]
                    new_parts = [new_emp if p == old_emp else (new_em if p == old_em else p) for p in parts]
                    t.notify_users = ", ".join(new_parts)
                    t_changed = True

        admin_email = get_actor_from_request(data)
        database.log_system_action(admin_email, 'Update User', user.email, f"Updated user details (role: {user.role}, dept: {user.department})")
        
        db.commit()
        return jsonify({"message": "User updated successfully and cascaded across tables"}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()

@admin_bp.route('/api/admin/users/reset_password', methods=['POST'])
def reset_user_password():
    data = request.json
    email = data.get('email')
    db = database.Session()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            return jsonify({"error": "User not found"}), 404
            
        admin_email = get_actor_from_request(data)
        user.password = hash_password(DEFAULT_PASSWORD)
        user.first_login = True
        database.log_system_action(admin_email, 'Reset Password', email, "Reset password to default")
        
        db.commit()
        return jsonify({"message": "Password reset to default successfully"}), 200
    finally:
        db.close()

@admin_bp.route('/api/admin/users/toggle_active', methods=['POST'])
def toggle_user_active():
    data = request.json or {}
    email = data.get('email')
    active_status = data.get('active', True)
    db = database.Session()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            return jsonify({"error": "User not found"}), 404
            
        # If deactivating, check if user has active assigned tickets
        if not active_status:
            u_emp_id = str(user.employee_id or '').strip()
            u_email = str(user.email or '').strip()
            emp_clean = u_emp_id[:-2] if u_emp_id.endswith('.0') else u_emp_id

            all_tickets = db.query(Ticket).all()
            latest_tickets = {}
            for t in all_tickets:
                tid = str(t.ticket_id)
                if tid not in latest_tickets or (t.id and t.id > latest_tickets[tid].id):
                    latest_tickets[tid] = t

            active_tickets = []
            u_identifiers = {u_emp_id.lower(), emp_clean.lower(), u_email.lower()}
            if user.name:
                u_identifiers.add(user.name.strip().lower())

            for tid, t in latest_tickets.items():
                status_clean = str(t.status or '').strip().lower()
                if status_clean not in ['resolved', 'closed', 'decline', 'declined']:
                    assigned_raw = str(t.assigned_to or '').strip()
                    if assigned_raw and assigned_raw.lower() not in ['nan', 'none', 'unassigned', '']:
                        solvers = [s.strip().lower() for s in assigned_raw.split(',') if s.strip()]
                        for s in solvers:
                            s_clean = s[:-2] if s.endswith('.0') else s
                            if s in u_identifiers or s_clean in u_identifiers:
                                active_tickets.append(t)
                                break

            if active_tickets:
                ticket_labels = [f"#{t.ticket_id}" for t in active_tickets[:10]]
                more_suffix = f" (+{len(active_tickets) - 10} more)" if len(active_tickets) > 10 else ""
                err_msg = f"Cannot deactivate {user.name or user.email}. User has {len(active_tickets)} active ticket(s) assigned as solver: {', '.join(ticket_labels)}{more_suffix}. Please force reassign these tickets to an active solver before deactivating."
                return jsonify({"error": err_msg}), 400

        user.active = bool(active_status)
        admin_email = get_actor_from_request(data)
        database.log_system_action(admin_email, 'Toggle Active', email, f"Set active status to {active_status}")
        
        db.commit()
        return jsonify({"message": f"User {'activated' if active_status else 'deactivated'} successfully"}), 200
    finally:
        db.close()

@admin_bp.route('/api/admin/users/delete', methods=['POST'])
def delete_user():
    data = request.json or {}
    emails = data.get('emails', [])
    if not emails:
        return jsonify({'error': 'No emails provided for deletion'}), 400
        
    db = database.Session()
    try:
        users = db.query(User).filter(User.email.in_(emails)).all()
        all_tickets = db.query(Ticket).all()
        latest_tickets = {}
        for t in all_tickets:
            tid = str(t.ticket_id)
            if tid not in latest_tickets or (t.id and t.id > latest_tickets[tid].id):
                latest_tickets[tid] = t

        for u in users:
            u_emp_id = str(u.employee_id or '').strip()
            u_email = str(u.email or '').strip()
            emp_clean = u_emp_id[:-2] if u_emp_id.endswith('.0') else u_emp_id

            active_tickets = []
            u_identifiers = {u_emp_id.lower(), emp_clean.lower(), u_email.lower()}
            if u.name:
                u_identifiers.add(u.name.strip().lower())

            for tid, t in latest_tickets.items():
                status_clean = str(t.status or '').strip().lower()
                if status_clean not in ['resolved', 'closed', 'decline', 'declined']:
                    assigned_raw = str(t.assigned_to or '').strip()
                    if assigned_raw and assigned_raw.lower() not in ['nan', 'none', 'unassigned', '']:
                        # Check comma-separated solvers or single solver
                        solvers = [s.strip().lower() for s in assigned_raw.split(',') if s.strip()]
                        for s in solvers:
                            s_clean = s[:-2] if s.endswith('.0') else s
                            if s in u_identifiers or s_clean in u_identifiers:
                                active_tickets.append(t)
                                break

            if active_tickets:
                ticket_labels = [f"#{t.ticket_id}" for t in active_tickets[:10]]
                more_suffix = f" (+{len(active_tickets) - 10} more)" if len(active_tickets) > 10 else ""
                err_msg = f"Cannot delete {u.name or u.email}. User has {len(active_tickets)} active ticket(s) assigned as solver: {', '.join(ticket_labels)}{more_suffix}. Please force reassign these tickets to an active solver before deleting."
                return jsonify({"error": err_msg}), 400

        deleted_count = db.query(User).filter(User.email.in_(emails)).delete(synchronize_session=False)
        admin_email = get_actor_from_request(data)
        database.log_system_action(admin_email, 'Delete Users', ", ".join(emails), f"Deleted {deleted_count} users")
        
        db.commit()
        return jsonify({'message': f'Deleted {deleted_count} user(s) successfully'}), 200
    finally:
        db.close()

# --- PROJECT MANAGEMENT ---
@admin_bp.route('/api/admin/projects', methods=['GET'])
def get_projects():
    db = database.Session()
    try:
        projects = db.query(Project).all()
        return jsonify([p.to_dict() for p in projects]), 200
    finally:
        db.close()

@admin_bp.route('/api/admin/projects/create', methods=['POST'])
def create_project():
    data = request.json
    db = database.Session()
    try:
        project_name = data.get('project_name', '').strip()
        if not project_name:
            return jsonify({"error": "Project name cannot be empty"}), 400
            
        if db.query(Project).filter(Project.project_name == project_name).first():
            return jsonify({"error": "Project already exists"}), 400
            
        new_project = Project(project_name=project_name)
        db.add(new_project)
        admin_email = get_actor_from_request(data)
        database.log_system_action(admin_email, 'Create Project', project_name, f"Created project {project_name}")
        db.commit()
        return jsonify({"message": "Project added successfully"}), 201
    finally:
        db.close()

@admin_bp.route('/api/admin/projects/update', methods=['POST'])
def update_project():
    data = request.json
    old_project_name = (data.get('old_project_name') or '').strip()
    new_project_name = (data.get('project_name') or '').strip()
    
    if not old_project_name or not new_project_name:
        return jsonify({"error": "Missing project names"}), 400
        
    db = database.Session()
    try:
        project = db.query(Project).filter(Project.project_name == old_project_name).first()
        if not project:
            return jsonify({"error": "Project not found"}), 404
            
        project.project_name = new_project_name

        # --- CASCADE PROJECT UPDATE ACROSS TABLES ---
        if old_project_name != new_project_name:
            # 1. Update Locations table (project and location string)
            locs = db.query(Location).filter(Location.project == old_project_name).all()
            for loc in locs:
                loc.project = new_project_name
                old_loc_str = str(loc.location or '')
                new_loc_str = f"{new_project_name}-{loc.tower}"
                loc.location = new_loc_str
                # Cascade location string rename to tickets
                db.query(Ticket).filter(Ticket.location == old_loc_str).update({Ticket.location: new_loc_str}, synchronize_session=False)

        admin_email = get_actor_from_request(data)
        database.log_system_action(admin_email, 'Update Project', new_project_name, f"Renamed project from {old_project_name} to {new_project_name}")
        db.commit()
        return jsonify({"message": "Project updated and cascaded across tables successfully"}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()

@admin_bp.route('/api/admin/projects/delete', methods=['POST'])
def delete_projects():
    data = request.json
    project_names = data.get('project_names', [])
    db = database.Session()
    try:
        db.query(Project).filter(Project.project_name.in_(project_names)).delete(synchronize_session=False)
        admin_email = get_actor_from_request(data)
        database.log_system_action(admin_email, 'Delete Projects', ", ".join(project_names), f"Deleted {len(project_names)} projects")
        db.commit()
        return jsonify({"message": f"{len(project_names)} projects deleted successfully"}), 200
    finally:
        db.close()


# --- LOCATION MANAGEMENT ---
@admin_bp.route('/api/admin/locations', methods=['GET'])
def get_locations():
    db = database.Session()
    try:
        locations = db.query(Location).all()
        return jsonify([l.to_dict() for l in locations]), 200
    finally:
        db.close()

@admin_bp.route('/api/admin/locations/create', methods=['POST'])
def create_location():
    data = request.json
    db = database.Session()
    try:
        loc_str = f"{data.get('project')}-{data.get('tower')}"
        if not data.get('project') or not data.get('tower'):
            return jsonify({"error": "Project and Tower required"}), 400
            
        if db.query(Location).filter(Location.location == loc_str).first():
            return jsonify({"error": "Location already exists"}), 400
            
        new_loc = Location(
            project=data.get('project'),
            tower=data.get('tower'),
            location=loc_str
        )
        db.add(new_loc)
        admin_email = get_actor_from_request(data)
        database.log_system_action(admin_email, 'Create Location', loc_str, f"Created location {loc_str}")
        db.commit()
        return jsonify({"message": "Location added successfully"}), 201
    finally:
        db.close()

@admin_bp.route('/api/admin/locations/update', methods=['POST'])
def update_location():
    data = request.json
    old_location = (data.get('old_location') or '').strip()
    new_location = (data.get('location') or '').strip()
    new_project = (data.get('project') or '').strip()
    new_tower = (data.get('tower') or '').strip()

    if not old_location or not new_location:
        return jsonify({"error": "Location identifiers required"}), 400

    db = database.Session()
    try:
        loc = db.query(Location).filter(Location.location == old_location).first()
        if not loc:
            return jsonify({"error": "Location not found"}), 404
            
        loc.project = new_project
        loc.tower = new_tower
        loc.location = new_location

        # --- CASCADE LOCATION UPDATE ACROSS TICKETS & USERS ---
        if old_location != new_location:
            db.query(Ticket).filter(Ticket.location == old_location).update({Ticket.location: new_location}, synchronize_session=False)
            
            # Update viewer_locations in users table if specifically configured
            users_with_loc = db.query(User).filter(User.viewer_locations.like(f"%{old_location}%")).all()
            for u in users_with_loc:
                if u.viewer_locations:
                    parts = [p.strip() for p in u.viewer_locations.split(',') if p.strip()]
                    new_parts = [new_location if p == old_location else p for p in parts]
                    u.viewer_locations = ", ".join(new_parts)

        admin_email = get_actor_from_request(data)
        database.log_system_action(admin_email, 'Update Location', new_location, f"Updated location from {old_location} to {new_location}")
        db.commit()
        return jsonify({"message": "Location updated and cascaded across tables successfully"}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()

@admin_bp.route('/api/admin/locations/delete', methods=['POST'])
def delete_location():
    data = request.json
    locations_to_delete = data.get('locations', [])
    if not locations_to_delete:
        return jsonify({'error': 'No locations provided for deletion'}), 400
        
    db = database.Session()
    try:
        deleted_count = db.query(Location).filter(Location.location.in_(locations_to_delete)).delete(synchronize_session=False)
        admin_email = get_actor_from_request(data)
        database.log_system_action(admin_email, 'Delete Locations', ", ".join(locations_to_delete), f"Deleted {deleted_count} locations")
        db.commit()
        return jsonify({'message': f'Deleted {deleted_count} location(s) successfully'}), 200
    finally:
        db.close()

# --- ISSUE CATEGORIES ---
@admin_bp.route('/api/admin/issue_categories', methods=['GET'])
def get_issue_categories():
    db = database.Session()
    try:
        categories = db.query(IssueCategory).all()
        return jsonify([{"issue_category": c.issue_name} for c in categories]), 200
    finally:
        db.close()

@admin_bp.route('/api/admin/issue_categories/create', methods=['POST'])
def create_issue_category():
    data = request.json
    db = database.Session()
    try:
        issue_name = data.get('issue_name', '').strip()
        if not issue_name:
            return jsonify({"error": "Issue Category name required"}), 400
            
        if db.query(IssueCategory).filter(IssueCategory.issue_name == issue_name).first():
            return jsonify({"error": "Issue Category already exists"}), 400
            
        new_ic = IssueCategory(issue_name=issue_name)
        db.add(new_ic)
        admin_email = get_actor_from_request(data)
        database.log_system_action(admin_email, 'Create Issue Category', issue_name, f"Created issue category {issue_name}")
        db.commit()
        return jsonify({"message": "Issue Category added successfully"}), 201
    finally:
        db.close()

@admin_bp.route('/api/admin/issue_categories/update', methods=['POST'])
def update_issue_category():
    data = request.json
    old_issue_name = data.get('old_issue_name', '').strip()
    new_issue_name = data.get('issue_name', '').strip()
    
    if not old_issue_name or not new_issue_name:
        return jsonify({"error": "Issue category names required"}), 400

    db = database.Session()
    try:
        ic = db.query(IssueCategory).filter(IssueCategory.issue_name == old_issue_name).first()
        if not ic:
            return jsonify({"error": "Issue Category not found"}), 404
            
        db.delete(ic)
        db.add(IssueCategory(issue_name=new_issue_name))

        # --- CASCADE ISSUE CATEGORY UPDATE ACROSS TICKETS & AI FEEDBACK ---
        if old_issue_name != new_issue_name:
            db.query(Ticket).filter(Ticket.issue_category == old_issue_name).update({Ticket.issue_category: new_issue_name}, synchronize_session=False)
            db.query(AIRoutingFeedback).filter(AIRoutingFeedback.user_selected_issue == old_issue_name).update({AIRoutingFeedback.user_selected_issue: new_issue_name}, synchronize_session=False)
            db.query(AIRoutingFeedback).filter(AIRoutingFeedback.suggested_issue == old_issue_name).update({AIRoutingFeedback.suggested_issue: new_issue_name}, synchronize_session=False)

        admin_email = get_actor_from_request(data)
        database.log_system_action(admin_email, 'Update Issue Category', new_issue_name, f"Renamed issue category from {old_issue_name} to {new_issue_name}")
        db.commit()
        return jsonify({"message": "Issue Category updated and cascaded across tables successfully"}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()

@admin_bp.route('/api/admin/issue_categories/delete', methods=['POST'])
def delete_issue_category():
    data = request.json
    categories = data.get('categories', [])
    if not categories:
        return jsonify({'error': 'No categories provided for deletion'}), 400
        
    db = database.Session()
    try:
        deleted_count = db.query(IssueCategory).filter(IssueCategory.issue_name.in_(categories)).delete(synchronize_session=False)
        admin_email = get_actor_from_request(data)
        database.log_system_action(admin_email, 'Delete Issue Categories', ", ".join(categories), f"Deleted {deleted_count} issue categories")
        db.commit()
        return jsonify({'message': f'Deleted {deleted_count} issue category successfully'}), 200
    finally:
        db.close()

# --- ACTIVITY CATEGORIES ---
@admin_bp.route('/api/admin/activity_categories', methods=['GET'])
def get_activity_categories():
    db = database.Session()
    try:
        categories = db.query(ActivityCategory).all()
        return jsonify([{"activity_category": c.activity_name} for c in categories]), 200
    finally:
        db.close()

@admin_bp.route('/api/admin/activity_categories/create', methods=['POST'])
def create_activity_category():
    data = request.json
    db = database.Session()
    try:
        activity_name = data.get('activity_name', '').strip()
        if not activity_name:
            return jsonify({"error": "Activity Category name required"}), 400
            
        if db.query(ActivityCategory).filter(ActivityCategory.activity_name == activity_name).first():
            return jsonify({"error": "Activity Category already exists"}), 400
            
        new_ac = ActivityCategory(activity_name=activity_name)
        db.add(new_ac)
        admin_email = get_actor_from_request(data)
        database.log_system_action(admin_email, 'Create Activity Category', activity_name, f"Created activity category {activity_name}")
        db.commit()
        return jsonify({"message": "Activity Category added successfully"}), 201
    finally:
        db.close()

@admin_bp.route('/api/admin/activity_categories/update', methods=['POST'])
def update_activity_category():
    data = request.json
    old_activity_name = data.get('old_activity_name', '').strip()
    new_activity_name = data.get('activity_name', '').strip()
    
    if not old_activity_name or not new_activity_name:
        return jsonify({"error": "Activity category names required"}), 400

    db = database.Session()
    try:
        ac = db.query(ActivityCategory).filter(ActivityCategory.activity_name == old_activity_name).first()
        if not ac:
            return jsonify({"error": "Activity Category not found"}), 404
            
        db.delete(ac)
        db.add(ActivityCategory(activity_name=new_activity_name))

        # --- CASCADE ACTIVITY CATEGORY UPDATE ACROSS TICKETS & AI FEEDBACK ---
        if old_activity_name != new_activity_name:
            db.query(Ticket).filter(Ticket.activity_category == old_activity_name).update({Ticket.activity_category: new_activity_name}, synchronize_session=False)
            db.query(AIRoutingFeedback).filter(AIRoutingFeedback.user_selected_act == old_activity_name).update({AIRoutingFeedback.user_selected_act: new_activity_name}, synchronize_session=False)
            db.query(AIRoutingFeedback).filter(AIRoutingFeedback.suggested_act == old_activity_name).update({AIRoutingFeedback.suggested_act: new_activity_name}, synchronize_session=False)

        admin_email = get_actor_from_request(data)
        database.log_system_action(admin_email, 'Update Activity Category', new_activity_name, f"Renamed activity category from {old_activity_name} to {new_activity_name}")
        db.commit()
        return jsonify({"message": "Activity Category updated and cascaded across tables successfully"}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()

@admin_bp.route('/api/admin/activity_categories/delete', methods=['POST'])
def delete_activity_category():
    data = request.json
    categories = data.get('categories', [])
    if not categories:
        return jsonify({'error': 'No categories provided for deletion'}), 400
        
    db = database.Session()
    try:
        deleted_count = db.query(ActivityCategory).filter(ActivityCategory.activity_name.in_(categories)).delete(synchronize_session=False)
        admin_email = get_actor_from_request(data)
        database.log_system_action(admin_email, 'Delete Activity Categories', ", ".join(categories), f"Deleted {deleted_count} activity categories")
        db.commit()
        return jsonify({'message': f'Deleted {deleted_count} activity category successfully'}), 200
    finally:
        db.close()

# --- DEPARTMENTS ---
@admin_bp.route('/api/admin/departments', methods=['GET'])
def get_departments():
    db = database.Session()
    try:
        depts = db.query(Department).all()
        return jsonify([{"department": d.department_name} for d in depts]), 200
    finally:
        db.close()

@admin_bp.route('/api/admin/departments/create', methods=['POST'])
def create_department():
    data = request.json
    db = database.Session()
    try:
        dept_str = data.get('department', '').strip()
        if not dept_str:
            return jsonify({"error": "Department name required"}), 400
            
        if db.query(Department).filter(Department.department_name == dept_str).first():
            return jsonify({"error": "Department already exists"}), 400
            
        new_dept = Department(department_name=dept_str)
        db.add(new_dept)
        admin_email = get_actor_from_request(data)
        database.log_system_action(admin_email, 'Create Department', dept_str, f"Created department {dept_str}")
        db.commit()
        return jsonify({"message": "Department added successfully"}), 201
    finally:
        db.close()

@admin_bp.route('/api/admin/departments/update', methods=['POST'])
def update_department():
    data = request.json
    old_dept = data.get('old_department', '').strip()
    new_dept = data.get('department', '').strip()
    
    if not old_dept or not new_dept:
        return jsonify({"error": "Department names required"}), 400

    db = database.Session()
    try:
        dept = db.query(Department).filter(Department.department_name == old_dept).first()
        if not dept:
            return jsonify({"error": "Department not found"}), 404
            
        db.delete(dept)
        db.add(Department(department_name=new_dept))

        # --- CASCADE DEPARTMENT UPDATE ACROSS USERS, TICKETS, AND AI FEEDBACK ---
        if old_dept != new_dept:
            db.query(User).filter(User.department == old_dept).update({User.department: new_dept}, synchronize_session=False)
            db.query(Ticket).filter(Ticket.dept_assigned == old_dept).update({Ticket.dept_assigned: new_dept}, synchronize_session=False)
            db.query(AIRoutingFeedback).filter(AIRoutingFeedback.user_selected_dept == old_dept).update({AIRoutingFeedback.user_selected_dept: new_dept}, synchronize_session=False)
            db.query(AIRoutingFeedback).filter(AIRoutingFeedback.suggested_dept == old_dept).update({AIRoutingFeedback.suggested_dept: new_dept}, synchronize_session=False)

        admin_email = get_actor_from_request(data)
        database.log_system_action(admin_email, 'Update Department', new_dept, f"Renamed department from {old_dept} to {new_dept}")
        db.commit()
        return jsonify({"message": "Department updated and cascaded across tables successfully"}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()

@admin_bp.route('/api/admin/departments/delete', methods=['POST'])
def delete_department():
    data = request.json
    departments = data.get('departments', [])
    if not departments:
        return jsonify({'error': 'No departments provided for deletion'}), 400
        
    db = database.Session()
    try:
        deleted_count = db.query(Department).filter(Department.department_name.in_(departments)).delete(synchronize_session=False)
        admin_email = get_actor_from_request(data)
        database.log_system_action(admin_email, 'Delete Departments', ", ".join(departments), f"Deleted {deleted_count} departments")
        db.commit()
        return jsonify({'message': f'Deleted {deleted_count} department(s) successfully'}), 200
    finally:
        db.close()


# --- BULK IMPORT & TEMPLATES ---
@admin_bp.route('/api/admin/template/<entity>', methods=['GET'])
def get_template(entity):
    templates = {
        'users': pd.DataFrame(columns=['Employee ID', 'Email', 'Name', 'Department', 'Phone Number', 'Role', 'Designation', 'Reporting Manager ID', 'Enable Viewer Rights (Yes/No)', 'Viewer Locations (ALL or comma-separated)']),
        'locations': pd.DataFrame(columns=['Project', 'Tower']),
        'departments': pd.DataFrame(columns=['Department']),
        'issue_categories': pd.DataFrame(columns=['Issue Category']),
        'activity_categories': pd.DataFrame(columns=['Activity Category']),
        'master_logic': pd.DataFrame(columns=['Department', 'Issue Category', 'Activity Category', 'Location', 'Assigned To'])
    }
    
    if entity not in templates:
        return jsonify({"error": "Invalid entity"}), 400
        
    df = templates[entity]
    # Add one sample row
    if entity == 'users':
        df.loc[0] = ['EMP001', 'emp@example.com', 'John Doe', 'IT Support', '9876543210', 'User', 'Executive', 'EMP-SUPER', 'Yes', 'ALL']
    elif entity == 'locations':
        df.loc[0] = ['Project Alpha', 'Tower A']
    elif entity == 'departments':
        df.loc[0] = ['IT Support']
    elif entity == 'issue_categories':
        df.loc[0] = ['Hardware Issue']
    elif entity == 'activity_categories':
        df.loc[0] = ['Laptop Repair']
    elif entity == 'master_logic':
        df.loc[0] = ['IT Support', 'Hardware Issue', 'Laptop Repair', 'Lobby', 'EMP001']

    out = io.BytesIO()
    with pd.ExcelWriter(out, engine='openpyxl') as writer:
        df.to_excel(writer, index=False)
    out.seek(0)
    
    return send_file(
        out,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=f"{entity}_template.xlsx"
    )

@admin_bp.route('/api/admin/import/<entity>', methods=['POST'])
def import_data(entity):
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
        
    if not file.filename.endswith('.xlsx'):
        return jsonify({"error": "Only .xlsx files are supported"}), 400
        
    try:
        df = pd.read_excel(file)
    except Exception as e:
        return jsonify({"error": f"Failed to parse Excel file: {str(e)}"}), 400
        
    db = database.Session()
    errors = []
    success_count = 0
    
    try:
        # Pre-fetch case-insensitive lookup dictionaries: { normalized_lowercase_trimmed: canonical_master_name }
        dept_lookup = {str(d.department_name).strip().lower(): str(d.department_name).strip() for d in db.query(Department).all() if d.department_name}
        project_lookup = {str(p.project_name).strip().lower(): str(p.project_name).strip() for p in db.query(Project).all() if p.project_name}
        issue_lookup = {str(i.issue_name).strip().lower(): str(i.issue_name).strip() for i in db.query(IssueCategory).all() if i.issue_name}
        activity_lookup = {str(a.activity_name).strip().lower(): str(a.activity_name).strip() for a in db.query(ActivityCategory).all() if a.activity_name}
        existing_emp_ids = {str(u.employee_id).strip().lower() for u in db.query(User).all() if u.employee_id}
        existing_emails = {str(u.email).strip().lower() for u in db.query(User).all() if u.email}
        existing_locations = {str(l.location).strip().lower() for l in db.query(Location).all() if l.location}
        
        # Replace NaN with None
        df = df.where(pd.notnull(df), None)

        for index, row in df.iterrows():
            row_num = index + 2 # +1 for 0-index, +1 for header
            
            if entity == 'users':
                raw_dept = str(row.get('Department') or '').strip()
                emp_id = str(row.get('Employee ID')).strip() if row.get('Employee ID') else None
                if emp_id and emp_id.endswith('.0'):
                    emp_id = emp_id[:-2]
                email = str(row.get('Email')).strip() if row.get('Email') else None
                
                if not emp_id:
                    errors.append({'row': row_num, 'column': 'Employee ID', 'error': 'Employee ID is required.'})
                    continue
                if not email:
                    errors.append({'row': row_num, 'column': 'Email', 'error': 'Email is required.'})
                    continue

                # Case-insensitive department resolution & auto-normalization
                normalized_dept = raw_dept
                if raw_dept:
                    raw_dept_key = raw_dept.lower()
                    if raw_dept_key in dept_lookup:
                        normalized_dept = dept_lookup[raw_dept_key]
                    else:
                        errors.append({'row': row_num, 'column': 'Department', 'error': f"Department '{raw_dept}' does not exist in department master."})
                        continue
                    
                if emp_id.lower() in existing_emp_ids:
                    errors.append({'row': row_num, 'column': 'Employee ID', 'error': f"User with Employee ID '{emp_id}' already exists."})
                    continue
                if email.lower() in existing_emails:
                    errors.append({'row': row_num, 'column': 'Email', 'error': f"User with Email '{email}' already exists."})
                    continue

                # Reporting Manager ID availability check
                raw_rm = str(row.get('Reporting Manager ID') or '').strip()
                if raw_rm.endswith('.0'):
                    raw_rm = raw_rm[:-2]
                
                if raw_rm and raw_rm.lower() not in ['none', 'nan', '', 'null']:
                    if raw_rm.lower() not in existing_emp_ids:
                        errors.append({
                            'row': row_num,
                            'column': 'Reporting Manager ID',
                            'error': f"Reporting Manager ID '{raw_rm}' does not exist. Please enter a valid existing Employee ID."
                        })
                        continue
                    rm_id_clean = raw_rm
                else:
                    rm_id_clean = ''
                
                # Check role and secondary viewer rights
                role_raw = str(row.get('Role')).strip() if row.get('Role') else 'User'
                role_clean = role_raw.capitalize()
                if role_raw.lower() in ['superadmin', 'super admin']:
                    role_clean = 'Superadmin'
                elif role_raw.lower() == 'admin':
                    role_clean = 'Admin'
                elif role_raw.lower() == 'solver':
                    role_clean = 'Solver'
                elif role_raw.lower() == 'viewer':
                    role_clean = 'User'
                    has_viewer_flag = True
                else:
                    role_clean = 'User'
                    has_viewer_flag = False

                if role_raw.lower() != 'viewer':
                    viewer_col_val = str(row.get('Enable Viewer Rights (Yes/No)') or row.get('Viewer Rights') or row.get('Viewer') or '').strip().lower()
                    has_viewer_flag = viewer_col_val in ['yes', 'y', 'true', '1', 'enable', 'enabled']
                
                sec_roles = 'Viewer' if has_viewer_flag else ''
                viewer_locs = ''
                if has_viewer_flag:
                    locs_raw = str(row.get('Viewer Locations (ALL or comma-separated)') or row.get('Viewer Locations') or row.get('Locations') or 'ALL').strip()
                    viewer_locs = locs_raw if locs_raw else 'ALL'

                # Clean and extract exactly 10-digit phone number
                raw_phone = str(row.get('Phone Number') or '').strip()
                if raw_phone.endswith('.0'):
                    raw_phone = raw_phone[:-2]
                phone_digits = ''.join(c for c in raw_phone if c.isdigit())
                # If 12 digits starting with 91 (e.g. +91XXXXXXXXXX), extract last 10 digits
                if len(phone_digits) == 12 and phone_digits.startswith('91'):
                    phone_digits = phone_digits[2:]
                elif len(phone_digits) == 11 and phone_digits.startswith('0'):
                    phone_digits = phone_digits[1:]
                elif len(phone_digits) > 10:
                    phone_digits = phone_digits[-10:]

                u = User(
                    employee_id=emp_id,
                    email=email,
                    password=hash_password(DEFAULT_PASSWORD),
                    name=str(row.get('Name')).strip() if row.get('Name') else '',
                    department=normalized_dept,
                    phone_number=phone_digits,
                    role=role_clean,
                    designation=str(row.get('Designation')).strip() if row.get('Designation') else '',
                    reporting_manager=rm_id_clean,
                    first_login=True,
                    active=True,
                    secondary_roles=sec_roles,
                    viewer_locations=viewer_locs
                )
                db.add(u)
                existing_emp_ids.add(emp_id.lower())
                existing_emails.add(email.lower())
                success_count += 1
                
            elif entity == 'locations':
                raw_proj = str(row.get('Project', '')).strip() if row.get('Project') else ''
                tower = str(row.get('Tower', '')).strip() if row.get('Tower') else ''
                
                if not raw_proj:
                    errors.append({'row': row_num, 'column': 'Project', 'error': 'Project is required.'})
                    continue
                if not tower:
                    errors.append({'row': row_num, 'column': 'Tower', 'error': 'Tower is required.'})
                    continue

                # Case-insensitive project lookup & normalization
                raw_proj_key = raw_proj.lower()
                if raw_proj_key not in project_lookup:
                    errors.append({'row': row_num, 'column': 'Project', 'error': f"Project '{raw_proj}' does not exist in project master."})
                    continue
                
                proj = project_lookup[raw_proj_key]
                loc = f"{proj}-{tower}"
                    
                if loc.lower() in existing_locations:
                    errors.append({'row': row_num, 'column': 'Project / Tower', 'error': f"Location '{loc}' already exists."})
                    continue
                    
                new_loc = Location(project=proj, tower=tower, location=loc)
                db.add(new_loc)
                existing_locations.add(loc.lower())
                success_count += 1
                
            elif entity == 'departments':
                dept = str(row.get('Department', '')).strip() if row.get('Department') else None
                if not dept:
                    errors.append({'row': row_num, 'column': 'Department', 'error': 'Department is required.'})
                    continue
                if dept.lower() in dept_lookup:
                    errors.append({'row': row_num, 'column': 'Department', 'error': f"Department '{dept}' already exists (matches '{dept_lookup[dept.lower()]}')."})
                    continue
                
                new_dept = Department(department_name=dept)
                db.add(new_dept)
                dept_lookup[dept.lower()] = dept
                success_count += 1
                
            elif entity == 'issue_categories':
                ic = str(row.get('Issue Category', '')).strip() if row.get('Issue Category') else None
                if not ic:
                    errors.append({'row': row_num, 'column': 'Issue Category', 'error': 'Issue Category is required.'})
                    continue
                if ic.lower() in issue_lookup:
                    errors.append({'row': row_num, 'column': 'Issue Category', 'error': f"Issue Category '{ic}' already exists (matches '{issue_lookup[ic.lower()]}')."})
                    continue
                    
                db.add(IssueCategory(issue_name=ic))
                issue_lookup[ic.lower()] = ic
                success_count += 1
                
            elif entity == 'activity_categories':
                ac = str(row.get('Activity Category', '')).strip() if row.get('Activity Category') else None
                if not ac:
                    errors.append({'row': row_num, 'column': 'Activity Category', 'error': 'Activity Category is required.'})
                    continue
                if ac.lower() in activity_lookup:
                    errors.append({'row': row_num, 'column': 'Activity Category', 'error': f"Activity Category '{ac}' already exists (matches '{activity_lookup[ac.lower()]}')."})
                    continue
                    
                db.add(ActivityCategory(activity_name=ac))
                activity_lookup[ac.lower()] = ac
                success_count += 1
                
                # Master logic import has been disabled as Master table is removed
        admin_email = get_actor_from_request(request.form.to_dict() if request.form else None)
        database.log_system_action(admin_email, f'Bulk Import ({entity})', file.filename, f"Successfully imported {success_count} records into {entity}")
        db.commit()
        return jsonify({
            "message": f"Import completed. {success_count} rows successfully inserted.",
            "success_count": success_count,
            "errors": errors
        }), 200
        
    except Exception as e:
        db.rollback()
        return jsonify({"error": f"An error occurred during import: {str(e)}"}), 500
    finally:
        db.close()
