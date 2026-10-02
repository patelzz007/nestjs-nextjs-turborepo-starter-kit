import { Module } from "@nestjs/common";

import { AuditController } from "./audit.controller";
import { PermissionsController } from "./permissions.controller";
import { RolesController } from "./roles.controller";
import { CapabilitiesCatalogController } from "../controllers/capabilities-catalog.controller";
import { PermissionAuditLogRepository } from "./repositories/permission-audit-log.repository";
import { RolePermissionPreviewRepository } from "./repositories/role-permission-preview.repository";
import { PermissionAuditLogQueryService } from "./services/permission-audit-log-query.service";
import { RoleAssignmentPreviewService } from "./services/role-assignment-preview.service";

/**
 * Admin-facing REST endpoints for managing roles and permissions.
 *
 * Protected by `@RequirePermission` decorators on each handler —
 * the global `AuthGuard` + `AuthorizationGuard` enforce them. Controllers
 * never touch Prisma: reads go through the admin read-model repositories.
 */
@Module({
	controllers: [RolesController, PermissionsController, AuditController, CapabilitiesCatalogController],
	providers: [PermissionAuditLogRepository, PermissionAuditLogQueryService, RolePermissionPreviewRepository, RoleAssignmentPreviewService],
})
export class AuthorizationAdminModule {}
