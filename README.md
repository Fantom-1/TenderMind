# TenderMind AI

**AI4Bharat Hackathon — Theme 3: CRPF Government Procurement**
Air-gapped, explainable, auditable tender evaluation. Local LLM, local OCR, local DBs.

---

## Table of contents

1. [Quick start (5 min)](#1-quick-start-5-min)
2. [What it does](#2-what-it-does)
3. [Architecture](#3-architecture)
4. [Pipeline (6 stages)](#4-pipeline-6-stages)
5. [Prerequisites](#5-prerequisites)
6. [Detailed setup](#6-detailed-setup)
7. [Running the app](#7-running-the-app)
8. [Demo flow](#8-demo-flow)
9. [Demo credentials](#9-demo-credentials)
10. [Sample data](#10-sample-data)
11. [Configuration (.env)](#11-configuration-env)
12. [Repository layout](#12-repository-layout)
13. [Troubleshooting](#13-troubleshooting)
14. [Air-gap proof](#14-air-gap-proof)

---

## 1. Quick start (5 min)

Already installed Postgres, MongoDB, Memurai, Tesseract, Ollama, Node.js, Miniconda? Then:

```powershell
# from D:\AI4Bharat\
.\setup.ps1     # one-shot install (env, deps, migrations, seed users)
.\dev.ps1       # opens 3 windows: uvicorn, celery worker, next dev
```

Open http://localhost:3000 → log in as `uploader@tendermind.local` / `uploader-pass`.

Don't have the prereqs yet? Skip to [§5 Prerequisites](#5-prerequisites).

---

## 2. What it does

Officers upload a **tender** PDF and **bidder** documents. The system:

1. Extracts **structured criteria** from the tender (mandatory/optional, thresholds, evidence required) with source-page references.
2. Reads each bidder's documents and finds the **evidence per criterion**.
3. Computes a **confidence score** (4 sub-scores, weighted) and a **verdict** (`ELIGIBLE` / `NOT_ELIGIBLE` / `NEEDS_REVIEW`).
4. Lets an officer **override** flagged items with a reason.
5. Lets an approver **sign** the final report (RSA signature, SHA-256, hash-chained audit log).

Everything runs locally. No cloud calls. Models are swappable via `.env`.

---

## 3. Architecture

```
┌──────────────────┐    HTTPS    ┌─────────────┐    Redis    ┌──────────────┐
│  Next.js (3000)  │ ──────────▶ │  FastAPI    │ ──────────▶ │ Celery worker│
│  Server Comp.    │   cookie    │  (8000)     │   broker    │  (pipeline)  │
│  HttpOnly JWT    │ ◀────────── │             │             │              │
└──────────────────┘             └──────┬──────┘             └──────┬───────┘
                                        │                            │
                                        ▼                            ▼
                            ┌──────────────────────┐    ┌──────────────────────┐
                            │ Postgres             │    │ MongoDB              │
                            │ users, tenders,      │    │ ocr_pages, criteria, │
                            │ evaluations,         │    │ evidence, llm_calls  │
                            │ audit_log (hash      │    └──────────────────────┘
                            │ chain), signatures   │    ┌──────────────────────┐
                            └──────────────────────┘    │ ChromaDB (file)      │
                                                        │ embedding index per  │
                                                        │ bidder               │
                                                        └──────────────────────┘
                                       │
                                       ▼
                            ┌──────────────────────┐
                            │ Ollama (11434)       │
                            │ gemma3:4b (default)  │
                            └──────────────────────┘
```

**Key design choices:**

- **HttpOnly cookie** session — JWT never exposed to JavaScript (XSS-safe).
- **Postgres for governance** (ACID + append-only audit trigger), **Mongo for AI artifacts** (flexible OCR/evidence schemas).
- **Adapters everywhere** — OCR engine, LLM, embeddings are config-driven, not hardcoded.
- **Append-only audit log** with SHA-256 hash chain (`prev_hash` → `this_hash`); a Postgres trigger blocks `UPDATE`/`DELETE`.

---

## 4. Pipeline (6 stages)

Each stage is independently re-runnable and writes to a typed schema.

| # | Stage | Input | Output | Where |
|---|-------|-------|--------|-------|
| 1 | **Ingest** | PDF / DOCX / image | SHA-256, stored under UUID, Postgres row, audit event | `pipeline/ingest.py` |
| 2 | **OCR / Extract** | uploaded file | per-page text + word boxes + per-word confidence | `pipeline/extract.py`, `ocr_tesseract.py` |
| 3 | **Criteria extraction** | tender pages | structured JSON (id, type, mandatory, threshold, unit, source_page, source_text) | `pipeline/criteria.py` + LLM |
| 4 | **Evidence retrieval** | bidder pages + criterion | extracted value, page ref, LLM reasoning, says `NOT_FOUND` rather than fabricating | `pipeline/evidence.py` + Chroma + LLM |
| 5 | **Confidence + Verdict** | sub-scores | `Q = 0.25·Q_ocr + 0.35·Q_ext + 0.30·Q_match + 0.10·Q_doc` | `pipeline/confidence.py` |
| 6 | **Report + Audit** | evaluation rows | RSA-signed PDF, hash-chained audit entries | `core/pdf_signer.py`, `core/audit.py` |

**Verdict rule:**
- Any **mandatory** criterion failed → `NOT_ELIGIBLE`
- Any mandatory `Q < 0.85` → `NEEDS_REVIEW` (lands in officer queue)
- Else → `ELIGIBLE`

---

## 5. Prerequisites

Install these on Windows **before** running `setup.ps1`:

| Software | Where | Verify |
|---|---|---|
| Miniconda | https://docs.conda.io/en/latest/miniconda.html | `conda --version` |
| Node.js 18+ | https://nodejs.org | `node --version` |
| PostgreSQL 18 | https://www.postgresql.org/download/windows/ | port 5432 |
| MongoDB Community 7+ | https://www.mongodb.com/try/download/community | port 27017 |
| Memurai (Redis for Windows) | https://www.memurai.com/get-memurai | port 6379 |
| Tesseract OCR 5+ | https://github.com/UB-Mannheim/tesseract/wiki | install to `C:\Program Files\Tesseract-OCR\` |
| Ollama | https://ollama.com/download/windows | port 11434 |

After installing PostgreSQL, create the DB + user (run once in `psql`):

```sql
CREATE USER tendermind WITH PASSWORD 'tendermind';
CREATE DATABASE tendermind OWNER tendermind;
```

After installing Ollama, pull the model:

```powershell
ollama pull gemma3:4b
```

---

## 6. Detailed setup

From `D:\AI4Bharat\` in PowerShell:

```powershell
.\setup.ps1
```

This script:
1. Verifies every prereq (ports + binaries) — fails loud if anything is missing.
2. Creates conda env at `D:\AI4Bharat\envs\tendermind-be` (Python 3.11).
3. Runs `pip install -r backend/requirements.txt`.
4. Runs Alembic migrations on the `tendermind` Postgres DB.
5. Seeds 4 demo users (one per role).
6. Runs `npm install` in `frontend/`.
7. Pulls `gemma3:4b` if Ollama doesn't have it.

Idempotent — safe to re-run.

> **PowerShell execution policy error?** Run once: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`

---

## 7. Running the app

```powershell
.\dev.ps1
```

Opens 3 PowerShell windows:

| Window | What | URL |
|---|---|---|
| uvicorn | FastAPI backend | http://localhost:8000 |
| celery worker | runs the pipeline | — |
| next dev | frontend | http://localhost:3000 |

Wait until you see `Application startup complete.` (uvicorn) and `celery@<host> ready.` (worker), then open http://localhost:3000.

To stop: close the 3 windows.

---

## 8. Demo flow

> ⚡ Total time: ~5 minutes once the model is warm.

> Demo files live under `sample_data/` — see [§10 Sample data](#10-sample-data).

1. **Login as uploader** (`uploader@tendermind.local` / `uploader-pass`) → `/tenders/new` → upload `sample_data/tender/<file>.pdf`.
2. **Login as evaluator** (`evaluator@...`) → open the tender → **Extract criteria**. Watch the celery window: `Task pipeline.extract_criteria[...] received` → succeeded.
3. Each criterion has a clickable **source page** — opens the original tender page with the clause highlighted.
4. **Bidders tab** → for each `sample_data/bidders/bidder_*/` folder, click **Add a bidder**, name it, multi-select all files in the folder → upload. Select all bidders → **Run evaluation (N)**.
5. Open a bidder page — left rail shows criteria with verdict pill + confidence; click a criterion to see the **3-panel split**:
   - **Source** — bidder PDF with bbox highlight on the evidence
   - **Extraction** — extracted value + threshold + LLM chain-of-thought
   - **Confidence** — 4 horizontal bars (Q_ocr · Q_ext · Q_match · Q_doc → weighted total)
6. Anything below threshold appears in `/review`. Officer can **Confirm / Override (with reason) / Request re-upload**.
7. **Login as approver** (`approver@...`) → on the bidder page, click **Approve & sign PDF**. The signed PDF is downloadable.
8. **Login as auditor** (`auditor@...`) → `/audit` shows the hash-chained log → **Verify integrity** confirms OK.
9. **Cleanup** — as approver or auditor, every tender / bidder / evaluation page has a **Delete** button. Hard-deletes from Postgres, Mongo, ChromaDB, and the filesystem; the audit log keeps an immutable record of the deletion.

---

## 9. Demo credentials

| Role | Email | Password | Can do |
|---|---|---|---|
| Uploader | `uploader@tendermind.local` | `uploader-pass` | upload tenders + bidders |
| Evaluator | `evaluator@tendermind.local` | `evaluator-pass` | trigger pipeline, edit criteria, override |
| Approver | `approver@tendermind.local` | `approver-pass` | approve + sign final PDF |
| Auditor | `auditor@tendermind.local` | `auditor-pass` | view audit log, verify integrity |

---

## 10. Sample data

Demo files live in `sample_data/`. Layout:

```
sample_data/
├── tender/                      one RFP / tender (PDF or DOCX)
└── bidders/
    ├── bidder_a/                clean documents → expect ELIGIBLE
    ├── bidder_b/                missing one mandatory cert → NOT_ELIGIBLE
    └── bidder_c/                contains a blurry scan → NEEDS_REVIEW
```

The folders ship with `.gitkeep` placeholders. Drop your own demo PDFs /
DOCX into them — see `sample_data/README.md` for the suggested mix.
Use them in the [demo flow](#8-demo-flow) below.

> Anything you place in `sample_data/` may be committed to the repo.
> Don't put real procurement data there.

---

## 11. Configuration (.env)

`backend/.env` and `frontend/.env.local` **are committed on purpose** so
that evaluators can clone and run with zero config edits.

For machine-specific overrides (different DB password, different Tesseract
path, real JWT secret), drop a `.env.override` next to `.env` — it's
gitignored. Key knobs in `backend/.env`:

```env
LLM_PRIMARY=gemma3:4b              # swap to gemma3:12b / 27b
OCR_ENGINE=tesseract               # tesseract | paddle
TESSERACT_CMD=C:/Program Files/Tesseract-OCR/tesseract.exe
CONFIDENCE_THRESHOLD=0.85
OCR_CONFIDENCE_THRESHOLD=0.70
MAX_UPLOAD_MB=50
```

**To swap the model**: change `LLM_PRIMARY`, restart the celery worker. No code changes.

---

## 12. Repository layout

```
D:\AI4Bharat\
├── backend\               FastAPI + Celery + pipeline
│   ├── app\
│   │   ├── api\           routers (auth, tenders, bidders, evaluations, audit)
│   │   ├── core\          security, audit chain, PDF signer, storage
│   │   ├── pipeline\      ingest, OCR, criteria, evidence, matcher, confidence
│   │   ├── tasks\         celery_app + pipeline_tasks (the 3 jobs)
│   │   ├── models\        SQLAlchemy ORM
│   │   ├── schemas\       Pydantic
│   │   └── db\            postgres.py, mongo.py
│   ├── alembic\           DB migrations + audit-log triggers
│   ├── scripts\           seed_users.py
│   ├── requirements.txt
│   └── .env
├── frontend\              Next.js 14 App Router
│   ├── app\
│   │   ├── (auth)\login\
│   │   ├── (app)\         dashboard, tenders, bidders, review, audit
│   │   └── api\           BFF proxies (cookie → bearer)
│   ├── components\        ui primitives, pdf viewer, charts
│   └── lib\               api client, auth helpers, types
├── sample_data\           demo tender + bidder docs (drop files here)
├── storage\               uploads, OCR cache, signed PDFs, RSA keys, Chroma index (gitignored)
├── envs\                  conda envs (created by setup.ps1, gitignored)
├── scripts\               build_readme_docx.py
├── setup.ps1              one-shot installer
├── dev.ps1                one-shot runner
├── .gitignore
└── README.md
```

---

## 13. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `[WinError 10061] target machine actively refused` (kombu / pyamqp) | Celery sending to RabbitMQ instead of Redis | Cold-restart uvicorn AND worker (no `--reload`); see [§7](#7-running-the-app) |
| `pytesseract.TesseractNotFoundError` | Tesseract not on PATH | Install to `C:\Program Files\Tesseract-OCR\` or update `TESSERACT_CMD` in `.env` |
| `httpx.ConnectError` to `:11434` | Ollama not running | Open Ollama from Start menu (system tray icon) |
| `model 'gemma3:4b' not found` | model not pulled | `ollama pull gemma3:4b` |
| Frontend 401 redirect loop | backend down, or cookie expired (8h) | confirm uvicorn is up, re-login |
| `JWT_SECRET` missing on startup | `.env` not loaded | run uvicorn from `D:\AI4Bharat\backend\` |
| `Get-Service Memurai → Stopped` | Redis service inactive | `Start-Service Memurai` |
| Celery worker silent on click | wrong broker URL bound to task | confirm worker banner shows `transport: redis://...` (not `amqp://`) |

**Verify audit-chain integrity:**
```powershell
cd backend
D:\AI4Bharat\envs\tendermind-be\python.exe -m app.core.audit verify
```

---

## 14. Air-gap proof

Turn off WiFi. Run the demo flow end-to-end. Everything still works:
- LLM is local (Ollama on `127.0.0.1:11434`).
- Embeddings model is cached at `~/.cache/huggingface/` after first install.
- All file storage is under `D:\AI4Bharat\storage\`.
- No outbound HTTP from any pipeline stage.
