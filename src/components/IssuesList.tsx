import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import type { OfflineIssue } from "../types";
import { ArrowLeft, RefreshCw, Loader, MessageSquare } from "lucide-react";

export function IssuesList() {
  const { repoId } = useParams<{ repoId: string }>();
  const navigate = useNavigate();
  const { offlineData, repositories, syncRepository, syncStatus, pendingReplies } = useApp();

  const [filter, setFilter] = useState<"all" | "open" | "closed">("open");
  const [search, setSearch] = useState("");

  const decodedRepoId = repoId ? decodeURIComponent(repoId) : "";
  const repo = repositories.find((r) => r.id === decodedRepoId);
  const offline = offlineData.get(decodedRepoId);
  const status = syncStatus.get(decodedRepoId);
  const isSyncing = status?.syncing;

  // Count pending replies for this repository
  const repoPendingRepliesCount = pendingReplies.filter((r) => r.repoId === decodedRepoId).length;

  const filteredIssues = useMemo(() => {
    if (!offline?.issues) return [];

    let issues = [...offline.issues];

    // Filter by state
    if (filter !== "all") {
      issues = issues.filter((issue) => issue.state === filter);
    }

    // Filter by search
    if (search.trim()) {
      const query = search.toLowerCase();
      issues = issues.filter(
        (issue) =>
          issue.title.toLowerCase().includes(query) ||
          issue.body?.toLowerCase().includes(query) ||
          issue.number.toString().includes(query)
      );
    }

    // Sort by updated_at (newest first)
    issues.sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    return issues;
  }, [offline?.issues, filter, search]);

  const handleSync = async () => {
    if (!repo) return;
    try {
      await syncRepository(repo);
    } catch (error) {
      alert(`Failed to sync: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  if (!repo) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl text-gray-400 mb-4">Repository not found</div>
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Back to repositories
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/")}
              className="text-gray-400 hover:text-white transition-colors"
              title="Back to repositories"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white">{repo.full_name}</h1>
              {offline && (
                <p className="text-sm text-gray-400">
                  {offline.issues.length} issues • Last synced:{" "}
                  {new Date(offline.last_synced!).toLocaleString()}
                </p>
              )}
            </div>
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg transition-colors flex items-center gap-2 relative"
            >
              {isSyncing ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  {status?.progress || "Syncing..."}
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Sync
                  {repoPendingRepliesCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-yellow-500 text-gray-900 text-xs font-bold px-1.5 py-0.5 rounded-full min-w-5 text-center">
                      {repoPendingRepliesCount}
                    </span>
                  )}
                </>
              )}
            </button>
          </div>

          {/* Filters */}
          <div className="mt-4 flex gap-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search issues..."
              className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex bg-gray-700 rounded-lg overflow-hidden">
              {(["all", "open", "closed"] as const).map((state) => (
                <button
                  key={state}
                  onClick={() => setFilter(state)}
                  className={`px-4 py-2 text-sm capitalize transition-colors ${filter === state
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-600"
                    }`}
                >
                  {state}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Sync progress */}
      {isSyncing && status?.progress && (
        <div className="bg-blue-900/50 border-b border-blue-700 px-4 py-2">
          <div className="max-w-5xl mx-auto text-blue-300 text-sm">
            {status.progress}
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {!offline ? (
          <div className="text-center py-16">
            <div className="text-gray-400 text-lg mb-4">
              No offline data available
            </div>
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Take offline now
            </button>
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            {search || filter !== "all"
              ? "No issues match your search"
              : "No issues in this repository"}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredIssues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                pendingRepliesCount={pendingReplies.filter((r) => r.repoId === decodedRepoId && r.issueNumber === issue.number).length}
                onClick={() =>
                  navigate(
                    `/repo/${encodeURIComponent(decodedRepoId)}/issue/${issue.number}`
                  )
                }
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function IssueCard({
  issue,
  pendingRepliesCount,
  onClick,
}: {
  issue: OfflineIssue;
  pendingRepliesCount: number;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 cursor-pointer transition-colors"
    >
      <div className="flex items-start gap-3">
        {/* State icon */}
        <div
          className={`mt-1 ${issue.state === "open" ? "text-green-500" : "text-purple-500"
            }`}
        >
          {issue.state === "open" ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="12" cy="12" r="9" strokeWidth={2} />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" />
            </svg>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-white">
            <span className="text-gray-400">#{issue.number}</span> {issue.title}
          </h3>

          {/* Labels */}
          {issue.labels.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {issue.labels.map((label) => (
                <span
                  key={label.id}
                  className="px-2 py-0.5 text-xs rounded-full"
                  style={{
                    backgroundColor: `#${label.color}20`,
                    color: `#${label.color}`,
                    border: `1px solid #${label.color}50`,
                  }}
                >
                  {label.name}
                </span>
              ))}
            </div>
          )}

          {/* Meta info */}
          <div className="mt-2 flex items-center gap-3 text-sm text-gray-400">
            <span>
              opened by{" "}
              <span className="text-gray-300">{issue.user.login}</span>
            </span>
            <span>•</span>
            <span>{new Date(issue.created_at).toLocaleDateString()}</span>
            {issue.comments > 0 && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-4 h-4" />
                  {issue.comments}
                </span>
              </>
            )}
            {pendingRepliesCount > 0 && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1 text-yellow-400">
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
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {pendingRepliesCount} pending
                </span>
              </>
            )}
          </div>
        </div>

        {/* Assignees */}
        {issue.assignees.length > 0 && (
          <div className="flex -space-x-2">
            {issue.assignees.slice(0, 3).map((assignee) => (
              <img
                key={assignee.id}
                src={assignee.avatar_url}
                alt={assignee.login}
                title={assignee.login}
                className="w-6 h-6 rounded-full border-2 border-gray-800"
              />
            ))}
            {issue.assignees.length > 3 && (
              <div className="w-6 h-6 rounded-full bg-gray-700 border-2 border-gray-800 flex items-center justify-center text-xs text-gray-300">
                +{issue.assignees.length - 3}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
