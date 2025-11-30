import { fetch } from "@tauri-apps/plugin-http";
import type {
  GitHubIssue,
  GitHubComment,
  GitHubUser,
  OfflineIssue,
} from "../types";

export type { GitHubUser } from "../types";

const GITHUB_API_BASE = "https://api.github.com";

interface GitHubApiOptions {
  token: string;
}

async function githubFetch<T>(
  endpoint: string,
  options: GitHubApiOptions
): Promise<T> {
  const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${options.token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "GitHub-Issues-Offline-Tauri-App",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

export async function validateToken(token: string): Promise<GitHubUser> {
  return await githubFetch<GitHubUser>("/user", { token });
}

export async function fetchRepositoryIssues(
  owner: string,
  repo: string,
  token: string
): Promise<GitHubIssue[]> {
  const allIssues: GitHubIssue[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const issues = await githubFetch<GitHubIssue[]>(
      `/repos/${owner}/${repo}/issues?state=all&per_page=${perPage}&page=${page}`,
      { token }
    );

    // Filter out pull requests (they come in the issues endpoint too)
    const realIssues = issues.filter(
      (issue) => !(issue as GitHubIssue & { pull_request?: unknown }).pull_request
    );
    allIssues.push(...realIssues);

    if (issues.length < perPage) {
      break;
    }
    page++;
  }

  return allIssues;
}

export async function fetchIssueComments(
  owner: string,
  repo: string,
  issueNumber: number,
  token: string
): Promise<GitHubComment[]> {
  const allComments: GitHubComment[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const comments = await githubFetch<GitHubComment[]>(
      `/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=${perPage}&page=${page}`,
      { token }
    );

    allComments.push(...comments);

    if (comments.length < perPage) {
      break;
    }
    page++;
  }

  return allComments;
}

export async function fetchAllIssuesWithComments(
  owner: string,
  repo: string,
  token: string,
  onProgress?: (current: number, total: number) => void
): Promise<OfflineIssue[]> {
  const issues = await fetchRepositoryIssues(owner, repo, token);
  const offlineIssues: OfflineIssue[] = [];

  for (let i = 0; i < issues.length; i++) {
    const issue = issues[i];
    
    if (onProgress) {
      onProgress(i + 1, issues.length);
    }

    let comments_data: GitHubComment[] = [];
    if (issue.comments > 0) {
      comments_data = await fetchIssueComments(owner, repo, issue.number, token);
    }

    offlineIssues.push({
      ...issue,
      comments_data,
      synced_at: new Date().toISOString(),
    });
  }

  return offlineIssues;
}

export async function searchRepositories(
  query: string,
  token: string
): Promise<Array<{ owner: string; name: string; full_name: string; description: string }>> {
  interface SearchResult {
    items: Array<{
      full_name: string;
      description: string;
      owner: { login: string };
      name: string;
    }>;
  }

  const result = await githubFetch<SearchResult>(
    `/search/repositories?q=${encodeURIComponent(query)}&per_page=10`,
    { token }
  );

  return result.items.map((item) => ({
    owner: item.owner.login,
    name: item.name,
    full_name: item.full_name,
    description: item.description || "",
  }));
}
