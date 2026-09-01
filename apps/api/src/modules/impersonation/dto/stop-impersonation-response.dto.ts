import { StopImpersonationResponseSchema } from "@workspace/shared";
import { createZodDto } from "nestjs-zod";

export class StopImpersonationResponseDto extends createZodDto(StopImpersonationResponseSchema) {}
