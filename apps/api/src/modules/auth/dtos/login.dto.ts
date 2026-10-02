import { LoginResponseSchema } from "@workspace/shared";
import { createZodDto } from "nestjs-zod";

/** Response DTO for POST /auth/login */
export class LoginResponseDto extends createZodDto(LoginResponseSchema) {}
