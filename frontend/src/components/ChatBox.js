// src/components/ChatBox.js
import React, { useState, useEffect, useRef } from "react";

/**
 * ChatBox calls /execute with the provided stack/nodes/edges.
 * Props:
 * - onClose: () => void
 * - stack: the stack object (must include id)
 * - nodes: React Flow nodes
 * - edges: React Flow edges
 */
export default function ChatBox({ onClose, stack, nodes, edges }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);

  // ref for auto-scroll
  const messagesEndRef = useRef(null);

  // helper to append messages
  const append = (msg) => setMessages((m) => [...m, msg]);

  // auto-scroll when new messages are added
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // handle sending message
  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    if (!stack?.id) {
      alert("Please save the stack first (it needs an id).");
      return;
    }

    setInput("");
    append({ text, sender: "user" }); // add user message

    // start backend request
    setRunning(true);
    // Add a temporary assistant message (we will overwrite it when tokens arrive)
    append({ text: "…", sender: "ai", temp: true });

    try {
      const resp = await fetch("http://127.0.0.1:8000/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stack_id: stack.id,
          nodes,
          edges,
          query: text,
          stream_logs: true,
        }),
      });

      if (!resp.ok) {
        // try to parse JSON body for error
        let errText = `HTTP ${resp.status}`;
        try {
          const body = await resp.json();
          errText = body.detail || body.error || JSON.stringify(body);
        } catch (e) {
          const t = await resp.text();
          if (t) errText = t;
        }
        // remove temp assistant message
        setMessages((m) => m.filter((mm) => !mm.temp));
        append({ text: `❌ ${errText}`, sender: "ai" });
        setRunning(false);
        return;
      }

      if (!resp.body) {
        setMessages((m) => m.filter((mm) => !mm.temp));
        append({ text: "❌ No streaming body from server", sender: "ai" });
        setRunning(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";

      // Remove the temp placeholder (we'll add real assistant updates)
      setMessages((m) => m.filter((mm) => !mm.temp));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // split complete lines, leave remainder in buffer
        const parts = buffer.split("\n");
        buffer = parts.pop(); // remainder

        for (const line of parts) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const ev = JSON.parse(trimmed);

            // Only show token & output; ignore status/context.
            if (ev.type === "token") {
              // accumulate tokens and replace current assistant message
              assistantText += ev.message;
              setMessages((m) => {
                // remove previous assistant message (if any)
                const withoutAssistant = m.filter((mm) => mm.sender !== "ai");
                return [...withoutAssistant, { text: assistantText, sender: "ai" }];
              });
            } else if (ev.type === "output") {
              // final assistant output (some backends may send this)
              // replace any streaming assistant message with final
              setMessages((m) => {
                const withoutAssistant = m.filter((mm) => mm.sender !== "ai");
                return [...withoutAssistant, { text: ev.message, sender: "ai" }];
              });
            } else if (ev.type === "error") {
              append({ text: `❌ ${ev.message}`, sender: "ai" });
            }
            // ignore status/context/done so UI stays clean
          } catch (err) {
            console.warn("parse error", err, line);
          }
        }
      }

      // in case some remainder contains a final JSON line
      if (buffer.trim()) {
        try {
          const ev = JSON.parse(buffer);
          if (ev.type === "output") {
            setMessages((m) => {
              const withoutAssistant = m.filter((mm) => mm.sender !== "ai");
              return [...withoutAssistant, { text: ev.message, sender: "ai" }];
            });
          }
        } catch (e) {
          // ignore
        }
      }
    } catch (err) {
      console.error(err);
      // remove temp placeholder
      setMessages((m) => m.filter((mm) => !mm.temp));
      append({ text: "❌ Error contacting backend", sender: "ai" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 text-gray-100 w-3/4 max-w-2xl rounded-lg shadow-lg flex flex-col">
        {/* ---------- Header ---------- */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="font-bold text-lg">GenAI Stack Chat</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg">
            ✕
          </button>
        </div>

        {/* ---------- Messages Area ---------- */}
        <div
          className="p-4 space-y-3 overflow-y-auto"
          style={{ height: "520px" }} // slightly larger and fixed with scroll
        >
          {messages.length === 0 && (
            <p className="text-gray-500 text-center">Start a conversation to test your stack</p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex items-end gap-2 ${m.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.sender === "ai" && <span className="text-2xl">🤖</span>}
              <div
                className={`px-4 py-2 rounded-2xl max-w-[70%] text-sm shadow ${
                  m.sender === "user" ? "bg-green-600 text-white rounded-br-none" : "bg-gray-700 text-gray-100 rounded-bl-none"
                }`}
              >
                {m.text}
              </div>
              {m.sender === "user" && <span className="text-2xl">💻</span>}
            </div>
          ))}
          {/* scroll anchor */}
          <div ref={messagesEndRef} />
        </div>

        {/* ---------- Input Box ---------- */}
        <div className="p-3 border-t border-gray-700 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Send a message..."
            className="flex-1 border border-gray-600 rounded-lg px-3 py-2 bg-gray-800 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            disabled={running}
          />
          <button
            onClick={handleSend}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            disabled={running}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

