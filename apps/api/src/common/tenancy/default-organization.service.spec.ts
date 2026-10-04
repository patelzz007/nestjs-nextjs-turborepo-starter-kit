import { describe, expect, it, vi } from "vitest";

import { createTestTypedConfig, type TestEnv } from "../../../test/support/test-api-env";
import { createTestPrisma } from "../../../test/support/test-service-graph";
import { TenancyConfigService } from "../../config/tenancy.config";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { RequestContextService } from "../context/request-context";
import { DefaultOrganizationRepository } from "./default-organization.repository";
import { DefaultOrganizationMissingError, DefaultOrganizationService, SingleTenantOrganizationUnavailableError } from "./default-organization.service";

const LIVE_ORG = "5c1e2f3a-4b5c-4d6e-8f70-819203a4b5c6";
const MISSING_ORG = "0f0e0d0c-0b0a-4908-8706-050403020100";

class KnownOrganizations extends DefaultOrganizationRepository {
	public override isLiveOrganization(organizationId: string): Promise<boolean> {
		return Promise.resolve(organizationId === LIVE_ORG);
	}
}

function service(env: TestEnv): { readonly service: DefaultOrganizationService; readonly repository: KnownOrganizations } {
	const config = createTestTypedConfig(env);
	const repository = new KnownOrganizations(new TenantTransactionService(createTestPrisma(config), new RequestContextService()));
	return { service: new DefaultOrganizationService(new TenancyConfigService(config), repository), repository };
}

describe("DefaultOrganizationService", () => {
	it("serves the configured organization once boot verified it is a live row", async () => {
		const { service: defaults } = service({ DEFAULT_ORGANIZATION_ID: LIVE_ORG });
		expect(() => defaults.singleTenantOrganizationId()).toThrow(SingleTenantOrganizationUnavailableError);

		await defaults.onModuleInit();

		expect(defaults.singleTenantOrganizationId()).toBe(LIVE_ORG);
	});

	it("refuses to start when the configured organization does not exist", async () => {
		await expect(service({ DEFAULT_ORGANIZATION_ID: MISSING_ORG }).service.onModuleInit()).rejects.toBeInstanceOf(DefaultOrganizationMissingError);
	});

	it("resolves nothing in multi-tenant mode (no fallback organization) and never queries", async () => {
		const { service: defaults, repository } = service({ TENANCY_ENABLED: "true" });
		const lookup = vi.spyOn(repository, "isLiveOrganization");

		await defaults.onModuleInit();

		expect(lookup).not.toHaveBeenCalled();
		expect(() => defaults.singleTenantOrganizationId()).toThrow(SingleTenantOrganizationUnavailableError);
	});
});
