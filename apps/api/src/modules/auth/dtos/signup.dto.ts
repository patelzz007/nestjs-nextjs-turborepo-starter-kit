import { SignupResponseSchema } from "@workspace/shared";
import { createZodDto } from "nestjs-zod";

/** Response DTO for POST /auth/signup */
export class SignupResponseDto extends createZodDto(SignupResponseSchema) {}
