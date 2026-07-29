import { createZodDto } from "nestjs-zod";
import { AdminUserDetailSchema } from "@workspace/shared";

/**
 * DTO for admin user detail response — includes internal security fields
 * (failedLoginAttempts, lockedUntil) that are not exposed to regular users.
 */
export class AdminUserDetailDto extends createZodDto(AdminUserDetailSchema) {}
