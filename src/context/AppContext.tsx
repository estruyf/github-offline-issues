import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { Repository, OfflineRepository, GitHubUser, PendingReply } from "../types";
import {
  getToken,
  saveToken,
  clearToken,
  getRepositories,
  addRepository as addRepoToStore,
  removeRepository as removeRepoFromStore,
  getOfflineRepository,
  saveOfflineRepository,
  getPendingReplies as getPendingRepliesFromStore,
  addPendingReply as addPendingReplyToStore,
  removePendingReply as removePendingReplyFromStore,
  getPendingRepliesForRepo,
} from "../services/storage";
import {
  validateToken,
  fetchAllIssuesWithComments,
  postIssueComment,
} from "../services/github";

interface AppContextType {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: GitHubUser | null;
  token: string | null;
  repositories: Repository[];
  offlineData: Map<string, OfflineRepository>;
  syncStatus: Map<string, { syncing: boolean; progress?: string }>;
  pendingReplies: PendingReply[];
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  addRepository: (owner: string, name: string) => Promise<void>;
  removeRepository: (repoId: string) => Promise<void>;
  syncRepository: (repo: Repository) => Promise<void>;
  refreshOfflineData: () => Promise<void>;
  addPendingReply: (repoId: string, issueNumber: number, body: string) => Promise<void>;
  removePendingReply: (replyId: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [offlineData, setOfflineData] = useState<Map<string, OfflineRepository>>(
    new Map()
  );
  const [syncStatus, setSyncStatus] = useState<
    Map<string, { syncing: boolean; progress?: string }>
  >(new Map());
  const [pendingReplies, setPendingReplies] = useState<PendingReply[]>([]);

  const refreshOfflineData = useCallback(async () => {
    const repos = await getRepositories();
    const newOfflineData = new Map<string, OfflineRepository>();

    for (const repo of repos) {
      const offlineRepo = await getOfflineRepository(repo.id);
      if (offlineRepo) {
        newOfflineData.set(repo.id, offlineRepo);
      }
    }

    setOfflineData(newOfflineData);

    // Also refresh pending replies
    const replies = await getPendingRepliesFromStore();
    setPendingReplies(replies);
  }, []);

  // Initialize app state
  useEffect(() => {
    async function init() {
      try {
        const savedToken = await getToken();
        const savedRepos = await getRepositories();
        const savedReplies = await getPendingRepliesFromStore();

        if (savedToken) {
          try {
            const userData = await validateToken(savedToken);
            setToken(savedToken);
            setUser(userData);
            setIsAuthenticated(true);
          } catch {
            // Token is invalid, clear it
            await clearToken();
          }
        }

        setRepositories(savedRepos);
        setPendingReplies(savedReplies);
        await refreshOfflineData();
      } catch (error) {
        console.error("Failed to initialize app:", error);
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, [refreshOfflineData]);

  const login = async (newToken: string) => {
    setIsLoading(true);
    try {
      const userData = await validateToken(newToken);
      await saveToken(newToken);
      setToken(newToken);
      setUser(userData);
      setIsAuthenticated(true);
    } catch (error) {
      throw new Error("Invalid token. Please check and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await clearToken();
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
  };

  const addRepository = async (owner: string, name: string) => {
    const repo: Repository = {
      id: `${owner}/${name}`,
      owner,
      name,
      full_name: `${owner}/${name}`,
      added_at: new Date().toISOString(),
    };

    await addRepoToStore(repo);
    setRepositories((prev) => {
      if (prev.find((r) => r.id === repo.id)) return prev;
      return [...prev, repo];
    });
  };

  const removeRepository = async (repoId: string) => {
    await removeRepoFromStore(repoId);
    setRepositories((prev) => prev.filter((r) => r.id !== repoId));
    setOfflineData((prev) => {
      const newData = new Map(prev);
      newData.delete(repoId);
      return newData;
    });
  };

  const syncRepository = async (repo: Repository) => {
    if (!token) return;

    setSyncStatus((prev) => {
      const newStatus = new Map(prev);
      newStatus.set(repo.id, { syncing: true, progress: "Starting sync..." });
      return newStatus;
    });

    try {
      // First, publish any pending replies for this repository
      const repoPendingReplies = await getPendingRepliesForRepo(repo.id);

      if (repoPendingReplies.length > 0) {
        setSyncStatus((prev) => {
          const newStatus = new Map(prev);
          newStatus.set(repo.id, {
            syncing: true,
            progress: `Publishing ${repoPendingReplies.length} pending replies...`,
          });
          return newStatus;
        });

        for (let i = 0; i < repoPendingReplies.length; i++) {
          const reply = repoPendingReplies[i];
          setSyncStatus((prev) => {
            const newStatus = new Map(prev);
            newStatus.set(repo.id, {
              syncing: true,
              progress: `Publishing reply ${i + 1}/${repoPendingReplies.length}...`,
            });
            return newStatus;
          });

          await postIssueComment(
            repo.owner,
            repo.name,
            reply.issueNumber,
            reply.body,
            token
          );

          // Remove the reply from storage after successful publish
          await removePendingReplyFromStore(reply.id);
        }

        // Update local state
        setPendingReplies((prev) => prev.filter((r) => r.repoId !== repo.id));
      }

      // Then fetch the latest issues and comments
      const issues = await fetchAllIssuesWithComments(
        repo.owner,
        repo.name,
        token,
        (current, total) => {
          setSyncStatus((prev) => {
            const newStatus = new Map(prev);
            newStatus.set(repo.id, {
              syncing: true,
              progress: `Syncing issue ${current}/${total}...`,
            });
            return newStatus;
          });
        }
      );

      const offlineRepo: OfflineRepository = {
        ...repo,
        issues,
        last_synced: new Date().toISOString(),
      };

      await saveOfflineRepository(offlineRepo);

      setOfflineData((prev) => {
        const newData = new Map(prev);
        newData.set(repo.id, offlineRepo);
        return newData;
      });
    } catch (error) {
      console.error("Failed to sync repository:", error);
      throw error;
    } finally {
      setSyncStatus((prev) => {
        const newStatus = new Map(prev);
        newStatus.set(repo.id, { syncing: false });
        return newStatus;
      });
    }
  };

  const addPendingReply = async (repoId: string, issueNumber: number, body: string) => {
    const reply: PendingReply = {
      id: `${repoId}-${issueNumber}-${Date.now()}`,
      repoId,
      issueNumber,
      body,
      created_at: new Date().toISOString(),
    };

    await addPendingReplyToStore(reply);
    setPendingReplies((prev) => [...prev, reply]);
  };

  const removePendingReply = async (replyId: string) => {
    await removePendingReplyFromStore(replyId);
    setPendingReplies((prev) => prev.filter((r) => r.id !== replyId));
  };

  return (
    <AppContext.Provider
      value={{
        isLoading,
        isAuthenticated,
        user,
        token,
        repositories,
        offlineData,
        syncStatus,
        pendingReplies,
        login,
        logout,
        addRepository,
        removeRepository,
        syncRepository,
        refreshOfflineData,
        addPendingReply,
        removePendingReply,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}

export { validateToken } from "../services/github";
