import { Controller, Get, Headers, HttpCode, HttpStatus, Post, Req, type RawBodyRequest } from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import { apiPath } from "@workspace/shared";
import { z } from "zod";

import { ZodResponse } from "../../../common/decorators/zod-response.decorators";
import { Public } from "../../auth/decorators/public.decorator";
import { SkipMutationIntent } from "../../auth/decorators/skip-mutation-intent.decorator";
import { GithubLiveUpdatesService } from "./github-live-updates.service";

const GithubWebhookReceivedSchema = z.object({
	received: z.literal(true),
	/** `recorded`, `duplicate` (a redelivery), `ping` (GitHub testing the hook) or `ignored` (an event this server does not use). */
	outcome: z.enum(["recorded", "duplicate", "ping", "ignored"]),
});
type GithubWebhookReceived = z.output<typeof GithubWebhookReceivedSchema>;

const GithubWebhookInfoSchema = z.object({ message: z.string() });
type GithubWebhookInfo = z.output<typeof GithubWebhookInfoSchema>;

/**
 * GitHub's webhook receiver for live pull-request updates (ADR 052), at
 * `/api/v1/github/webhook`. Each repository's hook is registered with
 * `GITHUB_WEBHOOK_URL` when live updates are turned on, so a new API version
 * re-points hooks by turning them on again. Public —
 * GitHub has no session — and verified instead: the `X-Hub-Signature-256` HMAC
 * of the exact raw body with `GITHUB_WEBHOOK_SECRET`, checked before anything
 * is parsed (403 otherwise). 503 `GITHUB_LIVE_UPDATES_OFF` when this server
 * receives no webhooks.
 */
@ApiTags("GitHub pull requests")
@Controller(apiPath("/github/webhook"))
export class GithubWebhookController {
	public constructor(private readonly liveUpdates: GithubLiveUpdatesService) {}

	@Public()
	@Get()
	@ApiOperation({ summary: "What this address is (GitHub posts webhook deliveries here)" })
	@ZodResponse(GithubWebhookInfoSchema, { description: "A short explanation" })
	public info(): GithubWebhookInfo {
		return { message: "GitHub webhook receiver for live pull-request updates. GitHub POSTs signed deliveries here." };
	}

	@Public()
	// Not a session-authenticated mutation: the signature over the body is the only credential.
	@SkipMutationIntent()
	@Post()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Receive a GitHub webhook delivery" })
	@ApiHeader({ name: "X-Hub-Signature-256", required: true, description: "`sha256=` + HMAC-SHA256 of the raw body with the webhook secret" })
	@ApiHeader({ name: "X-GitHub-Event", required: true, description: "The event's kind" })
	@ApiHeader({ name: "X-GitHub-Delivery", required: true, description: "The delivery's id — a redelivery is recognised by it" })
	@ZodResponse(GithubWebhookReceivedSchema, { description: "The delivery was verified" })
	public async receive(@Req() request: RawBodyRequest<FastifyRequest>, @Headers() headers: Record<string, string | undefined>): Promise<GithubWebhookReceived> {
		const outcome = await this.liveUpdates.receive(
			{ event: headers["x-github-event"], deliveryId: headers["x-github-delivery"], signature: headers["x-hub-signature-256"] },
			request.rawBody ?? Buffer.alloc(0),
		);
		return { received: true, outcome };
	}
}
