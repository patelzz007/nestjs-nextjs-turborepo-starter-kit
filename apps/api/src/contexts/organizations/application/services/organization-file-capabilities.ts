import { MERCHANT_CAPABILITY } from "@workspace/shared";

import type { OrganizationFileCapabilities } from "../ports/organization-file-access.port";

/** Store branding: managed by `manage_locations`, readable by every member (`view_locations` is membership-only). */
export const STORE_BRANDING_CAPABILITIES: OrganizationFileCapabilities = {
	manage: MERCHANT_CAPABILITY.manageLocations,
	read: MERCHANT_CAPABILITY.viewLocations,
	deniedMessage: "Your organization role cannot change store branding",
};

/** KYB evidence: owner-only for every action. */
export const KYB_EVIDENCE_CAPABILITIES: OrganizationFileCapabilities = {
	manage: MERCHANT_CAPABILITY.manageVerification,
	read: MERCHANT_CAPABILITY.manageVerification,
	deniedMessage: "Only organization owners can manage verification documents",
};
