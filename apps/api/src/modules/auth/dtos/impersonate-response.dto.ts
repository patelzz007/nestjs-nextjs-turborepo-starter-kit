import { createZodDto } from "nestjs-zod";
import { ImpersonateResponseSchema } from "@workspace/shared";

export class ImpersonateResponseDto extends createZodDto(ImpersonateResponseSchema) {}
