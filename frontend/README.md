GenAI Stack — README
Overview

GenAI Stack is a small prototype no-code stack builder:

A React frontend (React Flow) lets users visually build simple pipelines made of nodes: User Query, Knowledge Base (KB), LLM Engine, and Output.

A FastAPI backend provides CRUD for stacks (Postgres), accepts PDF uploads to populate a per-stack knowledge base, and executes the flow by streaming model output from Ollama (or another model server) to the frontend as NDJSON.

The app demonstrates streaming tokens to the UI and saving/reading stack layouts from a database.

Primary goals:

Save/load stacks (name + blocks layout).

Upload PDFs into per-stack KB (ChromaDB helper module).

Execute a flow and stream tokens back to the frontend (NDJSON).

Architecture & Flow
[React Frontend]  <--HTTP/NDJSON-->  [FastAPI backend]
       |                                     |
  UI components                           DB (Postgres)
  - Home                                 - table: stacks
  - NewStack                              id, name, blocks(JSON string)
  - StackBuilder                          (blocks stores nodes & edges)
  - ChatBox
       |
  ReactFlow (nodes & edges)
       |
  POST /execute (stream)  --> backend composes prompt, optionally queries KB, calls Ollama -> streams tokens


Key interactions:

Frontend Home.js GETs /stacks/ and displays saved stacks.

Creating a stack calls POST /stacks/. blocks are normalized and stored as JSON string.

StackBuilder loads a stack (must have id) and provides builder canvas (React Flow).

Uploading file in KB node: frontend POST /upload/{stack_id} with multipart/form-data.

Run/Chat:

Frontend POST /execute with stack_id, nodes, edges and query.

Backend determines execution path (query → kb → llm → output), fetches KB hits, constructs prompt, calls Ollama (/api/generate), streams tokens back as NDJSON lines.

Frontend reads the NDJSON stream, updates UI bubble tokens in real time.

Repository Structure (important files)
/backend
  ├─ main.py                # FastAPI app & endpoints
  ├─ database.py            # SQLAlchemy engine, Base, Stack model
  ├─ knowledge_base.py      # helper functions to add/search/clear KB (Chroma)
  ├─ .env                   # DATABASE_URL, etc.
  └─ requirements.txt
/frontend
  ├─ src/
  │   ├─ pages/
  │   │   ├─ Home.js
  │   │   ├─ NewStack.js
  │   │   └─ StackBuilder.js
  │   ├─ components/
  │   │   └─ ChatBox.js
  │   └─ App.js
  ├─ package.json
  └─ tailwind.config.js
.vscode/
  └─ launch.json            # optional: compound debug config for backend+frontend

Backend (FastAPI)
Important endpoints

GET /
Health check.

POST /stacks/
Create a new stack. Request body:

{ "name": "My Stack", "blocks": {...} }


Response: stack object with id, name, and parsed blocks.

GET /stacks/
Returns a list of stacks. Backend parses blocks JSON before returning.

GET /stacks/{id}
Get stack by id.

PUT /stacks/{id}
Update stack (saves normalized blocks JSON to DB).

DELETE /stacks/{id}

POST /upload/{stack_id} (multipart/form-data)
Accepts PDF file; extracts text (PyMuPDF / fitz) and adds embeddings/chunks to the per-stack KB (add_to_kb helper). Returns chunks_added, preview, etc.

POST /kb/clear/{stack_id}
Clear KB for that stack (helper).

POST /execute (streaming)
Accepts JSON:

{
  "stack_id": 1,
  "nodes": [{ "id": "...", "type": "...", "data": {...}}...],
  "edges": [{ "source":"...","target":"..." }, ...],
  "query":"your question",
  "stream_logs": true
}


Returns StreamingResponse with media_type="application/x-ndjson". Each line is a JSON object (NDJSON). Typical events:

{ "type": "status", "message": "..." } — optional internal info

{ "type": "context", "message": "..." } — KB retrieved

{ "type": "token", "message": "next piece of assistant text" } — tokens streaming

{ "type": "output", "message": "final assistant text" } — optional final message

