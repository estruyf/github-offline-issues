import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { Repository, OfflineRepository, GitHubUser, PendingReply, LocalIssue, PendingStateChange, PendingLabelUpdate, GitHubLabel } from "../types";
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
  getLocalIssues as getLocalIssuesFromStore,
  addLocalIssue as addLocalIssueToStore,
  removeLocalIssue as removeLocalIssueFromStore,
  getLocalIssuesForRepo,
  getPendingStateChanges as getPendingStateChangesFromStore,
  addPendingStateChange as addPendingStateChangeToStore,
  removePendingStateChange as removePendingStateChangeFromStore,
  getPendingStateChangesForRepo,
  getPendingLabelUpdates as getPendingLabelUpdatesFromStore,
  addPendingLabelUpdate as addPendingLabelUpdateToStore,
  removePendingLabelUpdate as removePendingLabelUpdateFromStore,
  getPendingLabelUpdatesForRepo,
} from "../services/storage";
import {
  validateToken,
  fetchAllIssuesWithComments,
  fetchUpdatedIssuesWithComments,
  postIssueComment,
  createIssue,
  updateIssueState,
  updateIssueLabels,
  fetchRepositoryLabels,
} from "../services/github";
import { extractImageUrls, cacheImage } from "../services/imageCache";

interface AppContextType {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: GitHubUser | null;
  token: string | null;
  repositories: Repository[];
  offlineData: Map<string, OfflineRepository>;
  syncStatus: Map<string, { syncing: boolean; progress?: string }>;
  pendingReplies: PendingReply[];
  localIssues: LocalIssue[];
  pendingStateChanges: PendingStateChange[];
  pendingLabelUpdates: PendingLabelUpdate[];
  repositoryLabels: Map<string, GitHubLabel[]>;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  addRepository: (owner: string, name: string) => Promise<void>;
  removeRepository: (repoId: string) => Promise<void>;
  syncRepository: (repo: Repository) => Promise<void>;
  incrementalSyncRepository: (repo: Repository) => Promise<void>;
  refreshOfflineData: () => Promise<void>;
  addPendingReply: (repoId: string, issueNumber: number, body: string) => Promise<void>;
  removePendingReply: (replyId: string) => Promise<void>;
  addLocalIssue: (repoId: string, title: string, body: string, labels: string[]) => Promise<void>;
  removeLocalIssue: (issueId: string) => Promise<void>;
  addPendingStateChange: (repoId: string, issueNumber: number, state: "open" | "closed") => Promise<void>;
  removePendingStateChange: (changeId: string) => Promise<void>;
  addPendingLabelUpdate: (repoId: string, issueNumber: number, labels: string[]) => Promise<void>;
  removePendingLabelUpdate: (updateId: string) => Promise<void>;
  getEffectiveIssueState: (repoId: string, issueNumber: number, currentState: "open" | "closed") => "open" | "closed";
  getEffectiveIssueLabels: (repoId: string, issueNumber: number, currentLabels: GitHubLabel[]) => GitHubLabel[];
  fetchLabelsForRepo: (repo: Repository) => Promise<void>;
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
  const [localIssues, setLocalIssues] = useState<LocalIssue[]>([]);
  const [pendingStateChanges, setPendingStateChanges] = useState<PendingStateChange[]>([]);
  const [pendingLabelUpdates, setPendingLabelUpdates] = useState<PendingLabelUpdate[]>([]);
  const [repositoryLabels, setRepositoryLabels] = useState<Map<string, GitHubLabel[]>>(new Map());

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

    // Also refresh pending replies and local issues
    const replies = await getPendingRepliesFromStore();
    setPendingReplies(replies);

    const issues = await getLocalIssuesFromStore();
    setLocalIssues(issues);

    const stateChanges = await getPendingStateChangesFromStore();
    setPendingStateChanges(stateChanges);

