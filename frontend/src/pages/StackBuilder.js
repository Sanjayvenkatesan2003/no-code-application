// src/pages/StackBuilder.js
import React, { useState, useCallback } from "react";
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";

import {
  FiSave,
  FiPlay,
  FiBookOpen,
  FiDatabase,
  FiCpu,
  FiMessageSquare,
} from "react-icons/fi";
import ChatBox from "../components/ChatBox";

// ---- Custom Node Components ----
const nodeTypes = {
  query: ({ data }) => (
    <div className="p-4 w-48 bg-blue-700 text-white rounded shadow">
      <h3 className="font-semibold mb-2">User Query</h3>
      <input
        type="text"
        placeholder="Ask something..."
        value={data.value || ""}
        onChange={(e) => data.onChange?.(e.target.value)}
        className="w-full px-2 py-1 rounded bg-blue-600 border border-blue-400 text-sm"
      />
    </div>
  ),
  kb: ({ data }) => (
    <div className="p-4 w-56 bg-purple-700 text-white rounded shadow">
      <h3 className="font-semibold mb-2">Knowledge Base</h3>
      <input
        type="file"
        accept="application/pdf"
        className="w-full text-xs"
        onChange={(e) => data.onUpload?.(e.target.files[0], data.embedModel || "mini")}
      />
      <select
        value={data.embedModel || "mini"}
        onChange={(e) => data.onEmbedModelChange?.(e.target.value)}
        className="w-full mt-2 px-2 py-1 rounded bg-purple-600 border border-purple-400 text-xs"
      >
        <option value="mini">MiniLM</option>
        <option value="mpnet">MPNet</option>
      </select>
      <pre className="mt-2 text-[10px] bg-purple-600 p-1 rounded max-h-24 overflow-y-auto whitespace-pre-wrap">
        {data.preview || ""}
      </pre>
    </div>
  ),
  llm: ({ data }) => (
    <div className="p-4 w-56 bg-green-700 text-white rounded shadow">
      <h3 className="font-semibold mb-2">LLM Engine</h3>
      <select
        value={data.model || "llama3"}
        onChange={(e) => data.onModelChange?.(e.target.value)}
        className="w-full px-2 py-1 rounded bg-green-600 border border-green-400 mb-2 text-sm"
      >
        <option value="llama3">🦙 LLaMA 3</option>
        <option value="mistral">🌪️ Mistral</option>
        <option value="gemma">💎 Gemma</option>
        <option value="phi3">🧠 Phi-3</option>
        <option value="codellama">💻 CodeLLaMA</option>
      </select>
      <textarea
        placeholder="Prompt..."
        value={data.prompt || ""}
        onChange={(e) => data.onPromptChange?.(e.target.value)}
        className="w-full px-2 py-1 rounded bg-green-600 border border-green-400 text-sm"
      />
    </div>
  ),
  output: ({ data }) => (
    <div className="p-4 w-64 bg-gray-700 text-white rounded shadow h-64 overflow-y-auto">
      <h3 className="font-semibold mb-2">Output</h3>
      {data.history?.map((msg, idx) => (
        <div
          key={idx}
          className={`px-2 py-1 rounded mb-1 max-w-[90%] ${
            msg.role === "user"
              ? "bg-blue-600 ml-auto text-right"
              : msg.role === "assistant"
              ? "bg-green-600"
              : "bg-gray-600 text-xs"
          }`}
        >
          {msg.content}
        </div>
      ))}
    </div>
  ),
};

