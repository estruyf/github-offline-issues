export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
}

export interface GitHubLabel {
  id: number;
  name: string;
  color: string;
  description?: string;
}

export interface GitHubMilestone {
  id: number;
  number: number;
  title: string;
  description?: string;
  state: string;
  due_on?: string;
}

export interface GitHubComment {
  id: number;
  body: string;
  user: GitHubUser;
  created_at: string;
  updated_at: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  html_url: string;
  user: GitHubUser;
  labels: GitHubLabel[];
  assignees: GitHubUser[];
  milestone?: GitHubMilestone;
  comments: number;
  created_at: string;
  updated_at: string;
  closed_at?: string;
}

export interface OfflineIssue extends GitHubIssue {
  comments_data?: GitHubComment[];
  synced_at: string;
}

export interface Repository {
  id: string;
  owner: string;
  name: string;
  full_name: string;
  added_at: string;
}

export interface OfflineRepository extends Repository {
  issues: OfflineIssue[];
  last_synced?: string;
}

export interface AppState {
  token: string | null;
  repositories: Repository[];
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSynced?: string;
}

export interface PendingReply {
  id: string;
  repoId: string;
  issueNumber: number;
  body: string;
  created_at: string;
}

export interface LocalIssue {
  id: string;
  repoId: string;
  title: string;
  body: string;
  labels: string[];
  created_at: string;
}