{ "type": "error", "message": "..." } — errors

{ "type": "done", "message": "Execution finished" }

Backend logic in main.py:

Normalize/parse blocks.

Determine path from query node → output node using adjacency.

Fetch KB if necessary (search_kb).

Compose prompt and call _stream_ollama(model, prompt) which calls Ollama and yields NDJSON lines.

Streaming response continues until done.

Database model (SQLAlchemy)

backend/database.py (example):

Base = declarative_base()

class Stack(Base):
    __tablename__ = "stacks"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    blocks = Column(Text, nullable=False)  # JSON string


Important: blocks stored as a JSON string to preserve React Flow layout. The backend normalizes when creating/updating.

Frontend (React)

Key pages & components:

Home.js — lists stacks & preview. Fetches GET /stacks/. Displays stack.name and a short preview of parsed blocks.

NewStack.js — form to create a stack. Posts to POST /stacks/.

StackBuilder.js — main canvas using React Flow:

Defines four node types: query, kb, llm, output.

Saves layout: PUT /stacks/{id} with blocks: JSON.stringify({ nodes, edges }).

Uploads KB: POST /upload/{stack.id} (multipart).

Runs pipeline: POST /execute, reads NDJSON stream, and updates output node history with tokens.

Opens ChatBox.

ChatBox.js — modal chat for quick test interactions:

Posts POST /execute with stack_id, nodes, edges, query.

Uses ReadableStream.getReader() to read NDJSON streaming output.

Appends tokens into a single assistant bubble — auto-scroll, fixed height, user-friendly.

Notes:

The UI code intentionally filters/hides status and context events so the user sees a simple chat bubble (only tokens and final output).

The output node vs. ChatBox: handleRun updates the output node history, while the ChatBox uses its own UI bubbles.

Running Locally (development)
Prerequisites

Python 3.10+ (project used 3.11/3.13 earlier), create a venv.

Node.js & npm (for frontend).

Postgres database running and reachable.

Ollama or chosen LLM server available on localhost:11434 (or adjust backend _stream_ollama URLs).

Environment variables

Create backend/.env:

DATABASE_URL=postgresql+psycopg2://<user>:<password>@<host>:5432/<db_name>


Important: If password contains @, encode as %40. Example:

postgresql+psycopg2://postgres:my%40pass@localhost:5432/nocode_app

Backend (FastAPI)

Activate venv:

Windows PowerShell:

.\venv\Scripts\Activate.ps1


Windows cmd:

.\venv\Scripts\activate.bat


Install dependencies:

pip install -r backend/requirements.txt
# Important extras if missing:
pip install python-multipart psycopg2-binary PyMuPDF


python-multipart is required by FastAPI to parse File(...).

psycopg2-binary for PostgreSQL.

PyMuPDF (fitz) for PDF text extraction.

Run:

uvicorn backend.main:app --reload --port 8000

Frontend (React)

cd frontend

Install:

npm install


Run:

npm start


Open http://localhost:3000

Run both in VSCode with F5 (compound debug)

Create a .vscode/launch.json compound config that starts backend (python + uvicorn) and frontend (node npm start). Example:

{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Backend (FastAPI)",
      "type": "python",
      "request": "launch",
      "module": "uvicorn",
      "args": ["backend.main:app", "--reload", "--port", "8000"],
      "jinja": true
    },
    {
      "name": "Frontend (React)",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["start"],
      "cwd": "${workspaceFolder}/frontend",
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ],
  "compounds": [
    {
      "name": "Run Both (Backend + Frontend)",
      "configurations": ["Backend (FastAPI)", "Frontend (React)"]
    }
  ]
}


You can then choose Run Both (Backend + Frontend) from the VSCode Run/Debug dropdown and press F5.

If VSCode complains about missing request attribute when you try to run the compound, ensure you installed the Python and Node.js debug extensions and that the JSON is valid. Use the built-in Python extension from Microsoft.

Streaming NDJSON format (client/server contract)

Server sends newline-delimited JSON objects (each on its own line):

Example token emission sequence (client should append token strings):

