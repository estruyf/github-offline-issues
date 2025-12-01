import { load, Store } from "@tauri-apps/plugin-store";
import type {
  AppState,
  Repository,
  OfflineRepository,
  OfflineIssue,
  PendingReply,
  LocalIssue,
  PendingStateChange,
  PendingLabelUpdate,
  CachedImage,
} from "../types";

let appStore: Store | null = null;
let offlineStore: Store | null = null;

async function getAppStore(): Promise<Store> {
  if (!appStore) {
    appStore = await load("app-store.json");
  }
  return appStore;
}

async function getOfflineStore(): Promise<Store> {
  if (!offlineStore) {
    offlineStore = await load("offline-data.json");
  }
  return offlineStore;
}

// Token management
export async function saveToken(token: string): Promise<void> {
  const store = await getAppStore();
  await store.set("github_token", token);
  await store.save();
}

export async function getToken(): Promise<string | null> {
  const store = await getAppStore();
  const token = await store.get<string>("github_token");
  return token ?? null;
}

export async function clearToken(): Promise<void> {
  const store = await getAppStore();
  await store.delete("github_token");
  await store.save();
}

// Repository management
export async function getRepositories(): Promise<Repository[]> {
  const store = await getAppStore();
  const repos = await store.get<Repository[]>("repositories");
  return repos || [];
}

export async function addRepository(repo: Repository): Promise<void> {
  const store = await getAppStore();
  const repos = await getRepositories();
  const exists = repos.find((r) => r.id === repo.id);
  if (!exists) {
    repos.push(repo);
    await store.set("repositories", repos);
    await store.save();
  }
}

export async function removeRepository(repoId: string): Promise<void> {
  const store = await getAppStore();
  const repos = await getRepositories();
  const filtered = repos.filter((r) => r.id !== repoId);
  await store.set("repositories", filtered);
  await store.save();

  // Also remove offline data
  await clearOfflineData(repoId);
}

// Offline data management
export async function saveOfflineRepository(
  repo: OfflineRepository
): Promise<void> {
  const store = await getOfflineStore();
  await store.set(`repo_${repo.id}`, repo);
  await store.save();
}

export async function getOfflineRepository(
  repoId: string
): Promise<OfflineRepository | null> {
  const store = await getOfflineStore();
  const repo = await store.get<OfflineRepository>(`repo_${repoId}`);
  return repo ?? null;
}

export async function getOfflineIssues(
  repoId: string
): Promise<OfflineIssue[]> {
  const repo = await getOfflineRepository(repoId);
  return repo?.issues || [];
}

export async function clearOfflineData(repoId: string): Promise<void> {
  const store = await getOfflineStore();
  await store.delete(`repo_${repoId}`);
  await store.save();
}

export async function getAllOfflineData(): Promise<OfflineRepository[]> {
  const store = await getOfflineStore();
  const repos = await getRepositories();
  const offlineRepos: OfflineRepository[] = [];

  for (const repo of repos) {
    const offlineRepo = await store.get<OfflineRepository>(`repo_${repo.id}`);
    if (offlineRepo) {
      offlineRepos.push(offlineRepo);
    }
  }

  return offlineRepos;
}

// App state
export async function getAppState(): Promise<AppState> {
  const token = await getToken();
  const repositories = await getRepositories();
  return { token, repositories };
}

// Pending replies management
export async function getPendingReplies(): Promise<PendingReply[]> {
  const store = await getAppStore();
  const replies = await store.get<PendingReply[]>("pending_replies");
  return replies || [];
}

export async function addPendingReply(reply: PendingReply): Promise<void> {
  const store = await getAppStore();
  const replies = await getPendingReplies();
  replies.push(reply);
  await store.set("pending_replies", replies);
  await store.save();
}

export async function removePendingReply(replyId: string): Promise<void> {
  const store = await getAppStore();
  const replies = await getPendingReplies();
  const filtered = replies.filter((r) => r.id !== replyId);
  await store.set("pending_replies", filtered);
  await store.save();
}

export async function getPendingRepliesForRepo(
  repoId: string
): Promise<PendingReply[]> {
  const replies = await getPendingReplies();
  return replies.filter((r) => r.repoId === repoId);
}

export async function clearPendingRepliesForRepo(
  repoId: string
): Promise<void> {
  const store = await getAppStore();
  const replies = await getPendingReplies();
  const filtered = replies.filter((r) => r.repoId !== repoId);
  await store.set("pending_replies", filtered);
  await store.save();
}

// Local issues management
export async function getLocalIssues(): Promise<LocalIssue[]> {
  const store = await getAppStore();
  const issues = await store.get<LocalIssue[]>("local_issues");
  return issues || [];
}

