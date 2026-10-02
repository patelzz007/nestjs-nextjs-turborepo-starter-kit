import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import {
	DeepHealthResponseSchema,
	HealthResponseSchema,
	LivenessResponseSchema,
	ReadinessResponseSchema,
	StringValueSchema,
	type DeepHealthResponse,
	type HealthResponse,
	type LivenessResponse,
	type ReadinessResponse,
} from "@workspace/shared";

import { ZodResponse } from "../../common/decorators/zod-response.decorators";
import { ApiErrorResponseDto } from "../../common/dto/api-response.dto";
// @Public() is metadata-only (no DI) — HealthModule must NOT import AuthModule.
// The global AuthGuard reads the public marker via Reflector and skips these
// routes. Do not "fix" this into a module import.
import { Public } from "../auth/decorators/public.decorator";
import { HealthService } from "./health.service";

/**
 * App-level endpoints: `GET /` welcome message and the health probes.
 *
 * | Route               | Use for                         | Touches DB | Fails with |
 * |---------------------|---------------------------------|------------|------------|
 * | `GET /health/live`  | liveness probe (restart policy) | no         | never (process down = no answer) |
 * | `GET /health/ready` | readiness probe (LB rotation)   | yes        | 503 not started / draining / DB or critical dependency down |
 * | `GET /health`       | DEPRECATED alias for monitors   | yes        | 503 only while starting/draining |
 * | `GET /health/deep`  | human/ops diagnostics           | yes        | 503 only while starting/draining |
 *
 * All are public (the global AuthGuard skips `@Public()`) and answer the
 * standard `{ success, data, meta }` envelope (ADR 022) — probes and uptime
 * monitors key on the HTTP status, so the body shape is for humans and tests.
 *
 * The old root `AppController` also hosted `GET /session` (moved to `SessionStatusController` in the sessions module). Signup is only
 * `POST /auth/signup` (throttled) — there is no root `POST /users` alias.
 */
@ApiTags("App")
@Controller()
export class HealthController {
	public constructor(private readonly healthService: HealthService) {}

	// `GET /` + `GET /health` are infra plumbing, not versioned business
	// endpoints — they stay at `/` and `/health` (no `apiPath()` prefix).
	@Public()
	@Get()
	@ApiOperation({ summary: "Welcome message" })
	@ZodResponse(StringValueSchema, { description: "Welcome message" })
	public getHello(): string {
		return this.healthService.getHello();
	}

	@Public()
	@Get("health/live")
	@ApiOperation({ summary: "Liveness probe — process is up (never touches the database)" })
	@ZodResponse(LivenessResponseSchema, { description: "The process is alive" })
	public getLiveness(): LivenessResponse {
		return this.healthService.liveness();
	}

	@Public()
	@Get("health/ready")
	@ApiOperation({ summary: "Readiness probe — startup finished, database and critical dependencies reachable" })
	@ZodResponse(ReadinessResponseSchema, { description: "The instance can serve traffic" })
	@ApiResponse({ status: 503, type: ApiErrorResponseDto, description: "Not ready — `error.details.checks` lists every probe" })
	public async getReadiness(): Promise<ReadinessResponse> {
		return this.healthService.readiness();
	}

	/** @deprecated Use `GET /health/live` (liveness) or `GET /health/ready` (readiness). Kept for existing uptime monitors. */
	@Public()
	@Get("health")
	@ApiOperation({ summary: "Health check (includes DB status) — deprecated alias, prefer /health/live and /health/ready", deprecated: true })
	@ZodResponse(HealthResponseSchema, { description: "Current service health status" })
	public async getHealth(): Promise<HealthResponse> {
		return this.healthService.healthCheck();
	}

	@Public()
	@Get("health/deep")
	@ApiOperation({ summary: "Deep health check (DB + filesystem + external services)" })
	@ZodResponse(DeepHealthResponseSchema, { description: "Detailed health status with per-service probes" })
	public async getDeepHealth(): Promise<DeepHealthResponse> {
		return this.healthService.deepHealthCheck();
	}
}
