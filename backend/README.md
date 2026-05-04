# TenderMind AI — Backend

FastAPI + Celery + Postgres + MongoDB + Redis. Self-hosted Ollama for LLM.

## One-time setup

```powershell
# 1. Create the conda env in-project on D drive
conda create --prefix D:/AI4Bharat/envs/tendermind-be python=3.11 pip -y

# 2. Install dependencies
conda run --prefix D:/AI4Bharat/envs/tendermind-be pip install -r D:/AI4Bharat/backend/requirements.txt

# 3. Copy env file and edit
copy .env.example .env
# Generate a JWT secret:
conda run --prefix D:/AI4Bharat/envs/tendermind-be python -c "import secrets; print(secrets.token_urlsafe(48))"
```

## Run

```powershell
cd D:/AI4Bharat/backend
conda run --prefix D:/AI4Bharat/envs/tendermind-be uvicorn app.main:app --reload --port 8000
```

Visit http://localhost:8000/docs and http://localhost:8000/health.

## Layout

```
app/
├── main.py            FastAPI entry
├── config.py          .env -> Settings
├── deps.py            DI: db, mongo, redis, current user
├── api/               routers (auth, tenders, bidders, evaluations, review, audit, reports)
├── core/              security, audit hash chain, pdf signer, storage
├── pipeline/          ingest, OCR adapters, criteria, evidence, matcher, confidence
│   └── llm/           LLM client + prompts
├── db/                postgres + mongo
├── models/            SQLAlchemy ORM
├── schemas/           pydantic
└── tasks/             Celery
```

## Models are swappable

Change `LLM_PRIMARY` in `.env` (e.g. `gemma3:4b` -> `gemma3:12b`) and restart. No code changes.
Change `OCR_ENGINE` (`tesseract` <-> `paddle`) — same.
