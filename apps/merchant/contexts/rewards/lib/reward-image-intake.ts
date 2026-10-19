import { REWARD_IMAGE_RULES } from "@/contexts/rewards/lib/use-upload-reward-image";
import { takeImage, type ImageIntake } from "@workspace/client/lib/storage/image-intake";

// ============================================
// lib/rewards/reward-image-intake.ts — what happens to a reward photo the merchant picks
// ============================================
// The shared intake (`takeImage`) under the reward-image rules: too small for a
// Full HD image even zoomed out → refused; already 16:9 → prepared at once; any
// other shape → the merchant chooses the crop first.

/** Reads a picked reward photo upright and decides its next step. */
export function takeRewardImage(source: File): Promise<ImageIntake> {
	return takeImage(source, REWARD_IMAGE_RULES);
}
