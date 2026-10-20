import { describe, expect, it } from "vitest";

import { createTestTypedConfig } from "../../../../../test/support/test-api-env";
import { TenancyConfigService } from "../../../../config/tenancy.config";
import { ModeTenantProvisioningGate } from "../tenant-provisioning.gate";

const DEFAULT_TENANT = "5c1e2f3a-4b5c-4d6e-8f70-819203a4b5c6";

function gate(env: Readonly<Record<string, string | undefined>>): ModeTenantProvisioningGate {
	return new ModeTenantProvisioningGate(new TenancyConfigService(createTestTypedConfig(env)));
}

describe("ModeTenantProvisioningGate", () => {
	it("lets a multi-tenant deployment create tenants from invites", () => {
		expect(gate({ TENANCY_ENABLED: "true", DEFAULT_TENANT_ID: undefined }).isProvisioningAllowed()).toBe(true);
	});

	it("refuses new tenants on a single-tenant deployment, which serves only its configured tenant", () => {
		expect(gate({ TENANCY_ENABLED: "false", DEFAULT_TENANT_ID: DEFAULT_TENANT }).isProvisioningAllowed()).toBe(false);
	});
});