export default function StackBuilder({ stack }) {
  // ---- State ----
  const [nodes, setNodes, onNodesChange] = useNodesState([
    { id: "1", type: "query", position: { x: 0, y: 50 }, data: {} },
    { id: "2", type: "kb", position: { x: 250, y: 50 }, data: { embedModel: "mini" } },
    { id: "3", type: "llm", position: { x: 500, y: 50 }, data: {} },
    { id: "4", type: "output", position: { x: 750, y: 50 }, data: { history: [] } },
  ]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([
    { id: "e1-2", source: "1", target: "2" },
    { id: "e2-3", source: "2", target: "3" },
    { id: "e3-4", source: "3", target: "4" },
  ]);
  const [chatOpen, setChatOpen] = useState(false);

  // ---- Node Handlers ----
  const updateNodeData = (id, newData) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...newData } } : n))
    );
  };

  const handleUpload = async (file, id, embedModel) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("embed_model", embedModel);

    try {
      const res = await fetch(`http://127.0.0.1:8000/upload/${stack.id}?embed_model=${embedModel}`, {
        method: "POST",
        body: formData,
      });

      let data;
      try {
        data = await res.json();
      } catch (e) {
        data = { detail: await res.text() };
      }

      updateNodeData(id, {
        preview: res.ok
          ? `✅ ${data.filename}\n📚 ${data.chunks_added} chunks\n\n${data.preview}`
          : `❌ Upload failed: ${data.detail || data.error || JSON.stringify(data)}`,
      });
    } catch (err) {
      updateNodeData(id, {
        preview: `❌ Upload failed: ${err.message}`,
      });
    }
  };

  // ---- Connect Edges ----
  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // ---- Save Layout ----
  const handleSave = async () => {
    if (!stack?.id) {
      alert("❌ Cannot save — stack ID missing!");
      return;
    }
    await fetch(`http://127.0.0.1:8000/stacks/${stack.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: stack.name,
        blocks: JSON.stringify({ nodes, edges }),
      }),
    });
    alert("✅ Stack saved!");
  };

  // ---- Run Workflow (NDJSON JSON events) ----
  const handleRun = async () => {
    const queryNode = nodes.find((n) => n.type === "query");
    const outputNode = nodes.find((n) => n.type === "output");

    if (!queryNode?.data?.value) {
      alert("⚠️ Please enter a query in User Query node.");
      return;
    }

    // add user query to output history
    updateNodeData(outputNode.id, {
      history: [
        ...(outputNode.data.history || []),
        { role: "user", content: queryNode.data.value },
      ],
    });

    try {
      const response = await fetch("http://127.0.0.1:8000/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stack_id: stack?.id,
          nodes,
          edges,
          query: queryNode.data.value,
          stream_logs: true,
        }),
      });

      if (!response.ok) {
        const txt = await response.text();
        updateNodeData(outputNode.id, {
          history: [
            ...(outputNode.data.history || []),
            { role: "system", content: `❌ Exec error: ${txt}` },
          ],
        });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantMsg = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // split lines
        const lines = buffer.split("\n");
        buffer = lines.pop(); // remainder

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);

            // ignore status/context to keep UI clean
            if (event.type === "token") {
              assistantMsg += event.message;
              const withoutAssistant = (outputNode.data.history || []).filter((m) => m.role !== "assistant");
              updateNodeData(outputNode.id, {
                history: [
                  ...withoutAssistant,
                  { role: "assistant", content: assistantMsg },
                ],
              });
            } else if (event.type === "output") {
              // final assistant output
              updateNodeData(outputNode.id, {
                history: [
                  ...(outputNode.data.history || []).filter((m) => m.role !== "assistant"),
                  { role: "assistant", content: event.message },
                ],
              });
            } else if (event.type === "error") {
              updateNodeData(outputNode.id, {
                history: [
                  ...(outputNode.data.history || []),
                  { role: "system", content: `❌ ${event.message}` },
                ],
              });
            }
            // skip status/context/done events
          } catch (err) {
            console.warn("⚠️ Failed to parse event:", line);
          }
        }
      }

      // try parse any leftover buffer
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer);
          if (event.type === "output") {
            updateNodeData(outputNode.id, {
              history: [
                ...(outputNode.data.history || []).filter((m) => m.role !== "assistant"),
                { role: "assistant", content: event.message },
              ],
            });
          }
        } catch (e) {
          // ignore
        }
      }
    } catch (err) {
      updateNodeData(outputNode.id, {
        history: [
          ...(outputNode.data.history || []),
          { role: "system", content: "❌ Error running stack" },
        ],
      });
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 border-r border-gray-700 p-4">
        <h2 className="font-bold text-lg mb-4">
          {stack?.name || "Untitled Stack"}
        </h2>
        <h3 className="text-sm font-semibold mb-2">Components</h3>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2 text-blue-400">
            <FiBookOpen /> User Query
          </div>
          <div className="flex items-center gap-2 text-purple-400">
            <FiDatabase /> Knowledge Base
          </div>
          <div className="flex items-center gap-2 text-green-400">
            <FiCpu /> LLM Engine
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <FiMessageSquare /> Output
          </div>
        </div>

        {/* Quick add nodes */}
        <div className="mt-4 space-y-2">
          <button
            onClick={() =>
              setNodes((prev) => [
                ...prev,
                {
                  id: Date.now().toString(),
                  type: "kb",
                  position: { x: 200, y: 200 },
                  data: { embedModel: "mini" },
                },
              ])
            }
            className="px-2 py-1 bg-purple-600 text-xs rounded"
          >
            + Add KB
          </button>
          <button
            onClick={() =>
              setNodes((prev) => [
                ...prev,
                {
                  id: (Date.now() + 1).toString(),
                  type: "llm",
                  position: { x: 400, y: 200 },
                  data: {},
                },
              ])
            }
            className="px-2 py-1 bg-green-600 text-xs rounded"
          >
            + Add LLM
          </button>
        </div>
      </aside>

      {/* Canvas */}
      <main className="flex-1 relative">
        <ReactFlow
          nodes={nodes.map((n) => {
            if (n.type === "query") {
              n.data.onChange = (val) => updateNodeData(n.id, { value: val });
            }
            if (n.type === "kb") {
              n.data.onUpload = (file, m) => handleUpload(file, n.id, m);
              n.data.onEmbedModelChange = (m) => updateNodeData(n.id, { embedModel: m });
            }
            if (n.type === "llm") {
              n.data.onModelChange = (m) => updateNodeData(n.id, { model: m });
              n.data.onPromptChange = (p) => updateNodeData(n.id, { prompt: p });
            }
            return n;
          })}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          snapToGrid
        >
          <MiniMap />
          <Controls />
          <Background gap={16} />
        </ReactFlow>
      </main>

      {/* Buttons */}
      <button
        onClick={handleSave}
        className="absolute top-4 right-4 flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg shadow hover:bg-gray-700"
      >
        <FiSave /> Save
      </button>

      <div className="absolute bottom-4 right-4 flex gap-4">
        <button
          onClick={handleRun}
          className="w-14 h-14 rounded-full bg-green-600 text-white flex items-center justify-center shadow-lg hover:bg-green-700"
        >
          <FiPlay size={24} />
        </button>
        <button
          onClick={() => setChatOpen(true)}
          className="w-14 h-14 rounded-full bg-gray-700 text-white flex items-center justify-center shadow-lg hover:bg-gray-600"
        >
          <FiMessageSquare size={24} />
        </button>
      </div>

      {chatOpen && (
        <ChatBox onClose={() => setChatOpen(false)} stack={stack} nodes={nodes} edges={edges} />
      )}
    </div>
  );
}
