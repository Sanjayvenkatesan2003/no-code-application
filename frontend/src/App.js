// src/App.js
import React, { useState } from "react";
import axios from "axios";

import Home from "./pages/Home";
import NewStack from "./pages/NewStack";
import StackBuilder from "./pages/StackBuilder";

import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

function App() {
  // ------------------ STATE ------------------
  const [currentPage, setCurrentPage] = useState("home");  // which page is active
  const [activeStack, setActiveStack] = useState(null);    // currently selected stack

  // ------------------ SAVE STACK ------------------
  const saveStack = async () => {
    if (!activeStack) return;

    try {
      // POST request to backend → create or update stack
      const response = await axios.post("http://127.0.0.1:8000/stacks/", {
        name: activeStack.name,
        blocks: JSON.stringify({ example: "flow data" }) // TODO: replace with real blocks later
      });

      alert("✅ Stack saved: " + response.data.name);
      setCurrentPage("home");  // after saving, go back to home
    } catch (error) {
      console.error("❌ Error saving stack:", error);
      alert("Failed to save stack");
    }
  };

  // ------------------ RENDER ------------------
  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex flex-col h-screen w-screen bg-gray-900 text-gray-100">

        {/* ---------------- NAVBAR ---------------- */}
        <header className="flex justify-between items-center px-6 py-3 bg-gray-800 shadow-md">
          <h1 className="font-bold text-lg text-white">GenAI Stack</h1>

          <nav className="flex space-x-6">
            {/* Navigate to Home */}
            <button
              className="hover:text-green-400 transition"
              onClick={() => setCurrentPage("home")}
            >
              My Stacks
            </button>

            {/* Navigate to NewStack */}
            <button
              className="hover:text-green-400 transition"
              onClick={() => setCurrentPage("newstack")}
            >
              New Stack
            </button>

            {/* Show Save only in Builder */}
            {currentPage === "builder" && (
              <button
                onClick={saveStack}
                className="bg-green-600 px-3 py-1 rounded-lg hover:bg-green-700 transition"
              >
                Save Stack
              </button>
            )}
          </nav>
        </header>

        {/* ---------------- PAGE SWITCHER ---------------- */}
        {currentPage === "home" && (
          <Home
            // when user clicks +NewStack
            onNewStack={() => setCurrentPage("newstack")}
            // when user clicks a stack card → open in builder
            onOpenStack={(stack) => {
              setActiveStack(stack);
              setCurrentPage("builder");
            }}
          />
        )}

        {currentPage === "newstack" && (
          <NewStack
            // cancel → back to home
            onCancel={() => setCurrentPage("home")}
            // create stack → go to builder with new stack
            onCreateStack={(stack) => {
              setActiveStack(stack);
              setCurrentPage("builder");
            }}
          />
        )}

        {currentPage === "builder" && activeStack && (
          <StackBuilder stack={activeStack} />
        )}
      </div>
    </DndProvider>
  );
}

export default App;
