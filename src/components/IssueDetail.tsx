import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import type { GitHubComment, PendingReply } from "../types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
// Import only commonly used languages to reduce bundle size
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import jsx from "react-syntax-highlighter/dist/esm/languages/prism/jsx";
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import markdown from "react-syntax-highlighter/dist/esm/languages/prism/markdown";
import css from "react-syntax-highlighter/dist/esm/languages/prism/css";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import rust from "react-syntax-highlighter/dist/esm/languages/prism/rust";
import yaml from "react-syntax-highlighter/dist/esm/languages/prism/yaml";
import { ArrowLeft, ExternalLink, Send, Trash2, CornerDownRight, XCircle, CheckCircle, Tag, X, Check } from "lucide-react";
import { getCachedImageAsDataUrl } from "../services/imageCache";

// Register languages
SyntaxHighlighter.registerLanguage("javascript", javascript);
SyntaxHighlighter.registerLanguage("js", javascript);
SyntaxHighlighter.registerLanguage("typescript", typescript);
SyntaxHighlighter.registerLanguage("ts", typescript);
SyntaxHighlighter.registerLanguage("jsx", jsx);
SyntaxHighlighter.registerLanguage("tsx", tsx);
SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("bash", bash);
SyntaxHighlighter.registerLanguage("shell", bash);
SyntaxHighlighter.registerLanguage("sh", bash);
SyntaxHighlighter.registerLanguage("markdown", markdown);
SyntaxHighlighter.registerLanguage("md", markdown);
SyntaxHighlighter.registerLanguage("css", css);
SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("py", python);
SyntaxHighlighter.registerLanguage("rust", rust);
SyntaxHighlighter.registerLanguage("rs", rust);
SyntaxHighlighter.registerLanguage("yaml", yaml);
SyntaxHighlighter.registerLanguage("yml", yaml);

