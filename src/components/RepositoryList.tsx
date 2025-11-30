import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { AddRepository } from "./AddRepository";

export function RepositoryList() {
  const navigate = useNavigate();
  const {
    user,
    repositories,
    offlineData,
    syncStatus,
    logout,
    removeRepository,
    syncRepository,
  } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleRemove = async (repoId: string) => {
    if (!confirm("Are you sure you want to remove this repository?")) return;
    setRemovingId(repoId);
    try {
      await removeRepository(repoId);
    } finally {
      setRemovingId(null);
    }
  };

  const handleSync = async (repo: (typeof repositories)[0]) => {
    try {
      await syncRepository(repo);
    } catch (error) {
      alert(`Failed to sync: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">GitHub Issues Offline</h1>
          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-2">
                <img
                  src={user.avatar_url}
                  alt={user.login}
                  className="w-8 h-8 rounded-full"
                />
                <span className="text-gray-300 text-sm">{user.login}</span>
              </div>
            )}
            <button
              onClick={logout}
              className="px-3 py-1.5 text-sm text-gray-300 hover:text-white transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Repositories</h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Repository
          </button>
        </div>

        {repositories.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-gray-400 text-lg mb-4">
              No repositories added yet
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Add your first repository
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {repositories.map((repo) => {
              const offline = offlineData.get(repo.id);
              const status = syncStatus.get(repo.id);
              const isSyncing = status?.syncing;

              return (
                <div
                  key={repo.id}
                  className="bg-gray-800 rounded-xl p-5 border border-gray-700"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3
                        className="text-lg font-semibold text-white hover:text-blue-400 cursor-pointer truncate"
                        onClick={() => navigate(`/repo/${encodeURIComponent(repo.id)}`)}
                      >
                        {repo.full_name}
                      </h3>
                      <div className="mt-2 flex items-center gap-4 text-sm text-gray-400">
                        {offline ? (
                          <>
                            <span className="flex items-center gap-1">
                              <svg
                                className="w-4 h-4 text-green-500"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                              Available offline
                            </span>
                            <span>{offline.issues.length} issues</span>
                            <span>
                              Last synced:{" "}
                              {new Date(offline.last_synced!).toLocaleString()}
                            </span>
                          </>
                        ) : (
                          <span className="text-yellow-500">Not synced yet</span>
                        )}
                      </div>
                      {isSyncing && status.progress && (
                        <div className="mt-2 text-sm text-blue-400">
                          {status.progress}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => navigate(`/repo/${encodeURIComponent(repo.id)}`)}
                        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
                      >
                        View Issues
                      </button>
                      <button
                        onClick={() => handleSync(repo)}
                        disabled={isSyncing}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white text-sm rounded transition-colors flex items-center gap-1"
                      >
                        {isSyncing ? (
                          <>
                            <svg
                              className="w-4 h-4 animate-spin"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                              />
                            </svg>
                            Syncing...
                          </>
                        ) : (
                          <>
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                              />
                            </svg>
                            {offline ? "Re-sync" : "Take Offline"}
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleRemove(repo.id)}
                        disabled={removingId === repo.id}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white text-sm rounded transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {showAddModal && <AddRepository onClose={() => setShowAddModal(false)} />}
    </div>
  );
}
