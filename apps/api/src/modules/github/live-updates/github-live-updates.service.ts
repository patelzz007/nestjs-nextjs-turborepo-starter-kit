// ============================================
// github-live-updates.service.ts - Live pull-request updates (ADR 052)
// ============================================
// Turning on: the admin's token registers one webhook on the repository; the
// row in `github_webhook_subscriptions` is shared by every admin. Receiving: a
// delivery is checked against the webhook secret before anything in it is read,
// recorded once by its delivery id (GitHub redelivers), and announced to every
// API instance (GithubPullRequestChangesHub). Streaming: an admin listens to
// one repository at a time — the API first checks, with their own token, that
// they can see it, so no one learns of activity in a repository GitHub does not
// show them. A change names the pull request, never its content.

import { ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import {
	epochMs,
	GithubWebhookEventSchema,
	JsonValueSchema,
	type GithubLiveUpdatesParams,
	type GithubLiveUpdatesStatus,
	type GithubPullRequestChange,
} from "@workspace/shared";
import { filter, type Observable } from "rxjs";
import { z } from "zod";

import { TypedConfigService } from "../../../config/typed-config.service";
import { GITHUB_CLOCK } from "../github-contributions.service";
import type { GithubClock } from "../github-response.cache";
import { GithubWriteRejectedError } from "../github.errors";
import { GithubCredentialsService } from "../pull-requests/github-credentials.service";
import { GithubPullRequestChangesHub, type GithubChangeSignal } from "./github-pull-request-changes.hub";
import { GithubWebhookRepository } from "./github-webhook.repository";
import { isValidGithubWebhookSignature } from "./github-webhook-signature";
import { GithubWebhooksClient } from "./github-webhooks.client";

/** Error code when this server receives no webhooks. */
export const GITHUB_LIVE_UPDATES_OFF_CODE = "GITHUB_LIVE_UPDATES_OFF";

/** What a delivery came to. */
export type GithubWebhookOutcome = "recorded" | "duplicate" | "ping" | "ignored";

/** The headers GitHub sends with a delivery. */
export interface GithubWebhookHeaders {
	readonly event: string | undefined;
	readonly deliveryId: string | undefined;
	readonly signature: string | undefined;
}

/** The fields of a delivery the API reads — the rest is ignored, never stored. */
const DeliveryPayloadSchema = z.object({
	repository: z.object({ name: z.string().min(1), owner: z.object({ login: z.string().min(1) }) }),
	pull_request: z.object({ number: z.number().int().positive() }).optional(),
	/** `issue_comment` is sent for issues too; only one on a pull request (`issue.pull_request` present) is ours. */
	issue: z.object({ number: z.number().int().positive(), pull_request: z.object({}).loose().optional() }).optional(),
});

const DeliveryIdSchema = z.string().min(1).max(64);

/** A verified body that is still not JSON reads as nothing (then ignored), never as a crash. */
function parseJson(rawBody: Buffer): z.output<typeof JsonValueSchema> | null {
	try {
		return JsonValueSchema.parse(JSON.parse(rawBody.toString("utf8")));
	} catch {
		return null;
	}
}

function liveUpdatesOff(): ServiceUnavailableException {
	return new ServiceUnavailableException({ message: "Live updates are not set up on this server.", error: GITHUB_LIVE_UPDATES_OFF_CODE });
}

@Injectable()
export class GithubLiveUpdatesService {
	public constructor(
		private readonly config: TypedConfigService,
		private readonly credentials: GithubCredentialsService,
		private readonly webhooks: GithubWebhooksClient,
		private readonly subscriptions: GithubWebhookRepository,
		private readonly hub: GithubPullRequestChangesHub,
		@Inject(GITHUB_CLOCK) private readonly clock: GithubClock,
	) {}

	public async status(userId: string, params: GithubLiveUpdatesParams): Promise<GithubLiveUpdatesStatus> {
		if (this.config.github.webhook === null) {
			return { status: "off" };
		}
		const live = await this.subscriptions.findLive(params, userId);
		return live === null ? { status: "disabled" } : { status: "enabled", enabledAt: epochMs(live.createdAt) };
	}

	/**
	 * Registers the repository's webhook with the caller's token. Already on is
	 * left as it is. Two admins turning it on at once: GitHub keeps one hook per
	 * address and the database one row per repository, so both end up on the one.
	 */
	public async enable(userId: string, params: GithubLiveUpdatesParams): Promise<GithubLiveUpdatesStatus> {
		const endpoint = this.config.github.webhook;
		if (endpoint === null) {
			throw liveUpdatesOff();
		}
		const current = await this.status(userId, params);
		if (current.status === "enabled") {
			return current;
		}
		await this.credentials.withCredential(userId, async ({ credential }) => {
			const hookId = await this.createOrAdoptHook(credential, params, endpoint);
			const claimed = await this.subscriptions.claim(params, hookId, userId);
			const live = claimed ? null : await this.subscriptions.findLive(params, userId);
			if (live !== null && live.githubHookId !== hookId) {
				// Someone else's hook won the row; ours would deliver every change twice.
				await this.webhooks.deleteHook(credential, params, hookId);
			}
		});
		return this.status(userId, params);
	}

	/** Deletes the repository's webhook with the caller's token, then turns the row off. Already off is left as it is. */
	public async disable(userId: string, params: GithubLiveUpdatesParams): Promise<GithubLiveUpdatesStatus> {
		if (this.config.github.webhook === null) {
			return { status: "off" };
		}
		const live = await this.subscriptions.findLive(params, userId);
		if (live !== null) {
			await this.credentials.withCredential(userId, ({ credential }) => this.webhooks.deleteHook(credential, params, live.githubHookId));
			await this.subscriptions.release(params, live.githubHookId, userId, this.clock.nowEpochMs());
		}
		return this.status(userId, params);
	}

	/** One delivery from GitHub: verified, recorded once, announced. */
	public async receive(headers: GithubWebhookHeaders, rawBody: Buffer): Promise<GithubWebhookOutcome> {
		const endpoint = this.config.github.webhook;
		if (endpoint === null) {
			throw liveUpdatesOff();
		}
		if (!isValidGithubWebhookSignature(endpoint.secret, rawBody, headers.signature)) {
			throw new ForbiddenException({ message: "The webhook signature does not match", error: "GITHUB_WEBHOOK_SIGNATURE_INVALID" });
		}
		if (headers.event === "ping") {
			return "ping";
		}
		const event = GithubWebhookEventSchema.safeParse(headers.event);
		const deliveryId = DeliveryIdSchema.safeParse(headers.deliveryId);
		const payload = DeliveryPayloadSchema.safeParse(parseJson(rawBody));
		if (!event.success || !deliveryId.success || !payload.success) {
			return "ignored";
		}
		const { repository, pull_request: pullRequest, issue } = payload.data;
		const number = pullRequest?.number ?? (issue?.pull_request === undefined ? undefined : issue.number);
		if (number === undefined && event.data === "issue_comment") {
			// A comment on an issue, not on a pull request.
			return "ignored";
		}
		const change: GithubPullRequestChange = { owner: repository.owner.login, repository: repository.name, number: number ?? null };
		const recorded = await this.subscriptions.record({
			deliveryId: deliveryId.data,
			event: event.data,
			owner: change.owner,
			repository: change.repository,
			pullRequestNumber: change.number,
			receivedAt: this.clock.nowEpochMs(),
			announcement: JSON.stringify(change),
		});
		return recorded ? "recorded" : "duplicate";
	}

	/** Refuses (404, as GitHub answers) a stream of a repository the caller's own token cannot see; 503 when live updates are off. */
	public async assertCanStream(userId: string, params: GithubLiveUpdatesParams): Promise<void> {
		if (this.config.github.webhook === null) {
			throw liveUpdatesOff();
		}
		const visible = await this.credentials.withCredential(userId, ({ credential }) => this.webhooks.canSee(credential, params));
		if (!visible) {
			throw new NotFoundException({ message: "This repository could not be found on GitHub, or your GitHub token cannot see it." });
		}
	}

	/** The changes of one repository (names compared without case), and every resync — for a caller `assertCanStream` let through. */
	public changes(params: GithubLiveUpdatesParams): Observable<GithubChangeSignal> {
		const owner = params.owner.toLowerCase();
		const repository = params.repository.toLowerCase();
		return this.hub
			.observe()
			.pipe(
				filter(
					(signal: GithubChangeSignal): boolean =>
						signal.kind === "resync" || (signal.change.owner.toLowerCase() === owner && signal.change.repository.toLowerCase() === repository),
				),
			);
	}

	/** GitHub answers a second hook with the same address on one repository 422: the existing one is adopted instead. */
	private async createOrAdoptHook(
		credential: Parameters<GithubWebhooksClient["createHook"]>[0],
		params: GithubLiveUpdatesParams,
		endpoint: { readonly url: string; readonly secret: string },
	): Promise<bigint> {
		try {
			return await this.webhooks.createHook(credential, params, endpoint);
		} catch (error: unknown) {
			if (error instanceof GithubWriteRejectedError && error.refusal === "unprocessable") {
				return this.webhooks.createHook(credential, params, endpoint);
			}
			throw error;
		}
	}
}
