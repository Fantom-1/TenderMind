"""Seed 4 demo users (one per role) into Postgres.

Run with:
    D:/AI4Bharat/envs/tendermind-be/python.exe -m scripts.seed_users
from D:/AI4Bharat/backend.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.security import hash_password
from app.db.postgres import SessionLocal
from app.models.user import User


SEED = [
    ("uploader@tendermind.local", "uploader-pass", "uploader", "Demo Uploader"),
    ("evaluator@tendermind.local", "evaluator-pass", "evaluator", "Demo Evaluator"),
    ("approver@tendermind.local", "approver-pass", "approver", "Demo Approver"),
    ("auditor@tendermind.local", "auditor-pass", "auditor", "Demo Auditor"),
]


def main() -> None:
    db = SessionLocal()
    try:
        created = 0
        for email, pw, role, full_name in SEED:
            existing = db.query(User).filter(User.email == email).one_or_none()
            if existing:
                print(f"[skip] {email} already exists ({existing.role})")
                continue
            db.add(
                User(
                    email=email,
                    password_hash=hash_password(pw),
                    role=role,
                    full_name=full_name,
                )
            )
            created += 1
            print(f"[seed] {email} ({role})")
        db.commit()
        print(f"\nDone. {created} users created.")
        print("\nDemo credentials:")
        for email, pw, role, _ in SEED:
            print(f"  {role:10s}  {email}  /  {pw}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
