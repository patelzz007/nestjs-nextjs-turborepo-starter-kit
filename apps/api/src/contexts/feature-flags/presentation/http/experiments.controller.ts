// ============================================
// presentation/http/experiments.controller.ts — the console's Experiments (ADR 087)
// ============================================
// Platform staff only: EXPERIMENT:LIST to read plans and results, UPDATE to plan, start and stop (with a reason;
// stopping also records the conclusion). Results are worked out by the analytics consumer.

import { Get, HttpCode, HttpStatus, Inject, Post, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	CreateExperimentSchema,
	ExperimentDetailSchema,
	ExperimentListSchema,
	ExperimentMetricOptionListSchema,
	ExperimentPathSchema,
	StartExperimentSchema,
	StopExperimentSchema,
	UpdateExperimentSchema,
	type CreateExperimentInput,
	type ExperimentDetail,
	type ExperimentList,
	type ExperimentMetricOptionList,
	type ExperimentPath,
	type StartExperimentInput,
	type StopExperimentInput,
	type UpdateExperimentInput,
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
import type { ExperimentService } from "../../application/services/experiment.service";
import { EXPERIMENTS } from "../../feature-flags.tokens";

@ApiTags("Experiments")
@ApiBearerAuth()
@AdminAccessOnly("Experiments are for the admin console.")
@ApiController("/admin/experiments")
export class ExperimentsController {
	public constructor(@Inject(EXPERIMENTS) private readonly experiments: ExperimentService) {}

	@RequirePermission("LIST", "EXPERIMENT")
	@Get()
	@PlatformOperation(FEATURE_FLAGS_READ_OPERATION)
	@ApiOperation({ summary: "Every experiment, newest first" })
	@ZodResponse(ExperimentListSchema, { description: "The experiments" })
	public list(@CurrentActor() actor: ActorContext): Promise<ExperimentList> {
		return this.experiments.list(actor);
	}

	@RequirePermission("LIST", "EXPERIMENT")
	@Get("metrics")
	@PlatformOperation(FEATURE_FLAGS_READ_OPERATION)
	@ApiOperation({ summary: "The metrics an experiment can compare (declared in code)" })
	@ZodResponse(ExperimentMetricOptionListSchema, { description: "The metrics" })
	public metrics(): ExperimentMetricOptionList {
		return this.experiments.metrics();
	}

	@RequirePermission("UPDATE", "EXPERIMENT")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Post()
	@PlatformOperation(FEATURE_FLAGS_WRITE_OPERATION)
	@ApiOperation({
		summary: "Plan an experiment on a dynamic config (a draft), with a reason",
		description: "Its variants must be values of the config's live revision (422 EXPERIMENT_PLAN_INVALID).",
	})
	@ZodResponse(ExperimentDetailSchema, { status: HttpStatus.CREATED, description: "The experiment" })
	public create(@CurrentActor() actor: ActorContext, @ZodBody(CreateExperimentSchema) input: CreateExperimentInput): Promise<ExperimentDetail> {
		return this.experiments.create(actor, input);
	}

	@RequirePermission("LIST", "EXPERIMENT")
	@Get(":experimentId")
	@PlatformOperation(FEATURE_FLAGS_READ_OPERATION)
	@ApiOperation({ summary: "One experiment, with its latest results" })
	@ZodResponse(ExperimentDetailSchema, { description: "The experiment" })
	public detail(@CurrentActor() actor: ActorContext, @ZodParams(ExperimentPathSchema) path: ExperimentPath): Promise<ExperimentDetail> {
		return this.experiments.detail(actor, path.experimentId);
	}

	@RequirePermission("UPDATE", "EXPERIMENT")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Put(":experimentId")
	@PlatformOperation(FEATURE_FLAGS_WRITE_OPERATION)
	@ApiOperation({ summary: "Change a draft's plan, with a reason", description: "409 EXPERIMENT_STATE_INVALID once started." })
	@ZodResponse(ExperimentDetailSchema, { description: "The experiment" })
	public update(
		@CurrentActor() actor: ActorContext,
		@ZodParams(ExperimentPathSchema) path: ExperimentPath,
		@ZodBody(UpdateExperimentSchema) input: UpdateExperimentInput,
	): Promise<ExperimentDetail> {
		return this.experiments.update(actor, path.experimentId, input);
	}

	@RequirePermission("UPDATE", "EXPERIMENT")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Post(":experimentId/start")
	@HttpCode(HttpStatus.OK)
	@PlatformOperation(FEATURE_FLAGS_WRITE_OPERATION)
	@ApiOperation({ summary: "Start a draft, with a reason", description: "409 EXPERIMENT_CONFIG_BUSY while another runs on the same config." })
	@ZodResponse(ExperimentDetailSchema, { description: "The experiment" })
	public start(
		@CurrentActor() actor: ActorContext,
		@ZodParams(ExperimentPathSchema) path: ExperimentPath,
		@ZodBody(StartExperimentSchema) input: StartExperimentInput,
	): Promise<ExperimentDetail> {
		return this.experiments.start(actor, path.experimentId, input);
	}

	@RequirePermission("UPDATE", "EXPERIMENT")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Post(":experimentId/stop")
	@HttpCode(HttpStatus.OK)
	@PlatformOperation(FEATURE_FLAGS_WRITE_OPERATION)
	@ApiOperation({ summary: "Stop a running experiment, with a reason and its conclusion — everyone gets the config's rules again" })
	@ZodResponse(ExperimentDetailSchema, { description: "The experiment" })
	public stop(
		@CurrentActor() actor: ActorContext,
		@ZodParams(ExperimentPathSchema) path: ExperimentPath,
		@ZodBody(StopExperimentSchema) input: StopExperimentInput,
	): Promise<ExperimentDetail> {
		return this.experiments.stop(actor, path.experimentId, input);
	}
}
