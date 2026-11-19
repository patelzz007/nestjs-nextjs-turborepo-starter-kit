import { Inject, Injectable } from "@nestjs/common";
import type { AdminMerchantInviteAvailability, AdminMerchantInvitePreviewQuery, EmailPreview } from "@workspace/shared";

import { TENANT_PROVISIONING_GATE, type TenantProvisioningGate } from "../../../../platform/application/tenancy/tenant-provisioning.port";
import type { MerchantInviteEmailPreviewPort } from "../ports/tenant-emails.port";
import { TENANT_EMAILS } from "../ports/tenants.tokens";

/** What the platform's "invite a merchant" form needs before it sends anything (ADR 096). */
@Injectable()
export class MerchantInviteApplicationService {
	public constructor(
		@Inject(TENANT_PROVISIONING_GATE) private readonly provisioning: TenantProvisioningGate,
		@Inject(TENANT_EMAILS) private readonly emails: MerchantInviteEmailPreviewPort,
	) {}

	/** Whether this deployment may provision another tenant (single-tenant mode never does). */
	public availability(): AdminMerchantInviteAvailability {
		return { available: this.provisioning.isProvisioningAllowed() };
	}

	/** The invite email as the merchant would receive it, never sent. */
	public previewInviteEmail(input: AdminMerchantInvitePreviewQuery): EmailPreview {
		return this.emails.previewMerchantInvite(input);
	}
}
