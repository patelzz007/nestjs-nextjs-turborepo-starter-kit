import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { SessionStatusSchema, apiPath, epochMs, nowEpochMs, type AccessTokenPayload, type EpochMs, type SessionStatus } from "@workspace/shared";

import { ApiErrorResponseDto } from "../../../../platform/presentation/http/dto/api-response.dto";
import { GetUser } from "../../../../platform/presentation/http/security/decorators/get-user.decorator";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";

/**
 * `GET /api/v1/session`: the admin panel polls it on page mount to prove the session is alive and to
 * surface the silent-refresh flow. Not `@Public()`, so the global `AuthGuard` requires a valid access
 * token. Every field comes from the verified JWT: presentation only, no database (plan §7.6).
 */
@ApiTags("Sessions")
@Controller(apiPath("/session"))
export class SessionStatusController {
	@ApiBearerAuth()
	@Get()
	@ApiOperation({ summary: "Current session status (requires a valid access token)" })
	@ZodResponse(SessionStatusSchema, { description: "Authenticated session identity + token expiry" })
	@ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "Access token missing / invalid / expired" })
	public getSession(@GetUser() user: AccessTokenPayload): SessionStatus {
		// `exp` is the JWT expiry in whole seconds; a token without one reports null ("expiry unknown"), never "expires now".
		const expiresAt: EpochMs | null = user.exp !== undefined ? epochMs(user.exp * 1000) : null;
		return { userId: user.sub, email: user.email, fullName: user.fullName, expiresAt, checkedAt: nowEpochMs() };
	}
}
