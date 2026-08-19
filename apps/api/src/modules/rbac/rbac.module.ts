import { Global, Module } from "@nestjs/common";

import { PermissionGuard } from "./permission.guard";
import { RbacService } from "./rbac.service";

/** Global so `PermissionGuard` (APP_GUARD) and `@RequirePermission` resolve in every module. */
@Global()
@Module({
	providers: [RbacService, PermissionGuard],
	exports: [RbacService, PermissionGuard],
})
export class RbacModule {}
