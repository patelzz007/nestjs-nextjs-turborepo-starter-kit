import { createZodDto } from "nestjs-zod";
import { StopImpersonationResponseSchema } from "@workspace/shared";

export class StopImpersonationResponseDto extends createZodDto(StopImpersonationResponseSchema) {}
