import type { RewardResponse } from "@workspace/shared";

import type { RewardMerchantDisplayPort } from "../../application/ports/reward-merchant-display.port";
import { tenantDisplayFields } from "../persistence/reward-response.mapper";
import type { TenantDisplayAdapter } from "./tenant-display.adapter";

/** {@link RewardMerchantDisplayPort} on the tenants context's display read (one batched read, after the commit). */
export class TenantMerchantDisplayAdapter implements RewardMerchantDisplayPort {
	public constructor(private readonly tenants: TenantDisplayAdapter) {}

	public async withMerchantDisplay(response: RewardResponse): Promise<RewardResponse> {
		const tenants = await this.tenants.displayData([response.tenantId]);
		return { ...response, ...tenantDisplayFields(tenants.get(response.tenantId)) };
	}
}
