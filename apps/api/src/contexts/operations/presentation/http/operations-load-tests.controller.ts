// ============================================
// presentation/http/operations-load-tests.controller.ts — load tests (ADR 068)
// ============================================
// LOAD_TEST permissions (the Platform Developer role holds all but the purge); the caps and the purge
// are SuperAdmin only.

import { Controller, Delete, Get, HttpStatus, Inject, Post, Put } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	LoadTestCapsInputSchema,
	apiPath,
	LoadTestCapsSchema,
	LoadTestOverviewSchema,
	LoadTestPurgeResultSchema,
	LoadTestRunDetailSchema,
	LoadTestRunPathSchema,
	LoadTestRunSchema,
	StartLoadTestSchema,
	type LoadTestCaps,
	type LoadTestOverview,
	type LoadTestPurgeResult,
	type LoadTestRun,
	type LoadTestRunDetail,
	type LoadTestRunPath,
	type StartLoadTestInput,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { AdminAccessOnly } from "../../../../platform/presentation/http/security/decorators/admin-access.decorator";
import { PlatformOperation } from "../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { SuperAdminOnly } from "../../../../platform/presentation/http/security/decorators/super-admin.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { AbortLoadTestCommand, PurgeLoadTestDataCommand, StartLoadTestCommand, UpdateLoadTestCapsCommand } from "../../application/commands/load-tests/load-test.commands";
import {
	LOAD_TEST_PURGE_OPERATION,
	LOAD_TEST_WRITE_OPERATION,
	OPERATIONS_READ,
	OPS_CONSOLE_READ_OPERATION,
	OPS_SETTINGS_WRITE_OPERATION,
} from "../../application/ports/operations.tokens";
import type { OperationsReadService } from "../../application/services/operations-read.service";

@ApiTags("Operations")
@ApiBearerAuth()
@AdminAccessOnly("Admin access required for load tests.")
@Controller(apiPath("/admin/operations"))
export class OperationsLoadTestsController {
	public constructor(
		private readonly commandBus: CommandBus,
		@Inject(OPERATIONS_READ) private readonly reads: OperationsReadService,
	) {}

	@RequirePermission("LIST", "LOAD_TEST")
	@PlatformOperation(OPS_CONSOLE_READ_OPERATION)
	@Get("load-tests")
	@ApiOperation({ summary: "Whether load tests can run here, the caps, the endpoints and the runs" })
	@ZodResponse(LoadTestOverviewSchema, { description: "The load tests" })
	public overview(@CurrentActor() actor: ActorContext): Promise<LoadTestOverview> {
		return this.reads.loadTests(actor);
	}

	@RequirePermission("CREATE", "LOAD_TEST")
	@PlatformOperation(LOAD_TEST_WRITE_OPERATION)
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Post("load-tests")
	@ApiOperation({ summary: "Start a load test (one at a time, within the caps, inside the Load Test tenant)" })
	@ZodResponse(LoadTestRunSchema, { status: HttpStatus.CREATED, description: "The queued run" })
	public start(@CurrentActor() actor: ActorContext, @ZodBody(StartLoadTestSchema) input: StartLoadTestInput): Promise<LoadTestRun> {
		return this.commandBus.execute(new StartLoadTestCommand(actor, input));
	}

	@SuperAdminOnly()
	@PlatformOperation(OPS_SETTINGS_WRITE_OPERATION)
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Put("load-tests/caps")
	@ApiOperation({ summary: "SuperAdmin: the load-test caps (virtual users, requests per second, minutes)" })
	@ZodResponse(LoadTestCapsSchema, { description: "The saved caps" })
	public caps(@CurrentActor() actor: ActorContext, @ZodBody(LoadTestCapsInputSchema) caps: LoadTestCaps): Promise<LoadTestCaps> {
		return this.commandBus.execute(new UpdateLoadTestCapsCommand(actor, caps));
	}

	@SuperAdminOnly()
	@RequirePermission("DELETE", "LOAD_TEST")
	@PlatformOperation(LOAD_TEST_PURGE_OPERATION)
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Delete("load-tests/data")
	@ApiOperation({ summary: "SuperAdmin: permanently delete what load tests created in the Load Test tenant (ADR 068, exception 2)" })
	@ZodResponse(LoadTestPurgeResultSchema, { description: "What was deleted" })
	public purge(@CurrentActor() actor: ActorContext): Promise<LoadTestPurgeResult> {
		return this.commandBus.execute(new PurgeLoadTestDataCommand(actor));
	}

	@RequirePermission("READ", "LOAD_TEST")
	@PlatformOperation(OPS_CONSOLE_READ_OPERATION)
	@Get("load-tests/:runId")
	@ApiOperation({ summary: "One load test: its seconds, its steps and the servers' load over the same time" })
	@ZodResponse(LoadTestRunDetailSchema, { description: "The run" })
	public run(@CurrentActor() actor: ActorContext, @ZodParams(LoadTestRunPathSchema) path: LoadTestRunPath): Promise<LoadTestRunDetail> {
		return this.reads.loadTest(actor, path.runId);
	}

	@RequirePermission("UPDATE", "LOAD_TEST")
	@PlatformOperation(LOAD_TEST_WRITE_OPERATION)
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Post("load-tests/:runId/abort")
	@ApiOperation({ summary: "Abort a queued or running load test" })
	@ZodResponse(LoadTestRunSchema, { status: HttpStatus.CREATED, description: "The run" })
	public abort(@CurrentActor() actor: ActorContext, @ZodParams(LoadTestRunPathSchema) path: LoadTestRunPath): Promise<LoadTestRun> {
		return this.commandBus.execute(new AbortLoadTestCommand(actor, path.runId));
	}
}
