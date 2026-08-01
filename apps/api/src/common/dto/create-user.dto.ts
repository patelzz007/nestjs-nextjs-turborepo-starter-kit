import { SignupSchema } from "@workspace/shared";
import { createZodDto } from "nestjs-zod/dto";

/** DTO for creating a user — auto-generates OpenAPI schema via nestjs-zod */
export class CreateUserDto extends createZodDto(SignupSchema) {}
