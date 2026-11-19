// ============================================
// presentation/http/feature-flags.controller.ts — the console's Feature flags (ADR 087)
// ============================================
// Platform staff only. Reading needs FEATURE_FLAG:LIST; changing rules, the kill switch or an override needs
// FEATURE_FLAG:UPDATE (each with a reason, kept by the request audit and the change trail); deciding someone
// else's pending production change needs FEATURE_FLAG:APPROVE (never one's own).

import { Get, HttpCode, HttpStatus, Inject, Post, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	FeatureFlagDetailSchema,
	FeatureFlagEnvironmentSchema,
	FeatureFlagPathSchema,
	FeatureFlagSummaryListSchema,
	FlagCheckResultSchema,
	FlagOverridePathSchema,
	FlagOverrideSchema,
	FlagRevisionPathSchema,
	FlagSubjectOptionListSchema,
	FlagSubjectSearchQuerySchema,
	KillSwitchStateSchema,
	OkResponseSchema,
	RemoveFlagOverrideSchema,
	RevisionDecisionSchema,
	RevisionListSchema,
	RevisionSchema,
	SaveFlagRevisionSchema,
	SetFlagOverrideSchema,
	SetKillSwitchSchema,
	CheckSubjectSchema,
	type CheckSubjectInput,
	type FeatureFlagDetail,
	type FeatureFlagEnvironment,
	type FeatureFlagPath,
	type FeatureFlagSummaryList,
	type FlagCheckResult,
	type FlagOverride,
	type FlagOverridePath,
	type FlagRevisionPath,
	type FlagSubjectOptionList,
	type FlagSubjectSearchQuery,
	type KillSwitchState,
	type OkResponse,
	type RemoveFlagOverrideInput,
	type Revision,
	type RevisionDecisionInput,
	type RevisionList,
	type SaveFlagRevisionInput,
	type SetFlagOverrideInput,
	type SetKillSwitchInput,
} from "@workspace/shared";

import { ApiController } from "../../../../platform/presentation/http/versioning/api-controller.decorator";
import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { AdminAccessOnly } from "../../../../platform/presentation/http/security/decorators/admin-access.decorator";
import { PlatformOperation } from "../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodParams, ZodQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { FEATURE_FLAGS_READ_OPERATION, FEATURE_FLAGS_WRITE_OPERATION } from "../../application/ports/feature-flags.operations";
import type { FlagAdminService } from "../../application/services/flag-admin.service";
import type { FlagEvaluationService } from "../../application/services/flag-evaluation.service";
import { FLAG_ADMIN, FLAG_EVALUATION } from "../../feature-flags.tokens";

@ApiTags("Feature flags")
@ApiBearerAuth()
@AdminAccessOnly("Feature flags are for the admin console.")
@ApiController("/admin/feature-flags")
export class FeatureFlagsController {
	public constructor(
		@Inject(FLAG_ADMIN) private readonly flags: FlagAdminService,
		@Inject(FLAG_EVALUATION) private readonly evaluation: FlagEvaluationService,
	) {}

	@RequirePermission("LIST", "FEATURE_FLAG")
	@Get()
	@PlatformOperation(FEATURE_FLAGS_READ_OPERATION)
	@ApiOperation({ summary: "Every declared feature flag: its kill switch, live and pending revision, overrides, exposures and whether it's ready to remove" })
	@ZodResponse(FeatureFlagSummaryListSchema, { description: "The flags" })
	public list(@CurrentActor() actor: ActorContext): Promise<FeatureFlagSummaryList> {
		return this.flags.list(actor);
	}

	@RequirePermission("LIST", "FEATURE_FLAG")
	@Get("environment")
	@PlatformOperation(FEATURE_FLAGS_READ_OPERATION)
	@ApiOperation({ summary: "This deployment's environment, and whether rule changes here wait for a second person" })
	@ZodResponse(FeatureFlagEnvironmentSchema, { description: "The environment" })
	public environment(): FeatureFlagEnvironment {
		return this.flags.environmentInfo();
	}

	@RequirePermission("UPDATE", "FEATURE_FLAG")
	@Get("subjects")
	@PlatformOperation(FEATURE_FLAGS_READ_OPERATION)
	@ApiOperation({ summary: "The users, tenants or locations an override can name, by name (up to 20)" })
	@ZodResponse(FlagSubjectOptionListSchema, { description: "Matching subjects" })
	public subjects(@CurrentActor() actor: ActorContext, @ZodQuery(FlagSubjectSearchQuerySchema) query: FlagSubjectSearchQuery): Promise<FlagSubjectOptionList> {
		return this.flags.searchSubjects(actor, query);
	}

	@RequirePermission("LIST", "FEATURE_FLAG")
	@Get(":key")
	@PlatformOperation(FEATURE_FLAGS_READ_OPERATION)
	@ApiOperation({ summary: "One flag: its live and pending rules, overrides, kill switch and exposures over the last day and week" })
	@ZodResponse(FeatureFlagDetailSchema, { description: "The flag" })
	public detail(@CurrentActor() actor: ActorContext, @ZodParams(FeatureFlagPathSchema) path: FeatureFlagPath): Promise<FeatureFlagDetail> {
		return this.flags.detail(actor, path.key);
	}

