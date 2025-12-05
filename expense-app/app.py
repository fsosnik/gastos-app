from flask import Flask, render_template, request, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import os
from functools import wraps
from werkzeug.utils import secure_filename
from flask_cors import CORS
from flask_mail import Mail, Message
from itsdangerous import URLSafeTimedSerializer, SignatureExpired

app = Flask(__name__)
# Use absolute path for database to avoid issues on hosting
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'database.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.secret_key = 'supersecretkey' # Change this in production

# Mail Config
app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', 587))
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USER')
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD')
app.config['MAIL_USE_TLS'] = os.environ.get('MAIL_USE_TLS', 'true').lower() in ['true', 'on', '1']
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_DEFAULT_SENDER', app.config['MAIL_USERNAME'])

mail = Mail(app)
s = URLSafeTimedSerializer(app.secret_key)

CORS(app, supports_credentials=True)
app.config['UPLOAD_FOLDER'] = os.path.join(basedir, 'static/uploads/avatars')
app.config['ALLOWED_EXTENSIONS'] = {'png', 'jpg', 'jpeg', 'gif'}
db = SQLAlchemy(app)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

# --- Decorators ---
@app.errorhandler(Exception)
def handle_exception(e):
    # Pass through HTTP errors
    if hasattr(e, "code"):
        return e
    return jsonify({'error': str(e)}), 500

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated_function

