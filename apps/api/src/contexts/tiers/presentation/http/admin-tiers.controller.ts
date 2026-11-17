// ============================================
// presentation/http/admin-tiers.controller.ts — the platform's tier rules and figures (ADR 085)
// ============================================
// The rules are platform settings: SYSTEM_SETTINGS:READ to read them, SYSTEM_SETTINGS:UPDATE to change them with a
// reason (the request audit keeps it). The distribution is an analytics figure (ANALYTICS:READ), and one customer's
// tier sits on their user page (USER:READ). There is no override: a tier is always what its rules give.

import { Controller, Get, Inject, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	AdminUserTierPathSchema,
	AdminUserTierSchema,
	apiPath,
	TierDistributionSchema,
	TierSettingsResponseSchema,
	UpdateTierSettingsSchema,
	type AdminUserTier,
	type AdminUserTierPath,
	type TierDistribution,
	type TierSettingsResponse,
	type UpdateTierSettingsInput,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { AdminAccessOnly } from "../../../../platform/presentation/http/security/decorators/admin-access.decorator";
import { PlatformOperation } from "../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { TIER_READ_SERVICE, TIER_SETTINGS_SERVICE, TIER_SETTINGS_WRITE_OPERATION, TIER_STANDING_READ_OPERATION } from "../../application/ports/tiers.tokens";
import type { TierReadService } from "../../application/services/tier-read.service";
import type { TierSettingsService } from "../../application/services/tier-settings.service";

@ApiTags("Tiers")
@ApiBearerAuth()
@AdminAccessOnly("Tier rules and figures are for the admin console.")
@Controller(apiPath("/admin/tiers"))
export class AdminTiersController {
	public constructor(
		@Inject(TIER_SETTINGS_SERVICE) private readonly settings: TierSettingsService,
		@Inject(TIER_READ_SERVICE) private readonly reads: Pick<TierReadService, "distribution">,
	) {}

	@RequirePermission("READ", "SYSTEM_SETTINGS")
	@PlatformOperation(TIER_STANDING_READ_OPERATION)
	@Get("settings")
	@ApiOperation({ summary: "The tier rules in force: thresholds, tier window, per-merchant cap, tier hold and warning days, and who last changed them" })
	@ZodResponse(TierSettingsResponseSchema, { description: "The tier rules" })
	public read(@CurrentActor() actor: ActorContext): Promise<TierSettingsResponse> {
		return this.settings.settings(actor);
	}

	@RequirePermission("UPDATE", "SYSTEM_SETTINGS")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@PlatformOperation(TIER_SETTINGS_WRITE_OPERATION)
	@Put("settings")
	@ApiOperation({ summary: "Change the tier rules, with a reason; the next nightly review applies them (a warning always comes first)" })
	@ZodResponse(TierSettingsResponseSchema, { description: "The new tier rules" })
	public update(@CurrentActor() actor: ActorContext, @ZodBody(UpdateTierSettingsSchema) input: UpdateTierSettingsInput): Promise<TierSettingsResponse> {
		return this.settings.update(actor, input);
	}

	@RequirePermission("READ", "ANALYTICS")
	@PlatformOperation(TIER_STANDING_READ_OPERATION)
	@Get("distribution")
	@ApiOperation({ summary: "How many customers stand at each tier (everyone who has claimed at a store; without a higher standing, Bronze)" })
	@ZodResponse(TierDistributionSchema, { description: "Customers per tier" })
	public distribution(@CurrentActor() actor: ActorContext): Promise<TierDistribution> {
		return this.reads.distribution(actor);
	}
}

/** One customer's tier on their admin user page (read-only). */
@ApiTags("Tiers")
@ApiBearerAuth()
@AdminAccessOnly("A customer's tier is shown in the admin console.")
@Controller(apiPath("/admin/users"))
export class AdminUserTierController {
	public constructor(@Inject(TIER_READ_SERVICE) private readonly reads: Pick<TierReadService, "userTier">) {}

	@RequirePermission("READ", "USER", { resourceId: "userId", description: "Staff read a customer's tier and tier history" })
	@PlatformOperation(TIER_STANDING_READ_OPERATION)
	@Get(":userId/tier")
	@ApiOperation({ summary: "A customer's tier, tier hold, pending demotion warning and tier history" })
	@ZodResponse(AdminUserTierSchema, { description: "The customer's tier" })
	public tier(@CurrentActor() actor: ActorContext, @ZodParams(AdminUserTierPathSchema) path: AdminUserTierPath): Promise<AdminUserTier> {
		return this.reads.userTier(actor, path.userId);
	}
}
