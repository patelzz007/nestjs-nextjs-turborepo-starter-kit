import { ResendVerificationResponseSchema } from "@workspace/shared";
import { createZodDto } from "nestjs-zod";

/** Response DTO for POST /auth/resend-verification */
export class ResendVerificationResponseDto extends createZodDto(ResendVerificationResponseSchema) {}