# --- Models ---

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255))
    name = db.Column(db.String(100), nullable=False)
    avatar_path = db.Column(db.String(255))
    is_admin = db.Column(db.Boolean, default=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Group(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    currency = db.Column(db.String(10), default='USD')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True) # Nullable for migration compatibility
    participants = db.relationship('Participant', backref='group', lazy=True)
    expenses = db.relationship('Expense', backref='group', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'currency': self.currency,
            'created_at': self.created_at.isoformat(),
            'created_by': self.created_by
        }

class Participant(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('group.id'), nullable=False)
    name = db.Column(db.String(50), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'group_id': self.group_id,
            'name': self.name
        }

class Expense(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('group.id'), nullable=False)
    title = db.Column(db.String(100), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    payer_id = db.Column(db.Integer, db.ForeignKey('participant.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    splits = db.relationship('ExpenseSplit', backref='expense', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'group_id': self.group_id,
            'title': self.title,
            'amount': self.amount,
            'payer_id': self.payer_id,
            'created_at': self.created_at.isoformat(),
            'splits': [split.to_dict() for split in self.splits]
        }

class ExpenseSplit(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    expense_id = db.Column(db.Integer, db.ForeignKey('expense.id'), nullable=False)
    participant_id = db.Column(db.Integer, db.ForeignKey('participant.id'), nullable=False)
    amount_owed = db.Column(db.Float, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'expense_id': self.expense_id,
            'participant_id': self.participant_id,
            'amount_owed': self.amount_owed
        }

# --- Routes ---

# --- Auth Routes ---

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already registered'}), 400
    
    user = User(email=data['email'], name=data['name'])
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()
    
    return jsonify({'message': 'User registered successfully'}), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(email=data['email']).first()
    
    if user and user.check_password(data['password']):
        session['user_id'] = user.id
        session['user_name'] = user.name
        return jsonify({
            'message': 'Logged in successfully', 
            'user': {
                'id': user.id, 
                'name': user.name,
                'avatar_path': user.avatar_path,
                'is_admin': user.is_admin
            }
        }), 200
    
    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/api/auth/forgot-password', methods=['POST'])
def forgot_password():
    data = request.json
    email = data.get('email')
    user = User.query.filter_by(email=email).first()
    
    if not user:
        # Don't reveal if user exists or not for security, but for UX maybe we say "If email exists..."
        return jsonify({'message': 'Si el email existe, recibirás un enlace.'}), 200
        
    token = s.dumps(email, salt='email-confirm')
    
    # In production, use the actual domain. For local, user might be on localhost.
    # We can try to guess or use an ENV var for FRONTEND_URL.
    # For this task, we will construct a link assuming the frontend handles /?reset_token=...
    # On Render, it will be the render URL.
    
    # Get base URL from request or ENV
    base_url = os.environ.get('BASE_URL', request.host_url).rstrip('/')
    link = f"{base_url}/?reset_token={token}"
    
    msg = Message('Recuperar Contraseña - Gastos Compartidos', recipients=[email])
    msg.body = f'Hola {user.name},\n\nHaz clic en el siguiente enlace para restablecer tu contraseña:\n{link}\n\nEl enlace expira en 1 hora.'
    
    try:
        mail.send(msg)
    except Exception as e:
        print(f"Error sending email: {e}")
        # Return success anyway to avoid leaking info or blocking user if SMTP fails (internal logs will show)
        # Or return error if strictly needed for debugging. For now, print to console.
        return jsonify({'message': 'Error al enviar correo (Revisa logs servidor)'}), 500

    return jsonify({'message': 'Si el email existe, recibirás un enlace.'}), 200

@app.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    data = request.json
    token = data.get('token')
    new_password = data.get('new_password')
    
    try:
        email = s.loads(token, salt='email-confirm', max_age=3600)
    except SignatureExpired:
        return jsonify({'error': 'El enlace ha expirado.'}), 400
    except Exception:
        return jsonify({'error': 'Token inválido.'}), 400
        
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'error': 'Usuario no encontrado.'}), 404
        
    user.set_password(new_password)
    db.session.commit()
    
    return jsonify({'message': 'Contraseña actualizada exitosamente.'}), 200

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out successfully'}), 200

@app.route('/api/auth/me', methods=['GET'])
def get_current_user():
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
        if user:
            return jsonify({
                'id': user.id, 
                'name': user.name,
                'avatar_path': user.avatar_path,
                'is_admin': user.is_admin
            }), 200
    return jsonify({'error': 'Not logged in'}), 401

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Unauthorized'}), 401
        user = User.query.get(session['user_id'])
        if not user or not user.is_admin:
            return jsonify({'error': 'Forbidden: Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated_function

# --- Admin Routes ---

@app.route('/api/admin/users', methods=['GET'])
@admin_required
def admin_get_users():
    users = User.query.all()
    user_list = []
    for u in users:
        user_list.append({
            'id': u.id,
            'email': u.email,
            'name': u.name,
            'is_admin': u.is_admin
        })
    return jsonify(user_list), 200

@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@admin_required
def admin_delete_user(user_id):
    if user_id == session['user_id']:
        return jsonify({'error': 'Cannot delete yourself'}), 400
    
    user = User.query.get_or_404(user_id)
    
    # Optional: Delete associated groups/expenses (Cascade logic here if needed)
    # For now, we will just delete the user. SQLite might leave orphans if no cascade set in models.
    # Group.created_by is ForeignKey. 
    
    db.session.delete(user)
    db.session.commit()
    return jsonify({'message': 'User deleted successfully'}), 200

@app.route('/api/admin/groups', methods=['GET'])
@admin_required
def admin_get_groups():
    groups = Group.query.order_by(Group.created_at.desc()).all()
    group_list = []
    for g in groups:
        creator = User.query.get(g.created_by)
        creator_name = creator.name if creator else "Unknown"
        group_list.append({
            'id': g.id,
            'name': g.name,
            'created_at': g.created_at.isoformat(),
            'created_by_name': creator_name,
            'participant_count': len(g.participants)
        })
    return jsonify(group_list), 200

@app.route('/api/admin/groups/<int:group_id>', methods=['DELETE'])
@admin_required
def admin_delete_group(group_id):
    group = Group.query.get_or_404(group_id)
    
    # Delete associated expenses/participants manually if cascade not set
    ExpenseSplit.query.filter(ExpenseSplit.expense_id.in_([e.id for e in group.expenses])).delete(synchronize_session=False)
    Expense.query.filter_by(group_id=group.id).delete()
    Participant.query.filter_by(group_id=group.id).delete()
    
    db.session.delete(group)
    db.session.commit()
    return jsonify({'message': 'Group deleted successfully'}), 200

# --- User Profile Routes ---

@app.route('/api/user/profile', methods=['PUT'])
@login_required
def update_profile():
    user = User.query.get(session['user_id'])
    data = request.json
    
    if 'name' in data:
        user.name = data['name']
        session['user_name'] = user.name # Update session as well
        
    if 'current_password' in data and 'new_password' in data:
        if not user.check_password(data['current_password']):
            return jsonify({'error': 'Contraseña actual incorrecta'}), 400
        user.set_password(data['new_password'])
        
    db.session.commit()
    return jsonify({'message': 'Perfil actualizado', 'name': user.name}), 200

@app.route('/api/user/avatar', methods=['POST'])
@login_required
def upload_avatar():
    if 'avatar' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['avatar']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file and allowed_file(file.filename):
        filename = secure_filename(f"user_{session['user_id']}_{int(datetime.now().timestamp())}.{file.filename.rsplit('.', 1)[1].lower()}")
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
        
        user = User.query.get(session['user_id'])
        # Remove old avatar if exists and not default
        # (Optional: implement cleanup logic here)
        
        user.avatar_path = f"/static/uploads/avatars/{filename}"
        db.session.commit()
        
        return jsonify({'message': 'Avatar actualizado', 'avatar_path': user.avatar_path}), 200
        
    return jsonify({'error': 'File type not allowed'}), 400

# --- API Routes ---

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/groups', methods=['GET', 'POST'])
@login_required
def handle_groups():
    if request.method == 'POST':
        data = request.json
        new_group = Group(
            name=data['name'], 
            currency=data.get('currency', 'USD'),
            created_by=session['user_id']
        )
        db.session.add(new_group)
        db.session.commit()
        
        # Add participants
        for name in data.get('participants', []):
            participant = Participant(group_id=new_group.id, name=name)
            db.session.add(participant)
        db.session.commit()
        
        return jsonify(new_group.to_dict()), 201
    else:
        # Only show groups created by the user (or we could show all, but let's restrict for now as requested)
        groups = Group.query.filter_by(created_by=session['user_id']).order_by(Group.created_at.desc()).all()
        return jsonify([g.to_dict() for g in groups])

@app.route('/api/groups/<int:group_id>', methods=['GET'])
@login_required
def get_group(group_id):
    group = Group.query.get_or_404(group_id)
    # Optional: Check if user has access to this group
    participants = Participant.query.filter_by(group_id=group_id).all()
    return jsonify({
        'group': group.to_dict(),
        'participants': [p.to_dict() for p in participants]
    })

@app.route('/api/groups/<int:group_id>/expenses', methods=['GET', 'POST'])
@login_required
def handle_expenses(group_id):
    if request.method == 'POST':
        data = request.json
        # Create Expense
        new_expense = Expense(
            group_id=group_id,
            title=data['title'],
            amount=data['amount'],
            payer_id=data['payer_id']
        )
        db.session.add(new_expense)
        db.session.commit()
        
        # Create Splits
        # Assuming equal split for now based on 'involved_ids'
        involved_ids = data.get('involved_ids', [])
        if not involved_ids:
            return jsonify({'error': 'No participants involved'}), 400
            
        split_amount = data['amount'] / len(involved_ids)
        for pid in involved_ids:
            split = ExpenseSplit(
                expense_id=new_expense.id,
                participant_id=pid,
                amount_owed=split_amount
            )
            db.session.add(split)
        db.session.commit()
        
        return jsonify(new_expense.to_dict()), 201
        
    else:
        expenses = Expense.query.filter_by(group_id=group_id).order_by(Expense.created_at.desc()).all()
        return jsonify([e.to_dict() for e in expenses])

@app.route('/api/groups/<int:group_id>/balance', methods=['GET'])
@login_required
def get_balance(group_id):
    # 1. Calculate Net Balances
    participants = Participant.query.filter_by(group_id=group_id).all()
    balances = {p.id: 0.0 for p in participants}
    
    expenses = Expense.query.filter_by(group_id=group_id).all()
    
    for expense in expenses:
        # Payer gets positive balance (they paid, so they are owed)
        balances[expense.payer_id] += expense.amount
        
        # People involved get negative balance (they consumed, so they owe)
        for split in expense.splits:
            balances[split.participant_id] -= split.amount_owed
            
    # 2. Simplify Debts (Basic Algorithm)
    # Separate into debtors (negative balance) and creditors (positive balance)
    debtors = []
    creditors = []
    
    for pid, balance in balances.items():
        balance = round(balance, 2)
        if balance < -0.01:
            debtors.append({'id': pid, 'amount': balance})
        elif balance > 0.01:
            creditors.append({'id': pid, 'amount': balance})
            
    # Sort by amount magnitude to optimize (greedy approach)
    debtors.sort(key=lambda x: x['amount']) # Ascending (most negative first)
    creditors.sort(key=lambda x: x['amount'], reverse=True) # Descending (most positive first)
    
    settlements = []
    
    i = 0 # debtor index
    j = 0 # creditor index
    
    while i < len(debtors) and j < len(creditors):
        debtor = debtors[i]
        creditor = creditors[j]
        
        amount = min(abs(debtor['amount']), creditor['amount'])
        
        settlements.append({
            'from': debtor['id'],
            'to': creditor['id'],
            'amount': round(amount, 2)
        })
        
        debtor['amount'] += amount
        creditor['amount'] -= amount
        
        if abs(debtor['amount']) < 0.01:
            i += 1
        if creditor['amount'] < 0.01:
            j += 1
            
    return jsonify({
        'balances': balances,
        'settlements': settlements
    })

# Initialize DB
with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(debug=True, port=5001)
