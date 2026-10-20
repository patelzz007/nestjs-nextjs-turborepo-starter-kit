import { MERCHANT_CAPABILITY } from "@workspace/shared";

import type { TenantFileCapabilities } from "../../../tenancy/public-api";

/** Reward images: `manage_rewards` to change, `view_rewards` for metadata and signed URLs (the published copy is public). */
export const REWARD_IMAGE_CAPABILITIES: TenantFileCapabilities = {
	manage: MERCHANT_CAPABILITY.manageRewards,
	read: MERCHANT_CAPABILITY.viewRewards,
	deniedMessage: "Your tenant role cannot change rewards",
};
