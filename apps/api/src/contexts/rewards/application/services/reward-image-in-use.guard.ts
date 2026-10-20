import type { FileCategory } from "@workspace/shared";

import type { FileDeletionScope, FileReferenceBlock, FileReferenceGuard, FileReferenceSubject } from "../../../files/public-api";
import type { RewardImageFileScope } from "../ports/reward-image-files.port";

/**
 * An image a live reward shows is refused deletion. The guard runs after the
 * file row is locked, and reward saves lock it too, so a save and a delete
 * never interleave.
 */
export class RewardImageInUseGuard implements FileReferenceGuard<RewardImageFileScope> {
	public readonly categories: readonly FileCategory[] = ["REWARD_IMAGE"];
	public readonly deletionScope: FileDeletionScope = "actor";

	public async blockDelete(subject: FileReferenceSubject, scope: RewardImageFileScope): Promise<FileReferenceBlock | null> {
		return (await scope.rewardImages.countLiveUses(subject.fileId)) > 0 ? "REWARD_IMAGE" : null;
	}
}
