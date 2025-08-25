// src/pages/Home.js
import React, { useEffect, useState } from "react";
import axios from "axios";

function Home({ onNewStack, onOpenStack }) {
  const [stacks, setStacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStacks = async () => {
      try {
        const response = await axios.get("http://127.0.0.1:8000/stacks/");
        setStacks(response.data);
      } catch (err) {
        setError("Unable to load stacks. Please try again.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchStacks();
  }, []);

  if (loading) return <p className="p-4">Loading stacks...</p>;
  if (error) return <p className="p-4 text-red-400">{error}</p>;

  return (
    <div className="p-6">
      {/* ---------------- HEADER ---------------- */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">My Stacks</h2>
        <button
          onClick={onNewStack}
          className="bg-green-600 px-4 py-2 rounded-lg hover:bg-green-700 transition"
        >
          + New Stack
        </button>
      </div>

      {/* ---------------- STACK LIST ---------------- */}
      {stacks.length === 0 ? (
        <p className="text-gray-400">
          No stacks available. Create your first one.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stacks.map((stack) => {
            let preview = "";
            if (stack.blocks?.nodes?.length > 0) {
              preview = stack.blocks.nodes[0].data?.value || "";
            } else {
              preview = "No preview available";
            }

            return (
              <div
                key={stack.id}
                className="p-4 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700 transition"
                onClick={() => onOpenStack(stack.id)}
              >
                <h3 className="font-semibold text-lg">{stack.name}</h3>
                <p className="text-sm text-gray-400">{preview}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Home;
