# PLAN.md - Gastos Compartidos (Tricount Clone)

## Estructura de Archivos
```
/expense-app
  ├── app.py                 # Backend Flask (API + Serve Static)
  ├── database.db            # SQLite DB
  ├── requirements.txt       # Dependencias Python
  ├── static/
  │   ├── js/
  │   │   └── app.js         # Lógica Frontend (SPA)
  │   └── css/
  │       └── style.css      # Estilos adicionales
  └── templates/
      └── index.html         # Template principal HTML
```

## Modelo de Datos (SQLite)

### 1. Groups
Almacena la información básica del grupo.
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `name`: TEXT NOT NULL
- `currency`: TEXT DEFAULT 'USD'
- `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### 2. Participants
Personas que pertenecen a un grupo.
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `group_id`: INTEGER NOT NULL (FK -> groups.id)
- `name`: TEXT NOT NULL

### 3. Expenses
Gastos realizados.
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `group_id`: INTEGER NOT NULL (FK -> groups.id)
- `title`: TEXT NOT NULL
- `amount`: REAL NOT NULL
- `payer_id`: INTEGER NOT NULL (FK -> participants.id)
- `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### 4. ExpenseSplits
Detalle de quiénes participan en cada gasto.
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `expense_id`: INTEGER NOT NULL (FK -> expenses.id)
- `participant_id`: INTEGER NOT NULL (FK -> participants.id)
- `amount_owed`: REAL NOT NULL (Monto que le corresponde pagar a este participante)

## Algoritmo de Balance
1. Calcular el "Net Balance" de cada participante:
   - `Total Pagado` - `Total Consumido` (suma de amount_owed).
   - Si es positivo, se le debe dinero.
   - Si es negativo, debe dinero.
2. Emparejar deudores con acreedores para minimizar transacciones.

## API Endpoints
- `POST /api/groups`: Crear grupo.
- `GET /api/groups/<id>`: Obtener info del grupo y participantes.
- `POST /api/groups/<id>/expenses`: Agregar gasto.
- `GET /api/groups/<id>/expenses`: Listar gastos.
- `GET /api/groups/<id>/balance`: Obtener saldos y sugerencia de liquidación.
