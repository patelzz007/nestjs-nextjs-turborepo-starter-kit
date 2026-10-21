import { describe, expect, it } from "vitest";

import { createTestTypedConfig } from "../../../../../test/support/test-api-env";
import { TenancyConfigService } from "../../../../config/tenancy.config";
import { ModeServedTenantPolicy } from "../served-tenant.policy";

const DEFAULT_TENANT = "5c1e2f3a-4b5c-4d6e-8f70-819203a4b5c6";
const OTHER_TENANT = "6d2f3a4b-5c6d-4e7f-8a81-92a3b4c5d6e7";

function policy(env: Readonly<Record<string, string | undefined>>): ModeServedTenantPolicy {
	return new ModeServedTenantPolicy(new TenancyConfigService(createTestTypedConfig(env)));
}

describe("ModeServedTenantPolicy", () => {
	it("serves every tenant on a multi-tenant deployment", () => {
		const multi = policy({ TENANCY_ENABLED: "true", DEFAULT_TENANT_ID: undefined });
		expect(multi.servesTenant(DEFAULT_TENANT)).toBe(true);
		expect(multi.servesTenant(OTHER_TENANT)).toBe(true);
	});

	it("serves only the configured tenant on a single-tenant deployment", () => {
		const single = policy({ TENANCY_ENABLED: "false", DEFAULT_TENANT_ID: DEFAULT_TENANT });
		expect(single.servesTenant(DEFAULT_TENANT)).toBe(true);
		expect(single.servesTenant(OTHER_TENANT)).toBe(false);
	});
});
