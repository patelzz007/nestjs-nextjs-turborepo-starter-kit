import { createZodDto } from "nestjs-zod";
import { VerifyEmailResponseSchema } from "@workspace/shared";

export class VerifyEmailResponseDto extends createZodDto(VerifyEmailResponseSchema) {}
