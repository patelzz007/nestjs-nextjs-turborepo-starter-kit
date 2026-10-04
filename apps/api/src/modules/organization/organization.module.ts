import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AuthorizationCedarModule } from "../authorization-cedar/authorization-cedar.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { OrganizationAdminController } from "./controllers/organization-admin.controller";
import { OrganizationController } from "./controllers/organization.controller";
import { OrganizationTeamInviteController } from "./controllers/organization-team-invite.controller";
import { OrganizationAuditService } from "./services/organization-audit.service";
import { OrganizationContextService } from "./services/organization-context.service";
import { OrganizationLifecycleEventRecorder } from "./services/organization-lifecycle-event.recorder";
import { OrganizationLifecycleService } from "./services/organization-lifecycle.service";
import { OrganizationMembershipService } from "./services/organization-membership.service";
import { OrganizationOwnMembershipService } from "./services/organization-own-membership.service";
import { OrganizationProvisioningService } from "./services/organization-provisioning.service";
import { OrganizationErasureService } from "./services/organization-erasure.service";
import { OrganizationQuotaService } from "./services/organization-quota.service";
import { OrganizationInviteRepository } from "./repositories/organization-invite.repository";
import { OrganizationLocationRepository } from "./repositories/organization-location.repository";
import { OrganizationRepository } from "./repositories/organization.repository";
import { StoreAccessRepository } from "./repositories/store-access.repository";
import { OrganizationStoreMemberService } from "./services/organization-store-member.service";
import { OrganizationLocationService } from "./services/organization-location.service";
import { OrganizationRewardAuthService } from "./services/organization-reward-auth.service";

@Module({
	imports: [PrismaModule, AuthModule, AuthorizationCedarModule, NotificationsModule],
	controllers: [OrganizationController, OrganizationTeamInviteController, OrganizationAdminController],
	providers: [
		OrganizationRepository,
		OrganizationLocationRepository,
		StoreAccessRepository,
		OrganizationInviteRepository,
		OrganizationAuditService,
		OrganizationStoreMemberService,
		OrganizationLocationService,
		OrganizationContextService,
		OrganizationProvisioningService,
		OrganizationLifecycleEventRecorder,
		OrganizationLifecycleService,
		OrganizationMembershipService,
		OrganizationOwnMembershipService,
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
		OrganizationLocationRepository,
		OrganizationLocationService,
		OrganizationInviteRepository,
	],
})
export class OrganizationModule {}
