"""
Per-stack ChromaDB Knowledge Base for React Flow execution.

- One Chroma collection per stack: knowledge_base_{stack_id}
- Open-source embeddings (SentenceTransformers)
- Supports multiple embedding models
"""

from typing import List, Dict, Any, Tuple
import os
import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer

# ---------- Persistent Chroma store ----------
CHROMA_DIR = os.getenv("CHROMA_DIR", os.path.join(os.getcwd(), "chroma_db"))
os.makedirs(CHROMA_DIR, exist_ok=True)

chroma_client = chromadb.PersistentClient(
    path=CHROMA_DIR,
    settings=Settings(allow_reset=False),
)

# Available embedding models
EMBED_MODELS = {
    "mini": "all-MiniLM-L6-v2",
    "mpnet": "all-mpnet-base-v2",
    # "nomic": "nomic-embed-text-v1",  # optional if you install nomic
}

# Cache loaded models
_model_cache: Dict[str, SentenceTransformer] = {}

def _get_embedder(name: str) -> SentenceTransformer:
    """Load and cache SentenceTransformer model by name key (mini/mpnet)."""
    if name not in EMBED_MODELS:
        name = "mini"
    if name not in _model_cache:
        _model_cache[name] = SentenceTransformer(EMBED_MODELS[name])
    return _model_cache[name]

def _collection_name(stack_id: int) -> str:
    return f"knowledge_base_{stack_id}"

def _get_collection(stack_id: int):
    return chroma_client.get_or_create_collection(_collection_name(stack_id))

def _chunk_text(text: str, chunk_size: int = 800, overlap: int = 120) -> List[Tuple[str, int, int]]:
    """Split long text into overlapping chunks for embeddings."""
    chunks = []
    n = len(text)
    i = 0
    while i < n:
        start = i
        end = min(i + chunk_size, n)
        chunks.append((text[start:end], start, end))
        if end == n:
            break
        i = max(end - overlap, 0)
    return chunks

# ----------------------- Public API -----------------------

def add_to_kb(text: str, stack_id: int, source: str, embed_model: str = "mini") -> Dict[str, Any]:
    """Chunk text, embed, and store in ChromaDB for given stack."""
    try:
        collection = _get_collection(stack_id)
        embedder = _get_embedder(embed_model)

        tuples = _chunk_text(text)
        documents = [t[0] for t in tuples]
        metadatas = [
            {"source": source, "chunk_index": i, "char_start": s, "char_end": e}
            for i, (_, s, e) in enumerate(tuples)
        ]
        ids = [f"{source}:{i}" for i in range(len(documents))]

        if documents:
            embeddings = embedder.encode(documents, show_progress_bar=False).tolist()
            collection.add(documents=documents, embeddings=embeddings, metadatas=metadatas, ids=ids)

        return {
            "chunks_added": len(documents),
            "preview": documents[0][:500] if documents else "",
        }
    except Exception as e:
        return {"error": str(e)}

def search_kb(query: str, stack_id: int, top_k: int = 4, embed_model: str = "mini") -> List[Dict[str, Any]]:
    """Search knowledge base for a query; returns list of {text, metadata, distance}"""
    try:
        collection = _get_collection(stack_id)
        embedder = _get_embedder(embed_model)

        q_embed = embedder.encode([query], show_progress_bar=False).tolist()[0]
        res = collection.query(
            query_embeddings=[q_embed],
            n_results=top_k,
            include=["documents", "metadatas", "distances"],
        )
        docs = res.get("documents", [[]])[0]
        metas = res.get("metadatas", [[]])[0]
        dists = res.get("distances", [[]])[0]

        out: List[Dict[str, Any]] = []
        for t, m, d in zip(docs, metas, dists):
            out.append({"text": t, "metadata": m or {}, "distance": float(d)})
        return out
    except Exception as e:
        return [{"text": "", "metadata": {}, "distance": 9999, "error": str(e)}]

def clear_kb(stack_id: int) -> Dict[str, Any]:
    """Clear a stack's collection, then recreate it."""
    try:
        name = _collection_name(stack_id)
        for coll in chroma_client.list_collections():
            if coll.name == name:
                chroma_client.delete_collection(name)
                break
        chroma_client.get_or_create_collection(name)
        return {"cleared": True, "collection": name}
    except Exception as e:
        return {"error": str(e)}
