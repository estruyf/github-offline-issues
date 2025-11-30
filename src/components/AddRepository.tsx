import { useState } from "react";
import { useApp } from "../context/AppContext";
import { searchRepositories } from "../services/github";

interface SearchResult {
  owner: string;
  name: string;
  full_name: string;
  description: string;
}

export function AddRepository({ onClose }: { onClose: () => void }) {
  const { token, addRepository } = useApp();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !token) return;

    setIsSearching(true);
    setError("");

    try {
      const repos = await searchRepositories(query.trim(), token);
      setResults(repos);
    } catch (err) {
      setError("Failed to search repositories");
    } finally {
      setIsSearching(false);
    }
  };

  const handleAdd = async (result: SearchResult) => {
    setIsAdding(true);
    try {
      await addRepository(result.owner, result.name);
      onClose();
    } catch (err) {
      setError("Failed to add repository");
    } finally {
      setIsAdding(false);
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const parts = query.split("/");
    if (parts.length === 2) {
      setIsAdding(true);
      try {
        await addRepository(parts[0].trim(), parts[1].trim());
        onClose();
      } catch (err) {
        setError("Failed to add repository");
      } finally {
        setIsAdding(false);
      }
    } else {
      setError("Enter repository in format: owner/repo");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Add Repository</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <form onSubmit={handleSearch} className="space-y-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search or enter owner/repo..."
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSearching || !query.trim()}
                className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
              >
                {isSearching ? "Searching..." : "Search"}
              </button>
              <button
                type="button"
                onClick={handleManualAdd}
                disabled={isAdding || !query.includes("/")}
                className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
              >
                {isAdding ? "Adding..." : "Add Directly"}
              </button>
            </div>
          </form>

          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-2">
              {results.map((result) => (
                <div
                  key={result.full_name}
                  className="p-3 bg-gray-700 rounded-lg flex items-center justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-white truncate">
                      {result.full_name}
                    </div>
                    {result.description && (
                      <div className="text-sm text-gray-400 truncate">
                        {result.description}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleAdd(result)}
                    disabled={isAdding}
                    className="ml-3 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
