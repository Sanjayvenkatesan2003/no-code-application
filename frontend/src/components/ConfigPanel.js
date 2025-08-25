import React from "react";

//  This component shows the settings for whichever node the user selects
// Example: If user clicks "LLM Engine" node, we show options to change its model & temperature
export default function ConfigPanel({ selectedNode, onUpdateNode }) {
  
  // 👉 If the user hasn’t selected a node yet, just show a simple message
  if (!selectedNode) {
    return (
      <div className="w-64 border-l bg-gray-50 p-4">
        <h3 className="font-semibold mb-2">Config Panel</h3>
        <p className="text-sm text-gray-500">Click a node to see its settings here</p>
      </div>
    );
  }

  // Handles when the user types or selects something inside the panel
  // Example: changing model from GPT → Gemini
  const handleChange = (event) => {
    const { name, value } = event.target;
    // Call back to parent App.js, so it updates the "selectedNode" with new values
    onUpdateNode(selectedNode.id, { ...selectedNode.data, [name]: value });
  };

  return (
    <div className="w-64 border-l bg-gray-50 p-4">
      {/* Show which node is being configured */}
      <h3 className="font-semibold mb-4">{selectedNode.data.label} Settings</h3>

      {/*  If the node is an LLM Engine, show controls specific to AI models */}
      {selectedNode.data.label === "LLM Engine" && (
        <>
          {/* Dropdown to pick which model this node should use */}
          <label className="text-sm">Model</label>
          <select
            name="model"
            value={selectedNode.data.model || "GPT"} // If no model yet, default to GPT
            onChange={handleChange}
            className="w-full border rounded p-1 mb-3"
          >
            <option value="GPT">GPT</option>
            <option value="Gemini">Gemini</option>
          </select>

          {/* Input box to set creativity level (temperature) */}
          <label className="text-sm">Temperature</label>
          <input
            type="number"
            name="temperature"
            value={selectedNode.data.temperature || "0.7"} // Default is 0.7
            onChange={handleChange}
            className="w-full border rounded p-1 mb-3"
          />
        </>
      )}
    </div>
  );
}
