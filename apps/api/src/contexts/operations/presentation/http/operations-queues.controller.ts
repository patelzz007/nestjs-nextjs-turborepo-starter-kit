// ============================================
// presentation/http/operations-queues.controller.ts — background job queues (enhancement 4.4)
// ============================================
// BACKGROUND_JOB permissions (the Platform Developer role acts; the Admin reads). A retry or discard is a
// state-changing request with a reason, so the audit trail records who did it and why.

import { Controller, Get, HttpStatus, Inject, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	OkResponseSchema,
	OpsFailedJobListSchema,
	OpsQueueJobActionSchema,
	OpsQueueJobPathSchema,
	OpsQueueListSchema,
	OpsQueuePathSchema,
	type OkResponse,
	type OpsFailedJobList,
	type OpsQueueJobAction,
	type OpsQueueJobPath,
	type OpsQueueList,
	type OpsQueuePath,
} from "@workspace/shared";

import { AdminAccessOnly } from "../../../../platform/presentation/http/security/decorators/admin-access.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { OPERATIONS_QUEUES } from "../../application/ports/operations.tokens";
import type { OperationsQueuesService } from "../../application/services/operations-queues.service";

@ApiTags("Operations")
@ApiBearerAuth()
@AdminAccessOnly("Admin access required for the background job queues.")
@Controller(apiPath("/admin/operations"))
export class OperationsQueuesController {
	public constructor(@Inject(OPERATIONS_QUEUES) private readonly queues: OperationsQueuesService) {}

	@RequirePermission("LIST", "BACKGROUND_JOB")
	@Get("queues")
	@ApiOperation({ summary: "Every background job queue: what is waiting, running, delayed and failed, and the last hour's failure rate" })
	@ZodResponse(OpsQueueListSchema, { description: "The queues" })
	public list(): Promise<OpsQueueList> {
		return this.queues.list();
	}

	@RequirePermission("LIST", "BACKGROUND_JOB")
	@Get("queues/:queueName/failed")
	@ApiOperation({ summary: "A queue's failed jobs, newest first (without their data)" })
	@ZodResponse(OpsFailedJobListSchema, { description: "The failed jobs" })
	public failed(@ZodParams(OpsQueuePathSchema) path: OpsQueuePath): Promise<OpsFailedJobList> {
		return this.queues.failedJobs(path.queueName);
	}

	@RequirePermission("UPDATE", "BACKGROUND_JOB")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Post("queues/:queueName/jobs/:jobId/retry")
	@ApiOperation({ summary: "Run a failed job again, attempts reset (with a reason); 404 unless the job is failed" })
	@ZodResponse(OkResponseSchema, { status: HttpStatus.CREATED, description: "Queued again" })
	public async retry(@ZodParams(OpsQueueJobPathSchema) path: OpsQueueJobPath, @ZodBody(OpsQueueJobActionSchema) _body: OpsQueueJobAction): Promise<OkResponse> {
		await this.queues.retry(path.queueName, path.jobId);
		return { ok: true };
	}

	@RequirePermission("DELETE", "BACKGROUND_JOB")
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Post("queues/:queueName/jobs/:jobId/discard")
	@ApiOperation({ summary: "Discard a failed job for good (with a reason); 404 unless the job is failed" })
	@ZodResponse(OkResponseSchema, { status: HttpStatus.CREATED, description: "Discarded" })
	public async discard(@ZodParams(OpsQueueJobPathSchema) path: OpsQueueJobPath, @ZodBody(OpsQueueJobActionSchema) _body: OpsQueueJobAction): Promise<OkResponse> {
		await this.queues.discard(path.queueName, path.jobId);
		return { ok: true };
	}
}