	@RequirePermission("LIST", "FEATURE_FLAG")
	@Get(":key/revisions")
	@PlatformOperation(FEATURE_FLAGS_READ_OPERATION)
	@ApiOperation({ summary: "Every revision of a flag's rules, newest first" })
	@ZodResponse(RevisionListSchema, { description: "The revisions" })
	public revisions(@CurrentActor() actor: ActorContext, @ZodParams(FeatureFlagPathSchema) path: FeatureFlagPath): Promise<RevisionList> {
		return this.flags.revisions(actor, path.key);
	}

	@RequirePermission("UPDATE", "FEATURE_FLAG")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Post(":key/revisions")
	@PlatformOperation(FEATURE_FLAGS_WRITE_OPERATION)
	@ApiOperation({
		summary: "Save a flag's rules as a new revision, with a reason",
		description:
			"Live at once, except in production, where it waits up to 7 days for someone else's approval. 409 FEATURE_FLAG_REVISION_CONFLICT when the live revision isn't `basedOn` any more; 422 FEATURE_FLAG_RULES_INVALID when a rule names a group that doesn't exist.",
	})
	@ZodResponse(RevisionSchema, { status: HttpStatus.CREATED, description: "The new revision" })
	public saveRevision(
		@CurrentActor() actor: ActorContext,
		@ZodParams(FeatureFlagPathSchema) path: FeatureFlagPath,
		@ZodBody(SaveFlagRevisionSchema) input: SaveFlagRevisionInput,
	): Promise<Revision> {
		return this.flags.saveRevision(actor, path.key, input);
	}

	@RequirePermission("APPROVE", "FEATURE_FLAG")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Post(":key/revisions/:number/decision")
	@HttpCode(HttpStatus.OK)
	@PlatformOperation(FEATURE_FLAGS_WRITE_OPERATION)
	@ApiOperation({ summary: "Approve (it goes live) or reject someone else's pending revision, with a reason", description: "403 FEATURE_FLAG_SELF_APPROVAL for one's own." })
	@ZodResponse(RevisionSchema, { description: "The decided revision" })
	public decide(
		@CurrentActor() actor: ActorContext,
		@ZodParams(FlagRevisionPathSchema) path: FlagRevisionPath,
		@ZodBody(RevisionDecisionSchema) input: RevisionDecisionInput,
	): Promise<Revision> {
		return this.flags.decideRevision(actor, path.key, path.number, input);
	}

	@RequirePermission("UPDATE", "FEATURE_FLAG")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Put(":key/kill-switch")
	@PlatformOperation(FEATURE_FLAGS_WRITE_OPERATION)
	@ApiOperation({ summary: "Throw (off for everyone, at once) or release a flag's kill switch, with a reason — never waits for approval" })
	@ZodResponse(KillSwitchStateSchema, { description: "The kill switch" })
	public setKillSwitch(
		@CurrentActor() actor: ActorContext,
		@ZodParams(FeatureFlagPathSchema) path: FeatureFlagPath,
		@ZodBody(SetKillSwitchSchema) input: SetKillSwitchInput,
	): Promise<KillSwitchState> {
		return this.flags.setKillSwitch(actor, path.key, input);
	}

	@RequirePermission("UPDATE", "FEATURE_FLAG")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Put(":key/overrides")
	@PlatformOperation(FEATURE_FLAGS_WRITE_OPERATION)
	@ApiOperation({ summary: "Force a flag on or off for one user, location or tenant (replacing its earlier override), with a reason" })
	@ZodResponse(FlagOverrideSchema, { description: "The override" })
	public setOverride(
		@CurrentActor() actor: ActorContext,
		@ZodParams(FeatureFlagPathSchema) path: FeatureFlagPath,
		@ZodBody(SetFlagOverrideSchema) input: SetFlagOverrideInput,
	): Promise<FlagOverride> {
		return this.flags.setOverride(actor, path.key, input);
	}

	@RequirePermission("UPDATE", "FEATURE_FLAG")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Post(":key/overrides/:overrideId/remove")
	@HttpCode(HttpStatus.OK)
	@PlatformOperation(FEATURE_FLAGS_WRITE_OPERATION)
	@ApiOperation({ summary: "Remove an override (the subject follows the rules again), with a reason — a POST, so the reason can't be dropped" })
	@ZodResponse(OkResponseSchema, { description: "Removed" })
	public async removeOverride(
		@CurrentActor() actor: ActorContext,
		@ZodParams(FlagOverridePathSchema) path: FlagOverridePath,
		// The reason is validated here and kept by the request audit with the rest of the call.
		@ZodBody(RemoveFlagOverrideSchema) _input: RemoveFlagOverrideInput,
	): Promise<OkResponse> {
		await this.flags.removeOverride(actor, path.key, path.overrideId);
		return { ok: true };
	}

	@RequirePermission("LIST", "FEATURE_FLAG")
	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":key/check")
	@HttpCode(HttpStatus.OK)
	@PlatformOperation(FEATURE_FLAGS_READ_OPERATION)
	@ApiOperation({ summary: "Check a subject: the value one user, store or device would get, and every step that decided it" })
	@ZodResponse(FlagCheckResultSchema, { description: "The value and its trace" })
	public check(@ZodParams(FeatureFlagPathSchema) path: FeatureFlagPath, @ZodBody(CheckSubjectSchema) body: CheckSubjectInput): Promise<FlagCheckResult> {
		return this.evaluation.checkFlag(path.key, body.subject);
	}
}
