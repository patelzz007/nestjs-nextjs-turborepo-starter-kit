import { MERCHANT_CAPABILITY } from "@workspace/shared";

import type { TenantFileCapabilities } from "../ports/tenant-file-access.port";

/** Store branding: managed by `manage_locations`, readable by every member (`view_locations` is membership-only). */
export const STORE_BRANDING_CAPABILITIES: TenantFileCapabilities = {
	manage: MERCHANT_CAPABILITY.manageLocations,
	read: MERCHANT_CAPABILITY.viewLocations,
	deniedMessage: "Your tenant role cannot change store branding",
};

/** KYB evidence: `view_verification` (kyb.read) reads it; `manage_verification` (kyb.update, the Owner's) changes it. */
export const KYB_EVIDENCE_CAPABILITIES: TenantFileCapabilities = {
	manage: MERCHANT_CAPABILITY.manageVerification,
	read: MERCHANT_CAPABILITY.viewVerification,
	deniedMessage: "Your tenant role cannot manage verification documents",
};
