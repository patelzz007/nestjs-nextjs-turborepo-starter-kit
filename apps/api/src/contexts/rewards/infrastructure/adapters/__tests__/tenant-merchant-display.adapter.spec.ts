import { describe, expect, it } from "vitest";

import type { TenantDisplayData, TenantReadPort } from "../../../../tenancy/public-api";
import { fakeRewardResponse } from "../../../application/__tests__/fakes/rewards-scope.fakes";
import { TenantDisplayAdapter } from "../tenant-display.adapter";
import { TenantMerchantDisplayAdapter } from "../tenant-merchant-display.adapter";

const TENANT_ID = "0b6a3c55-2f1d-4e8a-a7b9-5c4d3e2f1a10";
const LOGO_URL = "https://cdn.example.com/tenants/kopi-co/logo.png";

/** The tenants context's display read, answering for the tenants it knows and recording each read. */
function tenants(known: readonly TenantDisplayData[]): { readonly port: TenantReadPort; readonly reads: (readonly string[])[] } {
	const reads: (readonly string[])[] = [];
	return {
		reads,
		port: {
			getDisplayData: (tenantIds: readonly string[]): Promise<ReadonlyMap<string, TenantDisplayData>> => {
				reads.push(tenantIds);
				return Promise.resolve(new Map(known.filter((tenant) => tenantIds.includes(tenant.tenantId)).map((tenant): [string, TenantDisplayData] => [tenant.tenantId, tenant])));
			},
			listOwnerUserIds: (): Promise<readonly string[]> => Promise.resolve([]),
		},
	};
}

describe("TenantMerchantDisplayAdapter", () => {
	it("adds the merchant's name and logo to a response, in one read of its tenant", async () => {
		const { port, reads } = tenants([
			{
				tenantId: TENANT_ID,
				slug: "kopi-co",
				displayName: "Kopi Co",
				timeZone: "Asia/Kuala_Lumpur",
				logo: { fileId: "5a7d2c11-9e3b-4f6a-8b1c-2d3e4f5a6b7c", url: LOGO_URL, sources: [] },
			},
		]);

		const response = await new TenantMerchantDisplayAdapter(new TenantDisplayAdapter(port)).withMerchantDisplay(
			fakeRewardResponse("reward-1", TENANT_ID, "PUBLISHED", "Free latte"),
		);

		expect(response).toMatchObject({ id: "reward-1", tenantName: "Kopi Co", tenantLogoUrl: LOGO_URL, tenantLogoSources: [] });
		expect(reads).toEqual([[TENANT_ID]]);
	});

	it("leaves the merchant fields empty for a tenant that is not live", async () => {
		const response = await new TenantMerchantDisplayAdapter(new TenantDisplayAdapter(tenants([]).port)).withMerchantDisplay(
			fakeRewardResponse("reward-1", TENANT_ID, "PUBLISHED", "Free latte"),
		);

		expect(response).toMatchObject({ tenantName: undefined, tenantLogoUrl: null, tenantLogoSources: [] });
	});
});
