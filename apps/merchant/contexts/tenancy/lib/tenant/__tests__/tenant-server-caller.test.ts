import type { ServerApiConfigInput } from "@workspace/client/lib/api/server-api";
import { LOCATION_ID_HEADER, TENANT_ID_HEADER } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { loadTenantServerCaller } from "@/contexts/tenancy/lib/tenant/tenant-server-caller";
import type { ServerLocationScope } from "@/contexts/tenancy/lib/tenant/server-location-scope";
import { TEST_ORG_SLUG } from "@/test/authorization";
import { testEnvelope } from "@/test/envelope";
import { STORE_A_LOCATION, tenantContextFixture } from "@/test/tenant-context";
import { STORE_A } from "@/test/terminals";

const { loadScope, createCaller } = vi.hoisted(() => ({
	loadScope: vi.fn<(tenantSlug: string) => Promise<ServerLocationScope>>(),
	createCaller: vi.fn<(config: ServerApiConfigInput) => object>(),
}));

vi.mock("@/contexts/tenancy/lib/tenant/server-location-scope", () => ({ loadServerLocationScope: loadScope }));
vi.mock("@workspace/client/lib/api/server-api", () => ({ createServerCaller: createCaller }));

const CONTEXT = tenantContextFixture({ locations: [STORE_A_LOCATION] });

afterEach(() => {
	vi.clearAllMocks();
});

/** The config the page's caller was built with. */
async function callerConfigFor(scope: ServerLocationScope): Promise<ServerApiConfigInput | undefined> {
	loadScope.mockResolvedValue(scope);
	createCaller.mockReturnValue({});
	await loadTenantServerCaller(TEST_ORG_SLUG);
	return createCaller.mock.calls.at(-1)?.at(0);
}

describe("loadTenantServerCaller", () => {
	it("names the open tenant and the store in effect on every server call, as the browser does", async () => {
		const config = await callerConfigFor({ selectedLocationId: STORE_A.id, effectiveLocationId: STORE_A.id, tenantContext: testEnvelope(CONTEXT) });

		expect(config).toEqual({ clientType: "merchant", requestHeaders: { [TENANT_ID_HEADER]: CONTEXT.tenant.id, [LOCATION_ID_HEADER]: STORE_A.id } });
	});

	it("names no store for All locations", async () => {
		const config = await callerConfigFor({ selectedLocationId: null, effectiveLocationId: null, tenantContext: testEnvelope(CONTEXT) });

		expect(config?.requestHeaders).toEqual({ [TENANT_ID_HEADER]: CONTEXT.tenant.id });
	});

	it("names nothing without a tenant context (not a member: the page guard denies)", async () => {
		const config = await callerConfigFor({ selectedLocationId: null, effectiveLocationId: null, tenantContext: undefined });

		expect(config?.requestHeaders).toEqual({});
	});
});
