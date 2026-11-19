// ============================================
// presentation/http/dynamic-configs.controller.ts — the console's Dynamic configs (ADR 087)
// ============================================
// Platform staff only: DYNAMIC_CONFIG:LIST to read, UPDATE to save values and rules (each value checked against
// the config's declared shape), APPROVE to decide someone else's pending production change.

import { Get, HttpCode, HttpStatus, Inject, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	CheckSubjectSchema,
	ConfigCheckResultSchema,
	ConfigRevisionPathSchema,
	DynamicConfigDetailSchema,
	DynamicConfigPathSchema,
	DynamicConfigSummaryListSchema,
	RevisionDecisionSchema,
	RevisionListSchema,
	RevisionSchema,
	SaveConfigRevisionSchema,
	type CheckSubjectInput,
	type ConfigCheckResult,
	type ConfigRevisionPath,
	type DynamicConfigDetail,
	type DynamicConfigPath,
	type DynamicConfigSummaryList,
	type Revision,
	type RevisionDecisionInput,
	type RevisionList,
	type SaveConfigRevisionInput,
} from "@workspace/shared";

import { ApiController } from "../../../../platform/presentation/http/versioning/api-controller.decorator";
import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { AdminAccessOnly } from "../../../../platform/presentation/http/security/decorators/admin-access.decorator";
import { PlatformOperation } from "../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { FEATURE_FLAGS_READ_OPERATION, FEATURE_FLAGS_WRITE_OPERATION } from "../../application/ports/feature-flags.operations";
import type { ConfigAdminService } from "../../application/services/config-admin.service";
import type { FlagEvaluationService } from "../../application/services/flag-evaluation.service";
import { CONFIG_ADMIN, FLAG_EVALUATION } from "../../feature-flags.tokens";

@ApiTags("Dynamic configs")
@ApiBearerAuth()
@AdminAccessOnly("Dynamic configs are for the admin console.")
@ApiController("/admin/dynamic-configs")
export class DynamicConfigsController {
	public constructor(
		@Inject(CONFIG_ADMIN) private readonly configs: ConfigAdminService,
		@Inject(FLAG_EVALUATION) private readonly evaluation: FlagEvaluationService,
	) {}

	@RequirePermission("LIST", "DYNAMIC_CONFIG")
	@Get()
	@PlatformOperation(FEATURE_FLAGS_READ_OPERATION)
	@ApiOperation({ summary: "Every declared dynamic config: its value shape, live and pending revision, running experiment and exposures" })
	@ZodResponse(DynamicConfigSummaryListSchema, { description: "The configs" })
	public list(@CurrentActor() actor: ActorContext): Promise<DynamicConfigSummaryList> {
		return this.configs.list(actor);
	}

	@RequirePermission("LIST", "DYNAMIC_CONFIG")
	@Get(":key")
	@PlatformOperation(FEATURE_FLAGS_READ_OPERATION)
	@ApiOperation({ summary: "One dynamic config: its live and pending values and rules, and exposures" })
	@ZodResponse(DynamicConfigDetailSchema, { description: "The config" })
	public detail(@CurrentActor() actor: ActorContext, @ZodParams(DynamicConfigPathSchema) path: DynamicConfigPath): Promise<DynamicConfigDetail> {
		return this.configs.detail(actor, path.key);
	}

	@RequirePermission("LIST", "DYNAMIC_CONFIG")
	@Get(":key/revisions")
	@PlatformOperation(FEATURE_FLAGS_READ_OPERATION)
	@ApiOperation({ summary: "Every revision of a config, newest first" })
	@ZodResponse(RevisionListSchema, { description: "The revisions" })
	public revisions(@CurrentActor() actor: ActorContext, @ZodParams(DynamicConfigPathSchema) path: DynamicConfigPath): Promise<RevisionList> {
		return this.configs.revisions(actor, path.key);
	}

	@RequirePermission("UPDATE", "DYNAMIC_CONFIG")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Post(":key/revisions")
	@PlatformOperation(FEATURE_FLAGS_WRITE_OPERATION)
	@ApiOperation({
		summary: "Save a config's values and rules as a new revision, with a reason",
		description: "Every value is checked against the config's declared shape (422 FEATURE_FLAG_RULES_INVALID). Waits for approval in production.",
	})
	@ZodResponse(RevisionSchema, { status: HttpStatus.CREATED, description: "The new revision" })
	public saveRevision(
		@CurrentActor() actor: ActorContext,
		@ZodParams(DynamicConfigPathSchema) path: DynamicConfigPath,
		@ZodBody(SaveConfigRevisionSchema) input: SaveConfigRevisionInput,
	): Promise<Revision> {
		return this.configs.saveRevision(actor, path.key, input);
	}

	@RequirePermission("APPROVE", "DYNAMIC_CONFIG")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Post(":key/revisions/:number/decision")
	@HttpCode(HttpStatus.OK)
	@PlatformOperation(FEATURE_FLAGS_WRITE_OPERATION)
	@ApiOperation({ summary: "Approve or reject someone else's pending config revision, with a reason" })
	@ZodResponse(RevisionSchema, { description: "The decided revision" })
	public decide(
		@CurrentActor() actor: ActorContext,
		@ZodParams(ConfigRevisionPathSchema) path: ConfigRevisionPath,
		@ZodBody(RevisionDecisionSchema) input: RevisionDecisionInput,
	): Promise<Revision> {
		return this.configs.decideRevision(actor, path.key, path.number, input);
	}

	@RequirePermission("LIST", "DYNAMIC_CONFIG")
	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":key/check")
	@HttpCode(HttpStatus.OK)
	@PlatformOperation(FEATURE_FLAGS_READ_OPERATION)
	@ApiOperation({ summary: "Check a subject: the value one user, store or device would get, and why" })
	@ZodResponse(ConfigCheckResultSchema, { description: "The value and its trace" })
	public check(@ZodParams(DynamicConfigPathSchema) path: DynamicConfigPath, @ZodBody(CheckSubjectSchema) body: CheckSubjectInput): Promise<ConfigCheckResult> {
		return this.evaluation.checkConfig(path.key, body.subject);
	}
}
