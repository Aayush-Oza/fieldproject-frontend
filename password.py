"""
hash_password.py
----------------
Generates a bcrypt hash for a password.
Run: python hash_password.py
"""

import bcrypt

password = input("EventOps@2026_").strip()
hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12))
print(f"\nHashed password:\n{hashed.decode()}\n")