import { Module } from "@nestjs/common";

import { PermissionGuard } from "./permission.guard";
import { RbacService } from "./rbac.service";

@Module({
	providers: [RbacService, PermissionGuard],
	exports: [RbacService, PermissionGuard],
})
export class RbacModule {}
