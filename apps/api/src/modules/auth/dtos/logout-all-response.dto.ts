import { createZodDto } from "nestjs-zod";
import { LogoutAllResponseSchema } from "@workspace/shared";

export class LogoutAllResponseDto extends createZodDto(LogoutAllResponseSchema) {}
