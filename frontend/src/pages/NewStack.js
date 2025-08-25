// src/pages/NewStack.js
import React, { useState } from "react";
import axios from "axios";

export default function NewStack({ onCreateStack, onCancel }) {
  // ---------------- STATE ----------------
  const [stackName, setStackName] = useState("");
  const [stackDescription, setStackDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ---------------- HANDLER ----------------
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stackName.trim()) {
      setError("Please enter a stack name");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 👇 Call backend API
      const response = await axios.post("http://127.0.0.1:8000/stacks/", {
        name: stackName,
        blocks: JSON.stringify({
          description: stackDescription, // put description inside blocks JSON
        }),
      });

      // Pass saved stack back to App.js
      onCreateStack(response.data);
    } catch (err) {
      console.error(err);
      setError("❌ Failed to save stack to backend");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- UI ----------------
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      {/* ---------------- HEADER ---------------- */}
      <header className="flex justify-between items-center px-6 py-3 bg-gray-800 border-b border-gray-700 shadow-sm">
        <h1 className="text-xl font-bold">Create a New Stack</h1>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-200 font-medium"
        >
          Cancel
        </button>
      </header>

      {/* ---------------- MAIN CONTENT ---------------- */}
      <main className="flex justify-center items-start flex-1 p-10">
        <div className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-8 w-full max-w-lg">
          <h2 className="text-2xl font-semibold mb-6">Stack Details</h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Stack Name */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Stack Name
              </label>
              <input
                type="text"
                value={stackName}
                onChange={(e) => setStackName(e.target.value)}
                placeholder="Enter a name for your stack"
                className="w-full border border-gray-600 bg-gray-900 text-gray-100 rounded-lg p-3 focus:ring-2 focus:ring-green-500 focus:outline-none"
                required
              />
            </div>

            {/* Stack Description */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Description
              </label>
              <textarea
                value={stackDescription}
                onChange={(e) => setStackDescription(e.target.value)}
                placeholder="Briefly describe your stack"
                rows={4}
                className="w-full border border-gray-600 bg-gray-900 text-gray-100 rounded-lg p-3 focus:ring-2 focus:ring-green-500 focus:outline-none"
              />
            </div>

            {/* Error */}
            {error && <p className="text-red-400">{error}</p>}

            {/* Buttons */}
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={onCancel}
                className="px-5 py-2 rounded-lg border border-gray-600 bg-gray-700 hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? "Saving..." : "Create Stack"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