export function IssueDetail() {
  const { repoId, issueNumber } = useParams<{
    repoId: string;
    issueNumber: string;
  }>();
  const navigate = useNavigate();
  const {
    offlineData,
    repositories,
    pendingReplies,
    addPendingReply,
    removePendingReply,
    pendingStateChanges,
    pendingLabelUpdates,
    repositoryLabels,
    addPendingStateChange,
    removePendingStateChange,
    addPendingLabelUpdate,
    getEffectiveIssueState,
    getEffectiveIssueLabels,
    fetchLabelsForRepo,
  } = useApp();
  const [replyText, setReplyText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLabelEditor, setShowLabelEditor] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);

  const decodedRepoId = repoId ? decodeURIComponent(repoId) : "";
  const repo = repositories.find((r) => r.id === decodedRepoId);
  const offline = offlineData.get(decodedRepoId);
  const issue = offline?.issues.find(
    (i) => i.number === parseInt(issueNumber || "0")
  );

  // Get available labels for this repository
  const availableLabels = repositoryLabels.get(decodedRepoId) || [];

  // Fetch labels when component mounts if not already loaded
  useEffect(() => {
    if (repo && availableLabels.length === 0) {
      fetchLabelsForRepo(repo);
    }
  }, [repo, availableLabels.length, fetchLabelsForRepo]);

  // Get effective state and labels (considering pending changes)
  const effectiveState = issue ? getEffectiveIssueState(decodedRepoId, issue.number, issue.state) : "open";
  const effectiveLabels = issue ? getEffectiveIssueLabels(decodedRepoId, issue.number, issue.labels) : [];

  // Check if there's a pending state change for this issue
  const hasPendingStateChange = issue && pendingStateChanges.some(
    (c) => c.repoId === decodedRepoId && c.issueNumber === issue.number
  );

  // Check if there's a pending label update for this issue
  const hasPendingLabelUpdate = issue && pendingLabelUpdates.some(
    (u) => u.repoId === decodedRepoId && u.issueNumber === issue.number
  );

  // Get pending replies for this issue
  const issuePendingReplies = pendingReplies.filter(
    (reply) => reply.repoId === decodedRepoId && reply.issueNumber === issue?.number
  );

  const handleSubmitReply = async () => {
    if (!replyText.trim() || !issue) return;
    setIsSubmitting(true);
    try {
      await addPendingReply(decodedRepoId, issue.number, replyText.trim());
      setReplyText("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePendingReply = async (replyId: string) => {
    await removePendingReply(replyId);
  };

  const handleToggleState = async () => {
    if (!issue) return;
    const newState = effectiveState === "open" ? "closed" : "open";
    await addPendingStateChange(decodedRepoId, issue.number, newState);
  };

  const handleCancelStateChange = async () => {
    if (!issue) return;
    const pendingChange = pendingStateChanges.find(
      (c) => c.repoId === decodedRepoId && c.issueNumber === issue.number
    );
    if (pendingChange) {
      await removePendingStateChange(pendingChange.id);
    }
  };

  const handleOpenLabelEditor = () => {
    setSelectedLabels(effectiveLabels.map(l => l.name));
    setShowLabelEditor(true);
  };

  const handleSaveLabels = async () => {
    if (!issue) return;
    await addPendingLabelUpdate(decodedRepoId, issue.number, selectedLabels);
    setShowLabelEditor(false);
  };

  const handleCancelLabelEdit = () => {
    setShowLabelEditor(false);
  };

  const toggleLabel = (labelName: string) => {
    setSelectedLabels(prev =>
      prev.includes(labelName)
        ? prev.filter(l => l !== labelName)
        : [...prev, labelName]
    );
  };

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
              title="Back to issues"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-400">{repo.full_name}</p>
              <h1 className="text-lg font-semibold text-white truncate">
                #{issue.number} {issue.title}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={issue.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 inline-flex items-center gap-2 px-3 py-1 rounded-md bg-gray-700 hover:bg-gray-600 text-sm text-white transition-colors"
                title="Open on GitHub"
              >
                <ExternalLink className="w-4 h-4" />
                View on GitHub
              </a>
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
              className={`px-3 py-1 rounded-full text-sm font-medium ${effectiveState === "open"
                ? "bg-green-900/50 text-green-400 border border-green-700"
                : "bg-purple-900/50 text-purple-400 border border-purple-700"
                }`}
            >
              {effectiveState === "open" ? "Open" : "Closed"}
              {hasPendingStateChange && (
                <span className="ml-1 text-yellow-400">(pending)</span>
              )}
            </span>

            {/* Close/Reopen button */}
            <button
              onClick={handleToggleState}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-medium transition-colors ${effectiveState === "open"
                  ? "bg-purple-900/50 text-purple-400 hover:bg-purple-900/70 border border-purple-700"
                  : "bg-green-900/50 text-green-400 hover:bg-green-900/70 border border-green-700"
                }`}
            >
              {effectiveState === "open" ? (
                <>
                  <XCircle className="w-4 h-4" />
                  Close Issue
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Reopen Issue
                </>
              )}
            </button>

            {hasPendingStateChange && (
              <button
                onClick={handleCancelStateChange}
                className="text-sm text-gray-400 hover:text-white"
                title="Cancel pending state change"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <span className="text-gray-400">
              <span className="text-white">{issue.user.login}</span> opened this
              issue on {new Date(issue.created_at).toLocaleDateString()}
            </span>
          </div>

          {/* Labels */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {effectiveLabels.map((label) => (
              <span
                key={label.name}
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
            {hasPendingLabelUpdate && (
              <span className="text-xs text-yellow-400">(pending)</span>
            )}
            <button
              onClick={handleOpenLabelEditor}
              className="flex items-center gap-1 px-2 py-1 text-sm text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
              title="Edit labels"
            >
              <Tag className="w-4 h-4" />
              Edit
            </button>
          </div>

          {/* Label Editor Modal */}
          {showLabelEditor && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
                <h3 className="text-lg font-semibold text-white mb-4">Edit Labels</h3>
                <div className="space-y-2 mb-4">
                  {availableLabels.length === 0 ? (
                    <p className="text-gray-400 text-sm">No labels available. Sync the repository to load labels.</p>
                  ) : (
                    availableLabels.map((label) => (
                      <button
                        key={label.name}
                        onClick={() => toggleLabel(label.name)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors ${selectedLabels.includes(label.name)
                            ? "bg-gray-700"
                            : "hover:bg-gray-700/50"
                          }`}
                      >
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: `#${label.color}` }}
                        />
                        <span className="text-white flex-1">{label.name}</span>
                        {selectedLabels.includes(label.name) && (
                          <Check className="w-4 h-4 text-green-400" />
                        )}
                      </button>
                    ))
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleCancelLabelEdit}
                    className="px-4 py-2 text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveLabels}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                  >
                    Save
                  </button>
                </div>
              </div>
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

        {/* Pending Replies */}
        {issuePendingReplies.length > 0 && (
          <div className="space-y-4 mt-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <CornerDownRight className="w-5 h-5 text-yellow-500" />
              Pending Replies ({issuePendingReplies.length})
            </h2>
            <p className="text-sm text-gray-400">
              These replies will be published when you sync the repository.
            </p>
            {issuePendingReplies.map((reply) => (
              <PendingReplyCard
                key={reply.id}
                reply={reply}
                onDelete={() => handleDeletePendingReply(reply.id)}
              />
            ))}
          </div>
        )}

        {/* Reply Form */}
        <div className="mt-6 bg-gray-800 rounded-xl border border-gray-700">
          <div className="px-4 py-3 border-b border-gray-700 bg-gray-800/50 rounded-t-xl">
            <h3 className="font-medium text-white">Write a reply</h3>
          </div>
          <div className="p-4">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Leave a comment... (Supports Markdown)"
              rows={4}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
            />
            <div className="flex justify-between items-center mt-3">
              <span className="text-sm text-gray-400">
                Markdown is supported
              </span>
              <button
                onClick={handleSubmitReply}
                disabled={!replyText.trim() || isSubmitting}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Save Reply
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

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

