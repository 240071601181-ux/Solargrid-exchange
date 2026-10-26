"""Provision a SolarGrid administrator outside public registration.

Usage:
    python -m app.admin_cli --email operator@example.com --name "Grid Operator"

The password is read from ``BOOTSTRAP_ADMIN_PASSWORD`` or prompted without echo.
An existing account is never silently promoted; pass ``--reset-password`` to
rotate the password for an existing administrator explicitly.
"""

from __future__ import annotations

import argparse
import getpass
import os
import sys

from sqlalchemy import select

from .db import SessionLocal, init_db
from .models import User
from .services.security import (
    ROLE_ADMIN,
    hash_password,
    normalize_email,
    valid_email,
    validate_password_policy,
)
from .services.simulation import ensure_defaults


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Create or update a SolarGrid administrator.")
    parser.add_argument("--email", default=os.environ.get("BOOTSTRAP_ADMIN_EMAIL"))
    parser.add_argument("--name", default=os.environ.get("BOOTSTRAP_ADMIN_NAME", "SolarGrid Operator"))
    parser.add_argument("--reset-password", action="store_true")
    args = parser.parse_args(argv)

    if not args.email:
        print("An administrator email is required (--email or BOOTSTRAP_ADMIN_EMAIL).", file=sys.stderr)
        return 2
    email = normalize_email(args.email)
    if not valid_email(email):
        print("The supplied email address is not valid.", file=sys.stderr)
        return 2

    password = os.environ.get("BOOTSTRAP_ADMIN_PASSWORD")
    if not password:
        password = getpass.getpass("Administrator password: ")
        confirm = getpass.getpass("Confirm password: ")
        if password != confirm:
            print("Passwords do not match.", file=sys.stderr)
            return 2
    try:
        validate_password_policy(password)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 2

    init_db()
    with SessionLocal() as db:
        ensure_defaults(db)
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(
                full_name=args.name.strip()[:120] or "SolarGrid Operator",
                email=email,
                password_hash=hash_password(password),
                role=ROLE_ADMIN,
                status="active",
            )
            db.add(user)
            db.commit()
            print(f"Created administrator {email}.")
            return 0
        if user.role != ROLE_ADMIN:
            print("An account with that email exists but is not an administrator.", file=sys.stderr)
            return 1
        if not args.reset_password:
            print("Administrator already exists. Use --reset-password to rotate the password.", file=sys.stderr)
            return 1
        user.password_hash = hash_password(password)
        user.full_name = args.name.strip()[:120] or user.full_name
        user.status = "active"
        db.commit()
        print(f"Updated administrator {email}.")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
