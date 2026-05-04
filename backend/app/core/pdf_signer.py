"""Generate an RSA-signed evaluation report.

The signing key is auto-generated on first run and persisted to
SIGNING_KEY_PATH so the chain of custody (publication of public key,
verification by third parties) survives restarts. The .pem private key
is sensitive -- the .gitignore excludes the storage/keys directory.

Layout of the generated bundle:
  - report.pdf       : human-readable PDF
  - report.pdf.sha256: hex of SHA-256(report.pdf)
  - report.pdf.sig   : RSA-PSS signature over the SHA-256
"""
from __future__ import annotations

import hashlib
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.config import get_settings


def _load_or_create_key() -> rsa.RSAPrivateKey:
    s = get_settings()
    path = s.signing_key_path
    if path.exists():
        return serialization.load_pem_private_key(path.read_bytes(), password=None)
    path.parent.mkdir(parents=True, exist_ok=True)
    key = rsa.generate_private_key(public_exponent=65537, key_size=3072)
    pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    path.write_bytes(pem)
    # Also drop the public key alongside, for verifiers.
    pub_pem = key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    (path.parent / "report_signing.pub.pem").write_bytes(pub_pem)
    return key


def _render_pdf(out_path: Path, *, title: str, summary: dict, scores: list[dict]) -> None:
    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate(
        str(out_path),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=title,
    )
    story = [
        Paragraph(f"<b>{title}</b>", styles["Title"]),
        Spacer(1, 4 * mm),
        Paragraph(
            f"Verdict: <b>{summary.get('verdict','?').upper()}</b> "
            f"(overall confidence {summary.get('overall_confidence','?')})",
            styles["Heading2"],
        ),
        Paragraph(summary.get("reason", ""), styles["BodyText"]),
        Spacer(1, 6 * mm),
        Paragraph("Criterion-level evidence:", styles["Heading3"]),
    ]

    table_data = [["Criterion", "Mandatory", "Meets", "Q_ocr", "Q_ext", "Q_match", "Q_doc", "Total"]]
    for s in scores:
        meets = s.get("meets")
        meets_label = "—" if meets is None else ("✓" if meets else "✗")
        table_data.append(
            [
                s.get("criterion_id", ""),
                "yes" if s.get("mandatory") else "no",
                meets_label,
                f"{s.get('q_ocr', 0):.2f}",
                f"{s.get('q_ext', 0):.2f}",
                f"{s.get('q_match', 0):.2f}",
                f"{s.get('q_doc', 0):.2f}",
                f"{s.get('total', 0):.2f}",
            ]
        )
    table = Table(table_data, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E40AF")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("ALIGN", (3, 1), (-1, -1), "RIGHT"),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E2E8F0")),
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 6 * mm))
    story.append(
        Paragraph(
            "<font size=8 color='#475569'>This report is digitally signed. "
            "The companion .sig file plus the public key (report_signing.pub.pem) "
            "can be used to verify integrity offline.</font>",
            styles["BodyText"],
        )
    )
    doc.build(story)


def sign_evaluation(
    *, evaluation_id: int, bidder_name: str, summary: dict, scores: list[dict]
) -> Path:
    s = get_settings()
    out_dir = s.storage_root / "reports"
    out_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = out_dir / f"evaluation_{evaluation_id}.pdf"

    _render_pdf(
        pdf_path,
        title=f"TenderMind AI — Evaluation Report #{evaluation_id} ({bidder_name})",
        summary=summary,
        scores=scores,
    )

    pdf_bytes = pdf_path.read_bytes()
    digest = hashlib.sha256(pdf_bytes).digest()
    digest_hex = digest.hex()
    (pdf_path.with_suffix(".pdf.sha256")).write_text(digest_hex)

    key = _load_or_create_key()
    signature = key.sign(
        digest,
        padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.MAX_LENGTH),
        hashes.SHA256(),
    )
    (pdf_path.with_suffix(".pdf.sig")).write_bytes(signature)
    return pdf_path
