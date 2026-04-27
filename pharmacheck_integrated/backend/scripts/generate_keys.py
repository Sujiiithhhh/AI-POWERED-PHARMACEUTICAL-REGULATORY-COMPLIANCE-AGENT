#!/usr/bin/env python3
"""
Generate an RS256 keypair for JWT signing.
Run once:  python scripts/generate_keys.py
Copy the output into your .env file.
"""

from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

private_pem = key.private_bytes(
    serialization.Encoding.PEM,
    serialization.PrivateFormat.PKCS8,
    serialization.NoEncryption(),
).decode()

public_pem = key.public_key().public_bytes(
    serialization.Encoding.PEM,
    serialization.PublicFormat.SubjectPublicKeyInfo,
).decode()

print("# ── Paste into your .env ──────────────────────────────────────────")
print(f'JWT_PRIVATE_KEY="{private_pem.strip()}"')
print()
print(f'JWT_PUBLIC_KEY="{public_pem.strip()}"')
print()
print("# Keys generated successfully. Keep JWT_PRIVATE_KEY secret!")
