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
  options: GitHubApiOptions & { method?: string; body?: unknown }
): Promise<T> {
  const { token, method = "GET", body } = options;

  const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "GitHub-Offline-Issues-Tauri-App",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
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
      (issue) =>
        !(issue as GitHubIssue & { pull_request?: unknown }).pull_request
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
      comments_data = await fetchIssueComments(
        owner,
        repo,
        issue.number,
        token
      );
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
): Promise<
  Array<{ owner: string; name: string; full_name: string; description: string }>
> {
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

export async function postIssueComment(
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
  token: string
): Promise<GitHubComment> {
  return await githubFetch<GitHubComment>(
    `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    { token, method: "POST", body: { body } }
  );
}

export async function createIssue(
  owner: string,
  repo: string,
  title: string,
  body: string,
  labels: string[],
  token: string
): Promise<GitHubIssue> {
  return await githubFetch<GitHubIssue>(`/repos/${owner}/${repo}/issues`, {
    token,
    method: "POST",
    body: { title, body, labels },
  });
}

export async function fetchRepositoryIssuesSince(
  owner: string,
  repo: string,
  since: string,
  token: string
): Promise<GitHubIssue[]> {
  const allIssues: GitHubIssue[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const issues = await githubFetch<GitHubIssue[]>(
      `/repos/${owner}/${repo}/issues?state=all&since=${encodeURIComponent(
        since
      )}&per_page=${perPage}&page=${page}`,
      { token }
    );

    // Filter out pull requests (they come in the issues endpoint too)
    const realIssues = issues.filter(
      (issue) =>
        !(issue as GitHubIssue & { pull_request?: unknown }).pull_request
    );
    allIssues.push(...realIssues);

    if (issues.length < perPage) {
      break;
    }
    page++;
  }

  return allIssues;
}

export async function fetchUpdatedIssuesWithComments(
  owner: string,
  repo: string,
  since: string,
  token: string,
  onProgress?: (current: number, total: number) => void
): Promise<OfflineIssue[]> {
  const issues = await fetchRepositoryIssuesSince(owner, repo, since, token);
  const offlineIssues: OfflineIssue[] = [];

  for (let i = 0; i < issues.length; i++) {
    const issue = issues[i];

    if (onProgress) {
      onProgress(i + 1, issues.length);
    }

    let comments_data: GitHubComment[] = [];
    if (issue.comments > 0) {
      comments_data = await fetchIssueComments(
        owner,
        repo,
        issue.number,
        token
      );
    }

    offlineIssues.push({
      ...issue,
      comments_data,
      synced_at: new Date().toISOString(),
    });
  }

  return offlineIssues;
}

export async function updateIssueState(
  owner: string,
  repo: string,
  issueNumber: number,
  state: "open" | "closed",
  token: string
): Promise<GitHubIssue> {
  return await githubFetch<GitHubIssue>(
    `/repos/${owner}/${repo}/issues/${issueNumber}`,
    { token, method: "PATCH", body: { state } }
  );
}

export async function updateIssueLabels(
  owner: string,
  repo: string,
  issueNumber: number,
  labels: string[],
  token: string
): Promise<GitHubIssue> {
  return await githubFetch<GitHubIssue>(
    `/repos/${owner}/${repo}/issues/${issueNumber}`,
    { token, method: "PATCH", body: { labels } }
  );
}

export async function fetchRepositoryLabels(
  owner: string,
  repo: string,
  token: string
): Promise<Array<{ name: string; color: string; description?: string }>> {
  const allLabels: Array<{
    name: string;
    color: string;
    description?: string;
  }> = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const labels = await githubFetch<
      Array<{ name: string; color: string; description?: string }>
    >(`/repos/${owner}/${repo}/labels?per_page=${perPage}&page=${page}`, {
      token,
    });

    allLabels.push(...labels);

    if (labels.length < perPage) {
      break;
    }
    page++;
  }

  return allLabels;
}
