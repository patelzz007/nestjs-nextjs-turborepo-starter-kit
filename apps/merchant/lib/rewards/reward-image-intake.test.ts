import { afterEach, describe, expect, it, vi } from "vitest";

import { REWARD_IMAGE_RULES } from "./use-upload-reward-image";
import { takeRewardImage } from "./reward-image-intake";

const { takeImage } = vi.hoisted(() => ({ takeImage: vi.fn() }));

vi.mock("@workspace/client/lib/storage/image-intake", () => ({ takeImage }));

afterEach((): void => {
	takeImage.mockReset();
});

describe("takeRewardImage", () => {
	it("reads a picked photo under the reward-image rules (16:9, Full HD at least)", async () => {
		const photo = new File([new Uint8Array(8)], "kuih.jpg", { type: "image/jpeg" });
		const outcome = { kind: "refused", fileName: "kuih.jpg", message: "Images must be at least 1920 × 1080 pixels so they stay sharp on every screen." };
		takeImage.mockResolvedValue(outcome);

		await expect(takeRewardImage(photo)).resolves.toEqual(outcome);
		expect(takeImage).toHaveBeenCalledWith(photo, REWARD_IMAGE_RULES);
		expect(REWARD_IMAGE_RULES).toMatchObject({ aspectWidth: 16, aspectHeight: 9, minWidth: 1920 });
	});
});
