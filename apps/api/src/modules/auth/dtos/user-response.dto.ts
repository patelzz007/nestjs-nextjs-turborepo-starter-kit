import { createZodDto } from "nestjs-zod";
import { UserResponseSchema } from "@workspace/shared";

export class UserResponseDto extends createZodDto(UserResponseSchema) {}
