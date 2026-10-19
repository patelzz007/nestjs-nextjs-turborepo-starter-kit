import { MERCHANT_CAPABILITY } from "@workspace/shared";

import type { OrganizationFileCapabilities } from "../../../organizations/public-api";

/** Reward images: `manage_rewards` to change, `view_rewards` for metadata and signed URLs (the published copy is public). */
export const REWARD_IMAGE_CAPABILITIES: OrganizationFileCapabilities = {
	manage: MERCHANT_CAPABILITY.manageRewards,
	read: MERCHANT_CAPABILITY.viewRewards,
	deniedMessage: "Your organization role cannot change rewards",
};
