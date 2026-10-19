// ============================================
// github-pull-requests.queries.ts - The GraphQL documents for pull requests
// ============================================
// Static text: every value travels as a GraphQL variable, never interpolated.
// Each field read here has a matching entry in
// `github-pull-requests.wire-schemas.ts`.

import { GITHUB_PULL_REQUEST_LABELS_MAX, GITHUB_REQUESTED_REVIEWERS_MAX, GITHUB_REVIEW_COMMENTS_SHOWN_MAX } from "@workspace/shared";

const ACTOR_FIELDS = "login avatarUrl";

/** Each of GitHub's reactions with how many chose it and whether the viewer did. */
const REACTION_FIELDS = "reactionGroups { content viewerHasReacted reactors { totalCount } }";

/** `bodyHTML` is read for the image links in it only (signed links to uploads, the image proxy for the rest). */
/** `fullDatabaseId` (a string — the ids outgrew 32 bits) is what GitHub's REST reactions address a comment by. */
const COMMENT_FIELDS = `id fullDatabaseId author { ${ACTOR_FIELDS} } body bodyHTML ${REACTION_FIELDS} createdAt lastEditedAt viewerCanUpdate viewerDidAuthor url`;

const REVIEW_COMMENT_FIELDS = `${COMMENT_FIELDS} path line originalLine diffHunk`;

/** What a list row shows. */
const PULL_REQUEST_SUMMARY_FIELDS = `
  number title state isDraft createdAt updatedAt url reviewDecision
  repository { name owner { login } }
  author { ${ACTOR_FIELDS} }
  comments { totalCount }
  labels(first: ${String(GITHUB_PULL_REQUEST_LABELS_MAX)}) { nodes { name color } }`;

/** The conversation entries the app shows, in GitHub's type names. */
export const GITHUB_TIMELINE_ITEM_TYPES: readonly string[] = [
	"ISSUE_COMMENT",
	"PULL_REQUEST_REVIEW",
	"PULL_REQUEST_COMMIT",
	"CLOSED_EVENT",
	"REOPENED_EVENT",
	"MERGED_EVENT",
	"READY_FOR_REVIEW_EVENT",
	"CONVERT_TO_DRAFT_EVENT",
	"REVIEW_REQUESTED_EVENT",
	"LABELED_EVENT",
	"UNLABELED_EVENT",
	"HEAD_REF_FORCE_PUSHED_EVENT",
	"RENAMED_TITLE_EVENT",
];

/** A review with the first of its line comments — in the conversation, and as a submitted review comes back. */
const REVIEW_FIELDS = `
    ${COMMENT_FIELDS} state submittedAt
    comments(first: ${String(GITHUB_REVIEW_COMMENTS_SHOWN_MAX)}) { totalCount nodes { ${REVIEW_COMMENT_FIELDS} } }`;

const EVENT_FIELDS = `actor { ${ACTOR_FIELDS} } createdAt`;

/** One conversation entry, whichever kind it is (`__typename` tells them apart). */
const TIMELINE_ITEM_FIELDS = `
  __typename
  ... on IssueComment { ${COMMENT_FIELDS} }
  ... on PullRequestReview { ${REVIEW_FIELDS} }
  ... on PullRequestCommit { commit { oid abbreviatedOid messageHeadline committedDate author { name user { ${ACTOR_FIELDS} } } } }
  ... on ClosedEvent { ${EVENT_FIELDS} }
  ... on ReopenedEvent { ${EVENT_FIELDS} }
  ... on MergedEvent { ${EVENT_FIELDS} mergeRefName }
  ... on ReadyForReviewEvent { ${EVENT_FIELDS} }
  ... on ConvertToDraftEvent { ${EVENT_FIELDS} }
  ... on ReviewRequestedEvent { ${EVENT_FIELDS} requestedReviewer { __typename ... on User { login } ... on Bot { login } ... on Team { name } ... on Mannequin { login } } }
  ... on LabeledEvent { ${EVENT_FIELDS} label { name } }
  ... on UnlabeledEvent { ${EVENT_FIELDS} label { name } }
  ... on HeadRefForcePushedEvent { ${EVENT_FIELDS} }
  ... on RenamedTitleEvent { ${EVENT_FIELDS} currentTitle }`;

const TIMELINE_CONNECTION = `
  timelineItems(first: $first, after: $after, itemTypes: [${GITHUB_TIMELINE_ITEM_TYPES.join(", ")}]) {
    pageInfo { hasNextPage endCursor }
    nodes { ${TIMELINE_ITEM_FIELDS} }
  }`;

/** A page of the search the list is built from. */
export const GITHUB_PULL_REQUEST_SEARCH_QUERY = `
query PullRequestSearch($query: String!, $first: Int!, $after: String) {
  search(query: $query, type: ISSUE, first: $first, after: $after) {
    issueCount
    pageInfo { hasNextPage endCursor }
    nodes { __typename ... on PullRequest { ${PULL_REQUEST_SUMMARY_FIELDS} } }
  }
}`;

