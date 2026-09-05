import MerchantRoleCapabilitiesPanel from "./merchant-role-capabilities-panel";
import { createAdminServerCaller } from "@/lib/admin-server-api";
import type { CapabilityDefinition, MerchantRoleCapabilityGrant } from "@workspace/shared";
import * as React from "react";

export const dynamic = "force-dynamic";

/** `/rewardhub/role-capabilities` — manage merchant portal capabilities per member role. */
export default async function MerchantRoleCapabilitiesPage(): Promise<React.JSX.Element> {
	const server = createAdminServerCaller();

	let initialGrants: readonly MerchantRoleCapabilityGrant[] = [];
	let initialCatalog: readonly CapabilityDefinition[] = [];

	try {
		const [grantsResponse, catalogResponse] = await Promise.all([
			server.rewardsAdmin.listMerchantRoleCapabilities.query({}),
			server.capabilities.catalog.query({ scope: "MERCHANT" }),
		]);
		initialGrants = grantsResponse.data;
		initialCatalog = catalogResponse.data;
	} catch {
		initialGrants = [];
		initialCatalog = [];
	}

	return <MerchantRoleCapabilitiesPanel initialGrants={initialGrants} initialCatalog={initialCatalog} />;
}
