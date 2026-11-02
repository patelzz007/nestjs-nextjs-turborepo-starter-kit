// ============================================
// notifications/presentation/http/broadcasts-admin.controller.ts — platform notices (ADR 073)
// ============================================
// Platform staff write product or account notices to users (`BROADCAST` permissions); a notice to every
// user waits for a second staff member's approval.
import { Controller, Get, HttpStatus, Inject, Post, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	BroadcastAudiencePreviewSchema,
	BroadcastAudienceSchema,
	BroadcastDraftSchema,
	BroadcastIdParamsSchema,
	BroadcastListQuerySchema,
	BroadcastResponseSchema,
	type BroadcastAudience,
	type BroadcastAudiencePreview,
	type BroadcastDraftInput,
	type BroadcastIdParams,
	type BroadcastListQuery,
	type BroadcastResponse,
	type PaginatedServiceResult,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { AdminAccessOnly } from "../../../../platform/presentation/http/security/decorators/admin-access.decorator";
import { PlatformOperation } from "../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodListQuery, ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { BROADCAST_SERVICE } from "../../application/ports/notifications.tokens";
import { BROADCASTS_AUDIENCE_OPERATION, BROADCASTS_WRITE_OPERATION, type BroadcastSender, type BroadcastService } from "../../application/services/broadcast-service";

const PLATFORM: BroadcastSender = { kind: "platform" };

/** Platform staff: notices to users (four eyes for everyone). */
@ApiTags("Broadcasts")
@ApiBearerAuth()
@AdminAccessOnly("Admin access required for broadcasts.")
@Controller(apiPath("/admin/broadcasts"))
export class BroadcastsAdminController {
	public constructor(@Inject(BROADCAST_SERVICE) private readonly broadcasts: BroadcastService) {}

	@RequirePermission("LIST", "BROADCAST")
	@PlatformOperation(BROADCASTS_WRITE_OPERATION)
	@Get()
	@ApiOperation({ summary: "Platform broadcasts, newest first" })
	@ZodPaginatedResponse(BroadcastResponseSchema, { description: "One page of broadcasts" })
	public list(@CurrentActor() actor: ActorContext, @ZodListQuery(BroadcastListQuerySchema) query: BroadcastListQuery): Promise<PaginatedServiceResult<BroadcastResponse>> {
		return this.broadcasts.list(actor, PLATFORM, query);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("CREATE", "BROADCAST")
	@PlatformOperation(BROADCASTS_AUDIENCE_OPERATION)
	@Post("audience-preview")
	@ApiOperation({ summary: "How many users the audience reaches, and how many it leaves out and why (counts only)" })
	@ZodResponse(BroadcastAudiencePreviewSchema, { status: HttpStatus.CREATED, description: "The count" })
	public preview(@CurrentActor() actor: ActorContext, @ZodBody(BroadcastAudienceSchema) audience: BroadcastAudience): Promise<BroadcastAudiencePreview> {
		return this.broadcasts.previewAudience(actor, PLATFORM, audience);
	}

	@RequirePermission("READ", "BROADCAST")
	@PlatformOperation(BROADCASTS_WRITE_OPERATION)
	@Get(":broadcastId")
	@ApiOperation({ summary: "One broadcast with its results per channel" })
	@ZodResponse(BroadcastResponseSchema, { description: "The broadcast" })
	public get(@CurrentActor() actor: ActorContext, @ZodParams(BroadcastIdParamsSchema) params: BroadcastIdParams): Promise<BroadcastResponse> {
		return this.broadcasts.get(actor, PLATFORM, params.broadcastId);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("CREATE", "BROADCAST")
	@PlatformOperation(BROADCASTS_WRITE_OPERATION)
	@Post()
	@ApiOperation({ summary: "Write a platform notice (a draft); 400 names any link that may not be sent" })
	@ZodResponse(BroadcastResponseSchema, { status: HttpStatus.CREATED, description: "The draft" })
	public create(@CurrentActor() actor: ActorContext, @ZodBody(BroadcastDraftSchema) draft: BroadcastDraftInput): Promise<BroadcastResponse> {
		return this.broadcasts.create(actor, PLATFORM, draft);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "BROADCAST")
	@PlatformOperation(BROADCASTS_WRITE_OPERATION)
	@Put(":broadcastId")
	@ApiOperation({ summary: "Edit a draft; 409 for any other status" })
	@ZodResponse(BroadcastResponseSchema, { description: "The draft" })
	public update(
		@CurrentActor() actor: ActorContext,
		@ZodParams(BroadcastIdParamsSchema) params: BroadcastIdParams,
		@ZodBody(BroadcastDraftSchema) draft: BroadcastDraftInput,
	): Promise<BroadcastResponse> {
		return this.broadcasts.update(actor, PLATFORM, params.broadcastId, draft);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("PUBLISH", "BROADCAST")
	@PlatformOperation(BROADCASTS_WRITE_OPERATION)
	@Post(":broadcastId/schedule")
	@ApiOperation({ summary: "Schedule a draft (a notice to every user waits for a second staff member's approval)" })
	@ZodResponse(BroadcastResponseSchema, { status: HttpStatus.CREATED, description: "Scheduled, or waiting for approval" })
	public schedule(@CurrentActor() actor: ActorContext, @ZodParams(BroadcastIdParamsSchema) params: BroadcastIdParams): Promise<BroadcastResponse> {
		return this.broadcasts.schedule(actor, PLATFORM, params.broadcastId);
	}

	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@RequirePermission("APPROVE", "BROADCAST")
	@PlatformOperation(BROADCASTS_WRITE_OPERATION)
	@Post(":broadcastId/approve")
	@ApiOperation({ summary: "Approve a notice to every user (never your own); 403 for the author" })
	@ZodResponse(BroadcastResponseSchema, { status: HttpStatus.CREATED, description: "Scheduled" })
	public approve(@CurrentActor() actor: ActorContext, @ZodParams(BroadcastIdParamsSchema) params: BroadcastIdParams): Promise<BroadcastResponse> {
		return this.broadcasts.approve(actor, params.broadcastId);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("DELETE", "BROADCAST")
	@PlatformOperation(BROADCASTS_WRITE_OPERATION)
	@Post(":broadcastId/cancel")
	@ApiOperation({ summary: "Cancel before sending; 409 once it is sending or sent" })
	@ZodResponse(BroadcastResponseSchema, { status: HttpStatus.CREATED, description: "Cancelled" })
	public cancel(@CurrentActor() actor: ActorContext, @ZodParams(BroadcastIdParamsSchema) params: BroadcastIdParams): Promise<BroadcastResponse> {
		return this.broadcasts.cancel(actor, PLATFORM, params.broadcastId);
	}
}
