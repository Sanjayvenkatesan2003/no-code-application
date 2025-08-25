import React, { useState, useCallback } from "react";
import { ReactFlow, Background, Controls, MiniMap, addEdge } from "reactflow";
import "reactflow/dist/style.css";

// Define the available node types for our canvas
const nodeTypes = {
  userQuery: { label: "User Query" },
  knowledgeBase: { label: "KnowledgeBase" },
  llmEngine: { label: "LLM Engine" },
  output: { label: "Output" },
  webSearch: { label: "Web Search" },
};

export default function Canvas({ onSelectNode }) {
  // Store nodes (components on canvas) and edges (connections between them)
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  // Handle connecting nodes with edges
  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    []
  );

  // Handle dropping a new node from the sidebar onto the canvas
  const onDrop = useCallback((event) => {
    event.preventDefault();
    const type = event.dataTransfer.getData("application/reactflow");
    if (!type) return;

    // Position node relative to drop point
    const position = { x: event.clientX - 250, y: event.clientY - 50 };

    // Create new node with label from nodeTypes
    const newNode = {
      id: `${+new Date()}`, // unique ID based on timestamp
      type: "default",
      position,
      data: { label: nodeTypes[type].label },
    };

    // Add the new node to the list of nodes
    setNodes((nds) => nds.concat(newNode));
  }, []);

  // Allow dropping by preventing default behavior
  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // Handle clicking on a node → notify parent (App.js) so ConfigPanel updates
  const onNodeClick = (_, node) => onSelectNode(node);

  return (
    <div className="flex-1">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={setNodes}
        onEdgesChange={setEdges}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        fitView // makes sure everything fits nicely in view
      >
        {/* Background grid, MiniMap, and Controls for better UX */}
        <Background />
        <MiniMap />
        <Controls />
      </ReactFlow>
    </div>
  );
}