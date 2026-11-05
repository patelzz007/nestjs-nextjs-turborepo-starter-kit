import { Controller, Get } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiContract,
	apiPath,
	ReceivedWebhookDetailSchema,
	ReceivedWebhookSummarySchema,
	type PaginatedServiceResult,
	type ReceivedWebhookDetail,
	type ReceivedWebhookIdParam,
	type ReceivedWebhookListQuery,
	type ReceivedWebhookSummary,
} from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../../platform/presentation/http/security/current-actor.decorator";
import { AdminAccessOnly } from "../../../../../platform/presentation/http/security/decorators/admin-access.decorator";
import { PlatformOperation } from "../../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { RequirePermission } from "../../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { ZodListQuery, ZodParams } from "../../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { WEBHOOKS_INBOUND_READ_OPERATION } from "../../application/ports/webhooks-inbound.tokens";
import { GetReceivedWebhookQuery } from "../../application/queries/get-received-webhook/get-received-webhook.query";
import { ListReceivedWebhooksQuery } from "../../application/queries/list-received-webhooks/list-received-webhooks.query";

/**
 * Admin viewer for the received-webhook log (ADR 081): every request a provider sent this server,
 * what its signature check said and what it came to. No payload is kept, so nothing here can leak
 * one; headers are an allowlist without any signature or credential.
 *
 * Authorization: the same as the audit log it sits beside — admin-panel access AND the `AUDIT_LOG`
 * permission (`LIST` for the table, `READ` for one complete row). The controller only validates and
 * dispatches one query.
 */
@ApiTags("Received webhooks")
@AdminAccessOnly("Admin access required to view received webhooks.")
@PlatformOperation(WEBHOOKS_INBOUND_READ_OPERATION)
@Controller(apiPath("/admin/webhooks/received"))
export class ReceivedWebhooksController {
	public constructor(private readonly queryBus: QueryBus) {}

	@RequirePermission("LIST", "AUDIT_LOG")
	@Get()
	@ApiOperation({
		summary: "List received webhooks (newest first)",
		description: "Filter by provider, outcome or verification; search the delivery id, event or correlation id.",
	})
	@ZodPaginatedResponse(ReceivedWebhookSummarySchema, { description: "Paginated received webhooks; pagination is in `meta`" })
	public async list(
		@CurrentActor() actor: ActorContext,
		@ZodListQuery(apiContract.receivedWebhooks.list.input) query: ReceivedWebhookListQuery,
	): Promise<PaginatedServiceResult<ReceivedWebhookSummary>> {
		return this.queryBus.execute(new ListReceivedWebhooksQuery(actor, query));
	}

	@RequirePermission("READ", "AUDIT_LOG")
	@Get(":id")
	@ApiOperation({ summary: "Get one received webhook", description: "Includes the payload's SHA-256 and size, the kept headers and why it was refused or failed." })
	@ZodResponse(ReceivedWebhookDetailSchema, { description: "The complete received webhook" })
	public async get(@CurrentActor() actor: ActorContext, @ZodParams(apiContract.receivedWebhooks.detail.input) params: ReceivedWebhookIdParam): Promise<ReceivedWebhookDetail> {
		return this.queryBus.execute(new GetReceivedWebhookQuery(actor, params));
	}
}
