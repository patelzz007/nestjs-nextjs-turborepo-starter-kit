import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { SessionStatusSchema, epochMs, nowEpochMs, type EpochMs, type SessionStatus } from "@workspace/shared";

import { ApiErrorResponseDto } from "../../common/dto/api-response.dto";
import { createWrappedDto } from "../../common/dto/response-wrapper";
// The decorators below are imported from the auth module WITHOUT importing
// AuthModule here — @GetUser is metadata-only (no DI), and the global
// AuthGuard applies to this controller automatically. Do not "fix" this into
// a module import; it would create an unnecessary coupling.
import { GetUser } from "../auth/decorators/get-user.decorator";
import type { AccessTokenPayload } from "../auth/services/token.service";

const WrappedSessionStatusResponse = createWrappedDto(SessionStatusSchema, "WrappedSessionStatusResponse");

/**
 * Root-level session-status endpoint (`GET /session` — no `/auth` prefix).
 *
 * Moved here from the old root `AppController` (folder-structure pass, item
 * 11) so every session concern lives in the sessions module. The URL is
 * unchanged — the admin panel polls this on page mount to prove the session
 * is alive and to surface the silent-refresh flow.
 *
 * NOT marked @Public(), so the global AuthGuard requires a valid access token
 * (cookie or Bearer). Every field comes from the verified JWT — no database
 * round-trip.
 */
@ApiTags("Sessions")
@Controller()
export class SessionStatusController {
	@ApiBearerAuth()
	@Get("session")
	@ApiOperation({ summary: "Current session status (requires a valid access token)" })
	@ApiOkResponse({ type: WrappedSessionStatusResponse, description: "Authenticated session identity + token expiry" })
	@ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "Access token missing / invalid / expired" })
	public getSession(@GetUser() user: AccessTokenPayload): SessionStatus {
		// `exp` is the JWT expiry in whole seconds since the Unix epoch.
		// When the token carries no expiry, surface null rather than a misleading
		// "expires now" instant — the client renders "Token expiry unknown".
		const expiresAt: EpochMs | null = user.exp !== undefined ? epochMs(user.exp * 1000) : null;

		return {
			userId: user.sub,
			email: user.email,
			fullName: user.fullName,
			expiresAt,
			checkedAt: nowEpochMs(),
		};
	}
}
