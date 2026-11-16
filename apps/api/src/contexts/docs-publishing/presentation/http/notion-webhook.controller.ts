import { Controller, HttpCode, HttpStatus, Post, Req, type RawBodyRequest } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import { apiPath, NOTION_WEBHOOK_PATH } from "@workspace/shared";
import type { FastifyRequest } from "fastify";
import { z } from "zod";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { Public } from "../../../../platform/presentation/http/security/decorators/public.decorator";
import { SkipMutationIntent } from "../../../../platform/presentation/http/security/decorators/skip-mutation-intent.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { inboundWebhookRequest } from "../../../webhooks/inbound/public-api";
import { ReceiveNotionWebhookCommand } from "../../application/commands/receive-notion-webhook/receive-notion-webhook.command";

const NotionWebhookReceivedSchema = z.object({
	received: z.literal(true),
	outcome: z.enum(["handshake", "dispatched", "duplicate", "ignored"]),
});
type NotionWebhookReceived = z.output<typeof NotionWebhookReceivedSchema>;

/**
 * Notion's webhook receiver (ADR 084). Public, because Notion has no session, and verified instead: the
 * `X-Notion-Signature` HMAC of the exact raw body, checked before anything is parsed. The one request it
 * accepts without checking the signature is the handshake, and only while no secret is configured. It replies at once: it starts a sync and does
 * nothing else.
 */
@ApiTags("Docs publishing")
@Controller(apiPath(NOTION_WEBHOOK_PATH))
export class NotionWebhookController {
	public constructor(private readonly commandBus: CommandBus) {}

	@RateLimit(RATE_LIMIT_POLICY.webhook)
	@Public()
	// Not a session-authenticated mutation: the signature over the body is the only credential.
	@SkipMutationIntent()
	@Post()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Receive a Notion webhook event" })
	@ApiHeader({
		name: "X-Notion-Signature",
		required: false,
		description: "`sha256=` + HMAC-SHA256 of the raw body with the verification token; not checked on the first handshake, which delivers that token",
	})
	@ZodResponse(NotionWebhookReceivedSchema, { description: "The event was verified, or the handshake was kept" })
	public async receive(@CurrentActor({ allowAnonymous: true }) actor: ActorContext, @Req() request: RawBodyRequest<FastifyRequest>): Promise<NotionWebhookReceived> {
		const outcome = await this.commandBus.execute(new ReceiveNotionWebhookCommand(actor, inboundWebhookRequest(request.rawBody, request.headers)));
		return { received: true, outcome };
	}
}