{"type":"token","message":"Hello"}
{"type":"token","message":" world"}
{"type":"done","message":"Execution finished"}


Frontend parsing:

Read chunks from stream, split on \n, parse each JSON line.

Ignore empty lines.

Use a buffer for partial lines (the code samples above do this).

Common Troubleshooting & Fixes (based on your logs)

Form data requires "python-multipart" to be installed
Install:

pip install python-multipart


Error loading ASGI app. Could not import module "main".
Start uvicorn with the correct module path:

uvicorn backend.main:app --reload


Run from repo root.

Postgres connection problems

If your password includes @, encode it as %40.

Make sure DATABASE_URL exists in backend/.env and is loaded by load_dotenv.

pipwin / js2py errors

pipwin isn't necessary unless you need Windows-specific binaries. Use pip install with wheels where possible.

For js2py issues, avoid installing it unless required.

RuntimeError: Your python version made changes to the bytecode (from js2py)

That error came from js2py being incompatible with your Python version. Uninstall js2py if you don't need it:

pip uninstall js2py pipwin


Upload returns Upload failed: [object Object]

Frontend likely attempted to display a parsed JSON object as a string. Update the upload handler to await res.json() and display detail or error. (The updated handleUpload in StackBuilder.js does this.)

No streaming response / Error contacting backend

Confirm backend logs. Perhaps _stream_ollama cannot reach model server. Check localhost:11434 or change _stream_ollama to match your model host.

Check network tab to see HTTP status or error body.

Stack shows only "string" in UI

Ensure Home.js displays stack.name and stack.blocks is parsed. Backend now returns parsed blocks JSON in GET /stacks/. Use stack.blocks safely (may be object or string).

UX / Implementation notes & suggestions

Show only tokens in chat UI: hide status and context events to keep chat clean. Show only token/output/error. (Updated ChatBox code does this.)

Fixed-height chat box: make chat scrollable with overflow-y:auto and a fixed height (ChatBox updated).

DB blocks storage: store blocks as JSON string; use normalized parse/serialize in API so DB always has valid JSON string.

Be careful with OSS LLM endpoint design: Ollama pulling models can take long; avoid showing lengthy pull logs to end users — show minimal progress or a spinner.

Example curl tests

Create stack:

curl -X POST http://127.0.0.1:8000/stacks/ \
  -H "Content-Type: application/json" \
  -d '{"name":"test","blocks":{"description":"hello"}}'


Get stacks:

curl http://127.0.0.1:8000/stacks/


Execute (non-stream test):

curl -X POST http://127.0.0.1:8000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "stack_id": 1,
    "nodes": [{"id":"1","type":"query","data":{"value":"Hello"}} , {"id":"2","type":"output","data":{}} ],
    "edges": [{"source":"1","target":"2"}],
    "query":"Hello",
    "stream_logs": false
  }'


(Streaming responses are best observed with the browser or a tool that supports streaming—curl will print chunks but may buffer.)

Future improvements (ideas)

Add authentication + per-user stacks.

Persist KB metadata and store embeddings/references in Chroma/SQLite/Vector DB with robust indexing.

WebSocket alternative for nicer bi-directional streaming.

UI: allow editing saved node data on the canvas, visualize KB hits inline, and include model health/status in a small indicator rather than chat logs.

Add unit & integration tests for core endpoints (execute / upload).

Quick checklist to get everything working (summary)

Set up Postgres; create backend/.env with proper DATABASE_URL.

In backend venv:

pip install -r backend/requirements.txt
pip install python-multipart psycopg2-binary PyMuPDF


Start backend:

uvicorn backend.main:app --reload --port 8000


From frontend/:

npm install
npm start


Use Home -> New Stack -> save stack (ensures id exists) -> open StackBuilder -> add KB or run chat.

If you want, I can:

Produce a final README.md file ready to paste into your repo (I can paste the exact markdown here).

Or modify / produce the launch.json file exactly for your workspace.

Or walk through one specific error you still see (paste backend logs + network response body) and I’ll point to the exact line to fix.