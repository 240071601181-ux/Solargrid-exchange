from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import BASE_DIR, settings

(BASE_DIR / "data").mkdir(parents=True, exist_ok=True)

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
    pool_pre_ping=True,
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragmas(dbapi_connection, _connection_record) -> None:  # type: ignore[no-untyped-def]
    if settings.database_url.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from . import models  # noqa: F401  (registers metadata)

    Base.metadata.create_all(bind=engine)
    _apply_additive_migrations()


def _column_names(connection, table: str) -> set[str]:  # type: ignore[no-untyped-def]
    rows = connection.execute(text(f"PRAGMA table_info({table})")).mappings().all()
    return {str(row["name"]) for row in rows}


def _apply_additive_migrations() -> None:
    """Add columns introduced after the first SQLite schema without dropping data.

    SQLAlchemy's ``create_all`` never alters existing tables. These additions are
    intentionally nullable or have safe defaults so existing simulation history is
    preserved. New tables are created by ``create_all`` above.
    """
    if not settings.database_url.startswith("sqlite"):
        return

    with engine.begin() as connection:
        tables = {
            str(row[0])
            for row in connection.execute(
                text("SELECT name FROM sqlite_master WHERE type='table'")
            ).all()
        }

        if "households" in tables:
            columns = _column_names(connection, "households")
            if "owner_user_id" not in columns:
                connection.execute(
                    text(
                        "ALTER TABLE households ADD COLUMN owner_user_id INTEGER "
                        "REFERENCES users(id) ON DELETE SET NULL"
                    )
                )
            connection.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ix_households_owner_user_id "
                    "ON households(owner_user_id)"
                )
            )

        for table in ("allocation_runs", "transactions"):
            if table not in tables:
                continue
            columns = _column_names(connection, table)
            if "source" not in columns:
                connection.execute(
                    text(
                        f"ALTER TABLE {table} ADD COLUMN source VARCHAR(30) "
                        "NOT NULL DEFAULT 'simulation'"
                    )
                )
            connection.execute(
                text(f"CREATE INDEX IF NOT EXISTS ix_{table}_source ON {table}(source)")
            )
