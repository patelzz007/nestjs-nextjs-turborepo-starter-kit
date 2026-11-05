// ============================================
// presentation/http/feature-flags.controller.ts — runtime feature flags (enhancement 5.6)
// ============================================
// The settings are readable by any admin staff member (the console evaluates them for everyone); the list with
// who changed what needs FEATURE_FLAG:LIST, and a change FEATURE_FLAG:UPDATE with a reason (audited). A store flag
// also has per-store settings (enhancement 5.11): read with LIST, set and removed with UPDATE, each with a reason.

import { Controller, Get, HttpCode, HttpStatus, Inject, Post, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	FeatureFlagListSchema,
	FeatureFlagPathSchema,
	FeatureFlagSchema,
	FeatureFlagSettingsSchema,
	FeatureFlagStoreOptionListSchema,
	FeatureFlagStoreSearchQuerySchema,
	FeatureFlagStoreOverrideListSchema,
	FeatureFlagStoreOverridePathSchema,
	FeatureFlagStoreOverrideSchema,
	OkResponseSchema,
	RemoveFeatureFlagStoreOverrideSchema,
	SetFeatureFlagStoreOverrideSchema,
	StoreFeatureFlagPathSchema,
	UpdateFeatureFlagSchema,
	type FeatureFlag,
	type FeatureFlagList,
	type FeatureFlagPath,
	type FeatureFlagSettings,
	type FeatureFlagStoreOptionList,
	type FeatureFlagStoreSearchQuery,
	type FeatureFlagStoreOverride,
	type FeatureFlagStoreOverrideList,
	type FeatureFlagStoreOverridePath,
	type OkResponse,
	type RemoveFeatureFlagStoreOverrideInput,
	type SetFeatureFlagStoreOverrideInput,
	type StoreFeatureFlagPath,
	type UpdateFeatureFlagInput,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { AdminAccessOnly } from "../../../../platform/presentation/http/security/decorators/admin-access.decorator";
import { PlatformOperation } from "../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodParams, ZodQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { FEATURE_FLAGS_READ_OPERATION, FEATURE_FLAGS_SERVICE, FEATURE_FLAGS_WRITE_OPERATION } from "../../application/ports/feature-flag.store";
import type { FeatureFlagsService } from "../../application/services/feature-flags.service";

@ApiTags("Feature flags")
@ApiBearerAuth()
@AdminAccessOnly("Feature flags are for the admin console.")
@Controller(apiPath("/admin/feature-flags"))
export class FeatureFlagsController {
	public constructor(@Inject(FEATURE_FLAGS_SERVICE) private readonly flags: FeatureFlagsService) {}

	@PlatformOperation(FEATURE_FLAGS_READ_OPERATION)
	@Get("settings")
	@ApiOperation({ summary: "Every flag's setting, for the console to evaluate (any admin staff member)" })
	@ZodResponse(FeatureFlagSettingsSchema, { description: "The settings" })
	public settings(@CurrentActor() actor: ActorContext): Promise<FeatureFlagSettings> {
		return this.flags.settings(actor);
	}

	@RequirePermission("LIST", "FEATURE_FLAG")
	@PlatformOperation(FEATURE_FLAGS_READ_OPERATION)
	@Get()
	@ApiOperation({ summary: "Every feature flag: what it is, where its default comes from, its setting and who last changed it" })
	@ZodResponse(FeatureFlagListSchema, { description: "The flags" })
	public list(@CurrentActor() actor: ActorContext): Promise<FeatureFlagList> {
		return this.flags.list(actor);
	}

	@RequirePermission("UPDATE", "FEATURE_FLAG")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@PlatformOperation(FEATURE_FLAGS_WRITE_OPERATION)
	@Put(":key")
	@ApiOperation({ summary: "Set a flag: its default, on, off, or on for a percentage of people (with a reason)" })
	@ZodResponse(FeatureFlagSchema, { description: "The flag" })
	public update(
		@CurrentActor() actor: ActorContext,
		@ZodParams(FeatureFlagPathSchema) path: FeatureFlagPath,
		@ZodBody(UpdateFeatureFlagSchema) input: UpdateFeatureFlagInput,
	): Promise<FeatureFlag> {
		return this.flags.update(actor, path.key, input);
	}

	@RequirePermission("UPDATE", "FEATURE_FLAG")
	@PlatformOperation(FEATURE_FLAGS_READ_OPERATION)
	@Get("stores")
	@ApiOperation({ summary: "The stores a store flag can be set for: merchants by name, with their live branches (names only)" })
	@ZodResponse(FeatureFlagStoreOptionListSchema, { description: "Up to 20 merchants" })
	public stores(@CurrentActor() actor: ActorContext, @ZodQuery(FeatureFlagStoreSearchQuerySchema) query: FeatureFlagStoreSearchQuery): Promise<FeatureFlagStoreOptionList> {
		return this.flags.searchStores(actor, query.search);
	}

	@RequirePermission("LIST", "FEATURE_FLAG")
	@PlatformOperation(FEATURE_FLAGS_READ_OPERATION)
	@Get(":key/overrides")
	@ApiOperation({ summary: "A store flag's per-store settings: each merchant's and branch's own value, why, and who set it" })
	@ZodResponse(FeatureFlagStoreOverrideListSchema, { description: "The per-store settings" })
	public overrides(@CurrentActor() actor: ActorContext, @ZodParams(StoreFeatureFlagPathSchema) path: StoreFeatureFlagPath): Promise<FeatureFlagStoreOverrideList> {
		return this.flags.storeOverrides(actor, path.key);
	}

	@RequirePermission("UPDATE", "FEATURE_FLAG")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@PlatformOperation(FEATURE_FLAGS_WRITE_OPERATION)
	@Put(":key/overrides")
	@ApiOperation({ summary: "Set a merchant's or one branch's own value of a store flag (replacing its earlier one), with a reason" })
	@ZodResponse(FeatureFlagStoreOverrideSchema, { description: "The store's setting" })
	public setOverride(
		@CurrentActor() actor: ActorContext,
		@ZodParams(StoreFeatureFlagPathSchema) path: StoreFeatureFlagPath,
		@ZodBody(SetFeatureFlagStoreOverrideSchema) input: SetFeatureFlagStoreOverrideInput,
	): Promise<FeatureFlagStoreOverride> {
		return this.flags.setStoreOverride(actor, path.key, input);
	}

	@RequirePermission("UPDATE", "FEATURE_FLAG")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@PlatformOperation(FEATURE_FLAGS_WRITE_OPERATION)
	@Post(":key/overrides/:overrideId/remove")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Remove a store's own value of a flag (it follows the deployment again), with a reason" })
	@ZodResponse(OkResponseSchema, { description: "Removed" })
	public async removeOverride(
		@CurrentActor() actor: ActorContext,
		@ZodParams(FeatureFlagStoreOverridePathSchema) path: FeatureFlagStoreOverridePath,
		// The reason is validated here and kept by the request audit with the rest of the call.
		@ZodBody(RemoveFeatureFlagStoreOverrideSchema) _input: RemoveFeatureFlagStoreOverrideInput,
	): Promise<OkResponse> {
		await this.flags.removeStoreOverride(actor, path.key, path.overrideId);
		return { ok: true };
	}
}
