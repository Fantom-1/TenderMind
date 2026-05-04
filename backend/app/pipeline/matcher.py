"""Per-bidder ChromaDB index over OCR'd pages.

We create one collection per bidder so we can re-index without disturbing
other bidders. The embedding model name comes from .env so it's swappable.
"""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.config import get_settings
from app.pipeline.ocr.base import OCRPage


@dataclass
class RetrievedPassage:
    bidder_id: int
    page_number: int
    text: str
    score: float


@lru_cache(maxsize=1)
def _client() -> chromadb.PersistentClient:
    s = get_settings()
    return chromadb.PersistentClient(
        path=str(s.chroma_path),
        settings=ChromaSettings(anonymized_telemetry=False),
    )


@lru_cache(maxsize=1)
def _embedder():
    s = get_settings()
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(s.embedding_model)


def _collection_name(bidder_id: int) -> str:
    return f"bidder_{bidder_id}"


def index_bidder_pages(bidder_id: int, pages: list[OCRPage]) -> int:
    """Re-index a bidder's pages. Returns the number of chunks indexed.

    For the prototype we use one chunk per page (pages are short enough);
    a future iteration can chunk by paragraph for finer retrieval.
    """
    client = _client()
    name = _collection_name(bidder_id)
    # Replace any existing collection so re-runs are deterministic.
    try:
        client.delete_collection(name)
    except Exception:
        pass
    coll = client.get_or_create_collection(name=name, metadata={"bidder_id": bidder_id})

    docs, metas, ids = [], [], []
    for p in pages:
        text = (p.text or "").strip()
        if not text:
            continue
        ids.append(f"{bidder_id}:{p.page_number}")
        docs.append(text)
        metas.append({"bidder_id": bidder_id, "page_number": p.page_number, "source": p.source})

    if not docs:
        return 0

    embeddings = _embedder().encode(docs, normalize_embeddings=True).tolist()
    coll.add(ids=ids, documents=docs, metadatas=metas, embeddings=embeddings)
    return len(docs)


def search_bidder(bidder_id: int, query: str, k: int = 4) -> list[RetrievedPassage]:
    coll = _client().get_or_create_collection(name=_collection_name(bidder_id))
    if coll.count() == 0:
        return []
    q_emb = _embedder().encode([query], normalize_embeddings=True).tolist()
    res = coll.query(query_embeddings=q_emb, n_results=k)
    out: list[RetrievedPassage] = []
    for doc, meta, dist in zip(
        res["documents"][0], res["metadatas"][0], res["distances"][0]
    ):
        # Chroma returns a distance (lower = closer); map to 0..1 score.
        score = max(0.0, 1.0 - float(dist))
        out.append(
            RetrievedPassage(
                bidder_id=int(meta["bidder_id"]),
                page_number=int(meta["page_number"]),
                text=doc,
                score=score,
            )
        )
    return out
