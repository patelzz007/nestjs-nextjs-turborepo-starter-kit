import { Controller, Get, Post, Body } from "@nestjs/common";
import { ApiBearerAuth, ApiTags, ApiOperation, ApiBody, ApiOkResponse, ApiCreatedResponse, ApiResponse } from "@nestjs/swagger";
import { SignupSchema, HealthResponseSchema, SessionStatusSchema, UserResponseSchema } from "@workspace/shared";
import type { UserResponse, SessionStatus, SignupInput } from "@workspace/shared";
import { z } from "zod";

import { AppService } from "./app.service";
import { GetUser } from "./common/decorators/get-user.decorator";
import { Public } from "./common/decorators/public.decorator";
import { ApiErrorResponseDto } from "./common/dto/api-response.dto";
import { CreateUserDto } from "./common/dto/create-user.dto";
import { createWrappedDto } from "./common/dto/response-wrapper";
import { ZodValidationPipe } from "./common/pipes/zod-validation.pipe";
import { AuthService } from "./modules/auth/auth.service";
import type { AccessTokenPayload } from "./modules/auth/services/token.service";

// ── Wrapped Response DTOs ────────────────────────────────────────────────

const WrappedHelloResponse = createWrappedDto(z.string(), "WrappedHelloResponse");
const WrappedHealthResponse = createWrappedDto(HealthResponseSchema, "WrappedHealthResponse");
const WrappedCreatedUserResponse = createWrappedDto(UserResponseSchema, "WrappedCreatedUserResponse");
const WrappedSessionStatusResponse = createWrappedDto(SessionStatusSchema, "WrappedSessionStatusResponse");

@ApiTags("App")
@Controller()
export class AppController {
	constructor(
		private readonly appService: AppService,
		private readonly authService: AuthService,
	) {}

	@Public()
	@Get()
	@ApiOperation({ summary: "Welcome message" })
	@ApiOkResponse({ type: WrappedHelloResponse, description: "Welcome message" })
	getHello(): string {
		return this.appService.getHello();
	}

	@Public()
	@Get("health")
	@ApiOperation({ summary: "Health check (includes DB status)" })
	@ApiOkResponse({ type: WrappedHealthResponse, description: "Current service health status" })
	async getHealth(): Promise<Record<string, unknown>> {
		return this.appService.healthCheck();
	}

	// ═══════════════════════════════════════════════════════════════════
	// Session status — the "very basic protected API"
	// ═══════════════════════════════════════════════════════════════════
	// NOT marked @Public(), so the global AuthGuard requires a valid access
	// token (cookie or Bearer). Every field comes from the verified JWT — no
	// database round-trip. The admin panel polls this on page mount to prove
	// the session is alive and to surface the silent-refresh flow: a 401 here
	// triggers the client-side refresh, and the retried request rotates the
	// access token (visible as a fresh `expiresAt`).

	@ApiBearerAuth()
	@Get("session")
	@ApiOperation({ summary: "Current session status (requires a valid access token)" })
	@ApiOkResponse({ type: WrappedSessionStatusResponse, description: "Authenticated session identity + token expiry" })
	@ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "Access token missing / invalid / expired" })
	public getSession(@GetUser() user: AccessTokenPayload): SessionStatus {
		// `exp` is the JWT expiry in whole seconds since the Unix epoch.
		// When the token carries no expiry, surface null rather than a misleading
		// "expires now" instant — the client renders "Token expiry unknown".
		const expiresAt: string | null = user.exp !== undefined ? new Date(user.exp * 1000).toISOString() : null;

		return {
			userId: user.sub,
			email: user.email,
			fullName: user.fullName,
			expiresAt,
			checkedAt: new Date().toISOString(),
		};
	}

	@Public()
	@Post("users")
	@ApiOperation({ summary: "Create a new user" })
	@ApiBody({ type: CreateUserDto })
	@ApiCreatedResponse({ type: WrappedCreatedUserResponse, description: "The created user" })
	@ApiResponse({ status: 409, type: ApiErrorResponseDto, description: "Email already in use" })
	async createUser(
		@Body(new ZodValidationPipe(SignupSchema))
		body: SignupInput,
	): Promise<UserResponse> {
		const result = await this.authService.signup(body);
		return result.user;
	}
}
