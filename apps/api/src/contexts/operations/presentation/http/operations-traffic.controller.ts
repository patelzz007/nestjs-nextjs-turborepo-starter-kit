// ============================================
// presentation/http/operations-traffic.controller.ts — Rate limits and Cache (ADR 071, 072)
// ============================================
// RATE_LIMIT and CACHE permissions (the Platform Developer role reads both; changing them is the Admin's).
// Every change is a state-changing request, so the audit trail records it with its reason.
import { Controller, Delete, Get, HttpStatus, Inject, Post, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	CacheOverviewSchema,
	FlushCacheSchema,
	LiftRateLimitPenaltySchema,
	OkResponseSchema,
	RateLimitsOverviewSchema,
	SetTenantRateLimitOverrideSchema,
	TenantRateLimitOverrideListSchema,
	TenantRateLimitOverrideSchema,
	type CacheOverview,
	type FlushCacheInput,
	type LiftRateLimitPenaltyInput,
	type OkResponse,
	type RateLimitsOverview,
	type SetTenantRateLimitOverrideInput,
	type TenantRateLimitOverride,
} from "@workspace/shared";
import { z } from "zod";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { AuthorizationError } from "../../../../platform/application/errors/app-error";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { AdminAccessOnly } from "../../../../platform/presentation/http/security/decorators/admin-access.decorator";
import { PlatformOperation } from "../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { RATE_LIMIT_OVERRIDES_OPERATION } from "../../../../platform/application/shared-system-operations";
import { OPERATIONS_TRAFFIC } from "../../application/ports/operations.tokens";
import type { OperationsTrafficService } from "../../application/services/operations-traffic";

const OverrideIdParamsSchema = z.object({ overrideId: z.uuid() }).strict();

function staffUserId(actor: ActorContext): string {
	if (actor.kind !== "user") {
		throw new AuthorizationError({ message: "Only a signed-in staff member changes rate limits" });
	}
	return actor.userId;
}

@ApiTags("Operations")
@ApiBearerAuth()
@AdminAccessOnly("Admin access required for rate limits and the cache.")
@Controller(apiPath("/admin/operations"))
export class OperationsTrafficController {
	public constructor(@Inject(OPERATIONS_TRAFFIC) private readonly traffic: OperationsTrafficService) {}

	@RequirePermission("LIST", "RATE_LIMIT")
	@Get("rate-limits")
	@ApiOperation({ summary: "Every rate-limit policy, refusals over the last hour, the most limited subjects (masked) and the exemptions" })
	@ZodResponse(RateLimitsOverviewSchema, { description: "Rate limits" })
	public rateLimits(): Promise<RateLimitsOverview> {
		return this.traffic.rateLimits();
	}

	@RequirePermission("LIST", "RATE_LIMIT")
	@PlatformOperation(RATE_LIMIT_OVERRIDES_OPERATION)
	@Get("rate-limits/overrides")
	@ApiOperation({ summary: "Live tenant overrides, soonest expiry first" })
	@ZodResponse(TenantRateLimitOverrideListSchema, { description: "Overrides" })
	public async overrides(@CurrentActor() actor: ActorContext): Promise<TenantRateLimitOverride[]> {
		return [...(await this.traffic.overrides(staffUserId(actor)))];
	}

	@RequirePermission("UPDATE", "RATE_LIMIT")
	@PlatformOperation(RATE_LIMIT_OVERRIDES_OPERATION)
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Put("rate-limits/overrides")
	@ApiOperation({ summary: "Set a tenant's limit for one policy until it expires (replaces its current override); 404 for an unknown tenant" })
	@ZodResponse(TenantRateLimitOverrideSchema, { description: "The override" })
	public setOverride(
		@CurrentActor() actor: ActorContext,
		@ZodBody(SetTenantRateLimitOverrideSchema) input: SetTenantRateLimitOverrideInput,
	): Promise<TenantRateLimitOverride> {
		return this.traffic.setOverride(input, staffUserId(actor));
	}

	@RequirePermission("UPDATE", "RATE_LIMIT")
	@PlatformOperation(RATE_LIMIT_OVERRIDES_OPERATION)
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Delete("rate-limits/overrides/:overrideId")
	@ApiOperation({ summary: "End an override now (the tenant goes back to the default); 404 when there is none" })
	@ZodResponse(OkResponseSchema, { description: "Ended" })
	public async removeOverride(@CurrentActor() actor: ActorContext, @ZodParams(OverrideIdParamsSchema) params: z.output<typeof OverrideIdParamsSchema>): Promise<OkResponse> {
		await this.traffic.removeOverride(params.overrideId, staffUserId(actor));
		return { ok: true };
	}

	@RequirePermission("UPDATE", "RATE_LIMIT")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Post("rate-limits/penalties/lift")
	@ApiOperation({ summary: "Lift a subject's penalty from its overview row (opaque reference, with a reason); 404 once it has left the refusal log" })
	@ZodResponse(OkResponseSchema, { status: HttpStatus.CREATED, description: "Lifted" })
	public async liftPenalty(@ZodBody(LiftRateLimitPenaltySchema) input: LiftRateLimitPenaltyInput): Promise<OkResponse> {
		await this.traffic.liftPenalty(input);
		return { ok: true };
	}

	@RequirePermission("READ", "CACHE")
	@Get("cache")
	@ApiOperation({ summary: "Every cache namespace with its counters (this instance), Redis memory and the circuit state" })
	@ZodResponse(CacheOverviewSchema, { description: "The cache" })
	public cache(): Promise<CacheOverview> {
		return this.traffic.cache();
	}

	@RequirePermission("DELETE", "CACHE")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Post("cache/flush")
	@ApiOperation({ summary: "Drop one cache namespace, or one tenant's entries in every tenant cache, on every instance (with a reason)" })
	@ZodResponse(OkResponseSchema, { status: HttpStatus.CREATED, description: "Flushed" })
	public async flushCache(@ZodBody(FlushCacheSchema) input: FlushCacheInput): Promise<OkResponse> {
		await this.traffic.flushCache(input);
		return { ok: true };
	}
}
