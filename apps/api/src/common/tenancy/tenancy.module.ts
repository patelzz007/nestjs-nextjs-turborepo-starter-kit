import { Global, Module } from "@nestjs/common";

import { DefaultOrganizationRepository } from "./default-organization.repository";
import { DefaultOrganizationService } from "./default-organization.service";

/** Resolves (and verifies at boot) the organization a single-tenant deployment serves. */
@Global()
@Module({
	providers: [DefaultOrganizationRepository, DefaultOrganizationService],
	exports: [DefaultOrganizationService],
})
export class TenancyModule {}
