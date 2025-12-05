import requests
import json

BASE_URL = 'http://127.0.0.1:5001/api'
SESSION = requests.Session()

def test_auth():
    print("1. Registering User...")
    email = "test@example.com"
    password = "password123"
    
    # Register
    resp = SESSION.post(f'{BASE_URL}/auth/register', json={
        'name': 'Test User',
        'email': email,
        'password': password
    })
    
    if resp.status_code == 201:
        print("   User registered.")
    elif resp.status_code == 400:
        print("   User already exists (skipping register).")
    else:
        print(f"   Failed to register: {resp.text}")
        return

    # Login
    print("\n2. Logging In...")
    resp = SESSION.post(f'{BASE_URL}/auth/login', json={
        'email': email,
        'password': password
    })
    assert resp.status_code == 200
    print("   Logged in successfully.")
    
    # Create Group (Protected)
    print("\n3. Creating Group (Protected)...")
    resp = SESSION.post(f'{BASE_URL}/groups', json={
        'name': 'Auth Test Group',
        'participants': ['A', 'B']
    })
    assert resp.status_code == 201
    group_id = resp.json()['id']
    print(f"   Group created: ID {group_id}")
    
    # Logout
    print("\n4. Logging Out...")
    resp = SESSION.post(f'{BASE_URL}/auth/logout')
    assert resp.status_code == 200
    print("   Logged out.")
    
    # Access Protected Route (Should Fail)
    print("\n5. Accessing Protected Route (Should Fail)...")
    resp = SESSION.get(f'{BASE_URL}/groups/{group_id}')
    if resp.status_code == 401:
        print("   SUCCESS: Access denied (401) as expected.")
    else:
        print(f"   FAILURE: Unexpected status code {resp.status_code}")

if __name__ == '__main__':
    test_auth()
