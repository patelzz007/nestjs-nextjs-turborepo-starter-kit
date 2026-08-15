import { Body, Controller, Post } from "@nestjs/common";
import { ApiBody, ApiCreatedResponse, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { SignupSchema, UserResponseSchema, type SignupInput, type UserResponse } from "@workspace/shared";

import { ApiErrorResponseDto } from "../../common/dto/api-response.dto";
import { createWrappedDto } from "../../common/dto/response-wrapper";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AuthService } from "./auth.service";
import { Public } from "./decorators/public.decorator";
import { CreateUserDto } from "./dtos/create-user.dto";

const WrappedCreatedUserResponse = createWrappedDto(UserResponseSchema, "WrappedCreatedUserResponse");

/**
 * Root-level user creation (`POST /users` — no `/auth` prefix).
 *
 * Moved here from the old root `AppController` (folder-structure pass, item
 * 11). The web app's signup form uses the prefixed `/auth/signup`; this
 * root route is a public compatibility wrapper that returns just the created
 * user. URL is unchanged.
 */
@ApiTags("Auth")
@Controller()
export class RootUsersController {
	constructor(private readonly authService: AuthService) {}

	@Public()
	@Post("users")
	@ApiOperation({ summary: "Create a new user" })
	@ApiBody({ type: CreateUserDto })
	@ApiCreatedResponse({ type: WrappedCreatedUserResponse, description: "The created user" })
	@ApiResponse({ status: 409, type: ApiErrorResponseDto, description: "Email already in use" })
	public async createUser(
		@Body(new ZodValidationPipe(SignupSchema))
		body: SignupInput,
	): Promise<UserResponse> {
		const result = await this.authService.signup(body);
		return result.user;
	}
}
