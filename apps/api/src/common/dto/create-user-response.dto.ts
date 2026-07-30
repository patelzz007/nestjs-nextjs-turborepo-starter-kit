import { createZodDto } from "nestjs-zod/dto";
import { UserResponseSchema } from "@workspace/shared";

/** DTO for user response — auto-generates OpenAPI schema via nestjs-zod */
export class CreateUserResponseDto extends createZodDto(UserResponseSchema) {}
