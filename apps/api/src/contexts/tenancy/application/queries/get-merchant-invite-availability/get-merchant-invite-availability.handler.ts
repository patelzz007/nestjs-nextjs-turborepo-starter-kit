import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { AdminMerchantInviteAvailability } from "@workspace/shared";

import { TENANT_PROVISIONING_GATE, type TenantProvisioningGate } from "../../../../../platform/application/tenancy/tenant-provisioning.port";
import { GetMerchantInviteAvailabilityQuery } from "./get-merchant-invite-availability.query";

/** The same gate the invite commands enforce, so the admin panel shows the page exactly when sending works. */
@QueryHandler(GetMerchantInviteAvailabilityQuery)
export class GetMerchantInviteAvailabilityHandler implements IQueryHandler<GetMerchantInviteAvailabilityQuery, AdminMerchantInviteAvailability> {
	public constructor(@Inject(TENANT_PROVISIONING_GATE) private readonly provisioning: TenantProvisioningGate) {}

	public execute(): Promise<AdminMerchantInviteAvailability> {
		return Promise.resolve({ available: this.provisioning.isProvisioningAllowed() });
	}
}
