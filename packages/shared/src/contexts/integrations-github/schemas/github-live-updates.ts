// ============================================
// github-live-updates.ts - Pull requests that update by themselves (ADR 052)
// ============================================
// An admin turns live updates on for a repository: the API registers a
// webhook there with their token, GitHub then tells the API about every
// change to its pull requests (verified by signature), and the API tells the
// apps over Server-Sent Events. An event names what changed — never its
// content: the app reads it again, with its own token.

import { z } from "zod";

import { EpochMsSchema } from "../../../schemas/api/common";
import { GithubOwnerSchema, GithubRepositoryNameSchema } from "./github-contributions";

/** `/github/live-updates/:owner/:repository`. */
export const GithubLiveUpdatesParamsSchema = z.object({ owner: GithubOwnerSchema, repository: GithubRepositoryNameSchema }).strict();
export type GithubLiveUpdatesParams = z.output<typeof GithubLiveUpdatesParamsSchema>;

/**
 * Live updates of one repository:
 * - `off` — this server receives no webhooks (`GITHUB_WEBHOOK_URL` / `GITHUB_WEBHOOK_SECRET` unset);
 * - `disabled` — nobody has turned them on for it;
 * - `enabled` — a webhook is registered; changes arrive on `GET /github/pull-requests/events`.
 */
export const GithubLiveUpdatesStatusSchema = z.discriminatedUnion("status", [
	z.object({ status: z.literal("off") }),
	z.object({ status: z.literal("disabled") }),
	z.object({ status: z.literal("enabled"), enabledAt: EpochMsSchema }),
]);
export type GithubLiveUpdatesStatus = z.output<typeof GithubLiveUpdatesStatusSchema>;

/** Kinds of GitHub events the API listens to: everything a pull request's screens show. */
export const GithubWebhookEventSchema = z.enum(["pull_request", "pull_request_review", "pull_request_review_comment", "pull_request_review_thread", "issue_comment"]);
export type GithubWebhookEvent = z.output<typeof GithubWebhookEventSchema>;
export const GITHUB_WEBHOOK_EVENTS: readonly GithubWebhookEvent[] = GithubWebhookEventSchema.options;

/** One change to a repository's pull requests, as the event stream sends it. */
export const GithubPullRequestChangeSchema = z.object({
	owner: GithubOwnerSchema,
	repository: GithubRepositoryNameSchema,
	/** The pull request that changed; `null` when GitHub did not say which (the app reloads the repository's list). */
	number: z.number().int().positive().nullable(),
});
export type GithubPullRequestChange = z.output<typeof GithubPullRequestChangeSchema>;

/** Whether `change` is about the pull request `owner/repository#number` — names compared as GitHub does, ignoring case. */
export function isChangeTo(change: GithubPullRequestChange, pullRequest: { readonly owner: string; readonly repository: string; readonly number: number }): boolean {
	return (
		change.owner.toLowerCase() === pullRequest.owner.toLowerCase() &&
		change.repository.toLowerCase() === pullRequest.repository.toLowerCase() &&
		(change.number === null || change.number === pullRequest.number)
	);
}
