import { describe, expect, it } from "vitest";

import type { FileReferenceSubject } from "../../../files/public-api";
import type { RewardImageFileScope } from "../ports/reward-image-files.port";
import { REWARD_IMAGE_CAPABILITIES } from "../services/reward-image-file-capabilities";
import { RewardImageInUseGuard } from "../services/reward-image-in-use.guard";

const SUBJECT: FileReferenceSubject = { fileId: "file-1", category: "REWARD_IMAGE", tenantId: "org-1" };

function scope(liveUses: number): RewardImageFileScope {
	return { rewardImages: { countLiveUses: (): Promise<number> => Promise.resolve(liveUses) } };
}

describe("RewardImageInUseGuard", () => {
	it("refuses to delete an image a live reward shows", async () => {
		await expect(new RewardImageInUseGuard().blockDelete(SUBJECT, scope(2))).resolves.toBe("REWARD_IMAGE");
	});

	it("lets an unused image go, as the deleting actor", async () => {
		const guard = new RewardImageInUseGuard();

		await expect(guard.blockDelete(SUBJECT, scope(0))).resolves.toBeNull();
		expect(guard.categories).toEqual(["REWARD_IMAGE"]);
		expect(guard.deletionScope).toBe("actor");
	});
});

describe("REWARD_IMAGE_CAPABILITIES", () => {
	it("reads with view_rewards and changes with manage_rewards", () => {
		expect(REWARD_IMAGE_CAPABILITIES).toMatchObject({ read: "merchant:view_rewards", manage: "merchant:manage_rewards" });
	});
});
