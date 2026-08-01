import { ImpersonateResponseSchema } from "@workspace/shared";
import { createZodDto } from "nestjs-zod";

export class ImpersonateResponseDto extends createZodDto(ImpersonateResponseSchema) {}
