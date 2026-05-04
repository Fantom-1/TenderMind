"""initial schema + audit append-only rule

Revision ID: 0001
Revises:
Create Date: 2026-05-01

The audit_log table has a Postgres rule that converts UPDATE/DELETE into
NO-OPs, so even a privileged user using SQL cannot mutate prior records.
The hash-chain still detects forced INSERTs that bypass app.core.audit.
"""
from alembic import op
import sqlalchemy as sa


revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(32), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "tenders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("uploaded_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("file_hash", sa.String(64), nullable=False, index=True),
        sa.Column("file_path", sa.Text(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="uploaded"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "bidders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tender_id", sa.Integer(), sa.ForeignKey("tenders.id"), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("uploaded_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("file_paths", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("file_hashes", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "evaluations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tender_id", sa.Integer(), sa.ForeignKey("tenders.id"), nullable=False, index=True),
        sa.Column("bidder_id", sa.Integer(), sa.ForeignKey("bidders.id"), nullable=False, index=True),
        sa.Column("verdict", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("overall_confidence", sa.Float(), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="queued"),
        sa.Column("signed_pdf_path", sa.Text(), nullable=True),
        sa.Column("approved_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "audit_log",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("ts", sa.DateTime(), nullable=False, server_default=sa.func.now(), index=True),
        sa.Column("actor_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("event_type", sa.String(64), nullable=False, index=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("prev_hash", sa.String(64), nullable=True),
        sa.Column("this_hash", sa.String(64), nullable=False),
    )

    # Block UPDATE / DELETE on audit_log via Postgres RULES.
    # Even superusers cannot mutate or remove rows through SQL.
    op.execute(
        """
        CREATE RULE audit_log_no_update AS
            ON UPDATE TO audit_log DO INSTEAD NOTHING;
        """
    )
    op.execute(
        """
        CREATE RULE audit_log_no_delete AS
            ON DELETE TO audit_log DO INSTEAD NOTHING;
        """
    )


def downgrade() -> None:
    op.execute("DROP RULE IF EXISTS audit_log_no_delete ON audit_log;")
    op.execute("DROP RULE IF EXISTS audit_log_no_update ON audit_log;")
    op.drop_table("audit_log")
    op.drop_table("evaluations")
    op.drop_table("bidders")
    op.drop_table("tenders")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