export async function addLocalIssue(issue: LocalIssue): Promise<void> {
  const store = await getAppStore();
  const issues = await getLocalIssues();
  issues.push(issue);
  await store.set("local_issues", issues);
  await store.save();
}

export async function removeLocalIssue(issueId: string): Promise<void> {
  const store = await getAppStore();
  const issues = await getLocalIssues();
  const filtered = issues.filter((i) => i.id !== issueId);
  await store.set("local_issues", filtered);
  await store.save();
}

export async function getLocalIssuesForRepo(
  repoId: string
): Promise<LocalIssue[]> {
  const issues = await getLocalIssues();
  return issues.filter((i) => i.repoId === repoId);
}

// Pending state changes management
export async function getPendingStateChanges(): Promise<PendingStateChange[]> {
  const store = await getAppStore();
  const changes = await store.get<PendingStateChange[]>(
    "pending_state_changes"
  );
  return changes || [];
}

export async function addPendingStateChange(
  change: PendingStateChange
): Promise<void> {
  const store = await getAppStore();
  const changes = await getPendingStateChanges();
  // Replace any existing pending state change for the same issue
  const filtered = changes.filter(
    (c) => !(c.repoId === change.repoId && c.issueNumber === change.issueNumber)
  );
  filtered.push(change);
  await store.set("pending_state_changes", filtered);
  await store.save();
}

export async function removePendingStateChange(
  changeId: string
): Promise<void> {
  const store = await getAppStore();
  const changes = await getPendingStateChanges();
  const filtered = changes.filter((c) => c.id !== changeId);
  await store.set("pending_state_changes", filtered);
  await store.save();
}

export async function getPendingStateChangesForRepo(
  repoId: string
): Promise<PendingStateChange[]> {
  const changes = await getPendingStateChanges();
  return changes.filter((c) => c.repoId === repoId);
}

export async function clearPendingStateChangesForRepo(
  repoId: string
): Promise<void> {
  const store = await getAppStore();
  const changes = await getPendingStateChanges();
  const filtered = changes.filter((c) => c.repoId !== repoId);
  await store.set("pending_state_changes", filtered);
  await store.save();
}

// Pending label updates management
export async function getPendingLabelUpdates(): Promise<PendingLabelUpdate[]> {
  const store = await getAppStore();
  const updates = await store.get<PendingLabelUpdate[]>(
    "pending_label_updates"
  );
  return updates || [];
}

export async function addPendingLabelUpdate(
  update: PendingLabelUpdate
): Promise<void> {
  const store = await getAppStore();
  const updates = await getPendingLabelUpdates();
  // Replace any existing pending label update for the same issue
  const filtered = updates.filter(
    (u) => !(u.repoId === update.repoId && u.issueNumber === update.issueNumber)
  );
  filtered.push(update);
  await store.set("pending_label_updates", filtered);
  await store.save();
}

export async function removePendingLabelUpdate(
  updateId: string
): Promise<void> {
  const store = await getAppStore();
  const updates = await getPendingLabelUpdates();
  const filtered = updates.filter((u) => u.id !== updateId);
  await store.set("pending_label_updates", filtered);
  await store.save();
}

export async function getPendingLabelUpdatesForRepo(
  repoId: string
): Promise<PendingLabelUpdate[]> {
  const updates = await getPendingLabelUpdates();
  return updates.filter((u) => u.repoId === repoId);
}

export async function clearPendingLabelUpdatesForRepo(
  repoId: string
): Promise<void> {
  const store = await getAppStore();
  const updates = await getPendingLabelUpdates();
  const filtered = updates.filter((u) => u.repoId !== repoId);
  await store.set("pending_label_updates", filtered);
  await store.save();
}

// Cached images management
export async function getCachedImages(): Promise<CachedImage[]> {
  const store = await getOfflineStore();
  const images = await store.get<CachedImage[]>("cached_images");
  return images || [];
}

export async function addCachedImage(image: CachedImage): Promise<void> {
  const store = await getOfflineStore();
  const images = await getCachedImages();
  // Don't add duplicates
  const exists = images.find((i) => i.url === image.url);
  if (!exists) {
    images.push(image);
    await store.set("cached_images", images);
    await store.save();
  }
}

export async function getCachedImageByUrl(
  url: string
): Promise<CachedImage | null> {
  const images = await getCachedImages();
  return images.find((i) => i.url === url) || null;
}

export async function getCachedImagesForRepo(
  repoId: string
): Promise<CachedImage[]> {
  const images = await getCachedImages();
  return images.filter((i) => i.repoId === repoId);
}

export async function clearCachedImagesForRepo(repoId: string): Promise<void> {
  const store = await getOfflineStore();
  const images = await getCachedImages();
  const filtered = images.filter((i) => i.repoId !== repoId);
  await store.set("cached_images", filtered);
  await store.save();
}
