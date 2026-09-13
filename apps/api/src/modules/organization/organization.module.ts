import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
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
import { OrganizationInviteRepository } from "./repositories/organization-invite.repository";
import { OrganizationRepository } from "./repositories/organization.repository";
import { OrganizationRewardAuthService } from "./services/organization-reward-auth.service";

@Module({
	imports: [PrismaModule, AuthModule, AuthorizationCedarModule],
	controllers: [OrganizationController, OrganizationAdminController],
	providers: [
		OrganizationRepository,
		OrganizationInviteRepository,
		OrganizationAuditService,
		OrganizationContextService,
		OrganizationProvisioningService,
		OrganizationLifecycleService,
		OrganizationMembershipService,
		OrganizationQuotaService,
		OrganizationErasureService,
		OrganizationRewardAuthService,
	],
	exports: [
		OrganizationContextService,
		OrganizationProvisioningService,
		OrganizationQuotaService,
		OrganizationRewardAuthService,
		OrganizationRepository,
		OrganizationInviteRepository,
	],
})
export class OrganizationModule {}
