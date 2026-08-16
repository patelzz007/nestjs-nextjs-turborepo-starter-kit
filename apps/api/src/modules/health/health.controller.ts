import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { HealthResponseSchema } from "@workspace/shared";
import { z } from "zod";

import { createWrappedDto } from "../../common/dto/response-wrapper";
// @Public() is metadata-only (no DI) — HealthModule must NOT import AuthModule.
// The global AuthGuard reads the public marker via Reflector and skips these
// routes. Do not "fix" this into a module import.
import { Public } from "../auth/decorators/public.decorator";

import { HealthService } from "./health.service";

// ── Wrapped Response DTOs ────────────────────────────────────────────────

const WrappedHelloResponse = createWrappedDto(z.string(), "WrappedHelloResponse");
const WrappedHealthResponse = createWrappedDto(HealthResponseSchema, "WrappedHealthResponse");

/**
 * App-level endpoints: `GET /` welcome message and `GET /health` health check.
 * Both are public. The old root `AppController` also hosted `GET /session`
 * (moved to `SessionStatusController` in the sessions module) and
 * `POST /users` (moved to `RootUsersController` in the auth module) — URL
 * paths are unchanged.
 */
@ApiTags("App")
@Controller()
export class HealthController {
	constructor(private readonly healthService: HealthService) {}

	// `GET /` + `GET /health` are infra plumbing, not versioned business
	// endpoints — they stay at `/` and `/health` (no `apiPath()` prefix).
	@Public()
	@Get()
	@ApiOperation({ summary: "Welcome message" })
	@ApiOkResponse({ type: WrappedHelloResponse, description: "Welcome message" })
	public getHello(): string {
		return this.healthService.getHello();
	}

	@Public()
	@Get("health")
	@ApiOperation({ summary: "Health check (includes DB status)" })
	@ApiOkResponse({ type: WrappedHealthResponse, description: "Current service health status" })
	public async getHealth(): Promise<Record<string, unknown>> {
		return this.healthService.healthCheck();
	}
}
