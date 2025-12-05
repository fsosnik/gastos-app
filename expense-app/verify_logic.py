import json

BASE_URL = 'http://127.0.0.1:5000/api'

def test_logic():
    # 1. Create Group
    print("1. Creating Group...")
    # We need to run the app in a separate process or use flask test client. 
    # Since I cannot easily run background server and test against it in one go without complex setup in this environment,
    # I will import the app and use the test client.
    
    from app import app, db, Group, Participant, Expense
    
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:' # Use in-memory DB for testing
    app.config['TESTING'] = True
    
    with app.app_context():
        db.create_all()
        
        # Create Group
        client = app.test_client()
        resp = client.post('/api/groups', json={
            'name': 'Test Trip',
            'participants': ['Alice', 'Bob']
        })
        group_data = resp.get_json()
        group_id = group_data['id']
        print(f"   Group created: {group_data['name']} (ID: {group_id})")
        
        # Get Participants IDs
        resp = client.get(f'/api/groups/{group_id}')
        data = resp.get_json()
        p_map = {p['name']: p['id'] for p in data['participants']}
        alice_id = p_map['Alice']
        bob_id = p_map['Bob']
        print(f"   Participants: Alice ({alice_id}), Bob ({bob_id})")
        
        # 2. Add Expense: Alice pays 100 for Alice and Bob
        print("\n2. Adding Expense: Alice pays 100 for Alice & Bob...")
        resp = client.post(f'/api/groups/{group_id}/expenses', json={
            'title': 'Dinner',
            'amount': 100.0,
            'payer_id': alice_id,
            'involved_ids': [alice_id, bob_id]
        })
        assert resp.status_code == 201
        print("   Expense added.")
        
        # 3. Check Balance
        print("\n3. Checking Balance...")
        resp = client.get(f'/api/groups/{group_id}/balance')
        balance_data = resp.get_json()
        
        print("   Balances:", balance_data['balances'])
        print("   Settlements:", balance_data['settlements'])
        
        # Verification Logic
        # Alice paid 100. Split is 50 each.
        # Alice: Paid 100, Consumed 50. Net: +50.
        # Bob: Paid 0, Consumed 50. Net: -50.
        # Settlement: Bob pays Alice 50.
        
        settlements = balance_data['settlements']
        assert len(settlements) == 1
        s = settlements[0]
        
        if s['from'] == bob_id and s['to'] == alice_id and s['amount'] == 50.0:
            print("\nSUCCESS: Logic Verified! Bob owes Alice 50.0")
        else:
            print(f"\nFAILURE: Unexpected settlement: {s}")

if __name__ == '__main__':
    test_logic()
