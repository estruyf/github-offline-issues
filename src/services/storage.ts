import { load, Store } from "@tauri-apps/plugin-store";
import type {
  AppState,
  Repository,
  OfflineRepository,
  OfflineIssue,
  PendingReply,
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
