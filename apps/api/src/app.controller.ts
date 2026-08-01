import { Controller, Get, Post, Body } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBody, ApiOkResponse, ApiCreatedResponse, ApiResponse } from "@nestjs/swagger";
import { SignupSchema, HealthResponseSchema, UserResponseSchema } from "@workspace/shared";
import type { UserResponse, SignupInput } from "@workspace/shared";
import { z } from "zod";

import { AppService } from "./app.service";
import { Public } from "./common/decorators/public.decorator";
import { ApiErrorResponseDto } from "./common/dto/api-response.dto";
import { CreateUserDto } from "./common/dto/create-user.dto";
import { createWrappedDto } from "./common/dto/response-wrapper";
import { ZodValidationPipe } from "./common/pipes/zod-validation.pipe";
import { AuthService } from "./modules/auth/auth.service";

// ── Wrapped Response DTOs ────────────────────────────────────────────────

const WrappedHelloResponse = createWrappedDto(z.string(), "WrappedHelloResponse");
const WrappedHealthResponse = createWrappedDto(HealthResponseSchema, "WrappedHealthResponse");
const WrappedCreatedUserResponse = createWrappedDto(UserResponseSchema, "WrappedCreatedUserResponse");

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