    const labelUpdates = await getPendingLabelUpdatesFromStore();
    setPendingLabelUpdates(labelUpdates);
  }, []);

  // Initialize app state
  useEffect(() => {
    async function init() {
      try {
        const savedToken = await getToken();
        const savedRepos = await getRepositories();
        const savedReplies = await getPendingRepliesFromStore();
        const savedLocalIssues = await getLocalIssuesFromStore();
        const savedStateChanges = await getPendingStateChangesFromStore();
        const savedLabelUpdates = await getPendingLabelUpdatesFromStore();

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
        setLocalIssues(savedLocalIssues);
        setPendingStateChanges(savedStateChanges);
        setPendingLabelUpdates(savedLabelUpdates);
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

  // Helper function to publish local issues and pending replies
  const publishPendingItems = async (repo: Repository) => {
    if (!token) return;

    // Publish pending state changes first
    const repoStateChanges = await getPendingStateChangesForRepo(repo.id);

    if (repoStateChanges.length > 0) {
      setSyncStatus((prev) => {
        const newStatus = new Map(prev);
        newStatus.set(repo.id, {
          syncing: true,
          progress: `Updating ${repoStateChanges.length} issue states...`,
        });
        return newStatus;
      });

      for (let i = 0; i < repoStateChanges.length; i++) {
        const change = repoStateChanges[i];
        setSyncStatus((prev) => {
          const newStatus = new Map(prev);
          newStatus.set(repo.id, {
            syncing: true,
            progress: `Updating state ${i + 1}/${repoStateChanges.length}...`,
          });
          return newStatus;
        });

        await updateIssueState(
          repo.owner,
          repo.name,
          change.issueNumber,
          change.state,
          token
        );

        await removePendingStateChangeFromStore(change.id);
      }

      setPendingStateChanges((prev) => prev.filter((c) => c.repoId !== repo.id));
    }

    // Publish pending label updates
    const repoLabelUpdates = await getPendingLabelUpdatesForRepo(repo.id);

    if (repoLabelUpdates.length > 0) {
      setSyncStatus((prev) => {
        const newStatus = new Map(prev);
        newStatus.set(repo.id, {
          syncing: true,
          progress: `Updating ${repoLabelUpdates.length} issue labels...`,
        });
        return newStatus;
      });

      for (let i = 0; i < repoLabelUpdates.length; i++) {
        const update = repoLabelUpdates[i];
        setSyncStatus((prev) => {
          const newStatus = new Map(prev);
          newStatus.set(repo.id, {
            syncing: true,
            progress: `Updating labels ${i + 1}/${repoLabelUpdates.length}...`,
          });
          return newStatus;
        });

        await updateIssueLabels(
          repo.owner,
          repo.name,
          update.issueNumber,
          update.labels,
          token
        );

        await removePendingLabelUpdateFromStore(update.id);
      }

      setPendingLabelUpdates((prev) => prev.filter((u) => u.repoId !== repo.id));
    }

    // Publish local issues
    const repoLocalIssues = await getLocalIssuesForRepo(repo.id);

    if (repoLocalIssues.length > 0) {
      setSyncStatus((prev) => {
        const newStatus = new Map(prev);
        newStatus.set(repo.id, {
          syncing: true,
          progress: `Creating ${repoLocalIssues.length} local issues...`,
        });
        return newStatus;
      });

      for (let i = 0; i < repoLocalIssues.length; i++) {
        const issue = repoLocalIssues[i];
        setSyncStatus((prev) => {
          const newStatus = new Map(prev);
          newStatus.set(repo.id, {
            syncing: true,
            progress: `Creating issue ${i + 1}/${repoLocalIssues.length}: ${issue.title}...`,
          });
          return newStatus;
        });

        await createIssue(
          repo.owner,
          repo.name,
          issue.title,
          issue.body,
          issue.labels,
          token
        );

        // Remove the local issue after successful creation
        await removeLocalIssueFromStore(issue.id);
      }

      // Update local state
      setLocalIssues((prev) => prev.filter((i) => i.repoId !== repo.id));
    }

    // Then publish pending replies
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
  };

  const syncRepository = async (repo: Repository) => {
    if (!token) return;

    setSyncStatus((prev) => {
      const newStatus = new Map(prev);
      newStatus.set(repo.id, { syncing: true, progress: "Starting sync..." });
      return newStatus;
    });

    try {
      // First, publish any pending local issues and replies
      await publishPendingItems(repo);

      // Fetch repository labels
      setSyncStatus((prev) => {
        const newStatus = new Map(prev);
        newStatus.set(repo.id, {
          syncing: true,
          progress: "Fetching repository labels...",
        });
        return newStatus;
      });

      const labels = await fetchRepositoryLabels(repo.owner, repo.name, token);
      setRepositoryLabels((prev) => {
        const newLabels = new Map(prev);
        newLabels.set(repo.id, labels.map(l => ({ id: 0, ...l })));
        return newLabels;
      });

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

      // Cache images from issues and comments
      setSyncStatus((prev) => {
        const newStatus = new Map(prev);
        newStatus.set(repo.id, {
          syncing: true,
          progress: "Caching images for offline use...",
        });
        return newStatus;
      });

      await cacheIssueImages(issues, repo.id);

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

  // Helper function to cache images from issues
  const cacheIssueImages = async (issues: OfflineRepository["issues"], repoId: string) => {
    const allUrls: string[] = [];

    for (const issue of issues) {
      if (issue.body) {
        allUrls.push(...extractImageUrls(issue.body));
      }
      if (issue.comments_data) {
        for (const comment of issue.comments_data) {
          allUrls.push(...extractImageUrls(comment.body));
        }
      }
    }

    const uniqueUrls = [...new Set(allUrls)];

    for (let i = 0; i < uniqueUrls.length; i++) {
      try {
        await cacheImage(uniqueUrls[i], repoId);
      } catch (error) {
        console.warn(`Failed to cache image: ${uniqueUrls[i]}`, error);
      }
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

  const addLocalIssue = async (repoId: string, title: string, body: string, labels: string[]) => {
    const issue: LocalIssue = {
      id: `${repoId}-local-${Date.now()}`,
      repoId,
      title,
      body,
      labels,
      created_at: new Date().toISOString(),
    };

    await addLocalIssueToStore(issue);
    setLocalIssues((prev) => [...prev, issue]);
  };

  const removeLocalIssue = async (issueId: string) => {
    await removeLocalIssueFromStore(issueId);
    setLocalIssues((prev) => prev.filter((i) => i.id !== issueId));
  };

  const addPendingStateChange = async (repoId: string, issueNumber: number, state: "open" | "closed") => {
    const change: PendingStateChange = {
      id: `${repoId}-${issueNumber}-state-${Date.now()}`,
      repoId,
      issueNumber,
      state,
      created_at: new Date().toISOString(),
    };

    await addPendingStateChangeToStore(change);
    setPendingStateChanges((prev) => {
      // Remove any existing pending state change for the same issue
      const filtered = prev.filter(
        (c) => !(c.repoId === repoId && c.issueNumber === issueNumber)
      );
      return [...filtered, change];
    });
  };

  const removePendingStateChange = async (changeId: string) => {
    await removePendingStateChangeFromStore(changeId);
    setPendingStateChanges((prev) => prev.filter((c) => c.id !== changeId));
  };

  const addPendingLabelUpdate = async (repoId: string, issueNumber: number, labels: string[]) => {
    const update: PendingLabelUpdate = {
      id: `${repoId}-${issueNumber}-labels-${Date.now()}`,
      repoId,
      issueNumber,
      labels,
      created_at: new Date().toISOString(),
    };

    await addPendingLabelUpdateToStore(update);
    setPendingLabelUpdates((prev) => {
      // Remove any existing pending label update for the same issue
      const filtered = prev.filter(
        (u) => !(u.repoId === repoId && u.issueNumber === issueNumber)
      );
      return [...filtered, update];
    });
  };

  const removePendingLabelUpdate = async (updateId: string) => {
    await removePendingLabelUpdateFromStore(updateId);
    setPendingLabelUpdates((prev) => prev.filter((u) => u.id !== updateId));
  };

  // Get the effective state of an issue (considering pending changes)
  const getEffectiveIssueState = (repoId: string, issueNumber: number, currentState: "open" | "closed"): "open" | "closed" => {
    const pendingChange = pendingStateChanges.find(
      (c) => c.repoId === repoId && c.issueNumber === issueNumber
    );
    return pendingChange ? pendingChange.state : currentState;
  };

  // Get the effective labels of an issue (considering pending changes)
  const getEffectiveIssueLabels = (repoId: string, issueNumber: number, currentLabels: GitHubLabel[]): GitHubLabel[] => {
    const pendingUpdate = pendingLabelUpdates.find(
      (u) => u.repoId === repoId && u.issueNumber === issueNumber
    );
    if (pendingUpdate) {
      // Convert label names to GitHubLabel objects
      const repoLabels = repositoryLabels.get(repoId) || [];
      return pendingUpdate.labels.map(name => {
        const existing = repoLabels.find(l => l.name === name);
        return existing || { id: 0, name, color: "6b7280" };
      });
    }
    return currentLabels;
  };

  const fetchLabelsForRepo = async (repo: Repository) => {
    if (!token) return;

    try {
      const labels = await fetchRepositoryLabels(repo.owner, repo.name, token);
      setRepositoryLabels((prev) => {
        const newLabels = new Map(prev);
        newLabels.set(repo.id, labels.map(l => ({ id: 0, ...l })));
        return newLabels;
      });
    } catch (error) {
      console.error("Failed to fetch labels:", error);
    }
  };

  const incrementalSyncRepository = async (repo: Repository) => {
    if (!token) return;

    const existingOffline = offlineData.get(repo.id);
    if (!existingOffline?.last_synced) {
      // No previous sync, do a full sync instead
      await syncRepository(repo);
      return;
    }

    setSyncStatus((prev) => {
      const newStatus = new Map(prev);
      newStatus.set(repo.id, { syncing: true, progress: "Starting incremental sync..." });
      return newStatus;
    });

    try {
      // Publish pending items first
      await publishPendingItems(repo);

      // Fetch only issues updated since last sync
      setSyncStatus((prev) => {
        const newStatus = new Map(prev);
        newStatus.set(repo.id, {
          syncing: true,
          progress: "Fetching updated issues...",
        });
        return newStatus;
      });

      const updatedIssues = await fetchUpdatedIssuesWithComments(
        repo.owner,
        repo.name,
        existingOffline.last_synced,
        token,
        (current, total) => {
          setSyncStatus((prev) => {
            const newStatus = new Map(prev);
            newStatus.set(repo.id, {
              syncing: true,
              progress: `Syncing updated issue ${current}/${total}...`,
            });
            return newStatus;
          });
        }
      );

      // Merge updated issues with existing ones
      const existingIssuesMap = new Map(
        existingOffline.issues.map((issue) => [issue.number, issue])
      );

      for (const updatedIssue of updatedIssues) {
        existingIssuesMap.set(updatedIssue.number, updatedIssue);
      }

      const mergedIssues = Array.from(existingIssuesMap.values());

      const offlineRepo: OfflineRepository = {
        ...repo,
        issues: mergedIssues,
        last_synced: new Date().toISOString(),
      };

      await saveOfflineRepository(offlineRepo);

      setOfflineData((prev) => {
        const newData = new Map(prev);
        newData.set(repo.id, offlineRepo);
        return newData;
      });
    } catch (error) {
      console.error("Failed to incrementally sync repository:", error);
      throw error;
    } finally {
      setSyncStatus((prev) => {
        const newStatus = new Map(prev);
        newStatus.set(repo.id, { syncing: false });
        return newStatus;
      });
    }
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
        localIssues,
        pendingStateChanges,
        pendingLabelUpdates,
        repositoryLabels,
        login,
        logout,
        addRepository,
        removeRepository,
        syncRepository,
        incrementalSyncRepository,
        refreshOfflineData,
        addPendingReply,
        removePendingReply,
        addLocalIssue,
        removeLocalIssue,
        addPendingStateChange,
        removePendingStateChange,
        addPendingLabelUpdate,
        removePendingLabelUpdate,
        getEffectiveIssueState,
        getEffectiveIssueLabels,
        fetchLabelsForRepo,
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
