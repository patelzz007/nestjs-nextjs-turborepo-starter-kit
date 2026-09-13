import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { AuthorizationCedarModule } from "../authorization-cedar/authorization-cedar.module";
import { OrganizationAdminController } from "./controllers/organization-admin.controller";
import { OrganizationController } from "./controllers/organization.controller";
import { OrganizationAuditService } from "./services/organization-audit.service";
import { OrganizationContextService } from "./services/organization-context.service";
import { OrganizationLifecycleService } from "./services/organization-lifecycle.service";
import { OrganizationMembershipService } from "./services/organization-membership.service";
import { OrganizationProvisioningService } from "./services/organization-provisioning.service";
import { OrganizationErasureService } from "./services/organization-erasure.service";
import { OrganizationQuotaService } from "./services/organization-quota.service";

@Module({
	imports: [AuthModule, AuthorizationCedarModule],
	controllers: [OrganizationController, OrganizationAdminController],
	providers: [
		OrganizationAuditService,
		OrganizationContextService,
		OrganizationProvisioningService,
		OrganizationLifecycleService,
		OrganizationMembershipService,
		OrganizationQuotaService,
		OrganizationErasureService,
	],
	exports: [OrganizationContextService, OrganizationProvisioningService, OrganizationQuotaService],
})
export class OrganizationModule {}
