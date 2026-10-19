import type { GithubPullRequestChange, GithubRepositoryParams } from "@workspace/shared";
import type { Observable } from "rxjs";

import type { LinkedGithubCredential } from "./github-credentials.port";

/** Where a hook delivers and how it signs — the server's own settings. */
export interface WebhookEndpoint {
	readonly url: string;
	readonly secret: string;
}

/** The server's webhook settings; `null` when this server receives no webhooks. */
export interface GithubWebhookEndpointPort {
	endpoint(): WebhookEndpoint | null;
}

/** Repository webhooks on GitHub, with the caller's token. */
export interface GithubWebhooksPort {
	canSee(linked: LinkedGithubCredential, repository: GithubRepositoryParams): Promise<boolean>;
	createHook(linked: LinkedGithubCredential, repository: GithubRepositoryParams, endpoint: WebhookEndpoint): Promise<bigint>;
	deleteHook(linked: LinkedGithubCredential, repository: GithubRepositoryParams, hookId: bigint): Promise<void>;
}

/** A repository's live subscription. */
export interface GithubWebhookSubscriptionRecord {
	readonly githubHookId: bigint;
	readonly createdAt: number;
}

/** One verified delivery to record. */
export interface GithubWebhookDeliveryInput extends GithubRepositoryParams {
	readonly deliveryId: string;
	readonly event: string;
	readonly pullRequestNumber: number | null;
	readonly receivedAt: number;
	/** What to announce once it is recorded. */
	readonly announcement: string;
}

/**
 * Live-update subscriptions and webhook deliveries (bypass-only tables, behind
 * allowlisted system operations). Races are settled in one statement each.
 */
export interface GithubWebhookStorePort {
	findLive(repository: GithubRepositoryParams, actorUserId: string): Promise<GithubWebhookSubscriptionRecord | null>;
	/** `false` when the repository already has a live one (someone else turned it on first). */
	claim(repository: GithubRepositoryParams, githubHookId: bigint, actorUserId: string): Promise<boolean>;
	/** Turns the subscription off — only if it is still `githubHookId` (compare-and-set). */
	release(repository: GithubRepositoryParams, githubHookId: bigint, actorUserId: string, nowMs: number): Promise<void>;
	/** Records a delivery and announces its change; `false` (nothing announced) for a redelivery. */
	record(delivery: GithubWebhookDeliveryInput): Promise<boolean>;
	/** Deletes deliveries received before `beforeMs`; answers how many. */
	prune(beforeMs: number): Promise<number>;
}

/** What a stream is told: a change, or "you may have missed changes — reload". */
export type GithubChangeSignal = { readonly kind: "change"; readonly change: GithubPullRequestChange } | { readonly kind: "resync" };

/** Changes announced by webhook, heard on every API instance. */
export interface GithubChangeSignalsPort {
	observe(): Observable<GithubChangeSignal>;
}
