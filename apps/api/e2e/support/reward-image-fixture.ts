import { randomUUID } from "node:crypto";

import { rewardCoverImageSeedId, type RewardImageSetSlug } from "../../prisma/seed/reward-images";

/**
 * Gives a reward inserted by raw SQL its cover: every reward shows at least one
 * image, and responses are built from them. The file is a seeded READY reward
 * image of the same tenant (prisma/seed/reward-images.ts).
 */
export const INSERT_REWARD_COVER_SQL = 'INSERT INTO public."RewardImage" (id, "tenantId", "rewardId", "fileId", position) VALUES ($1, $2, $3, $4, 0)';

/** Parameters of {@link INSERT_REWARD_COVER_SQL}: row id, tenant, reward, and the seeded cover of `slug`. */
export function rewardCoverParams(rewardId: string, tenantId: string, slug: RewardImageSetSlug): readonly [string, string, string, string] {
	return [randomUUID(), tenantId, rewardId, rewardCoverImageSeedId(slug)];
}