function PendingReplyCard({ reply, onDelete }: { reply: PendingReply; onDelete: () => void }) {
  return (
    <div className="bg-gray-800 rounded-xl border border-yellow-700/50">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-700 bg-yellow-900/20 rounded-t-xl">
        <div className="flex items-center gap-2">
          <CornerDownRight className="w-5 h-5 text-yellow-500" />
          <span className="font-medium text-yellow-400">Pending</span>
          <span className="text-gray-400 text-sm">
            created on {new Date(reply.created_at).toLocaleDateString()}
          </span>
        </div>
        <button
          onClick={onDelete}
          className="text-gray-400 hover:text-red-400 transition-colors p-1"
          title="Delete pending reply"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
      <div className="p-4">
        <div className="prose prose-invert max-w-none">
          <MarkdownContent content={reply.body} />
        </div>
      </div>
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || "");
          const isInline = !match && !className;

          if (isInline) {
            return (
              <code className="bg-gray-700 px-1.5 py-0.5 rounded text-sm text-pink-400" {...props}>
                {children}
              </code>
            );
          }

          return (
            <SyntaxHighlighter
              style={oneDark}
              language={match ? match[1] : "text"}
              PreTag="div"
              className="rounded-lg bg-gray-900! mt-2! mb-2!"
            >
              {String(children).replace(/\n$/, "")}
            </SyntaxHighlighter>
          );
        },
        h1: ({ children }) => (
          <h1 className="text-2xl font-bold text-white mt-6 mb-4 border-b border-gray-700 pb-2">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-xl font-semibold text-white mt-5 mb-3 border-b border-gray-700 pb-2">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-lg font-semibold text-white mt-4 mb-2">{children}</h3>
        ),
        h4: ({ children }) => (
          <h4 className="text-base font-semibold text-white mt-3 mb-2">{children}</h4>
        ),
        p: ({ children }) => (
          <p className="text-gray-300 mb-4 leading-relaxed">{children}</p>
        ),
        a: ({ href, children }) => (
          <a href={href} className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-inside mb-4 text-gray-300 space-y-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside mb-4 text-gray-300 space-y-1">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-gray-300">{children}</li>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-gray-600 pl-4 italic text-gray-400 my-4">{children}</blockquote>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-4">
            <table className="min-w-full border border-gray-700">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-gray-800">{children}</thead>
        ),
        tbody: ({ children }) => (
          <tbody className="divide-y divide-gray-700">{children}</tbody>
        ),
        tr: ({ children }) => (
          <tr className="border-b border-gray-700">{children}</tr>
        ),
        th: ({ children }) => (
          <th className="px-4 py-2 text-left text-gray-300 font-semibold">{children}</th>
        ),
        td: ({ children }) => (
          <td className="px-4 py-2 text-gray-300">{children}</td>
        ),
        hr: () => (
          <hr className="my-6 border-gray-700" />
        ),
        img: ({ src, alt }) => (
          <CachedImage src={src} alt={alt} />
        ),
        input: ({ type, checked }) => {
          if (type === "checkbox") {
            return (
              <input
                type="checkbox"
                checked={checked}
                disabled
                className="mr-2 rounded border-gray-600 bg-gray-700 text-blue-500"
              />
            );
          }
          return null;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// Component that loads cached images with fallback to original URL
function CachedImage({ src, alt }: { src?: string; alt?: string }) {
  const [imageSrc, setImageSrc] = useState<string | undefined>(src);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!src) {
      setIsLoading(false);
      return;
    }

    // Try to load from cache
    getCachedImageAsDataUrl(src)
      .then((cachedUrl) => {
        if (cachedUrl) {
          setImageSrc(cachedUrl);
        } else {
          // Fall back to original URL
          setImageSrc(src);
        }
      })
      .catch(() => {
        // Fall back to original URL on error
        setImageSrc(src);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [src]);

  if (isLoading) {
    return (
      <div className="bg-gray-700 rounded-lg my-4 h-32 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading image...</div>
      </div>
    );
  }

  return (
    <img 
      src={imageSrc} 
      alt={alt || ""} 
      className="max-w-full h-auto rounded-lg my-4" 
      loading="lazy"
    />
  );
}
