import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import type { GitHubComment } from "../types";

export function IssueDetail() {
  const { repoId, issueNumber } = useParams<{
    repoId: string;
    issueNumber: string;
  }>();
  const navigate = useNavigate();
  const { offlineData, repositories } = useApp();

  const decodedRepoId = repoId ? decodeURIComponent(repoId) : "";
  const repo = repositories.find((r) => r.id === decodedRepoId);
  const offline = offlineData.get(decodedRepoId);
  const issue = offline?.issues.find(
    (i) => i.number === parseInt(issueNumber || "0")
  );

  if (!repo || !issue) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl text-gray-400 mb-4">Issue not found</div>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/repo/${encodeURIComponent(decodedRepoId)}`)}
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
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-400">{repo.full_name}</p>
              <h1 className="text-lg font-semibold text-white truncate">
                #{issue.number} {issue.title}
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Issue header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                issue.state === "open"
                  ? "bg-green-900/50 text-green-400 border border-green-700"
                  : "bg-purple-900/50 text-purple-400 border border-purple-700"
              }`}
            >
              {issue.state === "open" ? "Open" : "Closed"}
            </span>
            <span className="text-gray-400">
              <span className="text-white">{issue.user.login}</span> opened this
              issue on {new Date(issue.created_at).toLocaleDateString()}
            </span>
          </div>

          {/* Labels */}
          {issue.labels.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {issue.labels.map((label) => (
                <span
                  key={label.id}
                  className="px-2.5 py-1 text-sm rounded-full"
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

          {/* Milestone */}
          {issue.milestone && (
            <div className="text-sm text-gray-400 mb-4">
              Milestone:{" "}
              <span className="text-white">{issue.milestone.title}</span>
            </div>
          )}

          {/* Assignees */}
          {issue.assignees.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              Assignees:
              <div className="flex items-center gap-2">
                {issue.assignees.map((assignee) => (
                  <div key={assignee.id} className="flex items-center gap-1">
                    <img
                      src={assignee.avatar_url}
                      alt={assignee.login}
                      className="w-5 h-5 rounded-full"
                    />
                    <span className="text-white">{assignee.login}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Issue body */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 mb-6">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-700 bg-gray-800/50 rounded-t-xl">
            <img
              src={issue.user.avatar_url}
              alt={issue.user.login}
              className="w-8 h-8 rounded-full"
            />
            <div>
              <span className="font-medium text-white">{issue.user.login}</span>
              <span className="text-gray-400 text-sm ml-2">
                commented on {new Date(issue.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div className="p-4">
            {issue.body ? (
              <div className="prose prose-invert max-w-none">
                <MarkdownContent content={issue.body} />
              </div>
            ) : (
              <p className="text-gray-500 italic">No description provided.</p>
            )}
          </div>
        </div>

        {/* Comments */}
        {issue.comments_data && issue.comments_data.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">
              Comments ({issue.comments_data.length})
            </h2>
            {issue.comments_data.map((comment) => (
              <CommentCard key={comment.id} comment={comment} />
            ))}
          </div>
        )}

        {/* Synced info */}
        <div className="mt-8 pt-4 border-t border-gray-700 text-sm text-gray-500 text-center">
          Synced at {new Date(issue.synced_at).toLocaleString()}
        </div>
      </main>
    </div>
  );
}

function CommentCard({ comment }: { comment: GitHubComment }) {
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-700 bg-gray-800/50 rounded-t-xl">
        <img
          src={comment.user.avatar_url}
          alt={comment.user.login}
          className="w-8 h-8 rounded-full"
        />
        <div>
          <span className="font-medium text-white">{comment.user.login}</span>
          <span className="text-gray-400 text-sm ml-2">
            commented on {new Date(comment.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>
      <div className="p-4">
        <div className="prose prose-invert max-w-none">
          <MarkdownContent content={comment.body} />
        </div>
      </div>
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  // Simple markdown-like rendering
  // In a real app, you'd use a proper markdown renderer like react-markdown
  const lines = content.split("\n");
  
  return (
    <div className="whitespace-pre-wrap break-words text-gray-300">
      {lines.map((line, i) => {
        // Headers
        if (line.startsWith("### ")) {
          return (
            <h3 key={i} className="text-lg font-semibold text-white mt-4 mb-2">
              {line.slice(4)}
            </h3>
          );
        }
        if (line.startsWith("## ")) {
          return (
            <h2 key={i} className="text-xl font-semibold text-white mt-4 mb-2">
              {line.slice(3)}
            </h2>
          );
        }
        if (line.startsWith("# ")) {
          return (
            <h1 key={i} className="text-2xl font-bold text-white mt-4 mb-2">
              {line.slice(2)}
            </h1>
          );
        }
        
        // Code blocks (simple detection)
        if (line.startsWith("```")) {
          return null; // Skip code block markers
        }
        
        // List items
        if (line.match(/^[-*] /)) {
          return (
            <div key={i} className="flex gap-2 ml-2">
              <span>•</span>
              <span>{line.slice(2)}</span>
            </div>
          );
        }
        
        // Empty lines
        if (!line.trim()) {
          return <br key={i} />;
        }
        
        // Regular text
        return <div key={i}>{line}</div>;
      })}
    </div>
  );
}
