# backend/main.py
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, Depends, HTTPException, File, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from backend.database import SessionLocal, Stack
from backend.knowledge_base import add_to_kb, search_kb, clear_kb

import requests
import json
import fitz  # PyMuPDF

app = FastAPI(
    title="GenAI Stack Backend (Ollama + ChromaDB)",
    description="Stacks CRUD, per-stack Knowledge Base, and React Flow Graph Executor.",
    version="2.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------- DB dependency -----------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ----------------- Pydantic models -----------------
class StackCreate(BaseModel):
    name: str
    # accept either a parsed JSON object or a JSON string from the frontend
    blocks: Any = Field(default_factory=dict)


class StackResponse(BaseModel):
    id: int
    name: str
    blocks: Dict[str, Any]

    class Config:
        orm_mode = True


class RFNode(BaseModel):
    id: str
    type: str
    data: Dict[str, Any] = Field(default_factory=dict)


class RFEdge(BaseModel):
    id: Optional[str] = None
    source: str
    target: str


class BuildRequest(BaseModel):
    nodes: List[RFNode]
    edges: List[RFEdge]


class ExecuteRequest(BaseModel):
    stack_id: int
    nodes: List[RFNode]
    edges: List[RFEdge]
    query: Optional[str] = None
    stream_logs: bool = True


# ----------------- Helpers for blocks parsing -----------------
def _normalize_blocks_input(blocks_input: Any) -> Dict[str, Any]:
    """
    Accepts:
      - a Python dict (already parsed)
      - a JSON string (e.g. frontend did JSON.stringify)
      - anything else -> wrap into {"raw": str(...)}
    Returns a Python dict safe to json.dumps and store.
    """
    if blocks_input is None:
        return {}
    # If it's already a dict-like
    if isinstance(blocks_input, dict):
        return blocks_input
    # If it's a string, try to parse as JSON
    if isinstance(blocks_input, str):
        try:
            parsed = json.loads(blocks_input)
            if isinstance(parsed, dict):
                return parsed
            # if parsed JSON is not a dict, wrap it
            return {"value": parsed}
        except Exception:
            # not valid json string -> store as raw text
            return {"raw": blocks_input}
    # If it's a list, wrap it
    if isinstance(blocks_input, list):
        return {"list": blocks_input}
    # Fallback: convert to string
    return {"raw": str(blocks_input)}


def _parse_blocks_from_db(blocks_text: Optional[str]) -> Dict[str, Any]:
    if not blocks_text:
        return {}
    try:
        parsed = json.loads(blocks_text)
        if isinstance(parsed, dict):
            return parsed
        return {"value": parsed}
    except Exception:
        # if stored value is not valid JSON (unexpected), return raw
        return {"raw": blocks_text}


# ----------------- Root -----------------
@app.get("/")
def read_root():
    return {"message": "✅ FastAPI + PostgreSQL + Ollama + ChromaDB is running"}


# ---------------- stacks CRUD ----------------
@app.post("/stacks/", response_model=StackResponse)
def create_stack(stack: StackCreate, db: Session = Depends(get_db)):
    # Normalize blocks input (accept string or object)
    normalized = _normalize_blocks_input(stack.blocks)
    db_stack = Stack(name=stack.name, blocks=json.dumps(normalized))
    db.add(db_stack)
    db.commit()
    db.refresh(db_stack)

    return {"id": db_stack.id, "name": db_stack.name, "blocks": normalized}


@app.get("/stacks/", response_model=List[StackResponse])
def get_stacks(db: Session = Depends(get_db)):
    rows = db.query(Stack).all()
    out: List[Dict[str, Any]] = []
    for s in rows:
        blocks_parsed = _parse_blocks_from_db(s.blocks)
        out.append({"id": s.id, "name": s.name, "blocks": blocks_parsed})
    return out


@app.get("/stacks/{stack_id}", response_model=StackResponse)
def get_stack(stack_id: int, db: Session = Depends(get_db)):
    stack = db.query(Stack).filter(Stack.id == stack_id).first()
    if not stack:
        raise HTTPException(status_code=404, detail="Stack not found")
    blocks_parsed = _parse_blocks_from_db(stack.blocks)
    return {"id": stack.id, "name": stack.name, "blocks": blocks_parsed}


@app.put("/stacks/{stack_id}", response_model=StackResponse)
def update_stack(stack_id: int, stack: StackCreate, db: Session = Depends(get_db)):
    db_stack = db.query(Stack).filter(Stack.id == stack_id).first()
    if not db_stack:
        raise HTTPException(status_code=404, detail="Stack not found")

    normalized = _normalize_blocks_input(stack.blocks)
    db_stack.name = stack.name
    db_stack.blocks = json.dumps(normalized)
    db.commit()
    db.refresh(db_stack)
    return {"id": db_stack.id, "name": db_stack.name, "blocks": normalized}


@app.delete("/stacks/{stack_id}")
def delete_stack(stack_id: int, db: Session = Depends(get_db)):
    stack = db.query(Stack).filter(Stack.id == stack_id).first()
    if not stack:
        raise HTTPException(status_code=404, detail="Stack not found")
    db.delete(stack)
    db.commit()
    return {"message": f"Stack {stack_id} deleted successfully"}


# ---------------- KB endpoints ----------------
@app.post("/upload/{stack_id}")
async def upload_file(stack_id: int, file: UploadFile = File(...), embed_model: str = "mini"):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    try:
        content = await file.read()
        doc = fitz.open(stream=content, filetype="pdf")
        text = "".join([page.get_text() for page in doc])
        doc.close()

        stats = add_to_kb(text=text, stack_id=stack_id, source=file.filename, embed_model=embed_model)
        # stats expected: {"chunks_added": int, "preview": str}
        return {
            "filename": file.filename,
            "preview": stats.get("preview", ""),
            "length": len(text),
            "chunks_added": stats.get("chunks_added", 0),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@app.post("/kb/clear/{stack_id}")
def clear_knowledge_base_route(stack_id: int):
    return clear_kb(stack_id)


# ---------------- execute graph ----------------
@app.post("/execute")
def execute(req: ExecuteRequest):
    _ = build(BuildRequest(nodes=req.nodes, edges=req.edges))
    nodes_by_id = {n.id: n for n in req.nodes}
    adj: Dict[str, List[str]] = {e.source: [] for e in req.edges}
    for e in req.edges:
        adj.setdefault(e.source, []).append(e.target)

    query_id = next((n.id for n in req.nodes if n.type == "query"), None)
    output_id = next((n.id for n in req.nodes if n.type == "output"), None)
    if not query_id or not output_id:
        raise HTTPException(status_code=400, detail="Query or Output node missing")

    path = _greedy_path(query_id, output_id, adj)
    if not path:
        raise HTTPException(status_code=400, detail="Could not determine execution path")

    def generate():
        assistantText = ""
        try:
            user_query = req.query or nodes_by_id[query_id].data.get("value", "")
            if not user_query:
                yield json.dumps({"type": "error", "message": "Missing user query"}) + "\n"
                return

            if req.stream_logs:
                yield json.dumps({"type": "status", "message": f"Path: {' → '.join(path)}"}) + "\n"

            # ---- LLM Node ----
            llm_node_id = next((nid for nid in path if nodes_by_id[nid].type == "llm"), None)
            if not llm_node_id:
                yield json.dumps({"type": "error", "message": "No LLM node"}) + "\n"
                return

            llm_node = nodes_by_id[llm_node_id]
            model = llm_node.data.get("model", "llama3")
            system_prompt = llm_node.data.get("prompt", "You are a helpful assistant.")

            prompt = f"{system_prompt}\n\nUser: {user_query}\n"

            # stream tokens
            for ev in _stream_ollama(model=model, prompt=prompt):
                data = json.loads(ev)
                if data["type"] == "token":
                    assistantText += data["message"]
                yield ev

            # ✅ Final assistant output event
            yield json.dumps({"type": "output", "message": assistantText}) + "\n"

            if req.stream_logs:
                yield json.dumps({"type": "done", "message": "Execution finished"}) + "\n"

        except Exception as e:
            yield json.dumps({"type": "error", "message": str(e)}) + "\n"

    return StreamingResponse(generate(), media_type="application/x-ndjson")
# ---------------- helpers ----------------
def build(req: BuildRequest):
    types = [n.type for n in req.nodes]
    if types.count("query") != 1:
        raise HTTPException(status_code=400, detail="Graph must contain exactly one 'query'")
    if types.count("output") != 1:
        raise HTTPException(status_code=400, detail="Graph must contain exactly one 'output'")
    return {"ok": True}


def _greedy_path(start: str, goal: str, adj: Dict[str, List[str]]) -> List[str]:
    path = [start]
    cur = start
    visited = {cur}
    while cur != goal:
        nxts = [n for n in adj.get(cur, []) if n not in visited]
        if not nxts:
            return []
        cur = nxts[0]
        path.append(cur)
        visited.add(cur)
        if len(path) > 256:
            return []
    return path


def _stream_ollama(model: str, prompt: str):
    # Ensure model present
    try:
        resp = requests.get("http://localhost:11434/api/tags", timeout=10)
        available = [m["name"] for m in resp.json().get("models", [])]
    except Exception:
        available = []

    if model not in available:
        pull_resp = requests.post(
            "http://localhost:11434/api/pull",
            json={"name": model},
            stream=True,
            timeout=60,
        )
        for line in pull_resp.iter_lines():
            if not line:
                continue
            try:
                status = json.loads(line.decode("utf-8"))
                if "status" in status:
                    yield json.dumps({"type": "status", "message": f"Pulling {model}: {status['status']}"}) + "\n"
            except Exception:
                pass
        yield json.dumps({"type": "status", "message": f"Model {model} ready"}) + "\n"

    gen_resp = requests.post(
        "http://localhost:11434/api/generate",
        json={"model": model, "prompt": prompt},
        stream=True,
        timeout=300,
    )
    for line in gen_resp.iter_lines():
        if not line:
            continue
        try:
            chunk = json.loads(line.decode("utf-8"))
            if "response" in chunk:
                yield json.dumps({"type": "token", "message": chunk["response"]}) + "\n"
        except Exception:
            continue
