import { createZodDto } from "nestjs-zod";

import { ChangePasswordSchema } from "@workspace/shared";

export class ChangePasswordDto extends createZodDto(ChangePasswordSchema) {}
