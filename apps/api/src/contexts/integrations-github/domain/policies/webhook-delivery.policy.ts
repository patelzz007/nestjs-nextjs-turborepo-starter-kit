// What a verified GitHub webhook delivery means to us (ADR 052): which pull
// request (or repository) changed, or nothing we use. Only the fields read
// here are trusted; the rest of the body is ignored and never stored.

import { GithubWebhookEventSchema, JsonValueSchema, type GithubPullRequestChange, type GithubWebhookEvent } from "@workspace/shared";
import { z } from "zod";

/** The fields of a delivery the API reads. */
const DeliveryPayloadSchema = z.object({
	repository: z.object({ name: z.string().min(1), owner: z.object({ login: z.string().min(1) }) }),
	pull_request: z.object({ number: z.number().int().positive() }).optional(),
	/** `issue_comment` is sent for issues too; only one on a pull request (`issue.pull_request` present) is ours. */
	issue: z.object({ number: z.number().int().positive(), pull_request: z.object({}).loose().optional() }).optional(),
});

/** Longest delivery id accepted (GitHub's are UUIDs). */
const DELIVERY_ID_MAX_LENGTH = 64;
const DeliveryIdSchema = z.string().min(1).max(DELIVERY_ID_MAX_LENGTH);

/** The event GitHub sends when it tests a hook. */
const PING_EVENT = "ping";

/** The headers GitHub sends with a delivery. */
export interface GithubWebhookHeaders {
	readonly event: string | undefined;
	readonly deliveryId: string | undefined;
	readonly signature: string | undefined;
}

/** A delivery's meaning: GitHub testing the hook, nothing we use, or one change to record. */
export type GithubDeliveryReading =
	| { readonly kind: "ping" }
	| { readonly kind: "ignored" }
	| { readonly kind: "change"; readonly deliveryId: string; readonly event: GithubWebhookEvent; readonly change: GithubPullRequestChange };

/** A verified body that is still not JSON reads as nothing (then ignored), never as a crash. */
function parseJson(rawBody: Buffer): z.output<typeof JsonValueSchema> | null {
	try {
		return JsonValueSchema.parse(JSON.parse(rawBody.toString("utf8")));
	} catch {
		return null;
	}
}

/** Reads a delivery whose signature was already verified. */
export function readGithubDelivery(headers: GithubWebhookHeaders, rawBody: Buffer): GithubDeliveryReading {
	if (headers.event === PING_EVENT) {
		return { kind: "ping" };
	}
	const event = GithubWebhookEventSchema.safeParse(headers.event);
	const deliveryId = DeliveryIdSchema.safeParse(headers.deliveryId);
	const payload = DeliveryPayloadSchema.safeParse(parseJson(rawBody));
	if (!event.success || !deliveryId.success || !payload.success) {
		return { kind: "ignored" };
	}
	const { repository, pull_request: pullRequest, issue } = payload.data;
	const number = pullRequest?.number ?? (issue?.pull_request === undefined ? undefined : issue.number);
	if (number === undefined && event.data === "issue_comment") {
		// A comment on an issue, not on a pull request.
		return { kind: "ignored" };
	}
	return { kind: "change", deliveryId: deliveryId.data, event: event.data, change: { owner: repository.owner.login, repository: repository.name, number: number ?? null } };
}

/** Whether `change` is about the repository `owner/repository` (names compared without case, as GitHub does). */
export function isChangeOfRepository(change: GithubPullRequestChange, repository: { readonly owner: string; readonly repository: string }): boolean {
	return change.owner.toLowerCase() === repository.owner.toLowerCase() && change.repository.toLowerCase() === repository.repository.toLowerCase();
}
