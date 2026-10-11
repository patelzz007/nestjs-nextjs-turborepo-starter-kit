// ============================================
// github.queries.ts - The GraphQL documents the client sends
// ============================================
// Static text: every value travels as a GraphQL variable, never interpolated.
// Each field read here has a matching entry in `github.wire-schemas.ts`.

import { GITHUB_SUMMARY_LANGUAGES_MAX } from "@workspace/shared";

/** Languages the summary asks GitHub for — the contract's maximum, largest first. */
export const GITHUB_SUMMARY_LANGUAGES_REQUESTED: number = GITHUB_SUMMARY_LANGUAGES_MAX;

export const GITHUB_REPOSITORY_SUMMARY_QUERY = `
query RepositorySummary($owner: String!, $name: String!, $languages: Int!) {
  repository(owner: $owner, name: $name) {
    description
    url
    stargazerCount
    forkCount
    watchers { totalCount }
    issues(states: OPEN) { totalCount }
    primaryLanguage { name }
    pushedAt
    defaultBranchRef {
      name
      target { ... on Commit { history { totalCount } } }
    }
    languages(first: $languages, orderBy: { field: SIZE, direction: DESC }) {
      edges { size node { name color } }
    }
  }
}`;

export const GITHUB_COMMIT_HISTORY_QUERY = `
query RepositoryCommits($owner: String!, $name: String!, $first: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    defaultBranchRef {
      target {
        ... on Commit {
          history(first: $first, after: $after) {
            totalCount
            pageInfo { hasNextPage endCursor }
            nodes {
              oid
              abbreviatedOid
              messageHeadline
              url
              committedDate
              additions
              deletions
              changedFilesIfAvailable
              author { name user { login avatarUrl } }
            }
          }
        }
      }
    }
  }
}`;

/**
 * The token account's own public, non-fork repositories and the public
 * repositories it recently contributed commits or pull requests to (GitHub
 * keeps roughly the last year for `repositoriesContributedTo`).
 */
export const GITHUB_VIEWER_REPOSITORIES_QUERY = `
query ViewerRepositories($first: Int!) {
  viewer {
    login
    repositories(first: $first, privacy: PUBLIC, ownerAffiliations: [OWNER], isFork: false, orderBy: { field: PUSHED_AT, direction: DESC }) {
      nodes { name owner { login } pushedAt }
    }
    repositoriesContributedTo(
      first: $first
      privacy: PUBLIC
      includeUserRepositories: false
      contributionTypes: [COMMIT, PULL_REQUEST]
      orderBy: { field: PUSHED_AT, direction: DESC }
    ) {
      nodes { name owner { login } pushedAt }
    }
  }
}`;
