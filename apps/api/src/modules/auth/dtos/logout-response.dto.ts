import { createZodDto } from "nestjs-zod";
import { LogoutResponseSchema } from "@workspace/shared";

export class LogoutResponseDto extends createZodDto(LogoutResponseSchema) {}
