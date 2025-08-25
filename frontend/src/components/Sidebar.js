import React from "react";

// A list of available components (nodes) that the user can drag onto the canvas.
// Each component has a name and a color style so they are visually distinct.
const components = [
  { name: "User Query", color: "bg-blue-500" },
  { name: "KnowledgeBase", color: "bg-green-500" },
  { name: "LLM Engine", color: "bg-purple-500" },
  { name: "Output", color: "bg-orange-500" },
  { name: "Web Search", color: "bg-pink-500" },
];

export default function Sidebar() {
  return (
    <div className="w-60 bg-gray-100 p-4 border-r h-full">
      {/* Sidebar title */}
      <h2 className="text-lg font-semibold mb-4">Components</h2>

      {/* Render each component block inside the sidebar */}
      <div className="space-y-3">
        {components.map((comp) => (
          <div
            key={comp.name} // React requires a unique key for lists
            className={`${comp.color} text-white font-medium px-4 py-2 rounded-lg shadow cursor-pointer hover:opacity-90 transition`}
            draggable // Allows the user to drag this block onto the canvas
          >
            {comp.name}
          </div>
        ))}
      </div>
    </div>
  );
}
