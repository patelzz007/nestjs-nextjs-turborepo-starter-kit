import { Controller, Get, Post, Body } from "@nestjs/common"
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
} from "@nestjs/swagger"
import { LoginRequestSchema, CreateUserSchema } from "@workspace/shared"
import type { LoginRequest, CreateUser } from "@workspace/shared"
import { AppService } from "./app.service"
import { ZodValidationPipe } from "./common/pipes/zod-validation.pipe"
import { LoginRequestDto } from "./common/dto/login-request.dto"
import { CreateUserDto } from "./common/dto/create-user.dto"
import { HealthResponseDto } from "./common/dto/health-response.dto"
import { LoginResponseDto } from "./common/dto/login-response.dto"
import { CreateUserResponseDto } from "./common/dto/create-user-response.dto"

@ApiTags("App")
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: "Welcome message" })
  @ApiOkResponse({ type: String, description: "Welcome message" })
  getHello(): string {
    return this.appService.getHello()
  }

  @Get("health")
  @ApiOperation({ summary: "Health check (includes DB status)" })
  @ApiOkResponse({
    type: HealthResponseDto,
    description: "Current service health status",
  })
  async getHealth() {
    return this.appService.healthCheck()
  }

  @Post("auth/login")
  @ApiOperation({ summary: "Authenticate a user" })
  @ApiBody({ type: LoginRequestDto })
  @ApiOkResponse({ type: LoginResponseDto, description: "JWT access token" })
  login(
    @Body(new ZodValidationPipe(LoginRequestSchema))
    body: LoginRequest
  ) {
    // Placeholder — real auth will be added later
    return {
      accessToken: "placeholder-token",
      tokenType: "Bearer",
      expiresIn: 3600,
    }
  }

  @Post("users")
  @ApiOperation({ summary: "Create a new user" })
  @ApiBody({ type: CreateUserDto })
  @ApiCreatedResponse({
    type: CreateUserResponseDto,
    description: "The created user",
  })
  async createUser(
    @Body(new ZodValidationPipe(CreateUserSchema))
    body: CreateUser
  ) {
    return this.appService.createUser(body)
  }
}
