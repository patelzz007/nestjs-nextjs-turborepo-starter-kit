import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { OrganizationAuditService } from "../organization/services/organization-audit.service";
import { SupportAccessController } from "./support-access.controller";
import { SupportAccessService } from "./support-access.service";

@Module({
	imports: [AuthModule],
	controllers: [SupportAccessController],
	providers: [SupportAccessService, OrganizationAuditService],
	exports: [SupportAccessService],
})
export class SupportAccessModule {}