/** One pull request with the first page of its conversation. */
export const GITHUB_PULL_REQUEST_DETAIL_QUERY = `
query PullRequestDetail($owner: String!, $name: String!, $number: Int!, $first: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      id ${PULL_REQUEST_SUMMARY_FIELDS}
      body bodyHTML ${REACTION_FIELDS} lastEditedAt baseRefName headRefName isCrossRepository headRepositoryOwner { login }
      additions deletions changedFiles commits { totalCount }
      mergedAt closedAt viewerDidAuthor viewerCanUpdate
      reviewRequests(first: ${String(GITHUB_REQUESTED_REVIEWERS_MAX)}) {
        nodes { requestedReviewer { __typename ... on User { ${ACTOR_FIELDS} } ... on Bot { ${ACTOR_FIELDS} } ... on Mannequin { ${ACTOR_FIELDS} } } }
      }
      ${TIMELINE_CONNECTION}
    }
  }
}`;

/** A later page of a pull request's conversation. */
export const GITHUB_PULL_REQUEST_TIMELINE_QUERY = `
query PullRequestTimeline($owner: String!, $name: String!, $number: Int!, $first: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) { ${TIMELINE_CONNECTION} }
  }
}`;

/** A page of a pull request's commits, oldest first. */
export const GITHUB_PULL_REQUEST_COMMITS_QUERY = `
query PullRequestCommits($owner: String!, $name: String!, $number: Int!, $first: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      commits(first: $first, after: $after) {
        totalCount
        pageInfo { hasNextPage endCursor }
        nodes {
          commit {
            oid abbreviatedOid messageHeadline url committedDate additions deletions changedFilesIfAvailable
            author { name user { ${ACTOR_FIELDS} } }
          }
        }
      }
    }
  }
}`;

/** The conversations on lines of the diff. */
export const GITHUB_PULL_REQUEST_REVIEW_THREADS_QUERY = `
query PullRequestReviewThreads($owner: String!, $name: String!, $number: Int!, $threads: Int!, $comments: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      headRefOid
      reviewThreads(first: $threads) {
        totalCount
        nodes {
          id path line originalLine diffSide isResolved isOutdated
          comments(first: $comments) { nodes { ${REVIEW_COMMENT_FIELDS} } }
        }
      }
    }
  }
}`;

/** The head commit a page of files belongs to. */
export const GITHUB_PULL_REQUEST_HEAD_QUERY = `
query PullRequestHead($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) { headRefOid }
  }
}`;

/** Every saved version of a comment, review or description. */
export const GITHUB_CONTENT_EDITS_QUERY = `
query ContentEdits($id: ID!, $first: Int!) {
  node(id: $id) {
    __typename
    ... on UserContentEditable {
      userContentEdits(first: $first) {
        totalCount
        nodes { editedAt deletedAt diff editor { ${ACTOR_FIELDS} } }
      }
    }
  }
}`;

/**
 * Whether and how the pull request can be merged: whether the branch merges cleanly (GitHub works it
 * out lazily and answers UNKNOWN until it has), GitHub's verdict on merging now, the head commit, and
 * the repository's merge settings.
 */
export const GITHUB_PULL_REQUEST_MERGEABILITY_QUERY = `
query PullRequestMergeability($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    mergeCommitAllowed squashMergeAllowed rebaseMergeAllowed deleteBranchOnMerge viewerDefaultMergeMethod
    pullRequest(number: $number) { mergeable mergeStateStatus headRefOid headRefName isCrossRepository }
  }
}`;

/** The head commit's checks: GitHub's rollup and its counts per state (the counts cover every check, whatever \`first\` is). */
export const GITHUB_PULL_REQUEST_CHECKS_QUERY = `
query PullRequestChecks($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      commits(last: 1) {
        nodes {
          commit {
            statusCheckRollup {
              state
              contexts(first: 1) {
                checkRunCountsByState { state count }
                statusContextCountsByState { state count }
              }
            }
          }
        }
      }
    }
  }
}`;

/** Where a branch points, or `ref: null` when the repository has no such branch. */
export const GITHUB_BRANCH_HEAD_QUERY = `
query BranchHead($owner: String!, $name: String!, $ref: String!) {
  repository(owner: $owner, name: $name) {
    ref(qualifiedName: $ref) { target { oid } }
  }
}`;

/** Whether a file is on a branch (`object: null` when it is not). */
export const GITHUB_FILE_EXISTS_QUERY = `
query FileExists($owner: String!, $name: String!, $expression: String!) {
  repository(owner: $owner, name: $name) {
    object(expression: $expression) { __typename }
  }
}`;

/** The rendered body of a pull request, comment, review or line comment — read afresh for GitHub's signed links to its uploads. */
export const GITHUB_NODE_BODY_HTML_QUERY = `
query NodeBodyHtml($id: ID!) {
  node(id: $id) {
    ... on PullRequest { bodyHTML }
    ... on IssueComment { bodyHTML }
    ... on PullRequestReview { bodyHTML }
    ... on PullRequestReviewComment { bodyHTML }
  }
}`;

/** Whether the token can see a repository at all (`repository: null` when it cannot). */
export const GITHUB_REPOSITORY_VISIBLE_QUERY = `
query RepositoryVisible($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) { id }
}`;
