import { UserResponseSchema } from "@workspace/shared";
import { createZodDto } from "nestjs-zod/dto";

/** DTO for user response — auto-generates OpenAPI schema via nestjs-zod */
export class CreateUserResponseDto extends createZodDto(UserResponseSchema) {}
